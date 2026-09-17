// Arranque, entrada y bucle.

import { VISTA, F, ajustarVista, M } from "./mundo.js";
import { Partida } from "./juego.js";
import { dibujar, registrarTexturas, tramoDe } from "./dibujo.js";
import { crearHeroe, pasoHeroe, registrarArte, dibujarHeroe, ponerSkin } from "./heroe.js";
import { despertar, efe, sonando, arrancarViento, soplar, callarViento, contexto, salida } from "./audio.js";
import * as musica from "./musica.js";
import { cargar, guardar, borrar, sumarMonedas, tiene, comprarConMonedas, ponerse } from "./guardado.js";
import { SKINS, porId, esPaga } from "./skins.js";
import * as compras from "./compras.js";
import { pilotoDedo } from "./piloto.js";
import { ruta } from "./assets.js";
import { t, aplicar, ponerIdioma, idioma, IDIOMAS } from "./idioma.js";

const $ = (s) => document.querySelector(s);

// Despertar el audio ES el momento de conectar la música: antes no hay contexto
// —el navegador no deja crearlo sin un gesto— y después habría que acordarse.
function despertarTodo() {
  despertar();
  musica.conectar(contexto(), salida());
}
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
// Y EL DEDO EN MOVIMIENTO NO CIERRA EL PARAGUAS. Arrastrar es "corrarme" y
// apoyar quieto es "caer rapido"; si arrastrar tambien cerrara, no habria
// forma de maniobrar sin acelerar al triple, que es justo cuando menos se
// maniobra. Se cuentan los cuadros desde el ultimo movimiento: mientras el
// dedo se mueve el paraguas queda abierto, y a los ocho cuadros quieto se
// cierra. Un toque que nunca se movio cierra en el primer cuadro.
//
// La primera version llevaba al personaje HACIA donde estaba el dedo. Tocar
// para cerrar el paraguas —que es lo que hay que hacer todo el tiempo— lo
// mandaba de golpe hasta el dedo, asi que no se podia cerrar sin moverse: el
// gesto de "caer rapido" y el de "correrme" eran el mismo y no se podian
// separar. Ahora al apoyar se toma la posicion como CERO y lo que cuenta es
// cuanto se corrio el dedo desde ahi: apoyar y no mover cierra el paraguas y
// nada mas. El objetivo se arrastra con el dedo pixel a pixel.
lienzo.addEventListener("pointerdown", (ev) => {
  despertarTodo(); arrancarViento();
  const x = aMundo(ev);
  // `quieto` arranca alto y no en cero: un toque que nunca se movio tiene que
  // cerrar ya, no despues de esperar los ocho cuadros.
  dedo = { id: ev.pointerId, x, cero: x, objetivo: partida ? partida.x : x,
           quieto: 999, movio: false };
  try { lienzo.setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
lienzo.addEventListener("pointermove", (ev) => {
  if (!dedo || ev.pointerId !== dedo.id) return;
  const previo = dedo.x;
  dedo.x = aMundo(ev);
  // Medio pixel de umbral: un dedo apoyado quieto igual manda eventos de
  // movimiento por el temblor de la mano, y sin umbral el paraguas no cerraba
  // nunca.
  if (Math.abs(dedo.x - previo) > 0.5) dedo.movio = true;
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
    // Se cuenta acá y no en el evento porque esta función corre una vez por
    // cuadro: el navegador manda varios `pointermove` entre cuadro y cuadro y
    // contarlos ahí daría un tiempo distinto según el aparato.
    if (dedo.movio) { dedo.quieto = 0; dedo.movio = false; } else dedo.quieto++;
    entrada.cerrar = dedo.quieto >= F.QUIETO;
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
  musica.parar();
  musica.arrancarTema();
  if (!demo) arrancarDemo();
  const d = cargar();
  $("#m-mejor").textContent = `${d.mejor} m`;
  $("#m-caidas").textContent = d.partidas === 1 ? t("menu.caidas1") : t("menu.caidas", { n: d.partidas });
  mostrar("p-menu");
}

function jugar() {
  despertarTodo(); arrancarViento();
  musica.pararTema();
  musica.arrancar();
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
$("#m-tienda").addEventListener("click", () => { efe.menu(); aLaTienda(); });

// --- la tienda -----------------------------------------------------------
//
// La vista previa es el MUÑECO DE VERDAD cayendo, dibujado con el mismo código
// que el juego: una foto por skin serían treinta y cuatro imágenes y, peor, se
// desincronizarían con el dibujo el día que alguien toque una línea del rig.
const vista = $("#t-vista");
const vctx = vista.getContext("2d");
let mirando = null, heroeVista = null;
// EL AVISO PISA AL NOMBRE Y DURA HASTA EL PROXIMO TOQUE. Escribirlo directo en
// el elemento no servía: `pintarTienda()` corre después y lo tapa con el nombre
// de la skin, así que "te faltan 12.000" aparecía y desaparecía en el mismo
// cuadro — o sea, no aparecía.
let aviso = "";

function aLaTienda() {
  sincronizarPagas();
  const d = cargar();
  mirando = porId(d.skin);
  heroeVista = crearHeroe(180, 30);
  pintarTienda();
  mostrar("p-tienda");
  // Los precios de las pagas los da la tienda del teléfono, no el código: el
  // precio depende del país y de la moneda, y escribirlo a mano es mostrarle a
  // alguien un número que no es el que va a pagar.
  compras.precios(SKINS.filter(esPaga).map((k) => k.producto)).then((m) => {
    preciosReales = m; pintarTienda();
  });
}
let preciosReales = {};

/**
 * Pasar las compras al inventario.
 *
 * `compras.js` sabe de PRODUCTOS (`paraguas.skin.cromo`) y el inventario sabe de
 * SKINS (`cromo`): el que conoce las dos cosas es el catálogo, así que la
 * traducción vive acá y no adentro del cobro. Sin este paso, comprar una skin
 * paga la marcaba como comprada y `ponerse()` la rechazaba igual —porque mira el
 * inventario— y quedaba pagada y no ponible, que es el peor resultado posible.
 *
 * Corre al arrancar (después de restaurar) y después de cada compra, así que un
 * teléfono nuevo que restaura sus compras las encuentra puestas donde van.
 */
function sincronizarPagas() {
  const d = cargar();
  let cambio = false;
  for (const k of SKINS)
    if (esPaga(k) && compras.pagada(k.producto) && !d.skins[k.id]) { d.skins[k.id] = true; cambio = true; }
  if (cambio) guardar();
}

function pintarTienda() {
  const d = cargar();
  $("#t-monedas").textContent = d.monedas.toLocaleString();
  $("#t-nombre").textContent = aviso || t(`skin.${mirando.id}`);
  $("#t-rango").textContent = t(`rango.${mirando.rango}`);
  $("#t-rango").className = `rango ${mirando.rango}`;
  const g = $("#t-grilla");
  g.innerHTML = "";
  for (const k of SKINS) {
    const b = document.createElement("button");
    const mio = tiene(k.id) || (esPaga(k) && compras.pagada(k.producto));
    b.className = `skin ${k.rango}${mio ? " tengo" : ""}${d.skin === k.id ? " puesta" : ""}`;
    const muestra = document.createElement("span");
    muestra.className = "muestra";
    for (const c of [k.pelo || "#d9b48f", k.bata || "#e9eef7", k.paraguas || "#97ce4c"]) {
      const i = document.createElement("i"); i.style.background = c; muestra.append(i);
    }
    const nombre = document.createElement("span");
    nombre.textContent = t(`skin.${k.id}`);
    const precio = document.createElement("span");
    precio.className = "precio";
    if (mio) precio.textContent = d.skin === k.id ? t("tienda.puesta") : t("tienda.poner");
    else if (esPaga(k)) precio.textContent = preciosReales[k.producto] || t("tienda.paga");
    else {
      precio.textContent = k.precio.toLocaleString();
      if (d.monedas < k.precio) precio.classList.add("caro");
    }
    b.append(muestra, nombre, precio);
    b.addEventListener("click", () => elegirSkin(k));
    g.append(b);
  }
}

function elegirSkin(k) {
  const d = cargar();
  mirando = k;
  aviso = "";
  const mio = tiene(k.id) || (esPaga(k) && compras.pagada(k.producto));
  if (mio) {
    // Ya es tuya: un toque la pone. Sin confirmación, porque no se pierde nada.
    ponerse(k.id); ponerSkin(k.id); efe.hito();
  } else if (esPaga(k)) {
    comprarPaga(k);
  } else if (d.monedas >= k.precio) {
    if (comprarConMonedas(k.id, k.precio)) { ponerse(k.id); ponerSkin(k.id); efe.hito(); }
  } else {
    // NO ALCANZA: se dice CUANTO falta, no "no te alcanza". Es el mismo toque y
    // la diferencia entre un juego que te muestra la meta y uno que te dice que
    // no.
    efe.golpe();
    aviso = t("tienda.falta", { n: (k.precio - d.monedas).toLocaleString() });
  }
  pintarTienda();
}

async function comprarPaga(k) {
  if (!compras.disponible()) {
    // Sin tienda conectada NO se desbloquea nada y no se simula ninguna compra.
    efe.golpe();
    aviso = t("tienda.sin-tienda");
    pintarTienda();
    return;
  }
  const r = await compras.comprar(k.producto);
  if (r.ok) { sincronizarPagas(); ponerse(k.id); ponerSkin(k.id); efe.hito(); aviso = ""; }
  else { efe.golpe(); aviso = t("tienda.sin-tienda"); }
  pintarTienda();
}

$("#t-restaurar").addEventListener("click", async () => {
  efe.menu();
  await compras.restaurar();
  sincronizarPagas();
  pintarTienda();
});

// --- idiomas -------------------------------------------------------------
// Cambiar de idioma reescribe los `data-t` y ADEMAS vuelve a pintar lo que se
// escribe desde JavaScript: el contador de caídas y el nombre del tramo no
// tienen marca en el HTML, así que `aplicar()` no los toca y quedarían en el
// idioma anterior hasta la próxima partida.
function elegir(cod, guardarlo = true) {
  ponerIdioma(cod);
  aplicar();
  $("#m-idioma").textContent = cod.toUpperCase();
  if (guardarlo) { const d = cargar(); d.ajustes.idioma = cod; guardar(); }
}
for (const b of document.querySelectorAll("[data-idioma]"))
  b.addEventListener("click", () => {
    efe.menu();
    elegir(b.dataset.idioma);
    alMenu();
  });
// El botón del menú rota entre los tres. Con tres idiomas una pantalla aparte
// para elegirlos es un clic de más: el que quiere cambiarlo lo ve escrito en el
// botón y lo toca hasta que dice lo suyo.
$("#m-idioma").addEventListener("click", () => {
  const cods = Object.keys(IDIOMAS);
  efe.menu();
  elegir(cods[(cods.indexOf(idioma()) + 1) % cods.length]);
  alMenu();
});
$("#j-salir").addEventListener("click", () => { efe.menu(); alMenu(); });
for (const b of document.querySelectorAll("[data-volver]"))
  b.addEventListener("click", () => { efe.menu(); alMenu(); });
function interruptor(sel, campo, alCambiar) {
  const b = $(sel);
  const pintar = (v) => b.setAttribute("aria-pressed", String(!!v));
  b.addEventListener("click", () => {
    const d = cargar();
    d.ajustes[campo] = !d.ajustes[campo];
    guardar(); pintar(d.ajustes[campo]); alCambiar(d.ajustes[campo]);
  });
  return pintar;
}
const pintarSonido = interruptor("#aj-sonido", "sonido", (v) => { efe.menu(); sonando(v); });
// LA MUSICA SE APAGA APARTE DE LOS EFECTOS. Son dos molestias distintas: la
// música cansa a la décima partida y los efectos no, y el que juega con un
// video de fondo quiere callar la música sin perder el sonido del paraguas —que
// es información, no decoración.
const pintarMusica = interruptor("#aj-musica", "musica", (v) => {
  musica.sonando(v);
  if (v && !partida) musica.arrancarTema();
});
$("#m-borrar").addEventListener("click", () => {
  if (!confirm(t("menu.borrar-confirmar"))) return;
  // BORRAR EL RECORD NO BORRA EL IDIOMA. Está en el mismo bulto guardado, pero
  // volver al inglés porque alguien quiso resetear su puntaje es un castigo que
  // nadie pidió.
  const cod = cargar().ajustes.idioma;
  borrar();
  const nuevo = cargar(); nuevo.ajustes.idioma = cod; guardar();
  alMenu();
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
  poner("#h-tramo", t(tramoDe(p.y).clave));
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
  if (e.golpe) { efe.golpe(); efe.varilla(); }
  if (e.angosto) efe.angosto();
  if (e.pinchos) efe.pinchos();
  if (e.paraguas) (p.objetivo ? efe.abrir() : efe.cerrar());
  if (e.muerto) { efe.muerto(); terminar(p); }
  const hito = Math.floor(p.metros / 100);
  if (hito > ultimoHito) { ultimoHito = hito; efe.hito(); }
  const v = Math.max(0, Math.min(1, (p.vy - F.TERMINAL_ABIERTO) / (F.TERMINAL_CERRADO - F.TERMINAL_ABIERTO)));
  soplar(v);
  // LA MUSICA SIGUE A LA CAIDA, no al reloj. Es la misma idea que el viento: el
  // arpegio se densifica y el filtro se abre cuando caés rápido, así que la
  // música dice a qué velocidad venís sin que haya que mirar un número.
  musica.empujar(v * 0.75 + Math.min(1, p.metros / 900) * 0.25);
}

function terminar(p) {
  const d = cargar();
  const record = p.metros > d.mejor;
  d.mejor = Math.max(d.mejor, p.metros);
  d.mejorMonedas = Math.max(d.mejorMonedas, p.monedas);
  d.partidas++;
  guardar();
  // LA CHATARRA DE LA PARTIDA SE SUMA A LA BILLETERA. Hasta ahora era un número
  // que se miraba y se tiraba; ahora es lo que se gasta en la tienda, así que
  // recogerla pasó de ser un adorno a ser la única razón para desviarse de la
  // línea buena.
  const bolsillo = sumarMonedas(p.monedas);
  $("#f-metros").textContent = `${p.metros} m`;
  $("#f-record").hidden = !record;
  $("#f-lista").innerHTML = "";
  const item = (k, v) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${k}</span><b>${v}</b>`;
    $("#f-lista").append(li);
  };
  item(t("fin.ganaste"), `+${p.monedas} ◆`);
  item(t("tienda.monedas", { n: bolsillo }), "");
  item(t("fin.roces"), p.roces);
  item(t("fin.puntaje"), p.puntaje);
  item(t("fin.mejor"), `${d.mejor} m`);
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
  if (!$("#p-tienda").hidden) pintarVista();
}

/**
 * La vista previa de la tienda.
 *
 * SE LE PONE LA SKIN MIRADA Y SE LA SACA AL SALIR. `heroe.js` guarda UNA skin
 * puesta —la del juego— porque dibujar el muñeco es una sola cosa y tener dos
 * personajes a la vez no pasa nunca. Para la vista previa se la cambia, se
 * dibuja y se la devuelve en el mismo cuadro: si se la dejara puesta, salir de
 * la tienda mirando una skin que no es tuya te la dejaría puesta en el juego.
 */
function pintarVista() {
  const puesta = cargar().skin;
  ponerSkin(mirando ? mirando.id : puesta);
  vctx.clearRect(0, 0, 360, 150);
  pasoHeroe(heroeVista, 180, 30, Math.sin(performance.now() / 700) * 2.2, 6, 1);
  dibujarHeroe(vctx, heroeVista, 180, 30, 1, F.ANCHO_ABIERTO, 0);
  ponerSkin(puesta);
}

// --- arranque ------------------------------------------------------------
const ARTE = ["paraguas_abierto", "paraguas_cerrado", "rilo_cabeza", "rilo_torso",
              "rilo_brazo_alto", "rilo_brazo_bajo", "rilo_pierna_alta", "rilo_pierna_baja",
              // El dibujo propio de las tres skins pagas.
              "pro_cromo_paraguas", "pro_cromo_cabeza",
              "pro_magma_paraguas", "pro_magma_cabeza",
              "pro_vacio_paraguas", "pro_vacio_cabeza"];
const TEXTURAS = ["pared", "repisa", "fondo_pozo"];

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
  pintarSonido(d.ajustes.sonido);
  sonando(d.ajustes.sonido);
  pintarMusica(d.ajustes.musica);
  musica.sonando(d.ajustes.musica);
  // La pantalla de idiomas se muestra UNA vez, la primera. El demo del fondo
  // arranca igual: la primera pantalla del juego también tiene que estar viva.
  elegir(d.ajustes.idioma || "en", false);
  ponerSkin(d.skin);
  // Restaurar compras al arrancar: quien cambió de teléfono ya pagó, y no tiene
  // por qué buscar un botón para que se lo reconozcan.
  compras.restaurar().then(sincronizarPagas).catch(() => {});
  sincronizarPagas();
  if (!demo) arrancarDemo();
  if (d.ajustes.idioma) alMenu();
  else mostrar("p-idioma");
  requestAnimationFrame(bucle);
  window.PARAGUAS = { get partida() { return partida; }, get demoMetros() { return demo?.metros; },
                     jugar, alMenu, entrada, VISTA, F,
                     // La tienda expuesta para las pruebas: es la única forma de
                     // comprobar, por debajo de la interfaz, que sin puente
                     // conectado no se entrega nada.
                     compras };

  const arte = {}, tex = {};
  await Promise.all([
    ...ARTE.map(async (k) => { const im = await traer(ruta(`assets/arte/${k}.webp`)); if (im) arte[k] = im; }),
    ...TEXTURAS.map(async (k) => { const im = await traer(ruta(`assets/arte/${k}.webp`)); if (im) tex[k] = im; }),
  ]);
  if (arte.paraguas_abierto) registrarArte(arte);
  registrarTexturas(tex);
})();

// Un gancho para la prueba de sonido: dispara UN efecto. Los efectos no dejan
// rastro en el DOM ni en el estado, así que la única forma de comprobar que
// siguen sonando con la música apagada es pedir uno y contar los osciladores.
globalThis.__efe = () => efe.menu();
globalThis.__musicaAndando = () => musica.andando();
