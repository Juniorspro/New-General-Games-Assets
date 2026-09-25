/* ============================================================================
   aeroplaza/js/construcciones.js — todo lo construido, armado en código
   (procedural) copiando las referencias que se hicieron con Rezona
   (crudo/t3/ref-*.png): la casa redonda con ojos de buey y cúpula, la
   estación octogonal de vidrio con el techo de plantas, la tienda blanca con
   caños verdes, el hotel de vidrio con balcones, el monorriel, la fuente de la
   bola de vidrio, el banco, los faroles, el árbol de burbujas, la palmera y
   los muebles de la casa.
   Cada una se arma una sola vez: las piezas se funden por material (una
   llamada de dibujo por material) y las copias comparten geometría y
   material (modelos.js). El frente mira a +z y la base está en y = 0.
   ========================================================================== */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { brilloso, materialVidrio, conBorde, conViento, conMeceo, UNI } from './naturaleza.js';
import { azar } from './mundo.js';
import { t } from './textos.js';
import { DETALLE } from './detalle.js';

const TAU = Math.PI * 2;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------ materiales */
const fisico = ({ borde = 0.3, bordeCol = '#ffffff', ...o }) => conBorde(new THREE.MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06, ...o }), bordeCol, borde);
function vidrio(color, op) { const m = materialVidrio(color, op); m.side = THREE.DoubleSide; return m; }
function texto(emoji, fondo = '#1a6fd0', tam = 96) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#5fd0ff'); gr.addColorStop(1, fondo);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
  g.font = `${tam}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 128, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* el vidrio del hotel: aqua con parantes finos y una línea por piso (se repite) */
function texHotel() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#7fe6f4'); gr.addColorStop(0.6, '#34b6d4'); gr.addColorStop(1, '#1f8fb8');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(235,252,255,0.75)'; for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 3, 256);
  g.fillStyle = 'rgba(20,90,120,0.35)'; g.fillRect(0, 0, 128, 10);
  const b = g.createLinearGradient(0, 0, 128, 256); b.addColorStop(0, 'rgba(255,255,255,0.35)'); b.addColorStop(0.4, 'rgba(255,255,255,0)'); b.addColorStop(1, 'rgba(255,255,255,0.12)');
  g.fillStyle = b; g.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
/* el tablero de salidas: los destinos del tren, con la hora que cambia sola */
function texTablero() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#0f3f7a'); gr.addColorStop(1, '#0a2a55'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#9ff6ff'; g.font = '800 30px "Nunito","Segoe UI",sans-serif'; g.fillText('🚆 ' + t('tablero_salidas'), 20, 44);
  g.fillStyle = 'rgba(159,246,255,0.35)'; g.fillRect(20, 58, 472, 3);
  const dest = [['reino_aqua', '🐬'], ['reino_aurora', '✨'], ['reino_jardin', '🌸'], ['reino_casa', '🏠']];
  g.font = '700 26px "Nunito","Segoe UI",sans-serif';
  dest.forEach(([k, e], i) => { const y = 100 + i * 42; g.fillStyle = '#ffffff'; g.fillText(`${e}  ${t(k)}`, 24, y); g.fillStyle = '#ffe14a'; g.textAlign = 'right'; g.fillText(t('tablero_ahora'), 488, y); g.textAlign = 'left'; });
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
const HACER = {
  blanco: () => brilloso('#ffffff', { roughness: 0.14, borde: 0.35 }),
  perla: () => brilloso('#eaf1f6', { roughness: 0.25, borde: 0.25 }),
  piso: () => brilloso('#f1f6f9', { roughness: 0.18, borde: 0.1 }),
  costura: () => brilloso('#c7d4de', { roughness: 0.4, borde: 0 }),
  aqua: () => brilloso('#43d8cd', { roughness: 0.14, borde: 0.4 }),
  verde: () => brilloso('#2fbf45', { roughness: 0.14, borde: 0.4 }),
  lima: () => brilloso('#8fe03a', { roughness: 0.2, emissive: '#4f9a10', emissiveIntensity: 0.3 }),
  celeste: () => fisico({ color: '#6db8f2', borde: 0.45 }),
  celesteClaro: () => brilloso('#d4ecff', { roughness: 0.3, borde: 0.3 }),
  gris: () => brilloso('#b8c4ce', { roughness: 0.28, metalness: 0.35, borde: 0.15 }),
  cromo: () => new THREE.MeshStandardMaterial({ color: '#e8eef4', metalness: 1, roughness: 0.14 }),
  amarillo: () => brilloso('#ffd23f', { roughness: 0.55, borde: 0 }),
  arena: () => brilloso('#efe0bd', { roughness: 0.7, borde: 0.1 }),
  cesped: () => brilloso('#5cc63f', { roughness: 0.55, borde: 0.15 }),
  vidrio: () => vidrio('#dcf7ff', 0.2),
  /* los de la Zona de Juegos y el telescopio (26/09) */
  rosaJ: () => brilloso('#ff8fc8', { roughness: 0.16, borde: 0.35 }),
  azulJ: () => fisico({ color: '#3f8fe8', borde: 0.4 }),
  naranjaJ: () => brilloso('#ff7a1f', { roughness: 0.2, emissive: '#ff5a00', emissiveIntensity: 0.25 }),
  gomaJ: () => brilloso('#2b313b', { roughness: 0.42, borde: 0.12 }),
  lenteJ: () => new THREE.MeshPhysicalMaterial({ color: '#9fe0ff', roughness: 0.03, metalness: 0.1, clearcoat: 1, emissive: '#1f6fb0', emissiveIntensity: 0.4 }),
  vidrioAquaJ: () => vidrio('#bff4ff', 0.38),
  luzAquaJ: () => new THREE.MeshBasicMaterial({ color: '#bff8ff' }),
  colorJ: () => brilloso('#ffffff', { vertexColors: true, roughness: 0.25, borde: 0.3 }),
  sillaAzulJ: () => fisico({ color: '#6db8f2', side: THREE.DoubleSide, borde: 0.45 }),
  sillaRosaJ: () => fisico({ color: '#ff9ad2', side: THREE.DoubleSide, borde: 0.45 }),
  redJ: () => new THREE.MeshBasicMaterial({ map: texRed(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }),
  vidrioAzul: () => vidrio('#a8dcff', 0.46),
  cupula: () => vidrio('#bff0ff', 0.3),
  bola: () => vidrio('#bfeaff', 0.34),
  ventana: () => new THREE.MeshPhysicalMaterial({ color: '#8fdcff', roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#3fb2ea', emissiveIntensity: 0.32, envMapIntensity: 2 }),
  ventanaOscura: () => new THREE.MeshPhysicalMaterial({ color: '#2a86d8', roughness: 0.04, metalness: 0.2, clearcoat: 1, emissive: '#1d6fd8', emissiveIntensity: 0.3, envMapIntensity: 2.2 }),
  puerta: () => brilloso('#79c0e6', { roughness: 0.18, borde: 0.35 }),
  plantas: () => brilloso('#ffffff', { vertexColors: true, roughness: 0.42, borde: 0.2 }),
  flores: () => brilloso('#ffffff', { vertexColors: true, roughness: 0.35, emissive: '#2a1420', emissiveIntensity: 0.35, borde: 0.1 }),
  luzAqua: () => new THREE.MeshBasicMaterial({ color: '#a8fbff' }),
  luzCeleste: () => new THREE.MeshBasicMaterial({ color: '#8fe6ff' }),
  faro: () => new THREE.MeshBasicMaterial({ color: '#fff8dc' }),
  pantallaTren: () => new THREE.MeshBasicMaterial({ map: texto('🚆') }),
  hotelVidrio: () => { const t = texHotel(); t.repeat.set(20, 14); return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.06, metalness: 0.25, clearcoat: 1, emissive: '#0e6f8f', emissiveIntensity: 0.22, envMapIntensity: 1.8 }); },
  hotelCupula: () => { const t = texHotel(); t.repeat.set(10, 3); return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.05, metalness: 0.3, clearcoat: 1, emissive: '#156f9a', emissiveIntensity: 0.25, envMapIntensity: 2 }); },
  aguaFuente: () => new THREE.ShaderMaterial({
    uniforms: { uT: UNI.uT, uA: { value: new THREE.Color('#12b6dc') }, uB: { value: new THREE.Color('#aaf6ff') } },
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uT; uniform vec3 uA, uB; varying vec2 vP;
      void main() {
        float c = sin(vP.x * 4.0 + sin(vP.y * 3.0 + uT) * 1.5 + uT * 1.3) * sin(vP.y * 4.3 + sin(vP.x * 2.7 - uT * 0.9) * 1.4 - uT);
        float lineas = smoothstep(0.72, 1.0, abs(c));
        float r = length(vP) / 3.3;
        vec3 col = mix(uB, uA, smoothstep(0.0, 1.0, r) * 0.7 + 0.3) + lineas * 0.55;
        gl_FragColor = vec4(col * 1.25, 0.86);
      }`,
  }),
  chorro: () => new THREE.MeshBasicMaterial({ color: '#dffcff', transparent: true, opacity: 0.55, depthWrite: false }),
  nucleoAgua: () => new THREE.MeshBasicMaterial({ color: '#8ff8d8', transparent: true, opacity: 0.85 }),
  verdeAgua: () => fisico({ color: '#38d88c', borde: 0.45 }),
  azulAgua: () => fisico({ color: '#3f8fff', borde: 0.45 }),
  globo: () => new THREE.MeshPhysicalMaterial({ color: '#f4fbff', roughness: 0.32, transparent: true, opacity: 0.82, emissive: '#dff4ff', emissiveIntensity: 0.35, clearcoat: 1, depthWrite: false }),
  nucleo: () => new THREE.MeshBasicMaterial({ color: '#fff1c2' }),
  tronco: () => brilloso('#ffffff', { vertexColors: true, roughness: 0.38, borde: 0.15 }),
  copa: () => fisico({ vertexColors: true, roughness: 0.16, clearcoatRoughness: 0.08, borde: 0.38, bordeCol: '#f2ffd0' }),
  hojas: () => brilloso('#ffffff', { vertexColors: true, roughness: 0.35, side: THREE.DoubleSide, borde: 0.15 }),
  hojasViento: () => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }); conViento(m, 0.3); return conBorde(m, '#ffffff', 0.15); },
  /* los de los árboles y palmeras sueltos: se mecen con el viento (conMeceo). Los
     de cerca y los de lejos comparten estos, así el cambio de detalle no se nota */
  troncoArbol: () => conBorde(conMeceo(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 }), MECE_ARBOL), '#ffffff', 0.15),
  copaViento: () => conBorde(conMeceo(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }), { ...MECE_ARBOL, tiembla: 0.035 }), '#f2ffd0', 0.38),
  troncoPalma: () => conBorde(conMeceo(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 }), MECE_PALMA), '#ffffff', 0.15),
  hojasPalma: () => conBorde(conMeceo(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide }), { ...MECE_PALMA, aleteo: 0.02, punta: [1.9, 0] }), '#ffffff', 0.15),
  cocoPalma: () => conBorde(conMeceo(new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.45 }), MECE_PALMA), '#ffffff', 0.2),
  coco: () => brilloso('#6b4423', { roughness: 0.45, borde: 0.2 }),
  tapizLima: () => brilloso('#9be63a', { roughness: 0.7, borde: 0.25 }),
  tapizLimaDentro: () => brilloso('#8fd836', { roughness: 0.7, borde: 0.1, side: THREE.BackSide }),
  frazada: () => brilloso('#8fd6cf', { roughness: 0.75, borde: 0.2 }),
  colchon: () => brilloso('#f6f8fa', { roughness: 0.6, borde: 0.15 }),
  pantallaTele: () => new THREE.MeshStandardMaterial({ color: '#7ff0ff', emissive: '#3fe0f0', emissiveIntensity: 0.8, roughness: 0.1 }),
  oscuro: () => brilloso('#56606b', { roughness: 0.5, borde: 0 }),
  rojoHongo: () => fisico({ color: '#ff4f6e', borde: 0.4 }),
  crema: () => brilloso('#fff4dc', { roughness: 0.35, borde: 0.25 }),
  madera: () => brilloso('#e9d7b4', { roughness: 0.55, borde: 0.15 }),
  toldo: () => brilloso('#ffffff', { vertexColors: true, roughness: 0.3, borde: 0.3, side: THREE.DoubleSide }),
  haz: () => new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  luzCalida: () => new THREE.MeshBasicMaterial({ color: '#fff1c2' }),
  pantallaAzul: () => new THREE.MeshBasicMaterial({ color: '#9fe8ff' }),
  tablero: () => new THREE.MeshBasicMaterial({ map: texTablero() }),
  esfera: () => new THREE.MeshBasicMaterial({ color: '#f7fbff' }),
  puertasLuz: () => new THREE.MeshStandardMaterial({ color: '#fff6d0', emissive: '#ffd98a', emissiveIntensity: 1.2, roughness: 0.15, transparent: true, opacity: 0.92 }),
  vela: () => brilloso('#ffffff', { roughness: 0.5, borde: 0.1, side: THREE.DoubleSide }),
  velaAqua: () => brilloso('#43d8cd', { roughness: 0.5, borde: 0.1, side: THREE.DoubleSide }),
  aguja: () => new THREE.MeshBasicMaterial({ color: '#2a4a6a' }),
};
/* cuánto se mece cada uno: la altura es la del modelo sin escalar */
const MECE_ARBOL = { fuerza: 0.55, alto: 5.7 }, MECE_PALMA = { fuerza: 1, alto: 6.3 };
const CACHE = {};
const M = (k) => CACHE[k] || (CACHE[k] = HACER[k]());

