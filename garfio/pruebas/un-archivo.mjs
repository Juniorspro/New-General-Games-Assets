// El archivo único, abierto desde file:// como lo abriría cualquiera.
//
// Es la prueba que más veces encuentra algo: el empaquetado reescribe imports
// con expresiones regulares, y cuando una no matchea, el archivo sale roto de
// una forma que no se ve leyéndolo — página en blanco y un "Unexpected token"
// sin número de línea.
import { chromium } from "playwright";
import path from "path";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 420, height: 820 }, hasTouch: true });
const err = [];
pg.on("pageerror", (e) => err.push(e.message));
pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 140)); });
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

await pg.goto("file://" + path.resolve("garfio-en-un-archivo.html"));
await pg.waitForFunction(() => !!window.GARFIO, { timeout: 30000 });
ch("abre desde file:// y arranca", true);

// La primera pantalla es la de idiomas. Se elige castellano y de acá para
// abajo la prueba es la de siempre.
const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
ch("pregunta el idioma antes de nada", !!idi);
if (idi) { await idi.click(); await pg.waitForTimeout(250); }

const sueltos = await pg.evaluate(() => [...document.querySelectorAll("link[href],script[src],img[src]")]
  .map((e) => e.getAttribute("href") || e.getAttribute("src")).filter((u) => u && !u.startsWith("data:")));
ch("no pide ni un archivo suelto", sueltos.length === 0, sueltos.join(", "));

// EL VESTIDO TIENE QUE CARGAR DE VERDAD, y esto no se ve mirando el archivo.
// El marco, la chapa y el remolino los pide el CSS con `url(...)`, no el
// JavaScript: si el empaquetador no les cambia la ruta por el data: URI, el
// pedido sale 404 contra file://, el navegador no tira ningún error y la
// pantalla se ve igual de bien —sin marco, sin título y sin botón— porque atrás
// hay un degradé que la tapa. La única forma de saberlo es decodificar cada
// imagen y contarlas.
const vestido = await pg.evaluate(async () => {
  const urls = new Set();
  for (const hoja of document.styleSheets)
    for (const r of hoja.cssRules)
      for (const u of (r.style?.cssText || "").matchAll(/url\("?([^")]+)"?\)/g)) urls.add(u[1]);
  for (const im of document.querySelectorAll("img[src]")) urls.add(im.src);
  // Y TIENEN QUE SER data:. Cargar no alcanza: el archivo único se prueba
  // parado al lado de la carpeta assets, así que una ruta relativa sin
  // reescribir encuentra el archivo igual y la prueba pasaría estando roto
  // para cualquiera que se lleve sólo el HTML.
  const fuera = { total: urls.size, rotas: [...urls].filter((u) => !u.startsWith("data:")) };
  await Promise.all([...urls].map((u) => new Promise((listo) => {
    const i = new Image();
    i.onload = () => listo(); i.onerror = () => { fuera.rotas.push("no carga: " + u.slice(0, 40)); listo(); };
    i.src = u;
  })));
  return fuera;
});
ch("las imágenes del vestido van incrustadas y cargan", vestido.total >= 5 && vestido.rotas.length === 0,
   `${vestido.total - vestido.rotas.length}/${vestido.total} ${vestido.rotas.join(" ")}`);

await pg.click("#m-jugar");
await pg.waitForTimeout(500);
ch("arranca la trepada", await pg.evaluate(() => !!window.GARFIO.partida));

// EL PILOTO AUTOMATICO JUEGA ADENTRO DEL ARCHIVO EMPAQUETADO. No alcanza con
// que arranque: el empaquetador reescribe los imports con expresiones
// regulares, y una función que quedó fuera del módulo no falla al cargar —
// falla la primera vez que alguien la llama, o sea jugando.
//
// Se juega una partida APARTE y no la que está corriendo: pisándola a mano se
// le roban los cuadros al bucle de verdad, y sobre todo el bucle es el que mira
// `ev.muerto` para mostrar el final — matándola por afuera, el final no aparece
// nunca y la prueba de abajo se cuelga esperándolo.
const subio = await pg.evaluate(() => {
  const g = window.GARFIO;
  const p = new g.Partida(7);
  for (let i = 0; i < 2600 && p.estado !== "muerto"; i++) p.paso(g.piloto(p));
  return { alto: p.alto, tuercas: p.tuercas };
});
ch("y el piloto sube de verdad jugándolo acá adentro", subio.alto > 900,
   `subió ${Math.round(subio.alto / 100)} m`);

// La torre se sigue generando para arriba, para siempre.
const argollas = await pg.evaluate(() => {
  const p = window.GARFIO.partida;
  p.torre.generarHasta(p.y - 60000);
  return p.torre.argollas.length;
});
ch("la torre se genera para arriba sin límite", argollas > 100, `${argollas} argollas`);

// Y que la partida termine: se lo tira abajo de la cámara y se lo deja al bucle
// de verdad, que es el que se entera y muestra el final.
await pg.evaluate(() => {
  const p = window.GARFIO.partida;
  p.ancla = null; p.y = p.cam + 3000; p.vy = 20; p.alto = Math.max(p.alto, 250);
});
await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 20000 });
ch("caerse termina la partida y muestra el final", true);
const fin = await pg.evaluate(() => ({
  metros: document.querySelector("#f-metros").textContent,
  datos: document.querySelectorAll("#f-lista li").length,
  mejor: JSON.parse(localStorage.getItem("garfio.v1") || "{}").mejor,
}));
ch("y anota el récord", fin.datos === 3 && fin.mejor > 0, `${fin.metros} · récord ${fin.mejor} m`);

await pg.click("#f-otra");
await pg.waitForTimeout(400);
ch("y se puede volver a empezar", await pg.evaluate(() => window.GARFIO.partida.metros < 5));

ch("sin errores de javascript", err.length === 0, err.slice(0, 3).join(" · "));
console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
