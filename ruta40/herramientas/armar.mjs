// Arma RUTA 40 en un solo HTML que abre con doble clic y anda sin internet.
//
//     node ruta40/herramientas/armar.mjs [--dev]
//
// Usa el esbuild de node_modules (el de esta carpeta, el de la raíz o, en el
// repo, el de bosque/). El arte de ruta40/arte/ entra como data: URI por el
// módulo virtual "arte:todo" (así nadie tiene que listar las 63 imágenes a
// mano), y la letra Overpass entra adentro del CSS.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAIZ = path.resolve(AQUI, "..");
const MODULOS = [path.join(AQUI, "node_modules"), path.join(RAIZ, "node_modules"), path.join(RAIZ, "bosque/node_modules")].find((d) => fs.existsSync(path.join(d, "esbuild")));
if (!MODULOS) { console.error("Falta esbuild: corré npm install en la carpeta de arriba (ver LEEME.md)."); process.exit(1); }
const require = createRequire(path.join(MODULOS, "x.js"));
const esbuild = require("esbuild");
const dev = process.argv.includes("--dev");
const ARTE = path.join(AQUI, "arte");
const tipo = { ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2" };
const dataUri = (f) => `data:${tipo[path.extname(f)]};base64,${fs.readFileSync(f).toString("base64")}`;

const arte = {
  name: "arte",
  setup(b) {
    b.onResolve({ filter: /^arte:todo$/ }, () => ({ path: "arte:todo", namespace: "arte" }));
    b.onLoad({ filter: /.*/, namespace: "arte" }, () => {
      const datos = {};
      for (const f of fs.readdirSync(ARTE).sort()) if (f.endsWith(".webp")) datos[f.replace(/\.webp$/, "")] = dataUri(path.join(ARTE, f));
      return { contents: "export default " + JSON.stringify(datos) + ";", loader: "js" };
    });
  },
};
const r = await esbuild.build({
  entryPoints: [path.join(AQUI, "js/main.js")],
  bundle: true, minify: !dev, format: "iife", target: "es2020", write: false,
  legalComments: "none", metafile: true, plugins: [arte],
});
let codigo = r.outputFiles[0].text;
codigo = codigo.replace(/<\/script/gi, "<\\/script");
let css = fs.readFileSync(path.join(AQUI, "ruta40.css"), "utf8");
css = css.replace("url(arte/overpass.woff2)", `url(${dataUri(path.join(ARTE, "overpass.woff2"))})`);
let html = fs.readFileSync(path.join(AQUI, "index.html"), "utf8");
html = html.replace("<!--CSS-->", () => `<style>\n${css}\n</style>`).replace("<!--JS-->", () => `<script>\n${codigo}\n</script>`);
const destino = path.join(AQUI, "ruta40.html");
fs.writeFileSync(destino, html);
const propio = Object.entries(r.metafile.inputs).filter(([k]) => !k.startsWith("arte:")).reduce((s, [, v]) => s + v.bytes, 0);
console.log(`ruta40/ruta40.html: ${(fs.statSync(destino).size / 1024 / 1024).toFixed(2)} MB · código ${(propio / 1024).toFixed(0)} KB${dev ? " · sin minificar" : ""}`);
