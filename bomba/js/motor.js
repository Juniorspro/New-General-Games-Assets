// El render: la escena en HDR (media precisión), un bloom propio de dos
// escalas con umbral alto (solo brillan la explosión, las mechas, los
// portales y lo arcoíris: si brilla todo, se ve lechoso) y una pasada final
// con el mapeo de tonos neutral de Khronos (respeta los colores saturados de
// juguete; ACES los apaga), un poco más de saturación, viñeta y tramado.
import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRILLO = /* glsl */ `
uniform sampler2D tMapa; uniform float uUmbral; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMapa, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  // rodilla suave: lo que pasa apenas el umbral entra de a poco
  float k = clamp((l - uUmbral + 0.5) / 1.0, 0.0, 1.0);
  float peso = max(l - uUmbral, 0.0) + k * k * 0.25;
  gl_FragColor = vec4(c * (peso / max(l, 1e-4)), 1.0);
}`;

const DESENFOQUE = /* glsl */ `
uniform sampler2D tMapa; uniform vec2 uPaso; varying vec2 vUv;
void main() {
  vec3 s = texture2D(tMapa, vUv).rgb * 0.227;
  s += (texture2D(tMapa, vUv + uPaso * 1.385).rgb + texture2D(tMapa, vUv - uPaso * 1.385).rgb) * 0.316;
  s += (texture2D(tMapa, vUv + uPaso * 3.231).rgb + texture2D(tMapa, vUv - uPaso * 3.231).rgb) * 0.07;
  gl_FragColor = vec4(s, 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tEscena; uniform sampler2D tB1; uniform sampler2D tB2;
uniform float uBloom; uniform float uExpo; uniform float uSatur; uniform float uVineta; uniform float uDestello; uniform vec3 uTinte;
varying vec2 vUv;
vec3 neutral(vec3 color) {
  const float inicio = 0.76; const float desat = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= off;
  float pico = max(color.r, max(color.g, color.b));
  if (pico < inicio) return color;
  float d = 1.0 - inicio;
  float nuevo = 1.0 - d * d / (pico + d - inicio);
  color *= nuevo / pico;
  float g = 1.0 - 1.0 / (desat * (pico - nuevo) + 1.0);
  return mix(color, vec3(nuevo), g);
}
float azar(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture2D(tEscena, vUv).rgb;
  c += (texture2D(tB1, vUv).rgb * 0.7 + texture2D(tB2, vUv).rgb * 0.9) * uBloom;
  c *= uExpo;
  c = mix(c, uTinte, uDestello);
  c = neutral(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSatur), 0.0);
  vec2 q = vUv - 0.5;
  c *= 1.0 - uVineta * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
  c += (azar(vUv * 913.7) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

function tri() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export class Motor {
  constructor(lienzo) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance', stencil: false }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    this.calidad = 1;
    this.w = 1; this.h = 1;
    this.camOrto = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.tri = new THREE.Mesh(tri());
    this.tri.frustumCulled = false;
    this.escenaPost = new THREE.Scene();
    this.escenaPost.add(this.tri);
    const mat = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.mBrillo = mat(BRILLO, { tMapa: { value: null }, uUmbral: { value: 1.35 } });
    this.mDesen = mat(DESENFOQUE, { tMapa: { value: null }, uPaso: { value: new THREE.Vector2() } });
    this.mFinal = mat(FINAL, {
      tEscena: { value: null }, tB1: { value: null }, tB2: { value: null },
      uBloom: { value: 0.55 }, uExpo: { value: 1 }, uSatur: { value: 1.1 }, uVineta: { value: 0.2 },
      uDestello: { value: 0 }, uTinte: { value: new THREE.Color(1, 0.95, 0.85) },
    });
    this.rt = null;
  }

  ponerCalidad(q) { this.calidad = q; this.rehacer(); }

  medir(w, h) {
    const r = this.renderer;
    const tope = [1, 1.5, 2][this.calidad];
    r.setPixelRatio(Math.min(devicePixelRatio || 1, tope));
    r.setSize(w, h, false);
    this.w = w; this.h = h;
    this.rehacer();
  }

  rehacer() {
    const r = this.renderer;
    const t = r.getDrawingBufferSize(new THREE.Vector2());
    for (const x of [this.rt, this.b0, this.b1, this.b2, this.b3]) if (x) x.dispose();
    const op = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rt = new THREE.WebGLRenderTarget(t.x, t.y, { type: THREE.HalfFloatType, samples: [0, 2, 4][this.calidad] });
    const w4 = Math.max(1, Math.round(t.x / 4)), h4 = Math.max(1, Math.round(t.y / 4));
    this.b0 = new THREE.WebGLRenderTarget(w4, h4, op);
    this.b1 = new THREE.WebGLRenderTarget(w4, h4, op);
    this.b2 = new THREE.WebGLRenderTarget(Math.max(1, w4 >> 1), Math.max(1, h4 >> 1), op);
    this.b3 = new THREE.WebGLRenderTarget(Math.max(1, w4 >> 1), Math.max(1, h4 >> 1), op);
    this.tam = t;
  }

  pasada(mat, destino) {
    this.tri.material = mat;
    this.renderer.setRenderTarget(destino);
    this.renderer.render(this.escenaPost, this.camOrto);
  }

  // capas: [{ escena, camara, antes: fn }] — lo que se dibuja encima de la
  // escena (el huevo que se abre) va en HDR también, así brilla.
  dibujar(escena, camara, capas = []) {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    r.render(escena, camara);
    for (const c of capas) { r.clearDepth(); if (c.antes) c.antes(); r.render(c.escena, c.camara); }
    const bloom = this.calidad > 0;
    if (bloom) {
      this.mBrillo.uniforms.tMapa.value = this.rt.texture;
      this.pasada(this.mBrillo, this.b0);
      const D = this.mDesen.uniforms;
      D.tMapa.value = this.b0.texture; D.uPaso.value.set(1 / this.b0.width, 0); this.pasada(this.mDesen, this.b1);
      D.tMapa.value = this.b1.texture; D.uPaso.value.set(0, 1 / this.b1.height); this.pasada(this.mDesen, this.b0);
      D.tMapa.value = this.b0.texture; D.uPaso.value.set(2 / this.b2.width, 0); this.pasada(this.mDesen, this.b2);
      D.tMapa.value = this.b2.texture; D.uPaso.value.set(0, 2 / this.b2.height); this.pasada(this.mDesen, this.b3);
    }
    const F = this.mFinal.uniforms;
    F.tEscena.value = this.rt.texture;
    F.tB1.value = this.b0.texture;
    F.tB2.value = this.b3.texture;
    F.uBloom.value = bloom ? this.fuerzaBloom ?? 0.55 : 0;
    this.pasada(this.mFinal, null);
  }
}
