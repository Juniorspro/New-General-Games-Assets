// Lo que pasa entre el dibujo y la pantalla: los rayos del sol, el tono de
// película y la cinta VHS.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUÉ EL VHS HACE QUE SE VEA MÁS REAL, Y NO MÁS FEO.
// ═══════════════════════════════════════════════════════════════════════════
// Un render limpio delata todo lo que es falso: los bordes perfectos de las
// hojas recortadas, la repetición de la textura, los colores demasiado puros.
// Una cinta de video borra justo eso: la luminancia llega con unos 330
// "puntos" por línea y el COLOR con apenas 40, así que el color se corre y
// sangra hacia la derecha; los bordes se ablandan y además la electrónica los
// "afila" con un halo claro; hay ruido que cambia en cada cuadro, líneas que
// tiemblan y una franja rota abajo donde conmuta el cabezal. El ojo reconoce
// esos defectos como los de una grabación de verdad, y le perdona al bosque lo
// que de otro modo notaría.
//
// Esto NO es un filtro de colores. Se separa la imagen en luminancia y
// crominancia (YIQ, lo que usa la señal de video) y cada una se degrada con su
// propio ancho de banda, en ese orden.
//
// Y DE PASO ES LA MANERA MÁS BARATA DE DIBUJAR: la escena se dibuja a ~480
// líneas, que es lo que tiene una cinta. En un teléfono son la cuarta parte de
// los pixeles de su pantalla.
import * as THREE from "three";

const TRIANGULO = new THREE.BufferGeometry();
TRIANGULO.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));

