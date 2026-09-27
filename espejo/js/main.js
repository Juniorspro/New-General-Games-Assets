// Arranque, entrada y pantallas.
//
// NO HAY BUCLE DE JUEGO, hay un bucle de DIBUJO. Un puzzle no simula nada: el
// estado cambia sólo cuando alguien toca un espejo. Lo único que se anima es el
// latido de los objetivos prendidos y el destello del último toque, así que el
// dibujo corre pero el juego no "avanza" — y por eso dejar el teléfono abierto
// una hora no cambia nada.

import { GIRO, aplicarGiro, ALTO_MINIMO } from "./giro.js";
import { Partida } from "./juego.js";
import { dibujar, celdaDe, marcarToque, chispear, barrido, registrarArte, rutaArte, COLOR, VISTA } from "./dibujo.js";
import { NIVELES } from "./niveles.js";
import { despertar, efe, volumenEfectos, contexto, salida, decodificadas, creditosSonidos } from "./audio.js";
import * as musica from "./musica.js";
import { cargar, guardar, borrar, lucesDe, anotar, abiertos, totalLuces, resueltos, perfectos } from "./guardado.js";
import { t, aplicar, ponerIdioma, idioma, IDIOMAS } from "./idioma.js";

const $ = (s) => document.querySelector(s);

// Despertar el audio ES el momento de conectar la música: antes no hay contexto
// —el navegador no deja crearlo sin un gesto— y después habría que acordarse.
function despertarTodo() {
  despertar();
  musica.conectar(contexto(), salida());
}
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d");
let partida = null;
let destello = null;
let gano = 0;                    // cuándo se ganó, para el barrido de luz

// --- tamaño --------------------------------------------------------------
// El tablero se dibuja siempre en 360 de ancho y se escala entero: así una
// celda mide lo mismo en proporción en todos los aparatos y el dedo cae donde
// tiene que caer sin cuentas distintas por pantalla.
//
// Las medidas son las LOGICAS (GIRO.ancho/alto): con el teléfono acostado el
// juego va girado y su ancho es el alto de la ventana.
let esc = 1;
function redimensionar() {
  aplicarGiro();
  const w = GIRO.ancho(), h = GIRO.alto();
  esc = Math.min(w / VISTA.ancho, h / ALTO_MINIMO, 3);
  VISTA.alto = Math.round(Math.min(h / esc, 1000));
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
// Hay teléfonos que avisan el giro antes de tener las medidas nuevas: se
// recalcula al toque y otra vez a los 250 ms.
addEventListener("orientationchange", () => { redimensionar(); setTimeout(redimensionar, 250); });
redimensionar();
setTimeout(redimensionar, 250);

// --- entrada -------------------------------------------------------------
// UN TOQUE, NADA MAS. Se usa `pointerup` y no `pointerdown` a propósito: con
// `down`, apoyar el dedo para desplazar la pantalla ya da vuelta un espejo, y
// en un juego donde cada toque cuenta para el puntaje eso es robarle un toque
// a alguien que ni siquiera quería jugar todavía.
lienzo.addEventListener("pointerup", (ev) => {
  // `offsetX/offsetY` y no `clientX - getBoundingClientRect()`: el offset ya
  // viene en coordenadas del lienzo aunque el juego esté girado; el rectángulo
  // de la ventana no (sale con el ancho y el alto cambiados).
  const px = ev.offsetX / esc, py = ev.offsetY / esc;
  ultimoToque = { x: px, y: py };
  if (!partida || partida.ganado) return;
  despertarTodo();
  const cel = celdaDe(partida.nivel, px, py);
  if (!cel) return;
  const antes = new Set(partida.prendidos);
  if (!partida.tocar(cel.c, cel.f)) return;
  destello = { ...cel, t: performance.now() };
  { const d = cargar(); d.stats.toques++; guardar(); }
  efe.espejo(partida.estado[partida.celda(cel.c, cel.f).i]);
  // LAS CHISPAS SALEN DEL OBJETIVO QUE CAMBIO, no del espejo que tocaste. El
  // espejo dice QUE hiciste algo —para eso está el destello— y el objetivo dice
  // SI SIRVIO, que es la única pregunta que importa. Y salen del que se apagó
  // también: perder un objetivo que ya tenías es información igual de valiosa.
  for (const clave of partida.prendidos)
    if (!antes.has(clave)) {
      const [c, f] = clave.split(",").map(Number);
      chispear(c, f, (COLOR[partida.celda(c, f).color] || COLOR.cian).vivo, 14);
    }
  for (const clave of antes)
    if (!partida.prendidos.has(clave)) {
      const [c, f] = clave.split(",").map(Number);
      chispear(c, f, "#5a6478", 7);
    }
  if (partida.ganado) efe.ultimo();
  else if (partida.prendidos.size > antes.size) efe.prende();
  else if (partida.prendidos.size < antes.size) efe.apaga();
  pintarHud();
  if (partida.ganado) gano = performance.now();
  // LA MUSICA DICE CUANTO FALTA: la densidad de las campanas sube con los
  // objetivos ya prendidos. Es la única señal de "vas bien" que no ocupa
  // pantalla, y en un tablero chico la pantalla es lo que más escasea.
  musica.empujar(partida.prendidos.size / Math.max(1, partida.nivel.objetivos.length));
  if (partida.ganado) setTimeout(ganar, 420);
});
lienzo.addEventListener("pointerdown", (ev) => ev.preventDefault());
let ultimoToque = null;

// --- pantallas -----------------------------------------------------------
function mostrar(id) {
  for (const p of document.querySelectorAll(".pantalla")) p.hidden = true;
  $("#" + id).hidden = false;
  lienzo.style.visibility = id === "p-juego" ? "visible" : "hidden";
}

let avisoT = 0;
function avisar(txt) {
  const a = $("#aviso");
  a.textContent = txt; a.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 4000);
}

