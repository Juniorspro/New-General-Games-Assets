#!/usr/bin/env python3
"""Rehace la biblioteca de sonidos de LOS MONTES (sonidos/los-montes/) a partir
de las grabaciones originales descargadas.

Por qué existe: igual que sonidos/procesar.py, los originales (wav/flac/ogg de
OpenGameArt, Kenney y Wikimedia Commons) no van al repo —pesan cientos de MB—,
así que esto es la receta: qué archivo, qué tramo, qué filtro, qué se mezcla
con qué. Con los originales a mano sale exactamente lo mismo, manifiesto incluido.

Uso:
    pip install --user imageio-ffmpeg numpy matplotlib
    SONIDOS_ORIG=/ruta/a/orig python3 sonidos/los-montes/procesar.py [--hojas DIR] [--solo id1,id2]

SONIDOS_ORIG tiene la misma forma que la de sonidos/procesar.py:
orig/oga/<slug-de-la-página>/..., orig/kenney/<pack>/... y, para los de
Wikimedia Commons, orig/commons/<archivo>. Dentro de cada fuente el archivo se
busca por nombre en toda la carpeta (los paquetes vienen con subcarpetas
distintas), y si hay más de uno con el mismo nombre se corta con error: la
receta tiene que ser inequívoca.

Qué reusa de sonidos/procesar.py (sin tocarlo): la decodificación, el empalme de
loops con fundido de potencia constante, el recorte de silencios, la medición
LUFS, el limitador circular de loops, la normalización y las fuentes que ya
estaban verificadas. Lo que agrega:
  - capas: un sonido puede ser la mezcla de varias grabaciones, cada una con su
    tramo, filtro, volumen y posición. En los loops cada capa se hace loop por
    su cuenta con el mismo largo, y los eventos sueltos (un crujido, un paso)
    se ubican en un búfer circular, así la mezcla también empalma sin clic.
  - filtros con memoria (eco, reverb) aplicados de forma circular en los loops
    (el loop repetido tres veces, se queda la copia del medio) y con cola de
    silencio en los sueltos, para que el eco no se corte en seco.
  - calidad por sonido: los efectos van como el resto de la biblioteca (mono,
    32 kHz, 64 kbps); los ambientes de ruido a 48 kbps y los drones y el tema
    del menú (casi todo grave) a 32 kbps y 22,05 kHz, para que todo entre en
    ~1,3 MB.
  - síntesis: lo que no se consiguió grabado con licencia aceptable se genera
    con numpy y la nota lo dice.
"""
import glob, json, os, re, subprocess, sys, tempfile
import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
sys.path.insert(0, BASE)
import procesar as P  # noqa: E402  (sonidos/procesar.py: se importa, no se modifica)

FF, SR = P.FF, P.SR
ORIG = os.environ.get('SONIDOS_ORIG', os.path.join(BASE, 'orig'))
JUEGO = 'los-montes'
OGA, KEN = P.OGA, P.KEN
COM = 'https://commons.wikimedia.org/wiki/File:'

# ---------------------------------------------------------------------------
# Fuentes. Las de sonidos/procesar.py se reusan tal cual (ya verificadas); las
# nuevas se verificaron en la página el 28/9/2026 (bloque "License(s)" de
# OpenGameArt; "Licensing" de Commons). "dir" es la carpeta de la página; el
# archivo se busca adentro por nombre.
# ---------------------------------------------------------------------------
F = dict(P.FUENTES)
def f(clave, licencia, autor, fuente, dir, lic_nota=''):
    F[clave] = dict(licencia=licencia, autor=autor, fuente=fuente, dir=dir, lic_nota=lic_nota)

f('k_rpg', 'CC0', 'Kenney (kenney.nl)', KEN + 'rpg-audio', 'kenney/rpg-audio')
f('k_ui', 'CC0', 'Kenney (kenney.nl)', KEN + 'interface-sounds', 'kenney/interface-sounds')
f('k_uia', 'CC0', 'Kenney (kenney.nl)', KEN + 'ui-audio', 'kenney/ui-audio')
f('lamoot', 'CC-BY 3.0', 'Lamoot', OGA + 'ambient-mountain-river-wind-and-forest-and-waterfall',
  'oga/ambient-mountain-river-wind-and-forest-and-waterfall')
f('kurt_rio', 'CC-BY 3.0', 'kurt', OGA + 'stream-sounds', 'oga/stream-sounds')
f('arwen', 'CC-BY 4.0', 'Tsorthan Grove', OGA + 'storm-arwen-2022', 'oga/storm-arwen-2022')
f('thimras', 'CC0', 'Thimras', OGA + 'park-ambiences', 'oga/park-ambiences')
f('antum_arbol', 'CC0', 'AntumDeluge', OGA + 'tree-creaking', 'oga/tree-creaking')
f('ylmir', 'CC0', 'Ylmir', OGA + 'rain-loopable', 'oga/rain-loopable')
f('rustle', 'CC0', 'qubodup', OGA + '20-rustles-dry-leaves', 'oga/20-rustles-dry-leaves')
f('haeldb', 'CC0', 'HaelDB', OGA + 'random-sounds-samples', 'oga/random-sounds-samples',
  'La página ofrece OGA-BY 3.0 o CC0; se usa CC0.')
f('bart_latido', 'CC0', 'bart', OGA + 'heartbeat-sounds', 'oga/heartbeat-sounds')
f('lrsf', 'CC-BY 3.0', 'Little Robot Sound Factory (www.littlerobotsoundfactory.com)', OGA + 'horror-sound-effects-library',
  'oga/horror-sound-effects-library')
f('qubodup_atmos', 'CC0', 'qubodup (Independent.nu)', OGA + '4-atmospheric-ghostly-loops', 'oga/4-atmospheric-ghostly-loops')
f('tinyworlds_horror', 'CC0', 'TinyWorlds', OGA + 'horror-sfx', 'oga/horror-sfx')
f('wortmann', 'CC0', 'Paul Wortmann', OGA + 'dark-cavern-ambient', 'oga/dark-cavern-ambient')
f('psychhead', 'CC0', 'psychhead_', OGA + 'horror-hit-soundpack-1', 'oga/horror-hit-soundpack-1')
f('nocturnal', 'CC0', 'Nocturnal_Vanguard', OGA + 'female-scream-1', 'oga/female-scream-1')
f('arcadeparty', 'CC0', 'ArcadeParty', OGA + 'zombie-skeleton-monster-voice-effects', 'oga/zombie-skeleton-monster-voice-effects')
f('eugeneloza', 'CC0', 'eugeneloza', OGA + 'voices-of-madness', 'oga/voices-of-madness')
f('emopreben', 'CC0', 'EmoPreben', OGA + 'zombie-moans-01-by-emopreben', 'oga/zombie-moans-01-by-emopreben')
f('artisticdude_z', 'CC0', 'artisticdude', OGA + 'zombies-sound-pack', 'oga/zombies-sound-pack')
f('antum_risa', 'CC0', 'AntumDeluge', OGA + 'evil-laugh', 'oga/evil-laugh')
f('antum_risa2', 'CC0', 'AntumDeluge', OGA + 'evil-laugh-2', 'oga/evil-laugh-2')
f('fantozzi', 'CC0', 'qubodup (pasos de Fantozzi)', OGA + 'fantozzis-footsteps-grasssand-stone', 'oga/fantozzis-footsteps-grasssand-stone')
f('tinyworlds_hojas', 'CC0', 'TinyWorlds', OGA + 'different-steps-on-wood-stone-leaves-gravel-and-mud',
  'oga/different-steps-on-wood-stone-leaves-gravel-and-mud')
