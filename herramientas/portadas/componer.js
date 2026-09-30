// Arma cada portada: la ilustración de Rezona recortada a 2:3, el título con
// el mismo código que lo dibuja en el juego, y el logo JXS en el estilo del
// juego (papel, píxel, cromo, plano, caricatura). ?juego=morfi
import { TRAZOS, CAJA, GROSOR, camino2d } from '/morfi/js/logojxs.js';

const W = 1024, H = 1536;
const q = new URLSearchParams(location.search), juego = q.get('juego');
const c = document.getElementById('c'); c.width = W; c.height = H;
const g = c.getContext('2d');

const cargar = (src) => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });
function cubrir(img, fx = 0.5, fy = 0.5) {
  const s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, (W - w) * fx, (H - h) * fy, w, h);
}
// el monograma con trazos: `capas` es la lista de pasadas [grosor extra, color, dx, dy] por trazo;
// `colores` (opcional) pinta cada trazo de su color en la última pasada
function monogramaTrazos(x0, y0, ancho, pasadas, { colores = null, gap = null } = {}) {
  const esc = ancho / CAJA.w;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const capa of [0, 1]) for (const t of TRAZOS) {
    if (t.capa !== capa) continue;
    const p = camino2d(t, esc, x0, y0);
    // el hueco del cruce: la B pasa por encima de la A con un borde del color de atrás
    if (capa === 1 && gap) { g.lineWidth = GROSOR * esc + gap[0] * esc; g.strokeStyle = gap[1]; g.stroke(p); }
    pasadas.forEach(([extra, color, dx = 0, dy = 0], k) => {
      g.save(); g.translate(dx * esc, dy * esc);
      g.lineWidth = GROSOR * esc + extra * esc;
      g.strokeStyle = colores && k === pasadas.length - 1 ? colores[t.id] : color;
      g.stroke(p); g.restore();
    });
  }
  g.restore();
  return { w: ancho, h: CAJA.h * esc };
}
function texto(txt, x, y, px, { fuente = 'system-ui', peso = 900, relleno = '#fff', borde = null, bordeAncho = 0, sombra = null, sombraD = [0, 0], alinear = 'center', italica = false, espacio = 0 } = {}) {
  g.save();
  g.font = `${italica ? 'italic ' : ''}${peso} ${px}px ${fuente}`;
  g.textAlign = alinear; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (espacio) g.letterSpacing = `${espacio}px`;
  if (sombra) { g.fillStyle = sombra; if (borde) { g.lineWidth = bordeAncho; g.strokeStyle = sombra; g.strokeText(txt, x + sombraD[0], y + sombraD[1]); } g.fillText(txt, x + sombraD[0], y + sombraD[1]); }
  if (borde) { g.lineWidth = bordeAncho; g.strokeStyle = borde; g.strokeText(txt, x, y); }
  g.fillStyle = relleno; g.fillText(txt, x, y);
  g.restore();
}

