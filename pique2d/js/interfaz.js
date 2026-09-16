// Menus, mapa de mundos, HUD y pantallas de resultado.
//
// Todo en DOM, NO en canvas. Un boton dibujado en un canvas parece un boton y
// no lo es: hay que escribirle la deteccion de toque a mano, no lo lee un
// lector de pantalla y no se puede navegar con el teclado. El canvas dibuja el
// juego; la interfaz es HTML.

import { NIVELES, idNivel, TEMAS } from "./mundo.js";
import { cargar, guardar, datosNivel, tierActual, borrarTodo, abierto, abrirSiguiente, indiceNivel, proximoNivel } from "./guardado.js";
import { efe, despertar, volumen } from "./audio.js";
import { ruta } from "./assets.js";

const $ = (s) => document.querySelector(s);
const crear = (tag, clase, texto) => {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
};

export function mostrar(pantalla) {
  for (const p of document.querySelectorAll(".pantalla")) p.hidden = true;
  $("#" + pantalla).hidden = false;
  if (pantalla === "p-inicio") pintarInicio();
}

/**
 * La vitrina del menu: monedas, niveles hechos, monedas de color, y a que
 * nivel entra el boton Jugar.
 *
 * Se repinta cada vez que se vuelve al menu y no una sola vez al arrancar:
 * si no, despues de jugar un nivel el menu sigue mostrando los numeros de
 * antes, que es peor que no mostrarlos.
 */
export function pintarInicio() {
  const d = cargar();
  let hechos = 0, color = 0;
  for (const cfg of NIVELES) {
    const n = datosNivel(idNivel(cfg.m, cfg.n));
    if (n.hecho) hechos++;
    for (const c of ["rosa", "violeta", "negra"]) if (n.color[c]) color++;
  }
  const poner = (sel, txt) => { const e = $(sel); if (e && e.textContent !== txt) e.textContent = txt; };
  poner("#vit-monedas", String(d.monedas ?? 0));
  poner("#vit-niveles", `${hechos}/${NIVELES.length}`);
  poner("#vit-color", `${color}/${NIVELES.length * 3}`);
  const barra = $("#vit-barra");
  if (barra) barra.style.width = `${Math.round((hechos / NIVELES.length) * 100)}%`;
  const ico = $("#ico-vit-moneda");
  if (ico && !ico.src) ico.src = ruta("assets/piezas/icono_moneda.webp");
  // El boton Jugar dice A DONDE entra. "Jugar" solo no distingue empezar de
  // seguir, y despues de tres sesiones uno no se acuerda por donde iba.
  const { m, n } = proximoNivel();
  const cfg = NIVELES.find((c) => c.m === m && c.n === n);
  poner("#bt-jugar-txt", hechos ? "Seguir" : "Jugar");
  poner("#bt-jugar-sub", cfg ? `Mundo ${m}-${n} · ${cfg.titulo}` : `Mundo ${m}-${n}`);
}

// --- mapa de mundos ------------------------------------------------------
//
// UN CAMINO, NO UNA PLANILLA. La version anterior era una grilla de tarjetas:
// se entendia, pero no contaba nada. Un mapa de mundos tiene que dejar ver de
// un vistazo DE DONDE VENIS Y A DONDE VAS, y eso lo dice la forma del
// recorrido, no una lista.
//
// Cada mundo es una senda: cuatro paradas en zigzag sobre la postal del tema
// —la misma imagen que se ve jugando— unidas por una linea que se DIBUJA
// sola. El tramo ya recorrido va en color y el que falta, gris punteado; el
// heroe se para en la proxima parada. Las posiciones estan en una tabla y no
// repartidas por el CSS: la linea se traza sobre esos mismos numeros, asi que
// no pueden quedar desfasadas.

// x en porcentaje del ancho, y en porcentaje del alto de la senda.
const PARADAS = [[20, 82], [50, 60], [78, 38], [46, 14]];

