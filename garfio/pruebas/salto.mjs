// CUANTO SE SALTA DE VERDAD, medido jugando.
//
// La torre pone cada argolla a una distancia de la anterior, y ese número no
// puede salir de "queda lindo": si es más grande que lo que se puede saltar, el
// juego se vuelve imposible cada tantas argollas y no parece un error — parece
// que no sos bueno. Acá se arma una torre de dos argollas, se pone al piloto a
// hamacarse en la primera y se mira si llega a la segunda, para cada
// combinación de subida y corrimiento. Lo que sale es el mapa de lo alcanzable,
// y el generador tiene que quedar adentro con margen.
//
// Corre solo (`node pruebas/salto.mjs`) y también lo usa pruebas/torre.mjs para
// comprobar que el generador no se pasó.
import { Partida } from "../js/juego.js";
import { piloto } from "../js/piloto.js";
import { F, ANCHO } from "../js/mundo.js";

/** Una torre de dos argollas y nada más, para medir un salto solo. */
function bancoDePrueba(dx, dy) {
  const p = new Partida(1);
  const a = { x: ANCHO / 2 - dx / 2, y: -300, oxidada: false, i: 0 };
  const b = { x: a.x + dx, y: a.y - dy, oxidada: false, i: 1 };
  p.torre.argollas = [a, b];
  p.torre.tuercas = []; p.torre.puas = [];
  p.torre.generarHasta = () => {};      // la torre no crece: son dos y listo
  p.torre.limpiar = () => {};
  p.x = a.x; p.y = a.y + 120; p.vx = 0; p.vy = 0;
  p.ancla = a; p.largo = 120; a.tocada = 0;
  p.cam = p.y - 640;
  return { p, b };
}

/** ¿Se pasa de la primera a la segunda en menos de `tope` cuadros? */
export function alcanza(dx, dy, tope = 1400) {
  const { p, b } = bancoDePrueba(dx, dy);
  for (let i = 0; i < tope; i++) {
    p.paso(piloto(p));
    if (p.ancla === b) return i;
    if (p.estado === "muerto") return -1;
  }
  return -1;
}

export function medir(paso = 12) {
  const fuera = [];
  for (let dy = F.SEP_MIN; dy <= 210; dy += paso) {
    let peor = 0;
    for (let dx = 30; dx <= 190; dx += paso) {
      for (const signo of [1, -1]) {
        const t = alcanza(dx * signo, dy);
        if (t >= 0 && Math.hypot(dx, dy) > peor) peor = Math.hypot(dx, dy);
      }
    }
    fuera.push({ dy, alcanzable: Math.round(peor) });
  }
  return fuera;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tabla = medir();
  console.log("  subida   salto máximo alcanzado (en línea recta)");
  for (const f of tabla) console.log(`  ${String(f.dy).padStart(6)}   ${f.alcanzable}`);
  const peor = Math.min(...tabla.map((f) => f.alcanzable));
  console.log(`\n  el salto más corto que se garantiza en todo el rango: ${peor} px`);
}
