# La ciudad del juego. Sale del mismo generador que la torre: cajas con
# materiales PBR, unidas por material antes de exportar. Además del .glb
# escribe un .json con las cajas de colisión, que es lo que usa el juego para
# engancharse y para chocar: sobre cajas alineadas a los ejes, un rayo o un
# contacto se resuelven con cuentas, sin tocar la malla.
import bpy, json, math, os, random

WEB   = "/home/neko/tex"
SEMILLA = 20260906
SALIDA_BLEND = "/home/neko/ciudad.blend"
SALIDA_GLB   = "/home/neko/ciudad.glb"
SALIDA_JSON  = "/home/neko/ciudad.json"

random.seed(SEMILLA)

bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete()
for d in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
          bpy.data.cameras, bpy.data.images, bpy.data.worlds):
    for x in list(d): d.remove(x)

# ----------------------------------------------------------------- materiales
_mats = {}
def img(ruta, color=False):
    im = bpy.data.images.load(ruta, check_existing=True)
    im.colorspace_settings.name = "sRGB" if color else "Non-Color"
    return im

def pbr(nombre, escala=1.0, tinte=None, alias=None):
    clave = alias or nombre
    if clave in _mats: return _mats[clave]
    m = bpy.data.materials.new(clave); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapeo = nt.nodes.new("ShaderNodeMapping")
    mapeo.inputs["Scale"].default_value = (escala, escala, escala)
    nt.links.new(coord.outputs["UV"], mapeo.inputs["Vector"])
    def tex(suf, color=False):
        r = "%s/%s_%s.jpg" % (WEB, nombre, suf)
        if not os.path.exists(r): return None
        n = nt.nodes.new("ShaderNodeTexImage"); n.image = img(r, color)
        n.interpolation = "Smart"
        nt.links.new(mapeo.outputs["Vector"], n.inputs["Vector"]); return n
    col = tex("col", True)
    if col:
        if tinte:
            # ShaderNodeMix, no el viejo MixRGB: es el único que el exportador
            # de glTF reconoce como baseColorFactor
            mz = nt.nodes.new("ShaderNodeMix"); mz.data_type = "RGBA"
            mz.blend_type = "MULTIPLY"; mz.inputs["Factor"].default_value = 1.0
            mz.inputs["B"].default_value = (*tinte, 1)
            nt.links.new(col.outputs["Color"], mz.inputs["A"])
            nt.links.new(mz.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    nrm = tex("nrm")
    if nrm:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    mr = tex("mr")
    if mr:
        sp = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(mr.outputs["Color"], sp.inputs["Color"])
        nt.links.new(sp.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(sp.outputs["Blue"], bsdf.inputs["Metallic"])
    _mats[clave] = m; return m

def liso(nombre, color, metal, rug, emis=None, fuerza=0.0):
    if nombre in _mats: return _mats[nombre]
    m = bpy.data.materials.new(nombre); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rug
    if emis:
        b.inputs["Emission Color"].default_value = (*emis, 1)
        b.inputs["Emission Strength"].default_value = fuerza
    _mats[nombre] = m; return m

# --------------------------------------------------------------- geometría
# Nada de operadores por caja. Cada operador de Blender dispara una
# actualización del grafo de dependencias, y con miles de objetos eso se vuelve
# cuadrático: la primera versión de esto pasó el cuarto de hora sin terminar.
# Acá las cajas se acumulan como vértices sueltos y al final sale UNA malla por
# material, con las UV calculadas a mano.
LOTES = {}

CARAS = [((0,1,2,3),2), ((7,6,5,4),2),
         ((0,4,5,1),1), ((3,2,6,7),1),
         ((1,5,6,2),0), ((4,0,3,7),0)]

def caja(nombre, centro, tam, mat, uv=2.0):
    cx, cy, cz = centro
    sx, sy, sz = tam[0]/2, tam[1]/2, tam[2]/2
    lote = LOTES.setdefault(mat.name, {"v": [], "f": [], "uv": [], "mat": mat, "u": uv or 2.0})
    base = len(lote["v"])
    esq = [(cx-sx,cy-sy,cz+sz),(cx+sx,cy-sy,cz+sz),(cx+sx,cy+sy,cz+sz),(cx-sx,cy+sy,cz+sz),
           (cx-sx,cy-sy,cz-sz),(cx+sx,cy-sy,cz-sz),(cx+sx,cy+sy,cz-sz),(cx-sx,cy+sy,cz-sz)]
    lote["v"].extend(esq)
    u = lote["u"]
    for idx, eje in CARAS:
        lote["f"].append(tuple(base + i for i in idx))
        # proyección cúbica a mano: los dos ejes que no son la normal, en
        # metros divididos por u, para que la textura mida igual en una pared
        # de 3 m que en una de 300
        a, b = [k for k in (0,1,2) if k != eje]
        for i in idx:
            v = esq[i]
            lote["uv"].append((v[a]/u, v[b]/u))

def volcar():
    for nombre, l in LOTES.items():
        me = bpy.data.meshes.new("m_" + nombre)
        me.from_pydata(l["v"], [], l["f"])
        me.validate()
        capa = me.uv_layers.new(name="UVMap")
        for i, co in enumerate(l["uv"]):
            capa.data[i].uv = co
        me.update()
        ob = bpy.data.objects.new("grupo_" + nombre, me)
        ob.data.materials.append(l["mat"])
        bpy.context.collection.objects.link(ob)

M_HORM  = pbr("hormigon", .5, (0.68,0.68,0.67))
M_HORM2 = pbr("hormigon", .5, (0.50,0.49,0.47), alias="hormigon_oscuro")
M_ALU   = pbr("aluminio", 1., (0.66,0.68,0.72))
M_ANTEP = pbr("aluminio", .35, (0.24,0.26,0.30), alias="antepecho")
M_PANEL = pbr("panel", 1., (0.55,0.58,0.62))
M_LAD   = pbr("ladrillo", .6, (0.95,0.88,0.80))
M_CALLE = pbr("calle", .25)
M_VEREDA= pbr("vereda", .5)
M_VIDRIO= liso("vidrio", (0.055,0.075,0.10), 0.72, 0.045)
M_INT   = liso("interior", (0.30,0.29,0.27), 0.0, 0.75, emis=(0.50,0.46,0.39), fuerza=1.0)
M_LUZ   = liso("luz", (1,0.92,0.78), 0, .4, emis=(1,0.88,0.66), fuerza=1.0)

# ----------------------------------------------------------------- trazado
MANZANA = 78.0     # lado de manzana, de eje a eje de calle
CALLE   = 26.0     # ancho de calzada + veredas
N       = 5        # manzanas por lado
PASO    = MANZANA + CALLE
MITAD   = (N - 1) / 2 * PASO

cajas = []         # las AABB que ve el juego
def registrar(cx, cy, cz, sx, sy, sz, clase):
    cajas.append({"c":[round(cx,2), round(cz,2), round(-cy,2)],   # a ejes de three: Y arriba, Z hacia el que mira
                  "s":[round(sx,2), round(sz,2), round(sy,2)], "t":clase})

# suelo grande y calles
caja("suelo", (0,0,-0.5), (4000,4000,1.0), M_HORM2, uv=14)
LARGO = N * PASO + 200
for i in range(N + 1):
    d = -MITAD - PASO/2 + i * PASO
    caja("calle_x_%d" % i, (0, d, 0.02), (LARGO, CALLE - 9, 0.28), M_CALLE, uv=9)
    caja("calle_y_%d" % i, (d, 0, 0.02), (CALLE - 9, LARGO, 0.28), M_CALLE, uv=9)

PISO = 3.9
def torre(bx, by, ancho, prof, pisos, estilo):
    """Un edificio: núcleo, antepechos por piso, vidrio, viseras y aletas."""
    alto = pisos * PISO
    base = 0.0
    caja("nuc_%d_%d" % (bx, by), (bx, by, base + alto/2), (ancho-1.5, prof-1.5, alto),
         M_HORM if estilo else M_HORM2, uv=3)
    for i in range(pisos):
        z = base + i * PISO
        caja("ant", (bx, by, z + 0.62), (ancho+.06, prof+.06, 1.24), M_ANTEP, uv=4)
        caja("int", (bx, by, z + 2.5), (ancho-1.4, prof-1.4, 2.4), M_INT, uv=2.5)
        caja("vid", (bx, by, z + 2.55), (ancho+.10, prof+.10, 2.55), M_VIDRIO, uv=0)
        if estilo:
            caja("vis", (bx, by, z + 1.3), (ancho+.55, prof+.55, 0.14), M_ALU, uv=1.5)
    paso = 2.2
    for k in range(int(ancho/paso) + 1):
        x = bx - ancho/2 + k * (ancho / max(1, int(ancho/paso)))
        for l in (-1, 1):
            caja("ale", (x, by + l*(prof/2+.2), alto/2), (0.16, 0.4, alto), M_ALU, uv=1.5)
    # coronamiento
    caja("par", (bx, by, alto + 0.7), (ancho+.7, prof+.7, 1.4), M_ALU, uv=2)
    caja("maq", (bx - ancho*0.2, by, alto + 2.6), (ancho*0.42, prof*0.42, 3.2), M_PANEL, uv=2)
    if pisos > 18:
        caja("luz_alta", (bx, by, alto + 4.6), (1.2, 1.2, 0.5), M_LUZ, uv=0)
    registrar(bx, by, alto/2, ancho + 1.0, prof + 1.0, alto, "torre")
    return alto

# ----------------------------------------------------------------- manzanas
alturas = []
for ix in range(N):
    for iy in range(N):
        cx = -MITAD + ix * PASO
        cy = -MITAD + iy * PASO
        # dos o tres edificios por manzana, para que el skyline no sea plano
        cuantos = random.choice([1, 2, 2, 3])
        huecos = [(-1,-1), (1,1), (-1,1), (1,-1)]
        random.shuffle(huecos)
        for k in range(cuantos):
            hx, hy = huecos[k]
            ancho = random.uniform(20, 30) if cuantos == 1 else random.uniform(16, 24)
            prof  = random.uniform(20, 30) if cuantos == 1 else random.uniform(16, 24)
            ox = 0 if cuantos == 1 else hx * (MANZANA/2 - ancho/2 - 3)
            oy = 0 if cuantos == 1 else hy * (MANZANA/2 - prof/2 - 3)
            # el centro de la ciudad es más alto, como una city de verdad
            lejos = math.hypot(cx, cy) / (MITAD + 1)
            pisos = int(random.uniform(6, 32) * (1.25 - 0.55 * lejos))
            pisos = max(4, min(34, pisos))
            alturas.append(torre(cx + ox, cy + oy, ancho, prof, pisos, k == 0))
        # vereda de la manzana
        caja("ver_%d_%d" % (ix, iy), (cx, cy, 0.10), (MANZANA, MANZANA, 0.4), M_VEREDA, uv=3)

print("CIUDAD: %d edificios, alto %d-%d m" % (len(alturas), min(alturas), max(alturas)))

# ----------------------------------------------------------------- coleccionables
orbes = []
for i in range(28):
    c = random.choice(cajas)
    x = c["c"][0] + random.uniform(-14, 14)
    z = c["c"][2] + random.uniform(-14, 14)
    y = random.uniform(c["s"][1] * 0.45, c["s"][1] * 0.55 + 26)
    orbes.append([round(x,1), round(y,1), round(z,1)])

datos = {
  "cajas": cajas,
  "orbes": orbes,
  "arranque": [0, 0, 0],
  "nota": "Coordenadas en ejes de three.js: Y arriba. c = centro, s = tamaño completo.",
}
# el punto de arranque: arriba del edificio más alto cerca del centro
mejor = max(cajas, key=lambda c: c["s"][1] - math.hypot(c["c"][0], c["c"][2]) * 0.25)
datos["arranque"] = [mejor["c"][0], round(mejor["s"][1] + 2, 1), mejor["c"][2]]
json.dump(datos, open(SALIDA_JSON, "w"), separators=(",", ":"))
print("CIUDAD: %d cajas de colisión, %d orbes, arranque %s" % (len(cajas), len(orbes), datos["arranque"]))

# ----------------------------------------------------------------- cielo y export
mundo = bpy.data.worlds.new("cielo"); mundo.use_nodes = True
nt = mundo.node_tree
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load("/home/neko/tex/cielo.hdr")
gir = nt.nodes.new("ShaderNodeMapping"); gir.inputs["Rotation"].default_value = (0,0,math.radians(155))
crd = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(crd.outputs["Generated"], gir.inputs["Vector"])
nt.links.new(gir.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
bpy.context.scene.world = mundo

volcar()
mallas = [o for o in bpy.data.objects if o.type == "MESH"]
print("CIUDAD: %d mallas (una por material), %d caras" % (
      len(mallas), sum(len(o.data.polygons) for o in mallas)))
bpy.ops.wm.save_as_mainfile(filepath=SALIDA_BLEND)

for o in bpy.data.objects: o.select_set(o.type == "MESH")
bpy.ops.export_scene.gltf(filepath=SALIDA_GLB, export_format="GLB", use_selection=True,
                          export_apply=True, export_image_format="JPEG", export_jpeg_quality=82)
print("CIUDAD: glb listo")
