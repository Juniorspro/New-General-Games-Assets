# Torre de oficinas, armada por script. Materiales PBR de verdad (AmbientCG y
# Poliigon, los mismos que ya estaban en el repo) y cielo HDRI.
import bpy, math, os, mathutils

WEB  = "/home/neko/tex"
HDRI = "/home/neko/tex/cielo.hdr"
SALIDA_BLEND = "/home/neko/torre.blend"
SALIDA_GLB   = "/home/neko/torre.glb"
SALIDA_PNG   = "/home/neko/torre.png"

# ---------------------------------------------------------------- limpieza
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for d in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
          bpy.data.cameras, bpy.data.images, bpy.data.worlds):
    for x in list(d):
        d.remove(x)

# ---------------------------------------------------------------- materiales
_mats = {}

def img(ruta, color=False):
    im = bpy.data.images.load(ruta, check_existing=True)
    im.colorspace_settings.name = "sRGB" if color else "Non-Color"
    return im

def pbr(nombre, escala=1.0, tinte=None, emision=0.0, alias=None):
    """Arma el nodo tal como lo espera el exportador de glTF: color, normal, y
       un solo mapa con rugosidad en verde y metal en azul. Así el .glb sale
       con una textura metallicRoughness y no con dos."""
    clave = alias or nombre
    if clave in _mats:
        return _mats[clave]
    m = bpy.data.materials.new(clave)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]

    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapeo = nt.nodes.new("ShaderNodeMapping")
    mapeo.inputs["Scale"].default_value = (escala, escala, escala)
    nt.links.new(coord.outputs["UV"], mapeo.inputs["Vector"])

    def textura(sufijo, color=False):
        ruta = "%s/%s_%s.jpg" % (WEB, nombre, sufijo)
        if not os.path.exists(ruta):
            return None
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = img(ruta, color)
        n.interpolation = "Smart"
        nt.links.new(mapeo.outputs["Vector"], n.inputs["Vector"])
        return n

    col = textura("col", True)
    if col:
        if tinte:
            mez = nt.nodes.new("ShaderNodeMix")
            mez.data_type = "RGBA"
            mez.blend_type = "MULTIPLY"
            mez.inputs["Factor"].default_value = 1.0
            mez.inputs["B"].default_value = (*tinte, 1)
            nt.links.new(col.outputs["Color"], mez.inputs["A"])
            nt.links.new(mez.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])

    nrm = textura("nrm")
    if nrm:
        mapa = nt.nodes.new("ShaderNodeNormalMap")
        mapa.inputs["Strength"].default_value = 1.0
        nt.links.new(nrm.outputs["Color"], mapa.inputs["Color"])
        nt.links.new(mapa.outputs["Normal"], bsdf.inputs["Normal"])

    mr = textura("mr")
    if mr:
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(mr.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])

    emi = textura("emi", True)
    if emi and emision:
        nt.links.new(emi.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = emision

    _mats[clave] = m
    return m

def liso(nombre, color, metal, rug, emis=None, fuerza=0.0):
    if nombre in _mats:
        return _mats[nombre]
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rug
    if emis:
        b.inputs["Emission Color"].default_value = (*emis, 1)
        b.inputs["Emission Strength"].default_value = fuerza
    _mats[nombre] = m
    return m

# ---------------------------------------------------------------- geometría
def caja(nombre, centro, tam, mat, uv=2.0):
    bpy.ops.mesh.primitive_cube_add(size=2, location=centro)
    ob = bpy.context.object
    ob.name = nombre
    ob.scale = (tam[0]/2, tam[1]/2, tam[2]/2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(mat)
    if uv:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        # proyección cúbica: la textura se repite cada `uv` metros de verdad,
        # así el hormigón mide igual en una pared de 3 m que en una de 30
        bpy.ops.uv.cube_project(cube_size=uv, correct_aspect=True)
        bpy.ops.object.mode_set(mode="OBJECT")
    return ob

M_HORM = pbr("hormigon", escala=0.5, tinte=(0.68, 0.68, 0.67))
M_PANEL = pbr("panel", escala=1.0, tinte=(0.55, 0.58, 0.62))
M_ANTEP = pbr("aluminio", escala=0.35, tinte=(0.24, 0.26, 0.30), alias="antepecho")
M_ALU = pbr("aluminio", escala=1.0, tinte=(0.66, 0.68, 0.72))
M_LAD = pbr("ladrillo", escala=0.6, tinte=(0.95, 0.88, 0.80))
M_CALLE = pbr("calle", escala=0.25)
M_VEREDA = pbr("vereda", escala=0.5)
M_INT = liso("interior", (0.30, 0.29, 0.27), 0.0, 0.75,
             emis=(0.50, 0.46, 0.39), fuerza=1.0)
M_VIDRIO = liso("vidrio", (0.055, 0.075, 0.10), 0.72, 0.045)
M_OSCURO = liso("oscuro", (0.02, 0.02, 0.025), 0.0, 0.6)
M_LUZ = liso("luz", (1.0, 0.92, 0.78), 0.0, 0.4, emis=(1.0, 0.88, 0.66), fuerza=18)

# --- el suelo: calle, cordón y vereda -------------------------------------
caja("suelo_lejos", (0, 0, -0.5), (4000, 4000, 0.5), M_HORM, uv=12)
caja("calle", (0, -34, -0.16), (120, 26, 0.3), M_CALLE, uv=8)
caja("cordon", (0, -21, 0.02), (120, 0.5, 0.34), M_HORM, uv=2)
caja("vereda", (0, -12, 0.05), (120, 18, 0.3), M_VEREDA, uv=3)
caja("plaza", (0, 14, 0.05), (70, 36, 0.3), M_VEREDA, uv=3)

# --- podio ---------------------------------------------------------------
PA, PP, PH = 30.0, 20.0, 9.0            # ancho, profundidad, alto
caja("podio", (0, 0, PH/2), (PA, PP, PH), M_HORM, uv=3)
# vidriado del hall, hundido en el podio
caja("hall", (0, -PP/2 + 0.35, 3.1), (PA - 5, 0.5, 5.4), M_VIDRIO, uv=0)
caja("hall_int", (0, -PP/2 + 1.6, 3.1), (PA - 5.4, 2.0, 5.0), M_INT, uv=2)
# alero del podio
caja("alero", (0, -PP/2 - 1.4, PH - 0.35), (PA + 4, 5.0, 0.7), M_HORM, uv=3)
for i in range(5):                       # columnas del alero
    caja("col_%d" % i, (-11 + i*5.5, -PP/2 - 3.4, (PH - 0.7)/2), (0.55, 0.55, PH - 0.7), M_HORM, uv=1.5)
caja("parapeto_podio", (0, 0, PH + 0.5), (PA + 0.4, PP + 0.4, 1.0), M_HORM, uv=3)

# --- torre ---------------------------------------------------------------
TA, TP = 20.0, 14.0                      # planta de la torre
PISO = 3.8
N1, N2 = 13, 8                           # pisos antes y después del retiro
BASE = PH + 1.0
RET = 4.0                                # cuánto se retira arriba
ALTO1 = N1 * PISO
ALTO2 = N2 * PISO
TOPE = BASE + ALTO1 + ALTO2

def tramo(z0, alto, ancho, prof, cy, etiqueta):
    """Un tramo de torre: losas, antepechos, vidrio, interior y aletas."""
    n = int(round(alto / PISO))
    # núcleo opaco atrás
    caja("nucleo_%s" % etiqueta, (0, cy + prof/2 - 0.9, z0 + alto/2), (ancho - 1.0, 1.8, alto), M_HORM, uv=3)
    for i in range(n):
        zb = z0 + i * PISO
        # antepecho (la banda opaca entre ventana y ventana)
        caja("antep_%s_%d" % (etiqueta, i), (0, cy, zb + 0.6), (ancho + .06, prof + .06, 1.2), M_ANTEP, uv=4.0)
        # piso iluminado que se ve por el vidrio
        caja("int_%s_%d" % (etiqueta, i), (0, cy, zb + 2.4), (ancho - 1.2, prof - 1.2, 2.4), M_INT, uv=2.5)
        # el vidrio, apenas por fuera
        caja("vidrio_%s_%d" % (etiqueta, i), (0, cy, zb + 2.45), (ancho + .10, prof + .10, 2.5), M_VIDRIO, uv=0)
        # visera de cada piso
        caja("visera_%s_%d" % (etiqueta, i), (0, cy, zb + 1.28), (ancho + .70, prof + .70, 0.16), M_ALU, uv=1.5)
    # aletas verticales, de una pieza y de punta a punta
    paso = 1.7
    nx = int(ancho / paso)
    for k in range(nx + 1):
        x = -ancho/2 + k * (ancho / nx)
        for lado in (-1, 1):
            caja("aleta_%s_%d_%d" % (etiqueta, k, lado),
                 (x, cy + lado * (prof/2 + 0.22), z0 + alto/2), (0.14, 0.44, alto), M_ALU, uv=1.5)
    ny = int(prof / paso)
    for k in range(ny + 1):
        y = cy - prof/2 + k * (prof / ny)
        for lado in (-1, 1):
            caja("aletay_%s_%d_%d" % (etiqueta, k, lado),
                 (lado * (ancho/2 + 0.22), y, z0 + alto/2), (0.44, 0.14, alto), M_ALU, uv=1.5)

tramo(BASE, ALTO1, TA, TP, 0.0, "bajo")
tramo(BASE + ALTO1, ALTO2, TA, TP - RET, RET/2, "alto")

# terraza que deja el retiro
caja("terraza", (0, -TP/2 + RET/2, BASE + ALTO1 + 0.12), (TA + .6, RET + .6, 0.24), M_VEREDA, uv=2)
caja("baranda", (0, -TP/2 + 0.15, BASE + ALTO1 + 0.75), (TA + .6, 0.1, 1.1), M_VIDRIO, uv=0)

# pantalla de hormigón: sube por un costado y pasa el techo
caja("pantalla", (TA/2 + 0.9, 1.0, (BASE + TOPE)/2), (1.4, TP - 1.0, TOPE - BASE + 7.0), M_HORM, uv=3)

# --- coronamiento --------------------------------------------------------
caja("parapeto", (0, RET/2, TOPE + 0.8), (TA + .8, TP - RET + .8, 1.6), M_ALU, uv=2)
caja("sala_maq", (-3.5, RET/2 + 1.0, TOPE + 3.0), (9.0, 7.0, 4.4), M_PANEL, uv=2)
caja("rejilla", (-3.5, RET/2 + 1.0, TOPE + 5.4), (9.4, 7.4, 0.5), M_OSCURO, uv=0)
for i in range(3):
    caja("chiller_%d" % i, (2.5, RET/2 - 2.5 + i*2.4, TOPE + 1.9), (3.2, 1.8, 1.6), M_ALU, uv=1)
# mástil
bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.22, depth=16,
                                    location=(-3.5, RET/2 + 1.0, TOPE + 5.2 + 8))
mastil = bpy.context.object; mastil.name = "mastil"; mastil.data.materials.append(M_ALU)
bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.42,
                                     location=(-3.5, RET/2 + 1.0, TOPE + 5.2 + 16.4))
