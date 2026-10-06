/* ============================================================================
   barro/js/dibujo.js — todo lo que se ve en la carrera, en un lienzo 2D:
   el cielo y los fondos pintados en capas (paralaje), los árboles, la pista
   como en Mad Skills (la cara de tierra con sus vetas que siguen la curva,
   el pasto en el borde de atrás, los surcos), el portón de largada, la meta,
   las motos en sus carriles con su sombra, el polvo y los terrones, los
   pilotos que salen volando y el frente oscuro.
   ========================================================================== */
import { altoEn, anguloEn, difAng } from './fisica.js';
import { dibujarMoto, dibujarPilotoSuelto, tono } from './moto.js';
import { img } from './arte.js';
import { MUNDOS_VISTA } from './mundos.js';
import { azar } from './pistas.js';

const TEX_M = 9;            // metros que cubre la textura de tierra
const BORDE = 1.7;          // a qué altura sobre la línea de carrera está el borde de atrás
const PROF = 1.75;          // cuánto baja en pantalla un metro de profundidad (carril)

export function crearVista(canvas) {
  const V = {
    canvas, ctx: canvas.getContext('2d'), W: 1, H: 1, dpr: 1, calidad: 2,
    cam: { x: 0, y: 0, z: 30, sac: 0, sx: 0, sy: 0, ax: 0.3, ay: 0.58 },
    part: [], sueltos: [], pista: null, decor: null, mundo: 'bosque', t: 0, lluvia: [],
  };
  return V;
}

export function medir(V, calidad = V.calidad) {
  V.calidad = calidad;
  const dprMax = calidad >= 2 ? 2.5 : calidad === 1 ? 1.75 : 1.25;
  V.dpr = Math.min(window.devicePixelRatio || 1, dprMax);
  V.W = V.canvas.clientWidth || window.innerWidth; V.H = V.canvas.clientHeight || window.innerHeight;
  V.canvas.width = Math.round(V.W * V.dpr); V.canvas.height = Math.round(V.H * V.dpr);
  V.parado = V.H > V.W * 1.05;
}

/* ---------- los adornos de una pista (con su semilla) ---------- */
export function prepararPista(V, pista) {
  V.pista = pista; V.mundo = pista.mundo; V.part.length = 0; V.sueltos.length = 0;
  const r = azar(pista.semilla || 7), M = MUNDOS_VISTA[pista.mundo];
  const arboles = [], frente = [], postes = [], carteles = [], fardos = [];
  for (let x = -40; x < pista.largo + 80; x += 7 + r() * 16) {
    const p = 0.5 + r() * 0.3;
    arboles.push({ x, p, i: Math.floor(r() * M.arboles), alto: 7 + r() * 6, espejo: r() < 0.5 });
  }
  arboles.sort((a, b) => a.p - b.p);
  for (let x = -20; x < pista.largo + 60; x += 3.5 + r() * 6) frente.push({ x, i: Math.floor(r() * M.frente), alto: 2.2 + r() * 2.2, espejo: r() < 0.5 });
  for (let x = 10; x < pista.largo + 30; x += 14) postes.push({ x: x + r() * 3, c: r() < 0.5 ? '#e8392f' : '#f2c21a' });
  const textos = ['BARRO', 'JXSTUDIOS', 'A FONDO', 'MX', 'BARRO', 'NÚMERO 1'];
  for (let x = 60; x < pista.largo; x += 70 + r() * 60) carteles.push({ x, t: textos[Math.floor(r() * textos.length)], c: ['#d8242a', '#1f5bd8', '#141414', '#f2c21a'][Math.floor(r() * 4)] });
  for (let x = 30; x < pista.largo; x += 40 + r() * 50) fardos.push({ x, n: 1 + Math.floor(r() * 3) });
  V.decor = { arboles, frente, postes, carteles, fardos };
  V.lluvia = Array.from({ length: 140 }, () => [Math.random(), Math.random(), 0.6 + Math.random() * 0.4]);
}

