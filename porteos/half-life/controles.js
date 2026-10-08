'use strict';
/* Controles táctiles de Half-Life, como los del porteo de CS 1.6 (al estilo de Standoff 2 / Blood Strike).
 *
 *   const c = Porteo.controlesHL(hl, opciones);   // hl: { comando(texto), mover(adelante, costado), mirar(giro, cabeceo) en grados (giro positivo: a la izquierda, como GoldSrc), estado() }
 *
 * - Izquierda: joystick que aparece donde se apoya el pulgar (camina más lento si se lo inclina poco).
 * - Derecha: arrastrar para mirar. El botón de disparo también apunta mientras se lo arrastra.
 * - Disparo grande a la derecha y otro a la izquierda; saltar (y nadar hacia arriba), agacharse
 *   (queda agachado hasta tocarlo de nuevo; agachado + saltar es el salto largo), recargar, disparo
 *   secundario, usar (puertas, botones, ascensores, que un científico o un guardia te siga).
 * - Abajo, las armas por casillero (1 palanca, 2 pistolas, 3 escopeta/ametralladora/ballesta,
 *   4 cohetes y armas pesadas, 5 granadas y explosivos; tocar de nuevo pasa a la siguiente del
 *   casillero) y "la anterior". Arriba: linterna, guardado rápido, carga rápida, ajustes y pausa.
 * - Sólo se ven jugando: en el menú y en la consola los toques van al juego, que los toma como el mouse.
 * - Con teclado o mouse se esconden solos (vuelven al tocar la pantalla).
 *
 * Mirar: grados por píxel = 0,22 × sensibilidad × (390 / alto de la pantalla), igual en cualquier
 * teléfono. Los ajustes quedan en localStorage ("hl-tactil"). Los nombres de los botones y el panel
 * de ajustes van en el idioma del juego (opciones.idioma: 'es' o 'en').
 */
