#!/usr/bin/env python3
"""Half-Life: los datos de las copias del dueño en paquetes que se bajan cuando hacen falta.

    python3 armar-datos.py JUEGO SALIDA --relevamiento relevamiento.json [--mapas c0a0,c0a0a,...]

JUEGO tiene valve/ (la base, en inglés) y valve_spanish/ (lo que cambia en español latino), como
los deja portear.sh al juntar las dos copias. Escribe en SALIDA:

  menu-valve.pk3.gz           lo que el motor abre al arrancar, en el menú y al cambiar el tamaño de la pantalla
  idioma-en / idioma-es       los textos de cada idioma (con el menú; sólo se baja el elegido)
  voces-en / voces-es         las voces de cada idioma (mientras se mira el menú)
  sonidos-valve               los sonidos que el juego toca sin avisar antes (las frases del traje, los
                              anuncios, lo que dicen los guardias y los científicos que no cambia con el idioma)
  base-valve[-N]              lo común a las partidas: armas, el HUD, modelos y sonidos de varios mapas,
                              las texturas que usan dos mapas o más (porteo_texturas.wad)
  mapas/<mapa>                cada mapa con lo suyo (y sus texturas propias: porteo_<mapa>.wad)
  musica/<pista>              cada pista (media/Half-LifeNN.mp3), la primera vez que un mapa la pide
  wads/*.wad.gz               los .wad del sistema, sueltos (el motor sólo monta .wad sueltos, al arrancar)
  indice.json                 qué hay en cada paquete, qué pide cada mapa y a qué mapas lleva

Cada paquete es un .pk3 (un zip que el motor monta solo) con gzip, en partes de hasta 20 MiB
(Cloudflare Pages no sube archivos de más de 25 MiB). Las fechas adentro de los zip son fijas:
el mismo juego da los mismos bytes.

Los sonidos de más de medio segundo viajan en Opus (ffmpeg; el motor del porteo los lee cuando
no encuentra el .wav): un cuarto de lo que pesan. Los que tienen lazo (cue/smpl) o son de 44 kHz
quedan como .wav. El fondo del menú de la versión 25 aniversario (3840×1600 en 105 partes) se
achica a 1536×640.
"""
import argparse
import collections
import concurrent.futures
import gzip
import hashlib
import io
import json
import os
import re
import struct
import subprocess
import sys
import zipfile
from pathlib import Path

DIRS = ('valve', 'valve_spanish')

# los mapas de la campaña y del entrenamiento (los de multijugador y los de la demo no van:
# en el navegador no hay UDP)
MAPA_SP = r'^(c\d+a\d+[a-z0-9]*|t0a0[a-z0-9]*)$'

# no van nunca: lo de Windows, Steam y el multijugador, y lo que el motor no lee
NUNCA = [
    r'\.(dll|exe|so|dylib|icns|ico|bak|log)$',
    r'^valve/(cl_dlls|dlls|save|hw|logos|overviews|controller_configs|htmlcache)/',
    r'^valve/(custom\.hpk|config\.cfg|game\.cfg|settings\.scr|user\.scr|listenserver\.cfg|server\.cfg|'
    r'mapcycle\.txt|motd\.txt|spectatormenu\.txt|spectcammenu\.txt|GameServerConfig\.vdf|controller\.cfg)$',
    r'^valve_spanish/(config\.cfg|settings\.scr|spectatormenu\.txt|spectcammenu\.txt)$',
    r'^valve/media/.*\.avi$',
    r'\.res$',                                  # diálogos de VGUI2 (el menú de Xash no los usa)
    r'^valve/resource/.*\.(vdf)$',
]

# los .wad que el motor monta al arrancar (sueltos)
SISTEMA_WAD = r'^(valve|valve_spanish)/(decals|cached|gfx|fonts|spraypaint|tempdecal)\.wad$'

# las texturas de los mapas: salen de estos .wad (los de cada mapa se arman con lo que usan)
WADS_TEXTURAS = ('halflife.wad', 'xeno.wad', 'liquids.wad')

# El HUD en alta resolución (hud_allow_hd): con la pantalla de más de 1280×720 de dibujo (un
# teléfono, que dibuja al doble; una PC) el cliente usa los íconos de sprites/1280. El relevamiento
# se hizo en 844×390: no los vio. Los de 2560 no van: la página no deja dibujar a más de 2560 de ancho.
HUD_HD = r'^valve/sprites/(1280/|1280)'

