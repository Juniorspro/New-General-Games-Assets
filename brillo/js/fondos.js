/* brillo/js/fondos.js — los paisajes de atrás (y los de adelante), en capas.
   Cada capa se mueve a su velocidad cuando se mueve la cámara (parallax): el
   cielo no se mueve, las nubes casi nada, las lomas lejanas poco, las
   cercanas más, y el pasto de adelante más que el juego. Las capas se pintan
   una vez al cargar, en tiras que se repiten sin costura (las lomas salen de
   sumas de senos con períodos que entran justo en la tira), y en cada cuadro
   solo se copian. Lo que se mueve solo (molinos, nubes, burbujas, peces) se
   dibuja cada cuadro. */
import { Lienzo, lienzo2d, azar, mezclar, RAMPA, pintura } from './pixel.js';

const TAU = Math.PI * 2;
/* un perfil que se repite cada `periodo` píxeles: suma de senos con frecuencias enteras */
function perfil(periodo, armonicos, al) {
  const ondas = armonicos.map(([k, a]) => ({ k, a, f: al() * TAU }));
  return (x) => ondas.reduce((s, o) => s + Math.sin(x / periodo * TAU * o.k + o.f) * o.a, 0);
}

/* una tira de lomas: relleno con degradé, filo de brillo en la cresta, cosas encima */
function tiraLomas(o) {
  const { ancho, alto, base, amp, armonicos, colores, filo, al } = o;
  const [c, g] = lienzo2d(ancho, alto);
  const alt = perfil(ancho, armonicos, al);
  const tope = new Int16Array(ancho);
  for (let x = 0; x < ancho; x++) tope[x] = Math.round(base - alt(x) * amp);
  /* el cuerpo: por columnas, degradé de arriba (claro) hacia abajo (más oscuro y más azul, lejos) */
  const grad = g.createLinearGradient(0, base - amp, 0, alto);
  colores.forEach((col, i) => grad.addColorStop(i / (colores.length - 1), col));
  g.fillStyle = grad;
  for (let x = 0; x < ancho; x++) g.fillRect(x, tope[x], 1, alto - tope[x]);
  /* el filo de brillo en la cresta (más ancho donde la loma mira al sol) */
  if (filo) for (let x = 0; x < ancho; x++) {
    const pend = tope[(x + 1) % ancho] - tope[(x - 1 + ancho) % ancho];
    const w = Math.max(1, Math.round(filo.ancho * (pend >= 0 ? 1 : 0.5)));
    g.fillStyle = filo.color; g.fillRect(x, tope[x], 1, w);
    if (filo.sombra) { g.fillStyle = filo.sombra; g.fillRect(x, tope[x] + w, 1, 1); }
  }
  return { c, tope, ancho, alto };
}

/* nubes de pixel art: bollos de círculos, arriba blanco, abajo celeste, con borde claro */
function nube(al, ancho, alto) {
  const L = new Lienzo(ancho, alto);
  const bollos = [];
  const n = 5 + Math.floor(al() * 4);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = alto * (0.26 + 0.22 * Math.sin(t * Math.PI)) * (0.8 + al() * 0.35);
    bollos.push([ancho * (0.12 + t * 0.76), alto - r - 2 - al() * alto * 0.12, r]);
  }
  const R = RAMPA.blanco;
  for (const [x, y, r] of bollos) L.elipse(x, y, r, r * 0.92, (u, v) => {
    const d = -u * 0.45 - v * 0.9;
    return R[d > 0.55 ? 7 : d > 0.1 ? 6 : d > -0.35 ? 5 : d > -0.7 ? 4 : 3];
  }, R);
  /* la panza plana de abajo */
  for (let x = 0; x < ancho; x++) for (let y = alto - 3; y < alto; y++) if (L.hay(x, y - 1)) L.punto(x, y, R[3], R);
  L.contorno({ color: '#d7ecfb' });
  return L.aCanvas();
}

/* un árbol redondo de vidrio verde (una esfera arriba de un tronco) */
function arbol(al, r) {
  const L = new Lienzo(Math.ceil(r * 2 + 4), Math.ceil(r * 2 + r * 1.2 + 4));
  const cx = L.w / 2, cy = r + 2;
  L.capsula(cx, cy + r * 0.5, cx, L.h - 2, Math.max(1, r * 0.16), pintura.vertical(RAMPA.tierra, 4, 2), RAMPA.tierra);
  L.elipse(cx, cy, r, r * 0.95, pintura.aero(RAMPA.verde, { bajo: 1, alto: 6, gorra: 0.35, punto: 0.05 }), RAMPA.verde);
  L.contorno({ tono: 0 });
  return L.aCanvas();
}

/* el sol: resplandor + estrella de rayos finos en pixel art */
function sol() {
  const T = 200;
  const [c, g] = lienzo2d(T, T);
  const m = T / 2;
  let gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.1, 'rgba(255,255,250,0.95)'); gr.addColorStop(0.22, 'rgba(255,252,225,0.45)');
  gr.addColorStop(0.5, 'rgba(230,245,255,0.14)'); gr.addColorStop(1, 'rgba(210,235,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, T, T);
  /* los rayos: líneas de un píxel que se apagan hacia afuera */
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + 0.12, largo = i % 2 ? m * 0.55 : m * 0.95;
    for (let k = 6; k < largo; k++) {
      const x = Math.round(m + Math.cos(a) * k), y = Math.round(m + Math.sin(a) * k);
      g.fillStyle = `rgba(255,255,255,${(1 - k / largo) * 0.8})`; g.fillRect(x, y, 1, 1);
    }
  }
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(m, m, 9, 0, TAU); g.fill();
  return c;
}

