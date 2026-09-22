// Resolvedor de salas de ZONDA: busca una forma de pasar cada sala con la
// MISMA física del juego (se carga fisica.js tal cual). Si no la encuentra,
// la sala no se publica: "se ve pasable" no alcanza.
//
//     node zonda/pruebas/resolver.mjs            → todas
//     node zonda/pruebas/resolver.mjs 1-3 --ver  → una, con el camino dibujado
//
// Busca por "mejor primero": prefiere los estados más altos (la salida es
// arriba) y descarta los repetidos. Cada acción dura K cuadros (5 por
// defecto: ~83 ms, menos preciso que un dedo apurado, para que lo que se
// encuentra también le salga a una persona).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const arg = process.argv.slice(2);
const opt = (n, d) => { const i = arg.indexOf("--" + n); return i >= 0 ? +arg[i + 1] : d; };
const K = opt("k", 5), MAX = opt("max", 250000), VER = arg.includes("--ver");
/* lo que no es una opción ni su valor: "1-3" (una sala) o "2" (un capítulo) */
const filtro = arg.find((a, i) => !a.startsWith("--") && !(i > 0 && /^--(k|max)$/.test(arg[i - 1])));

const codigo = ["motor2d/base.js", "zonda/js/fisica.js", "zonda/js/salas.js"]
  .map((f) => fs.readFileSync(path.join(RAIZ, f), "utf8")).join("\n")
  + "\n;globalThis.__Z = { crearMundo, pasarJugadora, SALAS, CAPITULOS, F, TILE, enSuelo, paredAgarrable, paredParaSaltar, chocaSolido };";
const ctx = vm.createContext({ console, Math, Uint8Array, Object, Array, JSON, Set, Map });
vm.runInContext(codigo, ctx, { filename: "zonda.js" });
const Z = ctx.__Z;

/* las acciones: andar, saltar, mantener el salto, caer rápido, trepar, salto
   trepando y los 8 dash */
const ACC = [];
for (const x of [-1, 0, 1]) {
  ACC.push({ x, y: 0 });
  ACC.push({ x, y: 0, salto: 1, nuevo: 1 });
  ACC.push({ x, y: 0, salto: 1 });
  ACC.push({ x, y: 1 });
  for (const y of [-1, 0, 1]) ACC.push({ x, y, agarre: 1 });
  ACC.push({ x, y: -1, agarre: 1, salto: 1, nuevo: 1 });
}
for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]) ACC.push({ x: dx, y: dy, dash: 1 });

/* podar lo que en este estado da lo mismo que otra acción: sin esto el
   resolvedor gasta dos tercios del tiempo probando dash sin dash o agarrarse
   en el aire lejos de toda pared */
function acciones(m) {
  const p = m.p, suelo = Z.enSuelo(m, p);
  const pared = p.estado === "trepa" || Z.paredAgarrable(m, p, -1) || Z.paredAgarrable(m, p, 1);
  return ACC.filter((a) => {
    if (a.dash) return p.dashes > 0 && p.dashEspera <= 0;
    if (a.agarre) return !!pared;
    if (a.salto && !a.nuevo) return !suelo && p.vy < 0;
    if (a.y === 1) return !suelo;
    return true;
  });
}

function clonar(m) {
  const n = Object.assign({}, m);
  n.p = Object.assign({}, m.p);
  n.solidos = m.solidos.map((s) => Object.assign({}, s));
  n.cosas = m.cosas.map((c) => Object.assign({}, c));
  n.eventos = [];
  /* la historia de posiciones solo la usa la carta que sigue a Ayelén */
  n.historia = n.cosas.some((c) => c.tipo === "carta" && c.est === "sigue") ? m.historia.slice(-48) : [];
  n.cartasTomadas = Object.assign({}, m.cartasTomadas);
  return n;
}
function aplicar(m, a) {
  for (let f = 0; f < K; f++) {
    Z.pasarJugadora(m, { x: a.x, y: a.y, salto: !!a.salto, saltoE: !!(a.nuevo && f === 0), dashE: !!(a.dash && f === 0), agarre: !!a.agarre });
    m.eventos.length = 0;
    if (m.p.estado === "muerta" || m.salio || m.cumbre) return;
  }
}
function clave(m) {
  const p = m.p;
  let k = p.x + "," + p.y + "," + Math.round(p.vx / 12) + "," + Math.round(p.vy / 12) + "," + p.dashes + p.estado[0] + Math.round(p.aguante / 22) + (p.varT > 0 ? "v" : "") + (p.forzT > 0 ? "f" : "");
  for (const s of m.solidos) k += s.tipo === "rompible" ? (s.activo ? "B" : "b") : s.est[0] + Math.round((s.k || s.t || 0) * 8);
  for (const c of m.cosas) if (c.tipo === "cristal") k += c.espera > 0 ? Math.ceil(c.espera * 2) : "c"; else if (c.tipo === "caramb" || c.tipo === "carta") k += c.est[0];
  const v = m.sala.viento;
  if (v && v.rafagas) k += "~" + Math.round((m.tiempo % (v.on + v.off)) * 5);
  return k;
}

