/* brillo/js/post.js — lo que le pasa al dibujo antes de verse.
   El juego se dibuja en píxeles del juego (640x360 o parecido) en un canvas
   2D. Acá se agranda con escala entera (cada píxel, un cuadrado parejo) y se
   le suma en WebGL2 lo que hace al Frutiger Aero:
   - el brillo que se derrama (bloom) de todo lo que tiene mucha luz;
   - el destello del sol en el lente: fantasmas de colores en la línea que va
     del sol al centro, y un aro;
   - los rayos de luz que salen del sol entre las cosas;
   - la gradación de color de cada mundo, y un velo claro en los bordes;
   - abajo del agua, las filas se ondulan de a píxel entero (sigue nítido).
   Sin WebGL2 se dibuja igual, agrandado y sin efectos. */

const VERT = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

/* la luz fuerte: lo que pasa el umbral, con un poco más de peso en los blancos azulados */
const EXTRAER = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D base; uniform float umbral;
void main() {
  vec3 c = texture(base, uv).rgb;
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  float k = smoothstep(umbral, 1.0, l);
  o = vec4(c * k, 1.0);
}`;

/* desenfoque en una dirección (9 muestras con pesos de campana) */
const BORRONEAR = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D fuente; uniform vec2 paso;
void main() {
  vec3 s = texture(fuente, uv).rgb * 0.2270;
  s += (texture(fuente, uv + paso * 1.3846).rgb + texture(fuente, uv - paso * 1.3846).rgb) * 0.3162;
  s += (texture(fuente, uv + paso * 3.2308).rgb + texture(fuente, uv - paso * 3.2308).rgb) * 0.0703;
  o = vec4(s, 1.0);
}`;

const FINAL = `#version 300 es
precision mediump float;
in vec2 uv; out vec4 o;
uniform sampler2D base, brillo1, brillo2;
uniform vec2 tam;          // píxeles del juego
uniform vec2 sol;          // el sol en la pantalla (0-1, y para arriba)
uniform float bloom, destello, rayos, t, olas, olasDesde, velo;
uniform vec3 tinte, levantar; uniform float sat, contraste;
vec3 muestra(sampler2D s, vec2 q) { return texture(s, clamp(q, 0.0, 1.0)).rgb; }
void main() {
  vec2 q = uv;
  /* abajo del agua: cada fila corrida un número entero de píxeles */
  float fila = floor((1.0 - q.y) * tam.y);
  if (olas > 0.0 && (1.0 - q.y) * tam.y > olasDesde) q.x += floor(sin(fila * 0.19 + t * 2.3) * olas + 0.5) / tam.x;
  vec3 c = texture(base, q).rgb;
  /* bloom: dos tamaños */
  vec3 b = muestra(brillo1, q) * 0.7 + muestra(brillo2, q) * 0.9;
  c += b * bloom;
  /* el destello del lente: fantasmas del lado opuesto al sol, cada uno de otro color */
  if (destello > 0.0) {
    vec2 eje = vec2(0.5) - sol;
    vec3 f = vec3(0.0);
    for (int i = 1; i <= 4; i++) {
      float k = float(i) * 0.42;
      vec2 g = sol + eje * k * 2.0;
      float d = length((uv - g) * vec2(tam.x / tam.y, 1.0));
      float r = 0.018 + 0.018 * float(i);
      float disco = smoothstep(r, r * 0.55, d) * 0.55;
      vec3 col = i == 1 ? vec3(0.4, 0.9, 1.0) : i == 2 ? vec3(0.6, 1.0, 0.55) : i == 3 ? vec3(1.0, 0.75, 0.5) : vec3(0.75, 0.6, 1.0);
      f += col * disco * muestra(brillo2, sol).r * 1.6;
    }
    /* el aro alrededor del sol */
    float d = length((uv - sol) * vec2(tam.x / tam.y, 1.0));
    f += vec3(0.7, 0.9, 1.0) * smoothstep(0.01, 0.0, abs(d - 0.2)) * 0.09;
    c += f * destello;
  }
  /* los rayos: la luz fuerte, arrastrada desde el sol */
  if (rayos > 0.0) {
    vec3 r = vec3(0.0);
    vec2 dir = (uv - sol) / 18.0;
    vec2 m = uv;
    float peso = 1.0;
    for (int i = 0; i < 18; i++) { m -= dir; r += muestra(brillo2, m) * peso; peso *= 0.9; }
    c += r / 18.0 * rayos * 2.2;
  }
  /* la gradación del mundo */
  c = (c - 0.5) * contraste + 0.5;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, sat) * tinte + levantar;
  /* el velo claro de los bordes (el Aero no oscurece: aclara) */
  vec2 e = uv - 0.5;
  c = mix(c, vec3(0.93, 0.97, 1.0), smoothstep(0.25, 0.75, dot(e, e) * 2.0) * velo);
  o = vec4(c, 1.0);
}`;

