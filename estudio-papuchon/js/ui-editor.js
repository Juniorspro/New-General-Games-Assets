"use strict";
// ════════════════════════════════════════════════════════════════════════
// Interfaz del editor: barra de arriba, vista previa (con manijas para mover
// y agrandar gráficos), controles de reproducción y línea de tiempo.
// ════════════════════════════════════════════════════════════════════════

// ── Acciones que usan varios paneles ──
const soltarLuego = demorar((etiqueta) => Tienda.soltar(etiqueta), 600);
const Acciones = {
  // En el celular, elegir no tapa la línea de tiempo: las propiedades se abren con "Editar".
  elegir(cid, abrir = false) { Tienda.set({ seleccion: cid, inspector: abrir, ...(cid && esCel() ? { panel: null } : {}) }); },
  agregarMedio(medio, destino = "video", en = null) {
    let nuevo = null; const t = en != null ? en : Motor.tiempo();
    Tienda.cambiar((p) => { const r = Proyecto.agregarMedio(p, medio, { pista: destino, en: t }); nuevo = r.clip; return r.p; }, "agregar " + medio.nombre);
    if (nuevo) { Acciones.elegir(nuevo.id); Tienda.aviso(destino === "video" ? "Agregado al video" : destino === "superpuesta" ? "Agregado encima del video" : "Agregado al audio", "ok", 1600); }
    return nuevo;
  },
  agregarGrafico(plantillaId, params = {}, en = null, duracion = null) {
    let nuevo = null; const t = en != null ? en : Motor.tiempo();
    Tienda.cambiar((p) => { const r = Proyecto.agregarGrafico(p, plantillaId, t, params); nuevo = r.clip; let q = r.p; if (duracion) q = Proyecto.cambiarClip(q, nuevo.id, { duracion }); return q; }, "agregar gráfico");
    if (nuevo) Acciones.elegir(nuevo.id, true);   // a un gráfico casi siempre se le cambia el texto
    return nuevo;
  },
  // Divide el clip elegido en el cabezal; si no hay elegido, el del video principal.
  dividir() {
    const s = Tienda.get(), p = s.proyecto, t = Motor.tiempo(); if (!p) return;
    let cid = s.seleccion; const b = cid && Proyecto.buscarClip(p, cid);
    if (!b || t <= b.clip.inicio || t >= Proyecto.fin(b.clip)) { const v = Proyecto.pista(p, "video").clips.find((c) => t > c.inicio && t < Proyecto.fin(c)); cid = v && v.id; }
    if (!cid) { Tienda.aviso("Poné el cabezal sobre un clip para cortarlo", "info"); return; }
    Tienda.cambiar((q) => Proyecto.dividir(q, cid, t), "cortar");
  },
  borrar() { const cid = Tienda.get().seleccion; if (cid) { Tienda.cambiar((p) => Proyecto.borrar(p, cid), "borrar"); Tienda.set({ seleccion: null }); } },
  duplicar() { const cid = Tienda.get().seleccion; if (cid) Tienda.cambiar((p) => Proyecto.duplicar(p, cid), "duplicar"); },
  // Cambios de deslizadores y textos: se ven en vivo y entran al deshacer como uno solo al parar.
  cambiar(cid, cambios, etiqueta = "cambio") { Tienda.cambiarEnVivo((p) => Proyecto.cambiarClip(p, cid, cambios)); soltarLuego(etiqueta); },
  // Vestir el video con el canal: intro, mosca, zócalo, ticker, barra de progreso y cierre.
  vestir() {
    const p0 = Tienda.get().proyecto; if (!p0) return;
    const D = Proyecto.duracion(Proyecto.pista(p0, "video").clips.length ? { ...p0, pistas: [Proyecto.pista(p0, "video")] } : p0);
    if (D < 3) { Tienda.aviso("Primero agregá tu video (más de 3 segundos)", "info"); return; }
    Tienda.cambiar((p) => {
      const pon = (pl, en, dur, params = {}) => { const r = Proyecto.agregarGrafico(p, pl, en, params); p = Proyecto.cambiarClip(r.p, r.clip.id, { duracion: Math.max(0.5, dur) }); };
      const fi = Math.min(2.6, D * 0.3);   // la mosca entra cuando termina la intro
      pon("intro", 0, fi);
      pon("mosca", fi - 0.2, D - fi + 0.2);
      pon("zocalo-ultimo", Math.min(2.8, D * 0.25), Math.min(6, D * 0.5));
      if (D > 10) pon("ticker", 2, D - 2);
      pon("progreso", 0, D);
      if (D > 8) pon("cierre", D - 3.5, 3.5);
      return p;
    }, "vestir con el canal");
    Tienda.aviso("Listo: intro, mosca, zócalo, ticker y cierre. Tocá cada uno para cambiar el texto.", "ok", 5000);
  },
};

