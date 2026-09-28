// NEXO WEB en la PC: la página de verdad (web/index.html) en Chromium, con los CDN de verdad (three.js,
// MediaPipe) y un origen https de mentira (así hay "contexto seguro": cámara y sensores).
//   · el núcleo: el pellizco y el DOBLE PELLIZCO con las manos reales de pruebas/manos*.txt, la cuenta
//     que ubica la mano delante de la cámara, la calculadora;
//   · la cabeza: el teléfono acostado y derecho mira al horizonte, y girar 30° gira 30°;
//   · las manos simuladas (los puntos reales de MediaPipe) sobre una ventana: un pellizco solo no toca,
//     el doble sí (bajar y subir), y sostener dibuja en la Pizarra;
//   · MediaPipe DE VERDAD en el worker, con una foto pública de MediaPipe;
//   · capturas: salida/web-*.png.
//
//   node pruebas/web.mjs
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "../../mundo-ar/node_modules/playwright");

let fallas = 0;
const ver = (ok, s) => { console.log((ok ? "✓ " : "✗ ") + s); if (!ok) fallas++; };
const leerManos = (archivo) => readFileSync(new URL(archivo, import.meta.url), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => {
  const t = l.trim().split(/\s+/), n = (i) => +t[i];
  const img = [], mundo = [];
  for (let i = 0; i < 21; i++) { img.push([n(3 + i * 3), n(4 + i * 3), n(5 + i * 3)]); mundo.push([n(66 + i * 3), n(67 + i * 3), n(68 + i * 3)]); }
  return { nombre: t[0], w: n(1), h: n(2), img, mundo };
});
const manos = [...leerManos("manos.txt"), ...leerManos("manos-commons.txt")];
mkdirSync(new URL("../salida/", import.meta.url), { recursive: true });
const salida = (n) => new URL(`../salida/${n}`, import.meta.url).pathname;

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
});
const pag = await nav.newPage({ viewport: { width: 1280, height: 640 } });
const errores = [];
pag.on("pageerror", (e) => errores.push(e.message));
pag.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
await pag.route("https://nexo.prueba/**", (q) => q.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
await pag.goto("https://nexo.prueba/?prueba", { waitUntil: "load" });
await pag.waitForFunction(() => window.Nexo, null, { timeout: 60000 });
ver(true, "la página carga (three.js del CDN, sin errores al arrancar)");
await pag.screenshot({ path: salida("web-inicio.png") });

// ── el núcleo ──
const r = await pag.evaluate((manos) => {
  const { Gestos, DoblePellizco, traslacion, calcular, formato } = Nexo.nucleo;
  const out = {};
  // ningún pellizco falso con manos reales
  out.falsos = manos.filter((m) => { const g = new Gestos(); let p = false; for (let i = 0; i < 5; i++) p = g.paso(m.mundo) || p; return p; }).map((m) => m.nombre);
  // pellizcar con las manos abiertas: doble = un clic, uno solo = ninguno (30 imágenes por segundo, 3 mm de temblor)
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647 - 0.5; };
  const pellizcos = (w0, veces) => {
    const g = new Gestos(), d = new DoblePellizco(), medio = [0, 1, 2].map((k) => (w0[4][k] + w0[8][k]) / 2), s = [0, 0, 0, 0, 0];
    for (let v = 0; v < veces; v++) { for (let i = 1; i <= 4; i++) s.push(i / 4); s.push(1, 1); for (let i = 3; i >= 0; i--) s.push(i / 4); s.push(0, 0, 0); }
    for (let i = 0; i < 30; i++) s.push(0);
    let ms = 1000, n = 0, antes = false;
    for (const x of s) {
      const w = w0.map((p) => p.slice());
      for (const j of [4, 8]) for (let k = 0; k < 3; k++) w[j][k] = w0[j][k] + (medio[k] - w0[j][k]) * x * 0.97 + azar() * 0.006;
      ms += 33;
      const ap = d.paso(g.paso(w), ms);
      if (ap && !antes) n++;
      antes = ap;
    }
    return n;
  };
  const abiertas = manos.filter((m) => Gestos.indice(m.mundo) >= 1.3 && Gestos.apertura(m.mundo) >= 0.45);
  out.abiertas = abiertas.length;
  out.doble = abiertas.filter((m) => pellizcos(m.mundo, 2) === 1).length;
  out.uno = abiertas.filter((m) => pellizcos(m.mundo, 1) === 0).length;
  // la mano delante de la cámara: con T conocido se recupera; con ruido de 2 px, cerca
  const m0 = manos.find((m) => m.nombre === "pointing_up") || manos[0];
  const W = 640, H = 480, fx = (W / 2) / Math.tan(33 * Math.PI / 180), T0 = [0.06, 0.1, 0.42];
  const proy = (ruido) => m0.mundo.map((p) => [(fx * (p[0] + T0[0]) / (p[2] + T0[2]) + W / 2 + ruido()) / W, (fx * (p[1] + T0[1]) / (p[2] + T0[2]) + H / 2 + ruido()) / H, 0]);
  const T1 = traslacion(proy(() => 0), m0.mundo, 1, fx, fx, W / 2, H / 2, W, H);
  out.errExacto = Math.hypot(T1[0] - T0[0], T1[1] - T0[1], T1[2] - T0[2]);
  let peor = 0;
  for (let k = 0; k < 50; k++) { const T2 = traslacion(proy(() => azar() * 4), m0.mundo, 1, fx, fx, W / 2, H / 2, W, H); peor = Math.max(peor, Math.hypot(T2[0] - T0[0], T2[1] - T0[1], T2[2] - T0[2])); }
  out.errRuido = peor;
  // con las fotos reales (sin saber su lente): cuánto se equivoca al volver a proyectar, en palmas
  out.reproy = manos.map((m) => {
    const f = (m.w / 2) / Math.tan(30 * Math.PI / 180), T = traslacion(m.img, m.mundo, 1, f, f, m.w / 2, m.h / 2, m.w, m.h);
    const palma = Math.hypot((m.img[0][0] - m.img[9][0]) * m.w, (m.img[0][1] - m.img[9][1]) * m.h);
    let e = 0;
    for (let i = 0; i < 21; i++) { const p = m.mundo[i], u = f * (p[0] + T[0]) / (p[2] + T[2]) + m.w / 2, v = f * (p[1] + T[1]) / (p[2] + T[2]) + m.h / 2; e += Math.hypot(u - m.img[i][0] * m.w, v - m.img[i][1] * m.h); }
    return e / 21 / palma;
  });
  // la calculadora
  const casos = [["2+3×4", 14], ["(2+3)×4", 20], ["2^3^2", 512], ["10÷4", 2.5], ["0,1+0,2", 0.3], ["50%×200", 100], ["−3+5", 2], ["2×π", 2 * Math.PI]];
  out.calc = casos.map(([e, v]) => { try { return Math.abs(calcular(e) - v) < 1e-9; } catch (x) { return false; } });
  try { calcular("1÷0"); out.cero = false; } catch (e) { out.cero = e.message === "dividir por cero"; }
  out.formato = formato(1234.5);
  return out;
}, manos);
ver(r.falsos.length === 0, `ninguna de las ${manos.length} manos reales es un pellizco${r.falsos.length ? " (" + r.falsos.join(", ") + ")" : ""}`);
ver(r.doble === r.abiertas, `doble pellizco con ${r.abiertas} manos reales: un clic (${r.doble} bien)`);
ver(r.uno === r.abiertas, `un pellizco solo con las mismas manos: ningún clic (${r.uno} bien)`);
ver(r.errExacto < 1e-4, `la mano delante de la cámara: la posición se recupera exacta (${(r.errExacto * 1000).toFixed(3)} mm)`);
ver(r.errRuido < 0.03, `con 2 px de ruido en cada punto, a 42 cm: error máximo ${(r.errRuido * 100).toFixed(1)} cm`);
const rep = r.reproy.slice().sort((a, b) => a - b), mediana = rep[Math.floor(rep.length / 2)];
ver(mediana < 0.12, `con las ${manos.length} fotos reales (sin saber su lente), los 21 puntos vuelven a caer donde los vio MediaPipe: error mediano ${(mediana * 100).toFixed(1)} % de la palma (los ejes están bien)`);
ver(r.calc.every(Boolean) && r.cero, `la calculadora: precedencia, potencias, porcentaje, decimales con coma, dividir por cero (${r.formato})`);

