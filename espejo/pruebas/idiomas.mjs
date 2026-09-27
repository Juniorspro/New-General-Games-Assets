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
// traducir. Las excepciones se escriben acá con nombre y apellido en vez de
// bajarle el umbral a la prueba: "par" es la misma palabra en los tres idiomas,
// y aflojar la comprobación para que entre esa dejaría pasar también las diez
// que sí son un copiar y pegar.
const IGUALES_A_PROPOSITO = new Set(["hud.par"]);
{
  const iguales = [...base].filter((k) => {
    if (IGUALES_A_PROPOSITO.has(k)) return false;
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
const url = "file://" + path.resolve("espejo-en-un-archivo.html");
const visibles = () => pg.evaluate(() =>
  [...document.querySelectorAll(".pantalla")].filter((e) => !e.hidden).map((e) => e.id));

await pg.goto(url);
await pg.waitForFunction(() => !!window.ESPEJO, { timeout: 30000 });
ch("pregunta el idioma antes del menú", (await visibles()).join() === "p-idioma");
// Todavía no se sabe qué idioma lee el que abrió el juego: el título va en
// los tres, y ninguno marcado la primera vez.
const tit = await pg.$eval("#p-idioma h2", (e) => e.innerText);
ch("el título de la pantalla de idioma va en los tres idiomas",
   ["Elegí tu idioma", "Choose your language", "Escolha seu idioma"].every((x) => tit.includes(x)), tit.replace(/\n/g, " · "));
ch("la primera vez no hay ninguno marcado", (await pg.$$(".idioma-btn.activo")).length === 0);

// Las cinco pestañas y el final, en los tres idiomas, buscando claves crudas.
const marca = /(?:^|\s)(?:doc|idioma|menu|niv|como|hud|fin|tab|tabs|rec|op|cre|err)\.[a-z0-9-]+(?:\s|$)/i;
let anterior = null;
for (const cod of ["pt", "es", "en"]) {
  await pg.goto(url);
  await pg.waitForFunction(() => !!window.ESPEJO, { timeout: 30000 });
  // SALE EN CADA ARRANQUE, con la elección anterior marcada y con el foco.
  if (anterior) {
    const m = await pg.evaluate(() => ({ marcado: [...document.querySelectorAll(".idioma-btn.activo")].map((b) => b.dataset.idioma).join(),
                                         foco: document.activeElement?.dataset?.idioma }));
    ch(`al volver a abrir pregunta otra vez, con ${anterior.toUpperCase()} marcado y con foco`,
       (await visibles()).join() === "p-idioma" && m.marcado === anterior && m.foco === anterior, `${m.marcado} · foco ${m.foco}`);
  }
  await pg.click(`[data-idioma="${cod}"]`);
  await pg.waitForTimeout(250);
  anterior = cod;

  const textos = [];
  for (const p of ["jugar", "records", "opciones", "como", "creditos"]) {
    await pg.click(`[data-pestana="${p}"]`); await pg.waitForTimeout(120);
    textos.push(await pg.$eval("#p-menu", (e) => e.innerText));
  }
  await pg.click('[data-pestana="jugar"]');
  // El final: se gana el primer nivel siguiendo la pista, que es la solución.
  await pg.click(".celda-niv"); await pg.waitForTimeout(250);
  await pg.evaluate(() => {
    const p = window.ESPEJO.partida;
    for (let i = 0; i < 20 && !p.ganado; i++) { const e = p.pista(); if (!e) break; p.tocar(e.c, e.f); }
  });
  // El final lo muestra el manejador del toque, no el bucle: acá se lo
  // destapa a mano para leer sus textos.
  await pg.evaluate(() => {
    const p = window.ESPEJO.partida;
    if (p.ganado) document.querySelector("#p-fin").hidden = false;
  });
  textos.push(await pg.$eval("#p-fin", (e) => e.innerText));

  const crudas = textos.join("\n").split("\n").filter((l) => marca.test(l));
  ch(`en ${cod.toUpperCase()} no queda ninguna clave sin traducir en pantalla`,
     crudas.length === 0, crudas.slice(0, 2).join(" · "));
  ch(`en ${cod.toUpperCase()} el <html lang> queda bien`,
     (await pg.$eval("html", (e) => e.lang)).startsWith(cod));
}

// Borrar el progreso no puede devolverte al inglés ni al volumen de fábrica:
// está guardado en el mismo bulto, y perderlo por resetear un puntaje es un
// castigo que nadie pidió. Se cambia a castellano y se borra con dos toques.
await pg.goto(url);
await pg.waitForFunction(() => !!window.ESPEJO, { timeout: 30000 });
await pg.click('[data-idioma="es"]'); await pg.waitForTimeout(200);
await pg.click('[data-pestana="opciones"]');
await pg.click("#m-borrar"); await pg.click("#m-borrar"); await pg.waitForTimeout(300);
const tras = await pg.evaluate(() => ({ luces: JSON.parse(localStorage.getItem("espejo.v1")).luces,
  idioma: JSON.parse(localStorage.getItem("espejo.v1")).ajustes.idioma, cod: document.querySelector("#m-idioma-cod").textContent }));
ch("borrar (con dos toques) borra las luces y no el idioma",
   Object.keys(tras.luces).length === 0 && tras.idioma === "es" && tras.cod.startsWith("ES"), JSON.stringify(tras));

ch("sin errores de javascript", err.length === 0, err.slice(0, 2).join(" · "));
await nav.close();
console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
