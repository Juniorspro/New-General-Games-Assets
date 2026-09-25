import fs from "fs";
import { analizarBuffer } from "../js/auto.js";
const S = process.argv[2];
function wav(ruta) {
  const b = fs.readFileSync(ruta); const sr = b.readUInt32LE(24);
  let o = 12, datos = null; while (o < b.length) { const id = b.toString("ascii", o, o + 4), tam = b.readUInt32LE(o + 4); if (id === "data") { datos = b.subarray(o + 8, o + 8 + tam); break; } o += 8 + tam; }
  const n = datos.length / 2; const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = datos.readInt16LE(i * 2) / 32768;
  return { sampleRate: sr, length: n, numberOfChannels: 1, duration: n / sr, getChannelData: () => x };
}
const ref = JSON.parse(fs.readFileSync(`${S}/real/librosa.json`, "utf8"));
const casos = [
  ...Object.entries(ref).map(([n, r]) => ({ nombre: n.slice(0, 10), buf: wav(`${S}/real/${n}`), beats: r.beats })),
  { nombre: "cancion", buf: wav(`${S}/cancion0.wav`), grid: [150, 1.02] },
  { nombre: "house128", buf: wav(`${S}/house128.wav`), grid: [128, 0.5] },
  { nombre: "hiphop92", buf: wav(`${S}/hiphop92.wav`), grid: [92, 0.5] },
];
for (const c of casos) if (c.grid) { const [bpm, t0] = c.grid; c.beats = []; for (let t = t0; t < c.buf.duration; t += 60 / bpm) c.beats.push(t); }
for (const opc of [{ alfa: 120, plantilla: false }, { alfa: 260, plantilla: false }, { alfa: 600, plantilla: false }, { alfa: 120, plantilla: true }, { alfa: 260, plantilla: true }]) {
  globalThis.__autoOpc = opc;
  const fila = [];
  for (const c of casos) {
    const r = await analizarBuffer(c.buf, c.nombre, null);
    const ok = r.pulsos.filter(t => c.beats.some(u => Math.abs(u - t) < 0.05)).length / r.pulsos.length;
    fila.push(`${c.nombre}:${(ok * 100).toFixed(0).padStart(3)}%`);
  }
  console.log(JSON.stringify(opc).padEnd(34), fila.join("  "));
}
