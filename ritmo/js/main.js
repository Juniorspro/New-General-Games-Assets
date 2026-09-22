// El cableado: pantallas, menú, calibración y el bucle de la partida.

import { CANCIONES } from "./compositor.js";
import { carta, CARRILES } from "./carta.js";
import { Banda } from "./sonido.js";
import { Partida } from "./juego.js";
import { Pantalla } from "./dibujo.js";
import * as G from "./guardado.js";
import * as I from "./idioma.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const banda = new Banda();
const pantalla = new Pantalla($("#lienzo"));
let partida = null, corriendo = false, idActual = 1;
const apretados = new Array(CARRILES).fill(false);   // CARRILES sale de carta.js
let juicioVisible = null, bombos = [], iBombo = 0, ultimoBombo = -9, tPrimera = 0;

// ── pantallas ──────────────────────────────────────────────────────────────
const PANTALLAS = { idioma: "#pIdioma", menu: "#pMenu", lista: "#pLista", ajustes: "#pAjustes",
                    calibrar: "#pCalibrar", como: "#pComo", juego: "#pJuego", fin: "#pFin" };
function ir(nombre) {
  for (const [n, sel] of Object.entries(PANTALLAS)) $(sel).classList.toggle("on", n === nombre);
  if (nombre === "lista") pintarLista();
  if (nombre === "ajustes") pintarAjustes();
  if (nombre === "calibrar") arrancarCalibracion();
  else pararCalibracion();
}
$$("[data-ir]").forEach((b) => b.addEventListener("click", () => { if (corriendo) salir(); ir(b.dataset.ir); }));

// ── idioma ─────────────────────────────────────────────────────────────────
for (const [cod, nom] of Object.entries(I.IDIOMAS)) {
  const b = document.createElement("button");
  b.innerHTML = `<b style="opacity:.55;font-size:12px;margin-right:9px">${cod.toUpperCase()}</b>${nom}`;
  b.addEventListener("click", () => { I.elegir(cod); ir("menu"); });
  $("#listaIdiomas").appendChild(b);
}

// ── menú ───────────────────────────────────────────────────────────────────
// Las barras del ecualizador, con retardos distintos para que no latan juntas.
for (let i = 0; i < 14; i++) {
  const b = document.createElement("i");
  b.style.animationDelay = `${(i % 5) * 0.13 + (i % 3) * 0.07}s`;
  b.style.animationDuration = `${0.75 + (i % 4) * 0.19}s`;
  $("#ecu").appendChild(b);
}
$("#bJugar").addEventListener("click", () => ir("lista"));
$("#bComo").addEventListener("click", () => ir("como"));
$("#bAjustes").addEventListener("click", () => ir("ajustes"));

// ── lista de canciones ─────────────────────────────────────────────────────
function pintarLista() {
  const abiertas = G.desbloqueadas();
  const cont = $("#pistas");
  cont.innerHTML = "";
  for (const c of CANCIONES) {
    const m = G.marca(c.id);
    const cerrada = c.id > abiertas;
    const b = document.createElement("button");
    b.className = "pista" + (cerrada ? " cerrada" : "");
    const dif = [...Array(5)].map((_, i) => `<i class="${i <= c.dificultad ? "on" : ""}"></i>`).join("");
    const sub = cerrada ? I.t("lista.cerrada")
      : m ? `${I.t("lista.mejor")} ${m.puntos.toLocaleString()} · ${Math.round(m.precision * 100)}%${m.limpia ? " · " + I.t("lista.limpia") : ""}`
          : `${c.bpm} BPM`;
    b.innerHTML = `<div class="n">${c.id}</div>
      <div><div class="t">${I.nombreCancion(c.id)}</div><div class="s">${sub}</div>
      <div class="dif">${dif}</div></div>
      <div class="e">${cerrada ? "🔒" : "★".repeat(m?.estrellas || 0) + "☆".repeat(3 - (m?.estrellas || 0))}</div>`;
    if (!cerrada) b.addEventListener("click", () => empezar(c.id));
    cont.appendChild(b);
  }
}

