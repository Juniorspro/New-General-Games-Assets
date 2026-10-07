// La intro de JXStudios en tres momentos (sin saltearla) y qué pide la página que no existe.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PUERTO = 9100 + Math.floor(Math.random() * 800);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
p.on('response', (r) => { if (r.status() >= 400) console.log('falta:', r.url()); });
await p.goto(process.env.ARCHIVO ? 'file://' + path.join(AQUI, 'salida/fnaf2.html') : `http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForSelector('#intro:not([hidden])', { timeout: 120000 });
for (const [k, ms] of [[1, 900], [2, 1700], [3, 1300]]) { await p.waitForTimeout(ms); await p.screenshot({ path: path.join(AQUI, `pruebas/salida/intro${k}.jpg`), type: 'jpeg', quality: 55 }); }
await p.waitForFunction(() => window.__fnaf2?.M?.F, null, { timeout: 60000 });
console.log('juego arrancó en el frame', await p.evaluate(() => window.__fnaf2.M.F.idx));
await b.close(); srv.kill();
