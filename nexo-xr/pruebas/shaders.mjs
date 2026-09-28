// Compila TODOS los shaders de la app con el WebGL 1 de Chromium (el mismo
// GLSL ES 1.00 de OpenGL ES 2.0): saca cada Gl.programa("vs", "fs") de los
// .java, los compila y los enlaza. La textura externa de la cámara (OES) no
// existe en WebGL: se prueba como sampler2D, que se usa igual.
//
//   node pruebas/shaders.mjs
import { extraerProgramas } from "./extraer.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "../../mundo-ar/node_modules/playwright");

const programas = extraerProgramas();

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const pag = await nav.newPage();
const res = await pag.evaluate((programas) => {
  const gl = document.createElement("canvas").getContext("webgl");
  gl.getExtension("OES_standard_derivatives");   // como la pide three.js (la mano fantasma usa fwidth)
  if (!gl) return [{ error: "sin WebGL" }];
  return programas.map((p) => {
    const sh = (tipo, s) => { const o = gl.createShader(tipo); gl.shaderSource(o, s); gl.compileShader(o); return [o, gl.getShaderParameter(o, gl.COMPILE_STATUS) ? "" : gl.getShaderInfoLog(o)]; };
    const [v, ev] = sh(gl.VERTEX_SHADER, p.vs), [f, ef] = sh(gl.FRAGMENT_SHADER, p.fs);
    let el = "";
    if (!ev && !ef) { const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) el = gl.getProgramInfoLog(pr); }
    return { archivo: p.archivo, error: [ev && "VS: " + ev, ef && "FS: " + ef, el && "enlace: " + el].filter(Boolean).join(" ") };
  });
}, programas);
await nav.close();
let mal = 0;
for (const r of res) { console.log((r.error ? "✗ " : "✓ ") + r.archivo + (r.error ? "  " + r.error : "")); if (r.error) mal++; }
console.log(mal ? `\n✗ ${mal} de ${res.length} programas no compilan` : `\n✓ los ${res.length} programas compilan y enlazan`);
process.exit(mal ? 1 : 0);