// ── ajustes ────────────────────────────────────────────────────────────────
function pintarAjustes() {
  const a = G.ajustes();
  $("#ajMusica").classList.toggle("no", !a.musica);
  $("#ajEfectos").classList.toggle("no", !a.efectos);
  $$("#ajAnticipo button").forEach((b) => b.classList.toggle("el", +b.dataset.v === a.anticipo));
  $("#ajDesfaseVal").textContent = `${Math.round(a.desfase * 1000)} ms`;
  const ci = $("#ajIdioma");
  if (!ci.children.length) {
    for (const cod of Object.keys(I.IDIOMAS)) {
      const b = document.createElement("button");
      b.textContent = cod.toUpperCase();
      b.addEventListener("click", () => { I.elegir(cod); pintarAjustes(); });
      ci.appendChild(b);
    }
  }
  [...ci.children].forEach((b) => b.classList.toggle("el", b.textContent.toLowerCase() === I.idioma()));
}
$("#ajMusica").addEventListener("click", () => { const a = G.ajustes(); a.musica = !a.musica; banda.volMusica = a.musica ? 1 : 0; G.guardar(); pintarAjustes(); });
$("#ajEfectos").addEventListener("click", () => { const a = G.ajustes(); a.efectos = !a.efectos; banda.volEfectos = a.efectos ? 1 : 0; G.guardar(); pintarAjustes(); });
$$("#ajAnticipo button").forEach((b) => b.addEventListener("click", () => { G.ajustes().anticipo = +b.dataset.v; G.guardar(); pintarAjustes(); }));
$("#bCalibrar").addEventListener("click", () => ir("calibrar"));
// EL BORRAR PIDE DOS TOQUES Y NO UN CARTEL. Un `confirm()` bloquea el hilo y en
// algunos teléfonos sale como un aviso de página sospechosa; dos toques con el
// texto cambiado se entiende igual y no frena nada.
let armadoBorrar = 0;
$("#bBorrar").addEventListener("click", (e) => {
  if (Date.now() - armadoBorrar < 4000) { G.borrarTodo(); armadoBorrar = 0; I.aplicar(); ir("menu"); return; }
  armadoBorrar = Date.now();
  e.target.textContent = I.t("aj.seguro");
  setTimeout(() => { if (Date.now() - armadoBorrar >= 4000) e.target.textContent = I.t("aj.borrar"); }, 4100);
});

// ── calibración ────────────────────────────────────────────────────────────
/* POR QUE SE CALIBRA A MANO. Entre que el navegador dice que un sonido salió y
   el oído lo recibe hay un camino que nadie informa: los auriculares por
   Bluetooth agregan entre 100 y 300 ms, y `outputLatency` no los ve. Sin esto,
   con Bluetooth el juego se siente roto y la culpa parece del jugador.
   Se usa la MEDIANA de los toques y no el promedio: uno que se distrae y toca
   medio segundo tarde corre el promedio entero, y la mediana ni se entera. */
let cal = null;
function arrancarCalibracion() {
  banda.despertar();
  const PASO = 0.5, CUANTOS = 12;
  cal = { paso: PASO, cuantos: CUANTOS, tocados: [], t0: 0, timer: 0, agendado: 0 };
  if (!banda.AC) return;
  cal.t0 = banda.AC.currentTime + 0.6;
  $("#calFaltan").textContent = CUANTOS;
  $("#calValor").textContent = "—";
  $("#bCalUsar").disabled = true;
  const latir = () => {
    if (!cal) return;
    cal.timer = requestAnimationFrame(latir);
    const ahora = banda.AC.currentTime;
    while (cal.agendado < 400 && cal.t0 + cal.agendado * PASO < ahora + 0.25) {
      banda.tocar({ tipo: "hihat", vel: 1.6 }, cal.t0 + cal.agendado * PASO);
      cal.agendado++;
    }
    const fase = (ahora - cal.t0) % PASO;
    $("#calCirculo").classList.toggle("late", fase < 0.12);
  };
  latir();
}
function pararCalibracion() { if (cal) { cancelAnimationFrame(cal.timer); cal = null; } }
$("#pCalibrar").addEventListener("pointerdown", (e) => {
  if (!cal || !banda.AC || e.target.closest("button")) return;
  const t = banda.AC.currentTime - banda.latencia();
  const k = Math.round((t - cal.t0) / cal.paso);
  const dt = t - (cal.t0 + k * cal.paso);
  if (Math.abs(dt) > cal.paso / 2) return;
  cal.tocados.push(dt);
  $("#calFaltan").textContent = Math.max(0, cal.cuantos - cal.tocados.length);
  if (cal.tocados.length >= cal.cuantos) {
    const o = [...cal.tocados].sort((a, b) => a - b);
    cal.resultado = o[o.length >> 1];
    $("#calValor").textContent = `${Math.round(cal.resultado * 1000)} ms`;
    $("#bCalUsar").disabled = false;
  }
});
$("#bCalUsar").addEventListener("click", () => {
  if (cal && cal.resultado !== undefined) { G.ajustes().desfase = cal.resultado; G.guardar(); }
  ir("ajustes");
});