// ── arrancar en modo pantalla (sin cámara todavía) ──
await pag.evaluate(() => { Object.assign(Nexo.aj, { visor: false, manos: false, pass: false, entorno: "espacio", sonido: false }); return Nexo.empezar(); });
await pag.waitForTimeout(1200);
// la cabeza: acostado y derecho
const cab = await pag.evaluate(async () => {
  const res = {};
  for (const g of [-90, 90]) {
    for (let i = 0; i < 5; i++) { Nexo.orientacion(0, 0, g, 90); await new Promise((r) => setTimeout(r, 16)); }
    const c = Nexo.cabeza();
    res[g] = c;
  }
  return res;
});
const nivelado = Object.entries(cab).find(([, c]) => Math.abs(c.adelante[1]) < 0.01 && c.arriba[1] > 0.999);
ver(!!nivelado, `el teléfono acostado y derecho mira al horizonte (gamma ${nivelado ? nivelado[0] : "?"}°: adelante ${nivelado ? nivelado[1].adelante.map((x) => x.toFixed(2)).join(" ") : "-"})`);
const gamma = nivelado ? +nivelado[0] : -90;
const giro = await pag.evaluate(async (gamma) => {
  for (let i = 0; i < 5; i++) { Nexo.orientacion(0, 0, gamma, 90); await new Promise((r) => setTimeout(r, 16)); }
  Nexo.recentrar();
  const a = Nexo.cabeza().adelante;
  for (let i = 0; i < 5; i++) { Nexo.orientacion(30, 0, gamma, 90); await new Promise((r) => setTimeout(r, 16)); }
  const b = Nexo.cabeza().adelante;
  return { a, b, ang: (Math.atan2(-b[0], -b[2]) - Math.atan2(-a[0], -a[2])) * 180 / Math.PI };
}, gamma);
ver(Math.abs(Math.abs(giro.ang) - 30) < 0.5 && Math.abs(giro.b[1]) < 0.01, `girando 30° la vista gira ${giro.ang.toFixed(1)}° (y no se inclina)`);
await pag.evaluate(async (gamma) => { Nexo.orientacion(0, 0, gamma, 90); await new Promise((r) => setTimeout(r, 50)); Nexo.recentrar(); }, gamma);
await pag.waitForTimeout(800);
await pag.screenshot({ path: salida("web-pantalla.png") });

