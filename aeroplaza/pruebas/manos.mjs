// LAS MANOS DEL VR (manos.js, manos-camara.js), como en un Meta Quest:
// - manos de mentira (21 puntos armados acá, abiertas, pellizcando o con la palma a la cara) que
//   llegan como del visor; se dibujan en los dos ojos con dos llamadas;
// - el filtro: quieta con ruido de 3 mm no tiembla; moviéndose a 1 m/s con fotos a 30 por segundo,
//   la mano dibujada va donde está (se adelanta), no 3 cm atrás;
// - el pellizco con histéresis; el rayo apunta lo que se usa (el cartel del mapa: abre la ventana);
//   el arco al piso y soltar el pellizco salta ahí, con parpadeo; los dos pellizcos saltan;
// - la palma a la cara y un pellizco abren el menú; se toca con la yema (girar) o con el rayo
//   (cuadros por segundo) y "salir" sale del VR;
// - la yema revienta una burbuja;
// - y MediaPipe de verdad, en su worker, con las tres fotos de pruebas/manos (hechas con Rezona):
//   las dos manos abiertas, cuál es cuál, el pellizco y la palma.
//     node pruebas/manos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };

/* en la página: una mano de 21 puntos (metros). Derecha, de dorso a la cara, dedos para arriba:
   x a la derecha, y arriba, z hacia la cara. La izquierda es el espejo */
const MANO = () => {
  const A = window.__A, THREE = A.THREE;
  const ABIERTA = [[0, 0, 0], [-0.025, 0.025, -0.01], [-0.045, 0.045, -0.015], [-0.06, 0.063, -0.02], [-0.07, 0.082, -0.025],
    [-0.022, 0.085, 0], [-0.025, 0.125, 0], [-0.027, 0.15, 0], [-0.028, 0.172, 0], [0, 0.088, 0], [0, 0.132, 0], [0, 0.16, 0], [0, 0.185, 0],
    [0.02, 0.083, 0], [0.021, 0.122, 0], [0.022, 0.148, 0], [0.023, 0.17, 0], [0.038, 0.074, 0], [0.041, 0.1, 0], [0.043, 0.118, 0], [0.045, 0.135, 0]];
  const PELLIZCO = ABIERTA.map((p) => p.slice());
  Object.assign(PELLIZCO, { 3: [-0.058, 0.09, -0.04], 4: [-0.05, 0.118, -0.058], 6: [-0.03, 0.12, -0.02], 7: [-0.04, 0.135, -0.045], 8: [-0.05, 0.12, -0.06] });
  const cab = () => ({ p: A.motor.camara.position.clone(), q: A.motor.camara.quaternion.clone() });
  /* el hombro, como en manos.js */
  const hombro = (der) => { const { p, q } = cab(), d = new THREE.Vector3(0, 0, -1).applyQuaternion(q), yaw = Math.atan2(-d.x, -d.z); return new THREE.Vector3(p.x + Math.cos(yaw) * (der ? 0.17 : -0.17), p.y - 0.2, p.z - Math.sin(yaw) * (der ? 0.17 : -0.17)); };
  /* la mano armada: pose, lado, dónde (el punto entre pulgar e índice) y hacia dónde apuntan los dedos;
     palma: la palma mira a la cara */
  window.__mano = (der, pose = 'abierta', { mira = null, dir = null, palma = false, mover = [0, 0, 0], ruido = 0 } = {}) => {
    const B = (pose === 'pellizco' ? PELLIZCO : ABIERTA).map(([x, y, z]) => new THREE.Vector3(der ? x : -x, y, z));
    if (palma) for (const v of B) { v.x = -v.x; v.z = -v.z; }   // (media vuelta en y: la palma a la cara)
    const { q } = cab();
    /* los dedos para donde apunta dir (en el mundo); el dorso para la cara */
    const d = (dir || new THREE.Vector3(0, 0, -1).applyQuaternion(q)).clone().normalize();
    const arr = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), d, arr);   // (-z local = d; con el giro de abajo, los dedos van por d y el dorso para arriba)
    const rot = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    for (const v of B) v.applyQuaternion(rot);
    /* que el punto entre pulgar e índice caiga en 'mira' */
    const medio = B[2].clone().add(B[5]).multiplyScalar(0.5);
    const off = mira.clone().sub(medio).add(new THREE.Vector3(...mover));
    const W = new Float32Array(63);
    B.forEach((v, i) => { v.add(off); W[i * 3] = v.x + (Math.random() - 0.5) * ruido; W[i * 3 + 1] = v.y + (Math.random() - 0.5) * ruido; W[i * 3 + 2] = v.z + (Math.random() - 0.5) * ruido; });
    return W;
  };
  /* el punto que apunta a 'objetivo' desde el hombro, a 45 cm */
  window.__apuntar = (der, objetivo, largo = 0.45) => { const h = hombro(der), d = objetivo.clone().sub(h).normalize(); return { mira: h.clone().addScaledVector(d, largo), dir: d }; };
  window.__cab = cab;
  /* un cuadro del juego con las manos que se le pasen (lista de [der, W]) llegando justo antes */
  window.__cuadro = (lista, dibujar = false, dt = 1 / 60) => {
    /* (a 30 por segundo de verdad, como la cámara: sin dibujar, un cuadro por software tarda 3 ms y
       el filtro vería la mano moverse diez veces más rápido de lo que se movió) */
    if (lista.length) { const hasta = (window.__ultCuadro || 0) + 30; while (performance.now() < hasta) { /* espera */ } window.__ultCuadro = performance.now(); }
    /* (con la hora del cuadro que viene: vr.orientar la adelanta ~25 ms; un cuadro dibujado por
       software tarda un segundo y la mano se daría por perdida) */
    const t = (performance.now() + 25) / 1000;
    for (const [der, W] of lista) A.manos.recibirMundo(der, W, t);
    A.paso(dt, dibujar);
  };
};