/* ------------------------------------------------------------- geometría */
/* (el detalle depende de la calidad al armar: detalle.js › DETALLE.seg y .curvas) */
const caja = (w, h, d, r = 0.08, seg = 3) => new RoundedBoxGeometry(w, h, d, Math.max(1, Math.min(seg, DETALLE.seg)), Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const curva = (n, min) => Math.max(Math.min(n, min), Math.round(n * DETALLE.curvas));
const cil = (r, h, seg = 12, r2 = r) => new THREE.CylinderGeometry(r2, r, h, curva(seg, 6));
const esfera = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, curva(ws, 8), curva(hs, 6));
/* un torno: perfil [[radio, alto], …] de abajo hacia arriba */
const torno = (perfil, seg = 40) => new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const tubo = (pts, r, seg = 40, radial = 8, cerrado = false) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)), cerrado), seg, r, radial, cerrado);
/* superelipse ("cuadrado redondo"): el punto a un ángulo (0 = frente, +z) y su normal hacia afuera */
function sqPunto(w, d, n, a) {
  const f = (b) => { const s = Math.sin(b), c = Math.cos(b); return [w / 2 * Math.sign(s) * Math.abs(s) ** (2 / n), d / 2 * Math.sign(c) * Math.abs(c) ** (2 / n)]; };
  const [x, z] = f(a), [x1, z1] = f(a + 1e-3), [x0, z0] = f(a - 1e-3);
  let nx = z1 - z0, nz = -(x1 - x0); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
  if (nx * x + nz * z < 0) { nx = -nx; nz = -nz; }
  return { x, z, nx, nz };
}
const sq = (w, d, n = 3, seg = 72) => Array.from({ length: seg }, (_, i) => { const p = sqPunto(w, d, n, i / seg * TAU); return [p.x, p.z]; });
/* un contorno en planta [[x, z], …] levantado hasta h, con el borde redondeado */
function prisma(pts, h, b = 0.12, bseg = 4, bs = b) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, h - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: bs, bevelSegments: bseg, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
  return g;
}
/* un sector de anillo (bancos curvos): de r0 a r1, del ángulo a0 al a1, alto h */
function arcoSolido(r0, r1, a0, a1, h, b = 0.06) {
  const pts = [], n = 24;
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([Math.sin(a) * (r1 - b), Math.cos(a) * (r1 - b)]); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; pts.push([Math.sin(a) * (r0 + b), Math.cos(a) * (r0 + b)]); }
  return prisma(pts, h, b, 3);
}
/* una cinta vertical que sigue un contorno (barandas de vidrio, ventanales) */
function cinta(pts, y0, y1) {
  const pos = [], uv = [], idx = [];
  let largo = 0;
  pts.forEach(([x, z], i) => {
    if (i) largo += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
    pos.push(x, y0, z, x, y1, z); uv.push(largo, 0, largo, 1);
    if (i) { const q = (i - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/* color por vértice: un color, o una función (x, y, z) → THREE.Color */
function pintar(g, c) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), k = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    if (typeof c === 'function') k.copy(c(p.getX(i), p.getY(i), p.getZ(i))); else k.set(c);
    col[i * 3] = k.r; col[i * 3 + 1] = k.g; col[i * 3 + 2] = k.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
/* saca los triángulos cuyo centro cumple fn (el hueco del sillón huevo) */
function cortar(g0, fn) {
  const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, quedan = [];
  for (let t = 0; t < P.count; t += 3) {
    const x = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3, y = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3, z = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3;
    if (!fn(x, y, z)) quedan.push(t);
  }
  const n = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(g.attributes)) {
    const w = a.itemSize, arr = new Float32Array(quedan.length * 3 * w);
    quedan.forEach((t, j) => { for (let v = 0; v < 3; v++) for (let c = 0; c < w; c++) arr[(j * 3 + v) * w + c] = a.array[(t + v) * w + c]; });
    n.setAttribute(k, new THREE.BufferAttribute(arr, w));
  }
  return n;
}
/* varias esferas en una geometría (arbustos, copas, montículos de plantas) */
function racimo(lista, ws = 10, hs = 7) {
  const gs = lista.map(([x, y, z, r, col, sx = 1, sy = 1, sz = 1]) => { const g = esfera(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); return pintar(g, col); });
  return mergeGeometries(gs.map((g) => g.toNonIndexed()));
}

/* ¿(x, z) cae adentro del polígono [[x, z], …]? */
function dentroPoli(x, z, poli) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) { const [xi, zi] = poli[i], [xj, zj] = poli[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d; }
  return d;
}
/* un rectángulo redondeado (centrado en cx, cy) como camino de una forma o de un hueco */
function rrect(f, cx, cy, w, h, r) {
  const x = cx - w / 2, y = cy - h / 2;
  f.moveTo(x + r, y); f.lineTo(x + w - r, y); f.quadraticCurveTo(x + w, y, x + w, y + r); f.lineTo(x + w, y + h - r); f.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  f.lineTo(x + r, y + h); f.quadraticCurveTo(x, y + h, x, y + h - r); f.lineTo(x, y + r); f.quadraticCurveTo(x, y, x + r, y);
  return f;
}

/* -------------------------------------------------------- el armador */
class Obra {
  constructor() { this.g = new THREE.Group(); this.medidas = {}; }
  /* una pieza: geometría, material, lugar y (opcional) giro, escala, mirar a un punto */
  pon(geo, k, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, M(k));
    m.position.set(x, y, z);
    if (o.r) m.rotation.set(...o.r);
    if (o.ry) m.rotation.y = o.ry;
    if (o.s) typeof o.s === 'number' ? m.scale.setScalar(o.s) : m.scale.set(...o.s);
    if (o.mirar) m.lookAt(o.mirar);
    if (o.nombre) { m.name = o.nombre; m.userData.aparte = true; }
    this.g.add(m); return m;
  }
  /* se funde todo lo que comparte material (menos lo que tiene nombre: se anima) */
  cerrar() {
    const g = this.g; g.updateMatrixWorld(true);
    const porMat = new Map(), aparte = [];
    g.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.aparte) { aparte.push(o); return; }
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (o.material.vertexColors && !geo.attributes.color) pintar(geo, '#ffffff');
      if (!o.material.vertexColors && geo.attributes.color) geo.deleteAttribute('color');
      if (!porMat.has(o.material)) porMat.set(o.material, []);
      porMat.get(o.material).push(geo);
    });
    const R = new THREE.Group();
    for (const [mat, geos] of porMat) {
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.geometry.computeBoundingSphere();
      if (mat.transparent) { m.renderOrder = 4; m.castShadow = false; } else { m.castShadow = true; m.receiveShadow = true; }
      R.add(m);
    }
    for (const o of aparte) { o.removeFromParent(); o.matrixWorld.decompose(o.position, o.quaternion, o.scale); R.add(o); }
    const caja3 = new THREE.Box3().setFromObject(R);
    R.userData.tam = caja3.getSize(new THREE.Vector3());
    R.userData.medidas = this.medidas;
    return R;
  }
}
/* un ojo de buey: aro blanco y vidrio abombado, mirando hacia (nx, nz) */
function ojoDeBuey(O, x, y, z, nx, nz, r = 0.42, alto = 1) {
  const d = V3(x + nx, y, z + nz);
  O.pon(new THREE.TorusGeometry(r, r * 0.2, 6, 20), 'blanco', x + nx * 0.02, y, z + nz * 0.02, { mirar: d, s: [1, alto, 1] });
  O.pon(esfera(r * 0.92, 14, 8), 'ventana', x, y, z, { mirar: d, s: [1, alto, 0.28] });
}
/* arbustos al azar en una zona: dentro(x, z) dice si va; y0 el piso */
function arbustos(O, n, zona, dentro, y0, sem, { flores = true, rMin = 0.3, rMax = 0.55 } = {}) {
  const r = azar(sem), verdes = ['#2f9e2a', '#3fb536', '#52c843', '#6fd84f', '#48b83a'], colF = ['#ff8fcf', '#ffe14a', '#ffffff', '#ff9ad8', '#c77bff'];
  const bs = [], fs = [];
  for (let i = 0, k = 0; i < n * 8 && k < n; i++) {
    const x = zona[0] + r() * (zona[1] - zona[0]), z = zona[2] + r() * (zona[3] - zona[2]);
    if (!dentro(x, z)) continue;
    const rr = rMin + r() * (rMax - rMin); k++;
    bs.push([x, y0 + rr * 0.7, z, rr, verdes[k % 5], 1, 0.85, 1]);
    if (flores && r() < 0.6) for (let j = 0; j < 2; j++) { const a = r() * TAU; fs.push([x + Math.cos(a) * rr * 0.6, y0 + rr * 1.2, z + Math.sin(a) * rr * 0.6, 0.08, colF[(k + j) % 5]]); }
  }
  if (bs.length) O.pon(racimo(bs), 'plantas');
  if (fs.length) O.pon(racimo(fs, 6, 4), 'flores');
}

/* =================================================================== la casa */
/* dos pisos de "cuadrado redondo" con ojos de buey, filete aqua, terraza con
   jardín y baranda de vidrio adelante a la izquierda, y la cúpula de vidrio */
function casa() {
  const O = new Obra(), W = 9, D = 7.4, n = 3.2;
  O.pon(prisma(sq(W + 1.3, D + 1.3, n), 0.35, 0.12), 'blanco');                       // el zócalo
  O.pon(prisma(sq(W + 0.12, D + 0.12, n), 0.72, 0.16), 'aqua', 0, 0.28, 0);            // la banda aqua de abajo
  O.pon(prisma(sq(W, D, n), 2.95, 0.3), 'blanco', 0, 0.92, 0);                         // la planta baja
  O.pon(prisma(sq(W + 0.18, D + 0.18, n), 0.28, 0.1), 'aqua', 0, 3.8, 0);              // el filete entre pisos
  O.pon(tubo(sq(W + 0.3, D + 0.3, n, 96).map(([x, z]) => [x, 3.8, z]), 0.035, 160, 6, true), 'luzAqua');   // la luz del filete
  O.pon(prisma(sq(W - 0.15, D - 0.15, n), 0.18, 0.06), 'blanco', 0, 4.04, 0);          // el piso de la terraza
  /* la puerta: un zaguán con puerta celeste y su ojo de buey, y la escalerita */
  const pd = sqPunto(W, D, n, -0.3), rd = Math.atan2(pd.nx, pd.nz);
  const en = (d, y) => [pd.x + pd.nx * d, y, pd.z + pd.nz * d];
  O.pon(caja(1.8, 2.7, 0.7, 0.28), 'blanco', ...en(0.05, 0.92 + 1.35), { ry: rd });
  O.pon(caja(1.15, 2.2, 0.12, 0.12), 'puerta', ...en(0.42, 0.92 + 1.12), { ry: rd });
  ojoDeBuey(O, ...en(0.5, 2.55), pd.nx, pd.nz, 0.2);
  O.pon(esfera(0.06, 10, 8), 'blanco', pd.x + pd.nx * 0.5 + Math.cos(rd) * 0.38, 1.95, pd.z + pd.nz * 0.5 - Math.sin(rd) * 0.38);
  for (let s = 0; s < 3; s++) {
    const top = 0.92 - 0.19 * s - 0.19;
    O.pon(caja(1.8, top, 0.42, 0.06), 'aqua', ...en(0.85 + s * 0.4, top / 2), { ry: rd });
    O.pon(caja(1.8, 0.04, 0.42, 0.015), 'blanco', ...en(0.85 + s * 0.4, top + 0.01), { ry: rd });
  }
  /* ojos de buey de abajo (menos donde está la puerta) y las costuras de los paneles */
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + 0.26; if (Math.abs(Math.atan2(Math.sin(a + 0.3), Math.cos(a + 0.3))) < 0.4) continue;
    const p = sqPunto(W, D, n, a); ojoDeBuey(O, p.x + p.nx * 0.28, 2.4, p.z + p.nz * 0.28, p.nx, p.nz, 0.46, 1.22);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU; if (Math.abs(Math.atan2(Math.sin(a + 0.3), Math.cos(a + 0.3))) < 0.55) continue;
    const p = sqPunto(W, D, n, a); O.pon(caja(0.05, 2.6, 0.05, 0.02), 'costura', p.x + p.nx * 0.3, 2.35, p.z + p.nz * 0.3);
  }
  /* la planta alta: el mismo contorno, pero abrazando la terraza de adelante a la
     izquierda (el borde de adentro es una curva, con el ventanal) */
  const a1 = 0.55, a0 = TAU - 1.85, arco = [];
  for (let i = 0; i <= 44; i++) { const p = sqPunto(W, D, n, a1 + (a0 - a1) * i / 44); arco.push([p.x, p.z]); }
  const P0 = arco[arco.length - 1], P1 = arco[0], C = [0.9, -0.5], curva = [];
  for (let i = 1; i < 28; i++) { const t = i / 28, u = 1 - t; curva.push([u * u * P0[0] + 2 * u * t * C[0] + t * t * P1[0], u * u * P0[1] + 2 * u * t * C[1] + t * t * P1[1]]); }
  const alta = [...arco, ...curva];
  O.pon(prisma(alta, 2.55, 0.3), 'blanco', 0, 4.12, 0);
  O.pon(prisma(alta, 0.24, 0.1, 3, 0.42), 'aqua', 0, 6.55, 0);
  O.pon(prisma(alta, 0.14, 0.05), 'blanco', 0, 6.72, 0);
  /* el ventanal curvo que da a la terraza (corrido afuera lo que abomba el borde), con parantes */
  const hacia = [-2.6, 2.4], ventanal = [P0, ...curva, P1].map(([x, z], i, L) => {
    const [xa, za] = L[Math.max(0, i - 1)], [xb, zb] = L[Math.min(L.length - 1, i + 1)];
    let nx = zb - za, nz = -(xb - xa); const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (nx * (hacia[0] - x) + nz * (hacia[1] - z) < 0) { nx = -nx; nz = -nz; }
    return [x + nx * 0.33, z + nz * 0.33];
  });
  O.pon(cinta(ventanal, 4.45, 6.4), 'ventana');
  for (let i = 2; i < ventanal.length - 1; i += 3) { const [x, z] = ventanal[i]; O.pon(cil(0.05, 1.95, 8), 'blanco', x, 5.42, z); }
  O.pon(tubo(ventanal.map(([x, z]) => [x, 6.42, z]), 0.07, 40, 6), 'aqua');
  /* ojos de buey de arriba, del lado de afuera */
  for (let i = 0; i < 9; i++) {
    const a = 0.95 + i / 8 * (a0 - 0.4 - 0.95); const p = sqPunto(W, D, n, a);
    ojoDeBuey(O, p.x + p.nx * 0.28, 5.35, p.z + p.nz * 0.28, p.nx, p.nz, 0.42, 1.2);
  }
  /* la baranda de vidrio de la terraza, con su pasamanos, y el jardín */
  const baranda = []; for (let i = 0; i <= 40; i++) { const p = sqPunto(W - 0.35, D - 0.35, n, a0 - TAU + (a1 - a0 + TAU) * i / 40); baranda.push([p.x, p.z]); }
  O.pon(cinta(baranda, 4.2, 5.05), 'vidrio');
  O.pon(tubo(baranda.map(([x, z]) => [x, 5.08, z]), 0.055, 60, 6), 'blanco');
  O.pon(tubo(baranda.map(([x, z]) => [x, 4.22, z]), 0.05, 60, 6), 'aqua');
  const dentroSq = (x, z, w, d) => (Math.abs(x) / (w / 2)) ** n + (Math.abs(z) / (d / 2)) ** n < 1;
  const altaGrande = alta.map(([x, z]) => [x * 1.08 + 0.1, z * 1.08 - 0.1]);
  arbustos(O, 30, [-W / 2, W / 2, -D / 2, D / 2], (x, z) => dentroSq(x, z, W - 1.2, D - 1.2) && !dentroPoli(x, z, altaGrande), 4.2, 7);
  /* la cúpula de vidrio sobre la planta alta, con costillas blancas y plantas adentro */
  const ox = 1.35, oz = -1.2, A = 3.2, B = 2.9, Cz = 2.35, yc = 6.86;
  const cup = new THREE.SphereGeometry(1, 40, 16, 0, TAU, 0, Math.PI / 2); cup.scale(A, B, Cz);
  O.pon(cup, 'cupula', ox, yc, oz);
  for (let k = 0; k < 4; k++) {
    const f = k / 4 * Math.PI, pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI; pts.push([ox + A * Math.cos(t) * Math.cos(f), yc + B * Math.sin(t), oz + Cz * Math.cos(t) * Math.sin(f)]); }
    O.pon(tubo(pts, 0.05, 32, 6), 'blanco');
  }
  const base = []; for (let i = 0; i < 48; i++) { const t = i / 48 * TAU; base.push([ox + A * Math.cos(t), yc + 0.02, oz + Cz * Math.sin(t)]); }
  O.pon(tubo(base, 0.1, 64, 8, true), 'aqua');
  arbustos(O, 10, [ox - A, ox + A, oz - Cz, oz + Cz], (x, z) => ((x - ox) / (A - 0.6)) ** 2 + ((z - oz) / (Cz - 0.6)) ** 2 < 1, yc + 0.05, 3, { rMin: 0.35, rMax: 0.6 });
  return O.cerrar();
}

/* =============================================================== la estación */
/* octogonal: plataforma blanca redonda con franjas amarillas, paredes de vidrio
   con parantes, techo blanco de borde mullido con un jardín encima, y adentro
   dos bancos curvos celestes y el cartelito del tren */
function estacion() {
  const O = new Obra(), R = 7.2, H0 = 0.8, Rv = 5.7, Hv = 3.7, Rt = 6.2;
  O.pon(torno([[0, 0], [R - 0.35, 0], [R - 0.05, 0.08], [R + 0.05, 0.35], [R, 0.6], [R - 0.2, 0.75], [R - 0.5, H0], [0, H0]], 64), 'blanco');
  O.pon(new THREE.CircleGeometry(R - 0.52, 64).rotateX(-Math.PI / 2), 'piso', 0, H0 + 0.004, 0);
  for (const a of [-0.3, 0.3, 1.9, -1.9, Math.PI]) O.pon(caja(1.5, 0.03, 0.42, 0.01), 'amarillo', Math.sin(a) * (R - 0.95), H0 + 0.012, Math.cos(a) * (R - 0.95), { ry: a });
  const ap = Rv * Math.cos(Math.PI / 8), ancho = 2 * Rv * Math.sin(Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a0 = (i - 0.5) / 8 * TAU, am = i / 8 * TAU;
    const [vx, vz] = [Math.sin(a0) * Rv, Math.cos(a0) * Rv], [cx, cz] = [Math.sin(am) * ap, Math.cos(am) * ap];
    O.pon(cil(i === 0 || i === 1 ? 0.17 : 0.13, Hv, 12), i === 0 || i === 1 ? 'blanco' : 'gris', vx, H0 + Hv / 2, vz);
    if (i === 0) continue;   // la entrada (+z)
    O.pon(new THREE.PlaneGeometry(ancho - 0.12, Hv - 0.2), 'vidrioAzul', cx, H0 + Hv / 2 + 0.05, cz, { ry: am });
    O.pon(caja(ancho, 0.12, 0.12, 0.04), 'gris', cx, H0 + Hv - 0.12, cz, { ry: am });
    O.pon(caja(ancho, 0.14, 0.12, 0.04), 'gris', cx, H0 + 0.1, cz, { ry: am });
    O.pon(caja(ancho, 0.08, 0.08, 0.03), 'gris', cx, H0 + 1.15, cz, { ry: am });
    if (i % 2) O.pon(cil(0.05, Hv, 8), 'gris', cx, H0 + Hv / 2, cz);
  }
  /* el techo: una losa octogonal de borde bien redondo, y encima el montículo de plantas */
  const oct = []; for (let i = 0; i < 8; i++) { const a = (i - 0.5) / 8 * TAU; oct.push([Math.sin(a) * Rt, Math.cos(a) * Rt]); }
  const yT = H0 + Hv - 0.05;
  O.pon(prisma(oct, 1.15, 0.45, 6, 0.55), 'blanco', 0, yT, 0);
  const r = azar(12), verdes = ['#2f9e2a', '#3fb536', '#52c843', '#6fd84f', '#48b83a'], bs = [], fs = [];
  for (let k = 0; k < 260; k++) {
    const a = r() * TAU, d = Math.sqrt(r()) * (Rt - 0.15), x = Math.sin(a) * d, z = Math.cos(a) * d;
    const y = yT + 1.05 + (1 - (d / Rt) ** 2) * 1.0, rr = 0.3 + r() * 0.22;
    bs.push([x, y, z, rr, verdes[k % 5], 1, 0.75, 1]);
    if (r() < 0.45) fs.push([x + (r() - 0.5) * rr, y + rr * 0.72, z + (r() - 0.5) * rr, 0.085, ['#ff8fcf', '#ffe14a', '#ffffff', '#ffb0e0'][k % 4]]);
  }
  O.pon(racimo(bs, 8, 6), 'plantas'); O.pon(racimo(fs, 6, 4), 'flores');
  /* los dos bancos curvos (asiento y respaldo) */
  for (const [a0, a1] of [[-2.55, -0.95], [0.95, 2.55]]) {
    O.pon(arcoSolido(2.35, 2.95, a0, a1, 0.5, 0.1), 'celeste', 0, H0, 0);
    O.pon(arcoSolido(2.85, 3.08, a0, a1, 1.05, 0.08), 'celeste', 0, H0, 0);
  }
  /* el cartelito con el tren, mirando a la entrada */
  const pc = [Math.sin(2.9) * 3.9, Math.cos(2.9) * 3.9];
  O.pon(cil(0.05, 1.3, 8), 'gris', pc[0], H0 + 0.65, pc[1]);
  O.pon(caja(1.0, 0.7, 0.1, 0.05), 'gris', pc[0], H0 + 1.65, pc[1], { ry: 2.9 + Math.PI });
  O.pon(new THREE.PlaneGeometry(0.86, 0.54), 'pantallaTren', pc[0] + Math.sin(2.9 + Math.PI) * 0.06, H0 + 1.65, pc[1] + Math.cos(2.9 + Math.PI) * 0.06, { ry: 2.9 + Math.PI });
  O.medidas = { anden: H0, pared: ap };
  return O.cerrar();
}

