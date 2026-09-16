// El selector de idiomas y el panel de ganar.
//
// LO QUE SE PRUEBA DE UNA TRADUCCION NO ES QUE EXISTA EL ARCHIVO: es que no
// falte ninguna clave. Un texto sin traducir no rompe nada —sale la clave
// cruda, "inicio.btn-ajustes" en un boton— y por eso nadie se entera hasta que
// lo ve un jugador. Aca se juntan TODAS las claves que el juego usa de verdad:
// las del HTML se leen del propio documento, asi que agregar un `data-t` nuevo
// y olvidarse de traducirlo deja la prueba en rojo sola.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
const err = []; pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pg.evaluate(() => localStorage.clear());
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// --- la primera vez ------------------------------------------------------
const primero = await pg.evaluate(() => ({
  idioma: !document.querySelector("#p-idioma").hidden,
  menu: !document.querySelector("#p-inicio").hidden,
  botones: [...document.querySelectorAll("#idiomas [data-idioma]")].map((b) => b.dataset.idioma),
  titulo: document.querySelector("#p-idioma h2").textContent,
}));
ch("la primera vez pregunta el idioma ANTES del menu",
   primero.idioma && !primero.menu, `idioma=${primero.idioma} menu=${primero.menu}`);
ch("ofrece los tres", JSON.stringify(primero.botones) === '["en","es","pt"]',
   JSON.stringify(primero.botones));
ch("y pregunta en ingles, que es el idioma por defecto",
   primero.titulo === "Choose your language", primero.titulo);

// --- elegir portugues ----------------------------------------------------
await pg.click('#idiomas [data-idioma="pt"]');
await pg.waitForSelector("#p-inicio:not([hidden])", { timeout: 20000 });
const pt = await pg.evaluate(() => ({
  lang: document.documentElement.lang,
  jugar: document.querySelector("#bt-jugar-txt").textContent,
  niveles: document.querySelector('[data-t="inicio.btn-niveles"]').textContent,
  guardado: JSON.parse(localStorage.getItem("pique.v1") || "{}").ajustes?.idioma,
}));
ch("elegir portugues escribe el menu en portugues",
   pt.jugar === "Jogar" && pt.niveles === "Fases", `${pt.jugar} / ${pt.niveles}`);
ch("y le pone el idioma al documento", pt.lang === "pt-BR", pt.lang);
ch("y queda guardado", pt.guardado === "pt", String(pt.guardado));

// El titulo del nivel del boton Jugar tambien se traduce: sale de la tabla y
// no del `titulo` de mundo.js, que esta en castellano y lo usa el validador.
const subPT = await pg.textContent("#bt-jugar-sub");
ch("el subtitulo del boton Jugar tambien", subPT.includes("Primeiros passos"), subPT);

// --- no vuelve a preguntar ----------------------------------------------
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pg.waitForSelector("#p-inicio:not([hidden])", { timeout: 20000 });
const segunda = await pg.evaluate(() => ({
  idioma: !document.querySelector("#p-idioma").hidden,
  jugar: document.querySelector("#bt-jugar-txt").textContent,
}));
ch("al volver a entrar no lo pregunta de nuevo", !segunda.idioma);
ch("y sigue en portugues", segunda.jugar === "Jogar", segunda.jugar);

// --- cambiarlo desde Ajustes --------------------------------------------
await pg.click("#btn-ajustes"); await pg.waitForSelector("#p-ajustes:not([hidden])");
ch("el ajuste marca el idioma puesto",
   await pg.evaluate(() => document.querySelector('#aj-idioma [data-idioma="pt"]').classList.contains("puesto")));
await pg.click('#aj-idioma [data-idioma="en"]');
await pg.evaluate(() => document.querySelector('#p-ajustes [data-volver="p-inicio"]').click());
await pg.waitForSelector("#p-inicio:not([hidden])");
const en = await pg.textContent("#bt-jugar-txt");
ch("cambiarlo en Ajustes repinta el menu, que se arma en JavaScript",
   en === "Play", en);
await pg.click("#btn-niveles"); await pg.waitForSelector("#p-mapa:not([hidden])");
const mapaEN = await pg.evaluate(() => ({
  mundo: document.querySelector(".cab-mundo h2").textContent,
  rotulo: document.querySelector('[data-nivel="1-1"] .rotulo').textContent,
}));
ch("y el mapa tambien", mapaEN.mundo === "World 1" && mapaEN.rotulo === "First steps",
   `${mapaEN.mundo} / ${mapaEN.rotulo}`);
await pg.evaluate(() => document.querySelector('#p-mapa [data-volver="p-inicio"]').click());
await pg.waitForSelector("#p-inicio:not([hidden])");

// --- que no falte ninguna clave -----------------------------------------
// Las del HTML salen del documento; las que se arman en JavaScript van
// listadas porque no hay forma de leerlas de ningun lado.
const SOLO_JS = ["inicio.jugar", "inicio.seguir", "comun.mundo", "comun.jefe", "comun.terminado",
                 "comun.cerrado", "comun.aqui", "gen.armando", "gen.sinvalidar", "gen.validado1",
                 "gen.validadoN", "carga.sprites", "carga.fondos", "res.gano", "res.perdio",
                 "res.roto", "res.causa.tiempo", "res.causa.pozo", "res.causa.pinche",
                 "res.causa.jefe", "res.causa.otro", "res.monedas", "res.bonus", "res.color",
                 "res.burbujas", "res.tiempo", "res.tiempoDe", "res.total", "res.abierto",
                 "res.abre.violeta", "res.abre.negra", "res.abre.todo", "aj.confirmar",
                 "tier.rosa", "tier.violeta", "tier.negra"];
