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
    /* una luz de punto apagada que está cuando el capítulo no trae la suya (el fogón del prólogo,
       el farol de la Puna): three arma un programa por cada cantidad de luces, y sin esta cada
       cambio de capítulo volvía a compilar todos los shaders, con el telón ya abierto */
    this.relleno = new THREE.PointLight(0x000000, 0, 1);
    this.relleno.position.set(0, -500, 0);
    this.escena.add(this.relleno);
    this.ensayando = false;
    this.subidas = new Set();

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
    /* el dibujo ocupa la vista: toda la pantalla, o la parte de arriba con el teléfono parado */
    const V = Pantalla.vista, w = V.w, h = V.h, st = this.renderer.domElement.style;
    this.renderer.setSize(w, h, false);
    st.width = w + 'px'; st.height = h + 'px'; st.left = V.x + 'px'; st.top = V.y + 'px';
    this.composer.setSize(w, h);
    if (this.bloom) this.bloom.setSize(Math.round(w * this.bloom.resolucion), Math.round(h * this.bloom.resolucion));
    /* el fov de three es vertical: parado, con 30° la cámara tenía que irse lejísimos para ver
       algo de ancho y el diorama se aplanaba. Con 44° queda a una distancia parecida a la del
       acostado y el papel se sigue viendo en relieve */
    this.camara.fov = Pantalla.vertical ? 44 : 30;
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
    /* mientras se ensaya no se dibuja: un cuadro común compilaría ahí mismo, frenando, lo que
       el ensayo está compilando de fondo (el telón está cerrado, no se ve nada) */
    if (this.ensayando) return;
    this.u.uTiempo.value = t % 100;
    this.composer.render();
  }

  /* la luz de relleno solo cuando no hay otra: siempre queda una luz de punto (ver arriba) */
  igualarLuces() {
    let n = 0;
    this.escena.traverseVisible((o) => { if (o.isPointLight && o !== this.relleno) n++; });
    this.relleno.visible = n === 0;
  }

  /* ---------------- el ensayo, antes de levantar el telón ----------------
     Lo que tironeaba al empezar (medido con pruebas/arranque.mjs) era la primera vez de cada
     cosa: compilar los shaders al dibujar por primera vez cada material, y subir a la placa
     cada hoja de papel (los cuadros de Killa y de los vecinos, los recortes que se paran) la
     primera vez que aparecía. Acá se hace todo con el telón cerrado:
     1. los programas de todo lo que hay (también lo lejano o escondido) con compileAsync, que
        donde el navegador compila en paralelo no frena. Con el render target del posproceso
        puesto: el programa cambia según adónde se dibuja (el tono y el espacio de color);
     2. las texturas, de a pocas por cuadro, para no trabar lo que se está mostrando;
     3. una pasada con todo a la vista y sin recortar: los programas de las sombras se arman
        recién al dibujarlas, y el posproceso también.
     Lo que quedó subido de otro capítulo y acá no se usa se libera (el dibujo queda en memoria
     y se vuelve a subir si hace falta). */
  async ensayar(grupo, texturas) {
    const r = this.renderer;
    const cuadro = () => new Promise((listo) => requestAnimationFrame(() => listo()));
    this.ensayando = true;
    try {
      this.igualarLuces();
      const rt = r.getRenderTarget();
      /* compile() cuenta las luces de la escena y además las del grupo: con el grupo adentro, el
         fogón contaba dos veces y salían programas que después no servían. Se lo saca un momento */
      const suelto = grupo !== this.escena && grupo.parent === this.escena;
      if (suelto) this.escena.remove(grupo);
      r.setRenderTarget(this.composer.readBuffer);
      /* sin compilación en paralelo (SwiftShader, algún teléfono viejo) compileAsync compila
         igual, de corrido, y avisa por consola: ahí directamente compile */
      let listos;
      try { listos = r.extensions.has('KHR_parallel_shader_compile') ? r.compileAsync(grupo, this.camara, this.escena) : r.compile(grupo, this.camara, this.escena); } finally {
        r.setRenderTarget(rt);
        if (suelto) this.escena.add(grupo);
      }
      const lista = new Set(texturas || []);
      grupo.traverse((o) => {
        for (const mt of [].concat(o.material || [])) for (const k of ['map', 'alphaMap', 'emissiveMap']) if (mt[k] && mt[k].isTexture) lista.add(mt[k]);
      });
      for (const t of this.subidas) if (!lista.has(t)) { t.dispose(); this.subidas.delete(t); }
      let t0 = performance.now();
      for (const t of lista) {
        r.initTexture(t);
        if (t.userData && t.userData.w != null) this.subidas.add(t);
        if (performance.now() - t0 > 6) { await cuadro(); t0 = performance.now(); }
      }
      await listos;
      /* la pasada: todo visible (menos las luces, que cambiarían la cuenta) y sin recortar */
      const vis = [], cull = [];
      grupo.traverse((o) => {
        if (o.isLight) return;
        if (!o.visible) { vis.push(o); o.visible = true; }
        if (o.frustumCulled) { cull.push(o); o.frustumCulled = false; }
      });
      try { this.composer.render(); } finally {
        for (const o of vis) o.visible = false;
        for (const o of cull) o.frustumCulled = true;
      }
      await this.esperarPlaca();
    } finally { this.ensayando = false; }
  }
  /* esperar a que la placa termine de verdad lo pedido: el dibujo lo hace otro proceso, y sin
     esto el trabajo del ensayo (que en SwiftShader son segundos) caía en los primeros cuadros
     con el telón ya abierto. Una lectura de un píxel con valla, sin trabar el hilo */
  async esperarPlaca() {
    const r = this.renderer;
    if (!this.testigo) { this.testigo = new THREE.WebGLRenderTarget(1, 1); this.pixel = new Uint8Array(4); }
    const rt = r.getRenderTarget();
    r.setRenderTarget(this.testigo); r.clear(); r.setRenderTarget(rt);
    try { await r.readRenderTargetPixelsAsync(this.testigo, 0, 0, 1, 1, this.pixel); } catch (_) {}
  }
}
