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
  // la escena del menú (carga.json, "menu"): cuando termina de cargar, la pantalla se va
  const MENU = CONFIG.menu || 'MainMenu';
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

  // la barra: si se sabe cuánto hay que bajar para el menú (carga.json, mbMenu: medido), sigue a
  // los MB bajados, que es lo que tarda con una conexión lenta; si no, a las etapas (los datos que
  // el motor espera la mitad, el motor y las escenas hasta el menú el resto). Abajo, cuánto va y a
  // qué velocidad: con 5 Mbps son más de 40 s, y así se ve que avanza
  let mbAntes = 0, tAntes = 0, velocidadMB = 0;
  function megas() {
    const U = globalThis.porteoUnArchivo;
    return U && U.bajados ? U.bajados() / 1048576 : 0;
  }
  function actualizar(texto) {
    if (!pantalla) return;
    // por MB sólo en la versión para un sitio: en el HTML único los bloques llegan con la página y
    // no se cuentan (la barra se quedaba en 0 hasta el final)
    const U = globalThis.porteoUnArchivo;
    const mb = megas(), meta = (U && U.web && CONFIG.mbMenu) || 0;
    const f = meta ? 0.95 * Math.min(1, mb / meta) + (escenas >= 2 ? 0.02 : 0)
                   : 0.5 * datos + (motor ? 0.2 : 0) + Math.min(escenas, 2) * 0.12;
    const coma = (x) => x.toFixed(1).replace('.', idioma === 'en' ? '.' : ',');
    let extra = '';
    if (mb > 0.05 && !texto) {
      extra = coma(mb) + (meta ? ' / ~' + meta : '') + ' MB';
      if (velocidadMB > 0.01) extra += ' · ' + coma(velocidadMB) + ' MB/s';
    }
    pantalla.progreso(Math.min(f, 0.97), texto || (!motor ? T[0] : escenas === 0 ? T[1] : T[2]), extra);
  }
  // cada medio segundo: la velocidad (promediada) y la barra, aunque no pase nada más
  setInterval(() => {
    if (terminado) return;
    const ahora = performance.now(), mb = megas();
    if (tAntes) {
      const v = (mb - mbAntes) * 1000 / (ahora - tAntes);
      velocidadMB = velocidadMB ? velocidadMB * 0.8 + v * 0.2 : v;
    }
    mbAntes = mb; tAntes = ahora;
    actualizar();
  }, 500);
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
    anotar('menu', 'listo');
    if (Porteo.arrancado) Porteo.arrancado();
    fin();
    for (const f of alListo.splice(0)) { try { f(); } catch (e) { console.error(e); } }
  }
  function esperarLoQueSeVe() {
    const U = globalThis.porteoUnArchivo;
    if (!U || !U.faltaUrgente) { setTimeout(listo, 700); return; }
    const hasta = performance.now() + ESPERA_MAXIMA;
    const desde = globalThis.porteoCuadros || 0;
    let enCero = 0, cuadroCero = -1;
    (function mirar() {
      const falta = U.faltaUrgente();
      if (falta > 0) actualizar(T[3] + ' ' + (falta / 1048576).toFixed(1) + ' MB');
      // dos veces seguidas en cero y después de unos cuadros dibujados: lo que se ve se pide recién
      // al dibujarlo, y el primer cuadro del menú puede tardar (compila sus shaders). Y con todo
      // ya acá, dos cuadros más: lo que llegó se sube y se dibuja en el siguiente
      const cuadros = globalThis.porteoCuadros || 0;
      if (falta > 0 || cuadros - desde < 5) { enCero = 0; cuadroCero = -1; }
      else { enCero++; if (cuadroCero < 0) cuadroCero = cuadros; }
      if ((enCero >= 2 && cuadros - cuadroCero >= 2) || performance.now() > hasta) { listo(); return; }
      setTimeout(mirar, 300);
    })();
  }

  // lo primero: el escenario horizontal 16:9 (girado si el teléfono está en vertical) y el registro
  // (errores en pantalla en vez de negro y, si hay dónde, lo que pasa mandado al sitio)
  if (Porteo.escenario) Porteo.escenario({ relacion: CONFIG.relacion || 16 / 9 });
  if (Porteo.registro) Porteo.registro({ url: CONFIG.registro || null });
  const anotar = (t, d) => { if (Porteo.anotar) Porteo.anotar(t, d); };
  let datosAnotados = 0;

  globalThis.porteoCarga = {
    datos(f) {
      if (f > datos) { datos = Math.min(1, f); actualizar(); }
      if (datos >= datosAnotados + 0.25) { datosAnotados = Math.floor(datos * 4) / 4; anotar('datos', datosAnotados); }
    },
    motor() { motor = true; actualizar(); anotar('motor', 1); },
    escena(nombre) {
      anotar('escena', nombre);
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
    pantalla = Porteo.carga({ imagen: CONFIG.imagen, titulo: CONFIG.titulo, consejos: CONFIG.consejos, fondo: CONFIG.fondo });
    pantalla.saltado.then(() => { terminado = true; tapa = false; anotar('saltar', 1); });
    actualizar();
  });
})();
