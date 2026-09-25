// Solo suenan las canciones que mandó quien pide (25/09). En la versión con
// canciones: que estén adentro solo esas cinco, que se decodifiquen y que suenen
// donde van (menú: Wii Party = 'titulo'; la plaza: Mii Maker = 'colina'; la
// bahía y el bosque, las suyas; los reinos sin la suya, la que más se parece).
// En la versión sin canciones: que no suene nada (ni sintetizado).
// Solo corre si existe aeroplaza-con-canciones.html.
import fs from 'node:fs';
import path from 'node:path';
import { navegador, abrir, AQUI } from './comun.mjs';
if (!fs.existsSync(path.join(AQUI, '..', 'aeroplaza-con-canciones.html'))) { console.log('no está la versión con canciones (faltan los MP3)'); process.exit(0); }
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'pausa&calidad=baja', { archivo: 'aeroplaza-con-canciones.html', ancho: 800, alto: 450 });
await pag.waitForSelector('.idiomas', { timeout: 120000 });
await pag.click('[data-i=es]');
await pag.waitForSelector('.aviso');
await pag.mouse.click(200, 200);
await pag.waitForSelector('.canales');
await pag.waitForFunction(() => { const S = window.__A.Sonido; return S.grabadas.titulo && S.grabadas.titulo.buffer; }, null, { timeout: 30000, polling: 300 });
const menu = await pag.evaluate(() => { const S = window.__A.Sonido; return { temas: Object.keys(S.grabadas), dura: S.grabadas.titulo.buffer.duration.toFixed(1), suena: S.actual && S.actual.nombre, estado: S.ctx.state }; });
console.log('menú:', JSON.stringify(menu));
await pag.click('.canal[data-c=plaza]'); await pag.waitForTimeout(500); await pag.click('[data-a=empezar]');
await pag.waitForSelector('.hud', { timeout: 60000 });
await pag.waitForTimeout(1500);
const plaza = await pag.evaluate(() => { const S = window.__A.Sonido; return { suena: S.actual && S.actual.nombre, grabada: !!(S.actual && S.actual.fuente || S.grabadas.colina.buffer) }; });
console.log('plaza:', JSON.stringify(plaza));
/* se arranca en la Terminal (la de la ciudad no llegó: suena Mii Maker); caminando a otras zonas cambia: la plaza, la bahía (la de itsalyzee) y el bosque (Frutiger Aero Ahhh) */
const zonas = {};
for (const [z, x, zz] of [['plaza', 0, 16], ['bahia', 118, 118], ['bosque', -128, -100]]) {
  zonas[z] = await pag.evaluate(([x, z]) => { const A = window.__A; A.yo.ponerEn(new A.THREE.Vector3(x, A.reino.mundo.altura(x, z) + 0.1, z), 0); for (let i = 0; i < 40; i++) A.paso(1 / 30, i === 39); return window.__A.Sonido.actual && window.__A.Sonido.actual.nombre; }, [x, zz]);
}
console.log('zonas:', JSON.stringify(zonas));
console.log(menu.suena === 'titulo' && plaza.suena === 'colina' && zonas.plaza === 'colina' && zonas.bahia === 'playa' && zonas.bosque === 'bosque' ? '✓ suenan donde van (y cambian por zona)' : '✗ no suenan donde van');
/* adentro solo las que mandó (juegos y runner, el breakcore, llegaron el 25/09) */
const SUYAS = ['arrecife', 'bosque', 'colina', 'juegos', 'playa', 'runner', 'titulo'];
let bien = menu.temas.slice().sort().join() === SUYAS.join();
console.log(`${bien ? '✓' : '✗'} solo las suyas adentro: ${menu.temas.slice().sort().join(', ')}`);
/* cada reino con una de las suyas, grabada (aurora → Aquatic Ambience, jardín → Frutiger Aero Ahhh, tienda → Mii Maker, casa → Wii Party) */
for (const [reino, tema] of [['aqua', 'arrecife'], ['jardin', 'bosque'], ['aurora', 'arrecife'], ['tienda', 'colina'], ['casa', 'titulo'], ['juegos', 'juegos']]) {
  await pag.evaluate((r) => window.__A.viajar(r), reino);
  await pag.waitForFunction((r) => window.__A.reino && window.__A.reino.id === r, reino, { timeout: 60000, polling: 300 });
  await pag.waitForFunction((t) => { const S = window.__A.Sonido; return S.grabadas[t] && S.grabadas[t].buffer && S.actual && S.actual.nombre === t; }, tema, { timeout: 30000, polling: 300 }).catch(() => {});
  const r = await pag.evaluate((t) => { const S = window.__A.Sonido, G = S.grabadas[t]; return { suena: S.actual && S.actual.nombre, grabada: !!(S.actual && S.actual.grabada), dura: G && G.buffer ? G.buffer.duration.toFixed(1) : null }; }, tema);
  const ok = r.suena === tema && r.grabada && +r.dura > 15;
  bien = bien && ok;
  console.log(`${ok ? '✓' : '✗'} ${reino}: ${JSON.stringify(r)}`);
}
console.log(bien ? '✓ cada reino suena con una de las suyas' : '✗ algún reino no suena con una de las suyas');
/* el runner: callado en la cuenta y con el ¡YA! el breakcore desde el principio (solo ahí) */
{
  await pag.evaluate(() => window.__A.viajar('runner'));
  await pag.waitForFunction(() => window.__A.reino && window.__A.reino.id === 'runner', null, { timeout: 60000, polling: 300 });
  await pag.waitForTimeout(1500);
  const antes = await pag.evaluate(() => { const S = window.__A.Sonido; return S.actual && S.actual.nombre; });
  await pag.evaluate(() => { const A = window.__A, E = A.reino.runner; let n = 0; while (E.fase === 'cuenta' && n++ < 200) A.paso(1 / 30, false); A.paso(1 / 30, false); });
  await pag.waitForFunction(() => { const S = window.__A.Sonido; return S.actual && S.actual.nombre === 'runner' && S.actual.t0 != null; }, null, { timeout: 30000, polling: 200 }).catch(() => {});
  const r = await pag.evaluate(() => { const S = window.__A.Sonido, A = S.actual; return { suena: A && A.nombre, pos: A && A.t0 != null ? +S.posicion(A).toFixed(2) : null }; });
  const ok = !antes && r.suena === 'runner' && r.pos != null && r.pos < 3;
  console.log(`${ok ? '✓' : '✗'} runner: callado en la cuenta (${antes}) y el breakcore arranca con el ¡YA! ${JSON.stringify(r)}`);
  await pag.evaluate(() => window.__A.J.runnerSalir());
  await pag.waitForFunction(() => window.__A.reino && window.__A.reino.id === 'juegos', null, { timeout: 60000, polling: 300 });
  await pag.waitForFunction(() => { const S = window.__A.Sonido; return S.actual && S.actual.nombre === 'juegos'; }, null, { timeout: 30000, polling: 300 }).catch(() => {});
  const s2 = await pag.evaluate(() => { const S = window.__A.Sonido; return S.actual && S.actual.nombre; });
  console.log(`${s2 === 'juegos' ? '✓' : '✗'} al salir del runner vuelve la de la Zona de Juegos: ${s2}`);
}
/* la versión sin canciones: silencio (nada sintetizado) */
{
  const { pag: p2, ctx: c2 } = await abrir(nav, 'pausa&calidad=baja', { ancho: 800, alto: 450 });
  await p2.waitForSelector('.idiomas', { timeout: 120000 });
  await p2.click('[data-i=es]'); await p2.waitForSelector('.aviso'); await p2.mouse.click(200, 200); await p2.waitForSelector('.canales');
  await p2.click('.canal[data-c=plaza]'); await p2.waitForTimeout(500); await p2.click('[data-a=empezar]');
  await p2.waitForSelector('.hud', { timeout: 60000 }); await p2.waitForTimeout(1500);
  const r = await p2.evaluate(() => { const A = window.__A, S = A.Sonido; A.viajar('aurora'); for (let i = 0; i < 20; i++) A.paso(1 / 30, false); return { grabadas: Object.keys(S.grabadas).length, suena: S.actual && S.actual.nombre }; });
  const ok = r.grabadas === 0 && !r.suena;
  console.log(`${ok ? '✓' : '✗'} sin canciones no suena nada: ${JSON.stringify(r)}`);
  await c2.close();
}
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
