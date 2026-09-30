// La mano del animador: la de verdad, la que entra al set entre foto y foto
// para mover las cosas (y a Grumo). No es de plastilina: piel con uñas,
// nudillos y la manga de un pulóver tejido, así se nota que viene "de
// afuera" y es enorme al lado de Grumo. Antes de entrar se ve su sombra
// sobre el set (el aviso): primero grande y borrosa, después chica y firme,
// como algo que baja hacia la mesa.
//
// Se dibuja apuntando para abajo, con la punta de los dedos (donde agarra)
// en (0, 0); para entrar de un costado se gira.
import { lienzo, guardado, sombraDe } from './plastilina.js';
import { clamp, tono, rgba } from './util.js';
import { MANO } from './partida.js';

const PIEL = '#f0c3a2', OSC = '#cf8f6c', CLARA = '#fadcc6', CONTORNO = '#b27456', UNA = '#f8e2d6', LANA = '#b04a3b';

// un dedo: un camino de puntos (del nudillo a la punta) engordado, con su
// contorno, la luz de un costado y la uña en la punta
function dedo(g, pts, ancho, { una = true } = {}) {
  const trazo = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); if (pts.length === 3) g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); else g.lineTo(pts[1][0], pts[1][1]); };
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = CONTORNO; g.lineWidth = ancho * 1.12; trazo(); g.stroke();
  g.strokeStyle = PIEL; g.lineWidth = ancho; trazo(); g.stroke();
  // la luz: una tira clara corrida a la izquierda y más finita
  g.save(); g.translate(-ancho * 0.16, -ancho * 0.05);
  g.strokeStyle = rgba(CLARA, 0.9); g.lineWidth = ancho * 0.32; trazo(); g.stroke(); g.restore();
  // la sombra del otro costado
  g.save(); g.translate(ancho * 0.24, 0);
  g.strokeStyle = rgba(OSC, 0.5); g.lineWidth = ancho * 0.22; trazo(); g.stroke(); g.restore();
  const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
  const ang = Math.atan2(by - ay, bx - ax);
  // las arruguitas de la articulación del medio
  const mx = pts.length === 3 ? pts[1][0] * 0.5 + (pts[0][0] + pts[2][0]) * 0.25 : (ax + bx) / 2, my = pts.length === 3 ? pts[1][1] * 0.5 + (pts[0][1] + pts[2][1]) * 0.25 : (ay + by) / 2;
  g.strokeStyle = rgba(CONTORNO, 0.45); g.lineWidth = Math.max(1, ancho * 0.07);
  for (const k of [-0.12, 0.12]) { g.beginPath(); g.moveTo(mx - Math.sin(ang) * ancho * 0.28 + Math.cos(ang) * ancho * k, my + Math.cos(ang) * ancho * 0.28 + Math.sin(ang) * ancho * k); g.lineTo(mx + Math.sin(ang) * ancho * 0.18 + Math.cos(ang) * ancho * k, my - Math.cos(ang) * ancho * 0.18 + Math.sin(ang) * ancho * k); g.stroke(); }
  if (una) {
    g.save(); g.translate(bx - Math.cos(ang) * ancho * 0.2, by - Math.sin(ang) * ancho * 0.2); g.rotate(ang - Math.PI / 2);
    g.fillStyle = UNA; g.beginPath(); g.ellipse(0, 0, ancho * 0.3, ancho * 0.36, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = rgba(CONTORNO, 0.5); g.lineWidth = Math.max(1, ancho * 0.05); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(-ancho * 0.08, -ancho * 0.08, ancho * 0.1, ancho * 0.14, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}
// un dedo cerrado: el nudillo doblado que asoma abajo de la palma
function doblado(g, x, y, ancho) {
  g.fillStyle = CONTORNO; g.beginPath(); g.ellipse(x, y, ancho * 0.58, ancho * 0.66, 0, 0, Math.PI * 2); g.fill();
  const gr = g.createRadialGradient(x - ancho * 0.2, y - ancho * 0.2, ancho * 0.05, x, y, ancho * 0.6);
  gr.addColorStop(0, CLARA); gr.addColorStop(1, PIEL);
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - ancho * 0.03, ancho * 0.52, ancho * 0.6, 0, 0, Math.PI * 2); g.fill();
}

// una pose de la mano, en un lienzo: {img, sombra, ox, oy} (ox, oy = la punta)
function pose(nombre, ts) {
  return guardado(`mano:${nombre}:${ts}`, () => {
    const u = ts, W = Math.ceil(u * 2.6), H = Math.ceil(u * 7.5), c = lienzo(W, H), g = c.getContext('2d');
    const ox = W * 0.5, oy = H - u * 0.3;
    g.translate(ox, oy);
    // la manga del pulóver: sale por arriba de la pantalla, con pliegues
    const manga = new Path2D();
    manga.moveTo(-u * 0.6, -u * 2.2); manga.quadraticCurveTo(-u * 0.7, -u * 4.5, -u * 0.78, -oy - 2); manga.lineTo(u * 0.78, -oy - 2); manga.quadraticCurveTo(u * 0.72, -u * 4.5, u * 0.6, -u * 2.2); manga.closePath();
    const gm = g.createLinearGradient(-u * 0.8, 0, u * 0.8, 0);
    gm.addColorStop(0, tono(LANA, -0.35)); gm.addColorStop(0.4, tono(LANA, 0.12)); gm.addColorStop(1, tono(LANA, -0.4));
    g.fillStyle = gm; g.fill(manga);
    g.save(); g.clip(manga);
    // el tejido: columnitas de puntos en V
    for (let x = -u * 0.8; x < u * 0.8; x += u * 0.14) for (let y = -oy; y < -u * 2.2; y += u * 0.12) {
      g.strokeStyle = 'rgba(40,10,5,0.18)'; g.lineWidth = Math.max(1, u * 0.025);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + u * 0.05, y + u * 0.08); g.lineTo(x + u * 0.1, y); g.stroke();
    }
    // pliegues
    g.strokeStyle = 'rgba(40,10,5,0.28)'; g.lineWidth = u * 0.06; g.lineCap = 'round';
    for (const y of [-u * 3.1, -u * 4.3]) { g.beginPath(); g.moveTo(-u * 0.6, y); g.quadraticCurveTo(0, y + u * 0.25, u * 0.5, y - u * 0.05); g.stroke(); }
    g.restore();
    // el puño elástico
    const puno = new Path2D(); puno.moveTo(-u * 0.62, -u * 2.55); puno.lineTo(u * 0.62, -u * 2.55); puno.lineTo(u * 0.56, -u * 2.08); puno.quadraticCurveTo(0, -u * 1.98, -u * 0.56, -u * 2.08); puno.closePath();
    g.fillStyle = tono(LANA, -0.12); g.fill(puno);
    g.save(); g.clip(puno);
    for (let x = -u * 0.64; x < u * 0.64; x += u * 0.09) { g.fillStyle = 'rgba(40,10,5,0.25)'; g.fillRect(x, -u * 2.6, u * 0.035, u * 0.6); g.fillStyle = 'rgba(255,220,200,0.15)'; g.fillRect(x + u * 0.04, -u * 2.6, u * 0.025, u * 0.6); }
    g.restore();
    // el dorso de la mano
    const palma = new Path2D();
    palma.moveTo(-u * 0.42, -u * 2.05);
    palma.bezierCurveTo(-u * 0.5, -u * 1.7, -u * 0.58, -u * 1.3, -u * 0.5, -u * 1.02);
    palma.bezierCurveTo(-u * 0.2, -u * 0.9, u * 0.2, -u * 0.9, u * 0.5, -u * 1.05);
    palma.bezierCurveTo(u * 0.55, -u * 1.4, u * 0.5, -u * 1.75, u * 0.42, -u * 2.05);
    palma.closePath();
    const gp = g.createLinearGradient(-u * 0.55, 0, u * 0.55, 0);
    gp.addColorStop(0, OSC); gp.addColorStop(0.35, CLARA); gp.addColorStop(0.7, PIEL); gp.addColorStop(1, OSC);
    // los dedos de atrás van antes que la palma (quedan tapados por ella)
    const a = u * 0.25;
    if (nombre === 'abierta') {
      dedo(g, [[u * 0.36, -u * 1.08], [u * 0.44, -u * 0.62], [u * 0.46, -u * 0.3]], a * 0.8);
      dedo(g, [[u * 0.13, -u * 1.02], [u * 0.17, -u * 0.5], [u * 0.16, -u * 0.08]], a * 0.94);
      dedo(g, [[-u * 0.12, -u * 1.0], [-u * 0.13, -u * 0.45], [-u * 0.12, 0]], a);
      dedo(g, [[-u * 0.36, -u * 1.04], [-u * 0.42, -u * 0.55], [-u * 0.42, -u * 0.12]], a * 0.95);
    }
    g.fillStyle = gp; g.fill(palma);
    g.strokeStyle = CONTORNO; g.lineWidth = Math.max(1, u * 0.035); g.stroke(palma);
    // los tendones y la luz del dorso
    g.strokeStyle = rgba(OSC, 0.35); g.lineWidth = u * 0.035; g.lineCap = 'round';
    for (const x of [-0.3, -0.1, 0.1, 0.3]) { g.beginPath(); g.moveTo(x * u * 0.6, -u * 1.9); g.lineTo(x * u, -u * 1.2); g.stroke(); }
    g.fillStyle = rgba('#ffffff', 0.25); g.beginPath(); g.ellipse(-u * 0.18, -u * 1.6, u * 0.16, u * 0.3, 0.1, 0, Math.PI * 2); g.fill();
    if (nombre === 'pinza') {
      for (const [x, y] of [[u * 0.08, -u * 0.92], [u * 0.28, -u * 0.95], [u * 0.44, -u * 1.02]]) doblado(g, x, y, a);
      dedo(g, [[-u * 0.28, -u * 1.04], [-u * 0.3, -u * 0.4], [u * 0.02, -u * 0.02]], a);
      dedo(g, [[-u * 0.48, -u * 1.55], [-u * 0.78, -u * 0.8], [-u * 0.04, -u * 0.02]], a * 1.1);
    } else if (nombre === 'dedo') {
      for (const [x, y] of [[u * 0.08, -u * 0.92], [u * 0.28, -u * 0.95], [u * 0.44, -u * 1.02]]) doblado(g, x, y, a);
      dedo(g, [[-u * 0.24, -u * 1.02], [-u * 0.12, -u * 0.5], [0, 0]], a);
      dedo(g, [[-u * 0.46, -u * 1.6], [-u * 0.62, -u * 1.15], [-u * 0.34, -u * 0.9]], a * 1.08);
    } else {
      dedo(g, [[-u * 0.48, -u * 1.55], [-u * 0.8, -u * 1.25], [-u * 0.88, -u * 0.8]], a * 1.1);
    }
    // los nudillos
    g.strokeStyle = rgba(CONTORNO, 0.4); g.lineWidth = Math.max(1, u * 0.025);
    for (const x of [-0.3, -0.08, 0.14, 0.34]) { g.beginPath(); g.arc(x * u, -u * 1.06, u * 0.06, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    return { img: c, sombra: sombraDe(c, ts * 0.22, 0.55), ox, oy, W, H };
  });
}

const GIRO = { arriba: 0, izq: -Math.PI / 2, der: Math.PI / 2 };

export function dibujarManos(g, p, cam, cuadro) {
  const { ts } = cam;
  for (const m of p.manos) {
    const x = cam.x + m.x * ts, y = cam.y + m.y * ts;
    const pz = pose(m.fase === 'agarra' || m.fase === 'lleva' ? (m.a.agarra ? 'pinza' : 'dedo') : m.a.agarra ? 'abierta' : 'dedo', ts);
    const ang = GIRO[m.lado] || 0;
    if (m.fase === 'aviso') {
      // solo la sombra, sobre donde va a agarrar: grande y borrosa que se achica
      const k = clamp((p.T - m.t0) / (m.a.aviso ?? MANO.aviso), 0, 1), [px, py] = m.punto;
      const sx = cam.x + px * ts, sy = cam.y + py * ts, esc = 1.8 - k * 0.7;
      g.save(); g.globalAlpha = 0.25 + k * 0.45;
      g.translate(sx + ts * 0.9, sy + ts * 0.7); g.rotate(ang); g.scale(esc, esc);
      g.drawImage(pz.sombra, -pz.ox, -pz.oy);
      g.restore();
      continue;
    }
    // la sombra sobre el set y la mano
    g.save();
    g.translate(x + ts * 0.55, y + ts * 0.45); g.rotate(ang);
    g.globalAlpha = 0.75; g.drawImage(pz.sombra, -pz.ox, -pz.oy);
    g.restore();
    g.save();
    g.translate(x, y); g.rotate(ang);
    g.drawImage(pz.img, -pz.ox, -pz.oy);
    g.restore();
  }
}
// para el menú y la intro: una pose suelta
export function dibujarMano(g, x, y, ts, nombre = 'dedo', ang = 0, sombra = true) {
  const pz = pose(nombre, ts);
  if (sombra) { g.save(); g.translate(x + ts * 0.55, y + ts * 0.45); g.rotate(ang); g.globalAlpha = 0.7; g.drawImage(pz.sombra, -pz.ox, -pz.oy); g.restore(); }
  g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(pz.img, -pz.ox, -pz.oy); g.restore();
}
