// EL MODO VR (vr.js), con el giroscopio de mentira (eventos deviceorientation, el celu acostado
// como en un visor: gama -90 es mirar derecho; la pantalla de la prueba está a 90°):
// - se entra desde la pausa, eligiendo con visor (SBS) o sin; queda en primera persona, sin la
//   interfaz ni los dedos;
// - girar el celu gira la vista (30° de alfa → 30° de rumbo) y levantarlo la inclina;
// - un toque camina para donde se mira y otro frena; dos toques saltan;
// - con SBS se dibujan dos mitades (una por ojo, apenas corridas) con la raya del medio;
// - mirar abajo 2 s sale y vuelve todo; sin giroscopio (la compu) se mira arrastrando;
// - en el menú se elige cómo van las manos (rápidas, en el medio, suaves).
//     node pruebas/vr.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const giro = (pag, a, b, g) => pag.evaluate(([a, b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g })), [a, b, g]);
const toque = (pag) => pag.evaluate(() => { const c = document.querySelector('.vr-capa'); for (const tipo of ['pointerdown', 'pointerup']) c.dispatchEvent(new PointerEvent(tipo, { bubbles: true, clientX: 300, clientY: 200 })); });

{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
  await avanzar(pag, 5);
  await pag.evaluate(() => window.__A.J.pausar(true));
  await pag.waitForTimeout(200);
  await pag.evaluate(() => document.querySelector('[data-a=vr]').click());
  await pag.waitForTimeout(200);
  const menu = await pag.evaluate(() => document.querySelectorAll('.vr-op').length);
  /* cómo van las manos: rápidas, en el medio (de entrada) o suaves; se guarda y el VR lo usa */
  const rs = await pag.evaluate(() => { const A = window.__A, antes = A.G.opciones.vrSuave, marcada = document.querySelector('.vr-tres .si')?.dataset.suave, b = document.querySelector('.vr-tres [data-suave=suave]'); b.click(); return { antes, marcada, ahora: A.G.opciones.vrSuave, si: b.classList.contains('si'), marcadas: document.querySelectorAll('.vr-tres .si').length, texto: document.querySelector('.vr-suave small').textContent }; });
  await pag.screenshot({ path: path.join(SAL, 'vr-menu.png') });
  await giro(pag, 0, 0, -90);
  await pag.evaluate(() => document.querySelector('.vr-op[data-sbs="1"]').click());
  await pag.waitForTimeout(300);
  await giro(pag, 0, 0, -90);
  await avanzar(pag, 4);
  const r1 = await pag.evaluate(() => { const A = window.__A; return { activo: A.vr.activo, sbs: A.vr.sbs, fp: A.cam.fp, hud: A.UI.hud.style.display, ojos: document.querySelectorAll('.vr-capa .vr-ojo').length, yaw: A.cam.yaw }; });
  prueba('se entra desde la pausa: con visor, primera persona, sin interfaz, dos ojos', menu === 2 && r1.activo && r1.sbs && r1.fp && r1.hud === 'none' && r1.ojos === 2, JSON.stringify(r1));
  rs.enVR = await pag.evaluate(() => window.__A.manos.suavidad);
  prueba('se elige cómo van las manos (de entrada, medio) y el VR lo usa', rs.antes === 'media' && rs.marcada === 'media' && rs.ahora === 'suave' && rs.si && rs.marcadas === 1 && rs.texto.length > 5 && rs.enVR === 'suave', JSON.stringify(rs));
  await giro(pag, 30, 0, -90); await avanzar(pag, 2);
  const yaw2 = await pag.evaluate(() => window.__A.cam.yaw);
  let d = (yaw2 - r1.yaw) * 180 / Math.PI; while (d > 180) d -= 360; while (d < -180) d += 360;
  prueba('girar el celu 30° gira la vista 30°', Math.abs(Math.abs(d) - 30) < 2, `${d.toFixed(1)}°`);
  await giro(pag, 30, 0, -112); await avanzar(pag, 2);
  const p3 = await pag.evaluate(() => { const v = new window.__A.THREE.Vector3(0, 0, -1).applyQuaternion(window.__A.motor.camara.quaternion); return +v.y.toFixed(3); });
  prueba('levantar el celu mira para arriba', p3 > 0.25, `y de la vista ${p3}`);
  await giro(pag, 30, 0, -90); await avanzar(pag, 2);
  /* a un lugar sin nada que usar por 12 m para adelante (si no, el toque usa lo que hay: el cartel del mapa está al lado) */
  await pag.evaluate(() => {
    const A = window.__A, W = A.reino.mundo, yaw = A.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (let r = 8; r < 120; r += 4) for (let k = 0; k < 16; k++) {
      const x = A.yo.p.x + Math.cos(k / 16 * 6.28) * r, z = A.yo.p.z + Math.sin(k / 16 * 6.28) * r;
      let ok = true; for (let d = 0; d <= 12 && ok; d += 1) { const px = x + fx * d, pz = z + fz * d, y = W.altura(px, pz); if (W.cercano({ x: px, y, z: pz }) || W.solidos.some((s) => W.dentro(s, px, pz, 0.8) && s.y1 > y + 0.4) || (W.agua != null && y < W.agua + 0.3)) ok = false; }
      if (ok) { A.yo.p.set(x, W.altura(x, z) + 0.05, z); A.yo.v.set(0, 0, 0); return; }
    }
  });
  await avanzar(pag, 3);
  /* un toque camina para donde se mira */
  const p0 = await pag.evaluate(() => window.__A.yo.p.toArray());
  await toque(pag); await pag.waitForTimeout(380);
  await avanzar(pag, 30);
  const r4 = await pag.evaluate((p0) => { const A = window.__A, p = A.yo.p, dx = p.x - p0[0], dz = p.z - p0[2], yaw = A.cam.yaw; return { mov: +Math.hypot(dx, dz).toFixed(2), hacia: +((dx * -Math.sin(yaw) + dz * -Math.cos(yaw)) / (Math.hypot(dx, dz) || 1)).toFixed(2), camina: A.vr.camina }; }, p0);
  prueba('un toque camina para donde se mira', r4.camina && r4.mov > 2 && r4.hacia > 0.8, JSON.stringify(r4));
  /* (y abrir una ventana sale del VR: se prueba al final) */
  await toque(pag); await pag.waitForTimeout(380); await avanzar(pag, 20);
  const p5 = await pag.evaluate(() => window.__A.yo.p.toArray());
  await avanzar(pag, 20);
  const r5 = await pag.evaluate((p5) => ({ camina: window.__A.vr.camina, mov: +Math.hypot(window.__A.yo.p.x - p5[0], window.__A.yo.p.z - p5[2]).toFixed(2) }), p5);
  prueba('otro toque frena', !r5.camina && r5.mov < 0.3, JSON.stringify(r5));
  /* dos toques: salta */
  const y0 = await pag.evaluate(() => window.__A.yo.p.y);
  await toque(pag); await pag.waitForTimeout(80); await toque(pag); await pag.waitForTimeout(50);
  const alto = await pag.evaluate(() => { let m = 0; const A = window.__A, y0 = A.yo.p.y; for (let i = 0; i < 12; i++) { A.paso(1 / 30, false); m = Math.max(m, A.yo.p.y - y0); } return m; });
  prueba('dos toques saltan', alto > 0.5, `subió ${alto.toFixed(2)} m`);
  await avanzar(pag, 30);
  /* las dos mitades */
  await avanzar(pag, 2);
  await pag.screenshot({ path: path.join(SAL, 'vr-sbs.png') });
  const r6 = await pag.evaluate(() => {
    const A = window.__A, gl = A.motor.r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    A.paso(1 / 30, true);
    const lee = (x, y) => { const p = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p]; };
    const izq = lee(Math.round(w * 0.25), Math.round(h * 0.6)), der = lee(Math.round(w * 0.75), Math.round(h * 0.6));
    return { izq, der, iguales: izq.join() === der.join(), vacio: izq[0] + izq[1] + izq[2] < 30 };
  });
  prueba('con SBS se dibujan las dos mitades', !r6.vacio && r6.der[0] + r6.der[1] + r6.der[2] > 30, JSON.stringify(r6));
  const arriba = await pag.evaluate(() => +new window.__A.THREE.Vector3(0, 1, 0).applyQuaternion(window.__A.motor.camara.quaternion).y.toFixed(2));
  prueba('con el celu acostado el horizonte queda derecho', arriba > 0.95, `arriba de la vista: y ${arriba}`);
  /* mirar abajo 2 s sale */
  await giro(pag, 30, 0, -4);
  await avanzar(pag, 75);
  const r7 = await pag.evaluate(() => { const A = window.__A; return { activo: A.vr.activo, hud: A.UI.hud.style.display, capa: !!document.querySelector('.vr-capa') }; });
  prueba('mirar abajo 2 s sale y vuelve la interfaz', !r7.activo && r7.hud === '' && !r7.capa, JSON.stringify(r7));
  /* una ventana (el mapa, una charla…) es de la interfaz plana: se sale del VR */
  await pag.evaluate(() => window.__A.J.entrarVR(true)); await pag.waitForTimeout(200); await avanzar(pag, 2);
  prueba('con visor no hay botón de flash (no se puede tocar la pantalla)', await pag.evaluate(() => window.__A.vr.sbs && !document.querySelector('.vr-capa .vr-flash')));
  await pag.evaluate(() => window.__A.UI.ventana('x', 'y')); await avanzar(pag, 2);
  prueba('abrir una ventana sale del VR', await pag.evaluate(() => !window.__A.vr.activo && window.__A.UI.hud.style.display === ''));
  await pag.evaluate(() => window.__A.UI.cerrarVentana());
  prueba('sin errores (VR con visor)', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}