export function pintarMapa(alElegir) {
  const d = cargar();
  const cont = $("#mapa"); cont.innerHTML = "";
  const totalColor = { rosa: 0, violeta: 0, negra: 0 };
  let hechos = 0;
  const prox = proximoNivel();

  for (let m = 1; m <= 6; m++) {
    const mundoAbierto = abierto(m, 1);
    const mundo = crear("section", "mundo" + (mundoAbierto ? "" : " cerrado"));
    const temaMundo = NIVELES.find((c) => c.m === m).tema;

    const cab = crear("header", "cab-mundo");
    cab.append(crear("h2", null, `Mundo ${m}`));
    const hechosM = [1, 2, 3, 4].filter((n) => datosNivel(idNivel(m, n)).hecho).length;
    const av = crear("div", "avance");
    const avi = crear("i"); avi.style.width = `${hechosM / 4 * 100}%`;
    av.append(avi); cab.append(av);
    cab.append(crear("span", "cuenta", `${hechosM}/4`));
    if (!mundoAbierto) cab.append(crear("span", "candado", "🔒"));
    mundo.append(cab);

    const senda = crear("div", "senda");
    // El cielo del mundo, mezclado de los CUATRO temas que lo componen.
    //
    // Antes iba la postal del primer nivel de fondo, y el mundo 1 y el 2
    // arrancan los dos en la llanura: dos mundos seguidos con la misma
    // imagen, que es lo contrario de lo que un mapa tiene que hacer. Cuatro
    // colores mezclados dan un cielo distinto por mundo sin cargar nada, y la
    // postal de cada nivel pasa a estar donde se entiende mejor: adentro de
    // su propia parada.
    // Se usa cielo[1] —el tono CLARO de cada cielo— y no cielo[0]. Los
    // oscuros de los ocho temas son todos azules o violetas casi negros: con
    // esos, los seis mundos salian del mismo azul barroso y el degrade no
    // distinguia nada, que era justo lo que se venia a arreglar.
    const cielos = [1, 2, 3, 4].map((n) =>
      TEMAS[NIVELES.find((c) => c.m === m && c.n === n).tema].cielo[1]);
    senda.style.background = `linear-gradient(155deg, ${cielos.join(", ")})`;

    // La linea, en SVG, sobre las MISMAS coordenadas que las paradas.
    const puntos = PARADAS.map(([x, y]) => `${x},${y}`).join(" ");
    const hechasM = [1, 2, 3, 4].map((n) => datosNivel(idNivel(m, n)).hecho);
    // Hasta donde llega el tramo recorrido: la ultima parada hecha.
    let ultima = 0;
    for (let k = 0; k < 4; k++) if (hechasM[k]) ultima = k + 1;
    const hasta = PARADAS.slice(0, Math.max(1, ultima)).map(([x, y]) => `${x},${y}`).join(" ");
    senda.insertAdjacentHTML("beforeend",
      `<svg class="senda-linea" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
         <polyline class="tramo-falta" points="${puntos}"/>
         <polyline class="tramo-hecho" points="${hasta}"/>
       </svg>`);

    for (let n = 1; n <= 4; n++) {
      const cfg = NIVELES.find((c) => c.m === m && c.n === n);
      const id = idNivel(m, n);
      const dn = datosNivel(id);
      if (dn.hecho) hechos++;
      for (const k of ["rosa", "violeta", "negra"]) if (dn.color[k]) totalColor[k]++;
      const libre = abierto(m, n);
      const aqui = prox.m === m && prox.n === n;

      const b = crear("button", "parada" + (dn.hecho ? " hecha" : "") +
                      (cfg.jefe ? " jefe" : "") + (libre ? "" : " cerrada") + (aqui ? " aqui" : ""));
      b.disabled = !libre;
      b.dataset.nivel = id;
      b.style.left = `${PARADAS[n - 1][0]}%`;
      b.style.top = `${PARADAS[n - 1][1]}%`;
      // El retraso escalonado hace que las paradas aparezcan una detras de
      // otra, en el orden en que se juegan. Es lo que da la sensacion de
      // recorrido en vez de la de lista.
      b.style.setProperty("--tarde", `${(m - 1) * 60 + n * 70}ms`);
      b.title = `${id} · ${cfg.titulo}`;
      b.setAttribute("aria-label",
        `${id}, ${cfg.titulo}, ${TEMAS[cfg.tema].nombre}${cfg.jefe ? ", jefe" : ""}` +
        (libre ? (dn.hecho ? ", terminado" : "") : ", cerrado"));

      const disco = crear("span", "disco");
      // La postal del propio nivel, adentro del disco: es el mismo fondo que
      // se ve jugandolo, compuesto de las capas de verdad. Asi el mapa
      // muestra a que se entra, no solo un numero.
      if (libre) {
        const mini = crear("img", "mini");
        mini.alt = ""; mini.loading = "lazy";
        mini.src = ruta(`assets/postal/${cfg.tema}.webp`);
        disco.append(mini);
      }
      disco.append(crear("b", null, cfg.jefe ? "★" : String(n)));
      b.append(disco);
      b.append(crear("span", "rotulo", cfg.titulo));
      const pips = crear("span", "colores");
      for (const k of ["rosa", "violeta", "negra"])
        pips.append(crear("i", "pip " + k + (dn.color[k] ? " ok" : "")));
      b.append(pips);
      if (!libre) b.append(crear("span", "cerrojo", "🔒"));
      else if (dn.hecho) b.append(crear("span", "tilde", "✓"));
      if (aqui) {
        // El heroe se dibuja con background-position sobre la hoja de 4x4:
        // `background-size: 400%` deja UNA celda a la vista. Con una <img> a
        // escala habia que achicarla con transform y el resultado se
        // superponia al numero y al rotulo — y ademas quedaba a merced del
        // origen del transform.
        const h = crear("img", "heroe-ficha");
        h.alt = ""; h.title = "estás acá";
        h.src = ruta("assets/piezas/ficha_heroe.webp");
        b.append(h);
      }
      b.addEventListener("click", () => { despertar(); efe.menu(); alElegir(m, n); });
      senda.append(b);
    }
    mundo.append(senda);
    cont.append(mundo);
  }

  $("#total-monedas").textContent = d.monedas;
  $("#total-niveles").textContent = `${hechos}/24`;
  $("#total-color").textContent =
    `${totalColor.rosa}/24 · ${totalColor.violeta}/24 · ${totalColor.negra}/24`;
  // Se lleva la vista a donde esta el jugador. Con seis mundos, entrar al mapa
  // y tener que bajar hasta el cuarto cada vez es un peaje.
  const aqui = cont.querySelector(".parada.aqui");
  if (aqui) requestAnimationFrame(() =>
    aqui.scrollIntoView({ block: "center", behavior: "instant" }));
}

