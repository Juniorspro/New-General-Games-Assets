// Los fondos de la arena: cada uno es una baldosa que se dibuja una vez y se
// repite como patrón (con la cámara y el zoom puestos en la transformación del
// patrón: un solo fillRect por cuadro, sin importar cuánto se ve).
export const FONDOS = ['colmena', 'carbono', 'circuito', 'galaxia', 'magma'];

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Hexágonos de tapa plana. Con lado 26, la altura (√3·26 = 45,03) es casi
// entera y la baldosa de 78 × 45 repite sin costura visible.
function colmena() {
  const s = 26, h = Math.sqrt(3) * s, [c, g] = lienzo(78, 45);
  g.fillStyle = '#0c1019'; g.fillRect(0, 0, 78, 45);
  const hex = (cx, cy) => {
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; g.lineTo(cx + Math.cos(a) * (s - 2.2), cy + Math.sin(a) * (s - 2.2)); }
    g.closePath();
    const gr = g.createLinearGradient(cx, cy - s, cx, cy + s);
    gr.addColorStop(0, '#26304a'); gr.addColorStop(0.5, '#1c2437'); gr.addColorStop(1, '#161d2d');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(120,150,210,0.10)'; g.lineWidth = 1.2; g.stroke();
  };
  for (let i = -1; i <= 3; i++) for (let j = -1; j <= 2; j++) hex(i * 1.5 * s, j * h + (i & 1 ? h / 2 : 0));
  return { c, escala: 1.6 };
}

// Fibra de carbono (la de JXSTUDIOS): sarga 2 × 2 con un brillo en diagonal.
function carbono() {
  const [c, g] = lienzo(32, 32);
  for (let y = 0; y < 32; y += 4) for (let x = 0; x < 32; x += 4) {
    const sarga = ((x >> 2) + (y >> 2)) % 4 < 2;
    const gr = g.createLinearGradient(x, y, x + (sarga ? 4 : 0), y + (sarga ? 0 : 4));
    gr.addColorStop(0, sarga ? '#2a2c31' : '#1a1b1f'); gr.addColorStop(1, sarga ? '#1d1e22' : '#26282d');
    g.fillStyle = gr; g.fillRect(x, y, 4, 4);
  }
  return { c, escala: 1.4 };
}

// Un circuito de neón: pistas a 45° con sus pads.
function circuito() {
  const [c, g] = lienzo(256, 256);
  g.fillStyle = '#05100f'; g.fillRect(0, 0, 256, 256);
  let semilla = 11;
  const r = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const pistas = [];
  for (let k = 0; k < 22; k++) {
    let x = Math.round(r() * 16) * 16, y = Math.round(r() * 16) * 16;
    const p = [[x, y]];
    for (let s = 0; s < 4; s++) {
      const dir = Math.floor(r() * 8), l = 16 + Math.floor(r() * 4) * 16;
      const ang = (dir * Math.PI) / 4;
      x += Math.round(Math.cos(ang)) * l; y += Math.round(Math.sin(ang)) * l;
      p.push([x, y]);
    }
    pistas.push(p);
  }
  const trazar = (ancho, color) => {
    g.strokeStyle = color; g.lineWidth = ancho; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of pistas) for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy))); g.stroke();
    }
  };
  trazar(7, 'rgba(0,255,200,0.06)');
  trazar(2, 'rgba(0,255,200,0.28)');
  g.fillStyle = 'rgba(120,255,230,0.55)';
  for (const p of pistas) { const [x, y] = p[p.length - 1]; g.beginPath(); g.arc((x + 256) % 256, (y + 256) % 256, 3, 0, Math.PI * 2); g.fill(); }
  return { c, escala: 1.5 };
}

function galaxia() {
  const [c, g] = lienzo(512, 512);
  g.fillStyle = '#07061a'; g.fillRect(0, 0, 512, 512);
  let semilla = 5;
  const r = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  // nubes de color (repetidas en los bordes para que la baldosa cierre)
  for (let k = 0; k < 7; k++) {
    const x = r() * 512, y = r() * 512, rad = 90 + r() * 140, col = ['rgba(120,40,200,', 'rgba(30,80,200,', 'rgba(200,40,140,'][k % 3];
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, col + '0.22)'); gr.addColorStop(1, col + '0)');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    }
  }
  for (let k = 0; k < 420; k++) {
    const x = r() * 512, y = r() * 512, b = r();
    g.fillStyle = `rgba(255,255,255,${0.25 + b * 0.6})`;
    g.fillRect(x, y, b > 0.92 ? 2 : 1, b > 0.92 ? 2 : 1);
    if (b > 0.985) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 3, y + 0.5, 8, 1); g.fillRect(x + 0.5, y - 3, 1, 8); }
  }
  return { c, escala: 1.8 };
}

function magma() {
  const [c, g] = lienzo(256, 256);
  g.fillStyle = '#140c0a'; g.fillRect(0, 0, 256, 256);
  let semilla = 23;
  const r = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  // piedras oscuras y las grietas de brasa entre ellas
  for (let k = 0; k < 40; k++) {
    const x = r() * 256, y = r() * 256, rad = 12 + r() * 26;
    g.fillStyle = `rgb(${28 + (r() * 14) | 0},${18 + (r() * 8) | 0},${16})`;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.beginPath(); g.ellipse(x + ox, y + oy, rad, rad * 0.8, r() * 3, 0, Math.PI * 2); g.fill(); }
  }
  g.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    let x = r() * 256, y = r() * 256;
    const p = [[x, y]];
    for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; p.push([x, y]); }
    for (const [w, col] of [[6, 'rgba(255,80,0,0.10)'], [2, 'rgba(255,120,20,0.55)'], [1, 'rgba(255,220,120,0.6)']]) {
      g.strokeStyle = col; g.lineWidth = w;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.beginPath(); p.forEach(([a, b], i) => (i ? g.lineTo(a + ox, b + oy) : g.moveTo(a + ox, b + oy))); g.stroke(); }
    }
  }
  return { c, escala: 1.7 };
}

const HACER = { colmena, carbono, circuito, galaxia, magma };
const cache = new Map();

// El patrón listo para pintar con la cámara puesta.
export function fondo(id, g) {
  if (!cache.has(id)) {
    const f = (HACER[id] || colmena)();
    f.patron = g.createPattern(f.c, 'repeat');
    cache.set(id, f);
  }
  return cache.get(id);
}

export function pintarFondo(g, id, cam, W, H) {
  const f = fondo(id, g), k = f.escala * cam.zoom;
  f.patron.setTransform(new DOMMatrix([k, 0, 0, k, W / 2 - cam.x * cam.zoom, H / 2 - cam.y * cam.zoom]));
  g.fillStyle = f.patron;
  g.fillRect(0, 0, W, H);
}

// Una miniatura para el selector de fondos.
export const baldosa = (id) => (HACER[id] || colmena)().c;
