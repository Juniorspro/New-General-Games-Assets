// Arranque, entrada y bucle.

import { NIVELES, buscarNivel, idNivel, VISTA, ajustarVista, GRAF, PATRON } from "./mundo.js";
import { generarNivel } from "./generador.js";
import { Partida, ESTADO } from "./juego.js";
import { cargar, guardar as guardarAjustes, tierActual, proximoNivel } from "./guardado.js";
import * as UI from "./interfaz.js";
import { despertar, efe, pararMusica, volumen, cargarPistas } from "./audio.js";
import { cargarTodas } from "./sprites.js";
import { registrarPiezas } from "./dibujo.js";
import { ruta } from "./assets.js";
import { t, tituloNivel } from "./idioma.js";

const $ = UI.$;
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d", { alpha: false });
function redimensionar() {
  ajustarVista(innerWidth, innerHeight);
  lienzo.width = VISTA.ancho * GRAF.esc; lienzo.height = VISTA.alto * GRAF.esc;
  // Hay que APAGARLO DE NUEVO: el navegador reactiva el suavizado cada vez que
  // cambia el tamano del lienzo, y los sprites salen lavados sin aviso.
  ctx.imageSmoothingEnabled = false;
  // Y la escala tambien se vuelve a poner: cambiar el ancho o el alto de un
  // lienzo lo resetea ENTERO, transformacion incluida. Sin esto el juego se
  // dibujaria en un cuarto del lienzo despues del primer giro de pantalla.
  ctx.setTransform(GRAF.esc, 0, 0, GRAF.esc, 0, 0);
  if (partida) partida.camara(true);
}
addEventListener("resize", redimensionar);
addEventListener("orientationchange", () => setTimeout(redimensionar, 180));
// Suavizado APAGADO, y hay que volver a apagarlo despues de cada resize: el
// navegador lo reactiva al cambiar el tamano del lienzo y los sprites salen
// lavados sin que nada avise.
ctx.imageSmoothingEnabled = false;
ctx.setTransform(GRAF.esc, 0, 0, GRAF.esc, 0, 0);

let partida = null, cfgActual = null, tierActualN = "rosa";
let hojas = {}, patrones = {}, capas = {}, escenaHongo = null;

// --- entrada -------------------------------------------------------------
// Un solo boton. Se guarda "apoyado" y se calcula el flanco por cuadro: si el
// flanco se calculara en el evento, dos toques dentro del mismo cuadro se
// comerian uno, y a 60 Hz eso pasa todo el tiempo en pantallas tactiles.
// UN TOQUE MAS CORTO QUE UN CUADRO TAMBIEN CUENTA.
//
// Se guardaba nada mas "apoyado" y el flanco se calculaba por cuadro. Eso
// pierde el toque entero cuando el dedo baja y sube dentro del mismo cuadro:
// a 60 Hz hay 16 milisegundos por cuadro y un toque seco en una pantalla
// tactil dura menos que eso mas seguido de lo que parece. Desde afuera es "le
// toque y no salto", que es el peor error posible en un juego de un solo
// boton. Se cazo con la prueba de mandos, donde ningun toque hacia saltar.
//
// Ahora la BAJADA deja un pedido anotado que el bucle consume cuando le toca,
// pase lo que pase con el dedo en el medio.
const entrada = { apoyado: false, previo: false, pedido: false, izq: false, der: false, frenar: false };

// QUIEN SOSTIENE EL SALTO, en una lista. Hay tres formas de apretarlo —el
// lienzo, el boton A y la barra espaciadora— y con una sola bandera, soltar
// cualquiera de ellas lo apagaba aunque otra siguiera apretada. El salto se
// sostiene mientras quede ALGUIEN sosteniendolo.
const sostienen = new Set();
const prenderSalto = (quien) => {
  despertar();
  sostienen.add(quien);
  entrada.apoyado = true;
  entrada.pedido = true;          // el pedido sobrevive aunque se suelte ya
};
const apagarSalto = (quien) => {
  sostienen.delete(quien);
  if (!sostienen.size) entrada.apoyado = false;
};

