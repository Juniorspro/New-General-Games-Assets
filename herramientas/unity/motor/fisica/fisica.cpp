// porteo: la física del motor (PhysX 4.1 compilado a WebAssembly, enlazado en el mismo módulo).
// C# llama a estas funciones con DllImport("porteo"). Los objetos de PhysX se nombran con enteros
// (índices en tablas) para no pasar punteros por la interfaz, y lo que PhysX informa al simular
// (contactos, triggers, juntas rotas) se junta en búferes que C# lee después de cada paso.
//
// Las reglas son las de Unity 2018.4 (que usa PhysX 3.4, la misma familia):
//  - filtro por capas con la matriz de colisión del proyecto; Physics.IgnoreCollision por pares;
//  - los triggers también ven a los cinemáticos y a los estáticos (Unity manda OnTrigger* ahí);
//  - las mallas de colisión se cocinan dando vuelta las normales (Unity es de mano izquierda);
//  - el CharacterController es el controlador de cápsula de PhysX.
#include "PxPhysicsAPI.h"
#include <cmath>
#include <cstdint>
#include <cstring>
#include <string>
#include <unordered_set>
#include <vector>

using namespace physx;

#define EXPORTAR extern "C" __attribute__((used, visibility("default")))

namespace
{
// ── tablas de objetos ──
template <typename T>
struct Tabla
{
    std::vector<T*> v;
    std::vector<int> libres;

    int Alta(T* p)
    {
        if (!libres.empty())
        {
            int i = libres.back();
            libres.pop_back();
            v[i] = p;
            return i;
        }
        v.push_back(p);
        return (int)v.size() - 1;
    }

    T* operator[](int i) const { return i >= 0 && i < (int)v.size() ? v[i] : nullptr; }

    void Baja(int i)
    {
        if (i < 0 || i >= (int)v.size() || !v[i]) return;
        v[i] = nullptr;
        libres.push_back(i);
    }
};

PxDefaultAllocator asignador;

// los avisos de PhysX se juntan acá y C# los lee después de cada paso (fx_avisos_leer):
// así no hace falta que C llame a C#
std::string avisos;

struct Errores : PxErrorCallback
{
    void reportError(PxErrorCode::Enum code, const char* message, const char* file, int line) override
    {
        if (avisos.size() > 16384) return;
        avisos += "PhysX ";
        avisos += std::to_string((int)code);
        avisos += ": ";
        avisos += message ? message : "";
        avisos += '\n';
    }
} errores;

PxFoundation* fundacion;
PxPhysics* fisica;
PxCooking* cocina;
PxDefaultCpuDispatcher* despachador;
PxScene* escena;
PxControllerManager* controladores;
PxMaterial* materialDefecto;

Tabla<PxRigidActor> actores;
Tabla<PxShape> formas;
Tabla<PxTriangleMesh> mallas;
Tabla<PxConvexMesh> convexos;
Tabla<PxHeightField> alturas;
Tabla<PxMaterial> materiales;
Tabla<PxController> ccs;
Tabla<PxJoint> juntas;

// ── filtro de colisiones ──
// simulación: word0 = bit de la capa, word1 = capas con las que choca, word2 = id del colisionador
// (para IgnoreCollision), word3 = 1 si el actor pide CCD
std::unordered_set<uint64_t> ignorados;

uint64_t Par(uint32_t a, uint32_t b) { return a < b ? ((uint64_t)a << 32) | b : ((uint64_t)b << 32) | a; }

PxFilterFlags Filtro(PxFilterObjectAttributes a0, PxFilterData d0, PxFilterObjectAttributes a1, PxFilterData d1,
                     PxPairFlags& pf, const void*, PxU32)
{
    if (!(d0.word0 & d1.word1) || !(d1.word0 & d0.word1)) return PxFilterFlag::eSUPPRESS;
    if (!ignorados.empty() && ignorados.count(Par(d0.word2, d1.word2))) return PxFilterFlag::eSUPPRESS;
    if (PxFilterObjectIsTrigger(a0) || PxFilterObjectIsTrigger(a1))
    {
        pf = PxPairFlag::eTRIGGER_DEFAULT;
        return PxFilterFlag::eDEFAULT;
    }
    pf = PxPairFlag::eCONTACT_DEFAULT | PxPairFlag::eNOTIFY_TOUCH_FOUND | PxPairFlag::eNOTIFY_TOUCH_PERSISTS |
         PxPairFlag::eNOTIFY_TOUCH_LOST | PxPairFlag::eNOTIFY_CONTACT_POINTS | PxPairFlag::ePRE_SOLVER_VELOCITY;
    if ((d0.word3 | d1.word3) & 1) pf |= PxPairFlag::eDETECT_CCD_CONTACT;
    return PxFilterFlag::eDEFAULT;
}

// ── eventos de la simulación ──
struct Evento
{
    int tipo;          // 1 contacto entra, 2 sigue, 3 sale; 4 trigger entra, 5 trigger sale; 6 junta rota
    int a, b;          // colisionadores (o la junta en a)
    int primerPunto, nPuntos;
    float vel[3];      // velocidad relativa (de a respecto de b) antes del solver
    float impulso[3];  // suma de los impulsos de los puntos
};

struct Punto
{
    float p[3];
    float n[3];
    float separacion;
    float impulso;
};

std::vector<Evento> eventos;
std::vector<Punto> puntos;
std::vector<PxContactPairPoint> extraidos(64);

int IdForma(const PxShape* s) { return s ? (int)(intptr_t)s->userData - 1 : -1; }

struct Eventos : PxSimulationEventCallback
{
    void onConstraintBreak(PxConstraintInfo* cs, PxU32 n) override
    {
        for (PxU32 i = 0; i < n; i++)
        {
            if (cs[i].type != PxConstraintExtIDs::eJOINT) continue;
            auto* j = static_cast<PxJoint*>(cs[i].externalReference);
            Evento e = {};
            e.tipo = 6;
            e.a = (int)(intptr_t)j->userData - 1;
            eventos.push_back(e);
        }
    }

    void onWake(PxActor**, PxU32) override {}
    void onSleep(PxActor**, PxU32) override {}

    void onContact(const PxContactPairHeader& h, const PxContactPair* pares, PxU32 n) override
    {
        if (h.flags & (PxContactPairHeaderFlag::eREMOVED_ACTOR_0 | PxContactPairHeaderFlag::eREMOVED_ACTOR_1)) return;
        PxVec3 v0(0), v1(0);
        if (h.extraDataStream && h.extraDataStreamSize)
        {
            PxContactPairExtraDataIterator it(h.extraDataStream, h.extraDataStreamSize);
            if (it.nextItemSet() && it.preSolverVelocity)
            {
                v0 = it.preSolverVelocity->linearVelocity[0];
                v1 = it.preSolverVelocity->linearVelocity[1];
            }
        }
        for (PxU32 i = 0; i < n; i++)
        {
            const PxContactPair& cp = pares[i];
            if (cp.flags & (PxContactPairFlag::eREMOVED_SHAPE_0 | PxContactPairFlag::eREMOVED_SHAPE_1)) continue;
            Evento e = {};
            if (cp.events & PxPairFlag::eNOTIFY_TOUCH_FOUND) e.tipo = 1;
            else if (cp.events & PxPairFlag::eNOTIFY_TOUCH_LOST) e.tipo = 3;
            else if (cp.events & PxPairFlag::eNOTIFY_TOUCH_PERSISTS) e.tipo = 2;
            else continue;
            e.a = IdForma(cp.shapes[0]);
            e.b = IdForma(cp.shapes[1]);
            PxVec3 rel = v0 - v1;
            e.vel[0] = rel.x; e.vel[1] = rel.y; e.vel[2] = rel.z;
            e.primerPunto = (int)puntos.size();
            if (cp.contactCount > 0)
            {
                if (extraidos.size() < cp.contactCount) extraidos.resize(cp.contactCount);
                PxU32 k = cp.extractContacts(extraidos.data(), cp.contactCount);
                PxVec3 imp(0);
                for (PxU32 j = 0; j < k; j++)
                {
                    const auto& x = extraidos[j];
                    Punto p;
                    p.p[0] = x.position.x; p.p[1] = x.position.y; p.p[2] = x.position.z;
                    p.n[0] = x.normal.x; p.n[1] = x.normal.y; p.n[2] = x.normal.z;
                    p.separacion = x.separation;
                    p.impulso = x.impulse.magnitude();
                    puntos.push_back(p);
                    imp += x.impulse;
                }
                e.nPuntos = (int)k;
                e.impulso[0] = imp.x; e.impulso[1] = imp.y; e.impulso[2] = imp.z;
            }
            eventos.push_back(e);
        }
    }

