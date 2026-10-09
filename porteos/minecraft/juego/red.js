// porteo: el multijugador, sin servidor propio: un "broker" MQTT público hace de correo entre los
// jugadores (mqtt.js por WebSocket). Cada sala es un mundo: ROOM = NS + nombre. Cada uno manda su
// estado (dónde está, hacia dónde mira, su vida) a ROOM/state cada ~100 ms si cambió algo, lo que
// hace (poner o romper bloques, pegarle a otro) a ROOM/action y lo que escribe a ROOM/chat. No hay
// anfitrión: cada uno es dueño sólo de su jugador y aplica lo de los demás; lo propio que vuelve
// del broker se ignora (data.id === MY_ID).
//
// Para que el que entra después vea lo construido, cada trozo tocado queda guardado en el broker
// como mensaje "retenido" (ROOM/mundo/cx_cz: la lista de bloques cambiados, comprimida): al
// suscribirse, el broker los entrega todos.
//
// Nada de esto frena al juego: la biblioteca se carga aparte (async) y, si no hay red, el mundo se
// juega igual, solo; el multijugador se suma cuando la conexión anda.
var Red = (function () {
  'use strict';
  var R = {};
  var NS = 'mcpe12_jxs_porteo_v1_';
  var Q = new URLSearchParams(location.search);
  var BROKER = Q.get('broker') || 'wss://broker.emqx.io:8084/mqtt';
  var LIB = Q.get('mqttjs') || 'https://unpkg.com/mqtt@5/dist/mqtt.min.js';
  var CLAVE_ID = 'mc12.id';

  // un id estable para este navegador (y un nombre a mostrar, que se elige en Ajustes)
  R.MY_ID = (function () {
    var id = null;
    try { id = localStorage.getItem(CLAVE_ID); } catch (e) { /* sin almacenamiento */ }
    if (!id) {
      id = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      try { localStorage.setItem(CLAVE_ID, id); } catch (e) { /* nada */ }
    }
    return id;
  })();
  R.nombre = 'Steve';
  R.estado = 'apagado';         // apagado | conectando | enlinea | desconectado
  R.remotos = new Map();         // id → jugador de otro
  R.sala = null;
  var cliente = null, ROOM = null, ganchos = {};

  // ------------------------------------------------------------------------------------------
  // La biblioteca: con un <script> agregado aparte (no frena la carga ni el juego sin red)
  // ------------------------------------------------------------------------------------------
  var cargando = null;
  function biblioteca() {
    if (window.mqtt) return Promise.resolve(window.mqtt);
    if (cargando) return cargando;
    cargando = new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = LIB; s.async = true;
      s.onload = function () { window.mqtt ? ok(window.mqtt) : mal(new Error('mqtt.js no cargó')); };
      s.onerror = function () { cargando = null; mal(new Error('sin red para mqtt.js')); };
      document.head.appendChild(s);
    });
    return cargando;
  }
  R.precargar = function () { biblioteca().catch(function () { /* después se reintenta */ }); };

  function cambiarEstado(e) {
    if (R.estado === e) return;
    R.estado = e;
    if (ganchos.estado) ganchos.estado(e);
  }

  // ------------------------------------------------------------------------------------------
  // Entrar y salir de una sala
  // ------------------------------------------------------------------------------------------
  // hooks: { estado(e), entra(jugador), sale(jugador), bloque(x, y, z, id, m, quien),
  //          golpe(dano, deQuien, empuje), chat(nombre, texto), trozo(cx, cz, lista) }
  R.entrar = function (sala, hooks) {
    R.salir();
    ganchos = hooks || {};
    R.sala = sala;
    ROOM = NS + sala;
    cambiarEstado('conectando');
    biblioteca().then(function (mqtt) {
      if (R.sala !== sala) return;
      cliente = mqtt.connect(BROKER, {
        clientId: 'mc12_' + R.MY_ID + '_' + Math.random().toString(36).slice(2, 6),
        clean: true, keepalive: 30, reconnectPeriod: 4000, connectTimeout: 10000,
        // si se corta, el broker avisa a los demás que este jugador se fue
        will: { topic: ROOM + '/action', payload: JSON.stringify({ type: 'adios', id: R.MY_ID }), qos: 0, retain: false }
      });
      cliente.on('connect', function () {
        if (R.sala !== sala) return;
        cliente.subscribe([ROOM + '/state', ROOM + '/chat', ROOM + '/action', ROOM + '/bichos', ROOM + '/mundo/+'], { qos: 0 });
        cambiarEstado('enlinea');
        // los que ya están responden con su estado
        R.accion({ type: 'hola', name: R.nombre });
        ultimo = null;
      });
      cliente.on('close', function () { if (R.sala === sala) cambiarEstado('desconectado'); });
      cliente.on('offline', function () { if (R.sala === sala) cambiarEstado('desconectado'); });
      cliente.on('error', function (e) { console.error('mqtt: ' + (e && e.message || e)); if (R.sala === sala) cambiarEstado('desconectado'); });
      cliente.on('message', recibir);
    }).catch(function (e) {
      console.error('red: ' + (e && e.message || e));
      if (R.sala === sala) cambiarEstado('desconectado');
    });
  };
  R.salir = function () {
    if (cliente) {
      try { R.accion({ type: 'adios' }); } catch (e) { /* nada */ }
      var c = cliente;
      cliente = null;
      setTimeout(function () { try { c.end(true); } catch (e) { /* nada */ } }, 150);
    }
    R.remotos.forEach(function (j) { if (ganchos.sale) ganchos.sale(j); });
    R.remotos.clear();
    R.sala = null; ROOM = null;
    pendientesTrozo.clear(); clearTimeout(relojTrozos);
    cambiarEstado('apagado');
  };
  function publicar(tema, obj, retener) {
    if (!cliente || !cliente.connected) return false;
    try { cliente.publish(ROOM + tema, typeof obj === 'string' ? obj : JSON.stringify(obj), { qos: 0, retain: !!retener }); } catch (e) { return false; }
    return true;
  }

  // ------------------------------------------------------------------------------------------
  // Lo que llega. Todo se valida: viene de cualquiera
  // ------------------------------------------------------------------------------------------
  function num(v, lim) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= lim; }
  function texto(v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : ''; }
  function recibir(tema, carga) {
    var t = String(tema);
    if (t.indexOf(ROOM + '/mundo/') === 0) { trozoRecibido(t.slice(ROOM.length + 7), carga); return; }
    if (carga.length > (t === ROOM + '/bichos' || t === ROOM + '/action' ? 16000 : 4096)) return;
    var d;
    try { d = JSON.parse(carga.toString()); } catch (e) { return; }
    if (!d || typeof d !== 'object' || d.id === R.MY_ID || typeof d.id !== 'string' || d.id.length > 40) return;
    if (t === ROOM + '/state') estadoRecibido(d);
    else if (t === ROOM + '/action') accionRecibida(d);
    else if (t === ROOM + '/bichos') { if (ganchos.bichos) ganchos.bichos(d.id, d.l); }
    else if (t === ROOM + '/chat') {
      var n = texto(d.name, 24), s = texto(d.text, 200);
      if (s && ganchos.chat) ganchos.chat(n || '?', s);
    }
  }
  function estadoRecibido(d) {
    if (!num(d.x, 3e7) || !num(d.y, 1000) || !num(d.z, 3e7)) return;
    var j = R.remotos.get(d.id), nuevo = !j;
    if (!j) {
      j = { id: d.id, name: '', x: d.x, y: d.y, z: d.z, yaw: 0, pitch: 0, targetX: d.x, targetY: d.y, targetZ: d.z, targetYaw: 0, targetPitch: 0,
        hp: 20, isMoving: false, agachado: false, golpe: 0, paso: 0, amplitud: 0, item: null, skin: 'steve' };
      R.remotos.set(d.id, j);
    }
    j.name = texto(d.name, 24) || j.name || '?';
    j.targetX = d.x; j.targetY = d.y; j.targetZ = d.z;
    if (num(d.facingAngle, 100)) j.targetYaw = d.facingAngle;
    if (num(d.pitch, 4)) j.targetPitch = d.pitch;
    if (num(d.hp, 100)) j.hp = d.hp;
    j.isMoving = !!d.isMoving; j.agachado = !!d.sneaking;
    if (d.swing && !j.golpeDesde) j.golpeDesde = performance.now();
    j.skin = d.skin === 'alex' ? 'alex' : 'steve';
    j.last = performance.now();
    if (nuevo && ganchos.entra) ganchos.entra(j);
  }
  function accionRecibida(d) {
    var tipo = d.type;
    if (tipo === 'hola') { ultimo = null; return; }      // que vea el estado propio enseguida
    if (tipo === 'adios') {
      var j = R.remotos.get(d.id);
      if (j) { R.remotos.delete(d.id); if (ganchos.sale) ganchos.sale(j); }
      return;
    }
    if (tipo === 'bloque') {
      if (!num(d.x, 3e7) || !num(d.y, 300) || !num(d.z, 3e7) || !num(d.b, 255) || !num(d.m, 15)) return;
      var x = Math.floor(d.x), y = Math.floor(d.y), z = Math.floor(d.z);
      anotar(x, y, z, d.b | 0, d.m | 0, false);
      if (ganchos.bloque) ganchos.bloque(x, y, z, d.b | 0, d.m | 0, d.id);
      return;
    }
    if (tipo === 'bloques') {
      // varios juntos (una explosión): [x, y, z, id, meta, ...]
      if (!Array.isArray(d.l) || d.l.length > 3000) return;
      for (var q = 0; q + 4 < d.l.length; q += 5) {
        var l = d.l;
        if (!num(l[q], 3e7) || !num(l[q + 1], 300) || !num(l[q + 2], 3e7) || !num(l[q + 3], 255) || !num(l[q + 4], 15)) continue;
        var bx = Math.floor(l[q]), by = Math.floor(l[q + 1]), bz = Math.floor(l[q + 2]);
        anotar(bx, by, bz, l[q + 3] | 0, l[q + 4] | 0, false);
        if (ganchos.bloque) ganchos.bloque(bx, by, bz, l[q + 3] | 0, l[q + 4] | 0, d.id);
      }
      return;
    }
    if (tipo === 'hit_player') {
      if (d.targetId !== R.MY_ID || !num(d.dmg, 20)) return;
      var emp = num(d.kx, 2) && num(d.kz, 2) ? [d.kx, d.kz] : [0, 0];
      if (ganchos.golpe) ganchos.golpe(Math.max(0, d.dmg), texto(d.byName, 24) || '?', emp);
      return;
    }
    if (tipo === 'hit_bicho') {
      if (d.owner !== R.MY_ID || !num(d.mid, 1e9) || !num(d.dmg, 20)) return;
      if (ganchos.golpeBicho) ganchos.golpeBicho(d.mid, d.dmg, num(d.kx, 2) ? d.kx : 0, num(d.kz, 2) ? d.kz : 0);
      return;
    }
    if (tipo === 'muerte' && ganchos.muerte) { ganchos.muerte(texto(d.name, 24), texto(d.byName, 24)); }
  }

  // ------------------------------------------------------------------------------------------
  // Lo que se manda
  // ------------------------------------------------------------------------------------------
  // el estado propio: cada ~100 ms (lo llama el juego), sólo si cambió algo que se note, y cada 2 s
  // igual (para no desaparecer de los demás, que borran a quien no oyen en 5 s)
  var ultimo = null, ultimoT = 0;
  R.publicarEstado = function (s) {
    if (!cliente || !cliente.connected) return;
    var ahora = performance.now();
    var cambio = !ultimo || Math.abs(s.x - ultimo.x) > 0.02 || Math.abs(s.y - ultimo.y) > 0.02 || Math.abs(s.z - ultimo.z) > 0.02 ||
      Math.abs(s.facingAngle - ultimo.facingAngle) > 0.03 || Math.abs(s.pitch - ultimo.pitch) > 0.05 || s.hp !== ultimo.hp ||
      s.isMoving !== ultimo.isMoving || s.sneaking !== ultimo.sneaking || s.swing;
    if (!cambio && ahora - ultimoT < 2000) return;
    var m = { id: R.MY_ID, name: R.nombre, x: +s.x.toFixed(2), y: +s.y.toFixed(2), z: +s.z.toFixed(2), hp: s.hp,
      facingAngle: +s.facingAngle.toFixed(3), pitch: +s.pitch.toFixed(3), isMoving: !!s.isMoving, sneaking: !!s.sneaking,
      swing: !!s.swing, skin: s.skin };
    if (publicar('/state', m)) { ultimo = s; ultimoT = ahora; }
  };
  R.accion = function (a) { a.id = R.MY_ID; return publicar('/action', a); };
  R.decir = function (textoChat) {
    var s = texto(textoChat, 200).trim();
    if (!s) return false;
    return publicar('/chat', { id: R.MY_ID, name: R.nombre, text: s });
  };
  R.bloque = function (x, y, z, id, m) {
    anotar(x, y, z, id, m, true);
    R.accion({ type: 'bloque', x: x, y: y, z: z, b: id, m: m });
  };
  // varios bloques de una vez (una explosión): un solo mensaje en vez de uno por bloque
  R.bloques = function (l) {
    for (var q = 0; q + 4 < l.length; q += 5) anotar(l[q], l[q + 1], l[q + 2], l[q + 3], l[q + 4], true);
    if (l.length) R.accion({ type: 'bloques', l: l });
  };
  R.golpear = function (objetivo, dano, kx, kz) {
    R.accion({ type: 'hit_player', targetId: objetivo, dmg: dano, byName: R.nombre, kx: +kx.toFixed(3), kz: +kz.toFixed(3) });
  };
  R.conectado = function () { return !!cliente && cliente.connected; };
  // los bichos propios (los mueve este jugador): cada ~250 ms, lo llama el juego
  R.publicarBichos = function (l) { if (l.length || hayBichos) publicar('/bichos', { id: R.MY_ID, l: l }); hayBichos = l.length > 0; };
  var hayBichos = false;
  R.golpearBicho = function (dueno, mid, dano, kx, kz) {
    R.accion({ type: 'hit_bicho', owner: dueno, mid: mid, dmg: dano, kx: +kx.toFixed(3), kz: +kz.toFixed(3), byName: R.nombre });
  };

  // ------------------------------------------------------------------------------------------
  // Los otros: se acercan de a poco a donde dijeron que están (interpolación) y se van si no se los
  // oye en 5 segundos
  // ------------------------------------------------------------------------------------------
  R.paso = function (dt) {
    var ahora = performance.now(), k = Math.min(1, dt * 12);
    R.remotos.forEach(function (j, id) {
      if (ahora - j.last > 5000) { R.remotos.delete(id); if (ganchos.sale) ganchos.sale(j); return; }
      var ax = j.x, az = j.z;
      j.x += (j.targetX - j.x) * k; j.y += (j.targetY - j.y) * k; j.z += (j.targetZ - j.z) * k;
      var dy = j.targetYaw - j.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      j.yaw += dy * k;
      j.pitch += (j.targetPitch - j.pitch) * k;
      // las piernas al caminar: lo andado de verdad
      var andado = Math.sqrt((j.x - ax) * (j.x - ax) + (j.z - az) * (j.z - az));
      j.paso += andado * 2.4;
      j.amplitud += ((j.isMoving && andado > 0.001 ? 1 : 0) - j.amplitud) * Math.min(1, dt * 8);
      j.golpe = j.golpeDesde ? (ahora - j.golpeDesde) / 300 : 0;
      if (j.golpe >= 1) { j.golpe = 0; j.golpeDesde = 0; }
    });
  };

  // ------------------------------------------------------------------------------------------
  // Lo construido, guardado en el broker: por trozo, la lista de bloques cambiados (x, y, z
  // dentro del trozo, id y meta), comprimida, como mensaje retenido. Se vuelve a mandar unos
  // segundos después de tocar un trozo (juntando los cambios), con lo propio y lo de los demás
  // ------------------------------------------------------------------------------------------
  var cambios = new Map();          // "cx_cz" → Map(índice → [id, meta])
  var pendientesTrozo = new Set(), relojTrozos = 0;
  function anotar(x, y, z, id, m, propio) {
    var cx = Math.floor(x / 16), cz = Math.floor(z / 16), k = cx + '_' + cz;
    if (!cambios.has(k)) cambios.set(k, new Map());
    cambios.get(k).set((y << 8) | ((z & 15) << 4) | (x & 15), [id, m]);
    if (propio) {
      pendientesTrozo.add(k);
      clearTimeout(relojTrozos);
      relojTrozos = setTimeout(mandarTrozos, 3000);
    }
  }
  function mandarTrozos() {
    var lista = Array.from(pendientesTrozo);
    pendientesTrozo.clear();
    lista.forEach(function (k) {
      var mp = cambios.get(k);
      if (!mp) return;
      var u = new Uint8Array(mp.size * 4), o = 0;
      mp.forEach(function (v, i) { u[o++] = i >> 8; u[o++] = i & 255; u[o++] = v[0]; u[o++] = v[1]; });
      comprimir(u).then(function (c) { publicar('/mundo/' + k, 'z' + base64(c), true); });
    });
  }
  function trozoRecibido(k, carga) {
    if (!/^-?\d+_-?\d+$/.test(k) || carga.length > 600000) return;
    var s = carga.toString();
    if (s[0] !== 'z') return;
    var p = k.split('_'), cx = +p[0], cz = +p[1];
    descomprimir(desdeBase64(s.slice(1))).then(function (u) {
      if (!R.sala) return;
      var mp = cambios.get(k) || new Map(), lista = [];
      for (var o = 0; o + 3 < u.length; o += 4) {
        var i = (u[o] << 8) | u[o + 1];
        // lo propio pendiente de mandar gana (es más nuevo)
        if (pendientesTrozo.has(k) && mp.has(i)) continue;
        mp.set(i, [u[o + 2], u[o + 3]]);
        lista.push(i, u[o + 2], u[o + 3]);
      }
      cambios.set(k, mp);
      if (lista.length && ganchos.trozo) ganchos.trozo(cx, cz, lista);
    }).catch(function () { /* algo roto: se ignora */ });
  }
  // todos los cambios conocidos (para aplicar a un trozo que se genera recién)
  R.cambiosDe = function (cx, cz) { return cambios.get(cx + '_' + cz) || null; };
  R.reiniciarCambios = function () { cambios.clear(); };

  function comprimir(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(u8);
    return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function descomprimir(u8) {
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function base64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  function desdeBase64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

  // ------------------------------------------------------------------------------------------
  // Cuántos hay en cada mundo público (para la lista de servidores): una conexión que sólo escucha
  // los estados de esas salas un rato
  // ------------------------------------------------------------------------------------------
  var espia = null, vistos = {};
  R.mirarSalas = function (salas, cambio) {
    if (espia || R.sala) return;
    biblioteca().then(function (mqtt) {
      if (espia || R.sala) return;
      espia = mqtt.connect(BROKER, { clientId: 'mc12v_' + Math.random().toString(36).slice(2, 10), clean: true, reconnectPeriod: 0, connectTimeout: 8000 });
      espia.on('connect', function () { espia.subscribe(salas.map(function (s) { return NS + s + '/state'; })); });
      espia.on('message', function (t, c) {
        var sala = String(t).slice(NS.length, -6), d;
        try { d = JSON.parse(c.toString()); } catch (e) { return; }
        if (!d || typeof d.id !== 'string' || d.id === R.MY_ID) return;
        (vistos[sala] = vistos[sala] || {})[d.id] = performance.now();
        if (cambio) cambio();
      });
      espia.on('error', function () { R.dejarDeMirar(); if (cambio) cambio(true); });
    }).catch(function () { if (cambio) cambio(true); });
  };
  R.dejarDeMirar = function () { if (espia) { try { espia.end(true); } catch (e) { /* nada */ } espia = null; } };
  R.jugadoresEn = function (sala) {
    var v = vistos[sala], n = 0, ahora = performance.now();
    if (!v) return 0;
    for (var k in v) if (ahora - v[k] < 6000) n++;
    return n;
  };
  return R;
})();
