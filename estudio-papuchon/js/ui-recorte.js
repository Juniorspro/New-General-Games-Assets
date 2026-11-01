"use strict";
// ════════════════════════════════════════════════════════════════════════
// Recortar un clip (video o foto), como en CapCut: un recuadro sobre el
// cuadro que se achica desde las esquinas y se mueve desde el medio, con
// proporciones fijas, girar y espejo. Queda en el clip como `recorte` (x, y,
// w, h de 0 a 1 sobre el archivo), `giro` y `espejo`; el compositor lo aplica
// al reproducir y al exportar. Y "Acortar": dónde empieza y termina el clip.
// ════════════════════════════════════════════════════════════════════════
const TODA = { x: 0, y: 0, w: 1, h: 1 };
const anchoDe = (m) => m.videoWidth || m.naturalWidth || m.width || 1, altoDe = (m) => m.videoHeight || m.naturalHeight || m.height || 1;
// El pedazo elegido, girado y espejado igual que en el compositor, en un canvas (máx. `max` px).
function recortarA(m, r, { giro = 0, espejo = false, max = 1280 } = {}) {
  const W = anchoDe(m), H = altoDe(m), sx = r.x * W, sy = r.y * H, sw = Math.max(1, r.w * W), sh = Math.max(1, r.h * H), rot = giro % 180 !== 0;
  const k = Math.min(1, max / Math.max(sw, sh)), ow = Math.max(1, Math.round((rot ? sh : sw) * k)), oh = Math.max(1, Math.round((rot ? sw : sh) * k));
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
// El recuadro se ve sobre la imagen ya girada; en el clip se guarda sobre el archivo.
function aVista(r, giro, espejo) {
  let { x, y, w, h } = r;
  if (giro === 90) [x, y, w, h] = [1 - y - h, x, h, w];
  else if (giro === 180) [x, y] = [1 - x - w, 1 - y - h];
  else if (giro === 270) [x, y, w, h] = [y, 1 - x - w, h, w];
  if (espejo) x = 1 - x - w;
  return { x, y, w, h };
}
function aArchivo(r, giro, espejo) {
  let { x, y, w, h } = r;
  if (espejo) x = 1 - x - w;
  if (giro === 90) [x, y, w, h] = [y, 1 - x - w, h, w];
  else if (giro === 180) [x, y] = [1 - x - w, 1 - y - h];
  else if (giro === 270) [x, y, w, h] = [1 - y - h, x, h, w];
  return { x, y, w, h };
}

// El recuadro interactivo. `fuente` es una imagen o un canvas ya cargado.
function Recortador({ fuente, rect, setRect, prop }) {
  const ref = useRef(null), caja = useRef(null), arr = useRef(null), [tam, setTam] = useState({ w: 0, h: 0 });
  const W = anchoDe(fuente), H = altoDe(fuente);
  useLayoutEffect(() => {
    const el = caja.current; if (!el) return;
    const m = () => { const aw = el.clientWidth - 12, ah = Math.min(innerHeight * 0.5, 520), k = Math.min(aw / W, ah / H); setTam({ w: Math.max(20, Math.round(W * k)), h: Math.max(20, Math.round(H * k)) }); };
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
    const px = clamp((a.modo % 2 === 0 ? r0.x : r0.x + r0.w) + dx, 0, 1), py = clamp((a.modo < 2 ? r0.y : r0.y + r0.h) + dy, 0, 1);
    let w = Math.max(min, Math.abs(px - fx)), h = Math.max(min, Math.abs(py - fy));
    if (prop) { const pn = (prop * H) / W; if (w / h > pn) w = h * pn; else h = w / pn; }
    const x = a.modo % 2 === 0 ? fx - w : fx, y = a.modo < 2 ? fy - h : fy;
    if (x < -1e-6 || y < -1e-6 || x + w > 1 + 1e-6 || y + h > 1 + 1e-6) return;   // con proporción fija, no se sale del cuadro
    setRect({ x, y, w, h });
  }
  return html`<div class="recortador" ref=${caja}><canvas ref=${ref} style=${{ width: tam.w + "px", height: tam.h + "px" }}
    onPointerDown=${abajo} onPointerMove=${mover} onPointerUp=${() => { arr.current = null; }} onPointerCancel=${() => { arr.current = null; }} aria-label="Recuadro para recortar: arrastrá las esquinas o el medio"></canvas></div>`;
}

// ── Ventana "Recortar" del clip elegido (Tienda.recortando = id del clip) ──
function DialogoRecorte() {
  const cid = useTienda((e) => e.recortando), p = useTienda((e) => e.proyecto), b = cid && p && Proyecto.buscarClip(p, cid);
  return b ? html`<${RecorteClip} key=${cid} p=${p} pista=${b.pista} c=${b.clip} />` : null;
}
function RecorteClip({ p, pista, c }) {
  const m = Medios.datos(c.medio) || {}, esVideo = m.tipo === "video", cerrar = () => Tienda.set({ recortando: null });
  const g0 = c.giro || 0, e0 = !!c.espejo;
  const [cuadro, setCuadro] = useState(null), [giro, setGiro] = useState(g0), [espejo, setEspejo] = useState(e0);
  const [rect, setRect] = useState(c.recorte ? aVista(c.recorte, g0, e0) : TODA), [prop, setProp] = useState(0);
  const ahora = Motor.tiempo(), [t, setT] = useState(ahora >= c.inicio && ahora < Proyecto.fin(c) ? Compositor.tiempoFuente(c, ahora) : c.desde + 0.05);
  const vid = useRef(null), buscando = useRef(false), pedido = useRef(null), pendiente = useRef(null);
  // El cuadro se copia a un canvas (máx. 1280 px): así el recuadro se dibuja liviano.
  const copiar = (fu) => recortarA(fu, TODA);
  const ir = (x) => {
    const v = vid.current; if (!v) return;
    if (buscando.current) { pedido.current = x; return; }
    buscando.current = true; v.currentTime = x;
  };
  useEffect(() => {
    if (!esVideo) {
      Medios.imagen(c.medio).then((im) => { if (im) setCuadro(copiar(im)); else { Tienda.aviso("No pude abrir la foto", "error"); cerrar(); } });
      return;
    }
    const u = Medios.url(c.medio); if (!u) { Tienda.aviso("El video todavía se está cargando: probá en un ratito", "info"); cerrar(); return; }
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.setAttribute("playsinline", ""); vid.current = v;
    v.onloadeddata = () => ir(t);
    v.onseeked = () => {
      setCuadro(copiar(v)); buscando.current = false;
      if (pedido.current != null) { const x = pedido.current; pedido.current = null; ir(x); }
    };
    v.onerror = () => { Tienda.aviso("No pude abrir el video para recortarlo", "error"); cerrar(); };
    v.src = u;
    return () => { v.onloadeddata = v.onseeked = v.onerror = null; v.removeAttribute("src"); v.load(); vid.current = null; };   // suelta el decodificador
  }, []);
  const vista = useMemo(() => (cuadro && (giro || espejo) ? recortarA(cuadro, TODA, { giro, espejo }) : cuadro), [cuadro, giro, espejo]);
  // Con cada vista nueva (otro cuadro o girado), el recuadro respeta la proporción elegida.
  useEffect(() => {
    if (!vista) return;
    const r = pendiente.current || rect; pendiente.current = null;
    setRect(conProporcion(r, prop, anchoDe(vista), altoDe(vista)));
  }, [vista]);
  // Girar o espejar mantiene elegido el mismo pedazo del archivo.
  const cambiarVista = (g, e) => { pendiente.current = aVista(aArchivo(rect, giro, espejo), g, e); setGiro(g); setEspejo(e); };
  const cambiarProp = (v) => { setProp(v); if (vista) setRect(conProporcion(v ? TODA : rect, v, anchoDe(vista), altoDe(vista))); };
  const restablecer = () => { setProp(0); if (giro || espejo) { pendiente.current = TODA; setGiro(0); setEspejo(false); } else setRect(TODA); };
  const listo = () => {
    const r = aArchivo(rect, giro, espejo), entera = r.w > 0.995 && r.h > 0.995, n4 = (x) => Math.round(clamp(x, 0, 1) * 10000) / 10000;
    Tienda.cambiar((q) => Proyecto.cambiarClip(q, c.id, { recorte: entera ? null : { x: n4(r.x), y: n4(r.y), w: n4(r.w), h: n4(r.h) }, giro, espejo }), "recortar");
    Tienda.aviso(entera && !giro && !espejo ? "Sin recorte" : "Recortado", "ok", 1400); cerrar();
  };
  const W = p.formato.ancho, H = p.formato.alto, cj = pista.tipo === "superpuesta" && c.caja;
  const opciones = [{ v: 0, etiqueta: "Libre" }, { v: W / H, etiqueta: "Como el video" }, ...(cj ? [{ v: cj.ancho / cj.alto, etiqueta: "Como el recuadro" }] : []),
    { v: 9 / 16, etiqueta: "9:16" }, { v: 16 / 9, etiqueta: "16:9" }, { v: 1, etiqueta: "1:1" }, { v: 4 / 5, etiqueta: "4:5" }]
    .filter((o, i, a) => a.findIndex((x) => Math.abs(x.v - o.v) < 1e-6) === i);
  return html`<${Dialogo} titulo="Recortar" alCerrar=${cerrar}>
    ${vista ? html`<${Recortador} fuente=${vista} rect=${rect} setRect=${setRect} prop=${prop} />` : html`<div class="nota" style=${{ textAlign: "center", padding: "40px 0" }}>Abriendo el cuadro…</div>`}
    <div class="nota">Arrastrá las esquinas para achicar y el medio para mover. Lo que quede afuera no se ve.</div>
    ${esVideo && html`<${Deslizador} id="recorte-t" etiqueta="Ver otro momento del clip" valor=${t} min=${c.desde} max=${Math.max(c.desde + 0.1, c.hasta - 0.04)} paso=${0.04} formato=${(v) => durTxt(Math.max(0, (v - c.desde) / (c.velocidad || 1)))} alCambiar=${(v) => { setT(v); ir(v); }} />`}
    <${Campo} etiqueta="Proporción"><${Opciones} valor=${(opciones.find((o) => Math.abs(o.v - prop) < 1e-6) || opciones[0]).v} opciones=${opciones} alCambiar=${cambiarProp} /><//>
    <div class="fila"><${Boton} chico icono="girar" onClick=${() => cambiarVista((giro + 90) % 360, espejo)}>Girar${giro ? ` (${giro}°)` : ""}<//>
      <${Boton} chico icono="espejo" activo=${espejo} onClick=${() => cambiarVista(giro, !espejo)}>Espejo<//>
      <${Boton} chico tipo="fantasma" onClick=${restablecer}>Restablecer<//></div>
    <div class="fila" style=${{ justifyContent: "flex-end" }}><${Boton} tipo="fantasma" onClick=${cerrar}>Cancelar<//><${Boton} tipo="primario" icono="check" desactivado=${!vista} onClick=${listo}>Listo<//></div>
  <//>`;
}

// ── Acortar: desde qué segundo del archivo arranca el clip y hasta cuál ──
function Acortar({ c }) {
  const v = c.velocidad || 1, largo = c.largo || c.hasta, min = 0.1 * v;
  const cortar = (lado) => {
    const t = Motor.tiempo();
    if (t <= c.inicio + 0.05 || t >= Proyecto.fin(c) - 0.05) { Tienda.aviso("Poné la raya blanca sobre este clip para cortar ahí", "info"); return; }
    const p = Tienda.get().proyecto, b = Proyecto.buscarClip(p, c.id), principal = b && b.pista.tipo === "video";
    Tienda.cambiar((q) => Proyecto.recortar(q, c.id, lado, t), lado === "inicio" ? "cortar el principio" : "cortar el final");
    if (lado === "inicio" && principal) Motor.ir(c.inicio);   // en la pista principal el clip queda en su lugar: se ve su nuevo comienzo
  };
  return html`<${Deslizador} id="acortar-ini" etiqueta="Empieza en" valor=${c.desde} min=${0} max=${Math.max(0, c.hasta - min)} paso=${0.05} formato=${durTxt} alCambiar=${(x) => Acciones.cambiar(c.id, { desde: Math.min(x, c.hasta - min) }, "acortar")} />
    <${Deslizador} id="acortar-fin" etiqueta="Termina en" valor=${c.hasta} min=${Math.min(largo, c.desde + min)} max=${largo} paso=${0.05} formato=${durTxt} alCambiar=${(x) => Acciones.cambiar(c.id, { hasta: Math.max(x, c.desde + min) }, "acortar")} />
    <div class="fila"><${Boton} chico icono="inicio" onClick=${() => cortar("inicio")}>Cortar el principio acá<//><${Boton} chico icono="fin" onClick=${() => cortar("fin")}>Cortar el final acá<//></div>
    <div class="nota">“Acá” es la raya blanca de la línea de tiempo. También podés arrastrar los bordes del clip.</div>`;
}
