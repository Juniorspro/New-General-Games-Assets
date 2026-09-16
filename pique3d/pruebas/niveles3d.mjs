// Los 24 niveles x 3 colores, dentro del navegador y con el motor 3D cargado.
//
// Rehace el camino del validador cuadro por cuadro en una Partida REAL —con su
// escena, sus modelos y sus mallas— y comprueba que llegue al mastil. Es la
// misma prueba que la version 2D, y tiene que dar lo mismo: la fisica no
// cambio, solo cambio lo que se ve. Si diera distinto, el 3D habria tocado la
// fisica sin querer y el validador dejaria de valer.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage();
const err = [];
pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8801/index.html");
await pg.waitForFunction(() => !!window.PIQUE3D, { timeout: 60000 });

const res = await pg.evaluate(async () => {
  const { NIVELES, idNivel } = await import("./js/mundo.js");
  const { generarNivel } = await import("./js/generador.js");
  const { Partida, ESTADO } = await import("./js/juego.js");
  const modelos = window.PIQUE3D.modelos;
  const out = [];
  for (const cfg of NIVELES) {
    for (const tier of ["rosa", "violeta", "negra"]) {
      const t0 = performance.now();
      const nv = generarNivel(cfg, tier);
      const msGen = Math.round(performance.now() - t0);
      const p = new Partida(nv, tier, modelos, false);
      p.bichos.forEach(b => b.vivo = false); p.jefeVivo = false;
      let llego = false, prev = false;
      for (const t of nv.camino ?? []) {
        p.actualizar({ toque: t, toqueNuevo: t && !prev }, 1/60); prev = t;
        if (p.estado === ESTADO.MASTIL || p.estado === ESTADO.GANADO) { llego = true; break; }
        if (p.estado === ESTADO.PERDIDO) break;
      }
      out.push({ id: idNivel(cfg.m, cfg.n), tier, validado: !nv.validacion.fallo,
                 msGen, color: nv.monedasColor.length, llego, estado: p.estado,
                 bichos: nv.enemigos.length });
      p.destruir();
    }
  }
  return out;
});

const fallos = [];
let okGen = 0, okReh = 0, peor = 0;
for (const r of res) {
  if (r.validado) okGen++; else fallos.push(`${r.id}/${r.tier}: no valido`);
  if (r.llego) okReh++; else fallos.push(`${r.id}/${r.tier}: no llego (${r.estado})`);
  if (r.color !== 5) fallos.push(`${r.id}/${r.tier}: ${r.color} monedas de color`);
  peor = Math.max(peor, r.msGen);
}
console.log(`generados y validados: ${okGen}/${res.length}`);
console.log(`caminos rehechos en el motor 3D: ${okReh}/${res.length}`);
console.log(`peor tiempo de generacion: ${peor} ms`);
console.log(`errores de javascript: ${err.length ? err.slice(0,4).join(" | ") : "ninguno"}`);
if (fallos.length) { console.log("FALLOS:"); fallos.slice(0,15).forEach(f => console.log("  - " + f)); }
await nav.close();
process.exit(fallos.length || err.length ? 1 : 0);
