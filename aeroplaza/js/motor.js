/* ============================================================================
   aeroplaza/js/motor.js — el renderizador, la cadena de efectos, la calidad y
   los estilos retro.
   - Brillo (bloom) a media resolución: lo que hace "Aero" al vidrio y al agua.
   - Los estilos retro (Pixel, PS1, Tubo, Game Boy, 8 bits, VHS) dibujan de
     verdad a baja resolución (144 a 360 líneas) y el navegador agranda sin
     suavizar (image-rendering: pixelated). Por eso, además de verse como una
     consola vieja, van mucho más rápido: en el teléfono son la salvación.
   - PS1: los vértices se "pegan" a una grilla de pantalla gruesa (el temblor
     de la PlayStation), con un #define que se agrega a todos los materiales.
   - Tres calidades y una automática que mide los primeros cuadros y sube o
     baja (lo que se aprendió con BRILLO).
   ========================================================================== */
import * as THREE from 'three';
import { Pantalla } from './pantalla.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const TACTIL = typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
export const CALIDADES = {
  /* escala: fracción de los píxeles de la pantalla; sombra: lado del mapa (0 = sin sombras) */
  alta: { escala: 1, dprMax: TACTIL ? 1.5 : 2, bloom: true, sombra: 2048, msaa: TACTIL ? 0 : 4, pasto: 1 },
  media: { escala: 0.85, dprMax: 1.25, bloom: true, sombra: 1024, msaa: 0, pasto: 0.55 },
  baja: { escala: 0.7, dprMax: 1, bloom: false, sombra: 0, msaa: 0, pasto: 0.25 },
};
/* las líneas de cada nivel de pixelado */
export const ALTOS_PIXEL = [0, 360, 270, 200, 144];
export const ESTILOS = {
  normal: { pix: 0, trama: 0, niveles: 0, barrido: 0, tubo: 0, aberracion: 0, ps1: 0, paleta: 0, vhs: 0 },
  pixel: { pix: 2, trama: 1, niveles: 3, barrido: 0, tubo: 0, aberracion: 0, ps1: 0, paleta: 0, vhs: 0 },
  ps1: { pix: 3, trama: 1, niveles: 1, barrido: 0, tubo: 0, aberracion: 0, ps1: 1, paleta: 0, vhs: 0 },
  tubo: { pix: 1, trama: 0, niveles: 0, barrido: 1, tubo: 1, aberracion: 1, ps1: 0, paleta: 0, vhs: 0 },
  gameboy: { pix: 4, trama: 1, niveles: 0, barrido: 0, tubo: 0, aberracion: 0, ps1: 0, paleta: 1, vhs: 0 },
  ochobits: { pix: 4, trama: 1, niveles: 0, barrido: 0, tubo: 0, aberracion: 0, ps1: 0, paleta: 2, vhs: 0 },
  vhs: { pix: 1, trama: 0, niveles: 0, barrido: 1, tubo: 0, aberracion: 1, ps1: 0, paleta: 0, vhs: 1 },
};

/* el temblor de PS1: la posición en pantalla se redondea a una grilla de ~320x240 */
THREE.ShaderChunk.project_vertex += `
#ifdef PS1
  { vec2 grilla = vec2(160.0, 120.0); gl_Position.xy = floor(gl_Position.xy / gl_Position.w * grilla + 0.5) / grilla * gl_Position.w; }
#endif`;

