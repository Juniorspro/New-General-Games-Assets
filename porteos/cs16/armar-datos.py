#!/usr/bin/env python3
"""Arma los datos de CS 1.6 para la web, en paquetes que se bajan cuando hacen falta.

    python3 -I armar-datos.py JUEGO SALIDA --extras-cs EXTRAS.pk3 [--relevamiento relevamiento.json] [--mapas a,b]

JUEGO: la carpeta del juego instalado (valve/ y cstrike/, con el parche de idioma ya aplicado; si
al lado está reslists/, se usa la lista de precache de CS).
Deja en SALIDA:
  menu-<dir>.pk3.gz     lo que hace falta para el menú (se baja con la intro)
  base-<dir>.pk3.gz     lo común a todas las partidas: sonidos, modelos, sprites y gráficos de CS
                        (se baja mientras se mira el menú)
  mapas/<mapa>.pk3.gz   cada mapa con lo suyo (se baja al elegirlo): bsp, nav, radar, cielo, los
                        sonidos y modelos que nombran sus entidades, y sus texturas
  wads/*.wad.gz         los .wad del sistema (calcomanías, gráficos, fuentes, sprays), sueltos: el
                        motor sólo monta .wad sueltos, al arrancar
  indice.json           qué paquete va en qué carpeta, tamaños y qué necesita cada mapa
  fuera.txt             lo que no va en ningún paquete (lo de Half-Life que CS no usa)

Las texturas: cada mapa nombra varios .wad (halflife.wad pesa 37 MB) y usa unas pocas texturas de
cada uno. Para cada mapa se arma porteo_<mapa>.wad con exactamente las texturas que usa, sacadas de
los .wad originales en el mismo orden en que las busca el motor (del último de la lista al
primero), y maps/<mapa>.ent (el parche de entidades que Xash3D lee en lugar de las del .bsp) con
"wad" apuntando a ese archivo. Lo demás del mapa queda igual. Los .pk3 son zip que el motor monta
solo; los .wad van sin comprimir adentro (el motor lee las texturas salteadas) y el .pk3 entero
viaja con gzip (el navegador lo abre con DecompressionStream).
"""
import argparse
import gzip
import io
import json
import os
import re
import struct
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

DIRS = ('valve', 'cstrike')
# lo que el menú necesita (se mira antes de jugar): configuración, textos, gráficos del menú
MENU = [
    r'^(valve|cstrike)/liblist\.gam$', r'^(valve|cstrike)/[^/]+\.(cfg|scr|lst|rc|txt|vdf|inf|db)$',
    r'^(valve|cstrike)/resource/', r'^(valve|cstrike)/gfx/shell/',
    r'^cstrike/media/gamestartup\.mp3$', r'^(valve|cstrike)/gfx/palette\.lmp$', r'^(valve|cstrike)/logos/',
    r'^cstrike/classes/', r'^(valve|cstrike)/events/',
]
# lo común a las partidas: todo lo de CS (sonidos, modelos, sprites, menús VGUI) y lo de Half-Life
# que CS usa (pasos, armas, escombros, puertas, sprites, las marcas de balas)
BASE = [
    r'^cstrike/(sound|models|sprites)/', r'^cstrike/gfx/vgui/',
    r'^valve/sound/(player|common|debris|items|weapons|buttons|doors|plats)/', r'^valve/sprites/',
]
# Los .wad "del sistema" van sueltos y se bajan antes de arrancar: el motor los monta al iniciar
# buscando .wad sueltos en cada carpeta (uno metido en un .pk3 no lo ve) y en ese momento registra
# las calcomanías (Host_InitDecals: balazos, sangre, sprays). Los de texturas no: cada mapa trae
# el suyo (ver arriba).
SISTEMA_WAD = r'^(valve|cstrike)/(decals|cached|gfx|fonts|spraypaint|tempdecal)\.wad$'
# nunca: el motor y las DLL de Windows, el manual, lo de Half-Life que CS no usa
NUNCA = [
    r'\.(dll|exe|so|dylib|asi|ico|blob|kp|rtf|htm|html|url|gif|bat)$', r'^(valve|cstrike)/(cl_)?dlls/',
    r'^cstrike/manual/', r'^valve/media/', r'^valve/maps/', r'^(valve|cstrike)/reslists/',
    r'^cstrike/[^/]+\.original$', r'^cstrike/(readme|bot_commands)\.',
]

