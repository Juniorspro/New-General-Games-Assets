/* ============================================================================
   barro/js/carrera.js — una manga: seis pilotos en la grilla, la cuenta con
   el portón, la carrera (cada uno con su física; los rivales con su piloto),
   las caídas (se vuela, y a los 1,6 s vuelve a la pista donde pisó firme por
   última vez), el holeshot, la llegada y los puestos. Pura: corre en Node.
   ========================================================================== */
import { PASO, crearMoto, pasoMoto, levantar, altoEn, anguloEn, fichaCon } from './fisica.js';
import { crearPiloto, manejar } from './piloto.js';

/* la profundidad de cada carril (solo para el dibujo: la física es una sola línea) */
export const CARRILES = [-0.55, -0.25, 0.05, 0.35, 0.65, 0.95];
export const CUENTA = 3.4;          // segundos de cuenta antes de que caiga el portón

export function crearCarrera(pista, lista, op = {}) {
  const S = pista.suelo;
  const C = { pista, t: -CUENTA, estado: 'cuenta', corredores: [], eventos: [], terminados: 0, holeshot: null, orden: [], op, fin: null };
  // zonas donde no conviene volver después de una caída (cerca de los saltos)
  const n = S.n;
  pista.inseguro = new Uint8Array(n);
  for (const s of pista.saltos) for (let x = s.xLabio - 4; x < s.aterrFin + 3; x += S.dx) { const i = Math.round(x / S.dx); if (i >= 0 && i < n) pista.inseguro[i] = 1; }
  for (const z of pista.zonas) if (z.tipo === 'olas') for (let x = z.xIni; x < z.xFin; x += S.dx) pista.inseguro[Math.round(x / S.dx)] = 1;
  lista.forEach((c, i) => {
    // en el portón cada carril queda un poquito corrido (como en la grilla de verdad)
    const x = pista.xLargada - (CARRILES[c.carril ?? i] + 0.55) * 0.28;
    const M = crearMoto(fichaCon(c.mejoras || {}), x, altoEn(S, x) + 0.8, 0);
    C.corredores.push({
      i, nombre: c.nombre, numero: c.numero, colores: c.colores, jugador: !!c.jugador,
      carril: CARRILES[c.carril ?? i], moto: M,
      piloto: c.jugador ? null : crearPiloto(c.ia ?? 0.5, (pista.semilla || 1) * 13 + i * 101),
      seguro: x, tiempo: null, puesto: 0, caidas: 0, caida: null, mejorAire: 0, perfectos: 0, willyMax: 0,
    });
  });
  // se asientan en el portón
  for (const c of C.corredores) c.x0 = c.moto.x;
  for (let k = 0; k < 120; k++) for (const c of C.corredores) { pasoMoto(c.moto, S, { freno: 1 }); sujetar(c.moto, pista, c.x0); }
  for (const c of C.corredores) c.moto.eventos.length = 0;
  ordenar(C);
  return C;
}

function sujetar(M, pista, x0) {
  if (M.x > x0) { M.x = x0; if (M.vx > 0) M.vx = 0; }
}

