// El cableado: pantallas, el mando, el bucle y la elección de mejoras.

import { Mundo } from "./mundo.js";
import { ETAPAS } from "./bichos.js";
import { ARMAS, EVOLUCIONES } from "./armas.js";
import { Pantalla } from "./dibujo.js";
import { Ruido } from "./audio.js";
import * as G from "./guardado.js";
import * as I from "./idioma.js";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const pantalla = new Pantalla($("#lienzo"));
const ruido = new Ruido();
let mundo = null, corriendo = false, anterior = 0, resto = 0;

const PANTALLAS = { idioma: "#pIdioma", menu: "#pMenu", etapas: "#pEtapas", como: "#pComo",
                    ajustes: "#pAjustes", juego: "#pJuego", mejora: "#pMejora", fin: "#pFin" };
let etapaActual = 1;
function ir(n) {
  for (const [k, sel] of Object.entries(PANTALLAS)) $(sel).classList.toggle("on", k === n);
  if (n === "menu") pintarMenu();
  if (n === "etapas") pintarEtapas();
  if (n === "ajustes") pintarAjustes();
}
$$("[data-ir]").forEach((b) => b.addEventListener("click", () => { if (corriendo) salir(); ir(b.dataset.ir); }));

// ── idioma ─────────────────────────────────────────────────────────────────
for (const [cod, nom] of Object.entries(I.IDIOMAS)) {
  const b = document.createElement("button");
  b.innerHTML = `<b style="opacity:.55;font-size:12px;margin-right:9px">${cod.toUpperCase()}</b>${nom}`;
  b.addEventListener("click", () => { I.elegir(cod); ir("menu"); });
  $("#listaIdiomas").appendChild(b);
}

const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function pintarMenu() {
  const d = G.cargar();
  const hechas = Object.values(d.etapas).filter((e) => e.hecha).length;
  $("#menuMejor").textContent = d.partidas
    ? `${I.t("etapas.hecha")} ${hechas}/${ETAPAS.length} · ${d.partidas} ${I.t("fin.etapa").toLowerCase()}s`
    : I.t("menu.nunca");
}

function pintarEtapas() {
  const abiertas = G.abiertas();
  const cont = $("#listaEtapas");
  cont.innerHTML = "";
  for (const e of ETAPAS) {
    const m = G.marca(e.id);
    const cerrada = e.id > abiertas;
    const [nom, desc] = I.etapa(e.nombre);
    const b = document.createElement("button");
    b.className = "etapa" + (cerrada ? " cerrada" : "") + (m?.hecha ? " hecha" : "");
    b.style.setProperty("--tono", e.borde);
    b.innerHTML = `<div class="n">${e.id}</div><div>
      <div class="t">${nom}${m?.hecha ? " <em>✓</em>" : ""}</div>
      <div class="d">${cerrada ? I.t("etapas.cerrada") : desc}</div>
      <div class="s">${cerrada ? "" : (m ? `${I.t("etapas.mejor")} ${reloj(m.mejorTiempo)} · ${m.mejorMatados} ☠` : `${Math.round(e.largo / 60)}:${String(e.largo % 60).padStart(2, "0")}`)}</div>
    </div>`;
    if (!cerrada) b.addEventListener("click", () => empezar(e.id));
    cont.appendChild(b);
  }
}
function pintarAjustes() {
  $("#ajSonido").classList.toggle("no", !G.ajustes().sonido);
  const c = $("#ajIdioma");
  if (!c.children.length) for (const cod of Object.keys(I.IDIOMAS)) {
    const b = document.createElement("button");
    b.textContent = cod.toUpperCase();
    b.addEventListener("click", () => { I.elegir(cod); pintarAjustes(); pintarMenu(); });
    c.appendChild(b);
  }
  [...c.children].forEach((b) => b.classList.toggle("el", b.textContent.toLowerCase() === I.idioma()));
}
$("#ajSonido").addEventListener("click", () => {
  const a = G.ajustes(); a.sonido = !a.sonido; ruido.vol = a.sonido ? 1 : 0; G.guardar(); pintarAjustes();
});
let armadoBorrar = 0;
$("#bBorrar").addEventListener("click", (e) => {
  if (Date.now() - armadoBorrar < 4000) { G.borrarTodo(); armadoBorrar = 0; I.aplicar(); ir("menu"); return; }
  armadoBorrar = Date.now();
  e.target.textContent = I.t("aj.seguro");
  setTimeout(() => { if (Date.now() - armadoBorrar >= 4000) e.target.textContent = I.t("aj.borrar"); }, 4100);
});
$("#bJugar").addEventListener("click", () => ir("etapas"));
$("#bComo").addEventListener("click", () => ir("como"));
$("#bAjustes").addEventListener("click", () => ir("ajustes"));

