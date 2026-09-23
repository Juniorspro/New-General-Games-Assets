// Arma KUNTUR en un solo HTML que abre con doble clic y anda sin internet.
//
//     node kuntur/herramientas/armar.mjs [--dev]
//
// Usa el three y el esbuild de node_modules (el de la raíz o, en el repo, el
// de bosque/). El CSS entra en <!--CSS--> y el código, empaquetado en un
// IIFE, en <!--JS-->. Con --dev no se minifica (para leer los errores).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAIZ = path.resolve(AQUI, "..");
/* los módulos: los de esta carpeta, los de la raíz (npm install en la raíz del
   zip) o los de bosque/ (en el repo, ya instalados) */
const MODULOS = [path.join(AQUI, "node_modules"), path.join(RAIZ, "node_modules"), path.join(RAIZ, "bosque/node_modules")].find((d) => fs.existsSync(path.join(d, "esbuild")) && fs.existsSync(path.join(d, "three")));
if (!MODULOS) { console.error("Faltan esbuild, three: corré npm install en la carpeta de arriba (ver LEEME.md)."); process.exit(1); }
const require = createRequire(path.join(MODULOS, "x.js"));
const esbuild = require("esbuild");
const dev = process.argv.includes("--dev");

const r = await esbuild.build({
  entryPoints: [path.join(AQUI, "js/main.js")],
  bundle: true, minify: !dev, format: "iife", target: "es2020", write: false,
  nodePaths: [MODULOS], legalComments: "none", metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
let codigo = r.outputFiles[0].text;
/* un "</script" adentro del código cerraría la etiqueta a mitad del archivo */
codigo = codigo.replace(/<\/script/gi, "<\\/script");
const css = fs.readFileSync(path.join(AQUI, "kuntur.css"), "utf8");
let html = fs.readFileSync(path.join(AQUI, "index.html"), "utf8");
if (!html.includes("<!--CSS-->") || !html.includes("<!--JS-->")) throw new Error("index.html necesita <!--CSS--> y <!--JS-->");
html = html.replace("<!--CSS-->", () => `<style>\n${css}\n</style>`).replace("<!--JS-->", () => `<script>\n${codigo}\n</script>`);
const destino = path.join(AQUI, "kuntur.html");
fs.writeFileSync(destino, html);
const propio = Object.entries(r.metafile.inputs).filter(([f]) => !f.includes("node_modules")).reduce((s, [, v]) => s + v.bytes, 0);
console.log(`kuntur/kuntur.html: ${(fs.statSync(destino).size / 1024).toFixed(0)} KB · código propio ${(propio / 1024).toFixed(0)} KB${dev ? " · sin minificar" : ""}`);
