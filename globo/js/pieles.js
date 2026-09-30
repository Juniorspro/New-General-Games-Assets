// Los globos y los escudos de la tienda. Cada uno es un color y, si tiene,
// un dibujo que se pinta adentro (el globo ya viene recortado a su forma).
// Se compran con las monedas que junta el escudo.
const franjas = (colores, ancho) => (g, r, ry) => {
  g.save(); g.rotate(-0.5);
  colores.forEach((c, i) => { g.fillStyle = c; for (let x = -r * 3 + i * ancho; x < r * 3; x += ancho * colores.length) g.fillRect(x, -ry * 2, ancho, ry * 4); });
  g.restore();
};

export const GLOBOS = [
  { id: 'rojo', precio: 0, color: '#ff4d5e' },
  { id: 'azul', precio: 40, color: '#3d8bff' },
  { id: 'verde', precio: 40, color: '#2ecc71' },
  { id: 'amarillo', precio: 60, color: '#ffc93c' },
  { id: 'rosa', precio: 60, color: '#ff7eb6' },
  { id: 'violeta', precio: 90, color: '#9b5cff' },
  {
    id: 'rayas', precio: 150, color: '#3d8bff',
    dibujo: (g, r, ry) => franjas(['rgba(255,255,255,0.85)', 'rgba(0,0,0,0)'], r * 0.34)(g, r, ry),
  },
  {
    id: 'lunares', precio: 180, color: '#ff7eb6',
    dibujo: (g, r, ry) => {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let y = -ry; y <= ry; y += r * 0.55) for (let x = -r + ((y / (r * 0.55)) & 1 ? r * 0.27 : 0); x <= r; x += r * 0.55) { g.beginPath(); g.arc(x, y, r * 0.1, 0, Math.PI * 2); g.fill(); }
    },
  },
  {
    id: 'sandia', precio: 220, color: '#ff5a6e',
    dibujo: (g, r, ry) => {
      g.strokeStyle = '#2ecc71'; g.lineWidth = r * 0.28; g.beginPath(); g.ellipse(0, 0, r * 0.98, ry * 0.98, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#baf5a0'; g.lineWidth = r * 0.1; g.beginPath(); g.ellipse(0, 0, r * 0.84, ry * 0.84, 0, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#2a1a1a';
      for (const [x, y] of [[-0.3, -0.2], [0.25, -0.35], [0.05, 0.1], [-0.35, 0.3], [0.35, 0.25], [0, 0.5]]) { g.beginPath(); g.ellipse(x * r, y * ry, r * 0.05, r * 0.09, 0.3, 0, Math.PI * 2); g.fill(); }
    },
  },
  {
    id: 'arcoiris', precio: 350, color: '#ff4d5e',
    dibujo: (g, r, ry) => {
      const cs = ['#ff4d5e', '#ff9f43', '#ffd23f', '#2ecc71', '#3d8bff', '#9b5cff'];
      cs.forEach((c, i) => { g.fillStyle = c; g.fillRect(-r, -ry + (i * 2 * ry) / cs.length, r * 2, (2 * ry) / cs.length + 1); });
    },
  },
  {
    id: 'planeta', precio: 450, color: '#ff9f43',
    dibujo: (g, r, ry) => {
      g.fillStyle = '#e07b20'; for (const [y, h] of [[-0.5, 0.12], [-0.1, 0.18], [0.35, 0.1]]) g.fillRect(-r, y * ry, r * 2, h * ry);
      g.strokeStyle = '#fff1c1'; g.lineWidth = r * 0.12; g.beginPath(); g.ellipse(0, ry * 0.1, r * 1.2, ry * 0.2, -0.3, 0, Math.PI * 2); g.stroke();
    },
  },
  {
    id: 'oro', precio: 700, color: '#ffc93c',
    dibujo: (g, r, ry, t) => {
      const x = ((t * 0.8) % 2) * r * 2.4 - r * 1.2;
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.save(); g.rotate(0.5); g.fillRect(x, -ry * 2, r * 0.3, ry * 4); g.restore();
    },
  },
  {
    id: 'jx', precio: 1000, color: '#1c1e24', hilo: 'rgba(200,205,215,0.7)',
    dibujo: (g, r) => {
      // las letras JX de JXSTUDIOS, en blanco
      g.fillStyle = '#e9ebf0'; g.font = `900 ${Math.round(r * 0.9)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('JX', 0, r * 0.05);
    },
  },
];

export const ESCUDOS = [
  { id: 'blanco', precio: 0, color: '#ffffff' },
  { id: 'burbuja', precio: 50, color: '#7fe3ff', relleno: 'rgba(127,227,255,0.28)' },
  { id: 'menta', precio: 80, color: '#2ecc9a', relleno: 'rgba(46,204,154,0.22)' },
  { id: 'fuego', precio: 150, color: '#ff7a3d', relleno: 'rgba(255,122,61,0.25)' },
  {
    id: 'hielo', precio: 200, color: '#bfe9ff', relleno: 'rgba(191,233,255,0.35)',
    dibujo: (g, x, y, r) => {
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = r * 0.08;
      for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3; g.beginPath(); g.moveTo(x - Math.cos(a) * r * 0.5, y - Math.sin(a) * r * 0.5); g.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); g.stroke(); }
    },
  },
  {
    id: 'galleta', precio: 260, color: '#c98a4b', relleno: 'rgba(201,138,75,0.6)', borde: 'rgba(90,50,20,0.25)',
    dibujo: (g, x, y, r) => {
      g.fillStyle = '#5a3417';
      for (const [dx, dy] of [[-0.3, -0.25], [0.3, -0.1], [-0.05, 0.3], [0.1, -0.45], [-0.4, 0.2]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, r * 0.1, 0, Math.PI * 2); g.fill(); }
    },
  },
  {
    id: 'rueda', precio: 400, color: '#3d4466', relleno: 'rgba(61,68,102,0.25)',
    dibujo: (g, x, y, r, t) => {
      g.strokeStyle = '#ffd23f'; g.lineWidth = r * 0.09;
      for (let k = 0; k < 4; k++) { const a = t * 3 + (k * Math.PI) / 4; g.beginPath(); g.moveTo(x - Math.cos(a) * r * 0.75, y - Math.sin(a) * r * 0.75); g.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); g.stroke(); }
    },
  },
  {
    id: 'arcoiris', precio: 600, color: '#ffffff',
    dibujo: (g, x, y, r, t) => {
      const cs = ['#ff4d5e', '#ff9f43', '#ffd23f', '#2ecc71', '#3d8bff', '#9b5cff'];
      g.lineWidth = r * 0.22;
      cs.forEach((c, i) => { const a = t * 1.5 + (i / cs.length) * Math.PI * 2; g.strokeStyle = c; g.beginPath(); g.arc(x, y, r * 0.88, a, a + (Math.PI * 2) / cs.length + 0.02); g.stroke(); });
    },
  },
];

export const globoPorId = (id) => GLOBOS.find((p) => p.id === id) || GLOBOS[0];
export const escudoPorId = (id) => ESCUDOS.find((p) => p.id === id) || ESCUDOS[0];