// --- HUD -----------------------------------------------------------------
// En el telefono la barra del navegador se come una franja, y acostado casi un
// tercio. Pantalla completa no es un lujo: es ver lo que viene o no verlo.
export async function pantallaCompleta() {
  const e = document.documentElement;
  try {
    if (!document.fullscreenElement && e.requestFullscreen)
      await e.requestFullscreen({ navigationUI: "hide" });
    else if (e.webkitRequestFullscreen) e.webkitRequestFullscreen();
  } catch (err) { /* iOS no lo permite y no hay nada que hacer */ }
  try { await screen.orientation?.lock?.("landscape"); } catch (err) {}
}

// Los iconos se ponen una sola vez. Poner el src en cada cuadro hace que el
// navegador revalide la imagen sesenta veces por segundo.
let iconosPuestos = false;
export function ponerIconos() {
  if (iconosPuestos) return;
  iconosPuestos = true;
  for (const [id, clave] of [["ico-moneda", "icono_moneda"], ["ico-burbuja", "icono_burbuja"],
                             ["ico-reloj", "icono_reloj"]]) {
    const e = $("#" + id);
    if (e) e.src = ruta(`assets/piezas/${clave}.webp`);
  }
}

// EL HUD SE TOCA SOLO CUANDO CAMBIA. Sesenta veces por segundo, no.
//
// Esta funcion corre en cada cuadro del bucle. La version anterior hacia, en
// cada uno de esos cuadros: cinco querySelector, cuatro escrituras de
// textContent, y —lo peor— vaciaba #hud-color con innerHTML = "" y volvia a
// crear las cinco bolitas con createElement. Eso obliga al navegador a
// recalcular estilos y rehacer el layout del HUD sesenta veces por segundo.
// En una computadora ni se nota; en un telefono es de las cosas mas caras que
// se pueden hacer por cuadro, y se hacia para escribir los mismos numeros que
// ya estaban.
//
// Ahora los elementos se buscan una sola vez, los valores se comparan con lo
// ultimo escrito, y las cinco bolitas se crean una vez y despues solo cambian
// de clase.
const hudE = {};
const hudV = {};
const escribir = (el, clave, val) => {
  if (!el || hudV[clave] === val) return;
  hudV[clave] = val; el.textContent = val;
};

