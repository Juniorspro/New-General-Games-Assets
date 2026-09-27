// LA CÁMARA DE TU ESPACIO CON VISOR (vuelta 33), con un Android de mentira como espacio.mjs:
// - de entrada, tamaño real (cada grado de la foto, un grado de la vista): el campo del ojo es el de la
//   lente, no el de la cámara (con el aumento se veía como ojo de pescado);
// - con lentes, la foto se ve con su brillo (antes, sin pasar a sRGB, salía oscura: un gris 128 daba 55);
// - afuera de la foto sigue su borde, borroso y más oscuro (no el fondo);
// - el punto de la mirada va al centro de cada lente y sigue a la lente al cambiar la separación;
// - con poca luz (lo que mide Java: __nativo.luz) la linterna se prende sola y la foto se aclara; con luz, no;
//   apagada a mano, no vuelve a prenderse sola.
//     node pruebas/camara.mjs
import fs from 'node:fs';
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
await pag.addInitScript(() => {
  window.__llamadas = [];
  const anota = (n) => (...a) => { window.__llamadas.push([n, ...a]); };
  window.AeroplazaNativo = {
    version: () => '1', arEstado: () => 'si',
    arIniciar: () => { setTimeout(() => window.__nativo?.estado('corre'), 30); },
    arParar: anota('arParar'), arManos: anota('arManos'), manosDos: anota('manosDos'), flash: anota('flash'), vibrar: anota('vibrar'),
    arEscanear: (si) => { if (si) setTimeout(() => window.__nativo?.estado('espacio profundidad'), 10); },
    arPasante: anota('arPasante'), arOlvidar: anota('arOlvidar'),
  };
});
/* la foto: gris 128 con un borde naranja de 16 px (para ver que afuera sigue el borde) */
let jpeg = null;
await ctx.route(/^https:\/\/appassets\.androidplatform\.net\/camara\//, (r) => r.fulfill({ body: jpeg, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' } }));
await pag.reload();
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
jpeg = Buffer.from((await pag.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d');
  g.fillStyle = '#c86428'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#808080'; g.fillRect(16, 16, 288, 208); return c.toDataURL('image/jpeg', 0.92).split(',')[1]; })), 'base64');
await avanzar(pag, 5, 1 / 30, false);

/* al VR con visor, tu espacio; la cabeza quieta mirando derecho, y la foto sacada desde ahí */
await pag.evaluate(async () => {
  const { UI, THREE, J } = window.__A; J.lentes.poner('generico');
  UI.menuVR(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.menu-vr [data-sbs="1"]').click(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.vr-ar [data-ar="espacio"]').click(); await new Promise((r) => setTimeout(r, 150));
  const q = new THREE.Quaternion();
  window.__P = [0, 1.45, 0, q.x, q.y, q.z, q.w];
  window.__manda = (n = 1, dibujar = false) => { for (let i = 0; i < n; i++) { window.__nativo.pose(18, ...window.__P, 1, '60'); window.__A.paso(1 / 60, dibujar); } };
  window.__manda(40);
  window.__nativo.foto({ n: 1, url: 'https://appassets.androidplatform.net/camara/1.jpg', e: 30, tx: 0.62, ty: 0.46, w: 320, h: 240, p: window.__P });
});
await pag.waitForFunction(() => window.__A.espacio.fotoEn.llegadas >= 1, null, { timeout: 10000 });

/* lo que se ve: solo la foto (o solo el punto), dibujado y leído en el mismo paso */
const ver = (solo) => pag.evaluate((solo) => {
  const A = window.__A, E = A.espacio, L = A.J.lentes, gl = A.motor.r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, d = new Uint8Array(W * H * 4);
  window.__manda(1);
  const antes = E.escena.children.map((o) => o.visible); E.escena.children.forEach((o) => { o.visible = o === E[solo]; });
  /* (el punto, 4 veces más grande: en esta pantalla chica mide 2 px) */
  if (solo === 'punto') E.punto.scale.multiplyScalar(4);
  E.dibujar(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, d);
  E.escena.children.forEach((o, i) => { o.visible = antes[i]; });
  const h = H / 2, px = (x, y) => { let s = [0, 0, 0], n = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const k = ((Math.round(y) + j) * W + Math.round(x) + i) * 4; s[0] += d[k]; s[1] += d[k + 1]; s[2] += d[k + 2]; n++; } return s.map((v) => Math.round(v / n)); };
  const ojos = [0, 1].map((e) => {
    const c = L.activa ? L.centro(e) : { x: 0, y: 0 }, cx = W / 4 + e * W / 2 + c.x * h, cy = H / 2 + c.y * h;
    /* (una dirección de tan 1 a la derecha: afuera de la foto, que llega a 0,62) */
    const r1 = L.activa ? A.lentesMod.inversa(L.P, 1.0) : 1.0 / Math.tan(A.vr.fov * Math.PI / 360);
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < H; y++) for (let x = e * W / 2; x < (e + 1) * W / 2; x++) { const k = (y * W + x) * 4; if (d[k] > 200 && d[k + 1] > 200 && d[k + 2] > 200) { sx += x; sy += y; n++; } }
    return { centro: px(cx, cy), fuera: px(cx + (e === 0 ? -1 : 1) * r1 * h, cy), punto: n ? [sx / n - cx, sy / n - cy] : null, cx };
  });
  /* (dónde tiene que caer el punto en cada ojo: el paralaje de su distancia, con la curva de la lente) */
  const dm = E.punto.position.distanceTo(E.cabezaP), par = L.activa ? A.lentesMod.inversa(L.P, 0.032 / dm) * h : 0;
  return { W, H, h, ojos, par, campo: E.campo(), fovLente: L.activa ? L.fovOjo : A.vr.fov, llenar: E.llenar, gan: E.uFoto.uGan.value };
}, solo);

const conL = await ver('foto');
const cam = 2 * Math.atan(0.46) * 180 / Math.PI;
prueba('de entrada, tamaño real: el ojo con el campo de la lente, no el de la cámara', !conL.llenar && Math.abs(conL.campo - conL.fovLente) < 0.5 && conL.campo > cam + 20, `${conL.campo.toFixed(1)}° (la cámara ${cam.toFixed(1)}°)`);
const suma = (c) => c[0] + c[1] + c[2];
prueba('con lentes la foto se ve con su brillo (un gris 128 da ~128, no oscuro)', conL.ojos.every((o) => Math.abs(suma(o.centro) / 3 - 128) < 22), conL.ojos.map((o) => o.centro.join(',')).join(' · '));
const fo = conL.ojos.map((o) => o.fuera);
prueba('afuera de la foto sigue su borde (naranja, más oscuro), no el fondo', fo.every((c) => c[0] > 40 && c[0] > c[2] + 20 && suma(c) < 3 * 180), fo.map((c) => c.join(',')).join(' · '));
/* (la captura, del cuadro recién dibujado: la de la página agarra uno viejo) */
const png = await pag.evaluate(() => { window.__manda(1); window.__A.espacio.dibujar(); return window.__A.motor.r.domElement.toDataURL('image/png'); });
fs.writeFileSync(path.join(SAL, 'camara-sbs.png'), Buffer.from(png.split(',')[1], 'base64'));
/* sin lentes, el mismo brillo */
await pag.evaluate(() => window.__A.J.lentes.poner('plano'));
const sinL = await ver('foto');
prueba('sin lentes, el mismo brillo que con lentes', sinL.ojos.every((o, i) => Math.abs(suma(o.centro) - suma(conL.ojos[i].centro)) < 45), sinL.ojos.map((o) => o.centro.join(',')).join(' · '));
/* con aumento, el campo de la cámara */
const aum = await pag.evaluate(() => { const E = window.__A.espacio; window.__A.J.lentes.poner('generico'); E.accion('llenar'); window.__manda(1); const c = E.campo(); E.accion('llenar'); return { c, llenar: E.llenar }; });
prueba('"Cámara con aumento" usa el campo de la cámara (y se vuelve a apagar)', Math.abs(aum.c - cam) < 0.5 && !aum.llenar, `${aum.c.toFixed(1)}°`);

/* el punto: al centro de cada lente (con el paralaje de 1,2 m) y sigue a la lente */
const p0 = await ver('punto');
await pag.evaluate(() => { for (let i = 0; i < 10; i++) window.__A.J.lentes.ajustar('separacion', 1); });
const p1 = await ver('punto');
const lejos = p0.ojos.map((o, i) => o.punto ? Math.hypot(o.punto[0] - (i === 0 ? 1 : -1) * p0.par, o.punto[1]) : 99), sigue = p1.ojos.map((o, i) => o.punto && p0.ojos[i].punto ? (o.cx + o.punto[0]) - (p0.ojos[i].cx + p0.ojos[i].punto[0]) : null);
prueba('el punto de la mirada cae en el centro de cada lente (con el paralaje de su distancia, a menos de 2 px)', lejos.every((x) => x < 2), `${lejos.map((x) => x.toFixed(1)).join(' · ')} · paralaje ${p0.par.toFixed(1)} px`);
prueba('al separar las lentes 0,1, el punto se corre con ellas', sigue.every((x, i) => x != null && Math.abs(x - (i === 0 ? -1 : 1) * 0.1 * p0.h) < 2), `${sigue.map((x) => x?.toFixed(1)).join(' · ')} px (tenía que ${(0.1 * p0.h).toFixed(1)})`);
await pag.evaluate(() => window.__A.J.lentes.poner('generico'));

/* la luz: con luz, nada; con poca, la linterna sola y la foto más clara */
const luz = (y, ms, iso, seg) => pag.evaluate(async ([y, ms, iso, seg]) => {
  for (let t = 0; t < seg; t += 0.1) { window.__nativo.luz(y, ms, iso); window.__manda(6, true); await new Promise((r) => setTimeout(r, 100)); }
  const A = window.__A; return { flash: window.__llamadas.filter((x) => x[0] === 'flash').map((x) => x[1]), vrFlash: A.vr.flash, gan: A.espacio.uFoto.uGan.value, ayuda: document.querySelector('.vr-ayuda')?.textContent || '' };
}, [y, ms, iso, seg]);
const l0 = await luz(0.45, 16, 400, 1.6);
prueba('con luz (un cuarto común) la linterna no se prende', !l0.flash.length && !l0.vrFlash && l0.gan < 1.1, JSON.stringify(l0.flash));
const l1 = await luz(0.3, 33, 3200, 1.6);
prueba('con poca luz (la foto normal, pero la cámara abierta al máximo) se prende sola y lo dice', l1.flash.join() === 'true' && l1.vrFlash && /🔦/.test(l1.ayuda), `${l1.flash.join()} · ${l1.ayuda}`);
const l2 = await luz(0.05, 33, 3200, 0.8);
prueba('con la foto oscura, la foto se aclara', l2.gan > 1.6, `×${l2.gan.toFixed(2)}`);
/* apagada a mano (en la pantalla de tu espacio), no vuelve sola */
await pag.evaluate(() => window.__A.espacio.accion('linterna'));
await pag.waitForTimeout(50);
const l3 = await luz(0.05, 33, 3200, 1.6);
prueba('apagada a mano, no se prende sola de nuevo', l3.flash.join() === 'true,false' && !l3.vrFlash, l3.flash.join());

await pag.evaluate(() => window.__A.J.salirVR());
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
