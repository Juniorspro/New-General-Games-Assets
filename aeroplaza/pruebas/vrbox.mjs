// EL MANDO VR BOX (vuelta 44): mando-box.js, entrada.js y MandoBox.java.
// - Java (MandoBox.java con javac): qué tecla es qué botón en los modos juego y música, y la palanca;
// - el juego, con el mando llegando como desde la APK (window.__nativo.mandoBoton / mandoEje):
//   afuera del VR la palanca camina; en el VR la APK toma el volumen (mandoVR) y lo suelta al salir;
//   la palanca camina para donde se mira, el volumen + del modo música también; los temas giran 45°;
//   B salta; el gatillo aprieta lo que se mira (y no se pone a caminar); en el tiro dispara;
//   start abre la pausa adentro del VR (el espejo) y la cierra; la pausa ofrece salir del VR;
// - por la Gamepad API (el navegador): la palanca camina y el botón 0 usa (no salta);
// - la ventana del mando: cambiar qué botón salta apretándolo, y "como venía".
//     node pruebas/vrbox.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { navegador, abrir, avanzar, AQUI, SAL } from './comun.mjs';
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const RAIZ = path.join(AQUI, '..');

/* 1) Java */
let hayJava = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch { hayJava = false; }
if (hayJava) {
  const CL = path.join(SAL, 'mando-clases'); fs.rmSync(CL, { recursive: true, force: true }); fs.mkdirSync(CL, { recursive: true });
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', CL, path.join(RAIZ, 'android/app/src/main/java/ar/aeroplaza/MandoBox.java'), path.join(AQUI, 'mando/PruebaMando.java')], { stdio: ['ignore', 'ignore', 'inherit'] });
  let sal = '';
  try { sal = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', CL, 'ar.aeroplaza.PruebaMando'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { sal = String(e.stdout || ''); }
  for (const l of sal.split('\n')) { if (/^✓/.test(l)) { bien++; console.log(l); } else if (/^✗/.test(l)) { mal++; console.log(l); } }
} else console.log('(sin javac: la parte de Java no corre)');

/* 2) el juego, con el mando de la APK */
const nav = await navegador();
const { pag, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
await pag.addInitScript(() => {
  window.__llamadas = [];
  window.AeroplazaNativo = { version: () => '1', arEstado: () => 'no', arParar() {}, flash() {}, vibrar() {}, mandos: () => 'VR BOX', mandoVR: (si) => window.__llamadas.push(['mandoVR', si]) };
});
await pag.reload();
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5, 1 / 30, false);
/* lo que usan todas: pasos, apretar y soltar un botón (entre dos cuadros), la palanca, y un lugar libre adelante */
await pag.evaluate(() => {
  const A = window.__A, THREE = A.THREE;
  window.__T = {
    pasos(n) { for (let i = 0; i < n; i++) A.paso(1 / 30, false); },
    toque(b) { window.__nativo.mandoBoton(b, 1); window.__nativo.mandoBoton(b, 0); A.paso(1 / 30, false); },
    palanca(x, y, n) { window.__nativo.mandoEje(x, y); this.pasos(n); window.__nativo.mandoEje(0, 0); this.pasos(2); },
    frente() { const v = new THREE.Vector3(0, 0, -1).applyQuaternion(A.motor.camara.quaternion); v.y = 0; return v.normalize(); },
    libre() {
      const W = A.reino.mundo, yaw = A.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      for (let r = 8; r < 120; r += 4) for (let k = 0; k < 16; k++) {
        const x = A.yo.p.x + Math.cos(k / 16 * 6.28) * r, z = A.yo.p.z + Math.sin(k / 16 * 6.28) * r;
        let ok = true; for (let d = 0; d <= 10 && ok; d += 1) { const px = x + fx * d, pz = z + fz * d, y = W.altura(px, pz); if (W.cercano({ x: px, y, z: pz }) || W.cerca(px, pz).some((s) => W.dentro(s, px, pz, 0.8) && s.y1 > y + 0.4) || (W.agua != null && y < W.agua + 0.3)) ok = false; }
        if (ok) { A.yo.p.set(x, W.altura(x, z) + 0.05, z); A.yo.v.set(0, 0, 0); return true; }
      }
      return false;
    },
  };
});
const giro = (a, b, g) => pag.evaluate(([a, b, g]) => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g })), [a, b, g]);

/* afuera del VR: la palanca camina (el juego de siempre, ahora también con el mando de la APK) */
const r0 = await pag.evaluate(() => { const A = window.__A, T = window.__T; T.libre(); T.pasos(6); const p0 = A.yo.p.clone(); T.palanca(0, -1, 30); return +Math.hypot(A.yo.p.x - p0.x, A.yo.p.z - p0.z).toFixed(2); });
prueba('afuera del VR, la palanca del mando de la APK camina', r0 > 1.5, `${r0} m en 1 s`);

