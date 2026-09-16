// LOS CUELGUES. No los errores: los CUELGUES.
//
// "Se crashea, queda pegado" no era una excepcion. Una excepcion se atrapa, se
// muestra un cartel y se vuelve al mapa — eso ya estaba. Un bucle que no
// termina no se atrapa con nada: la pestana se congela entera, sin consola,
// sin cartel, sin poder tocar un boton. Es el peor modo de falla que tiene el
// juego y el unico que no deja rastro para diagnosticar.
//
// Por eso se prueba con RELOJ y no con try/catch: cada caso corre adentro de
// un evaluate con tiempo limite. Si el bucle vuelve a quedarse pegado, el
// evaluate no contesta y la prueba falla por tiempo, que es exactamente el
// sintoma que se reporto.
import { chromium } from "playwright";

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage();
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// Cada caso con 5 segundos de techo. El dibujo de un cuadro tarda menos de
// uno; cinco segundos es "se colgo", no "tardo".
async function conReloj(nombre, fn, ms = 5000) {
  try {
    const r = await pg.evaluate(fn, undefined, { timeout: ms });
    ch(nombre, r === true || (r && r.ok), typeof r === "object" ? r.detalle : "");
  } catch (e) {
    ch(nombre, false, String(e.message || e).slice(0, 90));
  }
}

// 1) El fondo con una imagen de ancho cero.
//
// Asi se colgaba: el ancho de cada copia sale de `img.width * (h/img.height)`.
// Con una imagen que carga rota —archivo cortado, data: URI mal armado, un
// onload sobre algo que el navegador no pudo decodificar— eso da cero, el
// bucle avanza de a cero pixeles y no termina JAMAS.
await conReloj("un fondo de ancho cero no cuelga el dibujo", async () => {
  const D = await import("./js/dibujo.js");
  const l = document.createElement("canvas"); l.width = 208; l.height = 448;
  const c = l.getContext("2d");
  const rotas = [
    { width: 0, height: 0 },       // no decodifico nada
    { width: 0, height: 360 },     // ancho cero, alto bueno
    { width: 640, height: 0 },     // alto cero: la escala se va a infinito
    { width: NaN, height: NaN },
  ];
  for (const r of rotas)
    D.fondo(c, "llano", 0, 0, 0, 208, 448, { cielo: r, lejos: r, cerca: r });
  return { ok: true, detalle: `${rotas.length} formas de imagen rota` };
});

// 2) El jugador metido adentro de un solido.
//
// Pasa de verdad: un resorte contra un techo bajo, o un rebote de pared en un
// hueco de un tile. El desencaje subia de a un pixel hasta salir, y adentro de
// una columna solida no salia nunca.
await conReloj("un jugador encajado en la roca muere, no cuelga", async () => {
  const { V, ALTO_TILES, T } = await import("./js/mundo.js");
  const { nuevoJugador, paso } = await import("./js/fisica.js");
  const ancho = 40;
  const nv = { ancho, alto: ALTO_TILES, grilla: new Uint8Array(ancho * ALTO_TILES) };
  nv.grilla.fill(V.SOLIDO);                       // roca maciza de lado a lado
  const j = nuevoJugador(20 * T, 12 * T);
  let n = 0;
  while (j.vivo && n < 600) { paso(j, nv, { toque: false, toqueNuevo: false }); n++; }
  return { ok: !j.vivo && n < 600, detalle: `murio en ${n} cuadros` };
});

// 3) Mil cuadros de partida de verdad, con el dedo apoyado todo el tiempo.
// Es el caso que mas se parece a lo que hace alguien jugando en el telefono.
await conReloj("mil cuadros con el dedo apoyado no cuelgan", async () => {
  const { NIVELES } = await import("./js/mundo.js");
  const { generarNivel } = await import("./js/generador.js");
  const { Partida } = await import("./js/juego.js");
  const nv = generarNivel(NIVELES[4], "rosa");
  const p = new Partida(nv, "rosa", window.PIQUE.hojas, null, {});
  const l = document.createElement("canvas"); l.width = 208; l.height = 448;
  const c = l.getContext("2d");
  for (let i = 0; i < 1000; i++) {
    p.actualizar({ toque: true, toqueNuevo: i % 7 === 0 });
    p.dibujar(c);
  }
  return { ok: true, detalle: `estado ${p.estado}` };
}, 20000);

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
