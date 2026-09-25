// Corre AlvaAR (el SLAM de la página actual) sobre la misma secuencia
// exportada, para comparar. AlvaAR es sólo visual: su escala es arbitraria y
// hay que evaluarlo con ate.py --sim3.
//
//   node correr-alva.mjs <alva_ar.js> <carpeta exportada> <salida.tum> <fx en px> [cuadros]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const [alvaJs, carpeta, salida, fxTxt, topeTxt] = process.argv.slice(2);
const tope = topeTxt ? Number(topeTxt) : Infinity;
const { AlvaAR } = await import(pathToFileURL(path.resolve(alvaJs)).href);
const fd = fs.openSync(path.join(carpeta, "cuadros.bin"), "r");
const cab = Buffer.alloc(16); fs.readSync(fd, cab, 0, 16, 0);
const n = cab.readInt32LE(4), w = cab.readInt32LE(8), h = cab.readInt32LE(12);
// AlvaAR arma la focal desde un "fov" con su cuenta propia (ver web/index.html):
// en horizontal hay que pasarle el campo horizontal real dividido el aspecto.
const fovH = 2 * Math.atan(w / 2 / Number(fxTxt)) * 180 / Math.PI;
const alva = await AlvaAR.Initialize(w, h, fovH / (w / h));
const tam = 8 + w * h, buf = Buffer.alloc(tam);
const rgba = new Uint8ClampedArray(w * h * 4);
const lineas = [], tiempos = [];
for (let i = 0; i < Math.min(n, tope); i++) {
  fs.readSync(fd, buf, 0, tam, 16 + i * tam);
  const t = buf.readDoubleLE(0);
  for (let j = 0; j < w * h; j++) { const v = buf[8 + j]; rgba[j * 4] = rgba[j * 4 + 1] = rgba[j * 4 + 2] = v; rgba[j * 4 + 3] = 255; }
  const t0 = performance.now();
  const pose = alva.findCameraPose({ data: rgba, width: w, height: h });
  tiempos.push(performance.now() - t0);
  if (pose) {
    // La matriz de AlvaAR es la pose de la cámara (columna mayor); se guarda la posición de la cámara.
    const m = Array.from(pose);
    const R = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
    const tr = R[0][0] + R[1][1] + R[2][2];
    const qw = Math.sqrt(Math.max(0, 1 + tr)) / 2 || 1;
    const qx = (R[2][1] - R[1][2]) / (4 * qw), qy = (R[0][2] - R[2][0]) / (4 * qw), qz = (R[1][0] - R[0][1]) / (4 * qw);
    lineas.push([t.toFixed(6), m[12], m[13], m[14], qx, qy, qz, qw].join(" "));
  }
}
fs.writeFileSync(salida, lineas.join("\n") + "\n");
const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
console.log(`cuadros ${tiempos.length} · con pose ${lineas.length} · ${prom.toFixed(1)} ms de promedio`);
