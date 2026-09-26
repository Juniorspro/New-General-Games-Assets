/* ============================================================================
   aeroplaza/js/manos.js — las manos del VR, como en un Meta Quest.
   - De dónde salen: la cámara del celu (manos-camara.js, MediaPipe), las
     manos del visor (WebXR, vr-xr.js) o las pruebas. Todas llegan igual: 21
     puntos por mano en metros, en el mundo.
   - Suaves y sin atraso: cada punto pasa por un filtro One Euro (quieto no
     tiembla, rápido no se arrastra) y se ADELANTA con su velocidad hasta el
     cuadro que se dibuja: la cámara saca 30 fotos por segundo y la red tarda,
     pero la mano se dibuja a 120, donde va a estar.
   - El dibujo: las 48 cápsulas de las dos manos en UNA malla instanciada (la
     forma de cada cápsula la arma el shader con los dos puntos y los dos
     radios), y otra pasada con la misma malla que solo escribe profundidad
     antes: así el vidrio no se ve doble donde se cruzan los dedos. Dos
     llamadas para las dos manos.
   - Lo que se hace con ellas, como en Quest:
     · el rayo sale del hombro y pasa entre el pulgar y el índice; el
       pellizco (pulgar con índice) es el clic: usa lo que se apunta;
     · apuntando al piso sale el arco: se pellizca, se suelta y se salta ahí
       (teletransporte, con un parpadeo);
     · la palma para la cara y un pellizco abre el menú de la muñeca
       (caminar, girar, cuadros por segundo, salir), que se toca con el
       dedo o con el rayo;
     · la yema del índice revienta las burbujas y junta los orbes;
     · los dos pellizcos a la vez: salto.
   ========================================================================== */
import * as THREE from 'three';
import { t, sumar } from './textos.js';

sumar({
  es: { mn_caminar: '🚶 Caminar', mn_parar: '✋ Parar', mn_izq: 'Girar ⟲', mn_der: 'Girar ⟳', mn_fps: 'FPS', mn_salir: 'Salir del VR', mn_titulo: 'Menú', mn_manos_cargando: '✋ Cargando las manos…', mn_manos_listas: '✋ Manos listas: pellizcá para usar, la palma para el menú', mn_manos_error: 'No se pudieron prender las manos (cámara o red)', mn_saltar: 'Saltar', mn_ir: 'Ir' },
  en: { mn_caminar: '🚶 Walk', mn_parar: '✋ Stop', mn_izq: 'Turn ⟲', mn_der: 'Turn ⟳', mn_fps: 'FPS', mn_salir: 'Exit VR', mn_titulo: 'Menu', mn_manos_cargando: '✋ Loading hands…', mn_manos_listas: '✋ Hands ready: pinch to use, palm for the menu', mn_manos_error: 'Couldn’t start hand tracking (camera or network)', mn_saltar: 'Jump', mn_ir: 'Go' },
  pt: { mn_caminar: '🚶 Andar', mn_parar: '✋ Parar', mn_izq: 'Girar ⟲', mn_der: 'Girar ⟳', mn_fps: 'FPS', mn_salir: 'Sair do VR', mn_titulo: 'Menu', mn_manos_cargando: '✋ Carregando as mãos…', mn_manos_listas: '✋ Mãos prontas: pinça para usar, a palma para o menu', mn_manos_error: 'Não foi possível ligar as mãos (câmera ou rede)', mn_saltar: 'Pular', mn_ir: 'Ir' },
});

/* los huesos (pares de puntos de MediaPipe) y el grosor en cada punto, en metros */
export const HUESOS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
  /* (la palma: rellenos gruesos para que no queden agujeros entre los nudillos y la muñeca) */
  [0, 9], [0, 13], [1, 5]];
const PALMA = new Set([21, 22, 23]);
const RADIO = [0.02, 0.013, 0.0118, 0.0105, 0.0092, 0.0112, 0.0102, 0.0094, 0.0084, 0.0114, 0.0104, 0.0095, 0.0085, 0.0108, 0.0099, 0.009, 0.0081, 0.0096, 0.0088, 0.008, 0.0072];
const N = HUESOS.length;
const PUNTA = [4, 8, 12, 16, 20];