const faltan = await pg.evaluate(async (soloJS) => {
  const I = await import("/js/idioma.js");
  const delDOM = new Set();
  for (const e of document.querySelectorAll("[data-t]")) delDOM.add(e.dataset.t);
  for (const e of document.querySelectorAll("[data-t-html]")) delDOM.add(e.dataset.tHtml);
  for (const e of document.querySelectorAll("[data-t-attr]"))
    for (const par of e.dataset.tAttr.split(",")) delDOM.add(par.split(":")[1].trim());
  const claves = [...new Set([...delDOM, ...soloJS])];
  const rotas = [];
  const antes = I.idioma();
  for (const cod of ["en", "es", "pt"]) {
    I.ponerIdioma(cod);
    for (const k of claves) if (I.t(k) === k) rotas.push(`${cod}:${k}`);
    // Los 24 titulos y los 8 temas.
    for (let m = 1; m <= 6; m++) for (let n = 1; n <= 4; n++)
      if (!I.tituloNivel({ m, n, titulo: "" })) rotas.push(`${cod}:nivel ${m}-${n}`);
    for (const tm of ["llano", "subte", "cielo", "castillo", "fantasma", "desierto", "nave", "torre"])
      if (I.nombreTema(tm) === tm) rotas.push(`${cod}:tema ${tm}`);
  }
  I.ponerIdioma(antes); I.aplicar();
  return { rotas, claves: claves.length };
}, SOLO_JS);
ch(`las ${faltan.claves} claves estan en los tres idiomas`, faltan.rotas.length === 0,
   faltan.rotas.slice(0, 8).join(", "));

// La ayuda larga: son tres bloques distintos, no el mismo repetido.
const ayudas = await pg.evaluate(async () => {
  const I = await import("/js/idioma.js");
  const antes = I.idioma(); const r = {};
  for (const cod of ["en", "es", "pt"]) { I.ponerIdioma(cod); r[cod] = I.t("ayuda.cuerpo").length; }
  I.ponerIdioma(antes); I.aplicar();
  return r;
});
ch("la ayuda larga esta escrita en los tres",
   Object.values(ayudas).every((n) => n > 2000) &&
   new Set(Object.values(ayudas)).size === 3, JSON.stringify(ayudas));

// --- el panel de ganar ---------------------------------------------------
await pg.evaluate(() => window.PIQUE.empezar(1, 1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
await pg.evaluate(() => { const p = window.PIQUE.partida;
  p.bichos = []; p.jefeVivo = false;
  p.j.x = p.nv.mastilX * 16 + 2; p.j.y = (p.nv.pisoMastil - 5) * 16; p.j.vy = 0; });
await pg.waitForSelector("#p-resultado:not([hidden])", { timeout: 20000 });
const ganado = await pg.evaluate(() => {
  const p = document.querySelector("#res-panel");
  const ve = (s) => { const e = p.querySelector(s); return e && getComputedStyle(e).display !== "none"; };
  return { clase: p.className, titulo: document.querySelector("#res-titulo").textContent,
           rayos: ve(".res-rayos"), estrellas: ve("#res-estrellas"), heroe: ve(".res-heroe"),
           papeles: p.querySelectorAll("#res-confeti i").length,
           llenas: p.querySelectorAll(".estrella.ok").length,
           deTres: p.querySelectorAll(".estrella").length };
});
ch("ganar trae su propio panel decorado",
   ganado.clase.includes("ganado") && ganado.rayos && ganado.estrellas && ganado.heroe,
   JSON.stringify(ganado));
ch("con papelitos", ganado.papeles === 32, `${ganado.papeles} papelitos`);
ch("y tres estrellas, con al menos una ganada",
   ganado.deTres === 3 && ganado.llenas >= 1, `${ganado.llenas}/3`);
ch("el titulo esta traducido", ganado.titulo === "You made it!", ganado.titulo);

// Y perder NO trae nada de eso: el panel sobrio es a proposito.
await pg.evaluate(() => window.PIQUE.empezar(1, 1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
await pg.evaluate(() => { const p = window.PIQUE.partida; p.burbujas = 0; p.reloj = 0; });
await pg.waitForSelector("#p-resultado:not([hidden])", { timeout: 20000 });
const perdido = await pg.evaluate(() => {
  const p = document.querySelector("#res-panel");
  const ve = (s) => { const e = p.querySelector(s); return e && getComputedStyle(e).display !== "none"; };
  return { clase: p.className, rayos: ve(".res-rayos"), estrellas: ve("#res-estrellas"),
           heroe: ve(".res-heroe"), papeles: p.querySelectorAll("#res-confeti i").length,
           titulo: document.querySelector("#res-titulo").textContent };
});
ch("perder deja el panel sobrio",
   perdido.clase.includes("perdido") && !perdido.rayos && !perdido.estrellas &&
   !perdido.heroe && perdido.papeles === 0, JSON.stringify(perdido));

ch("sin errores en la consola", err.length === 0, err.slice(0, 3).join(" · "));
console.log(`\n  ${ok} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
