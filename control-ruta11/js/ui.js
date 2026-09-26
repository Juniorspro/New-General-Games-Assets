"use strict";
// ════════════════════════════════════════════════════════════════════════
// Interfaz (React sin JSX): carga, menú, HUD, la ventanilla con el retrato
// animado, documentos, tablet policial, alcoholímetro, el baúl con linterna,
// el acta de multa, la pausa y el resumen del turno. Controles del teléfono.
// ════════════════════════════════════════════════════════════════════════
const h = React.createElement, { useState, useEffect, useRef, useMemo } = React;

const CONSEJOS = [
  "Compará la patente del vehículo con la de la cédula verde: si no coinciden, buscala en la tablet.",
  "El que tiembla, esquiva la mirada y cambia la historia puede estar escondiendo algo. O puede estar nervioso nomás.",
  "Más de 0,5 g/l en el alcoholímetro es falta grave: se retiene el vehículo y el conductor queda demorado.",
  "Si el nombre del DNI no es el que dice la tablet para ese número, el documento es trucho: arresto.",
  "Con la linterna [F] en el baúl, mové las cosas: lo que se esconde va abajo de todo.",
  "Arrestar a un inocente cuesta 100 de reputación. Si bajás de cero, te relevan del puesto.",
  "Mirá los faros de frente: circular con una luz quemada es falta leve.",
  "La radio de la central a veces te adelanta a quién buscar. Revisá las Novedades en la tablet.",
];
const TURNOS = [["dia", "Día", "09:00 a 17:00"], ["tarde", "Tarde", "17:00 a 01:00"], ["noche", "Noche", "21:00 a 05:00"]];
const RANGO = (r) => (r < 60 ? "Agente en prueba" : r < 200 ? "Agente" : r < 350 ? "Cabo" : r < 550 ? "Sargento" : r < 800 ? "Oficial principal" : "Comisario de Caminera");
const cx = (...c) => c.filter(Boolean).join(" ");
const DECISION_ICONO = { pasar: "✓", multar: "✎", retener: "⛔", arrestar: "⛓" };

function useJuego() {
  const [, set] = useState(0);
  useEffect(() => Juego.suscribir(() => set((n) => n + 1)), []);
  return Juego.est;
}

// ════════════════════════════════════════════════════════════════════════
// Carga
// ════════════════════════════════════════════════════════════════════════
function Carga({ progreso, error }) {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((n) => (n + 1) % CONSEJOS.length), 4200); return () => clearInterval(id); }, []);
  const portada = (window.ARCHIVOS || {})["portada.jpg"];
  return h("div", { className: "carga" },
    portada && h("img", { className: "portada", src: portada, alt: "" }),
    h("div", { className: "carga-titulo" }, h(Logo), h("p", null, "Ruta Nacional 11 · Presidencia Roca, Chaco")),
    h("div", { className: "carga-pie" },
      h("p", { className: "consejo", key: i }, h("b", null, "Consejo: "), CONSEJOS[i]),
      h("div", { className: "progreso" }, h("i", { style: { width: Math.round(progreso * 100) + "%" } })),
      h("div", { className: "etapa" }, h("span", null, error ? "No se pudo cargar: " + error : progreso < 0.85 ? "Cargando modelos 3D (Rezona)…" : "Armando la ruta y el puesto…"), h("span", null, Math.round(progreso * 100) + "%"))));
}
function Logo({ chico }) {
  return h("div", { className: cx("logo", chico && "chico") }, h("small", null, "Control policial"), h("b", null, "RUTA ", h("span", null, "11")));
}