// El lienzo: cada dedo que lo toca es un sostenedor distinto, y se suelta
// solo cuando se levanta ESE dedo.
let dedoLienzo = null;
const abajoLienzo = (e) => {
  const id = e.pointerId ?? "t";
  if (dedoLienzo === null) dedoLienzo = id;
  prenderSalto("lienzo");
  if (e.cancelable) e.preventDefault();
};
const arribaLienzo = (e) => {
  const id = e && e.pointerId !== undefined ? e.pointerId : "t";
  if (dedoLienzo !== null && id !== dedoLienzo) return;
  dedoLienzo = null;
  apagarSalto("lienzo");
};
for (const ev of ["pointerdown", "touchstart", "mousedown"])
  lienzo.addEventListener(ev, abajoLienzo, { passive: false });
for (const ev of ["pointerup", "pointercancel", "touchend", "mouseup"])
  window.addEventListener(ev, arribaLienzo);

// --- los mandos en pantalla ---------------------------------------------
//
// Tocar el lienzo SIGUE saltando. Estos botones no reemplazan eso: le ponen un
// lugar fijo y visible a lo que ya se podia hacer —que en un telefono importa,
// porque el pulgar no busca— y agregan el control de direccion.
//
// CADA BOTON SE QUEDA CON SU PROPIO DEDO, Y ESTO ES EL ARREGLO DE UN BUG QUE
// SE SENTIA EN CADA PARTIDA.
//
// La version anterior soltaba las flechas desde un listener en `window`:
// cualquier `pointerup` en cualquier parte de la pantalla las apagaba todas.
// O sea que jugando como se juega —el pulgar izquierdo apretando ▶ y el
// derecho tocando A para saltar— CADA VEZ QUE SE SOLTABA A se cancelaba el
// movimiento, aunque el otro dedo siguiera apoyado en la flecha. Y como el
// dedo ya estaba abajo, no habia un `pointerdown` nuevo que lo volviera a
// prender: el personaje se quedaba clavado. Se notaba sobre todo encadenando
// el doble y el triple salto, que es donde mas veces se suelta A.
//
// Se arregla con `setPointerCapture`: el boton se queda con ESE dedo hasta que
// ese dedo se levante, y los eventos de los otros no lo tocan. Es el mecanismo
// que hay para esto y evita tener que llevar la cuenta a mano.
const usaPointer = "onpointerdown" in window;

function montarMando(sel, alApretar, alSoltar) {
  const b = document.querySelector(sel);
  if (!b) return;
  let dedo = null;

  const apretar = (id, e) => {
    if (dedo !== null) return;
    dedo = id;
    if (e && e.pointerId !== undefined) {
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* da igual */ }
    }
    despertar();
    b.classList.add("apretado");
    alApretar();
    if (e && e.cancelable) e.preventDefault();
  };
  const soltar = (id) => {
    // Solo lo suelta el MISMO dedo que lo apreto. `null` quiere decir "sea
    // quien sea", y es lo que usa el respaldo por si la pagina pierde el foco.
    if (dedo === null || (id !== null && id !== dedo)) return;
    dedo = null;
    b.classList.remove("apretado");
    if (alSoltar) alSoltar();
  };
  b.soltarMando = () => soltar(null);

  if (usaPointer) {
    b.addEventListener("pointerdown", (e) => apretar(e.pointerId, e), { passive: false });
    for (const ev of ["pointerup", "pointercancel"])
      b.addEventListener(ev, (e) => soltar(e.pointerId));
  } else {
    // Respaldo para navegadores sin pointer events. Se registra SOLO en ese
    // caso: con los dos juntos, cada toque llega dos veces.
    b.addEventListener("touchstart", (e) => apretar("t", e), { passive: false });
    for (const ev of ["touchend", "touchcancel"]) b.addEventListener(ev, () => soltar("t"));
    b.addEventListener("mousedown", (e) => apretar("m", e));
    b.addEventListener("mouseup", () => soltar("m"));
    b.addEventListener("mouseleave", () => soltar("m"));
  }
}

