"""Lectura de los JSON de CUE4Parse (TJOC:SM, UE 4.16): paquetes, referencias, plantillas y valores por defecto.
Convención de salida: espacio three.js (x=X, y=Z, z=Y, en metros)."""
import json, math, os, re

CRUDO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'crudo', 'todo')

# Valores por defecto nativos de Unreal 4.16 (lo que no se serializa)
NATIVOS = {
    'SceneComponent': dict(RelativeLocation={'X': 0, 'Y': 0, 'Z': 0}, RelativeRotation={'Pitch': 0, 'Yaw': 0, 'Roll': 0},
                           RelativeScale3D={'X': 1, 'Y': 1, 'Z': 1}, bVisible=True, bHiddenInGame=False, Mobility='EComponentMobility::Movable',
                           bAbsoluteLocation=False, bAbsoluteRotation=False, bAbsoluteScale=False, bAutoActivate=True),
    'LightComponent': dict(Intensity=5000.0, LightColor={'R': 255, 'G': 255, 'B': 255, 'A': 255}, AttenuationRadius=1000.0, SourceRadius=0.0,
                           bUseInverseSquaredFalloff=True, LightFalloffExponent=8.0, CastShadows=True, InnerConeAngle=0.0, OuterConeAngle=44.0,
                           IndirectLightingIntensity=1.0, bAffectsWorld=True),
    'DirectionalLightComponent': dict(Intensity=10.0),
    'SkyLightComponent': dict(Intensity=1.0),
    'AudioComponent': dict(VolumeMultiplier=1.0, PitchMultiplier=1.0, bAutoActivate=True, bOverrideAttenuation=False, bIsUISound=False),
    'CameraComponent': dict(FieldOfView=90.0, AspectRatio=1.777778, bConstrainAspectRatio=False),
    'BoxComponent': dict(BoxExtent={'X': 32, 'Y': 32, 'Z': 32}),
    'SphereComponent': dict(SphereRadius=32.0),
    'CapsuleComponent': dict(CapsuleHalfHeight=44.0, CapsuleRadius=22.0),
    'StaticMeshComponent': dict(CastShadow=True),
    'SkeletalMeshComponent': dict(AnimationMode='EAnimationMode::AnimationBlueprint'),
    'DecalComponent': dict(DecalSize={'X': 128, 'Y': 256, 'Z': 256}),
    'TextRenderComponent': dict(WorldSize=26.0, TextRenderColor={'R': 255, 'G': 255, 'B': 255, 'A': 255}, HorizontalAlignment='EHTA_Left'),
}
HERENCIA = {  # clase nativa → padre
    'PrimitiveComponent': 'SceneComponent', 'MeshComponent': 'PrimitiveComponent', 'StaticMeshComponent': 'MeshComponent',
    'InstancedStaticMeshComponent': 'StaticMeshComponent', 'HierarchicalInstancedStaticMeshComponent': 'InstancedStaticMeshComponent',
    'FoliageInstancedStaticMeshComponent': 'HierarchicalInstancedStaticMeshComponent',
    'SkinnedMeshComponent': 'MeshComponent', 'SkeletalMeshComponent': 'SkinnedMeshComponent', 'PoseableMeshComponent': 'SkinnedMeshComponent',
    'LightComponentBase': 'SceneComponent', 'LightComponent': 'LightComponentBase', 'LocalLightComponent': 'LightComponent',
    'PointLightComponent': 'LocalLightComponent', 'SpotLightComponent': 'PointLightComponent', 'DirectionalLightComponent': 'LightComponent',
    'SkyLightComponent': 'LightComponentBase', 'RectLightComponent': 'LocalLightComponent',
    'AudioComponent': 'SceneComponent', 'CameraComponent': 'SceneComponent', 'CineCameraComponent': 'CameraComponent',
    'ShapeComponent': 'PrimitiveComponent', 'BoxComponent': 'ShapeComponent', 'SphereComponent': 'ShapeComponent', 'CapsuleComponent': 'ShapeComponent',
    'BrushComponent': 'PrimitiveComponent', 'DecalComponent': 'SceneComponent', 'TextRenderComponent': 'PrimitiveComponent',
    'ParticleSystemComponent': 'PrimitiveComponent', 'BillboardComponent': 'PrimitiveComponent', 'MaterialBillboardComponent': 'PrimitiveComponent',
    'ArrowComponent': 'PrimitiveComponent', 'SpringArmComponent': 'SceneComponent', 'WidgetComponent': 'MeshComponent',
    'ChildActorComponent': 'SceneComponent', 'SceneCaptureComponent2D': 'SceneComponent', 'PostProcessComponent': 'SceneComponent',
    'ExponentialHeightFogComponent': 'SceneComponent', 'ReflectionCaptureComponent': 'SceneComponent',
    'BoxReflectionCaptureComponent': 'ReflectionCaptureComponent', 'SphereReflectionCaptureComponent': 'ReflectionCaptureComponent',
    'ModelComponent': 'PrimitiveComponent', 'PhysicsConstraintComponent': 'SceneComponent', 'PhysicsThrusterComponent': 'SceneComponent',
    'RotatingMovementComponent': None, 'TimelineComponent': None,
}

def clases(c):
    while c:
        yield c
        c = HERENCIA.get(c)

