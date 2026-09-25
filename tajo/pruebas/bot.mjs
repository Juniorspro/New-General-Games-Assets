// El bot juega cada canción en cada dificultad, en tiempo simulado (sin
// dibujar), y tiene que cortar el 100 %: si no, o el mapa tiene un bloque
// imposible o la lógica de corte no ve lo que se dibuja.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
pg.on("pageerror", e => console.log("PAGEERROR:", e.message, (e.stack || "").split("\n").slice(1, 3).join(" | ")));
await pg.goto("http://127.0.0.1:8811/index.html?fijo");
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true);
const difs = ["facil", "normal", "dificil", "experto", "expertoMas"];
const n = await pg.evaluate(() => window.__TAJO.canciones.length);
let mal = 0;
for (let c = 0; c < n; c++) for (const d of difs) {
  const r = await pg.evaluate(([c, d]) => {
    const T = window.__TAJO;
    T.congelar(true);
    T.jugar(c, d, { bot: true, reloj: 0 });
    const t0 = performance.now();
    let e;
    for (let i = 0; i < 400 && T.juego.estado === "jugando"; i++) e = T.simular(1);
    e = T.estado();
    return { ...e, ms: Math.round(performance.now() - t0), titulo: T.canciones[c].titulo };
  }, [c, d]);
  const st = r.stats || {};
  const ok = r.estado === "fin" && st.cortes === st.total && !st.malos;
  if (!ok) mal++;
  console.log(`${r.titulo.padEnd(15)} ${d.padEnd(10)} ${r.estado.padEnd(7)} cortes ${st.cortes}/${st.total} perdidos ${st.perdidos} malos ${st.malos} bombas ${st.bombas} · ${st.rango} ${(st.precision * 100).toFixed(1)}% · promedio ${st.promedio?.toFixed(1)} · ${r.ms} ms ${ok ? "✓" : "✗"}`);
}
await nav.close();
console.log(mal ? `✗ ${mal} partidas sin completar` : "✓ el bot completa todo");
process.exit(mal ? 1 : 0);
