// El menú principal: las pestañas, la libreta del Guacho (el perfil y lo que
// se juntó de una temporada a otra), el consejo del puestero y la pantalla de
// idioma que sale antes del menú. El arranque y los paneles que se abren desde
// acá (Opciones, las teclas) siguen en juego.js.
"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const I = window.IDIOMA;
  const MN = (E.menu = {});

  // ── la libreta ── queda en este navegador. Sin almacenamiento (una ventana
  // privada, un visor que lo bloquea) se juega igual y la libreta arranca de cero.
  const CERO = { jugadas: 0, salvadas: 0, fundidas: 0, dias: 0, curadas: 0, enlazadas: 0, trabajadas: 0, mejorVivas: 0, mejorTotal: 0, mejorPlata: 0, ultima: null };
  const L = (E.libreta = { datos: { ...CERO } });
  try { Object.assign(L.datos, JSON.parse(localStorage.getItem("estancia-libreta") || "{}")); } catch (e) { /* sin almacenamiento */ }
  const guardar = () => { try { localStorage.setItem("estancia-libreta", JSON.stringify(L.datos)); } catch (e) { /* no importa */ } };
  L.sumar = (clave, n = 1) => { L.datos[clave] = (L.datos[clave] || 0) + n; guardar(); };
  L.terminar = ({ salvada, dia, vivas, total, plata }) => {
    const d = L.datos;
    if (salvada) {
      d.salvadas++;
      // La mejor se mide por proporción: la tropa puede cambiar de tamaño.
      if (!d.mejorTotal || vivas / total > d.mejorVivas / d.mejorTotal) { d.mejorVivas = vivas; d.mejorTotal = total; }
    } else d.fundidas++;
    d.mejorPlata = Math.max(d.mejorPlata || 0, Math.round(plata));
    d.ultima = { salvada, dia, vivas, total };
    guardar();
  };
  L.borrar = () => { L.datos = { ...CERO }; guardar(); };

  // Los rangos van por temporadas salvadas: el primero sale regalado, el último
  // cuesta siete (a veinte días cada una, es jugar en serio).
  const UMBRALES = [0, 1, 2, 4, 7];
  const rango = (n) => { let i = 0; while (i + 1 < UMBRALES.length && n >= UMBRALES[i + 1]) i++; return i; };

  function pintarLibreta() {
    const d = L.datos, rangos = I.lista("libreta.rangos"), r = rango(d.salvadas);
    const base = UMBRALES[r], sig = UMBRALES[r + 1];
    $("libretaRango").textContent = rangos[r];
    $("libretaProximo").textContent = sig === undefined ? t("libreta.maximo") : t("libreta.proximo", { rango: rangos[r + 1], n: sig - d.salvadas });
    // La barra arranca vacía y se llena al mostrarse (la transición del CSS).
    const barra = $("libretaBarra"), lleno = sig === undefined ? 100 : ((d.salvadas - base) / (sig - base)) * 100;
    barra.style.width = "0%";
    requestAnimationFrame(() => requestAnimationFrame(() => { barra.style.width = Math.max(4, lleno) + "%"; }));
    const num = (v) => I.numero(v || 0);
    const filas = [
      ["jugadas", num(d.jugadas)], ["salvadas", num(d.salvadas)], ["fundidas", num(d.fundidas)],
      ["dias", num(d.dias)], ["curadas", num(d.curadas)], ["enlazadas", num(d.enlazadas)], ["trabajadas", num(d.trabajadas)],
      ["mejor", d.mejorTotal ? t("libreta.mejorValor", { v: d.mejorVivas, t: d.mejorTotal }) : "—"],
      ["plata", d.mejorPlata ? "$ " + num(d.mejorPlata) : "—"],
    ];
    $("libretaStats").innerHTML = filas.map(([k, v], i) => `<li style="--i:${i}"><b>${v}</b><span>${t("libreta." + k)}</span></li>`).join("");
    const u = d.ultima;
    $("libretaUltima").textContent = !u ? t("libreta.ninguna") : u.salvada ? t("libreta.ultimaSalvada", { v: u.vivas, t: u.total }) : t("libreta.ultimaFundida", { d: u.dia });
    pintarPerfil();
  }
  function pintarPerfil() {
    const d = L.datos;
    $("perfilMiniTexto").textContent = t("menu.perfil", { rango: I.lista("libreta.rangos")[rango(d.salvadas)], n: d.salvadas, d: d.dias });
  }

  // ── las pestañas ── Opciones no es una pestaña: abre el panel de siempre
  // (el mismo de la pausa), y al volver se vuelve a la pestaña que estaba.
  MN.pestana = (nombre) => {
    document.querySelectorAll("#menu .pestana-boton[data-pestana]").forEach((b) => {
      const si = b.dataset.pestana === nombre;
      b.classList.toggle("activa", si); b.setAttribute("aria-selected", si ? "true" : "false");
    });
    document.querySelectorAll("#menu .pestana[data-pestana]").forEach((s) => { s.hidden = s.dataset.pestana !== nombre; });
    if (nombre === "libreta") pintarLibreta();
    MN.actual = nombre;
  };

  // ── el consejo del puestero ── cambia solo cada 7 s mientras el menú se ve.
  let consejo = 0, relojConsejo = null;
  function pintarConsejo() { const l = I.lista("consejos"); $("consejoTexto").textContent = l[consejo % l.length]; }
  function arrancarConsejos() {
    clearInterval(relojConsejo);
    consejo = Math.floor(Math.random() * 8);
    pintarConsejo();
    relojConsejo = setInterval(() => {
      if ($("menu").hidden) return;
      const c = $("consejo");
      c.classList.add("cambia");
      setTimeout(() => { consejo++; pintarConsejo(); c.classList.remove("cambia"); }, 450);
    }, 7000);
  }

  // Los sonidos CC-BY (SONIDOS_CREDITOS, de js/sonidos.js): autor, licencia
  // y enlace, que es lo que pide la licencia. Es una const global, no de window.
  function pintarCreditosSonido() {
    const lista = typeof SONIDOS_CREDITOS !== "undefined" ? SONIDOS_CREDITOS : [];
    const ul = $("creditosSonidos"), caja = ul.parentElement;
    caja.hidden = !lista.length;
    const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    ul.innerHTML = lista.map((c) => {
      const nombre = t("snd." + c.id);
      return `<li><b>${esc(nombre === "snd." + c.id ? c.id : nombre)}</b> — ${esc(c.autor)} · <a href="${esc(c.fuente)}" target="_blank" rel="noopener">${esc(c.licencia)}</a></li>`;
    }).join("");
  }

  function pintarHitos() {
    $("hitoDias").textContent = t("menu.hitoDias", { n: E.trabajo.DIAS });
    $("hitoVacas").textContent = t("menu.hitoVacas", { n: E.trabajo.balance().total });
  }

  // Se llama cada vez que el menú aparece (al arrancar y al volver del idioma).
  MN.mostrar = () => {
    pintarHitos(); pintarPerfil();
    if (!MN.actual) MN.pestana("jugar");
    if (!relojConsejo) arrancarConsejos();
    $("menu").hidden = false;
  };

  // ── el idioma ── antes del menú, cada vez que se abre el juego.
  MN.elegirIdioma = () => new Promise((listo) => {
    const panel = $("idioma"), botones = [...panel.querySelectorAll("[data-idioma]")];
    botones.forEach((b) => b.classList.toggle("elegido", b.dataset.idioma === I.guardado));
    panel.hidden = false;
    const previo = botones.find((b) => b.dataset.idioma === (I.guardado || I.actual));
    try { previo && previo.focus({ preventScroll: true }); } catch (e) { /* no importa */ }
    botones.forEach((b) => {
      b.onclick = () => {
        botones.forEach((x) => { x.onclick = null; });
        I.cambiar(b.dataset.idioma);
        panel.hidden = true;
        listo(b.dataset.idioma);
      };
    });
  });

  MN.conectar = () => {
    document.querySelectorAll("#menu .pestana-boton[data-pestana]").forEach((b) => { b.onclick = () => MN.pestana(b.dataset.pestana); });
    $("perfilMini").onclick = () => MN.pestana("libreta");
    $("menuIdioma").onclick = async () => { $("menu").hidden = true; await MN.elegirIdioma(); MN.mostrar(); };
    // Borrar pide dos toques: un confirm() del navegador en el teléfono sale
    // feo y en algunos visores ni aparece.
    let seguro = null;
    $("libretaBorrar").onclick = () => {
      const b = $("libretaBorrar");
      if (!seguro) { b.textContent = t("libreta.seguro"); seguro = setTimeout(() => { seguro = null; b.textContent = t("libreta.borrar"); }, 3000); return; }
      clearTimeout(seguro); seguro = null;
      L.borrar(); b.textContent = t("libreta.borrar"); pintarLibreta();
    };
    pintarCreditosSonido();
    const sel = $("opIdioma");
    sel.value = I.actual;
    sel.onchange = () => I.cambiar(sel.value);
    I.alCambiar(() => {
      sel.value = I.actual;
      pintarHitos(); pintarConsejo(); pintarCreditosSonido();
      if (MN.actual === "libreta") pintarLibreta(); else pintarPerfil();
    });
  };
})();
