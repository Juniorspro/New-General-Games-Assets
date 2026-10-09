#!/usr/bin/env python3
"""Truco (Blyts): del APK del dueño a los datos de la versión web.

    python3 -I armar-datos.py TRUCO.apk SALIDA

TRUCO.apk es el de Google Play (com.blyts.trucolite.activities 6.0.352; el probado tiene el
sha256 de SHA_PROBADO). Necesita UnityPy y Pillow (portear.sh los instala en su entorno) y ffmpeg.
El juego es Unity con IL2CPP: el código no se puede pasar a la web, pero los datos sí. Escribe en
SALIDA:

  cartas/<mazo>/<palo>-<n>.webp   los 6 mazos (palos basto, copa, oro y espada; 1 a 7 y 10 a 12),
                                  cada uno con su dorso chico y sus pilas (mazo-abajo, mazo-arriba);
                                  el dorso grande es uno solo para todos: cartas/dorso.webp
  mazos/<mazo>.webp               la tapa de cada mazo, para elegirlo (y portada-<mazo>.webp)
  fondos/<region>.webp            la mesa de cada región; fondos/menu.webp y fondos/costado.webp
  bebidas/<region>.webp           lo que hay arriba de la mesa en cada región
  regiones/<region>.webp          el ícono de cada región
  mapa/mapa.webp, mapa/<region>   el mapa de la Gira Nacional y sus regiones
  avatares/<avatar>.webp          las caras de los personajes y las de por defecto (male, female...)
  ui/<nombre>.webp                los sprites de la interfaz con su nombre del juego
  voces/<voz>/<canto>-<n>.mp3     los 12 juegos de voces (truco, quiero, envido, mazo...)
  sonidos/<nombre>.mp3            los efectos
  musica/<nombre>.mp3             la música del menú y de la mesa
  fuentes/<nombre>.otf|ttf        las letras del juego
  icono.png                       el ícono del juego, para la app instalable y el APK
  textos.json                     los textos en castellano del juego (assets/lang_es.json: menús,
                                  reglas y todo lo que dicen los personajes)
  jugadores.json                  los personajes de la Gira Nacional, por región (data/players_es)
  indice.json                     qué hay: tamaño y bordes de 9 partes de cada sprite, cuántas frases
                                  tiene cada voz, los mazos, los avatares, las fuentes

Las imágenes van en WebP y el audio en MP3 (el juego trae Vorbis adentro de FSB5, que el navegador
no lee; MP3 lo lee cualquiera). Sin fechas ni metadatos adentro: el mismo APK da los mismos bytes.
"""
import argparse
import collections
import concurrent.futures
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

import UnityPy
from PIL import Image

SHA_PROBADO = 'f20e334ca82d16fed0ee594cada82a410452da9775c9cbe773001fa2962a55e9'

PALOS = {'clubs': 'basto', 'cups': 'copa', 'golds': 'oro', 'swords': 'espada'}
MAZOS = ['default', 'gaucho', 'peronista', 'rocknacional', 'vllc', 'worldcup']
# la voz de cada personaje (enum del juego, en este orden en el metadata) → carpeta de Sfx/Voices
VOCES = {
    'MALE_ORIGINAL': 'maleoriginal', 'MALE_PORTENO': 'maleporteno', 'MALE_TANGUERO': 'maletanguero',
    'MALE_GAUCHO': 'malegaucho', 'MALE_CORDOBA': 'malecordoba', 'MALE_BRITISH': 'malebritanico',
    'MALE_MISIONES': 'malemisiones', 'FEMALE_ORIGINAL': 'femaleoriginal', 'FEMALE_PORTENO': 'femaleporteno',
    'FEMALE_INTERIOR': 'femalevieja', 'FEMALE_CORDOBA': 'femalecordoba', 'FEMALE_MISIONES': 'femalemisiones',
}
CANTOS = ['truco', 'retruco', 'valecuatro', 'quiero', 'noquiero', 'envido', 'realenvido', 'faltaenvido',
          'flor', 'contraflor', 'contrafloralresto', 'mazo']
