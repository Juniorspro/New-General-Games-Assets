// porteo: las partidas de LÖVE (la carpeta de guardado, /home/web_user/love) en IndexedDB. Va como
// --post-js en lugar del EmscriptenPersistence.js de love.js, que guardaba sólo en "beforeunload"
// (en el teléfono casi nunca llega: la pestaña se mata) y que, sin IndexedDB (un cuadro con sandbox,
// navegación privada), dejaba el juego esperando para siempre.
//
// Con Emscripten 6 este código corre después de que el módulo ya arrancó (después de "await run()"),
// así que una dependencia de arranque (addRunDependency) ya no frena nada: la página arrancaba el
// juego antes de que llegaran las partidas de IndexedDB (y la música guardada se volvía a bajar).
// Ahora la página espera Module.porteoPartidas antes de llamar a main.
if (typeof ENVIRONMENT_IS_PTHREAD === 'undefined' || !ENVIRONMENT_IS_PTHREAD) (function () {
  var DIR = '/home/web_user/love';
  // cargado: llegó lo de IndexedDB (recién ahí se puede escribir: un syncfs hacia IndexedDB borra allá
  // lo que acá no está, y antes de cargar acá no está nada)
  var cargado = false, guardando = false, otraVez = false;
  var avisar;
  Module.porteoPartidas = new Promise(function (ok) { avisar = ok; });
  try { FS.mkdir(DIR); } catch (e) { /* ya estaba */ }
  try {
    FS.mount(IDBFS, {}, DIR);
    FS.syncfs(true, function (err) {
      if (err) Module.printErr('porteo: sin partidas guardadas (' + err + ')');
      else cargado = true;
      avisar();
    });
    // un IndexedDB que no contesta no traba el arranque (pero no se escribe hasta que conteste)
    setTimeout(avisar, 8000);
  } catch (e) { Module.printErr('porteo: sin IndexedDB (' + e + ')'); avisar(); }

  // a IndexedDB cada pocos segundos (syncfs sólo escribe lo que cambió) y al irse o esconderse la
  // página, que en el teléfono es lo último que se llega a hacer
  function guardar() {
    if (!cargado) return;
    if (guardando) { otraVez = true; return; }
    guardando = true;
    try {
      FS.syncfs(false, function (err) {
        guardando = false;
        if (err) Module.printErr('porteo: no se pudo guardar (' + err + ')');
        if (otraVez) { otraVez = false; guardar(); }
      });
    } catch (e) { guardando = false; }
  }
  Module.porteoGuardar = guardar;
  setInterval(guardar, 4000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) guardar(); });
  window.addEventListener('pagehide', guardar);
})();