f('antum_cierre', 'CC0', 'AntumDeluge', OGA + 'zipper', 'oga/zipper')
f('luckius', 'CC0', 'Luckius', OGA + 'various-paper-sound-effects', 'oga/various-paper-sound-effects')
f('bmaczero_mec', 'CC0', 'BMacZero', OGA + 'mechanical-sounds', 'oga/mechanical-sounds')
f('rubberduck_criatura', 'CC0', 'rubberduck', OGA + '80-cc0-creature-sfx', 'oga/80-cc0-creature-sfx')
f('rubberduck_rpg', 'CC0', 'rubberduck', OGA + '80-cc0-rpg-sfx', 'oga/80-cc0-rpg-sfx')
f('rubberduck_loops', 'CC0', 'rubberduck', OGA + '30-cc0-sfx-loops', 'oga/30-cc0-sfx-loops')
f('zer0sol_escopeta', 'CC0', 'zer0_sol', OGA + 'shotgun-reload-sound-effects', 'oga/shotgun-reload-sound-effects')
f('qubodup_clics', 'CC-BY 3.0', 'qubodup', OGA + '2-metal-weapon-clicks', 'oga/2-metal-weapon-clicks')
f('artisticdude_swish', 'CC0', 'artisticdude', OGA + 'swishes-sound-pack', 'oga/swishes-sound-pack')
f('qubodup_impacto', 'CC0', 'qubodup (Independent.nu)', OGA + 'impact', 'oga/impact')
f('kheetor', 'CC0', 'kheetor', OGA + 'tree-chop-fall-thud', 'oga/tree-chop-fall-thud')
f('qubodup_puertas', 'CC0', 'qubodup', OGA + 'door-open-door-close-set', 'oga/door-open-door-close-set')
f('fractile', 'CC-BY 3.0', 'fractilegames', OGA + 'creaky-light-wooden-door', 'oga/creaky-light-wooden-door')
f('qubodup_tambaleo', 'CC0', 'qubodup', OGA + 'wood-wobbling-rattling', 'oga/wood-wobbling-rattling')
f('bart_cabrestante', 'CC0', 'bart', OGA + 'chain-winch-sounds', 'oga/chain-winch-sounds')
f('looneybits_arranque', 'CC0', 'looneybits', OGA + 'car-engine-start-01', 'oga/car-engine-start-01')
f('looneybits_arranque2', 'CC0', 'looneybits', OGA + 'car-engine-start-up-02', 'oga/car-engine-start-up-02')
f('bart_maquinas', 'CC-BY 3.0', 'bart (OLPC, Dr. Richard Boulanger)', OGA + '13-ambient-machine-sounds', 'oga/13-ambient-machine-sounds')
f('bart_raspones', 'CC0', 'bart', OGA + '31-pings-and-metal-filing-sounds', 'oga/31-pings-and-metal-filing-sounds')
f('ycbcr', 'CC0', 'YCbCr', OGA + 'generator-loop', 'oga/generator-loop')
f('qubodup_goteo', 'CC0', 'qubodup', OGA + 'dripping-water-loop', 'oga/dripping-water-loop')
f('jaggedstone', 'CC0', 'JaggedStone', OGA + 'loopable-dungeon-ambience', 'oga/loopable-dungeon-ambience')
f('qubodup_bocha', 'CC0', 'qubodup', OGA + 'bowling-ball-rolling', 'oga/bowling-ball-rolling')
f('themightyglider', 'CC0', 'themightyglider', OGA + 'iron-door', 'oga/iron-door')
f('kauffman', 'CC0', 'Cleyton Kauffman (soundcloud.com/cleytonkauffman)', OGA + 'ambient-horror-track-01', 'oga/ambient-horror-track-01')
# Los de Commons se guardan en orig/commons con nombre corto (el original tiene
# comas y paréntesis): Tawny_owl_Tuntorp.ogg, Cape_Eagle_Owl_BL.ogg, Wolf_howls.ogg.
# upload.wikimedia.org corta con 429 a la IP compartida: se bajan de a uno,
# con User-Agent propio y esperando minutos entre intentos.
f('wcarter_buho', 'CC-BY 4.0', 'W.carter (Wikimedia Commons)', COM + 'Tawny_owl_calling_at_night_in_Tuntorp,_Brastad,_Sweden.ogg', 'commons')
f('bl_buho', 'CC-BY 4.0', 'British Library (colección de sonidos de la naturaleza, vía Wikimedia Commons)',
  COM + 'Cape_Eagle_Owl_(Bubo_capensis)_(W1CDR0001437_BD2).ogg', 'commons')
f('usfws_lobo', 'Dominio público', 'U.S. Fish and Wildlife Service (vía Wikimedia Commons)', COM + 'Wolf_howls.ogg', 'commons',
  'Grabación del gobierno de EE.UU. (USFWS): dominio público, sin restricciones; no es CC0 ni CC-BY en sentido estricto.')
f('sintesis', 'CC0', 'LOS MONTES (síntesis propia, sonidos/los-montes/procesar.py)', 'sonidos/los-montes/procesar.py', '')

# ---------------------------------------------------------------------------
# Capas y sonidos
# ---------------------------------------------------------------------------
def c(fuente, archivo, ss=0.0, dur=None, af=None, db=0.0, en=0.0, fondo=False, rep=None):
    """Una capa: tramo [ss, ss+dur) de un archivo, con filtro af (se aplica ya a
    32 kHz), volumen db y posición en (s). fondo=True en un loop: la capa se
    empalma sola al largo del loop (viento, grillos). rep=(veces, cada_s):
    repite el tramo varias veces (campana, arranque que no prende)."""
    return dict(fuente=fuente, archivo=archivo, ss=ss, dur=dur, af=af, db=db, en=en, fondo=fondo, rep=rep)

S = []
def s(id, tipo, capas, nota, largo=None, xf=0.0, af=None, q=None, lufs=None, cola=0.0, maximo=4.0, recortar=True):
    """tipo 'loop' o 'una' (golpe suelto, como en sonidos/manifiesto.json).
    largo: duración del loop (s). af: filtro sobre la mezcla (circular en loops).
    q: calidad (ver CALIDAD); sin dar: 'ambiente' en loops, 'alta' en golpes de
    menos de 1 s y 'media' en los más largos.
    cola: segundos de silencio que se agregan antes del filtro final (ecos)."""
    if isinstance(capas, dict): capas = [capas]
    S.append(dict(id=id, tipo=tipo, capas=capas, nota=nota, largo=largo, xf=xf, af=af, q=q, lufs=lufs,
                  cola=cola, maximo=maximo, recortar=recortar))

LEJOS = 'lowpass=f=2200,aecho=0.8:0.7:180|410:0.35|0.22'  # distancia en el bosque: sin agudos y con rebote
CUEVA = 'aecho=0.8:0.8:90|230|470:0.45|0.3|0.18'           # galería de mina

