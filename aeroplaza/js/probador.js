/* ============================================================================
   aeroplaza/js/probador.js — el estudio del probador, copiado de los videos:
   una sala blanca con paneles verde lima y repisas blancas, hexágonos naranjas
   flotando, haces de luz que entran de arriba y el muñeco sobre un pedestal
   blanco con el borde celeste encendido. Es una escena aparte: mientras el
   probador está abierto se dibuja esta en vez del mundo.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Meeple } from './meeple.js';
import { brilloso } from './naturaleza.js';

function texParedes() {
  /* la pared: blanca con paneles verdes redondeados y un filo claro arriba */
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#f4f8f6'; g.fillRect(0, 0, 2048, 512);
  for (let i = 0; i < 8; i++) {
    const x = i * 256 + 22, w = 212;
    const gr = g.createLinearGradient(0, 60, 0, 470); gr.addColorStop(0, '#7ff04a'); gr.addColorStop(1, '#3fcf2f');
    g.fillStyle = gr; g.beginPath(); g.roundRect(x, 70, w, 400, 26); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.roundRect(x + 10, 80, w - 20, 60, 20); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function texHaz() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const v = g.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, 'rgba(255,255,255,0)');
  g.globalCompositeOperation = 'destination-in'; g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

export class Estudio {
  constructor(motor) {
    this.motor = motor;
    const E = this.escena = new THREE.Scene();
    E.background = new THREE.Color('#e9f5ee');
    const pm = new THREE.PMREMGenerator(motor.r);
    E.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    E.environmentIntensity = 0.55;
    this.cam = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    this.cam.position.set(0, 1.3, 3.8); this.cam.lookAt(0, 1.05, 0);   // (a media altura del muñeco con el pedestal y lo de la cabeza)
    /* poca luz: la sala es blanca y con más se quemaba todo (el brillo abría niebla) */
    E.add(new THREE.HemisphereLight('#ffffff', '#cfe8d6', 0.45));
    const sol = new THREE.DirectionalLight('#fffaf0', 1.15); sol.position.set(2.5, 5, 3.5); E.add(sol);
    const contra = new THREE.DirectionalLight('#bfefff', 0.6); contra.position.set(-3, 2.5, -2); E.add(contra);
    /* la sala: una pared curva alrededor, el piso y el techo */
    const pared = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 64, 1, true, Math.PI * 0.55, Math.PI * 0.9), new THREE.MeshStandardMaterial({ map: texParedes(), side: THREE.BackSide, roughness: 0.7, color: '#d8e0dc' }));
    pared.position.set(0, 3, -1.5); E.add(pared);
    const piso = new THREE.Mesh(new THREE.CircleGeometry(9, 64).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#eaf0ec', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }));
    E.add(piso);
    /* la franja naranja del piso, en arco */
    const franja = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.95, 64, 1, Math.PI * 1.05, Math.PI * 0.9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffb52e', emissive: '#ff9d00', emissiveIntensity: 0.25, roughness: 0.4 }));
    franja.position.y = 0.005; E.add(franja);
    /* repisas blancas en la pared */
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.08, 0.45, 2, 0.03), brilloso('#ffffff'));
      const a = -0.55 + i * 0.55; r.position.set(Math.sin(a) * 6.2, 1.3 + (i % 2) * 0.9, -1.5 - Math.cos(a) * 6.2 + 0.3); r.rotation.y = -a; E.add(r);
    }
    /* hexágonos naranjas flotando (un toro de 6 lados es un hexágono) */
    this.hex = [];
    const matHex = new THREE.MeshStandardMaterial({ color: '#ffb52e', emissive: '#ff9500', emissiveIntensity: 0.45, roughness: 0.3 });
    [[1.7, 2.5, -2.2, 0.5], [2.45, 2.05, -2.4, 0.42], [2.1, 3.1, -2.6, 0.38], [-1.9, 2.8, -2.3, 0.46], [-2.6, 2.2, -2.8, 0.36], [-1.3, 3.4, -2.9, 0.3]].forEach(([x, y, z, r], i) => {
      const h = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 6), matHex); h.position.set(x, y, z); h.rotation.z = Math.PI / 6; h.userData.f = i; E.add(h); this.hex.push(h);
    });
    /* los haces de luz que entran de arriba */
    const matHaz = new THREE.MeshBasicMaterial({ map: texHaz(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) { const hz = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 7), matHaz); hz.position.set(-2.5 + i * 1.6, 3.2, -1.2 - i * 0.3); hz.rotation.z = 0.35; E.add(hz); }
    /* el pedestal, con el borde celeste */
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.12, 0.22, 64), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.12, clearcoat: 1 })); ped.position.y = 0.11; E.add(ped);
    this.borde = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.035, 10, 80), new THREE.MeshBasicMaterial({ color: '#9ff6e6' })); this.borde.rotation.x = Math.PI / 2; this.borde.position.y = 0.22; E.add(this.borde);
    const aura = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#b8fff0', transparent: true, opacity: 0.35, depthWrite: false })); aura.position.y = 0.012; E.add(aura);
    /* el festejo al comprar: chispas de colores que saltan del pedestal */
    const nC = 60, gc = new THREE.BufferGeometry(); this.chispas = { p: new Float32Array(nC * 3), v: new Float32Array(nC * 3), t: 0 };
    gc.setAttribute('position', new THREE.BufferAttribute(this.chispas.p, 3)); const col = new Float32Array(nC * 3), c = new THREE.Color();
    for (let i = 0; i < nC; i++) { c.set(['#ffe14a', '#ff6fb0', '#39d6ff', '#56e05a', '#ffffff'][i % 5]); col.set([c.r, c.g, c.b], i * 3); }
    gc.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.puntos = new THREE.Points(gc, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0, depthWrite: false })); this.puntos.frustumCulled = false; E.add(this.puntos);
    this.m = null; this.giro = 0; this.t = 0; this.prueba = false; this.salto = 0;
  }
  mostrar(A, nombre) {
    if (this.m) this.m.quitar();
    this.m = new Meeple(A, nombre); this.m.raiz.position.y = 0.22;
    /* el nombre ya está escrito abajo, en el panel: arriba solo tapaba el sombrero */
    if (this.m.cartel) this.m.cartel.visible = false;
    this.escena.add(this.m.raiz);
  }
  ponerApariencia(A) { if (this.m) this.m.ponerApariencia(A); }
  /* mientras se prueba algo que no se tiene, el borde del pedestal se pone dorado */
  probando(si) { this.prueba = si; }
  festejar() {
    const C = this.chispas; C.t = 1.4; this.salto = 1;
    for (let i = 0; i < C.p.length / 3; i++) { const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2.5; C.p.set([Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9], i * 3); C.v.set([Math.cos(a) * v * 0.4, 3 + Math.random() * 3, Math.sin(a) * v * 0.4], i * 3); }
    if (this.m) this.m.hacerGesto('festejar');
  }
  /* giro: lo que se arrastró; W, H: la pantalla (lógica); libre: lo que deja el panel {x, y, w, h} */
  actualizar(dt, giro, W, H, libre) {
    this.t += dt;
    this.giro += giro * 1.6;
    if (this.m) { this.m.raiz.rotation.y = this.giro; this.m.animar(dt, 'quieto', 0); this.salto = Math.max(0, this.salto - dt * 1.8); this.m.raiz.position.y = 0.22 + Math.sin((1 - this.salto) * Math.PI) * 0.25 * (this.salto > 0 ? 1 : 0); }
    for (const h of this.hex) { h.position.y += Math.sin(this.t * 0.8 + h.userData.f) * dt * 0.05; h.rotation.y = Math.sin(this.t * 0.5 + h.userData.f) * 0.3; }
    if (this.prueba) this.borde.material.color.setHSL(0.12, 1, 0.6 + Math.sin(this.t * 5) * 0.12); else this.borde.material.color.setHSL(0.47, 0.8, 0.72 + Math.sin(this.t * 2) * 0.06);
    const C = this.chispas;
    if (C.t > 0) {
      C.t -= dt;
      for (let i = 0; i < C.p.length; i += 3) { C.v[i + 1] -= 9 * dt; C.p[i] += C.v[i] * dt; C.p[i + 1] = Math.max(0.23, C.p[i + 1] + C.v[i + 1] * dt); C.p[i + 2] += C.v[i + 2] * dt; }
      this.puntos.geometry.attributes.position.needsUpdate = true; this.puntos.material.opacity = Math.min(1, C.t * 2);
    } else this.puntos.material.opacity = 0;
    /* el muñeco va centrado en lo que deja libre el panel y del tamaño que entre ahí (con lo más
       alto que se pueda poner, el arcoíris o las alas): antes el corrimiento era fijo (el 20 % del
       ancho) y en las pantallas angostas el panel lo tapaba. La cámara no se mueve: se corre la
       ventana (setViewOffset) y se abre o cierra el campo */
    const L = libre || { x: 0, y: 0, w: W, h: H }, d = 3.82;
    const tan = Math.max(2.3 * H / (2 * d * 0.86 * Math.max(60, L.h)), 1.9 * H / (2 * d * 0.86 * Math.max(60, L.w)));
    this.cam.aspect = W / H; this.cam.fov = Math.min(80, Math.max(18, 2 * Math.atan(tan) * 180 / Math.PI));
    this.cam.setViewOffset(W, H, W / 2 - (L.x + L.w / 2), H / 2 - (L.y + L.h / 2), W, H);
    this.cam.updateProjectionMatrix();
  }
}
