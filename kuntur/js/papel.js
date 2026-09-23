/* ============================================================================
   kuntur/js/papel.js — el mundo de papel (como en Paper Mario).
   - Los personajes son recortes: el dibujo (pixel art de sprites.js) impreso
     en papel, con su borde blanco y la sombrita del corte. Es un plano de
     dos caras: al darse vuelta gira como una hoja y del otro lado se ve el
     mismo dibujo al revés.
   - El terreno es cartón: el frente pintado con capas de papel de colores con
     el borde rasgado, el techo de papel pasto y los costados de cartón
     corrugado. Atrás, capas recortadas de cerros como en un teatrito, y el
     sol, la luna, las nubes y las estrellas cuelgan de hilos.
   ========================================================================== */
import * as THREE from 'three';
import { B, baldosa } from './fisica.js';
import { hash, ruido, fbm, mulberry } from './azar.js';
import { TREN_VAGONES } from './mapas.js';

function lienzo(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return [c, c.getContext('2d')]; }
function aTex(c, rep) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}

/* ---------------- la textura del papel: fibras y granito ---------------- */
let grano = null;
export function granoPapel() {
  if (grano) return grano;
  const [c, g] = lienzo(256, 256);
  const img = g.createImageData(256, 256), d = img.data;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const n = ruido(x * 0.08, y * 0.08, 3) * 0.5 + ruido(x * 0.35, y * 0.35, 4) * 0.3 + hash(x, y, 5) * 0.2;
    const v = Math.round(215 + n * 40), i = (y * 256 + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  /* fibras: rayitas largas y claras */
  g.globalAlpha = 0.18; g.strokeStyle = '#ffffff';
  const r = mulberry(7);
  for (let i = 0; i < 120; i++) { const x = r() * 256, y = r() * 256, a = r() * Math.PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke(); }
  grano = c;
  return c;
}
/* pintar grano encima de lo que ya hay, sin tocar lo transparente */
function granear(g, w, h, fuerza) {
  const copia = document.createElement('canvas'); copia.width = w; copia.height = h;
  copia.getContext('2d').drawImage(g.canvas, 0, 0);
  g.save();
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = fuerza == null ? 0.55 : fuerza;
  g.fillStyle = g.createPattern(granoPapel(), 'repeat'); g.fillRect(0, 0, w, h);
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(copia, 0, 0);
  g.restore();
}

/* ============================================================================
   RECORTES: de pixel art (Lienzo) a una hoja recortada con borde blanco
   ========================================================================== */
export function textoRecorte(L, o) {
  o = o || {};
  const k = o.k || 6, borde = o.borde == null ? 2.2 : o.borde, m = Math.ceil(borde + 2);
  const W = (L.w + m * 2) * k, H = (L.h + m * 2) * k;
  /* la silueta */
  const [s, gs] = lienzo(W, H);
  gs.fillStyle = '#fff';
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (L.p[y * L.w + x]) gs.fillRect((x + m) * k, (L.h - 1 - y + m) * k, k, k);
  /* el corte: la silueta agrandada en redondo */
  const [b, gb] = lienzo(W, H), r = borde * k;
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; gb.drawImage(s, Math.cos(a) * r, Math.sin(a) * r); gb.drawImage(s, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); }
  gb.drawImage(s, 0, 0);
  gb.globalCompositeOperation = 'source-in'; gb.fillStyle = o.colBorde || '#f7f3ea'; gb.fillRect(0, 0, W, H);
  /* armar: el filo (sombrita del corte), el papel, el dibujo, el grano */
  const [c, g] = lienzo(W, H);
  g.globalAlpha = 0.45; g.drawImage(b, 1.5, 2.5); g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#6a5a4a'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.drawImage(b, 0, 0);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const col = L.p[y * L.w + x]; if (col) { g.fillStyle = col; g.fillRect((x + m) * k, (L.h - 1 - y + m) * k, k, k); } }
  const [t, gt] = lienzo(W, H);
  gt.drawImage(c, 0, 0);
  gt.globalCompositeOperation = 'multiply'; gt.globalAlpha = 0.45; gt.fillStyle = gt.createPattern(granoPapel(), 'repeat'); gt.fillRect(0, 0, W, H);
  gt.globalAlpha = 1; gt.globalCompositeOperation = 'destination-in'; gt.drawImage(c, 0, 0);
  const tex = aTex(t);
  tex.userData = { w: L.w + m * 2, h: L.h + m * 2, m };
  return tex;
}