/* al VR */
await pag.evaluate(() => window.__A.J.entrarVR(true, false)); await pag.waitForTimeout(300);
await giro(0, 0, -90); await avanzar(pag, 3, 1 / 30, false);
const r1 = await pag.evaluate(() => { const A = window.__A, T = window.__T; T.libre(); T.pasos(6); return { vr: A.vr.activo, tomado: window.__llamadas.filter((l) => l[0] === 'mandoVR').map((l) => l[1]).join() }; });
prueba('al entrar al VR la APK toma el volumen y los temas del mando (mandoVR)', r1.vr && r1.tomado === 'true', JSON.stringify(r1));

const r2 = await pag.evaluate(() => {
  const A = window.__A, T = window.__T, f = T.frente(), p0 = A.yo.p.clone();
  T.palanca(0, -1, 30);
  const d = A.yo.p.clone().sub(p0); d.y = 0; const largo = d.length();
  const palanca = { largo: +largo.toFixed(2), adelante: +(largo ? d.normalize().dot(f) : 0).toFixed(2), camina: A.vr.camina };
  /* el volumen + del modo música: camina mientras se sostiene */
  T.libre(); T.pasos(4); const p1 = A.yo.p.clone();
  window.__nativo.mandoBoton(20, 1); T.pasos(30); const sost = +Math.hypot(A.yo.p.x - p1.x, A.yo.p.z - p1.z).toFixed(2);
  window.__nativo.mandoBoton(20, 0); T.pasos(10); const p2 = A.yo.p.clone(); T.pasos(15);
  return { palanca, sost, suelta: +Math.hypot(A.yo.p.x - p2.x, A.yo.p.z - p2.z).toFixed(2) };
});
prueba('en el VR la palanca camina para donde se mira', r2.palanca.largo > 1.5 && r2.palanca.adelante > 0.9 && !r2.palanca.camina, JSON.stringify(r2.palanca));
prueba('el volumen + (modo música) camina mientras se sostiene, y al soltar frena', r2.sost > 1.5 && r2.suelta < 0.1, JSON.stringify(r2));

const r3 = await pag.evaluate(() => {
  const A = window.__A, T = window.__T, yaw = () => A.cam.yaw * 180 / Math.PI, dif = (a, b) => ((a - b + 540) % 360) - 180;
  const y0 = yaw(); T.toque(23); T.pasos(3); const y1 = yaw(); T.toque(22); T.pasos(3); const y2 = yaw();
  /* B salta */
  T.libre(); T.pasos(10); const h0 = A.yo.p.y; let sube = 0; T.toque(1); for (let i = 0; i < 12; i++) { A.paso(1 / 30, false); sube = Math.max(sube, A.yo.p.y - h0); }
  return { der: +dif(y1, y0).toFixed(1), izq: +dif(y2, y1).toFixed(1), sube: +sube.toFixed(2) };
});
prueba('tema siguiente gira 45° a la derecha y el anterior vuelve', Math.abs(r3.der + 45) < 2 && Math.abs(r3.izq - 45) < 2, JSON.stringify(r3));
prueba('B salta', r3.sube > 0.3, `${r3.sube} m`);

/* el gatillo aprieta lo que se mira (el espejo), sin ponerse a caminar */
const r4 = await pag.evaluate(() => {
  const A = window.__A, T = window.__T, THREE = A.THREE, cam = A.motor.camara; window.__apretados = [];
  const c = document.createElement('div'); c.innerHTML = '<p>Probá el mando.</p><button class="boton" id="m1">Uno</button><button class="boton" id="m2">Dos</button>';
  c.querySelectorAll('button').forEach((b) => { b.onclick = () => window.__apretados.push(b.id); });
  A.UI.ventana('Mando', c); T.pasos(10);
  const qM = new THREE.Quaternion(), m4 = new THREE.Matrix4(), ARR = new THREE.Vector3(0, 1, 0);
  const centro = (P, b) => { P.malla.updateMatrixWorld(true); return new THREE.Vector3((b.x + b.w / 2) / P.W * P.ancho - P.ancho / 2, P.alto / 2 - (b.y + b.h / 2) / P.H * P.alto, 0).applyMatrix4(P.malla.matrixWorld); };
  A.vr.orientacion = () => qM;
  const mirar = (n) => { for (let i = 0; i < n; i++) { const P = A.espejo.panel, b = P.botones.find((x) => x.texto === 'Dos'); m4.lookAt(cam.position, centro(P, b), ARR); qM.setFromRotationMatrix(m4); A.paso(1 / 30, false); } };
  mirar(6); T.toque(0); mirar(3);
  delete A.vr.orientacion;
  const o = { apretados: window.__apretados.join(','), camina: A.vr.camina, abierta: !!A.UI.ventanaAbierta };
  A.UI.cerrarVentana(); T.pasos(3);
  return o;
});
prueba('el gatillo (A) aprieta el botón que se mira en el espejo, y no se pone a caminar', r4.apretados === 'm2' && !r4.camina, JSON.stringify(r4));

