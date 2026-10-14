// El chat de comandos, como el de Roblox: Enter o "/" lo abre (en el celular,
// el globito de arriba). Escribiendo "/" aparecen los comandos que empiezan con
// lo escrito; Tab o un toque completa, flechas para elegir. Lo que no empieza
// con "/" lo dice el Guacho en voz alta (queda escrito en el chat).
// Las respuestas del juego salen como [Sistema].
"use strict";
(() => {
  const CH = (E.chat = { abierto: false });
  const $ = (id) => document.getElementById(id);
  let log, caja, entrada, sugerencias, elegida = 0, lista = [];

  const G = () => E.juego;
  const cerca = (x, z, r) => Math.hypot(E.jugador.x - x, E.jugador.z - z) < r;
  const punto = (id) => E.estancia.puntos.find((p) => p.id === id);

  // Los comandos: n es el nombre en castellano (y la clave en idioma.js); el
  // que se muestra es el del idioma elegido ("cmd.<n>"), con sus argumentos
  // ("cmd.<n>A") y lo que hace ("cmd.<n>D"). Se aceptan los dos: el que
  // aprendió "/ayuda" y después cambió a inglés no se queda sin chat.
  const nombre = (c) => t("cmd." + c.n);
  const sinTildes = (x) => (x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Una palabra en cualquiera de los tres idiomas (para los argumentos).
  const enAlguno = (clave, palabra) => IDIOMA.CODIGOS.some((k) => sinTildes(IDIOMA.DICC[k][clave]) === sinTildes(palabra));
  const COMANDOS = [
    { n: "ayuda", f: () => { sistema(t("cmd.ayudaR") + COMANDOS.map((c) => "/" + nombre(c)).join("  ")); } },
    { n: "saludar", f: () => { G().decir("saludar"); sistema(t("cmd.saludarR", { nombre: nombreJugador() })); } },
    { n: "perros", a: true, f: (arg) => {
      const palabras = { vengan_: "seguir", seguir: "seguir", quieto: "quieto", echate: "quieto", juntar: "juntar", busque: "traer", traer: "traer" };
      for (const k of IDIOMA.CODIGOS) Object.assign(palabras, IDIOMA.DICC[k]["cmd.perrosPalabras"]);
      const o = palabras[sinTildes(arg)];
      if (!E.perros.lista.length) return sistema(t("cmd.perrosNo"));
      if (!o) return sistema(t("cmd.perrosQue", { cmd: t("cmd.perros") }));
      if (E.perros.ordenar(o)) sistema(t("cmd.perrosR", { texto: t(E.perros.ORDENES[o].texto), ayuda: t(E.perros.ORDENES[o].ayuda) }));
    } },
    { n: "silbar", f: () => { const J = E.jugador; E.animales.caballo.destino = { x: J.x, z: J.z }; E.sonido.silbido(); setTimeout(() => G().decir("silbar"), 1050); } },
    { n: "mate", f: () => {
      const p = punto("mate");
      if (!cerca(p.x, p.z, 4)) return sistema(t("cmd.mateLejos", { rumbo: E.trabajo.rumbo(p.x, p.z) }));
      E.puesto.cebarMate();
    } },
    { n: "comer", f: () => {
      const F = E.lugares.fogon;
      if (!cerca(F.x, F.z, 4)) return sistema(t("cmd.comerLejos", { rumbo: E.trabajo.rumbo(F.x, F.z) }));
      if (G().comio) return sistema(t("cmd.comerYa"));
      if (G().hora < 11) return sistema(t("cmd.comerTemprano"));
      E.puesto.cocinar();
    } },
    { n: "caballo", f: () => {
      const c = E.animales.caballo;
      const estado = [t("cmd.caballoAliento", { n: Math.round(c.aliento * 100) }), t(c.lesion > 0 ? "cmd.rengo" : "cmd.sano"), t((c.sucio || 0) > 0.35 ? "cmd.muySucio" : (c.sucio || 0) > 0.08 ? "cmd.algoSucio" : "cmd.limpio"), t(c.comido === G().dia ? "cmd.comido" : "cmd.sinForraje")];
      sistema(t("cmd.caballoR", { estado: estado.join(", ") }) + (c.montado ? "" : t("cmd.caballoDonde", { rumbo: E.trabajo.rumbo(c.x, c.z) })));
    } },
    { n: "hacienda", f: () => {
      const b = E.trabajo.balance(), ag = E.animales.vacas.filter((v) => v.salud.bichera && !v.salud.muerta);
      const Rd = E.rodeo.lista, n = (k) => Rd.filter((a) => a.k === k).length;
      sistema(t("cmd.haciendaR", { v: n("vaca"), t: n("toro"), te: n("ternero"), vivas: b.vivas, total: b.total, trab: b.trabajadas }) +
        (ag.length ? t("cmd.conBichera", { lista: ag.map((v) => t("cmd.vacaDonde", { num: v.num, rumbo: E.trabajo.rumbo(v.x, v.z) })).join(", ") }) : t("cmd.ninguna")));
    } },
    { n: "razas", f: () => {
      const cuenta = {};
      const raza = (v) => { const nombreEs = (E.animales.RAZAS[v.tipo] || { nombre: v.tipo }).nombre; return IDIOMA.DICC.es["raza." + v.tipo] ? t("raza." + v.tipo) : nombreEs; };
      for (const v of E.animales.vacas) if (!v.salud.muerta && !v.ternero) { const n = raza(v) + (v.toro ? t("cmd.toro") : ""); cuenta[n] = (cuenta[n] || 0) + 1; }
      sistema(t("cmd.razasR", { lista: Object.entries(cuenta).map(([n, k]) => `${k} ${n}`).join(", "), n: E.animales.vacas.filter((v) => v.ternero && !v.salud.muerta).length }));
    } },
    { n: "comedero", f: () => {
      const K = E.comedero, nov = E.animales.vacas.filter((v) => v.engorde && !v.salud.muerta), comiendo = E.animales.vacas.filter((v) => v.estado === "come").length;
      const kg = nov.length ? Math.round(nov.reduce((s, v) => s + (v.kilos || 320), 0) / nov.length) : 0;
      sistema(t("cmd.comederoR", { n: Math.round(K.nivel * 100), c: comiendo, nov: nov.length, kg, estado: t(K.tranquera.abierta ? "cmd.abierta" : "cmd.cerrada") }));
    } },
    { n: "mapa", f: () => E.mapa.abrir() },
    { n: "ir", a: true, f: (arg) => {
      if (!arg) return sistema(t("cmd.irAdonde", { cmd: t("cmd.ir") }));
      const l = E.mapa.buscar(enAlguno("cmd.irZaino", arg) ? "caballo" : arg);
      if (!l) return sistema(t("cmd.irNoSe", { arg, mapa: t("cmd.mapa") }));
      E.mapa.ir(l); sistema(t("cmd.irR", { nombre: l.nombre, rumbo: E.trabajo.rumbo(l.x, l.z), m: Math.round(Math.hypot(l.x - E.jugador.x, l.z - E.jugador.z)) }));
    } },
    { n: "hora", f: () => { const h = Math.floor(G().hora), m = Math.floor((G().hora % 1) * 60); sistema(t("cmd.horaR", { hh: String(h).padStart(2, "0"), mm: String(m).padStart(2, "0"), d: G().dia, n: E.trabajo.DIAS })); } },
    { n: "puesto", f: () => { const R = E.lugares.rancho; sistema(t("cmd.puestoR", { rumbo: E.trabajo.rumbo(R.x, R.z), m: Math.round(Math.hypot(R.x - E.jugador.x, R.z - E.jugador.z)) })); } },
    { n: "fumar", f: () => { if (!G()._fumando) { G()._fumando = 6; G().decir("fumar"); } } },
    { n: "camara", f: () => { const J = E.jugador; J.camara = J.camara === "primera" ? "tercera" : "primera"; sistema(t(J.camara === "primera" ? "cmd.camaraPrimera" : "cmd.camaraTercera")); } },
    { n: "radio", a: true, f: (arg) => {
      const R2 = E.radioFM, a2 = sinTildes(arg);
      if (!a2) return R2.abrir();
      if (a2 === "apagar" || enAlguno("cmd.radioApagar", a2)) { R2.apagar(); return sistema(t("cmd.radioApagada")); }
      if (a2 === "siguiente" || enAlguno("cmd.radioSiguiente", a2)) { R2.siguiente(1); return sistema(t("cmd.sintonizando", { nombre: R2.actual ? R2.actual.nombre : "…" })); }
      const e = R2.EMISORAS.find((x) => sinTildes(x.nombre).includes(a2) || sinTildes(x.lugar).includes(a2));
      if (!e) return sistema(t("cmd.radioNo", { arg, cmd: t("cmd.radio") }));
      R2.sintonizar(e); sistema(t("cmd.sintonizandoLugar", { nombre: e.nombre, lugar: e.lugar }));
    } },
    { n: "limpiar", f: () => { log.innerHTML = ""; } },
  ];
  const buscarComando = (cmd) => { const c = sinTildes(cmd); return COMANDOS.find((k) => k.n === c || sinTildes(nombre(k)) === c); };

  const nombreJugador = () => "Guacho";

  CH.conectar = () => {
    log = $("chatLog"); caja = $("chatCaja"); entrada = $("chatEntrada"); sugerencias = $("chatSugerencias");
    $("chatBoton").addEventListener("click", () => (CH.abierto ? CH.cerrar() : CH.abrir()));
    $("chatForm").addEventListener("submit", (ev) => { ev.preventDefault(); enviar(); });
    entrada.addEventListener("input", sugerir);
    entrada.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); CH.cerrar(); }
      else if ((ev.key === "Tab" || (ev.key === "ArrowRight" && entrada.selectionStart === entrada.value.length)) && lista.length) { ev.preventDefault(); completar(lista[elegida]); }
      else if (ev.key === "ArrowDown" && lista.length) { ev.preventDefault(); elegida = (elegida + 1) % lista.length; pintarSugerencias(); }
      else if (ev.key === "ArrowUp" && lista.length) { ev.preventDefault(); elegida = (elegida - 1 + lista.length) % lista.length; pintarSugerencias(); }
    });
    // Enter o "/" lo abren (jugando, sin menús a la vista).
    addEventListener("keydown", (ev) => {
      if (CH.abierto || ev.repeat) return;
      if ((ev.key === "Enter" || ev.key === "/") && G().corriendo && !G().enMenu() && !E.trabajo.cura.activa) {
        ev.preventDefault();
        CH.abrir(ev.key === "/" ? "/" : "");
      }
    });
    sistema(t("chat.bienvenida", { ayuda: t("cmd.ayuda") }));
  };

  CH.abrir = (texto = "") => {
    CH.abierto = true;
    E.entrada.soltarTodo();
    G().soltarPuntero();
    $("chat").hidden = false;                  // (si no, el foco no entra: un padre oculto no deja enfocar)
    caja.hidden = false;
    document.body.classList.add("chat-abierto");
    entrada.value = texto; entrada.focus();
    sugerir();
  };
  CH.cerrar = () => {
    CH.abierto = false;
    caja.hidden = true; lista = []; sugerencias.innerHTML = "";
    document.body.classList.remove("chat-abierto");
    entrada.blur();
    // De vuelta al juego: el puntero se vuelve a tomar (Enter es un gesto).
    if (!E.entrada.tactil && G().corriendo && !G().enMenu()) { try { $("lienzo").requestPointerLock(); } catch (e) { /* no importa */ } }
  };

  function enviar() {
    const texto = entrada.value.trim();
    if (texto) {
      if (texto.startsWith("/")) {
        const [cmd, ...resto] = texto.slice(1).split(/\s+/);
        const c = buscarComando(cmd);
        linea(t("chat.vos"), texto, "yo");
        if (c) c.f(resto.join(" ")); else sistema(t("chat.noConozco", { cmd, ayuda: t("cmd.ayuda") }));
      } else {
        linea(nombreJugador(), texto, "dice");
      }
    }
    CH.cerrar();
  }

  function sugerir() {
    const escrito = entrada.value;
    elegida = 0;
    if (!escrito.startsWith("/") || escrito.includes(" ")) { lista = []; sugerencias.innerHTML = ""; return; }
    const pre = sinTildes(escrito.slice(1));
    lista = COMANDOS.filter((c) => sinTildes(nombre(c)).startsWith(pre) || c.n.startsWith(pre)).slice(0, 6);
    pintarSugerencias();
  }
  function pintarSugerencias() {
    sugerencias.innerHTML = "";
    lista.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = i === elegida ? "elegida" : "";
      li.innerHTML = `<b>/${nombre(c)}</b>${c.a ? ` <i>${t("cmd." + c.n + "A")}</i>` : ""}<small>${t("cmd." + c.n + "D")}</small><span>${t("chat.usar")}</span>`;
      li.addEventListener("pointerdown", (ev) => { ev.preventDefault(); completar(c); });
      sugerencias.appendChild(li);
    });
  }
  function completar(c) {
    entrada.value = "/" + nombre(c) + (c.a ? " " : "");
    entrada.focus();
    if (!c.a) { enviar(); return; }
    sugerir();
  }

  // ── las líneas ── se apagan a los 12 s si el chat está cerrado.
  function linea(quien, texto, clase) {
    const d = document.createElement("div");
    d.className = "chat-linea " + clase;
    const b = document.createElement("b"); b.textContent = clase === "sistema" ? t("chat.sistema") : quien + ":";
    d.append(b, " " + texto);
    log.appendChild(d);
    while (log.children.length > 40) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    setTimeout(() => d.classList.add("vieja"), 12000);
  }
  const sistema = (texto) => linea("Sistema", texto, "sistema");
  CH.sistema = sistema;
})();
