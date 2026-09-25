/* ============================================================================
   aeroplaza/js/cielo.js — el cielo, el sol, la luna, las estrellas, la aurora,
   las nubes y la luz del día.
   La hora sale del reloj de la computadora (Date.now), así TODOS los que están
   jugando ven la misma hora sin que haya un servidor (Date.now es igual en
   todo el mundo, no depende de la hora de cada país): una vuelta dura 10
   minutos, 5 de día y 5 de noche (pedido del 25/09).
   Cada reino puede fijar la hora (la Aurora es siempre de noche) y la fuerza
   de la aurora.
   ========================================================================== */
import * as THREE from 'three';

export const CICLO = 10 * 60;
export function horaGlobal() { return ((Date.now() / 1000) / CICLO + 0.18) % 1; }

const CIELO_VS = /* glsl */`
  varying vec3 vDir;
  void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const CIELO_FS = /* glsl */`
  uniform vec3 uSol, uLuna, uCenit, uHorizonte, uAtar;
  uniform float uDia, uAtardecer, uAurora, uT, uEstrellas, uHayPano, uNubes, uArco;
  uniform sampler2D uPano;
  varying vec3 vDir;
  float h13(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float a = h13(vec3(i, 1.0)), b = h13(vec3(i + vec2(1, 0), 1.0)), c = h13(vec3(i + vec2(0, 1), 1.0)), d = h13(vec3(i + vec2(1, 1), 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * ruido(p); p = p * 2.03 + vec2(17.1, 3.7); a *= 0.5; } return v; }
  float fbm3(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * ruido(p); p = p * 2.07 + vec2(5.3, 11.9); a *= 0.5; } return v; }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float haciaSol = max(dot(normalize(d.xz + 1e-4), normalize(uSol.xz + 1e-4)), 0.0);
    float t = pow(1.0 - max(h, 0.0), 3.2);
    vec3 hor = mix(uHorizonte, uAtar, uAtardecer * (0.35 + 0.65 * haciaSol * haciaSol));
    vec3 col = mix(uCenit, hor, t);
    /* abajo del horizonte: la bruma del mar */
    if (h < 0.0) col = mix(hor, uHorizonte * 0.7, smoothstep(0.0, -0.3, h));
    /* la vía láctea: una franja de ruido celeste y violeta que cruza el cielo de noche */
    if (uEstrellas > 0.01 && h > 0.0) {
      float b = dot(d, normalize(vec3(0.55, 0.35, -0.76)));
      float nube = ruido(d.xz / (h + 0.4) * 6.0) * 0.6 + ruido(d.xz / (h + 0.4) * 17.0) * 0.4;
      col += mix(vec3(0.18, 0.3, 0.75), vec3(0.45, 0.25, 0.7), nube) * exp(-b * b * 22.0) * nube * 0.22 * uEstrellas * smoothstep(0.0, 0.3, h);
    }
    float tapa = 0.0;   // cuánto tapan las nubes del panorama (para el arcoíris)
    /* el panorama de nubes de Rezona alrededor del horizonte: cuatro copias
       hasta 52° de alto. La foto se hizo repetible (los bordes fundidos): antes
       iba espejada y en cada unión salía una nube simétrica, como una mancha de
       Rorschach. Lo blanco es nube y se tiñe con la hora; lo azul de la foto se
       mezcla solo de día */
    if (uHayPano > 0.5 && h > -0.02) {
      float el = asin(clamp(h, 0.0, 1.0)) / 0.9;
      vec2 uv = vec2((atan(d.x, d.z) / 6.2831853 + 0.5) * 4.0, el * 0.97 + 0.025);
      if (uv.y < 1.0) {
        vec3 p = texture2D(uPano, uv).rgb;
        float mx = max(p.r, max(p.g, p.b)), mn = min(p.r, min(p.g, p.b));
        float blanco = smoothstep(0.42, 0.85, mn / max(mx, 1e-3)) * uNubes;
        float arriba = 1.0 - smoothstep(0.62, 0.98, uv.y);
        vec3 tNube = mix(vec3(0.07, 0.1, 0.22), vec3(1.0), uDia);
        tNube = mix(tNube, vec3(1.25, 0.72, 0.62), uAtardecer * 0.7);
        col = mix(col, p, 0.5 * uDia * (1.0 - uAtardecer) * arriba * (1.0 - blanco) * uNubes);
        col = mix(col, p * tNube, blanco * arriba);
        tapa = blanco * arriba;
      }
    }
    /* las nubes de arriba (25/09: antes eran carteles con la foto de una nube, con
       borde rosado y una cortada a los costados): cúmulos de ruido sobre un techo
       plano, que el viento corre. Se ilumina mirando hacia el sol (lo que queda
       de espaldas al sol es la panza gris azulada), con el borde plateado cerca
       del sol, y se funden en el horizonte, donde ya está el panorama */
    if (uNubes > 0.01 && h > 0.015) {
      vec2 q = d.xz / (h + 0.08);
      vec2 p = q * 0.42 + vec2(uT * 0.006, uT * 0.0022);
      vec2 wq = vec2(fbm3(p * 0.7 + 3.0), fbm3(p * 0.7 + 8.3)) - 0.5;
      vec2 pw = p + wq * 1.1;
      float den = fbm(pw);
      float cob = 0.53 + 0.05 * sin(uT * 0.01);
      float c = smoothstep(cob, cob + 0.2, den);
      if (c > 0.001) {
        vec2 sd = normalize(uSol.xz + 1e-4) * 0.09;
        float luz = clamp(0.55 + (den - fbm(pw + sd)) * 4.0, 0.0, 1.0);
        float borde = 1.0 - smoothstep(cob, cob + 0.1, den);
        vec3 blanco = mix(vec3(0.08, 0.11, 0.24), vec3(1.0), uDia);
        blanco = mix(blanco, vec3(1.25, 0.74, 0.62), uAtardecer * 0.75);
        vec3 panza = blanco * mix(vec3(0.55, 0.62, 0.8), vec3(0.74, 0.82, 0.96), uDia);
        vec3 cn = mix(panza, blanco * 1.06, luz);
        cn += vec3(1.0, 0.95, 0.82) * pow(max(dot(d, uSol), 0.0), 6.0) * borde * 1.2 * uDia;
        float fade = smoothstep(0.015, 0.2, h) * (1.0 - tapa * 0.85);
        col = mix(col, cn, c * fade * uNubes * 0.96);
        tapa = max(tapa, c * fade);
      }
    }
    /* el arcoíris sobre el mar del norte (el de los fondos de 2007): un anillo de
       ~36° alrededor de un punto justo abajo del horizonte; las nubes del panorama lo tapan */
    if (uArco > 0.01 && h > -0.02) {
      float a = acos(clamp(dot(d, normalize(vec3(0.3, -0.12, -1.0))), -1.0, 1.0));
      float x = (a - 0.6) / 0.075;
      if (x > 0.0 && x < 1.0) {
        vec3 arco = clamp(abs(mod((1.0 - x) * 4.6 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        col += arco * 0.9 * (1.0 - tapa * 0.7) * uArco * sin(x * 3.14159) * smoothstep(-0.02, 0.12, h) * (1.0 - smoothstep(0.35, 0.6, h));
      }
    }

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

/* el destello del sol: discos, anillos y hexágonos sobre la línea que va del
   sol al centro de la pantalla (el "lens flare" de los fondos de 2007) */
function texDestello(tipo) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (tipo === 'disco') { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,250,220,0.6)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  else if (tipo === 'anillo') { const r = g.createRadialGradient(64, 64, 40, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.6, 'rgba(180,240,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  else { g.fillStyle = 'rgba(200,255,230,0.35)'; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const PIEZAS = [[0, 'disco', 3.2, '#fff6dc'], [0.22, 'hex', 0.5, '#b8ffd8'], [0.38, 'anillo', 0.9, '#bfe8ff'], [0.55, 'hex', 0.35, '#ffd6f0'], [0.72, 'disco', 0.25, '#d8f0ff'], [0.9, 'hex', 0.7, '#c8e6ff'], [1.15, 'anillo', 1.4, '#e0ffd0']];

export class Cielo {
  constructor(motor, pano = null) {
    this.motor = motor;
    const U = this.U = {
      uSol: { value: new THREE.Vector3(0, 1, 0) }, uLuna: { value: new THREE.Vector3(0, -1, 0) },
      uCenit: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() }, uAtar: { value: new THREE.Color('#ff9a6b') },
      uDia: { value: 1 }, uAtardecer: { value: 0 }, uAurora: { value: 0 }, uT: { value: 0 }, uEstrellas: { value: 0 },
      uPano: { value: pano }, uHayPano: { value: pano ? 1 : 0 }, uNubes: { value: 1 }, uArco: { value: 0 },
    };
    if (pano) { pano.wrapS = THREE.RepeatWrapping; pano.wrapT = THREE.ClampToEdgeWrapping; pano.generateMipmaps = false; pano.minFilter = THREE.LinearFilter; pano.needsUpdate = true; }
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

    /* (las nubes van en el shader del cielo: ya no hay carteles) */
    this.nubes = new THREE.Group(); motor.escena.add(this.nubes);
    this.destello = PIEZAS.map(([u, tipo, tam, col]) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texDestello(tipo), color: col, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.userData = { u, tam }; s.renderOrder = 999; s.frustumCulled = false; s.visible = false; motor.escena.add(s); return s;
    });
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
    /* sin corrimiento: el sol está arriba justo la mitad de la vuelta */
    const sol = U.uSol.value.set(Math.cos(ang), Math.sin(ang) + 0.02, 0.42).normalize();
    U.uLuna.value.set(-Math.cos(ang) * 0.9, -Math.sin(ang) + 0.1, -0.5).normalize();
    const dia = THREE.MathUtils.smoothstep(sol.y, -0.12, 0.28);
    const atar = Math.max(0, 1 - Math.abs(sol.y - 0.06) / 0.2);
    this.dia = dia; this.atardecer = atar;
    U.uDia.value = dia; U.uAtardecer.value = atar;
    U.uEstrellas.value = 1 - THREE.MathUtils.smoothstep(sol.y, -0.1, 0.12);
    U.uAurora.value = Math.max(this.modo.aurora, 0);
    U.uNubes.value = this.modo.nubes ?? 1;
    U.uArco.value = (this.modo.arcoiris || 0) * dia * (1 - atar);
    const cenit = U.uCenit.value.setRGB(0.018, 0.04, 0.13).lerp(new THREE.Color(0.05, 0.3, 0.95), dia);
    cenit.lerp(new THREE.Color(0.2, 0.22, 0.52), atar * 0.45);
    const hor = U.uHorizonte.value.setRGB(0.05, 0.13, 0.32).lerp(new THREE.Color(0.55, 0.84, 1.0), dia);
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
    this.ponerDestello(sol, dia);
  }
  ponerDestello(sol, dia) {
    const cam = this.motor.camara;
    const p = cam.position.clone().addScaledVector(sol, 500).project(cam);
    const fuera = Math.max(Math.abs(p.x), Math.abs(p.y));
    const k = p.z < 1 && !this.modo.interior && !this.modo.aurora && !this.bajoAgua ? dia * (1 - THREE.MathUtils.smoothstep(fuera, 0.75, 1.15)) * THREE.MathUtils.smoothstep(sol.y, 0.02, 0.2) : 0;
    const escala = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * 2;
    for (const s of this.destello) {
      s.visible = k > 0.01; if (!s.visible) continue;
      const q = new THREE.Vector3(p.x * (1 - s.userData.u * 2), p.y * (1 - s.userData.u * 2), 0.5).unproject(cam).sub(cam.position).normalize();
      s.position.copy(cam.position).addScaledVector(q, 6);
      const tam = s.userData.tam * escala * 0.55;
      s.scale.set(tam, tam, 1);
      s.material.opacity = k * (s.userData.u === 0 ? 0.55 : 0.4);
    }
  }
}