/* start: la pausa adentro del VR, y otra vez la cierra; en la pausa, salir del VR */
const r5 = await pag.evaluate(() => {
  const A = window.__A, T = window.__T;
  T.toque(9); T.pasos(8);
  const abierta = { vr: A.vr.activo, pausa: !!document.querySelector('.pausa-menu'), espejo: A.espejo.abierto, salir: document.querySelector('.pausa-menu [data-a=vr]')?.textContent || '' };
  T.toque(9); T.pasos(4);
  return { abierta, cerro: !document.querySelector('.pausa-menu') && !A.espejo.abierto && A.vr.activo };
});
prueba('start abre la pausa adentro del VR (en el espejo) y otra vez la cierra', r5.abierta.vr && r5.abierta.pausa && r5.abierta.espejo && r5.cerro, JSON.stringify(r5));
prueba('en el VR la pausa ofrece salir del VR', /Salir del VR/.test(r5.abierta.salir), r5.abierta.salir);

/* en el tiro, el gatillo dispara para donde se mira */
await pag.evaluate(() => window.__A.viajar('tiro')); await pag.waitForTimeout(1600);
const r6 = await pag.evaluate(() => {
  const A = window.__A, T = window.__T; T.pasos(4); A.reino.tiro.fase = 'juega';
  const tiros = []; const acc0 = A.red.accion.bind(A.red); A.red.accion = (o) => { if (o.type === 'disparo') tiros.push(o); return acc0(o); };
  T.toque(0); T.pasos(2); A.red.accion = acc0;
  return { tiros: tiros.length, vr: A.vr.activo };
});
prueba('en el tiro, el gatillo dispara', r6.tiros === 1 && r6.vr, JSON.stringify(r6));
await pag.evaluate(() => window.__A.viajar('plaza')); await pag.waitForTimeout(1600);

/* la pausa: salir del VR suelta el volumen */
const r7 = await pag.evaluate(() => {
  const A = window.__A, T = window.__T; T.pasos(4); T.toque(9); T.pasos(4);
  document.querySelector('.pausa-menu [data-a=vr]').click(); T.pasos(3);
  return { vr: A.vr.activo, soltado: window.__llamadas.filter((l) => l[0] === 'mandoVR').map((l) => l[1]).join(), pausa: !!document.querySelector('.pausa-menu') };
});
prueba('"Salir del VR" de la pausa sale, y la APK suelta el volumen', !r7.vr && !r7.pausa && r7.soltado === 'true,false', JSON.stringify(r7));

/* la ventana del mando: cambiar qué botón salta (apretándolo) y "como venía" */
const r8 = await pag.evaluate(async () => {
  const A = window.__A, T = window.__T, espera = (ms) => new Promise((r) => setTimeout(r, ms));
  A.UI.menuVR(); await espera(50);
  const boton = document.querySelector('.vr-mando-boton'), nombre = boton?.querySelector('small')?.textContent;
  boton.click(); await espera(80);
  const fila = () => document.querySelector('.mb-fila[data-accion=saltar]');
  const antes = fila().querySelector('.mb-cual').textContent, quien = document.querySelector('.mb-quien').textContent;
  fila().querySelector('.mb-cambiar').click(); await espera(30);
  const espera1 = fila().classList.contains('espera');
  T.toque(3); await espera(30);
  const despues = fila().querySelector('.mb-cual').textContent, guardado = JSON.stringify(A.G.opciones.vrBox);
  return { nombre, quien, antes, espera1, despues, guardado };
});
prueba('el menú del VR muestra el mando conectado y su ventana lo nombra', r8.nombre === 'VR BOX' && /VR BOX/.test(r8.quien), JSON.stringify(r8));
prueba('"Cambiar" y apretar Y: saltar pasa a Y, se guarda, y girar ⟳ se queda con el tema siguiente', r8.antes === 'B · L1 · L2' && r8.espera1 && r8.despues === 'Y/D' && JSON.parse(r8.guardado).saltar.join() === '3' && JSON.parse(r8.guardado).der.join() === '23', JSON.stringify(r8));
/* en el VR, ahora Y salta (y ya no gira) */
await pag.evaluate(() => { window.__A.UI.cerrarVentana(); window.__A.J.entrarVR(true, false); }); await pag.waitForTimeout(300);
await giro(0, 0, -90); await avanzar(pag, 3, 1 / 30, false);
const r9 = await pag.evaluate(async () => {
  const A = window.__A, T = window.__T; T.libre(); T.pasos(10);
  const b0 = A.vr.base, h0 = A.yo.p.y; let sube = 0; T.toque(3); for (let i = 0; i < 12; i++) { A.paso(1 / 30, false); sube = Math.max(sube, A.yo.p.y - h0); }
  const o = { sube: +sube.toFixed(2), giro: +((A.vr.base - b0) * 180 / Math.PI).toFixed(1) };
  A.vr.salir(); A.UI.menuVR(); await new Promise((r) => setTimeout(r, 50)); document.querySelector('.vr-mando-boton').click(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.mb-fabrica').click(); o.fabrica = A.G.opciones.vrBox === undefined && document.querySelector('.mb-fila[data-accion=saltar] .mb-cual').textContent === 'B · L1 · L2';
  A.UI.cerrarVentana();
  return o;
});
prueba('en el VR, Y ahora salta y no gira; "Como venía" vuelve a B', r9.sube > 0.3 && r9.giro === 0 && r9.fabrica, JSON.stringify(r9));
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));