/* ================================================================= el tren */
/* monorriel: cuerpo torneado con nariz de bala, franja de vidrio azul que da
   la vuelta por el parabrisas, franja lima abajo, faros y la viga */
/* viga: con su pedazo de viga abajo (el de la estación vieja); sin viga, el
   vagón del monorriel de la isla, que anda sobre la viga larga: la base es la pollera */
function tren(viga = true) {
  const O = new Obra(), R = 1.25, yc = viga ? 2.25 : 1.675;
  const perfil = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10, y = -4.1 + 0.9 * t; perfil.push([R * Math.sqrt(Math.max(0, 1 - ((y + 3.2) / 0.9) ** 2)), y]); }
  for (let i = 1; i <= 10; i++) perfil.push([R, -3.2 + 5.5 * i / 10]);
  for (let i = 1; i <= 14; i++) { const y = 2.3 + 1.8 * i / 14; perfil.push([R * Math.sqrt(Math.max(0, 1 - ((y - 2.3) / 1.8) ** 2)), y]); }
  const tramo = (y0, y1, k = 1.012) => perfil.filter(([, y]) => y >= y0 && y <= y1).map(([r, y]) => [r * k, y]);
  /* la nariz de bala baja hacia la punta: se aplasta de arriba lo que pasa de z = 2,3 */
  const nariz = (g) => { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const z = P.getZ(i); if (z <= 2.3) continue; const u = (z - 2.3) / 1.8, y = P.getY(i) - yc; P.setY(i, yc + y * (1 - 0.3 * u) - 0.42 * u * u); } g.computeVertexNormals(); return g; };
  const lat = (pts, f0, fl) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-3), y)), 40, f0, fl); g.rotateX(Math.PI / 2); g.scale(0.95, 1.12, 1); g.translate(0, yc, 0); return nariz(g); };
  O.pon(lat(perfil, 0, TAU), 'blanco');
  /* el vidrio: a los dos costados arriba, y sobre la nariz de lado a lado */
  for (const f0 of [1.75, TAU - 2.5]) O.pon(lat(tramo(-3.1, 2.4), f0, 0.75), 'ventanaOscura');
  O.pon(lat(tramo(2.3, 3.55), 1.95, TAU - 3.9), 'ventanaOscura');
  for (let y = -2.3; y < 2.2; y += 1.1) for (const f0 of [1.75, TAU - 2.5]) O.pon(lat([[R * 1.02, y - 0.04], [R * 1.02, y + 0.04]], f0, 0.75), 'blanco');
  for (const f0 of [1.2, TAU - 1.38]) O.pon(lat(tramo(-3.9, 3.35, 1.008), f0, 0.18), 'lima');
  for (const s of [-1, 1]) O.pon(esfera(0.11, 12, 8), 'faro', s * 0.5, yc - 0.85, 3.62);
  O.pon(caja(1.9, 0.55, 6.6, 0.2), 'gris', 0, yc - 1.4, 0);
  if (viga) O.pon(caja(1.1, 0.55, 9.6, 0.12), 'blanco', 0, 0.275, 0);
  return O.cerrar();
}

/* ================================================================ la tienda */
/* un cubo blanco de esquinas muy redondas, con el filete verde por el borde,
   la vidriera grande a la izquierda, la puerta con toldo verde a la derecha,
   caños verdes al costado y la máquina del techo */
function tienda() {
  const O = new Obra(), W = 11, H = 5.4, D = 8;
  /* el frente, redondeado arriba (más a la derecha), estirado hacia atrás */
  const fr = new THREE.Shape(); const rI = 1.3, rD = 2.3, rB = 0.3;
  fr.moveTo(-W / 2 + rB, 0); fr.lineTo(W / 2 - rB, 0); fr.quadraticCurveTo(W / 2, 0, W / 2, rB); fr.lineTo(W / 2, H - rD);
  fr.quadraticCurveTo(W / 2, H, W / 2 - rD, H); fr.lineTo(-W / 2 + rI, H); fr.quadraticCurveTo(-W / 2, H, -W / 2, H - rI); fr.lineTo(-W / 2, rB); fr.quadraticCurveTo(-W / 2, 0, -W / 2 + rB, 0);
  const cuerpo = new THREE.ExtrudeGeometry(fr, { depth: D - 0.8, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.35, bevelSegments: 5, curveSegments: 10 });
  cuerpo.translate(0, 0, -(D - 0.8) / 2);
  O.pon(cuerpo, 'blanco', 0, 0.3, 0, { s: [1, 0.94, 1] });
  O.pon(caja(W + 0.6, 0.36, D + 0.6, 0.15), 'verde', 0, 0.18, 0);
  /* el filete verde del frente: arriba y bajando por la derecha */
  const zf = D / 2 + 0.01, filete = [[-W / 2 + 0.4, H - 0.9], [-W / 2 + 1.1, H - 0.25], [0, H - 0.25], [W / 2 - 2.2, H - 0.25], [W / 2 - 0.75, H - 0.9], [W / 2 - 0.35, H - 2.2], [W / 2 - 0.35, 0.6]].map(([x, y]) => [x, y * 0.94 + 0.3, zf]);
  O.pon(tubo(filete, 0.14, 60, 8), 'verde');
  O.pon(tubo([[-W / 2 + 0.35, 0.6, zf], [-W / 2 + 0.35, H * 0.94 - 0.9, zf], [-W / 2 + 0.6, H * 0.94 - 0.2, zf]], 0.1, 20, 8), 'verde');
  /* la vidriera: vidrio, marco blanco y un parante */
  O.pon(caja(4.8, 3.3, 0.14, 0.12), 'ventana', -2.3, 2.3, D / 2 + 0.02);
  O.pon(tubo([[-4.7, 0.62, zf + 0.05], [-4.7, 3.7, zf + 0.05], [-4.0, 3.98, zf + 0.05], [0.1, 3.98, zf + 0.05], [0.1, 0.62, zf + 0.05], [-4.7, 0.62, zf + 0.05]], 0.08, 60, 6), 'blanco');
  O.pon(caja(4.9, 0.12, 0.3, 0.05), 'verde', -2.3, 0.56, zf + 0.1);
  O.pon(cil(0.05, 3.3, 8), 'blanco', -1.1, 2.3, zf + 0.06);
  /* la puerta de vidrio, sus columnas verdes y el toldo verde redondo */
  const px = W * 0.2;
  O.pon(caja(1.8, 2.7, 0.12, 0.06), 'ventana', px, 1.65, D / 2 + 0.03);
  O.pon(cil(0.03, 2.6, 6), 'blanco', px, 1.6, D / 2 + 0.1);
  for (const s of [-1, 1]) O.pon(caja(0.26, 3.0, 0.34, 0.1), 'verde', px + s * 1.12, 1.8, D / 2 + 0.12);
  /* el toldo: un cuarto de caño grueso que sale de la pared y baja, de punta redonda */
  const tol = new THREE.Shape(); tol.moveTo(0, 1.0);
  for (let i = 1; i <= 16; i++) { const t = i / 16 * Math.PI / 2; tol.lineTo(1.45 * Math.sin(t), 1.0 * Math.cos(t)); }
  for (let i = 16; i >= 0; i--) { const t = i / 16 * Math.PI / 2; tol.lineTo(1.22 * Math.sin(t), 0.8 * Math.cos(t)); }
  const toldo = new THREE.ExtrudeGeometry(tol, { depth: 2.7, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.08, bevelSegments: 4, curveSegments: 4 });
  toldo.rotateY(-Math.PI / 2); toldo.translate(px + 1.35, 2.95, D / 2 + 0.3);
  O.pon(toldo, 'verde');
  O.pon(caja(2.6, 0.05, 0.9, 0.02), 'luzAqua', px, 3.0, D / 2 + 0.85);
  /* los caños del costado derecho y la caja de aire */
  O.pon(tubo([[W / 2 + 0.3, 0.3, 1.6], [W / 2 + 0.3, 4.3, 1.6], [W / 2 + 0.1, 5.1, 1.2], [W / 2 - 0.8, 5.35, 0.9]], 0.17, 40, 10), 'verde');
  O.pon(tubo([[W / 2 + 0.3, 0.3, -1.2], [W / 2 + 0.3, 3.6, -1.2], [W / 2 + 0.3, 4.0, -0.4], [W / 2 + 0.3, 4.0, 0.6]], 0.13, 40, 10), 'verde');
  O.pon(caja(0.55, 1.4, 1.5, 0.15), 'verde', W / 2 + 0.3, 1.5, -0.1);
  for (let i = 0; i < 5; i++) O.pon(caja(0.04, 0.05, 1.2, 0.01), 'oscuro', W / 2 + 0.59, 1.0 + i * 0.25, -0.1);
  /* la máquina del techo, con su rejilla */
  O.pon(caja(5.4, 1.1, 3.8, 0.45, 4), 'perla', -0.6, H * 0.94 + 0.3 + 0.45, -1.4);
  for (let i = 0; i < 6; i++) O.pon(caja(0.9, 0.05, 0.04, 0.01), 'oscuro', 1.4, H * 0.94 + 0.55 + i * 0.13, 0.52);
  return O.cerrar();
}

/* ================================================================== el hotel */
/* torre redonda de vidrio aqua con un balcón blanco por piso (y su baranda de
   vidrio), cúpula de vidrio con costillas, sobre una base de arena con césped,
   caminos, maceteros redondos y palmeritas */
function hotel() {
  const O = new Obra(), N = 14, fh = 3.0, r0 = 6.2, r1 = 5.5, y0 = 1.05, Ht = N * fh;
  O.pon(prisma(sq(22, 22, 6), 0.8, 0.2), 'arena');
  O.pon(prisma(sq(18.4, 18.4, 3), 0.28, 0.1), 'cesped', 0, 0.78, 0);
  for (let k = 0; k < 4; k++) O.pon(caja(2.2, 0.08, 5.5, 0.03), 'blanco', Math.sin(k * TAU / 4) * 8.4, 1.07, Math.cos(k * TAU / 4) * 8.4, { ry: k * TAU / 4 });
  const bs = [];
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * TAU, x = Math.sin(a) * 9.0, z = Math.cos(a) * 9.0;
    O.pon(torno([[1.2, 0], [1.3, 0.45], [1.18, 0.55], [1.05, 0.3], [0, 0.3]], 24), 'blanco', x, 1.0, z);
    bs.push([x + 0.4, 1.55, z + 0.3, 0.5, '#3fb536'], [x - 0.45, 1.5, z - 0.2, 0.45, '#52c843'], [x, 1.55, z - 0.5, 0.4, '#2f9e2a']);
    if (k % 2 === 0) palmeraEn(O, x, 1.3, z, 0.7, a);
  }
  O.pon(racimo(bs), 'plantas');
  /* la torre y los balcones */
  const torre = new THREE.CylinderGeometry(r1, r0, Ht, 48, 1, true); torre.translate(0, y0 + Ht / 2, 0);
  O.pon(torre, 'hotelVidrio');
  for (let i = 1; i <= N; i++) {
    const y = y0 + i * fh - 0.15, rr = r0 + (r1 - r0) * (i / N) + 1.15;
    O.pon(torno([[0, -0.12], [rr, -0.12], [rr + 0.1, -0.02], [rr + 0.1, 0.06], [rr, 0.14], [0, 0.14]], 48), 'blanco', 0, y, 0);
    const b = new THREE.CylinderGeometry(rr - 0.02, rr - 0.02, 0.7, 48, 1, true); b.translate(0, y + 0.5, 0); O.pon(b, 'vidrio');
    O.pon(new THREE.TorusGeometry(rr - 0.02, 0.04, 6, 48), 'blanco', 0, y + 0.86, 0, { r: [Math.PI / 2, 0, 0] });
  }
  /* la cúpula, las costillas, la casilla y la antena */
  const yc = y0 + Ht + 0.1, rc = r1 * 0.95;
  O.pon(torno([[0, 0], [r1 + 0.4, 0], [r1 + 0.45, 0.2], [0, 0.25]], 48), 'blanco', 0, yc - 0.1, 0);
  const cup = new THREE.SphereGeometry(rc, 32, 12, 0, TAU, 0, Math.PI / 2); cup.translate(0, yc + 0.15, 0); O.pon(cup, 'hotelCupula');
  for (let k = 0; k < 6; k++) { const f = k / 6 * Math.PI, pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI; pts.push([rc * Math.cos(t) * Math.cos(f) * 1.01, yc + 0.15 + rc * Math.sin(t) * 1.01, rc * Math.cos(t) * Math.sin(f) * 1.01]); } O.pon(tubo(pts, 0.07, 30, 6), 'blanco'); }
  O.pon(caja(2.4, 1.3, 1.8, 0.35), 'blanco', r1 * 0.65, yc + 0.8, -r1 * 0.3);
  O.pon(cil(0.06, 2.4, 6), 'blanco', 0, yc + rc + 1.3, 0);
  /* la entrada: marquesina y puertas */
  O.pon(caja(4.6, 0.25, 2.6, 0.12), 'blanco', 0, y0 + 3.3, r0 + 1.1);
  for (const s of [-1, 1]) O.pon(cil(0.08, 3.2, 8), 'blanco', s * 2.0, y0 + 1.6, r0 + 2.1);
  O.pon(caja(3.2, 2.6, 0.12, 0.05), 'ventana', 0, y0 + 1.3, r0 + 0.02);
  O.medidas = { radio: r0 };
  return O.cerrar();
}

/* ================================================================ la fuente */
/* pileta redonda de borde grueso con un escalón adentro, agua con reflejos que
   se mueven, el adorno de gelatina verde y azul, la columna con su copa, la
   bola de vidrio con su luz y los chorros que caen en arco */
function fuente() {
  const O = new Obra();
  O.pon(torno([[0, 0.02], [3.3, 0.02], [3.62, 0.06], [3.74, 0.3], [3.72, 0.6], [3.6, 0.73], [3.4, 0.77], [3.25, 0.71], [3.22, 0.35], [0, 0.35]], 64), 'blanco');
  O.pon(torno([[2.5, 0.35], [2.9, 0.35], [2.92, 0.46], [2.85, 0.5], [2.5, 0.5]], 64), 'perla');
  O.pon(new THREE.CircleGeometry(3.24, 64).rotateX(-Math.PI / 2), 'aguaFuente', 0, 0.63, 0);
  for (let k = 0; k < 6; k++) O.pon(new THREE.TorusGeometry(1.15, 0.5, 12, 10, TAU / 6), k % 2 ? 'azulAgua' : 'verdeAgua', 0, 1.0, 0, { r: [Math.PI / 2, 0, k * TAU / 6] });
  O.pon(torno([[0.46, 0.6], [0.34, 0.95], [0.26, 1.6], [0.3, 2.02], [0, 2.06]], 32), 'perla');
  O.pon(torno([[0, 2.0], [0.55, 2.04], [0.72, 2.24], [0.64, 2.32], [0.42, 2.2], [0, 2.2]], 32), 'perla');
  O.pon(esfera(1.05, 32, 20), 'bola', 0, 3.25, 0);
  O.pon(esfera(0.45, 20, 14), 'nucleoAgua', 0, 3.25, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * TAU, pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, rr = 0.4 + 2.35 * t; pts.push([Math.sin(a) * rr, 3.9 + 1.1 * t - 4.35 * t * t, Math.cos(a) * rr]); }
    O.pon(tubo(pts, 0.055, 24, 5), 'chorro');
  }
  O.medidas = { borde: 0.77 };
  return O.cerrar();
}

