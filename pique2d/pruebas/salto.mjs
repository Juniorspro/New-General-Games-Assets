// El salto doble y el triple.
//
// Se prueba con NUMEROS y no mirando: "se puede hacer hasta triple salto" es
// una afirmacion medible —tres impulsos, cada uno con su animacion, y mas
// altura que con uno solo— y si no se mide, la primera vez que alguien toque
// una constante de fisica esto se rompe sin que nada avise.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage();
const err = []; pg.on("pageerror", e => err.push(e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });

const r = await pg.evaluate(async () => {
  const { V, ALTO_TILES, T, F } = await import("./js/mundo.js");
  const { nuevoJugador, paso } = await import("./js/fisica.js");
  const ancho = 400;
  const nv = { ancho, alto: ALTO_TILES, grilla: new Uint8Array(ancho * ALTO_TILES) };
  const piso = 18;
  for (let ty = piso; ty < ALTO_TILES; ty++)
    for (let tx = 0; tx < ancho; tx++) nv.grilla[ty * ancho + tx] = V.SOLIDO;

  // Corre `toques` cuadros con el dedo apoyado segun `patron` y devuelve la
  // altura maxima que gano sobre el piso.
  function correr(patron, cuadros = 200) {
    const j = nuevoJugador(40, piso * T);
    let prev = false, altoMax = 0, saltos = 0, tipos = [], eventos = [];
    for (let c = 0; c < cuadros; c++) {
      const toque = !!patron(c, j);
      const ev = {};
      paso(j, nv, { toque, toqueNuevo: toque && !prev }, ev);
      prev = toque;
      if (ev.salto) { saltos++; eventos.push("salto"); }
      if (ev.salto2) { saltos++; eventos.push("salto2"); tipos.push(j.flipTipo); }
      if (ev.salto3) { saltos++; eventos.push("salto3"); tipos.push(j.flipTipo); }
      altoMax = Math.max(altoMax, (piso * T - j.y) / T);
    }
    return { altoMax, saltos, tipos, eventos, vivo: j.vivo };
  }

  // Diez cuadros de nada antes del primer toque: el jugador nace EN EL AIRE
  // (suelo: false) y cae un cuadro hasta apoyarse. Tocando en el cuadro cero
  // el salto sale del aire y cuenta como doble — que es correcto, pero no es
  // lo que se quiere medir aca.
  const Q = 10;
  const uno = correr((c) => c >= Q && c < Q + 20);
  // Tres toques separados, cada uno de 14 cuadros, sin tocar el piso.
  const tresP = (c) => (c >= Q && c < Q + 14) || (c >= Q + 26 && c < Q + 40) ||
                       (c >= Q + 52 && c < Q + 66);
  const tres = correr(tresP, 120);
  // Un cuarto toque, todavia en el aire: no tiene que pasar nada.
  const cuatro = correr((c) => tresP(c) || (c >= Q + 78 && c < Q + 92), 120);

  const hojas = window.PIQUE.hojas;
  return {
    uno, tres, cuatro,
    hojaDoble: !!hojas.heroe_doble, hojaTriple: !!hojas.heroe_triple,
    cuadrosDoble: hojas.heroe_doble?.n, cuadrosTriple: hojas.heroe_triple?.n,
    mismaHoja: hojas.heroe_doble?.img?.src === hojas.heroe_triple?.img?.src,
  };
});

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

ch("un solo toque da un solo salto", r.uno.saltos === 1, `${r.uno.altoMax.toFixed(1)} tiles`);
ch("tres toques dan tres saltos", r.tres.eventos.join(",") === "salto,salto2,salto3",
   r.tres.eventos.join(" → "));
ch("el segundo y el tercero son distintos entre si",
   r.tres.tipos.length === 2 && r.tres.tipos[0] === 2 && r.tres.tipos[1] === 3,
   `flipTipo ${r.tres.tipos.join(", ")}`);
ch("el triple sube bastante mas que uno solo", r.tres.altoMax > r.uno.altoMax * 1.6,
   `${r.uno.altoMax.toFixed(1)} → ${r.tres.altoMax.toFixed(1)} tiles`);
ch("el triple no se va del nivel", r.tres.altoMax < 18, `${r.tres.altoMax.toFixed(1)} de 18 tiles`);
ch("el cuarto toque no da un cuarto salto",
   r.cuatro.eventos.join(",") === "salto,salto2,salto3", r.cuatro.eventos.join(" → "));
ch("hay una hoja propia para el doble", r.hojaDoble, `${r.cuadrosDoble} cuadros`);
ch("hay una hoja propia para el triple", r.hojaTriple, `${r.cuadrosTriple} cuadros`);
ch("no son la misma hoja repetida", !r.mismaHoja);
ch("sin errores de javascript", err.length === 0, err.slice(0, 2).join(" | "));

console.log(`\n${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
