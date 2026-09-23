// Que el quebracho se pueda recorrer en el orden de la historia, con la física
// de verdad: para cada tramo junta las salas en un solo mapa (en coordenadas
// del mundo) y busca cómo llegar, con las habilidades que Chispa tiene en ese
// momento. Sin bichos: se comprueba el camino, no la pelea.
// También comprueba lo contrario: que sin el aleteo el túnel no se cruce.
//
//     node luz-mala/pruebas/recorrido.mjs [n° de tramo] [--ver]
import fs from "node:fs";
import { cargar } from "./cargar.mjs";
const L = cargar();
const arg = process.argv.slice(2);
const VER = arg.includes("--ver");
const solo = arg.find((a) => /^\d+$/.test(a));
const K = 5, MAX = 400000;

/* [salas en orden, desde, habilidades, estado, se tiene que poder, qué es,
    a qué baldosa de la última sala hay que llegar (si no, a cualquier lado adentro)] */
const TRAMOS = [
  [["P1", "R1"], "P", {}, {}, true, "del pueblo a las raíces"],
  [["R1", "P1"], "abajo", {}, {}, true, "volver de las raíces al pueblo (la tienda)", [26, 21]],
  [["R1", "R2"], "P1", {}, {}, true, "de las raíces al hongal"],
  [["R2", "R1"], "A1", {}, {}, true, "del hongal de vuelta a las raíces"],
  [["R2", "A1"], "R1", {}, {}, true, "del hongal a la cueva del Torito"],
  [["R2", "T1"], "R1", {}, {}, false, "SIN aleteo el túnel no se cruza"],
  [["A1", "R2"], "J", { aleteo: 1 }, { torito: 1 }, true, "salir de la cueva con el aleteo"],
  [["R2", "T1"], "A1", { aleteo: 1 }, {}, true, "con el aleteo, del hongal a Los hilos"],
  [["T1", "A2"], "R2", { aleteo: 1 }, {}, true, "de Los hilos a la tela de la Viuda"],
  [["T1", "R2"], "A2", { aleteo: 1 }, {}, true, "de Los hilos de vuelta al hongal (al banco)", [20, 21]],
  [["A2", "H1"], "T1", { aleteo: 1, resina: 1 }, { viuda: 1 }, true, "vencida la Viuda, bajar al pique"],
  [["H1", "H2"], "A2", { aleteo: 1, resina: 1 }, { viuda: 1 }, true, "del pique al río de ámbar (trepando con la resina)"],
  [["H1", "A2"], "H2", { aleteo: 1, resina: 1 }, { viuda: 1 }, true, "del pique de vuelta arriba (al piso de la arena)", [16, 17]],
  [["H1", "H2"], "A2", { aleteo: 1 }, { viuda: 1 }, false, "SIN resina el pique no se sube"],
  [["H2", "A3"], "H1", { aleteo: 1, resina: 1 }, { viuda: 1 }, true, "del río de ámbar al corazón"],
];

/* una sala hecha con varias, pegadas donde están en el mundo */
function juntar(ids, habil, estado) {
  const S = ids.map((id) => L.SALA_POR_ID[id]);
  const x0 = Math.min(...S.map((s) => s.pos[0])), y0 = Math.min(...S.map((s) => s.pos[1]));
  const x1 = Math.max(...S.map((s) => s.pos[0] + s.tam[0])), y1 = Math.max(...S.map((s) => s.pos[1] + s.tam[1]));
  const g = Array.from({ length: y1 - y0 }, () => Array(x1 - x0).fill("#"));
  for (const s of S) {
    let nG = 0;
    const gates = [];
    for (let y = 0; y < s.tam[1]; y++) for (let x = 0; x < s.tam[0]; x++) {
      let c = s.mapa[y][x];
      if (c === "G") {
        /* la compuerta: las de jefe están abiertas fuera de la pelea; las otras, según el estado */
        const idx = gateIndex(s, x, y);
        const def = (s.compuertas || [])[idx] || {};
        const abierta = def.jefe || (def.abre && (habil[def.abre] || estado[def.abre]));
        c = abierta ? "." : "#";
      } else if ("#=^v<>~B".indexOf(c) < 0) c = ".";
      g[s.pos[1] - y0 + y][s.pos[0] - x0 + x] = c;
    }
  }
  const sala = { id: ids.join("+"), mapa: g.map((f) => f.join("")), zona: S[0].zona };
  return { sala, x0, y0 };
}
/* el orden de las compuertas es el orden en que aparecen al barrer la sala */
function gateIndex(s, gx, gy) {
  const visto = new Set();
  let n = 0;
  for (let y = 0; y < s.tam[1]; y++) for (let x = 0; x < s.tam[0]; x++) {
    if (s.mapa[y][x] !== "G" || visto.has(x + "," + y)) continue;
    /* un bloque de G: se marca entero */
    let x1 = x; while (x1 + 1 < s.tam[0] && s.mapa[y][x1 + 1] === "G") x1++;
    let y1 = y; while (y1 + 1 < s.tam[1] && s.mapa[y1 + 1][x] === "G") y1++;
    for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) visto.add(xx + "," + yy);
    if (gx >= x && gx <= x1 && gy >= y && gy <= y1) return n;
    n++;
  }
  return 0;
}