/* -------------------------------------------------- el filtro One Euro, para n números a la vez */
class Euro {
  /* (corte 1,6 Hz quieto y +8 Hz por cada m/s: medido con la prueba, quieta tiembla menos que la
     mitad del ruido y tocando un botón a 30 cm/s atrasa menos de 1 cm) */
  constructor(n, { corte = 1.6, beta = 8, corteD = 1.5 } = {}) { this.x = new Float32Array(n); this.dx = new Float32Array(n); this.t = -1; this.corte = corte; this.beta = beta; this.corteD = corteD; }
  static a(corte, dt) { const tau = 1 / (2 * Math.PI * corte); return 1 / (1 + tau / dt); }
  reiniciar(v, t) { this.x.set(v); this.dx.fill(0); this.t = t; }
  filtrar(v, t) {
    if (this.t < 0 || t - this.t > 0.5) { this.reiniciar(v, t); return this.x; }
    const dt = Math.max(1e-3, t - this.t); this.t = t;
    const ad = Euro.a(this.corteD, dt);
    for (let i = 0; i < v.length; i++) {
      const d = (v[i] - this.x[i]) / dt; this.dx[i] += ad * (d - this.dx[i]);
      this.x[i] += Euro.a(this.corte + this.beta * Math.abs(this.dx[i]), dt) * (v[i] - this.x[i]);
    }
    return this.x;
  }
}

/* -------------------------------------------------- una mano */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
class Mano {
  constructor(derecha) {
    this.derecha = derecha; this.visible = false; this.t = -1; this.conf = 0;
    this.euro = new Euro(63);
    this.p = new Float32Array(63);        // lo que se dibuja (filtrado y adelantado)
    this.pellizca = false; this.fuerza = 0; this.tPellizco = -9; this.soltoEn = -9;
    this.rayoO = new THREE.Vector3(); this.rayoD = new THREE.Vector3(0, 0, -1);
    this.euroRayo = new Euro(3, { corte: 0.9, beta: 0.9 });
    this.palmaN = new THREE.Vector3(); this.palmaC = new THREE.Vector3(); this.aLaCara = 0;
    this.fijoHasta = 0;                   // (el rayo se queda quieto un ratito al pellizcar: el pellizco lo movía)
  }
  punto(i, v = new THREE.Vector3()) { return v.set(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); }
  /* una lectura nueva: puntos en el mundo; pell: cuánto se abre el pellizco (0 = tocándose; la escala
     es el largo de la palma); t en segundos */
  recibir(P, t, pell, conf = 1) {
    /* si la mano estaba perdida o saltó más de 25 cm (imposible en una foto: es otra detección), el
       filtro arranca de cero; si no, mezclaba la pose vieja durante varios cuadros */
    const X = this.euro.x, salto = Math.hypot(P[0] - X[0], P[1] - X[1], P[2] - X[2]);
    if (!this.visible || salto > 0.25) { this.euro.reiniciar(P, t); this.euroRayo.t = -1; this.fijoHasta = 0; }
    else this.euro.filtrar(P, t);
    this.t = t; this.conf = conf; this.pell = pell;
    if (!this.visible) { this.visible = true; this.pellizca = false; this.anulado = false; this.profAntes = undefined; }
  }
  /* al cuadro que se dibuja: lo filtrado más la velocidad por lo que pasó desde la foto (hasta 70 ms) */
  adelantar(tDibujo, adelanta) {
    const E = this.euro, k = adelanta ? Math.min(0.07, Math.max(0, tDibujo - this.t)) * 0.85 : 0;
    for (let i = 0; i < 63; i++) this.p[i] = E.x[i] + E.dx[i] * k;
  }
}