/* un molino de viento: torre blanca, las aspas se dibujan girando */
function dibujarMolino(g, x, y, alto, ang, col) {
  g.fillStyle = col.torre;
  for (let i = 0; i < alto; i++) { const w = 1 + (i > alto * 0.5 ? 1 : 0); g.fillRect(Math.round(x - w / 2), Math.round(y - alto + i), w, 1); }
  g.fillStyle = col.aspa;
  const cx = x, cy = y - alto, L = alto * 0.62;
  for (let k = 0; k < 3; k++) {
    const a = ang + k * TAU / 3;
    for (let i = 1; i < L; i++) g.fillRect(Math.round(cx + Math.cos(a) * i), Math.round(cy + Math.sin(a) * i), 1, 1);
  }
  g.fillStyle = col.centro; g.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
}

/* una torre de vidrio: cuerpo con degradé, pisos, una franja de reflejo y, a veces, pasto arriba */
function torre(al, w, h, R, o = {}) {
  const [c, g] = lienzo2d(w + 2, h + 14);
  const top = 14, redonda = o.redonda ?? al() < 0.4;
  const rr = redonda ? Math.floor(w / 2) : 0;
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, R[o.claro ?? 5]); gr.addColorStop(0.45, R[(o.claro ?? 5) - 1]); gr.addColorStop(1, R[(o.claro ?? 5) - 2]);
  g.fillStyle = gr;
  for (let y = 0; y < h; y++) {
    let x0 = 0, x1 = w;
    if (redonda && y < rr) { const d = Math.sqrt(Math.max(0, rr * rr - (rr - y) ** 2)); x0 = Math.round(w / 2 - d); x1 = Math.round(w / 2 + d); }
    g.fillRect(x0 + 1, top + y, x1 - x0, 1);
  }
  /* los pisos y los parantes */
  g.fillStyle = o.lineas || 'rgba(255,255,255,0.35)';
  for (let y = (redonda ? rr : 0) + 4; y < h; y += o.piso || 6) g.fillRect(1, top + y, w, 1);
  if (!o.lejos) { g.fillStyle = 'rgba(20,60,120,0.18)'; for (let x = 6; x < w - 2; x += 8) g.fillRect(x + 1, top + rr, 1, h - rr); }
  /* el reflejo: una franja clara en diagonal */
  g.fillStyle = 'rgba(255,255,255,0.45)';
  const f0 = Math.floor(w * (0.15 + al() * 0.2));
  for (let y = rr; y < h; y++) { const x = f0 + Math.floor((y - rr) * 0.12) % Math.max(1, w - f0 - 3); g.fillRect(x + 1, top + y, 2, 1); }
  /* la terraza con pasto y arbolitos */
  if (o.pasto && !redonda) {
    g.fillStyle = '#4bc92a'; g.fillRect(1, top - 2, w, 3); g.fillStyle = '#b8ff8a'; g.fillRect(1, top - 2, w, 1);
    for (let i = 0; i < w / 10; i++) { const x = 3 + Math.floor(al() * (w - 6)), r = 2 + Math.floor(al() * 3); g.fillStyle = '#3bbd33'; g.beginPath(); g.arc(x + 1, top - 2 - r, r, 0, TAU); g.fill(); g.fillStyle = '#a6ee6a'; g.fillRect(x, top - 2 - r * 2 + 1, 2, 1); }
  }
  /* una antena */
  if (o.antena && al() < 0.5) { g.fillStyle = R[6]; g.fillRect(Math.floor(w / 2), 2, 1, top - 2 + rr * 0.3); g.fillStyle = '#ff6a6a'; g.fillRect(Math.floor(w / 2), 1, 1, 1); }
  return { c, top };
}
function tiraTorres(al, ancho, alto, n, R, o) {
  const [c, g] = lienzo2d(ancho, alto);
  for (let i = 0; i < n; i++) {
    const w = o.w0 + Math.floor(al() * o.w1), h = o.h0 + Math.floor(al() * o.h1), T2 = torre(al, w, h, R, o);
    const x = Math.floor(al() * ancho), y = alto - h - T2.top;
    for (const dx of [0, -ancho, ancho]) g.drawImage(T2.c, x + dx, y);
  }
  return c;
}
/* la luna, con su halo */
function luna() {
  const T = 120, [c, g] = lienzo2d(T, T), m = T / 2;
  const gr = g.createRadialGradient(m, m, 0, m, m, m);
  gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.16, 'rgba(250,250,235,0.95)'); gr.addColorStop(0.2, 'rgba(210,235,255,0.35)'); gr.addColorStop(1, 'rgba(160,200,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, T, T);
  g.fillStyle = 'rgba(200,210,220,0.6)'; for (const [x, y, r] of [[-4, -3, 3], [5, 2, 2], [-1, 6, 2]]) { g.beginPath(); g.arc(m + x, m + y, r, 0, TAU); g.fill(); }
  return c;
}
/* un coral de ramitas (hacia arriba, con las puntas redondas) */
function coral(g, al, x, y, largo, col, punta) {
  const rama = (x0, y0, a, L, k) => {
    if (L < 2 || k > 4) { g.fillStyle = punta; g.fillRect(Math.round(x0) - 1, Math.round(y0) - 1, 2, 2); return; }
    for (let i = 0; i < L; i++) { g.fillStyle = col; g.fillRect(Math.round(x0 + Math.cos(a) * i), Math.round(y0 + Math.sin(a) * i), 2, 1); }
    const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
    rama(x1, y1, a - 0.35 - al() * 0.3, L * 0.68, k + 1); rama(x1, y1, a + 0.35 + al() * 0.3, L * 0.68, k + 1);
  };
  rama(x, y, -Math.PI / 2, largo, 0);
}
/* un pececito tropical de vidrio (6 a 10 píxeles), de frente a la derecha */
const PECES = new Map();
function pez(k) {
  if (PECES.has(k)) return PECES.get(k);
  const R = [RAMPA.naranja, RAMPA.amarillo, RAMPA.cian, RAMPA.rosa, RAMPA.azul][k % 5];
  const L = new Lienzo(12, 8);
  L.poligono([[0, 1], [3, 4], [0, 7]], R[3], R);
  L.elipse(7, 4, 4.2, 2.8, pintura.aero(R, { bajo: 2, alto: 6, punto: 0.08 }), R);
  L.punto(9, 3, '#0b1a3c'); L.contorno({ tono: 0 });
  const c = [L.aCanvas(false), L.aCanvas(true)];
  PECES.set(k, c); return c;
}
/* una tira de nubes: el borde de arriba en bollos, blanco arriba y celeste abajo */
function tiraNubes(al, ancho, alto, base, col) {
  const [c, g] = lienzo2d(ancho, alto);
  const alt = perfil(ancho, [[4, 0.5], [9, 0.35], [17, 0.15]], al);
  for (let x = 0; x < ancho; x++) {
    const tope = Math.round(base - Math.abs(alt(x)) * 34);
    const gr = g.createLinearGradient(0, tope, 0, alto);
    g.fillStyle = col[0]; g.fillRect(x, tope, 1, 3);
    g.fillStyle = col[1]; g.fillRect(x, tope + 3, 1, 10);
    g.fillStyle = col[2]; g.fillRect(x, tope + 13, 1, alto - tope - 13);
  }
  return c;
}
/* una isla flotante: pasto arriba, tierra en punta abajo, a veces una cascada */
function isla(al, w) {
  const h = Math.round(w * 0.7), L = new Lienzo(w + 4, h + 20);
  const cx = (w + 4) / 2;
  L.poligono([[2, 6], [w + 2, 6], [cx + w * 0.18, h], [cx - w * 0.1, h + 4]], pintura.vertical(RAMPA.tierra, 5, 1), RAMPA.tierra);
  L.caja(2, 3, w + 2, 9, 3, pintura.vertical(RAMPA.verde, 6, 3), RAMPA.verde);
  L.contorno({ tono: 0 });
  const c = L.aCanvas();
  if (al() < 0.6) { const g = c.getContext('2d'); const x = Math.round(cx + (al() - 0.5) * w * 0.5); g.fillStyle = 'rgba(220,245,255,0.85)'; g.fillRect(x, 8, 2, h + 10); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x, 8, 1, h + 10); }
  return c;
}