/* ================================================================== el banco */
/* asiento y respaldo celestes de una pieza, con franja blanca, y patas de lazo */
function banco() {
  const O = new Obra();
  O.pon(caja(2.0, 0.2, 0.64, 0.1), 'celeste', 0, 0.5, 0.05);
  /* el respaldo: un marco redondo con la ranura, y la franja blanca abajo */
  const resp = rrect(new THREE.Shape(), 0, 0, 2.0, 0.56, 0.2); resp.holes.push(rrect(new THREE.Path(), 0, 0.08, 1.45, 0.13, 0.065));
  const rg = new THREE.ExtrudeGeometry(resp, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3, curveSegments: 6 });
  rg.translate(0, 0, -0.045); rg.rotateX(-0.2); O.pon(rg, 'celeste', 0, 0.86, -0.3);
  O.pon(caja(1.9, 0.12, 0.06, 0.03), 'blanco', 0, 0.76, -0.25, { r: [-0.2, 0, 0] });
  O.pon(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 14), 'celeste', 0, 0.57, -0.24, { r: [0, 0, Math.PI / 2] });
  O.pon(caja(1.9, 0.06, 0.05, 0.02), 'blanco', 0, 0.55, 0.36);
  /* las patas: lazos redondos a los costados */
  for (const s of [-0.9, 0.9]) {
    const lazo = rrect(new THREE.Shape(), 0, 0.25, 0.72, 0.5, 0.16); lazo.holes.push(rrect(new THREE.Path(), 0, 0.22, 0.36, 0.2, 0.08));
    const g = new THREE.ExtrudeGeometry(lazo, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -0.06); g.rotateY(Math.PI / 2); g.translate(s, 0, 0.02); O.pon(g, 'celeste');
  }
  O.medidas = { asiento: 0.6 };
  return O.cerrar();
}

/* ============================================================ farol y lámpara */
/* el farol: pie redondo, caño que sube y se curva como un gancho, y la bocha de
   vidrio esmerilado colgando con su luz adentro */
function farol() {
  const O = new Obra(), bx = 0.95, by = 2.92;
  O.pon(torno([[0, 0], [0.3, 0], [0.32, 0.05], [0.22, 0.13], [0.1, 0.22], [0, 0.22]], 24), 'blanco');
  O.pon(tubo([[0, 0.15, 0], [0, 1.4, 0], [-0.04, 2.4, 0], [0.1, 3.1, 0], [0.45, 3.55, 0], [0.8, 3.52, 0], [bx, 3.28, 0]], 0.065, 48, 10), 'blanco');
  O.pon(cil(0.1, 0.12, 12, 0.17), 'blanco', bx, 3.2, 0);
  O.pon(esfera(0.3, 20, 14), 'globo', bx, by, 0);
  O.medidas = { bocha: V3(bx, by, 0), radio: 0.3 };
  return O.cerrar();
}
function lampara() {
  const O = new Obra();
  O.pon(torno([[0, 0], [0.26, 0], [0.28, 0.04], [0.2, 0.08], [0.06, 0.12], [0, 0.12]], 24), 'blanco');
  O.pon(torno([[0.055, 0.1], [0.03, 0.8], [0.035, 1.35], [0.07, 1.5], [0, 1.5]], 12), 'blanco');
  O.pon(torno([[0.06, 1.48], [0.16, 1.54], [0.17, 1.58], [0, 1.58]], 16), 'gris');
  O.pon(esfera(0.26, 24, 16), 'globo', 0, 1.8, 0);
  O.pon(esfera(0.09, 12, 8), 'nucleo', 0, 1.8, 0);
  O.medidas = { bocha: V3(0, 1.8, 0), radio: 0.26 };
  return O.cerrar();
}

/* ====================================================== árbol y palmera */
/* el árbol de burbujas: tronco que se abre en raíces, levemente curvo, y una
   copa de esferas brillantes (más oscuras abajo, más claras arriba) */
function arbol(paleta = ['#4fb52a', '#7fd83a', '#b6f03a'], lejos = false) {
  const O = new Obra();
  const t = torno([[0.62, 0], [0.46, 0.12], [0.34, 0.35], [0.28, 0.9], [0.25, 1.8], [0.23, 2.5], [0.2, 3.1]], lejos ? 6 : 12);
  const P = t.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) + 0.18 * (y / 3) ** 2); }
  t.computeVertexNormals();
  O.pon(pintar(t, (x, y) => new THREE.Color('#7a4a24').lerp(new THREE.Color('#b98552'), Math.min(1, y / 3) * 0.7 + (x > 0 ? 0.15 : 0))), 'troncoArbol');
  if (!lejos) {
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + 0.4, g = esfera(0.28, 10, 6); g.scale(1.3, 0.45, 0.6); g.rotateY(-a); g.translate(Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5); O.pon(pintar(g, '#7a4a24'), 'troncoArbol'); }
    O.pon(pintar(new THREE.CylinderGeometry(0.95, 1.0, 0.1, 20), '#3f9e2a'), 'troncoArbol', 0, 0.04, 0);
  }
  const cA = new THREE.Color(paleta[0]), cB = new THREE.Color(paleta[1]), cC = new THREE.Color(paleta[2]);
  const bolas = [[0, 4.45, 0, 1.15], [0.95, 4.05, 0.25, 0.95], [-0.95, 4.1, -0.15, 0.95], [0.3, 3.95, 1.0, 0.9], [-0.3, 4.0, -1.0, 0.9], [0.85, 3.35, -0.75, 0.82], [-0.85, 3.3, 0.75, 0.82],
    [0.95, 3.25, 0.8, 0.75], [-0.95, 3.25, -0.8, 0.75], [0, 3.15, 0, 0.95], [0.55, 4.95, -0.4, 0.78], [-0.55, 4.9, 0.4, 0.78], [0.1, 3.5, 1.3, 0.62], [-1.35, 3.7, 0.3, 0.62]];
  /* de lejos: las nueve bolas grandes, de pocas caras (las chicas no se ven) */
  const usar = lejos ? bolas.filter(([, , , r], i) => r >= 0.78 && i !== 9) : bolas;
  const gs = usar.map(([x, y, z, r], i) => { const g = lejos ? esfera(r * 1.04, 8, 6) : esfera(r, 12, 9); g.translate(x, y, z); return pintar(g, (px, py) => cA.clone().lerp(cB, THREE.MathUtils.clamp((py - 2.9) / 1.6, 0, 1)).lerp(cC, THREE.MathUtils.clamp((py - y) / r, 0, 1) * 0.55 + (i % 3) * 0.04)); });
  O.pon(mergeGeometries(gs.map((g) => g.toNonIndexed())), 'copaViento');
  return O.cerrar();
}
/* la palmera: tronco curvo de anillos, hojas con folíolos que caen y cocos.
   viento: las hojas se mueven (solo para las instanciadas) */
function palmeraPartes(viento) {
  const curva = new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(0.25, 1.6, 0), V3(0.7, 3.3, 0), V3(1.35, 4.9, 0), V3(1.9, 6.0, 0)]);
  const tr = new THREE.TubeGeometry(curva, 64, 0.36, 12, false), P = tr.attributes.position, UV = tr.attributes.uv;
  const cols = new Float32Array(P.count * 3), c0 = new THREE.Color('#9a6a3a'), c1 = new THREE.Color('#d6aa70'), k = new THREE.Color(), cen = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const u = UV.getX(i), anillo = (u * 20) % 1;
    curva.getPointAt(u, cen); v.set(P.getX(i), P.getY(i), P.getZ(i)).sub(cen);
    const f = (1 - 0.42 * u) * (1 + 0.1 * (1 - Math.abs(anillo * 2 - 1)));
    P.setXYZ(i, cen.x + v.x * f, cen.y + v.y * f, cen.z + v.z * f);
    k.copy(c0).lerp(c1, 0.35 + 0.65 * (1 - Math.abs(anillo * 2 - 1)) * 0.9); cols.set([k.r, k.g, k.b], i * 3);
  }
  tr.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tr.computeVertexNormals();
  const tronco = [tr.toNonIndexed()];
  for (let j = 0; j < 5; j++) { const a = j / 5 * TAU, g = esfera(0.2, 8, 6); g.scale(1.4, 0.5, 0.7); g.rotateY(-a); g.translate(Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.36); tronco.push(pintar(g, '#8a5a30').toNonIndexed()); }
  /* las hojas: un nervio que se arquea y cae, con folíolos finitos a los dos
     lados que cuelgan (así se ven de abajo y de costado, como en la referencia) */
  const top = curva.getPoint(1), hojas = [], pos = [], col = [];
  const cBase = new THREE.Color('#2a8f22'), q = new THREE.Vector3(), q2 = new THREE.Vector3(), dir = new THREE.Vector3(), lado = new THREE.Vector3(), abajo = new THREE.Vector3(0, -1, 0);
  const tri = (a, b, c, k1, k2, k3) => { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); col.push(k1.r, k1.g, k1.b, k2.r, k2.g, k2.b, k3.r, k3.g, k3.b); };
  for (let h = 0; h < 10; h++) {
    const L = 2.8 + (h % 3) * 0.35, a = h / 10 * TAU + (h % 2) * 0.2, alza = 0.55 - (h % 3) * 0.25, caida = 2.4 + (h % 4) * 0.3;
    const cPunta = new THREE.Color(h % 2 ? '#86e44f' : '#6fd83f');
    const nervio = (s0, out) => out.set(top.x + Math.cos(a) * L * s0, top.y + Math.sin(s0 * 1.5) * 0.6 + alza * s0 * 2 - s0 * s0 * caida, top.z + Math.sin(a) * L * s0);
    const rib = []; for (let i = 0; i <= 12; i++) rib.push(nervio(i / 12, new THREE.Vector3()).toArray());
    const tb = tubo(rib, 0.035, 12, 4); hojas.push(pintar(tb, '#3f9e2a').toNonIndexed());
    lado.set(-Math.sin(a), 0, Math.cos(a));
    for (let i = 1; i < 20; i++) {
      const s0 = i / 20; nervio(s0, q); nervio(s0 + 0.02, q2); dir.copy(q2).sub(q).normalize();
      const largo = (0.25 + 0.7 * Math.sin(Math.PI * s0) ** 0.6), k = cBase.clone().lerp(cPunta, s0);
      for (const sd of [-1, 1]) {
        /* el folíolo: sale del nervio hacia el costado, hacia adelante y cayendo */
        const d = lado.clone().multiplyScalar(sd * 0.75).addScaledVector(dir, 0.55).addScaledVector(abajo, 0.55).normalize();
        const w = lado.clone().multiplyScalar(0.05).addScaledVector(dir, 0.1);
        const p0 = q.clone(), pm = q.clone().addScaledVector(d, largo * 0.45), p1 = q.clone().addScaledVector(d, largo);
        const kP = k.clone().lerp(cPunta, 0.4);
        tri(p0, pm.clone().add(w), p1, k, kP, kP); tri(p0, p1, pm.clone().sub(w), k, kP, kP);
      }
    }
  }
  const fol = new THREE.BufferGeometry(); fol.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fol.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  fol.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); fol.computeVertexNormals();
  hojas.push(fol);
  const cocos = [];
  for (let j = 0; j < 6; j++) { const a = j / 6 * TAU, g = esfera(0.23, 10, 8); g.translate(top.x + Math.cos(a) * 0.28, top.y - 0.3 - (j % 2) * 0.14, top.z + Math.sin(a) * 0.28); cocos.push(g.toNonIndexed()); }
  return { tronco: mergeGeometries(tronco), hojas: mergeGeometries(hojas), cocos: mergeGeometries(cocos), hojasMat: viento ? 'hojasViento' : 'hojas' };
}
function palmeraEn(O, x, y, z, s, giro) {
  const P = palmeraPartes(false);
  O.pon(P.tronco, 'tronco', x, y, z, { s, ry: giro }); O.pon(P.hojas, 'hojas', x, y, z, { s, ry: giro }); O.pon(pintar(P.cocos, '#6b4423'), 'tronco', x, y, z, { s, ry: giro });
}
function palmera() {
  const O = new Obra(), P = palmeraPartes(true);
  O.pon(P.tronco, 'troncoPalma'); O.pon(P.hojas, 'hojasPalma'); O.pon(P.cocos, 'cocoPalma');
  return O.cerrar();
}
/* la palmera de lejos: el mismo tronco con pocas caras y las hojas como cintas que caen */
function palmeraLejos() {
  const O = new Obra();
  const curva = new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(0.25, 1.6, 0), V3(0.7, 3.3, 0), V3(1.35, 4.9, 0), V3(1.9, 6.0, 0)]);
  const tr = new THREE.TubeGeometry(curva, 10, 0.3, 5, false);
  O.pon(pintar(tr, (x, y) => new THREE.Color('#9a6a3a').lerp(new THREE.Color('#d6aa70'), 0.4 + 0.3 * Math.sin(y * 9))), 'troncoPalma');
  const top = curva.getPoint(1), pos = [], col = [], c0 = new THREE.Color('#2a8f22'), c1 = new THREE.Color('#7fe04a');
  for (let h = 0; h < 9; h++) {
    const L = 2.9 + (h % 3) * 0.3, a = h / 9 * TAU, alza = 0.55 - (h % 3) * 0.25, caida = 2.5 + (h % 4) * 0.3, lado = V3(-Math.sin(a), 0, Math.cos(a));
    const p = (u) => V3(top.x + Math.cos(a) * L * u, top.y + Math.sin(u * 1.5) * 0.6 + alza * u * 2 - u * u * caida, top.z + Math.sin(a) * L * u);
    for (let i = 0; i < 4; i++) {
      const u0 = i / 4, u1 = (i + 1) / 4, w0 = 0.5 * Math.sin(Math.PI * Math.max(0.15, u0)), w1 = 0.5 * Math.sin(Math.PI * u1), A = p(u0), B = p(u1);
      const a0 = A.clone().addScaledVector(lado, w0).add(V3(0, -w0 * 0.4, 0)), a1 = A.clone().addScaledVector(lado, -w0).add(V3(0, -w0 * 0.4, 0));
      const b0 = B.clone().addScaledVector(lado, w1).add(V3(0, -w1 * 0.4, 0)), b1 = B.clone().addScaledVector(lado, -w1).add(V3(0, -w1 * 0.4, 0));
      const k0 = c0.clone().lerp(c1, u0), k1 = c0.clone().lerp(c1, u1);
      for (const [q, k] of [[a0, k0], [b0, k1], [A, k0], [A, k0], [b0, k1], [B, k1], [a1, k0], [A, k0], [b1, k1], [A, k0], [B, k1], [b1, k1]]) { pos.push(q.x, q.y, q.z); col.push(k.r, k.g, k.b); }
    }
  }
  const hojas = new THREE.BufferGeometry(); hojas.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hojas.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hojas.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); hojas.computeVertexNormals();
  O.pon(hojas, 'hojasPalma');
  return O.cerrar();
}

