// El resto: el bosque (zombis, el demonio que aparece y te mata al verlo), la casa de muñecas,
// el final y la vuelta al menú; y morir en la casa (moverse cuando no hay que moverse).
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
p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
let mal = 0;
const ok = (c, m) => { console.log((c ? '  ok  ' : '  MAL ') + m); if (!c) mal++; };
await p.addInitScript(() => localStorage.setItem('pizza.v1', JSON.stringify({ idioma: 'es' })));
await p.goto(`http://127.0.0.1:${PUERTO}/index.html`);
await p.waitForFunction(() => window.__pizza?.listo, null, { timeout: 120000 });
const foto = async (n) => { await p.evaluate(() => __pizza.dibujar()); await p.screenshot({ path: path.join(AQUI, 'salida', n + '.jpg'), type: 'jpeg', quality: 50 }); };
await p.evaluate(() => {
  const J = __pizza.J; __pizza.congelar = 'todo';
  const V = { x: 0, y: 0, mx: 0, my: 0, toque: false, pausa: false };
  window.paso = async (seg, inp = {}) => { const n = Math.round(seg * 20); for (let k = 0; k < n && !J.cargando; k++) { J.update(0.05, { ...V, ...inp }, { sens: 1 }); await null; await null; if (k % 40 === 39) await new Promise((r) => setTimeout(r, 0)); } };
  window.esperarNivel = async (n, max = 60) => { for (let k = 0; k < max * 10 && (J.nivel !== n || J.cargando); k++) await new Promise((r) => setTimeout(r, 100)); return J.nivel; };
});
// 1) morir en la casa: moverse con dontMoveKill prendido
await p.evaluate(async () => { await __pizza.J.cargarNivel('NewScene1'); await paso(0.2, { toque: true }); __pizza.J.noTeMuevas(true); await paso(0.5, { y: 1 }); });
let r = await p.evaluate(() => ({ dead: __pizza.G.isDead, sepia: __pizza.J.efectos.sepia }));
ok(r.dead && r.sepia, `moverse cuando no hay que moverse: muerte con sepia (${JSON.stringify(r)})`);
await foto('m-muerte');
await p.evaluate(async () => { await paso(5.5); });
ok(await p.evaluate(() => esperarNivel('Menu')) === 'Menu', 'después de 5 s, al menú');
// 2) el bosque
await p.evaluate(async () => { await __pizza.J.cargarNivel('Scene2'); await paso(0.2, { toque: true }); await paso(4); });
r = await p.evaluate(() => document.querySelector('#subtitulo').textContent);
ok(/PORCIONES/.test(r), `"SEGUÍ LAS PORCIONES..." (${r})`);
await foto('m-bosque');
r = await p.evaluate(async () => {
  const J = __pizza.J, S = J.S;
  const d = S.disparadores.find((x) => S.N[x.i].n === 'zombiesTrigger');
  const c = S.O[d.i].getWorldPosition(J.camara.position.clone());
  J.jug.o.position.copy(c); J.dentro.clear(); await paso(0.3);
  const dem = S.conTag('FinalDemon'); const zom = S.N.findIndex((n) => n.n === 'zombies');
  return { demonios: dem.length, zombis: S.activo[zom] };
});
ok(r.demonios > 0 && r.zombis, `el disparador: zombis y el demonio (${JSON.stringify(r)})`);
r = await p.evaluate(async () => {
  const J = __pizza.J, S = J.S, k = S.conTag('FinalDemon')[0];
  const t = S.O[k].getWorldPosition(J.camara.position.clone());
  // ponerse a 4 m del demonio mirándolo: entra en el visor
  const dir = J.jug.o.position.clone().sub(t).setY(0).normalize();
  J.jug.o.position.copy(t).addScaledVector(dir, 4); J.jug.o.position.y = t.y + 1;
  J.jug.yaw = Math.atan2(dir.x, dir.z); J.jug.pitch = 0;
  await paso(0.5);
  const visto = J.objetivoMirar != null;
  await paso(3.5);
  return { visto, dead: __pizza.G.isDead };
});
ok(r.visto && r.dead, `ver al demonio: ruge y te mata (${JSON.stringify(r)})`);
await foto('m-demonio');
await p.evaluate(async () => { await paso(5.5); });
ok(await p.evaluate(() => esperarNivel('DollHouse')) === 'DollHouse', 'de ahí a la casa de muñecas');
await p.evaluate(async () => { await paso(1); }); await foto('m-munecas');
await p.evaluate(async () => { await paso(10.5); });
ok(await p.evaluate(() => esperarNivel('end')) === 'end', 'a los 10 s, el final');
await p.evaluate(async () => { await paso(6); }); await foto('m-final');
r = await p.evaluate(() => __pizza.J.subtitulo);
await p.evaluate(async () => { await paso(11); });
ok(await p.evaluate(() => esperarNivel('Menu')) === 'Menu', 'y vuelve al menú');
ok(errores.length === 0, 'sin errores' + (errores.length ? ': ' + [...new Set(errores)].slice(0, 3).join(' | ') : ''));
console.log(mal ? `${mal} cosas para arreglar` : 'Todo bien');
await b.close(); srv.kill();
