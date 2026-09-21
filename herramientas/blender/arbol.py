# Arbol lowpoly. Igual que casita.py: se arma con datos de malla y una semilla
# fija, asi correrlo dos veces da exactamente el mismo arbol. Un arbol hecho a
# mano en la interfaz no se puede versionar ni repetir.
import bpy, math, os, random
from mathutils import Vector, Matrix

AZAR = random.Random(7)      # semilla fija: el arbol es siempre este arbol


# --- elegir la placa -----------------------------------------------------
# Por defecto CPU, que es lo que hay en el contenedor. Con DISPOSITIVO=GPU usa
# la placa. La trampa: poner cycles.device = "GPU" NO alcanza; si en las
# preferencias no hay ningun aparato prendido, Cycles se cae a CPU y renderiza
# igual, sin avisar nada.
def elegir_placa(esc):
    quiero = os.environ.get("DISPOSITIVO", "CPU").upper()
    if quiero != "GPU":
        esc.cycles.device = "CPU"
        return "CPU"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for tipo in ("OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = tipo
        except TypeError:
            continue        # este Blender no se compilo con ese backend
        prefs.get_devices()
        placas = [d for d in prefs.devices if d.type == tipo]
        if placas:
            for d in prefs.devices:
                d.use = (d.type == tipo)
            esc.cycles.device = "GPU"
            return "GPU/%s (%s)" % (tipo, ", ".join(d.name for d in placas))
    esc.cycles.device = "CPU"
    return "CPU (se pidio GPU y no hay ninguna)"


bpy.ops.wm.read_factory_settings(use_empty=True)

PALETA = {
    "tronco":  (0.30, 0.19, 0.12),
    "hoja":    (0.15, 0.40, 0.16),
    "hoja2":   (0.23, 0.51, 0.20),   # dos verdes: un solo verde se ve de carton
    "hoja3":   (0.09, 0.27, 0.12),
    "pasto":   (0.34, 0.52, 0.24),
    "piedra":  (0.47, 0.46, 0.43),
}
mats = {}
def material(nombre):
    if nombre in mats:
        return mats[nombre]
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    r, g, bl = PALETA[nombre]
    b.inputs["Base Color"].default_value = (r, g, bl, 1)
    b.inputs["Roughness"].default_value = 0.9
    mats[nombre] = m
    return m

def poner(ob, nombre, plano=True):
    ob.data.materials.append(material(nombre))
    if plano:
        # el sombreado plano es lo que hace que un lowpoly se lea como lowpoly:
        # con smooth las facetas desaparecen y queda un choclo de plastico
        for p in ob.data.polygons:
            p.use_smooth = False
    return ob

def malla(nombre, verts, caras, mat):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(verts, [], caras)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.collection.objects.link(ob)
    return poner(ob, mat)


# --- el tronco y las ramas ----------------------------------------------
# Un tronco es una pila de anillos. Se guarda cada anillo y se cosen de a dos:
# asi una rama es exactamente el mismo codigo que el tronco, solo que empieza
# arriba y sale torcida.
LADOS = 7        # impar a proposito: con 8 las facetas quedan simetricas y
                 # el tronco parece un tubo industrial

def anillo(centro, radio, eje, vuelta):
    """Un anillo de LADOS puntos, perpendicular a 'eje'."""
    eje = Vector(eje).normalized()
    # un vector cualquiera que no sea paralelo al eje, para sacar la base
    otro = Vector((0, 0, 1)) if abs(eje.z) < 0.9 else Vector((1, 0, 0))
    u = eje.cross(otro).normalized()
    v = eje.cross(u).normalized()
    return [Vector(centro) + (u * math.cos(a) + v * math.sin(a)) * radio
            for i in range(LADOS)
            for a in [2 * math.pi * i / LADOS + vuelta]]

def tubo(nombre, base, direccion, largo, r0, r1, tramos, curva, mat):
    """Tronco o rama: anillos apilados con el radio bajando y una curva suave."""
    eje = Vector(direccion).normalized()
    lado = eje.cross(Vector((0, 0, 1))).normalized() if abs(eje.z) < 0.99 \
           else Vector((1, 0, 0))
    verts, caras = [], []
    for i in range(tramos + 1):
        t = i / tramos
        # la curva: se va yendo de lado cada vez mas, como un arbol de verdad
        centro = Vector(base) + eje * (largo * t) + lado * (curva * t * t)
        radio = r0 + (r1 - r0) * t
        verts += anillo(centro, radio, eje, vuelta=0.3 * t)
    for i in range(tramos):
        a, b = i * LADOS, (i + 1) * LADOS
        for j in range(LADOS):
            k = (j + 1) % LADOS
            caras.append((a + j, a + k, b + k, b + j))
    # tapa de arriba, para que la rama no quede hueca vista desde el aire
    caras.append(tuple(range(tramos * LADOS, (tramos + 1) * LADOS)))
    ob = malla(nombre, [tuple(p) for p in verts], caras, mat)
    return Vector(base) + eje * largo + lado * curva     # donde termina

ALTO_TRONCO = 3.8
punta = tubo("tronco", (0, 0, 0), (0, 0, 1), ALTO_TRONCO, 0.44, 0.17, 6, 0.30, "tronco")

# cuatro ramas, repartidas alrededor y a distintas alturas
RAMAS = [
    (0.50,  15, 2.10, 1.45),
    (0.63, 145, 1.85, 1.30),
    (0.74, 255, 2.25, 1.50),
    (0.86, 330, 1.60, 1.10),
]
puntas = [punta]
for n, (altura, grados, largo, apertura) in enumerate(RAMAS):
    t = altura
    base = Vector((0, 0, ALTO_TRONCO * t)) + Vector((1, 0, 0)) * (0.30 * t * t)
    ang = math.radians(grados)
    direccion = Vector((math.cos(ang) * apertura, math.sin(ang) * apertura, 1.0))
    puntas.append(tubo(f"rama{n}", base, direccion, largo,
                       0.17, 0.055, 5, 0.30, "tronco"))

# --- la copa -------------------------------------------------------------
# Bolas de pocas caras encima de cada punta, mas algunas sueltas para llenar.
# Cada una se achata y se estira distinto: bolas iguales se ven como un racimo
# de uvas, no como follaje.
VERDES = ["hoja", "hoja2", "hoja3"]
centros = [(p, 0.95) for p in puntas]
for p, _ in list(centros):
    for _ in range(2):
        centros.append((p + Vector((AZAR.uniform(-.7, .7),
                                    AZAR.uniform(-.7, .7),
                                    AZAR.uniform(-.25, .55))), 0.62))

for n, (c, escala) in enumerate(centros):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=c)
    ob = bpy.context.object
    ob.name = f"copa{n}"
    ob.scale = (escala * AZAR.uniform(.95, 1.25),
                escala * AZAR.uniform(.95, 1.25),
                escala * AZAR.uniform(.70, .95))
    ob.rotation_euler = (AZAR.uniform(0, 3), AZAR.uniform(0, 3), AZAR.uniform(0, 3))
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    poner(ob, VERDES[n % 3])

