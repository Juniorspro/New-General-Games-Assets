// EL VR A 120 (vr-dibujo.js y la predicción de vr.js), a las 10:05 del juego (?hora=0,42, con sol):
// - cada ojo es el mundo dibujado UNA vez con todos los efectos y reproyectado: se compara con
//   dibujar ese ojo derecho con la cadena entera (la referencia) y con como era antes (dos
//   dibujos derechos, sin efectos). El nuevo tiene que quedar más cerca y igual de nítido;
// - una sola vuelta al mundo por cuadro y bastante menos llamadas que antes;
// - timewarp: si la cabeza giró 2° desde que se dibujó el mundo, lo que se ve es la cabeza
//   nueva (casi igual a dibujarla), no la vieja;
// - partido: dos cuadros (arriba y abajo) dan lo mismo que uno entero;
// - la predicción: con el giróscopo (rotationRate) o con dos lecturas, la pose se adelanta a
//   donde va a estar;
// - el ritmo: si los cuadros no llegan a la pantalla, se parte; si sobra, vuelve a entero; y
//   reconoce una pantalla de 120;
// - sin visor también va reproyectado (una vista), y al salir la pantalla normal queda igual.
//     node pruebas/vr120.mjs
import fs from 'node:fs';
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const giro = (pag, a, b, g) => pag.evaluate(([a, b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g })), [a, b, g]);

/* en la página: leer la pantalla, compararla (PSNR, también a media resolución) y la nitidez */
const AYUDA = () => {
  const A = window.__A, gl = A.motor.r.getContext();
  window.__leer = () => { const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, p = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, p); return { p, W, H }; };
  window.__psnr = (a, b, { baja = 1, x0 = 0, x1 = 1, y0 = 0, y1 = 1 } = {}) => {
    const { W, H } = a; let s = 0, n = 0;
    for (let y = Math.floor(y0 * H); y + baja <= Math.floor(y1 * H); y += baja) for (let x = Math.floor(x0 * W); x + baja <= Math.floor(x1 * W); x += baja) for (let c = 0; c < 3; c++) {
      let va = 0, vb = 0; for (let j = 0; j < baja; j++) for (let i = 0; i < baja; i++) { const k = ((y + j) * W + x + i) * 4 + c; va += a.p[k]; vb += b.p[k]; }
      const d = (va - vb) / (baja * baja); s += d * d; n++;
    }
    return +(10 * Math.log10(255 * 255 / (s / n))).toFixed(2);
  };
  window.__nitidez = (a) => { const { W, H, p } = a; let s = 0; for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) { const k = (y * W + x) * 4; s += Math.abs(p[k + 1] - p[k + 1 - 4]) + Math.abs(p[k + 1] - p[k + 1 - W * 4]); } return s / (W * H); };
  window.__png = (a) => { const { W, H, p } = a, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = x.createImageData(W, H); for (let y = 0; y < H; y++) im.data.set(p.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); x.putImageData(im, 0, 0); return c.toDataURL('image/png'); };
  /* la referencia: cada ojo dibujado derecho con la cadena de efectos entera, a su tamaño */
  window.__referencia = (sbs) => {
    const M = A.motor, R = M.r, D = A.vr.dib, cam = M.camara, ojo = new A.THREE.PerspectiveCamera(), n = sbs ? 2 : 1;
    const cw = M.ancho / n, ch = M.alto;
    M.cadena.setSize(cw, ch); M.pBloom.setSize(Math.round(cw * M.dpr / 2), Math.round(ch * M.dpr / 2));
    for (let e = 0; e < n; e++) {
      ojo.position.set(n === 1 ? 0 : (e ? 1 : -1) * 0.032, 0, 0).applyQuaternion(cam.quaternion).add(cam.position); ojo.quaternion.copy(cam.quaternion);
      ojo.fov = D.fovE; ojo.aspect = D.tanE.x / D.tanE.y; ojo.near = cam.near; ojo.far = cam.far; ojo.updateProjectionMatrix(); ojo.updateMatrixWorld();
      M.pRender.camera = ojo; R.setViewport(e * cw, 0, cw, ch); R.setScissor(e * cw, 0, cw, ch); R.setScissorTest(true);
      R.shadowMap.needsUpdate = true; M.cadena.render(0);
    }
    M.pRender.camera = cam; R.setScissorTest(false); R.setViewport(0, 0, M.ancho, M.alto);
    const r = window.__leer(); D.medir(A.vr.sbs, A.vr.fov); return r;
  };
};