/* 3) por la Gamepad API (el navegador, sin APK) */
{
  const { pag: p2, errores: e2 } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
  await p2.addInitScript(() => {
    window.__pad = { id: 'VR BOX (Vendor: 1234)', connected: true, index: 0, mapping: '', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
  });
  await p2.reload();
  await p2.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
  await avanzar(p2, 5, 1 / 30, false);
  await p2.evaluate(() => window.__A.J.entrarVR(true, false)); await p2.waitForTimeout(300);
  await p2.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 0, gamma: -90 })));
  await avanzar(p2, 3, 1 / 30, false);
  const g = await p2.evaluate(() => {
    const A = window.__A, P = window.__pad, pasos = (n) => { for (let i = 0; i < n; i++) A.paso(1 / 30, false); };
    /* un lugar libre (como vr.mjs) */
    const W = A.reino.mundo, yaw = A.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    busca: for (let r = 8; r < 120; r += 4) for (let k = 0; k < 16; k++) {
      const x = A.yo.p.x + Math.cos(k / 16 * 6.28) * r, z = A.yo.p.z + Math.sin(k / 16 * 6.28) * r;
      let ok = true; for (let d = 0; d <= 10 && ok; d += 1) { const px = x + fx * d, pz = z + fz * d, y = W.altura(px, pz); if (W.cercano({ x: px, y, z: pz }) || W.cerca(px, pz).some((s) => W.dentro(s, px, pz, 0.8) && s.y1 > y + 0.4) || (W.agua != null && y < W.agua + 0.3)) ok = false; }
      if (ok) { A.yo.p.set(x, W.altura(x, z) + 0.05, z); A.yo.v.set(0, 0, 0); break busca; }
    }
    pasos(6); const p0 = A.yo.p.clone();
    P.axes = [0, -1, 0, 0]; pasos(30); P.axes = [0, 0, 0, 0]; pasos(2);
    const anduvo = +Math.hypot(A.yo.p.x - p0.x, A.yo.p.z - p0.z).toFixed(2);
    /* el botón 0: usa (un toque), no salta */
    pasos(10); const h0 = A.yo.p.y; let sube = 0, toque = false;
    const vr = A.vr; let visto = false; const e0 = vr.entrada.bind(vr); vr.entrada = (E, dt, h) => { if (vr.toque) visto = true; return e0(E, dt, h); };
    P.buttons[0] = { pressed: true, value: 1 }; A.paso(1 / 30, false); P.buttons[0] = { pressed: false, value: 0 };
    for (let i = 0; i < 12; i++) { A.paso(1 / 30, false); sube = Math.max(sube, A.yo.p.y - h0); }
    vr.entrada = e0; toque = visto;
    return { anduvo, sube: +sube.toFixed(2), toque };
  });
  prueba('por la Gamepad API, en el VR la palanca camina', g.anduvo > 1.5, `${g.anduvo} m`);
  prueba('y el botón 0 es "usar" (un toque), no saltar', g.toque && g.sube < 0.05, JSON.stringify(g));
  const errs = e2.filter((e) => !/ERR_FAILED/.test(e));
  prueba('sin errores (Gamepad API)', !errs.length, errs.slice(0, 3).join(' | '));
}
await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