class Paquetes:
    def __init__(self, crudo=CRUDO):
        self.crudo = crudo; self.cache = {}
    def archivo(self, pkg):
        base = os.path.join(self.crudo, pkg.replace('/', '~'))
        for ext in ('.umap.json', '.uasset.json'):
            if os.path.exists(base + ext): return base + ext
        return None
    def paquete(self, pkg):
        if pkg not in self.cache:
            f = self.archivo(pkg)
            self.cache[pkg] = json.load(open(f)) if f else None
        return self.cache[pkg]
    def obj(self, ref):
        """ref {ObjectName, ObjectPath:'Pkg.N'} → export dict (o None si es nativo/no está)"""
        if not ref or not isinstance(ref, dict): return None
        p = ref.get('ObjectPath', '')
        m = re.match(r'(.*)\.(\d+)$', p)
        if not m: return None
        d = self.paquete(m.group(1))
        if not d: return None
        i = int(m.group(2))
        return d[i] if i < len(d) else None
    @staticmethod
    def nombre(ref):
        """'StaticMesh'ashtray'' → ('StaticMesh', 'ashtray')"""
        if not ref: return (None, None)
        m = re.match(r"(\w+)'(.*)'", ref.get('ObjectName', ''))
        return (m.group(1), m.group(2)) if m else (None, ref.get('ObjectName'))
    @staticmethod
    def ruta(ref):
        """ruta de asset 'Pkg/Path.Nombre' para los comandos de ue.sh"""
        if not ref: return None
        pkg = re.sub(r'\.\d+$', '', ref.get('ObjectPath', ''))
        _, n = Paquetes.nombre(ref)
        return pkg + '.' + n.split(':')[-1].split('.')[-1] if n else pkg
    def plantilla(self, o):
        return self.obj(o.get('Template')) if o else None
    def prop(self, o, nombre, defecto=None, clase=None):
        x = o; n = 0
        while x is not None and n < 12:
            pr = x.get('Properties') or {}
            if nombre in pr: return pr[nombre]
            x = self.plantilla(x); n += 1
        for c in clases(clase or (o or {}).get('Type')):
            if c in NATIVOS and nombre in NATIVOS[c]: return NATIVOS[c][nombre]
        return defecto
    def clase_nativa(self, o):
        """Primera clase nativa (sin _C) en la cadena de herencia."""
        t = o.get('Type', '')
        if not t.endswith('_C'): return t
        c = o.get('Class', '')
        m = re.match(r"\w+'(.*)\.(\w+)'", c)
        if m:
            bp = self.paquete(m.group(1))
            if bp:
                for e in bp:
                    if e['Type'] in ('BlueprintGeneratedClass', 'WidgetBlueprintGeneratedClass', 'AnimBlueprintGeneratedClass') and e['Name'] == m.group(2):
                        s = e.get('SuperStruct')
                        while s:
                            tn, nn = self.nombre(s)
                            if tn == 'Class': return nn
                            se = self.obj(s)
                            if not se: return nn
                            s = se.get('SuperStruct')
        return t

def vec(v, esc=0.01):
    v = v or {}
    return [v.get('X', 0) * esc, v.get('Z', 0) * esc, v.get('Y', 0) * esc]

def quat_rot(r):
    r = r or {}
    p, y, ro = (math.radians(r.get(k, 0)) / 2 for k in ('Pitch', 'Yaw', 'Roll'))
    SP, CP, SY, CY, SR, CR = math.sin(p), math.cos(p), math.sin(y), math.cos(y), math.sin(ro), math.cos(ro)
    X = CR * SP * SY - SR * CP * CY; Y = -CR * SP * CY - SR * CP * SY; Z = CR * CP * SY - SR * SP * CY; W = CR * CP * CY + SR * SP * SY
    return [-X, -Z, -Y, W]

def quat(q):
    return [-q['X'], -q['Z'], -q['Y'], q['W']]

def escala(s):
    s = s or {'X': 1, 'Y': 1, 'Z': 1}
    return [s.get('X', 1), s.get('Z', 1), s.get('Y', 1)]

def color(c, lineal=False):
    c = c or {}
    if 'R' in c and isinstance(c['R'], int) and not lineal: return [c['R'] / 255, c['G'] / 255, c['B'] / 255]
    return [c.get('R', 1), c.get('G', 1), c.get('B', 1)]

def r4(x, n=4):
    if isinstance(x, float): return round(x, n)
    if isinstance(x, list): return [r4(v, n) for v in x]
    if isinstance(x, dict): return {k: r4(v, n) for k, v in x.items()}
    return x

_MAPAS = None
def ruta_mapa(n):
    """'SM_Cutscene01' → 'TJoC_SM/Content/FirstPersonBP/Maps/Cutscenes/SM_Cutscene01' (sin extensión)"""
    global _MAPAS
    if '/' in n: return n
    if _MAPAS is None:
        f = os.path.join(os.path.dirname(CRUDO), 'archivos.txt')
        _MAPAS = {}
        for l in open(f):
            l = l.strip()
            if l.endswith('.umap'): _MAPAS.setdefault(l.split('/')[-1][:-5], l[:-5])
    return _MAPAS.get(n, 'TJoC_SM/Content/FirstPersonBP/Maps/' + n)