// --- idioma --------------------------------------------------------------
// La pantalla sale en CADA arranque, con la elección anterior marcada y con el
// foco puesto: al que ya eligió le alcanza con un Enter o un toque.
function pantallaIdioma() {
  const actual = cargar().ajustes.idioma;
  let foco = null;
  for (const b of document.querySelectorAll(".idioma-btn")) {
    const si = b.dataset.idioma === actual;
    b.classList.toggle("activo", si);
    b.setAttribute("aria-pressed", String(si));
    if (si) foco = b;
  }
  musica.pararTema();
  mostrar("p-idioma");
  (foco || document.querySelector(".idioma-btn")).focus({ preventScroll: true });
}

// Cambiar de idioma reescribe los `data-t` y ADEMAS vuelve a pintar lo que se
// escribe desde JavaScript: el botón de seguir, el contador de luces y la
// grilla no tienen marca en el HTML y quedarían en el idioma anterior.
function elegir(cod, guardarlo = true) {
  ponerIdioma(cod);
  aplicar();
  if (guardarlo) { const d = cargar(); d.ajustes.idioma = cod; guardar(); }
}
for (const b of document.querySelectorAll("[data-idioma]"))
  b.addEventListener("click", () => { despertarTodo(); efe.menu(); elegir(b.dataset.idioma); alMenu(); });
$("#m-idioma").addEventListener("click", () => { efe.menu(); pantallaIdioma(); });

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
  b.addEventListener("click", () => { despertarTodo(); efe.menu(); pestana(b.dataset.pestana); });
// Las flechas mueven entre pestañas, como pide el patrón de tabs.
$(".pestanas").addEventListener("keydown", (e) => {
  const orden = [...document.querySelectorAll("[data-pestana]")].map((b) => b.dataset.pestana);
  const i = orden.indexOf(pestanaActual);
  if (e.key === "ArrowRight") { pestana(orden[(i + 1) % orden.length], true); e.preventDefault(); }
  if (e.key === "ArrowLeft") { pestana(orden[(i + orden.length - 1) % orden.length], true); e.preventDefault(); }
});

function alMenu(nombre) {
  partida = null;
  musica.parar();
  musica.arrancarTema();
  pintarMenu();
  pestana(nombre || pestanaActual);
  mostrar("p-menu");
}

/** La grilla de niveles —con las luces de cada uno— vive en la pestaña Jugar. */
function alMapa() { alMenu("jugar"); }

