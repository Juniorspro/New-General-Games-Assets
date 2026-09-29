"use strict";
// ════════════════════════════════════════════════════════════════════════
// Interfaz (React sin compilar: h = createElement). Pantalla de idioma antes
// de cada menú, menú con pestañas, intro, HUD, controles táctiles, mochila,
// mapa, notas, pausa y final. Lee Juego.est y llama a sus acciones.
// ════════════════════════════════════════════════════════════════════════
const { useState, useEffect, useRef } = React;
const h = React.createElement;
const cx = (...c) => c.filter(Boolean).join(" ");
function useJuego() { const [, set] = useState(0); useEffect(() => Juego.suscribir(() => set((n) => n + 1)), []); return Juego.est; }
const BANDERAS = {
  AR: h("svg", { viewBox: "0 0 30 20", "aria-hidden": true }, h("rect", { width: 30, height: 20, fill: "#74acdf" }), h("rect", { y: 6.67, width: 30, height: 6.67, fill: "#fff" }), h("circle", { cx: 15, cy: 10, r: 2.2, fill: "#f6b40e" })),
  GB: h("svg", { viewBox: "0 0 30 20", "aria-hidden": true }, h("rect", { width: 30, height: 20, fill: "#012169" }), h("path", { d: "M0 0L30 20M30 0L0 20", stroke: "#fff", strokeWidth: 4 }), h("path", { d: "M0 0L30 20M30 0L0 20", stroke: "#c8102e", strokeWidth: 1.6 }), h("path", { d: "M15 0V20M0 10H30", stroke: "#fff", strokeWidth: 6 }), h("path", { d: "M15 0V20M0 10H30", stroke: "#c8102e", strokeWidth: 3.4 })),
  BR: h("svg", { viewBox: "0 0 30 20", "aria-hidden": true }, h("rect", { width: 30, height: 20, fill: "#009c3b" }), h("path", { d: "M15 2L28 10L15 18L2 10Z", fill: "#ffdf00" }), h("circle", { cx: 15, cy: 10, r: 4, fill: "#002776" })),
};
// Grano de película: una baldosa de ruido de 128 px hecha una vez (sin filtros SVG ni mezclas caras).
const GRANO = (() => { try { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), im = g.createImageData(128, 128); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c.toDataURL(); } catch (e) { return ""; } })();
const Logo = ({ chico }) => h("div", { className: cx("logo", chico && "chico") }, h("small", null, T("menu.sub")), h("b", null, "LOS ", h("span", null, "MONTES")));

// ── Pantalla de idioma: sale siempre antes del menú ──
function IdiomaPantalla({ actual, elegir }) {
  const ref = useRef(null); useEffect(() => { ref.current && ref.current.focus(); }, []);
  return h("div", { className: "idioma" },
    h("div", { className: "idioma-caja" }, h(Logo),
      h("div", { className: "idioma-tits" }, ["es", "en", "pt"].map((k) => h("p", { key: k, className: k === actual ? "activo" : "" }, TEXTOS[k]["idioma.titulo"]))),
      h("div", { className: "idioma-botones" }, IDIOMAS.map(([k, nombre, band], i) =>
        h("button", { key: k, ref: k === actual ? ref : null, className: cx("idioma-btn", k === actual && "activo"), style: { animationDelay: i * 0.1 + "s" }, onClick: () => elegir(k) },
          h("span", { className: "bandera" }, BANDERAS[band]), h("b", null, nombre), k === actual && h("small", null, TEXTOS[k]["idioma.ultima"])))),
      h("p", { className: "nota" }, TEXTOS[actual]["idioma.nota"])));
}
// ── Carga ──
function Carga({ progreso, error }) {
  const cons = T("carga.consejos"), [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((n) => (n + 1) % cons.length), 4500); return () => clearInterval(id); }, []);
  return h("div", { className: "carga" }, h("img", { className: "portada", src: window.ARCHIVOS && ARCHIVOS["portada.jpg"] || "", alt: "" }),
    h("div", { className: "carga-titulo" }, h(Logo), h("p", null, T("menu.frase"))),
    h("div", { className: "carga-pie" }, error ? h("p", { className: "error" }, error) : h("p", { className: "consejo", key: i }, cons[i]),
      h("div", { className: "progreso" }, h("i", { style: { width: Math.round(progreso * 100) + "%" } })),
      h("div", { className: "etapa" }, h("span", null, progreso < 0.8 ? T("carga.modelos") : progreso < 1 ? T("carga.mundo") : T("carga.listo")), h("span", null, Math.round(progreso * 100) + "%"))));
}

