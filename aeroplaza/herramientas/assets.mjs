// De lo que bajó de Rezona (crudo/) a lo que va adentro del juego (assets/).
//
//     node herramientas/assets.mjs
//
// - Motivos del muñeco, pasto y arena: texturas que se repiten, 512 px en webp.
// - Nube, ciudad y mariposa: con canal alfa (transparent:true de Rezona).
// - El fondo del menú: 1280 de ancho, webp 74 (lo que se ve atrás de los canales).
// - El delfín (Tripo): llega con ~500 mil triángulos y texturas de 4096 (20 MB);
//   se baja a una CANTIDAD de triángulos (no a un ratio: las densidades de Tripo
//   varían mucho, ver memoria/rezona.md) y la textura a 1024.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(AQUI, '../bosque/node_modules/x.js'));
const sharp = require('sharp');
const CRUDO = path.join(AQUI, 'crudo'), SAL = path.join(AQUI, 'assets');

const IMAGENES = [
  // [crudo, salida, ancho, calidad, alfa]
  ['pasto-g1.png', 'pasto.webp', 512, 80, false],
  ['arena-g1.png', 'arena.webp', 512, 80, false],
  ['ciudad-g1.png', 'ciudad.webp', 1280, 80, true],
  ['mariposa-g1.png', 'mariposa.webp', 256, 85, true],
  ['fondo-menu-g1.png', 'fondo-menu.webp', 1280, 74, false],
  ['t3/cielo-panorama.png', 'cielo.webp', 1376, 78, false],
];
for (const [c, s, ancho, q, alfa] of IMAGENES) {
  const f = path.join(CRUDO, c); if (!fs.existsSync(f)) { console.log('falta', c); continue; }
  let img = sharp(f).resize({ width: ancho });
  if (!alfa) img = img.removeAlpha();
  await img.webp({ quality: q, alphaQuality: 90, effort: 6 }).toFile(path.join(SAL, s));
  console.log(`${s}: ${(fs.statSync(path.join(SAL, s)).size / 1024).toFixed(0)} KB`);
}
/* el panorama del cielo, repetible: se funde el final con el principio en 320 px
   (antes iba espejado en el juego y en cada unión salía una nube simétrica).
   Las nubes de arriba ya no son imágenes: van en el shader del cielo (cielo.js) */
/* (solo si recién se hizo desde el crudo: sobre la ya repetible la achicaría otra vez) */
if (fs.existsSync(path.join(CRUDO, 't3/cielo-panorama.png'))) {
  const f = path.join(SAL, 'cielo.webp');
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, B = 320, W2 = W - B, sal = Buffer.alloc(W2 * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W2; x++) for (let c = 0; c < 3; c++) {
    const i = (y * W + x) * 3 + c;
    let v = data[i];
    if (x < B) { let w = x / (B - 1); w = w * w * (3 - 2 * w); v = data[(y * W + x + W2) * 3 + c] * (1 - w) + data[i] * w; }
    sal[(y * W2 + x) * 3 + c] = Math.round(v);
  }
  await sharp(sal, { raw: { width: W2, height: H, channels: 3 } }).webp({ quality: 88, effort: 6 }).toFile(f + '.tmp');
  fs.renameSync(f + '.tmp', f);
}

/* el delfín */
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { dedup, prune, textureCompress, weld, quantize, simplify } = require('@gltf-transform/functions');
const { MeshoptSimplifier } = require('meshoptimizer');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const triangulos = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);
/* [crudo, salida, triángulos, lado de la textura de color, lado del mapa de normales (0: sin)].
   Las construcciones (casa, estación, tienda…) ya no son GLB: se arman en
   js/construcciones.js copiando las referencias de Rezona (crudo/t3/ref-*.png) */
const MODELOS = [['delfin-g1.glb', 'delfin.glb', 9000, 1024, 512]];
const solo = process.argv[2];   // node herramientas/assets.mjs casa → solo ese modelo
for (const [c, s, meta, ladoC, ladoN] of MODELOS) {
  if (solo && !s.startsWith(solo)) continue;
  const f = path.join(CRUDO, c); if (!fs.existsSync(f)) { console.log('falta', c); continue; }
  const doc = await io.read(f);
  await doc.transform(weld(), dedup());
  const antes = triangulos(doc);
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, meta / antes), error: 0.01 }));
  const mt = doc.getRoot().listMaterials()[0];
  if (mt) { const t = mt.getMetallicRoughnessTexture(); mt.setMetallicRoughnessTexture(null); mt.setMetallicFactor(0); mt.setRoughnessFactor(0.25); if (t) t.dispose(); }
  doc.getRoot().listTextures().forEach((t, i) => { if (!t.getName()) t.setName('tex' + i); });
  const color = mt?.getBaseColorTexture(), normal = mt?.getNormalTexture();
  if (normal && !ladoN) { mt.setNormalTexture(null); normal.dispose(); }
  const comp = (t, lado, q) => t && doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [lado, lado], quality: q, pattern: new RegExp('^' + t.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }));
  await comp(color, ladoC, 80); if (ladoN) await comp(normal, ladoN, 85);
  await doc.transform(quantize(), prune());
  await io.write(path.join(SAL, s), doc);
  console.log(`${s}: ${antes} → ${triangulos(doc)} triángulos · ${(fs.statSync(path.join(SAL, s)).size / 1024).toFixed(0)} KB`);
}
