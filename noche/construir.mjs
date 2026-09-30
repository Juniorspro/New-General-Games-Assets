// Arma noche/index.html: la plantilla + todos los src/*.js en orden, en un solo <script>.
// Un archivo, cero red (guias/GUIA_JUEGOS_2D_PIXEL.md § 0).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const dir = new URL("./src/", import.meta.url);
const partes = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
// la letra (Courier Prime Bold, OFL, recortada a lo que se usa) va adentro, en base64: cero red
const fuente = readFileSync(new URL("./fuentes/CourierPrime-Bold-sub.woff", import.meta.url)).toString("base64");
let codigo = `'use strict';\nconst FUENTE_B64 = "${fuente}";\n`;
for (const f of partes) codigo += `\n// ══════════ ${f} ══════════\n` + readFileSync(new URL(f, dir), "utf8");
if (codigo.includes("</script")) throw new Error("hay un </script adentro del código");
// todo va en un solo <script>: dos funciones con el mismo nombre en archivos distintos se pisan en
// silencio (así el bloque de piedra se dibujaba como la palabra "undefined"). Que no pase nunca más.
const nombres = new Map();
for (const f of partes) for (const m of readFileSync(new URL(f, dir), "utf8").matchAll(/^(?:async )?(?:function|const|let|var|class) ([A-Za-z0-9_$]+)/gm)) {
  if (nombres.has(m[1])) throw new Error(`"${m[1]}" está definido dos veces: ${nombres.get(m[1])} y ${f}`);
  nombres.set(m[1], f);
}
const plantilla = readFileSync(new URL("./plantilla.html", import.meta.url), "utf8");
const html = plantilla.replace("/*CODIGO*/", () => codigo);
writeFileSync(new URL("./index.html", import.meta.url), html);
console.log(`✓ index.html (${partes.length} partes, ${(html.length / 1024).toFixed(0)} KB)`);
