/* El arranque: intro de JXStudios mientras carga, el idioma (encima, difuminado) y a jugar. En la PC se juega
   con el puntero bloqueado (si se suelta con Esc, pausa); en el celu, con los controles de dedo y la pantalla
   acostada (con el celu parado se gira todo 90°). */
(function () {
  'use strict';
  var pant = document.getElementById('pantalla'), canvas = document.getElementById('canvas');
  var tactil = JS.tactil;
  function revisarGiro() { document.body.classList.toggle('girado', tactil && innerHeight > innerWidth); setTimeout(function () { JS.mostrarTactil && !document.getElementById('tactil').hidden && JS.mostrarTactil(true); }, 60); }
  addEventListener('resize', revisarGiro); revisarGiro();

  function intro() {
    return new Promise(function (ok) {
      var el = document.getElementById('intro'); el.hidden = false;
      el.querySelector('.presenta').textContent = JS.t('presenta');
      el.querySelector('.creditos').textContent = JS.t('creditos');
      var hecho = false;
      var salir = function () { if (hecho) return; hecho = true; el.classList.add('fuera'); setTimeout(function () { el.hidden = true; ok(); }, 550); };
      var tm = setTimeout(salir, 4300);
      el.addEventListener('pointerdown', function () { clearTimeout(tm); salir(); }, { once: true });
    });
  }
  function mostrar(html, alClic) {
    pant.innerHTML = '<div class="caja">' + html + '</div>'; pant.hidden = false;
    pant.onclick = function (e) { var b = e.target.closest('button'); if (b) alClic(b.dataset.a, b); };
  }
  function ocultar() { pant.hidden = true; pant.innerHTML = ''; pant.onclick = null; }
  function elegirIdioma() {
    return new Promise(function (ok) {
      var nombres = { es: 'Español', en: 'English', pt: 'Português' };
      mostrar('<h1>' + JS.t('idioma') + '</h1><div class="botones">' + ['es', 'en', 'pt'].map(function (l) { return '<button data-a="' + l + '">' + nombres[l] + '</button>'; }).join('') + '</div><p class="aviso">' + JS.t('creditos') + '</p>',
        function (a) { try { localStorage.setItem('justshoot.idioma', a); } catch (e) { /* */ } JS.ponerIdioma(a); ok(a); });
    });
  }
  function pantallaCompleta() {
    if (!tactil || document.fullscreenElement) return;
    try { var p = document.documentElement.requestFullscreen({ navigationUI: 'hide' }); if (p && p.then) p.then(function () { return screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); }).catch(function () {}); } catch (e) { /* */ }
  }

  /* --- la PC: puntero bloqueado; al soltarlo, pausa */
  var enJuego = false;
  function bloquear() { try { var p = canvas.requestPointerLock(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* */ } }
  document.addEventListener('pointerlockchange', function () {
    if (tactil || !enJuego) return;
    if (document.pointerLockElement === canvas) { ocultar(); JS.pausar(false); }
    else { JS.pausar(true); pausaPC(); }
  });
  function pausaPC() {
    mostrar('<h1>' + JS.t('pausa') + '</h1><div class="botones"><button data-a="seguir">' + JS.t('listoPC') + '</button></div><p class="aviso">' + JS.t('ayudaPC') + '</p>', function () { bloquear(); });
  }
  /* --- el celu: pausa con el botón del menú */
  JS.abrirPausa = function () {
    JS.pausar(true); JS.soltarTodo();
    var T = { es: ['Seguir', 'Menú del juego', 'Ajustar controles', 'Idioma'], en: ['Resume', 'Game menu', 'Customize controls', 'Language'], pt: ['Continuar', 'Menu do jogo', 'Ajustar controles', 'Idioma'] }[JS.idioma()] || [];
    mostrar('<h1>' + JS.t('pausa') + '</h1><div class="botones"><button data-a="seguir">' + T[0] + '</button><button data-a="menu">' + T[1] + '</button><button data-a="controles">' + T[2] + '</button><button data-a="idioma">' + T[3] + '</button></div>', function (a) {
      if (a === 'seguir') { ocultar(); JS.pausar(false); }
      else if (a === 'menu') { ocultar(); JS.pausar(false); escape(); }
      else if (a === 'controles') { ocultar(); JS.editarControles(function () { JS.abrirPausa(); }); }
      else if (a === 'idioma') elegirIdioma().then(function (l) { location.reload(); void l; });
    });
  };
  function escape() {
    var e = new KeyboardEvent('keydown', { bubbles: true }); Object.defineProperty(e, 'keyCode', { get: function () { return 27; } }); document.dispatchEvent(e);
    var u = new KeyboardEvent('keyup', { bubbles: true }); Object.defineProperty(u, 'keyCode', { get: function () { return 27; } }); setTimeout(function () { document.dispatchEvent(u); }, 60);
  }

  function empezar() {
    enJuego = true; document.body.classList.add('jugando');
    JS.jugar();
    if (tactil) { JS.mostrarTactil(true); if (window.Browser) window.Browser.pointerLock = true; }
    else {
      mostrar('<h1>Just Shoot</h1><div class="botones"><button data-a="jugar">' + JS.t('listoPC') + '</button></div><p class="aviso">' + JS.t('ayudaPC') + '</p>', function () { bloquear(); });
      canvas.addEventListener('click', function () { if (document.pointerLockElement !== canvas) bloquear(); });
    }
  }

  var vIntro = intro();
  var vMotor = JS.arrancar();
  var vListo = new Promise(function (ok) { JS.alListo = ok; });
  window.__justshoot = { listo: function () { return JS.listo(); } };
  vIntro.then(elegirIdioma).then(function () {
    ocultar(); pantallaCompleta();
    return vListo;
  }).then(empezar);
  vMotor.catch(function (e) { document.getElementById('estado').textContent = String(e && e.message || e); });
})();