# Las opciones de bots en "Opciones avanzadas" de Crear partida (el diálogo de la copia original las
# tenía en su propia pestaña; el menú de esta versión las arma desde settings.scr)
BOTS_SCR = """
	"bot_quota"
	{
		"Cantidad de bots"
		{ NUMBER 0.000000 31.000000 }
		{ "9.000000" }
	}

	"bot_difficulty"
	{
		"Dificultad de los bots"
		{ LIST "Fácil" "0" "Normal" "1" "Difícil" "2" "Experto" "3" }
		{ "1" }
	}

	"bot_join_team"
	{
		"Los bots juegan en"
		{ LIST "Los dos equipos" "any" "Terroristas" "T" "Antiterroristas" "CT" }
		{ "0" }
	}

	"bot_join_after_player"
	{
		"Los bots esperan a que entre el jugador"
		{ BOOL }
		{ "1" }
	}

	"bot_chatter"
	{
		"Radio de los bots"
		{ LIST "Normal" "normal" "Mínima" "minimal" "Sólo radio" "radio" "Apagada" "off" }
		{ "0" }
	}

	"bot_allow_snipers"
	{
		"Los bots usan francotiradores"
		{ BOOL }
		{ "1" }
	}

	"bot_allow_shield"
	{
		"Los bots usan escudo"
		{ BOOL }
		{ "1" }
	}

"""

# Lo que se aplica cada vez que arranca (index.html: +exec porteo.cfg): cambiar de arma al tocar
# el número (sin confirmar con el disparo), menús VGUI que se tocan con el dedo, sin micrófono,
# sin los controles táctiles propios del motor (la página tiene los suyos), sin el mensaje del día
# (el del juego es HTML, que cs16-client no dibuja: lo mostraba como código encima del menú de
# equipos) y sin callar el sonido cuando el motor cree que perdió el foco (en el teléfono eso pasa
# sin que se salga del juego; al ir de verdad a segundo plano lo calla la página).
PORTEO_CFG = """// porteo web
hud_fastswitch "1"
_vgui_menus "1"
voice_enable "0"
touch_enable "0"
gl_vsync "0"
fps_max "100"
cl_showfps "0"
cl_hide_motd "1"
snd_mute_losefocus "0"
"""


# Las órdenes de radio del panel táctil (comando de CS → frase de titles en cstrike_english.txt): los
# textos salen del juego al armar la entrega (el castellano de la copia), no van en el repo.
RADIO = [
    ('Cstrike_Standard_Radio', [('coverme', 'Cover_me'), ('takepoint', 'You_take_the_point'), ('holdpos', 'Hold_this_position'),
                                ('regroup', 'Regroup_team'), ('followme', 'Follow_me'), ('takingfire', 'Taking_fire')]),
    ('Cstrike_Group_Radio', [('go', 'Go_go_go'), ('fallback', 'Team_fall_back'), ('sticktog', 'Stick_together_team'),
                             ('getinpos', 'Get_in_position_and_wait'), ('stormfront', 'Storm_the_front'), ('report', 'Report_in_team')]),
    ('Cstrike_Report_Radio', [('roger', 'Affirmative'), ('enemyspot', 'Enemy_spotted'), ('needbackup', 'Need_backup'),
                              ('sectorclear', 'Sector_clear'), ('inposition', 'In_position'), ('reportingin', 'Reporting_in'),
                              ('getout', 'Get_out_of_there'), ('negative', 'Negative'), ('enemydown', 'Enemy_down')]),
]


def textos_radio(ruta):
    """{'grupos': [...], 'ordenes': {comando: texto}} desde el cstrike_english.txt del juego (UTF-16)."""
    try:
        crudo = ruta.read_bytes()
        texto = crudo.decode('utf-16') if crudo[:2] in (b'\xff\xfe', b'\xfe\xff') else crudo.decode('utf-8', 'replace')
    except OSError:
        return None
    def buscar(clave):
        m = re.search(r'"%s"\s+"([^"]*)"' % re.escape(clave), texto)
        return m.group(1).strip() if m else None
    grupos, ordenes = [], {}
    for titulo, lista in RADIO:
        grupos.append(buscar(titulo))
        for cmd, clave in lista:
            ordenes[cmd] = buscar('Cstrike_TitlesTXT_' + clave)
    return {'grupos': grupos, 'ordenes': {k: v for k, v in ordenes.items() if v}}


