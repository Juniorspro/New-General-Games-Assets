// El mapa: dónde y cuándo aparece cada bloque, para cada dificultad.
//
// Sale de las "pistas" del compositor (cada bombo, cada caja, cada sílaba
// cantada), así que cada bloque cae en algo que se escucha. Nunca en el aire.
//
// LAS REGLAS DE FLUJO (lo que hace que un mapa se sienta "bien"):
//   · cada mano alterna: después de un corte hacia abajo viene uno hacia
//     arriba, porque el brazo (o el dedo) ya quedó abajo. Dos "abajo"
//     seguidos obligan a volver en el aire y se siente como un error del mapa;
//   · la mano izquierda (dorado) va por los carriles 0 y 1, la derecha
//     (violeta) por el 2 y el 3: nunca se cruzan los brazos;
//   · entre dos bloques de la misma mano hay un piso de tiempo, que depende
//     de la dificultad. Más juntos no son difíciles: son imposibles.

import { crearAzar } from "./azar.js";

// Direcciones del corte: 0 arriba, 1 abajo, 2 izquierda, 3 derecha,
// 4 arriba-izq, 5 arriba-der, 6 abajo-izq, 7 abajo-der, 8 punto (cualquiera).
export const DIR = { ARRIBA: 0, ABAJO: 1, IZQ: 2, DER: 3, AR_IZQ: 4, AR_DER: 5, AB_IZQ: 6, AB_DER: 7, PUNTO: 8 };
export const VECTOR_DIR = [
  [0, 1], [0, -1], [-1, 0], [1, 0], [-0.7071, 0.7071], [0.7071, 0.7071], [-0.7071, -0.7071], [0.7071, -0.7071], [0, 0],
];
// "Familia" para la alternancia: abajo (1), arriba (0), horizontal (2), punto (3).
const FAMILIA = [0, 1, 2, 2, 0, 0, 1, 1, 3];

export const DIFICULTADES = [
  { id: "facil", nombre: "Fácil", njs: 8.5, hjd: 1.1, rejilla: 2, minMano: 1.0, minTodas: 0.78, dobles: 0.0,
    tasa: 0.75, bombas: 0, diagonales: 0.0, puntos: 0.2, horizontales: 0, filasAltas: 0.05 },
  { id: "normal", nombre: "Normal", njs: 10, hjd: 0.98, rejilla: 1, minMano: 0.66, minTodas: 0.38, dobles: 0.12,
    tasa: 1.3, bombas: 0.02, diagonales: 0.12, puntos: 0.08, horizontales: 0, filasAltas: 0.12 },
  { id: "dificil", nombre: "Difícil", njs: 12, hjd: 0.88, rejilla: 0.5, minMano: 0.45, minTodas: 0.19, dobles: 0.22,
    tasa: 2.0, bombas: 0.035, diagonales: 0.25, puntos: 0.04, horizontales: 0.06, filasAltas: 0.2 },
  { id: "experto", nombre: "Experto", njs: 14, hjd: 0.8, rejilla: 0.5, minMano: 0.37, minTodas: 0.19, dobles: 0.3,
    tasa: 2.75, bombas: 0.045, diagonales: 0.35, puntos: 0.02, horizontales: 0.1, filasAltas: 0.25 },
  { id: "expertoMas", nombre: "Experto+", njs: 16, hjd: 0.74, rejilla: 0.25, minMano: 0.19, minTodas: 0.095, dobles: 0.36,
    tasa: 3.6, bombas: 0.05, diagonales: 0.42, puntos: 0.01, horizontales: 0.12, filasAltas: 0.3 },
];

const PESO = { bombo: 1.0, caja: 1.15, voz: 1.25, bronce: 1.05, platillo: 1.6, solista: 0.75, tambor: 0.7, bajo: 0.3, hat: 0.12 };

// Qué tan cargada va cada tipo de sección, relativo a la tasa de la dificultad.
const CARGA = { intro: 0.45, verso: 0.8, pre: 0.95, coro: 1.25, puente: 0.5, outro: 0.4 };