/* un bloque macizo: el dibujo ocupa toda la cara (sin márgenes transparentes, que
   en una caja dejaban cada cara como una carta suelta, casi invisible), con el
   filo de tinta y el borde de papel de los recortes, y el grano */
export function texBloque(L, o) {
  o = o || {};
  const k = o.k || 6, W = L.w * k, H = L.h * k;
  const [c, g] = lienzo(W, H);
  g.fillStyle = o.fondo || '#8a8078'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) { const col = L.p[y * L.w + x]; if (col) { g.fillStyle = col; g.fillRect(x * k, (L.h - 1 - y) * k, k, k); } }
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45; g.fillStyle = g.createPattern(granoPapel(), 'repeat'); g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const b = Math.round(k * 1.4);
  g.strokeStyle = o.colBorde || '#f7f3ea'; g.lineWidth = b; g.strokeRect(b / 2, b / 2, W - b, H - b);
  g.strokeStyle = o.tinta || '#3a2a22'; g.lineWidth = Math.max(2, k * 0.5); g.strokeRect(b + k * 0.25, b + k * 0.25, W - b * 2 - k * 0.5, H - b * 2 - k * 0.5);
  return aTex(c);
}

/* un plano recortado que hace sombra con su forma */
export function hojaRecortada(tex, ancho, alto, o) {
  o = o || {};
  const geo = new THREE.PlaneGeometry(ancho, alto);
  geo.translate(o.ox || 0, alto / 2 + (o.oy || 0), 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 });
  const h = new THREE.Mesh(geo, mat);
  h.castShadow = true; h.receiveShadow = !!o.recibe;
  h.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45 });
  return h;
}

/* ============================================================================
   EL TERRENO DE CARTÓN
   ========================================================================== */
export const ZF = 1.0, ZB = -3.0;
const esRoca = (m, x, y) => { const b = baldosa(m, x, y); return b === B.SOLIDO || b === B.HIELO; };
const PX = 32;               // píxeles del frente pintado por metro
const TROZO = 64;            // metros por textura

/* el borde rasgado de cada capa de papel de colores */
function bordeRasgado(x, k, sem) { return Math.sin(x * 0.06 + k * 1.7) * 0.9 + Math.sin(x * 0.17 + k) * 0.35 + (ruido(x * 0.8, k * 3, sem) - 0.5) * 0.3 + (ruido(x * 4, k * 5, sem + 1) - 0.5) * 0.08; }

/* los vagones del Tren a las Nubes: chapa pintada, remaches y letras */
function pintarTren(m, x0, x1) {
  const W = (x1 - x0) * PX, H = m.h * PX;
  const [c, g] = lienzo(W, H);
  const Y = (y) => H - y * PX, X = (x) => (x - x0) * PX;
  const nV = TREN_VAGONES.length;
  TREN_VAGONES.forEach(([a, b], i) => {
    if (b + 1 < x0 || a > x1) return;
    const loco = i === nV - 1, pasajeros = i === 3 || i === 4 || i === 7;
    const cuerpo = loco ? '#2a2a32' : pasajeros ? '#1f5a7a' : i % 2 ? '#8a2a2a' : '#7a3424';
    const xa = X(a), xb = X(b + 1);
    g.fillStyle = cuerpo; g.fillRect(xa, Y(6), xb - xa, Y(1) - Y(6));
    /* tablas o chapas */
    for (let x = xa + 6; x < xb - 4; x += loco ? 24 : 10) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, Y(6), 2, Y(1) - Y(6)); }
    /* franjas, remaches */
    const franja = loco ? '#d8a830' : '#e8d8b0';
    g.fillStyle = franja; g.fillRect(xa, Y(6) + 6, xb - xa, 5); g.fillRect(xa, Y(1) - 14, xb - xa, 4);
    g.fillStyle = loco ? '#c0282e' : '#3a1a14'; g.fillRect(xa, Y(1) - 10, xb - xa, 10);
    g.fillStyle = 'rgba(255,240,210,0.55)';
    for (let x = xa + 5; x < xb - 3; x += 12) { g.fillRect(x, Y(6) + 16, 3, 3); g.fillRect(x, Y(1) - 22, 3, 3); }
    /* ventanas y letras */
    if (pasajeros) { g.fillStyle = '#e8d8b0'; g.fillRect(xa, Y(5) + 2, xb - xa, 4); }
    g.fillStyle = franja; g.font = `bold ${Math.round(PX * 0.42)}px Georgia, serif`; g.textAlign = 'center';
    if (!pasajeros) g.fillText(loco ? 'F.C.G.B.' : `F.C.G.B. ${1040 + i * 7}`, (xa + xb) / 2, Y(3) + 6);
    if (loco) {
      /* la cabina, la caldera y la chimenea */
      const la = a;
      g.fillStyle = '#1e1e24'; g.fillRect(X(la), Y(9), X(la + 5) - X(la), Y(6) - Y(9));
      g.fillStyle = '#ffd98a'; g.fillRect(X(la) + 20, Y(8.6), PX * 1.6, PX * 1.2);
      g.fillStyle = '#d8a830'; g.fillRect(X(la), Y(9) + 4, X(la + 5) - X(la), 4);
      g.fillStyle = '#c0282e'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(X(la + 6 + k * 2.4), Y(2.4), PX * 0.8, 0, Math.PI * 2); g.fill(); }
    }
  });
  /* el carbón y el farol de la vía */
  for (let tx = Math.max(0, x0); tx < Math.min(m.w, x1); tx++) for (let ty = 6; ty < m.h; ty++) {
    if (baldosa(m, tx, ty) !== B.SOLIDO) continue;
    const loco = tx >= TREN_VAGONES[nV - 1][0];
    if (loco) continue;
    g.fillStyle = '#1a1a1e'; g.fillRect(X(tx), Y(ty + 1), PX, PX);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#3a3a42' : '#2a2a30'; g.beginPath(); g.arc(X(tx) + hash(tx, k, 1) * PX, Y(ty + 1) + hash(tx, k, 2) * PX, 5 + hash(tx, k, 3) * 5, 0, Math.PI * 2); g.fill(); }
  }
  granear(g, W, H, 0.45);
  return aTex(c);
}

