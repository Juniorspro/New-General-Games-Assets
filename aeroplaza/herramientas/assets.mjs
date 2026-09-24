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
  ['nube-g1.png', 'nube-1.webp', 768, 82, true],
  ['ciudad-g1.png', 'ciudad.webp', 1280, 80, true],
  ['mariposa-g1.png', 'mariposa.webp', 256, 85, true],
  ['fondo-menu-g1.png', 'fondo-menu.webp', 1280, 74, false],
];
for (const [c, s, ancho, q, alfa] of IMAGENES) {
  const f = path.join(CRUDO, c); if (!fs.existsSync(f)) { console.log('falta', c); continue; }
  let img = sharp(f).resize({ width: ancho });
  if (!alfa) img = img.removeAlpha();
  await img.webp({ quality: q, alphaQuality: 90, effort: 6 }).toFile(path.join(SAL, s));
  console.log(`${s}: ${(fs.statSync(path.join(SAL, s)).size / 1024).toFixed(0)} KB`);
}
/* una segunda y tercera nube: la misma, espejada y recortada distinto (Rezona devolvió una sola de las tres pedidas) */
if (fs.existsSync(path.join(CRUDO, 'nube-g1.png'))) {
  await sharp(path.join(CRUDO, 'nube-g1.png')).flop().resize({ width: 640 }).webp({ quality: 82 }).toFile(path.join(SAL, 'nube-2.webp'));
  const m = await sharp(path.join(CRUDO, 'nube-g1.png')).metadata();
  await sharp(path.join(CRUDO, 'nube-g1.png')).extract({ left: Math.round(m.width * 0.08), top: 0, width: Math.round(m.width * 0.6), height: m.height }).resize({ width: 512 }).webp({ quality: 82 }).toFile(path.join(SAL, 'nube-3.webp'));
}

/* el delfín */
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { dedup, prune, textureCompress, weld, quantize, simplify } = require('@gltf-transform/functions');
const { MeshoptSimplifier } = require('meshoptimizer');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
const triangulos = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);
for (const [c, s, meta] of [['delfin-g1.glb', 'delfin.glb', 9000]]) {
  const f = path.join(CRUDO, c); if (!fs.existsSync(f)) { console.log('falta', c); continue; }
  const doc = await io.read(f);
  await doc.transform(weld(), dedup());
  const antes = triangulos(doc);
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, meta / antes), error: 0.01 }));
  const mt = doc.getRoot().listMaterials()[0];
  if (mt) { const t = mt.getMetallicRoughnessTexture(); mt.setMetallicRoughnessTexture(null); mt.setMetallicFactor(0); mt.setRoughnessFactor(0.25); if (t) t.dispose(); }
  doc.getRoot().listTextures().forEach((t, i) => { if (!t.getName()) t.setName('tex' + i); });
  const color = mt?.getBaseColorTexture(), normal = mt?.getNormalTexture();
  const comp = (t, lado, q) => t && doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [lado, lado], quality: q, pattern: new RegExp('^' + t.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }));
  await comp(color, 1024, 80); await comp(normal, 512, 85);
  await doc.transform(quantize(), prune());
  await io.write(path.join(SAL, s), doc);
  console.log(`${s}: ${antes} → ${triangulos(doc)} triángulos · ${(fs.statSync(path.join(SAL, s)).size / 1024).toFixed(0)} KB`);
}