// ════════════════════════════════════════════════════════════════════════
// Menú, ayuda y opciones
// ════════════════════════════════════════════════════════════════════════
function Menu({ opciones, setOpciones, alEmpezar }) {
  const [vista, setVista] = useState(null);
  const st = leer("stats", STATS_BASE);
  return h("div", { className: "menu" },
    h("div", { className: "menu-caja" },
      h(Logo),
      h("p", { className: "bajada" }, "Sos policía de caminera en el puesto de la Ruta Nacional 11. Revisá documentos, hacé soplar, abrí baúles y decidí: pasa, multa, retención o arresto."),
      h("div", { className: "turnos", role: "radiogroup", "aria-label": "Turno" }, TURNOS.map(([k, n, hs]) => h("button", { key: k, className: cx("turno", opciones.turno === k && "activo"), role: "radio", "aria-checked": opciones.turno === k, onClick: () => setOpciones({ ...opciones, turno: k }) }, h("b", null, n), h("small", null, hs)))),
      h("button", { className: "boton grande", onClick: alEmpezar }, "Empezar turno"),
      h("div", { className: "fila-botones" },
        h("button", { className: "boton sec", onClick: () => setVista("ayuda") }, "Cómo se juega"),
        h("button", { className: "boton sec", onClick: () => setVista("opciones") }, "Opciones")),
      st.turnos > 0 && h("p", { className: "stats" }, `Turnos: ${st.turnos} · Mejor reputación: ${st.mejor} · Arrestos correctos: ${st.arrestos} · Hallazgos: ${st.hallazgos}`),
      h("p", { className: "credito" }, "Modelos 3D y portada generados con Rezona. Juego de ficción: la fuerza, las personas y los casos son inventados.")),
    vista === "ayuda" && h(Ayuda, { cerrar: () => setVista(null) }),
    vista === "opciones" && h(Opciones, { opciones, setOpciones, cerrar: () => setVista(null) }));
}
function Ventana({ titulo, cerrar, children, ancho }) {
  useEffect(() => { const f = (e) => e.key === "Escape" && cerrar(); addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [cerrar]);
  return h("div", { className: "velo", onClick: (e) => e.target === e.currentTarget && cerrar() },
    h("div", { className: "ventana", style: ancho ? { maxWidth: ancho } : null, role: "dialog", "aria-label": titulo },
      h("div", { className: "ventana-cab" }, h("h2", null, titulo), h("button", { className: "x", onClick: cerrar, "aria-label": "Cerrar" }, "✕")),
      h("div", { className: "ventana-cuerpo" }, children)));
}
function Ayuda({ cerrar }) {
  const filas = [
    ["Dejar pasar", "Todo en regla.", "+25"],
    ["Multar", "Faltas leves: sin cinturón (o casco), luces quemadas, sin seguro vigente, licencia vencida hace menos de un año.", "+25"],
    ["Retener vehículo", "Faltas graves: alcohol > 0,5 g/l, licencia vencida hace más de un año, sin cédula, sin licencia para ese vehículo. El conductor queda demorado.", "+50"],
    ["Arrestar", "Delitos: pedido de captura, drogas o armas en el baúl, DNI adulterado, vehículo con pedido de secuestro.", "+100"],
  ];
  return h(Ventana, { titulo: "Cómo se juega", cerrar, ancho: 760 },
    h("div", { className: "ayuda" },
      h("h3", null, "Controles"),
      h("div", { className: "teclas" },
        [["W A S D", "caminar (Shift corre)"], ["Mouse", "mirar (clic para capturarlo)"], ["E", "hablar con el conductor por la ventanilla / dejar detenido en la zona"], ["F", "revisar el baúl con la linterna (lejos del auto: prender la linterna)"], ["R", "esposar"], ["Q", "llamar al patrullero para el traslado"], ["Esc / P", "pausa o cerrar la ventana abierta"]].map(([k, d]) => h("div", { key: k }, h("kbd", null, k), h("span", null, d)))),
      h("p", { className: "nota" }, "En el teléfono: palanca a la izquierda para caminar, arrastrá en la pantalla para mirar y usá los botones de la derecha."),
      h("h3", null, "Qué revisar"),
      h("ul", null,
        h("li", null, h("b", null, "Documentos: "), "DNI, licencia, cédula verde y seguro. Mirá vencimientos, que la patente de la cédula sea la del vehículo y que la cara del DNI sea la del conductor."),
        h("li", null, h("b", null, "Tablet: "), "buscá el DNI (¿el nombre y la foto del sistema coinciden?) y la patente (¿pedido de secuestro?)."),
        h("li", null, h("b", null, "Alcoholímetro: "), "de 0,0 a 2,5 g/l. Más de 0,5 es positivo. Ojos rojos y voz arrastrada son señales."),
        h("li", null, h("b", null, "Sospechosos (30 %): "), "tiemblan, esquivan la mirada, cambian la historia. Algunos llevan droga o armas escondidas abajo de todo en el baúl."),
        h("li", null, h("b", null, "Arresto: "), "esposalo [R], llevalo a la Zona de Detenidos (rectángulo amarillo) y pedí el patrullero [Q].")),
      h("h3", null, "Resoluciones"),
      h("table", { className: "tabla" }, h("thead", null, h("tr", null, h("th", null, "Resolución"), h("th", null, "Cuándo"), h("th", null, "Puntos"))),
        h("tbody", null, filas.map((f) => h("tr", { key: f[0] }, h("td", null, h("b", null, f[0])), h("td", null, f[1]), h("td", { className: "num" }, f[2]))))),
      h("p", { className: "nota" }, "Errores: dejar ir un delito −80 · retener sin falta grave −40 · otras equivocaciones −30 · ", h("b", null, "arrestar a un inocente −100"), ". Hallazgo en el baúl +15.")));
}
function Segmentado({ valor, opciones, onChange, etiqueta }) {
  return h("div", { className: "segmentado", role: "radiogroup", "aria-label": etiqueta }, opciones.map(([v, t]) => h("button", { key: String(v), className: valor === v ? "activo" : "", role: "radio", "aria-checked": valor === v, onClick: () => onChange(v) }, t)));
}
function Opciones({ opciones, setOpciones, cerrar }) {
  const set = (k) => (v) => setOpciones({ ...opciones, [k]: v });
  return h(Ventana, { titulo: "Opciones", cerrar, ancho: 520 },
    h("div", { className: "opciones" },
      h("label", null, "Calidad gráfica"), h(Segmentado, { etiqueta: "Calidad", valor: opciones.calidad, onChange: set("calidad"), opciones: [["baja", "Baja"], ["media", "Media"], ["alta", "Alta"]] }),
      h("label", null, "Vehículos por turno"), h(Segmentado, { etiqueta: "Vehículos", valor: opciones.vehiculos, onChange: set("vehiculos"), opciones: [[8, "8"], [12, "12"], [16, "16"]] }),
      h("label", null, "Duración del turno"), h(Segmentado, { etiqueta: "Duración", valor: opciones.minutos, onChange: set("minutos"), opciones: [[10, "10 min"], [16, "16 min"], [24, "24 min"]] }),
      h("label", null, "Ayudas (vencimientos en días, pistas)"), h(Segmentado, { etiqueta: "Ayudas", valor: opciones.ayudas, onChange: set("ayudas"), opciones: [[true, "Sí"], [false, "No"]] }),
      h("label", { htmlFor: "sens" }, `Sensibilidad de la vista: ${opciones.sens.toFixed(1)}`), h("input", { id: "sens", type: "range", min: 0.4, max: 2.5, step: 0.1, value: opciones.sens, onChange: (e) => set("sens")(+e.target.value) }),
      h("label", { htmlFor: "vol" }, `Volumen: ${Math.round(opciones.volumen * 100)} %`), h("input", { id: "vol", type: "range", min: 0, max: 1, step: 0.05, value: opciones.volumen, onChange: (e) => set("volumen")(+e.target.value) })));
}

// ════════════════════════════════════════════════════════════════════════
// HUD
// ════════════════════════════════════════════════════════════════════════
function Hud({ est, alPausa }) {
  const tl = est.hora;
  return h("div", { className: "hud" },
    h("div", { className: "hud-izq" },
      h("div", { className: "reloj" }, h("b", null, tl), h("small", null, "Ruta 11 · km 1.035")),
      est.radio && h("div", { className: "radio", key: est.radio.id }, h("span", { className: "radio-ic", "aria-hidden": true }, "📻"), h("p", null, est.radio.texto))),
    h("div", { className: "hud-centro" },
      h("div", { className: cx("reputacion", est.reputacion < 40 && "baja") }, h("small", null, "Reputación"), h("b", null, est.reputacion))),
    h("div", { className: "hud-der" },
      h("div", { className: "dato" }, h("small", null, "Atendidos"), h("b", null, `${est.atendidos}/${est.total}`)),
      h("div", { className: "dato" }, h("small", null, "Recaudado"), h("b", null, pesos(est.recaudado))),
      h("div", { className: "dato" }, h("small", null, "En fila"), h("b", null, est.cola)),
      h("button", { className: "pausa-btn", onClick: alPausa, "aria-label": "Pausa" }, "II")),
    h("div", { className: "mira", "aria-hidden": true }),
    h("div", { className: "avisos", "aria-live": "polite" }, est.avisos.slice(-4).map((a) => h("div", { key: a.id, className: cx("aviso", a.tipo) }, a.texto))),
    h(Estado, { est }),
    est.pista && !TOCABLE && h("div", { className: "pista" }, h("kbd", null, est.pista.tecla), est.pista.texto),
    !est.pista && est.parado && Juego.opciones.ayudas && est.atendidos < 2 && h("div", { className: "pista suave" }, "Un vehículo espera en el control: andá a la ventanilla del conductor (lado izquierdo del vehículo, del lado del eje)."),
    !est.bloqueado && !TOCABLE && !est.pausado && h("div", { className: "clic" }, "Hacé clic para mirar con el mouse · o arrastrá"),
    est.fin !== null && est.fin > 0 && h("div", { className: "fin-cuenta" }, "Fin del turno…"));
}
function Estado({ est }) {
  const l = [];
  if (est.arresto) l.push(["⛓", "Esposá al detenido [R]"]);
  if (est.seguidor) l.push(["🚶", "Llevá al detenido a la Zona de Detenidos (amarillo)"]);
  if (est.zona > 0 && !est.patrulla) l.push(["🚓", `${est.zona} detenido${est.zona > 1 ? "s" : ""} en la zona · [Q] llamar al patrullero`]);
  if (est.patrulla) l.push(["🚨", est.patrulla === "viene" ? "Patrullero en camino" : est.patrulla === "carga" ? "Subiendo detenidos al patrullero" : "Patrullero en traslado"]);
  if (est.linterna) l.push(["🔦", "Linterna encendida"]);
  if (!l.length) return null;
  return h("div", { className: "estado" }, l.map(([i, t]) => h("div", { key: t }, h("span", { "aria-hidden": true }, i), t)));
}

// ── controles táctiles ──
function Tactil({ est }) {
  const base = useRef(null), [p, setP] = useState(null);
  const mover = (e) => {
    const r = base.current.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const n = Math.hypot(x, y), k = n > 1 ? 1 / n : 1; setP([x * k, y * k]); Juego.mover(x * k, -y * k, n > 1.05);
  };
  const soltar = () => { setP(null); Juego.mover(0, 0, false); };
  return h("div", { className: "tactil" },
    h("div", { className: "palanca", ref: base, onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); mover(e); }, onPointerMove: (e) => p && mover(e), onPointerUp: soltar, onPointerCancel: soltar },
      h("i", { style: p ? { transform: `translate(${p[0] * 42}px, ${p[1] * 42}px)` } : null })),
    h("div", { className: "botones-t" },
      est.acciones.map((a) => h("button", { key: a.id, className: "bt principal", onClick: () => Juego.accion(a.tecla) }, a.texto)),
      est.zona > 0 && !est.patrulla && h("button", { className: "bt", onClick: () => Juego.accion("Q") }, "🚓 Patrullero"),
      !est.acciones.some((a) => a.tecla === "F") && h("button", { className: cx("bt redondo", est.linterna && "on"), onClick: () => Juego.accion("F"), "aria-label": "Linterna" }, "🔦")));
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
      const p = I.p, t = ms / 1000, ahora = performance.now(), moto = p.modelo.tipo === "moto", noche = Juego.est.noche;
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
      if (t > proxMir) { objMir = nerv && Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.3) : (Math.random() - 0.5) * 0.3; proxMir = t + (nerv ? 0.35 + Math.random() * 0.8 : 1.5 + Math.random() * 2.5); }
      if (I.evita > ahora) objMir = Math.sign(objMir || 1) * 0.95;
      mir += (objMir - mir) * 0.3;
      if (t > proxParp) { parp = 1; proxParp = t + (nerv ? 1 + Math.random() * 1.5 : 2.5 + Math.random() * 3); } else parp = Math.max(0, parp - 0.2);
      const habla = I.habla > ahora, abre = habla ? Math.abs(Math.sin(t * 16)) * 0.85 : 0;
      const jx = nerv ? (Math.sin(t * 43) * 0.9 + Math.sin(t * 27) * 0.6) * nerv : 0, sway = borr ? Math.sin(t * 1.1) * 8 : 0;
      const cxr = W * 0.5 + jx + sway, cyr = H * 0.44 + (borr ? Math.sin(t * 0.8) * 3 : 0) + (nerv ? Math.sin(t * 37) * 0.5 : 0), s = 150;
      g.save(); if (borr) { g.translate(cxr, cyr); g.rotate(Math.sin(t * 0.9) * 0.05); g.translate(-cxr, -cyr); }
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
  return h("canvas", { ref, className: "retrato", "aria-label": "El conductor, visto por la ventanilla" });
}
function Dialogo({ insp }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [insp.dialogo.length]);
  return h("div", { className: "dialogo", ref, "aria-live": "polite" }, insp.dialogo.map((d) => h("p", { key: d.id, className: d.quien }, h("b", null, d.quien === "yo" ? "Vos" : "Conductor"), d.texto)));
}
function Ventanilla({ est, alMulta }) {
  const insp = Juego.insp, [tab, setTab] = useState("docs");
  if (!insp) return null;
  const p = insp.p;
  return h("div", { className: "insp", role: "dialog", "aria-label": "Inspección del vehículo" },
    h("div", { className: "insp-izq" },
      h("div", { className: "insp-cab" }, h("div", null, h("b", null, `${p.modelo.nombre} · ${p.colorNombre}`), h("span", { className: "patente-chica" }, p.patente)), h("button", { className: "boton sec chico", onClick: () => Juego.cerrarPanel() }, "Volver ", h("kbd", null, "Esc"))),
      h(Retrato),
      h(Dialogo, { insp }),
      h("div", { className: "preguntas" }, PREGUNTAS.map(([k, t]) => h("button", { key: k, className: "preg", onClick: () => Juego.preguntar(k) }, t)))),
    h("div", { className: "insp-der" },
      h("div", { className: "tabs", role: "tablist" }, [["docs", "Documentos"], ["tablet", "Tablet"], ["alco", "Alcoholímetro"], ["resolver", "Resolver"]].map(([k, t]) => h("button", { key: k, role: "tab", "aria-selected": tab === k, className: tab === k ? "activa" : "", onClick: () => setTab(k) }, t))),
      h("div", { className: "tab-cuerpo" },
        tab === "docs" && h(Documentos, { insp }),
        tab === "tablet" && h(Tablet, { insp }),
        tab === "alco" && h(Alcoholimetro, { insp }),
        tab === "resolver" && h(Resolver, { insp, alMulta }))));
}

