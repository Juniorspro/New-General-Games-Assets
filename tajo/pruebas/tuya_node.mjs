// El análisis de "tu canción" en Node, sobre WAVs de pulso conocido.
// uso: node pruebas/tuya_node.mjs archivo.wav bpm primerPulso [...]
import fs from "fs";
import { analizarBuffer } from "../js/auto.js";
function leerWav(ruta) {
  const b = fs.readFileSync(ruta);
  let o = 12, fmt = null, datos = null;
  while (o < b.length) {
    const id = b.toString("ascii", o, o + 4), tam = b.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { canales: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === "data") datos = b.subarray(o + 8, o + 8 + tam);
    o += 8 + tam + (tam % 2);
  }
  const n = datos.length / 2 / fmt.canales;
  const ch = Array.from({ length: fmt.canales }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.canales; c++) ch[c][i] = datos.readInt16LE((i * fmt.canales + c) * 2) / 32768;
  return { sampleRate: fmt.sr, length: n, numberOfChannels: fmt.canales, duration: n / fmt.sr, getChannelData: (c) => ch[c] };
}
globalThis.setTimeout ??= (f) => f();
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 3) {
  const [ruta, bpmR, t0R] = [args[i], Number(args[i + 1]), Number(args[i + 2])];
  const c = await analizarBuffer(leerWav(ruta), ruta.split("/").pop(), null);
  const per = 60 / bpmR;
  const s = c.pulsos.map(t => { const k = Math.round((t - t0R) / per); return t - (t0R + k * per); }).sort((a, b) => a - b);
  const e = s.map(Math.abs).sort((a, b) => a - b);
  console.log(`${ruta.split("/").pop().padEnd(14)} bpm ${c.bpm.toFixed(2)} (real ${bpmR})  sesgo ${(s[s.length >> 1] * 1000).toFixed(1)} ms  mediana ${(e[e.length >> 1] * 1000).toFixed(1)} ms  <30ms ${(e.filter(x => x < 0.03).length / e.length * 100).toFixed(0)}%  secciones ${c.secciones.map(x => x.tipo[0]).join("")}`);
}