    void onTrigger(PxTriggerPair* pares, PxU32 n) override
    {
        for (PxU32 i = 0; i < n; i++)
        {
            const PxTriggerPair& t = pares[i];
            if (t.flags & (PxTriggerPairFlag::eREMOVED_SHAPE_TRIGGER | PxTriggerPairFlag::eREMOVED_SHAPE_OTHER)) continue;
            Evento e = {};
            e.tipo = t.status == PxPairFlag::eNOTIFY_TOUCH_FOUND ? 4 : 5;
            e.a = IdForma(t.triggerShape);
            e.b = IdForma(t.otherShape);
            eventos.push_back(e);
        }
    }

    void onAdvance(const PxRigidBody* const*, const PxTransform*, const PxU32) override {}
} receptor;

// ── consultas ──
// consulta: word0 = bit de la capa, word2 = id del colisionador
struct Golpe
{
    float p[3];
    float n[3];
    float distancia;
    int colisionador;
    int cara;
    int inicial;   // empezó solapado (barridos)
};

std::vector<Golpe> golpes;

struct FiltroConsulta : PxQueryFilterCallback
{
    PxU32 mascara = 0xffffffff;
    bool triggers = false, todos = false;
    bool sinInicial = false;   // rayos: Unity no ve los colisionadores que contienen el origen
    int excluirCc = -1;   // el actor del CharacterController que se mueve

    PxQueryHitType::Enum preFilter(const PxFilterData&, const PxShape* s, const PxRigidActor* a, PxHitFlags&) override
    {
        PxFilterData d = s->getQueryFilterData();
        if (!(d.word0 & mascara)) return PxQueryHitType::eNONE;
        if ((s->getFlags() & PxShapeFlag::eTRIGGER_SHAPE) && !triggers) return PxQueryHitType::eNONE;
        if (excluirCc >= 0 && (int)(intptr_t)a->userData - 1 == excluirCc) return PxQueryHitType::eNONE;
        return todos ? PxQueryHitType::eTOUCH : PxQueryHitType::eBLOCK;
    }

    // PhysX informa un rayo que empieza adentro de una forma como golpe a distancia 0
    PxQueryHitType::Enum postFilter(const PxFilterData&, const PxQueryHit& h) override
    {
        if (sinInicial && static_cast<const PxLocationHit&>(h).distance <= 0.0f) return PxQueryHitType::eNONE;
        return todos ? PxQueryHitType::eTOUCH : PxQueryHitType::eBLOCK;
    }
};

FiltroConsulta filtroConsulta;
bool caraTrasera = false;

const PxU32 MAX_GOLPES = 512;
PxRaycastHit toquesRayo[MAX_GOLPES];
PxSweepHit toquesBarrido[MAX_GOLPES];
PxOverlapHit toquesSolape[MAX_GOLPES];

void Anotar(const PxLocationHit& h, bool barrido)
{
    Golpe g;
    g.p[0] = h.position.x; g.p[1] = h.position.y; g.p[2] = h.position.z;
    g.n[0] = h.normal.x; g.n[1] = h.normal.y; g.n[2] = h.normal.z;
    g.distancia = h.distance;
    g.colisionador = IdForma(h.shape);
    g.cara = (int)h.faceIndex;
    g.inicial = barrido && (h.flags & PxHitFlag::eMTD) ? 1 : (barrido && h.distance <= 0.0f ? 1 : 0);
    golpes.push_back(g);
}

PxQueryFilterData DatosFiltro(bool todos, bool estaticos = true, bool dinamicos = true, bool post = false)
{
    PxQueryFlags f = PxQueryFlag::ePREFILTER;
    if (post) f |= PxQueryFlag::ePOSTFILTER;
    if (estaticos) f |= PxQueryFlag::eSTATIC;
    if (dinamicos) f |= PxQueryFlag::eDYNAMIC;
    return PxQueryFilterData(f);
}

void PrepararFiltro(uint32_t mascara, int triggers, int todos)
{
    filtroConsulta.mascara = mascara;
    filtroConsulta.triggers = triggers != 0;
    filtroConsulta.todos = todos != 0;
    filtroConsulta.sinInicial = false;
    filtroConsulta.excluirCc = -1;
}

// ── el controlador de personaje: sus golpes durante Move ──
struct GolpeCc
{
    float p[3];
    float n[3];
    float dir[3];
    float largo;
    int colisionador;
};

std::vector<GolpeCc> golpesCc;

struct ReporteCc : PxUserControllerHitReport
{
    void onShapeHit(const PxControllerShapeHit& h) override
    {
        GolpeCc g;
        g.p[0] = (float)h.worldPos.x; g.p[1] = (float)h.worldPos.y; g.p[2] = (float)h.worldPos.z;
        g.n[0] = h.worldNormal.x; g.n[1] = h.worldNormal.y; g.n[2] = h.worldNormal.z;
        g.dir[0] = h.dir.x; g.dir[1] = h.dir.y; g.dir[2] = h.dir.z;
        g.largo = h.length;
        g.colisionador = IdForma(h.shape);
        golpesCc.push_back(g);
    }
    void onControllerHit(const PxControllersHit&) override {}
    void onObstacleHit(const PxControllerObstacleHit&) override {}
} reporteCc;

PxVec3 V(const float* f) { return PxVec3(f[0], f[1], f[2]); }
PxQuat Q(const float* f) { return PxQuat(f[0], f[1], f[2], f[3]); }

PxTransform Pose(const float* p, const float* q)
{
    PxQuat r = Q(q);
    if (!r.isSane()) r = PxQuat(PxIdentity);
    return PxTransform(V(p), r.getNormalized());
}
} // namespace

// ───────────────────────────── mundo ─────────────────────────────
// copia los avisos pendientes (hasta max bytes, sin terminar en cero) y los borra
EXPORTAR int fx_avisos_leer(char* sal, int max)
{
    int n = (int)PxMin((size_t)PxMax(max, 0), avisos.size());
    memcpy(sal, avisos.data(), (size_t)n);
    avisos.clear();
    return n;
}

