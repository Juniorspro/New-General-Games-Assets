// Corre el XRSLAM de WebAssembly sobre una secuencia EuRoC exportada
// (cuadros.bin + imu.bin, de `exportar`) y escribe la trayectoria TUM, como
// el corredor nativo. Mide el tiempo de cada cuadro con la IMU incluida.
//
//   node correr-wasm.mjs <xrslam.mjs> <slam.yaml> <sensor.yaml> <carpeta exportada> <salida.tum> [cuadros]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const [modulo, slamYaml, sensorYaml, carpeta, salida, topeTxt] = process.argv.slice(2);
const tope = topeTxt ? Number(topeTxt) : Infinity;
const XRSLAM = (await import(pathToFileURL(path.resolve(modulo)).href)).default;
const callado = !process.env.XR_VERBOSO;
const M = await XRSLAM(callado ? { print: () => {}, printErr: () => {} } : {});

const cad = (s) => M.stringToNewUTF8(s);
const pSlam = cad(fs.readFileSync(slamYaml, "utf8")), pSensor = cad(fs.readFileSync(sensorYaml, "utf8"));
if (!M._xr_crear(pSlam, pSensor)) { console.error("xr_crear falló"); process.exit(1); }

const imu = new Float64Array(fs.readFileSync(path.join(carpeta, "imu.bin")).buffer.slice(0));
const nImu = imu.length / 7;
const fd = fs.openSync(path.join(carpeta, "cuadros.bin"), "r");
const cab = Buffer.alloc(16); fs.readSync(fd, cab, 0, 16, 0);
const n = cab.readInt32LE(4), w = cab.readInt32LE(8), h = cab.readInt32LE(12);
const tam = 8 + w * h;
const buf = Buffer.alloc(tam);
const pImg = M._malloc(w * h), pPose = M._malloc(8 * 8);

const lineas = [], tiempos = [];
let k = 0, bien = 0;
const publicar = () => {
  if (M._xr_estado() !== 1) return;
  M._xr_pose(pPose, 0);
  const p = M.HEAPF64.subarray(pPose / 8, pPose / 8 + 8);
  const nq = p[4] * p[4] + p[5] * p[5] + p[6] * p[6] + p[7] * p[7];
  if (p[0] > 0 && nq > 0.5) { lineas.push(Array.from(p, (v, i) => v.toFixed(i === 0 ? 6 : 9)).join(" ")); bien++; }
};
const t0Total = performance.now();
for (let i = 0; i < Math.min(n, tope); i++) {
  fs.readSync(fd, buf, 0, tam, 16 + i * tam);
  const t = buf.readDoubleLE(0);
  M.HEAPU8.set(buf.subarray(8), pImg);
  const t0 = performance.now();
  while (k < nImu && imu[k * 7] <= t) {
    const o = k * 7;
    M._xr_imu(imu[o], imu[o + 1], imu[o + 2], imu[o + 3], imu[o + 4], imu[o + 5], imu[o + 6]);
    k++;
  }
  M._xr_imagen(t, pImg, w);
  tiempos.push(performance.now() - t0);
  publicar();
}
fs.writeFileSync(salida, lineas.join("\n") + "\n");
const orden = [...tiempos].sort((a, b) => a - b);
const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
console.log(`cuadros ${tiempos.length} · con pose ${bien} · ${prom.toFixed(1)} ms de promedio · mediana ${orden[orden.length >> 1].toFixed(1)} · p95 ${orden[Math.floor(orden.length * 0.95)].toFixed(1)} · peor ${orden[orden.length - 1].toFixed(1)} ms · total ${((performance.now() - t0Total) / 1000).toFixed(1)} s`);
M._xr_destruir();
