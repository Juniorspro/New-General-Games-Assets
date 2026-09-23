// El resolvedor de BRILLO: busca, con la física de verdad (js/fisica.js), una
// forma de ir de un punto a otro de un nivel. A* sobre estados de la física,
// con acciones que duran K pasos y una heurística de distancia por la grilla.
// Lo que se mueve con el reloj (plataformas, burbujas, planitos) entra en la
// clave solo si está cerca de Nick, y cuantizado.
import { crearMundo, paso, copiar, clave, baldosa, B, T, plataformaEn, planitoEn, modoResolvedor, AURORA } from "../js/fisica.js";
export { copiar };

export const K = 6;
export const ACCIONES = [
  { x: 1 }, { x: -1 }, {},
  { x: 1, salto: 1 }, { x: -1, salto: 1 }, { salto: 1 },
  { x: 1, corto: 1 }, { x: -1, corto: 1 }, { corto: 1 },
  { x: 1, toca: 1 }, { x: -1, toca: 1 }, { toca: 1 },
  { y: -1, corto: 1 },
];
/* prev: la acción de antes. Si ya venía apretando el salto, seguir apretando no es apretar de nuevo */
export function entradaDe(a, f, prev) {
  const sigue = prev && prev.salto && a.salto;
  return {
    x: a.x || 0, y: a.y || 0,
    salto: !!(a.salto || (a.corto && f === 0)), saltoE: !!((a.corto || (a.salto && !sigue)) && f === 0),
    accion: !!(a.toca && f === 0), accionE: !!(a.toca && f === 0),
  };
}
/* distancias por la grilla desde la meta (8 vecinos, por el aire; los bloques planos cuentan como paso) */
export function mapaDistancias(m, meta) {
  const W = m.W, H = m.H, d = new Float32Array(W * H).fill(Infinity), cola = [];
  const libre = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ![B.PISO, B.HONGO].includes(baldosa(m, x, y));
  const mx = Math.floor(meta.x / T);
  for (let y = Math.max(0, Math.floor(meta.y / T) - 3); y <= Math.min(H - 1, Math.floor(meta.y / T) + 1); y++) if (libre(mx, y)) { d[y * W + mx] = 0; cola.push(mx, y); }
  for (let i = 0; i < cola.length; i += 2) {
    const x = cola[i], y = cola[i + 1], v = d[y * W + x];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!libre(nx, ny)) continue;
      const nv = v + (dx && dy ? 1.41 : 1) + (baldosa(m, nx, ny) === B.PLANO ? 2 : 0);
      if (nv < d[ny * W + nx]) { d[ny * W + nx] = nv; cola.push(nx, ny); }
    }
  }
  return d;
}
/* el reloj de lo que se mueve cerca, cuantizado */
function relojDe(m) {
  return (t) => {
    const p = m.p; let s = '';
    for (const q of m.plataformas) { const a = plataformaEn(q, t); if (Math.abs(a.x - p.x) < 260 && Math.abs(a.y - p.y) < 200) s += Math.round(a.x / 4) + ':' + Math.round(a.y / 4) + ';'; }
    for (const q of m.planitos) { if (m.restaurados.has(q.id)) continue; const e = planitoEn(q, t); if (Math.abs(e.x - p.x) < 200) s += Math.round(e.x / 4) + ';'; }
    for (const q of m.burbujeros) if (Math.abs(q.x - p.x) < 260) s += 'b' + Math.floor(((t - (q.fase || 0)) % q.cada + q.cada) % q.cada / 6);
    /* la Aurora: si hay baldosas de luz cerca, cuenta la fase de la ola */
    if (m.auroraCol) { const cx = Math.floor(p.x / T); for (let x = Math.max(0, cx - 12); x <= Math.min(m.W - 1, cx + 12); x++) if (m.auroraCol[x]) { const A = m.nivel.aurora || AURORA; s += 'a' + Math.floor((t % A.periodo) / 4); break; } }
    return s;
  };
}
/* busca un camino. o: { desde:{x,y,id}, meta:{x,y,radio,alto,burbuja} o {guino:id}, habil, max, peso, mundo }
   (burbuja: la meta cuenta solo si Nick sigue adentro de una burbuja grande) */
