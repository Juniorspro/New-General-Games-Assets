"use strict";
// ════════════════════════════════════════════════════════════════════════
// Interfaz (React sin JSX): idioma, carga, menú con pestañas, HUD, la
// ventanilla con el retrato animado, documentos, tablet policial,
// alcoholímetro, el baúl con linterna, el acta, la pausa y el resumen.
// Todos los textos salen de textos.js (T); los toques pasan por GIRO.
// ════════════════════════════════════════════════════════════════════════
const h = React.createElement, { useState, useEffect, useRef } = React;

const TURNOS = [["dia", "09:00 – 17:00", "☀"], ["tarde", "17:00 – 01:00", "🌅"], ["noche", "21:00 – 05:00", "🌙"]];
const UMBRALES = [0, 60, 200, 350, 550, 800];
const nivelRango = (r) => { let i = 0; while (i < UMBRALES.length - 1 && r >= UMBRALES[i + 1]) i++; return i; };
const RANGO = (r) => T("rangos")[nivelRango(r)];
const cx = (...c) => c.filter(Boolean).join(" ");
const DECISION_ICONO = { pasar: "✓", multar: "✎", retener: "⛔", arrestar: "⛓" };

function useJuego() {
  const [, set] = useState(0);
  useEffect(() => Juego.suscribir(() => set((n) => n + 1)), []);
  return Juego.est;
}

// ════════════════════════════════════════════════════════════════════════
// Idioma (antes del menú, cada vez que se abre)
// ════════════════════════════════════════════════════════════════════════
function IdiomaPantalla({ actual, elegir }) {
  return h("div", { className: "idioma" },
    h("div", { className: "idioma-caja" },
      h(Logo),
      h("div", { className: "idioma-tits" }, ["es", "en", "pt"].map((k) => h("p", { key: k, className: k === actual ? "activo" : "" }, TEXTOS[k]["idioma.titulo"]))),
      h("div", { className: "idioma-botones" }, IDIOMAS.map(([k, nombre, bandera], i) =>
        h("button", { key: k, className: cx("idioma-btn", k === actual && "activo"), style: { animationDelay: i * 0.08 + "s" }, onClick: () => elegir(k) },
          h("span", { className: "bandera", "aria-hidden": true }, bandera), h("b", null, nombre), k === actual && h("small", null, "✓")))),
      h("p", { className: "idioma-sub" }, TEXTOS[actual] ? TEXTOS[actual]["idioma.sub"] : "")));
}

// ════════════════════════════════════════════════════════════════════════
// Carga
// ════════════════════════════════════════════════════════════════════════
function Carga({ progreso, error }) {
  const [i, setI] = useState(0), cons = T("consejos");
  useEffect(() => { const id = setInterval(() => setI((n) => (n + 1) % cons.length), 4200); return () => clearInterval(id); }, []);
  const portada = (window.ARCHIVOS || {})["portada.jpg"];
  return h("div", { className: "carga" },
    portada && h("img", { className: "portada", src: portada, alt: "" }),
    h("div", { className: "carga-titulo" }, h(Logo), h("p", null, T("carga.lugar"))),
    h("div", { className: "carga-pie" },
      h("p", { className: "consejo", key: i }, h("b", null, T("carga.consejo") + " "), cons[i]),
      h("div", { className: "progreso" }, h("i", { style: { width: Math.round(progreso * 100) + "%" } })),
      h("div", { className: "etapa" }, h("span", null, error ? T("carga.error") + error : T(progreso < 0.85 ? "carga.modelos" : "carga.armando")), h("span", null, Math.round(progreso * 100) + "%"))));
}
function Logo({ chico }) {
  return h("div", { className: cx("logo", chico && "chico") }, h("small", null, T("logo.chico")), h("b", null, "RUTA ", h("span", null, "11")));
}