/* ---------- la cámara ---------- */
export function moverCamara(V, foco, dt, inmediato = false) {
  const c = V.cam, P = V.pista;
  const M = foco.moto;
  const v = Math.hypot(M.vx, M.vy);
  const base = V.parado ? V.W / 11.5 : Math.min(V.W / 26, V.H / 11);
  const aire = Math.min(1, M.aire / 0.8);
  const zObj = base * (1 - 0.15 * aire - 0.1 * Math.min(1, v / 27));
  c.ax = V.parado ? 0.3 : 0.32; c.ay = V.parado ? 0.56 : 0.6;
  const xObj = M.x + Math.max(-1, Math.min(V.parado ? 1.6 : 5, M.vx * (V.parado ? 0.08 : 0.2)));
  const yObj = 0.55 * (M.y - 0.8) + 0.45 * altoEn(P.suelo, M.x + 8);
  const k = (v) => (inmediato ? 1 : 1 - Math.exp(-dt * v));
  c.z += (zObj - c.z) * k(2.2);
  c.x += (xObj - c.x) * k(9);
  c.y += (yObj - c.y) * k(4.5);
  c.sac *= Math.exp(-dt * 7);
  c.sx = (Math.random() * 2 - 1) * c.sac; c.sy = (Math.random() * 2 - 1) * c.sac;
}
export function sacudir(V, fuerza) { V.cam.sac = Math.max(V.cam.sac, fuerza); }

const aX = (V, x) => V.W * V.cam.ax + (x - V.cam.x) * V.cam.z + V.cam.sx;
const aY = (V, y) => V.H * V.cam.ay - (y - V.cam.y) * V.cam.z + V.cam.sy;
const mundoX = (V, sx) => V.cam.x + (sx - V.W * V.cam.ax) / V.cam.z;

/* ---------- partículas ---------- */
export function polvo(V, x, y, n, fuerza = 1, col) {
  const lim = V.calidad >= 2 ? 420 : V.calidad === 1 ? 260 : 120;
  const C = col || MUNDOS_VISTA[V.mundo].polvo;
  for (let i = 0; i < n && V.part.length < lim; i++) {
    V.part.push({ t: 'polvo', x: x + (Math.random() - 0.5) * 0.6, y: y + Math.random() * 0.3, vx: (Math.random() - 0.5) * 3 * fuerza, vy: Math.random() * 1.6 * fuerza, vida: 0, dura: 0.7 + Math.random() * 0.9, r: 0.25 + Math.random() * 0.35, c: C });
  }
}
export function terrones(V, x, y, vx, vy, n, col) {
  const lim = V.calidad >= 2 ? 420 : V.calidad === 1 ? 260 : 120;
  const C = col || (V.mundo === 'selva' ? [70, 48, 26] : [120, 78, 44]);
  for (let i = 0; i < n && V.part.length < lim; i++) {
    V.part.push({ t: 'terron', x, y, vx: vx * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * 2, vy: vy * (0.5 + Math.random() * 0.8) + Math.random() * 2, vida: 0, dura: 0.6 + Math.random() * 0.5, r: 0.03 + Math.random() * 0.06, g: Math.random() * 6, c: C });
  }
}
export function humo(V, x, y) {
  if (V.part.length > 300) return;
  V.part.push({ t: 'humo', x, y, vx: -0.6 - Math.random(), vy: 0.4 + Math.random() * 0.4, vida: 0, dura: 0.6, r: 0.08, c: [200, 200, 205] });
}
function moverParticulas(V, dt) {
  const S = V.pista.suelo;
  for (let i = V.part.length - 1; i >= 0; i--) {
    const p = V.part[i];
    p.vida += dt;
    if (p.vida > p.dura) { V.part[i] = V.part[V.part.length - 1]; V.part.pop(); continue; }
    if (p.t === 'terron') {
      p.vy -= 13 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.g += p.vx * dt * 3;
      const h = altoEn(S, p.x);
      if (p.y < h) { p.y = h; p.vy *= -0.3; p.vx *= 0.5; }
    } else {
      p.vx *= Math.exp(-dt * 2); p.vy *= Math.exp(-dt * 1.5);
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * (p.t === 'humo' ? 0.5 : 0.9);
    }
  }
  for (let i = V.sueltos.length - 1; i >= 0; i--) {
    const s = V.sueltos[i];
    s.t += dt; s.vy -= 13 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.w * dt;
    const h = altoEn(S, s.x) + 0.25;
    if (s.y < h) { s.y = h; s.vy = Math.abs(s.vy) * 0.35; s.vx *= 0.6; s.w *= 0.6; if (Math.abs(s.vy) > 1.5) polvo(V, s.x, h - 0.2, 3, 0.8); }
  }
}
/* un piloto que sale volando (lo suelta la carrera al caerse) */
export function soltarPiloto(V, c) {
  const M = c.moto;
  V.sueltos = V.sueltos.filter((s) => s.c !== c.i);
  V.sueltos.push({ c: c.i, colores: c.colores, x: M.x + Math.cos(M.a + 1.4) * 0.8, y: M.y + Math.sin(M.a + 1.4) * 0.8, vx: M.vx * 0.8 + 1, vy: Math.max(2, M.vy + 3), a: M.a, w: -6 - Math.random() * 4, t: 0, carril: c.carril });
  polvo(V, M.x, altoEn(V.pista.suelo, M.x), 14, 1.6);
  terrones(V, M.x, altoEn(V.pista.suelo, M.x) + 0.1, M.vx * 0.3, 3, 16);
}
export function levantarPiloto(V, c) { V.sueltos = V.sueltos.filter((s) => s.c !== c.i); }

