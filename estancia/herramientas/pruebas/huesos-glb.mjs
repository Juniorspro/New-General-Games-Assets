import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const fs = require("fs");
const three = fs.readFileSync("three.min.js", "utf8"), gl = fs.readFileSync("GLTFLoader.js", "utf8");
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const p = await b.newPage();
await p.setContent(`<html><body><script>${three}</script><script>${gl}</script></body></html>`);
for (const archivo of process.argv.slice(2)) {
  const b64 = fs.readFileSync(archivo).toString("base64");
  const r = await p.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
    const g = await new Promise((ok, mal) => new THREE.GLTFLoader().parse(bin, "", ok, mal));
    const raiz = g.scene; raiz.updateMatrixWorld(true);
    const caja = new THREE.Box3().setFromObject(raiz);
    const cuenta = {}; let mallas = 0;
    raiz.traverse((o) => { if (!o.isSkinnedMesh) return; mallas++;
      const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
      for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) { if (sw.getComponent(i, k) < 0.3) continue; const n = o.skeleton.bones[si.getComponent(i, k)].name; cuenta[n] = (cuenta[n] || 0) + 1; } });
    const lista = []; const V = THREE.Vector3;
    const rec = (o, pr) => { if (o.isBone) { const w = o.getWorldPosition(new V()); lista.push("  ".repeat(pr) + o.name + " [" + w.toArray().map((v) => v.toFixed(2)).join(",") + "] v=" + (cuenta[o.name] || 0)); } for (const h of o.children) rec(h, o.isBone ? pr + 1 : pr); };
    rec(raiz, 0);
    return { caja: [caja.min.toArray().map((v) => v.toFixed(2)), caja.max.toArray().map((v) => v.toFixed(2))], mallas, clips: g.animations.map((a) => a.name + " " + a.duration.toFixed(2)), huesos: lista };
  }, b64);
  console.log("==", archivo, JSON.stringify(r.caja), "mallas", r.mallas, r.clips.join(", ")); console.log(r.huesos.join("\n"));
}
await b.close();
