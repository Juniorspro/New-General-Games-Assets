// El logo de JXSTUDIOS, calcado de la imagen que mandó quien pide
// (30/09/2026): el monograma JXS son cuatro trazos de metal del mismo
// ancho, en paralelo de a dos (entre línea y línea, el doble del grosor):
//   - la J de adentro (barra, palo y gancho);
//   - la S de adentro;
//   - A: la barra de arriba de la J que baja en diagonal (el "\" de la X) y
//     abraza la S por abajo;
//   - B: el gancho de abajo de la J que sube en diagonal (el "/" de la X,
//     que pasa POR ENCIMA del "\") y abraza la S por arriba.
// Coordenadas en una caja de 350 × 172. El mismo dibujo sirve para la
// versión de píxeles (se rasteriza chico), la 2D suave (se traza) y la 3D
// (se muestrea la línea y se engorda a los costados).
export const CAJA = { w: 350, h: 172 };
export const GROSOR = 14.5;

export const TRAZOS = [
  // A va abajo en el cruce: se dibuja primero
  { id: 'A', capa: 0, d: [['M', 40, 19], ['L', 114, 19], ['L', 176, 101], ['C', 194, 128, 222, 168, 268, 169], ['C', 310, 170, 342, 152, 342, 122]] },
  { id: 'J', capa: 0, d: [['M', 40, 43], ['L', 98, 43], ['L', 98, 116], ['C', 98, 148, 44, 158, 36, 124]] },
  { id: 'S', capa: 0, d: [['M', 312, 66], ['C', 306, 46, 288, 36, 266, 36], ['C', 242, 36, 226, 48, 226, 63], ['C', 226, 80, 248, 86, 272, 92], ['C', 302, 99, 320, 108, 320, 126], ['C', 320, 142, 300, 148, 272, 148], ['C', 246, 148, 226, 138, 216, 118]] },
  { id: 'B', capa: 1, d: [['M', 10, 130], ['C', 18, 158, 50, 168, 86, 166], ['C', 108, 165, 122, 158, 134, 142], ['L', 200, 46], ['C', 216, 24, 244, 12, 272, 12], ['C', 310, 12, 340, 30, 340, 62]] },
];

// Un trazo como Path2D, escalado y corrido.
export function camino2d(t, esc = 1, ox = 0, oy = 0) {
  const p = new Path2D();
  for (const [op, ...n] of t.d) {
    const q = n.map((v, i) => (i % 2 ? oy + v * esc : ox + v * esc));
    if (op === 'M') p.moveTo(q[0], q[1]);
    else if (op === 'L') p.lineTo(q[0], q[1]);
    else p.bezierCurveTo(q[0], q[1], q[2], q[3], q[4], q[5]);
  }
  return p;
}

// Puntos a lo largo del trazo, más o menos parejos (para la 3D, para animar
// el dibujo de la línea y para medir el largo).
export function muestrear(t, cada = 3) {
  const pts = [];
  let x = 0, y = 0;
  for (const [op, ...n] of t.d) {
    if (op === 'M') { x = n[0]; y = n[1]; pts.push([x, y]); continue; }
    if (op === 'L') {
      const [x1, y1] = n, largo = Math.hypot(x1 - x, y1 - y), k = Math.max(1, Math.ceil(largo / cada));
      for (let i = 1; i <= k; i++) pts.push([x + ((x1 - x) * i) / k, y + ((y1 - y) * i) / k]);
      x = x1; y = y1; continue;
    }
    const [c1x, c1y, c2x, c2y, x1, y1] = n;
    const aprox = Math.hypot(c1x - x, c1y - y) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x1 - c2x, y1 - c2y);
    const k = Math.max(2, Math.ceil(aprox / cada));
    for (let i = 1; i <= k; i++) {
      const s = i / k, r = 1 - s;
      pts.push([r * r * r * x + 3 * r * r * s * c1x + 3 * r * s * s * c2x + s * s * s * x1, r * r * r * y + 3 * r * r * s * c1y + 3 * r * s * s * c2y + s * s * s * y1]);
    }
    x = x1; y = y1;
  }
  return pts;
}

