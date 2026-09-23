/* kuntur/js/escena.js — el renderer, la cámara, las luces y el posproceso.
   El posproceso: la escena en HDR, bloom (lo que brilla se derrama), el tono
   y el paso a sRGB, y al final la "gradación" propia de cada capítulo:
   contraste, saturación, tinte, viñeta, grano de película, las franjas de
   cine, el fundido y el destello de los relámpagos. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Pantalla } from './pantalla.js';

export const CALIDADES = {
  alta: { px: 2, sombra: 2048, bloom: 1, msaa: 4 },
  media: { px: 1.5, sombra: 1024, bloom: 0.5, msaa: 0 },
  baja: { px: 1, sombra: 512, bloom: 0, msaa: 0 },
};

const GRADO = {
  uniforms: {
    tDiffuse: { value: null }, uContraste: { value: 1 }, uSat: { value: 1 }, uTinte: { value: new THREE.Vector3(1, 1, 1) },
    uVineta: { value: 0.3 }, uGrano: { value: 0.03 }, uTiempo: { value: 0 }, uFundido: { value: 0 }, uColFundido: { value: new THREE.Color(0, 0, 0) },
    uBarras: { value: 0 }, uFlash: { value: 0 }, uFrio: { value: 0 }, uAspecto: { value: 1 }, uAberr: { value: 0.0012 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uContraste, uSat, uVineta, uGrano, uTiempo, uFundido, uBarras, uFlash, uFrio, uAspecto, uAberr;
    uniform vec3 uTinte, uColFundido; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d * vec2(uAspecto, 1.0), d * vec2(uAspecto, 1.0));
      /* un poquito de aberración en los bordes, como un lente */
      vec2 ab = d * uAberr * (0.5 + r2 * 3.0);
      vec3 c = vec3(texture2D(tDiffuse, vUv + ab).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ab).b);
      c *= uTinte;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat);
      c = (c - 0.5) * uContraste + 0.5;
      /* la escarcha de la ventisca: los bordes se ponen blancos y azules */
      float borde = smoothstep(0.12, 0.42, r2);
      c = mix(c, vec3(0.86, 0.92, 1.0), borde * uFrio * (0.6 + 0.4 * h(floor(vUv * vec2(120.0, 80.0)))));
      c *= 1.0 - uVineta * smoothstep(0.08, 0.55, r2);
      c += (h(vUv * 800.0 + uTiempo * 61.0) - 0.5) * uGrano;
      c += vec3(uFlash);
      c = mix(c, uColFundido, uFundido);
      float b = uBarras * 0.11;
      if (vUv.y < b || vUv.y > 1.0 - b) c = vec3(0.0);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Escena {
  constructor(lienzo, nombreCalidad) {
    this.calidad = CALIDADES[nombreCalidad] ? nombreCalidad : 'media';
    const cal = CALIDADES[this.calidad];
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, cal.px));
    r.shadowMap.enabled = cal.sombra > 0;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    this.escena = new THREE.Scene();
    this.escena.fog = new THREE.FogExp2(0xffffff, 0.004);
    this.camara = new THREE.PerspectiveCamera(30, 1, 0.3, 2000);
    this.camara.position.set(0, 5, 22);

    /* la luz principal (sol o luna) con sombra que sigue a Killa, y la del cielo */
    this.luz = new THREE.DirectionalLight(0xffffff, 2.5);
    this.luz.castShadow = cal.sombra > 0;
    const s = this.luz.shadow;
    s.mapSize.set(cal.sombra || 512, cal.sombra || 512);
    s.camera.left = -16; s.camera.right = 16; s.camera.top = 12; s.camera.bottom = -10; s.camera.near = 1; s.camera.far = 70;
    s.bias = -0.0006; s.normalBias = 0.03;
    this.escena.add(this.luz, this.luz.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.escena.add(this.hemi);
    this.dirLuz = new THREE.Vector3(0, 1, 1);

    /* el posproceso */
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: cal.msaa });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.escena, this.camara));
    this.bloom = null;
    /* el bloom se arma siempre (apagado en calidad baja): así se puede prender después en las opciones */
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.6, 0.85);
    this.bloom.resolucion = cal.bloom || 0.5; this.bloom.enabled = cal.bloom > 0;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grado = new ShaderPass(GRADO);
    this.composer.addPass(this.grado);
    this.u = this.grado.uniforms;
    this.tamano();
    addEventListener('resize', () => this.tamano());
    addEventListener('orientationchange', () => setTimeout(() => this.tamano(), 250));
  }

  /* cambiar la calidad sin rearmar todo (el antialias del principio queda) */
  ponerCalidad(nombre) {
    if (!CALIDADES[nombre]) return;
    this.calidad = nombre;
    const cal = CALIDADES[nombre], r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, cal.px));
    const s = this.luz.shadow;
    s.mapSize.set(cal.sombra, cal.sombra);
    if (s.map) { s.map.dispose(); s.map = null; }
    if (this.bloom) { this.bloom.enabled = cal.bloom > 0; this.bloom.resolucion = cal.bloom || 0.5; }
    /* el composer se acuerda del pixel ratio con que se armó: si no, la calidad no cambiaba la resolución */
    this.composer.setPixelRatio(r.getPixelRatio());
    this.tamano();
  }

  tamano() {
    Pantalla.actualizar();
    const w = Pantalla.w, h = Pantalla.h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px'; this.renderer.domElement.style.height = h + 'px';
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(Math.round(w * this.bloom.resolucion), Math.round(h * this.bloom.resolucion));
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
    this.u.uAspecto.value = w / h;
    this.aspecto = w / h;
  }

  /* cuánto tiene que alejarse la cámara para ver al menos "ancho" x "alto" metros */
  distancia(ancho, alto) {
    const t = Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));
    return Math.max(alto / (2 * t), ancho / (2 * t * this.aspecto));
  }

  ponerBioma(bio) {
    const e = this.escena;
    e.fog.color.set(bio.niebla.col); e.fog.density = bio.niebla.dens;
    this.luz.color.set(bio.luz.col); this.luz.intensity = bio.luz.int;
    this.dirLuz.set(...bio.luz.dir).normalize();
    this.hemi.color.set(bio.hemi.cielo); this.hemi.groundColor.set(bio.hemi.suelo); this.hemi.intensity = bio.hemi.int;
    const G = bio.grado, u = this.u;
    this.renderer.toneMappingExposure = G.exp;
    u.uContraste.value = G.contraste; u.uSat.value = G.sat; u.uTinte.value.set(...G.tinte); u.uVineta.value = G.vineta; u.uGrano.value = G.grano;
    if (this.bloom && bio.bloom) { this.bloom.strength = bio.bloom.fuerza; this.bloom.threshold = bio.bloom.umbral; this.bloom.radius = bio.bloom.radio; }
  }

  /* la luz sigue al centro de la acción, así la sombra siempre es nítida cerca */
  seguirLuz(x, y) {
    const d = this.dirLuz;
    this.luz.target.position.set(x, y, 0);
    this.luz.position.set(x + d.x * 35, y + d.y * 35, d.z * 35);
  }

  dibujar(t) {
    this.u.uTiempo.value = t % 100;
    this.composer.render();
  }
}
