// Fotos de cada escena desde el jugador (o su cámara): la casa por dentro con luz, el bosque, la casa de muñecas y el final.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const AQUI = path.dirname(new URL(import.meta.url).pathname);
(await import('node:fs')).mkdirSync(path.join(AQUI, 'salida'), { recursive: true });
const PUERTO = 18000 + Math.floor(Math.random() * 2000);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, '../dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 1 });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)); });
await p.addInitScript(() => localStorage.setItem('pizza.v1', JSON.stringify({ idioma: 'es' })));
await p.goto(`http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForFunction(() => window.__pizza?.listo, null, { timeout: 120000 });
const foto = async (n) => { await p.evaluate(() => __pizza.dibujar()); await p.screenshot({ path: path.join(AQUI, 'salida', n + '.jpg'), type: 'jpeg', quality: 50 }); };
const pasos = JSON.parse(process.env.PASOS || '[]');
for (const [nivel, codigo, nombre] of pasos) {
  await p.evaluate(async (nv) => { __pizza.congelar = 'todo'; await __pizza.J.cargarNivel(nv); }, nivel);
  const info = await p.evaluate(async (c) => { const J = __pizza.J; const V = { x: 0, y: 0, mx: 0, my: 0 }; for (let k = 0; k < 5; k++) { J.update(0.05, { ...V, toque: k === 0 }, { sens: 1 }); await null; } const r = c ? await eval(c) : null; for (let k = 0; k < 3; k++) { J.update(0.05, V, { sens: 1 }); await null; } const ri = __pizza.renderer.info.render; return { r, cam: J.camara.position.toArray().map((x) => +x.toFixed(1)), luces: J.puntos.filter((l) => l.intensity > 0).length + J.focos.filter((l) => l.intensity > 0).length, dir: +J.direccional.intensity.toFixed(2) }; }, codigo);
  await foto(nombre);
  console.log(nombre, JSON.stringify(info), JSON.stringify(await p.evaluate(() => ({ llamadas: __pizza.renderer.info.render.calls, tris: __pizza.renderer.info.render.triangles }))));
}
console.log(errores.length ? 'ERRORES: ' + [...new Set(errores)].slice(0, 5).join(' | ') : 'sin errores');
await b.close(); srv.kill();
