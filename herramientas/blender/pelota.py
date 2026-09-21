# Pelota que rebota — una animacion simple armada por script.
#
# Por que por script y no a mano: igual que casita.py, correrlo dos veces tiene
# que dar exactamente lo mismo. Una animacion hecha a mano en la interfaz no se
# puede versionar ni repetir.
#
# El motor, las muestras y el tamano salen del entorno para poder medir un
# cuadro suelto antes de largar los sesenta: en CPU sin GPU, elegir mal cuesta
# una hora de render.

import bpy, os, math
from mathutils import Vector

# --- elegir la placa -----------------------------------------------------
# Por defecto CPU: es lo que hay en el contenedor de la sesion y es el numero
# contra el que estan medidos los tiempos del LEEME. Con DISPOSITIVO=GPU se
# usa la placa (Colab presta una T4).
#
# La trampa: poner cycles.device = "GPU" NO alcanza. Si en las preferencias no
# hay ninguna placa prendida, Cycles se cae a CPU y renderiza igual, sin avisar
# nada. Hay que prender los aparatos a mano y recien ahi pedir GPU.
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


MOTOR    = os.environ.get("MOTOR", "CYCLES")
MUESTRAS = int(os.environ.get("MUESTRAS", "24"))
ANCHO    = int(os.environ.get("ANCHO", "640"))
ALTO     = int(os.environ.get("ALTO", "360"))
DESDE    = int(os.environ.get("DESDE", "1"))
HASTA    = int(os.environ.get("HASTA", "60"))
SALIDA   = os.environ.get("SALIDA", "/tmp/pelota/")

# --- escena limpia ------------------------------------------------------
# bpy.ops.wm.read_factory_settings borra tambien los datos huerfanos; sin eso
# el cubo por defecto queda en el .blend aunque no se vea.
bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene


def material(nombre, color, rugosidad=0.5, metal=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = rugosidad
    p.inputs["Metallic"].default_value = metal
    return m


# --- piso a cuadros -----------------------------------------------------
# El damero va por nodos y no por textura de archivo: no hay que subir nada y
# el .blend queda autocontenido.
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
piso = bpy.context.object
piso.name = "Piso"
mp = bpy.data.materials.new("PisoDamero")
mp.use_nodes = True
nt = mp.node_tree
tex = nt.nodes.new("ShaderNodeTexChecker")
tex.inputs["Scale"].default_value = 12.0
tex.inputs["Color1"].default_value = (0.82, 0.84, 0.88, 1)
tex.inputs["Color2"].default_value = (0.58, 0.62, 0.70, 1)
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.65
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
piso.data.materials.append(mp)

# --- la pelota ----------------------------------------------------------
R = 0.6
bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=48, ring_count=24,
                                     location=(-5, 0, R))
pelota = bpy.context.object
pelota.name = "Pelota"
bpy.ops.object.shade_smooth()
pelota.data.materials.append(material("Naranja", (0.95, 0.35, 0.10), 0.35))

# El origen se baja al polo sur para que el squash aplaste la pelota CONTRA el
# piso. Con el origen en el centro, escalar en Z la hunde medio radio y la
# pelota atraviesa el suelo justo en el cuadro que mas se mira.
pelota.data.transform(__import__("mathutils").Matrix.Translation((0, 0, R)))
pelota.location.z = 0.0

# --- el rebote ----------------------------------------------------------
# Cuatro rebotes cada vez mas bajos, avanzando en X. Las alturas bajan al 68%:
# un coeficiente de restitucion parejo es lo que hace que se lea como peso.
BOTES  = [2.2, 1.5, 1.02, 0.69]
LARGO  = 15                      # cuadros por rebote
# El recorrido esta acotado a lo que entra DE VERDAD en cuadro. La pelota va en
# y=0 y los conos en y=2.4: al estar mas cerca de la camara, la pelota se abre
# mucho mas hacia los bordes que ellos. Con +-5 la pelota terminaba cortada por
# el borde derecho en los ultimos diez cuadros, aunque el cono de x=3.4 se viera
# entero. Medido contra el cuadro 52, no calculado.
X0, X1 = -3.6, 3.6

def clave(objeto, campo, cuadro, valor, indice=-1, interp="BEZIER", asa=None):
    if campo == "location":
        objeto.location[indice] = valor
    elif campo == "scale":
        objeto.scale = valor
    elif campo == "rotation_euler":
        objeto.rotation_euler[indice] = valor
    objeto.keyframe_insert(campo, index=indice if campo != "scale" else -1,
                           frame=cuadro)
    fc = [f for f in objeto.animation_data.action.fcurves
          if f.data_path == campo and (campo == "scale" or f.array_index == indice)]
    for f in fc:
        for k in f.keyframe_points:
            if abs(k.co[0] - cuadro) < 0.5:
                k.interpolation = interp
                if asa:
                    k.handle_left_type = k.handle_right_type = asa

