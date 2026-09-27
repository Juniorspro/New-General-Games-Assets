// El teléfono: que entre, que se toque y que el toque LLEGUE.
//
// Un control táctil no se prueba mirando si el botón existe. En un teléfono el
// navegador se queda los arrastres para hacer scroll salvo que se le diga que
// no, y un reactor que recibe un solo evento antes de que le corten el dedo
// responde una de cada tres veces — que es peor que no tener control.
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
  await pg.goto("http://127.0.0.1:8803/index.html");
  await pg.waitForFunction(() => !!window.DN, { timeout: 30000 });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForFunction(() => !!window.DN, { timeout: 30000 });
  // Antes del menú está la pantalla de idioma, en cada arranque.
  await pg.locator(".idioma-btn").nth(0).click();
  await pg.waitForSelector("#p-menu:not([hidden])");

  ch(`${nom} sin scroll horizontal`,
     (await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  for (const sel of ["#m-jugar", "#m-como"]) {
    const t = await pg.evaluate((s) => {
      const e = document.querySelector(s), r = e.getBoundingClientRect();
      const en = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { tocable: e === en || e.contains(en), alto: Math.round(Math.min(r.width, r.height)),
               tapa: en ? (en.id || en.className) : "-" };
    }, sel);
    ch(`${nom} ${sel} tocable y de 44 px`, t.tocable && t.alto >= 44,
       t.tocable ? `${t.alto}px` : `tapado por ${t.tapa}`);
  }

  await pg.click("#m-jugar");
  await pg.waitForTimeout(400);
  const caja = await pg.evaluate(() => {
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    return { an: Math.round(l.width), al: Math.round(l.height), dentro: l.top >= -1 && l.left >= -1 };
  });
  ch(`${nom} el lienzo entra en la pantalla`, caja.dentro && caja.an <= w + 1 && caja.al <= h + 1,
     `${caja.an}x${caja.al} en ${w}x${h}`);

  const bol = await pg.locator("#btn-bolita").boundingBox();
  ch(`${nom} el botón de bolita es grande y entra`,
     bol && bol.width >= 44 && bol.height >= 44 && bol.y + bol.height <= h + 1,
     bol ? `${Math.round(bol.width)}x${Math.round(bol.height)}` : "no está");

  // EL ARRASTRE. Se apoya el dedo bien a la derecha del muñeco y se sostiene:
  // si el navegador se quedó el toque, no se mueve.
  // El punto se pide en coordenadas DEL JUEGO (x = 330 de 360, bien a la
  // derecha) y se pasa a la pantalla con la cuenta inversa del giro: acostado,
  // el juego va girado y "a la derecha del juego" es otro lado de la pantalla.
  const antes = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.x);
  const [sx, sy] = await pg.evaluate(() => {
    const { GIRO, esc, VISTA } = window.DN, l = document.querySelector("#lienzo");
    const an = parseFloat(l.style.width), al = parseFloat(l.style.height);
    const lx = (GIRO.ancho() - an) / 2 + 330 * esc, ly = (GIRO.alto() - al) / 2 + VISTA.alto * 0.55 * esc;
    if (!GIRO.activo) return [lx, ly];
    return GIRO.signo < 0 ? [ly, innerHeight - lx] : [innerWidth - ly, lx];
  });
  await pg.mouse.move(sx, sy);
  await pg.mouse.down();
  await pg.waitForTimeout(450);
  const dur = await pg.evaluate(() => window.DN.partida.rilo.p.pecho.x);
  await pg.mouse.up();
  ch(`${nom} arrastrando a la derecha, Rilo va a la derecha`, dur > antes + 12,
     `${antes.toFixed(0)} → ${dur.toFixed(0)} px`);

  await pg.waitForTimeout(200);
  const quieto = await pg.evaluate(() => window.DN.entrada.mover);
  ch(`${nom} y al soltar deja de empujar`, quieto === 0, `mover=${quieto}`);

  // La bolita.
  await pg.evaluate(() => { const b = document.querySelector("#btn-bolita");
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 9, bubbles: true,
      clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); });
  await pg.waitForTimeout(350);
  const ovillo = await pg.evaluate(() => window.DN.partida.rilo.bolita);
  ch(`${nom} el botón de bolita ovilla`, ovillo > 0.5, `bolita=${ovillo.toFixed(2)}`);

  ch(`${nom} sin errores`, err.length === 0, err.slice(0, 2).join(" · "));
  await pg.close();
}

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