# ======================= AMBIENTE =======================
s('viento_montana', 'loop', c('arwen', 'storm_arwen_2022.flac', 61.0, fondo=True),
  'Viento fuerte real (tormenta Arwen, Reino Unido, grabado desde una ventana), tramo parejo sin golpes de objetos.',
  largo=7.0, xf=1.5)
s('viento_pinos', 'loop', [c('thimras', 'park_ambience_wind.wav', 114.0, fondo=True, af='highpass=f=80'),
                          c('antum_arbol', 'tree_creak.flac', 0.0, 2.2, en=1.3, db=-6),
                          c('antum_arbol', 'tree_creak.flac', 2.9, 1.2, en=6.2, db=-9)],
  'MONTAJE: viento real entre árboles de un parque (Thimras) con dos crujidos de un árbol real (AntumDeluge) '
  'encima. No es un pinar: son árboles de hoja, pero el soplido entre ramas es el mismo.',
  largo=8.0, xf=1.5)
s('cascada', 'loop', c('lamoot', 'amb_waterfall.flac', 0.3, fondo=True),
  'Cascada grande: caída de agua densa, de banda ancha (ambiente del juego Yo Frankie!).', largo=5.0, xf=1.2)
s('rio_rapidos', 'loop', c('kurt_rio', 'loudstream.ogg', 2.0, fondo=True),
  'Arroyo correntoso grabado en un campamento: agua que golpea contra piedras. Sirve de río con rápidos; es más chico que un río.',
  largo=6.0, xf=1.2)
s('bosque_noche', 'loop', [c('wolfgang', 'crickets_1.mp3', 10.0, fondo=True),
                          c('thimras', 'park_ambience_wind.wav', 200.0, fondo=True, db=-12, af='lowpass=f=1500')],
  'MONTAJE: grillos de noche (Wolfgang_) sobre un viento muy bajo entre árboles (Thimras). Los búhos y el lobo van '
  'sueltos (buho_*, lobo) para que el juego los tire al azar y no se note la vuelta del loop.',
  largo=8.0, xf=1.5)
s('buho_1', 'una', c('wcarter_buho', 'Tawny_owl_Tuntorp.ogg', 0.0, 3.0,
                     af='highpass=f=250'), 'Cárabo común (Strix aluco) real llamando de noche en Suecia.')
s('buho_2', 'una', c('wcarter_buho', 'Tawny_owl_Tuntorp.ogg', 0.0, 3.0,
                     af='highpass=f=250'), 'Otro llamado del mismo cárabo.')
s('lobo', 'una', c('usfws_lobo', 'Wolf_howls.ogg', 0.0, 4.0, af='lowpass=f=3500'),
  'Lobos reales aullando (USFWS), un tramo de 4 s con fundido; filtrado para que suene lejos.', maximo=4.0, cola=0.8)
for n, a in enumerate(['wood_breaking_01.ogg', 'wood_breaking_02.ogg', 'wood_cracking_03.ogg', 'wood_cracking_04.ogg'], 1):
    s(f'rama_quiebra_{n}', 'una', c('rubberduck_mw', a),
      'Madera real que se quiebra' + (' (astilla grande).' if 'breaking' in a else ' (chasquido seco, rama fina).'))
for n, (fu, a) in enumerate([('rustle', 'rustle03.flac'), ('rustle', 'rustle08.flac'),
                             ('haeldb', 'moving leaves stereo.ogg'), ('tinyworlds_hojas', 'leaves01.ogg')], 1):
    s(f'arbusto_{n}', 'una', c(fu, a),
      'Hojas secas y ramitas que se mueven (alguien pasando entre arbustos).', maximo=1.6)
s('lluvia', 'loop', c('ylmir', '1.ogg', 4.0, fondo=True), 'Lluvia pareja grabada, sin truenos.', largo=6.0, xf=1.2)
s('trueno', 'una', c('inspectorj', 'Thunder, Very Close, Rain, 01.wav', 0.7, 3.5),
  'Trueno muy cercano con lluvia (el mismo de Isla Royale), recortado a 3,5 s con fundido.', maximo=3.5)

# ======================= TENSIÓN =======================
s('latido', 'loop', c('bart_latido', 'heartbeat_slow_0.wav', 0.0, None, fondo=True),
  'SÍNTESIS del autor (FL Studio): latido lento, ~67 por minuto, ya hecho loop.', largo=None, xf=0.0)
s('latido_rapido', 'loop', c('bart_latido', 'heartbeat_fast_0.wav', 0.0, None, fondo=True),
  'SÍNTESIS del autor (FL Studio): latido agitado, ~107 por minuto, ya hecho loop.', largo=None, xf=0.0)
RESP = ['Breath_Scared_13.wav', 'Breath_Scared_10.wav', 'Breath_Scared_15.wav', 'Breath_Scared_12.wav']
s('respiracion', 'loop', [c('lrsf', a, en=t) for a, t in zip(RESP, [0.0, 1.75, 3.25, 4.45])],
  'MONTAJE: cuatro respiraciones asustadas reales (inspirar y exhalar) seguidas, grabadas por Little Robot Sound Factory.',
  largo=5.7, xf=0.0, q='media')
s('drone_1', 'loop', c('qubodup_atmos', 'atmoseerie01.mp3.flac', 2.0, fondo=True),
  'Dron grave y quieto ("atmoseerie01"). Es sonido de diseño/síntesis, no una grabación de campo.',
  largo=10.0, xf=2.0, q='minima', lufs=-20)
s('drone_2', 'loop', c('tinyworlds_horror', 'horror_effect1.wav', 4.7, fondo=True, af='lowpass=f=3200'),
  'SÍNTESIS del autor: acorde grave con armónicos hasta 3 kHz, tenso. Se usa el tramo parejo entre dos chasquidos del original.',
  largo=6.0, xf=1.5, q='minima', lufs=-20)
s('drone_3', 'loop', c('wortmann', 'dark_cavern_ambient_002.ogg', 20.0, fondo=True),
  'Ambiente oscuro de caverna armado por el autor con otras grabaciones CC0 (gemidos fantasma procesados, maderas); '
  'sirve de dron para la mina. Es diseño de sonido, no una grabación.', largo=10.0, xf=2.0, q='baja', lufs=-20)
s('susto_1', 'una', [c('psychhead', 'Mid 2.wav'), c('psychhead', 'Very Bassy 3.wav', db=-2)],
  'MONTAJE de dos golpes de susto del mismo paquete (hecho con BandLab: síntesis/diseño, no grabado).', maximo=2.5)
s('susto_2', 'una', [c('psychhead', 'High 2.wav'), c('psychhead', 'Bassy 4.wav', db=-2)],
  'MONTAJE de dos golpes de susto del mismo paquete (síntesis/diseño), más agudo que susto_1.', maximo=2.5)
s('grito_lejano_1', 'una', c('nocturnal', 'female_scream_1.ogg'),
  'Grito real de mujer (actuado), procesado para que suene lejos entre los árboles: sin agudos y con rebote.',
  af=LEJOS, cola=1.0)
s('grito_lejano_2', 'una', c('arcadeparty', 'humanYell1.wav'),
  'Grito real de hombre (actuado), procesado para que suene lejos.', af=LEJOS, cola=1.0)
