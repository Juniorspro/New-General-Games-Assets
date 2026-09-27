#!/usr/bin/env python3
"""Las grabaciones de Dimensión Ñ y de Espejo, rehechas desde los originales.

    SONIDOS_ORIG=/ruta/a/orig python3 sonidos/dimension-n/procesar.py [dimension-n|espejo] [--hojas DIR]

Por qué está acá y no en sonidos/procesar.py: ese script reescribe el
manifiesto general entero y es de los otros juegos. Este reusa sus funciones
(decodificar, empalmar, normalizar, codificar: el mismo criterio para que todo
suene parejo) y escribe sólo sonidos/<juego>/*.mp3 y sonidos/<juego>/manifiesto.json.
Sirve a los dos juegos porque comparten fuentes (Kenney y rubberduck) y así la
receta de un pack está escrita una sola vez.
"""
import importlib.util, json, os, re, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SONIDOS = os.path.dirname(AQUI)
spec = importlib.util.spec_from_file_location('base', os.path.join(SONIDOS, 'procesar.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

KEN = base.KEN
FUENTES = dict(base.FUENTES)
# Los packs de Kenney que el script general no usa. Todos traen License.txt con
# "Creative Commons Zero, CC0" adentro del zip (revisado el 26/9/2026).
FUENTES.update({
    'k_scifi': dict(licencia='CC0', autor='Kenney (kenney.nl)', fuente=KEN + 'sci-fi-sounds', dir='kenney/sci-fi-sounds/Audio'),
    'k_ui': dict(licencia='CC0', autor='Kenney (kenney.nl)', fuente=KEN + 'ui-audio', dir='kenney/ui-audio/Audio'),
    'k_saxo': dict(licencia='CC0', autor='Kenney (kenney.nl)', fuente=KEN + 'music-jingles', dir='kenney/music-jingles/Audio/Sax jingles'),
    'k_acero': dict(licencia='CC0', autor='Kenney (kenney.nl)', fuente=KEN + 'music-jingles', dir='kenney/music-jingles/Audio/Steel jingles'),
})


def e(id, tipo, fuente, archivo, ss=0.0, dur=None, xf=0.0, af=None, nota=''):
    return dict(id=id, tipo=tipo, fuente=fuente, archivo=archivo, ss=ss, dur=dur, xf=xf, af=af, nota=nota, repetir=1)


# Los tramos salen de mirar las hojas (--hojas): dónde pega el golpe y dónde se
# apaga la cola. Lo que no es una grabación de la cosa misma lo dice la nota.
RECETAS = {
    'dimension-n': [
        *[e(f'golpe_{n + 1}', 'una', 'k_impact', f'impactPunch_medium_00{n}.ogg',
            nota='Golpe seco contra un cuerpo (grabación de Kenney). Es el ragdoll pegando contra paredes y repisas.')
          for n in range(3)],
        *[e(f'golpe_fuerte_{n + 1}', 'una', 'k_impact', f'impactPunch_heavy_00{n}.ogg',
            nota='Golpe pesado contra un cuerpo, para los choques que descuentan mucha integridad.')
          for n in range(2)],
        *[e(f'pincho_{n + 1}', 'una', 'k_impact', f'impactMetal_medium_00{n}.ogg',
            nota='APROXIMACIÓN: golpe metálico corto y resonante. Una púa no suena a nada; esto es el metal que se clava.')
          for n in range(2)],
        e('resorte', 'una', 'rubberduck1', 'spring_01.ogg', 0, 1.0,
          nota='Resorte de verdad que se estira y vibra (grabación), recortado al primer segundo.'),
        *[e(f'chatarra_{n + 1}', 'una', 'k_impact', f'impactTin_medium_00{n}.ogg',
            nota='Lata/chapa golpeada: juntar un pedazo de chatarra.')
          for n in range(3)],
        e('placa', 'una', 'k_impact', 'impactMetal_heavy_000.ogg',
          nota='APROXIMACIÓN: golpe metálico pesado y corto, para la placa que se hunde con el peso. No es una placa de presión.'),
        *[e(f'portal_{n + 1}', 'una', 'k_scifi', f'forceField_00{n}.ogg',
            nota='DISEÑADO (sintético): zumbido armónico de campo de fuerza. Un portal no tiene sonido real.')
          for n in range(2)],
        *[e(f'disparo_{i + 1}', 'una', 'k_scifi', f'laserSmall_00{n}.ogg',
            nota='DISEÑADO (sintético): disparo láser corto, para el tiro de portal.')
          for i, n in enumerate((0, 2))],
        e('roto', 'una', 'k_scifi', 'explosionCrunch_000.ogg',
          nota='DISEÑADO: estallido áspero con crujido, para el muñeco que se desarma.'),
        e('gano', 'una', 'k_saxo', 'jingles_SAX07.ogg', nota='Música: jingle de saxo (no es realista, es el remate).'),
        e('ui_clic', 'una', 'k_ui', 'click2.ogg', nota='Clic corto de interfaz.'),
        e('reactor', 'loop', 'k_scifi', 'thrusterFire_001.ogg', 0.6, 2.4, 0.4,
          nota='DISEÑADO: soplido de propulsor (ruido con graves), empalmado en loop. El reactor de Rilo mientras empuja.'),
        e('viento', 'loop', 'sketchman', 'wind woosh loop.ogg', 0, None, 0.02,
          nota='Viento grave y parejo, ya venía como loop: el aire de la caída, más fuerte cuanto más rápido.'),
    ],
    'espejo': [
        *[e(f'espejo_{n + 1}', 'una', 'k_impact', f'impactGlass_light_00{n}.ogg',
            nota='Golpecito sobre vidrio: el espejo que gira y se asienta en el marco (aproximación: no es un espejo girando).')
          for n in range(3)],
        e('prende', 'una', 'rubberduck1', 'bell_02.ogg', nota='Campanita de metal (grabación): un objetivo que se prende.'),
        e('apaga', 'una', 'k_impact', 'impactGlass_medium_000.ogg',
          nota='Vidrio golpeado más sordo, tocado más grave en el juego: un objetivo que se apaga.'),
        e('ultimo', 'una', 'rubberduck1', 'bell_01.ogg', nota='Campana más larga (grabación): el último objetivo.'),
        e('gana', 'una', 'k_acero', 'jingles_STEEL03.ogg', nota='Música: jingle de steel drum (no es realista, es el remate).'),
        e('pista', 'una', 'k_interface', 'question_001.ogg', nota='DISEÑADO (sintético): "¿?" de interfaz para la pista.'),
        e('nivel', 'una', 'k_impact', 'impactWood_light_000.ogg',
          nota='Golpe liviano sobre madera: el tablero que se apoya en la mesa al empezar un nivel.'),
        e('ui_clic', 'una', 'k_ui', 'click2.ogg', nota='Clic corto de interfaz.'),
    ],
}


def main():
    juego = next((a for a in sys.argv[1:] if a in RECETAS), 'dimension-n')
    hojas = sys.argv[sys.argv.index('--hojas') + 1] if '--hojas' in sys.argv else None
    if hojas: os.makedirs(hojas, exist_ok=True)
    destino = os.path.join(SONIDOS, juego)
    os.makedirs(destino, exist_ok=True)
    base.FUENTES.update(FUENTES)          # procesar() busca la fuente en su propio dict
    manifiesto = []
    for r in RECETAS[juego]:
        f = FUENTES[r['fuente']]
        x = base.procesar(r)
        rel = f'{juego}/{r["id"]}.mp3'
        base.codificar(x, os.path.join(SONIDOS, rel))
        d, pk, y = base.medir(os.path.join(SONIDOS, rel))
        nota = r['nota'] + (' ' + f['lic_nota'] if f.get('lic_nota') else '')
        manifiesto.append(dict(id=r['id'], grupo=re.sub(r'_\d+$', '', r['id']), juego=juego, archivo=rel,
                               tipo=r['tipo'], duracion=round(d, 2), licencia=f['licencia'], autor=f['autor'],
                               fuente=f['fuente'], original=r['archivo'], nota=nota.strip()))
        print(f'{rel:30s} {r["tipo"]:4s} {d:5.2f}s pico {pk:5.1f} dB  {os.path.getsize(os.path.join(SONIDOS, rel)) // 1024:3d} KB')
        if hojas: base.hoja(y, f'{r["id"]} {d:.2f}s', os.path.join(hojas, f'{juego}_{r["id"]}.png'))
    with open(os.path.join(destino, 'manifiesto.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifiesto, fh, ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(SONIDOS, m['archivo'])) for m in manifiesto)
    print(f'{juego}: {total / 1024:.0f} KB en {len(manifiesto)} archivos')


if __name__ == '__main__':
    main()
