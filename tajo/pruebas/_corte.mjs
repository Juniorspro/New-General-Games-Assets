// Mira un corte cuadro por cuadro: congela el bucle, pone el reloj justo
// antes de un bloque, dibuja un trazo que lo cruza y saca capturas a los
// 0, 40, 120 y 300 ms.
import { chromium } from "playwright";
const [carpeta, dif = "experto", tNota = "55", cancion = "0"] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
await pg.goto("http://127.0.0.1:8811/index.html?fijo");
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true);
await pg.evaluate((c) => { window.__cancion = c; }, cancion);
const info = await pg.evaluate(async ([d, tN]) => {
  const T = window.__TAJO, J = T.juego;
  T.jugar(Number(window.__cancion || 0), d, { bot: false, reloj: 0 });
  J.puntaje.sinPerder = true;
  T.congelar(true);
  const n = J.notas.find(n => n.t > tN);
  let ahora = 1000;
  // Llegar hasta el bloque avanzando el reloj (las luces pasan por su historia).
  for (let x = Math.max(0, n.t - 8); x < n.t - 0.05; x += 0.2) { J.relojManual = x; T.paso(0.2, ahora += 0.2); }
  J.relojManual = n.t - 0.04; T.paso(0.016, ahora += 0.016);
  // El trazo: cruza el bloque en su dirección, largo como un dedo de verdad.
  const V = [[0,1],[0,-1],[-1,0],[1,0],[-0.7071,0.7071],[0.7071,0.7071],[-0.7071,-0.7071],[0.7071,-0.7071],[0,-1]][n.dir];
  const rx = V[0], ry = -V[1], L = 220;
  const pts = [];
  for (let i = 0; i <= 16; i++) { const s = -0.5 + i / 16; pts.push({ x: n.sx + rx * L * s, y: n.sy + ry * L * s, t: ahora - 0.08 + i * 0.005 }); }
  J.entrada.simular(n.color, pts);
  window.__a = ahora;
  return { t: n.t, dir: n.dir, color: n.color, sx: n.sx, sy: n.sy, r: n.r, ahora };
}, [dif, Number(tNota)]);
console.log(JSON.stringify(info));
let k = 0;
for (const dt of [0.012, 0.04, 0.08, 0.18]) {
  await pg.evaluate(([dt]) => { const T = window.__TAJO; T.juego.relojManual += dt; window.__a += dt; T.paso(dt, window.__a); }, [dt]);
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: `${carpeta}/c_${k++}.png` });
}
console.log(JSON.stringify(await pg.evaluate(() => window.__TAJO.estado())));
await nav.close();