/* ── EL MANDO NACE DONDE APOYAS EL DEDO ───────────────────────────────────
   Un joystick clavado en una esquina obliga a mirar el pulgar en vez de la
   pantalla, y en un teléfono grande ni se llega. Acá el centro es donde
   apoyaste: se juega sin mirarse la mano. */
const mando = { activo: false, ox: 0, oy: 0, x: 0, y: 0, radio: 54, dedo: null };
function tomar(e) {
  if (!corriendo) return;
  mando.activo = true; mando.dedo = e.pointerId;
  mando.ox = mando.x = e.clientX; mando.oy = mando.y = e.clientY;
  ruido.despertar();
}
function mover(e) {
  if (!mando.activo || e.pointerId !== mando.dedo) return;
  mando.x = e.clientX; mando.y = e.clientY;
  const dx = mando.x - mando.ox, dy = mando.y - mando.oy;
  const d = Math.hypot(dx, dy);
  // si el dedo se va lejos, el centro lo SIGUE: si no, arrastrar de más deja
  // el mando pegado al tope y girar se vuelve pelearle a un borde invisible
  if (d > mando.radio) {
    mando.ox += (dx / d) * (d - mando.radio);
    mando.oy += (dy / d) * (d - mando.radio);
  }
}
function soltar(e) { if (e.pointerId === mando.dedo) { mando.activo = false; mando.dedo = null; } }
$("#zona").addEventListener("pointerdown", (e) => { e.preventDefault(); tomar(e); });
$("#zona").addEventListener("pointermove", mover);
for (const ev of ["pointerup", "pointercancel", "pointerleave"]) $("#zona").addEventListener(ev, soltar);

/* EL ENVION TIENE SU PROPIO BOTON Y NO UN DOBLE TOQUE.
   Un doble toque compite con el movimiento: apoyar y soltar rápido para
   corregir el rumbo lo dispararía sin querer, y gastarlo por accidente es
   peor que no tenerlo. El botón está donde cae el pulgar derecho y por encima
   de la zona de movimiento. */
$("#bEnvion").addEventListener("pointerdown", (e) => {
  e.preventDefault(); e.stopPropagation();
  if (corriendo && mundo) mundo.lanzarEnvion();
});
addEventListener("keydown", (e) => { if (e.code === "Space" && corriendo && mundo) { e.preventDefault(); mundo.lanzarEnvion(); } });

const direccion = () => {
  if (!mando.activo) return { x: 0, y: 0 };
  const dx = mando.x - mando.ox, dy = mando.y - mando.oy, d = Math.hypot(dx, dy);
  if (d < 6) return { x: 0, y: 0 };
  const k = Math.min(1, d / mando.radio);
  return { x: (dx / d) * k, y: (dy / d) * k };
};
// teclado, para la computadora
const teclas = new Set();
addEventListener("keydown", (e) => { teclas.add(e.code); });
addEventListener("keyup", (e) => { teclas.delete(e.code); });
const porTeclado = () => {
  let x = 0, y = 0;
  if (teclas.has("KeyA") || teclas.has("ArrowLeft")) x -= 1;
  if (teclas.has("KeyD") || teclas.has("ArrowRight")) x += 1;
  if (teclas.has("KeyW") || teclas.has("ArrowUp")) y -= 1;
  if (teclas.has("KeyS") || teclas.has("ArrowDown")) y += 1;
  const m = Math.hypot(x, y);
  return m ? { x: x / m, y: y / m } : null;
};