/* montículo binario chico */
class Monton {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i) { const j = (i - 1) >> 1; if (a[j].f <= a[i].f) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } }
  pop() {
    const a = this.a, r = a[0], u = a.pop();
    if (a.length) { a[0] = u; let i = 0; for (;;) { const l = 2 * i + 1, d = l + 1; let m = i; if (l < a.length && a[l].f < a[m].f) m = l; if (d < a.length && a[d].f < a[m].f) m = d; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } }
    return r;
  }
}

/* distancia de cada baldosa a la salida, caminando por lo que no es roca: guía
   la búsqueda por el camino de verdad. Con "más alto es mejor" el resolvedor
   se gastaba todo saltando contra el techo del arranque en las salas que
   primero van de costado */
function distancias(sala, hacia) {
  const w = sala.mapa[0].length, h = sala.mapa.length, d = new Int32Array(w * h).fill(1e6), cola = [];
  const libre = (x, y) => x >= 0 && x < w && y >= 0 && y < h && sala.mapa[y][x] !== "#" && sala.mapa[y][x] !== "I";
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const meta = hacia === "suelo" ? y + 1 < h && "#I=CBM".includes(sala.mapa[y + 1][x]) && !"#I^v<>".includes(sala.mapa[y][x])
      : hacia ? sala.mapa[y][x] === hacia : sala.final ? sala.mapa[y][x] === "E" : y === 0;
    if (meta && libre(x, y)) { d[y * w + x] = 0; cola.push(x, y); }
  }
  for (let i = 0; i < cola.length; i += 2) {
    const x = cola[i], y = cola[i + 1], v = d[y * w + x] + 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (libre(nx, ny) && d[ny * w + nx] > v) { d[ny * w + nx] = v; cola.push(nx, ny); }
    }
  }
  return (px, py) => {
    const tx = lim(Math.floor(px / 8), 0, w - 1), ty = lim(Math.floor(py / 8), 0, h - 1);
    const v = d[ty * w + tx];
    return v >= 1e6 ? 1e4 : v;
  };
}
const lim = (v, a, b) => v < a ? a : v > b ? b : v;

/* hacia: null (la salida) o "L" (la carta: gana cuando queda asegurada).
   desde: un mundo ya empezado (para seguir de la carta a la salida) */
function resolver(sala, dashesMax, hacia, desde) {
  const dist = distancias(sala, hacia), aSuelo = hacia ? distancias(sala, "suelo") : null;
  let m = desde || Z.crearMundo(sala, { dashesMax, cartasTomadas: {} });
  if (!desde && Z.chocaSolido(m, m.spawn.x, m.spawn.y, 8, 11)) return { ok: false, exp: 0, mejor: { x: m.spawn.x, y: m.spawn.y }, camino: [], motivo: "la P está adentro de algo sólido" };
  let n0 = 0;
  while (m.p.estado === "entra" && n0++ < 400) Z.pasarJugadora(m, { x: 0, y: 0 });
  const gana = hacia ? (n) => Object.keys(n.cartasTomadas).length > 0 : (n) => n.salio || n.cumbre;
  const vistos = new Set([clave(m)]);
  const cola = new Monton();
  cola.push({ f: 0, m, prof: 0, padre: null, a: null });
  let exp = 0, mejor = { y: 1e9, d: 1e9 };
  while (cola.size && exp < MAX) {
    const nodo = cola.pop();
    exp++;
    for (const a of acciones(nodo.m)) {
      const n = clonar(nodo.m);
      aplicar(n, a);
      if (n.p.estado === "muerta") continue;
      const hijo = { m: n, prof: nodo.prof + 1, padre: nodo, a };
      if (gana(n)) return { ok: true, exp, camino: camino(hijo), final: n };
      if (!hacia && (n.salio || n.cumbre)) continue;
      const k = clave(n);
      if (vistos.has(k)) continue;
      vistos.add(k);
      /* con la carta siguiéndola solo falta pisar firme: se busca el piso más cerca */
      const sigue = hacia && n.cosas.some((c) => c.tipo === "carta" && c.est === "sigue");
      const dd = sigue ? 0 : dist(n.p.x + 4, n.p.y + 6);
      hijo.f = (sigue ? aSuelo(n.p.x + 4, n.p.y + 6) * 8 - 1e4 : dd * 8) + hijo.prof * 0.8;
      if (dd < mejor.d) mejor = { d: dd, y: n.p.y, x: n.p.x, nodo: hijo };
      cola.push(hijo);
    }
  }
  return { ok: false, exp, mejor, camino: mejor.nodo ? camino(mejor.nodo) : [] };
}
function camino(n) {
  const r = [];
  for (; n && n.a; n = n.padre) r.push({ a: n.a, x: n.m.p.x, y: n.m.p.y });
  return r.reverse();
}

