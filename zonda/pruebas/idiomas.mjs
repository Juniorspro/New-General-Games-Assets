// Los idiomas de ZONDA: la pantalla de idioma sale ANTES del menú en cada
// arranque, con el último elegido marcado; cada idioma cambia la interfaz y
// la historia; y la fuente tiene todas las letras de los tres.
//     node zonda/pruebas/idiomas.mjs [carpeta de capturas]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/opt/node22/lib/node_modules/playwright");

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const capturas = process.argv[2];
if (capturas) fs.mkdirSync(capturas, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ ...devices["Pixel 7"], viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, locale: "pt-BR" });
const pag = await ctx.newPage();
const errores = [];
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 200)); });
let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; };
const visible = (sel) => pag.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0; }, sel);
const cargar = async () => { await pag.goto("file://" + path.join(AQUI, "zonda.html")); await pag.waitForFunction(() => window.__Z && window.__Z.listo, null, { timeout: 20000 }); await pag.waitForTimeout(700); };
const marcado = () => pag.evaluate(() => ["es", "en", "pt"].find((l) => !document.getElementById("bIdioma_" + l).classList.contains("gris")));

await cargar();
ver(await visible("#capaIdioma") && !(await visible("#capaTitulo")), "al abrir, primero se elige idioma (no el menú)");
ver((await marcado()) === "pt", "sin elección previa, viene marcado el idioma del navegador (pt-BR)");
if (capturas) await pag.screenshot({ path: path.join(capturas, "i01-idioma.png") });
const faltan = await pag.evaluate(() => window.__Z.letrasQueFaltan());
ver(!faltan.length, "la fuente tiene todas las letras de los tres idiomas" + (faltan.length ? " (faltan: " + faltan.join(" ") + ")" : ""));

/* el primer botón dice JUGAR, o SEGUIR si ya hay una partida empezada */
const esperado = {
  es: { jugar: ["JUGAR", "SEGUIR"], dialogo: "La abuela Rosa", sala: "Al pie del cerro" },
  en: { jugar: ["PLAY", "CONTINUE"], dialogo: "Grandma Rosa", sala: "At the foot of the mountain" },
  pt: { jugar: ["JOGAR", "CONTINUAR"], dialogo: "A vó Rosa", sala: "No pé da montanha" },
};
for (const l of ["en", "pt", "es"]) {
  await cargar();
  await pag.tap("#bIdioma_" + l); await pag.waitForTimeout(500);
  ver(await visible("#capaTitulo"), `${l}: al elegir, aparece el menú`);
  const boton = await pag.evaluate(() => document.getElementById("bJugar").dataset.px || document.getElementById("bJugar").textContent);
  const t = await pag.evaluate(() => window.__Z.textos());
  ver(esperado[l].jugar.includes(boton) && t.dialogo.startsWith(esperado[l].dialogo) && t.sala === esperado[l].sala, `${l}: menú, diálogos y salas en su idioma (${boton} · ${t.sala})`);
  if (capturas) await pag.screenshot({ path: path.join(capturas, `i-${l}-titulo.png`) });
  if (l === "en") {
    await pag.evaluate(() => window.__Z.empezar(0, 0, {}));
    for (let i = 0; i < 40 && (await pag.evaluate(() => window.__Z.estado())) !== "dialogo"; i++) await pag.evaluate(() => window.__Z.anda(10));
    await pag.evaluate(() => window.__Z.anda(80));
    if (capturas) await pag.screenshot({ path: path.join(capturas, "i-en-dialogo.png") });
  }
}
/* la próxima vez: la pantalla de idioma vuelve a salir, con el último marcado */
await cargar();
ver(await visible("#capaIdioma") && (await marcado()) === "es", "al volver a abrir, sale de nuevo y viene marcado el último (es)");
/* y se puede cambiar desde las opciones */
await pag.tap("#bIdioma_es"); await pag.waitForTimeout(400);
await pag.tap("#bOpciones"); await pag.waitForTimeout(500);
await pag.tap("#bOpcIDIOMA"); await pag.waitForTimeout(300);
ver((await pag.evaluate(() => window.__Z.idioma())) === "en" && (await pag.evaluate(() => document.getElementById("bOpcVolver").dataset.px)) === "BACK", "IDIOMA en las opciones cambia todo al momento");
if (capturas) await pag.screenshot({ path: path.join(capturas, "i-opciones-en.png") });
console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores de consola");
console.log(fallas || errores.length ? `${fallas} prueba(s) mal` : "los tres idiomas andan");
await nav.close();
process.exit(fallas || errores.length ? 1 : 0);
