// El resolvedor: busca con qué apretar (izquierda, derecha, saltar) para
// llegar a la puerta, con la MISMA partida que se juega (js/partida.js):
// lo que da por bueno es lo que pasa en el juego.
//
// Decide como una persona, no cada 0,05 s (así explotaba: 80 mil estados a
// los 1,5 s del 1-1). Parado en algún lado elige una jugada — caminar un
// rato, esperar, o saltar con cierta fuerza y dirección (y cambiar de
// dirección en el aire) — y la jugada dura hasta que vuelve a pisar algo.
// Busca primero lo que parece más cerca de la puerta (A* con peso; la
// distancia es por las celdas libres, a la velocidad de correr) y dos
// estados iguales (Grumo en el mismo lugar, con la misma velocidad y el
// mundo igual: partida.firma) se miran una sola vez.
//
//   node grumo/pruebas/resolver.mjs 1-3        (uno)
//   node grumo/pruebas/resolver.mjs --todos    (y guarda soluciones.json)
import { Partida, PASO, COLS, FILAS, ALTO, FIS, leerMapa, jugarPlan } from '../js/partida.js';

// las jugadas: [tipo, dir, dur, dir en el aire después de `cambio` s, cambio]
const JUGADAS = [];
for (const d of [1, -1]) for (const dur of [0.05, 0.15, 0.4]) JUGADAS.push({ tipo: 'camina', d, dur });
for (const dur of [0.1, 0.3, 0.7]) JUGADAS.push({ tipo: 'espera', d: 0, dur });
for (const d of [1, 0, -1]) for (const dur of [0.08, 0.2, 0.5]) JUGADAS.push({ tipo: 'salta', d, dur, d1: d, cambio: 9 });
// saltar para un lado y frenar en el aire (caer justo), o subir derecho y después irse
for (const d of [1, -1]) for (const cambio of [0.12, 0.25]) JUGADAS.push({ tipo: 'salta', d, dur: 0.5, d1: 0, cambio });
for (const d of [1, -1]) for (const cambio of [0.2, 0.35]) JUGADAS.push({ tipo: 'salta', d: 0, dur: 0.5, d1: d, cambio });
for (const d of [1, -1]) JUGADAS.push({ tipo: 'salta', d, dur: 0.5, d1: -d, cambio: 0.22 });
// las que se juegan mirando (como una persona): correr hasta el borde y
// saltar ahí, y esperar a que el set se quede quieto
for (const d of [1, -1]) for (const dur of [0.2, 0.5]) JUGADAS.push({ tipo: 'borde', d, dur, d1: d, cambio: 9 });
for (const d of [1, -1]) JUGADAS.push({ tipo: 'borde', d, dur: 0.5, d1: 0, cambio: 0.25 });
JUGADAS.push({ tipo: 'calma', d: 0, dur: 0.1 });
const MAX_JUGADA = 4 / PASO;           // una jugada que no vuelve a pisar en 4 s no sirve

// ¿hay piso justo debajo de (x, y)? (lo que se pisa: bloques, tablas, resortes)
function hayPiso(p, x, y) {
  let hay = false;
  p.choques(x - 0.01, y - 0.02, x + 0.01, y + 0.06, (x0, y0, x1, y1, tipo) => { if (tipo !== 'golpe' && Math.abs(y0 - y) < 0.05) hay = true; });
  return hay;
}
// ¿se está moviendo algo del set (o va a moverse)?
function seMueve(p) {
  return p.agenda.length > 0 || p.manos.length > 0 || p.bolas.length > 0 || !!p.puerta.mov || p.grupos.some((g) => g.mov || g.cae || g.tiembla > p.T);
}

