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

  // Los comandos: nombre, argumentos (para mostrar), qué hace, y la función.
  const COMANDOS = [
    { n: "ayuda", d: "La lista de comandos", f: () => { sistema("Comandos: " + COMANDOS.map((c) => "/" + c.n).join("  ")); } },
    { n: "saludar", d: "El Guacho saluda", f: () => { G().decir("saludar"); sistema(`¡Hola, ${nombreJugador()}! Este comando funciona en celular.`); } },
    { n: "perros", a: "vengan | quietos | junten | busquen", d: "Órdenes a los perros", f: (arg) => {
      const o = { vengan: "seguir", vengan_: "seguir", seguir: "seguir", quietos: "quieto", quieto: "quieto", echate: "quieto", junten: "juntar", juntar: "juntar", busquen: "traer", busque: "traer", traer: "traer" }[(arg || "").toLowerCase()];
      if (!E.perros.lista.length) return sistema("No hay perros en esta estancia.");
      if (!o) return sistema("¿Qué les decís? /perros vengan, quietos, junten o busquen.");
      if (E.perros.ordenar(o)) sistema(`${E.perros.ORDENES[o].texto} Los perros: ${E.perros.ORDENES[o].ayuda}.`);
    } },
    { n: "silbar", d: "Silbarle al zaino para que venga", f: () => { const J = E.jugador; E.animales.caballo.destino = { x: J.x, z: J.z }; E.sonido.silbido(); setTimeout(() => G().decir("silbar"), 1050); } },
    { n: "mate", d: "Cebar unos mates (en la galería)", f: () => {
      const p = punto("mate");
      if (!cerca(p.x, p.z, 4)) return sistema(`La yerba y la pava están en la mesa de la galería, ${E.trabajo.rumbo(p.x, p.z)}.`);
      E.puesto.cebarMate();
    } },
    { n: "comer", d: "Preparar un guiso en el fogón", f: () => {
      const F = E.lugares.fogon;
      if (!cerca(F.x, F.z, 4)) return sistema(`El fogón está ${E.trabajo.rumbo(F.x, F.z)}.`);
      if (G().comio) return sistema("Ya comiste hoy.");
      if (G().hora < 11) return sistema("Es muy temprano para el guiso. Tomate unos mates.");
      E.puesto.cocinar();
    } },
    { n: "caballo", d: "Cómo está el zaino", f: () => {
      const c = E.animales.caballo;
      const estado = [`aliento ${Math.round(c.aliento * 100)}%`, c.lesion > 0 ? "rengo" : "sano", (c.sucio || 0) > 0.35 ? "muy sucio" : (c.sucio || 0) > 0.08 ? "algo sucio" : "limpio", c.comido === G().dia ? "comido" : "sin forraje hoy"];
      sistema(`El zaino: ${estado.join(", ")}.${c.montado ? "" : ` Está ${E.trabajo.rumbo(c.x, c.z)}.`}`);
    } },
    { n: "hacienda", d: "Cuántas quedan y dónde están las agusanadas", f: () => {
      const b = E.trabajo.balance(), ag = E.animales.vacas.filter((v) => v.salud.bichera && !v.salud.muerta);
      const Rd = E.rodeo.lista, n = (k) => Rd.filter((a) => a.k === k).length;
      sistema(`Rodeo del campo: ${n("vaca")} vacas, ${n("toro")} toros y ${n("ternero")} terneros. De trabajo: ${b.vivas} de ${b.total} vacas, ${b.trabajadas} trabajadas.` + (ag.length ? " Con bichera: " + ag.map((v) => `la ${v.num} (${E.trabajo.rumbo(v.x, v.z)})`).join(", ") + "." : " Ninguna agusanada."));
    } },
    { n: "razas", d: "Qué razas hay en la tropa", f: () => {
      const cuenta = {};
      for (const v of E.animales.vacas) if (!v.salud.muerta && !v.ternero) { const n = (E.animales.RAZAS[v.tipo] || { nombre: v.tipo }).nombre + (v.toro ? " (toro)" : ""); cuenta[n] = (cuenta[n] || 0) + 1; }
      sistema(Object.entries(cuenta).map(([n, k]) => `${k} ${n}`).join(", ") + `, y ${E.animales.vacas.filter((v) => v.ternero && !v.salud.muerta).length} terneros.`);
    } },
    { n: "comedero", d: "Cómo está el comedero y los novillos", f: () => {
      const K = E.comedero, nov = E.animales.vacas.filter((v) => v.engorde && !v.salud.muerta), comiendo = E.animales.vacas.filter((v) => v.estado === "come").length;
      const kg = nov.length ? Math.round(nov.reduce((s, v) => s + (v.kilos || 320), 0) / nov.length) : 0;
      sistema(`Comedero al ${Math.round(K.nivel * 100)} %, ${comiendo} comiendo ahora. Novillos del encierre: ${nov.length}, promedian ${kg} kg. La tranquera del encierre está ${K.tranquera.abierta ? "abierta" : "cerrada"}.`);
    } },
    { n: "mapa", d: "Abrir el mapa del campo", f: () => E.mapa.abrir() },
    { n: "ir", a: "casco | corral | comedero | aguada | pueblo | estero | zaino", d: "Marcar a dónde ir", f: (arg) => {
      if (!arg) return sistema("¿Adónde? /ir casco, corral, comedero, aguada, pueblo, estero o zaino.");
      const l = E.mapa.buscar(arg === "zaino" ? "caballo" : arg);
      if (!l) return sistema(`No sé dónde queda "${arg}". Probá /mapa.`);
      E.mapa.ir(l); sistema(`${l.nombre}: ${E.trabajo.rumbo(l.x, l.z)}, a ${Math.round(Math.hypot(l.x - E.jugador.x, l.z - E.jugador.z))} m. Seguí la columna de luz.`);
    } },
    { n: "hora", d: "La hora y el día", f: () => { const h = Math.floor(G().hora), m = Math.floor((G().hora % 1) * 60); sistema(`Son las ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} del día ${G().dia} de ${E.trabajo.DIAS}.`); } },
    { n: "puesto", d: "Para qué lado queda el rancho", f: () => { const R = E.lugares.rancho; sistema(`El rancho queda ${E.trabajo.rumbo(R.x, R.z)}, a ${Math.round(Math.hypot(R.x - E.jugador.x, R.z - E.jugador.z))} m.`); } },
    { n: "fumar", d: "Armarse un cigarro", f: () => { if (!G()._fumando) { G()._fumando = 6; G().decir("fumar"); } } },
    { n: "camara", d: "Primera o tercera persona", f: () => { const J = E.jugador; J.camara = J.camara === "primera" ? "tercera" : "primera"; sistema(`Cámara en ${J.camara} persona.`); } },
    { n: "radio", d: "Prender o apagar la radio del rancho", f: () => { const p = punto("radio"); if (!cerca(p.x, p.z, 6)) return sistema("La radio está adentro del rancho."); E.sonido.radio = !E.sonido.radio; sistema(E.sonido.radio ? "Radio prendida: AM, chamamé y el pronóstico." : "Radio apagada."); } },
    { n: "limpiar", d: "Borrar el chat", f: () => { log.innerHTML = ""; } },
  ];

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
    sistema("Escribí /ayuda para ver los comandos. Enter o / abren el chat.");
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
    const t = entrada.value.trim();
    if (t) {
      if (t.startsWith("/")) {
        const [cmd, ...resto] = t.slice(1).split(/\s+/);
        const c = COMANDOS.find((k) => k.n === cmd.toLowerCase()) || (lista.length && t.length > 1 ? null : null);
        linea("Vos", t, "yo");
        if (c) c.f(resto.join(" ")); else sistema(`No conozco "/${cmd}". Probá /ayuda.`);
      } else {
        linea(nombreJugador(), t, "dice");
      }
    }
    CH.cerrar();
  }

  function sugerir() {
    const t = entrada.value;
    elegida = 0;
    if (!t.startsWith("/") || t.includes(" ")) { lista = []; sugerencias.innerHTML = ""; return; }
    const pre = t.slice(1).toLowerCase();
    lista = COMANDOS.filter((c) => c.n.startsWith(pre)).slice(0, 6);
    pintarSugerencias();
  }
  function pintarSugerencias() {
    sugerencias.innerHTML = "";
    lista.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = i === elegida ? "elegida" : "";
      li.innerHTML = `<b>/${c.n}</b>${c.a ? ` <i>${c.a}</i>` : ""}<small>${c.d}</small><span>Usar comando</span>`;
      li.addEventListener("pointerdown", (ev) => { ev.preventDefault(); completar(c); });
      sugerencias.appendChild(li);
    });
  }
  function completar(c) {
    entrada.value = "/" + c.n + (c.a ? " " : "");
    entrada.focus();
    if (!c.a) { enviar(); return; }
    sugerir();
  }

  // ── las líneas ── se apagan a los 12 s si el chat está cerrado.
  function linea(quien, texto, clase) {
    const d = document.createElement("div");
    d.className = "chat-linea " + clase;
    const b = document.createElement("b"); b.textContent = clase === "sistema" ? "[Sistema]:" : quien + ":";
    d.append(b, " " + texto);
    log.appendChild(d);
    while (log.children.length > 40) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    setTimeout(() => d.classList.add("vieja"), 12000);
  }
  const sistema = (t) => linea("Sistema", t, "sistema");
  CH.sistema = sistema;
})();