// g: gravedad; rebote: velocidad mínima para rebotar; pcm: contactos persistentes
EXPORTAR int fx_iniciar(float gx, float gy, float gz, float rebote, int pcm, int friccionPorParche)
{
    if (escena) return 1;
    fundacion = PxCreateFoundation(PX_PHYSICS_VERSION, asignador, errores);
    if (!fundacion) return 0;
    PxTolerancesScale escala;
    fisica = PxCreatePhysics(PX_PHYSICS_VERSION, *fundacion, escala, false, nullptr);
    if (!fisica) return 0;
    PxInitExtensions(*fisica, nullptr);
    PxCookingParams cp(escala);
    cp.meshPreprocessParams = PxMeshPreprocessingFlags(PxMeshPreprocessingFlag::eWELD_VERTICES);
    cp.meshWeldTolerance = 0.0001f;
    cp.midphaseDesc = PxMeshMidPhase::eBVH34;
    cocina = PxCreateCooking(PX_PHYSICS_VERSION, *fundacion, cp);
    despachador = PxDefaultCpuDispatcherCreate(0);
    PxSceneDesc d(escala);
    d.gravity = PxVec3(gx, gy, gz);
    d.cpuDispatcher = despachador;
    d.filterShader = Filtro;
    d.simulationEventCallback = &receptor;
    d.flags |= PxSceneFlag::eENABLE_ACTIVE_ACTORS | PxSceneFlag::eENABLE_CCD;
    if (pcm) d.flags |= PxSceneFlag::eENABLE_PCM;
    d.bounceThresholdVelocity = rebote;
    d.kineKineFilteringMode = PxPairFilteringMode::eKEEP;
    d.staticKineFilteringMode = PxPairFilteringMode::eKEEP;
    d.frictionType = friccionPorParche ? PxFrictionType::ePATCH : PxFrictionType::eONE_DIRECTIONAL;
    d.broadPhaseType = PxBroadPhaseType::eSAP;
    escena = fisica->createScene(d);
    if (!escena) return 0;
    controladores = PxCreateControllerManager(*escena);
    // el material por defecto de Unity: fricción 0.6/0.6, sin rebote, promedios
    materialDefecto = fisica->createMaterial(0.6f, 0.6f, 0.0f);
    return 1;
}

EXPORTAR void fx_gravedad(float x, float y, float z) { if (escena) escena->setGravity(PxVec3(x, y, z)); }

EXPORTAR void fx_ignorar(int a, int b, int si)
{
    if (si) ignorados.insert(Par((uint32_t)a, (uint32_t)b));
    else ignorados.erase(Par((uint32_t)a, (uint32_t)b));
}

// vuelve a filtrar los pares de una forma (después de cambiar capas o IgnoreCollision)
EXPORTAR void fx_refiltrar(int forma)
{
    PxShape* s = formas[forma];
    if (!s || !s->getActor() || !s->getActor()->getScene()) return;
    escena->resetFiltering(*s->getActor(), &s, 1);
}

// un paso de simulación; los eventos quedan en el búfer hasta el próximo paso
EXPORTAR void fx_simular(float dt)
{
    eventos.clear();
    puntos.clear();
    if (!escena || dt <= 0) return;
    escena->simulate(dt);
    escena->fetchResults(true);
}

EXPORTAR int fx_eventos(Evento** ev, Punto** pts)
{
    *ev = eventos.data();
    *pts = puntos.data();
    return (int)eventos.size();
}

// los actores dinámicos que se movieron en el último paso (para devolver sus poses a los Transform)
EXPORTAR int fx_activos(int* ids, float* poses, int max)
{
    PxU32 n = 0;
    PxActor** l = escena ? escena->getActiveActors(n) : nullptr;
    int k = 0;
    for (PxU32 i = 0; i < n && k < max; i++)
    {
        auto* a = l[i]->is<PxRigidDynamic>();
        if (!a || (a->getRigidBodyFlags() & PxRigidBodyFlag::eKINEMATIC)) continue;
        PxTransform t = a->getGlobalPose();
        ids[k] = (int)(intptr_t)a->userData - 1;
        float* p = poses + k * 7;
        p[0] = t.p.x; p[1] = t.p.y; p[2] = t.p.z;
        p[3] = t.q.x; p[4] = t.q.y; p[5] = t.q.z; p[6] = t.q.w;
        k++;
    }
    return k;
}

// ───────────────────────────── actores ─────────────────────────────
EXPORTAR int fx_actor(int dinamico, const float* pos, const float* rot)
{
    PxTransform t = Pose(pos, rot);
    PxRigidActor* a = dinamico ? (PxRigidActor*)fisica->createRigidDynamic(t) : (PxRigidActor*)fisica->createRigidStatic(t);
    if (!a) return -1;
    int id = actores.Alta(a);
    a->userData = (void*)(intptr_t)(id + 1);
    return id;
}

EXPORTAR void fx_actor_borrar(int id)
{
    PxRigidActor* a = actores[id];
    if (!a) return;
    // las formas propias se sueltan con el actor
    PxU32 n = a->getNbShapes();
    std::vector<PxShape*> ss(n);
    if (n) a->getShapes(ss.data(), n);
    for (auto* s : ss) { int f = IdForma(s); if (f >= 0) formas.Baja(f); }
    if (a->getScene()) a->getScene()->removeActor(*a);
    a->release();
    actores.Baja(id);
}

EXPORTAR void fx_actor_en_escena(int id, int si)
{
    PxRigidActor* a = actores[id];
    if (!a || !escena) return;
    bool esta = a->getScene() != nullptr;
    if (si && !esta) escena->addActor(*a);
    else if (!si && esta) escena->removeActor(*a);
}

EXPORTAR void fx_actor_pose(int id, const float* pos, const float* rot)
{
    PxRigidActor* a = actores[id];
    if (a) a->setGlobalPose(Pose(pos, rot));
}

EXPORTAR void fx_actor_pose_leer(int id, float* p)
{
    PxRigidActor* a = actores[id];
    if (!a) return;
    PxTransform t = a->getGlobalPose();
    p[0] = t.p.x; p[1] = t.p.y; p[2] = t.p.z;
    p[3] = t.q.x; p[4] = t.q.y; p[5] = t.q.z; p[6] = t.q.w;
}

// MovePosition/MoveRotation de un cinemático
EXPORTAR void fx_actor_objetivo(int id, const float* pos, const float* rot)
{
    PxRigidActor* a = actores[id];
    auto* d = a ? a->is<PxRigidDynamic>() : nullptr;
    if (d && (d->getRigidBodyFlags() & PxRigidBodyFlag::eKINEMATIC) && d->getScene()) d->setKinematicTarget(Pose(pos, rot));
    else if (a) a->setGlobalPose(Pose(pos, rot));
}

PxRigidDynamic* Din(int id)
{
    PxRigidActor* a = actores[id];
    return a ? a->is<PxRigidDynamic>() : nullptr;
}

// la masa y la inercia a partir de las formas (con el centro de masa automático, como Unity)
EXPORTAR void fx_cuerpo_masa(int id, float masa)
{
    PxRigidDynamic* d = Din(id);
    if (!d) return;
    if (d->getNbShapes() > 0) PxRigidBodyExt::setMassAndUpdateInertia(*d, PxMax(masa, 1e-7f));
    else { d->setMass(PxMax(masa, 1e-7f)); d->setMassSpaceInertiaTensor(PxVec3(1)); }
}

EXPORTAR void fx_cuerpo_amortiguacion(int id, float lineal, float angular)
{
    PxRigidDynamic* d = Din(id);
    if (!d) return;
    d->setLinearDamping(lineal);
    d->setAngularDamping(angular);
}

EXPORTAR void fx_cuerpo_gravedad(int id, int usa)
{
    PxRigidDynamic* d = Din(id);
    if (d) d->setActorFlag(PxActorFlag::eDISABLE_GRAVITY, !usa);
}

