// Los tres idiomas de LUZ MALA: los faroles del idioma salen primero (siempre,
// con el último elegido marcado), la primera vez viene elegido el idioma del
// navegador, la letra fina tiene todas las letras de los tres, los tres
// tienen los mismos textos (nada sin traducir) y cambiar el idioma cambia el
// menú y las charlas en el momento. Sin errores de consola.
//     node luz-mala/pruebas/idiomas.mjs
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/opt/node22/lib/node_modules/playwright");

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ ...devices["Pixel 7"], viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, locale: "pt-BR" });
const pag = await ctx.newPage();
const errores = [];
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 200)); });
const abrir = async () => {
  await pag.goto("file://" + path.join(AQUI, "luz-mala.html") + "?fijo");
  await pag.waitForFunction(() => window.__L && window.__L.listo, null, { timeout: 20000 });
};

let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; };
const anda = (n) => pag.evaluate((n) => window.__L.anda(n), n);
const menu = () => pag.evaluate(() => window.__L.menu());
const apretar = async (a, n = 2) => { await pag.evaluate((a) => window.__L.entrada(a, true), a); await anda(n); await pag.evaluate((a) => window.__L.entrada(a, false), a); await anda(1); };
const esperar = async (cond, max = 300) => { for (let i = 0; i < max; i += 10) { if (await pag.evaluate(cond)) return true; await anda(10); } return false; };

/* 1. lo primero son los faroles, con el idioma del navegador elegido */
await abrir(); await anda(10);
let m = await menu();
ver(m && m.id === "idioma", "lo primero es la pantalla del idioma");
ver(m && m.items[m.sel] === "pt", `con el navegador en portugués viene elegido el portugués (${m && m.items[m.sel]})`);

/* 2. la letra fina tiene todas las letras de los tres idiomas */
const faltan = await pag.evaluate(() => window.__L.letrasQueFaltan());
ver(faltan.length === 0, `la letra fina tiene todas las letras (faltan: ${faltan.join(" ") || "ninguna"})`);

/* 3. los tres idiomas tienen los mismos textos: nada queda sin traducir */
const T = await pag.evaluate(() => window.__L.textos());
const huecos = [];
const comparar = (a, b, ruta, l) => {
  if (typeof a === "string") { if (typeof b !== "string" || !b.trim()) huecos.push(`${l}:${ruta}`); return; }
  if (Array.isArray(a)) { if (!Array.isArray(b) || b.length !== a.length) { huecos.push(`${l}:${ruta} (largo)`); return; } a.forEach((x, i) => comparar(x, b[i], `${ruta}[${i}]`, l)); return; }
  if (a && typeof a === "object") { if (!b || typeof b !== "object") { huecos.push(`${l}:${ruta}`); return; } for (const k of Object.keys(a)) comparar(a[k], b[k], ruta ? `${ruta}.${k}` : k, l); }
};
for (const l of ["en", "pt"]) { comparar(T.es, T[l], "", l); comparar(T[l], T.es, "", "es←" + l); }
ver(huecos.length === 0, `español, inglés y portugués tienen los mismos textos${huecos.length ? " (faltan: " + huecos.slice(0, 6).join(", ") + ")" : ""}`);
const iguales = Object.keys(T.es.ui).filter((k) => T.es.ui[k] === T.en.ui[k] && T.es.ui[k] === T.pt.ui[k] && /[a-z]{3}/i.test(T.es.ui[k]));
ver(iguales.length <= 2, `el menú no queda igual en los tres (iguales: ${iguales.join(", ") || "ninguno"})`);

/* 4. elegir un farol lleva al título en ese idioma; cada idioma cambia el menú y las charlas */
await apretar("izq"); await anda(3);
m = await menu();
ver(m.items[m.sel] === "en", "la flecha pasa de farol en farol");
await apretar("salto");
await esperar(() => (window.__L.menu() || {}).id === "titulo");
m = await menu();
ver(m && m.id === "titulo" && m.textos[0] === T.en.ui.nueva, `el título sale en inglés (${m && m.textos[0]})`);
ver((await pag.evaluate(() => document.documentElement.lang)) === "en", "la página dice que está en inglés");
for (const l of ["es", "en", "pt"]) {
  await pag.evaluate((l) => window.__L.ponerIdioma(l), l);
  m = await menu();
  ver(m.textos.join("|") === [T[l].ui.nueva, T[l].ui.opciones, T[l].ui.creditos].join("|"), `${l}: el menú cambia en el momento (${m.textos.join(", ")})`);
}
for (const l of ["es", "en", "pt"]) {
  await pag.evaluate((l) => window.__L.ponerIdioma(l), l);
  await pag.evaluate(() => window.__L.empezar("P1", {}));
  await pag.evaluate(() => window.__L.poner(7 * 8, 22 * 8 - 12)); await anda(3);
  await apretar("arr");
  const d = await pag.evaluate(() => window.__L.dialogo());
  ver(d && d.lineas[0] === T[l].charlas.mamboreta[0][0], `${l}: el mamboretá habla en ese idioma («${d && d.lineas[0].slice(0, 32)}…»)`);
  await pag.evaluate(() => { window.__L.J.dialogo = null; window.__L.J.estado = "jugando"; });
}

/* 5. al volver a abrir, los faroles salen otra vez, con el último elegido marcado */
await pag.evaluate(() => window.__L.ponerIdioma("en"));
await abrir(); await anda(10);
m = await menu();
ver(m && m.id === "idioma" && m.items[m.sel] === "en", `al volver, los faroles otra vez con el inglés marcado (${m && m.items[m.sel]})`);

console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores de consola");
console.log(fallas || errores.length ? `${fallas} prueba(s) mal` : "los tres idiomas andan");
await nav.close();
process.exit(fallas || errores.length ? 1 : 0);
