# La JX-1: una consola portátil de JXSTUDIOS armada por código en Blender,
# con su pantallita animada y la cámara de 13 segundos.
#
#   blender -b --factory-startup -P escena.py -- <modo> <lcd> <salida> [cuadros]
#     modo: vista (chiquito, CPU, para mirar) · final (1080x1920, GPU) · rapido (720x1280) ·
#           foto (un cuadro grande) · blend (solo guarda el .blend)
#     lcd: la carpeta de pantalla.py (lcd_0001.png… y eventos.json)
#
# El diseño es propio: retrato, pantalla arriba, cruz y dos botones (lo que
# tienen todas las portátiles de bolsillo), con colores, formas y marca nuestros.
# Se modela en centímetros dentro de un vacío escalado a 0,01: la cámara, las
# luces y el foco quedan en metros de verdad (y la profundidad de campo es la
# de una foto macro).
import bpy, bmesh, json, math, os, random, sys

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODO = args[0] if args else 'vista'
LCD = os.path.abspath(args[1]) if len(args) > 1 else os.path.abspath('lcd')
SALIDA = os.path.abspath(args[2]) if len(args) > 2 else os.path.abspath('salida')
CUADROS = [int(x) for x in args[3].split(',')] if len(args) > 3 else []
EV = json.load(open(os.path.join(LCD, 'eventos.json')))
FIN = 312

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
esc.frame_start, esc.frame_end = 1, FIN
esc.render.fps = 24
col = esc.collection