s('susurros', 'loop', c('eugeneloza', 'a2-scared.ogg', 3.0, fondo=True, af='highpass=f=180'),
  'Voz real susurrando "lorem ipsum" (no se entienden palabras). La grabó el autor para un juego lovecraftiano.',
  largo=6.0, xf=1.0, lufs=-20)
s('susurro_1', 'una', c('eugeneloza', 'a3-menacing.ogg', 9.0, 2.6, af='highpass=f=180'),
  'Un susurro amenazante suelto de la misma voz.', maximo=2.6)
s('risa_montanes_1', 'una', c('antum_risa', 'laugh-evil-1_0.ogg', af='asetrate=32000*0.88,aresample=32000'),
  'Risa real de hombre, bajada un 12% de tono para que suene más gruesa. Actuada, no es de un monstruo.')
s('risa_montanes_2', 'una', c('antum_risa2', 'evil_laugh_02.flac', af='asetrate=32000*0.9,aresample=32000'),
  'Otra risa real de hombre, bajada un 10% de tono.')
for n, (fu, a) in enumerate([('emopreben', 'ZombieMoans - Track 7 - ZombieMoan3.wav'),
                             ('emopreben', 'ZombieMoans - Track 5 - ZombieMoan1.wav'),
                             ('artisticdude_z', 'zombie-4.wav'), ('artisticdude_z', 'zombie-2.wav')], 1):
    s(f'grunido_{n}', 'una', c(fu, a),
      'Gruñido gutural hecho con voz humana real (vendido como "zombie"): suena a hombre, no a bestia.')
PASOS_CARRERA = [('Fantozzi-SandL1.flac', 0), ('Fantozzi-SandR1.flac', -2), ('Fantozzi-SandL2.flac', -1),
                 ('Fantozzi-SandR2.flac', -3), ('Fantozzi-SandL3.flac', 0), ('Fantozzi-SandR3.flac', -2),
                 ('Fantozzi-SandL1.flac', -2), ('Fantozzi-SandR2.flac', -1)]
s('pasos_corriendo', 'loop', [c('fantozzi', a, en=i * 0.36 + (0.02 if i % 2 else 0), db=d, af='lowpass=f=5000')
                              for i, (a, d) in enumerate(PASOS_CARRERA)]
                             + [c('rustle', 'rustle05.flac', 0.0, 1.4, en=0.1, db=-8),
                                c('rustle', 'rustle11.flac', 0.0, 1.2, en=1.6, db=-10)],
  'MONTAJE: ocho pisadas reales sobre arena/tierra a ritmo de carrera (~2,8 por segundo) con hojas secas encima. '
  'Es una aproximación: no se consiguió una grabación de alguien corriendo en un pinar.', largo=2.88, xf=0.0, q='alta')
s('silbido_lejano', 'una', c('sintesis', 'silbido'),
  'SÍNTESIS: silbido humano de dos notas (tono puro con vibrato y soplido de aire), con eco de bosque. '
  'No se consiguió un silbido humano grabado CC0/CC-BY.', af=LEJOS, cola=1.0)

# ======================= JUGADOR =======================
for n, a in enumerate(['footstep00.ogg', 'footstep01.ogg', 'footstep02.ogg', 'footstep03.ogg'], 1):
    s(f'pasos_tierra_{n}', 'una', c('k_rpg', a, af='lowpass=f=6000'), 'Pisada (talón y punta) sobre tierra firme; un poco oscurecida.')
for n in range(1, 5):
    # Los footstep_wood de Kenney son casi un golpe grave sin agudos; estos
    # tienen el crujido de tabla que se espera de un piso de madera.
    s(f'pasos_madera_{n}', 'una', c('rubberduck2', f'sfx100v2_footstep_wood_0{n}.ogg'), 'Pisada sobre un piso de tablas.')
for n, a in enumerate(['Fantozzi-StoneL1.flac', 'Fantozzi-StoneR1.flac', 'Fantozzi-StoneL2.flac', 'Fantozzi-StoneR2.flac'], 1):
    s(f'pasos_piedra_{n}', 'una', c('fantozzi', a), 'Pisada sobre piedra con arenilla.')
for n in range(1, 5):
    s(f'pasos_nieve_{n}', 'una', c('k_impact', f'footstep_snow_00{n - 1}.ogg'), 'Pisada que cruje sobre nieve.')
for n, a in enumerate(['sfx100v2_footstep_wet_02.ogg', 'sfx100v2_footstep_wet_03.ogg'], 1):
    s(f'pasos_agua_{n}', 'una', c('rubberduck2', a), 'Pisada en agua poco profunda / charco.')
s('aterrizaje', 'una', [c('k_impact', 'impactSoft_heavy_001.ogg'), c('k_rpg', 'footstep02.ogg', en=0.01, db=-2),
                        c('k_rpg', 'cloth3.ogg', en=0.03, db=-8)],
  'MONTAJE: golpe sordo grave + pisada en tierra + roce de ropa: caer de un salto.')
s('mochila', 'una', c('antum_cierre', 'zipper-1.wav'), 'Cierre (cremallera) real que se abre: la mochila.')
s('ropa_1', 'una', c('k_rpg', 'cloth1.ogg'), 'Roce de ropa.')
s('ropa_2', 'una', c('k_rpg', 'cloth3.ogg'), 'Roce de ropa, más corto.')
s('linterna_clic_1', 'una', c('rubberduck1', 'switch_01.ogg'), 'Clic de un interruptor real.')
s('linterna_clic_2', 'una', c('rubberduck1', 'switch_02.ogg'), 'Clic de otro interruptor real (suena distinto al de prender).')
s('linterna_bateria', 'una', c('bmaczero_mec', 'lightclunk1.wav'),
  'APROXIMACIÓN: dos golpecitos plásticos/metálicos cortos, como meter pilas y cerrar la tapa. No es una linterna.')
s('recoger', 'una', c('k_rpg', 'handleSmallLeather.ogg'), 'Agarrar un objeto chico (cuero y roce).')
s('inventario', 'una', c('k_rpg', 'clothBelt.ogg'), 'Revolver en un bolso: tela y hebilla.')
s('papel', 'una', c('rubberduck1', 'paper_01.ogg'), 'Hoja de papel que se agarra y se despliega.')
s('vendaje', 'una', [c('luckius', 'Paper Ripped - 1.wav'), c('k_rpg', 'cloth1.ogg', en=0.45, db=-4)],
  'APROXIMACIÓN (montaje): papel que se rasga (el envoltorio) y tela: vendarse. No es una venda grabada.')
s('comer', 'una', [c('k_impact', 'impactTin_medium_001.ogg', db=-6), c('rubberduck_criatura', 'eat_01.ogg', en=0.2)],
  'MONTAJE: cuchara contra una lata (Kenney) y alguien masticando (rubberduck).')

# ======================= COMBATE =======================
s('disparo_pistola', 'una', c('tabasco', 'cz.wav', 0.2, 1.8), 'Pistola CZ-52 real en un polígono, con el eco del lugar.')
s('disparo_escopeta', 'una', c('tabasco', 'shotty.wav', 0.1), 'Escopeta real; el grabador saturó un poco.')
s('disparo_rifle', 'una', c('tabasco', 'sks.wav', 0.3, 1.9), 'Rifle semiautomático SKS real.')
s('recarga_pistola', 'una', c('zer0sol', 'reload.wav'), 'Recarga de pistola: cargador afuera, adentro y corredera.')
s('recarga_escopeta', 'una', [c('zer0sol_escopeta', 'Shell in Chamber.mp3'), c('zer0sol_escopeta', 'Rack.mp3', en=0.55)],
  'MONTAJE de la misma serie: un cartucho que entra y el "rack" de la corredera.')
