// Arma contragolpe.html, el juego en un solo archivo (abre con doble clic), desde fuente/ y assets/:
// - fuente/pagina.html es la página con los <script src="js/…"> que se meten adentro, en orden;
// - <script src="assets"> es window.ARCH (cada archivo de assets/ en data: base64, en el orden de
//   fuente/assets.json) y window.MAN (js/man.js), como venía el original.
// Con --apk arma la de la APK: los assets quedan como archivos al lado (ARCH tiene su ruta, a/…) y las
// texturas que haya en .cache/etc2 (herramientas/etc2.py) van en ETC2 (window.ARCH_ETC2). El HTML pasa
// de 18 MB a 1,3: el teléfono no tiene que leer ni guardar en memoria los 17 MB de base64.
//     node herramientas/armar.mjs [--salida=archivo.html] [--apk]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || d;
export const EXT = { 'image/webp': 'webp', 'audio/mpeg': 'mp3' };
export const ETC2_DIR = join(RAIZ, '.cache/etc2');

/* apk: false (todo adentro) o {prefijo:'a/'}: devuelve el HTML y, con apk, la lista de archivos [ruta en la APK, origen] */
export function armar({ apk = null } = {}) {
  const idx = JSON.parse(readFileSync(join(RAIZ, 'fuente/assets.json'), 'utf8')), archivos = [];
  let arch, etc2 = '';
  if (!apk) arch = idx.orden.map(([k, t]) => `"${k}":"data:${t};base64,${readFileSync(join(RAIZ, 'assets', `${k}.${EXT[t]}`)).toString('base64')}"`);
  else {
    const P = apk.prefijo || 'a/', E = {};
    arch = idx.orden.map(([k, t]) => { const f = `${k}.${EXT[t]}`, e = join(ETC2_DIR, `${k}.etc2`);
      if (existsSync(e)) { E[k] = `${P}etc2/${k}.etc2`; archivos.push([`${P}etc2/${k}.etc2`, e]); if (apk.webp) archivos.push([P + f, join(RAIZ, 'assets', f)]); }
      else archivos.push([P + f, join(RAIZ, 'assets', f)]);
      return `"${k}":"${P}${f}"`; });
    etc2 = `window.ARCH_ETC2=${JSON.stringify(E)};\n`;
  }
  const assets = `${idx.comentario}\nwindow.ARCH={${arch.join(',')}};\n${etc2}${readFileSync(join(RAIZ, 'fuente/js/man.js'), 'utf8')}\n`;
  /* (con una función: el código tiene "$&" y "$'" que replace tomaría como patrones) */
  const html = readFileSync(join(RAIZ, 'fuente/pagina.html'), 'utf8').replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
    `<script>${src === 'assets' ? assets : readFileSync(join(RAIZ, 'fuente', src), 'utf8')}</script>`);
  return { html, archivos };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const apk = process.argv.includes('--apk');
  const { html, archivos } = armar({ apk: apk ? { webp: process.argv.includes('--webp') } : null });
  const salida = arg('salida', join(RAIZ, apk ? 'contragolpe-apk.html' : 'contragolpe.html'));
  writeFileSync(salida, html);
  console.log(`${salida}: ${(html.length / 1e6).toFixed(1)} MB${apk ? ` + ${archivos.length} archivos` : ''}`);
}
