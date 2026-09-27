// El teléfono: que entre, que se toque y que el toque LLEGUE a la celda justa.
//
// En un puzzle sin tiempo un toque perdido no se nota como un problema de
// interfaz: se nota como que el juego no responde. Y peor: un toque que cae en
// la celda de al lado SI hace algo — da vuelta el espejo equivocado— y el
// jugador gasta un toque del par sin saber por qué.
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
  await pg.goto("http://127.0.0.1:8806/index.html");
  await pg.waitForFunction(() => !!window.ESPEJO, { timeout: 30000 });
  await pg.evaluate(() => localStorage.clear());
  await pg.reload(); await pg.waitForFunction(() => !!window.ESPEJO, { timeout: 30000 });

  const idi = await pg.$('#p-idioma:not([hidden]) [data-idioma="es"]');
  ch(`${nom} la pantalla de idiomas tapa el menú hasta que se elige`, !!idi);
  if (idi) { await idi.click(); await pg.waitForTimeout(250); }

  // LO QUE SE TOCA PRIMERO SE VE SIN DESPLAZAR. La grilla de los cuarenta
  // niveles se desplaza a propósito —no entra en ningún teléfono—, pero las
  // pestañas y el botón de seguir no pueden quedar abajo del corte: nadie
  // desplaza un menú para buscar el botón de jugar.
  const corte = await pg.evaluate(() => {
    const m = document.querySelector("#p-menu").getBoundingClientRect();
    const fuera = ["#m-seguir", ".pestanas"].filter((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return r.top < m.top - 1 || r.bottom > m.bottom + 1 || r.left < m.left - 1 || r.right > m.right + 1;
    });
    return fuera;
  });
  ch(`${nom} pestañas y "seguir" a la vista sin desplazar`, corte.length === 0, corte.join(", "));

  ch(`${nom} sin scroll horizontal`,
     (await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);

  // Girado, el alto de un botón en la pantalla es su ancho en el juego: se
  // mide el lado más corto, que es el que tiene que llegar a 44.
  const tocable = (s) => pg.evaluate((s) => {
    const e = document.querySelector(s), r = e.getBoundingClientRect();
    const en = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { tocable: e === en || e.contains(en), alto: Math.round(Math.min(r.width, r.height)),
             tapa: en ? (en.id || en.className) : "-" };
  }, s);
  for (const sel of ["#m-seguir", "#m-niveles", "#m-como"]) {
    const t = await tocable(sel);
    ch(`${nom} ${sel} tocable y de 44 px`, t.tocable && t.alto >= 44,
       t.tocable ? `${t.alto}px` : `tapado por ${t.tapa}`);
  }
  await pg.click('[data-pestana="opciones"]'); await pg.waitForTimeout(200);
  { const t = await tocable("#m-idioma");
    ch(`${nom} #m-idioma tocable y de 44 px`, t.tocable && t.alto >= 44, t.tocable ? `${t.alto}px` : `tapado por ${t.tapa}`); }

  // Los cuarenta botones del mapa también se tocan: cuarenta botones chicos en
  // cinco columnas es justo donde un diseño se pasa de listo.
  await pg.click("#m-niveles"); await pg.waitForTimeout(250);
  const celda = await pg.evaluate(() => {
    const e = document.querySelector(".celda-niv"), r = e.getBoundingClientRect();
    return { lado: Math.round(Math.min(r.width, r.height)), cuantos: document.querySelectorAll(".celda-niv").length };
  });
  ch(`${nom} los botones del mapa miden 44 px`, celda.lado >= 44 && celda.cuantos === 40,
     `${celda.lado} px el lado corto, ${celda.cuantos} niveles`);

  await pg.click(".celda-niv");
  await pg.waitForTimeout(300);
  const caja = await pg.evaluate(() => {
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    return { an: Math.round(l.width), al: Math.round(l.height), dentro: l.top >= -1 && l.left >= -1 };
  });
  ch(`${nom} el lienzo entra en la pantalla`, caja.dentro && caja.an <= w + 1 && caja.al <= h + 1,
     `${caja.an}x${caja.al} en ${w}x${h}`);

  // EL TOQUE TIENE QUE CAER EN LA CELDA QUE SE VE. Se tocan de verdad TODAS
  // las celdas del tablero en su centro —calculado en coordenadas del juego y
  // pasado a la pantalla con la cuenta inversa del giro— y se mira qué celda
  // entendió el juego. Un error de medio píxel en la escala o el centrado no se
  // nota en el medio del tablero y sí en los bordes. `tocar` se anula durante
  // la prueba para que el tablero no cambie ni se gane a mitad del recorrido.
  const cruzadas = await pg.evaluate(() => {
    const E = window.ESPEJO, p = E.partida, n = p.nivel, { GIRO, esc } = E;
    p.tocar = () => false;
    const l = document.querySelector("#lienzo");
    const an = parseFloat(l.style.width), al = parseFloat(l.style.height);
    const alto = Math.round(Math.min(GIRO.alto() / esc, 1000));
    const lado = Math.floor(Math.min((360 - 28) / n.ancho, (alto - 150) / n.alto));
    const x0 = Math.round((360 - lado * n.ancho) / 2);
    const y0 = Math.round((alto - lado * n.alto) / 2 + 14);
    const puntos = [];
    for (let f = 0; f < n.alto; f++)
      for (let c = 0; c < n.ancho; c++) {
        const lx = (GIRO.ancho() - an) / 2 + (x0 + c * lado + lado / 2) * esc;
        const ly = (GIRO.alto() - al) / 2 + (y0 + f * lado + lado / 2) * esc;
        const [x, y] = !GIRO.activo ? [lx, ly] : GIRO.signo < 0 ? [ly, innerHeight - lx] : [innerWidth - ly, lx];
        puntos.push({ c, f, x, y });
      }
    return { puntos, lado: Math.round(lado * esc), girado: GIRO.activo };
  });
  let erradas = 0;
  for (const pt of cruzadas.puntos) {
    await pg.touchscreen.tap(pt.x, pt.y);
    const leida = await pg.evaluate(() => {
      const t = window.ESPEJO.ultimoToque;
      return t && window.__celdaDe(window.ESPEJO.partida.nivel, t.x, t.y);
    });
    if (!leida || leida.c !== pt.c || leida.f !== pt.f) erradas++;
  }
  ch(`${nom} el toque cae en la celda que se ve, en las ${cruzadas.puntos.length}${cruzadas.girado ? " (girado)" : ""}`,
     erradas === 0, `${erradas} erradas · celda de ${cruzadas.lado} px`);
  ch(`${nom} y la celda mide más de 40 px en pantalla`, cruzadas.lado >= 40,
     `${cruzadas.lado} px`);

  ch(`${nom} sin errores`, err.length === 0, err.slice(0, 2).join(" · "));
  await pg.close();
}

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
