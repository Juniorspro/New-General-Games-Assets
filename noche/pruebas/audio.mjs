// El sonido horneado: cuánto tarda en hornearse todo (efectos y temas), el nivel de cada tema
// (pico y RMS, sin saturar) y que en vivo suene (medidor a la salida). Además deja los WAV.
import { abrir, salida } from "./comun.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800 });
await pag.evaluate(() => audioDespertar());
await pag.waitForFunction(() => AU.msHorneo != null, null, { timeout: 120000 });
const r = await pag.evaluate(() => {
  const out = { ms: AU.msHorneo, error: AU.error || null, niveles: {} };
  for (const [k, b] of Object.entries(AU.buf)) { const d = b.getChannelData(0); let p = 0, s = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > p) p = v; s += v * v; } out.niveles[k] = { seg: +(d.length / b.sampleRate).toFixed(2), pico: +p.toFixed(2), rms: +Math.sqrt(s / d.length).toFixed(3) }; }
  return out;
});
console.log("horneado en", r.ms, "ms", r.error ? "ERROR " + r.error : "");
for (const [k, v] of Object.entries(r.niveles)) console.log(k.padEnd(12), JSON.stringify(v));
const saturan = Object.entries(r.niveles).filter(([, v]) => v.pico > 1).map(([k]) => k);
console.log(saturan.length ? "SATURAN (se va a limitar con la ganancia): " + saturan.join(", ") : "nada satura");
// los WAV de los temas, para escucharlos
mkdirSync(salida("audio"), { recursive: true });
for (const k of ["tema:titulo", "tema:bosque", "tema:cementerio", "tema:tesoro", "cofre", "subir", "gema", "latigo"]) {
  const b64 = await pag.evaluate((k) => { const b = AU.buf[k], d = b.getChannelData(0), n = d.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, b.sampleRate, true); v.setUint32(28, b.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); }, k);
  writeFileSync(salida(`audio/${k.replace(":", "-")}.wav`), Buffer.from(b64, "base64"));
}
// en vivo: el tema del bosque con un medidor a la salida
const vivo = await pag.evaluate(async () => {
  tocarTema("bosque"); const an = AU.ctx.createAnalyser(); AU.master.connect(an); const d = new Float32Array(2048); let p = 0;
  for (let i = 0; i < 15; i++) { await new Promise((r) => setTimeout(r, 100)); an.getFloatTimeDomainData(d); for (const v of d) p = Math.max(p, Math.abs(v)); sfx("gema"); }
  return { estado: AU.ctx.state, dB: p > 0 ? Math.round(20 * Math.log10(p)) : -999 };
});
console.log("en vivo:", JSON.stringify(vivo));
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].join("\n") : "sin errores");
await nav.close();
