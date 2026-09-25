// La versión con las canciones que mandó quien pide: que estén adentro, que se
// decodifiquen y que suenen donde van (menú: Wii Party = 'titulo'; la plaza:
// Mii Maker = 'colina'; la terminal, la bahía y el bosque, las suyas). Solo corre si existe aeroplaza-con-canciones.html.
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
/* se arranca en la Terminal (suena la de la ciudad); caminando a otras zonas cambia: la plaza, la bahía (la de itsalyzee) y el bosque (Frutiger Aero Ahhh) */
const zonas = {};
for (const [z, x, zz] of [['plaza', 0, 16], ['bahia', 118, 118], ['bosque', -128, -100]]) {
  zonas[z] = await pag.evaluate(([x, z]) => { const A = window.__A; A.yo.ponerEn(new A.THREE.Vector3(x, A.reino.mundo.altura(x, z) + 0.1, z), 0); for (let i = 0; i < 40; i++) A.paso(1 / 30, i === 39); return window.__A.Sonido.actual && window.__A.Sonido.actual.nombre; }, [x, zz]);
}
console.log('zonas:', JSON.stringify(zonas));
console.log(menu.suena === 'titulo' && plaza.suena === 'ciudad' && zonas.plaza === 'colina' && zonas.bahia === 'playa' && zonas.bosque === 'bosque' ? '✓ suenan donde van (y cambian por zona)' : '✗ no suenan donde van');
/* los temas de Rezona de cada reino (musica/): que se decodifiquen y suenen grabados */
let bien = true;
for (const [reino, tema] of [['aqua', 'arrecife'], ['jardin', 'cielo'], ['aurora', 'aurora'], ['tienda', 'ciudad'], ['casa', 'casa']]) {
  await pag.evaluate((r) => window.__A.viajar(r), reino);
  await pag.waitForFunction((r) => window.__A.reino && window.__A.reino.id === r, reino, { timeout: 60000, polling: 300 });
  await pag.waitForFunction((t) => { const S = window.__A.Sonido; return S.grabadas[t] && S.grabadas[t].buffer && S.actual && S.actual.nombre === t; }, tema, { timeout: 30000, polling: 300 }).catch(() => {});
  const r = await pag.evaluate((t) => { const S = window.__A.Sonido, G = S.grabadas[t]; return { suena: S.actual && S.actual.nombre, grabada: !!(S.actual && S.actual.grabada), dura: G && G.buffer ? G.buffer.duration.toFixed(1) : null, bucle: G && G.bucle }; }, tema);
  const ok = r.suena === tema && r.grabada && +r.dura > 15;
  bien = bien && ok;
  console.log(`${ok ? '✓' : '✗'} ${reino}: ${JSON.stringify(r)}`);
}
console.log(bien ? '✓ los temas de Rezona suenan en cada reino' : '✗ falta algún tema de Rezona');
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
