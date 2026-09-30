// La intro de JXSTUDIOS en 3D, antes de la playa del menú (tres segundos):
//   0     una raya de luz en lo negro, que se abre como un párpado;
//   0,25  se prende la placa de fibra de carbono, entran las barras de la
//         reja y la cámara gira desde un costado hacia el frente;
//   0,35  el monograma JXS se escribe en cromo: cuatro tubos que crecen con
//         una luz y chispas en la punta (lo recién escrito brilla caliente);
//   1,3   golpe: el monograma salta hacia la cámara, destello, dos ondas,
//         sacudida y una lluvia de chispas;
//   1,45  un brillo cruza el metal en diagonal; suben "JXStudios" y "presenta";
//   2,5   la cámara se mete en el logo y todo se va a blanco: la playa aparece
//         desde el blanco (main.js).
// Arranca sola (main.js espera un instante a que arranque el audio): hasta
// entonces, negro.
// Usa el renderer del juego con escena y cámara propias y a resolución
// completa: el juego dibuja pixelado a propósito, el logo no. La música es
// sonido.js › jingleJXS, con estos mismos tiempos. Un toque la saltea.
import * as THREE from '../vendor/three.module.min.js';
import { TRAZOS, CAJA, GROSOR, muestrear, palabra } from './logojxs.js';

export const T = { raya: 0.3, abre: 0.62, entra: [0.25, 1.05], traza: [0.35, 1.22], golpe: 1.3, brillo: [1.45, 2.05], palabra: 1.5, presenta: 1.85, empuje: 2.5, fin: 3.0, salto: 0.35 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tramo = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const salida = (k) => 1 - (1 - k) ** 3;                  // arranca rápido y frena
const suave = (k) => k * k * (3 - 2 * k);
const lerp = THREE.MathUtils.lerp;

const ESC = 0.01;                          // unidades del logo → metros (3,5 × 1,72)
const RADIO = (GROSOR / 2) * ESC;
const RADIALES = 12;
const ROMBO = 2.0;                         // media diagonal de la ventana de la reja
const Y_LOGO = 0.24;
const Z_REJA = -0.26;

function lienzo(w, h, pintar) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  pintar(c.getContext('2d'), w, h);
  return c;
}

// La fibra de carbono: sarga 2×2 (cada mecha, un rectángulo con brillo a lo
// largo y hebras finas) y su relieve, para que las luces que pasan la
// levanten. 8×8 mechas: la sarga se repite cada 4, así la baldosa cierra.
function texturasCarbono() {
  const N = 128, L = 16;
  const color = document.createElement('canvas'), relieve = document.createElement('canvas');
  color.width = color.height = relieve.width = relieve.height = N;
  const gc = color.getContext('2d'), gr = relieve.getContext('2d');
  const ic = gc.createImageData(N, N), ir = gr.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = Math.floor(x / L), j = Math.floor(y / L), u = ((x % L) + 0.5) / L, v = ((y % L) + 0.5) / L;
    const acostada = ((i + j) >> 1) % 2 === 0;
    const a = acostada ? v : u, lomo = Math.sin(a * Math.PI);
    const hebra = 0.84 + 0.16 * Math.sin((acostada ? u : v) * Math.PI * 12 + (acostada ? j : i) * 1.7);
    const val = ((acostada ? 30 : 21) + 38 * lomo * hebra) * (0.5 + 0.5 * Math.min(1, lomo * 3));
    const k = (y * N + x) * 4;
    ic.data[k] = val; ic.data[k + 1] = val * 1.02; ic.data[k + 2] = val * 1.1; ic.data[k + 3] = 255;
    const pend = Math.cos(a * Math.PI) * 0.8, nx = acostada ? 0 : pend, ny = acostada ? pend : 0;
    ir.data[k] = (nx * 0.5 + 0.5) * 255; ir.data[k + 1] = (ny * 0.5 + 0.5) * 255;
    ir.data[k + 2] = (Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.5 + 0.5) * 255; ir.data[k + 3] = 255;
  }
  gc.putImageData(ic, 0, 0); gr.putImageData(ir, 0, 0);
  return { color: new THREE.CanvasTexture(color), relieve: new THREE.CanvasTexture(relieve) };
}

