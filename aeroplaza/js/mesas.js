/* ============================================================================
   aeroplaza/js/mesas.js — los juegos de mesa de la Zona de Juegos: damas,
   ta-te-ti, cuatro en línea, memotest y piedra, papel o tijera.
   - Cada mesa tiene dos sillas. Sentarse abre el tablero (un panel de vidrio a
     la derecha) y el mismo dibujo va arriba de la mesa, en 3D: los que pasan
     ven la partida.
   - Si en la otra silla hay alguien de verdad, se juega contra esa persona por
     la sala (MQTT); si está vacía, contra la compu. Si alguien se sienta
     mientras jugás contra la compu, empieza una partida entre los dos.
   - La red: quién está sentado dónde va en el estado de cada uno ('mesa':
     "3.1" = mesa 3, silla 1). Las jugadas van como acción 'mesa'
     ({ m, op: 'jugada', j, n }); la silla 0 es la que manda: arranca la
     partida (op 'nueva', con la semilla del memotest) y, si alguien se perdió
     una jugada (n no coincide), le manda el estado entero (op 'estado').
   - Las reglas son funciones puras sobre un estado JSON, iguales en las dos
     compus: con la misma jugada, el mismo resultado.
   ========================================================================== */
import * as THREE from 'three';
import { t, sumar } from './textos.js';
import { modelo } from './modelos.js';

sumar({
  es: { mesa_damas: 'Damas', mesa_tateti: 'Ta-te-ti', mesa_cuatro: 'Cuatro en línea', mesa_memo: 'Memotest', mesa_ppt: 'Piedra, papel o tijera',
    mesa_sentarse: 'Sentarse · {n}', mesa_vos: 'Vos', mesa_compu: 'Compu', mesa_tu_turno: '¡Te toca!', mesa_turno_de: 'Le toca a {n}', mesa_gano: '¡Ganó {n}!', mesa_ganaste: '¡Ganaste!', mesa_perdiste: 'Perdiste…', mesa_empate: 'Empate',
    mesa_otra: '↺ Otra', mesa_levantarse: 'Levantarse', mesa_contra: 'contra {n}', mesa_llego: '{n} se sentó a jugar con vos', mesa_se_fue: '{n} se levantó: seguís contra la compu', mesa_elegi: 'Elegí', mesa_esperando: 'Esperando a {n}…', mesa_pares: 'Pares', mesa_ronda: 'Ronda {n}', mesa_come: 'Tenés que comer' },
  en: { mesa_damas: 'Checkers', mesa_tateti: 'Tic-tac-toe', mesa_cuatro: 'Connect four', mesa_memo: 'Memory', mesa_ppt: 'Rock, paper, scissors',
    mesa_sentarse: 'Sit down · {n}', mesa_vos: 'You', mesa_compu: 'CPU', mesa_tu_turno: 'Your turn!', mesa_turno_de: "{n}'s turn", mesa_gano: '{n} wins!', mesa_ganaste: 'You win!', mesa_perdiste: 'You lost…', mesa_empate: 'Draw',
    mesa_otra: '↺ Again', mesa_levantarse: 'Stand up', mesa_contra: 'vs {n}', mesa_llego: '{n} sat down to play with you', mesa_se_fue: '{n} left: you play the CPU now', mesa_elegi: 'Choose', mesa_esperando: 'Waiting for {n}…', mesa_pares: 'Pairs', mesa_ronda: 'Round {n}', mesa_come: 'You must capture' },
  pt: { mesa_damas: 'Damas', mesa_tateti: 'Jogo da velha', mesa_cuatro: 'Lig 4', mesa_memo: 'Jogo da memória', mesa_ppt: 'Pedra, papel e tesoura',
    mesa_sentarse: 'Sentar · {n}', mesa_vos: 'Você', mesa_compu: 'CPU', mesa_tu_turno: 'Sua vez!', mesa_turno_de: 'Vez de {n}', mesa_gano: '{n} ganhou!', mesa_ganaste: 'Você ganhou!', mesa_perdiste: 'Você perdeu…', mesa_empate: 'Empate',
    mesa_otra: '↺ De novo', mesa_levantarse: 'Levantar', mesa_contra: 'contra {n}', mesa_llego: '{n} sentou para jogar com você', mesa_se_fue: '{n} saiu: agora é contra a CPU', mesa_elegi: 'Escolha', mesa_esperando: 'Esperando {n}…', mesa_pares: 'Pares', mesa_ronda: 'Rodada {n}', mesa_come: 'Você tem que capturar' },
});

