// La torre: que se pueda subir, siempre.
//
// Un juego infinito tiene una falla que no se ve nunca mirando: cada tanto pone
// dos argollas tan separadas que no se llega de una a la otra. El jugador no ve
// un error, ve que perdió — y culpa a sus dedos. Acá se comprueban tres cosas
// por separado: que la geometría del generador quede adentro de lo que se salta,
// que ese número esté MEDIDO con la física de verdad y no escrito a mano, y que
// un piloto tonto suba jugando.
import { Torre, SALTO_MAX } from "../js/torre.js";
import { Partida } from "../js/juego.js";
import { F, ANCHO } from "../js/mundo.js";
import { trepar } from "./_piloto.mjs";
import { alcanza } from "./salto.mjs";

let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? (ok++, console.log(`  ✓ ${n}${d ? " — " + d : ""}`))
                                 : (mal++, console.log(`  ✗ ${n}${d ? " — " + d : ""}`)); };

// --- la geometría --------------------------------------------------------
let pares = 0, lejos = [], verticales = 0, fuera = 0, sepMax = 0;
for (let s = 1; s <= 8; s++) {
  const t = new Torre(s * 7919);
  t.generarHasta(-120000);
  for (let i = 1; i < t.argollas.length; i++) {
    const a = t.argollas[i - 1], b = t.argollas[i];
    pares++;
    const d = Math.hypot(b.x - a.x, a.y - b.y);
    if (d > SALTO_MAX) lejos.push(`${Math.round(-b.y / 100)}m: ${Math.round(d)} px`);
    // DOS ARGOLLAS EN LA MISMA VERTICAL NO SE ENCADENAN: el péndulo sale por la
    // tangente, o sea de costado. No es "una versión fácil" del salto, es otro
    // problema — y uno que el juego no enseña a resolver.
    if (Math.abs(b.x - a.x) < F.DX_MIN - 1) verticales++;
    if (b.x < F.BORDE - 1 || b.x > ANCHO - F.BORDE + 1) fuera++;
    sepMax = Math.max(sepMax, a.y - b.y);
  }
}
ch(`los ${pares} saltos de 8 torres distintas entran en lo que se salta`,
   lejos.length === 0, lejos.slice(0, 2).join(" · "));
ch("ningún par de argollas queda en la misma vertical", verticales === 0,
   `${verticales} de ${pares}`);
ch("ninguna argolla se sale de las paredes", fuera === 0, `${fuera} de ${pares}`);
ch("la subida entre argollas nunca pasa del máximo declarado", sepMax <= F.SEP_MAX + 1,
   `la mayor sube ${Math.round(sepMax)} px, el tope es ${F.SEP_MAX}`);

// --- y que ese número esté medido, no escrito -----------------------------
//
// ESTA ES LA PRUEBA QUE MAS VALE. SALTO_MAX es una constante en un archivo:
// alguien toca la gravedad, o el empuje, o el alcance del gancho, y la
// constante se queda con el valor de ayer. El juego sigue arrancando, sigue
// viéndose bien, y cada tantas argollas pide un salto que ya no existe. Acá se
// vuelve a medir jugando: se arma una torre de dos argollas y se mira si el
// piloto pasa de la primera a la segunda.
{
  const casos = [];
  for (let dy = F.SEP_MIN; dy <= F.SEP_MAX; dy += 16)
    for (const dx of [F.DX_MIN, 80, F.DX_MAX])
      for (const signo of [1, -1]) casos.push([dx * signo, dy]);
  const fallan = casos.filter(([dx, dy]) => alcanza(dx, dy) < 0);
  ch(`los ${casos.length} saltos que el generador puede pedir se hacen de verdad`,
     fallan.length === 0, fallan.slice(0, 3).map(([x, y]) => `dx=${x} dy=${y}`).join(", "));
}

// --- y que se pueda jugar ------------------------------------------------
const corridas = [];
for (let s = 1; s <= 30; s++) corridas.push(trepar(Partida, s, 20000));
const metros = corridas.map((c) => c.metros).sort((a, b) => a - b);
const mediana = metros[Math.floor(metros.length / 2)];
ch("el piloto automático encadena más de 30 argollas de mediana", mediana >= 30,
   `mediana ${mediana} m, peor ${metros[0]} m, mejor ${metros[metros.length - 1]} m`);
ch("y ninguna torre lo deja trabado sin subir", metros[0] >= 5,
   `el peor subió ${metros[0]} m`);
// Y que NO sea infinito para un robot tonto: un juego sin fin que un piloto de
// treinta líneas sube para siempre no tiene curva de dificultad.
ch("y ninguna corrida es eterna: el piso que sube alcanza a todos",
   corridas.every((c) => !c.vivo), `${corridas.filter((c) => c.vivo).length} sobrevivieron al tope`);

// --- la mecánica tiene que servir ----------------------------------------
// Colgarse y hamacarse tiene que subir MAS que quedarse quieto colgado: si no,
// el empuje sería decoración y el juego sería esperar.
{
  const quieto = new Partida(5), hamaca = new Partida(5);
  for (const p of [quieto, hamaca]) { p.ancla = p.torre.argollas[0]; p.largo = 140; p.ancla.tocada = 0; }
  for (let i = 0; i < 400; i++) {
    quieto.paso({ dedo: { x: quieto.x, y: quieto.y } });
    hamaca.paso({ dedo: { x: hamaca.x + (hamaca.vx >= 0 ? 90 : -90), y: hamaca.y } });
  }
  const vq = Math.hypot(quieto.vx, quieto.vy), vh = Math.hypot(hamaca.vx, hamaca.vy);
  ch("hamacarse junta mucho más envión que quedarse colgado", vh > vq * 2.5,
     `${vq.toFixed(1)} contra ${vh.toFixed(1)} px por cuadro`);
}

// Y enganchar NUNCA puede dar un tirón: la soga toma el largo que ya había.
{
  const p = new Partida(3);
  p.x = 180; p.y = -40; p.vx = 6; p.vy = -6;
  const antes = Math.hypot(p.vx, p.vy);
  const a = p.torre.argollas[0];
  p.paso({ dedo: { x: a.x, y: a.y } });
  const despues = Math.hypot(p.vx, p.vy);
  ch("enganchar no da ningún tirón", p.ancla === a && despues > antes * 0.8,
     `${antes.toFixed(1)} → ${despues.toFixed(1)} px por cuadro`);
}

console.log(`\n${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
