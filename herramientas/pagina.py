#!/usr/bin/env python3
"""Pasa el archivo único de un juego a una página publicable como Artifact.

    python3 herramientas/pagina.py vibora <carpeta de salida>

La publicación pone su propio <!doctype>, <html>, <head> y <body>: la página
va sin ellos, con el <title> arriba de todo (se lee de los primeros 8 KB),
los estilos del juego, un agregado propio y el cuerpo tal cual (lienzo,
menús y el <script> entero). Cripta mide su lienzo, así que aguanta el
margen de 16 px a los costados; Víbora y la isla ocupan toda la pantalla a
propósito (sus menús ya dejan 16 px).
"""
import pathlib, re, sys

REPO = pathlib.Path(__file__).resolve().parent.parent
AGREGADOS = {
    'cripta': 'html { height: 100%; box-sizing: border-box; background: #05040b; color-scheme: dark; }\n'
              'body { height: 100%; margin: 0; padding-inline: 16px; box-sizing: border-box; background: #05040b; overflow: hidden; overscroll-behavior: none; }',
    'vibora': 'html { color-scheme: dark; }',
    'isla': 'html { color-scheme: light; }',
    'globo': 'html { color-scheme: light; background: #5fb8ff; }',
    'morfi': 'html { color-scheme: light; background: #c99a5f; }',
}

if len(sys.argv) != 3 or sys.argv[1] not in AGREGADOS:
    raise SystemExit(__doc__)
juego, salida = sys.argv[1], pathlib.Path(sys.argv[2])
html = (REPO / juego / f'{juego}-en-un-archivo.html').read_text(encoding='utf-8')
cabeza = html[html.index('<head>') + 6: html.index('</head>')]
cuerpo = html[html.index('<body>') + 6: html.rindex('</body>')]
if re.search(r'<link[^>]+stylesheet', cabeza):
    raise SystemExit(f'{juego}: quedó un <link> a una hoja de estilo, que no viajaría: armá antes el archivo único')
titulo = re.search(r'<title>.*?</title>', cabeza, re.S).group(0)
estilos = re.findall(r'<style>.*?</style>', cabeza, re.S)
pagina = f'{titulo}\n' + '\n'.join(estilos) + f'\n<style>\n{AGREGADOS[juego]}\n</style>\n' + cuerpo.strip() + '\n'
salida.mkdir(parents=True, exist_ok=True)
destino = salida / f'{juego}.html'
destino.write_text(pagina, encoding='utf-8')
print(f'{destino}: {len(pagina.encode()) / 1024:.0f} KB, {titulo}')
