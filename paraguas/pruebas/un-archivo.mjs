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

const sueltos = await pg.evaluate(() => [...document.querySelectorAll("link[href],script[src],img[src]")]
  .map((e) => e.getAttribute("href") || e.getAttribute("src")).filter((u) => u && !u.startsWith("data:")));
ch("no pide ni un archivo suelto", sueltos.length === 0, sueltos.join(", "));

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