/* ============================================================== los muebles */
function sofa() {
  const O = new Obra();
  O.pon(caja(2.3, 0.3, 0.95, 0.13), 'celeste', 0, 0.24, 0);
  O.pon(caja(2.2, 0.04, 0.88, 0.015), 'gris', 0, 0.08, 0);
  for (const [x, z] of [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]]) O.pon(cil(0.06, 0.08, 10), 'blanco', x, 0.04, z);
  O.pon(caja(2.45, 0.9, 0.34, 0.16), 'celeste', 0, 0.68, -0.33);
  O.pon(tubo([[-1.2, 1.03, -0.2], [0, 1.05, -0.2], [1.2, 1.03, -0.2]], 0.035, 16, 6), 'blanco');
  for (const s of [-1, 1]) {
    O.pon(new THREE.CapsuleGeometry(0.21, 0.52, 6, 14), 'celeste', s * 1.02, 0.62, 0.02, { r: [Math.PI / 2, 0, 0] });
    O.pon(new THREE.TorusGeometry(0.2, 0.025, 6, 20, Math.PI), 'blanco', s * 1.02, 0.63, 0.34, { r: [0, 0, Math.PI / 2 * s * 0] });
  }
  for (let i = 0; i < 3; i++) {
    O.pon(caja(0.64, 0.2, 0.72, 0.09), 'celesteClaro', -0.66 + i * 0.66, 0.47, 0.06);
    for (const dx of [-0.16, 0.16]) O.pon(esfera(0.03, 8, 6), 'blanco', -0.66 + i * 0.66 + dx, 0.575, 0.06);
  }
  for (let i = 0; i < 4; i++) O.pon(esfera(1, 18, 12), 'blanco', -0.78 + i * 0.52, 0.8, -0.13, { s: [0.33, 0.25, 0.12] });
  for (let i = 0; i < 3; i++) O.pon(cil(0.012, 0.42, 6), 'costura', -0.52 + i * 0.52, 0.8, -0.03);
  return O.cerrar();
}
function sillon() {
  const O = new Obra(), r = 0.62;
  /* la cáscara con el hueco ovalado de adelante: blanca por fuera, lima por dentro */
  const hueco = (x, y, z) => z > 0 && (x / (r * 0.78)) ** 2 + ((y - 0.02) / (r * 0.8)) ** 2 < 1;
  const fuera = cortar(new THREE.SphereGeometry(r, 56, 42), hueco), dentro = cortar(new THREE.SphereGeometry(r * 0.95, 56, 42), hueco);
  O.pon(fuera, 'blanco', 0, 0.95, 0, { s: [1, 1.12, 1] });
  const m = O.pon(dentro, 'tapizLimaDentro', 0, 0.95, 0, { s: [1, 1.12, 1] });
  const filo = []; for (let i = 0; i <= 64; i++) { const t = i / 64 * TAU, x = r * 0.78 * Math.cos(t), y = r * 0.8 * Math.sin(t) + 0.02; filo.push([x, 0.95 + y * 1.12, Math.sqrt(Math.max(0, r * r - x * x - y * y)) * 0.985]); }
  O.pon(tubo(filo, 0.032, 96, 8, true), 'blanco');
  O.pon(esfera(1, 18, 12), 'tapizLima', 0, 0.62, 0.1, { s: [0.42, 0.13, 0.36] });
  O.pon(esfera(1, 18, 12), 'tapizLima', 0, 1.0, -0.3, { s: [0.38, 0.3, 0.13] });
  O.pon(esfera(1, 14, 10), 'tapizLima', -0.3, 0.75, -0.05, { s: [0.1, 0.16, 0.3] });
  O.pon(esfera(1, 14, 10), 'tapizLima', 0.3, 0.75, -0.05, { s: [0.1, 0.16, 0.3] });
  O.pon(cil(0.05, 0.3, 10), 'gris', 0, 0.2, 0);
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; O.pon(caja(0.44, 0.035, 0.05, 0.015), 'gris', Math.cos(a) * 0.2, 0.03, Math.sin(a) * 0.2, { ry: -a }); }
  return O.cerrar();
}
function cama() {
  const O = new Obra(), L = 2.3, A = 1.75;
  O.pon(caja(A, 0.34, L, 0.15), 'blanco', 0, 0.3, 0);
  O.pon(caja(A - 0.2, 0.06, L - 0.2, 0.02), 'luzCeleste', 0, 0.12, 0);
  /* los costados ondulados con su luz, y la cabecera de onda */
  const onda = (w, h0, amp, k) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); for (let i = 20; i >= 0; i--) { const x = -w / 2 + w * i / 20; s.lineTo(x, h0 + amp * Math.sin(i / 20 * Math.PI * k + 0.6)); } return s; };
  for (const sx of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(onda(L, 0.34, 0.1, 2), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
    g.rotateY(Math.PI / 2); g.translate(sx * (A / 2 + 0.02) - 0.035, 0.18, 0); O.pon(g, 'blanco');
    O.pon(tubo([[sx * (A / 2 + 0.08), 0.3, -L / 2 + 0.2], [sx * (A / 2 + 0.08), 0.33, 0], [sx * (A / 2 + 0.08), 0.3, L / 2 - 0.2]], 0.025, 20, 5), 'luzCeleste');
  }
  const cab = new THREE.ExtrudeGeometry(onda(A + 0.2, 0.72, 0.14, 2.2), { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4 });
  cab.translate(0, 0.1, -L / 2 - 0.12); O.pon(cab, 'blanco');
  O.pon(caja(A - 0.12, 0.26, L - 0.18, 0.11), 'colchon', 0, 0.6, 0.02);
  O.pon(caja(A - 0.06, 0.12, 1.35, 0.06), 'frazada', 0, 0.74, 0.35);
  O.pon(caja(A - 0.06, 0.06, 0.22, 0.03), 'blanco', 0, 0.8, -0.25);
  for (const s of [-1, 1]) O.pon(caja(0.64, 0.18, 0.4, 0.09), 'blanco', s * 0.36, 0.83, -0.8, { r: [-0.25, 0, 0] });
  O.pon(caja(0.4, 0.14, 0.3, 0.07), 'frazada', 0.05, 0.86, -0.6, { r: [-0.3, 0, 0.1] });
  return O.cerrar();
}
function tele() {
  const O = new Obra();
  O.pon(torno([[0, 0], [0.36, 0], [0.38, 0.03], [0.32, 0.06], [0.08, 0.1], [0.06, 0.2], [0, 0.2]], 24), 'blanco', 0, 0, 0.02, { s: [1, 1, 0.7] });
  O.pon(caja(1.0, 0.82, 0.62, 0.2, 4), 'blanco', 0, 0.63, 0.08);
  O.pon(caja(0.78, 0.62, 0.5, 0.2, 4), 'blanco', 0, 0.62, -0.28);
  O.pon(caja(0.86, 0.66, 0.06, 0.13), 'perla', 0, 0.68, 0.39);
  O.pon(caja(0.74, 0.54, 0.1, 0.13, 4), 'pantallaTele', 0, 0.69, 0.4, { nombre: 'pantalla' });
  for (let i = 0; i < 3; i++) O.pon(esfera(0.025, 8, 6), 'gris', -0.08 + i * 0.08, 0.3, 0.42);
  O.pon(esfera(0.035, 8, 6), 'aqua', -0.34, 0.3, 0.42);
  for (let i = 0; i < 4; i++) O.pon(caja(0.03, 0.02, 0.3, 0.005), 'oscuro', 0.5, 0.5 + i * 0.07, -0.05);
  O.pon(cil(0.01, 0.3, 6), 'gris', 0.12, 1.15, -0.12, { r: [0, 0, -0.3] });
  return O.cerrar();
}

/* ============================================================ la terminal */
/* la Estación Central: un hall de bóveda de vidrio con arcos blancos, un andén
   a cada lado de la vía del monorriel, los frentes de vidrio en abanico, el
   reloj, el tablero de salidas, las máquinas de pasajes, bancos, macetas,
   faroles colgantes y el kiosco. La vía va a lo largo de z, por x = 0 */
function terminal() {
  const O = new Obra(), W = 26, L = 44, HA = 1.0, HC = 7, RB = W / 2 - 0.5;
  /* los andenes (con el borde amarillo) y el canal de la vía */
  for (const s of [-1, 1]) {
    O.pon(caja(W / 2 - 1.7, HA, L, 0.12), 'blanco', s * (W / 4 + 0.85), HA / 2, 0);
    O.pon(caja(0.45, 0.03, L - 0.4, 0.01), 'amarillo', s * 2.05, HA + 0.01, 0);
  }
  O.pon(caja(3.4, 0.2, L, 0.05), 'gris', 0, 0.1, 0);
  /* las mamparas de vidrio del borde de los andenes (como en los metros nuevos): la vía queda aparte */
  for (const s of [-1, 1]) {
    for (let z = -L / 2 + 1.5; z < L / 2 - 1; z += 2.5) { O.pon(new THREE.PlaneGeometry(2.3, 1.25), 'vidrio', s * 1.85, HA + 0.66, z + 1.25, { ry: Math.PI / 2 }); O.pon(caja(0.1, 1.4, 0.1, 0.03), 'blanco', s * 1.85, HA + 0.7, z); }
    O.pon(caja(0.12, 0.1, L - 2.6, 0.04), 'blanco', s * 1.85, HA + 1.4, 0.1);
  }
  /* columnas y arcos, cada 4 m */
  for (let z = -L / 2 + 2; z <= L / 2 - 2; z += 4) {
    for (const s of [-1, 1]) { O.pon(cil(0.28, HC, 16), 'blanco', s * RB, HA + HC / 2, z); O.pon(caja(0.9, 0.3, 0.9, 0.1), 'blanco', s * RB, HA + HC, z); }
    O.pon(new THREE.TorusGeometry(RB, 0.26, 8, 40, Math.PI), 'blanco', 0, HA + HC, z);
  }
  /* la bóveda de vidrio y los frentes en abanico (norte y sur) */
  const boveda = new THREE.CylinderGeometry(RB, RB, L - 3.2, 40, 1, true, -Math.PI / 2, Math.PI); boveda.rotateX(-Math.PI / 2);   // -90°: la mitad de arriba (con +90° quedaba abajo del andén)
  O.pon(boveda, 'vidrioAzul', 0, HA + HC, 0);
  O.pon(caja(0.5, 0.4, L - 3.2, 0.15), 'blanco', 0, HA + HC + RB, 0);
  for (const sz of [-1, 1]) {
    const zf = sz * (L / 2 - 1.6);
    O.pon(new THREE.CircleGeometry(RB, 40, 0, Math.PI), 'vidrioAzul', 0, HA + HC, zf);
    for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI; O.pon(caja(0.14, RB, 0.14, 0.05), 'blanco', Math.cos(a) * RB / 2, HA + HC + Math.sin(a) * RB / 2, zf, { r: [0, 0, a - Math.PI / 2] }); }
    O.pon(new THREE.TorusGeometry(RB * 0.28, 0.2, 8, 24, Math.PI), 'blanco', 0, HA + HC, zf);
    O.pon(caja(W - 1, 0.35, 0.5, 0.12), 'blanco', 0, HA + HC, zf);
  }
  /* el reloj grande sobre el frente sur, con sus agujas (se mueven con la hora) */
  const zr = L / 2 - 1.2, yr = HA + HC + 5.2;
  O.pon(new THREE.TorusGeometry(1.6, 0.18, 10, 40), 'aqua', 0, yr, zr);
  O.pon(new THREE.CircleGeometry(1.55, 40), 'esfera', 0, yr, zr + 0.02);
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; O.pon(caja(0.08, k % 3 ? 0.18 : 0.32, 0.02, 0.01), 'aguja', Math.sin(a) * 1.3, yr + Math.cos(a) * 1.3, zr + 0.04, { r: [0, 0, -a] }); }
  const ah = caja(0.12, 0.8, 0.03, 0.02); ah.translate(0, 0.35, 0); O.pon(ah, 'aguja', 0, yr, zr + 0.07, { nombre: 'agujaH' });
  const am = caja(0.08, 1.2, 0.03, 0.02); am.translate(0, 0.55, 0); O.pon(am, 'aguja', 0, yr, zr + 0.1, { nombre: 'agujaM' });
  /* las paredes bajas de vidrio a los costados, con la entrada del lado este (+x) en el medio */
  for (const s of [-1, 1]) for (let z = -L / 2 + 2; z < L / 2 - 2; z += 4) {
    if (s > 0 && Math.abs(z + 2) < 5) continue;
    O.pon(new THREE.PlaneGeometry(3.6, 3.4), 'vidrio', s * RB, HA + 1.7, z + 2, { ry: Math.PI / 2 });
    O.pon(caja(0.12, 0.12, 3.8, 0.04), 'blanco', s * RB, HA + 3.4, z + 2);
  }
  /* el tablero de salidas, colgado sobre la vía */
  O.pon(caja(4.6, 2.4, 0.3, 0.15), 'gris', 0, HA + 5.2, -8);
  O.pon(new THREE.PlaneGeometry(4.3, 2.1), 'tablero', 0, HA + 5.2, -7.84);
  O.pon(new THREE.PlaneGeometry(4.3, 2.1), 'tablero', 0, HA + 5.2, -8.16, { ry: Math.PI });
  for (const s of [-1, 1]) O.pon(cil(0.04, 3.2, 6), 'gris', s * 1.8, HA + 8, -8);
  /* las máquinas de pasajes, bancos, macetas y faroles colgantes en los andenes */
  const maquinas = [];
  for (const [x, z] of [[6.2, 6], [6.2, 9], [-6.2, 6]]) {
    O.pon(caja(1.1, 1.9, 0.7, 0.25), 'aqua', x, HA + 0.95, z, { ry: x > 0 ? -Math.PI / 2 : Math.PI / 2 });
    O.pon(caja(0.72, 0.5, 0.05, 0.08), 'pantallaAzul', x + (x > 0 ? -0.36 : 0.36), HA + 1.35, z, { ry: x > 0 ? -Math.PI / 2 : Math.PI / 2 });
    maquinas.push(V3(x + (x > 0 ? -1.2 : 1.2), HA, z));
  }
  const bs = [];
  for (const s of [-1, 1]) for (const z of [-16, -3, 14]) {
    const x = s * 8.6;
    O.pon(caja(0.7, 0.16, 2.6, 0.07), 'celeste', x, HA + 0.5, z); O.pon(caja(0.14, 0.5, 2.6, 0.06), 'celeste', x + s * 0.3, HA + 0.8, z);
    O.pon(torno([[0.7, 0], [0.78, 0.6], [0.66, 0.7], [0, 0.5]], 20), 'blanco', s * 10.6, HA, z + 3);
    bs.push([s * 10.6 + 0.2, HA + 0.8, z + 3.2, 0.42, '#3fb536'], [s * 10.6 - 0.25, HA + 0.78, z + 2.8, 0.38, '#52c843']);
  }
  O.pon(racimo(bs), 'plantas');
  for (let z = -L / 2 + 4; z < L / 2 - 2; z += 8) for (const s of [-1, 1]) {
    O.pon(cil(0.02, 2.2, 5), 'gris', s * 5.5, HA + HC + 2.7, z);
    O.pon(esfera(0.32, 14, 10), 'globo', s * 5.5, HA + HC + 1.5, z);
    O.pon(esfera(0.12, 8, 6), 'luzCalida', s * 5.5, HA + HC + 1.5, z);
  }
  /* el kiosco del café, en el andén oeste */
  kioscoEn(O, -8.4, HA, 8, Math.PI / 2);
  /* la escalinata de la entrada (este): del piso al andén en cuatro escalones */
  const escalones = [];
  for (let k = 0; k < 4; k++) { const h = HA * (k + 1) / 4, x = W / 2 + 0.3 + (3 - k) * 0.6; O.pon(caja(0.62, h, 8, 0.05), k % 2 ? 'blanco' : 'perla', x, h / 2, 0); escalones.push([x, h]); }
  for (const sz of [-1, 1]) O.pon(caja(2.5, 0.9, 0.3, 0.12), 'aqua', W / 2 + 1.25, 0.45, sz * 4.15);
  O.medidas = { anden: HA, ancho: W, largo: L, maquinas, escalones };
  return O.cerrar();
}
/* un kiosco redondo con toldo a rayas, mostrador y tazas */
function kioscoEn(O, x, y, z, giro = 0) {
  const c = Math.cos(giro), s = Math.sin(giro), en = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  O.pon(torno([[1.4, 0], [1.45, 1.0], [1.35, 1.1], [0, 1.1]], 28), 'blanco', x, y, z);
  O.pon(torno([[1.36, 1.05], [1.4, 1.2], [0, 1.2]], 28), 'aqua', x, y, z);
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.4; O.pon(cil(0.06, 1.3, 8), 'blanco', x + Math.sin(a) * 1.2, y + 1.8, z + Math.cos(a) * 1.2); }
  const t0 = new THREE.ConeGeometry(1.9, 0.9, 16, 1, true); t0.translate(0, 0.45, 0);
  O.pon(pintar(t0, (px, py, pz) => new THREE.Color(Math.floor((Math.atan2(pz, px) / TAU + 1) * 16) % 2 ? '#43d8cd' : '#ffffff')), 'toldo', x, y + 2.45, z);
  O.pon(esfera(0.18, 12, 8), 'blanco', x, y + 3.4, z);
  for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; O.pon(cil(0.07, 0.14, 10, 0.06), k % 2 ? 'blanco' : 'aqua', ...(() => { const [px, pz] = en(Math.sin(a) * 0.9, Math.cos(a) * 0.9); return [px, y + 1.27, pz]; })()); }
}

/* =============================================================== el molino */
/* aerogenerador blanco (el de los fondos de 2007): torre que se afina, góndola,
   y el rotor de tres palas aparte (gira) */
function molino() {
  const O = new Obra(), H = 34;
  O.pon(torno([[1.0, 0], [0.95, 0.4], [0.62, 12], [0.45, H], [0, H]], 20), 'blanco');
  O.pon(torno([[1.05, 0], [1.05, 1.2], [0, 1.2]], 20), 'verde');
  O.pon(new THREE.CapsuleGeometry(0.75, 2.6, 6, 16), 'blanco', 0, H + 0.4, -0.3, { r: [Math.PI / 2, 0, 0] });
  const palas = [esfera(0.6, 16, 12).toNonIndexed()];
  for (let k = 0; k < 3; k++) {
    const f = new THREE.Shape(); f.moveTo(-0.55, 0); f.quadraticCurveTo(-0.7, 3, -0.35, 9); f.quadraticCurveTo(-0.18, 14, 0, 16.5); f.quadraticCurveTo(0.2, 13, 0.45, 8); f.quadraticCurveTo(0.6, 2, 0.4, 0); f.lineTo(-0.55, 0);
    const g = new THREE.ExtrudeGeometry(f, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0.4, -0.06); g.rotateY(0.25); g.rotateZ(k / 3 * TAU);
    palas.push(g.toNonIndexed());
  }
  O.pon(mergeGeometries(palas), 'blanco', 0, H + 0.4, 1.35, { nombre: 'rotor' });
  O.medidas = { alto: H };
  return O.cerrar();
}

