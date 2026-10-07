/* Just Shoot (demo web de Error Panic) en un solo HTML: arma el Module de Emscripten como lo hacía
   game-setup.js de BananaBread, pero sin la página vieja: los archivos (motor, paquetes) salen de blobs
   embebidos, no pide texturas DXT ni bloqueo de mouse (los celulares no tienen), y arranca directo
   después de la intro de JXStudios y el idioma. El juego queda igual: instagib en zoomout con 5 bots. */
(function () {
  'use strict';
  var IDIOMAS = {
    es: { idioma: 'Elegí tu idioma', presenta: 'presenta', creditos: 'Just Shoot, de Error Panic (Memorix101 y MegaZell) · sobre Cube 2: Sauerbraten y BananaBread · port personal', cargando: 'Cargando', listo: 'Tocá para jugar', listoPC: 'Hacé clic para jugar', pausa: 'Pausa', seguir: 'Seguir', ayudaPC: 'WASD moverse · mouse apuntar · clic disparar · espacio saltar · Tab tabla · Esc menú', girar: 'Girá el celular', tabla: 'Tabla', menu: 'Menú' },
    en: { idioma: 'Choose your language', presenta: 'presents', creditos: 'Just Shoot by Error Panic (Memorix101 & MegaZell) · built on Cube 2: Sauerbraten and BananaBread · personal port', cargando: 'Loading', listo: 'Tap to play', listoPC: 'Click to play', pausa: 'Paused', seguir: 'Resume', ayudaPC: 'WASD move · mouse aim · click shoot · space jump · Tab scores · Esc menu', girar: 'Rotate your phone', tabla: 'Scores', menu: 'Menu' },
    pt: { idioma: 'Escolha seu idioma', presenta: 'apresenta', creditos: 'Just Shoot, de Error Panic (Memorix101 e MegaZell) · sobre Cube 2: Sauerbraten e BananaBread · port pessoal', cargando: 'Carregando', listo: 'Toque para jogar', listoPC: 'Clique para jogar', pausa: 'Pausa', seguir: 'Continuar', ayudaPC: 'WASD andar · mouse mirar · clique atirar · espaço pular · Tab placar · Esc menu', girar: 'Gire o celular', tabla: 'Placar', menu: 'Menu' },
  };
  var idioma = (function () { try { return localStorage.getItem('justshoot.idioma'); } catch (e) { return null; } })();
  if (!idioma) { var l = (navigator.language || 'es').toLowerCase(); idioma = l.indexOf('pt') === 0 ? 'pt' : l.indexOf('en') === 0 ? 'en' : 'es'; }
  var t = function (k) { return (IDIOMAS[idioma] || IDIOMAS.es)[k]; };
  window.JS = { t: t, idioma: function () { return idioma; }, ponerIdioma: function (l) { idioma = l; if (window.JS.traducir) window.JS.traducir(); } };
  var tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  window.JS.tactil = tactil;

  /* --- los archivos: embebidos (un solo HTML) o al lado (desarrollo) */
  var URLS = {};
  function prepararEmbebidos() {
    var E = window.__EMBEBIDOS;
    if (!E) return Promise.resolve();
    var nombres = Object.keys(E);
    return nombres.reduce(function (p, n) {
      return p.then(function () {
        var x = E[n], bin = Uint8Array.from(atob(x.b), function (c) { return c.charCodeAt(0); });
        var blob = new Blob([bin], { type: x.t || 'application/octet-stream' });
        var listo = x.z ? new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob() : Promise.resolve(blob);
        return listo.then(function (b) { URLS[n] = URL.createObjectURL(b); delete E[n]; });
      });
    }, Promise.resolve()).then(function () { window.__EMBEBIDOS = null; });
  }
  var url = function (n) { return URLS[n] || URLS[n.replace(/^.*\//, '')] || n; };

  /* --- el Module de Emscripten (lo de game-setup.js que el juego necesita) */
  var barra = document.getElementById('barra'), estado = document.getElementById('estado');
  var Module = window.Module = {
    arguments: [], failed: false, preRun: [], postRun: [], preloadPlugins: [],
    print: function (s) { console.log('[STDOUT] ' + s); },
    printErr: function (s) { console.log(s); },
    canvas: document.getElementById('canvas'),
    locateFile: function (n) { return url(n); },
    setStatus: function (s) {
      var m = s && s.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
      if (m) barra.style.width = Math.round(100 * m[2] / m[4]) + '%';
      if (/complete/i.test(s || '')) barra.style.width = '100%';
    },
    totalDependencies: 0,
    monitorRunDependencies: function (left) { this.totalDependencies = Math.max(this.totalDependencies, left); Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')' : 'All downloads complete.'); },
    onFullScreen: function () {},
  };
  // el .ogz se descomprime en un trabajador mientras carga (como en BananaBread). Se registra ya: los preRun de
  // Emscripten corren al revés (el último primero) y el de los paquetes llegaría antes
  var trabajador = null, cbs = [];
  Module.preloadPlugins.push({
    canHandle: function (n) { return n.substr(-4) === '.ogz'; },
    handle: function (bytes, n, onload) {
      if (!trabajador) {
        trabajador = new Worker(url('zee-worker.js'));
        trabajador.onmessage = function (m) { cbs[m.data.callbackID](m.data.data); cbs[m.data.callbackID] = null; };
        Module.postRun.push(function () { trabajador.terminate(); });
      }
      trabajador.postMessage({ filename: n, data: new Uint8Array(bytes), callbackID: cbs.length }); cbs.push(onload);
    },
  });
  Module.autoexec = function () {};
  // resolución de dibujo: como BananaBread (0,65 de la pantalla, hasta 600 de alto); en el celu, algo menos
  (function () {
    var lado = tactil ? 0.55 : 0.65, d = Math.min(lado * screen.availWidth, lado * screen.availHeight, tactil ? 420 : 600);
    var ancho = Math.max(screen.width, screen.height), alto = Math.min(screen.width, screen.height);
    Module.desiredHeight = Math.round(d); Module.desiredWidth = Math.round(d * ancho / alto);
  })();

  /* --- lo del nivel (setup_five.js) */
  Module.setPlayerModels = function () {
    BananaBread.setPlayerModelInfo('snoutx10k', 'snoutx10k', 'snoutx10k', 'snoutx10k/hudguns', 0, 0, 0, 0, 0, 'snoutx10k_green.png', 'snoutx10k_green.png', 'snoutx10k_green.png', true);
    BananaBread.setPlayerModelInfo('snoutx10k/blue', 'snoutx10k/blue', 'snoutx10k/blue', 'snoutx10k/hudguns', 0, 0, 0, 0, 0, 'snoutx10k_blue.jpg', 'snoutx10k_blue.jpg', 'snoutx10k_blue.jpg', true);
    BananaBread.setPlayerModelInfo('snoutx10k/red', 'snoutx10k/red', 'snoutx10k/red', 'snoutx10k/hudguns', 0, 0, 0, 0, 0, 'snoutx10k_red.jpg', 'snoutx10k_red.jpg', 'snoutx10k_red.jpg', true);
  };
  Module.tweakDetail = function () {
    BananaBread.execute('fog 10000'); BananaBread.execute('maxdebris 10');
    BananaBread.execute('glare 1'); BananaBread.execute('glarescale 1.75'); BananaBread.execute('blurglare 7');
  };
  Module.loadDefaultMap = function () {
    BananaBread.execute(' data/botnames.cfg ; sleep 10 [ insta zoomout ; sleep 20000 [ addbot 50 ] ; addbot 50  ; addbot 50 ; addbot 50 ; addbot 50 ]');
  };

  /* --- cuando el mapa está cargado: queda en pausa hasta que se juega */
  var mundoListo = false, jugando = false;
  Module.postLoadWorld = function () {
    Module.tweakDetail();
    BananaBread.execute('sensitivity 10');
    BananaBread.execute('clearconsole');
    mundoListo = true;
    window.JS.traducir();
    if (!jugando) Module.pauseMainLoop();
    window.JS.alListo && window.JS.alListo();
  };
  window.JS.listo = function () { return mundoListo; };

  /* --- los textos del motor en español y portugués: se pisan las cadenas de C en la memoria (sin pasarse del
     largo original; sin tildes, la letra del juego es ASCII) y se rehace el menú principal (CubeScript) */
  var MOTOR = [
    ['%s fragged %s', '%s mato a %s', '%s matou %s'],
    ['%s fragged a teammate (%s)', '%s mato a un aliado (%s)', '%s matou um aliado (%s)'],
    ['%s got killed by %s!', '%s cayo ante %s!', '%s foi morto por %s!'],
    ['%s suicided%s', '%s se mato%s', '%s se matou%s'],
    ['you got fragged by a teammate (%s)', 'te mato un aliado (%s)', 'um aliado te matou (%s)'],
    ['you fragged a teammate (%s)', 'mataste a un aliado (%s)', 'voce matou um aliado (%s)'],
    ['you got fragged by %s', 'te mato %s', '%s te matou'],
    ['game mode is %s', 'modo: %s', 'modo: %s'],
    ['Instagib: You spawn with full rifle ammo and die instantly from one shot. There are no items. Frag everyone to score points.',
      'Instagib: apareces con el rifle cargado y un solo tiro te mata. No hay objetos. Mata a todos para sumar puntos.',
      'Instagib: voce nasce com o rifle carregado e morre com um tiro. Nao ha itens. Mate todos para marcar pontos.'],
    ['connected: %s', 'entro: %s', 'entrou: %s'],
    ['intermission:', 'fin de ronda:', 'intervalo:'],
    ['player frags: %d, deaths: %d', 'bajas: %d, muertes: %d', 'abates: %d, mortes: %d'],
  ];
  var MENU = {
    es: ['agregar bot..', 'sacar bot..', 'opciones..'], pt: ['adicionar bot..', 'remover bot..', 'opcoes..'], en: ['add bot..', 'remove bot..', 'options..'],
  };
  var lugares = null;
  function traducirMotor() {
    var H = Module.HEAPU8; if (!H) return;
    if (!lugares) { // dónde está cada cadena (una vez, en la zona estática)
      lugares = [];
      var zona = H.subarray(0, Math.min(H.length, 4 << 20)), txt = '';
      for (var i = 0; i < zona.length; i += 65536) txt += String.fromCharCode.apply(null, zona.subarray(i, Math.min(zona.length, i + 65536)));
      MOTOR.forEach(function (fila) {
        var en = fila[0], de = 0, k;
        while ((k = txt.indexOf(en, de)) >= 0) { if (zona[k + en.length] === 0) lugares.push({ k: k, fila: fila }); de = k + 1; }
      });
    }
    var col = idioma === 'es' ? 1 : idioma === 'pt' ? 2 : 0;
    lugares.forEach(function (l) {
      var s = l.fila[col], largo = l.fila[0].length;
      if (s.length > largo) s = s.slice(0, largo);
      for (var i = 0; i <= largo; i++) H[l.k + i] = i < s.length ? s.charCodeAt(i) & 0x7f : 0;
    });
    var m = MENU[idioma] || MENU.en;
    BananaBread.execute('newgui main [ guibutton "' + m[0] + '" "addbot 50" ; guibutton "' + m[1] + '" "delbot" ; guibar ; guibutton "' + m[2] + '" "showgui options" ]');
  }
  window.JS.traducir = function () { try { traducirMotor(); } catch (e) { console.warn('traducir', e); } };
  window.JS.jugar = function () {
    jugando = true;
    if (mundoListo) Module.resumeMainLoop();
  };
  window.JS.pausar = function (si) { if (!mundoListo) return; if (si) Module.pauseMainLoop(); else Module.resumeMainLoop(); };

  /* --- la API de BananaBread que usa el nivel */
  var BananaBread = window.BananaBread = {
    init: function () {
      BananaBread.setPlayerModelInfo = Module.cwrap('_ZN4game18setplayermodelinfoEPKcS1_S1_S1_S1_S1_S1_S1_S1_S1_S1_S1_b', null,
        ['string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'string', 'number']);
      BananaBread.execute = Module.cwrap('_Z7executePKc', 'number', ['string']);
      BananaBread.executeString = Module.cwrap('_Z10executestrPKc', 'string', ['string']);
    },
  };
  Module.postRun.push(BananaBread.init);

  /* --- cargar en orden: los paquetes y el motor */
  function script(n) {
    return new Promise(function (ok, mal) { var s = document.createElement('script'); s.src = url(n); s.onload = ok; s.onerror = function () { mal(new Error(n)); }; document.body.appendChild(s); });
  }
  window.JS.arrancar = function () {
    return prepararEmbebidos()
      .then(function () { return script('gl-matrix.js'); })
      .then(function () { return script('preload_base.js'); })
      .then(function () { return script('preload_character.js'); })
      .then(function () { return script('preload_five.js'); })
      .then(function () { return script('bb.js'); });
  };
})();
