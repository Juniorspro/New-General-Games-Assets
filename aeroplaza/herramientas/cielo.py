#!/usr/bin/env python3
"""Arma js/cielo-datos.js (el cielo del telescopio, estelario.js) con los datos de
d3-celestial (Olaf Frohn, licencia BSD de 3 cláusulas: ver el aviso adentro del
archivo que sale). Los .json se bajan una vez a crudo/cielo/ (no se commitean):

    for f in stars.6.json starnames.json constellations.json constellations.lines.json mw.json dsos.bright.json; do
      curl -sS -o crudo/cielo/$f https://cdn.jsdelivr.net/npm/d3-celestial@0.7.35/data/$f; done
    python3 herramientas/cielo.py

- Estrellas hasta magnitud 6 (5044): ascensión recta y declinación en 16 bits,
  magnitud y color (B−V) en 8 bits cada uno, en base64.
- Los nombres propios de las que tienen (600), con su letra de Bayer y constelación.
- Las 89 constelaciones (nombre en latín, español e inglés, y dónde va el nombre) y
  (la Vía Láctea no: sus contornos dan la vuelta al cielo y no se rellenan en un mapa
  plano; estelario.js la arma en coordenadas galácticas)
  sus líneas y 32 objetos de cielo
  profundo con nombre propio."""
import json, base64, struct, os
AQUI = os.path.dirname(os.path.abspath(__file__)); C = os.path.join(AQUI, '..', 'crudo', 'cielo')
L = lambda f: json.load(open(os.path.join(C, f)))
lic = open(os.path.join(C, 'LICENSE')).read().strip()

stars = L('stars.6.json')['features']
nombres = L('starnames.json')
buf = bytearray(); ids = []
stars.sort(key=lambda s: s['properties']['mag'])
for s in stars:
    ra, de = s['geometry']['coordinates']; ra %= 360
    mag = s['properties']['mag']; bv = float(s['properties'].get('bv') or 0.6)
    buf += struct.pack('<HhBB', int(round(ra / 360 * 65535)) & 0xffff, int(round(de / 90 * 32767)), max(0, min(255, int(round((mag + 2) * 25)))), max(0, min(255, int(round((bv + 0.5) * 80)))))
    ids.append(str(s['id']))
est = base64.b64encode(bytes(buf)).decode()
nom = []
for i, sid in enumerate(ids):
    n = nombres.get(sid)
    if not n: continue
    nm = n.get('es') or n.get('name') or ''
    if not nm and stars[i]['properties']['mag'] > 3.2: continue
    nom.append([i, nm, n.get('bayer', ''), n.get('c', ''), n.get('name', '')])

con = []
for f in L('constellations.json')['features']:
    p = f['properties']; ra, de = f['geometry']['coordinates']
    con.append([f['id'], p.get('la') or p['name'], p.get('es') or p['name'], p.get('en') or p['name'], round(ra % 360, 2), round(de, 2), int(p.get('rank', 3))])
lin = {}
for f in L('constellations.lines.json')['features']:
    lin[f['id']] = [[[round(x % 360, 2), round(y, 2)] for x, y in l] for l in f['geometry']['coordinates']]

via = []
for f in L('mw.json')['features']:
    nivel = int(f['id'][2:])
    for poly in f['geometry']['coordinates']:
        for anillo in poly:
            # (22 mil puntos es mucho para una mancha difusa: 1 cada ~0,8° alcanza)
            pts, ult = [], None
            for x, y in anillo:
                if ult is None or abs(((x - ult[0] + 180) % 360) - 180) + abs(y - ult[1]) > 0.8: pts.append((x, y)); ult = (x, y)
            if len(pts) >= 6: via.append([nivel, base64.b64encode(b''.join(struct.pack('<Hh', int(round((x % 360) / 360 * 65535)) & 0xffff, int(round(y / 90 * 32767))) for x, y in pts)).decode()])