function pintarFrente(m, bio, x0, x1, prof) {
  if (m.nivel.tren) return pintarTren(m, x0, x1);
  const W = (x1 - x0) * PX, H = m.h * PX;
  const [c, g] = lienzo(W, H);
  const Y = (y) => H - y * PX, X = (x) => (x - x0) * PX;
  const R = bio.roca;
  /* capas de colores, de abajo para arriba, cada una con su borde rasgado y su sombrita */
  const alto = bio.frente === 'sal' ? 2.2 : bio.frente === 'nieve' ? 1.8 : 1.35;
  const capas = Math.ceil(m.h / alto) + 2;
  for (let k = capas; k >= 0; k--) {
    const col = bio.frente === 'sal' || bio.frente === 'nieve' ? R[(k * 3) % R.length] : R[k % R.length];
    g.beginPath(); g.moveTo(0, H);
    for (let px = 0; px <= W; px += 4) { const x = x0 + px / PX; g.lineTo(px, Y(k * alto + bordeRasgado(x, k, 11))); }
    g.lineTo(W, H); g.closePath();
    g.fillStyle = col; g.fill();
    /* la sombra que hace el borde de la capa de arriba */
    g.save(); g.strokeStyle = 'rgba(40,20,20,0.28)'; g.lineWidth = 3; g.beginPath();
    for (let px = 0; px <= W; px += 4) { const x = x0 + px / PX; const yy = Y(k * alto + bordeRasgado(x, k, 11)) + 2; px ? g.lineTo(px, yy) : g.moveTo(px, yy); }
    g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath();
    for (let px = 0; px <= W; px += 4) { const x = x0 + px / PX; const yy = Y(k * alto + bordeRasgado(x, k, 11)) - 1; px ? g.lineTo(px, yy) : g.moveTo(px, yy); }
    g.stroke(); g.restore();
  }
  /* lo hondo, más oscuro: se pinta chiquito (un píxel por baldosa) y se agranda suave */
  const [o, go] = lienzo(x1 - x0 + 4, m.h);
  for (let ty = 0; ty < m.h; ty++) for (let tx = Math.max(0, x0 - 2); tx < Math.min(m.w, x1 + 2); tx++) {
    const p = prof[ty * m.w + tx];
    if (p < 2) continue;
    go.fillStyle = `rgba(30,12,20,${Math.min(0.42, (p - 1) * 0.1)})`;
    go.fillRect(tx - x0 + 2, m.h - 1 - ty, 1, 1);
  }
  g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(o, -2 * PX, 0, (x1 - x0 + 4) * PX, H);
  g.restore();
  /* la franja de arriba: pasto, sal o nieve, con el borde festoneado */
  const topeCol = bio.frente === 'nieve' ? '#f4f7fb' : bio.frente === 'sal' ? '#f6f4ee' : bio.tope;
  const topeO = new THREE.Color(topeCol).multiplyScalar(0.78);
  for (let tx = Math.max(0, x0 - 1); tx < Math.min(m.w, x1 + 1); tx++) for (let ty = 0; ty < m.h; ty++) {
    if (!esRoca(m, tx, ty) || esRoca(m, tx, ty + 1)) continue;
    const yt = Y(ty + 1);
    g.fillStyle = '#' + topeO.getHexString();
    g.beginPath(); g.moveTo(X(tx), yt);
    for (let i = 0; i <= 8; i++) { const px = X(tx) + i * PX / 8; g.lineTo(px, yt + (i % 2 ? 14 : 9) + hash(tx * 8 + i, ty, 3) * 5); }
    g.lineTo(X(tx + 1), yt); g.closePath(); g.fill();
    g.fillStyle = topeCol;
    g.beginPath(); g.moveTo(X(tx), yt);
    for (let i = 0; i <= 8; i++) { const px = X(tx) + i * PX / 8; g.lineTo(px, yt + (i % 2 ? 10 : 6) + hash(tx * 8 + i, ty, 4) * 4); }
    g.lineTo(X(tx + 1), yt); g.closePath(); g.fill();
  }
  granear(g, W, H, 0.6);
  return aTex(c);
}
function texRepetida(pintar, w, h, rep) { const [c, g] = lienzo(w, h); pintar(g, w, h); granear(g, w, h, 0.5); return aTex(c, rep); }
/* el techo: papel de pasto (o sal, o nieve) con pinceladas */
function texTecho(bio) {
  const base = bio.frente === 'nieve' ? '#f2f6fb' : bio.frente === 'sal' ? '#f4f2ec' : bio.tope, b2 = bio.frente === 'nieve' ? '#dde8f4' : bio.frente === 'sal' ? '#e4e6ec' : bio.tope2;
  return texRepetida((g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = mulberry(3);
    for (let i = 0; i < 90; i++) { g.strokeStyle = r() < 0.5 ? b2 : new THREE.Color(base).multiplyScalar(1.08).getStyle(); g.lineWidth = 3; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 - r() * 12, y - 10); g.stroke(); }
  }, 128, 128, [1, 1]);
}
/* el canto: cartón corrugado */
function texCanto() {
  return texRepetida((g, w, h) => {
    g.fillStyle = '#b98a58'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(90,55,25,0.35)'; g.fillRect(x, 0, 3, h); g.fillStyle = 'rgba(255,230,190,0.25)'; g.fillRect(x + 4, 0, 2, h); }
    g.fillStyle = '#a57848'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  }, 64, 64, [1, 1]);
}