EXPORTAR void fx_cuerpo_cinematico(int id, int si)
{
    PxRigidDynamic* d = Din(id);
    if (!d) return;
    d->setRigidBodyFlag(PxRigidBodyFlag::eKINEMATIC, si != 0);
}

// modo de Unity: 0 discreto, 1 continuo, 2 continuo dinámico, 3 especulativo
EXPORTAR void fx_cuerpo_ccd(int id, int modo)
{
    PxRigidDynamic* d = Din(id);
    if (!d) return;
    bool cinematico = d->getRigidBodyFlags() & PxRigidBodyFlag::eKINEMATIC;
    d->setRigidBodyFlag(PxRigidBodyFlag::eENABLE_CCD, !cinematico && (modo == 1 || modo == 2));
    d->setRigidBodyFlag(PxRigidBodyFlag::eENABLE_SPECULATIVE_CCD, modo == 3);
}

// RigidbodyConstraints de Unity (posición x=2,y=4,z=8; rotación x=16,y=32,z=64) → PxRigidDynamicLockFlag
EXPORTAR void fx_cuerpo_bloqueos(int id, int c)
{
    PxRigidDynamic* d = Din(id);
    if (!d) return;
    PxRigidDynamicLockFlags f;
    if (c & 2) f |= PxRigidDynamicLockFlag::eLOCK_LINEAR_X;
    if (c & 4) f |= PxRigidDynamicLockFlag::eLOCK_LINEAR_Y;
    if (c & 8) f |= PxRigidDynamicLockFlag::eLOCK_LINEAR_Z;
    if (c & 16) f |= PxRigidDynamicLockFlag::eLOCK_ANGULAR_X;
    if (c & 32) f |= PxRigidDynamicLockFlag::eLOCK_ANGULAR_Y;
    if (c & 64) f |= PxRigidDynamicLockFlag::eLOCK_ANGULAR_Z;
    d->setRigidDynamicLockFlags(f);
}

EXPORTAR void fx_cuerpo_ajustes(int id, float maxVelAngular, float umbralDormir, int iteraciones, int iteracionesVel)
{
    PxRigidDynamic* d = Din(id);
    if (!d) return;
    d->setMaxAngularVelocity(maxVelAngular);
    d->setSleepThreshold(umbralDormir);
    d->setSolverIterationCounts((PxU32)PxMax(iteraciones, 1), (PxU32)PxMax(iteracionesVel, 0));
}

EXPORTAR void fx_cuerpo_velocidad(int id, float x, float y, float z)
{
    PxRigidDynamic* d = Din(id);
    if (d && d->getScene() && !(d->getRigidBodyFlags() & PxRigidBodyFlag::eKINEMATIC)) d->setLinearVelocity(PxVec3(x, y, z));
}

EXPORTAR void fx_cuerpo_velocidad_angular(int id, float x, float y, float z)
{
    PxRigidDynamic* d = Din(id);
    if (d && d->getScene() && !(d->getRigidBodyFlags() & PxRigidBodyFlag::eKINEMATIC)) d->setAngularVelocity(PxVec3(x, y, z));
}

// velocidad lineal y angular (6 floats)
EXPORTAR void fx_cuerpo_velocidades(int id, float* v)
{
    PxRigidDynamic* d = Din(id);
    if (!d) { for (int i = 0; i < 6; i++) v[i] = 0; return; }
    PxVec3 l = d->getLinearVelocity(), a = d->getAngularVelocity();
    v[0] = l.x; v[1] = l.y; v[2] = l.z; v[3] = a.x; v[4] = a.y; v[5] = a.z;
}

// ForceMode de Unity: 0 Force, 1 Impulse, 2 VelocityChange, 5 Acceleration
PxForceMode::Enum Modo(int m)
{
    switch (m)
    {
    case 1: return PxForceMode::eIMPULSE;
    case 2: return PxForceMode::eVELOCITY_CHANGE;
    case 5: return PxForceMode::eACCELERATION;
    default: return PxForceMode::eFORCE;
    }
}

bool Empujable(PxRigidDynamic* d) { return d && d->getScene() && !(d->getRigidBodyFlags() & PxRigidBodyFlag::eKINEMATIC); }

EXPORTAR void fx_cuerpo_fuerza(int id, float x, float y, float z, int modo)
{
    PxRigidDynamic* d = Din(id);
    if (Empujable(d)) d->addForce(PxVec3(x, y, z), Modo(modo), true);
}

EXPORTAR void fx_cuerpo_torque(int id, float x, float y, float z, int modo)
{
    PxRigidDynamic* d = Din(id);
    if (Empujable(d)) d->addTorque(PxVec3(x, y, z), Modo(modo), true);
}

EXPORTAR void fx_cuerpo_fuerza_en(int id, float x, float y, float z, float px, float py, float pz, int modo)
{
    PxRigidDynamic* d = Din(id);
    if (Empujable(d)) PxRigidBodyExt::addForceAtPos(*d, PxVec3(x, y, z), PxVec3(px, py, pz), Modo(modo), true);
}

EXPORTAR void fx_cuerpo_dormir(int id, int dormir)
{
    PxRigidDynamic* d = Din(id);
    if (!Empujable(d)) return;
    if (dormir) d->putToSleep();
    else d->wakeUp();
}

EXPORTAR int fx_cuerpo_dormido(int id)
{
    PxRigidDynamic* d = Din(id);
    return d && d->getScene() ? (d->isSleeping() ? 1 : 0) : 1;
}

// el centro de masa en el mundo y la masa (4 floats)
EXPORTAR void fx_cuerpo_centro(int id, float* c)
{
    PxRigidDynamic* d = Din(id);
    if (!d) return;
    PxTransform t = d->getGlobalPose() * d->getCMassLocalPose();
    c[0] = t.p.x; c[1] = t.p.y; c[2] = t.p.z; c[3] = d->getMass();
}

// ───────────────────────────── geometría cocinada ─────────────────────────────
// opciones de Unity (MeshColliderCookingOptions): 2 simulación rápida, 4 limpiar, 8 soldar, 16 midphase rápido
EXPORTAR int fx_malla(const float* v, int nv, const uint32_t* tris, int ntris, int opciones)
{
    if (!cocina || nv <= 0 || ntris <= 0) return -1;
    PxCookingParams cp = cocina->getParams();
    cp.meshPreprocessParams = PxMeshPreprocessingFlags();
    if (opciones & 8) cp.meshPreprocessParams |= PxMeshPreprocessingFlag::eWELD_VERTICES;
    if (!(opciones & 4)) cp.meshPreprocessParams |= PxMeshPreprocessingFlag::eDISABLE_CLEAN_MESH;
    // (con BVH34 no hay elección entre cocinar rápido o simular rápido: la opción 2 de Unity no cambia nada)
    cocina->setParams(cp);
    PxTriangleMeshDesc d;
    d.points.count = (PxU32)nv;
    d.points.stride = sizeof(float) * 3;
    d.points.data = v;
    d.triangles.count = (PxU32)ntris;
    d.triangles.stride = sizeof(uint32_t) * 3;
    d.triangles.data = tris;
    // sin eFLIPNORMALS: lo que Unity dibuja de frente (horario visto de frente, en su sistema de
    // mano izquierda) tiene como normal (v1-v0)x(v2-v0) la que apunta afuera, que es lo que PhysX
    // toma como frente. Dadas vuelta, los rayos (de una cara, como queriesHitBackfaces = false en
    // Unity) no veían el suelo desde arriba, y lo que se apoyaba se hundía: frutas y cajas caían
    // al mar. Los objetos espejados (escala negativa) los resuelve PxMeshScale.
    d.flags = PxMeshFlags();
    PxTriangleMesh* m = cocina->createTriangleMesh(d, fisica->getPhysicsInsertionCallback());
    return m ? mallas.Alta(m) : -1;
}

