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

  // LA TAPA NO PUEDE TENER BARRA DE DESPLAZAMIENTO. Si el contenido no entra,
  // `overflow-y: auto` lo esconde en vez de romper el diseño: la pantalla se ve
  // bien y la última fila de botones queda abajo del corte. Nadie desplaza un
  // menú de cinco botones — asume que no hay más.
  const desborde = await pg.evaluate(() => {
    const t = document.querySelector("#p-menu .tapa");
    return { sobra: t.scrollHeight - t.clientHeight, alto: t.clientHeight };
  });
  ch(`${nom} el menú entra entero, sin desplazar`, desborde.sobra <= 1,
     `sobran ${desborde.sobra} px de ${desborde.alto}`);

  ch(`${nom} sin scroll horizontal`,
     (await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);

  for (const sel of ["#m-seguir", "#m-niveles", "#m-idioma"]) {
    const t = await pg.evaluate((s) => {
      const e = document.querySelector(s), r = e.getBoundingClientRect();
      const en = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { tocable: e === en || e.contains(en), alto: Math.round(r.height),
               tapa: en ? (en.id || en.className) : "-" };
    }, sel);
    ch(`${nom} ${sel} tocable y de 44 px`, t.tocable && t.alto >= 44,
       t.tocable ? `${t.alto}px` : `tapado por ${t.tapa}`);
  }

  // Los cuarenta botones del mapa también se tocan: cuarenta botones chicos en
  // cinco columnas es justo donde un diseño se pasa de listo.
  await pg.click("#m-niveles"); await pg.waitForTimeout(250);
  const celda = await pg.evaluate(() => {
    const e = document.querySelector(".celda-niv"), r = e.getBoundingClientRect();
    return { alto: Math.round(r.height), ancho: Math.round(r.width), cuantos: document.querySelectorAll(".celda-niv").length };
  });
  ch(`${nom} los botones del mapa miden 44 px`, celda.alto >= 44 && celda.ancho >= 40 && celda.cuantos === 40,
     `${celda.ancho}x${celda.alto}, ${celda.cuantos} niveles`);

  await pg.click(".celda-niv");
  await pg.waitForTimeout(300);
  const caja = await pg.evaluate(() => {
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    return { an: Math.round(l.width), al: Math.round(l.height), dentro: l.top >= -1 && l.left >= -1 };
  });
  ch(`${nom} el lienzo entra en la pantalla`, caja.dentro && caja.an <= w + 1 && caja.al <= h + 1,
     `${caja.an}x${caja.al} en ${w}x${h}`);

  // EL TOQUE TIENE QUE CAER EN LA CELDA QUE SE VE. Se recorren TODAS las celdas
  // del tablero tocando su centro y se comprueba que el juego crea que se tocó
  // esa misma: un error de medio píxel en la escala o el centrado no se nota en
  // el medio del tablero y sí en los bordes.
  const cruzadas = await pg.evaluate(() => {
    const g = window.ESPEJO, p = g.partida, n = p.nivel;
    const l = document.querySelector("#lienzo").getBoundingClientRect();
    const esc = l.width / 360;
    const alto = Math.round(Math.min(window.innerHeight / esc, 1000));
    const lado = Math.floor(Math.min((360 - 28) / n.ancho, (alto - 150) / n.alto));
    const x0 = Math.round((360 - lado * n.ancho) / 2);
    const y0 = Math.round((alto - lado * n.alto) / 2 + 14);
    const puntos = [];
    for (let f = 0; f < n.alto; f++)
      for (let c = 0; c < n.ancho; c++)
        puntos.push({ c, f,
          x: l.x + (x0 + c * lado + lado / 2) * esc,
          y: l.y + (y0 + f * lado + lado / 2) * esc });
    return { puntos, lado: Math.round(lado * esc) };
  });
  let erradas = 0;
  for (const pt of cruzadas.puntos) {
    const leida = await pg.evaluate(([x, y]) => {
      const g = window.ESPEJO, p = g.partida;
      const l = document.querySelector("#lienzo").getBoundingClientRect();
      const esc = l.width / 360;
      return window.__celdaDe(p.nivel, (x - l.x) / esc, (y - l.y) / esc);
    }, [pt.x, pt.y]);
    if (!leida || leida.c !== pt.c || leida.f !== pt.f) erradas++;
  }
  ch(`${nom} el toque cae en la celda que se ve, en las ${cruzadas.puntos.length}`,
     erradas === 0, `${erradas} erradas · celda de ${cruzadas.lado} px`);
  ch(`${nom} y la celda mide más de 40 px en pantalla`, cruzadas.lado >= 40,
     `${cruzadas.lado} px`);

  ch(`${nom} sin errores`, err.length === 0, err.slice(0, 2).join(" · "));
  await pg.close();
}

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
