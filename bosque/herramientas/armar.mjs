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

// ── el juego entero en UN archivo HTML, para abrir con doble clic ─────────
// Las texturas y los modelos entran como data: URI en window.ARCHIVOS y los
// datos como objeto en window.DATOS (cargador.js los busca ahí primero). El
// base64 engorda un tercio: 8,6 MB de datos se vuelven ~11,4 MB.
const TIPOS = { ".webp": "image/webp", ".glb": "model/gltf-binary" };
const archivos = {};
for (const f of fs.readdirSync(path.join(DIST, "datos")).sort()) {
  const tipo = TIPOS[path.extname(f)];
  if (!tipo) continue;
  archivos[f] = `data:${tipo};base64,` + fs.readFileSync(path.join(DIST, "datos", f)).toString("base64");
}
const datos = fs.readFileSync(path.join(DIST, "datos", "datos.json"), "utf8");
let codigo = fs.readFileSync(path.join(DIST, "juego.js"), "utf8");
// un "</script" adentro del código cerraría la etiqueta a mitad del archivo y
// el navegador cortaría el juego ahí, sin ningún error que lo diga
codigo = codigo.replace(/<\/script/gi, "<\\/script");
const unico = html.replace('<script src="juego.js"></script>',
  `<script>window.ARCHIVOS=${JSON.stringify(archivos)};window.DATOS=${datos.trim()};</script>\n<script>\n${codigo}\n</script>`);
if (unico === html) throw new Error("no encontré <script src=\"juego.js\"> en index.html");
const destinoUnico = path.join(AQUI, "bosque-en-un-archivo.html");
fs.writeFileSync(destinoUnico, unico);
console.log(`bosque-en-un-archivo.html ${(fs.statSync(destinoUnico).size / 1048576).toFixed(2)} MB · ${Object.keys(archivos).length} archivos adentro`);

// ── la misma página para publicar como artefacto de claude.ai ────────────
// El artefacto pone él mismo <!doctype>, <html>, <head> con charset y
// viewport, y <body>: la página va sin esas etiquetas, con el <title> arriba
// de todo (solo se lee en los primeros 8 KB).
const cuerpo = unico
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<html[^>]*>\s*/i, "").replace(/<\/html>\s*$/i, "")
  .replace(/<head>\s*/i, "").replace(/<\/head>\s*/i, "")
  .replace(/<body>\s*/i, "").replace(/<\/body>\s*/i, "")
  .replace(/<meta charset="utf-8">\s*/i, "").replace(/<meta name="viewport"[^>]*>\s*/i, "");
const titulo = cuerpo.match(/<title>[^<]*<\/title>\s*/)[0];
const artefacto = titulo + cuerpo.replace(titulo, "");
fs.writeFileSync(path.join(DIST, "bosque-artefacto.html"), artefacto);
console.log(`dist/bosque-artefacto.html ${(Buffer.byteLength(artefacto) / 1048576).toFixed(2)} MB`);