// ── la partida ─────────────────────────────────────────────────────────────
function empezar(etapa, semilla) {
  ruido.despertar();
  ruido.vol = G.ajustes().sonido ? 1 : 0;
  etapaActual = etapa ?? etapaActual;
  mundo = new Mundo(semilla ?? ((Math.random() * 1e9) | 0), etapaActual);
  pantalla.marcas.length = 0;
  pantalla.medir();
  pantalla.numeros.length = 0; pantalla.trozos.length = 0; pantalla.sacudida = 0;
  mando.activo = false;
  ir("juego");
  corriendo = true; anterior = performance.now(); resto = 0;
  requestAnimationFrame(cuadro);
}
function salir() { corriendo = false; }

/* EL PASO DE SIMULACION ES FIJO, y el dibujo va a la velocidad que pueda.
   Con un paso variable, un teléfono lento simula saltos grandes: los bichos
   atraviesan al jugador sin tocarlo y los tiros pasan de largo. Peor todavía,
   la partida sale distinta según el teléfono, y entonces el balance medido con
   el robot no dice nada. Acá se acumula el tiempo real y se dan pasos de 1/60
   hasta gastarlo; si el cuadro fue larguísimo, se descartan los que sobran en
   vez de intentar ponerse al día, que es como se entra en una espiral. */
const PASO = 1 / 60;
function cuadro(ahora) {
  if (!corriendo) return;
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.25, (ahora - anterior) / 1000);
  anterior = ahora;
  resto += dt;
  let vueltas = 0;
  const dir = porTeclado() || direccion();
  while (resto >= PASO && vueltas < 5) { mundo.avanzar(PASO, dir); resto -= PASO; vueltas++; sonarGolpes(); }
  if (resto > PASO * 5) resto = 0;

  pantalla.dibujar(mundo, dt, mando);
  hud();

  if (mundo.pendienteMejora > 0) { mostrarMejoras(); return; }
  if (mundo.terminada()) terminar();
}

function sonarGolpes() {
  for (const g of mundo.golpes) {
    if (g.que === "tiro") ruido.tiro();
    else if (g.que === "pega") { ruido.pega(); pantalla.numero(g.x, g.y - 12, Math.round(g.cuanto), "#ffe066"); }
    else if (g.que === "muere") {
      ruido.muere();
      pantalla.estallar(g.x, g.y, g.jefe ? "#c264e0" : "#8ad06a", g.jefe ? 60 : 7);
      if (g.jefe) pantalla.sacudir(12);
    } else if (g.que === "gema") ruido.gema();
    else if (g.que === "onda") ruido.onda();
    else if (g.que === "jugador") { ruido.golpe(); pantalla.sacudir(7); }
  }
}

function hud() {
  const p = mundo.jugador;
  $("#hudReloj").textContent = reloj(Math.max(0, mundo.largo - mundo.t));
  $("#hudNivel").textContent = p.nivel;
  $("#hudMatados").textContent = mundo.matados;
}

// ── elegir mejora ──────────────────────────────────────────────────────────
function mostrarMejoras() {
  corriendo = false;
  ruido.nivel();
  const ofertas = mundo.ofertas();
  const cont = $("#tarjetas");
  cont.innerHTML = "";
  $("#mejNivel").textContent = mundo.jugador.nivel;
  for (const o of ofertas) {
    let nom, desc, color, etiqueta;
    if (o.clase === "evolucion") {
      [nom, desc] = I.evolucion(o.en);
      color = EVOLUCIONES[o.en].color;
      etiqueta = `<em class="evo">${I.t("mej.evolucion")}</em>`;
    } else if (o.clase === "arma") {
      [nom, desc] = I.arma(o.nombre); color = ARMAS[o.nombre].color;
    } else if (o.clase === "curar") {
      nom = "+40"; desc = ""; color = "#3ce06a";
    } else {
      [nom, desc] = I.pasiva(o.nombre); color = "#7cf6ff";
    }
    const b = document.createElement("button");
    b.className = "tarjeta" + (o.nueva ? " nueva" : "") + (o.clase === "evolucion" ? " evolucion" : "");
    /* LOS DOS TEXTOS VAN ADENTRO DE UN SOLO HIJO.
       La tarjeta es una grilla de dos columnas —el cuadradito de color y el
       texto—, y acá había TRES hijos: el cuadradito, el título y la
       descripción. El tercero se iba a la fila de abajo y caía en la primera
       columna, la de 14 píxeles: la descripción salía partida en una palabra
       por renglón. Se veía como un problema de estilo y era de estructura. */
    /* LOS DOS TEXTOS VAN ADENTRO DE UN SOLO HIJO.
       La tarjeta es una grilla de dos columnas —el cuadradito y el texto— y acá
       había TRES hijos: el tercero se iba a la fila de abajo y caía en la
       columna de 14 píxeles, así que la descripción salía partida en una
       palabra por renglón. Parecía un problema de estilo y era de estructura. */
    const marca = etiqueta || (o.nueva ? `<em>${I.t("mej.nueva")}</em>`
                  : (o.nivel ? `<b>${I.t("mej.nivel")} ${o.nivel}</b>` : ""));
    b.innerHTML = `<i style="background:${color}"></i><div>` +
      `<div class="t">${nom} ${marca}</div>` +
      `<div class="d">${desc}</div></div>`;
    b.addEventListener("click", () => {
      mundo.elegir(o);
      if (mundo.pendienteMejora > 0) { mostrarMejoras(); return; }
      ir("juego"); corriendo = true; anterior = performance.now(); resto = 0;
      requestAnimationFrame(cuadro);
    });
    cont.appendChild(b);
  }
  ir("mejora");
}

