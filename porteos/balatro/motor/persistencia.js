// porteo: las partidas de LÖVE (la carpeta de guardado, /home/web_user/love) en IndexedDB. Va como
// --post-js en lugar del EmscriptenPersistence.js de love.js, que guardaba sólo en "beforeunload"
// (en el teléfono casi nunca llega: la pestaña se mata) y que, sin IndexedDB (un cuadro con sandbox,
// navegación privada), dejaba el juego esperando para siempre.
if (typeof ENVIRONMENT_IS_PTHREAD === 'undefined' || !ENVIRONMENT_IS_PTHREAD) (function () {
  var DIR = '/home/web_user/love';
  var listo = false, roto = false, guardando = false, otraVez = false;
  function seguir() { if (!listo) { listo = true; Module.removeRunDependency('porteo_partidas'); } }
  Module.addRunDependency('porteo_partidas');
  try { FS.mkdir(DIR); } catch (e) { /* ya estaba */ }
  try {
    FS.mount(IDBFS, {}, DIR);
    FS.syncfs(true, function (err) {
      if (err) { roto = true; Module.printErr('porteo: sin partidas guardadas (' + err + ')'); }
      seguir();
    });
    // un IndexedDB que no contesta no traba el arranque
    setTimeout(seguir, 8000);
  } catch (e) { roto = true; Module.printErr('porteo: sin IndexedDB (' + e + ')'); seguir(); }

  // a IndexedDB cada pocos segundos (syncfs sólo escribe lo que cambió) y al irse o esconderse la
  // página, que en el teléfono es lo último que se llega a hacer
  function guardar() {
    if (roto || !listo) return;
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
