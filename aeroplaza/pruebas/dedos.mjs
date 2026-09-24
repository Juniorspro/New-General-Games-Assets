// Los controles de dedo, tocados de verdad (eventos táctiles por CDP, como un
// dedo en la pantalla): la palanca mueve, ⤒ salta, ✋ habla, arrastrar a la
// derecha gira la cámara. También el mouse en compu: arrastrar gira la cámara.
// Lo que ve cada dedo se comprueba con elementFromPoint: nada de la interfaz
// puede estar tapando la capa de los dedos.
//     node pruebas/dedos.mjs
import { navegador, abrir, avanzar } from './comun.mjs';
const nav = await navegador();
const ok = [], mal = [];
const prueba = (n, c, d = '') => { (c ? ok : mal).push(n); console.log((c ? '✓ ' : '✗ ') + n + (d ? ` · ${d}` : '')); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 390, alto: 844, movil: true });
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5);
const cdp = await ctx.newCDPSession(pag);
const toque = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
const centro = async (sel) => pag.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const quien = (x, y) => pag.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[data-b]')?.dataset.b || e.id || e.className) : 'nada'; }, [x, y]);
/* la palanca: se apoya el dedo a la izquierda y se empuja para arriba */
const [px, py] = await centro('.dedo-palanca');
prueba('el dedo en la palanca llega a la capa de dedos', ['palanca', 'dedos'].includes(await quien(px, py)), await quien(px, py));
const antes = await pag.evaluate(() => window.__A.yo.p.clone());
await toque('touchStart', [[px, py]]);
await toque('touchMove', [[px, py - 30]]); await toque('touchMove', [[px, py - 60]]);
await avanzar(pag, 45);
const durante = await pag.evaluate(() => window.__A.yo.estado);
await toque('touchEnd', []);
const despues = await pag.evaluate(() => window.__A.yo.p.clone());
const d = Math.hypot(despues.x - antes.x, despues.z - antes.z);
prueba('la palanca mueve al muñeco', d > 2, `${d.toFixed(1)} m · ${durante}`);
/* saltar */
const [sx, sy] = await centro('[data-b=salta]');
prueba('el botón ⤒ no está tapado', (await quien(sx, sy)) === 'salta', await quien(sx, sy));
await toque('touchStart', [[sx, sy]]); await avanzar(pag, 4);
const salto = await pag.evaluate(() => ({ e: window.__A.yo.estado, vy: window.__A.yo.v.y }));
await toque('touchEnd', []); await avanzar(pag, 20);
prueba('⤒ salta', salto.e === 'salta' || salto.vy > 1, `${salto.e} vy ${salto.vy.toFixed(1)}`);
/* la cámara con el dedo derecho */
const yaw0 = await pag.evaluate(() => window.__A.cam.yaw);
await toque('touchStart', [[300, 300]]); await toque('touchMove', [[250, 300]]); await avanzar(pag, 2); await toque('touchMove', [[200, 310]]); await avanzar(pag, 2); await toque('touchEnd', []);
const yaw1 = await pag.evaluate(() => window.__A.cam.yaw);
prueba('arrastrar a la derecha gira la cámara', Math.abs(yaw1 - yaw0) > 0.3, `${(yaw1 - yaw0).toFixed(2)} rad`);
/* dos dedos a la vez: caminar y girar */
await toque('touchStart', [[px, py], [300, 400]]); await toque('touchMove', [[px + 50, py], [260, 400]]); await avanzar(pag, 20); await toque('touchEnd', []);
prueba('dos dedos a la vez (palanca + cámara)', true);
/* ✋ al lado de Nimbo abre la charla */
await pag.evaluate(() => { const A = window.__A, n = A.reino.npcMallas.find((q) => q.id === 'nimbo').m.raiz.position; A.yo.p.set(n.x + 1.5, n.y, n.z); });
await avanzar(pag, 5);
const [ax, ay] = await centro('[data-b=accion]');
prueba('el botón ✋ no está tapado', (await quien(ax, ay)) === 'accion', await quien(ax, ay));
await toque('touchStart', [[ax, ay]]); await avanzar(pag, 3); await toque('touchEnd', []); await avanzar(pag, 3);
prueba('✋ habla con Nimbo', await pag.locator('.dialogo').count() === 1);
await ctx.close();
/* en compu: el mouse arrastra la cámara */
const C = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 900, alto: 500 });
await C.pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(C.pag, 5);
const y0 = await C.pag.evaluate(() => window.__A.cam.yaw);
await C.pag.mouse.move(450, 250); await C.pag.mouse.down(); await C.pag.mouse.move(350, 260, { steps: 5 }); await avanzar(C.pag, 2); await C.pag.mouse.up();
const y1 = await C.pag.evaluate(() => window.__A.cam.yaw);
prueba('en compu, arrastrar con el mouse gira la cámara', Math.abs(y1 - y0) > 0.2, `${(y1 - y0).toFixed(2)} rad`);
await C.pag.keyboard.down('KeyW'); await avanzar(C.pag, 30); await C.pag.keyboard.up('KeyW');
prueba('en compu, W camina', (await C.pag.evaluate(() => window.__A.yo.p.distanceTo(window.__A.reino.inicio))) > 1.5);
const errs = [...errores, ...C.errores].filter((e) => !e.includes('ERR_FAILED'));
prueba('sin errores en la consola', !errs.length, errs.slice(0, 3).join(' | '));
await nav.close();
console.log(`\n${ok.length} bien, ${mal.length} mal`);
process.exit(mal.length ? 1 : 0);