// ── la partida ─────────────────────────────────────────────────────────────
function empezar(id) {
  idActual = id;
  const a = G.ajustes();
  banda.volMusica = a.musica ? 1 : 0;
  banda.volEfectos = a.efectos ? 1 : 0;
  partida = new Partida(id);
  pantalla.medir();
  const c = CANCIONES.find((x) => x.id === id);
  // Un respiro y nada más: los dos compases de intro YA son la cuenta regresiva,
  // y sumarle cuatro tiempos de silencio arriba es hacer esperar dos veces.
  const entrada = 0.9;
  tPrimera = partida.notas.length ? partida.notas[0].t : 0;
  bombos = partida.tema.eventos.filter((e) => e.tipo === "bombo").map((e) => e.t);
  iBombo = 0; ultimoBombo = -9;
  juicioVisible = null;
  apretados.fill(false);
  $("#hudCancion").textContent = I.nombreCancion(id);
  $("#hudPuntos").textContent = "0";
  ir("juego");
  banda.arrancar(partida.tema.eventos, a.desfase, entrada);
  corriendo = true;
  requestAnimationFrame(cuadro);
}

function salir() {
  corriendo = false;
  banda.parar();
}

function cuadro() {
  if (!corriendo) return;
  requestAnimationFrame(cuadro);
  banda.agendar();
  const t = banda.tiempo();
  partida.avanzar(t);

  while (iBombo < bombos.length && bombos[iBombo] <= t) ultimoBombo = bombos[iBombo++];
  const pulso = Math.max(0, 1 - (t - ultimoBombo) / 0.3);
  // El latido es la fase del tiempo musical, de 0 a 1 en cada negra. Los anillos
  // del fondo salen de acá y no del bombo: el bombo se saltea tiempos, y un
  // fondo que late salteado se siente descompuesto.
  const porTiempo = 60 / CANCIONES.find((x) => x.id === idActual).bpm;
  const latido = t > 0 ? (t / porTiempo) % 1 : 0;

  pantalla.dibujar(partida, t, {
    anticipo: G.ajustes().anticipo, pulso, latido, apretados, juicio: juicioVisible,
    vida: partida.vida, progreso: t / partida.tema.duracion,
  });
  $("#hudPuntos").textContent = partida.puntos.toLocaleString();

  /* LA CUENTA VA HASTA LA PRIMERA NOTA, no hasta el compás cero.
     Contando hasta el arranque de la música quedaban cinco segundos de intro
     sin ningún cartel: se ve igual que un juego colgado. */
  const cuenta = $("#cuenta");
  const pulso1 = 60 / CANCIONES.find((x) => x.id === idActual).bpm;
  const faltan = tPrimera - t;
  if (faltan > 0 && faltan < pulso1 * 8.5) {
    const n = Math.ceil(faltan / pulso1);
    cuenta.textContent = n <= 1 ? I.t("cuenta.listo") : String(Math.min(8, n - 1));
  } else if (cuenta.textContent) cuenta.textContent = "";

  if (partida.terminada) terminar();
}