EXPORTAR int fx_convexo(const float* v, int nv)
{
    if (!cocina || nv <= 0) return -1;
    PxConvexMeshDesc d;
    d.points.count = (PxU32)nv;
    d.points.stride = sizeof(float) * 3;
    d.points.data = v;
    // como Unity: el casco convexo de los vértices, con el máximo de 255 polígonos
    d.flags = PxConvexFlag::eCOMPUTE_CONVEX | PxConvexFlag::eCHECK_ZERO_AREA_TRIANGLES | PxConvexFlag::eSHIFT_VERTICES;
    d.vertexLimit = 255;
    PxConvexMesh* c = cocina->createConvexMesh(d, fisica->getPhysicsInsertionCallback());
    if (!c)
    {
        // con pocos o casi coplanares, PhysX puede rechazarlos: probar inflando un poco
        d.flags |= PxConvexFlag::eQUANTIZE_INPUT;
        c = cocina->createConvexMesh(d, fisica->getPhysicsInsertionCallback());
    }
    return c ? convexos.Alta(c) : -1;
}

// alturas del terreno: filas por x, columnas por z; valores de 0 a 32766 (como Unity)
EXPORTAR int fx_alturas(const int16_t* muestras, int filas, int columnas)
{
    if (filas < 2 || columnas < 2) return -1;
    std::vector<PxHeightFieldSample> m((size_t)filas * columnas);
    for (int i = 0; i < filas * columnas; i++)
    {
        m[i].height = muestras[i];
        m[i].materialIndex0 = 0;
        m[i].materialIndex1 = 0;
        m[i].clearTessFlag();
    }
    PxHeightFieldDesc d;
    d.nbRows = (PxU32)filas;
    d.nbColumns = (PxU32)columnas;
    d.samples.data = m.data();
    d.samples.stride = sizeof(PxHeightFieldSample);
    PxHeightField* h = cocina->createHeightField(d, fisica->getPhysicsInsertionCallback());
    return h ? alturas.Alta(h) : -1;
}

EXPORTAR void fx_malla_borrar(int id) { if (auto* m = mallas[id]) { m->release(); mallas.Baja(id); } }
EXPORTAR void fx_convexo_borrar(int id) { if (auto* c = convexos[id]) { c->release(); convexos.Baja(id); } }

// ───────────────────────────── materiales ─────────────────────────────
// combinar de Unity (Average 0, Minimum 1, Multiply 2, Maximum 3) → PxCombineMode
PxCombineMode::Enum Combinar(int c)
{
    switch (c)
    {
    case 1: return PxCombineMode::eMIN;
    case 2: return PxCombineMode::eMULTIPLY;
    case 3: return PxCombineMode::eMAX;
    default: return PxCombineMode::eAVERAGE;
    }
}

EXPORTAR int fx_material(float dinamica, float estatica, float rebote, int combFriccion, int combRebote)
{
    PxMaterial* m = fisica->createMaterial(estatica, dinamica, rebote);
    m->setFrictionCombineMode(Combinar(combFriccion));
    m->setRestitutionCombineMode(Combinar(combRebote));
    return materiales.Alta(m);
}

EXPORTAR void fx_material_cambiar(int id, float dinamica, float estatica, float rebote, int combFriccion, int combRebote)
{
    PxMaterial* m = materiales[id];
    if (!m) return;
    m->setStaticFriction(estatica);
    m->setDynamicFriction(dinamica);
    m->setRestitution(rebote);
    m->setFrictionCombineMode(Combinar(combFriccion));
    m->setRestitutionCombineMode(Combinar(combRebote));
}

// ───────────────────────────── formas ─────────────────────────────
PxShape* Crear(int actor, const PxGeometry& g, int material)
{
    PxRigidActor* a = actores[actor];
    if (!a) return nullptr;
    PxMaterial* m = materiales[material];
    if (!m) m = materialDefecto;
    return PxRigidActorExt::createExclusiveShape(*a, g, *m);
}

int Registrar(PxShape* s, int colisionador, const float* pos, const float* rot, int capa, uint32_t mascara, int trigger, float offset)
{
    if (!s) return -1;
    int id = formas.Alta(s);
    s->userData = (void*)(intptr_t)(id + 1);
    s->setLocalPose(Pose(pos, rot));
    PxFilterData f((PxU32)1u << (capa & 31), mascara, (PxU32)colisionador, 0);
    s->setSimulationFilterData(f);
    s->setQueryFilterData(f);
    if (trigger)
    {
        s->setFlag(PxShapeFlag::eSIMULATION_SHAPE, false);
        s->setFlag(PxShapeFlag::eTRIGGER_SHAPE, true);
    }
    s->setContactOffset(PxMax(offset, 1e-4f));
    s->setRestOffset(0.0f);
    return id;
}

EXPORTAR int fx_caja(int actor, int col, const float* pos, const float* rot, float hx, float hy, float hz, int material, int capa, uint32_t mascara, int trigger, float offset)
{
    return Registrar(Crear(actor, PxBoxGeometry(PxMax(hx, 1e-5f), PxMax(hy, 1e-5f), PxMax(hz, 1e-5f)), material), col, pos, rot, capa, mascara, trigger, offset);
}

EXPORTAR int fx_esfera(int actor, int col, const float* pos, const float* rot, float radio, int material, int capa, uint32_t mascara, int trigger, float offset)
{
    return Registrar(Crear(actor, PxSphereGeometry(PxMax(radio, 1e-5f)), material), col, pos, rot, capa, mascara, trigger, offset);
}

// la cápsula de PhysX va a lo largo de x: la rotación local ya trae el eje de Unity
EXPORTAR int fx_capsula(int actor, int col, const float* pos, const float* rot, float radio, float mediaAltura, int material, int capa, uint32_t mascara, int trigger, float offset)
{
    return Registrar(Crear(actor, PxCapsuleGeometry(PxMax(radio, 1e-5f), PxMax(mediaAltura, 0.0f)), material), col, pos, rot, capa, mascara, trigger, offset);
}

EXPORTAR int fx_forma_malla(int actor, int col, const float* pos, const float* rot, int malla, float sx, float sy, float sz, int material, int capa, uint32_t mascara, int trigger, float offset)
{
    PxTriangleMesh* m = mallas[malla];
    if (!m) return -1;
    PxMeshScale esc(PxVec3(sx, sy, sz), PxQuat(PxIdentity));
    PxTriangleMeshGeometry g(m, esc);
    if (!g.isValid()) return -1;
    return Registrar(Crear(actor, g, material), col, pos, rot, capa, mascara, trigger, offset);
}

EXPORTAR int fx_forma_convexo(int actor, int col, const float* pos, const float* rot, int convexo, float sx, float sy, float sz, int material, int capa, uint32_t mascara, int trigger, float offset)
{
    PxConvexMesh* c = convexos[convexo];
    if (!c) return -1;
    PxMeshScale esc(PxVec3(sx, sy, sz), PxQuat(PxIdentity));
    PxConvexMeshGeometry g(c, esc);
    if (!g.isValid()) return -1;
    return Registrar(Crear(actor, g, material), col, pos, rot, capa, mascara, trigger, offset);
}

