// Recorre el juego como una persona: idioma → aviso → menú de canales → canal
// Plaza → juego; habla con Nimbo y acepta la misión; abre el probador y se
// compra algo; pausa, opciones, controles con el editor de dedos; viaja en
// tren a Aqua y monta un delfín. Saca una foto de cada pantalla.
//     node pruebas/flujo.mjs [--movil] [--idioma=en]
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

const movil = process.argv.includes('--movil');
const idioma = (process.argv.find((a) => a.startsWith('--idioma=')) || '--idioma=es').split('=')[1];
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'pausa&calidad=baja', movil ? { ancho: 390, alto: 844, movil: true } : { ancho: 1100, alto: 620 });
const ok = [], mal = [];
const prueba = (n, c, d = '') => { (c ? ok : mal).push(n); console.log((c ? '✓ ' : '✗ ') + n + (d ? ` · ${d}` : '')); };
const foto = async (n) => pag.screenshot({ path: path.join(SAL, `flujo-${n}${movil ? '-movil' : ''}.png`), timeout: 120000 });
const tocar = async (sel) => { const e = pag.locator(sel).first(); await e.waitFor({ timeout: 20000 }); if (movil) await e.tap(); else await e.click(); await pag.waitForTimeout(250); };
const esperar = (ms) => pag.waitForTimeout(ms);

await pag.waitForSelector('.idiomas', { timeout: 120000 });
await foto('1-idioma');
await tocar(`[data-i=${idioma}]`);
await pag.waitForSelector('.aviso');
await foto('2-aviso');
if (movil) await pag.tap('.aviso'); else await pag.mouse.click(300, 300);
await pag.waitForSelector('.canales');
await esperar(600);
await foto('3-menu');
prueba('menú de canales con 12 lugares', (await pag.locator('.canal').count()) === 12);
prueba('hay un botón grande de Jugar', await pag.locator('.jugar-grande').isVisible());
await tocar('.canal[data-c=plaza]');
await esperar(600);
await foto('4-canal');
await tocar('[data-a=empezar]');
await pag.waitForSelector('.hud', { timeout: 60000 });
await avanzar(pag, 30);
await foto('5-juego');
prueba('el tutorial dice cómo moverse', /palanca|WASD/.test(await pag.locator('.tuto').textContent().catch(() => '')));
/* la ventana de estilos retro, desde el botón 👾 del HUD */
await tocar('[data-a=estilo]'); await esperar(900);
await foto('5b-estilos');
prueba('la ventana de estilos tiene 7 estilos', (await pag.locator('.estilo-carta').count()) === 7);
await tocar('.estilo-carta[data-e=pixel]'); await avanzar(pag, 3);
prueba('el estilo Pixel dibuja a 270 líneas', await pag.evaluate(() => window.__A.motor.r.domElement.height) === 270);
await pag.evaluate(() => window.__A.UI.cerrarVentana()); await avanzar(pag, 2);
await foto('5c-pixel');
await pag.evaluate(() => window.__A.J.ponerEstilo('normal'));
prueba('HUD con hotbar de 5', (await pag.locator('.ranura').count()) === 5);
/* hablar con Nimbo: se lo pone al lado y se aprieta usar */
await pag.evaluate(() => { const A = window.__A, n = A.reino.npcMallas.find((q) => q.id === 'nimbo').m.raiz.position; A.yo.p.set(n.x + 1.5, n.y, n.z); A.yo.rumbo = -Math.PI / 2; });
await avanzar(pag, 5);
const cartel = await pag.locator('.aviso-accion').textContent().catch(() => '');
prueba('aparece el cartel para hablar', /Nimbo/.test(cartel), cartel);
await pag.keyboard.press('KeyE'); await avanzar(pag, 3);
await pag.waitForSelector('.dialogo');
await avanzar(pag, 20); await esperar(1500);
await foto('6-dialogo');
for (let i = 0; i < 3; i++) { await pag.keyboard.press('Space'); await esperar(900); }
const botones = await pag.locator('.dialogo .acciones button').count();
prueba('Nimbo ofrece la misión (Aceptar / Después)', botones === 2);
await tocar('.dialogo .acciones .primario');
await avanzar(pag, 5);
const mis = await pag.locator('.mision').count();
prueba('la misión aparece arriba a la izquierda', mis === 1);
/* el probador */
await pag.evaluate(() => window.__A.J.abrirProbador());
await avanzar(pag, 10);
await tocar('.pestanas [data-p=sombrero]');
await tocar('.opciones-prob .item:nth-child(4)');   // galera: 25 orbes, hay 15 → avisa que faltan
await pag.evaluate(() => { window.__A.G.orbes = 40; });
await tocar('.opciones-prob .item:nth-child(4)');
await tocar('.velo [data-a=si]');
prueba('se compra con la confirmación propia', await pag.evaluate(() => window.__A.G.tengo.includes('sombrero:galera') && window.__A.G.orbes === 15));
await avanzar(pag, 5);
await esperar(400); await foto('7-probador');
prueba('el probador muestra el muñeco y los sombreros', (await pag.locator('.opciones-prob .item').count()) > 8);
await tocar('.prob-pie [data-a=listo]');
/* pausa, opciones y el editor de dedos */
await pag.keyboard.press('Escape'); await avanzar(pag, 2);
await pag.waitForSelector('.pausa-menu');
await esperar(500); await foto('8-pausa');
await tocar('.pausa-menu [data-a=opciones]');
await esperar(500); await foto('9-opciones');
await pag.keyboard.press('Escape'); await esperar(200);
await pag.evaluate(() => window.__A.UI.cerrarVentana());
await pag.evaluate(() => window.__A.UI.editorDedos());
await avanzar(pag, 2);
await foto('10-editor-dedos');
await tocar('.editor-dedos .primario');
/* el tren a Aqua y el delfín */
await pag.evaluate(() => window.__A.viajar('aqua'));
await esperar(1800); await avanzar(pag, 20);
prueba('viaja a Aqua', await pag.evaluate(() => window.__A.reino.id) === 'aqua');
await pag.evaluate(() => { const A = window.__A, d = A.reino.delfines[0]; A.yo.montar(d); });
await avanzar(pag, 40);
await foto('11-delfin');
prueba('monta el delfín', await pag.evaluate(() => window.__A.yo.modo) === 'montado');
const errs = errores.filter((e) => !e.includes('ERR_FAILED'));
prueba('sin errores en la consola', !errs.length, [...new Set(errs)].slice(0, 4).join(' | '));
await nav.close();
console.log(`\n${ok.length} bien, ${mal.length} mal`);
process.exit(mal.length ? 1 : 0);