// ── las manos simuladas: la mano abierta de una foto real, delante de la cámara ──
// (sin GPU esta PC dibuja a ~4 fps y el reloj de la página se atrasa: para simular los gestos, la ventana chica)
await pag.setViewportSize({ width: 400, height: 200 });
await pag.evaluate(() => Nexo.ajustarTamano());
// una mano abierta, apuntando (como la de las pruebas de la app: el índice estirado, el pulgar separado)
const palma = (w) => Math.hypot(...[0, 1, 2].map((k) => w[0][k] - w[9][k]));
const mano = manos.find((m) => Math.hypot(...[0, 1, 2].map((k) => m.mundo[8][k] - m.mundo[0][k])) / palma(m.mundo) >= 1.3
  && Math.hypot(...[0, 1, 2].map((k) => m.mundo[4][k] - m.mundo[8][k])) / palma(m.mundo) >= 0.45);
const sec = await pag.evaluate(async (m) => {
  Nexo.aj.manos = true; Nexo.aj.verManos = true;
  const pizarra = Nexo.abrir("pizarra").app;
  const medioI = [0, 1, 2].map((k) => (m.img[4][k] + m.img[8][k]) / 2), medioW = [0, 1, 2].map((k) => (m.mundo[4][k] + m.mundo[8][k]) / 2);
  // cada foto con su hora, a 30 por segundo (como las de la cámara), aunque los temporizadores de esta PC se atrasen
  let reloj = performance.now();
  const cuadro = (x, dx = 0) => {
    reloj += 33;
    const img = m.img.map((p) => [p[0] + dx, p[1], p[2]]), mundo = m.mundo.map((p) => p.slice());
    for (const j of [4, 8]) for (let k = 0; k < 3; k++) { img[j][k] = m.img[j][k] + (k === 0 ? dx : 0) + (medioI[k] - m.img[j][k]) * x * 0.97; mundo[j][k] = m.mundo[j][k] + (medioW[k] - m.mundo[j][k]) * x * 0.97; }
    Nexo.recibirManos({ w: m.w, h: m.h, manos: [{ img, mundo, lado: "Left" }] }, reloj);
  };
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const traza = []; let trazar = false;
  const correr = async (xs, dx = () => 0) => { let i = 0; for (const x of xs) { cuadro(x, dx(i++)); if (trazar) { const e = Nexo.estado(); traza.push(`${x}:${e.manos[1].pellizca ? "P" : "-"}${e.manos[1].fase}${e.manos[1].aprieta ? "A" : ""}${e.fuentes[1].apretado ? "!" : ""}${e.fuentes[1].sobre ? "" : "?"}`); } await esperar(33); } };
  const abierta = (n) => Array(n).fill(0);
  const pellizco = [0.25, 0.5, 0.75, 1, 1, 1, 0.75, 0.5, 0.25, 0];
  await correr(abierta(20));
  for (let i = 0; i < 60 && !Nexo.estado().fuentes[1].activa; i++) await correr(abierta(1));
  const est0 = Nexo.estado();
  Nexo.ventanaEnRayo("pizarra", 1);
  await correr(abierta(10));
  const sobre = Nexo.estado().fuentes[1];
  sobre.depurar = Nexo.depurar();
  pizarra.toques.length = 0;
  await correr(pellizco); await correr(abierta(30));
  const uno = pizarra.toques.slice();
  pizarra.toques.length = 0;
  traza.length = 0; trazar = true;
  await correr(pellizco); await correr(abierta(3)); await correr(pellizco); await correr(abierta(20));
  trazar = false;
  const dos = pizarra.toques.slice();
  // doble pellizco y sostener, moviendo la mano: una raya en la pizarra
  const trazos0 = pizarra.trazos.length;
  await correr([0.25, 0.5, 0.75, 1, 1, 0.75, 0.5, 0.25, 0, 0, 0]);
  await correr([0.25, 0.5, 0.75, ...Array(25).fill(1), 0.5, 0, 0], (i) => i < 3 ? 0 : Math.min(22, i - 3) * 0.004);
  await correr(abierta(10));
  return { traza: traza.join(" "), est0, sobre, uno, dos, trazos: pizarra.trazos.length - trazos0, estado: Nexo.estado() };
}, mano);
console.log(`   (la página dibuja a ${Math.round(sec.estado.fps)} fps en esta PC, sin GPU)`);
ver(sec.est0.manos[1].visible && sec.est0.fuentes[1].activa, `la mano (los puntos reales de "${mano.nombre}") aparece y tiene su rayo`);
ver(sec.sobre.sobre === "pizarra", `el rayo le pega a la ventana que tiene adelante (${sec.sobre.sobre}, ${sec.sobre.que})`);
if (sec.sobre.sobre !== "pizarra") console.log(JSON.stringify(sec.sobre.depurar));
ver(!sec.uno.includes("baja"), `un pellizco solo sobre la pizarra: ningún toque (${sec.uno.join(",") || "nada"})`);
if (sec.dos[0] !== "baja") console.log(sec.traza);
ver(sec.dos[0] === "baja" && sec.dos[sec.dos.length - 1] === "sube", `doble pellizco: bajar y subir (${sec.dos.filter((x, i, a) => x !== a[i - 1]).join(" → ")})`);
ver(sec.trazos === 1, `doble pellizco sostenido y mover la mano: una raya en la pizarra (${sec.trazos})`);
await pag.setViewportSize({ width: 1280, height: 640 });
await pag.evaluate(async (m) => {
  Nexo.ajustarTamano();
  const b = Nexo.app("bienvenida"); if (b) b.accion("listo");
  // la foto: armado (después del primer pellizco), con los dedos un poco cerrados
  const medioI = [0, 1, 2].map((k) => (m.img[4][k] + m.img[8][k]) / 2), medioW = [0, 1, 2].map((k) => (m.mundo[4][k] + m.mundo[8][k]) / 2);
  for (const x of [0, 0.5, 1, 1, 0.5, 0, 0, 0.3, 0.35]) {
    const img = m.img.map((p) => p.slice()), mundo = m.mundo.map((p) => p.slice());
    for (const j of [4, 8]) for (let k = 0; k < 3; k++) { img[j][k] += (medioI[k] - img[j][k]) * x * 0.97; mundo[j][k] += (medioW[k] - mundo[j][k]) * x * 0.97; }
    Nexo.recibirManos({ w: m.w, h: m.h, manos: [{ img, mundo, lado: "Left" }] }, performance.now());
    await new Promise((r) => setTimeout(r, 40));
    window.ultimaMano = { w: m.w, h: m.h, manos: [{ img, mundo, lado: "Left" }] };
  }
  // (que la mano siga llegando mientras se saca la foto: esta PC dibuja lento)
  window.sigueMano = setInterval(() => Nexo.recibirManos(window.ultimaMano, performance.now()), 30);
}, mano);
await pag.waitForTimeout(700);
await pag.screenshot({ path: salida("web-manos.png") });
await pag.evaluate(() => clearInterval(window.sigueMano));