/* dónde empieza: la P de la sala, o parada adentro del hueco que da a la vecina */
function inicio(ids, desde, x0, y0) {
  const s = L.SALA_POR_ID[ids[0]];
  if (desde === "P" || desde === "J") { for (let y = 0; y < s.tam[1]; y++) { const x = s.mapa[y].indexOf(desde); if (x >= 0) return { x: (s.pos[0] - x0 + x) * 8, y: (s.pos[1] - y0 + y) * 8 + 8 - L.LF.ALTO }; } }
  if (desde === "abajo") {
    /* el piso más bajo de la sala, en el primer lugar libre */
    for (let y = s.tam[1] - 2; y > 0; y--) for (let x = 1; x < s.tam[0] - 1; x++)
      if (s.mapa[y][x] === "." && s.mapa[y - 1][x] === "." && s.mapa[y + 1][x] === "#") return { x: (s.pos[0] - x0 + x) * 8, y: (s.pos[1] - y0 + y + 1) * 8 - L.LF.ALTO };
  }
  const v = L.SALA_POR_ID[desde];
  const libre = (c) => c !== "#" && c !== "B";
  const celdas = [];
  for (let y = 0; y < s.tam[1]; y++) for (let x = 0; x < s.tam[0]; x++) {
    if (!libre(s.mapa[y][x]) || (x > 0 && x < s.tam[0] - 1 && y > 0 && y < s.tam[1] - 1)) continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const wx = s.pos[0] + x + dx, wy = s.pos[1] + y + dy;
      if (wx >= v.pos[0] && wx < v.pos[0] + v.tam[0] && wy >= v.pos[1] && wy < v.pos[1] + v.tam[1]) celdas.push({ x, y, dx, dy });
    }
  }
  if (!celdas.length) throw new Error(`${s.id} no tiene hueco hacia ${desde}`);
  const c0 = celdas[0];
  if (c0.dx) {
    /* hueco de costado: parada sobre el piso del hueco, dos baldosas adentro */
    const y = Math.max(...celdas.map((c) => c.y));
    const x = c0.dx < 0 ? 1 : s.tam[0] - 2;
    return { x: (s.pos[0] - x0 + x) * 8, y: (s.pos[1] - y0 + y + 1) * 8 - L.LF.ALTO };
  }
  /* hueco de arriba: cayendo por el medio */
  const xs = celdas.map((c) => c.x), xm = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
  return { x: (s.pos[0] - x0 + xm) * 8, y: (s.pos[1] - y0) * 8 + 2 };
}

/* las acciones: andar, saltar, sostener el salto, bajar de un tablón, aleteo */
const ACC = [];
for (const x of [-1, 0, 1]) {
  ACC.push({ x, y: 0 });
  ACC.push({ x, y: 0, salto: 1, nuevo: 1 });
  ACC.push({ x, y: 0, salto: 1 });
}
ACC.push({ x: 0, y: 1, salto: 1, nuevo: 1 });
for (const x of [-1, 1]) ACC.push({ x, y: 0, dash: 1 }, { x, y: 0, dash: 1, salto: 1 });