export function largo(t) {
  const p = muestrear(t, 2);
  let l = 0;
  for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return l;
}

// El monograma dibujado en 2D con su metal, en un lienzo aparte (así el
// reflejo, que se pinta "arriba de lo dibujado", toca solo el metal):
// sombra, borde oscuro (que en el cruce hace de hueco y deja ver que B pasa
// por encima), el cuerpo con un degradé de cromo y el filo de luz.
// `avance` (0 a 1) dibuja cada trazo hasta ahí: el metal "se escribe".
// `brillo` (0 a 1) pasa una franja de luz de izquierda a derecha.
export function monograma(ancho, { avance = 1, brillo = -1, sombra = true, lienzo = null } = {}) {
  const esc = ancho / CAJA.w, gro = GROSOR * esc, alto = Math.ceil(CAJA.h * esc);
  const m = Math.ceil(10 * esc) + 2;
  const c = lienzo || document.createElement('canvas');
  c.width = Math.ceil(ancho) + 2 * m; c.height = alto + 2 * m;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const crom = g.createLinearGradient(0, m, 0, m + alto);
  crom.addColorStop(0, '#fbfbfd'); crom.addColorStop(0.35, '#c9ccd4'); crom.addColorStop(0.55, '#8a8f99');
  crom.addColorStop(0.7, '#d9dce3'); crom.addColorStop(1, '#6f747e');
  g.lineCap = 'butt'; g.lineJoin = 'round';
  for (const capa of [0, 1]) for (const t of TRAZOS) {
    if (t.capa !== capa) continue;
    const p = camino2d(t, esc, m, m), l = largo(t) * esc;
    const trazo = (a, estilo, dx = 0, dy = 0) => {
      g.save();
      g.translate(dx, dy);
      if (avance < 1) g.setLineDash([Math.max(0.01, l * avance), l + 10]);
      g.lineWidth = a; g.strokeStyle = estilo; g.stroke(p);
      g.restore();
    };
    // cara plana con bisel (como el logo): el borde que abre el hueco del
    // cruce, el bisel gris y la cara de cromo
    if (sombra) trazo(gro + 2 * esc, 'rgba(0,0,0,0.6)', 3 * esc, 5 * esc);
    trazo(gro + 5 * esc, '#050607');
    trazo(gro, '#5b5f68');
    trazo(gro * 0.74, crom);
  }
  if (brillo >= 0 && brillo <= 1) {
    g.globalCompositeOperation = 'source-atop';
    const bx = m + (brillo * 1.6 - 0.3) * ancho;
    const f = g.createLinearGradient(bx - ancho * 0.12, 0, bx + ancho * 0.12, 0);
    f.addColorStop(0, 'rgba(255,255,255,0)'); f.addColorStop(0.5, 'rgba(255,255,255,0.85)'); f.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = f; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
  }
  c.margen = m;
  return c;
}