{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&hora=0.42&calidad=alta', { ancho: 1266, alto: 585, movil: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
  await pag.evaluate(AYUDA);
  await avanzar(pag, 10);
  /* la pantalla normal, antes de entrar (para ver que al salir queda igual) */
  const estado = () => { const M = window.__A.motor, c = M.camara; return JSON.stringify({ brillo: [M.pBloom.renderTargetBright.width, M.pBloom.renderTargetBright.height], paso: M.pBloom.highPassUniforms.uPaso.value.toArray().map((v) => +v.toFixed(6)), cadena: [M.cadena.readBuffer.width, M.cadena.readBuffer.height], aspecto: +c.aspect.toFixed(4), lienzo: [M.r.domElement.width, M.r.domElement.height], sombras: M.r.shadowMap.enabled }); };
  const normal0 = await pag.evaluate((f) => { const A = window.__A, c = A.motor.camara; window.__pose0 = { p: c.position.clone(), q: c.quaternion.clone(), fov: c.fov }; A.motor.dibujar(0); window.__normal0 = window.__leer(); return eval('(' + f + ')')(); }, estado.toString());
  await pag.evaluate(() => window.__A.J.entrarVR(true)); await pag.waitForTimeout(300);
  await giro(pag, 20, 0, -80);
  await avanzar(pag, 4);
  /* 1) la reproyección contra la referencia y contra como era antes */
  const r1 = await pag.evaluate(() => {
    const A = window.__A, M = A.motor, R = M.r, D = A.vr.dib;
    A.vr.forzar = 'completo'; D.nSombra = (M.Q.sombraCada || 1) - 1;   // (que este cuadro rehaga las sombras, como la referencia)
    const e0 = D.stats.escenas;
    R.info.autoReset = false; R.info.reset(); A.vr.dibujar(M, 1 / 60, 1 / 60); const llamadas = R.info.render.calls; R.info.autoReset = true;
    const nuevo = window.__leer(), escenas = D.stats.escenas - e0;
    const ref = window.__referencia(true);
    /* antes: StereoCamera, dos dibujos derecho a la pantalla, sin efectos */
    const st = new A.THREE.StereoCamera(); st.eyeSep = 0.064; const c = M.camara.clone(), v = new A.THREE.Vector2(); R.getSize(v);
    c.fov = D.fovE; c.aspect = (v.x / 2) / v.y; c.updateProjectionMatrix(); c.updateMatrixWorld(); st.aspect = 1; st.update(c);
    R.info.autoReset = false; R.info.reset();
    R.setRenderTarget(null); R.setScissorTest(true); R.shadowMap.needsUpdate = true;
    R.setScissor(0, 0, v.x / 2, v.y); R.setViewport(0, 0, v.x / 2, v.y); R.render(M.escena, st.cameraL);
    R.setScissor(v.x / 2, 0, v.x / 2, v.y); R.setViewport(v.x / 2, 0, v.x / 2, v.y); R.render(M.escena, st.cameraR);
    R.setScissorTest(false); R.setViewport(0, 0, v.x, v.y); const llamadasAntes = R.info.render.calls; R.info.autoReset = true;
    const antes = window.__leer();
    window.__img = { nuevo: window.__png(nuevo), ref: window.__png(ref), antes: window.__png(antes) };
    return { escenas, llamadas, llamadasAntes, psnr: window.__psnr(nuevo, ref), psnrAntes: window.__psnr(antes, ref), psnr2: window.__psnr(nuevo, ref, { baja: 2 }), psnr2Antes: window.__psnr(antes, ref, { baja: 2 }), nit: +(window.__nitidez(nuevo) / window.__nitidez(ref)).toFixed(3) };
  });
  const imgs = await pag.evaluate(() => window.__img);
  for (const [k, n] of [['nuevo', 'vr120-nuevo'], ['ref', 'vr120-referencia'], ['antes', 'vr120-antes']]) fs.writeFileSync(path.join(SAL, n + '.png'), Buffer.from(imgs[k].split(',')[1], 'base64'));
  prueba('cada ojo reproyectado con efectos queda más cerca del ojo dibujado entero que el VR de antes (sin efectos)', r1.psnr2 > r1.psnr2Antes + 3 && r1.psnr2 > 29, `a media resolución: ${r1.psnr2} dB contra ${r1.psnr2Antes} dB (entera: ${r1.psnr} contra ${r1.psnrAntes})`);
  prueba('y no se ablanda (nitidez parecida a dibujarlo derecho)', r1.nit > 0.94 && r1.nit < 1.08, `${r1.nit} de la referencia`);
  prueba('el mundo se dibuja una sola vez por cuadro, con muchas menos llamadas que los dos ojos de antes', r1.escenas === 1 && r1.llamadas < r1.llamadasAntes * 0.7, `${r1.llamadas} contra ${r1.llamadasAntes} llamadas`);

  /* 2) timewarp: el mundo dibujado con la cabeza A; la cabeza gira 2° y se muestra sin mundo nuevo */
  const r2 = await pag.evaluate(() => {
    const A = window.__A, M = A.motor, D = A.vr.dib, cam = M.camara, THREE = A.THREE;
    A.vr.forzar = 'completo';
    D.cuadro(0, cam, { partido: false }); const viejo = window.__leer();
    const q0 = cam.quaternion.clone();
    cam.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(2))); cam.updateMatrixWorld();
    D.fase = 0; D.cuadro(0, cam, { partido: true });   // (dibuja solo la mitad de arriba: lo que se ve es el mundo viejo con la cabeza nueva)
    const warp = window.__leer(), e = D.stats.escenas;
    D.cuadro(0, cam, { partido: false }); const nueva = window.__leer();
    cam.quaternion.copy(q0);
    const zona = { x0: 0.08, x1: 0.42, y0: 0.1, y1: 0.9 };   // (el ojo izquierdo, sin los bordes)
    return { warp: window.__psnr(warp, nueva, zona), viejo: window.__psnr(viejo, nueva, zona), sinMundoNuevo: D.stats.escenas - e };
  });
  prueba('timewarp: si la cabeza giró 2° desde que se dibujó el mundo, se ve la cabeza nueva', r2.warp > r2.viejo + 6 && r2.warp > 27, `${r2.warp} dB contra ${r2.viejo} dB de mostrar lo viejo`);

  /* 3) partido: arriba en un cuadro y abajo en el otro dan lo mismo que entero */
  const r3 = await pag.evaluate(() => {
    const A = window.__A, M = A.motor, D = A.vr.dib, cam = M.camara;
    D.nSombra = 0; D.cuadro(0, cam, { partido: false }); const entero = window.__leer();
    D.fase = 0; const e0 = D.stats.escenas;
    D.cuadro(0, cam, { partido: true }); const e1 = D.stats.escenas; D.cuadro(0, cam, { partido: true }); const partido = window.__leer();
    return { psnr: window.__psnr(partido, entero), publicaAlSegundo: e1 === e0 && D.stats.escenas === e0 + 1 };
  });
  prueba('partido: arriba en un cuadro y abajo en el siguiente da lo mismo que entero', r3.psnr > 38 && r3.publicaAlSegundo, `${r3.psnr} dB; el mundo nuevo aparece en el segundo cuadro: ${r3.publicaAlSegundo}`);

  /* 4) la predicción */
  const r4 = await pag.evaluate(async () => {
    const A = window.__A, V = A.vr, THREE = A.THREE, yaw = (q) => { const v = new THREE.Vector3(0, 0, -1).applyQuaternion(q); return Math.atan2(-v.x, -v.z) * 180 / Math.PI; };
    const ev = (a) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: 0, gamma: -90 }));
    V.omega = null;
    /* dos lecturas separadas ~16 ms, girando a 90°/s (alfa: el rumbo); se adelanta 16 ms más */
    ev(30); await new Promise((ok) => setTimeout(ok, 16)); const t1 = V.giro.t; ev(30 + 90 * (performance.now() - t1) / 1000); const t2 = V.giro.t;
    const a2 = 30 + 90 * (t2 - t1) / 1000;
    const pred = yaw(V.orientacion(t2 + 16).clone()), ahora = yaw(V.orientacion(t2).clone());
    const esperado = 90 * 0.016;
    let d = pred - ahora; while (d > 180) d -= 360; while (d < -180) d += 360;
    /* con el giróscopo: rotationRate en x (beta) es el mismo giro con el celu acostado */
    window.dispatchEvent(new DeviceMotionEvent('devicemotion', { rotationRate: { alpha: 0, beta: 90, gamma: 0 }, interval: 16 }));
    let dg = yaw(V.orientacion(V.giro.t + 20).clone()) - yaw(V.orientacion(V.giro.t).clone()); while (dg > 180) dg -= 360; while (dg < -180) dg += 360;
    V.omega = null;
    return { dif: +d.toFixed(2), esperado: +esperado.toFixed(2), giros: +dg.toFixed(2), esperadoG: 1.8, a2: +a2.toFixed(2) };
  });
  prueba('la predicción con dos lecturas adelanta el giro (90°/s, 16 ms → 1,44°)', Math.abs(Math.abs(r4.dif) - r4.esperado) < 0.25, JSON.stringify(r4));
  prueba('y con el giróscopo (rotationRate) adelanta lo mismo, para el mismo lado', Math.abs(Math.abs(r4.giros) - r4.esperadoG) < 0.25 && Math.sign(r4.giros) === Math.sign(r4.dif), `${r4.giros}° en 20 ms`);

  /* 5) el ritmo */
  const r5 = await pag.evaluate(() => {
    const V = window.__A.vr, R = V.ritmo; V.forzar = null; V.modo = 'completo'; R.n = 0; R.i = 0; R.desde = 0; R.tMal = 0; R.tBien = 0; R.enteroDesde = performance.now();
    for (let i = 0; i < 60; i++) V.medirRitmo(1 / 120, 1 / 120);
    const hz = Math.round(1000 / R.refresco), m0 = V.modo;
    for (let i = 0; i < 90; i++) V.medirRitmo(0.0125, 0.0125);   // (12,5 ms: no llega a 120)
    const m1 = V.modo;
    for (let i = 0; i < 480; i++) V.medirRitmo(1 / 120, 1 / 120);   // (4 s de sobra, pero todavía no pasó la espera)
    const m2 = V.modo; R.intentoEn = 0;
    for (let i = 0; i < 400; i++) V.medirRitmo(1 / 120, 1 / 120);
    return { hz, m0, m1, m2, m3: V.modo, espera: R.espera };
  });
  prueba('reconoce la pantalla de 120, parte el dibujo si no llega y vuelve a entero cuando sobra (esperando)', r5.hz === 120 && r5.m0 === 'completo' && r5.m1 === 'partido' && r5.m2 === 'partido' && r5.m3 === 'completo', JSON.stringify(r5));

  /* 6) al salir, la pantalla normal queda como antes */
  await pag.evaluate(() => window.__A.J.salirVR());
  const r6 = await pag.evaluate((f) => {
    const A = window.__A, c = A.motor.camara, P = window.__pose0; c.position.copy(P.p); c.quaternion.copy(P.q); c.fov = P.fov; c.updateProjectionMatrix(); c.updateMatrixWorld();
    A.motor.dibujar(0); return { psnr: window.__psnr(window.__leer(), window.__normal0, { baja: 2 }), estado: eval('(' + f + ')')() };
  }, estado.toString());
  prueba('al salir del VR, la pantalla normal queda como antes de entrar (brillo, tamaños, cámara)', r6.estado === normal0 && r6.psnr > 26, `${r6.psnr} dB (se movió el agua y el pasto) · ${r6.estado === normal0 ? 'igual' : r6.estado + ' ≠ ' + normal0}`);
  prueba('sin errores (con visor)', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}
/* ------------------------------------------------ sin visor: una vista, también reproyectada */
{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&hora=0.42&calidad=media', { ancho: 1100, alto: 520, movil: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
  await pag.evaluate(AYUDA);
  await avanzar(pag, 8);
  await pag.evaluate(() => window.__A.J.entrarVR(false)); await pag.waitForTimeout(300);
  await giro(pag, 10, 0, -85);
  await avanzar(pag, 4);
  const r = await pag.evaluate(() => {
    const A = window.__A, M = A.motor, D = A.vr.dib;
    A.vr.forzar = 'completo'; D.nSombra = (M.Q.sombraCada || 1) - 1; A.vr.dibujar(M, 1 / 60, 1 / 60);
    const nuevo = window.__leer(), ref = window.__referencia(false);
    return { psnr2: window.__psnr(nuevo, ref, { baja: 2 }), nit: +(window.__nitidez(nuevo) / window.__nitidez(ref)).toFixed(3), ojos: document.querySelectorAll('.vr-ojo').length };
  });
  prueba('sin visor: una vista reproyectada, igual a dibujarla derecho con los efectos', r.ojos === 1 && r.psnr2 > 29 && r.nit > 0.9, JSON.stringify(r));
  prueba('sin errores (sin visor)', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
