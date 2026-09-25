// EL TECLADO PROPIO (teclado.js), en un celu acostado y en uno parado (el juego
// se acuesta solo): entra, entra entero en la pantalla, escribe con la primera
// en mayúscula, borra, abre los acentos manteniendo apretado, cambia a
// símbolos y emojis, y ↵ manda el mensaje al chat y se va.
//     node pruebas/teclado.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
for (const [ancho, alto, nombre] of [[844, 390, 'acostado'], [390, 844, 'parado']]) {
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho, alto, movil: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.yo && window.__A.UI.hud, null, { timeout: 120000, polling: 250 });
  await avanzar(pag, 5);
  await pag.evaluate(() => window.__A.UI.abrirChat());
  await esperar(450);
  /* tocar una tecla como un dedo: apretar y soltar sobre el botón */
  const tocar = async (k, ms = 40) => {
    const b = await pag.$(`.tecla-aero[data-k="${k}"]`); if (!b) return false;
    const r = await b.boundingBox(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await pag.evaluate(([x, y, ms]) => new Promise((ok) => { const el = document.elementFromPoint(x, y)?.closest('.tecla-aero'); const ev = (t) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true })); ev('pointerdown'); setTimeout(() => { ev('pointerup'); ok(); }, ms); }), [x, y, ms]);
    return true;
  };
  const valor = () => pag.evaluate(() => document.querySelector('.chat-entrada input')?.value ?? null);
  let r = await pag.evaluate(() => { const T = document.querySelector('.teclado-aero'); if (!T) return null; const R = T.getBoundingClientRect(), V = { w: innerWidth, h: innerHeight }; const teclas = [...T.querySelectorAll('.tecla-aero')]; const fuera = teclas.filter((b) => { const q = b.getBoundingClientRect(); return q.left < R.left - 1 || q.right > R.right + 1 || q.top < R.top - 1 || q.bottom > R.bottom + 1 || q.width < 20 || q.height < 20; }).length; return { dentro: T.classList.contains('dentro'), teclas: teclas.length, fuera, sistema: document.querySelector('.chat-entrada input').readOnly, R: [Math.round(R.left), Math.round(R.top), Math.round(R.width), Math.round(R.height)], V }; });
  prueba(`${nombre}: entra el teclado propio, con todas las teclas enteras`, r && r.dentro && r.teclas >= 40 && r.fuera === 0 && r.sistema, JSON.stringify(r));
  await pag.screenshot({ path: path.join(SAL, `teclado-${nombre}.png`) });
  for (const k of ['h', 'o', 'l', 'a']) await tocar(k);
  prueba(`${nombre}: escribe y la primera va en mayúscula`, (await valor()) === 'Hola', await valor());
  await tocar('⌫');
  prueba(`${nombre}: ⌫ borra`, (await valor()) === 'Hol', await valor());
  await tocar('a', 700);
  prueba(`${nombre}: manteniendo la a sale la á`, (await valor()) === 'Holá', await valor());
  await tocar(' '); await tocar('?123'); await tocar('!');
  await tocar('😊'); await tocar('🫧');
  prueba(`${nombre}: símbolos y emojis`, (await valor()) === 'Holá !🫧', await valor());
  await tocar('↵'); await esperar(400);
  r = await pag.evaluate(() => ({ teclado: !!document.querySelector('.teclado-aero.dentro'), entrada: !!document.querySelector('.chat-entrada'), linea: [...document.querySelectorAll('.chat .linea, .chat > *')].map((e) => e.textContent).join(' | ') }));
  prueba(`${nombre}: ↵ manda al chat y el teclado se va`, !r.teclado && !r.entrada && r.linea.includes('Holá !🫧'), r.linea.slice(-80));
  const e = errores.filter((x) => !x.includes('ERR_FAILED'));
  if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); }
  await ctx.close();
}
await nav.close();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