# --- el suelo y unas piedras --------------------------------------------
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0))
piso = bpy.context.object
piso.name = "pasto"
poner(piso, "pasto")

for n in range(7):
    a = AZAR.uniform(0, 2 * math.pi)
    d = AZAR.uniform(1.6, 4.2)
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=1, radius=AZAR.uniform(.10, .22),
        location=(math.cos(a) * d, math.sin(a) * d, 0.04))
    ob = bpy.context.object
    ob.name = f"piedra{n}"
    ob.scale = (1, 1, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    poner(ob, "piedra")

# --- luz, cielo y camara -------------------------------------------------
bpy.ops.object.light_add(type="SUN", location=(6, -5, 11))
sol = bpy.context.object
sol.data.energy = 4.0
sol.data.angle = math.radians(2.5)     # un poco de blandura en la sombra
sol.rotation_euler = (math.radians(48), 0, math.radians(38))

mundo = bpy.data.worlds.new("cielo")
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.45, 0.65, 0.88, 1)
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
bpy.context.scene.world = mundo

ojo, mira = Vector((6.4, -8.2, 4.1)), Vector((0.15, 0, 3.05))
bpy.ops.object.camera_add(location=ojo)
cam = bpy.context.object
cam.rotation_euler = (mira - ojo).to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 43
bpy.context.scene.camera = cam

# --- render --------------------------------------------------------------
esc = bpy.context.scene
esc.render.engine = "CYCLES"
print("PLACA:", elegir_placa(esc))
esc.cycles.samples = int(os.environ.get("MUESTRAS", "128"))
# este Blender de Debian viene sin OpenImageDenoise: prenderlo revienta recien
# al renderizar y se lleva el render entero. Se compensa con mas muestras.
esc.cycles.use_denoising = False
esc.cycles.max_bounces = 4
esc.render.resolution_x = int(os.environ.get("ANCHO", "1000"))
esc.render.resolution_y = int(os.environ.get("ALTO", "750"))
try:
    esc.view_settings.look = "AgX - Punchy"
except TypeError:
    esc.view_settings.look = "Punchy"   # el nombre cambio entre versiones

SALIDA = os.environ.get("SALIDA", "/home/neko")
esc.render.filepath = os.path.join(SALIDA, "arbol.png")

caras = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
verts = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == "MESH")
print("ARBOL: %d objetos, %d caras, %d vertices" % (
    len([o for o in bpy.data.objects if o.type == "MESH"]), caras, verts))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SALIDA, "arbol.blend"))
if os.environ.get("RENDERIZAR", "1") == "1":
    bpy.ops.render.render(write_still=True)
