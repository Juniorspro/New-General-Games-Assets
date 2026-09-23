// El resolvedor de KUNTUR: busca, con la física de verdad (js/fisica.js), una
// forma de ir de una apacheta a la siguiente. A* sobre estados de la física,
// con acciones que duran K cuadros y una heurística de distancia por la grilla.
import { crearMundo, pasarKilla, copiar, clave, B, baldosa, solidaEn, empezarEn } from "../js/fisica.js";
export { copiar };

export const K = 6;
export const ACCIONES = [
  { x: 1 }, { x: -1 }, {},
  { x: 1, salto: 1 }, { x: -1, salto: 1 }, { salto: 1 },
  { x: 1, corto: 1 }, { x: -1, corto: 1 },
  { y: 1 }, { x: 1, y: 1 }, { x: -1, y: 1 },
  { y: -1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
  { x: 1, accion: 1 }, { x: -1, accion: 1 }, { toca: 1 },
];
/* prev: la acción de antes. Si ya venía apretando el salto (o la mano), seguir
   apretando no es apretar de nuevo: así se puede mantener un salto largo. */
export function entradaDe(a, f, prev) {
  const sigueSalto = prev && prev.salto && a.salto, sigueMano = prev && prev.accion && a.accion;
  return {
    x: a.x || 0, y: a.y || 0,
    salto: !!(a.salto || (a.corto && f === 0)), saltoE: !!((a.corto || (a.salto && !sigueSalto)) && f === 0),
    accion: !!(a.accion || (a.toca && f === 0)), accionE: !!((a.toca || (a.accion && !sigueMano)) && f === 0),
  };
}
/* distancias por la grilla desde la meta (8 vecinos, por el aire) */
export function mapaDistancias(m, meta) {
  const W = m.w, H = m.h, d = new Float32Array(W * H).fill(Infinity), cola = [];
  const libre = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !solidaEn(m, x, y) || (x >= 0 && x < W && y >= 0 && y < H && baldosa(m, x, y) === B.PUERTA);
  for (let y = Math.max(0, Math.floor(meta.y) - 2); y <= Math.min(H - 1, Math.floor(meta.y) + 3); y++) {
    const x = Math.floor(meta.x);
    if (libre(x, y)) { d[y * W + x] = 0; cola.push(x, y); }
  }
  for (let i = 0; i < cola.length; i += 2) {
    const x = cola[i], y = cola[i + 1], v = d[y * W + x];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!libre(nx, ny)) continue;
      const nv = v + (dx && dy ? 1.41 : 1);
      if (nv < d[ny * W + nx]) { d[ny * W + nx] = nv; cola.push(nx, ny); }
    }
  }
  return d;
}
/* busca un camino. o: { desde:{x,y}, meta:{x,y,radio}, habil, max, peso, preparar(m) } */
export function resolver(nivel, o) {
  let m0;
  if (o.mundo) { m0 = copiar(o.mundo); }
  else {
    m0 = crearMundo(nivel, { habil: o.habil });
    empezarEn(m0, o.desde, o.id);
    if (o.preparar) o.preparar(m0);
  }
  const meta = o.meta, radio = meta.radio || 1.5;
  const dist = mapaDistancias(m0, meta);
  /* la distancia por la grilla, pero pareja adentro de cada baldosa: se va
     acercando al valor de la vecina de al lado si esa está más cerca */
  const hDe0 = (m) => {
    const p = m.p, x = Math.max(0, Math.min(m.w - 1, Math.floor(p.x)));
    let y = Math.max(0, Math.min(m.h - 1, Math.floor(p.y + 0.5)));
    let own = dist[y * m.w + x];
    if (!isFinite(own)) { y = Math.min(m.h - 1, y + 1); own = dist[y * m.w + x]; }
    let dd;
    if (!isFinite(own)) dd = Math.abs(p.x - meta.x) + Math.abs(p.y - meta.y) + 20;
    else {
      const fx = p.x - (x + 0.5), nx = fx >= 0 ? x + 1 : x - 1;
      const dn = nx >= 0 && nx < m.w ? dist[y * m.w + nx] : Infinity;
      dd = isFinite(dn) && dn < own ? own + (dn - own) * Math.abs(fx) : own;
    }
    return (dd / 5.2) * 60 / K;
  };
  const llego0 = meta.copla != null
    ? (m) => !m.p.muerta && m.coplas[meta.copla].tomada
    : (m) => !m.p.muerta && Math.abs(m.p.x - meta.x) < radio && Math.abs(m.p.y - meta.y) < (meta.alto || 2.5);
  const llego = meta.cajaX != null ? (m) => llego0(m) && m.cajas[meta.caja || 0].x >= meta.cajaX - 0.05 && m.cajas[meta.caja || 0].enSuelo : llego0;
  /* con una caja que llevar, la heurística suma lo que le falta a la caja */
  const hCaja = meta.cajaX != null ? (m) => { const c = m.cajas[meta.caja || 0]; const falta = Math.max(0, meta.cajaX - c.x); return (Math.abs(m.p.x - (c.x - 0.35)) + falta * 2.5) / 5.2 * 60 / K; } : null;
  const hDe = hCaja || hDe0;
  const peso = o.peso || 2.4, max = o.max || 400000;
  const abiertos = [{ m: m0, g: 0, f: hDe(m0), camino: null }];
  const grano = o.grano || 4;
  const vistos = new Map([[clave(m0, grano), 0]]);
  let explorados = 0;
  /* un montículo binario por f */
  const push = (n) => { abiertos.push(n); let i = abiertos.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (abiertos[p].f <= n.f) break; abiertos[i] = abiertos[p]; abiertos[p] = n; i = p; } };
  const pop = () => { const r = abiertos[0], u = abiertos.pop(); if (abiertos.length) { abiertos[0] = u; let i = 0; for (;;) { const l = i * 2 + 1, d = l + 1; let mm = i; if (l < abiertos.length && abiertos[l].f < abiertos[mm].f) mm = l; if (d < abiertos.length && abiertos[d].f < abiertos[mm].f) mm = d; if (mm === i) break; [abiertos[i], abiertos[mm]] = [abiertos[mm], abiertos[i]]; i = mm; } } return r; };
  let mejorH = Infinity;
  while (abiertos.length && explorados < max) {
    const n = pop();
    explorados++;
    if (o.ver) { const h = hDe(n.m); if (h < mejorH) { mejorH = h; console.log('  mejor h', h.toFixed(1), 'g', n.g, n.m.p.x.toFixed(2), n.m.p.y.toFixed(2), n.m.p.estado); } }
    if (llego(n.m)) {
      const acciones = [];
      for (let c = n.camino; c; c = c.antes) acciones.push(c.a);
      acciones.reverse();
      return { ok: true, cuadros: acciones.length * K, acciones, explorados, final: n.m.p, mundo: n.m };
    }
    for (let ai = 0; ai < ACCIONES.length; ai++) {
      const a = ACCIONES[ai];
      if (a.toca && !o.tocar) continue;
      if (a.accion && !o.cajas) continue;
      const m = copiar(n.m);
      let muerta = false;
      const prev = n.camino ? ACCIONES[n.camino.a] : null;
      for (let f = 0; f < K; f++) { pasarKilla(m, entradaDe(a, f, prev)); m.eventos.length = 0; if (m.p.muerta) { muerta = true; break; } }
      if (muerta) continue;
      const k = clave(m, grano);
      const g = n.g + 1;
      if (vistos.has(k) && vistos.get(k) <= g) continue;
      vistos.set(k, g);
      push({ m, g, f: g + hDe(m) * peso, camino: { a: ai, antes: n.camino } });
    }
  }
  return { ok: false, explorados };
}
/* repetir una solución para ver dónde termina (y que la física no cambió) */
export function repetir(nivel, o, acciones) {
  const m = crearMundo(nivel, { habil: o.habil });
  empezarEn(m, o.desde, o.id);
  if (o.preparar) o.preparar(m);
  let prev = null;
  for (const ai of acciones) { for (let f = 0; f < K; f++) { pasarKilla(m, entradaDe(ACCIONES[ai], f, prev)); m.eventos.length = 0; } prev = ACCIONES[ai]; }
  return m;
}