# los efectos que usa la versión web (los de las reacciones animadas, la trivia y el fútbol quedan afuera)
SONIDOS = ['achievementalert', 'achievementcompleted', 'back', 'beep', 'beep2', 'bell', 'bulb',
           'cardclubs', 'cardcups', 'cardgolds', 'cardswords', 'cardregular', 'cardspecial', 'claps',
           'clickmuffled', 'clicksoft', 'coin', 'correctanswer', 'dialog', 'endoftime', 'firework1', 'firework2', 'firework3',
           'firework4', 'firework5', 'genericclick', 'genericclick2', 'knock', 'magicspell', 'matchlose',
           'matchwin', 'menuclick', 'messagereceived', 'messagesent', 'notification', 'present', 'scroll',
           'spell', 'tap', 'tictac', 'two', 'whoosh', 'whoosh2', 'whoosh3', 'whooshlong', 'whooshshort', 'wronganswer']
MUSICA = ['mainmenu', 'gameplaytheme', 'gameplaytheme2', 'gameplaytheme3']
# las mesas de las 6 regiones de la gira (Cataratas y Fragata son modos aparte, que no están)
REGIONES = ['buenos aires', 'cuyo', 'patagonia', 'mesopotamia', 'norte', 'malvinas']
# sprites de la interfaz, por nombre; con tamaño cuando el nombre se repite con otro dibujo
UI = [
    # menú, listas y ventanas
    'logo', ('firulete', 284), 'firulete_flor', 'capsule_top', 'capsule_mid', 'capsule_bottom', 'CapsuleMask',
    'capsule_small', 'icon_play', 'icon_solo', 'icon_tour', 'icon_couple', 'icon_help', 'icon_academy',
    'icon_signs', 'icon_points', 'icon_decks', 'icon_practice', 'icon_trivia', 'footer_bg', 'btn_home',
    'btn_home_sel', 'btn_offline', 'btn_offline_sel', 'btn_tools', 'btn_tools_sel', 'header', 'header_small',
    'icon_back', 'icon_hambuerger', 'icon_sound_on', 'icon_sound_off', 'Sound_Fx', 'voices_on', 'voices_off',
    'box', 'modal', 'close', 'input', 'input_arrow', 'small_arrow', 'toggle_sel', 'button_rounded',
    'rounded_btn', 'rounded_btn_on', 'rounded_btn_white', ('Check', 79), 'Checkmark', 'cross', 'dots', 'Info',
    'warning', 'rounded_box', 'rounded_menu_button', 'single_match', 'pairs_match', 'triple_match',
    'progress_capsule', 'progress_line', 'level_line_content', 'scroll_handle', ('avatar_mask', 230),
    'avatar_outline', 'circle_rank_over', 'avatar_border_2', 'AvatarSelected', 'lock', 'lock_open',
    'lock_rank', 'points_square', 'ranking_row', 'stats_arrow', 'pico', 'btn_add', 'btn_minus',
    'button_plus', 'delete', 'sticks-1', 'sticks-2', 'sticks-3', 'sticks-4', 'sticks-5', 'badge_blue',
    'badge_green', 'badge_red', 'badge_yellow', 'icon_clubs', 'icon_cups', 'icon_golds', 'icon_swords',
    'mini_card', 'mini_clubs', 'mini_cups', 'mini_golds', 'mini_swords', 'help_arrow', 'tutorial-spot',
    'deck_selected',
    # la mesa
    'Opponent', 'shadow', 'hand_male_b', 'hand_male_f', 'hand_female_b', 'hand_female_f', 'base_bar',
    'reply_bar', 'btn', 'btn_feed', 'btn_feed_yes', 'btn_feed_no', 'split', ('bubble', 642), ('bubble_left', 642),
    'bubble_down', 'bubble_left_down', 'ActioBubble', 'is_hand', 'ptfade', 'CirclePoints', 'Flor', 'NoFlor',
    'Snoop', 'clock_white', 'clock', 'name_box', 'Chat_white',
] + [f'pts_{i}' for i in range(11)] + [f'emoji_{e}' for e in (
    'angry', 'canchero', 'clap', 'clock', 'happy', 'heart', 'sad', 'scared', 'think')]
