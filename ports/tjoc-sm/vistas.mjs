// Fotos del visor: VISTAS='[["nombre",[x,y,z],[dx,dy,dz]],...]' N=SM_LivingRoom node vistas.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const RAIZ = process.env.RAIZ || path.join(AQUI, 'dist');
const PUERTO = 18000 + Math.floor(Math.random() * 2000);
fs.mkdirSync(path.join(AQUI, 'pruebas/salida'), { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errores = [];
p.on('response', (r) => { if (r.status() >= 400) errores.push('HTTP ' + r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
p.on('pageerror', (e) => errores.push((e.stack || e.message).slice(0, 600)));
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/favicon|404/.test(m.text())) errores.push(m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.1:${PUERTO}/ver.html?n=${process.env.N || 'SM_LivingRoom'}&${process.env.Q || ''}`);
await p.waitForFunction(() => window.__ver?.listo, null, { timeout: 180000 });
await p.waitForTimeout(1500);
const vistas = JSON.parse(process.env.VISTAS || '[["inicio",null,null]]');
for (const [nombre, pos, dir] of vistas) {
  if (pos) await p.evaluate(([a, d]) => __ver.mirar(a, d), [pos, dir]);
  else await p.evaluate(() => __ver.dibujar());
  await p.screenshot({ path: path.join(AQUI, 'pruebas/salida', nombre + '.jpg'), type: 'jpeg', quality: 60 });
  console.log(nombre, JSON.stringify(await p.evaluate(() => ({ ...__ver.info(), cam: __ver.cam.position.toArray().map((x) => +x.toFixed(2)) }))));
}
if (process.env.EVAL) console.log(JSON.stringify(await p.evaluate(process.env.EVAL)));
console.log(errores.length ? 'ERRORES: ' + [...new Set(errores)].slice(0, 6).join(' | ') : 'sin errores');
await b.close(); srv.kill();
