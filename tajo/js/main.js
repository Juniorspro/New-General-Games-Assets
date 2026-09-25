// Arranque y menús. Acá se enchufa todo: el motor, el escenario, la música,
// la partida y las pantallas.
//
// LA PORTADA ES EL JUEGO JUGÁNDOSE SOLO. Detrás del menú corre la canción de
// verdad, con su mapa, sus luces y su letra, y un bot que corta los bloques.
// Así lo primero que se ve es lo que hay, no un cartel.

import { Motor } from "./motor.js";
import { Luces } from "./luces.js";
import { Escenario } from "./escenario.js";
import { encuadrar } from "./camara.js";
import { Bloques } from "./bloques.js";
import { Particulas } from "./particulas.js";
import { Sables } from "./sables.js";
import { Letra } from "./letra.js";
import { Entrada } from "./entrada.js";
import { Reproductor } from "./reproductor.js";
import { Hud } from "./hud.js";
import { Juego } from "./juego.js";
import { componer } from "./compositor.js";
import { CANCIONES } from "./canciones.js";
import { generarMapa, DIFICULTADES } from "./mapa.js";
import * as guardado from "./guardado.js";
import { analizarArchivo } from "./auto.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);

// ─────────────────────────── armado ───────────────────────────
const lienzo = $("#lienzo");
const motor = new Motor(lienzo, { fijo: params.has("fijo") });
const luces = new Luces();
const escenario = new Escenario(motor, luces);
const bloques = new Bloques(motor.escena);
const particulas = new Particulas(motor.escena);
const sables = new Sables(motor.escena, motor.camara);
const letra = new Letra(motor.escena);
const entrada = new Entrada(lienzo);
const reproductor = new Reproductor();
const hud = new Hud($("#hud"));
const juego = new Juego({ motor, bloques, particulas, sables, entrada, reproductor, hud, letra, luces, escenario });

let opciones = guardado.opciones();
const canciones = CANCIONES.map(componer);
let indiceCancion = Math.min(opciones.cancion || 0, canciones.length - 1);
let dificultad = opciones.dificultad || "normal";
let modo = "carga";                 // carga | menu | juego
let demo = null;                    // {cancion, desde, hasta}
let cancionTuya = null;

function aplicarOpciones() {
  luces.suave = !!opciones.lucesSuaves;
  motor.calidad = opciones.calidad || "auto";
  motor.pendienteMedir = true;
  reproductor.desfase = (opciones.desfaseMs || 0) / 1000;
  if (modo !== "menu") reproductor.ponerVolumenes(opciones.volMusica, opciones.volEfectos);
}
aplicarOpciones();

// ─────────────────────────── pantallas ───────────────────────────
function mostrar(id) {
  document.querySelectorAll(".pantalla").forEach(p => { p.hidden = p.id !== id; });
}

function tocarBoton() { reproductor.despertar(); reproductor.sonidoMenu(); }

document.querySelectorAll("[data-volver]").forEach(b => b.addEventListener("click", () => {
  tocarBoton(); mostrar(b.dataset.volver);
}));

// ── la portada que se juega sola ──
function arrancarDemo() {
  const c = canciones[indiceCancion];
  const coro = c.secciones.find(s => s.tipo === "coro") || c.secciones[0];
  const mapa = generarMapa(c, "normal", 3);
  juego.bot = true;
  juego.cargar(c, mapa, { sinPerder: true, libre: true }, coro.t - 2);
  hud.mostrar(false);
  reproductor.ponerVolumenes(opciones.volMusica * 0.7, 0);
  juego.empezar(coro.t - 2);
  demo = { desde: coro.t - 2, hasta: Math.min(c.duracion - 1, coro.fin + 6) };
  modo = "menu";
}

function pararDemo() {
  if (!demo) return;
  demo = null;
  juego.abandonar();
  juego.bot = false;
}

// ── carga ──
function listo() {
  $("#carga-detalle").textContent = "Listo.";
  $("#btn-tocar").hidden = false;
}
$("#btn-tocar").addEventListener("click", () => {
  reproductor.despertar();
  if (!opciones.avisoVisto) { mostrar("p-aviso"); return; }
  entrarAlMenu();
});
$("#aviso-suaves").addEventListener("click", () => {
  opciones.lucesSuaves = true; opciones.avisoVisto = true; guardado.guardarOpciones(opciones); aplicarOpciones(); entrarAlMenu();
});
$("#aviso-seguir").addEventListener("click", () => {
  opciones.avisoVisto = true; guardado.guardarOpciones(opciones); entrarAlMenu();
});