# configuración en cada arranque: cambiar de arma al tocar el número (sin confirmar con el
# disparo), sin micrófono, sin los controles táctiles propios del motor (la página tiene los suyos)
# y sin callar el sonido cuando el motor cree que perdió el foco (en el teléfono eso pasa sin salir
# del juego; al ir de verdad a segundo plano lo calla la página).
PORTEO_CFG = """// porteo web
hud_fastswitch "1"
voice_enable "0"
touch_enable "0"
gl_vsync "0"
fps_max "100"
cl_showfps "0"
snd_mute_losefocus "0"
"""

MAX_PARTE = 20 << 20

# el fondo del menú, achicado (mainui lo escala a la pantalla: alcanza para un teléfono o una PC)
FONDO = (1536, 640)


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
    """{nombre en minúsculas: (bytes del lump, tamaño, tipo, compresión, nombre)}"""
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
    for datos, tam, tipo, comp, nombre in lumps:
        while len(cuerpo) % 4:          # cada lump alineado a 4, como los escribe wadmaker
            cuerpo.append(0)
        ini = 12 + len(cuerpo)
        cuerpo += datos
        dire += struct.pack('<iiibbbb16s', ini, len(datos), tam, tipo, comp, 0, 0, nombre.encode('latin-1')[:15])
    while len(cuerpo) % 4:
        cuerpo.append(0)
    return b'WAD3' + struct.pack('<ii', len(lumps), 12 + len(cuerpo)) + bytes(cuerpo) + bytes(dire)


def frases_por_nombre(ruta):
    """{FRASE: [.wav que la forman, relativos a sound/]} de un sentences.txt."""
    out = {}
    if not ruta.exists():
        return out
    for linea in ruta.read_text('latin-1').splitlines():
        linea = linea.split('//')[0].strip()
        if not linea:
            continue
        partes = linea.split()
        if len(partes) < 2:
            continue
        carpeta, wavs = 'vox', []
        for palabra in partes[1:]:
            palabra = re.sub(r'\([^)]*\)', '', palabra).strip(',.')
            if not palabra:
                continue
            if '/' in palabra:
                carpeta, palabra = palabra.rsplit('/', 1)
            wavs.append(f'{carpeta}/{palabra}.wav'.lower())
        out[partes[0].upper()] = wavs
    return out


def voces_nombradas(ents, fr):
    """Los .wav (relativos a sound/) que nombran las entidades de un mapa: frases con guion
    ("!C1A0_SCI_CTRL", o un grupo como "C1A0_" que elige una al azar) y sonidos por nombre."""
    grupos = collections.defaultdict(list)
    for n in fr:
        grupos[re.sub(r'\d+$', '', n)].append(n)
    nombres, wavs = set(), set()
    for e in ents:
        for k, v in e.items():
            if k in ('classname', 'targetname', 'target', 'origin', 'angles', 'model'):
                continue
            for tok in re.split(r'[\s;]+', v):
                n = tok.lstrip('!').upper()
                if tok.startswith('!') or n in fr:
                    nombres |= ({n} & fr.keys()) | set(grupos.get(n, ()))
                elif tok.lower().endswith('.wav'):
                    wavs.add(tok.lower().replace('\\', '/').lstrip('*'))
    return wavs | {w for n in nombres for w in fr[n]}


# ── modelos ───────────────────────────────────────────────────────────────────────────────
def mdl_aparte(datos):
    """Los .mdl que un modelo (IDST) pide aparte: sus grupos de secuencias ("models\\scientist01.mdl",
    que el motor abre recién al usar una de esas animaciones) y el de sus texturas (scientistT.mdl)."""
    if datos[:4] != b'IDST' or len(datos) < 244:
        return []
    numtex = struct.unpack_from('<i', datos, 180)[0]
    n, idx = struct.unpack_from('<ii', datos, 172)
    out = []
    for i in range(1, n):
        p = idx + i * 104 + 32
        out.append(datos[p:p + 64].split(b'\0')[0].decode('latin-1').replace('\\', '/'))
    return out, numtex == 0


