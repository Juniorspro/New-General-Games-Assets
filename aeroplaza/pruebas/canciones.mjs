// La versión con las canciones que mandó quien pide: que estén adentro, que se
// decodifiquen y que suenen donde van (menú: Wii Party = 'titulo'; plaza:
// Mii Maker = 'colina'). Solo corre si existe aeroplaza-con-canciones.html.
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
console.log(menu.suena === 'titulo' && plaza.suena === 'colina' ? '✓ suenan donde van' : '✗ no suenan donde van');
console.log(errores.filter((e) => !e.includes('ERR_FAILED')).join('\n') || 'sin errores');
await nav.close();
