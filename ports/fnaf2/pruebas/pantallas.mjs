// Recorre todos los frames: entra a cada uno, corre unos segundos y saca una foto chica; junta errores por frame.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PUERTO = 9100 + Math.floor(Math.random() * 800);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 512, height: 384 }, deviceScaleFactor: 1 });
let err = []; p.on('pageerror', (e) => err.push(e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) err.push(m.text().slice(0, 160)); });
await p.addInitScript(() => localStorage.setItem('fnaf2.v1', JSON.stringify({ idioma: 'es' })));
await p.goto(`http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForSelector('#intro:not([hidden])', { timeout: 120000 }); await p.waitForTimeout(500);
await p.click('#intro').catch(() => {});
await p.waitForFunction(() => window.__fnaf2?.M?.F && !window.__fnaf2.M.cargando, null, { timeout: 60000 });
const n = await p.evaluate(() => window.__fnaf2.J.frames.length);
const desde = +(process.env.DESDE || 0), hasta = +(process.env.HASTA || n - 1);
for (let k = desde; k <= hasta; k++) {
  err = [];
  await p.evaluate((k) => { window.__fnaf2.M.pend = null; window.__fnaf2.M.fundido = null; return window.__fnaf2.M.ir(k); }, k);
  await p.waitForFunction(() => !window.__fnaf2.M.cargando, null, { timeout: 30000 });
  await p.waitForTimeout(+(process.env.MS || 2500));
  await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', `p${String(k).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 45 });
  const r = await p.evaluate(() => { const M = window.__fnaf2.M; return `${M.F.idx} ${M.F.f.nombre} loop ${M.F.loop}`; });
  console.log(`frame ${k} → ${r}${err.length ? '  ERR ' + [...new Set(err)].join(' | ') : ''}`);
}
await b.close(); srv.kill();