/* ============================================================ las reglas */
const azarDe = (sem) => { let s = sem >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const LINEAS3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export const REGLAS = {
  /* ------------------------------------------------ ta-te-ti */
  tateti: {
    nuevo: () => ({ c: Array(9).fill(-1), turno: 0, n: 0 }),
    ganador(S) { for (const [a, b, c] of LINEAS3) if (S.c[a] >= 0 && S.c[a] === S.c[b] && S.c[a] === S.c[c]) return { g: S.c[a], linea: [a, b, c] }; return S.c.every((v) => v >= 0) ? { g: 'empate' } : null; },
    jugadas(S) { return this.ganador(S) ? [] : S.c.map((v, i) => (v < 0 ? i : -1)).filter((i) => i >= 0); },
    jugar(S, j) { const q = { ...S, c: S.c.slice() }; q.c[j] = S.turno; q.turno = 1 - S.turno; q.n++; return q; },
    /* minimax entero; la compu se equivoca a propósito 1 de cada 4 (si no, nunca se le gana) */
    compu(S, r) {
      const J = this.jugadas(S); if (r() < 0.25) return J[Math.floor(r() * J.length)];
      const yo = S.turno;
      const mm = (q, prof) => { const g = this.ganador(q); if (g) return g.g === 'empate' ? 0 : g.g === yo ? 10 - prof : prof - 10; const v = this.jugadas(q).map((j) => mm(this.jugar(q, j), prof + 1)); return q.turno === yo ? Math.max(...v) : Math.min(...v); };
      let mejor = J[0], mv = -99; for (const j of J) { const v = mm(this.jugar(S, j), 1) + r() * 0.1; if (v > mv) { mv = v; mejor = j; } } return mejor;
    },
  },
  /* ------------------------------------------------ cuatro en línea (7 × 6, cae la ficha) */
  cuatro: {
    nuevo: () => ({ c: Array(42).fill(-1), turno: 0, n: 0 }),
    fila(S, col) { for (let f = 5; f >= 0; f--) if (S.c[f * 7 + col] < 0) return f; return -1; },
    ganador(S) {
      for (let f = 0; f < 6; f++) for (let c = 0; c < 7; c++) {
        const v = S.c[f * 7 + c]; if (v < 0) continue;
        for (const [df, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          const L = [f * 7 + c]; let ff = f, cc = c;
          for (let k = 1; k < 4; k++) { ff += df; cc += dc; if (ff < 0 || ff > 5 || cc < 0 || cc > 6 || S.c[ff * 7 + cc] !== v) break; L.push(ff * 7 + cc); }
          if (L.length === 4) return { g: v, linea: L };
        }
      }
      return S.c.every((v) => v >= 0) ? { g: 'empate' } : null;
    },
    jugadas(S) { return this.ganador(S) ? [] : [0, 1, 2, 3, 4, 5, 6].filter((c) => S.c[c] < 0); },
    jugar(S, col) { const q = { ...S, c: S.c.slice() }; const f = this.fila(S, col); q.c[f * 7 + col] = S.turno; q.turno = 1 - S.turno; q.n++; q.ultima = f * 7 + col; return q; },
    /* gana si puede, tapa si el otro gana, no le deja una servida, y prefiere el medio */
    compu(S, r) {
      const J = this.jugadas(S), yo = S.turno;
      for (const j of J) if (this.ganador(this.jugar(S, j))?.g === yo) return j;
      for (const j of J) { const q = { ...S, turno: 1 - yo }; if (this.ganador(this.jugar(q, j))?.g === 1 - yo) return j; }
      const seguras = J.filter((j) => { const q = this.jugar(S, j); return !this.jugadas(q).some((k) => this.ganador(this.jugar(q, k))?.g === 1 - yo); });
      const L = seguras.length ? seguras : J;
      return L.map((j) => [j, -Math.abs(j - 3) + r() * 1.6]).sort((a, b) => b[1] - a[1])[0][0];
    },
  },
  /* ------------------------------------------------ damas (8 × 8, reglas americanas: comer es obligatorio,
     se come en cadena, la dama corona al llegar al fondo y va de a un casillero para cualquier lado).
     b: 1 peón del 0 (abajo, sube), 2 dama del 0, -1 peón del 1, -2 dama del 1. Jugada: { de, ruta: [...], come: [...] } */
  damas: {
    nuevo() { const b = Array(64).fill(0); for (let f = 0; f < 8; f++) for (let c = 0; c < 8; c++) if ((f + c) % 2 === 1) { if (f < 3) b[f * 8 + c] = -1; if (f > 4) b[f * 8 + c] = 1; } return { b, turno: 0, n: 0, sinComer: 0 }; },
    de: (v) => (v > 0 ? 0 : v < 0 ? 1 : -1),
    movidas(S, jug) {
      const b = S.b, out = [], saltos = [];
      const dirs = (v) => (Math.abs(v) === 2 ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : v > 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
      const cadena = (de, pos, v, comidas, ruta) => {
        let siguio = false;
        const f = pos >> 3, c = pos & 7;
        for (const [df, dc] of dirs(v)) {
          const f1 = f + df, c1 = c + dc, f2 = f + 2 * df, c2 = c + 2 * dc;
          if (f2 < 0 || f2 > 7 || c2 < 0 || c2 > 7) continue;
          const m = f1 * 8 + c1, a = f2 * 8 + c2;
          if (b[m] && this.de(b[m]) !== jug && !comidas.includes(m) && (b[a] === 0 || a === de)) {
            siguio = true;
            const corona = Math.abs(v) === 1 && (v > 0 ? f2 === 0 : f2 === 7);
            if (corona) saltos.push({ de, ruta: [...ruta, a], come: [...comidas, m] });   // (al coronar se termina la cadena)
            else cadena(de, a, v, [...comidas, m], [...ruta, a]);
          }
        }
        if (!siguio && comidas.length) saltos.push({ de, ruta, come: comidas });
      };
      for (let i = 0; i < 64; i++) {
        if (!b[i] || this.de(b[i]) !== jug) continue;
        cadena(i, i, b[i], [], []);
        const f = i >> 3, c = i & 7;
        for (const [df, dc] of dirs(b[i])) { const f1 = f + df, c1 = c + dc; if (f1 >= 0 && f1 < 8 && c1 >= 0 && c1 < 8 && b[f1 * 8 + c1] === 0) out.push({ de: i, ruta: [f1 * 8 + c1], come: [] }); }
      }
      return saltos.length ? saltos : out;
    },
    ganador(S) { if (!this.movidas(S, S.turno).length) return { g: 1 - S.turno }; if (S.sinComer >= 80) return { g: 'empate' }; return null; },
    jugadas(S) { return this.ganador(S) ? [] : this.movidas(S, S.turno); },
    jugar(S, j) {
      const q = { ...S, b: S.b.slice() }, v = q.b[j.de], fin = j.ruta[j.ruta.length - 1];
      q.b[j.de] = 0; for (const m of j.come) q.b[m] = 0;
      q.b[fin] = Math.abs(v) === 1 && (v > 0 ? fin >> 3 === 0 : fin >> 3 === 7) ? v * 2 : v;
      q.turno = 1 - S.turno; q.n++; q.sinComer = j.come.length ? 0 : S.sinComer + 1; q.ultima = j;
      return q;
    },
    valor(S, jug) { let s = 0; for (let i = 0; i < 64; i++) { const v = S.b[i]; if (!v) continue; const f = i >> 3, mio = this.de(v) === jug; const p = Math.abs(v) === 2 ? 1.7 : 1 + (v > 0 ? 7 - f : f) * 0.04; s += mio ? p : -p; } return s; },
    /* dos jugadas de profundidad: la mejor contando la respuesta del otro */
    compu(S, r) {
      const J = this.jugadas(S), yo = S.turno; let mejor = J[0], mv = -1e9;
      for (const j of J) {
        const q = this.jugar(S, j), R = this.jugadas(q);
        let peor = R.length ? 1e9 : 50;
        for (const k of R) { const q2 = this.jugar(q, k); const R2 = this.jugadas(q2); let m2 = -1e9; for (const k2 of R2.slice(0, 12)) m2 = Math.max(m2, this.valor(this.jugar(q2, k2), yo)); if (!R2.length) m2 = this.valor(q2, yo) - 30; peor = Math.min(peor, m2); }
        const v = peor + r() * 0.3; if (v > mv) { mv = v; mejor = j; }
      }
      return mejor;
    },
  },
  /* ------------------------------------------------ memotest: 16 cartas, 8 pares; si acertás, seguís */
  memo: {
    ICONOS: ['🫧', '🐬', '🌸', '⭐', '🍓', '🎵', '🪐', '🐠'],
    nuevo(sem = 1) { const r = azarDe(sem), c = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]; for (let i = 15; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [c[i], c[k]] = [c[k], c[i]]; } return { c, hecha: Array(16).fill(-1), abiertas: [], puntos: [0, 0], turno: 0, n: 0 }; },
    /* dos cartas abiertas: se resuelve en la jugada siguiente (o sola, a los 0,9 s: las dos compus igual) */
    resolver(S) {
      if (S.abiertas.length < 2) return S;
      const q = { ...S, hecha: S.hecha.slice(), puntos: S.puntos.slice() }; const [a, b] = S.abiertas;
      if (S.c[a] === S.c[b]) { q.hecha[a] = q.hecha[b] = S.turno; q.puntos[S.turno]++; } else q.turno = 1 - S.turno;
      q.abiertas = []; return q;
    },
    ganador(S) { const R = this.resolver(S); if (R.hecha.every((v) => v >= 0)) return { g: R.puntos[0] === R.puntos[1] ? 'empate' : R.puntos[0] > R.puntos[1] ? 0 : 1 }; return null; },
    jugadas(S) { if (this.ganador(S)) return []; const R = this.resolver(S); return R.c.map((v, i) => i).filter((i) => R.hecha[i] < 0 && !R.abiertas.includes(i)); },
    jugar(S, j) { const q = this.resolver(S); const out = { ...q, abiertas: [...q.abiertas, j], n: S.n + 1 }; return out; },
    /* se acuerda de lo que vio (no de todo: 3 de cada 4 cartas) */
    compu(S, r, vistas = {}) {
      const R = this.resolver(S), J = this.jugadas(S), sabe = (i) => vistas[i] != null;
      if (R.abiertas.length === 1) { const a = R.abiertas[0]; const par = J.find((i) => sabe(i) && vistas[i] === R.c[a]); if (par != null && r() < 0.85) return par; const nuevas = J.filter((i) => !sabe(i)); return (nuevas.length ? nuevas : J)[Math.floor(r() * (nuevas.length || J.length))]; }
      const porIcono = {}; for (const i of J) if (sabe(i)) (porIcono[vistas[i]] ||= []).push(i);
      const par = Object.values(porIcono).find((l) => l.length >= 2); if (par && r() < 0.85) return par[0];
      const nuevas = J.filter((i) => !sabe(i)); const L = nuevas.length ? nuevas : J; return L[Math.floor(r() * L.length)];
    },
  },
  /* ------------------------------------------------ piedra, papel o tijera: eligen los dos a la vez; a 3 */
  ppt: {
    nuevo: () => ({ e: [null, null], puntos: [0, 0], ronda: 1, ultima: null, n: 0, turno: 'ambos' }),
    ganador(S) { if (S.puntos[0] >= 3) return { g: 0 }; if (S.puntos[1] >= 3) return { g: 1 }; return null; },
    jugadas(S, quien) { return this.ganador(S) || S.e[quien] != null ? [] : [0, 1, 2]; },
    /* j: { q: silla, e: 0 piedra, 1 papel, 2 tijera } */
    jugar(S, j) {
      const q = { ...S, e: S.e.slice(), puntos: S.puntos.slice(), n: S.n + 1 }; q.e[j.q] = j.e;
      if (q.e[0] != null && q.e[1] != null) {
        const [a, b] = q.e, g = a === b ? -1 : (a - b + 3) % 3 === 1 ? 0 : 1;
        if (g >= 0) q.puntos[g]++;
        q.ultima = [a, b, g]; q.e = [null, null]; q.ronda++;
      }
      return q;
    },
    compu: (S, r) => Math.floor(r() * 3),
  },
};
const PPT = ['🪨', '📄', '✂️'];
export const JUEGOS_MESA = Object.keys(REGLAS);

/* ============================================================ el dibujo (panel y mesa 3D, el mismo) */
function redondo(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function ficha(g, x, y, r, quien, dama = false) {
  const col = quien === 0 ? ['#ffffff', '#6fd6ff', '#1a8fd8'] : ['#fff0f8', '#ff8fc8', '#e0408a'];
  g.save(); g.shadowColor = 'rgba(0,40,80,0.35)'; g.shadowBlur = r * 0.35; g.shadowOffsetY = r * 0.12;
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, col[0]); gr.addColorStop(0.45, col[1]); gr.addColorStop(1, col[2]);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore();
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.45, r * 0.45, r * 0.22, -0.4, 0, 7); g.fill();
  if (dama) { g.fillStyle = '#ffd23f'; g.font = `900 ${Math.round(r * 1.1)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♛', x, y + r * 0.05); }
}
/* W: lado del lienzo. o: { sel, destinos, yo, hover } */
export function dibujarMesa(g, juego, S, W, o = {}) {
  g.clearRect(0, 0, W, W);
  const fondo = g.createLinearGradient(0, 0, 0, W); fondo.addColorStop(0, '#f4fdff'); fondo.addColorStop(1, '#cdefff');
  g.fillStyle = fondo; redondo(g, 0, 0, W, W, W * 0.06); g.fill();
  const R = REGLAS[juego], gan = R.ganador(S);
  if (juego === 'tateti') {
    const m = W * 0.1, c = (W - 2 * m) / 3;
    g.strokeStyle = 'rgba(26,143,216,0.55)'; g.lineWidth = W * 0.018; g.lineCap = 'round';
    for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(m + k * c, m); g.lineTo(m + k * c, W - m); g.moveTo(m, m + k * c); g.lineTo(W - m, m + k * c); g.stroke(); }
    S.c.forEach((v, i) => {
      const x = m + (i % 3 + 0.5) * c, y = m + (Math.floor(i / 3) + 0.5) * c;
      if (v === 0) { g.strokeStyle = '#1a8fd8'; g.lineWidth = W * 0.035; const k = c * 0.28; g.beginPath(); g.moveTo(x - k, y - k); g.lineTo(x + k, y + k); g.moveTo(x + k, y - k); g.lineTo(x - k, y + k); g.stroke(); }
      else if (v === 1) { g.strokeStyle = '#e0408a'; g.lineWidth = W * 0.035; g.beginPath(); g.arc(x, y, c * 0.3, 0, 7); g.stroke(); }
      else if (o.hover === i) { g.fillStyle = 'rgba(52,190,240,0.15)'; g.beginPath(); g.arc(x, y, c * 0.32, 0, 7); g.fill(); }
    });
    if (gan?.linea) { const P = (i) => [m + (i % 3 + 0.5) * c, m + (Math.floor(i / 3) + 0.5) * c]; const [a, , b] = gan.linea; g.strokeStyle = 'rgba(255,210,63,0.9)'; g.lineWidth = W * 0.03; g.beginPath(); g.moveTo(...P(a)); g.lineTo(...P(b)); g.stroke(); }
  } else if (juego === 'cuatro') {
    const m = W * 0.06, c = (W - 2 * m) / 7, y0 = W - m - 6 * c;
    const tabla = g.createLinearGradient(0, y0, 0, W); tabla.addColorStop(0, '#39b8f0'); tabla.addColorStop(1, '#1576c8');
    g.fillStyle = tabla; redondo(g, m * 0.6, y0 - c * 0.15, W - m * 1.2, 6 * c + c * 0.3, c * 0.3); g.fill();
    for (let f = 0; f < 6; f++) for (let k = 0; k < 7; k++) {
      const v = S.c[f * 7 + k], x = m + (k + 0.5) * c, y = y0 + (f + 0.5) * c;
      if (v < 0) { g.fillStyle = '#e8f8ff'; g.beginPath(); g.arc(x, y, c * 0.38, 0, 7); g.fill(); } else ficha(g, x, y, c * 0.4, v);
    }
    if (o.hover != null && o.hover >= 0) { const x = m + (o.hover + 0.5) * c; g.globalAlpha = 0.5; ficha(g, x, y0 - c * 0.55 < 0 ? c * 0.5 : y0 - c * 0.55, c * 0.35, S.turno); g.globalAlpha = 1; }
    if (gan?.linea) { g.strokeStyle = 'rgba(255,210,63,0.95)'; g.lineWidth = c * 0.14; const P = (i) => [m + ((i % 7) + 0.5) * c, y0 + (Math.floor(i / 7) + 0.5) * c]; g.beginPath(); g.moveTo(...P(gan.linea[0])); g.lineTo(...P(gan.linea[3])); g.stroke(); }
  } else if (juego === 'damas') {
    const m = W * 0.04, c = (W - 2 * m) / 8;
    const casilla = (i) => { const f = i >> 3, k = i & 7; return o.yo === 1 ? [m + (7 - k) * c, m + (7 - f) * c] : [m + k * c, m + f * c]; };
    for (let i = 0; i < 64; i++) { const [x, y] = casilla(i); g.fillStyle = ((i >> 3) + (i & 7)) % 2 ? '#8fd8ff' : '#ffffff'; g.fillRect(x, y, c + 0.5, c + 0.5); }
    if (S.ultima) for (const i of [S.ultima.de, ...S.ultima.ruta]) { const [x, y] = casilla(i); g.fillStyle = 'rgba(255,210,63,0.35)'; g.fillRect(x, y, c, c); }
    for (const i of o.destinos || []) { const [x, y] = casilla(i); g.fillStyle = 'rgba(86,208,90,0.55)'; g.beginPath(); g.arc(x + c / 2, y + c / 2, c * 0.2, 0, 7); g.fill(); }
    for (let i = 0; i < 64; i++) { const v = S.b[i]; if (!v) continue; const [x, y] = casilla(i); if (o.sel === i) { g.fillStyle = 'rgba(255,210,63,0.6)'; g.beginPath(); g.arc(x + c / 2, y + c / 2, c * 0.48, 0, 7); g.fill(); } ficha(g, x + c / 2, y + c / 2, c * 0.38, v > 0 ? 0 : 1, Math.abs(v) === 2); }
  } else if (juego === 'memo') {
    const m = W * 0.06, c = (W - 2 * m) / 4, R2 = REGLAS.memo, Q = S;
    for (let i = 0; i < 16; i++) {
      const x = m + (i % 4) * c + c * 0.06, y = m + Math.floor(i / 4) * c + c * 0.06, w = c * 0.88;
      const abierta = Q.hecha[i] >= 0 || Q.abiertas.includes(i);
      if (abierta) {
        g.fillStyle = Q.hecha[i] === 0 ? '#dff6ff' : Q.hecha[i] === 1 ? '#ffe6f4' : '#ffffff'; redondo(g, x, y, w, w, w * 0.16); g.fill();
        g.strokeStyle = Q.hecha[i] === 0 ? '#39b8f0' : Q.hecha[i] === 1 ? '#ff6fb0' : '#ffd23f'; g.lineWidth = w * 0.05; g.stroke();
        g.font = `${Math.round(w * 0.55)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(R2.ICONOS[Q.c[i]], x + w / 2, y + w * 0.54);
      } else {
        const gr = g.createLinearGradient(x, y, x, y + w); gr.addColorStop(0, o.hover === i ? '#7fe0ff' : '#5fd0ff'); gr.addColorStop(1, '#1a8fd8');
        g.fillStyle = gr; redondo(g, x, y, w, w, w * 0.16); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x + w * 0.35, y + w * 0.32, w * 0.14, 0, 7); g.fill(); g.beginPath(); g.arc(x + w * 0.6, y + w * 0.62, w * 0.09, 0, 7); g.fill();
      }
    }
  } else if (juego === 'ppt') {
    const yo = o.yo ?? 0, otro = 1 - yo;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const u = S.ultima;
    const mano = (x, y, e, oculta) => { g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x, y, W * 0.15, 0, 7); g.fill(); g.strokeStyle = '#39b8f0'; g.lineWidth = W * 0.012; g.stroke(); g.font = `${Math.round(W * 0.15)}px sans-serif`; g.fillStyle = '#1a78c2'; g.fillText(oculta ? '❔' : e == null ? '…' : PPT[e], x, y + W * 0.01); };
    const miaAhora = S.e[yo], suyaAhora = S.e[otro];
    mano(W * 0.28, W * 0.32, miaAhora != null ? miaAhora : u ? u[yo] : null, false);
    mano(W * 0.72, W * 0.32, suyaAhora != null ? null : u ? u[otro] : null, suyaAhora != null);
    g.font = `900 ${Math.round(W * 0.08)}px sans-serif`; g.fillStyle = '#1a78c2'; g.fillText(`${S.puntos[yo]} – ${S.puntos[otro]}`, W / 2, W * 0.58);
    /* los tres botones de elegir */
    for (let e = 0; e < 3; e++) { const x = W * (0.2 + e * 0.3), y = W * 0.82; g.fillStyle = o.hover === e ? '#dff6ff' : '#ffffff'; redondo(g, x - W * 0.12, y - W * 0.1, W * 0.24, W * 0.2, W * 0.05); g.fill(); g.strokeStyle = miaAhora === e ? '#56d05a' : '#9fdcf5'; g.lineWidth = W * 0.012; g.stroke(); g.font = `${Math.round(W * 0.11)}px sans-serif`; g.fillText(PPT[e], x, y + W * 0.005); }
  }
}
/* de un toque en el panel (u, v de 0 a 1) a la jugada */
function tocar(juego, S, u, v, o) {
  if (juego === 'tateti') { const m = 0.1, c = (1 - 2 * m) / 3, i = Math.floor((u - m) / c), f = Math.floor((v - m) / c); return i >= 0 && i < 3 && f >= 0 && f < 3 ? f * 3 + i : null; }
  if (juego === 'cuatro') { const m = 0.06, c = (1 - 2 * m) / 7, k = Math.floor((u - m) / c); return k >= 0 && k < 7 ? k : null; }
  if (juego === 'memo') { const m = 0.06, c = (1 - 2 * m) / 4, i = Math.floor((u - m) / c), f = Math.floor((v - m) / c); return i >= 0 && i < 4 && f >= 0 && f < 4 ? f * 4 + i : null; }
  if (juego === 'ppt') { if (v < 0.7 || v > 0.94) return null; const e = Math.round((u - 0.2) / 0.3); return e >= 0 && e < 3 && Math.abs(u - (0.2 + e * 0.3)) < 0.13 ? e : null; }
  if (juego === 'damas') { const m = 0.04, c = (1 - 2 * m) / 8; let k = Math.floor((u - m) / c), f = Math.floor((v - m) / c); if (k < 0 || k > 7 || f < 0 || f > 7) return null; if (o.yo === 1) { k = 7 - k; f = 7 - f; } return f * 8 + k; }
  return null;
}

