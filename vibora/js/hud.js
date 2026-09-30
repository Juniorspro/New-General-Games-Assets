// Lo que se lee jugando: la tabla de las diez más largas, el minimapa, tu
// largo y tu puesto, y los carteles de lo que pasa (a quién comiste). Todo
// en el lienzo, en píxeles de pantalla (esc = píxeles por punto CSS).
const FUENTE = (px, peso = 700) => `${peso} ${Math.round(px)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const miles = (n) => Math.floor(n).toLocaleString('es-AR');

// La tabla son unos treinta textos: se escriben en un lienzo aparte cuatro
// veces por segundo y cada cuadro solo se copia (escribir texto por cuadro es
// de lo más caro en el teléfono). Lo mismo "tu largo", cuando cambia.
const tablaC = { c: null, hasta: 0, clave: '' }, largoC = { c: null, clave: '' };

export function dibujarHud(g, W, H, { mundo, mia, esc = 1, tr, avisos = [], tabla = null, turboBoton = null, pausa = null, joystick = null }) {
  const m = 16 * esc;             // el mismo margen de 16 px que los menús
  // ── la tabla ──
  const top = tabla || mundo.tabla();
  const filas = top.slice(0, 10), puesto = mia ? top.indexOf(mia) + 1 : 0;
  const fs = 12.5 * esc, alto = fs * 1.35;
  const anchoT = Math.min(W * 0.46, 190 * esc), x0 = W - anchoT - m, y0 = m;
  const n = filas.length + (mia && puesto > 10 ? 1 : 0);
  const ahora = performance.now(), clave = `${Math.round(anchoT)}|${esc}|${n}|${tr('tabla')}`;
  if (!tablaC.c || ahora >= tablaC.hasta || tablaC.clave !== clave) {
    tablaC.clave = clave; tablaC.hasta = ahora + 250;
    const c = tablaC.c || (tablaC.c = document.createElement('canvas'));
    c.width = Math.ceil(anchoT); c.height = Math.ceil(alto * (n + 1.4));
    const q = c.getContext('2d');
    q.fillStyle = 'rgba(8,10,18,0.55)';
    redondo(q, 0, 0, anchoT, alto * (n + 1.4), 8 * esc); q.fill();
    q.font = FUENTE(fs, 800); q.textBaseline = 'middle'; q.textAlign = 'left';
    q.fillStyle = '#ffd35c'; q.fillText(tr('tabla'), 10 * esc, alto * 0.8);
    const fila = (i, v, y, destacar) => {
      q.font = FUENTE(fs * 0.92, destacar ? 800 : 600);
      q.fillStyle = destacar ? '#ffffff' : 'rgba(255,255,255,0.72)';
      // el puesto alineado a la derecha: "#10" no se pega al nombre
      q.textAlign = 'right'; q.fillText(`#${i}`, 34 * esc, y);
      q.textAlign = 'left'; q.fillText(recortar(q, v.nombre, anchoT - 96 * esc), 40 * esc, y);
      q.textAlign = 'right'; q.fillText(miles(v.masa), anchoT - 10 * esc, y);
    };
    filas.forEach((v, k) => fila(k + 1, v, alto * (k + 1.8), v === mia));
    if (mia && puesto > 10) fila(puesto, mia, alto * (filas.length + 1.8), true);
  }
  g.drawImage(tablaC.c, Math.round(x0), Math.round(y0));
  // ── tu largo y tu puesto ──
  if (mia) {
    const largo = `${tr('largo')}: ${miles(mia.masa)}`, suPuesto = tr('puesto', { n: puesto, de: top.length });
    const clave = `${esc}|${largo}|${suPuesto}`;
    if (!largoC.c || largoC.clave !== clave) {
      largoC.clave = clave;
      const c = largoC.c || (largoC.c = document.createElement('canvas'));
      c.width = Math.ceil(Math.min(W, 420 * esc)); c.height = Math.ceil(46 * esc);
      const q = c.getContext('2d');
      q.textAlign = 'left'; q.textBaseline = 'alphabetic';
      q.font = FUENTE(22 * esc, 900);
      sombreado(q, largo, 4 * esc, 24 * esc, '#ffffff');
      q.font = FUENTE(13 * esc, 700);
      sombreado(q, suPuesto, 4 * esc, 42 * esc, 'rgba(255,255,255,0.75)');
    }
    g.drawImage(largoC.c, Math.round(m), Math.round(H - m - 46 * esc));
  }
  // ── el minimapa ──
  const rm = 44 * esc, cx = W - m - rm, cy = H - m - rm;
  g.fillStyle = 'rgba(8,10,18,0.6)'; g.beginPath(); g.arc(cx, cy, rm, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,60,90,0.7)'; g.lineWidth = 1.5 * esc; g.stroke();
  const k = rm / mundo.radio;
  g.fillStyle = 'rgba(255,255,255,0.28)';
  for (const v of top.slice(0, 12)) if (v !== mia) { g.beginPath(); g.arc(cx + v.x * k, cy + v.y * k, Math.max(1.2, Math.min(4, v.radio() * k * 3)) * esc * 0.9, 0, Math.PI * 2); g.fill(); }
  if (top[0] && top[0] !== mia) { g.fillStyle = '#ffd35c'; g.beginPath(); g.arc(cx + top[0].x * k, cy + top[0].y * k, 2.6 * esc, 0, Math.PI * 2); g.fill(); }
  if (mia) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx + mia.x * k, cy + mia.y * k, 3 * esc, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1 * esc; g.beginPath(); g.moveTo(cx + mia.x * k, cy + mia.y * k); g.lineTo(cx + mia.x * k + Math.cos(mia.ang) * 8 * esc, cy + mia.y * k + Math.sin(mia.ang) * 8 * esc); g.stroke();
  }
  // ── los carteles de arriba (en un teléfono parado la tabla ocupa el medio:
  // van debajo de ella) ──
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const yAvisos = x0 > W / 2 + 130 * esc ? 58 * esc : y0 + alto * (n + 1.4) + 24 * esc;
  avisos.forEach((a, i) => {
    const vida = Math.min(1, a.t / 0.25) * Math.min(1, (a.dura - a.t) / 0.4);
    g.globalAlpha = Math.max(0, vida);
    g.font = FUENTE((a.grande ? 20 : 15) * esc, 900);
    sombreado(g, a.txt, W / 2, yAvisos + i * 26 * esc, a.color || '#ffffff');
    g.globalAlpha = 1;
  });
  // ── los botones de pantalla (turbo y pausa) ──
  if (turboBoton) {
    const { x, y, r, activo } = turboBoton;
    g.fillStyle = activo ? 'rgba(255,211,92,0.55)' : 'rgba(255,255,255,0.14)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = activo ? '#ffd35c' : 'rgba(255,255,255,0.45)'; g.lineWidth = 2 * esc; g.stroke();
    // un rayo
    g.fillStyle = activo ? '#fff6d0' : 'rgba(255,255,255,0.8)';
    g.beginPath();
    const s = r * 0.5;
    g.moveTo(x + s * 0.15, y - s); g.lineTo(x - s * 0.55, y + s * 0.1); g.lineTo(x - s * 0.05, y + s * 0.1);
    g.lineTo(x - s * 0.2, y + s); g.lineTo(x + s * 0.55, y - s * 0.15); g.lineTo(x + s * 0.05, y - s * 0.15); g.closePath(); g.fill();
  }
  if (pausa) {
    const { x, y, r } = pausa;
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x - r * 0.3, y - r * 0.35, r * 0.2, r * 0.7); g.fillRect(x + r * 0.1, y - r * 0.35, r * 0.2, r * 0.7);
  }
  if (joystick) {
    const { x, y, dx, dy, r } = joystick;
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2 * esc; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(x + dx, y + dy, r * 0.4, 0, Math.PI * 2); g.fill();
  }
}

function sombreado(g, txt, x, y, color) {
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(txt, x + 1.5, y + 2);
  g.fillStyle = color; g.fillText(txt, x, y);
}

function recortar(g, txt, ancho) {
  if (g.measureText(txt).width <= ancho) return txt;
  let t = txt;
  while (t.length > 1 && g.measureText(t + '…').width > ancho) t = t.slice(0, -1);
  return t + '…';
}

export function redondo(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