function terminar() {
  corriendo = false;
  ruido.fin();
  const r = { gano: mundo.gano, t: mundo.t, matados: mundo.matados, nivel: mundo.jugador.nivel };
  const nuevos = G.anotar(etapaActual, r);
  $("#finTitulo").dataset.t = r.gano ? "fin.gano" : "fin.perdio";
  $("#finTitulo").textContent = I.t(r.gano ? "fin.gano" : "fin.perdio");
  $("#finTiempo").textContent = reloj(r.t);
  $("#finMatados").textContent = r.matados;
  $("#finNivel").textContent = r.nivel;
  $("#finRecord").classList.toggle("on", nuevos.tiempo || nuevos.matados || nuevos.nivel);
  $("#finEtapa").textContent = I.etapa(mundo.etapa.nombre)[0];
  ir("fin");
}
$("#bSalir").addEventListener("click", () => { salir(); ir("etapas"); });
$("#bOtra").addEventListener("click", () => empezar(etapaActual));

addEventListener("resize", () => pantalla.medir());
addEventListener("visibilitychange", () => { if (document.hidden && corriendo) { salir(); ir("menu"); } });

I.aplicar();
ir(G.ajustes().idioma ? "menu" : "idioma");

// La sonda de las pruebas: el mismo camino que el dedo.
window.__enjambre = {
  ir, empezar, salir,
  pantallaActual: () => Object.entries(PANTALLAS).find(([, s]) => $(s).classList.contains("on"))?.[0],
  estado: () => mundo && { t: mundo.t, etapa: mundo.etapa.id, bichos: mundo.bichos.length,
                           matados: mundo.matados, nivel: mundo.jugador.nivel, vida: mundo.jugador.vida,
                           pendiente: mundo.pendienteMejora, terminada: mundo.terminada(),
                           armas: { ...mundo.jugador.armas },
                           evos: { ...mundo.jugador.evolucionadas }, pico: mundo.picoBichos },
  mundo: () => mundo,
  /** Juega sola, para medir. Devuelve el resultado. */
  robot(segundos = 20) {
    if (!mundo) return null;
    const piloto = () => {
      const p = mundo.jugador, b = mundo.masCercano(p.x, p.y, 400);
      let x = 0, y = 0;
      if (b) { const d = Math.hypot(b.x - p.x, b.y - p.y) || 1; x = -(b.x - p.x) / d; y = -(b.y - p.y) / d; }
      const a = Math.atan2(p.y, p.x); x += -Math.sin(a) * .7; y += Math.cos(a) * .7;
      const dc = Math.hypot(p.x, p.y);
      if (dc > mundo.radioMapa * .85) { x -= p.x / dc; y -= p.y / dc; }
      if (b && Math.hypot(b.x - p.x, b.y - p.y) < 60) mundo.lanzarEnvion();
      const m = Math.hypot(x, y) || 1; return { x: x / m, y: y / m };
    };
    const hasta = mundo.t + segundos;
    while (!mundo.terminada() && mundo.t < hasta) {
      if (mundo.pendienteMejora > 0) { mundo.elegir(mundo.ofertas()[0]); continue; }
      mundo.avanzar(PASO, piloto());
    }
    return window.__enjambre.estado();
  },
};
