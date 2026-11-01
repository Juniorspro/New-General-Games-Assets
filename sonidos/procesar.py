#!/usr/bin/env python3
"""Rehace la biblioteca de sonidos (sonidos/ruta11, sonidos/estancia, sonidos/isla)
a partir de las grabaciones originales descargadas.

Por qué existe: los originales (wav/flac/ogg de OpenGameArt y Kenney) NO van al
repo —pesan decenas de MB—, así que este script es la receta: qué archivo, qué
tramo, qué filtro. Con los originales a mano, lo corrés y sale exactamente lo
mismo, con manifiesto incluido.

Uso:
    pip install --user imageio-ffmpeg numpy      # ffmpeg sin root
    SONIDOS_ORIG=/ruta/a/orig python3 sonidos/procesar.py [--hojas DIR]

SONIDOS_ORIG apunta a la carpeta con los originales tal como quedan al bajarlos
y descomprimirlos: orig/oga/<slug-de-la-pagina>/<archivo> para los sueltos,
orig/oga/<slug>/<paquete.zip|.7z>_x/... para los comprimidos (se descomprimen
en una carpeta con el nombre del paquete más "_x"), y orig/kenney/<pack>/...
para los zip de Kenney. El campo "dir" de cada FUENTE dice la ruta exacta y
"fuente" la página de donde se baja. --hojas genera un
espectrograma PNG por archivo, que es como se revisó todo sin poder escuchar.

Criterios del procesado (los mismos para todo, para que suene parejo):
  - mono, 32 kHz, mp3 64 kbps: alcanza para efectos y mantiene la biblioteca
    de cada juego en ~1 MB.
  - "una" (efecto suelto): se recortan los silencios de punta y cola (umbral
    -45 dB respecto del pico), fundido corto de entrada y de salida, máximo 4 s.
  - "loop": se toma un tramo de dur+xf segundos y se funde el final sobre el
    principio (fundido de potencia constante), así empalma sin clic.
  - volumen: se busca -16 LUFS integrados, pero sin pasar de -1 dBFS de pico
    (en los golpes secos manda el pico, en los ambientes manda la sonoridad).
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:  # si hay un ffmpeg del sistema, también sirve
    FF = 'ffmpeg'

AQUI = os.path.dirname(os.path.abspath(__file__))
ORIG = os.environ.get('SONIDOS_ORIG', os.path.join(AQUI, 'orig'))
SR = 32000
LUFS_OBJETIVO = -16.0
PICO_MAX_DB = -1.5  # el mp3 sobrepasa ~0,5 dB al codificar; así el pico final queda cerca de -1
UMBRAL_SILENCIO_DB = -45.0
MAX_UNA = 4.0

OGA = 'https://opengameart.org/content/'
KEN = 'https://kenney.nl/assets/'

# ---------------------------------------------------------------------------
# Fuentes: una por página de origen. La licencia se verificó en la página
# (bloque "License(s)" de OpenGameArt, o "License" de Kenney) el 26/9/2026.
# Si la página ofrece varias licencias, se usa la anotada acá (la más libre
# que aceptamos) y se aclara en la nota.
# ---------------------------------------------------------------------------
FUENTES = {
    # --- Kenney (todo CC0) ---
    'k_impact':    dict(licencia='CC0', autor='Kenney (kenney.nl)', fuente=KEN + 'impact-sounds', dir='kenney/impact-sounds/Audio'),
    'k_interface': dict(licencia='CC0', autor='Kenney (kenney.nl)', fuente=KEN + 'interface-sounds', dir='kenney/interface-sounds/Audio'),
    # --- OpenGameArt ---
    'qubodup_motor': dict(licencia='CC-BY 3.0', autor='qubodup', fuente=OGA + 'car-engine-loop-96khz-4s',
                          dir='oga/car-engine-loop-96khz-4s/engine-loop.7z_x/engine-loop',
                          lic_nota='La página ofrece CC-BY 3.0, GPL 3.0 o GPL 2.0; se usa CC-BY 3.0.'),
    'nayckron':    dict(licencia='CC-BY 3.0', autor='Nayckron', fuente=OGA + 'engine-loop-heavy-vehicletank',
                        dir='oga/engine-loop-heavy-vehicletank',
                        lic_nota='La página ofrece CC-BY 3.0 o GPL 3.0; se usa CC-BY 3.0.'),
    'aquinn':      dict(licencia='CC0', autor='aquinn', fuente=OGA + 'sirens-and-alarm-noise', dir='oga/sirens-and-alarm-noise'),
    'xhunterko':   dict(licencia='CC0', autor='xhunterko', fuente=OGA + 'static', dir='oga/static'),
    'testuser':    dict(licencia='CC0', autor='Test User', fuente=OGA + 'beep-sound', dir='oga/beep-sound'),
    'syncopika':   dict(licencia='CC0', autor='syncopika', fuente=OGA + 'cicada-sounds', dir='oga/cicada-sounds'),
    'wolfgang':    dict(licencia='CC0', autor='Wolfgang_', fuente=OGA + 'crickets-ambient-noise-loopable', dir='oga/crickets-ambient-noise-loopable'),
    'sketchman':   dict(licencia='CC0', autor='SketchMan3', fuente=OGA + 'wind-whoosh-loop', dir='oga/wind-whoosh-loop'),
    'ggbotnet':    dict(licencia='CC0', autor='GGBotNet', fuente=OGA + 'car-sound-effects-pack-low-quality',
                        dir='oga/car-sound-effects-pack-low-quality/car_sound_effects_pack.zip_x'),
    'bart_taller': dict(licencia='CC0', autor='bart', fuente=OGA + '68-workshop-sounds', dir='oga/68-workshop-sounds/workshop.7z_x/workshop'),
    'corsica':     dict(licencia='CC0', autor='Corsica_S (extraído por qubodup)', fuente=OGA + '42-snow-and-gravel-footsteps',
                        dir='oga/42-snow-and-gravel-footsteps/corsica_s-walking_in_snow.7z_x/Corsica_S-Walking_in_Snow'),
    'tinyworlds':  dict(licencia='CC0', autor='TinyWorlds', fuente=OGA + 'different-steps-on-wood-stone-leaves-gravel-and-mud',
                        dir='oga/different-steps-on-wood-stone-leaves-gravel-and-mud/[kdd]DifferentSteps_0.zip_x'),
    'dklon_paso':  dict(licencia='CC-BY 3.0', autor='dklon', fuente=OGA + 'stepper-motor-pack-1', dir='oga/stepper-motor-pack-1'),
    'rubberduck2': dict(licencia='CC0', autor='rubberduck', fuente=OGA + '100-cc0-sfx-2', dir='oga/100-cc0-sfx-2/sfx_100_v2.zip_x'),
    'rubberduck1': dict(licencia='CC0', autor='rubberduck', fuente=OGA + '100-cc0-sfx', dir='oga/100-cc0-sfx/100-CC0-SFX_0.zip_x'),
    'rubberduck_mw': dict(licencia='CC0', autor='rubberduck', fuente=OGA + '100-cc0-metal-and-wood-sfx',
                          dir='oga/100-cc0-metal-and-wood-sfx/100-CC0-wood-metal-SFX.zip_x'),
    'rubberduck_agua': dict(licencia='CC0', autor='rubberduck', fuente=OGA + '40-cc0-water-splash-slime-sfx',
                            dir='oga/40-cc0-water-splash-slime-sfx/water-splash-slime-sfx.zip_x'),
    'antum_galope': dict(licencia='CC-BY 3.0', autor='Alan McKinney (alanmcki), editado por AntumDeluge',
                         fuente=OGA + 'horse-gallop-loop', dir='oga/horse-gallop-loop/gallop.zip_x'),
    'haeldb_perro': dict(licencia='CC0', autor='HaelDB', fuente=OGA + 'dog-barking-mono', dir='oga/dog-barking-mono',
                         lic_nota='La página ofrece OGA-BY 3.0 o CC0; se usa CC0.'),
    'isaiah':      dict(licencia='CC0', autor='isaiah658', fuente=OGA + 'ambient-bird-sounds', dir='oga/ambient-bird-sounds'),
    'pagdev':      dict(licencia='CC0', autor='PagDev', fuente=OGA + 'fireplace-sound-loop', dir='oga/fireplace-sound-loop'),
    'qubodup_chapoteo': dict(licencia='CC0', autor='qubodup', fuente=OGA + '6-short-water-splashes',
                             dir='oga/6-short-water-splashes/ezwa-water_splash.7z_x/ezwa-water_splash'),
    'mix2020':     dict(licencia='CC-BY 4.0', autor='mix2020', fuente=OGA + 'jump-rope-swishing', dir='oga/jump-rope-swishing'),
    'bashar':      dict(licencia='CC0', autor='Bashar3A', fuente=OGA + 'mild-wind-background-noise', dir='oga/mild-wind-background-noise'),
    'tabasco':     dict(licencia='CC0', autor='Tabasco', fuente=OGA + 'gunshot-sounds', dir='oga/gunshot-sounds/sounds.zip_x/sounds'),
    'zer0sol':     dict(licencia='CC0', autor='zer0_sol', fuente=OGA + 'handgun-reload-sound-effect', dir='oga/handgun-reload-sound-effect'),
    'oiboo':       dict(licencia='CC0', autor='Oiboo', fuente=OGA + 'open-chest-sfx', dir='oga/open-chest-sfx'),
    'wuxia':       dict(licencia='CC0', autor='WuxiaScrub', fuente=OGA + 'rain-long-thunder', dir='oga/rain-long-thunder'),
    'inspectorj':  dict(licencia='CC-BY 3.0', autor='InspectorJ (www.jshaw.co.uk)', fuente=OGA + 'thunder-very-close-rain-01',
                        dir='oga/thunder-very-close-rain-01'),
    'qubodup_olas': dict(licencia='CC0', autor='jasinski (extraído por qubodup)', fuente=OGA + 'beach-ocean-waves', dir='oga/beach-ocean-waves'),
    'antum_avion': dict(licencia='CC-BY 3.0', autor='jakobthiesen, editado por AntumDeluge', fuente=OGA + 'airplane-prop-loop',
                        dir='oga/airplane-prop-loop'),
    'luke':        dict(licencia='CC0', autor='Luke.RUSTLTD', fuente=OGA + 'wind1', dir='oga/wind1'),
    'fvcalderan':  dict(licencia='CC0', autor='fvcalderan', fuente=OGA + 'classic-fanfare-lick', dir='oga/classic-fanfare-lick'),
    'qubodup_pina': dict(licencia='CC0', autor='qubodup', fuente=OGA + 'punch', dir='oga/punch/qubodupPunch.7z_x/qubodupPunch'),
}

R, E, I = 'ruta11', 'estancia', 'isla'

# ---------------------------------------------------------------------------
# Sonidos. Campos: id, juegos, tipo ('una'|'loop'), fuente, archivo,
# ss (inicio en s), dur (s; None = hasta el final), xf (fundido del loop, s),
# af (filtro ffmpeg extra), nota, repetir (loops: cuántas veces se repite el
# ciclo ya empalmado; sirve para la sirena, que tiene un solo ciclo entero).
# Los tramos se eligieron mirando espectrogramas: dónde está el golpe, dónde
# termina la cola, dónde empieza el siguiente disparo, etc.
# ---------------------------------------------------------------------------
S = []
def s(id, juegos, tipo, fuente, archivo, ss=0.0, dur=None, xf=0.0, af=None, nota='', repetir=1):
    S.append(dict(id=id, juegos=juegos, tipo=tipo, fuente=fuente, archivo=archivo,
                  ss=ss, dur=dur, xf=xf, af=af, nota=nota, repetir=repetir))

# ======================= RUTA 11 =======================
s('motor_auto', [R], 'loop', 'qubodup_motor', 'engine-loop-1.wav', 0, 3.7, 0.3,
  nota='Grabación real de un motor de auto andando, ya pensada como loop.')
s('motor_camion', [R], 'loop', 'nayckron', 'engine_heavy_loop_0.wav', 0, 3.6, 0.3,
  nota='Motor pesado (el autor lo armó para tanque/vehículo pesado a partir de un loop de auto). Pulsante y grave: sirve de diésel, no es una grabación de camión.')
s('sirena', [R], 'loop', 'aquinn', 'siren_0.mp3', 22.0, 2.01, 0.03, repetir=2,
  nota='Un ciclo entero de sirena tipo "wail" (2,01 s, medido en el reinicio del barrido) empalmado y repetido dos veces: en la grabación no hay dos ciclos completos seguidos. Suena electrónica/limpia (parece sintetizada), no grabada en la calle.')
s('radio_estatica', [R], 'loop', 'xhunterko', 'ScatterNoise1.mp3', 5, 4.0, 0.5, af='highpass=f=300,lowpass=f=3400',
  nota='Ruido de estática hecho por el autor; filtrado a banda telefónica (300-3400 Hz) para que suene a handy.')
s('radio_pip', [R], 'una', 'testuser', 'beep.ogg', 0, 0.2, af='highpass=f=300,lowpass=f=3400',
  nota='Tono de ~1 kHz generado (no grabado), recortado a 0,2 s: el "pip" de fin de transmisión.')
s('chicharras', [R], 'loop', 'syncopika', '082526-cicadasounds2_0.ogg', 5, 8.0, 1.0,
  nota='Chicharras grabadas con celular. Banda de 4-7 kHz con pulsos, como en la tarde.')
s('grillos', [R], 'loop', 'wolfgang', 'crickets_1.mp3', 0, 8.0, 1.0,
  nota='Grillos de noche, cri-cri regular a ~3,3 kHz.')
s('viento', [R], 'loop', 'sketchman', 'wind woosh loop.ogg', 0, None, 0.02,
  nota='Viento suave, grave y parejo; ya venía como loop.')
s('puerta_auto', [R], 'una', 'ggbotnet', 'Car_Door_Close.ogg',
  nota='Portazo de auto real grabado con celular (calidad baja pero se reconoce).')
s('baul', [R], 'una', 'ggbotnet', 'Car_Hood_Close.ogg',
  nota='Es el cierre de un capó; se usa como cierre de baúl/portón.')
s('esposas', [R], 'una', 'bart_taller', 'workshop - ratchet1.wav', 0, 1.3,
  nota='Cuatro clics de una llave de trinquete: metálico y dentado, parecido al cierre de unas esposas. No son esposas.')
for n, f in enumerate(['footstep_concrete_000.ogg', 'footstep_concrete_001.ogg', 'footstep_concrete_002.ogg',
                       'footstep_concrete_003.ogg', 'footstep_concrete_004.ogg'], 1):
    s(f'pasos_asfalto_{n}', [R], 'una', 'k_impact', f, nota='Paso de zapato sobre cemento.')
for n, (fu, f) in enumerate([('corsica', 'Corsica_S-Walking_on_snow_covered_gravel_01.flac'),
                             ('corsica', 'Corsica_S-Walking_on_snow_covered_gravel_02.flac'),
                             ('corsica', 'Corsica_S-Walking_on_snow_covered_gravel_03.flac'),
                             ('tinyworlds', 'gravel.ogg')], 1):
    s(f'pasos_ripio_{n}', [R], 'una', fu, f,
      nota='Paso crujiente sobre ripio' + (' (ripio con algo de nieve encima).' if fu == 'corsica' else '.'))
s('impresora', [R], 'una', 'dklon_paso', 'nema17_10mm.wav', 0, 1.4,
  nota='APROXIMACIÓN: motor paso a paso grabado de contacto. Una impresora térmica de tickets hace un zumbido de motor paso a paso parecido, pero no es una impresora.')
s('bocina', [R], 'una', 'ggbotnet', 'Car_Horn.ogg', nota='Bocinazo corto de auto real (celular).')
s('levantavidrios', [R], 'una', 'bart_taller', 'workshop - drill short 1.wav',
  nota='APROXIMACIÓN: taladro eléctrico corto (motorcito que sube de vueltas). No es un levantavidrios.')
s('trafico_ruta', [R], 'loop', 'rubberduck2', 'sfx100v2_loop_highway.ogg', 0.5, 9.0, 1.0,
  nota='Extra: ambiente de ruta con dos autos pasando. Grabado con celular.')

# ======================= ESTANCIA =======================
s('cascos_galope', [E], 'loop', 'antum_galope', 'gallop_01.ogg', 0, None, 0.01,
  nota='Galope real grabado, ya editado como loop por AntumDeluge.')
for n, (a, b) in enumerate([(0.10, 0.48), (0.48, 1.08), (1.08, 1.65)], 1):
    s(f'perro_ladrido_{n}', [E], 'una', 'haeldb_perro', 'dog_barking_mono.wav', a, b - a, af='highpass=f=120',
      nota='Un ladrido suelto de la misma grabación de perro (ruido de fondo limpiado por el autor).')
s('pajaros_dia', [E], 'loop', 'isaiah', 'birds-isaiah658_0.ogg', 12, 8.0, 1.0,
  nota='Pájaros de día grabados al aire libre.')
s('fogon', [E], 'loop', 'pagdev', 'fire.wav', 5, 8.0, 1.0, nota='Fuego de leña crepitando.')
s('agua', [E], 'loop', 'rubberduck_agua', 'loop_water_01.ogg', 0, None, 0.02,
  nota='Agua corriendo (arroyo/chorro), ya venía como loop.')
s('agua_chapoteo', [E], 'una', 'qubodup_chapoteo', 'water_splash-01.flac', nota='Extra: chapoteo corto.')
s('tranquera', [E], 'una', 'rubberduck1', 'door_02.ogg',
  nota='Chirrido de bisagra de una puerta que se abre; se usa para la tranquera.')
s('lazo_zumbido', [E], 'loop', 'mix2020', 'jump_rope_swishing.wav', 1.08, 3.1, 0.05,
  nota='Soga de saltar girando (zumbidos a ~3 por segundo), el tramo más lento. Parecido al lazo revoleado, no es un lazo.')
for n, f in enumerate(['footstep_grass_000.ogg', 'footstep_grass_001.ogg', 'footstep_grass_002.ogg', 'footstep_grass_003.ogg'], 1):
    s(f'pasos_pasto_{n}', [E, I], 'una', 'k_impact', f, nota='Paso sobre pasto.')
s('viento_campo', [E], 'loop', 'bashar', 'wind background noise 2.wav', 3, 8.0, 1.5, af='highpass=f=40',
  nota='Viento de fondo grabado (tramo tranquilo, antes de que aparezcan ruidos de bolsas).')

# ======================= ISLA ROYALE =======================
s('disparo_pistola', [I], 'una', 'tabasco', 'cz.wav', 0.2, 1.8,
  nota='Pistola CZ-52 real en un polígono, con el eco del lugar. El grabador saturó un poco.')
s('disparo_rifle', [I], 'una', 'tabasco', 'sks.wav', 0.3, 1.9, nota='Rifle semiautomático SKS real.')
s('disparo_escopeta', [I], 'una', 'tabasco', 'shotty.wav', 0.1,
  nota='Escopeta real; el grabador saturó (se nota recortado), pero pega fuerte.')
s('disparo_franco', [I], 'una', 'tabasco', 'mosin.wav', 0.4, 3.05,
  nota='Rifle de cerrojo Mosin-Nagant: el tiro y después el cerrojo recargando. Ideal para francotirador.')
s('recarga', [I], 'una', 'zer0sol', 'reload.wav', nota='Recarga de pistola (cargador afuera/adentro y corredera).')
s('pico_madera', [I], 'una', 'rubberduck_mw', 'wood_hit_01.ogg', nota='Golpe seco sobre madera.')
s('pico_piedra', [I], 'una', 'k_impact', 'impactMining_001.ogg', nota='Pico contra piedra, con un poco de resonancia.')
s('pico_metal', [I], 'una', 'rubberduck_mw', 'metal_hit_01.ogg', nota='Golpe sobre metal.')
s('construir', [I], 'una', 'rubberduck_mw', 'wood_hammer_01.ogg', nota='Martillazo en madera: colocar una pieza.')
s('cofre', [I], 'una', 'rubberduck1', 'wooded_box_open.ogg', nota='Caja de madera que se abre (traba y tapa).')
s('cofre_brillo', [I], 'una', 'oiboo', 'open chest_0.wav',
  nota='Extra: arpegio "mágico" de cofre abierto / cuarto secreto. Es música, no realista.')
s('tormenta', [I], 'loop', 'wuxia', 'rain-thunder.ogg', 27, 8.0, 1.5,
  nota='Lluvia fuerte con el retumbe de un trueno que se va apagando.')
s('trueno', [I], 'una', 'inspectorj', 'Thunder, Very Close, Rain, 01.wav', 0.7, 4.0,
  nota='Trueno muy cercano con lluvia, recortado a 4 s con fundido.')
s('olas', [I], 'loop', 'qubodup_olas', '*concat*', xf=0.8,
  nota='Cuatro olas de playa reales encadenadas con fundidos.')
s('autobus', [I], 'loop', 'antum_avion', 'airplane_prop.flac', 0, None, 0.02,
  nota='Zumbido de avioneta a hélice, ya en loop: para el autobús volador.')
s('planeador_viento', [I], 'loop', 'luke', 'wind1.wav', 10, 6.0, 1.0,
  nota='Viento sintetizado (Pure Data) con ráfagas.')
s('ui_clic', [I], 'una', 'k_interface', 'click_001.ogg', nota='Clic de interfaz.')
s('ui_confirmar', [I], 'una', 'k_interface', 'confirmation_001.ogg', nota='Confirmación de interfaz (sintético).')
s('victoria', [I], 'una', 'fvcalderan', 'fanfare_3.ogg', nota='Fanfarria corta de bronces (música).')
s('golpe_dano', [I], 'una', 'qubodup_pina', 'qubodupPunch01.flac', nota='Piña real (golpe al cuerpo).')

OLAS = ['wave_01_cc0-18363__jasinski__alkaibeach.flac', 'wave_02_cc0-18363__jasinski__alkaibeach.flac',
        'wave_03_cc0-18363__jasinski__alkaibeach.flac', 'wave_04_cc0-18363__jasinski__alkaibeach.flac']


# ---------------------------------------------------------------------------
def decodificar(ruta, ss=0.0, dur=None, af=None):
    cmd = [FF, '-v', 'error']
    if ss: cmd += ['-ss', f'{ss:.3f}']
    if dur: cmd += ['-t', f'{dur:.3f}']
    cmd += ['-i', ruta]
    if af: cmd += ['-af', af]
    cmd += ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    p = subprocess.run(cmd, capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)


def fundido_loop(x, xf):
    """Funde los últimos xf segundos sobre los primeros. El resultado dura
    len(x)-xf y su último sample continúa naturalmente en el primero."""
    n = int(round(xf * SR))
    if n <= 0 or n * 2 >= len(x):
        return x
    L = len(x) - n
    t = np.linspace(0, np.pi / 2, n)
    y = x[:L].copy()
    y[:n] = x[:n] * np.sin(t) + x[L:] * np.cos(t)   # potencia constante
    return y


def recortar_silencio(x):
    pico = np.max(np.abs(x)) + 1e-12
    umbral = pico * 10 ** (UMBRAL_SILENCIO_DB / 20)
    idx = np.where(np.abs(x) > umbral)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(0.005 * SR))
    b = min(len(x), idx[-1] + int(0.02 * SR))
    return x[a:b]


def fundidos(x, ent=0.003, sal=0.03):
    x = x.copy()
    ne = min(int(ent * SR), len(x) // 4)
    ns = min(int(sal * SR), len(x) // 3)
    if ne: x[:ne] *= np.linspace(0, 1, ne)
    if ns: x[-ns:] *= np.linspace(1, 0, ns)
    return x


def lufs(x):
    """Sonoridad integrada con el ebur128 de ffmpeg. A los sonidos cortos se
    les agrega silencio para llegar a los 400 ms que pide la medición (el
    silencio cae debajo de la compuerta absoluta y no baja el resultado)."""
    y = x
    if len(y) < SR:
        y = np.concatenate([y, np.zeros(SR - len(y))])
    p = subprocess.run([FF, '-hide_banner', '-nostats', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', 'ebur128', '-f', 'null', '-'], input=y.astype(np.float32).tobytes(),
                       capture_output=True)
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', p.stderr.decode())
    return float(m[-1]) if m else None


def limitar_loop(x, limite_db):
    """Limitador de ffmpeg sobre el loop repetido tres veces; se queda con la
    copia del medio para que el estado del limitador en el empalme sea el
    mismo de los dos lados (si no, el loop "respira" justo al volver)."""
    n = len(x)
    y = np.tile(x, 3).astype(np.float32)
    p = subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', f'alimiter=limit={10 ** (limite_db / 20):.4f}:attack=5:release=80:level=0:latency=1',
                        '-f', 'f32le', '-'], input=y.tobytes(), capture_output=True, check=True)
    z = np.frombuffer(p.stdout, dtype=np.float32).astype(np.float64)
    return z[n:2 * n] if len(z) >= 2 * n else x


def normalizar(x, loop=False):
    """Efectos sueltos: manda el pico (no se les aplasta el golpe).
    Loops: se busca -16 LUFS; si los chasquidos (fuego, ráfagas) no dejan
    llegar sin pasarse de pico, se limitan hasta 8 dB, que en un ambiente no
    se nota y evita que el fogón quede 12 dB más bajo que el resto."""
    pico = np.max(np.abs(x)) + 1e-12
    g_pico = 10 ** (PICO_MAX_DB / 20) / pico
    l = lufs(x)
    g_lufs = 10 ** ((LUFS_OBJETIVO - l) / 20) if l is not None and l > -70 else g_pico
    if not loop:
        return x * min(g_pico, g_lufs)
    g = min(g_lufs, g_pico * 10 ** (8 / 20))
    y = x * g
    if np.max(np.abs(y)) > 10 ** (PICO_MAX_DB / 20):
        y = limitar_loop(y, PICO_MAX_DB - 0.5)
    return y


def procesar(e):
    f = FUENTES[e['fuente']]
    if e['archivo'] == '*concat*':
        # olas: se encadenan con 0,6 s de fundido entre una y otra
        partes = [decodificar(os.path.join(ORIG, f['dir'], o)) for o in OLAS]
        n = int(0.6 * SR)
        x = partes[0]
        for p in partes[1:]:
            t = np.linspace(0, np.pi / 2, n)
            x = np.concatenate([x[:-n], x[-n:] * np.cos(t) + p[:n] * np.sin(t), p[n:]])
    else:
        dur = None if e['dur'] is None else e['dur'] + (e['xf'] if e['tipo'] == 'loop' else 0)
        x = decodificar(os.path.join(ORIG, f['dir'], e['archivo']), e['ss'], dur, e['af'])
    if e['tipo'] == 'loop':
        x = x - np.mean(x)
        x = fundido_loop(x, e['xf'])
        x = np.tile(x, e['repetir'])
    else:
        x = recortar_silencio(x)
        if len(x) > MAX_UNA * SR:
            x = x[:int(MAX_UNA * SR)]
            x = fundidos(x, sal=0.4)
        else:
            x = fundidos(x)
    return normalizar(x, loop=e['tipo'] == 'loop')


def codificar(x, salida):
    with tempfile.NamedTemporaryFile(suffix='.f32') as t:
        t.write(x.astype(np.float32).tobytes()); t.flush()
        subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', t.name,
                        '-codec:a', 'libmp3lame', '-b:a', '64k', '-ar', str(SR), '-ac', '1', salida], check=True)


def medir(ruta):
    x = decodificar(ruta)
    return len(x) / SR, 20 * np.log10(np.max(np.abs(x)) + 1e-12), x


def hoja(x, titulo, salida):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(4, 2.6), gridspec_kw={'height_ratios': [1, 2]})
    a1.plot(np.arange(len(x)) / SR, x, lw=0.3); a1.set_ylim(-1, 1); a1.set_xticks([]); a1.set_yticks([])
    a1.set_title(titulo, fontsize=7)
    a2.specgram(x, NFFT=512, Fs=SR, noverlap=384, cmap='magma', vmin=-120); a2.tick_params(labelsize=5)
    plt.tight_layout(); plt.savefig(salida, dpi=80); plt.close()


def main():
    hojas = sys.argv[sys.argv.index('--hojas') + 1] if '--hojas' in sys.argv else None
    if hojas: os.makedirs(hojas, exist_ok=True)
    manifiesto = []
    for e in S:
        f = FUENTES[e['fuente']]
        x = procesar(e)
        original = ', '.join(OLAS) if e['archivo'] == '*concat*' else e['archivo']
        for juego in e['juegos']:
            os.makedirs(os.path.join(AQUI, juego), exist_ok=True)
            rel = f'{juego}/{e["id"]}.mp3'
            codificar(x, os.path.join(AQUI, rel))
            d, pk, y = medir(os.path.join(AQUI, rel))
            nota = e['nota']
            if f.get('lic_nota'): nota += ' ' + f['lic_nota']
            manifiesto.append(dict(id=e['id'], grupo=re.sub(r'_\d+$', '', e['id']), juego=juego, archivo=rel,
                                   tipo=e['tipo'], duracion=round(d, 2), licencia=f['licencia'], autor=f['autor'],
                                   fuente=f['fuente'], original=original, nota=nota.strip()))
            print(f'{rel:32s} {e["tipo"]:4s} {d:5.2f}s pico {pk:5.1f} dB  {os.path.getsize(os.path.join(AQUI, rel))//1024:3d} KB')
            if hojas and juego == e['juegos'][0]:
                hoja(y, f'{e["id"]} {d:.2f}s', os.path.join(hojas, f'{e["id"]}.png'))
    with open(os.path.join(AQUI, 'manifiesto.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifiesto, fh, ensure_ascii=False, indent=1)
    for j in (R, E, I):
        t = sum(os.path.getsize(os.path.join(AQUI, m['archivo'])) for m in manifiesto if m['juego'] == j)
        print(f'{j}: {t/1024:.0f} KB en {sum(1 for m in manifiesto if m["juego"] == j)} archivos')


if __name__ == '__main__':
    main()
