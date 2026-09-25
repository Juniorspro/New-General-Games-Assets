import fs from "fs";
import { analizarBuffer } from "../js/auto.js";
if (process.env.OPC) globalThis.__autoOpc = JSON.parse(process.env.OPC);
const out = {};
for (const ruta of process.argv.slice(2)) {
  const b = fs.readFileSync(ruta); const sr = b.readUInt32LE(24);
  let o = 12, datos = null; while (o < b.length) { const id = b.toString("ascii", o, o + 4), tam = b.readUInt32LE(o + 4); if (id === "data") { datos = b.subarray(o + 8, o + 8 + tam); break; } o += 8 + tam; }
  const n = datos.length / 2; const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = datos.readInt16LE(i * 2) / 32768;
  const c = await analizarBuffer({ sampleRate: sr, length: n, numberOfChannels: 1, duration: n / sr, getChannelData: () => x }, ruta, null);
  out[ruta.split("/").pop()] = { bpm: c.bpm, pulsos: c.pulsos };
}
console.log(JSON.stringify(out));
