// Recorre NEVADA como una persona, sobre el HTML de un solo archivo (lo que se
// entrega): idioma → menú → cinemática entera → cámara libre → modo arcilla →
// otra vez. Saca una foto de cada paso y junta los errores de la consola.
//     node pruebas/flujo.mjs [--ancho=390]   → pruebas/salida/flujo-*.png y flujo.png
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { navegador } from './servidor.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
const HTML = path.join(AQUI, '..', 'nevada-en-un-archivo.html');
const ancho = +(process.argv.find((x) => x.startsWith('--ancho=')) || '--ancho=390').split('=')[1];
const nav = await navegador();
const pag = await nav.newPage({ viewport: { width: ancho, height: Math.round(ancho * 844 / 390) } });
const errores = [];
pag.on('pageerror', (e) => errores.push(e.message));
pag.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.text()); });
const fotos = [];
const foto = async (n) => { const f = path.join(SAL, `flujo-${n}.png`); await pag.screenshot({ path: f }); fotos.push(f); console.log('foto', n); };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const t0 = Date.now();
await pag.goto('file://' + HTML);
await pag.waitForSelector('#idioma button');
await foto('1-idioma');
await pag.click('#idioma button[data-i="es"]');
await esperar(900);
await foto('2-menu');
await pag.click('#ver');
await pag.waitForFunction(() => !document.querySelector('#menu') || document.querySelector('#menu').classList.contains('oculto'), null, { timeout: 300000 });
console.log(`la cinemática arrancó a los ${((Date.now() - t0) / 1000).toFixed(1)} s de abrir`);
await esperar(1500);
await foto('3-desglose');
await esperar(4500);
await foto('4-render');
await pag.waitForFunction(() => !document.querySelector('#final').classList.contains('oculto'), null, { timeout: 120000 });
await esperar(1200);
await foto('5-final');
// arrastrar para girar la cámara libre
const c = await pag.locator('canvas').boundingBox();
await pag.mouse.move(c.x + c.width * 0.5, c.y + c.height * 0.45);
await pag.mouse.down(); await pag.mouse.move(c.x + c.width * 0.2, c.y + c.height * 0.42, { steps: 8 }); await pag.mouse.up();
await esperar(800);
await foto('6-libre');
await pag.click('#arcilla');
await esperar(800);
await foto('7-arcilla');
await pag.click('#otra');
await esperar(2500);
await foto('8-otra-vez');
await nav.close();
console.log(errores.length ? 'ERRORES:\n' + [...new Set(errores)].join('\n') : 'sin errores en la consola');
const args = ['-hide_banner', '-loglevel', 'error', '-y'];
fotos.forEach((f) => args.push('-i', f));
args.push('-filter_complex', fotos.map((_, i) => `[${i}]scale=200:-2[s${i}]`).join(';') + ';' + fotos.map((_, i) => `[s${i}]`).join('') + `hstack=${fotos.length}`, path.join(SAL, 'flujo.png'));
spawnSync('ffmpeg', args);
console.log('hoja: pruebas/salida/flujo.png');