// Metal cepillado: rayas finas a lo largo, de brillo apenas distinto.
function texturaCepillada() {
  return new THREE.CanvasTexture(lienzo(256, 32, (g, w, h) => {
    g.fillStyle = '#a9aeb7'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const b = 150 + Math.random() * 70;
      g.fillStyle = `rgba(${b},${b + 3},${b + 8},0.55)`; g.fillRect(0, y, w, 1);
      for (let k = 0; k < 6; k++) { const c = Math.random() < 0.5 ? 255 : 90; g.fillStyle = `rgba(${c},${c},${c},0.18)`; g.fillRect(Math.random() * w, y, 20 + Math.random() * 90, 1); }
    }
  }));
}

// Un punto que se apaga hacia el borde (chispas, halos) y la raya de luz.
const texPunto = () => new THREE.CanvasTexture(lienzo(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
}));
const texRaya = () => new THREE.CanvasTexture(lienzo(256, 64, (g, w, h) => {
  const x = g.createLinearGradient(0, 0, w, 0);
  x.addColorStop(0, 'rgba(255,255,255,0)'); x.addColorStop(0.5, 'rgba(255,255,255,1)'); x.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = x; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  const y = g.createLinearGradient(0, 0, 0, h);
  y.addColorStop(0, 'rgba(0,0,0,0)'); y.addColorStop(0.44, 'rgba(0,0,0,0.35)'); y.addColorStop(0.5, 'rgba(0,0,0,1)'); y.addColorStop(0.56, 'rgba(0,0,0,0.35)'); y.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = y; g.fillRect(0, 0, w, h);
}));
const texVineta = () => new THREE.CanvasTexture(lienzo(256, 256, (g) => {
  const gr = g.createRadialGradient(128, 118, 40, 128, 128, 182);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
}));
// Un texto con las letras separadas a mano (letterSpacing no está en todos los navegadores).
function texto(txt, px, color) {
  const f = `600 ${px}px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
  const medir = lienzo(1, 1, () => {}).getContext('2d'); medir.font = f;
  const sep = px * 0.42, ancho = [...txt].reduce((s, ch) => s + medir.measureText(ch).width + sep, -sep);
  return lienzo(Math.ceil(ancho + px), Math.ceil(px * 1.6), (g) => {
    g.font = f; g.fillStyle = color; g.textBaseline = 'middle';
    let x = px / 2;
    for (const ch of txt) { g.fillText(ch, x, px * 0.8); x += g.measureText(ch).width + sep; }
  });
}

// El cromo del monograma: un MeshStandardMaterial con dos agregados en el
// shader. Lo recién escrito brilla como metal caliente y se enfría hacia
// atrás (según la coordenada a lo largo del tubo, `uv.x`), y un brillo que
// cruza en diagonal (según la posición en el mundo).
function materialCromo(ambiente, u) {
  const m = new THREE.MeshStandardMaterial({ color: 0xf1f3f7, metalness: 1, roughness: 0.14, envMap: ambiente, envMapIntensity: 1.15 });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;\nvarying float vLargo;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvPosMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvLargo = uv.x;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMundo;\nvarying float vLargo;\nuniform float uAvance, uCalor, uBrillo, uBarrido;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float calor = uCalor * smoothstep(uAvance - 0.14, uAvance, vLargo);
        gl_FragColor.rgb += calor * calor * vec3(0.55, 0.8, 1.0) * 3.0;
        float d = vPosMundo.x + vPosMundo.y * 0.65 - uBarrido;
        gl_FragColor.rgb += uBrillo * exp(-d * d * 30.0) * vec3(1.0, 0.97, 0.9) * 2.6;`);
  };
  m.customProgramCacheKey = () => 'cromo-jxs';
  return m;
}

