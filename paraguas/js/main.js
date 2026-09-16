// Arranque, entrada y bucle.

import { VISTA, F, ajustarVista, M } from "./mundo.js";
import { Partida } from "./juego.js";
import { dibujar, registrarTexturas, tramoDe } from "./dibujo.js";
import { crearHeroe, pasoHeroe, registrarArte } from "./heroe.js";
import { despertar, efe, sonando, arrancarViento, soplar, callarViento } from "./audio.js";
import { cargar, guardar, borrar } from "./guardado.js";
import { pilotoDedo } from "./piloto.js";
import { ruta } from "./assets.js";

const $ = (s) => document.querySelector(s);
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d", { alpha: false });
let partida = null;

// EL FONDO DE LOS MENUS ES UNA CAIDA DE VERDAD, borroneada.
//
// No es un video ni una imagen: es el juego corriendo con el piloto automatico
// —el mismo que usa el validador del pozo— y el lienzo desenfocado por CSS.
// Cuesta lo que cuesta un cuadro del juego, no hace falta cargar nada, y sobre
// todo nunca se desactualiza: si mañana cambia el color de un tramo o la forma
// de una viga, el menu cambia solo.
let demo = null;
function arrancarDemo() {
  demo = new Partida();
  // ARRANCA HONDO, no en la boca del pozo. Los primeros siete metros van
  // limpios a propósito —para que el jugador se acomode— y un menú cuyo fondo
  // es un rectángulo vacío durante los primeros dos segundos no se lee como
  // "hay un juego atrás", se lee como que falló algo.
  demo.y = 900 + Math.random() * 12000;
  demo.pozo.generarHasta(demo.y + 2500);
  const f = demo.pozo.siguiente(demo.y + 240);
  demo.x = f ? f.x : 180;
  demo.cam = demo.y - VISTA.alto * 0.3;
  demo.heroe = crearHeroe(demo.x, demo.y);
}

// --- tamano --------------------------------------------------------------
// El ancho es fijo y el alto no: el pozo mide 360 unidades en todos los
// aparatos —si no, en una pantalla angosta habria que cruzar mas pozo en el
// mismo tiempo— y a lo alto se estira hasta donde llegue, porque ver un poco
// mas o menos de pozo no cambia nada.
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
// UN DEDO HACE TODO, y hace dos cosas a la vez: apoyado, el paraguas se cierra
// —se cae rapido— y el personaje va hacia donde esta el dedo. Soltando, el
// paraguas se abre y se planea.
//
// Que sean la misma cosa no es una limitacion: es el juego. Y tiene una
// valvula de escape que sale sola: el paraguas tarda nueve cuadros en cerrarse,
// asi que un toquecito corto apunta SIN cerrar. Apretones largos para bajar,
// toquecitos para acomodarse.
const entrada = { cerrar: false, mover: null };
let dedo = null;

const aMundo = (ev) => {
  const r = lienzo.getBoundingClientRect();
  return (ev.clientX - r.left) / esc - (VISTA.ancho - 360) / 2;
};

