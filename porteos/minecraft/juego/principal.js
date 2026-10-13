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
  var cargando = false;         // se está armando el mundo (la pantalla de progreso de la 1.2)
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
    if (window.Jui) Jui.idioma(l);
  }
  function avisar(texto) { I.juego.mensaje = texto; I.juego.mensajeHasta = performance.now() + 2500; I.sucio(); }
  function chat(s, color) {
    I.juego.chat.push({ s: s, c: color, t: performance.now() });
    if (I.juego.chat.length > 60) I.juego.chat.shift();
    if (hudPan && hudPan.chat) hudPan.chat(s, color);
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
  // jugando, el mundo se dibuja con menos píxeles que la pantalla cuando el teléfono no da (ver
  // resolucionAuto) y el navegador lo estira: con píxeles cuadrados ('pixelated'), como se ven las
  // texturas del juego. Estirado suavizado (lo que hacía el navegador solo) todo se veía borroso, como
  // comprimido. En los menús sí suavizado: el panorama de atrás es una foto. Los menús de la 1.2 lo
  // muestran nítido (no lo tapan ni lo difuminan), así que va con todos los píxeles
  var lienzoNitido = null;
  function ajustarTamano() {
    var menu = !jugando || cargando;
    var dp = Math.min(window.devicePixelRatio || 1, debil ? 1.5 : 2);
    var base = menu ? dp : dp * (opciones.resolucion || escalaAuto);
    var w = Math.max(1, Math.round(lienzo.clientWidth * base)), h = Math.max(1, Math.round(lienzo.clientHeight * base));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    if (lienzoNitido !== !menu) { lienzoNitido = !menu; lienzo.style.imageRendering = menu ? '' : 'pixelated'; }
  }

  async function arrancar() {
    // primero la fuente (pesa poco) para mostrar la carga
    var chicas = ['fuente', 'gui', 'iconos', 'ui', 'icono', 'huevos', 'objetos'];
    var lista = await Promise.all(chicas.map(function (n) { return cargarImagen('datos/' + n + '.png'); }));
    chicas.forEach(function (n, i) { imgs[n] = lista[i]; });
    I.iniciar(hud, imgs, {});
    I.cargandoTexto = '…'; I.cargandoParte = 0.05;
    I.ir('cargando');
    requestAnimationFrame(cuadro);

    datos = await (await fetch('datos/datos.json')).json();
    I.ponerUI({}, datos.ui);
    var datosUi = await (await fetch('datos/interfaz.json')).json();
    var imgsUi = { 'logo.webp': null };
    for (var tx in datosUi.texturas) imgsUi[datosUi.texturas[tx][0]] = null;
    for (var ar in imgsUi) imgsUi[ar] = await cargarImagen('datos/' + ar);
    Jui.iniciar(datosUi, imgsUi, {
      '$pocket_edition': true, '$pocket_screen': true, '$desktop_screen': false, '$touch': true, '$touch_supported': true,
      '$is_publish': true, '$pre_release': false, '$keyboard_and_mouse_supported': !telefono, '$gamepad_supported': false
    });
    Jui.textos(Pantallas.textos);
    Jui.fuente(imgs.fuente);
    Jui.glifos({ 224: await cargarImagen('datos/glifos_E0.png').catch(function () { return null; }),
      225: await cargarImagen('datos/glifos_E1.png').catch(function () { return null; }) });
    Jui.sonido = function (n) { Sonido.tocar(n, 0.5, 1); };
    Pantallas.iniciar(G);
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
    imgs.orbe = await cargarImagen('datos/orbe.png').catch(function () { return null; });
    var pano = [];
    for (i = 0; i < 6; i++) pano.push(await cargarImagen('datos/panorama' + i + '.webp'));
    // las texturas de los bichos y los jugadores
    imgs.bichos = {};
    var texB = {};
    for (var nb in datos.bichos) datos.bichos[nb].forEach(function (c) { texB[c.tex] = 1; });
    // y las de las variantes (aldeanos, conejos, caballos, loros, gatos, llamas, shulkers, lobos)
    var vrs = (datos.entidades && datos.entidades.variantes) || {};
    for (var nv in vrs) vrs[nv].forEach(function (t) { if (t) texB[t] = 1; });
    var nombresB = Object.keys(texB), imB = await Promise.all(nombresB.map(function (n) { return cargarImagen('datos/' + n); }));
    nombresB.forEach(function (n, k) { imgs.bichos[n] = imB[k]; });
    I.cargandoParte = 0.8; I.sucio();

    C.armarBloques(datos.bloques);
    Items.preparar(datos.objetos);
    Minar.preparar();
    Botin.preparar(datos.entidades && datos.entidades.botin);
    O.prepararMateriales();
    Modelos.preparar(datos.bichos, (datos.entidades && datos.entidades.variantes) || {});
    Muneco.preparar(datos.bichos, imgs.bichos);
    B.iniciar(datos.entidades);
    O.prepararHuevos(B.huevos());
    ajustarTamano();
    // los shaders de Tito se compilan recién cuando se eligen (en un teléfono flojo tardan)
    Render.iniciar(lienzo, datos, imgs, { shaders: opciones.shaders === true, sofisticados: opciones.sofisticados });
    Render.panorama(pano);
    if (GL.floja) debil = true;
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
      cuenta: cuenta, bichos: B, red: Red, publico: entrarPublico, pantallas: Pantallas, jui: Jui, comando: function (t) { comando(t); }, inventario: function () { return inv; },
      supervivencia: function () { return sup; }, muerto: function () { return muerto; }, tirados: function () { return tirados; }, hudPan: function () { return hudPan; },
      pegar: function (fx, fy) { return pegar(fx, fy); }, darEfecto: function (id, dur, amp) { return darEfecto(id, dur, amp); },
      azar: function (x, y, z, n) { trab.postMessage({ t: 'pruebaAzar', x: x, y: y, z: z, n: n }); }, tnts: function () { return tnts; },
      leerTrabajador: function (p) { trab.postMessage({ t: 'leer', p: p }); },
      durmiendo: function () { return durmiendo; }, montado: function () { return montado ? { tipo: montado.e.tipo, id: montado.e.id } : null; },
      rayo: function (fx, fy) { return tocarBloque(fx, fy, false); }, ms: function () { return msCuadro; },
      diag: null, pedirDiag: function () { if (trab) trab.postMessage({ t: 'diag' }); }, listo: true };
  }
  function irAlTitulo() {
    var f = datos.frases || [];
    I.frase = f.length ? f[Math.floor(Math.random() * f.length)] : '';
    Pantallas.ir('inicio');
    I.ir('jui');
    // la primera vez: el idioma y con o sin shaders, en carteles de la 1.2 sobre el título
    Pantallas.primeraVez(function () { });
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
  // n: lo de la pantalla "Crear mundo nuevo" de la 1.2 (nombre, semilla, modo, dificultad, tipo y las
  // reglas del juego)
  function crearMundo(n) {
    n = n || I.nuevo;
    var m = {
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      nombre: (String(n.nombre || '').trim() || I.t('createWorldScreen.defaultName', 'My World')).slice(0, 32),
      semilla: typeof n.semilla === 'number' ? n.semilla : semillaDe(n.semilla), creado: Date.now(), jugado: Date.now(),
      tiempo: 1000, jugador: null, barra: O.barraInicial(), elegido: 0, tipo: n.tipo === 'plano' ? 'plano' : 'infinito',
      siempreDia: !!n.siempreDia, bichos: n.bichos !== false, local: true
    };
    // el resto de lo elegido (modo, dificultad, reglas) queda en el mundo tal cual
    for (var k in n) if (m[k] === undefined && k !== 'id') m[k] = n[k];
    m.modo = n.modo || 'creativo';
    m.creativo = m.modo === 'creativo';
    // en supervivencia (y aventura) se empieza sin nada, como el juego
    if (!m.creativo) m.barra = [];
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
  // la vida, el hambre, el aire y la experiencia (supervivencia.js); el HUD de la 1.2 (hud_screen)
  var sup = Supervivencia.nuevo(), sinHambre = false, hudPan = null, antesXZ = [0, 0];
  var DIFICULTADES = ['peaceful', 'easy', 'normal', 'hard'];
  // el modo de juego de la partida: creativo (vuela, sin vida), supervivencia o aventura (con vida)
  function ponerModo(modo) {
    if (!partida) return;
    partida.modo = modo;
    if (!partida.local) return;
    var cre = modo === 'creativo';
    partida.creativo = cre;
    J.creativo = cre; I.juego.creativo = cre;
    if (!cre) { J.volando = false; I.juego.volando = false; }
    I.juego.conVida = !cre; B.conVida = !cre;
    listaCreativa = null;
    I.sucio();
  }
  function abrirMundo(m) {
    Red.dejarDeMirar();
    I.cargandoTexto = I.t('progressScreen.generating', I.tp('cargando')); I.cargandoParte = 0;
    cargando = true;
    I.soltarTodo();
    Pantallas.ir('carga');
    I.ir('jui');
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
      if (m.local && m.modo) m.creativo = m.modo === 'creativo';
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
      // lo que lleva el jugador: la barra (la de siempre de los mundos viejos) y el resto
      inv = Inventario.nuevo((m.barra || O.barraInicial()).slice(0, 9));
      Inventario.cargar(inv, m.inventario);
      I.juego.barra = inv.barra;
      I.juego.elegido = m.elegido || 0;
      I.juego.creativo = m.creativo; I.juego.volando = J.volando;
      I.juego.chat = []; I.juego.nombres = [];
      caida = 0; muerto = false; invulnerable = 0;
      // supervivencia en los mundos propios; en un servidor (la red: si no anda, se juega igual,
      // solo) hay vida pero no hambre, y los bichos se comparten
      sup = Supervivencia.cargar(m.supervivencia);
      sinHambre = !m.local;
      vida = sup.vida;
      I.juego.vida = vida;
      B.activo = m.bichos !== false;
      I.juego.conVida = !m.local || !m.creativo;
      B.conVida = I.juego.conVida;
      B.dificultad = DIFICULTADES[typeof m.dificultad === 'number' ? m.dificultad : 2] || 'normal';
      // el HUD de la 1.2: la barra, los corazones, la comida, la experiencia
      hudPan = Pantallas.hud();
      I.hud = hudPan ? function (cx) { Jui.dibujarSuelta(cx, hudPan); } : null;
      I.tocarHud = hudPan ? function (x, y) { return Jui.tocarSuelta(hudPan, x, y); } : null;
      I.tocarEfectos = function (x, y) {
        var z = Pantallas.zonaEfectos();
        if (!z || x < z.x - 2 || x > z.x + z.w + 2 || y < z.y - 2 || y > z.y + z.h + 2) return false;
        abrirPantalla('efectos');
        return true;
      };
      antesXZ = [J.x, J.z];
      if (!m.local) {
        Red.reiniciarCambios();
        I.juego.red = { estado: 'conectando', texto: I.tp('red.conectando') };
        Red.entrar(m.sala, ganchosRed);
      } else {
        I.juego.red = null;
        B.cargar(m.bichos_lista);
      }
      Tirados.cargar(m.local ? m.tirados : null);
      Contenedores.cargar(m.local ? m.contenedores : null);
      minando = null;
      ultimoCentro = [Math.floor(J.x / 16), Math.floor(J.z / 16), Math.floor((J.y + 1.62) / 16)];
      trab.postMessage({ t: 'ini', azar: !!m.local, bloques: datos.bloques, uv: datos.atlas.uv, semilla: m.semilla, dist: opciones.dist, tipo: m.tipo,
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
    else if (d.t === 'soltar') { for (var i = 0; i + 4 < d.lista.length; i += 5) soltarMundo(d.lista[i + 3], d.lista[i + 4], d.lista[i], d.lista[i + 1], d.lista[i + 2]); }
    else if (d.t === 'tnt') { for (var k = 0; k + 2 < d.lista.length; k += 3) prenderTnt(d.lista[k], d.lista[k + 1], d.lista[k + 2], 80); }
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
    I.juego.guardandoHasta = performance.now() + 2500;
    m.jugador = { x: J.x, y: J.y, z: J.z, yaw: J.yaw, pitch: J.pitch, volando: J.volando };
    m.barra = I.juego.barra.map(function (c) { return c ? { id: c.id, m: c.m } : null; }); m.elegido = I.juego.elegido; m.jugado = Date.now();
    m.inventario = Inventario.guardar(inv);
    m.supervivencia = Supervivencia.guardar(sup);
    m.bichos_lista = B.paraGuardar();
    m.tirados = Tirados.guardar();
    m.contenedores = Contenedores.guardar();
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
      Tirados.limpiar();
      Contenedores.limpiar();
      if (trab) { trab.terminate(); trab = null; }
      Render.reiniciar();
      Mundo.iniciar(null);
      if (document.pointerLockElement) document.exitPointerLock();
      return refrescarMundos();
    });
  }
  setInterval(function () { if (jugando && !cargando) guardar(); }, 45000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && jugando) {
      guardar();
      if (I.pantalla === 'juego') I.acciones.pausa();
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
    golpe: function (dano, quien, emp) { recibirDano(dano, quien, emp, quien ? 'player' : 'generic'); },
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
  var ultimoAtacante = '', ultimaCausa = '';
  // causa: la de los mensajes de muerte del juego (fall, drown, lava, inFire, onFire, starve,
  // outOfWorld, inWall, explosion, mob...)
  var SIN_DESGASTE = { fall: 1, drown: 1, starve: 1, outOfWorld: 1, inWall: 1, onFire: 1, magic: 1, wither: 1 };
  // los golpes que la dificultad agranda o achica (EntityPlayer.attackEntityFrom: isDifficultyScaled)
  var CON_DIFICULTAD = { mob: 1, explosion: 1 };
  function recibirDano(dano, quien, emp, causa) {
    if (muerto || dano <= 0) return;
    if (!I.juego.conVida && causa !== 'outOfWorld') return;
    causa = causa || (quien ? 'mob' : 'generic');
    if (CON_DIFICULTAD[causa] && !sinHambre) {
      if (B.dificultad === 'peaceful') return;
      if (B.dificultad === 'easy') dano = Math.min(dano / 2 + 1, dano);
      else if (B.dificultad === 'hard') dano = dano * 3 / 2;
    }
    var antes = sup.vida, real = Supervivencia.danar(sup, dano, causa, Inventario.puntosArmadura(inv));
    if (real <= 0 && sup.vida > 0) return;
    if (durmiendo) despertar(false);
    // los corazones titilan un segundo mostrando en blanco lo que se perdió (GuiIngame) y la cámara se
    // ladea medio segundo (hurtTime)
    if (sup.vida < antes) {
      golpeTicks = 10;
      if (!((I.juego.parpadeoTick || 0) > pasosLuz)) I.juego.vidaAntes = antes;
      I.juego.parpadeoTick = pasosLuz + 20;
    }
    // la armadura se gasta con los golpes (uno por cada 4 de daño, como el juego)
    if (!SIN_DESGASTE[causa] && real > 0) {
      var gasto = Math.max(1, Math.floor(dano / 4));
      for (var a = 0; a < 4; a++) { var p = inv.armadura[a], d = p && Items.def[p.id]; if (d && d.dur) { p.d = (p.d || 0) + gasto; if (p.d > d.dur) { inv.armadura[a] = null; Sonido.tocar('random.break', 0.8, 0.9); } } }
    }
    vida = sup.vida;
    I.juego.vida = vida; I.juego.dano = 1; I.juego.parpadeoHasta = performance.now() + 500;
    if (emp) { J.vx += emp[0]; J.vz += emp[1]; J.vy = Math.max(J.vy, 0.36); }
    if (quien) ultimoAtacante = quien;
    ultimaCausa = causa;
    Sonido.tocar('game.player.hurt', 1, 0.9 + Math.random() * 0.2);
    if (vida <= 0) morir();
    I.sucio();
  }
  // el mensaje de muerte del juego para la causa (con quién, si hubo): death.attack.<causa>, con
  // ".player" cuando alguien lo empujó a eso (death.attack.lava.player: "...to escape %2$s")
  var CAUSA_TEXTO = { mob: 'mob', entity_attack: 'mob', projectile: 'arrow', player: 'player' };
  function mensajeMuerte() {
    var n = opciones.nombre, q = ultimoAtacante, k = CAUSA_TEXTO[ultimaCausa] || ultimaCausa || 'generic';
    function T(c) { return I.f(I.t(c, '%1$s died'), n, q); }
    if (k === 'fall') return T(q ? 'death.fell.assist' : 'death.attack.fall');
    if (k === 'magic' && q) k = 'indirectMagic';
    // las que necesitan a alguien (mob, arrow, fireball, thrown, indirectMagic, player)
    var conQuien = { mob: 1, arrow: 1, fireball: 1, thrown: 1, indirectMagic: 1, player: 1 };
    if (conQuien[k]) return q ? T('death.attack.' + k) : T('death.attack.generic');
    if (q && I.textos['death.attack.' + k + '.player']) return T('death.attack.' + k + '.player');
    if (I.textos['death.attack.' + k]) return T('death.attack.' + k);
    return T('death.attack.generic');
  }
  function morir() {
    if (montado) bajar();
    muerto = true;
    I.soltarTodo();
    I.muerte.texto = mensajeMuerte();
    // en supervivencia se cae todo lo que se llevaba (salvo la regla "guardar el inventario") y la
    // experiencia
    if (partida && partida.local && !partida.creativo && !partida.guardarInventario) {
      Inventario.devolver(inv, null);
      [inv.barra, inv.mochila, inv.armadura, inv.mano2].forEach(function (l) {
        for (var i = 0; i < l.length; i++) if (l[i]) { tirarObjeto(l[i], true); l[i] = null; }
      });
      soltarXp(J.x, J.y + 0.5, J.z, Supervivencia.xpAlMorir(sup));
      Supervivencia.morir(sup);
    }
    Red.accion({ type: 'muerte', name: opciones.nombre, byName: ultimoAtacante });
    chat(I.muerte.texto, '#ff8080');
    Sonido.tocar('game.player.die', 1, 1);
    Pantallas.ir('muerte');
    I.ir('jui');
  }
  // tirar algo (EntityPlayer.dropItem): hacia donde se mira, desde la altura de los ojos; al morir,
  // para cualquier lado
  var tirados = Tirados.lista;
  function tirarObjeto(c, alMorir) {
    if (!c || c.n <= 0) return;
    if (alMorir) {
      var a = Math.random() * Math.PI * 2, v = Math.random() * 0.5;
      Tirados.cosa(c, J.x, J.y + 1.32, J.z, Math.sin(a) * v, 0.2, -Math.cos(a) * v, 40);
      return;
    }
    var cp = Math.cos(J.pitch), f = 0.3, g = Math.random() * Math.PI * 2, h = 0.02 * Math.random();
    Tirados.cosa(c, J.x, J.y + 1.32, J.z, Math.sin(J.yaw) * cp * f + Math.cos(g) * h, -Math.sin(J.pitch) * f + 0.1 + (Math.random() - Math.random()) * 0.1,
      -Math.cos(J.yaw) * cp * f + Math.sin(g) * h, 40);
  }
  function soltarXp(x, y, z, n) { if (n > 0) Tirados.orbes(x, y, z, n); }
  // levantar lo tirado: al inventario (lo que no entra queda en el piso)
  var ganchosTirados = {
    levantar: function (c) {
      var sobra = Inventario.agregar(inv, c);
      if (sobra < c.n) { I.sucio(); if (I.pantalla === 'jui') Jui.sucio(); }
      return sobra;
    },
    xp: function (n) {
      var antes = sup.nivel;
      Supervivencia.sumarXp(sup, n);
      // cada 5 niveles suena la subida (EntityPlayer.addExperienceLevel)
      if (sup.nivel > antes && sup.nivel % 5 === 0) Sonido.tocar('random.levelup', 0.75, 1);
      I.sucio();
    },
    sonido: function (ev, vol, tono, x, y, z) { Sonido.tocar(ev, vol, tono, x, y, z); }
  };
  // ------------------------------------------------------------------------------------------
  // Los efectos (efectos.js): dar uno (la absorción llena sus corazones amarillos al empezar o al
  // renovarse, como PotionAbsorption), lo que hacen en cada paso y lo que cambian del jugador
  // ------------------------------------------------------------------------------------------
  function darEfecto(id, dur, amp) {
    var antes = Efectos.de(sup.efectos, id), ampAntes = antes ? antes.amp : -1;
    var e = Efectos.dar(sup.efectos, id, dur, amp);
    if (e && id === 22) sup.absorcion = Math.max(0, sup.absorcion - (ampAntes >= 0 ? 4 * (ampAntes + 1) : 0)) + 4 * (e.amp + 1);
    I.sucio();
    return e;
  }
  var ganchosEfectos = {
    curar: function (n) { if (sup.vida > 0 && !muerto) { Supervivencia.curar(sup, n); vida = sup.vida; I.juego.vida = vida; } },
    danar: function (n, causa) { recibirDano(n, '', null, causa); },
    cansar: function (x) { Supervivencia.cansar(sup, x); },
    comer: function (n, sat) { sup.comida = Math.min(20, sup.comida + n); sup.saturacion = Math.min(sup.comida, sup.saturacion + sat); },
    vida: function () { return sup.vida; },
    dar: function (id, dur, amp) { darEfecto(id, dur, amp); },
    alTerminar: function (e) {
      if (e.id === 22) sup.absorcion = Math.max(0, sup.absorcion - 4 * (e.amp + 1));
      I.sucio();
    }
  };
  // la náusea: lo que el juego llama "timeInPortal" (sube de a 1/150 mientras dura y baja de a 0,01)
  var nausea = 0, firmaEfectos = '';
  function pasoEfectos() {
    var ef = sup.efectos;
    if (ef.lista.length) Efectos.paso(ef, ganchosEfectos);
    // la velocidad (+20 % por nivel) y la lentitud (−15 %), el salto (+0,1 por nivel), la levitación
    var vel = Efectos.nivel(ef, 1), len = Efectos.nivel(ef, 2);
    J.velMult = Math.max(0, (1 + 0.2 * vel) * (1 - 0.15 * len));
    J.saltoExtra = 0.1 * Efectos.nivel(ef, 8);
    J.levitar = Efectos.nivel(ef, 24);
    // la vida extra: 2 corazones por nivel mientras dura (al irse, la vida no pasa del máximo)
    var max = 20 + 4 * Efectos.nivel(ef, 21);
    if (sup.max !== max) { sup.max = max; if (sup.vida > max) { sup.vida = max; vida = max; I.juego.vida = max; } I.sucio(); }
    var nz = Efectos.de(ef, 9);
    nausea = nz && nz.dur > 60 ? Math.min(1, nausea + 1 / 150) : Math.max(0, nausea - 0.01);
    // el HUD se vuelve a dibujar cuando cambian los íconos (y en los últimos 10 s, que titilan)
    var f = '';
    for (var k = 0; k < ef.lista.length; k++) { var e = ef.lista[k]; f += e.id + ':' + e.amp + (e.dur <= 200 ? ':' + e.dur : '') + ','; }
    f += '|' + sup.absorcion + '|' + sup.max + (Efectos.de(ef, 10) && I.juego.conVida ? '|' + pasosLuz : '');
    if (f !== firmaEfectos) { firmaEfectos = f; I.sucio(); }
  }
  function reaparecer() {
    Supervivencia.reaparecer(sup);
    muerto = false; vida = sup.vida; I.juego.vida = vida; ultimoAtacante = ''; ultimaCausa = ''; caida = 0;
    // en la cama si sigue ahí (si no: "Faltaba tu cama o estaba obstruida")
    var cama = partida && partida.cama, lugar = null;
    if (cama && Mundo.bloque(cama[0], cama[1], cama[2]) === 26) lugar = salidaCama(cama[0], cama[1], cama[2]);
    else if (cama && Mundo.cargado(cama[0], cama[2])) { partida.cama = null; aviso(I.t('tile.bed.notValid', 'Your home bed was missing or obstructed')); }
    if (lugar) J.ubicar(lugar[0], lugar[1], lugar[2]);
    else J.ubicar(aparicion[0], aparicion[1], aparicion[2]);
    esperandoSuelo = true;
    Pantallas.vaciar();
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
  function aventura() { return !!(partida && partida.local && partida.modo === 'aventura'); }
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
    if (!(jug && (!mejor || tj < mejor.t)) && !mejor) return false;
    var it = I.juego.barra[I.juego.elegido], d = it && Items.def[it.id], dano = d && d.dano ? d.dano : 1;
    // la fuerza suma 3 por nivel y la debilidad resta 4 (los modificadores del ataque)
    dano = Math.max(0, dano + 3 * Efectos.nivel(sup.efectos, 5) - 4 * Efectos.nivel(sup.efectos, 18));
    // el golpe crítico: cayendo y sin ceguera (EntityPlayer.attackTargetEntityWithCurrentItem)
    if (!J.enPiso && J.vy < 0 && !J.enAgua && !J.volando && !J.enEscalera && !Efectos.de(sup.efectos, 15)) dano *= 1.5;
    if (jug && (!mejor || tj < mejor.t)) Red.golpear(jug.id, dano, kx, kz);
    else if (mejor.remoto) Red.golpearBicho(mejor.e.dueno, mejor.e.mid, dano, kx, kz);
    else { B.golpe(mejor.e, dano, kx, kz); B.duenoAtaco(mejor.e); }
    if (supervivencia()) {
      // la espada se gasta 1 por golpe, las demás herramientas 2
      if (d && d.dur && Inventario.desgastar(inv, I.juego.elegido, d.herr === 'espada' ? 1 : 2)) Sonido.tocar('random.break', 0.8, 0.8 + Math.random() * 0.4);
      Supervivencia.cansar(sup, 0.1);
    }
    golpe(); golpeRed = true;
    return true;
  }

  // abrir una pantalla de la 1.2 desde el mundo (la mesa, el horno, un cofre)
  function abrirPantalla(nombre, datos) {
    I.soltarTodo();
    Pantallas.ir(nombre, datos);
    I.ir('jui');
    if (document.pointerLockElement) document.exitPointerLock();
  }
  // el cofre de al lado (dos juntos son uno grande: arriba el de menor x o z, como el juego)
  function cofreVecino(x, y, z, id) {
    var v = [[-1, 0], [0, -1], [1, 0], [0, 1]];
    for (var k = 0; k < 4; k++) if (Mundo.bloque(x + v[k][0], y, z + v[k][1]) === id) return [x + v[k][0], z + v[k][1], k < 2];
    return null;
  }
  function usar(h) {
    var id = h.id, f = C.FORMA[id];
    if (id === 58) { abrirPantalla('mesa'); return true; }
    if (id === 26) return usarCama(h);
    if (id === 61 || id === 62) { abrirPantalla('horno', { cont: Contenedores.horno(h.x, h.y, h.z) }); return true; }
    if (id === 54 || id === 146 || id === 130) {
      // no se abre con un bloque macizo encima (BlockChest.isBlocked)
      var arriba = Mundo.bloque(h.x, h.y + 1, h.z);
      if (arriba > 0 && C.OPACO[arriba] && C.SOLIDO[arriba]) return true;
      Sonido.tocar(id === 130 ? 'random.chestopen' : 'random.chestopen', 0.5, Math.random() * 0.1 + 0.9, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      if (id === 130) { abrirPantalla('cofreEnder', { ender: true, pos: [h.x, h.y, h.z] }); return true; }
      var este = Contenedores.cofre(h.x, h.y, h.z), vec = cofreVecino(h.x, h.y, h.z, id);
      if (vec) {
        var otro = Contenedores.cofre(vec[0], h.y, vec[1]);
        abrirPantalla('cofreGrande', vec[2] ? { cont: otro, otro: este, pos: [h.x, h.y, h.z] } : { cont: este, otro: otro, pos: [h.x, h.y, h.z] });
      } else abrirPantalla('cofre', { cont: este, pos: [h.x, h.y, h.z] });
      return true;
    }
    if (f === C.F.puerta && id !== 71) {
      var abajo = Mundo.meta(h.x, h.y, h.z) & 8 ? h.y - 1 : h.y, m = Mundo.meta(h.x, abajo, h.z);
      ponerBloque(h.x, abajo, h.z, id, m ^ 4);
      Sonido.tocar((m & 4) ? 'random.door_close' : 'random.door_open', 1, 0.9 + Math.random() * 0.1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      return true;
    }
    // los portones de cerca se abren y se cierran (BlockFenceGate: el 4 es "abierto")
    if (id === 107 || (id >= 183 && id <= 187)) {
      var mg = Mundo.meta(h.x, h.y, h.z);
      ponerBloque(h.x, h.y, h.z, id, mg ^ 4);
      Sonido.tocar((mg & 4) ? 'random.door_close' : 'random.door_open', 1, 0.9 + Math.random() * 0.1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      return true;
    }
    // la torta: una porción (2 de comida) por toque si hay hambre; a la séptima se termina
    if (id === 92) {
      if (!supervivencia() || sup.comida >= 20) return false;
      var mc = Mundo.meta(h.x, h.y, h.z);
      sup.comida = Math.min(20, sup.comida + 2); sup.saturacion = Math.min(sup.comida, sup.saturacion + 0.4);
      ponerBloque(h.x, h.y, h.z, mc >= 6 ? 0 : 92, mc >= 6 ? 0 : mc + 1);
      Sonido.tocar('random.burp', 0.5, Math.random() * 0.1 + 0.9);
      I.sucio();
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

  function poner(fx, fy, deMouse) {
    var it = I.juego.barra[I.juego.elegido];
    // montado en el cerdo con la zanahoria con palo: el impulso (boostable), que gasta el palo
    if (montado) {
      var bo = montado.e.c['minecraft:boostable'];
      if (bo && it && manejaConCosa(montado.e) && !(montado.impulso > 0)) {
        var bi = [].concat(bo.boost_items || [])[0] || {};
        montado.impulso = Math.round((bo.duration || 3) * 20);
        B.sonar(montado.e, 'boost', 1, 'mob.pig.boost');
        if (supervivencia()) {
          var dd = Items.def[it.id];
          it.d = (it.d || 0) + (bi.item_damage || 2);
          if (dd && dd.dur && it.d >= dd.dur) inv.barra[I.juego.elegido] = Inventario.cosa(bi.replaceItem ? Botin.numero(bi.replaceItem) || 346 : 346, 0, 1);
          I.sucio();
        }
      }
      return;
    }
    // con mouse, el botón derecho sobre un bicho interactúa (no pega)
    if (deMouse) { if (interactuarAhora()) return; }
    else if (pegar(fx, fy)) return;
    // lo que se tira (bolas de nieve, huevos, perlas, botellas de experiencia, pociones arrojadizas)
    if (it && Items.def[it.id] && Items.def[it.id].uso === 'tirar') { tirar(it, rayoDesde(fx, fy)); return; }
    // el nenúfar, el balde vacío y la botella apuntan al agua
    var h = tocarBloque(fx, fy, it && (it.id === 111 || it.id === 374 || (it.id === 325 && !it.m)));
    // lo que se usa sin un bloque (ponerse la armadura)
    if (!h) { if (it) usarEnElAire(it); return; }
    if (!J.agachado && usar(h)) return;
    if (!it) return;
    if (usarObjeto(h, it)) return;
    // un huevo: el bicho aparece arriba de la cara tocada
    var bicho = O.bichoDe(it);
    if (bicho) {
      var e = B.crear(bicho, h.x + h.nx + 0.5, h.y + h.ny, h.z + h.nz + 0.5);
      if (e) { e.yaw = J.yaw + Math.PI; golpe(); gastarElegido(); }
      return;
    }
    var id = it.id, m = it.m;
    // un objeto que no es un bloque: las semillas, las puertas, la cama, el balde lleno... ponen su
    // bloque; el resto se usa (ver usarObjeto)
    if (Items.es(id)) {
      var pb = bloqueDeObjeto(it);
      if (!pb) return;
      id = pb[0]; m = pb[1];
    }
    if (id === 111 && !(h.id === 9 || h.id === 8)) return;
    if (aventura()) return;
    // dónde tocó en la cara (para losas y escaleras: mitad de arriba o de abajo)
    var py = cam.y + h.d[1] * h.t, fyCara = Math.min(1, Math.max(0, py - h.y));
    // una losa sobre otra igual: la doble
    var doble = O.losaDoble[id];
    if (doble && h.id === id) {
      var mh = Mundo.meta(h.x, h.y, h.z);
      if ((mh & 7) === (m & 7) && ((h.ny === 1 && !(mh & 8)) || (h.ny === -1 && (mh & 8)))) {
        ponerBloque(h.x, h.y, h.z, doble, m & 7);
        sonar(O.sonidoPoner(id), h.x, h.y, h.z);
        gastarElegido();
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
    gastarElegido();
    cuenta.puestos++;
  }
  function cambiarHorno(h, prendido) {
    var b = Mundo.bloque(h.x, h.y, h.z);
    if (b !== 61 && b !== 62) return;
    ponerBloque(h.x, h.y, h.z, prendido ? 62 : 61, Mundo.meta(h.x, h.y, h.z));
  }
  // en supervivencia lo que se pone (o el huevo que se usa) se gasta
  function gastarElegido() {
    if (!supervivencia()) return;
    Inventario.gastar(inv, I.juego.elegido, 1);
    I.sucio();
  }

  // ------------------------------------------------------------------------------------------
  // Usar objetos (lo que cada uno hace en Item.onItemUse, como la 1.2): el balde, el encendedor y la
  // carga de fuego, la azada, el polvo de hueso, la botella, la armadura; y la cama
  // ------------------------------------------------------------------------------------------
  // lo que hay en la mano pasa a ser otra cosa (el balde lleno a vacío...); en creativo queda igual
  function cambiarEnMano(id, m) {
    if (!supervivencia()) return;
    var it = inv.barra[I.juego.elegido];
    if (it && it.n > 1) { it.n--; var c = Inventario.cosa(id, m || 0, 1); if (Inventario.agregar(inv, c) > 0) tirarObjeto(c); }
    else inv.barra[I.juego.elegido] = Inventario.cosa(id, m || 0, 1);
    I.sucio();
  }
  function desgastarMano(n) {
    if (!supervivencia()) return;
    if (Inventario.desgastar(inv, I.juego.elegido, n || 1)) Sonido.tocar('random.break', 0.8, 0.8 + Math.random() * 0.4);
    I.sucio();
  }
  function usarObjeto(h, it) {
    var id = it.id, d = Items.def[id];
    if (id === 325) return usarBalde(h, it);
    if (id === 259 || id === 385) return prender(h, it);
    if (d && d.herr === 'azada') return arar(h);
    if (id === 351 && it.m === 15) return abonar(h);
    if (id === 374) return llenarBotella(h);
    if (d && d.arm !== undefined) return ponerseArmadura(it);
    return false;
  }
  function usarEnElAire(it) {
    var d = Items.def[it.id];
    if (d && d.arm !== undefined) return ponerseArmadura(it);
    return false;
  }
  // el balde vacío levanta una fuente de agua o de lava; el lleno la vuelca al lado de la cara tocada
  function usarBalde(h, it) {
    if (aventura()) return true;
    if (!it.m) {
      var agua = h.id === 8 || h.id === 9, lava = h.id === 10 || h.id === 11;
      if (!(agua || lava) || (Mundo.meta(h.x, h.y, h.z) & 15) !== 0) return true;
      ponerBloque(h.x, h.y, h.z, 0, 0);
      Sonido.tocar(agua ? 'bucket.fill_water' : 'bucket.fill_lava', 1, 1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      cambiarEnMano(325, agua ? 8 : 10);
      golpe();
      return true;
    }
    if (it.m !== 8 && it.m !== 10) return false;
    var x = h.x, y = h.y, z = h.z;
    if (!O.reemplazable(h.id) || h.id === 51) { x += h.nx; y += h.ny; z += h.nz; }
    var b = Mundo.bloque(x, y, z);
    if (b < 0 || y < 0 || y >= C.ALTO || !O.reemplazable(b)) return true;
    ponerBloque(x, y, z, it.m === 8 ? 9 : 11, 0);
    Sonido.tocar(it.m === 8 ? 'bucket.empty_water' : 'bucket.empty_lava', 1, 1, x + 0.5, y + 0.5, z + 0.5);
    cambiarEnMano(325, 0);
    golpe();
    return true;
  }
  // el encendedor (se gasta) y la carga de fuego (se va): prenden fuego al lado o la TNT
  function prender(h, it) {
    if (aventura()) return true;
    if (h.id === 46) {
      ponerBloque(h.x, h.y, h.z, 0, 0);
      prenderTnt(h.x, h.y, h.z, 80);
    } else {
      var x = h.x + h.nx, y = h.y + h.ny, z = h.z + h.nz;
      if (Mundo.bloque(x, y, z) !== 0) return true;
      ponerBloque(x, y, z, 51, 0);
      Sonido.tocar(it.id === 385 ? 'mob.ghast.fireball' : 'fire.ignite', 1, Math.random() * 0.4 + 0.8, x + 0.5, y + 0.5, z + 0.5);
    }
    if (it.id === 259) desgastarMano(1); else gastarElegido();
    golpe();
    return true;
  }
  // la azada: el pasto, la tierra y el camino se vuelven tierra de cultivo (la tierra gruesa, tierra)
  function arar(h) {
    if (aventura() || h.ny < 0 || Mundo.bloque(h.x, h.y + 1, h.z) !== 0) return false;
    var m = Mundo.meta(h.x, h.y, h.z), nuevo = null;
    if (h.id === 2 || h.id === 198 || (h.id === 3 && m === 0)) nuevo = [60, 0];
    else if (h.id === 3 && m === 1) nuevo = [3, 0];
    if (!nuevo) return false;
    ponerBloque(h.x, h.y, h.z, nuevo[0], nuevo[1]);
    Sonido.tocar('step.gravel', 1, 0.8, h.x + 0.5, h.y + 0.5, h.z + 0.5);
    desgastarMano(1);
    golpe();
    return true;
  }
  // el polvo de hueso (ItemDye.applyBonemeal): los cultivos y los tallos de 2 a 5 pasos, el retoño
  // 45 % de crecer, el pasto echa pasto alto y flores alrededor, el cacao madura, el pasto alto se
  // hace doble y las flores dobles se duplican
  function abonar(h) {
    var id = h.id, m = Mundo.meta(h.x, h.y, h.z), hizo = false;
    function entre(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    if ((id === 59 || id === 141 || id === 142 || id === 244 || id === 104 || id === 105) && (m & 7) < 7) {
      ponerBloque(h.x, h.y, h.z, id, Math.min(7, (m & 7) + entre(2, 5))); hizo = true;
    } else if (id === 6) {
      if (Math.random() < 0.45) {
        if (!(m & 8)) ponerBloque(h.x, h.y, h.z, 6, m | 8);
        else if (trab && partida && partida.local) trab.postMessage({ t: 'arbol', x: h.x, y: h.y, z: h.z, m: m });
      }
      hizo = true;
    } else if (id === 127 && (m >> 2) < 2) { ponerBloque(h.x, h.y, h.z, 127, m + 4); hizo = true; }
    else if (id === 31 && (m === 1 || m === 2) && Mundo.bloque(h.x, h.y + 1, h.z) === 0) {
      ponerBloque(h.x, h.y, h.z, 175, m === 1 ? 2 : 3); ponerBloque(h.x, h.y + 1, h.z, 175, 8); hizo = true;
    } else if (id === 175) {
      var abajo = (m & 8) ? Mundo.meta(h.x, h.y - 1, h.z) & 7 : m & 7;
      if (abajo !== 2 && abajo !== 3) { Tirados.deBloque(Inventario.cosa(175, abajo, 1), h.x, h.y, h.z); hizo = true; }
    } else if (id === 2) {
      // 128 intentos de una caminata al azar sobre el pasto (BlockGrass.grow)
      for (var i = 0; i < 128; i++) {
        var x = h.x, y = h.y + 1, z = h.z, j = 0;
        for (;;) {
          if (j >= i / 16) {
            if (Mundo.bloque(x, y, z) === 0 && Mundo.bloque(x, y - 1, z) === 2) {
              if (Math.random() < 1 / 8) ponerBloque(x, y, z, Math.random() < 0.5 ? 37 : 38, 0);
              else ponerBloque(x, y, z, 31, 1);
            }
            break;
          }
          x += entre(-1, 1); y += Math.floor(entre(-1, 1) * entre(0, 2) / 2); z += entre(-1, 1);
          var ab = Mundo.bloque(x, y - 1, z), aqui = Mundo.bloque(x, y, z);
          if (ab !== 2 || (aqui > 0 && C.SOLIDO[aqui] && C.OPACO[aqui])) break;
          j++;
        }
      }
      hizo = true;
    }
    if (!hizo) return false;
    if (opciones.particulas) Render.chispas(h.x + 0.5, h.y + 0.5, h.z + 0.5, [0.4, 1, 0.4], 15);
    gastarElegido();
    golpe();
    return true;
  }
  // la botella vacía se llena tocando agua
  function llenarBotella(h) {
    if (h.id !== 8 && h.id !== 9) return false;
    Sonido.tocar('bucket.fill_water', 1, 1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
    cambiarEnMano(373, 0);
    golpe();
    return true;
  }
  // la armadura en la mano se pone (si ese lugar está vacío)
  function ponerseArmadura(it) {
    var d = Items.def[it.id];
    if (!d || d.arm === undefined || inv.armadura[d.arm]) return false;
    inv.armadura[d.arm] = Inventario.cosa(it.id, it.m, 1, it.d || 0);
    if (supervivencia()) Inventario.gastar(inv, I.juego.elegido, 1);
    else inv.barra[I.juego.elegido] = it;
    Sonido.tocar('step.cloth', 1, 1);
    golpe();
    I.sucio();
    return true;
  }
  // la otra mitad de la cama (la cabecera está hacia donde mira el meta)
  function otraMitadCama(x, y, z, m) { var d = O.DIR_CAMA[m & 3], s = (m & 8) ? -1 : 1; return [x + d[0] * s, y, z + d[1] * s]; }

  // ------------------------------------------------------------------------------------------
  // Tirar cosas (ItemSnowball, ItemEgg, ItemEnderPearl, ItemExpBottle, ItemSplashPotion): desde los
  // ojos hacia donde se toca; las botellas salen 20° más arriba y más despacio
  // ------------------------------------------------------------------------------------------
  function direccion(d, subir) {
    var yaw = Math.atan2(d[0], -d[2]), pitch = -Math.asin(Math.max(-1, Math.min(1, d[1]))) - subir * Math.PI / 180, cp = Math.cos(pitch);
    return [Math.sin(yaw) * cp, -Math.sin(pitch), -Math.cos(yaw) * cp];
  }
  function tirar(it, d) {
    if (aventura() && it.id !== 384) return;
    var tipo = Items.def[it.id].tira, botella = tipo === 'xp_bottle' || tipo === 'splash_potion';
    var v = tipo === 'xp_bottle' ? 0.7 : tipo === 'splash_potion' ? 0.5 : 1.5, dd = botella ? direccion(d, 20) : d;
    B.lanzar(tipo, cam.x, cam.y - 0.1, cam.z, dd[0], dd[1], dd[2], v,
      { pocion: it.id === 438 || it.id === 441 ? it.m : undefined, persistente: it.id === 441 });
    // (más la velocidad del jugador, como el juego)
    Sonido.tocar('random.bow', 0.5, 0.4 / (Math.random() * 0.4 + 0.8));
    gastarElegido();
    golpe();
  }
  // el arco (ItemBow): la fuerza sale de cuánto se tensó (f = t/20 s; (f² + 2f)/3, hasta 1); la
  // flecha va a 3 × f bloques por paso, crítica si está tenso del todo; gasta una flecha (en
  // creativo no) y 1 de durabilidad
  var arco = null;
  function arcoEnMano() { var it = I.juego.barra[I.juego.elegido]; return !!(it && it.id === 261) && !muerto; }
  function buscarFlecha() {
    var l = [inv.barra, inv.mochila];
    for (var k = 0; k < 2; k++) for (var i = 0; i < l[k].length; i++) if (l[k][i] && l[k][i].id === 262) return [l[k], i];
    return null;
  }
  function puedeTirarFlecha() { return !supervivencia() || !!buscarFlecha(); }
  function fuerzaArco(ahora) {
    var f = Math.max(0, ahora - arco.t0) / 1000;
    f = (f * f + f * 2) / 3;
    return Math.min(1, f);
  }
  function soltarArco(ahora) {
    var a = arco, f = fuerzaArco(ahora);
    arco = null; estadoMano.arco = 0;
    if (f < 0.1 || !a.dedo || !arcoEnMano() || I.pantalla !== 'juego') return;
    var fl = supervivencia() ? buscarFlecha() : null;
    if (supervivencia() && !fl) return;
    var d = rayoDesde(a.dedo[0], a.dedo[1]);
    B.lanzar('arrow', cam.x, cam.y - 0.1, cam.z, d[0], d[1], d[2], f * 3, { critico: f >= 1, recoger: supervivencia() });
    Sonido.tocar('random.bow', 1, 1 / (Math.random() * 0.4 + 1.2) + f * 0.5);
    if (fl) { fl[0][fl[1]].n--; if (fl[0][fl[1]].n <= 0) fl[0][fl[1]] = null; }
    desgastarMano(1);
    golpe();
    I.sucio();
  }
  // lo que avisa bichos.js: la perla (teletransporta y lastima 5), la experiencia de la botella, la
  // poción que cayó cerca, la flecha que se levanta
  B.alPerla = function (x, y, z) {
    if (muerto || !partida) return;
    J.ubicar(x, Math.max(y, Math.floor(y) + 0.01), z);
    caida = 0;
    Sonido.tocar('mob.endermen.portal', 1, 1);
    if (supervivencia()) recibirDano(5, '', null, 'fall');
  };
  B.alExperiencia = function (x, y, z, n) { if (partida && partida.local) Tirados.orbes(x, y, z, n); };
  B.alPocion = function (m, mult, tipo, quien) {
    if (muerto) return;
    var nombre = quien ? (O.nombreBicho ? O.nombreBicho(quien.tipo) : quien.tipo) : '';
    var g = Object.create(ganchosEfectos);
    if (nombre) g.danar = function (n, causa) { recibirDano(n, nombre, null, causa); };
    Efectos.dePocion(sup.efectos, m, tipo, g, mult);
  };
  B.tieneEfecto = function (o, id) { return !o.id && !!Efectos.de(sup.efectos, id); };
  B.alRecogerFlecha = function () {
    if (!partida || !partida.local || Inventario.agregar(inv, Inventario.cosa(262, 0, 1)) > 0) return false;
    Sonido.tocar('random.pop', 0.2, ((Math.random() - Math.random()) * 0.7 + 1) * 2);
    I.sucio();
    return true;
  };
  // las chispas de los impactos: de la poción (su color), blancas del huevo y de la nieve
  B.chispas = function (x, y, z, m) {
    if (!opciones.particulas) return;
    var c = m === -1 ? [1, 1, 0.9] : m === -2 ? [1, 1, 1] : m === 0 ? [0.4, 1, 0.4] : (function () { var k = Efectos.colorPocion(m); return [(k >> 16 & 255) / 255, (k >> 8 & 255) / 255, (k & 255) / 255]; })();
    Render.chispas(x, y, z, c, 20);
  };

  // ------------------------------------------------------------------------------------------
  // Tratar con los bichos (trato.js): el botón de interactuar del juego aparece arriba de la barra
  // cuando se mira (el medio de la pantalla) a un bicho con el que se puede hacer algo con lo que
  // se tiene en la mano; con mouse, el botón derecho
  // ------------------------------------------------------------------------------------------
  var SONIDO_TRATO = { milk: 'mob.cow.milk', shear: 'mob.sheep.shear', saddle: 'mob.horse.leather', armor: 'mob.horse.armor', ignite: 'fire.ignite', eat: 'random.eat' };
  Trato.iniciar({
    gastar: function (n) { if (supervivencia()) { Inventario.gastar(inv, I.juego.elegido, n || 1); I.sucio(); } },
    cambiar: function (id, m) { cambiarEnMano(id, m); },
    desgastar: function (n) { desgastarMano(n); },
    sonar: function (e, ev) { B.sonar(e, ev, 1, SONIDO_TRATO[ev] || null); },
    chispas: function (e, tipo) {
      if (!opciones.particulas) return;
      var c = tipo === 'corazon' ? [1, 0.25, 0.35] : tipo === 'humo' ? [0.45, 0.45, 0.45] : [0.4, 1, 0.4];
      Render.chispas(e.x, e.y + e.alto * 0.9, e.z, c, tipo === 'humo' ? 12 : 7);
    },
    soltar: function (cosas, x, y, z) {
      (cosas || []).forEach(function (c) { Tirados.cosa(c, x, y, z, Math.random() * 0.2 - 0.1, 0.25, Math.random() * 0.2 - 0.1, 10); });
    },
    xp: function (x, y, z, n) { if (partida && partida.local) Tirados.orbes(x, y, z, n); },
    nombre: function () { return opciones.nombre || 'Steve'; },
    agachado: function () { return J.agachado; },
    montar: function (e, tm) { montar(e, tm); },
    comerciar: function (e, t) { abrirComercio(e, t); }
  });
  B.corazones = function (e) { if (opciones.particulas) Render.chispas(e.x, e.y + e.alto + 0.2, e.z, [1, 0.25, 0.35], 2); };
  B.ponerHuevo = function (e, nombre) {
    var id = Botin.numero(nombre);
    if (id !== undefined && partida && partida.local) Tirados.cosa(Inventario.cosa(id, 0, 1), e.x, e.y + 0.2, e.z, 0, 0.1, 0, 10);
  };
  function buscarInteraccion() {
    var antes = I.juego.interaccion, op = null, m = null;
    if (partida && partida.local && !muerto && !montado && I.pantalla === 'juego') {
      var d = J.mirada(), h = Mundo.rayo(cam.x, cam.y, cam.z, d[0], d[1], d[2], 4, false), tb = h ? h.t : 1e9;
      m = B.rayo(cam.x, cam.y, cam.z, d[0], d[1], d[2], Math.min(3.5, tb));
      if (m && !m.remoto) op = Trato.opcion(m.e, I.juego.barra[I.juego.elegido], { x: J.x, y: J.y, z: J.z, creativo: !!partida.creativo });
    }
    I.juego.interaccion = op ? { texto: Jui.t(op.texto), hacer: op.hacer, e: m.e } : null;
    if (!antes !== !I.juego.interaccion || (antes && I.juego.interaccion && antes.texto !== I.juego.interaccion.texto)) {
      I.sucio();
      // el nombre de lo elegido sube para dejarle lugar al botón
      if (hudPan && I.juego.nombreItem && performance.now() < I.juego.nombreHasta) hudPan.nombre(I.juego.nombreItem, !I.juego.conVida, !!I.juego.interaccion);
    }
  }
  function interactuarAhora() {
    var x = I.juego.interaccion;
    if (!x) return false;
    x.hacer();
    golpe();
    I.juego.interaccion = null;
    buscarInteraccion();
    I.sucio();
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // Montar (rideable): el jugador va en el asiento del bicho. Con "input_ground_controlled" (el
  // caballo ensillado) se maneja con la cruceta y salta cargando el salto; con "item_controllable"
  // (el cerdo ensillado) va adonde se mira si se tiene la zanahoria con palo (y tocando, el
  // impulso de "boostable"); si no, el bicho anda solo. Agacharse baja. El caballo sin domar
  // (tamemount) a veces se deja según su temple y si no tira al jugador (EntityAIRunAroundLikeCrazy)
  // ------------------------------------------------------------------------------------------
  var montado = null;
  function abrirComercio(e, t) { if (window.Comercio) Comercio.abrir(e, t); }
  function montar(e, tm) {
    if (montado || !e || e.muerte > 0) return;
    montado = { e: e, domando: tm && !e.domado ? tm : null, carga: 0, cargando: false, impulso: 0 };
    e.jinete = true; e.persiste = true; e.objetivo = null;
    J.volando = false; I.juego.volando = false; caida = 0;
    B.sonar(e, 'saddle', 0.5, null);
    ponerEnAsiento(true);
    I.sucio();
  }
  function bajar() {
    if (!montado) return;
    var e = montado.e;
    e.jinete = false; e.control = null;
    montado = null;
    // al costado del bicho, donde haya lugar
    var a = e.yaw + Math.PI / 2, r = e.ancho / 2 + 0.6;
    var x = e.x + Math.sin(a) * r, z = e.z - Math.cos(a) * r, y = e.y + 0.1;
    var b0 = Mundo.bloque(Math.floor(x), Math.floor(y), Math.floor(z)), b1 = Mundo.bloque(Math.floor(x), Math.floor(y + 1), Math.floor(z));
    if ((b0 > 0 && C.SOLIDO[b0]) || (b1 > 0 && C.SOLIDO[b1])) { x = e.x; z = e.z; y = e.y + e.alto; }
    J.ubicar(x, y, z);
    caida = 0;
    I.sucio();
  }
  // el asiento (seats.position: en el marco del bicho, z hacia adelante); los pies del jugador
  // quedan 0,35 abajo (como Entity.getYOffset del jugador)
  function ponerEnAsiento(salto) {
    var e = montado.e, r = e.c['minecraft:rideable'], st = r && r.seats ? (Array.isArray(r.seats) ? r.seats[0] : r.seats) : null;
    var p = st && st.position ? st.position : [0, e.alto * 0.75, 0], sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
    var x = e.x + p[0] * cy + p[2] * sy, y = e.y + p[1] * (e.escala || 1) - 0.35, z = e.z + p[0] * sy - p[2] * cy;
    if (salto) { J.px = J.x = x; J.py = J.y = y; J.pz = J.z = z; }
    else { J.px = J.x; J.py = J.y; J.pz = J.z; J.x = x; J.y = y; J.z = z; }
    J.vx = J.vy = J.vz = 0; J.enPiso = true;
  }
  function manejaConCosa(e) {
    var ic = e.c['minecraft:item_controllable'], it = I.juego.barra[I.juego.elegido];
    return !!(ic && it && [].concat(ic.control_items || []).some(function (x) { return Items.coincide(x, it); }));
  }
  function pasoMontado() {
    var e = montado.e, c = I.control;
    if (e.muerte > 0 || !B.todos().includes(e)) { bajar(); return; }
    if (c.agachar && I.pantalla === 'juego') { I.control.agachar = false; I.control.agacharTactil = false; bajar(); return; }
    var maneja = e.c['minecraft:input_ground_controlled'], conCosa = manejaConCosa(e);
    if (maneja || conCosa) {
      var ctrl = e.control || (e.control = {});
      ctrl.yaw = J.yaw; ctrl.pitch = J.pitch;
      ctrl.adelante = conCosa ? 1 : (I.pantalla === 'juego' ? c.adelante : 0); ctrl.costado = conCosa ? 0 : (I.pantalla === 'juego' ? c.costado : 0);
      // el impulso de la zanahoria (boostable): el doble de rápido 3 s
      ctrl.vel = conCosa ? (montado.impulso > 0 ? 2 : 1) * 0.9 : 1.2;
      if (montado.impulso > 0) montado.impulso--;
      // el salto del caballo: mantener carga (hasta 1 s), soltar salta (horse.jump_strength)
      if (e.c['minecraft:can_power_jump']) {
        if (c.saltar && I.pantalla === 'juego') { montado.cargando = true; montado.carga = Math.min(1, montado.carga + 0.05); }
        else if (montado.cargando) {
          var js = e.c['minecraft:horse.jump_strength'], fuerza = js ? (typeof js.value === 'number' ? js.value : e.fuerzaSalto || (e.fuerzaSalto = js.value.range_min + Math.random() * (js.value.range_max - js.value.range_min))) : 0.5;
          ctrl.salto = fuerza * (0.4 + 0.6 * montado.carga) * 1.2; ctrl.impulso = 0.4 * montado.carga;
          montado.cargando = false; montado.carga = 0;
          B.sonar(e, 'jump', 0.4, null);
        }
      } else if (c.saltar && e.enPiso) ctrl.salto = 0.5;
    } else e.control = null;
    // el caballo sin domar: cada tanto se decide (1 en 50 pasos)
    if (montado.domando && Math.random() < 1 / 50) {
      var tm = montado.domando, max = tm.maxTemper || 100;
      if (Math.random() * max < (e.temple || 0)) {
        Conducta.disparar(e, tm.tame_event || 'minecraft:on_tame', null, null);
        e.dueno = opciones.nombre || 'Steve';
        montado.domando = null;
        if (opciones.particulas) Render.chispas(e.x, e.y + e.alto, e.z, [1, 0.25, 0.35], 8);
      } else {
        e.temple = Math.min(max, (e.temple || 0) + 5);
        B.sonar(e, 'mad', 1, null);
        if (opciones.particulas) Render.chispas(e.x, e.y + e.alto, e.z, [0.45, 0.45, 0.45], 10);
        bajar();
        return;
      }
    }
    ponerEnAsiento(false);
  }

  // ------------------------------------------------------------------------------------------
  // Dormir (EntityPlayer.trySleep): sólo de noche (o con tormenta), cerca, sin monstruos a 8 bloques;
  // queda como punto de aparición. A los 100 pasos dormido se hace de día y para la lluvia
  // ------------------------------------------------------------------------------------------
  var durmiendo = null;
  function aviso(texto) { if (hudPan && hudPan.aviso) hudPan.aviso(texto); else chat(texto); }
  function usarCama(h) {
    var m = Mundo.meta(h.x, h.y, h.z), x = h.x, z = h.z;
    // la cabecera
    if (!(m & 8)) { var o = otraMitadCama(h.x, h.y, h.z, m); if (Mundo.bloque(o[0], o[1], o[2]) === 26) { x = o[0]; z = o[2]; } }
    var t = ((Math.floor(partida.tiempo) % 24000) + 24000) % 24000, tormenta = partida.clima === 'thunder';
    if (!partida.local || (!tormenta && (t < 12541 || t > 23458))) { aviso(I.t('tile.bed.noSleep', 'You can only sleep at night')); return true; }
    if (Math.abs(J.x - (x + 0.5)) > 3 || Math.abs(J.y - h.y) > 2 || Math.abs(J.z - (z + 0.5)) > 3) { aviso(I.t('tile.bed.tooFar', 'Bed is too far away')); return true; }
    var hay = B.todos().some(function (e) {
      var T = B.TIPOS[e.tipo];
      return T && T.hostil && !(e.muerte > 0) && Math.abs(e.x - (x + 0.5)) <= 8 && Math.abs(e.y - h.y) <= 5 && Math.abs(e.z - (z + 0.5)) <= 8;
    });
    if (hay) { aviso(I.t('tile.bed.notSafe', 'You may not rest now, there are monsters nearby')); return true; }
    durmiendo = { x: x, y: h.y, z: z, dir: m & 3, t: 0 };
    // la cama es el punto de aparición de acá en más
    partida.cama = [x, h.y, z];
    J.ubicar(x + 0.5, h.y + 0.5625, z + 0.5);
    J.yaw = Math.atan2(-O.DIR_CAMA[m & 3][0], O.DIR_CAMA[m & 3][1]); J.pitch = -0.35;
    abrirPantalla('cama');
    return true;
  }
  // levantarse: al lado de la cama (BlockBed.getSafeExitLocation)
  function despertar(dia) {
    if (!durmiendo) return;
    var c = durmiendo;
    durmiendo = null; I.juego.oscuro = 0;
    if (dia) {
      partida.tiempo = Math.floor(partida.tiempo / 24000) * 24000 + 24000;
      partida.clima = 'clear';
    }
    var lugar = salidaCama(c.x, c.y, c.z) || [c.x + 0.5, c.y + 0.6, c.z + 0.5];
    J.ubicar(lugar[0], lugar[1], lugar[2]);
    if (I.pantalla === 'jui' && Pantallas.nombre() === 'cama') { Pantallas.vaciar(); I.ir('juego'); }
    I.sucio();
  }
  function salidaCama(x, y, z) {
    for (var r = 1; r <= 2; r++) for (var dx = -r; dx <= r; dx++) for (var dz = -r; dz <= r; dz++) {
      var b0 = Mundo.bloque(x + dx, y - 1, z + dz), b1 = Mundo.bloque(x + dx, y, z + dz), b2 = Mundo.bloque(x + dx, y + 1, z + dz);
      if (b0 > 0 && C.SOLIDO[b0] && !(b1 > 0 && C.SOLIDO[b1]) && !(b2 > 0 && C.SOLIDO[b2]) && b1 !== 26) return [x + dx + 0.5, y, z + dz + 0.5];
    }
    return null;
  }
  function pasoDormir() {
    if (!durmiendo) return;
    var c = durmiendo;
    J.ubicar(c.x + 0.5, c.y + 0.5625, c.z + 0.5);
    c.t++;
    // la pantalla se oscurece de a poco (GuiIngame: hasta 220/255 a los 100 pasos)
    I.juego.oscuro = Math.min(1, c.t / 100) * 0.86;
    if (Mundo.bloque(c.x, c.y, c.z) !== 26) { despertar(false); return; }
    if (c.t >= 100) despertar(true);
  }

  // el bloque que pone un objeto ([id, meta]) o null: las semillas (y la papa y la zanahoria) su
  // cultivo, según items.json; el balde de agua o de lava, el líquido; las puertas, la cama, la
  // torta... el suyo
  var porNombre = null;
  function bloquePorNombre(n) {
    if (!porNombre) { porNombre = {}; C.bloques.forEach(function (b) { if (b.existe) porNombre[b.nombre] = b.id; }); }
    return porNombre[n];
  }
  function bloqueDeObjeto(it) {
    var s = Items.semilla(it.id);
    if (s) { var b = bloquePorNombre(s.crop_result); return b ? [b, 0] : null; }
    if (it.id === 325) return it.m === 8 ? [9, 0] : it.m === 10 ? [11, 0] : null;
    var d = Items.def[it.id];
    return d && d.pone && C.FORMA[d.pone] !== C.F.nada ? [d.pone, 0] : null;
  }

  // supervivencia: se mina de a poco y lo roto suelta lo suyo (en creativo y en los servidores, no)
  function supervivencia() { return !!(partida && !partida.creativo); }
  function soltarBloque(id, m, x, y, z, item) {
    if (!supervivencia() || partida.soltarBloques === false) return;
    var s = Minar.suelta(id, m, item);
    s.cosas.forEach(function (c) { Tirados.deBloque({ id: c[0], m: c[1], n: c[2] }, x, y, z); });
    if (s.xp > 0) Tirados.orbes(x + 0.5, y + 0.5, z + 0.5, s.xp);
  }
  function soltarMundo(id, m, x, y, z) {
    if (!partida || !partida.local || partida.soltarBloques === false) return;
    var s2 = Minar.suelta(id, m, null);
    s2.cosas.forEach(function (c) { Tirados.deBloque({ id: c[0], m: c[1], n: c[2] }, x, y, z); });
  }
  function romper(h, item) {
    var id = h.id, m = Mundo.meta(h.x, h.y, h.z);
    ponerBloque(h.x, h.y, h.z, 0, 0);
    soltarBloque(id, m, h.x, h.y, h.z, item);
    // lo que tenía adentro (un cofre, un horno) se cae
    if (partida && partida.local) Contenedores.quitar(h.x, h.y, h.z).forEach(function (c) { Tirados.deBloque(c, h.x, h.y, h.z); });
    if (supervivencia()) {
      // el hielo deja agua si abajo hay algo (BlockIce); la piedra con un pez plateado lo suelta
      if (Minar.dejaAgua(id) && Mundo.bloque(h.x, h.y - 1, h.z) !== 0) ponerBloque(h.x, h.y, h.z, 8, 0);
      if (id === 97) B.crear('silverfish', h.x + 0.5, h.y, h.z + 0.5);
    }
    // las cosas de dos bloques se van enteras (la puerta suelta su objeto una vez: el de la mitad
    // de abajo)
    if (C.FORMA[id] === C.F.puerta || id === 175) {
      var otro = (m & 8) ? h.y - 1 : h.y + 1;
      if (Mundo.bloque(h.x, otro, h.z) === id) {
        if (m & 8) soltarBloque(id, Mundo.meta(h.x, otro, h.z), h.x, otro, h.z, item);
        ponerBloque(h.x, otro, h.z, 0, 0);
      }
    }
    if (id === 26) {
      var oc = otraMitadCama(h.x, h.y, h.z, m);
      if (Mundo.bloque(oc[0], oc[1], oc[2]) === 26) {
        if (m & 8) soltarBloque(26, Mundo.meta(oc[0], oc[1], oc[2]), oc[0], oc[1], oc[2], item);
        ponerBloque(oc[0], oc[1], oc[2], 0, 0);
      }
    }
    // lo que estaba apoyado arriba (plantas, antorchas paradas, nieve fina, puertas) se cae
    var a = Mundo.bloque(h.x, h.y + 1, h.z);
    if (a > 0) {
      var ma = Mundo.meta(h.x, h.y + 1, h.z);
      if (O.necesitaSuelo(a) || (C.FORMA[a] === C.F.antorcha && (ma === 5 || ma === 0)) || a === 78 || a === 171 ||
          (C.FORMA[a] === C.F.puerta && !(ma & 8)) || C.FORMA[a] === C.F.riel) {
        soltarBloque(a, ma, h.x, h.y + 1, h.z, null);
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
  // minar en supervivencia (PlayerControllerMP.onPlayerDamageBlock): lo que avanza cada paso depende
  // de la dureza y de lo que se tiene en la mano; cada 4 pasos suena el golpe; al romperlo, 5 pasos
  // de espera hasta el siguiente
  var minando = null, esperaMinar = 0;
  function minarPaso(h, ahora) {
    var it = I.juego.barra[I.juego.elegido];
    if (!minando || minando.x !== h.x || minando.y !== h.y || minando.z !== h.z || minando.id !== h.id) {
      minando = { x: h.x, y: h.y, z: h.z, id: h.id, prog: 0, ultimo: ahora, sonido: 0 };
    }
    var dt = Math.min(250, ahora - minando.ultimo);
    minando.ultimo = ahora;
    if (ahora < esperaMinar) return;
    var av = Minar.avance(h.id, it, { bajoAgua: J.cabezaEnAgua && !Efectos.de(sup.efectos, 13), enAire: !J.enPiso && !J.volando && !J.enAgua,
      prisa: Efectos.nivel(sup.efectos, 3), fatiga: Efectos.nivel(sup.efectos, 4) });
    if (av <= 0) return;
    minando.prog += av >= 1 ? 1 : av * dt / 50;
    if (ahora - minando.sonido >= 200) {
      minando.sonido = ahora;
      var sg = O.sonidoGolpe(h.id);
      if (sg) Sonido.tocar(sg[0], sg[1], sg[2], h.x + 0.5, h.y + 0.5, h.z + 0.5);
    }
    if (golpeDesde < 0) golpe();
    mundo.rompiendo = Math.min(0.999, minando.prog);
    if (minando.prog < 1) return;
    romper(h, it);
    // la herramienta se gasta (y se rompe) y minar cansa
    var gasto = Minar.desgaste(h.id, it);
    if (gasto && Inventario.desgastar(inv, I.juego.elegido, gasto)) Sonido.tocar('random.break', 0.8, 0.8 + Math.random() * 0.4);
    Supervivencia.cansar(sup, 0.005);
    minando = null; esperaMinar = ahora + 250;
    mundo.apuntado = null; mundo.rompiendo = 0;
    I.sucio();
  }
  // comer: manteniendo el dedo con comida en la mano (si hay hambre, o siempre con lo que se puede
  // comer siempre), los pasos de items.json ("use_duration"); suena cada 4 pasos y al terminar suma la
  // comida y la saturación (y deja el tazón del guiso)
  var comiendo = null;
  // lo que se come aunque no haya hambre (el juego los marca "always edible")
  var SIEMPRE = { 322: 1, 466: 1, 432: 1 };
  function comidaEnMano() {
    var it = I.juego.barra[I.juego.elegido];
    if (!it || muerto) return null;
    // las pociones y la leche se toman también en creativo (y sin gastarse)
    if (it.id === 373) return { f: { nutrition: 0 }, t: 32, bebida: 'pocion' };
    if (it.id === 325 && it.m === 1) return { f: { nutrition: 0 }, t: 32, bebida: 'leche' };
    var cm = Items.comida(it.id);
    if (!cm || !supervivencia()) return null;
    if (sup.comida >= 20 && !cm.f.can_always_eat && !SIEMPRE[it.id]) return null;
    return cm;
  }
  // lo que queda en la mano después de comer o tomar (el tazón, la botella, el balde)
  function dejarEnMano(id, m) {
    var cosa = Inventario.cosa(id, m || 0, 1);
    if (!inv.barra[I.juego.elegido]) inv.barra[I.juego.elegido] = cosa;
    else if (Inventario.agregar(inv, cosa) > 0) tirarObjeto(cosa);
  }
  function comerPaso(cm, ahora) {
    var it = I.juego.barra[I.juego.elegido], clave = it.id + ':' + it.m;
    if (!comiendo || comiendo.clave !== clave) comiendo = { clave: clave, t0: ahora, total: cm.t * 50, sonido: 0 };
    var t = ahora - comiendo.t0;
    estadoMano.comer = { quedan: Math.max(0, (comiendo.total - t) / 50), total: cm.t, tomar: !!cm.bebida };
    if (t > 350 && ahora - comiendo.sonido >= 200) {
      comiendo.sonido = ahora;
      if (cm.bebida) Sonido.tocar('random.drink', 0.5, Math.random() * 0.1 + 0.9);
      else Sonido.tocar('random.eat', 0.5 + 0.5 * Math.round(Math.random()), (Math.random() - Math.random()) * 0.2 + 1);
    }
    if (t < comiendo.total) return;
    var gasta = supervivencia();
    if (cm.bebida === 'pocion') {
      Efectos.dePocion(sup.efectos, it.m, 'potion', ganchosEfectos);
      if (gasta) { Inventario.gastar(inv, I.juego.elegido, 1); dejarEnMano(374, 0); }
    } else if (cm.bebida === 'leche') {
      // la leche saca todos los efectos (y deja el balde vacío)
      Efectos.limpiar(sup.efectos); sup.absorcion = 0;
      if (gasta) { Inventario.gastar(inv, I.juego.elegido, 1); dejarEnMano(325, 0); }
    } else {
      Supervivencia.comer(sup, cm.f);
      // los efectos de la comida (items.json: manzanas doradas, pescado globo, carne podrida...)
      Efectos.deComida(sup.efectos, cm.f.effects, ganchosEfectos);
      if (it.id === 432) teletransportarAlAzar();
      Sonido.tocar('random.burp', 0.5, Math.random() * 0.1 + 0.9);
      var queda = cm.f.using_converts_to ? Botin.numero(cm.f.using_converts_to) : undefined;
      Inventario.gastar(inv, I.juego.elegido, 1);
      if (queda !== undefined) dejarEnMano(queda, 0);
    }
    comiendo = null; estadoMano.comer = null;
    I.sucio();
  }
  // la fruta del coro (ItemChorusFruit): hasta 16 intentos de un lugar al azar a 8 bloques con piso
  function teletransportarAlAzar() {
    for (var k = 0; k < 16; k++) {
      var x = J.x + (Math.random() - 0.5) * 16, z = J.z + (Math.random() - 0.5) * 16;
      var y = Math.max(1, Math.min(C.ALTO - 2, Math.floor(J.y + Math.floor(Math.random() * 16) - 8)));
      for (; y > 1 && !C.SOLIDO[Mundo.bloque(Math.floor(x), y - 1, Math.floor(z))]; y--) { /* bajar hasta el piso */ }
      var X = Math.floor(x), Z = Math.floor(z), a = Mundo.bloque(X, y, Z), b = Mundo.bloque(X, y + 1, Z);
      if (C.SOLIDO[Mundo.bloque(X, y - 1, Z)] && !(a > 0 && C.SOLIDO[a]) && !(b > 0 && C.SOLIDO[b]) && a !== 10 && a !== 11) {
        Sonido.tocar('mob.endermen.portal', 1, 1, J.x, J.y, J.z);
        J.ubicar(X + 0.5, y, Z + 0.5);
        caida = 0;
        Sonido.tocar('mob.endermen.portal', 1, 1);
        return true;
      }
    }
    return false;
  }
  // en creativo con una espada en la mano no se rompe (como el juego)
  function espadaEnMano() { var it = I.juego.barra[I.juego.elegido], d = it && Items.def[it.id]; return !!(d && d.herr === 'espada'); }

  // romper en creativo: al instante y, con el dedo quieto, uno cada 0,25 s (como el juego)
  var proximoRomper = 0, hayObjetivo = false, proximoPegar = 0;
  // el anillo del dedo: se llena en los 0,3 s de mantener (aparece pasados 0,12 para no molestar en
  // los toques) y, rompiendo, se vuelve a llenar en los 0,25 s hasta el bloque siguiente
  function anillo(t) {
    var d = I.pantalla === 'juego' ? I.dedoMundo() : null, a = null;
    if (d) {
      if (!d.rompiendo) { var q = t - d.t0; if (q > 120) a = { x: d.x, y: d.y, p: q / 300 }; }
      else if (hayObjetivo) a = { x: d.x, y: d.y, p: supervivencia() ? (minando ? minando.prog : 0) : proximoRomper ? 1 - Math.max(0, proximoRomper - t) / 250 : 0 };
    }
    var antes = I.juego.anillo;
    I.juego.anillo = a;
    if (!a !== !antes) I.sucio();
  }
  function interactuar(ahora) {
    var c = I.control;
    if (c.toque) {
      var t = c.toque; c.toque = null;
      if (I.pantalla === 'juego') poner(t[0], t[1], t[2] === 'mouse');
    }
    mundo.apuntado = null; mundo.rompiendo = 0; hayObjetivo = false;
    // el arco: mantener lo tensa, soltar dispara (hacia el último lugar del dedo)
    if (arco && (!c.rompiendo || I.pantalla !== 'juego' || !arcoEnMano())) { soltarArco(ahora); }
    if (c.rompiendo && I.pantalla === 'juego' && arcoEnMano() && (arco || puedeTirarFlecha())) {
      if (!arco) arco = { t0: ahora };
      arco.dedo = c.rompiendo.slice();
      minando = null;
      return;
    }
    if (c.rompiendo && I.pantalla === 'juego') {
      // con comida en la mano (y hambre) se come en vez de romper
      var cm = comidaEnMano();
      if (cm) { minando = null; comerPaso(cm, ahora); return; }
      comiendo = null; estadoMano.comer = null;
      // manteniendo sobre un bicho o un jugador: le pega cada medio segundo
      if (ahora >= proximoPegar && pegar(c.rompiendo[0], c.rompiendo[1])) { proximoPegar = ahora + 500; return; }
      var h = tocarBloque(c.rompiendo[0], c.rompiendo[1], false);
      if (h) {
        hayObjetivo = true;
        mundo.apuntado = h;
        if (aventura()) { /* nada */ }
        else if (supervivencia()) minarPaso(h, ahora);
        else if (ahora >= proximoRomper && !espadaEnMano()) { romper(h); proximoRomper = ahora + 250; mundo.apuntado = null; }
      } else minando = null;
    } else {
      proximoRomper = 0; minando = null; comiendo = null; estadoMano.comer = null;
      // con mouse: el contorno del bloque de la mira
      if (I.conMouse && I.pantalla === 'juego') mundo.apuntado = tocarBloque(0.5, 0.5, false);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Los bichos: sonidos, golpes, explosiones, la luz y aparecer
  // ------------------------------------------------------------------------------------------
  B.alCrear = function (e) { Sonido.precargarEventos(B.eventosDe(e.tipo)); };
  B.sonido = function (ev, e, vol, tono) { Sonido.tocar(ev, vol, tono || 0.8 + Math.random() * 0.4, e.x, e.y + 0.5, e.z); };
  // lo que cambian los bichos en el mundo (la oveja que come pasto, el enderman que se lleva bloques)
  B.ponerBloque = function (x, y, z, id, m) {
    if (Mundo.poner(x, y, z, id, m) && partida && !partida.local) Red.bloques([x, y, z, id, m]);
  };
  B.alMorir = function (e, porJugador) {
    if (opciones.particulas) Render.romper(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z), 80, 0);
    // el botín de su tabla (minecraft:loot) en los mundos propios (las crías no sueltan nada) y la
    // experiencia si el jugador le pegó hace poco (EntityLivingBase.onDeath)
    if (!partida || !partida.local || e.bebe) return;
    var tabla = e.c && e.c['minecraft:loot'] && e.c['minecraft:loot'].table;
    if (tabla && partida.botinBichos !== false) {
      Botin.tirar(tabla, { jugador: porJugador, fuego: e.quema > 0, dificultad: B.dificultad, color: e.tipo === 'sheep' ? e.colorLana || 0 : e.variante || 0 }).forEach(function (c) {
        Tirados.cosa(c, e.x, e.y + 0.5, e.z, Math.random() * 0.2 - 0.1, 0.2, Math.random() * 0.2 - 0.1, 10);
      });
    }
    if (porJugador && !partida.creativo) {
      var t = B.TIPOS[e.tipo], xp = Botin.experiencia(e.tipo, t && t.hostil, e.bebe, B.tamSlime(e));
      if (xp > 0) Tirados.orbes(e.x, e.y + 0.5, e.z, xp);
    }
  };
  B.golpear = function (obj, dano, e, causa) {
    var dx = obj.x - e.x, dz = obj.z - e.z, l = Math.sqrt(dx * dx + dz * dz) || 1, kx = dx / l * 0.4, kz = dz / l * 0.4;
    var nombre = O.nombreBicho ? O.nombreBicho(e.tipo) : I.t('entity.' + e.tipo + '.name', e.tipo);
    if (obj.id) Red.accion({ type: 'hit_player', targetId: obj.id, dmg: dano, byName: nombre, kx: +kx.toFixed(3), kz: +kz.toFixed(3) });
    else {
      var antes = sup.vida;
      recibirDano(dano, nombre, [kx, kz], causa || 'mob');
      if (sup.vida < antes) B.duenoHerido(e);
      // lo que el ataque contagia ("effect_name" de minecraft:attack: veneno de la araña de cueva,
      // hambre del husk, wither del esqueleto wither) si el golpe entró
      var ea = causa !== 'projectile' && e.efectoAtaque;
      if (ea && ea.dur > 0 && sup.vida < antes && !muerto && I.juego.conVida) darEfecto(Efectos.id(ea.nombre), ea.dur * 20, 0);
    }
  };
  B.explosion = function (x, y, z, r, jug, quien, fuego) {
    Sonido.tocar('random.explode', 1, 0.9 + Math.random() * 0.2, x, y, z);
    var nombreQ = quien && quien.tipo ? I.t('entity.' + quien.tipo + '.name', quien.tipo) : quien && quien.tnt ? I.t('tile.tnt.name', 'TNT') : I.t('entity.creeper.name', 'Creeper');
    for (var k = 0; k < jug.length; k++) {
      var j = jug[k], d = Math.sqrt((j.x - x) * (j.x - x) + (j.y - y) * (j.y - y) + (j.z - z) * (j.z - z)), imp = 1 - d / (r * 2);
      if (imp > 0) {
        var dano = Math.floor((imp * imp + imp) / 2 * 7 * r * 2 + 1), dx = (j.x - x) / (d || 1) * imp, dz = (j.z - z) / (d || 1) * imp;
        if (j.id) Red.accion({ type: 'hit_player', targetId: j.id, dmg: dano, byName: nombreQ, kx: dx, kz: dz });
        else recibirDano(dano, quien ? nombreQ : '', [dx, dz], 'explosion');
      }
    }
    // el pozo (Explosion.doExplosionA): 16×16×16 rayos desde el centro, cada uno con fuerza de
    // poder × (0,7 a 1,3) que se gasta de a 0,3 bloques con la resistencia de lo que cruza; lo que
    // rompe suelta lo suyo 1 de cada "poder" veces y la TNT de alrededor se prende con mecha corta.
    // En un servidor, todos los bloques en un solo mensaje
    var rotos = [], vistos = new Set(), tntCerca = [];
    for (var i = 0; i < 16; i++) for (var j = 0; j < 16; j++) for (var k = 0; k < 16; k++) {
      if (i !== 0 && i !== 15 && j !== 0 && j !== 15 && k !== 0 && k !== 15) continue;
      var dx2 = i / 15 * 2 - 1, dy2 = j / 15 * 2 - 1, dz2 = k / 15 * 2 - 1, l = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
      dx2 /= l; dy2 /= l; dz2 /= l;
      var f = r * (0.7 + Math.random() * 0.6), px = x, py = y, pz = z;
      for (; f > 0; f -= 0.22500001) {
        var X = Math.floor(px), Y = Math.floor(py), Z = Math.floor(pz), b = Mundo.bloque(X, Y, Z);
        if (b < 0) break;
        if (b > 0) f -= (resistencia(b) + 0.3) * 0.3;
        if (f > 0 && b > 0 && Y >= 0 && Y < C.ALTO) {
          var kk = X + ',' + Y + ',' + Z;
          if (!vistos.has(kk)) { vistos.add(kk); rotos.push(X, Y, Z, b, Mundo.meta(X, Y, Z)); }
        }
        px += dx2 * 0.3; py += dy2 * 0.3; pz += dz2 * 0.3;
      }
    }
    var cambios = [];
    for (var q = 0; q < rotos.length; q += 5) {
      var bX = rotos[q], bY = rotos[q + 1], bZ = rotos[q + 2], bb = rotos[q + 3], bm = rotos[q + 4];
      if (bb === 8 || bb === 9 || bb === 10 || bb === 11) continue;
      if (bb === 46 && partida && partida.local) { tntCerca.push([bX, bY, bZ]); Mundo.poner(bX, bY, bZ, 0, 0); cambios.push(bX, bY, bZ, 0, 0); continue; }
      if (Mundo.poner(bX, bY, bZ, 0, 0)) cambios.push(bX, bY, bZ, 0, 0);
      if (partida && partida.local) {
        if (Math.random() < 1 / r && supervivencia()) soltarBloque(bb, bm, bX, bY, bZ, null);
        Contenedores.quitar(bX, bY, bZ).forEach(function (c) { Tirados.deBloque(c, bX, bY, bZ); });
      }
      if (opciones.particulas && Math.random() < 0.3) Render.romper(bX, bY, bZ, bb, 0);
    }
    // la TNT alcanzada se prende con una mecha de 10 a 30 pasos
    tntCerca.forEach(function (t) { prenderTnt(t[0], t[1], t[2], 10 + Math.floor(Math.random() * 20), true); });
    // la bola de fuego del ghast: fuego en un tercio de lo que quedó vacío sobre algo firme
    if (fuego && partida && partida.local) {
      for (q = 0; q < rotos.length; q += 5) {
        var fx = rotos[q], fy = rotos[q + 1], fz = rotos[q + 2], deb = Mundo.bloque(fx, fy - 1, fz);
        if (Mundo.bloque(fx, fy, fz) === 0 && deb > 0 && C.SOLIDO[deb] && C.OPACO[deb] && Math.random() < 1 / 3) { Mundo.poner(fx, fy, fz, 51, 0); cambios.push(fx, fy, fz, 51, 0); }
      }
    }
    if (partida && !partida.local) Red.bloques(cambios);
  };
  // la resistencia a las explosiones (Block.getExplosionResistance: la de setResistance × 3 / 5, o la
  // dureza si es mayor): la piedra y los ladrillos 6, la obsidiana 1200, la roca madre no se rompe
  var RESISTENCIA = { 1: 6, 4: 6, 7: 3600000, 14: 3, 15: 3, 16: 3, 21: 3, 22: 3, 24: 0.8, 41: 6, 42: 6, 43: 6, 44: 6, 45: 6,
    48: 6, 49: 1200, 56: 3, 57: 6, 61: 3.5, 62: 3.5, 67: 6, 73: 3, 74: 3, 87: 0.4, 89: 0.3, 98: 6, 101: 6, 108: 6, 109: 6,
    112: 6, 113: 6, 114: 6, 116: 1200, 120: 3600000, 121: 9, 129: 3, 130: 600, 133: 6, 138: 3, 139: 6, 145: 1200, 152: 6,
    153: 3, 155: 0.8, 156: 0.8, 168: 6, 172: 4.2, 159: 4.2, 179: 0.8, 201: 6, 206: 9, 8: 100, 9: 100, 10: 100, 11: 100,
    5: 3, 53: 3, 85: 3, 134: 3, 135: 3, 136: 3, 157: 3, 158: 3, 163: 3, 164: 3, 17: 2, 162: 2, 54: 2.5, 58: 2.5, 47: 1.5, 46: 0 };
  function resistencia(b) { return RESISTENCIA[b] !== undefined ? RESISTENCIA[b] : Math.max(0, Minar.dureza ? Minar.dureza(b) : 1); }

  // ------------------------------------------------------------------------------------------
  // La TNT prendida (EntityTNTPrimed): salta un poco para un lado, cae, y a los 80 pasos (4 s; la
  // alcanzada por otra explosión, 10 a 30) explota con poder 4
  // ------------------------------------------------------------------------------------------
  var tnts = [];
  function prenderTnt(x, y, z, mecha, sinSonido) {
    if (!partida || !partida.local) return;
    var a = Math.random() * Math.PI * 2;
    tnts.push({ x: x + 0.5, y: y, z: z + 0.5, px: x + 0.5, py: y, pz: z + 0.5, vx: -Math.sin(a) * 0.02, vy: 0.2, vz: -Math.cos(a) * 0.02,
      mecha: mecha || 80, enPiso: false });
    if (!sinSonido) Sonido.tocar('random.fuse', 1, 1, x + 0.5, y + 0.5, z + 0.5);
  }
  function pasoTnt() {
    for (var i = tnts.length - 1; i >= 0; i--) {
      var t = tnts[i];
      t.px = t.x; t.py = t.y; t.pz = t.z;
      t.vy -= 0.04;
      Tirados.mover(t, 0.49, 0.98);
      t.vx *= 0.98; t.vy *= 0.98; t.vz *= 0.98;
      if (t.enPiso) { t.vx *= 0.7; t.vz *= 0.7; t.vy *= -0.5; }
      if (--t.mecha <= 0) {
        tnts.splice(i, 1);
        B.explosionEn(t.x, t.y + 0.49, t.z, 4, false, { tnt: true });
      }
    }
  }
  var pedidoLuces = 0, esperaLuces = null;
  function pedirLuces() {
    if (!trab || esperaLuces) return;
    var dia = luzDelDia();
    var cands = B.candidatos({ x: J.x, y: J.y, z: J.z }, dia, 1 + Red.remotos.size);
    var p = B.posiciones(), jugs = [];
    Red.remotos.forEach(function (j) { jugs.push(j); p.push(Math.floor(j.x), Math.floor(j.y + 1), Math.floor(j.z)); });
    var nb = p.length / 3 - jugs.length;
    cands.forEach(function (c) { p.push(c.x, c.y, c.z); });
    // y la de lo tirado cerca (para dibujarlo con la luz de su lugar)
    var tir = [];
    for (var k = 0; k < Tirados.lista.length && tir.length < 128; k++) {
      var o = Tirados.lista[k];
      if (Math.abs(o.x - J.x) < 48 && Math.abs(o.z - J.z) < 48) { tir.push(o); p.push(Math.floor(o.x), Math.floor(o.y + 0.1), Math.floor(o.z)); }
    }
    esperaLuces = { nb: nb, jugs: jugs, cands: cands.length, tir: tir, id: ++pedidoLuces };
    trab.postMessage({ t: 'luces', p: p, pedido: pedidoLuces });
  }
  function lucesRecibidas(d) {
    var e = esperaLuces;
    esperaLuces = null;
    if (!e || d.pedido !== e.id) return;
    B.ponerLuces(d.v.slice(0, e.nb));
    e.jugs.forEach(function (j, i) { var v = d.v[e.nb + i]; if (v >= 0) j.luz = v; });
    var base = e.nb + e.jugs.length;
    if (partida && B.activo) B.aparecer(d.v.slice(base, base + e.cands), luzDelDia());
    e.tir.forEach(function (o, i) { var v = d.v[base + e.cands + i]; if (v >= 0) o.luz = v; });
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
  // debajo de esto el vacío lastima (el de la 1.2: 40 bloques bajo la roca madre)
  var VACIO = -40, firmaHud = '', golpeTicks = 0, muerteTicks = 0;
  function pasoVida(antesY, antesPiso) {
    if (!J.enPiso && !J.volando && !J.enAgua && J.y < antesY) caida += antesY - J.y;
    if (J.enAgua || J.volando || Mundo.bloque(Math.floor(J.x), Math.floor(J.y), Math.floor(J.z)) === 65 ||
      Mundo.bloque(Math.floor(J.x), Math.floor(J.y), Math.floor(J.z)) === 106) caida = 0;
    // (el salto mejorado achica la caída: un bloque por nivel)
    if (J.enPiso && !antesPiso) {
      var fx0 = Math.floor(J.x), fy0 = Math.floor(J.y - 0.2), fz0 = Math.floor(J.z);
      if (Mundo.bloque(fx0, fy0, fz0) === 60 && caida > 0.5 && Math.random() < caida - 0.5 && !aventura()) {
        var arriba = Mundo.bloque(fx0, fy0 + 1, fz0);
        if (arriba > 0 && O.necesitaSuelo(arriba)) { soltarBloque(arriba, Mundo.meta(fx0, fy0 + 1, fz0), fx0, fy0 + 1, fz0, null); ponerBloque(fx0, fy0 + 1, fz0, 0, 0); }
        ponerBloque(fx0, fy0, fz0, 3, 0);
      }
      var cd = caida - 3 - Efectos.nivel(sup.efectos, 8);
      if (cd > 0.2) recibirDano(Math.ceil(cd), '', null, 'fall');
      caida = 0;
    }
    var X = Math.floor(J.x), Z = Math.floor(J.z), bp = Mundo.bloque(X, Math.floor(J.y + 0.2), Z), bc = Mundo.bloque(X, Math.floor(J.y + 1.62), Z);
    var bm = Mundo.bloque(X, Math.floor(J.y + 0.9), Z);
    var danos = Supervivencia.paso(sup, { tick: pasosLuz, cabezaEnAgua: bc === 8 || bc === 9,
      enAgua: bp === 8 || bp === 9 || bm === 8 || bm === 9, enLava: bp === 10 || bp === 11 || bm === 10 || bm === 11,
      enFuego: bp === 51 || bm === 51, vacio: J.y < VACIO, asfixia: !J.volando && bc > 0 && C.OPACO[bc] === 1 && C.SOLIDO[bc] === 1,
      dificultad: sinHambre ? 'sinHambre' : B.dificultad, regenerar: partida.regenerar !== false,
      respiraBajoAgua: !!Efectos.de(sup.efectos, 13) });
    if (danos) for (var dd = 0; dd < danos.length && !muerto; dd++) recibirDano(danos[dd][0], '', null, danos[dd][1]);
    // el cansancio de moverse (correr 0,1 por bloque, nadar 0,01) y de saltar
    var mx = J.x - antesXZ[0], mz = J.z - antesXZ[1], dist = Math.sqrt(mx * mx + mz * mz);
    if (dist < 2) Supervivencia.cansar(sup, J.enAgua ? 0.01 * dist : J.corriendo ? 0.1 * dist : 0);
    if (antesPiso && !J.enPiso && J.vy > 0.3) Supervivencia.cansar(sup, J.corriendo ? 0.2 : 0.05);
    if (sup.vida !== vida) { vida = sup.vida; I.juego.vida = vida; }
    // el HUD se vuelve a dibujar cuando cambia lo que muestra (y en los pasos en que algo tiembla o
    // titila)
    var pt = I.juego.parpadeoTick || 0;
    var f = sup.vida + '|' + sup.comida + '|' + Math.ceil(sup.aire / 30) + '|' + sup.nivel + '|' + Math.round(sup.progreso * 182) + '|' +
      (sup.vida <= 4 ? pasosLuz : 0) + '|' + (sup.saturacion <= 0 && pasosLuz % (sup.comida * 3 + 1) === 0 ? pasosLuz : 0) + '|' +
      (pt > pasosLuz ? ((pt - pasosLuz) / 3 | 0) % 2 : -1);
    if (f !== firmaHud) { firmaHud = f; I.sucio(); }
  }
  function paso() {
    var c = I.control, e = J.entrada, activo = I.pantalla === 'juego';
    e.adelante = activo ? c.adelante : 0;
    e.costado = activo ? c.costado : 0;
    e.saltar = activo && c.saltar;
    e.subir = activo && c.subir;
    e.bajar = activo && c.bajar;
    J.agachado = activo && c.agachar && !J.volando;
    // no se corre con ceguera ni con 6 de comida o menos (EntityPlayerSP.onLivingUpdate)
    J.corriendo = activo && (c.correr || corriendoTactil) && e.adelante > 0 && !J.agachado && !Efectos.de(sup.efectos, 15) &&
      (!I.juego.conVida || sinHambre || sup.comida > 6);
    var antesY = J.y, antesPiso = J.enPiso;
    caminadoAntes = J.caminado;
    if (!muerto && !montado) J.paso();
    Render.pasoParticulas();
    if (trab && ++pasosLuz % 5 === 0) trab.postMessage({ t: 'luz', x: Math.floor(cam.x), y: Math.floor(cam.y), z: Math.floor(cam.z) });
    if (partida) {
      if (!partida.local) partida.tiempo = (Date.now() / 50) % 24000;      // en los servidores, la misma hora para todos
      else if (partida.siempreDia) partida.tiempo = 6000; else partida.tiempo += 1;
      // el clima (/weather, las opciones de anfitrión): el cielo se nubla y se aclara de a poco
      var meta = partida.clima === 'rain' || partida.clima === 'thunder' ? 1 : 0;
      mundo.lluvia += Math.max(-0.01, Math.min(0.01, meta - (mundo.lluvia || 0)));
    }
    if (I.juego.volando !== J.volando) { I.juego.volando = J.volando; I.sucio(); }
    // la vida: caídas, lo que hay alrededor (agua, lava, fuego, quedar adentro de un bloque, el
    // vacío), el hambre y el cansancio (supervivencia.js). En creativo (un mundo propio) sólo mata el
    // vacío, como en el juego
    if (golpeTicks > 0) golpeTicks--;
    if (muerto) muerteTicks++; else muerteTicks = 0;
    if (!muerto && partida) pasoEfectos();
    if (!muerto && partida) {
      if (I.juego.conVida) pasoVida(antesY, antesPiso);
      else {
        if (sup.invulnerable > 0) sup.invulnerable--;
        if (J.y < VACIO && pasosLuz % 10 === 0) recibirDano(4, '', null, 'outOfWorld');
      }
    }
    antesXZ[0] = J.x; antesXZ[1] = J.z;
    // los pasos suenan cada 1,7 bloques caminados (como el juego), no agachado
    if (J.enPiso && !J.agachado && J.caminado * 0.6 > proximoPaso) {
      proximoPaso = Math.floor(J.caminado * 0.6) + 1;
      var bajo = Mundo.bloque(Math.floor(J.x), Math.floor(J.y - 0.2), Math.floor(J.z));
      if (bajo > 0) { var s = O.sonidoPaso(bajo); if (s) Sonido.tocar(s[0], s[1], s[2]); }
    }
    if (J.enAgua && !antesEnAgua && antesY - J.y > 0.1) Sonido.tocar('random.splash', 0.3, 1 + (Math.random() - Math.random()) * 0.4);
    antesEnAgua = J.enAgua;
    // los bichos
    // (con invisibilidad los monstruos lo ven de más cerca: 7 % de la distancia sin armadura)
    var piezas = inv.armadura.filter(Boolean).length;
    B.nombreLocal = opciones.nombre || 'Steve';
    var jugs = [{ x: J.x, y: J.y, z: J.z, id: null, vivo: !muerto, vis: Efectos.de(sup.efectos, 14) ? 0.7 * Math.max(0.1, piezas / 4) : 1,
      enMano: I.juego.barra[I.juego.elegido] || null }];
    Red.remotos.forEach(function (j) { jugs.push({ x: j.x, y: j.y, z: j.z, id: j.id, vivo: j.hp > 0 }); });
    B.paso(jugs, luzDelDia());
    if (montado) pasoMontado();
    buscarInteraccion();
    // lo tirado en el piso y los orbes (se levantan al pasar)
    Tirados.paso({ x: J.x, y: J.y, z: J.z, vivo: !muerto }, ganchosTirados);
    if (tnts.length) pasoTnt();
    pasoDormir();
    // al trabajador: cuánto le resta la noche a la luz del cielo (World.calculateSkylightSubtracted),
    // la lluvia y la dificultad (para crecer y para el fuego), una vez por segundo
    if (trab && partida && partida.local && pasosLuz % 20 === 0) {
      var ang = Render.anguloSol(((partida.tiempo % 24000) + 24000) % 24000), f1 = 1 - (Math.cos(ang * Math.PI * 2) * 2 + 0.5);
      f1 = 1 - Math.max(0, Math.min(1, f1));
      f1 *= 1 - (mundo.lluvia || 0) * 5 / 16;
      trab.postMessage({ t: 'clima', resta: Math.floor((1 - f1) * 11), lluvia: (mundo.lluvia || 0) > 0.2 && partida.clima !== 'clear',
        dificultad: Math.max(0, DIFICULTADES.indexOf(B.dificultad)) });
    }
    // los hornos cocinan solos (y se prenden y se apagan)
    Contenedores.paso(cambiarHorno);
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
  // resolución automática. La meta es la velocidad elegida (60 o 30 cuadros): si no llega a ~3/4,
  // menos píxeles (de a 15 %, hasta un tercio); si llega, cada tanto prueba con más (hasta los de la
  // pantalla; en los flojos hasta 1,5 por punto) y si con más ya no llega vuelve y espera el doble
  // para volver a probar. Antes sólo bajaba: con el tope de cuadros nunca se veía que sobraba, y una
  // bajada al entrar al mundo (cuando la CPU arma los trozos de alrededor, no por los píxeles) lo
  // dejaba borroso para siempre. Si bajar no mejoró nada (un teléfono que limita a 30 para ahorrar
  // batería), vuelve atrás y deja de probar un rato
  var escalaAuto = 1, ema = 16, ventana = 0, antesDeBajar = 0, intentoFallido = 0;
  var probando = 0, esperaSubir = 8000, ultimoCambio = 0, entradaJuego = 0;
  function resolucionAuto(dt, ahora) {
    if (opciones.resolucion) return;
    ema += (dt * 1000 - ema) * 0.05;
    ventana += dt;
    if (ventana < 2) return;
    ventana = 0;
    if (ahora - entradaJuego < 6000) return;
    var meta = 1000 / (opciones.limite || 60);
    var dp = Math.min(window.devicePixelRatio || 1, debil ? 1.5 : 2);
    var tope = debil ? 1 : Math.max(1, (window.devicePixelRatio || 1) / dp);
    if (probando) {
      if (ema > meta * 1.2) { escalaAuto = probando; esperaSubir = Math.min(esperaSubir * 2, 240000); }
      else esperaSubir = 8000;
      probando = 0; ultimoCambio = ahora;
      return;
    }
    if (antesDeBajar) {
      if (ema > antesDeBajar * 0.92) { escalaAuto = Math.min(tope, escalaAuto / 0.85); intentoFallido = ahora; }
      antesDeBajar = 0; ultimoCambio = ahora;
      return;
    }
    if (ema > meta * 1.35 && escalaAuto > 0.35 && ahora - intentoFallido > 30000) { antesDeBajar = ema; escalaAuto = Math.max(0.35, escalaAuto * 0.85); }
    else if (ema < meta * 1.08 && escalaAuto < tope && ahora - ultimoCambio > esperaSubir) { probando = escalaAuto; escalaAuto = Math.min(tope, escalaAuto / 0.85); }
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
    if (cargando) {
      if (esperandoSuelo) buscarSuelo();
      if (!esperandoSuelo && listoParaEntrar()) { cargando = false; Pantallas.vaciar(); I.ir('juego'); acum = 0; entradaJuego = t; }
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
    var pp = I.pantalla === 'jui' ? Pantallas.nombre() : null;
    var pausado = (pp === 'pausa' || pp === 'ajustesJuego' || pp === 'comoJugar' || pp === 'skins') && partida && partida.local;
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
    // el golpe ladea la cámara hasta 14° y vuelve (sin(f⁴·π)); muriendo se va cayendo de costado
    var fg = golpeTicks > 0 ? Math.max(0, golpeTicks - alfa) / 10 : 0;
    cam.rol = fg > 0 ? -Math.sin(fg * fg * fg * fg * Math.PI) * 14 * Math.PI / 180 : 0;
    if (muerto) cam.rol = (40 - 8000 / (Math.min(20, muerteTicks + alfa) + 200)) * Math.PI / 180;
    // el campo de visión se abre un poco al correr y con la velocidad (y se cierra con la lentitud),
    // como AbstractClientPlayer.getFovModifier
    var fovObj = opciones.fov * Math.PI / 180 * (J.corriendo ? 1.12 : 1) * ((J.velMult || 1) + 1) / 2;
    // tensando el arco se acerca (hasta 15 %)
    if (arco) { var fa = Math.min(1, (t - arco.t0) / 1000); fovObj *= 1 - fa * fa * 0.15; }
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
    // los efectos que se ven: visión nocturna (en los últimos 10 s titila), ceguera (al irse, la
    // niebla se abre en un segundo) y náusea
    var efv = Efectos.de(sup.efectos, 16), efc = Efectos.de(sup.efectos, 15);
    mundo.visionNocturna = efv ? (efv.dur > 200 ? 1 : 0.7 + Math.sin((efv.dur - alfa) * Math.PI * 0.2) * 0.3) : 0;
    mundo.ceguera = efc ? (efc.dur < 20 ? efc.dur / 20 : 1) : 0;
    cam.nausea = nausea; cam.ticks = pasosLuz + alfa;
    var tb = TEMPERATURA[Mundo.bioma(Math.floor(cam.x), Math.floor(cam.z))];
    mundo.temperatura = tb === undefined ? 0.8 : tb;
    // lo que se dibuja además del mundo: los bichos y los otros jugadores (con su nombre arriba)
    var ents = B.paraDibujar(alfa), nombres = [];
    mundo.tirados = Tirados.lista; mundo.alfa = alfa; mundo.tnts = tnts;
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
    // el arco tensándose: sus tres dibujos (bow_pulling) según cuánto (0,65 y 0,9 del segundo)
    if (arco && it && it.id === 261) {
      var tens = Math.min(1, (t - arco.t0) / 1000);
      estadoMano.item = { id: 261, m: tens >= 0.9 ? 102 : tens >= 0.65 ? 101 : 100, n: 1 };
      estadoMano.arco = tens;
    } else estadoMano.arco = 0;
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
    I.juego.nombreHasta = performance.now() + (hudPan ? 2000 : 1500);
    if (hudPan && hudPan.nombre) hudPan.nombre(I.juego.nombreItem, !I.juego.conVida, !!I.juego.interaccion);
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

  // ------------------------------------------------------------------------------------------
  // Comandos del chat: los de la 1.2 que tienen sentido en este port (también los usan las
  // opciones de anfitrión: hora, clima y teletransporte), con los mensajes del juego
  // ------------------------------------------------------------------------------------------
  var HORAS = { sunrise: 23000, day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000 };
  var CLIMAS = { clear: 'commands.weather.clear', rain: 'commands.weather.rain', thunder: 'commands.weather.thunder' };
  function Tc(k, d) { return I.f.apply(null, [I.t(k, d)].concat([].slice.call(arguments, 2))); }
  function coord(v, base) {
    if (v === undefined) return NaN;
    if (v.charAt(0) === '~') return base + (v.length > 1 ? parseFloat(v.slice(1)) : 0);
    return parseFloat(v);
  }
  function comando(texto) {
    var a = texto.replace(/^\//, '').trim().split(/\s+/), c = (a[0] || '').toLowerCase();
    var malo = function () { chat(Tc('commands.generic.syntax', 'Syntax error', '/' + c + ' ', a.slice(1).join(' '), ''), '#ff8080'); };
    if (!partida) return;
    switch (c) {
      case 'time': {
        // en los mundos públicos la hora es la misma para todos (sale del reloj): no se toca
        if (!partida.local) { chat(Tc('commands.generic.disabled', 'Cheats are not enabled'), '#ff8080'); return; }
        var v = (a[2] || '').toLowerCase(), n = HORAS[v] !== undefined ? HORAS[v] : parseInt(v, 10);
        if (a[1] === 'set' && !isNaN(n)) {
          partida.tiempo = Math.floor(partida.tiempo / 24000) * 24000 + (((n % 24000) + 24000) % 24000);
          chat(Tc('commands.time.set', 'Set the time to %1$d', n));
        } else if (a[1] === 'add' && !isNaN(n)) { partida.tiempo += n; chat(Tc('commands.time.added', 'Added %1$d to the time', n)); }
        else if (a[1] === 'query') chat(Tc('commands.time.query.daytime', 'Daytime is %d', Math.floor(partida.tiempo % 24000)));
        else malo();
        return;
      }
      case 'weather': case 'toggledownfall': {
        var w = c === 'toggledownfall' ? (partida.clima && partida.clima !== 'clear' ? 'clear' : 'rain') : (a[1] || '').toLowerCase();
        if (!CLIMAS[w]) { malo(); return; }
        partida.clima = w;
        chat(Tc(CLIMAS[w], w));
        return;
      }
      case 'gamemode': case 'gm': {
        var g = (a[1] || '').toLowerCase(), cre = { c: 1, creative: 1, '1': 1 }[g], supe = { s: 1, survival: 1, '0': 1 }[g];
        if (!cre && !supe) { chat(Tc('commands.gamemode.fail.invalid', 'Invalid game mode %1$s', a[1] || ''), '#ff8080'); return; }
        ponerModo(cre ? 'creativo' : 'supervivencia');
        chat(Tc('commands.gamemode.success.self', 'Set own game mode to %1$s', I.t(cre ? 'createWorldScreen.gameMode.creative' : 'createWorldScreen.gameMode.survival')));
        I.sucio();
        return;
      }
      case 'tp': case 'teleport': {
        if (a.length >= 4) {
          var x = coord(a[1], J.x), y = coord(a[2], J.y), z = coord(a[3], J.z);
          if (isNaN(x) || isNaN(y) || isNaN(z)) { malo(); return; }
          J.ubicar(x, y, z);
          chat(Tc('commands.tp.success.coordinates', 'Teleported %1$s to %2$s, %3$s, %4$s', opciones.nombre, x.toFixed(1), y.toFixed(1), z.toFixed(1)));
          return;
        }
        var quien = null;
        Red.remotos.forEach(function (j) { if (a[1] && j.name.toLowerCase() === a[1].toLowerCase()) quien = j; });
        if (!quien) { chat(Tc('commands.generic.player.notFound', 'That player cannot be found'), '#ff8080'); return; }
        J.ubicar(quien.x, quien.y, quien.z);
        chat(Tc('commands.tp.success', 'Teleported %1$s to %2$s', opciones.nombre, quien.name));
        return;
      }
      case 'kill': if (!muerto) morir(); return;
      case 'seed': chat(Tc('commands.seed.success', 'Seed: %1$s', partida.semilla)); return;
      case 'say': G.enviarChat(a.slice(1).join(' ')); return;
      case 'me': chat('* ' + opciones.nombre + ' ' + a.slice(1).join(' ')); return;
      case 'summon': {
        var tipo = (a[1] || '').replace(/^minecraft:/, '');
        if (!B.TIPOS[tipo]) { chat(Tc('commands.generic.entity.invalidType', 'Invalid entity type %1$s', a[1] || ''), '#ff8080'); return; }
        var sx = coord(a[2], J.x), sy = coord(a[3], J.y), sz = coord(a[4], J.z);
        if (isNaN(sx)) { sx = J.x + Math.sin(J.yaw) * 2; sy = J.y; sz = J.z - Math.cos(J.yaw) * 2; }
        B.crear(tipo, sx, sy, sz);
        chat(Tc('commands.summon.success', 'Object successfully summoned'));
        return;
      }
      case 'effect': {
        // /effect <jugador|@s|@p> <efecto|clear> [segundos] [nivel] (como la 1.2)
        if (!partida.local) { chat(Tc('commands.generic.disabled', 'Cheats are not enabled'), '#ff8080'); return; }
        var ne = (a[2] || '').toLowerCase().replace(/^minecraft:/, '');
        if (ne === 'clear') {
          if (!sup.efectos.lista.length) { chat(Tc('commands.effect.failure.notActive.all', '', opciones.nombre), '#ff8080'); return; }
          Efectos.limpiar(sup.efectos); sup.absorcion = 0; I.sucio();
          chat(Tc('commands.effect.success.removed.all', 'Took all effects from %1$s', opciones.nombre));
          return;
        }
        var ide = Efectos.id(ne) || (parseInt(ne, 10) > 0 && parseInt(ne, 10) < Efectos.lista.length ? parseInt(ne, 10) : 0);
        if (!ide) { chat(Tc('commands.effect.notFound', 'There is no such mob effect with ID %s', a[2] || ''), '#ff8080'); return; }
        var seg = a[3] !== undefined ? parseInt(a[3], 10) : 30, amp = a[4] !== undefined ? parseInt(a[4], 10) : 0;
        if (isNaN(seg) || isNaN(amp) || seg < 0) { malo(); return; }
        var nom = I.t('potion.' + Efectos.lista[ide][1], ne);
        if (seg === 0) {
          if (!Efectos.de(sup.efectos, ide)) { chat(Tc('commands.effect.failure.notActive', '', nom, opciones.nombre), '#ff8080'); return; }
          Efectos.quitar(sup.efectos, ide); I.sucio();
          chat(Tc('commands.effect.success.removed', 'Took %1$s from %2$s', nom, opciones.nombre));
          return;
        }
        if (Efectos.INSTANTANEO[ide]) Efectos.instantaneo(ide, amp, ganchosEfectos);
        else darEfecto(ide, seg * 20, Math.max(0, Math.min(255, amp)));
        chat(Tc('commands.effect.success', 'Gave %1$s * %2$d to %3$s for %4$d seconds', nom, amp, opciones.nombre, seg));
        return;
      }
      case 'xp': {
        if (!partida.local) { chat(Tc('commands.generic.disabled', 'Cheats are not enabled'), '#ff8080'); return; }
        var q = a[1] || '', niv = /l$/i.test(q), nx = parseInt(q, 10);
        if (isNaN(nx)) { malo(); return; }
        if (niv) { sup.nivel = Math.max(0, sup.nivel + nx); if (nx < 0 && sup.nivel === 0) sup.progreso = 0; chat(Tc(nx < 0 ? 'commands.xp.success.negative.levels' : 'commands.xp.success.levels', '', Math.abs(nx), opciones.nombre)); }
        else if (nx >= 0) { ganchosTirados.xp(nx); chat(Tc('commands.xp.success', 'Gave %1$d experience to %2$s', nx, opciones.nombre)); }
        else { chat(Tc('commands.xp.failure.widthdrawXp', ''), '#ff8080'); return; }
        I.sucio();
        return;
      }
      case 'help': case '?':
        chat('/time set <day|noon|sunset|night|midnight|sunrise|n>, /weather <clear|rain|thunder>, /gamemode <c|s>, ' +
          '/tp <x y z|jugador>, /summon <bicho>, /effect <jugador> <efecto|clear> [s] [nivel], /xp <n>[L], /kill, /seed, /say, /me');
        return;
    }
    chat(Tc('commands.generic.unknown', 'Unknown command: %s', c), '#ff8080');
  }

  // ------------------------------------------------------------------------------------------
  // Fabricar: la grilla de 2x2 del inventario o la de 3x3 de la mesa (inv.fabricar), las recetas de
  // recetas.js y el libro de recetas de la 1.2 (tocar una receta pone sus cosas en la grilla)
  // ------------------------------------------------------------------------------------------
  function grillaDe(v, lado) {
    var g = [];
    for (var i = 0; i < lado * lado; i++) g.push(v.fabricar[i] || null);
    return g;
  }
  function resultadoFabricar(v, tam) {
    var lado = tam === 9 ? 3 : 2, r = Recetas.buscar(grillaDe(v, lado), lado);
    return r ? Inventario.cosa(r.o[0], r.o[1], r.o[2]) : null;
  }
  // lo que queda en la grilla al usar algo que viene en un recipiente (la leche deja el balde)
  var RECIPIENTE = { '325:1': [325, 0], '325:8': [325, 0], '325:10': [325, 0], '373:0': [374, 0] };
  function gastarGrilla(v, lado) {
    for (var i = 0; i < lado * lado; i++) {
      var c = v.fabricar[i];
      if (!c) continue;
      var queda = RECIPIENTE[c.id + ':' + c.m];
      if (queda) { v.fabricar[i] = Inventario.cosa(queda[0], queda[1], 1); continue; }
      c.n--;
      if (c.n <= 0) v.fabricar[i] = null;
    }
  }
  // tocar la salida: una vez a la mano; mantener: todas las que se puedan, al inventario
  function fabricar(v, tam, todas) {
    var lado = tam === 9 ? 3 : 2, hechas = 0;
    for (var vez = 0; vez < 64; vez++) {
      var r = Recetas.buscar(grillaDe(v, lado), lado);
      if (!r) break;
      var sale = Inventario.cosa(r.o[0], r.o[1], r.o[2]);
      if (!todas) {
        if (v.mano && !(Inventario.iguales(v.mano, sale) && v.mano.n + sale.n <= Inventario.pila(sale))) break;
        if (v.mano) v.mano.n += sale.n; else v.mano = sale;
      } else {
        if (!Inventario.cabe(v, sale)) break;
        var sobra = Inventario.agregar(v, sale);
        if (sobra > 0) tirarObjeto(Inventario.copia(sale, sobra));
      }
      gastarGrilla(v, lado);
      hechas++;
      if (!todas) break;
    }
    if (hechas) I.sucio();
    return hechas;
  }
  // el libro: una entrada por cosa que sale (con sus recetas), en la pestaña de esa cosa en el
  // inventario creativo y en ese orden
  var libros = {};
  function recetasPara(lado) {
    if (libros[lado]) return libros[lado];
    var orden = {}, lc = G.listaCreativa();
    lc.forEach(function (it, i) { var k = it.id + ':' + it.m; if (orden[k] === undefined) orden[k] = { i: i, tab: it.tab }; });
    var por = {}, l = [];
    Recetas.lista.forEach(function (r) {
      if (!Recetas.entra(r, lado)) return;
      var k = r.o[0] + ':' + r.o[1];
      if (por[k]) { por[k].rs.push(r); return; }
      var o = orden[k];
      var e = { id: r.o[0], m: r.o[1], n: r.o[2], rs: [r], tab: o ? o.tab : (Items.es(r.o[0]) ? 3 : 0), i: o ? o.i : 1e6 + l.length };
      por[k] = e; l.push(e);
    });
    l.sort(function (a, b) { return a.i - b.i; });
    libros[lado] = l;
    return l;
  }
  // cuántas tiene el jugador de algo (en la barra y la mochila; -1: cualquier variante)
  function contar(v, id, m) {
    var n = 0;
    [v.barra, v.mochila].forEach(function (l) { l.forEach(function (c) { if (c && c.id === id && (m < 0 || c.m === m) && !c.d) n += c.n; }); });
    return n;
  }
  // cuántas veces se puede hacer una receta con lo que se tiene (lo de la grilla también cuenta)
  function vecesReceta(v, r) {
    var ing = Recetas.ingredientes(r), veces = 64;
    ing.forEach(function (k) {
      var hay = contar(v, k.id, k.m);
      v.fabricar.forEach(function (c) { if (c && c.id === k.id && (k.m < 0 || c.m === k.m)) hay += c.n; });
      veces = Math.min(veces, Math.floor(hay / k.n));
    });
    return veces;
  }
  function vecesEntrada(v, e) { var mx = 0; e.rs.forEach(function (r) { mx = Math.max(mx, vecesReceta(v, r)); }); return mx; }
  // sacar n de algo del inventario (para poner en la grilla): devuelve la variante que se sacó o null
  function sacar(v, id, m, n) {
    var listas = [v.mochila, v.barra], elegida = -1;
    if (m < 0) {
      // la variante de la que más hay
      var cuenta = {};
      listas.forEach(function (l) { l.forEach(function (c) { if (c && c.id === id && !c.d) cuenta[c.m] = (cuenta[c.m] || 0) + c.n; }); });
      for (var k in cuenta) if (cuenta[k] >= n && (elegida < 0 || cuenta[k] > cuenta[elegida])) elegida = +k;
      if (elegida < 0) return null;
    } else {
      if (contar(v, id, m) < n) return null;
      elegida = m;
    }
    var falta = n;
    listas.forEach(function (l) {
      for (var i = 0; i < l.length && falta > 0; i++) {
        var c = l[i];
        if (!c || c.id !== id || c.m !== elegida || c.d) continue;
        var t = Math.min(falta, c.n);
        c.n -= t; falta -= t;
        if (c.n <= 0) l[i] = null;
      }
    });
    return elegida;
  }
  // tocar una receta del libro: devuelve lo de la grilla y la llena con una (o con todas las que se
  // puedan) de esa receta
  function ponerReceta(v, e, tam, muchas) {
    var lado = tam === 9 ? 3 : 2;
    for (var i = 0; i < 9; i++) if (v.fabricar[i]) { var sobra = Inventario.agregar(v, v.fabricar[i]); if (sobra > 0) tirarObjeto(Inventario.copia(v.fabricar[i], sobra)); v.fabricar[i] = null; }
    var r = null, veces = 0;
    e.rs.forEach(function (x) { var q = vecesReceta(v, x); if (q > veces) { veces = q; r = x; } });
    if (!r || !veces) return false;
    var n = muchas ? Math.min(veces, 64) : 1;
    // que no pase de lo que se apila en cada lugar
    (r.s || r.g).forEach(function (k) { if (k) n = Math.min(n, Inventario.pila({ id: k[0], m: Math.max(0, k[1]) })); });
    var celdas = [];
    if (r.s) r.s.forEach(function (k, j) { celdas.push([j, k]); });
    else for (var y = 0; y < r.h; y++) for (var x = 0; x < r.w; x++) { var k = r.g[y * r.w + x]; if (k) celdas.push([y * lado + x, k]); }
    celdas.forEach(function (ce) {
      var m = sacar(v, ce[1][0], ce[1][1], n);
      if (m !== null) v.fabricar[ce[0]] = Inventario.cosa(ce[1][0], m, n);
    });
    I.sucio();
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // Lo que las pantallas de la 1.2 (pantallas.js) le piden al juego
  // ------------------------------------------------------------------------------------------
  // el muñeco del título y la pausa arranca un poco girado hacia los botones (como en la 1.2)
  var muñecoYaw = 0.45;
  // lo que lleva el jugador (ver inventario.js); I.juego.barra es inv.barra
  var inv = Inventario.nuevo(null), listaCreativa = null;
  var G = {
    opciones: function () { return opciones; },
    guardarOpciones: guardarOpciones,
    aplicarOpciones: aplicarOpciones,
    ponerIdioma: function (l) { opciones.idioma = l; ponerIdioma(l); },
    nombre: function () { return opciones.nombre; },
    frase: function () { return I.frase || ''; },
    jugando: function () { return jugando && !cargando; },
    pantallaAbierta: function (n) {
      I.juiEnJuego = jugando && !cargando;
      // mientras se mira la lista de Jugar se cuenta quién está en los mundos públicos
      if (n === 'jugar') { refrescarMundos(); mirarPublicos(); } else if (!jugando) Red.dejarDeMirar();
      I.sucio();
    },
    publicos: function () { return PUBLICOS; },
    mundos: function () { return I.mundos || []; },
    servidores: servidores,
    guardarServidores: guardarServidores,
    jugadoresEn: function (sala) { return Red.jugadoresEn(sala) || 0; },
    salaDe: salaDe,
    crearMundo: function (m) { crearMundo(m); },
    abrirMundo: abrirMundo,
    guardarMundo: function (m) { return BD.guardarMundo(m).then(refrescarMundos); },
    borrarMundo: function (m) { return BD.borrar(m.id).then(refrescarMundos); },
    entrarPublico: entrarPublico,
    entrarServidor: entrarServidor,
    cargaTitulo: function () { return I.cargandoTexto || ''; },
    cargaTexto: function () { return cargando ? I.t('progressScreen.message.building', '') : ''; },
    cargaParte: function () { return typeof I.cargandoParte === 'number' ? I.cargandoParte : 0; },
    jugadores: function () {
      var l = [{ nombre: opciones.nombre, local: true }];
      if (partida && !partida.local) Red.remotos.forEach(function (j) { l.push({ nombre: j.name }); });
      return l;
    },
    seguir: function () { I.acciones.seguir(); },
    salir: function () { I.acciones.salir(); },
    reaparecer: function () { reaparecer(); },
    partida: function () { return partida; },
    esPublica: function () { return !!(partida && !partida.local); },
    // una regla del mundo cambiada desde los ajustes del juego
    cambioDePartida: function (k) {
      if (!partida) return;
      if (k === 'mob_spawn') B.activo = partida.bichos !== false;
      if (k === 'modo') ponerModo(partida.modo);
      if (k === 'dificultad') B.dificultad = DIFICULTADES[partida.dificultad] || 'normal';
      guardar();
    },
    enviarChat: function (texto) {
      if (texto.charAt(0) === '/') { chat(texto, '#c0c0c0'); comando(texto); return; }
      chat(I.f(I.t('chat.type.text', '<%s> %s'), opciones.nombre, texto));
      if (partida && !partida.local && !Red.decir(texto)) chat(I.t('chat.cannotSend', 'Cannot send chat message'), '#ff8080');
    },
    textoChat: function () { return I.juego.chat.slice(-30).map(function (l) { return l.s; }).join('\n'); },
    mensajeMuerte: function () { return I.muerte.texto || ''; },
    comando: function (texto) { comando(texto); },
    trucos: function () { return !!(partida && partida.local); },
    // el inventario
    inventario: function () { return inv; },
    creativo: function () { return !!(partida && partida.creativo); },
    listaCreativa: function () { if (!listaCreativa) listaCreativa = O.creativo(); return listaCreativa; },
    cerrarInventario: function (d) {
      if (d && d.pos) Sonido.tocar('random.chestclosed', 0.5, Math.random() * 0.1 + 0.9, d.pos[0] + 0.5, d.pos[1] + 0.5, d.pos[2] + 0.5);
      Pantallas.vaciar(); I.ir('juego'); mostrarNombre(); I.sucio();
    },
    // sacar lo cocinado del horno: su experiencia, en orbes al lado del jugador
    experienciaHorno: function (h) { var n = Contenedores.experiencia(h); if (n > 0) Tirados.orbes(J.x, J.y + 0.5, J.z, n); },
    inventarioCambio: function () { I.sucio(); },
    puntosArmadura: function () { return Inventario.puntosArmadura(inv); },
    resultadoFabricar: resultadoFabricar,
    fabricar: function (v, tam, todas) { return fabricar(v, tam, todas); },
    recetas: function (lado) { return recetasPara(lado); },
    vecesReceta: function (e) { return vecesEntrada(inv, e); },
    ponerReceta: function (e, tam, muchas) { return ponerReceta(inv, e, tam, muchas); },
    tirarObjeto: function (c) { tirarObjeto(c); },
    despertar: function () { despertar(false); },
    // montado: la vida del bicho (los corazones del caballo) y la carga del salto
    montado: function () { return montado ? { vida: montado.e.vida, max: montado.e.vidaMax || 20, carga: montado.carga, salta: !!montado.e.c['minecraft:can_power_jump'] } : null; },
    abrirChat: function () { if (I.acciones.abrirChat) { I.ir('juego'); I.acciones.abrirChat(); } },
    // el HUD: la vida, la comida, el aire y la experiencia (en creativo no se muestran)
    estadoJugador: function () {
      var pt = I.juego.parpadeoTick || 0;
      return { creativo: !I.juego.conVida, vida: sup.vida, vidaAntes: I.juego.vidaAntes || 0, comida: sup.comida, saturacion: sup.saturacion,
        aire: sup.aire, bajoAgua: sup.aire < 300, titila: pt > pasosLuz && ((pt - pasosLuz) / 3 | 0) % 2 === 1, tick: pasosLuz,
        nivel: sup.nivel, progreso: sup.progreso, max: sup.max, absorcion: sup.absorcion, efectos: sup.efectos.lista,
        veneno: !!(Efectos.de(sup.efectos, 19) || Efectos.de(sup.efectos, 25)), wither: !!Efectos.de(sup.efectos, 20),
        hambre: !!Efectos.de(sup.efectos, 17), regenera: !!Efectos.de(sup.efectos, 10) };
    },
    elegido: function () { return I.juego.elegido; },
    // el ícono de guardado del HUD: mientras se guarda (y un poco más, para que se vea)
    guardando: function () { return performance.now() < (I.juego.guardandoHasta || 0); },
    elegirCasilla: function (i) { I.acciones.elegir(i); },
    abrirInventario: function () { I.acciones.inventario(); },
    girarMuñeco: function (dx) { muñecoYaw += dx * 0.02; },
    muñecoYaw: function () { return muñecoYaw; },
    skin: function () { return opciones.skin === 'alex' ? 'alex' : 'steve'; }
  };

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
      if (I.pantalla !== 'juego' && I.pantalla !== 'inventario') return;
      I.soltarTodo();
      Pantallas.ir('pausa');
      I.ir('jui');
      if (document.pointerLockElement) document.exitPointerLock();
      guardar();
    },
    seguir: function () { Pantallas.vaciar(); I.ir('juego'); },
    opcionesJuego: function () { I.enJuego = true; armarAjustes(); I.ir('opciones'); },
    salir: function () {
      // el bucle deja el mundo ya (muestra el panorama) mientras se guarda
      jugando = false;
      I.cargandoTexto = I.t('progressScreen.saving', I.tp('guardando')); I.cargandoParte = 1;
      Pantallas.ir('guardando');
      I.ir('jui');
      cerrarMundo().then(function () { irAlTitulo(); });
    },
    reaparecer: function () { reaparecer(); },
    listoOpciones: function () { guardarOpciones(); aplicarOpciones(); if (I.enJuego) I.ir('pausa'); else irAlTitulo(); },
    // el inventario de la 1.2 (su JSON): el creativo o el de supervivencia
    inventario: function () {
      if (I.pantalla !== 'juego') return;
      I.soltarTodo();
      Pantallas.ir(partida && partida.creativo ? 'inventarioCreativo' : 'inventario');
      I.ir('jui');
      if (document.pointerLockElement) document.exitPointerLock();
    },
    cerrarInv: function () { I.ir('juego'); },
    interactuar: function () { interactuarAhora(); },
    abrirChat: function () { if (I.pantalla === 'juego') { I.soltarTodo(); Pantallas.ir('chat'); I.ir('jui'); if (document.pointerLockElement) document.exitPointerLock(); } },
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
    // mantener una casilla de la barra: tira lo que tiene (en supervivencia; en creativo no hace falta)
    tirarBarra: function (i) {
      var c = inv.barra[i];
      if (!c || !supervivencia() || muerto) return;
      inv.barra[i] = null;
      tirarObjeto(c);
      golpe();
      I.sucio();
    },
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
    if (p === 'jui') { Jui.atras(); return; }
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
