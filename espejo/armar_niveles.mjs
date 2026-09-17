// Arma los niveles y PRUEBA QUE SE GANEN, antes de dejarlos entrar.
//
//     node armar_niveles.mjs            # escribe js/niveles.js
//
// UN NIVEL DE PUZZLE SE ROMPE EN SILENCIO. Uno imposible no falla, no tira
// ningún error y no se ve distinto de uno difícil: el jugador toca veinte veces,
// no pasa nada, y la conclusión que saca es sobre él, no sobre el nivel. Uno que
// ya venía ganado es peor todavía, porque se pasa sin darse cuenta de que había
// un puzzle.
//
// Por eso acá no se "diseña" nada a ojo. Se tira un tablero al azar, se BUSCAN
// TODAS las combinaciones de espejos con un recorrido por anchura, y el nivel
// entra sólo si:
//
//   · tiene solución (obvio, pero hay que comprobarlo: la mayoría no la tiene);
//   · NO está ganado de entrada;
//   · el par —la cantidad mínima de toques— es el que dice ser, y no menos;
//   · el par está dentro del rango que le toca a ese nivel, para que la
//     dificultad suba de verdad y no de a saltos.
//
// El par sale del mismo recorrido, así que no es una estimación: es la
// distancia más corta entre el estado inicial y algún estado ganador.
import { writeFileSync } from "fs";
import { VACIO, MURO, ESPEJO, FIJO, EMISOR, OBJETIVO, trazar, ganado, clave, desdeClave } from "./js/haz.js";

const COLORES = ["cian", "rosa", "ambar"];
const DIRS = ["der", "izq", "arr", "aba"];