// EL DEDO MANEJA POR ARRASTRE, NO POR POSICION, y es la correccion que mas
// cambia como se siente el juego.
//
// La primera version llevaba al personaje HACIA donde estaba el dedo. Tocar
// para cerrar el paraguas —que es lo que hay que hacer todo el tiempo— lo
// mandaba de golpe hasta el dedo, asi que no se podia cerrar sin moverse: el
// gesto de "caer rapido" y el de "correrme" eran el mismo y no se podian
// separar. Ahora al apoyar se toma la posicion como CERO y lo que cuenta es
// cuanto se corrio el dedo desde ahi: apoyar y no mover cierra el paraguas y
// nada mas. El objetivo se arrastra con el dedo pixel a pixel.
lienzo.addEventListener("pointerdown", (ev) => {
  despertar(); arrancarViento();
  const x = aMundo(ev);
  dedo = { id: ev.pointerId, x, cero: x, objetivo: partida ? partida.x : x };
  try { lienzo.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
lienzo.addEventListener("pointermove", (ev) => {
  if (!dedo || ev.pointerId !== dedo.id) return;
  dedo.x = aMundo(ev);
  // 1,5 px de personaje por pixel de dedo: con 1 a 1 hay que barrer media
  // pantalla para cruzar el pozo y el pulgar no llega.
  dedo.objetivo = Math.max(14, Math.min(346, dedo.objetivo + (dedo.x - dedo.cero) * 1.5));
  dedo.cero = dedo.x;
});
// setPointerCapture puede tirar excepcion si el puntero ya se solto, y sin
// atrapar el error el dedo queda apoyado para siempre: el paraguas no se abre
// nunca mas.
const soltar = (ev) => { if (dedo && ev.pointerId === dedo.id) dedo = null; };
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

const teclas = {};
addEventListener("keydown", (e) => {
  teclas[e.code] = true;
  if (["Space", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "Enter" && !$("#p-fin").hidden) jugar();
});
addEventListener("keyup", (e) => { teclas[e.code] = false; });

function leerEntrada() {
  if (!partida) return;
  const tecla = !!(teclas.Space || teclas.ArrowDown);
  if (teclas.ArrowLeft) { entrada.mover = -1; entrada.cerrar = tecla; return; }
  if (teclas.ArrowRight) { entrada.mover = 1; entrada.cerrar = tecla; return; }
  if (tecla) { entrada.cerrar = true; entrada.mover = 0; return; }
  if (dedo) {
    entrada.cerrar = true;
    const d = dedo.objetivo - partida.x;
    entrada.mover = Math.abs(d) < 3 ? 0 : Math.max(-1, Math.min(1, d / 26));
    return;
  }
  entrada.cerrar = false;
  entrada.mover = null;             // null = sin dedo: planea, no frena
}

// --- pantallas -----------------------------------------------------------
function mostrar(id) {
  for (const p of document.querySelectorAll(".pantalla")) p.hidden = true;
  $("#" + id).hidden = false;
  // El desenfoque se enciende con una clase en el body y lo aplica el
  // compositor: poner un filtro en el lienzo por cuadro desde JavaScript seria
  // pagar el mismo efecto tres veces.
  document.body.classList.toggle("borroso", id !== "p-juego");
}

function alMenu() {
  partida = null;
  callarViento();
  if (!demo) arrancarDemo();
  const d = cargar();
  $("#m-mejor").textContent = `${d.mejor} m`;
  $("#m-caidas").textContent = d.partidas === 1 ? "1 caída" : `${d.partidas} caídas`;
  mostrar("p-menu");
}

function jugar() {
  despertar(); arrancarViento();
  demo = null;
  partida = new Partida();
  partida.heroe = crearHeroe(partida.x, partida.y);
  ultimoHito = 0;
  hud.metros = null;
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
  if (!confirm("¿Borrar el récord?")) return;
  borrar(); alMenu();
});

// --- HUD -----------------------------------------------------------------
// Se escribe SOLO cuando cambia: esta funcion corre sesenta veces por segundo y
// tocar el DOM en cada cuadro es de las cosas mas caras que se pueden hacer en
// un telefono, para escribir los mismos numeros que ya estaban.
const hud = {};
function pintarHud(p) {
  const poner = (sel, v) => { if (hud[sel] === v) return; hud[sel] = v; $(sel).textContent = v; };
  poner("#h-metros", `${p.metros} m`);
  poner("#h-monedas", String(p.monedas));
  poner("#h-tramo", tramoDe(p.y).nombre);
  if (hud.varillas !== p.varillas) {
    hud.varillas = p.varillas;
    $("#h-varillas").textContent = "☂".repeat(Math.max(0, p.varillas)) || "—";
    $("#h-varillas").className = "varillas" + (p.varillas <= 1 ? " poca" : "");
  }
}

let ultimoHito = 0;
function sonar(p) {
  const e = p.ev;
  if (e.moneda) efe.moneda();
  if (e.roce) efe.roce();
  if (e.golpe) efe.golpe();
  if (e.pinchos) efe.pinchos();
  if (e.paraguas) (p.objetivo ? efe.abrir() : efe.cerrar());
  if (e.muerto) { efe.muerto(); terminar(p); }
  const hito = Math.floor(p.metros / 100);
  if (hito > ultimoHito) { ultimoHito = hito; efe.hito(); }
  const v = (p.vy - F.TERMINAL_ABIERTO) / (F.TERMINAL_CERRADO - F.TERMINAL_ABIERTO);
  soplar(Math.max(0, Math.min(1, v)));
}

function terminar(p) {
  const d = cargar();
  const record = p.metros > d.mejor;
  d.mejor = Math.max(d.mejor, p.metros);
  d.mejorMonedas = Math.max(d.mejorMonedas, p.monedas);
  d.partidas++;
  guardar();
  $("#f-metros").textContent = `${p.metros} m`;
  $("#f-record").hidden = !record;
  $("#f-lista").innerHTML = "";
  const item = (k, v) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${k}</span><b>${v}</b>`;
    $("#f-lista").append(li);
  };
  item("Chatarra", p.monedas);
  item("Pasadas al ras", p.roces);
  item("Puntaje", p.puntaje);
  item("Mejor caída", `${d.mejor} m`);
  // No se muestra enseguida: el muñeco sigue cayendo un segundo y medio, y ese
  // segundo y medio es lo que hace que el final se sienta como un final.
  setTimeout(() => { if (partida && partida.estado === "muerto") mostrar("p-fin"); }, 1400);
}

// --- bucle ---------------------------------------------------------------
// Paso fijo con acumulador. Con dt variable la caida cambia segun los hercios
// del monitor, y en un juego donde el pozo se genera midiendo la velocidad de
// caida, eso no es "un poco distinto": es otro pozo.
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
      // El demo del fondo. Si se estrella, arranca otra caida: el menu tiene
      // que estar vivo aunque alguien lo deje abierto diez minutos.
      if (demo) {
        try {
          demo.paso(pilotoDedo(demo));
          pasoHeroe(demo.heroe, demo.x, demo.y, demo.vx, demo.vy, demo.abierto);
          if (demo.estado === "muerto" && demo.cuenta > 40) arrancarDemo();
        } catch (e) { demo = null; }
      }
      continue;
    }
    try {
      leerEntrada();
      partida.paso(entrada);
      pasoHeroe(partida.heroe, partida.x, partida.y, partida.vx, partida.vy, partida.abierto);
      sonar(partida);
    } catch (e) {
      // Un error adentro del bucle se repite sesenta veces por segundo: la
      // pantalla queda quieta y no se puede ni salir.
      if (fallas++ === 0) console.error("Paraguas se rompió:", e);
      partida = null; alMenu();
    }
  }
  if (partida) { dibujar(ctx, partida); pintarHud(partida); }
  else if (demo) dibujar(ctx, demo);
}

// --- arranque ------------------------------------------------------------
const ARTE = ["paraguas_abierto", "paraguas_cerrado", "rilo_cabeza", "rilo_torso",
              "rilo_brazo_alto", "rilo_brazo_bajo", "rilo_pierna_alta", "rilo_pierna_baja"];
const TEXTURAS = ["pared", "repisa"];

function traer(url) {
  return new Promise((listo) => {
    const im = new Image();
    im.onload = () => listo(im);
    im.onerror = () => listo(null);
    im.src = url;
  });
}

// EL JUEGO ARRANCA SIN ESPERAR AL ARTE. Se carga en segundo plano y se registra
// cuando llega; hasta entonces se dibuja la version de lineas y circulos. Una
// conexion lenta no deja al jugador mirando una pantalla de carga, y el juego
// sigue siendo jugable con cero archivos.
(async () => {
  const d = cargar();
  $("#aj-sonido").checked = d.ajustes.sonido;
  sonando(d.ajustes.sonido);
  alMenu();
  requestAnimationFrame(bucle);
  window.PARAGUAS = { get partida() { return partida; }, get demoMetros() { return demo?.metros; },
                     jugar, alMenu, entrada, VISTA, F };

  const arte = {}, tex = {};
  await Promise.all([
    ...ARTE.map(async (k) => { const im = await traer(ruta(`assets/arte/${k}.webp`)); if (im) arte[k] = im; }),
    ...TEXTURAS.map(async (k) => { const im = await traer(ruta(`assets/arte/${k}.webp`)); if (im) tex[k] = im; }),
  ]);
  if (arte.paraguas_abierto) registrarArte(arte);
  registrarTexturas(tex);
})();
