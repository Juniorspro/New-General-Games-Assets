// Los botones en pantalla.
//
// Lo que hay que probar de un control tactil no es que exista: es que el toque
// LLEGUE. En un telefono el navegador se queda los toques para hacer scroll o
// para el gesto de "volver atras" salvo que se le diga que no, y un boton que
// responde una de cada tres veces es peor que no tenerlo. Por eso cada caso
// toca de verdad y despues mira el estado del juego.
import { chromium } from "playwright";
import { pasarIdioma } from "./_idioma.mjs";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
const err = []; pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pg.evaluate(() => localStorage.clear());
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pasarIdioma(pg);

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

await pg.evaluate(() => window.PIQUE.empezar(1, 1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
await pg.waitForTimeout(400);

for (const sel of ["#mando-saltar", '[data-dir="izq"]', '[data-dir="der"]']) {
  const caja = await pg.locator(sel).boundingBox();
  ch(`${sel} se ve y es grande`, caja && caja.height >= 44 && caja.width >= 44,
     caja ? `${Math.round(caja.width)}x${Math.round(caja.height)} px` : "no esta");
}

// La cruceta y el boton de salto no pueden taparse ni salirse de la pantalla.
const sitio = await pg.evaluate(() => {
  const a = document.querySelector("#cruceta").getBoundingClientRect();
  const b = document.querySelector("#mando-saltar").getBoundingClientRect();
  const teclas = [...document.querySelectorAll(".dir")].map(e => e.getBoundingClientRect());
  return { separados: a.right <= b.left + 1,
           dentro: a.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && a.top >= 0,
           teclasDentro: teclas.every(r => r.left >= 0 && r.bottom <= innerHeight) };
});
ch("la cruceta y el salto entran en la pantalla y no se pisan",
   sitio.separados && sitio.dentro && sitio.teclasDentro, JSON.stringify(sitio));

// Saltar.
await pg.evaluate(() => { const p = window.PIQUE.partida; p.j.vy = 0; p.j.suelo = true; });
await pg.tap("#mando-saltar");
await pg.waitForTimeout(160);
const salto = await pg.evaluate(() => ({ vy: window.PIQUE.partida.j.vy, saltos: window.PIQUE.partida.j.saltos }));
ch("el boton de saltar hace saltar", salto.saltos >= 1, `vy=${salto.vy.toFixed(1)} saltos=${salto.saltos}`);

// La cruceta manda la direccion: se aprieta ◀ y se mantiene.
const izq = await pg.evaluate(async () => {
  const b = document.querySelector('[data-dir="izq"]');
  b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 9 }));
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const r = { dir: window.PIQUE.partida.j.dir, giro: window.PIQUE.partida.giroT };
  b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 9 }));
  return r;
});
ch("◀ hace correr para la izquierda", izq.dir === -1, `dir=${izq.dir}`);
ch("y dispara la animacion de pivote", izq.giro > 0, `${izq.giro} cuadros`);

const der = await pg.evaluate(async () => {
  const b = document.querySelector('[data-dir="der"]');
  b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 9 }));
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const r = window.PIQUE.partida.j.dir;
  b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 9 }));
  return r;
});
ch("▶ lo devuelve para la derecha", der === 1, `dir=${der}`);

// SOLO DOS FLECHAS. Arriba duplicaba el boton A y abajo frenaba algo que se
// frena solo con soltar el dedo.
ch("no hay flecha arriba ni abajo ni centro",
   await pg.evaluate(() => !document.querySelector('[data-dir="arriba"]') &&
                           !document.querySelector('[data-dir="abajo"]') &&
                           !document.querySelector(".cruceta-centro")));

// EL CASO QUE SE ROMPIA: el pulgar izquierdo sostiene ▶ mientras el derecho
// toca A tres veces para encadenar el triple salto. Soltar A no puede apagar
// la flecha que el OTRO dedo sigue apretando.
const dosDedos = await pg.evaluate(async () => {
  const p = window.PIQUE.partida;
  p.j.x = 60; p.j.y = p.nv.piso * 16; p.j.vy = 0; p.j.suelo = true; p.j.saltos = 0;
  const der = document.querySelector('[data-dir="der"]');
  const a = document.querySelector("#mando-saltar");
  const ev = (el, tipo, id) => el.dispatchEvent(
    new PointerEvent(tipo, { bubbles: true, cancelable: true, pointerId: id, isPrimary: id === 1 }));
  const cuadros = (n) => new Promise(async (ok) => {
    for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); ok();
  });
  ev(der, "pointerdown", 1);           // el pulgar izquierdo se queda en ▶
  await cuadros(6);
  const x0 = p.j.x;
  for (let k = 0; k < 3; k++) {        // tres toques de A, con su dedo propio
    ev(a, "pointerdown", 2);
    await cuadros(4);
    ev(a, "pointerup", 2);
    await cuadros(6);
  }
  const saltos = p.j.saltos;
  await cuadros(10);
  const avanzo = p.j.x - x0;
  const sigue = window.PIQUE.entrada.der;
  ev(der, "pointerup", 1);
  return { avanzo, sigue, saltos };
});
ch("soltar A no cancela la flecha que sostiene el otro dedo", dosDedos.sigue,
   `entrada.der=${dosDedos.sigue}`);
ch("y el personaje siguio avanzando mientras encadenaba saltos",
   dosDedos.avanzo > 30, `avanzo ${Math.round(dosDedos.avanzo)} px, ${dosDedos.saltos} saltos`);

