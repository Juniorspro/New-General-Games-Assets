// El motor: el renderer, la cámara y el revelado (brillo + tono).
//
// POR QUÉ UN BRILLO PROPIO Y NO EL UnrealBloomPass DE LOS EJEMPLOS.
// El look de este juego ES el brillo: sin él los láseres son rayitas grises y
// los sables, palitos. El de three hace diez pasadas de desenfoque gaussiano
// con núcleos de hasta 11 muestras; en un teléfono eso se come el cuadro. El
// "dual kawase" (bajar a la mitad cinco veces y volver a subir sumando) da un
// halo del mismo ancho con 5 muestras por bajada y 8 por subida, y cada
// pasada es a un cuarto de los píxeles de la anterior: casi todo el costo está
// en la primera.
//
// Y POR QUÉ TODO EN COMA FLOTANTE. Un láser "blanco" vale 4 o 6, no 1: así el
// centro satura a blanco y el halo conserva el color. En 8 bits todo lo que
// pasa de 1 se aplana y el brillo sale lavado. Si la placa no puede (teléfonos
// viejos), se cae a 8 bits y el juego se ve más apagado, pero anda.

import * as THREE from "../vendor/three.module.min.js";

const VS_PASADA = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// La primera bajada también corta: lo que no llega al umbral no brilla.
// Umbral con "rodilla" suave para que un color que cruza el umbral no prenda
// el halo de golpe (se ve como un parpadeo en los bordes de las cosas).
const FS_UMBRAL = /* glsl */`
precision highp float;
uniform sampler2D tFuente; uniform vec2 uTexel; uniform float uUmbral, uRodilla;
varying vec2 vUv;
vec3 cortar(vec3 c) {
  float b = max(c.r, max(c.g, c.b));
  float s = clamp(b - uUmbral + uRodilla, 0.0, 2.0 * uRodilla);
  s = s * s / (4.0 * uRodilla + 1e-4);
  return c * (max(s, b - uUmbral) / max(b, 1e-4));
}
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tFuente, vUv).rgb * 4.0;
  c += texture2D(tFuente, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture2D(tFuente, vUv + vec2( o.x, -o.y)).rgb;
  c += texture2D(tFuente, vUv + vec2(-o.x,  o.y)).rgb;
  c += texture2D(tFuente, vUv + vec2( o.x,  o.y)).rgb;
  // Tope: un píxel a 400 (un chispazo justo encima de otro) haría un cuadrado
  // blanco del tamaño de la última bajada.
  gl_FragColor = vec4(min(cortar(c / 8.0), vec3(24.0)), 1.0);
}`;

const FS_BAJADA = /* glsl */`
precision highp float;
uniform sampler2D tFuente; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tFuente, vUv).rgb * 4.0;
  c += texture2D(tFuente, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture2D(tFuente, vUv + vec2( o.x, -o.y)).rgb;
  c += texture2D(tFuente, vUv + vec2(-o.x,  o.y)).rgb;
  c += texture2D(tFuente, vUv + vec2( o.x,  o.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const FS_SUBIDA = /* glsl */`
precision highp float;
uniform sampler2D tFuente; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uPeso;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tFuente, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  c += texture2D(tFuente, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  c += texture2D(tFuente, vUv + vec2(0.0, o.y * 2.0)).rgb;
  c += texture2D(tFuente, vUv + vec2(o.x, o.y)).rgb * 2.0;
  c += texture2D(tFuente, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  c += texture2D(tFuente, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  c += texture2D(tFuente, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  c += texture2D(tFuente, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0 * uPeso + texture2D(tBase, vUv).rgb, 1.0);
}`;

// El revelado: escena + brillo, tono de película, viñeta y a sRGB.
// ACES "ajustado" (Narkowicz): lo muy brillante se va a blanco, que es
// exactamente lo que hace un tubo de neón en una cámara.
const FS_REVELADO = /* glsl */`
precision highp float;
uniform sampler2D tEscena; uniform sampler2D tBrillo;
uniform float uBrillo, uExpo, uFlash, uVineta, uSatura;
uniform vec3 uFlashColor;
varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec3 c = texture2D(tEscena, vUv).rgb;
  vec3 b = texture2D(tBrillo, vUv).rgb;
  c = c + b * uBrillo;
  c *= uExpo;
  // El destello de pantalla entera (bomba, fallo) se suma ANTES del tono para
  // que sature igual que una luz y no se vea como un velo pintado encima.
  vec2 d = vUv - 0.5;
  float borde = dot(d, d);
  c += uFlashColor * uFlash * (0.35 + borde * 2.2);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSatura), 0.0);
  c = aces(c);
  c *= 1.0 - borde * uVineta;
  gl_FragColor = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

function materialPasada(fs, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VS_PASADA, fragmentShader: fs, uniforms,
    depthTest: false, depthWrite: false,
  });
}