baliza = bpy.context.object; baliza.name = "baliza"
baliza.data.materials.append(liso("baliza", (0.6, 0.03, 0.03), 0, .4, emis=(1, .08, .08), fuerza=40))

# --- vecinos, para que no flote en el vacío ------------------------------
caja("vecino_izq", (-34, 4, 11), (24, 26, 22), M_LAD, uv=4)
caja("vecino_der", (33, 6, 8.5), (22, 22, 17), M_LAD, uv=4)
caja("vecino_fondo", (4, 34, 14), (40, 20, 28), M_HORM, uv=4)

# --- luminarias de la vereda ---------------------------------------------
for x in (-24, -8, 8, 24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.11, depth=7, location=(x, -19.5, 3.5))
    p = bpy.context.object; p.name = "poste"; p.data.materials.append(M_OSCURO)
    caja("farol_%d" % x, (x, -19.5, 7.1), (0.5, 1.6, 0.22), M_LUZ, uv=0)

# --- maceteros -----------------------------------------------------------
for i in range(4):
    caja("macetero_%d" % i, (-16 + i*10.6, -14.5, 0.55), (3.2, 1.6, 1.0), M_HORM, uv=1.5)

# ---------------------------------------------------------------- mundo
mundo = bpy.data.worlds.new("cielo")
mundo.use_nodes = True
nt = mundo.node_tree
fondo = nt.nodes["Background"]
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(HDRI)
gir = nt.nodes.new("ShaderNodeMapping")
gir.inputs["Rotation"].default_value = (0, 0, math.radians(155))
coord = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(coord.outputs["Generated"], gir.inputs["Vector"])
nt.links.new(gir.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], fondo.inputs["Color"])
fondo.inputs["Strength"].default_value = 1.0
bpy.context.scene.world = mundo

