/* web.js — lo que en un APK hace la parte nativa, hecho en el navegador.
 *
 * Al sacar un juego de su envoltorio Android se pierden cuatro cosas que nadie
 * nota hasta que faltan: el botón atrás pausaba, la pantalla no se apagaba,
 * era pantalla completa y estaba trabado en horizontal. Esto las devuelve:
 *
 *   Porteo.web({
 *     orientacion: 'landscape',          // o 'portrait', o null (libre)
 *     atras: function () { ... },        // default: manda Escape, como el APK
 *     alGirarMal: function () { ... },   // p. ej. pausar cuando lo ponen vertical
 *     despierto: true,                   // Wake Lock: que no se apague jugando
 *   });
 *
 * Adentro del APK de herramientas/porteo/apk también corre sin estorbar: ahí
 * el atrás lo maneja Juego.java preguntándole a window.porteoAtras.
 */
(function () {
  'use strict';
  var P = window.Porteo = window.Porteo || {};

  function escape() {
    var t = document.activeElement || document.body || document;
    ['keydown', 'keyup'].forEach(function (n) {
      var e = new KeyboardEvent(n, { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
      try {
        Object.defineProperty(e, 'keyCode', { get: function () { return 27; } });
        Object.defineProperty(e, 'which', { get: function () { return 27; } });
      } catch (_) {}
      t.dispatchEvent(e);
    });
  }

  function aviso(txt) {
    var a = document.getElementById('porteo-aviso');
    if (!a) {
      a = document.createElement('div');
      a.id = 'porteo-aviso';
      a.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);z-index:2147483646;' +
        'background:rgba(0,0,0,.8);color:#fff;font:600 14px system-ui,sans-serif;padding:9px 16px;' +
        'border-radius:20px;pointer-events:none;transition:opacity .3s;opacity:0';
      document.body.appendChild(a);
    }
    a.textContent = txt;
    a.style.opacity = 1;
    clearTimeout(a._t);
    a._t = setTimeout(function () { a.style.opacity = 0; }, 1800);
  }
  P.aviso = aviso;

  // Un texto puede ser una función: así sigue el idioma que el jugador elija
  // adentro del juego, que puede cambiar después de arrancar.
  function texto(v, def) { try { return (typeof v === 'function' ? v() : v) || def; } catch (_) { return def; } }

  P.web = function (cfg) {
    cfg = cfg || {};
    var atras = cfg.atras || escape;
    var enApk = /; wv\)/.test(navigator.userAgent) && location.host === 'appassets.androidplatform.net';

    // ---- atrás: primero pausa, dos seguidos salen ----
    var ultimo = 0;
    window.porteoAtras = function () {
      var ahora = Date.now();
      if (ahora - ultimo < 2000) return 'salir';
      ultimo = ahora;
      atras();
      aviso(texto(cfg.textoSalir, 'Atrás otra vez para salir'));
      return true;
    };
    if (!enApk && history.pushState) {
      // En el navegador el gesto atrás es "volver de página". Se le pone una
      // entrada de historial de colchón: el primer atrás la gasta y pausa; el
      // segundo, dentro de 2 s, sí se va.
      // El colchón se pone en el PRIMER TOQUE y no al cargar: Chrome se saltea
      // con el botón atrás las entradas que una página agrega sin que nadie la
      // haya tocado (contra los sitios que secuestran el atrás). Puesto al
      // cargar, el primer atrás se iba del juego en vez de pausar.
      var colchon = false;
      addEventListener('pointerup', function () {
        if (colchon) return;
        colchon = true;
        history.pushState({ porteo: 1 }, '');
      }, true);
      addEventListener('popstate', function () {
        if (!colchon) return;
        if (window.porteoAtras() === 'salir') { history.back(); return; }
        history.pushState({ porteo: 1 }, '');
      });
    }

    // ---- pantalla completa + orientación, al primer toque ----
    // Los navegadores sólo dejan pedirlas dentro de un gesto del usuario.
    // Un solo pedido a la vez: el pedido gasta el permiso del gesto, y uno
    // segundo mientras el primero está en curso falla y ensucia la consola.
    var pidiendo = false;
    function completa() {
      if (enApk || cfg.completa === false || pidiendo) return;
      var d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
      if (!f || document.fullscreenElement || document.webkitFullscreenElement) return;
      pidiendo = true;
      try {
        var p = f.call(d, { navigationUI: 'hide' });
        if (p && p.then) p.then(trabar, function () {}).then(function () { pidiendo = false; });
        else pidiendo = false;
      } catch (_) { pidiendo = false; }
    }
    function trabar() {
      if (cfg.orientacion && screen.orientation && screen.orientation.lock)
        screen.orientation.lock(cfg.orientacion).catch(function () {});
    }
    // pointerup alcanza: todo navegador de teléfono que tenga pantalla completa
    // tiene pointer events. Escuchar también touchend duplicaba el pedido.
    addEventListener('pointerup', completa, true);

    // ---- el cartel de "girá el teléfono", para donde no se puede trabar (iPhone) ----
    if (cfg.orientacion) {
      var quiere = cfg.orientacion.indexOf('portrait') === 0 ? 'portrait' : 'landscape';
      var contrario = quiere === 'landscape' ? 'portrait' : 'landscape';
      var st = document.createElement('style');
      st.textContent =
        '#porteo-girar{display:none;position:fixed;inset:0;z-index:2147483647;background:#05070d;color:#fff;' +
        'flex-direction:column;align-items:center;justify-content:center;gap:22px;font:600 17px system-ui,sans-serif;text-align:center;padding:24px}' +
        '#porteo-girar i{width:46px;height:80px;border:4px solid #fff;border-radius:9px;animation:porteo-gira 1.8s ease-in-out infinite}' +
        '@keyframes porteo-gira{0%,25%{transform:rotate(0)}60%,100%{transform:rotate(' + (quiere === 'landscape' ? '-90' : '90') + 'deg)}}' +
        '@media (orientation:' + contrario + ') and (pointer:coarse){#porteo-girar{display:flex}}';
      document.head.appendChild(st);
      var g = document.createElement('div');
      g.id = 'porteo-girar';
      g.innerHTML = '<i></i><span></span>';
      var rotulo = function () {
        g.lastChild.textContent = texto(cfg.textoGirar, quiere === 'landscape' ? 'Girá el teléfono' : 'Poné el teléfono derecho');
      };
      rotulo();
      document.body.appendChild(g);
      var mq = matchMedia('(orientation:' + contrario + ') and (pointer:coarse)');
      var mal = function () {
        rotulo();
        if (mq.matches && cfg.alGirarMal) try { cfg.alGirarMal(); } catch (_) {}
      };
      mq.addEventListener ? mq.addEventListener('change', mal) : mq.addListener(mal);
    }

    // ---- que la pantalla no se apague a mitad de partida ----
    if (cfg.despierto !== false && navigator.wakeLock) {
      var lock = null;
      var pedir = function () {
        if (lock || document.hidden) return;
        navigator.wakeLock.request('screen').then(function (l) {
          lock = l;
          l.addEventListener('release', function () { lock = null; });
        }).catch(function () {});
      };
      addEventListener('pointerup', pedir, true);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) pedir(); });
    }

    // ---- sin menú de "copiar imagen" ni zoom con dos dedos ----
    addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    // ---- funciona sin internet una vez abierto (si hay sw.js al lado) ----
    if (cfg.offline !== false && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !enApk) {
      navigator.serviceWorker.register(cfg.offline || 'sw.js').catch(function () {});
    }
  };
})();
