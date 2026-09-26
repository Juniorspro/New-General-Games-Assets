// Cuánto tarda XRSLAM en inicializar y por qué falla mientras tanto.
//   node inicio-euroc.mjs <xrslam.mjs> <slam.yaml> <sensor.yaml> <carpeta exportada> [escala] [desde_s]
import fs from "fs"; import path from "path"; import { pathToFileURL } from "url";
const [modulo, slamYaml, sensorYaml, carpeta, escTxt, desdeTxt] = process.argv.slice(2);
const ESC = Number(escTxt || 0.625), DESDE = Number(desdeTxt || 0);
const M = await (await import(pathToFileURL(path.resolve(modulo)).href)).default({ print: () => {}, printErr: () => {} });
const sensor = fs.readFileSync(sensorYaml, "utf8")
  .replace(/resolution: \[([^\]]*)\]/, (_, r) => "resolution: [" + r.split(",").map((v) => Math.round(Number(v) * ESC)).join(", ") + "]")
  .replace(/intrinsics: \[([^\]]*)\]/, (_, r) => "intrinsics: [" + r.split(",").map((v) => Number(v) * ESC).join(", ") + "]");
let slam = fs.readFileSync(slamYaml, "utf8");
for (const kv of (process.env.CAMBIOS || "").split(";").filter(Boolean)) { const [k, v] = kv.split("="); slam = slam.replace(new RegExp(`(\\n\\s*${k}:\\s*)[^#\\n]+`), `$1${v} `); }
if (!M._xr_crear(M.stringToNewUTF8(slam), M.stringToNewUTF8(sensor))) throw new Error("xr_crear");
const imu = new Float64Array(fs.readFileSync(path.join(carpeta, "imu.bin")).buffer.slice(0));
const fd = fs.openSync(path.join(carpeta, "cuadros.bin"), "r"), cab = Buffer.alloc(16); fs.readSync(fd, cab, 0, 16, 0);
const n = cab.readInt32LE(4), w = cab.readInt32LE(8), h = cab.readInt32LE(12), tam = 8 + w * h, buf = Buffer.alloc(tam);
const W = Math.round(w * ESC), H = Math.round(h * ESC), chica = new Uint8Array(W * H);
const achicar = (s) => { const fx = w / W, fy = h / H; for (let y = 0; y < H; y++) { const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy)); for (let x = 0; x < W; x++) { const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx)); let a = 0; for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) a += s[yy * w + xx]; chica[y * W + x] = a / ((y1 - y0) * (x1 - x0)); } } return chica; };
const pImg = M._malloc(W * H), pD = M._malloc(64);
const nombres = ["—", "juntando", "coincidencias", "paralaje", "sólo giro", "triangulación", "BA", "escala", "arrancó"];
const hist = {}; let k = 0, t0 = null, ultimoIntento = 0;
for (let i = 0; i < n; i++) {
  fs.readSync(fd, buf, 0, tam, 16 + i * tam);
  const t = buf.readDoubleLE(0);
  if (t0 === null) t0 = t;
  if (t - t0 < DESDE) { while (k < imu.length / 7 && imu[k * 7] <= t) k++; continue; }
  M.HEAPU8.set(achicar(buf.subarray(8)), pImg);
  while (k < imu.length / 7 && imu[k * 7] <= t) { const o = k * 7; M._xr_imu(imu[o], imu[o + 1], imu[o + 2], imu[o + 3], imu[o + 4], imu[o + 5], imu[o + 6]); k++; }
  M._xr_imagen(t, pImg, W);
  M._xr_diag(pD); const d = M.HEAPF64.slice(pD / 8, pD / 8 + 8);
  if (d[0] > ultimoIntento) { ultimoIntento = d[0]; const nm = nombres[d[1]]; hist[nm] = (hist[nm] || 0) + 1;
    if (process.env.DETALLE) console.log(`  ${(t - t0).toFixed(1)} s intento ${d[0]}: ${nm} · coinc ${d[2]} · paralaje ${d[3].toFixed(1)} · triang ${d[4]} · escala ${d[5].toFixed(3)} · esquinas ${d[6]}`); }
  if (M._xr_estado() === 1) { console.log(`arrancó a los ${(t - t0 - DESDE).toFixed(1)} s (${W}x${H}) tras ${d[0]} intentos · ${JSON.stringify(hist)}`); process.exit(0); }
}
console.log("no arrancó", JSON.stringify(hist));
