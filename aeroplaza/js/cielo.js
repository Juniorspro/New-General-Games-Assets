/* ============================================================================
   aeroplaza/js/cielo.js — el cielo, el sol, la luna, las estrellas, la aurora,
   las nubes y la luz del día.
   La hora sale del reloj de la computadora (Date.now), así TODOS los que están
   jugando ven la misma hora sin que haya un servidor: un día dura 20 minutos,
   con 13 de sol y 7 de noche.
   Cada reino puede fijar la hora (la Aurora es siempre de noche) y la fuerza
   de la aurora.
   ========================================================================== */
import * as THREE from 'three';

export const CICLO = 20 * 60;
export function horaGlobal() { return ((Date.now() / 1000) / CICLO + 0.18) % 1; }

const CIELO_VS = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const CIELO_FS = /* glsl */`
  uniform vec3 uSol, uLuna, uCenit, uHorizonte, uAtar;
  uniform float uDia, uAtardecer, uAurora, uT, uEstrellas;
  varying vec3 vDir;
  float h13(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = h13(vec3(i, 1.0)), b = h13(vec3(i + vec2(1, 0), 1.0)), c = h13(vec3(i + vec2(0, 1), 1.0)), d = h13(vec3(i + vec2(1, 1), 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float haciaSol = max(dot(normalize(d.xz + 1e-4), normalize(uSol.xz + 1e-4)), 0.0);
    float t = pow(1.0 - max(h, 0.0), 3.2);
    vec3 hor = mix(uHorizonte, uAtar, uAtardecer * (0.35 + 0.65 * haciaSol * haciaSol));
    vec3 col = mix(uCenit, hor, t);
    /* abajo del horizonte: la bruma del mar */
    if (h < 0.0) col = mix(hor, uHorizonte * 0.7, smoothstep(0.0, -0.3, h));
    /* el sol, con su halo grande y blando (para que el bloom lo abra en flare) */
    float s = max(dot(d, uSol), 0.0);
    col += vec3(1.0, 0.92, 0.75) * (smoothstep(0.9993, 0.9997, s) * 24.0 + pow(s, 280.0) * 2.2 + pow(s, 12.0) * 0.28) * smoothstep(-0.1, 0.05, uSol.y);
    /* la luna, con manchas */
    float l = dot(d, uLuna);
    if (l > 0.9985) {
      vec3 p = d * 400.0;
      float m = 0.75 + 0.25 * ruido(p.xy * 0.6 + p.z * 0.3);
      col = mix(col, vec3(0.95, 0.97, 1.0) * 2.2 * m, smoothstep(0.9985, 0.99875, l) * (1.0 - uDia * 0.6));
    }
    col += vec3(0.5, 0.65, 1.0) * pow(max(l, 0.0), 60.0) * 0.35 * (1.0 - uDia);
    /* las estrellas: una por celda de una grilla sobre la esfera, que titilan */
    if (uEstrellas > 0.01 && h > -0.05) {
      vec3 p = d * 220.0; vec3 c = floor(p); float r = h13(c);
      if (r > 0.985) {
        vec3 o = vec3(h13(c + 3.1), h13(c + 7.7), h13(c + 1.3)) - 0.5;
        float q = length(fract(p) - 0.5 - o * 0.6);
        float tit = 0.6 + 0.4 * sin(uT * (1.5 + r * 5.0) + r * 60.0);
        col += vec3(0.85 + o.x, 0.9, 1.0 - o.x * 0.5) * smoothstep(0.12, 0.0, q) * tit * 2.5 * uEstrellas * smoothstep(-0.05, 0.2, h);
      }
    }
    /* la aurora: cortinas que se mueven, verdes abajo y violetas arriba */
    if (uAurora > 0.01 && h > 0.0) {
      vec2 q = d.xz / (h + 0.18);
      vec3 a = vec3(0.0);
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float y = q.y * 0.55 + fi * 0.55 - 0.9 + sin(q.x * 0.35 + uT * 0.07 + fi * 2.1) * 0.6 + sin(q.x * 1.1 - uT * 0.13 + fi) * 0.15;
        float banda = exp(-y * y * 9.0);
        float rayos = 0.55 + 0.45 * ruido(vec2(q.x * 7.0 + fi * 13.0 + uT * 0.4, fi));
        a += mix(vec3(0.1, 1.0, 0.55), vec3(0.65, 0.3, 1.0), clamp(h * 1.8 + fi * 0.12, 0.0, 1.0)) * banda * rayos;
      }
      col += a * uAurora * 0.9 * smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.7, 1.0, h));
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

/* una nube de repuesto, dibujada (si la de Rezona no está) */
function nubeDibujada(sem) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  let s = sem; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const x = 90 + rnd() * 330, y = 120 + (rnd() - 0.5) * 60 - Math.sin((x - 90) / 330 * Math.PI) * 50, r = 30 + rnd() * 55;
    const gr = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(236,246,255,0.95)'); gr.addColorStop(1, 'rgba(210,230,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Cielo {
  constructor(motor, texturasNube = []) {
    this.motor = motor;
    const U = this.U = {
      uSol: { value: new THREE.Vector3(0, 1, 0) }, uLuna: { value: new THREE.Vector3(0, -1, 0) },
      uCenit: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() }, uAtar: { value: new THREE.Color('#ff9a6b') },
      uDia: { value: 1 }, uAtardecer: { value: 0 }, uAurora: { value: 0 }, uT: { value: 0 }, uEstrellas: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: CIELO_VS, fragmentShader: CIELO_FS, side: THREE.BackSide, depthWrite: false, fog: false });
    this.domo = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.domo.frustumCulled = false; this.domo.renderOrder = -10;
    motor.escena.add(this.domo);
    /* lo mismo, chiquito, para el mapa de reflejos (el vidrio y la gelatina reflejan el cielo) */
    this.escenaRefl = new THREE.Scene();
    this.escenaRefl.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
    const piso = new THREE.Mesh(new THREE.CircleGeometry(9, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#5fb04a' }));
    piso.position.y = -1.2; this.escenaRefl.add(piso); this.pisoRefl = piso;
    this.pmrem = new THREE.PMREMGenerator(motor.r);
    this.tRefl = 99; this.env = null;

    /* la luz */
    const sol = this.sol = motor.sol = new THREE.DirectionalLight('#fff4e0', 2.6);
    sol.castShadow = motor.Q.sombra > 0;
    sol.shadow.mapSize.set(motor.Q.sombra || 512, motor.Q.sombra || 512);
    const S = sol.shadow.camera; S.left = -28; S.right = 28; S.top = 28; S.bottom = -28; S.near = 1; S.far = 160;
    sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.03;
    motor.escena.add(sol, sol.target);
    this.hemi = new THREE.HemisphereLight('#bfe6ff', '#6fb34a', 0.9);
    motor.escena.add(this.hemi);
    motor.escena.fog = new THREE.Fog('#bfe6ff', 140, 950);

    /* las nubes: carteles grandes que dan la vuelta despacio */
    this.nubes = new THREE.Group(); motor.escena.add(this.nubes);
    const tex = texturasNube.length ? texturasNube : [nubeDibujada(7), nubeDibujada(91), nubeDibujada(333)];
    this.matsNube = tex.map((t) => new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }));
    for (let i = 0; i < 30; i++) {
      const s = new THREE.Sprite(this.matsNube[i % this.matsNube.length]);
      const a = (i / 30) * Math.PI * 2 + Math.sin(i * 7.1) * 0.3, r = 380 + (i * 97) % 380;
      const esc = 110 + (i * 53) % 120;
      s.userData = { a, r, y: 70 + (i * 37) % 150, v: 0.004 + (i % 5) * 0.001 };
      s.scale.set(esc, esc * 0.52, 1);
      s.renderOrder = -5;
      this.nubes.add(s);
    }
    this.modo = { hora: null, aurora: 0, nubes: 1 };
    this.hora = 0.5;
    this.colSol = new THREE.Color(); this.colCielo = new THREE.Color();
  }
  ponerModo(m) { this.modo = { hora: null, aurora: 0, nubes: 1, ...m }; this.tRefl = 99; this.nubes.visible = this.modo.nubes > 0; }
  actualizar(dt, centro) {
    const U = this.U;
    U.uT.value += dt;
    const hora = this.hora = this.modo.hora ?? horaGlobal();
    const ang = (hora - 0.25) * Math.PI * 2;
    const sol = U.uSol.value.set(Math.cos(ang), Math.sin(ang) + 0.28, 0.42).normalize();
    U.uLuna.value.set(-Math.cos(ang) * 0.9, -Math.sin(ang) + 0.34, -0.5).normalize();
    const dia = THREE.MathUtils.smoothstep(sol.y, -0.12, 0.28);
    const atar = Math.max(0, 1 - Math.abs(sol.y - 0.06) / 0.2);
    this.dia = dia; this.atardecer = atar;
    U.uDia.value = dia; U.uAtardecer.value = atar;
    U.uEstrellas.value = 1 - THREE.MathUtils.smoothstep(sol.y, -0.1, 0.12);
    U.uAurora.value = Math.max(this.modo.aurora, 0);
    const cenit = U.uCenit.value.setRGB(0.012, 0.02, 0.07).lerp(new THREE.Color(0.06, 0.32, 0.92), dia);
    cenit.lerp(new THREE.Color(0.2, 0.22, 0.52), atar * 0.45);
    const hor = U.uHorizonte.value.setRGB(0.04, 0.08, 0.2).lerp(new THREE.Color(0.55, 0.82, 1.0), dia);
    /* el sol, o la luna de noche, es la luz principal (una sola sombra) */
    const esNoche = sol.y < 0.02;
    const dir = esNoche ? U.uLuna.value : sol;
    const c = centro || new THREE.Vector3();
    this.sol.position.copy(c).addScaledVector(dir, 80);
    this.sol.target.position.copy(c);
    if (esNoche) { this.sol.color.set('#9fb8ff'); this.sol.intensity = 0.55 * THREE.MathUtils.smoothstep(dir.y, 0.0, 0.25); }
    else { this.sol.color.set('#fff2dc').lerp(new THREE.Color('#ff9a55'), atar * 0.8); this.sol.intensity = 2.1 * THREE.MathUtils.smoothstep(sol.y, 0.0, 0.2); }
    this.hemi.color.copy(hor).lerp(new THREE.Color(1, 1, 1), 0.5);
    this.hemi.groundColor.set('#4a7a30').multiplyScalar(0.3 + dia * 0.7);
    this.hemi.intensity = 0.18 + dia * 0.32;
    /* la Aurora es de noche siempre: la nieve se ilumina con un ambiente azul propio */
    if (this.modo.hemi) { this.hemi.intensity = this.modo.hemi; this.hemi.color.set(this.modo.hemiColor || '#ffffff'); }
    const niebla = this.motor.escena.fog;
    niebla.color.copy(hor).lerp(U.uAtar.value, atar * 0.35);
    /* las nubes giran y se tiñen con la hora */
    const tinte = new THREE.Color(1, 1, 1).lerp(new THREE.Color('#ffc2a8'), atar * 0.7).multiplyScalar(0.18 + dia * 0.85);
    if (this.modo.aurora > 0.3) tinte.multiplyScalar(0.5);
    for (const m of this.matsNube) m.color.copy(tinte);
    for (const s of this.nubes.children) {
      const u = s.userData; u.a += u.v * dt * 0.3;
      s.position.set(c.x + Math.cos(u.a) * u.r, u.y, c.z + Math.sin(u.a) * u.r);
    }
    this.domo.position.copy(this.motor.camara.position);
    /* el mapa de reflejos: se rehace cada tanto (cuesta un cubo chico) */
    this.tRefl += dt;
    if (this.tRefl > 8) {
      this.tRefl = 0;
      this.pisoRefl.material.color.set('#5fb04a').multiplyScalar(0.15 + dia * 0.85);
      const nuevo = this.pmrem.fromScene(this.escenaRefl, 0.02);
      if (this.env) this.env.dispose();
      this.env = nuevo;
      this.motor.escena.environment = nuevo.texture;
      this.motor.escena.environmentIntensity = 0.3 + dia * 0.4;
    }
    this.motor.r.toneMappingExposure = 1.0 + (1 - dia) * 0.25;
  }
}