// ════════════════════════════════════════════════════════════════════════
// Menú principal con pestañas
// ════════════════════════════════════════════════════════════════════════
function Insignia({ nivel }) {
  // Galones del rango: uno por nivel, estrella para el último.
  return h("div", { className: "insignia", "aria-hidden": true }, nivel >= 5 ? h("span", { className: "estrella" }, "★") : Array.from({ length: Math.max(1, nivel + 1) }, (_, i) => h("i", { key: i })));
}
function Legajo({ st }) {
  const n = nivelRango(st.mejor), sig = UMBRALES[n + 1], ant = UMBRALES[n], k = sig ? clamp((st.mejor - ant) / (sig - ant), 0, 1) : 1;
  return h("div", { className: "legajo" },
    h("div", { className: "legajo-cab" }, h(Insignia, { nivel: n }), h("div", null, h("small", null, T("menu.agente")), h("b", null, T("rangos")[n]))),
    h("div", { className: "barra-rango" }, h("i", { style: { width: k * 100 + "%" } })),
    h("p", { className: "legajo-sig" }, sig ? T("menu.proximo", { r: T("rangos")[n + 1], p: sig }) : T("menu.maximo")),
    st.turnos ? h("div", { className: "legajo-datos" },
      [["menu.stTurnos", st.turnos], ["menu.stMejor", st.mejor], ["menu.stArrestos", st.arrestos]].map(([k2, v]) => h("div", { key: k2 }, h("b", null, v), h("small", null, T(k2)))))
      : h("p", { className: "legajo-vacio" }, T("menu.sinTurnos")));
}
function Menu({ opciones, setOpciones, alEmpezar, alIdioma }) {
  const [tab, setTab] = useState("patrulla");
  const st = leer("stats", STATS_BASE), bandera = (IDIOMAS.find((x) => x[0] === IDIOMA) || IDIOMAS[0])[2];
  const tabs = [["patrulla", "🚓"], ["carrera", "🎖"], ["novedades", "📻"], ["opciones", "⚙"], ["ayuda", "❔"], ["creditos", "ℹ"]];
  return h("div", { className: "menu2" },
    h("header", { className: "menu-barra" },
      h(Logo, { chico: true }),
      h("nav", { className: "menu-tabs", role: "tablist" }, tabs.map(([k, ic]) => h("button", { key: k, role: "tab", "aria-selected": tab === k, className: tab === k ? "activa" : "", onClick: () => { Sonido.iniciar(); Sonido.clic(); setTab(k); } }, h("span", { "aria-hidden": true }, ic), h("em", null, T("menu." + k))))),
      h("button", { className: "idioma-mini", onClick: alIdioma, "aria-label": T("op.idioma") }, bandera, " ", IDIOMA.toUpperCase())),
    h("main", { className: "menu-cuerpo", key: tab },
      tab === "patrulla" && h("div", { className: "patrulla" },
        h("section", { className: "patrulla-izq" },
          h("h1", { className: "titular" }, T("menu.elegiTurno")),
          h("p", { className: "bajada" }, T("menu.bajada")),
          h("div", { className: "turnos2" }, TURNOS.map(([k, hs, ic], i) =>
            h("button", { key: k, className: cx("turno2", k, opciones.turno === k && "activo"), style: { animationDelay: i * 0.07 + "s" }, "aria-pressed": opciones.turno === k, onClick: () => { Sonido.iniciar(); Sonido.clic(); setOpciones({ ...opciones, turno: k }); } },
              h("span", { className: "turno-cielo", "aria-hidden": true }, h("i", null, ic)), h("b", null, T("turno." + k)), h("small", null, hs), h("p", null, T("turno." + k + ".d"))))),
          h("div", { className: "empezar-fila" },
            h("button", { className: "boton grande brillo", onClick: alEmpezar }, "▶ ", T("menu.empezar")),
            h("div", { className: "empezar-info" }, h("span", null, T("menu.config", { min: opciones.minutos, n: opciones.vehiculos })), opciones.primeroFalso && h("span", { className: "etiqueta-prueba" }, "🧪 ", T("menu.prueba"))))),
        h("aside", { className: "patrulla-der" }, h(Legajo, { st }))),
      tab === "carrera" && h("div", { className: "panel-menu" },
        h("div", { className: "carrera" },
          h(Legajo, { st }),
          h("div", { className: "carrera-stats" }, [["menu.stTurnos", st.turnos], ["menu.stMejor", st.mejor], ["menu.stArrestos", st.arrestos], ["menu.stHallazgos", st.hallazgos], ["menu.stMultas", st.multas], ["menu.stRecaudado", pesos(st.recaudado || 0)]].map(([k, v]) => h("div", { key: k }, h("b", null, v), h("small", null, T(k))))),
          h("ol", { className: "escalafon" }, T("rangos").map((r, i) => h("li", { key: r, className: cx(i === nivelRango(st.mejor) && "actual", st.mejor >= UMBRALES[i] && "logrado") }, h(Insignia, { nivel: i }), h("b", null, r), h("small", null, UMBRALES[i]))).reverse()))),
      tab === "novedades" && h("div", { className: "panel-menu" },
        h("div", { className: "parte" },
          h("div", { className: "parte-cab" }, h("b", null, T("menu.novedadesTit")), h("span", null, fecha(HOY))),
          ["menu.nov1", "menu.nov2", "menu.nov3", "menu.nov4"].map((k, i) => h("p", { key: k, style: { animationDelay: i * 0.08 + "s" } }, h("span", { className: "radio-ic" }, "📻"), T(k))),
          h("div", { className: "consejos-lista" }, T("consejos").map((c, i) => h("p", { key: i }, "💡 ", c))))),
      tab === "opciones" && h("div", { className: "panel-menu" }, h(OpcionesCuerpo, { opciones, setOpciones, alIdioma })),
      tab === "ayuda" && h("div", { className: "panel-menu" }, h(AyudaCuerpo)),
      tab === "creditos" && h("div", { className: "panel-menu" }, h("div", { className: "creditos" }, h(Logo), h("p", null, T("menu.creditosTxt")), typeof SONIDOS_CREDITOS !== "undefined" && h("div", { className: "cred-sonidos" }, h("p", null, T("menu.sonidosCred")), h("ul", null, SONIDOS_CREDITOS.map((c) => h("li", { key: c.id }, h("b", null, c.id.replace(/_/g, " ")), " — ", c.autor, " · ", c.licencia, " · ", h("small", null, c.fuente.replace(/^https?:\/\//, ""))))))))));
}
function Ventana({ titulo, cerrar, children, ancho }) {
  useEffect(() => { const f = (e) => e.key === "Escape" && cerrar(); addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [cerrar]);
  return h("div", { className: "velo", onClick: (e) => e.target === e.currentTarget && cerrar() },
    h("div", { className: "ventana", style: ancho ? { maxWidth: ancho } : null, role: "dialog", "aria-label": titulo },
      h("div", { className: "ventana-cab" }, h("h2", null, titulo), h("button", { className: "x", onClick: cerrar, "aria-label": T("cerrar") }, "✕")),
      h("div", { className: "ventana-cuerpo" }, children)));
}
function AyudaCuerpo() {
  const filas = [["pasar", "+25"], ["multar", "+25"], ["retener", "+50"], ["arrestar", "+100"]];
  return h("div", { className: "ayuda" },
    h("h3", null, T("ayuda.controles")),
    h("div", { className: "teclas" }, T("ayuda.teclas").map(([k, d]) => h("div", { key: k }, h("kbd", null, k), h("span", null, d)))),
    h("p", { className: "nota" }, T("ayuda.tactil")),
    h("h3", null, T("ayuda.revisar")),
    h("ul", null, ["docs", "tablet", "alco", "sosp", "arresto"].map((k) => h("li", { key: k }, h("b", null, T("ayuda." + k)), T("ayuda." + k + "T")))),
    h("h3", null, T("ayuda.resoluciones")),
    h("table", { className: "tabla" }, h("thead", null, h("tr", null, h("th", null, T("ayuda.colRes")), h("th", null, T("ayuda.colCuando")), h("th", null, T("ayuda.colPts")))),
      h("tbody", null, filas.map(([k, pts]) => h("tr", { key: k }, h("td", null, h("b", null, T("res." + k))), h("td", null, T("ayuda." + k + "T")), h("td", { className: "num" }, pts))))),
    h("p", { className: "nota" }, T("ayuda.errores"), h("b", null, T("ayuda.inocente")), T("ayuda.hallazgo")));
}
function Ayuda({ cerrar }) { return h(Ventana, { titulo: T("menu.ayuda"), cerrar, ancho: 760 }, h(AyudaCuerpo)); }
function Segmentado({ valor, opciones, onChange, etiqueta }) {
  return h("div", { className: "segmentado", role: "radiogroup", "aria-label": etiqueta }, opciones.map(([v, txt]) => h("button", { key: String(v), className: valor === v ? "activo" : "", role: "radio", "aria-checked": valor === v, onClick: () => onChange(v) }, txt)));
}
function OpcionesCuerpo({ opciones, setOpciones }) {
  const set = (k) => (v) => setOpciones({ ...opciones, [k]: v }), sn = [[true, T("si")], [false, T("no")]];
  return h("div", { className: "opciones" },
    h("label", null, T("op.idioma")), h(Segmentado, { etiqueta: T("op.idioma"), valor: IDIOMA, onChange: set("idioma"), opciones: IDIOMAS.map(([k, n, b]) => [k, b + " " + n]) }),
    h("label", null, T("op.calidad")), h(Segmentado, { etiqueta: T("op.calidad"), valor: opciones.calidad, onChange: set("calidad"), opciones: [["baja", T("op.baja")], ["media", T("op.media")], ["alta", T("op.alta")]] }),
    h("label", null, T("op.vehiculos")), h(Segmentado, { etiqueta: T("op.vehiculos"), valor: opciones.vehiculos, onChange: set("vehiculos"), opciones: [[8, "8"], [12, "12"], [16, "16"]] }),
    h("label", null, T("op.duracion")), h(Segmentado, { etiqueta: T("op.duracion"), valor: opciones.minutos, onChange: set("minutos"), opciones: [10, 16, 24].map((m) => [m, m + " " + T("min")]) }),
    h("label", null, T("op.primeroFalso")), h(Segmentado, { etiqueta: T("op.primeroFalso"), valor: opciones.primeroFalso, onChange: set("primeroFalso"), opciones: sn }),
    h("label", null, T("op.ayudas")), h(Segmentado, { etiqueta: T("op.ayudas"), valor: opciones.ayudas, onChange: set("ayudas"), opciones: sn }),
    h("label", { htmlFor: "sens" }, T("op.sens", { v: opciones.sens.toFixed(1) })), h("input", { id: "sens", type: "range", min: 0.4, max: 2.5, step: 0.1, value: opciones.sens, onChange: (e) => set("sens")(+e.target.value) }),
    h("label", { htmlFor: "vol" }, T("op.volumen", { v: Math.round(opciones.volumen * 100) })), h("input", { id: "vol", type: "range", min: 0, max: 1, step: 0.05, value: opciones.volumen, onChange: (e) => set("volumen")(+e.target.value) }));
}
function Opciones({ opciones, setOpciones, cerrar }) { return h(Ventana, { titulo: T("op.titulo"), cerrar, ancho: 560 }, h(OpcionesCuerpo, { opciones, setOpciones })); }

// ════════════════════════════════════════════════════════════════════════
// HUD
// ════════════════════════════════════════════════════════════════════════
function Hud({ est, alPausa }) {
  return h("div", { className: "hud" },
    h("div", { className: "hud-izq" },
      h("div", { className: "reloj" }, h("b", null, est.hora), h("small", null, T("hud.km"))),
      est.radio && h("div", { className: "radio", key: est.radio.id }, h("span", { className: "radio-ic", "aria-hidden": true }, "📻"), h("p", null, est.radio.texto))),
    h("div", { className: "hud-centro" },
      h("div", { className: cx("reputacion", est.reputacion < 40 && "baja") }, h("small", null, T("hud.rep")), h("b", null, est.reputacion))),
    h("div", { className: "hud-der" },
      h("div", { className: "dato" }, h("small", null, T("hud.atendidos")), h("b", null, `${est.atendidos}/${est.total}`)),
      h("div", { className: "dato" }, h("small", null, T("hud.recaudado")), h("b", null, pesos(est.recaudado))),
      h("div", { className: "dato" }, h("small", null, T("hud.fila")), h("b", null, est.cola)),
      h("button", { className: "pausa-btn", onClick: alPausa, "aria-label": T("pausa") }, "II")),
    h("div", { className: "mira", "aria-hidden": true }),
    h("div", { className: "avisos", "aria-live": "polite" }, est.avisos.slice(-4).map((a) => h("div", { key: a.id, className: cx("aviso", a.tipo) }, a.texto))),
    h(Estado, { est }),
    est.pista && !TOCABLE && h("div", { className: "pista" }, h("kbd", null, est.pista.tecla), est.pista.texto),
    !est.pista && est.parado && Juego.opciones.ayudas && est.atendidos < 2 && h("div", { className: "pista suave" }, T("hud.pistaSuave")),
    !est.bloqueado && !TOCABLE && !est.pausado && h("div", { className: "clic" }, T("hud.clic")),
    est.fin !== null && est.fin > 0 && h("div", { className: "fin-cuenta" }, T("hud.fin")));
}
function Estado({ est }) {
  const l = [];
  if (est.arresto) l.push(["⛓", T("est.esposar")]);
  if (est.seguidor) l.push(["🚶", T("est.llevar")]);
  if (est.zona > 0 && !est.patrulla) l.push(["🚓", T("est.zona", { n: est.zona })]);
  if (est.patrulla) l.push(["🚨", T(est.patrulla === "viene" ? "est.viene" : est.patrulla === "carga" ? "est.carga" : "est.va")]);
  if (est.linterna) l.push(["🔦", T("est.linterna")]);
  if (!l.length) return null;
  return h("div", { className: "estado" }, l.map(([i, txt]) => h("div", { key: txt }, h("span", { "aria-hidden": true }, i), txt)));
}

// ── controles táctiles (con el juego girado, el arrastre se rota con GIRO) ──
function Tactil({ est }) {
  const base = useRef(null), [p, setP] = useState(null);
  const mover = (e) => {
    const r = base.current.getBoundingClientRect(), rad = base.current.offsetWidth / 2;
    const [dx, dy] = GIRO.delta(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)), x = dx / rad, y = dy / rad;
    const n = Math.hypot(x, y), k = n > 1 ? 1 / n : 1; setP([x * k, y * k]); Juego.mover(x * k, -y * k, n > 1.05);
  };
  const soltar = () => { setP(null); Juego.mover(0, 0, false); };
  return h("div", { className: "tactil" },
    h("div", { className: "palanca", ref: base, onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); mover(e); }, onPointerMove: (e) => p && mover(e), onPointerUp: soltar, onPointerCancel: soltar },
      h("i", { style: p ? { transform: `translate(${p[0] * 42}px, ${p[1] * 42}px)` } : null })),
    h("div", { className: "botones-t" },
      est.acciones.map((a) => h("button", { key: a.id, className: "bt principal", onClick: () => Juego.accion(a.tecla) }, a.texto)),
      est.zona > 0 && !est.patrulla && h("button", { className: "bt", onClick: () => Juego.accion("Q") }, "🚓 ", T("tactil.patrullero")),
      !est.acciones.some((a) => a.tecla === "F") && h("button", { className: cx("bt redondo", est.linterna && "on"), onClick: () => Juego.accion("F"), "aria-label": T("est.linterna") }, "🔦")));
}

// ════════════════════════════════════════════════════════════════════════
// Ventanilla: retrato animado, diálogo y la inspección
// ════════════════════════════════════════════════════════════════════════
function Retrato() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, g = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), W = 340, H = 280;
    c.width = W * dpr; c.height = H * dpr;
    let raf = 0, mir = 0, objMir = 0, proxMir = 0, parp = 0, proxParp = 1.5;
    const dibujar = (ms) => {
      raf = requestAnimationFrame(dibujar);
      const I = Juego.insp; if (!I) return;
      const p = I.p, seg = ms / 1000, ahora = performance.now(), moto = p.modelo.tipo === "moto" || p.modelo.tipo === "cuatri", noche = Juego.est.noche;
      const nerv = p.estado === "nervioso" ? 1 : p.estado === "falso" ? 0.55 : 0, borr = p.estado === "borracho";
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Fondo: el interior del auto (o la ruta detrás de la moto).
      if (moto) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, noche > 0.5 ? "#141a33" : "#f0b27d"); gr.addColorStop(0.6, noche > 0.5 ? "#232a3f" : "#b7c9d8"); gr.addColorStop(1, "#4a4d52"); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      else {
        g.fillStyle = "#15171b"; g.fillRect(0, 0, W, H);
        const vid = g.createLinearGradient(W * 0.55, 0, W, H * 0.5); vid.addColorStop(0, noche > 0.5 ? "#1c2440" : "#9fb8c9"); vid.addColorStop(1, noche > 0.5 ? "#0c1022" : "#5f7a52");
        g.fillStyle = vid; g.beginPath(); g.moveTo(W * 0.62, H * 0.08); g.lineTo(W * 0.98, H * 0.12); g.lineTo(W * 0.98, H * 0.5); g.lineTo(W * 0.66, H * 0.5); g.fill();
        g.fillStyle = "#24272d"; g.beginPath(); g.roundRect ? g.roundRect(W * 0.3, H * 0.02, W * 0.4, H * 0.3, 18) : g.rect(W * 0.3, H * 0.02, W * 0.4, H * 0.3); g.fill(); // apoyacabezas
        g.fillStyle = "#1e2025"; g.fillRect(W * 0.2, H * 0.3, W * 0.6, H * 0.7);
      }
      // Mirada: el nervioso esquiva, más cuando le preguntás algo que lo compromete.
      if (seg > proxMir) { objMir = nerv && Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.3) : (Math.random() - 0.5) * 0.3; proxMir = seg + (nerv ? 0.35 + Math.random() * 0.8 : 1.5 + Math.random() * 2.5); }
      if (I.evita > ahora) objMir = Math.sign(objMir || 1) * 0.95;
      mir += (objMir - mir) * 0.3;
      if (seg > proxParp) { parp = 1; proxParp = seg + (nerv ? 1 + Math.random() * 1.5 : 2.5 + Math.random() * 3); } else parp = Math.max(0, parp - 0.2);
      const habla = I.habla > ahora, abre = habla ? Math.abs(Math.sin(seg * 16)) * 0.85 : 0;
      const jx = nerv ? (Math.sin(seg * 43) * 0.9 + Math.sin(seg * 27) * 0.6) * nerv : 0, sway = borr ? Math.sin(seg * 1.1) * 8 : 0;
      const cxr = W * 0.5 + jx + sway, cyr = H * 0.44 + (borr ? Math.sin(seg * 0.8) * 3 : 0) + (nerv ? Math.sin(seg * 37) * 0.5 : 0), s = 150;
      g.save(); if (borr) { g.translate(cxr, cyr); g.rotate(Math.sin(seg * 0.9) * 0.05); g.translate(-cxr, -cyr); }
      dibujarRostro(g, p.rostro, { cx: cxr, cy: cyr, s, ojosRojos: borr, mx: mir, my: borr ? 0.4 : nerv ? 0.2 : 0, parpado: borr ? Math.max(parp, 0.15) : parp, sudor: nerv * 0.95, boca: habla ? "habla" : borr ? "floja" : nerv ? "tensa" : "normal", abre });
      // Cinturón puesto (o no): cruza del hombro izquierdo del conductor a la cadera.
      if (!moto && !p.sinCinturon) { g.strokeStyle = "#2b2b2e"; g.lineWidth = s * 0.1; g.beginPath(); g.moveTo(cxr + s * 0.62, cyr + s * 0.5); g.lineTo(cxr - s * 0.5, cyr + s * 1.5); g.stroke(); g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 2; g.beginPath(); g.moveTo(cxr + s * 0.66, cyr + s * 0.52); g.lineTo(cxr - s * 0.46, cyr + s * 1.52); g.stroke(); }
      // Casco del motociclista (si lo lleva).
      if (moto && !p.sinCasco) { const w = s * 0.36 * p.rostro.ancho * 1.3, hh = s * 0.5; g.fillStyle = "#1b1d24"; g.beginPath(); g.ellipse(cxr, cyr - hh * 0.28, w, hh * 0.95, 0, Math.PI, Math.PI * 2); g.fill(); g.fillRect(cxr - w, cyr - hh * 0.3, s * 0.12, hh * 0.8); g.fillRect(cxr + w - s * 0.12, cyr - hh * 0.3, s * 0.12, hh * 0.8); g.fillStyle = "rgba(120,160,200,0.35)"; g.fillRect(cxr - w * 0.9, cyr - hh * 0.62, w * 1.8, hh * 0.18); }
      g.restore();
      // Marco de la ventanilla.
      if (!moto) { g.strokeStyle = "#0a0a0b"; g.lineWidth = 22; g.beginPath(); g.moveTo(-10, H * 0.1); g.lineTo(W * 0.15, 6); g.lineTo(W + 10, 6); g.stroke(); g.fillStyle = "#0a0a0b"; g.fillRect(W - 14, 0, 14, H); g.fillStyle = "#2a2d33"; g.fillRect(0, H - 16, W, 16); }
      const vig = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9); vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, `rgba(0,0,0,${0.35 + noche * 0.3})`); g.fillStyle = vig; g.fillRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h("canvas", { ref, className: "retrato", "aria-label": T("v.retrato") });
}
function Dialogo({ insp }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [insp.dialogo.length]);
  return h("div", { className: "dialogo", ref, "aria-live": "polite" }, insp.dialogo.map((d) => h("p", { key: d.id, className: d.quien }, h("b", null, T(d.quien === "yo" ? "v.vos" : "v.conductor")), d.texto)));
}
function Ventanilla({ alMulta }) {
  const insp = Juego.insp, [tab, setTab] = useState("docs");
  if (!insp) return null;
  const p = insp.p;
  return h("div", { className: "insp", role: "dialog", "aria-label": T("v.retrato") },
    h("div", { className: "insp-izq" },
      h("div", { className: "insp-cab" }, h("div", null, h("b", null, `${p.modelo.nombre} · ${colorTxt(p.colorNombre)}`), h("span", { className: "patente-chica" }, p.patente)), h("button", { className: "boton sec chico", onClick: () => Juego.cerrarPanel() }, T("volver"), " ", h("kbd", null, "Esc"))),
      h(Retrato),
      h(Dialogo, { insp }),
      h("div", { className: "preguntas" }, PREGUNTAS.map((k) => h("button", { key: k, className: "preg", onClick: () => Juego.preguntar(k) }, T("preg." + k))))),
    h("div", { className: "insp-der" },
      h("div", { className: "tabs", role: "tablist" }, [["docs", "v.docs"], ["tablet", "v.tablet"], ["alco", "v.alco"], ["resolver", "v.resolver"]].map(([k, clave]) => h("button", { key: k, role: "tab", "aria-selected": tab === k, className: tab === k ? "activa" : "", onClick: () => setTab(k) }, T(clave)))),
      h("div", { className: "tab-cuerpo" },
        tab === "docs" && h(Documentos, { insp }),
        tab === "tablet" && h(Tablet, { insp }),
        tab === "alco" && h(Alcoholimetro, { insp }),
        tab === "resolver" && h(Resolver, { insp, alMulta }))));
}

// ── documentos ──
function Vence({ fecha: f }) {
  const d = diasEntre(f, HOY), ay = Juego.opciones.ayudas;
  return h("span", { className: cx(ay && (d > 0 ? "mal" : "bien")) }, fecha(f), ay ? T(d > 0 ? "doc.vencida" : "doc.faltan", { d: Math.abs(d) }) : "");
}
function Documentos({ insp }) {
  const p = insp.p, d = p.docs;
  if (!insp.docs) return h("div", { className: "vacio" }, h("p", null, T("doc.noPediste")), h("button", { className: "boton", onClick: () => Juego.pedirDocs() }, T("doc.pedir")));
  const falta = (clave) => h("div", { className: "doc faltante" }, h("b", null, T(clave)), h("p", null, T("doc.noPresento")));
  const cat = d.licencia.categoria, clase = cat + T(cat === "A.3" ? "doc.claseA3" : cat.startsWith("A") ? "doc.claseA" : cat.startsWith("C") ? "doc.claseC" : "doc.claseB");
  return h("div", null,
    h("div", { className: "hoy" }, h("span", null, T("doc.hoy"), h("b", null, fecha(HOY))), h("span", null, T("doc.patente"), h("b", { className: "patente-chica" }, p.patente))),
    h("div", { className: "docs" },
      h("div", { className: "doc dni" },
        h("div", { className: "doc-cab" }, T("doc.dni")),
        h("div", { className: "dni-cuerpo" }, h("img", { src: fotoCarnet(d.dni.rostro), alt: T("doc.fotoDni") }),
          h("dl", null, h("dt", null, T("doc.apellido")), h("dd", null, d.dni.nombre), h("dt", null, T("doc.nac")), h("dd", null, fecha(d.dni.nacimiento)), h("dt", null, T("doc.documento")), h("dd", { className: "grande" }, dniTexto(d.dni.numero))))),
      d.licencia.presente ? h("div", { className: "doc lic" },
        h("div", { className: "doc-cab" }, T("doc.lic")),
        h("dl", null, h("dt", null, T("doc.titular")), h("dd", null, d.licencia.nombre), h("dt", null, T("doc.nro")), h("dd", null, dniTexto(d.licencia.numero)), h("dt", null, T("doc.clase")), h("dd", null, clase), h("dt", null, T("doc.vence")), h("dd", null, h(Vence, { fecha: d.licencia.vence })))) : falta("doc.lic"),
      d.cedula.presente ? h("div", { className: "doc ced" },
        h("div", { className: "doc-cab" }, T("doc.ced")),
        h("dl", null, h("dt", null, T("doc.dominio")), h("dd", { className: "grande" }, d.cedula.patente), h("dt", null, T("doc.titular")), h("dd", null, d.cedula.titular), h("dt", null, T("doc.modelo")), h("dd", null, d.cedula.modelo), h("dt", null, T("doc.color")), h("dd", null, colorTxt(d.cedula.color)))) : falta("doc.cedCorta"),
      d.seguro.presente ? h("div", { className: "doc seg" },
        h("div", { className: "doc-cab" }, T("doc.seg")),
        h("dl", null, h("dt", null, T("doc.compania")), h("dd", null, d.seguro.compania), h("dt", null, T("doc.poliza")), h("dd", null, d.seguro.poliza), h("dt", null, T("doc.vigente")), h("dd", null, h(Vence, { fecha: d.seguro.vence })))) : falta("doc.segCorto")));
}

// ── tablet policial ──
function Tablet({ insp }) {
  const [sec, setSec] = useState("personas"), [dni, setDni] = useState(""), [pat, setPat] = useState(""), [rp, setRp] = useState(null), [rv, setRv] = useState(null);
  const p = insp.p, R = Juego.registro;
  const buscarP = (x) => { const v = x ?? dni; setDni(String(v)); setRp({ q: v, r: R.persona(v) || null }); Sonido.bip(); };
  const buscarV = (x) => { const v = x ?? pat; setPat(v); setRv({ q: v, r: R.vehiculo(v) || null }); Sonido.bip(); };
  return h("div", { className: "tablet" },
    h("div", { className: "tablet-barra" }, h("span", null, T("tab.barra")), h("span", null, Juego.est.hora)),
    h("div", { className: "tablet-tabs" }, [["personas", T("tab.personas")], ["vehiculos", T("tab.vehiculos")], ["novedades", T("tab.novedades", { n: Juego.novedades.length })]].map(([k, txt]) => h("button", { key: k, className: sec === k ? "activa" : "", onClick: () => setSec(k) }, txt))),
    sec === "personas" && h("div", { className: "tablet-sec" },
      h("form", { className: "buscar", onSubmit: (e) => { e.preventDefault(); buscarP(); } }, h("input", { value: dni, onChange: (e) => setDni(e.target.value), placeholder: T("tab.dni"), inputMode: "numeric", "aria-label": T("tab.dni") }), h("button", { className: "boton chico" }, T("tab.buscar"))),
      insp.docs && h("button", { className: "rapido", onClick: () => buscarP(p.docs.dni.numero) }, T("tab.usarDni", { d: dniTexto(p.docs.dni.numero) })),
      rp && (rp.r ? h("div", { className: cx("ficha", rp.r.captura && "alerta") },
        rp.r.captura && h("div", { className: "banda" }, T("tab.captura")),
        h("div", { className: "ficha-cuerpo" }, h("img", { src: fotoCarnet(rp.r.rostro), alt: T("tab.fotoSistema") }),
          h("dl", null, h("dt", null, T("tab.nombre")), h("dd", null, rp.r.nombre), h("dt", null, "DNI"), h("dd", null, dniTexto(rp.r.dni)), h("dt", null, T("doc.nac")), h("dd", null, fecha(rp.r.nacimiento)), h("dt", null, T("tab.antecedentes")), h("dd", null, T(rp.r.antecedentes)), rp.r.captura && h("dt", null, T("tab.motivo")), rp.r.captura && h("dd", null, T(rp.r.motivo)))))
        : h("div", { className: "ficha vacia" }, T("tab.sinResultados", { q: rp.q })))),
    sec === "vehiculos" && h("div", { className: "tablet-sec" },
      h("form", { className: "buscar", onSubmit: (e) => { e.preventDefault(); buscarV(); } }, h("input", { value: pat, onChange: (e) => setPat(e.target.value.toUpperCase()), placeholder: T("tab.patente"), "aria-label": T("tab.patente") }), h("button", { className: "boton chico" }, T("tab.buscar"))),
      h("div", { className: "rapidos" }, h("button", { className: "rapido", onClick: () => buscarV(p.patente) }, T("tab.patVeh", { p: p.patente })), insp.docs && p.docs.cedula.presente && h("button", { className: "rapido", onClick: () => buscarV(p.docs.cedula.patente) }, T("tab.patCed", { p: p.docs.cedula.patente }))),
      rv && (rv.r ? h("div", { className: cx("ficha", rv.r.robado && "alerta") },
        rv.r.robado && h("div", { className: "banda" }, T("tab.secuestro")),
        h("dl", { className: "sola" }, h("dt", null, T("doc.dominio")), h("dd", null, rv.r.patente), h("dt", null, T("doc.titular")), h("dd", null, rv.r.titular), h("dt", null, T("doc.modelo")), h("dd", null, rv.r.modelo), h("dt", null, T("doc.color")), h("dd", null, colorTxt(rv.r.color))))
        : h("div", { className: "ficha vacia" }, T("tab.noFigura", { q: rv.q })))),
    sec === "novedades" && h("div", { className: "tablet-sec novedades" }, Juego.novedades.length ? Juego.novedades.map((n, i) => h("p", { key: i, className: n.tipo }, h("b", null, n.hora), n.texto)) : h("p", null, T("tab.sinNovedades"))));
}

// ── alcoholímetro ──
function Alcoholimetro({ insp }) {
  const [anim, setAnim] = useState(null), [valor, setValor] = useState(insp.soplo);
  useEffect(() => {
    if (!anim) return; let raf; const t0 = performance.now(), dur = 2600;
    const f = (ms) => { const k = clamp((ms - t0) / dur, 0, 1); setValor(anim.v * (1 - (1 - k) ** 3) + (k < 1 ? Math.random() * 0.03 : 0)); if (k < 1) raf = requestAnimationFrame(f); else { setAnim(null); setValor(anim.v); Sonido.bip(false); } };
    raf = requestAnimationFrame(f); const bips = setInterval(() => Sonido.bip(true), 380);
    return () => { cancelAnimationFrame(raf); clearInterval(bips); };
  }, [anim]);
  const medido = insp.soplo !== null && !anim, pos = medido && insp.soplo > 0.5, v = valor ?? 0, dec = IDIOMA === "en" ? "." : ",";
  return h("div", { className: "alco" },
    h("div", { className: "aparato" },
      h("div", { className: "pantallita" }, h("b", null, v.toFixed(2).replace(".", dec)), h("small", null, "g/l")),
      h("div", { className: "barra-alco" }, h("i", { style: { width: (v / 2.5) * 100 + "%" }, className: v > 0.5 ? "alta" : "" }), h("span", { className: "limite", style: { left: (0.5 / 2.5) * 100 + "%" } }, "0,5")),
      h("div", { className: "escala" }, ["0,0", "0,5", "1,0", "1,5", "2,0", "2,5"].map((x) => h("span", { key: x }, x.replace(",", dec)))),
      medido && h("div", { className: cx("resultado", pos ? "mal" : "bien") }, T(pos ? "alco.positivo" : "alco.negativo")),
      h("button", { className: "boton", disabled: !!anim, onClick: () => { const x = Juego.soplar(); setValor(0); setAnim({ v: x }); } }, T(anim ? "alco.soplando" : medido ? "alco.repetir" : "alco.soplar"))),
    h("p", { className: "nota" }, T("alco.nota")));
}

// ── resolver ──
const GRUPOS = { multar: ["sinCinturon", "lucesQuemadas", "sinSeguro", "licenciaVencida"], retener: ["alcohol", "licenciaVieja", "sinCedula", "sinLicencia"], arrestar: ["captura", "drogas", "armas", "identidad", "robado"] };
function Resolver({ insp, alMulta }) {
  const [dec, setDec] = useState(null), [cargos, setCargos] = useState([]);
  const p = insp.p;
  const alternar = (k) => setCargos((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const total = cargos.reduce((s, k) => s + (FALTAS[k].monto || 0), 0);
  const confirmar = () => {
    if (!dec) return;
    const c = dec === "pasar" ? [] : cargos.filter((k) => GRUPOS[dec].includes(k));
    if (dec === "multar") alMulta({ cargos: c, total: c.reduce((s, k) => s + (FALTAS[k].monto || 0), 0), p, hora: Juego.est.hora });
    Juego.resolver(dec, c);
  };
  const opcion = (k) => h("button", { className: cx("opcion", k, dec === k && "activa"), onClick: () => { setDec(k); setCargos([]); }, "aria-pressed": dec === k }, h("span", { className: "ic", "aria-hidden": true }, DECISION_ICONO[k]), h("b", null, T("res." + k)), h("small", null, T("res." + k + "D")));
  return h("div", { className: "resolver" },
    insp.hallazgos.length > 0 && h("div", { className: "evidencia" }, T("res.evidencia", { x: insp.hallazgos.map((o) => objTxt(o.id).toLowerCase()).join(", ") })),
    h("div", { className: "opciones-res" }, ["pasar", "multar", "retener", "arrestar"].map(opcion)),
    dec && dec !== "pasar" && h("div", { className: "cargos" },
      h("p", null, T(dec === "multar" ? "res.marca" : "res.motivo")),
      GRUPOS[dec].map((k) => h("label", { key: k, className: "cargo" }, h("input", { type: "checkbox", checked: cargos.includes(k), onChange: () => alternar(k) }), h("span", null, Juego.nombreFalta(k, p)), dec === "multar" && h("em", null, pesos(FALTAS[k].monto)))),
      dec === "multar" && h("p", { className: "total" }, T("res.total"), h("b", null, pesos(total)))),
    h("button", { className: cx("boton grande", dec === "arrestar" && "rojo"), disabled: !dec || (dec === "multar" && !cargos.length), onClick: confirmar },
      T(!dec ? "res.elegi" : dec === "pasar" ? "res.pasar" : dec === "multar" ? "res.labrar" : dec === "retener" ? "res.retenerB" : "res.arrestarB")));
}

// ── acta impresa ──
function Acta({ acta }) {
  return h("div", { className: "acta", role: "status" },
    h("div", { className: "acta-cab" }, h("b", null, T("acta.tit")), h("small", null, T("acta.puesto", { f: fecha(HOY), h: acta.hora }))),
    h("p", null, h("b", null, T("acta.infractor")), acta.p.docs.dni.nombre), h("p", null, h("b", null, T("acta.dominio")), acta.p.patente, " · ", acta.p.modelo.nombre),
    h("ul", null, acta.cargos.map((k) => h("li", { key: k }, h("span", null, Juego.nombreFalta(k, acta.p)), h("b", null, pesos(FALTAS[k].monto))))),
    h("p", { className: "acta-total" }, T("acta.total"), h("b", null, pesos(acta.total))));
}

// ════════════════════════════════════════════════════════════════════════
// Baúl con linterna: mover las cosas y encontrar lo escondido
// ════════════════════════════════════════════════════════════════════════
const BW = 820, BH = 500;
const TAM_OBJ = { rueda: [150, 150, "circulo"], garrafa: [96, 96, "circulo"], herramientas: [170, 80], bolso: [190, 100], mochila: [120, 110], paquete: [74, 48], arma: [118, 44, "arma"], cajon: [150, 100] };
function armarBaul(insp) {
  if (insp.baulCosas) return insp.baulCosas;
  const p = insp.p, r = Math.random, cosas = [], moto = p.modelo.tipo === "moto" || p.modelo.tipo === "cuatri", camion = p.modelo.tipo === "camion";
  const tam = (id) => TAM_OBJ[id] || [140, 105];
  const escala = moto ? 0.8 : 1, zona = moto ? { x: 230, y: 110, w: 360, h: 280 } : { x: 70, y: 80, w: BW - 140, h: BH - 150 };
  const legales = p.baul.filter((o) => !o.ilegal), ocultos = p.baul.filter((o) => o.ilegal && o.escondido), vistos = p.baul.filter((o) => o.ilegal && !o.escondido);
  if (camion) for (let i = 0; i < 4; i++) legales.push({ id: "cajamerc", color: "#a07a4a", ilegal: false });
  const tapas = legales.map((o, i) => { const [w, hh, forma] = tam(o.id), col = i % 3, fila = Math.floor(i / 3); return { o, id: o.id, color: o.color, w: w * escala, h: hh * escala, forma, x: zona.x + col * (zona.w / 3) + r() * 30, y: zona.y + fila * (zona.h / 2.2) + r() * 30 }; });
  if (ocultos.length && !tapas.length) tapas.push({ o: null, id: "alfombra", color: "#3a3a40", w: 300, h: 190, x: zona.x + zona.w / 2 - 150, y: zona.y + 40 });
  ocultos.forEach((o, i) => { const tp = tapas[i % tapas.length], [w, hh, forma] = tam(o.id); cosas.push({ o, id: o.id, color: o.color, w: w * escala, h: hh * escala, forma, x: tp.x + tp.w / 2 - (w * escala) / 2 + (i % 3) * 10, y: tp.y + tp.h / 2 - (hh * escala) / 2 + (i % 2) * 8 }); });
  cosas.push(...tapas);
  vistos.forEach((o) => { const [w, hh, forma] = tam(o.id); cosas.push({ o, id: o.id, color: o.color, w: w * escala, h: hh * escala, forma, x: zona.x + r() * (zona.w - w), y: zona.y + zona.h - hh - r() * 40 }); });
  insp.baulCosas = cosas; return cosas;
}
function Baul({ est }) {
  const insp = Juego.insp, ref = useRef(null), [, setN] = useState(0);
  useEffect(() => {
    if (!insp) return;
    const c = ref.current, g = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1); c.width = BW * dpr; c.height = BH * dpr;
    const sombra = document.createElement("canvas"); sombra.width = BW; sombra.height = BH; const gs = sombra.getContext("2d");
    const cosas = armarBaul(insp); let luz = [BW / 2, BH / 2], arr = null, raf = 0;
    // offsetX/offsetY vienen en el espacio propio del lienzo (ya contemplan el giro
    // del juego); el lienzo va con object-fit: contain, así que se descuentan las franjas.
    const pos = (e) => { const k = Math.min(c.clientWidth / BW, c.clientHeight / BH), ox = (c.clientWidth - BW * k) / 2, oy = (c.clientHeight - BH * k) / 2; return [(e.offsetX - ox) / k, (e.offsetY - oy) / k]; };
    const tocada = (x, y) => { for (let i = cosas.length - 1; i >= 0; i--) { const o = cosas[i]; if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return i; } return -1; };
    const abajo = (e) => { c.setPointerCapture(e.pointerId); const [x, y] = pos(e); luz = [x, y]; const i = tocada(x, y); if (i >= 0) { const o = cosas.splice(i, 1)[0]; cosas.push(o); arr = { o, dx: x - o.x, dy: y - o.y, x0: x, y0: y }; } };
    const mueve = (e) => { const [x, y] = pos(e); luz = [x, y]; if (arr) { arr.o.x = clamp(x - arr.dx, 20, BW - arr.o.w - 20); arr.o.y = clamp(y - arr.dy, 30, BH - arr.o.h - 20); } };
    const arriba = (e) => { if (arr) { const [x, y] = pos(e); if (Math.hypot(x - arr.x0, y - arr.y0) < 7 && arr.o.o && arr.o.o.ilegal) { Juego.secuestrar(arr.o.o); setN((n) => n + 1); } else if (Math.hypot(x - arr.x0, y - arr.y0) > 7) Sonido.clic(); } arr = null; };
    c.addEventListener("pointerdown", abajo); c.addEventListener("pointermove", mueve); c.addEventListener("pointerup", arriba); c.addEventListener("pointercancel", arriba);
    const dibujar = (ms) => {
      raf = requestAnimationFrame(dibujar); const seg = ms / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Fondo: alfombra gris del baúl con sus paredes.
      g.fillStyle = "#2c2d31"; g.fillRect(0, 0, BW, BH);
      g.fillStyle = "#35363b"; g.fillRect(40, 50, BW - 80, BH - 90);
      g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1; for (let x = 44; x < BW - 40; x += 6) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x, BH - 40); g.stroke(); }
      g.fillStyle = "#1c1d20"; g.fillRect(0, 0, BW, 50); g.fillRect(0, BH - 40, BW, 40); g.fillRect(0, 0, 40, BH); g.fillRect(BW - 40, 0, 40, BH);
      for (const o of cosas) {
        g.save(); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 14; g.shadowOffsetY = 6; g.fillStyle = o.color;
        if (o.forma === "circulo") { g.beginPath(); g.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); g.fill(); if (o.id === "rueda") { g.shadowColor = "transparent"; g.fillStyle = "#8a8d93"; g.beginPath(); g.arc(o.x + o.w / 2, o.y + o.h / 2, o.w * 0.22, 0, Math.PI * 2); g.fill(); } }
        else if (o.forma === "arma") { g.beginPath(); g.moveTo(o.x, o.y + 6); g.lineTo(o.x + o.w, o.y + 6); g.lineTo(o.x + o.w, o.y + 20); g.lineTo(o.x + 42, o.y + 20); g.lineTo(o.x + 34, o.y + o.h); g.lineTo(o.x + 14, o.y + o.h); g.lineTo(o.x + 20, o.y + 20); g.lineTo(o.x, o.y + 20); g.fill(); }
        else { g.beginPath(); g.roundRect ? g.roundRect(o.x, o.y, o.w, o.h, 8) : g.rect(o.x, o.y, o.w, o.h); g.fill(); g.shadowColor = "transparent"; g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(o.x + 4, o.y + 4, o.w - 8, o.h * 0.25); if (o.id === "paquete") { g.strokeStyle = "#8b7b4f"; g.lineWidth = 3; for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(o.x + (o.w * k) / 3, o.y); g.lineTo(o.x + (o.w * k) / 3, o.y + o.h); g.stroke(); } } }
        g.restore();
        g.fillStyle = "rgba(255,255,255,0.85)"; g.font = "600 13px Barlow, Arial"; g.textAlign = "center"; g.fillText(objTxt(o.id), o.x + o.w / 2, o.y + o.h + 16);
        if (o.o && o.o.visto) { g.strokeStyle = "#ff3b3b"; g.lineWidth = 3; g.setLineDash([8, 5]); g.strokeRect(o.x - 6, o.y - 6, o.w + 12, o.h + 12); g.setLineDash([]); g.fillStyle = "#ff3b3b"; g.font = "800 13px Barlow, Arial"; g.fillText(T("baul.secuestrado"), o.x + o.w / 2, o.y - 12); }
      }
      // Oscuridad y el círculo de la linterna (tiembla un poco en la mano).
      const osc = 0.86 + est.noche * 0.1, lx = luz[0] + Math.sin(seg * 7) * 1.5, ly = luz[1] + Math.cos(seg * 5) * 1.5;
      gs.globalCompositeOperation = "source-over"; gs.clearRect(0, 0, BW, BH); gs.fillStyle = `rgba(0,0,0,${osc})`; gs.fillRect(0, 0, BW, BH);
      gs.globalCompositeOperation = "destination-out"; const gr = gs.createRadialGradient(lx, ly, 10, lx, ly, 135); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.7, "rgba(0,0,0,0.85)"); gr.addColorStop(1, "rgba(0,0,0,0)"); gs.fillStyle = gr; gs.beginPath(); gs.arc(lx, ly, 135, 0, Math.PI * 2); gs.fill();
      g.drawImage(sombra, 0, 0);
      const cal = g.createRadialGradient(lx, ly, 0, lx, ly, 135); cal.addColorStop(0, "rgba(255,240,200,0.12)"); cal.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = cal; g.fillRect(0, 0, BW, BH);
    };
    raf = requestAnimationFrame(dibujar);
    return () => { cancelAnimationFrame(raf); c.removeEventListener("pointerdown", abajo); c.removeEventListener("pointermove", mueve); c.removeEventListener("pointerup", arriba); c.removeEventListener("pointercancel", arriba); };
  }, [insp]);
  if (!insp) return null;
  const ha = insp.hallazgos, tipo = insp.p.modelo.tipo;
  return h("div", { className: "baul", role: "dialog", "aria-label": T("baul.auto") },
    h("div", { className: "baul-cab" }, h("div", null, h("b", null, T(tipo === "camion" ? "baul.camion" : tipo === "moto" ? "baul.moto" : tipo === "cuatri" ? "baul.cuatri" : "baul.auto")), h("small", null, T("baul.ayuda"))), h("button", { className: "boton sec chico", onClick: () => { Sonido.baul(); Juego.cerrarPanel(); } }, T("cerrar"), " ", h("kbd", null, "Esc"))),
    h("canvas", { ref, className: "baul-lienzo" }),
    h("div", { className: cx("baul-pie", ha.length && "mal") }, ha.length ? T("baul.secuestraste", { x: ha.map((o) => objTxt(o.id).toLowerCase()).join(", ") }) : T("baul.nada")));
}

