// porteo: lo primero que se ve (va antes que todo en el HTML, así aparece apenas empieza a leerse
// el archivo). La intro de la marca (herramientas/porteo/intro.js) mientras arranca el motor; después
// la pantalla de carga (herramientas/porteo/carga.js) hasta que el menú del juego está listo, con
// "Saltar" para empezar ya: lo demás sigue cargando por detrás. Lo que avanza lo cuentan el arranque
// (los datos que llegaron) y main.js (el motor listo y cada escena cargada) por porteoCarga.
//
// En la versión para un sitio el menú se arma sin esperar las texturas (llegan después: ver
// Programa.Diferir), así que la pantalla se queda hasta que llegó lo que el menú muestra; si no,
// se lo vería ir apareciendo.
(function () {
  'use strict';
  const CONFIG = /*CONFIG*/null;
  const MENU = 'MainMenu';
  const ESPERA_MAXIMA = 25000;   // ms después del menú: con una conexión muy lenta, que se vea igual
  let pantalla = null, terminado = false, tapa = true, menuListo = false;
  let datos = 0, motor = false, escenas = 0;
  const alListo = [];
  const idioma = (navigator.language || 'es').slice(0, 2).toLowerCase();
  const T = {
    es: ['Abriendo el juego…', 'Preparando el motor…', 'Cargando el menú…', 'Trayendo lo que se ve…'],
    en: ['Opening the game…', 'Getting the engine ready…', 'Loading the menu…', 'Fetching what you see…'],
    pt: ['Abrindo o jogo…', 'Preparando o motor…', 'Carregando o menu…', 'Trazendo o que se vê…'],
  }[idioma] || ['Opening the game…', 'Getting the engine ready…', 'Loading the menu…', 'Fetching what you see…'];

  // los datos pesan la mitad de la barra; el motor y las escenas hasta el menú, el resto
  function actualizar(texto) {
    if (!pantalla) return;
    const f = 0.5 * datos + (motor ? 0.2 : 0) + Math.min(escenas, 2) * 0.12;
    pantalla.progreso(Math.min(f, 0.97), texto || (!motor ? T[0] : escenas === 0 ? T[1] : T[2]));
  }
  function fin() {
    if (terminado) return;
    terminado = true;
    tapa = false;
    if (pantalla) pantalla.listo();
  }
  // el menú está y llegó lo que muestra (o se esperó bastante): avisa aunque ya hayan tocado "Saltar"
  function listo() {
    if (menuListo) return;
    menuListo = true;
    fin();
    for (const f of alListo.splice(0)) { try { f(); } catch (e) { console.error(e); } }
  }
  function esperarLoQueSeVe() {
    const U = globalThis.porteoUnArchivo;
    if (!U || !U.faltaUrgente) { setTimeout(listo, 700); return; }
    const hasta = performance.now() + ESPERA_MAXIMA;
    const desde = globalThis.porteoCuadros || 0;
    let enCero = 0;
    (function mirar() {
      const falta = U.faltaUrgente();
      if (falta > 0) actualizar(T[3] + ' ' + (falta / 1048576).toFixed(1) + ' MB');
      // dos veces seguidas en cero y después de unos cuadros dibujados: lo que se ve se pide recién
      // al dibujarlo, y el primer cuadro del menú puede tardar (compila sus shaders)
      const dibujados = (globalThis.porteoCuadros || 0) - desde;
      enCero = falta > 0 || dibujados < 5 ? 0 : enCero + 1;
      if (enCero >= 2 || performance.now() > hasta) { listo(); return; }
      setTimeout(mirar, 300);
    })();
  }

  globalThis.porteoCarga = {
    datos(f) { if (f > datos) { datos = Math.min(1, f); actualizar(); } },
    motor() { motor = true; actualizar(); },
    escena(nombre) {
      if (nombre === MENU) { escenas = 2; actualizar(); esperarLoQueSeVe(); return; }
      escenas++;
      actualizar();
    },
    // si la pantalla de carga (o la intro) todavía tapa el juego (main.js: el logo de la empresa
    // corre rápido mientras nadie lo ve, y el sistema de velocidad no mide)
    tapado: () => tapa,
    // f() cuando el menú quedó listo con lo que muestra (main.js: de ahí en más las escenas
    // esperan sus texturas)
    alListo(f) { if (menuListo) f(); else alListo.push(f); },
  };

  Porteo.intro({ aviso: CONFIG.aviso }).then(() => {
    if (terminado) return;   // el menú ya estaba antes de que terminara la intro
    pantalla = Porteo.carga({ imagen: CONFIG.imagen, titulo: CONFIG.titulo, consejos: CONFIG.consejos });
    pantalla.saltado.then(() => { terminado = true; tapa = false; });
    actualizar();
  });
})();