def settings_con_bots(texto):
    """settings.scr con las opciones de bots agregadas antes de la última llave (y "32" en vez de
    "32.000000" jugadores: el campo de Crear partida mostraba "32.")."""
    texto = re.sub(r'("maxplayers"\s*\{\s*"[^"]*"\s*\{[^}]*\}\s*\{\s*")(\d+)\.0+(")', r'\g<1>\g<2>\g<3>', texto)
    fin = texto.rstrip().rfind('}')
    nl = '\r\n' if '\r\n' in texto else '\n'
    return texto[:fin] + BOTS_SCR.replace('\n', nl) + texto[fin:]


# Cloudflare Pages (y otros hostings gratis) no sirven archivos de más de 25 MiB: los paquetes van
# en partes de hasta 20 MiB (sumando los archivos sin comprimir: el .pk3.gz siempre pesa menos)
MAX_PARTE = 20 << 20


def en_partes(archivos, tam):
    """Los archivos en grupos de hasta MAX_PARTE, en orden de ruta."""
    grupos, actual, suma = [], [], 0
    for r in sorted(archivos):
        if actual and suma + tam[r] > MAX_PARTE:
            grupos.append(actual)
            actual, suma = [], 0
        actual.append(r)
        suma += tam[r]
    return grupos + [actual] if actual else grupos or [[]]


def rel_real(raiz, rel):
    """El camino de rel con las mayúsculas reales de lo instalado (Windows no las distingue)."""
    cur = raiz
    partes = []
    for parte in rel.replace('\\', '/').split('/'):
        if not parte:
            continue
        nombres = {n.lower(): n for n in os.listdir(cur)} if os.path.isdir(cur) else {}
        real = nombres.get(parte.lower())
        if real is None:
            return None
        partes.append(real)
        cur = os.path.join(cur, real)
    return '/'.join(partes)


# ── BSP (GoldSrc, versión 30) ─────────────────────────────────────────────────────────────
def leer_bsp(ruta):
    """(texto de las entidades, nombres de las texturas que el mapa no trae adentro)."""
    datos = Path(ruta).read_bytes()
    ver = struct.unpack_from('<i', datos, 0)[0]
    if ver != 30:
        raise ValueError(f'{ruta}: versión de BSP {ver}')
    lumps = [struct.unpack_from('<ii', datos, 4 + i * 8) for i in range(15)]
    eo, el = lumps[0]
    entidades = datos[eo:eo + el].rstrip(b'\0').decode('latin-1')
    to, tl = lumps[2]
    externas = []
    if tl >= 4:
        n = struct.unpack_from('<i', datos, to)[0]
        for i in range(n):
            ofs = struct.unpack_from('<i', datos, to + 4 + i * 4)[0]
            if ofs < 0:
                continue
            p = to + ofs
            nombre = datos[p:p + 16].split(b'\0')[0].decode('latin-1')
            mips0 = struct.unpack_from('<I', datos, p + 24)[0]
            if mips0 == 0 and nombre:
                externas.append(nombre)
    return entidades, externas


def entidades(texto):
    return [{k.lower(): v for k, v in re.findall(r'"([^"]*)"\s*"([^"]*)"', b)} for b in re.findall(r'\{([^{}]*)\}', texto)]


# ── WAD3 ──────────────────────────────────────────────────────────────────────────────────
def leer_wad(ruta):
    """{nombre en minúsculas: (bytes del lump, tipo, compresión, nombre)}"""
    d = Path(ruta).read_bytes()
    if d[:4] not in (b'WAD3', b'WAD2'):
        return {}
    n, ofs = struct.unpack_from('<ii', d, 4)
    out = {}
    for i in range(n):
        pos, disco, tam, tipo, comp = struct.unpack_from('<iiibb', d, ofs + i * 32)
        nombre = d[ofs + i * 32 + 16: ofs + i * 32 + 32].split(b'\0')[0].decode('latin-1')
        out.setdefault(nombre.lower(), (d[pos:pos + disco], tam, tipo, comp, nombre))
    return out


