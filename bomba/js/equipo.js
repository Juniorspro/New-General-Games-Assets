// Lo que se compra y se ve puesto: las cinco bombas, las tres mechas (que se
// queman de verdad: la chispa baja por el hilo y el temporizador digital
// muestra los segundos que quedan) y los cuatro calzados, con llamas en las
// botas cohete y rayos en las zapatillas sónicas.
import * as THREE from '../vendor/three.module.min.js';
import { cajaRedonda, cilindro, esfera, cono, toro, pieza, pc, pcil, pesf, armar, fusionar, pintar } from './geo.js';
import { materialesDe, liso, TIEMPO, conArcoiris } from './material.js';
import { chispa, LETRA } from './texturas.js';

const M = () => materialesDe('equipo');

// ── bombas ─────────────────────────────────────────────────────────────────
// Cada una devuelve { grupo, boca } — la boca es donde va la mecha.
const BOMBAS = {
  agua() {
    const p = [
      pieza(esfera(0.34, 24, 16), 0x3fa9ff, [0, 0.34, 0], [0, 0, 0], [1, 1.08, 1], 'vidrio'),
      pieza(esfera(0.26, 20, 14), 0x1d7fe0, [0, 0.33, 0], [0, 0, 0], [1, 1.06, 1], 'plastico'),
      pieza(cono(0.07, 0.12, 10), 0x1d7fe0, [0, 0.72, 0], [Math.PI, 0, 0]),
      pesf(0.06, 0x1d7fe0, [0, 0.78, 0]),
      pesf(0.07, 0xffffff, [-0.12, 0.5, 0.2], [1, 0.7, 0.6], 'brillo'),
    ];
    return { grupo: armar(p, M()), boca: new THREE.Vector3(0, 0.82, 0), agua: true };
  },
  dinamita() {
    const p = [];
    for (const [x, z] of [[-0.14, 0], [0.14, 0], [0, -0.1], [-0.07, 0.12], [0.07, 0.12]]) {
      p.push(pcil(0.085, 0.085, 0.62, 0xd8322b, [x, 0.34, z]));
      p.push(pcil(0.087, 0.087, 0.04, 0x8a1d18, [x, 0.65, z]));
    }
    p.push(pieza(cilindro(0.27, 0.27, 0.08, 20, true), 0x2b2b33, [0, 0.2, 0.01]));
    p.push(pieza(cilindro(0.27, 0.27, 0.08, 20, true), 0x2b2b33, [0, 0.48, 0.01]));
    // el reloj despertador de dibujito, atado adelante
    p.push(pcil(0.15, 0.15, 0.07, 0xf0f0f4, [0, 0.36, 0.26], [Math.PI / 2, 0, 0]));
    p.push(pieza(toro(0.15, 0.025, 8, 20), 0xc9ced8, [0, 0.36, 0.3], [0, 0, 0], [1, 1, 1], 'metal'));
    p.push(pesf(0.05, 0xc9ced8, [-0.1, 0.5, 0.26], [1, 1, 1], 'metal'));
    p.push(pesf(0.05, 0xc9ced8, [0.1, 0.5, 0.26], [1, 1, 1], 'metal'));
    p.push(pc(0.018, 0.1, 0.02, 0.005, 0x1b1b24, [0, 0.4, 0.3]));
    p.push(pc(0.08, 0.018, 0.02, 0.005, 0x1b1b24, [0.03, 0.36, 0.3]));
    return { grupo: armar(p, M()), boca: new THREE.Vector3(0, 0.68, 0) };
  },
  c4() {
    const p = [
      pc(0.62, 0.36, 0.34, 0.05, 0x7c8a5a, [0, 0.22, 0]),
      pc(0.64, 0.05, 0.36, 0.02, 0x4f5a39, [0, 0.1, 0]),
      pc(0.64, 0.05, 0.36, 0.02, 0x4f5a39, [0, 0.34, 0]),
      pc(0.3, 0.16, 0.06, 0.02, 0x22252c, [0.05, 0.28, 0.19]),
      pieza(cajaRedonda(0.22, 0.08, 0.02, 0.01), 0xff2a2a, [0.05, 0.29, 0.225], [0, 0, 0], [1, 1, 1], 'luz'),
      pesf(0.03, 0x3cff5a, [-0.2, 0.3, 0.19], [1, 1, 1], 'luz'),
    ];
    // cables de colores en arco
    const cables = [[0xff3b30, -0.2], [0x2f6bff, -0.05], [0xffd23a, 0.1]];
    for (const [col, x] of cables) p.push(pieza(toro(0.1, 0.018, 6, 14, Math.PI), col, [x, 0.4, 0], [0, Math.PI / 2, 0]));
    return { grupo: armar(p, M()), boca: new THREE.Vector3(0.18, 0.42, 0) };
  },
  nuclear() {
    const p = [
      pieza(esfera(0.42, 24, 16), 0xf2c21b, [0, 0.46, 0], [0, 0, 0], [1, 1, 1.35]),
      pieza(cono(0.3, 0.3, 20), 0xf2c21b, [0, 0.46, -0.62], [-Math.PI / 2, 0, 0]),
      pcil(0.2, 0.2, 0.3, 0x2b2b33, [0, 0.46, -0.84], [Math.PI / 2, 0, 0]),
      pieza(toro(0.43, 0.035, 8, 28), 0x2b2b33, [0, 0.46, 0.2], [0, 0, 0], [1, 1, 1], 'metal'),
      pieza(toro(0.43, 0.035, 8, 28), 0x2b2b33, [0, 0.46, -0.25], [0, 0, 0], [1, 1, 1], 'metal'),
    ];
    // las aletas de atrás
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      p.push(pieza(cajaRedonda(0.04, 0.34, 0.3, 0.015), 0x2b2b33, [Math.cos(a) * 0.3, 0.46 + Math.sin(a) * 0.3, -0.86], [0, 0, a - Math.PI / 2]));
    }
    // el trébol de radiación en los dos costados
    for (const lado of [-1, 1]) {
      p.push(pcil(0.06, 0.06, 0.02, 0x1b1b24, [lado * 0.415, 0.46, 0.05], [0, 0, Math.PI / 2]));
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + Math.PI / 2;
        p.push(pieza(cilindro(0.16, 0.16, 0.02, 12, false), 0x1b1b24, [lado * 0.41, 0.46 + Math.sin(a) * 0.11, 0.05 + Math.cos(a) * 0.11], [0, 0, Math.PI / 2], [0.5, 1, 0.5]));
      }
    }
    return { grupo: armar(p, M()), boca: new THREE.Vector3(0, 0.88, 0.1) };
  },
  cosmica() {
    const g = new THREE.Group();
    const orbe = new THREE.Mesh(esfera(0.38, 32, 20), conArcoiris(new THREE.MeshStandardMaterial({ color: 0x2a1f6a, roughness: 0.25, metalness: 0.3, emissive: 0x5a2cff, emissiveIntensity: 0.9 }), 0.8));
    orbe.position.y = 0.42;
    const anillo = new THREE.Mesh(toro(0.56, 0.035, 8, 48), liso(0x9ffcff, { brillo: 3.2 }));
    anillo.position.y = 0.42; anillo.rotation.x = 1.2;
    const anillo2 = new THREE.Mesh(toro(0.5, 0.02, 6, 48), liso(0xff7bf2, { brillo: 3 }));
    anillo2.position.y = 0.42; anillo2.rotation.set(0.4, 0.6, 0);
    g.add(orbe, anillo, anillo2);
    g.userData.giran = [anillo, anillo2];
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return { grupo: g, boca: new THREE.Vector3(0, 0.82, 0) };
  },
};
export const TIPOS_BOMBA = Object.keys(BOMBAS);