/* -------------------------------------------------- la cápsula que arma el shader */
function geoCapsula(seg = 10, anillos = 4) {
  const pos = [], nrm = [], lado = [], idx = [];
  /* media esfera de abajo (lado 0, en A) y de arriba (lado 1, en B): el ecuador está dos veces y
     entre las dos queda el tubo */
  const filas = [];
  for (let h = 0; h < 2; h++) for (let j = 0; j <= anillos; j++) {
    const lat = h === 0 ? -Math.PI / 2 + (j / anillos) * Math.PI / 2 : (j / anillos) * Math.PI / 2;
    const fila = [];
    for (let s = 0; s <= seg; s++) {
      const lon = s / seg * Math.PI * 2, x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
      fila.push(pos.length / 3); pos.push(0, 0, 0); nrm.push(x, y, z); lado.push(h);
    }
    filas.push(fila);
  }
  for (let r = 0; r < filas.length - 1; r++) for (let s = 0; s < seg; s++) {
    const a = filas[r][s], b = filas[r][s + 1], c = filas[r + 1][s], d = filas[r + 1][s + 1];
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('nrm', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('lado', new THREE.Float32BufferAttribute(lado, 1));
  const n = N * 2;
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iB', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iR', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iBr', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage));
  g.instanceCount = 0;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return g;
}
const VERT_MANO = /* glsl */`
  attribute vec3 nrm, iA, iB; attribute float lado; attribute vec2 iR, iBr;
  varying vec3 vN, vV; varying float vBr, vAlfa, vLado;
  void main() {
    vec3 d = iB - iA; float L = length(d); vec3 w = L > 1e-5 ? d / L : vec3(0.0, 1.0, 0.0);
    vec3 up = abs(w.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 u = normalize(cross(up, w)), v = cross(w, u);
    vec3 n = u * nrm.x + v * nrm.y + w * nrm.z;
    vec3 p = (lado < 0.5 ? iA : iB) + n * (lado < 0.5 ? iR.x : iR.y);
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vN = normalize(mat3(viewMatrix) * n); vV = normalize(-mv.xyz); vBr = iBr.x; vAlfa = iBr.y; vLado = lado;
    gl_Position = projectionMatrix * mv;
  }`;
/* vidrio Aero: blanco celeste, el borde que brilla (fresnel), un reflejo arriba y el pellizco que se
   enciende. Sin luces de la escena: van por ojo y tienen que ser baratas */
const FRAG_MANO = /* glsl */`
  uniform vec3 uColor, uBorde; uniform float uOpacidad;
  varying vec3 vN, vV; varying float vBr, vAlfa, vLado;
  void main() {
    vec3 n = normalize(vN), v = normalize(vV);
    float f = pow(1.0 - max(0.0, dot(n, v)), 2.0);
    /* una luz de arriba a la izquierda (en la vista) y el cielo: los dedos se separan por la sombra */
    float luz = max(0.0, dot(n, normalize(vec3(-0.35, 0.85, 0.4)))), cielo = 0.5 + 0.5 * n.y;
    float brillo = pow(max(0.0, dot(reflect(-v, n), normalize(vec3(-0.3, 0.8, 0.5)))), 28.0);
    vec3 c = mix(vec3(0.27, 0.35, 0.46), uColor, 0.12 + 0.68 * luz + 0.2 * cielo);
    /* el borde claro recorta cada dedo contra el fondo (como las manos de Quest) */
    c = mix(c, uBorde, smoothstep(0.25, 0.9, f) * 0.85) + vec3(1.0) * brillo * 0.5;
    /* el pellizco se enciende en las puntas */
    c = mix(c, vec3(0.5, 1.0, 1.0), vBr * (0.4 + 0.6 * f));
    gl_FragColor = vec4(c, clamp(uOpacidad * vAlfa * (0.8 + 0.2 * f) + vBr * 0.25, 0.0, 1.0));
  }`;

/* -------------------------------------------------- el menú de la muñeca */
const BOTONES = ['mn_caminar', 'mn_izq', 'mn_der', 'mn_fps', 'mn_salir'];
class Menu {
  constructor() {
    this.lienzo = document.createElement('canvas'); this.lienzo.width = 512; this.lienzo.height = 300;
    this.tex = new THREE.CanvasTexture(this.lienzo); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false }));
    this.malla.visible = false; this.malla.renderOrder = 5;
    this.sobre = -1; this.apretado = -1; this.abierto = false; this.fps = false; this.camina = false;
    /* los botones en la textura (x, y, ancho, alto), en píxeles del lienzo */
    this.cajas = [[20, 70, 230, 90], [262, 70, 110, 90], [382, 70, 110, 90], [20, 180, 150, 90], [182, 180, 310, 90]];
    this.pintar();
  }
  pintar() {
    const c = this.lienzo.getContext('2d'), W = 512, H = 300;
    c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(235,250,255,0.92)'); g.addColorStop(1, 'rgba(160,220,255,0.88)');
    c.fillStyle = g; c.beginPath(); c.roundRect(4, 4, W - 8, H - 8, 34); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 5; c.stroke();
    c.fillStyle = '#12507a'; c.font = '800 34px system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('🥽 ' + t('mn_titulo'), 26, 48);
    this.cajas.forEach(([x, y, w, h], i) => {
      const s = i === this.sobre, a = i === this.apretado;
      const gb = c.createLinearGradient(0, y, 0, y + h);
      gb.addColorStop(0, a ? '#7fd8ff' : s ? '#ffffff' : '#e9f8ff'); gb.addColorStop(1, a ? '#2aa6e8' : s ? '#bfe9ff' : '#a9dcf7');
      c.fillStyle = gb; c.beginPath(); c.roundRect(x, y + (a ? 4 : 0), w, h - 4, 24); c.fill();
      c.strokeStyle = s ? '#2aa6e8' : 'rgba(255,255,255,0.9)'; c.lineWidth = s ? 6 : 3; c.stroke();
      c.fillStyle = i === 4 ? '#b3261e' : '#0f3f63'; c.font = '800 28px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(i === 0 && this.camina ? t('mn_parar') : t(BOTONES[i]) + (i === 3 && this.fps ? ' ✓' : ''), x + w / 2, y + h / 2 + 8 + (a ? 4 : 0));
    });
    this.tex.needsUpdate = true;
  }
  /* se abre delante de la cara, a la altura del pecho y mirándola */
  abrir(cabezaP, cabezaQ) {
    _a.set(0, 0, -1).applyQuaternion(cabezaQ); _a.y = 0; if (_a.lengthSq() < 1e-4) _a.set(0, 0, -1); _a.normalize();
    this.malla.position.copy(cabezaP).addScaledVector(_a, 0.42); this.malla.position.y -= 0.16;
    this.malla.lookAt(cabezaP.x, cabezaP.y - 0.05, cabezaP.z);
    this.malla.visible = this.abierto = true; this.malla.updateMatrixWorld(); this.pintar();
  }
  cerrar() { this.malla.visible = this.abierto = false; }
  /* un punto del mundo, al botón (o -1) y la distancia al plano (positiva adelante) */
  enPunto(p) {
    const inv = _m.copy(this.malla.matrixWorld).invert(); _b.copy(p).applyMatrix4(inv);
    const u = (_b.x / 0.34 + 0.5) * 512, v = (0.5 - _b.y / 0.2) * 300;
    const i = this.cajas.findIndex(([x, y, w, h]) => u >= x && u <= x + w && v >= y && v <= y + h);
    return { i, prof: _b.z };
  }
  /* el rayo contra el plano del menú */
  enRayo(o, d) {
    const n = _c.set(0, 0, 1).applyQuaternion(this.malla.quaternion), den = n.dot(d); if (Math.abs(den) < 1e-4) return null;
    const k = _d.copy(this.malla.position).sub(o).dot(n) / den; if (k < 0 || k > 3) return null;
    const p = o.clone().addScaledVector(d, k), r = this.enPunto(p); return r.i >= 0 ? { ...r, p, k } : { i: -1, p, k };
  }
}