def escribir_wad(lumps):
    """Un WAD3 con los lumps dados [(bytes, tamaño, tipo, compresión, nombre)]."""
    cuerpo = bytearray()
    dire = bytearray()
    pos = 12
    for datos, tam, tipo, comp, nombre in lumps:
        while len(cuerpo) % 4:          # cada lump alineado a 4, como los escribe wadmaker
            cuerpo.append(0)
        ini = 12 + len(cuerpo)
        cuerpo += datos
        dire += struct.pack('<iiibbbb16s', ini, len(datos), tam, tipo, comp, 0, 0, nombre.encode('latin-1')[:15])
    while len(cuerpo) % 4:
        cuerpo.append(0)
    return b'WAD3' + struct.pack('<ii', len(lumps), 12 + len(cuerpo)) + bytes(cuerpo) + bytes(dire)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('juego', type=Path)
    ap.add_argument('salida', type=Path)
    ap.add_argument('--extras-cs', type=Path, required=True, help='extras.pk3 de cs16-client (gráficos del menú)')
    ap.add_argument('--relevamiento', type=Path, help='qué abrió el motor en el menú, en una partida y en cada mapa')
    ap.add_argument('--mapas', help='sólo estos mapas, separados por comas (para la versión de un solo archivo)')
    a = ap.parse_args()
    J = a.juego.resolve()
    S = a.salida.resolve()
    (S / 'mapas').mkdir(parents=True, exist_ok=True)

    todos = {}
    for d in DIRS:
        for p in (J / d).rglob('*'):
            if p.is_file():
                todos[p.relative_to(J).as_posix()] = p.stat().st_size
    re_nunca = [re.compile(x, re.I) for x in NUNCA]
    usable = {r for r in todos if not any(x.search(r) for x in re_nunca)}
    minus = {r.lower(): r for r in usable}

    def buscar(rel, preferido=None):
        """Un archivo nombrado por el juego (sound/x.wav, models/y.mdl...) en cstrike o en valve."""
        rel = rel.replace('\\', '/').lstrip('/')
        for d in ([preferido] if preferido else []) + ['cstrike', 'valve']:
            r = minus.get(f'{d}/{rel}'.lower())
            if r:
                return r
        return None

    menu = {r for r in usable if any(re.search(x, r, re.I) for x in MENU)}
    base = {r for r in usable if any(re.search(x, r, re.I) for x in BASE)} - menu
    sistema = sorted(r for r in usable if re.search(SISTEMA_WAD, r, re.I))

    # lo que el relevamiento vio abrir (rutas con las mayúsculas del disco)
    fases = {}
    if a.relevamiento:
        for r, fs in json.loads(a.relevamiento.read_text()).items():
            rr = rel_real(J, r)
            if rr in usable and not rr.lower().endswith('.wad'):   # los wad se montan todos al arrancar
                fases[rr] = set(fs)
    # lo que el motor abre al arrancar tiene que estar en el menú aunque sea "de las partidas"
    # (sound/sentences.txt: las frases de la radio se leen una sola vez, al iniciar el sonido), y
    # también lo que abre cuando cambia el tamaño de la pantalla ("pantalla": rearma el HUD del
    # cliente, que pide sprites/hud.txt; sin él, "Host Error: Failed to get number_0 sprite index".
    # En el teléfono pasa al entrar en pantalla completa o al girarlo, antes de bajar las partidas)
    al_abrir = lambda fs: 'arranque' in fs or 'pantalla' in fs
    for r, fs in fases.items():
        if al_abrir(fs) and r in base:
            base.discard(r)
            menu.add(r)
    # la lista de precache de CS (reslists): todo lo que una partida de CS puede pedir
    precache = set()
    for lst in (J / 'reslists' / 'Counter-Strike' / 'counter-strike precache.lst',
                J.parent / 'reslists' / 'Counter-Strike' / 'counter-strike precache.lst'):
        if lst.exists():
            for linea in lst.read_text('latin-1').splitlines():
                linea = linea.split(',')[0].strip().replace('\\', '/')
                if '/' in linea:
                    d, resto = linea.split('/', 1)
                    r = buscar(resto, d.lower() if d.lower() in DIRS else None)
                    if r and not r.lower().endswith('.wad'):
                        precache.add(r)
            break

    # ── cada mapa ───────────────────────────────────────────────────────────────────────
    mapas = sorted(Path(r).stem for r in usable if re.match(r'cstrike/maps/[^/]+\.bsp$', r, re.I))
    if a.mapas:
        pedidos = [m.strip().lower() for m in a.mapas.split(',') if m.strip()]
        faltan = [m for m in pedidos if m not in {x.lower() for x in mapas}]
        if faltan:
            raise SystemExit(f'--mapas: el juego no trae {", ".join(faltan)}')
        mapas = [m for m in mapas if m.lower() in pedidos]
    del_mapa = defaultdict(set)
    nombrados = defaultdict(set)      # archivo → mapas cuyas entidades lo nombran
    wads_nuevos, ents_nuevas, titulos = {}, {}, {}
    cache_wad = {}
    for m in mapas:
        bsp = buscar(f'maps/{m}.bsp')
        texto, externas = leer_bsp(J / bsp)
        ents = entidades(texto)
        mundo = ents[0] if ents else {}
        # el título de la lista de Crear partida (el "message" del mapa, en una sola línea)
        titulo = re.sub(r'\s+', ' ', mundo.get('message', '').replace('\\n', ' ')).strip()
        titulos[m] = (titulo or 'Sin título').replace('"', "'")
        for ext in ('bsp', 'nav', 'txt'):
            r = buscar(f'maps/{m}.{ext}')
            if r:
                del_mapa[m].add(r)
        for r in usable:      # el radar: overviews/<mapa>.bmp/.tga/.txt
            if re.match(rf'(cstrike|valve)/overviews/{re.escape(m)}\.', r, re.I):
                del_mapa[m].add(r)
        cielo = mundo.get('skyname')
        if cielo:
            for lado in ('up', 'dn', 'lf', 'rt', 'ft', 'bk'):
                for ext in ('tga', 'bmp'):
                    r = buscar(f'gfx/env/{cielo}{lado}.{ext}')
                    if r:
                        del_mapa[m].add(r)
        # lo que nombran las entidades (ambient_generic, env_sprite, cycler, func_breakable...)
        for e in ents:
            for v in e.values():
                if re.search(r'\.(wav|mdl|spr)$', v, re.I):
                    v = v.lstrip('*!')
                    r = (buscar('sound/' + v) if v.lower().endswith('.wav') and not v.lower().startswith('sound/') else None) or buscar(v)
                    if r:
                        nombrados[r].add(m)
        res = buscar(f'maps/{m}.res')      # lo que el servidor manda a bajar a los clientes
        if res:
            for linea in (J / res).read_text('latin-1').splitlines():
                linea = linea.split('//')[0].strip().strip('"')
                r = buscar(linea) if linea else None
                if r and not r.lower().endswith('.wad'):
                    nombrados[r].add(m)
        # las texturas: un wad propio con las que usa, buscadas como el motor (del último al primero)
        lista = [w.replace('\\', '/').split('/')[-1].strip() for w in (mundo.get('wad') or '').split(';')]
        wads = [buscar(w) for w in lista if w]
        wads = [w for w in wads if w]
        elegidas, faltan = [], []
        for t in dict.fromkeys(x.lower() for x in externas):
            for w in reversed(wads):
                if w not in cache_wad:
                    cache_wad[w] = leer_wad(J / w)
                if t in cache_wad[w]:
                    elegidas.append(cache_wad[w][t])
                    break
            else:
                faltan.append(t)
        wads_nuevos[m] = escribir_wad(elegidas)
        if faltan:
            print(f'{m}: {len(faltan)} texturas que el original tampoco encuentra ({", ".join(faltan[:5])}…)')
        # el parche de entidades: lo mismo, con "wad" apuntando al wad propio
        if re.search(r'"wad"\s*"[^"]*"', texto, re.I):
            nuevo = re.sub(r'("wad"\s*")[^"]*(")', lambda mm: mm.group(1) + f'porteo_{m}.wad' + mm.group(2), texto, count=1, flags=re.I)
        else:
            nuevo = texto.replace('{', '{\n"wad" "porteo_%s.wad"' % m, 1)
        ents_nuevas[m] = nuevo.encode('latin-1')

    # lo nombrado por un solo mapa (y que no es común) va con ese mapa; por varios, a la base
    for r, ms in nombrados.items():
        if r in menu or r in base:
            continue
        if len(ms) == 1:
            del_mapa[next(iter(ms))].add(r)
        else:
            base.add(r)
    for r, fs in fases.items():
        if r in menu or r in base or any(r in del_mapa[m] for m in mapas):
            continue
        solos = fs & set(mapas)
        if al_abrir(fs):
            menu.add(r)
        elif 'partida' in fs or len(solos) >= 2:
            base.add(r)
        elif len(solos) == 1:
            del_mapa[next(iter(solos))].add(r)
    for r in precache:
        if r not in menu and not any(r in del_mapa[m] for m in mapas):
            base.add(r)
    base -= menu
    for m in mapas:
        del_mapa[m] -= menu | base

    # el menú usa los gráficos de cs16-client que el juego no trae; los botones y encabezados con
    # texto en inglés no: así el menú escribe los textos del parche de idioma (en español)
    extras = {}
    with zipfile.ZipFile(a.extras_cs) as z:
        for i in z.infolist():
            n = i.filename
            if i.is_dir() or re.match(r'gfx/shell/(btns_main|head_[^/]+|btn_[^/]+)\.bmp$', n, re.I):
                continue
            if re.match(r'(gfx/shell/|resource/|userconfig\.d/)', n, re.I):
                extras[n] = z.read(n)

    # ── escribir ────────────────────────────────────────────────────────────────────────
    def pk3(nombre, archivos, carpeta, sueltos=None):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            for r in sorted(archivos):
                dentro = r.split('/', 1)[1]
                metodo = zipfile.ZIP_STORED if r.lower().endswith(('.wad', '.mp3')) else zipfile.ZIP_DEFLATED
                z.write(J / r, dentro, compress_type=metodo, compresslevel=9)
            for n, datos in sorted((sueltos or {}).items()):
                metodo = zipfile.ZIP_STORED if n.lower().endswith('.wad') else zipfile.ZIP_DEFLATED
                z.writestr(n, datos, compress_type=metodo, compresslevel=9)
        crudo = buf.getvalue()
        gz = gzip.compress(crudo, 9, mtime=0)
        (S / f'{nombre}.pk3.gz').parent.mkdir(parents=True, exist_ok=True)
        (S / f'{nombre}.pk3.gz').write_bytes(gz)
        return {'archivo': f'{nombre}.pk3.gz', 'carpeta': carpeta, 'pk3': len(crudo), 'gz': len(gz),
                'archivos': len(archivos) + len(sueltos or {})}

    def por_dir(archivos):
        out = {d: set() for d in DIRS}
        for r in archivos:
            out[r.split('/', 1)[0]].add(r)
        return out

    # liblist.gam va suelto (no en un pk3): el motor reconoce cada carpeta de juego por ese
    # archivo antes de montar nada. En cstrike, sin "Training": la copia no trae esos mapas.
    lib = (J / 'cstrike' / 'liblist.gam').read_text('latin-1')
    indice = {'paquetes': {}, 'mapas': {}, 'sueltos': {
        'cstrike/liblist.gam': re.sub(r'(?m)^\s*trainmap\s+"[^"]*"\s*\r?\n', '', lib),
        'valve/liblist.gam': (J / 'valve' / 'liblist.gam').read_text('latin-1'),
    }}
    menu.discard('valve/liblist.gam')
    lista_mapas = ''.join(f'{m} "{titulos[m]}"\n' for m in mapas)
    for nombre, grupo in (('menu', menu), ('base', base)):
        pdir = por_dir(grupo)
        for d in DIRS:
            sueltos = {}
            if nombre == 'menu' and d == 'cstrike':
                sueltos = dict(extras)
                sueltos['porteo_mapas.lst'] = lista_mapas.encode('latin-1')
                sueltos['porteo.cfg'] = PORTEO_CFG.encode('ascii')
                # lo que el castellano del juego no cubre del menú de esta versión (es nuestro)
                sueltos['resource/mainui_english.txt'] = (Path(__file__).parent / 'mainui_castellano.txt').read_bytes()
                pdir[d].discard('cstrike/liblist.gam')
                scr = (J / 'cstrike' / 'settings.scr').read_text('latin-1')
                sueltos['settings.scr'] = settings_con_bots(scr).encode('utf-8')
                pdir[d].discard('cstrike/settings.scr')
            if pdir[d] or sueltos:
                for i, parte in enumerate(en_partes(pdir[d], todos)):
                    clave = f'{nombre}-{d}' + (f'-{i + 1}' if i else '')
                    indice['paquetes'][clave] = pk3(clave, parte, d, sueltos if i == 0 else None)
    for m in mapas:
        pdir = por_dir(del_mapa[m])
        paqs = []
        for i, parte in enumerate(en_partes(pdir['cstrike'], todos)):
            clave = f'mapas/{m}' + (f'-{i + 1}' if i else '')
            indice['paquetes'][clave] = pk3(clave, parte, 'cstrike',
                                            {f'porteo_{m}.wad': wads_nuevos[m], f'maps/{m}.ent': ents_nuevas[m]} if i == 0 else None)
            paqs.append(clave)
        if pdir['valve']:
            for i, parte in enumerate(en_partes(pdir['valve'], todos)):
                clave = f'mapas/{m}-valve' + (f'-{i + 1}' if i else '')
                indice['paquetes'][clave] = pk3(clave, parte, 'valve')
                paqs.append(clave)
        indice['mapas'][m] = {'titulo': titulos[m], 'paquetes': paqs}
    radio = textos_radio(J / 'cstrike' / 'resource' / 'cstrike_english.txt')
    if radio:
        indice['radio'] = radio
    indice['inicio'] = [k for k in indice['paquetes'] if k.startswith('menu-')]
    indice['partida'] = [k for k in indice['paquetes'] if k.startswith('base-')]
    # los .wad del sistema, sueltos (cada uno con gzip): la página los escribe antes de arrancar
    indice['wads'] = []
    for r in sistema:
        gzw = gzip.compress((J / r).read_bytes(), 9, mtime=0)
        archivo = 'wads/' + r.replace('/', '-').lower() + '.gz'
        (S / archivo).parent.mkdir(parents=True, exist_ok=True)
        (S / archivo).write_bytes(gzw)
        d, nombre = r.split('/', 1)
        indice['wads'].append({'ruta': f'{d}/{nombre.lower()}', 'archivo': archivo, 'gz': len(gzw)})
    (S / 'indice.json').write_text(json.dumps(indice, ensure_ascii=False, indent=1), 'utf-8')

    mb = lambda n: f'{n / 1048576:.1f} MB'
    gz = lambda ks: sum(indice['paquetes'][k]['gz'] for k in ks)
    mapas_gz = [gz(indice['mapas'][m]['paquetes']) for m in mapas]
    print(f"menú {mb(gz(indice['inicio']) + sum(w['gz'] for w in indice['wads']))}, base {mb(gz(indice['partida']))}, {len(mapas)} mapas "
          f"{mb(sum(mapas_gz))} (de {mb(min(mapas_gz))} a {mb(max(mapas_gz))}); "
          f"total {mb(gz(indice['paquetes']))} (el juego instalado: {mb(sum(todos.values()))})")
    fuera = usable - menu - base - set(sistema) - set().union(*del_mapa.values())
    fuera_wad = {r for r in fuera if r.lower().endswith('.wad')}
    print(f'fuera de los paquetes: {len(fuera)} archivos, {mb(sum(todos[r] for r in fuera))} '
          f'({len(fuera_wad)} .wad reemplazados por los wad de cada mapa; el resto, de Half-Life sin uso en CS)')
    (S / 'fuera.txt').write_text('\n'.join(sorted(fuera)) + '\n', 'utf-8')


if __name__ == '__main__':
    sys.exit(main())
