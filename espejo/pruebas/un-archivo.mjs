// El archivo único, abierto desde file:// como lo abriría cualquiera.
//
// Es la prueba que más veces encuentra algo: el empaquetado reescribe imports
// con expresiones regulares, y cuando una no matchea, el archivo sale roto de
// una forma que no se ve leyéndolo.
import { chromium } from "playwright";
import path from "path";
import { readdirSync, readFileSync } from "fs";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// --- que ningún nombre exportado se pierda por el camino ------------------
//
// ESTA PRUEBA EXISTE POR UN ERROR QUE COSTO UNA TARDE. `export const A = 0,
// B = 1;` es una sola línea con dos exportaciones, y el empaquetador se quedaba
// con la primera: en el archivo único, `B` quedaba `undefined` en todos los
// módulos que lo importaban. No falla al cargar — falla la primera vez que
// alguien compara contra `B`, o sea jugando, y comparar contra undefined no
// tira error: simplemente nunca es verdad. En el juego se veía así: tocar un
// espejo no hacía nada, sin ningún mensaje en ninguna consola.
{
  const html = readFileSync(new URL("../espejo-en-un-archivo.html", import.meta.url), "utf8");
  const faltan = [];
  for (const f of readdirSync(new URL("../js/", import.meta.url)).filter((f) => f.endsWith(".js"))) {
    if (f === "main.js") continue;
    const src = readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8");
    const mod = f.replace(/\.js$/, "");
    // El cierre del módulo (`};\n})();`) es parte del patrón a propósito: sin
    // él, la búsqueda se quedaba con el primer `return {` del cuerpo —el de
    // cualquier función de adentro— y daba por faltantes exportaciones que
    // estaban perfectamente puestas.
    const bloque = html.match(new RegExp(
      `const M_${mod} = \\(\\(\\) => \\{[\\s\\S]*?\\n  return \\{([^}]*)\\};\\n\\}\\)\\(\\);`));
    if (!bloque) { faltan.push(`${f}: no está en el archivo`); continue; }
    const puestos = new Set(bloque[1].split(",").map((s) => s.trim()));
    const esperados = new Set();
    for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)/gm))
      esperados.add(m[1]);
    // Sólo declaraciones de UNA línea, sin llaves y sin paréntesis: una de
    // varias líneas es un objeto y una con paréntesis es una función, y en las
    // dos las comas separan otra cosa que exportaciones. Sin ese recorte, la
    // prueba pedía que llegaran al archivo único cosas como "216" —un pedazo de
    // un color— y "v", que es el argumento de una lambda.
    for (const m of src.matchAll(/^export\s+(?:const|let|var)\s+([^;{}()\n]+);\s*$/gm)) {
      const partes = m[1].split(",").map((x) => x.split("=")[0].trim());
      if (partes.every((x) => /^\w+$/.test(x))) for (const x of partes) esperados.add(x);
    }
    for (const n of esperados) if (!puestos.has(n)) faltan.push(`${f}: falta ${n}`);
  }
  ch("todos los nombres que exporta cada módulo llegan al archivo único",
     faltan.length === 0, faltan.slice(0, 4).join(" · "));
}

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 420, height: 820 }, hasTouch: true });
const err = [];
pg.on("pageerror", (e) => err.push(e.message));
pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 140)); });

await pg.goto("file://" + path.resolve("espejo-en-un-archivo.html"));
await pg.waitForFunction(() => !!window.ESPEJO, { timeout: 30000 });
ch("abre desde file:// y arranca", true);

const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
ch("pregunta el idioma antes de nada", !!idi);
if (idi) { await idi.click(); await pg.waitForTimeout(250); }

const sueltos = await pg.evaluate(() => [...document.querySelectorAll("link[href],script[src],img[src]")]
  .map((e) => e.getAttribute("href") || e.getAttribute("src")).filter((u) => u && !u.startsWith("data:")));
ch("no pide ni un archivo suelto", sueltos.length === 0, sueltos.join(", "));

// Y LO QUE PIDE EL JAVASCRIPT TAMBIEN VA ADENTRO. Los módulos resuelven sus
// archivos con `ruta()`, que mira el mapa ARCHIVOS: una entrada que quedó como
// ruta relativa en vez de data: URI da 404 contra file://, el juego no falla
// —dibuja la versión sin textura— y nadie se entera.
const binarios = await pg.evaluate(() => {
  const a = globalThis.ARCHIVOS || {};
  return { total: Object.keys(a).length,
           crudas: Object.entries(a).filter(([, v]) => !String(v).startsWith("data:")).map(([k]) => k) };
});
ch("todos los binarios que pide el código van embebidos",
   binarios.total > 0 && binarios.crudas.length === 0,
   `${binarios.total} archivos · ${binarios.crudas.join(", ")}`);

