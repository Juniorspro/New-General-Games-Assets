// Prueba 1 — los 24 niveles, dentro del navegador.
//
// Genera cada nivel en la pagina de verdad (no en Node) y despues REHACE el
// camino que encontro el validador, cuadro por cuadro, dentro de una partida
// real. Si el juego y el validador no coinciden exactamente, el jugador se
// comeria niveles imposibles con un cartel que dice "validado".

import { chromium } from "playwright";

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage();
const errores = [];
pg.on("pageerror", (e) => errores.push(e.message));
await pg.goto("http://127.0.0.1:8799/index.html");
await pg.waitForFunction(() => !!window.PIQUE);

const res = await pg.evaluate(async () => {
  const { NIVELES, idNivel } = await import("./js/mundo.js");
  const { generarNivel } = await import("./js/generador.js");
  const { Partida, ESTADO } = await import("./js/juego.js");
  const salida = [];
  for (const cfg of NIVELES) {
    for (const tier of ["rosa", "violeta", "negra"]) {
      const t0 = performance.now();
      const nv = generarNivel(cfg, tier);
      const msGen = Math.round(performance.now() - t0);
      // Sin enemigos: el validador comprueba GEOMETRIA, y eso es lo que esta
      // prueba verifica. Un enemigo se esquiva, se pisa o se vaultea; una
      // pared de nueve tiles no. Los enemigos se miden aparte, abajo.
      const p = new Partida(nv, tier);
      p.bichos = []; p.jefeVivo = false;
      let llego = false, cuadros = 0;
      if (nv.camino) {
        let previo = false;
        for (const toque of nv.camino) {
          p.actualizar({ toque, toqueNuevo: toque && !previo });
          previo = toque; cuadros++;
          if (p.estado === ESTADO.MASTIL || p.estado === ESTADO.GANADO) { llego = true; break; }
          if (p.estado === ESTADO.PERDIDO) break;
        }
      }
      // Segunda pasada, ahora CON enemigos, para medir cuanto aguanta el
      // camino ciego. No es un fallo si muere: el camino no los conoce.
      const q = new Partida(generarNivel(cfg, tier), tier);
      let avanceCon = 0, previo2 = false;
      for (const toque of nv.camino ?? []) {
        q.actualizar({ toque, toqueNuevo: toque && !previo2 });
        previo2 = toque;
        avanceCon = Math.max(avanceCon, q.j.x / (nv.mastilX * 16));
        if (q.estado === "ganado" || q.estado === "perdido") break;
      }

      salida.push({
        id: idNivel(cfg.m, cfg.n), tier,
        validado: !nv.validacion.fallo, fallo: nv.validacion.fallo,
        intentos: nv.validacion.intentos, msGen,
        color: nv.monedasColor.length,
        segundos: nv.segundos, optimo: +(nv.validacion.cuadros / 60).toFixed(1),
        rehecho: llego, cuadrosRehechos: cuadros,
        estadoFinal: p.estado, causa: p.causa ?? null,
        enemigos: nv.enemigos.length,
        avanceCiego: Math.round(Math.min(1, avanceCon) * 100),
      });
    }
  }
  return salida;
});

let okGen = 0, okReh = 0, peorMs = 0;
const fallos = [];
for (const r of res) {
  if (r.validado) okGen++; else fallos.push(`${r.id}/${r.tier}: generacion ${r.fallo}`);
  if (r.rehecho) okReh++; else if (r.validado) fallos.push(`${r.id}/${r.tier}: el camino NO se rehizo (${r.estadoFinal}${r.causa ? "/" + r.causa : ""})`);
  if (r.color !== 5) fallos.push(`${r.id}/${r.tier}: ${r.color} monedas de color, deberian ser 5`);
  peorMs = Math.max(peorMs, r.msGen);
}

console.log("id     tier      intentos  gen(ms)  optimo  limite  color  enemigos  rehecho  camino-ciego");
for (const r of res)
  console.log(`${r.id.padEnd(6)} ${r.tier.padEnd(9)} ${String(r.intentos).padStart(5)}  ` +
    `${String(r.msGen).padStart(7)}  ${String(r.optimo).padStart(6)}  ${String(r.segundos).padStart(6)}  ` +
    `${String(r.color).padStart(5)}  ${String(r.enemigos).padStart(8)}  ${(r.rehecho ? "sí" : "NO").padEnd(7)} ${String(r.avanceCiego).padStart(3)}%`);

console.log(`\ngenerados y validados: ${okGen}/${res.length}`);
console.log(`caminos rehechos en el juego real: ${okReh}/${res.length}`);
console.log(`peor tiempo de generacion: ${peorMs} ms`);
console.log(`errores de javascript: ${errores.length ? errores.join(" | ") : "ninguno"}`);
if (fallos.length) { console.log("\nFALLOS:"); fallos.forEach((f) => console.log("  - " + f)); }
await nav.close();
process.exit(fallos.length || errores.length ? 1 : 0);
