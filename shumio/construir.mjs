// Arma shumio/index.html: la plantilla + todos los src/*.js en orden, en un solo <script>.
// Un archivo, cero red (guias/GUIA_JUEGOS_2D_PIXEL.md § 0).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const dir = new URL("./src/", import.meta.url);
const partes = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
let codigo = "";
for (const f of partes) codigo += `\n// ══════════ ${f} ══════════\n` + readFileSync(new URL(f, dir), "utf8");
if (codigo.includes("</script")) throw new Error("hay un </script adentro del código");
const plantilla = readFileSync(new URL("./plantilla.html", import.meta.url), "utf8");
const html = plantilla.replace("/*CODIGO*/", () => codigo);
writeFileSync(new URL("./index.html", import.meta.url), html);
console.log(`✓ index.html (${partes.length} partes, ${(html.length / 1024).toFixed(0)} KB)`);
