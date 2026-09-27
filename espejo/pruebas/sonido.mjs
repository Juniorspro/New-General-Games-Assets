// La música y los sonidos: que suenen, y sobre todo que SE CALLEN.
//
// El audio de un juego web se rompe de tres maneras y ninguna se ve mirando la
// pantalla: no arranca nunca (el navegador no deja sonar nada sin un gesto y el
// contexto queda "suspended" para siempre), arranca y no para cuando lo apagás,
// o arranca dos veces —dos AudioContext en la misma página— y en un teléfono
// uno de los dos no suena.
//
// COMO SE PRUEBA ALGO QUE NO SE VE. Antes de que cargue la página se le cambia
// `AudioContext` y `Audio` por espías que cuentan cuántos osciladores se
// crearon y qué archivos se pidieron. Con eso, "la música suena" deja de ser
// una impresión y pasa a ser un número.
import { chromium } from "playwright";
import path from "path";

const JUEGO = process.env.JUEGO || "PARAGUAS";
const ARCHIVO = process.env.ARCHIVO || "paraguas-en-un-archivo.html";
// Cómo se entra a una partida en este juego: los tres tienen un botón distinto.
const JUGAR = process.env.JUGAR || "#m-jugar";
// CUANTA MUSICA ES "SUENA" DEPENDE DEL JUEGO, y el umbral tiene que salir del
// diseño y no de un número redondo. Espejo toca una campana cada tres segundos
// a propósito —apurar a alguien que está pensando es la forma más rápida de que
// deje el juego— así que pedirle seis osciladores por segundo sería pedirle que
// sea otro juego.
const VENTANA = Number(process.env.VENTANA || 1100);
const MINIMO = Number(process.env.MINIMO || 6);

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
                                    args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
const err = [];
pg.on("pageerror", (e) => err.push(e.message));
pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 140)); });

await pg.addInitScript(() => {
  window.__espia = { contextos: 0, osciladores: 0, audios: [], reproducciones: 0 };
  const AC = window.AudioContext;
  window.AudioContext = function (...a) {
    window.__espia.contextos++;
    const c = new AC(...a);
    const orig = c.createOscillator.bind(c);
    c.createOscillator = () => { window.__espia.osciladores++; return orig(); };
    return c;
  };
  const A = window.Audio;
  window.Audio = function (src) {
    window.__espia.audios.push(String(src).slice(0, 24));
    const a = new A(src);
    const p = a.play.bind(a);
    a.play = () => { window.__espia.reproducciones++; return p(); };
    return a;
  };
});

await pg.goto("file://" + path.resolve(ARCHIVO));
await pg.waitForFunction((j) => !!window[j], JUEGO, { timeout: 30000 });
const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
if (idi) { await idi.click(); await pg.waitForTimeout(400); }

// EL TEMA DEL MENU VA EMBEBIDO. Si el empaquetador no le cambió la ruta por el
// data: URI, el pedido sale 404 contra file://, el navegador no tira ningún
// error y el juego se ve exactamente igual — sin música.
const tema = await pg.evaluate(() => window.__espia.audios);
ch("el tema del menú se pide", tema.length > 0, tema[0] || "ninguno");
ch("y va embebido como data:, no como archivo suelto",
   tema.length > 0 && tema[0].startsWith("data:audio"), tema[0] || "-");

// UN SOLO AudioContext. Dos en la misma página es el error que hace que en un
// teléfono uno de los dos no suene nunca, y además el botón de silencio
// apagaría sólo la mitad.
await pg.click(JUGAR);
await pg.waitForTimeout(900);
ch("hay un solo AudioContext en toda la página",
   (await pg.evaluate(() => window.__espia.contextos)) === 1,
   `${await pg.evaluate(() => window.__espia.contextos)}`);

// LA MUSICA SE TOCA SOLA: se cuentan los osciladores creados en un segundo de
// juego. Cero osciladores es silencio, y el silencio no se ve.
const antes = await pg.evaluate(() => window.__espia.osciladores);
await pg.waitForTimeout(VENTANA);
const durante = await pg.evaluate(() => window.__espia.osciladores);
ch("la música se toca sola mientras jugás", durante - antes >= MINIMO,
   `${durante - antes} osciladores en ${VENTANA} ms, hacen falta ${MINIMO}`);

// Y SE CALLA. Es la mitad que más se rompe: apagar la música suele apagar el
// volumen y dejar el secuenciador corriendo, que en un teléfono se lleva
// batería por nada y vuelve a sonar solo al cambiar de pantalla.
await pg.click("#j-salir");
await pg.waitForTimeout(250);
await pg.click("[data-volver]");
await pg.waitForTimeout(250);
await pg.uncheck("#aj-musica");
await pg.waitForTimeout(300);
await pg.click(JUGAR);
// SE ESPERA ANTES DE EMPEZAR A CONTAR. Entrar a una partida dispara efectos
// —el toque del botón, el sonido de nivel nuevo— y esos son osciladores que no
// son música: contándolos, la prueba fallaba por sonidos que tenían que sonar.
await pg.waitForTimeout(600);
const q0b = await pg.evaluate(() => window.__espia.osciladores);
await pg.waitForTimeout(VENTANA);
const q1 = await pg.evaluate(() => window.__espia.osciladores);
// Se miran las dos cosas: que el secuenciador esté parado —que es la pregunta
// de verdad— y que casi no haya osciladores. Sólo lo segundo daba falsos
// fallos, porque el juego sigue pasando mientras se mide y cada choque es un
// oscilador; sólo lo primero no comprobaría que además se calló.
const andando = await pg.evaluate(() => globalThis.__musicaAndando && globalThis.__musicaAndando());
ch("apagando la música, el secuenciador para de verdad", andando === false && q1 - q0b <= 2,
   `secuenciador ${andando ? "corriendo" : "parado"}, ${q1 - q0b} osciladores en ${VENTANA} ms`);

// La elección se guarda: un juego que vuelve a poner la música cada vez que lo
// abrís es un juego que hay que callar todas las veces.
await pg.reload();
await pg.waitForFunction((j) => !!window[j], JUEGO, { timeout: 30000 });
ch("y la decisión se guarda",
   (await pg.$eval("#aj-musica", (e) => e.checked)) === false);

// Los efectos siguen sonando con la música apagada: son dos interruptores
// porque son dos cosas distintas — la música es decoración y los efectos son
// información.
await pg.click(JUGAR);
await pg.waitForTimeout(400);
const e0 = await pg.evaluate(() => window.__espia.osciladores);
await pg.evaluate(() => { window.__efe && window.__efe(); });
await pg.waitForTimeout(200);
ch("con la música apagada los efectos siguen sonando",
   (await pg.evaluate(() => window.__espia.osciladores)) > e0,
   "un efecto disparado a mano");

ch("sin errores de javascript", err.length === 0, err.slice(0, 3).join(" · "));
console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