EXPORTAR int fx_forma_alturas(int actor, int col, const float* pos, int alturasId, float escAltura, float escFila, float escColumna, int material, int capa, uint32_t mascara, float offset)
{
    PxHeightField* h = alturas[alturasId];
    if (!h) return -1;
    PxHeightFieldGeometry g(h, PxMeshGeometryFlags(), escAltura, escFila, escColumna);
    float q[4] = { 0, 0, 0, 1 };
    return Registrar(Crear(actor, g, material), col, pos, q, capa, mascara, 0, offset);
}

EXPORTAR void fx_forma_borrar(int id)
{
    PxShape* s = formas[id];
    if (!s) return;
    if (PxRigidActor* a = s->getActor()) a->detachShape(*s);
    formas.Baja(id);
}

EXPORTAR void fx_forma_pose(int id, const float* pos, const float* rot)
{
    PxShape* s = formas[id];
    if (s) s->setLocalPose(Pose(pos, rot));
}

// activa (Collider.enabled) y trigger
EXPORTAR void fx_forma_estado(int id, int activa, int trigger)
{
    PxShape* s = formas[id];
    if (!s) return;
    if (!activa)
    {
        s->setFlag(PxShapeFlag::eSIMULATION_SHAPE, false);
        s->setFlag(PxShapeFlag::eTRIGGER_SHAPE, false);
        s->setFlag(PxShapeFlag::eSCENE_QUERY_SHAPE, false);
        return;
    }
    s->setFlag(PxShapeFlag::eSCENE_QUERY_SHAPE, true);
    if (trigger)
    {
        s->setFlag(PxShapeFlag::eSIMULATION_SHAPE, false);
        s->setFlag(PxShapeFlag::eTRIGGER_SHAPE, true);
    }
    else
    {
        s->setFlag(PxShapeFlag::eTRIGGER_SHAPE, false);
        s->setFlag(PxShapeFlag::eSIMULATION_SHAPE, true);
    }
}

EXPORTAR void fx_forma_capa(int id, int capa, uint32_t mascara, int ccd)
{
    PxShape* s = formas[id];
    if (!s) return;
    PxFilterData f = s->getSimulationFilterData();
    f.word0 = (PxU32)1u << (capa & 31);
    f.word1 = mascara;
    f.word3 = ccd ? 1 : 0;
    s->setSimulationFilterData(f);
    s->setQueryFilterData(f);
}

EXPORTAR void fx_forma_material(int id, int material)
{
    PxShape* s = formas[id];
    PxMaterial* m = materiales[material];
    if (!s) return;
    if (!m) m = materialDefecto;
    s->setMaterials(&m, 1);
}

// la caja que ocupa en el mundo (6 floats: mínimo y máximo)
EXPORTAR void fx_forma_limites(int id, float* b)
{
    PxShape* s = formas[id];
    if (!s || !s->getActor()) { for (int i = 0; i < 6; i++) b[i] = 0; return; }
    PxBounds3 x = PxShapeExt::getWorldBounds(*s, *s->getActor());
    b[0] = x.minimum.x; b[1] = x.minimum.y; b[2] = x.minimum.z;
    b[3] = x.maximum.x; b[4] = x.maximum.y; b[5] = x.maximum.z;
}

// el punto de la forma más cercano a p (Collider.ClosestPoint); devuelve la distancia
EXPORTAR float fx_forma_cercano(int id, float x, float y, float z, float* sal)
{
    PxShape* s = formas[id];
    if (!s || !s->getActor()) return -1;
    PxVec3 c;
    PxReal d = PxGeometryQuery::pointDistance(PxVec3(x, y, z), s->getGeometry().any(), PxShapeExt::getGlobalPose(*s, *s->getActor()), &c);
    if (d <= 0) c = PxVec3(x, y, z);
    sal[0] = c.x; sal[1] = c.y; sal[2] = c.z;
    return d;
}

// Collider.Raycast: sólo contra esa forma
EXPORTAR int fx_forma_rayo(int id, const float* o, const float* d, float max, Golpe** sal)
{
    golpes.clear();
    *sal = golpes.data();
    PxShape* s = formas[id];
    if (!s || !s->getActor()) return 0;
    PxRaycastHit h;
    PxHitFlags f = PxHitFlag::eDEFAULT;
    if (caraTrasera) f |= PxHitFlag::eMESH_BOTH_SIDES;
    PxU32 n = PxGeometryQuery::raycast(V(o), V(d).getNormalized(), s->getGeometry().any(), PxShapeExt::getGlobalPose(*s, *s->getActor()), max, f, 1, &h);
    if (!n) return 0;
    h.shape = s;
    h.actor = s->getActor();
    Anotar(h, false);
    *sal = golpes.data();
    return 1;
}

// ───────────────────────────── consultas a la escena ─────────────────────────────
EXPORTAR void fx_caras_traseras(int si) { caraTrasera = si != 0; }

// triggers: 0 los ignora, 1 los ve; todos: 1 = todos los golpes (RaycastAll), 0 = el más cercano
EXPORTAR int fx_rayo(const float* o, const float* d, float max, uint32_t mascara, int triggers, int todos, Golpe** sal)
{
    golpes.clear();
    *sal = golpes.data();
    if (!escena) return 0;
    PxVec3 dir = V(d);
    if (dir.normalize() <= 0) return 0;
    PrepararFiltro(mascara, triggers, todos);
    filtroConsulta.sinInicial = true;
    PxHitFlags f = PxHitFlag::eDEFAULT;
    if (caraTrasera) f |= PxHitFlag::eMESH_BOTH_SIDES;
    if (todos)
    {
        PxRaycastBuffer b(toquesRayo, MAX_GOLPES);
        escena->raycast(V(o), dir, max, b, f, DatosFiltro(true, true, true, true), &filtroConsulta);
        for (PxU32 i = 0; i < b.getNbTouches(); i++) Anotar(b.getTouch(i), false);
        if (b.hasBlock) Anotar(b.block, false);
    }
    else
    {
        PxRaycastBuffer b;
        if (escena->raycast(V(o), dir, max, b, f, DatosFiltro(false, true, true, true), &filtroConsulta) && b.hasBlock) Anotar(b.block, false);
    }
    *sal = golpes.data();
    return (int)golpes.size();
}

// barridos: tipo 0 esfera (a = radio), 1 cápsula (a = radio, entre los puntos p0 y p1), 2 caja (medias medidas a, b, c y rotación q)
int Barrido(const PxGeometry& g, const PxTransform& t, const float* d, float max, uint32_t mascara, int triggers, int todos)
{
    golpes.clear();
    if (!escena) return 0;
    PxVec3 dir = V(d);
    if (dir.normalize() <= 0) return 0;
    PrepararFiltro(mascara, triggers, todos);
    PxHitFlags f = PxHitFlag::eDEFAULT | PxHitFlag::eMTD;
    if (caraTrasera) f |= PxHitFlag::eMESH_BOTH_SIDES;
    if (todos)
    {
        PxSweepBuffer b(toquesBarrido, MAX_GOLPES);
        escena->sweep(g, t, dir, max, b, f, DatosFiltro(true), &filtroConsulta);
        for (PxU32 i = 0; i < b.getNbTouches(); i++) Anotar(b.getTouch(i), true);
        if (b.hasBlock) Anotar(b.block, true);
    }
    else
    {
        // el más cercano que no empiece solapado (Unity no informa los solapados al empezar)
        filtroConsulta.todos = true;
        PxSweepBuffer b(toquesBarrido, MAX_GOLPES);
        escena->sweep(g, t, dir, max, b, f, DatosFiltro(true), &filtroConsulta);
        const PxSweepHit* mejor = nullptr;
        for (PxU32 i = 0; i < b.getNbTouches(); i++)
        {
            const PxSweepHit& h = b.getTouch(i);
            if (h.hadInitialOverlap()) continue;
            if (!mejor || h.distance < mejor->distance) mejor = &h;
        }
        if (mejor) Anotar(*mejor, true);
    }
    return (int)golpes.size();
}

