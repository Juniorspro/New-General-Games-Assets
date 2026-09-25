// Genera dos pistas de batería con pulso conocido para probar "tu canción":
// house a 128 (bombo en cada tiempo) y hip-hop a 92 (bombo sincopado).
// uso: node pruebas/pistas_prueba.mjs carpeta
import fs from "fs";
const carpeta = process.argv[2] || ".";
const SR = 44100;
let semilla = 7;
const azar = () => { semilla = (semilla * 1103515245 + 12345) & 0x7fffffff; return semilla / 0x7fffffff * 2 - 1; };
function pista(bpm, bombo, caja, nombre, dur = 60, t0 = 0.5) {
  const y = new Float32Array(Math.ceil((dur + 1) * SR));
  const per = 60 / bpm, paso = per / 4;
  const sumar = (i0, n, f) => { for (let i = 0; i < n && i0 + i < y.length; i++) y[i0 + i] += f(i / SR); };
  for (let b = 0; b * per < dur; b++) for (let s = 0; s < 4; s++) {
    const k = (b % 4) * 4 + s, t = t0 + b * per + s * paso, i = Math.round(t * SR);
    if (bombo[k] === "x") { let fase = 0; sumar(i, 0.35 * SR, (u) => { fase += 2 * Math.PI * (50 + 110 * Math.exp(-u / 0.03)) / SR; return Math.sin(fase) * Math.exp(-u / 0.12) * 0.9; }); }
    if (caja[k] === "x") sumar(i, 0.2 * SR, (u) => (azar() * 0.6 + Math.sin(2 * Math.PI * 190 * u) * 0.4) * Math.exp(-u / 0.05) * 0.5);
    if (s % 2 === 0) { let prev = 0; sumar(i, 0.05 * SR, (u) => { const r = azar(); const d = r - prev; prev = r; return d * Math.exp(-u / 0.012) * 0.3; }); }
  }
  // Un bajo que cambia cada compás, para que no sea sólo batería.
  const notas = [41.2, 49, 55, 46.2]; let fase = 0;
  for (let i = 0; i < y.length; i++) { const t = i / SR; const f = notas[Math.floor(Math.max(0, t - t0) / (per * 4)) % 4]; fase += 2 * Math.PI * f / SR; y[i] += 0.075 * Math.sign(Math.sin(fase)); }
  let pico = 0; for (const v of y) pico = Math.max(pico, Math.abs(v));
  const pcm = Buffer.alloc(44 + y.length * 2);
  pcm.write("RIFF", 0); pcm.writeUInt32LE(36 + y.length * 2, 4); pcm.write("WAVE", 8); pcm.write("fmt ", 12);
  pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22); pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28);
  pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34); pcm.write("data", 36); pcm.writeUInt32LE(y.length * 2, 40);
  for (let i = 0; i < y.length; i++) pcm.writeInt16LE(Math.round(y[i] / pico * 0.8 * 32767), 44 + i * 2);
  fs.writeFileSync(`${carpeta}/${nombre}`, pcm);
}
pista(128, "x...x...x...x...", "....x.......x...", "house128.wav");
pista(92, "x.....x...x.....", "....x.......x...", "hiphop92.wav");
console.log("listo:", carpeta);