/* la pared del fondo de las cuevas, las casas y los vagones */
function texFondo(tipo, bio) {
  return texRepetida((g, w, h) => {
    const r = mulberry(tipo.length);
    if (tipo === 'adobe') {
      g.fillStyle = '#9a6e4a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) {
        g.fillStyle = ['#b8875a', '#a87a52', '#c0906a', '#b08058'][Math.floor(r() * 4)];
        g.fillRect(x + 2, y + 2, 28, 12);
      }
      /* una ventanita con la noche y un tejido colgado */
      g.fillStyle = '#5a3a26'; g.fillRect(80, 30, 30, 26); g.fillStyle = '#1c2240'; g.fillRect(84, 34, 22, 18);
      ['#c0282e', '#f2b632', '#1f8f6c', '#6a2f9a'].forEach((c, i) => { g.fillStyle = c; g.fillRect(14, 70 + i * 8, 40, 6); });
    } else if (tipo === 'madera') {
      g.fillStyle = '#6a4228'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) { g.fillStyle = r() < 0.5 ? '#7a5030' : '#845a36'; g.fillRect(x + 1, 0, 14, h); }
      g.fillStyle = '#c8a860'; g.fillRect(0, 40, w, 3);
    } else {
      const base = new THREE.Color(bio.roca[2]).multiplyScalar(0.62);
      g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,240,220' : '20,10,10'},0.08)`; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 16, 0, Math.PI * 2); g.fill(); }
    }
  }, 128, 128, [1, 1]);
}

