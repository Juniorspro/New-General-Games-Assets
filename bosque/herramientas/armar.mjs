// Arma dist/: el juego listo para subir a cualquier lado.
//
//     node herramientas/armar.mjs
//
// dist/index.html + dist/juego.js (todo el código y three en un archivo) +
// dist/datos/ (texturas y modelos).
//
// LA CARPETA DE LOS ASSETS SE LLAMA datos/ Y NO assets/: Rezona reserva ese
// nombre al subir un proyecto y lo saltea sin avisar. El juego subía, abría,
// y se quedaba en "rebobinando" para siempre porque no encontraba ni una
// textura.
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(AQUI, "dist");
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "datos"), { recursive: true });

const r = await esbuild.build({
  entryPoints: [path.join(AQUI, "js/main.js")],
  bundle: true, minify: true, format: "iife", target: "es2020",
  outfile: path.join(DIST, "juego.js"), metafile: true, legalComments: "none",
});

let html = fs.readFileSync(path.join(AQUI, "index.html"), "utf8");
const css = fs.readFileSync(path.join(AQUI, "css/bosque.css"), "utf8");
html = html.replace('<link rel="stylesheet" href="css/bosque.css">', `<style>\n${css}\n</style>`);
fs.writeFileSync(path.join(DIST, "index.html"), html);

let bytes = 0, n = 0;
for (const f of fs.readdirSync(path.join(AQUI, "assets"))) {
  if (!/\.(webp|glb|json)$/.test(f)) continue;
  fs.copyFileSync(path.join(AQUI, "assets", f), path.join(DIST, "datos", f));
  bytes += fs.statSync(path.join(DIST, "datos", f)).size; n++;
}
const js = fs.statSync(path.join(DIST, "juego.js")).size;
console.log(`dist/juego.js ${(js / 1024).toFixed(0)} KB · datos/ ${n} archivos ${(bytes / 1048576).toFixed(2)} MB · total ${((bytes + js) / 1048576).toFixed(2)} MB`);
