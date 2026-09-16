# Casita lowpoly. Se arma con datos de malla, no con el ratón, así el
# resultado es el mismo cada vez que se corre.
import bpy, math, mathutils

# --- limpiar la escena de arranque ---
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for d in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for x in list(d):
        d.remove(x)

PALETA = {
    "pared":   (0.93, 0.87, 0.74),
    "madera":  (0.42, 0.26, 0.16),
    "techo":   (0.62, 0.22, 0.20),
    "puerta":  (0.35, 0.20, 0.13),
    "vidrio":  (0.55, 0.78, 0.86),
    "piedra":  (0.48, 0.47, 0.45),
    "pasto":   (0.36, 0.55, 0.25),
    "hoja":    (0.20, 0.43, 0.22),
    "tronco":  (0.33, 0.22, 0.14),
    "camino":  (0.72, 0.67, 0.56),
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
    b.inputs["Roughness"].default_value = 0.35 if nombre == "vidrio" else 0.85
    if nombre == "vidrio":
        b.inputs["Metallic"].default_value = 0.15
    mats[nombre] = m
    return m

def poner(ob, nombre, plano=True):
    ob.data.materials.append(material(nombre))
    if plano:
        for p in ob.data.polygons:
            p.use_smooth = False
    return ob

def caja(nombre, centro, tam, mat, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=2, location=centro)
    ob = bpy.context.object
    ob.name = nombre
    ob.scale = (tam[0]/2, tam[1]/2, tam[2]/2)
    if rot:
        ob.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=bool(rot), scale=True)
    return poner(ob, mat)

def malla(nombre, verts, caras, mat, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata(verts, [], caras)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(nombre, me)
    ob.location = loc
    bpy.context.collection.objects.link(ob)
    return poner(ob, mat)

# --- el suelo ---
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
piso = bpy.context.object
piso.name = "pasto"
poner(piso, "pasto")

# --- el cuerpo de la casa ---
AN, PR, AL = 4.4, 3.4, 2.6            # ancho, profundidad, alto
caja("paredes", (0, 0, AL/2), (AN, PR, AL), "pared")

# zócalo de piedra
caja("zocalo", (0, 0, 0.18), (AN + .12, PR + .12, .36), "piedra")

# --- el techo a dos aguas: un prisma triangular, hecho a mano ---
VUELO, CUM = 0.42, 1.7                 # cuánto sobresale, altura de la cumbrera
hx, hy = AN/2 + VUELO, PR/2 + VUELO
verts = [
    (-hx, -hy, 0), ( hx, -hy, 0), ( hx,  hy, 0), (-hx,  hy, 0),   # alero
    (-hx,   0, CUM), ( hx,  0, CUM),                              # cumbrera
]
caras = [
    (0, 1, 5, 4),      # faldón de adelante
    (3, 2, 5, 4)[::-1],# faldón de atrás
    (0, 4, 3),         # tímpano izquierdo
    (1, 2, 5),         # tímpano derecho
    (0, 3, 2, 1),      # abajo, para que quede cerrado
]
malla("techo", verts, caras, "techo", loc=(0, 0, AL))

# viga de la cumbrera, apenas asomada
caja("cumbrera", (0, 0, AL + CUM + .03), (AN + VUELO*2 + .1, .16, .16), "madera")

# --- la puerta ---
caja("puerta", (0, -PR/2 - .015, .95), (0.9, .1, 1.9), "puerta")
caja("dintel", (0, -PR/2 - .04, 1.95), (1.15, .12, .14), "madera")
caja("picaporte", (0.3, -PR/2 - .09, .95), (.1, .1, .1), "madera")

# --- las ventanas: marco de madera y vidrio adentro ---
def ventana(x, y, z, ancho=1.0, alto=0.9, eje="y"):
    if eje == "y":
        caja("marco", (x, y, z), (ancho + .18, .1, alto + .18), "madera")
        caja("vidrio", (x, y - .03, z), (ancho, .1, alto), "vidrio")
        caja("parteluz_v", (x, y - .06, z), (.07, .08, alto), "madera")
        caja("parteluz_h", (x, y - .06, z), (ancho, .08, .07), "madera")
    else:
        caja("marco", (x, y, z), (.1, ancho + .18, alto + .18), "madera")
        caja("vidrio", (x - .03, y, z), (.1, ancho, alto), "vidrio")
        caja("parteluz_v", (x - .06, y, z), (.08, .07, alto), "madera")
        caja("parteluz_h", (x - .06, y, z), (.08, ancho, .07), "madera")

ventana(-1.4, -PR/2 - .015, 1.55)
ventana( 1.4, -PR/2 - .015, 1.55)
ventana(-AN/2 - .015, 0.6, 1.55, eje="x")

# --- la chimenea ---
caja("chimenea", (1.35, 0.9, AL + 1.25), (0.6, 0.6, 2.0), "piedra")
caja("remate",   (1.35, 0.9, AL + 2.3),  (0.78, 0.78, 0.18), "piedra")

# --- el camino de entrada ---
for i in range(5):
    caja("baldosa_%d" % i, (0, -PR/2 - 0.75 - i*0.85, 0.03),
         (1.2 - i*0.06, 0.62, 0.06), "camino")

# --- unos árboles ---
def arbol(x, y, escala=1.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.16*escala,
                                        depth=0.9*escala, location=(x, y, 0.45*escala))
    poner(bpy.context.object, "tronco")
    for k, (alto, radio, z) in enumerate([(1.5, 1.0, 1.4), (1.2, 0.75, 2.2), (0.9, 0.5, 2.9)]):
        bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=radio*escala, radius2=0,
                                        depth=alto*escala, location=(x, y, z*escala))
        poner(bpy.context.object, "hoja")

