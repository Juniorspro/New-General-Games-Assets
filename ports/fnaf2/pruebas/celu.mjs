// Celu acostado (844×390, táctil): noche 1 con toques como en FNaF 2 para móvil: dedo en el medio = linterna,
// tocar la barra de abajo a la derecha = cámaras, tocar una cámara, y bordes para mirar.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PUERTO = 9100 + Math.floor(Math.random() * 800);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const W = +(process.env.W || 844), H = +(process.env.H || 390);
const ctx = await b.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 200)));
await p.addInitScript(() => localStorage.setItem('fnaf2.v1', JSON.stringify({ idioma: 'es' })));
await p.goto(process.env.ARCHIVO ? 'file://' + path.join(AQUI, 'salida/fnaf2.html') : `http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForSelector('#intro:not([hidden])', { timeout: 120000 }); await p.waitForTimeout(500);
await p.tap('#intro').catch(() => {});
await p.waitForFunction(() => window.__fnaf2?.M?.F && !window.__fnaf2.M.cargando, null, { timeout: 60000 });
await p.evaluate(() => window.__fnaf2.M.ir(3)); await p.waitForFunction(() => !window.__fnaf2.M.cargando); await p.waitForTimeout(1500);
const toque = (tipo, lx, ly, id = 7) => p.evaluate(([tipo, lx, ly, id]) => {
  const c = document.getElementById('juego'), r = c.getBoundingClientRect();
  const girado = document.body.classList.contains('girado');
  let x = r.left + (lx / 1024) * r.width, y = r.top + (ly / 768) * r.height;
  if (girado) { x = r.right - (ly / 768) * r.width; y = r.top + (lx / 1024) * r.height; }
  c.dispatchEvent(new PointerEvent(tipo, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: tipo === 'pointerup' ? 0 : 1, bubbles: true }));
}, [tipo, lx, ly, id]);
const estado = () => p.evaluate(() => { const M = window.__fnaf2.M; const v = (n) => M.F.inst.find((i) => i.o.n === n)?.valor; const fp = M.F.inst.find((i) => i.o.n === 'flip panel button'); const wb = M.F.inst.find((i) => i.o.n === 'white button'); return { ctrl: M.teclas.has(17), lit: v('lit?'), viewing: v('viewing'), camX: M.F.camX, fp: fp?.alt.slice(0, 2), wb: wb && M.caja(wb), anim: M.F.inst.filter((i) => i.o.n === 'flip animation').map((i) => [i.anim, i.cuadro, i.animFin]) }; });
const foto = (n) => p.screenshot({ path: path.join(AQUI, 'pruebas/salida', 'celu-' + n + '.jpg'), type: 'jpeg', quality: 50 });
await toque('pointerdown', 512, 330); await p.waitForTimeout(600);
console.log('dedo en el medio:', JSON.stringify(await estado())); await foto(1);
await toque('pointerup', 512, 330); await p.waitForTimeout(300);
console.log('soltó:', JSON.stringify(await estado()));
await toque('pointerdown', 960, 400); await p.waitForTimeout(1200);
console.log('borde derecho:', JSON.stringify(await estado()));
await toque('pointerup', 960, 400); await p.waitForTimeout(200);
await toque('pointerdown', 750, 735); await p.waitForTimeout(150); console.log('sobre la barra:', JSON.stringify(await estado())); await toque('pointerup', 750, 735); await p.waitForTimeout(2500);
console.log('barra de cámaras:', JSON.stringify(await estado())); await foto(2);
await toque('pointerdown', 734, 558); await p.waitForTimeout(150); await toque('pointerup', 734, 558); await p.waitForTimeout(800);
console.log('tocó cam 2:', JSON.stringify(await estado())); await foto(3);
console.log(err.length ? 'ERRORES ' + err.join(' / ') : 'sin errores');
await b.close(); srv.kill();
