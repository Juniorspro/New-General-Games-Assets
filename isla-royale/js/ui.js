"use strict";
// ════════════════════════════════════════════════════════════════════════
// Interfaz (React sin compilar: h = React.createElement)
// ════════════════════════════════════════════════════════════════════════
const { useState, useEffect, useRef, useCallback } = React;
const h = React.createElement;

// ── pantalla de carga: un dibujo de la isla con el autobús, consejos y barra ──
function dibujarPortada(cv) {
  const w = (cv.width = cv.clientWidth * 2), hh = (cv.height = cv.clientHeight * 2), g = cv.getContext("2d"), r = azar(3);
  const cielo = g.createLinearGradient(0, 0, 0, hh); cielo.addColorStop(0, "#2a1d6e"); cielo.addColorStop(0.45, "#4f6fe0"); cielo.addColorStop(0.72, "#ffb36b"); cielo.addColorStop(1, "#ff8a5c");
  g.fillStyle = cielo; g.fillRect(0, 0, w, hh);
  const sol = g.createRadialGradient(w * 0.72, hh * 0.62, 0, w * 0.72, hh * 0.62, hh * 0.35); sol.addColorStop(0, "rgba(255,240,190,1)"); sol.addColorStop(0.2, "rgba(255,210,140,0.8)"); sol.addColorStop(1, "rgba(255,160,100,0)");
  g.fillStyle = sol; g.fillRect(0, 0, w, hh);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.6})`; g.fillRect(r() * w, r() * hh * 0.4, 2, 2); }
  g.fillStyle = "#1f5f9a"; g.fillRect(0, hh * 0.74, w, hh * 0.26);
  for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,220,180,0.35)"; g.fillRect(w * 0.55 + r() * w * 0.35, hh * (0.75 + r() * 0.2), 30 + r() * 80, 3); }
  // La isla: lomas en silueta con árboles.
  g.fillStyle = "#1d3b2a"; g.beginPath(); g.moveTo(w * 0.05, hh * 0.76);
  for (let x = 0; x <= 1; x += 0.02) g.lineTo(w * (0.05 + x * 0.6), hh * (0.74 - Math.sin(x * Math.PI) * 0.16 - Math.sin(x * 11) * 0.015));
  g.lineTo(w * 0.65, hh * 0.76); g.fill();
  for (let i = 0; i < 60; i++) { const x = 0.08 + r() * 0.54, base = hh * (0.74 - Math.sin(((x - 0.05) / 0.6) * Math.PI) * 0.16), s = hh * (0.02 + r() * 0.025); g.fillStyle = r() < 0.5 ? "#16301f" : "#234a31"; g.beginPath(); g.moveTo(w * x - s * 0.6, base + 2); g.lineTo(w * x, base - s * 2); g.lineTo(w * x + s * 0.6, base + 2); g.fill(); }
  // El autobús con su globo.
  const bx = w * 0.14, by = hh * 0.52, s = hh * 0.0007;
  g.fillStyle = "#e8f3ff"; g.beginPath(); g.arc(bx, by - 90 * s * 3, 70 * s * 3, 0, 7); g.fill();
  g.fillStyle = "#ff7a3d"; g.beginPath(); g.ellipse(bx, by - 90 * s * 3, 70 * s * 3, 22 * s * 3, 0, 0, 7); g.fill();
  g.strokeStyle = "#333"; g.lineWidth = 3; g.beginPath(); g.moveTo(bx - 40 * s * 3, by - 40 * s * 3); g.lineTo(bx - 30 * s * 3, by - 5 * s * 3); g.moveTo(bx + 40 * s * 3, by - 40 * s * 3); g.lineTo(bx + 30 * s * 3, by - 5 * s * 3); g.stroke();
  g.fillStyle = "#2f7fe0"; g.fillRect(bx - 55 * s * 3, by - 5 * s * 3, 110 * s * 3, 34 * s * 3); g.fillStyle = "#bfe6ff"; g.fillRect(bx - 48 * s * 3, by + 1 * s * 3, 96 * s * 3, 11 * s * 3); g.fillStyle = "#ffc62e"; g.fillRect(bx - 55 * s * 3, by + 22 * s * 3, 110 * s * 3, 5 * s * 3);
  for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(255,255,255,0.85)"; const cx = r() * w, cy = hh * (0.1 + r() * 0.3), cs = 20 + r() * 40; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + k * cs * 0.7, cy + Math.sin(k) * 6, cs * (0.6 + r() * 0.4), 0, 7); g.fill(); } }
}
function Carga({ progreso, etapa, titulo }) {
  const ref = useRef(null), [consejo, setConsejo] = useState(() => Math.floor(Math.random() * 14));
  useEffect(() => { dibujarPortada(ref.current); const id = setInterval(() => setConsejo((c) => (c + 1) % t("consejos").length), 3500); return () => clearInterval(id); }, []);
  return h("div", { className: "carga" },
    h("canvas", { ref, className: "portada" }),
    h("div", { className: "carga-titulo" }, h("h1", { className: "logo" }, "Isla ", h("span", null, "Royale")), titulo && h("p", null, titulo)),
    h("div", { className: "carga-pie" },
      h("p", { className: "consejo", key: consejo }, "💡 ", t("consejos")[consejo]),
      h("div", { className: "progreso" }, h("i", { style: { width: Math.round(progreso * 100) + "%" } })),
      h("div", { className: "etapa" }, h("span", null, t(etapa || "cargando")), h("b", null, Math.round(progreso * 100) + "%"))));
}

// ── controles comunes ──
function Interruptor({ valor, poner }) { return h("button", { className: "interruptor" + (valor ? " si" : ""), onClick: () => poner(!valor), role: "switch", "aria-checked": valor }, h("i"), valor ? t("si") : t("no")); }
function Deslizador({ valor, poner, min, max, paso }) { return h("span", { className: "deslizador" }, h("input", { type: "range", min, max, step: paso, value: valor, onChange: (e) => poner(+e.target.value) }), h("b", null, valor.toFixed(paso < 1 ? 1 : 0))); }
function Chips({ valor, poner, opciones }) { return h("span", { className: "chips" }, opciones.map(([v, txt]) => h("button", { key: v, className: "chip-op" + (valor === v ? " activa" : ""), onClick: () => poner(v) }, txt))); }

function PanelOpciones({ opciones, poner, cerrar }) {
  const [pest, setPest] = useState("juego");
  const fila = (etq, ctrl) => h("label", { className: "fila-op" }, h("span", null, etq), ctrl);
  const o = opciones, p = (k) => (v) => poner({ ...o, [k]: v });
  return h("div", { className: "modal", onClick: (e) => { if (e.target === e.currentTarget) cerrar(); } }, h("div", { className: "panel" },
    h("div", { className: "panel-cab" }, h("h2", null, t("opciones")), h("button", { className: "cerrar", onClick: cerrar, "aria-label": t("cerrar") }, "✕")),
    h("div", { className: "pestanas" }, ["juego", "video", "audio", "controles"].map((k) => h("button", { key: k, className: pest === k ? "activa" : "", onClick: () => setPest(k) }, t(k)))),
    h("div", { className: "panel-cuerpo" },
      pest === "juego" && [
        fila(t("idioma"), h(Chips, { key: "i", valor: o.idioma, poner: p("idioma"), opciones: [["es", "Español"], ["en", "English"], ["pt", "Português"]] })),
        fila(t("sens"), h(Deslizador, { key: "s", valor: o.sens, poner: p("sens"), min: 0.3, max: 2.5, paso: 0.1 })),
        fila(t("sensMira"), h(Deslizador, { key: "sm", valor: o.sensMira, poner: p("sensMira"), min: 0.2, max: 1.5, paso: 0.1 })),
        fila(t("asistencia"), h(Interruptor, { key: "a", valor: o.asistencia, poner: p("asistencia") })),
        fila(t("autoDisparo"), h(Interruptor, { key: "ad", valor: o.autoDisparo, poner: p("autoDisparo") })),
        fila(t("autoCorrer"), h(Interruptor, { key: "ac", valor: o.autoCorrer, poner: p("autoCorrer") })),
      ],
      pest === "video" && [
        fila(t("calidad"), h(Chips, { key: "c", valor: o.calidad, poner: p("calidad"), opciones: [["alta", t("alta")], ["media", t("media")], ["baja", t("baja")]] })),
        fila(t("fps"), h(Interruptor, { key: "f", valor: o.fps, poner: p("fps") })),
      ],
      pest === "audio" && fila(t("volumen"), h(Deslizador, { valor: o.volumen, poner: p("volumen"), min: 0, max: 1, paso: 0.1 })),
      pest === "controles" && [
        fila(t("botones"), h(Deslizador, { key: "b", valor: o.botones, poner: p("botones"), min: 0.7, max: 1.4, paso: 0.1 })),
        h("div", { key: "tecl", className: "teclas" }, [["WASD", "tecla_mover"], ["Shift", "tecla_correr"], ["C / Ctrl", "tecla_agachar"], [t("espacio"), "tecla_saltar"], ["Clic", "tecla_disparar"], ["Clic der.", "tecla_apuntar"], ["R", "tecla_recargar"], ["E", "tecla_usar"], ["1-5", "tecla_armas"], ["F", "tecla_pico"], ["Q Z X V", "tecla_piezas"], ["Clic der. (construyendo)", "tecla_material"], ["M", "tecla_mapa"], ["G", "tecla_baile"], ["Esc", "tecla_pausa"]].map(([k, d]) => h("div", { key: k }, h("kbd", null, k), t(d)))),
        h("p", { key: "tac", className: "nota" }, t("tactil_mover"), " · ", t("tactil_mirar"), " · ", t("tactil_botones")),
      ])));
}

// ════════════════════════════════════════════════════════════════════════
// Vestíbulo
// ════════════════════════════════════════════════════════════════════════
function Vestibulo({ opciones, poner, stats, jugar, abrirOpciones, motor }) {
  const [pest, setPest] = useState("jugar"), arrastre = useRef(null);
  const nivel = nivelDe(stats.xp), xpNivel = 120 * (nivel - 1) ** 2, xpSig = 120 * nivel ** 2;
  return h("div", { className: "vestibulo" },
    h("div", { className: "giro", onPointerDown: (e) => { arrastre.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }, onPointerMove: (e) => { if (arrastre.current == null) return; motor.girarVestibulo((e.clientX - arrastre.current) * 0.01); arrastre.current = e.clientX; }, onPointerUp: () => { arrastre.current = null; } }),
    h("header", { className: "barra-sup" },
      h("div", { className: "marca" }, "ISLA ", h("span", null, "ROYALE")),
      h("nav", { className: "tabs" },
        h("button", { className: pest === "jugar" ? "activa" : "", onClick: () => { Sonido.boton(); setPest("jugar"); } }, t("jugar")),
        h("button", { className: pest === "casillero" ? "activa" : "", onClick: () => { Sonido.boton(); setPest("casillero"); } }, t("casillero")),
        h("button", { onClick: () => { Sonido.boton(); abrirOpciones(); } }, t("opciones"))),
      h("div", { className: "perfil" }, h("span", { className: "nivel" }, nivel), h("div", null, h("b", null, opciones.nombre || t("solo")), h("div", { className: "xp" }, h("i", { style: { width: ((stats.xp - xpNivel) / (xpSig - xpNivel)) * 100 + "%" } }))))),
    pest === "jugar" && h("aside", { className: "lado-izq" },
      h("label", { className: "campo" }, h("span", null, t("tuNombre")), h("input", { value: opciones.nombre, maxLength: 16, placeholder: t("solo"), onChange: (e) => poner({ ...opciones, nombre: e.target.value }) })),
      h("div", { className: "stats" }, [["victorias", stats.victorias], ["bajas", stats.bajas], ["partidas", stats.partidas]].map(([k, v]) => h("div", { key: k }, h("b", null, v), t(k)))),
      h("div", { className: "idiomas" }, [["es", "ES"], ["en", "EN"], ["pt", "PT"]].map(([k, n]) => h("button", { key: k, className: opciones.idioma === k ? "activa" : "", onClick: () => poner({ ...opciones, idioma: k }) }, n)))),
    pest === "casillero" && h("aside", { className: "lado-izq casillero" },
      h("h2", null, t("casillero")),
      h("div", { className: "trajes" }, TRAJES.map((tr, i) => h("button", { key: i, className: "traje" + (opciones.traje === i ? " activa" : ""), onClick: () => { Sonido.boton(); poner({ ...opciones, traje: i }); }, style: { "--c1": tr.ropa, "--c2": tr.pantalon } }, h("i"), h("span", null, t("traje" + i)), opciones.traje === i && h("small", null, t("equipado")))))),
    h("div", { className: "giro-nota" }, "⟲ ", t("girar")),
    h("div", { className: "lado-der" },
      h("div", { className: "modo" }, h("small", null, t("modo")), h("b", null, t("solo")), h("div", { className: "rivales" }, t("rivales"), ": ", h(Chips, { valor: opciones.rivales, poner: (v) => poner({ ...opciones, rivales: v }), opciones: [[6, "6"], [14, "14"], [24, "24"]] }))),
      h("button", { className: "jugar", onClick: jugar, autoFocus: true }, t("jugar"))));
}
function Buscando({ total, cancelar }) {
  const [s, setS] = useState(0);
  useEffect(() => { const id = setInterval(() => setS((v) => v + 1), 250); return () => clearInterval(id); }, []);
  return h("div", { className: "buscando" }, h("div", { className: "giratorio" }), h("b", null, t("buscando")), h("span", null, t("encontrados", { n: Math.min(total, 1 + Math.floor(s * total / 9)) }) + " / " + total), h("button", { className: "jugar sec", onClick: cancelar }, t("cancelar")));
}

// ════════════════════════════════════════════════════════════════════════
// HUD
// ════════════════════════════════════════════════════════════════════════
function Ranura({ it, activa, tecla, onClick }) {
  const R = it ? RAREZAS[it.rareza] : null;
  return h("button", { className: "ranura" + (activa ? " activa" : "") + (it ? "" : " vacia"), onClick, style: R ? { "--r": R.color, "--ro": R.oscuro } : null, title: it ? it.nombre : "" },
    h("small", { className: "tecla" }, tecla), it && h("img", { src: icono(it.icono), alt: it.nombre }), it && it.mun != null && h("small", { className: "cant" }, it.mun), it && it.cant != null && h("small", { className: "cant" }, "×" + it.cant));
}
function Hud({ H, motor, tactil, bloqueado, pausar }) {
  const mini = useRef(null), grande = useRef(null), brujula = useRef(null);
  const [mapa, setMapa] = useState(false);
  useEffect(() => { motor.ponerMinimapa(mini.current); motor.ponerBrujula(brujula.current); return () => { motor.ponerMinimapa(null); motor.ponerBrujula(null); }; }, []);
  useEffect(() => { motor.ponerMapaGrande(mapa ? grande.current : null); }, [mapa]);
  useEffect(() => { motor.alMapa = () => setMapa((v) => !v); }, []);
  const E = motor.entrada, T = H.tormenta;
  const tormentaTxt = T.estado === "fin" ? t("tormentaFin") : T.estado === "cierra" ? `${t("tormentaCierra")} · ${T.t}s` : `${t("tormentaEn")} ${Math.floor(T.t / 60)}:${String(T.t % 60).padStart(2, "0")}`;
  const marcar = (e) => { const r = e.currentTarget.getBoundingClientRect(); motor.marcar(((e.clientX - r.left) / r.width) * 520 - 260, ((e.clientY - r.top) / r.height) * 520 - 260); };
  const enTierra = H.estado === "tierra" && H.vivo;
  return h("div", { className: "hud" + (tactil ? " tactil-si" : "") },
    H.enTormenta && h("div", { className: "en-tormenta" }),
    H.dano ? h("div", { className: "danio", key: H.dano }) : null,
    H.mira && h("div", { className: "mira-franco" }),
    h("canvas", { ref: brujula, className: "brujula" }),
    h("div", { className: "arriba-der" },
      h("canvas", { className: "minimapa", ref: mini, onClick: () => setMapa(true) }),
      h("div", { className: "fila" },
        h("span", { className: "chip" }, "👤 ", h("b", null, H.vivos)), h("span", { className: "chip" }, "💀 ", h("b", null, H.bajas)),
        h("span", { className: "chip tormenta" + (T.estado === "cierra" ? " cierra" : "") }, "🌀 ", tormentaTxt)),
      enTierra && h("div", { className: "mats" }, LISTA_MAT.map((m) => h("span", { key: m, className: "mat" + (H.mat === m ? " activa" : "") }, h("img", { src: icono(m), alt: t(m) }), H.mats[m])))),
    H.fps != null && h("span", { className: "fps" }, H.fps + " fps"),
    h("div", { className: "vitales" },
      h("div", { className: "barra escudo" }, h("i", { style: { width: H.escudo + "%" } }), h("span", null, h("b", null, "🛡 " + H.escudo))),
      h("div", { className: "barra vida" + (H.vida <= 30 ? " baja" : "") }, h("i", { style: { width: H.vida + "%" } }), h("span", null, h("b", null, "✚ " + H.vida)))),
    h("div", { className: "feed" }, H.feed.map((f) => h("div", { key: f.id, className: f.yo ? "yo" : "" }, h("b", null, f.a), " ⌖ ", f.b))),
    enTierra && !H.fin && !H.mira && h("div", { ref: (el) => motor.ponerMira(el), className: "mira" + (H.construyendo ? " punto" : H.arma === "escopeta" ? " escopeta" : H.arma === "pico" || !H.arma ? " punto" : "") }, ["p", "a", "b", "c", "d"].map((k) => h("i", { key: k, className: k })), h("i", { className: "x x1" }), h("i", { className: "x x2" })),
    (H.curando || H.recarga != null) && h("div", { className: "progreso-accion" }, h("svg", { viewBox: "0 0 40 40" }, h("circle", { cx: 20, cy: 20, r: 16, className: "fondo" }), h("circle", { cx: 20, cy: 20, r: 16, className: "valor", style: { strokeDashoffset: 100 - (H.curando ? H.curando.k : H.recarga) * 100 } })), h("span", null, H.curando ? t("usando", { n: H.curando.nombre }) : t("recargando"))),
    H.interaccion && enTierra && h("button", { className: "interaccion", style: { "--r": RAREZAS[H.interaccion.rareza].color }, onClick: () => { E.usar = true; } }, !tactil && h("kbd", null, "E"), h("span", null, H.interaccion.texto), h("b", null, H.interaccion.nombre)),
    H.estado === "bus" && H.vivo && h("div", { className: "caida" }, h("b", null, t("enAutobus")), t("autobusSeVa", { n: H.busT }), !tactil && h("div", null, h("kbd", null, t("espacio")), " ", t("saltarBus"))),
    (H.estado === "cae" || H.estado === "planea") && H.vivo && h("div", { className: "caida" }, h("b", null, H.estado === "cae" ? t("caidaLibre") : t("planeando")), h("span", { className: "altimetro" }, t("altura", { n: H.altura })), h("small", null, H.estado === "cae" ? t("mirarAbajo") : "")),
    H.aviso && h("div", { className: "aviso", key: H.aviso }, H.aviso),
    H.eliminacion && h("div", { className: "eliminacion", key: H.eliminacion }, H.eliminacion),
    H.espectando && !H.vivo && h("div", { className: "caida" }, h("b", null, t("espectar")), H.espectando),
    !tactil && !bloqueado && H.vivo && !H.fin && !H.pausado && h("div", { className: "clic" }, t("clicMouse")),
    enTierra && H.construyendo && h("div", { className: "barra-construir" }, PIEZAS.map((k, i) => h("button", { key: k, className: "pieza" + (H.pieza === k ? " activa" : ""), onClick: () => { E.pieza = k; } }, h("img", { src: icono(k), alt: t(k) }), h("small", null, tactil ? t(k) : ["Q", "Z", "X", "V"][i]))), h("button", { className: "pieza material", onClick: () => { E.material = true; } }, h("img", { src: icono(H.mat), alt: t(H.mat) }), h("small", null, t(H.mat)))),
    h("div", { className: "hotbar" },
      H.inv.map((it, i) => h(Ranura, { key: i, it, activa: H.sel === i && !H.construyendo, tecla: i === 0 ? "F" : String(i), onClick: () => { E.sel = i; } })),
      H.reserva != null && h("div", { className: "municion" }, h("b", null, (H.inv[H.sel] || {}).mun), " / ", H.reserva)),
    !tactil && enTierra && h("div", { className: "ayuda-pc" }, h("kbd", null, "B"), " ", t("construir"), "  ", h("kbd", null, "G"), " ", t("baile")),
    tactil && h("button", { className: "pausa-btn", onClick: pausar, "aria-label": t("pausa") }, "❚❚"),
    mapa && h("div", { className: "mapa-grande", onClick: (e) => { if (e.target === e.currentTarget) setMapa(false); } }, h("div", null, h("canvas", { ref: grande, onClick: marcar }), h("p", null, t("marcar"), " · ", h("button", { className: "chip-op", onClick: () => setMapa(false) }, t("cerrar"))))));
}

// ── controles táctiles (disposición como la del original en el teléfono) ──
function Palanca({ onMover }) {
  const zona = useRef(null), [pos, setPos] = useState(null), [perilla, setPerilla] = useState([0, 0]), dedo = useRef(null);
  const mover = (e, c) => { let dx = (e.clientX - c.x) / 55, dy = (e.clientY - c.y) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } setPerilla([dx, dy]); onMover(dx, dy); };
  return h("div", {
    ref: zona, className: "zona-mover",
    onPointerDown: (e) => { dedo.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); const c = { x: e.clientX, y: e.clientY }; setPos(c); mover(e, c); },
    onPointerMove: (e) => { if (dedo.current === e.pointerId && pos) mover(e, pos); },
    onPointerUp: () => { dedo.current = null; setPos(null); setPerilla([0, 0]); onMover(0, 0); }, onPointerCancel: () => { dedo.current = null; setPos(null); setPerilla([0, 0]); onMover(0, 0); },
  }, h("div", { className: "palanca" + (pos ? " activa" : ""), style: pos ? { left: pos.x - zona.current.getBoundingClientRect().left, top: pos.y - zona.current.getBoundingClientRect().top } : null }, h("i", { style: { transform: `translate(${perilla[0] * 36}px, ${perilla[1] * 36}px)` } })));
}
function Mantener({ clase, texto, poner, titulo }) {
  const [activo, setActivo] = useState(false);
  const v = (b) => { setActivo(b); poner(b); };
  return h("button", { className: "btn-t " + clase + (activo ? " activo" : ""), "aria-label": titulo || texto, onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); v(true); }, onPointerUp: () => v(false), onPointerCancel: () => v(false), onContextMenu: (e) => e.preventDefault() }, texto);
}
function Tactil({ motor, H, escala }) {
  const E = motor.entrada, arrastre = useRef(null);
  const toca = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };
  const B = (clase, texto, fn, activo) => h("button", { className: "btn-t " + clase + (activo ? " activo" : ""), onPointerDown: toca(fn), "aria-label": texto }, texto);
  const tierra = H.estado === "tierra" && H.vivo;
  return h("div", { className: "tactil", style: { "--escala": escala } },
    h("div", {
      className: "zona-mirar",
      onPointerDown: (e) => { arrastre.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); },
      onPointerMove: (e) => { const a = arrastre.current; if (!a || a.id !== e.pointerId) return; E.dYaw += (e.clientX - a.x) * 0.0062; E.dPitch += (e.clientY - a.y) * 0.0052; a.x = e.clientX; a.y = e.clientY; },
      onPointerUp: () => { arrastre.current = null; }, onPointerCancel: () => { arrastre.current = null; },
    }),
    h(Palanca, { onMover: (dx, dy) => { E.mx = dx; E.my = dy; } }),
    H.estado === "bus" && H.puedeSaltar && B("saltar-bus", t("saltarBus"), () => { E.saltar = true; }),
    H.estado === "cae" && B("saltar-bus", t("abrirPlaneador"), () => { E.saltar = true; }),
    tierra && [
      h(Mantener, { key: "d1", clase: "disparo-der", texto: H.construyendo ? "🔨" : "🎯", titulo: t("disparar"), poner: (b) => { E.dedo1 = b; } }),
      h(Mantener, { key: "d2", clase: "disparo-izq", texto: H.construyendo ? "🔨" : "🎯", titulo: t("disparar"), poner: (b) => { E.dedo2 = b; } }),
      B("saltar", "⤒", () => { E.saltar = true; }),
      B("agachar", H.agachado ? "▲" : "▼", () => { E.agachar = true; }, H.agachado),
      B("construir", H.construyendo ? "⚔" : "🔨", () => { E.construir = true; }, H.construyendo),
      !H.construyendo && B("apuntar", "◎", () => { E.apuntar = !E.apuntar; }, H.apuntando),
      !H.construyendo && B("recargar", "⟳", () => { E.recargar = true; }),
      H.construyendo && B("material", "◧", () => { E.material = true; }),
      B("baile-t", "♪", () => { E.baile = true; }),
    ]);
}

function Pausa({ continuar, opciones, salir }) {
  return h("div", { className: "modal" }, h("div", { className: "panel chico" }, h("h2", null, t("pausa")), h("button", { className: "jugar", onClick: continuar, autoFocus: true }, t("continuar")), h("button", { className: "jugar sec", onClick: opciones }, t("opciones")), h("button", { className: "jugar sec", onClick: salir }, t("salir"))));
}
function Fin({ fin, xp, jugar, alVestibulo, espectar }) {
  const m = Math.floor(fin.tiempo / 60), s = String(Math.floor(fin.tiempo % 60)).padStart(2, "0");
  return h("div", { className: "pantalla fin" }, h("div", { className: "tarjeta" },
    h("h1", { className: "victoria" + (fin.gano ? "" : " perdio") }, fin.gano ? t("victoria") : t("eliminado")),
    h("p", { className: "bajada" }, fin.gano ? t("ganaste") : t("teElimino", { n: fin.asesino || "?" })),
    h("div", { className: "datos" }, [["#" + fin.puesto, t("puesto")], [fin.bajas, t("bajas")], [Math.round(fin.dano), t("dano")], [Math.round(fin.precision * 100) + "%", t("precision")], [`${m}:${s}`, t("tiempo")], ["+" + xp, t("xp")]].map(([v, k]) => h("div", { key: k }, h("b", null, v), k))),
    h("div", { className: "botonera" }, h("button", { className: "jugar", onClick: jugar, autoFocus: true }, t("otraVez")), !fin.gano && h("button", { className: "jugar sec", onClick: espectar }, t("espectar")), h("button", { className: "jugar sec", onClick: alVestibulo }, t("volver")))));
}

// ════════════════════════════════════════════════════════════════════════
// La aplicación
// ════════════════════════════════════════════════════════════════════════
function App() {
  const lienzo = useRef(null), capa = useRef(null), motor = useRef(null);
  const [fase, setFase] = useState("carga"), [prog, setProg] = useState({ k: 0, etapa: "cargando" }), [error, setError] = useState(null);
  const [opciones, setOpcionesR] = useState(() => leer("opciones", OPCIONES_BASE)), [stats, setStats] = useState(() => leer("stats", STATS_BASE));
  const [hud, setHud] = useState(null), [fin, setFin] = useState(null), [xpGanada, setXp] = useState(0), [tactil, setTactil] = useState(TOCABLE), [bloqueado, setBloqueado] = useState(false);
  const [verOpciones, setVerOpciones] = useState(false), [pausa, setPausa] = useState(false), [nota, setNota] = useState(null), [espectando, setEspectando] = useState(false);
  IDIOMA = opciones.idioma;
  const ponerOpciones = useCallback((o) => { setOpcionesR(o); guardar("opciones", o); IDIOMA = o.idioma; if (motor.current) { motor.current.ponerOpciones(o); } }, []);
  useEffect(() => { document.documentElement.lang = opciones.idioma; }, [opciones.idioma]);
  useEffect(() => { if (motor.current) motor.current.calidad(opciones.calidad); }, [opciones.calidad]);
  useEffect(() => {
    let vivo = true;
    crearMotor({
      lienzo: lienzo.current, capa: capa.current,
      progreso: (k, etapa) => vivo && setProg({ k, etapa }),
      alHud: setHud, alBloqueo: setBloqueado, alTactil: (v) => { setTactil(v); if (motor.current) motor.current.tactil = v; },
      alFin: (f) => { setFin(f); setEspectando(false); },
      alMapa: () => motor.current && motor.current.alMapa && motor.current.alMapa(),
      alPausa: () => { setPausa(true); motor.current.pausar(true); },
      alCalidad: (c, fps) => { setOpcionesR((o) => { const n = { ...o, calidad: c }; guardar("opciones", n); return n; }); setNota(`${fps} fps → ${t("calidad")}: ${t(c)}`); setTimeout(() => setNota(null), 4000); },
    }).then((m) => {
      if (!vivo) return;
      motor.current = m; window.__isla = m; // para las pruebas
      m.ponerOpciones(opciones); m.tactil = TOCABLE; m.calidad(opciones.calidad);
      setProg({ k: 1, etapa: "listo" }); setTimeout(() => { m.vestibulo(); setFase("vestibulo"); }, 350);
    }).catch((e) => { console.error(e); setError(String((e && e.message) || e)); });
    return () => { vivo = false; if (motor.current) motor.current.destruir(); };
  }, []);
  // Al terminar, sumar a las estadísticas.
  useEffect(() => {
    if (!fin) return;
    const xp = Math.round(fin.bajas * 50 + (fin.tiempo / 60) * 20 + fin.dano * 0.2 + (fin.gano ? 500 : 0));
    setXp(xp);
    setStats((s) => { const n = { partidas: s.partidas + 1, victorias: s.victorias + (fin.gano ? 1 : 0), bajas: s.bajas + fin.bajas, xp: s.xp + xp }; guardar("stats", n); return n; });
  }, [fin]);
  const jugar = () => {
    Sonido.iniciar(); Sonido.boton(); setFin(null); setPausa(false); setFase("buscando");
  };
  const empezarCarga = async () => {
    setFase("cargaPartida"); setProg({ k: 0.1, etapa: "etapa_partida" });
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 50));
    await motor.current.prepararPartida(); setProg({ k: 0.7, etapa: "etapa_partida" });
    const falta = Math.max(0, 2200 - (performance.now() - t0));
    await new Promise((r) => setTimeout(r, falta)); setProg({ k: 1, etapa: "listo" });
    await new Promise((r) => setTimeout(r, 250));
    motor.current.empezar(); setFase("juego");
  };
  useEffect(() => { if (fase !== "buscando") return; const id = setTimeout(empezarCarga, 2600); return () => clearTimeout(id); }, [fase]);
  const alVestibulo = () => { motor.current.vestibulo(); setFase("vestibulo"); setFin(null); setHud(null); setPausa(false); };
  const continuar = () => { setPausa(false); motor.current.pausar(false); };
  const enJuego = fase === "juego" && hud;
  return h(React.Fragment, null,
    h("canvas", { className: "juego", ref: lienzo }),
    h("canvas", { className: "capa", ref: capa }),
    error && h("div", { className: "pantalla" }, h("div", { className: "tarjeta" }, h("h1", { className: "logo" }, "Uy"), h("p", { className: "bajada" }, "Este navegador no pudo arrancar los gráficos 3D (WebGL). Probá con Chrome o Safari actualizados."), h("p", { className: "bajada" }, error))),
    !error && (fase === "carga" || fase === "cargaPartida") && h(Carga, { progreso: prog.k, etapa: prog.etapa, titulo: fase === "cargaPartida" ? `${t("modo")} · ${t("solo")} · ${t("rivalesN", { n: opciones.rivales })}` : null }),
    !error && (fase === "vestibulo" || fase === "buscando") && motor.current && h(Vestibulo, { opciones, poner: ponerOpciones, stats, jugar, abrirOpciones: () => setVerOpciones(true), motor: motor.current }),
    fase === "buscando" && h(Buscando, { total: opciones.rivales + 1, cancelar: () => setFase("vestibulo") }),
    enJuego && h(Hud, { H: hud, motor: motor.current, tactil, bloqueado, pausar: () => { setPausa(true); motor.current.pausar(true); } }),
    enJuego && tactil && !pausa && !(fin && !espectando) && h(Tactil, { motor: motor.current, H: hud, escala: opciones.botones }),
    enJuego && pausa && !verOpciones && h(Pausa, { continuar, opciones: () => setVerOpciones(true), salir: alVestibulo }),
    fase === "juego" && fin && !espectando && h(Fin, { fin, xp: xpGanada, jugar, alVestibulo, espectar: () => { motor.current.espectar(); setEspectando(true); } }),
    fase === "juego" && fin && espectando && h("div", { className: "espectar-barra" }, h("button", { className: "jugar sec", onClick: () => setEspectando(false) }, "✕"), h("button", { className: "jugar sec", onClick: alVestibulo }, t("volver"))),
    verOpciones && h(PanelOpciones, { opciones, poner: ponerOpciones, cerrar: () => setVerOpciones(false) }),
    nota && h("div", { className: "nota-flotante" }, nota),
    fase !== "carga" && h("div", { className: "girar-tel" }, "📱↻ ", t("girarTel")));
}
ReactDOM.createRoot(document.getElementById("raiz")).render(h(App));
