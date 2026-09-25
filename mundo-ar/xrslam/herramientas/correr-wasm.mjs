// Corre el XRSLAM de WebAssembly sobre una secuencia EuRoC exportada
// (cuadros.bin + imu.bin, de `exportar`) y escribe la trayectoria TUM, como
// el corredor nativo. Mide el tiempo de cada cuadro con la IMU incluida.
//
//   node correr-wasm.mjs <xrslam.mjs> <slam.yaml> <sensor.yaml> <carpeta exportada> <salida.tum> [cuadros]
//
// Para simular los sensores de un navegador (variables de entorno):
//   IMU_HZ=60        la IMU a esa frecuencia (EuRoC trae 200 Hz; devicemotion da ~60)
//   TIEMBLA_MS=4     cada muestra de IMU con la hora corrida al azar ±N ms
//   RETRASO_MS=40    la cámara llega con esa hora de más respecto de la IMU
//   ESCALA=0.64      la imagen achicada (y la calibración con ella)
//   SIN_FILTRO=1     bajar la IMU tirando muestras (sin promediar: aliasing)
//   ENDEREZAR=1      corregir el temblor de horas como lo haría la página
//                    (el sensor late a ritmo fijo: se ajusta una recta)
//   CALIBRAR=10      estimar el desfase cámara-IMU con los primeros N s
//                    (web/desfase.js), reiniciar y correr con las horas corregidas
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { estimarDesfase, Flujo, giroComoFlujo } from "../web/desfase.js";

const [modulo, slamYaml, sensorYaml, carpeta, salida, topeTxt] = process.argv.slice(2);
const IMU_HZ = Number(process.env.IMU_HZ || 0), TIEMBLA = Number(process.env.TIEMBLA_MS || 0) / 1000;
const RETRASO = Number(process.env.RETRASO_MS || 0) / 1000, ESCALA = Number(process.env.ESCALA || 1);
let semilla = 12345;
const azar = () => ((semilla = (semilla * 1103515245 + 12345) >>> 0) / 4294967296);
const tope = topeTxt ? Number(topeTxt) : Infinity;
const XRSLAM = (await import(pathToFileURL(path.resolve(modulo)).href)).default;
const callado = !process.env.XR_VERBOSO;
const M = await XRSLAM(callado ? { print: () => {}, printErr: () => {} } : {});

const cad = (s) => M.stringToNewUTF8(s);
let textoSensor = fs.readFileSync(sensorYaml, "utf8");
if (ESCALA !== 1) {
  // La calibración va con la imagen: resolución e intrínsecos por la misma escala.
  textoSensor = textoSensor.replace(/resolution: \[([^\]]*)\]/, (_, r) => "resolution: [" + r.split(",").map(v => Math.round(Number(v) * ESCALA)).join(", ") + "]")
    .replace(/intrinsics: \[([^\]]*)\]/, (_, r) => "intrinsics: [" + r.split(",").map(v => Number(v) * ESCALA).join(", ") + "]");
}
if (process.env.FOCAL_X) {
  // Focal equivocada a propósito: fx y fy por este factor (el centro queda).
  const f = Number(process.env.FOCAL_X);
  textoSensor = textoSensor.replace(/intrinsics: \[([^\]]*)\]/, (_, r) => "intrinsics: [" + r.split(",").map((v, i) => Number(v) * (i < 2 ? f : 1)).join(", ") + "]");
}
const pSlam = cad(fs.readFileSync(slamYaml, "utf8")), pSensor = cad(textoSensor);
if (!M._xr_crear(pSlam, pSensor)) { console.error("xr_crear falló"); process.exit(1); }

