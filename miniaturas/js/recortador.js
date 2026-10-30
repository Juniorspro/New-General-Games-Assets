"use strict";
// ════════════════════════════════════════════════════════════════════════
// Recortar: un recuadro sobre la foto que se mueve y se agranda desde las
// esquinas (con el dedo), con proporciones fijas o libre. Sirve para la foto
// de la persona y para el fondo. También: sacar una foto de un cuadro de video.
// Las ventanas se piden con `pedirModal(tipo, datos)` y devuelven una promesa.
// ════════════════════════════════════════════════════════════════════════
function pedirModal(tipo, datos = {}) {
  return new Promise((ok) => Estado.set({ modal: { tipo, datos, ok: (r) => { Estado.set({ modal: null }); ok(r); } } }));
}
const anchoDe = (m) => m.videoWidth || m.naturalWidth || m.width || 1, altoDe = (m) => m.videoHeight || m.naturalHeight || m.height || 1;
// El pedazo elegido, girado y espejado, en un canvas (máx. `max` px del lado mayor).
function recortarA(m, r, { giro = 0, espejo = false, max = 2400 } = {}) {
  const W = anchoDe(m), H = altoDe(m), sx = r.x * W, sy = r.y * H, sw = Math.max(1, r.w * W), sh = Math.max(1, r.h * H), rot = giro % 180 !== 0;
  const k = Math.min(1, max / Math.max(sw, sh)), ow = Math.round((rot ? sh : sw) * k), oh = Math.round((rot ? sw : sh) * k);
  const c = document.createElement("canvas"); c.width = ow; c.height = oh; const g = c.getContext("2d");
  g.translate(ow / 2, oh / 2); if (espejo) g.scale(-1, 1); if (giro) g.rotate((giro * Math.PI) / 180);
  const dw = rot ? oh : ow, dh = rot ? ow : oh; g.imageSmoothingQuality = "high"; g.drawImage(m, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  return c;
}
// El rectángulo más grande con esa proporción (ancho/alto en píxeles), centrado en `r`.
function conProporcion(r, prop, W, H) {
  if (!prop) return r;
  const pn = (prop * H) / W; let w = r.w, h = w / pn;
  if (h > 1) { h = 1; w = h * pn; } if (w > 1) { w = 1; h = w / pn; }
  if (h > r.h && r.h * pn <= 1) { h = Math.max(r.h, 0.05); w = h * pn; }
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return { x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h };
}
const PROPORCIONES = [{ v: 0, etiqueta: "Libre" }, { v: 9 / 16, etiqueta: "9:16" }, { v: 16 / 9, etiqueta: "16:9" }, { v: 1, etiqueta: "1:1" }, { v: 4 / 5, etiqueta: "4:5" }];

// El recuadro interactivo. `fuente` es una imagen, un video o un canvas ya cargado.
function Recortador({ fuente, rect, setRect, prop }) {
  const ref = useRef(null), caja = useRef(null), arr = useRef(null), [tam, setTam] = useState({ w: 0, h: 0 });
  const W = anchoDe(fuente), H = altoDe(fuente);
  useLayoutEffect(() => {
    const el = caja.current; if (!el) return;
    const m = () => { const aw = el.clientWidth - 12, ah = Math.min(innerHeight * 0.55, 560), k = Math.min(aw / W, ah / H); setTam({ w: Math.max(20, Math.round(W * k)), h: Math.max(20, Math.round(H * k)) }); };   // 12: el relleno del marco
    m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect();
  }, [W, H]);
  useEffect(() => {
    const cv = ref.current; if (!cv || !tam.w) return;
    const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = tam.w * dpr; cv.height = tam.h * dpr;
    const g = cv.getContext("2d"), cw = cv.width, ch = cv.height; g.drawImage(fuente, 0, 0, cw, ch);
    const x = rect.x * cw, y = rect.y * ch, w = rect.w * cw, h = rect.h * ch;
    g.fillStyle = "rgba(0,0,0,0.6)"; g.fillRect(0, 0, cw, y); g.fillRect(0, y + h, cw, ch - y - h); g.fillRect(0, y, x, h); g.fillRect(x + w, y, cw - x - w, h);
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = dpr;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x + (w * i) / 3, y); g.lineTo(x + (w * i) / 3, y + h); g.moveTo(x, y + (h * i) / 3); g.lineTo(x + w, y + (h * i) / 3); g.stroke(); }
    g.strokeStyle = "#FFC21A"; g.lineWidth = 2.5 * dpr; g.strokeRect(x, y, w, h);
    const L = 18 * dpr; g.lineWidth = 5 * dpr; g.strokeStyle = "#fff";
    for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { g.beginPath(); g.moveTo(px, py + sy * L); g.lineTo(px, py); g.lineTo(px + sx * L, py); g.stroke(); }
  });
  const punto = (ev) => { const r = ref.current.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height, ux: 26 / r.width, uy: 26 / r.height }; };
  function abajo(ev) {
    const q = punto(ev), esq = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]];
    const i = esq.findIndex(([ex, ey]) => Math.abs(q.x - ex) < q.ux && Math.abs(q.y - ey) < q.uy);
    const dentro = q.x > rect.x && q.x < rect.x + rect.w && q.y > rect.y && q.y < rect.y + rect.h;
    if (i < 0 && !dentro) return;
    ev.currentTarget.setPointerCapture(ev.pointerId); arr.current = { modo: i >= 0 ? i : "mover", q0: q, r0: { ...rect } };
  }
  function mover(ev) {
    const a = arr.current; if (!a) return;
    const q = punto(ev), dx = q.x - a.q0.x, dy = q.y - a.q0.y, r0 = a.r0, min = 0.06;
    if (a.modo === "mover") { setRect({ ...r0, x: clamp(r0.x + dx, 0, 1 - r0.w), y: clamp(r0.y + dy, 0, 1 - r0.h) }); return; }
    // Esquina: la opuesta queda fija.
    const fx = a.modo % 2 === 0 ? r0.x + r0.w : r0.x, fy = a.modo < 2 ? r0.y + r0.h : r0.y;
    let px = clamp((a.modo % 2 === 0 ? r0.x : r0.x + r0.w) + dx, 0, 1), py = clamp((a.modo < 2 ? r0.y : r0.y + r0.h) + dy, 0, 1);
    let w = Math.max(min, Math.abs(px - fx)), h = Math.max(min, Math.abs(py - fy));
    if (prop) { const pn = (prop * H) / W; if (w / h > pn) w = h * pn; else h = w / pn; }
    const x = a.modo % 2 === 0 ? fx - w : fx, y = a.modo < 2 ? fy - h : fy;
    if (x < -1e-6 || y < -1e-6 || x + w > 1 + 1e-6 || y + h > 1 + 1e-6) return;   // con proporción fija, no se sale de la foto
    setRect({ x, y, w, h });
  }
  return html`<div class="recortador" ref=${caja}><canvas ref=${ref} style=${{ width: tam.w + "px", height: tam.h + "px" }}
    onPointerDown=${abajo} onPointerMove=${mover} onPointerUp=${() => { arr.current = null; }} onPointerCancel=${() => { arr.current = null; }} aria-label="Recuadro para recortar: arrastrá las esquinas o el centro"></canvas></div>`;
}