MAPA = {'bsas': 'buenos-aires', 'cuyo': 'cuyo', 'patagonia': 'patagonia', 'mesopotamia': 'mesopotamia',
        'norte': 'norte', 'malvinas': 'malvinas', 'cataratas': 'cataratas', 'fragata': 'fragata'}
FUENTES = ['YanoneKaffeesatz-Regular', 'YanoneKaffeesatz-Bold', 'TitilliumText22L001', 'TitilliumText22L002',
           'TitilliumText22L003', 'TitilliumText22L004', 'TitilliumText22L005', 'TitilliumText22L_Bold', 'TitilliumText22L_Med',
           'TitilliumText22L_Light', 'VistaSanMed', 'VistaSanAltMed', 'ifc_los_benditos']


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


class Datos:
    """Los objetos de Unity, por ruta de Resources y por nombre."""

    def __init__(self, carpeta):
        self.env = UnityPy.load(carpeta)
        self.archivos = {}
        for o in self.env.objects:
            self.archivos.setdefault(o.assets_file.name.lower(), o.assets_file)
        rmo = next(o for o in self.env.objects if o.type.name == 'ResourceManager')
        self.rmf = rmo.assets_file
        self.rutas = collections.defaultdict(list)
        for ruta, ptr in rmo.read_typetree()['m_Container']:
            o = self.resolver(self.rmf, ptr['m_FileID'], ptr['m_PathID'])
            if o is not None:
                self.rutas[ruta].append(o)
        self.por_nombre = collections.defaultdict(list)
        for o in sorted(self.env.objects, key=lambda o: (o.assets_file.name, o.path_id)):
            if o.type.name in ('Sprite', 'Texture2D', 'Font', 'TextAsset'):
                try:
                    self.por_nombre[(o.type.name, o.peek_name())].append(o)
                except Exception:
                    pass

    def resolver(self, af, fid, pid):
        if fid == 0:
            f = af
        else:
            f = self.archivos.get(os.path.basename(af.externals[fid - 1].path).lower())
        return f.objects.get(pid) if f else None

    def bajo(self, prefijo, tipo):
        """Los objetos de un tipo bajo una carpeta de Resources: [(ruta, objeto)]."""
        return [(r, o) for r, os_ in sorted(self.rutas.items()) if r.startswith(prefijo)
                for o in os_ if o.type.name == tipo]

    def uno(self, tipo, nombre, tam=None):
        """El objeto con ese nombre; si hay varios, el del tamaño pedido (y tienen que ser iguales)."""
        cands = self.por_nombre.get((tipo, nombre), [])
        if tipo == 'Sprite' and tam:
            ancho = tam if isinstance(tam, int) else tam[0]
            cands = [o for o in cands if int(round(o.read().m_Rect.width)) == ancho]
        if not cands:
            raise SystemExit(f'falta {tipo} «{nombre}» {tam or ""}')
        if len(cands) > 1:
            huellas = {hashlib.sha1(imagen(o).tobytes()).hexdigest() for o in cands} if tipo in ('Sprite', 'Texture2D') else {1}
            if len(huellas) > 1:
                tams = [tuple(imagen(o).size) for o in cands]
                raise SystemExit(f'{tipo} «{nombre}» aparece {len(cands)} veces con dibujos distintos {tams}: '
                                 'agregarle el ancho en la lista')
        return cands[0]


