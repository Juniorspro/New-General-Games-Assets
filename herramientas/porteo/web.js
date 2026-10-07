/* web.js — lo que en un APK hace la parte nativa, hecho en el navegador.
 *
 * Al sacar un juego de su envoltorio Android se pierden cuatro cosas que nadie
 * nota hasta que faltan: el botón atrás pausaba, la pantalla no se apagaba,
 * era pantalla completa y estaba trabado en horizontal. Esto las devuelve.
 * Con el teléfono parado, el juego se gira solo 90° (P.girar):
 *
 *   Porteo.web({
 *     orientacion: 'landscape',          // o 'portrait', o null (libre)
 *     atras: function () { ... },        // default: manda Escape, como el APK
 *     girar: true,                       // false = cartel de "girá el teléfono" en vez de girar
 *     alGirarMal: function () { ... },   // sólo con el cartel: p. ej. pausar
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

  // ───────────────── girar el juego 90° cuando el teléfono está parado ─────────────────
  // La página entera se rota con CSS y, para el código del juego, el mundo
  // pasa a ser horizontal: innerWidth/innerHeight, las coordenadas de cada
  // toque y los rectángulos de los elementos se traducen. Así anda también con
  // juegos que no son nuestros y no saben nada del giro (Bus Stop).
  //
  // El sentido sale del acelerómetro: el juego queda derecho para el lado que
  // se gire el teléfono. Sin sensor, 90° a la derecha (teléfono girado a la
  // izquierda, que es como lo agarra casi todo el mundo para jugar).
  var giro = null;
  P.girar = function (quiere) {
    if (giro) return giro;
    var buscar = function (o, k) { while (o) { var d = Object.getOwnPropertyDescriptor(o, k); if (d) return d; o = Object.getPrototypeOf(o); } return null; };
    var dW = buscar(window, 'innerWidth'), dH = buscar(window, 'innerHeight');
    var fisW = function () { return dW.get.call(window); }, fisH = function () { return dH.get.call(window); };
    var tactil = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
    var s = 1; // +1: el contenido gira 90° a la derecha; -1: a la izquierda
    var activo = function () {
      if (!tactil) return false;
      var vertical = fisH() > fisW();
      return quiere === 'landscape' ? vertical : !vertical;
    };
    // físico (lo que ve el navegador) → lógico (lo que ve el juego)
    var punto = function (px, py) { var W = fisW(), H = fisH(); return s > 0 ? [py, W - px] : [H - py, px]; };
    var rect = function (r) {
      var W = fisW(), H = fisH();
      return s > 0 ? new DOMRect(r.top, W - r.left - r.width, r.height, r.width)
                   : new DOMRect(H - r.top - r.height, r.left, r.height, r.width);
    };
    var pisar = function (o, k, f) {
      var d = buscar(o, k);
      if (!d || !d.get) return;
      Object.defineProperty(o, k, { configurable: true, enumerable: d.enumerable, get: function () { return f.call(this, d.get); } });
    };
    pisar(window, 'innerWidth', function () { return activo() ? fisH() : fisW(); });
    pisar(window, 'innerHeight', function () { return activo() ? fisW() : fisH(); });
    pisar(Element.prototype, 'clientWidth', function (g) {
      return this === document.documentElement && activo() ? fisH() : g.call(this);
    });
    pisar(Element.prototype, 'clientHeight', function (g) {
      return this === document.documentElement && activo() ? fisW() : g.call(this);
    });
    [[window.MouseEvent && MouseEvent.prototype, ['clientX', 'clientY', 'pageX', 'pageY', 'x', 'y']],
     [window.Touch && Touch.prototype, ['clientX', 'clientY', 'pageX', 'pageY']]].forEach(function (par) {
      if (!par[0]) return;
      var dd = {};
      par[1].forEach(function (k) { dd[k] = buscar(par[0], k); });
      par[1].forEach(function (k) {
        var ejeX = k === 'clientX' || k === 'pageX' || k === 'x';
        var hX = dd[k === 'x' || k === 'y' ? 'x' : k.replace(/Y$/, 'X')], hY = dd[k === 'x' || k === 'y' ? 'y' : k.replace(/X$/, 'Y')];
        if (!hX || !hY) return;
        pisar(par[0], k, function () {
          var px = hX.get.call(this), py = hY.get.call(this);
          if (!activo()) return ejeX ? px : py;
          var l = punto(px, py);
          return ejeX ? l[0] : l[1];
        });
      });
    });
    var gbcr = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      var r = gbcr.call(this);
      return activo() ? rect(r) : r;
    };

    // Las medidas en vw/vh del CSS del juego apuntarían al lado equivocado:
    // se reescriben como calc(n * var(--pvw)) y la variable dice el ancho girado.
    var unidades = function () {
      var arreglar = function (reglas) {
        for (var i = 0; i < reglas.length; i++) {
          var r = reglas[i];
          if (r.cssRules && !r.style) { arreglar(r.cssRules); continue; }
          if (!r.style) continue;
          for (var j = 0; j < r.style.length; j++) {
            var prop = r.style[j], v = r.style.getPropertyValue(prop);
            if (!/[\d.]v[wh]\b/.test(v)) continue;
            r.style.setProperty(prop, v.replace(/(-?[\d.]+)vw\b/g, 'calc($1 * var(--pvw, 1vw))')
              .replace(/(-?[\d.]+)vh\b/g, 'calc($1 * var(--pvh, 1vh))'), r.style.getPropertyPriority(prop));
          }
        }
      };
      for (var k = 0; k < document.styleSheets.length; k++) {
        try { arreglar(document.styleSheets[k].cssRules); } catch (_) {}
      }
    };

    var html = document.documentElement, antes = null, estado = '';
    var aplicar = function () {
      var a = activo(), W = fisW(), H = fisH(), b = document.body;
      var nuevo = a ? s + ':' + W + 'x' + H : '';
      if (nuevo === estado) return false;
      estado = nuevo;
      // null y no "falso": un estilo vacío ('') es falso y se volvía a
      // capturar ya girado, y al enderezar se restauraba el giro.
      if (antes === null) antes = b.getAttribute('style') || '';
      if (a) {
        b.setAttribute('style', antes + ';position:fixed!important;left:0!important;top:0!important;margin:0!important;' +
          'width:' + H + 'px!important;height:' + W + 'px!important;overflow:hidden!important;transform-origin:0 0!important;' +
          'transform:' + (s > 0 ? 'translate(' + W + 'px,0) rotate(90deg)' : 'translate(0,' + H + 'px) rotate(-90deg)') + '!important');
        html.style.setProperty('--pvw', H / 100 + 'px');
        html.style.setProperty('--pvh', W / 100 + 'px');
        html.style.overflow = 'hidden';
        html.classList.add('porteo-girado');
      } else {
        b.setAttribute('style', antes);
        html.style.removeProperty('--pvw');
        html.style.removeProperty('--pvh');
        html.classList.remove('porteo-girado');
      }
      return true;
    };
    var avisarJuego = function () { try { dispatchEvent(new Event('resize')); } catch (_) {} };
    addEventListener('resize', aplicar);
    addEventListener('orientationchange', function () { setTimeout(function () { if (aplicar()) avisarJuego(); }, 50); });
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    addEventListener('devicemotion', function (e) {
      var g = e.accelerationIncludingGravity;
      if (!g || g.x == null || !activo()) return;
      var x = ios ? -g.x : g.x; // Safari da la gravedad con el signo al revés
      var n = x > 4 ? 1 : x < -4 ? -1 : s;
      if (n !== s) { s = n; aplicar(); }
    });
    unidades();
    // El juego pudo acomodarse antes de que esto existiera: que se acomode de nuevo.
    if (aplicar()) avisarJuego();
    giro = { activo: activo, sentido: function () { return s; }, punto: punto, fisico: function () { return [fisW(), fisH()]; } };
    return giro;
  };

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

    // ---- teléfono en la orientación equivocada ----
    // Por defecto se GIRA EL JUEGO (P.girar): con el giro automático
    // bloqueado, que es lo común, un cartel de "girá el teléfono" no se va
    // nunca. El cartel queda sólo si se pide (girar: false).
    if (cfg.orientacion && cfg.girar !== false) {
      P.girar(cfg.orientacion.indexOf('portrait') === 0 ? 'portrait' : 'landscape');
    } else if (cfg.orientacion) {
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
        // alGirarBien existe para juegos sin pausa propia (FNaF 4): se los
        // congela mientras el cartel tapa y se los suelta al volver a girar.
        if (mq.matches && cfg.alGirarMal) try { cfg.alGirarMal(); } catch (_) {}
        if (!mq.matches && cfg.alGirarBien) try { cfg.alGirarBien(); } catch (_) {}
      };
      mq.addEventListener ? mq.addEventListener('change', mal) : mq.addListener(mal);
      if (mq.matches && cfg.alGirarMal) setTimeout(function () { try { cfg.alGirarMal(); } catch (_) {} }, 0);
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
