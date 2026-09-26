// Segunda pasada sobre procesados/: el algarrobo no bajaba de 7.600 triángulos con
// error 0,02 (el simplificador cuidaba las costuras de UV de las hojas) y con 90
// árboles era la mitad de lo que se dibujaba. Los personajes (19.000) se ven de
// cerca, pero 9.000 alcanzan. Uso: node achicar.mjs  (después procesar.py y armar_datos.py)
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { weld, simplify, prune } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const SAL = "../../procesados/";
const tris = (doc) => doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute("POSITION").getCount()) / 3, 0), 0);
await MeshoptSimplifier.ready;
for (const [k, meta, error] of [["algarrobo", 2600, 0.12], ["conductor", 9000, 0.012], ["conductora", 9000, 0.012], ["policia", 9000, 0.012]]) {
  const doc = await io.read(SAL + `${k}.glb`), antes = tris(doc);
  await doc.transform(weld({ tolerance: 0.0005 }), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, meta / antes), error }), prune());
  await io.write(SAL + `${k}.glb`, doc);
  console.log(k, antes, "→", Math.round(tris(doc)));
}
// El algarrobo son muchas islas sueltas (hojas): el simplificador común no las junta.
// simplifySloppy no respeta la topología y sí llega a la meta; a la distancia de la ruta no se nota.
{
  const doc = await io.read(SAL + "algarrobo.glb"), antes = tris(doc);
  for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) {
    const ind = pr.getIndices(), pos = pr.getAttribute("POSITION"); if (!ind) continue;
    const idx = new Uint32Array(ind.getArray()), p = new Float32Array(pos.getArray());
    const [nuevos] = MeshoptSimplifier.simplifySloppy(idx, p, 3, null, Math.min(idx.length, Math.floor((idx.length * 2600) / antes / 3) * 3), 0.12);
    ind.setArray(new Uint32Array(nuevos));
  }
  await doc.transform(prune());
  await io.write(SAL + "algarrobo.glb", doc);
  console.log("algarrobo (sloppy)", antes, "→", Math.round(tris(doc)));
}
