// porteo: los sonidos del juego (sacados de sus FSB a un solo .ogg, ver sonidos.py) con Web Audio.
// Se decodifica una vez a un contexto de 22 kHz: los efectos suenan igual y ocupan la mitad de
// memoria que a 48 kHz (importa en los teléfonos de 1 GB). El navegador no deja sonar nada antes del
// primer toque: el contexto se "desbloquea" ahí.
var Sonido = (function () {
  'use strict';
  var S = {};
  var ctx = null, maestro = null, todo = null, tabla = {}, volumen = 0.8, oyente = { x: 0, y: 0, z: 0 };
  // los paquetes de cada bicho (sonidos_<bicho>.ogg): se decodifican recién cuando hacen falta
  var grupos = {}, deGrupo = {}, buffers = {}, cargando = {};

  function crear() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { return new AC({ sampleRate: 22050, latencyHint: 'interactive' }); } catch (e) { /* no deja elegir */ }
    try { return new AC(); } catch (e) { return null; }
  }

  S.iniciar = function (bytes, t) {
    // t: { base: { evento: [[inicio, dur], ...] }, grupos: { bicho: {...} } }
    tabla = (t && t.base) || t || {};
    grupos = (t && t.grupos) || {};
    for (var g in grupos) for (var ev in grupos[g]) deGrupo[ev] = g;
    ctx = crear();
    if (!ctx) return Promise.resolve();
    maestro = ctx.createGain();
    maestro.gain.value = volumen;
    maestro.connect(ctx.destination);
    var desbloquear = function () {
      if (ctx.state === 'suspended') ctx.resume();
      // iOS: además hay que hacer sonar algo dentro del toque
      var b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    };
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { addEventListener(ev, desbloquear, { capture: true, passive: true }); });
    return new Promise(function (ok) {
      // decodeAudioData con promesa no anda en Safari viejo: con los dos callbacks
      try {
        ctx.decodeAudioData(bytes, function (b) { todo = b; ok(); }, function () { ok(); });
      } catch (e) { ok(); }
    });
  };

  S.volumen = function (v) { volumen = v; if (maestro) maestro.gain.value = v; };
  S.oyente = function (x, y, z) { oyente.x = x; oyente.y = y; oyente.z = z; };

  // suena un evento (una de sus variantes al azar). Con posición: más bajo con la distancia, hasta 16
  // bloques (como el juego)
  // trae y decodifica el paquete de un bicho (cuando aparece, para que ya esté al sonar)
  S.precargar = function (g) {
    if (!ctx || !grupos[g] || buffers[g] || cargando[g]) return;
    cargando[g] = true;
    fetch('datos/sonidos_' + g + '.ogg').then(function (r) { return r.arrayBuffer(); }).then(function (b) {
      try { ctx.decodeAudioData(b, function (buf) { buffers[g] = buf; }, function () { /* sin ese paquete */ }); } catch (e) { /* idem */ }
    }).catch(function () { cargando[g] = false; });
  };
  // los paquetes de todos estos eventos (los de un bicho que acaba de aparecer)
  S.precargarEventos = function (evs) { (evs || []).forEach(function (ev) { if (deGrupo[ev]) S.precargar(deGrupo[ev]); }); };
  // para las pruebas: qué paquetes ya están y lo último que sonó
  var ultimos = [];
  S.estado = function () { return { listos: Object.keys(buffers), cargando: Object.keys(cargando).filter(function (g) { return !buffers[g]; }), ultimos: ultimos.slice() }; };
  S.tocar = function (evento, vol, tono, x, y, z) {
    if (!todo || !ctx || ctx.state !== 'running' || volumen <= 0) return;
    var l = tabla[evento], fuente = todo;
    if (!l) {
      var g = deGrupo[evento];
      if (!g) return;
      if (!buffers[g]) { S.precargar(g); return; }
      l = grupos[g][evento]; fuente = buffers[g];
    }
    if (!l || !l.length) return;
    var p = l[Math.floor(Math.random() * l.length)];
    var g = vol === undefined ? 1 : vol;
    if (x !== undefined) {
      var dx = x - oyente.x, dy = y - oyente.y, dz = z - oyente.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      g *= Math.max(0, 1 - d / 16);
      if (g <= 0.01) return;
    }
    ultimos.push(evento); if (ultimos.length > 40) ultimos.shift();
    var s = ctx.createBufferSource(), v = ctx.createGain();
    s.buffer = fuente;
    s.playbackRate.value = tono || 1;
    v.gain.value = Math.min(1, g);
    s.connect(v); v.connect(maestro);
    s.start(0, p[0], p[1]);
    return s;
  };
  S.listo = function () { return !!todo; };
  return S;
})();