# UnityPy guarda la textura de cada sprite en una caché por archivo con el path_id de la textura como
# clave, sin el archivo de la textura: dos sprites de resources.assets cuyas texturas están en archivos
# distintos con el mismo path_id se llevan la misma imagen (así salían vacías 31 caras de Cuyo).
from UnityPy.export import SpriteHelper as _SH  # noqa: E402
_TEXTURAS = {}


def _textura_del_sprite(sprite, textura, alfa):
    t = textura.deref(sprite.assets_file)
    clave = (t.assets_file.name, t.path_id)
    a = alfa.deref(sprite.assets_file) if alfa and alfa.m_PathID else None
    if a is not None:
        clave += (a.assets_file.name, a.path_id)
    if clave not in _TEXTURAS:
        im = _SH.get_image_from_texture2d(t.parse_as_object(), False)
        if a is not None:
            al = _SH.get_image_from_texture2d(a.parse_as_object(), False)
            im = Image.merge('RGBA', (*im.split()[:3], al.split()[0]))
        _TEXTURAS[clave] = im
    return _TEXTURAS[clave]


_SH.get_image = _textura_del_sprite


def imagen(o):
    d = o.read()
    return d.image.convert('RGBA')


def guardar_webp(img, ruta, calidad=88):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    if img.mode == 'RGBA' and img.getextrema()[3][0] == 255:
        img = img.convert('RGB')                     # sin transparencia: sin canal alfa
    # method=6 con transparencia tarda 25 veces más por menos de 1 % de tamaño
    img.save(ruta, 'WEBP', quality=calidad, method=5, alpha_quality=100, exact=False)


def a_mp3(wav, ruta, kbps, mono):
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', 'pipe:0', '-map_metadata', '-1', '-fflags', '+bitexact',
           '-flags:a', '+bitexact', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-write_xing', '0',
           '-id3v2_version', '0']
    if mono:
        cmd += ['-ac', '1']
    subprocess.run(cmd + ['-f', 'mp3', ruta], input=wav, check=True)


