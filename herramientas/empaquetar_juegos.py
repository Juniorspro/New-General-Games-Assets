#!/usr/bin/env python3
"""Arma un zip por juego en entregas/: el juego listo para jugar, el código
fuente para armarlo de nuevo y la guía para portarlo a TikTok (Mini Games,
runtime nativo).

    python3 herramientas/empaquetar_juegos.py [juego ...]

Cada zip trae, adentro de una carpeta con el nombre del juego:
  LEEME.md             qué es, cómo se juega y cómo se arma
  PORTAR-A-TIKTOK.md   lo común de TikTok + lo de este juego
  jugar/<juego>.html   el juego en un archivo (doble clic, sin internet)
  fuente/              el código, con la misma estructura que en el repo

Antes de empaquetar, arma cada juego de nuevo, así el HTML del zip es el del
código que va al lado. node_modules no entra (se baja con npm install).
"""
import json, os, subprocess, sys, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, 'entregas')
TIKTOK = os.path.join(RAIZ, 'herramientas', 'tiktok')
NO_ENTRA = {'node_modules', '.git', '__pycache__', 'dist'}
VERSIONES = {'esbuild': '0.25.12', 'three': '0.186.0'}

JUEGOS = {
    'zonda': {
        'titulo': 'ZONDA',
        'que': 'Plataformas tipo Celeste en pixel art: una chica sube el cerro contra el viento zonda. 20 salas, 3 idiomas.',
        'carpetas': ['motor2d', 'zonda'],
        'html': 'zonda/zonda.html',
        'armar': ['node', 'motor2d/armar.mjs', 'zonda'],
        'deps': [],
        'como': 'node motor2d/armar.mjs zonda        # → zonda/zonda.html (no hace falta instalar nada)',
    },
    'luz-mala': {
        'titulo': 'LUZ MALA',
        'que': 'Metroidvania tipo Silksong: una luciérnaga prende los faroles de un quebracho. 9 salas, 3 jefes, 3 idiomas.',
        'carpetas': ['motor2d', 'luz-mala'],
        'html': 'luz-mala/luz-mala.html',
        'armar': ['node', 'motor2d/armar.mjs', 'luz-mala'],
        'deps': [],
        'como': 'node motor2d/armar.mjs luz-mala     # → luz-mala/luz-mala.html (no hace falta instalar nada)',
    },
    'kuntur': {
        'titulo': 'KUNTUR',
        'que': '2.5D de papel tipo Paper Mario en los Andes: Killa y el cóndor Apu. 7 capítulos con historia, 3 idiomas.',
        'carpetas': ['kuntur'],
        'html': 'kuntur/kuntur.html',
        'armar': ['node', 'kuntur/herramientas/armar.mjs'],
        'deps': ['esbuild', 'three'],
        'como': 'npm install\nnode kuntur/herramientas/armar.mjs   # → kuntur/kuntur.html',
    },
    'brillo': {
        'titulo': 'BRILLO',
        'que': 'Plataformas 2D Frutiger Aero en pixel art: Nick va a buscar a Mora por seis mundos. Música Aero o 16 bits, 3 idiomas.',
        'carpetas': ['brillo'],
        'html': 'brillo/brillo.html',
        'armar': ['node', 'brillo/herramientas/armar.mjs'],
        'deps': ['esbuild'],
        'como': 'npm install\nnode brillo/herramientas/armar.mjs   # → brillo/brillo.html',
    },
    'ruta40': {
        'titulo': 'RUTA 40',
        'que': 'Autos tipo Hill Climb por la Ruta 40, de la Puna al Glaciar: 7 tramos, 5 vehículos con mejoras, picadas, arte pintado, 3 idiomas.',
        'carpetas': ['ruta40'],
        'html': 'ruta40/ruta40.html',
        'armar': ['node', 'ruta40/herramientas/armar.mjs'],
        'deps': ['esbuild'],
        'como': 'npm install\nnode ruta40/herramientas/armar.mjs   # → ruta40/ruta40.html',
    },
    'bosque': {
        'titulo': 'BOSQUE',
        'que': 'Tercera persona en un bosque al atardecer, con filtro VHS: encontrá las cinco cintas. three.js, modelos y texturas.',
        'carpetas': ['bosque'],
        'html': 'bosque/bosque-en-un-archivo.html',
        'armar': ['node', 'herramientas/armar.mjs'],
        'armar_en': 'bosque',
        'deps': None,  # trae su propio package.json en bosque/
        'como': 'cd bosque\nnpm install\nnode herramientas/armar.mjs   # → dist/ y bosque-en-un-archivo.html',
    },
}


def armar(j):
    cwd = os.path.join(RAIZ, j.get('armar_en', ''))
    r = subprocess.run(j['armar'], cwd=cwd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f'no se pudo armar {j["titulo"]}:\n{r.stdout}\n{r.stderr}')
    print('  ' + (r.stdout.strip().splitlines() or ['armado'])[-1])


def leeme(id_, j):
    html = os.path.basename(j['html'])
    return f"""# {j['titulo']}

{j['que']}

## Jugar

Abrí `jugar/{html}` con doble clic. Anda sin internet, en la compu (teclado
o mando) y en el celular (con los dedos). Primero se elige el idioma:
español, inglés o portugués.

## Armar de nuevo

En `fuente/` está el código con la misma estructura que en el repo:

```sh
cd fuente
{j['como']}
```

## Portar

`PORTAR-A-TIKTOK.md` dice qué se lleva tal cual y qué hay que rehacer para el
runtime nativo de TikTok Mini Games.
"""


def empaquetar(id_):
    j = JUEGOS[id_]
    print(f'{j["titulo"]}:')
    armar(j)
    os.makedirs(SALIDA, exist_ok=True)
    destino = os.path.join(SALIDA, f'{id_}.zip')
    guia = open(os.path.join(TIKTOK, 'comun.md'), encoding='utf-8').read() + '\n' + open(os.path.join(TIKTOK, f'{id_}.md'), encoding='utf-8').read()
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        base = id_
        z.writestr(f'{base}/LEEME.md', leeme(id_, j))
        z.writestr(f'{base}/PORTAR-A-TIKTOK.md', guia)
        z.write(os.path.join(RAIZ, j['html']), f'{base}/jugar/{os.path.basename(j["html"])}')
        if j['deps']:
            pkg = {'name': id_, 'private': True, 'type': 'module', 'devDependencies': {d: '^' + VERSIONES[d] for d in j['deps']}}
            z.writestr(f'{base}/fuente/package.json', json.dumps(pkg, indent=2) + '\n')
        n = 0
        for carpeta in j['carpetas']:
            for dirpath, dirs, files in os.walk(os.path.join(RAIZ, carpeta)):
                dirs[:] = sorted(d for d in dirs if d not in NO_ENTRA)
                for f in sorted(files):
                    ruta = os.path.join(dirpath, f)
                    rel = os.path.relpath(ruta, RAIZ)
                    if rel == j['html'] and id_ == 'bosque':
                        continue  # el de un archivo ya va en jugar/ (13 MB): no se duplica
                    z.write(ruta, f'{base}/fuente/{rel}')
                    n += 1
    print(f'  entregas/{id_}.zip · {os.path.getsize(destino) / 1048576:.1f} MB · {n} archivos de fuente')


if __name__ == '__main__':
    pedidos = sys.argv[1:] or list(JUEGOS)
    for p in pedidos:
        if p not in JUEGOS:
            sys.exit(f'no conozco "{p}": {", ".join(JUEGOS)}')
        empaquetar(p)
