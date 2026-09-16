// Prueba 3 — el archivo unico, abierto como lo abriria una persona.
//
// Con file:// y NO con http://. Es el punto entero de este archivo: si se
// prueba por http se prueba otra cosa, y el CORS de los modulos —que es lo
// que el empaquetado viene a resolver— no aparece nunca.

import { chromium } from "playwright";
import path from "path";

const archivo = "file://" + path.resolve("pique-en-un-archivo.html");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 1000, height: 700 } });
const err = [];
pg.on("pageerror", (e) => err.push(e.message));
pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text()); });

const fallos = [], ok = [];
const chequear = (n, c, extra = "") => (c ? ok : fallos).push(n + (extra ? ` — ${extra}` : ""));

await pg.goto(archivo);
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 10000 });
chequear("abre desde file:// y arranca", true, archivo.split("/").pop());
// Lo que importa no es que no haya ningun href, sino que no haya ninguno que
// salga a buscar un archivo. El icono va embebido como data: y eso vale.
const externos = await pg.evaluate(() =>
  [...document.querySelectorAll("link[href],script[src],img[src]")]
    .map((e) => e.getAttribute("href") || e.getAttribute("src"))
    .filter((u) => u && !u.startsWith("data:")));
chequear("no pide ni un archivo suelto", externos.length === 0, externos.join(", "));

await pg.click("#btn-jugar");
await pg.waitForSelector("#p-mapa:not([hidden])");
chequear("el mapa lista los 24 niveles",
  (await pg.$$(".nivel")).length === 24, `${(await pg.$$(".nivel")).length}`);

await pg.click('[data-nivel="1-1"]');
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 25000 });
chequear("genera y valida un nivel", /validado/.test(await pg.textContent("#hud-gen")),
  await pg.textContent("#hud-gen"));

const y0 = await pg.evaluate(() => window.PIQUE.partida.j.y);
await pg.keyboard.down("Space"); await pg.waitForTimeout(220);
const y1 = await pg.evaluate(() => window.PIQUE.partida.j.y);
await pg.keyboard.up("Space");
chequear("salta", y1 < y0 - 12, `subio ${Math.round(y0 - y1)} px`);

const x0 = await pg.evaluate(() => window.PIQUE.partida.j.x);
await pg.waitForTimeout(450);
chequear("corre solo", await pg.evaluate(() => window.PIQUE.partida.j.x) > x0 + 40);

// Los 24 niveles generados y validados adentro del archivo unico.
const res = await pg.evaluate(() => {
  const salida = [];
  for (const cfg of window.PIQUE.NIVELES) {
    const nv = M_generador.generarNivel(cfg, "rosa");
    salida.push({ ok: !nv.validacion.fallo, color: nv.monedasColor.length });
  }
  return salida;
});
chequear("los 24 niveles validan dentro del archivo unico",
  res.every((r) => r.ok) && res.every((r) => r.color === 5),
  `${res.filter((r) => r.ok).length}/24`);

// localStorage desde file:// puede tirar excepcion segun el navegador. El
// juego tiene que seguir andando igual: guardado.js envuelve cada acceso.
chequear("sobrevive sin poder guardar", await pg.evaluate(() => {
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = () => { throw new Error("bloqueado"); };
  try { M_guardado.guardar(); return true; } catch (e) { return false; }
  finally { Storage.prototype.setItem = orig; }
}));

chequear("sin errores de javascript", err.length === 0, err.join(" | "));
await pg.screenshot({ path: "/tmp/tiro2/un-archivo.png" });
await nav.close();

for (const o of ok) console.log("  ✓ " + o);
for (const f of fallos) console.log("  ✗ " + f);
console.log(`\n${ok.length}/${ok.length + fallos.length}`);
process.exit(fallos.length ? 1 : 0);
