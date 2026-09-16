// Arranque, entrada y bucle.

import { construirNivel, CAPITULOS, FINAL } from "./nivel.js";
import { Partida, VISTA } from "./juego.js";
import { dibujar, dibujarEscenario, origenEscenario } from "./dibujo.js";
import { Escenario } from "./portales.js";
import { NIVELES_P } from "./mapas.js";
import { escalarCuerpos } from "./cuerpo.js";
import { despertar, efe, sonando, zumbido, cargarVoces, voz } from "./audio.js";
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
let esc = 1;
function redimensionar() {
  const w = innerWidth, h = innerHeight;
  esc = Math.min(w / VISTA.ancho, h / 560);   // nunca menos de 560 de alto util
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
addEventListener("orientationchange", () => setTimeout(redimensionar, 180));
redimensionar();

// --- entrada -------------------------------------------------------------
// UN DEDO ALCANZA. Se toca donde sea y el reactor empuja HACIA el dedo: no hay
// que buscar un boton, el boton es la pantalla entera. El empujon es analogico
// —cuanto mas lejos esta el dedo del muneco, mas fuerte— asi que se puede
// corregir de a poco en vez de ir siempre a fondo.
const entrada = { mover: 0, bolita: false, dedoX: null };
let dedoDir = null, dedoBol = null;

function aMundo(ev) {
  const r = lienzo.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / esc, y: (ev.clientY - r.top) / esc };
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
      escena.disparar(tocado.x - o.x, tocado.y - o.y);
    }
    tocado = null;
  }
  if (ev.pointerId === dedoDir) { dedoDir = null; entrada.dedoX = null; }
  else entrada.bolita = false;
};
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", soltar);

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
  if (["Space", "ArrowLeft", "ArrowRight", "ArrowDown"].includes(e.code)) e.preventDefault();
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
    ...TEXTURAS.map(async (t) => {
      const im = await traer(ruta(`assets/partes/${t}.webp`));
      if (im) texturas[t] = im;
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

function alMenu() {
  partida = null; escena = null;
  const d = cargar();
  $("#m-record").textContent = `${d.mejorProf} m · ${d.mejorChatarra} chatarras`;
  $("#m-seguir").hidden = d.capitulo === 0;
  $("#m-seguir-sub").textContent = CAPITULOS[Math.min(d.capitulo, CAPITULOS.length - 1)].nombre;
  mostrar("p-menu");
}

function jugar(cap) {
  escena = null;
  escalarCuerpos(1);
  nivel = construirNivel();          // el nivel se rearma para limpiar portales y chatarra
  partida = new Partida(nivel);
  if (cap > 0) partida.reiniciarEn(cap);
  capSonando = -1;
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
    b.innerHTML = `<b>${i + 1}</b><small>${libre ? n.nombre : "🔒"}</small>` +
                  (d.portales.chatarra[i] ? "<small>◆</small>" : "");
    b.addEventListener("click", () => { despertar(); efe.menu(); portal(i); });
    cont.append(b);
  });
  $("#pn-cuenta").textContent = `${hechos}/${NIVELES_P.length}`;
  $("#m-portales-sub").textContent = `${hechos} de ${NIVELES_P.length} resueltos`;
}

function portal(n) {
  partida = null;
  escalarCuerpos(ESCALA_P);
  escena = new Escenario(n);
  $("#h-portal").hidden = false;
  ultimo.pista = null; ultimo.bocha = null;
  mostrar("p-juego");
}