export function armarCarton(m, bio) {
  const W = m.w, H = m.h, grupo = new THREE.Group();
  const prof = new Uint8Array(W * H).fill(9), cola = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!esRoca(m, x, y)) { prof[y * W + x] = 0; cola.push(x, y); }
  for (let i = 0; i < cola.length; i += 2) {
    const x = cola[i], y = cola[i + 1], v = prof[y * W + x] + 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && prof[ny * W + nx] > v) { prof[ny * W + nx] = v; cola.push(nx, ny); } }
  }
  /* el frente: por trozos, cada uno con su pintura */
  for (let x0 = 0; x0 < W; x0 += TROZO) {
    const x1 = Math.min(W, x0 + TROZO);
    const pos = [], uv = [];
    for (let ty = 0; ty < H; ty++) {
      let a = -1;
      for (let tx = x0; tx <= x1; tx++) {
        const r = tx < x1 && esRoca(m, tx, ty);
        if (r && a < 0) a = tx;
        if (!r && a >= 0) {
          const b = tx;
          pos.push(a, ty, ZF, b, ty, ZF, b, ty + 1, ZF, a, ty, ZF, b, ty + 1, ZF, a, ty + 1, ZF);
          const u = (x) => (x - x0) / (x1 - x0), v = (y) => y / H;
          uv.push(u(a), v(ty), u(b), v(ty), u(b), v(ty + 1), u(a), v(ty), u(b), v(ty + 1), u(a), v(ty + 1));
          a = -1;
        }
      }
    }
    if (!pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    const tex = pintarFrente(m, bio, x0, x1, prof);
    const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    malla.receiveShadow = true;
    grupo.add(malla);
  }
  /* techos, bajos y costados: tiras que van de adelante para atrás */
  const tTecho = m.nivel.tren ? texRepetida((g, w, h) => { g.fillStyle = '#4a4a54'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = '#5a5a66'; g.fillRect(x, 0, 3, h); } }, 64, 64, [1, 1]) : texTecho(bio), tCanto = texCanto();
  const techo = [], techoUV = [], canto = [], cantoUV = [];
  const tira = (arr, uvs, a, b, c, d, ru, rv) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); uvs.push(0, 0, ru, 0, ru, rv, 0, 0, ru, rv, 0, rv); };
  for (let ty = 0; ty < H; ty++) {
    /* techos: tramos seguidos */
    let a = -1;
    for (let tx = 0; tx <= W; tx++) {
      const t = tx < W && esRoca(m, tx, ty) && !esRoca(m, tx, ty + 1);
      if (t && a < 0) a = tx;
      if (!t && a >= 0) { tira(techo, techoUV, [a, ty + 1, ZF], [tx, ty + 1, ZF], [tx, ty + 1, ZB], [a, ty + 1, ZB], (tx - a) / 2, (ZF - ZB) / 2); a = -1; }
    }
    a = -1;
    for (let tx = 0; tx <= W; tx++) {
      const t = tx < W && ty > 0 && esRoca(m, tx, ty) && !esRoca(m, tx, ty - 1);
      if (t && a < 0) a = tx;
      if (!t && a >= 0) { tira(canto, cantoUV, [a, ty, ZB], [tx, ty, ZB], [tx, ty, ZF], [a, ty, ZF], (tx - a) / 2, (ZF - ZB) / 2); a = -1; }
    }
  }
  for (let tx = 0; tx < W; tx++) for (const d of [-1, 1]) {
    let a = -1;
    for (let ty = 0; ty <= H; ty++) {
      const t = ty < H && esRoca(m, tx, ty) && tx + d >= 0 && tx + d < W && !esRoca(m, tx + d, ty);
      if (t && a < 0) a = ty;
      if (!t && a >= 0) {
        const x = d < 0 ? tx : tx + 1;
        if (d < 0) tira(canto, cantoUV, [x, a, ZB], [x, a, ZF], [x, ty, ZF], [x, ty, ZB], (ZF - ZB) / 2, (ty - a) / 2);
        else tira(canto, cantoUV, [x, a, ZF], [x, a, ZB], [x, ty, ZB], [x, ty, ZF], (ZF - ZB) / 2, (ty - a) / 2);
        a = -1;
      }
    }
  }
  for (const [arr, uvs, tex] of [[techo, techoUV, tTecho], [canto, cantoUV, tCanto]]) {
    if (!arr.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const mm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    mm.receiveShadow = true; mm.castShadow = true;
    grupo.add(mm);
  }
  /* la pared del fondo de las cuevas: cartón oscuro */
  const fondo = [];
  const perfil = new Float32Array(W);
  for (let x = 0; x < W; x++) { let y = H - 1; while (y >= 0 && !esRoca(m, x, y)) y--; perfil[x] = y + 1; }
  /* solo donde hay techo cerca: una cueva, una casa, un vagón (no abajo de una repisa que flota lejos) */
  const techoCerca = (tx, ty) => {
    let a = ty, b = ty;
    while (a > 0 && !esRoca(m, tx, a - 1)) a--;
    while (b < H - 1 && !esRoca(m, tx, b + 1)) b++;
    return b < H - 1 && a > 0 && b - a + 1 <= 5;
  };
  for (let tx = 0; tx < W; tx++) for (let ty = 0; ty < perfil[tx] - 1; ty++) if (!esRoca(m, tx, ty) && techoCerca(tx, ty)) fondo.push(tx, ty, ZB, tx + 1, ty, ZB, tx + 1, ty + 1, ZB, tx, ty, ZB, tx + 1, ty + 1, ZB, tx, ty + 1, ZB);
  if (fondo.length) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(fondo, 3));
    const uvF = []; for (let i = 0; i < fondo.length; i += 3) uvF.push(fondo[i] / 4, fondo[i + 1] / 4);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvF, 2));
    geo.computeVertexNormals();
    const tipo = m.nivel.id === 'prologo' || m.nivel.id === 'epilogo' ? 'adobe' : m.nivel.tren ? 'madera' : 'roca';
    const mm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texFondo(tipo, bio), roughness: 1 }));
    mm.receiveShadow = true; grupo.add(mm);
  }
  /* para el teatrito: la altura del suelo (sin repisas que flotan), suavizada */
  const suelo = new Float32Array(W);
  for (let x = 0; x < W; x++) { let y = 0; while (y < H && esRoca(m, x, y)) y++; suelo[x] = y; }
  const suave = new Float32Array(W);
  for (let x = 0; x < W; x++) { let t = 0, n = 0; for (let d = -8; d <= 8; d++) { const q = Math.max(0, Math.min(W - 1, x + d)); t += suelo[q]; n++; } suave[x] = t / n; }
  grupo.userData.perfil = suave;
  grupo.name = 'carton';
  return grupo;
}

