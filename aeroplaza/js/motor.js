/* ============================================================================
   aeroplaza/js/motor.js — el renderizador, la cadena de efectos y la calidad.
   - Brillo (bloom) a media resolución: lo que hace "Aero" al vidrio y al agua.
   - El pase final es de uno: tono, saturación, viñeta y los efectos retro que
     se eligen en Opciones (pixelado, tramado, profundidad de color, líneas de
     barrido, curva de tubo y aberración cromática), todo en una pasada.
   - Tres calidades y una automática que mide los cuadros de los primeros
     segundos y baja si hace falta (lo que se aprendió con BRILLO).
   ========================================================================== */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const CALIDADES = {
  /* escala: fracción de los píxeles de la pantalla; sombra: lado del mapa */
  alta: { escala: 1, dprMax: 2, bloom: true, sombra: 2048, msaa: 4, pasto: 1 },
  media: { escala: 0.8, dprMax: 1.5, bloom: true, sombra: 1024, msaa: 0, pasto: 0.6 },
  baja: { escala: 0.62, dprMax: 1, bloom: false, sombra: 512, msaa: 0, pasto: 0.3 },
};

const FINAL = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 },
    uPix: { value: 0 }, uTrama: { value: 0 }, uNiveles: { value: 0 }, uBarrido: { value: 0 },
    uTubo: { value: 0 }, uAberracion: { value: 0 }, uSat: { value: 1.12 }, uVineta: { value: 0.22 },
    uFundido: { value: 0 }, uColorFundido: { value: new THREE.Color('#ffffff') }, uAgua: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uT, uPix, uTrama, uNiveles, uBarrido, uTubo, uAberracion, uSat, uVineta, uFundido, uAgua;
    uniform vec3 uColorFundido;
    varying vec2 vUv;
    float bayer(vec2 p) {
      /* la matriz de Bayer de 4x4, armada con bits: el tramado de las consolas viejas */
      vec2 q = mod(floor(p), 4.0);
      float a = mod(q.x, 2.0), b = mod(q.y, 2.0), c = floor(q.x / 2.0), d = floor(q.y / 2.0);
      float v = 8.0 * mod(a + b, 2.0) + 4.0 * b + 2.0 * mod(c + d, 2.0) + d;
      return v / 16.0 - 0.5;
    }
    void main() {
      vec2 uv = vUv;
      /* la curva del tubo */
      if (uTubo > 0.0) { vec2 c = uv * 2.0 - 1.0; c *= 1.0 + dot(c.yx, c.yx) * 0.045 * uTubo; uv = c * 0.5 + 0.5; }
      vec2 px = uRes;
      if (uPix > 1.0) { px = uRes / uPix; uv = (floor(uv * px) + 0.5) / px; }
      /* bajo el agua: se ondula todo */
      if (uAgua > 0.0) uv += vec2(sin(uv.y * 40.0 + uT * 2.0), cos(uv.x * 34.0 + uT * 1.7)) * 0.0022 * uAgua;
      vec3 col;
      if (uAberracion > 0.0) {
        vec2 d = (uv - 0.5) * uAberracion * 0.006;
        col = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
      } else col = texture2D(tDiffuse, uv).rgb;
      /* saturación: el Aero es "hipersaturado" */
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      if (uAgua > 0.0) col = mix(col, col * vec3(0.55, 0.9, 1.1) + vec3(0.0, 0.05, 0.1), uAgua * 0.6);
      /* profundidad de color con tramado */
      if (uNiveles > 1.0) {
        float n = uNiveles - 1.0;
        vec2 cel = floor(uv * px);
        col = floor(col * n + 0.5 + bayer(cel) * uTrama) / n;
      } else if (uTrama > 0.0) {
        col += bayer(gl_FragCoord.xy / max(1.0, uPix)) * uTrama * 0.06;
      }
      if (uBarrido > 0.0) {
        float lin = sin((uv.y * px.y) * 3.14159) * 0.5 + 0.5;
        col *= 1.0 - uBarrido * 0.35 * (1.0 - lin);
        col *= 1.0 - uBarrido * 0.04 * sin(uT * 60.0 + uv.y * 3.0);
      }
      /* viñeta suave (y la del tubo, más marcada) */
      vec2 v = vUv - 0.5;
      col *= 1.0 - dot(v, v) * (uVineta + uTubo * 0.9);
      if (uTubo > 0.0 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) col = vec3(0.0);
      col = mix(col, uColorFundido, uFundido);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Motor {
  constructor(lienzo) {
    this.lienzo = lienzo;
    const r = this.r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;   // el blando ya no existe en esta versión de three
    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(60, 1, 0.1, 2400);
    this.nombreCalidad = 'alta';
    this.retro = { pix: 0, trama: 0, niveles: 0, barrido: 0, tubo: 0, aberracion: 0 };
    this.armarCadena();
    this.ponerCalidad('alta');
    addEventListener('resize', () => this.medir());
    this.t = 0;
  }
  armarCadena() {
    const Q = CALIDADES[this.nombreCalidad] || CALIDADES.alta;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.msaa });
    this.cadena = new EffectComposer(this.r, rt);
    this.pRender = new RenderPass(this.escena, this.camara);
    this.pBloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.55, 1.45);
    this.pSalida = new OutputPass();
    this.pFinal = new ShaderPass(FINAL);
    this.cadena.addPass(this.pRender);
    this.cadena.addPass(this.pBloom);
    this.cadena.addPass(this.pSalida);
    this.cadena.addPass(this.pFinal);
  }
  ponerCalidad(nombre) {
    const antes = CALIDADES[this.nombreCalidad];
    this.nombreCalidad = nombre;
    const Q = this.Q = CALIDADES[nombre];
    if (antes && antes.msaa !== Q.msaa) { this.cadena.dispose(); this.armarCadena(); }
    this.pBloom.enabled = Q.bloom;
    this.r.shadowMap.enabled = true;
    if (this.sol) { this.sol.shadow.mapSize.set(Q.sombra, Q.sombra); if (this.sol.shadow.map) { this.sol.shadow.map.dispose(); this.sol.shadow.map = null; } }
    this.medir();
    for (const f of this.alCambiarCalidad || []) f(Q);
  }
  medir() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.Q.dprMax) * this.Q.escala;
    this.r.setPixelRatio(dpr);
    this.r.setSize(w, h, false);
    this.lienzo.style.width = w + 'px'; this.lienzo.style.height = h + 'px';
    this.cadena.setPixelRatio(dpr);
    this.cadena.setSize(w, h);
    /* el brillo a media resolución: casi igual y cuesta la cuarta parte */
    this.pBloom.setSize(Math.round(w * dpr / 2), Math.round(h * dpr / 2));
    this.camara.aspect = w / h;
    /* en vertical se abre el campo para que no quede todo apretado */
    this.camara.fov = w < h ? 72 : 58;
    this.camara.updateProjectionMatrix();
    this.pFinal.uniforms.uRes.value.set(w * dpr, h * dpr);
    this.ancho = w; this.alto = h;
  }
  ponerRetro(o) {
    Object.assign(this.retro, o);
    const U = this.pFinal.uniforms, R = this.retro;
    U.uPix.value = R.pix ? [0, 2, 3, 4, 6][R.pix] : 0;
    U.uTrama.value = R.trama; U.uNiveles.value = R.niveles ? [0, 32, 16, 8, 5][R.niveles] : 0;
    U.uBarrido.value = R.barrido; U.uTubo.value = R.tubo; U.uAberracion.value = R.aberracion;
  }
  dibujar(dt) {
    this.t += dt;
    this.pFinal.uniforms.uT.value = this.t;
    this.cadena.render(dt);
  }
}
