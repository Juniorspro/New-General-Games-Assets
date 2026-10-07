// porteo: renderer WebGL 2 que dibuja lo exportado del APK (exportar.py) con los shaders
// ORIGINALES de Slime Rancher. Son GLSL ES 3.00 (los de Android) y esperan lo mismo que les da
// Unity: matrices por columnas (hlslcc_mtx4x4...), la luz, el ambiente, la niebla y el tiempo.
// Para dibujar muchas copias de una malla en una sola llamada, la matriz del objeto
// (unity_ObjectToWorld) pasa de uniform a atributo por instancia: se reescribe el GLSL.
'use strict';
var GL = (function () {
  var gl = null, ext = {};
  var programas = {};   // fuente → programa
  var faltantes = {};   // uniforms que nadie da (para depurar)
  var globales = {};    // nombre → valor (Float32Array | número | textura)
  var texDefecto = {};

  var COMPARAR = null, MEZCLA = null;

  function iniciar(lienzo, opciones) {
    gl = lienzo.getContext('webgl2', Object.assign({ antialias: false, alpha: false, depth: true, stencil: false,
      powerPreference: 'high-performance' }, opciones || {}));
    if (!gl) throw new Error('Este navegador no tiene WebGL 2');
    ext.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    // Las caras de Unity son horarias en pantalla (mano izquierda): el frente es CW, como lo
    // configura Unity en OpenGL. Con el CCW de WebGL se dibujaba el revés y los pisos, que son
    // planos de una cara, no se veían desde arriba.
    gl.frontFace(gl.CW);
    COMPARAR = [gl.ALWAYS, gl.NEVER, gl.LESS, gl.EQUAL, gl.LEQUAL, gl.GREATER, gl.NOTEQUAL, gl.GEQUAL, gl.ALWAYS];
    MEZCLA = [gl.ZERO, gl.ONE, gl.DST_COLOR, gl.SRC_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_COLOR,
      gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA];
    // las texturas por defecto de ShaderLab: "white", "black", "gray", "bump", "red"
    texDefecto.white = texturaColor([255, 255, 255, 255]);
    texDefecto.black = texturaColor([0, 0, 0, 0]);
    texDefecto.gray = texturaColor([128, 128, 128, 255]);
    texDefecto.grey = texDefecto.gray;
    texDefecto.bump = texturaColor([128, 128, 255, 255]);
    texDefecto.red = texturaColor([255, 0, 0, 255]);
    return gl;
  }

  function texturaColor(c) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(c));
    return { tex: t, w: 1, h: 1 };
  }

  // Unity guarda las texturas de abajo hacia arriba; exportar.py ya las dejó así en el archivo.
  function textura(imagen, info) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagen);
    var envolver = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT, gl.CLAMP_TO_EDGE];
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, envolver[info.wrap[0]] || gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, envolver[info.wrap[1]] || gl.REPEAT);
    var punto = info.filtro === 0;
    if (info.mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, punto ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR_MIPMAP_LINEAR);
      if (ext.aniso && !punto) gl.texParameterf(gl.TEXTURE_2D, ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, punto ? gl.NEAREST : gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, punto ? gl.NEAREST : gl.LINEAR);
    return { tex: t, w: info.w, h: info.h };
  }

  // ── programas ─────────────────────────────────────────────────────────────
  // El GLSL de Unity declara la matriz del objeto como uniform vec4 x[4] (columnas): se cambia
  // por cuatro atributos por instancia y la inversa se calcula en el shader. Si el fragment
  // también la usa (la altura del objeto, por ejemplo), el vertex le pasa esas columnas flat.
  var RE_O2W = /uniform\s+(?:highp\s+)?vec4\s+hlslcc_mtx4x4unity_ObjectToWorld\[4\];/;
  var RE_W2O = /uniform\s+(?:highp\s+)?vec4\s+hlslcc_mtx4x4unity_WorldToObject\[4\];/;
  function columnas(fuente, nombre) {
    var cols = {}, re = new RegExp('hlslcc_mtx4x4unity_' + nombre + '\\[([0-3])\\]', 'g'), m;
    while ((m = re.exec(fuente))) cols[m[1]] = true;
    return Object.keys(cols);
  }
  function instanciar(vs, fs) {
    var fsO2W = RE_O2W.test(fs) ? columnas(fs, 'ObjectToWorld') : [];
    var fsW2O = RE_W2O.test(fs) ? columnas(fs, 'WorldToObject') : [];
    var usaW2O = RE_W2O.test(vs) || fsW2O.length > 0;
    var decl = 'in highp vec4 in_O2W0;\nin highp vec4 in_O2W1;\nin highp vec4 in_O2W2;\nin highp vec4 in_O2W3;\n' +
      'highp mat4 porteo_O2W;\nhighp mat4 porteo_W2O;\n';
    var pasar = '';
    fsO2W.forEach(function (c) { decl += 'flat out highp vec4 porteo_fO2W' + c + ';\n'; pasar += '    porteo_fO2W' + c + ' = porteo_O2W[' + c + '];\n'; });
    fsW2O.forEach(function (c) { decl += 'flat out highp vec4 porteo_fW2O' + c + ';\n'; pasar += '    porteo_fW2O' + c + ' = porteo_W2O[' + c + '];\n'; });
    vs = vs.replace(RE_W2O, '');
    vs = RE_O2W.test(vs) ? vs.replace(RE_O2W, decl) : decl + vs;
    vs = vs.replace(/hlslcc_mtx4x4unity_ObjectToWorld/g, 'porteo_O2W').replace(/hlslcc_mtx4x4unity_WorldToObject/g, 'porteo_W2O');
    vs = vs.replace(/void\s+main\s*\(\s*\)\s*\{/, 'void main()\n{\n    porteo_O2W = mat4(in_O2W0, in_O2W1, in_O2W2, in_O2W3);\n' +
      (usaW2O ? '    porteo_W2O = inverse(porteo_O2W);\n' : '') + pasar);
    if (fsO2W.length) {
      fs = fs.replace(RE_O2W, fsO2W.map(function (c) { return 'flat in highp vec4 porteo_fO2W' + c + ';'; }).join('\n'));
      fs = fs.replace(/hlslcc_mtx4x4unity_ObjectToWorld\[(\d)\]/g, 'porteo_fO2W$1');
    }
    if (fsW2O.length) {
      fs = fs.replace(RE_W2O, fsW2O.map(function (c) { return 'flat in highp vec4 porteo_fW2O' + c + ';'; }).join('\n'));
      fs = fs.replace(/hlslcc_mtx4x4unity_WorldToObject\[(\d)\]/g, 'porteo_fW2O$1');
    }
    return [vs, fs];
  }

  function compilar(tipo, fuente, nombre) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, '#version 300 es\n' + fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var e = gl.getShaderInfoLog(s);
      console.warn('porteo: no compila ' + nombre + (tipo === gl.VERTEX_SHADER ? ' (vertex)' : ' (fragment)') + ': ' + e);
      return null;
    }
    return s;
  }

  function programa(pasada, nombre) {
    var par = instanciar(pasada.vs, pasada.fs), vs = par[0], fs = par[1];
    var clave = vs + '\u0000' + fs;
    if (programas[clave] !== undefined) return programas[clave];
    var v = compilar(gl.VERTEX_SHADER, vs, nombre), f = compilar(gl.FRAGMENT_SHADER, fs, nombre);
    var p = null;
    if (v && f) {
      var prog = gl.createProgram();
      gl.attachShader(prog, v); gl.attachShader(prog, f);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn('porteo: no enlaza ' + nombre + ': ' + gl.getProgramInfoLog(prog));
      } else {
        p = { prog: prog, nombre: nombre, uniforms: [], atributos: {} };
        var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS), unidad = 0;
        for (var i = 0; i < n; i++) {
          var u = gl.getActiveUniform(prog, i);
          var base = u.name.replace(/\[0\]$/, '');
          var esTex = u.type === gl.SAMPLER_2D || u.type === gl.SAMPLER_CUBE || u.type === gl.SAMPLER_3D || u.type === gl.SAMPLER_2D_SHADOW;
          p.uniforms.push({ nombre: base, loc: gl.getUniformLocation(prog, u.name), tipo: u.type, n: u.size,
            unidad: esTex ? unidad++ : -1, cubo: u.type === gl.SAMPLER_CUBE });
        }
        var na = gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES);
        for (var j = 0; j < na; j++) {
          var at = gl.getActiveAttrib(prog, j);
          p.atributos[at.name] = gl.getAttribLocation(prog, at.name);
        }
      }
    }
    programas[clave] = p;
    return p;
  }

  // ── uniforms ──────────────────────────────────────────────────────────────
  function poner(u, v) {
    var t = u.tipo;
    if (typeof v === 'number') {
      if (t === gl.FLOAT) gl.uniform1f(u.loc, v);
      else if (t === gl.INT || t === gl.BOOL) gl.uniform1i(u.loc, v);
      else if (t === gl.FLOAT_VEC4) gl.uniform4f(u.loc, v, v, v, v);
      return;
    }
    switch (t) {
      case gl.FLOAT: gl.uniform1f(u.loc, v[0]); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v.length >= 2 * u.n ? v.subarray ? v.subarray(0, 2 * u.n) : v.slice(0, 2 * u.n) : [v[0], v[1]]); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v.length >= 3 * u.n ? (v.subarray ? v.subarray(0, 3 * u.n) : v.slice(0, 3 * u.n)) : [v[0], v[1], v[2]]); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v.length >= 4 * u.n ? (v.subarray ? v.subarray(0, 4 * u.n) : v.slice(0, 4 * u.n)) : [v[0], v[1], v[2], v[3] === undefined ? 1 : v[3]]); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
      case gl.INT: case gl.BOOL: gl.uniform1i(u.loc, v[0]); break;
    }
  }

  function global(nombre, valor) { globales[nombre] = valor; }

  // ── materiales ────────────────────────────────────────────────────────────
  // Un material del export: sus propiedades pasan a uniforms con los nombres de Unity
  // (_Tex, _Tex_ST, _Tex_TexelSize, _Color...).
  function material(m, shader, texturas) {
    var props = {};
    var def = shader.propiedades || {};
    Object.keys(def).forEach(function (k) {
      var d = def[k];
      if (d.tipo === 'float') props[k] = d.def;
      else if (d.tipo === 'vec') props[k] = d.def;
      else props[k] = { textura: texDefecto[d.def] || texDefecto.gray, st: [1, 1, 0, 0] };
    });
    Object.keys(m.floats).forEach(function (k) { props[k] = m.floats[k]; });
    Object.keys(m.colores).forEach(function (k) { props[k] = m.colores[k]; });
    Object.keys(m.tex).forEach(function (k) {
      var te = m.tex[k];
      var t = te.t != null && texturas[te.t] ? texturas[te.t] : (props[k] && props[k].textura) || texDefecto[(def[k] || {}).def] || texDefecto.white;
      props[k] = { textura: t, st: te.st };
    });
    var uniformes = {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v && v.textura) {
        uniformes[k] = v.textura;
        uniformes[k + '_ST'] = new Float32Array(v.st);
        uniformes[k + '_TexelSize'] = new Float32Array([1 / v.textura.w, 1 / v.textura.h, v.textura.w, v.textura.h]);
        uniformes[k + '_HDR'] = new Float32Array([1, 1, 0, 0]);
      } else if (Array.isArray(v)) {
        uniformes[k] = new Float32Array(v);
      } else {
        uniformes[k] = v;
      }
    });
    // las pasadas con su programa y su estado (que puede depender de propiedades: [_ZWrite])
    var pasadas = [];
    shader.pasadas.forEach(function (pa) {
      var p = programa(pa, shader.nombre);
      if (!p) return;
      pasadas.push({ programa: p, estado: resolverEstado(pa.estado, props) });
    });
    var cola = m.cola >= 0 ? m.cola : colaDeTag(shader.tags.Queue || (shader.pasadas[0] && shader.pasadas[0].tags.QUEUE));
    return { nombre: m.nombre, uniformes: uniformes, pasadas: pasadas, cola: cola };
  }

  function colaDeTag(q) {
    if (!q) return 2000;
    var m = /^(\w+)\s*([+-]\s*\d+)?$/.exec(String(q).trim());
    var base = { Background: 1000, Geometry: 2000, AlphaTest: 2450, Transparent: 3000, Overlay: 4000 }[m ? m[1] : q];
    if (base === undefined) return +q || 2000;
    return base + (m && m[2] ? parseInt(m[2].replace(/\s/g, ''), 10) : 0);
  }

  function resolverEstado(e, props) {
    function v(x) { return x && typeof x === 'object' ? (props[x.p] !== undefined ? +props[x.p] : x.v) : x; }
    return { zwrite: v(e.zwrite), ztest: v(e.ztest), cull: v(e.cull), blend: e.blend.map(v), mascara: v(e.mask),
      offset: e.offset.map(v) };
  }

  // ── dibujo ────────────────────────────────────────────────────────────────
  // Una malla en la GPU: sus atributos (con los nombres de Unity) y sus índices.
  function malla(atributos, indices) {
    var vao = { buffers: {}, n: indices.length, tipoIdx: indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
    Object.keys(atributos).forEach(function (k) {
      var a = atributos[k];
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, a.datos, gl.STATIC_DRAW);
      vao.buffers[k] = { buf: b, comps: a.comps, tipo: a.tipo || gl.FLOAT, norm: !!a.norm };
    });
    vao.idx = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vao.idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return vao;
  }

  function instancias(matrices) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.STATIC_DRAW);
    return { buf: b, n: matrices.length / 16 };
  }

  function actualizar(inst, matrices) {
    gl.bindBuffer(gl.ARRAY_BUFFER, inst.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrices);
  }

  // Un VAO por dibujo y programa: la misma malla puede ir con otras instancias en otro dibujo.
  var idProg = 0;
  function vaoPara(d, p) {
    var m = d.malla, inst = d.instancias;
    var clave = p.prog.__id || (p.prog.__id = ++idProg);
    var vaos = d.vaos || (d.vaos = {});
    if (d.vaosDe !== inst) { d.vaos = vaos = {}; d.vaosDe = inst; }
    var v = vaos[clave];
    if (v) return v;
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    Object.keys(p.atributos).forEach(function (nombre) {
      var loc = p.atributos[nombre];
      if (loc < 0) return;
      var mm = /^in_O2W(\d)$/.exec(nombre);
      if (mm) {
        gl.bindBuffer(gl.ARRAY_BUFFER, inst.buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 64, 16 * +mm[1]);
        gl.vertexAttribDivisor(loc, 1);
        return;
      }
      var a = m.buffers[nombre];
      if (!a) {
        // atributo que la malla no trae: el valor por defecto de Unity (blanco para el color)
        gl.disableVertexAttribArray(loc);
        if (nombre === 'in_COLOR0') gl.vertexAttrib4f(loc, 1, 1, 1, 1);
        else gl.vertexAttrib4f(loc, 0, 0, 0, 1);
        return;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, a.buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, a.comps, a.tipo, a.norm, 0, 0);
    });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    gl.bindVertexArray(null);
    vaos[clave] = v;
    return v;
  }

  var estadoActual = {};
  function aplicarEstado(e) {
    var zw = !!e.zwrite;
    if (estadoActual.zw !== zw) { gl.depthMask(zw); estadoActual.zw = zw; }
    var zt = COMPARAR[e.ztest] || gl.LEQUAL;
    if (estadoActual.zt !== zt) { gl.depthFunc(zt); estadoActual.zt = zt; }
    var cull = e.cull | 0;
    if (estadoActual.cull !== cull) {
      if (cull === 0) gl.disable(gl.CULL_FACE);
      else { gl.enable(gl.CULL_FACE); gl.cullFace(cull === 1 ? gl.FRONT : gl.BACK); }
      estadoActual.cull = cull;
    }
    var b = e.blend, mezcla = !(b[0] === 1 && b[1] === 0);
    var claveB = mezcla ? b.join(',') : 'no';
    if (estadoActual.b !== claveB) {
      if (!mezcla) gl.disable(gl.BLEND);
      else {
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(MEZCLA[b[0]], MEZCLA[b[1]], MEZCLA[b[2] === undefined ? b[0] : b[2]], MEZCLA[b[3] === undefined ? b[1] : b[3]]);
      }
      estadoActual.b = claveB;
    }
  }

  // Dibuja una lista de {malla, instancias, material}: primero por cola, los transparentes de atrás para adelante.
  var usadoGlobal = new Map();
  function dibujar(lista, posCamara) {
    lista.sort(function (a, b) {
      var ca = a.material.cola, cb = b.material.cola;
      if (ca !== cb) return ca - cb;
      if (ca >= 2500) return (b.dist || 0) - (a.dist || 0);
      return 0;
    });
    usadoGlobal.clear();
    var progActual = null, matActual = null;
    for (var i = 0; i < lista.length; i++) {
      var d = lista[i], mat = d.material;
      for (var j = 0; j < mat.pasadas.length; j++) {
        var pa = mat.pasadas[j], p = pa.programa;
        if (p !== progActual) { gl.useProgram(p.prog); progActual = p; matActual = null; }
        aplicarEstado(pa.estado);
        if (matActual !== mat || mat.pasadas.length > 1) {
          for (var k = 0; k < p.uniforms.length; k++) {
            var u = p.uniforms[k];
            var v = mat.uniformes[u.nombre];
            if (v === undefined) v = globales[u.nombre];
            if (u.unidad >= 0) {
              gl.activeTexture(gl.TEXTURE0 + u.unidad);
              var t = (v && v.tex) ? v : texDefecto.white;
              gl.bindTexture(u.cubo ? gl.TEXTURE_CUBE_MAP : gl.TEXTURE_2D, u.cubo ? null : t.tex);
              gl.uniform1i(u.loc, u.unidad);
            } else if (v !== undefined) {
              poner(u, v);
            } else if (!faltantes[u.nombre]) {
              faltantes[u.nombre] = p.nombre;
            }
          }
          matActual = mat;
        }
        gl.bindVertexArray(vaoPara(d, p));
        gl.drawElementsInstanced(gl.TRIANGLES, d.malla.n, d.malla.tipoIdx, 0, d.instancias.n);
      }
    }
    gl.bindVertexArray(null);
  }

  return { iniciar: iniciar, textura: textura, material: material, malla: malla, instancias: instancias, actualizar: actualizar, dibujar: dibujar,
    global: global, faltantes: function () { return faltantes; }, gl: function () { return gl; }, colaDeTag: colaDeTag };
})();
