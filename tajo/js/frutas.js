/* ============================================================================
   Frutas en tinta sumi-e: sandía, frutilla, plátano, cereza, manzana, naranja,
   durazno, kiwi, limón, higo. Trazo vacío con relleno, se cortan en dos mitades
   con sangría clara de tinta. La bomba es un sprite sólido.
   ========================================================================== */

const FRUTAS = {
  sandia: { r: 28, col: '#2d5016', borde: '#8b0000', pts: 1, mitad: (r) => [{ r: r * 0.65, col: '#e8d8b8', borde: '#c41e3a', y: r * -0.2 }], bomba: false },
  frutilla: { r: 16, col: '#c41e3a', borde: '#8b0000', pts: 1, mitad: (r) => [{ r: r * 0.55, col: '#e8b8b8', y: r * -0.1 }], bomba: false },
  platano: { r: 14, col: '#ffd700', borde: '#c41e3a', pts: 1, mitad: (r) => [{ r: r * 0.45, col: '#fff8dc', y: r * -0.15 }], bomba: false },
  cereza: { r: 12, col: '#8b0000', borde: '#4a0000', pts: 1, mitad: (r) => [{ r: r * 0.5, col: '#d8a0a0', y: r * -0.05 }], bomba: false },
  manzana: { r: 20, col: '#c41e3a', borde: '#8b0000', pts: 1, mitad: (r) => [{ r: r * 0.6, col: '#f5d5a8', y: r * -0.12 }], bomba: false },
  naranja: { r: 22, col: '#ff8c00', borde: '#8b4513', pts: 1, mitad: (r) => [{ r: r * 0.62, col: '#ffd8a8', y: r * -0.15 }], bomba: false },
  durazno: { r: 19, col: '#ffa500', borde: '#d2691e', pts: 1, mitad: (r) => [{ r: r * 0.58, col: '#ffe8c8', y: r * -0.1 }], bomba: false },
  kiwi: { r: 18, col: '#556b2f', borde: '#2f4f2f', pts: 1, mitad: (r) => [{ r: r * 0.6, col: '#d8f5a8', y: r * -0.12 }, { r: r * 0.25, col: '#2f2f00', y: r * -0.15 }], bomba: false },
  limon: { r: 16, col: '#ffff00', borde: '#8b8b00', pts: 1, mitad: (r) => [{ r: r * 0.55, col: '#fffacd', y: r * -0.1 }], bomba: false },
  higo: { r: 17, col: '#663366', borde: '#330033', pts: 1, mitad: (r) => [{ r: r * 0.58, col: '#e8d8d8', y: r * -0.12 }], bomba: false },
  bomba: { r: 16, col: '#1a1a1a', borde: '#ffff00', pts: 0, mitad: (r) => [{ r: r * 0.4, col: '#333333', y: r * -0.05 }], bomba: true },
};

function dibujarFruta(g, tipo, x, y, ang, cortada, alfa) {
  const f = FRUTAS[tipo];
  if (!f) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.globalAlpha = alfa !== undefined ? alfa : 1;

  const r = f.r;
  g.lineCap = 'round'; g.lineJoin = 'round';

  if (cortada) {
    for (const m of f.mitad(r)) {
      g.fillStyle = m.col;
      g.beginPath(); g.arc(0, m.y || 0, m.r, 0, 6.28); g.fill();
      g.strokeStyle = m.borde || f.borde;
      g.lineWidth = 1.5;
      g.stroke();
    }
  } else {
    g.fillStyle = f.col;
    g.beginPath(); g.arc(0, 0, r, 0, 6.28); g.fill();
    g.strokeStyle = f.borde;
    g.lineWidth = 2.5;
    g.stroke();

    if (tipo === 'bomba') {
      g.strokeStyle = '#ffff00';
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(0, 0, r * 0.65, 0, 6.28); g.stroke();
      g.fillStyle = '#ffff00';
      g.fillRect(-r * 0.15, -r * 0.8, r * 0.3, r * 0.25);
      g.fillRect(-r * 0.08, -r * 0.55, r * 0.16, r * 0.15);
    }
  }

  g.restore();
}

function nuevoFruta(tipo, x, y, vx, vy) {
  const f = FRUTAS[tipo];
  return { id: Math.random(), tipo, x, y, vx: vx || 0, vy: vy || 0, r: f.r, rT: f.r, ang: Math.random() * 6.28, edad: 0, cortada: false, muerto: false, golpe: 0 };
}