/* -------------------------------------------------- todo junto */
export class Manos {
  constructor() {
    this.escena = new THREE.Scene();
    this.manos = [new Mano(false), new Mano(true)];
    this.activa = false; this.fuente = null; this.adelanta = true;
    this.cabeza = [];   // la pose de la cabeza en cada cuadro (para poner en el mundo lo que vio la cámara)
    const g = this.geo = geoCapsula();
    const U = { uColor: { value: new THREE.Vector3(0.8, 0.88, 0.96) }, uBorde: { value: new THREE.Vector3(0.72, 0.97, 1.0) }, uOpacidad: { value: 0.88 } };
    /* primero solo la profundidad; después el vidrio encima, sin verse doble */
    this.prof = new THREE.Mesh(g, new THREE.ShaderMaterial({ vertexShader: VERT_MANO, fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }', colorWrite: false }));
    this.vidrio = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT_MANO, fragmentShader: FRAG_MANO, transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth }));
    this.prof.frustumCulled = this.vidrio.frustumCulled = false; this.prof.renderOrder = 1; this.vidrio.renderOrder = 2;
    this.escena.add(this.prof, this.vidrio);
    /* el rayo (un tubito que se apaga), el cursor, el arco del salto y el aro donde cae */
    const matRayo = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uFuerza: { value: 0 } },
      vertexShader: 'varying float vY; void main() { vY = position.y + 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uFuerza; varying float vY; void main() { gl_FragColor = vec4(mix(vec3(0.85, 0.97, 1.0), vec3(0.4, 0.9, 1.0), uFuerza), (1.0 - vY) * (0.55 + 0.4 * uFuerza)); }' });
    this.rayos = this.manos.map(() => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0035, 1, 6, 1, true), matRayo.clone()); r.visible = false; r.renderOrder = 3; this.escena.add(r); return r; });
    const matCursor = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
    this.cursores = this.manos.map(() => { const c = new THREE.Mesh(new THREE.RingGeometry(0.55, 1, 24), matCursor.clone()); c.visible = false; c.renderOrder = 6; this.escena.add(c); return c; });
    this.puntos = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: '#bff4ff', transparent: true, opacity: 0.85, toneMapped: false }), 32);
    this.puntos.count = 0; this.puntos.frustumCulled = false; this.puntos.renderOrder = 3; this.escena.add(this.puntos);
    this.aro = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7dfcc0', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    this.aro.visible = false; this.aro.renderOrder = 3; this.escena.add(this.aro);
    /* el botoncito que aparece arriba de la palma cuando mira a la cara */
    this.boton = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: '#9ff3ff', transparent: true, opacity: 0.9, toneMapped: false }));
    this.boton.visible = false; this.escena.add(this.boton);
    this.menu = new Menu(); this.escena.add(this.menu.malla);
    /* el cartel de lo que se apunta */
    this.cartelL = document.createElement('canvas'); this.cartelL.width = 512; this.cartelL.height = 96;
    this.cartel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(this.cartelL), depthTest: false, transparent: true, toneMapped: false }));
    this.cartel.material.map.colorSpace = THREE.SRGBColorSpace; this.cartel.visible = false; this.cartel.renderOrder = 7; this.escena.add(this.cartel);
    this.objetivo = null; this.salto = null; this.eventos = [];
    this.stats = { lecturas: 0, dibujos: 0, msActualizar: 0 };
  }
  /* ------------------------------------------ la cabeza en cada cuadro (t en ms, como performance.now) */
  registrarCabeza(t, q, p, giro = 0) {
    const c = this.cabeza.length >= 40 ? this.cabeza.shift() : { q: new THREE.Quaternion(), p: new THREE.Vector3() };
    c.t = t; c.q.copy(q); c.p.copy(p); c.giro = giro; this.cabeza.push(c);
  }
  /* la cabeza en el momento t (interpolando entre dos cuadros) */
  cabezaEn(t, q, p) {
    const C = this.cabeza; if (!C.length) return false;
    let i = C.length - 1; while (i > 0 && C[i].t > t) i--;
    const a = C[i], b = C[Math.min(C.length - 1, i + 1)], k = b.t > a.t ? THREE.MathUtils.clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    q.slerpQuaternions(a.q, b.q, k); p.lerpVectors(a.p, b.p, k);
    if (a.giro) q.multiply(_q.setFromAxisAngle(_d.set(0, 0, 1), a.giro));
    return true;
  }
  /* ------------------------------------------ lo que llega de la cámara (puntos en la cámara de three) */
  recibirCamara(lista, tCaptura) {
    const q = new THREE.Quaternion(), p = new THREE.Vector3();
    if (!this.cabezaEn(tCaptura, q, p)) return;
    const ts = tCaptura / 1000, usadas = new Set();
    /* a cada mano la suya: por la etiqueta, y si vienen dos iguales, por el lado de la imagen */
    const conLado = lista.map((m) => ({ m, der: m.derecha ?? (m.puntos[0] > 0) }));
    if (conLado.length === 2 && conLado[0].der === conLado[1].der) { const [x, y] = conLado; const xDer = x.m.puntos[0] > y.m.puntos[0]; x.der = xDer; y.der = !xDer; }
    for (const { m, der } of conLado) {
      const M = this.manos[der ? 1 : 0]; if (usadas.has(M)) continue; usadas.add(M);
      const W = new Float32Array(63);
      for (let i = 0; i < 21; i++) {
        /* (la cámara queda unos centímetros adelante de los ojos en un visor) */
        _a.set(m.puntos[i * 3], m.puntos[i * 3 + 1], m.puntos[i * 3 + 2] - 0.06).applyQuaternion(q).add(p);
        W[i * 3] = _a.x; W[i * 3 + 1] = _a.y; W[i * 3 + 2] = _a.z;
      }
      /* el pellizco: en la imagen (lo más claro) y en metros; relativo al largo de la palma */
      const I = m.img, e2 = Math.hypot(I[0] - I[27], I[1] - I[28]) || 1, e3 = Math.hypot(m.puntos[0] - m.puntos[27], m.puntos[1] - m.puntos[28], m.puntos[2] - m.puntos[29]) || 1;
      const p2 = Math.hypot(I[12] - I[24], I[13] - I[25]) / e2, p3 = Math.hypot(m.puntos[12] - m.puntos[24], m.puntos[13] - m.puntos[25], m.puntos[14] - m.puntos[26]) / e3;
      M.recibir(W, ts, Math.max(p2, p3 * 0.62), m.confianza);
      this.stats.lecturas++;
    }
  }
  /* lo que llega ya en el mundo (el visor WebXR, las pruebas): pell en metros de punta a punta */
  recibirMundo(der, W, tSeg, pellMetros = null) {
    const M = this.manos[der ? 1 : 0];
    const e = Math.hypot(W[0] - W[27], W[1] - W[28], W[2] - W[29]) || 0.09;
    const pm = pellMetros ?? Math.hypot(W[12] - W[24], W[13] - W[25], W[14] - W[26]);
    M.recibir(W, tSeg, pm / e * 1.0, 1);
    this.stats.lecturas++;
  }
  perder(der) { this.manos[der ? 1 : 0].visible = false; }
  /* ------------------------------------------ cada cuadro. ctx: lo del juego que hace falta
     { cabezaP, cabezaQ, interactivos: [{ o, pos, texto }], altura(x, z), sePuede(x, y, z), tocar(p) }
     devuelve los eventos: usar, ir, saltar, menú */
  actualizar(dt, tMs, ctx) {
    const t0 = performance.now(), ts = tMs / 1000, ev = this.eventos = [];
    const cabP = ctx.cabezaP, cabQ = ctx.cabezaQ;
    for (const [k, M] of this.manos.entries()) {
      /* se pierde si no llega nada hace 250 ms (la cámara) */
      if (M.visible && ts - M.t > (this.fuente === 'xr' ? 0.15 : 0.25)) M.visible = false;
      if (!M.visible) { M.pellizca = false; M.fuerza = 0; continue; }
      M.adelantar(ts, this.adelanta && this.fuente !== 'xr');
      /* el pellizco, con histéresis (se prende más cerrado de lo que se apaga) */
      const antes = M.pellizca;
      if (!M.pellizca && M.pell < 0.3) M.pellizca = true; else if (M.pellizca && M.pell > 0.46) M.pellizca = false;
      M.fuerza = THREE.MathUtils.clamp(1 - (M.pell - 0.2) / 0.45, 0, 1);
      M.empezo = !antes && M.pellizca; M.solto = antes && !M.pellizca;
      if (M.empezo) { M.tPellizco = ts; M.fijoHasta = ts + 0.14; }
      if (M.solto) M.fijoHasta = 0;
      /* la palma: su normal y si mira a la cara */
      const w = M.punto(0, _a), i5 = M.punto(5, _b), i17 = M.punto(17, _c);
      M.palmaN.crossVectors(i5.sub(w), i17.sub(w)).normalize(); if (!M.derecha) M.palmaN.negate();
      M.palmaC.copy(M.punto(0)).add(M.punto(9)).multiplyScalar(0.5);
      M.aLaCara = M.palmaN.dot(_d.copy(cabP).sub(M.palmaC).normalize());
      /* el rayo: del hombro (bajo la cabeza, al costado de esta mano) entre el pulgar y el índice */
      _d.set(0, 0, -1).applyQuaternion(cabQ); const yaw = Math.atan2(-_d.x, -_d.z);
      const hombro = _c.set(cabP.x + Math.cos(yaw) * (M.derecha ? 0.17 : -0.17), cabP.y - 0.2, cabP.z - Math.sin(yaw) * (M.derecha ? 0.17 : -0.17));
      const mira = M.punto(2, _b).add(M.punto(5, _a)).multiplyScalar(0.5);
      M.rayoO.copy(mira);
      if (ts > M.fijoHasta) { const d = mira.clone().sub(hombro).normalize(); const f = M.euroRayo.filtrar([d.x, d.y, d.z], ts); M.rayoD.set(f[0], f[1], f[2]).normalize(); }
      /* la yema del índice toca (burbujas, orbes) */
      ctx.tocar?.(M.punto(8, _a), k);
    }
    const [I, D] = this.manos;
    /* los dos pellizcos a la vez: salto (las dos con lectura fresca: una mano que se perdió hace un
       rato sigue "vista" 250 ms con su último pellizco, y con el pellizco de la palma parecía doble) */
    const fresca = (M) => M.visible && ts - M.t < 0.12;
    if (fresca(I) && fresca(D) && (I.empezo || D.empezo) && I.pellizca && D.pellizca && Math.abs(I.tPellizco - D.tPellizco) < 0.25) { ev.push({ tipo: 'saltar' }); this.salto = null; I.anulado = D.anulado = true; }
    /* el menú: la palma a la cara y un pellizco de esa mano; o se toca con la yema de la otra */
    let palma = null;
    for (const M of this.manos) if (M.visible && M.aLaCara > 0.62) palma = M;
    this.boton.visible = !!palma && !this.menu.abierto;
    if (palma) { this.boton.position.copy(palma.palmaC).addScaledVector(palma.palmaN, 0.05); this.boton.scale.setScalar(1 + palma.fuerza * 0.8); }
    if (palma && palma.empezo) { palma.anulado = true; if (this.menu.abierto) this.menu.cerrar(); else this.menu.abrir(cabP, cabQ); ev.push({ tipo: 'sonido', s: 'aviso' }); }
    /* cada mano: menú (toque o rayo) > lo que se apunta > el piso (arco) */
    let objetivo = null, salto = null;
    for (const [k, M] of this.manos.entries()) {
      const R = this.rayos[k], C = this.cursores[k];
      R.visible = C.visible = false;
      if (!M.visible || M === palma) { if (M.solto) M.anulado = false; continue; }
      if (M.solto && M.anulado) { M.anulado = false; continue; }
      let fin = null;
      if (this.menu.abierto) {
        /* el dedo: se aprieta al cruzar el plano (de adelante hacia atrás) */
        const yema = M.punto(8, _a), pt = this.menu.enPunto(yema);
        if (pt.i >= 0 && Math.abs(pt.prof) < 0.05) {
          if (this.menu.sobre !== pt.i) { this.menu.sobre = pt.i; this.menu.pintar(); }
          if (M.profAntes > 0.004 && pt.prof <= 0.004) this.apretar(pt.i, ev);
          M.profAntes = pt.prof; continue;
        }
        M.profAntes = pt.prof;
        const r = this.menu.enRayo(M.rayoO, M.rayoD);
        if (r) {
          fin = r.p;
          if (r.i !== this.menu.sobre) { this.menu.sobre = r.i; this.menu.pintar(); }
          if (M.empezo && !M.anulado && r.i >= 0) this.apretar(r.i, ev);
        }
      }
      if (!fin) {
        /* lo interactivo más alineado con el rayo (hasta 14 m): cada cosa acepta 6° más lo que mide
           vista desde ahí, y gana la que queda más adentro de lo suyo (si no, una grande de al lado
           le ganaba a la chica que se apunta justo) */
        let mejor = null, ma = 1;
        for (const it of ctx.interactivos || []) {
          const v = _b.copy(it.pos).sub(M.rayoO); const dist = v.length(); if (dist > 14 || dist < 0.2) continue;
          const ang = Math.acos(THREE.MathUtils.clamp(v.dot(M.rayoD) / dist, -1, 1)), tol = 0.105 + Math.atan2(it.radio || 0.4, dist);
          if (ang / tol < ma) { ma = ang / tol; mejor = it; }
        }
        if (mejor) {
          fin = mejor.pos; objetivo = mejor;
          if (M.empezo && !M.anulado) ev.push({ tipo: 'usar', o: mejor.o });
        } else if (!salto) {
          /* el arco: tiro de 6,5 m/s desde la mano hasta que toca el piso */
          const arco = this.arco(M, ctx);
          if (arco) {
            salto = arco; fin = null;
            if (M.solto && !M.anulado && arco.valido) ev.push({ tipo: 'ir', p: arco.p.clone() });
          }
        }
      }
      if (M.solto) M.anulado = false;
      /* el rayo y el cursor */
      const largo = fin ? fin.distanceTo(M.rayoO) : 0.55;
      R.visible = true; R.material.uniforms.uFuerza.value = M.fuerza;
      R.position.copy(M.rayoO).addScaledVector(M.rayoD, largo / 2); R.quaternion.setFromUnitVectors(_c.set(0, 1, 0), M.rayoD); R.scale.set(1, largo, 1);
      /* (el cilindro de three va de -0,5 a 0,5 en y: con y hacia afuera, la punta de la mano es la opaca) */
      if (fin) { C.visible = true; C.position.copy(fin); C.lookAt(cabP); const s = 0.012 * (1 + fin.distanceTo(cabP) * 0.9) * (1 - M.fuerza * 0.45); C.scale.setScalar(s); }
    }
    /* el arco y el aro */
    this.salto = salto;
    if (salto) {
      const n = Math.min(this.puntos.instanceMatrix.count, salto.pts.length);
      for (let i = 0; i < n; i++) { _m.makeTranslation(salto.pts[i].x, salto.pts[i].y, salto.pts[i].z); this.puntos.setMatrixAt(i, _m); }
      this.puntos.count = n; this.puntos.instanceMatrix.needsUpdate = true;
      this.puntos.material.color.set(salto.valido ? '#bff4ff' : '#ffb3b3');
      this.aro.visible = true; this.aro.position.copy(salto.p).y += 0.03; this.aro.material.color.set(salto.valido ? '#7dfcc0' : '#ff7d7d');
      this.aro.scale.setScalar(1 + (salto.mano.fuerza) * 0.25);
    } else { this.puntos.count = 0; this.aro.visible = false; }
    /* el cartel de lo que se apunta */
    if (objetivo !== this.objetivo) {
      this.objetivo = objetivo;
      if (objetivo) {
        const c = this.cartelL.getContext('2d'); c.clearRect(0, 0, 512, 96);
        c.fillStyle = 'rgba(10,40,70,0.72)'; c.beginPath(); c.roundRect(8, 10, 496, 76, 38); c.fill();
        c.fillStyle = '#ffffff'; c.font = '800 38px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('✋ ' + (objetivo.texto || ''), 256, 62);
        this.cartel.material.map.needsUpdate = true;
      }
    }
    this.cartel.visible = !!objetivo;
    if (objetivo) { this.cartel.position.copy(objetivo.pos).y += 0.55; const d = objetivo.pos.distanceTo(cabP); this.cartel.scale.set(0.32 * (0.6 + d * 0.12), 0.06 * (0.6 + d * 0.12), 1); }
    this.dibujarManos();
    this.stats.msActualizar = performance.now() - t0;
    return ev;
  }
  apretar(i, ev) {
    this.menu.apretado = i; this.menu.pintar(); clearTimeout(this._tApr);
    this._tApr = setTimeout(() => { this.menu.apretado = -1; this.menu.pintar(); }, 180);
    const acc = ['caminar', 'izq', 'der', 'fps', 'salir'][i];
    if (acc === 'fps') { this.menu.fps = !this.menu.fps; this.menu.pintar(); }
    ev.push({ tipo: 'menu', accion: acc, fps: this.menu.fps }, { tipo: 'sonido', s: 'elegir' });
    if (acc === 'salir' || acc === 'caminar') this.menu.cerrar();
  }
  /* la parábola del teletransporte: la mano tira una piedrita imaginaria */
  arco(M, ctx) {
    if (M.rayoD.y > 0.35) return null;   // (apuntando al cielo no hay arco)
    const pts = [], p = M.rayoO.clone(), v = M.rayoD.clone().multiplyScalar(6.5), g = -9.8, paso = 0.045;
    for (let i = 0; i < 60; i++) {
      const sig = p.clone().addScaledVector(v, paso); v.y += g * paso;
      const suelo = ctx.altura(sig.x, sig.z, p.y);
      if (sig.y <= suelo) {
        /* (el punto justo donde cruza el piso) */
        const h0 = ctx.altura(p.x, p.z, p.y), k = (p.y - h0) / Math.max(1e-4, p.y - h0 - (sig.y - suelo));
        const q = p.clone().lerp(sig, THREE.MathUtils.clamp(k, 0, 1)); q.y = ctx.altura(q.x, q.z, p.y);
        pts.push(q);
        const dist = Math.hypot(q.x - ctx.cabezaP.x, q.z - ctx.cabezaP.z);
        return { p: q, pts: pts.filter((_, j) => j % 2 === 0 || j === pts.length - 1).slice(0, 32), valido: dist > 0.8 && dist < 16 && ctx.sePuede(q.x, q.y, q.z), mano: M };
      }
      pts.push(sig); p.copy(sig);
    }
    return null;
  }
  /* las cápsulas de las dos manos al buffer de instancias */
  dibujarManos() {
    const g = this.geo, A = g.attributes.iA.array, B = g.attributes.iB.array, R = g.attributes.iR.array, Br = g.attributes.iBr.array;
    let n = 0;
    for (const M of this.manos) {
      if (!M.visible) continue;
      const P = M.p, glow = M.fuerza * M.fuerza;
      for (let h = 0; h < N; h++) {
        const [i, j] = HUESOS[h], k = PALMA.has(h) ? 1.35 : 1, a = n * 3;
        A[a] = P[i * 3]; A[a + 1] = P[i * 3 + 1]; A[a + 2] = P[i * 3 + 2];
        B[a] = P[j * 3]; B[a + 1] = P[j * 3 + 1]; B[a + 2] = P[j * 3 + 2];
        R[n * 2] = RADIO[i] * k; R[n * 2 + 1] = RADIO[j] * k;
        /* el brillo del pellizco, en las dos últimas falanges del pulgar y del índice */
        Br[n * 2] = (j === 4 || j === 8 || j === 3 || j === 7) ? glow : 0; Br[n * 2 + 1] = 1;
        n++;
      }
    }
    g.instanceCount = n;
    for (const a of ['iA', 'iB', 'iR', 'iBr']) { g.attributes[a].needsUpdate = true; g.attributes[a].addUpdateRange?.(0, n * g.attributes[a].itemSize); }
    this.stats.dibujos++;
  }
  /* por ojo, encima de la reproyección (vr-dibujo.js › encima) o en la escena del visor */
  dibujarOjo(r, ojo) { r.render(this.escena, ojo); }
  /* hay algo que dibujar (si no, ni se llama) */
  get algo() { return this.manos.some((m) => m.visible) || this.menu.abierto; }
}