// ── documentos ──
function Vence({ fecha: f }) {
  const d = diasEntre(f, HOY), ay = Juego.opciones.ayudas;
  return h("span", { className: cx(ay && (d > 0 ? "mal" : "bien")) }, fecha(f), ay ? (d > 0 ? ` (vencida hace ${d} días)` : ` (faltan ${-d} días)`) : "");
}
function Documentos({ insp }) {
  const p = insp.p, d = p.docs;
  if (!insp.docs) return h("div", { className: "vacio" }, h("p", null, "Todavía no le pediste los papeles."), h("button", { className: "boton", onClick: () => Juego.pedirDocs() }, "Pedir documentación"));
  const falta = (t) => h("div", { className: "doc faltante" }, h("b", null, t), h("p", null, "No lo presentó."));
  return h("div", null,
    h("div", { className: "hoy" }, h("span", null, "Hoy: ", h("b", null, fecha(HOY))), h("span", null, "Patente del vehículo: ", h("b", { className: "patente-chica" }, p.patente))),
    h("div", { className: "docs" },
      h("div", { className: "doc dni" },
        h("div", { className: "doc-cab" }, "DOCUMENTO NACIONAL DE IDENTIDAD"),
        h("div", { className: "dni-cuerpo" }, h("img", { src: fotoCarnet(d.dni.rostro), alt: "Foto del DNI" }),
          h("dl", null, h("dt", null, "Apellido y nombre"), h("dd", null, d.dni.nombre), h("dt", null, "Nacimiento"), h("dd", null, fecha(d.dni.nacimiento)), h("dt", null, "Documento"), h("dd", { className: "grande" }, dniTexto(d.dni.numero))))),
      d.licencia.presente ? h("div", { className: "doc lic" },
        h("div", { className: "doc-cab" }, "LICENCIA DE CONDUCIR"),
        h("dl", null, h("dt", null, "Titular"), h("dd", null, d.licencia.nombre), h("dt", null, "N.º"), h("dd", null, dniTexto(d.licencia.numero)), h("dt", null, "Clase"), h("dd", null, d.licencia.categoria + (d.licencia.categoria.startsWith("A") ? " (motos)" : d.licencia.categoria.startsWith("C") ? " (camiones)" : " (autos y camionetas)")), h("dt", null, "Vence"), h("dd", null, h(Vence, { fecha: d.licencia.vence })))) : falta("LICENCIA DE CONDUCIR"),
      d.cedula.presente ? h("div", { className: "doc ced" },
        h("div", { className: "doc-cab" }, "CÉDULA DE IDENTIFICACIÓN DEL AUTOMOTOR"),
        h("dl", null, h("dt", null, "Dominio"), h("dd", { className: "grande" }, d.cedula.patente), h("dt", null, "Titular"), h("dd", null, d.cedula.titular), h("dt", null, "Modelo"), h("dd", null, d.cedula.modelo), h("dt", null, "Color"), h("dd", null, d.cedula.color))) : falta("CÉDULA VERDE"),
      d.seguro.presente ? h("div", { className: "doc seg" },
        h("div", { className: "doc-cab" }, "CERTIFICADO DE SEGURO OBLIGATORIO"),
        h("dl", null, h("dt", null, "Compañía"), h("dd", null, d.seguro.compania), h("dt", null, "Póliza"), h("dd", null, d.seguro.poliza), h("dt", null, "Vigente hasta"), h("dd", null, h(Vence, { fecha: d.seguro.vence })))) : falta("SEGURO")));
}