/* ================================================================= el faro */
/* sobre una roca: torre blanca con franjas aqua, puertita, ventanitas, balcón,
   la linterna de vidrio y el haz que gira (aparte) */
function faro() {
  const O = new Obra(), H = 15;
  O.pon(racimo([[0, 0.2, 0, 3.4, '#9fb3bf', 1, 0.5, 1], [1.8, 0, 1.2, 2.2, '#b8c8d2', 1, 0.45, 1], [-1.6, 0, -1.0, 2.4, '#a8bac6', 1, 0.5, 1]], 14, 8), 'plantas');
  O.pon(torno([[2.3, 1.2], [2.1, 4], [1.75, H - 1], [1.6, H], [0, H]], 28), 'blanco');
  for (const y of [3.2, 7.2, 11.2]) O.pon(torno([[2.28 - y * 0.045, y], [2.24 - y * 0.045, y + 1.3], [0, y + 1.3]], 28), 'aqua');
  O.pon(caja(0.9, 1.7, 0.4, 0.3), 'puerta', 0, 2.05, 2.08);
  for (const y of [5.6, 9.6]) ojoDeBuey(O, 0, y, 2.05 - y * 0.035, 0, 1, 0.26);
  O.pon(torno([[0, H], [2.5, H], [2.6, H + 0.25], [0, H + 0.3]], 28), 'blanco');
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; O.pon(cil(0.04, 0.8, 5), 'blanco', Math.sin(a) * 2.4, H + 0.7, Math.cos(a) * 2.4); }
  O.pon(new THREE.TorusGeometry(2.4, 0.06, 6, 40), 'blanco', 0, H + 1.1, 0, { r: [Math.PI / 2, 0, 0] });
  const lint = new THREE.CylinderGeometry(1.25, 1.25, 2.1, 20, 1, true); lint.translate(0, H + 1.35, 0); O.pon(lint, 'vidrioAzul');
  O.pon(esfera(0.55, 16, 12), 'luzCalida', 0, H + 1.35, 0);
  O.pon(torno([[1.4, 0], [1.3, 0.3], [0.6, 1.0], [0, 1.25]], 24), 'aqua', 0, H + 2.4, 0);
  O.pon(esfera(0.18, 10, 8), 'blanco', 0, H + 3.7, 0);
  const haz = []; for (const s of [-1, 1]) { const c = new THREE.ConeGeometry(1.6, 16, 16, 1, true); c.translate(0, -8, 0); c.rotateZ(s * Math.PI / 2); haz.push(c.toNonIndexed()); }
  O.pon(mergeGeometries(haz), 'haz', 0, H + 1.35, 0, { nombre: 'haz' });
  O.medidas = { luz: V3(0, H + 1.35, 0) };
  return O.cerrar();
}

/* ======================================================== cosas de playa */
function sombrilla(c1 = '#43d8cd', c2 = '#ffffff') {
  const O = new Obra();
  O.pon(cil(0.05, 2.5, 8), 'blanco', 0, 1.25, 0);
  const t0 = new THREE.ConeGeometry(1.7, 0.7, 16, 1, true); t0.translate(0, 2.5, 0);
  O.pon(pintar(t0, (px, py, pz) => new THREE.Color(Math.floor((Math.atan2(pz, px) / TAU + 1) * 16) % 2 ? c1 : c2)), 'toldo');
  O.pon(esfera(0.1, 10, 8), 'blanco', 0, 2.9, 0);
  return O.cerrar();
}
function reposera() {
  const O = new Obra();
  O.pon(caja(0.7, 0.08, 1.3, 0.04), 'blanco', 0, 0.32, 0.25);
  O.pon(caja(0.7, 0.08, 0.8, 0.04), 'blanco', 0, 0.6, -0.62, { r: [0.7, 0, 0] });
  O.pon(caja(0.62, 0.06, 1.2, 0.03), 'aqua', 0, 0.39, 0.25);
  O.pon(caja(0.62, 0.06, 0.72, 0.03), 'aqua', 0, 0.66, -0.58, { r: [0.7, 0, 0] });
  for (const [x, z] of [[-0.3, 0.8], [0.3, 0.8], [-0.3, -0.3], [0.3, -0.3]]) O.pon(cil(0.03, 0.3, 6), 'blanco', x, 0.15, z);
  return O.cerrar();
}
function guardavidas() {
  const O = new Obra();
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) O.pon(cil(0.1, 3.2, 8), 'blanco', x, 1.6, z);
  O.pon(caja(2.4, 0.2, 2.4, 0.08), 'blanco', 0, 3.2, 0);
  O.pon(caja(2.0, 1.4, 2.0, 0.3), 'blanco', 0, 4.0, -0.2);
  O.pon(caja(1.4, 0.7, 0.05, 0.1), 'ventana', 0, 4.1, 0.81);
  O.pon(torno([[1.6, 0], [1.5, 0.2], [0.2, 0.9], [0, 0.95]], 4), 'aqua', 0, 4.7, -0.2, { r: [0, Math.PI / 4, 0] });
  for (let k = 0; k < 6; k++) O.pon(caja(0.9, 0.06, 0.12, 0.02), 'blanco', 0, 0.45 + k * 0.5, 1.55 - k * 0.12);
  for (const s of [-1, 1]) O.pon(cil(0.04, 3.3, 6), 'blanco', s * 0.45, 1.65, 1.25, { r: [0.22, 0, 0] });
  O.pon(cil(0.03, 1.6, 6), 'blanco', 0.9, 5.4, 0.7);
  const b = new THREE.PlaneGeometry(0.8, 0.5); b.translate(0.4, 0, 0); O.pon(b, 'rojoHongo', 0.9, 6.0, 0.7);
  return O.cerrar();
}
function botella() {
  const O = new Obra();
  O.pon(torno([[0, 0], [0.12, 0], [0.13, 0.25], [0.06, 0.34], [0.05, 0.45], [0, 0.45]], 14), 'vidrioAzul', 0, 0.1, 0, { r: [0, 0, 1.2] });
  O.pon(cil(0.05, 0.2, 8), 'crema', -0.1, 0.12, 0, { r: [0, 0, 1.2] });
  O.pon(cil(0.052, 0.07, 8), 'madera', -0.38, 0.23, 0, { r: [0, 0, 1.2] });
  return O.cerrar();
}

/* ========================================================== el bosque */
/* hongo gigante rojo de lunares, brilloso: se rebota en el sombrero */
function hongo() {
  const O = new Obra(), R = 1.7, Y = 2.3;
  O.pon(torno([[0.62, 0], [0.5, 0.4], [0.42, 1.4], [0.5, Y], [0, Y]], 18), 'crema');
  const cap = new THREE.SphereGeometry(R, 32, 16, 0, TAU, 0, Math.PI / 2); cap.scale(1, 0.62, 1); O.pon(cap, 'rojoHongo', 0, Y - 0.15, 0);
  O.pon(new THREE.CircleGeometry(R, 32).rotateX(Math.PI / 2), 'crema', 0, Y - 0.15, 0);
  const r = azar(9), pts = [];
  for (let k = 0; k < 14; k++) { const a = r() * TAU, e = 0.25 + r() * 1.1, x = Math.cos(a) * Math.sin(e) * R, z = Math.sin(a) * Math.sin(e) * R, y = Math.cos(e) * R * 0.62; pts.push([x, Y - 0.15 + y, z, 0.16 + r() * 0.12, '#ffffff', 1, 0.35, 1]); }
  O.pon(racimo(pts, 10, 6), 'plantas');
  O.medidas = { tope: Y - 0.15 + R * 0.62, radio: R };
  return O.cerrar();
}
/* la casa del árbol: un árbol enorme de burbujas, una plataforma redonda con
   baranda, una casita con cúpula y una escalera caracol alrededor del tronco */
function casaArbol() {
  const O = new Obra(), YP = 6.2;
  const tr = torno([[1.8, 0], [1.3, 0.4], [1.0, 1.5], [0.9, 5], [0.85, YP + 3]], 18); O.pon(pintar(tr, (x, y) => new THREE.Color('#7a4a24').lerp(new THREE.Color('#b98552'), y / 9)), 'tronco');
  const cA = new THREE.Color('#4fb52a'), cB = new THREE.Color('#9be63a');
  const bolas = []; const r = azar(4);
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + r(), d = 2.2 + r() * 2.2, y = YP + 3.5 + r() * 3; bolas.push([Math.cos(a) * d, y, Math.sin(a) * d, 1.4 + r() * 0.9, cA.clone().lerp(cB, (y - YP - 3) / 3)]); }
  bolas.push([0, YP + 7.2, 0, 2.2, cB]);
  O.pon(racimo(bolas, 14, 10), 'copa');
  O.pon(torno([[0, 0], [3.6, 0], [3.7, 0.3], [0, 0.35]], 32), 'madera', 0, YP - 0.3, 0);
  for (let k = 0; k < 20; k++) { const a = k / 20 * TAU; if (Math.abs(Math.atan2(Math.sin(a - 1.2), Math.cos(a - 1.2))) < 0.3) continue; O.pon(cil(0.05, 0.9, 5), 'blanco', Math.sin(a) * 3.5, YP + 0.45, Math.cos(a) * 3.5); }
  O.pon(new THREE.TorusGeometry(3.5, 0.06, 6, 40), 'blanco', 0, YP + 0.9, 0, { r: [Math.PI / 2, 0, 0] });
  const cx = -1.2, cz = -1.3;
  O.pon(torno([[1.7, 0], [1.7, 2.1], [0, 2.1]], 24), 'blanco', cx, YP, cz);
  O.pon(new THREE.SphereGeometry(1.85, 24, 10, 0, TAU, 0, Math.PI / 2), 'aqua', cx, YP + 2.05, cz);
  O.pon(caja(0.9, 1.6, 0.2, 0.3), 'puerta', cx + 0.6, YP + 0.85, cz + 1.55, { ry: 0.35 });
  ojoDeBuey(O, cx - 1.66, YP + 1.3, cz, -1, 0, 0.3);
  const escalones = [];
  /* por afuera de la plataforma (si no, la cabeza pega en el piso de arriba) y
     el último escalón en el hueco de la baranda */
  for (let k = 0; k < 22; k++) {
    const a = 1.2 - (21 - k) * TAU * 1.05 / 22, y = 0.28 * (k + 1), rr = 4.25;
    const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
    O.pon(caja(1.3, 0.12, 0.62, 0.04), 'madera', x, y - 0.06, z, { ry: a + Math.PI / 2 });
    escalones.push([x, z, y, a + Math.PI / 2]);
  }
  O.medidas = { plataforma: YP, escalones };
  return O.cerrar();
}
/* la glorieta del mirador: seis columnas, cúpula y bancos */
function glorieta() {
  const O = new Obra(), R = 3.2;
  O.pon(torno([[0, 0], [R + 0.5, 0], [R + 0.55, 0.35], [0, 0.4]], 32), 'blanco');
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; O.pon(cil(0.16, 3.2, 12), 'blanco', Math.sin(a) * R, 2.0, Math.cos(a) * R); }
  O.pon(torno([[0, 3.5], [R + 0.4, 3.5], [R + 0.45, 3.75], [0, 3.8]], 32), 'blanco');
  O.pon(new THREE.SphereGeometry(R + 0.2, 32, 12, 0, TAU, 0, Math.PI / 2), 'cupula', 0, 3.75, 0);
  O.pon(esfera(0.25, 12, 8), 'aqua', 0, 3.75 + R + 0.25, 0);
  for (const a of [0.6, 2.7, 4.8]) O.pon(arcoSolido(R - 1.0, R - 0.4, a, a + 1.1, 0.5, 0.08), 'celeste', 0, 0.4, 0);
  return O.cerrar();
}

/* ======================================================= el muelle y el velero */
/* de tablas claras sobre pilotes blancos, con baranda de soga, faroles bajos y
   una plataforma cuadrada al final. Sale hacia +z; la cubierta está a 1,25 m */
function muelle() {
  const O = new Obra(), L = 48, W = 3.2, Y = 1.25, F = 7;
  const tablas = [];
  for (let z = 0.3; z < L; z += 0.5) { const g = caja(W, 0.12, 0.44, 0.03, 1); g.translate(0, Y - 0.06, z); tablas.push(pintar(g.toNonIndexed(), new THREE.Color('#e9d7b4').offsetHSL(0, 0, ((z * 7.3) % 1) * 0.06 - 0.03))); }
  for (let x = -F / 2 + 0.25; x < F / 2; x += 0.5) { const g = caja(0.44, 0.12, F, 0.03, 1); g.translate(x, Y - 0.06, L + F / 2); tablas.push(pintar(g.toNonIndexed(), new THREE.Color('#e9d7b4').offsetHSL(0, 0, ((x * 5.1 + 9) % 1) * 0.06 - 0.03))); }
  O.pon(mergeGeometries(tablas), 'toldo');
  for (let z = 2; z < L; z += 4) for (const sx of [-1, 1]) { O.pon(cil(0.16, Y + 3, 10), 'blanco', sx * (W / 2 - 0.1), (Y - 3) / 2, z); O.pon(cil(0.06, 1.0, 6), 'blanco', sx * (W / 2 - 0.1), Y + 0.5, z); }
  for (const [x, z] of [[-F / 2, L], [F / 2, L], [-F / 2, L + F], [F / 2, L + F], [0, L + F]]) O.pon(cil(0.2, Y + 3, 10), 'blanco', x, (Y - 3) / 2, z);
  for (const sx of [-1, 1]) O.pon(tubo([[sx * (W / 2 - 0.1), Y + 0.95, 2], [sx * (W / 2 - 0.1), Y + 0.85, L / 2], [sx * (W / 2 - 0.1), Y + 0.95, L - 2]], 0.035, 30, 5), 'crema');
  for (const z of [12, 28, 44]) { O.pon(cil(0.07, 1.6, 8), 'blanco', W / 2 - 0.1, Y + 0.8, z); O.pon(esfera(0.2, 12, 8), 'luzCalida', W / 2 - 0.1, Y + 1.7, z); }
  /* salvavidas colgado y dos bitas */
  O.pon(new THREE.TorusGeometry(0.34, 0.1, 10, 24), 'rojoHongo', -W / 2 + 0.05, Y + 0.7, 20, { ry: Math.PI / 2 });
  for (const x of [-2.6, 2.6]) O.pon(torno([[0.18, 0], [0.14, 0.3], [0.22, 0.38], [0, 0.4]], 12), 'gris', x, Y, L + F - 0.8);
  O.medidas = { cubierta: Y, largo: L, ancho: W, fin: F };
  return O.cerrar();
}
function velero() {
  const O = new Obra();
  const casco = torno([[0, -0.35], [0.5, -0.3], [0.85, 0.1], [0.95, 0.55], [0.9, 0.6]], 24); casco.scale(1, 1, 2.8); O.pon(casco, 'blanco', 0, 0.35, 0);
  O.pon(caja(1.6, 0.06, 4.6, 0.3), 'madera', 0, 0.92, 0);
  O.pon(new THREE.TorusGeometry(0.93, 0.05, 6, 40), 'aqua', 0, 0.9, 0, { r: [Math.PI / 2, 0, 0], s: [1, 2.78, 1] });
  O.pon(cil(0.06, 6, 8), 'cromo', 0, 3.9, 0.4);
  const f = new THREE.Shape(); f.moveTo(0, 0); f.lineTo(0, 5.2); f.quadraticCurveTo(1.4, 2.2, 2.6, 0.1); f.lineTo(0, 0);
  const vela = new THREE.ShapeGeometry(f, 8); vela.rotateY(-Math.PI / 2); O.pon(vela, 'vela', 0.04, 1.3, 0.45);
  const f2 = new THREE.Shape(); f2.moveTo(0, 0); f2.lineTo(0, 4.4); f2.lineTo(1.7, 0.2); f2.lineTo(0, 0);
  const foque = new THREE.ShapeGeometry(f2); foque.rotateY(Math.PI / 2); O.pon(foque, 'velaAqua', 0, 1.2, 0.3);
  O.pon(caja(0.1, 0.1, 2.6, 0.03), 'cromo', 0, 1.35, -0.85);
  return O.cerrar();
}

/* ================================================== el cartel del mapa (spawn) */
/* un marco blanco redondeado con filete aqua y brillo arriba, dos postes de
   cromo, un alerito de vidrio y una maceta de plantas al pie. La pantalla
   (aparte, con nombre) la dibuja el reino con el mapa de la isla */
