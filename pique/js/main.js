// Arranque, entrada y bucle.

import { NIVELES, buscarNivel, idNivel, ANCHO_VISTA, ALTO_VISTA } from "./mundo.js";
import { generarNivel } from "./generador.js";
import { Partida, ESTADO } from "./juego.js";
import { cargar, tierActual } from "./guardado.js";
import * as UI from "./interfaz.js";
import { despertar, efe, pararMusica, volumen } from "./audio.js";

const $ = UI.$;
const lienzo = $("#lienzo");
const ctx = lienzo.getContext("2d", { alpha: false });
lienzo.width = ANCHO_VISTA; lienzo.height = ALTO_VISTA;
ctx.imageSmoothingEnabled = false;

let partida = null, cfgActual = null, tierActualN = "rosa";

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
    partida = new Partida(nv, tierActualN);
    $("#hud-nivel").textContent = `${idNivel(m, n)} ${cfgActual.titulo}`;
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
      partida.actualizar(ent);
      if (antes !== partida.estado &&
          (partida.estado === ESTADO.GANADO || partida.estado === ESTADO.PERDIDO)) {
        terminar(partida.estado === ESTADO.GANADO);
      }
    } else entrada.previo = entrada.apoyado;
  }
  if (partida) {
    partida.dibujar(ctx);
    UI.pintarHud(partida);
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
$("#btn-jugar").addEventListener("click", () => { despertar(); efe.menu(); alMapa(); });
$("#btn-comojuego").addEventListener("click", () => { efe.menu(); UI.mostrar("p-ayuda"); });
$("#btn-ajustes").addEventListener("click", () => { efe.menu(); UI.mostrar("p-ajustes"); });
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); UI.mostrar(b.dataset.volver); });
$("#hud-salir").addEventListener("click", alMapa);

UI.montarAjustes();
UI.mostrar("p-inicio");
requestAnimationFrame(bucle);

// Para las pruebas: da acceso al estado sin tocar nada del juego.
window.PIQUE = {
  get partida() { return partida; },
  get cfg() { return cfgActual; },
  empezar, alMapa, entrada, NIVELES,
};