function terminar() {
  corriendo = false;
  banda.parar();
  const r = { puntos: partida.puntos, precision: partida.precision(),
              estrellas: partida.estrellas(), limpia: partida.limpia() };
  /* PERDER NO DEJA MARCA. El puntaje de media canción no se puede comparar con
     el de una entera, y guardarlo abriría la siguiente con una pasada que ni
     terminó. */
  const record = partida.perdio ? false : G.anotarMarca(idActual, r);
  $("#finEstrellas").textContent = "★".repeat(r.estrellas) + "☆".repeat(3 - r.estrellas);
  $("#finPuntos").textContent = r.puntos.toLocaleString();
  $("#finPrecision").textContent = Math.round(r.precision * 100) + "%";
  $("#finRacha").textContent = partida.mejorCombo;
  $("#finP").textContent = partida.cuenta.perfecto;
  $("#finB").textContent = partida.cuenta.bien;
  $("#finR").textContent = partida.cuenta.rozo;
  $("#finE").textContent = partida.cuenta.error;
  $("#finLimpia").classList.toggle("on", r.limpia && !partida.perdio);
  $("#finPerdiste").classList.toggle("on", partida.perdio);
  $("#finRecord").classList.toggle("on", record && !partida.perdio);
  $("#bSiguiente").style.display = idActual < 9 && r.estrellas >= 1 ? "" : "none";
  ir("fin");
}

$("#bSalir").addEventListener("click", () => { salir(); ir("lista"); });
$("#bOtra").addEventListener("click", () => empezar(idActual));
$("#bALista").addEventListener("click", () => ir("lista"));
$("#bSiguiente").addEventListener("click", () => empezar(Math.min(9, idActual + 1)));

// ── los toques ─────────────────────────────────────────────────────────────
/* UN DEDO POR CARRIL, SEGUIDO POR pointerId. Con un solo booleano por carril,
   apoyar dos dedos y levantar uno apaga el carril del otro: en las canciones
   con notas dobles eso suelta una sostenida que todavía se estaba manteniendo. */
const dedos = new Map();
function apretar(c, id) {
  if (!corriendo) return;
  apretados[c] = true;
  dedos.set(id, c);
  const j = partida.tocar(c, banda.tiempo());
  if (j) {
    juicioVisible = { clase: j.clase, texto: I.t("j." + j.clase), t: j.t };
    pantalla.chispear(c, j.clase);
    if (j.clase === "perfecto") banda.acierto(1);
    else if (j.clase === "bien") banda.acierto(.5);
    else banda.acierto(0);
  }
}
function largar(c, id) {
  dedos.delete(id);
  if (![...dedos.values()].includes(c)) apretados[c] = false;
  if (corriendo) partida.soltar(c, banda.tiempo());
}
$$("#zonas div").forEach((z) => {
  const c = +z.dataset.c;
  z.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    apretar(c, e.pointerId);
    /* LA CAPTURA VA DESPUES DEL TOQUE Y ENVUELTA. Sirve para que, si el dedo se
       corre fuera del carril mientras mantiene una nota larga, el `pointerup`
       llegue igual acá y la sostenida se cierre donde corresponde. Pero
       `setPointerCapture` TIRA EXCEPCION si el puntero ya no está activo, y
       estando antes del registro se llevaba puesta la nota entera: el toque no
       se contaba y la nota se marcaba como error. Se veía como un juego que no
       responde, y la causa era una línea que ni siquiera hace falta que
       funcione. */
    try { z.setPointerCapture?.(e.pointerId); } catch (_) {}
  });
  for (const ev of ["pointerup", "pointercancel"])
    z.addEventListener(ev, (e) => largar(c, e.pointerId));
});

// Teclado, para la computadora. D F J es donde caen los dedos sin mirar.
const TECLAS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3,
                 Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
                 ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
addEventListener("keydown", (e) => {
  const c = TECLAS[e.code];
  if (c === undefined || e.repeat) return;
  e.preventDefault(); apretar(c, "t" + c);
});
addEventListener("keyup", (e) => { const c = TECLAS[e.code]; if (c !== undefined) largar(c, "t" + c); });