{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&hora=0.42&calidad=media', { ancho: 1100, alto: 520, movil: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
  await pag.evaluate(MANO);
  await avanzar(pag, 5);
  await pag.evaluate(() => window.__A.J.entrarVR(true, false)); await pag.waitForTimeout(300);
  await pag.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 0, gamma: -90 })));
  await avanzar(pag, 3);
  await pag.evaluate(() => { const A = window.__A; A.manos.activa = true; A.manos.fuente = 'prueba'; A.vr.forzar = 'completo'; });

  /* 1) las dos manos, dibujadas en los dos ojos con dos llamadas */
  const r1 = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, { p, q } = window.__cab();
    const fr = new THREE.Vector3(0, 0, -1).applyQuaternion(q), der = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const mD = p.clone().addScaledVector(fr, 0.38).addScaledVector(der, 0.1).add(new THREE.Vector3(0, -0.08, 0)), mI = p.clone().addScaledVector(fr, 0.38).addScaledVector(der, -0.1).add(new THREE.Vector3(0, -0.08, 0));
    const hacer = () => [[true, window.__mano(true, 'abierta', { mira: mD })], [false, window.__mano(false, 'abierta', { mira: mI })]];
    for (let i = 0; i < 4; i++) window.__cuadro(hacer(), false);
    const R = A.motor.r, gl = R.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const leer = () => { const b = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
    /* sin manos y con manos: cuánto cambia la pantalla (en los dos ojos) */
    A.manos.activa = false; A.paso(0, true); const sin = leer();
    A.manos.activa = true; let llamadas = 0; const orig = A.manos.dibujarOjo.bind(A.manos);
    A.manos.dibujarOjo = (r, ojo) => { const i0 = r.info.render.calls; r.info.autoReset = false; orig(r, ojo); llamadas += r.info.render.calls - i0; r.info.autoReset = true; };
    window.__cuadro(hacer(), true); const con = leer(); A.manos.dibujarOjo = orig;
    let izq = 0, dch = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (Math.abs(con[k] - sin[k]) + Math.abs(con[k + 1] - sin[k + 1]) + Math.abs(con[k + 2] - sin[k + 2]) > 30) { if (x < W / 2) izq++; else dch++; } }
    window.__png = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = x.createImageData(W, H); for (let y = 0; y < H; y++) im.data.set(con.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4); x.putImageData(im, 0, 0); return c.toDataURL('image/png'); };
    /* (lo demás de la escena de las manos que se ve: rayos, cursores; cada cosa es una llamada) */
    let otras = 0; A.manos.escena.traverse((o) => { if ((o.isMesh || o.isSprite) && o.visible && o !== A.manos.prof && o !== A.manos.vidrio && (!o.isInstancedMesh || o.count > 0)) otras++; });
    return { visibles: A.manos.manos.filter((m) => m.visible).length, capsulas: A.manos.geo.instanceCount, izq, dch, llamadas, manosPorOjo: llamadas / 2 - otras };
  });
  fs.writeFileSync(path.join(SAL, 'manos-vr.png'), Buffer.from((await pag.evaluate(() => window.__png())).split(',')[1], 'base64'));
  prueba('las dos manos se ven en los dos ojos (48 cápsulas en 2 llamadas por ojo)', r1.visibles === 2 && r1.capsulas === 48 && r1.izq > 800 && r1.dch > 800 && r1.manosPorOjo === 2, JSON.stringify(r1));

  /* 2) el filtro: quieta con ruido, y moviéndose (fotos a 30 por segundo, se dibuja a 120) */
  const r2 = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, M = A.manos.manos[1], { p, q } = window.__cab();
    const base = p.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(q), 0.4);
    /* quieta: 60 lecturas con ±1,5 mm de ruido */
    const xs = [];
    for (let i = 0; i < 60; i++) { A.manos.recibirMundo(true, window.__mano(true, 'abierta', { mira: base, ruido: 0.003 }), 100 + i / 30); M.adelantar(100 + i / 30, true); if (i > 20) xs.push(M.p[24]); }
    const media = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - media) ** 2, 0) / xs.length);
    /* moviéndose a 1 m/s en x: fotos cada 33 ms; se mira 33 ms después de la última (lo que tarda en llegar) */
    let err = 0, errSin = 0, n = 0;
    for (let i = 0; i < 40; i++) {
      const t = 200 + i / 30, W = window.__mano(true, 'abierta', { mira: base, mover: [t - 200, 0, 0] });
      A.manos.recibirMundo(true, W, t);
      if (i > 10) {
        const ver = t + 1 / 30, real = base.x + (ver - 200); /* (la yema del índice: x de la base más lo movido) */
        const off = W[24] - (base.x + (t - 200));
        M.adelantar(ver, true); err += Math.abs(M.p[24] - off - real);
        M.adelantar(ver, false); errSin += Math.abs(M.p[24] - off - real); n++;
      }
    }
    return { temblorMm: +(sd * 1000).toFixed(2), crudoMm: +(0.003 / Math.sqrt(12) * 1000).toFixed(2), errMm: +(err / n * 1000).toFixed(1), errSinMm: +(errSin / n * 1000).toFixed(1) };
  });
  prueba('quieta con ruido no tiembla (el filtro One Euro)', r2.temblorMm < r2.crudoMm * 0.5, `${r2.temblorMm} mm contra ${r2.crudoMm} mm del ruido`);
  prueba('moviéndose a 1 m/s, la mano dibujada va donde está (se adelanta)', r2.errMm < 12 && r2.errMm < r2.errSinMm * 0.4, `${r2.errMm} mm de error; sin adelantar ${r2.errSinMm} mm`);

  /* 3) el pellizco con histéresis */
  const r3 = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, M = A.manos.manos[1], { p, q } = window.__cab();
    const mira = p.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(q), 0.4).add(new THREE.Vector3(0, 0.25, 0));   // (arriba: sin arco ni nada)
    const est = [];
    for (const pose of ['abierta', 'pellizco', 'pellizco', 'abierta']) { for (let i = 0; i < 8; i++) window.__cuadro([[true, window.__mano(true, pose, { mira })]]); est.push(M.pellizca); }
    return est;
  });
  prueba('el pellizco se prende y se apaga (con histéresis)', JSON.stringify(r3) === '[false,true,true,false]', JSON.stringify(r3));

  /* 4) el rayo apunta el cartel del mapa y el pellizco lo usa (abre la ventana de viajar) */
  const r4 = await pag.evaluate(async () => {
    const A = window.__A, THREE = A.THREE, W = A.reino.mundo;
    const mapa = W.interactivos.find((o) => o.accion === 'viajar');
    if (!mapa) return { error: 'sin mapa' };
    const q0 = typeof mapa.pos === 'function' ? mapa.pos() : mapa.pos;
    /* pararse a 5 m del cartel */
    A.yo.p.set(q0.x + 5, W.altura(q0.x + 5, q0.z) + 0.05, q0.z); A.yo.v.set(0, 0, 0);
    for (let i = 0; i < 6; i++) A.paso(1 / 60, false);
    const it = () => A.manos.objetivo;
    const blanco = () => { const l = [...A.manos.objetivo ? [A.manos.objetivo] : []]; return l; };
    const obj = new THREE.Vector3(q0.x, (q0.y ?? W.altura(q0.x, q0.z)) + (q0.y == null ? 1 : 0.4), q0.z);
    for (let i = 0; i < 6; i++) { const a = window.__apuntar(true, obj); window.__cuadro([[true, window.__mano(true, 'abierta', a)]]); }
    const apunta = it()?.o === mapa, cartel = A.manos.cartel.visible;
    for (let i = 0; i < 6; i++) { const a = window.__apuntar(true, obj); window.__cuadro([[true, window.__mano(true, 'pellizco', a)]]); }
    return { apunta, cartel, ventana: !!A.UI.ventanaAbierta, vrSalio: !A.vr.activo, era: A.manos.objetivo?.o.accion ?? null, vis: A.manos.manos[1].visible, vr: A.vr.activo };
  });
  prueba('el rayo apunta lo que se puede usar (con su cartel) y el pellizco lo usa', r4.apunta && r4.cartel && r4.ventana, JSON.stringify(r4));
  await pag.evaluate(() => { window.__A.UI.cerrarVentana(); });
  await pag.evaluate(() => window.__A.J.entrarVR(true, false)); await pag.waitForTimeout(300);
  await pag.evaluate(() => { const A = window.__A; A.manos.activa = true; A.manos.fuente = 'prueba'; A.vr.forzar = 'completo'; });
  await avanzar(pag, 2);

  /* 5) el arco al piso y soltar el pellizco: salta ahí, con parpadeo */
  const r5 = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, W = A.reino.mundo;
    /* un lugar libre con 6 m de piso adelante */
    const yaw = A.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    for (let r = 0; r < 120; r += 4) for (let k = 0; k < 16; k++) {
      const x = A.yo.p.x + Math.cos(k / 16 * 6.28) * r, z = A.yo.p.z + Math.sin(k / 16 * 6.28) * r;
      let ok = true; for (let d = 0; d <= 7 && ok; d += 0.5) { const px = x + fx * d, pz = z + fz * d, y = W.altura(px, pz); if (W.cercano({ x: px, y, z: pz }) || W.cerca(px, pz).some((s) => W.dentro(s, px, pz, 0.8) && s.y1 > y + 0.4) || (W.agua != null && y < W.agua + 0.3)) ok = false; }
      if (ok) { A.yo.p.set(x, W.altura(x, z) + 0.05, z); A.yo.v.set(0, 0, 0); r = 999; break; }
    }
    for (let i = 0; i < 10; i++) A.paso(1 / 60, false);
    const p0 = A.yo.p.clone(), cp = A.motor.camara.position;
    const destino = new THREE.Vector3(p0.x + fx * 4, 0, p0.z + fz * 4); destino.y = W.altura(destino.x, destino.z);
    /* apuntar hacia abajo y adelante: el arco cae cerca de los 4 m */
    const dir = new THREE.Vector3(fx, -0.35, fz).normalize();
    let aro = false, fundido = 0;
    const a = window.__apuntar(true, cp.clone().addScaledVector(dir, 4)); a.dir = dir;
    for (let i = 0; i < 6; i++) window.__cuadro([[true, window.__mano(true, 'abierta', a)]]);
    aro = A.manos.aro.visible; const donde = A.manos.salto?.p.clone();
    for (let i = 0; i < 6; i++) window.__cuadro([[true, window.__mano(true, 'pellizco', a)]]);
    for (let i = 0; i < 8; i++) { window.__cuadro([[true, window.__mano(true, 'abierta', a)]]); fundido = Math.max(fundido, A.motor.pFinal.uniforms.uFundido.value); }
    const movido = A.yo.p.clone().sub(p0); movido.y = 0;
    return { aro, cae: donde ? +Math.hypot(donde.x - p0.x, donde.z - p0.z).toFixed(2) : null, movio: +movido.length().toFixed(2), alDestino: donde ? +Math.hypot(A.yo.p.x - donde.x, A.yo.p.z - donde.z).toFixed(2) : null, fundido: +fundido.toFixed(2) };
  });
  prueba('apuntando al piso sale el arco; al soltar el pellizco salta ahí, con parpadeo', r5.aro && r5.cae > 1.5 && r5.movio > 1.5 && r5.alDestino < 0.6 && r5.fundido > 0.3, JSON.stringify(r5));

  /* 6) los dos pellizcos a la vez: salto */
  const r6 = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, { p, q } = window.__cab(), fr = new THREE.Vector3(0, 0, -1).applyQuaternion(q), de = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const arriba = new THREE.Vector3(0, 0.3, 0);
    const mD = p.clone().addScaledVector(fr, 0.38).addScaledVector(de, 0.12).add(arriba), mI = p.clone().addScaledVector(fr, 0.38).addScaledVector(de, -0.12).add(arriba);
    for (let i = 0; i < 5; i++) window.__cuadro([[true, window.__mano(true, 'abierta', { mira: mD })], [false, window.__mano(false, 'abierta', { mira: mI })]]);
    const y0 = A.yo.p.y; let sube = 0;
    for (let i = 0; i < 14; i++) { window.__cuadro([[true, window.__mano(true, 'pellizco', { mira: mD })], [false, window.__mano(false, 'pellizco', { mira: mI })]], false, 1 / 30); sube = Math.max(sube, A.yo.p.y - y0); }
    for (let i = 0; i < 30; i++) window.__cuadro([], false, 1 / 30);
    return { sube: +sube.toFixed(2), vr: A.vr.activo, ventana: !!A.UI.ventanaAbierta };
  });
  prueba('los dos pellizcos a la vez saltan (y no usan nada)', r6.sube > 0.4 && r6.vr && !r6.ventana, JSON.stringify(r6));

  /* 7) el menú: la palma a la cara y un pellizco; se toca con la yema de la otra mano (girar) y con
     el rayo (cuadros por segundo); salir sale */
  if (!(await pag.evaluate(() => window.__A.vr.activo))) { await pag.evaluate(() => { window.__A.UI.cerrarVentana(); window.__A.J.entrarVR(true, false); }); await pag.waitForTimeout(300); await pag.evaluate(() => { const A = window.__A; A.manos.activa = true; A.manos.fuente = 'prueba'; }); await avanzar(pag, 2); }
  const r7 = await pag.evaluate(async () => {
    const espera = () => new Promise((ok) => setTimeout(ok, 33));   // (fotos a 30 por segundo, como la cámara)
    const A = window.__A, THREE = A.THREE, { p, q } = window.__cab(), fr = new THREE.Vector3(0, 0, -1).applyQuaternion(q), de = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const mI = p.clone().addScaledVector(fr, 0.3).addScaledVector(de, -0.08).add(new THREE.Vector3(0, -0.05, 0));
    /* (se bajaron las manos: fuera de la cámara) */
    A.manos.perder(true); A.manos.perder(false);
    const act0 = A.manos.actualizar.bind(A.manos); window.__evs = []; A.manos.actualizar = (...x) => { const e = act0(...x); if (e.length) window.__evs.push(e.map((q) => q.tipo + (q.accion ? ':' + q.accion : '')).join(',') + '@' + A.yo.p.y.toFixed(2)); return e; };
    const palma = (pose) => [false, window.__mano(false, pose, { mira: mI, palma: true, dir: new THREE.Vector3(0, 1, 0).addScaledVector(fr, 0.35) })];
    for (let i = 0; i < 5; i++) window.__cuadro([palma('abierta')]);
    const boton = A.manos.boton.visible; window.__dbg = { vr: A.vr.activo, act: A.manos.activa, vis: A.manos.manos[0].visible, cara: A.manos.manos[0].aLaCara, menu: A.manos.menu.abierto };
    for (let i = 0; i < 5; i++) window.__cuadro([palma('pellizco')]);
    for (let i = 0; i < 5; i++) window.__cuadro([palma('abierta')]);
    const abierto = A.manos.menu.abierto;
    /* la yema del índice derecho: el centro del botón "Girar ⟳" (el tercero), de adelante para atrás */
    const Mn = A.manos.menu, [bx, by, bw, bh] = Mn.cajas[2];
    const enMenu = (dz) => new THREE.Vector3((bx + bw / 2) / 512 * 0.34 - 0.17, 0.1 - (by + bh / 2) / 300 * 0.2, dz).applyMatrix4(Mn.malla.matrixWorld);
    const base0 = A.vr.base;
    for (const dz of [0.05, 0.04, 0.03, 0.02, 0.01, 0.0, -0.01, -0.02]) {
      await espera();
      const W = window.__mano(true, 'abierta', { mira: new THREE.Vector3() }), yema = new THREE.Vector3(W[24], W[25], W[26]), d = enMenu(dz).sub(yema);
      for (let i = 0; i < 21; i++) { W[i * 3] += d.x; W[i * 3 + 1] += d.y; W[i * 3 + 2] += d.z; }
      window.__cuadro([[true, W]]);
      (window.__toques ||= []).push(JSON.stringify({ ...Mn.enPunto(A.manos.manos[1].punto(8)), vis: A.manos.manos[1].visible, abierto: Mn.abierto }));
    }
    const giro = +((A.vr.base - base0) * 180 / Math.PI).toFixed(1);
    window.__dbg.toques = window.__toques;
    /* el rayo al botón FPS (el cuarto) y pellizco */
    const [fx, fy, fw, fh] = Mn.cajas[3], blanco = new THREE.Vector3((fx + fw / 2) / 512 * 0.34 - 0.17, 0.1 - (fy + fh / 2) / 300 * 0.2, 0).applyMatrix4(Mn.malla.matrixWorld);
    Mn.abierto || Mn.abrir(p, q);
    const fps0 = A.vr.verFps;
    /* (la mano cerca del cuerpo, a 20 cm del hombro: si no, la yema toca el menú y es un toque) */
    for (let i = 0; i < 6; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, blanco, 0.1))]]);
    const sobre = Mn.sobre; const Md = A.manos.manos[1]; window.__dbg.rayo = { evs: window.__evs.slice(), cab0: p.toArray().map((v) => +v.toFixed(2)), cab: A.motor.camara.position.toArray().map((v) => +v.toFixed(2)), menu: Mn.malla.position.toArray().map((v) => +v.toFixed(2)), blanco: blanco.toArray().map((v) => +v.toFixed(2)), o: Md.rayoO.toArray().map((v) => +v.toFixed(2)), d: Md.rayoD.toArray().map((v) => +v.toFixed(2)), vis: Md.visible, r: (() => { const x = Mn.enRayo(Md.rayoO, Md.rayoD); return x ? { i: x.i, k: +x.k.toFixed(2) } : null; })(), yema: Mn.enPunto(Md.punto(8)) };
    for (let i = 0; i < 5; i++) window.__cuadro([[true, window.__mano(true, 'pellizco', window.__apuntar(true, blanco, 0.1))]]);
    for (let i = 0; i < 4; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, blanco, 0.1))]]);
    const fps1 = A.vr.verFps, clase = A.vr.el?.classList.contains('con-fps');
    /* salir */
    Mn.abierto || Mn.abrir(p, q);
    const [sx, sy, sw, sh] = Mn.cajas[4], bs = new THREE.Vector3((sx + sw / 2) / 512 * 0.34 - 0.17, 0.1 - (sy + sh / 2) / 300 * 0.2, 0).applyMatrix4(Mn.malla.matrixWorld);
    for (let i = 0; i < 5; i++) window.__cuadro([[true, window.__mano(true, 'abierta', window.__apuntar(true, bs, 0.1))]]);
    for (let i = 0; i < 5; i++) window.__cuadro([[true, window.__mano(true, 'pellizco', window.__apuntar(true, bs, 0.1))]]);
    return { boton, abierto, giro, sobre, fps: [fps0, fps1, clase], salio: !A.vr.activo, dbg: window.__dbg };
  });
  prueba('la palma a la cara muestra el botón y un pellizco abre el menú', r7.boton && r7.abierto, JSON.stringify(r7));
  prueba('en el menú, la yema aprieta "Girar ⟳" (45°)', Math.abs(r7.giro + 45) < 0.5, `${r7.giro}°`);
  prueba('y el rayo con pellizco prende los cuadros por segundo; "Salir" sale del VR', r7.sobre === 3 && !r7.fps[0] && r7.fps[1] && r7.fps[2] && r7.salio, JSON.stringify(r7));

  /* 8) la yema revienta una burbuja */
  await pag.evaluate(() => window.__A.J.entrarVR(true, false)); await pag.waitForTimeout(300);
  await pag.evaluate(() => { const A = window.__A; A.manos.activa = true; A.manos.fuente = 'prueba'; });
  const r8 = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, B = A.reino.burbujas; if (!B) return { error: 'sin burbujas' };
    /* ir al lado de una burbuja grande y ponerle la yema adentro */
    for (let i = 0; i < 3; i++) A.paso(1 / 60, false);
    const b = B.b.slice(0, B.im.count).find((x) => x.ps > 0.3 && x.px != null); if (!b) return { error: 'sin burbuja grande' };
    A.yo.p.set(b.px + 1.5, A.reino.mundo.altura(b.px + 1.5, b.pz) + 0.05, b.pz); A.yo.v.set(0, 0, 0);   // (lejos para que el cuerpo no la reviente)
    let pops = 0; const sfx = A.J.sfx; A.J.sfx = (n, o) => { if (n === 'pop') pops++; return sfx(n, o); };
    A.paso(1 / 60, false);
    const blanco = new THREE.Vector3(b.px, b.y, b.pz);
    const W = window.__mano(true, 'abierta', { mira: new THREE.Vector3() }), d = blanco.clone().sub(new THREE.Vector3(W[24], W[25], W[26]));
    for (let i = 0; i < 21; i++) { W[i * 3] += d.x; W[i * 3 + 1] += d.y; W[i * 3 + 2] += d.z; }
    /* (se pone justo antes de actualizar: la burbuja sube un poquito por cuadro) */
    window.__cuadro([[true, W]], false, 1 / 1000);
    A.J.sfx = sfx;
    return { pops, nueva: b.px === null || b.y < 1 };
  });
  prueba('la yema del índice revienta una burbuja', r8.pops >= 1, JSON.stringify(r8));

  /* 9) cuánto cuesta: actualizar las dos manos (sin MediaPipe, que va aparte) */
  const r9 = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, { p, q } = window.__cab(), fr = new THREE.Vector3(0, 0, -1).applyQuaternion(q), de = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const lista = [[true, window.__mano(true, 'abierta', { mira: p.clone().addScaledVector(fr, 0.4).addScaledVector(de, 0.1) })], [false, window.__mano(false, 'abierta', { mira: p.clone().addScaledVector(fr, 0.4).addScaledVector(de, -0.1) })]];
    let ms = 0; for (let i = 0; i < 60; i++) { const t = (performance.now() + 25) / 1000; for (const [d, W] of lista) A.manos.recibirMundo(d, W, t); A.paso(1 / 60, false); ms += A.manos.stats.msActualizar; }
    return +(ms / 60).toFixed(3);
  });
  prueba('actualizar las dos manos (filtro, gestos, rayos, cápsulas) cuesta menos de medio milisegundo', r9 < 0.5, `${r9} ms por cuadro`);
  prueba('sin errores', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------ MediaPipe de verdad (en su worker) con las fotos */
{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { manos: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino, null, { timeout: 120000, polling: 250 });
  const fotos = Object.fromEntries(['manos-abiertas', 'mano-pellizco', 'mano-palma'].map((n) => [n, 'data:image/jpeg;base64,' + fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'manos', n + '.jpg')).toString('base64')]));
  const r = await pag.evaluate(async (fotos) => {
    const A = window.__A, out = {};
    const mc = new A.ManosCamara({ alLlegar: (m) => { window.__ult = m; } });
    const t0 = performance.now();
    try { out.delegado = await mc.iniciarRed({ delegado: 'CPU' }); } catch (e) { return { error: e.message }; }
    out.cargaMs = Math.round(performance.now() - t0);
    for (const [n, u] of Object.entries(fotos)) {
      const im = new Image(); im.src = u; await im.decode();
      let m = null;
      for (let k = 0; k < 2; k++) { window.__ult = null; await mc.probar(im, performance.now()); const t1 = performance.now(); while (!window.__ult && performance.now() - t1 < 20000) await new Promise((ok) => setTimeout(ok, 20)); m = window.__ult; }
      out[n] = (m || []).map((h) => {
        const I = h.img, P = h.puntos, e2 = Math.hypot(I[0] - I[27], I[1] - I[28]), e3 = Math.hypot(P[0] - P[27], P[1] - P[28], P[2] - P[29]);
        const pell = Math.max(Math.hypot(I[12] - I[24], I[13] - I[25]) / e2, Math.hypot(P[12] - P[24], P[13] - P[25], P[14] - P[26]) / e3 * 0.62);
        return { derecha: h.derecha, x: +P[0].toFixed(3), dist: +(-P[2]).toFixed(2), palma: +e3.toFixed(3), pell: +pell.toFixed(2) };
      });
    }
    out.msRed = +mc.stats.ms.toFixed(0);
    return out;
  }, fotos);
  const [a, b] = (r['manos-abiertas'] || []).slice().sort((x, y) => x.x - y.x);
  prueba('MediaPipe carga en su worker (sin trabar el juego)', !r.error && !!r.delegado, `${r.delegado} · ${r.cargaMs} ms · ${r.msRed} ms por foto en este contenedor`);
  prueba('las dos manos abiertas: la de la izquierda es la izquierda, a 20-45 cm, de tamaño de mano', !!a && !!b && a.derecha === false && b.derecha === true && [a, b].every((h) => h.dist > 0.2 && h.dist < 0.45 && h.palma > 0.06 && h.palma < 0.12 && h.pell > 0.46), JSON.stringify(r['manos-abiertas']));
  prueba('el pellizco de la foto se reconoce como pellizco', r['mano-pellizco']?.length === 1 && r['mano-pellizco'][0].pell < 0.3, JSON.stringify(r['mano-pellizco']));
  prueba('la palma de frente: una mano abierta', r['mano-palma']?.length === 1 && r['mano-palma'][0].pell > 0.46, JSON.stringify(r['mano-palma']));
  prueba('sin errores (MediaPipe)', !errores.some((e) => !/ERR_FAILED|INFO: Created TensorFlow/.test(e)), errores.filter((e) => !/ERR_FAILED|INFO: Created/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