function cartelMapa() {
  const O = new Obra(), W = 4.6, H = 3.3, Y = 1.2;
  for (const s of [-1, 1]) O.pon(cil(0.1, Y + H + 0.3, 12), 'cromo', s * (W / 2 + 0.05), (Y + H + 0.3) / 2, -0.12);
  O.pon(caja(W + 0.4, H + 0.4, 0.22, 0.18), 'blanco', 0, Y + H / 2, -0.12);
  O.pon(caja(W + 0.5, 0.12, 0.26, 0.05), 'aqua', 0, Y - 0.05, -0.12);
  O.pon(new THREE.PlaneGeometry(W, H), 'pantallaAzul', 0, Y + H / 2, 0.005, { nombre: 'pantalla' });
  const alero = new THREE.CylinderGeometry(0.9, 0.9, W + 0.8, 24, 1, true, 0, Math.PI); alero.rotateZ(Math.PI / 2); alero.scale(1, 0.35, 1);
  O.pon(alero, 'vidrioAzul', 0, Y + H + 0.3, 0.2);
  O.pon(caja(W + 0.9, 0.08, 0.08, 0.03), 'blanco', 0, Y + H + 0.32, 0.9);
  O.pon(torno([[0.9, 0], [1.0, 0.5], [0.85, 0.58], [0, 0.45]], 24), 'blanco', 0, 0, 0.6, { s: [2.6, 1, 0.7] });
  const r = azar(12), bs = [];
  for (let k = 0; k < 11; k++) bs.push([(k / 10 - 0.5) * 4.2, 0.62 + r() * 0.15, 0.6 + (r() - 0.5) * 0.4, 0.3 + r() * 0.12, k % 3 ? '#3fb536' : '#52c843']);
  for (let k = 0; k < 5; k++) bs.push([(r() - 0.5) * 4, 0.95, 0.65, 0.12, ['#ffffff', '#ff8fcf', '#fff27a'][k % 3], 1, 1, 1]);
  O.pon(racimo(bs), 'plantas');
  O.medidas = { panel: [W, H, Y] };
  return O.cerrar();
}

/* ============================================== las paradas del monorriel */
/* Todas juntas en una sola obra (se funden: cinco llamadas para las seis).
   Cada una: el andén elevado al costado de la viga, con mampara y techito de
   vidrio, la torre del ascensor de vidrio y la entrada abajo.
   lista: [{ x, y, z, giro, lado, alto }] — (x, y, z) el piso bajo la viga, giro
   para que +z local vaya como la vía, lado ±1 y alto: la viga sobre el piso.
   Devuelve también, por parada, la puerta de abajo, el andén y dónde va el cartel */
export function paradasMonorriel(lista) {
  const O = new Obra(), sitios = [];
  for (const { x, y, z, giro, lado, alto } of lista) {
    const c = Math.cos(giro), s = Math.sin(giro), en = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const pon = (g, k, lx, ly, lz) => O.pon(g, k, ...en(lx, ly, lz), { ry: giro });
    const piso = alto + 0.45, X = (v) => v * lado;
    pon(caja(3.1, 0.36, 12, 0.1), 'blanco', X(2.95), piso - 0.18, 0);
    pon(caja(0.3, 0.02, 11.6, 0.01), 'amarillo', X(1.65), piso + 0.01, 0);
    pon(new THREE.PlaneGeometry(12, 1.1).rotateY(Math.PI / 2), 'vidrio', X(4.42), piso + 0.55, 0);
    pon(caja(0.1, 0.1, 12, 0.03), 'blanco', X(4.42), piso + 1.1, 0);
    const techo = new THREE.CylinderGeometry(1.9, 1.9, 10.5, 20, 1, true, -Math.PI / 2, Math.PI); techo.rotateX(-Math.PI / 2); techo.scale(1, 0.45, 1);
    pon(techo, 'vidrioAzul', X(2.95), piso + 2.55, 0);
    for (const lz of [-4.8, -1.6, 1.6, 4.8]) { pon(cil(0.07, 2.6, 8), 'blanco', X(4.25), piso + 1.3, lz); const a = new THREE.TorusGeometry(1.9, 0.07, 6, 20, Math.PI); a.scale(1, 0.45, 1); pon(a, 'blanco', X(2.95), piso + 2.55, lz); }
    for (const lz of [-4, 4]) pon(cil(0.3, piso, 12), 'blanco', X(2.95), piso / 2 - 0.2, lz);
    /* el ascensor: tubo de vidrio con aros blancos, tapa con cúpula aqua y la cabina abajo */
    const H = piso + 2.8;
    pon(new THREE.CylinderGeometry(1.15, 1.15, H, 24, 1, true), 'vidrio', X(5.4), H / 2, 0);
    for (let ly = 0.1; ly < H; ly += 2.2) pon(new THREE.TorusGeometry(1.16, 0.07, 6, 28).rotateX(Math.PI / 2), 'blanco', X(5.4), ly, 0);
    pon(cil(1.3, 0.3, 24), 'blanco', X(5.4), H + 0.15, 0);
    pon(new THREE.SphereGeometry(1.0, 20, 8, 0, TAU, 0, Math.PI / 2), 'aqua', X(5.4), H + 0.3, 0);
    pon(caja(1.3, 2.2, 1.3, 0.25), 'vidrioAzul', X(5.4), 1.2, 0);
    pon(cil(1.5, 0.3, 24), 'blanco', X(5.4), 0.1, 0);
    /* la entrada: un alerito aqua y el marco de la puerta, mirando para afuera */
    pon(caja(0.24, 2.6, 2.0, 0.08), 'blanco', X(6.6), 1.3, 0);
    pon(caja(1.6, 0.18, 2.6, 0.09), 'aqua', X(7.3), 2.7, 0);
    for (const lz of [-1.1, 1.1]) pon(cil(0.06, 2.6, 8), 'blanco', X(7.95), 1.35, lz);
    sitios.push({ puerta: V3(...en(X(8.1), 0, 0)), anden: V3(...en(X(2.9), piso, 0)), cartel: V3(...en(X(6.62), H - 0.6, 0)), giroCartel: giro + (lado > 0 ? Math.PI / 2 : -Math.PI / 2), piso: y + piso });
  }
  const g = O.cerrar(); g.userData.sitios = sitios;
  return g;
}

/* ======================================================= el farol de los juegos */
/* un farol enorme que es un edificio: base octogonal con escalones, el cuerpo
   de vidrio hexagonal con un núcleo de luz adentro, las puertas del frente que
   brillan (aparte: se animan), el techo aqua y un brazo curvo que sostiene el
   cartel con la miniatura del juego (la pantalla, aparte), rodeado de foquitos */
function farolJuegos() {
  const O = new Obra(), R = 4.2, H = 9, Y0 = 0.9;
  O.pon(new THREE.CylinderGeometry(6.2, 6.6, Y0, 8), 'blanco', 0, Y0 / 2, 0, { ry: Math.PI / 8 });
  O.pon(new THREE.TorusGeometry(6.35, 0.12, 6, 8).rotateX(Math.PI / 2), 'aqua', 0, Y0, 0, { ry: Math.PI / 8 });
  for (let k = 0; k < 3; k++) O.pon(caja(4.2 - k * 0.3, 0.3, 0.8, 0.08), k % 2 ? 'perla' : 'blanco', 0, 0.15 + k * 0.3, 6.9 - k * 0.7);
  const vert = (k) => { const a = (k * 60 + 30) * Math.PI / 180; return [Math.sin(a) * R, Math.cos(a) * R]; };
  for (let k = 0; k < 6; k++) {
    const [x, z] = vert(k), [x2, z2] = vert(k + 1);
    O.pon(cil(0.24, H, 14), 'blanco', x, Y0 + H / 2, z);
    const mx = (x + x2) / 2, mz = (z + z2) / 2, giro = Math.atan2(mx, mz);
    if (k !== 5) O.pon(new THREE.PlaneGeometry(R, H - 0.4), 'vidrioAzul', mx * 0.99, Y0 + H / 2, mz * 0.99, { ry: giro });
    for (const y of [Y0 + 0.15, Y0 + H - 0.15, Y0 + H / 2]) O.pon(caja(R + 0.1, 0.22, 0.22, 0.08), 'blanco', mx, y, mz, { ry: giro });
  }
  /* las puertas del frente (+z): dos hojas que brillan y el arco */
  const zf = R * Math.cos(Math.PI / 6);
  for (const s of [-1, 1]) O.pon(caja(1.85, 4.6, 0.18, 0.3), 'puertasLuz', s * 0.97, Y0 + 2.3, zf, { nombre: 'puerta' + (s > 0 ? 'D' : 'I') });
  O.pon(new THREE.TorusGeometry(2.05, 0.16, 10, 30, Math.PI), 'aqua', 0, Y0 + 4.6, zf + 0.05);
  O.pon(new THREE.CircleGeometry(2.0, 30, 0, Math.PI), 'vidrioAzul', 0, Y0 + 4.6, zf);
  O.pon(caja(4.6, 0.25, 0.3, 0.1), 'blanco', 0, Y0 + 4.62, zf + 0.05);
  /* el núcleo de luz adentro */
  O.pon(esfera(1.8, 28, 20), 'luzCalida', 0, Y0 + H * 0.55, 0, { nombre: 'nucleo' });
  O.pon(new THREE.TorusGeometry(2.4, 0.08, 8, 40), 'amarillo', 0, Y0 + H * 0.55, 0, { r: [Math.PI / 2, 0, 0], nombre: 'aro' });
  /* el techo, la punta y el brazo curvo del cartel */
  O.pon(new THREE.CylinderGeometry(R + 0.8, R + 0.8, 0.5, 6), 'blanco', 0, Y0 + H + 0.25, 0, { ry: Math.PI / 6 });
  O.pon(new THREE.CylinderGeometry(0.6, R + 0.5, 3.2, 6), 'aqua', 0, Y0 + H + 2.1, 0, { ry: Math.PI / 6 });
  O.pon(esfera(0.55, 16, 12), 'blanco', 0, Y0 + H + 4, 0);
  O.pon(tubo([[0, Y0 + H + 3.6, 0], [0, Y0 + H + 6.2, 0.4], [0, Y0 + H + 7.4, 1.6]], 0.3, 30, 10), 'blanco');
  const YC = Y0 + H + 9.4, WC = 9, HC = 5.4;
  O.pon(caja(WC + 0.7, HC + 0.7, 0.4, 0.3), 'blanco', 0, YC, 1.4);
  O.pon(caja(WC + 0.9, 0.25, 0.5, 0.1), 'aqua', 0, YC - HC / 2 - 0.4, 1.4);
  O.pon(new THREE.PlaneGeometry(WC, HC), 'pantallaAzul', 0, YC, 1.62, { nombre: 'pantalla' });
  for (let i = 0; i < 26; i++) { const u = i / 26, per = 2 * (WC + HC), d = u * per; let x, y; if (d < WC) { x = -WC / 2 + d; y = HC / 2 + 0.22; } else if (d < WC + HC) { x = WC / 2 + 0.22; y = HC / 2 - (d - WC); } else if (d < 2 * WC + HC) { x = WC / 2 - (d - WC - HC); y = -HC / 2 - 0.22; } else { x = -WC / 2 - 0.22; y = -HC / 2 + (d - 2 * WC - HC); } O.pon(esfera(0.13, 8, 6), 'luzCalida', x, YC + y, 1.65); }
  O.medidas = { puerta: V3(0, Y0, zf + 1.6), alto: YC + HC / 2 };
  return O.cerrar();
}

/* ============================================= la Zona de Juegos y el telescopio */
/* (26/09: "arreglar los modelos que no me convencen: hacer glb y después pasarlo a
   procedural") copiados de los GLB de Tripo por Rezona: crudo/t10/m10-*.glb, con sus
   fotos de cuatro lados en crudo/t10/ref-*.png */
function texRed() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 2); g.lineTo(64, 2); g.moveTo(2, 0); g.lineTo(2, 64); g.stroke();
  const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
}
/* un cuadrilátero a, b, c, d (en orden) con su uv repetida su × sv veces (las redes) */
function quad(a, b, c, d, su = 1, sv = 1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, su, 0, su, sv, 0, sv], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return g;
}
/* el telescopio refractor: trípode blanco con collares azules, montura azul con perillas
   lima, tubo blanco con tres anillos celestes, parasol oscuro con la lente, buscador arriba */
function telescopio() {
  const O = new Obra(), AP = V3(0, 1.08, 0);
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * TAU + Math.PI / 6, pie = V3(Math.sin(a) * 0.55, 0.03, Math.cos(a) * 0.55);
    const L = pie.distanceTo(AP), mid = AP.clone().lerp(pie, 0.5);
    O.pon(cil(0.052, L, 12, 0.036).rotateX(Math.PI / 2), 'blanco', mid.x, mid.y, mid.z, { mirar: pie });
    const c = AP.clone().lerp(pie, 0.42); O.pon(cil(0.056, 0.08, 14).rotateX(Math.PI / 2), 'azulJ', c.x, c.y, c.z, { mirar: pie });
    const c2 = AP.clone().lerp(pie, 0.78); O.pon(cil(0.046, 0.05, 12).rotateX(Math.PI / 2), 'gris', c2.x, c2.y, c2.z, { mirar: pie });
    O.pon(esfera(0.06, 12, 8), 'gomaJ', pie.x, 0.035, pie.z, { s: [1, 0.6, 1] });
  }
  O.pon(cil(0.12, 0.1, 24), 'azulJ', 0, AP.y + 0.02, 0);
  O.pon(caja(0.14, 0.2, 0.16, 0.04), 'azulJ', 0, AP.y + 0.17, 0);
  for (const s of [-1, 1]) O.pon(esfera(0.045, 14, 10), 'lima', s * 0.1, AP.y + 0.24, 0);
  O.pon(cil(0.014, 0.42, 8).rotateX(Math.PI / 2), 'cromo', 0, AP.y + 0.1, -0.2, { r: [-0.5, 0, 0] });
  O.pon(cil(0.055, 0.09, 18).rotateX(Math.PI / 2), 'cromo', 0, AP.y + 0.0, -0.4, { r: [-0.5, 0, 0] });
  /* el tubo, inclinado 32° para arriba (todo lo del tubo se arma a lo largo de z y después se inclina) */
  const inc = new THREE.Matrix4().makeRotationX(-0.56).setPosition(0, AP.y + 0.34, 0.02);
  const pz = (geo, x, y, z) => geo.translate(x, y, z).applyMatrix4(inc);
  const aZ = (g) => g.rotateX(Math.PI / 2);
  O.pon(pz(aZ(cil(0.17, 1.2, 40)), 0, 0, 0.08), 'blanco');
  for (const z of [-0.33, 0.07, 0.43]) O.pon(pz(aZ(cil(0.178, 0.09, 40)), 0, 0, z), 'celeste');
  O.pon(pz(aZ(cil(0.2, 0.22, 40)), 0, 0, 0.78), 'gomaJ');
  O.pon(pz(new THREE.CircleGeometry(0.17, 40), 0, 0, 0.85), 'lenteJ');
  O.pon(pz(new THREE.TorusGeometry(0.188, 0.016, 8, 44), 0, 0, 0.89), 'blanco');
  O.pon(pz(aZ(cil(0.174, 0.07, 40)), 0, 0, -0.52), 'lima');
  O.pon(pz(aZ(cil(0.14, 0.07, 32)), 0, 0, -0.57), 'gomaJ');
  O.pon(pz(aZ(cil(0.036, 0.18, 16)), 0, 0, -0.7), 'gris');
  O.pon(pz(aZ(cil(0.045, 0.07, 16)), 0, 0, -0.8), 'gomaJ');
  /* el buscador: tubito blanco y negro con la punta lima, sobre dos soportes */
  O.pon(pz(aZ(cil(0.04, 0.34, 18)), 0, 0.27, 0.12), 'blanco');
  O.pon(pz(aZ(cil(0.045, 0.06, 18)), 0, 0.27, 0.3), 'lima');
  O.pon(pz(aZ(cil(0.034, 0.06, 18)), 0, 0.27, -0.07), 'gomaJ');
  for (const z of [0.02, 0.22]) O.pon(pz(caja(0.045, 0.1, 0.045, 0.01), 0, 0.2, z), 'gris');
  O.medidas = { ocular: V3(0, AP.y + 0.34 - Math.sin(0.56) * 0.8, 0.02 - Math.cos(0.56) * 0.8) };
  return O.cerrar();
}
/* la mesa de juegos: tapa de vidrio con borde blanco, pie cromado y base de vidrio */
function mesaJuego() {
  const O = new Obra();
  O.pon(torno([[0, 0], [0.44, 0], [0.47, 0.02], [0.45, 0.05], [0, 0.05]], 48), 'vidrioAquaJ');
  O.pon(new THREE.TorusGeometry(0.455, 0.018, 8, 48).rotateX(Math.PI / 2), 'blanco', 0, 0.035, 0);
  O.pon(cil(0.036, 0.74, 16), 'cromo', 0, 0.42, 0);
  O.pon(cil(0.1, 0.04, 20, 0.07), 'cromo', 0, 0.78, 0);
  O.pon(cil(0.8, 0.05, 56), 'vidrioAquaJ', 0, 0.8, 0);
  O.pon(new THREE.TorusGeometry(0.8, 0.028, 8, 72).rotateX(Math.PI / 2), 'blanco', 0, 0.8, 0);
  O.medidas = { tapa: 0.83 };
  return O.cerrar();
}
/* la silla burbuja: un huevo abierto adelante, con almohadón, sobre un pie corto */
function sillaBurbuja(mat) {
  const O = new Obra();
  O.pon(torno([[0, 0], [0.3, 0], [0.32, 0.02], [0.3, 0.04], [0, 0.04]], 32), 'vidrioAquaJ');
  O.pon(cil(0.04, 0.3, 14), 'cromo', 0, 0.18, 0);
  /* (una concha fina sacada de una esfera: el cuenco de abajo y el respaldo que sube atrás, como en el GLB) */
  /* el borde sube suave de adelante (a la altura del asiento) hasta atrás (el respaldo): una
     esfera recortada por un ángulo que cambia con el giro, con el filo liso */
  const N = 64, Mv = 18, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N * TAU, tMin = Math.PI * (0.6 - 0.34 * (1 - Math.cos(f)) / 2);
    for (let j = 0; j <= Mv; j++) { const th = Math.PI - (Math.PI - tMin) * j / Mv; pos.push(0.34 * Math.sin(th) * Math.sin(f), 0.34 * Math.cos(th), 0.34 * Math.sin(th) * Math.cos(f)); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < Mv; j++) { const a = i * (Mv + 1) + j, b = a + Mv + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const concha = new THREE.BufferGeometry(); concha.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); concha.setIndex(idx); concha.computeVertexNormals();
  O.pon(concha, mat, 0, 0.64, 0, { s: [1.12, 1, 1] });
  /* el filo redondo del borde */
  const filo = []; for (let i = 0; i <= N; i++) { const f = i / N * TAU, th = Math.PI * (0.6 - 0.34 * (1 - Math.cos(f)) / 2); filo.push([0.34 * 1.12 * Math.sin(th) * Math.sin(f), 0.64 + 0.34 * Math.cos(th), 0.34 * Math.sin(th) * Math.cos(f)]); }
  O.pon(tubo(filo.slice(0, -1), 0.018, 128, 6, true), mat);
  O.pon(esfera(0.3, 28, 14), mat, 0, 0.46, 0.03, { s: [1.05, 0.2, 1] });
  O.medidas = { asiento: 0.45 };
  return O.cerrar();
}
/* la puerta de los juegos: un aro grueso parado, de aqua con filos blancos y lucecitas,
   sobre un pedestal redondo de dos escalones (la membrana que gira la pone juegos.js) */
