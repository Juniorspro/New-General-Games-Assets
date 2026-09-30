// El logo VÍBORA.IO, dibujado con trazos gruesos y redondos, como si cada
// letra fuera una víbora: borde oscuro, cuerpo con franjas de la piel lima,
// brillo arriba y un ojito en la O. No depende de ninguna letra instalada.
const L = {
  V: [[[8, 8], [50, 112], [92, 8]]],
  I: [[[18, 8], [18, 112]]],
  Í: [[[22, 8], [22, 112]], [[18, -22], [38, -40]]],
  B: [[[16, 112], [16, 8], [52, 8], ['c', 86, 8, 86, 58, 52, 58], [16, 58]], [[52, 58], ['c', 94, 58, 94, 112, 54, 112], [16, 112]]],
  O: 'O',
  R: [[[16, 112], [16, 8], [52, 8], ['c', 88, 8, 88, 62, 52, 62], [16, 62]], [[50, 62], [88, 112]]],
  A: [[[8, 112], [50, 8], [92, 112]], [[26, 74], [74, 74]]],
  '.': '.',
};
const ANCHO = { V: 100, I: 36, Í: 44, B: 92, O: 104, R: 94, A: 100, '.': 36 };

function caminoLetra(ch, x, y, k) {
  const p = new Path2D(), def = L[ch];
  if (def === 'O') { p.ellipse(x + 52 * k, y + 60 * k, 42 * k, 52 * k, 0, 0, Math.PI * 2); return p; }
  if (def === '.') return p;
  for (const tramo of def) tramo.forEach((q, i) => {
    if (q[0] === 'c') p.bezierCurveTo(x + q[1] * k, y + q[2] * k, x + q[3] * k, y + q[4] * k, x + q[5] * k, y + q[6] * k);
    else if (i === 0) p.moveTo(x + q[0] * k, y + q[1] * k);
    else p.lineTo(x + q[0] * k, y + q[1] * k);
  });
  return p;
}

let lienzoFranjas = null;
function franjas() {
  if (lienzoFranjas) return lienzoFranjas;
  const c = document.createElement('canvas'); c.width = 24; c.height = 24;
  const f = c.getContext('2d');
  f.fillStyle = '#8cff3a'; f.fillRect(0, 0, 24, 24); f.fillStyle = '#58c91c'; f.fillRect(0, 0, 12, 24);
  return (lienzoFranjas = c);
}

// Dibuja "VÍBORA.IO" centrado en (cx, cy) con alto de letra `alto`.
// `t` mueve las franjas y hace latir el punto (una comida que brilla).
export function dibujarLogo(g, cx, cy, alto, t = 0) {
  const texto = ['V', 'Í', 'B', 'O', 'R', 'A', '.', 'I', 'O'];
  const k = alto / 120, gro = 27 * k;
  const total = texto.reduce((s, c) => s + ANCHO[c] * k, 0) + (texto.length - 1) * 6 * k;
  let x = cx - total / 2;
  const y = cy - alto / 2;
  const caminos = [];
  for (const ch of texto) { caminos.push([ch, caminoLetra(ch, x, y, k), x]); x += (ANCHO[ch] + 6) * k; }
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  const pasada = (ancho, estilo, dy = 0) => {
    for (const [ch, p] of caminos) { if (ch === '.') continue; g.save(); g.translate(0, dy); g.lineWidth = ancho; g.strokeStyle = estilo; g.stroke(p); g.restore(); }
  };
  pasada(gro + 12 * k, 'rgba(0,0,0,0.45)', 7 * k);   // sombra
  pasada(gro + 9 * k, '#0b2410');                     // borde
  // el cuerpo con franjas que corren (el patrón se mueve con t); el lienzo
  // de las franjas se hace una vez, no en cada cuadro del menú
  const patron = g.createPattern(franjas(), 'repeat');
  patron.setTransform(new DOMMatrix([k * 1.6, k * 1.6, -k * 1.6, k * 1.6, t * 30 * k, 0]));
  pasada(gro, patron);
  pasada(gro * 0.32, 'rgba(255,255,255,0.55)', -gro * 0.22);     // brillo
  // el ojito en la primera O
  const [, , ox] = caminos[3];
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ox + 70 * k, y + 32 * k, 11 * k, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#101018'; g.beginPath(); g.arc(ox + 73 * k, y + 33 * k, 6 * k, 0, Math.PI * 2); g.fill();
  // el punto: una comida que late
  const [, , px] = caminos[6], late = 1 + Math.sin(t * 5) * 0.15;
  const rad = 14 * k * late, gr = g.createRadialGradient(px + 18 * k, y + 104 * k, 0, px + 18 * k, y + 104 * k, rad * 2.2);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#ffe35e'); gr.addColorStop(1, 'rgba(255,200,40,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(px + 18 * k, y + 104 * k, rad * 2.2, 0, Math.PI * 2); g.fill();
  g.restore();
  return total;
}