// ── tablet policial ──
function Tablet({ insp }) {
  const [sec, setSec] = useState("personas"), [dni, setDni] = useState(""), [pat, setPat] = useState(""), [rp, setRp] = useState(null), [rv, setRv] = useState(null);
  const p = insp.p, R = Juego.registro;
  const buscarP = (x) => { const v = x ?? dni; setDni(String(v)); setRp({ q: v, r: R.persona(v) || null }); Sonido.bip(); };
  const buscarV = (x) => { const v = x ?? pat; setPat(v); setRv({ q: v, r: R.vehiculo(v) || null }); Sonido.bip(); };
  return h("div", { className: "tablet" },
    h("div", { className: "tablet-barra" }, h("span", null, "SISTEMA POLICIAL · CONSULTAS"), h("span", null, Juego.est.hora)),
    h("div", { className: "tablet-tabs" }, [["personas", "Personas"], ["vehiculos", "Vehículos"], ["novedades", `Novedades (${Juego.novedades.length})`]].map(([k, t]) => h("button", { key: k, className: sec === k ? "activa" : "", onClick: () => setSec(k) }, t))),
    sec === "personas" && h("div", { className: "tablet-sec" },
      h("form", { className: "buscar", onSubmit: (e) => { e.preventDefault(); buscarP(); } }, h("input", { value: dni, onChange: (e) => setDni(e.target.value), placeholder: "N.º de DNI", inputMode: "numeric", "aria-label": "Número de DNI" }), h("button", { className: "boton chico" }, "Buscar")),
      insp.docs && h("button", { className: "rapido", onClick: () => buscarP(p.docs.dni.numero) }, `Usar el DNI presentado (${dniTexto(p.docs.dni.numero)})`),
      rp && (rp.r ? h("div", { className: cx("ficha", rp.r.captura && "alerta") },
        rp.r.captura && h("div", { className: "banda" }, "⚠ PEDIDO DE CAPTURA VIGENTE"),
        h("div", { className: "ficha-cuerpo" }, h("img", { src: fotoCarnet(rp.r.rostro), alt: "Foto del sistema" }),
          h("dl", null, h("dt", null, "Nombre"), h("dd", null, rp.r.nombre), h("dt", null, "DNI"), h("dd", null, dniTexto(rp.r.dni)), h("dt", null, "Nacimiento"), h("dd", null, fecha(rp.r.nacimiento)), h("dt", null, "Antecedentes"), h("dd", null, rp.r.antecedentes), rp.r.captura && h("dt", null, "Motivo"), rp.r.captura && h("dd", null, rp.r.motivo))))
        : h("div", { className: "ficha vacia" }, `Sin resultados para el DNI ${rp.q}.`))),
    sec === "vehiculos" && h("div", { className: "tablet-sec" },
      h("form", { className: "buscar", onSubmit: (e) => { e.preventDefault(); buscarV(); } }, h("input", { value: pat, onChange: (e) => setPat(e.target.value.toUpperCase()), placeholder: "Patente", "aria-label": "Patente" }), h("button", { className: "boton chico" }, "Buscar")),
      h("div", { className: "rapidos" }, h("button", { className: "rapido", onClick: () => buscarV(p.patente) }, `Patente del vehículo (${p.patente})`), insp.docs && p.docs.cedula.presente && h("button", { className: "rapido", onClick: () => buscarV(p.docs.cedula.patente) }, `Patente de la cédula (${p.docs.cedula.patente})`)),
      rv && (rv.r ? h("div", { className: cx("ficha", rv.r.robado && "alerta") },
        rv.r.robado && h("div", { className: "banda" }, "⚠ PEDIDO DE SECUESTRO: VEHÍCULO ROBADO"),
        h("dl", { className: "sola" }, h("dt", null, "Dominio"), h("dd", null, rv.r.patente), h("dt", null, "Titular"), h("dd", null, rv.r.titular), h("dt", null, "Modelo"), h("dd", null, rv.r.modelo), h("dt", null, "Color"), h("dd", null, rv.r.color)))
        : h("div", { className: "ficha vacia" }, `El dominio ${rv.q} no figura en el registro.`))),
    sec === "novedades" && h("div", { className: "tablet-sec novedades" }, Juego.novedades.length ? Juego.novedades.map((n, i) => h("p", { key: i, className: n.tipo }, h("b", null, n.hora), n.texto)) : h("p", null, "Sin novedades.")));
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
  const medido = insp.soplo !== null && !anim, pos = medido && insp.soplo > 0.5, v = valor ?? 0;
  return h("div", { className: "alco" },
    h("div", { className: "aparato" },
      h("div", { className: "pantallita" }, h("b", null, v.toFixed(2).replace(".", ",")), h("small", null, "g/l")),
      h("div", { className: "barra-alco" }, h("i", { style: { width: (v / 2.5) * 100 + "%" }, className: v > 0.5 ? "alta" : "" }), h("span", { className: "limite", style: { left: (0.5 / 2.5) * 100 + "%" } }, "0,5")),
      h("div", { className: "escala" }, ["0,0", "0,5", "1,0", "1,5", "2,0", "2,5"].map((x) => h("span", { key: x }, x))),
      medido && h("div", { className: cx("resultado", pos ? "mal" : "bien") }, pos ? "POSITIVO — supera el límite de 0,5 g/l" : "NEGATIVO"),
      h("button", { className: "boton", disabled: !!anim, onClick: () => { const x = Juego.soplar(); setValor(0); setAnim({ v: x }); } }, anim ? "Soplando…" : medido ? "Repetir el test" : "Hacer soplar")),
    h("p", { className: "nota" }, "Límite permitido: 0,5 g/l. Por encima: falta grave, se retiene el vehículo y el conductor queda demorado."));
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
  const opcion = (k, titulo, bajada) => h("button", { className: cx("opcion", k, dec === k && "activa"), onClick: () => { setDec(k); setCargos([]); }, "aria-pressed": dec === k }, h("span", { className: "ic", "aria-hidden": true }, DECISION_ICONO[k]), h("b", null, titulo), h("small", null, bajada));
  return h("div", { className: "resolver" },
    insp.hallazgos.length > 0 && h("div", { className: "evidencia" }, `Evidencia secuestrada del baúl: ${insp.hallazgos.map((o) => o.nombre.toLowerCase()).join(", ")}.`),
    h("div", { className: "opciones-res" },
      opcion("pasar", "Dejar pasar", "Todo en regla"),
      opcion("multar", "Multar", "Faltas leves"),
      opcion("retener", "Retener vehículo", "Falta grave · conductor demorado"),
      opcion("arrestar", "Arrestar", "Delito · esposas y traslado")),
    dec && dec !== "pasar" && h("div", { className: "cargos" },
      h("p", null, dec === "multar" ? "Marcá las faltas que vas a labrar en el acta:" : "Motivo:"),
      GRUPOS[dec].map((k) => h("label", { key: k, className: "cargo" }, h("input", { type: "checkbox", checked: cargos.includes(k), onChange: () => alternar(k) }), h("span", null, Juego.nombreFalta(k, p)), dec === "multar" && h("em", null, pesos(FALTAS[k].monto)))),
      dec === "multar" && h("p", { className: "total" }, "Total del acta: ", h("b", null, pesos(total)))),
    h("button", { className: cx("boton grande", dec === "arrestar" && "rojo"), disabled: !dec || (dec === "multar" && !cargos.length), onClick: confirmar },
      !dec ? "Elegí una resolución" : dec === "pasar" ? "Dejar pasar" : dec === "multar" ? "Labrar acta e imprimir" : dec === "retener" ? "Retener el vehículo" : "Proceder al arresto"));
}

