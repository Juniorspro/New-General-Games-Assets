// Arranque, entrada, menú y bucle.

import { GIRO, aplicarGiro, ALTO_MINIMO } from "./giro.js";
import { t, aplicar, ponerIdioma, idioma, IDIOMAS } from "./idioma.js";
import { construirNivel, CAPITULOS, FINAL } from "./nivel.js";
import { Partida, VISTA } from "./juego.js";
import { dibujar, dibujarEscenario, origenEscenario } from "./dibujo.js";
import { Escenario } from "./portales.js";
import { NIVELES_P } from "./mapas.js";
import { escalarCuerpos } from "./cuerpo.js";
import { rapidez, TOPE_CAIDA } from "./verlet.js";
import { despertar, efe, sonando, zumbido, cargarVoces, voz, volumenes, aire, callar, decodificadas, creditosSonidos } from "./audio.js";
import { registrarPiezas } from "./cuerpo.js";
import { registrarTexturas } from "./dibujo.js";
import { cargar, guardar, borrar } from "./guardado.js";
import { VOCES } from "./voces.js";
import { ruta } from "./assets.js";

const $ = (s) => document.querySelector(s);
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d", { alpha: false });

let nivel = construirNivel();
let partida = null;          // el pozo
let escena = null;           // el modo portales
let capSonando = -1;

// LOS CUERPOS SON MÁS CHICOS EN PORTALES. En el pozo el pasillo mide 360 y un
// Rilo de 76 píxeles se lee bien; acá el escenario es una grilla de tiles de
// 16 y el agujero de un portal mide dos, así que un muñeco de cinco tiles no
// pasa. Se cambia antes de armar los cuerpos, que es cuando se lee.
const ESCALA_P = 0.66;

// --- tamano --------------------------------------------------------------
// EL ANCHO ES FIJO Y EL ALTO NO, y esa asimetria es la regla de justicia del
// juego. El pasillo mide 360 unidades en todos los aparatos: si se escalara
// para llenar la pantalla en las dos direcciones, en un telefono ancho el
// hueco de 108 px seria proporcionalmente el mismo pero en uno angosto habria
// que cruzar mas pasillo en el mismo tiempo. Con el ancho clavado, esquivar
// cuesta igual en todos lados.
//
// El alto, en cambio, se estira hasta donde llegue la pantalla. Ver un poco
// mas o un poco menos de pozo no cambia la dificultad —se cae siempre a la
// misma velocidad— y a cambio el juego llena el telefono en vez de dejar dos
// franjas negras de setenta pixeles arriba y abajo.
//
// Las medidas son las LOGICAS (GIRO.ancho/alto): con el teléfono acostado el
// juego va girado y su ancho es el alto de la ventana.
let esc = 1;
function redimensionar() {
  aplicarGiro();
  const w = GIRO.ancho(), h = GIRO.alto();
  esc = Math.min(w / VISTA.ancho, h / ALTO_MINIMO);   // nunca menos de 560 de alto util
  let alto = h / esc;
  if (alto > 1000) { esc = h / 1000; alto = 1000; }   // ni mas de 1000
  VISTA.alto = Math.round(alto);
  const anCSS = VISTA.ancho * esc, alCSS = VISTA.alto * esc;
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  lienzo.width = Math.round(anCSS * dpr);
  lienzo.height = Math.round(alCSS * dpr);
  lienzo.style.width = `${anCSS}px`;
  lienzo.style.height = `${alCSS}px`;
  ctx.setTransform(esc * dpr, 0, 0, esc * dpr, 0, 0);
  // La interfaz vive exactamente sobre el lienzo: un menu del ancho de la
  // ventana arriba de un juego de 360 se lee como dos cosas distintas.
  document.documentElement.style.setProperty("--an", `${anCSS}px`);
  document.documentElement.style.setProperty("--al", `${alCSS}px`);
}
addEventListener("resize", redimensionar);
// Hay teléfonos que avisan el giro antes de tener las medidas nuevas: se
// recalcula al toque y otra vez a los 250 ms.
addEventListener("orientationchange", () => { redimensionar(); setTimeout(redimensionar, 250); });
redimensionar();
setTimeout(redimensionar, 250);

// --- entrada -------------------------------------------------------------
// UN DEDO ALCANZA. Se toca donde sea y el reactor empuja HACIA el dedo: no hay
// que buscar un boton, el boton es la pantalla entera. El empujon es analogico
// —cuanto mas lejos esta el dedo del muneco, mas fuerte— asi que se puede
// corregir de a poco en vez de ir siempre a fondo.
const entrada = { mover: 0, bolita: false, dedoX: null };
let dedoDir = null, dedoBol = null;

