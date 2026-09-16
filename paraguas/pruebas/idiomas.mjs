// Los tres idiomas: que estén completos y que se vean.
//
// UNA TRADUCCION SE ROMPE SIN HACER RUIDO. Se agrega un botón, se le pone su
// `data-t`, se escribe la clave en castellano y se olvida el inglés: el juego
// no falla, no tira ningún error, y alguien en Brasil ve un `menu.borrar` en
// medio del menú. Por eso acá no se prueba "que traduzca" —eso se ve— sino que
// no falte NINGUNA clave en NINGUN idioma y que en pantalla no quede nunca un
// nombre de clave a la vista.
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// --- las tablas, leídas sin navegador ------------------------------------
const src = fs.readFileSync(new URL("../js/idioma.js", import.meta.url), "utf8");
const claves = {};
for (const cod of ["ES", "EN", "PT"]) {
  const i = src.indexOf(`const ${cod} = {`);
  const j = src.indexOf("\n};", i);
  claves[cod] = [...src.slice(i, j).matchAll(/^\s+"([^"]+)":/gm)].map((m) => m[1]);
}
const base = new Set(claves.EN);
for (const cod of ["ES", "PT"]) {
  const faltan = [...base].filter((k) => !claves[cod].includes(k));
  const sobran = claves[cod].filter((k) => !base.has(k));
  ch(`${cod} tiene las mismas ${base.size} claves que EN`, faltan.length === 0 && sobran.length === 0,
     [...faltan.map((k) => "falta " + k), ...sobran.map((k) => "sobra " + k)].slice(0, 3).join(", "));
}
// Un valor repetido entre idiomas casi siempre es un copiar y pegar sin
// traducir. Se permiten los que de verdad no cambian (siglas, símbolos).
{
  const iguales = [...base].filter((k) => {
    const v = (cod) => src.slice(src.indexOf(`const ${cod} = {`)).match(
      new RegExp(`"${k.replace(/\./g, "\\.")}": "([^"]*)"`))?.[1];
    const a = v("EN"), b = v("PT");
    return a && b && a === b && a.length > 6;
  });
  ch("ningún texto largo quedó igual en EN y PT", iguales.length === 0, iguales.slice(0, 3).join(", "));
}

// --- y en el navegador ---------------------------------------------------
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ viewport: { width: 400, height: 820 }, hasTouch: true });
const pg = await ctx.newPage();
const err = [];
pg.on("pageerror", (e) => err.push(e.message));
const url = "file://" + path.resolve("paraguas-en-un-archivo.html");
const visibles = () => pg.evaluate(() =>
  [...document.querySelectorAll(".pantalla")].filter((e) => !e.hidden).map((e) => e.id));

await pg.goto(url);
await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
ch("la primera vez pregunta el idioma antes del menú",
   (await visibles()).join() === "p-idioma");
ch("y arranca en inglés, no en el idioma del navegador",
   (await pg.$eval("[data-t='idioma.titulo']", (e) => e.textContent)) === "Choose your language");

// Las tres pantallas de texto, en los tres idiomas, buscando claves crudas.
const marca = /(?:^|\s)(?:doc|idioma|menu|como|hud|fin|tramo)\.[a-z0-9-]+(?:\s|$)/i;
for (const cod of ["pt", "es", "en"]) {
  await pg.goto(url);
  await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
  const eligiendo = (await visibles()).includes("p-idioma");
  if (eligiendo) await pg.click(`[data-idioma="${cod}"]`);
  else { while ((await pg.$eval("#m-idioma", (e) => e.textContent)) !== cod.toUpperCase()) await pg.click("#m-idioma"); }
  await pg.waitForTimeout(250);

  const textos = [];
  textos.push(await pg.$eval("#p-menu", (e) => e.innerText));
  await pg.click("#m-como"); await pg.waitForTimeout(150);
  textos.push(await pg.$eval("#p-como", (e) => e.innerText));
  await pg.click("[data-volver]"); await pg.waitForTimeout(150);
  // El final: se lo mata a propósito para poder leer la lista de resultados.
  await pg.click("#m-jugar"); await pg.waitForTimeout(300);
  await pg.evaluate(() => {
    const p = window.PARAGUAS.partida;
    p.varillas = 1;
    const f = p.pozo.siguiente(p.y + 60);
    p.x = 20; p.y = f.y - 40; p.vy = 12;
  });
  await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 20000 });
  textos.push(await pg.$eval("#p-fin", (e) => e.innerText));

  const crudas = textos.join("\n").split("\n").filter((l) => marca.test(l));
  ch(`en ${cod.toUpperCase()} no queda ninguna clave sin traducir en pantalla`,
     crudas.length === 0, crudas.slice(0, 2).join(" · "));
  ch(`en ${cod.toUpperCase()} el <html lang> queda bien`,
     (await pg.$eval("html", (e) => e.lang)).startsWith(cod));
}

// LA ELECCION SE GUARDA Y NO SE VUELVE A PREGUNTAR. Es lo que separa un
// selector de idioma de una molestia: si vuelve a aparecer en cada arranque,
// el juego se abre siempre en una pantalla que no es el juego.
await pg.goto(url);
await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
ch("la segunda vez arranca directo en el menú", (await visibles()).join() === "p-menu");
ch("y se acuerda del idioma elegido", (await pg.$eval("#m-idioma", (e) => e.textContent)) === "EN");

// Borrar el récord no puede devolverte al inglés: está guardado en el mismo
// bulto, y perder el idioma por resetear un puntaje es un castigo que nadie
// pidió.
await pg.click("#m-idioma"); await pg.waitForTimeout(150);     // EN → ES
pg.once("dialog", (d) => d.accept());
await pg.click("#m-borrar"); await pg.waitForTimeout(300);
ch("borrar el récord no borra el idioma", (await pg.$eval("#m-idioma", (e) => e.textContent)) === "ES");

ch("sin errores de javascript", err.length === 0, err.slice(0, 2).join(" · "));
await nav.close();
console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