EXPORTAR int fx_barrido_esfera(const float* o, float radio, const float* d, float max, uint32_t mascara, int triggers, int todos, Golpe** sal)
{
    int n = Barrido(PxSphereGeometry(PxMax(radio, 1e-5f)), PxTransform(V(o)), d, max, mascara, triggers, todos);
    *sal = golpes.data();
    return n;
}

EXPORTAR int fx_barrido_capsula(const float* p0, const float* p1, float radio, const float* d, float max, uint32_t mascara, int triggers, int todos, Golpe** sal)
{
    PxVec3 a = V(p0), b = V(p1);
    PxVec3 eje = b - a;
    float largo = eje.normalize();
    PxQuat q = largo > 1e-6f ? PxShortestRotation(PxVec3(1, 0, 0), eje) : PxQuat(PxIdentity);
    int n = Barrido(PxCapsuleGeometry(PxMax(radio, 1e-5f), largo * 0.5f), PxTransform((a + b) * 0.5f, q), d, max, mascara, triggers, todos);
    *sal = golpes.data();
    return n;
}

EXPORTAR int fx_barrido_caja(const float* c, const float* medias, const float* rot, const float* d, float max, uint32_t mascara, int triggers, int todos, Golpe** sal)
{
    int n = Barrido(PxBoxGeometry(PxMax(medias[0], 1e-5f), PxMax(medias[1], 1e-5f), PxMax(medias[2], 1e-5f)), Pose(c, rot), d, max, mascara, triggers, todos);
    *sal = golpes.data();
    return n;
}

int Solape(const PxGeometry& g, const PxTransform& t, uint32_t mascara, int triggers, int cualquiera)
{
    golpes.clear();
    if (!escena) return 0;
    PrepararFiltro(mascara, triggers, 1);
    PxOverlapBuffer b(toquesSolape, MAX_GOLPES);
    PxQueryFilterData fd = DatosFiltro(true);
    if (cualquiera) fd.flags |= PxQueryFlag::eANY_HIT;
    escena->overlap(g, t, b, fd, &filtroConsulta);
    for (PxU32 i = 0; i < b.getNbTouches(); i++)
    {
        Golpe x = {};
        x.colisionador = IdForma(b.getTouch(i).shape);
        golpes.push_back(x);
        if (cualquiera) break;
    }
    if (b.hasBlock && (!cualquiera || golpes.empty()))
    {
        Golpe x = {};
        x.colisionador = IdForma(b.block.shape);
        golpes.push_back(x);
    }
    return (int)golpes.size();
}

EXPORTAR int fx_solape_esfera(const float* c, float radio, uint32_t mascara, int triggers, int cualquiera, Golpe** sal)
{
    int n = Solape(PxSphereGeometry(PxMax(radio, 1e-5f)), PxTransform(V(c)), mascara, triggers, cualquiera);
    *sal = golpes.data();
    return n;
}

EXPORTAR int fx_solape_caja(const float* c, const float* medias, const float* rot, uint32_t mascara, int triggers, int cualquiera, Golpe** sal)
{
    int n = Solape(PxBoxGeometry(PxMax(medias[0], 1e-5f), PxMax(medias[1], 1e-5f), PxMax(medias[2], 1e-5f)), Pose(c, rot), mascara, triggers, cualquiera);
    *sal = golpes.data();
    return n;
}

EXPORTAR int fx_solape_capsula(const float* p0, const float* p1, float radio, uint32_t mascara, int triggers, int cualquiera, Golpe** sal)
{
    PxVec3 a = V(p0), b = V(p1);
    PxVec3 eje = b - a;
    float largo = eje.normalize();
    PxQuat q = largo > 1e-6f ? PxShortestRotation(PxVec3(1, 0, 0), eje) : PxQuat(PxIdentity);
    int n = Solape(PxCapsuleGeometry(PxMax(radio, 1e-5f), largo * 0.5f), PxTransform((a + b) * 0.5f, q), mascara, triggers, cualquiera);
    *sal = golpes.data();
    return n;
}

// ───────────────────────────── CharacterController ─────────────────────────────
// la posición es la del centro de la cápsula; alto = altura total de Unity (con las semiesferas)
EXPORTAR int fx_cc(int col, const float* pos, float radio, float alto, float pendienteGrados, float escalon, float piel, int capa, uint32_t mascara)
{
    if (!controladores) return -1;
    PxCapsuleControllerDesc d;
    d.radius = PxMax(radio, 1e-4f);
    d.height = PxMax(alto - 2 * d.radius, 1e-4f);
    d.slopeLimit = PxCos(pendienteGrados * PxPi / 180.0f);
    d.stepOffset = PxMin(escalon, d.height + 2 * d.radius);
    d.contactOffset = PxMax(piel, 1e-4f);
    d.material = materialDefecto;
    d.position = PxExtendedVec3(pos[0], pos[1], pos[2]);
    d.upDirection = PxVec3(0, 1, 0);
    d.climbingMode = PxCapsuleClimbingMode::eCONSTRAINED;
    d.nonWalkableMode = PxControllerNonWalkableMode::ePREVENT_CLIMBING;
    d.reportCallback = &reporteCc;
    if (!d.isValid()) return -1;
    PxController* c = controladores->createController(d);
    if (!c) return -1;
    int id = ccs.Alta(c);
    c->setUserData((void*)(intptr_t)(id + 1));
    // su actor cinemático y su forma: como un colisionador más (los triggers y consultas lo ven)
    PxRigidDynamic* a = c->getActor();
    int idActor = actores.Alta(a);
    a->userData = (void*)(intptr_t)(idActor + 1);
    PxShape* s;
    a->getShapes(&s, 1);
    int idForma = formas.Alta(s);
    s->userData = (void*)(intptr_t)(idForma + 1);
    PxFilterData f((PxU32)1u << (capa & 31), mascara, (PxU32)col, 0);
    s->setSimulationFilterData(f);
    s->setQueryFilterData(f);
    return id;
}

// ids del actor y de la forma del controlador (2 enteros)
EXPORTAR void fx_cc_ids(int id, int* sal)
{
    PxController* c = ccs[id];
    if (!c) { sal[0] = sal[1] = -1; return; }
    PxRigidDynamic* a = c->getActor();
    PxShape* s;
    a->getShapes(&s, 1);
    sal[0] = (int)(intptr_t)a->userData - 1;
    sal[1] = IdForma(s);
}

EXPORTAR void fx_cc_borrar(int id)
{
    PxController* c = ccs[id];
    if (!c) return;
    int ids[2];
    fx_cc_ids(id, ids);
    actores.Baja(ids[0]);
    formas.Baja(ids[1]);
    c->release();
    ccs.Baja(id);
}