montarMando("#mando-saltar", () => prenderSalto("A"), () => apagarSalto("A"));
montarMando('[data-dir="izq"]', () => { entrada.izq = true; }, () => { entrada.izq = false; });
montarMando('[data-dir="der"]', () => { entrada.der = true; }, () => { entrada.der = false; });

// Perder el foco o esconder la pestana SI suelta todo: si no, el dedo queda
// apoyado para siempre y el personaje corre solo contra una pared.
const soltarTodo = () => {
  for (const b of document.querySelectorAll(".mando")) b.soltarMando && b.soltarMando();
  sostienen.clear(); dedoLienzo = null;
  entrada.apoyado = false; entrada.izq = entrada.der = entrada.frenar = false;
};
addEventListener("blur", soltarTodo);
document.addEventListener("visibilitychange", () => { if (document.hidden) soltarTodo(); });

addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "KeyZ", "KeyX", "Enter"].includes(e.code)) {
    prenderSalto("tecla");
    if (e.cancelable) e.preventDefault();
  }
  if (e.code === "Escape" && partida) alMapa();
  if (e.code === "ArrowLeft") entrada.izq = true;
  if (e.code === "ArrowRight") entrada.der = true;
  if (e.code === "ArrowDown") entrada.frenar = true;
  if (e.code === "KeyR" && partida) empezar(cfgActual.m, cfgActual.n);
});
addEventListener("keyup", (e) => {
  if (["Space", "ArrowUp", "KeyZ", "KeyX", "Enter"].includes(e.code)) apagarSalto("tecla");
  if (e.code === "ArrowLeft") entrada.izq = false;
  if (e.code === "ArrowRight") entrada.der = false;
  if (e.code === "ArrowDown") entrada.frenar = false;
});

// --- pantallas -----------------------------------------------------------
function alMapa() {
  partida = null; pararMusica();
  UI.pintarMapa(empezar);
  UI.mostrar("p-mapa");
}

async function empezar(m, n) {
  cfgActual = buscarNivel(m, n);
  tierActualN = tierActual(idNivel(m, n));
  $("#gen-nivel").textContent = `${idNivel(m, n)} · ${tituloNivel(cfgActual)}`;
  $("#gen-detalle").textContent = t("gen.armando");
  UI.mostrar("p-generando");
  // El fondo del tema, si todavia no esta. Tarda unos milisegundos la primera
  // vez y nada las siguientes; la pantalla "Armando…" ya esta puesta.
  await capasDe(cfgActual.tema);
  // Dos cuadros de espera antes de generar: generar bloquea el hilo hasta un
  // segundo, y sin ceder el control la pantalla "generando" no llega a
  // pintarse nunca — el jugador ve un cuelgue en vez de un aviso.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
    const t0 = performance.now();
    const nv = generarNivel(cfgActual, tierActualN);
    const ms = Math.round(performance.now() - t0);
    partida = new Partida(nv, tierActualN, hojas, patrones[nv.tema] || null,
                          capasCache.get(nv.tema) || {});
    partida.escenaHongo = escenaHongo;
    $("#hud-nivel").textContent = `${t("comun.mundo")} ${m}-${n} · ${tituloNivel(cfgActual)}`;
  $("#hud-num").textContent = String((m - 1) * 4 + n);
    $("#hud-gen").textContent = nv.validacion.fallo
      ? t("gen.sinvalidar")
      : `${nv.validacion.intentos === 1 ? t("gen.validado1")
                                        : t("gen.validadoN", { n: nv.validacion.intentos })} · ${ms} ms`;
    UI.mostrar("p-juego");
    } catch (e) {
      // Sin esto, un error armando el nivel deja la pantalla "Armando y
      // comprobando…" puesta para siempre: ni cartel, ni juego, ni salida.
      seRompio(e, "armar el nivel");
    }
  }));
}