/* ---------- el dibujo de un cuadro ---------- */
export function dibujar(V, C, dt, opciones = {}) {
  const ctx = V.ctx, W = V.W, H = V.H, P = V.pista, S = P.suelo, VM = MUNDOS_VISTA[V.mundo];
  V.t += dt;
  moverParticulas(V, dt);
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  const z = V.cam.z;

  // --- cielo
  const cielo = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  cielo.addColorStop(0, VM.cielo[0]); cielo.addColorStop(1, VM.cielo[1]);
  ctx.fillStyle = cielo; ctx.fillRect(0, 0, W, H);
  const sol = VM.sol;
  const gs = ctx.createRadialGradient(W * sol[0], H * sol[1], 0, W * sol[0], H * sol[1], Math.max(W, H) * 0.45);
  gs.addColorStop(0, sol[2]); gs.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gs; ctx.fillRect(0, 0, W, H);

  // la línea del borde de atrás de la pista, bajo el centro de la pantalla
  const yBorde = aY(V, altoEn(S, V.cam.x + 4) + BORDE);

  // --- lejos: montañas
  const lejos = img(`${V.mundo}-lejos`);
  if (lejos) {
    const alto = Math.max(H * (V.parado ? 0.5 : 0.62), W * 0.42);
    const ancho = alto * (lejos.width / lejos.height);
    const base = yBorde - alto * 0.5 + (V.cam.y * z * 0.04);
    let x0 = -(((V.cam.x * z * 0.05) % ancho) + ancho) % ancho;
    for (let x = x0 - ancho, k = 0; x < W; x += ancho, k++) {
      ctx.save();
      const espejo = Math.floor((V.cam.x * z * 0.05 + x - x0) / ancho) % 2 !== 0;
      if (espejo) { ctx.translate(x + ancho, 0); ctx.scale(-1, 1); ctx.drawImage(lejos, 0, base - alto * 0.5, ancho, alto); }
      else ctx.drawImage(lejos, x, base - alto * 0.5, ancho, alto);
      ctx.restore();
    }
    const gn = ctx.createLinearGradient(0, base - alto * 0.15, 0, base + alto * 0.5);
    gn.addColorStop(0, 'rgba(255,255,255,0)'); gn.addColorStop(1, VM.niebla);
    ctx.fillStyle = gn; ctx.fillRect(0, base - alto * 0.15, W, alto * 0.65);
  }
  // --- medio: el bosque
  const medio = img(`${V.mundo}-medio`);
  if (medio) {
    const ancho = Math.max(W * 1.25, 900), alto = ancho * (medio.height / medio.width);
    const base = yBorde + alto * 0.12 + V.cam.y * z * 0.12;
    const corr = V.cam.x * z * 0.2;
    let x0 = -((corr % ancho) + ancho) % ancho;
    for (let x = x0 - ancho; x < W; x += ancho) {
      const n = Math.floor((corr + x - x0) / ancho);
      ctx.save();
      if (n % 2 !== 0) { ctx.translate(x + ancho, 0); ctx.scale(-1, 1); ctx.drawImage(medio, 0, base - alto, ancho, alto); }
      else ctx.drawImage(medio, x, base - alto, ancho, alto);
      ctx.restore();
    }
  }
  // --- árboles sueltos, con paralaje propio
  for (const a of V.decor.arboles) {
    const sprite = img(`${V.mundo}-arbol${a.i}`);
    if (!sprite) continue;
    const sx = W * V.cam.ax + (a.x - V.cam.x) * z * a.p;
    const alto = a.alto * z * (0.55 + 0.45 * a.p) * 0.9;
    const ancho = alto * (sprite.width / sprite.height);
    if (sx < -ancho || sx > W + ancho) continue;
    const base = aY(V, altoEn(S, mundoX(V, sx)) + BORDE) - 4 + (1 - a.p) * 18;
    ctx.save();
    ctx.globalAlpha = 0.75 + 0.25 * a.p;
    if (a.espejo) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(sprite, -ancho / 2, base - alto, ancho, alto); }
    else ctx.drawImage(sprite, sx - ancho / 2, base - alto, ancho, alto);
    ctx.restore();
  }

  // --- la pista
  const tierra = img(V.mundo === 'bosque' ? 'tierra' : `tierra-${V.mundo}`) || img('tierra');
  const pasto = img(V.mundo === 'bosque' ? 'pasto' : `pasto-${V.mundo}`) || img('pasto');
  const paso = V.calidad >= 2 ? 3 : 4;
  // fondo oscuro bajo la cara (por si la textura no llega)
  ctx.fillStyle = VM.abajo;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let sx = 0; sx <= W + paso; sx += paso) ctx.lineTo(sx, aY(V, altoEn(S, mundoX(V, sx)) + BORDE));
  ctx.lineTo(W + paso, H); ctx.closePath(); ctx.fill();
  if (tierra) {
    const tw = tierra.width, th = tierra.height, pxm = tw / TEX_M, altoT = TEX_M * z;
    for (let sx = 0; sx < W + paso; sx += paso) {
      const wx = mundoX(V, sx);
      const y0 = aY(V, altoEn(S, wx) + BORDE);
      let src = (wx * pxm) % tw; if (src < 0) src += tw;
      const sw = Math.max(1, (paso / z) * pxm);
      for (let y = y0, k = 0; y < H && k < 4; y += altoT, k++) ctx.drawImage(tierra, Math.min(src, tw - sw), 0, sw, th, sx, y, paso + 0.6, altoT + 0.5);
    }
  }
  // luz y sombra de la cara: clara arriba, oscura abajo
  const gl = ctx.createLinearGradient(0, yBorde - 40, 0, H);
  gl.addColorStop(0, 'rgba(255,236,200,0.16)'); gl.addColorStop(0.1, 'rgba(255,236,200,0.0)');
  gl.addColorStop(0.38, 'rgba(30,14,5,0.22)'); gl.addColorStop(0.72, 'rgba(14,7,3,0.62)'); gl.addColorStop(1, 'rgba(8,4,2,0.88)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let sx = 0; sx <= W + paso; sx += paso) ctx.lineTo(sx, aY(V, altoEn(S, mundoX(V, sx)) + BORDE));
  ctx.lineTo(W + paso, H); ctx.closePath(); ctx.fill();
  // barro: manchas oscuras y brillosas
  if (S.lodo) {
    ctx.fillStyle = 'rgba(40,24,10,0.45)';
    for (let sx = 0; sx < W; sx += paso) {
      const wx = mundoX(V, sx), i = Math.round(wx / S.dx);
      if (S.lodo[i]) { const y = aY(V, altoEn(S, wx)); ctx.fillRect(sx, y - 0.7 * z, paso + 0.5, 2.6 * z); }
    }
  }
  // surcos de los carriles
  ctx.lineWidth = Math.max(1.5, z * 0.06); ctx.strokeStyle = 'rgba(55,30,12,0.28)';
  for (const d of [-0.3, 0.1, 0.5]) {
    ctx.beginPath();
    for (let sx = 0; sx <= W + paso; sx += paso * 2) { const y = aY(V, altoEn(S, mundoX(V, sx))) + d * z * PROF + 0.36 * z; sx ? ctx.lineTo(sx, y) : ctx.moveTo(sx, y); }
    ctx.stroke();
  }
  // borde de atrás: filo iluminado y pasto
  ctx.lineWidth = Math.max(2, z * 0.08); ctx.strokeStyle = VM.borde;
  ctx.beginPath();
  for (let sx = 0; sx <= W + paso; sx += paso) { const y = aY(V, altoEn(S, mundoX(V, sx)) + BORDE) + 1.5; sx ? ctx.lineTo(sx, y) : ctx.moveTo(sx, y); }
  ctx.stroke();

  // --- cosas del costado de atrás (detrás de las motos): postes, carteles, fardos, portón, meta
  dibujarCostado(V, ctx, C, pasto);

  // --- las motos, del carril de atrás al de adelante
  const orden = [...C.corredores].sort((a, b) => a.carril - b.carril);
  for (const c of orden) dibujarCorredor(V, ctx, C, c);
  // pilotos volando
  for (const s of V.sueltos) {
    const sx = aX(V, s.x), sy = aY(V, s.y) + s.carril * z * PROF;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(z, -z); dibujarPilotoSuelto(ctx, s.colores, s.a); ctx.restore();
  }
  // --- partículas
  for (const p of V.part) {
    const sx = aX(V, p.x), sy = aY(V, p.y) + 0.25 * z * PROF;
    const k = 1 - p.vida / p.dura;
    if (p.t === 'terron') {
      ctx.fillStyle = `rgb(${p.c[0]},${p.c[1]},${p.c[2]})`;
      const r = p.r * z;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.g); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
    } else {
      ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${(p.t === 'humo' ? 0.35 : 0.42) * k})`;
      ctx.beginPath(); ctx.arc(sx, sy, p.r * z, 0, Math.PI * 2); ctx.fill();
    }
  }

  // --- el frente: siluetas oscuras abajo
  for (const f of V.decor.frente) {
    const sprite = img(`${V.mundo}-frente${f.i}`);
    if (!sprite) continue;
    const sx = W * V.cam.ax + (f.x - V.cam.x) * z * 1.28;
    const alto = f.alto * z * 1.2, ancho = alto * (sprite.width / sprite.height);
    if (sx < -ancho || sx > W + ancho) continue;
    ctx.save(); ctx.filter = V.calidad >= 1 ? 'brightness(0.22) saturate(0.6)' : 'none';
    if (f.espejo) { ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(sprite, -ancho / 2, H - alto * 0.85, ancho, alto); }
    else ctx.drawImage(sprite, sx - ancho / 2, H - alto * 0.85, ancho, alto);
    ctx.restore();
  }

  // una franja de pasto oscuro bien abajo (el primer plano, como en el video)
  ctx.fillStyle = '#0d0905';
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let sx = 0; sx <= W + 8; sx += 8) {
    const wx = V.cam.x * 1.28 + sx / z;
    const h = H * 0.035 + Math.abs(Math.sin(wx * 1.7) * Math.sin(wx * 0.43)) * H * 0.035 + (Math.sin(wx * 5.3) > 0.6 ? H * 0.025 : 0);
    ctx.lineTo(sx, H - h);
  }
  ctx.lineTo(W + 8, H); ctx.closePath(); ctx.fill();

  // --- clima y luz
  if (VM.lluvia) {
    ctx.strokeStyle = 'rgba(220,235,255,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const g of V.lluvia) {
      g[1] += dt * g[2] * 1.6; if (g[1] > 1.1) { g[1] = -0.1; g[0] = Math.random(); }
      const x = ((g[0] * W * 1.2 - V.cam.x * z * 0.3 * g[2]) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1, y = g[1] * H;
      ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16);
    }
    ctx.stroke();
  }
  if (VM.noche) dibujarNoche(V, ctx);
  if (VM.luz) { ctx.fillStyle = VM.luz; ctx.fillRect(0, 0, W, H); }
  // viñeta
  if (V.calidad >= 1) {
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (opciones.indicadores !== false) indicadores(V, ctx, C);
}

function dibujarCostado(V, ctx, C, pasto) {
  const P = V.pista, S = P.suelo, z = V.cam.z, W = V.W;
  const xIni = mundoX(V, -60), xFin = mundoX(V, W + 60);
  // pasto en el borde de atrás (en tiras que siguen la curva)
  if (pasto) {
    const pw = pasto.width, ph = pasto.height, pxm = pw / 6, alto = 1.25 * z, paso = V.calidad >= 2 ? 3 : 4;
    for (let sx = 0; sx < W + paso; sx += paso) {
      const wx = mundoX(V, sx), y = aY(V, altoEn(S, wx) + BORDE);
      let src = (wx * pxm) % pw; if (src < 0) src += pw;
      const sw = Math.max(1, (paso / z) * pxm);
      ctx.drawImage(pasto, Math.min(src, pw - sw), 0, sw, ph, sx, y - alto * 0.72, paso + 0.6, alto);
    }
  }
  // postes con banderín
  for (const p of V.decor.postes) {
    if (p.x < xIni || p.x > xFin) continue;
    const x = aX(V, p.x), y = aY(V, altoEn(S, p.x) + BORDE);
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = Math.max(1.5, z * 0.05);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 1.3 * z); ctx.stroke();
    const flamea = Math.sin(V.t * 6 + p.x) * 0.12 * z;
    ctx.fillStyle = p.c; ctx.beginPath(); ctx.moveTo(x, y - 1.3 * z); ctx.lineTo(x + 0.5 * z, y - 1.15 * z + flamea); ctx.lineTo(x, y - 1.0 * z); ctx.closePath(); ctx.fill();
  }
  // fardos de pasto
  for (const f of V.decor.fardos) {
    if (f.x < xIni || f.x > xFin) continue;
    for (let k = 0; k < f.n; k++) {
      const x = aX(V, f.x + k * 1.05), y = aY(V, altoEn(S, f.x + k * 1.05) + BORDE);
      ctx.fillStyle = '#d9b45a'; ctx.strokeStyle = '#4a3214'; ctx.lineWidth = Math.max(1, z * 0.035);
      ctx.beginPath(); ctx.rect(x - 0.5 * z, y - 0.55 * z, 1.0 * z, 0.55 * z); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,80,20,0.6)'; ctx.beginPath(); ctx.moveTo(x - 0.5 * z, y - 0.2 * z); ctx.lineTo(x + 0.5 * z, y - 0.2 * z); ctx.stroke();
    }
  }
  // carteles en el alambrado
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of V.decor.carteles) {
    if (c.x < xIni - 6 || c.x > xFin + 6) continue;
    const x = aX(V, c.x), y = aY(V, altoEn(S, c.x) + BORDE);
    const w = 5.2 * z, h = 0.9 * z;
    ctx.fillStyle = '#2a2018'; ctx.fillRect(x - w / 2, y - h - 0.35 * z, Math.max(2, z * 0.06), h + 0.35 * z); ctx.fillRect(x + w / 2 - Math.max(2, z * 0.06), y - h - 0.35 * z, Math.max(2, z * 0.06), h + 0.35 * z);
    ctx.fillStyle = c.c; ctx.fillRect(x - w / 2, y - h - 0.35 * z, w, h);
    ctx.fillStyle = c.c === '#f2c21a' ? '#141414' : '#f4f1ea';
    ctx.font = `italic 800 ${Math.round(h * 0.75)}px Barlow, Impact, sans-serif`;
    ctx.fillText(c.t, x, y - h / 2 - 0.35 * z + 1);
  }
  // portón de largada
  if (P.xLargada > xIni && P.xLargada < xFin) {
    const caida = Math.max(0, Math.min(1, C.t / 0.28));
    for (const c of C.corredores) {
      const gx = (c.x0 ?? P.xLargada) + 1.25, x = aX(V, gx), y = aY(V, altoEn(S, gx)) + c.carril * z * PROF + 0.36 * z;
      ctx.save(); ctx.translate(x, y); ctx.rotate(caida * Math.PI * 0.48);
      ctx.fillStyle = '#9aa1aa'; ctx.strokeStyle = '#1e1e22'; ctx.lineWidth = Math.max(1, z * 0.03);
      ctx.beginPath(); ctx.rect(-0.05 * z, -0.6 * z, 0.1 * z, 0.6 * z); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8392f'; ctx.fillRect(-0.05 * z, -0.6 * z, 0.1 * z, 0.12 * z);
      ctx.restore();
    }
  }
  // la meta: arco a cuadros
  if (P.xMeta > xIni - 4 && P.xMeta < xFin + 4) {
    const x = aX(V, P.xMeta), yb = aY(V, altoEn(S, P.xMeta) + BORDE), yd = aY(V, altoEn(S, P.xMeta)) + 1.3 * z;
    const alto = 4.2 * z;
    ctx.fillStyle = '#26262b';
    ctx.fillRect(x - 0.08 * z, yb - alto, 0.16 * z, alto);
    // bandera a cuadros arriba
    const ca = 0.35 * z;
    for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#f4f1ea' : '#141414'; ctx.fillRect(x - 2.1 * z + i * ca, yb - alto + j * ca, ca, ca); }
    ctx.fillStyle = '#f4f1ea'; ctx.font = `italic 800 ${Math.round(0.55 * z)}px Barlow, Impact, sans-serif`;
    ctx.fillText('META', x, yb - alto - 0.4 * z);
    // la línea en el piso
    for (let k = 0; k < 10; k++) { ctx.fillStyle = k % 2 ? '#f4f1ea' : '#141414'; ctx.fillRect(x - 0.12 * z, yb + k * (yd - yb) / 10, 0.24 * z, (yd - yb) / 10 + 1); }
  }
}

function dibujarCorredor(V, ctx, C, c) {
  const M = c.moto, S = V.pista.suelo, z = V.cam.z;
  const sx = aX(V, M.x);
  if (sx < -3 * z || sx > V.W + 3 * z) return;
  const prof = c.carril * z * PROF;
  const esc = z * (1 + c.carril * 0.05);
  // sombra en el piso
  const hs = altoEn(S, M.x), alto = Math.max(0, M.y - 0.78 - hs);
  const k = Math.max(0, 1 - alto / 7);
  ctx.fillStyle = `rgba(20,10,4,${0.38 * k})`;
  ctx.beginPath(); ctx.ellipse(sx, aY(V, hs) + prof + 0.36 * z, 1.05 * esc * (0.6 + 0.4 * k), 0.16 * esc, 0, 0, Math.PI * 2); ctx.fill();
  // la moto (si se cayó y el piloto voló, la moto sola)
  const cs = Math.cos(-M.a), sn = Math.sin(-M.a);
  const loc = (wx, wy) => { const dx = wx - M.x, dy = wy - M.y; return [dx * cs - dy * sn, dx * sn + dy * cs]; };
  const [rx, ry] = loc(M.ruedas[0].cx, M.ruedas[0].cy), [fx, fy] = loc(M.ruedas[1].cx, M.ruedas[1].cy);
  const inp = c.vistaIncl ?? 0;
  const comp = (M.ruedas[0].comp + M.ruedas[1].comp) / 2;
  c.agache = (c.agache || 0) + ((M.aire > 0.05 ? 0 : Math.min(1, comp / 0.18)) - (c.agache || 0)) * 0.3;
  const parado = C.t < 0 ? 0.35 : 1;
  const sy = aY(V, M.y) + prof;
  ctx.save();
  ctx.translate(sx, sy); ctx.scale(esc, -esc); ctx.rotate(M.a);
  if (M.invulnerable > 0 && Math.floor(M.invulnerable * 10) % 2) ctx.globalAlpha = 0.45;
  dibujarMoto(ctx, { rx, ry, fx, fy, giro0: M.ruedas[0].giro, giro1: M.ruedas[1].giro, colores: c.colores, numero: c.numero, pose: { incl: inp, agache: c.agache, parado }, sinPiloto: !!c.caida });
  ctx.restore();
  // la etiqueta de los rivales (número y nombre)
  if (!c.jugador && !c.caida && V.etiquetas !== false && C.t > 2.5) {
    ctx.font = `italic 800 ${Math.round(Math.max(11, z * 0.42))}px Barlow, Impact, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const ty = sy - 2.05 * esc - (c.carril + 0.5) * 0.25 * z;
    ctx.fillStyle = 'rgba(10,8,6,0.55)'; ctx.fillText(c.nombre, sx + 1, ty + 1);
    ctx.fillStyle = '#f4f1ea'; ctx.fillText(c.nombre, sx, ty);
  } else if (c.jugador && !c.caida) {
    const ty = sy - 2.2 * esc;
    ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#17110c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - 0.22 * z, ty - 0.3 * z); ctx.lineTo(sx + 0.22 * z, ty - 0.3 * z); ctx.lineTo(sx, ty); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

/* los que quedaron fuera de la pantalla: una flecha con los metros */
function indicadores(V, ctx, C) {
  const yo = C.corredores.find((c) => c.jugador);
  if (!yo) return;
  ctx.font = `italic 800 13px Barlow, Impact, sans-serif`; ctx.textBaseline = 'middle';
  let izq = 0, der = 0;
  for (const c of C.corredores) {
    if (c === yo) continue;
    const sx = aX(V, c.moto.x);
    if (sx > -10 && sx < V.W + 10) continue;
    const d = Math.round(c.moto.x - yo.moto.x);
    const delante = d > 0;
    const y = V.H * 0.2 + (delante ? der++ : izq++) * 26;
    const x = delante ? V.W - 8 : 8;
    ctx.fillStyle = c.colores.moto; ctx.strokeStyle = '#17110c'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (delante) { ctx.moveTo(x, y); ctx.lineTo(x - 12, y - 9); ctx.lineTo(x - 12, y + 9); }
    else { ctx.moveTo(x, y); ctx.lineTo(x + 12, y - 9); ctx.lineTo(x + 12, y + 9); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4f1ea'; ctx.textAlign = delante ? 'right' : 'left';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    const txt = `${delante ? '+' : ''}${d} m`;
    ctx.strokeText(txt, delante ? x - 16 : x + 16, y); ctx.fillText(txt, delante ? x - 16 : x + 16, y);
  }
}

function dibujarNoche(V, ctx) {
  const W = V.W, H = V.H;
  ctx.fillStyle = 'rgba(8,10,30,0.35)'; ctx.fillRect(0, 0, W, H);
  // torres de luz con su cono
  const z = V.cam.z;
  for (let k = -1; k < 3; k++) {
    const xm = Math.floor(V.cam.x / 60) * 60 + k * 60 + 30;
    const sx = W * V.cam.ax + (xm - V.cam.x) * z * 0.6;
    if (sx < -200 || sx > W + 200) continue;
    const top = H * 0.08;
    const g = ctx.createLinearGradient(sx, top, sx, H * 0.75);
    g.addColorStop(0, 'rgba(255,250,220,0.35)'); g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 10, top); ctx.lineTo(sx + 10, top); ctx.lineTo(sx + W * 0.35, H * 0.75); ctx.lineTo(sx - W * 0.35, H * 0.75); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fffbe8'; ctx.shadowColor = '#fff6c8'; ctx.shadowBlur = 18;
    ctx.fillRect(sx - 16, top - 6, 32, 10); ctx.shadowBlur = 0;
    ctx.fillStyle = '#20232e'; ctx.fillRect(sx - 2, top + 4, 4, H * 0.2);
  }
}

export { aX, aY };
