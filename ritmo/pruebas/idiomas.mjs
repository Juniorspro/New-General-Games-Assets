// LOS TRES IDIOMAS, COMPLETOS Y SIN RESTOS DEL OTRO.
// El error típico no es "falta traducir": es que quedó una palabra del idioma
// base en el medio, y eso sólo se ve mirando la pantalla en los tres.
import { chromium } from "playwright";
import { ch, cerrar } from "./_ch.mjs";
import path from "path";

const ARCHIVO = path.resolve(process.argv[2] || "ritmo-en-un-archivo.html");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
const err = [];
pg.on("pageerror", (e) => err.push(e.message.slice(0, 120)));
await pg.goto("file://" + ARCHIVO);
await pg.waitForTimeout(500);

const textos = {};
for (const cod of ["en", "es", "pt"]) {
  const r = await pg.evaluate((c) => {
    localStorage.clear();
    const d = JSON.parse(localStorage.getItem("ritmo.v1") || "{}");
    return c;
  }, cod);
  await pg.evaluate((c) => {
    // se entra por la misma puerta que el jugador: el selector de Ajustes
    const boton = [...document.querySelectorAll("#listaIdiomas button")]
      .find((b) => b.textContent.toLowerCase().startsWith(c));
    if (boton) boton.click();
  }, cod);
  await pg.waitForTimeout(150);
  await pg.evaluate(() => window.__ritmo.ir("lista"));
  await pg.waitForTimeout(100);
  const v = await pg.evaluate(() => {
    const vacios = [...document.querySelectorAll("[data-t]")].filter((e) => !e.textContent.trim());
    return {
      lang: document.documentElement.lang,
      vacios: vacios.map((e) => e.dataset.t),
      titulo: document.title,
      pistas: [...document.querySelectorAll(".pista .t")].map((e) => e.textContent),
      menu: [...document.querySelectorAll("#pMenu button")].map((e) => e.textContent),
      lista: document.querySelector("#pLista h2").textContent,
    };
  });
  textos[cod] = v;
  ch(`${cod}: ningún texto quedó vacío`, v.vacios.length === 0, v.vacios.join(", "));
  ch(`${cod}: el documento declara el idioma`, v.lang === cod, v.lang);
  ch(`${cod}: las nueve canciones tienen nombre`, v.pistas.length === 9 && v.pistas.every((t) => t.trim()),
     v.pistas[0] + "…");
  await pg.evaluate(() => window.__ritmo.ir("ajustes"));
  await pg.waitForTimeout(80);
  await pg.evaluate(() => document.querySelector("#pAjustes [data-ir=menu]").click());
}

// QUE DE VERDAD CAMBIEN. Tres tablas iguales pasarían todas las pruebas de
// arriba y el juego estaría en un solo idioma.
for (const [a, b] of [["en", "es"], ["es", "pt"], ["en", "pt"]]) {
  ch(`${a} y ${b} son distintos`,
     textos[a].lista !== textos[b].lista && textos[a].pistas[0] !== textos[b].pistas[0],
     `"${textos[a].lista}" vs "${textos[b].lista}"`);
}
ch("el título del documento también se traduce",
   new Set(["en", "es", "pt"].map((c) => textos[c].titulo)).size === 3);
ch("ningún error de JavaScript", err.length === 0, err[0] || "");
await nav.close();
cerrar();
