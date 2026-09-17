// Arranque, entrada y pantallas.
//
// NO HAY BUCLE DE JUEGO, hay un bucle de DIBUJO. Un puzzle no simula nada: el
// estado cambia sólo cuando alguien toca un espejo. Lo único que se anima es el
// latido de los objetivos prendidos y el destello del último toque, así que el
// dibujo corre pero el juego no "avanza" — y por eso dejar el teléfono abierto
// una hora no cambia nada.

import { Partida } from "./juego.js";
import { dibujar, celdaDe, marcarToque, VISTA } from "./dibujo.js";
import { NIVELES } from "./niveles.js";
import { despertar, efe, sonando } from "./audio.js";
import { cargar, guardar, borrar, lucesDe, anotar, abiertos, totalLuces } from "./guardado.js";
import { t, aplicar, ponerIdioma, idioma, IDIOMAS } from "./idioma.js";

const $ = (s) => document.querySelector(s);
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d");
let partida = null;
let destello = null;

// --- tamaño --------------------------------------------------------------
// El tablero se dibuja siempre en 360 de ancho y se escala entero: así una
// celda mide lo mismo en proporción en todos los aparatos y el dedo cae donde
// tiene que caer sin cuentas distintas por pantalla.
let esc = 1;
function redimensionar() {
  esc = Math.min(innerWidth / VISTA.ancho, innerHeight / 560, 3);
  VISTA.alto = Math.round(Math.min(innerHeight / esc, 1000));
  const anCSS = VISTA.ancho * esc, alCSS = VISTA.alto * esc;
  const dpr = Math.min(devicePixelRatio || 1, 2.5);
  lienzo.width = Math.round(anCSS * dpr);
  lienzo.height = Math.round(alCSS * dpr);
  lienzo.style.width = `${anCSS}px`;
  lienzo.style.height = `${alCSS}px`;
  ctx.setTransform(esc * dpr, 0, 0, esc * dpr, 0, 0);
  document.documentElement.style.setProperty("--an", `${anCSS}px`);
  document.documentElement.style.setProperty("--al", `${alCSS}px`);
}
addEventListener("resize", redimensionar);
addEventListener("orientationchange", () => setTimeout(redimensionar, 180));
redimensionar();

// --- entrada -------------------------------------------------------------
// UN TOQUE, NADA MAS. Se usa `pointerup` y no `pointerdown` a propósito: con
// `down`, apoyar el dedo para desplazar la pantalla ya da vuelta un espejo, y
// en un juego donde cada toque cuenta para el puntaje eso es robarle un toque
// a alguien que ni siquiera quería jugar todavía.
lienzo.addEventListener("pointerup", (ev) => {
  if (!partida || partida.ganado) return;
  despertar();
  const r = lienzo.getBoundingClientRect();
  const px = (ev.clientX - r.left) / esc, py = (ev.clientY - r.top) / esc;
  const cel = celdaDe(partida.nivel, px, py);
  if (!cel) return;
  const antes = partida.prendidos.size;
  if (!partida.tocar(cel.c, cel.f)) return;
  destello = { ...cel, t: performance.now() };
  efe.espejo();
  if (partida.prendidos.size > antes) efe.prende();
  else if (partida.prendidos.size < antes) efe.apaga();
  pintarHud();
  if (partida.ganado) setTimeout(ganar, 420);
});
lienzo.addEventListener("pointerdown", (ev) => ev.preventDefault());

// --- pantallas -----------------------------------------------------------
function mostrar(id) {
  for (const p of document.querySelectorAll(".pantalla")) p.hidden = true;
  $("#" + id).hidden = false;
  lienzo.style.visibility = id === "p-juego" ? "visible" : "hidden";
}

function alMenu() {
  partida = null;
  const abre = abiertos(NIVELES.length);
  $("#m-seguir").textContent = t("menu.seguir", { n: Math.min(abre, NIVELES.length) });
  $("#m-luces").textContent = t("menu.luces", { n: totalLuces(), t: NIVELES.length * 3 });
  mostrar("p-menu");
}

/** La grilla de niveles, con las luces de cada uno y los cerrados apagados. */
function alMapa() {
  const abre = abiertos(NIVELES.length);
  const cont = $("#mapa");
  cont.innerHTML = "";
  for (let i = 0; i < NIVELES.length; i++) {
    const b = document.createElement("button");
    const l = lucesDe(i);
    const cerrado = i + 1 > abre;
    b.className = "celda-niv" + (cerrado ? " cerrado" : "") + (l ? " hecho" : "");
    b.disabled = cerrado;
    // Las luces van como texto y no como imágenes: cuarenta botones con tres
    // iconos cada uno son ciento veinte nodos que se vuelven a armar cada vez
    // que se abre el mapa.
    b.innerHTML = `<b></b><span class="luces"></span>`;
    b.firstChild.textContent = String(i + 1);
    b.lastChild.textContent = cerrado ? "🔒" : "●".repeat(l) + "○".repeat(3 - l);
    if (cerrado) b.setAttribute("aria-label", `${i + 1} — ${t("niv.cerrado")}`);
    else b.addEventListener("click", () => { efe.menu(); jugar(i); });
    cont.append(b);
  }
  mostrar("p-mapa");
}

function jugar(i) {
  despertar();
  partida = new Partida(NIVELES[i], i);
  destello = null;
  pintarHud();
  mostrar("p-juego");
}