/** Arma las candidatas: una por semicorchea que tenga algo sonando. */
function candidatas(cancion) {
  const paso = cancion.negra / 4;
  const t0 = cancion.arranque || 0;
  const mapa = new Map();
  for (const p of cancion.pistas) {
    const k = Math.round((p.t - t0) / paso);
    if (!mapa.has(k)) mapa.set(k, { k, t: p.t, pos16: p.pos16 ?? (((k % 16) + 16) % 16), peso: 0, tipos: new Set(), altura: 0, nAltura: 0, doble: false });
    const c = mapa.get(k);
    c.peso += (PESO[p.tipo] ?? 0.2) * (p.fuerza ?? 1);
    c.tipos.add(p.tipo);
    if (p.tipo === "voz" || p.tipo === "bronce" || p.tipo === "solista") { c.altura += p.altura; c.nAltura++; }
    if (p.tipo === "platillo") c.doble = true;
  }
  for (const c of mapa.values()) {
    const enCompas = c.pos16;
    c.peso += enCompas === 0 ? 0.55 : enCompas % 4 === 0 ? 0.3 : enCompas % 2 === 0 ? 0.08 : 0;
    c.altura = c.nAltura ? c.altura / c.nAltura : 0;
  }
  return [...mapa.values()].sort((a, b) => a.t - b.t);
}

function seccionDe(cancion, t) {
  for (const s of cancion.secciones) if (t >= s.t - 1e-6 && t < s.fin - 1e-6) return s;
  return cancion.secciones[cancion.secciones.length - 1];
}