export class Motor {
  constructor(lienzo, { fijo = false } = {}) {
    this.lienzo = lienzo;
    this.renderer = new THREE.WebGLRenderer({
      canvas: lienzo, antialias: false, alpha: false, depth: true, stencil: false,
      powerPreference: "high-performance",
    });
    // El tono y el sRGB los pone el revelado. Si three también convierte, todo
    // sale dos veces aclarado y los negros se vuelven gris.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = true;

    const ext = this.renderer.extensions;
    this.hdr = this.renderer.capabilities.isWebGL2 &&
      (ext.has("EXT_color_buffer_float") || ext.has("EXT_color_buffer_half_float"));
    this.tipo = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;

    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(60, 1, 0.05, 600);

    // La resolución: tope por densidad de píxeles y una escala que se adapta.
    this.fijo = fijo;
    this.escala = 1;
    this.topeDPR = 1.5;
    this.calidad = "auto";        // "auto" | "alta" | "baja"
    this.ancho = 1; this.alto = 1;
    this.pendienteMedir = true;

    this.brillo = { intensidad: 0.78, umbral: 1.05, rodilla: 0.5 };
    this.expo = 0.92;
    this.flash = 0; this.flashColor = new THREE.Color(1, 1, 1);
    this.satura = 1.12;

    this._armarPasadas();

    // Medición del cuadro para la calidad automática.
    this._dts = [];
    this._ultimoAjuste = 0;

    const re = () => { this.pendienteMedir = true; };
    window.addEventListener("resize", re);
    if (window.ResizeObserver) new ResizeObserver(re).observe(lienzo);
  }

  _armarPasadas() {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this._malla = new THREE.Mesh(tri, null);
    this._malla.frustumCulled = false;
    this._escPasada = new THREE.Scene();
    this._escPasada.add(this._malla);
    this._camPasada = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.mUmbral = materialPasada(FS_UMBRAL, {
      tFuente: { value: null }, uTexel: { value: new THREE.Vector2() },
      uUmbral: { value: 1 }, uRodilla: { value: 0.5 },
    });
    this.mBajada = materialPasada(FS_BAJADA, { tFuente: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mSubida = materialPasada(FS_SUBIDA, {
      tFuente: { value: null }, tBase: { value: null },
      uTexel: { value: new THREE.Vector2() }, uPeso: { value: 1 },
    });
    this.mRevelado = materialPasada(FS_REVELADO, {
      tEscena: { value: null }, tBrillo: { value: null },
      uBrillo: { value: 1 }, uExpo: { value: 1 }, uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color() }, uVineta: { value: 0.9 }, uSatura: { value: 1.1 },
    });
    this.rtEscena = null;
    this.rtBaja = [];
    this.rtSube = [];
  }

  _crearObjetivos(w, h) {
    for (const rt of [this.rtEscena, ...this.rtBaja, ...this.rtSube]) rt && rt.dispose();
    const opc = {
      type: this.tipo, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false,
      generateMipmaps: false,
    };
    this.rtEscena = new THREE.WebGLRenderTarget(w, h, { ...opc, depthBuffer: true,
      samples: (this.calidad === "alta" && this.renderer.capabilities.isWebGL2) ? 4 : 0 });
    this.rtBaja = []; this.rtSube = [];
    let bw = w, bh = h;
    // Cinco bajadas: la última es 1/32 del ancho, un halo de un tercio de pantalla.
    for (let i = 0; i < 5; i++) {
      bw = Math.max(1, Math.round(bw / 2)); bh = Math.max(1, Math.round(bh / 2));
      this.rtBaja.push(new THREE.WebGLRenderTarget(bw, bh, opc));
      if (i < 4) this.rtSube.push(new THREE.WebGLRenderTarget(bw, bh, opc));
    }
  }

  /** Se llama al EMPEZAR el cuadro: cambiar el tamaño borra el lienzo, y hecho
   *  después de dibujar el navegador muestra un cuadro negro. */
  medir() {
    const cw = this.lienzo.clientWidth || window.innerWidth;
    const ch = this.lienzo.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.topeDPR);
    const esc = this.calidad === "baja" ? Math.min(this.escala, 0.7) : this.escala;
    const w = Math.max(2, Math.round(cw * dpr * esc));
    const h = Math.max(2, Math.round(ch * dpr * esc));
    if (!this.pendienteMedir && w === this.ancho && h === this.alto) return false;
    this.pendienteMedir = false;
    this.ancho = w; this.alto = h;
    this.cssAncho = cw; this.cssAlto = ch;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this._crearObjetivos(w, h);
    this.camara.aspect = cw / ch;
    this.camara.updateProjectionMatrix();
    return true;
  }

