// La calidad de dibujo, que es lo unico que decide si el juego se puede jugar
// en un telefono de hace unos anos.
//
// Dibujar al doble de resolucion triplica el costo de un cuadro —medido:
// 0,59 ms contra 1,39 en el nivel mas cargado—. En una computadora sobra
// margen de las dos formas y por eso el problema no se ve desde aca: se ve en
// el telefono, y ahi el juego se arrastra. Lo que se prueba es la salida: que
// el juego MIDA como va y baje solo, y que el jugador pueda fijarlo a mano.
import { chromium } from "playwright";
import { pasarIdioma } from "./_idioma.mjs";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 390, height: 844 } });
const err = []; pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pg.evaluate(() => localStorage.clear());
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pasarIdioma(pg);

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

const lienzo = () => pg.evaluate(() => { const l = document.querySelector("#lienzo");
  return { w: l.width, h: l.height, esc: window.PIQUE.GRAF.esc }; });

const a = await lienzo();
ch("de arranque dibuja al doble de resolucion", a.esc === 2, `${a.w}x${a.h}`);

// El vigilante: se le dan cuadros lentos a mano y tiene que bajar la calidad.
await pg.evaluate(() => window.PIQUE.empezar(1, 1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
const tras = await pg.evaluate(() => {
  const P = window.PIQUE;
  P.VIG.calentando = 0; P.VIG.listo = false; P.VIG.n = 0; P.VIG.lentos = 0;
  for (let i = 0; i < 200; i++) P.vigilar(40);       // 25 cuadros por segundo
  return { esc: P.GRAF.esc, w: document.querySelector("#lienzo").width,
           guardado: JSON.parse(localStorage.getItem("pique.v1") || "{}").ajustes?.graficoAuto };
});
ch("con cuadros lentos baja la resolucion solo", tras.esc === 1, `esc ${tras.esc}, lienzo ${tras.w}px`);
ch("y lo deja anotado para la proxima", tras.guardado === 1, `graficoAuto=${tras.guardado}`);

// Y con cuadros rapidos NO la baja.
await pg.evaluate(() => localStorage.clear());
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pasarIdioma(pg);
await pg.evaluate(() => window.PIQUE.empezar(1, 1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
const rapido = await pg.evaluate(() => {
  const P = window.PIQUE;
  P.VIG.calentando = 0; P.VIG.listo = false; P.VIG.n = 0; P.VIG.lentos = 0;
  for (let i = 0; i < 200; i++) P.vigilar(16.7);
  return { esc: P.GRAF.esc };
});
ch("con cuadros a tiempo no toca nada", rapido.esc === 2, `esc ${rapido.esc}`);

// El ajuste a mano.
await pg.evaluate(() => window.PIQUE.alMapa());
await pg.waitForSelector("#p-mapa:not([hidden])");
await pg.evaluate(() => document.querySelector('#p-mapa [data-volver="p-inicio"]').click());
await pg.waitForSelector("#p-inicio:not([hidden])");
await pg.click("#btn-ajustes"); await pg.waitForSelector("#p-ajustes:not([hidden])");
await pg.click('[data-graf="1"]');
const m1 = await lienzo();
ch("el ajuste Rapido baja la resolucion", m1.esc === 1, `${m1.w}x${m1.h}`);
await pg.click('[data-graf="2"]');
const m2 = await lienzo();
ch("el ajuste Nitido la sube", m2.esc === 2, `${m2.w}x${m2.h}`);
ch("el boton elegido queda marcado",
   await pg.evaluate(() => document.querySelector('[data-graf="2"]').classList.contains("puesto")));

// Y que lo elegido a mano sobreviva a recargar.
await pg.click('[data-graf="1"]');
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pasarIdioma(pg);
const m3 = await lienzo();
ch("y sobrevive a recargar la pagina", m3.esc === 1, `esc ${m3.esc}`);

// El costo de un cuadro, medido de verdad: se fuerza el vaciado del pipeline
// leyendo un pixel, porque si no Chromium encola los comandos y el reloj mide
// el encolado en vez del dibujo.
const ms = await pg.evaluate(async () => {
  const UI = await import("./js/interfaz.js");
  window.PIQUE.calidad(2);
  window.PIQUE.empezar(6, 3);
  await new Promise(r => setTimeout(r, 2200));
  const p = window.PIQUE.partida;
  const c = document.querySelector("#lienzo").getContext("2d");
  const paso = () => { p.actualizar({ toque: false, toqueNuevo: false }); p.dibujar(c); UI.pintarHud(p); };
  for (let i = 0; i < 20; i++) paso();
  c.getImageData(0, 0, 1, 1);
  const t0 = performance.now();
  for (let i = 0; i < 150; i++) paso();
  c.getImageData(0, 0, 1, 1);
  return (performance.now() - t0) / 150;
});
ch("un cuadro entero, al doble de resolucion, entra holgado en el presupuesto",
   ms < 6, `${ms.toFixed(2)} ms · margen ${(16.7 / ms).toFixed(1)}x`);
ch("sin errores de javascript", err.length === 0, err.slice(0, 2).join(" | "));

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
