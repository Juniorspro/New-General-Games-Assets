// porteo: lo primero que se ve (va antes que todo en el HTML, así aparece apenas empieza a leerse
// el archivo). La intro de la marca (herramientas/porteo/intro.js) mientras arranca el motor; después
// la pantalla de carga (herramientas/porteo/carga.js) hasta que el menú del juego está listo, con
// "Saltar" para empezar ya: lo demás sigue cargando por detrás. Lo que avanza lo cuentan el arranque
// (los datos que llegaron) y main.js (el motor listo y cada escena cargada) por porteoCarga.
(function () {
  'use strict';
  const CONFIG = /*CONFIG*/null;
  let pantalla = null, terminado = false;
  let datos = 0, motor = false, escenas = 0;
  const idioma = (navigator.language || 'es').slice(0, 2).toLowerCase();
  const T = {
    es: ['Abriendo el juego…', 'Preparando el motor…', 'Cargando el menú…'],
    en: ['Opening the game…', 'Getting the engine ready…', 'Loading the menu…'],
    pt: ['Abrindo o jogo…', 'Preparando o motor…', 'Carregando o menu…'],
  }[idioma] || ['Opening the game…', 'Getting the engine ready…', 'Loading the menu…'];

  // los datos pesan la mitad de la barra; el motor y las escenas hasta el menú, el resto
  function actualizar() {
    if (!pantalla) return;
    const f = 0.5 * datos + (motor ? 0.2 : 0) + Math.min(escenas, 2) * 0.12;
    pantalla.progreso(Math.min(f, 0.97), !motor ? T[0] : escenas === 0 ? T[1] : T[2]);
  }
  function fin() {
    if (terminado) return;
    terminado = true;
    if (pantalla) pantalla.listo();
  }

  globalThis.porteoCarga = {
    datos(f) { if (f > datos) { datos = Math.min(1, f); actualizar(); } },
    motor() { motor = true; actualizar(); },
    escena(nombre) {
      if (nombre === 'MainMenu') { escenas = 2; actualizar(); setTimeout(fin, 700); return; }
      escenas++;
      actualizar();
    },
  };

  Porteo.intro({ aviso: CONFIG.aviso }).then(() => {
    if (terminado) return;   // el menú ya estaba antes de que terminara la intro
    pantalla = Porteo.carga({ imagen: CONFIG.imagen, titulo: CONFIG.titulo, consejos: CONFIG.consejos });
    pantalla.saltado.then(() => { terminado = true; });
    actualizar();
  });
})();
