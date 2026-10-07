/* Controles de dedo para Just Shoot (la demo no tenía): palanca a la izquierda (W A S D), arrastrar en el resto
   de la pantalla para mirar (movimiento de mouse con el puntero "bloqueado"), disparar, saltar, la tabla (Tab)
   y el menú (Esc). Se le mandan al motor eventos de teclado y de mouse como los de una PC.
   Personalizables: se mueven arrastrando, cambian de tamaño y transparencia, se espejan para zurdos y la
   vibración se apaga; se guarda en el navegador. */
(function () {
  'use strict';
  var CLAVE = 'justshoot.controles';
  var BASE = {
    joy: { x: 0.13, y: 0.72, t: 150 }, fuego: { x: 0.87, y: 0.70, t: 104 }, salto: { x: 0.74, y: 0.82, t: 72 },
    tabla: { x: 0.80, y: 0.08, t: 52 }, menu: { x: 0.92, y: 0.08, t: 52 },
  };
  var opc = { pos: JSON.parse(JSON.stringify(BASE)), op: 0.8, zurdo: false, vibrar: true, sens: 1 };
  try { var g = JSON.parse(localStorage.getItem(CLAVE)); if (g) { Object.assign(opc, g); opc.pos = Object.assign(JSON.parse(JSON.stringify(BASE)), g.pos || {}); } } catch (e) { /* sin guardado */ }
  var guardar = function () { try { localStorage.setItem(CLAVE, JSON.stringify(opc)); } catch (e) { /* */ } };

  var raiz = document.getElementById('tactil'), canvas = document.getElementById('canvas');
  var ICONOS = {
    fuego: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',
    salto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15l7-7 7 7"/></svg>',
  };
  var els = {};
  function crear() {
    raiz.innerHTML = '';
    var mk = function (k, cls, html) { var d = document.createElement('div'); d.className = 'ctl ' + cls; d.dataset.k = k; d.innerHTML = html || ''; raiz.appendChild(d); els[k] = d; return d; };
    mk('joy', 'c-joy', '<i class="perilla"></i>');
    mk('fuego', 'c-fuego', ICONOS.fuego);
    mk('salto', '', ICONOS.salto);
    mk('tabla', 'chico', JS.t('tabla'));
    mk('menu', 'chico', JS.t('menu'));
    ubicar();
  }
  // posiciones en fracciones de la pantalla del juego (acostada); los zurdos, espejado
  function W() { return raiz.clientWidth; } function H() { return raiz.clientHeight; }
  function ubicar() {
    for (var k in els) {
      var p = opc.pos[k], x = opc.zurdo ? 1 - p.x : p.x, e = els[k];
      e.style.width = e.style.height = (k === 'tabla' || k === 'menu') ? (p.t * 1.5) + 'px' : p.t + 'px';
      if (k === 'tabla' || k === 'menu') e.style.height = (p.t * 0.7) + 'px';
      e.style.left = (x * W() - e.offsetWidth / 2) + 'px'; e.style.top = (p.y * H() - e.offsetHeight / 2) + 'px';
      e.style.setProperty('--op', opc.op);
    }
  }
  addEventListener('resize', function () { setTimeout(ubicar, 50); });

  /* --- lo que se le manda al motor */
  function tecla(tipo, code, kc) {
    var e = new KeyboardEvent(tipo, { code: code, key: code, bubbles: true, cancelable: true });
    Object.defineProperty(e, 'keyCode', { get: function () { return kc; } });
    Object.defineProperty(e, 'which', { get: function () { return kc; } });
    Object.defineProperty(e, 'charCode', { get: function () { return 0; } });
    document.dispatchEvent(e);
  }
  function raton(tipo, extra) {
    if (window.Browser) window.Browser.pointerLock = true; // así el motor toma el movimiento relativo
    var r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent(tipo, Object.assign({ bubbles: true, cancelable: true, button: 0, buttons: tipo === 'mousedown' ? 1 : 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, extra || {})));
  }
  var vibrar = function (ms) { if (opc.vibrar && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* */ } };
  var TECLAS = { up: ['KeyW', 87], down: ['KeyS', 83], left: ['KeyA', 65], right: ['KeyD', 68] };
  var abajo = {};
  function poner(dir, si) { if (!!abajo[dir] === si) return; abajo[dir] = si; tecla(si ? 'keydown' : 'keyup', TECLAS[dir][0], TECLAS[dir][1]); }

  /* --- los dedos */
  var dedos = {}, editando = false, elegido = null;
  function puntoDe(e) { // coordenadas dentro de #tactil (con el celu parado, todo está girado)
    if (document.body.classList.contains('girado')) return { x: e.clientY, y: innerWidth - e.clientX };
    var r = raiz.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function cual(p) {
    var mejor = null, md = Infinity;
    for (var k in els) {
      var e = els[k], cx = e.offsetLeft + e.offsetWidth / 2, cy = e.offsetTop + e.offsetHeight / 2;
      var d = Math.hypot(p.x - cx, p.y - cy), rad = Math.max(e.offsetWidth, e.offsetHeight) / 2 + (k === 'joy' ? 40 : 14);
      if (d < rad && d < md) { mejor = k; md = d; }
    }
    return mejor;
  }
  raiz.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { raiz.setPointerCapture(e.pointerId); } catch (er) { /* */ }
    var p = puntoDe(e), k = cual(p);
    if (editando) { if (k) { elegido = k; dedos[e.pointerId] = { k: 'mover', c: k, p: p }; marcarElegido(); } return; }
    if (k === 'joy') { dedos[e.pointerId] = { k: 'joy', p0: { x: els.joy.offsetLeft + els.joy.offsetWidth / 2, y: els.joy.offsetTop + els.joy.offsetHeight / 2 } }; mover(e.pointerId, p); }
    else if (k === 'fuego') { dedos[e.pointerId] = { k: 'fuego', p: p }; raton('mousedown'); els.fuego.classList.add('apretado'); vibrar(15); }
    else if (k === 'salto') { dedos[e.pointerId] = { k: 'salto' }; tecla('keydown', 'Space', 32); els.salto.classList.add('apretado'); }
    else if (k === 'tabla') { dedos[e.pointerId] = { k: 'tabla' }; tecla('keydown', 'Tab', 9); els.tabla.classList.add('apretado'); }
    else if (k === 'menu') { dedos[e.pointerId] = { k: 'menu' }; els.menu.classList.add('apretado'); }
    else dedos[e.pointerId] = { k: 'mirar', p: p };
  });
  function mover(id, p) {
    var d = dedos[id]; if (!d) return;
    if (d.k === 'mover') {
      var nx = p.x / W(), ny = p.y / H(); opc.pos[d.c].x = Math.min(0.97, Math.max(0.03, opc.zurdo ? 1 - nx : nx)); opc.pos[d.c].y = Math.min(0.97, Math.max(0.03, ny)); ubicar(); return;
    }
    if (d.k === 'joy') {
      var r = els.joy.offsetWidth / 2, dx = p.x - d.p0.x, dy = p.y - d.p0.y, l = Math.hypot(dx, dy);
      var m = Math.min(1, l / r), ax = l ? dx / l * m : 0, ay = l ? dy / l * m : 0;
      els.joy.firstChild.style.transform = 'translate(' + ax * r * 0.7 + 'px,' + ay * r * 0.7 + 'px)';
      poner('right', ax > 0.38); poner('left', ax < -0.38); poner('down', ay > 0.38); poner('up', ay < -0.38);
      return;
    }
    if (d.k === 'mirar' || d.k === 'fuego') { // el dedo del disparo también apunta, como en los shooters de celu
      var mx = (p.x - d.p.x) * opc.sens, my = (p.y - d.p.y) * opc.sens; d.p = p;
      if (mx || my) raton('mousemove', { movementX: Math.round(mx * 1.6), movementY: Math.round(my * 1.6) });
    }
  }
  raiz.addEventListener('pointermove', function (e) { if (dedos[e.pointerId]) { e.preventDefault(); mover(e.pointerId, puntoDe(e)); } });
  function soltar(e) {
    var d = dedos[e.pointerId]; if (!d) return; delete dedos[e.pointerId];
    if (d.k === 'joy') { els.joy.firstChild.style.transform = ''; ['up', 'down', 'left', 'right'].forEach(function (x) { poner(x, false); }); }
    else if (d.k === 'fuego') { raton('mouseup'); els.fuego.classList.remove('apretado'); }
    else if (d.k === 'salto') { tecla('keyup', 'Space', 32); els.salto.classList.remove('apretado'); }
    else if (d.k === 'tabla') { tecla('keyup', 'Tab', 9); els.tabla.classList.remove('apretado'); }
    else if (d.k === 'menu') { els.menu.classList.remove('apretado'); JS.abrirPausa && JS.abrirPausa(); }
    else if (d.k === 'mover') guardar();
  }
  raiz.addEventListener('pointerup', soltar); raiz.addEventListener('pointercancel', soltar);

  /* --- el editor de controles */
  var editor = null;
  function marcarElegido() { for (var k in els) els[k].classList.toggle('elegido', k === elegido); if (editor) { var t = editor.querySelector('[data-r=t]'); t.value = opc.pos[elegido].t; } }
  JS.editarControles = function (fin) {
    editando = true; elegido = elegido || 'fuego'; raiz.classList.add('editando'); raiz.hidden = false;
    var es = JS.idioma(), T = { es: ['Arrastrá cada botón a donde quieras', 'Tamaño', 'Transparencia', 'Giro', 'Zurdo', 'Vibrar', 'Listo', 'Original'], en: ['Drag each button where you want it', 'Size', 'Opacity', 'Look speed', 'Left-handed', 'Vibrate', 'Done', 'Reset'], pt: ['Arraste cada botão para onde quiser', 'Tamanho', 'Transparência', 'Giro', 'Canhoto', 'Vibrar', 'Pronto', 'Original'] }[es] || [];
    editor = document.createElement('div'); editor.className = 'editor';
    editor.innerHTML = '<div>' + T[0] + '</div>' +
      '<div class="fila"><span>' + T[1] + '</span><input type="range" data-r="t" min="40" max="220"></div>' +
      '<div class="fila"><span>' + T[2] + '</span><input type="range" data-r="op" min="0.15" max="1" step="0.05" value="' + opc.op + '"></div>' +
      '<div class="fila"><span>' + T[3] + '</span><input type="range" data-r="sens" min="0.3" max="2.5" step="0.1" value="' + opc.sens + '"></div>' +
      '<div class="fila"><label><input type="checkbox" data-r="zurdo"' + (opc.zurdo ? ' checked' : '') + '> ' + T[4] + '</label> <label><input type="checkbox" data-r="vibrar"' + (opc.vibrar ? ' checked' : '') + '> ' + T[5] + '</label></div>' +
      '<div class="acciones"><button data-a="reset">' + T[7] + '</button><button data-a="listo">' + T[6] + '</button></div>';
    raiz.parentNode.appendChild(editor);
    editor.addEventListener('input', function (e) {
      var r = e.target.dataset.r;
      if (r === 't') opc.pos[elegido].t = +e.target.value;
      else if (r === 'op' || r === 'sens') opc[r] = +e.target.value;
      else if (r === 'zurdo' || r === 'vibrar') opc[r] = e.target.checked;
      ubicar(); guardar();
    });
    editor.addEventListener('click', function (e) {
      var a = e.target.dataset.a;
      if (a === 'reset') { opc.pos = JSON.parse(JSON.stringify(BASE)); opc.op = 0.8; opc.sens = 1; opc.zurdo = false; ubicar(); guardar(); editor.remove(); JS.editarControles(fin); }
      if (a === 'listo') { editando = false; raiz.classList.remove('editando'); for (var k in els) els[k].classList.remove('elegido'); editor.remove(); editor = null; guardar(); fin && fin(); }
    });
    marcarElegido();
  };
  JS.mostrarTactil = function (si) { raiz.hidden = !si; if (si && !Object.keys(els).length) crear(); else ubicar(); };
  JS.soltarTodo = function () { for (var id in dedos) soltar({ pointerId: id }); };
  JS.crearTactil = crear;
})();