// `offsetX/offsetY` y no `clientX - getBoundingClientRect()`: el offset ya
// viene en coordenadas del lienzo aunque el juego esté girado, y el rectángulo
// de la ventana no (sale con el ancho y el alto cambiados).
function aMundo(ev) {
  return { x: ev.offsetX / esc, y: ev.offsetY / esc };
}

// EN PORTALES, UN TOQUE CORTO DISPARA Y UN ARRASTRE EMPUJA, y se distinguen
// por lo que hizo el dedo, no por dónde lo puso. Partir la pantalla en dos
// mitades —una para apuntar y otra para moverse— era lo obvio y es peor: la
// mitad de las paredes te quedan del lado que no dispara. Midiendo el gesto,
// toda la pantalla sirve para las dos cosas.
let tocado = null;
lienzo.addEventListener("pointerdown", (ev) => {
  despertar();
  if (escena && dedoDir === null) {
    const m = aMundo(ev);
    tocado = { id: ev.pointerId, t: performance.now(), x: m.x, y: m.y, arrastro: false };
  }
  if (dedoDir === null) { dedoDir = ev.pointerId; entrada.dedoX = aMundo(ev).x; }
  else entrada.bolita = true;          // el segundo dedo hace bolita
  // setPointerCapture TIRA EXCEPCION si el puntero ya no esta activo —pasa si
  // el dedo se levanta entre el evento y esta linea, y pasa siempre con
  // eventos sinteticos—. Sin el try, una excepcion aca deja el toque a medio
  // registrar: el reactor se queda prendido y el muneco empuja para siempre.
  try { lienzo.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
lienzo.addEventListener("pointermove", (ev) => {
  if (ev.pointerId === dedoDir) entrada.dedoX = aMundo(ev).x;
  if (tocado && ev.pointerId === tocado.id) {
    const m = aMundo(ev);
    if (Math.hypot(m.x - tocado.x, m.y - tocado.y) > 12) tocado.arrastro = true;
  }
});
const soltar = (ev) => {
  if (tocado && ev.pointerId === tocado.id) {
    const rapido = performance.now() - tocado.t < 260;
    if (rapido && !tocado.arrastro && escena) {
      const o = origenEscenario();
      // El tiro suena siempre que sale, se clave o rebote: el que tocó tiene
      // que saber que el toque se entendió como disparo y no como empujón.
      // Se mira ANTES de disparar porque `disparar` devuelve false tanto si no
      // salió (enfriándose, o ganado) como si rebotó en lo negro.
      const sale = escena.estado === "jugando" && !(escena.enfriar > 0);
      const puso = escena.disparar(tocado.x - o.x, tocado.y - o.y);
      if (sale) { efe.disparo(); const d = cargar(); d.stats.tiros++; guardar(); }
      ultimoTiro = { x: tocado.x - o.x, y: tocado.y - o.y, gx: tocado.x, gy: tocado.y, puso, sale };
    }
    tocado = null;
  }
  if (ev.pointerId === dedoDir) { dedoDir = null; entrada.dedoX = null; }
  else entrada.bolita = false;
};
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);
let ultimoTiro = null;

// El boton de bolita, por si se prefiere el pulgar en un lugar fijo.
const btnBol = $("#btn-bolita");
btnBol.addEventListener("pointerdown", (ev) => {
  despertar(); dedoBol = ev.pointerId; entrada.bolita = true;
  try { btnBol.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
const soltarBol = (ev) => { if (ev.pointerId === dedoBol) { dedoBol = null; entrada.bolita = false; } };
btnBol.addEventListener("pointerup", soltarBol);
btnBol.addEventListener("pointercancel", soltarBol);

const teclas = {};
addEventListener("keydown", (e) => {
  teclas[e.code] = true;
  if ((partida || escena) && ["Space", "ArrowLeft", "ArrowRight", "ArrowDown"].includes(e.code)) e.preventDefault();
  if (e.code === "Enter" && !$("#p-fin").hidden) alMenu();
});
addEventListener("keyup", (e) => { teclas[e.code] = false; });

function leerEntrada() {
  if (teclas.ArrowLeft) entrada.mover = -1;
  else if (teclas.ArrowRight) entrada.mover = 1;
  else if (entrada.dedoX != null && (partida || escena)) {
    const cuerpo = partida ? partida.rilo : escena.rilo;
    const ref = partida ? entrada.dedoX : entrada.dedoX - origenEscenario().x;
    // El empujon es proporcional a la distancia, con un tope: a 70 px del
    // muneco ya esta a fondo. Con menos de 8 px se considera cero, porque si
    // no el dedo quieto encima del personaje lo hace vibrar.
    const d = ref - cuerpo.p.pecho.x;
    entrada.mover = Math.abs(d) < 8 ? 0 : Math.max(-1, Math.min(1, d / 70));
  } else entrada.mover = 0;
  entrada.bolita = entrada.bolita || !!teclas.Space || !!teclas.ArrowDown;
}

// --- las imágenes --------------------------------------------------------
//
// EL JUEGO ARRANCA SIN ESPERARLAS. Las piezas de los cuerpos y las texturas se
// cargan en segundo plano y se registran cuando llegan: hasta entonces se
// dibuja la versión vectorial, que es la que tenía el juego antes de que
// existieran las imágenes. Así una conexión lenta —o un archivo que falta— no
// deja al jugador mirando una pantalla de carga, y el juego sigue siendo
// jugable con cero assets.
const PARTES = ["cabeza", "torso", "brazo_alto", "brazo_bajo", "pierna_alta", "pierna_baja"];
const TEXTURAS = ["pared", "repisa", "soga"];

function traer(url) {
  return new Promise((listo) => {
    const im = new Image();
    im.onload = () => listo(im);
    im.onerror = () => listo(null);
    im.src = url;
  });
}

async function cargarImagenes() {
  const piezas = { rilo: {}, tito: {} };
  const texturas = {};
  await Promise.all([
    ...["rilo", "tito"].flatMap((quien) => PARTES.map(async (parte) => {
      const im = await traer(ruta(`assets/partes/${quien}_${parte}.webp`));
      if (im) piezas[quien][parte] = im;
    })),
    ...TEXTURAS.map(async (tx) => {
      const im = await traer(ruta(`assets/partes/${tx}.webp`));
      if (im) texturas[tx] = im;
    }),
  ]);
  // Se registran solo si están LAS DOS piezas que mandan. Un muñeco con torso
  // dibujado y cabeza faltante es peor que uno vectorial entero.
  if (piezas.rilo.torso && piezas.tito.torso) registrarPiezas(piezas);
  registrarTexturas(texturas);
  return { piezas, texturas };
}

// --- pantallas -----------------------------------------------------------
function mostrar(id) {
  for (const p of document.querySelectorAll(".pantalla")) p.hidden = true;
  $("#" + id).hidden = false;
}

let avisoT = 0;
function avisar(txt) {
  const a = $("#aviso");
  a.textContent = txt; a.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 4000);
}

// --- idioma --------------------------------------------------------------
// La pantalla sale en cada arranque, con la elección anterior marcada y con
// el foco puesto: al que ya eligió le alcanza con un Enter o un toque.
function pantallaIdioma() {
  const actual = cargar().ajustes.idioma;
  let foco = null;
  for (const b of document.querySelectorAll(".idioma-btn")) {
    const si = b.dataset.idioma === actual;
    b.classList.toggle("activo", si);
    b.setAttribute("aria-pressed", String(si));
    if (si) foco = b;
  }
  mostrar("p-idioma");
  (foco || document.querySelector(".idioma-btn")).focus({ preventScroll: true });
}

function elegirIdioma(cod) {
  ponerIdioma(cod);
  const d = cargar(); d.ajustes.idioma = cod; guardar();
  aplicar();
  alMenu();
}
for (const b of document.querySelectorAll(".idioma-btn"))
  b.addEventListener("click", () => { despertar(); efe.menu(); elegirIdioma(b.dataset.idioma); });

// --- menú ----------------------------------------------------------------
let pestanaActual = "jugar";
function pestana(nombre, foco = false) {
  pestanaActual = nombre;
  for (const b of document.querySelectorAll("[data-pestana]")) {
    const si = b.dataset.pestana === nombre;
    b.setAttribute("aria-selected", String(si));
    b.tabIndex = si ? 0 : -1;
    if (si && foco) b.focus();
  }
  for (const p of document.querySelectorAll("[data-panel]")) p.hidden = p.dataset.panel !== nombre;
}
for (const b of document.querySelectorAll("[data-pestana]"))
  b.addEventListener("click", () => { despertar(); efe.menu(); pestana(b.dataset.pestana); });
// Las flechas mueven entre pestañas, como pide el patrón de tabs: con Tab
// habría que atravesar las cinco para llegar al contenido.
$(".pestanas").addEventListener("keydown", (e) => {
  const orden = [...document.querySelectorAll("[data-pestana]")].map((b) => b.dataset.pestana);
  const i = orden.indexOf(pestanaActual);
  if (e.key === "ArrowRight") { pestana(orden[(i + 1) % orden.length], true); e.preventDefault(); }
  if (e.key === "ArrowLeft") { pestana(orden[(i + orden.length - 1) % orden.length], true); e.preventDefault(); }
});

const COLOR_CAP = CAPITULOS.map((c) => c.pared);

function alMenu() {
  partida = null; escena = null;
  cortarFinal();
  callar();
  pintarMenu();
  pestana(pestanaActual);
  mostrar("p-menu");
}

function pintarMenu() {
  const d = cargar();
  // El pozo: los siete tramos, prendidos hasta el más hondo al que se llegó.
  const tope = Math.max(d.mejorCap || 0, d.capitulo || 0);
  const tramos = $("#m-tramos");
  tramos.innerHTML = "";
  CAPITULOS.forEach((c, i) => {
    const el = document.createElement("i");
    if (i <= tope && (tope > 0 || d.stats.partidas > 0)) { el.className = "si"; el.style.setProperty("--c", COLOR_CAP[i]); }
    tramos.append(el);
  });
  $("#m-pozo-prog").textContent = d.stats.partidas || tope
    ? `${t("pozo.progreso", { cap: t("cap." + tope) })} · ${t("pozo.caps", { n: tope + 1, t: CAPITULOS.length })}`
    : t("pozo.nada");
  $("#m-seguir").hidden = d.capitulo === 0;
  $("#m-seguir-txt").textContent = t("pozo.seguir", { cap: t("cap." + Math.min(d.capitulo, CAPITULOS.length - 1)) });

  // Portales: cuántos, la barra y el primero sin resolver.
  const hechos = NIVELES_P.filter((_, i) => d.portales.hechos[i]).length;
  $("#m-portales-sub").textContent = t("portales.cuenta", { n: hechos, t: NIVELES_P.length });
  $("#m-portales-barra").style.width = `${(hechos / NIVELES_P.length) * 100}%`;
  const sig = NIVELES_P.findIndex((_, i) => !d.portales.hechos[i]);
  $("#m-portal-seguir").disabled = sig < 0;
  $("#m-portal-seguir-txt").textContent = sig < 0 ? t("portales.todos") : t("portales.seguir", { n: sig + 1 });

  // Récords.
  const chatP = (d.portales.chatarra || []).reduce((a, b) => a + (b || 0), 0);
  const filas = [
    ["rec.caida", t("rec.m", { n: d.mejorProf })],
    ["rec.chatarra", t("rec.de", { n: d.mejorChatarra, t: nivel.chatarra.length })],
    ["rec.cap", d.stats.partidas || tope ? t("cap." + tope) : t("rec.ninguno")],
    ["rec.partidas", String(d.stats.partidas)],
    ["rec.llegadas", String(d.stats.llegadas)],
    ["rec.desarmes", String(d.stats.desarmes)],
    ["rec.portales", t("rec.de", { n: hechos, t: NIVELES_P.length })],
    ["rec.chatarraP", String(chatP)],
    ["rec.tiros", String(d.stats.tiros)],
  ];
  const ul = $("#m-records");
  ul.innerHTML = "";
  for (const [k, v] of filas) {
    const li = document.createElement("li");
    const a = document.createElement("span"), b = document.createElement("b");
    a.textContent = t(k); b.textContent = v;
    li.append(a, b); ul.append(li);
  }

  // Opciones.
  $("#aj-sonido").checked = d.ajustes.sonido;
  $("#aj-efectos").value = Math.round(d.ajustes.efectos * 100);
  $("#aj-efectos-v").textContent = String(Math.round(d.ajustes.efectos * 100));
  $("#aj-musica").value = Math.round(d.ajustes.musica * 100);
  $("#aj-musica-v").textContent = String(Math.round(d.ajustes.musica * 100));
  $("#aj-voces").checked = d.ajustes.voces;
  $("#m-idioma-cod").textContent = `${idioma().toUpperCase()} · ${IDIOMAS[idioma()]}`;
  desarmarBorrar();

  // Créditos: los CC0 se agradecen igual; los CC-BY, si hubiera, van con
  // autor, licencia y enlace porque la licencia lo exige.
  $("#m-cre-cc0").textContent = t("cre.cc0", { lista: CC0.join(", ") });
  const ccby = creditosSonidos();
  const caja = $("#m-cre-ccby");
  caja.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = ccby.length ? t("cre.ccby") : t("cre.sinccby");
  caja.append(p);
  if (ccby.length) {
    const ul2 = document.createElement("ul"); ul2.className = "creditos-lista";
    for (const c of ccby) {
      const li = document.createElement("li"), a = document.createElement("a");
      a.href = c.fuente; a.target = "_blank"; a.rel = "noopener"; a.textContent = c.fuente;
      li.append(`${c.id}: ${c.autor} (${c.licencia}) — `, a);
      ul2.append(li);
    }
    caja.append(ul2);
  }
}
// Los autores de las grabaciones CC0 (sonidos/dimension-n/manifiesto.json).
// incrustar.py sólo exporta los que la licencia obliga a nombrar.
const CC0 = ["Kenney (kenney.nl)", "rubberduck (OpenGameArt)", "SketchMan3 (OpenGameArt)"];

function jugar(cap) {
  escena = null;
  escalarCuerpos(1);
  nivel = construirNivel();          // el nivel se rearma para limpiar portales y chatarra
  partida = new Partida(nivel);
  if (cap > 0) partida.reiniciarEn(cap);
  capSonando = -1;
  const d = cargar(); d.stats.partidas++; guardar();
  limpiarHud();
  $("#h-portal").hidden = true;
  mostrar("p-juego");
}

// --- el modo portales ----------------------------------------------------
function pintarNiveles() {
  const d = cargar();
  const cont = $("#pn-lista");
  cont.innerHTML = "";
  let hechos = 0;
  NIVELES_P.forEach((n, i) => {
    const hecho = !!d.portales.hechos[i];
    if (hecho) hechos++;
    // Se abre el siguiente al primero sin hacer: los puzzles se ordenan por lo
    // que enseñan, y saltearse el que enseña a disparar al techo deja al
    // jugador peleando con el que lo da por sabido.
    const libre = i === 0 || !!d.portales.hechos[i - 1] || hecho;
    const b = document.createElement("button");
    b.className = "niv" + (hecho ? " hecho" : "");
    b.disabled = !libre;
    b.style.animationDelay = `${i * 0.025}s`;
    const num = document.createElement("b"); num.textContent = String(i + 1);
    const nom = document.createElement("small"); nom.textContent = libre ? t(`niv.${i}.nombre`) : "🔒";
    b.append(num, nom);
    if (d.portales.chatarra[i]) { const ch = document.createElement("small"); ch.textContent = "◆"; b.append(ch); }
    if (!libre) b.setAttribute("aria-label", `${i + 1} — ${t("niv.cerrado")}`);
    b.addEventListener("click", () => { despertar(); efe.menu(); portal(i); });
    cont.append(b);
  });
  $("#pn-cuenta").textContent = `${hechos}/${NIVELES_P.length}`;
}

function portal(n) {
  partida = null;
  escalarCuerpos(ESCALA_P);
  escena = new Escenario(n);
  limpiarHud();
  $("#h-portal").hidden = false;
  mostrar("p-juego");
}

$("#m-jugar").addEventListener("click", () => { despertar(); efe.menu(); jugar(0); });
$("#m-portales").addEventListener("click", () => {
  despertar(); efe.menu(); pintarNiveles(); mostrar("p-niveles");
});
$("#m-portal-seguir").addEventListener("click", () => {
  const sig = NIVELES_P.findIndex((_, i) => !cargar().portales.hechos[i]);
  if (sig >= 0) { despertar(); efe.menu(); portal(sig); }
});
$("#h-reintentar").addEventListener("click", () => { efe.menu(); if (escena) escena.reiniciar(); });
$("#m-seguir").addEventListener("click", () => { despertar(); efe.menu(); jugar(cargar().capitulo); });
$("#m-idioma").addEventListener("click", () => { efe.menu(); pantallaIdioma(); });

// BORRAR PIDE DOS TOQUES en vez de un confirm(): el cuadro del navegador no
// gira con el juego (con el teléfono acostado sale de costado) y en un juego
// de pantalla chica tapa todo. El segundo toque tiene que llegar en 4 s.
let borrarT = 0;
function desarmarBorrar() {
  clearTimeout(borrarT);
  const b = $("#m-borrar");
  b.classList.remove("armado"); b.textContent = t("op.borrar");
}
$("#m-borrar").addEventListener("click", () => {
  const b = $("#m-borrar");
  efe.menu();
  if (!b.classList.contains("armado")) {
    b.classList.add("armado"); b.textContent = t("op.borrar-seguro");
    clearTimeout(borrarT); borrarT = setTimeout(desarmarBorrar, 4000);
    return;
  }
  // Borrar el progreso NO borra los ajustes: volver al volumen de fábrica y
  // al idioma sin elegir porque alguien reseteó sus récords es un castigo
  // que nadie pidió.
  const aj = { ...cargar().ajustes };
  borrar();
  cargar().ajustes = aj; guardar();
  pintarMenu();
  avisar(t("op.borrado"));
});
$("#aj-sonido").addEventListener("change", (e) => {
  const d = cargar(); d.ajustes.sonido = e.target.checked; guardar(); sonando(e.target.checked);
});
for (const [id, clave] of [["#aj-efectos", "efectos"], ["#aj-musica", "musica"]])
  $(id).addEventListener("input", (e) => {
    const v = Number(e.target.value) / 100;
    const d = cargar(); d.ajustes[clave] = v; guardar();
    $(id + "-v").textContent = String(Math.round(v * 100));
    volumenes({ [clave]: v });
  });
$("#aj-efectos").addEventListener("change", () => { despertar(); efe.chatarra(); });
$("#aj-voces").addEventListener("change", (e) => {
  const d = cargar(); d.ajustes.voces = e.target.checked; guardar(); volumenes({ voces: e.target.checked });
});
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); alMenu(); });
$("#f-otra").addEventListener("click", () => { efe.menu(); cortarFinal(); jugar(0); });
$("#f-menu").addEventListener("click", () => { efe.menu(); cortarFinal(); alMenu(); });
$("#j-salir").addEventListener("click", () => {
  efe.menu();
  callar();
  // Del modo portales se vuelve a la lista de niveles, no al menú: en un juego
  // de puzzles se entra y se sale de un nivel veinte veces por sesión.
  if (escena) { escena = null; pintarNiveles(); mostrar("p-niveles"); }
  else alMenu();
});

// --- HUD -----------------------------------------------------------------
// Se escribe SOLO cuando cambia. Esta funcion corre sesenta veces por segundo
// y tocar el DOM en cada cuadro es de las cosas mas caras que se pueden hacer
// en un telefono, para escribir los mismos numeros que ya estaban.
const ultimo = {};
let ultimaVoz = null;
// Al cambiar de partida se olvida lo escrito: si no, el cartel de diálogo del
// pozo quedaba prendido arriba de un nivel de portales (que no lo toca nunca).
function limpiarHud() {
  for (const k of Object.keys(ultimo)) delete ultimo[k];
  $("#dialogo").hidden = true;
  ultimaVoz = null;
}
function pintarHud(p) {
  const poner = (sel, v) => { if (ultimo[sel] === v) return; ultimo[sel] = v; $(sel).textContent = v; };
  poner("#h-metros", t("hud.m", { n: p.metros }));
  poner("#h-chatarra", String(p.juntada));
  poner("#h-cap", t("cap." + p.capitulo.i));
  const i = Math.round(p.integridad);
  if (ultimo.integridad !== i) {
    ultimo.integridad = i;
    $("#h-barra").style.width = `${i}%`;
    $("#h-barra").className = i < 30 ? "mal" : i < 60 ? "medio" : "";
  }
  const hay = !!p.dicho;
  if (ultimo.hayDicho !== hay) { ultimo.hayDicho = hay; $("#dialogo").hidden = !hay; }
  if (hay) {
    // El nombre sale de nivel.js (Rilo y Tito no se traducen); lo que dicen,
    // de la tabla del idioma, con la misma clave que usa la voz.
    const [quien] = p.dicho.lineas[p.dicho.i];
    poner("#d-quien", quien);
    poner("#d-que", t(`dlg.${p.dicho.clave}l${p.dicho.i}`));
    if (ultimo.dQuien !== quien) { ultimo.dQuien = quien;
      $("#dialogo").dataset.quien = quien.toLowerCase(); }
  }
}

function pintarHudPortal(e) {
  const poner = (sel, v) => { if (ultimo[sel] === v) return; ultimo[sel] = v; $(sel).textContent = v; };
  poner("#h-metros", e.tiros === 1 ? t("hud.tiros1") : t("hud.tiros", { n: e.tiros }));
  poner("#h-chatarra", String(e.juntada));
  poner("#h-cap", t("hud.nivel", { n: e.n + 1, nombre: t(`niv.${e.n}.nombre`) }));
  const i = Math.round(e.integridad);
  if (ultimo.integridad !== i) {
    ultimo.integridad = i;
    $("#h-barra").style.width = `${i}%`;
    $("#h-barra").className = i < 30 ? "mal" : i < 60 ? "medio" : "";
  }
  const pista = t(`niv.${e.n}.pista`);
  if (ultimo.pista !== pista) { ultimo.pista = pista; $("#h-pista").textContent = pista; }
  const b = e.proximo === 1 ? "bocha b" : "bocha";
  if (ultimo.bocha !== b) { ultimo.bocha = b; $("#h-bocha").className = b; }
}

function sonarPortal(e) {
  const v = e.ev;
  if (!v) return;
  if (v.golpe > 13) efe.golpe(v.golpe);
  if (v.pincho) efe.pincho();
  if (v.chatarra) efe.chatarra();
  if (v.portal) efe.portal();
  if (v.boton) efe.placa();
  if (v.roto) { efe.roto(); const d = cargar(); d.stats.desarmes++; guardar(); }
  if (v.gano) {
    efe.gano();
    const d = cargar();
    d.portales.hechos[e.n] = true;
    d.portales.chatarra[e.n] = Math.max(d.portales.chatarra[e.n] || 0, e.juntada);
    guardar();
  }
}

function sonar(p) {
  const e = p.ev;
  if (!e) return;
  if (e.golpe > 9) efe.golpe(e.golpe);
  if (e.pincho) efe.pincho();
  if (e.resorte) efe.resorte();
  if (e.chatarra) efe.chatarra();
  if (e.portal) efe.portal();
  if (e.roto) { efe.roto(); const d = cargar(); d.stats.desarmes++; guardar(); }
  if (e.gano) efe.gano();
  if (e.capitulo != null) {
    const d = cargar();
    if (e.capitulo > d.capitulo) d.capitulo = e.capitulo;
    d.mejorCap = Math.max(d.mejorCap || 0, e.capitulo);
    guardar();
  }
  // La voz de la línea que está puesta. Se dispara cuando CAMBIA la línea, no
  // cada cuadro: `dicho.i` avanza solo cada dos segundos y medio.
  const dicho = p.dicho;
  const clave = dicho ? `${dicho.clave}l${dicho.i}` : null;
  if (clave !== ultimaVoz) { ultimaVoz = clave; if (clave) voz(clave); }
  const ci = p.capitulo.i;
  if (ci !== capSonando) {
    capSonando = ci;
    zumbido([55, 49, 62, 41, 58, 46, 65][ci] || 55);
  }
}

// El reactor suena mientras empuja y el viento según lo rápido que cae. Los
// dos salen del mismo punto que usa la física (el pecho de Rilo), así que
// suenan a lo que se ve.
function sonarAire(cuerpo, tope) {
  if (!cuerpo) { aire(0, 0); return; }
  const empuje = Math.abs(entrada.mover);
  const caida = Math.min(1, rapidez(cuerpo.p.pecho) / tope);
  aire(empuje, caida);
}

// Los relojes del diálogo final. Se guardan para poder cancelarlos: si el
// jugador toca "Otra vez" a los dos segundos, las voces que quedaban en cola
// seguían sonando encima del nivel nuevo.
let finTimers = [];
function cortarFinal() { for (const tm of finTimers) clearTimeout(tm); finTimers = []; }

function terminar(p) {
  cortarFinal();
  callar();
  const d = cargar();
  d.mejorProf = Math.max(d.mejorProf, p.metros);
  d.mejorChatarra = Math.max(d.mejorChatarra, p.juntada);
  d.mejorCap = CAPITULOS.length - 1;
  d.stats.llegadas++;
  d.capitulo = 0;                    // terminarlo lo deja listo para empezar de cero
  guardar();
  $("#f-lista").innerHTML = "";
  const item = (k, v) => {
    const li = document.createElement("li");
    const a = document.createElement("span"), b = document.createElement("b");
    a.textContent = k; b.textContent = v;
    li.append(a, b);
    $("#f-lista").append(li);
  };
  item(t("fin.prof"), t("hud.m", { n: p.metros }));
  item(t("fin.chatarra"), t("fin.de", { n: p.juntada, t: nivel.chatarra.length }));
  item(t("fin.integridad"), `${Math.round(p.integridad)}%`);
  // Cada uno con su color, igual que en el juego: en un ida y vuelta de
  // cuatro lineas, saber quien habla sin leer el nombre es la mitad del chiste.
  const charla = $("#f-dialogo");
  charla.innerHTML = "";
  FINAL.forEach(([q], i) => {
    const pp = document.createElement("p"), b = document.createElement("b");
    pp.dataset.quien = q.toLowerCase();
    pp.style.animationDelay = `${0.3 + i * 0.5}s`;
    b.textContent = q;
    pp.append(b, " " + t(`dlg.f${i}`));
    charla.append(pp);
  });
  // El ida y vuelta del final, dicho en voz alta y en orden. Los tiempos salen
  // del propio índice: cada línea espera a que termine la anterior más medio
  // segundo, así que si una voz se regenera más larga, el ritmo se acomoda solo.
  let cuando = 260;
  FINAL.forEach((_, i) => {
    const tr = VOCES[`f${i}`];
    finTimers.push(setTimeout(() => voz(`f${i}`), cuando));
    cuando += (tr ? tr[1] * 1000 : 1600) + 420;
  });
  partida = null;
  mostrar("p-fin");
}

// --- bucle ---------------------------------------------------------------
// Paso fijo con acumulador. Con dt variable la fisica cambia segun los hercios
// del monitor, y un ragdoll con paso variable no es "un poco distinto": es
// otro juego, porque las restricciones se resuelven un numero fijo de veces
// por paso.
const PASO = 1000 / 60;
let previo = performance.now(), sobra = 0, fallas = 0;

function bucle(ahora) {
  requestAnimationFrame(bucle);
  let dt = ahora - previo; previo = ahora;
  if (dt > 250) dt = 250;            // volver de otra pestana no adelanta diez segundos
  sobra += dt;
  let n = 0;
  while (sobra >= PASO && n < 5) {
    sobra -= PASO; n++;
    if (!partida && !escena) continue;
    try {
      leerEntrada();
      if (escena) {
        escena.paso(entrada);
        sonarPortal(escena);
        if (escena.estado === "gano" && escena.cuenta > 70) {
          const sig = escena.n + 1;
          escena = null;
          if (sig < NIVELES_P.length) portal(sig);
          else { pintarNiveles(); mostrar("p-niveles"); }
          break;
        }
        continue;
      }
      partida.paso(entrada);
      sonar(partida);
      if (partida.estado === "gano" && partida.cuenta++ > 60) { terminar(partida); break; }
    } catch (e) {
      // Sin esto, un error adentro del bucle se repite sesenta veces por
      // segundo: la pantalla queda quieta y no se puede ni salir.
      if (fallas++ === 0) console.error("Dimensión Ñ se rompió:", e);
      partida = null; escena = null; alMenu();
      avisar(t("err.bucle"));
    }
  }
  if (escena) {
    dibujarEscenario(ctx, escena);
    pintarHudPortal(escena);
    sonarAire(escena.rilo, TOPE_CAIDA * 1.4);
  } else if (partida) {
    dibujar(ctx, partida);
    pintarHud(partida);
    sonarAire(partida.rilo, TOPE_CAIDA);
  }
}

// --- arranque ------------------------------------------------------------
{
  const d = cargar();
  sonando(d.ajustes.sonido);
  volumenes({ efectos: d.ajustes.efectos, musica: d.ajustes.musica, voces: d.ajustes.voces });
  ponerIdioma(d.ajustes.idioma || "es");
  aplicar();
  cargarImagenes();
  // Sin índice no se pide el mp3: no habría forma de saber qué parte suena.
  if (Object.keys(VOCES).length) cargarVoces(ruta("assets/voces.mp3"), VOCES);
  $("#cargando").remove();
  pintarMenu();
  pantallaIdioma();
  requestAnimationFrame(bucle);
  // Para poder auditar el juego desde afuera: las pruebas corren la fisica de
  // verdad, no una copia.
  pintarNiveles();
  window.DN = {
    get partida() { return partida; }, get nivel() { return nivel; },
    get escena() { return escena; }, get esc() { return esc; },
    get ultimoTiro() { return ultimoTiro; },
    jugar, portal, alMenu, entrada, VISTA, CAPITULOS, construirNivel, NIVELES_P,
    GIRO, idioma, pestana, decodificadas, despertar,
  };
}