s('recarga_rifle', 'una', c('tabasco', 'mosin.wav', 1.35, 1.7),
  'Cerrojo de un Mosin-Nagant real (la parte de después del tiro de la misma grabación).')
s('arma_vacia', 'una', c('qubodup_clics', 'outofammo.wav'), 'Clic metálico de un arma sin balas.')
for n, (a, d) in enumerate([('sfx100v2_air_03.ogg', None), ('sfx100v2_air_02.ogg', 0.45)], 1):
    s(f'hacha_aire_{n}', 'una', c('rubberduck2', a, 0.0, d, af='asetrate=32000*0.8,aresample=32000,lowpass=f=4000'),
      'Soplido real de algo que corta el aire, bajado de tono para que suene a una herramienta pesada.')
for n, a in enumerate(['qubodupImpactMeat01.flac', 'qubodupImpactMeat02.flac'], 1):
    s(f'impacto_carne_{n}', 'una', c('qubodup_impacto', a, af='lowpass=f=4000'),
      'Golpe sordo en carne (real), oscurecido para que no sea exagerado.')
s('impacto_madera_1', 'una', c('kheetor', 'chop-tree-fall.ogg', 0.0, 0.45), 'Hachazo real en un tronco (el primer golpe de la grabación).')
s('impacto_madera_2', 'una', c('qubodup_impacto', 'qubodupImpactWood.flac'), 'Golpe seco en madera.')
for n, a in enumerate(['qubodupPunch02.flac', 'qubodupPunch04.flac'], 1):
    s(f'golpe_recibido_{n}', 'una', c('qubodup_pina', a), 'Golpe real al cuerpo.')
s('caida_cuerpo', 'una', [c('k_impact', 'impactSoft_heavy_000.ogg'), c('k_impact', 'impactPunch_heavy_000.ogg', en=0.02, db=-6),
                          c('k_rpg', 'cloth1.ogg', en=0.05, db=-6), c('k_impact', 'impactSoft_medium_001.ogg', en=0.32, db=-8)],
  'MONTAJE: golpe grave, golpe de cuerpo, ropa y un segundo rebote: un cuerpo que cae al piso.')

# ======================= MUNDO =======================
s('puerta_cruje', 'una', c('fractile', 'creakylightwoodendoor.wav', 0.0, 3.2),
  'Puerta de un mueble de madera que se abre despacio y cruje (el autor grabó un armario). Se usa para la puerta lenta.', maximo=3.2)
s('puerta_golpe', 'una', c('qubodup_puertas', 'qubodup-DoorClose01.ogg'), 'Puerta de madera que se cierra.')
s('portazo', 'una', c('qubodup_puertas', 'qubodup-DoorClose06.ogg'), 'Portazo fuerte.')
s('ventana_golpe_1', 'una', [c('rubberduck_mw', 'wood_slam_01.ogg'), c('qubodup_tambaleo', 'qubodup-wobble1.wav', en=0.06, db=-8)],
  'MONTAJE: golpe de madera y traqueteo de algo flojo: el postigo de una ventana que golpea con el viento.')
s('ventana_golpe_2', 'una', [c('rubberduck_mw', 'wood_slam_04.ogg'), c('qubodup_tambaleo', 'qubodup-wobble2.wav', en=0.05, db=-8)],
  'MONTAJE: otra variante del postigo que golpea.')
s('trampa_oso', 'una', [c('rubberduck_mw', 'metal_slam_01.ogg'), c('rubberduck_mw', 'metal_spring_01.ogg', en=0.03, db=-4),
                        c('rubberduck_rpg', 'chain_02.ogg', en=0.1, db=-8)],
  'APROXIMACIÓN (montaje): golpe metálico seco + resorte + cadena. No se consiguió una trampa de oso grabada.')
s('latas_1', 'una', [c('k_impact', 'impactTin_medium_000.ogg'), c('k_impact', 'impactTin_medium_003.ogg', en=0.07, db=-3),
                     c('k_impact', 'impactTin_medium_001.ogg', en=0.16, db=-5), c('k_impact', 'impactTin_medium_004.ogg', en=0.27, db=-8)],
  'MONTAJE: cuatro golpes de lata encadenados: la trampa de ruido de latas colgadas.')
s('latas_2', 'una', [c('k_impact', 'impactTin_medium_002.ogg'), c('k_impact', 'impactTin_medium_004.ogg', en=0.09, db=-2),
                     c('k_impact', 'impactTin_medium_000.ogg', en=0.21, db=-6)],
  'MONTAJE: otra variante de las latas.')
s('cadenas_1', 'una', c('rubberduck_rpg', 'chain_01.ogg'), 'Cadena que se mueve.')
s('cadenas_2', 'una', c('rubberduck_rpg', 'chain_03.ogg'), 'Cadena que se arrastra.')
s('motor_no_arranca', 'una', c('looneybits_arranque', 'generic_car_startengine_1.wav', 0.0, 0.62, rep=(3, 0.6)),
  'MONTAJE: el burro de arranque de un auto real girando sin que el motor prenda (el mismo tramo tres veces).', maximo=2.5)
s('motor_arranca', 'una', c('looneybits_arranque2', 'engine_start_up_01.wav'), 'Arranque real: el burro gira y el motor prende.')
s('motor_marcha', 'loop', c('ggbotnet', 'Car_Engine_Loop.ogg', 0.2, fondo=True),
  'Motor de auto real en marcha (grabado con celular).', largo=2.5, xf=0.3)
s('puerta_camioneta', 'una', c('ggbotnet', 'Car_Door_Close.ogg'), 'Portazo de auto real (celular).')
s('bocina_vieja', 'una', c('ggbotnet', 'Car_Horn.ogg', af='highpass=f=350,lowpass=f=3000'),
  'Bocinazo de auto real recortado a banda media para que suene más viejo y chiquito.')
s('grua_motor', 'loop', c('bart_maquinas', 'motor_1.wav', 3.5, fondo=True, af='lowpass=f=5000'),
  'Motor eléctrico/máquina grabado (archivo del OLPC). APROXIMACIÓN: se usa para el motor de la grúa.', largo=4.0, xf=0.5)
s('grua_bomba', 'loop', c('rubberduck_loops', 'pump_01.ogg', 0.0, fondo=True),
  'Bomba mecánica andando, ya en loop. APROXIMACIÓN a la bomba hidráulica.', largo=None, xf=0.0)
s('grua_chirrido', 'una', c('bart_cabrestante', 'winch - Marker #5.wav'),
  'Cabrestante con cadena real: chirrido metálico con traqueteo, para el brazo de la grúa.', maximo=2.0)
s('generador', 'loop', c('ycbcr', 'loop_generator_1.mp3', 0.1, fondo=True),
  'Generador eléctrico andando. Venía como loop, pero el mp3 trae relleno del codificador en las puntas: se vuelve a empalmar.',
  largo=4.5, xf=0.4)
