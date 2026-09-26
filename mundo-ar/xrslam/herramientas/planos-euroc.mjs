// Corre XRSLAM (wasm) sobre una secuencia EuRoC exportada, junta los puntos
// del mapa y detecta planos con web/planos.js. Escribe la trayectoria (TUM) y
// los planos (JSON) para compararlos con la verdad (planos-verdad.py).
//
//   node planos-euroc.mjs <xrslam.mjs> <slam.yaml> <sensor.yaml> <carpeta exportada> <salida> [escala]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { MapaPlanos } from "../web/planos.js";

const [modulo, slamYaml, sensorYaml, carpeta, salida, escTxt] = process.argv.slice(2);
const ESC = Number(escTxt || 0.64);
fs.mkdirSync(salida, { recursive: true });
const M = await (await import(pathToFileURL(path.resolve(modulo)).href)).default({ print: () => {}, printErr: () => {} });
let sensor = fs.readFileSync(sensorYaml, "utf8")
  .replace(/resolution: \[([^\]]*)\]/, (_, r) => "resolution: [" + r.split(",").map((v) => Math.round(Number(v) * ESC)).join(", ") + "]")
  .replace(/intrinsics: \[([^\]]*)\]/, (_, r) => "intrinsics: [" + r.split(",").map((v) => Number(v) * ESC).join(", ") + "]");
if (!M._xr_crear(M.stringToNewUTF8(fs.readFileSync(slamYaml, "utf8")), M.stringToNewUTF8(sensor))) throw new Error("xr_crear");
const imu = new Float64Array(fs.readFileSync(path.join(carpeta, "imu.bin")).buffer.slice(0));
const fd = fs.openSync(path.join(carpeta, "cuadros.bin"), "r"), cab = Buffer.alloc(16); fs.readSync(fd, cab, 0, 16, 0);
const n = cab.readInt32LE(4), w = cab.readInt32LE(8), h = cab.readInt32LE(12), tam = 8 + w * h, buf = Buffer.alloc(tam);
const W = Math.round(w * ESC), H = Math.round(h * ESC), chica = new Uint8Array(W * H);
const achicar = (s) => { const fx = w / W, fy = h / H; for (let y = 0; y < H; y++) { const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy)); for (let x = 0; x < W; x++) { const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx)); let a = 0; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) a += s[yy * w + xx]; chica[y * W + x] = a / ((y1 - y0) * (x1 - x0)); } } return chica; };
const pImg = M._malloc(W * H), pPose = M._malloc(64), MAXP = 4000, pPts = M._malloc(MAXP * 24);
const mapa = new MapaPlanos(), tray = [], cuenta = [];
let k = 0, cam = null;
for (let i = 0; i < n; i++) {
  fs.readSync(fd, buf, 0, tam, 16 + i * tam);
  const t = buf.readDoubleLE(0);
  M.HEAPU8.set(achicar(buf.subarray(8)), pImg);
  while (k < imu.length / 7 && imu[k * 7] <= t) { const o = k * 7; M._xr_imu(imu[o], imu[o + 1], imu[o + 2], imu[o + 3], imu[o + 4], imu[o + 5], imu[o + 6]); k++; }
  M._xr_imagen(t, pImg, W);
  if (M._xr_estado() === 1) {
    M._xr_pose(pPose, 0);
    const p = M.HEAPF64.slice(pPose / 8, pPose / 8 + 8);
    if (p[0] > 0) { tray.push(Array.from(p)); cam = [p[1], p[2], p[3]]; }
    if (i % 10 === 0) { const c = M._xr_puntos(pPts, MAXP); cuenta.push(c); mapa.agregar(M.HEAPF64.subarray(pPts / 8, pPts / 8 + c * 3), t); }
  }
}
const t0 = performance.now();
const planos = mapa.detectar(cam);
const ms = performance.now() - t0;
fs.writeFileSync(path.join(salida, "trayectoria.tum"), tray.map((p) => p.map((v, j) => v.toFixed(j ? 9 : 6)).join(" ")).join("\n") + "\n");
fs.writeFileSync(path.join(salida, "planos.json"), JSON.stringify(planos));
// El mapa acumulado, para volver a detectar sin correr el SLAM (planos-rehacer.mjs).
fs.writeFileSync(path.join(salida, "mapa.json"), JSON.stringify({ cam, celdas: [...mapa.celdas.values()] }));
const med = [...cuenta].sort((a, b) => a - b)[cuenta.length >> 1];
console.log(`puntos por consulta: mediana ${med}, máx ${Math.max(...cuenta)} · mapa acumulado ${mapa.tamano} vóxeles · detección ${ms.toFixed(0)} ms`);
for (const p of planos) console.log(`  ${p.tipo.padEnd(10)} ${String(p.puntos).padStart(4)} puntos · ${p.area.toFixed(2)} m²` + (p.tipo === "pared" ? ` · normal [${p.normal.slice(0, 2).map((v) => v.toFixed(2))}]` : ` · altura ${p.altura.toFixed(2)} m`));