function dibujar(sala, pasos) {
  const g = sala.mapa.map((f) => f.split(""));
  for (const s of pasos) {
    const tx = Math.floor((s.x + 4) / 8), ty = Math.floor((s.y + 6) / 8);
    if (ty >= 0 && ty < g.length && tx >= 0 && tx < g[0].length && g[ty][tx] === ".") g[ty][tx] = s.a.dash ? "d" : s.a.agarre ? "|" : s.a.nuevo ? "s" : "o";
  }
  return g.map((f) => "   " + f.join("")).join("\n");
}

/* modo cartas: que cada carta se pueda agarrar y, con ella, salir */
if (arg.includes("--cartas")) {
  let malas = 0;
  for (const cap of Z.CAPITULOS) for (const sala of cap.salas) {
    if (filtro && !sala.id.startsWith(filtro)) continue;
    if (!sala.mapa.some((f) => f.includes("L"))) continue;
    const t0 = Date.now();
    const a = resolver(sala, cap.dashes, "L");
    const b = a.ok ? resolver(sala, cap.dashes, null, clonar(a.final)) : { ok: false };
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    if (a.ok && b.ok) console.log(`ok   ${sala.id.padEnd(5)} carta en ${a.camino.length * K} cuadros y salida en ${b.camino.length * K} más · ${seg} s`);
    else { malas++; console.log(`MAL  ${sala.id.padEnd(5)} ${a.ok ? "con la carta no se llega a la salida" : "la carta no se alcanza"} · ${seg} s`); if (VER) console.log(dibujar(sala, a.camino)); }
  }
  console.log(malas ? `${malas} carta(s) con problemas` : "todas las cartas se pueden agarrar");
  process.exit(malas ? 1 : 0);
}

const salida = path.join(RAIZ, "zonda/pruebas/soluciones.json");
const guardadas = fs.existsSync(salida) ? JSON.parse(fs.readFileSync(salida, "utf8")) : {};
let fallas = 0;
for (const cap of Z.CAPITULOS) for (const sala of cap.salas) {
  if (filtro && !sala.id.startsWith(filtro)) continue;
  const t0 = Date.now();
  const r = resolver(sala, cap.dashes);
  const seg = ((Date.now() - t0) / 1000).toFixed(1);
  const usa = { dash: 0, trepa: 0, salto: 0 };
  for (const s of r.camino) { if (s.a.dash) usa.dash++; if (s.a.agarre) usa.trepa++; if (s.a.nuevo) usa.salto++; }
  if (r.ok) {
    console.log(`ok   ${sala.id.padEnd(5)} ${sala.nombre.padEnd(22)} ${String(r.camino.length * K).padStart(4)} cuadros · ${usa.salto} saltos, ${usa.dash} dash, ${usa.trepa} trepando · ${r.exp} estados, ${seg} s`);
    guardadas[sala.id] = { k: K, acciones: r.camino.map((s) => s.a) };
  } else {
    fallas++;
    console.log(`MAL  ${sala.id.padEnd(5)} ${sala.nombre.padEnd(22)} ${r.motivo || "no se encontró salida"} (${r.exp} estados, ${seg} s); lo más alto: x ${r.mejor.x} y ${r.mejor.y}`);
  }
  if (VER || !r.ok) console.log(dibujar(sala, r.camino));
}
fs.writeFileSync(salida, JSON.stringify(guardadas));
console.log(fallas ? `${fallas} sala(s) sin salida` : "todas las salas tienen salida");
process.exit(fallas ? 1 : 0);
