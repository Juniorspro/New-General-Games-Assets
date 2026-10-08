'use strict';
// Dibujo con WebGL2. Todo en unidades del juego (320 de alto). Las hojas son -hd (2 píxeles por
// unidad), premultiplicadas. Los cuadros se arman como en gdclone (render/object.rs): el recorte
// del cuadro corre el ancla y los cuadros rotados en la hoja giran los ejes.

GD.Render = class {
  constructor(canvas, datos, imagenes) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Este navegador no tiene WebGL2');
    this.datos = datos;
    this.cuadros = datos.cuadros;
    this.texturas = [];
    this.tamTex = [];
    for (const img of imagenes) this.subir(img);
    this.fondos = new Map();
    this.programa();
    this.MAX = 12000;
    this.vb = new Float32Array(this.MAX * 4 * 9);
    this.n = 0;
    this.aditivo = false;
    this.lienzo();
  }

  subir(img) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.texturas.push(t);
    this.tamTex.push([img.width, img.height]);
    return this.texturas.length - 1;
  }

  // fondo y piso: texturas sueltas que se repiten
  textura(clave, img) {
    if (this.fondos.has(clave)) return this.fondos.get(clave);
    const i = this.subir(img);
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    this.fondos.set(clave, i);
    return i;
  }

  programa() {
    const gl = this.gl;
    const vs = `#version 300 es
      in vec2 aP; in vec2 aU; in vec4 aC; in float aT;
      uniform vec2 uV; out vec2 vU; out vec4 vC; flat out int vT;
      void main() { gl_Position = vec4(aP / uV * 2.0 - 1.0, 0.0, 1.0); vU = aU; vC = aC; vT = int(aT + 0.5); }`;
    const ramas = Array.from({ length: 12 }, (_, i) => `${i ? 'else ' : ''}if (vT == ${i}) t = texture(uT[${i}], vU);`).join('\n');
    const fs = `#version 300 es
      precision mediump float;
      uniform sampler2D uT[12]; uniform float uA;
      in vec2 vU; in vec4 vC; flat in int vT; out vec4 o;
      void main() {
        vec4 t = vec4(0.0);
        ${ramas}
        // aditivo como GD: GL_SRC_ALPHA, GL_ONE sobre texturas premultiplicadas (el alfa dos veces)
        if (uA > 0.5) o = vec4(t.rgb * vC.rgb * t.a * vC.a * vC.a, 0.0);
        else o = vec4(t.rgb * vC.rgb * vC.a, t.a * vC.a);
      }`;
    const sh = (tipo, src) => {
      const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = this.prog = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    gl.useProgram(p);
    this.uV = gl.getUniformLocation(p, 'uV');
    this.uA = gl.getUniformLocation(p, 'uA');
    gl.uniform1iv(gl.getUniformLocation(p, 'uT'), Array.from({ length: 12 }, (_, i) => i));
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, 12000 * 4 * 9 * 4, gl.DYNAMIC_DRAW);
    const attr = (nombre, n, desde) => {
      const l = gl.getAttribLocation(p, nombre);
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, n, gl.FLOAT, false, 36, desde * 4);
    };
    attr('aP', 2, 0); attr('aU', 2, 2); attr('aC', 4, 4); attr('aT', 1, 8);
    // índices: 4 vértices por cuadro (Uint32 para pasar de 16 mil vértices)
    const ind = new Uint32Array(12000 * 6);
    for (let i = 0; i < 12000; i++) ind.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ind, gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  // Tamaño del lienzo (con tope de densidad: PORTEO §8) y de la vista en unidades.
  lienzo() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    this.VH = GD.ALTO;
    this.VW = GD.ALTO * w / h;
  }

  empezar(r, g, b) {
    const gl = this.gl;
    this.lienzo();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniform2f(this.uV, this.VW, this.VH);
    for (let i = 0; i < this.texturas.length && i < 12; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.texturas[i]);
    }
    this.n = 0;
    this.modo(false);
  }

  modo(aditivo) {
    if (this.aditivo === aditivo && this.n) return;
    this.vaciar();
    this.aditivo = aditivo;
    const gl = this.gl;
    gl.uniform1f(this.uA, aditivo ? 1 : 0);
    if (aditivo) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  vaciar() {
    if (!this.n) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vb, 0, this.n * 36);
    gl.drawElements(gl.TRIANGLES, this.n * 6, gl.UNSIGNED_INT, 0);
    this.n = 0;
  }

  terminar() { this.vaciar(); }

  // Un cuadrilátero: 4 esquinas (x, y), rectángulo de textura en píxeles, color y hoja.
  quad(px, py, hoja, u0, v0, u1, v1, c) {
    if (this.n >= this.MAX) this.vaciar();
    const [tw, th] = this.tamTex[hoja];
    const b = this.vb, i = this.n * 36;
    const uv = [u0 / tw, v1 / th, u1 / tw, v1 / th, u0 / tw, v0 / th, u1 / tw, v0 / th];
    for (let k = 0; k < 4; k++) {
      const o = i + k * 9;
      b[o] = px[k]; b[o + 1] = py[k]; b[o + 2] = uv[k * 2]; b[o + 3] = uv[k * 2 + 1];
      b[o + 4] = c[0]; b[o + 5] = c[1]; b[o + 6] = c[2]; b[o + 7] = c[3]; b[o + 8] = hoja;
    }
    this.n++;
  }

  // Un cuadro del atlas con una matriz (a, b, c, d, tx, ty: x' = a x + c y + tx) en unidades.
  cuadro(nombre, M, color, ancla) {
    const f = this.cuadros[nombre];
    if (!f) return false;
    const [hoja, fx, fy, fw, fh, rot, ox, oy] = f;
    const rw = rot ? fh : fw, rh = rot ? fw : fh;      // la región en la hoja
    let a = M[0], b = M[1], c = M[2], d = M[3];
    if (rot) { const ya = -a, yb = -b; a = c; b = d; c = ya; d = yb; }
    // ancla del cuadro: -(desplazamiento / tamaño), girada si el cuadro está rotado
    let ax = -ox / fw, ay = -oy / fh;
    if (rot) { const t = ax; ax = ay; ay = -t; }
    ax += ancla ? ancla[0] : 0; ay += ancla ? ancla[1] : 0;
    const qw = rw / GD.ESCALA_HD, qh = rh / GD.ESCALA_HD;
    const x0 = qw * (-ax - 0.5), y0 = qh * (-ay - 0.5), x1 = x0 + qw, y1 = y0 + qh;
    const px = [], py = [];
    for (const [lx, ly] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
      px.push(a * lx + c * ly + M[4]);
      py.push(b * lx + d * ly + M[5]);
    }
    this.quad(px, py, hoja, fx, fy, fx + rw, fy + rh, color);
    return true;
  }

  // Atajo: cuadro centrado en (x, y) con escala, giro (grados horarios) y color.
  sprite(nombre, x, y, escala = 1, giro = 0, color = [1, 1, 1, 1], ex, ey) {
    const r = -giro * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    const sx = (ex ?? 1) * escala, sy = (ey ?? 1) * escala;
    this.cuadro(nombre, [cs * sx, sn * sx, -sn * sy, cs * sy, x, y], color);
  }

  tamCuadro(nombre) {
    const f = this.cuadros[nombre];
    return f ? [f[7] / GD.ESCALA_HD, f[8] / GD.ESCALA_HD] : [0, 0];
  }

  // Texto con las fuentes bitmap del juego (bigFont, goldFont, chatFont).
  texto(fuente, s, x, y, escala = 1, color = [1, 1, 1, 1], alinear = 0.5) {
    const F = this.datos.fuentes[fuente];
    if (!F) return 0;
    const k = escala / GD.ESCALA_HD;
    let ancho = 0;
    for (const ch of s) { const c = F.chars[ch.charCodeAt(0)]; if (c) ancho += c[6]; }
    let pen = x - ancho * k * alinear;
    const top = y + (F.alto / 2) * k;
    for (const ch of s) {
      const c = F.chars[ch.charCodeAt(0)];
      if (!c) continue;
      const [cx, cy, cw, chh, xo, yo, xa] = c;
      if (cw && chh) {
        const x0 = pen + xo * k, y1 = top - yo * k, x1 = x0 + cw * k, y0 = y1 - chh * k;
        this.quad([x0, x1, x0, x1], [y0, y0, y1, y1], F.hoja, F.x + cx, F.y + cy, F.x + cx + cw, F.y + cy + chh, color);
      }
      pen += xa * k;
    }
    return ancho * k;
  }

  // Rectángulo liso (con el píxel blanco del centro de un cuadro sólido de la hoja)
  rect(x0, y0, x1, y1, color) {
    const f = this.cuadros['square_01_001.png'];
    if (!f) return;
    const u = f[1] + f[3] / 2, v = f[2] + f[4] / 2;
    this.quad([x0, x1, x0, x1], [y0, y0, y1, y1], f[0], u, v, u + 0.5, v + 0.5, color);
  }

  // Fondo o piso repetido: la textura entera cubre `tam` unidades.
  mosaico(tex, x0, y0, x1, y1, tam, desdeX, desdeY, color) {
    const [tw, th] = this.tamTex[tex];
    const u0 = (x0 - desdeX) / tam * tw, u1 = (x1 - desdeX) / tam * tw;
    const v1 = -(y0 - desdeY) / tam * th, v0 = -(y1 - desdeY) / tam * th;
    this.quad([x0, x1, x0, x1], [y0, y0, y1, y1], tex, u0, v0 + th, u1, v1 + th, color);
  }
};
