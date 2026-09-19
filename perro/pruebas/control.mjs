// EL JOYSTICK NO SE PUEDE INVERTIR AL DARSE VUELTA.
//
// Se comprueba midiendo lo unico que importa: empujando "arriba", el perro se
// tiene que ALEJAR de la camara. Y tiene que seguir siendo cierto despues de
// girar 180 grados, que es justo donde el control en coordenadas del mundo se
// da vuelta y el de la camara no.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true });
await pg.goto("http://127.0.0.1:8811/index.html");
await pg.waitForFunction(() => window.__perro && window.__perro.est().cargado, { timeout: 60000 });
await pg.evaluate(() => window.__perro.pan(null));
await pg.waitForTimeout(600);

let ok = 0, mal = 0;
const ch = (n,c,d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                             : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

/** Empuja el joystick en (x,y) y devuelve si el perro se alejo de la camara. */
const prueba = async (x, y, seg) => pg.evaluate(([x, y, seg]) => {
  const P = window.__perro.P, cam = window.__perro.camPos();
  const antes = Math.hypot(P.x - cam.x, P.z - cam.z);
  window.__perro.anda(seg, x, y);
  const cam2 = window.__perro.camPos();
  const desp = Math.hypot(P.x - cam2.x, P.z - cam2.z);
  return { antes: +antes.toFixed(2), desp: +desp.toFixed(2) };
}, [x, y, seg]);

const a = await prueba(0, -1, 1.0);
ch("empujando arriba, el perro se aleja de la camara", a.desp > a.antes,
   `de ${a.antes} a ${a.desp}`);

// ahora se lo hace girar media vuelta y se repite: aca es donde el control en
// coordenadas del mundo se invierte
await pg.evaluate(() => window.__perro.anda(2.2, 1, 0.15));
await pg.waitForTimeout(700);
await pg.evaluate(() => window.__perro.anda(2.2, 1, 0.15));
await pg.waitForTimeout(700);
const b = await prueba(0, -1, 1.0);
ch("y sigue alejandose despues de darse vuelta", b.desp > b.antes,
   `de ${b.antes} a ${b.desp}`);

const c = await prueba(0, 1, 0.9);
ch("empujando abajo, se acerca", c.desp < c.antes, `de ${c.antes} a ${c.desp}`);

console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