export class IntroJXS {
  constructor({ renderer, son, presenta = 'presenta', vibrar = () => {}, alTerminar }) {
    Object.assign(this, { renderer, son, vibrar, alTerminar });
    this.t = -1;                  // menos que cero: todavía no empezó
    this.golpeado = false; this.terminado = false; this.musica = null;
    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 80);
    this._v = new THREE.Vector3(); this._color = new THREE.Color();
    this.armarAmbiente();
    this.armarLuces();
    this.armarPlaca();
    this.armarReja();
    this.armarLogo();
    this.armarTextos(presenta);
    this.armarChispas();
    this.armarCapa();
    this.compilar();
  }

  // ── lo que refleja el cromo: un estudio de fotos con cajas de luz ────────
  armarAmbiente() {
    const esc = new THREE.Scene();
    const cielo = new THREE.CanvasTexture(lienzo(2, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#565d69'); gr.addColorStop(0.47, '#17191d'); gr.addColorStop(0.53, '#0b0c0e'); gr.addColorStop(1, '#030304');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }));
    cielo.colorSpace = THREE.SRGBColorSpace;
    esc.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ map: cielo, side: THREE.BackSide })));
    const caja = (w, h, x, y, z, fuerza, color = 0xffffff) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(fuerza), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); esc.add(m);
    };
    caja(22, 4, 0, 16, 6, 5);                   // una tira larga arriba
    caja(3, 14, -16, 3, 7, 3.2);                // al costado izquierdo
    caja(3, 14, 16, 1, 4, 2.4, 0xcfe2ff);       // al derecho, más fría
    caja(12, 2, 0, -8, 14, 1.6, 0xffe6c8);      // abajo al frente, cálida: el borde de abajo de los tubos
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.rtAmbiente = pm.fromScene(esc, 0.035);
    this.ambiente = this.rtAmbiente.texture;
    pm.dispose();
    esc.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    cielo.dispose();
  }

  armarLuces() {
    this.ambiental = new THREE.AmbientLight(0xffffff, 0);
    this.clave = new THREE.DirectionalLight(0xffffff, 0); this.clave.position.set(-3, 5, 6);
    this.punta = new THREE.PointLight(0xa8d8ff, 0, 3.2, 2);          // sigue a la lapicera
    this.pasa = new THREE.PointLight(0xfff0dc, 0, 5, 2);             // la que cruza el metal con el brillo
    this.escena.add(this.ambiental, this.clave, this.punta, this.pasa);
  }

  armarPlaca() {
    const { color, relieve } = texturasCarbono();
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    // mechas de unos 16 cm: más chicas, a esta distancia se ven como un zigzag
    for (const tx of [color, relieve]) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(24, 14.4); tx.anisotropy = aniso; }
    color.colorSpace = THREE.SRGBColorSpace;
    this.matPlaca = new THREE.MeshStandardMaterial({ map: color, normalMap: relieve, metalness: 0.4, roughness: 0.36, envMap: this.ambiente, envMapIntensity: 0 });
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(30, 18), this.matPlaca);
    placa.position.z = -0.42;
    this.escena.add(placa);
  }

  // La reja de metal cepillado a ±45°, con una ventana en rombo al centro:
  // clipIntersection recorta solo donde recortan los cuatro planos a la vez,
  // que es adentro del rombo. Las barras entran deslizándose a lo largo.
  armarReja() {
    const cep = texturaCepillada();
    cep.wrapS = cep.wrapT = THREE.RepeatWrapping; cep.repeat.set(10, 1); cep.colorSpace = THREE.SRGBColorSpace;
    const s = Math.SQRT1_2;
    const planos = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => new THREE.Plane(new THREE.Vector3(a * s, b * s, 0), -ROMBO * s));
    this.matBarra = new THREE.MeshStandardMaterial({ color: 0xffffff, map: cep, metalness: 1, roughness: 0.3, envMap: this.ambiente, envMapIntensity: 0, clippingPlanes: planos, clipIntersection: true });
    this.matSombra = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, clippingPlanes: planos, clipIntersection: true });
    const geoBarra = new THREE.BoxGeometry(22, 0.085, 0.05), geoSombra = new THREE.PlaneGeometry(22, 0.2);
    this.barras = [];
    for (const lado of [-1, 1]) {
      const grupo = new THREE.Group();
      grupo.rotation.z = (lado * Math.PI) / 4;
      for (let k = -14; k <= 14; k++) {
        const b = new THREE.Mesh(geoBarra, this.matBarra), sb = new THREE.Mesh(geoSombra, this.matSombra);
        b.position.set(0, k * 0.62, Z_REJA + (lado > 0 ? 0.03 : 0));
        sb.position.set(0, k * 0.62 - 0.035, -0.41);
        grupo.add(b, sb);
        this.barras.push({ b, sb, k, lado });
      }
      this.escena.add(grupo);
    }
    // el marco del rombo, en cromo
    this.matMarco = new THREE.MeshStandardMaterial({ color: 0xe8ebf0, metalness: 1, roughness: 0.2, envMap: this.ambiente, envMapIntensity: 0 });
    const lado = ROMBO * Math.SQRT2, geoMarco = new THREE.BoxGeometry(lado + 0.07, 0.07, 0.07);
    for (const [x, y, r] of [[1, 1, -1], [-1, 1, 1], [-1, -1, -1], [1, -1, 1]]) {
      const m = new THREE.Mesh(geoMarco, this.matMarco);
      m.position.set((x * ROMBO) / 2, (y * ROMBO) / 2, Z_REJA + 0.06); m.rotation.z = (r * Math.PI) / 4;
      this.escena.add(m);
    }
  }

  armarLogo() {
    this.logo = new THREE.Group();
    this.logo.position.y = Y_LOGO;
    this.logo.scale.z = 0.6;                 // tubos un poco chatos: más placa de metal que caño
    this.escena.add(this.logo);
    this.uBrillo = { value: 0 }; this.uBarrido = { value: -9 };
    const uTapa = { uAvance: { value: 9 }, uCalor: { value: 0 }, uBrillo: this.uBrillo, uBarrido: this.uBarrido };
    this.matTapa = materialCromo(this.ambiente, uTapa);
    const geoTapa = new THREE.SphereGeometry(RADIO, RADIALES, 8);
    this.texHalo = texPunto();
    this.trazos = TRAZOS.map((tr) => {
      const z = tr.capa ? 0.16 : 0;          // la B pasa por encima de la A en el cruce de la X
      const pts = muestrear(tr, 4).map(([x, y]) => new THREE.Vector3((x - CAJA.w / 2) * ESC, (CAJA.h / 2 - y) * ESC, z));
      const curva = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const segs = Math.max(8, Math.ceil(curva.getLength() / 0.018));
      const u = { uAvance: { value: 0 }, uCalor: { value: 1 }, uBrillo: this.uBrillo, uBarrido: this.uBarrido };
      const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, segs, RADIO, RADIALES, false), materialCromo(this.ambiente, u));
      tubo.geometry.setDrawRange(0, 0);
      const inicio = new THREE.Mesh(geoTapa, this.matTapa), fin = new THREE.Mesh(geoTapa, this.matTapa);
      inicio.position.copy(curva.getPointAt(0)); inicio.visible = fin.visible = false;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texHalo, color: 0xbfe4ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
      halo.scale.setScalar(0.5); halo.visible = false;
      this.logo.add(tubo, inicio, fin, halo);
      return { curva, segs, tubo, u, inicio, fin, halo, avance: 0 };
    });
    // las dos ondas del golpe
    this.ondas = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.position.set(0, Y_LOGO, 0.3); m.visible = false;
      this.escena.add(m);
      return m;
    });
  }

  armarTextos(presenta) {
    const plano = (canvas, ancho, y) => {
      const tx = new THREE.CanvasTexture(canvas); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, (ancho * canvas.height) / canvas.width), new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      m.position.set(0, y, 0.12); this.escena.add(m);
      return m;
    };
    this.palabra = plano(palabra(1024), 2.3, -0.98);
    this.presenta = plano(texto(presenta.toUpperCase(), 64, '#d4d8e0'), 1.3, -1.46);
  }

  // Chispas: un anillo de 800 lugares (la nueva pisa a la más vieja). Las
  // muertas quedan negras, que con mezcla aditiva no se ven.
  armarChispas() {
    const N = 800;
    this.ch = { n: N, cola: 0, pos: new Float32Array(N * 3), vel: new Float32Array(N * 3), col: new Float32Array(N * 3), base: new Float32Array(N * 3), vida: new Float32Array(N), edad: new Float32Array(N).fill(9) };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.ch.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.ch.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.texChispa = texPunto();
    this.puntos = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.055, map: this.texChispa, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.puntos.frustumCulled = false;
    this.escena.add(this.puntos);
  }
  chispa(p, vx, vy, vz, vida, color) {
    const C = this.ch, i = C.cola, k = i * 3;
    C.cola = (C.cola + 1) % C.n;
    C.pos[k] = p.x; C.pos[k + 1] = p.y; C.pos[k + 2] = p.z;
    C.vel[k] = vx; C.vel[k + 1] = vy; C.vel[k + 2] = vz;
    this._color.set(color);
    C.base[k] = this._color.r; C.base[k + 1] = this._color.g; C.base[k + 2] = this._color.b;
    C.vida[i] = vida; C.edad[i] = 0;
  }

  // Lo que va encima de todo, en coordenadas de pantalla: la viñeta, las
  // cortinas negras del principio, la raya, el destello y el blanco final.
  armarCapa() {
    this.capa = new THREE.Scene();
    this.camCapa = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    let orden = 0;
    const quad = (op) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false, ...op }));
      m.frustumCulled = false; m.renderOrder = orden++; this.capa.add(m);
      return m;
    };
    this.vineta = quad({ map: texVineta() });
    this.cortinaA = quad({ color: 0x000000 });
    this.cortinaB = quad({ color: 0x000000 });
    this.raya = quad({ map: texRaya(), blending: THREE.AdditiveBlending, opacity: 0 });
    this.destello = quad({ color: 0xffffff, opacity: 0 });
    this.blanco = quad({ color: 0xffffff, opacity: 0 });
  }

  // ── el tiempo ─────────────────────────────────────────────────────────────
  empezar() {
    if (this.t >= 0) return;
    this.t = 0;
    this.musica = this.son.jingleJXS ? this.son.jingleJXS() : null;
  }
  saltear() {
    if (this.t < T.salto || this.terminado) return;
    this.musica?.cortar();
    this.t = Math.max(this.t, T.fin);
  }

  actualizar(dt) {
    if (this.terminado) return;
    if (this.t < 0) return;
    this.t += dt;
    const t = this.t;
    this.logo.updateMatrixWorld(true);
    // los trazos: los cuatro a la vez, apenas escalonados, y suaves al empezar y al terminar
    this.trazos.forEach((z, i) => {
      const k = tramo(t, T.traza[0] + i * 0.045, T.traza[1] - (3 - i) * 0.03);
      z.avance = suave(k);
      if (z.avance > 0 && z.avance < 1) {
        const p = this.logo.localToWorld(this._v.copy(z.curva.getPointAt(z.avance)));
        for (let n = 0; n < 3; n++) {
          const a = Math.random() * Math.PI * 2, v = 0.4 + Math.random() * 1.4;
          this.chispa(p, Math.cos(a) * v, Math.sin(a) * v + 0.5, Math.random() * 1.2, 0.25 + Math.random() * 0.35, Math.random() < 0.6 ? 0xffffff : 0x9fdcff);
        }
      }
    });
    if (!this.golpeado && t >= T.golpe) {
      this.golpeado = true;
      this.vibrar([30, 20, 50]);
      // la lluvia sale de todo el largo del monograma, hacia afuera y hacia la cámara
      for (let n = 0; n < 260; n++) {
        const z = this.trazos[n % 4], p = this.logo.localToWorld(this._v.copy(z.curva.getPointAt(Math.random())));
        const a = Math.atan2(p.y - Y_LOGO, p.x) + (Math.random() - 0.5) * 1.2, v = 1 + Math.random() * 4;
        this.chispa(p, Math.cos(a) * v, Math.sin(a) * v, 1 + Math.random() * 4, 0.5 + Math.random() * 0.8, [0xffffff, 0xffe7a8, 0xc9ccd4, 0x9fdcff][n % 4]);
      }
    }
    const C = this.ch, arr = Math.exp(-dt * 2.2);
    for (let i = 0; i < C.n; i++) {
      const k = i * 3;
      if (C.edad[i] >= C.vida[i]) { C.col[k] = C.col[k + 1] = C.col[k + 2] = 0; continue; }
      C.edad[i] += dt;
      C.vel[k] *= arr; C.vel[k + 1] = C.vel[k + 1] * arr - 3.2 * dt; C.vel[k + 2] *= arr;
      C.pos[k] += C.vel[k] * dt; C.pos[k + 1] += C.vel[k + 1] * dt; C.pos[k + 2] += C.vel[k + 2] * dt;
      const f = Math.max(0, 1 - C.edad[i] / C.vida[i]) ** 1.5;
      C.col[k] = C.base[k] * f; C.col[k + 1] = C.base[k + 1] * f; C.col[k + 2] = C.base[k + 2] * f;
    }
    this.puntos.geometry.attributes.position.needsUpdate = true;
    this.puntos.geometry.attributes.color.needsUpdate = true;
    if (t >= T.fin + 0.05) { this.terminado = true; this.alTerminar?.(); }
  }

  // ── la pose de cada cosa en este instante ─────────────────────────────────
  poner(aspecto) {
    const t = Math.max(0, this.t), c = this.camara;
    // la cámara: que entren el rombo y el logo con aire, parado o acostado
    c.aspect = aspecto;
    const tanV = Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
    // que entren el logo, la palabra y "presenta" (unos 2,7 m de alto y 3,5 de
    // ancho) con aire: el rombo puede quedar cortado arriba y abajo
    const d = Math.max(3.4 / (2 * tanV), 4.4 / (2 * tanV * aspecto));
    const llega = salida(tramo(t, 0.25, T.golpe));
    let giro = lerp(0.5, 0, llega), alza = lerp(0.22, 0.04, llega), dist = d * lerp(1.35, 1, llega);
    if (t > T.golpe) giro -= 0.05 * suave(tramo(t, T.golpe, T.empuje));    // nunca queda quieta del todo
    dist *= 1 - 0.8 * tramo(t, T.empuje, T.fin) ** 2.2;
    c.position.set(Math.sin(giro) * Math.cos(alza) * dist, Math.sin(alza) * dist, Math.cos(giro) * Math.cos(alza) * dist);
    const sac = t > T.golpe && t < T.golpe + 0.45 ? (1 - (t - T.golpe) / 0.45) ** 2 * 0.07 : 0;
    if (sac) c.position.add(this._v.set((Math.random() - 0.5) * sac, (Math.random() - 0.5) * sac, 0));
    c.lookAt(0, -0.2 * llega, 0);
    c.updateProjectionMatrix();
    // lookAt no rehace las matrices: sin esto, project() de abajo usaría la pose vieja
    c.updateMatrixWorld();

    // las luces: de la penumbra a todo prendido
    const luz = salida(tramo(t, 0.28, 0.95));
    this.ambiental.intensity = 0.12 + 0.3 * luz;
    this.clave.intensity = 0.25 + 2.1 * luz;
    this.matPlaca.envMapIntensity = 0.12 + 0.45 * luz;
    this.matBarra.envMapIntensity = this.matMarco.envMapIntensity = 0.15 + 0.95 * luz;
    const b = tramo(t, T.brillo[0], T.brillo[1]);
    this.pasa.intensity = b > 0 && b < 1 ? 7 * Math.sin(b * Math.PI) : 0;
    this.pasa.position.set(lerp(-3.5, 3.5, b), Y_LOGO + lerp(1.2, -0.6, b), 0.8);

    // las barras entran a lo largo, de a una, desde afuera
    for (const { b, sb, k, lado } of this.barras) {
      const e = salida(tramo(t, T.entra[0] + Math.abs(k) * 0.012, T.entra[1] + Math.abs(k) * 0.012));
      b.position.x = sb.position.x = (1 - e) * 26 * (k % 2 ? 1 : -1) * lado;
      b.visible = sb.visible = e > 0;
    }

    // el monograma: se escribe, salta con el golpe, brilla
    const golpe = t >= T.golpe ? t - T.golpe : -1;
    const salto = golpe >= 0 ? 0.3 * Math.exp(-golpe * 7) : 0;
    this.logo.position.z = salto + (golpe >= 0 ? 0.06 * suave(tramo(golpe, 0, 0.4)) : 0);
    this.logo.scale.set(1 + salto * 0.25, 1 + salto * 0.25, 0.6);
    this.logo.rotation.y = lerp(-0.14, 0, salida(tramo(t, T.traza[0], T.golpe)));
    this.logo.updateMatrixWorld(true);
    let puntas = 0;
    const tip = this._v.set(0, 0, 0);
    for (const z of this.trazos) {
      const n = Math.floor(z.avance * z.segs);
      z.tubo.geometry.setDrawRange(0, n * RADIALES * 6);
      z.u.uAvance.value = z.avance;
      z.u.uCalor.value = 1 - tramo(t, T.traza[1], T.traza[1] + 0.45);
      z.inicio.visible = z.avance > 0;
      z.fin.visible = z.avance > 0.02;
      z.fin.position.copy(z.curva.getPointAt(z.avance));
      z.halo.visible = z.avance > 0 && z.avance < 1;
      if (z.halo.visible) { z.halo.position.copy(z.fin.position); z.halo.position.z += 0.05; tip.add(z.fin.position); puntas++; }
    }
    this.punta.intensity = puntas ? 3.5 : 0;
    if (puntas) { this.logo.localToWorld(tip.multiplyScalar(1 / puntas)); this.punta.position.set(tip.x, tip.y, tip.z + 0.35); }
    const br = tramo(t, T.brillo[0], T.brillo[1]);
    this.uBrillo.value = br > 0 && br < 1 ? Math.sin(br * Math.PI) : 0;
    this.uBarrido.value = lerp(-3.4, 3.4, br);
    this.ondas.forEach((o, i) => {
      const k = golpe >= 0 ? tramo(golpe, i * 0.08, 0.55 + i * 0.12) : 0;
      o.visible = k > 0 && k < 1;
      o.scale.setScalar(0.4 + salida(k) * (3.4 + i * 1.2));
      o.material.opacity = (1 - k) ** 2 * (i ? 0.45 : 0.8);
    });
    const kp = salida(tramo(t, T.palabra, T.palabra + 0.45));
    this.palabra.material.opacity = kp;
    this.palabra.position.y = -0.98 - (1 - kp) * 0.22;
    this.presenta.material.opacity = tramo(t, T.presenta, T.presenta + 0.35) * 0.9;

    // la capa de arriba: la raya y el párpado, el destello y el blanco
    const yc = this._v.set(0, Y_LOGO, 0).project(c).y;
    const abre = t < T.raya ? 0 : salida(tramo(t, T.raya, T.abre));
    const alto = abre * 2.2;
    this.cortinaA.visible = this.cortinaB.visible = abre < 1;
    this.cortinaA.scale.y = Math.max(0.0001, (1 - (yc + alto)) / 2); this.cortinaA.position.y = (1 + yc + alto) / 2;
    this.cortinaB.scale.y = Math.max(0.0001, (yc - alto + 1) / 2); this.cortinaB.position.y = (yc - alto - 1) / 2;
    const r = 1 - tramo(t, T.raya, T.abre);
    this.raya.material.opacity = r;
    this.raya.scale.set(salida(tramo(t, 0, T.raya * 0.8)) * 1.1 + 0.001, 0.07, 1);
    this.raya.position.y = yc;
    this.destello.material.opacity = golpe >= 0 && golpe < 0.4 ? (1 - golpe / 0.4) ** 2 * 0.7 : 0;
    this.blanco.material.opacity = tramo(t, T.empuje + 0.15, T.fin) ** 1.6;
  }

  // El estado del renderer de la intro (tono ACES, recorte, fondo negro),
  // solo mientras dura `fn`: el juego dibuja con el suyo.
  conEstado(fn) {
    const r = this.renderer;
    const antes = { tm: r.toneMapping, exp: r.toneMappingExposure, clip: r.localClippingEnabled, color: r.getClearColor(new THREE.Color()), alfa: r.getClearAlpha() };
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.localClippingEnabled = true;
    r.setClearColor(0x000000, 1);
    try { fn(r); } finally {
      r.toneMapping = antes.tm; r.toneMappingExposure = antes.exp; r.localClippingEnabled = antes.clip;
      r.setClearColor(antes.color, antes.alfa);
    }
  }

  // Todo compilado de una vez al armarla, con el mismo estado del renderer
  // (tono y recorte son parte de la clave del programa): si no, lo que
  // aparece por primera vez (las puntas, los halos, las ondas del golpe)
  // traba un cuadro justo cuando se luce.
  compilar() {
    this.conEstado((r) => {
      const ocultos = [];
      this.escena.traverse((o) => { if (!o.visible) { ocultos.push(o); o.visible = true; } });
      r.compile(this.escena, this.camara);
      r.compile(this.capa, this.camCapa);
      for (const o of ocultos) o.visible = false;
    });
  }

  dibujar(w, h) {
    this.conEstado((r) => {
      r.clear();
      if (this.t < 0) return;                  // todavía no empezó: negro
      this.poner(w / h);
      r.render(this.escena, this.camara);
      r.clearDepth();
      r.render(this.capa, this.camCapa);
    });
  }

  // Todo lo de la intro sale de la memoria de la placa de video.
  liberar() {
    const tex = new Set();
    for (const esc of [this.escena, this.capa]) esc.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) { for (const k of ['map', 'normalMap']) if (m[k]) tex.add(m[k]); m.dispose(); }
    });
    for (const x of tex) x.dispose();
    this.rtAmbiente.dispose();
  }
}
