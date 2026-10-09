/*
 * porteo: que la página nunca quede en negro sin explicación. Junta lo que pasa (qué teléfono, si
 * hay WebGL 2, hasta dónde llegó la carga, los errores) y:
 *   - si algo grave falla (un error sin atajar antes de que el juego arranque, el contexto de
 *     WebGL perdido, no hay WebGL 2), lo dice en pantalla con un botón para recargar;
 *   - si se le da una dirección, lo manda ahí de a tandas (sendBeacon). Con la puerta de Cloudflare
 *     (herramientas/porteo/cloudflare) va a los registros del worker, que el dueño lee con
 *     "wrangler pages deployment tail": así se ve qué le pasa a un teléfono que uno no tiene a mano.
 *
 *   Porteo.registro({ url: '__registro' });   // al principio de la página
 *   Porteo.registro({ url: '…', webgl1: true }); // si el juego anda también con WebGL 1 (no avisa que falta el 2)
 *   Porteo.anotar('escena', 'MainMenu');      // un hito
 *   Porteo.arrancado();                       // el juego ya anda: los errores de ahí en más no paran todo
 *   Porteo.fallo('No se pudo bajar…', 'detalle');
 */
(function () {
  'use strict';
  var Porteo = window.Porteo = window.Porteo || {};
  var t0 = Date.now();
  var cola = [], url = null, mandados = 0, andando = false, panel = null;
  var MAXIMO = 600;   // eventos por visita: que un error en cada cuadro no llene los registros
  var sesion = Math.random().toString(36).slice(2, 8);
  var idioma = (navigator.language || 'es').slice(0, 2).toLowerCase();
  var T = {
    es: ['Algo falló', 'Recargar', 'Lo que ya se bajó queda guardado: recargar no lo vuelve a bajar.',
         'El teléfono se quedó sin memoria para los gráficos.', 'Este navegador no tiene WebGL 2 (hace falta para el juego). Probá con Chrome actualizado.'],
    en: ['Something went wrong', 'Reload', 'What was already downloaded is kept: reloading does not download it again.',
         'The phone ran out of graphics memory.', 'This browser has no WebGL 2 (the game needs it). Try an up-to-date Chrome.'],
    pt: ['Algo deu errado', 'Recarregar', 'O que já foi baixado fica salvo: recarregar não baixa de novo.',
         'O telefone ficou sem memória para os gráficos.', 'Este navegador não tem WebGL 2 (o jogo precisa). Tente o Chrome atualizado.'],
  }[idioma] || null;
  if (!T) T = { 0: 'Something went wrong', 1: 'Reload', 2: 'What was already downloaded is kept: reloading does not download it again.',
                3: 'The phone ran out of graphics memory.', 4: 'This browser has no WebGL 2 (the game needs it). Try an up-to-date Chrome.' };

  function anotar(tipo, dato) {
    if (mandados + cola.length >= MAXIMO) return;
    if (typeof dato === 'string' && dato.length > 600) dato = dato.slice(0, 600) + '…';
    cola.push([Date.now() - t0, tipo, dato]);
    if (tipo === 'error' || tipo === 'fallo' || tipo === 'contexto') setTimeout(mandar, 0);
  }

  function mandar() {
    if (!url || !cola.length) return;
    var lote = cola.splice(0, 80);
    mandados += lote.length;
    var cuerpo = JSON.stringify({ s: sesion, e: lote });
    try {
      if (!(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([cuerpo], { type: 'text/plain' }))))
        fetch(url, { method: 'POST', body: cuerpo, keepalive: true, credentials: 'same-origin' }).catch(function () {});
    } catch (e) { /* sin registro: el juego sigue igual */ }
    if (cola.length) setTimeout(mandar, 1000);
  }

  // qué hay del lado del teléfono (lo primero que se manda)
  function equipo() {
    var d = {
      ua: navigator.userAgent, pantalla: screen.width + 'x' + screen.height, ventana: innerWidth + 'x' + innerHeight,
      dpr: devicePixelRatio, memoria: navigator.deviceMemory, nucleos: navigator.hardwareConcurrency,
    };
    var c = navigator.connection;
    if (c) d.red = (c.effectiveType || '') + ' ' + (c.downlink || '?') + ' Mbps';
    try {
      var gl = document.createElement('canvas').getContext('webgl2');
      d.webgl2 = !!gl;
      if (gl) {
        var info = gl.getExtension('WEBGL_debug_renderer_info');
        d.gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        d.etc = !!gl.getExtension('WEBGL_compressed_texture_etc');
        d.astc = !!gl.getExtension('WEBGL_compressed_texture_astc');
        d.texturaMax = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        // que no quede un contexto de más ocupando memoria de la GPU
        var perder = gl.getExtension('WEBGL_lose_context');
        if (perder) perder.loseContext();
      }
    } catch (e) { d.webgl2 = 'error: ' + e.message; }
    return d;
  }

  // el aviso en pantalla, encima de todo (también de la pantalla de carga). sinGuardado: no decir que
  // lo bajado queda (cuando recargar justamente lo vuelve a bajar, ver arranque.js)
  function fallo(mensaje, detalle, sinGuardado) {
    anotar('fallo', mensaje + (detalle ? ' | ' + detalle : ''));
    mandar();
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'porteo-fallo';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483600;display:flex;flex-direction:column;align-items:center;' +
      'justify-content:center;gap:14px;padding:24px;box-sizing:border-box;background:rgba(10,6,18,.94);color:#fff;' +
      'font:15px/1.45 system-ui,sans-serif;text-align:center';
    var h = document.createElement('p');
    h.style.cssText = 'margin:0;font-weight:700;font-size:20px';
    h.textContent = T[0];
    var p = document.createElement('p');
    p.style.cssText = 'margin:0;max-width:34em';
    p.textContent = mensaje;
    var q = document.createElement('p');
    q.style.cssText = 'margin:0;max-width:40em;font-size:12px;color:rgba(255,255,255,.55);word-break:break-word';
    q.textContent = sinGuardado ? (detalle || '') : (detalle ? detalle + ' · ' : '') + T[2];
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = T[1];
    b.style.cssText = 'padding:10px 22px;border:0;border-radius:99px;background:#ff5c9a;color:#fff;font:600 16px system-ui,sans-serif;cursor:pointer';
    b.addEventListener('click', function () { location.reload(); });
    // por si no era tan grave: el juego sigue corriendo detrás
    var x = document.createElement('button');
    x.type = 'button';
    x.textContent = '×';
    x.setAttribute('aria-label', 'Cerrar');
    x.style.cssText = 'position:absolute;top:10px;right:14px;border:0;background:none;color:rgba(255,255,255,.6);font:28px system-ui,sans-serif;cursor:pointer';
    x.addEventListener('click', function () { panel.remove(); panel = null; });
    panel.appendChild(x); panel.appendChild(h); panel.appendChild(p); panel.appendChild(q); panel.appendChild(b);
    document.body.appendChild(panel);
  }

  Porteo.anotar = anotar;
  Porteo.fallo = fallo;
  Porteo.arrancado = function () { andando = true; anotar('arrancado', Date.now() - t0); mandar(); };
  Porteo.registro = function (op) {
    url = op && op.url || null;
    var d = equipo();
    anotar('equipo', d);
    mandar();
    if (d.webgl2 === false && !(op && op.webgl1)) fallo(T[4]);
  };

  addEventListener('error', function (e) {
    var t = (e.message || String(e.error || 'error')) + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '');
    anotar('error', t + (e.error && e.error.stack ? ' | ' + e.error.stack : ''));
    // antes de que el juego ande, un error sin atajar es que no va a arrancar
    if (!andando) fallo(t);
  });
  addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    var t = String(r && (r.message || r) || 'error');
    anotar('error', t + (r && r.stack ? ' | ' + r.stack : ''));
    if (!andando) fallo(t);
  });
  // lo que el motor y el arranque avisan como error (sin pararlo: muchos son del juego y no hacen nada)
  var errorOriginal = console.error;
  var errores = 0;
  console.error = function () {
    if (errores++ < 60) anotar('consola', Array.prototype.map.call(arguments, String).join(' '));
    return errorOriginal.apply(this, arguments);
  };
  // el contexto de WebGL se pierde cuando al teléfono le falta memoria: sin esto queda en negro
  document.addEventListener('webglcontextlost', function (e) {
    anotar('contexto', 'perdido');
    fallo(T[3]);
  }, true);
  addEventListener('pagehide', mandar);
  document.addEventListener('visibilitychange', function () { if (document.hidden) mandar(); });
  // cada 5 s lo que haya: si un teléfono se traba cargando, que llegue antes de que lo cierren
  setInterval(mandar, 5000);
})();