// ── acta impresa ──
function Acta({ acta }) {
  return h("div", { className: "acta", role: "status" },
    h("div", { className: "acta-cab" }, h("b", null, "ACTA DE INFRACCIÓN"), h("small", null, `Puesto Caminero Ruta 11 · ${fecha(HOY)} ${acta.hora}`)),
    h("p", null, h("b", null, "Infractor: "), acta.p.docs.dni.nombre), h("p", null, h("b", null, "Dominio: "), acta.p.patente, " · ", acta.p.modelo.nombre),
    h("ul", null, acta.cargos.map((k) => h("li", { key: k }, h("span", null, Juego.nombreFalta(k, acta.p)), h("b", null, pesos(FALTAS[k].monto))))),
    h("p", { className: "acta-total" }, "TOTAL ", h("b", null, pesos(acta.total))));
}

// ════════════════════════════════════════════════════════════════════════
// Baúl con linterna: mover las cosas y encontrar lo escondido
// ════════════════════════════════════════════════════════════════════════
const BW = 820, BH = 500;
function armarBaul(insp) {
  if (insp.baulCosas) return insp.baulCosas;
  const p = insp.p, r = Math.random, cosas = [], moto = p.modelo.tipo === "moto", camion = p.modelo.tipo === "camion";
  const tam = (n) => (n.includes("Rueda") ? [150, 150, "circulo"] : n.includes("Garrafa") ? [96, 96, "circulo"] : n.includes("herramientas") ? [170, 80] : n.includes("Bolso") ? [190, 100] : n.includes("Mochila") ? [120, 110] : n.includes("Paquete") ? [74, 48] : n.includes("Arma") ? [118, 44, "arma"] : n.includes("Cajón") ? [150, 100] : [140, 105]);
  const escala = moto ? 0.8 : 1, zona = moto ? { x: 230, y: 110, w: 360, h: 280 } : { x: 70, y: 80, w: BW - 140, h: BH - 150 };
  const legales = p.baul.filter((o) => !o.ilegal), ocultos = p.baul.filter((o) => o.ilegal && o.escondido), vistos = p.baul.filter((o) => o.ilegal && !o.escondido);
  if (camion) for (let i = 0; i < 4; i++) legales.push({ nombre: "Caja de mercadería", color: "#a07a4a", ilegal: false });
  const tapas = legales.map((o, i) => { const [w, hh, forma] = tam(o.nombre), col = i % 3, fila = Math.floor(i / 3); return { o, nombre: o.nombre, color: o.color, w: w * escala, h: hh * escala, forma, x: zona.x + col * (zona.w / 3) + r() * 30, y: zona.y + fila * (zona.h / 2.2) + r() * 30 }; });
  if (ocultos.length && !tapas.length) tapas.push({ o: null, nombre: "Alfombra del baúl", color: "#3a3a40", w: 300, h: 190, x: zona.x + zona.w / 2 - 150, y: zona.y + 40 });
  ocultos.forEach((o, i) => { const t = tapas[i % tapas.length], [w, hh, forma] = tam(o.nombre); cosas.push({ o, nombre: o.nombre, color: o.color, w: w * escala, h: hh * escala, forma, x: t.x + t.w / 2 - (w * escala) / 2 + (i % 3) * 10, y: t.y + t.h / 2 - (hh * escala) / 2 + (i % 2) * 8 }); });
  cosas.push(...tapas);
  vistos.forEach((o) => { const [w, hh, forma] = tam(o.nombre); cosas.push({ o, nombre: o.nombre, color: o.color, w: w * escala, h: hh * escala, forma, x: zona.x + r() * (zona.w - w), y: zona.y + zona.h - hh - r() * 40 }); });
  // Si quedó una tapa a medias arriba de otra, que no se note el patrón: se mezcla un poco el orden de las legales entre sí.
  insp.baulCosas = cosas; return cosas;
}
function Baul({ est }) {
  const insp = Juego.insp, ref = useRef(null), [, setN] = useState(0);
  useEffect(() => {
    if (!insp) return;
    const c = ref.current, g = c.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1); c.width = BW * dpr; c.height = BH * dpr;
    const sombra = document.createElement("canvas"); sombra.width = BW; sombra.height = BH; const gs = sombra.getContext("2d");
    const cosas = armarBaul(insp); let luz = [BW / 2, BH / 2], arr = null, raf = 0;
    // El lienzo va con object-fit: contain, así que el dibujo queda con franjas: hay que descontarlas.
    const pos = (e) => { const r = c.getBoundingClientRect(), k = Math.min(r.width / BW, r.height / BH), ox = r.left + (r.width - BW * k) / 2, oy = r.top + (r.height - BH * k) / 2; return [(e.clientX - ox) / k, (e.clientY - oy) / k]; };
    const tocada = (x, y) => { for (let i = cosas.length - 1; i >= 0; i--) { const o = cosas[i]; if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return i; } return -1; };
    const abajo = (e) => { c.setPointerCapture(e.pointerId); const [x, y] = pos(e); luz = [x, y]; const i = tocada(x, y); if (i >= 0) { const o = cosas.splice(i, 1)[0]; cosas.push(o); arr = { o, dx: x - o.x, dy: y - o.y, x0: x, y0: y }; } };
    const mueve = (e) => { const [x, y] = pos(e); luz = [x, y]; if (arr) { arr.o.x = clamp(x - arr.dx, 20, BW - arr.o.w - 20); arr.o.y = clamp(y - arr.dy, 30, BH - arr.o.h - 20); } };
    const arriba = (e) => { if (arr) { const [x, y] = pos(e); if (Math.hypot(x - arr.x0, y - arr.y0) < 7 && arr.o.o && arr.o.o.ilegal) { Juego.secuestrar(arr.o.o); setN((n) => n + 1); } else if (Math.hypot(x - arr.x0, y - arr.y0) > 7) Sonido.clic(); } arr = null; };
    c.addEventListener("pointerdown", abajo); c.addEventListener("pointermove", mueve); c.addEventListener("pointerup", arriba); c.addEventListener("pointercancel", arriba);
    const dibujar = (ms) => {
      raf = requestAnimationFrame(dibujar); const t = ms / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Fondo: alfombra gris del baúl con sus paredes.
      g.fillStyle = "#2c2d31"; g.fillRect(0, 0, BW, BH);
      g.fillStyle = "#35363b"; g.fillRect(40, 50, BW - 80, BH - 90);
      g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1; for (let x = 44; x < BW - 40; x += 6) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x, BH - 40); g.stroke(); }
      g.fillStyle = "#1c1d20"; g.fillRect(0, 0, BW, 50); g.fillRect(0, BH - 40, BW, 40); g.fillRect(0, 0, 40, BH); g.fillRect(BW - 40, 0, 40, BH);
      for (const o of cosas) {
        g.save(); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 14; g.shadowOffsetY = 6; g.fillStyle = o.color;
        if (o.forma === "circulo") { g.beginPath(); g.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); g.fill(); if (o.nombre.includes("Rueda")) { g.shadowColor = "transparent"; g.fillStyle = "#8a8d93"; g.beginPath(); g.arc(o.x + o.w / 2, o.y + o.h / 2, o.w * 0.22, 0, Math.PI * 2); g.fill(); } }
        else if (o.forma === "arma") { g.beginPath(); g.moveTo(o.x, o.y + 6); g.lineTo(o.x + o.w, o.y + 6); g.lineTo(o.x + o.w, o.y + 20); g.lineTo(o.x + 42, o.y + 20); g.lineTo(o.x + 34, o.y + o.h); g.lineTo(o.x + 14, o.y + o.h); g.lineTo(o.x + 20, o.y + 20); g.lineTo(o.x, o.y + 20); g.fill(); }
        else { g.beginPath(); g.roundRect ? g.roundRect(o.x, o.y, o.w, o.h, 8) : g.rect(o.x, o.y, o.w, o.h); g.fill(); g.shadowColor = "transparent"; g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(o.x + 4, o.y + 4, o.w - 8, o.h * 0.25); if (o.nombre.includes("Paquete")) { g.strokeStyle = "#8b7b4f"; g.lineWidth = 3; for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(o.x + (o.w * k) / 3, o.y); g.lineTo(o.x + (o.w * k) / 3, o.y + o.h); g.stroke(); } } }
        g.restore();
        g.fillStyle = "rgba(255,255,255,0.85)"; g.font = "600 13px Barlow, Arial"; g.textAlign = "center"; g.fillText(o.nombre, o.x + o.w / 2, o.y + o.h + 16);
        if (o.o && o.o.visto) { g.strokeStyle = "#ff3b3b"; g.lineWidth = 3; g.setLineDash([8, 5]); g.strokeRect(o.x - 6, o.y - 6, o.w + 12, o.h + 12); g.setLineDash([]); g.fillStyle = "#ff3b3b"; g.font = "800 13px Barlow, Arial"; g.fillText("SECUESTRADO", o.x + o.w / 2, o.y - 12); }
      }
      // Oscuridad y el círculo de la linterna (tiembla un poco en la mano).
      const osc = 0.86 + est.noche * 0.1, lx = luz[0] + Math.sin(t * 7) * 1.5, ly = luz[1] + Math.cos(t * 5) * 1.5;
      gs.globalCompositeOperation = "source-over"; gs.clearRect(0, 0, BW, BH); gs.fillStyle = `rgba(0,0,0,${osc})`; gs.fillRect(0, 0, BW, BH);
      gs.globalCompositeOperation = "destination-out"; const gr = gs.createRadialGradient(lx, ly, 10, lx, ly, 135); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.7, "rgba(0,0,0,0.85)"); gr.addColorStop(1, "rgba(0,0,0,0)"); gs.fillStyle = gr; gs.beginPath(); gs.arc(lx, ly, 135, 0, Math.PI * 2); gs.fill();
      g.drawImage(sombra, 0, 0);
      const cal = g.createRadialGradient(lx, ly, 0, lx, ly, 135); cal.addColorStop(0, "rgba(255,240,200,0.12)"); cal.addColorStop(1, "rgba(255,240,200,0)"); g.fillStyle = cal; g.fillRect(0, 0, BW, BH);
    };
    raf = requestAnimationFrame(dibujar);
    return () => { cancelAnimationFrame(raf); c.removeEventListener("pointerdown", abajo); c.removeEventListener("pointermove", mueve); c.removeEventListener("pointerup", arriba); c.removeEventListener("pointercancel", arriba); };
  }, [insp]);
  if (!insp) return null;
  const ha = insp.hallazgos;
  return h("div", { className: "baul", role: "dialog", "aria-label": "Revisión del baúl" },
    h("div", { className: "baul-cab" }, h("div", null, h("b", null, insp.p.modelo.tipo === "camion" ? "Carga del camión" : insp.p.modelo.tipo === "moto" ? "Baulito de la moto" : "Baúl"), h("small", null, " · Mové las cosas con la linterna para ver lo de abajo. Tocá lo sospechoso para secuestrarlo.")), h("button", { className: "boton sec chico", onClick: () => { Sonido.baul(); Juego.cerrarPanel(); } }, "Cerrar ", h("kbd", null, "Esc"))),
    h("canvas", { ref, className: "baul-lienzo" }),
    h("div", { className: cx("baul-pie", ha.length && "mal") }, ha.length ? `⚠ Secuestraste: ${ha.map((o) => o.nombre.toLowerCase()).join(", ")}. Eso es delito: corresponde arresto.` : "Nada sospechoso a la vista… por ahora."));
}