arbol(-4.2,  1.6, 1.15)
arbol( 4.6, -0.4, 0.9)
arbol( 3.9,  3.2, 1.3)

# unas piedritas sueltas, para que el pasto no quede pelado
for x, y, s in [(-2.8, -3.4, .34), (2.9, -2.6, .26), (-3.9, -1.2, .3), (2.2, 4.0, .22)]:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=s, location=(x, y, s*.55))
    poner(bpy.context.object, "piedra")

# --- luz y cámara ---
sol = bpy.data.lights.new("sol", type="SUN")
sol.energy = 3.2
sol.angle = math.radians(3)
obsol = bpy.data.objects.new("sol", sol)
obsol.rotation_euler = (math.radians(52), math.radians(6), math.radians(38))
bpy.context.collection.objects.link(obsol)

relleno = bpy.data.lights.new("relleno", type="AREA")
relleno.energy = 220
relleno.size = 9
obrel = bpy.data.objects.new("relleno", relleno)
obrel.location = (-7, -7, 6)
obrel.rotation_euler = (math.radians(58), 0, math.radians(-42))
bpy.context.collection.objects.link(obrel)

cam = bpy.data.cameras.new("camara")
cam.lens = 46
obcam = bpy.data.objects.new("camara", cam)
obcam.location = (9.5, -10.5, 6.2)
bpy.context.collection.objects.link(obcam)
bpy.context.scene.camera = obcam
# apuntarla al medio de la casa
d = mathutils.Vector((0, 0, 1.9)) - obcam.location
obcam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

# cielo
mundo = bpy.data.worlds.new("cielo")
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.62, 0.85, 1)
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
bpy.context.scene.world = mundo

# --- render ---
esc = bpy.context.scene
esc.render.engine = "CYCLES"
esc.cycles.device = "CPU"
esc.cycles.samples = 160
# este Blender de Debian viene sin OpenImageDenoise, asi que se compensa
# con mas muestras en vez de limpiar el ruido despues
esc.cycles.use_denoising = False
esc.render.resolution_x = 1100
esc.render.resolution_y = 750
esc.render.film_transparent = False
esc.render.filepath = "/home/neko/casita.png"

caras_tot = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
verts_tot = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == "MESH")
print("CASITA: %d objetos, %d caras, %d vertices" % (
    len([o for o in bpy.data.objects if o.type == "MESH"]), caras_tot, verts_tot))

bpy.ops.wm.save_as_mainfile(filepath="/home/neko/casita.blend")
bpy.ops.render.render(write_still=True)
print("CASITA: listo")