/* ============================================================ las mesas en el mundo */
export class Mesas {
  /* lista: [{ x, z, rot, juego, y }] */
  constructor(grupo, mundo, lista) {
    this.lista = lista.map((M, i) => this.armar(grupo, mundo, M, i));
    this.mia = null;        // { i, silla }
    this.panel = null;
    this.r = azarDe(Date.now() & 0xffff);
    this.tRecordar = 0;
    this.reglas = REGLAS;   // (para las pruebas)
  }
  armar(grupo, mundo, M, i) {
    const g = new THREE.Group(); g.position.set(M.x, M.y, M.z); g.rotation.y = M.rot; grupo.add(g);
    /* la mesa redonda de vidrio con el tablero arriba, y dos sillas burbuja (construcciones.js, copiadas del GLB) */
    g.add(modelo('mesaJuego', { escala: 1 }));
    const lienzo = document.createElement('canvas'); lienzo.width = lienzo.height = 256;
    const tex = new THREE.CanvasTexture(lienzo); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const tablero = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true })); tablero.position.y = 0.836; tablero.renderOrder = 4; g.add(tablero);
    const sillas = [0, 1].map((s) => {
      const z = s === 0 ? 1.15 : -1.15, rot = s === 0 ? Math.PI : 0;
      const silla = modelo(s === 0 ? 'sillaBurbuja' : 'sillaBurbujaRosa', { escala: 1 }); silla.position.set(0, 0, z); silla.rotation.y = s === 0 ? Math.PI : 0; g.add(silla);
      /* dónde se sienta (en el mundo) y para dónde mira */
      const p = new THREE.Vector3(0, 0.38, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), M.rot).add(new THREE.Vector3(M.x, M.y, M.z));
      const rumbo = M.rot + rot;
      /* la silla choca (se la cruzaba); mientras uno está sentado ahí, su sólido se apaga (si no, lo empuja afuera) */
      const solido = mundo.cilindro(p.x, p.z, 0.4, M.y - 1, M.y + 0.8);
      const it = mundo.interactivo({ id: `mesa${i}.${s}`, accion: 'mesa', mesa: i, silla: s, pos: new THREE.Vector3(p.x, M.y, p.z), radio: 1.25, texto: null, juego: M.juego });
      return { p, rumbo, it, ocupa: null, solido };
    });
    mundo.cilindro(M.x, M.z, 0.8, M.y - 1, M.y + 0.86);
    const Mesa = { ...M, i, g, lienzo, tex, tablero, sillas, S: REGLAS[M.juego].nuevo(1), rival: null, vistas: {}, tJugar: 0, tResolver: 0, sucio: true };
    this.dibujar3D(Mesa);
    return Mesa;
  }
  dibujar3D(M) { dibujarMesa(M.lienzo.getContext('2d'), M.juego, M.S, 256, { yo: this.mia?.i === M.i ? this.mia.silla : 0 }); M.tex.needsUpdate = true; M.sucio = false; }
  /* el texto del cartel de cada silla */
  textoSilla(it) { return t('mesa_sentarse', { n: t('mesa_' + it.juego) }); }
  miAsiento() { return this.mia ? `${this.mia.i}.${this.mia.silla}` : null; }

  /* ------------------------------------------------ sentarse y levantarse */
  sentar(J, i, s) {
    const M = this.lista[i]; if (!M) return;
    if (this.mia) this.levantar(J, true);
    this.mia = { i, silla: s };
    const S = M.sillas[s]; S.solido.fantasma = true; J.sentarseEn(S.p.clone(), S.rumbo);
    this.J = J;
    const otro = M.sillas[1 - s].ocupa;
    M.rival = otro ? { id: otro.id, nombre: otro.nombre } : null;
    this.nuevaPartida(M, !otro || s === 0);
    this.abrirPanel(J, M);
    J.sfx('elegir');
  }
  levantar(J, sinAvisar) {
    if (!this.mia) return;
    const M = this.lista[this.mia.i]; M.sillas[this.mia.silla].solido.fantasma = false; this.mia = null; M.rival = null;
    this.cerrarPanel();
    if (!sinAvisar) J.sfx('pop');
    this.dibujar3D(M);
  }
  nuevaPartida(M, yoMando, semilla) {
    const sem = semilla ?? ((Math.random() * 1e9) | 0);
    M.S = REGLAS[M.juego].nuevo(sem); M.vistas = {}; M.tJugar = 0.9; M.sel = null; M.sucio = true;
    if (M.rival && yoMando && this.J) this.J.red.accion({ type: 'mesa', m: M.i, op: 'nueva', sem, a: M.rival.id });
    this.pintarPanel();
  }
  /* quién soy yo en esta partida (0 o 1): la silla */
  soy(M) { return this.mia && this.mia.i === M.i ? this.mia.silla : -1; }
  jugarMia(M, j) {
    const R = REGLAS[M.juego], yo = this.soy(M); if (yo < 0) return;
    const n = M.S.n;
    M.S = R.jugar(M.S, j); M.sucio = true; M.tResolver = 0;
    this.anotar(M, j);
    if (M.rival) this.J.red.accion({ type: 'mesa', m: M.i, op: 'jugada', j, n, a: M.rival.id });
    this.J.sfx(M.juego === 'memo' ? 'gota' : 'elegir', { k: 3 });
    this.revisarFin(M); this.pintarPanel();
  }
  anotar(M, j) { if (M.juego === 'memo' && typeof j === 'number') M.vistas[j] = M.S.c[j]; }
  revisarFin(M) {
    const g = REGLAS[M.juego].ganador(M.S); if (!g || M.fin === M.S.n) return;
    M.fin = M.S.n; const yo = this.soy(M);
    if (yo < 0) return;
    if (g.g === 'empate') { this.J.avisar(t('mesa_empate'), 'azul'); this.J.sfx('aviso'); }
    else if (g.g === yo) { this.J.avisar('🏆 ' + t('mesa_ganaste'), 'bien'); this.J.sfx('restaura'); this.J.festejo?.(); }
    else { this.J.avisar(t('mesa_perdiste'), 'azul'); this.J.sfx('pop'); }
  }

  /* ------------------------------------------------ la red */
  recibir(a, remotoNombre) {
    const M = this.lista[a.m]; if (!M || !this.mia || this.mia.i !== a.m || (a.a && a.a !== this.J?.id)) return;
    if (!M.rival || M.rival.id !== a.id) return;
    const R = REGLAS[M.juego];
    if (a.op === 'nueva' && Number.isFinite(a.sem)) { M.S = R.nuevo(a.sem); M.vistas = {}; M.fin = null; M.sucio = true; this.pintarPanel(); }
    else if (a.op === 'jugada') {
      if (a.n !== M.S.n) { this.J.red.accion({ type: 'mesa', m: M.i, op: 'pide', a: a.id }); return; }
      /* se valida contra las jugadas posibles (lo que llega de la red se revisa) */
      const J = M.juego === 'ppt' ? (M.S.e[1 - this.soy(M)] == null ? [0, 1, 2] : []) : R.jugadas(M.S);
      let j = a.j;
      if (M.juego === 'damas') j = J.find((q) => q.de === a.j?.de && JSON.stringify(q.ruta) === JSON.stringify(a.j?.ruta));
      else if (M.juego === 'ppt') j = J.includes(a.j?.e) && a.j?.q === 1 - this.soy(M) ? { q: a.j.q, e: a.j.e } : undefined;
      else if (!J.includes(j)) j = undefined;
      if (j === undefined) return;
      M.S = R.jugar(M.S, j); this.anotar(M, j); M.sucio = true; M.tResolver = 0; this.J.sfx('elegir');
      this.revisarFin(M); this.pintarPanel();
    } else if (a.op === 'pide' && this.soy(M) === 0) this.J.red.accion({ type: 'mesa', m: M.i, op: 'estado', S: M.S, a: a.id });
    else if (a.op === 'estado' && this.soy(M) === 1 && a.S && typeof a.S === 'object') { M.S = a.S; M.sucio = true; this.pintarPanel(); }
  }

  /* ------------------------------------------------ cada cuadro */
  actualizar(dt, J, remotos) {
    this.J = J;
    /* quién ocupa cada silla (lo dice el estado de cada uno) */
    for (const M of this.lista) for (const S of M.sillas) S.ocupa = null;
    for (const r of remotos.m.values()) {
      const m = /^(\d+)\.([01])$/.exec(r.mesa || ''); if (!m) continue;
      const M = this.lista[+m[1]]; if (!M) continue;
      const S = M.sillas[+m[2]];
      if (this.mia && this.mia.i === M.i && this.mia.silla === +m[2]) {
        /* los dos en la misma silla: se queda el de id más chico; el otro pasa a la otra (o se levanta) */
        if (r.id < J.id) { const libre = !M.sillas[1 - this.mia.silla].ocupa; if (libre) this.sentar(J, M.i, 1 - this.mia.silla); else { this.levantar(J); J.levantarse?.(); } }
        continue;
      }
      S.ocupa = { id: r.id, nombre: r.name };
    }
    for (const M of this.lista) for (const S of M.sillas) S.it.activo = !S.ocupa && !(this.mia && this.mia.i === M.i);
    /* se levantó caminando */
    if (this.mia && !J.sentado) this.levantar(J);
    if (this.mia) {
      const M = this.lista[this.mia.i], otro = M.sillas[1 - this.mia.silla].ocupa;
      /* llegó alguien a jugar, o se fue el que estaba */
      if (otro && (!M.rival || M.rival.id !== otro.id)) { M.rival = { id: otro.id, nombre: otro.nombre }; J.avisar('🎲 ' + t('mesa_llego', { n: otro.nombre }), 'bien'); this.nuevaPartida(M, this.mia.silla === 0); }
      else if (!otro && M.rival) { J.avisar(t('mesa_se_fue', { n: M.rival.nombre }), 'azul'); M.rival = null; this.pintarPanel(); }
      /* el memotest: las dos cartas abiertas se dan vuelta solas */
      if (M.juego === 'memo' && M.S.abiertas.length === 2) { M.tResolver += dt; if (M.tResolver > 0.9) { M.S = REGLAS.memo.resolver(M.S); M.sucio = true; this.revisarFin(M); this.pintarPanel(); } }
      /* la compu juega (con un ratito de pensar) */
      const yo = this.mia.silla, R = REGLAS[M.juego];
      if (!M.rival && !R.ganador(M.S)) {
        const leToca = M.juego === 'ppt' ? M.S.e[yo] != null && M.S.e[1 - yo] == null : M.S.turno === 1 - yo && !(M.juego === 'memo' && M.S.abiertas.length === 2);
        if (leToca) {
          M.tJugar -= dt;
          if (M.tJugar <= 0) {
            M.tJugar = 0.7 + this.r() * 0.6;
            const j = R.compu(M.S, this.r, M.vistas);
            M.S = R.jugar(M.S, M.juego === 'ppt' ? { q: 1 - yo, e: j } : j); this.anotar(M, j); M.sucio = true; M.tResolver = 0;
            J.sfx('elegir'); this.revisarFin(M); this.pintarPanel();
          }
        } else M.tJugar = Math.max(M.tJugar, 0.6);
      }
    }
    for (const M of this.lista) if (M.sucio) this.dibujar3D(M);
  }

  /* ------------------------------------------------ el panel de vidrio */
  abrirPanel(J, M) {
    this.cerrarPanel();
    const hud = document.querySelector('.hud'); if (!hud) return;
    const p = document.createElement('div'); p.className = 'panel-mesa';
    p.innerHTML = `<div class="pm-cab"><b></b><small></small></div><canvas></canvas><div class="pm-estado"></div><div class="pm-pie"><button class="boton chico" data-a="otra"></button><button class="boton chico primario" data-a="levantarse"></button></div>`;
    hud.appendChild(p); this.panel = p;
    document.documentElement.classList.add('en-mesa');   // (en el celu se esconden los botones de la derecha: ahí va el tablero)
    const cv = p.querySelector('canvas'); this.cv = cv;
    p.querySelector('[data-a=otra]').textContent = t('mesa_otra');
    p.querySelector('[data-a=levantarse]').textContent = t('mesa_levantarse');
    p.querySelector('[data-a=otra]').onclick = (e) => { e.stopPropagation(); const M2 = this.lista[this.mia?.i]; if (M2) { M2.fin = null; this.nuevaPartida(M2, true); J.sfx('entra'); } };
    p.querySelector('[data-a=levantarse]').onclick = (e) => { e.stopPropagation(); this.levantar(J); J.levantarse?.(); };
    const aUV = (e) => { const r = cv.getBoundingClientRect(); /* (con el celu parado todo va girado: se mide en el lienzo sin girar) */ const x = e.offsetX ?? (e.clientX - r.left), y = e.offsetY ?? (e.clientY - r.top); return [x / cv.clientWidth, y / cv.clientHeight]; };
    cv.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); const [u, v] = aUV(e); this.toque(u, v); });
    cv.addEventListener('pointermove', (e) => { const M2 = this.lista[this.mia?.i]; if (!M2) return; const [u, v] = aUV(e); const h = tocar(M2.juego, M2.S, u, v, { yo: this.mia.silla }); if (h !== this.hover) { this.hover = h; this.pintarPanel(); } });
    this.pintarPanel();
  }
  cerrarPanel() { if (this.panel) { this.panel.remove(); this.panel = null; } document.documentElement.classList.remove('en-mesa'); }
  toque(u, v) {
    const M = this.lista[this.mia?.i]; if (!M) return;
    const R = REGLAS[M.juego], yo = this.mia.silla, S = M.S;
    if (R.ganador(S)) return;
    const h = tocar(M.juego, S, u, v, { yo });
    if (h == null) return;
    if (M.juego === 'ppt') { if (S.e[yo] == null) this.jugarMia(M, { q: yo, e: h }); return; }
    if (S.turno !== yo) return;
    if (M.juego === 'memo' && S.abiertas.length === 2) { M.S = R.resolver(S); if (M.S.turno !== yo) { M.sucio = true; this.pintarPanel(); return; } }
    if (M.juego === 'damas') {
      const J = R.jugadas(M.S);
      if (M.sel != null) {
        const opc = J.filter((q) => q.de === M.sel && q.ruta[q.ruta.length - 1] === h).sort((a, b) => b.come.length - a.come.length);
        if (opc.length) { M.sel = null; this.jugarMia(M, opc[0]); return; }
      }
      if (J.some((q) => q.de === h)) { M.sel = h; this.J.sfx('letra', { f: 1200 }); }
      else if (M.S.b[h] && REGLAS.damas.de(M.S.b[h]) === yo && J.length && J[0].come.length) this.J.avisar(t('mesa_come'), 'azul');
      else M.sel = null;
      this.pintarPanel(); return;
    }
    if (R.jugadas(M.S).includes(h)) this.jugarMia(M, h);
  }
  pintarPanel() {
    const M = this.lista[this.mia?.i]; if (!this.panel || !M) return;
    const cv = this.cv, lado = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1)) || 360;
    if (cv.width !== lado) { cv.width = cv.height = lado; }
    const yo = this.mia.silla, R = REGLAS[M.juego];
    const destinos = M.juego === 'damas' && M.sel != null ? R.jugadas(M.S).filter((q) => q.de === M.sel).map((q) => q.ruta[q.ruta.length - 1]) : [];
    dibujarMesa(cv.getContext('2d'), M.juego, M.S, lado, { sel: M.sel, destinos, yo, hover: this.hover });
    const rival = M.rival ? M.rival.nombre : t('mesa_compu');
    this.panel.querySelector('.pm-cab b').textContent = t('mesa_' + M.juego);
    this.panel.querySelector('.pm-cab small').textContent = t('mesa_contra', { n: rival });
    const g = R.ganador(M.S), est = this.panel.querySelector('.pm-estado');
    let txt;
    if (g) txt = g.g === 'empate' ? t('mesa_empate') : g.g === yo ? t('mesa_ganaste') : t('mesa_gano', { n: rival });
    else if (M.juego === 'ppt') txt = M.S.e[yo] == null ? `${t('mesa_ronda', { n: M.S.ronda })} · ${t('mesa_elegi')}` : t('mesa_esperando', { n: rival });
    else txt = M.S.turno === yo ? t('mesa_tu_turno') : t('mesa_turno_de', { n: rival });
    if (M.juego === 'memo') txt += ` · ${t('mesa_pares')} ${R.resolver(M.S).puntos[yo]}–${R.resolver(M.S).puntos[1 - yo]}`;
    est.textContent = txt;
    est.classList.toggle('mio', !g && (M.juego === 'ppt' ? M.S.e[yo] == null : M.S.turno === yo));
  }
}
