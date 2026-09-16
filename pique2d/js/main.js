// Arranque, entrada y bucle.

import { NIVELES, buscarNivel, idNivel, VISTA, ajustarVista, ESC, PATRON } from "./mundo.js";
import { generarNivel } from "./generador.js";
import { Partida, ESTADO } from "./juego.js";
import { cargar, tierActual, proximoNivel } from "./guardado.js";
import * as UI from "./interfaz.js";
import { despertar, efe, pararMusica, volumen, cargarPistas } from "./audio.js";
import { cargarTodas } from "./sprites.js";
import { registrarPiezas } from "./dibujo.js";
import { ruta } from "./assets.js";

const $ = UI.$;
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d", { alpha: false });
function redimensionar() {
  ajustarVista(innerWidth, innerHeight);
  lienzo.width = VISTA.ancho * ESC; lienzo.height = VISTA.alto * ESC;
  // Hay que APAGARLO DE NUEVO: el navegador reactiva el suavizado cada vez que
  // cambia el tamano del lienzo, y los sprites salen lavados sin aviso.
  ctx.imageSmoothingEnabled = false;
  // Y la escala tambien se vuelve a poner: cambiar el ancho o el alto de un
  // lienzo lo resetea ENTERO, transformacion incluida. Sin esto el juego se
  // dibujaria en un cuarto del lienzo despues del primer giro de pantalla.
  ctx.setTransform(ESC, 0, 0, ESC, 0, 0);
  if (partida) partida.camara(true);
}
addEventListener("resize", redimensionar);
addEventListener("orientationchange", () => setTimeout(redimensionar, 180));
// Suavizado APAGADO, y hay que volver a apagarlo despues de cada resize: el
// navegador lo reactiva al cambiar el tamano del lienzo y los sprites salen
// lavados sin que nada avise.
ctx.imageSmoothingEnabled = false;
ctx.setTransform(ESC, 0, 0, ESC, 0, 0);

let partida = null, cfgActual = null, tierActualN = "rosa";
let hojas = {}, patrones = {}, capas = {};

// --- entrada -------------------------------------------------------------
// Un solo boton. Se guarda "apoyado" y se calcula el flanco por cuadro: si el
// flanco se calculara en el evento, dos toques dentro del mismo cuadro se
// comerian uno, y a 60 Hz eso pasa todo el tiempo en pantallas tactiles.
const entrada = { apoyado: false, previo: false };
const abajo = (e) => {
  despertar();
  entrada.apoyado = true;
  if (e.cancelable) e.preventDefault();
};
const arriba = () => { entrada.apoyado = false; };

for (const ev of ["pointerdown", "touchstart", "mousedown"])
  lienzo.addEventListener(ev, abajo, { passive: false });
for (const ev of ["pointerup", "pointercancel", "touchend", "mouseup", "mouseleave"])
  window.addEventListener(ev, arriba);

addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "KeyZ", "KeyX", "Enter"].includes(e.code)) { abajo(e); }
  if (e.code === "Escape" && partida) alMapa();
  if (e.code === "KeyR" && partida) empezar(cfgActual.m, cfgActual.n);
});
addEventListener("keyup", (e) => {
  if (["Space", "ArrowUp", "KeyZ", "KeyX", "Enter"].includes(e.code)) arriba();
});
// Perder el foco con el dedo apoyado dejaba al jugador saltando para siempre.
addEventListener("blur", arriba);
document.addEventListener("visibilitychange", () => { if (document.hidden) arriba(); });

// --- pantallas -----------------------------------------------------------
function alMapa() {
  partida = null; pararMusica();
  UI.pintarMapa(empezar);
  UI.mostrar("p-mapa");
}

