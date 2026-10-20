"use strict";
// ════════════════════════════════════════════════════════════════════════
// Interfaz: estado de la app, íconos y piezas comunes (React + htm, sin compilar).
// ════════════════════════════════════════════════════════════════════════
const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useLayoutEffect, useMemo } = React;

// ── Estado: un objeto, suscripciones, y un hook que elige un pedazo ──
const Estado = (() => {
  let e = {
    pantalla: "crear", avisos: [],
    pedido: leerLS("pedido", { es: "", texto: "", estilo: "auto", diseno: "auto", formato: "youtube", cantidad: 2, logo: true }),
    persona: null,            // { id, url, recuadro, procesando }
    lote: [],                 // ids de las creaciones del último "Crear"
    tareas: {},               // id de creación → { estado, texto, motor, provisional }
    creaciones: {},           // id → creación (las abiertas en esta sesión)
    editando: null, seleccion: null, version: 0,
  };
  const subs = new Set();
  return {
    get: () => e,
    set(p) { e = { ...e, ...(typeof p === "function" ? p(e) : p) }; for (const f of subs) f(); },
    suscribir: (f) => (subs.add(f), () => subs.delete(f)),
  };
})();
function useEstado(sel) { return React.useSyncExternalStore(Estado.suscribir, () => sel(Estado.get())); }
let nAviso = 0;
function aviso(texto, tipo = "info", ms = 3200) {
  const a = { id: ++nAviso, texto, tipo }; Estado.set((e) => ({ avisos: [...e.avisos.slice(-2), a] }));
  setTimeout(() => Estado.set((e) => ({ avisos: e.avisos.filter((x) => x.id !== a.id) })), ms);
}

// ── Imágenes guardadas (blob en IndexedDB → <img> en memoria) ──
const Imagenes = (() => {
  const mapa = new Map(), cargando = new Map();
  async function poner(blob) { const k = id("i"); await Almacen.guardarImagen(k, blob); mapa.set(k, await blobAImagen(blob)); return k; }
  function traer(k) {
    if (!k || mapa.has(k) || cargando.has(k)) return cargando.get(k) || Promise.resolve(mapa.get(k));
    const p = Almacen.imagen(k).then((b) => (b ? blobAImagen(b) : null)).then((im) => { if (im) mapa.set(k, im); cargando.delete(k); Estado.set((e) => ({ version: e.version + 1 })); return im; });
    cargando.set(k, p); return p;
  }
  async function borrar(k) { const im = mapa.get(k); if (im && im._url) URL.revokeObjectURL(im._url); mapa.delete(k); await Almacen.borrarImagen(k).catch(() => {}); }
  return { mapa, poner, traer, borrar };
})();
let logoImg = null; (() => { const im = new Image(); im.onload = () => { logoImg = im; Estado.set((e) => ({ version: e.version + 1 })); }; im.src = LOGO_B64; })();
const recursos = () => ({ imgs: Imagenes.mapa, logo: logoImg });