sol = bpy.data.lights.new("sol", type="SUN")
sol.energy = 5.0
sol.angle = math.radians(1.5)
obsol = bpy.data.objects.new("sol", sol)
obsol.rotation_euler = (math.radians(52), math.radians(2), math.radians(34))
bpy.context.collection.objects.link(obsol)

# ---------------------------------------------------------------- cámara
cam = bpy.data.cameras.new("camara")
cam.lens = 38
obcam = bpy.data.objects.new("camara", cam)
obcam.location = (78, -106, 19)
bpy.context.collection.objects.link(obcam)
bpy.context.scene.camera = obcam
d = mathutils.Vector((0, 0, 56)) - obcam.location
obcam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

# ---------------------------------------------------------------- render
esc = bpy.context.scene
esc.render.engine = "CYCLES"
esc.cycles.device = "CPU"
esc.cycles.samples = 96
esc.cycles.use_denoising = False        # este build no trae OpenImageDenoise
esc.cycles.max_bounces = 6
esc.render.resolution_x = 1200
esc.render.resolution_y = 1560
esc.render.filepath = SALIDA_PNG
esc.view_settings.view_transform = "AgX"
esc.view_settings.look = "AgX - Punchy"

mallas = [o for o in bpy.data.objects if o.type == "MESH"]
caras = sum(len(o.data.polygons) for o in mallas)
print("TORRE: %d objetos, %d caras, %d materiales, alto %.1f m" % (
    len(mallas), caras, len(bpy.data.materials), TOPE + 5.2 + 16.6))

bpy.ops.wm.save_as_mainfile(filepath=SALIDA_BLEND)

# Antes de exportar se junta todo lo que comparte material. Son 205 objetos
# sueltos, o sea 205 llamadas de dibujo por cuadro en el navegador; unidos por
# material quedan tantas como materiales hay. El .blend ya se guardó arriba con
# los objetos separados, así que la escena editable no se toca.
from collections import defaultdict
grupos = defaultdict(list)
for o in bpy.data.objects:
    if o.type == "MESH" and o.data.materials:
        grupos[o.data.materials[0].name].append(o)
for nombre, obs in grupos.items():
    if len(obs) < 2:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    bpy.context.object.name = "grupo_" + nombre
print("TORRE: %d objetos despues de juntar por material" %
      len([o for o in bpy.data.objects if o.type == "MESH"]))

for o in bpy.data.objects:
    o.select_set(o.type == "MESH")
bpy.ops.export_scene.gltf(filepath=SALIDA_GLB, export_format="GLB",
                          use_selection=True, export_apply=True,
                          export_image_format="JPEG", export_jpeg_quality=85)
print("TORRE: glb listo")