/* ============================== los mundos ============================== */
export const MUNDOS_FONDO = {
  /* la Colina Serena: el cielo azul y las lomas verdes de todos los fondos de pantalla */
  colina(semilla = 7) {
    const al = azar(semilla);
    const cielo = [[0, '#1b66d8'], [0.35, '#3d8ef3'], [0.62, '#86c4fb'], [0.8, '#c9e9ff'], [1, '#f2fbff']];
    const nubes = [];
    for (let i = 0; i < 9; i++) { const w = 70 + Math.floor(al() * 110); nubes.push({ c: nube(al, w, Math.round(w * (0.32 + al() * 0.12))), x: al() * 2400, y: 18 + al() * 120, f: 0.05 + al() * 0.12, v: 2 + al() * 5 }); }
    const montes = tiraLomas({ ancho: 1400, alto: 150, base: 110, amp: 42, armonicos: [[2, 0.6], [5, 0.3], [11, 0.1]], colores: ['#7fb3e6', '#9cc6ee', '#c4def5'], filo: { ancho: 1, color: '#d7ebfb' }, al });
    const lejos = tiraLomas({ ancho: 1200, alto: 140, base: 80, amp: 26, armonicos: [[3, 0.55], [7, 0.3], [13, 0.15]], colores: ['#86d06c', '#a4dd8c', '#c9ecb8'], filo: { ancho: 2, color: '#d4f7b4' }, al });
    const medio = tiraLomas({ ancho: 1000, alto: 170, base: 70, amp: 34, armonicos: [[2, 0.7], [5, 0.25], [9, 0.08]], colores: ['#57c93a', '#3aae2e', '#2c8f2a', '#2a7a30'], filo: { ancho: 3, color: '#c3f78e', sombra: '#8ee05e' }, al });
    /* molinos en las crestas lejanas */
    const molinos = [];
    for (let i = 0; i < 7; i++) { const x = Math.floor((i + al() * 0.6) / 7 * lejos.ancho); molinos.push({ x, alto: 22 + Math.floor(al() * 10), fase: al() * TAU, v: 0.6 + al() * 0.5 }); }
    /* árboles de vidrio sobre la loma del medio */
    const [ca, ga] = lienzo2d(medio.ancho, medio.alto);
    ga.drawImage(medio.c, 0, 0);
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(al() * medio.ancho), r = 5 + Math.floor(al() * 6), A = arbol(al, r);
      ga.drawImage(A, Math.round(x - A.width / 2), medio.tope[x] - A.height + 3);
      if (x < 60) ga.drawImage(A, Math.round(x + medio.ancho - A.width / 2), medio.tope[x] - A.height + 3);
      if (x > medio.ancho - 60) ga.drawImage(A, Math.round(x - medio.ancho - A.width / 2), medio.tope[x] - A.height + 3);
    }
    /* florcitas en la loma del medio */
    for (let i = 0; i < 260; i++) { const x = Math.floor(al() * medio.ancho), y = medio.tope[x] + 4 + Math.floor(al() * 40); ga.fillStyle = ['#ffffff', '#ffe46b', '#ff9ccc'][i % 3]; ga.fillRect(x, y, 1, 1); }
    const S = sol();
    return {
      cielo, sol: [0.8, 0.14], nubes, molinos,
      grado: { tinte: [1, 1.01, 1.02], levantar: [0.0, 0.01, 0.02], sat: 1.12, contraste: 1.04 },
      post: { bloom: 0.6, destello: 0.9, rayos: 0.55, umbral: 0.74, velo: 0.16 },
      /* capas: [canvas, factor x, y en pantalla (con la cámara en su lugar), factor y] */
      capas: [
        { c: montes.c, f: 0.06, y: 150, fy: 0.03 },
        { c: lejos.c, f: 0.14, y: 190, fy: 0.06, molinos: true },
        { c: ca, f: 0.3, y: 220, fy: 0.12 },
      ],
      lejosTope: lejos.tope, S,
    };
  },

  /* el Arrecife de Cristal: debajo del agua; la luz baja en haces, corales y cardúmenes */
  arrecife(semilla = 7) {
    const al = azar(semilla + 11);
    const cielo = [[0, '#8ff0f7'], [0.12, '#48c8e8'], [0.42, '#1a8fcf'], [0.75, '#0f62a8'], [1, '#0b4486']];
    const lejos = tiraLomas({ ancho: 1300, alto: 170, base: 120, amp: 30, armonicos: [[3, 0.6], [7, 0.3], [15, 0.1]], colores: ['#2c86bd', '#2574aa', '#1f6397'], filo: { ancho: 1, color: '#58b3de' }, al });
    const medio = tiraLomas({ ancho: 1100, alto: 190, base: 120, amp: 40, armonicos: [[2, 0.6], [6, 0.3], [13, 0.1]], colores: ['#1f7aa0', '#196890', '#14557c', '#10466a'], filo: { ancho: 2, color: '#6fd3e8', sombra: '#3aa9cf' }, al });
    const [cl, gl] = lienzo2d(lejos.ancho, lejos.alto); gl.drawImage(lejos.c, 0, 0);
    for (let i = 0; i < 26; i++) { const x = Math.floor(al() * lejos.ancho); coral(gl, al, x, lejos.tope[x] + 3, 6 + al() * 9, '#3b9ccc', '#7fd0ee'); }
    const [cm, gm] = lienzo2d(medio.ancho, medio.alto); gm.drawImage(medio.c, 0, 0);
    const COR = [['#ff6fae', '#ffd0e6'], ['#ff9f43', '#ffe0a8'], ['#b58cff', '#e6d8ff'], ['#ffe066', '#fff6c8']];
    for (let i = 0; i < 30; i++) { const x = Math.floor(al() * medio.ancho), [a, b] = COR[i % 4]; coral(gm, al, x, medio.tope[x] + 4, 8 + al() * 12, a, b); }
    /* corales cerebro: esferas de vidrio rosas y violetas */
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(al() * medio.ancho), r = 4 + Math.floor(al() * 5), R = [RAMPA.rosa, RAMPA.violeta, RAMPA.naranja][i % 3];
      const L = new Lienzo(r * 2 + 3, r * 2 + 3); L.elipse(r + 1.5, r + 1.5, r, r * 0.8, pintura.aero(R, { bajo: 2, alto: 6 }), R); L.contorno({ tono: 1 });
      gm.drawImage(L.aCanvas(), x - r, medio.tope[x] - r + 2);
    }
    /* algas altas */
    for (let i = 0; i < 22; i++) { const x = Math.floor(al() * medio.ancho), L = 20 + al() * 40; for (let k = 0; k < L; k++) { gm.fillStyle = k % 7 === 0 ? '#7ce8a0' : '#2f9e6a'; gm.fillRect(Math.round(x + Math.sin(k * 0.25 + i) * 2), medio.tope[x] + 3 - k, 2, 1); } }
    const cardumenes = [];
    for (let i = 0; i < 5; i++) { const n = 5 + Math.floor(al() * 6), k = Math.floor(al() * 5); cardumenes.push({ x: al() * 1600, y: 60 + al() * 180, v: 8 + al() * 14, f: 0.1 + al() * 0.3, k, peces: Array.from({ length: n }, () => [al() * 40 - 20, al() * 22 - 11, al() * TAU]) }); }
    const haces = Array.from({ length: 6 }, () => ({ x: al() * 1400, w: 20 + al() * 50, v: 0.2 + al() * 0.4, f: 0.05 + al() * 0.1 }));
    return {
      cielo, sol: [0.5, -0.12], nubes: [], S: null,
      grado: { tinte: [0.96, 1.02, 1.05], levantar: [0.0, 0.02, 0.04], sat: 1.1, contraste: 1.03 },
      post: { bloom: 0.55, destello: 0, rayos: 0.9, umbral: 0.72, velo: 0.12, olas: 0.8, olasDesde: 0 },
      capas: [{ c: cl, f: 0.1, y: 180, fy: 0.05 }, { c: cm, f: 0.3, y: 200, fy: 0.12 }],
      antes(g, cam, t, w, h) {
        /* los haces de luz que bajan de la superficie */
        g.globalCompositeOperation = 'lighter';
        for (const q of haces) {
          const per = 1400, x = ((q.x - cam.x * q.f + Math.sin(t * q.v) * 30) % per + per) % per - 100;
          const gr = g.createLinearGradient(0, 0, 0, h * 0.9); gr.addColorStop(0, 'rgba(180,250,255,0.22)'); gr.addColorStop(1, 'rgba(180,250,255,0)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + q.w, 0); g.lineTo(x + q.w * 0.3 + 80, h); g.lineTo(x - 30 + 80, h); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      },
      despues(g, cam, t, w, h) {
        for (const c of cardumenes) {
          const per = 1600, cx = ((c.x + t * c.v - cam.x * c.f) % per + per) % per - 150, cy = c.y + Math.sin(t * 0.7 + c.x) * 10 - (cam.y) * c.f * 0.2;
          for (const [dx, dy, ph] of c.peces) { const img = pez(c.k)[0]; g.drawImage(img, Math.round(cx + dx + Math.sin(t * 2 + ph) * 3), Math.round(cy + dy + Math.cos(t * 1.7 + ph) * 2)); }
        }
      },
    };
  },

  /* Ciudad Vidrio: torres transparentes, terrazas con pasto y un tren que no hace ruido */
  ciudad(semilla = 7) {
    const al = azar(semilla + 23);
    const cielo = [[0, '#2a7fe0'], [0.45, '#6bb6f7'], [0.78, '#c6e8ff'], [1, '#f0fbff']];
    const nubes = [];
    for (let i = 0; i < 6; i++) { const w = 70 + Math.floor(al() * 90); nubes.push({ c: nube(al, w, Math.round(w * 0.36)), x: al() * 2400, y: 14 + al() * 90, f: 0.04 + al() * 0.08, v: 3 + al() * 5 }); }
    const lejos = tiraTorres(al, 1500, 260, 34, RAMPA.vidrio, { w0: 22, w1: 40, h0: 70, h1: 150, lejos: true, lineas: 'rgba(255,255,255,0.22)', claro: 5, antena: true });
    const medio = tiraTorres(al, 1300, 300, 18, RAMPA.cian, { w0: 34, w1: 46, h0: 90, h1: 150, pasto: true, antena: true, claro: 5 });
    /* el parque de adelante: lomitas con árboles, y las vías del tren */
    const parque = tiraLomas({ ancho: 1000, alto: 120, base: 60, amp: 14, armonicos: [[3, 0.6], [7, 0.4]], colores: ['#57c93a', '#3aae2e', '#2c8f2a'], filo: { ancho: 2, color: '#c3f78e' }, al });
    const [cp, gp] = lienzo2d(parque.ancho, parque.alto); gp.drawImage(parque.c, 0, 0);
    for (let i = 0; i < 12; i++) { const x = Math.floor(al() * parque.ancho), A = arbol(al, 4 + Math.floor(al() * 5)); gp.drawImage(A, Math.round(x - A.width / 2), parque.tope[x] - A.height + 3); }
    const S = sol();
    return {
      cielo, sol: [0.2, 0.12], nubes, S,
      grado: { tinte: [1, 1.01, 1.03], levantar: [0, 0.01, 0.02], sat: 1.1, contraste: 1.05 },
      post: { bloom: 0.5, destello: 0.8, rayos: 0.45, umbral: 0.8, velo: 0.14 },
      capas: [{ c: lejos, f: 0.08, y: 70, fy: 0.03 }, { c: medio, f: 0.2, y: 60, fy: 0.08, tren: true }, { c: cp, f: 0.34, y: 250, fy: 0.12 }],
      tren: { y: 150, largo: 5, v: 60 },
      extra(g, L, x, y, t, cam) {
        if (!L.tren) return;
        /* el monorriel: una viga blanca y un tren de cápsulas de vidrio */
        const vy = y + 150;
        g.fillStyle = '#e8f4ff'; g.fillRect(x, vy, L.c.width, 3); g.fillStyle = '#9fc4e6'; g.fillRect(x, vy + 3, L.c.width, 1);
        for (let px = 0; px < L.c.width; px += 90) { g.fillStyle = '#d4e6f7'; g.fillRect(x + px, vy + 4, 3, 60); }
        const tx = x + ((t * 70) % (L.c.width + 400)) - 200;
        for (let k = 0; k < 5; k++) {
          const cx = tx + k * 30;
          g.fillStyle = '#ffffff'; g.fillRect(cx, vy - 11, 28, 10); g.fillStyle = '#5fb6f0'; g.fillRect(cx + 2, vy - 9, 24, 4); g.fillStyle = '#c9ecff'; g.fillRect(cx + 2, vy - 9, 24, 1);
          if (k === 4) { g.fillStyle = '#ffffff'; g.fillRect(cx + 28, vy - 9, 3, 7); g.fillRect(cx + 31, vy - 7, 2, 4); }
        }
      },
    };
  },

  /* el Cielo Burbuja: nubes, islas que flotan y el arcoíris a medio borrar */
  cielo(semilla = 7) {
    const al = azar(semilla + 37);
    const cielo = [[0, '#0f58c9'], [0.38, '#3b93f2'], [0.72, '#8fcbff'], [1, '#cfe9ff']];
    const nubes = [];
    for (let i = 0; i < 14; i++) { const w = 60 + Math.floor(al() * 150); nubes.push({ c: nube(al, w, Math.round(w * (0.32 + al() * 0.1))), x: al() * 2400, y: 10 + al() * 250, f: 0.04 + al() * 0.2, v: 4 + al() * 8 }); }
    const lejos = tiraNubes(al, 1400, 160, 90, ['#e9f5ff', '#cfe6fa', '#b3d6f5']);
    const cerca = tiraNubes(al, 1200, 150, 70, ['#f2f9ff', '#d9ecfb', '#c2def6']);
    const [ci, gi] = lienzo2d(1600, 220);
    for (let i = 0; i < 6; i++) { const I = isla(al, 30 + Math.floor(al() * 40)); gi.drawImage(I, Math.floor(i / 6 * 1600 + al() * 120), Math.floor(20 + al() * 100)); }
    const S = sol();
    let arco = null;
    const pintarArco = (w, h) => {
      const m = 40, [c, ga] = lienzo2d(w + m * 2, h);
      const cx = w * 0.42 + m, cy = h * 1.05, R0 = h * 0.85;
      const COL = ['#ff5a5a', '#ffa23a', '#ffe23a', '#5fe05a', '#4aa8ff', '#8a6bff'];
      for (let i = 0; i < 6; i++) {
        for (let a = Math.PI; a < TAU; a += 0.004) {
          const x = cx + Math.cos(a) * (R0 - i * 5), y = cy + Math.sin(a) * (R0 - i * 5);
          const gris = a > Math.PI * 1.55;
          ga.fillStyle = gris ? '#c8cdd4' : COL[i]; ga.globalAlpha = gris ? 0.22 : 0.3;
          ga.fillRect(Math.round(x), Math.round(y), 2, 5);
        }
      }
      return { c, w, h, m };
    };
    return {
      cielo, sol: [0.78, 0.18], nubes, S,
      grado: { tinte: [1, 1.01, 1.03], levantar: [0.01, 0.02, 0.03], sat: 1.12, contraste: 1.03 },
      post: { bloom: 0.5, destello: 0.9, rayos: 0.55, umbral: 0.82, velo: 0.14 },
      capas: [{ c: lejos, f: 0.06, y: 250, fy: 0.05 }, { c: ci, f: 0.14, y: 40, fy: 0.08 }, { c: cerca, f: 0.32, y: 300, fy: 0.14 }],
      antes(g, cam, t, w, h) {
        /* el arcoíris: la mitad de la derecha ya perdió los colores. Son 4.700
           rectangulitos: se pintan una vez en su propio lienzo (costaba 30 ms
           por cuadro) y después solo se corre con la cámara */
        if (!arco || arco.w !== w || arco.h !== h) arco = pintarArco(w, h);
        g.drawImage(arco.c, Math.round(-cam.x * 0.02) - arco.m, 0);
      },
    };
  },

  /* la Noche Aurora: estrellas, la luna y las cortinas de luz que conectan a todos */
  aurora(semilla = 7) {
    const al = azar(semilla + 53);
    const cielo = [[0, '#030822'], [0.38, '#0a1a4a'], [0.66, '#123a6a'], [0.86, '#1b6378'], [1, '#2a8a86']];
    const estrellas = Array.from({ length: 150 }, () => ({ x: al() * 1600, y: al() * 230, b: al(), f: 0.01 + al() * 0.03, v: 1 + al() * 3 }));
    const montes = tiraLomas({ ancho: 1400, alto: 170, base: 100, amp: 50, armonicos: [[3, 0.6], [8, 0.3], [17, 0.1]], colores: ['#101d4a', '#0c173c', '#0a1232'], filo: { ancho: 1, color: '#3b5aa0' }, al });
    const lomas = tiraLomas({ ancho: 1100, alto: 170, base: 70, amp: 30, armonicos: [[2, 0.6], [5, 0.3], [11, 0.1]], colores: ['#0f4a4a', '#0b3a3e', '#082c33', '#061f28'], filo: { ancho: 2, color: '#39b995', sombra: '#167866' }, al });
    const [cl, gl] = lienzo2d(lomas.ancho, lomas.alto); gl.drawImage(lomas.c, 0, 0);
    /* casitas con la ventana prendida y flores que brillan */
    for (let i = 0; i < 9; i++) { const x = Math.floor(al() * lomas.ancho), y = lomas.tope[x]; gl.fillStyle = '#0a2a33'; gl.fillRect(x - 5, y - 8, 10, 9); gl.beginPath(); gl.moveTo(x - 7, y - 8); gl.lineTo(x, y - 14); gl.lineTo(x + 7, y - 8); gl.fill(); gl.fillStyle = '#ffd98a'; gl.fillRect(x - 2, y - 6, 3, 3); }
    for (let i = 0; i < 220; i++) { const x = Math.floor(al() * lomas.ancho), y = lomas.tope[x] + 3 + Math.floor(al() * 50); gl.fillStyle = ['#7dffc0', '#a98cff', '#6ff0e8'][i % 3]; gl.fillRect(x, y, 1, 1); }
    const L = luna();
    const [tiraA, gA] = lienzo2d(1, 80); const grA = gA.createLinearGradient(0, 0, 0, 80);
    grA.addColorStop(0, 'rgba(160,255,210,0)'); grA.addColorStop(0.2, 'rgba(140,255,200,0.55)'); grA.addColorStop(0.55, 'rgba(90,220,230,0.25)'); grA.addColorStop(1, 'rgba(150,110,255,0)');
    gA.fillStyle = grA; gA.fillRect(0, 0, 1, 80);
    const luciernagas = Array.from({ length: 24 }, () => ({ x: al() * 900, y: 150 + al() * 170, f: al() * TAU }));
    /* el degradé de la tira, ya multiplicado por su transparencia (para sumar luz) */
    const tono = gA.getImageData(0, 0, 1, 80).data, TONO = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) { const a = tono[i * 4 + 3] / 255; TONO[i * 3] = tono[i * 4] * a; TONO[i * 3 + 1] = tono[i * 4 + 1] * a; TONO[i * 3 + 2] = tono[i * 4 + 2] * a; }
    const cortinas = {
      c: null, g: null, img: null, suma: null, w: 0, h: 0, cw: 0, ch: 0, cuadro: 0, t0: -9,
      armar(w, h) {
        this.w = w; this.h = h; this.cw = Math.ceil(w / 2); this.ch = Math.ceil(Math.min(h, 260) / 2);
        /* en memoria y no en la placa (willReadFrequently): el putImageData en un lienzo de la placa la frenaba */
        this.c = document.createElement('canvas'); this.c.width = this.cw; this.c.height = this.ch;
        this.g = this.c.getContext('2d', { willReadFrequently: true });
        this.img = this.g.createImageData(this.cw, this.ch); this.suma = new Float32Array(this.cw * this.ch * 3);
      },
      pintar(cam, t) {
        const { cw, ch, suma } = this; suma.fill(0);
        for (let k = 0; k < 3; k++) {
          const base = 40 + k * 34, alto = 70 + k * 20;
          for (let cx = 0; cx < cw; cx++) {
            const X = cx * 2 + cam.x * (0.03 + k * 0.02);
            const y = base + Math.sin(X * 0.008 + t * 0.35 + k) * 22 + Math.sin(X * 0.021 - t * 0.5) * 9;
            const a = 0.5 + 0.45 * Math.sin(X * 0.013 + t * 0.8 + k * 2);
            const f0 = Math.max(0, Math.ceil(y / 2)), f1 = Math.min(ch, Math.floor((y + alto) / 2));
            for (let f = f0; f < f1; f++) {
              const i = Math.min(79, Math.floor((f * 2 - y) / alto * 80)) * 3, o = (f * cw + cx) * 3;
              suma[o] += TONO[i] * a; suma[o + 1] += TONO[i + 1] * a; suma[o + 2] += TONO[i + 2] * a;
            }
          }
        }
        const d = this.img.data;
        for (let i = 0, j = 0; i < suma.length; i += 3, j += 4) { d[j] = suma[i]; d[j + 1] = suma[i + 1]; d[j + 2] = suma[i + 2]; d[j + 3] = 255; }
        this.g.putImageData(this.img, 0, 0);
      },
    };
    return {
      cielo, sol: [0.18, 0.16], nubes: [], S: L,
      grado: { tinte: [0.98, 1.02, 1.04], levantar: [0.0, 0.02, 0.04], sat: 1.12, contraste: 1.05 },
      post: { bloom: 0.8, destello: 0.25, rayos: 0.15, umbral: 0.6, velo: 0.08 },
      capas: [{ c: montes.c, f: 0.06, y: 180, fy: 0.04 }, { c: cl, f: 0.22, y: 220, fy: 0.1 }],
      antes(g, cam, t, w, h) {
        for (const e of estrellas) {
          const per = 1600, x = ((e.x - cam.x * e.f) % per + per) % per - 100;
          g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * e.v + e.x));
          g.fillStyle = e.b > 0.8 ? '#ffffff' : '#bcd8ff'; g.fillRect(Math.round(x), Math.round(e.y), 1, 1);
          if (e.b > 0.93) { g.fillRect(Math.round(x) - 1, Math.round(e.y), 3, 1); g.fillRect(Math.round(x), Math.round(e.y) - 1, 1, 3); }
        }
        g.globalAlpha = 1;
        /* las cortinas: tiras verticales que ondulan. Eran 930 drawImage por
           cuadro en modo 'lighter' (hasta 120 ms en el perfil): ahora se
           calculan a mano en un búfer de media resolución, cada dos cuadros, y
           se pegan agrandadas de una vez */
        cortinas.cuadro++;
        if (!cortinas.c || cortinas.w !== w || cortinas.h !== h) cortinas.armar(w, h);
        if (cortinas.cuadro % 2 === 0 || cortinas.t0 !== cortinas.cuadro - 1) cortinas.pintar(cam, t);
        cortinas.t0 = cortinas.cuadro;
        g.globalCompositeOperation = 'lighter';
        g.drawImage(cortinas.c, 0, 0, cortinas.cw, cortinas.ch, 0, 0, cortinas.cw * 2, cortinas.ch * 2);
        g.globalCompositeOperation = 'source-over';
      },
      despues(g, cam, t, w, h) {
        for (const q of luciernagas) {
          const per = 900, x = ((q.x - cam.x * 0.4 + Math.sin(t * 0.5 + q.f) * 20) % per + per) % per - 50, y = q.y + Math.sin(t * 0.9 + q.f) * 10;
          g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + q.f); g.fillStyle = '#c8ffb0'; g.fillRect(Math.round(x), Math.round(y), 1, 1);
          g.globalAlpha *= 0.4; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        }
        g.globalAlpha = 1;
      },
    };
  },

  /* el Plano: sin cielo ni piso, solo placas planas en una grilla. Tienen
     color (plano, sin brillo), pero al principio el Plano se lo come entero */
  plano(semilla = 7) {
    const al = azar(semilla + 71);
    const cielo = [[0, '#b4bcc6'], [1, '#c9d0d8']];
    const placas = (ancho, alto, n, cols, o) => {
      const [c, g] = lienzo2d(ancho, alto);
      for (let i = 0; i < n; i++) {
        const w = o.w0 + Math.floor(al() * o.w1) * 8, h = o.h0 + Math.floor(al() * o.h1) * 8, x = Math.floor(al() * ancho / 8) * 8, y = alto - h;
        g.fillStyle = cols[i % cols.length];
        for (const dx of [0, -ancho, ancho]) g.fillRect(x + dx, y, w, h);
      }
      return c;
    };
    const lejos = placas(1400, 220, 30, ['#68b4e8', '#8fd06a', '#e889b8', '#f2c14e'], { w0: 24, w1: 6, h0: 40, h1: 16 });
    const cerca = placas(1200, 160, 22, ['#1ba1e2', '#60a917', '#d80073', '#f09609', '#6a00ff'], { w0: 32, w1: 6, h0: 24, h1: 10 });
    return {
      cielo, sol: [0.5, 0.2], nubes: [], S: null,
      grado: { tinte: [1, 1, 1], levantar: [0, 0, 0], sat: 1.05, contraste: 1.02 },
      post: { bloom: 0.3, destello: 0, rayos: 0, umbral: 0.85, velo: 0.1 },
      capas: [{ c: lejos, f: 0.08, y: 140, fy: 0.04 }, { c: cerca, f: 0.24, y: 230, fy: 0.1 }],
      antes(g, cam, t, w, h) {
        g.fillStyle = 'rgba(255,255,255,0.18)';
        const ox = -Math.round(cam.x * 0.05) % 32, oy = -Math.round(cam.y * 0.05) % 32;
        for (let x = ox; x < w; x += 32) g.fillRect(x, 0, 1, h);
        for (let y = oy; y < h; y += 32) g.fillRect(0, y, w, 1);
      },
    };
  },
};

