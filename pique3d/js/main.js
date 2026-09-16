// Arranque, entrada y bucle. Version 3D.

import * as THREE from "../vendor/three.module.min.js";
import { NIVELES, buscarNivel, idNivel } from "./mundo.js";
import { generarNivel } from "./generador.js";
import { Partida, ESTADO } from "./juego.js";
import { crearRenderer, Camara } from "./escena.js";
import { precargar } from "./actores.js";
import { cargar, tierActual } from "./guardado.js";
import * as UI from "./interfaz.js";
import { despertar, efe, pararMusica, cargarPistas } from "./audio.js";

const $ = UI.$;
const lienzo = $("#lienzo");
const { ren, movil } = crearRenderer(lienzo);
let partida = null, cfgActual = null, tierN = "rosa", modelos = {};

// --- entrada -------------------------------------------------------------
const entrada = { apoyado: false, previo: false };
const abajo = (e) => { despertar(); entrada.apoyado = true; if (e?.cancelable) e.preventDefault(); };
const arriba = () => { entrada.apoyado = false; };
for (const ev of ["pointerdown", "touchstart"]) lienzo.addEventListener(ev, abajo, { passive: false });
for (const ev of ["pointerup", "pointercancel", "touchend", "mouseup"]) addEventListener(ev, arriba);
addEventListener("keydown", (e) => {
  if (["Space", "ArrowUp", "KeyZ", "KeyX", "Enter"].includes(e.code)) abajo(e);
  if (e.code === "Escape" && partida) alMapa();
  if (e.code === "KeyR" && partida) empezar(cfgActual.m, cfgActual.n);
});
addEventListener("keyup", (e) => { if (["Space", "ArrowUp", "KeyZ", "KeyX", "Enter"].includes(e.code)) arriba(); });
addEventListener("blur", arriba);
document.addEventListener("visibilitychange", () => { if (document.hidden) arriba(); });

// --- tamano --------------------------------------------------------------
// El lienzo ocupa la pantalla entera y la camara se recalcula en cada cambio.
// Sin esto, girar el telefono deja la mitad del juego fuera del vidrio.
function redimensionar() {
  const w = innerWidth, h = innerHeight;
  ren.setSize(w, h, false);
  if (partida) partida.cam.redimensionar(w, h);
}
addEventListener("resize", redimensionar);
addEventListener("orientationchange", () => setTimeout(redimensionar, 180));

// --- pantallas -----------------------------------------------------------
function alMapa() {
  if (partida) { partida.destruir(); partida = null; }
  pararMusica();
  UI.pintarMapa(empezar);
  UI.mostrar("p-mapa");
}

async function empezar(m, n) {
  cfgActual = buscarNivel(m, n);
  tierN = tierActual(idNivel(m, n));
  $("#gen-nivel").textContent = `${idNivel(m, n)} · ${cfgActual.titulo}`;
  UI.mostrar("p-generando");
  if (movil) UI.pantallaCompleta();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const t0 = performance.now();
  const nv = generarNivel(cfgActual, tierN);
  const ms = Math.round(performance.now() - t0);
  if (partida) partida.destruir();
  partida = new Partida(nv, tierN, modelos, movil);
  partida.modelosRef = modelos;
  partida.cam.redimensionar(innerWidth, innerHeight);
  $("#hud-nivel").textContent = `${idNivel(m, n)} ${cfgActual.titulo}`;
  $("#hud-gen").textContent = nv.validacion.fallo ? "sin validar"
    : `validado en ${nv.validacion.intentos} ${nv.validacion.intentos === 1 ? "intento" : "intentos"} · ${ms} ms`;
  UI.mostrar("p-juego");
  redimensionar();
}

// --- bucle ---------------------------------------------------------------
// Paso fijo con acumulador. Con dt variable la fisica cambia segun los hercios
// de la pantalla, y el nivel validado deja de ser el nivel que se juega.
const PASO = 1000 / 60;
let ultimo = performance.now(), acum = 0;

function bucle(ahora) {
  requestAnimationFrame(bucle);
  let dt = ahora - ultimo; ultimo = ahora;
  if (dt > 250) dt = PASO;
  acum += dt;
  let pasos = 0;
  while (acum >= PASO && pasos < 5) {
    acum -= PASO; pasos++;
    if (partida) {
      const ent = { toque: entrada.apoyado, toqueNuevo: entrada.apoyado && !entrada.previo };
      entrada.previo = entrada.apoyado;
      const antes = partida.estado;
      partida.actualizar(ent, PASO / 1000);
      if (antes !== partida.estado &&
          (partida.estado === ESTADO.GANADO || partida.estado === ESTADO.PERDIDO)) terminar(partida.estado === ESTADO.GANADO);
    } else entrada.previo = entrada.apoyado;
  }
  if (partida) {
    ren.info.reset();          // si no, las cifras son acumuladas y no dicen nada
    ren.render(partida.esc, partida.cam.cam);
    UI.pintarHud(partida);
  }
}

function terminar(gano) {
  const p = partida;
  setTimeout(() => {
    UI.pintarResultado(p, cfgActual, gano,
      () => { const i = NIVELES.indexOf(cfgActual); const s = NIVELES[i + 1];
              if (s && s.m <= cargar().desbloqueado) empezar(s.m, s.n); else alMapa(); },
      () => empezar(cfgActual.m, cfgActual.n), alMapa);
    if (partida) { partida.destruir(); partida = null; }
  }, gano ? 1100 : 800);
}

// --- botones -------------------------------------------------------------
$("#btn-jugar").addEventListener("click", () => { despertar(); efe.menu(); alMapa(); });
$("#btn-comojuego").addEventListener("click", () => { efe.menu(); UI.mostrar("p-ayuda"); });
$("#btn-ajustes").addEventListener("click", () => { efe.menu(); UI.mostrar("p-ajustes"); });
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); UI.mostrar(b.dataset.volver); });
$("#hud-salir").addEventListener("click", alMapa);
$("#hud-pantalla").addEventListener("click", UI.pantallaCompleta);
// El aviso de girar se puede descartar. Hay telefonos con el giro bloqueado y
// hay gente que juega acostada en la cama: dejar la pantalla trabada con un
// cartel que no se puede obedecer es peor que jugar en vertical.
$("#girar-igual").addEventListener("click", () => {
  $("#girar").classList.add("descartado");
  redimensionar();
});

// --- carga ---------------------------------------------------------------
(async () => {
  const nombres = ["heroe", "bolo", "caracol", "aleta", "erizo", "fauces",
                   "conducto", "yunque", "coloso", "moneda", "resorte", "osario", "perno"];
  $("#carga-detalle").textContent = "Cargando modelos…";
  modelos = await precargar(nombres);
  const faltan = nombres.filter((n) => !modelos[n]);
  $("#carga-detalle").textContent = faltan.length
    ? `${nombres.length - faltan.length}/${nombres.length} modelos` : "Listo";
  // La musica se carga sin bloquear: el juego arranca igual y la pista entra
  // cuando llega. Bloquear el arranque por 400 KB de musica es regalar el
  // primer segundo del jugador.
  cargarPistas({ llano: "assets/snd/llano.mp3", subte: "assets/snd/subte.mp3",
                 castillo: "assets/snd/castillo.mp3" });
  UI.montarAjustes();
  UI.mostrar("p-inicio");
  redimensionar();
  requestAnimationFrame(bucle);
  window.PIQUE3D = { get partida() { return partida; }, get cfg() { return cfgActual; },
                     empezar, alMapa, entrada, NIVELES, ren, modelos, faltan };
})();
