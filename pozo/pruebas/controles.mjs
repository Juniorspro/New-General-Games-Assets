// CUANTO ESPACIO HAY ENTRE UN CONTROL Y EL DE AL LADO.
//
// No se mira: se mide. Dos botones separados por seis pixeles se ven bien en
// una captura y en la mano son el mismo boton — el pulgar tapa los dos y el
// juego hace lo que no pediste. La guia de las dos tiendas grandes pide 44 px
// de blanco Y separacion entre blancos; aca se exige 24 px de aire entre los
// bordes, que en una pantalla de telefono son unos 4 mm.
import { chromium } from "playwright";
const ARCH = process.argv[2];
let ok = 0, mal = 0;
const ch = (n,c,d="") => { c ? (ok++, console.log(`  ✓ ${n}${d?" — "+d:""}`))
                             : (mal++, console.log(`  ✗ ${n}${d?" — "+d:""}`)); };

const MINIMO = 24;      // px de aire entre dos controles
const TOQUE = 44;       // px minimos de un blanco tocable

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });

/** La distancia mas corta entre dos rectangulos; 0 si se tocan o se pisan. */
const aire = (a, b) => {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return (dx === 0 && dy === 0) ? 0 : Math.round(Math.hypot(dx, dy));
};

for (const [nombre, w, h] of [["vertical angosto", 360, 780],
                              ["vertical comun", 412, 892],
                              ["apaisado", 780, 380]]) {
  const pg = await nav.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  await pg.goto("file://" + ARCH);
  await pg.waitForFunction(() => !!window.__pozo, { timeout: 30000 });
  const bi = await pg.$('#pIdioma:not([hidden]) .b');
  if (bi) { await bi.click(); await pg.waitForTimeout(300); }
  await pg.click("#mJugar");
  await pg.waitForTimeout(700);
  // USAR sólo aparece cuando hay algo que usar: se lo fuerza para poder medirlo.
  await pg.evaluate(() => document.querySelector("#bUsa").classList.add("ver"));
  await pg.waitForTimeout(120);

  const cajas = await pg.evaluate(() => {
    const o = {};
    // EL HUD TAMBIEN CUENTA. La pausa se mudo arriba al medio y en apaisado el
    // marco se angosta hasta 175 px: ahi arriba al medio es justo donde se
    // amontonan los corazones y el contador de piso, y el boton les quedaba
    // encima. Un control que tapa informacion es el mismo problema que dos
    // controles pegados.
    for (const id of ["joy", "bTira", "bEsq", "bUsa", "bPau", "vidas", "barE", "dcha"]) {
      const e = document.querySelector("#" + id);
      if (!e || getComputedStyle(e).display === "none") continue;
      const r = e.getBoundingClientRect();
      o[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return o;
  });

  const ids = Object.keys(cajas);
  const TOCABLES = ["joy", "bTira", "bEsq", "bUsa", "bPau"];
  // Entre dos controles hace falta aire; entre un control y el HUD alcanza con
  // que NO SE PISEN, porque el HUD no se toca.
  const soloBotones = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const esHud = !TOCABLES.includes(a) || !TOCABLES.includes(b);
      const d = aire(cajas[a], cajas[b]);
      if (!esHud) soloBotones.push([a + "↔" + b, d]);
      else if (d === 0) soloBotones.push(["(encima del HUD) " + a + "↔" + b, -1]);
    }
  soloBotones.sort((x, y) => x[1] - y[1]);
  const [parPeor, peorD] = soloBotones[0];
  ch(`${nombre}: los controles no se juntan ni tapan el HUD`, peorD >= MINIMO,
     `el par más cerca es ${parPeor}, con ${peorD} px de aire`);

  const chicos = ids.filter((k) => TOCABLES.includes(k) &&
                                   Math.min(cajas[k].width, cajas[k].height) < TOQUE);
  ch(`${nombre}: todos los blancos llegan a ${TOQUE} px`, chicos.length === 0,
     chicos.map((k) => `${k} ${Math.round(Math.min(cajas[k].width, cajas[k].height))}`).join(" "));

  // Y NINGUNO SE SALE DE LA PANTALLA: en apaisado el marco cambia de forma y un
  // boton anclado al borde de abajo puede quedar fuera del area visible.
  const fuera = TOCABLES.filter((k) => cajas[k] && (cajas[k].x < 0 || cajas[k].y < 0 ||
                                  cajas[k].x + cajas[k].width > w ||
                                  cajas[k].y + cajas[k].height > h));
  ch(`${nombre}: ninguno se sale de la pantalla`, fuera.length === 0, fuera.join(" "));
  await pg.close();
}
console.log(`\n  ${ok}/${ok+mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