// --- bucle ---------------------------------------------------------------
// Paso fijo con acumulador. Con dt variable la fisica cambia segun los hercios
// del monitor: en una pantalla de 144 Hz el salto sale distinto que en una de
// 60, y el nivel validado deja de ser el nivel que se juega.
const PASO = 1000 / 60;
let ultimo = performance.now(), acumulado = 0;

// Guardia contra cuelgues. Si algo tira una excepcion adentro del bucle, sin
// esto se repite sesenta veces por segundo: la pantalla queda quieta, la
// consola se llena y el jugador no puede hacer NADA — ni volver al mapa.
// Envuelto, un error termina el nivel y devuelve al mapa con un aviso. Un
// juego que se recupera mal es mejor que uno que no se recupera.
let fallas = 0;
function seRompio(e, donde) {
  fallas++;
  console.error(`Pique se rompio en ${donde}:`, e);
  const p = partida;
  partida = null;
  try {
    $("#res-titulo").textContent = t("res.roto");
    $("#res-sub").textContent = `${e && e.message ? e.message : e} (en ${donde})`;
    $("#res-panel").className = "res perdido";
    $("#res-lista").innerHTML = "";
    $("#res-seguir").hidden = true;
    $("#res-repetir").onclick = () => empezar(cfgActual.m, cfgActual.n);
    $("#res-mapa").onclick = alMapa;
    UI.mostrar("p-resultado");
  } catch (e2) { alMapa(); }
}
addEventListener("error", (ev) => { if (fallas === 0) seRompio(ev.error || ev.message, "la pagina"); });

// EL VIGILANTE DE CUADROS.
//
// Dibujar al doble de resolucion TRIPLICA el costo de un cuadro: se midio,
// 0,53 ms contra 1,71 en el nivel mas cargado. En esta maquina sobra margen
// de las dos formas; en un telefono de hace unos anos no, y el juego se
// arrastra. No hay forma de saber desde aca en que aparato se va a jugar, asi
// que se mide EN EL APARATO: si de cada tanda de cuadros la mayoria tarda mas
// de 21 ms —o sea menos de 47 por segundo— se baja la resolucion una vez y se
// anota, para que la proxima partida arranque ya bien en vez de hacer sufrir
// los primeros segundos otra vez.
//
// Se empieza a mirar despues de 90 cuadros de juego: los primeros siempre
// tardan de mas —decodificar imagenes, armar el nivel— y castigar por eso
// bajaria la calidad en telefonos que andan perfecto.
// Ventanas cortas a proposito: 45 cuadros de calentamiento y 60 de medicion.
// En un telefono que va a 25 por segundo eso son cuatro segundos de sufrir
// antes de que baje solo, y cuatro segundos se aguantan. Con ventanas largas
// la medida seria mas confiable y el jugador se comeria diez.
const VIG = { n: 0, lentos: 0, calentando: 45, listo: false };
function vigilar(dt) {
  if (VIG.listo || cargar().ajustes.grafico !== "auto") return;
  if (VIG.calentando > 0) { VIG.calentando--; return; }
  VIG.n++;
  if (dt > 21) VIG.lentos++;
  if (VIG.n < 60) return;
  const flojo = VIG.lentos / VIG.n > 0.45;
  if (flojo && GRAF.esc > 1) {
    calidad(1);
    const d = cargar(); d.ajustes.graficoAuto = 1; guardarAjustes();
    VIG.listo = true;
  } else if (!flojo) {
    // Anda bien: se confirma la calidad actual y no se vuelve a medir.
    const d = cargar(); d.ajustes.graficoAuto = GRAF.esc; guardarAjustes();
    VIG.listo = true;
  }
  VIG.n = 0; VIG.lentos = 0;
}

/**
 * Que direccion se le pide al jugador este cuadro.
 *
 * Devolver `undefined` en vez de 0 no es un descuido: es lo que le dice a la
 * fisica "nadie dijo nada, corre solo". En modo corredor se manda undefined
 * cuando no hay flecha apretada; en modo libre se manda 0, que quiere decir
 * "quedate quieto".
 */
