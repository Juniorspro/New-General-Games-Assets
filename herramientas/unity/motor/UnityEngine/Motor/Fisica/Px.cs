using System;
using System.Runtime.InteropServices;

namespace Porteo.Fisica
{
    // Lo que deja fisica.cpp en sus búferes (mismo orden y tamaño de campos que en C).
    [StructLayout(LayoutKind.Sequential)]
    public struct EventoPx
    {
        public int Tipo, A, B, PrimerPunto, NPuntos;
        public float VX, VY, VZ, IX, IY, IZ;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PuntoPx
    {
        public float PX, PY, PZ, NX, NY, NZ, Separacion, Impulso;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct GolpePx
    {
        public float PX, PY, PZ, NX, NY, NZ, Distancia;
        public int Colisionador, Cara, Inicial;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct GolpeCcPx
    {
        public float PX, PY, PZ, NX, NY, NZ, DX, DY, DZ, Largo;
        public int Colisionador;
    }

    // PhysX 4.1 (fisica.cpp): en el navegador está enlazado en el mismo .wasm; en la prueba de
    // consola, en libporteo.so. Posiciones como float[3] y rotaciones como float[4] (x, y, z, w).
    public static unsafe class Px
    {
        const string L = "porteo";

        [DllImport(L)] public static extern int fx_avisos_leer(byte* sal, int max);
        [DllImport(L)] public static extern int fx_iniciar(float gx, float gy, float gz, float rebote, int pcm, int friccionPorParche);
        [DllImport(L)] public static extern void fx_gravedad(float x, float y, float z);
        [DllImport(L)] public static extern void fx_ignorar(int a, int b, int si);
        [DllImport(L)] public static extern void fx_refiltrar(int forma);
        [DllImport(L)] public static extern void fx_simular(float dt);
        [DllImport(L)] public static extern int fx_eventos(EventoPx** ev, PuntoPx** pts);
        [DllImport(L)] public static extern int fx_activos(int* ids, float* poses, int max);

        [DllImport(L)] public static extern int fx_actor(int dinamico, float* pos, float* rot);
        [DllImport(L)] public static extern void fx_actor_borrar(int id);
        [DllImport(L)] public static extern void fx_actor_en_escena(int id, int si);
        [DllImport(L)] public static extern void fx_actor_pose(int id, float* pos, float* rot);
        [DllImport(L)] public static extern void fx_actor_pose_leer(int id, float* p);
        [DllImport(L)] public static extern void fx_actor_objetivo(int id, float* pos, float* rot);

        [DllImport(L)] public static extern void fx_cuerpo_masa(int id, float masa);
        [DllImport(L)] public static extern void fx_cuerpo_amortiguacion(int id, float lineal, float angular);
        [DllImport(L)] public static extern void fx_cuerpo_gravedad(int id, int usa);
        [DllImport(L)] public static extern void fx_cuerpo_cinematico(int id, int si);
        [DllImport(L)] public static extern void fx_cuerpo_ccd(int id, int modo);
        [DllImport(L)] public static extern void fx_cuerpo_bloqueos(int id, int c);
        [DllImport(L)] public static extern void fx_cuerpo_ajustes(int id, float maxVelAngular, float umbralDormir, int iteraciones, int iteracionesVel);
        [DllImport(L)] public static extern void fx_cuerpo_velocidad(int id, float x, float y, float z);
        [DllImport(L)] public static extern void fx_cuerpo_velocidad_angular(int id, float x, float y, float z);
        [DllImport(L)] public static extern void fx_cuerpo_velocidades(int id, float* v);
        [DllImport(L)] public static extern void fx_cuerpo_fuerza(int id, float x, float y, float z, int modo);
        [DllImport(L)] public static extern void fx_cuerpo_torque(int id, float x, float y, float z, int modo);
        [DllImport(L)] public static extern void fx_cuerpo_fuerza_en(int id, float x, float y, float z, float px, float py, float pz, int modo);
        [DllImport(L)] public static extern void fx_cuerpo_dormir(int id, int dormir);
        [DllImport(L)] public static extern int fx_cuerpo_dormido(int id);
        [DllImport(L)] public static extern void fx_cuerpo_centro(int id, float* c);

        [DllImport(L)] public static extern int fx_malla(float* v, int nv, uint* tris, int ntris, int opciones);
        [DllImport(L)] public static extern int fx_convexo(float* v, int nv);
        [DllImport(L)] public static extern int fx_alturas(short* muestras, int filas, int columnas);
        [DllImport(L)] public static extern void fx_malla_borrar(int id);
        [DllImport(L)] public static extern void fx_convexo_borrar(int id);

        [DllImport(L)] public static extern int fx_material(float dinamica, float estatica, float rebote, int combFriccion, int combRebote);
        [DllImport(L)] public static extern void fx_material_cambiar(int id, float dinamica, float estatica, float rebote, int combFriccion, int combRebote);

        [DllImport(L)] public static extern int fx_caja(int actor, int col, float* pos, float* rot, float hx, float hy, float hz, int material, int capa, uint mascara, int trigger, float offset);
        [DllImport(L)] public static extern int fx_esfera(int actor, int col, float* pos, float* rot, float radio, int material, int capa, uint mascara, int trigger, float offset);
        [DllImport(L)] public static extern int fx_capsula(int actor, int col, float* pos, float* rot, float radio, float mediaAltura, int material, int capa, uint mascara, int trigger, float offset);
        [DllImport(L)] public static extern int fx_forma_malla(int actor, int col, float* pos, float* rot, int malla, float sx, float sy, float sz, int material, int capa, uint mascara, int trigger, float offset);
        [DllImport(L)] public static extern int fx_forma_convexo(int actor, int col, float* pos, float* rot, int convexo, float sx, float sy, float sz, int material, int capa, uint mascara, int trigger, float offset);
        [DllImport(L)] public static extern int fx_forma_alturas(int actor, int col, float* pos, int alturas, float escAltura, float escFila, float escColumna, int material, int capa, uint mascara, float offset);
        [DllImport(L)] public static extern void fx_forma_borrar(int id);
        [DllImport(L)] public static extern void fx_forma_pose(int id, float* pos, float* rot);
        [DllImport(L)] public static extern void fx_forma_estado(int id, int activa, int trigger);
        [DllImport(L)] public static extern void fx_forma_capa(int id, int capa, uint mascara, int ccd);
        [DllImport(L)] public static extern void fx_forma_material(int id, int material);
        [DllImport(L)] public static extern void fx_forma_limites(int id, float* b);
        [DllImport(L)] public static extern float fx_forma_cercano(int id, float x, float y, float z, float* sal);
        [DllImport(L)] public static extern int fx_forma_rayo(int id, float* o, float* d, float max, GolpePx** sal);

        [DllImport(L)] public static extern void fx_caras_traseras(int si);
        [DllImport(L)] public static extern int fx_rayo(float* o, float* d, float max, uint mascara, int triggers, int todos, GolpePx** sal);
        [DllImport(L)] public static extern int fx_barrido_esfera(float* o, float radio, float* d, float max, uint mascara, int triggers, int todos, GolpePx** sal);
        [DllImport(L)] public static extern int fx_barrido_capsula(float* p0, float* p1, float radio, float* d, float max, uint mascara, int triggers, int todos, GolpePx** sal);
        [DllImport(L)] public static extern int fx_barrido_caja(float* c, float* medias, float* rot, float* d, float max, uint mascara, int triggers, int todos, GolpePx** sal);
        [DllImport(L)] public static extern int fx_solape_esfera(float* c, float radio, uint mascara, int triggers, int cualquiera, GolpePx** sal);
        [DllImport(L)] public static extern int fx_solape_caja(float* c, float* medias, float* rot, uint mascara, int triggers, int cualquiera, GolpePx** sal);
        [DllImport(L)] public static extern int fx_solape_capsula(float* p0, float* p1, float radio, uint mascara, int triggers, int cualquiera, GolpePx** sal);

        [DllImport(L)] public static extern int fx_cc(int col, float* pos, float radio, float alto, float pendienteGrados, float escalon, float piel, int capa, uint mascara);
        [DllImport(L)] public static extern void fx_cc_ids(int id, int* sal);
        [DllImport(L)] public static extern void fx_cc_borrar(int id);
        [DllImport(L)] public static extern int fx_cc_mover(int id, float dx, float dy, float dz, float distMin, float dt, uint mascara, GolpeCcPx** golpes, int* nGolpes);
        [DllImport(L)] public static extern void fx_cc_posicion(int id, float x, float y, float z);
        [DllImport(L)] public static extern void fx_cc_posicion_leer(int id, float* p);
        [DllImport(L)] public static extern void fx_cc_forma(int id, float radio, float alto, float pendienteGrados, float escalon, float piel);

        [DllImport(L)] public static extern int fx_junta_fija(int a, float* pa, float* qa, int b, float* pb, float* qb);
        [DllImport(L)] public static extern int fx_junta_resorte(int a, float* pa, int b, float* pb, float resorte, float amortiguacion, float min, float max, float tolerancia);
        [DllImport(L)] public static extern int fx_junta_bisagra(int a, float* pa, float* qa, int b, float* pb, float* qb);
        [DllImport(L)] public static extern int fx_junta_d6(int a, float* pa, float* qa, int b, float* pb, float* qb, int* movs);
        [DllImport(L)] public static extern void fx_junta_d6_limites(int id, float lineal, float resLin, float amLin, float giroBajo, float giroAlto, float resGiro, float amGiro, float limY, float limZ, float resYZ, float amYZ);
        [DllImport(L)] public static extern void fx_junta_ruptura(int id, float fuerza, float torque);
        [DllImport(L)] public static extern void fx_junta_marcos(int id, float* pa, float* qa, float* pb, float* qb);
        [DllImport(L)] public static extern void fx_junta_borrar(int id);
    }
}