# ── sonidos en Opus ───────────────────────────────────────────────────────────────────────
def wav_info(datos):
    """(frecuencia, tiene lazo) de un .wav, o None si no se entiende."""
    if datos[:4] != b'RIFF' or datos[8:12] != b'WAVE':
        return None
    i, frec, lazo = 12, None, False
    while i + 8 <= len(datos):
        cid, tam = datos[i:i + 4], struct.unpack_from('<I', datos, i + 4)[0]
        if cid == b'fmt ' and tam >= 16:
            frec = struct.unpack_from('<I', datos, i + 12)[0]
        elif cid in (b'cue ', b'smpl'):
            lazo = True
        i += 8 + tam + (tam & 1)
    return (frec, lazo) if frec else None


def a_opus(datos, cache):
    """El .wav en Opus (Ogg) con ffmpeg, o None si no conviene (con lazo, de 44 kHz, o casi igual
    de grande). Sin fecha ni versión del codificador adentro: los mismos bytes en cada corrida."""
    info = wav_info(datos)
    if not info or info[1] or info[0] > 22050:
        return None
    frec, kbps = (12000, '24k') if info[0] <= 12000 else (24000, '32k')
    clave = hashlib.sha1(datos + f'{frec}{kbps}'.encode()).hexdigest()
    guardado = cache / clave[:2] / f'{clave}.opus' if cache else None
    if guardado and guardado.exists():
        out = guardado.read_bytes()
    else:
        r = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0',
                            '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact',
                            '-c:a', 'libopus', '-b:a', kbps, '-ar', str(frec), '-application', 'audio',
                            '-threads', '1', '-f', 'ogg', 'pipe:1'], input=datos, capture_output=True)
        if r.returncode or not r.stdout:
            return None
        out = r.stdout
        if guardado:
            guardado.parent.mkdir(parents=True, exist_ok=True)
            guardado.write_bytes(out)
    return out if len(out) < len(datos) * 0.6 else None


