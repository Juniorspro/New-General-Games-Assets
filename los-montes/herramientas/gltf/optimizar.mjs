// Achica los GLB de Rezona para Los Montes. Adaptado de control-ruta11/herramientas/gltf/
// (optimizar.mjs + achicar.mjs, que acá quedaron en una sola pasada).
//  - estáticos: weld → simplify (meshoptimizer) → prune → quantize
//  - personajes: el GLB del rig "idle" con los clips "walk" y "run" copiados de los
//    otros dos rigs (mismo esqueleto: huesos por nombre), simplificado a ~9 mil
//    triángulos, con las curvas resampleadas (sacar claves redundantes) y quantize.
// Las texturas las pasa a JPEG después procesar.py (con PIL).
// Uso: node optimizar.mjs [clave ...]   (sin claves, todas). Lee crudos/, escribe crudos/procesados/.
//
// Por qué quantize (KHR_mesh_quantization): la geometría de un personaje con esqueleto
// pesa ~56 bytes por vértice en float; cuantizada, la mitad. three.js r160 la lee sin
// decodificador (GLTFLoader la trae incluida), a diferencia de Draco o meshopt, que
// piden un .wasm aparte que el descargable no tiene.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, prune, dedup, resample, quantize } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import fs from "fs";
import path from "path";
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const CR = path.join(AQUI, "../../crudos/"), SAL = CR + "procesados/";
fs.mkdirSync(SAL, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const tris = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0), 0);

// Personajes: todos con idle, walk y run (un rig por animación, memoria/rezona.md).
export const PERSONAJES = ["prota", "medica", "explorador", "mecanico", "sobreviviente1", "sobreviviente2", "mont_cazador", "mont_rapido", "mont_vigia", "mont_bruto", "mont_trampero", "mont_lider"];
// Estáticos: triángulos buscados (pedido: vehículos y cabañas 8–10 mil, pinos 1.500–3.000,
// rocas 1.500, objetos chicos 1.000–2.000). Las rocas quedaron en ~450: se instancian
// de a cientos y a 1.500 eran 630 mil triángulos solo de piedras. y error máximo del simplificador (fracción del
// tamaño del modelo). `fuente` cuando el bueno no es mod-<clave> (se rehízo la imagen).
export const ESTATICOS = {
  camioneta_grua: { tris: 9000 }, grua: { tris: 5000 }, camioneta_vieja: { tris: 8000 }, camion_maderero: { tris: 10000 },
  cabana: { tris: 10000 }, cabana_ruina: { tris: 9000 }, puente: { tris: 6000 }, mina_entrada: { tris: 6000 }, vagoneta: { tris: 2500 },
  pino1: { tris: 2500 }, pino2: { tris: 2500 }, roca1: { tris: 420, error: 0.05 }, roca2: { tris: 520, error: 0.05 }, tronco: { tris: 1500 },
  aserradero: { tris: 10000 }, tienda: { tris: 4000 }, cruces: { tris: 2500 }, jaula: { tris: 4000 }, trampa_oso: { tris: 2000 },
  farol: { tris: 1500 }, torre_agua: { tris: 6000 },
  pistola: { tris: 2000 }, escopeta: { tris: 2000 }, rifle: { tris: 2000 }, hacha: { tris: 1500 }, linterna: { tris: 1500 },
  botiquin: { tris: 1500 }, bateria: { tris: 1200 }, bidon: { tris: 1500 }, municion: { tris: 1500 }, lata: { tris: 1000 },
  herramientas: { tris: 2000 }, repuesto: { tris: 1500 },
};
// El último g<n> que haya bajado (si se rehizo el modelo con la misma clave, gana el nuevo).
const ultimo = (base) => {
  const fs_ = fs.readdirSync(CR).filter((f) => f.startsWith(base + "-g") && f.endsWith(".glb")).sort((a, b) => +a.match(/-g(\d+)\.glb$/)[1] - +b.match(/-g(\d+)\.glb$/)[1]);
  return fs_.length ? CR + fs_[fs_.length - 1] : null;
};
const achicar = async (doc, meta, error) => {
  await doc.transform(weld({ tolerance: 0.0001 }), dedup());
  const ratio = Math.min(1, meta / tris(doc));
  if (ratio < 0.98) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error }));
};

await MeshoptSimplifier.ready;
const pedidas = process.argv.slice(2);
const quiero = (k) => !pedidas.length || pedidas.includes(k);

for (const [k, cfg] of Object.entries(ESTATICOS)) {
  if (!quiero(k)) continue;
  const src = ultimo(cfg.fuente || `mod-${k}`);
  if (!src) { console.log(k, "— sin crudo, se saltea"); continue; }
  const doc = await io.read(src), antes = tris(doc);
  await achicar(doc, cfg.tris, cfg.error ?? 0.02);
  // Si con ese error no llegó (el simplificador cuida costuras de UV), se afloja de a poco.
  for (const e of [0.04, 0.08]) if (tris(doc) > cfg.tris * 1.15) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: cfg.tris / tris(doc), error: e }));
  await doc.transform(prune(), quantize());
  await io.write(SAL + `${k}.glb`, doc);
  console.log(k, path.basename(src), antes, "→", Math.round(tris(doc)));
}

for (const k of PERSONAJES) {
  if (!quiero(k)) continue;
  const base = ultimo(`rig-${k}-idle`);
  if (!base) { console.log(k, "— sin rig, se saltea"); continue; }
  const doc = await io.read(base), antes = tris(doc);
  const nodos = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buf = doc.getRoot().listBuffers()[0];
  doc.getRoot().listAnimations().forEach((a) => a.setName("idle"));
  for (const anim of ["walk", "run"]) {
    const f = ultimo(`rig-${k}-${anim}`); if (!f) { console.log(k, "— falta", anim); continue; }
    const otro = await io.read(f);
    for (const a of otro.getRoot().listAnimations()) {
      const nueva = doc.createAnimation(anim);
      for (const ch of a.listChannels()) {
        const dest = nodos.get(ch.getTargetNode()?.getName()); if (!dest) continue;
        const s = ch.getSampler(), copiar = (acc) => doc.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
        const ns = doc.createAnimationSampler().setInput(copiar(s.getInput())).setOutput(copiar(s.getOutput())).setInterpolation(s.getInterpolation());
        nueva.addSampler(ns).addChannel(doc.createAnimationChannel().setTargetNode(dest).setTargetPath(ch.getTargetPath()).setSampler(ns));
      }
    }
  }
  // Soldar con tolerancia más grande que en los estáticos (0,0005, como achicar.mjs de
  // Ruta 11): el modelo de Tripo viene partido en islas de UV y sin soldar no baja limpio.
  await doc.transform(weld({ tolerance: 0.0005 }), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, 9000 / tris(doc)), error: 0.012 }));
  await doc.transform(resample({ tolerance: 1e-4 }), prune(), quantize());
  await io.write(SAL + `${k}.glb`, doc);
  const an = doc.getRoot().listAnimations().map((a) => a.getName() + " " + a.listChannels().length);
  console.log(k, antes, "→", Math.round(tris(doc)), "| clips:", an.join(", "));
}