// ── Menú ──
function Segmentado({ valor, opciones, onChange, etiqueta }) {
  return h("div", { className: "segmentado", role: "radiogroup", "aria-label": etiqueta }, opciones.map(([v, txt]) => h("button", { key: String(v), className: valor === v ? "activo" : "", role: "radio", "aria-checked": valor === v, onClick: () => { Sonido.clic(); onChange(v); } }, txt)));
}
function Deslizador({ valor, min, max, paso, onChange, etiqueta }) {
  return h("label", { className: "deslizador" }, h("span", null, etiqueta), h("input", { type: "range", min, max, step: paso, value: valor, onChange: (e) => onChange(Number(e.target.value)) }), h("b", null, Math.round(valor * 100) / 100));
}
function OpcionesCuerpo({ opciones, setOpciones }) {
  const [borrar, setBorrar] = useState(false);
  const o = opciones, set = (k, v) => setOpciones({ ...o, [k]: v });
  return h("div", { className: "opciones" },
    h("div", { className: "fila-op" }, h("span", null, T("op.idioma")), h(Segmentado, { valor: o.idioma, opciones: IDIOMAS.map(([k, n]) => [k, n]), onChange: (v) => set("idioma", v), etiqueta: T("op.idioma") })),
    h("div", { className: "fila-op" }, h("span", null, T("op.calidad"), h("small", null, T("op.calidadNota"))), h(Segmentado, { valor: o.calidad, opciones: [["alta", T("op.alta")], ["media", T("op.media")], ["baja", T("op.baja")]], onChange: (v) => set("calidad", v) })),
    h(Deslizador, { etiqueta: T("op.volumen"), valor: o.volumen, min: 0, max: 1, paso: 0.05, onChange: (v) => set("volumen", v) }),
    h(Deslizador, { etiqueta: T("op.musica"), valor: o.musica, min: 0, max: 1, paso: 0.05, onChange: (v) => set("musica", v) }),
    h(Deslizador, { etiqueta: T("op.sens"), valor: o.sens, min: 0.3, max: 2.5, paso: 0.1, onChange: (v) => set("sens", v) }),
    h(Deslizador, { etiqueta: T("op.brillo"), valor: o.brillo, min: 0.6, max: 1.8, paso: 0.05, onChange: (v) => set("brillo", v) }),
    h("div", { className: "fila-op" }, h("span", null, T("op.invertir")), h(Segmentado, { valor: o.invertirY, opciones: [[false, T("op.no")], [true, T("op.si")]], onChange: (v) => set("invertirY", v) })),
    h("div", { className: "fila-op" }, h("span", null, T("op.subtitulos")), h(Segmentado, { valor: o.subtitulos, opciones: [[true, T("op.si")], [false, T("op.no")]], onChange: (v) => set("subtitulos", v) })),
    h("button", { className: cx("boton sec chico", borrar && "rojo"), onClick: () => { if (!borrar) { setBorrar(true); return; } for (const k of ["partida", "diario", "stats"]) guardar(k, {}); setBorrar(false); location.reload(); } }, borrar ? T("op.borrarSeguro") : T("op.borrar")));
}
function AyudaCuerpo() {
  return h("div", { className: "ayuda" }, h("p", { className: "destacado" }, T("ay.objetivo")),
    h("div", { className: "teclas" }, T("ay.teclas").map(([k, d]) => h("div", { key: k }, h("kbd", null, k), h("span", null, d)))),
    h("div", { className: "consejos" }, T("ay.consejos").map(([a, b]) => h("div", { key: a, className: "tarjeta" }, h("b", null, a), h("p", null, b)))));
}
function Menu({ opciones, setOpciones, alIdioma }) {
  const [tab, setTab] = useState("jugar");
  const est = useJuego();
  const tabs = [["jugar", "▶"], ["coop", "⚑"], ["personaje", "◆"], ["diario", "✎"], ["records", "★"], ["opciones", "⚙"], ["ayuda", "?"], ["creditos", "i"]];
  const S = leer("stats", STATS_BASE), D = leer("diario", DIARIO_BASE), hayPartida = Juego.hayGuardada();
  const empezar = (continuar) => { Sonido.iniciar(); Sonido.confirmar(); const o = { ...opciones, saltarIntro: continuar ? true : !opciones.verIntro }; continuar ? Juego.continuar(o) : Juego.empezar(o); };
  return h("div", { className: "menu" },
    h("header", { className: "menu-barra" }, h(Logo, { chico: true }),
      h("nav", { className: "menu-tabs", role: "tablist" }, tabs.map(([k, ic]) => h("button", { key: k, role: "tab", "aria-selected": tab === k, className: tab === k ? "activa" : "", onClick: () => { Sonido.iniciar(); Sonido.clic(); setTab(k); } }, h("span", { "aria-hidden": true }, ic), h("em", null, T("menu." + k))))),
      h("button", { className: "boton sec chico idioma-actual", onClick: alIdioma }, IDIOMA.toUpperCase())),
    h("main", { className: "menu-cuerpo", key: tab },
      tab === "jugar" && h("div", { className: "jugar" },
        h("section", { className: "jugar-izq" },
          h("h1", { className: "titular" }, T("menu.frase")), h("p", { className: "bajada" }, T("menu.historia")),
          h("div", { className: "botonera" },
            h("button", { className: "boton grande", onClick: () => empezar(false) }, "▶ " + T("menu.nueva")),
            hayPartida && h("button", { className: "boton sec grande", onClick: () => empezar(true), title: T("menu.continuarNota") }, T("menu.continuar"))),
          h("div", { className: "fila-op" }, h("span", null, T("menu.dificultad")), h(Segmentado, { valor: opciones.dificultad, opciones: [["facil", T("dif.facil")], ["normal", T("dif.normal")], ["dificil", T("dif.dificil")]], onChange: (v) => setOpciones({ ...opciones, dificultad: v }) })),
          h("div", { className: "fila-op" }, h("span", null, T("menu.companeros")), h(Segmentado, { valor: opciones.companeros, opciones: [[0, T("menu.solo")], [1, "1"], [2, "2"], [3, "3"]], onChange: (v) => setOpciones({ ...opciones, companeros: v }) })),
          h("label", { className: "casilla" }, h("input", { type: "checkbox", checked: opciones.verIntro !== false, onChange: (e) => setOpciones({ ...opciones, verIntro: e.target.checked }) }), T("menu.intro"))),
        h("aside", { className: "jugar-der" },
          h("div", { className: "tarjeta rol-actual" }, h("small", null, T("per.titulo")), h("b", null, ROLES[opciones.rol].icono + " " + T("rol." + opciones.rol)), h("p", null, T("rol." + opciones.rol + "T"))),
          h("div", { className: "tarjeta" }, h("small", null, T("diario.titulo")), h("b", null, D.pistas.length + " / 12"), h("div", { className: "barra" }, h("i", { style: { width: (D.pistas.length / 12) * 100 + "%" } }))),
          h("div", { className: "tarjeta" }, h("small", null, T("rec.mejor")), h("b", null, S.mejorRescate + " / 6"), h("p", null, T("rec.finales") + ": " + S.finales + " · " + T("rec.muertes") + ": " + S.muertes)))),
      tab === "coop" && h(Coop, { opciones, setOpciones, est }),
      tab === "personaje" && h("div", { className: "panel-menu" }, h("h2", null, T("per.titulo")), h("p", { className: "bajada" }, T("per.bajada")),
        h("div", { className: "roles" }, Object.keys(ROLES).map((r, i) => h("button", { key: r, className: cx("rol", opciones.rol === r && "activo"), style: { animationDelay: i * 0.06 + "s" }, onClick: () => { Sonido.clic(); setOpciones({ ...opciones, rol: r }); } }, h("i", null, ROLES[r].icono), h("b", null, T("rol." + r)), h("p", null, T("rol." + r + "T")))))),
      tab === "diario" && h("div", { className: "panel-menu" }, h("h2", null, T("diario.titulo")), h("p", { className: "bajada" }, T("diario.bajada", { n: D.pistas.length })),
        D.pistas.length ? h("div", { className: "diario" }, Array.from({ length: 12 }, (_, i) => "p" + (i + 1)).map((id) => D.pistas.includes(id) ? h("details", { key: id, className: "pista" }, h("summary", null, T(id + ".t")), h("p", { className: "papel" }, T(id))) : h("div", { key: id, className: "pista falta" }, T("diario.falta"))))
          : h("p", null, T("diario.vacio"))),
      tab === "records" && h("div", { className: "panel-menu" }, h("h2", null, T("menu.records")),
        h("div", { className: "records" }, [["rec.partidas", S.partidas], ["rec.finales", S.finales], ["rec.rescatados", S.rescatados], ["rec.mejor", S.mejorRescate + " / 6"], ["rec.bajas", S.bajas], ["rec.muertes", S.muertes], ["rec.minutos", S.minutos]].map(([k, v]) => h("div", { key: k }, h("b", null, v), h("small", null, T(k)))))),
      tab === "opciones" && h("div", { className: "panel-menu" }, h("h2", null, T("op.titulo")), h(OpcionesCuerpo, { opciones, setOpciones })),
      tab === "ayuda" && h("div", { className: "panel-menu" }, h("h2", null, T("ay.titulo")), h(AyudaCuerpo)),
      tab === "creditos" && h("div", { className: "panel-menu creditos" }, h(Logo), h("p", null, T("cred.texto")),
        typeof SONIDOS_CREDITOS !== "undefined" && SONIDOS_CREDITOS.length > 0 && h("div", { className: "cred-sonidos" }, h("p", null, T("cred.sonidos")), h("ul", null, SONIDOS_CREDITOS.map((c) => h("li", { key: c.id }, h("b", null, c.id.replace(/_/g, " ")), " — ", c.autor, " · ", c.licencia, " · ", h("small", null, c.fuente.replace(/^https?:\/\//, "")))))))));
}
function Coop({ opciones, setOpciones, est }) {
  const [sala, setSala] = useState(leer("coop", { sala: "valle" }).sala), [nombre, setNombre] = useState(leer("coop", { nombre: "" }).nombre || ""), [msg, setMsg] = useState(null);
  const conectar = async (modo, host) => { guardar("coop", { sala, nombre }); const r = await Red.conectar(modo, sala, nombre || "Jugador", host); setMsg(r.error ? T("coop.sinRoom") : null); };
  const red = est.red;
  return h("div", { className: "panel-menu" }, h("h2", null, T("coop.titulo")), h("p", { className: "bajada" }, T("coop.bajada")),
    h("div", { className: "coop" },
      h("div", { className: "tarjeta" }, h("b", null, T("coop.computadora")), h("p", null, T("coop.computadoraNota")), h(Segmentado, { valor: opciones.companeros, opciones: [[0, T("menu.solo")], [1, "1"], [2, "2"], [3, "3"]], onChange: (v) => setOpciones({ ...opciones, companeros: v }) })),
      h("div", { className: "tarjeta" }, h("b", null, T("coop.red")), h("p", null, T("coop.redNota")),
        h("label", { className: "campo" }, T("coop.sala"), h("input", { value: sala, maxLength: 24, onChange: (e) => setSala(e.target.value) })),
        h("label", { className: "campo" }, T("coop.nombre"), h("input", { value: nombre, maxLength: 16, onChange: (e) => setNombre(e.target.value) })),
        red ? h("div", null, h("p", { className: "bien" }, T("coop.conectado", { s: red.sala, n: red.jugadores || 1 })), h("p", null, red.host ? T("coop.anfitrion") : T("coop.invitado")), h("button", { className: "boton sec chico", onClick: () => Red.salir() }, T("coop.salir")))
          : h("div", { className: "botonera" }, h("button", { className: "boton chico", onClick: () => conectar("room", true) }, T("coop.crear")), h("button", { className: "boton sec chico", onClick: () => conectar("room", false) }, T("coop.unirse")), h("button", { className: "boton sec chico", onClick: () => conectar("local", !est.red) }, T("coop.pestanas"))),
        msg && h("p", { className: "mal" }, msg))));
}

// ── Intro ──
function Intro({ est }) {
  return h("div", { className: "intro" }, h("div", { className: "franja arriba" }), h("div", { className: "franja abajo" }),
    est.intro < 6 && h("div", { className: "intro-titulo" }, h(Logo)),
    est.subtitulo && h("p", { className: "intro-sub", key: est.subtitulo.id }, est.subtitulo.texto),
    h("button", { className: "boton sec chico saltar", onClick: () => Juego.saltarIntro() }, T("intro.saltar") + " ›"));
}

// ── HUD ──
function Barra({ valor, clase, etiqueta }) { return h("div", { className: cx("barra-hud", clase), title: etiqueta }, h("i", { style: { width: clamp(valor, 0, 100) + "%" } }), h("span", null, etiqueta)); }
function Marcas({ est }) {
  const cam = Juego.cam; if (!cam || !est.marcas.length) return null;
  const w = GIRO.ancho(), hh = GIRO.alto(), v = new THREE.Vector3();
  return h("div", { className: "marcas" }, est.marcas.map((m, i) => { v.set(m.e.x, m.e.y + 2.1, m.e.z).project(cam); if (v.z > 1) return null; return h("i", { key: i, style: { left: ((v.x + 1) / 2) * w + "px", top: ((1 - v.y) / 2) * hh + "px" } }); }));
}
function Hud({ est }) {
  const arma = est.arma, cuerpo = ARMAS[arma].cuerpo;
  return h("div", { className: cx("hud", est.herido && "herido") },
    h("div", { className: "vineta-dano", style: { opacity: est.dano } }),
    h("div", { className: "objetivo" }, h("small", null, T("hud.objetivo")), h("p", null, est.objetivo),
      (est.rescatados > 0 || est.aSalvo > 0) && h("div", { className: "contadores" }, est.rescatados > 0 && h("span", null, "👤 " + T("hud.rescatados") + ": " + est.rescatados), est.aSalvo > 0 && h("span", null, "⌂ " + T("hud.aSalvo") + ": " + est.aSalvo))),
    est.alerta > 0.2 && h("div", { className: cx("alerta", est.alerta >= 0.99 && "vista") }, h("svg", { viewBox: "0 0 40 20", "aria-hidden": true }, h("path", { d: "M2 10Q20 -6 38 10Q20 26 2 10Z", fill: "none", stroke: "currentColor", strokeWidth: 2 }), h("circle", { cx: 20, cy: 10, r: 4 + est.alerta * 2, fill: "currentColor" })), h("span", null, est.alerta >= 0.99 ? T("hud.alerta") : T("hud.sospecha"))),
    h("div", { className: "vitales" }, h(Barra, { valor: est.vida, clase: "vida", etiqueta: T("hud.vida") }), h(Barra, { valor: est.estamina, clase: "aguante", etiqueta: T("hud.aguante") }), h(Barra, { valor: est.bateria, clase: cx("bateria", !est.linterna && "apagada"), etiqueta: T("hud.bateria") })),
    est.aliados.length > 0 && h("div", { className: "aliados-hud" }, est.aliados.map((a) => h("span", { key: a.rol }, ROLES[a.rol].icono + " " + a.nombre))),
    !est.manejando && h("div", { className: "arma-hud" }, h("b", null, T("item." + arma)), !cuerpo && h("span", { className: "municion" }, h("em", null, est.cargador), " / " + est.reserva), est.recargando && h("small", null, T("hud.recargando"))),
    est.manejando && h("div", { className: "arma-hud" }, h("b", null, est.grua ? T("hud.grua") : T("hud.manejando"))),
    !est.manejando && (est.apuntando || !TOCABLE) && h("div", { className: cx("mira", est.apuntando && "apunta", arma === "escopeta" && "ancha") }, h("i"), h("i"), h("i"), h("i")),
    est.accion && h("div", { className: "accion" }, h("kbd", null, TOCABLE ? "✋" : "E"), h("span", null, est.accion.texto), est.progreso > 0 && h("div", { className: "progreso-accion" }, h("i", { style: { width: est.progreso * 100 + "%" } }))),
    h("div", { className: "avisos", "aria-live": "polite" }, est.avisos.map((a) => h("div", { key: a.id, className: cx("aviso", a.tipo) }, a.texto))),
    est.subtitulo && Juego.opc.subtitulos && h("p", { className: "subtitulo", key: est.subtitulo.id }, est.subtitulo.quien && h("b", null, est.subtitulo.quien + ": "), est.subtitulo.texto),
    h(Marcas, { est }),
    !TOCABLE && h("button", { className: "boton-pausa", onClick: () => Juego.pausar(true), "aria-label": T("pausa.titulo") }, "❚❚"));
}

// ── Controles táctiles ──
function Tactil({ est }) {
  const palanca = useRef(null), [p, setP] = useState(null), mirar = useRef(null);
  const E = Juego.entrada;
  // Palanca: el primer dedo en la mitad izquierda. Mirar: arrastrar en la derecha.
  const tocarPalanca = (ev, fin) => {
    const t = ev.changedTouches[0], [x, y] = GIRO.aLocal(t.clientX, t.clientY);
    if (fin) { E.mover = [0, 0]; E.correr = false; setP(null); return; }
    let c = p; if (!c || ev.type === "touchstart") { c = { cx: x, cy: y, x, y }; } else c = { ...c, x, y };
    const dx = c.x - c.cx, dy = c.y - c.cy, R = 55, d = Math.hypot(dx, dy), k = Math.min(1, d / R);
    E.mover = d > 4 ? [(dx / (d || 1)) * k, (dy / (d || 1)) * k] : [0, 0]; E.correr = d > R * 1.25;
    setP(c);
  };
  const ult = useRef(null);
  const tocarMirar = (ev, fin) => {
    const t = ev.changedTouches[0];
    if (fin) { ult.current = null; return; }
    const [x, y] = GIRO.aLocal(t.clientX, t.clientY);
    if (ult.current) { const dx = x - ult.current[0], dy = y - ult.current[1]; Juego.mirar(dx, dy, 0.0045); }
    ult.current = [x, y];
  };
  const B = (k, texto, f, extra = {}) => h("button", { key: k, className: cx("bt", k, extra.activo && "activo"), onTouchStart: (e) => { e.preventDefault(); Sonido.iniciar(); f(true); }, onTouchEnd: (e) => { e.preventDefault(); extra.soltar && f(false); } }, texto);
  const manejando = est.manejando, grua = est.grua;
  return h("div", { className: "tactil" },
    h("div", { className: "zona-mover", onTouchStart: (e) => tocarPalanca(e), onTouchMove: (e) => tocarPalanca(e), onTouchEnd: (e) => tocarPalanca(e, true), onTouchCancel: (e) => tocarPalanca(e, true) },
      p && h("div", { className: "palanca", style: { left: p.cx + "px", top: p.cy + "px" } }, h("i", { style: { transform: `translate(${clamp(p.x - p.cx, -55, 55)}px, ${clamp(p.y - p.cy, -55, 55)}px)` } }))),
    h("div", { className: "zona-mirar", ref: mirar, onTouchStart: (e) => tocarMirar(e), onTouchMove: (e) => tocarMirar(e), onTouchEnd: (e) => tocarMirar(e, true) }),
    h("div", { className: "botones-t" },
      !manejando && [
        B("disparar", ARMAS[est.arma].cuerpo ? T("tac.golpe") : T("tac.disparar"), (v) => { if (v) { E.apuntarTactil = !ARMAS[est.arma].cuerpo; Juego.disparar(); } else E.apuntarTactil = false; }, { soltar: true }),
        B("golpe", T("tac.golpe"), () => Juego.golpear()),
        B("accion", T("tac.accion"), (v) => Juego.accion(v), { soltar: true }),
        B("agachar", T("tac.agachar"), () => Juego.agachar(), { activo: Juego.yo.agacha }),
        B("linterna", T("tac.linterna"), () => Juego.alternarLinterna(), { activo: est.linterna }),
        B("recargar", T("tac.recargar"), () => Juego.recargar()),
        B("curar", T("tac.curar"), () => Juego.curarse()),
        B("arma", "⇄", () => { const i = est.armas.indexOf(est.arma); Juego.cambiarArma(est.armas[(i + 1) % est.armas.length]); }),
        B("mochila", "🎒", () => Juego.abrirPanel("inventario")),
      ],
      manejando && !grua && [B("bajar", T("tac.bajar"), () => Vehiculos.bajar()), B("grua", T("tac.grua"), () => Juego.accion(true)), B("faros", T("tac.faros"), () => { if (Vehiculos.manejada) Vehiculos.manejada.farosPrendidos = !Vehiculos.manejada.farosPrendidos; }), B("bocina", T("tac.bocina"), (v) => (E.bocina = v), { soltar: true }), B("accion", T("tac.accion"), (v) => Juego.accion(v), { soltar: true })],
      manejando && grua && [B("cableBaja", T("tac.cableBaja"), (v) => (E.cableBaja = v), { soltar: true }), B("cableSube", T("tac.cableSube"), (v) => (E.cableSube = v), { soltar: true }), B("enganchar", T("tac.enganchar"), () => (E.enganchar = true)), B("grua", T("acc.salirGrua"), () => Vehiculos.alternarGrua())]),
    h("button", { className: "boton-pausa", onTouchStart: (e) => { e.preventDefault(); Juego.pausar(true); } }, "❚❚"),
    h("button", { className: "boton-mapa", onTouchStart: (e) => { e.preventDefault(); Juego.abrirPanel("mapa"); } }, "⌖"));
}

// ── Paneles ──
function Inventario({ est }) {
  const I = est.inv, cosas = ["botiquin", "venda", "bateria", "lata", "herramientas", "repuesto", "rueda", "bidon"];
  return h("div", { className: "velo", onClick: (e) => e.target === e.currentTarget && Juego.cerrarPanel() }, h("div", { className: "ventana inventario" },
    h("div", { className: "ventana-cab" }, h("h2", null, T("inv.titulo")), h("button", { className: "boton sec chico", onClick: () => Juego.cerrarPanel() }, T("inv.cerrar"))),
    h("div", { className: "ventana-cuerpo" },
      h("h3", null, T("inv.armas")),
      h("div", { className: "armas-inv" }, est.armas.map((a) => h("button", { key: a, className: cx("ranura", a === est.arma && "activa"), onClick: () => Juego.cambiarArma(a) }, h("b", null, T("item." + a)), !ARMAS[a].cuerpo && h("small", null, (a === est.arma ? est.cargador : Juego.yo.cargadores[a]) + " / " + (I["municion_" + a] || 0))))),
      h("div", { className: "cosas" }, cosas.map((k) => h("div", { key: k, className: cx("cosa", !I[k] && "vacia") }, h("b", null, I[k] || 0), h("span", null, T("item." + k))))),
      h("div", { className: "botonera" },
        h("button", { className: "boton chico", disabled: !(I.botiquin || I.venda) || est.vida >= 100, onClick: () => Juego.curarse() }, T("inv.cura")),
        h("button", { className: "boton chico", disabled: !I.lata, onClick: () => Juego.comer() }, T("inv.comer")),
        h("button", { className: "boton chico", disabled: !I.bateria, onClick: () => Juego.usarBateria() }, T("inv.bateria"))))));
}
function Mapa({ est }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const g = c.getContext("2d"), N = 300; c.width = c.height = N;
    const im = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -850 + (i / N) * 1700, z = -850 + (j / N) * 1700, hh = Terreno.baseValle(x, z), agua = Terreno.enAgua(x, z), k = (j * N + i) * 4;
      let col = agua ? [70, 90, 110] : hh > 230 ? [235, 230, 218] : hh > 90 ? [180, 170, 150] : [214, 204, 180];
      if (!agua && Terreno.distRuta(x, z) < 5) col = [150, 120, 90];
      const sombra = clamp(1 - (Terreno.baseValle(x + 6, z + 6) - hh) * 0.04, 0.6, 1.2);
      im.data[k] = col[0] * sombra; im.data[k + 1] = col[1] * sombra; im.data[k + 2] = col[2] * sombra; im.data[k + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, []);
  const pos = (x, z) => ({ left: ((x + 850) / 1700) * 100 + "%", top: ((z + 850) / 1700) * 100 + "%" });
  const y = Juego.yo, L = MAPA.lugares;
  return h("div", { className: "velo", onClick: (e) => e.target === e.currentTarget && Juego.cerrarPanel() }, h("div", { className: "ventana mapa" },
    h("div", { className: "ventana-cab" }, h("h2", null, T("mapa.titulo")), h("button", { className: "boton sec chico", onClick: () => Juego.cerrarPanel() }, T("inv.cerrar"))),
    h("div", { className: "mapa-lienzo" }, h("canvas", { ref }),
      Object.keys(L).map((k) => h("span", { key: k, className: "lugar", style: pos(L[k].x, L[k].z) }, T("lugar." + k))),
      h("span", { className: "lugar refugio", style: pos(Aliados.refugio().x, Aliados.refugio().z) }, "⌂ " + T("lugar.refugio")),
      y.zona === "ext" && h("i", { className: "yo", style: { ...pos(y.x, y.z), transform: `translate(-50%, -50%) rotate(${-y.yaw}rad)` } })),
    h("p", { className: "nota" }, T("mapa.nota"))));
}
function Nota({ est }) {
  const id = est.nota;
  return h("div", { className: "velo", onClick: (e) => e.target === e.currentTarget && Juego.cerrarPanel() }, h("div", { className: "ventana nota-ventana" },
    h("h2", null, T(id + ".t")), h("p", { className: "papel" }, T(id)), h("button", { className: "boton chico", onClick: () => Juego.cerrarPanel() }, T("inv.cerrar"))));
}
function Pausa({ opciones, setOpciones }) {
  const [ops, setOps] = useState(false);
  return h("div", { className: "velo" }, h("div", { className: "ventana pausa" }, h("h2", null, T("pausa.titulo")),
    ops ? h(OpcionesCuerpo, { opciones, setOpciones }) : h("div", { className: "botonera col" },
      h("button", { className: "boton grande", onClick: () => Juego.pausar(false) }, T("pausa.seguir")),
      h("button", { className: "boton sec", onClick: () => setOps(true) }, T("pausa.opciones")),
      h("button", { className: "boton sec", onClick: () => window.__alMenu && window.__alMenu() }, T("pausa.menu"))),
    ops && h("button", { className: "boton sec chico", onClick: () => setOps(false) }, "‹"),
    h("p", { className: "nota" }, T("pausa.guardar"))));
}
function Fin({ est, alMenu }) {
  const r = est.resumen; if (!r) return null;
  return h("div", { className: cx("fin", r.gano ? "gano" : "perdio") }, h("div", { className: "fin-caja" },
    h("h1", null, T("fin." + r.final)), h("p", null, T("fin." + r.final + "T")),
    h("div", { className: "records" }, [["fin.rescatados", r.rescatados + " / " + r.total], ["fin.bajas", r.bajas], ["fin.pistas", r.pistas + " / 12"], ["fin.minutos", r.minutos]].map(([k, v]) => h("div", { key: k }, h("b", null, v), h("small", null, T(k))))),
    h("div", { className: "botonera" }, h("button", { className: "boton grande", onClick: () => { Sonido.confirmar(); Juego.empezar({ saltarIntro: true }); } }, T("fin.otra")), h("button", { className: "boton sec", onClick: alMenu }, T("fin.menu")))));
}

// ── App ──
function App() {
  const lienzo = useRef(null), est = useJuego();
  const [progreso, setProgreso] = useState(0), [listo, setListo] = useState(false), [error, setError] = useState(null);
  const [opciones, setOpcionesE] = useState(() => { const o = leer("opciones", OPCIONES_BASE); ponerIdioma(o.idioma); return o; });
  const [idiomaListo, setIdiomaListo] = useState(false);
  const setOpciones = (o) => { if (o.idioma) ponerIdioma(o.idioma); setOpcionesE(o); guardar("opciones", o); Juego.aplicarOpciones(o); };
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await pausa(60);
        await Modelos.cargar((k) => vivo && setProgreso(k * 0.8));
        await pausa(30); setProgreso(0.85); await pausa(30);
        Juego.montar(lienzo.current, opciones); Juego.aplicarOpciones(opciones);
        setProgreso(1); await pausa(200); if (vivo) setListo(true);
      } catch (e) { console.error(e); setError(e.message || String(e)); }
    })();
    return () => { vivo = false; };
  }, []);
  const alMenu = () => { Juego.est.modo = "menu"; Juego.est.resumen = null; Juego.est.pausado = false; Sonido.musica("menu"); setIdiomaListo(false); };
  window.__alMenu = alMenu;
  const jugando = est.modo === "jugando";
  return h(React.Fragment, null,
    h("canvas", { ref: lienzo, className: "juego" }),
    h("div", { className: "grano", "aria-hidden": true, style: { backgroundImage: `url(${GRANO})` } }), h("div", { className: "vineta", "aria-hidden": true }),
    est.fundido > 0 && h("div", { className: "fundido", style: { opacity: est.fundido } }),
    !listo && h(Carga, { progreso, error }),
    listo && est.modo === "menu" && !idiomaListo && h(IdiomaPantalla, { actual: IDIOMA, elegir: (k) => { Sonido.iniciar(); Sonido.clic(); setOpciones({ ...opciones, idioma: k }); setIdiomaListo(true); Sonido.musica("menu"); } }),
    listo && est.modo === "menu" && idiomaListo && h(Menu, { opciones, setOpciones, alIdioma: () => setIdiomaListo(false) }),
    listo && est.modo === "intro" && h(Intro, { est }),
    listo && jugando && h(Hud, { est }),
    listo && jugando && TOCABLE && !est.panel && !est.pausado && h(Tactil, { est }),
    listo && jugando && est.panel === "inventario" && h(Inventario, { est }),
    listo && jugando && est.panel === "mapa" && h(Mapa, { est }),
    listo && jugando && est.panel === "nota" && h(Nota, { est }),
    listo && jugando && est.pausado && h(Pausa, { opciones, setOpciones }),
    listo && est.modo === "fin" && h(Fin, { est, alMenu }));
}
ReactDOM.createRoot(document.getElementById("raiz")).render(h(App));
