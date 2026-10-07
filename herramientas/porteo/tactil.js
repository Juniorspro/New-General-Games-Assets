/* tactil.js — controles táctiles para juegos de teclado, sin tocar el juego.
 *
 * El joystick y los botones FABRICAN eventos de teclado (keydown/keyup) con
 * key, code, keyCode y which. El juego cree que alguien está apretando el
 * teclado: no hay que reescribir su entrada, que es justo lo que más se rompe
 * al portear. Se carga con un <script> después del juego:
 *
 *   <script src="tactil.js"></script>
 *   <script>
 *     Porteo.tactil({
 *       joystick: { teclas: 'flechas' },            // o 'wasd', o {arriba:'KeyW',...}
 *       botones: [ { texto: 'A', tecla: 'Space' }, { texto: 'B', tecla: 'KeyX' } ],
 *       arriba:  [ { texto: '❚❚', tecla: 'Escape' } ],
 *     });
 *   </script>
 *
 * Opciones de cada botón: texto, tecla (un `code`: 'Space', 'KeyZ', 'Enter'...),
 * color, mantener (default true: keydown al tocar, keyup al soltar; con false
 * manda los dos juntos, para menús que miran keyup).
 * Opciones generales: objetivo (elemento que recibe los eventos; default
 * document, que también llega a window), siempre (mostrar aunque no haya
 * pantalla táctil), escala (1 = tamaño normal), ocultarConTeclado (default true).
 */