const VERT = `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Tono de película: AgX, el que usa Blender. ACES empuja los rojos del
// atardecer hacia el naranja chillón; AgX los deja ir hacia el blanco como una
// cámara de verdad cuando se saturan.
const AGX = `
  vec3 agxContraste(vec3 x) {
    vec3 x2 = x * x, x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
  }
  vec3 agx(vec3 c) {
    const mat3 entrada = mat3(0.842479, 0.0423282, 0.0423756, 0.0784336, 0.878468, 0.0784336, 0.0792237, 0.0791661, 0.879142);
    const mat3 salida = mat3(1.19688, -0.0528968, -0.0529716, -0.0980209, 1.15190, -0.0980435, -0.0990297, -0.0989612, 1.15107);
    c = entrada * c;
    c = clamp(log2(max(c, 1e-10)), -12.47393, 4.026069);
    c = (c + 12.47393) / 16.5;
    c = agxContraste(c);
    c = salida * c;
    return pow(max(c, 0.0), vec3(2.2));
  }
  vec3 aSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    const gl = renderer.getContext();
    // COMA FLOTANTE SI SE PUEDE. En 8 bits el sol vale lo mismo que una nube
    // blanca y el cielo del atardecer se parte en escalones de color. Casi
    // todos los teléfonos con WebGL2 dibujan en media precisión; los que no,
    // caen a 8 bits y el ruido del VHS disimula los escalones.
    this.flotante = !!(renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"));
    const tipo = this.flotante ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: tipo, depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(4, 4);
    this.rt.depthTexture.type = THREE.UnsignedIntType;
    this.rtRayos = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: false });
    // LA IMAGEN SE REVELA UNA SOLA VEZ. El VHS lee cada pixel ~19 veces (los
    // borrones de luminancia y de color); si cada lectura aplicara el tono,
    // los rayos y la fecha, serían 19 veces todo ese cálculo por pixel. Se
    // revela a una textura de 8 bits y el VHS lee de ahí.
    this.rtRevelado = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.U = {
      tEscena: { value: this.rt.texture },
      tProf: { value: this.rt.depthTexture },
      tRayos: { value: this.rtRayos.texture },
      tRevelado: { value: this.rtRevelado.texture },
      tOsd: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uSolPantalla: { value: new THREE.Vector3(0.5, 0.5, 0) },   // z: cuánto se ve el sol
      uT: { value: 0 },
      uVHS: { value: 1 },
      uInterferencia: { value: 0 },   // sube cerca de una cinta sin recoger
      uExpo: { value: 1.0 },
      uAzul: { value: 0 },            // pantalla azul de "sin señal"
      uNear: { value: 0.1 }, uFar: { value: 1100 },
    };

    // ── los rayos: desde cada pixel hacia el sol, contando cuánto cielo hay
    this.matRayos = new THREE.ShaderMaterial({
      uniforms: this.U, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: `
        uniform sampler2D tProf, tEscena;
        uniform vec3 uSolPantalla;
        varying vec2 vUv;
        void main() {
          if (uSolPantalla.z <= 0.0) { gl_FragColor = vec4(0.0); return; }
          vec2 d = (uSolPantalla.xy - vUv) / 30.0 * 0.9;
          vec2 p = vUv;
          float luz = 0.0, peso = 1.0;
          for (int i = 0; i < 30; i++) {
            float z = texture2D(tProf, p).r;
            // cielo = profundidad 1 (el cielo no escribe profundidad)
            float cielo = step(0.99999, z);
            vec3 c = texture2D(tEscena, p).rgb;
            luz += cielo * min(dot(c, vec3(0.3, 0.59, 0.11)), 4.0) * peso;
            peso *= 0.955;
            p += d;
          }
          luz /= 30.0;
          // más fuerte cerca del sol, que es de donde salen
          float cerca = 1.0 - smoothstep(0.0, 0.9, length((vUv - uSolPantalla.xy) * vec2(1.6, 1.0)));
          gl_FragColor = vec4(vec3(luz * cerca * uSolPantalla.z), 1.0);
        }`,
    });

    this.matRevelar = new THREE.ShaderMaterial({
      uniforms: this.U, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: `
        uniform sampler2D tEscena, tRayos, tOsd;
        uniform float uExpo;
        varying vec2 vUv;
        ${AGX}
        void main() {
          vec3 c = texture2D(tEscena, vUv).rgb * uExpo;
          c += texture2D(tRayos, vUv).rgb * vec3(1.0, 0.72, 0.42) * 0.55;
          c = aSRGB(agx(c));
          // la fecha de la cámara quedó grabada: entra en la señal, no encima
          vec4 o = texture2D(tOsd, vUv);
          gl_FragColor = vec4(mix(c, o.rgb, o.a), 1.0);
        }`,
    });

    this.matFinal = new THREE.ShaderMaterial({
      uniforms: this.U, vertexShader: VERT, depthTest: false, depthWrite: false,
      fragmentShader: `
        uniform sampler2D tRevelado;
        uniform vec2 uRes;
        uniform float uT, uVHS, uInterferencia, uAzul;
        varying vec2 vUv;
        float h1(float n) { return fract(sin(n) * 43758.5453); }
        float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float ruido1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
        vec3 revelado(vec2 uv) { return texture2D(tRevelado, uv).rgb; }
        vec3 aYIQ(vec3 c) { return mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * c; }
        vec3 deYIQ(vec3 c) { return mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * c; }

        void main() {
          vec2 uv = vUv;
          if (uVHS < 0.5) {
            // sin cinta: un grano apenas y la viñeta
            vec3 c = revelado(uv);
            c += (h2(uv * uRes + fract(uT) * 91.0) - 0.5) * 0.025;
            float vi = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(1.1, 1.0)));
            gl_FragColor = vec4(c * mix(0.72, 1.0, vi), 1.0);
            return;
          }
          float lineas = uRes.y;
          float fila = floor(uv.y * lineas);
          float inter = uInterferencia;

          // ── la mecánica de la cinta: las líneas no caen exactas ──
          float temblor = (h1(fila * 1.7 + floor(uT * 30.0) * 13.1) - 0.5) * (0.0009 + inter * 0.004);
          // la franja de tracking que sube despacio por la pantalla
          float yb = fract(uT * 0.045 + ruido1(uT * 0.3) * 0.2);
          float franja = exp(-pow((uv.y - yb) * (14.0 - inter * 6.0), 2.0));
          temblor += franja * (0.004 + inter * 0.03) * (ruido1(fila * 0.35 + uT * 20.0) - 0.4);
          // el cabezal conmuta abajo de todo: esas líneas llegan rotas
          float cabezal = 1.0 - smoothstep(0.0, 0.028, uv.y);
          temblor += cabezal * (0.03 + 0.02 * ruido1(uT * 8.0 + fila));
          // con interferencia, además, la imagen entera se sacude a veces
          temblor += inter * inter * 0.02 * step(0.93, h1(floor(uT * 12.0))) * (h1(fila + uT) - 0.5);
          uv.x += temblor;

          // ── ancho de banda: la luminancia con ~330 puntos por línea, el
          // color con ~45, y el color llega tarde (se corre a la derecha) ──
          float px = 1.0 / uRes.x;
          float anchoY = max(px, 1.0 / 330.0) * 0.7;
          float anchoC = 1.0 / 45.0;
          float y = 0.0, yLejos = 0.0;
          for (int i = -2; i <= 2; i++) {
            float w = 1.0 - abs(float(i)) * 0.22;
            y += aYIQ(revelado(uv + vec2(float(i) * anchoY, 0.0))).x * w;
          }
          y /= 3.8;
          // un borrón más ancho para el "afilado" de la electrónica
          for (int i = -3; i <= 3; i++) yLejos += aYIQ(revelado(uv + vec2(float(i) * anchoY * 2.2, 0.0))).x;
          yLejos /= 7.0;
          vec2 iq = vec2(0.0);
          for (int i = -3; i <= 3; i++) iq += aYIQ(revelado(uv + vec2(float(i) * anchoC / 3.0 - anchoC * 0.55, 0.0))).yz;
          iq /= 7.0;
          // el halo claro al lado de los bordes: la cinta afilando lo que borroneó
          y += (y - yLejos) * 0.55;
          // la cinta pierde saturación y aplasta los extremos
          iq *= 0.82;
          y = mix(0.035, 0.96, y);

          // ruido: grano en la luminancia, manchas lentas en el color
          float g = h2(vec2(uv.x * uRes.x * 0.5, fila) + floor(uT * 30.0) * 3.7) - 0.5;
          y += g * (0.05 + inter * 0.12);
          iq += (vec2(ruido1(uv.x * 40.0 + fila * 7.0 + uT * 50.0), ruido1(uv.x * 37.0 - fila * 5.0 + uT * 47.0)) - 0.5) * (0.035 + inter * 0.1);
          // pérdidas: rayitas blancas que aparecen y se van
          float perdida = step(0.9994 - inter * 0.004, h1(fila * 3.1 + floor(uT * 24.0) * 17.0)) * step(0.62, ruido1(uv.x * 30.0 + uT * 90.0));
          y = mix(y, 0.95, perdida * 0.8);
          y = mix(y, h2(uv * uRes + uT) * 0.9, cabezal * 0.55);

          vec3 c = deYIQ(vec3(y, iq));
          // líneas de barrido apenas visibles
          c *= 0.94 + 0.06 * sin(uv.y * lineas * 3.14159);
          // el tubo: esquinas más oscuras
          float vi = smoothstep(1.3, 0.4, length((vUv - 0.5) * vec2(1.05, 1.0)));
          c *= mix(0.62, 1.0, vi);
          // "sin señal": el azul de la casetera cuando se cambia de cinta
          c = mix(c, vec3(0.08, 0.16, 0.72) + g * 0.03, uAzul);
          gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
        }`,
    });
    this.quadRayos = new THREE.Mesh(TRIANGULO, this.matRayos);
    this.quadRevelar = new THREE.Mesh(TRIANGULO, this.matRevelar);
    this.quadFinal = new THREE.Mesh(TRIANGULO, this.matFinal);
    for (const q of [this.quadRayos, this.quadRevelar, this.quadFinal]) q.frustumCulled = false;
    this.w = 0; this.h = 0;
  }

  tamano(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.rt.setSize(w, h);
    this.rtRayos.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.rtRevelado.setSize(w, h);
    this.U.uRes.value.set(w, h);
  }

  /** Dónde cae el sol en la pantalla, y cuánto se ve (0 si está detrás). */
  sol(cam, dir) {
    _v.copy(cam.position).addScaledVector(dir, 500).project(cam);
    const delante = cam.getWorldDirection(_d).dot(dir);
    const s = this.U.uSolPantalla.value;
    s.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5, Math.max(0, delante) ** 0.5);
    // fuera de la pantalla los rayos se apagan de a poco, no de golpe
    const fuera = Math.max(Math.abs(_v.x), Math.abs(_v.y));
    s.z *= 1 - Math.min(1, Math.max(0, fuera - 1.0) / 0.9);
  }

  dibujar(escena, cam, t) {
    const r = this.r;
    this.U.uT.value = t;
    r.setRenderTarget(this.rt);
    r.render(escena, cam);
    r.setRenderTarget(this.rtRayos);
    r.render(this.quadRayos, this.cam);
    r.setRenderTarget(this.rtRevelado);
    r.render(this.quadRevelar, this.cam);
    r.setRenderTarget(null);
    r.render(this.quadFinal, this.cam);
  }
}
const _v = new THREE.Vector3(), _d = new THREE.Vector3();
