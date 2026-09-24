// Graba la salida del juego en varias escenas y la guarda en WAV (tiras/audio-*.wav).
import { createRequire } from "module";
import fs from "fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 480, height: 270 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.evaluate(() => {
  __juego.empezar();
  const S = E.sonido, ctx = S._salida.context;
  const sp = ctx.createScriptProcessor(4096, 2, 2);
  window.__grab = []; window.__grabando = false;
  sp.onaudioprocess = (e) => { if (window.__grabando) window.__grab.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
  S._salida.connect(sp); sp.connect(ctx.destination);   // (sale en 0: el processor no copia la entrada a la salida)
  window.__sr = ctx.sampleRate;
});
const escena = async (nombre, prep, ms = 3500) => {
  await p.evaluate(prep);
  await p.evaluate(() => { window.__grab = []; window.__grabando = true; });
  await p.waitForTimeout(ms);
  const datos = await p.evaluate(() => { window.__grabando = false; const n = window.__grab.reduce((a, c) => a + c.length, 0), o = new Float32Array(n); let k = 0; for (const c of window.__grab) { o.set(c, k); k += c.length; } return { sr: window.__sr, s: Array.from(o) }; });
  const n = datos.s.length, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(datos.sr, 24); buf.writeUInt32LE(datos.sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(datos.s[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(`tiras/audio-${nombre}.wav`, buf);
  let pico = 0, sum = 0, clip = 0; for (const x of datos.s) { const a = Math.abs(x); pico = Math.max(pico, a); sum += x * x; if (a > 0.99) clip++; }
  console.log(nombre.padEnd(10), "pico", pico.toFixed(3), "rms dB", (10 * Math.log10(sum / n + 1e-12)).toFixed(1), "recortes", clip, "muestras", n);
};
await escena("quieto", () => {});
await escena("camina", () => { const J = __juego.J(); J.prueba = { az: 1 }; });
await escena("revoleo", () => { const J = __juego.J(); J.prueba = { az: 0 }; const Z = __juego.Z(); Z.estado = "guardado"; Z.tieneLazo = true; Z.equipar && Z.equipar(); Z.empezarRevoleo(); });
await escena("mugidos", () => { const Z = __juego.Z(); Z.cortar && Z.cortar(); const A = __juego.A(), J = __juego.J(); for (let i = 0; i < 3; i++) setTimeout(() => { const v = A.vacas[i]; v.x = J.x + 6; v.z = J.z + 4; E.sonido.mugido(v); }, i * 900); });
await escena("voz", () => { E.juego.decir("enlazada"); setTimeout(() => { E.sonido.silbido(); setTimeout(() => E.juego.decir("silbar"), 1050); }, 1600); }, 4500);
await escena("radio", () => { E.sonido.radio = true; const J = __juego.J(), R = E.estancia.radio; J.x = R.x + 1.5; J.z = R.z + 1.5; });
console.log(errores.length ? errores.join("\n") : "sin errores");
await b.close();
