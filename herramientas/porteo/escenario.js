/*
 * porteo: el juego siempre horizontal y en 16:9. El <body> es el escenario: el rectángulo 16:9 más
 * grande que entra en la pantalla, centrado (lo que sobra queda negro); con el teléfono en vertical,
 * girado 90° (como si estuviera acostado: se lo da vuelta y se juega). Todo lo que está adentro gira
 * con él: el lienzo, la intro, la pantalla de carga y los avisos, porque un transform en el <body>
 * hace que lo "position:fixed" quede relativo a él.
 *
 * En Android, el primer toque además pide pantalla completa y trabar la orientación en horizontal;
 * si el navegador lo deja, la pantalla ya queda acostada y el escenario deja de girar.
 *
 *   Porteo.escenario({ relacion: 16 / 9 });          // al principio del <body>
 *   Porteo.escenario.local(e.clientX, e.clientY);   // → [x, y] en píxeles CSS del escenario
 *
 * ?relacion=libre en la dirección: ocupa toda la pantalla (sin franjas).
 */
(function () {
  'use strict';
  var Porteo = window.Porteo = window.Porteo || {};
  var estado = { ancho: 0, alto: 0, ox: 0, oy: 0, girado: false, W: 0, H: 0 };
  var relacion = 16 / 9;

  function acomodar() {
    var W = window.innerWidth, H = window.innerHeight;
    if (!W || !H) return;
    var girado = H > W;
    // el espacio horizontal disponible (acostado si la pantalla está en vertical)
    var ancho = girado ? H : W, alto = girado ? W : H;
    var w = ancho, h = alto;
    if (relacion) {
      if (ancho / alto > relacion) w = Math.round(alto * relacion);
      else h = Math.round(ancho / relacion);
    }
    var ox = Math.round((ancho - w) / 2), oy = Math.round((alto - h) / 2);
    var s = document.body.style;
    s.position = 'fixed'; s.left = '0'; s.top = '0'; s.margin = '0'; s.overflow = 'hidden';
    s.width = w + 'px'; s.height = h + 'px';
    s.transformOrigin = '0 0';
    // girado: (x, y) del escenario → (W - oy - y, ox + x) en la pantalla
    s.transform = girado ? 'translate(' + (W - oy) + 'px,' + ox + 'px) rotate(90deg)' : 'translate(' + ox + 'px,' + oy + 'px)';
    estado = { ancho: w, alto: h, ox: ox, oy: oy, girado: girado, W: W, H: H };
    document.documentElement.classList.toggle('porteo-girado', girado);
  }

  // de un punto de la pantalla (clientX, clientY) al escenario, en píxeles CSS
  function local(cx, cy) {
    var e = estado;
    return e.girado ? [cy - e.ox, e.W - e.oy - cx] : [cx - e.ox, cy - e.oy];
  }

  function pantallaCompleta() {
    var d = document.documentElement;
    if (document.fullscreenElement || !d.requestFullscreen) return;
    try {
      d.requestFullscreen({ navigationUI: 'hide' }).then(function () {
        if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape');
      }).catch(function () { /* el navegador no quiso: queda girado con CSS */ });
    } catch (e) { /* idem */ }
  }

  Porteo.escenario = function (op) {
    op = op || {};
    var libre = /[?&]relacion=libre\b/.test(location.search);
    relacion = libre ? 0 : (op.relacion || 16 / 9);
    document.documentElement.style.background = '#000';
    acomodar();
    addEventListener('resize', acomodar);
    addEventListener('orientationchange', function () { setTimeout(acomodar, 250); });
    if (window.visualViewport) visualViewport.addEventListener('resize', acomodar);
    if (/Android/i.test(navigator.userAgent) && op.pantallaCompleta !== false) {
      var primero = function () { removeEventListener('pointerup', primero, true); pantallaCompleta(); };
      addEventListener('pointerup', primero, true);
    }
  };
  Porteo.escenario.local = local;
  Porteo.escenario.estado = function () { return estado; };
})();
