// ARRANCAR COLGADO Y APRENDER JUGANDO.
//
// Lo que se comprueba es lo que le pasaba a una persona de verdad: que el juego
// no se pierda solo antes de que puedas hacer algo, y que el cartel diga
// siempre lo unico que falta hacer.
import { chromium } from "playwright";
import path from "path";
let ok = 0, mal = 0;
const ch = (n,c,d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                             : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 400, height: 780 }, hasTouch: true });
const err = [];
pg.on("pageerror", e => err.push(e.message));
pg.on("console", m => { if (m.type()==="error") err.push("consola: "+m.text().slice(0,140)); });
await pg.goto("http://127.0.0.1:" + (process.env.ARCHIVO_PUERTO || 8812) + "/index.html");
await pg.waitForTimeout(1200);
const bi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
if (bi) { await bi.click(); await pg.waitForTimeout(300); }
await pg.click("#m-jugar");
await pg.waitForTimeout(400);

const est = () => pg.evaluate(() => {
  const p = window.__garfio.partida();
  return { atado: p.atado, enganchado: !!p.ancla, tuto: p.tuto,
           y: +p.y.toFixed(1), vx: +p.vx.toFixed(2), estado: p.estado };
});

const a = await est();
ch("arranca colgado de la primera argolla", a.atado === true && a.enganchado,
   JSON.stringify(a));

// SIN TOCAR NADA NO SE PUEDE MORIR. Es el reclamo textual: antes caia infinito.
await pg.waitForTimeout(6000);
const b = await est();
ch("seis segundos sin tocar y sigue vivo", b.estado !== "muerto" && b.enganchado,
   `estado ${b.estado}, y=${b.y}`);
ch("y no se fue cayendo", Math.abs(b.y - a.y) < 30, `se movio ${Math.abs(b.y-a.y).toFixed(1)} px`);
ch("el cartel dice el primer paso", (await pg.$eval("#h-tuto", e => e.hidden)) === false
   && b.tuto === 0);

// paso 0 -> 1: apoyar el dedo
await pg.mouse.move(200, 400);
await pg.mouse.down();
await pg.waitForTimeout(400);
ch("apoyando el dedo pasa al segundo paso", (await est()).tuto === 1);

// paso 1 -> 2: hamacarse de verdad
for (let i = 0; i < 26; i++) {
  await pg.mouse.move(200 + (i % 2 ? 120 : -120), 400);
  await pg.waitForTimeout(120);
}
const c = await est();
ch("hamacandose pasa al tercer paso", c.tuto >= 2, `tuto ${c.tuto}, vx ${c.vx}`);

// paso 2 -> 3: soltar
await pg.mouse.up();
await pg.waitForTimeout(400);
ch("soltando se termina el tutorial", (await est()).tuto === 3);

// y no vuelve a aparecer en la partida siguiente
await pg.waitForTimeout(200);
ch("queda guardado que ya se vio",
   await pg.evaluate(() => JSON.parse(localStorage.getItem("garfio.v1")).tutoHecho === true));

ch("sin errores de javascript", err.length === 0, err.slice(0,2).join(" | "));
console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