function pintarMenu() {
  const abre = abiertos(NIVELES.length);
  const total = NIVELES.length;
  $("#m-seguir").textContent = t("menu.seguir", { n: Math.min(abre, total) });
  $("#m-luces").textContent = t("menu.luces", { n: totalLuces(), t: total * 3 });
  $("#m-barra").style.width = `${(totalLuces() / (total * 3)) * 100}%`;
  $("#m-progreso").textContent = t("menu.progreso", { n: resueltos(), t: total, p: perfectos() });
  pintarMapa(abre);

  const d = cargar();
  const filas = [
    ["rec.luces", t("rec.de", { n: totalLuces(), t: total * 3 })],
    ["rec.resueltos", t("rec.de", { n: resueltos(), t: total })],
    ["rec.perfectos", String(perfectos())],
    ["rec.ganados", String(d.stats.ganados)],
    ["rec.empezados", String(d.stats.empezados)],
    ["rec.toques", String(d.stats.toques)],
    ["rec.pistas", String(d.stats.pistas)],
  ];
  const ul = $("#m-records");
  ul.innerHTML = "";
  for (const [k, v] of filas) {
    const li = document.createElement("li"), a = document.createElement("span"), b = document.createElement("b");
    a.textContent = t(k); b.textContent = v;
    li.append(a, b); ul.append(li);
  }

  $("#aj-efectos").value = Math.round(d.ajustes.efectos * 100);
  $("#aj-efectos-v").textContent = String(Math.round(d.ajustes.efectos * 100));
  $("#aj-musica").value = Math.round(d.ajustes.volMusica * 100);
  $("#aj-musica-v").textContent = String(Math.round(d.ajustes.volMusica * 100));
  $("#m-idioma-cod").textContent = `${idioma().toUpperCase()} · ${IDIOMAS[idioma()]}`;
  desarmarBorrar();

  // Créditos: los CC0 se agradecen igual; los CC-BY, si hubiera, van con
  // autor, licencia y enlace porque la licencia lo exige.
  $("#m-cre-cc0").textContent = t("cre.cc0", { lista: CC0.join(", ") });
  const ccby = creditosSonidos(), caja = $("#m-cre-ccby");
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
// Los autores de las grabaciones CC0 (sonidos/espejo/manifiesto.json):
// incrustar.py sólo exporta los que la licencia obliga a nombrar.
const CC0 = ["Kenney (kenney.nl)", "rubberduck (OpenGameArt)"];

/** Los cuarenta botones, con las luces de cada uno y los cerrados apagados. */
function pintarMapa(abre) {
  const cont = $("#mapa");
  cont.innerHTML = "";
  for (let i = 0; i < NIVELES.length; i++) {
    const b = document.createElement("button");
    const l = lucesDe(i);
    const cerrado = i + 1 > abre;
    b.className = "celda-niv" + (cerrado ? " cerrado" : "") + (l ? " hecho" : "") + (i + 1 === abre && !l ? " siguiente" : "");
    b.disabled = cerrado;
    b.style.animationDelay = `${Math.min(i, 30) * 0.015}s`;
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
}

function jugar(i) {
  despertarTodo();
  efe.nivel();
  musica.pararTema();
  musica.arrancar();
  partida = new Partida(NIVELES[i], i);
  destello = null;
  gano = 0;
  { const d = cargar(); d.stats.empezados++; guardar(); }
  pintarHud();
  mostrar("p-juego");
}

function ganar() {
  efe.gana();
  const p = partida;
  anotar(p.numero, p.luces);
  { const d = cargar(); d.stats.ganados++; guardar(); }
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
$("#j-salir").addEventListener("click", () => { efe.menu(); alMapa(); });
$("#j-reiniciar").addEventListener("click", () => {
  if (!partida) return;
  efe.menu(); partida.reiniciar(); destello = null; gano = 0; pintarHud();
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
  { const d = cargar(); d.stats.pistas++; guardar(); }
  pintarHud();
});
$("#f-siguiente").addEventListener("click", () => { efe.menu(); jugar(partida.numero + 1); });
$("#f-repetir").addEventListener("click", () => { efe.menu(); jugar(partida.numero); });
$("#f-niveles").addEventListener("click", () => { efe.menu(); alMapa(); });
$("#aj-efectos").addEventListener("input", (e) => {
  const v = Number(e.target.value) / 100;
  const d = cargar(); d.ajustes.efectos = v; guardar();
  $("#aj-efectos-v").textContent = String(Math.round(v * 100));
  volumenEfectos(v);
});
$("#aj-efectos").addEventListener("change", () => { despertarTodo(); efe.prende(); });
// LA MUSICA VA APARTE DE LOS EFECTOS: son dos molestias distintas, y en un
// juego de pensar la primera que estorba es la música.
$("#aj-musica").addEventListener("input", (e) => {
  const v = Number(e.target.value) / 100;
  const d = cargar(); d.ajustes.volMusica = v; guardar();
  $("#aj-musica-v").textContent = String(Math.round(v * 100));
  musica.volumen(v);
  if (v > 0 && !partida) musica.arrancarTema();
});

// BORRAR PIDE DOS TOQUES en vez de un confirm(): el cuadro del navegador no
// gira con el juego (con el teléfono acostado sale de costado) y tapa todo. El
// segundo toque tiene que llegar en 4 s.
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
  // Borrar el progreso NO borra los ajustes: volver al inglés o al volumen de
  // fábrica porque alguien reseteó sus niveles es un castigo que nadie pidió.
  const aj = { ...cargar().ajustes };
  borrar();
  cargar().ajustes = aj; guardar();
  pintarMenu();
  avisar(t("op.borrado"));
});

// --- HUD -----------------------------------------------------------------
function pintarHud() {
  if (!partida) return;
  $("#h-nivel").textContent = t("hud.nivel", { n: partida.numero + 1 });
  // "1 toques" es el detalle que hace que un juego se sienta hecho a las
  // apuradas, y aparece justo en el primer toque de cada nivel.
  $("#h-toques").textContent =
    `${partida.toques} ${t(partida.toques === 1 ? "hud.toques1" : "hud.toques")}`;
  $("#h-par").textContent = t("hud.par", { n: partida.par });
  $("#h-toques").classList.toggle("pasado", partida.toques > partida.par);
}

// --- dibujo --------------------------------------------------------------
function bucle(ahora) {
  requestAnimationFrame(bucle);
  if (!partida || $("#p-juego").hidden) return;
  try {
    dibujar(ctx, partida, ahora, destello);
    if (destello) {
      const edad = (ahora - destello.t) / (destello.pista ? 900 : 380);
      if (edad >= 1) destello = null;
      else marcarToque(ctx, partida.nivel, destello.c, destello.f, edad);
    }
    // El barrido de la victoria cruza el tablero una vez, en el segundo que pasa
    // entre ganar y que aparezca la pantalla del final: sin él, ganar es que la
    // pantalla cambie de golpe y no se llega a ver el tablero resuelto.
    if (gano) {
      const edad = (ahora - gano) / 900;
      if (edad >= 1) gano = 0;
      else barrido(ctx, partida.nivel, edad);
    }
  } catch (e) {
    // Un error adentro del dibujo se repite sesenta veces por segundo y deja la
    // pantalla quieta, sin forma de salir.
    console.error("Espejo se rompió:", e);
    partida = null; alMenu();
    avisar(t("err.bucle"));
  }
}

// --- arranque ------------------------------------------------------------
const d = cargar();
volumenEfectos(d.ajustes.efectos);
musica.volumen(d.ajustes.volMusica);
elegir(d.ajustes.idioma || "en", false);
$("#cargando").remove();
pintarMenu();
pestana("jugar");
pantallaIdioma();
requestAnimationFrame(bucle);

// LA MESA SE CARGA DESPUES Y NO BLOQUEA NADA: hasta que llega, el tablero se
// dibuja sobre el color liso de siempre. Una conexión lenta no puede dejar a
// nadie mirando una pantalla de carga por una textura decorativa.
(async () => {
  const im = new Image();
  im.onload = () => registrarArte("fondo_mesa", im);
  im.src = rutaArte("fondo_mesa");
})();

// Para las pruebas: poder mirar y manejar la partida desde afuera.
globalThis.ESPEJO = {
  get partida() { return partida; },
  NIVELES, Partida, jugar, alMenu, alMapa, GIRO, pestana, decodificadas, idioma,
  get esc() { return esc; }, get ultimoToque() { return ultimoToque; },
};
// La conversión de píxel a celda, expuesta aparte para que la prueba del
// teléfono pueda recorrer las cuarenta celdas del tablero preguntando "¿este
// punto es esta celda?". Es la cuenta donde se esconden los errores de escala y
// de centrado, y comprobarla a ojo es imposible: un error de medio píxel no se
// ve en el medio del tablero y sí en los bordes.
globalThis.__celdaDe = celdaDe;

// Un gancho para la prueba de sonido: dispara UN efecto. Los efectos no dejan
// rastro en el DOM ni en el estado, así que la única forma de comprobar que
// siguen sonando con la música apagada es pedir uno y contar los osciladores.
globalThis.__efe = () => efe.menu();
globalThis.__musicaAndando = () => musica.andando();