(function () {
  var P = window.Porteo = window.Porteo || {};
  // Las medidas van en vh del lado corto. Con el teléfono parado web.js gira la página y deja en
  // --pvh y --pvw los vh y vw "girados": las reglas que ya estaban las reescribe él, pero éstas se
  // agregan después.
  var VH = function (css) {
    return css.replace(/(-?[\d.]+)vh\b/g, 'calc($1 * var(--pvh, 1vh))').replace(/(-?[\d.]+)vw\b/g, 'calc($1 * var(--pvw, 1vw))');
  };

  var SVG = function (d, extra) {
    return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"' +
      (extra || '') + '>' + d + '</svg>';
  };
  var ICONO = {
    fuego: SVG('<path d="M24 6c4 4 6 9 6 15v15H18V21c0-6 2-11 6-15z"/><path d="M16 40h16"/><path d="M18 36h12"/>'),
    saltar: SVG('<path d="M12 26l12-12 12 12"/><path d="M12 36l12-12 12 12"/>'),
    agachar: SVG('<path d="M12 14l12 12 12-12"/><path d="M12 36h24"/>'),
    recargar: SVG('<path d="M36 18a13 13 0 1 0 2 10"/><path d="M38 8v10H28"/>'),
    mira: SVG('<circle cx="24" cy="24" r="13"/><path d="M24 5v10M24 33v10M5 24h10M33 24h10"/>'),
    usar: SVG('<path d="M17 25V13a3 3 0 0 1 6 0v10"/><path d="M23 22v-3a3 3 0 0 1 6 0v4"/><path d="M29 23a3 3 0 0 1 6 0v6c0 7-4 12-11 12-5 0-8-2-10-6l-4-8a3 3 0 0 1 5-3l2 3"/>'),
    linterna: SVG('<path d="M10 20h14l8-6v20l-8-6H10z"/><path d="M36 17l6-3M36 24h7M36 31l6 3"/>'),
    guardar: SVG('<path d="M10 8h24l6 6v26H10z"/><path d="M16 8v10h14V8"/><rect x="16" y="26" width="16" height="10"/>'),
    cargar: SVG('<path d="M24 8v20"/><path d="M15 19l9 9 9-9"/><path d="M8 34v6h32v-6"/>'),
    ajustes: SVG('<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>'),
    pausa: SVG('<path d="M18 12v24M30 12v24"/>'),
    anterior: SVG('<path d="M20 14l-10 10 10 10"/><path d="M10 24h18a10 10 0 0 1 0 20h-4"/>'),
  };

  var CSS = '' +
    '#hl-tactil{position:fixed;inset:0;z-index:20;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none;' +
      '-webkit-touch-callout:none;font-family:system-ui,sans-serif;--op:.6}' +
    '#hl-tactil.oculto{display:none}' +
    '#hl-tactil .zona{position:absolute;pointer-events:auto}' +
    '#hl-tactil .bt{position:absolute;pointer-events:auto;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'color:rgba(255,255,255,.92);background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.55);opacity:var(--op);' +
      'box-sizing:border-box;transition:transform .06s,background .06s}' +
    '#hl-tactil .bt svg{width:52%;height:52%}' +
    '#hl-tactil .bt.ap{background:rgba(255,255,255,.32);transform:scale(.93)}' +
    '#hl-tactil .bt.fijo{background:rgba(255,190,60,.38);border-color:rgba(255,210,120,.9)}' +
    '#hl-tactil .bt.fuego{background:rgba(160,20,20,.32);border-color:rgba(255,120,120,.7)}' +
    '#hl-tactil .bt.fuego.ap{background:rgba(230,60,60,.5)}' +
    '#hl-tactil .chico{border-radius:12px}' +
    '#hl-tactil .arma{position:absolute;pointer-events:auto;border-radius:10px;color:#fff;font:700 4.4vh system-ui,sans-serif;' +
      'background:rgba(0,0,0,.3);border:2px solid rgba(255,255,255,.45);opacity:var(--op);display:flex;align-items:center;' +
      'justify-content:center;box-sizing:border-box}' +
    '#hl-tactil .arma.ap{background:rgba(255,255,255,.3)}' +
    '#hl-tactil .base{position:absolute;width:24vh;height:24vh;margin:-12vh 0 0 -12vh;border-radius:50%;' +
      'border:2px solid rgba(255,255,255,.45);background:rgba(0,0,0,.18);opacity:var(--op);pointer-events:none}' +
    '#hl-tactil .palanca{position:absolute;left:50%;top:50%;width:10vh;height:10vh;margin:-5vh 0 0 -5vh;border-radius:50%;' +
      'background:rgba(255,255,255,.55)}' +
    '#hl-tactil .base.reposo{opacity:calc(var(--op) * .45)}' +
    '#hl-panel{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);' +
      'font:600 15px system-ui,sans-serif;color:#fff;touch-action:manipulation}' +
    '#hl-panel.si{display:flex}' +
    '#hl-panel .caja{background:rgba(20,20,20,.92);border:1px solid rgba(255,200,90,.6);border-radius:12px;padding:14px 18px;' +
      'max-width:92vw;max-height:88vh;overflow:auto}' +
    '#hl-panel h3{margin:0 0 10px;color:#ffc864;font-size:16px}' +
    '#hl-panel .fila{display:flex;align-items:center;gap:12px;margin:10px 0}' +
    '#hl-panel input[type=range]{width:220px}' +
    '#hl-panel button{font:600 15px system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.35);' +
      'border-radius:8px;padding:9px 14px;margin:3px;min-height:44px}' +
    '#hl-panel .aviso{margin:6px 0 2px;color:rgba(255,255,255,.7);font-size:13px}';

  var TEXTOS = {
    es: { disparar: 'Disparar', saltar: 'Saltar', agacharse: 'Agacharse', recargar: 'Recargar', secundario: 'Disparo secundario',
      usar: 'Usar', armas: 'Armas', anterior: 'Arma anterior', linterna: 'Linterna', guardar: 'Guardado rápido',
      cargar: 'Carga rápida', ajustes: 'Ajustes', pausa: 'Pausa', controles: 'Controles', sens: 'Sensibilidad',
      opacidad: 'Opacidad', izq: 'Botón de disparo a la izquierda', fijo: 'Agacharse queda fijo (tocar de nuevo para pararse)', listo: 'Listo' },
    en: { disparar: 'Fire', saltar: 'Jump', agacharse: 'Crouch', recargar: 'Reload', secundario: 'Secondary fire',
      usar: 'Use', armas: 'Weapons', anterior: 'Previous weapon', linterna: 'Flashlight', guardar: 'Quick save',
      cargar: 'Quick load', ajustes: 'Settings', pausa: 'Pause', controles: 'Controls', sens: 'Sensitivity',
      opacidad: 'Opacity', izq: 'Fire button on the left', fijo: 'Crouch stays on (tap again to stand up)', listo: 'Done' },
  };

  P.controlesHL = function (hl, opciones) {
    opciones = opciones || {};
    var T = TEXTOS[opciones.idioma] || TEXTOS.es;
    var guardado = {};
    try { guardado = JSON.parse(localStorage.getItem('hl-tactil') || '{}') || {}; } catch (_) { guardado = {}; }
    var aj = { sens: 1, opacidad: 0.6, disparoIzq: true, agacharseFijo: true };
    Object.keys(aj).forEach(function (k) { if (guardado[k] !== undefined) aj[k] = guardado[k]; });
    var guardar = function () { try { localStorage.setItem('hl-tactil', JSON.stringify(aj)); } catch (_) { /* sin almacenamiento */ } };

    var estilo = document.createElement('style');
    estilo.textContent = VH(CSS);
    document.head.appendChild(estilo);
    var raiz = document.createElement('div');
    raiz.id = 'hl-tactil';
    raiz.className = 'oculto';
    document.body.appendChild(raiz);
    var panel = document.createElement('div');
    panel.id = 'hl-panel';
    document.body.appendChild(panel);
    var aplicarAjustes = function () { raiz.style.setProperty('--op', aj.opacidad); if (bIzq) bIzq.style.display = aj.disparoIzq ? '' : 'none'; };

    var vibrar = function () { try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) { /* nada */ } };
    var gradosPorPixel = function () { return 0.22 * aj.sens * 390 / Math.max(200, innerHeight); };

    // lo que está apretado ahora, para soltarlo todo al esconder los controles o perder el foco
    var sostenidos = new Set();
    var apretar = function (c) { if (!sostenidos.has(c)) { sostenidos.add(c); hl.comando('+' + c); } };
    var soltar = function (c) { if (sostenidos.delete(c)) hl.comando('-' + c); };

    // ── el joystick (izquierda) ─────────────────────────────────────────────────────────
    var zonaMover = el('div', 'zona', 'left:0;top:22%;width:42%;height:78%');
    var base = el('div', 'base reposo', 'left:22vh;top:calc(100% - 22vh)');
    var palanca = el('div', 'palanca', '');
    base.appendChild(palanca);
    raiz.appendChild(zonaMover);
    raiz.appendChild(base);
    var joy = null;   // { id, cx, cy }
    var R = function () { return innerHeight * 0.12; };
    var reposo = function () {
      base.className = 'base reposo';
      base.style.left = VH('calc(22vh + env(safe-area-inset-left))');
      base.style.top = VH('calc(100% - 22vh)');
      palanca.style.transform = '';
    };
    zonaMover.addEventListener('pointerdown', function (e) {
      if (joy) return;
      e.preventDefault();
      try { zonaMover.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
      joy = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
      base.className = 'base';
      base.style.left = e.clientX + 'px';
      base.style.top = e.clientY + 'px';
      palanca.style.transform = '';
    });
    zonaMover.addEventListener('pointermove', function (e) {
      if (!joy || e.pointerId !== joy.id) return;
      var dx = e.clientX - joy.cx, dy = e.clientY - joy.cy, r = R(), d = Math.hypot(dx, dy);
      if (d > r) { dx *= r / d; dy *= r / d; d = r; }
      palanca.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      var k = d < r * 0.15 ? 0 : (d - r * 0.15) / (r * 0.85) / d;      // zona muerta, y después lineal
      hl.mover(-dy * k, dx * k);
    });
    var finJoy = function (e) {
      if (!joy || e.pointerId !== joy.id) return;
      joy = null;
      hl.mover(0, 0);
      reposo();
    };
    zonaMover.addEventListener('pointerup', finJoy);
    zonaMover.addEventListener('pointercancel', finJoy);

    // ── mirar (derecha) ─────────────────────────────────────────────────────────────────
    var zonaMirar = el('div', 'zona', 'left:42%;top:0;width:58%;height:100%');
    raiz.appendChild(zonaMirar);
    var miradas = new Map();   // pointerId → {x, y}
    var mirarConDedo = function (nodo) {
      nodo.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { nodo.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
        miradas.set(e.pointerId, { x: e.clientX, y: e.clientY });
      });
      nodo.addEventListener('pointermove', function (e) {
        var m = miradas.get(e.pointerId);
        if (!m) return;
        var k = gradosPorPixel();
        hl.mirar(-(e.clientX - m.x) * k, (e.clientY - m.y) * k);   // derecha: giro negativo
        m.x = e.clientX; m.y = e.clientY;
      });
      var fin = function (e) { miradas.delete(e.pointerId); };
      nodo.addEventListener('pointerup', fin);
      nodo.addEventListener('pointercancel', fin);
    };
    mirarConDedo(zonaMirar);

    // ── botones ───────────────────────────────────────────────────────────────────────
    function el(tag, clase, css) {
      var n = document.createElement(tag);
      n.className = clase;
      if (css) n.style.cssText = VH(css);
      return n;
    }
    function boton(icono, css, nombre, clase) {
      var b = el('div', 'bt' + (clase ? ' ' + clase : ''), css);
      b.innerHTML = ICONO[icono] || '';
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', nombre);
      raiz.appendChild(b);
      return b;
    }
    // mantener: +cmd al apoyar, -cmd al soltar; conMirar: además apunta con el mismo dedo
    function mantener(b, cmd, conMirar) {
      var dedos = new Set();
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        try { b.setPointerCapture(e.pointerId); } catch (_) { /* nada */ }
        dedos.add(e.pointerId);
        b.classList.add('ap');
        vibrar();
        apretar(cmd);
        if (conMirar) miradas.set(e.pointerId, { x: e.clientX, y: e.clientY });
      });
      if (conMirar) {
        b.addEventListener('pointermove', function (e) {
          var m = miradas.get(e.pointerId);
          if (!m) return;
          var k = gradosPorPixel();
          hl.mirar(-(e.clientX - m.x) * k, (e.clientY - m.y) * k);   // derecha: giro negativo
          m.x = e.clientX; m.y = e.clientY;
        });
      }
      var fin = function (e) {
        if (!dedos.delete(e.pointerId)) return;
        miradas.delete(e.pointerId);
        if (!dedos.size) { b.classList.remove('ap'); soltar(cmd); }
      };
      b.addEventListener('pointerup', fin);
      b.addEventListener('pointercancel', fin);
    }
    function tocar(b, accion) {
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        b.classList.add('ap');
        vibrar();
        accion();
      });
      var fin = function () { b.classList.remove('ap'); };
      b.addEventListener('pointerup', fin);
      b.addEventListener('pointercancel', fin);
      b.addEventListener('pointerleave', fin);
    }

    var D = 'env(safe-area-inset-right)', I = 'env(safe-area-inset-left)';
    var bFuego = boton('fuego', 'width:24vh;height:24vh;right:calc(9vh + ' + D + ');bottom:27vh', T.disparar, 'fuego');
    mantener(bFuego, 'attack', true);
    var bIzq = boton('fuego', 'width:15vh;height:15vh;left:calc(5vh + ' + I + ');top:38vh', T.disparar, 'fuego');
    mantener(bIzq, 'attack', false);
    mantener(boton('saltar', 'width:16vh;height:16vh;right:calc(2vh + ' + D + ');bottom:7vh', T.saltar), 'jump');
    var bAgachar = boton('agachar', 'width:13vh;height:13vh;right:calc(21vh + ' + D + ');bottom:3vh', T.agacharse);
    var agachado = false;
    bAgachar.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      vibrar();
      if (!aj.agacharseFijo) { bAgachar.classList.add('ap'); apretar('duck'); return; }
      agachado = !agachado;
      bAgachar.classList.toggle('fijo', agachado);
      if (agachado) apretar('duck'); else soltar('duck');
    });
    var finAgachar = function () { if (!aj.agacharseFijo) { bAgachar.classList.remove('ap'); soltar('duck'); } };
    bAgachar.addEventListener('pointerup', finAgachar);
    bAgachar.addEventListener('pointercancel', finAgachar);
    mantener(boton('recargar', 'width:12vh;height:12vh;right:calc(35vh + ' + D + ');bottom:31vh', T.recargar), 'reload');
    mantener(boton('mira', 'width:12vh;height:12vh;right:calc(3vh + ' + D + ');bottom:56vh', T.secundario), 'attack2');
    mantener(boton('usar', 'width:12vh;height:12vh;right:calc(36vh + ' + D + ');bottom:18vh', T.usar), 'use');

    // las armas por casillero, abajo al centro (hud_fastswitch: cambia al tocar, sin confirmar; de
    // nuevo, a la siguiente del mismo casillero)
    var armas = ['1', '2', '3', '4', '5'];
    armas.forEach(function (n, i) {
      var b = el('div', 'arma', 'width:11vh;height:11vh;left:calc(50% + ' + ((i - 2) * 12.5 - 5.5) + 'vh);bottom:2vh');
      b.textContent = n;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', T.armas + ' ' + n);
      raiz.appendChild(b);
      tocar(b, function () { hl.comando('slot' + n); });
    });
    tocar(boton('anterior', 'width:11vh;height:11vh;left:calc(50% + 32vh);bottom:2vh', T.anterior, 'chico'), function () { hl.comando('lastinv'); });

    // arriba: linterna, guardado rápido y carga rápida; ajustes y pausa a la derecha
    var arriba = function (icono, i, nombre) {
      return boton(icono, 'width:12vh;height:12vh;left:calc(50% + ' + ((i - 1.5) * 14 - 6) + 'vh);top:calc(2vh + env(safe-area-inset-top))', nombre, 'chico');
    };
    tocar(arriba('linterna', 0.5, T.linterna), function () { hl.comando('impulse 100'); });
    tocar(arriba('guardar', 1.5, T.guardar), function () { soltarTodo(); hl.comando('save quick'); if (opciones.aviso) opciones.aviso('guardado'); });
    tocar(arriba('cargar', 2.5, T.cargar), function () { soltarTodo(); hl.comando('load quick'); });
    tocar(boton('ajustes', 'width:12vh;height:12vh;right:calc(17vh + ' + D + ');top:calc(2vh + env(safe-area-inset-top))', T.ajustes, 'chico'),
      function () { abrirAjustes(); });
    tocar(boton('pausa', 'width:12vh;height:12vh;right:calc(3vh + ' + D + ');top:calc(2vh + env(safe-area-inset-top))', T.pausa, 'chico'),
      function () { soltarTodo(); if (opciones.pausa) opciones.pausa(); });

    // ── el panel de ajustes ────────────────────────────────────────────────────────────
    function cerrarPanel() { panel.className = ''; panel.innerHTML = ''; }
    panel.addEventListener('pointerdown', function (e) { if (e.target === panel) cerrarPanel(); });
    function abrirAjustes() {
      soltarTodo();
      panel.innerHTML = '<div class="caja"><h3>' + T.controles + '</h3>' +
        '<div class="fila">' + T.sens + ' <input type="range" id="hl-sens" min="0.2" max="2.5" step="0.05" value="' + aj.sens + '"> <span id="hl-sens-v"></span></div>' +
        '<div class="fila">' + T.opacidad + ' <input type="range" id="hl-op" min="0.15" max="1" step="0.05" value="' + aj.opacidad + '"></div>' +
        '<div class="fila"><label><input type="checkbox" id="hl-izq"' + (aj.disparoIzq ? ' checked' : '') + '> ' + T.izq + '</label></div>' +
        '<div class="fila"><label><input type="checkbox" id="hl-fijo"' + (aj.agacharseFijo ? ' checked' : '') + '> ' + T.fijo + '</label></div>' +
        '<button data-cerrar="1">' + T.listo + '</button></div>';
      panel.className = 'si';
      var sens = panel.querySelector('#hl-sens'), sv = panel.querySelector('#hl-sens-v');
      var mostrarSens = function () { sv.textContent = Number(aj.sens).toFixed(2); };
      mostrarSens();
      sens.addEventListener('input', function () { aj.sens = +sens.value; mostrarSens(); guardar(); });
      panel.querySelector('#hl-op').addEventListener('input', function (e) { aj.opacidad = +e.target.value; aplicarAjustes(); guardar(); });
      panel.querySelector('#hl-izq').addEventListener('change', function (e) { aj.disparoIzq = e.target.checked; aplicarAjustes(); guardar(); });
      panel.querySelector('#hl-fijo').addEventListener('change', function (e) { aj.agacharseFijo = e.target.checked; guardar(); });
      panel.querySelector('[data-cerrar]').addEventListener('click', cerrarPanel);
    }

    // ── cuándo se ven ──────────────────────────────────────────────────────────────────
    function soltarTodo() {
      sostenidos.forEach(function (c) { hl.comando('-' + c); });
      sostenidos.clear();
      agachado = false;
      bAgachar.classList.remove('fijo');
      raiz.querySelectorAll('.ap').forEach(function (n) { n.classList.remove('ap'); });
      miradas.clear();
      if (joy) { joy = null; reposo(); }
      hl.mover(0, 0);
    }
    var modoPC = false, jugando = false;
    function actualizar() {
      var e = hl.estado();
      var ahora = !!e && e.estado === 4 && e.destino === 1;     // conectado y con el juego al frente
      if (ahora !== jugando) {
        jugando = ahora;
        if (!jugando) { soltarTodo(); cerrarPanel(); }
      }
      raiz.className = jugando && !modoPC ? '' : 'oculto';
    }
    setInterval(actualizar, 150);
    // con teclado o mouse de verdad, los controles se esconden; vuelven con el primer toque
    // (el teclado del teléfono escribe en un campo propio: ése no cuenta)
    addEventListener('keydown', function (e) {
      if (e.repeat || e.key === 'Escape' || (e.target && e.target.id === 'hl-teclado')) return;
      modoPC = true; actualizar();
    }, true);
    addEventListener('pointerdown', function (e) {
      var antes = modoPC;
      modoPC = e.pointerType === 'mouse';
      if (antes !== modoPC) actualizar();
    }, true);
    addEventListener('blur', soltarTodo);
    document.addEventListener('visibilitychange', function () { if (document.hidden) soltarTodo(); });
    reposo();
    aplicarAjustes();

    return { soltarTodo: soltarTodo, actualizar: actualizar, ajustes: aj, get visibles() { return !raiz.classList.contains('oculto'); } };
  };
})();
