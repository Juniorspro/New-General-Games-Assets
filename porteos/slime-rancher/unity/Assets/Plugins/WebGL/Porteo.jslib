// porteo: lo que Slime Rancher necesita del navegador (ver Assets/Porteo/Porteo.cs).
mergeInto(LibraryManager.library, {
  // El juego ya arrancó: la página saca la pantalla de carga (WebGLTemplates/Porteo).
  PorteoListo: function () {
    if (typeof window.porteoAlArrancar === 'function') window.porteoAlArrancar();
  },

  // Las partidas quedan en el disco en memoria (/idbfs/...): esto las pasa a IndexedDB.
  // FS.syncfs no admite dos a la vez: si ya hay uno andando, se encadena otro al terminar.
  PorteoGuardarDisco: function () {
    if (Module.porteoGuardando) { Module.porteoOtraVez = true; return; }
    Module.porteoGuardando = true;
    FS.syncfs(false, function listo(err) {
      if (err) console.warn('porteo: no se pudo guardar en IndexedDB', err);
      if (Module.porteoOtraVez) { Module.porteoOtraVez = false; FS.syncfs(false, listo); return; }
      Module.porteoGuardando = false;
    });
  }
});