$("#m-jugar").addEventListener("click", () => { despertar(); efe.menu(); jugar(0); });
$("#m-portales").addEventListener("click", () => {
  despertar(); efe.menu(); pintarNiveles(); mostrar("p-niveles");
});
$("#h-reintentar").addEventListener("click", () => { efe.menu(); if (escena) escena.reiniciar(); });
$("#m-seguir").addEventListener("click", () => { despertar(); efe.menu(); jugar(cargar().capitulo); });
$("#m-como").addEventListener("click", () => { efe.menu(); mostrar("p-como"); });
$("#m-borrar").addEventListener("click", () => {
  if (!confirm("¿Borrar el progreso y el récord?")) return;
  borrar(); alMenu();
});
$("#aj-sonido").addEventListener("change", (e) => {
  const d = cargar(); d.ajustes.sonido = e.target.checked; guardar(); sonando(e.target.checked);
});
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); alMenu(); });
$("#f-otra").addEventListener("click", () => { efe.menu(); cortarFinal(); jugar(0); });
$("#f-menu").addEventListener("click", () => { efe.menu(); cortarFinal(); alMenu(); });
$("#j-salir").addEventListener("click", () => {
  efe.menu();
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
function pintarHud(p) {
  const poner = (sel, v) => { if (ultimo[sel] === v) return; ultimo[sel] = v; $(sel).textContent = v; };
  poner("#h-metros", `${p.metros} m`);
  poner("#h-chatarra", String(p.juntada));
  poner("#h-cap", p.capitulo.nombre);
  const i = Math.round(p.integridad);
  if (ultimo.integridad !== i) {
    ultimo.integridad = i;
    $("#h-barra").style.width = `${i}%`;
    $("#h-barra").className = i < 30 ? "mal" : i < 60 ? "medio" : "";
  }
  const hay = !!p.dicho;
  if (ultimo.hayDicho !== hay) { ultimo.hayDicho = hay; $("#dialogo").hidden = !hay; }
  if (hay) {
    const [quien, que] = p.dicho.lineas[p.dicho.i];
    poner("#d-quien", quien);
    poner("#d-que", que);
    if (ultimo.dQuien !== quien) { ultimo.dQuien = quien;
      $("#dialogo").dataset.quien = quien.toLowerCase(); }
  }
}

function pintarHudPortal(e) {
  const poner = (sel, v) => { if (ultimo[sel] === v) return; ultimo[sel] = v; $(sel).textContent = v; };
  poner("#h-metros", `${e.tiros} tiros`);
  poner("#h-chatarra", String(e.juntada));
  poner("#h-cap", `${e.n + 1}. ${e.nombre}`);
  const i = Math.round(e.integridad);
  if (ultimo.integridad !== i) {
    ultimo.integridad = i;
    $("#h-barra").style.width = `${i}%`;
    $("#h-barra").className = i < 30 ? "mal" : i < 60 ? "medio" : "";
  }
  if (ultimo.pista !== e.pista) { ultimo.pista = e.pista; $("#h-pista").textContent = e.pista; }
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
  if (v.boton) efe.resorte();
  if (v.roto) efe.roto();
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
  if (e.roto) efe.roto();
  if (e.gano) efe.gano();
  if (e.capitulo != null) {
    const d = cargar();
    if (e.capitulo > d.capitulo) { d.capitulo = e.capitulo; guardar(); }
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

// Los relojes del diálogo final. Se guardan para poder cancelarlos: si el
// jugador toca "Otra vez" a los dos segundos, las voces que quedaban en cola
// seguían sonando encima del nivel nuevo.
let finTimers = [];
function cortarFinal() { for (const t of finTimers) clearTimeout(t); finTimers = []; }

function terminar(p) {
  cortarFinal();
  const d = cargar();
  d.mejorProf = Math.max(d.mejorProf, p.metros);
  d.mejorChatarra = Math.max(d.mejorChatarra, p.juntada);
  d.capitulo = 0;                    // terminarlo lo deja listo para empezar de cero
  guardar();
  $("#f-lista").innerHTML = "";
  const item = (k, v) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${k}</span><b>${v}</b>`;
    $("#f-lista").append(li);
  };
  item("Profundidad", `${p.metros} m`);
  item("Chatarra", `${p.juntada} de ${nivel.chatarra.length}`);
  item("Integridad final", `${Math.round(p.integridad)}%`);
  // Cada uno con su color, igual que en el juego: en un ida y vuelta de
  // cuatro lineas, saber quien habla sin leer el nombre es la mitad del chiste.
  $("#f-dialogo").innerHTML = FINAL
    .map(([q, t]) => `<p data-quien="${q.toLowerCase()}"><b>${q}</b> ${t}</p>`).join("");
  // El ida y vuelta del final, dicho en voz alta y en orden. Los tiempos salen
  // del propio índice: cada línea espera a que termine la anterior más medio
  // segundo, así que si una voz se regenera más larga, el ritmo se acomoda solo.
  let cuando = 260;
  FINAL.forEach((_, i) => {
    const t = VOCES[`f${i}`];
    finTimers.push(setTimeout(() => voz(`f${i}`), cuando));
    cuando += (t ? t[1] * 1000 : 1600) + 420;
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
    }
  }
  if (escena) {
    dibujarEscenario(ctx, escena);
    pintarHudPortal(escena);
  } else if (partida) {
    dibujar(ctx, partida);
    pintarHud(partida);
  }
}

// --- arranque ------------------------------------------------------------
{
  const d = cargar();
  $("#aj-sonido").checked = d.ajustes.sonido;
  sonando(d.ajustes.sonido);
  cargarImagenes();
  // Sin índice no se pide el mp3: no habría forma de saber qué parte suena.
  if (Object.keys(VOCES).length) cargarVoces(ruta("assets/voces.mp3"), VOCES);
  alMenu();
  requestAnimationFrame(bucle);
  // Para poder auditar el juego desde afuera: las pruebas corren la fisica de
  // verdad, no una copia.
  pintarNiveles();
  window.DN = {
    get partida() { return partida; }, get nivel() { return nivel; },
    get escena() { return escena; },
    jugar, portal, alMenu, entrada, VISTA, CAPITULOS, construirNivel, NIVELES_P,
  };
}
