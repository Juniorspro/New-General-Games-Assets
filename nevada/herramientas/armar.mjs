// Arma NEVADA: dist/ (index.html + juego.js + datos/) y nevada-en-un-archivo.html,
// que abre con doble clic sin internet (todo adentro como data: URI).
//
//     node herramientas/armar.mjs
//
// La carpeta de los assets se llama datos/ y no assets/: Rezona reserva ese
// nombre al subir un proyecto y lo saltea sin avisar (lección del bosque).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(AQUI, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'datos'), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(AQUI, 'js/main.js')], bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: path.join(DIST, 'juego.js'), legalComments: 'none',
});
let html = fs.readFileSync(path.join(AQUI, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(AQUI, 'css/nevada.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/nevada.css">', `<style>\n${css}\n</style>`);
fs.writeFileSync(path.join(DIST, 'index.html'), html);

const TIPOS = { '.webp': 'image/webp', '.glb': 'model/gltf-binary' };
const archivos = {};
let bytes = 0;
for (const f of fs.readdirSync(path.join(AQUI, 'assets')).sort()) {
  const tipo = TIPOS[path.extname(f)];
  if (!tipo) continue;
  fs.copyFileSync(path.join(AQUI, 'assets', f), path.join(DIST, 'datos', f));
  bytes += fs.statSync(path.join(AQUI, 'assets', f)).size;
  archivos[f] = `data:${tipo};base64,` + fs.readFileSync(path.join(AQUI, 'assets', f)).toString('base64');
}
const js = fs.statSync(path.join(DIST, 'juego.js')).size;
console.log(`dist/juego.js ${(js / 1024).toFixed(0)} KB · datos/ ${Object.keys(archivos).length} archivos ${(bytes / 1048576).toFixed(2)} MB`);

// un "</script" adentro del código cerraría la etiqueta a mitad del archivo
const codigo = fs.readFileSync(path.join(DIST, 'juego.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
// OJO: el reemplazo va con una función. Con un texto, replace() interpreta los
// $&, $` y $' que aparecen en el código minificado y mete pedazos del HTML
// adentro del JS (el archivo único salía roto sin ningún error al armarlo).
const unico = html.replace('<script src="juego.js"></script>', () => `<script>window.ARCHIVOS=${JSON.stringify(archivos)};</script>\n<script>\n${codigo}\n</script>`);
if (unico === html) throw new Error('no encontré <script src="juego.js"> en index.html');
if (unico.includes('src="juego.js"') || !unico.includes(codigo)) throw new Error('el código no quedó entero adentro del HTML');
const dest = path.join(AQUI, 'nevada-en-un-archivo.html');
fs.writeFileSync(dest, unico);
console.log(`nevada-en-un-archivo.html ${(fs.statSync(dest).size / 1048576).toFixed(2)} MB`);