// mueve; devuelve las CollisionFlags de Unity (lados 1, arriba 2, abajo 4) y deja los golpes
EXPORTAR int fx_cc_mover(int id, float dx, float dy, float dz, float distMin, float dt, uint32_t mascara, GolpeCc** golpesSal, int* nGolpes)
{
    golpesCc.clear();
    *golpesSal = golpesCc.data();
    *nGolpes = 0;
    PxController* c = ccs[id];
    if (!c) return 0;
    PrepararFiltro(mascara, 0, 0);
    int ids[2];
    fx_cc_ids(id, ids);
    filtroConsulta.excluirCc = ids[0];
    PxFilterData fd(0, 0, 0, 0);
    PxControllerFilters filtros(&fd, &filtroConsulta, nullptr);
    filtros.mFilterFlags = PxQueryFlag::eSTATIC | PxQueryFlag::eDYNAMIC | PxQueryFlag::ePREFILTER;
    PxControllerCollisionFlags f = c->move(PxVec3(dx, dy, dz), distMin, dt, filtros);
    *golpesSal = golpesCc.data();
    *nGolpes = (int)golpesCc.size();
    int r = 0;
    if (f & PxControllerCollisionFlag::eCOLLISION_SIDES) r |= 1;
    if (f & PxControllerCollisionFlag::eCOLLISION_UP) r |= 2;
    if (f & PxControllerCollisionFlag::eCOLLISION_DOWN) r |= 4;
    return r;
}

EXPORTAR void fx_cc_posicion(int id, float x, float y, float z)
{
    PxController* c = ccs[id];
    if (c) c->setPosition(PxExtendedVec3(x, y, z));
}

EXPORTAR void fx_cc_posicion_leer(int id, float* p)
{
    PxController* c = ccs[id];
    if (!c) return;
    PxExtendedVec3 x = c->getPosition();
    p[0] = (float)x.x; p[1] = (float)x.y; p[2] = (float)x.z;
}

EXPORTAR void fx_cc_forma(int id, float radio, float alto, float pendienteGrados, float escalon, float piel)
{
    auto* c = static_cast<PxCapsuleController*>(ccs[id]);
    if (!c) return;
    c->setRadius(PxMax(radio, 1e-4f));
    c->setHeight(PxMax(alto - 2 * PxMax(radio, 1e-4f), 1e-4f));
    c->setSlopeLimit(PxCos(pendienteGrados * PxPi / 180.0f));
    c->setStepOffset(escalon);
    c->setContactOffset(PxMax(piel, 1e-4f));
}

// ───────────────────────────── juntas ─────────────────────────────
// marcos locales de cada actor: posición (3) y rotación (4); b = -1 es el mundo
PxJoint* Registrar(PxJoint* j)
{
    if (!j) return nullptr;
    int id = juntas.Alta(j);
    j->userData = (void*)(intptr_t)(id + 1);
    return j;
}

int IdJunta(PxJoint* j) { return j ? (int)(intptr_t)j->userData - 1 : -1; }

EXPORTAR int fx_junta_fija(int a, const float* pa, const float* qa, int b, const float* pb, const float* qb)
{
    return IdJunta(Registrar(PxFixedJointCreate(*fisica, actores[a], Pose(pa, qa), actores[b], Pose(pb, qb))));
}

EXPORTAR int fx_junta_resorte(int a, const float* pa, int b, const float* pb, float resorte, float amortiguacion, float min, float max, float tolerancia)
{
    float q[4] = { 0, 0, 0, 1 };
    PxDistanceJoint* j = PxDistanceJointCreate(*fisica, actores[a], Pose(pa, q), actores[b], Pose(pb, q));
    if (!j) return -1;
    j->setMinDistance(PxMax(min, 0.0f));
    j->setMaxDistance(PxMax(max, min));
    j->setTolerance(tolerancia);
    j->setStiffness(resorte);
    j->setDamping(amortiguacion);
    j->setDistanceJointFlags(PxDistanceJointFlag::eMIN_DISTANCE_ENABLED | PxDistanceJointFlag::eMAX_DISTANCE_ENABLED | PxDistanceJointFlag::eSPRING_ENABLED);
    return IdJunta(Registrar(j));
}

EXPORTAR int fx_junta_bisagra(int a, const float* pa, const float* qa, int b, const float* pb, const float* qb)
{
    return IdJunta(Registrar(PxRevoluteJointCreate(*fisica, actores[a], Pose(pa, qa), actores[b], Pose(pb, qb))));
}

// D6 (ConfigurableJoint y CharacterJoint): movimientos 0 bloqueado, 1 limitado, 2 libre (como Unity), en el
// orden x, y, z, giro x, giro y, giro z
EXPORTAR int fx_junta_d6(int a, const float* pa, const float* qa, int b, const float* pb, const float* qb, const int* movs)
{
    PxD6Joint* j = PxD6JointCreate(*fisica, actores[a], Pose(pa, qa), actores[b], Pose(pb, qb));
    if (!j) return -1;
    const PxD6Axis::Enum ejes[6] = { PxD6Axis::eX, PxD6Axis::eY, PxD6Axis::eZ, PxD6Axis::eTWIST, PxD6Axis::eSWING1, PxD6Axis::eSWING2 };
    for (int i = 0; i < 6; i++)
        j->setMotion(ejes[i], movs[i] == 0 ? PxD6Motion::eLOCKED : movs[i] == 1 ? PxD6Motion::eLIMITED : PxD6Motion::eFREE);
    return IdJunta(Registrar(j));
}

// límites blandos de una D6: lineal (extensión, resorte, amortiguación), giro x (bajo, alto), giros y-z (y, z), con sus resortes
EXPORTAR void fx_junta_d6_limites(int id, float lineal, float resLin, float amLin, float giroBajo, float giroAlto, float resGiro, float amGiro, float limY, float limZ, float resYZ, float amYZ)
{
    auto* j = static_cast<PxD6Joint*>(juntas[id]);
    if (!j) return;
    if (resLin > 0) j->setLinearLimit(PxJointLinearLimit(PxMax(lineal, 1e-4f), PxSpring(resLin, amLin)));
    else j->setLinearLimit(PxJointLinearLimit(fisica->getTolerancesScale(), PxMax(lineal, 1e-4f)));
    float bajo = PxMin(giroBajo, giroAlto), alto = PxMax(giroBajo, giroAlto);
    if (alto - bajo < 1e-3f) alto = bajo + 1e-3f;
    if (resGiro > 0) j->setTwistLimit(PxJointAngularLimitPair(bajo, alto, PxSpring(resGiro, amGiro)));
    else j->setTwistLimit(PxJointAngularLimitPair(bajo, alto));
    float y = PxClamp(limY, 1e-3f, PxPi - 1e-3f), z = PxClamp(limZ, 1e-3f, PxPi - 1e-3f);
    if (resYZ > 0) j->setSwingLimit(PxJointLimitCone(y, z, PxSpring(resYZ, amYZ)));
    else j->setSwingLimit(PxJointLimitCone(y, z));
}

EXPORTAR void fx_junta_ruptura(int id, float fuerza, float torque)
{
    PxJoint* j = juntas[id];
    if (j) j->setBreakForce(fuerza, torque);
}

EXPORTAR void fx_junta_marcos(int id, const float* pa, const float* qa, const float* pb, const float* qb)
{
    PxJoint* j = juntas[id];
    if (!j) return;
    j->setLocalPose(PxJointActorIndex::eACTOR0, Pose(pa, qa));
    j->setLocalPose(PxJointActorIndex::eACTOR1, Pose(pb, qb));
}

EXPORTAR void fx_junta_borrar(int id)
{
    PxJoint* j = juntas[id];
    if (!j) return;
    j->release();
    juntas.Baja(id);
}