const FINAL = {
  uniforms: {
    tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 },
    uTrama: { value: 0 }, uNiveles: { value: 0 }, uBarrido: { value: 0 }, uPaleta: { value: 0 }, uVHS: { value: 0 },
    uTubo: { value: 0 }, uAberracion: { value: 0 }, uSat: { value: 1.12 }, uVineta: { value: 0.22 },
    uFundido: { value: 0 }, uColorFundido: { value: new THREE.Color('#ffffff') }, uAgua: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uT, uTrama, uNiveles, uBarrido, uPaleta, uVHS, uTubo, uAberracion, uSat, uVineta, uFundido, uAgua;
    uniform vec3 uColorFundido;
    varying vec2 vUv;
    float bayer(vec2 p) {
      /* la matriz de Bayer de 4x4, armada con bits: el tramado de las consolas viejas */
      vec2 q = mod(floor(p), 4.0);
      float a = mod(q.x, 2.0), b = mod(q.y, 2.0), c = floor(q.x / 2.0), d = floor(q.y / 2.0);
      float v = 8.0 * mod(a + b, 2.0) + 4.0 * b + 2.0 * mod(c + d, 2.0) + d;
      return v / 16.0 - 0.5;
    }
    float azar(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    /* 16 colores de pixel art con celestes y verdes (la paleta "Sweetie 16"): le queda al Aero */
    const vec3 P8[16] = vec3[16](vec3(0.102, 0.110, 0.173), vec3(0.365, 0.153, 0.365), vec3(0.694, 0.243, 0.325), vec3(0.937, 0.490, 0.341), vec3(1.000, 0.804, 0.459), vec3(0.655, 0.941, 0.439), vec3(0.220, 0.718, 0.392), vec3(0.145, 0.443, 0.475), vec3(0.161, 0.212, 0.435), vec3(0.231, 0.365, 0.788), vec3(0.255, 0.651, 0.965), vec3(0.451, 0.937, 0.969), vec3(0.957, 0.957, 0.957), vec3(0.580, 0.690, 0.761), vec3(0.337, 0.424, 0.525), vec3(0.200, 0.235, 0.341));
    /* los cuatro verdes, en la versión de emulador (más contraste que la pantalla original) */
    const vec3 GB[4] = vec3[4](vec3(0.031, 0.094, 0.125), vec3(0.204, 0.408, 0.337), vec3(0.533, 0.753, 0.439), vec3(0.878, 0.973, 0.816));
    void main() {
      vec2 uv = vUv;
      /* la curva del tubo */
      if (uTubo > 0.0) { vec2 c = uv * 2.0 - 1.0; c *= 1.0 + dot(c.yx, c.yx) * 0.045 * uTubo; uv = c * 0.5 + 0.5; }
      vec2 cel = floor(uv * uRes);
      /* VHS: cada línea tiembla distinto y una franja de "tracking" baja despacio */
      if (uVHS > 0.0) {
        float fila = floor(uv.y * uRes.y);
        uv.x += (azar(vec2(fila, floor(uT * 24.0))) - 0.5) * 0.0035 * uVHS;
        float franja = 1.0 - smoothstep(0.0, 0.035, abs(fract(uT * 0.06) - uv.y));
        uv.x += franja * 0.012 * uVHS * sin(uv.y * 400.0 + uT * 30.0);
      }
      /* bajo el agua: se ondula todo */
      if (uAgua > 0.0) uv += vec2(sin(uv.y * 40.0 + uT * 2.0), cos(uv.x * 34.0 + uT * 1.7)) * 0.0022 * uAgua;
      vec3 col;
      if (uAberracion > 0.0) {
        vec2 d = (uv - 0.5) * uAberracion * 0.006 + vec2(uVHS * 0.0025, 0.0);
        col = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
      } else col = texture2D(tDiffuse, uv).rgb;
      /* saturación: el Aero es "hipersaturado" */
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, uSat);
      if (uAgua > 0.0) col = mix(col, col * vec3(0.55, 0.9, 1.1) + vec3(0.0, 0.05, 0.1), uAgua * 0.6);
      if (uVHS > 0.0) { col = mix(col, vec3(l), 0.18 * uVHS); col += (azar(cel + fract(uT) * 91.0) - 0.5) * 0.09 * uVHS; col *= vec3(1.04, 0.98, 1.05); }
      float tr = bayer(cel) * uTrama;
      if (uPaleta > 1.5) {
        /* 8 bits: el color más cercano de las 16, con tramado */
        vec3 q = mix(vec3(l), col, 1.3) + tr * 0.16; float mejor = 9.0; vec3 elegido = q;
        for (int i = 0; i < 16; i++) { vec3 d = q - P8[i]; float e = dot(d, d * vec3(0.9, 1.3, 0.6)); if (e < mejor) { mejor = e; elegido = P8[i]; } }
        col = elegido;
      } else if (uPaleta > 0.5) {
        /* Game Boy: cuatro verdes */
        /* con curva: la escena es clara y sin ella todo caía en los dos verdes de arriba */
        float g = clamp(pow(dot(col, vec3(0.299, 0.587, 0.114)), 1.3) * 1.15 + tr * 0.28, 0.0, 0.999);
        col = GB[int(floor(g * 4.0))];
      } else if (uNiveles > 1.0) {
        /* profundidad de color con tramado */
        float n = uNiveles - 1.0;
        col = floor(col * n + 0.5 + tr) / n;
      } else if (uTrama > 0.0) col += tr * 0.06;
      if (uBarrido > 0.0) col *= 1.0 - uBarrido * 0.05 * sin(uT * 50.0 + uv.y * 4.0);
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
    this.retro = { ...ESTILOS.normal };
    this.armarCadena();
    this.ponerCalidad('alta');
    Pantalla.alCambiar.push(() => this.medir());   // (Pantalla escucha el resize y el giro)
    this.t = 0;
  }
  armarCadena() {
    const Q = CALIDADES[this.nombreCalidad] || CALIDADES.alta;
    /* en los estilos pixelados no va el suavizado de bordes: el serrucho es parte del estilo */
    this.msaa = this.retro && this.retro.pix ? 0 : Q.msaa;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.msaa });
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
    if (antes && (this.retro.pix ? 0 : Q.msaa) !== this.msaa) { this.cadena.dispose(); this.armarCadena(); }
    this.pBloom.enabled = Q.bloom;
    this.r.shadowMap.enabled = true;
    /* en baja no hay sombras: sin la pasada de sombras se dibuja casi la mitad (apagarlas en la luz hace que three recompile solo) */
    if (this.sol) { this.sol.castShadow = Q.sombra > 0; if (Q.sombra) this.sol.shadow.mapSize.set(Q.sombra, Q.sombra); if (this.sol.shadow.map) { this.sol.shadow.map.dispose(); this.sol.shadow.map = null; } }
    this.medir();
    for (const f of this.alCambiarCalidad || []) f(Q);
  }
  medir() {
    const w = Pantalla.w, h = Pantalla.h;   // el tamaño lógico (con el celu parado, el juego va girado)
    let dpr = Math.min(devicePixelRatio || 1, this.Q.dprMax) * this.Q.escala;
    /* pixelado: se dibuja con pocas líneas y se agranda "a lo bruto" */
    const lineas = ALTOS_PIXEL[this.retro.pix] || 0;
    if (lineas) dpr = Math.min(dpr, lineas / h);
    this.lienzo.style.imageRendering = lineas ? 'pixelated' : 'auto';
    this.r.setPixelRatio(dpr);
    this.r.setSize(w, h, false);
    this.lienzo.style.width = w + 'px'; this.lienzo.style.height = h + 'px';
    this.cadena.setPixelRatio(dpr);
    this.cadena.setSize(w, h);
    /* el brillo a media resolución: casi igual y cuesta la cuarta parte */
    this.pBloom.setSize(Math.max(16, Math.round(w * dpr / 2)), Math.max(16, Math.round(h * dpr / 2)));
    this.camara.aspect = w / h;
    /* en vertical se abre el campo para que no quede todo apretado */
    this.camara.fov = w < h ? 72 : 58;
    this.camara.updateProjectionMatrix();
    this.pFinal.uniforms.uRes.value.set(Math.round(w * dpr), Math.round(h * dpr));
    this.ancho = w; this.alto = h; this.dpr = dpr;
  }
  ponerRetro(o) {
    const antes = { ...this.retro };
    Object.assign(this.retro, o);
    const U = this.pFinal.uniforms, R = this.retro;
    U.uTrama.value = R.trama ? 1 : 0; U.uNiveles.value = R.niveles ? [0, 32, 16, 8, 5][R.niveles] : 0;
    U.uBarrido.value = R.barrido ? 1 : 0; U.uTubo.value = R.tubo ? 1 : 0; U.uAberracion.value = R.aberracion ? 1 : 0;
    U.uPaleta.value = R.paleta || 0; U.uVHS.value = R.vhs ? 1 : 0;
    if (!!antes.pix !== !!R.pix && this.msaa !== (R.pix ? 0 : this.Q.msaa)) { this.cadena.dispose(); this.armarCadena(); this.pBloom.enabled = this.Q.bloom; }
    if (!!antes.ps1 !== !!R.ps1) this.aplicarPS1();
    /* las líneas de TV finitas van en una capa CSS encima, a la resolución de la pantalla */
    document.body.classList.toggle('lineasTV', !!R.barrido);
    document.body.classList.toggle('tuboTV', !!R.tubo);
    this.medir();
  }
  /* agrega o saca el #define PS1 en todos los materiales de la escena (se recompilan solos) */
  aplicarPS1(raiz = this.escena) {
    const si = !!this.retro.ps1;
    raiz.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) {
        if (m.isShaderMaterial) continue;
        const tiene = m.defines && 'PS1' in m.defines;
        if (si === tiene) continue;
        m.defines = { ...(m.defines || {}) };
        if (si) m.defines.PS1 = ''; else delete m.defines.PS1;
        m.needsUpdate = true;
      }
    });
  }
  dibujar(dt) {
    this.t += dt;
    this.pFinal.uniforms.uT.value = this.t;
    this.cadena.render(dt);
  }
}