function acciones(m) {
  const p = m.p;
  return ACC.filter((a) => {
    if (a.dash) return m.habil.aleteo && p.dashEspera <= 0 && !p.dashUsado && p.dashT <= 0;
    if (a.salto && !a.nuevo) return !p.enSuelo && p.vy < 0;
    if (a.y === 1) return p.enSuelo;
    return true;
  });
}
function clonar(m) {
  const n = Object.assign({}, m);
  n.p = Object.assign({}, m.p);
  n.eventos = [];
  return n;
}
function aplicar(m, a) {
  const vida = m.p.vida;
  for (let f = 0; f < K; f++) {
    L.pasarChispa(m, { x: a.x, y: a.y, salto: !!a.salto, saltoE: !!(a.nuevo && f === 0), golpeE: false, dashE: !!(a.dash && f === 0), curar: false });
    m.eventos.length = 0;
    if (m.p.vida < vida || m.volverAlSuelo != null) return false;
  }
  return true;
}
function clave(m) {
  const p = m.p;
  return p.x + "," + p.y + "," + Math.round(p.vx / 13) + "," + Math.round(p.vy / 13) + (p.enSuelo ? "s" : "") + (p.coyote > 0 ? "c" : "") + (p.dashUsado ? "u" : "") + Math.ceil(Math.max(0, p.dashEspera) * 10) + (p.dashT > 0 ? "d" : "") + (p.forzT > 0 ? "f" + p.forzDir : "") + (p.cortado ? "k" : "") + p.pared;
}
class Monton {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i) { const j = (i - 1) >> 1; if (a[j].f <= a[i].f) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() { const a = this.a, r = a[0], x = a.pop(); if (a.length) { a[0] = x; let i = 0; for (;;) { const l = 2 * i + 1, d = l + 1; let k = i; if (l < a.length && a[l].f < a[k].f) k = l; if (d < a.length && a[d].f < a[k].f) k = d; if (k === i) break; [a[i], a[k]] = [a[k], a[i]]; i = k; } } return r; }
}
function distancias(sala, meta) {
  const w = sala.mapa[0].length, h = sala.mapa.length, d = new Int32Array(w * h).fill(1e6), cola = [];
  const libre = (x, y) => x >= 0 && x < w && y >= 0 && y < h && sala.mapa[y][x] !== "#" && sala.mapa[y][x] !== "B";
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (meta(x, y) && libre(x, y)) { d[y * w + x] = 0; cola.push(x, y); }
  for (let i = 0; i < cola.length; i += 2) {
    const x = cola[i], y = cola[i + 1], v = d[y * w + x] + 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (libre(nx, ny) && d[ny * w + nx] > v) { d[ny * w + nx] = v; cola.push(nx, ny); } }
  }
  return (px, py) => { const tx = Math.floor(px / 8), ty = Math.floor(py / 8); if (tx < 0 || ty < 0 || tx >= w || ty >= h) return 1e4; const v = d[ty * w + tx]; return v >= 1e6 ? 1e4 : v; };
}

