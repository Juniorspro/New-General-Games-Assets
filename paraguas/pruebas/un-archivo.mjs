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

await pg.goto("file://" + path.resolve("paraguas-en-un-archivo.html"));
await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
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
await pg.waitForTimeout(600);
ch("arranca la caída", await pg.evaluate(() => !!window.PARAGUAS.partida));

const y0 = await pg.evaluate(() => window.PARAGUAS.partida.y);
await pg.waitForTimeout(700);
const y1 = await pg.evaluate(() => window.PARAGUAS.partida.y);
ch("cae solo", y1 > y0 + 100, `bajó ${Math.round(y1 - y0)} px`);

// El teclado: barra espaciadora cierra.
await pg.keyboard.down("Space");
await pg.waitForTimeout(500);
const cerrado = await pg.evaluate(() => ({ a: window.PARAGUAS.partida.abierto, vy: window.PARAGUAS.partida.vy }));
await pg.keyboard.up("Space");
ch("con la barra se cierra el paraguas y se acelera", cerrado.a < 0.25 && cerrado.vy > 9,
   `abierto=${cerrado.a.toFixed(2)} vy=${cerrado.vy.toFixed(1)}`);

// El pozo se sigue generando para abajo, para siempre.
const filas = await pg.evaluate(() => {
  const p = window.PARAGUAS.partida;
  p.pozo.generarHasta(p.y + 60000);
  return p.pozo.filas.length;
});
ch("el pozo se genera para abajo sin límite", filas > 100, `${filas} filas en 600 m`);

// Y que la caída termine: se le sacan las varillas y se lo mete en una viga.
await pg.evaluate(() => {
  const p = window.PARAGUAS.partida;
  p.varillas = 1;
  const f = p.pozo.siguiente(p.y + 60);
  p.x = 20; p.y = f.y - 40; p.vy = 12;   // contra el borde, lejos del hueco
});
await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 20000 });
ch("chocar termina la caída y muestra el final", true);
const fin = await pg.evaluate(() => ({
  metros: document.querySelector("#f-metros").textContent,
  datos: document.querySelectorAll("#f-lista li").length,
  mejor: JSON.parse(localStorage.getItem("paraguas.v1") || "{}").mejor,
}));
ch("y anota el récord", fin.datos === 4 && fin.mejor > 0, `${fin.metros} · récord ${fin.mejor} m`);

await pg.click("#f-otra");
await pg.waitForTimeout(400);
ch("y se puede volver a caer", await pg.evaluate(() => window.PARAGUAS.partida.metros < 10));

ch("sin errores de javascript", err.length === 0, err.slice(0, 3).join(" · "));
console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
