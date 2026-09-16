// El archivo único, abierto desde file:// como lo abriría cualquiera.
//
// Es la prueba que más veces encontró algo: el empaquetado reescribe imports
// con expresiones regulares, y cuando una no matchea el archivo sale roto de
// una forma que no se ve leyéndolo — página en blanco y un "Unexpected token"
// sin número de línea. Acá se abre y se juega.
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

await pg.goto("file://" + path.resolve("dimension-n-en-un-archivo.html"));
await pg.waitForFunction(() => !!window.DN, { timeout: 30000 });
ch("abre desde file:// y arranca", true);

const sueltos = await pg.evaluate(() => [...document.querySelectorAll("link[href],script[src],img[src]")]
  .map((e) => e.getAttribute("href") || e.getAttribute("src")).filter((u) => u && !u.startsWith("data:")));
ch("no pide ni un archivo suelto", sueltos.length === 0, sueltos.join(", "));

await pg.click("#m-jugar");
await pg.waitForTimeout(500);
ch("arranca el nivel", await pg.evaluate(() => !!window.DN.partida));
ch("tiene los siete capítulos y los siete portales",
   await pg.evaluate(() => window.DN.nivel.caps.length === 7 && window.DN.nivel.portales.length === 7));

// Los dos cuerpos, con sus once puntos cada uno.
const cuerpos = await pg.evaluate(() => ({
  rilo: window.DN.partida.rilo.puntos.length,
  tito: window.DN.partida.tito.puntos.length,
  palos: window.DN.partida.palos.length,
}));
ch("los dos ragdolls están armados", cuerpos.rilo === 11 && cuerpos.tito === 11,
   `${cuerpos.rilo} + ${cuerpos.tito} puntos, ${cuerpos.palos} palos`);

// Cae.
const y0 = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.y);
await pg.waitForTimeout(600);
const y1 = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.y);
ch("cae solo", y1 > y0 + 40, `bajó ${(y1 - y0).toFixed(0)} px`);

// El teclado.
await pg.keyboard.down("ArrowLeft");
const x0 = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.x);
await pg.waitForTimeout(450);
const x1 = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.x);
await pg.keyboard.up("ArrowLeft");
ch("con la flecha izquierda va para la izquierda", x1 < x0 - 12, `${x0.toFixed(0)} → ${x1.toFixed(0)}`);

// El final: se lo deja al lado del último portal y tiene que terminar.
await pg.evaluate(() => {
  const P = window.DN.partida;
  const ult = window.DN.nivel.portales[6];
  P.reiniciarEn(6);
  const dx = ult.x - P.rilo.p.pecho.x, dy = ult.y - 20 - P.rilo.p.pecho.y;
  for (const q of P.rilo.puntos) { q.x += dx; q.y += dy; q.px += dx; q.py += dy; }
});
await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 20000 });
ch("pasar el último portal termina el juego", true);
const fin = await pg.evaluate(() => ({
  charla: document.querySelector("#f-dialogo").textContent.length,
  lista: document.querySelectorAll("#f-lista li").length,
}));
ch("y la pantalla final cuenta el final", fin.charla > 80 && fin.lista === 3,
   `${fin.charla} caracteres de diálogo, ${fin.lista} datos`);

await pg.click("#f-menu");
await pg.waitForSelector("#p-menu:not([hidden])");
ch("y se vuelve al menú", true);

ch("sin errores de javascript", err.length === 0, err.slice(0, 3).join(" · "));
console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
