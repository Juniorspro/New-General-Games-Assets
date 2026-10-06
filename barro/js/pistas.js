/* ============================================================================
   barro/js/pistas.js — las pistas: de una lista de tramos (rectas, dobles,
   mesas, olas, escalones…) sale la polilínea del suelo, alisada, y la ficha de
   cada salto (dónde está el labio, dónde se cae y a qué velocidad conviene
   llegar), que usan los rivales. Pura: corre en Node.
   ========================================================================== */
import { crearSuelo, altoEn, G } from './fisica.js';

export const DX = 0.2;
const RAD = Math.PI / 180;

/* azar con semilla (las pistas del Jam del día y los adornos) */
export function azar(semilla) {
  let s = semilla >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* ---------- el constructor: una "lapicera" que va agregando puntos ---------- */
function lapicera() {
  const P = [[0, 0]];
  const saltos = [], zonas = [];
  const L = {
    get x() { return P[P.length - 1][0]; },
    get y() { return P[P.length - 1][1]; },
    a(dx, dy) { P.push([L.x + dx, L.y + dy]); return L; },
    curva(largo, alto, forma, pasos = 24) {
      const x0 = L.x, y0 = L.y;
      for (let i = 1; i <= pasos; i++) { const t = i / pasos; P.push([x0 + largo * t, y0 + alto * forma(t)]); }
      return L;
    },
    P, saltos, zonas,
  };
  return L;
}

/* el salto de siempre: rampa, labio, hueco y bajada para caer */
function salto(L, { alto = 2, hueco = 7, angS = 33, angA = 24, mesa = false, sube = 0, nombre = 'doble' }) {
  const x0 = L.x, y0 = L.y;
  const cara = alto / Math.tan(angS * RAD);
  L.a(cara * 0.25, alto * 0.12).a(cara * 0.75, alto * 0.88);   // la cara (algo curva abajo)
  const labioX = L.x, labioY = L.y;
  L.a(0.35, 0.02);
  let aterrIni;
  if (mesa) {
    L.a(hueco, sube);
    aterrIni = L.x - hueco * 0.35;
  } else {
    const atras = alto / Math.tan(58 * RAD);
    L.a(atras, -alto);
    L.a(hueco, 0);
    const alto2 = alto + sube;
    L.a(alto2 / Math.tan(46 * RAD), alto2);
    L.a(0.5, 0);
    aterrIni = L.x;
  }
  const bajada = (alto + sube) / Math.tan(angA * RAD);
  L.a(bajada * 0.85, -(alto + sube) * 0.9).a(bajada * 0.3, -(alto + sube) * 0.1);
  const aterrFin = L.x - bajada * 0.15;
  L.saltos.push({ tipo: nombre, xIni: x0 - 30, xLabio: labioX, yLabio: labioY, ang: angS * RAD, aterrIni, aterrFin, yBase: y0, mesa });
}

/* los tramos */
const TRAMOS = {
  recta: (L, largo = 20, pend = 0) => L.a(largo, largo * pend),
  loma: (L, largo = 30, alto = 3) => L.curva(largo, alto, (t) => Math.sin(Math.PI * t) ** 2 * (alto > 0 ? 1 : 1)),
  subida: (L, largo = 25, alto = 4) => L.curva(largo, alto, (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)),
  bajada: (L, largo = 25, alto = 4) => L.curva(largo, -alto, (t) => 0.5 - 0.5 * Math.cos(Math.PI * t)),
  olas: (L, n = 6, alto = 0.55, paso = 3.2) => {
    const x0 = L.x, y0 = L.y;
    for (let i = 1; i <= n * 12; i++) { const t = i / 12; L.P.push([x0 + t * paso, y0 + alto * Math.sin(Math.PI * (t % 1)) ** 1.6]); }
    L.zonas.push({ tipo: 'olas', xIni: x0, xFin: L.x });
  },
  doble: (L, o = {}) => salto(L, { alto: 2.3, hueco: 9, ...o, nombre: 'doble' }),
  triple: (L, o = {}) => salto(L, { alto: 2.8, hueco: 15, angS: 35, angA: 25, ...o, nombre: 'triple' }),
  mesa: (L, o = {}) => salto(L, { alto: 1.8, hueco: 9, angS: 28, angA: 22, mesa: true, ...o, nombre: 'mesa' }),
  escalon: (L, o = {}) => salto(L, { alto: 1.6, hueco: 5, angS: 34, angA: 18, sube: 1.6, ...o, nombre: 'escalon' }),
  bajon: (L, { alto = 3 } = {}) => {
    const x0 = L.x;
    L.a(4, 0.6).a(0.4, 0.05);
    const labioX = L.x, labioY = L.y;
    const bajada = (alto + 0.65) / Math.tan(24 * RAD);
    L.a(bajada * 0.85, -(alto + 0.65) * 0.9).a(bajada * 0.3, -(alto + 0.65) * 0.1);
    L.saltos.push({ tipo: 'bajon', xIni: x0 - 20, xLabio: labioX, yLabio: labioY, ang: Math.atan2(0.6, 4), aterrIni: labioX + 2, aterrFin: L.x - bajada * 0.2, yBase: L.y, mesa: true });
  },
  ritmo: (L, n = 3) => { for (let i = 0; i < n; i++) { salto(L, { alto: 1.15, hueco: 3.2, angS: 30, angA: 24, nombre: 'ritmo' }); L.a(2.5, 0); } },
  barro: (L, largo = 14) => { L.zonas.push({ tipo: 'barro', xIni: L.x, xFin: L.x + largo }); L.a(largo, 0); },
};

/* ---------- construir una pista ---------- */
export function construir(def) {
  const L = lapicera();
  L.a(30, 0);                                  // detrás de la largada
  const xLargada = 22;
  for (const [tipo, ...args] of def.tramos) {
    const f = TRAMOS[tipo];
    if (!f) throw new Error('tramo desconocido: ' + tipo);
    f(L, ...args);
    L.a(def.respiro ?? 11, 0);                  // un respiro entre cosa y cosa
  }
  const xMeta = L.x + 10;
  L.a(70, 0);
  // muestrear y alisar
  const n = Math.ceil(L.x / DX) + 1;
  const h = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const x = i * DX;
    while (j < L.P.length - 2 && L.P[j + 1][0] < x) j++;
    const [ax, ay] = L.P[j], [bx, by] = L.P[j + 1];
    const t = bx > ax ? Math.min(1, Math.max(0, (x - ax) / (bx - ax))) : 0;
    h[i] = ay + (by - ay) * t;
  }
  for (let pasada = 0; pasada < 3; pasada++) {
    const c = Float64Array.from(h);
    for (let i = 1; i < n - 1; i++) h[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4;
  }
  const S = crearSuelo(0, DX, h);
  S.lodo = new Uint8Array(n);
  for (const z of L.zonas) if (z.tipo === 'barro') for (let i = Math.floor(z.xIni / DX); i < z.xFin / DX && i < n; i++) S.lodo[i] = 1;
  const saltos = L.saltos.map((s) => ({ ...s, ...velocidades(S, s) }));
  return { id: def.id, mundo: def.mundo, nombre: def.nombre, suelo: S, saltos, zonas: L.zonas, xLargada, xMeta, largo: L.x, semilla: def.semilla || 1 };
}

/* a qué velocidad hay que salir del labio para caer en la bajada (tiro oblicuo
   del centro de masa, que va 0,78 m sobre las ruedas) */
function velocidades(S, s) {
  const caeEn = (v) => {
    const vx = v * Math.cos(s.ang), vy = v * Math.sin(s.ang);
    let x = s.xLabio, y = s.yLabio, t = 0;
    while (t < 4) {
      t += 0.01;
      x = s.xLabio + vx * t; y = s.yLabio + vy * t - 0.5 * G * t * t;
      if (vy - G * t < 0 && y <= altoEn(S, x) + 0.02) return x;
    }
    return x;
  };
  const ideal = s.aterrIni + (s.aterrFin - s.aterrIni) * 0.35;
  let vMin = null, vMax = null, vIdeal = 8, mejor = Infinity;
  for (let v = 3; v <= 34; v += 0.25) {
    const x = caeEn(v);
    if (vMin === null && x >= s.aterrIni - 0.4) vMin = v;
    if (x <= s.aterrFin + 1.0) vMax = v;
    if (Math.abs(x - ideal) < mejor) { mejor = Math.abs(x - ideal); vIdeal = v; }
  }
  if (s.mesa) vMin = 0;
  return { vMin: vMin ?? 34, vMax: vMax ?? 34, vIdeal };
}

/* ---------- el campeonato: 4 sedes × 5 pistas ---------- */
export const MUNDOS = ['bosque', 'canon', 'selva', 'noche'];

const P = (id, mundo, tramos, extra = {}) => ({ id, mundo, tramos, ...extra });
export const PISTAS = [
  // BOSQUE: la del video. Lomas largas, dobles y una mesa.
  P('b1', 'bosque', [['recta', 10], ['mesa'], ['loma', 26, 2.5], ['doble'], ['olas', 5], ['doble', { hueco: 8 }], ['subida', 22, 3], ['mesa', { alto: 2.2 }], ['bajada', 26, 3], ['doble', { alto: 2.3, hueco: 8.5 }]]),
  P('b2', 'bosque', [['recta', 8], ['doble'], ['ritmo', 3], ['loma', 30, 3.5], ['triple'], ['olas', 6], ['mesa'], ['subida', 20, 3], ['escalon'], ['bajon', { alto: 3.5 }], ['doble', { hueco: 9 }]]),
  P('b3', 'bosque', [['recta', 8], ['mesa', { alto: 2.4, hueco: 11 }], ['doble', { hueco: 9 }], ['loma', 34, 4], ['ritmo', 4], ['triple', { hueco: 14 }], ['olas', 7], ['subida', 26, 4], ['doble'], ['bajon', { alto: 4 }], ['mesa']]),
  P('b4', 'bosque', [['recta', 8], ['doble'], ['olas', 8, 0.6], ['escalon'], ['bajon', { alto: 3.2 }], ['triple'], ['loma', 28, 3], ['ritmo', 4], ['doble', { alto: 2.5, hueco: 10 }], ['mesa', { alto: 2.6, hueco: 12 }]]),
  P('b5', 'bosque', [['recta', 8], ['triple'], ['ritmo', 3], ['subida', 24, 4], ['doble', { hueco: 10 }], ['bajon', { alto: 4.5 }], ['olas', 8, 0.65], ['triple', { hueco: 15, alto: 3 }], ['loma', 30, 4], ['escalon'], ['doble', { alto: 2.6, hueco: 11 }], ['mesa', { alto: 2.8, hueco: 13 }]]),
  // CAÑÓN: cerros colorados, saltos más largos y bajones.
  P('c1', 'canon', [['recta', 8], ['doble', { hueco: 9 }], ['bajon', { alto: 3.5 }], ['mesa', { hueco: 12 }], ['olas', 6], ['triple'], ['subida', 22, 3.5], ['doble'], ['bajada', 24, 3.5], ['mesa']]),
  P('c2', 'canon', [['recta', 8], ['triple'], ['loma', 30, 4], ['doble', { alto: 2.6, hueco: 10 }], ['ritmo', 4], ['escalon', { sube: 2 }], ['bajon', { alto: 4.5 }], ['olas', 7], ['doble', { hueco: 10 }]]),
  P('c3', 'canon', [['recta', 8], ['mesa', { alto: 2.8, hueco: 14 }], ['triple', { hueco: 15 }], ['olas', 8], ['subida', 28, 5], ['doble', { alto: 2.8, hueco: 11 }], ['bajon', { alto: 5 }], ['ritmo', 4], ['triple']]),
  P('c4', 'canon', [['recta', 8], ['doble'], ['doble', { hueco: 10 }], ['escalon'], ['escalon', { sube: 1.8 }], ['bajon', { alto: 5 }], ['olas', 8, 0.7], ['triple', { hueco: 16, alto: 3.1 }], ['mesa', { alto: 3, hueco: 14 }]]),
  P('c5', 'canon', [['recta', 8], ['triple', { hueco: 15 }], ['ritmo', 5], ['loma', 32, 5], ['doble', { alto: 3, hueco: 12 }], ['bajon', { alto: 5.5 }], ['olas', 9, 0.7], ['escalon', { sube: 2.2 }], ['triple', { hueco: 17, alto: 3.2 }], ['mesa', { alto: 3, hueco: 15 }]]),
  // SELVA: barro que frena, olas y ritmo.
  P('s1', 'selva', [['recta', 8], ['doble'], ['barro', 12], ['ritmo', 3], ['olas', 7], ['mesa'], ['barro', 10], ['loma', 26, 3], ['doble', { hueco: 8.5 }]]),
  P('s2', 'selva', [['recta', 8], ['ritmo', 4], ['barro', 14], ['triple'], ['olas', 8], ['subida', 22, 3], ['doble'], ['barro', 12], ['bajon', { alto: 3.5 }], ['mesa', { hueco: 11 }]]),
  P('s3', 'selva', [['recta', 8], ['mesa', { hueco: 12 }], ['barro', 16], ['doble', { hueco: 9 }], ['ritmo', 5], ['olas', 9], ['triple'], ['barro', 12], ['escalon'], ['doble', { alto: 2.6, hueco: 10 }]]),
  P('s4', 'selva', [['recta', 8], ['triple'], ['olas', 10, 0.6], ['barro', 14], ['ritmo', 4], ['loma', 30, 4], ['doble', { alto: 2.8, hueco: 11 }], ['bajon', { alto: 4.5 }], ['barro', 12], ['triple', { hueco: 15 }]]),
  P('s5', 'selva', [['recta', 8], ['doble', { hueco: 10 }], ['barro', 16], ['ritmo', 5], ['triple', { hueco: 16, alto: 3 }], ['olas', 10, 0.65], ['escalon', { sube: 2 }], ['bajon', { alto: 5 }], ['barro', 14], ['mesa', { alto: 3, hueco: 15 }]]),
  // NOCHE: supercross en el estadio, todo apretado y técnico.
  P('n1', 'noche', [['recta', 8], ['ritmo', 4], ['olas', 8, 0.55, 2.8], ['mesa', { alto: 2.2, hueco: 10 }], ['ritmo', 3], ['triple', { hueco: 13 }]], { respiro: 5 }),
  P('n2', 'noche', [['recta', 8], ['triple'], ['olas', 10, 0.6, 2.8], ['ritmo', 5], ['escalon'], ['bajon', { alto: 3 }], ['doble', { hueco: 9 }], ['mesa']], { respiro: 5 }),
  P('n3', 'noche', [['recta', 8], ['ritmo', 6], ['triple', { hueco: 15 }], ['olas', 12, 0.6, 2.8], ['doble', { alto: 2.6, hueco: 10 }], ['escalon', { sube: 2 }], ['bajon', { alto: 4 }], ['ritmo', 4]], { respiro: 5 }),
  P('n4', 'noche', [['recta', 8], ['triple', { hueco: 16, alto: 3 }], ['ritmo', 5], ['olas', 12, 0.65, 2.8], ['mesa', { alto: 3, hueco: 14 }], ['escalon'], ['escalon', { sube: 1.8 }], ['bajon', { alto: 5 }], ['triple']], { respiro: 5 }),
  P('n5', 'noche', [['recta', 8], ['ritmo', 6], ['triple', { hueco: 17, alto: 3.2 }], ['olas', 14, 0.7, 2.8], ['doble', { alto: 3, hueco: 12 }], ['ritmo', 5], ['escalon', { sube: 2.2 }], ['bajon', { alto: 5.5 }], ['triple', { hueco: 17, alto: 3.2 }]], { respiro: 5 }),
];
PISTAS.forEach((p, i) => { p.n = i; p.semilla = 1000 + i * 77; p.sede = Math.floor(i / 5); p.nro = (i % 5) + 1; });
/* cada pista sigue con la segunda mitad de otra de su sede (así duran ~1 minuto) */
PISTAS.forEach((p, i) => {
  const otra = PISTAS[p.sede * 5 + ((p.nro + 1) % 5)];
  p.tramos = [...p.tramos, ['loma', 30, 2.5], ...otra.tramos.slice(1, 1 + Math.ceil((otra.tramos.length - 1) * (0.2 + 0.1 * p.nro)))];
});

/* ---------- el Jam del día: una pista con semilla de la fecha ---------- */
export function numeroJam(fecha = new Date()) {
  const dias = Math.floor((Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) - Date.UTC(2024, 0, 1)) / 86400000);
  return dias;
}
export function pistaJam(n) {
  const r = azar(n * 7919 + 13);
  const mundo = MUNDOS[n % 4];
  const menu = [
    () => ['doble', { alto: 1.9 + r() * 0.9, hueco: 7 + r() * 4 }],
    () => ['triple', { hueco: 12 + r() * 4, alto: 2.6 + r() * 0.5 }],
    () => ['mesa', { alto: 1.8 + r() * 1.0, hueco: 9 + r() * 5 }],
    () => ['ritmo', 3 + Math.floor(r() * 3)],
    () => ['olas', 5 + Math.floor(r() * 6), 0.5 + r() * 0.2],
    () => ['loma', 24 + r() * 10, 2.5 + r() * 2],
    () => ['escalon'],
    () => ['bajon', { alto: 3 + r() * 2 }],
  ];
  if (mundo === 'selva') menu.push(() => ['barro', 10 + r() * 6]);
  const tramos = [['recta', 8]];
  for (let i = 0; i < 10; i++) tramos.push(menu[Math.floor(r() * menu.length)]());
  return { id: 'jam' + n, mundo, tramos, semilla: n * 31 + 7, jam: n, respiro: mundo === 'noche' ? 5 : 7 };
}
