// Menus, mapa de mundos, HUD y pantallas de resultado.
//
// Todo en DOM, NO en canvas. Un boton dibujado en un canvas parece un boton y
// no lo es: hay que escribirle la deteccion de toque a mano, no lo lee un
// lector de pantalla y no se puede navegar con el teclado. El canvas dibuja el
// juego; la interfaz es HTML.

import { NIVELES, idNivel, TEMAS } from "./mundo.js";
import { cargar, guardar, datosNivel, tierActual, borrarTodo } from "./guardado.js";
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
}

// --- mapa de mundos ------------------------------------------------------
export function pintarMapa(alElegir) {
  const d = cargar();
  const cont = $("#mapa"); cont.innerHTML = "";
  const totalColor = { rosa: 0, violeta: 0, negra: 0 };
  let hechos = 0;

  for (let m = 1; m <= 6; m++) {
    const abierto = m <= d.desbloqueado;
    const mundo = crear("section", "mundo" + (abierto ? "" : " cerrado"));
    const cab = crear("header", "cab-mundo");
    cab.append(crear("h2", null, `Mundo ${m}`));
    const av = crear("div", "avance"); av.append(crear("i")); cab.append(av);
    if (!abierto) cab.append(crear("span", "candado", "🔒 terminá el mundo " + (m - 1)));
    mundo.append(cab);

    const fila = crear("div", "niveles");
    for (let n = 1; n <= 4; n++) {
      const cfg = NIVELES.find((c) => c.m === m && c.n === n);
      const id = idNivel(m, n);
      const dn = datosNivel(id);
      if (dn.hecho) hechos++;
      for (const k of ["rosa", "violeta", "negra"]) if (dn.color[k]) totalColor[k]++;

      const b = crear("button", "nivel" + (dn.hecho ? " hecho" : "") + (cfg.jefe ? " jefe" : ""));
      b.disabled = !abierto;
      b.dataset.nivel = id;
      b.style.setProperty("--tema", TEMAS[cfg.tema].cielo[0]);
      // La postal del tema: es el mismo fondo que ve el jugador adentro del
      // nivel, compuesto de las capas reales. Una miniatura generada aparte
      // seria parecida pero distinta, y la tarjeta prometeria otro nivel.
      const post = crear("img", "postal");
      post.alt = ""; post.loading = "lazy";
      post.src = ruta(`assets/postal/${cfg.tema}.webp`);
      b.append(post);
      b.append(crear("span", "num", id));
      b.append(crear("span", "titulo", cfg.titulo));
      b.append(crear("span", "tema", TEMAS[cfg.tema].nombre + (cfg.jefe ? " · jefe" : "")));

      const monedas = crear("span", "colores");
      for (const k of ["rosa", "violeta", "negra"]) {
        const p = crear("i", "pip " + k + (dn.color[k] ? " ok" : ""));
        p.title = k;
        monedas.append(p);
      }
      b.append(monedas);
      if (dn.hecho) b.append(crear("span", "mejor", `${dn.monedas} 🪙 · ${dn.mejorTiempo}s`));
      b.addEventListener("click", () => { despertar(); efe.menu(); alElegir(m, n); });
      fila.append(b);
    }
    mundo.append(fila);
    cont.append(mundo);
  }

  // Barra de avance del mundo: cuantos de los cuatro estan hechos.
  for (let m = 1; m <= 6; m++) {
    const hechosM = [1, 2, 3, 4].filter((n) => datosNivel(idNivel(m, n)).hecho).length;
    const barra = cont.querySelector(`.mundo:nth-of-type(${m}) .avance i`);
    if (barra) barra.style.width = `${hechosM / 4 * 100}%`;
  }
  $("#total-monedas").textContent = d.monedas;
  $("#total-niveles").textContent = `${hechos}/24`;
  $("#total-color").textContent =
    `${totalColor.rosa}/24 · ${totalColor.violeta}/24 · ${totalColor.negra}/24`;
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

export function pintarHud(p) {
  ponerIconos();
  $("#hud-monedas").textContent = p.monedas;
  const seg = Math.ceil(p.reloj / 60);
  const rel = $("#hud-reloj");
  rel.textContent = seg;
  rel.classList.toggle("apuro", seg <= 10);
  rel.classList.toggle("frenado", !p.relojCorre);
  $("#hud-burbujas").textContent = p.burbujas;
  const c = $("#hud-color");
  c.innerHTML = "";
  for (const m of p.color) {
    const i = crear("i", "pip " + p.tier + (m.tomada ? " ok" : ""));
    c.append(i);
  }
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
    // Terminar el ultimo nivel de un mundo abre el siguiente.
    if (cfg.n === 4 && d.desbloqueado === cfg.m) d.desbloqueado = Math.min(6, cfg.m + 1);
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
export function montarAjustes() {
  const d = cargar();
  const sonido = $("#aj-sonido"), musica = $("#aj-musica"), sac = $("#aj-sacudida");
  sonido.checked = d.ajustes.sonido; musica.checked = d.ajustes.musica;
  sac.checked = d.ajustes.sacudida;
  const aplicar = () => {
    d.ajustes.sonido = sonido.checked; d.ajustes.musica = musica.checked;
    d.ajustes.sacudida = sac.checked;
    volumen(d.ajustes.musica, d.ajustes.sonido);
    guardar();
  };
  for (const e of [sonido, musica, sac]) e.addEventListener("change", aplicar);
  $("#aj-borrar").addEventListener("click", () => {
    if (!confirm("¿Borrar todo el progreso? No se puede deshacer.")) return;
    borrarTodo(); location.reload();
  });
  aplicar();
}

export { $, crear };