// La palabra "JXStudios" en metal, con la letra del sistema (sans gruesa):
// se mide y se escala para que ocupe justo `ancho`.
export function palabra(ancho, { color = null } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const fuente = (px) => `600 ${px}px "Montserrat", "Poppins", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
  g.font = fuente(100);
  const w100 = g.measureText('JXStudios').width || 400;
  const px = Math.max(8, (ancho / w100) * 100);
  c.width = Math.ceil(ancho + px * 0.2); c.height = Math.ceil(px * 1.35);
  g.font = fuente(px); g.textBaseline = 'alphabetic';
  const base = Math.round(px * 1.02), x = Math.round(px * 0.1);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText('JXStudios', x + px * 0.03, base + px * 0.05);
  const crom = g.createLinearGradient(0, base - px * 0.75, 0, base);
  crom.addColorStop(0, '#ffffff'); crom.addColorStop(0.5, '#d2d5dc'); crom.addColorStop(0.62, '#9aa0aa'); crom.addColorStop(1, '#e7e9ee');
  g.fillStyle = color || crom; g.fillText('JXStudios', x, base);
  return c;
}

// El monograma en píxeles: se traza chico (con el hueco del cruce), se
// separa metal de borde por color y se vuelve a pintar a mano en escalones
// de cromo (claro arriba, oscuro al medio, claro abajo) con bisel.
export function monogramaPixel(anchoPx, { avance = 1 } = {}) {
  const esc = anchoPx / CAJA.w, alto = Math.ceil(CAJA.h * esc) + 4, ancho = Math.ceil(anchoPx) + 4;
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  const g = c.getContext('2d');
  for (const capa of [0, 1]) for (const t of TRAZOS) {
    if (t.capa !== capa) continue;
    const p = camino2d(t, esc, 2, 2), l = largo(t) * esc;
    g.save();
    if (avance < 1) g.setLineDash([Math.max(0.01, l * avance), l + 10]);
    g.lineCap = 'butt';
    g.lineWidth = GROSOR * esc + 2.2; g.strokeStyle = '#ff0000'; g.stroke(p);
    g.lineWidth = GROSOR * esc; g.strokeStyle = '#00ff00'; g.stroke(p);
    g.restore();
  }
  const img = g.getImageData(0, 0, ancho, alto), d = img.data;
  const metal = new Uint8Array(ancho * alto), borde = new Uint8Array(ancho * alto);
  for (let i = 0; i < ancho * alto; i++) {
    if (d[i * 4 + 3] < 90) continue;
    if (d[i * 4 + 1] > 110) metal[i] = 1; else if (d[i * 4] > 110) borde[i] = 1;
  }
  const ESCALON = ['#f4f5f8', '#d9dbe1', '#b7bbc4', '#8d929c', '#a9adb6', '#d3d6dc', '#9ea3ad', '#767b85'];
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const i = y * ancho + x, k = i * 4;
    if (metal[i]) {
      const arriba = y > 0 && metal[i - ancho], abajo = y < alto - 1 && metal[i + ancho];
      const izq = x > 0 && metal[i - 1], der = x < ancho - 1 && metal[i + 1];
      let col = ESCALON[Math.min(ESCALON.length - 1, Math.floor(((y - 2) / (alto - 4)) * ESCALON.length))];
      if (!arriba || !izq) col = '#ffffff';            // el filo que da a la luz
      else if (!abajo || !der) col = '#5b5f68';        // el bisel en sombra
      const n = parseInt(col.slice(1), 16);
      d[k] = n >> 16; d[k + 1] = (n >> 8) & 255; d[k + 2] = n & 255; d[k + 3] = 255;
    } else if (borde[i]) { d[k] = 5; d[k + 1] = 6; d[k + 2] = 8; d[k + 3] = 255; }
    else d[k + 3] = 0;
  }
  g.putImageData(img, 0, 0);
  c.mascara = metal;       // para pasarle el brillo solo por el metal
  c.esc = esc;             // para ubicar puntas de trazo en pantalla
  return c;
}

// Dónde va la punta de cada trazo cuando está escrito hasta `avance`
// (coordenadas de la caja del logo).
const cacheMuestras = new Map();
export function puntas(avance) {
  const out = [];
  for (const t of TRAZOS) {
    if (!cacheMuestras.has(t.id)) {
      const p = muestrear(t, 2), acum = [0];
      for (let i = 1; i < p.length; i++) acum.push(acum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      cacheMuestras.set(t.id, { p, acum });
    }
    const { p, acum } = cacheMuestras.get(t.id), meta = acum[acum.length - 1] * avance;
    let i = 1;
    while (i < acum.length - 1 && acum[i] < meta) i++;
    out.push(p[i]);
  }
  return out;
}