// ════════════════════════════════════════════════════════════════════════
// Pausa y resumen
// ════════════════════════════════════════════════════════════════════════
function Pausa({ opciones, setOpciones }) {
  const [vista, setVista] = useState(null);
  return h("div", { className: "velo" },
    h("div", { className: "ventana chica" },
      h("h2", null, T("pausa")),
      h("button", { className: "boton grande", onClick: () => Juego.pausar(false) }, T("pausa.seguir")),
      h("button", { className: "boton sec", onClick: () => setVista("ayuda") }, T("menu.ayuda")),
      h("button", { className: "boton sec", onClick: () => setVista("opciones") }, T("menu.opciones")),
      h("button", { className: "boton sec", onClick: () => Juego.alMenu() }, T("pausa.abandonar"))),
    vista === "ayuda" && h(Ayuda, { cerrar: () => setVista(null) }),
    vista === "opciones" && h(Opciones, { opciones, setOpciones, cerrar: () => setVista(null) }));
}
function Resumen() {
  const r = Juego.resumen; if (!r) return null;
  const ok = r.hist.filter((x) => x.ok).length, pct = r.hist.length ? Math.round((ok / r.hist.length) * 100) : 0;
  return h("div", { className: "velo" },
    h("div", { className: "ventana resumen" },
      h("div", { className: "ventana-cab" }, h("h2", null, T(r.motivo === "relevado" ? "fin.relevado" : "fin.fin"))),
      h("div", { className: "ventana-cuerpo" },
        h("div", { className: "rango" }, h(Insignia, { nivel: nivelRango(r.reputacion) }), h("small", null, T("fin.calif")), h("b", null, r.motivo === "relevado" ? T("fin.sumario") : RANGO(r.reputacion))),
        h("div", { className: "totales" },
          [["hud.rep", r.reputacion], ["hud.atendidos", `${r.atendidos}/${r.total}`], ["fin.aciertos", pct + " %"], ["hud.recaudado", pesos(r.recaudado)], ["fin.mejor", r.mejor]].map(([k, v]) => h("div", { key: k }, h("small", null, T(k)), h("b", null, v)))),
        r.sinTrasladar > 0 && h("p", { className: "nota" }, T("fin.sinTrasladar", { n: r.sinTrasladar })),
        h("div", { className: "tabla-cont" }, h("table", { className: "tabla" },
          h("thead", null, h("tr", null, h("th", null, T("fin.vehiculo")), h("th", null, T("v.conductor")), h("th", null, T("fin.decision")), h("th", null, T("fin.correcto")), h("th", null, T("fin.faltas")), h("th", null, T("fin.pts")))),
          h("tbody", null, r.hist.map((x, i) => h("tr", { key: i, className: x.d >= 0 ? "" : "fila-mal" },
            h("td", null, x.vehiculo, h("br"), h("span", { className: "patente-chica" }, x.patente)),
            h("td", null, x.nombre, x.nombre !== x.real && h("small", { className: "mal" }, h("br"), T("fin.enRealidad", { n: x.real }))),
            h("td", null, nombreResolucion(x.decision)), h("td", null, nombreResolucion(x.correcta)), h("td", { className: "faltas" }, x.faltas), h("td", { className: cx("num", x.d >= 0 ? "bien" : "mal") }, (x.d > 0 ? "+" : "") + x.d)))))),
        h("div", { className: "fila-botones" }, h("button", { className: "boton grande", onClick: () => window.__otroTurno && window.__otroTurno() }, T("fin.otro")), h("button", { className: "boton sec", onClick: () => Juego.alMenu() }, T("fin.menu"))))));
}

