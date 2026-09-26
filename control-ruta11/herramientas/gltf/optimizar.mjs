// Achica los GLB de Rezona para el juego (GUIA-JUEGOS.md § 4):
//  - estáticos: weld → simplify (meshoptimizer) → prune
//  - con esqueleto: se queda con el GLB "quieto" y le copia la animación de
//    caminar del otro GLB (mismo esqueleto, huesos por nombre)
// Las texturas las pasa a JPEG después procesar.py (con PIL).
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, prune, dedup } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import fs from "fs";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const CR = "../../crudos/", SAL = "../../procesados/";
fs.mkdirSync(SAL, { recursive: true });
const tris = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0), 0);
// Cuántos triángulos se quiere para cada uno (se ven de cerca: autos y garita).
const ESTATICOS = { pickup: 7000, sedan: 8000, compacto: 8000, hatch: 8000, camion: 9000, moto: 4000, patrullero: 9000, motopol: 5000, garita: 4000, algarrobo: 3000, quebracho: 2500 };
// La segunda pasada (de a uno, revisando cada imagen y cada 3D) dejó versiones
// mejores de algunos en crudos/uno/: si están, se usan esas.
const origen = (k) => { const v2 = CR + `uno/v2-modelo-${k}-g1.glb`; return fs.existsSync(v2) ? v2 : CR + `modelo-${k}-g1.glb`; };
await MeshoptSimplifier.ready;
for (const [k, meta] of Object.entries(ESTATICOS)) {
  const doc = await io.read(origen(k)); const antes = tris(doc);
  await doc.transform(weld({ tolerance: 0.0001 }), dedup());
  const ratio = Math.min(1, meta / tris(doc));
  if (ratio < 0.98) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02 }));
  await doc.transform(prune());
  await io.write(SAL + `${k}.glb`, doc);
  console.log(k, origen(k).includes("/uno/") ? "(v2)" : "", antes, "→", Math.round(tris(doc)));
}
// Personajes: el quieto con la caminata copiada.
for (const k of ["conductor", "conductora", "policia"]) {
  const doc = await io.read(CR + `rig-${k}-idle-g1.glb`), otro = await io.read(CR + `rig-${k}-walk-g1.glb`);
  const nodos = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const buf = doc.getRoot().listBuffers()[0];
  doc.getRoot().listAnimations().forEach((a) => a.setName("idle"));
  for (const a of otro.getRoot().listAnimations()) {
    const nueva = doc.createAnimation("walk");
    for (const ch of a.listChannels()) {
      const dest = nodos.get(ch.getTargetNode()?.getName()); if (!dest) continue;
      const s = ch.getSampler(), copiar = (acc) => doc.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buf);
      const ns = doc.createAnimationSampler().setInput(copiar(s.getInput())).setOutput(copiar(s.getOutput())).setInterpolation(s.getInterpolation());
      nueva.addSampler(ns).addChannel(doc.createAnimationChannel().setTargetNode(dest).setTargetPath(ch.getTargetPath()).setSampler(ns));
    }
  }
  await doc.transform(prune());
  await io.write(SAL + `${k}.glb`, doc);
  console.log(k, Math.round(tris(doc)), "triángulos, animaciones:", doc.getRoot().listAnimations().map((a) => a.getName() + " " + a.listChannels().length).join(", "));
}