s('fogata', 'loop', c('pagdev', 'fire.wav', 20.0, fondo=True), 'Fuego de leña crepitando.', largo=5.0, xf=1.0)
s('mina_eco', 'loop', [c('qubodup_goteo', 'atmosbasement.mp3_.flac', 0.5, fondo=True),
                      c('jaggedstone', 'dungeon_ambient_1_0.ogg', 0.0, fondo=True, db=-6, af='lowpass=f=1500')],
  'MONTAJE: goteos reales resonando en un sótano (qubodup) sobre el retumbe grave de un ambiente de mazmorra (JaggedStone): '
  'interior de mina con eco.', largo=6.5, xf=0.5, lufs=-20)
for n, a in enumerate(['Blood_Drip_01.wav', 'Blood_Drip_04.wav', 'Blood_Drip_09.wav'], 1):
    s(f'mina_goteo_{n}', 'una', c('lrsf', a),
      'Gota de líquido que cae (se vende como sangre; suena a gota de agua), con eco de galería.', af=CUEVA, cola=0.6)
s('vagoneta', 'loop', [c('qubodup_bocha', 'qubodup-bowling_roll-nofadeout.ogg', 0.6, fondo=True, af='lowpass=f=2500'),
                      c('k_impact', 'impactMetal_heavy_000.ogg', en=0.0, db=-6, af='lowpass=f=1800'),
                      c('k_impact', 'impactMetal_heavy_002.ogg', en=0.14, db=-8, af='lowpass=f=1800'),
                      c('k_impact', 'impactMetal_heavy_000.ogg', en=1.0, db=-7, af='lowpass=f=1800'),
                      c('k_impact', 'impactMetal_heavy_002.ogg', en=1.14, db=-9, af='lowpass=f=1800')],
  'APROXIMACIÓN (montaje): bola rodando (retumbe) + golpes metálicos sordos a ritmo de juntas de riel, con eco de galería. No es una vagoneta.',
  largo=2.0, xf=0.4, af=CUEVA)
s('jaula_abre', 'una', c('rubberduck_mw', 'metal_open_01.ogg'), 'Puerta de reja metálica que se abre.')
s('campana', 'una', c('rubberduck1', 'bell_01.ogg', 0.0, 0.9, rep=(5, 0.42)),
  'MONTAJE: una campana real golpeada cinco veces seguidas, como el aviso de un vigía.', maximo=3.5)

# ======================= INTERFAZ =======================
s('ui_clic', 'una', c('k_uia', 'click3.ogg'), 'Clic de interfaz, mecánico y seco.')
s('ui_confirmar', 'una', c('k_ui', 'confirmation_001.ogg'), 'Confirmación de interfaz: tono grave que sube (sintético).')
s('ui_atras', 'una', c('k_uia', 'switch2.ogg', af='asetrate=32000*0.85,aresample=32000'), 'Atrás: clic de llave, más grave que el de avanzar.')
s('titulo', 'una', [c('psychhead', 'Very Bassy 1.wav'), c('psychhead', 'Mid 1.wav', db=-8)],
  'MONTAJE de dos golpes graves de terror (síntesis/diseño): el golpe al aparecer la pantalla de título.', maximo=3.0)
s('menu_tema', 'loop', c('kauffman', 'ambient_horror_track01.wav', 2.5, fondo=True),
  'Música: pista de terror ambiental pensada por el autor para menú. Se saca el fundido de entrada y se empalma el final sobre el principio.',
  largo=32.0, xf=2.0, q='baja', lufs=-18)


# ---------------------------------------------------------------------------
# Motor
# ---------------------------------------------------------------------------
_rutas = {}
def ruta(fuente, archivo):
    if fuente == 'sintesis':
        return None
    d = os.path.join(ORIG, F[fuente]['dir'])
    exacta = os.path.join(d, archivo)
    if os.path.exists(exacta):
        return exacta
    clave = (d, archivo)
    if clave not in _rutas:
        c_ = [p for p in glob.glob(os.path.join(glob.escape(d), '**', glob.escape(archivo)), recursive=True)
              if not os.path.basename(p).startswith('._') and '__MACOSX' not in p]
        if len(c_) != 1:
            sys.exit(f'{fuente}/{archivo}: {len(c_)} coincidencias en {d}')
        _rutas[clave] = c_[0]
    return _rutas[clave]


def filtrar(x, af):
    """Filtro de ffmpeg sobre audio ya a 32 kHz."""
    if not af or len(x) == 0:
        return x
    p = subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', af,
                        '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                       input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)


def filtrar_circular(x, af):
    """Para loops: se filtra el loop repetido tres veces y se queda la copia del
    medio, así el eco de la vuelta anterior entra al principio y no hay salto."""
    if not af:
        return x
    n = len(x)
    y = filtrar(np.tile(x, 3), af)
    return y[n:2 * n] if len(y) >= 2 * n else x


def silbido():
    """Silbido humano de dos notas (sube y baja), con vibrato leve y soplido.
    Por qué así: un silbido es casi un seno puro de 1-2,5 kHz; lo que lo hace
    humano es el ataque blando, el vibrato irregular y el aire alrededor."""
    rng = np.random.default_rng(11)
    notas = [(0.0, 0.42, 1480, 1760), (0.55, 0.75, 1760, 1320)]  # (inicio, dur, f0, f1)
    x = np.zeros(int(1.5 * SR))
    for t0, d, f0, f1 in notas:
        n = int(d * SR); t = np.arange(n) / SR
        fr = f0 + (f1 - f0) * (0.5 - 0.5 * np.cos(np.pi * np.clip(t / (d * 0.35), 0, 1)))
        fr = fr * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * t + rng.uniform(0, 6)))
        fase = 2 * np.pi * np.cumsum(fr) / SR
        env = np.minimum(1, t / 0.06) * np.minimum(1, (d - t) / 0.12) ** 1.5
        tono = np.sin(fase) * env * (1 + 0.1 * rng.standard_normal(n).cumsum() / np.sqrt(np.arange(1, n + 1)))
        aire = filtrar(rng.standard_normal(n) * 0.04, 'bandpass=f=1600:width_type=h:w=1200') * env
        i = int(t0 * SR)
        x[i:i + n] += tono * 0.5 + aire
    return x


def buho():
    """Respaldo si Commons no deja bajar el búho: ulular de búho grande
    ("hu... hu-hu... huuu"), seno de ~380 Hz que cae un poco al final de cada
    nota, con ataque blando y soplido. Solo se usa si falta la grabación."""
    rng = np.random.default_rng(7)
    notas = [(0.0, 0.32), (0.55, 0.16), (0.75, 0.16), (1.05, 0.55)]
    x = np.zeros(int(2.0 * SR))
    for t0, d in notas:
        n = int(d * SR); t = np.arange(n) / SR
        fr = 385 - 25 * (t / d) ** 2
        env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.2
        tono = (np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.12 * np.sin(4 * np.pi * np.cumsum(fr) / SR)) * env
        aire = filtrar(rng.standard_normal(n) * 0.03, 'bandpass=f=400:width_type=h:w=300') * env
        i = int(t0 * SR); x[i:i + n] += tono * 0.5 + aire
    return x


