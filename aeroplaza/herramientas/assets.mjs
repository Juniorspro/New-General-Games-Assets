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
/* las nubes: donde la imagen es transparente, el color de abajo era oscuro y al
   filtrar la textura salía un borde gris. Se aclara el color de los bordes
   (sin tocar el alfa) y de ahí salen las tres: la misma, espejada y recortada
   (Rezona devolvió una sola de las tres pedidas) */
if (fs.existsSync(path.join(CRUDO, 'nube-g1.png'))) {
  const { data, info } = await sharp(path.join(CRUDO, 'nube-g1.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) { const a = data[i + 3] / 255; if (a < 0.98) for (let c = 0; c < 3; c++) data[i + c] = Math.round(255 + (data[i + c] - 255) * Math.pow(a, 0.6)); }
  const limpia = await sharp(data, { raw: info }).png().toBuffer();
  await sharp(limpia).resize({ width: 768 }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(SAL, 'nube-1.webp'));
  await sharp(limpia).flop().resize({ width: 640 }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(SAL, 'nube-2.webp'));
  await sharp(limpia).extract({ left: Math.round(info.width * 0.08), top: 0, width: Math.round(info.width * 0.6), height: info.height }).resize({ width: 512 }).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(SAL, 'nube-3.webp'));
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