// Ventana de recorte. Devuelve null (cancelado), "entera" o { blob, corte }, donde `corte`
// ({ rect, giro, espejo }) sirve para volver a abrirla como quedó. El giro y el espejo se
// ven en la misma foto, así el recuadro marca exactamente lo que va a salir.
const TODA = { x: 0, y: 0, w: 1, h: 1 };
function DialogoRecortar({ datos, ok }) {
  const c0 = datos.corte || {}, [fuente, setFuente] = useState(null), [prop, setProp] = useState(datos.proporcion || 0);
  const [giro, setGiro] = useState(c0.giro || 0), [espejo, setEspejo] = useState(!!c0.espejo), [rect, setRect] = useState(c0.rect || TODA);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try { const im = datos.blob ? await blobAImagen(datos.blob) : datos.imagen; if (vivo) setFuente(im); }
      catch (e) { aviso("No pude abrir esa imagen", "error", 4500); ok(null); }
    })();
    return () => { vivo = false; };
  }, []);
  const vista = useMemo(() => (fuente && (giro || espejo) ? recortarA(fuente, TODA, { giro, espejo }) : fuente), [fuente, giro, espejo]);
  const primera = useRef(true);
  useEffect(() => {   // al abrir respeta el corte anterior; al girar, vuelve a toda la foto
    if (!vista) return;
    setRect(conProporcion(primera.current ? rect : TODA, prop, anchoDe(vista), altoDe(vista))); primera.current = false;
  }, [vista]);
  const cambiarProp = (v) => { setProp(v); if (vista) setRect(conProporcion(v ? TODA : rect, v, anchoDe(vista), altoDe(vista))); };
  const restablecer = () => { setGiro(0); setEspejo(false); if (vista && !giro && !espejo) setRect(conProporcion(TODA, prop, anchoDe(vista), altoDe(vista))); };
  const listo = async () => {
    const c = recortarA(vista, rect);
    ok({ blob: await new Promise((r) => c.toBlob(r, datos.png ? "image/png" : "image/jpeg", 0.93)), corte: { rect, giro, espejo } });
  };
  return html`<div class="velo"><div class="dialogo" role="dialog" aria-modal="true" aria-label=${datos.titulo || "Recortar"}>
    <header><h2>${datos.titulo || "Recortar"}</h2><${Boton} icono="cerrar" tipo="fantasma" titulo="Cancelar" onClick=${() => ok(null)} /></header>
    <div class="cont">
      ${vista ? html`<${Recortador} fuente=${vista} rect=${rect} setRect=${setRect} prop=${prop} />` : html`<p class="nota centro"><span class="girando"></span> Abriendo…</p>`}
      <p class="nota centro">Arrastrá las esquinas para achicar y el medio para mover.</p>
      ${!datos.proporcion && html`<${Chips} etiqueta="Proporción" valor=${prop} opciones=${PROPORCIONES} alCambiar=${cambiarProp} />`}
      <div class="fila centro"><${Boton} chico icono="otra" onClick=${() => setGiro((giro + 90) % 360)}>Girar${giro ? ` (${giro}°)` : ""}<//><${Boton} chico icono="espejo" onClick=${() => setEspejo(!espejo)}>${espejo ? "Sin espejo" : "Espejo"}<//>
        <${Boton} chico tipo="fantasma" onClick=${restablecer}>Restablecer<//></div>
      <div class="fila centro">${datos.entera && html`<${Boton} grande onClick=${() => ok("entera")}>Usar entera<//>`}<${Boton} grande tipo="rojo" icono="check" desactivado=${!vista} onClick=${listo}>Listo<//></div>
    </div></div></div>`;
}

// Elegir un cuadro de un video: devuelve un Blob JPEG (o null).
function DialogoCuadro({ datos, ok }) {
  const ref = useRef(null), [dur, setDur] = useState(0), [t, setT] = useState(0), [listo, setListo] = useState(false), url = useMemo(() => URL.createObjectURL(datos.archivo), []);
  useEffect(() => () => URL.revokeObjectURL(url), []);
  const ir = (v) => { setT(v); const el = ref.current; if (el) el.currentTime = v; };
  const usar = async () => {
    const v = ref.current, c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0); ok(await new Promise((r) => c.toBlob(r, "image/jpeg", 0.93)));
  };
  return html`<div class="velo"><div class="dialogo" role="dialog" aria-modal="true" aria-label="Elegir un cuadro del video">
    <header><h2>Elegí el cuadro</h2><${Boton} icono="cerrar" tipo="fantasma" titulo="Cancelar" onClick=${() => ok(null)} /></header>
    <div class="cont">
      <video ref=${ref} class="cuadro-video" src=${url} muted playsInline preload="auto" onLoadedMetadata=${(e) => { setDur(e.target.duration || 0); ir(Math.min(1, (e.target.duration || 0) / 2)); }} onSeeked=${() => setListo(true)}
        onError=${() => { aviso("Este teléfono no puede abrir ese video. Probá con otro o con una captura.", "error", 6000); ok(null); }}></video>
      ${dur > 0 && html`<${Deslizador} id="cuadro-t" etiqueta="Momento del video" valor=${t} min=${0} max=${Math.max(0.1, dur - 0.05)} paso=${0.04} formato=${(v) => v.toFixed(1) + " s"} alCambiar=${ir} />`}
      <div class="fila centro"><${Boton} chico icono="atras" onClick=${() => ir(Math.max(0, t - 1 / 30))}>Cuadro antes<//><${Boton} chico onClick=${() => ir(Math.min(dur, t + 1 / 30))}>Cuadro después<//></div>
      <div class="fila centro"><${Boton} grande tipo="rojo" icono="check" desactivado=${!listo} onClick=${usar}>Usar este cuadro<//></div>
    </div></div></div>`;
}
function ModalActual() {
  const m = useEstado((e) => e.modal); if (!m) return null;
  const C = { recortar: DialogoRecortar, cuadro: DialogoCuadro }[m.tipo]; return C ? html`<${C} datos=${m.datos} ok=${m.ok} />` : null;
}
// Foto o video → (cuadro del video) → recorte. Devuelve { blob, original, corte } o null.
const esVideo = (f) => /^video\//.test(f.type) || /\.(mp4|mov|webm|m4v|3gp|mkv)$/i.test(f.name || "");
async function elegirYRecortar({ proporcion = 0, titulo = "Recortar", png = false } = {}) {
  const f = await elegirArchivo("image/*,video/*"); if (!f) return null;
  let original = f;
  if (esVideo(f)) { original = await pedirModal("cuadro", { archivo: f }); if (!original) return null; }
  const r = await pedirModal("recortar", { blob: original, proporcion, titulo, entera: true, png });
  if (!r) return null;
  return r === "entera" ? { blob: original, original, corte: null } : { blob: r.blob, original, corte: r.corte };
}