export function generarMapa(cancion, idDificultad, semilla = 1) {
  const D = DIFICULTADES.find(d => d.id === idDificultad) || DIFICULTADES[1];
  const rng = crearAzar(`${cancion.id}#${D.id}#${semilla}`);
  const pasosRejilla = Math.max(1, Math.round(D.rejilla * 4));
  const todas = candidatas(cancion);
  // La primera nota recién cuando el bloque ya tuvo tiempo de verse venir.
  const tMin = (cancion.arranque || 0) + Math.max(1.6, D.hjd + 0.9);
  const tMax = cancion.duracion - 1.2;

  // 1. Elegir candidatas por sección, las de más peso primero, con presupuesto.
  const elegidas = [];
  for (const sec of cancion.secciones) {
    const dur = sec.fin - sec.t;
    const carga = (CARGA[sec.tipo] ?? 0.8) * (0.55 + 0.45 * (sec.intensidad ?? 0.6) / 0.6);
    const presupuesto = Math.round(dur * D.tasa * carga * 0.62);
    const aca = todas.filter(c => c.t >= sec.t - 1e-6 && c.t < sec.fin - 1e-6 && c.t >= tMin && c.t <= tMax
      && c.pos16 % pasosRejilla === 0 && c.peso > 0.35);
    aca.sort((a, b) => b.peso - a.peso || a.t - b.t);
    const tomadas = [];
    for (const c of aca) {
      if (tomadas.length >= presupuesto) break;
      if (tomadas.some(o => Math.abs(o.t - c.t) < D.minTodas - 1e-6)) continue;
      tomadas.push(c);
    }
    elegidas.push(...tomadas);
  }
  elegidas.sort((a, b) => a.t - b.t);

  // 2. Manos, direcciones y lugares.
  const manos = [0, 1].map(() => ({ t: -99, fam: 1, col: 0, fila: 0 }));
  const notas = [];
  let ultimaMano = 1;
  let alturaPrevia = 0;
  const libre = (m, t) => t - manos[m].t >= D.minMano - 1e-6;
  const reinicia = (m, t) => t - manos[m].t > Math.max(1.3, D.minMano * 2.6);

  // La familia que le toca a esa mano: la contraria de la última, salvo que
  // haya pasado tiempo (se puede arrancar de nuevo) o venga de un horizontal
  // o un punto (desde el medio se puede ir para cualquier lado).
  const familiaPara = (m, t, pedida) => {
    const h = manos[m];
    if (reinicia(m, t) || h.fam === 3) return pedida === 2 ? 2 : pedida;
    if (h.fam === 2) return pedida;
    return h.fam === 1 ? 0 : 1;
  };

  const direccionPara = (m, t, pedida, sinPunto = false) => {
    const h = manos[m];
    const fam = familiaPara(m, t, pedida);
    if (fam === 2) return h.dir === DIR.IZQ ? DIR.DER : DIR.IZQ;
    if (!sinPunto && rng() < D.puntos) return DIR.PUNTO;
    const r = rng();
    if (r < D.diagonales) {
      // Diagonales hacia afuera: son las cómodas (la mano abre).
      if (fam === 1) return m === 0 ? DIR.AB_IZQ : DIR.AB_DER;
      return m === 0 ? DIR.AR_IZQ : DIR.AR_DER;
    }
    if (r < D.diagonales * 1.35) {
      if (fam === 1) return m === 0 ? DIR.AB_DER : DIR.AB_IZQ;
      return m === 0 ? DIR.AR_DER : DIR.AR_IZQ;
    }
    return fam === 1 ? DIR.ABAJO : DIR.ARRIBA;
  };

  const lugarPara = (m, dir, c, doble) => {
    const h = manos[m];
    let col = m === 0 ? 1 : 2;
    const afuera = doble ? 0.75 : 0.32;
    if (rng() < afuera) col = m === 0 ? 0 : 3;
    // Diagonal que abre: mejor en el carril de afuera, deja lugar para el corte.
    if ((dir === DIR.AB_IZQ || dir === DIR.AR_IZQ) && m === 0 && rng() < 0.6) col = 0;
    if ((dir === DIR.AB_DER || dir === DIR.AR_DER) && m === 1 && rng() < 0.6) col = 3;
    let fila = 0;
    if (c.altura) {
      // La melodía manda: si sube, el bloque sube.
      if (c.altura >= 74) fila = 2; else if (c.altura >= 67) fila = 1;
      if (alturaPrevia && c.altura > alturaPrevia + 2 && fila < 2 && rng() < 0.4) fila++;
    } else if (rng() < D.filasAltas) fila = rng() < 0.3 ? 2 : 1;
    if (!D.filasAltas) fila = 0;
    // Los horizontales viven en la fila del medio.
    if (dir === DIR.IZQ || dir === DIR.DER) fila = 1;
    // Sin saltos de dos filas para la misma mano en poco tiempo.
    if (Math.abs(fila - h.fila) > 1 && c.t - h.t < 0.8) fila = 1;
    return { col, fila };
  };

  for (const c of elegidas) {
    const sec = seccionDe(cancion, c.t);
    const fuerte = c.doble || (c.peso > 2.6 && sec.tipo === "coro");
    const quiereDoble = D.dobles > 0 && (c.doble || (fuerte && rng() < D.dobles));
    if (quiereDoble && libre(0, c.t) && libre(1, c.t)) {
      // Doble: las dos manos a la vez, en la misma familia de corte.
      const fam = reinicia(0, c.t) && reinicia(1, c.t) ? 1 : (manos[0].fam === 1 ? 0 : 1);
      for (const m of [0, 1]) {
        const dir = direccionPara(m, c.t, fam, true);
        const { col, fila } = lugarPara(m, dir, c, true);
        notas.push({ t: c.t, col, fila, color: m, dir });
        Object.assign(manos[m], { t: c.t, fam: FAMILIA[dir], dir, col, fila });
      }
      ultimaMano = rng() < 0.5 ? 0 : 1;
      continue;
    }
    let m = 1 - ultimaMano;
    if (!libre(m, c.t)) m = 1 - m;
    if (!libre(m, c.t)) continue;
    // En dificultades bajas, la melodía que sube va a la derecha y la que baja
    // a la izquierda: se "ve" la canción en el mapa.
    if (c.altura && alturaPrevia && Math.abs(c.altura - alturaPrevia) >= 3 && rng() < 0.35) {
      const pref = c.altura > alturaPrevia ? 1 : 0;
      if (libre(pref, c.t)) m = pref;
    }
    const fam0 = D.horizontales && rng() < D.horizontales ? 2 : 1;
    const dir = direccionPara(m, c.t, fam0);
    const { col, fila } = lugarPara(m, dir, c, false);
    notas.push({ t: c.t, col, fila, color: m, dir });
    Object.assign(manos[m], { t: c.t, fam: FAMILIA[dir], dir, col, fila });
    ultimaMano = m;
    if (c.altura) alturaPrevia = c.altura;
  }

  // 3. Bombas: en los huecos, lejos de donde va a pasar la mano.
  const bombas = [];
  if (D.bombas > 0) {
    for (const c of todas) {
      if (c.t < tMin || c.t > tMax || c.pos16 % 2) continue;
      const sec = seccionDe(cancion, c.t);
      const p = D.bombas * (sec.tipo === "puente" ? 3 : sec.tipo === "coro" ? 0.6 : 1);
      if (rng() > p) continue;
      const col = rng() < 0.5 ? 0 : 3;
      const fila = rng() < 0.5 ? 2 : 0;
      const choca = notas.some(n => Math.abs(n.t - c.t) < 0.42 && (n.col === col || Math.abs(n.col - col) === 1 && n.fila === fila));
      const sobre = bombas.some(b => Math.abs(b.t - c.t) < 0.3);
      if (!choca && !sobre) bombas.push({ t: c.t, col, fila });
    }
  }

  return { notas, bombas, njs: D.njs, hjd: D.hjd, dificultad: D.id, nombre: D.nombre, minMano: D.minMano };
}