// ════════════════════════════════════════════════════════════════════════
// App
// ════════════════════════════════════════════════════════════════════════
function App() {
  const lienzo = useRef(null), est = useJuego();
  const [progreso, setProgreso] = useState(0), [listo, setListo] = useState(false), [error, setError] = useState(null);
  const [opciones, setOpcionesE] = useState(() => { const o = leer("opciones", OPCIONES_BASE); ponerIdioma(o.idioma); return o; }), [acta, setActa] = useState(null);
  // La pantalla de idioma sale cada vez que se abre el juego, antes del menú.
  const [idiomaListo, setIdiomaListo] = useState(false);
  const setOpciones = (o) => { if (o.idioma) ponerIdioma(o.idioma); setOpcionesE(o); guardar("opciones", o); Juego.aplicarOpciones(o); };
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await pausa(60);
        await Modelos.cargar((k) => vivo && setProgreso(k * 0.85));
        await pausa(30);
        Juego.aplicarOpciones(opciones);
        Juego.montar(lienzo.current);
        setProgreso(1); await pausa(250); if (vivo) setListo(true);
      } catch (e) { console.error(e); setError(e.message || String(e)); }
    })();
    return () => { vivo = false; };
  }, []);
  useEffect(() => { if (!acta) return; const id = setTimeout(() => setActa(null), 5200); return () => clearTimeout(id); }, [acta]);
  const empezar = () => { Sonido.iniciar(); Juego.empezar(opciones); };
  window.__otroTurno = empezar;
  const jugando = est.modo === "jugando";
  return h(React.Fragment, null,
    h("canvas", { ref: lienzo, className: "juego" }),
    !listo && h(Carga, { progreso, error }),
    listo && est.modo === "menu" && !idiomaListo && h(IdiomaPantalla, { actual: IDIOMA, elegir: (k) => { Sonido.iniciar(); Sonido.clic(); setOpciones({ ...opciones, idioma: k }); setIdiomaListo(true); } }),
    listo && est.modo === "menu" && idiomaListo && h(Menu, { opciones, setOpciones, alEmpezar: empezar, alIdioma: () => setIdiomaListo(false) }),
    listo && jugando && !est.panel && h(Hud, { est, alPausa: () => Juego.pausar(true) }),
    listo && jugando && TOCABLE && !est.panel && !est.pausado && h(Tactil, { est }),
    listo && jugando && est.panel === "ventanilla" && h(Ventanilla, { alMulta: setActa }),
    listo && jugando && est.panel === "baul" && h(Baul, { est }),
    acta && jugando && h(Acta, { acta }),
    listo && jugando && est.pausado && h(Pausa, { opciones, setOpciones }),
    listo && est.modo === "fin" && h(Resumen));
}
ReactDOM.createRoot(document.getElementById("raiz")).render(h(App));