NOMBRES_DSO = {
  'Cr 140': ['Collinder 140', 'Collinder 140'], 'Cr 399': ['Percha (Collinder 399)', 'Coathanger'], 'IC 2602': ['Pléyades del Sur', 'Southern Pleiades'],
  'PGC 17223': ['Gran Nube de Magallanes', 'Large Magellanic Cloud'], 'NGC 6121': ['M4', 'M4'], 'NGC 6405': ['M6 · Mariposa', 'M6 · Butterfly'], 'NGC 6475': ['M7 · Cúmulo de Ptolomeo', 'M7 · Ptolemy Cluster'],
  'M 8': ['M8 · Nebulosa de la Laguna', 'M8 · Lagoon Nebula'], 'NGC 6611': ['M16 · Nebulosa del Águila', 'M16 · Eagle Nebula'], 'NGC 224': ['M31 · Galaxia de Andrómeda', 'M31 · Andromeda Galaxy'],
  'NGC 598': ['M33 · Galaxia del Triángulo', 'M33 · Triangulum Galaxy'], 'NGC 1976': ['M42 · Nebulosa de Orión', 'M42 · Orion Nebula'], 'NGC 2632': ['M44 · El Pesebre', 'M44 · Beehive'],
  'M 45': ['M45 · Pléyades', 'M45 · Pleiades'], 'Cr 39': ['Cúmulo de Alfa Persei', 'Alpha Persei Cluster'], 'C 41': ['Híades', 'Hyades'], 'Cr 256': ['Cúmulo de Coma', 'Coma Cluster'],
  'NGC 104': ['47 Tucanae', '47 Tucanae'], 'NGC 869': ['Doble cúmulo (h)', 'Double Cluster (h)'], 'NGC 884': ['Doble cúmulo (χ)', 'Double Cluster (χ)'], 'NGC 2244': ['Nebulosa Roseta', 'Rosette Nebula'],
  'NGC 2264': ['Cúmulo del Árbol de Navidad', 'Christmas Tree Cluster'], 'NGC 2362': ['Cúmulo de Tau CMa', 'Tau CMa Cluster'], 'NGC 2451': ['NGC 2451', 'NGC 2451'], 'NGC 2516': ['NGC 2516', 'NGC 2516'],
  'NGC 3372': ['Nebulosa de Carina (Eta Carinae)', 'Carina Nebula (Eta Carinae)'], 'NGC 3532': ['Pozo de los Deseos', 'Wishing Well'], 'NGC 5139': ['Omega Centauri', 'Omega Centauri'],
  'NGC 6231': ['NGC 6231', 'NGC 6231'], 'NGC 292': ['Pequeña Nube de Magallanes', 'Small Magellanic Cloud'], 'IC 2391': ['Omicron Velorum', 'Omicron Velorum'], 'GC': ['Centro de la galaxia', 'Galactic Center'],
}
dso = []
for f in L('dsos.bright.json')['features']:
    p = f['properties']; ra, de = f['geometry']['coordinates']
    es, en = NOMBRES_DSO.get(f['id'], [f['id'], f['id']])
    dim = p.get('dim') or '10'; dim = float(str(dim).split('x')[0] or 10)
    dso.append([f['id'], es, en, p['type'], p.get('mag') or 0, dim, round(ra % 360, 2), round(de, 2)])

J = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
salida = f"""/* ============================================================================
   aeroplaza/js/cielo-datos.js — el cielo del telescopio (estelario.js). NO SE TOCA A
   MANO: sale de herramientas/cielo.py con los datos de d3-celestial:
   estrellas hasta magnitud 6 (Yale Bright Star Catalogue / Hipparcos), nombres,
   constelaciones y sus líneas, la Vía Láctea y los objetos brillantes de cielo profundo.

   {lic.replace(chr(10), chr(10) + '   ')}
   ========================================================================== */
/* cada estrella: RA (uint16, ×360/65535), Dec (int16, ×90/32767), (mag + 2) × 25, (B−V + 0,5) × 80 */
export const ESTRELLAS = '{est}';
/* [índice en ESTRELLAS, nombre (español si hay), letra de Bayer, constelación, nombre en inglés] */
export const NOMBRES = {J(nom)};
/* [sigla, latín, español, inglés, RA del nombre, Dec del nombre, rango 1-3] */
export const CONSTEL = {J(con)};
/* sigla → [[[RA, Dec], …], …] */
export const LINEAS = {J(lin)};
/* [id, español, inglés, tipo, mag, tamaño en minutos, RA, Dec] */
export const DSOS = {J(dso)};
"""
open(os.path.join(AQUI, '..', 'js', 'cielo-datos.js'), 'w').write(salida)
print('estrellas', len(ids), 'con nombre', len(nom), 'const', len(con), 'via', len(via), sum(len(v[1]) * 3 // 16 for v in via), 'pts', 'dsos', len(dso), f'{len(salida) / 1024:.0f} KB')