export function pintarHud(p) {
  ponerIconos();
  if (!hudE.monedas) {
    hudE.monedas = $("#hud-monedas");
    hudE.reloj = $("#hud-reloj");
    hudE.burbujas = $("#hud-burbujas");
    hudE.color = $("#hud-color");
    hudE.pips = [];
  }
  escribir(hudE.monedas, "monedas", p.monedas);
  const seg = Math.ceil(p.reloj / 60);
  escribir(hudE.reloj, "reloj", seg);
  if (hudE.reloj) {
    const apuro = seg <= 10, frenado = !p.relojCorre;
    if (hudV.apuro !== apuro) { hudV.apuro = apuro; hudE.reloj.classList.toggle("apuro", apuro); }
    if (hudV.frenado !== frenado) { hudV.frenado = frenado; hudE.reloj.classList.toggle("frenado", frenado); }
  }
  escribir(hudE.burbujas, "burbujas", p.burbujas);

  const c = hudE.color;
  if (!c) return;
  if (hudE.pips.length !== p.color.length) {
    c.innerHTML = "";
    hudE.pips = p.color.map(() => { const i = crear("i", "pip"); c.append(i); return i; });
    hudV.pips = null;
  }
  // La firma es "tier|tomadas": mientras no cambie, no se toca una clase.
  const firma = p.tier + "|" + p.color.map((m) => (m.tomada ? 1 : 0)).join("");
  if (hudV.pips === firma) return;
  hudV.pips = firma;
  for (let i = 0; i < hudE.pips.length; i++)
    hudE.pips[i].className = "pip " + p.tier + (p.color[i].tomada ? " ok" : "");
}

// --- resultado -----------------------------------------------------------
export function pintarResultado(p, cfg, gano, alSeguir, alRepetir, alMapa) {
  const id = idNivel(cfg.m, cfg.n);
  const dn = datosNivel(id);
  const d = cargar();

  const todas = p.color.every((m) => m.tomada);
  if (gano) {
    d.monedas += p.monedas;
    const t = Math.round((p.segundos * 60 - p.reloj) / 60);
    if (!dn.hecho || t < dn.mejorTiempo || !dn.mejorTiempo) dn.mejorTiempo = t;
    dn.monedas = Math.max(dn.monedas, p.monedas);
    dn.hecho = true;
    if (todas) dn.color[p.tier] = true;
    // Terminar un nivel abre EL SIGUIENTE, no el mundo entero. Antes habia
    // que ganar el cuarto nivel de un mundo para que se abriera el siguiente,
    // asi que los tres del medio no abrian nada y el mapa parecia trabado.
    abrirSiguiente(cfg.m, cfg.n);
    guardar();
  }

  $("#res-titulo").textContent = gano ? "¡Llegaste!" : "Se acabó";
  $("#res-sub").textContent = gano
    ? `${cfg.titulo} · ${id}`
    : { tiempo: "Se terminó el tiempo", pozo: "Al vacío", pinche: "Las púas",
        jefe: "El jefe te ganó" }[p.causa] || "Un enemigo te ganó";
  $("#res-panel").className = gano ? "res ganado" : "res perdido";

  const l = $("#res-lista"); l.innerHTML = "";
  const item = (k, v) => { const li = crear("li"); li.append(crear("span", "k", k), crear("span", "v", String(v))); l.append(li); };
  item("Monedas", p.monedas);
  if (gano) item("Bonus del mástil", "+" + (p.premio ?? 0));
  item("Monedas de color", `${p.color.filter((m) => m.tomada).length}/5 ${p.tier}`);
  item("Burbujas que quedaron", p.burbujas);
  if (gano) item("Tiempo", `${Math.round((p.segundos * 60 - p.reloj) / 60)}s de ${p.segundos}`);
  if (gano && todas) item("Desbloqueado", p.tier === "rosa" ? "monedas violetas"
                                        : p.tier === "violeta" ? "monedas negras" : "todo hecho");

  $("#res-seguir").hidden = !gano;
  $("#res-seguir").onclick = () => { efe.menu(); alSeguir(); };
  $("#res-repetir").onclick = () => { efe.menu(); alRepetir(); };
  $("#res-mapa").onclick = () => { efe.menu(); alMapa(); };
  mostrar("p-resultado");
}

