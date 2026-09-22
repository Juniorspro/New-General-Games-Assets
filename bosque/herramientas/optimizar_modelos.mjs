// Los GLB de Higgsfield, llevados a un peso que un teléfono baja.
//
//     node herramientas/optimizar_modelos.mjs <carpeta-con-lo-crudo>
//
// LO QUE LLEGA NO SIRVE TAL CUAL: cada roca trae tres texturas de 4096 (color,
// normal y rugosidad) y pesa 5 MB; en memoria de video son 89 MB POR ROCA,
// porque la tarjeta descomprime el jpeg. Siete objetos así no entran en un
// teléfono. Un objeto que se ve a tres metros no necesita más de 1024.
//
// EL CAMINANTE LLEGA EN CUATRO ARCHIVOS: el servicio de esqueleto devuelve una
// animación por pedido, cada una con su propia copia de la malla y de la
// textura (10 MB cada una). Se queda con UNA malla y se le pasan las otras
// animaciones, reenganchadas a los huesos POR NOMBRE. Funciona porque los
// cuatro esqueletos salieron del mismo modelo: mismos nombres, misma jerarquía.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, resample, textureCompress, weld, quantize, simplify } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const CRUDO = process.argv[2];
if (!CRUDO) { console.log("uso: node herramientas/optimizar_modelos.mjs <crudo>"); process.exit(1); }
const SALIDA = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "assets");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0) + " KB";

/** Achica y pasa a webp. `lado` es el lado máximo de cada textura. */
async function texturas(doc, lado, calidad = 78) {
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [lado, lado], quality: calidad }));
}

// ── objetos ─────────────────────────────────────────────────────────────
// [archivo crudo, nombre, lado de textura, proporción de triángulos a dejar]
// Las rocas, los troncos caídos y los tocones se repiten decenas de veces por
// el bosque: con 7.600 triángulos cada roca, veinte a la vista ya son 150 mil,
// más que todos los árboles cercanos juntos. Se simplifican a un tercio; la
// forma la sigue dando la textura de normales, que no se toca.
const OBJETOS = [
  ["m-roca.glb", "roca", 1024, 0.33],
  ["m-laja.glb", "laja", 1024, 0.33],
  ["m-tronco.glb", "tronco", 1024, 0.3],
  ["m-tocon.glb", "tocon", 1024, 0.25],
  ["m-cabana.glb", "cabana", 1024, 1],
  ["m-fogata.glb", "fogata", 1024, 1],
  // la cinta mide 19 cm: su textura nunca ocupa más de 200 pixeles en pantalla
  ["m-cinta.glb", "cinta", 512, 1],
];

for (const [crudo, nombre, lado, prop] of OBJETOS) {
  const doc = await io.read(path.join(CRUDO, crudo));
  await doc.transform(weld(), dedup());
  if (prop < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: prop, error: 0.012 }));
  await texturas(doc, lado);
  // quantize: posiciones y normales en enteros de 16 bits. Three lo lee sin
  // decodificador (KHR_mesh_quantization) y la geometría pesa la mitad.
  await doc.transform(quantize(), prune());
  const destino = path.join(SALIDA, `${nombre}.glb`);
  await io.write(destino, doc);
  console.log(`  ${nombre.padEnd(10)} ${kb(path.join(CRUDO, crudo)).padStart(9)} → ${kb(destino)}`);
}

// ── el caminante ────────────────────────────────────────────────────────
const CLIPS = [
  ["c-camina.glb", "camina"],
  ["c-quieto.glb", "quieto"],
  ["c-corre.glb", "corre"],
  ["c-mirar.glb", "mirar"],
];
const base = await io.read(path.join(CRUDO, CLIPS[0][0]));
const raiz = base.getRoot();
const porNombre = new Map(raiz.listNodes().map((n) => [n.getName(), n]));
raiz.listAnimations()[0].setName(CLIPS[0][1]);

for (const [archivo, nombre] of CLIPS.slice(1)) {
  const p = path.join(CRUDO, archivo);
  if (!fs.existsSync(p)) { console.log(`  (falta ${archivo}: esa animación no va)`); continue; }
  const otro = await io.read(p);
  const anim = otro.getRoot().listAnimations()[0];
  const nueva = base.createAnimation(nombre);
  let sueltos = 0;
  for (const canal of anim.listChannels()) {
    const destino = porNombre.get(canal.getTargetNode()?.getName());
    if (!destino) { sueltos++; continue; }
    const s = canal.getSampler();
    // Los accessors son de OTRO documento: se copian los números, no la
    // referencia. Pasar la referencia arma un GLB que se escribe sin error y
    // que three no puede leer.
    const entrada = base.createAccessor().setType(s.getInput().getType()).setArray(s.getInput().getArray().slice());
    const salida = base.createAccessor().setType(s.getOutput().getType()).setArray(s.getOutput().getArray().slice());
    const muestreo = base.createAnimationSampler().setInput(entrada).setOutput(salida).setInterpolation(s.getInterpolation());
    nueva.addSampler(muestreo).addChannel(
      base.createAnimationChannel().setTargetNode(destino).setTargetPath(canal.getTargetPath()).setSampler(muestreo));
  }
  console.log(`  clip ${nombre}: ${anim.listChannels().length - sueltos} canales${sueltos ? `, ${sueltos} sin hueso` : ""}`);
}

// EL CAMINANTE BRILLABA EN LA SOMBRA. El material trae la MISMA textura de
// color enchufada también como emisiva: de noche, debajo de un abeto, el tipo
// se veía iluminado como un cartel. Se le saca la emisión.
for (const m of raiz.listMaterials()) {
  m.setEmissiveTexture(null);
  m.setEmissiveFactor([0, 0, 0]);
  // el servicio lo marca de dos caras; con dos caras las sombras se le pegan
  // por dentro de la campera
  m.setDoubleSided(false);
}
await base.transform(
  // `resample` saca las claves que se pueden interpolar de sus vecinas: 3.144
  // claves en la caminata, casi todas redundantes
  resample(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.004 }),
);
await texturas(base, 1024, 82);
await base.transform(prune(), dedup());
const destinoC = path.join(SALIDA, "caminante.glb");
await io.write(destinoC, base);
console.log(`  caminante  ${kb(path.join(CRUDO, CLIPS[0][0])).padStart(9)} → ${kb(destinoC)}`);
