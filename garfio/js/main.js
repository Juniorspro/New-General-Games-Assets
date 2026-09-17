// Arranque, entrada y bucle.

import { VISTA, F, ANCHO, ajustarVista } from "./mundo.js";
import { Partida } from "./juego.js";
import { dibujar, pisoDe, registrarArte, rutaArte } from "./dibujo.js";
import { despertar, efe, sonando, arrancarViento, soplar, callarViento } from "./audio.js";
import { cargar, guardar, borrar } from "./guardado.js";
import { piloto } from "./piloto.js";
import { t, aplicar, ponerIdioma, idioma, IDIOMAS } from "./idioma.js";

const $ = (s) => document.querySelector(s);
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d", { alpha: false });
let partida = null;

// EL FONDO DE LOS MENUS ES UNA TREPADA DE VERDAD, borroneada.
//
// No es un video ni una imagen: es el juego corriendo con el piloto automático
// —el mismo que usa el validador de la torre— y el lienzo desenfocado por CSS.
// Cuesta lo que cuesta un cuadro, no hay nada que cargar, y sobre todo nunca se
// desactualiza: si mañana cambia el color de un piso o la forma de una argolla,
// el menú cambia solo.
let demo = null;
function arrancarDemo() {
  demo = new Partida();
  // ARRANCA ALTO, no en el sótano. Las primeras argollas van fáciles a propósito
  // y un menú cuyo fondo es un rectángulo vacío durante dos segundos no se lee
  // como "hay un juego atrás", se lee como que algo falló.
  const salto = 1400 + Math.random() * 9000;
  for (let i = 0; i < 4000 && demo.alto < salto; i++) demo.paso(piloto(demo));
  if (demo.estado === "muerto") demo = new Partida();
}