/* un paso de física para todos. entrada: la del jugador */
export function pasoCarrera(C, entrada = {}) {
  const P = C.pista, S = P.suelo;
  C.t += PASO;
  if (C.estado === 'cuenta' && C.t >= 0) { C.estado = 'carrera'; C.eventos.push({ tipo: 'porton' }); }
  const jugador = C.corredores.find((c) => c.jugador);
  for (const c of C.corredores) {
    const M = c.moto;
    let inp;
    if (C.t < 0) {
      // en la grilla: aceleran en vacío y frenan
      inp = { gas: 0, freno: 1, inclinar: 0 };
      if (c.jugador) c.acelera = entrada.gas || 0;
      else c.acelera = 0.4 + 0.6 * Math.max(0, Math.sin(C.t * 5 + c.i));
    } else if (c.tiempo !== null) {
      inp = { gas: 0.15, freno: 0.35, inclinar: 0 };       // ya llegó: va frenando
    } else if (c.jugador) {
      inp = entrada;
    } else {
      // un poquito de banda elástica, para que la carrera no se desarme
      if (jugador) { const d = M.x - jugador.moto.x; c.piloto.banda = 1 - Math.max(-1, Math.min(1, d / 70)) * 0.045; }
      inp = manejar(c.piloto, M, P, C.t);
    }
    if (c.caida) {
      c.caida.t += PASO;
      if (c.caida.t > 1.6) { levantar(M, S, c.seguro); c.caida = null; C.eventos.push({ tipo: 'levanta', c: c.i }); }
    }
    pasoMoto(M, S, inp);
    if (C.t < 0) sujetar(M, P, c.x0);
    for (const e of M.eventos) {
      e.c = c.i;
      if (e.tipo === 'caida') { c.caidas++; c.caida = { t: 0, x: M.x, y: M.y, vx: M.vx, vy: M.vy, a: M.a }; }
      if (e.tipo === 'aterrizaje') { c.mejorAire = Math.max(c.mejorAire, e.aire); if (e.calidad === 'perfecto') c.perfectos++; }
      C.eventos.push(e);
    }
    M.eventos.length = 0;
    c.willyMax = Math.max(c.willyMax, M.willy);
    // el último lugar firme
    if (!M.caido && M.ruedas[0].enSuelo && M.ruedas[1].enSuelo && M.suelo > 0.25) {
      const i = Math.round(M.x / S.dx);
      if (!P.inseguro[i] && M.x > c.seguro) c.seguro = M.x - 0.5;
    }
    // la llegada
    if (c.tiempo === null && M.x >= P.xMeta) {
      c.tiempo = C.t; c.puesto = ++C.terminados;
      C.eventos.push({ tipo: 'meta', c: c.i, puesto: c.puesto, tiempo: c.tiempo });
      if (c.jugador) { C.estado = 'final'; C.fin = C.t; }
    }
    if (C.holeshot === null && M.x > P.xLargada + 45) { C.holeshot = c.i; C.eventos.push({ tipo: 'holeshot', c: c.i }); }
  }
  if (Math.round(C.t / PASO) % 24 === 0) ordenar(C);
}

/* los puestos: los que llegaron, por tiempo; los demás, por cuánto avanzaron */
export function ordenar(C) {
  const L = [...C.corredores].sort((a, b) => {
    if (a.tiempo !== null && b.tiempo !== null) return a.tiempo - b.tiempo;
    if (a.tiempo !== null) return -1;
    if (b.tiempo !== null) return 1;
    return b.moto.x - a.moto.x;
  });
  L.forEach((c, k) => { c.lugar = k + 1; });
  C.orden = L;
  return L;
}

/* cuando el jugador llega, los que siguen corriendo reciben un tiempo estimado */
export function cerrar(C) {
  const P = C.pista;
  for (const c of C.corredores) {
    if (c.tiempo !== null) continue;
    const v = Math.max(8, Math.hypot(c.moto.vx, c.moto.vy));
    c.tiempo = C.t + (P.xMeta - c.moto.x) / v + (c.caida ? 1.5 : 0);
  }
  const L = [...C.corredores].sort((a, b) => a.tiempo - b.tiempo);
  L.forEach((c, k) => { c.puesto = k + 1; c.lugar = k + 1; });
  C.orden = L;
  return L;
}

/* la pista entera corrida por el piloto (para probar las pistas y en el menú) */
export function simular(C, maxSeg = 240) {
  let n = 0;
  while (C.t < maxSeg && C.corredores.some((c) => c.tiempo === null)) {
    pasoCarrera(C, {});
    if (++n > maxSeg / PASO + 2000) break;
  }
  return C;
}

export { anguloEn };
