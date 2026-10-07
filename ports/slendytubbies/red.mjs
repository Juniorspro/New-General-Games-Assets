// Prueba del multijugador con dos navegadores y el broker MQTT de prueba de AEROPLAZA (el contenedor no
// llega al broker público). Cooperativo: sala, se ven, Tinky de cada uno, chat, cartel 1/10 en red.
// Versus: el anfitrión es el Tinky; la víctima que lo mira de cerca queda atrapada y vuelve al menú.
//     node red.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright/')('playwright');
const { broker } = await import('/home/user/New-General-Games-Assets/aeroplaza/pruebas/broker.mjs');
const MQTT = '/home/user/New-General-Games-Assets/aeroplaza/pruebas/mqtt.min.js';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const B = await broker(0);
const PB = B.puerto ?? B.port ?? B.address?.().port;
const PUERTO = 8800 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(PUERTO), '--bind', '127.0.0.1'], { cwd: path.join(AQUI, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 700));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const bien = [], mal = [];
const ok = (c, txt) => (c ? bien : mal).push(txt);
async function pagina(nombre) {
  const ctx = await nav.newContext({ viewport: { width: 480, height: 270 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => mal.push(nombre + ' PAGEERROR ' + e.message.slice(0, 200)));
  await p.route(/mqtt\.min\.js/, (r) => r.fulfill({ body: fs.readFileSync(MQTT), contentType: 'application/javascript' }));
  await p.addInitScript((pb) => { window.SLENDY_BROKER = 'ws://127.0.0.1:' + pb; localStorage.setItem('slendy.v1', JSON.stringify({ idioma: 'es', ajustes: { calidad: 'baja' } })); }, PB);
  await p.goto(`http://127.0.0.1:${PUERTO}/index.html`);
  await p.waitForFunction(() => window.__slendy?.listo, null, { timeout: 120000 });
  await p.click('[data-i="es"]');
  await p.waitForFunction(() => window.__slendy.J?.S && !window.__slendy.J.cargando, null, { timeout: 120000 });
  await p.evaluate(() => { window.__slendy.congelar = 'dibujo'; });
  return p;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const nivel = async (p, n) => { await p.evaluate((x) => window.__slendy.J.cargarNivel(x), n); await p.waitForFunction((x) => window.__slendy.J.nivel === x && !window.__slendy.J.cargando && window.__slendy.J.S, n, { timeout: 120000 }); await esperar(500); };

const A = await pagina('A'), Bp = await pagina('B');
try {
  // --- cooperativo (día)
  await nivel(A, 1); await nivel(Bp, 1);
  await A.click('.unity.red [data-r="host"]');
  await A.waitForFunction(() => /Sala [A-Z]{4}/.test(document.querySelector('.unity.red .estado')?.textContent || '') || window.__slendy.J.red.activa, null, { timeout: 20000 });
  const codigo = await A.evaluate(() => window.__slendy.J.red.codigo);
  ok(/^[A-Z]{4}$/.test(codigo), 'coop: el anfitrión tiene código ' + codigo);
  await Bp.fill('.unity.red input', codigo);
  await Bp.click('.unity.red [data-r="con"]');
  await esperar(4000);
  const vA = await A.evaluate(() => ({ rem: window.__slendy.J.remotos.size, aj: window.__slendy.J.tinkyAjeno.size, jug: !!window.__slendy.J.jug }));
  const vB = await Bp.evaluate(() => ({ rem: window.__slendy.J.remotos.size, aj: window.__slendy.J.tinkyAjeno.size, jug: !!window.__slendy.J.jug }));
  ok(vA.rem === 1 && vB.rem === 1, `coop: cada uno ve al otro (${vA.rem}, ${vB.rem})`);
  ok(vA.aj === 1 && vB.aj === 1, `coop: cada uno ve el Tinky del otro (${vA.aj}, ${vB.aj})`);
  // se mueve A: B lo ve moverse
  const antes = await Bp.evaluate(() => { const J = window.__slendy.J; const b = [...J.remotos][0]; return J.S.O[b].getWorldPosition(J.camara.position.clone()).x; });
  await A.evaluate(() => { window.__slendy.J.jug.o.position.x += 6; });
  await esperar(2500);
  const despues = await Bp.evaluate(() => { const J = window.__slendy.J; const b = [...J.remotos][0]; return J.S.O[b].getWorldPosition(J.camara.position.clone()).x; });
  ok(despues - antes > 4, `coop: B ve moverse a A (${(despues - antes).toFixed(1)} m)`);
  // chat
  await A.evaluate(() => window.__slendy.J.red.chat('hola desde A'));
  await esperar(1500);
  await Bp.evaluate(() => window.__slendy.J.ui.chatBoton(true));
  const chatB = await Bp.evaluate(() => { document.querySelector('.unity.botonchat button')?.click(); return [...document.querySelectorAll('.unity.chat .lineas span')].map((s) => s.textContent); });
  ok(chatB.includes('hola desde A'), 'coop: el chat llega (' + chatB.join(' | ') + ')');
  // A junta una natilla: B ve el cartel 1/10
  await A.evaluate(() => { const J = window.__slendy.J; const l = J.conTag('Paper'); const w = J.posicion(l[0]); J.jug.o.position.set(w.x, w.y + 0.5, w.z + 0.3); J.S.O[J.S.buscar('Tinky 1')]?.position.set(0, -50, 0); });
  await esperar(2500);
  const carteles = await Bp.evaluate(() => window.__slendy.J.gui.map((g) => window.__slendy.J.R.C.texs[g.tex]?.nombre));
  ok(carteles.includes('1-10'), 'coop: B ve el cartel 1/10 de A (' + carteles.join(',') + ')');

  // --- versus (día): A es el Tinky
  await A.evaluate(() => window.__slendy.J.red.salir()); await Bp.evaluate(() => window.__slendy.J.red.salir());
  await nivel(A, 4); await nivel(Bp, 4);
  await A.click('.unity.red [data-r="host"]');
  await esperar(3000);
  await A.waitForFunction(() => window.__slendy.J.red.activa, null, { timeout: 20000 });
  const cod2 = await A.evaluate(() => window.__slendy.J.red.codigo);
  ok(await A.evaluate(() => window.__slendy.J.soyTinky && window.__slendy.J.sinNiebla), 'versus: el anfitrión es el Tinky y ve sin niebla');
  await Bp.fill('.unity.red input', cod2); await Bp.click('.unity.red [data-r="con"]');
  await esperar(4000);
  ok(await Bp.evaluate(() => window.__slendy.J.remotos.size === 1 && !window.__slendy.J.soyTinky), 'versus: la víctima ve al Tinky');
  // el Tinky se pone delante de la víctima, a 5 m
  const pv = await Bp.evaluate(() => { const J = window.__slendy.J; const p = J.jugadorPos(); return [p.x - Math.sin(J.jug.yaw) * 5, p.y, p.z - Math.cos(J.jug.yaw) * 5]; });
  await A.evaluate((p) => { const J = window.__slendy.J; J.jug.o.position.set(p[0], p[1], p[2]); }, pv);
  await Bp.evaluate(() => { window.__slendy.J.jug.pitch = 0; });
  await esperar(6000);
  ok(await Bp.evaluate(() => window.__slendy.J.nivel === 0), 'versus: a la víctima la atraparon y volvió al menú');
  const cartA = await A.evaluate(() => window.__slendy.J.gui.map((g) => window.__slendy.J.R.C.texs[g.tex]?.nombre));
  ok(cartA.includes('playerhasdied'), 'versus: el Tinky ve "A player has been caught" (' + cartA.join(',') + ')');
} catch (e) { mal.push('EXCEPCIÓN ' + e.message.slice(0, 300)); }
console.log('BIEN:\n  ' + bien.join('\n  '));
console.log(mal.length ? 'MAL:\n  ' + mal.join('\n  ') : 'Todo bien');
await nav.close(); srv.kill(); B.cerrar?.(); process.exit(0);
