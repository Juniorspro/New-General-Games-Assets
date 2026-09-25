// Congela el reloj de la partida en varios instantes y saca una captura en
// cada uno (sin bot): para mirar los bloques llegando a la zona de corte.
// uso: node pruebas/_quieto.mjs carpeta dificultad t1 t2 ...
import { chromium } from "playwright";
const [carpeta, dif, ...ts] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
await pg.goto("http://127.0.0.1:8811/index.html?fijo");
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true);
await pg.evaluate((d) => { window.__TAJO.jugar(0, d, { bot: false, reloj: 0 }); window.__TAJO.juego.opciones.sinPerder = true; window.__TAJO.juego.puntaje.sinPerder = true; }, dif);
let k = 0;
for (const t of ts.map(Number)) {
  // Se avanza de a poco hasta t para que las luces y los bloques pasen por su historia.
  const info = await pg.evaluate(async (t) => {
    const J = window.__TAJO.juego;
    // t negativo = "justo antes del bloque que viene después de |t|".
    let objetivo = t;
    if (t < 0) { const n = J.notas.find(n => n.t > -t); objetivo = n.t - 0.035; }
    const t0 = J.relojManual;
    for (let x = t0; x < objetivo - 1.2; x += 0.3) { J.relojManual = x; await new Promise(r => requestAnimationFrame(r)); }
    for (let x = Math.max(t0, objetivo - 1.2); x <= objetivo; x += 0.06) { J.relojManual = x; await new Promise(r => requestAnimationFrame(r)); }
    J.relojManual = objetivo;
    await new Promise(r => requestAnimationFrame(r));
    const vis = J.notas.filter(n => n.visible && n.estado === 1).map(n => ({ t: +n.t.toFixed(2), col: n.col, fila: n.fila, c: n.color, d: n.dir, sx: Math.round(n.sx), sy: Math.round(n.sy), r: Math.round(n.r) }));
    return { objetivo, vis };
  }, t);
  console.log(JSON.stringify(info));
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${carpeta}/q_${k++}.png` });
}
await nav.close();