// --- ajustes -------------------------------------------------------------
export function montarAjustes(alCambiarGrafico) {
  const d = cargar();
  // El selector de graficos. Quien sabe aplicar el cambio es main.js —es el
  // que tiene el lienzo y los patrones—, asi que aca solo se guarda y se
  // avisa.
  const modo = $("#aj-modo");
  if (modo) {
    const pintarModo = () => {
      for (const b of modo.querySelectorAll("[data-modo]"))
        b.classList.toggle("puesto", (d.ajustes.auto ? "auto" : "libre") === b.dataset.modo);
    };
    for (const b of modo.querySelectorAll("[data-modo]"))
      b.addEventListener("click", () => { d.ajustes.auto = b.dataset.modo === "auto";
                                          guardar(); pintarModo(); });
    pintarModo();
  }
  const grupo = $("#aj-grafico");
  if (grupo) {
    const pintar = () => {
      for (const b of grupo.querySelectorAll("[data-graf]"))
        b.classList.toggle("puesto", String(d.ajustes.grafico) === b.dataset.graf);
    };
    for (const b of grupo.querySelectorAll("[data-graf]"))
      b.addEventListener("click", () => {
        d.ajustes.grafico = b.dataset.graf === "auto" ? "auto" : Number(b.dataset.graf);
        guardar(); pintar();
        if (alCambiarGrafico) alCambiarGrafico(d.ajustes.grafico);
      });
    pintar();
  }
  const sonido = $("#aj-sonido"), musica = $("#aj-musica"), sac = $("#aj-sacudida");
  const mandos = $("#aj-mandos");
  sonido.checked = d.ajustes.sonido; musica.checked = d.ajustes.musica;
  sac.checked = d.ajustes.sacudida;
  if (mandos) mandos.checked = d.ajustes.mandos !== false;
  const aplicar = () => {
    d.ajustes.sonido = sonido.checked; d.ajustes.musica = musica.checked;
    d.ajustes.sacudida = sac.checked;
    if (mandos) d.ajustes.mandos = mandos.checked;
    volumen(d.ajustes.musica, d.ajustes.sonido);
    // Apagar los botones NO deja al jugador sin forma de saltar: tocar el
    // lienzo sigue andando. Por eso se puede apagar sin dejar el juego roto.
    const caja = $("#mandos");
    if (caja) caja.hidden = !(d.ajustes.mandos !== false);
    guardar();
  };
  for (const e of [sonido, musica, sac, mandos]) if (e) e.addEventListener("change", aplicar);
  $("#aj-borrar").addEventListener("click", () => {
    if (!confirm("¿Borrar todo el progreso? No se puede deshacer.")) return;
    borrarTodo(); location.reload();
  });
  aplicar();
}

export { $, crear };