(function () {
  'use strict';
  var P = window.Porteo = window.Porteo || {};

  // code -> [key, keyCode]. keyCode está deprecado pero la mitad de los juegos
  // viejos (y Construct 2, y RPG Maker MV) todavía leen sólo eso.
  var TECLAS = {
    ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39],
    Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9], Backspace: ['Backspace', 8],
    ShiftLeft: ['Shift', 16], ShiftRight: ['Shift', 16], ControlLeft: ['Control', 17], ControlRight: ['Control', 17],
    AltLeft: ['Alt', 18], AltRight: ['Alt', 18], PageUp: ['PageUp', 33], PageDown: ['PageDown', 34],
    Home: ['Home', 36], End: ['End', 35], Insert: ['Insert', 45], Delete: ['Delete', 46],
    Comma: [',', 188], Period: ['.', 190], Slash: ['/', 191], Semicolon: [';', 186], Minus: ['-', 189], Equal: ['=', 187],
    BracketLeft: ['[', 219], BracketRight: [']', 221], Backquote: ['`', 192], Quote: ["'", 222], Backslash: ['\\', 220],
  };
  for (var i = 0; i < 26; i++) {
    var L = String.fromCharCode(65 + i);
    TECLAS['Key' + L] = [L.toLowerCase(), 65 + i];
  }
  for (i = 0; i < 10; i++) TECLAS['Digit' + i] = ['' + i, 48 + i];
  for (i = 1; i <= 12; i++) TECLAS['F' + i] = ['F' + i, 111 + i];

  var JOY = {
    flechas: { arriba: 'ArrowUp', abajo: 'ArrowDown', izquierda: 'ArrowLeft', derecha: 'ArrowRight' },
    wasd: { arriba: 'KeyW', abajo: 'KeyS', izquierda: 'KeyA', derecha: 'KeyD' },
  };

  var apretadas = {};   // code -> cuántos dedos la sostienen
  var objetivo = document;

  function evento(tipo, code) {
    var t = TECLAS[code] || [code, 0];
    var e = new KeyboardEvent(tipo, { key: t[0], code: code, bubbles: true, cancelable: true, repeat: false });
    // El constructor ignora keyCode/which: hay que pisarlos a mano.
    try {
      Object.defineProperty(e, 'keyCode', { get: function () { return t[1]; } });
      Object.defineProperty(e, 'which', { get: function () { return t[1]; } });
      Object.defineProperty(e, 'charCode', { get: function () { return tipo === 'keypress' ? t[1] : 0; } });
    } catch (_) {}
    var o = typeof objetivo === 'function' ? objetivo() : objetivo;
    (o || document).dispatchEvent(e);
  }

  // Cuenta referencias: si el joystick y un botón sostienen la misma tecla,
  // soltar uno no la suelta.
  function bajar(code) {
    apretadas[code] = (apretadas[code] || 0) + 1;
    if (apretadas[code] === 1) { evento('keydown', code); if (TECLAS[code] && TECLAS[code][0].length === 1) evento('keypress', code); }
  }
  function subir(code) {
    if (!apretadas[code]) return;
    if (--apretadas[code] === 0) { delete apretadas[code]; evento('keyup', code); }
  }
  function soltarTodo() { Object.keys(apretadas).forEach(function (c) { apretadas[c] = 1; subir(c); }); }
  P.tecla = { bajar: bajar, subir: subir, soltarTodo: soltarTodo, apretadas: apretadas };

  var CSS =
    '.porteo-capa{position:fixed;inset:0;pointer-events:none;z-index:2147483000;' +
    '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;' +
    'font-family:system-ui,sans-serif}' +
    '.porteo-capa *{box-sizing:border-box}' +
    '.porteo-zona{position:absolute;pointer-events:auto;touch-action:none}' +
    '.porteo-base,.porteo-palo{position:absolute;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%)}' +
    '.porteo-base{border:2px solid rgba(255,255,255,.35);background:rgba(0,0,0,.18)}' +
    '.porteo-palo{background:rgba(255,255,255,.45);box-shadow:0 0 8px rgba(0,0,0,.4)}' +
    '.porteo-bot{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;display:flex;' +
    'align-items:center;justify-content:center;color:#fff;font-weight:700;text-shadow:0 1px 2px #000;' +
    'border:2px solid rgba(255,255,255,.4);background:rgba(0,0,0,.25);transition:transform .05s,background .05s}' +
    '.porteo-bot.on{transform:scale(.9);background:rgba(255,255,255,.35)}' +
    '.porteo-oculto{display:none}';

  P.tactil = function (cfg) {
    cfg = cfg || {};
    if (cfg.objetivo) objetivo = cfg.objetivo;
    var esTactil = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
    if (!esTactil && !cfg.siempre) return null;

    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    var capa = document.createElement('div');
    capa.className = 'porteo-capa';
    document.body.appendChild(capa);

    var escala = cfg.escala || 1;
    function lado() { return Math.min(innerWidth, innerHeight); }

    // ---- joystick: aparece donde apoya el pulgar en la mitad izquierda ----
    if (cfg.joystick) {
      var mapa = typeof cfg.joystick.teclas === 'object' ? cfg.joystick.teclas : JOY[cfg.joystick.teclas || 'flechas'];
      var ocho = cfg.joystick.diagonales !== false;
      var zona = document.createElement('div');
      zona.className = 'porteo-zona';
      zona.style.cssText = 'left:0;bottom:0;width:' + (cfg.joystick.ancho || 45) + '%;height:' + (cfg.joystick.alto || 70) + '%';
      var base = document.createElement('div'); base.className = 'porteo-base';
      var palo = document.createElement('div'); palo.className = 'porteo-palo';
      zona.appendChild(base); zona.appendChild(palo);
      capa.appendChild(zona);

      var dedo = null, cx = 0, cy = 0, dirs = {};
      P.eje = { x: 0, y: 0 };
      function radio() { return Math.max(45, Math.min(85, lado() * 0.13)) * escala; }
      function reposo() {
        // En reposo queda a la vista: si no, nadie sabe que existe.
        var r = radio(), z = zona.getBoundingClientRect();
        cx = r * 1.6 + 8; cy = z.height - r * 1.6 - 8;
        dibujar(cx, cy, 0.45);
      }
      function dibujar(x, y, alfa) {
        var r = radio();
        base.style.width = base.style.height = 2 * r + 'px';
        palo.style.width = palo.style.height = r * 0.9 + 'px';
        base.style.left = cx + 'px'; base.style.top = cy + 'px';
        palo.style.left = x + 'px'; palo.style.top = y + 'px';
        base.style.opacity = palo.style.opacity = alfa;
      }
      function direcciones(dx, dy) {
        var r = radio(), d = Math.hypot(dx, dy), nuevo = {};
        P.eje.x = Math.max(-1, Math.min(1, dx / r)); P.eje.y = Math.max(-1, Math.min(1, dy / r));
        if (d > r * 0.3) {
          var a = Math.atan2(dy, dx), s = ocho ? Math.PI / 8 : Math.PI / 4;
          // Sectores de 45° (ocho direcciones) o de 90° (sólo cuatro).
          if (ocho) {
            if (Math.abs(a) < 3 * s) nuevo.derecha = 1;
            if (Math.abs(a) > 5 * s) nuevo.izquierda = 1;
            if (a > s && a < 7 * s) nuevo.abajo = 1;
            if (a < -s && a > -7 * s) nuevo.arriba = 1;
          } else {
            if (Math.abs(a) <= s) nuevo.derecha = 1;
            else if (Math.abs(a) >= 3 * s) nuevo.izquierda = 1;
            else if (a > 0) nuevo.abajo = 1; else nuevo.arriba = 1;
          }
        }
        for (var k in dirs) if (!nuevo[k]) subir(mapa[k]);
        for (k in nuevo) if (!dirs[k]) bajar(mapa[k]);
        dirs = nuevo;
      }
      zona.addEventListener('pointerdown', function (e) {
        if (dedo !== null) return;
        dedo = e.pointerId;
        try { zona.setPointerCapture(e.pointerId); } catch (_) {}
        var z = zona.getBoundingClientRect();
        cx = e.clientX - z.left; cy = e.clientY - z.top;
        dibujar(cx, cy, 1);
        e.preventDefault();
      });
      zona.addEventListener('pointermove', function (e) {
        if (e.pointerId !== dedo) return;
        var z = zona.getBoundingClientRect(), r = radio();
        var dx = e.clientX - z.left - cx, dy = e.clientY - z.top - cy, d = Math.hypot(dx, dy);
        if (d > r * 1.6) { // el pulgar se fue lejos: la base lo sigue
          cx += dx * (1 - r * 1.6 / d); cy += dy * (1 - r * 1.6 / d);
          dx = e.clientX - z.left - cx; dy = e.clientY - z.top - cy; d = Math.hypot(dx, dy);
        }
        var k = d > r ? r / d : 1;
        dibujar(cx + dx * k, cy + dy * k, 1);
        direcciones(dx, dy);
        e.preventDefault();
      });
      function fin(e) {
        if (e.pointerId !== dedo) return;
        dedo = null; direcciones(0, 0); reposo();
      }
      zona.addEventListener('pointerup', fin);
      zona.addEventListener('pointercancel', fin);
      addEventListener('resize', function () { if (dedo === null) reposo(); });
      requestAnimationFrame(reposo);
    }

    // ---- botones de acción: abanico abajo a la derecha ----
    var botones = [];
    function boton(b, x, y, tam) {
      var el = document.createElement('div');
      el.className = 'porteo-bot';
      el.textContent = b.texto || '';
      if (b.color) el.style.borderColor = b.color;
      capa.appendChild(el);
      var dedos = {};
      function on(e) {
        e.preventDefault();
        dedos[e.pointerId] = 1;
        el.classList.add('on');
        if (b.mantener === false) { bajar(b.tecla); subir(b.tecla); }
        else if (Object.keys(dedos).length === 1) bajar(b.tecla);
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
      }
      function off(e) {
        if (!dedos[e.pointerId]) return;
        delete dedos[e.pointerId];
        if (Object.keys(dedos).length) return;
        el.classList.remove('on');
        if (b.mantener !== false) subir(b.tecla);
      }
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      // Deslizar el dedo fuera del botón lo suelta, como un botón físico.
      el.addEventListener('pointerleave', off);
      botones.push({ el: el, pos: function () { var p = x(), q = y(), t = tam(); el.style.width = el.style.height = t + 'px'; el.style.fontSize = t * 0.36 + 'px'; el.style.left = p - t / 2 + 'px'; el.style.top = q - t / 2 + 'px'; } });
    }
    var acc = cfg.botones || [];
    // Posiciones en un arco alrededor del pulgar derecho, de 1 a 6 botones.
    var ARCO = [[0, 0], [-1.15, 0.35], [0.1, -1.15], [-1.1, -0.85], [-2.25, 0.5], [-0.75, -2.0]];
    acc.forEach(function (b, n) {
      var tam = function () { return Math.max(56, Math.min(96, lado() * 0.15)) * escala * (b.tam || 1); };
      var o = b.pos || ARCO[n % ARCO.length];
      boton(b,
        function () { return innerWidth - tam() * 0.85 - 12 + o[0] * tam() * 1.05; },
        function () { return innerHeight - tam() * 0.85 - 12 + o[1] * tam() * 1.05; },
        tam);
    });
    (cfg.arriba || []).forEach(function (b, n) {
      var tam = function () { return Math.max(40, Math.min(56, lado() * 0.09)) * escala; };
      boton(b, function () { return innerWidth - tam() * (0.75 + n * 1.2) - 10; }, function () { return tam() * 0.75 + 10; }, tam);
    });
    function ubicar() { botones.forEach(function (b) { b.pos(); }); }
    addEventListener('resize', ubicar);
    ubicar();

    // Teclas pegadas: si la app pierde el foco con un dedo apoyado, el keyup
    // no llega nunca y el personaje camina solo para siempre.
    addEventListener('blur', soltarTodo);
    document.addEventListener('visibilitychange', function () { if (document.hidden) soltarTodo(); });

    // Si aparece un teclado o mando de verdad, los controles se esconden.
    if (cfg.ocultarConTeclado !== false) {
      addEventListener('keydown', function (e) { if (e.isTrusted) capa.classList.add('porteo-oculto'); }, true);
      addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') capa.classList.remove('porteo-oculto'); }, true);
    }
    P.capa = capa;
    return capa;
  };

  // Que la página no se comporte como página: sin zoom, sin rebote, sin menú
  // de copiar, y pantalla completa al primer toque (en el navegador; en el
  // APK ya lo es).
  P.pantalla = function (cfg) {
    cfg = cfg || {};
    var vp = document.querySelector('meta[name=viewport]');
    if (!vp) { vp = document.createElement('meta'); vp.name = 'viewport'; document.head.appendChild(vp); }
    vp.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
    var s = document.createElement('style');
    s.textContent = 'html,body{overscroll-behavior:none;-webkit-user-select:none;user-select:none;' +
      '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}' +
      (cfg.encajar ? 'html,body{margin:0;height:100%;overflow:hidden;background:#000}' : '');
    document.head.appendChild(s);
    addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var hecho = false;
    function completa() {
      if (hecho || cfg.completa === false) return;
      hecho = true;
      var d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
      if (f && !document.fullscreenElement) {
        try {
          var p = f.call(d, { navigationUI: 'hide' });
          if (p && p.then && cfg.orientacion && screen.orientation && screen.orientation.lock)
            p.then(function () { return screen.orientation.lock(cfg.orientacion); }).catch(function () {});
        } catch (_) {}
      }
    }
    addEventListener('pointerup', completa, true);
    // Encajar un canvas de tamaño fijo (juegos de PC de 800x600) en cualquier
    // pantalla manteniendo la proporción, sin tocar su resolución interna.
    if (cfg.encajar) {
      var cv = typeof cfg.encajar === 'string' ? document.querySelector(cfg.encajar) : cfg.encajar;
      var f2 = function () {
        if (!cv) return;
        var w = cv.width, h = cv.height, k = Math.min(innerWidth / w, innerHeight / h);
        cv.style.cssText += ';position:fixed;left:50%;top:50%;width:' + w * k + 'px;height:' + h * k +
          'px;transform:translate(-50%,-50%);image-rendering:' + (cfg.pixelado ? 'pixelated' : 'auto');
      };
      addEventListener('resize', f2); f2();
    }
  };
})();