/* el fondo armado de un mundo, listo para dibujar */
export class Fondo {
  constructor(nombre, semilla) {
    this.nombre = nombre;
    this.M = (MUNDOS_FONDO[nombre] || MUNDOS_FONDO.colina)(semilla);
    this.cieloTira = null; this.altoTira = 0;
  }
  get sol() { return this.M.sol; }
  get grado() { return this.M.grado; }
  get post() { return this.M.post; }
  tiraCielo(h) {
    if (this.cieloTira && this.altoTira === h) return this.cieloTira;
    const [c, g] = lienzo2d(1, h), gr = g.createLinearGradient(0, 0, 0, h);
    for (const [k, col] of this.M.cielo) gr.addColorStop(k, col);
    g.fillStyle = gr; g.fillRect(0, 0, 1, h);
    this.cieloTira = c; this.altoTira = h;
    return c;
  }
  /* lo de atrás del juego. cam = { x, y } (arriba a la izquierda de la vista, en píxeles del mundo); ref = el y de la cámara "en su lugar" */
  atras(g, cam, t, w, h, ref = 0) {
    const M = this.M;
    g.drawImage(this.tiraCielo(h), 0, 0, 1, h, 0, 0, w, h);
    /* el sol o la luna (casi no se mueven) */
    if (M.S) { const sx = Math.round(M.sol[0] * w - M.S.width / 2), sy = Math.round(M.sol[1] * h - M.S.height / 2); g.drawImage(M.S, sx, sy); }
    if (M.antes) M.antes(g, cam, t, w, h);
    /* las nubes, cada una a su profundidad, y corriendo despacio */
    for (const n of M.nubes) {
      const per = 2400;
      let x = ((n.x + t * n.v - cam.x * n.f) % per + per) % per - 200;
      g.drawImage(n.c, Math.round(x), Math.round(n.y - (cam.y - ref) * n.f * 0.3));
    }
    for (const L of M.capas) {
      const per = L.c.width;
      const ox = -(((cam.x * L.f) % per) + per) % per;
      const y = Math.round(L.y + (h - 360) - (cam.y - ref) * L.fy);
      for (let x = Math.round(ox); x < w; x += per) {
        g.drawImage(L.c, x, y);
        if (M.extra) M.extra(g, L, x, y, t, cam);
        if (L.molinos) for (const m of M.molinos) {
          const mx = x + m.x;
          if (mx < -30 || mx > w + 30) continue;
          dibujarMolino(g, mx, y + M.lejosTope[m.x] + 2, m.alto, m.fase + t * m.v, { torre: '#f4fbff', aspa: '#ffffff', centro: '#cfe6f7' });
        }
      }
    }
    if (M.despues) M.despues(g, cam, t, w, h);
  }
}