function direccionPedida() {
  const x = (entrada.der ? 1 : 0) + (entrada.izq ? -1 : 0);
  if (x !== 0) return x;
  return cargar().ajustes.auto ? undefined : 0;
}

function bucle(ahora) {
  requestAnimationFrame(bucle);
  let dt = ahora - ultimo; ultimo = ahora;
  if (dt > 250) dt = PASO;                 // volver de una pestana en segundo plano
  if (partida) vigilar(dt);
  acumulado += dt;
  let pasos = 0;
  while (acumulado >= PASO && pasos < 5) {
    acumulado -= PASO; pasos++;
    if (partida) {
      // Las dos flechas juntas se anulan: pasa al arrastrar el pulgar y, sin
      // esto, gana la que se leyo ultima y el personaje tiembla.
      const ent = { toque: entrada.apoyado,
                    toqueNuevo: entrada.pedido || (entrada.apoyado && !entrada.previo),
                    x: direccionPedida(),
                    frenar: entrada.frenar };
      entrada.previo = entrada.apoyado;
      entrada.pedido = false;
      const antes = partida.estado;
      try { partida.actualizar(ent); }
      catch (e) { seRompio(e, "la logica"); break; }
      if (!partida) break;
      if (antes !== partida.estado &&
          (partida.estado === ESTADO.GANADO || partida.estado === ESTADO.PERDIDO)) {
        terminar(partida.estado === ESTADO.GANADO);
      }
    } else { entrada.previo = entrada.apoyado; entrada.pedido = false; }
  }
  if (partida) {
    try { partida.dibujar(ctx); UI.pintarHud(partida); }
    catch (e) { seRompio(e, "el dibujo"); }
  }
}

function terminar(gano) {
  const p = partida;
  // Menos espera, y ENVUELTA. Eran 900 ms al ganar y 700 al perder, encima de
  // la bajada del mastil: el jugador veia hasta dos segundos de pantalla
  // quieta y lo leia como un cuelgue. Y si pintarResultado tirara una
  // excepcion, `partida = null` no corria nunca: el bucle seguia dibujando la
  // partida terminada para siempre, sin cartel y sin forma de salir. Eso si
  // es colgarse, y por eso va con red.
  setTimeout(() => {
    try {
    UI.pintarResultado(p, cfgActual, gano,
      () => {   // siguiente
        const i = NIVELES.indexOf(cfgActual);
        const sig = NIVELES[i + 1];
        if (sig && sig.m <= cargar().desbloqueado) empezar(sig.m, sig.n); else alMapa();
      },
      () => empezar(cfgActual.m, cfgActual.n),
      alMapa);
    } catch (e) {
      console.error("no se pudo pintar el resultado:", e);
      alMapa();
    }
    partida = null;
  }, gano ? 420 : 340);
}

// --- botones -------------------------------------------------------------
// Jugar entra DERECHO al nivel que toca. El mapa tiene su propio boton.
$("#btn-jugar").addEventListener("click", () => {
  despertar(); efe.menu();
  const { m, n } = proximoNivel();
  empezar(m, n);
});
$("#btn-niveles").addEventListener("click", () => { despertar(); efe.menu(); alMapa(); });
$("#btn-comojuego").addEventListener("click", () => { efe.menu(); UI.mostrar("p-ayuda"); });
$("#btn-ajustes").addEventListener("click", () => { efe.menu(); UI.mostrar("p-ajustes"); });
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); UI.mostrar(b.dataset.volver); });
$("#hud-salir").addEventListener("click", alMapa);
$("#hud-pantalla").addEventListener("click", UI.pantallaCompleta);

