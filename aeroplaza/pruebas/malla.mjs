// LA MALLA DEL CUARTO (vuelta 35), de punta a punta:
// 1) Java (android/…/Malla.java) con un cuarto de mentira (pruebas/malla/PruebaMalla.java): precisa, llena lo que
//    no ve, borra lo que se fue, no reescanea lo hecho, rápida. Guarda cada bloque como lo manda Espacio.java.
// 2) El juego (js/espacio.js) con esos bloques, como llegarían del celu (__nativo.malla y /malla/<bloque>.bin):
//    - los baja y los junta en trozos (pocas mallas de three: pocos dibujos);
//    - se dibuja (la pared y el piso del cuarto de mentira se ven), con sus cuadrados;
//    - la tarjeta dice cuántos cuadrados y cuánto está listo (hecho);
//    - al terminar de escanear se va, y "escanear de nuevo" la borra.
//     node pruebas/malla.mjs   (sin javac, la parte 1 no corre y la 2 usa lo último que se guardó)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI);
const DIR = path.join(SAL, 'malla'), CLASES = path.join(SAL, 'malla-clases');

/* 1) Java */
let hayJava = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch { hayJava = false; }
if (hayJava) {
  fs.rmSync(CLASES, { recursive: true, force: true }); fs.mkdirSync(CLASES, { recursive: true });
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', CLASES, path.join(RAIZ, 'android/app/src/main/java/ar/aeroplaza/Malla.java'), path.join(AQUI, 'malla/PruebaMalla.java')], { stdio: 'inherit' });
  let sal = '';
  try { sal = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', CLASES, 'ar.aeroplaza.PruebaMalla', DIR], { encoding: 'utf8' }); } catch (e) { sal = String(e.stdout || ''); }
  for (const l of sal.split('\n')) {
    if (/^✓/.test(l)) { bien++; console.log(l); } else if (/^✗/.test(l)) { mal++; console.log(l); } else if (/^\s+\(/.test(l)) console.log(l);
  }
} else console.log('(sin javac: la parte de Java no corre)');
if (!fs.existsSync(path.join(DIR, 'indice.json'))) { console.log('✗ no hay malla guardada'); process.exit(1); }
const IX = JSON.parse(fs.readFileSync(path.join(DIR, 'indice.json'), 'utf8'));

/* 2) el juego */
const nav = await navegador();
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
let pedidos = 0;
await ctx.route(/^https:\/\/appassets\.androidplatform\.net\/malla\//, (r) => {
  const k = new URL(r.request().url()).pathname.slice(7).replace('.bin', ''), f = path.join(DIR, k + '.bin'); pedidos++;
  return fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f), contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 404, body: '' });
});
await pag.reload();
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5, 1 / 30, false);
/* tu espacio sin visor; la cabeza en el medio del cuarto de mentira, mirando la pared del fondo y el piso */
await pag.evaluate(async () => {
  const { UI, THREE } = window.__A;
  UI.menuVR(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.menu-vr [data-sbs="0"]').click(); await new Promise((r) => setTimeout(r, 50));
  document.querySelector('.vr-ar [data-ar="espacio"]').click(); await new Promise((r) => setTimeout(r, 150));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0.3, 0, 'YXZ'));
  window.__P = [0.3, 1.45, -0.1, q.x, q.y, q.z, q.w];
  window.__manda = (n = 1, dibujar = false) => { for (let i = 0; i < n; i++) { window.__nativo.pose(18, ...window.__P, 1, '60'); window.__A.paso(1 / 60, dibujar); } };
  window.__manda(40);
});
const t0 = Date.now();
await pag.evaluate((IX) => window.__nativo.malla(IX.bloques, IX.total, IX.hechos), IX);
await pag.waitForFunction((n) => { window.__manda(4); return window.__A.espacio.malla.llegadas >= n && ![...window.__A.espacio.malla.trozos.values()].some((T) => T.sucio); }, IX.bloques.length, { timeout: 60000, polling: 50 });
const ms = Date.now() - t0;
const r1 = await pag.evaluate(() => { const E = window.__A.espacio; return { ...E.datos.malla, llegadas: E.malla.llegadas, dibujos: E.grupoMalla.children.length, visible: E.grupoMalla.visible }; });
prueba('el juego baja todos los bloques y los junta en trozos (pocas mallas)', r1.llegadas === IX.bloques.length && r1.dibujos > 0 && r1.dibujos <= Math.ceil(IX.bloques.length / 4), `${r1.llegadas} bloques · ${r1.dibujos} trozos · ${pedidos} pedidos · ${ms} ms`);
prueba('los cuadrados del juego son los de Java', Math.abs(r1.cuadros - IX.cuadros) <= 1, `${r1.cuadros} contra ${IX.cuadros}`);
/* se dibuja: con y sin la malla, la pantalla cambia (en un mismo paso) */
const r2 = await pag.evaluate(() => {
  const A = window.__A, E = A.espacio, gl = A.motor.r.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  window.__manda(1); E.foto.visible = false;
  E.grupoMalla.visible = false; E.dibujar(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, a);
  E.grupoMalla.visible = true; E.dibujar(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, b);
  let n = 0, lineas = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); if (d > 12) n++; if (d > 90) lineas++; }
  const png = A.motor.r.domElement.toDataURL('image/png');
  return { pct: +(100 * n / (W * H)).toFixed(1), lineas: +(100 * lineas / (W * H)).toFixed(1), png };
});
fs.writeFileSync(path.join(SAL, 'malla-espacio.png'), Buffer.from(r2.png.split(',')[1], 'base64'));
prueba('la malla se dibuja (el cuarto de mentira se ve), con sus bordes que brillan', r2.pct > 30 && r2.lineas > 1, `${r2.pct} % de la pantalla · ${r2.lineas} % de bordes`);
/* la tarjeta: cuántos cuadrados y cuánto está listo */
const r3 = await pag.evaluate(() => { window.__manda(3); const E = window.__A.espacio; return { vox: E.nObjetos, listo: E.pctListo }; });
prueba('la tarjeta cuenta los cuadrados y dice cuánto está listo', r3.vox === r1.cuadros && r3.listo === Math.round(100 * IX.hechos / IX.total), JSON.stringify(r3));
/* al terminar se va; escanear de nuevo la borra */
const r4 = await pag.evaluate(() => {
  const E = window.__A.espacio; E.ponerFase('manos'); window.__manda(80);
  const ida = { u: +E.uVer.value.toFixed(2), visible: E.grupoMalla.visible };
  window.__nativo.olvidado(); window.__manda(2);
  return { ida, despues: { bloques: E.malla.bloques.size, trozos: E.malla.trozos.size, hijos: E.grupoMalla.children.length } };
});
prueba('al terminar de escanear la malla se va (como en un Quest)', r4.ida.u === 0 && !r4.ida.visible, JSON.stringify(r4.ida));
prueba('"escanear de nuevo" la borra', r4.despues.bloques === 0 && r4.despues.hijos === 0, JSON.stringify(r4.despues));
await pag.evaluate(() => window.__A.J.salirVR());
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
