import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
const errores = []; p.on("pageerror", (e) => errores.push(e.message)); p.on("console", (m) => m.type() === "error" && errores.push(m.text()));
await p.route("**/*", (r) => r.request().url().startsWith("file://") ? r.continue() : r.abort());
await p.goto("file://" + process.cwd() + "/estancia.html#fijo");
await p.waitForSelector("#menu:not([hidden])", { timeout: 180000 });
await p.mouse.click(10, 10);
const r = await p.evaluate(async () => {
  __juego.empezar();
  const S = E.sonido; if (!S.listo && S.iniciar) S.iniciar();
  const ctx = new AudioContext(), out = {};
  for (const n of Object.keys(ARCHIVOS).filter((n) => n.startsWith("voz-"))) {
    const d = ARCHIVOS[n], b64 = atob(d.slice(d.indexOf(",") + 1)), u = new Uint8Array(b64.length);
    for (let i = 0; i < b64.length; i++) u[i] = b64.charCodeAt(i);
    try { out[n] = (await ctx.decodeAudioData(u.buffer)).duration.toFixed(2); } catch (e) { out[n] = "ERROR"; }
  }
  S.silbido(); S.voz("silbar-0"); S.latido(); S.clic(); S.lento(1); S.lento(0);
  return { listo: S.listo, n: Object.keys(out).length, malos: Object.entries(out).filter(([, v]) => v === "ERROR"), max: Math.max(...Object.values(out).map(Number)) };
});
console.log(JSON.stringify(r)); console.log(errores.length ? errores.join("\n") : "sin errores");
await b.close();