// --- carga de assets -----------------------------------------------------
const HOJAS = [
  ["heroe_correr", 4, 4], ["heroe_saltar", 4, 4], ["heroe_quieto", 4, 4],
  ["heroe_doble", 4, 4], ["heroe_triple", 4, 4],
  ["heroe_girar", 4, 4], ["heroe_comer", 4, 4],
  ["hongo_crecer", 4, 4], ["hongo_super", 4, 4],
  ["bolo_caminar", 4, 4], ["caracol_caminar", 4, 4], ["caracol_concha", 4, 4],
  ["aleta_volar", 4, 4], ["erizo_caminar", 4, 4], ["fauces_morder", 4, 4],
  ["osario_caminar", 4, 4], ["vela_flotar", 4, 4], ["perno_volar", 4, 4],
  ["brasa_saltar", 4, 4], ["yunque_caminar", 4, 4], ["coloso_caminar", 4, 4],
  ["moneda_girar", 4, 4], ["resorte_saltar", 4, 4],
];
const TEMAS_TILE = ["llano", "subte", "castillo", "desierto", "cielo", "nave", "torre", "fantasma"];

/**
 * Devuelve una copia de la banda con el borde de ARRIBA desvanecido.
 *
 * Las dos bandas del fondo se piden recortadas —"solo la silueta, sin cielo
 * detras"— y el servidor a veces devuelve un rectangulo opaco de punta a
 * punta. Dibujado, ese rectangulo corta la pantalla con una linea recta a lo
 * ancho: se ve clarisimo en el subte, donde la cueva de atras arranca de
 * golpe en el medio del cielo.
 *
 * Arreglarlo pidiendo de nuevo no sirve: ya se pidio dos veces y volvio igual
 * las dos. Aca se desvanece el cuarto de arriba con un degradado de alfa, que
 * es determinista y anda con cualquier imagen que llegue, opaca o no. Si la
 * banda YA venia recortada, el degradado no cambia nada visible porque arriba
 * no hay nada que desvanecer.
 */
function desvanecerArriba(img, frac = 0.34, altoMax = 0) {
  try {
    const esc = altoMax > 0 ? Math.min(1, altoMax / img.height) : 1;
    const l = document.createElement("canvas");
    l.width = Math.max(1, Math.round(img.width * esc));
    l.height = Math.max(1, Math.round(img.height * esc));
    const c = l.getContext("2d");
    c.drawImage(img, 0, 0, l.width, l.height);
    const g = c.createLinearGradient(0, 0, 0, l.height * frac);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = g;
    c.fillRect(0, 0, l.width, l.height * frac);
    return l;
  } catch (e) {
    return img;          // sin canvas auxiliar, mejor la banda dura que nada
  }
}

const imgsTile = {};

function hacerPatron(img) {
  if (!img) return null;
      // La textura se ACHICA antes de hacer el patron. La imagen generada mide
      // 256 y el tile mide 16: usada tal cual, una sola copia cubre dieciseis
      // tiles y el terreno se ve como cuatro franjas gigantes en vez de como
      // suelo. A PATRON pixeles repite cada cuatro tiles, que es la escala a
      // la que el pixel art se lee sin que se cuente la repeticion.
  const e = GRAF.esc;
  const chico = document.createElement("canvas");
  chico.width = chico.height = PATRON * e;
  const cc = chico.getContext("2d");
  cc.imageSmoothingEnabled = false;
  cc.drawImage(img, 0, 0, PATRON * e, PATRON * e);
  const pat = ctx.createPattern(chico, "repeat");
      // El patron se achica por ESC para COMPENSAR la escala del lienzo. El
      // relleno se pide en pixeles de juego, asi que sin esto el patron
      // repetiria cada PATRON pixeles de LIENZO —la mitad— y el suelo saldria
      // con la textura al doble de chica. Con la compensacion repite cada
      // PATRON pixeles de juego, pero con el doble de pixeles adentro.
  try { pat.setTransform(new DOMMatrix([1 / e, 0, 0, 1 / e, 0, 0])); }
  catch (err) { /* navegador viejo: se ve mas grueso, pero se ve */ }
  return pat;
}