function redondeado(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function placa(x, y, w, h, r, fondo, borde) {
  g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
  redondeado(x, y, w, h, r); g.fillStyle = fondo; g.fill(); g.restore();
  if (borde) { g.lineWidth = 3; g.strokeStyle = borde; redondeado(x + 1.5, y + 1.5, w - 3, h - 3, r); g.stroke(); }
}
// una tabla de madera como los carteles de la isla: tres tablones con vetas y clavos
function tabla(x, y, w, h) {
  g.save(); g.shadowColor = 'rgba(20,10,0,0.55)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
  g.fillStyle = '#6b4424'; g.fillRect(x, y, w, h); g.restore();
  const n = 3, th = h / n;
  for (let k = 0; k < n; k++) {
    const gr = g.createLinearGradient(0, y + k * th, 0, y + (k + 1) * th);
    gr.addColorStop(0, '#9a6a3c'); gr.addColorStop(1, '#7a5230');
    g.fillStyle = gr; g.fillRect(x + 4, y + k * th + 3, w - 8, th - 6);
    g.strokeStyle = 'rgba(60,35,15,0.35)'; g.lineWidth = 2;
    for (let v = 0; v < 3; v++) { g.beginPath(); g.moveTo(x + 10, y + k * th + th * (0.3 + v * 0.2)); g.bezierCurveTo(x + w * 0.3, y + k * th + th * (0.2 + v * 0.22), x + w * 0.7, y + k * th + th * (0.4 + v * 0.18), x + w - 10, y + k * th + th * (0.3 + v * 0.2)); g.stroke(); }
  }
  g.fillStyle = '#c9ccd4'; for (const [a, b] of [[x + 14, y + 12], [x + w - 14, y + 12], [x + 14, y + h - 12], [x + w - 14, y + h - 12]]) { g.beginPath(); g.arc(a, b, 5, 0, Math.PI * 2); g.fill(); }
}

const PORTADAS = {
  // ── MORFI: el diorama de cartón, el cartel del menú colgado y el logo en una nota de papel ──
  async morfi(img) {
    cubrir(img, 0.5, 0.5);
    const { FondoMenu } = await import('/morfi/js/menu.js');
    const fm = new FondoMenu();
    // el cartel cuelga de más arriba del cuadro (los alfileres quedan afuera): entra en la franja
    // lisa de arriba sin tapar el caramelo ni el hilo, que son lo principal del dibujo
    const ancho = 560;
    fm.dibujarCartel(g, W * 0.5, 36, ancho, 2.2, 'Cortá el hilo');
    // la nota de papel con cinta, abajo a la derecha (tapa el rincón liso de la ilustración)
    // la nota sale un poco del cuadro (pegada en la esquina) y tapa entero el rincón liso del dibujo
    const nw = 362, nh = 292, nx = W - 168, ny = H - 138;
    g.save(); g.translate(nx, ny); g.rotate(-0.045);
    g.shadowColor = 'rgba(40,20,5,0.45)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
    g.fillStyle = '#fbf6ea'; g.fillRect(-nw / 2, -nh / 2, nw, nh); g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(120,150,190,0.22)'; g.lineWidth = 2;
    for (let y = -nh / 2 + 40; y < nh / 2; y += 30) { g.beginPath(); g.moveTo(-nw / 2, y); g.lineTo(nw / 2, y); g.stroke(); }
    for (const [x, a] of [[-nw * 0.38, -0.5], [nw * 0.38, 0.45]]) { g.save(); g.translate(x, -nh / 2); g.rotate(a); g.fillStyle = 'rgba(250,240,200,0.85)'; g.fillRect(-40, -13, 80, 26); g.restore(); }
    const ancho2 = 250, esc = ancho2 / CAJA.w;
    g.translate(-14, -14);
    monogramaTrazos(-ancho2 / 2, -nh / 2 + 34, ancho2, [[5, 'rgba(40,20,5,0.3)', 2.5, 4], [5, '#ffffff'], [0, '#000']], { colores: { A: '#e8423a', J: '#f5c542', S: '#3f7fd1', B: '#58b368' } });
    // JXStudios en recortes de revista
    const REC = [['#1f2126', '#fff', 'serif'], ['#f5c542', '#1f2126', 'sans'], ['#fff', '#e8423a', 'serif'], ['#3f7fd1', '#fff', 'sans'], ['#f7d6e0', '#1f2126', 'serif'], ['#58b368', '#fff', 'sans'], ['#fff', '#1f2126', 'sans'], ['#e8423a', '#fff', 'serif'], ['#f5c542', '#3f7fd1', 'sans']];
    const txt = 'JXStudios', px = 34, yl = -nh / 2 + 34 + CAJA.h * esc + 40;
    const anchos = [...txt].map((ch) => px * (ch === 'i' ? 0.52 : 0.84)), total = anchos.reduce((a, b) => a + b, 0) + 3 * 8;
    let x = -total / 2;
    [...txt].forEach((ch, k) => {
      const [f, l, tipo] = REC[k], giro = [(0.1), -0.08, 0.06, -0.12, 0.09, -0.05, 0.11, -0.07, 0.04][k];
      g.save(); g.translate(x + anchos[k] / 2, yl + (k % 2 ? -3 : 3)); g.rotate(giro);
      g.fillStyle = 'rgba(40,20,5,0.25)'; g.fillRect(-anchos[k] / 2 + 2, -px * 0.6 + 3, anchos[k], px * 1.2);
      g.fillStyle = f; g.fillRect(-anchos[k] / 2, -px * 0.6, anchos[k], px * 1.2);
      g.fillStyle = l; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = tipo === 'serif' ? `italic 700 ${px}px Georgia, serif` : `900 ${px}px system-ui, sans-serif`;
      g.fillText(ch, 0, 2); g.restore();
      x += anchos[k] + 3;
    });
    g.restore();
  },

  // ── CRIPTA NEÓN: píxeles; el cartel de neón del menú con sus cadenas y el JXS de píxeles ──
  async cripta(img) {
    cubrir(img, 0.5, 0.45);
    const { cartelTitulo } = await import('/cripta/js/ui.js');
    const { texto: textoPx, anchoTexto } = await import('/cripta/js/fuente.js');
    const { monogramaPixel } = await import('/cripta/js/logojxs.js');
    // se dibuja chico (en píxeles del juego) y se agranda sin suavizar
    const k = 6, lw = Math.round(W / k), lh = 112;
    const baja = document.createElement('canvas'); baja.width = lw; baja.height = lh;
    const b = baja.getContext('2d');
    cartelTitulo(b, (x) => ({ titulo1: 'CRIPTA', titulo2: 'NEÓN' })[x], lw / 2, 22, 0.4, { esc: 3, colgado: true });
    g.save(); g.shadowColor = 'rgba(255,60,200,0.55)'; g.shadowBlur = 40;
    g.imageSmoothingEnabled = false; g.drawImage(baja, 0, 0, lw * k, lh * k); g.restore();
    g.imageSmoothingEnabled = false; g.drawImage(baja, 0, 0, lw * k, lh * k);
    // el logo: el monograma de píxeles con resplandor y JXSTUDIOS en la letra del juego
    const mp = monogramaPixel(70), kk = 4, mx = W - mp.width * kk - 44, my = H - mp.height * kk - 118;
    const placa = document.createElement('canvas'); placa.width = 100; placa.height = 20;
    const pg = placa.getContext('2d');
    textoPx(pg, 'JXSTUDIOS', 50, 0, '#5ff4e4', { esc: 1, sombra: '#0e5a52', alinear: 'centro' });
    // un panel oscuro con borde de neón detrás, como los carteles del juego
    const pw = Math.max(mp.width * kk, 100 * 3) + 40, phh = mp.height * kk + 20 * 3 + 36, px0 = W - pw - 26, py0 = my - 18;
    g.fillStyle = 'rgba(13,10,28,0.82)'; g.fillRect(px0, py0, pw, phh);
    g.strokeStyle = '#ff4fd8'; g.lineWidth = 6; g.shadowColor = '#ff4fd8'; g.shadowBlur = 24; g.strokeRect(px0 + 3, py0 + 3, pw - 6, phh - 6); g.shadowBlur = 0;
    g.save(); g.shadowColor = 'rgba(95,244,228,0.8)'; g.shadowBlur = 28;
    g.drawImage(mp, px0 + (pw - mp.width * kk) / 2, py0 + 16, mp.width * kk, mp.height * kk); g.restore();
    g.drawImage(mp, px0 + (pw - mp.width * kk) / 2, py0 + 16, mp.width * kk, mp.height * kk);
    g.drawImage(placa, px0 + (pw - 300) / 2, py0 + 22 + mp.height * kk, 300, 60);
  },

  // ── VÍBORA.IO: el logo del menú con franjas de lima y el JXS de cromo (el del logo original) ──
  async vibora(img) {
    cubrir(img, 0.5, 0.5);
    const { dibujarLogo } = await import('/vibora/js/logo.js');
    const { monograma, palabra } = await import('/vibora/js/logojxs.js');
    // un velo oscuro arriba para que el título se lea sobre las luces
    const v = g.createLinearGradient(0, 0, 0, 420); v.addColorStop(0, 'rgba(6,8,16,0.75)'); v.addColorStop(1, 'rgba(6,8,16,0)');
    g.fillStyle = v; g.fillRect(0, 0, W, 420);
    g.save(); g.shadowColor = 'rgba(140,255,58,0.55)'; g.shadowBlur = 50; dibujarLogo(g, W / 2, 190, 150, 0.6); g.restore();
    dibujarLogo(g, W / 2, 190, 150, 0.6);
    const m = monograma(250), p = palabra(230);
    const x = W - 250 - 52, y = H - m.height - p.height - 30;
    placa(x - 30, y - 18, 250 + 60, m.height + p.height + 10, 44, 'rgba(8,10,18,0.78)', 'rgba(140,255,58,0.6)');
    g.save(); g.shadowColor = 'rgba(140,255,58,0.35)'; g.shadowBlur = 30;
    g.drawImage(m, x - m.margen, y); g.drawImage(p, x + 10, y + m.height - 16); g.restore();
  },

  // ── GLOBO LIBRE: plano; el cartel del menú colgado de tres globos y el JXS blanco con borde ──
  async globo(img) {
    cubrir(img, 0.5, 0.18);
    const { FondoMenu } = await import('/globo/js/menu.js');
    const fm = new FondoMenu();
    const ancho = W * 0.8;
    fm.dibujarCartel(g, W / 2, ancho * 0.42 + 120, ancho, 2.4);
    const ancho2 = 230, x = W - ancho2 - 56, y = H - 250;
    // una placa como los botones del juego: borde oscuro y escalón abajo
    const pw = ancho2 + 56, ph = 196, px = x - 28, py = y - 26;
    const cajaR = (xx, yy, ww, hh, r) => { g.beginPath(); g.moveTo(xx + r, yy); g.arcTo(xx + ww, yy, xx + ww, yy + hh, r); g.arcTo(xx + ww, yy + hh, xx, yy + hh, r); g.arcTo(xx, yy + hh, xx, yy, r); g.arcTo(xx, yy, xx + ww, yy, r); g.closePath(); };
    g.fillStyle = '#1d2440'; cajaR(px, py + 10, pw, ph, 30); g.fill();
    g.fillStyle = '#3d8bff'; cajaR(px, py, pw, ph, 30); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#1d2440'; cajaR(px, py, pw, ph, 30); g.stroke();
    monogramaTrazos(x, y, ancho2, [[9, '#1d2440', 3, 6], [9, '#1d2440'], [0, '#ffffff']], { gap: [16, '#3d8bff'] });
    texto('JXStudios', x + ancho2 / 2, y + CAJA.h * (ancho2 / CAJA.w) + 30, 40, { relleno: '#ffffff', borde: '#1d2440', bordeAncho: 9, sombra: '#1d2440', sombraD: [0, 4] });
  },

  // ── LA ISLA: el título blanco en cursiva gruesa (como el menú) y el JXS de cromo de la intro 3D ──
  async isla(img) {
    cubrir(img, 0.5, 0.04);
    const { monograma, palabra } = await import('/vibora/js/logojxs.js');
    const v = g.createLinearGradient(0, 0, 0, 330); v.addColorStop(0, 'rgba(20,30,70,0.45)'); v.addColorStop(1, 'rgba(20,30,70,0)');
    g.fillStyle = v; g.fillRect(0, 0, W, 330);
    texto('LA ISLA', W / 2 + 6, 138, 188, { fuente: '"Lilita One", system-ui', peso: 400, italica: true, relleno: '#ffffff', borde: '#143a4c', bordeAncho: 22, sombra: 'rgba(10,25,40,0.55)', sombraD: [10, 16] });
    const m = monograma(240), p = palabra(220);
    const x = W - 240 - 50, y = H - m.height - p.height - 34;
    tabla(x - 34, y - 22, 240 + 68, m.height + p.height + 16);
    g.save(); g.shadowColor = 'rgba(255,170,80,0.45)'; g.shadowBlur = 24;
    g.drawImage(m, x - m.margen, y); g.drawImage(p, x + 10, y + m.height - 16); g.restore();
  },

  // ── BOMB RUNNER SIMULATOR: el título gordo de los simuladores y el JXS como calcomanía ──
  async bomba(img) {
    cubrir(img, 0.5, 0.3);
    const f = '"Luckiest Guy", "Arial Black", system-ui';
    g.save(); g.translate(W / 2, 150); g.rotate(-0.05);
    const px = 132;
    // BOMB RUNNER: amarillo a naranja, borde negro grueso y sombra dura
    g.font = `400 ${px}px ${f}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 34; g.strokeStyle = '#000'; g.strokeText('BOMB RUNNER', 6, 14);
    g.lineWidth = 26; g.strokeStyle = '#111'; g.strokeText('BOMB RUNNER', 0, 0);
    const gr = g.createLinearGradient(0, -px * 0.5, 0, px * 0.45); gr.addColorStop(0, '#fff36b'); gr.addColorStop(0.5, '#ffc21a'); gr.addColorStop(1, '#ff7a00');
    g.fillStyle = gr; g.fillText('BOMB RUNNER', 0, 0);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.save(); g.beginPath(); g.rect(-W, -px * 0.6, 2 * W, px * 0.42); g.clip(); g.fillText('BOMB RUNNER', 0, 0); g.restore();
    // SIMULATOR: blanco con borde azul
    const p2 = 74;
    g.font = `400 ${p2}px ${f}`;
    g.lineWidth = 20; g.strokeStyle = '#000'; g.strokeText('SIMULATOR', 4, px * 0.82 + 8);
    g.lineWidth = 14; g.strokeStyle = '#1e4fd8'; g.strokeText('SIMULATOR', 0, px * 0.82);
    g.fillStyle = '#ffffff'; g.fillText('SIMULATOR', 0, px * 0.82);
    g.restore();
    // la calcomanía: JXS blanco con borde negro, un poco torcida
    const ancho2 = 236;
    g.save(); g.translate(W - ancho2 / 2 - 48, H - 112); g.rotate(-0.06);
    monogramaTrazos(-ancho2 / 2, -118, ancho2, [[20, 'rgba(0,0,0,0.5)', 4, 9], [20, '#000'], [0, '#ffffff']], { gap: [26, '#000'] });
    texto('JXStudios', 0, CAJA.h * (ancho2 / CAJA.w) - 118 + 44, 50, { fuente: f, peso: 400, relleno: '#ffffff', borde: '#000', bordeAncho: 12, sombra: 'rgba(0,0,0,0.5)', sombraD: [3, 6] });
    g.restore();
  },
};

(async () => {
  try {
    await document.fonts.load('80px "Luckiest Guy"'); await document.fonts.load('80px "Lilita One"');
    const img = await cargar(`img/${juego}.png`);
    await PORTADAS[juego](img);
    window.listo = c.toDataURL('image/png');
  } catch (e) { window.listo = 'ERROR ' + (e.stack || e); }
})();
