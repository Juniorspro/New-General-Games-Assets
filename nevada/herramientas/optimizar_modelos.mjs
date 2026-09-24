// Los GLB de Rezona (Tripo), llevados a un peso que un teléfono aguanta.
//
//     node herramientas/optimizar_modelos.mjs
//
// LO QUE LLEGA: entre 650 mil y 970 mil triángulos y tres texturas de 4096 por
// modelo (35-46 MB cada uno). Se simplifica APUNTANDO A UNA CANTIDAD de
// triángulos por modelo y no con un ratio fijo: las densidades de Tripo varían
// mucho y con el mismo ratio un modelo queda de papel y otro sigue pesado.
// El relieve fino lo sigue dando la textura de normales, que se conserva.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, weld, quantize, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CRUDO = path.join(AQUI, 'crudo'), SAL = path.join(AQUI, 'assets');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

// [crudo, salida, triángulos meta, lado del color, lado de normales, ¿metal/rugosidad?]
// El auto es el protagonista y se ve a medio metro: más triángulos y color a 2048.
// El tigre que camina pasa a dos metros: 30 mil alcanzan. La cabeza que ruge se
// ve en primerísimo plano: color a 2048.
const MODELOS = [
  ['m-auto.glb', 'auto.glb', 70000, 2048, 2048, true],
  ['m-tigre-parado.glb', 'tigre-parado.glb', 30000, 2048, 1024, false],
  ['m-tigre-echado.glb', 'tigre-echado.glb', 32000, 2048, 1024, false],
  ['m-tigre-ruge.glb', 'tigre-ruge.glb', 36000, 2048, 1024, false],
];

const triangulos = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, p) => t + (p.getIndices() ? p.getIndices().getCount() / 3 : 0), 0), 0);

for (const [crudo, salida, meta, ladoColor, ladoNormal, conMR] of MODELOS) {
  const f = path.join(CRUDO, crudo);
  if (!fs.existsSync(f)) { console.log('falta', crudo); continue; }
  const doc = await io.read(f);
  await doc.transform(weld(), dedup());
  const antes = triangulos(doc);
  // el simplificador baja hasta el ratio pedido o hasta que el error lo frena:
  // se pide el ratio de la meta y un error holgado, y se mide lo que quedó
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, meta / antes), error: 0.01 }));
  const despues = triangulos(doc);
  const mt = doc.getRoot().listMaterials()[0];
  if (!conMR && mt) { const t = mt.getMetallicRoughnessTexture(); mt.setMetallicRoughnessTexture(null); mt.setMetallicFactor(0); mt.setRoughnessFactor(0.85); if (t) t.dispose(); }
  // cada textura a su lado: el color y las normales por separado
  const tex = (t, lado, calidad) => t && doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [lado, lado], quality: calidad, pattern: new RegExp('^' + t.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }));
  const lista = doc.getRoot().listTextures();
  const color = mt?.getBaseColorTexture(), normal = mt?.getNormalTexture(), mr = mt?.getMetallicRoughnessTexture();
  lista.forEach((t, i) => { if (!t.getName()) t.setName('tex' + i); });
  await tex(color, ladoColor, 82);
  await tex(normal, ladoNormal, 90);
  if (mr) await tex(mr, 1024, 80);
  await doc.transform(quantize(), prune());
  const dest = path.join(SAL, salida);
  await io.write(dest, doc);
  console.log(`${salida}: ${antes} → ${despues} triángulos · ${(fs.statSync(dest).size / 1048576).toFixed(2)} MB`);
}
