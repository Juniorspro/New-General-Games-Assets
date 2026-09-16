// Prueba 2 — la interfaz, tocada de verdad.
//
// La leccion que este repo ya pago una vez: QUE UN ELEMENTO EXISTA NO QUIERE
// DECIR QUE SE PUEDA TOCAR. Un boton puede estar en el DOM, medir 44x21 y no
// recibir un solo toque porque otra capa lo tapa. Por eso cada boton se
// comprueba con document.elementFromPoint en su propio centro: si ahi no
// aparece el boton, algo lo esta tapando.

import { chromium } from "playwright";

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const fallos = [], pasadas = [];
const ok = (n, c, extra = "") => (c ? pasadas : fallos).push(n + (extra ? " — " + extra : ""));

async function tocable(pg, sel) {
  return pg.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return { hay: false };
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { hay: true, tam: [r.width, r.height], tocable: false, motivo: "mide cero" };
    const enc = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      hay: true, tam: [Math.round(r.width), Math.round(r.height)],
      tocable: e === enc || e.contains(enc),
      tapadoPor: enc ? (enc.id || enc.className || enc.tagName) : "nada",
    };
  }, sel);
}

for (const [ancho, alto, nombre] of [[1100, 800, "compu"], [390, 844, "telefono"]]) {
  const pg = await nav.newPage({ viewport: { width: ancho, height: alto },
                                 hasTouch: nombre === "telefono", isMobile: nombre === "telefono" });
  const jsErr = [];
  pg.on("pageerror", (e) => jsErr.push(e.message));
  await pg.goto("http://127.0.0.1:8799/index.html");
  await pg.waitForFunction(() => !!window.PIQUE);

  // --- inicio ---
  for (const s of ["#btn-jugar", "#btn-comojuego", "#btn-ajustes"]) {
    const t = await tocable(pg, s);
    ok(`${nombre} ${s} tocable`, t.tocable, t.tocable ? `${t.tam[0]}x${t.tam[1]}` : `tapado por ${t.tapadoPor}`);
    ok(`${nombre} ${s} mide 44px de alto`, t.tam && t.tam[1] >= 44, `${t.tam?.[1]}px`);
  }
  // Sin scroll horizontal: en el telefono, un pixel de mas y toda la pagina se
  // corre de costado cada vez que el dedo pasa.
  const desborde = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${nombre} sin scroll horizontal`, desborde <= 0, `${desborde}px de sobra`);

  // --- mapa ---
  await pg.click("#btn-jugar");
  await pg.waitForSelector("#p-mapa:not([hidden])");
  const t11 = await tocable(pg, '[data-nivel="1-1"]');
  ok(`${nombre} nivel 1-1 tocable`, t11.tocable, t11.tocable ? `${t11.tam[0]}x${t11.tam[1]}` : `tapado por ${t11.tapadoPor}`);
  const cerrados = await pg.evaluate(() =>
    [...document.querySelectorAll(".nivel")].filter((b) => b.disabled).length);
  ok(`${nombre} mundos 2-6 cerrados al empezar`, cerrados === 20, `${cerrados} cerrados de 24`);

  // --- jugar ---
  await pg.click('[data-nivel="1-1"]');
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 25000 });
  const tl = await tocable(pg, "#lienzo");
  ok(`${nombre} el lienzo recibe el toque`, tl.tocable, tl.tocable ? `${tl.tam[0]}x${tl.tam[1]}` : `tapado por ${tl.tapadoPor}`);
  const ths = await tocable(pg, "#hud-salir");
  ok(`${nombre} boton de salir tocable`, ths.tocable, ths.tocable ? "" : `tapado por ${ths.tapadoPor}`);

  // El HUD no puede tapar el lienzo: es la trampa de este repo, tal cual.
  const choca = await pg.evaluate(() => {
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    const h = document.querySelector(".hud").getBoundingClientRect();
    return !(h.bottom <= l.top || h.top >= l.bottom);
  });
  ok(`${nombre} el HUD no se superpone al lienzo`, !choca);

  // --- el salto de verdad ---
  await pg.waitForTimeout(400);
  const antes = await pg.evaluate(() => window.PIQUE.partida.j.y);
  await pg.keyboard.down("Space");
  await pg.waitForTimeout(220);
  const durante = await pg.evaluate(() => ({ y: window.PIQUE.partida.j.y, suelo: window.PIQUE.partida.j.suelo }));
  await pg.keyboard.up("Space");
  ok(`${nombre} la barra espaciadora hace saltar`, durante.y < antes - 12,
     `subio ${Math.round(antes - durante.y)} px`);

  // El jugador avanza solo: es la premisa del juego.
  const x1 = await pg.evaluate(() => window.PIQUE.partida.j.x);
  await pg.waitForTimeout(500);
  const x2 = await pg.evaluate(() => window.PIQUE.partida.j.x);
  ok(`${nombre} corre solo sin tocar nada`, x2 > x1 + 40, `avanzo ${Math.round(x2 - x1)} px`);

  // El reloj baja.
  const r1 = await pg.evaluate(() => window.PIQUE.partida.reloj);
  await pg.waitForTimeout(400);
  const r2 = await pg.evaluate(() => window.PIQUE.partida.reloj);
  ok(`${nombre} el reloj corre`, r2 < r1, `${Math.round((r1 - r2) / 60 * 100) / 100}s`);

  // Soltar el foco con el dedo apoyado no puede dejarlo saltando para siempre.
  await pg.keyboard.down("Space");
  await pg.evaluate(() => window.dispatchEvent(new Event("blur")));
  const apoyado = await pg.evaluate(() => window.PIQUE.entrada.apoyado);
  ok(`${nombre} perder el foco suelta el salto`, apoyado === false);
  await pg.keyboard.up("Space");

  // --- Escape vuelve al mapa ---
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(150);
  ok(`${nombre} Escape vuelve al mapa`, await pg.isVisible("#p-mapa"));

  ok(`${nombre} sin errores de javascript`, jsErr.length === 0, jsErr.join(" | "));
  await pg.close();
}

// --- la pantalla de resultado ---
{
  const pg = await nav.newPage({ viewport: { width: 1100, height: 800 } });
  await pg.goto("http://127.0.0.1:8799/index.html");
  await pg.waitForFunction(() => !!window.PIQUE);
  await pg.click("#btn-jugar");
  await pg.click('[data-nivel="1-1"]');
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 25000 });
  // Llevar al jugador al mastil y dejar que el juego haga el resto. Rehacer
  // el camino no sirve aca: la partida YA venia corriendo, asi que el camino
  // arrancaria desde la mitad del nivel. La fidelidad del camino la comprueba
  // niveles.mjs, que arma una partida limpia.
  await pg.evaluate(() => {
    const p = window.PIQUE.partida;
    p.bichos = []; p.jefeVivo = false;
    p.j.x = p.nv.mastilX * 16 + 2;
    p.j.y = (p.nv.pisoMastil - 6) * 16;    // agarrarlo alto: prueba el bonus
    p.j.vy = 0;
  });
  await pg.waitForSelector("#p-resultado:not([hidden])", { timeout: 15000 });
  const titulo = await pg.textContent("#res-titulo");
  ok("gana al llegar al mastil", titulo.includes("Llegaste"), titulo);
  for (const s of ["#res-seguir", "#res-repetir", "#res-mapa"]) {
    const t = await tocable(pg, s);
    ok(`resultado ${s} tocable`, t.tocable, t.tocable ? "" : `tapado por ${t.tapadoPor}`);
  }
  const guardado = await pg.evaluate(() => JSON.parse(localStorage.getItem("pique.v1")));
  const bonus = await pg.textContent("#res-lista");
  ok("el bonus del mastil se paga por altura", /Bonus del mástil\s*\+[1-9]/.test(bonus), bonus.replace(/\s+/g, " ").slice(0, 90));
  ok("el progreso se guarda", guardado?.niveles?.["1-1"]?.hecho === true);
  ok("terminar 1-1 no abre el mundo 2", guardado?.desbloqueado === 1, `desbloqueado=${guardado?.desbloqueado}`);
  await pg.close();
}

await nav.close();
console.log(`\n${pasadas.length} comprobaciones pasaron:`);
for (const p of pasadas) console.log("  ✓ " + p);
if (fallos.length) { console.log(`\n${fallos.length} FALLARON:`); for (const f of fallos) console.log("  ✗ " + f); }
console.log(`\n${pasadas.length}/${pasadas.length + fallos.length}`);
process.exit(fallos.length ? 1 : 0);