/* ------------------------------------------------ sin visor, en la compu (sin giroscopio): se arrastra */
{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 1100, alto: 620 });
  await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
  await pag.evaluate(() => window.__A.J.entrarVR(false));
  await pag.waitForTimeout(200); await avanzar(pag, 3);
  const y0 = await pag.evaluate(() => window.__A.cam.yaw);
  await pag.evaluate(() => { const c = document.querySelector('.vr-capa'); c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 300 })); for (let i = 1; i <= 10; i++) c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 500 - i * 20, clientY: 300 })); c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 300, clientY: 300 })); });
  await avanzar(pag, 3);
  const r = await pag.evaluate((y0) => ({ sbs: window.__A.vr.sbs, ojos: document.querySelectorAll('.vr-capa .vr-ojo').length, dy: +(window.__A.cam.yaw - y0).toFixed(2), camina: window.__A.vr.camina }), y0);
  prueba('sin visor: una vista; sin giroscopio se mira arrastrando (y arrastrar no cuenta como toque)', !r.sbs && r.ojos === 1 && Math.abs(r.dy) > 0.5 && !r.camina, JSON.stringify(r));
  /* el flash: solo sin visor; un toque lo prende y otro lo apaga, sin caminar; si el celu no deja, avisa */
  const rf = await pag.evaluate(async () => {
    const A = window.__A, b = document.querySelector('.vr-capa .vr-flash'); if (!b) return { boton: false };
    const orig = A.vr.alFlash, pedidos = [];
    A.vr.alFlash = async (on) => { pedidos.push(on); return on; };
    A.vr.toque = false; const camina0 = A.vr.camina;
    const tocar = async () => { b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); b.click(); await new Promise((ok) => setTimeout(ok, 50)); };
    await tocar(); const prendido = b.classList.contains('prendido') && b.getAttribute('aria-pressed') === 'true';
    await tocar(); const apagado = !b.classList.contains('prendido');
    await new Promise((ok) => setTimeout(ok, 600));   // (lo que tarda la capa en tomar un toque como "caminar")
    const camina = A.vr.camina !== camina0 || !!A.vr.toque;
    A.vr.alFlash = async () => 'no'; await tocar(); const aviso = document.querySelector('.vr-ayuda')?.textContent || '';
    A.vr.alFlash = orig;
    const r = b.getBoundingClientRect();
    return { boton: true, pedidos, prendido, apagado, camina, aviso, noHay: b.classList.contains('no-hay'), lugar: [Math.round(r.right), Math.round(r.top), Math.round(r.width)] };
  });
  await pag.screenshot({ path: path.join(SAL, 'vr-flash.png') });
  prueba('sin visor hay botón de flash: prende y apaga, y tocarlo no camina', rf.boton && JSON.stringify(rf.pedidos) === '[true,false]' && rf.prendido && rf.apagado && !rf.camina, JSON.stringify(rf));
  prueba('si el celu no deja prender el flash, avisa', rf.noHay && /flash/i.test(rf.aviso), rf.aviso);
  /* la linterna de verdad (manos-camara.js), con una cámara de mentira: con torch prende y apaga (y
     cierra la cámara si no hay manos); sin torch dice que no y no deja la cámara abierta */
  const rl = await pag.evaluate(async () => {
    const A = window.__A, mc = new A.ManosCamara({}), pedidos = []; let torch = false;
    const pista = { getCapabilities: () => ({ torch: true }), applyConstraints: async (c) => { pedidos.push(c.advanced[0].torch); torch = c.advanced[0].torch; }, getSettings: () => ({ torch }), stop() { pista.parada = true; } };
    mc.abrirCamara = async () => { mc.stream = { getVideoTracks: () => [pista], getTracks: () => [pista] }; return mc.stream; };
    const a = await mc.linterna(true), b = mc.flash, c = await mc.linterna(false), cerrada = !mc.stream && !!pista.parada;
    const p2 = { getCapabilities: () => ({}), applyConstraints: async () => {}, getSettings: () => ({}), stop() { p2.parada = true; } };
    mc.abrirCamara = async () => { mc.stream = { getVideoTracks: () => [p2], getTracks: () => [p2] }; return mc.stream; };
    const d = await mc.linterna(true);
    return { a, b, c, cerrada, pedidos, d, cerrada2: !mc.stream && !!p2.parada };
  });
  prueba('la linterna: con torch prende, apaga y cierra la cámara; sin torch dice que no', rl.a === true && rl.b && rl.c === false && rl.cerrada && JSON.stringify(rl.pedidos) === '[true,false]' && rl.d === 'no' && rl.cerrada2, JSON.stringify(rl));
  await pag.keyboard.press('Escape'); await avanzar(pag, 2);
  prueba('Escape sale del modo VR', await pag.evaluate(() => !window.__A.vr.activo));
  prueba('sin errores (VR sin visor)', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