function empezar(m, n) {
  cfgActual = buscarNivel(m, n);
  tierActualN = tierActual(idNivel(m, n));
  $("#gen-nivel").textContent = `${idNivel(m, n)} · ${cfgActual.titulo}`;
  $("#gen-detalle").textContent = "Armando y comprobando que se pueda terminar…";
  UI.mostrar("p-generando");
  // Dos cuadros de espera antes de generar: generar bloquea el hilo hasta un
  // segundo, y sin ceder el control la pantalla "generando" no llega a
  // pintarse nunca — el jugador ve un cuelgue en vez de un aviso.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const t0 = performance.now();
    const nv = generarNivel(cfgActual, tierActualN);
    const ms = Math.round(performance.now() - t0);
    partida = new Partida(nv, tierActualN, hojas, patrones[nv.tema] || null, capas[nv.tema] || {});
    $("#hud-nivel").textContent = `Mundo ${m}-${n} · ${cfgActual.titulo}`;
  $("#hud-num").textContent = String((m - 1) * 4 + n);
    $("#hud-gen").textContent = nv.validacion.fallo
      ? "sin validar"
      : `validado en ${nv.validacion.intentos} ${nv.validacion.intentos === 1 ? "intento" : "intentos"} · ${ms} ms`;
    UI.mostrar("p-juego");
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
    $("#res-titulo").textContent = "Se rompió algo";
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

function bucle(ahora) {
  requestAnimationFrame(bucle);
  let dt = ahora - ultimo; ultimo = ahora;
  if (dt > 250) dt = PASO;                 // volver de una pestana en segundo plano
  acumulado += dt;
  let pasos = 0;
  while (acumulado >= PASO && pasos < 5) {
    acumulado -= PASO; pasos++;
    if (partida) {
      const ent = { toque: entrada.apoyado, toqueNuevo: entrada.apoyado && !entrada.previo };
      entrada.previo = entrada.apoyado;
      const antes = partida.estado;
      try { partida.actualizar(ent); }
      catch (e) { seRompio(e, "la logica"); break; }
      if (!partida) break;
      if (antes !== partida.estado &&
          (partida.estado === ESTADO.GANADO || partida.estado === ESTADO.PERDIDO)) {
        terminar(partida.estado === ESTADO.GANADO);
      }
    } else entrada.previo = entrada.apoyado;
  }
  if (partida) {
    try { partida.dibujar(ctx); UI.pintarHud(partida); }
    catch (e) { seRompio(e, "el dibujo"); }
  }
}

function terminar(gano) {
  const p = partida;
  setTimeout(() => {
    UI.pintarResultado(p, cfgActual, gano,
      () => {   // siguiente
        const i = NIVELES.indexOf(cfgActual);
        const sig = NIVELES[i + 1];
        if (sig && sig.m <= cargar().desbloqueado) empezar(sig.m, sig.n); else alMapa();
      },
      () => empezar(cfgActual.m, cfgActual.n),
      alMapa);
    partida = null;
  }, gano ? 900 : 700);
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
function desvanecerArriba(img, frac = 0.34) {
  try {
    const l = document.createElement("canvas");
    l.width = img.width; l.height = img.height;
    const c = l.getContext("2d");
    c.drawImage(img, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, img.height * frac);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.45)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = g;
    c.fillRect(0, 0, img.width, img.height * frac);
    return l;
  } catch (e) {
    return img;          // sin canvas auxiliar, mejor la banda dura que nada
  }
}

function cargarPatron(tema) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      // La textura se ACHICA antes de hacer el patron. La imagen generada mide
      // 256 y el tile mide 16: usada tal cual, una sola copia cubre dieciseis
      // tiles y el terreno se ve como cuatro franjas gigantes en vez de como
      // suelo. A PATRON pixeles repite cada cuatro tiles, que es la escala a
      // la que el pixel art se lee sin que se cuente la repeticion.
      const chico = document.createElement("canvas");
      chico.width = chico.height = PATRON * ESC;
      const cc = chico.getContext("2d");
      cc.imageSmoothingEnabled = false;
      cc.drawImage(img, 0, 0, PATRON * ESC, PATRON * ESC);
      const pat = ctx.createPattern(chico, "repeat");
      // El patron se achica por ESC para COMPENSAR la escala del lienzo. El
      // relleno se pide en pixeles de juego, asi que sin esto el patron
      // repetiria cada PATRON pixeles de LIENZO —la mitad— y el suelo saldria
      // con la textura al doble de chica. Con la compensacion repite cada
      // PATRON pixeles de juego, pero con el doble de pixeles adentro.
      try { pat.setTransform(new DOMMatrix([1 / ESC, 0, 0, 1 / ESC, 0, 0])); }
      catch (e) { /* navegador viejo: se ve mas grueso, pero se ve */ }
      ok(pat);
    };
    img.onerror = () => ok(null);
    img.src = ruta(`assets/tile/${tema}.webp`);
  });
}

(async () => {
  $("#carga-detalle").textContent = "Cargando sprites…";
  hojas = await cargarTodas(HOJAS.map(([k, c, f]) => [k, `assets/hojas/${k}.webp`, c, f]));
  const faltan = HOJAS.filter(([k]) => !hojas[k]).map(([k]) => k);
  await Promise.all(TEMAS_TILE.map(async (t) => { patrones[t] = await cargarPatron(t); }));
  // Las piezas sueltas: tubos e iconos del HUD.
  const PIEZAS = ["tubo_boca", "tubo_cuerpo", "plataforma",
                 "icono_moneda", "icono_burbuja", "icono_reloj"];
  const ps = {};
  await Promise.all(PIEZAS.map((k) => new Promise((ok) => {
    const img = new Image();
    img.onload = () => { ps[k] = img; ok(); };
    img.onerror = () => ok();
    img.src = ruta(`assets/piezas/${k}.webp`);
  })));
  registrarPiezas(ps);
  // Los fondos: tres capas por tema. Se cargan todas al arrancar porque el
  // jugador puede saltar a cualquier mundo desde el mapa.
  $("#carga-detalle").textContent = "Cargando fondos…";
  await Promise.all(TEMAS_TILE.flatMap((tema) => {
    capas[tema] = {};
    return ["cielo", "lejos", "cerca"].map((cp) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => { capas[tema][cp] = cp === "cielo" ? img : desvanecerArriba(img); ok(); };
      img.onerror = () => ok();
      img.src = ruta(`assets/fondo/${tema}_${cp}.webp`);
    }));
  }));
  // La musica se carga sin bloquear: el juego arranca igual y la pista entra
  // cuando llega. Bloquear el arranque por 400 KB es regalar el primer segundo.
  cargarPistas({ llano: "assets/snd/llano.mp3", subte: "assets/snd/subte.mp3",
                 castillo: "assets/snd/castillo.mp3" });
  UI.montarAjustes();
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
  UI.mostrar("p-inicio");
  redimensionar();
  requestAnimationFrame(bucle);
  window.PIQUE = {
    get partida() { return partida; }, get cfg() { return cfgActual; },
    empezar, alMapa, entrada, NIVELES, hojas, faltan,
  };
})();


