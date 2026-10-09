/* Anger of Stick 5 en el navegador: carga el juego traducido (aos5.wasm), lo hace andar al ritmo de
 * cocos2d (una vuelta cada 0,06 s) y dibuja lo que arma en WebGL. Toques, sonido y guardado como el
 * original. */
(function () {
  'use strict';
  var A = window.AOS = {};
  var M;                      // el módulo de emscripten
  var gl, canvas, prog, vbo, ibo, texturas = {};
  var imagenesBin;            // datos/imagenes.bin: cada imagen del APK como WebP (con su borde)
  var porSubir = 0;           // imágenes pedidas que todavía se están decodificando
  var generacion = 0;         // sube cuando se vacía el atlas: lo que llegue de antes se tira
  var ladoAtlas = 1024;
  var colaToques = [];        // toques que llegan mientras el juego espera sus imágenes
  var sucio = true, ultimo = 0, corriendo = false, terminado = false;
  var DISENO_W = 960, DISENO_H = 640;
  var MAXQ = 16384;
  // contadores para las pruebas: tiempos en ms (suma y máximo) de la lógica del juego y del dibujo
  var info = { vueltas: 0, cuadros: 0, dibujos: 0, toques: 0, msPaso: 0, maxPaso: 0, msDibujo: 0, maxDibujo: 0,
    imagenes: 0, paginas: 0, esperas: 0, msEspera: 0, maxEspera: 0 };
  A.info = info;

  function log(s) { if (A.verLog) console.log('[aos5] ' + s); A.ultimoLog = s; }

  // ───────────────────────────── lo que pide el juego (host.js → acá)
  var H = window.AOS_HOST = {
    log: function (s) { log(s); },
    trap: function (s) {
      terminado = true;
      console.error('[aos5] ' + s);
      A.error = s;
      var e = document.getElementById('error');
      if (e) { e.textContent = 'El juego se detuvo: ' + s; e.hidden = false; }
    },
    sonido: function (r, bucle, vol) { return Sonido.tocar(r, bucle, vol); },
    parar: function (id) { Sonido.parar(id); },
    todo: function (q) { Sonido.todo(q); },
    cargar: function (r) { Sonido.cargar(r); },
    leer: function (n) {
      try {
        var v = localStorage.getItem('aos5.archivo.' + n);
        if (v == null) return null;
        var b = atob(v), u = new Uint8Array(b.length);
        for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
        return u;
      } catch (e) { return null; }
    },
    escribir: function (n, d) {
      try {
        var s = '';
        for (var i = 0; i < d.length; i += 8192) s += String.fromCharCode.apply(null, d.subarray(i, i + 8192));
        localStorage.setItem('aos5.archivo.' + n, btoa(s));
      } catch (e) { log('no se pudo guardar ' + n + ': ' + e); }
    },
    dato: function (k) { try { return localStorage.getItem('aos5.dato.' + k); } catch (e) { return null; } },
    datoPoner: function (k, v) { try { localStorage.setItem('aos5.dato.' + k, v); } catch (e) {} },
    vibrar: function (ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} },
    subir: function (i, pag, x, y, off, len) { subirImagen(pag, x, y, off, len); },
    vaciar: function () { vaciarAtlas(); },
    glifo: function (f, cp, tam) { return Letras.glifo(cp, tam); },
  };

  // ───────────────────────────── sonido (sólo efectos: el juego no tiene música)
  var Sonido = (function () {
    var ctx = null, buffers = {}, cargando = {}, fuentes = {}, sigId = 1;
    var silencio = false;
    function archivo(r) {
      var b = r.replace(/^.*sound\//, '').replace(/\.(wav|ogg)$/i, '');
      return 'datos/sonido/' + b + '.ogg';
    }
    function contexto() {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) return null;
        try { ctx = new C({ sampleRate: 24000 }); } catch (e) { ctx = new C(); }
      }
      return ctx;
    }
    function cargar(r) {
      if (buffers[r] || cargando[r]) return cargando[r];
      var c = contexto();
      if (!c) return null;
      cargando[r] = fetch(archivo(r)).then(function (x) { return x.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, mal) { c.decodeAudioData(ab, ok, mal); }); })
        .then(function (b) { buffers[r] = b; return b; })
        .catch(function (e) { log('sonido ' + r + ': ' + e); });
      return cargando[r];
    }
    function tocar(r, bucle, vol) {
      var id = sigId++;
      var c = contexto();
      if (!c || silencio) return id;
      var arrancar = function (b) {
        if (!b || silencio) return;
        var s = c.createBufferSource();
        s.buffer = b;
        s.loop = !!bucle;
        var g = c.createGain();
        g.gain.value = Math.max(0, Math.min(1, vol));
        s.connect(g).connect(c.destination);
        s.onended = function () { delete fuentes[id]; };
        s.start();
        fuentes[id] = s;
      };
      if (buffers[r]) arrancar(buffers[r]);
      else { var p = cargar(r); if (p) p.then(arrancar); }
      return id;
    }
    function parar(id) {
      var s = fuentes[id];
      if (!s) return;
      try { s.stop(); } catch (e) {}
      delete fuentes[id];
    }
    function todo(q) {
      if (q === 0) Object.keys(fuentes).forEach(function (id) { parar(+id); });
      else pausar(q === 1);
    }
    function pausar(si) {
      silencio = si;
      if (ctx) { try { si ? ctx.suspend() : ctx.resume(); } catch (e) {} }
    }
    function desbloquear() {
      var c = contexto();
      if (c && c.state === 'suspended' && !silencio) c.resume();
    }
    return { tocar: tocar, parar: parar, todo: todo, cargar: cargar, pausar: pausar, desbloquear: desbloquear,
      ctx: function () { return ctx; } };
  })();
  A.sonido = Sonido;

  // ───────────────────────────── letras (las dibuja el navegador con la arial del APK)
  var Letras = (function () {
    var PAG = 1024, paginas = [], cache = {}, x = 0, y = 0, alto = 0, ctx2 = null, lienzo = null;
    var BASE = 1000;   // número de página para el dibujo (las del atlas son 0..)
    function nuevaPagina() {
      lienzo = document.createElement('canvas');
      lienzo.width = lienzo.height = PAG;
      ctx2 = lienzo.getContext('2d');
      ctx2.fillStyle = '#fff';
      ctx2.textBaseline = 'alphabetic';
      paginas.push({ lienzo: lienzo, sucia: true });
      x = 0; y = 0; alto = 0;
    }
    function glifo(cp, tam) {
      var k = cp + '/' + tam;
      if (cache[k]) return cache[k];
      if (!lienzo) nuevaPagina();
      var ch = String.fromCodePoint(cp);
      ctx2.font = tam + 'px aos5arial, Arial, sans-serif';
      var m = ctx2.measureText(ch);
      var izq = Math.ceil(m.actualBoundingBoxLeft || 0), der = Math.ceil(m.actualBoundingBoxRight || m.width);
      var arr = Math.ceil(m.actualBoundingBoxAscent || tam), aba = Math.ceil(m.actualBoundingBoxDescent || 0);
      var w = izq + der + 2, h = arr + aba + 2;
      if (x + w > PAG) { x = 0; y += alto + 1; alto = 0; }
      if (y + h > PAG) { nuevaPagina(); }
      ctx2.font = tam + 'px aos5arial, Arial, sans-serif';
      ctx2.fillText(ch, x + 1 + izq, y + 1 + arr);
      paginas[paginas.length - 1].sucia = true;
      var g = new Float32Array([BASE + paginas.length - 1,
        (x) / PAG, (y) / PAG, (x + w) / PAG, (y + h) / PAG,
        -izq - 1, -aba - 1, der + 1, arr + 1]);
      x += w + 1;
      alto = Math.max(alto, h);
      sucio = true;
      return (cache[k] = g);
    }
    return { glifo: glifo, paginas: paginas, BASE: BASE };
  })();

  // ───────────────────────────── WebGL
  var VS = 'attribute vec2 p; attribute vec2 t; attribute vec4 c; varying vec2 vt; varying vec4 vc;' +
    'void main(){ gl_Position = vec4(p.x/480.0-1.0, p.y/320.0-1.0, 0.0, 1.0); vt = t; vc = c; }';
  var FS = 'precision mediump float; uniform sampler2D s; varying vec2 vt; varying vec4 vc;' +
    'void main(){ gl_FragColor = texture2D(s, vt) * vc; }';

  function iniciarGL() {
    canvas = document.getElementById('juego');
    var op = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    gl = canvas.getContext('webgl', op) || canvas.getContext('experimental-webgl', op);
    if (!gl) throw new Error('Este navegador no tiene WebGL');
    function sh(t, s) { var x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; }
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, 'p');
    gl.bindAttribLocation(prog, 1, 't');
    gl.bindAttribLocation(prog, 2, 'c');
    gl.linkProgram(prog);
    gl.useProgram(prog);
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, MAXQ * 4 * 20, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 8);
    gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    var idx = new Uint16Array(MAXQ * 6);
    for (var i = 0; i < MAXQ; i++) {
      idx[i * 6] = i * 4; idx[i * 6 + 1] = i * 4 + 1; idx[i * 6 + 2] = i * 4 + 2;
      idx[i * 6 + 3] = i * 4 + 2; idx[i * 6 + 4] = i * 4 + 1; idx[i * 6 + 5] = i * 4 + 3;
    }
    ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.uniform1i(gl.getUniformLocation(prog, 's'), 0);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });
    canvas.addEventListener('webglcontextrestored', function () {
      iniciarGL();
      texturas = {};
      generacion++;
      porSubir = 0;
      Letras.paginas.forEach(function (p) { p.sucia = true; });
      if (M) M._aos_reiniciar_atlas();   // las imágenes se vuelven a pedir al dibujar
      sucio = true;
    });
  }

  function textura(img, premult) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premult ? 1 : 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // el atlas: páginas de ladoAtlas² que se van llenando con las imágenes que pide el juego (tablas.c
  // decide dónde va cada una). Se decodifican en otro hilo; mientras falte alguna, el juego espera.
  function pagina(n) {
    if (texturas[n]) return texturas[n];
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, ladoAtlas, ladoAtlas, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    info.paginas++;
    return (texturas[n] = t);
  }
  function subirImagen(pag, x, y, off, len) {
    var gen = generacion;
    porSubir++;
    info.imagenes++;
    var b = new Blob([imagenesBin.subarray(off, off + len)], { type: 'image/webp' });
    var dec = window.createImageBitmap ? createImageBitmap(b, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'none' })
      : imagenDeBlob(b);
    dec.then(function (bm) {
      if (gen === generacion && gl) {
        gl.bindTexture(gl.TEXTURE_2D, pagina(pag));
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, window.ImageBitmap && bm instanceof ImageBitmap ? 0 : 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, bm);
      }
      if (bm.close) bm.close();
    }).catch(function (e) { log('imagen en ' + off + ': ' + e); })
      .then(function () { if (gen === generacion) porSubir--; sucio = true; });
  }
  function vaciarAtlas() {
    generacion++;
    porSubir = 0;
    Object.keys(texturas).forEach(function (k) { if (k < Letras.BASE) { gl.deleteTexture(texturas[k]); delete texturas[k]; } });
    info.paginas = 0;
  }
  function imagenDeBlob(b) {
    return new Promise(function (ok, mal) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = mal;
      im.src = URL.createObjectURL(b);
    });
  }

  var vista = { x: 0, y: 0, w: 1, h: 1 };   // el rectángulo del diseño en la pantalla, en px CSS
  function ajustar() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = window.innerWidth, ch = window.innerHeight;
    var bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
    var tope = 1600;   // más que esto no se ve mejor (el juego es de 960×640) y cuesta
    if (bw > tope) { bh = Math.round(bh * tope / bw); bw = tope; }
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; sucio = true; }
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    var pol = M ? M._aos_politica() : 0;
    if (pol === 0) vista = { x: 0, y: 0, w: cw, h: ch };         // EXACT_FIT: estirado como el original
    else {
      var s = Math.min(cw / DISENO_W, ch / DISENO_H);
      vista = { w: DISENO_W * s, h: DISENO_H * s, x: (cw - DISENO_W * s) / 2, y: (ch - DISENO_H * s) / 2 };
    }
    if (M) M._aos_pantalla(bw, bh);
  }

  function dibujar() {
    var n = M._aos_dibujar();
    if (porSubir > 0) { sucio = true; return; }   // pidió imágenes al dibujar: queda el cuadro anterior
    var vp = M._aos_verts_ptr();
    var nl = M._aos_lotes_n(), lp = M._aos_lotes_ptr() >> 2;
    var sx = canvas.width / window.innerWidth, sy = canvas.height / window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(Math.round(vista.x * sx), Math.round((window.innerHeight - vista.y - vista.h) * sy),
      Math.round(vista.w * sx), Math.round(vista.h * sy));
    // las letras nuevas
    Letras.paginas.forEach(function (p, i) {
      if (!p.sucia) return;
      var id = Letras.BASE + i;
      if (texturas[id]) { gl.bindTexture(gl.TEXTURE_2D, texturas[id]); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p.lienzo); }
      else texturas[id] = textura(p.lienzo, true);
      p.sucia = false;
    });
    if (n > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, M.HEAPU8.subarray(vp, vp + n * 80));
    }
    var U = M.HEAPU32;
    for (var l = 0; l < nl; l++) {
      var pag = U[lp + l * 4], mez = U[lp + l * 4 + 1], desde = U[lp + l * 4 + 2], cuantos = U[lp + l * 4 + 3];
      var t = texturas[pag];
      if (!t) continue;   // una página todavía vacía
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.blendFunc(blends[mez][0], blends[mez][1]);
      gl.drawElements(gl.TRIANGLES, cuantos * 6, gl.UNSIGNED_SHORT, (desde / 4) * 12);
    }
    info.dibujos++;
    sucio = false;
    if (alPrimerCuadro) { alPrimerCuadro(); alPrimerCuadro = null; }
  }
  var blends = [];
  var alPrimerCuadro, primerCuadro = new Promise(function (ok) { alPrimerCuadro = ok; });

  // ───────────────────────────── toques (como los manda cocos2d en Android)
  var dedos = new Map();   // pointerId → {x, y} en coordenadas GL del diseño
  function aDiseno(e) {
    var x = (e.clientX - vista.x) / vista.w * DISENO_W;
    var y = (1 - (e.clientY - vista.y) / vista.h) * DISENO_H;
    return { x: x, y: y };
  }
  var buf = null;
  function mandar(fase, lista) {
    if (!M || terminado || !lista.length) return;
    if (porSubir > 0) { colaToques.push([fase, lista]); return; }
    info.toques = (info.toques || 0) + 1;
    info.ultimoToque = [fase, Math.round(lista[0].x), Math.round(lista[0].y)];
    if (!buf) buf = M._aos_reservar(16 * 8);
    var F = M.HEAPF32, b = buf >> 2;
    for (var i = 0; i < lista.length && i < 16; i++) { F[b + 2 * i] = lista[i].x; F[b + 2 * i + 1] = lista[i].y; }
    try { M._aos_toque(fase, Math.min(lista.length, 16), buf); } catch (er) { H.trap(String(er)); }
  }
  var movidos = false;
  function abajo(e) {
    Sonido.desbloquear();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var p = aDiseno(e);
    dedos.set(e.pointerId, p);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    mandar(0, [p]);
    e.preventDefault();
  }
  function mueve(e) {
    if (!dedos.has(e.pointerId)) return;
    dedos.set(e.pointerId, aDiseno(e));
    movidos = true;
    e.preventDefault();
  }
  // Un dedo cancelado (el navegador se quedó con el gesto, la página se ocultó) se manda como soltado:
  // el juego no atiende onTouchesCancelled y el botón quedaría apretado.
  function arriba(e) {
    if (!dedos.has(e.pointerId)) return;
    var p = aDiseno(e);
    if (movidos) { mandar(1, Array.from(dedos.values())); movidos = false; }
    dedos.delete(e.pointerId);
    mandar(2, [p]);
    e.preventDefault();
  }
  function soltarTodo() {
    var l = Array.from(dedos.values());
    dedos.clear();
    l.forEach(function (p) { mandar(2, [p]); });
  }

  // ───────────────────────────── la vuelta
  var esperaDesde = 0;
  function vuelta(t) {
    if (!corriendo) return;
    requestAnimationFrame(vuelta);
    if (terminado || document.hidden) return;
    if (movidos) { mandar(1, Array.from(dedos.values())); movidos = false; }
    if (porSubir > 0) {
      // el juego espera sus imágenes, como el original que las cargaba en el hilo de GL; al seguir no
      // recupera el tiempo de la espera
      if (!esperaDesde) { esperaDesde = t; info.esperas++; }
      ultimo = 0;
      return;
    }
    if (esperaDesde) {
      var e = t - esperaDesde;
      info.msEspera += e;
      if (e > info.maxEspera) info.maxEspera = e;
      esperaDesde = 0;
      var cola = colaToques;
      colaToques = [];
      cola.forEach(function (c) { mandar(c[0], c[1]); });
    }
    var dt = ultimo ? (t - ultimo) / 1000 : 0;
    ultimo = t;
    if (dt > 0.25) dt = 0.25;
    var n = 0, t0 = performance.now();
    try { n = M._aos_paso(dt); } catch (er) { H.trap(String(er && er.message || er)); return; }
    var t1 = performance.now();
    info.cuadros++;
    if (n > 0) {
      info.vueltas += n;
      sucio = true;
      info.msPaso += t1 - t0;
      if (t1 - t0 > info.maxPaso) info.maxPaso = t1 - t0;
    }
    if (sucio) {
      try { dibujar(); } catch (er) { H.trap('dibujo: ' + er); }
      var t2 = performance.now();
      info.msDibujo += t2 - t1;
      if (t2 - t1 > info.maxDibujo) info.maxDibujo = t2 - t1;
    }
    if (M._aos_salir()) salir();
  }
  function salir() {
    corriendo = false;
    Sonido.todo(0);
    if (window.porteoSalir) window.porteoSalir();
    else { var e = document.getElementById('fin'); if (e) e.hidden = false; }
  }

  // la página se oculta (otra app, pantalla apagada, pestaña cerrada) o vuelve: como onPause/onResume
  // de Android, el juego guarda y pausa; mientras está oculta no avanza
  function visibilidad() {
    if (!M || terminado) return;
    if (document.hidden) {
      soltarTodo();
      try { M._aos_fondo(1); } catch (er) { H.trap(String(er)); }
      Sonido.pausar(true);
    } else {
      try { M._aos_fondo(0); } catch (er) { H.trap(String(er)); }
      Sonido.pausar(false);
      sucio = true;
    }
    ultimo = 0;
  }

  // ───────────────────────────── arranque
  function bajar(u, tipo) {
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error(u + ': ' + r.status);
      return tipo === 'json' ? r.json() : r.arrayBuffer();
    });
  }

  A.arrancar = function (op) {
    op = op || {};
    iniciarGL();
    var fuente = new FontFace('aos5arial', 'url(datos/arial.ttf)');
    var listo = Promise.all([
      bajar('datos/imagenes.bin'),
      bajar('datos/imagen.bin'),
      bajar('datos/datos.bin'),
      fuente.load().then(function (f) { document.fonts.add(f); }).catch(function () {}),
      AOS5({ locateFile: function (p) { return p; } }),
    ]);
    return listo.then(function (r) {
      imagenesBin = new Uint8Array(r[0]);
      M = A.M = r[4];
      // la memoria del .so, en su lugar
      var img = new DataView(r[1]);
      var u8 = new Uint8Array(r[1]);
      if (img.getUint32(0, true) !== 0x69534f41) throw new Error('imagen.bin rara');
      var roLo = img.getUint32(8, true), roN = img.getUint32(12, true), rwLo = img.getUint32(16, true), rwN = img.getUint32(20, true);
      M.HEAPU8.set(u8.subarray(24, 24 + roN), roLo);
      M.HEAPU8.set(u8.subarray(24 + roN, 24 + roN + rwN), rwLo);
      var paq = new Uint8Array(r[2]);
      var p = M._aos_reservar(paq.length);
      M.HEAPU8.set(paq, p);
      M._aos_paquete(p, paq.length);
      for (var i = 0; i < M._aos_nblend(); i++) blends.push([M._aos_blend(i, 0), M._aos_blend(i, 1)]);
      ladoAtlas = M._aos_atlas();
      ajustar();
      var semilla = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
      if (!M._aos_iniciar(op.semilla || semilla, canvas.width, canvas.height)) throw new Error('el juego no arrancó');
      window.addEventListener('resize', ajustar);
      document.addEventListener('visibilitychange', visibilidad);
      canvas.addEventListener('pointerdown', abajo, { passive: false });
      canvas.addEventListener('pointermove', mueve, { passive: false });
      canvas.addEventListener('pointerup', arriba, { passive: false });
      canvas.addEventListener('pointercancel', arriba, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      corriendo = true;
      requestAnimationFrame(vuelta);
      return primerCuadro;   // la pantalla de carga se va cuando el primer cuadro está completo
    });
  };
  A.atras = function () {
    if (!M || terminado) return false;
    try { M._aos_atras(); } catch (er) { H.trap(String(er)); }
    return true;
  };
  A.ajustar = function () { ajustar(); };
  A.vista = function () { return vista; };   // el rectángulo del juego en la página (para las pruebas)
})();
