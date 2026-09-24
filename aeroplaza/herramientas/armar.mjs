// Arma AEROPLAZA en un solo HTML que abre con doble clic.
//
//     node herramientas/armar.mjs [--dev]
//
// - El código (three.js incluido) va empaquetado con esbuild en un IIFE.
// - Los assets (assets/*.webp|png|glb) van adentro como data: URI en
//   window.ARCHIVOS: no hace falta servidor.
// - El cliente MQTT NO va adentro: lo carga index.html desde unpkg (así lo pide
//   el multijugador). Sin internet el juego anda igual, solo, sin la red.
// - Las canciones que mandó quien pide (brillo/musica/*.mp3, de Nintendo) no
//   entran al repo, que es público: aeroplaza.html sale sin ellas (música
//   sintetizada) y, si los MP3 están en la máquina, sale además
//   aeroplaza-con-canciones.html, que es el que se entrega.
// - Los temas de los reinos (musica/*.mp3, hechos con Rezona y cosidos con
//   herramientas/musica.py) son originales: van en los dos.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAIZ = path.resolve(AQUI, '..');
const require = createRequire(path.join(RAIZ, 'bosque/node_modules/x.js'));
const esbuild = require('esbuild');
const dev = process.argv.includes('--dev');
const MUSICA = path.join(RAIZ, 'brillo/musica');
/* los temas de los reinos, hechos con Rezona (herramientas/musica.py): son originales, van siempre */
const PROPIA = path.join(AQUI, 'musica');

/* el módulo 'canciones-datos' que lee brillo/js/canciones.js: las grabadas que haya */
function canciones(con) {
  return {
    name: 'canciones',
    setup(b) {
      b.onResolve({ filter: /^canciones-datos$/ }, () => ({ path: 'canciones-datos', namespace: 'canciones' }));
      b.onLoad({ filter: /.*/, namespace: 'canciones' }, () => {
        const de = (dir) => { const l = fs.existsSync(path.join(dir, 'canciones.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'canciones.json'), 'utf8')) : {}; return Object.entries(l).map(([t, c]) => [t, { ...c, f: path.join(dir, c.archivo) }]).filter(([, c]) => fs.existsSync(c.f)); };
        const hay = [...de(PROPIA), ...(con ? de(MUSICA) : [])];
        const imp = hay.map(([, c], i) => `import d${i} from ${JSON.stringify(c.f)};`).join('\n');
        const exp = hay.map(([t, { f, ...c }], i) => `${JSON.stringify(t)}: { ...${JSON.stringify(c)}, datos: d${i} }`).join(',\n');
        return { contents: `${imp}\nexport default {\n${exp}\n};`, resolveDir: MUSICA, loader: 'js' };
      });
    },
  };
}

const TIPOS = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const archivos = {};
let bytesAssets = 0;
for (const f of fs.readdirSync(path.join(AQUI, 'assets')).sort()) {
  const tipo = TIPOS[path.extname(f)];
  if (!tipo) continue;
  const b = fs.readFileSync(path.join(AQUI, 'assets', f));
  bytesAssets += b.length;
  archivos[f] = `data:${tipo};base64,` + b.toString('base64');
}

async function armar(conCanciones, destino) {
  const r = await esbuild.build({
    entryPoints: [path.join(AQUI, 'js/main.js')],
    bundle: true, minify: !dev, format: 'iife', target: 'es2020', write: false, legalComments: 'none', metafile: true,
    loader: { '.mp3': 'binary' }, plugins: [canciones(conCanciones)],
    nodePaths: [path.join(RAIZ, 'bosque/node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  /* un "</script" adentro del código cerraría la etiqueta a mitad del archivo */
  const codigo = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const css = fs.readFileSync(path.join(AQUI, 'css/aeroplaza.css'), 'utf8');
  let html = fs.readFileSync(path.join(AQUI, 'index.html'), 'utf8');
  if (!html.includes('<!--CSS-->') || !html.includes('<!--JS-->')) throw new Error('index.html necesita <!--CSS--> y <!--JS-->');
  /* OJO: con función. Con texto, replace() interpreta los $& del código minificado (NEVADA salía roto) */
  html = html.replace('<!--CSS-->', () => `<style>\n${css}\n</style>`)
    .replace('<!--JS-->', () => `<script>window.ARCHIVOS=${JSON.stringify(archivos)};</script>\n<script>\n${codigo}\n</script>`);
  if (!html.includes(codigo)) throw new Error('el código no quedó entero adentro del HTML');
  fs.writeFileSync(destino, html);
  const mp3 = Object.keys(r.metafile.inputs).filter((f) => f.endsWith('.mp3')).length;
  const propio = Object.entries(r.metafile.inputs).filter(([f]) => !f.includes('node_modules')).reduce((s, [, v]) => s + v.bytes, 0);
  console.log(`${path.relative(RAIZ, destino)}: ${(fs.statSync(destino).size / 1048576).toFixed(2)} MB · código propio ${(propio / 1024).toFixed(0)} KB · assets ${(bytesAssets / 1048576).toFixed(2)} MB · ${mp3} canciones${dev ? ' · sin minificar' : ''}`);
}
await armar(false, path.join(AQUI, 'aeroplaza.html'));
/* la versión para publicar como página (Artifact de claude.ai): la envuelven en su propio
   <html><head><body>, así que se sacan esas etiquetas y las meta (el título queda arriba) */
{
  const h = fs.readFileSync(path.join(AQUI, 'aeroplaza.html'), 'utf8')
    .replace(/<!doctype html>\s*/i, '').replace(/<\/?html[^>]*>\s*/gi, '').replace(/<\/?head>\s*/gi, '').replace(/<\/?body>\s*/gi, '').replace(/<meta [^>]*>\s*/gi, '');
  fs.mkdirSync(path.join(AQUI, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(AQUI, 'dist/aeroplaza-web.html'), h);
  console.log(`aeroplaza/dist/aeroplaza-web.html: ${(h.length / 1048576).toFixed(2)} MB (para publicar; título en el byte ${h.indexOf('<title>')})`);
}
if (fs.existsSync(MUSICA) && fs.readdirSync(MUSICA).some((f) => f.endsWith('.mp3'))) await armar(true, path.join(AQUI, 'aeroplaza-con-canciones.html'));