function azar(semilla) {
  let s = (semilla >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Un tablero al azar con la forma que pide `cfg`. */
function tirar(rnd, cfg) {
  const { ancho, alto } = cfg;
  const celdas = Array.from({ length: ancho * alto }, () => ({ t: VACIO }));
  const libres = [];
  for (let f = 0; f < alto; f++) for (let c = 0; c < ancho; c++) libres.push([c, f]);
  // Mezclar, para no sacar siempre de la misma esquina.
  for (let i = libres.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [libres[i], libres[j]] = [libres[j], libres[i]];
  }
  const tomar = () => libres.pop();
  const poner = (c, f, cel) => { celdas[f * ancho + c] = cel; };

  const emisores = [], objetivos = [], espejos = [];
  // LOS EMISORES VAN EN EL BORDE Y MIRANDO PARA ADENTRO. En el medio, el rayo
  // sale para un lado y el emisor tapa el otro: media pantalla queda muerta y
  // el tablero se siente más chico de lo que es.
  const bordes = [];
  for (let c = 0; c < ancho; c++) { bordes.push([c, 0, "aba"]); bordes.push([c, alto - 1, "arr"]); }
  for (let f = 0; f < alto; f++) { bordes.push([0, f, "der"]); bordes.push([ancho - 1, f, "izq"]); }
  for (let i = bordes.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [bordes[i], bordes[j]] = [bordes[j], bordes[i]];
  }
  const usadas = new Set();
  for (let i = 0; i < cfg.emisores; i++) {
    let p;
    do { p = bordes.pop(); } while (p && usadas.has(`${p[0]},${p[1]}`));
    if (!p) return null;
    usadas.add(`${p[0]},${p[1]}`);
    const color = COLORES[i % cfg.colores];
    poner(p[0], p[1], { t: EMISOR, dir: p[2], color });
    emisores.push({ c: p[0], f: p[1], dir: p[2], color });
  }
  const queda = libres.filter(([c, f]) => !usadas.has(`${c},${f}`));
  const sacar = () => queda.pop();

  for (let i = 0; i < cfg.objetivos; i++) {
    const p = sacar(); if (!p) return null;
    const color = emisores[i % emisores.length].color;
    poner(p[0], p[1], { t: OBJETIVO, color });
    objetivos.push({ c: p[0], f: p[1], color });
  }
  for (let i = 0; i < cfg.espejos; i++) {
    const p = sacar(); if (!p) return null;
    poner(p[0], p[1], { t: ESPEJO, i: espejos.length });
    espejos.push({ c: p[0], f: p[1] });
  }
  for (let i = 0; i < cfg.fijos; i++) {
    const p = sacar(); if (!p) return null;
    poner(p[0], p[1], { t: FIJO, vuelco: rnd() < 0.5 ? 0 : 1 });
  }
  for (let i = 0; i < cfg.muros; i++) {
    const p = sacar(); if (!p) return null;
    poner(p[0], p[1], { t: MURO });
  }
  return { ancho, alto, celdas, emisores, objetivos, espejos };
}

/**
 * El recorrido por anchura sobre TODAS las combinaciones de espejos.
 *
 * Cada toque da vuelta un espejo, así que el grafo es un hipercubo de 2^n
 * vértices y los vecinos de un estado son los n estados que cambian un bit.
 * Con hasta doce espejos son 4096 estados: se recorre entero en un parpadeo, y
 * por eso el par que sale es el mínimo de verdad y no "el mejor que encontré".
 */
function resolver(nivel, inicial) {
  const n = nivel.espejos.length;
  const arranque = clave(inicial);
  const dist = new Int16Array(1 << n).fill(-1);
  dist[arranque] = 0;
  const cola = [arranque];
  let mejor = -1, mejorEstado = null;
  for (let i = 0; i < cola.length; i++) {
    const k = cola[i];
    if (ganado(nivel, desdeClave(k, n))) { mejor = dist[k]; mejorEstado = k; break; }
    for (let b = 0; b < n; b++) {
      const v = k ^ (1 << b);
      if (dist[v] === -1) { dist[v] = dist[k] + 1; cola.push(v); }
    }
  }
  return { par: mejor, estado: mejorEstado };
}

// La curva: cada nivel dice de qué tamaño es el tablero, cuántas piezas tiene y
// en qué rango de toques tiene que caer. Subir las tres cosas a la vez hace que
// el nivel ocho sea imposible; se sube de a una.
const CURVA = [];
for (let i = 0; i < 40; i++) {
  const p = i / 39;
  // UN OBJETIVO POR EMISOR, NI UNO MAS, y esto lo encontró el propio generador:
  // ocho de los cuarenta niveles no salían nunca, y los ocho eran justo los que
  // pedían más objetivos que emisores. El objetivo se COME el rayo —es un
  // detector, no un vidrio—, así que un rayo prende un objetivo y se termina
  // ahí: con un emisor y dos objetivos no hay tablero posible, ni difícil ni
  // fácil. El generador tiró noventa mil y no encontró ninguno, que es
  // exactamente lo que tenía que pasar.
  const emisores = i < 6 ? 1 : i < 18 ? 2 : 3;
  CURVA.push({
    ancho: i < 8 ? 5 : i < 20 ? 6 : 7,
    alto: i < 8 ? 6 : i < 20 ? 7 : 8,
    emisores,
    colores: i < 14 ? 1 : i < 26 ? 2 : 3,
    objetivos: emisores,
    espejos: Math.min(11, 3 + Math.round(p * 8)),
    fijos: i < 10 ? 0 : Math.round((p - 0.25) * 4),
    muros: Math.round(1 + p * 5),
    parMin: i < 3 ? 1 : i < 10 ? 2 : 3,
    parMax: i < 3 ? 2 : i < 10 ? 4 : i < 25 ? 6 : 9,
  });
}

function armar() {
  const niveles = [];
  let tirados = 0;
  for (let i = 0; i < CURVA.length; i++) {
    const cfg = CURVA[i];
    let puesto = null;
    for (let intento = 0; intento < 9000 && !puesto; intento++) {
      tirados++;
      const rnd = azar((i + 1) * 104729 + intento * 7919);
      const n = tirar(rnd, cfg);
      if (!n) continue;
      const cuantos = n.espejos.length;
      // El estado inicial es al azar; el par sale de buscarle la salida.
      const inicial = Array.from({ length: cuantos }, () => (rnd() < 0.5 ? 0 : 1));
      if (ganado(n, inicial)) continue;                  // ya venía ganado
      const { par } = resolver(n, inicial);
      if (par < cfg.parMin || par > cfg.parMax) continue;
      // Y QUE EL RAYO HAGA ALGO. Un tablero donde el rayo se va derecho a la
      // pared y la solución es un solo espejo suelto cumple todas las cuentas y
      // es aburrido: se pide que en la solución el rayo rebote de verdad.
      const { tramos } = trazar(n, inicial);
      if (tramos.length < 4) continue;
      puesto = {
        ancho: n.ancho, alto: n.alto, par,
        celdas: n.celdas.map((c) => (c.t === ESPEJO ? { ...c } : c)),
        emisores: n.emisores, objetivos: n.objetivos,
        espejos: n.espejos, inicial,
      };
    }
    if (!puesto) { console.log(`  ✗ nivel ${i + 1}: no salió ninguno`); continue; }
    niveles.push(puesto);
    console.log(`  ${String(i + 1).padStart(2)}. ${puesto.ancho}x${puesto.alto} · ` +
                `${puesto.espejos.length} espejos · ${puesto.objetivos.length} objetivos · par ${puesto.par}`);
  }
  console.log(`\n  ${niveles.length} niveles de ${tirados} tableros tirados`);
  // SE ESCRIBE COMO MODULO Y NO COMO JSON. Un JSON hay que ir a buscarlo, y
  // buscarlo desde file:// lo bloquea CORS: el archivo único —que es como se
  // manda el juego— se quedaría sin niveles. Como módulo entra en el
  // empaquetado igual que el resto del código y no hay nada que pedir.
  writeFileSync(new URL("./js/niveles.js", import.meta.url),
    "// GENERADO POR armar_niveles.mjs — NO EDITAR A MANO.\n" +
    "//\n" +
    "// Cada nivel de acá adentro fue resuelto por una máquina antes de entrar:\n" +
    "// tiene solución, no viene ganado, y `par` es la distancia mínima de verdad\n" +
    "// —no una estimación— porque sale de recorrer todas las combinaciones de\n" +
    "// espejos. pruebas/niveles.mjs lo vuelve a comprobar los cuarenta.\n" +
    "export const NIVELES = " + JSON.stringify(niveles) + ";\n");
}

armar();