/* ============================================================================
   EL TEATRITO DE ATRÁS: capas de cerros recortados
   ========================================================================== */
function capaCerros(bio, i, x0, x1, perfil) {
  const capas = [
    { z: -5, alto: 2.5, col: bio.tope2, rug: 0.4 },
    { z: -12, alto: 5, col: bio.roca[1], rug: 0.6 },
    { z: -26, alto: 10, col: bio.montes[0].col, rug: 0.8, rayas: bio.montes[0].rayas },
    { z: -55, alto: 20, col: bio.montes[1].col, rug: 0.9, rayas: bio.montes[1].rayas },
    { z: -110, alto: 36, col: bio.montes[2].col, rug: 1, nieve: bio.montes[2].nieve },
  ];
  const C = capas[i];
  const ancho = x1 - x0 + 160 + Math.abs(C.z) * 1.4, xa = x0 - 80 - Math.abs(C.z) * 0.7;
  const pxm = Math.min(i < 2 ? 12 : i < 4 ? 6 : 3, 4000 / ancho);
  const H = C.alto * 2 + 30;
  const [c, g] = lienzo(ancho * pxm, H * pxm);
  const base = (x) => {
    const w = perfil ? perfil[Math.max(0, Math.min(perfil.length - 1, Math.round(x)))] : 0;
    return (i < 2 ? w * 0.9 : 0) + (fbm(x * 0.02 / (1 + i * 0.3), i * 3.3, 51 + i) - 0.3) * C.alto * 1.6 + Math.pow(Math.max(0, fbm(x * 0.05, i * 1.7, 61 + i) - 0.45) * 2, 2) * C.alto * C.rug;
  };
  const Yp = (y) => (H - y - 10) * pxm;
  g.beginPath(); g.moveTo(0, H * pxm);
  for (let px = 0; px <= ancho * pxm; px += 3) { const x = xa + px / pxm; g.lineTo(px, Yp(base(x) + (ruido(x * 2, i, 9) - 0.5) * 0.15)); }
  g.lineTo(ancho * pxm, H * pxm); g.closePath();
  g.fillStyle = C.col; g.fill();
  /* las rayas de los Siete Colores, pintadas adentro */
  if (C.rayas) {
    g.save(); g.clip();
    const R = bio.roca;
    for (let k = 0; k < 30; k++) {
      g.beginPath(); g.moveTo(0, H * pxm);
      for (let px = 0; px <= ancho * pxm; px += 6) { const x = xa + px / pxm; g.lineTo(px, Yp(k * 1.6 - 12 + Math.sin(x * 0.03 + k) * 1.2 + fbm(x * 0.01, k, 5) * 4)); }
      g.lineTo(ancho * pxm, H * pxm); g.closePath();
      g.fillStyle = new THREE.Color(R[k % R.length]).lerp(new THREE.Color(C.col), 0.3 + i * 0.1).getStyle(); g.fill();
    }
    g.restore();
  }
  if (C.nieve) {
    g.save(); g.clip();
    g.fillStyle = '#f4f8ff';
    g.beginPath(); g.moveTo(0, 0);
    for (let px = 0; px <= ancho * pxm; px += 6) { const x = xa + px / pxm; g.lineTo(px, Yp(C.alto * 0.9 + Math.sin(x * 0.08) * 2 + fbm(x * 0.05, 3, 7) * 5)); }
    g.lineTo(ancho * pxm, 0); g.closePath(); g.fill();
    g.restore();
  }
  /* el filo de arriba, un poco más claro, como papel cortado */
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.beginPath();
  for (let px = 0; px <= ancho * pxm; px += 3) { const x = xa + px / pxm; const y = Yp(base(x)); px ? g.lineTo(px, y) : g.moveTo(px, y); }
  g.stroke();
  granear(g, c.width, c.height, 0.5);
  const tex = aTex(c);
  const geo = new THREE.PlaneGeometry(ancho, H);
  geo.translate(xa + ancho / 2, H / 2 - 10, 0);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 1, side: THREE.DoubleSide });
  const mm = new THREE.Mesh(geo, mat);
  mm.position.z = C.z;
  mm.receiveShadow = i < 2; mm.castShadow = i < 2;
  if (i < 2) mm.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  return mm;
}
export function armarTeatrito(bio, x0, x1, perfil) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) g.add(capaCerros(bio, i, x0, x1, perfil));
  g.name = 'teatrito';
  return g;
}

