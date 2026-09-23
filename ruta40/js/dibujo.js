/* ============================================================================
   ruta40/js/dibujo.js — lo que se ve. Canvas 2D a la resolución del
   dispositivo, con el mundo en metros y la cámara que sigue al auto.

   De atrás para adelante:
     cielo → lejos (paralaje 0,03) → medio (0,18) → cerros cercanos dibujados
     con adornos chiquitos (0,5) → adornos al costado de la ruta (1) → puentes y
     rampas → el terreno con su textura, sus capas y su borde (pasto, sal,
     nieve…) → bidones, monedas, mojones → los autos (rivales transparentes) →
     partículas → clima (viento, nieve) → cartelitos de los trucos.
   ========================================================================== */
import { IMG, ok } from './arte.js';
import { MEDIDAS } from './medidas.js';
import { azar } from './ruta.js';

/* cómo se ve cada tramo: el borde de la tierra, el pasto, el polvo, el clima y los adornos
   ([nombre, alto en m, peso]) al costado de la ruta y en los cerros de atrás */
export const VISTA = {
  puna: { borde: '#c9a24a', claro: '#ecd27e', oscuro: '#6e4e22', pasto: 'paja', polvo: [196, 160, 110], clima: 'motas', cerca: '#9c7a45',
    adornos: [['vicuna', 1.5, 3], ['llama', 1.8, 2], ['piedras', 1.0, 3], ['coiron', 0.8, 5], ['capilla', 5.2, 0.35], ['santuario', 1.5, 0.4]], aves: 'condor' },
  quebrada: { borde: '#c07642', claro: '#e7a56c', oscuro: '#5b3120', pasto: 'ripio', polvo: [190, 128, 88], clima: 'motas', cerca: '#9a5a3a',
    adornos: [['cardon', 4.4, 5], ['cactus', 0.7, 3], ['llama', 1.8, 1.2], ['piedras', 1.1, 2], ['capilla', 5.2, 0.3], ['santuario', 1.5, 0.5]], aves: 'condor' },
  salinas: { borde: '#f4f6f4', claro: '#ffffff', oscuro: '#b9c2c6', pasto: 'sal', polvo: [240, 244, 246], clima: 'brillo', cerca: '#d9d4dc',
    adornos: [['bloquesSal', 1.0, 4], ['sal', 0.55, 4], ['flamenco', 1.4, 2], ['cartel', 2.0, 1]], aves: 'flamencoVuela' },
  valles: { borde: '#a44b31', claro: '#d07a55', oscuro: '#4a1f16', pasto: 'monte', polvo: [176, 96, 70], clima: 'motas', cerca: '#7f3a28',
    adornos: [['algarrobo', 4.8, 3], ['roca', 6.2, 1.2], ['cardon', 4, 2], ['vid', 1.6, 2], ['barril', 1.0, 1], ['capilla', 5.2, 0.3]], aves: 'condor' },
  cuyo: { borde: '#c8a46a', claro: '#e9cf9a', oscuro: '#5e4a2c', pasto: 'ripio', polvo: [200, 170, 120], clima: 'motas', cerca: '#8a7b4c',
    adornos: [['alamo', 11, 3], ['vid', 1.6, 5], ['barril', 1.0, 1.5], ['algarrobo', 4.6, 1.2], ['tranquera', 1.2, 1], ['santuario', 1.5, 0.6]], aves: 'condor' },
  patagonia: { borde: '#b8ac72', claro: '#ddd39c', oscuro: '#524c33', pasto: 'coiron', polvo: [170, 160, 120], clima: 'viento', cerca: '#7d7a58',
    adornos: [['coiron', 0.9, 6], ['oveja', 1.0, 3], ['guanaco', 1.8, 2], ['tranquera', 1.2, 1.2], ['piedras', 1.0, 1.5], ['surtidor', 2.0, 0.25]], aves: 'condor' },
  glaciar: { borde: '#f1f6fa', claro: '#ffffff', oscuro: '#9fb3c4', pasto: 'nieve', polvo: [236, 242, 248], clima: 'nieve', cerca: '#8a8f99',
    adornos: [['lenga', 6.5, 4], ['hielo', 1.3, 2], ['piedras', 1.1, 2], ['guanaco', 1.8, 0.8]], aves: 'condor' },
};

const lerp = (a, b, t) => a + (b - a) * t;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/* ---------------------------------------------------------------- los adornos de un tramo */
function sembrar(R) {
  const V = VISTA[R.id], al = azar(R.T.semilla * 7 + 3), total = V.adornos.reduce((s, a) => s + a[2], 0);
  const elegir = () => { let r = al() * total; for (const a of V.adornos) { r -= a[2]; if (r <= 0) return a; } return V.adornos[0]; };
  const cerca = (x, lista, d) => lista.some((q) => Math.abs(q.x - x) < d);
  const ruta = [];
  for (let x = 25; x < R.largo + 60; x += 9 + al() * 26) {
    if (R.puentes.some((p) => x > p.x0 - 6 && x < p.x1 + 6) || R.rampas.some((r) => x > r.x - 6 && x < r.x3 + 4)) continue;
    const [n, alto] = elegir();
    /* los grandes (capillas, álamos) no pegados a otro grande */
    if (alto > 4 && cerca(x, ruta.filter((q) => q.alto > 4), 22)) continue;
    ruta.push({ x, n, alto: alto * (0.85 + al() * 0.3), espejo: al() < 0.5, hundir: 0.12 + al() * 0.1, fase: al() * 6.28 });
  }
  /* en los cerros de atrás, chiquitos y con bruma */
  const lejos = [];
  for (let x = -60; x < R.largo * 0.5 + 200; x += 14 + al() * 30) { const [n, alto] = elegir(); lejos.push({ x, n, alto: alto * (0.8 + al() * 0.4), espejo: al() < 0.5 }); }
  /* los carteles de "rampa" 30 m antes de cada una */
  const carteles = R.rampas.map((r) => ({ x: r.x - 28 }));
  return { ruta, lejos, carteles };
}

