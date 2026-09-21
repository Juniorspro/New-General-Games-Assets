// LAS DIEZ TIENEN QUE ANDAR CON DOBLE CLIC Y HACER LO QUE PROMETEN.
//
// Abrir y que no tire error no alcanza: una página que carga y cuya mecánica
// no avanza se ve exactamente igual en una captura. Por eso cada una expone una
// sonda y acá se la hace AVANZAR, y se comprueba que el estado cambió.
import { chromium } from "playwright";
import { readdirSync } from "fs";
import path from "path";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// Qué hacer en cada una y qué tiene que pasar. Una tabla y no un `if` por
// archivo: agregar la número once es una línea.
const PRUEBAS = {
  "01-ramo-infinito.html":    [(f) => { for (let i = 0; i < 5; i++) f.plantar(100 + i * 40, 300); },
                               (f) => f.cuantas() >= 5, "flores plantadas"],
  "02-lluvia-de-petalos.html":[(f) => { for (let i = 0; i < 6; i++) f.atajar(); },
                               (f) => f.lineas() > 0, "renglones de la carta"],
  "03-raspa-y-descubri.html": [(f) => f.raspaTodo(), (f) => f.listo() === true, "tarjeta revelada"],
  "04-constelacion.html":     [(f) => f.unirTodo(), (f) => f.unidas() === f.total, "estrellas unidas"],
  "05-jardin-pixel.html":     [(f) => f.crecer(), (f) => f.abiertas() >= 6, "flores abiertas"],
  "06-memotest.html":         [(f) => f.resolver(), (f) => f.encontrados() === 8, "pares encontrados"],
  "07-maquina-de-escribir.html":[(f) => f.todo(), (f) => f.escritas() === f.total, "letras escritas"],
  "08-burbujas.html":         [(f) => f.reventarTodo(), (f) => f.dichas() === f.total, "palabras del poema"],
  "09-laberinto.html":        [(f) => f.llegar(), (f) => f.ganado() === true, "llegó al final"],
  "10-caja-de-musica.html":   [(f) => { for (let i = 0; i < 3; i++) f.darCuerda(); },
                               (f) => f.vueltas() === 3, "vueltas de cuerda"],
};

/* Pruebas de más, de a una por archivo, para lo que la sonda no dice.
   La del jardín está porque ahí hubo un agujero de verdad: el cielo se cortaba
   antes de la tierra y quedaba una franja sin pintar, del color del fondo de la
   página. La mecánica avanzaba igual —las flores abrían— así que la sonda daba
   bien y el dibujo estaba roto. Se mira el lienzo, no el contador. */
const EXTRA = {
  /* EL DEDO DICE ADONDE, NO CUANTO. Se apoya, se arrastra de un tirón hasta la
     columna 6 y se deja QUIETO: sin más eventos, la flor tiene que llegar
     igual. Antes se movía un pasito por `pointermove` y se quedaba a menos de
     una celda de la entrada. Arrastrando con la mano uno lo corrige sin darse
     cuenta, así que sólo se ve si se deja el dedo parado a propósito. */
  "09-laberinto.html": ["la flor llega aunque el dedo se quede quieto", () => new Promise((ok) => {
    const c = document.getElementById("c"), g = window.__flores.donde();
    const px = (ce, fi) => ({ x: g.caja.x + (ce + .5) * g.CEL, y: g.caja.y + (fi + .5) * g.CEL });
    const tirar = (t, p) => c.dispatchEvent(new PointerEvent(t, { clientX: p.x, clientY: p.y, bubbles: true, cancelable: true }));
    const fin = px(6, 1);
    tirar("pointerdown", px(1, 1));
    tirar("pointermove", fin);
    setTimeout(() => {
      const f = window.__flores.donde();
      tirar("pointerup", fin);
      const col = f.x / f.CEL - .5, fila = f.y / f.CEL - .5;
      window.__flores.reiniciar();
      ok(Math.abs(col - 6) < 0.2 && Math.abs(fila - 1) < 0.2);
    }, 1200);
  })],

  /* LA QUE HAY QUE TOCAR TIENE QUE VERSE ENTERA. Antes todas nacían debajo del
     borde de abajo y subían a 40 px por segundo: la marcada —la única que se
     puede reventar— estaba fuera de pantalla y se tocaba a ciegas. */
  "08-burbujas.html": ["la burbuja marcada se ve entera", () => {
    const b = window.__flores.sigue(), p = window.__flores.pantalla();
    return !!b && b.y - b.r > 0 && b.y + b.r < p.AL && b.x - b.r > 0 && b.x + b.r < p.AN;
  }],

  "05-jardin-pixel.html": ["el lienzo no tiene huecos sin pintar", () => {
    const c = document.getElementById("c");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let transp = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transp++;
    return transp === 0;
  }],
};

const dir = path.resolve(process.argv[2] || ".");
const archivos = readdirSync(dir).filter((a) => /^\d\d-.*\.html$/.test(a)).sort();
ch("están los diez archivos", archivos.length === 10, `${archivos.length}: ${archivos.length < 10 ? archivos.join(" ") : "ok"}`);

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--autoplay-policy=no-user-gesture-required"] });

const titulos = new Set();
for (const a of archivos) {
  const pg = await nav.newPage({ viewport: { width: 400, height: 820 }, hasTouch: true });
  const err = [], sueltos = [];
  pg.on("pageerror", (e) => err.push(e.message));
  pg.on("console", (m) => { if (m.type() === "error") err.push("consola: " + m.text().slice(0, 120)); });
  // NINGUNA PIDE UN ARCHIVO DE AFUERA: son regalos para mandar por mensaje, y
  // uno que necesita internet se ve roto en el peor momento.
  pg.on("request", (r) => { const u = r.url();
    if (!u.startsWith("data:") && !u.startsWith("blob:") && u !== "file://" + path.join(dir, a))
      sueltos.push(u.slice(0, 80)); });

  await pg.goto("file://" + path.join(dir, a));
  await pg.waitForTimeout(1400);

  const hay = await pg.evaluate(() => typeof window.__flores === "object");
  if (!hay) { ch(`${a}: tiene sonda`, false); await pg.close(); continue; }

  if (EXTRA[a]) {
    const [comoSeLlama, mirar] = EXTRA[a];
    ch(`${a}: ${comoSeLlama}`, (await pg.evaluate(`(${mirar.toString()})()`)) === true);
  }

  const [hacer, comprobar, que] = PRUEBAS[a] || [];
  let resultado = null;
  if (hacer) {
    await pg.evaluate(`(${hacer.toString()})(window.__flores)`);
    await pg.waitForTimeout(250);
    resultado = await pg.evaluate(`(${comprobar.toString()})(window.__flores)`);
  }
  ch(`${a}: la mecánica avanza`, resultado === true, que);
  ch(`${a}: sin errores ni archivos sueltos`, err.length === 0 && sueltos.length === 0,
     [...err.slice(0, 1), ...sueltos.slice(0, 1)].join(" | "));

  // QUE NO SEAN LA MISMA PAGINA CON OTRO COLOR: se pide que cada una tenga su
  // propio título, que es lo mínimo para que sean diez y no una repetida.
  titulos.add(await pg.title());
  await pg.close();
}
ch("las diez tienen título propio", titulos.size === archivos.length, `${titulos.size} distintos`);

console.log(`\n  ${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
