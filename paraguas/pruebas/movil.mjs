// El teléfono: que entre, que se toque y que el toque LLEGUE.
//
// Acá el dedo es el juego entero —cierra el paraguas y apunta al mismo tiempo—
// así que un toque que no llega no es un detalle de interfaz: es no poder
// jugar. En un teléfono el navegador se queda los arrastres para hacer scroll
// salvo que se le diga que no, y eso se prueba arrastrando de verdad.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

for (const [w, h, nom] of [[390, 844, "parado"], [360, 640, "chico"], [844, 390, "acostado"]]) {
  const pg = await nav.newPage({ viewport: { width: w, height: h }, hasTouch: true,
                                 isMobile: true, deviceScaleFactor: 2 });
  const err = []; pg.on("pageerror", (e) => err.push(e.message));
  pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 120)); });
  await pg.goto("http://127.0.0.1:8804/index.html");
  await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForFunction(() => !!window.PARAGUAS, { timeout: 30000 });

  ch(`${nom} sin scroll horizontal`,
     (await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  for (const sel of ["#m-jugar", "#m-como"]) {
    const t = await pg.evaluate((s) => {
      const e = document.querySelector(s), r = e.getBoundingClientRect();
      const en = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { tocable: e === en || e.contains(en), alto: Math.round(r.height),
               tapa: en ? (en.id || en.className) : "-" };
    }, sel);
    ch(`${nom} ${sel} tocable y de 44 px`, t.tocable && t.alto >= 44,
       t.tocable ? `${t.alto}px` : `tapado por ${t.tapa}`);
  }

  await pg.click("#m-jugar");
  await pg.waitForTimeout(500);
  const caja = await pg.evaluate(() => {
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    return { an: Math.round(l.width), al: Math.round(l.height), dentro: l.top >= -1 && l.left >= -1 };
  });
  ch(`${nom} el lienzo entra en la pantalla`, caja.dentro && caja.an <= w + 1 && caja.al <= h + 1,
     `${caja.an}x${caja.al} en ${w}x${h}`);

  // EL DEDO CIERRA EL PARAGUAS. Se apoya y se sostiene: si el navegador se
  // quedó el toque, el paraguas no se cierra y no hay juego.
  const r = await pg.evaluate(() => document.querySelector("#lienzo").getBoundingClientRect());
  await pg.mouse.move(r.x + r.width * 0.75, r.y + r.height * 0.6);
  await pg.mouse.down();
  await pg.waitForTimeout(500);
  const conDedo = await pg.evaluate(() => ({ abierto: window.PARAGUAS.partida.abierto,
                                             vy: window.PARAGUAS.partida.vy,
                                             x: window.PARAGUAS.partida.x }));
  ch(`${nom} apoyando el dedo se cierra el paraguas`, conDedo.abierto < 0.25,
     `abierto=${conDedo.abierto.toFixed(2)}`);
  ch(`${nom} y se cae más rápido`, conDedo.vy > 9, `vy=${conDedo.vy.toFixed(1)}`);

  // Y apunta: el dedo estaba a la derecha, el personaje tiene que haber ido.
  ch(`${nom} y el personaje va hacia el dedo`, conDedo.x > 200, `x=${Math.round(conDedo.x)}`);

  await pg.mouse.up();
  await pg.waitForTimeout(700);
  const suelto = await pg.evaluate(() => ({ abierto: window.PARAGUAS.partida.abierto,
                                            vy: window.PARAGUAS.partida.vy }));
  ch(`${nom} soltando se abre y frena`, suelto.abierto > 0.8 && suelto.vy < conDedo.vy,
     `abierto=${suelto.abierto.toFixed(2)} vy=${suelto.vy.toFixed(1)}`);

  ch(`${nom} sin errores`, err.length === 0, err.slice(0, 2).join(" · "));
  await pg.close();
}

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