/** Las reglas, comprobadas. Devuelve la lista de problemas (vacía = bien). */
export function validarMapa(mapa, cancion) {
  const errores = [];
  const porMano = [[], []];
  for (const n of mapa.notas) porMano[n.color].push(n);
  for (const m of [0, 1]) {
    const l = porMano[m].sort((a, b) => a.t - b.t);
    for (let i = 1; i < l.length; i++) {
      const dt = l[i].t - l[i - 1].t;
      if (dt < mapa.minMano - 1e-3) errores.push(`mano ${m}: ${dt.toFixed(3)} s entre bloques en ${l[i].t.toFixed(2)}`);
      const f0 = FAMILIA[l[i - 1].dir], f1 = FAMILIA[l[i].dir];
      const reset = dt > Math.max(1.3, mapa.minMano * 2.6);
      if (!reset && f0 !== 3 && f1 !== 3 && f0 === f1 && f0 !== 2) errores.push(`mano ${m}: dos cortes iguales seguidos en ${l[i].t.toFixed(2)}`);
    }
  }
  for (const n of mapa.notas) {
    if (n.color === 0 && n.col > 1) errores.push(`dorado cruzado en ${n.t.toFixed(2)}`);
    if (n.color === 1 && n.col < 2) errores.push(`violeta cruzado en ${n.t.toFixed(2)}`);
    if (n.t > cancion.duracion) errores.push(`bloque después del final: ${n.t}`);
  }
  for (let i = 0; i < mapa.notas.length; i++) for (let j = i + 1; j < mapa.notas.length; j++) {
    const a = mapa.notas[i], b = mapa.notas[j];
    if (Math.abs(a.t - b.t) < 0.05 && a.col === b.col && a.fila === b.fila) errores.push(`dos bloques en la misma celda en ${a.t.toFixed(2)}`);
    if (b.t - a.t > 0.1) break;
  }
  for (const b of mapa.bombas) {
    if (mapa.notas.some(n => Math.abs(n.t - b.t) < 0.35 && n.col === b.col)) errores.push(`bomba encima de un bloque en ${b.t.toFixed(2)}`);
  }
  return errores;
}
