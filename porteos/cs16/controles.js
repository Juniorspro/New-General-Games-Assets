'use strict';
/* Controles táctiles de CS 1.6, al estilo de Standoff 2 / Blood Strike.
 *
 *   const c = Porteo.controlesCS(cs);   // cs: { comando(texto), mover(adelante, costado), mirar(giro, cabeceo) en grados (giro positivo: a la izquierda, como GoldSrc), estado() }
 *
 * - Izquierda: joystick que aparece donde se apoya el pulgar (camina más lento si se lo inclina poco).
 * - Derecha: arrastrar para mirar. El botón de disparo también apunta mientras se lo arrastra.
 * - Disparo grande a la derecha y otro a la izquierda; saltar, agacharse (queda agachado hasta
 *   tocarlo de nuevo), recargar, mira/secundario, usar (desactivar la bomba, rehenes, puertas).
 * - Abajo, las armas (1 principal, 2 pistola, 3 cuchillo, 4 granadas, 5 C4). Arriba: comprar,
 *   equipo, radio, tabla (mantener), ajustes y pausa.
 * - Sólo se ven jugando: en el menú, en la consola y con los menús del juego abiertos (equipo,
 *   clase, compra) los toques van al juego, que los toma como el mouse.
 * - Con teclado o mouse se esconden solos (vuelven al tocar la pantalla).
 *
 * Mirar: grados por píxel = 0,22 × sensibilidad × (390 / alto de la pantalla), igual en cualquier
 * teléfono. Los ajustes quedan en localStorage ("cs16-tactil").
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
    comprar: SVG('<path d="M6 9h6l5 20h20l4-14H14"/><circle cx="19" cy="37" r="3"/><circle cx="35" cy="37" r="3"/>'),
    equipo: SVG('<circle cx="17" cy="16" r="5"/><circle cx="32" cy="16" r="5"/><path d="M8 36c0-6 4-10 9-10s9 4 9 10"/><path d="M24 29c2-2 4-3 8-3 5 0 9 4 9 10"/>'),
    radio: SVG('<rect x="16" y="14" width="16" height="28" rx="3"/><path d="M22 14V6"/><path d="M20 22h8M20 28h8"/><path d="M36 10c3 3 3 9 0 12M40 6c5 5 5 15 0 20"/>'),
    tabla: SVG('<path d="M10 12h28M10 20h28M10 28h28M10 36h28"/>'),
    ajustes: SVG('<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>'),
    pausa: SVG('<path d="M18 12v24M30 12v24"/>'),
    soltar: SVG('<path d="M24 8v22"/><path d="M15 21l9 9 9-9"/><path d="M10 40h28"/>'),
  };

  // Las órdenes de radio con sus comandos directos (los de CS: "coverme", "go"...; con "radio1" +
  // "menuselect" el menú del servidor llegaba después y quedaba abierto robándole los números a las
  // armas). Los textos: los del castellano del juego (opciones.radio, que arma armar-datos.py desde
  // cstrike_english.txt); éstos son sólo por si faltan.
  var RADIO = [
    ['Órdenes', [['coverme', 'Cúbranme'], ['takepoint', 'Vos adelante'], ['holdpos', 'Mantengan la posición'],
      ['regroup', 'Reagrúpense'], ['followme', 'Síganme'], ['takingfire', 'Me disparan']]],
    ['Grupo', [['go', '¡Vamos!'], ['fallback', 'Retirada'], ['sticktog', 'Todos juntos'],
      ['getinpos', 'Posiciones y esperen'], ['stormfront', 'Al frente'], ['report', 'Informen']]],
    ['Respuestas', [['roger', 'Afirmativo'], ['enemyspot', 'Enemigo a la vista'], ['needbackup', 'Necesito refuerzos'],
      ['sectorclear', 'Despejado'], ['inposition', 'En posición'], ['reportingin', 'Informando'],
      ['getout', '¡Va a explotar!'], ['negative', 'Negativo'], ['enemydown', 'Enemigo abatido']]],
  ];

  var CSS = '' +
    '#cs-tactil{position:fixed;inset:0;z-index:20;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none;' +
      '-webkit-touch-callout:none;font-family:system-ui,sans-serif;--op:.6}' +
    '#cs-tactil.oculto{display:none}' +
    '#cs-tactil .zona{position:absolute;pointer-events:auto}' +
    '#cs-tactil .bt{position:absolute;pointer-events:auto;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'color:rgba(255,255,255,.92);background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.55);opacity:var(--op);' +
      'box-sizing:border-box;transition:transform .06s,background .06s}' +
    '#cs-tactil .bt svg{width:52%;height:52%}' +
    '#cs-tactil .bt.ap{background:rgba(255,255,255,.32);transform:scale(.93)}' +
    '#cs-tactil .bt.fijo{background:rgba(255,190,60,.38);border-color:rgba(255,210,120,.9)}' +
    '#cs-tactil .bt.fuego{background:rgba(160,20,20,.32);border-color:rgba(255,120,120,.7)}' +
    '#cs-tactil .bt.fuego.ap{background:rgba(230,60,60,.5)}' +
    '#cs-tactil .chico{border-radius:12px}' +
    '#cs-tactil .arma{position:absolute;pointer-events:auto;border-radius:10px;color:#fff;font:700 4.4vh system-ui,sans-serif;' +
      'background:rgba(0,0,0,.3);border:2px solid rgba(255,255,255,.45);opacity:var(--op);display:flex;align-items:center;' +
      'justify-content:center;box-sizing:border-box}' +
    '#cs-tactil .arma.ap{background:rgba(255,255,255,.3)}' +
    '#cs-tactil .base{position:absolute;width:24vh;height:24vh;margin:-12vh 0 0 -12vh;border-radius:50%;' +
      'border:2px solid rgba(255,255,255,.45);background:rgba(0,0,0,.18);opacity:var(--op);pointer-events:none}' +
    '#cs-tactil .palanca{position:absolute;left:50%;top:50%;width:10vh;height:10vh;margin:-5vh 0 0 -5vh;border-radius:50%;' +
      'background:rgba(255,255,255,.55)}' +
    '#cs-tactil .base.reposo{opacity:calc(var(--op) * .45)}' +
    '#cs-panel{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);' +
      'font:600 15px system-ui,sans-serif;color:#fff;touch-action:manipulation}' +
    '#cs-panel.si{display:flex}' +
    '#cs-panel .caja{background:rgba(20,20,20,.92);border:1px solid rgba(255,200,90,.6);border-radius:12px;padding:14px 18px;' +
      'max-width:92vw;max-height:88vh;overflow:auto}' +
    '#cs-panel h3{margin:0 0 10px;color:#ffc864;font-size:16px}' +
    '#cs-panel .fila{display:flex;align-items:center;gap:12px;margin:10px 0}' +
    '#cs-panel input[type=range]{width:220px}' +
    '#cs-panel button{font:600 15px system-ui,sans-serif;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.35);' +
      'border-radius:8px;padding:9px 14px;margin:3px;min-height:44px}' +
    '#cs-panel .caja.radio{width:min(92vw,720px);box-sizing:border-box}' +
    '#cs-panel .pestanas{display:flex;gap:6px;margin-bottom:8px}' +
    '#cs-panel .pestanas button{flex:1;margin:0;padding:6px 8px;font-size:14px}' +
    '#cs-panel .pestanas button.si{background:rgba(255,200,100,.28);border-color:#ffc864;color:#ffe2a8}' +
    '#cs-panel .ordenes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}' +
    '#cs-panel .ordenes button{margin:0;min-height:46px;padding:6px 8px;font-size:14px}';

  P.controlesCS = function (cs, opciones) {
    opciones = opciones || {};
    var guardado = {};
    try { guardado = JSON.parse(localStorage.getItem('cs16-tactil') || '{}') || {}; } catch (_) { guardado = {}; }
    var aj = { sens: 1, opacidad: 0.6, disparoIzq: true, agacharseFijo: true };
    Object.keys(aj).forEach(function (k) { if (guardado[k] !== undefined) aj[k] = guardado[k]; });
    var guardar = function () { try { localStorage.setItem('cs16-tactil', JSON.stringify(aj)); } catch (_) { /* sin almacenamiento */ } };

    var estilo = document.createElement('style');
    estilo.textContent = VH(CSS);
    document.head.appendChild(estilo);
    var raiz = document.createElement('div');
    raiz.id = 'cs-tactil';
    raiz.className = 'oculto';
    document.body.appendChild(raiz);
    var panel = document.createElement('div');
    panel.id = 'cs-panel';
    document.body.appendChild(panel);
    var aplicarAjustes = function () { raiz.style.setProperty('--op', aj.opacidad); if (bIzq) bIzq.style.display = aj.disparoIzq ? '' : 'none'; };

    var vibrar = function () { try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) { /* nada */ } };
    var gradosPorPixel = function () { return 0.22 * aj.sens * 390 / Math.max(200, innerHeight); };

    // lo que está apretado ahora, para soltarlo todo al esconder los controles o perder el foco
    var sostenidos = new Set();
    var apretar = function (c) { if (!sostenidos.has(c)) { sostenidos.add(c); cs.comando('+' + c); } };
    var soltar = function (c) { if (sostenidos.delete(c)) cs.comando('-' + c); };

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
      cs.mover(-dy * k, dx * k);
    });
    var finJoy = function (e) {
      if (!joy || e.pointerId !== joy.id) return;
      joy = null;
      cs.mover(0, 0);
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
        cs.mirar(-(e.clientX - m.x) * k, (e.clientY - m.y) * k);   // derecha: giro negativo
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
          cs.mirar(-(e.clientX - m.x) * k, (e.clientY - m.y) * k);   // derecha: giro negativo
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
    var bFuego = boton('fuego', 'width:24vh;height:24vh;right:calc(9vh + ' + D + ');bottom:27vh', 'Disparar', 'fuego');
    mantener(bFuego, 'attack', true);
    var bIzq = boton('fuego', 'width:15vh;height:15vh;left:calc(5vh + ' + I + ');top:38vh', 'Disparar', 'fuego');
    mantener(bIzq, 'attack', false);
    mantener(boton('saltar', 'width:16vh;height:16vh;right:calc(2vh + ' + D + ');bottom:7vh', 'Saltar'), 'jump');
    var bAgachar = boton('agachar', 'width:13vh;height:13vh;right:calc(21vh + ' + D + ');bottom:3vh', 'Agacharse');
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
    mantener(boton('recargar', 'width:12vh;height:12vh;right:calc(35vh + ' + D + ');bottom:31vh', 'Recargar'), 'reload');
    mantener(boton('mira', 'width:12vh;height:12vh;right:calc(3vh + ' + D + ');bottom:56vh', 'Mira'), 'attack2');
    mantener(boton('usar', 'width:12vh;height:12vh;right:calc(36vh + ' + D + ');bottom:18vh', 'Usar'), 'use');

    // las armas, abajo al centro (hud_fastswitch: cambia al tocar, sin confirmar)
    var armas = ['1', '2', '3', '4', '5'];
    armas.forEach(function (n, i) {
      var b = el('div', 'arma', 'width:11vh;height:11vh;left:calc(50% + ' + ((i - 2) * 12.5 - 5.5) + 'vh);bottom:2vh');
      b.textContent = n;
      b.setAttribute('role', 'button');
      b.setAttribute('aria-label', 'Arma ' + n);
      raiz.appendChild(b);
      tocar(b, function () { cs.comando('slot' + n); });
    });
    tocar(boton('soltar', 'width:11vh;height:11vh;left:calc(50% + 32vh);bottom:2vh', 'Tirar arma', 'chico'), function () { cs.comando('drop'); });

    // arriba: comprar, equipo, radio, tabla; ajustes y pausa a la derecha
    var arriba = function (icono, i, nombre) {
      return boton(icono, 'width:12vh;height:12vh;left:calc(50% + ' + ((i - 1.5) * 14 - 6) + 'vh);top:calc(2vh + env(safe-area-inset-top))', nombre, 'chico');
    };
    tocar(arriba('comprar', 0, 'Comprar'), function () { soltarTodo(); cs.comando('buy'); });
    tocar(arriba('equipo', 1, 'Elegir equipo'), function () { soltarTodo(); cs.comando('chooseteam'); });
    tocar(arriba('radio', 2, 'Radio'), function () { abrirRadio(); });
    mantener(arriba('tabla', 3, 'Tabla de puntos'), 'showscores');
    tocar(boton('ajustes', 'width:12vh;height:12vh;right:calc(17vh + ' + D + ');top:calc(2vh + env(safe-area-inset-top))', 'Ajustes', 'chico'),
      function () { abrirAjustes(); });
    tocar(boton('pausa', 'width:12vh;height:12vh;right:calc(3vh + ' + D + ');top:calc(2vh + env(safe-area-inset-top))', 'Pausa', 'chico'),
      function () { soltarTodo(); if (opciones.pausa) opciones.pausa(); });

    // ── paneles: radio y ajustes ───────────────────────────────────────────────────────
    function cerrarPanel() { panel.className = ''; panel.innerHTML = ''; }
    panel.addEventListener('pointerdown', function (e) { if (e.target === panel) cerrarPanel(); });
    function abrirRadio() {
      soltarTodo();
      // tres pestañas (estándar, grupo, informe) y las órdenes en una grilla: entra entero en
      // cualquier pantalla de teléfono, sin desplazar
      var delJuego = opciones.radio || {}, grupos = delJuego.grupos || [], ordenes = delJuego.ordenes || {};
      var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
      var h = '<div class="caja radio" aria-label="Radio"><div class="pestanas">';
      RADIO.forEach(function (g, i) { h += '<button data-grupo="' + i + '">' + esc(grupos[i] || g[0]) + '</button>'; });
      h += '</div><div class="ordenes"></div><button data-cerrar="1">Cerrar</button></div>';
      panel.innerHTML = h;
      panel.className = 'si';
      var lista = panel.querySelector('.ordenes');
      var mostrar = function (i) {
        panel.querySelectorAll('.pestanas button').forEach(function (b) { b.classList.toggle('si', +b.dataset.grupo === i); });
        lista.innerHTML = RADIO[i][1].map(function (o) { return '<button data-radio="' + o[0] + '">' + esc(ordenes[o[0]] || o[1]) + '</button>'; }).join('');
      };
      panel.querySelector('.pestanas').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (b) mostrar(+b.dataset.grupo);
      });
      lista.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        cs.comando(b.dataset.radio);
        cerrarPanel();
      });
      panel.querySelector('[data-cerrar]').addEventListener('click', cerrarPanel);
      mostrar(0);
    }
    function abrirAjustes() {
      soltarTodo();
      panel.innerHTML = '<div class="caja"><h3>Controles</h3>' +
        '<div class="fila">Sensibilidad <input type="range" id="cs-sens" min="0.2" max="2.5" step="0.05" value="' + aj.sens + '"> <span id="cs-sens-v"></span></div>' +
        '<div class="fila">Opacidad <input type="range" id="cs-op" min="0.15" max="1" step="0.05" value="' + aj.opacidad + '"></div>' +
        '<div class="fila"><label><input type="checkbox" id="cs-izq"' + (aj.disparoIzq ? ' checked' : '') + '> Botón de disparo a la izquierda</label></div>' +
        '<div class="fila"><label><input type="checkbox" id="cs-fijo"' + (aj.agacharseFijo ? ' checked' : '') + '> Agacharse queda fijo (tocar de nuevo para pararse)</label></div>' +
        '<button data-cerrar="1">Listo</button></div>';
      panel.className = 'si';
      var sens = panel.querySelector('#cs-sens'), sv = panel.querySelector('#cs-sens-v');
      var mostrarSens = function () { sv.textContent = Number(aj.sens).toFixed(2); };
      mostrarSens();
      sens.addEventListener('input', function () { aj.sens = +sens.value; mostrarSens(); guardar(); });
      panel.querySelector('#cs-op').addEventListener('input', function (e) { aj.opacidad = +e.target.value; aplicarAjustes(); guardar(); });
      panel.querySelector('#cs-izq').addEventListener('change', function (e) { aj.disparoIzq = e.target.checked; aplicarAjustes(); guardar(); });
      panel.querySelector('#cs-fijo').addEventListener('change', function (e) { aj.agacharseFijo = e.target.checked; guardar(); });
      panel.querySelector('[data-cerrar]').addEventListener('click', cerrarPanel);
    }

    // ── cuándo se ven ──────────────────────────────────────────────────────────────────
    function soltarTodo() {
      sostenidos.forEach(function (c) { cs.comando('-' + c); });
      sostenidos.clear();
      agachado = false;
      bAgachar.classList.remove('fijo');
      raiz.querySelectorAll('.ap').forEach(function (n) { n.classList.remove('ap'); });
      miradas.clear();
      if (joy) { joy = null; reposo(); }
      cs.mover(0, 0);
    }
    var modoPC = false, jugando = false;
    function actualizar() {
      var e = cs.estado();
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
      if (e.repeat || e.key === 'Escape' || (e.target && e.target.id === 'cs-teclado')) return;
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