/* ---------------------------------------------------------------- el dibujante */
export class Dibujo {
  constructor(lienzo) {
    this.c = lienzo; this.x = lienzo.getContext('2d', { alpha: false });
    this.W = 1; this.H = 1; this.cam = { x: 0, y: 0, esc: 40 };
    this.t = 0; this.R = null; this.parts = []; this.textos = []; this.sacudon = 0;
    this.patrones = {}; this.clima = [];
  }
  medir(W, H) { this.W = this.c.width = Math.max(2, Math.round(W)); this.H = this.c.height = Math.max(2, Math.round(H)); this.clima = []; }

  ponerTramo(R) {
    this.R = R; this.V = VISTA[R.id]; this.sem = sembrar(R); this.parts.length = 0; this.textos.length = 0; this.clima = [];
    this.camY0 = R.alto(0) + 2; this.ultCamX = undefined;
    const F = MEDIDAS.fondos[R.id];
    this.colorBajo = `rgb(${F.bajoMedio.join(',')})`;
    this.colorSuelo = F.suelo;
    /* el color del cielo arriba de la imagen, para cuando la cámara sube mucho */
    this.cieloArriba = '#6aa6d8';
    const im = IMG['lejos-' + R.id];
    if (ok('lejos-' + R.id)) {
      try {
        const cv = document.createElement('canvas'); cv.width = 32; cv.height = 4;
        const g = cv.getContext('2d'); g.drawImage(im, 0, 0, im.naturalWidth, 8, 0, 0, 32, 4);
        const d = g.getImageData(0, 0, 32, 4).data; let r = 0, gg = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4; this.cieloArriba = `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})`;
      } catch (_) {}
    }
  }
  patron(nombre) {
    if (this.patrones[nombre] !== undefined) return this.patrones[nombre];
    this.patrones[nombre] = ok(nombre) ? this.x.createPattern(IMG[nombre], 'repeat') : null;
    return this.patrones[nombre];
  }

  /* ------------------------------------------------ de metros a pantalla */
  sx(x) { return this.W * 0.5 + (x - this.cam.x) * this.cam.esc; }
  sy(y) { return this.H * 0.5 - (y - this.cam.y) * this.cam.esc; }

  /* ------------------------------------------------ el cuadro entero */
  cuadro(E, dt) {
    const x = this.x, R = this.R;
    this.t += dt;
    const W = this.W, H = this.H;
    /* la altura de referencia de los fondos sigue a la cámara despacito: en un salto los fondos
       se mueven (paralaje) pero en una subida larga no se van de la pantalla */
    this.camY0 += (this.cam.y - this.camY0) * Math.min(1, dt * 0.25);
    x.setTransform(1, 0, 0, 1, 0, 0);
    /* el sacudón (golpes, aterrizajes) */
    let ox = 0, oy = 0;
    if (this.sacudon > 0.01) { ox = (Math.random() - 0.5) * this.sacudon * 14; oy = (Math.random() - 0.5) * this.sacudon * 14; this.sacudon *= Math.pow(0.02, dt); }
    this.cam.x -= ox / this.cam.esc; this.cam.y += oy / this.cam.esc;
    this.fondos();
    this.adornosRuta();
    this.puentes();
    this.terreno();
    this.rampas();
    this.cosas(E);
    for (const A of E.autos) if (A !== E.yo) this.auto(A, 0.5);
    if (E.yo) this.auto(E.yo, 1);
    this.particulas(dt);
    this.climaDibujar(dt);
    this.cartelitos(dt);
    this.cam.x += ox / this.cam.esc; this.cam.y -= oy / this.cam.esc;
  }

  /* ------------------------------------------------ cielo, lejos y medio */
  fondos() {
    const x = this.x, W = this.W, H = this.H, R = this.R, e = this.cam.esc;
    x.fillStyle = this.cieloArriba; x.fillRect(0, 0, W, H);
    const lej = IMG['lejos-' + R.id];
    /* la imagen de lejos cubre el alto de la pantalla; se repite espejada, así no hay costura */
    if (ok('lejos-' + R.id)) {
      const alto = H * 1.08, ancho = alto * lej.naturalWidth / lej.naturalHeight;
      const base = H * 1.02 + Math.max(-H * 0.2, Math.min(H * 0.25, (this.cam.y - this.camY0) * e * 0.035));
      const des = this.cam.x * e * 0.03;
      this.tira(lej, des, base - alto, ancho, alto);
    }
    const med = IMG['medio-' + R.id], F = MEDIDAS.fondos[R.id];
    if (ok('medio-' + R.id)) {
      /* la franja del medio, más chica que la de lejos: así se sigue viendo la cordillera */
      const k = H / 768 * Math.min(0.82, 330 / F.medio[1]), ancho = F.medio[0] * k, alto = F.medio[1] * k;
      const base = H * 1.04 + Math.max(-H * 0.3, Math.min(H * 0.4, (this.cam.y - this.camY0) * e * 0.12));
      const des = this.cam.x * e * 0.18;
      this.tira(med, des, base - alto, ancho, alto);
      x.fillStyle = this.colorBajo; x.fillRect(0, base - 2, W, H - base + 4);
    }
  }
  /* una imagen repetida de costado, espejada cada vez (así los bordes siempre calzan) */
  tira(im, des, y, ancho, alto) {
    const x = this.x, W = this.W;
    let i = Math.floor(des / ancho);
    for (let px = i * ancho - des; px < W; px += ancho, i++) {
      if ((i & 1) === 0) x.drawImage(im, px, y, ancho + 1, alto);
      else { x.save(); x.translate(px + ancho, y); x.scale(-1, 1); x.drawImage(im, 0, 0, ancho + 1, alto); x.restore(); }
    }
  }