// ── Íconos de trazo (24×24): "c:x,y,r" círculo, "r:x,y,w,h,rx" rectángulo, lo demás paths ──
const ICONOS = {
  mas: "M12 5v14|M5 12h14", varita: "M15 4V2|M15 16v-2|M8 9h2|M20 9h2|M17.8 11.8L19 13|M17.8 6.2L19 5|M3 21l9-9|M12.2 6.2L11 5",
  foto: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z|c:12,13,4", imagen: "r:3,3,18,18,2|c:8.5,8.5,1.5|M21 15l-5-5L5 21",
  bajar: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3", compartir: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8|M16 6l-4-4-4 4|M12 2v13",
  lapiz: "M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z", basura: "M3 6h18|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6|M9 6V4h6v2",
  atras: "M15 18l-6-6 6-6", cerrar: "M18 6L6 18|M6 6l12 12", check: "M20 6L9 17l-5-5", otra: "M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0 1 14.85-3.36L23 10|M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  texto: "M4 7V4h16v3|M9 20h6|M12 4v16", persona: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|c:12,7,4", capas: "M12 2L2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5",
  rayo: "M13 2L3 14h9l-1 8 10-12h-9l1-8z", grilla: "r:3,3,7,7,1|r:14,3,7,7,1|r:14,14,7,7,1|r:3,14,7,7,1", estrella: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z",
  ajustes: "M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6", espejo: "M12 3v18|M16 7l4 5-4 5z|M8 7l-4 5 4 5z", info: "c:12,12,10|M12 16v-4|M12 8h.01",
};
function Icono({ n, t }) {
  const partes = (ICONOS[n] || "").split("|").map((d, i) => {
    if (d.startsWith("c:")) { const [cx, cy, r] = d.slice(2).split(","); return html`<circle key=${i} cx=${cx} cy=${cy} r=${r} />`; }
    if (d.startsWith("r:")) { const [x, y, w, h, rx] = d.slice(2).split(","); return html`<rect key=${i} x=${x} y=${y} width=${w} height=${h} rx=${rx} />`; }
    return html`<path key=${i} d=${d} />`;
  });
  return html`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style=${t ? { width: t, height: t } : null}>${partes}</svg>`;
}
function Boton({ icono, children, onClick, tipo = "", chico, grande, titulo, desactivado, id: elId }) {
  const cls = ["btn", tipo, chico && "chico", grande && "grande", icono && !children && "solo-icono"].filter(Boolean).join(" ");
  return html`<button id=${elId} type="button" class=${cls} onClick=${onClick} title=${titulo} aria-label=${titulo || undefined} disabled=${desactivado}>${icono && html`<${Icono} n=${icono} />`}${children}</button>`;
}
function Chips({ valor, opciones, alCambiar, etiqueta }) {
  return html`<div class="chips" role="radiogroup" aria-label=${etiqueta}>${opciones.map((o) => html`<button key=${o.v} type="button" role="radio" aria-checked=${o.v === valor} class=${"chip" + (o.v === valor ? " si" : "")} onClick=${() => alCambiar(o.v)}>${o.muestra}${o.etiqueta}</button>`)}</div>`;
}
function Deslizador({ etiqueta, valor, min, max, paso = 0.01, alCambiar, formato = (v) => v, id: elId }) {
  return html`<div class="desliz"><label for=${elId}>${etiqueta}</label><output>${formato(valor)}</output>
    <input id=${elId} type="range" min=${min} max=${max} step=${paso} value=${valor} onInput=${(e) => alCambiar(+e.target.value)} /></div>`;
}
const COLORES = ["#FFFFFF", "#FFC21A", "#E01B24", "#FF7A00", "#2BD47D", "#1F8BFF", "#B44CFF", "#0B0B0D"];
function Colores({ valor, alCambiar, conNada }) {
  return html`<div class="colores">${conNada && html`<button type="button" class=${"nada" + (!valor ? " si" : "")} title="Sin color" aria-label="Sin color" onClick=${() => alCambiar("")}>∅</button>`}
    ${COLORES.map((c) => html`<button key=${c} type="button" title=${c} aria-label=${c} class=${valor === c ? "si" : ""} style=${{ background: c }} onClick=${() => alCambiar(c)}></button>`)}
    <input type="color" aria-label="Otro color" value=${/^#[0-9a-f]{6}$/i.test(valor || "") ? valor : "#ffffff"} onInput=${(e) => alCambiar(e.target.value.toUpperCase())} /></div>`;
}
function Avisos() { const a = useEstado((e) => e.avisos); return html`<div class="avisos" aria-live="polite">${a.map((x) => html`<div key=${x.id} class=${"aviso " + x.tipo}>${x.texto}</div>`)}</div>`; }
function elegirArchivo(accept) {
  return new Promise((ok) => {
    const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.style.display = "none";
    i.onchange = () => { ok(i.files[0] || null); i.remove(); }; document.body.appendChild(i); i.click();
  });
}
function BorrarSeguro({ onClick, titulo = "Borrar" }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 2500); return () => clearTimeout(t); }, [armado]);
  return armado ? html`<${Boton} chico tipo="rojo" onClick=${() => { setArmado(false); onClick(); }}>¿Seguro?<//>` : html`<${Boton} chico icono="basura" tipo="fantasma" titulo=${titulo} onClick=${() => setArmado(true)} />`;
}
// Dibuja una creación en un canvas del tamaño del recuadro (sirve para tarjetas y para el editor).
function Lienzo({ c, marcar, alTocar, refCajas, clase = "" }) {
  const ref = useRef(null), caja = useRef(null), [tam, setTam] = useState(0);
  const version = useEstado((e) => e.version), f = MP.FORMATOS[c.formato] || MP.FORMATOS.youtube;
  useLayoutEffect(() => { const el = caja.current; if (!el) return; const m = () => setTam(el.clientWidth); m(); const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect(); }, []);
  useEffect(() => { if (c.fondo.img) Imagenes.traer(c.fondo.img); if (c.persona && c.persona.img) Imagenes.traer(c.persona.img); }, [c.fondo.img, c.persona && c.persona.img]);
  useEffect(() => {
    const cv = ref.current; if (!cv || !tam) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(tam * dpr), H = Math.round((W * f.alto) / f.ancho);
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    Diseno.listo().then(() => { const cajas = Diseno.dibujar(cv.getContext("2d"), c, cv.width, cv.height, recursos(), { marcar }); if (refCajas) refCajas.current = { cajas, k: cv.width / cv.clientWidth }; });
  });
  return html`<div class=${"lienzo " + clase} ref=${caja} style=${{ aspectRatio: `${f.ancho} / ${f.alto}` }}>
    <canvas ref=${ref} onPointerDown=${alTocar && ((ev) => alTocar(ev, "abajo"))} onPointerMove=${alTocar && ((ev) => alTocar(ev, "mover"))} onPointerUp=${alTocar && ((ev) => alTocar(ev, "arriba"))} onPointerCancel=${alTocar && ((ev) => alTocar(ev, "arriba"))}></canvas></div>`;
}
const nombreArchivo = (c, ext) => "miniatura-" + ((c.textos[0] && c.textos[0].texto) || c.pedido.es || "papuchon").replace(/\*/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) + "." + ext;
// Exporta a JPG en el tamaño final de la red (YouTube pide menos de 2 MB).
async function exportar(c) {
  const f = MP.FORMATOS[c.formato] || MP.FORMATOS.youtube, cv = document.createElement("canvas"); cv.width = f.ancho; cv.height = f.alto;
  await Diseno.listo(); await Promise.all([c.fondo.img && Imagenes.traer(c.fondo.img), c.persona && c.persona.img && Imagenes.traer(c.persona.img)]);
  Diseno.dibujar(cv.getContext("2d"), c, f.ancho, f.alto, recursos());
  let q = 0.92, blob;
  do { blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", q)); q -= 0.06; } while (blob.size > 1.95e6 && q > 0.5);
  return blob;
}
async function guardarComo(c) {
  try { const b = await exportar(c), como = await Plataforma.guardarArchivo(b, nombreArchivo(c, "jpg")); aviso(como === "guardado" ? "Miniatura guardada" : "Descargando la miniatura", "ok"); }
  catch (e) { aviso(e.message, "error", 6000); }
}
async function compartirComo(c) {
  try { await Plataforma.compartir(await exportar(c), nombreArchivo(c, "jpg")); } catch (e) { if (e.name !== "AbortError") aviso("No se pudo compartir: " + e.message, "error"); }
}