SINTESIS = dict(silbido=silbido, buho=buho)


def capa(k):
    if k['fuente'] == 'sintesis':
        y = SINTESIS[k['archivo']]()
    else:
        y = P.decodificar(ruta(k['fuente'], k['archivo']), k['ss'], k['dur'])
    y = filtrar(y, k['af'])
    if k['rep']:
        veces, cada = k['rep']; paso = int(cada * SR)
        z = np.zeros(paso * (veces - 1) + len(y))
        for i in range(veces):
            z[i * paso:i * paso + len(y)] += y
        y = z
    return y * 10 ** (k['db'] / 20)


def armar_loop(e):
    L = e['largo']
    fondos = [k for k in e['capas'] if k['fondo']]
    if L is None:  # el original ya es un loop: se usa entero
        x = capa(fondos[0])
        return x - np.mean(x)
    n = int(round(L * SR))
    mezcla = np.zeros(n)
    for k in e['capas']:
        if k['fondo']:
            k2 = dict(k, dur=L + e['xf'])
            y = capa(k2)
            y = y - np.mean(y)
            y = P.fundido_loop(y, e['xf']) if e['xf'] else y
            y = np.resize(y, n) if len(y) < n else y[:n]
            mezcla += y
        else:  # evento suelto en un búfer circular
            y = P.fundidos(capa(k), 0.002, 0.02)
            i0 = int(round(k['en'] * SR))
            idx = (i0 + np.arange(len(y))) % n
            np.add.at(mezcla, idx, y)
    return mezcla


def armar_una(e):
    partes = [(int(round(k['en'] * SR)), capa(k)) for k in e['capas']]
    n = max(i + len(y) for i, y in partes)
    x = np.zeros(n)
    for i, y in partes:
        x[i:i + len(y)] += y
    return x


def procesar(e):
    if e['tipo'] == 'loop':
        x = armar_loop(e)
        x = filtrar_circular(x, e['af'])
        x = x - np.mean(x)
    else:
        x = armar_una(e)
        if e['af']:
            x = filtrar(np.concatenate([x, np.zeros(int(e['cola'] * SR))]), e['af'])
        if e['recortar']:
            x = P.recortar_silencio(x)
        if len(x) > e['maximo'] * SR:
            x = P.fundidos(x[:int(e['maximo'] * SR)], sal=0.4)
        else:
            x = P.fundidos(x)
    guardado = P.LUFS_OBJETIVO
    if e['lufs'] is not None:
        P.LUFS_OBJETIVO = e['lufs']
    try:
        x = P.normalizar(x, loop=e['tipo'] == 'loop')
    finally:
        P.LUFS_OBJETIVO = guardado
    return rotar_al_silencio(x) if e['tipo'] == 'loop' else x


