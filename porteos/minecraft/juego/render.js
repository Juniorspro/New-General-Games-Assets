// porteo: lo que se dibuja. El terreno, el cielo, las nubes, el sol, la luna y las estrellas con los
// materiales del juego: los shaders de Tito (la opción "con shaders") o los de fábrica de la 1.2,
// recibiendo lo mismo que les da MCPE: posiciones de cada sub-trozo relativas a la cámara
// (CHUNK_ORIGIN_AND_SCALE), la vista sin traslación (WORLDVIEW), VIEW_POS, TIME en segundos, la niebla
// (FOG_COLOR, FOG_CONTROL, RENDER_DISTANCE) y el mapa de luz (TEXTURE_1: 16x16, x luz de bloque, y luz
// de cielo) que el juego rehace en cada cuadro según la hora. También los bichos y los otros jugadores
// (los modelos de modelos.js).
var Render = (function () {
  'use strict';
  var R = {};
  var gl, M = {}, atlas, mapaLuz, luzPix = new Uint8Array(16 * 16 * 4), indices, maxQuads = 0;
  var cols = new Map();             // clave "cx,cz" → columna (sus 8 sub-trozos en un búfer de la GPU)
  var proy = GL.mat4(), vista = GL.mat4(), vp = GL.mat4(), tmp = GL.mat4();
  var planos = new Float32Array(24);
  R.stats = { columnas: 0, dibujadas: 0, quads: 0, llamadas: 0 };

  // ------------------------------------------------------------------------------------------
  // Los materiales. Con shaders: los de Tito (renderchunk, sky, cloud...) con los "defines" de cada
  // material del juego; "Gráficos sofisticados" es su define FANCY. Sin shaders: los del MCPE de fábrica
  // (textura x color x mapa de luz, con niebla; cielo de dos colores; nubes planas de clouds.png): mucho
  // más livianos, para los teléfonos flojos. Se compilan al elegirlos y quedan guardados.
  // ------------------------------------------------------------------------------------------
  var FABRICA = {
    'chunk.v': '#if __VERSION__ >= 300\n#define attribute in\n#define varying out\n#endif\n' +
      'attribute POS4 POSITION; attribute vec4 COLOR; attribute vec2 TEXCOORD_0; attribute vec2 TEXCOORD_1;\n' +
      'uniform MAT4 WORLDVIEW; uniform MAT4 PROJ; uniform POS4 CHUNK_ORIGIN_AND_SCALE;\n' +
      'uniform vec4 FOG_COLOR; uniform vec2 FOG_CONTROL; uniform float RENDER_DISTANCE;\n' +
      'varying vec2 uv0; varying vec2 uv1; varying vec4 color; varying vec4 fogColor;\n' +
      'void main() {\n' +
      '  POS4 worldPos = vec4(POSITION.xyz * CHUNK_ORIGIN_AND_SCALE.w + CHUNK_ORIGIN_AND_SCALE.xyz, 1.0);\n' +
      '  gl_Position = PROJ * (WORLDVIEW * worldPos);\n' +
      '  uv0 = TEXCOORD_0; uv1 = TEXCOORD_1; color = COLOR;\n' +
      '  float len = length(worldPos.xyz) / RENDER_DISTANCE;\n' +
      '  fogColor.rgb = FOG_COLOR.rgb;\n' +
      '  fogColor.a = clamp((len - FOG_CONTROL.x) / (FOG_CONTROL.y - FOG_CONTROL.x), 0.0, 1.0);\n' +
      '}',
    'chunk.f': '#if __VERSION__ >= 300\n#define varying in\n#define texture2D texture\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\n' +
      'uniform sampler2D TEXTURE_0; uniform sampler2D TEXTURE_1;\n' +
      'varying vec2 uv0; varying vec2 uv1; varying vec4 color; varying vec4 fogColor;\n' +
      'void main() {\n' +
      '  vec4 diffuse = texture2D(TEXTURE_0, uv0);\n' +
      '#ifdef ALPHA_TEST\n  if (diffuse.a < 0.5) discard;\n#endif\n' +
      '#ifdef BLEND\n  diffuse.a *= color.a;\n#endif\n' +
      '  diffuse = diffuse * texture2D(TEXTURE_1, uv1);\n' +
      '#if !defined(ALPHA_TEST) && !defined(BLEND)\n  diffuse.a = color.a;\n#endif\n' +
      '  diffuse.rgb *= color.rgb;\n' +
      '  diffuse.rgb = mix(diffuse.rgb, fogColor.rgb, fogColor.a);\n' +
      '  gl_FragColor = diffuse;\n' +
      '}',
    'cielo.v': '#if __VERSION__ >= 300\n#define attribute in\n#define varying out\n#endif\n' +
      'attribute POS4 POSITION; attribute vec4 COLOR; uniform MAT4 WORLDVIEWPROJ; uniform vec4 CURRENT_COLOR; uniform vec4 FOG_COLOR;\n' +
      'varying vec4 color;\n' +
      'void main() { gl_Position = WORLDVIEWPROJ * POSITION; color = mix(CURRENT_COLOR, FOG_COLOR, COLOR.r); }',
    'color.f': '#if __VERSION__ >= 300\n#define varying in\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\n' +
      'varying vec4 color; void main() { gl_FragColor = color; }',
    // las nubes planas del juego de fábrica: clouds.png, cada píxel 12 bloques, corriéndose con el tiempo
    'nubes.v': '#if __VERSION__ >= 300\n#define attribute in\n#define varying out\n#endif\n' +
      'attribute POS4 POSITION; uniform MAT4 WORLDVIEWPROJ; uniform MAT4 WORLD; uniform highp float TIME; uniform vec4 FOG_COLOR;\n' +
      'uniform float RENDER_DISTANCE; varying vec2 uv; varying float niebla;\n' +
      'void main() { gl_Position = WORLDVIEWPROJ * POSITION; POS4 p = WORLD * POSITION;\n' +
      '  uv = (POSITION.xz + vec2(TIME * 0.6, 0.0)) / 3072.0;\n' +
      '  niebla = clamp(length(p.xz) / (RENDER_DISTANCE * 2.5), 0.0, 1.0); }',
    'nubes.f': '#if __VERSION__ >= 300\n#define varying in\n#define texture2D texture\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\n' +
      'uniform sampler2D TEXTURE_0; uniform vec4 CURRENT_COLOR; uniform vec4 FOG_COLOR; varying vec2 uv; varying float niebla;\n' +
      'void main() { vec4 c = texture2D(TEXTURE_0, uv); if (c.a < 0.5) discard;\n' +
      '  gl_FragColor = vec4(mix(CURRENT_COLOR.rgb, FOG_COLOR.rgb, niebla), CURRENT_COLOR.a * (1.0 - niebla)); }'
  };
  var S = null, FUENTES = null, cache = {};
  R.conShaders = true; R.sofisticados = true; R.shadersFallaron = false;
  function mat(clave, f) { if (!cache[clave]) cache[clave] = f(); return cache[clave]; }
  // los materiales del juego (materials/terrain.material, sky.material): los mismos nombres de shader
  // en los dos juegos de fuentes; "Gráficos sofisticados" es su define FANCY
  function materialesDe(fuentes, k, base, nubes) {
    S = fuentes;
    M.opaco = mat(k + 'opaco', function () { return GL.material(S, 'renderchunk.vertex', 'renderchunk.fragment', base); });
    M.recorte = mat(k + 'recorte', function () { return GL.material(S, 'renderchunk.vertex', 'renderchunk.fragment', base.concat(['ALPHA_TEST'])); });
    M.agua = mat(k + 'agua', function () { return GL.material(S, 'renderchunk.vertex', 'renderchunk.fragment', base.concat(['BLEND', 'NEAR_WATER'])); });
    M.mezcla = mat(k + 'mezcla', function () { return GL.material(S, 'renderchunk.vertex', 'renderchunk.fragment', base.concat(['BLEND'])); });
    M.cielo = mat(k + 'cielo', function () { return GL.material(S, 'sky.vertex', 'color.fragment', []); });
    M.nubes = mat(k + 'nubes', function () { return GL.material(S, 'cloud.vertex', 'color.fragment', nubes); });
    M.solLuna = mat(k + 'sol', function () { return GL.material(S, 'uv.vertex', 'texture_ccolor.fragment', []); });
    M.estrellas = mat(k + 'estrellas', function () { return GL.material(S, 'color.vertex', 'stars.fragment', []); });
  }
  function armarMateriales() {
    var con = R.conShaders && !R.shadersFallaron, fancy = R.sofisticados ? ['FANCY'] : [], sf = R.sofisticados ? '+' : '-';
    if (con) {
      try {
        // los de Tito: las nubes son una grilla plana a la que su shader le da forma
        materialesDe(FUENTES.tito, 'T' + sf, ['LOW_PRECISION', 'TEXEL_AA', 'ATLAS_TEXTURE', 'FOG'].concat(fancy), fancy);
        M.tipoNubes = 'tito';
        return;
      } catch (e) {
        // un teléfono que no compila los de Tito (p. ej. sin highp en los fragmentos): sin shaders
        console.error('shaders de Tito: ' + (e && e.message || e));
        R.shadersFallaron = true;
      }
    }
    try {
      // los de fábrica de la 1.2 (terrain_opaque_fog, etc.): las nubes, cajas de clouds.png
      materialesDe(FUENTES.vanilla, 'V' + sf, ['LOW_PRECISION', 'TEXEL_AA', 'ATLAS_TEXTURE', 'FOG'].concat(fancy), []);
      M.tipoNubes = 'cajas';
      return;
    } catch (e) {
      console.error('shaders de la 1.2: ' + (e && e.message || e));
    }
    // último recurso: los más simples posibles (textura x color x luz, niebla)
    var F = FABRICA, prog = function (d) { return function () { return GL.material(F, 'chunk.v', 'chunk.f', d); }; };
    M.opaco = mat('Fopaco', prog(['FOG']));
    M.recorte = mat('Frecorte', prog(['FOG', 'ALPHA_TEST']));
    M.agua = mat('Fagua', prog(['FOG', 'BLEND']));
    M.mezcla = M.agua;
    M.cielo = mat('Fcielo', function () { return GL.material(F, 'cielo.v', 'color.f', []); });
    M.nubes = mat('Fnubes', function () { return GL.material(F, 'nubes.v', 'nubes.f', []); });
    M.solLuna = mat('Fsol', function () { return GL.material(FUENTES.vanilla, 'uv.vertex', 'texture_ccolor.fragment', []); });
    M.estrellas = mat('Festrellas', function () { return GL.material(FUENTES.vanilla, 'color.vertex', 'stars.fragment', []); });
    M.tipoNubes = 'planas';
  }
  R.usarShaders = function (con, sofisticados) {
    R.conShaders = !!con;
    if (sofisticados !== undefined) R.sofisticados = !!sofisticados;
    armarMateriales();
    actual = null;
    return R.conShaders && !R.shadersFallaron;
  };

  // el filtro del atlas del terreno. Como la versión de PC: cada píxel de la textura tal cual (sin
  // suavizar) y de lejos el promedio entre mipmaps. Sin filtro anisotrópico: en muchas GPU (y en
  // ANGLE) prenderlo suaviza también lo que se ve de cerca, aunque se pida NEAREST, y con el 2 que
  // había el pasto, la tierra y el bloque en la mano se veían lavados, como comprimidos.
  // (min, aniso) se pueden cambiar para comparar en las pruebas
  R.filtrarAtlas = function (min, aniso) {
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl[min]);
    if (GL.aniso) gl.texParameterf(gl.TEXTURE_2D, GL.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.max(1, Math.min(aniso || 1, GL.anisoMax)));
  };

  R.iniciar = function (lienzo, datos, imagenes, op) {
    gl = GL.iniciar(lienzo);
    if (!gl) throw new Error('sin WebGL');
    FUENTES = datos.shaders;
    op = op || {};
    R.conShaders = op.shaders !== false;
    R.sofisticados = op.sofisticados !== false;
    armarMateriales();
    M.linea = GL.programa(
      '#if __VERSION__ >= 300\n#define attribute in\n#endif\nattribute POS4 POSITION; uniform MAT4 WORLDVIEWPROJ; void main(){ gl_Position = WORLDVIEWPROJ * POSITION; }',
      '#if __VERSION__ >= 300\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\nuniform vec4 CURRENT_COLOR; void main(){ gl_FragColor = CURRENT_COLOR; }');
    M.grieta = GL.programa(
      '#if __VERSION__ >= 300\n#define attribute in\n#define varying out\n#endif\nattribute POS4 POSITION; attribute vec2 TEXCOORD_0; uniform MAT4 WORLDVIEWPROJ; varying vec2 uv; void main(){ gl_Position = WORLDVIEWPROJ * POSITION; uv = TEXCOORD_0; }',
      '#if __VERSION__ >= 300\n#define varying in\n#define texture2D texture\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\nuniform sampler2D TEXTURE_0; varying vec2 uv; void main(){ vec4 c = texture2D(TEXTURE_0, uv); if (c.a < 0.1) discard; gl_FragColor = vec4(c.rgb, c.a); }');

    atlas = GL.textura(imagenes.terreno, 'cerca', 3);
    R.filtrarAtlas('NEAREST_MIPMAP_LINEAR', 1);
    mapaLuz = GL.textura(new ImageData(16, 16), 'lineal', 0);
    R.texSol = GL.textura(imagenes.sol, 'cerca', 0);
    R.texLuna = GL.textura(imagenes.luna, 'cerca', 0);
    R.grietas = imagenes.grietas.map(function (im) { return GL.textura(im, 'cerca', 0, true); });
    R.texNubes = imagenes.nubes ? GL.textura(imagenes.nubes, 'cerca', 0, true) : null;
    if (imagenes.nubes) mascaraNubes(imagenes.nubes);
    armarIndices(16384);
    armarCielo();
    armarEstrellas();
    armarCaja();
    prepararSimple();
    prepararEntidades(imagenes.bichos || {});
    R.uv = datos.atlas.uv;
    R.listo = true;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
  };

  function armarIndices(q) {
    if (q <= maxQuads) return;
    maxQuads = Math.max(q, maxQuads * 2);
    var a = new Uint32Array(maxQuads * 6);
    for (var i = 0, v = 0; i < a.length; i += 6, v += 4) {
      a[i] = v; a[i + 1] = v + 1; a[i + 2] = v + 2; a[i + 3] = v; a[i + 4] = v + 2; a[i + 5] = v + 3;
    }
    if (!indices) indices = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, a, gl.STATIC_DRAW);
    // los VAO ya hechos apuntan al mismo búfer: siguen andando
  }

  // el formato de vértices del terreno (ver trabajador.js)
  function atributosTerreno() {
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.UNSIGNED_SHORT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 20, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.UNSIGNED_SHORT, true, 20, 12);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.UNSIGNED_BYTE, true, 20, 16);
  }

  // ------------------------------------------------------------------------------------------
  // Columnas: el trabajador manda la malla de cada sub-trozo (16x16x16) con las alturas relativas a
  // la columna; acá se juntan los 8 de una columna, capa por capa, en un solo búfer. Así se dibuja
  // con una llamada por capa y columna en vez de una por sub-trozo (en el teléfono cada llamada
  // cuesta), y se recorta contra la vista con la caja de lo que la columna tiene de verdad
  // ------------------------------------------------------------------------------------------
  R.malla = function (d) {
    var k = d.cx + ',' + d.cz, c = cols.get(k);
    if (!c) {
      c = { cx: d.cx, cz: d.cz, subs: [], vao: null, vbo: null, capas: [[0, 0], [0, 0], [0, 0], [0, 0]], y0: 0, y1: 0, d2: 0, sucia: false, total: 0 };
      cols.set(k, c);
    }
    var total = 0;
    for (var i = 0; i < d.quads.length; i++) total += d.quads[i];
    c.subs[d.sy] = total ? { capas: d.capas, quads: d.quads } : null;
    c.sucia = true;
  };
  function rearmar(c) {
    c.sucia = false;
    var total = 0, i, sy, y0 = 99, y1 = -1;
    for (sy = 0; sy < 8; sy++) {
      var s = c.subs[sy];
      if (!s) continue;
      for (i = 0; i < 4; i++) total += s.quads[i];
      if (sy < y0) y0 = sy;
      y1 = sy;
    }
    c.total = total;
    if (!total) { borrar(c); return; }
    c.y0 = y0 * 16; c.y1 = y1 * 16 + 16;
    armarIndices(total);
    var buf = new Uint8Array(total * 80), o = 0;
    for (i = 0; i < 4; i++) {
      var desde = o;
      for (sy = 0; sy < 8; sy++) {
        s = c.subs[sy];
        if (!s || !s.quads[i]) continue;
        buf.set(new Uint8Array(s.capas[i]), o);
        o += s.quads[i] * 80;
      }
      c.capas[i][0] = desde / 80; c.capas[i][1] = (o - desde) / 80;
    }
    if (!c.vao) { c.vao = gl.createVertexArray(); c.vbo = gl.createBuffer(); }
    gl.bindVertexArray(c.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, c.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    atributosTerreno();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bindVertexArray(null);
  }
  function borrar(c) {
    if (c.vbo) { gl.deleteBuffer(c.vbo); gl.deleteVertexArray(c.vao); }
    c.vbo = c.vao = null; c.total = 0;
  }
  R.quitar = function (cx, cz) {
    var k = cx + ',' + cz, c = cols.get(k);
    if (c) { borrar(c); cols.delete(k); }
  };

  // ------------------------------------------------------------------------------------------
  // Cielo
  // ------------------------------------------------------------------------------------------
  var domo = {}, estrellas = {}, solQuad = {}, caja = {}, nubes = { centro: null };
  function bufer(datos, atribs) {
    var o = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), n: 0 };
    gl.bindVertexArray(o.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, o.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, datos, gl.STATIC_DRAW);
    atribs();
    gl.bindVertexArray(null);
    return o;
  }
  function armarCielo() {
    // un abanico: el centro arriba (COLOR.r = 0: color del cielo) y el borde en el horizonte
    // (COLOR.r = 1: color de la niebla), y una pollera hacia abajo
    var v = [], n = 16, i;
    function p(x, y, z, r) { v.push(x, y, z, 1, r, 0, 0, 1); }
    for (i = 0; i < n; i++) {
      var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, R0 = 300;
      p(0, 60, 0, 0); p(Math.cos(a1) * R0, -8, Math.sin(a1) * R0, 1); p(Math.cos(a0) * R0, -8, Math.sin(a0) * R0, 1);
      p(Math.cos(a0) * R0, -8, Math.sin(a0) * R0, 1); p(Math.cos(a1) * R0, -8, Math.sin(a1) * R0, 1); p(Math.cos(a1) * R0, -200, Math.sin(a1) * R0, 1);
      p(Math.cos(a0) * R0, -8, Math.sin(a0) * R0, 1); p(Math.cos(a1) * R0, -200, Math.sin(a1) * R0, 1); p(Math.cos(a0) * R0, -200, Math.sin(a0) * R0, 1);
    }
    domo = bufer(new Float32Array(v), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    });
    domo.n = v.length / 8;
    // el sol y la luna: un cuadrado con uv
    solQuad = bufer(new Float32Array([-1, 0, -1, 1, 0, 0, 1, 0, -1, 1, 1, 0, 1, 0, 1, 1, 1, 1, -1, 0, 1, 1, 0, 1]), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
    });
  }
  function armarEstrellas() {
    // 1500 estrellas como en el juego de PC (cuadraditos al azar en una esfera de radio 100)
    var az = new C.Azar(10842), v = [], i;
    for (i = 0; i < 1500; i++) {
      var x = az.sig() * 2 - 1, y = az.sig() * 2 - 1, z = az.sig() * 2 - 1, t = 0.15 + az.sig() * 0.1, d = x * x + y * y + z * z;
      if (d >= 1 || d < 0.01) continue;
      d = 1 / Math.sqrt(d); x *= d; y *= d; z *= d;
      var px = x * 100, py = y * 100, pz = z * 100;
      var th = Math.atan2(x, z), ts = Math.sin(th), tc = Math.cos(th);
      var ph = Math.atan2(Math.sqrt(x * x + z * z), y), ps = Math.sin(ph), pc = Math.cos(ph);
      var rot = az.sig() * Math.PI * 2, rs = Math.sin(rot), rc = Math.cos(rot);
      var esq = [];
      for (var k = 0; k < 4; k++) {
        var a = ((k & 2) - 1) * t, b = (((k + 1) & 2) - 1) * t;
        var c1 = a * rc - b * rs, c2 = b * rc + a * rs;
        var e1 = c1 * ps, e2 = -c1 * pc;
        esq.push([px + e2 * ts - c2 * tc, py + e1, pz + c2 * ts + e2 * tc]);
      }
      var o = [0, 1, 2, 0, 2, 3];
      for (k = 0; k < 6; k++) v.push(esq[o[k]][0], esq[o[k]][1], esq[o[k]][2], 1, 1, 1, 1, 1);
    }
    estrellas = bufer(new Float32Array(v), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    });
    estrellas.n = v.length / 8;
  }
  // las nubes: una grilla grande de cuadrados a la altura de las nubes; el shader de Tito les da
  // forma con senos de la posición (por eso la grilla va en coordenadas del mundo, alineada)
  var NUBE_LADO = 12, NUBE_N = 64, NUBE_Y = 113;
  function armarNubes(cx, cz) {
    var v = [], x0 = cx - NUBE_N * NUBE_LADO / 2, z0 = cz - NUBE_N * NUBE_LADO / 2;
    for (var i = 0; i < NUBE_N; i++) for (var j = 0; j < NUBE_N; j++) {
      var x = x0 + i * NUBE_LADO, z = z0 + j * NUBE_LADO, L = NUBE_LADO;
      var q = [[x, z], [x + L, z], [x + L, z + L], [x, z + L]];
      var o = [0, 2, 1, 0, 3, 2];
      for (var k = 0; k < 6; k++) v.push(q[o[k]][0], NUBE_Y, q[o[k]][1], 1, 0, 0, 0, 1);
    }
    if (nubes.vbo) { gl.deleteBuffer(nubes.vbo); gl.deleteVertexArray(nubes.vao); }
    nubes = bufer(new Float32Array(v), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    });
    nubes.n = v.length / 8;
    nubes.centro = [cx, cz];
  }
  // una caja de líneas (el bloque apuntado) y sus caras (las grietas al romper)
  function armarCaja() {
    var v = [], e = 0.002, a = -e, b = 1 + e;
    var P = [[a, a, a], [b, a, a], [b, a, b], [a, a, b], [a, b, a], [b, b, a], [b, b, b], [a, b, b]];
    var L = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    for (var i = 0; i < L.length; i++) v.push(P[L[i]][0], P[L[i]][1], P[L[i]][2], 1);
    caja.lineas = bufer(new Float32Array(v), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    });
    caja.lineas.n = L.length;
    // las 6 caras con uv, apenas afuera del bloque
    var c = [], e2 = 0.003, lo = -e2, hi = 1 + e2;
    var caras = [
      [[lo, lo, lo], [hi, lo, lo], [hi, lo, hi], [lo, lo, hi]], [[lo, hi, lo], [lo, hi, hi], [hi, hi, hi], [hi, hi, lo]],
      [[hi, lo, lo], [lo, lo, lo], [lo, hi, lo], [hi, hi, lo]], [[lo, lo, hi], [hi, lo, hi], [hi, hi, hi], [lo, hi, hi]],
      [[lo, lo, lo], [lo, lo, hi], [lo, hi, hi], [lo, hi, lo]], [[hi, lo, hi], [hi, lo, lo], [hi, hi, lo], [hi, hi, hi]]
    ];
    var uvs = [[0, 1], [1, 1], [1, 0], [0, 0]], ord = [0, 1, 2, 0, 2, 3];
    for (i = 0; i < 6; i++) for (var k = 0; k < 6; k++) {
      var p = caras[i][ord[k]], t = uvs[ord[k]];
      c.push(p[0], p[1], p[2], 1, t[0], t[1]);
    }
    caja.caras = bufer(new Float32Array(c), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
    });
    caja.caras.n = 36;
  }

  // ------------------------------------------------------------------------------------------
  // La hora: el ángulo del sol, el brillo, el color del cielo y de la niebla y el mapa de luz,
  // con las cuentas de Minecraft (las mismas del juego de PC, de donde viene MCPE)
  // ------------------------------------------------------------------------------------------
  function anguloSol(tiempo) {
    var f = ((tiempo % 24000) / 24000) - 0.25;
    if (f < 0) f += 1;
    var f1 = f;
    f = 1 - (Math.cos(f * Math.PI) + 1) / 2;
    return f1 + (f - f1) / 3;
  }
  R.anguloSol = anguloSol;
  function brilloSol(ang, lluvia) {
    var f = 1 - (Math.cos(ang * Math.PI * 2) * 2 + 0.2);
    f = Math.min(1, Math.max(0, f));
    f = 1 - f;
    f *= 1 - lluvia * 5 / 16;
    return f * 0.8 + 0.2;
  }
  var TABLA = [];
  for (var i = 0; i <= 15; i++) { var f1 = 1 - i / 15; TABLA[i] = (1 - f1) / (f1 * 3 + 1); }
  var parpadeo = 0, parpadeoV = 0;
  function actualizarMapaLuz(brillo) {
    parpadeoV += (Math.random() - Math.random()) * Math.random() * Math.random();
    parpadeoV *= 0.9;
    parpadeo += (parpadeoV - parpadeo);
    var cielo = brillo * 0.95 + 0.05, gamma = R.brillo;
    for (var k = 0; k < 256; k++) {
      var s = TABLA[k >> 4] * cielo, b = TABLA[k & 15] * (parpadeo * 0.1 + 1.5);
      var sr = s * (brillo * 0.65 + 0.35), sg = s * (brillo * 0.65 + 0.35);
      var bg = b * ((b * 0.6 + 0.4) * 0.6 + 0.4), bb = b * (b * b * 0.6 + 0.4);
      var r = sr + b, g = sg + bg, bl = s + bb;
      r = r * 0.96 + 0.03; g = g * 0.96 + 0.03; bl = bl * 0.96 + 0.03;
      r = r > 1 ? 1 : r; g = g > 1 ? 1 : g; bl = bl > 1 ? 1 : bl;
      var ir = 1 - r, ig = 1 - g, ib = 1 - bl;
      ir = 1 - ir * ir * ir * ir; ig = 1 - ig * ig * ig * ig; ib = 1 - ib * ib * ib * ib;
      r = r * (1 - gamma) + ir * gamma; g = g * (1 - gamma) + ig * gamma; bl = bl * (1 - gamma) + ib * gamma;
      r = r * 0.96 + 0.03; g = g * 0.96 + 0.03; bl = bl * 0.96 + 0.03;
      var o = k * 4;
      luzPix[o] = Math.min(255, r * 255); luzPix[o + 1] = Math.min(255, g * 255); luzPix[o + 2] = Math.min(255, bl * 255); luzPix[o + 3] = 255;
    }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, mapaLuz);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, luzPix);
    gl.activeTexture(gl.TEXTURE0);
  }
  R.brillo = 0.5;   // el "brillo" de las opciones del juego (gamma), a la mitad como viene

  function hsb(h, s, v) {
    var i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (((i % 6) + 6) % 6) {
      case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t];
      case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q];
    }
  }

  // ------------------------------------------------------------------------------------------
  // Un cuadro
  // ------------------------------------------------------------------------------------------
  var uFrame = {};
  R.dibujar = function (cam, mundo) {
    var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    gl.viewport(0, 0, w, h);
    var dist = mundo.dist * 16;
    var lejos = dist + 256;
    GL.perspectiva(proy, cam.fov, w / h, 0.05, lejos);
    GL.vista(vista, cam.yaw, cam.pitch);
    GL.mult(vp, proy, vista);
    calcularPlanos(vp);

    // la hora
    var ang = anguloSol(mundo.tiempo), lluvia = mundo.lluvia || 0;
    var brillo = brilloSol(ang, lluvia);
    var luzCielo = Math.cos(ang * Math.PI * 2) * 2 + 0.5;
    luzCielo = Math.min(1, Math.max(0, luzCielo));
    // color del cielo según la temperatura del bioma (como el juego) y la hora
    var temp = Math.min(1, Math.max(-1, (mundo.temperatura === undefined ? 0.8 : mundo.temperatura) / 3));
    var cs = hsb(0.62222224 - temp * 0.05, 0.5 + temp * 0.1, 1);
    var cielo = [cs[0] * luzCielo, cs[1] * luzCielo, cs[2] * luzCielo];
    var niebla = [0.7529412 * (luzCielo * 0.94 + 0.06), 0.84705883 * (luzCielo * 0.94 + 0.06), 1.0 * (luzCielo * 0.91 + 0.09)];
    // el horizonte toma algo del cielo según la distancia de visión
    var f = 1 - Math.pow(0.25 + 0.75 * mundo.dist / 32, 0.25);
    for (var k = 0; k < 3; k++) niebla[k] += (cielo[k] - niebla[k]) * f;
    // el atardecer: mirando hacia el sol, la niebla se tiñe
    // "Cielos hermosos" apagado (como el juego): el cielo de un solo color, sin atardecer ni estrellas
    var hermosos = mundo.cielosHermosos !== false;
    if (!hermosos) cielo = niebla.slice();
    var atard = hermosos ? colorAtardecer(ang) : null;
    if (atard) {
      var dirSol = Math.sin(ang * Math.PI * 2) > 0 ? -1 : 1;
      var mira = -Math.sin(cam.yaw) * dirSol * Math.cos(cam.pitch);
      if (mira > 0) {
        var a = atard[3] * mira;
        for (k = 0; k < 3; k++) niebla[k] = niebla[k] * (1 - a) + atard[k] * a;
      }
    }
    if (mundo.bajoAgua) { niebla = [0.02 * luzCielo + 0.02, 0.02 * luzCielo + 0.04, 0.2 * luzCielo + 0.08]; }
    actualizarMapaLuz(brillo);

    gl.clearColor(niebla[0], niebla[1], niebla[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mapaLuz);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlas);

    var tiempoS = mundo.reloj;
    // controles de la niebla: claro, lluvia (el shader de Tito los reconoce por FOG_CONTROL.x) o bajo el agua
    var fog = mundo.bajoAgua ? [0.0, 0.25] : lluvia > 0.2 ? [0.3, 0.9] : [0.75, 1.0];
    uFrame = { niebla: niebla, fog: fog, dist: dist, t: tiempoS, cam: cam, cielo: cielo };

    // 1. el cielo
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    usar(M.cielo);
    gl.uniformMatrix4fv(M.cielo.u.WORLDVIEWPROJ, false, vp);
    if (M.cielo.u.WORLDVIEW) gl.uniformMatrix4fv(M.cielo.u.WORLDVIEW, false, vista);
    if (M.cielo.u.PROJ) gl.uniformMatrix4fv(M.cielo.u.PROJ, false, proy);
    gl.uniform4f(M.cielo.u.CURRENT_COLOR, cielo[0], cielo[1], cielo[2], 1);
    comunes(M.cielo);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(domo.vao); gl.drawArrays(gl.TRIANGLES, 0, domo.n);
    // 2. estrellas, sol y luna
    var estrellasB = (1 - (Math.cos(ang * Math.PI * 2) * 2 + 0.25));
    estrellasB = Math.min(1, Math.max(0, estrellasB));
    estrellasB = estrellasB * estrellasB * 0.5 * (1 - lluvia);
    if (!hermosos) estrellasB = 0;
    gl.enable(gl.BLEND);
    var rot = GL.mat4();
    GL.mult(rot, vp, rotacionSol(ang));
    if (estrellasB > 0) {
      usar(M.estrellas);
      gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE);
      gl.uniformMatrix4fv(M.estrellas.u.WORLDVIEWPROJ, false, rot);
      gl.uniform4f(M.estrellas.u.CURRENT_COLOR, estrellasB, estrellasB, estrellasB, estrellasB);
      gl.bindVertexArray(estrellas.vao); gl.drawArrays(gl.TRIANGLES, 0, estrellas.n);
    }
    usar(M.solLuna);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    var alfa = 1 - lluvia;
    gl.uniform4f(M.solLuna.u.CURRENT_COLOR, 1, 1, 1, alfa);
    // sol: 30 de lado a 100 de distancia, arriba en el eje rotado
    var ms = GL.mat4(); ms.set(rot);
    escalarTrasladar(ms, 30, 100);
    gl.uniformMatrix4fv(M.solLuna.u.WORLDVIEWPROJ, false, ms);
    gl.bindTexture(gl.TEXTURE_2D, R.texSol);
    gl.bindVertexArray(solQuad.vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    // luna: del otro lado
    var ml = GL.mat4(); ml.set(rot);
    var abajo = GL.mat4(); abajo[5] = -1; abajo[10] = -1;
    GL.mult(ml, ml, abajo);
    escalarTrasladar(ml, 20, 100);
    gl.uniformMatrix4fv(M.solLuna.u.WORLDVIEWPROJ, false, ml);
    gl.bindTexture(gl.TEXTURE_2D, R.texLuna);
    gl.bindVertexArray(solQuad.vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.bindTexture(gl.TEXTURE_2D, atlas);

    // 3. el terreno: opaco de cerca a lejos, después lo recortado, el agua y lo transparente
    var lista = [];
    var ccx = cam.x, ccy = cam.y, ccz = cam.z, lejos2 = (dist + 24) * (dist + 24);
    cols.forEach(function (c) {
      if (c.sucia) rearmar(c);
      if (!c.total) return;
      var x0 = c.cx * 16 - ccx, z0 = c.cz * 16 - ccz;
      var dx = x0 + 8, dz = z0 + 8;
      if (dx * dx + dz * dz > lejos2) return;
      if (!visible(x0, c.y0 - ccy, z0, x0 + 16, c.y1 - ccy, z0 + 16)) return;
      var dy = Math.max(c.y0 - ccy, Math.min(0, c.y1 - ccy));
      c.d2 = dx * dx + dz * dz + dy * dy;
      lista.push(c);
    });
    lista.sort(function (a, b) { return a.d2 - b.d2; });
    R.stats.columnas = cols.size; R.stats.dibujadas = lista.length;
    var quads = 0, llamadas = 0;
    capa(M.opaco, lista, 0, false);
    capa(M.recorte, lista, 1, false);
    // la selección, las grietas y las partículas, antes del agua
    if (mundo.apuntado) seleccion(mundo.apuntado, mundo.rompiendo);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    dibujarParticulas(cam);
    if (mundo.entidades && mundo.entidades.length) dibujarEntidades(mundo.entidades, cam);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    var alReves = lista.slice().reverse();
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-0.1, -0.1);
    capa(M.agua, alReves, 2, true);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    capa(M.mezcla, alReves, 3, true);
    // 4. las nubes
    if (mundo.nubes === false) { gl.bindVertexArray(null); R.stats.quads = quads; R.stats.llamadas = llamadas; return; }
    var cn = [0.9 + 0.1 * luzCielo, 0.9 + 0.1 * luzCielo, 0.85 + 0.15 * luzCielo];
    if (M.tipoNubes === 'cajas' && mascara) dibujarNubes3D(mundo, ccx, ccy, ccz, cn, luzCielo);
    else {
      if (!nubes.centro || Math.abs(nubes.centro[0] - ccx) > 96 || Math.abs(nubes.centro[1] - ccz) > 96) {
        armarNubes(Math.round(ccx / NUBE_LADO) * NUBE_LADO, Math.round(ccz / NUBE_LADO) * NUBE_LADO);
      }
      usar(M.nubes);
      var mw = GL.mat4(); GL.trasladar(mw, -ccx, -ccy, -ccz);
      var mwvp = GL.mat4(); GL.mult(mwvp, vp, mw);
      gl.uniformMatrix4fv(M.nubes.u.WORLDVIEWPROJ, false, mwvp);
      if (M.nubes.u.WORLD) gl.uniformMatrix4fv(M.nubes.u.WORLD, false, mw);
      gl.uniform4f(M.nubes.u.CURRENT_COLOR, cn[0] * luzCielo, cn[1] * luzCielo, cn[2] * luzCielo, 0.8);
      comunes(M.nubes);
      if (M.tipoNubes === 'planas' && R.texNubes) gl.bindTexture(gl.TEXTURE_2D, R.texNubes);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(nubes.vao); gl.drawArrays(gl.TRIANGLES, 0, nubes.n);
      gl.depthMask(true);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    R.stats.quads = quads; R.stats.llamadas = llamadas;

    function capa(mat, lista, c, mezcla) {
      usar(mat);
      gl.uniformMatrix4fv(mat.u.WORLDVIEW, false, vista);
      gl.uniformMatrix4fv(mat.u.PROJ, false, proy);
      comunes(mat);
      if (mat.u.CURRENT_COLOR) gl.uniform4f(mat.u.CURRENT_COLOR, 0, 0, 0, 0);
      var u = mat.u.CHUNK_ORIGIN_AND_SCALE;
      for (var i = 0; i < lista.length; i++) {
        var s = lista[i], q = s.capas[c];
        if (!q[1]) continue;
        gl.uniform4f(u, s.cx * 16 - 1 - ccx, -1 - ccy, s.cz * 16 - 1 - ccz, 1 / 256);
        gl.bindVertexArray(s.vao);
        gl.drawElements(gl.TRIANGLES, q[1] * 6, gl.UNSIGNED_INT, q[0] * 24);
        quads += q[1]; llamadas++;
      }
      void mezcla;
    }
  };

  function comunes(m) {
    var u = m.u, F = uFrame;
    if (u.FOG_COLOR) gl.uniform4f(u.FOG_COLOR, F.niebla[0], F.niebla[1], F.niebla[2], 1);
    if (u.FOG_CONTROL) gl.uniform2f(u.FOG_CONTROL, F.fog[0], F.fog[1]);
    if (u.RENDER_DISTANCE) gl.uniform1f(u.RENDER_DISTANCE, F.dist);
    if (u.FAR_CHUNKS_DISTANCE) gl.uniform1f(u.FAR_CHUNKS_DISTANCE, F.dist);
    if (u.TIME) gl.uniform1f(u.TIME, F.t);
    if (u.VIEW_POS) gl.uniform3f(u.VIEW_POS, F.cam.x, F.cam.y, F.cam.z);
    if (u.VIEWPORT_DIMENSION) gl.uniform2f(u.VIEWPORT_DIMENSION, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }
  var actual = null;
  function usar(m) { if (actual !== m) { gl.useProgram(m.p); actual = m; } }

  function rotacionSol(ang) {
    // el cielo gira alrededor del eje x (el sol sale por el este, +x)
    var m = GL.mat4(), a = ang * Math.PI * 2;
    // primero -90° en y (como el juego: el eje del recorrido apunta este-oeste)
    var ry = GL.mat4(); ry[0] = 0; ry[2] = 1; ry[8] = -1; ry[10] = 0;
    var rx = GL.mat4(); rx[5] = Math.cos(a); rx[6] = Math.sin(a); rx[9] = -Math.sin(a); rx[10] = Math.cos(a);
    GL.mult(m, ry, rx);
    return m;
  }
  function escalarTrasladar(m, lado, d) {
    // el cuadrado del sol está en el plano xz a y = 0: lo subo a y = d y lo agrando
    GL.trasladar(m, 0, d, 0);
    var s = GL.mat4(); s[0] = lado; s[5] = 1; s[10] = lado;
    GL.mult(m, m, s);
  }
  function colorAtardecer(ang) {
    var c = Math.cos(ang * Math.PI * 2), f1 = 0.4;
    if (c < -f1 || c > f1) return null;
    var f3 = (c - 0.0) / f1 * 0.5 + 0.5;
    var f4 = 1 - (1 - Math.sin(f3 * Math.PI)) * 0.99;
    f4 *= f4;
    return [f3 * 0.3 + 0.7, f3 * f3 * 0.7 + 0.2, 0.2, f4];
  }

  // ------------------------------------------------------------------------------------------
  // Las nubes de la 1.2 (sin shaders): cada píxel de clouds.png es una caja de 12x4x12 bloques, a
  // la altura de las nubes, que se corren hacia el este. Se arma la malla de las cajas de alrededor
  // (sólo las caras que dan al aire) y se dibuja en dos pasadas: primero la profundidad y después el
  // color, para que las caras de atrás no se vean a través de la nube semitransparente
  // ------------------------------------------------------------------------------------------
  var mascara = null, MW = 0, MH = 0, nubes3D = { vao: null, vbo: null, n: 0, ci: null, cj: null };
  var CELDA = 12, NUBE_ALTO = 4, NUBE_BASE = 128.33;
  function mascaraNubes(im) {
    var c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    var x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    var d = x.getImageData(0, 0, c.width, c.height).data;
    MW = c.width; MH = c.height;
    mascara = new Uint8Array(MW * MH);
    for (var i = 0; i < MW * MH; i++) mascara[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  }
  function hayNube(i, j) { return mascara[(((j % MH) + MH) % MH) * MW + (((i % MW) + MW) % MW)]; }
  function armarNubes3D(ci, cj, radio) {
    var v = [];
    function q(a, b, c, d, s) {
      // dos triángulos (a, b, c) y (a, c, d), con el sombreado de la cara (como las nubes del juego)
      var p = [a, b, c, a, c, d];
      for (var k = 0; k < 6; k++) v.push(p[k][0], p[k][1], p[k][2], 1, s, s, s, 1);
    }
    for (var j = cj - radio; j <= cj + radio; j++) {
      for (var i = ci - radio; i <= ci + radio; i++) {
        if (!hayNube(i, j)) continue;
        var x0 = (i - ci) * CELDA, x1 = x0 + CELDA, z0 = (j - cj) * CELDA, z1 = z0 + CELDA, y0 = 0, y1 = NUBE_ALTO;
        q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 1.0);          // arriba
        q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0.7);          // abajo
        if (!hayNube(i - 1, j)) q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.9);
        if (!hayNube(i + 1, j)) q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 0.9);
        if (!hayNube(i, j - 1)) q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0.8);
        if (!hayNube(i, j + 1)) q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0.8);
      }
    }
    if (nubes3D.vbo) { gl.deleteBuffer(nubes3D.vbo); gl.deleteVertexArray(nubes3D.vao); }
    var b = bufer(new Float32Array(v), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
    });
    nubes3D.vao = b.vao; nubes3D.vbo = b.vbo; nubes3D.n = v.length / 8; nubes3D.ci = ci; nubes3D.cj = cj; nubes3D.radio = radio;
  }
  function dibujarNubes3D(mundo, ccx, ccy, ccz, cn, luzCielo) {
    // el corrimiento: 0,6 bloques por segundo hacia +x (el de las nubes del juego de PC)
    var corrido = (mundo.reloj * 0.6) % (MW * CELDA);
    var cx = ccx - corrido, ci = Math.floor(cx / CELDA), cj = Math.floor(ccz / CELDA);
    var radio = Math.min(24, Math.ceil((mundo.dist * 16 + 48) / CELDA));
    if (nubes3D.ci === null || Math.abs(ci - nubes3D.ci) > 2 || Math.abs(cj - nubes3D.cj) > 2 || nubes3D.radio !== radio) armarNubes3D(ci, cj, radio);
    var mw = GL.mat4();
    GL.trasladar(mw, nubes3D.ci * CELDA + corrido - ccx, NUBE_BASE - ccy, nubes3D.cj * CELDA - ccz);
    var mwvp = GL.mat4(); GL.mult(mwvp, vp, mw);
    usar(M.nubes);
    gl.uniformMatrix4fv(M.nubes.u.WORLDVIEWPROJ, false, mwvp);
    if (M.nubes.u.WORLD) gl.uniformMatrix4fv(M.nubes.u.WORLD, false, mw);
    gl.uniform4f(M.nubes.u.CURRENT_COLOR, cn[0] * luzCielo, cn[1] * luzCielo, cn[2] * luzCielo, 0.8);
    comunes(M.nubes);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(nubes3D.vao);
    gl.colorMask(false, false, false, false);
    gl.drawArrays(gl.TRIANGLES, 0, nubes3D.n);
    gl.colorMask(true, true, true, true);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, nubes3D.n);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  // ------------------------------------------------------------------------------------------
  // Los bichos y los otros jugadores: modelos.js deja los vértices de cada uno (ya ubicados, relativos
  // a la cámara, con la luz del lugar) y acá se dibujan de una llamada por textura, con niebla
  // ------------------------------------------------------------------------------------------
  var ent = null, entBuf = null, entDatos = new Float32Array(0), texEnt = {};
  function prepararEntidades(imagenes) {
    ent = GL.programa(
      '#if __VERSION__ >= 300\n#define attribute in\n#define varying out\n#endif\nattribute POS4 POSITION; attribute vec4 COLOR; attribute vec2 TEXCOORD_0; uniform MAT4 WORLDVIEWPROJ; uniform vec2 FOG_CONTROL; uniform float RENDER_DISTANCE; varying vec2 uv; varying vec4 col; varying float niebla; void main(){ gl_Position = WORLDVIEWPROJ * POSITION; uv = TEXCOORD_0; col = COLOR; float d = length(POSITION.xyz) / RENDER_DISTANCE; niebla = clamp((d - FOG_CONTROL.x) / (FOG_CONTROL.y - FOG_CONTROL.x), 0.0, 1.0); }',
      '#if __VERSION__ >= 300\n#define varying in\n#define texture2D texture\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\nuniform sampler2D TEXTURE_0; uniform vec4 FOG_COLOR; varying vec2 uv; varying vec4 col; varying float niebla; void main(){ vec4 c = texture2D(TEXTURE_0, uv); if (c.a < 0.1) discard; vec3 rgb = mix(c.rgb, vec3(1.0, 0.0, 0.0), (1.0 - col.a) * 0.6) * col.rgb; gl_FragColor = vec4(mix(rgb, FOG_COLOR.rgb, niebla), 1.0); }');
    for (var k in imagenes) texEnt[k] = GL.textura(imagenes[k], 'cerca', 0);
  }
  // la luz de un bicho: la del mapa de luz en su celda; con los shaders de Tito, que oscurecen la
  // noche por su cuenta (con la luz de cielo pleno del mapa como indicador del día), igual que ellos
  function luzEntidad(v) {
    var c = colorLuz(v);
    if (M.tipoNubes !== 'tito') return c;
    var dia = Math.max(0, Math.min(1, (luzPix[(15 * 16) * 4] / 255 - 0.5) / 0.5)), bl = (v < 0 ? 0 : v & 15) / 15;
    var k = Math.max(0.28 + 0.72 * dia, bl);
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  function dibujarEntidades(lista, cam) {
    // cuántos vértices hacen falta
    var n = 0, i;
    for (i = 0; i < lista.length; i++) n += Modelos.vertices(lista[i]);
    if (!n) return;
    if (entDatos.length < n * 10) {
      entDatos = new Float32Array(n * 10 * 2);
      if (!entBuf) {
        entBuf = { vao: gl.createVertexArray(), vbo: gl.createBuffer() };
        gl.bindVertexArray(entBuf.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, entBuf.vbo);
        atributosSimple();
        gl.bindVertexArray(null);
      }
    }
    // por textura: los vértices de todos los que la usan, juntos
    var porTex = {}, orden = [];
    for (i = 0; i < lista.length; i++) {
      var e = lista[i];
      // fuera de la vista (una caja de 2 bloques alrededor) no se dibuja
      if (!visible(e.x - cam.x - 1, e.y - cam.y, e.z - cam.z - 1, e.x - cam.x + 1, e.y - cam.y + 2.2, e.z - cam.z + 1)) continue;
      Modelos.capas(e).forEach(function (c) {
        if (!porTex[c.tex]) { porTex[c.tex] = []; orden.push(c.tex); }
        porTex[c.tex].push([e, c]);
      });
    }
    var o = 0, tramos = [];
    for (i = 0; i < orden.length; i++) {
      var desde = o;
      porTex[orden[i]].forEach(function (par) { o = Modelos.escribir(entDatos, o, par[0], par[1], cam, luzEntidad); });
      tramos.push([orden[i], desde / 10, (o - desde) / 10]);
    }
    if (!o) return;
    usar(ent);
    gl.uniformMatrix4fv(ent.u.WORLDVIEWPROJ, false, vp);
    comunes(ent);
    gl.bindVertexArray(entBuf.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, entBuf.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, entDatos.subarray(0, o), gl.STREAM_DRAW);
    // los modelos se dan vuelta en x (como los de Minecraft): los triángulos quedan al revés
    gl.disable(gl.CULL_FACE);
    for (i = 0; i < tramos.length; i++) {
      gl.bindTexture(gl.TEXTURE_2D, texEnt[tramos[i][0]]);
      gl.drawArrays(gl.TRIANGLES, tramos[i][1], tramos[i][2]);
    }
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }
  // un punto del mundo en la pantalla (para los nombres de los jugadores): [x, y] de 0 a 1, o null
  // si está atrás de la cámara
  R.proyectar = function (x, y, z, cam) {
    var px = x - cam.x, py = y - cam.y, pz = z - cam.z;
    var cx = vp[0] * px + vp[4] * py + vp[8] * pz + vp[12], cy = vp[1] * px + vp[5] * py + vp[9] * pz + vp[13];
    var cw = vp[3] * px + vp[7] * py + vp[11] * pz + vp[15];
    if (cw <= 0.05) return null;
    return [(cx / cw + 1) / 2, (1 - cy / cw) / 2, cw];
  };

  // ------------------------------------------------------------------------------------------
  // El bloque apuntado: el contorno y las grietas mientras se rompe
  // ------------------------------------------------------------------------------------------
  function seleccion(p, rompiendo) {
    var m = GL.mat4();
    GL.trasladar(m, p.x - uFrame.cam.x, p.y - uFrame.cam.y, p.z - uFrame.cam.z);
    var mvp = GL.mat4(); GL.mult(mvp, vp, m);
    if (rompiendo > 0 && R.grietas.length) {
      usar(M.grieta);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.DST_COLOR, gl.SRC_COLOR);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -1);
      gl.uniformMatrix4fv(M.grieta.u.WORLDVIEWPROJ, false, mvp);
      gl.bindTexture(gl.TEXTURE_2D, R.grietas[Math.min(9, Math.floor(rompiendo * 10))]);
      gl.bindVertexArray(caja.caras.vao); gl.drawArrays(gl.TRIANGLES, 0, caja.caras.n);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.disable(gl.BLEND);
    }
    usar(M.linea);
    gl.uniformMatrix4fv(M.linea.u.WORLDVIEWPROJ, false, mvp);
    gl.uniform4f(M.linea.u.CURRENT_COLOR, 0, 0, 0, 0.4);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(caja.lineas.vao); gl.drawArrays(gl.LINES, 0, caja.lineas.n);
    gl.disable(gl.BLEND);
  }

  // ------------------------------------------------------------------------------------------
  // Recorte por el campo de visión (los seis planos de la matriz vista-proyección)
  // ------------------------------------------------------------------------------------------
  function calcularPlanos(m) {
    var p = planos, i;
    var f = [[3, 0, 1], [3, 0, -1], [3, 1, 1], [3, 1, -1], [3, 2, 1], [3, 2, -1]];
    for (i = 0; i < 6; i++) {
      var a = f[i][0], b = f[i][1], sg = f[i][2];
      var x = m[a] + sg * m[b], y = m[4 + a] + sg * m[4 + b], z = m[8 + a] + sg * m[8 + b], w = m[12 + a] + sg * m[12 + b];
      var l = Math.sqrt(x * x + y * y + z * z);
      p[i * 4] = x / l; p[i * 4 + 1] = y / l; p[i * 4 + 2] = z / l; p[i * 4 + 3] = w / l;
    }
  }
  // la caja (x0..x1, y0..y1, z0..z1, relativa a la cámara) está del lado de afuera de algún plano?
  function visible(x0, y0, z0, x1, y1, z1) {
    for (var i = 0; i < 24; i += 4) {
      var a = planos[i], b = planos[i + 1], c = planos[i + 2], d = planos[i + 3];
      var x = a > 0 ? x1 : x0, y = b > 0 ? y1 : y0, z = c > 0 ? z1 : z0;
      if (a * x + b * y + c * z + d < 0) return false;
    }
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // El panorama del menú: las 6 fotos (panorama_0..5: frente, derecha, atrás, izquierda, arriba y
  // abajo, como el de PC) en un cubo alrededor de la cámara, que gira despacio
  // ------------------------------------------------------------------------------------------
  var pano = null;
  R.panorama = function (imagenes) {
    var prog = GL.programa(
      '#if __VERSION__ >= 300\n#define attribute in\n#define varying out\n#endif\nattribute POS4 POSITION; attribute vec2 TEXCOORD_0; uniform MAT4 WORLDVIEWPROJ; varying vec2 uv; void main(){ gl_Position = WORLDVIEWPROJ * POSITION; uv = TEXCOORD_0; }',
      '#if __VERSION__ >= 300\n#define varying in\n#define texture2D texture\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\nuniform sampler2D TEXTURE_0; varying vec2 uv; void main(){ gl_FragColor = texture2D(TEXTURE_0, uv); }');
    // cada cara: arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda de su foto
    var caras = [
      [[-1, 1, -1], [1, 1, -1], [1, -1, -1], [-1, -1, -1]], [[1, 1, -1], [1, 1, 1], [1, -1, 1], [1, -1, -1]],
      [[1, 1, 1], [-1, 1, 1], [-1, -1, 1], [1, -1, 1]], [[-1, 1, 1], [-1, 1, -1], [-1, -1, -1], [-1, -1, 1]],
      [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]
    ];
    var uvs = [[0, 0], [1, 0], [1, 1], [0, 1]], ord = [0, 1, 2, 0, 2, 3], v = [];
    for (var c = 0; c < 6; c++) for (var k = 0; k < 6; k++) {
      var q = caras[c][ord[k]];
      v.push(q[0], q[1], q[2], 1, uvs[ord[k]][0], uvs[ord[k]][1]);
    }
    var b = bufer(new Float32Array(v), function () {
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
    });
    pano = { prog: prog, b: b, tex: imagenes.map(function (im) { return GL.textura(im, 'suave', 9); }) };
  };
  R.dibujarPanorama = function (yaw, pitch) {
    if (!pano) return;
    var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    GL.perspectiva(proy, 70 * Math.PI / 180, w / h, 0.05, 10);
    GL.vista(vista, yaw, pitch);
    GL.mult(vp, proy, vista);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    usar(pano.prog);
    gl.uniformMatrix4fv(pano.prog.u.WORLDVIEWPROJ, false, vp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(pano.b.vao);
    for (var c = 0; c < 6; c++) {
      gl.bindTexture(gl.TEXTURE_2D, pano.tex[c]);
      gl.drawArrays(gl.TRIANGLES, c * 6, 6);
    }
    gl.bindVertexArray(null);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  };

  // ------------------------------------------------------------------------------------------
  // Las partículas al romper y el bloque en la mano: un shader simple con el atlas, teñido por la
  // luz del lugar (la del mapa de luz en la celda del jugador, como el juego)
  // ------------------------------------------------------------------------------------------
  var simple = null, part = [], partBuf = null, partDatos = new Float32Array(0), mano = { clave: '', b: null, n: 0 };
  R.luzJugador = 0xF0;
  function prepararSimple() {
    simple = GL.programa(
      '#if __VERSION__ >= 300\n#define attribute in\n#define varying out\n#endif\nattribute POS4 POSITION; attribute vec4 COLOR; attribute vec2 TEXCOORD_0; uniform MAT4 WORLDVIEWPROJ; varying vec2 uv; varying vec4 col; void main(){ gl_Position = WORLDVIEWPROJ * POSITION; uv = TEXCOORD_0; col = COLOR; }',
      '#if __VERSION__ >= 300\n#define varying in\n#define texture2D texture\nout vec4 FragColor;\n#define gl_FragColor FragColor\n#endif\nuniform sampler2D TEXTURE_0; uniform vec4 CURRENT_COLOR; varying vec2 uv; varying vec4 col; void main(){ vec4 c = texture2D(TEXTURE_0, uv); if (c.a < 0.5) discard; gl_FragColor = vec4(c.rgb * col.rgb * CURRENT_COLOR.rgb, 1.0); }');
  }
  function colorLuz(v) {
    var s = v < 0 ? 15 : v >> 4, b = v < 0 ? 0 : v & 15, o = (s * 16 + b) * 4;
    return [luzPix[o] / 255, luzPix[o + 1] / 255, luzPix[o + 2] / 255];
  }
  function atributosSimple() {
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 16);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 40, 32);
  }
  // un rectángulo del atlas (u0, v0, u1, v1) de la cara de un bloque
  R.rectCara = function (id, cara, m) {
    var b = C.bloques[id], t = (b.texMano && (typeof b.texMano === 'string' || b.texMano[cara] || b.texMano.side)) ? b.texMano : b.tex;
    if (!t) return null;
    var n = typeof t === 'string' ? t : (t[cara] || t.side || t.up), l = R.uv[n];
    if (!l) return null;
    l = l.filter(Boolean);
    return l.length ? l[m < l.length ? m : 0] : null;
  };

  // romper: 4x4x4 pedacitos de la textura del bloque que saltan y caen (como el juego)
  R.romper = function (x, y, z, id, m) {
    var r = R.rectCara(id, 'side', m) || R.rectCara(id, 'up', m);
    if (!r) return;
    var b = C.bloques[id], tinte = b.tinte === 1 ? [0.57, 0.74, 0.35] : b.tinte === 2 ? [0.47, 0.67, 0.18] : [1, 1, 1];
    var du = (r[2] - r[0]) / 4, dv = (r[3] - r[1]) / 4;
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) for (var k = 0; k < 4; k++) {
      if (part.length > 400) part.shift();
      var px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, pz = z + (k + 0.5) / 4;
      var vx = px - x - 0.5, vy = py - y - 0.5, vz = pz - z - 0.5, s = (Math.random() + Math.random() + 1) * 0.15 / Math.sqrt(vx * vx + vy * vy + vz * vz);
      var u = r[0] + Math.floor(Math.random() * 3) * du, v = r[1] + Math.floor(Math.random() * 3) * dv;
      part.push({ x: px, y: py, z: pz, vx: vx * s * 0.4 + (Math.random() * 2 - 1) * 0.04, vy: vy * s * 0.4 + 0.1 + Math.random() * 0.05, vz: vz * s * 0.4 + (Math.random() * 2 - 1) * 0.04,
        vida: 4 / (Math.random() * 0.9 + 0.1), edad: 0, tam: 0.05 * (Math.random() * 0.5 + 0.5), u0: u, v0: v, u1: u + du, v1: v + dv, c: tinte });
    }
  };
  // un paso de 1/20 s de las partículas (gravedad y roce del juego; chocan con el piso)
  R.pasoParticulas = function () {
    for (var i = part.length - 1; i >= 0; i--) {
      var p = part[i];
      if (++p.edad >= p.vida) { part.splice(i, 1); continue; }
      p.vy -= 0.04;
      var ny = p.y + p.vy, b = Mundo.bloque(Math.floor(p.x), Math.floor(ny), Math.floor(p.z));
      if (b !== 0 && b !== -1 && C.SOLIDO[b]) { p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; } else p.y = ny;
      p.x += p.vx; p.z += p.vz;
      p.vx *= 0.98; p.vy *= 0.98; p.vz *= 0.98;
    }
  };
  function dibujarParticulas(cam, alfa) {
    if (!part.length) return;
    var n = part.length * 6 * 10;
    if (partDatos.length < n) {
      partDatos = new Float32Array(n * 2);
      if (!partBuf) {
        partBuf = { vao: gl.createVertexArray(), vbo: gl.createBuffer() };
        gl.bindVertexArray(partBuf.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, partBuf.vbo);
        atributosSimple();
        gl.bindVertexArray(null);
      }
    }
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var rx = cy, rz = sy, ux = sp * sy, uy = cp, uz = -sp * cy, o = 0, d = partDatos;
    var luz = colorLuz(R.luzJugador);
    for (var i = 0; i < part.length; i++) {
      var p = part[i], s = p.tam, x = p.x - cam.x, y = p.y - cam.y, z = p.z - cam.z, c = p.c;
      var esq = [[-1, -1, p.u0, p.v1], [1, -1, p.u1, p.v1], [1, 1, p.u1, p.v0], [-1, -1, p.u0, p.v1], [1, 1, p.u1, p.v0], [-1, 1, p.u0, p.v0]];
      for (var k = 0; k < 6; k++) {
        var e = esq[k];
        d[o++] = x + (rx * e[0] + ux * e[1]) * s; d[o++] = y + uy * e[1] * s; d[o++] = z + (rz * e[0] + uz * e[1]) * s; d[o++] = 1;
        d[o++] = c[0] * luz[0]; d[o++] = c[1] * luz[1]; d[o++] = c[2] * luz[2]; d[o++] = 1;
        d[o++] = e[2]; d[o++] = e[3];
      }
    }
    usar(simple);
    gl.uniformMatrix4fv(simple.u.WORLDVIEWPROJ, false, vp);
    gl.uniform4f(simple.u.CURRENT_COLOR, 1, 1, 1, 1);
    gl.bindVertexArray(partBuf.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, partBuf.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, o), gl.STREAM_DRAW);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, o / 10);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    void alfa;
  }

  // el bloque (o la cosa) que tiene el jugador en la mano, abajo a la derecha, con el balanceo al
  // caminar y el golpe al usar (los movimientos del juego de PC)
  function armarMano(it) {
    var clave = it ? it.id + ':' + it.m : '';
    if (clave === mano.clave) return;
    mano.clave = clave; mano.n = 0;
    if (!it) return;
    var id = it.id, m = it.m, f = C.FORMA[id], F = C.F, v = [];
    var b = C.bloques[id], tinte = b.tinte === 1 ? [0.57, 0.74, 0.35] : b.tinte === 2 ? [0.47, 0.67, 0.18] : b.tinte === 3 ? [0.25, 0.4, 0.9] : [1, 1, 1];
    var llevada = !!b.texMano;
    function quad(p, r, sombra, tn) {
      if (!r) return;
      var uv = [[r[0], r[3]], [r[2], r[3]], [r[2], r[1]], [r[0], r[1]]], ord = [0, 1, 2, 0, 2, 3];
      var tt = tn && !llevada ? tinte : [1, 1, 1];
      for (var k = 0; k < 6; k++) {
        var q = p[ord[k]];
        v.push(q[0], q[1], q[2], 1, tt[0] * sombra, tt[1] * sombra, tt[2] * sombra, 1, uv[ord[k]][0], uv[ord[k]][1]);
      }
    }
    var plano = f === F.cruz || f === F.antorcha || f === F.pared || f === F.riel || f === F.planta2 || f === F.puerta ||
      f === F.surcos || f === F.nenufar || f === F.panel || f === F.fuego || f === F.tallo;
    if (plano) {
      var r = R.rectCara(id, f === F.puerta ? 'side' : 'up', f === F.planta2 ? m & 7 : m) || R.rectCara(id, 'side', m);
      mano.plano = true;
      quad([[-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0]], r, 1, b.tinte);
      quad([[0.5, -0.5, 0], [-0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0]], r && [r[2], r[1], r[0], r[3]], 0.8, b.tinte);
    } else {
      mano.plano = false;
      var mm = (id === 17 || id === 162) ? m & 3 : m;
      var alto = f === F.losa ? 0.5 : f === F.capa ? 0.125 : f === F.alfombra ? 0.0625 : 1, y1 = -0.5 + alto;
      var arriba = R.rectCara(id, 'up', mm), lado = R.rectCara(id, 'side', mm) || arriba, frente = R.rectCara(id, 'south', mm) || lado;
      var abajo = R.rectCara(id, 'down', mm) || arriba;
      // las caras de los costados muestran la parte de abajo de su textura si el bloque es bajo
      function corte(r) { return r && alto < 1 ? [r[0], r[3] - (r[3] - r[1]) * alto, r[2], r[3]] : r; }
      quad([[-0.5, y1, 0.5], [0.5, y1, 0.5], [0.5, y1, -0.5], [-0.5, y1, -0.5]], arriba, 1, b.tinte === 1 || b.tinte === 2);
      quad([[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]], abajo, 0.5, b.tinte === 2);
      quad([[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, y1, 0.5], [-0.5, y1, 0.5]], corte(frente), 0.8, b.tinte === 2);
      quad([[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, y1, -0.5], [0.5, y1, -0.5]], corte(lado), 0.8, b.tinte === 2);
      quad([[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, y1, -0.5], [0.5, y1, 0.5]], corte(lado), 0.6, b.tinte === 2);
      quad([[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, y1, 0.5], [-0.5, y1, -0.5]], corte(lado), 0.6, b.tinte === 2);
    }
    if (!mano.b) {
      mano.b = { vao: gl.createVertexArray(), vbo: gl.createBuffer() };
      gl.bindVertexArray(mano.b.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, mano.b.vbo);
      atributosSimple();
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, mano.b.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    mano.n = v.length / 10;
  }
  function multRot(m, ang, x, y, z) {
    var c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, r = GL.mat4();
    r[0] = t * x * x + c; r[1] = t * x * y + s * z; r[2] = t * x * z - s * y;
    r[4] = t * x * y - s * z; r[5] = t * y * y + c; r[6] = t * y * z + s * x;
    r[8] = t * x * z + s * y; r[9] = t * y * z - s * x; r[10] = t * z * z + c;
    GL.mult(m, m, r);
  }
  var proyMano = GL.mat4(), mMano = GL.mat4(), mvpMano = GL.mat4();
  // estado: { item, golpe (0 a 1), equipo (0 a 1), bamboleo: [x, y] }
  R.dibujarMano = function (estado) {
    armarMano(estado.item);
    if (!mano.n) return;
    var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    GL.perspectiva(proyMano, 70 * Math.PI / 180, w / h, 0.05, 10);
    var m = mMano;
    m.set(GL.mat4());
    var g = estado.golpe, rg = Math.sqrt(g);
    GL.trasladar(m, 0.56 + estado.bamboleo[0] - 0.4 * Math.sin(rg * Math.PI), -0.52 + estado.bamboleo[1] - (1 - estado.equipo) * 0.6 + 0.2 * Math.sin(rg * Math.PI * 2),
      -0.72 - 0.2 * Math.sin(g * Math.PI));
    multRot(m, Math.PI / 4, 0, 1, 0);
    var f = Math.sin(g * g * Math.PI), f1 = Math.sin(rg * Math.PI);
    multRot(m, -f * 20 * Math.PI / 180, 0, 1, 0);
    multRot(m, -f1 * 20 * Math.PI / 180, 0, 0, 1);
    multRot(m, -f1 * 80 * Math.PI / 180, 1, 0, 0);
    if (mano.plano) { multRot(m, -Math.PI / 4, 0, 1, 0); multRot(m, Math.PI / 12, 0, 0, 1); }
    var e = GL.mat4(); e[0] = e[5] = e[10] = mano.plano ? 0.5 : 0.4;
    GL.mult(m, m, e);
    GL.mult(mvpMano, proyMano, m);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    usar(simple);
    gl.uniformMatrix4fv(simple.u.WORLDVIEWPROJ, false, mvpMano);
    var luz = colorLuz(R.luzJugador);
    gl.uniform4f(simple.u.CURRENT_COLOR, luz[0], luz[1], luz[2], 1);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.bindVertexArray(mano.b.vao);
    if (mano.plano) gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, mano.n);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  };

  R.matrices = function () { return { vp: vp, proy: proy, vista: vista }; };
  R.reiniciar = function () { cols.forEach(borrar); cols.clear(); };
  return R;
})();