  /* ------------------------------------------------ los cerros de adelante de los fondos, dibujados */
  cerrosCercanos() {
    const x = this.x, W = this.W, H = this.H, e = this.cam.esc * 0.5, V = this.V;
    const cx = this.cam.x * 0.5;
    const baseY = H * 0.78 + Math.max(-H * 0.35, Math.min(H * 0.5, (this.cam.y - this.camY0) * this.cam.esc * 0.3));
    const alto = (u) => 3.2 + Math.sin(u * 0.045) * 2.2 + Math.sin(u * 0.11 + 1.3) * 1.2 + Math.sin(u * 0.27 + 0.4) * 0.45;
    const u0 = cx - W / 2 / e - 2, u1 = cx + W / 2 / e + 2;
    x.beginPath(); x.moveTo(0, H);
    for (let u = u0; u <= u1; u += 1.5) x.lineTo(W / 2 + (u - cx) * e, baseY - alto(u) * e);
    x.lineTo(W, H); x.closePath();
    const g = x.createLinearGradient(0, baseY - 6 * e, 0, H);
    g.addColorStop(0, V.cerca); g.addColorStop(1, this.colorBajo);
    x.fillStyle = g; x.fill();
    /* los adornos chiquitos, con bruma */
    x.globalAlpha = 0.82;
    for (const q of this.sem.lejos) {
      const px = W / 2 + (q.x - cx) * e;
      if (px < -200 || px > W + 200) continue;
      this.sprite(q.n, px, baseY - (alto(q.x) - 0.25) * e, q.alto * e, q.espejo, 0);
    }
    x.globalAlpha = 1;
    /* un velo del color del aire, que los separa de la ruta */
    x.fillStyle = 'rgba(255,240,220,0.08)'; x.fillRect(0, 0, W, H);
  }

  /* un adorno parado sobre (px, py): py es la base, h el alto en píxeles */
  sprite(n, px, py, h, espejo, giro) {
    const x = this.x, im = IMG[n], M = MEDIDAS.props[n] || MEDIDAS.sueltos[n];
    if (!ok(n) || !M) return;
    const w = h * M.w / M.h;
    x.save(); x.translate(px, py); if (giro) x.rotate(giro); if (espejo) x.scale(-1, 1);
    x.drawImage(im, -w / 2, -h, w, h); x.restore();
  }

  /* ------------------------------------------------ al costado de la ruta */
  adornosRuta() {
    const R = this.R, e = this.cam.esc, x0 = this.cam.x - this.W / 2 / e - 14, x1 = this.cam.x + this.W / 2 / e + 14;
    for (const q of this.sem.ruta) {
      if (q.x < x0 || q.x > x1) continue;
      const bamba = q.n === 'alamo' || q.n === 'lenga' || q.n === 'coiron' ? Math.sin(this.t * 1.4 + q.fase) * 0.025 * (R.T.viento ? 2.5 : 1) : 0;
      this.sprite(q.n, this.sx(q.x), this.sy(R.alto(q.x) - q.hundir), q.alto * e, q.espejo, bamba);
    }
    /* los carteles amarillos de rampa */
    for (const c of this.sem.carteles) if (c.x > x0 && c.x < x1) this.cartelRampa(this.sx(c.x), this.sy(R.alto(c.x) - 0.1), e);
  }
  cartelRampa(px, py, e) {
    const x = this.x, s = e * 0.62;
    x.save(); x.translate(px, py);
    x.fillStyle = '#6b6f73'; x.fillRect(-0.05 * e, -2.1 * e, 0.1 * e, 2.1 * e);
    x.translate(0, -2.2 * e); x.rotate(Math.PI / 4);
    x.fillStyle = '#1b1b1b'; x.fillRect(-s * 0.56, -s * 0.56, s * 1.12, s * 1.12);
    x.fillStyle = '#f5c400'; x.fillRect(-s * 0.5, -s * 0.5, s, s);
    x.rotate(-Math.PI / 4);
    /* la rampita con el autito saltando */
    x.fillStyle = '#1b1b1b'; x.beginPath(); x.moveTo(-s * 0.42, s * 0.2); x.lineTo(s * 0.05, s * 0.2); x.lineTo(-s * 0.1, s * 0.02); x.closePath(); x.fill();
    x.beginPath(); x.ellipse(s * 0.18, -s * 0.12, s * 0.16, s * 0.08, -0.4, 0, 6.3); x.fill();
    x.restore();
  }

