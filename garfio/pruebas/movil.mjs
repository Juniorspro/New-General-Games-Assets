// El teléfono: que entre, que se toque y que el toque LLEGUE.
//
// Acá el dedo es el juego entero —engancha, hamaca y suelta— así que un toque
// que no llega no es un detalle de interfaz: es no poder jugar. En un teléfono
// el navegador se queda los arrastres para hacer scroll salvo que se le diga
// que no, y eso sólo se comprueba arrastrando de verdad.
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
  await pg.goto("http://127.0.0.1:8805/index.html");
  await pg.waitForFunction(() => !!window.GARFIO, { timeout: 30000 });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForFunction(() => !!window.GARFIO, { timeout: 30000 });

  // Con el almacenamiento recién borrado, la primera pantalla es la de idiomas.
  const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
  ch(`${nom} la pantalla de idiomas tapa el menú hasta que se elige`, !!idi);
  if (idi) { await idi.click(); await pg.waitForTimeout(250); }

  // LA TAPA NO PUEDE TENER BARRA DE DESPLAZAMIENTO. Si el contenido no entra,
  // `overflow-y: auto` lo esconde en vez de romper el diseño: la pantalla se ve
  // bien y los botones del pie quedan abajo del corte. Nadie desplaza un menú
  // de cuatro botones — asume que no hay más.
  const desborde = await pg.evaluate(() => {
    const t = document.querySelector("#p-menu .tapa");
    return { sobra: t.scrollHeight - t.clientHeight, alto: t.clientHeight };
  });
  ch(`${nom} el menú entra entero, sin desplazar`, desborde.sobra <= 1,
     `sobran ${desborde.sobra} px de ${desborde.alto}`);

  ch(`${nom} sin scroll horizontal`,
     (await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);

  for (const sel of ["#m-jugar", "#m-como", "#m-idioma"]) {
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
  await pg.waitForTimeout(400);
  const caja = await pg.evaluate(() => {
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    return { an: Math.round(l.width), al: Math.round(l.height), dentro: l.top >= -1 && l.left >= -1 };
  });
  ch(`${nom} el lienzo entra en la pantalla`, caja.dentro && caja.an <= w + 1 && caja.al <= h + 1,
     `${caja.an}x${caja.al} en ${w}x${h}`);

  // TOCAR UNA ARGOLLA LA ENGANCHA. Se pone al bicho justo abajo de la primera y
  // se toca donde se dibuja, no donde está en el mundo: lo que se prueba es
  // justamente la cuenta que convierte un toque de pantalla en un punto del
  // mundo, que es donde se esconden los errores de escala y de cámara.
  const punto = await pg.evaluate(() => {
    const g = window.GARFIO, p = g.partida, a = p.torre.argollas[0];
    p.x = a.x; p.y = a.y + 110; p.vx = 0; p.vy = 0; p.ancla = null;
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    const esc = l.width / 360;
    return { x: l.x + a.x * esc, y: l.y + (a.y - p.cam) * esc };
  });
  await pg.mouse.move(punto.x, punto.y);
  await pg.mouse.down();
  await pg.waitForTimeout(160);
  const enganchado = await pg.evaluate(() => !!window.GARFIO.partida.ancla);
  ch(`${nom} tocando una argolla el gancho se clava`, enganchado);

  // Y ARRASTRANDO SE HAMACA: el dedo lejos del cuerpo empuja. Sin esto el
  // péndulo no arranca nunca y el juego no existe.
  // Se mide el MAXIMO de la velocidad de costado durante el arrastre y no el
  // valor final: el péndulo llega a un extremo del arco y ahí la velocidad
  // vuelve a cero, así que mirando el último cuadro se puede medir cero después
  // de una hamacada perfecta.
  await pg.evaluate(() => {
    window.__vmax = 0;
    window.__mirar = setInterval(() => {
      const p = window.GARFIO.partida;
      if (p) window.__vmax = Math.max(window.__vmax, Math.abs(p.vx));
    }, 10);
  });
  for (let i = 1; i <= 16; i++) {
    await pg.mouse.move(punto.x + i * 7, punto.y);
    await pg.waitForTimeout(26);
  }
  const hamacado = await pg.evaluate(() => { clearInterval(window.__mirar); return window.__vmax; });
  ch(`${nom} arrastrando el dedo se hamaca`, hamacado > 1.5, `vx máx=${hamacado.toFixed(1)}`);

  await pg.mouse.up();
  await pg.waitForTimeout(200);
  ch(`${nom} soltando el dedo se suelta el gancho`,
     !(await pg.evaluate(() => !!window.GARFIO.partida.ancla)));

  ch(`${nom} sin errores`, err.length === 0, err.slice(0, 2).join(" · "));
  await pg.close();
}

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
