// Arma wyrmguard/index.html: la plantilla + todos los src/*.js en orden, en un solo <script>.
// Un archivo, cero red: la letra va adentro en base64.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const dir = new URL("./src/", import.meta.url);
const partes = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const fuente = readFileSync(new URL("./fuentes/PixulBrush-es.ttf", import.meta.url)).toString("base64");
let codigo = `'use strict';\nconst FUENTE_B64 = "${fuente}";\n`;
for (const f of partes) codigo += `\n// ══════════ ${f} ══════════\n` + readFileSync(new URL(f, dir), "utf8");
if (codigo.includes("</script")) throw new Error("hay un </script adentro del código");
// todo va en un solo <script>: dos cosas con el mismo nombre en archivos distintos se pisan en
// silencio (memoria/juegos.md). Que el armado corte.
const nombres = new Map();
for (const f of partes) for (const m of readFileSync(new URL(f, dir), "utf8").matchAll(/^(?:async )?(?:function|const|let|var|class) ([A-Za-z0-9_$]+)/gm)) {
  if (nombres.has(m[1])) throw new Error(`"${m[1]}" está definido dos veces: ${nombres.get(m[1])} y ${f}`);
  nombres.set(m[1], f);
}
for (const f of partes) for (const m of readFileSync(new URL(f, dir), "utf8").matchAll(/^(?:let|var|const) ((?:[A-Za-z0-9_$]+ = [^,;(){}\[\]]+, )+[A-Za-z0-9_$]+ = [^;]*);/gm)) {
  for (const n of m[1].split(/, (?=[A-Za-z0-9_$]+ = )/).slice(1).map((x) => x.split(" = ")[0])) {
    if (nombres.has(n)) throw new Error(`"${n}" está definido dos veces: ${nombres.get(n)} y ${f}`);
    nombres.set(n, f);
  }
}
const plantilla = readFileSync(new URL("./plantilla.html", import.meta.url), "utf8");
const html = plantilla.replace("/*CODIGO*/", () => codigo);
writeFileSync(new URL("./index.html", import.meta.url), html);
console.log(`✓ index.html (${partes.length} partes, ${(html.length / 1024).toFixed(0)} KB)`);
