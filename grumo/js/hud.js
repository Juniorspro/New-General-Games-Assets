// Lo que rodea al set mientras se juega: la mesa del animador con la luz de
// la lámpara, el marco de madera del escenario, la claqueta (arriba, con la
// escena y el número de toma: cada vez que Grumo se muere es una toma
// nueva y la claqueta golpea), la claqueta grande del principio de cada
// escena, los botones de plastilina y la nota de ayuda de las primeras
// escenas.
import { COLS, FILAS } from './partida.js';
import { mesa } from './intro.js';
import { lienzo, guardado, olvidar, armarPieza, redondo } from './plastilina.js';
import { clamp, tono, rgba, hash } from './util.js';

// ── la mesa, la lámpara y el marco del set ───────────────────────────────
export function dibujarSet(g, W, H, cam, u) {
  g.drawImage(mesa(W, H), 0, 0);
  const { ts } = cam, x = cam.x, y = cam.y, w = COLS * ts, h = FILAS * ts, m = Math.max(6 * u, ts * 0.16);
  const c = guardado(`marco:${W}x${H}:${Math.round(x)}:${Math.round(y)}:${ts}`, () => {
    olvidar('marco:');
    const cv = lienzo(W, H), gc = cv.getContext('2d');
    // la luz de la lámpara cae sobre el set; lo de afuera queda en penumbra
    const gr = gc.createRadialGradient(x + w / 2, y + h * 0.4, Math.min(w, h) * 0.3, x + w / 2, y + h * 0.5, Math.hypot(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(255,225,170,0.18)'); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,5,0,0.6)');
    gc.fillStyle = gr; gc.fillRect(0, 0, W, H);
    // la sombra del escenario sobre la mesa
    gc.save(); gc.shadowColor = 'rgba(10,5,0,0.6)'; gc.shadowBlur = m * 3; gc.shadowOffsetY = m * 1.2;
    gc.fillStyle = '#3a2414'; gc.fillRect(x - m, y - m, w + 2 * m, h + 2 * m); gc.restore();
    // el marco de madera, con la veta y el canto claro
    const gm = gc.createLinearGradient(0, y - m, 0, y + h + m);
    gm.addColorStop(0, '#8a5a36'); gm.addColorStop(1, '#5e3b22');
    gc.fillStyle = gm; gc.fillRect(x - m, y - m, w + 2 * m, h + 2 * m);
    gc.strokeStyle = 'rgba(255,220,170,0.25)'; gc.lineWidth = Math.max(1, m * 0.2); gc.strokeRect(x - m + m * 0.2, y - m + m * 0.2, w + 2 * m - m * 0.4, h + 2 * m - m * 0.4);
    gc.fillStyle = 'rgba(0,0,0,0.5)'; gc.fillRect(x - 1, y - 1, w + 2, h + 2);
    return cv;
  });
  g.drawImage(c, 0, 0);
}
// adentro del escenario, arriba de todo: la sombra del marco sobre el set (profundidad)
export function sombraMarco(g, cam) {
  const { ts } = cam, w = COLS * ts, h = FILAS * ts;
  const c = guardado(`sombraMarco:${ts}`, () => {
    olvidar('sombraMarco:');
    const cv = lienzo(w, h), gc = cv.getContext('2d'), s = ts * 0.35;
    for (const [x0, y0, x1, y1, ww, hh] of [[0, 0, 0, s, w, s], [0, 0, s, 0, s, h], [w, 0, w - s, 0, s, h]]) {
      const gr = gc.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(20,10,0,0.35)'); gr.addColorStop(1, 'rgba(20,10,0,0)');
      gc.fillStyle = gr; gc.fillRect(x0 === w ? w - s : 0, 0, ww, hh);
    }
    return cv;
  });
  g.drawImage(c, cam.x, cam.y);
}

// ── la claqueta ─────────────────────────────────────────────────────────────
// (x, y) el centro; `abre` 0 = cerrada, 1 = abierta del todo
function claqueta(g, x, y, w, { escena, toma, nombre, abre = 0, u = 1, chica = false }) {
  const h = w * (chica ? 0.42 : 0.62), barra = w * 0.13;
  g.save(); g.translate(x, y);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 10 * u; g.shadowOffsetY = 5 * u;
  g.fillStyle = '#26262b'; redondo(g, -w / 2, -h / 2 + barra, w, h - barra, 5 * u); g.fill(); g.restore();
  // las rayas de tiza del tablero
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = Math.max(1, 1.4 * u);
  const y1 = -h / 2 + barra + (h - barra) * (chica ? 0.5 : 0.36);
  g.beginPath(); g.moveTo(-w / 2 + 6 * u, y1); g.lineTo(w / 2 - 6 * u, y1); if (!chica) { g.moveTo(-w / 2 + 6 * u, y1 + (h - barra) * 0.34); g.lineTo(w / 2 - 6 * u, y1 + (h - barra) * 0.34); } g.moveTo(w * 0.06, -h / 2 + barra + 4 * u); g.lineTo(w * 0.06, y1); g.stroke();
  const tiza = (txt, px, tx, ty, al = 'center', max = w * 0.42) => { g.font = `700 ${Math.round(px)}px "Chalkboard SE", "Comic Sans MS", "Segoe Print", system-ui, sans-serif`; g.textAlign = al; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillText(txt, tx, ty, max); };
  const fila1 = -h / 2 + barra + (y1 - (-h / 2 + barra)) / 2;
  tiza(escena, (chica ? 0.15 : 0.11) * w, -w * 0.22, fila1);
  tiza(toma, (chica ? 0.12 : 0.11) * w, w * 0.28, fila1);
  if (!chica && nombre) tiza(nombre, w * 0.085, 0, y1 + (h - barra) * 0.17, 'center', w * 0.9);
  if (!chica) { g.globalAlpha = 0.55; tiza('JXSTUDIOS · GRUMO', w * 0.05, 0, y1 + (h - barra) * 0.5, 'center', w * 0.9); g.globalAlpha = 1; }
  // el palo de arriba, a rayas, que se abre desde la bisagra de la izquierda
  g.save(); g.translate(-w / 2, -h / 2 + barra); g.rotate(-abre * 0.5);
  g.fillStyle = '#26262b'; redondo(g, 0, -barra, w, barra, 3 * u); g.fill();
  g.save(); redondo(g, 0, -barra, w, barra, 3 * u); g.clip();
  g.fillStyle = '#f4f1ea';
  for (let k = -1; k < 8; k++) { g.beginPath(); g.moveTo(k * w * 0.14, 0); g.lineTo(k * w * 0.14 + w * 0.07, 0); g.lineTo(k * w * 0.14 + w * 0.12, -barra); g.lineTo(k * w * 0.14 + w * 0.05, -barra); g.closePath(); g.fill(); }
  g.restore();
  g.fillStyle = '#9a9aa2'; g.beginPath(); g.arc(barra * 0.4, -barra * 0.5, barra * 0.18, 0, Math.PI * 2); g.fill();
  g.restore();
  g.restore();
}
// la claqueta chica de arriba: golpea cuando cambia la toma (`golpe` = hace cuánto)
export function dibujarClaqueta(g, W, arriba, u, { escena, toma, golpe = 9, corten = false }) {
  const w = Math.min(W * 0.46, 190 * u), abre = golpe < 0.16 ? 1 - golpe / 0.16 : 0;
  claqueta(g, W / 2, arriba + w * 0.24, w, { escena, toma, abre: golpe < 0.08 ? 1 : abre * 0.9, u, chica: true });
  if (corten) {
    g.save(); g.translate(W / 2, arriba + w * 0.62); g.rotate(-0.06);
    g.font = `900 ${Math.round(w * 0.16)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#e4553f'; g.fillText(corten, 0, 0);
    g.restore();
  }
}
// la grande del principio: baja, se abre, golpea (¡acción!) y se va. `t` desde que empezó.
export const CLAQUETA = { baja: 0.25, golpe: 0.62, sube: 0.95 };
export function dibujarClaquetaGrande(g, W, H, u, t, datos) {
  const w = Math.min(W * 0.78, 360 * u), q = Math.floor(t * 12) / 12;
  let y = H * 0.4;
  if (q < CLAQUETA.baja) y = -w + (H * 0.4 + w) * (q / CLAQUETA.baja);
  else if (q > CLAQUETA.golpe + 0.12) y = H * 0.4 - (H * 0.4 + w) * clamp((q - CLAQUETA.golpe - 0.12) / (CLAQUETA.sube - CLAQUETA.golpe - 0.12), 0, 1);
  const abre = q < CLAQUETA.baja ? 0.6 : q < CLAQUETA.golpe ? 0.6 + 0.4 * clamp((q - CLAQUETA.baja) / 0.2, 0, 1) : 0;
  g.save();
  g.fillStyle = `rgba(10,5,0,${0.35 * (1 - clamp((q - CLAQUETA.golpe) / 0.3, 0, 1))})`; g.fillRect(0, 0, W, H);
  claqueta(g, W / 2, y, w, { ...datos, abre, u });
  g.restore();
}

// ── los botones de plastilina ───────────────────────────────────────────────
function botonPieza(tipo, r, color) {
  return guardado(`boton:${tipo}:${r}`, () => armarPieza(r * 2, r * 2, () => {
    const p = new Path2D(); p.ellipse(r, r, r, r * 0.92, 0, 0, Math.PI * 2); return p;
  }, color, { px: r * 1.1, semilla: tipo.length * 7, borroso: r * 0.12, luz: 0.6, brillo: 0.4, textura: 0.7,
    encima: (g, m) => {
      // la flecha (o el salto), hundida en la plastilina
      g.save(); g.translate(m + r, m + r * 0.96);
      const flecha = () => {
        g.beginPath();
        if (tipo === 'salto') { g.moveTo(0, -r * 0.46); g.lineTo(r * 0.4, r * 0.02); g.lineTo(r * 0.16, r * 0.02); g.lineTo(r * 0.16, r * 0.4); g.lineTo(-r * 0.16, r * 0.4); g.lineTo(-r * 0.16, r * 0.02); g.lineTo(-r * 0.4, r * 0.02); }
        else { const d = tipo === 'izq' ? -1 : 1; g.moveTo(d * r * 0.46, 0); g.lineTo(d * r * 0.02, -r * 0.4); g.lineTo(d * r * 0.02, -r * 0.16); g.lineTo(-d * r * 0.4, -r * 0.16); g.lineTo(-d * r * 0.4, r * 0.16); g.lineTo(d * r * 0.02, r * 0.16); g.lineTo(d * r * 0.02, r * 0.4); }
        g.closePath();
      };
      g.lineJoin = 'round';
      g.fillStyle = rgba(tono(color, -0.5), 0.9); g.save(); g.translate(-r * 0.03, -r * 0.04); flecha(); g.fill(); g.restore();
      g.fillStyle = rgba(tono(color, 0.55), 0.8); g.save(); g.translate(r * 0.03, r * 0.05); flecha(); g.fill(); g.restore();
      g.fillStyle = tono(color, -0.25); flecha(); g.fill();
      g.restore();
    } }));
}
// dónde van los botones (en píxeles del lienzo) según la pantalla
export function lugarBotones(W, H, cam, u, abajoSeguro) {
  const acostado = W > H * 1.1;
  if (acostado) {
    const izqL = cam.x - 12 * u, derL = W - (cam.x + COLS * cam.ts) - 12 * u;
    const r = Math.min(52 * u, izqL * 0.22, H * 0.13), yb = H - abajoSeguro - r * 1.6;
    return { r, izq: [izqL * 0.3, yb], der: [izqL * 0.72, yb], salto: [W - derL * 0.5, yb], rs: r * 1.25 };
  }
  const r = Math.min(46 * u, W * 0.11), yb = H - abajoSeguro - r * 1.35;
  return { r, izq: [W * 0.15, yb], der: [W * 0.38, yb], salto: [W * 0.8, yb], rs: r * 1.25 };
}
export function dibujarBotones(g, lugar, apretados) {
  const { r, rs } = lugar;
  for (const [tipo, [x, y], rr, color] of [['izq', lugar.izq, r, '#f2c230'], ['der', lugar.der, r, '#f2c230'], ['salto', lugar.salto, rs, '#e4553f']]) {
    const pz = botonPieza(tipo, Math.round(rr), color), abajo = apretados.has(tipo);
    // apretado: se hunde y se aplasta un poco (es plastilina)
    g.save(); g.translate(x, y + (abajo ? rr * 0.08 : 0)); g.scale(abajo ? 1.06 : 1, abajo ? 0.9 : 1);
    if (!abajo) g.drawImage(pz.sombra, -rr - pz.m + rr * 0.06, -rr - pz.m + rr * 0.12);
    g.drawImage(pz.img, -rr - pz.m, -rr - pz.m);
    g.restore();
  }
}

// ── la nota de ayuda (un papelito abajo del set) ───────────────────────────
export function dibujarAyuda(g, W, cam, u, texto, alfa) {
  if (!texto || alfa <= 0.01) return;
  g.save(); g.globalAlpha = alfa;
  const fs = Math.round(15 * u);
  g.font = `700 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const lineas = partir(g, texto, Math.min(COLS * cam.ts * 0.86, 320 * u));
  const aw = Math.max(...lineas.map((l) => g.measureText(l).width)) + 28 * u, ah = lineas.length * fs * 1.3 + 20 * u;
  const ax = cam.x + (COLS * cam.ts) / 2, ay = cam.y + FILAS * cam.ts * 0.2;
  g.translate(ax, ay + (1 - alfa) * 16 * u); g.rotate(-0.02);
  g.fillStyle = 'rgba(40,20,5,0.3)'; g.fillRect(-aw / 2 + 3 * u, -ah / 2 + 4 * u, aw, ah);
  g.fillStyle = '#fff3b8'; g.fillRect(-aw / 2, -ah / 2, aw, ah);
  g.fillStyle = 'rgba(250,235,180,0.85)'; g.save(); g.translate(0, -ah / 2); g.rotate(0.05); g.fillRect(-22 * u, -6 * u, 44 * u, 12 * u); g.restore();
  g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lineas.forEach((l, k) => g.fillText(l, 0, -ah / 2 + 10 * u + fs * 1.3 * (k + 0.5)));
  g.restore();
}
function partir(g, texto, ancho) {
  const out = []; let linea = '';
  for (const pal of texto.split(' ')) {
    const prueba = linea ? linea + ' ' + pal : pal;
    if (g.measureText(prueba).width > ancho && linea) { out.push(linea); linea = pal; } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}
// la luz apagada: todo oscuro menos un poquito alrededor de Grumo (los ojos brillan)
export function dibujarOscuro(g, cam, x, y, k) {
  if (k <= 0) return;
  const { ts } = cam, w = COLS * ts, h = FILAS * ts;
  g.save();
  g.beginPath(); g.rect(cam.x, cam.y, w, h); g.clip();
  const gr = g.createRadialGradient(x, y, ts * 0.4, x, y, ts * 2.2);
  gr.addColorStop(0, `rgba(5,3,10,${0.5 * k})`); gr.addColorStop(1, `rgba(5,3,10,${0.96 * k})`);
  g.fillStyle = gr; g.fillRect(cam.x, cam.y, w, h);
  g.restore();
}
export { hash };