// Las imágenes del vestido las pide el CSS con `url()`, no el JavaScript: si el
// empaquetador no les cambia la ruta por el data: URI, el pedido sale 404, el
// navegador no tira ningún error y la pantalla se ve igual de bien —sin marco,
// sin título y sin botón— porque atrás hay un degradé que la tapa.
const vestido = await pg.evaluate(async () => {
  const urls = new Set();
  for (const hoja of document.styleSheets)
    for (const r of hoja.cssRules)
      for (const u of (r.style?.cssText || "").matchAll(/url\("?([^")]+)"?\)/g)) urls.add(u[1]);
  for (const im of document.querySelectorAll("img[src]")) urls.add(im.src);
  const fuera = { total: urls.size, rotas: [...urls].filter((u) => !u.startsWith("data:")) };
  await Promise.all([...urls].map((u) => new Promise((listo) => {
    const i = new Image();
    i.onload = () => listo(); i.onerror = () => { fuera.rotas.push("no carga: " + u.slice(0, 40)); listo(); };
    i.src = u;
  })));
  return fuera;
});
ch("las imágenes del vestido van incrustadas y cargan", vestido.total >= 4 && vestido.rotas.length === 0,
   `${vestido.total - vestido.rotas.length}/${vestido.total} ${vestido.rotas.join(" ")}`);

ch("los cuarenta niveles viajan adentro del archivo",
   (await pg.evaluate(() => window.ESPEJO.NIVELES.length)) === 40);

// SE GANA UN NIVEL TOCANDO LA PANTALLA DE VERDAD, no llamando a `tocar`. Lo que
// se prueba es la cuenta que convierte un toque en una celda: la escala del
// lienzo, el centrado del tablero y el tamaño de la celda. Ahí es donde se
// esconden los errores que hacen que el juego "no responda".
await pg.click("#m-seguir");
await pg.waitForTimeout(400);
const donde = await pg.evaluate(() => {
  const p = window.ESPEJO.partida;
  const e = p.pista();
  const n = p.nivel;
  const l = document.querySelector("#lienzo").getBoundingClientRect();
  const esc = l.width / 360;
  // Las mismas cuentas que `medidas()`, hechas afuera a propósito: si se
  // importara la función, un error adentro de ella pasaría desapercibido.
  const alto = Math.round(Math.min(window.innerHeight / esc, 1000));
  const lado = Math.floor(Math.min((360 - 28) / n.ancho, (alto - 150) / n.alto));
  const x0 = Math.round((360 - lado * n.ancho) / 2);
  const y0 = Math.round((alto - lado * n.alto) / 2 + 14);
  return { x: l.x + (x0 + e.c * lado + lado / 2) * esc,
           y: l.y + (y0 + e.f * lado + lado / 2) * esc, par: p.par };
});
await pg.mouse.click(donde.x, donde.y);
await pg.waitForSelector("#p-fin:not([hidden])", { timeout: 20000 });
ch("tocando la pantalla se gana el nivel", true, `par ${donde.par}`);
const fin = await pg.evaluate(() => ({
  toques: document.querySelector("#f-toques").textContent,
  luces: document.querySelector("#f-luces").textContent,
  guardado: JSON.parse(localStorage.getItem("espejo.v1") || "{}").luces,
}));
ch("da tres luces por hacerlo en el par y lo guarda",
   fin.luces === "●●●" && fin.guardado["0"] === 3, `${fin.toques} toques · ${fin.luces}`);

await pg.click("#f-siguiente");
await pg.waitForTimeout(300);
ch("y se pasa al siguiente", (await pg.evaluate(() => window.ESPEJO.partida.numero)) === 1);

// El nivel dos queda abierto y el tres no: el progreso avanza de a uno.
await pg.click("#j-salir");
await pg.waitForTimeout(300);
const mapa = await pg.evaluate(() => {
  const b = [...document.querySelectorAll(".celda-niv")];
  return { total: b.length, cerrados: b.filter((x) => x.disabled).length };
});
ch("el mapa abre de a un nivel por vez", mapa.total === 40 && mapa.cerrados === 38,
   `${40 - mapa.cerrados} abiertos de ${mapa.total}`);

ch("sin errores de javascript", err.length === 0, err.slice(0, 3).join(" · "));
console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