function ganar() {
  efe.gana();
  const p = partida;
  anotar(p.numero, p.luces);
  $("#f-toques").textContent = String(p.toques);
  $("#f-par").textContent = String(p.par);
  $("#f-perfecto").hidden = p.toques > p.par;
  $("#f-luces").textContent = "●".repeat(p.luces) + "○".repeat(3 - p.luces);
  const ultimo = p.numero + 1 >= NIVELES.length;
  $("#f-siguiente").hidden = ultimo;
  $("#f-ultimo").hidden = !ultimo;
  mostrar("p-fin");
}

$("#m-seguir").addEventListener("click", () => {
  efe.menu(); jugar(Math.min(abiertos(NIVELES.length), NIVELES.length) - 1);
});
$("#m-niveles").addEventListener("click", () => { efe.menu(); alMapa(); });
$("#m-como").addEventListener("click", () => { efe.menu(); mostrar("p-como"); });
$("#j-salir").addEventListener("click", () => { efe.menu(); alMapa(); });
$("#j-reiniciar").addEventListener("click", () => {
  if (!partida) return;
  efe.menu(); partida.reiniciar(); destello = null; pintarHud();
});
// LA PISTA CUESTA UN TOQUE, y por eso es una decisión y no un botón de ganar.
// Gratis, la forma óptima de jugar sería apretarla hasta el final; cobrándola,
// usarla te baja de tres luces a dos y el que quiere el par la deja quieta.
$("#j-pista").addEventListener("click", () => {
  if (!partida || partida.ganado) return;
  const e = partida.pista();
  if (!e) return;
  efe.pista();
  destello = { c: e.c, f: e.f, t: performance.now(), pista: true };
  partida.toques++;
  pintarHud();
});
$("#f-siguiente").addEventListener("click", () => { efe.menu(); jugar(partida.numero + 1); });
$("#f-repetir").addEventListener("click", () => { efe.menu(); jugar(partida.numero); });
$("#f-niveles").addEventListener("click", () => { efe.menu(); alMapa(); });
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); alMenu(); });
for (const b of document.querySelectorAll("[data-mapa]"))
  b.addEventListener("click", () => { efe.menu(); alMapa(); });
$("#aj-sonido").addEventListener("change", (e) => {
  const d = cargar(); d.ajustes.sonido = e.target.checked; guardar(); sonando(e.target.checked);
});
$("#m-borrar").addEventListener("click", () => {
  if (!confirm(t("menu.borrar-confirmar"))) return;
  // Borrar el progreso NO borra el idioma: está en el mismo bulto guardado,
  // pero volver al inglés porque alguien reseteó sus niveles es un castigo que
  // nadie pidió.
  const cod = cargar().ajustes.idioma;
  borrar();
  const nuevo = cargar(); nuevo.ajustes.idioma = cod; guardar();
  alMenu();
});

// --- idiomas -------------------------------------------------------------
// Cambiar de idioma reescribe los `data-t` y ADEMAS vuelve a pintar lo que se
// escribe desde JavaScript: el botón de seguir, el contador de luces y el mapa
// no tienen marca en el HTML y quedarían en el idioma anterior.
function elegir(cod, guardarlo = true) {
  ponerIdioma(cod);
  aplicar();
  $("#m-idioma").textContent = cod.toUpperCase();
  if (guardarlo) { const d = cargar(); d.ajustes.idioma = cod; guardar(); }
}
for (const b of document.querySelectorAll("[data-idioma]"))
  b.addEventListener("click", () => { efe.menu(); elegir(b.dataset.idioma); alMenu(); });
$("#m-idioma").addEventListener("click", () => {
  const cods = Object.keys(IDIOMAS);
  efe.menu();
  elegir(cods[(cods.indexOf(idioma()) + 1) % cods.length]);
  alMenu();
});

// --- HUD -----------------------------------------------------------------
function pintarHud() {
  if (!partida) return;
  $("#h-nivel").textContent = t("hud.nivel", { n: partida.numero + 1 });
  $("#h-toques").textContent = `${partida.toques} ${t("hud.toques")}`;
  $("#h-par").textContent = t("hud.par", { n: partida.par });
  $("#h-toques").classList.toggle("pasado", partida.toques > partida.par);
}

// --- dibujo --------------------------------------------------------------
function bucle(ahora) {
  requestAnimationFrame(bucle);
  if (!partida || $("#p-juego").hidden) return;
  try {
    dibujar(ctx, partida, ahora);
    if (destello) {
      const edad = (ahora - destello.t) / (destello.pista ? 900 : 380);
      if (edad >= 1) destello = null;
      else marcarToque(ctx, partida.nivel, destello.c, destello.f, edad);
    }
  } catch (e) {
    // Un error adentro del dibujo se repite sesenta veces por segundo y deja la
    // pantalla quieta, sin forma de salir.
    console.error("Espejo se rompió:", e);
    partida = null; alMenu();
  }
}

// --- arranque ------------------------------------------------------------
const d = cargar();
$("#aj-sonido").checked = d.ajustes.sonido;
sonando(d.ajustes.sonido);
elegir(d.ajustes.idioma || "en", false);
if (d.ajustes.idioma) alMenu();
else mostrar("p-idioma");
requestAnimationFrame(bucle);

// Para las pruebas: poder mirar y manejar la partida desde afuera.
globalThis.ESPEJO = {
  get partida() { return partida; },
  NIVELES, Partida, jugar, alMenu, alMapa,
};
// La conversión de píxel a celda, expuesta aparte para que la prueba del
// teléfono pueda recorrer las cuarenta celdas del tablero preguntando "¿este
// punto es esta celda?". Es la cuenta donde se esconden los errores de escala y
// de centrado, y comprobarla a ojo es imposible: un error de medio píxel no se
// ve en el medio del tablero y sí en los bordes.
globalThis.__celdaDe = celdaDe;
