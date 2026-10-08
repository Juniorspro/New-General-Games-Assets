// Prueba de idiomas de los juegos de motor2d: por cada idioma abre el juego armado, recorre las
// escenas de escenas.json, junta los errores y los textos que se salen de la pantalla, y saca capturas.
//   node herramientas/idiomas/probar.mjs <juego> <idiomas,separados|todos> [escenas,a,capturar] [carpeta]
//   DPR=3 …   para ver los juegos de píxeles como en un celu (el lienzo va a la resolución real)
// Las letras de prueba (el contenedor no trae birmano, árabe, tailandés ni urdu) van en $FUENTES
// (por defecto /tmp/fuentes-prueba/): las Noto de github.com/google/fonts, carpetas ofl/notosansmyanmar,
// ofl/notonaskharabic, ofl/notosansthai y ofl/notonastaliqurdu, con los nombres de abajo.
// "fuera" marca también los carteles que entran deslizándose desde el borde: mirar la captura.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const [juego, listaIdiomas = 'todos', capturas = '', salida = '/tmp/capturas-idiomas'] = process.argv.slice(2);  // fuera del repo
const TODOS = ['es', 'es-MX', 'en', 'pt', 'ar', 'id', 'ms', 'fil', 'tr', 'ur', 'th', 'my', 'ja'];
const idiomas = listaIdiomas === 'todos' ? TODOS : listaIdiomas.split(',');
const F = (process.env.FUENTES || '/tmp/fuentes-prueba').replace(/\/?$/, '/');
const RAIZ = new URL('../../', import.meta.url).pathname;
const fuentes = { 'Noto Sans Myanmar': 'Myanmar.ttf', 'Noto Naskh Arabic': 'NotoNaskhArabic.ttf', 'Noto Sans Thai': 'NotoSansThai.ttf', 'Noto Nastaliq Urdu': 'NotoNastaliqUrdu.ttf' };
const b64 = Object.fromEntries(Object.entries(fuentes).map(([n, f]) => [n, fs.readFileSync(F + f).toString('base64')]));
fs.mkdirSync(salida, { recursive: true });
const ESC = JSON.parse(fs.readFileSync(new URL('./escenas.json', import.meta.url)))[juego];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const resumen = [];
for (const id of idiomas) {
  const p = await b.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: Number(process.env.DPR || 1) });
  const err = [];
  p.on('pageerror', (e) => err.push('PAGE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
  await p.addInitScript(([fu, j, id]) => {
    for (const [n, s] of Object.entries(fu)) { const bin = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); const f = new FontFace(n, bin.buffer); document.fonts.add(f); f.load(); }
    try { localStorage.setItem(j + '.idioma', JSON.stringify(id)); localStorage.setItem(j + '.datos', JSON.stringify({ ayuda: true })); } catch (e) { /* */ }
    // los textos que se salen de la pantalla (para los juegos de lienzo liso)
    window.__fuera = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, mw) {
      const c = this.canvas;
      if (c && c.id === 'lienzo') {
        const m = this.measureText(t), al = this.textAlign, rtl = this.direction === 'rtl';
        const izq = al === 'center' ? x - m.width / 2 : (al === 'right' || (al === 'end' && !rtl) || (al === 'start' && rtl)) ? x - m.width : x;
        const tr = this.getTransform(), x0 = tr.a * izq + tr.c * y + tr.e, x1 = tr.a * (izq + m.width) + tr.c * y + tr.e;
        if ((x0 < -3 || x1 > c.width + 3) && Math.abs(tr.b) < 0.2 && window.__fuera.length < 60) window.__fuera.push(String(t) + ' [' + Math.round(x0 / tr.a) + '..' + Math.round(x1 / tr.a) + ']');
      }
      return orig.apply(this, arguments);
    };
    // los juegos de píxeles estampan lienzos de texto (marcados con .txt en motor2d/fuente.js)
    const origDI = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      try {
        const c = this.canvas;
        if (img && img.txt && c && c.id === 'lienzo' && (a.length === 2 || a.length === 4)) {
          const dx = a[0], dw = a.length === 4 ? a[2] : img.width, pad = img.sis ? 2 * dw / img.lw : 1.5 * dw / img.width;
          const tr = this.getTransform(), x0 = tr.a * (dx + pad) + tr.e, x1 = tr.a * (dx + dw - pad) + tr.e;
          if ((x0 < -2 * tr.a || x1 > c.width + 2 * tr.a) && Math.abs(tr.b) < 0.2 && window.__fuera.length < 60) window.__fuera.push(img.txt + ' [' + Math.round(x0 / tr.a) + '..' + Math.round(x1 / tr.a) + ']');
        }
      } catch (e) { /* */ }
      return origDI.call(this, img, ...a);
    };
  }, [b64, juego, id]);
  await p.goto(`file://${RAIZ}${juego}/${juego}.html`);
  await p.waitForTimeout(900);
  for (const paso of ESC) {
    if (paso.js) await p.evaluate(paso.js).catch((e) => err.push('PASO ' + paso.nombre + ': ' + e.message));
    await p.waitForTimeout(paso.espera || 700);
    if (capturas.split(',').includes(paso.nombre)) await p.screenshot({ path: `${salida}/${juego}-${paso.nombre}-${id}.png` });
  }
  const fuera = await p.evaluate(() => [...new Set(window.__fuera)]);
  resumen.push(`${id}: errores ${err.length ? err.slice(0, 3).join(' | ') : 0}; fuera ${fuera.length ? fuera.slice(0, 8).join(' · ') : 0}`);
  await p.close();
}
console.log(resumen.join('\n'));
await b.close();