// ════════════════════════════════════════════════════════════════════════
// Pausa y resumen
// ════════════════════════════════════════════════════════════════════════
function Pausa({ opciones, setOpciones }) {
  const [vista, setVista] = useState(null);
  return h("div", { className: "velo" },
    h("div", { className: "ventana chica" },
      h("h2", null, "Pausa"),
      h("button", { className: "boton grande", onClick: () => Juego.pausar(false) }, "Seguir"),
      h("button", { className: "boton sec", onClick: () => setVista("ayuda") }, "Cómo se juega"),
      h("button", { className: "boton sec", onClick: () => setVista("opciones") }, "Opciones"),
      h("button", { className: "boton sec", onClick: () => Juego.alMenu() }, "Abandonar el turno")),
    vista === "ayuda" && h(Ayuda, { cerrar: () => setVista(null) }),
    vista === "opciones" && h(Opciones, { opciones, setOpciones, cerrar: () => setVista(null) }));
}
function Resumen() {
  const r = Juego.resumen; if (!r) return null;
  const ok = r.hist.filter((x) => x.ok).length, pct = r.hist.length ? Math.round((ok / r.hist.length) * 100) : 0;
  return h("div", { className: "velo" },
    h("div", { className: "ventana resumen" },
      h("div", { className: "ventana-cab" }, h("h2", null, r.motivo === "relevado" ? "Te relevaron del puesto" : "Fin del turno")),
      h("div", { className: "ventana-cuerpo" },
        h("div", { className: "rango" }, h("small", null, "Calificación"), h("b", null, r.motivo === "relevado" ? "Sumario administrativo" : RANGO(r.reputacion))),
        h("div", { className: "totales" },
          [["Reputación", r.reputacion], ["Atendidos", `${r.atendidos}/${r.total}`], ["Aciertos", pct + " %"], ["Recaudado", pesos(r.recaudado)], ["Mejor", r.mejor]].map(([k, v]) => h("div", { key: k }, h("small", null, k), h("b", null, v)))),
        r.sinTrasladar > 0 && h("p", { className: "nota" }, `Quedaron ${r.sinTrasladar} detenido(s) en la zona sin trasladar: los lleva el turno siguiente.`),
        h("div", { className: "tabla-cont" }, h("table", { className: "tabla" },
          h("thead", null, h("tr", null, h("th", null, "Vehículo"), h("th", null, "Conductor"), h("th", null, "Tu decisión"), h("th", null, "Correcto"), h("th", null, "Faltas reales"), h("th", null, "Pts"))),
          h("tbody", null, r.hist.map((x, i) => h("tr", { key: i, className: x.d >= 0 ? "" : "fila-mal" },
            h("td", null, x.vehiculo, h("br"), h("span", { className: "patente-chica" }, x.patente)),
            h("td", null, x.nombre, x.nombre !== x.real && h("small", { className: "mal" }, h("br"), "(en realidad: " + x.real + ")")),
            h("td", null, NOMBRE_RESOLUCION[x.decision]), h("td", null, NOMBRE_RESOLUCION[x.correcta]), h("td", { className: "faltas" }, x.faltas), h("td", { className: cx("num", x.d >= 0 ? "bien" : "mal") }, (x.d > 0 ? "+" : "") + x.d)))))),
        h("div", { className: "fila-botones" }, h("button", { className: "boton grande", onClick: () => window.__otroTurno && window.__otroTurno() }, "Otro turno"), h("button", { className: "boton sec", onClick: () => Juego.alMenu() }, "Menú")))));
}