// ── Barra de arriba ──
function Barra() {
  const p = useTienda((e) => e.proyecto), guardado = useTienda((e) => e.guardado);
  useTienda((e) => e.proyecto && Tienda.puedeDeshacer);
  const [nombre, setNombre] = useState(p.nombre);
  useEffect(() => setNombre(p.nombre), [p.id, p.nombre]);
  const guardarNombre = () => { const n = nombre.trim() || "Sin título"; if (n !== p.nombre) Tienda.cambiar((q) => ({ ...q, nombre: n, editado: Date.now() }), "nombre"); };
  return html`<header class="barra">
    <${Boton} icono="casa" tipo="fantasma" titulo="Volver a mis videos" onClick=${() => { Motor.parar(); Tienda.cerrar(); }} />
    <div class="nombre"><input id="nombre-proyecto" aria-label="Nombre del video" value=${nombre} onInput=${(e) => setNombre(e.target.value)} onBlur=${guardarNombre} onKeyDown=${(e) => e.key === "Enter" && e.target.blur()} />
      <span class="estado">${guardado ? "Guardado" : "Guardando…"} · ${p.formato.id}</span></div>
    <${Boton} icono="deshacer" tipo="fantasma" titulo="Deshacer (Ctrl+Z)" desactivado=${!Tienda.puedeDeshacer} onClick=${Tienda.deshacer} />
    <${Boton} icono="rehacer" tipo="fantasma" titulo="Rehacer (Ctrl+Y)" desactivado=${!Tienda.puedeRehacer} onClick=${Tienda.rehacer} />
    <${Boton} icono="exportar" tipo="primario" titulo="Exportar el video" onClick=${() => { Motor.parar(); Tienda.set({ exportando: true }); }}><span class="solo-pc">Exportar</span><//>
  </header>`;
}

// ── Riel de pestañas (izquierda en la compu, abajo en el celular) ──
const PESTANAS = [
  ["medios", "medios", "Medios"], ["plantillas", "capas", "Gráficos"], ["texto", "texto", "Texto"], ["subtitulos", "subs", "Subtít."],
  ["voz", "micro", "Voz"], ["audio", "musica", "Audio"], ["proyecto", "ajustes", "Ajustes"],
];
function Riel() {
  const panel = useTienda((e) => e.panel);
  return html`<nav class="riel" aria-label="Herramientas">${PESTANAS.map(([k, ic, et]) => html`<button key=${k} type="button" class=${panel === k ? "si" : ""} aria-pressed=${panel === k}
    onClick=${() => Tienda.set({ panel: panel === k ? null : k, ...(esCel() ? { seleccion: null } : {}) })}><${Icono} n=${ic} />${et}</button>`)}</nav>`;
}