# ── el fondo del menú ─────────────────────────────────────────────────────────────────────
def fondo_reducido(disposicion, leer):
    """Las partes del fondo (resource/HD_BackgroundLayout.txt) en una imagen de FONDO, otra vez en
    partes de 256 (TGA de 24 bits, como las originales). {ruta en el pk3: bytes}, o {} si no hace falta."""
    from PIL import Image
    fichas = re.findall(r'(\S+\.tga)\s+\S+\s+(-?\d+)\s+(-?\d+)', disposicion, re.I)
    m = re.match(r'\s*resolution\s+(\d+)\s+(\d+)', disposicion)
    if not m or not fichas or int(m.group(1)) <= FONDO[0]:
        return {}
    ancho, alto = int(m.group(1)), int(m.group(2))
    lienzo = Image.new('RGB', (ancho, alto))
    for ruta, x, y in fichas:
        lienzo.paste(Image.open(io.BytesIO(leer(ruta))).convert('RGB'), (int(x), int(y)))
    chico = lienzo.resize(FONDO, Image.LANCZOS)
    out, lineas = {}, [f'resolution\t{FONDO[0]}\t{FONDO[1]}', '']
    for fila, y in enumerate(range(0, FONDO[1], 256)):
        for col, x in enumerate(range(0, FONDO[0], 256)):
            parte = chico.crop((x, y, min(x + 256, FONDO[0]), min(y + 256, FONDO[1])))
            w, h = parte.size
            # TGA tipo 2 (color verdadero sin comprimir), filas de abajo hacia arriba, en BGR
            cuerpo = parte.transpose(Image.FLIP_TOP_BOTTOM).tobytes('raw', 'BGR')
            nombre = f'resource/background/porteo_{fila + 1}_{chr(97 + col)}.tga'
            out[nombre] = struct.pack('<BBBHHBHHHHBB', 0, 0, 2, 0, 0, 0, 0, 0, w, h, 24, 0) + cuerpo
            lineas.append(f'{nombre}\tfit\t{x}\t{y}')
    out['resource/HD_BackgroundLayout.txt'] = ('\n'.join(lineas) + '\n').encode('ascii')
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('juego', type=Path)
    ap.add_argument('salida', type=Path)
    ap.add_argument('--relevamiento', type=Path, required=True)
    ap.add_argument('--menu-es', type=Path, help='resource/mainui_spanish.txt (lo nuestro: el menú de Xash en español)')
    ap.add_argument('--mapas', help='sólo estos mapas (separados por comas), para el .html de un solo archivo')
    ap.add_argument('--cache', type=Path, help='dónde guardar los sonidos ya pasados a Opus (para la próxima vez)')
    a = ap.parse_args()
    J, S = a.juego, a.salida
    S.mkdir(parents=True, exist_ok=True)

    # ── lo que hay ────────────────────────────────────────────────────────────────────────
    todos = {}
    for d in DIRS:
        for raiz, _, archivos in os.walk(J / d):
            for f in archivos:
                r = os.path.relpath(os.path.join(raiz, f), J).replace(os.sep, '/')
                if not any(re.search(x, r, re.I) for x in NUNCA):
                    todos[r] = os.path.getsize(J / r)
    minus = {r.lower(): r for r in todos}

    mapas = sorted(Path(r).stem for r in todos if re.match(r'valve/maps/[^/]+\.bsp$', r, re.I)
                   and re.match(MAPA_SP, Path(r).stem, re.I))
    if a.mapas:
        pedidos = {m.strip().lower() for m in a.mapas.split(',') if m.strip()}
        mapas = [m for m in mapas if m.lower() in pedidos]
    # los mapas que no van, con lo suyo (.bsp, .res, .txt de la descripción, sus .wad de detalle)
    otros = {Path(r).stem.lower() for r in todos if re.match(r'valve/maps/[^/]+\.bsp$', r, re.I)} - {m.lower() for m in mapas}
    for r in list(todos):
        if re.match(r'valve/maps/', r, re.I) and Path(r).stem.lower().split('_detail')[0] in otros:
            del todos[r]

    # ── idiomas ───────────────────────────────────────────────────────────────────────────
    # todo lo de valve_spanish cambia con el idioma; su par en valve es el inglés
    del_idioma = {r[len('valve_spanish/'):].lower() for r in todos if r.startswith('valve_spanish/')}
    idioma_en = {minus['valve/' + p] for p in del_idioma if 'valve/' + p in minus}
    idioma_es = {r for r in todos if r.startswith('valve_spanish/')}
    sistema = sorted(r for r in todos if re.search(SISTEMA_WAD, r, re.I))
    # textos e imágenes (con el menú) / voces (después)
    voz = lambda r: re.search(r'/sound/.*\.wav$', r, re.I) and not r.lower().endswith('sentences.txt')
    texto_en = sorted(r for r in idioma_en if not voz(r) and r not in sistema)
    texto_es = sorted(r for r in idioma_es if not voz(r) and r not in sistema)
    voces_en = sorted(r for r in idioma_en if voz(r))
    voces_es = sorted(r for r in idioma_es if voz(r))
    neutro = set(todos) - idioma_en - idioma_es - set(sistema)

    # ── qué abre el motor y cuándo (relevamiento.json, sólo nombres) ──────────────────────
    rel = json.loads(a.relevamiento.read_text())
    fases = collections.defaultdict(set)
    for r, fs in rel.items():
        real = minus.get(r.lower())
        if real:
            fases[real].update(fs)
    # los .wad de texturas no viajan (el motor los abre al arrancar, pero los mapas usan los que
    # se arman abajo), y el fondo grande del menú tampoco si se achica
    texturas = {minus['valve/' + w] for w in WADS_TEXTURAS if 'valve/' + w in minus}
    disp = minus.get('valve/resource/hd_backgroundlayout.txt')
    fondo = fondo_reducido((J / disp).read_text('latin-1'), lambda p: (J / minus['valve/' + p.lower()]).read_bytes()) if disp else {}
    if fondo:
        texturas |= {disp} | {minus['valve/' + p.lower()] for p in re.findall(r'(\S+\.tga)', (J / disp).read_text('latin-1'), re.I)}
    neutro -= texturas

    # Cada mapa es de un capítulo (c1a0e → c1a0, t0a0b → t0a0), en el orden de la historia; el
    # entrenamiento va al final (lo que comparte con la campaña es de la campaña). Lo que usan
    # varios mapas va con el primer capítulo que lo usa: la primera partida baja sólo lo del
    # principio, y lo de cada capítulo se baja mientras se juega el anterior.
    def tramo(m):
        x = re.match(r'(c\d+a\d+|t0a0)', m)
        return x.group(1) if x else m
    orden = sorted({tramo(m) for m in mapas}, key=lambda t: (t.startswith('t'), [int(n) for n in re.findall(r'\d+', t)]))
    primero = lambda ms: min((tramo(m) for m in ms), key=orden.index)

    menu, base, del_mapa = set(), set(), {m: set() for m in mapas}
    comun = collections.defaultdict(set)           # capítulo → lo que estrena y comparten varios mapas
    necesita = {m: set() for m in mapas}           # mapa → capítulos cuyo común usa
    for r in neutro:
        fs = fases.get(r, set())
        ms = [m for m in mapas if m in fs]
        if 'arranque' in fs or 'pantalla' in fs:
            menu.add(r)
        elif len(ms) > 1:
            comun[primero(ms)].add(r)
            for m in ms:
                necesita[m].add(primero(ms))
        elif len(ms) == 1:
            # (la partida del relevamiento se jugó en c1a0: lo que abrió ella y ningún otro mapa es de c1a0)
            del_mapa[ms[0]].add(r)
        elif 'partida' in fs:
            base.add(r)                 # sólo al jugar: lo que suena al disparar, los eventos de las armas
        elif re.match(HUD_HD, r, re.I):
            base.add(r)
    menu.add('valve/liblist.gam')

    # Lo que un modelo pide aparte va con él: el relevamiento ve un grupo de secuencias sólo si esa
    # animación se usó (y si falta cuando se usa, el motor se cae con "LoadCacheFile: can't load").
    # Si el modelo está en varios lados, sus partes van con el que se baja primero.
    grupos = [menu, base] + [comun[c] for c in orden] + [del_mapa[m] for m in mapas]
    con = {}
    for g in grupos:
        for r in sorted(g):
            if not r.lower().endswith('.mdl'):
                continue
            info = mdl_aparte((J / r).read_bytes())
            if not info:
                continue
            aparte, t = info
            nombres = ['valve/' + p for p in aparte] + ([r[:-4] + 't.mdl'] if t else [])
            for p in nombres:
                real = minus.get(p.lower())
                if real and real not in con:
                    con[real] = g
    for real, g in con.items():
        for otro in grupos:
            otro.discard(real)
        g.add(real)
    en_comun = set().union(*comun.values())

    # Los sonidos que ningún mapa abrió al cargar: el juego toca algunos sin precargarlos (las
    # frases de sentences.txt, el aterrizaje de una caída, los casquillos de la escopeta) y el
    # relevamiento no los ve todos. Pesan poco: van todos, a pedido.
    sonidos = {r for r in neutro - menu - base - en_comun - set().union(*del_mapa.values())
               if re.match(r'valve/sound/.*\.wav$', r, re.I)}
    # lo que ningún mapa usó y no es sonido (modelos y sprites del multijugador, sobras) no va
    sobras = neutro - menu - base - en_comun - sonidos - set().union(*del_mapa.values())
    sobras = {r for r in sobras if not re.match(r'valve/(media/|maps/)', r, re.I)}

    # ── texturas: las comunes en un .wad, las de cada mapa en el suyo ─────────────────────
    wads = {}
    for w in WADS_TEXTURAS:
        if minus.get('valve/' + w):
            wads.update({k: v for k, v in leer_wad(J / minus['valve/' + w]).items() if k not in wads})
    uso, sin_textura = collections.defaultdict(set), collections.defaultdict(set)
    ents_de, ents, vecinos, musica = {}, {}, {}, {}
    for m in mapas:
        bsp = minus[f'valve/maps/{m}.bsp'.lower()]
        txt, externas = leer_bsp(J / bsp)
        ents_de[m] = txt
        es = ents[m] = entidades(txt)
        vecinos[m] = sorted({e['map'].lower() for e in es if e.get('classname') == 'trigger_changelevel' and e.get('map')})
        pistas = set()
        for e in es:
            if e.get('classname') in ('target_cdaudio', 'trigger_cdaudio'):
                try:
                    n = int(float(e.get('health', '0')))
                except ValueError:
                    continue
                if n >= 2:
                    pistas.add(n)
        musica[m] = sorted(pistas)
        for t in externas:
            if t.lower() in wads:
                uso[t.lower()].add(m)
            else:
                sin_textura[t.lower()].add(m)
    # las texturas de varios mapas, con el primer capítulo que las usa (porteo_texturas_<capítulo>.wad);
    # las de un solo mapa, con él (porteo_<mapa>.wad)
    tex_comun = collections.defaultdict(list)
    for t, ms in sorted(uso.items()):
        if len(ms) > 1:
            tex_comun[primero(ms)].append(t)
            for m in ms:
                necesita[m].add(primero(ms))
    wad_comun = {c: escribir_wad([wads[t] for t in ts]) for c, ts in tex_comun.items()}
    wad_de = {}
    for m in mapas:
        propias = sorted(t for t, ms in uso.items() if ms == {m})
        wad_de[m] = escribir_wad([wads[t] for t in propias]) if propias else None
    # cada mapa busca sus texturas en los .wad de los capítulos que comparte y en el suyo: la lista
    # de .wad de las entidades se cambia con maps/<mapa>.ent (Xash lo lee en lugar de las del .bsp)
    ent_nueva = {}
    for m in mapas:
        lista = ';'.join([f'porteo_texturas_{c}.wad' for c in orden if c in necesita[m] and c in wad_comun]
                         + ([f'porteo_{m}.wad'] if wad_de[m] else []))
        nuevo = re.sub(r'("wad"\s*")[^"]*(")', lambda x: x.group(1) + lista + x.group(2), ents_de[m], count=1)
        ent_nueva[m] = nuevo.encode('latin-1')

    # la música: cada pista en su paquete
    pistas = sorted({n for ps in musica.values() for n in ps if minus.get(f'valve/media/half-life{n:02d}.mp3')})

    # ── las voces de cada idioma ──────────────────────────────────────────────────────────
    # Las frases con guion que nombran los mapas (el anuncio del tren, lo que dicen en cada escena)
    # van con el primer capítulo que las usa y hacen falta para entrar al mapa. La charla de los
    # personajes (lo que dicen al azar al tocarlos, al pelear) va aparte y se baja de fondo
    # durante el primer capítulo: si una voz falta, el motor del porteo la vuelve a buscar cuando
    # llega un paquete nuevo.
    voces_cap, charla, voces_mapa = {}, {}, {m: {} for m in mapas}
    for k, d, voc in (('en', 'valve', voces_en), ('es', 'valve_spanish', voces_es)):
        fr = frases_por_nombre(J / d / 'sound/sentences.txt')
        por_ruta = {r.split('/sound/', 1)[1].lower(): r for r in voc}
        usa = collections.defaultdict(set)
        for m in mapas:
            for w in voces_nombradas(ents[m], fr):
                if w in por_ruta:
                    usa[por_ruta[w]].add(m)
        voces_cap[k] = collections.defaultdict(list)
        for r in voc:
            if usa[r]:
                voces_cap[k][primero(usa[r])].append(r)
        charla[k] = [r for r in voc if not usa[r]]
        for m in mapas:
            voces_mapa[m][k] = sorted({primero(usa[r]) for r in voc if m in usa[r]}, key=orden.index)

    # ── los sonidos en Opus ───────────────────────────────────────────────────────────────
    # Un sonido y su par del otro idioma van los dos en Opus o los dos en .wav: el motor busca
    # primero el .wav en todas las carpetas, y un .wav en inglés le ganaría al .opus en español.
    van = menu | base | en_comun | sonidos | set().union(*del_mapa.values()) | idioma_en | idioma_es
    candidatos = sorted(r for r in van if re.search(r'/sound/.*\.wav$', r, re.I))
    with concurrent.futures.ThreadPoolExecutor(os.cpu_count() or 4) as pool:
        hechos = dict(zip(candidatos, pool.map(lambda r: a_opus((J / r).read_bytes(), a.cache), candidatos)))
    pares = collections.defaultdict(list)
    for r in candidatos:
        pares[r.split('/', 1)[1].lower()].append(r)
    opus = {}
    for rs in pares.values():
        if all(hechos[r] for r in rs):
            opus.update({r: hechos[r] for r in rs})
    antes = sum(todos[r] for r in opus)
    for r, datos in opus.items():
        todos[r] = len(datos)

    # ── escribir ──────────────────────────────────────────────────────────────────────────
    def entrada(z, nombre, datos, metodo):
        i = zipfile.ZipInfo(nombre, (2000, 1, 1, 0, 0, 0))
        i.compress_type, i.external_attr = metodo, 0o644 << 16
        z.writestr(i, datos, compresslevel=9)

    def pk3(nombre, archivos, carpeta, sueltos=None):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            for r in sorted(archivos):
                dentro = r.split('/', 1)[1]
                if r in opus:
                    entrada(z, dentro[:-4] + '.opus', opus[r], zipfile.ZIP_STORED)
                    continue
                metodo = zipfile.ZIP_STORED if r.lower().endswith(('.wad', '.mp3')) else zipfile.ZIP_DEFLATED
                entrada(z, dentro, (J / r).read_bytes(), metodo)
            for n, datos in sorted((sueltos or {}).items()):
                metodo = zipfile.ZIP_STORED if n.lower().endswith(('.wad', '.mp3')) else zipfile.ZIP_DEFLATED
                entrada(z, n, datos, metodo)
        crudo = buf.getvalue()
        gz = gzip.compress(crudo, 9, mtime=0)
        (S / f'{nombre}.pk3.gz').parent.mkdir(parents=True, exist_ok=True)
        (S / f'{nombre}.pk3.gz').write_bytes(gz)
        return {'archivo': f'{nombre}.pk3.gz', 'carpeta': carpeta, 'pk3': len(crudo), 'gz': len(gz),
                'archivos': len(archivos) + len(sueltos or {})}

    indice = {'paquetes': {}, 'mapas': {}, 'idiomas': {}, 'sueltos': {
        'valve/liblist.gam': (J / 'valve/liblist.gam').read_text('latin-1'),
    }}
    menu.discard('valve/liblist.gam')

    def partes(clave, archivos, carpeta, sueltos=None):
        nombres = []
        for i, parte in enumerate(en_partes(archivos, todos)):
            k = clave + (f'-{i + 1}' if i else '')
            indice['paquetes'][k] = pk3(k, parte, carpeta, sueltos if i == 0 else None)
            nombres.append(k)
        return nombres

    lista_mapas = ''.join(f'{m}\n' for m in mapas)
    inicio = partes('menu-valve', menu, 'valve', {'porteo_mapas.lst': lista_mapas.encode('latin-1'),
                                                   'porteo.cfg': PORTEO_CFG.encode('ascii'), **fondo})
    partida = (partes('base-valve', base, 'valve') if base else []) + partes('sonidos-valve', sonidos, 'valve')
    # lo compartido de cada capítulo (con sus texturas comunes)
    de_tramo = {}
    for c in orden:
        if comun[c] or c in wad_comun:
            suel = {f'porteo_texturas_{c}.wad': wad_comun[c]} if c in wad_comun else None
            de_tramo[c] = partes(f'comun/{c}', comun[c], 'valve', suel)
    menu_es = {'resource/mainui_spanish.txt': a.menu_es.read_bytes()} if a.menu_es else None
    sistema_de = lambda d: [r for r in sistema if r.startswith(d + '/')]
    # en cada idioma, los .wad del sistema que cambian (cached y gfx traen imágenes con texto)
    de_voces = {}
    for k, txt, carpeta, suel in (('en', texto_en, 'valve', None), ('es', texto_es, 'valve_spanish', menu_es)):
        indice['idiomas'][k] = {
            'inicio': partes(f'idioma-{k}', txt, carpeta, suel),
            'voces': partes(f'voces-{k}', charla[k], carpeta),
        }
        de_voces[k] = {c: partes(f'voces-{k}/{c}', fs, carpeta) for c, fs in voces_cap[k].items()}
    for n in pistas:
        indice['paquetes'][f'musica/{n:02d}'] = pk3(f'musica/{n:02d}', [minus[f'valve/media/half-life{n:02d}.mp3']], 'valve')
    for m in mapas:
        suel = {f'maps/{m}.ent': ent_nueva[m]}
        if wad_de[m]:
            suel[f'porteo_{m}.wad'] = wad_de[m]
        paqs = [k for c in orden if c in necesita[m] for k in de_tramo[c]]
        paqs += partes(f'mapas/{m}', del_mapa[m], 'valve', suel)
        paqs += [f'musica/{n:02d}' for n in musica[m] if f'musica/{n:02d}' in indice['paquetes']]
        indice['mapas'][m] = {
            'paquetes': paqs,
            'voces': {k: [p for c in voces_mapa[m][k] for p in de_voces[k][c]] for k in de_voces},
            # en el primer capítulo, la charla de los personajes se baja mientras se juega
            'charla': tramo(m) != orden[0],
            'vecinos': [v for v in vecinos[m] if v in del_mapa],
        }
    indice['inicio'] = inicio
    indice['partida'] = partida
    # los .wad del sistema, sueltos (cada uno con gzip): la página los escribe antes de arrancar.
    # Los de valve_spanish (cached y gfx con texto en español) sólo con ese idioma.
    indice['wads'] = []
    for r in sistema:
        gzw = gzip.compress((J / r).read_bytes(), 9, mtime=0)
        archivo = 'wads/' + r.replace('/', '-').lower() + '.gz'
        (S / archivo).parent.mkdir(parents=True, exist_ok=True)
        (S / archivo).write_bytes(gzw)
        d, nombre = r.split('/', 1)
        indice['wads'].append({'ruta': f'{d}/{nombre.lower()}', 'archivo': archivo, 'gz': len(gzw),
                               'idioma': 'es' if d == 'valve_spanish' else None})
    (S / 'indice.json').write_text(json.dumps(indice, ensure_ascii=False, indent=1), 'utf-8')

    mb = lambda n: f'{n / 1048576:.1f} MB'
    gz = lambda ks: sum(indice['paquetes'][k]['gz'] for k in ks)
    ids = indice['idiomas']
    propios = lambda m: [k for k in indice['mapas'][m]['paquetes'] if k.startswith('mapas/')]
    con_guion = lambda k: gz(p for ps in de_voces[k].values() for p in ps)
    print(f"menú {mb(gz(inicio) + sum(w['gz'] for w in indice['wads'] if not w['idioma']))}, "
          f"idioma en {mb(gz(ids['en']['inicio']))} + voces {mb(con_guion('en'))} con guion y {mb(gz(ids['en']['voces']))} de charla, "
          f"es {mb(gz(ids['es']['inicio']))} + voces {mb(con_guion('es'))} con guion y {mb(gz(ids['es']['voces']))} de charla, "
          f"partidas {mb(gz(partida))}, común de los capítulos {mb(gz(k for ks in de_tramo.values() for k in ks))}, "
          f"{len(mapas)} mapas {mb(sum(gz(propios(m)) for m in mapas))}, "
          f"música {len(pistas)} pistas {mb(gz(f'musica/{n:02d}' for n in pistas))}; "
          f"total {mb(gz(indice['paquetes']))}")
    print('común por capítulo:', ', '.join(f'{c} {mb(gz(ks))}' for c, ks in de_tramo.items()))
    if mapas:
        m0 = mapas[0] if 'c0a0' not in mapas else 'c0a0'
        im = indice['mapas'][m0]
        print(f'para jugar {m0}: {mb(gz(partida) + gz(im["paquetes"]) + gz(im["voces"]["en"]))} en inglés, '
              f'{mb(gz(partida) + gz(im["paquetes"]) + gz(im["voces"]["es"]))} en español')
    print(f'texturas: {sum(len(ts) for ts in tex_comun.values())} de varios mapas ({mb(sum(len(w) for w in wad_comun.values()))}), '
          f'{sum(1 for m in mapas if wad_de[m])} mapas con propias ({mb(sum(len(w) for w in wad_de.values() if w))})')
    print(f'sonidos en Opus: {len(opus)} de {len(candidatos)}, {mb(antes)} → {mb(sum(todos[r] for r in opus))}')
    if sin_textura:
        print(f'AVISO: {len(sin_textura)} texturas que no están en ningún .wad:',
              ', '.join(f'{t} ({",".join(sorted(ms)[:3])})' for t, ms in sorted(sin_textura.items())[:12]))
    print(f'sin usar (no van): {len(sobras)} archivos, {mb(sum(todos[r] for r in sobras))}')
    (S / 'fuera.txt').write_text('\n'.join(sorted(sobras)) + '\n')


if __name__ == '__main__':
    sys.exit(main())