let imu = new Float64Array(fs.readFileSync(path.join(carpeta, "imu.bin")).buffer.slice(0));
if (IMU_HZ && process.env.SIN_FILTRO) {
  // Una muestra cada 1/IMU_HZ s, tirando las demás (sin filtro: aliasing).
  const salen = []; let prox = -Infinity;
  for (let i = 0; i < imu.length / 7; i++) if (imu[i * 7] >= prox) { salen.push(...imu.subarray(i * 7, i * 7 + 7)); prox = imu[i * 7] + 1 / IMU_HZ - 1e-4; }
  imu = Float64Array.from(salen);
} else if (IMU_HZ) {
  // Como un sensor que entrega a IMU_HZ: el promedio de cada ventana, con la
  // hora del final de la ventana (el hardware filtra antes de bajar la frecuencia).
  const salen = [], T = 1 / IMU_HZ;
  let ini = imu[0], acc = new Float64Array(6), cnt = 0;
  for (let i = 0; i < imu.length / 7; i++) {
    const t = imu[i * 7];
    if (t >= ini + T && cnt) { salen.push(ini + T, ...acc.map(v => v / cnt)); ini += T; acc.fill(0); cnt = 0; while (t >= ini + T) ini += T; }
    for (let j = 0; j < 6; j++) acc[j] += imu[i * 7 + 1 + j];
    cnt++;
  }
  imu = Float64Array.from(salen);
}
if (TIEMBLA) {
  for (let i = 0; i < imu.length / 7; i++) imu[i * 7] += (azar() * 2 - 1) * TIEMBLA;
  // Las horas quedan en orden (un navegador no entrega eventos al revés).
  for (let i = 1; i < imu.length / 7; i++) imu[i * 7] = Math.max(imu[i * 7], imu[(i - 1) * 7] + 1e-4);
}
if (process.env.ENDEREZAR) {
  // Lo que haría la página: las horas que llegan tiemblan, pero el sensor
  // late a ritmo fijo. Se ajusta una recta t = a + b·i sobre una ventana
  // móvil de 2 s de muestras pasadas y se usa la hora de la recta.
  const n = imu.length / 7, V = 120, ts = Array.from({ length: n }, (_, i) => imu[i * 7]);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - V);
    if (i - i0 < 10) continue;
    let sx = 0, sy = 0, sxx = 0, sxy = 0, m = i - i0 + 1;
    for (let j = i0; j <= i; j++) { const x = j - i0; sx += x; sy += ts[j]; sxx += x * x; sxy += x * ts[j]; }
    const b = (m * sxy - sx * sy) / (m * sxx - sx * sx), a = (sy - b * sx) / m;
    imu[i * 7] = Math.max(a + b * (i - i0), i ? imu[(i - 1) * 7] + 1e-4 : -Infinity);
  }
}
const nImu = imu.length / 7;
const fd = fs.openSync(path.join(carpeta, "cuadros.bin"), "r");
const cab = Buffer.alloc(16); fs.readSync(fd, cab, 0, 16, 0);
const n = cab.readInt32LE(4), w = cab.readInt32LE(8), h = cab.readInt32LE(12);
const tam = 8 + w * h;
const buf = Buffer.alloc(tam);
const W2 = Math.round(w * ESCALA), H2 = Math.round(h * ESCALA);
const chica = new Uint8Array(W2 * H2);
// Achica promediando el área de cada píxel nuevo (como drawImage con suavizado).
function achicar(src) {
  const fx = w / W2, fy = h / H2;
  for (let y = 0; y < H2; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < W2; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let s = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) s += src[yy * w + xx];
      chica[y * W2 + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return chica;
}
const pImg = M._malloc(W2 * H2), pPose = M._malloc(8 * 8);

function correr(desfase, hastaSeg) {
  const lineas = [], tiempos = [], poses = [], flujos = [];
  const flujo = hastaSeg ? new Flujo(W2, H2) : null;
  let k = 0, bien = 0, t0Seq = null;
  const publicar = () => {
    if (M._xr_estado() !== 1) return;
    M._xr_pose(pPose, 0);
    const p = M.HEAPF64.subarray(pPose / 8, pPose / 8 + 8);
    const nq = p[4] * p[4] + p[5] * p[5] + p[6] * p[6] + p[7] * p[7];
    if (p[0] > 0 && nq > 0.5) {
      lineas.push(Array.from(p, (v, i) => v.toFixed(i === 0 ? 6 : 9)).join(" ")); bien++;
      if (!poses.length || p[0] > poses[poses.length - 1].t) poses.push({ t: p[0], q: [p[4], p[5], p[6], p[7]] });
    }
  };
  for (let i = 0; i < Math.min(n, tope); i++) {
    fs.readSync(fd, buf, 0, tam, 16 + i * tam);
    const t = buf.readDoubleLE(0) + RETRASO + desfase;
    if (t0Seq === null) t0Seq = t;
    if (hastaSeg && t - t0Seq > hastaSeg) break;
    const gris = ESCALA === 1 ? buf.subarray(8) : achicar(buf.subarray(8));
    M.HEAPU8.set(gris, pImg);
    if (flujo) { const f = flujo.agregar(t, gris); if (f) flujos.push(f); }
    const t0 = performance.now();
    while (k < nImu && imu[k * 7] <= t) {
      const o = k * 7;
      M._xr_imu(imu[o], imu[o + 1], imu[o + 2], imu[o + 3], imu[o + 4], imu[o + 5], imu[o + 6]);
      k++;
    }
    M._xr_imagen(t, pImg, W2);
    tiempos.push(performance.now() - t0);
    publicar();
  }
  return { lineas, tiempos, poses, bien, flujos };
}
const t0Total = performance.now();
let desfase = 0;
if (process.env.CALIBRAR) {
  const r = correr(0, Number(process.env.CALIBRAR));
  const imus = []; for (let i = 0; i < nImu; i++) imus.push({ t: imu[i * 7], w: [imu[i * 7 + 1], imu[i * 7 + 2], imu[i * 7 + 3]] });
  const qbc = JSON.parse(textoSensor.match(/q_bc: (\[[^\]]*\])/)[1]);
  const e = estimarDesfase(r.flujos, giroComoFlujo(imus, qbc));
  desfase = e.desfase;
  console.log(`desfase estimado ${(desfase * 1000).toFixed(1)} ms · focal estimada ${e.escala.toFixed(1)} px (calidad ${e.calidad.toFixed(3)}, con ${r.flujos.length} flujos)`);
  M._xr_destruir();
  if (!M._xr_crear(pSlam, pSensor)) { console.error("xr_crear falló"); process.exit(1); }
}
const { lineas, tiempos, bien } = correr(desfase, 0);
fs.writeFileSync(salida, lineas.join("\n") + "\n");
const orden = [...tiempos].sort((a, b) => a - b);
const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
console.log(`cuadros ${tiempos.length} · con pose ${bien} · ${prom.toFixed(1)} ms de promedio · mediana ${orden[orden.length >> 1].toFixed(1)} · p95 ${orden[Math.floor(orden.length * 0.95)].toFixed(1)} · peor ${orden[orden.length - 1].toFixed(1)} ms · total ${((performance.now() - t0Total) / 1000).toFixed(1)} s`);
M._xr_destruir();