/* ---------------- lo que cuelga de hilos: nubes, sol, luna, estrellas ---------------- */
function recorteDibujado(w, h, dibujar) {
  const k = 64, [c, g] = lienzo(w * k, h * k);
  dibujar(g, w * k, h * k);
  /* borde blanco del recorte */
  const [f, gf] = lienzo(w * k, h * k); gf.drawImage(c, 0, 0);
  const [s, gs] = lienzo(w * k, h * k);
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; gs.drawImage(f, Math.cos(a) * 6, Math.sin(a) * 6); }
  gs.globalCompositeOperation = 'source-in'; gs.fillStyle = '#f7f3ea'; gs.fillRect(0, 0, w * k, h * k);
  gs.globalCompositeOperation = 'source-over'; gs.drawImage(f, 0, 0);
  granear(gs, w * k, h * k, 0.45);
  gs.globalCompositeOperation = 'destination-in';
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; gs.drawImage(f, Math.cos(a) * 6, Math.sin(a) * 6); }
  return aTex(s);
}
export function armarColgantes(bio, x0, x1) {
  const g = new THREE.Group(), cie = bio.cielo;
  const hilo = new THREE.LineBasicMaterial({ color: '#e8e0d0', transparent: true, opacity: 0.55 });
  const colgar = (mesh, x, y, z, largo) => {
    const pv = new THREE.Group(); pv.position.set(x, y + largo, z);
    mesh.position.y = -largo; pv.add(mesh);
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -largo + (mesh.userData.alto || 1) * 0.45, 0)]);
    pv.add(new THREE.Line(lg, hilo));
    pv.userData.fase = hash(Math.round(x), Math.round(z), 3) * 6;
    g.add(pv);
    return pv;
  };
  /* nubes */
  const nn = Math.round(cie.nubes * 14) + 2;
  const texN = [0, 1, 2].map((s) => recorteDibujado(4, 2, (q, w, h) => {
    q.fillStyle = cie.nubeCol;
    const r = mulberry(s + 10);
    for (let i = 0; i < 7; i++) { const x = w * (0.18 + r() * 0.64), y = h * (0.55 + r() * 0.15) - Math.abs(x - w / 2) * 0.1, rr = h * (0.18 + r() * 0.2); q.beginPath(); q.arc(x, y, rr, 0, Math.PI * 2); q.fill(); }
    q.fillRect(w * 0.15, h * 0.6, w * 0.7, h * 0.22);
  }));
  for (let i = 0; i < nn; i++) {
    const z = -14 - hash(i, 1, 4) * 60, e = 4 + hash(i, 2, 4) * 5 + (-z) * 0.05;
    const mesh = hojaRecortada(texN[i % 3], e, e * 0.5, {});
    mesh.userData.alto = e * 0.5; mesh.castShadow = z > -30;
    colgar(mesh, x0 - 30 + hash(i, 3, 4) * (x1 - x0 + 60), 14 + hash(i, 5, 4) * 10 + (-z) * 0.15, z, 30);
  }
  /* sol o luna, de papel, con su hilo */
  if (cie.sol && cie.sol[1] > 0) {
    const tex = recorteDibujado(2, 2, (q, w, h) => {
      q.fillStyle = '#ffd35a';
      for (let i = 0; i < 12; i++) { q.save(); q.translate(w / 2, h / 2); q.rotate(i / 12 * Math.PI * 2); q.beginPath(); q.moveTo(-w * 0.07, -h * 0.3); q.lineTo(0, -h * 0.47); q.lineTo(w * 0.07, -h * 0.3); q.fill(); q.restore(); }
      q.fillStyle = '#ffc23a'; q.beginPath(); q.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2); q.fill();
      q.fillStyle = '#ffe79a'; q.beginPath(); q.arc(w / 2 - w * 0.06, h / 2 - h * 0.06, w * 0.18, 0, Math.PI * 2); q.fill();
    });
    const s = hojaRecortada(tex, 9, 9, {}); s.material.emissive = new THREE.Color('#ffb040'); s.material.emissiveIntensity = 0.6; s.castShadow = false; s.userData.alto = 9;
    g.userData.sol = colgar(s, (x0 + x1) / 2, 18 + cie.sol[1] * 20, -80, 40);
    g.userData.sol.userData.sigue = { dx: cie.sol[0] * 60, y: 18 + cie.sol[1] * 20 };
  }
  if (cie.luna) {
    const tex = recorteDibujado(2, 2, (q, w, h) => {
      q.fillStyle = '#fff4d0'; q.beginPath(); q.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2); q.fill();
      q.globalCompositeOperation = 'destination-out'; q.beginPath(); q.arc(w / 2 + w * 0.2, h / 2 - h * 0.1, w * 0.36, 0, Math.PI * 2); q.fill();
    });
    const l = hojaRecortada(tex, 6, 6, {}); l.material.emissive = new THREE.Color('#fff0c0'); l.material.emissiveIntensity = 0.8; l.castShadow = false; l.userData.alto = 6;
    g.userData.sol = colgar(l, (x0 + x1) / 2, 16 + cie.luna[1] * 18, -70, 40);
    g.userData.sol.userData.sigue = { dx: cie.luna[0] * 50, y: 16 + cie.luna[1] * 18 };
  }
  if (cie.estrellas > 0.2) {
    const tex = recorteDibujado(1, 1, (q, w, h) => {
      q.fillStyle = '#fff6c8'; q.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? w * 0.2 : w * 0.46; q.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); }
      q.fill();
    });
    const n = Math.round(cie.estrellas * 70);
    for (let i = 0; i < n; i++) {
      const z = -30 - hash(i, 7, 8) * 70, e = 0.9 + hash(i, 8, 8) * 1.2;
      const st = hojaRecortada(tex, e, e, {}); st.material.emissive = new THREE.Color('#fff2b0'); st.material.emissiveIntensity = 1.2; st.castShadow = false; st.userData.alto = e;
      colgar(st, x0 - 60 + hash(i, 9, 8) * (x1 - x0 + 120), 14 + hash(i, 10, 8) * 26 + (-z) * 0.2, z, 30);
    }
  }
  g.name = 'colgantes';
  return g;
}
export function pasarColgantes(g, t, camX) {
  for (const pv of g.children) {
    pv.rotation.z = Math.sin(t * 0.7 + pv.userData.fase) * 0.035;
    pv.rotation.y = Math.sin(t * 0.4 + pv.userData.fase * 2) * 0.12;
  }
  const s = g.userData.sol;
  if (s) { s.position.x = camX * 0.85 + s.userData.sigue.dx; }
}