def muestras(o):
    """El AudioClip decodificado a WAV (FMOD, vía UnityPy)."""
    d = o.read()
    s = d.samples
    if len(s) != 1:
        raise SystemExit(f'el audio {d.m_Name} trae {len(s)} pistas')
    return next(iter(s.values())), d.m_Channels


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('apk')
    ap.add_argument('salida')
    a = ap.parse_args()
    sal = os.path.abspath(a.salida)
    sha = hashlib.sha256(open(a.apk, 'rb').read()).hexdigest()
    if sha != SHA_PROBADO:
        print(f'aviso: este APK ({sha[:16]}…) no es el probado ({SHA_PROBADO[:16]}…); se sigue igual', file=sys.stderr)
    tmp = tempfile.mkdtemp(prefix='truco-')
    try:
        with zipfile.ZipFile(a.apk) as z:
            nombres = [n for n in z.namelist() if n.startswith('assets/bin/Data/') and not n.endswith('/')
                       and '/Managed/' not in n]
            for n in nombres:
                destino = os.path.join(tmp, n)
                os.makedirs(os.path.dirname(destino), exist_ok=True)
                with z.open(n) as f, open(destino, 'wb') as g:
                    shutil.copyfileobj(f, g)
            lang = json.loads(z.read('assets/lang_es.json').decode('utf-8-sig'))
        if os.path.exists(sal):
            shutil.rmtree(sal)
        os.makedirs(sal)
        print('cargando los datos de Unity…', flush=True)
        D = Datos(os.path.join(tmp, 'assets/bin/Data'))
        indice = {'origen': {'apk_sha256': sha, 'version': '6.0.352'}, 'ui': {}, 'mazos': {}, 'voces': {},
                  'sonidos': [], 'musica': [], 'avatares': {}, 'fuentes': {}, 'regiones': []}
        hechos = []

        def img(ruta_rel, im, calidad=88):
            guardar_webp(im, os.path.join(sal, ruta_rel), calidad)
            hechos.append(ruta_rel)
            return list(im.size)

        # cartas: cada mazo en cards_<mazo>/<palo inglés>; el dorso grande sólo lo trae el de siempre
        for mazo in MAZOS:
            caras = {}
            for ruta, o in D.bajo(f'cards_{mazo}/', 'Sprite'):
                n = o.read().m_Name
                m = re.fullmatch(r'card-(clubs|cups|golds|swords)-(\d+)', n)
                if m:
                    caras[f'{PALOS[m[1]]}-{m[2]}'] = img(f'cartas/{mazo}/{PALOS[m[1]]}-{m[2]}.webp', imagen(o), 90)
                elif n == 'card_back' and mazo == 'default':
                    indice['dorso'] = img('cartas/dorso.webp', imagen(o), 90)
                elif n in ('card_back_small', 'deck_down', 'deck_up'):
                    otro = {'card_back_small': 'dorso-chico', 'deck_down': 'mazo-abajo', 'deck_up': 'mazo-arriba'}[n]
                    caras[otro] = img(f'cartas/{mazo}/{otro}.webp', imagen(o), 90)
            if len([k for k in caras if k[0] in 'bcoe' and '-' in k and k.split('-')[1].isdigit()]) != 40:
                raise SystemExit(f'el mazo {mazo} no tiene las 40 cartas')
            indice['mazos'][mazo] = {'tam': caras['basto-1'], 'tam_copa': caras['copa-1']}
        for ruta, o in D.bajo('images/decks/', 'Sprite'):
            n = o.read().m_Name
            if n.startswith('cover_'):
                img(f'mazos/portada-{n[6:]}.webp', imagen(o))
            elif n in MAZOS:
                img(f'mazos/{n}.webp', imagen(o))

        # mesas, bebidas, íconos de región y el mapa
        for reg in REGIONES:
            (ruta, o), = D.bajo(f'images/gameplay/backgrounds/{reg}/', 'Texture2D')
            img(f'fondos/{slug(reg)}.webp', imagen(o), 85)
        for ruta, o in D.bajo('images/gameplay/drinks/', 'Sprite'):
            img(f'bebidas/{slug(o.read().m_Name)}.webp', imagen(o))
        for ruta, o in D.bajo('images/regionicons/', 'Sprite'):
            n = o.read().m_Name
            if n == 'stats_arrow':
                continue
            img(f'regiones/{slug(n)}.webp', imagen(o))
            indice['regiones'].append(slug(n))
        img('mapa/mapa.webp', imagen(D.uno('Texture2D', 'map')), 85)
        for n, s in MAPA.items():
            img(f'mapa/{s}.webp', imagen(D.uno('Sprite', n)))
        img('fondos/menu.webp', imagen(D.uno('Texture2D', 'menu_bg')), 85)
        # el ícono del juego (el de iOS que viene adentro), para la app instalable y el APK
        ico = imagen(D.uno('Sprite', 'icon_1024_ios')).resize((512, 512), Image.LANCZOS)
        ico.save(os.path.join(sal, 'icono.png'), optimize=True)
        hechos.append('icono.png')
        img('fondos/costado.webp', imagen(D.uno('Texture2D', 'sidebar_bg')), 85)

        # avatares
        for ruta, o in D.bajo('images/avatars/', 'Sprite'):
            n = o.read().m_Name
            if n in indice['avatares']:
                raise SystemExit(f'avatar repetido: {n}')
            img(f'avatares/{n}.webp', imagen(o), 88)
            indice['avatares'][n] = ruta.split('/')[2]

        # interfaz
        for e in UI:
            n, tam = (e if isinstance(e, tuple) else (e, None))
            o = D.uno('Sprite', n, tam)
            d = o.read()
            b = d.m_Border
            info = {'tam': img(f'ui/{n}.webp', imagen(o), 92)}
            if any((b.x, b.y, b.z, b.w)):
                info['borde'] = [round(b.x), round(b.y), round(b.z), round(b.w)]   # izq, abajo, der, arriba
            indice['ui'][n] = info

        # fuentes
        for n in FUENTES:
            fd = bytes(D.uno('Font', n).read().m_FontData)
            ext = '.otf' if fd[:4] == b'OTTO' else '.ttf'
            os.makedirs(os.path.join(sal, 'fuentes'), exist_ok=True)
            open(os.path.join(sal, 'fuentes', n + ext), 'wb').write(fd)
            indice['fuentes'][n] = f'fuentes/{n}{ext}'
            hechos.append(f'fuentes/{n}{ext}')

        # audio: se decodifica acá (FMOD) y ffmpeg lo pasa a MP3 en paralelo
        trabajos = []
        for voz in sorted(set(VOCES.values())):
            por = collections.defaultdict(list)
            for ruta, o in D.bajo(f'sfx/voices/{voz}/', 'AudioClip'):
                m = re.fullmatch(r'([a-z_]+?)_?(\d*)', ruta.split('/')[-1])
                canto = m[1].replace('_', '')
                if canto not in CANTOS:
                    raise SystemExit(f'canto desconocido: {ruta}')
                por[canto].append((int(m[2] or 0), o))
            indice['voces'][voz] = {}
            for canto in CANTOS:
                lista = sorted(por.get(canto, []), key=lambda t: t[0])
                indice['voces'][voz][canto] = len(lista)
                for i, (_, o) in enumerate(lista, 1):
                    trabajos.append((o, f'voces/{voz}/{canto}-{i}.mp3', 64, True))
        for carpeta, lista in (('sonidos', SONIDOS), ('musica', MUSICA)):
            for n in lista:
                o = next((o for r, o in D.bajo(f'sfx/{n}', 'AudioClip') if r == f'sfx/{n}'), None)
                if o is None:
                    raise SystemExit(f'falta el audio sfx/{n}')
                trabajos.append((o, f'{carpeta}/{n}.mp3', 96 if carpeta == 'sonidos' else None, False))
                indice[carpeta].append(n)
        print(f'audio: {len(trabajos)} archivos…', flush=True)
        decodificados = [(muestras(o), ruta, kbps, mono) for o, ruta, kbps, mono in trabajos]
        with concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
            # la música: 64 kbps si es mono (la del menú), 96 si es estéreo
            for f in [ex.submit(a_mp3, wav, os.path.join(sal, ruta), kbps or (64 if canales == 1 else 96), mono or canales == 1)
                      for (wav, canales), ruta, kbps, mono in decodificados]:
                f.result()
        hechos += [t[1] for t in trabajos]

        # textos y personajes
        textos = {x['key']: x['value'] for x in lang['items']}
        json.dump(textos, open(os.path.join(sal, 'textos.json'), 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        (ruta, o), = D.bajo('data/players_es', 'TextAsset')
        s = o.read().m_Script
        jugadores = json.loads(s if isinstance(s, str) else bytes(s).decode('utf-8-sig'))
        for r in jugadores['regions']:
            r['id'] = slug(r['name'])
            for p in r['players']:
                p['voz'] = VOCES[p.pop('voice')]
                if p['avatar'] not in indice['avatares']:
                    raise SystemExit(f'{p["name"]}: falta su avatar {p["avatar"]}')
        json.dump(jugadores, open(os.path.join(sal, 'jugadores.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
        hechos += ['textos.json', 'jugadores.json']

        json.dump(indice, open(os.path.join(sal, 'indice.json'), 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        total = sum(os.path.getsize(os.path.join(sal, h)) for h in hechos)
        por_carpeta = collections.Counter()
        for h in hechos:
            por_carpeta[h.split('/')[0]] += os.path.getsize(os.path.join(sal, h))
        print(f'{len(hechos)} archivos, {total / 1e6:.1f} MB: ' +
              ', '.join(f'{k} {v / 1e6:.1f}' for k, v in sorted(por_carpeta.items(), key=lambda kv: -kv[1])))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