// ── Vista previa ──
function Vista({ zonaSegura }) {
  const p = useTienda((e) => e.proyecto), sel = useTienda((e) => e.seleccion), marca = useTienda((e) => e.marca);
  const t = useTiempo(), cont = useRef(null), cv = useRef(null), [tam, setTam] = useState({ w: 0, h: 0 }), arr = useRef(null);
  const W = p.formato.ancho, H = p.formato.alto;
  useLayoutEffect(() => {
    const el = cont.current; if (!el) return;
    const medir = () => { const r = el.getBoundingClientRect(), aw = r.width - 20, ah = r.height - 20; const k = Math.min(aw / W, ah / H); setTam({ w: Math.max(40, Math.floor(W * k)), h: Math.max(40, Math.floor(H * k)) }); };
    medir(); const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, [W, H]);
  useEffect(() => {
    const c = cv.current; if (!c || !tam.w) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), iw = Math.min(W, Math.round(tam.w * dpr)), esc = iw / W;
    c.width = iw; c.height = Math.round(H * esc); Motor.conectar(c, esc);
  }, [tam.w, tam.h, W, H]);
  useEffect(() => { Motor.refrescarRecursos(); }, [marca]);
  useEffect(() => () => Motor.conectar(null), []);
  const k = tam.w / W;
  // Lo que se puede agarrar con el dedo en t: gráficos y videos de encima (de arriba hacia abajo).
  function cajaDe(pista, c) { return pista.tipo === "grafico" ? Plantillas.cajaClip(c, W, H, marca) : c.caja ? { x: c.caja.x, y: c.caja.y, ancho: c.caja.ancho, alto: c.caja.alto } : null; }
  function agarrables() {
    const r = [];
    for (const pista of p.pistas) if (!pista.oculta && (pista.tipo === "grafico" || pista.tipo === "superpuesta")) for (const c of pista.clips) if (t >= c.inicio && t < Proyecto.fin(c)) r.push({ pista, c });
    return r.reverse();
  }
  const aProy = (e) => { const r = cv.current.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  function bajar(e, modo = "mover") {
    if (Motor.reproduciendo) Motor.parar();
    const q = aProy(e); let obj = null;
    if (modo === "mover") {
      for (const x of agarrables()) { const b = cajaDe(x.pista, x.c); if (b && q.x >= b.x - 20 && q.x <= b.x + b.ancho + 20 && q.y >= b.y - 20 && q.y <= b.y + b.alto + 20) { obj = x; break; } }
      if (!obj) { const v = Proyecto.pista(p, "video").clips.find((c) => t >= c.inicio && t < Proyecto.fin(c)); Acciones.elegir(v ? v.id : null); return; }
    } else { const b = Proyecto.buscarClip(p, sel); if (!b) return; obj = { pista: b.pista, c: b.clip }; }
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    if (obj.c.id !== sel) Acciones.elegir(obj.c.id); else if (esCel()) Tienda.set({ inspector: true });
    const b = cajaDe(obj.pista, obj.c);
    arr.current = { modo, cid: obj.c.id, tipo: obj.pista.tipo, q0: q, caja: { ...obj.c.caja }, centro: { x: b.x + b.ancho / 2, y: b.y + b.alto / 2 }, base: { ...b } };
  }
  function mover(e) {
    const a = arr.current; if (!a) return;
    const q = aProy(e), dx = q.x - a.q0.x, dy = q.y - a.q0.y;
    let cambios;
    if (a.modo === "mover") {
      let nx = (a.caja.x || 0) + dx, ny = (a.caja.y || 0) + dy;
      if (a.tipo === "grafico") { if (Math.abs(nx) < 14) nx = 0; if (Math.abs(ny) < 14) ny = 0; }   // vuelve a su lugar original
      else { const cx = nx + a.base.ancho / 2; if (Math.abs(cx - W / 2) < 14) nx = W / 2 - a.base.ancho / 2; }
      cambios = { caja: { x: Math.round(nx), y: Math.round(ny) } };
    } else {
      const d0 = Math.hypot(a.q0.x - a.centro.x, a.q0.y - a.centro.y) || 1, f = Math.hypot(q.x - a.centro.x, q.y - a.centro.y) / d0;
      if (a.tipo === "grafico") cambios = { caja: { escala: clamp((a.caja.escala || 1) * f, 0.25, 4) } };
      else { const an = clamp(a.caja.ancho * f, 80, W * 2), al = an * (a.caja.alto / a.caja.ancho); cambios = { caja: { ancho: Math.round(an), alto: Math.round(al), x: Math.round(a.centro.x - an / 2), y: Math.round(a.centro.y - al / 2) } }; }
    }
    Tienda.cambiarEnVivo((pp) => Proyecto.cambiarClip(pp, a.cid, cambios));
  }
  function subir() { if (arr.current) { arr.current = null; Tienda.soltar("mover"); } }
  // Manijas del elegido (si se ve en este momento).
  let manijas = null;
  const b = sel && Proyecto.buscarClip(p, sel);
  if (b && (b.pista.tipo === "grafico" || b.pista.tipo === "superpuesta") && t >= b.clip.inicio && t < Proyecto.fin(b.clip) && tam.w) {
    const c = cajaDe(b.pista, b.clip);
    if (c) manijas = html`<div class="manijas" style=${{ left: c.x * k + "px", top: c.y * k + "px", width: c.ancho * k + "px", height: c.alto * k + "px" }}>
      <i class="esq" onPointerDown=${(e) => { e.stopPropagation(); bajar(e, "escalar"); }} onPointerMove=${mover} onPointerUp=${subir} onPointerCancel=${subir}></i></div>`;
  }
  const S = EP.SEGURA_916;
  return html`<div class="vista" ref=${cont}>
    <div class="lienzo" style=${{ width: tam.w + "px", height: tam.h + "px" }} onPointerDown=${(e) => bajar(e)} onPointerMove=${mover} onPointerUp=${subir} onPointerCancel=${subir}
      onDoubleClick=${() => Motor.alternar()}>
      <canvas ref=${cv} aria-label="Vista previa del video"></canvas>
      ${zonaSegura && p.formato.id === "9:16" && html`<div class="zona-segura" title="Lo que tapan los botones de TikTok"><div style=${{ left: 0, right: 0, top: 0, height: S.arriba * k + "px", background: "rgba(255,0,0,.08)" }}></div>
        <div style=${{ left: 0, right: 0, top: S.abajo * k + "px", bottom: 0, background: "rgba(255,0,0,.08)" }}></div><div style=${{ left: S.derecha * k + "px", right: 0, top: S.arriba * k + "px", height: (S.abajo - S.arriba) * k + "px", background: "rgba(255,0,0,.08)" }}></div></div>`}
      ${manijas}
    </div></div>`;
}

// ── Reproducción ──
function Transporte({ zonaSegura, setZonaSegura }) {
  const t = useTiempo(), rep = useTienda((e) => e.reproduciendo), p = useTienda((e) => e.proyecto);
  const D = Proyecto.duracion(p), fps = p.formato.fps || 30;
  return html`<div class="transporte">
    <${Boton} icono="inicio" tipo="fantasma" titulo="Al principio" onClick=${() => Motor.ir(0)} />
    <${Boton} icono="atras" tipo="fantasma" titulo="Un cuadro atrás" onClick=${() => Motor.ir(Math.round(t * fps - 1) / fps)} />
    <button type="button" class="play" aria-label=${rep ? "Pausa" : "Reproducir"} onClick=${() => Motor.alternar()}><${Icono} n=${rep ? "pausa" : "play"} /></button>
    <${Boton} icono="adelante" tipo="fantasma" titulo="Un cuadro adelante" onClick=${() => Motor.ir(Math.round(t * fps + 1) / fps)} />
    <div class="tiempo">${fmtTiempo(t, true)} <span>/ ${fmtTiempo(D, true)}</span></div>
    ${p.formato.id === "9:16" && html`<${Boton} chico tipo=${zonaSegura ? "activo" : "fantasma"} titulo="Ver lo que tapa TikTok" onClick=${() => setZonaSegura(!zonaSegura)}>Zona TikTok<//>`}
  </div>`;
}

// ── Línea de tiempo ──
const ALTOS = { video: 58, superpuesta: 40, grafico: 34, subtitulos: 32, audio: 42 };
const COLORES_PISTA = { video: "var(--pista-video)", superpuesta: "var(--pista-encima)", grafico: "var(--pista-graf)", subtitulos: "var(--pista-subs)", voz: "var(--pista-voz)", musica: "var(--pista-mus)", efectos: "var(--pista-efe)" };
const ICONO_PISTA = { video: "medios", superpuesta: "imagen", grafico: "capas", subtitulos: "subs", voz: "micro", musica: "musica", efectos: "voz" };
function rotuloClip(pista, c) {
  if (c.plantilla) { const pl = Plantillas.porId(c.plantilla), x = c.params || {}; const txt = x.texto || x.titulo || x.nombre || x.lugar || ""; return (pl ? pl.nombre : c.plantilla) + (txt ? " · " + String(txt).replace(/\*/g, "") : ""); }
  if (pista.tipo === "subtitulos") return c.texto;
  const d = Medios.datos(c.medio); return d ? d.nombre : "(medio que falta)";
}
function Onda({ medio, c, ancho, alto }) {
  if (!medio || !medio.picos || ancho < 4) return null;
  const pk = medio.picos, n = Math.max(2, Math.min(400, Math.floor(ancho / 3))), v = c.velocidad || 1, d = Proyecto.dur(c);
  let path = ""; const m = alto / 2;
  for (let i = 0; i < n; i++) { const s = c.desde + (i / n) * d * v, j = Math.floor(s * 40), a = (pk[j] || 0) * (m - 2); const x = ((i + 0.5) / n) * ancho; path += `M${x.toFixed(1)} ${(m - a).toFixed(1)}V${(m + a).toFixed(1)}`; }
  return html`<svg class="onda" viewBox=${`0 0 ${ancho} ${alto}`} preserveAspectRatio="none"><path d=${path} stroke="#fff" stroke-width="2" /></svg>`;
}
function Tira({ medio, c, ancho, alto, zoom }) {
  if (!medio || !medio.miniaturas || !medio.miniaturas.length) return null;
  const mins = medio.miniaturas, tw = Math.max(20, alto * ((medio.ancho || 16) / (medio.alto || 9))), n = Math.min(60, Math.ceil(ancho / tw)), v = c.velocidad || 1;
  return html`<div class="tira">${Array.from({ length: n }, (_, i) => {
    const s = c.desde + ((i * tw) / zoom) * v, idx = medio.tipo === "imagen" ? 0 : clamp(Math.floor((s / (medio.duracion || 1)) * mins.length), 0, mins.length - 1);
    return html`<img key=${i} src=${mins[idx]} style=${{ width: tw + "px" }} alt="" />`;
  })}</div>`;
}
function LineaDeTiempo() {
  const p = useTienda((e) => e.proyecto), sel = useTienda((e) => e.seleccion), zoom = useTienda((e) => e.zoom), rep = useTienda((e) => e.reproduciendo);
  useMedios();
  const t = useTiempo(), caja = useRef(null), [arr, setArr] = useState(null), arrRef = useRef(null);
  const chico = useAncho() < 900, f = chico ? 0.8 : 1, D = Proyecto.duracion(p);
  const ancho = Math.max((D + 6) * zoom, (caja.current ? caja.current.clientWidth : 800) - (chico ? 40 : 118));
  const pistas = p.pistas;
  const altos = pistas.map((k) => Math.round(ALTOS[k.tipo] * f));
  const setZoom = (z) => Tienda.set({ zoom: clamp(z, 6, 400) });
  const ajustar = () => { const w = (caja.current ? caja.current.clientWidth : 800) - (chico ? 40 : 118) - 30; setZoom(w / Math.max(1, D)); };
  // Zoom con Ctrl + rueda (y pellizco en el touchpad).
  useEffect(() => {
    const el = caja.current; if (!el) return;
    const rueda = (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(Tienda.get().zoom * Math.exp(-e.deltaY * 0.004)); };
    el.addEventListener("wheel", rueda, { passive: false }); return () => el.removeEventListener("wheel", rueda);
  }, []);
  // Que el cabezal no se escape de la pantalla mientras reproduce.
  useEffect(() => {
    const el = caja.current; if (!el || !rep) return;
    const x = t * zoom, cab = chico ? 40 : 96;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - cab - 60) el.scrollLeft = Math.max(0, x - 80);
  }, [Math.floor(t * 4), rep]);
  // Al abrir (o cuando llega el primer video) se ve todo el proyecto.
  useEffect(() => { if (caja.current) ajustar(); }, [p.id, D > 1.5]);
  const xATiempo = (e) => { const r = e.currentTarget.getBoundingClientRect(); return clamp((e.clientX - r.left) / zoom, 0, D); };
  // Puntos donde se pega lo que se arrastra (cabezal, bordes de otros clips).
  function imanes(cid) {
    const r = [0, Motor.tiempo()];
    for (const k of pistas) for (const c of k.clips) if (c.id !== cid) r.push(c.inicio, Proyecto.fin(c));
    return r;
  }
  const pegar = (v, lista) => { let mejor = v, d = 10 / zoom; for (const x of lista) if (Math.abs(x - v) < d) { d = Math.abs(x - v); mejor = x; } return mejor; };
  function bajarClip(e, pista, c, modo) {
    e.stopPropagation(); if (pista.bloqueada) return;
    if (Motor.reproduciendo) Motor.parar();
    e.currentTarget.setPointerCapture(e.pointerId);
    Acciones.elegir(c.id);
    arrRef.current = { cid: c.id, pista, c, modo, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, movido: false };
  }
  function moverClip(e) {
    const a = arrRef.current; if (!a) return;
    a.dx = e.clientX - a.x0; a.dy = e.clientY - a.y0;
    if (!a.movido && Math.abs(a.dx) + Math.abs(a.dy) < 5) return;
    a.movido = true; setArr({ ...a });
  }
  function subirClip(e) {
    const a = arrRef.current; arrRef.current = null; setArr(null);
    if (!a || !a.movido) return;
    const c = a.c, dt = a.dx / zoom, im = imanes(c.id);
    if (a.modo === "mover") {
      if (a.pista.tipo === "video") {
        const centro = c.inicio + dt + Proyecto.dur(c) / 2, otros = a.pista.clips.filter((x) => x.id !== c.id);
        const indice = otros.filter((x) => x.inicio + Proyecto.dur(x) / 2 < centro).length;
        Tienda.cambiar((q) => Proyecto.mover(q, c.id, { indice }), "mover");
      } else {
        let ini = Math.max(0, c.inicio + dt); const d = Proyecto.dur(c);
        const a1 = pegar(ini, im), a2 = pegar(ini + d, im) - d; ini = Math.abs(a1 - ini) <= Math.abs(a2 - ini) ? a1 : a2;
        // ¿A qué carril lo soltó? (solo entre pistas del mismo tipo)
        let y = 0, destino = null; const fila = pistas.indexOf(a.pista); let yOrig = 0;
        for (let i = 0; i < fila; i++) yOrig += altos[i];
        const yN = yOrig + altos[fila] / 2 + a.dy;
        for (let i = 0; i < pistas.length; i++) { if (yN >= y && yN < y + altos[i]) { destino = pistas[i]; break; } y += altos[i]; }
        const pistaId = destino && destino.tipo === a.pista.tipo && (destino.sub || null) === (a.pista.sub || null) ? destino.id : undefined;
        Tienda.cambiar((q) => Proyecto.mover(q, c.id, { inicio: Math.max(0, ini), pistaId }), "mover");
      }
    } else if (a.modo === "fin") {
      const tf = pegar(Proyecto.fin(c) + dt, im); Tienda.cambiar((q) => Proyecto.recortar(q, c.id, "fin", tf), "recortar");
    } else {
      const ti = pegar(c.inicio + dt, im); Tienda.cambiar((q) => Proyecto.recortar(q, c.id, "inicio", ti), "recortar");
    }
  }
  function bajarRegla(e) {
    e.currentTarget.setPointerCapture(e.pointerId); Motor.ir(xATiempo(e));
    const el = e.currentTarget, mov = (ev) => Motor.ir(clamp((ev.clientX - el.getBoundingClientRect().left) / zoom, 0, D));
    const fin = () => { el.removeEventListener("pointermove", mov); el.removeEventListener("pointerup", fin); };
    el.addEventListener("pointermove", mov); el.addEventListener("pointerup", fin);
  }
  // Marcas de la regla según el zoom.
  const paso = [0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => s * zoom >= 64) || 120, marcas = [];
  for (let s = 0; s <= ancho / zoom; s += paso) { marcas.push(html`<div key=${"m" + s} class="marca" style=${{ left: s * zoom + "px" }}>${paso < 1 ? fmtTiempo(s, true) : fmtTiempo(s)}</div>`); if (paso * zoom > 120) marcas.push(html`<div key=${"n" + s} class="marca menor" style=${{ left: (s + paso / 2) * zoom + "px" }}></div>`); }
  const selB = sel && Proyecto.buscarClip(p, sel);
  return html`<section class="linea" aria-label="Línea de tiempo">
    <div class="herr">
      <${Boton} chico icono="tijera" titulo="Cortar en el cabezal (S)" onClick=${Acciones.dividir}><span class="solo-pc">Cortar</span><//>
      <${Boton} chico icono="copiar" titulo="Duplicar (Ctrl+D)" desactivado=${!sel} onClick=${Acciones.duplicar}><span class="solo-pc">Duplicar</span><//>
      <${Boton} chico icono="basura" titulo="Borrar (Supr)" desactivado=${!sel} onClick=${Acciones.borrar}><span class="solo-pc">Borrar</span><//>
      ${sel && chico && html`<${Boton} chico tipo="amarillo" icono="ajustes" onClick=${() => Tienda.set({ inspector: true })}>Editar<//>`}
      <span class="sep"></span>
      <${Boton} chico icono="varita" titulo="Vestir el video con el canal" onClick=${Acciones.vestir}>Vestir<//>
      <span class="sep"></span>
      <${Boton} chico icono="lupaMenos" titulo="Alejar" onClick=${() => setZoom(zoom / 1.4)} />
      <${Boton} chico icono="lupaMas" titulo="Acercar" onClick=${() => setZoom(zoom * 1.4)} />
      <${Boton} chico titulo="Ver todo el video" onClick=${ajustar}>Todo<//>
      ${selB && html`<span class="nota solo-pc" style=${{ marginLeft: "auto", whiteSpace: "nowrap" }}>Elegido: ${rotuloClip(selB.pista, selB.clip)}</span>`}
    </div>
    <div class="pistas" ref=${caja}>
      <div class="cabs">
        <div class="regla-cab"></div>
        ${pistas.map((k, i) => html`<div key=${k.id} class="cab" style=${{ height: altos[i] + "px" }} title=${k.nombre}>
          <${Icono} n=${ICONO_PISTA[k.sub || k.tipo] || "capas"} t=${14} /><span>${k.nombre}</span>
          <button type="button" class=${k.oculta ? "si" : ""} title=${k.oculta ? "Mostrar pista" : "Ocultar pista"} onClick=${() => Tienda.cambiar((q) => Proyecto.cambiarPista(q, k.id, { oculta: !k.oculta }), "ocultar pista")}><${Icono} n=${k.oculta ? "ojoNo" : "ojo"} /></button>
          ${["video", "superpuesta", "audio"].includes(k.tipo) && html`<button type="button" class=${k.silenciada ? "si" : ""} title=${k.silenciada ? "Activar sonido" : "Silenciar pista"} onClick=${() => Tienda.cambiar((q) => Proyecto.cambiarPista(q, k.id, { silenciada: !k.silenciada }), "silenciar")}><${Icono} n=${k.silenciada ? "mudo" : "parlante"} /></button>`}
        </div>`)}
      </div>
      <div class="carriles" style=${{ width: ancho + "px" }}>
        <div class="regla" onPointerDown=${bajarRegla}>${marcas}</div>
        ${pistas.map((k, i) => html`<div key=${k.id} class=${"carril" + (k.oculta ? " oculta" : "")} style=${{ height: altos[i] + "px" }}
            onPointerDown=${(e) => { if (e.target === e.currentTarget) { Acciones.elegir(null); Motor.ir(xATiempo(e)); } }}>
          ${k.clips.map((c, ci) => {
            const a = arr && arr.cid === c.id ? arr : null; let x = c.inicio * zoom, w = Proyecto.dur(c) * zoom, tr = "";
            if (a) { if (a.modo === "mover") tr = `translate(${a.dx}px, ${a.dy}px)`; else if (a.modo === "fin") w = Math.max(8, w + a.dx); else { x += a.dx; w = Math.max(8, w - a.dx); } }
            const medio = c.medio ? Medios.datos(c.medio) : null, col = COLORES_PISTA[k.sub || k.tipo] || "var(--panel3)";
            return html`<div key=${c.id} class=${"clip" + (c.id === sel ? " sel" : "") + (a ? " arrastrando" : "")} style=${{ left: x + "px", width: Math.max(6, w) + "px", background: col, transform: tr }}
                onPointerDown=${(e) => bajarClip(e, k, c, "mover")} onPointerMove=${moverClip} onPointerUp=${subirClip} onPointerCancel=${subirClip} title=${rotuloClip(k, c)}>
              ${(k.tipo === "video" || k.tipo === "superpuesta") && html`<${Tira} medio=${medio} c=${c} ancho=${w} alto=${altos[i] - 6} zoom=${zoom} />`}
              ${k.tipo === "audio" && html`<${Onda} medio=${medio} c=${c} ancho=${w} alto=${altos[i] - 6} />`}
              <span class="rot">${rotuloClip(k, c)}</span>
              ${k.tipo === "video" && ci > 0 && c.transicion && c.transicion.tipo !== "ninguna" && html`<i class="trans" title=${"Transición: " + Compositor.TRANSICIONES[c.transicion.tipo]}></i>`}
              ${c.id === sel && w > 30 && html`<div class="borde ini" onPointerDown=${(e) => bajarClip(e, k, c, "inicio")} onPointerMove=${moverClip} onPointerUp=${subirClip}></div>
                <div class="borde fin" onPointerDown=${(e) => bajarClip(e, k, c, "fin")} onPointerMove=${moverClip} onPointerUp=${subirClip}></div>`}
            </div>`;
          })}
        </div>`)}
        <div class="cabezal" style=${{ left: t * zoom + "px" }}></div>
      </div>
    </div>
  </section>`;
}

// ── El editor completo ──
function Editor() {
  const panel = useTienda((e) => e.panel), sel = useTienda((e) => e.seleccion), exportando = useTienda((e) => e.exportando), inspector = useTienda((e) => e.inspector), chico = useAncho() < 900;
  const [zonaSegura, setZonaSegura] = useState(false), [soltando, setSoltando] = useState(false);
  // Atajos de teclado (no cuando se está escribiendo).
  useEffect(() => {
    const k = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || Tienda.get().exportando) return;
      const fps = (Tienda.get().proyecto || {}).formato?.fps || 30, ctrl = e.ctrlKey || e.metaKey;
      if (e.key === " ") { e.preventDefault(); Motor.alternar(); }
      else if (ctrl && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? Tienda.rehacer() : Tienda.deshacer(); }
      else if (ctrl && e.key.toLowerCase() === "y") { e.preventDefault(); Tienda.rehacer(); }
      else if (ctrl && e.key.toLowerCase() === "d") { e.preventDefault(); Acciones.duplicar(); }
      else if (e.key === "s" || e.key === "S") Acciones.dividir();
      else if (e.key === "Delete" || e.key === "Backspace") Acciones.borrar();
      else if (e.key === "ArrowLeft") { e.preventDefault(); Motor.ir(Motor.tiempo() - (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); Motor.ir(Motor.tiempo() + (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === "Home") Motor.ir(0);
      else if (e.key === "Escape") Tienda.set({ seleccion: null });
    };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, []);
  // Soltar archivos en cualquier parte del editor.
  const soltar = async (e) => {
    e.preventDefault(); setSoltando(false);
    const files = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (!files.length) return;
    const r = await importarArchivos(files);
    for (const m of r) Acciones.agregarMedio(m, m.tipo === "audio" ? "musica" : "video");
  };
  const conInsp = !!sel && (!chico || inspector), conPanel = !!panel;
  return html`<div class=${"editor" + (conInsp ? "" : " sin-insp") + (conPanel ? "" : " sin-panel")}
      onDragOver=${(e) => { e.preventDefault(); if (!soltando) setSoltando(true); }} onDragLeave=${(e) => { if (e.target === e.currentTarget) setSoltando(false); }} onDrop=${soltar}>
    <${Barra} />
    <${Riel} />
    ${conPanel && html`<${Panel} />`}
    <div class="centro"><${Vista} zonaSegura=${zonaSegura} /><${Transporte} zonaSegura=${zonaSegura} setZonaSegura=${setZonaSegura} /></div>
    ${conInsp && html`<${Inspector} />`}
    <${LineaDeTiempo} />
    ${exportando && html`<${DialogoExportar} />`}
    ${soltando && html`<div class="velo" style=${{ pointerEvents: "none" }}><div class="soltar encima" style=${{ background: "var(--panel)", padding: "40px" }}><${Icono} n="subir" t=${40} /><b>Soltá para agregar al video</b></div></div>`}
  </div>`;
}