function recorrer([ids, desde, habil, estado, , , meta]) {
  const { sala, x0, y0 } = juntar(ids, habil, estado);
  const fin = L.SALA_POR_ID[ids[ids.length - 1]];
  const fx0 = fin.pos[0] - x0, fy0 = fin.pos[1] - y0;
  const enMeta = meta ? (tx, ty) => Math.abs(tx - fx0 - meta[0]) <= 1 && Math.abs(ty - fy0 - meta[1]) <= 1
    : (tx, ty) => tx >= fx0 + 1 && tx < fx0 + fin.tam[0] - 1 && ty >= fy0 + 1 && ty < fy0 + fin.tam[1] - 1;
  const dist = distancias(sala, enMeta);
  const m = L.crearMundoLM(sala, { habil: Object.assign({}, habil), estado: Object.assign({}, estado) });
  m.bichos = []; m.cosas = []; m.rompibles = m.rompibles.filter((r) => !r.compuerta);
  m.spawn = inicio(ids, desde, x0, y0);
  Object.assign(m.p, { x: m.spawn.x, y: m.spawn.y, vx: 0, vy: 0, ultimoSuelo: { x: m.spawn.x, y: m.spawn.y } });
  const gana = (n) => enMeta(Math.floor((n.p.x + 4) / 8), Math.floor((n.p.y + 6) / 8));
  const vistos = new Set([clave(m)]);
  const cola = new Monton();
  cola.push({ f: 0, m, prof: 0, padre: null, a: null });
  let exp = 0, mejor = { d: 1e9 };
  while (cola.size && exp < MAX) {
    const nodo = cola.pop();
    exp++;
    for (const a of acciones(nodo.m)) {
      const n = clonar(nodo.m);
      if (!aplicar(n, a)) continue;
      const hijo = { m: n, prof: nodo.prof + 1, padre: nodo, a };
      if (gana(n)) return { ok: true, exp, camino: camino(hijo), sala, x0, y0, inicio: m.spawn };
      const k = clave(n);
      if (vistos.has(k)) continue;
      vistos.add(k);
      const dd = dist(n.p.x + 4, n.p.y + 6);
      hijo.f = dd * 8 + hijo.prof * 0.6;
      if (dd < mejor.d) mejor = { d: dd, nodo: hijo };
      cola.push(hijo);
    }
  }
  return { ok: false, exp, camino: mejor.nodo ? camino(mejor.nodo) : [], sala, x0, y0 };
}
function camino(n) { const r = []; for (; n && n.a; n = n.padre) r.push({ a: n.a, x: n.m.p.x, y: n.m.p.y }); return r.reverse(); }
function dibujar(sala, pasos) {
  const g = sala.mapa.map((f) => f.split(""));
  for (const s of pasos) {
    const tx = Math.floor((s.x + 4) / 8), ty = Math.floor((s.y + 6) / 8);
    if (g[ty] && g[ty][tx] === ".") g[ty][tx] = s.a.dash ? "d" : s.a.y ? "b" : s.a.nuevo ? "s" : "o";
  }
  return g.map((f) => "   " + f.join("")).join("\n");
}

let mal = 0;
const guardados = [];
TRAMOS.forEach((t, i) => {
  if (solo && +solo !== i) return;
  const t0 = Date.now();
  const r = recorrer(t);
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  const bien = r.ok === t[4];
  if (!bien) mal++;
  const que = r.ok ? `se llega en ${r.camino.length * K} cuadros` : "no se llega";
  console.log(`${bien ? "ok " : "MAL"}  ${String(i).padStart(2)} ${t[0].join("→").padEnd(8)} ${t[5].padEnd(52)} ${que} · ${r.exp} estados, ${seg} s`);
  if (VER || !bien) console.log(dibujar(r.sala, r.camino));
  if (r.ok) {
    /* para repetirlo en el juego: dónde empieza, en coordenadas de la primera sala */
    const s0 = L.SALA_POR_ID[t[0][0]];
    guardados.push({ nombre: `${i} ${t[0].join("→")}`, sala: t[0][0], x: r.inicio.x - (s0.pos[0] - r.x0) * 8, y: r.inicio.y - (s0.pos[1] - r.y0) * 8,
      habil: t[2], estado: t[3], k: K, acciones: r.camino.map((c) => c.a), meta: t[0][t[0].length - 1], metaXY: t[6] || null });
  }
});
if (arg.includes("--guardar")) {
  /* se combina con lo que ya había: correr un tramo solo no borra los demás */
  const f = new URL("./recorridos.json", import.meta.url).pathname;
  const viejos = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : [];
  const todos = viejos.filter((v) => !guardados.some((g) => g.nombre === v.nombre)).concat(guardados);
  todos.sort((a, b) => parseInt(a.nombre) - parseInt(b.nombre));
  fs.writeFileSync(f, JSON.stringify(todos));
  console.log(`${guardados.length} recorrido(s) guardado(s); ${todos.length} en pruebas/recorridos.json`);
}
console.log(mal ? `${mal} tramo(s) mal` : "el quebracho se recorre entero, y lo cerrado está cerrado");
process.exit(mal ? 1 : 0);
