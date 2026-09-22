// Arma un juego de motor2d en UN archivo HTML que abre con doble clic.
//
//     node motor2d/armar.mjs zonda        → zonda/zonda.html
//
// Lee <juego>/juego.json: { "salida", "css": [...], "js": [...] }. Junta el CSS
// en un <style> y el JS en un <script> adentro de una sola función con
// 'use strict'. Antes de escribir, compila el JS: un error de sintaxis se ve
// acá con archivo y línea, y no como una pantalla negra en el teléfono.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const nombre = process.argv[2];
if (!nombre) { console.error("uso: node motor2d/armar.mjs <juego>"); process.exit(1); }
const dir = path.join(RAIZ, nombre);
const def = JSON.parse(fs.readFileSync(path.join(dir, "juego.json"), "utf8"));

const css = def.css.map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n");
const partes = [], tramos = [];
let linea = 2;
for (const f of def.js) {
  const txt = fs.readFileSync(path.join(RAIZ, f), "utf8");
  const n = txt.split("\n").length + 1;
  tramos.push({ f, desde: linea + 1, hasta: linea + n });
  partes.push(`/* ==== ${f} ==== */\n${txt}`);
  linea += n;
}
const js = `(()=>{'use strict';\n${partes.join("\n")}\n})();`;

try {
  new vm.Script(js, { filename: "juego.js" });
} catch (e) {
  const m = /juego\.js:(\d+)/.exec(e.stack || "");
  const l = m ? +m[1] : 0, t = tramos.find((x) => l >= x.desde && l <= x.hasta);
  console.error(`ERROR DE SINTAXIS: ${e.message}` + (t ? ` — ${t.f}:${l - t.desde + 1}` : ""));
  process.exit(1);
}

let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
// un "</script" adentro del código cerraría la etiqueta a mitad del archivo y
// el navegador cortaría el juego ahí, sin ningún error que lo diga
const seguro = js.replace(/<\/script/gi, "<\\/script");
if (!html.includes("<!--CSS-->") || !html.includes("<!--JS-->")) { console.error("faltan <!--CSS--> o <!--JS--> en index.html"); process.exit(1); }
html = html.replace("<!--CSS-->", () => `<style>\n${css}\n</style>`).replace("<!--JS-->", () => `<script>\n${seguro}\n</script>`);
const salida = path.join(dir, def.salida);
fs.writeFileSync(salida, html);
console.log(`${path.relative(RAIZ, salida)}: ${(fs.statSync(salida).size / 1024).toFixed(0)} KB · ${def.js.length} archivos de código`);
