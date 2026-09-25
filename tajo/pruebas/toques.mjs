// Toques de verdad (CDP, Input.dispatchTouchEvent), no eventos sintéticos:
// los sintéticos no traen changedTouches ni pasan por el camino del navegador.
// Cada caso fija el reloj justo antes de un bloque y dibuja un trazo.
//
// OJO CON EL INSTRUMENTO: con el dibujo andando (SwiftShader, ~9 cuadros por
// segundo) el navegador procesa los toques con 300-600 ms de atraso y les pone
// ESA hora: un deslizamiento de 90 ms llega como un arrastre de dos segundos
// y, con razón, no corta. En un teléfono la hora del toque es la del hardware.
// Por eso acá el bucle se congela mientras se toca, y la partida se avanza a
// mano después.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await nav.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
await pg.goto("http://127.0.0.1:8811/index.html?fijo");
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true);
const cdp = await ctx.newCDPSession(pg);
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

await pg.evaluate(() => { const T = window.__TAJO; T.jugar(0, "dificil", { bot: false, reloj: 0 }); T.juego.puntaje.sinPerder = true; T.congelar(true); });
const procesar = () => pg.evaluate(() => { const T = window.__TAJO; for (let i = 0; i < 3; i++) T.paso(0.016, performance.now() / 1000); });

/** Pone el reloj en el bloque y devuelve dónde está en pantalla. */
async function irA(filtro) {
  return pg.evaluate(async (f) => {
    const J = window.__TAJO.juego;
    const fn = new Function("n", "J", "return " + f);
    const cand = J.notas.filter(n => (n.estado === 0 || n.estado === 1) && fn(n, J));
    const n = cand[0];
    const T = window.__TAJO;
    for (let x = J.relojManual; x < n.t - 0.6; x += 0.25) { J.relojManual = x; T.paso(0.25, performance.now() / 1000); }
    // Pasado lo anterior, todo lo que quedó sin cortar se da por perdido.
    J.relojManual = n.t - 0.04;
    T.paso(0.016, performance.now() / 1000); T.paso(0.016, performance.now() / 1000);
    const p = window.__TAJO.estado();
    return { i: n.i, t: n.t, dir: n.dir, color: n.color, sx: n.sx, sy: n.sy, r: n.r, cortes: p.cortes, malos: p.malos, bombas: J.puntaje.bombas,
      otras: J.notas.filter(m => Math.abs(m.t - n.t) < 0.01 && m !== n).map(m => ({ i: m.i, color: m.color, dir: m.dir, sx: m.sx, sy: m.sy })) };
  }, filtro);
}

const V = [[0,1],[0,-1],[-1,0],[1,0],[-0.7071,0.7071],[0.7071,0.7071],[-0.7071,-0.7071],[0.7071,-0.7071],[0,-1]];
async function deslizar(trazos, duracionMs = 90, pasos = 10) {
  // trazos: [{x0,y0,x1,y1}] — uno por dedo, al mismo tiempo.
  const pt = (k) => trazos.map((s, id) => ({ x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, id }));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(0) });
  for (let i = 1; i <= pasos; i++) { await esperar(duracionMs / pasos); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(i / pasos) }); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await esperar(30);
  await procesar();
  await esperar(300);          // que se cierre el "después" de los cortes
  await procesar();
}
const trazoPara = (n, L = 200, girar = 0, corrX = 0) => {
  let [vx, vy] = V[n.dir]; vy = -vy;
  if (girar) { const c = Math.cos(girar), s = Math.sin(girar); [vx, vy] = [vx * c - vy * s, vx * s + vy * c]; }
  return { x0: n.sx - vx * L / 2 + corrX, y0: n.sy - vy * L / 2, x1: n.sx + vx * L / 2 + corrX, y1: n.sy + vy * L / 2 };
};
const estado = () => pg.evaluate(() => { const J = window.__TAJO.juego, p = J.puntaje; return { cortes: p.cortes, malos: p.malos, bombas: p.bombas, perdidos: p.perdidos }; });

let fallas = 0;
const chequear = (nombre, cond, extra) => { console.log(`${cond ? "✓" : "✗"} ${nombre}`, extra ? JSON.stringify(extra) : ""); if (!cond) fallas++; };

// 1. Un corte bien hecho (bloque con flecha, del lado de su color).
let n = await irA("n.dir < 2 && (n.color === 0 ? n.col === 0 : n.col === 3)");
let antes = await estado();
await deslizar([trazoPara(n)]);
let d = await estado();
chequear("corte bien hecho cuenta", d.cortes === antes.cortes + 1 && d.malos === antes.malos, { n, d });

// 2. Dirección al revés.
n = await irA(`n.dir < 2 && n.i > ${n.i} && (n.color === 0 ? n.col === 0 : n.col === 3)`);
antes = await estado();
await deslizar([trazoPara(n, 200, Math.PI)]);
d = await estado();
chequear("corte al revés es mal corte", d.malos === antes.malos + 1 && d.cortes === antes.cortes, { d });

// 3. Arrastre lento por encima: no corta.
n = await irA(`n.dir < 2 && n.i > ${n.i}`);
antes = await estado();
await deslizar([trazoPara(n, 60)], 1400, 14);
d = await estado();
chequear("arrastre lento no corta", d.cortes === antes.cortes && d.malos === antes.malos, { d });

// 4. Sable equivocado: un bloque violeta cortado con un trazo que arranca a la izquierda.
n = await irA(`n.color === 1 && n.dir < 2 && n.i > ${n.i} && n.col === 3`);
antes = await estado();
// Arranca en la mitad izquierda y pasa por el centro del bloque, hacia abajo.
const x0 = 180, y0 = n.sy - 150, ux = n.sx - x0, uy = n.sy - y0;
const corrido = { x0, y0, x1: x0 + ux * 1.4, y1: y0 + uy * 1.4 };
await deslizar([corrido], 110, 12);
d = await estado();
chequear("sable del otro color es mal corte", d.malos === antes.malos + 1, { d, trazo: corrido });

// 5. Dos dedos a la vez sobre un doble.
n = await irA(`J.notas.some(m => m !== n && Math.abs(m.t - n.t) < 0.01) && n.color === 0 && n.i > ${n.i}`);
antes = await estado();
const o = n.otras[0];
await deslizar([trazoPara(n), trazoPara({ ...o, dir: o.dir })]);
d = await estado();
chequear("dos dedos cortan el doble", d.cortes === antes.cortes + 2, { d });

await nav.close();
console.log(fallas ? `✗ ${fallas} casos fallan` : "✓ los toques de verdad andan");
process.exit(fallas ? 1 : 0);