def rotar_al_silencio(x):
    """El mp3 reconstruye mal las primeras y últimas muestras del archivo (le
    falta el solapamiento del cuadro anterior): en un loop eso es un clic en
    cada vuelta, medido en 20-30 veces el agudo más fuerte del resto en el dron
    de la mina y el generador. Como el loop es circular, se puede empezar en
    cualquier punto sin cambiar lo que suena: se elige el momento más callado
    (energía en 5 ms) y ahí queda la vuelta, donde el error del mp3 es mínimo."""
    w = int(0.005 * SR)
    e = np.convolve(np.tile(x, 2) ** 2, np.ones(w), 'same')[len(x) // 2: len(x) // 2 + len(x)]
    i = (int(np.argmin(e)) + len(x) // 2) % len(x)
    # dentro de esa ventana, el cruce por cero más cercano
    j = i + int(np.argmin(np.abs(np.take(x, range(i - w // 2, i + w // 2), mode='wrap')))) - w // 2
    return np.roll(x, -(j % len(x)))


# alta: efectos cortos; media: efectos de más de 1 s; ambiente: loops de ruido
# (viento, agua) donde 40 kbps no se nota; baja y minima: drones y música, casi
# todo grave (22,05 y 16 kHz de muestreo alcanzan).
CALIDAD = dict(alta=(64, 32000), media=(48, 32000), ambiente=(40, 32000), baja=(32, 22050), minima=(24, 16000))


def codificar(x, salida, q):
    kbps, sr = CALIDAD[q]
    with tempfile.NamedTemporaryFile(suffix='.f32') as t:
        t.write(x.astype(np.float32).tobytes()); t.flush()
        subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', t.name,
                        '-codec:a', 'libmp3lame', '-b:a', f'{kbps}k', '-ar', str(sr), '-ac', '1', salida], check=True)


def empalme(x):
    """Salto en la vuelta del loop comparado con el salto típico entre muestras
    (percentil 99). Menos de ~1 = no se nota."""
    d = np.abs(np.diff(x))
    return abs(x[-1] - x[0]) / (np.percentile(d, 99) + 1e-12)


# Título de la obra de cada fuente que pide atribución (CC-BY) o que conviene
# nombrar (dominio público), para el texto listo para pegar de CREDITOS.md.
OBRAS = {
    'inspectorj': ('"Thunder, Very Close, Rain, 01.wav"', ''),
    'lamoot': ('"Ambient Mountain, River, Wind and Forest and Waterfall" (sonidos del juego Yo Frankie!)', ''),
    'kurt_rio': ('"Stream Sounds"', ''),
    'arwen': ('"Storm Arwen 2022"', ''),
    'lrsf': ('"Horror Sound Effects Library"', ''),
    'qubodup_clics': ('"2 metal weapon clicks"', ''),
    'fractile': ('"Creaky light wooden door"', ''),
    'bart_maquinas': ('"13 Ambient Machine Sounds"',
                      ' Atribución completa que pide la página: "A collection of sounds that have been selected, organized and '
                      'prepared for OLPC by Dr. Richard Boulanger (a.k.a. Dr.B.). From 1999 - 2007, these samples were recorded in '
                      'The Berklee Studios and on location in and around Boston under the supervision of Associate Professor '
                      'Michael Brigida by over 250 Music Synthesis majors taking his Advanced Sampling Class at The Berklee '
                      'College of Music. Editing and trimming these original, long, and often meandering recordings into usable '
                      'individual samples was done by Music Synthesis students - Diane Douglas and Colman O\'Reilly."'),
    'wcarter_buho': ('"Tawny owl calling at night in Tuntorp, Brastad, Sweden"', ''),
    'bl_buho': ('"Cape Eagle Owl (Bubo capensis) (W1CDR0001437 BD2)"', ''),
    'usfws_lobo': ('"Wolf howls"', ''),
}
LIC_URL = {'CC-BY 3.0': 'https://creativecommons.org/licenses/by/3.0/', 'CC-BY 4.0': 'https://creativecommons.org/licenses/by/4.0/'}


def escribir_creditos(manifiesto):
    """CREDITOS.md sale del manifiesto, así nunca queda desfasado de lo que hay."""
    usos = {}
    for m in manifiesto:
        e = next(x for x in S if x['id'] == m['id'])
        for k in e['capas']:
            usos.setdefault(k['fuente'], [])
            if m['id'] not in usos[k['fuente']]: usos[k['fuente']].append(m['id'])
    total = sum(os.path.getsize(os.path.join(BASE, m['archivo'])) for m in manifiesto)
    L = ['# Créditos de los sonidos de LOS MONTES', '',
         f'{len(manifiesto)} archivos en `sonidos/los-montes/`, {total / 1024:.0f} KB de mp3 en total. Grabaciones (o, donde se '
         'aclara, sonidos generados) con licencia libre, bajadas de [OpenGameArt](https://opengameart.org), '
         '[Kenney](https://kenney.nl) y [Wikimedia Commons](https://commons.wikimedia.org) el 28/9/2026. La licencia se '
         'verificó en la página de cada una. La receta (tramos, filtros, mezclas, volumen, empalme de loops) está en '
         '`procesar.py`, y el detalle archivo por archivo, con la nota de qué es aproximación o síntesis, en `manifiesto.json`.',
         '', '## Obligatorios (CC-BY): hay que mostrarlos en el juego', '',
         'CC-BY pide nombrar al autor, la obra y la licencia, y decir que se modificó. Texto listo para pegar en la pantalla de créditos:', '']
    for k, (obra, extra) in OBRAS.items():
        fu = F[k]
        if k not in usos or not fu['licencia'].startswith('CC-BY'): continue
        L.append(f'- {obra} de {fu["autor"]}, licencia [{fu["licencia"]}]({LIC_URL[fu["licencia"]]}), {fu["fuente"]} — '
                 f'recortado, mezclado y normalizado.{extra} Usado en: ' + ', '.join(f'`{i}`' for i in usos[k]) + '.')
    pd = [k for k in OBRAS if k in usos and F[k]['licencia'] == 'Dominio público']
    if pd:
        L += ['', '## Dominio público (no obligatorio, pero se nombra)', '']
        for k in pd:
            fu = F[k]
            L.append(f'- {OBRAS[k][0]} — {fu["autor"]}, {fu["fuente"]}. {fu["lic_nota"]} Usado en: '
                     + ', '.join(f'`{i}`' for i in usos[k]) + '.')
    L += ['', '## CC0 (no obligatorios, pero se agradecen)', '']
    vistos = {}
    for k, ids in usos.items():
        fu = F[k]
        if fu['licencia'] != 'CC0': continue
        clave = (fu['autor'], fu['fuente'])
        vistos.setdefault(clave, []).extend(i for i in ids if i not in vistos.get(clave, []))
    for (autor, fuente), ids in vistos.items():
        L.append(f'- {autor} — {fuente} — ' + ', '.join(f'`{i}`' for i in ids))
    L += ['', '## Qué es aproximación, montaje o síntesis', '']
    for m in manifiesto:
        if re.search(r'APROXIMACIÓN|MONTAJE|SÍNTESIS|síntesis|Música', m['nota']):
            L.append(f'- `{m["id"]}`: {m["nota"]}')
    L += ['', '## Para usarlos en el juego', '',
          '```sh', f'python3 sonidos/incrustar.py {JUEGO} <carpeta-del-juego>/js/sonidos.js', '```', '',
          'Genera `SONIDOS_B64` (mp3 en base64, para `decodeAudioData`) y `SONIDOS_CREDITOS` (los que no son CC0, '
          'para la pantalla de créditos). Los loops se tocan con `AudioBufferSource.loop = true`: empalman sin clic '
          '(la vuelta de cada loop quedó en su momento más callado, donde el mp3 no mete error).', '']
    with open(os.path.join(AQUI, 'CREDITOS.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(L))


def main():
    hojas = sys.argv[sys.argv.index('--hojas') + 1] if '--hojas' in sys.argv else None
    solo = set(sys.argv[sys.argv.index('--solo') + 1].split(',')) if '--solo' in sys.argv else None
    # --faltantes: saltea (y lista) los sonidos cuyo original no está bajado,
    # para poder avanzar mientras una descarga sigue pendiente.
    faltantes = '--faltantes' in sys.argv
    if hojas: os.makedirs(hojas, exist_ok=True)
    mpath = os.path.join(AQUI, 'manifiesto.json')
    viejo = {m['id']: m for m in json.load(open(mpath))} if solo and os.path.exists(mpath) else {}
    manifiesto = []
    for e in S:
        if solo and e['id'] not in solo:
            if e['id'] in viejo: manifiesto.append(viejo[e['id']])
            continue
        if faltantes:
            falta = [k['archivo'] for k in e['capas'] if k['fuente'] != 'sintesis' and
                     not glob.glob(os.path.join(glob.escape(os.path.join(ORIG, F[k['fuente']]['dir'])), '**', glob.escape(k['archivo'])), recursive=True)]
            if falta:
                print(f'FALTA {e["id"]}: {falta}'); continue
        x = procesar(e)
        rel = f'{JUEGO}/{e["id"]}.mp3'
        q = e['q'] or ('ambiente' if e['tipo'] == 'loop' else 'alta' if len(x) < SR else 'media')
        codificar(x, os.path.join(BASE, rel), q)
        y = P.decodificar(os.path.join(BASE, rel))
        d = len(y) / SR
        fu = []  # fuentes distintas, en orden de aparición
        for k in e['capas']:
            if F[k['fuente']] not in fu: fu.append(F[k['fuente']])
        libres = [x_['licencia'] for x_ in fu if x_['licencia'] != 'CC0']
        lic = ' + '.join(dict.fromkeys(libres)) if libres else 'CC0'
        if libres and len(fu) > 1:
            autor = '; '.join(f'{x_["autor"]} ({x_["licencia"]})' for x_ in fu)
        else:
            autor = '; '.join(dict.fromkeys(x_['autor'] for x_ in fu))
        nota = e['nota'] + ''.join(' ' + x_['lic_nota'] for x_ in fu if x_.get('lic_nota'))
        original = ', '.join(dict.fromkeys(
            k['archivo'] + (f' [{k["ss"]:g}s+{k["dur"]:g}s]' if k['dur'] else (f' [desde {k["ss"]:g}s]' if k['ss'] else ''))
            for k in e['capas']))
        manifiesto.append(dict(id=e['id'], grupo=re.sub(r'_\d+$', '', e['id']), juego=JUEGO, archivo=rel,
                               tipo=e['tipo'], duracion=round(d, 2), licencia=lic, autor=autor,
                               fuente=' ; '.join(dict.fromkeys(x_['fuente'] for x_ in fu)),
                               original=original, nota=nota.strip()))
        extra = f' empalme {empalme(y):4.2f}x' if e['tipo'] == 'loop' else ''
        print(f'{e["id"]:20s} {e["tipo"]:4s} {d:6.2f}s pico {20*np.log10(np.abs(y).max()+1e-12):5.1f} dB '
              f'LUFS {P.lufs(y) or -99:6.1f} {os.path.getsize(os.path.join(BASE, rel))//1024:4d} KB{extra}', flush=True)
        if hojas:
            P.hoja(y, f'{e["id"]} {d:.2f}s', os.path.join(hojas, f'{e["id"]}.png'))
    with open(mpath, 'w', encoding='utf-8') as fh:
        json.dump(manifiesto, fh, ensure_ascii=False, indent=1)
    escribir_creditos(manifiesto)
    t = sum(os.path.getsize(os.path.join(BASE, m['archivo'])) for m in manifiesto)
    print(f'{JUEGO}: {t/1024:.0f} KB en {len(manifiesto)} archivos')


if __name__ == '__main__':
    main()