// ════════════════════════════════════════════════════════════════════════
// App
// ════════════════════════════════════════════════════════════════════════
function App() {
  const lienzo = useRef(null), est = useJuego();
  const [progreso, setProgreso] = useState(0), [listo, setListo] = useState(false), [error, setError] = useState(null);
  const [opciones, setOpcionesE] = useState(() => leer("opciones", OPCIONES_BASE)), [acta, setActa] = useState(null);
  const setOpciones = (o) => { setOpcionesE(o); guardar("opciones", o); Juego.aplicarOpciones(o); };
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
    listo && est.modo === "menu" && h(Menu, { opciones, setOpciones, alEmpezar: empezar }),
    listo && jugando && !est.panel && h(Hud, { est, alPausa: () => Juego.pausar(true) }),
    listo && jugando && TOCABLE && !est.panel && !est.pausado && h(Tactil, { est }),
    listo && jugando && est.panel === "ventanilla" && h(Ventanilla, { est, alMulta: setActa }),
    listo && jugando && est.panel === "baul" && h(Baul, { est }),
    acta && jugando && h(Acta, { acta }),
    listo && jugando && est.pausado && h(Pausa, { opciones, setOpciones }),
    listo && est.modo === "fin" && h(Resumen));
}
ReactDOM.createRoot(document.getElementById("raiz")).render(h(App));
