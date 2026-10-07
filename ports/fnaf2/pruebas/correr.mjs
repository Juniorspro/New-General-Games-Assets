// Prueba con el navegador: abre dist/ (o el HTML único con ARCHIVO=1), elige idioma y sigue PASOS.
//   FRAME=3 SEG=6 FOTOS=3 PASOS='[[t,"clic",x,y],[t,"tecla",17,ms],[t,"eval","código"]]' node pruebas/correr.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PUERTO = 9100 + Math.floor(Math.random() * 800);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const W = +(process.env.W || 800), H = +(process.env.H || 600);
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const err = [];
p.on('pageerror', (e) => err.push('PAGEERROR ' + (e.stack || e.message).slice(0, 400)));
p.on('response', (r) => { if (r.status() >= 400) err.push('falta ' + r.url().split('/').slice(-2).join('/')); });
p.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) err.push(m.text().slice(0, 300)); });
await p.addInitScript((i) => localStorage.setItem('fnaf2.v1', JSON.stringify({ idioma: i })), process.env.IDIOMA || 'es');
await p.goto(process.env.ARCHIVO ? 'file://' + path.join(AQUI, 'salida/fnaf2.html') : `http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForSelector('#intro:not([hidden])', { timeout: 120000 }); await p.waitForTimeout(500);
await p.click('#intro').catch(() => {});
await p.waitForFunction(() => window.__fnaf2?.M?.F && !window.__fnaf2.M.cargando, null, { timeout: 60000 });
if (process.env.FRAME) await p.evaluate((n) => window.__fnaf2.M.ir(n), +process.env.FRAME), await p.waitForFunction(() => !window.__fnaf2.M.cargando);
const pasos = JSON.parse(process.env.PASOS || '[]');
const seg = +(process.env.SEG || 5), fotos = +(process.env.FOTOS || 2);
const t0 = Date.now(); let k = 0, f = 0;
const info = () => p.evaluate(() => { const M = window.__fnaf2.M; return `frame ${M.F.idx} ${M.F.f.nombre} loop ${M.F.loop} cam ${M.F.camX}`; });
while (Date.now() - t0 < seg * 1000) {
  const t = (Date.now() - t0) / 1000;
  while (k < pasos.length && pasos[k][0] <= t) {
    const [, q, a, b2, c] = pasos[k++];
    const box = await p.$eval('#juego', (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width / 1024, r.height / 768]; });
    if (q === 'clic') { await p.mouse.move(box[0] + a * box[2], box[1] + b2 * box[3]); await p.mouse.down(); await p.waitForTimeout(80); await p.mouse.up(); }
    if (q === 'mover') await p.mouse.move(box[0] + a * box[2], box[1] + b2 * box[3]);
    if (q === 'tecla') { await p.evaluate(([v, ms]) => { window.__fnaf2.M.tecla(v, true); setTimeout(() => window.__fnaf2.M.tecla(v, false), ms || 100); }, [a, b2]); }
    if (q === 'eval') console.log('eval:', JSON.stringify(await p.evaluate(a)).slice(0, 600));
  }
  if (f < fotos && t >= (f + 1) * seg / (fotos + 1)) { f++; await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', `f${f}.jpg`), type: 'jpeg', quality: 50 }); console.log(`foto ${f} (${t.toFixed(1)}s):`, await info()); }
  await p.waitForTimeout(100);
}
console.log('final:', await info());
console.log(err.length ? 'ERRORES:\n  ' + [...new Set(err)].slice(0, 10).join('\n  ') : 'sin errores');
await b.close(); srv.kill();
