// porteo: el juego. La carga, los menús de la 1.2 (con el panorama del río), el idioma y los shaders
// que se eligen la primera vez, los mundos guardados (IndexedDB), los tres mundos públicos y los
// servidores (red.js), los bichos (bichos.js) y el bucle: 20 pasos por segundo de física, como
// Minecraft, y la cámara interpolada a lo que dé la pantalla. Tocar un bloque pone el elegido (o abre
// la puerta), tocar un bicho o un jugador le pega, mantener el dedo rompe; arrastrar mira; la
// cruceta camina; doble toque en saltar vuela; doble toque adelante corre. En la computadora: mouse,
// WASD, espacio, shift, ctrl, rueda, 1-9, E y T (chat).
(function () {
  'use strict';
  var lienzo = document.getElementById('lienzo'), hud = document.getElementById('hud');
  var I = Interfaz, J = Jugador, O = Objetos, B = Bichos;
  var datos = null, imgs = {}, trab = null, urlTrabajador = null;
  var PASO = 1 / 20;
  var cam = { x: 0.5, y: 80, z: 0.5, yaw: 0, pitch: 0, fov: 70 * Math.PI / 180 };
  var mundo = { dist: 6, tiempo: 1000, reloj: 0, lluvia: 0, temperatura: 0.8, apuntado: null, rompiendo: 0, bajoAgua: false, nubes: true, entidades: [] };
  var partida = null;           // el mundo abierto
  var jugando = false;          // hay un mundo andando (si no, el menú con el panorama)
  var telefono = matchMedia('(pointer: coarse)').matches;
  var TEMPERATURA = [0.5, 0.8, 2, 0.2, 0.7, 0.25, 0.8, 0.5, 0.8, 0.95, 0.6, 0.7, -0.5, 1.2, 2, 0, 0.5, 0.3];
  // los tres mundos públicos (fijados arriba de todo): el mismo mundo para todos los que entran
  var PUBLICOS = [
    { sala: 'publico1', semilla: 1234, tipo: 'infinito', desc: 'publico.desc1' },
    { sala: 'publico2', semilla: 2017, tipo: 'infinito', desc: 'publico.desc2' },
    { sala: 'publico3', semilla: 3, tipo: 'plano', desc: 'publico.desc3' }
  ];

  // ------------------------------------------------------------------------------------------
  // Opciones (en este navegador)
  // ------------------------------------------------------------------------------------------
  // un teléfono flojo (pocos núcleos o poca memoria; la GPU se mira al arrancar WebGL): se empieza con
  // menos distancia y menos píxeles, y la resolución automática sube si sobra
  var debil = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2;
  var OPC = 'mc12.opciones';
  // las opciones del juego (1.2) y las del port. idioma y shaders: null hasta que se eligen al empezar
  var opciones = {
    idioma: null, shaders: null, nombre: '', skin: 'steve', dist: telefono ? (debil ? 4 : 6) : 8, fov: 70, brillo: 0.5,
    sofisticados: true, hojas: !debil, suave: true, cielos: true, nubes: true, particulas: true, balanceo: true,
    ocultarInterfaz: false, resolucion: 0, limite: 60, fps: false, sens: 1, invertirY: false, zurdo: false, autoSalto: true,
    intercambiar: false, dividido: false, tamBoton: 1, vibrar: true, volumen: 0.8
  };
  try { Object.assign(opciones, JSON.parse(localStorage.getItem(OPC) || '{}')); } catch (e) { /* sin almacenamiento */ }
  if (!opciones.nombre) opciones.nombre = 'Steve' + (100 + Math.floor(Math.random() * 900));
  function guardarOpciones() { try { localStorage.setItem(OPC, JSON.stringify(opciones)); } catch (e) { /* nada */ } }
  // cambio: la opción que cambió (sin nada: todas)
  function aplicarOpciones(cambio) {
    mundo.dist = opciones.dist;
    mundo.nubes = opciones.nubes;
    mundo.cielosHermosos = opciones.cielos;
    Render.brillo = opciones.brillo;
    I.juego.mostrarFps = opciones.fps;
    I.opc = opciones;
    J.autoSalto = opciones.autoSalto;
    Red.nombre = opciones.nombre;
    Sonido.volumen(opciones.volumen);
    if (opciones.idioma && datos) ponerIdioma(opciones.idioma);
    if (Render.listo && opciones.shaders !== null && (!cambio || cambio === 'shaders' || cambio === 'sofisticados')) {
      var con = Render.usarShaders(opciones.shaders, opciones.sofisticados);
      if (opciones.shaders && !con) { opciones.shaders = false; avisar(I.tp('shaders.fallo')); }
    }
    if (trab && jugando) {
      if (!cambio || cambio === 'dist') trab.postMessage({ t: 'centro', cx: ultimoCentro[0], cz: ultimoCentro[1], sy: ultimoCentro[2], dist: opciones.dist });
      if (cambio === 'suave' || cambio === 'hojas') trab.postMessage({ t: 'graficos', suave: opciones.suave, hojas: opciones.hojas });
    }
    I.sucio();
  }
  function ponerIdioma(l) {
    I.idioma = l;
    I.textos = datos.textos[l] || datos.textos.es || {};
    document.documentElement.lang = l;
  }
  function avisar(texto) { I.juego.mensaje = texto; I.juego.mensajeHasta = performance.now() + 2500; I.sucio(); }
  function chat(s, color) {
    I.juego.chat.push({ s: s, c: color, t: performance.now() });
    if (I.juego.chat.length > 60) I.juego.chat.shift();
    I.sucio();
  }

  // las secciones de Ajustes, con los nombres del juego (options.*) y los dibujos de la 1.2
  function armarAjustes() {
    var T = function (k, d) { return I.t(k, d); };
    var pct = function (k) { return function () { return Math.round(opciones[k] * 100) + '%'; }; };
    var cas = function (k, texto) { return { tipo: 'casilla', k: k, texto: texto, valor: function () { return opciones[k]; } }; };
    var des = function (k, texto, min, max, paso, fmt) {
      return { tipo: 'deslizador', k: k, texto: texto, min: min, max: max, paso: paso, valor: function () { return opciones[k]; }, textoValor: fmt };
    };
    var ele = function (k, texto, valores, nombres) {
      return { tipo: 'eleccion', k: k, texto: texto, valores: valores, valor: function () { return opciones[k]; },
        textoValor: function () { var i = valores.indexOf(opciones[k]); return nombres[i < 0 ? 0 : i]; } };
    };
    var juego = [cas('fps', I.tp('fps'))];
    if (partida && partida.local) {
      juego.unshift({ tipo: 'casilla', k: 'siempreDia', mundo: true, texto: T('createWorldScreen.alwaysDay', 'Always Day'),
        valor: function () { return !!(partida && partida.siempreDia); } });
      juego.push({ tipo: 'casilla', k: 'bichos', mundo: true, texto: I.tp('bichos'), valor: function () { return !!(partida && partida.bichos !== false); } });
    }
    I.ajustes = [
      { nombre: T('options.category.game', 'Game'), icono: 'world_glyph', filas: juego },
      { nombre: T('options.profile', 'Profile'), icono: 'profile_glyph', filas: [
        { tipo: 'campo', k: 'nombre', texto: T('options.name', 'Name'), valor: function () { return opciones.nombre; } },
        ele('skin', 'Skin', ['steve', 'alex'], ['Steve', 'Alex'])
      ] },
      { nombre: T('options.touch', 'Touch'), icono: 'touch_glyph', filas: [
        des('sens', T('options.sensitivity', 'Sensitivity'), 0.25, 2, 0.05, pct('sens')),
        cas('invertirY', T('options.invertYAxis', 'Invert Y-Axis')),
        cas('zurdo', T('options.lefthanded', 'Lefty')),
        cas('autoSalto', T('options.autojump', 'Auto Jump')),
        cas('intercambiar', T('options.swapJumpAndSneak', 'Swap Jump and Sneak')),
        cas('dividido', T('options.usetouchpad', 'Split Controls')),
        des('tamBoton', T('options.buttonSize', 'Button Size'), 0.6, 1.6, 0.05, pct('tamBoton')),
        cas('vibrar', T('options.destroyvibration', 'Destroy Block (vibrate)'))
      ] },
      { nombre: T('options.video', 'Video'), icono: 'video_glyph', filas: [
        cas('shaders', I.tp('shaders.opcion')),
        des('dist', T('options.renderDistance', 'Render Distance'), 2, 12, 1, function () { return I.f(T('options.renderDistanceFormat', '%s chunks'), opciones.dist); }),
        des('fov', T('options.fov', 'FOV'), 60, 110, 1, function () { return String(opciones.fov); }),
        des('brillo', T('options.gamma', 'Brightness'), 0, 1, 0.01, pct('brillo')),
        cas('sofisticados', T('options.graphics', 'Fancy Graphics')),
        cas('hojas', T('options.transparentleaves', 'Fancy Leaves')),
        cas('suave', T('options.ao', 'Smooth Lighting')),
        cas('cielos', T('options.fancyskies', 'Beautiful Skies')),
        cas('nubes', T('options.renderClouds', 'Clouds')),
        cas('particulas', T('options.particles', 'Particles')),
        cas('balanceo', T('options.viewBobbing', 'View Bobbing')),
        cas('ocultarInterfaz', T('options.hidegui', 'Hide GUI')),
        ele('resolucion', I.tp('resolucion'), [0, 0.5, 0.75, 1], [I.tp('resolucion.auto'), '50%', '75%', '100%']),
        ele('limite', T('options.framerateLimit', 'Max Framerate'), [30, 60], ['30', '60'])
      ] },
      { nombre: T('options.sounds', 'Audio'), icono: 'sound_glyph', filas: [
        des('volumen', T('options.sound', 'Sound Volume'), 0, 1, 0.01, pct('volumen'))
      ] },
      { nombre: T('options.language', 'Language'), icono: 'language_glyph', filas: [
        ele('idioma', T('options.language', 'Language'), ['en', 'es', 'pt'], ['English', 'Español', 'Português'])
      ] }
    ];
  }

  // ------------------------------------------------------------------------------------------
  // Mundos guardados: IndexedDB (y en memoria si el navegador no deja, p. ej. en algunos cuadros)
  // ------------------------------------------------------------------------------------------
  var BD = (function () {
    var db = null, D = {}, mem = { mundos: new Map(), trozos: new Map() };
    D.abrir = function () {
      return new Promise(function (ok) {
        try {
          var r = indexedDB.open('minecraft12', 1);
          r.onupgradeneeded = function () {
            var d = r.result;
            d.createObjectStore('mundos', { keyPath: 'id' });
            d.createObjectStore('trozos', { keyPath: 'k' }).createIndex('mundo', 'mundo');
          };
          r.onsuccess = function () { db = r.result; ok(true); };
          r.onerror = r.onblocked = function () { ok(false); };
        } catch (e) { ok(false); }
      });
    };
    function pedir(r) { return new Promise(function (ok, mal) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { mal(r.error); }; }); }
    function fin(t) { return new Promise(function (ok, mal) { t.oncomplete = function () { ok(); }; t.onerror = t.onabort = function () { mal(t.error); }; }); }
    D.mundos = function () {
      if (!db) return Promise.resolve(Array.from(mem.mundos.values()));
      return pedir(db.transaction('mundos', 'readonly').objectStore('mundos').getAll());
    };
    D.guardarMundo = function (m) {
      if (!db) { mem.mundos.set(m.id, m); return Promise.resolve(); }
      var t = db.transaction('mundos', 'readwrite');
      t.objectStore('mundos').put(m);
      return fin(t);
    };
    D.trozos = function (id) {
      if (!db) return Promise.resolve(Array.from(mem.trozos.values()).filter(function (r) { return r.mundo === id; }));
      return pedir(db.transaction('trozos', 'readonly').objectStore('trozos').index('mundo').getAll(id));
    };
    D.guardarTrozos = function (lista) {
      if (!lista.length) return Promise.resolve();
      if (!db) { lista.forEach(function (r) { mem.trozos.set(r.k, r); }); return Promise.resolve(); }
      var t = db.transaction('trozos', 'readwrite'), s = t.objectStore('trozos');
      lista.forEach(function (r) { s.put(r); });
      return fin(t);
    };
    D.borrar = function (id) {
      if (!db) {
        mem.mundos.delete(id);
        mem.trozos.forEach(function (r, k) { if (r.mundo === id) mem.trozos.delete(k); });
        return Promise.resolve();
      }
      var t = db.transaction(['mundos', 'trozos'], 'readwrite');
      t.objectStore('mundos').delete(id);
      var c = t.objectStore('trozos').index('mundo').openKeyCursor(IDBKeyRange.only(id));
      c.onsuccess = function () { var k = c.result; if (k) { t.objectStore('trozos').delete(k.primaryKey); k.continue(); } };
      return fin(t);
    };
    return D;
  })();
  // los bloques de un trozo (64 KB) comprimidos quedan en 2-6 KB
  function comprimir(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(u8);
    return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
      .then(function (b) { return new Uint8Array(b); });
  }
  function descomprimir(u8, comprimido) {
    if (!comprimido) return Promise.resolve(u8);
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
      .then(function (b) { return new Uint8Array(b); });
  }
  // los servidores agregados (nombre y dirección), en este navegador
  var SRV = 'mc12.servidores';
  function servidores() { try { return JSON.parse(localStorage.getItem(SRV) || '[]'); } catch (e) { return []; } }
  function guardarServidores(l) { try { localStorage.setItem(SRV, JSON.stringify(l)); } catch (e) { /* nada */ } }

  // ------------------------------------------------------------------------------------------
  // La carga
  // ------------------------------------------------------------------------------------------
  function cargarImagen(src) {
    return new Promise(function (ok, mal) {
      var im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = function () { mal(new Error('no cargó ' + src)); };
      im.src = src;
    });
  }
  function ajustarTamano() {
    // en los menús el panorama se dibuja con menos píxeles (en el título, nítido como la 1.2; atrás de
    // los otros menús, que lo tapan al 75 %, con muy pocos y el navegador lo estira suavizado)
    var menu = !jugando || I.pantalla === 'cargando';
    var dp = Math.min(window.devicePixelRatio || 1, debil ? 1.5 : 2);
    var base = menu ? (I.pantalla === 'titulo' ? Math.min(dp, 1.5) * (debil ? 0.6 : 0.85) : 0.25) : dp * (opciones.resolucion || escalaAuto);
    var w = Math.max(1, Math.round(lienzo.clientWidth * base)), h = Math.max(1, Math.round(lienzo.clientHeight * base));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
  }

  async function arrancar() {
    // primero la fuente (pesa poco) para mostrar la carga
    var chicas = ['fuente', 'gui', 'iconos', 'ui', 'icono', 'spawn_egg', 'spawn_egg_overlay'];
    var lista = await Promise.all(chicas.map(function (n) { return cargarImagen('datos/' + n + '.png'); }));
    chicas.forEach(function (n, i) { imgs[n] = lista[i]; });
    I.iniciar(hud, imgs, {});
    I.cargandoTexto = '…'; I.cargandoParte = 0.05;
    I.ir('cargando');
    requestAnimationFrame(cuadro);

    datos = await (await fetch('datos/datos.json')).json();
    I.ponerUI({}, datos.ui);
    ponerIdioma(opciones.idioma || 'es');
    I.cargandoTexto = I.tp('cargando'); I.cargandoParte = 0.15; I.sucio();
    var sonido = fetch('datos/sonidos.ogg').then(function (r) { return r.arrayBuffer(); });
    imgs.terreno = await cargarImagen('datos/terreno.webp');
    I.cargandoParte = 0.5; I.sucio();
    imgs.logo = await cargarImagen('datos/logo.webp');
    var otras = ['sol', 'luna', 'nubes'];
    for (var i = 0; i < otras.length; i++) imgs[otras[i]] = await cargarImagen('datos/' + otras[i] + '.png');
    imgs.grietas = [];
    for (i = 0; i < 10; i++) imgs.grietas.push(await cargarImagen('datos/grieta' + i + '.png'));
    var pano = [];
    for (i = 0; i < 6; i++) pano.push(await cargarImagen('datos/panorama' + i + '.jpg'));
    // las texturas de los bichos y los jugadores
    imgs.bichos = {};
    var texB = {};
    for (var nb in datos.bichos) datos.bichos[nb].forEach(function (c) { texB[c.tex] = 1; });
    var nombresB = Object.keys(texB), imB = await Promise.all(nombresB.map(function (n) { return cargarImagen('datos/' + n); }));
    nombresB.forEach(function (n, k) { imgs.bichos[n] = imB[k]; });
    I.cargandoParte = 0.8; I.sucio();

    C.armarBloques(datos.bloques);
    O.prepararMateriales();
    Modelos.preparar(datos.bichos);
    ajustarTamano();
    // los shaders de Tito se compilan recién cuando se eligen (en un teléfono flojo tardan)
    Render.iniciar(lienzo, datos, imgs, { shaders: opciones.shaders === true, sofisticados: opciones.sofisticados });
    Render.panorama(pano);
    if (/Mali-(4|T6|T7)|Adreno \(TM\) [1-4]\d\d|PowerVR (SGX|Rogue G)|Vivante|VideoCore|GC\d{3,4}/i.test(GL.gpu || '')) debil = true;
    if (debil) escalaAuto = 0.6;
    var creativo = O.creativo();
    I.prepararIconos(creativo, datos);
    I.ponerInventario(creativo);
    urlTrabajador = URL.createObjectURL(new Blob([FUENTE_TRABAJADOR], { type: 'text/javascript' }));
    I.cargandoParte = 0.9; I.sucio();
    await BD.abrir();
    await refrescarMundos();
    sonido.then(function (b) { return Sonido.iniciar(b, datos.sonidos); }).then(function () { aplicarOpciones(); }).catch(function () { /* sin sonido */ });
    aplicarOpciones();
    I.cargandoParte = undefined;
    // la biblioteca de la red se baja de fondo (si no hay red, no pasa nada)
    Red.precargar();
    // la primera vez: el idioma y después con o sin shaders (sobre el menú)
    irAlTitulo();
    window.prueba = { cam: cam, mundo: mundo, render: Render, jugador: J, partida: function () { return partida; }, abrir: abrirMundo, crear: crearMundo,
      cuenta: cuenta, bichos: B, red: Red, publico: entrarPublico,
      rayo: function (fx, fy) { return tocarBloque(fx, fy, false); }, ms: function () { return msCuadro; },
      diag: null, pedirDiag: function () { if (trab) trab.postMessage({ t: 'diag' }); }, listo: true };
  }
  function irAlTitulo() {
    if (!opciones.idioma) { I.ir('idioma'); return; }
    if (opciones.shaders === null) { I.ir('shaders'); return; }
    var f = datos.frases || [];
    I.frase = f.length ? f[Math.floor(Math.random() * f.length)] : '';
    I.ir('titulo');
  }

  function refrescarMundos() {
    return BD.mundos().then(function (l) {
      l.sort(function (a, b) { return (b.jugado || 0) - (a.jugado || 0); });
      I.mundos = l;
      I.servidores = servidores().map(function (s) {
        return { nombre: s.nombre, desc: I.f(I.tp('servidor.sala'), s.direccion), icono: 'servers', jugadores: null, direccion: s.direccion };
      });
      I.publicos = PUBLICOS.map(function (p, i) {
        return { nombre: I.f(I.tp('publico'), i + 1), corto: I.f(I.tp('publico.corto'), i + 1), desc: I.tp(p.desc), icono: i === 2 ? 'World' : 'worldsIcon',
          jugadores: null, sala: p.sala };
      });
      I.sucio();
    });
  }
  // cuántos hay jugando en cada mundo público (mientras se mira la lista)
  function mirarPublicos() {
    Red.mirarSalas(PUBLICOS.map(function (p) { return p.sala; }), function (fallo) {
      I.publicos.forEach(function (s) { s.jugadores = Red.jugadoresEn(s.sala); s.fuera = !!fallo; if (s.jugadores) s.desc = I.f(I.tp('jugando'), s.jugadores); });
      I.sucio();
    });
  }

  // ------------------------------------------------------------------------------------------
  // Abrir, crear, guardar y cerrar un mundo
  // ------------------------------------------------------------------------------------------
  function semillaDe(t) {
    t = (t || '').trim();
    if (!t) return (Math.random() * 0x7fffffff) | 0;
    if (/^-?\d+$/.test(t)) return parseInt(t, 10) | 0;
    // como Minecraft: el hashCode de Java del texto
    var h = 0;
    for (var i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
    return h;
  }
  function crearMundo(n) {
    n = n || I.nuevo;
    var m = {
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      nombre: (n.nombre || I.t('createWorldScreen.defaultName', 'My World')).slice(0, 32),
      semilla: typeof n.semilla === 'number' ? n.semilla : semillaDe(n.semilla), creativo: true, creado: Date.now(), jugado: Date.now(),
      tiempo: 1000, jugador: null, barra: O.barraInicial(), elegido: 0, tipo: n.tipo === 'plano' ? 'plano' : 'infinito',
      siempreDia: !!n.siempreDia, bichos: n.bichos !== false, local: true
    };
    return BD.guardarMundo(m).then(function () { return abrirMundo(m); });
  }
  // un mundo público o un servidor: el mismo mundo para todos (la semilla sale de la sala), sin
  // guardar trozos acá (lo construido queda en el broker)
  function entrarPublico(i) {
    var p = PUBLICOS[i];
    abrirMundo({ id: 'srv_' + p.sala, nombre: I.f(I.tp('publico'), i + 1), semilla: p.semilla, tipo: p.tipo, creativo: true, local: false,
      sala: p.sala, barra: O.barraInicial(), elegido: 0, bichos: true, jugador: null });
  }
  function salaDe(direccion) {
    var s = String(direccion || '').toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').slice(0, 40);
    return 'sala_' + (s || 'mundo');
  }
  function entrarServidor(s) {
    abrirMundo({ id: 'srv_' + salaDe(s.direccion), nombre: s.nombre, semilla: semillaDe(s.direccion), tipo: 'infinito', creativo: true, local: false,
      sala: salaDe(s.direccion), barra: O.barraInicial(), elegido: 0, bichos: true, jugador: null });
  }

  var columnas = new Set(), esperandoSuelo = false, entrando = 0, ultimoCentro = [0, 0, 0], aparicion = [0, 80, 0];
  var vida = 20, caida = 0, invulnerable = 0, muerto = false;
  function abrirMundo(m) {
    Red.dejarDeMirar();
    I.cargandoTexto = I.t('progressScreen.generating', I.tp('cargando')); I.cargandoParte = 0;
    I.ir('cargando');
    I.soltarTodo();
    var guardadosP = m.local ? BD.trozos(m.id) : Promise.resolve([]);
    return guardadosP.then(function (regs) {
      return Promise.all(regs.map(function (r) {
        return descomprimir(r.d, r.z).then(function (u) {
          var n = u.length >> 1;
          return { cx: r.cx, cz: r.cz, ids: u.slice(0, n), meta: u.slice(n) };
        });
      }));
    }).then(function (guardados) {
      if (trab) trab.terminate();
      Render.reiniciar();
      columnas.clear();
      B.limpiar();
      trab = new Worker(urlTrabajador);
      Mundo.iniciar(trab);
      trab.onmessage = alMensaje;
      trab.onerror = function (e) { console.error('trabajador: ' + (e.message || e)); };
      if (guardados.length) {
        var tr = [];
        guardados.forEach(function (g) { tr.push(g.ids.buffer, g.meta.buffer); });
        trab.postMessage({ t: 'guardados', lista: guardados }, tr);
      }
      partida = m;
      J.creativo = m.creativo;
      J.vx = J.vy = J.vz = 0;
      var lugar = m.tipo === 'plano' ? [0, 3, 0] : lugarDeAparicion(m.semilla);
      aparicion = [lugar[0] + 0.5, lugar[1] + 1, lugar[2] + 0.5];
      var p = m.jugador;
      if (p) {
        J.ubicar(p.x, p.y, p.z); J.yaw = p.yaw; J.pitch = p.pitch; J.volando = !!p.volando && m.creativo;
        esperandoSuelo = false;
      } else {
        J.ubicar(aparicion[0], aparicion[1], aparicion[2]); J.yaw = 0; J.pitch = 0; J.volando = false;
        esperandoSuelo = true;
      }
      I.juego.barra = (m.barra || O.barraInicial()).slice(0, 9);
      I.juego.elegido = m.elegido || 0;
      I.juego.creativo = m.creativo; I.juego.volando = J.volando;
      I.juego.chat = []; I.juego.nombres = [];
      vida = 20; caida = 0; muerto = false; invulnerable = 0;
      I.juego.vida = vida;
      // un servidor: la red (si no anda, se juega igual, solo), la vida y los bichos compartidos
      B.activo = m.bichos !== false;
      B.conVida = !m.local;
      I.juego.conVida = !m.local;
      if (!m.local) {
        Red.reiniciarCambios();
        I.juego.red = { estado: 'conectando', texto: I.tp('red.conectando') };
        Red.entrar(m.sala, ganchosRed);
      } else {
        I.juego.red = null;
        B.cargar(m.bichos_lista);
      }
      ultimoCentro = [Math.floor(J.x / 16), Math.floor(J.z / 16), Math.floor((J.y + 1.62) / 16)];
      trab.postMessage({ t: 'ini', bloques: datos.bloques, uv: datos.atlas.uv, semilla: m.semilla, dist: opciones.dist, tipo: m.tipo,
        suave: opciones.suave, hojas: opciones.hojas, cx: ultimoCentro[0], cz: ultimoCentro[1], sy: ultimoCentro[2] });
      J.camara(1, cam);
      jugando = true;
      estabaPausado = false;
      entrando = performance.now();
      acum = 0;
    });
  }
  // donde aparece un jugador nuevo: cerca del 0,0, en tierra (no en el mar), buscando en espiral con el
  // mismo generador del trabajador (es una función pura de la semilla)
  var ABIERTOS = { 1: 1, 2: 1, 8: 1, 13: 1, 14: 1, 15: 1 };   // llanura, desierto, playa, sabana, mesa, llanura helada
  function lugarDeAparicion(semilla) {
    var g = new Gen(semilla), col = {}, cualquiera = null;
    for (var r = 0; r < 48; r++) {
      for (var k = 0; k < Math.max(1, r * 6); k++) {
        var a = k / Math.max(1, r * 6) * Math.PI * 2, x = Math.round(Math.cos(a) * r * 8), z = Math.round(Math.sin(a) * r * 8);
        g.columna(x, z, col);
        if (col.alt <= C.MAR + 1 || col.alt >= 100) continue;
        // mejor en un lugar abierto (en la selva se aparece arriba de los árboles)
        if (ABIERTOS[col.bioma]) return [x, col.alt, z];
        if (!cualquiera) cualquiera = [x, col.alt, z];
      }
    }
    return cualquiera || [0, 100, 0];
  }

  function alMensaje(e) {
    var d = e.data;
    if (d.t === 'luz') { if (d.v >= 0) Render.luzJugador = d.v; return; }
    if (d.t === 'luces') { lucesRecibidas(d); return; }
    if (d.t === 'diag') { window.prueba.diag = d; return; }
    if (d.t === 'malla') { Render.malla(d); columnas.add(d.cx + ',' + d.cz); }
    else if (d.t === 'trozo') Mundo.recibir(d);
    else if (d.t === 'bloques') Mundo.aplicar(d.lista);
    else if (d.t === 'fuera') { Render.quitar(d.cx, d.cz); Mundo.quitar(d.cx, d.cz); }
  }

  // la carga del mundo termina cuando están las mallas de los trozos de alrededor del jugador
  function listoParaEntrar() {
    var cx = Math.floor(J.x / 16), cz = Math.floor(J.z / 16), n = 0, total = 0;
    for (var dz = -2; dz <= 2; dz++) for (var dx = -2; dx <= 2; dx++) { total++; if (columnas.has((cx + dx) + ',' + (cz + dz))) n++; }
    I.cargandoParte = n / total; I.sucio();
    return n === total || performance.now() - entrando > 15000;
  }

  var guardandoAhora = null;
  function guardar() {
    if (!partida || !partida.local) return Promise.resolve();
    if (guardandoAhora) return guardandoAhora.then(guardar);
    var m = partida;
    m.jugador = { x: J.x, y: J.y, z: J.z, yaw: J.yaw, pitch: J.pitch, volando: J.volando };
    m.barra = I.juego.barra.slice(); m.elegido = I.juego.elegido; m.jugado = Date.now();
    m.bichos_lista = B.paraGuardar();
    var claves = Array.from(Mundo.sucios);
    Mundo.sucios.clear();
    var regs = claves.map(function (k) {
      var t = Mundo.modificados.get(k), u = new Uint8Array(t.ids.length * 2);
      u.set(t.ids); u.set(t.meta, t.ids.length);
      return { k: m.id + '|' + k, mundo: m.id, cx: t.cx, cz: t.cz, u: u };
    });
    guardandoAhora = Promise.all(regs.map(function (r) {
      return comprimir(r.u).then(function (c) { return { k: r.k, mundo: r.mundo, cx: r.cx, cz: r.cz, d: c, z: c !== r.u }; });
    })).then(BD.guardarTrozos).then(function () { return BD.guardarMundo(m); }).catch(function (e) {
      console.error('guardar: ' + (e && e.message || e));
      claves.forEach(function (k) { Mundo.sucios.add(k); });
    }).then(function () { guardandoAhora = null; });
    return guardandoAhora;
  }
  function cerrarMundo() {
    return guardar().then(function () {
      jugando = false;
      if (partida && !partida.local) Red.salir();
      partida = null;
      I.juego.red = null;
      B.limpiar();
      if (trab) { trab.terminate(); trab = null; }
      Render.reiniciar();
      Mundo.iniciar(null);
      if (document.pointerLockElement) document.exitPointerLock();
      return refrescarMundos();
    });
  }
  setInterval(function () { if (jugando && I.pantalla !== 'cargando') guardar(); }, 45000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && jugando) {
      guardar();
      if (I.pantalla === 'juego') { I.soltarTodo(); I.ir('pausa'); }
    }
  });
  addEventListener('pagehide', function () { if (jugando) guardar(); if (partida && !partida.local) Red.salir(); });

  // ------------------------------------------------------------------------------------------
  // La red: lo que llega de los demás
  // ------------------------------------------------------------------------------------------
  var ganchosRed = {
    estado: function (e) {
      if (!I.juego.red) return;
      var antes = I.juego.red.estado;
      I.juego.red.estado = e;
      I.juego.red.texto = e === 'enlinea' ? I.tp('red.enlinea') : e === 'conectando' ? I.tp('red.conectando') : I.tp('red.desconectado');
      if (e === 'enlinea' && antes !== 'enlinea') avisar(I.tp('red.volvio'));
      if (e === 'desconectado' && antes === 'conectando') avisar(I.tp('red.solo'));
      I.sucio();
    },
    entra: function (j) { chat(I.f(I.t('multiplayer.player.joined', '%s joined the game'), j.name), '#ffff55'); },
    sale: function (j) { chat(I.f(I.t('multiplayer.player.left', '%s left the game'), j.name), '#ffff55'); B.quitarDe(j.id); },
    bloque: function (x, y, z, id, m) { ponerRemoto(x, y, z, id, m); },
    golpe: function (dano, quien, emp) { recibirDano(dano, quien, emp); },
    chat: function (n, s) { chat(I.f(I.t('chat.type.text', '<%s> %s'), n, s)); },
    trozo: function (cx, cz, l) {
      // lo construido que estaba guardado en el broker: ya, si el trozo está; si no, al generarlo
      var t = Mundo.trozo(cx, cz);
      if (t) { for (var k = 0; k < l.length; k += 3) ponerRemoto(cx * 16 + (l[k] & 15), l[k] >> 8, cz * 16 + ((l[k] >> 4) & 15), l[k + 1], l[k + 2]); }
      else if (trab) trab.postMessage({ t: 'parches', lista: [{ cx: cx, cz: cz, d: l }] });
    },
    bichos: function (dueno, l) { B.desdeRed(dueno, l); },
    golpeBicho: function (mid, dano, kx, kz) { var e = B.propioPorId(mid); if (e) B.golpe(e, dano, kx, kz); },
    muerte: function (n, por) { chat(por ? I.f(I.t('death.attack.player', '%1$s was slain by %2$s'), n, por) : I.f(I.t('death.attack.generic', '%1$s died'), n), '#ff8080'); },
    explosion: function () { }
  };
  function ponerRemoto(x, y, z, id, m) {
    var cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    if (Mundo.trozo(cx, cz)) {
      if (Mundo.bloque(x, y, z) !== id || Mundo.meta(x, y, z) !== m) Mundo.poner(x, y, z, id, m);
    } else if (trab) trab.postMessage({ t: 'parches', lista: [{ cx: cx, cz: cz, d: [(y << 8) | ((z & 15) << 4) | (x & 15), id, m] }] });
  }
  // un cambio propio: al mundo y, en un servidor, a los demás
  function ponerBloque(x, y, z, id, m) {
    if (!Mundo.poner(x, y, z, id, m)) return false;
    if (partida && !partida.local) Red.bloque(x, y, z, id, m | 0);
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // La vida (en los servidores): golpes de otros jugadores y de los monstruos, caídas, la lava
  // ------------------------------------------------------------------------------------------
  var ultimoAtacante = '';
  function recibirDano(dano, quien, emp) {
    if (!I.juego.conVida || muerto || invulnerable > 0 || dano <= 0) return;
    invulnerable = 10;
    vida = Math.max(0, vida - dano);
    I.juego.vida = vida; I.juego.dano = 1; I.juego.parpadeoHasta = performance.now() + 500;
    if (emp) { J.vx += emp[0]; J.vz += emp[1]; J.vy = Math.max(J.vy, 0.36); }
    if (quien) ultimoAtacante = quien;
    Sonido.tocar('game.player.hurt', 1, 0.9 + Math.random() * 0.2);
    if (vida <= 0) morir();
    I.sucio();
  }
  function morir() {
    muerto = true;
    I.soltarTodo();
    I.muerte.texto = ultimoAtacante ? I.f(I.t('death.attack.player', '%1$s was slain by %2$s'), opciones.nombre, ultimoAtacante)
      : I.f(I.t('death.attack.generic', '%1$s died'), opciones.nombre);
    Red.accion({ type: 'muerte', name: opciones.nombre, byName: ultimoAtacante });
    chat(I.muerte.texto, '#ff8080');
    Sonido.tocar('game.player.die', 1, 1);
    I.ir('muerte');
  }
  function reaparecer() {
    muerto = false; vida = 20; I.juego.vida = 20; ultimoAtacante = '';
    J.ubicar(aparicion[0], aparicion[1], aparicion[2]);
    esperandoSuelo = true;
    I.ir('juego');
  }

  // ------------------------------------------------------------------------------------------
  // Tocar el mundo: el rayo desde el punto tocado, pegar, poner, usar y romper
  // ------------------------------------------------------------------------------------------
  function rayoDesde(fx, fy) {
    var asp = lienzo.width / lienzo.height, th = Math.tan(cam.fov / 2);
    var x = (fx * 2 - 1) * th * asp, y = (1 - fy * 2) * th;
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    // adelante, derecha y arriba de la cámara (las filas de la matriz de vista)
    var dx = sy * cp + cy * x + sp * sy * y, dy = -sp + cp * y, dz = -cy * cp + sy * x - sp * cy * y;
    var l = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return [dx / l, dy / l, dz / l];
  }
  function alcance() { return partida && partida.creativo ? 6 : 5; }
  function tocarBloque(fx, fy, conLiquidos) {
    var d = rayoDesde(fx, fy), h = Mundo.rayo(cam.x, cam.y, cam.z, d[0], d[1], d[2], alcance(), conLiquidos);
    if (h) h.d = d;
    return h;
  }
  function sonar(s, x, y, z) { if (s) Sonido.tocar(s[0], s[1], s[2], x + 0.5, y + 0.5, z + 0.5); }

  // ¿hay un bicho o un jugador antes que el bloque? (y le pega)
  function pegar(fx, fy) {
    var d = rayoDesde(fx, fy), h = Mundo.rayo(cam.x, cam.y, cam.z, d[0], d[1], d[2], 4, false), tb = h ? h.t : 1e9;
    var mejor = B.rayo(cam.x, cam.y, cam.z, d[0], d[1], d[2], Math.min(4, tb)), jug = null, tj = 1e9;
    if (partida && !partida.local) {
      Red.remotos.forEach(function (j) {
        var t = B.cajaRayo(cam.x, cam.y, cam.z, d[0], d[1], d[2], j.x - 0.4, j.y, j.z - 0.4, j.x + 0.4, j.y + 1.9, j.z + 0.4);
        if (t !== null && t < tj && t < Math.min(4, tb)) { tj = t; jug = j; }
      });
    }
    var kx = Math.sin(J.yaw) * 0.4, kz = -Math.cos(J.yaw) * 0.4;
    if (jug && (!mejor || tj < mejor.t)) {
      Red.golpear(jug.id, 2, kx, kz);
      golpe(); golpeRed = true;
      return true;
    }
    if (mejor) {
      if (mejor.remoto) Red.golpearBicho(mejor.e.dueno, mejor.e.mid, 3, kx, kz);
      else B.golpe(mejor.e, 3, kx, kz);
      golpe(); golpeRed = true;
      return true;
    }
    return false;
  }

  function usar(h) {
    var id = h.id, f = C.FORMA[id];
    if (f === C.F.puerta && id !== 71) {
      var abajo = Mundo.meta(h.x, h.y, h.z) & 8 ? h.y - 1 : h.y, m = Mundo.meta(h.x, abajo, h.z);
      ponerBloque(h.x, abajo, h.z, id, m ^ 4);
      Sonido.tocar((m & 4) ? 'random.door_close' : 'random.door_open', 1, 0.9 + Math.random() * 0.1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      return true;
    }
    if (id === 96) {
      var mt = Mundo.meta(h.x, h.y, h.z);
      ponerBloque(h.x, h.y, h.z, id, mt ^ 4);
      Sonido.tocar((mt & 4) ? 'random.door_close' : 'random.door_open', 1, 0.9 + Math.random() * 0.1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      return true;
    }
    return false;
  }

  function poner(fx, fy) {
    if (pegar(fx, fy)) return;
    var it = I.juego.barra[I.juego.elegido];
    var h = tocarBloque(fx, fy, it && it.id === 111);
    if (!h) return;
    if (!J.agachado && usar(h)) return;
    if (!it) return;
    // un huevo: el bicho aparece arriba de la cara tocada
    var bicho = O.bichoDe(it);
    if (bicho) {
      var e = B.crear(bicho, h.x + h.nx + 0.5, h.y + h.ny, h.z + h.nz + 0.5);
      if (e) { e.yaw = J.yaw + Math.PI; golpe(); }
      return;
    }
    var id = it.id, m = it.m;
    if (id === 111 && !(h.id === 9 || h.id === 8)) return;
    // dónde tocó en la cara (para losas y escaleras: mitad de arriba o de abajo)
    var py = cam.y + h.d[1] * h.t, fyCara = Math.min(1, Math.max(0, py - h.y));
    // una losa sobre otra igual: la doble
    var doble = O.losaDoble[id];
    if (doble && h.id === id) {
      var mh = Mundo.meta(h.x, h.y, h.z);
      if ((mh & 7) === (m & 7) && ((h.ny === 1 && !(mh & 8)) || (h.ny === -1 && (mh & 8)))) {
        ponerBloque(h.x, h.y, h.z, doble, m & 7);
        sonar(O.sonidoPoner(id), h.x, h.y, h.z);
        return;
      }
    }
    var tx = h.x + h.nx, ty = h.y + h.ny, tz = h.z + h.nz, nx = h.nx, ny = h.ny, nz = h.nz;
    // lo que se reemplaza (pasto alto, nieve fina) recibe el bloque en su lugar
    if (h.id === 31 || h.id === 78 || h.id === 32) { tx = h.x; ty = h.y; tz = h.z; nx = 0; ny = 1; nz = 0; fyCara = 0; }
    var celdas = O.alPoner(id, m, nx, ny, nz, fyCara, J.yaw);
    if (!celdas) return;
    for (var i = 0; i < celdas.length; i++) {
      var c = celdas[i], x = tx + c[0], y = ty + c[1], z = tz + c[2], b = Mundo.bloque(x, y, z);
      if (y < 0 || y >= C.ALTO || b < 0 || !O.reemplazable(b)) return;
      if (C.SOLIDO[c[3]] && J.ocupa(x, y, z)) return;
    }
    if (O.necesitaSuelo(id) && !O.sueloBueno(id, Mundo.bloque(tx, ty - 1, tz))) return;
    for (i = 0; i < celdas.length; i++) {
      c = celdas[i];
      ponerBloque(tx + c[0], ty + c[1], tz + c[2], c[3], c[4]);
    }
    sonar(O.sonidoPoner(id), tx, ty, tz);
    golpe();
    cuenta.puestos++;
  }

  function romper(h) {
    var id = h.id, m = Mundo.meta(h.x, h.y, h.z);
    ponerBloque(h.x, h.y, h.z, 0, 0);
    // las cosas de dos bloques se van enteras
    if (C.FORMA[id] === C.F.puerta || id === 175) {
      var otro = (m & 8) ? h.y - 1 : h.y + 1;
      if (Mundo.bloque(h.x, otro, h.z) === id) ponerBloque(h.x, otro, h.z, 0, 0);
    }
    // lo que estaba apoyado arriba (plantas, antorchas paradas, nieve fina, puertas) se cae
    var a = Mundo.bloque(h.x, h.y + 1, h.z);
    if (a > 0) {
      var ma = Mundo.meta(h.x, h.y + 1, h.z);
      if (O.necesitaSuelo(a) || (C.FORMA[a] === C.F.antorcha && (ma === 5 || ma === 0)) || a === 78 || a === 171 ||
          (C.FORMA[a] === C.F.puerta && !(ma & 8)) || C.FORMA[a] === C.F.riel) {
        ponerBloque(h.x, h.y + 1, h.z, 0, 0);
        if (C.FORMA[a] === C.F.puerta || a === 175) ponerBloque(h.x, h.y + 2, h.z, 0, 0);
      }
    }
    sonar(O.sonidoRomper(id), h.x, h.y, h.z);
    if (opciones.particulas) Render.romper(h.x, h.y, h.z, id, m);
    if (opciones.vibrar && navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* nada */ } }
    golpe();
    cuenta.rotos++;
  }

  // romper en creativo: al instante y, con el dedo quieto, uno cada 0,25 s (como el juego)
  var proximoRomper = 0, hayObjetivo = false, proximoPegar = 0;
  // el anillo del dedo: se llena en los 0,3 s de mantener (aparece pasados 0,12 para no molestar en
  // los toques) y, rompiendo, se vuelve a llenar en los 0,25 s hasta el bloque siguiente
  function anillo(t) {
    var d = I.pantalla === 'juego' ? I.dedoMundo() : null, a = null;
    if (d) {
      if (!d.rompiendo) { var q = t - d.t0; if (q > 120) a = { x: d.x, y: d.y, p: q / 300 }; }
      else if (hayObjetivo) a = { x: d.x, y: d.y, p: proximoRomper ? 1 - Math.max(0, proximoRomper - t) / 250 : 0 };
    }
    var antes = I.juego.anillo;
    I.juego.anillo = a;
    if (!a !== !antes) I.sucio();
  }
  function interactuar(ahora) {
    var c = I.control;
    if (c.toque) {
      var t = c.toque; c.toque = null;
      if (I.pantalla === 'juego') poner(t[0], t[1]);
    }
    mundo.apuntado = null; mundo.rompiendo = 0; hayObjetivo = false;
    if (c.rompiendo && I.pantalla === 'juego') {
      // manteniendo sobre un bicho o un jugador: le pega cada medio segundo
      if (ahora >= proximoPegar && pegar(c.rompiendo[0], c.rompiendo[1])) { proximoPegar = ahora + 500; return; }
      var h = tocarBloque(c.rompiendo[0], c.rompiendo[1], false);
      if (h) {
        hayObjetivo = true;
        mundo.apuntado = h;
        if (ahora >= proximoRomper) { romper(h); proximoRomper = ahora + 250; mundo.apuntado = null; }
      }
    } else {
      proximoRomper = 0;
      // con mouse: el contorno del bloque de la mira
      if (I.conMouse && I.pantalla === 'juego') mundo.apuntado = tocarBloque(0.5, 0.5, false);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Los bichos: sonidos, golpes, explosiones, la luz y aparecer
  // ------------------------------------------------------------------------------------------
  B.sonido = function (ev, e, vol) { Sonido.tocar(ev, vol, 0.8 + Math.random() * 0.4, e.x, e.y + 0.5, e.z); };
  B.alMorir = function (e) { if (opciones.particulas) Render.romper(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z), 80, 0); };
  B.golpear = function (obj, dano, e) {
    var dx = obj.x - e.x, dz = obj.z - e.z, l = Math.sqrt(dx * dx + dz * dz) || 1, kx = dx / l * 0.4, kz = dz / l * 0.4;
    var nombre = O.nombreBicho ? O.nombreBicho(e.tipo) : I.t('entity.' + e.tipo + '.name', e.tipo);
    if (obj.id) Red.accion({ type: 'hit_player', targetId: obj.id, dmg: dano, byName: nombre, kx: +kx.toFixed(3), kz: +kz.toFixed(3) });
    else recibirDano(dano, nombre, [kx, kz]);
  };
  B.explosion = function (x, y, z, r, jug) {
    Sonido.tocar('random.explode', 1, 0.9 + Math.random() * 0.2, x, y, z);
    for (var k = 0; k < jug.length; k++) {
      var j = jug[k], d = Math.sqrt((j.x - x) * (j.x - x) + (j.y + 1 - y) * (j.y + 1 - y) + (j.z - z) * (j.z - z));
      if (d < r * 2) {
        var dano = Math.round((1 - d / (r * 2)) * 16), dx = (j.x - x) / (d || 1), dz = (j.z - z) / (d || 1);
        if (j.id) Red.accion({ type: 'hit_player', targetId: j.id, dmg: dano, byName: I.t('entity.creeper.name', 'Creeper'), kx: dx, kz: dz });
        else recibirDano(dano, I.t('entity.creeper.name', 'Creeper'), [dx, dz]);
      }
    }
    // el pozo de la explosión (como el juego, menos la roca madre y la obsidiana); en un servidor,
    // todos los bloques en un solo mensaje
    var rotos = [];
    for (var bx = -r; bx <= r; bx++) for (var by = -r; by <= r; by++) for (var bz = -r; bz <= r; bz++) {
      if (bx * bx + by * by + bz * bz > r * r + 0.5) continue;
      var X = Math.floor(x) + bx, Y = Math.floor(y) + by, Z = Math.floor(z) + bz, b = Mundo.bloque(X, Y, Z);
      if (b <= 0 || b === 7 || b === 49 || b === 8 || b === 9 || b === 10 || b === 11) continue;
      if (Mundo.poner(X, Y, Z, 0, 0)) rotos.push(X, Y, Z, 0, 0);
      if (opciones.particulas && Math.random() < 0.3) Render.romper(X, Y, Z, b, 0);
    }
    if (partida && !partida.local) Red.bloques(rotos);
  };
  var pedidoLuces = 0, esperaLuces = null;
  function pedirLuces() {
    if (!trab || esperaLuces) return;
    var dia = luzDelDia();
    var cands = B.candidatos({ x: J.x, y: J.y, z: J.z }, dia, 1 + Red.remotos.size);
    var p = B.posiciones(), jugs = [];
    Red.remotos.forEach(function (j) { jugs.push(j); p.push(Math.floor(j.x), Math.floor(j.y + 1), Math.floor(j.z)); });
    var nb = p.length / 3 - jugs.length;
    cands.forEach(function (c) { p.push(c.x, c.y, c.z); });
    esperaLuces = { nb: nb, jugs: jugs, cands: cands.length, id: ++pedidoLuces };
    trab.postMessage({ t: 'luces', p: p, pedido: pedidoLuces });
  }
  function lucesRecibidas(d) {
    var e = esperaLuces;
    esperaLuces = null;
    if (!e || d.pedido !== e.id) return;
    B.ponerLuces(d.v.slice(0, e.nb));
    e.jugs.forEach(function (j, i) { var v = d.v[e.nb + i]; if (v >= 0) j.luz = v; });
    if (partida && B.activo) B.aparecer(d.v.slice(e.nb + e.jugs.length), luzDelDia());
  }
  // qué tan de día es (0 de noche, 1 de día; como el brillo del cielo del juego)
  function luzDelDia() {
    var t = ((mundo.tiempo % 24000) + 24000) % 24000, f = Math.cos((Render.anguloSol(t)) * Math.PI * 2) * 2 + 0.5;
    return Math.max(0, Math.min(1, f));
  }

  // ------------------------------------------------------------------------------------------
  // Los pasos de física (20 por segundo)
  // ------------------------------------------------------------------------------------------
  var proximoPaso = 0, antesEnAgua = false, corriendoTactil = false, adelanteAntes = false, ultimoAdelante = 0;
  var caminadoAntes = 0, pasosLuz = 0, golpeDesde = -1, equipo = 1, itemAntes = '', bamboleo = 0, golpeRed = false;
  var estadoMano = { item: null, golpe: 0, equipo: 1, bamboleo: [0, 0] };
  function golpe() { golpeDesde = performance.now(); }
  var cuenta = { puestos: 0, rotos: 0, saltos: 0 };
  function paso() {
    var c = I.control, e = J.entrada, activo = I.pantalla === 'juego';
    e.adelante = activo ? c.adelante : 0;
    e.costado = activo ? c.costado : 0;
    e.saltar = activo && c.saltar;
    e.subir = activo && c.subir;
    e.bajar = activo && c.bajar;
    J.agachado = activo && c.agachar && !J.volando;
    J.corriendo = activo && (c.correr || corriendoTactil) && e.adelante > 0 && !J.agachado;
    var antesY = J.y, antesPiso = J.enPiso;
    caminadoAntes = J.caminado;
    if (!muerto) J.paso();
    Render.pasoParticulas();
    if (trab && ++pasosLuz % 5 === 0) trab.postMessage({ t: 'luz', x: Math.floor(cam.x), y: Math.floor(cam.y), z: Math.floor(cam.z) });
    if (partida) {
      if (!partida.local) partida.tiempo = (Date.now() / 50) % 24000;      // en los servidores, la misma hora para todos
      else if (partida.siempreDia) partida.tiempo = 6000; else partida.tiempo += 1;
    }
    if (I.juego.volando !== J.volando) { I.juego.volando = J.volando; I.sucio(); }
    // las caídas (en los servidores, donde hay vida)
    if (I.juego.conVida && !muerto) {
      if (!J.enPiso && !J.volando && !J.enAgua && J.y < antesY) caida += antesY - J.y;
      if (J.enAgua || J.volando) caida = 0;
      if (J.enPiso && !antesPiso) { if (caida > 3.2) recibirDano(Math.floor(caida - 3), '', null); caida = 0; }
      var pies = Mundo.bloque(Math.floor(J.x), Math.floor(J.y + 0.2), Math.floor(J.z));
      if ((pies === 10 || pies === 11) && pasosLuz % 10 === 0) recibirDano(4, '', null);
      if (J.y < 1 && pasosLuz % 10 === 0) recibirDano(4, '', null);
      if (invulnerable > 0) invulnerable--;
    }
    // los pasos suenan cada 1,7 bloques caminados (como el juego), no agachado
    if (J.enPiso && !J.agachado && J.caminado * 0.6 > proximoPaso) {
      proximoPaso = Math.floor(J.caminado * 0.6) + 1;
      var bajo = Mundo.bloque(Math.floor(J.x), Math.floor(J.y - 0.2), Math.floor(J.z));
      if (bajo > 0) { var s = O.sonidoPaso(bajo); if (s) Sonido.tocar(s[0], s[1], s[2]); }
    }
    if (J.enAgua && !antesEnAgua && antesY - J.y > 0.1) Sonido.tocar('random.splash', 0.3, 1 + (Math.random() - Math.random()) * 0.4);
    antesEnAgua = J.enAgua;
    // los bichos
    var jugs = [{ x: J.x, y: J.y, z: J.z, id: null, vivo: !muerto }];
    Red.remotos.forEach(function (j) { jugs.push({ x: j.x, y: j.y, z: j.z, id: j.id, vivo: j.hp > 0 }); });
    B.paso(jugs, luzDelDia());
    if (pasosLuz % 5 === 2) pedirLuces();
    // el trabajador sigue al jugador
    var cx = Math.floor(J.x / 16), cz = Math.floor(J.z / 16), sy = Math.max(0, Math.min(7, Math.floor((J.y + 1.62) / 16)));
    if (cx !== ultimoCentro[0] || cz !== ultimoCentro[1] || sy !== ultimoCentro[2]) {
      ultimoCentro = [cx, cz, sy];
      if (trab) trab.postMessage({ t: 'centro', cx: cx, cz: cz, sy: sy });
    }
  }

  // ------------------------------------------------------------------------------------------
  // El cuadro
  // ------------------------------------------------------------------------------------------
  var ultimo = 0, acum = 0, cuadros = 0, segundo = 0, fovActual = 0, estabaPausado = false, ultimoEstado = 0, ultimoBichos = 0;
  // resolución automática: si no llega a ~45 cuadros por segundo baja los píxeles (hasta la mitad), si
  // sobra la vuelve a subir. Si bajar no mejoró nada (un teléfono que limita a 30 para ahorrar
  // batería), vuelve atrás y deja de probar un rato
  var escalaAuto = 1, ema = 16, ventana = 0, antesDeBajar = 0, intentoFallido = 0;
  function resolucionAuto(dt, ahora) {
    if (opciones.resolucion) return;
    ema += (dt * 1000 - ema) * 0.05;
    ventana += dt;
    if (ventana < 2) return;
    ventana = 0;
    if (antesDeBajar) {
      if (ema > antesDeBajar * 0.92) { escalaAuto = Math.min(1, escalaAuto / 0.85); intentoFallido = ahora; }
      antesDeBajar = 0;
      return;
    }
    // la meta es la velocidad elegida (60 o 30 cuadros): si no llega, menos píxeles
    var meta = 1000 / (opciones.limite || 60);
    if (ema > meta * 1.35 && escalaAuto > 0.35 && ahora - intentoFallido > 30000) { antesDeBajar = ema; escalaAuto = Math.max(0.35, escalaAuto * 0.85); }
    else if (ema < meta * 0.92 && escalaAuto < 1) escalaAuto = Math.min(1, escalaAuto / 0.9);
  }

  // el tope de cuadros por segundo: el navegador llama a cada refresco de la pantalla (90 o 120 por
  // segundo en muchos teléfonos nuevos) y dibujar todos era el doble de trabajo que el juego, que
  // dibuja a 60. Se dibuja cuando llega la hora del cuadro siguiente (con 2 ms de margen)
  var siguiente = 0;
  function cuadro(t) {
    requestAnimationFrame(cuadro);
    var intervalo = 1000 / (opciones.limite || 60);
    if (t < siguiente - 2) return;
    siguiente = Math.max(siguiente + intervalo, t + intervalo - 4);
    t0cuadro = performance.now();
    var dt = Math.min(0.25, Math.max(0, (t - ultimo) / 1000) || 0);
    ultimo = t;
    cuadros++;
    if (t - segundo >= 1000) { I.juego.fps = Math.round(cuadros * 1000 / (t - segundo)); cuadros = 0; segundo = t; }
    if (!Render.listo) { I.dibujar(); return; }
    ajustarTamano();
    if (!jugando) {
      Render.dibujarPanorama(t / 1000 * 0.03, Math.sin(t / 1000 * 0.04) * 0.12 - 0.04);
      I.dibujar();
      return;
    }
    if (I.pantalla === 'cargando') {
      if (esperandoSuelo) buscarSuelo();
      if (!esperandoSuelo && listoParaEntrar()) { I.ir('juego'); acum = 0; }
      else { Render.dibujarPanorama(t / 1000 * 0.03, -0.04); I.dibujar(); return; }
    }
    if (esperandoSuelo) buscarSuelo();
    resolucionAuto(dt, t);
    // mirar: lo arrastrado desde el cuadro anterior (en puntos CSS)
    var c = I.control;
    if (c.mirarX || c.mirarY) {
      var k = (I.conMouse ? 0.0025 : 0.0055) * opciones.sens;
      J.yaw += c.mirarX * k;
      J.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, J.pitch + c.mirarY * k * (opciones.invertirY ? -1 : 1)));
      c.mirarX = c.mirarY = 0;
    }
    if (c.rueda) {
      I.acciones.elegir((I.juego.elegido + (c.rueda > 0 ? 1 : 8)) % 9);
      c.rueda = 0;
    }
    // correr con doble toque adelante
    var adelante = c.adelante > 0;
    if (adelante && !adelanteAntes) { if (t - ultimoAdelante < 300) corriendoTactil = true; ultimoAdelante = t; }
    if (!adelante) corriendoTactil = false;
    adelanteAntes = adelante;
    // los pasos (en un servidor no se para el mundo en pausa: los demás siguen)
    var pausado = (I.pantalla === 'pausa' || I.pantalla === 'opciones' || I.pantalla === 'pregunta') && partida && partida.local;
    if (pausado !== estabaPausado) { estabaPausado = pausado; if (trab) trab.postMessage({ t: 'pausa', v: pausado }); }
    if (!pausado) {
      acum += dt;
      var n = 0;
      while (acum >= PASO && n < 5) { paso(); acum -= PASO; n++; }
      if (n === 5) acum = 0;
    }
    var alfa = pausado ? 1 : acum / PASO;
    J.camara(alfa, cam);
    // el bamboleo al caminar (el de la cámara y la mano, como el juego)
    var andando = J.enPiso && !J.volando && (Math.abs(J.x - J.px) + Math.abs(J.z - J.pz)) > 0.01;
    bamboleo += ((andando && opciones.balanceo ? 1 : 0) - bamboleo) * Math.min(1, dt * 8);
    var fase = (caminadoAntes + (J.caminado - caminadoAntes) * alfa) * 0.6 * Math.PI, ab = bamboleo * 0.06;
    var bx = Math.sin(fase) * ab * 0.5, by = -Math.abs(Math.cos(fase)) * ab;
    cam.x += Math.cos(cam.yaw) * bx; cam.z += Math.sin(cam.yaw) * bx; cam.y += by;
    // el campo de visión se abre un poco al correr (como el juego)
    var fovObj = opciones.fov * Math.PI / 180 * (J.corriendo ? 1.12 : 1);
    fovActual = fovActual ? fovActual + (fovObj - fovActual) * Math.min(1, dt * 10) : fovObj;
    cam.fov = fovActual;
    Sonido.oyente(cam.x, cam.y, cam.z);
    I.revisarToques();
    interactuar(t);
    anillo(t);
    // la red: los otros se mueven de a poco; lo propio sale cada 100 ms (y los bichos cada 250)
    if (partida && !partida.local) {
      Red.paso(dt);
      B.pasoRemotos(dt);
      if (t - ultimoEstado > 100) {
        ultimoEstado = t;
        Red.publicarEstado({ x: J.x, y: J.y, z: J.z, facingAngle: J.yaw, pitch: J.pitch, hp: vida, isMoving: andando || J.volando,
          sneaking: J.agachado, swing: golpeRed, skin: opciones.skin });
        golpeRed = false;
      }
      if (t - ultimoBichos > 250) { ultimoBichos = t; Red.publicarBichos(B.paraRed()); }
      I.juego.jugadores = [opciones.nombre].concat(Array.from(Red.remotos.values()).map(function (j) { return j.name; }));
    }
    if (I.juego.dano > 0) { I.juego.dano = Math.max(0, I.juego.dano - dt * 3); }
    mundo.reloj = t / 1000;
    mundo.tiempo = partida.tiempo + (partida.local && !partida.siempreDia ? alfa : 0);
    var ojo = Mundo.bloque(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z));
    mundo.bajoAgua = ojo === 8 || ojo === 9;
    var tb = TEMPERATURA[Mundo.bioma(Math.floor(cam.x), Math.floor(cam.z))];
    mundo.temperatura = tb === undefined ? 0.8 : tb;
    // lo que se dibuja además del mundo: los bichos y los otros jugadores (con su nombre arriba)
    var ents = B.paraDibujar(alfa), nombres = [];
    if (partida && !partida.local) {
      var tam = I.tam();
      Red.remotos.forEach(function (j) {
        ents.push({ modelo: j.skin === 'alex' ? 'alex' : 'steve', x: j.x, y: j.y, z: j.z, yaw: j.yaw, cabezaYaw: 0, cabezaPitch: j.pitch,
          paso: j.paso, amplitud: j.amplitud, luz: j.luz === undefined ? 0xF0 : j.luz, dano: 0, golpe: j.golpe, agachado: j.agachado, tiempo: t / 50 });
      });
      mundo.entidades = ents;
      Render.dibujar(cam, mundo);
      Red.remotos.forEach(function (j) {
        var d2 = (j.x - cam.x) * (j.x - cam.x) + (j.z - cam.z) * (j.z - cam.z);
        if (d2 > 64 * 64) return;
        var p = Render.proyectar(j.x, j.y + 2.15, j.z, cam);
        if (p && p[0] > -0.1 && p[0] < 1.1 && p[1] > -0.1 && p[1] < 1.1) nombres.push({ t: j.name, x: p[0] * tam[0], y: p[1] * tam[1] });
      });
    } else {
      mundo.entidades = ents;
      Render.dibujar(cam, mundo);
    }
    I.juego.nombres = nombres;
    // la mano: el golpe dura 0,3 s; al cambiar de cosa baja y vuelve a subir
    var it = I.juego.barra[I.juego.elegido], clave = it ? it.id + ':' + it.m : '';
    if (clave !== itemAntes) { itemAntes = clave; equipo = 0; }
    equipo = Math.min(1, equipo + dt * 5);
    var g = golpeDesde < 0 ? 0 : (t - golpeDesde) / 300;
    if (g >= 1) { g = 0; golpeDesde = -1; }
    estadoMano.item = it && !O.esHuevo(it) ? it : null; estadoMano.golpe = g; estadoMano.equipo = equipo;
    estadoMano.bamboleo[0] = Math.sin(fase) * ab * 0.4; estadoMano.bamboleo[1] = -Math.abs(Math.cos(fase)) * ab * 0.6;
    if ((I.pantalla === 'juego' || I.pantalla === 'inventario') && !opciones.ocultarInterfaz) Render.dibujarMano(estadoMano);
    I.dibujar();
    // cuánto tarda la parte de JavaScript de un cuadro (para medir; lo muestra el contador de cuadros)
    msCuadro += (performance.now() - t0cuadro - msCuadro) * 0.05;
  }
  var msCuadro = 0, t0cuadro = 0;

  // un mundo nuevo: el jugador va arriba de lo más alto que haya en su columna (puede ser un árbol)
  function buscarSuelo() {
    var x0 = Math.floor(J.x), z0 = Math.floor(J.z);
    if (!Mundo.cargado(x0, z0)) return;
    function tope(x, z) {
      for (var y = C.ALTO - 1; y > 0; y--) {
        var b = Mundo.bloque(x, y, z);
        if (b < 0) return null;
        if (b > 0 && (C.SOLIDO[b] || b === 8 || b === 9)) return [y, b];
      }
      return null;
    }
    // la columna más cercana cuyo tope no sea un árbol ni agua
    var mejor = null;
    for (var r = 0; r <= 8 && !mejor; r++) for (var dz = -r; dz <= r && !mejor; dz++) for (var dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      var t = tope(x0 + dx, z0 + dz);
      if (t && t[1] !== 18 && t[1] !== 161 && t[1] !== 17 && t[1] !== 162 && t[1] !== 8 && t[1] !== 9) { mejor = [x0 + dx, t[0], z0 + dz]; break; }
    }
    if (!mejor) { var t0 = tope(x0, z0); mejor = [x0, t0 ? t0[0] : 100, z0]; }
    J.ubicar(mejor[0] + 0.5, mejor[1] + 1, mejor[2] + 0.5);
    aparicion = [mejor[0] + 0.5, mejor[1] + 1, mejor[2] + 0.5];
    esperandoSuelo = false;
  }

  // ------------------------------------------------------------------------------------------
  // Las acciones de la interfaz
  // ------------------------------------------------------------------------------------------
  function mostrarNombre() {
    var it = I.juego.barra[I.juego.elegido];
    I.juego.nombreItem = it ? O.nombre(it.id, it.m) : '';
    I.juego.nombreHasta = performance.now() + 1500;
  }
  // un campo de texto de verdad sobre el botón (abre el teclado del teléfono; prompt() no anda dentro
  // de un cuadro de otro sitio)
  function editarTexto(b, valor, listo, max) {
    var d = I.dpr(), inp = document.createElement('input');
    inp.type = 'text'; inp.value = valor || ''; inp.maxLength = max || 32;
    inp.setAttribute('autocomplete', 'off'); inp.setAttribute('autocapitalize', 'off'); inp.spellcheck = false;
    var s = inp.style;
    s.position = 'fixed'; s.left = (b.x / d) + 'px'; s.top = (b.y / d) + 'px'; s.width = (b.w / d) + 'px'; s.height = (b.h / d) + 'px';
    s.boxSizing = 'border-box'; s.zIndex = 10; s.background = '#000'; s.color = '#fff'; s.border = '2px solid #fff';
    s.font = Math.round(b.h / d * 0.45) + 'px monospace'; s.textAlign = 'left'; s.userSelect = 'text'; s.webkitUserSelect = 'text';
    s.outline = 'none'; s.touchAction = 'auto'; s.padding = '0 6px';
    document.body.appendChild(inp);
    inp.focus();
    inp.select();
    var hecho = false, enviar = false;
    function fin() {
      if (hecho) return;
      hecho = true;
      listo(inp.value.trim(), enviar);
      inp.remove();
      I.sucio();
    }
    inp.addEventListener('blur', fin);
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { enviar = true; inp.blur(); } if (e.key === 'Escape') inp.blur(); });
    inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }

  // los formularios de la 1.2: crear un mundo, editarlo, agregar o editar un servidor
  function formularioCrear() {
    var n = I.nuevo;
    I.formulario = {
      titulo: I.t('createWorldScreen.header.local', 'Create a World'), volver: 'jugar', boton: I.t('createWorldScreen.create', 'Create'), accionBoton: 'crearYa',
      filas: [
        { tipo: 'campo', k: 'nombre', texto: I.t('createWorldScreen.levelName', 'Name'), valor: function () { return n.nombre; } },
        { tipo: 'eleccion', k: 'modo', texto: I.t('createWorldScreen.gameMode.default', 'Default Game Mode'),
          valor: function () { return I.t('selectWorld.gameMode.creative', 'Creative'); } },
        { tipo: 'texto', texto: I.tp('creativo.siempre') },
        { tipo: 'eleccion', k: 'tipo', texto: I.t('createWorldScreen.worldType', 'World Type'),
          valor: function () { return n.tipo === 'plano' ? I.t('generator.flat', 'Flat') : I.t('generator.infinite', 'Infinite'); } },
        { tipo: 'campo', k: 'semilla', texto: I.t('createWorldScreen.levelSeed', 'Seed'), placeholder: I.tp('semilla.azar'), valor: function () { return n.semilla; } },
        { tipo: 'interruptor', k: 'siempreDia', texto: I.t('createWorldScreen.alwaysDay', 'Always Day'), valor: function () { return n.siempreDia; } },
        { tipo: 'interruptor', k: 'bichos', texto: I.tp('bichos'), valor: function () { return n.bichos !== false; } }
      ],
      cambiar: function (f, b) {
        if (f.k === 'nombre') editarTexto(b, n.nombre, function (v) { if (v) n.nombre = v; });
        else if (f.k === 'semilla') editarTexto(b, n.semilla, function (v) { n.semilla = v; });
        else if (f.k === 'tipo') n.tipo = n.tipo === 'plano' ? 'infinito' : 'plano';
        else if (f.k === 'siempreDia') n.siempreDia = !n.siempreDia;
        else if (f.k === 'bichos') n.bichos = n.bichos === false;
      }
    };
    I.ir('formulario');
  }
  function formularioMundo(i) {
    var m = I.mundos[i];
    if (!m) return;
    var n = { nombre: m.nombre };
    I.formulario = {
      titulo: I.t('createWorldScreen.header.editLocal', 'Edit your World'), volver: 'jugar', boton: I.t('gui.done', 'Done'), accionBoton: 'guardarMundoEditado',
      boton2: I.t('selectWorld.delete', 'Delete'), accionBoton2: 'borrarMundo', peligro2: true, mundo: m, datos: n,
      filas: [
        { tipo: 'campo', k: 'nombre', texto: I.t('createWorldScreen.levelName', 'Name'), valor: function () { return n.nombre; } },
        { tipo: 'texto', texto: I.t('createWorldScreen.levelSeed', 'Seed') + ': ' + m.semilla }
      ],
      cambiar: function (f, b) { if (f.k === 'nombre') editarTexto(b, n.nombre, function (v) { if (v) n.nombre = v; }); }
    };
    I.ir('formulario');
  }
  function formularioServidor(i) {
    var l = servidores(), s = i >= 0 ? l[i] : null, n = { nombre: s ? s.nombre : I.t('selectServer.defaultName', 'Minecraft Server'), direccion: s ? s.direccion : '' };
    I.formulario = {
      titulo: s ? I.t('addExternalServerScreen.editTitle', 'Edit External Server') : I.t('addExternalServerScreen.addTitle', 'Add External Server'),
      volver: 'jugarServidores', boton: I.t('addExternalServerScreen.playButtonLabel', 'Play'), accionBoton: 'jugarServidorForm',
      boton2: s ? I.t('addExternalServerScreen.removeButtonLabel', 'Remove') : I.t('addExternalServerScreen.saveButtonLabel', 'Save'),
      accionBoton2: s ? 'quitarServidor' : 'guardarServidor', peligro2: !!s, indice: i, datos: n,
      filas: [
        { tipo: 'campo', k: 'nombre', texto: I.t('addExternalServerScreen.nameTextBoxLabel', 'Server Name'), valor: function () { return n.nombre; } },
        { tipo: 'campo', k: 'direccion', texto: I.t('addExternalServerScreen.ipTextBoxLabel', 'Server Address'),
          placeholder: I.t('addExternalServerScreen.ipPlaceholder', 'Please enter IP or Address'), valor: function () { return n.direccion; } },
        { tipo: 'texto', texto: I.tp('servidor.misma') }
      ],
      cambiar: function (f, b) {
        if (f.k === 'nombre') editarTexto(b, n.nombre, function (v) { if (v) n.nombre = v; });
        else if (f.k === 'direccion') editarTexto(b, n.direccion, function (v) { n.direccion = v; }, 60);
      }
    };
    I.ir('formulario');
  }
  function guardarServidorForm() {
    var f = I.formulario, n = f.datos;
    if (!n.direccion) return false;
    var l = servidores();
    if (f.indice >= 0) l[f.indice] = { nombre: n.nombre, direccion: n.direccion };
    else l.push({ nombre: n.nombre, direccion: n.direccion });
    guardarServidores(l);
    return true;
  }

  Object.assign(I.acciones, {
    jugar: function () { refrescarMundos().then(function () { I.ir('jugar'); mirarPublicos(); }); },
    jugarServidores: function () { I.tabJugar = 2; I.acciones.jugar(); },
    opciones: function () { I.enJuego = false; armarAjustes(); I.ir('opciones'); },
    elegirIdioma: function (b) { opciones.idioma = b.idioma; guardarOpciones(); ponerIdioma(b.idioma); refrescarMundos(); irAlTitulo(); },
    shadersSi: function () { opciones.shaders = true; guardarOpciones(); aplicarOpciones('shaders'); irAlTitulo(); },
    shadersNo: function () { opciones.shaders = false; guardarOpciones(); aplicarOpciones('shaders'); irAlTitulo(); },
    // una fila de Ajustes: interruptor (prender/apagar), elección (la siguiente) o un campo de texto
    ajuste: function (f) {
      if (f.mundo) {
        if (partida) {
          partida[f.k] = f.k === 'bichos' ? partida.bichos === false : !partida[f.k];
          if (f.k === 'bichos') B.activo = partida.bichos !== false;
          guardar();
        }
      } else if (f.tipo === 'casilla') opciones[f.k] = !opciones[f.k];
      else if (f.tipo === 'eleccion') { var i = f.valores.indexOf(opciones[f.k]); opciones[f.k] = f.valores[(i + 1) % f.valores.length]; }
      else if (f.tipo === 'campo') {
        var bt = I.botones.filter(function (x) { return x.fila === f; })[0];
        if (bt) editarTexto(bt, opciones[f.k], function (v) { if (v) { opciones[f.k] = v.slice(0, 20); guardarOpciones(); aplicarOpciones(f.k); } }, 20);
        return;
      }
      Sonido.tocar('random.click', 0.5, 1);
      guardarOpciones();
      aplicarOpciones(f.k);
      if (f.k === 'idioma') armarAjustes();
    },
    // un deslizador se aplica mientras se mueve; la distancia (que rehace el mundo), al soltar
    deslizar: function (f, valor) { opciones[f.k] = valor; if (f.k !== 'dist') aplicarOpciones(f.k); else I.sucio(); },
    soltarDeslizador: function (f) { guardarOpciones(); aplicarOpciones(f.k); },
    titulo: function () { Red.dejarDeMirar(); irAlTitulo(); },
    crear: function () {
      I.nuevo = { nombre: I.t('createWorldScreen.defaultName', 'My World'), semilla: '', tipo: 'infinito', siempreDia: false, bichos: true };
      formularioCrear();
    },
    formFila: function (b) {
      var f = I.formulario;
      if (f && f.cambiar) { f.cambiar(b.fila, b); Sonido.tocar('random.click', 0.5, 1); I.sucio(); }
    },
    crearYa: function () { crearMundo(); },
    abrir: function (b) { var m = I.mundos[b.i]; if (m) abrirMundo(m); },
    editarMundo: function (b) { formularioMundo(b.i); },
    guardarMundoEditado: function () {
      var f = I.formulario, m = f.mundo;
      m.nombre = (f.datos.nombre || m.nombre).slice(0, 32);
      BD.guardarMundo(m).then(refrescarMundos).then(function () { I.ir('jugar'); });
    },
    borrarMundo: function () {
      var m = I.formulario.mundo;
      I.preguntar(I.t('selectWorld.deleteQuestion', 'Are you sure you want to delete this world?'), '«' + m.nombre + '» ' + I.t('selectWorld.deleteWarning', ''), function () {
        BD.borrar(m.id).then(refrescarMundos).then(function () { I.ir('jugar'); });
      });
    },
    entrarPublico: function (b) { entrarPublico(b.i); },
    entrarServidor: function (b) { var s = servidores()[b.i]; if (s) entrarServidor(s); },
    agregarServidor: function () { formularioServidor(-1); },
    editarServidor: function (b) { formularioServidor(b.i); },
    guardarServidor: function () { if (guardarServidorForm()) { refrescarMundos(); I.acciones.jugarServidores(); } },
    jugarServidorForm: function () {
      var n = I.formulario.datos;
      if (!n.direccion) return;
      guardarServidorForm();
      entrarServidor(n);
    },
    quitarServidor: function () {
      var i = I.formulario.indice;
      I.preguntar(I.t('selectServer.deleteQuestion', 'Are you sure you want to remove this server?'), '', function () {
        var l = servidores(); l.splice(i, 1); guardarServidores(l); refrescarMundos(); I.acciones.jugarServidores();
      });
    },
    pausa: function () {
      if (I.pantalla !== 'juego') return;
      I.soltarTodo();
      I.ir('pausa');
      if (document.pointerLockElement) document.exitPointerLock();
      guardar();
    },
    seguir: function () { I.ir('juego'); },
    opcionesJuego: function () { I.enJuego = true; armarAjustes(); I.ir('opciones'); },
    salir: function () {
      // el bucle deja el mundo ya (muestra el panorama) mientras se guarda
      jugando = false;
      I.cargandoTexto = I.tp('guardando'); I.cargandoParte = undefined; I.ir('cargando');
      cerrarMundo().then(function () { irAlTitulo(); });
    },
    reaparecer: function () { reaparecer(); },
    listoOpciones: function () { guardarOpciones(); aplicarOpciones(); if (I.enJuego) I.ir('pausa'); else irAlTitulo(); },
    inventario: function () { if (I.pantalla === 'juego') { I.soltarTodo(); I.ir('inventario'); if (document.pointerLockElement) document.exitPointerLock(); } },
    cerrarInv: function () { I.ir('juego'); },
    abrirChat: function () { if (I.pantalla === 'juego' && I.juego.red) { I.soltarTodo(); I.ir('chat'); if (document.pointerLockElement) document.exitPointerLock(); } },
    cerrarChat: function () { I.ir('juego'); },
    escribirChat: function () {
      var tam = I.tam(), E = I.E();
      editarTexto({ x: 6 * E, y: tam[1] - 26 * E, w: tam[0] - 46 * E, h: 20 * E }, '', function (v) {
        if (!v) return;
        if (Red.decir(v)) chat(I.f(I.t('chat.type.text', '<%s> %s'), opciones.nombre, v));
        else chat(I.t('chat.cannotSend', 'Cannot send chat message'), '#ff8080');
      }, 200);
    },
    item: function (b) {
      var it = b.item, barra = I.juego.barra;
      // si ya está en la barra, se elige ese lugar; si no, va en el elegido
      for (var i = 0; i < 9; i++) if (barra[i] && barra[i].id === it.id && barra[i].m === it.m) { I.juego.elegido = i; mostrarNombre(); I.sucio(); return; }
      barra[I.juego.elegido] = { id: it.id, m: it.m };
      mostrarNombre();
      Sonido.tocar('random.click', 0.4, 1.2);
      I.sucio();
    },
    elegir: function (i) { I.juego.elegido = i; mostrarNombre(); I.sucio(); },
    saltoDoble: (function () {
      var antes = 0;
      return function (cuando) {
        var ahora = cuando || performance.now();
        cuenta.saltos++;
        if (partida && partida.creativo && ahora - antes < 350) {
          J.volando = !J.volando; J.vy = 0; antes = 0;
          I.juego.volando = J.volando; I.sucio();
        } else antes = ahora;
      };
    })(),
    bloquearMouse: function () { if (lienzo.requestPointerLock) { try { lienzo.requestPointerLock(); } catch (e) { /* nada */ } } }
  });
  // el sonido de los botones de los menús
  var accionesConClic = ['jugar', 'opciones', 'titulo', 'crear', 'crearYa', 'abrir', 'seguir', 'opcionesJuego', 'salir', 'listoOpciones',
    'preguntaSi', 'preguntaNo', 'tab', 'cerrarInv', 'seccion', 'shadersSi', 'shadersNo', 'elegirIdioma', 'tabJugar', 'editarMundo',
    'entrarPublico', 'entrarServidor', 'agregarServidor', 'editarServidor', 'guardarServidor', 'jugarServidorForm', 'quitarServidor',
    'guardarMundoEditado', 'borrarMundo', 'reaparecer', 'abrirChat', 'cerrarChat', 'jugarServidores'];
  accionesConClic.forEach(function (n) {
    var f = I.acciones[n];
    if (!f) return;
    I.acciones[n] = function (b) { Sonido.tocar('random.click', 0.5, 1); return f(b); };
  });
  // Escape (y el botón atrás del teléfono, que web.js convierte en Escape): pausa en el juego y vuelve
  // una pantalla en los menús
  addEventListener('keydown', function (e) {
    if (e.code !== 'Escape' || (e.target && e.target.tagName === 'INPUT')) return;
    var p = I.pantalla;
    if (jugando) {
      if (p === 'juego') I.acciones.pausa();
      else if (p === 'pausa') I.acciones.seguir();
      else if (p === 'opciones') I.acciones.listoOpciones();
      else if (p === 'pregunta') I.acciones.preguntaNo();
      else if (p === 'chat') I.ir('juego');
    } else if (p === 'jugar' || p === 'opciones') { if (p === 'opciones') guardarOpciones(); Red.dejarDeMirar(); irAlTitulo(); }
    else if (p === 'formulario') I.ir('jugar');
    else if (p === 'pregunta') I.acciones.preguntaNo();
  });
  addEventListener('resize', function () { I.sucio(); });
  // el teléfono le puede sacar la GPU a la página (poca memoria, otra app): se guarda y, cuando la
  // devuelve, se recarga (más simple y seguro que rehacer todas las texturas y mallas)
  lienzo.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (jugando) guardar(); });
  lienzo.addEventListener('webglcontextrestored', function () { (jugando ? guardar() : Promise.resolve()).then(function () { location.reload(); }); });

  // Rezona muestra el juego en un cuadro con su propia pantalla de carga hasta que el juego avisa: se
  // avisa ya, así se ven la intro y la carga del juego
  try { if (window.parent !== window) window.parent.postMessage({ type: 'game:ready' }, '*'); } catch (e) { /* nada */ }
  arrancar().catch(function (e) {
    console.error('arranque: ' + (e && e.stack || e));
    I.cargandoTexto = 'Error: ' + (e && e.message || e);
    I.sucio();
  });
})();