// --- los fondos, de a un tema por vez ------------------------------------
//
// SE CARGABAN LOS OCHO TEMAS AL ARRANCAR, Y ESO ERA EL LAG.
//
// Son veinticuatro imagenes de 1024x572. Decodificadas ocupan 2,3 MB cada una
// —un pixel son cuatro bytes, siempre, sin importar lo que pese el archivo—,
// o sea 56 MB. Y las dieciseis bandas se copian ademas a un lienzo para
// desvanecerles el borde de arriba: otros 37 MB. Mas las hojas de sprites, que
// se midieron en 23. Pasa de cien megas de mapas de bits vivos al mismo
// tiempo, en un telefono, para dibujar UN tema.
//
// Cuando la memoria de graficos se llena, el navegador empieza a tirar mapas
// de bits y a volver a decodificarlos cuando los necesita: eso es un tiron de
// decenas de milisegundos EN MEDIO DEL CUADRO, y se siente como lo que se
// reporto — que va lento aunque el juego no este haciendo nada raro.
//
// Ahora se carga el tema que se va a jugar, y se guardan los dos ultimos: 6 MB
// en vez de 93. Volver a un tema reciente sigue siendo instantaneo.
const capasCache = new Map();
const capasOrden = [];

function capasDe(tema) {
  const guardado = capasCache.get(tema);
  if (guardado) return Promise.resolve(guardado);
  const c = {};
  const p = Promise.all(["cielo", "lejos", "cerca"].map((cp) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      // La banda se guarda ya achicada a lo MAS GRANDE que se va a dibujar.
      // Guardar el original de 1024 no agrega un pixel de detalle —nunca se
      // dibuja a mas de 220 pixeles de juego de alto— y cuesta cinco veces
      // mas memoria.
      c[cp] = cp === "cielo" ? img : desvanecerArriba(img, 0.34, 220 * GRAF.esc);
      ok();
    };
    img.onerror = () => ok();
    img.src = ruta(`assets/fondo/${tema}_${cp}.webp`);
  }))).then(() => {
    capasCache.set(tema, c);
    capasOrden.push(tema);
    while (capasOrden.length > 2) capasCache.delete(capasOrden.shift());
    capas[tema] = c;
    return c;
  });
  return p;
}

function cargarPatron(tema) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => { imgsTile[tema] = img; ok(hacerPatron(img)); };
    img.onerror = () => ok(null);
    img.src = ruta(`assets/tile/${tema}.webp`);
  });
}

/**
 * Cambia la resolucion a la que se dibuja, y rehace lo que depende de ella.
 *
 * Hay que rehacer los patrones del terreno: llevan adentro un lienzo del
 * tamano de la escala vieja y una transformacion que la compensa. Sin esto,
 * bajar la calidad dejaba el suelo con la textura al doble de chica.
 */
function calidad(esc) {
  esc = Math.max(1, Math.min(3, Math.round(esc)));
  if (esc === GRAF.esc) return;
  GRAF.esc = esc;
  for (const tm of TEMAS_TILE) if (imgsTile[tm]) patrones[tm] = hacerPatron(imgsTile[tm]);
  if (partida) partida.patron = patrones[partida.nv.tema] || null;
  redimensionar();
}