class Monton {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(v, pri) {
    const a = this.a; a.push([pri, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.a, top = a[0], ult = a.pop();
    if (a.length) {
      a[0] = ult;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[1];
  }
}

// la distancia de cada celda a una celda (la de la puerta), por las libres (8 vecinos)
export function campoDistancia(def, celda = null) {
  const m = leerMapa(def), d = new Float64Array(COLS * FILAS).fill(Infinity);
  const [px, py] = m.puerta, libre = (c, f) => c >= 0 && c < COLS && f >= 0 && f < FILAS && m.fijo[f * COLS + c] !== 1;
  const inicio = celda ? celda[1] * COLS + celda[0] : Math.floor(py - 0.5) * COLS + Math.floor(px);
  d[inicio] = 0;
  const cola = [inicio];
  while (cola.length) {
    let bi = 0;
    for (let i = 1; i < cola.length; i++) if (d[cola[i]] < d[cola[bi]]) bi = i;
    const i = cola.splice(bi, 1)[0], c = i % COLS, f = (i / COLS) | 0;
    for (let dc = -1; dc <= 1; dc++) for (let df = -1; df <= 1; df++) {
      if (!dc && !df) continue;
      const nc = c + dc, nf = f + df;
      if (!libre(nc, nf)) continue;
      const nd = d[i] + (dc && df ? 1.414 : 1);
      if (nd < d[nf * COLS + nc]) { d[nf * COLS + nc] = nd; cola.push(nf * COLS + nc); }
    }
  }
  return d;
}

// Jugar una jugada sobre la partida `p` (la cambia). Devuelve los cambios
// del control [paso, dir, salto] o null si murió.
// `ruido` (opcional): { r: azar, reaccion } — una persona reacciona tarde
// cuando ve lo que esperaba (el borde, que el set paró, que llegó)
export function jugar(p, j, ruido = null) {
  const cambios = [], t0 = p.pasos;
  const tarda = () => { if (!ruido) return; const n = Math.round((ruido.r() * ruido.reaccion) / PASO); for (let k = 0; k < n && p.estado === 'juego'; k++) p.paso(); };
  const poner = (dir, salto) => {
    if (p.control.dir === dir && !!p.control.salto === salto) return;
    p.control.dir = dir; p.control.salto = salto;
    cambios.push([p.pasos, dir, salto ? 1 : 0]);
  };
  const durP = Math.round(j.dur / PASO);
  if (j.tipo === 'hasta') {
    // caminar hasta x (mirando) y soltar
    const d = Math.sign(j.x - p.j.x) || 1;
    poner(d, false);
    for (let k = 0; k < 4 / PASO && p.estado === 'juego' && (j.x - p.j.x) * d > 0.05; k++) p.paso();
    tarda();
    poner(0, false);
    while (p.estado === 'juego' && (!p.j.suelo || p.j.agarrado) && p.pasos - t0 < MAX_JUGADA) p.paso();
    return p.estado === 'muerto' ? null : cambios;
  }
  if (j.tipo === 'calma') {
    poner(0, false);
    for (let k = 0; k < 3 / PASO && p.estado === 'juego' && seMueve(p); k++) p.paso();
    tarda();
    for (let k = 0; k < durP && p.estado === 'juego'; k++) p.paso();
    while (p.estado === 'juego' && (!p.j.suelo || p.j.agarrado) && p.pasos - t0 < MAX_JUGADA) p.paso();
    return p.estado === 'muerto' ? null : cambios;
  }
  if (j.tipo === 'borde') {
    // corre mirando los pies: cuando la punta de adelante se queda sin piso, salta
    poner(j.d, false);
    let quieto = 0;
    for (let k = 0; k < 3 / PASO && p.estado === 'juego'; k++) {
      const pie = p.j.x + j.d * (0.3 + 0.08);
      if (p.j.suelo && !hayPiso(p, pie, p.j.y)) break;
      quieto = Math.abs(p.j.vx) < 0.05 && k > 12 ? quieto + 1 : 0;
      if (quieto > 3) break;                          // una pared: salta desde ahí
      p.paso();
    }
    tarda();
    if (p.estado !== 'juego' || !p.j.suelo) return p.estado === 'muerto' ? null : null;
    j = { ...j, tipo: 'salta' };
  }
  if (j.tipo === 'salta') {
    // los tiempos del salto se cuentan desde que salta (en 'borde', después de correr)
    const cambioP = Math.round(j.cambio / PASO), t1 = p.pasos;
    poner(j.d, true);
    let despego = false;
    while (p.estado === 'juego' && p.pasos - t1 < MAX_JUGADA) {
      const k = p.pasos - t1;
      if (k === durP) poner(p.control.dir, false);
      if (k === cambioP) poner(j.d1, !!p.control.salto);
      p.paso();
      if (!p.j.suelo) despego = true;
      else if (despego && k >= 2) break;
      if (!despego && k > 12) break;                 // no despegó (no estaba parado): no sirve
    }
    poner(p.control.dir, false);
    if (!despego) return null;
  } else {
    poner(j.d, false);
    for (let k = 0; k < durP && p.estado === 'juego'; k++) p.paso();
    // si se fue del borde (o se lo llevaron), sigue hasta volver a pisar
    while (p.estado === 'juego' && (!p.j.suelo || p.j.agarrado) && p.pasos - t0 < MAX_JUGADA) p.paso();
  }
  if (p.estado === 'muerto') return null;
  return cambios;
}

function clave(p) {
  const j = p.j;
  return `${Math.round(j.x * 10)},${Math.round(j.y * 20)},${Math.round(j.vx)},${j.suelo ? 1 : 0}${j.agarrado ? 1 : 0}|${p.firma()}`;
}

// La escena como la ve quien la juega por primera vez: sin trampas, lo
// pintado parece de verdad y lo escondido no está (el camino "ingenuo").
export function vistaIngenua(def) {
  const grupos = {};
  for (const [id, g] of Object.entries(def.grupos || {})) grupos[id] = { ...g, falso: false, golpe: false };
  return { ...def, trampas: [], grupos };
}

// Devuelve { plan: [[s, dir, salto], ...], jugadas, t, nodos } o { plan: null, nodos }.
export function resolver(def, { maxNodos = 60000, peso = 1.5, tope = 30, toma = 1, sinTrampas = false } = {}) {
  const d = sinTrampas ? vistaIngenua(def) : def;
  // la distancia se mide hasta donde está la puerta AHORA (la mano la cambia de lugar)
  const campos = new Map();
  const h = (p) => {
    const pc = Math.min(COLS - 1, Math.max(0, Math.floor(p.puerta.x))), pf = Math.min(FILAS - 1, Math.max(0, Math.floor(p.puerta.y - 0.5)));
    const kc = pf * COLS + pc;
    if (!campos.has(kc)) campos.set(kc, campoDistancia(d, [pc, pf]));
    const dist = campos.get(kc);
    const c = Math.min(COLS - 1, Math.max(0, Math.floor(p.j.x))), f = Math.min(FILAS - 1, Math.max(0, Math.floor(p.j.y - ALTO / 2)));
    const v = dist[f * COLS + c];
    return (Number.isFinite(v) ? v : 30) / FIS.vmax;
  };
  const inicio = new Partida(d, { toma });
  // arranca en el aire (P arriba de todo): cae hasta pisar
  while (inicio.estado === 'juego' && !inicio.j.suelo && inicio.pasos < 600) inicio.paso();
  const raiz = { p: inicio, padre: null, cambios: [], g: inicio.t };
  if (inicio.estado === 'gano') return { plan: [[0, 0, 0]], t: inicio.t, nodos: 0 };
  const abiertos = new Monton(), vistos = new Set([clave(inicio)]);
  abiertos.push(raiz, h(inicio));
  let nodos = 0;
  while (abiertos.size && nodos < maxNodos) {
    const nodo = abiertos.pop();
    nodos++;
    for (const j of JUGADAS) {
      const q = nodo.p.clonar();
      const cambios = jugar(q, j);
      if (!cambios) continue;
      const hijo = { p: q, padre: nodo, cambios, j, g: q.t };
      if (q.estado === 'gano') return { plan: armarPlan(hijo), jugadas: armarJugadas(hijo), t: q.t, nodos };
      if (q.estado !== 'juego' || q.t > tope) continue;
      const k = clave(q);
      if (vistos.has(k)) continue;
      vistos.add(k);
      abiertos.push(hijo, hijo.g + peso * h(q));
    }
    nodo.p = null;              // ya se expandió: la copia no hace falta (ahorra memoria)
  }
  return { plan: null, nodos };
}

// la cadena de jugadas, en orden (para jugarlas "como persona")
function armarJugadas(hoja) {
  const out = [];
  for (let n = hoja; n.padre; n = n.padre) out.push(n.j);
  return out.reverse();
}
// de la cadena de jugadas a la lista de cambios [[segundos, dir, salto]]
function armarPlan(hoja) {
  const tramos = [];
  for (let n = hoja; n.padre; n = n.padre) tramos.push(n.cambios);
  const plan = [[0, 0, 0]];
  for (const cs of tramos.reverse()) for (const [paso, dir, salto] of cs) {
    const t = +(paso * PASO).toFixed(4), ult = plan[plan.length - 1];
    if (ult[0] === t) plan.pop();
    const prev = plan[plan.length - 1];
    if (!prev || prev[1] !== dir || prev[2] !== salto) plan.push([t, dir, salto]);
  }
  return plan;
}

// Jugar las jugadas "como una persona": cada una arranca cuando la
// anterior terminó (al pisar algo), con un rato de reacción al azar (de 0 a
// `reaccion` s, sigue lo de antes) y con sus tiempos corridos hasta ±`error`.
// Devuelve qué parte de `n` intentos gana: dice cuánto perdona la escena
// jugada así, que es como se juega (mirando, no con reloj).
export function comoPersona(def, jugadas, { n = 100, reaccion = 0.06, error = 0.03, semilla = 7 } = {}) {
  let a = semilla >>> 0;
  const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ganadas = 0;
  for (let k = 0; k < n; k++) {
    const p = new Partida(def);
    while (p.estado === 'juego' && !p.j.suelo && p.pasos < 600) p.paso();
    for (const j of jugadas) {
      if (p.estado !== 'juego') break;
      const espera = Math.round((r() * reaccion) / PASO);
      for (let i = 0; i < espera && p.estado === 'juego'; i++) p.paso();
      const d = (r() * 2 - 1) * error, c = (r() * 2 - 1) * error;
      jugar(p, { ...j, dur: Math.max(PASO, j.dur + d), cambio: Math.max(0, (j.cambio ?? 9) + c) }, { r, reaccion });
    }
    // si le quedan pasos para llegar (la última jugada lo deja a un toque), sigue quieto un rato
    for (let i = 0; i < 120 && p.estado === 'juego'; i++) p.paso();
    if (p.estado === 'gano') ganadas++;
  }
  return ganadas / n;
}

// las jugadas del guion de una escena, escritas cortas en niveles.js:
// ['hasta', x] · ['camina', d, s] · ['espera', s] · ['calma'] ·
// ['salta', d, s, d en el aire, cuándo cambia] · ['borde', d, s, …]
export function deGuion(g) {
  return g.map(([tipo, a, b, c, e]) => {
    if (tipo === 'hasta') return { tipo, x: a, d: 0, dur: 0 };
    if (tipo === 'calma') return { tipo, d: 0, dur: 0.1 };
    if (tipo === 'espera') return { tipo, d: 0, dur: a };
    if (tipo === 'camina') return { tipo, d: a, dur: b };
    return { tipo, d: a, dur: b, d1: c ?? a, cambio: e ?? 9 };
  });
}

// ¿el plan gana? (y en cuánto)
export function gana(def, plan, op = {}) { const p = jugarPlan(def, plan, op); return p.estado === 'gano' ? p.t : null; }

// Se saca cada cambio que no hace falta, del último al primero, hasta que
// no sobre ninguno: queda algo parecido a lo que haría una persona.
export function simplificar(def, plan) {
  let p = plan.map((c) => [...c]);
  for (let cambio = true; cambio;) {
    cambio = false;
    for (let i = p.length - 1; i >= 1; i--) {
      const q = p.filter((_, k) => k !== i);
      if (gana(def, q) !== null) { p = q; cambio = true; }
    }
    p = p.filter((c, i) => i === 0 || c[1] !== p[i - 1][1] || c[2] !== p[i - 1][2]);
  }
  return p;
}

// El margen: cuánto se puede correr cada cambio del plan (solo ese, antes o
// después) y seguir ganando. Primero se centra cada cambio en su ventana (el
// resolvedor apura todo al límite; una persona no), después se mide.
export function margen(def, plan, { paso = 0.01, max = 0.2, vueltas = 2 } = {}) {
  const p = plan.map((c) => [...c]);
  const ventana = (i) => {
    const prueba = (dt) => {
      const q = p.map((c) => [...c]); q[i][0] = +(q[i][0] + dt).toFixed(3);
      if (q[i][0] < 0 || (i > 0 && q[i][0] <= q[i - 1][0]) || (i < q.length - 1 && q[i][0] >= q[i + 1][0])) return false;
      return gana(def, q) !== null;
    };
    let a = 0, b = 0;
    while (a > -max && prueba(+(a - paso).toFixed(3))) a = +(a - paso).toFixed(3);
    while (b < max && prueba(+(b + paso).toFixed(3))) b = +(b + paso).toFixed(3);
    return [a, b];
  };
  if (gana(def, p) === null) return { ok: false };
  for (let v = 0; v < vueltas; v++) {
    for (let i = 1; i < p.length; i++) {
      const [a, b] = ventana(i), centro = +((a + b) / 2).toFixed(2);
      if (Math.abs(centro) >= paso) p[i][0] = +(p[i][0] + centro).toFixed(3);
    }
  }
  const anchos = p.slice(1).map((_, k) => { const [a, b] = ventana(k + 1); return +(b - a).toFixed(3); });
  return { ok: true, plan: p, anchos, minimo: anchos.length ? Math.min(...anchos) : Infinity };
}

// ── desde la consola ─────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const { NIVELES } = await import('../js/niveles.js');
  const { writeFileSync, readFileSync, existsSync } = await import('node:fs');
  const args = process.argv.slice(2);
  const lista = args.includes('--todos') ? NIVELES : NIVELES.filter((n) => args.includes(n.id));
  const archivo = new URL('./soluciones.json', import.meta.url);
  const guardadas = existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : {};
  for (const def of lista) {
    if (def.guion) {
      const j = deGuion(def.guion);
      console.log(`${def.id}: guion como persona ${Math.round(100 * comoPersona(def, j))} % · con más error ${Math.round(100 * comoPersona(def, j, { reaccion: 0.1, error: 0.05 }))} % · sin error ${comoPersona(def, j, { n: 1, reaccion: 0, error: 0 }) ? 'gana' : 'NO GANA'}`);
      if (args.includes('--guiones')) continue;
    } else if (args.includes('--guiones')) { console.log(`${def.id}: sin guion`); continue; }
    const t0 = performance.now();
    const r = resolver(def);
    const ms = Math.round(performance.now() - t0);
    const ing = resolver(def, { sinTrampas: true, maxNodos: 20000 });
    const ingenuo = ing.plan ? jugarPlan(def, ing.plan) : null;
    if (r.plan) r.plan = simplificar(def, r.plan);
    const m = r.plan ? margen(def, r.plan) : null;
    console.log(`${def.id}: ${r.plan ? `gana en ${r.t.toFixed(2)} s con ${r.plan.length} cambios` : 'SIN SOLUCIÓN'} (${r.nodos} nodos, ${ms} ms)` +
      ` · ingenuo: ${ingenuo ? ingenuo.estado + (ingenuo.causa ? ' por ' + ingenuo.causa : '') : 'sin plan'}` +
      (m?.ok ? ` · margen mínimo ${m.minimo.toFixed(2)} s` : ''));
    if (r.plan && m?.ok) guardadas[def.id] = m.plan;
  }
  if (args.includes('--todos') || args.includes('--guardar')) writeFileSync(archivo, JSON.stringify(guardadas).replace(/\],"/g, '],\n"') + '\n');
}