function compilar(gl, fuente, tipo) {
  const s = gl.createShader(tipo); gl.shaderSource(s, fuente); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function programa(gl, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compilar(gl, VERT, gl.VERTEX_SHADER)); gl.attachShader(p, compilar(gl, frag, gl.FRAGMENT_SHADER));
  gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

export const GRADO_NEUTRO = { tinte: [1, 1, 1], levantar: [0, 0, 0], sat: 1.08, contraste: 1.04 };

export class Post {
  constructor(canvas) {
    this.canvas = canvas;
    this.calidad = 'alta';
    let gl = null;
    try { gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, depth: false, stencil: false }); } catch (_) {}
    this.gl = gl;
    if (!gl) { this.g2 = canvas.getContext('2d'); return; }
    try {
      this.pExtraer = programa(gl, EXTRAER); this.pBorronear = programa(gl, BORRONEAR); this.pFinal = programa(gl, FINAL);
    } catch (e) { console.warn('post:', e.message); this.gl = null; this.g2 = canvas.getContext('2d'); return; }
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.tBase = this.textura(gl.NEAREST);
    this.w = 0; this.h = 0;
  }
  textura(filtro) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtro);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  destino(w, h) {
    const gl = this.gl, t = this.textura(gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  /* el tamaño: w x h del juego, escala entera, y el tamaño en la página */
  tamano(w, h, escala, css) {
    const c = this.canvas;
    c.width = w * escala; c.height = h * escala;
    Object.assign(c.style, { width: css.w + 'px', height: css.h + 'px', left: css.x + 'px', top: css.y + 'px' });
    if (!this.gl || (w === this.w && h === this.h)) { this.w = w; this.h = h; return; }
    this.w = w; this.h = h;
    this.b1 = this.destino(w >> 1, h >> 1); this.b1b = this.destino(w >> 1, h >> 1);
    this.b2 = this.destino(w >> 3, h >> 3); this.b2b = this.destino(w >> 3, h >> 3);
  }
  pasada(prog, dest, fn) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dest ? dest.f : null);
    gl.viewport(0, 0, dest ? dest.w : this.canvas.width, dest ? dest.h : this.canvas.height);
    gl.useProgram(prog.p); fn(prog.u);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  usar(unidad, tex, loc) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unidad); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unidad); }
  borronear(a, b, veces) {
    const gl = this.gl;
    for (let i = 0; i < veces; i++) {
      this.pasada(this.pBorronear, b, (u) => { this.usar(0, a.t, u.fuente); gl.uniform2f(u.paso, 1 / a.w, 0); });
      this.pasada(this.pBorronear, a, (u) => { this.usar(0, b.t, u.fuente); gl.uniform2f(u.paso, 0, 1 / a.h); });
    }
  }
  /* o: { sol:[x,y] (0-1, y para abajo), bloom, destello, rayos, umbral, grado, olas, olasDesde, velo, t } */
  mostrar(fuente, o) {
    const gl = this.gl;
    if (!gl) {
      const g = this.g2; g.imageSmoothingEnabled = false;
      g.drawImage(fuente, 0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tBase);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
    const baja = this.calidad === 'baja';
    const G = o.grado || GRADO_NEUTRO;
    if (!baja) {
      this.pasada(this.pExtraer, this.b1, (u) => { this.usar(0, this.tBase, u.base); gl.uniform1f(u.umbral, o.umbral ?? 0.72); });
      this.borronear(this.b1, this.b1b, 1);
      this.pasada(this.pExtraer, this.b2, (u) => { this.usar(0, this.b1.t, u.base); gl.uniform1f(u.umbral, 0.0); });
      this.borronear(this.b2, this.b2b, 2);
    }
    this.pasada(this.pFinal, null, (u) => {
      this.usar(0, this.tBase, u.base);
      this.usar(1, baja ? this.tBase : this.b1.t, u.brillo1); this.usar(2, baja ? this.tBase : this.b2.t, u.brillo2);
      gl.uniform2f(u.tam, this.w, this.h);
      const s = o.sol || [0.8, 0.15];
      gl.uniform2f(u.sol, s[0], 1 - s[1]);
      gl.uniform1f(u.bloom, baja ? 0 : o.bloom ?? 0.55);
      gl.uniform1f(u.destello, baja ? 0 : o.destello ?? 0);
      gl.uniform1f(u.rayos, baja ? 0 : o.rayos ?? 0);
      gl.uniform1f(u.t, o.t || 0);
      gl.uniform1f(u.olas, o.olas || 0); gl.uniform1f(u.olasDesde, o.olasDesde ?? 0);
      gl.uniform1f(u.velo, o.velo ?? 0.18);
      gl.uniform3fv(u.tinte, G.tinte); gl.uniform3fv(u.levantar, G.levantar);
      gl.uniform1f(u.sat, G.sat); gl.uniform1f(u.contraste, G.contraste);
    });
  }
}