// ▼ ya no existe: frenar es soltar. Se comprueba que soltar ▶ frene.
const freno = await pg.evaluate(async () => {
  const p = window.PIQUE.partida;
  // Se lo baja al piso y se espera a que aterrice: en el aire la velocidad se
  // conserva a proposito —el validador midio los arcos de salto con velocidad
  // constante— asi que soltar la flecha no frena hasta tocar suelo.
  p.j.x = 60; p.j.y = p.nv.piso * 16; p.j.vy = 0; p.j.saltos = 0;
  for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r));
  const der = document.querySelector('[data-dir="der"]');
  const ev = (t, id) => der.dispatchEvent(
    new PointerEvent(t, { bubbles: true, cancelable: true, pointerId: id }));
  ev("pointerdown", 3);
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const corria = Math.abs(p.j.vx) > 1;
  ev("pointerup", 3);
  for (let i = 0; i < 8; i++) await new Promise(r => requestAnimationFrame(r));
  return { corria, quieto: Math.abs(p.j.vx) < 0.01 };
});
ch("soltar ▶ frena", freno.corria && freno.quieto);

// LOS DOS MODOS, y la diferencia entre ellos es TODO el cambio:
//   libre    → sin tocar nada, se queda quieto.
//   corredor → sin tocar nada, corre solo (y es lo que el validador da por
//              hecho cuando demuestra que el nivel se puede terminar).
const avance = async () => pg.evaluate(async () => {
  const p = window.PIQUE.partida; p.j.suelo = true; const x0 = p.j.x;
  for (let i = 0; i < 24; i++) await new Promise(r => requestAnimationFrame(r));
  return p.j.x - x0;
});
const ponerModo = async (modo) => {
  await pg.evaluate((m) => {
    const d = JSON.parse(localStorage.getItem("pique.v1") || "{}");
    d.ajustes = { ...(d.ajustes || {}), auto: m === "auto" };
    localStorage.setItem("pique.v1", JSON.stringify(d));
  }, modo);
  await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
  await pg.evaluate(() => window.PIQUE.empezar(1, 1));
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
  await pg.waitForTimeout(350);
};
await ponerModo("libre");
const quieto = await avance();
ch("en modo libre, sin tocar nada se queda quieto", Math.abs(quieto) < 3,
   `se movio ${quieto.toFixed(1)} px`);
await ponerModo("auto");
const corre = await avance();
ch("en modo corredor, sin tocar nada corre solo", Math.abs(corre) > 8,
   `avanzo ${corre.toFixed(0)} px`);
await ponerModo("libre");

// Un toque en el lienzo sigue saltando: los botones AGREGAN, no reemplazan.
await pg.evaluate(() => { const p = window.PIQUE.partida; p.j.vy = 0; p.j.suelo = true; p.j.saltos = 0; });
await pg.tap("#lienzo", { position: { x: 195, y: 300 } });
await pg.waitForTimeout(160);
ch("tocar el lienzo sigue saltando",
   (await pg.evaluate(() => window.PIQUE.partida.j.saltos)) >= 1);

// Se pueden apagar, y apagarlos no deja al jugador sin saltar.
await pg.evaluate(() => window.PIQUE.alMapa());
await pg.waitForSelector("#p-mapa:not([hidden])");
await pg.evaluate(() => document.querySelector('#p-mapa [data-volver="p-inicio"]').click());
await pg.waitForSelector("#p-inicio:not([hidden])");
await pg.tap("#btn-ajustes"); await pg.waitForSelector("#p-ajustes:not([hidden])");
await pg.evaluate(() => { const c = document.querySelector("#aj-mandos"); c.checked = false;
                          c.dispatchEvent(new Event("change")); });
ch("se pueden apagar desde Ajustes",
   await pg.evaluate(() => document.querySelector("#mandos").hidden));
await pg.evaluate(() => document.querySelector('#p-ajustes [data-volver="p-inicio"]').click());
await pg.waitForSelector("#p-inicio:not([hidden])");
await pg.tap("#btn-jugar");
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
await pg.waitForTimeout(300);
await pg.evaluate(() => { const p = window.PIQUE.partida; p.j.vy = 0; p.j.suelo = true; p.j.saltos = 0; });
await pg.tap("#lienzo", { position: { x: 195, y: 300 } });
await pg.waitForTimeout(160);
ch("y apagados se sigue pudiendo saltar tocando la pantalla",
   (await pg.evaluate(() => window.PIQUE.partida.j.saltos)) >= 1);

// NADA DEL HUD PUEDE CAER ENCIMA DE UN BOTON, en ninguna de las dos
// orientaciones. El nombre del nivel quedaba cruzado por la cruceta y el
// boton de pantalla completa justo abajo de la flecha izquierda: dos cosas
// que no se leen y un boton que se toca sin querer.
await pg.evaluate(() => { const c = document.querySelector("#aj-mandos");
                          c.checked = true; c.dispatchEvent(new Event("change")); });
for (const [w, h, etq] of [[390, 780, "parado"], [780, 390, "acostado"]]) {
  await pg.setViewportSize({ width: w, height: h });
  await pg.evaluate(() => window.PIQUE.empezar(1, 1));
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
  await pg.waitForTimeout(350);
  const pisa = await pg.evaluate(() => {
    const cae = (a, b) => !(a.right <= b.left || a.left >= b.right ||
                            a.bottom <= b.top || a.top >= b.bottom);
    const mandos = [...document.querySelectorAll(".mando")].map(e => e.getBoundingClientRect());
    const out = [];
    for (const sel of [".hud-abajo", ".hud-pantalla", ".hud", ".hud-secundario"]) {
      const e = document.querySelector(sel);
      if (e && mandos.some(m => cae(e.getBoundingClientRect(), m))) out.push(sel);
    }
    return out;
  });
  ch(`${etq}: nada del HUD cae encima de los botones`, pisa.length === 0, pisa.join(", "));
}

ch("sin errores de javascript", err.length === 0, err.slice(0, 2).join(" | "));
console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