function portalJuegos() {
  const O = new Obra(), Y = 1.72, R1 = 1.36, R0 = 1.08, P = 0.15;
  O.pon(torno([[0, 0], [1.55, 0], [1.6, 0.05], [1.58, 0.16], [1.52, 0.2], [0, 0.2]], 64), 'blanco');
  O.pon(torno([[0, 0.2], [1.3, 0.2], [1.34, 0.24], [1.3, 0.32], [0, 0.32]], 64), 'perla');
  O.pon(new THREE.TorusGeometry(1.31, 0.028, 8, 72).rotateX(Math.PI / 2), 'luzAquaJ', 0, 0.26, 0);
  const sec = [[R0, -P + 0.04], [R0 + 0.03, -P], [R1 - 0.03, -P], [R1, -P + 0.04], [R1, P - 0.04], [R1 - 0.03, P], [R0 + 0.03, P], [R0, P - 0.04], [R0, -P + 0.04]];
  O.pon(torno(sec, 112).rotateX(Math.PI / 2), 'aqua', 0, Y, 0);
  for (const z of [-P, P]) { O.pon(new THREE.TorusGeometry(R1, 0.04, 10, 112), 'blanco', 0, Y, z); O.pon(new THREE.TorusGeometry(R0, 0.035, 10, 112), 'blanco', 0, Y, z); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; for (const z of [-P - 0.012, P + 0.012]) O.pon(esfera(0.042, 10, 8), 'luzAquaJ', Math.sin(a) * (R0 + R1) / 2, Y + Math.cos(a) * (R0 + R1) / 2, z); }
  O.pon(caja(0.8, 0.14, 0.44, 0.05), 'blanco', 0, 0.37, 0);
  O.medidas = { centro: Y, radio: R0 };
  return O.cerrar();
}
/* el arco de fútbol: palos y travesaño blancos de una pieza, el marco de atrás celeste y la red */
function arcoFutbol() {
  const O = new Obra(), W = 5.0, H = 2.2, D = 1.5, HB = 1.9, r = 0.075, e = 0.14;
  O.pon(tubo([[-W / 2, 0.02, 0], [-W / 2, H - e, 0], [-W / 2 + e * 0.3, H - e * 0.3, 0], [-W / 2 + e, H, 0], [W / 2 - e, H, 0], [W / 2 - e * 0.3, H - e * 0.3, 0], [W / 2, H - e, 0], [W / 2, 0.02, 0]], r, 160, 12), 'blanco');
  const b = 0.05;
  O.pon(tubo([[-W / 2, b, -D], [W / 2, b, -D]], b, 2, 8), 'celeste');
  O.pon(tubo([[-W / 2, HB, -D], [W / 2, HB, -D]], b, 2, 8), 'celeste');
  for (const s of [-1, 1]) {
    O.pon(tubo([[s * W / 2, b, 0], [s * W / 2, b, -D]], b, 2, 8), 'celeste');
    O.pon(tubo([[s * W / 2, b, -D], [s * W / 2, HB, -D]], b, 2, 8), 'celeste');
    O.pon(tubo([[s * W / 2, H, 0], [s * W / 2, HB, -D]], b, 2, 8), 'celeste');
    O.pon(esfera(0.1, 12, 8), 'blanco', s * W / 2, 0.04, 0, { s: [1, 0.55, 1] });
    O.pon(esfera(0.08, 12, 8), 'celeste', s * W / 2, 0.04, -D, { s: [1, 0.6, 1] });
    O.pon(quad([s * W / 2, 0, 0], [s * W / 2, 0, -D], [s * W / 2, HB, -D], [s * W / 2, H, 0], D / 0.12, H / 0.12), 'redJ');
  }
  O.pon(quad([-W / 2, 0, -D], [W / 2, 0, -D], [W / 2, HB, -D], [-W / 2, HB, -D], W / 0.12, HB / 0.12), 'redJ');
  O.pon(quad([-W / 2, H, 0], [W / 2, H, 0], [W / 2, HB, -D], [-W / 2, HB, -D], W / 0.12, D / 0.12), 'redJ');
  return O.cerrar();
}
/* el aro de básquet: base redonda pesada, caño blanco que sube y se curva hacia adelante,
   tablero de vidrio con marco azul y el cuadradito blanco, aro naranja (la red la anima juegos.js) */
function aroBasquet() {
  const O = new Obra(), RZ = 0.45;
  O.pon(torno([[0, 0], [0.62, 0], [0.66, 0.05], [0.6, 0.2], [0.45, 0.3], [0.2, 0.35], [0, 0.36]], 48), 'blanco', 0, 0, -1.35);
  O.pon(tubo([[0, 0.3, -1.35], [0, 2.2, -1.35], [0, 2.95, -1.3], [0, 3.3, -1.02], [0, 3.46, -0.6], [0, 3.48, -0.1]], 0.1, 80, 16), 'blanco');
  O.pon(caja(1.8, 1.1, 0.05, 0.02), 'vidrioAquaJ', 0, 3.5, 0);
  O.pon(caja(1.92, 0.08, 0.09, 0.03), 'azulJ', 0, 4.06, 0); O.pon(caja(1.92, 0.08, 0.09, 0.03), 'azulJ', 0, 2.94, 0);
  for (const s of [-1, 1]) O.pon(caja(0.08, 1.2, 0.09, 0.03), 'azulJ', s * 0.92, 3.5, 0);
  for (const [w, h, x, y] of [[0.6, 0.04, 0, 3.47], [0.6, 0.04, 0, 3.12], [0.04, 0.39, -0.3, 3.295], [0.04, 0.39, 0.3, 3.295]]) O.pon(caja(w, h, 0.02, 0.01), 'blanco', x, y, 0.035);
  O.pon(new THREE.TorusGeometry(0.235, 0.02, 10, 40).rotateX(Math.PI / 2), 'naranjaJ', 0, 3.05, RZ);
  O.pon(caja(0.22, 0.05, RZ - 0.2, 0.02), 'naranjaJ', 0, 3.04, (RZ - 0.2) / 2 + 0.03);
  O.medidas = { aro: V3(0, 3.05, RZ), base: V3(0, 0, -1.35) };
  return O.cerrar();
}
/* el trampolín de radio R: almohadón de gajos rosa y blanco, resortes, patas rosas con aro abajo (la tela la anima juegos.js) */
export function trampolinDe(R) {
  const O = new Obra(), Y = 0.36;
  const pad = new THREE.TorusGeometry(R, 0.17, 12, 72).rotateX(Math.PI / 2);
  pintar(pad, (x, y, z) => new THREE.Color(Math.floor((Math.atan2(z, x) / TAU + 1) * 8) % 2 ? '#ff9ad0' : '#ffffff'));
  O.pon(pad, 'colorJ', 0, Y, 0, { s: [1, 0.55, 1] });
  O.pon(new THREE.TorusGeometry(R - 0.02, 0.045, 8, 72).rotateX(Math.PI / 2), 'rosaJ', 0, Y - 0.1, 0);
  const nr = Math.round(R * 18);
  for (let k = 0; k < nr; k++) { const a = k / nr * TAU; O.pon(cil(0.011, 0.16, 5).rotateZ(Math.PI / 2), 'cromo', Math.cos(a) * (R - 0.14), Y - 0.02, Math.sin(a) * (R - 0.14), { ry: -a }); }
  const np = Math.max(6, Math.round(R * 4));
  for (let k = 0; k < np; k++) { const a = (k + 0.5) / np * TAU, x = Math.cos(a) * (R - 0.04), z = Math.sin(a) * (R - 0.04); O.pon(cil(0.035, Y - 0.1, 10), 'rosaJ', x, (Y - 0.1) / 2, z); O.pon(esfera(0.05, 10, 6), 'rosaJ', x, 0.02, z, { s: [1, 0.5, 1] }); }
  O.pon(new THREE.TorusGeometry(R - 0.04, 0.022, 6, 72).rotateX(Math.PI / 2), 'rosaJ', 0, 0.1, 0);
  return O.cerrar();
}
/* el armazón de las hamacas: dos A de aqua con sus uniones, la barra de arriba y los ganchos (10,8 × 5,3 m) */
function hamacas() {
  const O = new Obra(), W = 10.8, H = 5.3, S = 1.5;
  for (const s of [-1, 1]) {
    const x = s * W / 2;
    for (const e of [-1, 1]) { O.pon(tubo([[x, 0.02, e * S], [x, H - 0.12, e * 0.06]], 0.12, 2, 14), 'aqua'); O.pon(esfera(0.16, 14, 10), 'blanco', x, 0.05, e * S, { s: [1, 0.5, 1] }); }
    O.pon(esfera(0.22, 18, 14), 'aqua', x, H, 0);
    O.pon(cil(0.13, 0.05, 18).rotateZ(Math.PI / 2), 'blanco', x + s * 0.21, H, 0);
  }
  O.pon(cil(0.11, W, 18).rotateZ(Math.PI / 2), 'aqua', 0, H, 0);
  for (let i = 0; i < 3; i++) for (const e of [-0.32, 0.32]) O.pon(new THREE.TorusGeometry(0.05, 0.014, 6, 14), 'cromo', (i - 1) * 3.2 + e, H - 0.12, 0, { ry: Math.PI / 2 });
  return O.cerrar();
}
/* una cadena de L metros que cuelga de y = 0 (eslabones que alternan de lado) */
export function cadenaHamaca(L) {
  const geos = [], paso = 0.075, n = Math.floor(L / paso);
  for (let i = 0; i < n; i++) { const g = new THREE.TorusGeometry(0.028, 0.008, 5, 10); g.scale(1, 1.5, 1); if (i % 2) g.rotateY(Math.PI / 2); g.translate(0, -i * paso - paso / 2, 0); geos.push(g); }
  return mergeGeometries(geos);
}
/* el asiento de goma de la hamaca: una U baja y redonda */
export function asientoHamaca() {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16 * 2 - 1; pts.push(new THREE.Vector2(u * 0.4, 0.12 * u * u * u * u)); }
  for (let i = 16; i >= 0; i--) { const u = i / 16 * 2 - 1; pts.push(new THREE.Vector2(u * 0.4, 0.12 * u * u * u * u + 0.06)); }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.36, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -0.18); return g;
}
/* la torre del tobogán: cuatro postes blancos, plataforma, barandas de vidrio con marco,
   y el techito de cúpula con la puntita (la plataforma arriba a 4,2 m; la rampa y la escalera
   las pone juegos.js, que les da la física) */
function torreTobogan() {
  const O = new Obra(), L = 1.4, Y = 4.2, T = 6.1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { O.pon(cil(0.11, T, 16), 'blanco', sx * (L - 0.1), T / 2, sz * (L - 0.1)); O.pon(esfera(0.14, 12, 8), 'blanco', sx * (L - 0.1), 0.04, sz * (L - 0.1), { s: [1, 0.5, 1] }); }
  O.pon(caja(L * 2, 0.22, L * 2, 0.08), 'perla', 0, Y - 0.11, 0);
  O.pon(caja(L * 2 + 0.1, 0.08, L * 2 + 0.1, 0.03), 'celeste', 0, Y - 0.24, 0);
  /* barandas en los lados sin salida (±z), con marco blanco y vidrio */
  for (const s of [-1, 1]) {
    O.pon(caja(L * 2 - 0.2, 0.9, 0.04, 0.02), 'vidrioAquaJ', 0, Y + 0.55, s * (L - 0.1));
    O.pon(caja(L * 2 - 0.1, 0.08, 0.1, 0.04), 'blanco', 0, Y + 1.02, s * (L - 0.1));
    for (let k = 0; k < 3; k++) O.pon(esfera(0.1, 12, 8), 'luzAquaJ', (k - 1) * 0.8, Y + 0.55, s * (L - 0.07));
  }
  /* (los lados ±x quedan abiertos: de un lado llega la escalera y del otro sale la rampa) */
  O.pon(caja(L * 2 + 0.3, 0.16, L * 2 + 0.3, 0.07), 'blanco', 0, T, 0);
  O.pon(new THREE.SphereGeometry(L * 1.12, 36, 16, 0, TAU, 0, Math.PI / 2), 'blanco', 0, T + 0.06, 0, { s: [1, 0.62, 1] });
  for (let k = 0; k < 8; k++) O.pon(tubo(Array.from({ length: 9 }, (_, i) => { const u = i / 8 * Math.PI / 2, a = k / 8 * TAU; return [Math.cos(a) * Math.cos(u) * L * 1.13, T + 0.06 + Math.sin(u) * L * 1.13 * 0.62, Math.sin(a) * Math.cos(u) * L * 1.13]; }), 0.03, 16, 5), 'celeste');
  O.pon(cil(0.03, 0.4, 8), 'blanco', 0, T + 0.06 + L * 0.7 + 0.2, 0); O.pon(esfera(0.1, 12, 8), 'celeste', 0, T + 0.06 + L * 0.7 + 0.42, 0);
  return O.cerrar();
}

/* lo que se puede pedir por nombre (modelos.js) */
export const CONSTRUIR = {
  casa, estacion, tienda, hotel, tren, fuente, banco, farol, arbol, palmera,
  terminal, molino, faro, reposera, guardavidas, botella, hongo, casaArbol, glorieta, muelle, velero, cartelMapa, farolJuegos,
  vagon: () => tren(false), sombrilla, sombrillaRosa: () => sombrilla('#ff8fcf', '#ffffff'),
  arbolRosa: () => arbol(['#e45fa8', '#ff8fcf', '#ffd0ea']),
  arbolLejos: () => arbol(undefined, true), arbolRosaLejos: () => arbol(['#e45fa8', '#ff8fcf', '#ffd0ea'], true), palmeraLejos,
  'm-sofa': sofa, 'm-sillon': sillon, 'm-cama': cama, 'm-tele': tele, 'm-lampara': lampara,
  telescopio, mesaJuego, sillaBurbuja: () => sillaBurbuja('sillaAzulJ'), sillaBurbujaRosa: () => sillaBurbuja('sillaRosaJ'), portalJuegos, arcoFutbol, aroBasquet, hamacas, torreTobogan,
};
