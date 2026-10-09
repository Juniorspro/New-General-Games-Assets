// porteo: WebGL y los shaders del juego. Los .vertex/.fragment de MCPE (los de Tito) se compilan como
// los compila el juego: "#version 300 es" (o 100 en WebGL 1) adelante, precisión alta (los uniformes
// se comparten entre las dos etapas y GLSL ES exige la misma precisión en las dos), los tipos POS3,
// POS4 y MAT4 y los "defines" de cada material de materials/*.material (terrain_opaque_fog, etc.).
var GL = (function () {
  'use strict';
  var GL = {};
  var gl = null;

  GL.iniciar = function (lienzo) {
    var op = { antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    gl = lienzo.getContext('webgl2', op);
    GL.v2 = !!gl;
    if (!gl) {
      gl = lienzo.getContext('webgl', op) || lienzo.getContext('experimental-webgl', op);
      if (!gl) return null;
      gl.getExtension('OES_element_index_uint');
      var vao = gl.getExtension('OES_vertex_array_object');
      if (vao) {
        gl.createVertexArray = function () { return vao.createVertexArrayOES(); };
        gl.bindVertexArray = function (v) { vao.bindVertexArrayOES(v); };
        gl.deleteVertexArray = function (v) { vao.deleteVertexArrayOES(v); };
      }
    }
    GL.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    GL.anisoMax = GL.aniso ? gl.getParameter(GL.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1 : 1;
    var f = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    GL.altaEnFragmentos = !!(f && f.precision > 0);
    // el nombre de la GPU: en las viejas o chicas (las de los teléfonos de 1 GB) se empieza con menos
    // píxeles
    try {
      var di = gl.getExtension('WEBGL_debug_renderer_info');
      GL.gpu = di ? String(gl.getParameter(di.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    } catch (e) { GL.gpu = ''; }
    GL.floja = /Mali-(4|T6|T7)|Adreno \(TM\) [1-4]\d\d|PowerVR (SGX|Rogue G)|Vivante|VideoCore|GC\d{3,4}/i.test(GL.gpu);
    GL.gl = gl;
    return gl;
  };

  var ATRIBUTOS = ['POSITION', 'COLOR', 'TEXCOORD_0', 'TEXCOORD_1', 'NORMAL'];

  function compilar(tipo, texto, nombre) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, texto);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      console.error('shader ' + nombre + ': ' + log);
      throw new Error('shader ' + nombre + ': ' + log);
    }
    return s;
  }

  function cabecera(defines) {
    // como el juego (ShaderProgramOGL): "precision mediump float" en las dos etapas y POS3/POS4/MAT4 en
    // la precisión más alta que tenga el teléfono. Con highp en todo (lo que había) cada fragmento se
    // calculaba en 32 bits: en las GPU de los teléfonos, mediump va al doble de velocidad
    var p = GL.altaEnFragmentos ? 'highp' : 'mediump';
    var h = (GL.v2 ? '#version 300 es\n' : '#version 100\n') +
      'precision mediump float;\n' +
      '#define POS4 ' + p + ' vec4\n#define POS3 ' + p + ' vec3\n#define MAT4 ' + p + ' mat4\n#define MAT3 ' + p + ' mat3\n';
    for (var i = 0; i < defines.length; i++) h += '#define ' + defines[i] + '\n';
    return h;
  }

  // un material: los dos shaders del juego con sus defines → programa con la ubicación de cada uniforme
  GL.material = function (fuentes, vertice, fragmento, defines) {
    var h = cabecera(defines || []);
    var vs = compilar(gl.VERTEX_SHADER, h + fuentes[vertice], vertice);
    var fs = compilar(gl.FRAGMENT_SHADER, h + fuentes[fragmento], fragmento);
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs);
    for (var i = 0; i < ATRIBUTOS.length; i++) gl.bindAttribLocation(p, i, ATRIBUTOS[i]);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(p);
      console.error('programa ' + vertice + '+' + fragmento + ': ' + log);
      throw new Error('programa ' + vertice + '+' + fragmento + ': ' + log);
    }
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i), nombre = info.name.replace(/\[0\]$/, '');
      u[nombre] = gl.getUniformLocation(p, info.name);
    }
    var m = { p: p, u: u, defines: defines };
    gl.useProgram(p);
    if (u.TEXTURE_0) gl.uniform1i(u.TEXTURE_0, 0);
    if (u.TEXTURE_1) gl.uniform1i(u.TEXTURE_1, 1);
    if (u.TEXTURE_2) gl.uniform1i(u.TEXTURE_2, 2);
    return m;
  };

  // un shader propio (para lo que el juego no trae: la interfaz 3D de los íconos, etc.)
  GL.programa = function (v, f, defines) {
    return GL.material({ v: v, f: f }, 'v', 'f', defines);
  };

  GL.textura = function (imagen, filtro, mip, repetir) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagen);
    var f = filtro === 'lineal' || filtro === 'suave' ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      // 'suave': trilineal (el panorama); si no, como la versión de PC: los píxeles de la textura tal
      // cual y entre mipmaps el promedio (el atlas del terreno: ver Render.filtrarAtlas)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtro === 'suave' ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST_MIPMAP_LINEAR);
      if (GL.v2) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, mip);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    var w = repetir ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    return t;
  };

  // matrices (columna mayor, como WebGL)
  GL.mat4 = function () { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  GL.perspectiva = function (m, fovy, aspecto, cerca, lejos) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (cerca - lejos);
    m.fill(0);
    m[0] = f / aspecto; m[5] = f; m[10] = (lejos + cerca) * nf; m[11] = -1; m[14] = 2 * lejos * cerca * nf;
    return m;
  };
  // vista: girar por guiñada (yaw, alrededor de y) y cabeceo (pitch, alrededor de x), sin traslación
  GL.vista = function (m, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // R = Rx(pitch) * Ry(yaw)
    m[0] = cy; m[1] = sp * sy; m[2] = -cp * sy; m[3] = 0;
    m[4] = 0; m[5] = cp; m[6] = sp; m[7] = 0;
    m[8] = sy; m[9] = -sp * cy; m[10] = cp * cy; m[11] = 0;
    m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
    return m;
  };
  GL.mult = function (out, a, b) {
    var r = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var f = 0; f < 4; f++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + f] * b[c * 4 + k];
      r[c * 4 + f] = s;
    }
    out.set(r);
    return out;
  };
  GL.trasladar = function (m, x, y, z) {
    m[12] += m[0] * x + m[4] * y + m[8] * z;
    m[13] += m[1] * x + m[5] * y + m[9] * z;
    m[14] += m[2] * x + m[6] * y + m[10] * z;
    m[15] += m[3] * x + m[7] * y + m[11] * z;
    return m;
  };

  return GL;
})();