// ── mechas ─────────────────────────────────────────────────────────────────
// La mecha sabe quemarse: arder(progreso 0→1) acorta el hilo y mueve la chispa.
class Mecha {
  constructor(tipo) {
    this.tipo = tipo;
    this.grupo = new THREE.Group();
    this.punta = new THREE.Vector3();
    if (tipo === 'digital') {
      // pantallita atada adelante: los segundos en rojo
      this.lienzo = document.createElement('canvas');
      this.lienzo.width = 128; this.lienzo.height = 48;
      this.tex = new THREE.CanvasTexture(this.lienzo);
      this.tex.colorSpace = THREE.SRGBColorSpace;
      const caja = new THREE.Mesh(cajaRedonda(0.34, 0.16, 0.08, 0.03), liso(0x22252c));
      const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.1), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
      pantalla.position.z = 0.041;
      caja.add(pantalla);
      caja.position.set(0, -0.12, 0.3);
      this.led = new THREE.Mesh(esfera(0.025, 8, 6), liso(0xff2020, { brillo: 6 }));
      this.led.position.set(0.14, -0.02, 0.3);
      this.grupo.add(caja, this.led);
      this.mostrado = null;
    } else {
      // el hilo: una curva que sale de la boca; se dibuja con tubos cortos
      const largo = tipo === 'polvora' ? 0.5 : 0.22;
      this.curva = new THREE.CatmullRomCurve3(tipo === 'polvora'
        ? [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.14, 0), new THREE.Vector3(0.16, 0.2, 0.03), new THREE.Vector3(0.24, 0.12, 0.02), new THREE.Vector3(0.3, 0.26, 0)]
        : [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.03, 0.1, 0), new THREE.Vector3(0.1, 0.19, 0)]);
      this.largo = largo;
      this.tubo = new THREE.Mesh(new THREE.TubeGeometry(this.curva, 24, tipo === 'polvora' ? 0.026 : 0.018, 6), liso(tipo === 'polvora' ? 0x6b4a2a : 0xd8c49a, { roughness: 0.9 }));
      this.tubo.castShadow = true;
      this.grupo.add(this.tubo);
      this.tubo.geometry.setDrawRange(0, this.tubo.geometry.index.count);
    }
    this.arder(0, 3);
  }

  arder(progreso, segundos) {
    if (this.tipo === 'digital') {
      const s = Math.max(0, segundos).toFixed(1);
      if (s !== this.mostrado) {
        this.mostrado = s;
        const g = this.lienzo.getContext('2d');
        g.fillStyle = '#12060a'; g.fillRect(0, 0, 128, 48);
        g.font = `900 38px ${LETRA}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = segundos < 1 ? '#ff3030' : '#ff5a3a'; g.fillText(s, 64, 26);
        this.tex.needsUpdate = true;
      }
      this.led.visible = Math.sin(TIEMPO.value * (segundos < 1 ? 40 : 12)) > 0;
      this.punta.set(0.14, -0.02, 0.3);
      return;
    }
    // el hilo se acorta desde la punta hacia la boca
    const queda = 1 - Math.min(1, Math.max(0, progreso));
    const idx = this.tubo.geometry.index.count;
    this.tubo.geometry.setDrawRange(0, Math.max(0, Math.floor(idx * queda / 6) * 6));
    this.punta.copy(this.curva.getPointAt(Math.max(0.001, queda)));
  }
}

// Las chispas de la mecha: puntos que saltan de la punta y se apagan.
export class Chispas {
  constructor(escena, n = 48) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.vida = new Float32Array(n);
    this.tam = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aTam', new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tChispa: { value: chispa() }, uEscala: { value: 600 } },
      vertexShader: `attribute float aTam; uniform float uEscala; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aTam * uEscala / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tChispa; void main() { vec4 c = texture2D(tChispa, gl_PointCoord); gl_FragColor = vec4(c.rgb * vec3(4.0, 2.6, 1.2), c.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.puntos = new THREE.Points(g, this.mat);
    this.puntos.frustumCulled = false;
    escena.add(this.puntos);
    this.i = 0;
    this.acum = 0;
  }
  emitir(p, cuantas = 1, fuerza = 1.6) {
    for (let k = 0; k < cuantas; k++) {
      const i = (this.i = (this.i + 1) % this.n);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2, s = fuerza * (0.4 + Math.random());
      this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = 1 + Math.random() * 2.2 * fuerza; this.vel[i * 3 + 2] = Math.sin(a) * s;
      this.vida[i] = 0.25 + Math.random() * 0.35;
    }
  }
  actualizar(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.vida[i] <= 0) { this.tam[i] = 0; continue; }
      this.vida[i] -= dt;
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.tam[i] = Math.max(0, this.vida[i]) * 0.22;
    }
    const g = this.puntos.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aTam.needsUpdate = true;
  }
}

// La bomba armada con su mecha: arriba de todo, un grupo que se pone en las
// manos o se suelta al piso.
export class BombaEnMano {
  constructor(tipoBomba, tipoMecha) {
    const b = BOMBAS[tipoBomba] ? BOMBAS[tipoBomba]() : BOMBAS.agua();
    this.tipo = tipoBomba;
    this.grupo = new THREE.Group();
    this.cuerpo = b.grupo;
    this.grupo.add(this.cuerpo);
    this.mecha = new Mecha(tipoMecha);
    this.mecha.grupo.position.copy(b.boca);
    this.grupo.add(this.mecha.grupo);
    this.puntaMundo = new THREE.Vector3();
    // centro y tamaño: para ponerla en las manos a la altura del pecho
    const caja = new THREE.Box3().setFromObject(this.cuerpo);
    this.alto = caja.max.y - caja.min.y;
    this.centroY = (caja.max.y + caja.min.y) / 2;
  }
  actualizar(dt, progreso, segundos) {
    this.mecha.arder(progreso, segundos);
    this.mecha.grupo.updateMatrixWorld();
    this.puntaMundo.copy(this.mecha.punta).applyMatrix4(this.mecha.grupo.matrixWorld);
    // la bomba late cuando le queda poco
    const late = segundos < 1.2 ? 1 + Math.max(0, Math.sin(TIEMPO.value * 28)) * 0.07 : 1;
    this.cuerpo.scale.setScalar(late);
    for (const a of this.cuerpo.userData.giran || []) a.rotation.z += dt * 2.4;
  }
}

// Un modelo de la bomba sola (para la tienda y los carteles): gira y listo.
export function modeloBomba(tipo) { return (BOMBAS[tipo] || BOMBAS.agua)().grupo; }

// ── calzado ────────────────────────────────────────────────────────────────
// Devuelve una fábrica: el avatar pide uno por pie. El origen es el tobillo.
export function fabricaCalzado(tipo) {
  const Mt = M();
  if (tipo === 'pantuflas') return () => armar([
    pc(0.42, 0.18, 0.56, 0.08, 0xff9ec8, [0, 0.02, 0.06], [0, 0, 0], 'mate'),
    pc(0.44, 0.07, 0.58, 0.03, 0xffffff, [0, -0.06, 0.06], [0, 0, 0], 'mate'),
    pesf(0.08, 0xffffff, [0, 0.12, 0.3], [1, 1, 1], 'mate'),
    pesf(0.05, 0x1b1b24, [-0.08, 0.12, 0.3]), pesf(0.05, 0x1b1b24, [0.08, 0.12, 0.3]),
  ], Mt);
  if (tipo === 'tenis') return () => armar([
    pc(0.4, 0.16, 0.54, 0.06, 0xf4f6fa, [0, 0.02, 0.05]),
    pc(0.42, 0.07, 0.58, 0.03, 0xe8412f, [0, -0.07, 0.06]),
    pc(0.06, 0.1, 0.36, 0.02, 0xe8412f, [0.2, 0.03, 0.04]),
    pc(0.06, 0.1, 0.36, 0.02, 0xe8412f, [-0.2, 0.03, 0.04]),
    pc(0.28, 0.04, 0.1, 0.015, 0x2f6bff, [0, 0.11, 0.2]),
  ], Mt);
  if (tipo === 'botas') return () => {
    const g = armar([
      pc(0.42, 0.26, 0.56, 0.06, 0x9aa3b0, [0, 0.07, 0.05], [0, 0, 0], 'metal'),
      pc(0.44, 0.08, 0.6, 0.03, 0x3a3d45, [0, -0.08, 0.06], [0, 0, 0], 'metal'),
      pcil(0.1, 0.13, 0.14, 0x3a3d45, [0, 0.02, -0.28], [Math.PI / 2, 0, 0], 'metal'),
      pc(0.08, 0.2, 0.08, 0.02, 0xff7a1a, [0.18, 0.1, 0.05], [0, 0, 0], 'brillo'),
      pc(0.08, 0.2, 0.08, 0.02, 0xff7a1a, [-0.18, 0.1, 0.05], [0, 0, 0], 'brillo'),
    ], Mt);
    // la llama del cohete: dos conos que tiemblan (se animan en actualizarCalzado)
    const llama = new THREE.Group();
    const c1 = new THREE.Mesh(cono(0.09, 0.34, 10), liso(0xff8a20, { brillo: 4, transparent: true, opacity: 0.9 }));
    const c2 = new THREE.Mesh(cono(0.05, 0.22, 10), liso(0xfff1b0, { brillo: 6 }));
    for (const c of [c1, c2]) { c.rotation.x = -Math.PI / 2; c.castShadow = false; }
    c1.position.z = -0.52; c2.position.z = -0.46;
    llama.add(c1, c2);
    llama.position.y = 0.02;
    g.add(llama);
    g.userData.llama = llama;
    return g;
  };
  if (tipo === 'sonicas') return () => {
    const g = armar([
      pc(0.42, 0.24, 0.56, 0.08, 0x1f6bff, [0, 0.05, 0.05]),
      pc(0.44, 0.08, 0.6, 0.03, 0xffd23a, [0, -0.08, 0.06], [0, 0, 0], 'metal'),
      pc(0.3, 0.05, 0.12, 0.02, 0xffffff, [0, 0.18, 0.22]),
      // el rayo de los costados
      pieza(cajaRedonda(0.04, 0.2, 0.08, 0.01), 0x7ffcff, [0.215, 0.06, 0.02], [0, 0, 0.5], [1, 1, 1], 'luz'),
      pieza(cajaRedonda(0.04, 0.2, 0.08, 0.01), 0x7ffcff, [-0.215, 0.06, 0.02], [0, 0, -0.5], [1, 1, 1], 'luz'),
      // alitas en el talón
      pieza(cajaRedonda(0.03, 0.14, 0.26, 0.01), 0xffffff, [0.22, 0.16, -0.18], [0.5, 0.2, 0], [1, 1, 1], 'brillo'),
      pieza(cajaRedonda(0.03, 0.14, 0.26, 0.01), 0xffffff, [-0.22, 0.16, -0.18], [0.5, -0.2, 0], [1, 1, 1], 'brillo'),
    ], Mt);
    g.userData.sonicas = true;
    return g;
  };
  return null;
}
export const TIPOS_CALZADO = ['pantuflas', 'tenis', 'botas', 'sonicas'];

// Llamas y chispas del calzado, según la velocidad.
export function actualizarCalzado(avatar, chispas, dt, velocidad) {
  for (const p of [avatar.pI, avatar.pD]) {
    const z = p.calzado;
    if (!z) continue;
    if (z.userData.llama) {
      const k = 0.5 + Math.min(1, velocidad / 6) * 0.8 + Math.random() * 0.25;
      z.userData.llama.scale.set(1, 1, k);
      z.userData.llama.visible = velocidad > 0.5;
      if (velocidad > 0.5 && Math.random() < dt * 25) { z.userData.llama.getWorldPosition(_v); _v.y += 0.05; chispas.emitir(_v, 1, 0.8); }
    }
    if (z.userData.sonicas && velocidad > 2 && Math.random() < dt * 30) { z.getWorldPosition(_v); _v.y += 0.1; chispas.emitir(_v, 1, 0.5); }
  }
}
const _v = new THREE.Vector3();
