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
    /* el sol (casi no se mueve) */
    const sx = Math.round(M.sol[0] * w - M.S.width / 2), sy = Math.round(M.sol[1] * h - M.S.height / 2);
    g.drawImage(M.S, sx, sy);
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
        if (L.molinos) for (const m of M.molinos) {
          const mx = x + m.x;
          if (mx < -30 || mx > w + 30) continue;
          dibujarMolino(g, mx, y + M.lejosTope[m.x] + 2, m.alto, m.fase + t * m.v, { torre: '#f4fbff', aspa: '#ffffff', centro: '#cfe6f7' });
        }
      }
    }
  }
}
