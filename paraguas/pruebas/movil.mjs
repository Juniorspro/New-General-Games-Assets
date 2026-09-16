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

  // TOCAR CIERRA EL PARAGUAS Y NO MUEVE. Son dos cosas separadas a propósito:
  // cerrar es lo que hay que hacer todo el tiempo, y si tocar arrastrara al
  // personaje hasta el dedo, no se podría caer rápido sin correrse de lugar.
  // Se apoya el dedo LEJOS del personaje y se lo sostiene quieto.
  const r = await pg.evaluate(() => document.querySelector("#lienzo").getBoundingClientRect());
  const antesX = await pg.evaluate(() => window.PARAGUAS.partida.x);
  await pg.mouse.move(r.x + r.width * 0.85, r.y + r.height * 0.6);
  await pg.mouse.down();
  await pg.waitForTimeout(500);
  const conDedo = await pg.evaluate(() => ({ abierto: window.PARAGUAS.partida.abierto,
                                             vy: window.PARAGUAS.partida.vy,
                                             x: window.PARAGUAS.partida.x }));
  ch(`${nom} apoyando el dedo se cierra el paraguas`, conDedo.abierto < 0.25,
     `abierto=${conDedo.abierto.toFixed(2)}`);
  ch(`${nom} y se cae más rápido`, conDedo.vy > 9, `vy=${conDedo.vy.toFixed(1)}`);
  ch(`${nom} y NO se mueve de costado por tocar`, Math.abs(conDedo.x - antesX) < 12,
     `${Math.round(antesX)} → ${Math.round(conDedo.x)}`);

  // Arrastrando sí: lo que manda es cuánto se corrió el dedo, no dónde está.
  await pg.mouse.move(r.x + r.width * 0.85 - 90, r.y + r.height * 0.6, { steps: 10 });
  await pg.waitForTimeout(450);
  const arrastrado = await pg.evaluate(() => window.PARAGUAS.partida.x);
  ch(`${nom} arrastrando sí se mueve`, arrastrado < conDedo.x - 25,
     `${Math.round(conDedo.x)} → ${Math.round(arrastrado)}`);

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