function entrarAlMenu() {
  mostrar("p-inicio");
  if (!demo) arrancarDemo();
}

// ── inicio ──
$("#btn-jugar").addEventListener("click", () => { tocarBoton(); armarLista(); mostrar("p-canciones"); });
$("#btn-tuya").addEventListener("click", () => { tocarBoton(); mostrar("p-tuya"); });
$("#btn-opciones").addEventListener("click", () => { tocarBoton(); cargarOpcionesUI(); mostrar("p-opciones"); });
$("#btn-como").addEventListener("click", () => { tocarBoton(); mostrar("p-como"); });

// ── canciones ──
function fmtTiempo(s) { const m = Math.floor(s / 60); return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`; }

function armarLista() {
  const l = $("#lista-canciones");
  l.textContent = "";
  canciones.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "cancion";
    b.setAttribute("aria-pressed", String(i === indiceCancion));
    const r = guardado.record(c.id, dificultad);
    b.innerHTML = `<span class="nom"></span><span class="dat"></span><span class="rec"></span>`;
    b.querySelector(".nom").textContent = c.titulo;
    b.querySelector(".dat").textContent = `${c.autor} · ${c.bpm} bpm · ${fmtTiempo(c.duracion)}`;
    b.querySelector(".rec").textContent = r ? r.rango : "";
    b.addEventListener("click", () => {
      tocarBoton();
      if (indiceCancion !== i) { indiceCancion = i; opciones.cancion = i; guardado.guardarOpciones(opciones); pararDemo(); arrancarDemo(); }
      armarLista();
    });
    l.appendChild(b);
  });
  armarDificultades($("#difs"), () => armarLista());
  const c = canciones[indiceCancion];
  const r = guardado.record(c.id, dificultad);
  const D = DIFICULTADES.find(d => d.id === dificultad);
  const cant = generarMapa(c, dificultad).notas.length;
  $("#record").textContent = (r ? `Récord: ${r.puntos.toLocaleString("es-AR")} · ${r.rango}` : "Sin récord todavía") + ` · ${cant} bloques · ${D.nombre}`;
}

function armarDificultades(cont, alCambiar) {
  cont.textContent = "";
  for (const D of DIFICULTADES) {
    const b = document.createElement("button");
    b.textContent = D.nombre;
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(D.id === dificultad));
    b.addEventListener("click", () => {
      tocarBoton();
      dificultad = D.id; opciones.dificultad = D.id; guardado.guardarOpciones(opciones);
      armarDificultades(cont, alCambiar); alCambiar && alCambiar();
    });
    cont.appendChild(b);
  }
}

$("#btn-empezar").addEventListener("click", () => { tocarBoton(); empezarPartida(canciones[indiceCancion]); });

// ── la partida ──
let ultimaPartida = null;
function empezarPartida(cancion) {
  pararDemo();
  ultimaPartida = cancion;
  const mapa = cancion.mapaPropio ? cancion.mapaPropio(dificultad) : generarMapa(cancion, dificultad);
  juego.bot = params.has("bot");
  juego.cargar(cancion, mapa, { sinPerder: opciones.sinPerder, libre: opciones.libre, tolerancia: dificultad === "facil" ? 70 : 60 });
  reproductor.ponerVolumenes(opciones.volMusica, opciones.volEfectos);
  hud.reiniciar(); hud.limpiarFlotantes();
  hud.mostrar(!opciones.ocultarHud);
  mostrar("");
  modo = "juego";
  juego.empezar(0);
}

juego.alTerminar = (est) => {
  if (modo !== "juego") return;
  setTimeout(() => mostrarFinal(est), est.perdio ? 900 : 1200);
};

function mostrarFinal(est) {
  const c = ultimaPartida;
  const D = DIFICULTADES.find(d => d.id === dificultad);
  $("#f-titulo").textContent = `${c.titulo} · ${D.nombre}`;
  const r = $("#f-rango");
  r.className = "rango-grande" + (est.perdio ? " perdio" : ["SS", "S", "A"].includes(est.rango) ? "" : " bajo");
  r.textContent = est.perdio ? "FALLASTE" : est.rango;
  $("#f-puntos").textContent = est.puntos.toLocaleString("es-AR");
  $("#f-precision").textContent = (est.precision * 100).toFixed(1).replace(".", ",") + "%";
  $("#f-combo").textContent = String(est.comboMax);
  $("#f-cortes").textContent = `${est.cortes}/${est.total}`;
  $("#f-detalle").textContent = `${est.perfectos} cortes de 115 · promedio ${est.promedio.toFixed(0)} · ${est.perdidos} perdidos · ${est.malos} mal cortados` + (est.bombas ? ` · ${est.bombas} bombas` : "");
  const nuevo = !c.sinRecord && guardado.anotar(c.id, dificultad, est);
  $("#f-nuevo").hidden = !nuevo;
  hud.mostrar(false);
  mostrar("p-final");
}

$("#h-pausa").addEventListener("click", () => pausar());
function pausar() {
  if (modo !== "juego" || juego.estado !== "jugando") return;
  juego.pausar();
  mostrar("p-pausa");
}
$("#btn-seguir").addEventListener("click", () => { mostrar(""); juego.reanudar(); });
$("#btn-reiniciar").addEventListener("click", () => { reproductor.reanudar(); juego.abandonar(); empezarPartida(ultimaPartida); });
$("#btn-salir").addEventListener("click", () => { reproductor.reanudar(); volverAlMenu(); });
$("#btn-otra").addEventListener("click", () => { tocarBoton(); empezarPartida(ultimaPartida); });
$("#btn-menu").addEventListener("click", () => { tocarBoton(); volverAlMenu(); });

function volverAlMenu() {
  juego.abandonar();
  hud.mostrar(false); hud.limpiarFlotantes();
  mostrar("p-inicio");
  arrancarDemo();
}

document.addEventListener("visibilitychange", () => { if (document.hidden) pausar(); });
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "p") { if (juego.estado === "jugando") pausar(); else if (juego.estado === "pausa") { mostrar(""); juego.reanudar(); } }
});

// ── opciones ──
function cargarOpcionesUI() {
  $("#op-libre").checked = !!opciones.libre;
  $("#op-sinperder").checked = !!opciones.sinPerder;
  $("#op-suaves").checked = !!opciones.lucesSuaves;
  $("#op-hud").checked = !!opciones.ocultarHud;
  $("#op-musica").value = opciones.volMusica;
  $("#op-efectos").value = opciones.volEfectos;
  $("#op-calidad").value = opciones.calidad;
  $("#op-desfase").value = opciones.desfaseMs;
  $("#op-desfase-v").textContent = `${opciones.desfaseMs} ms`;
}
const enlazar = (sel, clave, leer) => $(sel).addEventListener("input", (e) => {
  opciones[clave] = leer(e.target); guardado.guardarOpciones(opciones); aplicarOpciones();
  if (clave === "desfaseMs") $("#op-desfase-v").textContent = `${opciones.desfaseMs} ms`;
});
enlazar("#op-libre", "libre", el => el.checked);
enlazar("#op-sinperder", "sinPerder", el => el.checked);
enlazar("#op-suaves", "lucesSuaves", el => el.checked);
enlazar("#op-hud", "ocultarHud", el => el.checked);
enlazar("#op-musica", "volMusica", el => Number(el.value));
enlazar("#op-efectos", "volEfectos", el => Number(el.value));
enlazar("#op-calidad", "calidad", el => el.value);
enlazar("#op-desfase", "desfaseMs", el => Number(el.value));

// La calibración: un metrónomo de doce golpes; se guarda la MEDIANA del
// desvío de los toques (un toque distraído no corre la mediana).
$("#btn-calibrar").addEventListener("click", () => {
  if (!reproductor.despertar()) return;
  pararDemo();
  const ctx = reproductor.ctx;
  const b = $("#btn-calibrar"), est = $("#calibra-estado");
  const inicio = ctx.currentTime + 0.8, per = 0.6, n = 12;
  for (let i = 0; i < n; i++) {
    const t = inicio + i * per;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = i % 4 ? 900 : 1400;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(reproductor.maestro); o.start(t); o.stop(t + 0.1);
  }
  const desvios = [];
  b.textContent = "¡Tocá con cada golpe!";
  const toque = () => {
    const ahora = ctx.currentTime - reproductor.latencia();
    const k = Math.round((ahora - inicio) / per);
    if (k >= 0 && k < n) desvios.push(ahora - (inicio + k * per));
  };
  b.addEventListener("pointerdown", toque);
  setTimeout(() => {
    b.removeEventListener("pointerdown", toque);
    b.textContent = "Calibrar con el metrónomo";
    if (desvios.length < 6) { est.textContent = "Muy pocos toques. Probá de nuevo."; return; }
    desvios.sort((a, c) => a - c);
    const med = desvios[desvios.length >> 1];
    opciones.desfaseMs = Math.round(med * 1000 / 5) * 5;
    guardado.guardarOpciones(opciones); aplicarOpciones(); cargarOpcionesUI();
    est.textContent = `Listo: ${opciones.desfaseMs} ms (${desvios.length} toques).`;
  }, (0.8 + n * per + 0.6) * 1000);
});

// ── tu canción ──
$("#archivo").addEventListener("change", async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  reproductor.despertar();
  const est = $("#tuya-estado");
  $("#tuya-listo").hidden = true;
  est.textContent = "Leyendo el archivo…";
  try {
    cancionTuya = await analizarArchivo(f, reproductor.ctx, (msg) => { est.textContent = msg; });
    est.textContent = `${cancionTuya.titulo} · ${Math.round(cancionTuya.bpm)} bpm · ${fmtTiempo(cancionTuya.duracion)}`;
    armarDificultades($("#difs-tuya"), null);
    $("#tuya-listo").hidden = false;
  } catch (err) {
    console.error(err);
    est.textContent = "No pude leer ese audio. Probá con un mp3 o m4a.";
  }
});
$("#btn-tuya-jugar").addEventListener("click", () => { if (cancionTuya) { tocarBoton(); empezarPartida(cancionTuya); } });

// ─────────────────────────── el cuadro ───────────────────────────
let previo = performance.now();
let congelado = false;             // las pruebas manejan el tiempo cuadro por cuadro
function cuadro(ahoraMs) {
  requestAnimationFrame(cuadro);
  const dtReal = Math.max(0, ahoraMs - previo);
  previo = ahoraMs;
  if (congelado) return;
  unCuadro(Math.min(0.05, dtReal / 1000), ahoraMs / 1000);
  motor.anotarCuadro(dtReal, ahoraMs);
}

function unCuadro(dt, ahora, dibujar = true) {
  if (motor.medir()) {
    encuadrar(motor.camara, motor.cssAncho / motor.cssAlto);
    sables.medir(motor.cssAncho, motor.cssAlto);
    entrada.rect = lienzo.getBoundingClientRect();
  }
  if (juego.estado === "jugando" || juego.estado === "pausa" || juego.estado === "fin" || juego.estado === "perdio") {
    juego.cuadro(dt, ahora);
    if (juego.estado === "fin" || juego.estado === "perdio") {
      // Después del final el escenario sigue vivo con las luces de ambiente.
      luces.ambiente(ahora, dt, 0.3);
      particulas.actualizar(dt);
    }
  } else {
    luces.ambiente(ahora, dt, 0.35);
    sables.actualizar(ahora, dt);
    particulas.actualizar(dt);
  }
  if (demo && juego.estado === "jugando" && juego.tiempo() > demo.hasta) { pararDemo(); arrancarDemo(); }
  escenario.ponerEspectro(reproductor.espectro());
  motor.flash *= Math.pow(0.02, dt);
  if (dibujar) motor.dibujar();
}

// ─────────────────────────── sondas para las pruebas ───────────────────────────
window.__TAJO = {
  motor, juego, luces, reproductor, entrada, canciones, generarMapa, opciones: () => opciones,
  modo: () => modo,
  /** Arranca una partida sin menús (para las pruebas). */
  jugar(indice = 0, dif = "normal", { bot = true, reloj = null } = {}) {
    pararDemo();
    dificultad = dif;
    const c = canciones[indice];
    ultimaPartida = c;
    const mapa = generarMapa(c, dif);
    juego.bot = bot;
    juego.relojManual = reloj;
    juego.cargar(c, mapa, { sinPerder: false, libre: false });
    hud.reiniciar(); hud.mostrar(true); mostrar("");
    modo = "juego";
    juego.empezar(0);
    return mapa.notas.length;
  },
  estado() {
    const p = juego.puntaje;
    return p ? { estado: juego.estado, t: juego.tiempo(), puntos: p.puntos, combo: p.combo, cortes: p.cortes, perdidos: p.perdidos,
      malos: p.malos, energia: p.energia, total: juego.notas.length, stats: juego.estadisticas } : { estado: juego.estado };
  },
  congelar(v) { congelado = v; },
  paso(dt, ahora) { unCuadro(dt, ahora); },
  /** Juega `seg` segundos de canción en tiempo simulado, sin dibujar: la
   *  lógica entera (bot, cortes, puntaje) a toda velocidad. */
  simular(seg, dt = 1 / 60) {
    const J = juego;
    let ahora = (window.__ahoraSim || 5000);
    const fin = J.relojManual + seg;
    while (J.relojManual < fin && (J.estado === "jugando")) { J.relojManual += dt; ahora += dt; unCuadro(dt, ahora, false); }
    window.__ahoraSim = ahora;
    return this.estado();
  },
  listo: false,
};

requestAnimationFrame(cuadro);
listo();
window.__TAJO.listo = true;