  /* ------------------------------------------------ el terreno */
  camino(dibujado = true) {
    /* la polilínea de la superficie visible (la de debajo de los puentes, que es la que se ve) */
    const R = this.R, S = R.S, e = this.cam.esc, h = dibujado ? S.debajo : S.h;
    const x0 = this.cam.x - this.W / 2 / e - 1, x1 = this.cam.x + this.W / 2 / e + 1;
    const i0 = Math.max(0, Math.floor((x0 - S.x0) / S.dx)), i1 = Math.min(S.n - 1, Math.ceil((x1 - S.x0) / S.dx));
    /* si está muy lejos, se saltean puntos (un punto cada ~3 píxeles alcanza) */
    const salto = Math.max(1, Math.floor(3 / (S.dx * e)));
    const pts = [];
    for (let i = i0; i <= i1; i += salto) pts.push(this.sx(S.x0 + i * S.dx), this.sy(h[i]));
    if ((i1 - i0) % salto) pts.push(this.sx(S.x0 + i1 * S.dx), this.sy(h[i1]));
    return pts;
  }
  terreno() {
    const x = this.x, W = this.W, H = this.H, e = this.cam.esc, V = this.V, R = this.R;
    const pts = this.camino();
    if (pts.length < 4) return;
    const trazar = (dy) => { x.moveTo(pts[0], pts[1] + dy); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1] + dy); };
    const cerrar = (dy) => { x.beginPath(); trazar(dy); x.lineTo(pts[pts.length - 2], H + 10); x.lineTo(pts[0], H + 10); x.closePath(); };
    /* la tierra con su textura, pegada al mundo (6 m por baldosa) */
    cerrar(0);
    const pat = this.patron('suelo-' + R.id);
    if (pat) {
      const k = e * 6 / 512;
      pat.setTransform(new DOMMatrix([k, 0, 0, k, W / 2 - this.cam.x * e, H / 2 + this.cam.y * e]));
      x.fillStyle = pat;
    } else x.fillStyle = rgba(this.colorSuelo, 1);
    x.fill();
    /* las capas: más oscuro cuanto más hondo, siguiendo la forma de la loma */
    x.fillStyle = 'rgba(20,10,5,0.16)'; cerrar(2.2 * e); x.fill();
    x.fillStyle = 'rgba(20,10,5,0.2)'; cerrar(5.5 * e); x.fill();
    x.fillStyle = 'rgba(15,8,4,0.25)'; cerrar(11 * e); x.fill();
    /* el borde: la sombra de abajo, el color y el brillo de arriba */
    x.lineJoin = 'round'; x.lineCap = 'round';
    x.beginPath(); trazar(0.3 * e); x.strokeStyle = V.oscuro; x.lineWidth = 0.22 * e; x.globalAlpha = 0.55; x.stroke(); x.globalAlpha = 1;
    x.beginPath(); trazar(0.12 * e); x.strokeStyle = V.borde; x.lineWidth = (V.pasto === 'nieve' ? 0.5 : 0.32) * e; x.stroke();
    x.beginPath(); trazar(-0.02 * e); x.strokeStyle = V.claro; x.lineWidth = 0.07 * e; x.stroke();
    this.pasto(pts, e);
  }
  /* el pasto (o la sal, la nieve, el ripio) sobre el borde, en matas */
  pasto(pts, e) {
    const x = this.x, V = this.V, R = this.R;
    if (e < 9) return;
    const x0 = this.cam.x - this.W / 2 / e, x1 = this.cam.x + this.W / 2 / e;
    const paso = 0.55;
    for (let u = Math.floor(x0 / paso) * paso; u < x1; u += paso) {
      const k = Math.sin(u * 12.9898) * 43758.5453, r = k - Math.floor(k);
      if (R.puentes.some((p) => u > p.x0 && u < p.x1)) continue;
      const px = this.sx(u), py = this.sy(R.S.debajo ? this.altoDebajo(u) : R.alto(u));
      if (V.pasto === 'paja' || V.pasto === 'coiron') {
        if (r > 0.7) continue;
        const h = (0.25 + r * 0.45) * e, n = 4;
        x.strokeStyle = r < 0.35 ? V.claro : V.borde; x.lineWidth = Math.max(1, 0.04 * e);
        const viento = Math.sin(this.t * 2 + u) * 0.06 + (R.T.viento ? -0.18 : 0);
        x.beginPath();
        for (let j = 0; j < n; j++) { const a = (j - (n - 1) / 2) * 0.28 + viento; x.moveTo(px + j * 0.04 * e, py); x.quadraticCurveTo(px + Math.sin(a) * h * 0.5, py - h * 0.6, px + Math.sin(a) * h, py - h * Math.cos(a)); }
        x.stroke();
      } else if (V.pasto === 'nieve') {
        if (r > 0.45) continue;
        x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(px, py - 0.02 * e, (0.25 + r * 0.4) * e, (0.1 + r * 0.08) * e, 0, Math.PI, 0); x.fill();
      } else if (V.pasto === 'sal') {
        if (r > 0.3) continue;
        const b = 0.5 + 0.5 * Math.sin(this.t * 3 + u * 7);
        x.fillStyle = `rgba(255,255,255,${0.4 + b * 0.6})`; x.fillRect(px - 0.03 * e, py - 0.12 * e, 0.06 * e, 0.06 * e);
      } else {
        /* ripio y monte: piedritas y alguna matita */
        if (r > 0.5) continue;
        if (r < 0.12 && V.pasto === 'monte') { x.fillStyle = '#5d6b33'; x.beginPath(); x.ellipse(px, py - 0.08 * e, 0.22 * e, 0.16 * e, 0, Math.PI, 0); x.fill(); }
        else { x.fillStyle = r < 0.25 ? V.oscuro : V.claro; x.beginPath(); x.ellipse(px, py + 0.02 * e, (0.05 + r * 0.12) * e, (0.035 + r * 0.06) * e, 0, Math.PI, 0); x.fill(); }
      }
    }
  }
  altoDebajo(u) { const S = this.R.S, f = (u - S.x0) / S.dx, i = Math.max(0, Math.min(S.n - 2, Math.floor(f))), t = f - i; return S.debajo[i] * (1 - t) + S.debajo[i + 1] * t; }

  /* ------------------------------------------------ los puentes de madera */
  puentes() {
    const x = this.x, e = this.cam.esc, R = this.R;
    const x0 = this.cam.x - this.W / 2 / e - 5, x1 = this.cam.x + this.W / 2 / e + 5;
    for (const p of R.puentes) {
      if (p.x1 < x0 || p.x0 > x1) continue;
      /* los pilares hasta el fondo del pozo */
      for (let u = p.x0 + 1.5; u < p.x1 - 1; u += 4) {
        const yb = this.altoDebajo(u), px = this.sx(u);
        x.fillStyle = '#4a3020'; x.fillRect(px - 0.14 * e, this.sy(p.y), 0.28 * e, (p.y - yb) * e + 0.3 * e);
        x.strokeStyle = 'rgba(40,24,14,0.9)'; x.lineWidth = 0.08 * e;
        x.beginPath(); x.moveTo(px - 0.1 * e, this.sy(p.y - 0.4)); x.lineTo(px + 2 * e, this.sy(Math.max(yb + 0.5, p.y - 2.4))); x.stroke();
      }
      /* la baranda de atrás: postes y soga */
      x.strokeStyle = '#6b4a2d'; x.lineWidth = 0.09 * e;
      let prev = null;
      for (let u = p.x0; u <= p.x1 + 0.01; u += 2) {
        const px = this.sx(u), py = this.sy(p.y);
        x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - 1 * e); x.stroke();
        if (prev) { x.strokeStyle = '#c9a879'; x.lineWidth = 0.05 * e; x.beginPath(); x.moveTo(prev, py - 0.95 * e); x.quadraticCurveTo((prev + px) / 2, py - 0.7 * e, px, py - 0.95 * e); x.stroke(); x.strokeStyle = '#6b4a2d'; x.lineWidth = 0.09 * e; }
        prev = px;
      }
    }
  }
  /* el tablero, por encima de la tierra (que abajo es el pozo) */
  tableros() {
    const x = this.x, e = this.cam.esc, R = this.R;
    const x0 = this.cam.x - this.W / 2 / e - 5, x1 = this.cam.x + this.W / 2 / e + 5;
    for (const p of R.puentes) {
      if (p.x1 < x0 || p.x0 > x1) continue;
      const py = this.sy(p.y);
      for (let u = p.x0 - 0.2; u < p.x1 + 0.2; u += 0.32) {
        const k = Math.sin(u * 91.7) * 999, r = k - Math.floor(k);
        x.fillStyle = r < 0.33 ? '#8b5e37' : r < 0.66 ? '#7a5130' : '#9a6a40';
        x.fillRect(this.sx(u), py - 0.02 * e, 0.3 * e, (0.2 + r * 0.04) * e);
      }
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(this.sx(p.x0 - 0.2), py + 0.18 * e, (p.x1 - p.x0 + 0.4) * e, 0.06 * e);
    }
  }

  /* ------------------------------------------------ las rampas de tablas */
  rampas() {
    this.tableros();
    const x = this.x, e = this.cam.esc, R = this.R;
    const x0 = this.cam.x - this.W / 2 / e - 14, x1 = this.cam.x + this.W / 2 / e + 2;
    for (const r of R.rampas) {
      if (r.x2 < x0 || r.x > x1) continue;
      x.strokeStyle = '#7b5230'; x.lineWidth = 0.22 * e; x.lineCap = 'butt';
      x.beginPath();
      for (let u = r.x + 1; u <= r.x2; u += 0.25) { const px = this.sx(u), py = this.sy(R.alto(u) - 0.1); if (u === r.x + 1) x.moveTo(px, py); else x.lineTo(px, py); }
      x.stroke();
      /* las juntas de las tablas y los caballetes */
      x.strokeStyle = 'rgba(40,22,10,0.8)'; x.lineWidth = Math.max(1, 0.035 * e);
      for (let u = r.x + 1.6; u < r.x2; u += 0.9) { const px = this.sx(u), py = this.sy(R.alto(u) - 0.1); x.beginPath(); x.moveTo(px, py - 0.11 * e); x.lineTo(px, py + 0.11 * e); x.stroke(); }
      const cima = this.sx(r.x1), yc = this.sy(R.alto(r.x1));
      x.strokeStyle = '#5e3d22'; x.lineWidth = 0.12 * e;
      x.beginPath(); x.moveTo(cima, yc + 0.2 * e); x.lineTo(cima - 1.2 * e, yc + r.alto * e * 0.85); x.moveTo(cima - 2.5 * e, this.sy(R.alto(r.x1 - 2.5))); x.lineTo(cima - 2.5 * e, yc + r.alto * e * 0.8); x.stroke();
    }
  }

  /* ------------------------------------------------ bidones, monedas, mojones, llegada */
  cosas(E) {
    const x = this.x, e = this.cam.esc, R = this.R, t = this.t;
    const x0 = this.cam.x - this.W / 2 / e - 3, x1 = this.cam.x + this.W / 2 / e + 3;
    /* los mojones: el blanco de hormigón con la punta negra */
    for (const m of R.mojones) if (m.x > x0 && m.x < x1) this.mojon(this.sx(m.x), this.sy(m.y - 0.15), e, m.x);
    if (E.record > 30 && E.record > x0 && E.record < x1) this.banderaRecord(this.sx(E.record), this.sy(R.alto(E.record)), e, E.record);
    if (E.meta && E.meta > x0 - 6 && E.meta < x1 + 6) this.arcoMeta(E.meta, e, E.textoMeta);
    /* los bidones, flotando */
    for (let i = 0; i < R.nafta.length; i++) {
      const q = R.nafta[i];
      if (E.tomados.nafta[i] || q.x < x0 || q.x > x1) continue;
      const px = this.sx(q.x), py = this.sy(q.y + Math.sin(t * 2.6 + i) * 0.1);
      const g = x.createRadialGradient(px, py, 0, px, py, 0.9 * e);
      g.addColorStop(0, 'rgba(255,90,60,0.35)'); g.addColorStop(1, 'rgba(255,90,60,0)');
      x.fillStyle = g; x.fillRect(px - e, py - e, 2 * e, 2 * e);
      if (ok('bidon')) { const h = 0.95 * e, w = h * 131 / 160; x.drawImage(IMG.bidon, px - w / 2, py - h / 2, w, h); }
      else { x.fillStyle = '#c4201b'; x.fillRect(px - 0.3 * e, py - 0.4 * e, 0.6 * e, 0.8 * e); }
    }
    /* las monedas, girando */
    const M = R.monedas;
    for (let i = 0; i < M.length; i++) {
      const q = M[i];
      if (q.x < x0) continue;
      if (q.x > x1) break;
      if (E.tomados.monedas[i]) continue;
      const giro = Math.cos(t * 3.2 + q.x * 0.7), w = Math.max(0.12, Math.abs(giro));
      const d = (q.v >= 100 ? 0.66 : q.v >= 25 ? 0.58 : 0.5) * e, px = this.sx(q.x), py = this.sy(q.y);
      const n = q.v >= 100 ? 'moneda100' : q.v >= 25 ? 'moneda25' : 'moneda5';
      if (ok(n)) x.drawImage(IMG[n], px - d * w / 2, py - d / 2, d * w, d);
      else { x.fillStyle = '#f0c030'; x.beginPath(); x.ellipse(px, py, d * w / 2, d / 2, 0, 0, 6.3); x.fill(); }
    }
  }
  mojon(px, py, e, metros) {
    const x = this.x, w = 0.52 * e, h = 1.15 * e;
    x.save(); x.translate(px, py);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(0, 0, w * 0.8, 0.08 * e, 0, 0, 6.3); x.fill();
    x.fillStyle = '#f3f1ea'; x.beginPath(); x.moveTo(-w / 2, 0); x.lineTo(-w / 2, -h + w / 2); x.arc(0, -h + w / 2, w / 2, Math.PI, 0); x.lineTo(w / 2, 0); x.closePath(); x.fill();
    x.fillStyle = '#1d1d1d'; x.beginPath(); x.moveTo(-w / 2, -h + w * 0.62); x.arc(0, -h + w / 2, w / 2, Math.PI, 0); x.lineTo(w / 2, -h + w * 0.62); x.closePath(); x.fill();
    x.fillStyle = '#1d1d1d'; x.textAlign = 'center';
    x.font = `900 ${0.15 * e}px Overpass, sans-serif`; x.fillText('RN 40', 0, -h + w * 0.95);
    x.font = `900 ${0.22 * e}px Overpass, sans-serif`; x.fillText(String(metros), 0, -h * 0.38);
    x.font = `700 ${0.12 * e}px Overpass, sans-serif`; x.fillText('m', 0, -h * 0.2);
    x.restore();
  }
  banderaRecord(px, py, e, m) {
    const x = this.x;
    x.save(); x.translate(px, py);
    x.fillStyle = '#e8e8e8'; x.fillRect(-0.04 * e, -2.6 * e, 0.08 * e, 2.6 * e);
    const o = Math.sin(this.t * 4) * 0.08 * e;
    x.fillStyle = '#74acdf'; x.beginPath(); x.moveTo(0.04 * e, -2.6 * e); x.quadraticCurveTo(0.6 * e, -2.6 * e + o, 1.2 * e, -2.55 * e); x.lineTo(1.2 * e, -1.95 * e); x.quadraticCurveTo(0.6 * e, -1.95 * e + o, 0.04 * e, -2 * e); x.fill();
    x.fillStyle = '#fff'; x.fillRect(0.04 * e, -2.4 * e, 1.16 * e, 0.2 * e);
    x.fillStyle = '#f6b40e'; x.beginPath(); x.arc(0.6 * e, -2.3 * e, 0.07 * e, 0, 6.3); x.fill();
    x.restore();
  }
  arcoMeta(xm, e, texto) {
    const x = this.x, R = this.R, ya = R.alto(xm - 3.5), yb = R.alto(xm + 3.5), top = Math.max(ya, yb) + 5.2;
    const pa = this.sx(xm - 3.5), pb = this.sx(xm + 3.5), pt = this.sy(top);
    x.fillStyle = '#5a3a22'; x.fillRect(pa - 0.18 * e, pt, 0.36 * e, this.sy(ya) - pt); x.fillRect(pb - 0.18 * e, pt, 0.36 * e, this.sy(yb) - pt);
    /* el cartel: celeste y blanco */
    x.fillStyle = '#0f6b3f'; x.fillRect(pa - 0.5 * e, pt - 0.2 * e, pb - pa + e, 1.3 * e);
    x.strokeStyle = '#fff'; x.lineWidth = 0.08 * e; x.strokeRect(pa - 0.38 * e, pt - 0.08 * e, pb - pa + 0.76 * e, 1.06 * e);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `900 ${0.62 * e}px Overpass, sans-serif`;
    x.fillText(texto || 'META', (pa + pb) / 2, pt + 0.72 * e);
    /* la línea a cuadros en el piso */
    for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#111' : '#fff'; x.fillRect(this.sx(xm) - 0.2 * e, this.sy(R.alto(xm)) - (k + 1) * 0.2 * e, 0.2 * e, 0.2 * e); x.fillStyle = k % 2 ? '#fff' : '#111'; x.fillRect(this.sx(xm), this.sy(R.alto(xm)) - (k + 1) * 0.2 * e, 0.2 * e, 0.2 * e); }
  }

  /* ------------------------------------------------ un vehículo */
  auto(A, alfa) {
    const x = this.x, e = this.cam.esc, D = A.def, sp = D.sprite;
    const p = A.dib || A;
    const cx = this.sx(p.x), cy = this.sy(p.y);
    if (cx < -600 || cx > this.W + 600) return;
    x.save(); x.globalAlpha = alfa;
    /* la sombra en el piso */
    const suelo = this.R.alto(p.x), alto = p.y - suelo;
    if (alto < 8) {
      const k = Math.max(0, 1 - alto / 8);
      x.fillStyle = `rgba(0,0,0,${0.28 * k})`; x.beginPath(); x.ellipse(cx, this.sy(suelo) + 0.05 * e, D.largo * 0.45 * e * (0.7 + 0.3 * k), 0.16 * e, 0, 0, 6.3); x.fill();
    }
    const c = Math.cos(p.a), s = Math.sin(p.a);
    const aPant = (bx, by) => [cx + (bx * c - by * s) * e, cy - (bx * s + by * c) * e];
    /* los amortiguadores: del chasis a la rueda */
    x.strokeStyle = '#2b2b2b'; x.lineWidth = 0.1 * e; x.lineCap = 'round';
    for (let i = 0; i < D.ruedas.length; i++) {
      const Rd = D.ruedas[i], w = p.ruedas[i];
      const [mx, my] = aPant(Rd.x, Rd.y + 0.1);
      x.beginPath(); x.moveTo(mx, my); x.lineTo(this.sx(w.px), this.sy(w.py)); x.stroke();
    }
    /* el conductor, detrás del chasis (se ve por el vidrio) */
    const cab = D.cabeza, hc = A.cabezaDes || { x: 0, y: 0, g: 0 };
    const [hx, hy] = aPant(cab.x + hc.x, cab.y + hc.y);
    if (ok('conductor')) {
      const ancho = (D.chofer || 0.7) * e, alto2 = ancho * 256 / 243;
      x.save(); x.translate(hx, hy); x.rotate(-p.a - hc.g);
      x.drawImage(IMG.conductor, -ancho * 0.33, -alto2 * 0.25, ancho, alto2);
      x.restore();
    } else { x.fillStyle = '#e5b48a'; x.beginPath(); x.arc(hx, hy, cab.r * 0.6 * e, 0, 6.3); x.fill(); }
    /* el chasis */
    x.save(); x.translate(cx, cy); x.rotate(-p.a);
    const k = e / sp.ppm;
    if (ok(sp.img)) x.drawImage(IMG[sp.img], -sp.ox * k, -sp.oy * k, sp.w * k, sp.h * k);
    else { x.fillStyle = D.color; x.fillRect(-D.largo / 2 * e, -1.2 * e, D.largo * e, 1 * e); }
    x.restore();
    /* las ruedas, adelante */
    const ll = 'llanta-' + D.llanta;
    for (let i = 0; i < p.ruedas.length; i++) {
      const w = p.ruedas[i], r = D.ruedas[i].r * e, px = this.sx(w.px), py = this.sy(w.py);
      x.save(); x.translate(px, py); x.rotate(-w.ang);
      if (ok(ll)) x.drawImage(IMG[ll], -r, -r, 2 * r, 2 * r);
      else { x.fillStyle = '#222'; x.beginPath(); x.arc(0, 0, r, 0, 6.3); x.fill(); x.fillStyle = '#aaa'; x.fillRect(-r * 0.1, -r * 0.8, r * 0.2, r * 1.6); }
      x.restore();
    }
    x.restore();
  }

  /* ------------------------------------------------ partículas */
  echar(tipo, px, py, vx, vy, n = 1, extra = {}) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 700) this.parts.shift();
      this.parts.push({ tipo, x: px, y: py, vx: vx + (Math.random() - 0.5) * (extra.abre || 1), vy: vy + (Math.random() - 0.5) * (extra.abre || 1), vida: 0, dura: (extra.dura || 0.8) * (0.7 + Math.random() * 0.6), tam: (extra.tam || 0.3) * (0.7 + Math.random() * 0.6), color: extra.color, giro: Math.random() * 6 });
    }
  }
  particulas(dt) {
    const x = this.x, e = this.cam.esc;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.vida += dt;
      if (q.vida > q.dura) { this.parts.splice(i, 1); continue; }
      const f = q.vida / q.dura;
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.tipo === 'polvo' || q.tipo === 'humo') { q.vx *= 1 - 1.8 * dt; q.vy = q.vy * (1 - 1.5 * dt) + 0.6 * dt; }
      else if (q.tipo === 'piedra' || q.tipo === 'nieve' || q.tipo === 'confeti' || q.tipo === 'chispa') q.vy -= (q.tipo === 'confeti' ? 3 : 14) * dt;
      else if (q.tipo === 'estrella') { q.giro += dt * 4; }
      const px = this.sx(q.x), py = this.sy(q.y);
      if (q.tipo === 'polvo') { const r = q.tam * (1 + f * 2.5) * e; x.fillStyle = rgba(q.color, 0.45 * (1 - f)); x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); }
      else if (q.tipo === 'humo') { const r = q.tam * (1 + f * 3) * e; x.fillStyle = `rgba(90,90,95,${0.35 * (1 - f)})`; x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); }
      else if (q.tipo === 'piedra') { x.fillStyle = rgba(q.color, 1 - f); x.fillRect(px, py, q.tam * 0.3 * e, q.tam * 0.25 * e); }
      else if (q.tipo === 'nieve') { x.fillStyle = `rgba(255,255,255,${0.9 * (1 - f)})`; x.beginPath(); x.arc(px, py, q.tam * 0.25 * e, 0, 6.3); x.fill(); }
      else if (q.tipo === 'chispa') { x.strokeStyle = `rgba(255,${180 + 60 * (1 - f) | 0},80,${1 - f})`; x.lineWidth = 0.04 * e; x.beginPath(); x.moveTo(px, py); x.lineTo(px - q.vx * 0.03 * e, py + q.vy * 0.03 * e); x.stroke(); }
      else if (q.tipo === 'estrella') { this.estrella(px, py, q.tam * e * (1 - f * 0.5), q.giro, 1 - f); }
      else if (q.tipo === 'confeti') { x.save(); x.translate(px, py); x.rotate(q.giro + f * 12); x.fillStyle = q.color; x.fillRect(-0.08 * e, -0.04 * e, 0.16 * e, 0.08 * e); x.restore(); }
      else if (q.tipo === 'brillo') { const r = q.tam * e * (1 - f); x.fillStyle = `rgba(255,236,150,${1 - f})`; x.beginPath(); x.moveTo(px, py - r); x.lineTo(px + r * 0.25, py); x.lineTo(px, py + r); x.lineTo(px - r * 0.25, py); x.fill(); x.beginPath(); x.moveTo(px - r, py); x.lineTo(px, py + r * 0.25); x.lineTo(px + r, py); x.lineTo(px, py - r * 0.25); x.fill(); }
    }
  }
  estrella(px, py, r, g, a) {
    const x = this.x;
    x.save(); x.translate(px, py); x.rotate(g); x.fillStyle = `rgba(255,220,60,${a})`; x.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, an = i * Math.PI / 5; x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    x.fill(); x.restore();
  }

  /* ------------------------------------------------ matas adelante de todo, oscuras y borrosas */
  pastoAdelante() {
    const x = this.x, e = this.cam.esc, V = this.V, H = this.H;
    if (V.pasto === 'sal' || e < 12) return;
    const f = 1.35, cx = this.cam.x * f;
    const x0 = cx - this.W / 2 / e - 2, x1 = cx + this.W / 2 / e + 2;
    x.fillStyle = V.pasto === 'nieve' ? 'rgba(210,225,240,0.9)' : 'rgba(40,28,16,0.85)';
    for (let u = Math.floor(x0 / 7) * 7; u < x1; u += 7) {
      const k = Math.sin(u * 3.17) * 999, r = k - Math.floor(k);
      if (r > 0.45) continue;
      const px = this.W / 2 + (u - cx) * e, h = (0.5 + r) * e;
      x.beginPath(); x.moveTo(px - h, H + 2);
      for (let j = 0; j <= 6; j++) x.lineTo(px - h + j * h / 3, H - (j % 2 ? h * (0.8 + r * 0.6) : h * 0.2));
      x.lineTo(px + h, H + 2); x.fill();
    }
  }

  /* ------------------------------------------------ el clima: viento, nieve, motas y brillos */
  climaDibujar(dt) {
    const x = this.x, W = this.W, H = this.H, V = this.V, e = this.cam.esc;
    const n = V.clima === 'nieve' ? 90 : V.clima === 'viento' ? 26 : V.clima === 'brillo' ? 14 : 30;
    while (this.clima.length < n) this.clima.push({ x: Math.random() * W, y: Math.random() * H, v: 0.4 + Math.random(), f: Math.random() * 6 });
    const dx = this.ultCamX === undefined ? 0 : (this.cam.x - this.ultCamX) * e; this.ultCamX = this.cam.x;
    for (const q of this.clima) {
      q.f += dt;
      if (V.clima === 'nieve') {
        q.x += (-40 * q.v - dx * 0.6) * dt * (W / 900) + Math.sin(q.f) * 0.3; q.y += 70 * q.v * dt * (H / 500);
        x.fillStyle = `rgba(255,255,255,${0.5 + q.v * 0.3})`; x.beginPath(); x.arc(q.x, q.y, (1.2 + q.v * 1.8) * (H / 500), 0, 6.3); x.fill();
      } else if (V.clima === 'viento') {
        q.x -= (700 * q.v) * dt * (W / 900) + dx * 0.8; q.y += Math.sin(q.f * 2) * 0.4;
        x.strokeStyle = `rgba(255,255,255,${0.12 + q.v * 0.12})`; x.lineWidth = 1.5 * (H / 500);
        x.beginPath(); x.moveTo(q.x, q.y); x.quadraticCurveTo(q.x + 60 * q.v, q.y - 6, q.x + 140 * q.v, q.y + 2); x.stroke();
      } else if (V.clima === 'brillo') {
        q.x -= dx * 0.9;
        const b = Math.max(0, Math.sin(q.f * 2.2)); if (b > 0.2) { x.fillStyle = `rgba(255,255,255,${b * 0.7})`; const r = 3 * b * (H / 500); x.fillRect(q.x - r, q.y - 0.5, r * 2, 1); x.fillRect(q.x - 0.5, q.y - r, 1, r * 2); }
      } else {
        q.x += -10 * dt + Math.sin(q.f * 0.7) * 0.2 - dx * 0.5; q.y += Math.cos(q.f * 0.9) * 0.25 - 4 * dt;
        x.fillStyle = rgba(V.polvo, 0.35); x.beginPath(); x.arc(q.x, q.y, 1.4 * (H / 500) * q.v, 0, 6.3); x.fill();
      }
      if (q.x < -160) { q.x = W + Math.random() * 60; q.y = Math.random() * H; }
      if (q.x > W + 170) { q.x = -Math.random() * 60; q.y = Math.random() * H; }
      if (q.y > H + 10) { q.y = -10; q.x = Math.random() * W * 1.2; }
      if (q.y < -12) q.y = H + 8;
    }
    /* el aire de la Patagonia es más gris; la nieve, más fría */
    if (V.clima === 'nieve') { x.fillStyle = 'rgba(200,220,245,0.08)'; x.fillRect(0, 0, W, H); }
    /* una viñeta suave */
    const g = x.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.28)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------ los cartelitos que suben (trucos, monedas) */
  cartel(texto, xw, yw, color = '#fff', grande = false) { this.textos.push({ texto, x: xw, y: yw, vida: 0, color, grande }); }
  cartelitos(dt) {
    const x = this.x, e = this.cam.esc, H = this.H;
    for (let i = this.textos.length - 1; i >= 0; i--) {
      const q = this.textos[i];
      q.vida += dt;
      const dura = q.grande ? 1.9 : 1.1;
      if (q.vida > dura) { this.textos.splice(i, 1); continue; }
      const f = q.vida / dura, sube = q.vida * (q.grande ? 1.0 : 1.6);
      const px = this.sx(q.x), py = this.sy(q.y + sube);
      const esc = q.grande ? Math.min(1, q.vida * 6) * (1 + 0.15 * Math.max(0, 1 - q.vida * 4)) : 1;
      const tam = (q.grande ? 0.052 : 0.036) * H * esc;
      x.save(); x.globalAlpha = f > 0.75 ? (1 - f) / 0.25 : 1;
      x.font = `900 ${tam}px Overpass, sans-serif`; x.textAlign = 'center'; x.lineJoin = 'round';
      x.lineWidth = tam * 0.22; x.strokeStyle = 'rgba(20,14,8,0.85)'; x.strokeText(q.texto, px, py);
      x.fillStyle = q.color; x.fillText(q.texto, px, py);
      x.restore();
    }
  }
}