  _pasada(material, destino) {
    this._malla.material = material;
    this.renderer.setRenderTarget(destino);
    this.renderer.render(this._escPasada, this._camPasada);
  }

  dibujar() {
    const r = this.renderer;
    r.setRenderTarget(this.rtEscena);
    r.render(this.escena, this.camara);

    // Bajadas.
    let fuente = this.rtEscena;
    for (let i = 0; i < this.rtBaja.length; i++) {
      const m = i === 0 ? this.mUmbral : this.mBajada;
      m.uniforms.tFuente.value = fuente.texture;
      m.uniforms.uTexel.value.set(1 / fuente.width, 1 / fuente.height);
      if (i === 0) {
        m.uniforms.uUmbral.value = this.brillo.umbral;
        m.uniforms.uRodilla.value = this.brillo.rodilla;
      }
      this._pasada(m, this.rtBaja[i]);
      fuente = this.rtBaja[i];
    }
    // Subidas: cada nivel = el de abajo agrandado + su propia bajada.
    for (let i = this.rtSube.length - 1; i >= 0; i--) {
      const m = this.mSubida;
      m.uniforms.tFuente.value = fuente.texture;
      m.uniforms.tBase.value = this.rtBaja[i].texture;
      m.uniforms.uTexel.value.set(0.5 / fuente.width, 0.5 / fuente.height);
      m.uniforms.uPeso.value = 1.0;
      this._pasada(m, this.rtSube[i]);
      fuente = this.rtSube[i];
    }
    const m = this.mRevelado;
    m.uniforms.tEscena.value = this.rtEscena.texture;
    m.uniforms.tBrillo.value = fuente.texture;
    m.uniforms.uBrillo.value = this.brillo.intensidad;
    m.uniforms.uExpo.value = this.expo;
    m.uniforms.uFlash.value = this.flash;
    m.uniforms.uFlashColor.value.copy(this.flashColor);
    m.uniforms.uSatura.value = this.satura;
    this._pasada(m, null);
  }

  /** Calidad automática: si durante 2 s el cuadro pasa de 22 ms, se baja la
   *  resolución interna; si sobra durante 5 s, se sube de a poco. */
  anotarCuadro(dtMs, ahora) {
    if (this.fijo || this.calidad !== "auto") return;
    this._dts.push(dtMs);
    if (this._dts.length > 90) this._dts.shift();
    if (ahora - this._ultimoAjuste < 2000 || this._dts.length < 60) return;
    const orden = [...this._dts].sort((a, b) => a - b);
    const mediana = orden[orden.length >> 1];
    if (mediana > 22 && this.escala > 0.55) {
      this.escala = Math.max(0.55, this.escala - 0.1);
      this.pendienteMedir = true; this._ultimoAjuste = ahora; this._dts.length = 0;
    } else if (mediana < 13 && this.escala < 1 && ahora - this._ultimoAjuste > 5000) {
      this.escala = Math.min(1, this.escala + 0.05);
      this.pendienteMedir = true; this._ultimoAjuste = ahora; this._dts.length = 0;
    }
  }
}
