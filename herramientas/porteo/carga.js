/*
 * porteo: la pantalla de carga que sigue a la intro. El personaje del juego girando y rebotando
 * (con su sombra), la barra con el porcentaje, qué se está cargando, consejos del juego y "Saltar"
 * para empezar ya con lo que haya: lo demás sigue cargando por detrás. Todo va en este archivo (la
 * imagen se pasa como data:), así anda igual en el .html único.
 *
 *   var c = Porteo.carga({ imagen: 'data:image/webp;base64,…', titulo: 'Slime Rancher',
 *                          consejos: { es: ['…'], en: ['…'], pt: ['…'] } });
 *   c.progreso(0.42, 'Cargando el menú…');   // de 0 a 1 (sólo avanza) y el texto
 *   c.listo();                               // se va con un fundido
 *   c.saltado.then(…);                       // el jugador tocó "Saltar"
 */
(function () {
  'use strict';
  var SALTAR = { es: 'Saltar', en: 'Skip', pt: 'Pular' };
  var CSS =
    '#porteo-carga{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:min(3vmin,22px);' +
      'background:radial-gradient(ellipse at 50% 40%,#3a1a4f 0%,#1b0f2b 55%,#0b0612 100%);color:#fff;font:15px/1.4 system-ui,sans-serif;' +
      '-webkit-user-select:none;user-select:none;touch-action:none;transition:opacity .45s ease}' +
    '#porteo-carga.fuera{opacity:0;pointer-events:none}' +
    '#porteo-carga .titulo{margin:0;font:800 clamp(20px,5.4vmin,38px)/1 system-ui,sans-serif;letter-spacing:.02em;' +
      'background:linear-gradient(180deg,#fff 0%,#ffd1e3 100%);-webkit-background-clip:text;background-clip:text;color:transparent;' +
      'filter:drop-shadow(0 3px 10px rgba(255,92,154,.35))}' +
    '#porteo-carga .escena{position:relative;width:min(34vmin,230px);height:min(40vmin,270px)}' +
    '#porteo-carga .brillo{position:absolute;inset:-25%;border-radius:50%;background:radial-gradient(circle,rgba(255,92,154,.28) 0%,transparent 62%);' +
      'animation:porteo-latido 2.2s ease-in-out infinite}' +
    '#porteo-carga .sombra{position:absolute;left:24%;right:24%;bottom:3%;height:7%;border-radius:50%;background:rgba(0,0,0,.5);filter:blur(5px);' +
      'animation:porteo-sombra 1.1s cubic-bezier(.33,0,.4,1) infinite}' +
    '#porteo-carga .salto{position:absolute;left:0;right:0;bottom:8%;height:82%;transform-origin:50% 100%;' +
      'animation:porteo-salto 1.1s cubic-bezier(.33,0,.4,1) infinite}' +
    '#porteo-carga .giro{width:100%;height:100%;animation:porteo-giro 3.3s linear infinite}' +
    '#porteo-carga .giro img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 12px rgba(0,0,0,.35))}' +
    '#porteo-carga .barra{width:min(62vmin,380px);height:10px;border-radius:99px;background:rgba(255,255,255,.13);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.4)}' +
    '#porteo-carga .barra i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#ff9ec4,#ff5c9a);' +
      'box-shadow:0 0 12px rgba(255,92,154,.6);transition:width .35s ease}' +
    '#porteo-carga .texto{margin:0;min-height:1.4em;text-align:center;color:rgba(255,255,255,.88);font-variant-numeric:tabular-nums}' +
    '#porteo-carga .consejo{position:absolute;left:8%;right:8%;bottom:max(16px,4.5vmin);margin:0;text-align:center;font-size:13px;' +
      'color:rgba(255,255,255,.62);transition:opacity .4s ease}' +
    '#porteo-carga .saltar{position:absolute;right:max(14px,3vmin);top:max(14px,3vmin);padding:9px 18px;border:1px solid rgba(255,255,255,.35);' +
      'border-radius:99px;background:rgba(255,255,255,.1);color:#fff;font:600 15px system-ui,sans-serif;cursor:pointer;opacity:0;' +
      'pointer-events:none;transition:opacity .4s ease,background .2s ease}' +
    '#porteo-carga .saltar.visible{opacity:1;pointer-events:auto}' +
    '#porteo-carga .saltar:hover,#porteo-carga .saltar:focus-visible{background:rgba(255,255,255,.22);outline:none}' +
    '@keyframes porteo-salto{0%,100%{transform:translateY(0) scale(1.12,.86)}14%{transform:translateY(-6%) scale(.92,1.1)}' +
      '50%{transform:translateY(-30%) scale(.98,1.03)}86%{transform:translateY(-4%) scale(.96,1.05)}}' +
    '@keyframes porteo-sombra{0%,100%{transform:scaleX(1.1);opacity:.55}50%{transform:scaleX(.6);opacity:.22}}' +
    '@keyframes porteo-giro{from{transform:perspective(700px) rotateY(0)}to{transform:perspective(700px) rotateY(360deg)}}' +
    '@keyframes porteo-latido{0%,100%{transform:scale(.92);opacity:.8}50%{transform:scale(1.05);opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){#porteo-carga .salto,#porteo-carga .giro,#porteo-carga .sombra,#porteo-carga .brillo{animation-duration:6s}}';

  var Porteo = window.Porteo = window.Porteo || {};
  Porteo.carga = function (op) {
    op = op || {};
    var idioma = (navigator.language || 'es').slice(0, 2).toLowerCase();
    if (!SALTAR[idioma]) idioma = 'en';
    var estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);
    var el = document.createElement('div');
    el.id = 'porteo-carga';
    el.innerHTML = '<p class="titulo"></p><div class="escena"><i class="brillo"></i><i class="sombra"></i>' +
      '<div class="salto"><div class="giro"><img alt=""></div></div></div>' +
      '<div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div>' +
      '<p class="texto" aria-live="polite"></p><p class="consejo"></p><button class="saltar" type="button"></button>';
    el.querySelector('.titulo').textContent = op.titulo || '';
    if (!op.titulo) el.querySelector('.titulo').remove();
    el.querySelector('img').src = op.imagen || '';
    var barra = el.querySelector('.barra'), relleno = barra.querySelector('i');
    var texto = el.querySelector('.texto'), consejo = el.querySelector('.consejo'), boton = el.querySelector('.saltar');
    boton.textContent = SALTAR[idioma] + ' ›';
    document.body.appendChild(el);

    var p = 0, leyenda = '', fuera = false, alSaltar;
    var saltado = new Promise(function (ok) { alSaltar = ok; });
    function pintar() {
      relleno.style.width = (p * 100).toFixed(1) + '%';
      barra.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      texto.textContent = (leyenda ? leyenda + ' ' : '') + Math.round(p * 100) + '%';
    }
    pintar();

    // los consejos, de a uno, cambiando cada tanto
    var lista = (op.consejos && (op.consejos[idioma] || op.consejos.es)) || [];
    var k = Math.floor(Math.random() * Math.max(1, lista.length)), reloj = 0;
    function otroConsejo() {
      if (!lista.length) return;
      consejo.style.opacity = '0';
      setTimeout(function () { consejo.textContent = lista[k++ % lista.length]; consejo.style.opacity = '1'; }, 400);
    }
    if (lista.length) { consejo.textContent = lista[k++ % lista.length]; reloj = setInterval(otroConsejo, 5500); }

    // "Saltar" aparece enseguida: el juego ya está arrancando atrás
    setTimeout(function () { boton.classList.add('visible'); }, op.saltarEn != null ? op.saltarEn : 900);
    function irse() {
      if (fuera) return;
      fuera = true;
      clearInterval(reloj);
      el.classList.add('fuera');
      setTimeout(function () { el.remove(); estilo.remove(); }, 500);
    }
    boton.addEventListener('click', function (e) { e.stopPropagation(); alSaltar(); irse(); });
    // que los toques sobre la pantalla de carga no le lleguen al juego
    el.addEventListener('pointerdown', function (e) { if (e.target !== boton) { e.preventDefault(); e.stopPropagation(); } });

    return {
      progreso: function (f, txt) {
        if (fuera) return;
        if (typeof f === 'number' && f > p) p = Math.min(1, f);
        if (txt != null) leyenda = txt;
        pintar();
      },
      listo: function () { p = 1; pintar(); setTimeout(irse, 250); },
      saltado: saltado,
    };
  };
})();
