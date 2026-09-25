// Compara los pulsos de auto.js con los de librosa sobre música real.
import fs from "fs";
import { analizarBuffer } from "../js/auto.js";
const carpeta = process.argv[2];
const ref = JSON.parse(fs.readFileSync(`${carpeta}/librosa.json`, "utf8"));
for (const [nombre, r] of Object.entries(ref)) {
  const b = fs.readFileSync(`${carpeta}/${nombre}`); const sr = b.readUInt32LE(24);
  let o = 12, datos = null; while (o < b.length) { const id = b.toString("ascii", o, o + 4), tam = b.readUInt32LE(o + 4); if (id === "data") { datos = b.subarray(o + 8, o + 8 + tam); break; } o += 8 + tam; }
  const n = datos.length / 2; const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = datos.readInt16LE(i * 2) / 32768;
  const c = await analizarBuffer({ sampleRate: sr, length: n, numberOfChannels: 1, duration: n / sr, getChannelData: () => x }, nombre, null);
  const cerca = (a, B, tol) => a.filter(t => B.some(u => Math.abs(u - t) < tol)).length / a.length;
  const dif = c.pulsos.map(t => { let m = 9; for (const u of r.beats) if (Math.abs(u - t) < Math.abs(m)) m = t - u; return m; }).filter(d => Math.abs(d) < 0.15).sort((a, b) => a - b);
  console.log(`${nombre.padEnd(30)} tajo ${c.bpm.toFixed(1)} bpm · librosa ${r.bpm.toFixed(1)} · pulsos a <50 ms de librosa: ${(cerca(c.pulsos, r.beats, 0.05) * 100).toFixed(0)}% · librosa a <50 ms de tajo: ${(cerca(r.beats, c.pulsos, 0.05) * 100).toFixed(0)}% · desvío mediano ${(dif[dif.length >> 1] * 1000).toFixed(0)} ms`);
}