(async () => {
  // La calidad guardada se aplica ANTES de cargar nada: los patrones del
  // terreno y las capas del fondo se arman a la resolucion que este puesta, y
  // cambiarla despues obliga a rehacerlos todos.
  {
    const g = cargar().ajustes.grafico;
    GRAF.esc = g === "auto" ? (cargar().ajustes.graficoAuto || 2)
                            : Math.max(1, Math.min(3, Number(g) || 2));
  }
  // EL IDIOMA SE ELIGE MIENTRAS CARGA, no antes. Las dos cosas arrancan a la
  // vez: el que elige rapido no espera dos veces, y el que se toma su tiempo
  // encuentra el juego ya cargado. Si todavia falta cuando elige, vuelve la
  // pantalla de carga para que vea que algo sigue pasando.
  let cargado = false;
  const eligiendo = UI.elegirIdioma();
  eligiendo.then((eligio) => { if (eligio && !cargado) UI.mostrar("p-carga"); });

  $("#carga-detalle").textContent = t("carga.sprites");
  hojas = await cargarTodas(HOJAS.map(([k, c, f]) => [k, `assets/hojas/${k}.webp`, c, f]));
  const faltan = HOJAS.filter(([k]) => !hojas[k]).map(([k]) => k);
  await Promise.all(TEMAS_TILE.map(async (tm) => { patrones[tm] = await cargarPatron(tm); }));
  // Las piezas sueltas: tubos e iconos del HUD.
  const PIEZAS = ["tubo_boca", "tubo_cuerpo", "plataforma",
                 "icono_moneda", "icono_burbuja", "icono_reloj", "ficha_heroe"];
  const ps = {};
  await Promise.all(PIEZAS.map((k) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => { ps[k] = img; ok(); };
    img.onerror = () => ok();
    img.src = ruta(`assets/piezas/${k}.webp`);
  })));
  registrarPiezas(ps);
  // Los fondos NO se cargan todos aca: ver capasDe(). Se carga el del primer
  // tema nada mas, para que el primer nivel entre sin esperar.
  $("#carga-detalle").textContent = t("carga.fondos");
  await capasDe("llano");
  // La escena del hongo arcoiris: veinticuatro fotogramas sacados de un video
  // generado, en una grilla de 4x6. No pasa por cargarHoja a proposito: esa
  // mide el recorte leyendo el alfa de la hoja entera, y aca son fotogramas
  // opacos que ocupan la celda completa — serian dos millones de pixeles
  // leidos al arrancar para llegar a la respuesta que ya sabemos.
  {
    const im = new Image();
    im.onload = () => { escenaHongo = { img: im, cols: 4, filas: 6, n: 24 };
                        if (partida) partida.escenaHongo = escenaHongo; };
    im.onerror = () => {};
    im.src = ruta("assets/escena/hongo.webp");
  }
  // La musica se carga sin bloquear: el juego arranca igual y la pista entra
  // cuando llega. Bloquear el arranque por 400 KB es regalar el primer segundo.
  cargarPistas({ llano: "assets/snd/llano.mp3", subte: "assets/snd/subte.mp3",
                 castillo: "assets/snd/castillo.mp3" });
  UI.montarAjustes(
    (g) => calidad(g === "auto" ? (cargar().ajustes.graficoAuto || 2) : g),
    // Cambiar de idioma no alcanza con reescribir los `data-t`: el menu y el
    // mapa arman sus textos en JavaScript y hay que volver a pintarlos.
    () => { if (!$("#p-mapa").hidden) UI.pintarMapa(empezar); UI.pintarInicio(); });
  // El arte de portada, de fondo del menu.
  const arte = new Image();
  arte.onload = () => { $("#p-inicio").style.backgroundImage = `url(${arte.src})`; };
  arte.src = ruta("assets/titulo_fondo.webp");
  // El logo dibujado reemplaza al de texto si carga. Si no carga, el de texto
  // queda — un menu sin titulo es peor que un titulo tipografico.
  const lg = new Image();
  lg.onload = () => {
    const e = $("#logo-img");
    e.src = lg.src; e.hidden = false;
    $("#p-inicio .logo").hidden = true;
  };
  lg.src = ruta("assets/logo.webp");
  cargado = true;
  redimensionar();
  requestAnimationFrame(bucle);
  // PIQUE se publica ANTES de esperar la eleccion de idioma y no despues.
  // Las pruebas —y cualquier cosa de afuera— esperan a que exista para saber
  // que el juego cargo; si se publicara despues, un guardado vacio lo dejaria
  // colgado en la pantalla de idiomas para siempre sin que nadie sepa que ya
  // estaba todo listo.
  window.PIQUE = {
    get partida() { return partida; }, get cfg() { return cfgActual; },
    empezar, alMapa, entrada, NIVELES, hojas, faltan, calidad, GRAF, VIG, vigilar,
    get capas() { return Object.fromEntries(capasCache); },
  };
  await eligiendo;
  UI.mostrar("p-inicio");
})();


