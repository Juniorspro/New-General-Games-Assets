/* Recorrido con un bot inmortal: limpia salas, elige la primera carta, descansa en el fogón y va a la puerta
   por la grilla. Dice en qué segundo entra a cada sala y saca capturas de las cartas, el fogón, 1-2 y 1-5. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
// las capturas van a una carpeta afuera del repo (nunca al repo): node salamanca/pruebas/recorrido.mjs /tmp/sal/
import fs from 'node:fs';
const D = process.argv[2] || '/tmp/salamanca-pruebas/';
fs.mkdirSync(D, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 720 } });
const errores = [];
p.on('pageerror', e => errores.push(e.message)); p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
await p.goto(new URL('../salamanca.html', import.meta.url).href);
await p.evaluate(() => localStorage.setItem('salamanca.datos', JSON.stringify({ historia: true })));
await p.reload();
const clicLog = async (x, y) => { const r = await p.evaluate(() => { const c = document.getElementById('lienzo').getBoundingClientRect(); return { l: c.left, t: c.top, s: c.width / 180, h: document.getElementById('lienzo').height }; }); await p.mouse.click(r.l + x * r.s, r.t + y * r.s); return r; };
await p.waitForTimeout(2800);
const r = await clicLog(90, 10); const H = r.h;
await p.waitForTimeout(300); await clicLog(90, H * 0.36 + 35); await p.waitForTimeout(800);
await p.screenshot({ path: D + 'm.png' });
await p.keyboard.press('Enter'); await p.waitForTimeout(800);
await p.evaluate((modo) => {
  const S = window.__salamanca;
  const tecla = (code, abajo) => window.dispatchEvent(new KeyboardEvent(abajo ? 'keydown' : 'keyup', { code }));
  setInterval(() => {
    const J = S.J; if (!J) return;
    J.jug.invul = 1; J.jug.flash = 0;
    const j = J.jug, want = [];
    if (J.limpia && J.tSala > 2) {
      // camino hasta la puerta por la grilla
      const M = J.mapa, C = 15, F = 23, ini = Math.floor(j.y / 12) * C + Math.floor(j.x / 12), meta = 1 * C + 7;
      const prev = new Map([[meta, -1]]), cola = [meta];
      for (let i = 0; i < cola.length; i++) { const k = cola[i], c = k % C, f = (k / C) | 0; for (const [dc, df] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nk = (f + df) * C + c + dc; const v = M[nk]; if (prev.has(nk) || v === 1 || v === 2 || v === 3 || v === undefined) continue; prev.set(nk, k); cola.push(nk); } }
      const sig = prev.get(ini);
      const tx = sig >= 0 ? (sig % C) * 12 + 6 : 90, ty = sig >= 0 ? ((sig / C) | 0) * 12 + 6 : 0;
      if (tx < j.x - 2) want.push('KeyA'); if (tx > j.x + 2) want.push('KeyD'); if (ty < j.y - 2) want.push('KeyW'); if (ty > j.y + 2) want.push('KeyS');
    }
    else if (J.enem.length && (J.tSala % 2.4) > 1.9) { const e = J.enem[0]; if (e.x < j.x - 4) want.push('KeyA'); if (e.x > j.x + 4) want.push('KeyD'); if (e.y < j.y - 30) want.push('KeyW'); if (e.y > j.y) want.push('KeyS'); }
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) tecla(k, want.includes(k));
    if (S.escena === 'cartas' || S.escena === 'fogon') { setTimeout(() => { tecla('Digit1', true); setTimeout(() => tecla('Digit1', false), 30); }, 700); }
  }, 100);
});
const vistas = new Set(); const t0 = Date.now();
while (Date.now() - t0 < 70000) {
  const s = await p.evaluate(() => { const S = window.__salamanca, J = S.J; return { e: S.escena, sala: J.piso + '-' + J.sala, n: J.enem.length }; });
  const clave = s.e === 'juego' ? 'juego' + s.sala : s.e;
  if (!vistas.has(clave)) { vistas.add(clave); console.log(((Date.now() - t0) / 1000).toFixed(1), clave, s.n); if (['cartas', 'fogon', 'juego1-2', 'juego1-5'].includes(clave)) { await p.waitForTimeout(clave === 'cartas' ? 600 : 1500); await p.screenshot({ path: D + clave + '.png' }); } }
  if (false) console.log(JSON.stringify(await p.evaluate(() => { const S = window.__salamanca, J = S.J; return { e: S.escena, t: +J.t.toFixed(1), lenta: +J.lenta.toFixed(2), pend: J.pendientes, limpia: J.limpia, en: J.enem.map(e => [e.tipo, e.x | 0, e.y | 0, e.vida | 0, e.est]), j: [J.jug.x | 0, J.jug.y | 0, J.jug.mov] }; })));
  await p.waitForTimeout(200);
}
const info = await p.evaluate(() => { const J = window.__salamanca.J; return { piso: J.piso, sala: J.sala, nivel: J.jug.nivel, cartas: J.jug.cartas, almas: J.almas, kills: J.kills }; });
console.log(JSON.stringify(info), 'errores', errores.slice(0, 5));
await b.close();