// --- tamaño --------------------------------------------------------------
let esc = 1;
function redimensionar() {
  esc = ajustarVista(innerWidth, innerHeight);
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
//
// UN DEDO HACE TODO, y hace dos cosas seguidas: al apoyarlo se clava el gancho
// en la argolla que tengas más cerca del dedo, y mientras siga apoyado su
// posición empuja — te hamaca. Al soltarlo salís por la tangente.
//
// `touch-action: none` es obligatorio: sin eso el navegador se queda el
// arrastre para hacer scroll y el dedo —que acá es el juego entero— llega una
// vez de cada tres.
const entrada = { dedo: null };
let dedo = null;

// EL DEDO SE GUARDA EN COORDENADAS DE PANTALLA Y SE CONVIERTE EN CADA CUADRO,
// no al revés. La cámara sube sola; un dedo guardado en coordenadas del mundo
// se queda clavado donde estaba la pantalla hace dos segundos, y con el dedo
// apoyado esperando para engancharse eso significa apuntarle a una argolla que
// ya pasó.
const aMundo = (cx, cy) => {
  const r = lienzo.getBoundingClientRect();
  return { x: (cx - r.left) / esc - (VISTA.ancho - ANCHO) / 2,
           y: (cy - r.top) / esc + (partida ? partida.cam : 0) };
};

lienzo.addEventListener("pointerdown", (ev) => {
  despertar(); arrancarViento();
  dedo = { id: ev.pointerId, cx: ev.clientX, cy: ev.clientY };
  // setPointerCapture puede tirar excepción si el puntero ya se soltó, y sin
  // atraparla el dedo queda apoyado para siempre: no se suelta nunca más.
  try { lienzo.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
lienzo.addEventListener("pointermove", (ev) => {
  if (!dedo || ev.pointerId !== dedo.id) return;
  dedo.cx = ev.clientX; dedo.cy = ev.clientY;
});
const soltar = (ev) => { if (dedo && ev.pointerId === dedo.id) dedo = null; };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

// El teclado, para probar en la computadora: espacio engancha a la de arriba y
// las flechas hamacan. No es el control del juego, es una comodidad.
const teclas = {};
addEventListener("keydown", (e) => {
  teclas[e.code] = true;
  if (["Space", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "Enter" && !$("#p-fin").hidden) jugar();
});
addEventListener("keyup", (e) => { teclas[e.code] = false; });

function leerEntrada() {
  if (!partida) return;
  if (teclas.Space) {
    const a = partida.ancla || partida.torre.masCerca(partida.x, partida.y, F.ALCANCE);
    if (a) {
      const lado = (teclas.ArrowLeft ? -1 : 0) + (teclas.ArrowRight ? 1 : 0);
      entrada.dedo = lado ? { x: partida.x + lado * 90, y: partida.y } : { x: a.x, y: a.y };
      return;
    }
  }
  entrada.dedo = dedo ? aMundo(dedo.cx, dedo.cy) : null;
}

// --- pantallas -----------------------------------------------------------
function mostrar(id) {
  for (const p of document.querySelectorAll(".pantalla")) p.hidden = true;
  $("#" + id).hidden = false;
  // El desenfoque lo enciende una clase en el body y lo aplica el compositor:
  // poner el filtro por cuadro desde JavaScript sería pagarlo tres veces.
  document.body.classList.toggle("borroso", id !== "p-juego");
}

function alMenu() {
  partida = null;
  callarViento();
  if (!demo) arrancarDemo();
  const d = cargar();
  $("#m-mejor").textContent = `${d.mejor} m`;
  $("#m-partidas").textContent = d.partidas === 1 ? t("menu.partidas1")
                                                  : t("menu.partidas", { n: d.partidas });
  mostrar("p-menu");
}

function jugar() {
  despertar(); arrancarViento();
  demo = null;
  partida = new Partida();
  ultimoHito = 0;
  for (const k in hud) delete hud[k];
  mostrar("p-juego");
}

$("#m-jugar").addEventListener("click", () => { efe.menu(); jugar(); });
$("#f-otra").addEventListener("click", () => { efe.menu(); jugar(); });
$("#f-menu").addEventListener("click", () => { efe.menu(); alMenu(); });
$("#m-como").addEventListener("click", () => { efe.menu(); mostrar("p-como"); });
$("#j-salir").addEventListener("click", () => { efe.menu(); alMenu(); });
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); alMenu(); });
$("#aj-sonido").addEventListener("change", (e) => {
  const d = cargar(); d.ajustes.sonido = e.target.checked; guardar(); sonando(e.target.checked);
});
$("#m-borrar").addEventListener("click", () => {
  if (!confirm(t("menu.borrar-confirmar"))) return;
  // BORRAR EL RECORD NO BORRA EL IDIOMA: está en el mismo bulto guardado, pero
  // volver al inglés porque alguien reseteó su puntaje es un castigo que nadie
  // pidió.
  const cod = cargar().ajustes.idioma;
  borrar();
  const nuevo = cargar(); nuevo.ajustes.idioma = cod; guardar();
  alMenu();
});

// --- idiomas -------------------------------------------------------------
// Cambiar de idioma reescribe los `data-t` y ADEMAS vuelve a pintar lo que se
// escribe desde JavaScript: el contador de intentos y el nombre del piso no
// tienen marca en el HTML, así que `aplicar()` no los toca y quedarían en el
// idioma anterior hasta la próxima partida.
function elegir(cod, guardarlo = true) {
  ponerIdioma(cod);
  aplicar();
  $("#m-idioma").textContent = cod.toUpperCase();
  if (guardarlo) { const d = cargar(); d.ajustes.idioma = cod; guardar(); }
}
for (const b of document.querySelectorAll("[data-idioma]"))
  b.addEventListener("click", () => { efe.menu(); elegir(b.dataset.idioma); alMenu(); });
// El botón del menú rota entre los tres: con tres idiomas, una pantalla aparte
// para elegirlos es un toque de más.
$("#m-idioma").addEventListener("click", () => {
  const cods = Object.keys(IDIOMAS);
  efe.menu();
  elegir(cods[(cods.indexOf(idioma()) + 1) % cods.length]);
  alMenu();
});

// --- HUD -----------------------------------------------------------------
// Se escribe SOLO cuando cambia: esta función corre sesenta veces por segundo y
// tocar el DOM en cada cuadro es de las cosas más caras que se pueden hacer en
// un teléfono, para escribir los mismos números que ya estaban.
const hud = {};
function pintarHud(p) {
  const poner = (sel, v) => { if (hud[sel] === v) return; hud[sel] = v; $(sel).textContent = v; };
  poner("#h-metros", `${p.metros} m`);
  poner("#h-tuercas", String(p.tuercas));
  poner("#h-piso", t(pisoDe(p.alto).clave));
  const apuro = p.sube > 0;
  if (hud.apuro !== apuro) { hud.apuro = apuro; $("#h-metros").classList.toggle("apuro", apuro); }
}

let ultimoHito = 0;
function sonar(p) {
  const e = p.ev;
  if (e.engancha) efe.engancha();
  if (e.suelta) efe.suelta();
  if (e.tuerca) efe.tuerca();
  if (e.pared) efe.pared();
  if (e.rompe) efe.rompe();
  if (e.muerto) { efe.muerto(); terminar(p); }
  const hito = Math.floor(p.metros / 50);
  if (hito > ultimoHito) { ultimoHito = hito; efe.hito(); }
  soplar(Math.min(1, Math.hypot(p.vx, p.vy) / F.VEL_MAX));
}

function terminar(p) {
  const d = cargar();
  const record = p.metros > d.mejor;
  d.mejor = Math.max(d.mejor, p.metros);
  d.partidas++;
  guardar();
  $("#f-metros").textContent = `${p.metros} m`;
  $("#f-record").hidden = !record;
  $("#f-lista").innerHTML = "";
  const item = (k, v) => {
    const li = document.createElement("li");
    li.innerHTML = `<span></span><b></b>`;
    li.firstChild.textContent = k; li.lastChild.textContent = v;
    $("#f-lista").append(li);
  };
  item(t("fin.tuercas"), p.tuercas);
  item(t("fin.puntaje"), p.puntaje);
  item(t("fin.mejor"), `${d.mejor} m`);
  // No se muestra enseguida: el bicho sigue cayendo un segundo, y ese segundo
  // es lo que hace que el final se sienta como un final y no como un corte.
  setTimeout(() => { if (partida && partida.estado === "muerto") mostrar("p-fin"); }, 1200);
}

// --- bucle ---------------------------------------------------------------
// Paso fijo con acumulador. Con dt variable la física cambia según los hercios
// del monitor, y en un juego donde la torre se genera midiendo lo que se puede
// saltar, eso no es "un poco distinto": es otra torre.
const PASO = 1000 / 60;
let previo = performance.now(), sobra = 0, fallas = 0;

function bucle(ahora) {
  requestAnimationFrame(bucle);
  let dt = ahora - previo; previo = ahora;
  if (dt > 250) dt = 250;
  sobra += dt;
  let n = 0;
  while (sobra >= PASO && n < 5) {
    sobra -= PASO; n++;
    if (!partida) {
      // El demo del fondo. Si se estrella, arranca otra trepada: el menú tiene
      // que estar vivo aunque alguien lo deje abierto diez minutos.
      if (demo) {
        try {
          demo.paso(piloto(demo));
          if (demo.estado === "muerto" && demo.cuenta > 40) arrancarDemo();
        } catch (e) { demo = null; }
      }
      continue;
    }
    try {
      leerEntrada();
      partida.paso(entrada);
      sonar(partida);
    } catch (e) {
      // Un error adentro del bucle se repite sesenta veces por segundo: la
      // pantalla queda quieta y no se puede ni salir.
      if (fallas++ === 0) console.error("Garfio se rompió:", e);
      partida = null; alMenu();
    }
  }
  if (partida) { dibujar(ctx, partida); pintarHud(partida); }
  else if (demo) dibujar(ctx, demo);
}

// --- arranque ------------------------------------------------------------
const ARTE = ["bicho"];

function traer(url) {
  return new Promise((listo) => {
    const im = new Image();
    im.onload = () => listo(im);
    im.onerror = () => listo(null);
    im.src = url;
  });
}

// EL JUEGO ARRANCA SIN ESPERAR AL ARTE. Se carga en segundo plano y se registra
// cuando llega; hasta entonces se dibuja la versión de círculos. Una conexión
// lenta no deja al jugador mirando una pantalla de carga, y el juego sigue
// siendo jugable con cero archivos.
(async () => {
  const d = cargar();
  $("#aj-sonido").checked = d.ajustes.sonido;
  sonando(d.ajustes.sonido);
  elegir(d.ajustes.idioma || "en", false);
  if (!demo) arrancarDemo();
  if (d.ajustes.idioma) alMenu();
  else mostrar("p-idioma");
  requestAnimationFrame(bucle);
  for (const n of ARTE) registrarArte(n, await traer(rutaArte(n)));
})();

// Para las pruebas: poder mirar la partida desde afuera sin tocar el juego.
globalThis.GARFIO = {
  get partida() { return partida; },
  get demo() { return demo; },
  jugar, alMenu, Partida, piloto,
};
