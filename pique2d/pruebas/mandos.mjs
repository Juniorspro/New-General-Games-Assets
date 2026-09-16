// Los botones en pantalla.
//
// Lo que hay que probar de un control tactil no es que exista: es que el toque
// LLEGUE. En un telefono el navegador se queda los toques para hacer scroll o
// para el gesto de "volver atras" salvo que se le diga que no, y un boton que
// responde una de cada tres veces es peor que no tenerlo. Por eso cada caso
// toca de verdad y despues mira el estado del juego.
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

await pg.evaluate(() => window.PIQUE.empezar(1, 1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
await pg.waitForTimeout(400);

for (const sel of ["#mando-saltar", '[data-dir="izq"]', '[data-dir="der"]',
                   '[data-dir="abajo"]', '[data-dir="arriba"]']) {
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
  b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const r = { dir: window.PIQUE.partida.j.dir, giro: window.PIQUE.partida.giroT };
  b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  return r;
});
ch("◀ hace correr para la izquierda", izq.dir === -1, `dir=${izq.dir}`);
ch("y dispara la animacion de pivote", izq.giro > 0, `${izq.giro} cuadros`);

const der = await pg.evaluate(async () => {
  const b = document.querySelector('[data-dir="der"]');
  b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const r = window.PIQUE.partida.j.dir;
  b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  return r;
});
ch("▶ lo devuelve para la derecha", der === 1, `dir=${der}`);

// ▼ frena, y soltarlo devuelve la carrera: NO deja al jugador clavado.
const freno = await pg.evaluate(async () => {
  const p = window.PIQUE.partida; p.j.suelo = true;
  const b = document.querySelector('[data-dir="abajo"]');
  b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  const quieto = Math.abs(p.j.vx) < 0.01;
  b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  return { quieto, vuelve: Math.abs(p.j.vx) > 1 };
});
ch("▼ frena en seco", freno.quieto);
ch("y soltarlo devuelve la carrera", freno.vuelve);

// Sin tocar la cruceta SIGUE CORRIENDO SOLO: es lo que hace que se pueda
// jugar con un dedo, y lo que el validador da por hecho.
const solo = await pg.evaluate(async () => {
  const p = window.PIQUE.partida; const x0 = p.j.x;
  for (let i = 0; i < 20; i++) await new Promise(r => requestAnimationFrame(r));
  return p.j.x - x0;
});
ch("sin tocar nada sigue corriendo solo", Math.abs(solo) > 8, `avanzo ${solo.toFixed(0)} px`);

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