# ── materiales ─────────────────────────────────────────────────────────────
def material(nombre, color, rugoso=0.4, capa=0.0, emite=None, fuerza=0.0, metal=0.0, grano=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    n = m.node_tree.nodes
    b = n['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rugoso
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = capa
    b.inputs['Coat Roughness'].default_value = 0.12
    if emite:
        b.inputs['Emission Color'].default_value = (*emite, 1)
        b.inputs['Emission Strength'].default_value = fuerza
    if grano:
        # el plástico inyectado tiene un granito mate: ruido fino al relieve
        ruido = n.new('ShaderNodeTexNoise'); ruido.inputs['Scale'].default_value = 900
        rel = n.new('ShaderNodeBump'); rel.inputs['Strength'].default_value = grano
        m.node_tree.links.new(ruido.outputs['Fac'], rel.inputs['Height'])
        m.node_tree.links.new(rel.outputs['Normal'], b.inputs['Normal'])
    return m

CREMA = material('crema', (0.58, 0.50, 0.38), 0.42, 0.08, grano=0.06)
CARBON = material('carbón', (0.035, 0.038, 0.048), 0.35, 0.25, grano=0.03)
CORAL = material('coral', (0.90, 0.22, 0.14), 0.28, 0.4)
GOMA = material('goma', (0.20, 0.21, 0.24), 0.75)
HUECO = material('hueco', (0.42, 0.37, 0.30), 0.55)
TINTA = material('tinta', (0.06, 0.07, 0.09), 0.5)
TEAL = material('teal', (0.05, 0.55, 0.50), 0.35)
CARTU = material('cartucho', (0.16, 0.17, 0.20), 0.45, 0.1, grano=0.04)
LED = material('led', (0.25, 0.02, 0.01), 0.3, emite=(1.0, 0.06, 0.02), fuerza=0.0)

def pantalla_material():
    """La pantalla: la secuencia de 160x144 sin suavizar, con la grilla de
    pixeles de un LCD y un vidrio brillante encima (la capa)."""
    m = bpy.data.materials.new('pantalla')
    m.use_nodes = True
    nt = m.node_tree; n = nt.nodes; L = nt.links.new
    b = n['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.32, 0.36, 0.25, 1)   # apagada: verde gris
    b.inputs['Roughness'].default_value = 0.55
    b.inputs['Coat Weight'].default_value = 1.0
    b.inputs['Coat Roughness'].default_value = 0.03
    img = bpy.data.images.load(os.path.join(LCD, 'lcd_0001.png'))
    img.source = 'SEQUENCE'
    tex = n.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Closest'
    tex.image_user.frame_duration = FIN; tex.image_user.frame_start = 1
    tex.image_user.frame_offset = 0; tex.image_user.use_auto_refresh = True
    uv = n.new('ShaderNodeTexCoord')
    L(uv.outputs['UV'], tex.inputs['Vector'])
    # grilla: distancia al centro de cada pixel, en x y en y
    esc_uv = n.new('ShaderNodeVectorMath'); esc_uv.operation = 'MULTIPLY'
    esc_uv.inputs[1].default_value = (160, 144, 1)
    L(uv.outputs['UV'], esc_uv.inputs[0])
    sep = n.new('ShaderNodeSeparateXYZ'); L(esc_uv.outputs['Vector'], sep.inputs['Vector'])
    def borde(salida):
        fr = n.new('ShaderNodeMath'); fr.operation = 'FRACT'; L(salida, fr.inputs[0])
        d = n.new('ShaderNodeMath'); d.operation = 'SUBTRACT'; L(fr.outputs[0], d.inputs[0]); d.inputs[1].default_value = 0.5
        a = n.new('ShaderNodeMath'); a.operation = 'ABSOLUTE'; L(d.outputs[0], a.inputs[0])
        s = n.new('ShaderNodeMapRange'); s.interpolation_type = 'SMOOTHSTEP'
        s.inputs['From Min'].default_value = 0.36; s.inputs['From Max'].default_value = 0.5
        s.inputs['To Min'].default_value = 1.0; s.inputs['To Max'].default_value = 0.0
        L(a.outputs[0], s.inputs['Value'])
        return s.outputs['Result']
    mx = n.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'
    L(borde(sep.outputs['X']), mx.inputs[0]); L(borde(sep.outputs['Y']), mx.inputs[1])
    mezcla = n.new('ShaderNodeMapRange')
    mezcla.inputs['To Min'].default_value = 0.72; mezcla.inputs['To Max'].default_value = 1.0
    L(mx.outputs[0], mezcla.inputs['Value'])
    # color por grilla (el nodo Mix tiene varias entradas que se llaman A: VectorMath no)
    tinte = n.new('ShaderNodeVectorMath'); tinte.operation = 'SCALE'
    L(tex.outputs['Color'], tinte.inputs[0])
    L(mezcla.outputs['Result'], tinte.inputs['Scale'])
    L(tinte.outputs['Vector'], b.inputs['Emission Color'])
    fuerza = b.inputs['Emission Strength']
    fuerza.default_value = 0.0
    fuerza.keyframe_insert('default_value', frame=EV['encendido'])
    fuerza.default_value = 0.85
    fuerza.keyframe_insert('default_value', frame=EV['encendido'] + 3)
    return m

PANTALLA = pantalla_material()

# ── piezas ────────────────────────────────────────────────────────────────
raiz = bpy.data.objects.new('JX-1', None)
col.objects.link(raiz)
raiz.scale = (0.01, 0.01, 0.01)

def contorno(w, h, radios, pasos=14):
    """Rectángulo redondeado en el plano XZ, centrado: radios (ai, ad, sd, si)."""
    ai, ad, sd, si = radios
    esquinas = [(-w / 2 + ai, -h / 2 + ai, ai, math.pi), (w / 2 - ad, -h / 2 + ad, ad, 1.5 * math.pi),
                (w / 2 - sd, h / 2 - sd, sd, 0.0), (-w / 2 + si, h / 2 - si, si, 0.5 * math.pi)]
    pts = []
    for (cx, cz, r, a0) in esquinas:
        for k in range(pasos + 1):
            a = a0 + (math.pi / 2) * k / pasos
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts

def prisma(nombre, pts, prof, y0=0.0, mat=None, bisel=0.0, seg=5, padre=None, loc=(0, 0, 0)):
    """Un perfil en XZ estirado en Y desde y0 hacia +Y (adentro) por prof."""
    me = bpy.data.meshes.new(nombre)
    bm = bmesh.new()
    fr = [bm.verts.new((x, y0, z)) for (x, z) in pts]
    at = [bm.verts.new((x, y0 + prof, z)) for (x, z) in pts]
    bm.faces.new(fr)
    bm.faces.new(list(reversed(at)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([fr[j], fr[i], at[i], at[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(nombre, me)
    col.objects.link(ob)
    ob.parent = padre or raiz
    ob.location = loc
    if mat: me.materials.append(mat)
    if bisel:
        b = ob.modifiers.new('bisel', 'BEVEL'); b.width = bisel; b.segments = seg
        b.limit_method = 'ANGLE'; b.angle_limit = math.radians(40); b.harden_normals = True
        ob.modifiers.new('normales', 'WEIGHTED_NORMAL').keep_sharp = True
    return ob

def cilindro(nombre, r, prof, loc, mat, bisel=0.0, padre=None, pasos=48):
    pts = [(r * math.cos(2 * math.pi * k / pasos), r * math.sin(2 * math.pi * k / pasos)) for k in range(pasos)]
    return prisma(nombre, pts, prof, 0.0, mat, bisel, 4, padre, loc)

def texto(nombre, cuerpo, tam, loc, mat, extr=0.01, ladeo=0.0, alin='CENTER', padre=None, giro=0.0):
    cu = bpy.data.curves.new(nombre, 'FONT'); cu.body = cuerpo; cu.size = tam
    cu.extrude = extr; cu.shear = ladeo; cu.align_x = alin; cu.align_y = 'CENTER'
    cu.bevel_depth = extr * 0.4
    ob = bpy.data.objects.new(nombre, cu); col.objects.link(ob)
    ob.parent = padre or raiz
    ob.location = loc
    ob.rotation_euler = (math.radians(90), giro, 0)    # el texto mira hacia -Y (al frente)
    cu.materials.append(mat)
    return ob

W, H, P = 9.4, 15.0, 3.0
FRENTE = -P / 2
cuerpo = prisma('cuerpo', contorno(W, H, (2.2, 2.2, 0.9, 0.9)), P, FRENTE, CREMA, 0.42, 6)
# los agujeros del parlante: una rueda de agujeritos abajo a la derecha
cortes = bpy.data.collections.new('cortes'); esc.collection.children.link(cortes)
agujeros = [(0, 0)] + [(0.55 * math.cos(a), 0.55 * math.sin(a)) for a in [k * math.pi / 3 for k in range(6)]] \
    + [(1.05 * math.cos(a), 1.05 * math.sin(a)) for a in [k * math.pi / 6 for k in range(12)]]
for k, (dx, dz) in enumerate(agujeros):
    c = cilindro(f'agujero{k}', 0.14, 1.0, (2.95 + dx, FRENTE - 0.5, -5.25 + dz), None, pasos=20)
    for o in list(c.users_collection): o.objects.unlink(c)
    cortes.objects.link(c); c.hide_render = True; c.display_type = 'WIRE'
bo = cuerpo.modifiers.new('parlante', 'BOOLEAN'); bo.operation = 'DIFFERENCE'
bo.operand_type = 'COLLECTION'; bo.collection = cortes; bo.solver = 'EXACT'
# los agujeros van después del bisel: con el bisel encima se deformaban
cuerpo.modifiers.move(cuerpo.modifiers.find('parlante'), 1)
# y se cortan UNA vez: como modificador se recalculaba en cada cuadro (y varias
# veces por cuadro con el desenfoque de movimiento), porque los cortes se mueven
# con la consola. En Kaggle la animación pasó la hora y media por eso.
dg = bpy.context.evaluated_depsgraph_get()
malla = bpy.data.meshes.new_from_object(cuerpo.evaluated_get(dg))
cuerpo.modifiers.clear(); cuerpo.data = malla
for c in list(cortes.objects): bpy.data.objects.remove(c)
bpy.data.collections.remove(cortes)

# el marco de la pantalla y la pantalla
marco = prisma('marco', contorno(8.0, 6.5, (1.2, 1.2, 0.55, 0.55)), 0.08, FRENTE - 0.06, CARBON, 0.03, 3, loc=(0, 0, 3.72))
pantalla = bpy.data.objects.new('pantalla', bpy.data.meshes.new('pantalla'))
bm = bmesh.new()
ancho, alto = 5.2, 5.2 * 144 / 160
for (x, z) in [(-ancho / 2, -alto / 2), (ancho / 2, -alto / 2), (ancho / 2, alto / 2), (-ancho / 2, alto / 2)]:
    bm.verts.new((x, 0, z))
cara = bm.faces.new(list(bm.verts))
uvl = bm.loops.layers.uv.new('UVMap')
for loop in cara.loops:
    v = loop.vert.co
    loop[uvl].uv = ((v.x + ancho / 2) / ancho, (v.z + alto / 2) / alto)
bm.normal_update()
bm.to_mesh(pantalla.data); bm.free()
pantalla.data.materials.append(PANTALLA)
col.objects.link(pantalla); pantalla.parent = raiz
pantalla.location = (0.35, FRENTE - 0.065, 3.62)
# que mire al frente (-Y)
if pantalla.data.polygons[0].normal.y > 0:
    pantalla.data.flip_normals()
# rayitas de color arriba del marco y el nombre del modelo
for k, (m, z) in enumerate([(CORAL, 6.62), (TEAL, 6.47)]):
    prisma(f'raya{k}', contorno(5.4, 0.07, (0.03,) * 4, 2), 0.01, FRENTE - 0.075, m, loc=(-0.85, 0, z))
texto('modelo', 'JX-1', 0.32, (2.85, FRENTE - 0.08, 6.55), CORAL, 0.005, 0.15)
led = cilindro('led', 0.14, 0.05, (-3.3, FRENTE - 0.08, 4.2), LED, 0.02)
texto('power', 'POWER', 0.2, (-3.3, FRENTE - 0.08, 3.75), material('gris', (0.5, 0.5, 0.55), 0.5), 0.003)
# la marca
texto('marca', 'JXSTUDIOS', 0.66, (0.0, FRENTE - 0.005, -0.42), TINTA, 0.012, 0.2)

# la cruz, con su hueco
hueco_cruz = cilindro('hueco_cruz', 1.55, 0.02, (-2.45, FRENTE - 0.005, -2.75), HUECO)
L_, A_ = 1.38, 0.43
cruz_pts = [(-A_, -L_), (A_, -L_), (A_, -A_), (L_, -A_), (L_, A_), (A_, A_), (A_, L_), (-A_, L_), (-A_, A_), (-L_, A_), (-L_, -A_), (-A_, -A_)]
pivote_cruz = bpy.data.objects.new('pivote_cruz', None); col.objects.link(pivote_cruz)
pivote_cruz.parent = raiz; pivote_cruz.location = (-2.45, FRENTE, -2.75)
cruz = prisma('cruz', cruz_pts, 0.42, -0.36, CARBON, 0.07, 3, padre=pivote_cruz)
# A y B, en diagonal
botones = {}
for nombre, (x, z) in {'B': (1.55, -3.15), 'A': (3.3, -2.35)}.items():
    cilindro(f'hueco_{nombre}', 0.78, 0.02, (x, FRENTE - 0.005, z), HUECO)
    piv = bpy.data.objects.new(f'pivote_{nombre}', None); col.objects.link(piv)
    piv.parent = raiz; piv.location = (x, FRENTE, z)
    cilindro(f'boton_{nombre}', 0.62, 0.4, (0, -0.33, 0), CORAL, 0.16, padre=piv)
    texto(f'letra_{nombre}', nombre, 0.34, (x + 0.05, FRENTE - 0.005, z - 1.05), TINTA, 0.006, 0.15)
    botones[nombre] = piv
# SELECT y START: pastillas de goma inclinadas
for nombre, x in (('SELECT', -0.85), ('START', 0.75)):
    piv = bpy.data.objects.new(f'pivote_{nombre}', None); col.objects.link(piv)
    piv.parent = raiz; piv.location = (x, FRENTE, -5.35); piv.rotation_euler = (0, math.radians(-25), 0)
    prisma(f'boton_{nombre}', contorno(1.25, 0.36, (0.18,) * 4, 6), 0.3, -0.2, GOMA, 0.06, 3, padre=piv)
    texto(f'texto_{nombre}', nombre, 0.2, (x - 0.1, FRENTE - 0.005, -5.95), TINTA, 0.003, 0.15, giro=math.radians(-25))
    botones[nombre] = piv
# arriba: la ranura del interruptor y el cartucho de Grumo asomando atrás
prisma('ranura', contorno(1.9, 0.5, (0.2,) * 4, 4), 0.4, -0.2, HUECO, loc=(-2.8, -0.75, 7.5)).rotation_euler = (math.radians(90), 0, 0)
interruptor = prisma('interruptor', contorno(0.7, 0.45, (0.12,) * 4, 4), 0.35, -0.2, CARBON, 0.05, 3, loc=(-3.3, -0.75, 7.62))
interruptor.rotation_euler = (math.radians(90), 0, 0)
cartucho = prisma('cartucho', contorno(6.0, 2.4, (0.25,) * 4, 6), 1.0, 0.35, CARTU, 0.08, 3, loc=(0, 0, 7.6))
etiqueta = prisma('etiqueta', contorno(4.4, 0.9, (0.12,) * 4, 4), 0.01, 1.355, CORAL, loc=(0, 0, 8.2))
t = texto('etiqueta_texto', 'GRUMO', 0.5, (0, 1.37, 8.2), TINTA, 0.004, 0.12)
t.rotation_euler = (math.radians(90), 0, math.radians(180))   # el de atrás mira hacia +Y

# ── animación de la consola ────────────────────────────────────────────────
def clave(ob, prop, f, valor):
    setattr(ob, prop, valor); ob.keyframe_insert(prop, frame=f)

# flota y gira de a poco
for f, rz in ((1, 24), (70, 7), (140, 4), (150, -7), (255, 6), (FIN, -16)):
    clave(raiz, 'rotation_euler', f, (0, 0, math.radians(rz)))
for f in range(1, FIN + 1, 12):
    clave(raiz, 'location', f, (0, 0, 0.004 * math.sin(2 * math.pi * f / 96)))
# el interruptor y la luz
clave(interruptor, 'location', EV['encendido'] - 1, (-3.3, -0.75, 7.62))
clave(interruptor, 'location', EV['encendido'] + 2, (-2.3, -0.75, 7.62))
ledf = LED.node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
ledf.default_value = 0; ledf.keyframe_insert('default_value', frame=EV['encendido'])
ledf.default_value = 25; ledf.keyframe_insert('default_value', frame=EV['encendido'] + 2)

def apretar(piv, f, hondo=0.14, dur=4):
    base = tuple(piv.location)
    clave(piv, 'location', f - 2, base)
    clave(piv, 'location', f, (base[0], base[1] + hondo, base[2]))
    clave(piv, 'location', f + dur, (base[0], base[1] + hondo, base[2]))
    clave(piv, 'location', f + dur + 2, base)

for s in EV['saltos']:
    apretar(botones['A'], s)
apretar(botones['START'], EV['start'], 0.1)
# la cruz apretada a la derecha mientras Grumo corre (gira sobre su eje vertical)
for f, a in ((EV['juego'] - 2, 0), (EV['juego'] + 1, 6), (EV['puerta'] - 1, 6), (EV['puerta'] + 2, 0)):
    clave(pivote_cruz, 'rotation_euler', f, (0, 0, math.radians(a)))

# ── el estudio: piso curvo, luces de colores y pixeles flotando ────────────
def ciclorama():
    me = bpy.data.meshes.new('ciclorama'); bm = bmesh.new()
    perfil = [(-3.0, -0.115), (0.35, -0.115)]
    for k in range(1, 17):
        a = -math.pi / 2 + (math.pi / 2) * k / 16
        perfil.append((0.35 + 0.6 * math.cos(a), 0.485 + 0.6 * math.sin(a)))
    perfil.append((0.95, 3.0))
    filas = [[bm.verts.new((x, y, z)) for (y, z) in perfil] for x in (-3.0, 3.0)]
    for i in range(len(perfil) - 1):
        bm.faces.new([filas[0][i], filas[1][i], filas[1][i + 1], filas[0][i + 1]])
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new('ciclorama', me); col.objects.link(ob)
    me.materials.append(material('fondo', (0.035, 0.03, 0.07), 0.55))
    return ob
ciclorama()

mira = bpy.data.objects.new('mira', None); col.objects.link(mira)

def luz(nombre, loc, potencia, color, tam, hacia=None):
    l = bpy.data.lights.new(nombre, 'AREA'); l.energy = potencia; l.color = color; l.size = tam
    ob = bpy.data.objects.new(nombre, l); col.objects.link(ob); ob.location = loc
    t = ob.constraints.new('TRACK_TO'); t.target = hacia or mira
    t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
    return ob

clave_luz = luz('clave', (-0.34, -0.42, 0.36), 0, (1.0, 0.95, 0.88), 0.35)
for f, e in ((1, 3.5), (34, 3.5), (58, 17)):   # arranca en penumbra y se prende
    clave_luz.data.energy = e; clave_luz.data.keyframe_insert('energy', frame=f)
luz('contra_teal', (0.36, 0.34, 0.20), 24, (0.25, 0.92, 0.85), 0.25)
luz('contra_coral', (-0.36, 0.30, -0.04), 22, (1.0, 0.33, 0.42), 0.25)
luz('relleno', (0.30, -0.62, -0.06), 2.5, (0.85, 0.9, 1.0), 0.8)
pared = bpy.data.objects.new('pared', None); col.objects.link(pared); pared.location = (0, 1.2, 0.1)
luz('halo', (0, 0.25, -0.04), 14, (0.30, 0.75, 0.70), 0.3, pared)

PALETA = [(0.77, 0.88, 0.63), (0.47, 0.66, 0.44), (0.19, 0.36, 0.29), (0.9, 0.22, 0.14)]
azar = random.Random(11)
for k in range(70):
    m = material(f'pixel{k}', (0.1, 0.1, 0.1), 0.5, emite=azar.choice(PALETA), fuerza=azar.uniform(2, 7))
    me = bpy.data.meshes.new(f'pixel{k}'); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=azar.uniform(0.003, 0.007)); bm.to_mesh(me); bm.free()
    me.materials.append(m)
    ob = bpy.data.objects.new(f'pixel{k}', me); col.objects.link(ob)
    x, y, z = azar.uniform(-0.42, 0.42), azar.uniform(0.04, 0.65), azar.uniform(-0.1, 0.38)
    clave(ob, 'location', 1, (x, y, z))
    clave(ob, 'location', FIN, (x + azar.uniform(-0.02, 0.02), y, z + azar.uniform(0.04, 0.09)))
    clave(ob, 'rotation_euler', 1, (azar.uniform(0, 6), azar.uniform(0, 6), 0))
    clave(ob, 'rotation_euler', FIN, (azar.uniform(0, 6), azar.uniform(0, 6), 3))
    try:
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    except Exception:
        pass

# ── la cámara ──────────────────────────────────────────────────────────────
cam_d = bpy.data.cameras.new('cámara'); cam_d.lens = 50; cam_d.sensor_fit = 'AUTO'
cam_d.dof.use_dof = True
cam = bpy.data.objects.new('cámara', cam_d); col.objects.link(cam); esc.camera = cam
foco = bpy.data.objects.new('foco', None); col.objects.link(foco); foco.parent = raiz
cam_d.dof.focus_object = foco
t = cam.constraints.new('TRACK_TO'); t.target = foco; t.track_axis = 'TRACK_NEGATIVE_Z'; t.up_axis = 'UP_Y'
TOMAS = [  # cuadro, cámara (m, en el mundo), foco (cm, en la consola), diafragma
    (1, (-0.040, -0.115, -0.062), (-2.45, -1.7, -2.7), 2.6),
    (48, (0.032, -0.108, -0.052), (2.6, -1.7, -2.7), 2.8),
    (74, (0.010, -0.150, 0.040), (0.35, -1.6, 3.6), 3.2),
    (126, (-0.006, -0.168, 0.036), (0.35, -1.6, 3.6), 3.5),
    (146, (-0.105, -0.285, 0.022), (0.0, -1.6, 1.2), 5.6),
    (252, (0.095, -0.295, 0.012), (0.0, -1.6, 0.8), 5.6),
    (FIN, (0.160, -0.360, 0.060), (0.0, 0.0, 0.2), 6.3),
]
for f, c, o, fs in TOMAS:
    clave(cam, 'location', f, c); clave(foco, 'location', f, o)
    cam_d.dof.aperture_fstop = fs; cam_d.dof.keyframe_insert('aperture_fstop', frame=f)

# ── render ─────────────────────────────────────────────────────────────────
esc.render.engine = 'CYCLES'
cy = esc.cycles
cy.use_adaptive_sampling = True; cy.adaptive_threshold = 0.015
cy.max_bounces = 8; cy.sample_clamp_indirect = 6
cy.use_denoising = True
esc.render.use_motion_blur = True; esc.render.motion_blur_shutter = 0.45
esc.render.film_transparent = False
esc.world = bpy.data.worlds.new('mundo'); esc.world.use_nodes = True
esc.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.006, 0.006, 0.012, 1)
try:
    esc.view_settings.view_transform = 'AgX'
    esc.view_settings.look = 'AgX - Punchy'
    esc.view_settings.exposure = -0.2
except Exception as e:
    print('color:', e)

def usar_gpu():
    pr = bpy.context.preferences.addons['cycles'].preferences
    for tipo in ('OPTIX', 'CUDA'):
        try:
            pr.compute_device_type = tipo; pr.get_devices()
            gpus = [d for d in pr.devices if d.type == tipo]
            if gpus:
                for d in pr.devices: d.use = d.type == tipo
                esc.cycles.device = 'GPU'
                print('GPU:', tipo, [d.name for d in gpus]); return True
        except Exception as e:
            print('sin', tipo, e)
    return False

def limpieza():
    # en Kaggle el limpiador OptiX no arranca ("Failed to create OptiX denoiser")
    # y deja el cuadro negro: se usa OpenImageDenoise, en la GPU o en la CPU, o
    # ninguno (con el doble de muestras). Lo elige el notebook con JX_LIMPIEZA.
    modo = os.environ.get('JX_LIMPIEZA', 'gpu')
    if modo == 'no':
        cy.use_denoising = False; cy.samples *= 2
    else:
        cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
        try: cy.denoising_use_gpu = modo == 'gpu'
        except Exception as e: print('limpieza:', e)
    print('limpieza:', modo)

def resplandor():
    # que la pantalla, la luz y los pixeles brillen un poco (como en cámara)
    try:
        esc.use_nodes = True
        nt = esc.node_tree
        rl, comp = nt.nodes['Render Layers'], nt.nodes['Composite']
        g = nt.nodes.new('CompositorNodeGlare')
        for nombre, val in (('glare_type', 'BLOOM'), ('quality', 'HIGH')):
            try: setattr(g, nombre, val)
            except Exception: pass
        for nombre, val in (('threshold', 1.2), ('mix', -0.6), ('size', 7)):
            try: setattr(g, nombre, val)
            except Exception: pass
        for nombre, val in (('Threshold', 1.6), ('Strength', 0.12), ('Size', 0.5)):
            if nombre in g.inputs: g.inputs[nombre].default_value = val
        nt.links.new(rl.outputs['Image'], g.inputs['Image'])
        nt.links.new(g.outputs['Image'], comp.inputs['Image'])
    except Exception as e:
        print('resplandor:', e)

os.makedirs(SALIDA, exist_ok=True)
if MODO == 'vista':
    esc.render.resolution_x, esc.render.resolution_y = 270, 480
    cy.samples = 24; cy.device = 'CPU'
    resplandor()
    for f in CUADROS or [20, 60, 110, 175, 230, 300]:
        esc.frame_set(f)
        esc.render.filepath = os.path.join(SALIDA, f'vista_{f:04d}.png')
        bpy.ops.render.render(write_still=True)
elif MODO == 'prueba':
    esc.render.resolution_x, esc.render.resolution_y = 540, 960
    cy.samples = 48
    usar_gpu(); limpieza(); resplandor()
    esc.frame_set(CUADROS[0] if CUADROS else 175)
    esc.render.filepath = os.path.join(SALIDA, 'prueba.png')
    bpy.ops.render.render(write_still=True)
elif MODO in ('final', 'rapido'):
    # rapido: 720x1280 y la mitad de muestras, para cuando hay apuro
    esc.render.resolution_x, esc.render.resolution_y = (1080, 1920) if MODO == 'final' else (720, 1280)
    cy.samples = 128 if MODO == 'final' else 64
    usar_gpu(); limpieza(); resplandor()
    esc.render.image_settings.file_format = 'PNG'
    esc.render.filepath = os.path.join(SALIDA, 'cuadro_')
    if CUADROS:
        esc.frame_start, esc.frame_end = CUADROS[0], CUADROS[-1]
    bpy.ops.render.render(animation=True)
elif MODO == 'foto':
    esc.render.resolution_x, esc.render.resolution_y = 2160, 3840
    cy.samples = 384
    usar_gpu(); limpieza(); resplandor()
    esc.frame_set(CUADROS[0] if CUADROS else 300)
    esc.render.filepath = os.path.join(SALIDA, 'jx1_foto.png')
    bpy.ops.render.render(write_still=True)
# siempre queda el .blend para abrirlo en Blender
try:
    bpy.ops.file.make_paths_relative()
except Exception as e:
    print('rutas:', e)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SALIDA, 'jx1.blend'), compress=True)
print('LISTO', MODO)
