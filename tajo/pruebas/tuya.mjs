// "Tu canción" con un audio de pulso conocido: la canción propia grabada
// fuera de línea (150 bpm, primer pulso en 1,02 s). Se carga por el mismo
// <input type=file> que usaría alguien en el teléfono.
// uso: node pruebas/tuya.mjs archivo.wav bpm primerPulso
import { chromium } from "playwright";
const [archivo, bpmReal = "150", t0Real = "1.02"] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 } });
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
await pg.goto("http://127.0.0.1:8811/index.html?fijo");
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true);
await pg.click("#btn-tocar");
if (await pg.isVisible("#aviso-seguir")) await pg.click("#aviso-seguir");
await pg.click("#btn-tuya");
const t0 = Date.now();
await pg.setInputFiles("#archivo", archivo);
await pg.waitForSelector("#tuya-listo:not([hidden])", { timeout: 120000 });
const ms = Date.now() - t0;
const r = await pg.evaluate(([bpmR, t0R]) => {
  const c = window.__TAJO.cancionTuya();
  const per = 60 / bpmR;
  const conSigno = c.pulsos.map(t => { const k = Math.round((t - t0R) / per); return t - (t0R + k * per); }).sort((a, b) => a - b);
  const err = conSigno.map(Math.abs).sort((a, b) => a - b);
  const mapas = ["facil", "normal", "dificil", "experto", "expertoMas"].map(d => c.mapaPropio(d).notas.length);
  // Qué tan cerca de un pulso (o semicorchea) real caen los bloques del mapa difícil.
  const notas = c.mapaPropio("dificil").notas;
  const e16 = notas.map(n => { const k = Math.round((n.t - t0R) / (per / 4)); return Math.abs(n.t - (t0R + k * per / 4)); }).sort((a, b) => a - b);
  return { sesgoMs: +(conSigno[conSigno.length >> 1] * 1000).toFixed(1), titulo: c.titulo, bpm: +c.bpm.toFixed(2), pulsos: c.pulsos.length, medianaErrMs: +(err[err.length >> 1] * 1000).toFixed(1),
    dentro30ms: +(err.filter(e => e < 0.03).length / err.length * 100).toFixed(1), secciones: c.secciones.map(s => s.tipo).join(","), mapas,
    bloquesMedianaErrMs: +(e16[e16.length >> 1] * 1000).toFixed(1), bloquesDentro30: +(e16.filter(e => e < 0.03).length / e16.length * 100).toFixed(1),
    estado: document.querySelector("#tuya-estado").textContent };
}, [Number(bpmReal), Number(t0Real)]);
console.log(JSON.stringify({ ...r, msAnalisis: ms }, null, 1));
// El mapa automático tiene que validar y el bot tiene que poder completarlo.
const b = await pg.evaluate(() => {
  const T = window.__TAJO, c = T.cancionTuya();
  const errores = ["facil", "normal", "dificil", "experto", "expertoMas"].map(d => T.validarMapa(c.mapaPropio(d), c).length);
  T.congelar(true);
  T.jugar(0, "experto", { bot: true, reloj: 0, cancion: c });
  for (let i = 0; i < 600 && T.juego.estado === "jugando"; i++) T.simular(1);
  const e = T.estado();
  return { errores, estado: e.estado, cortes: e.stats && e.stats.cortes, total: e.stats && e.stats.total, malos: e.stats && e.stats.malos };
});
console.log("mapas automáticos:", JSON.stringify(b), b.errores.every(x => x === 0) && b.cortes === b.total ? "✓" : "✗");
await nav.close();