addEventListener("resize", () => pantalla.medir());
// Volver de otra pestaña con la canción a medio sonar deja el reloj corrido:
// la música siguió y el dibujo no. Se corta y se vuelve a la lista.
addEventListener("visibilitychange", () => { if (document.hidden && corriendo) { salir(); ir("lista"); } });

// ── arranque ───────────────────────────────────────────────────────────────
I.aplicar();
ir(G.ajustes().idioma ? "menu" : "idioma");

// La sonda de las pruebas: toca por el mismo camino que el dedo.
window.__ritmo = {
  ir, empezar, salir,
  pantallaActual: () => Object.entries(PANTALLAS).find(([, s]) => $(s).classList.contains("on"))?.[0],
  estado: () => partida && { puntos: partida.puntos, combo: partida.combo, precision: partida.precision(),
                             cuenta: { ...partida.cuenta }, terminada: partida.terminada,
                             notas: partida.notas.length, juzgadas: partida.juzgadas() },
  tiempo: () => banda.tiempo(),
  carta: () => partida.notas.map((n) => ({ t: n.t, carril: n.carril, largo: n.largo })),
  /** Cuánto cuesta un cuadro, de verdad.
   *
   *  CON UN getImageData AL FINAL, Y NO SIN EL. Las llamadas de dibujo se
   *  encolan: `performance.now()` alrededor de un `drawImage` mide lo que tardó
   *  en ANOTARLO, no en pintarlo, y da números ridículos como 0,1 ms en una
   *  pantalla que va a 40 cuadros. Leer un píxel obliga al navegador a terminar
   *  de rasterizar todo lo pendiente, así que recién ahí el reloj mide el
   *  trabajo completo. */
  medirDibujo(veces = 60) {
    const ctx = $("#lienzo").getContext("2d");
    const opciones = { anticipo: 1.1, pulso: 1, apretados: [true, false, true, false], juicio: null, vida: 0.7, progreso: 0.5, latido: 0.3 };
    const tomar = (hacer) => {
      const ms = [];
      for (let k = 0; k < veces; k++) {
        const t = partida.tema.duracion * (0.25 + 0.5 * (k / veces));
        const a = performance.now();
        hacer(t);
        ctx.getImageData(0, 0, 1, 1);
        ms.push(performance.now() - a);
      }
      ms.sort((x, y) => x - y);
      return { mediana: ms[ms.length >> 1], peor: ms[ms.length - 1] };
    };
    /* SE MIDE LA LINEA DE BASE Y SE RESTA.
       El `getImageData` obliga a terminar de rasterizar, que es lo único que
       hace que el número signifique algo — pero ese vaciado CUESTA por sí solo,
       y cuesta más cuanto más grande es la pantalla. Medido en una tablet: un
       cuadro vacío, que no dibuja nada, ya daba más de 20 ms. Tomar ese número
       como "lo que cuesta dibujar" es acusar al dibujo de lo que hace el
       instrumento. Se mide un cuadro vacío, se mide uno lleno, y lo que importa
       es la diferencia. */
    const base = tomar(() => { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); });
    const lleno = tomar((t) => pantalla.dibujar(partida, t, opciones));
    return {
      base: +base.mediana.toFixed(2),
      total: +lleno.mediana.toFixed(2),
      neto: +(lleno.mediana - base.mediana).toFixed(2),
      peorNeto: +(lleno.peor - base.mediana).toFixed(2),
      notas: partida.notas.length,
    };
  },
  apretar, largar,
  /** Juega la canción entera con la puntería que se le pida, en segundos. */
  robot(error = 0) {
    if (!partida) return null;
    for (const n of partida.notas) {
      const t = n.t + error;
      partida.avanzar(t);
      partida.tocar(n.carril, t);
      if (n.largo) partida.soltar(n.carril, t + n.largo);
    }
    partida.avanzar(partida.tema.duracion + 2);
    return { precision: partida.precision(), estrellas: partida.estrellas(),
             cuenta: { ...partida.cuenta }, puntos: partida.puntos };
  },
};