export function resolver(nivel, o) {
  const m0 = o.mundo ? copiar(o.mundo) : modoResolvedor(crearMundo(nivel, { habil: o.habil, en: o.desde }), o.meta.guino);
  if (!m0.auroraCol) { const c = new Uint8Array(m0.W); let hay = false; for (let i = 0; i < m0.tiles.length; i++) if (m0.tiles[i] === B.AURORA) { c[i % m0.W] = 1; hay = true; } m0.auroraCol = hay ? c : null; }
  const meta = o.meta, radio = meta.radio || 14;
  const dist = mapaDistancias(m0, meta);
  const hDe = (m) => {
    const p = m.p, x = Math.max(0, Math.min(m.W - 1, Math.floor(p.x / T)));
    let y = Math.max(0, Math.min(m.H - 1, Math.floor((p.y - 8) / T)));
    let own = dist[y * m.W + x];
    if (!isFinite(own)) { const y2 = Math.min(m.H - 1, y + 1); own = dist[y2 * m.W + x]; }
    const dd = isFinite(own) ? own : (Math.abs(p.x - meta.x) + Math.abs(p.y - meta.y)) / T + 20;
    return dd * T / (2.45 * K);
  };
  const llego = meta.guino != null
    ? (m) => !m.p.muerto && m.juntadas.has(meta.guino)
    : (m) => !m.p.muerto && Math.abs(m.p.x - meta.x) < radio && Math.abs(m.p.y - meta.y) < (meta.alto || 24) && (!meta.burbuja || !!m.p.enBurbuja);
  const peso = o.peso || 2.2, max = o.max || 300000;
  const abiertos = [{ m: m0, g: 0, f: hDe(m0), camino: null }];
  const reloj = relojDe(m0);
  const claveDe = (m) => { reloj.m = m; return clave(m, (t) => relojDe(m)(t)); };
  const vistos = new Map([[claveDe(m0), 0]]);
  let explorados = 0;
  const push = (n) => { abiertos.push(n); let i = abiertos.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (abiertos[p].f <= n.f) break; abiertos[i] = abiertos[p]; abiertos[p] = n; i = p; } };
  const pop = () => { const r = abiertos[0], u = abiertos.pop(); if (abiertos.length) { abiertos[0] = u; let i = 0; for (;;) { const l = i * 2 + 1, d = l + 1; let mm = i; if (l < abiertos.length && abiertos[l].f < abiertos[mm].f) mm = l; if (d < abiertos.length && abiertos[d].f < abiertos[mm].f) mm = d; if (mm === i) break; [abiertos[i], abiertos[mm]] = [abiertos[mm], abiertos[i]]; i = mm; } } return r; };
  let mejorH = Infinity;
  while (abiertos.length && explorados < max) {
    const n = pop();
    explorados++;
    if (o.ver) { const h = hDe(n.m); if (h < mejorH) { mejorH = h; console.log('  mejor h', h.toFixed(1), 'g', n.g, n.m.p.x.toFixed(1), n.m.p.y.toFixed(1)); } }
    if (llego(n.m)) {
      const acciones = [];
      for (let c = n.camino; c; c = c.antes) acciones.push(c.a);
      acciones.reverse();
      return { ok: true, cuadros: acciones.length * K, acciones, explorados, final: n.m.p, mundo: n.m };
    }
    for (let ai = 0; ai < ACCIONES.length; ai++) {
      const a = ACCIONES[ai];
      if (a.toca && !n.m.habil.zumbido) continue;
      const m = copiar(n.m);
      let muerto = false;
      const prev = n.camino ? ACCIONES[n.camino.a] : null;
      for (let f = 0; f < K; f++) { paso(m, entradaDe(a, f, prev)); m.eventos.length = 0; if (m.p.muerto) { muerto = true; break; } }
      if (muerto) continue;
      const k = claveDe(m);
      const g = n.g + 1;
      if (vistos.has(k) && vistos.get(k) <= g) continue;
      vistos.set(k, g);
      push({ m, g, f: g + hDe(m) * peso, camino: { a: ai, antes: n.camino } });
    }
  }
  return { ok: false, explorados };
}
/* repetir una solución para ver dónde termina */
export function repetir(nivel, o, acciones) {
  const m = crearMundo(nivel, { habil: o.habil, en: o.desde });
  let prev = null;
  for (const ai of acciones) { for (let f = 0; f < K; f++) { paso(m, entradaDe(ACCIONES[ai], f, prev)); m.eventos.length = 0; } prev = ACCIONES[ai]; }
  return m;
}