total = LARGO * len(BOTES)
for i, alto in enumerate(BOTES):
    c_toque = 1 + i * LARGO              # toca el piso
    c_cima  = c_toque + LARGO // 2       # punto mas alto
    c_prox  = c_toque + LARGO            # el toque siguiente

    # Altura. En el toque el asa es VECTOR para que la curva haga pico: una
    # parabola que rebota tiene una esquina ahi, y con asas suaves la pelota
    # parece flotar sobre el piso en vez de golpearlo.
    clave(pelota, "location", c_toque, 0.0, 2, asa="VECTOR")
    clave(pelota, "location", c_cima, alto, 2, asa="AUTO")
    clave(pelota, "location", c_prox, 0.0, 2, asa="VECTOR")

    # Squash: se aplasta justo en el toque y vuelve a lo normal tres cuadros
    # despues. Tres es lo que se banca: mas, y parece de goma blanda.
    clave(pelota, "scale", c_toque - 2, (1.0, 1.0, 1.0))
    clave(pelota, "scale", c_toque, (1.22, 1.22, 0.70))
    clave(pelota, "scale", c_toque + 3, (0.94, 0.94, 1.10))
    clave(pelota, "scale", c_toque + 6, (1.0, 1.0, 1.0))

# Avance en X, parejo, y giro acorde: la pelota da la vuelta que le
# corresponde al camino recorrido, asi no patina.
clave(pelota, "location", 1, X0, 0, interp="LINEAR")
clave(pelota, "location", total + 1, X1, 0, interp="LINEAR")
vueltas = (X1 - X0) / (2 * math.pi * R)
clave(pelota, "rotation_euler", 1, 0.0, 1, interp="LINEAR")
clave(pelota, "rotation_euler", total + 1, vueltas * 2 * math.pi, 1, interp="LINEAR")

# --- tres conos que miran pasar -----------------------------------------
for j, (x, col) in enumerate([(-2.4, (0.15, 0.55, 0.85)),
                              (0.4, (0.25, 0.75, 0.45)),
                              (3.0, (0.90, 0.75, 0.15))]):
    bpy.ops.mesh.primitive_cone_add(radius1=0.45, depth=1.3,
                                    location=(x, 2.4, 0.65), vertices=24)
    c = bpy.context.object
    c.name = f"Cono{j}"
    bpy.ops.object.shade_smooth()
    c.data.materials.append(material(f"Cono{j}", col, 0.45))

# --- luces --------------------------------------------------------------
bpy.ops.object.light_add(type="SUN", location=(4, -6, 9))
sol = bpy.context.object
sol.data.energy = 3.2
sol.data.angle = math.radians(6)       # sombra con un borde apenas blando
sol.rotation_euler = (math.radians(50), 0, math.radians(35))

bpy.ops.object.light_add(type="AREA", location=(-6, -4, 5))
rel = bpy.context.object
rel.data.energy = 150
rel.data.size = 6
rel.rotation_euler = (math.radians(60), 0, math.radians(-50))

mundo = bpy.data.worlds.new("Mundo")
esc.world = mundo
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs["Color"].default_value = (0.42, 0.62, 0.85, 1)
mundo.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45

# --- camara -------------------------------------------------------------
bpy.ops.object.camera_add(location=(0.0, -11.5, 3.4))
cam = bpy.context.object
cam.data.lens = 44
esc.camera = cam
# Apuntar por matematica y no a ojo: la camara mira al centro del recorrido,
# un poco por encima del piso.
d = Vector((0.0, 0.0, 1.1)) - cam.location
cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

# --- render -------------------------------------------------------------
# Blender 4.3 mapea con AgX, que desatura fuerte: el naranja de la pelota salia
# durazno palido. "Punchy" le devuelve la saturacion sin quemar las luces, que
# es lo que pasa con el transform Standard.
esc.view_settings.view_transform = "AgX"
try:
    esc.view_settings.look = "AgX - Punchy"
except TypeError:
    esc.view_settings.look = "Punchy"   # el nombre cambio entre versiones

esc.render.engine = MOTOR
esc.render.resolution_x, esc.render.resolution_y = ANCHO, ALTO
esc.render.resolution_percentage = 100
esc.render.fps = 24
esc.frame_start, esc.frame_end = DESDE, HASTA
esc.render.image_settings.file_format = "PNG"
esc.render.filepath = SALIDA

if MOTOR == "CYCLES":
    esc.cycles.samples = MUESTRAS
    # Este Blender viene SIN OpenImageDenoise: prenderlo no avisa al
    # configurar y revienta recien al renderizar, llevandose el render entero.
    # Esta anotado en LEEME.md y se paga una sola vez.
    esc.cycles.use_denoising = False
    print("PLACA:", elegir_placa(esc))
    esc.cycles.max_bounces = 4
    esc.cycles.use_fast_gi = True

bpy.ops.wm.save_as_mainfile(filepath="/tmp/pelota.blend")
print(f"ESCENA LISTA · {MOTOR} · {MUESTRAS} muestras · {ANCHO}x{ALTO} · "
      f"cuadros {DESDE}-{HASTA} de {total}")

if os.environ.get("RENDERIZAR") == "1":
    bpy.ops.render.render(animation=True)
