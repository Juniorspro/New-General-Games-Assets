// porteo: el juego. La carga, el menú (con el panorama de la cueva de Tito), los mundos guardados
// (IndexedDB) y el bucle: 20 pasos por segundo de física, como Minecraft, y la cámara interpolada a lo
// que dé la pantalla. Tocar un bloque pone el elegido (o abre la puerta), mantener el dedo rompe;
// arrastrar mira; la cruceta camina; doble toque en saltar vuela (creativo); doble toque adelante
// corre. En la computadora: mouse, WASD, espacio, shift, ctrl, rueda, 1-9 y E.
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var lienzo = document.getElementById('lienzo'), hud = document.getElementById('hud');
  var I = Interfaz, J = Jugador, O = Objetos;
  var datos = null, imgs = {}, trab = null, urlTrabajador = null;
  var PASO = 1 / 20;
  var cam = { x: 0.5, y: 80, z: 0.5, yaw: 0, pitch: 0, fov: 70 * Math.PI / 180 };
  var mundo = { dist: 6, tiempo: 1000, reloj: 0, lluvia: 0, temperatura: 0.8, apuntado: null, rompiendo: 0, bajoAgua: false, nubes: true };
  var partida = null;           // el mundo abierto
  var jugando = false;          // hay un mundo andando (si no, el menú con el panorama)
  var telefono = matchMedia('(pointer: coarse)').matches;
  var TEMPERATURA = [0.5, 0.8, 2, 0.2, 0.7, 0.25, 0.8, 0.5, 0.8, 0.95, 0.6, 0.7, -0.5, 1.2, 2, 0, 0.5, 0.3];

  // ------------------------------------------------------------------------------------------
  // Opciones (en este navegador)
  // ------------------------------------------------------------------------------------------
  var OPC = 'craftsman.opciones';
  var opciones = { dist: telefono ? 6 : 8, brillo: 0.5, volumen: 0.8, sens: 1, fov: 70, fps: false, resolucion: 0, nubes: true };
  try { Object.assign(opciones, JSON.parse(localStorage.getItem(OPC) || '{}')); } catch (e) { /* sin almacenamiento */ }
  function guardarOpciones() { try { localStorage.setItem(OPC, JSON.stringify(opciones)); } catch (e) { /* nada */ } }
  function aplicarOpciones() {
    mundo.dist = opciones.dist;
    mundo.nubes = opciones.nubes;
    Render.brillo = opciones.brillo;
    cam.fov = opciones.fov * Math.PI / 180;
    I.juego.mostrarFps = opciones.fps;
    Sonido.volumen(opciones.volumen);
    if (trab && jugando) trab.postMessage({ t: 'centro', cx: ultimoCentro[0], cz: ultimoCentro[1], sy: ultimoCentro[2], dist: opciones.dist });
  }

  // ------------------------------------------------------------------------------------------
  // Mundos guardados: IndexedDB (y en memoria si el navegador no deja, p. ej. en algunos cuadros)
  // ------------------------------------------------------------------------------------------
  var BD = (function () {
    var db = null, B = {}, mem = { mundos: new Map(), trozos: new Map() };
    B.abrir = function () {
      return new Promise(function (ok) {
        try {
          var r = indexedDB.open('craftsman', 1);
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
    B.mundos = function () {
      if (!db) return Promise.resolve(Array.from(mem.mundos.values()));
      return pedir(db.transaction('mundos', 'readonly').objectStore('mundos').getAll());
    };
    B.guardarMundo = function (m) {
      if (!db) { mem.mundos.set(m.id, m); return Promise.resolve(); }
      var t = db.transaction('mundos', 'readwrite');
      t.objectStore('mundos').put(m);
      return fin(t);
    };
    B.trozos = function (id) {
      if (!db) return Promise.resolve(Array.from(mem.trozos.values()).filter(function (r) { return r.mundo === id; }));
      return pedir(db.transaction('trozos', 'readonly').objectStore('trozos').index('mundo').getAll(id));
    };
    B.guardarTrozos = function (lista) {
      if (!lista.length) return Promise.resolve();
      if (!db) { lista.forEach(function (r) { mem.trozos.set(r.k, r); }); return Promise.resolve(); }
      var t = db.transaction('trozos', 'readwrite'), s = t.objectStore('trozos');
      lista.forEach(function (r) { s.put(r); });
      return fin(t);
    };
    B.borrar = function (id) {
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
    return B;
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
    var base = Math.min(window.devicePixelRatio || 1, 2) * (opciones.resolucion || escalaAuto);
    var w = Math.max(1, Math.round(lienzo.clientWidth * base)), h = Math.max(1, Math.round(lienzo.clientHeight * base));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
  }

  async function arrancar() {
    // primero la interfaz (pesa poco) para mostrar la carga
    var chicas = ['fuente', 'gui', 'iconos', 'boton', 'botonEncima', 'botonApretado', 'icono'];
    var lista = await Promise.all(chicas.map(function (n) { return cargarImagen('datos/' + n + '.png'); }));
    chicas.forEach(function (n, i) { imgs[n] = lista[i]; });
    I.iniciar(hud, imgs, {});
    I.cargandoTexto = 'Cargando…'; I.cargandoParte = 0.05;
    I.ir('cargando');
    requestAnimationFrame(cuadro);

    datos = await (await fetch('datos/datos.json')).json();
    I.textos = datos.textos || {};
    I.cargandoParte = 0.15; I.sucio();
    var sonido = fetch('datos/sonidos.ogg').then(function (r) { return r.arrayBuffer(); });
    imgs.terreno = await cargarImagen('datos/terreno.webp');
    I.cargandoParte = 0.6; I.sucio();
    var otras = ['sol', 'luna'];
    for (var i = 0; i < otras.length; i++) imgs[otras[i]] = await cargarImagen('datos/' + otras[i] + '.png');
    imgs.grietas = [];
    for (i = 0; i < 10; i++) imgs.grietas.push(await cargarImagen('datos/grieta' + i + '.png'));
    var pano = [];
    for (i = 0; i < 6; i++) pano.push(await cargarImagen('datos/panorama' + i + '.jpg'));
    I.cargandoParte = 0.8; I.sucio();

    C.armarBloques(datos.bloques);
    ajustarTamano();
    Render.iniciar(lienzo, datos, imgs);
    Render.panorama(pano);
    var creativo = O.creativo();
    I.prepararIconos(creativo, datos);
    I.ponerInventario(creativo);
    urlTrabajador = URL.createObjectURL(new Blob([FUENTE_TRABAJADOR], { type: 'text/javascript' }));
    I.cargandoParte = 0.9; I.sucio();
    await BD.abrir();
    await refrescarMundos();
    sonido.then(function (b) { return Sonido.iniciar(b, datos.sonidos); }).then(aplicarOpciones).catch(function () { /* sin sonido */ });
    aplicarOpciones();
    I.cargandoParte = undefined;
    I.ir('titulo');
    window.prueba = { cam: cam, mundo: mundo, render: Render, jugador: J, partida: function () { return partida; }, abrir: abrirMundo, crear: crearMundo, cuenta: cuenta,
      rayo: function (fx, fy) { return tocarBloque(fx, fy, false); }, listo: true };
  }

  function refrescarMundos() {
    return BD.mundos().then(function (l) {
      l.sort(function (a, b) { return (b.jugado || 0) - (a.jugado || 0); });
      I.mundos = l;
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
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), nombre: (n.nombre || 'Mi mundo').slice(0, 32),
      semilla: typeof n.semilla === 'number' ? n.semilla : semillaDe(n.semilla), creativo: true, creado: Date.now(), jugado: Date.now(),
      tiempo: 1000, jugador: null, barra: O.barraInicial(), elegido: 0
    };
    return BD.guardarMundo(m).then(function () { return abrirMundo(m); });
  }

  var columnas = new Set(), esperandoSuelo = false, entrando = 0, ultimoCentro = [0, 0, 0];
  function abrirMundo(m) {
    I.cargandoTexto = 'Generando el mundo…'; I.cargandoParte = 0;
    I.ir('cargando');
    I.soltarTodo();
    return BD.trozos(m.id).then(function (regs) {
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
      var p = m.jugador;
      if (p) {
        J.ubicar(p.x, p.y, p.z); J.yaw = p.yaw; J.pitch = p.pitch; J.volando = !!p.volando && m.creativo;
        esperandoSuelo = false;
      } else {
        var lugar = lugarDeAparicion(m.semilla);
        J.ubicar(lugar[0] + 0.5, lugar[1] + 1, lugar[2] + 0.5); J.yaw = 0; J.pitch = 0; J.volando = false;
        esperandoSuelo = true;
      }
      I.juego.barra = (m.barra || O.barraInicial()).slice(0, 9);
      I.juego.elegido = m.elegido || 0;
      I.juego.creativo = m.creativo; I.juego.volando = J.volando;
      ultimoCentro = [Math.floor(J.x / 16), Math.floor(J.z / 16), Math.floor((J.y + 1.62) / 16)];
      trab.postMessage({ t: 'ini', bloques: datos.bloques, uv: datos.atlas.uv, semilla: m.semilla, dist: opciones.dist,
        cx: ultimoCentro[0], cz: ultimoCentro[1], sy: ultimoCentro[2] });
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
    if (!partida) return Promise.resolve();
    if (guardandoAhora) return guardandoAhora.then(guardar);
    var m = partida;
    m.jugador = { x: J.x, y: J.y, z: J.z, yaw: J.yaw, pitch: J.pitch, volando: J.volando };
    m.barra = I.juego.barra.slice(); m.elegido = I.juego.elegido; m.jugado = Date.now();
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
      partida = null;
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
  addEventListener('pagehide', function () { if (jugando) guardar(); });

  // ------------------------------------------------------------------------------------------
  // Tocar el mundo: el rayo desde el punto tocado, poner, usar y romper
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

  function usar(h) {
    var id = h.id, f = C.FORMA[id];
    if (f === C.F.puerta && id !== 71) {
      var abajo = Mundo.meta(h.x, h.y, h.z) & 8 ? h.y - 1 : h.y, m = Mundo.meta(h.x, abajo, h.z);
      Mundo.poner(h.x, abajo, h.z, id, m ^ 4);
      Sonido.tocar((m & 4) ? 'random.door_close' : 'random.door_open', 1, 0.9 + Math.random() * 0.1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      return true;
    }
    if (id === 96) {
      var mt = Mundo.meta(h.x, h.y, h.z);
      Mundo.poner(h.x, h.y, h.z, id, mt ^ 4);
      Sonido.tocar((mt & 4) ? 'random.door_close' : 'random.door_open', 1, 0.9 + Math.random() * 0.1, h.x + 0.5, h.y + 0.5, h.z + 0.5);
      return true;
    }
    return false;
  }

  function poner(fx, fy) {
    var it = I.juego.barra[I.juego.elegido];
    var h = tocarBloque(fx, fy, it && it.id === 111);
    if (!h) return;
    if (!J.agachado && usar(h)) return;
    if (!it) return;
    var id = it.id, m = it.m;
    if (id === 111 && !(h.id === 9 || h.id === 8)) return;
    // dónde tocó en la cara (para losas y escaleras: mitad de arriba o de abajo)
    var py = cam.y + h.d[1] * h.t, fyCara = Math.min(1, Math.max(0, py - h.y));
    // una losa sobre otra igual: la doble
    var doble = O.losaDoble[id];
    if (doble && h.id === id) {
      var mh = Mundo.meta(h.x, h.y, h.z);
      if ((mh & 7) === (m & 7) && ((h.ny === 1 && !(mh & 8)) || (h.ny === -1 && (mh & 8)))) {
        Mundo.poner(h.x, h.y, h.z, doble, m & 7);
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
      Mundo.poner(tx + c[0], ty + c[1], tz + c[2], c[3], c[4]);
    }
    sonar(O.sonidoPoner(id), tx, ty, tz);
    golpe();
    cuenta.puestos++;
  }

  function romper(h) {
    var id = h.id, m = Mundo.meta(h.x, h.y, h.z);
    Mundo.poner(h.x, h.y, h.z, 0, 0);
    // las cosas de dos bloques se van enteras
    if (C.FORMA[id] === C.F.puerta || id === 175) {
      var otro = (m & 8) ? h.y - 1 : h.y + 1;
      if (Mundo.bloque(h.x, otro, h.z) === id) Mundo.poner(h.x, otro, h.z, 0, 0);
    }
    // lo que estaba apoyado arriba (plantas, antorchas paradas, nieve fina, puertas) se cae
    var a = Mundo.bloque(h.x, h.y + 1, h.z);
    if (a > 0) {
      var ma = Mundo.meta(h.x, h.y + 1, h.z);
      if (O.necesitaSuelo(a) || (C.FORMA[a] === C.F.antorcha && (ma === 5 || ma === 0)) || a === 78 || a === 171 ||
          (C.FORMA[a] === C.F.puerta && !(ma & 8)) || C.FORMA[a] === C.F.riel) {
        Mundo.poner(h.x, h.y + 1, h.z, 0, 0);
        if (C.FORMA[a] === C.F.puerta || a === 175) Mundo.poner(h.x, h.y + 2, h.z, 0, 0);
      }
    }
    sonar(O.sonidoRomper(id), h.x, h.y, h.z);
    Render.romper(h.x, h.y, h.z, id, m);
    golpe();
    cuenta.rotos++;
  }

  // romper en creativo: al instante y, con el dedo quieto, uno cada 0,25 s (como el juego)
  var proximoRomper = 0;
  function interactuar(ahora) {
    var c = I.control;
    if (c.toque) {
      var t = c.toque; c.toque = null;
      if (I.pantalla === 'juego') poner(t[0], t[1]);
    }
    mundo.apuntado = null; mundo.rompiendo = 0;
    if (c.rompiendo && I.pantalla === 'juego') {
      var h = tocarBloque(c.rompiendo[0], c.rompiendo[1], false);
      if (h) {
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
  // Los pasos de física (20 por segundo)
  // ------------------------------------------------------------------------------------------
  var proximoPaso = 0, antesEnAgua = false, corriendoTactil = false, adelanteAntes = false, ultimoAdelante = 0;
  var caminadoAntes = 0, pasosLuz = 0, golpeDesde = -1, equipo = 1, itemAntes = '', bamboleo = 0;
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
    var antesY = J.y;
    caminadoAntes = J.caminado;
    J.paso();
    Render.pasoParticulas();
    if (trab && ++pasosLuz % 5 === 0) trab.postMessage({ t: 'luz', x: Math.floor(cam.x), y: Math.floor(cam.y), z: Math.floor(cam.z) });
    if (partida) partida.tiempo += 1;
    if (I.juego.volando !== J.volando) { I.juego.volando = J.volando; I.sucio(); }
    // los pasos suenan cada 1,7 bloques caminados (como el juego), no agachado
    if (J.enPiso && !J.agachado && J.caminado * 0.6 > proximoPaso) {
      proximoPaso = Math.floor(J.caminado * 0.6) + 1;
      var bajo = Mundo.bloque(Math.floor(J.x), Math.floor(J.y - 0.2), Math.floor(J.z));
      if (bajo > 0) { var s = O.sonidoPaso(bajo); if (s) Sonido.tocar(s[0], s[1], s[2]); }
    }
    if (J.enAgua && !antesEnAgua && antesY - J.y > 0.1) Sonido.tocar('random.splash', 0.3, 1 + (Math.random() - Math.random()) * 0.4);
    antesEnAgua = J.enAgua;
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
  var ultimo = 0, acum = 0, cuadros = 0, segundo = 0, fovActual = 0, estabaPausado = false;
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
    if (ema > 22 && escalaAuto > 0.5 && ahora - intentoFallido > 30000) { antesDeBajar = ema; escalaAuto = Math.max(0.5, escalaAuto * 0.85); }
    else if (ema < 15 && escalaAuto < 1) escalaAuto = Math.min(1, escalaAuto / 0.9);
  }

  function cuadro(t) {
    requestAnimationFrame(cuadro);
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
    resolucionAuto(dt, t);
    // mirar: lo arrastrado desde el cuadro anterior (en puntos CSS)
    var c = I.control;
    if (c.mirarX || c.mirarY) {
      var k = (I.conMouse ? 0.0025 : 0.0055) * opciones.sens;
      J.yaw += c.mirarX * k;
      J.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, J.pitch + c.mirarY * k));
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
    // los pasos
    var pausado = I.pantalla === 'pausa' || I.pantalla === 'opciones' || I.pantalla === 'pregunta';
    // en pausa tampoco corre el agua del trabajador
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
    bamboleo += ((andando ? 1 : 0) - bamboleo) * Math.min(1, dt * 8);
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
    mundo.reloj = t / 1000;
    mundo.tiempo = partida.tiempo + alfa;
    var ojo = Mundo.bloque(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z));
    mundo.bajoAgua = ojo === 8 || ojo === 9;
    var tb = TEMPERATURA[Mundo.bioma(Math.floor(cam.x), Math.floor(cam.z))];
    mundo.temperatura = tb === undefined ? 0.8 : tb;
    Render.dibujar(cam, mundo);
    // la mano: el golpe dura 0,3 s; al cambiar de cosa baja y vuelve a subir
    var it = I.juego.barra[I.juego.elegido], clave = it ? it.id + ':' + it.m : '';
    if (clave !== itemAntes) { itemAntes = clave; equipo = 0; }
    equipo = Math.min(1, equipo + dt * 5);
    var g = golpeDesde < 0 ? 0 : (t - golpeDesde) / 300;
    if (g >= 1) { g = 0; golpeDesde = -1; }
    estadoMano.item = it; estadoMano.golpe = g; estadoMano.equipo = equipo;
    estadoMano.bamboleo[0] = Math.sin(fase) * ab * 0.4; estadoMano.bamboleo[1] = -Math.abs(Math.cos(fase)) * ab * 0.6;
    if (I.pantalla === 'juego' || I.pantalla === 'inventario') Render.dibujarMano(estadoMano);
    I.dibujar();
  }

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
  function editarTexto(b, valor, listo) {
    var d = I.dpr(), inp = document.createElement('input');
    inp.type = 'text'; inp.value = valor || ''; inp.maxLength = 32;
    inp.setAttribute('autocomplete', 'off'); inp.setAttribute('autocapitalize', 'off'); inp.spellcheck = false;
    var s = inp.style;
    s.position = 'fixed'; s.left = (b.x / d) + 'px'; s.top = (b.y / d) + 'px'; s.width = (b.w / d) + 'px'; s.height = (b.h / d) + 'px';
    s.boxSizing = 'border-box'; s.zIndex = 10; s.background = '#000'; s.color = '#fff'; s.border = '2px solid #fff';
    s.font = Math.round(b.h / d * 0.45) + 'px monospace'; s.textAlign = 'center'; s.userSelect = 'text'; s.webkitUserSelect = 'text';
    s.outline = 'none'; s.touchAction = 'auto';
    document.body.appendChild(inp);
    inp.focus();
    inp.select();
    var hecho = false;
    function fin() {
      if (hecho) return;
      hecho = true;
      listo(inp.value.trim());
      inp.remove();
      I.sucio();
    }
    inp.addEventListener('blur', fin);
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') inp.blur(); });
    inp.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }
  function ciclo(lista, v) { var i = lista.indexOf(v); return lista[(i + 1) % lista.length]; }

  Object.assign(I.acciones, {
    jugar: function () { refrescarMundos().then(function () { I.ir('mundos'); }); },
    opciones: function () { I.enJuego = false; I.opciones = opciones; I.ir('opciones'); },
    titulo: function () { I.ir('titulo'); },
    crear: function () { I.nuevo = { nombre: 'Mi mundo', semilla: '', creativo: true }; I.ir('crear'); },
    nombre: function (b) { editarTexto(b, I.nuevo.nombre, function (v) { I.nuevo.nombre = v || 'Mi mundo'; }); },
    semilla: function (b) { editarTexto(b, I.nuevo.semilla, function (v) { I.nuevo.semilla = v; }); },
    modo: function () { /* por ahora sólo creativo */ },
    mundos: function () { I.ir('mundos'); },
    crearYa: function () { crearMundo(); },
    abrir: function (b) { var m = I.mundos[b.i]; if (m) abrirMundo(m); },
    borrar: function (b) {
      var m = I.mundos[b.i];
      if (!m) return;
      I.preguntar(I.t('selectWorld.deleteQuestion', '¿Borrar este mundo?'), '«' + m.nombre + '»', function () {
        BD.borrar(m.id).then(refrescarMundos);
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
    opcionesJuego: function () { I.enJuego = true; I.opciones = opciones; I.ir('opciones'); },
    salir: function () {
      // el bucle deja el mundo ya (muestra el panorama) mientras se guarda
      jugando = false;
      I.cargandoTexto = 'Guardando…'; I.cargandoParte = undefined; I.ir('cargando');
      cerrarMundo().then(function () { I.ir('titulo'); });
    },
    dist: function () { opciones.dist = ciclo([4, 5, 6, 8, 10, 12], opciones.dist); aplicarOpciones(); I.sucio(); },
    brillo: function () { opciones.brillo = ciclo([0, 0.25, 0.5, 0.75, 1], opciones.brillo); aplicarOpciones(); I.sucio(); },
    volumen: function () { opciones.volumen = ciclo([0, 0.25, 0.5, 0.75, 1], opciones.volumen); aplicarOpciones(); I.sucio(); },
    sens: function () { opciones.sens = ciclo([0.5, 0.75, 1, 1.25, 1.5, 2], opciones.sens); I.sucio(); },
    fov: function () { opciones.fov = ciclo([60, 70, 80, 90], opciones.fov); aplicarOpciones(); I.sucio(); },
    verFps: function () { opciones.fps = !opciones.fps; aplicarOpciones(); I.sucio(); },
    resolucion: function () { opciones.resolucion = ciclo([0, 0.5, 0.75, 1], opciones.resolucion); I.sucio(); },
    nubes: function () { opciones.nubes = !opciones.nubes; aplicarOpciones(); I.sucio(); },
    listoOpciones: function () { guardarOpciones(); aplicarOpciones(); I.ir(I.enJuego ? 'pausa' : 'titulo'); },
    inventario: function () { if (I.pantalla === 'juego') { I.soltarTodo(); I.ir('inventario'); if (document.pointerLockElement) document.exitPointerLock(); } },
    cerrarInv: function () { I.ir('juego'); },
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
  var accionesConClic = ['jugar', 'opciones', 'titulo', 'crear', 'mundos', 'crearYa', 'abrir', 'borrar', 'seguir', 'opcionesJuego', 'salir',
    'dist', 'brillo', 'volumen', 'sens', 'fov', 'verFps', 'resolucion', 'nubes', 'listoOpciones', 'preguntaSi', 'preguntaNo', 'tab', 'cerrarInv'];
  accionesConClic.forEach(function (n) {
    var f = I.acciones[n];
    if (!f) return;
    I.acciones[n] = function (b) { Sonido.tocar('random.click', 0.5, 1); return f(b); };
  });
  // Escape (y el botón atrás del teléfono, que web.js convierte en Escape): pausa en el juego y vuelve
  // una pantalla en los menús
  addEventListener('keydown', function (e) {
    if (e.code !== 'Escape') return;
    var p = I.pantalla;
    if (jugando) {
      if (p === 'juego') I.acciones.pausa();
      else if (p === 'pausa') I.acciones.seguir();
      else if (p === 'opciones') I.acciones.listoOpciones();
      else if (p === 'pregunta') I.acciones.preguntaNo();
    } else if (p === 'mundos' || p === 'opciones') { if (p === 'opciones') guardarOpciones(); I.ir('titulo'); }
    else if (p === 'crear') I.ir('mundos');
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
    I.cargandoTexto = 'No se pudo arrancar: ' + (e && e.message || e);
    I.sucio();
  });
})();