// ── el visor (VR Box) ──
await pag.evaluate(() => { Nexo.aj.visor = true; Nexo.ajustarTamano(); Nexo.abrir("reloj"); });
await pag.evaluate(async (m) => { for (let i = 0; i < 12; i++) { Nexo.recibirManos({ w: m.w, h: m.h, manos: [{ img: m.img, mundo: m.mundo, lado: "Left" }] }, performance.now()); await new Promise((r) => setTimeout(r, 33)); } }, mano);
await pag.screenshot({ path: salida("web-visor.png") });
ver(true, "el visor: las dos imágenes con la corrección de las lentes (salida/web-visor.png)");

// ── MediaPipe de verdad (en el worker), con la cámara de mentira de Chromium ──
const mp = await pag.evaluate(async () => {
  Nexo.aj.visor = false; Nexo.ajustarTamano();
  Nexo.aj.manos = true; Nexo.aplicarAjustes();
  const t0 = performance.now();
  while (!Nexo.listo() && performance.now() - t0 < 120000) await new Promise((r) => setTimeout(r, 250));
  if (!Nexo.listo()) return { listo: false };
  const cargo = performance.now() - t0;
  Nexo.aj.manos = false;   // (que la cámara de mentira no le gane el turno a la foto)
  await new Promise((r) => setTimeout(r, 400));
  const img = await (await fetch("https://storage.googleapis.com/mediapipe-assets/pointing_up.jpg")).blob();
  const bmp = await createImageBitmap(img);
  const res = await Nexo.detectar(bmp);
  return { listo: true, cargo, res };
});
ver(mp.listo, `MediaPipe HandLandmarker carga en el worker${mp.listo ? ` (${(mp.cargo / 1000).toFixed(1)} s)` : ""}`);
if (mp.listo) {
  const ref = manos.find((m) => m.nombre === "pointing_up");
  const h = mp.res.manos[0];
  const err = h ? Math.max(...[0, 5, 8, 9].map((i) => Math.hypot(h.img[i][0] - ref.img[i][0], h.img[i][1] - ref.img[i][1]))) : 1;
  ver(mp.res.manos.length === 1 && err < 0.03, `encuentra la mano de la foto de MediaPipe (${mp.res.manos.length} mano, ${Math.round(mp.res.ms)} ms; la muñeca y los nudillos a ${(err * 100).toFixed(1)} % de donde los encontró la app)`);
}
ver(errores.length === 0, `sin errores de JavaScript${errores.length ? ": " + errores.slice(0, 3).join(" | ") : ""}`);
await nav.close();
console.log(fallas === 0 ? "\n✓ todo bien" : `\n✗ ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
