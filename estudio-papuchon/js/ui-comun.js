"use strict";
// ════════════════════════════════════════════════════════════════════════
// Interfaz: piezas comunes (íconos, botones, deslizadores, colores…).
// React sin compilar: htm arma los elementos con plantillas de texto.
// ════════════════════════════════════════════════════════════════════════
const html = htm.bind(React.createElement);
const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

// Íconos de trazo, 24×24. "c:x,y,r" es un círculo y "r:x,y,w,h,rx" un rectángulo; lo demás, paths.
const ICONOS = {
  play: "M6 4l14 8-14 8z", pausa: "r:6,4,4,16,1|r:14,4,4,16,1",
  atras: "M15 18l-6-6 6-6", adelante: "M9 18l6-6-6-6", inicio: "M19 20L9 12l10-8z|M5 19V5", fin: "M5 4l10 8-10 8z|M19 5v14",
  deshacer: "M3 7v6h6|M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13", rehacer: "M21 7v6h-6|M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13",
  tijera: "c:6,6,3|c:6,18,3|M20 4L8.12 15.88|M14.47 14.48L20 20|M8.12 8.12L12 12",
  basura: "M3 6h18|M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6|M10 11v6|M14 11v6|M9 6V4h6v2",
  copiar: "r:9,9,13,13,2|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1", mas: "M12 5v14|M5 12h14",
  medios: "r:2,2,20,20,2|M7 2v20|M17 2v20|M2 12h20|M2 7h5|M2 17h5|M17 17h5|M17 7h5",
  imagen: "r:3,3,18,18,2|c:8.5,8.5,1.5|M21 15l-5-5L5 21", musica: "M9 18V5l12-2v13|c:6,18,3|c:18,16,3",
  texto: "M4 7V4h16v3|M9 20h6|M12 4v16", subs: "r:2,5,20,14,2|M7 15h4|M15 15h2|M7 11h2|M13 11h4",
  micro: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z|M19 10v2a7 7 0 0 1-14 0v-2|M12 19v4|M8 23h8",
  voz: "M3 10v4|M7 6v12|M11 3v18|M15 7v10|M19 10v4", capas: "M12 2L2 7l10 5 10-5-10-5z|M2 17l10 5 10-5|M2 12l10 5 10-5",
  ajustes: "M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6",
  exportar: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3", subir: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12",
  compartir: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8|M16 6l-4-4-4 4|M12 2v13", camara: "M23 7l-7 5 7 5V7z|r:1,5,15,14,2",
  sol: "c:12,12,5|M12 1v2|M12 21v2|M4.22 4.22l1.42 1.42|M18.36 18.36l1.42 1.42|M1 12h2|M21 12h2|M4.22 19.78l1.42-1.42|M18.36 5.64l1.42-1.42",
  ojo: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z|c:12,12,3", ojoNo: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94|M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19|M1 1l22 22",
  parlante: "M11 5L6 9H2v6h4l5 4V5z|M19.07 4.93a10 10 0 0 1 0 14.14|M15.54 8.46a5 5 0 0 1 0 7.07", mudo: "M11 5L6 9H2v6h4l5 4V5z|M23 9l-6 6|M17 9l6 6",
  cerrar: "M18 6L6 18|M6 6l12 12", check: "M20 6L9 17l-5-5", lupaMas: "c:11,11,8|M21 21l-4.35-4.35|M11 8v6|M8 11h6", lupaMenos: "c:11,11,8|M21 21l-4.35-4.35|M8 11h6",
  casa: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M9 22V12h6v10", varita: "M15 4V2|M15 16v-2|M8 9h2|M20 9h2|M17.8 11.8L19 13|M17.8 6.2L19 5|M3 21l9-9|M12.2 6.2L11 5",
  girar: "M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0 1 14.85-3.36L23 10|M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  izq: "M19 12H5|M12 19l-7-7 7-7", der: "M5 12h14|M12 5l7 7-7 7", foto: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z|c:12,13,4",
  archivo: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6", centro: "c:12,12,10|c:12,12,3", reloj: "c:12,12,10|M12 6v6l4 2",
};
function Icono({ n, t }) {
  const partes = (ICONOS[n] || "").split("|").map((d, i) => {
    if (d.startsWith("c:")) { const [cx, cy, r] = d.slice(2).split(","); return html`<circle key=${i} cx=${cx} cy=${cy} r=${r} />`; }
    if (d.startsWith("r:")) { const [x, y, w, h, rx] = d.slice(2).split(","); return html`<rect key=${i} x=${x} y=${y} width=${w} height=${h} rx=${rx} />`; }
    return html`<path key=${i} d=${d} />`;
  });
  return html`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" style=${t ? { width: t, height: t } : null}>${partes}</svg>`;
}
function Boton({ icono, children, onClick, tipo = "", chico, grande, titulo, desactivado, activo, id: elId }) {
  const cls = ["btn", tipo, chico && "chico", grande && "grande", activo && "activo", icono && !children && "icono"].filter(Boolean).join(" ");
  return html`<button id=${elId} type="button" class=${cls} onClick=${onClick} title=${titulo} aria-label=${titulo} disabled=${desactivado}>${icono && html`<${Icono} n=${icono} />`}${children}</button>`;
}
function Campo({ etiqueta, children, para }) { return html`<div class="campo">${etiqueta && html`<label for=${para}>${etiqueta}</label>`}${children}</div>`; }
function Deslizador({ etiqueta, valor, min, max, paso = 0.01, alCambiar, alSoltar, formato = (v) => v, id: elId }) {
  return html`<div class="desliz"><label for=${elId}>${etiqueta}</label><output>${formato(valor)}</output>
    <input id=${elId} type="range" min=${min} max=${max} step=${paso} value=${valor} onInput=${(e) => alCambiar(+e.target.value)} onChange=${(e) => alSoltar && alSoltar(+e.target.value)} /></div>`;
}
function Opciones({ valor, opciones, alCambiar }) {
  return html`<div class="segmentos" role="radiogroup">${opciones.map((o) => html`<button key=${o.v} type="button" role="radio" aria-checked=${o.v === valor} class=${o.v === valor ? "si" : ""} onClick=${() => alCambiar(o.v)}>${o.etiqueta}</button>`)}</div>`;
}
const deObjeto = (o) => Object.entries(o).map(([v, x]) => ({ v, etiqueta: typeof x === "string" ? x : x.nombre }));
function Color({ valor, alCambiar }) {
  const marca = useTienda((e) => e.marca);
  const propios = [["marca.rojo", "Rojo"], ["marca.rojoOscuro", "Bordó"], ["marca.amarillo", "Amarillo"], ["marca.naranja", "Naranja"], ["#FFFFFF", "Blanco"], ["#0B0B0D", "Negro"], ["#1F6FEB", "Azul"], ["#16A34A", "Verde"]];
  const real = color(valor, marca);
  return html`<div class="colores">${propios.map(([v, n]) => html`<button key=${v} type="button" title=${n} aria-label=${n} class=${valor === v ? "si" : ""} style=${{ background: color(v, marca) }} onClick=${() => alCambiar(v)}></button>`)}
    <input type="color" aria-label="Otro color" value=${/^#[0-9a-f]{6}$/i.test(real) ? real : "#ffffff"} onInput=${(e) => alCambiar(e.target.value.toUpperCase())} /></div>`;
}
function Chequeo({ etiqueta, valor, alCambiar, id: elId }) {
  return html`<label class="chequeo" for=${elId}><input id=${elId} type="checkbox" checked=${!!valor} onChange=${(e) => alCambiar(e.target.checked)} />${etiqueta}</label>`;
}
function Avance({ f }) { return html`<div class="barra-avance" role="progressbar" aria-valuenow=${Math.round(f * 100)}><i style=${{ width: (clamp(f, 0, 1) * 100).toFixed(1) + "%" }}></i></div>`; }
function Avisos() {
  const avisos = useTienda((e) => e.avisos);
  return html`<div class="avisos" aria-live="polite">${avisos.map((a) => html`<div key=${a.id} class=${"aviso " + a.tipo}>${a.texto}</div>`)}</div>`;
}
function Dialogo({ titulo, alCerrar, children }) {
  useEffect(() => { const k = (e) => e.key === "Escape" && alCerrar && alCerrar(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [alCerrar]);
  return html`<div class="velo" onPointerDown=${(e) => e.target === e.currentTarget && alCerrar && alCerrar()}>
    <div class="dialogo" role="dialog" aria-modal="true" aria-label=${titulo}><header><h2>${titulo}</h2>${alCerrar && html`<${Boton} icono="cerrar" tipo="fantasma" titulo="Cerrar" onClick=${alCerrar} />`}</header><div class="cont">${children}</div></div></div>`;
}
// Botón de borrar que pide un segundo toque (en el visor no hay confirm()).
function BorrarSeguro({ onClick, titulo = "Borrar", chico = true }) {
  const [armado, setArmado] = useState(false);
  useEffect(() => { if (!armado) return; const t = setTimeout(() => setArmado(false), 2500); return () => clearTimeout(t); }, [armado]);
  return armado ? html`<${Boton} chico=${chico} tipo="primario" onClick=${() => { setArmado(false); onClick(); }}>¿Seguro?<//>` : html`<${Boton} chico=${chico} icono="basura" tipo="fantasma peligro" titulo=${titulo} onClick=${() => setArmado(true)} />`;
}
// Los medios importados (se re-renderiza cuando termina una miniatura o una importación).
function useMedios() {
  const [, setN] = useState(0);
  useEffect(() => Medios.alCambiar(() => setN((n) => n + 1)), []);
  useTienda((e) => e.versionMedios);
  return Medios.todos().sort((a, b) => b.creado - a.creado);
}
function useAncho() {
  const [w, setW] = useState(innerWidth);
  useEffect(() => { const f = () => setW(innerWidth); addEventListener("resize", f); return () => removeEventListener("resize", f); }, []);
  return w;
}
const esCel = () => innerWidth < 900;
// Abre el selector de archivos del sistema.
function elegirArchivos(accept, multiple = true) {
  return new Promise((ok) => {
    const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = multiple; i.style.display = "none";
    i.onchange = () => { ok([...i.files]); i.remove(); }; document.body.appendChild(i); i.click();
    addEventListener("focus", () => setTimeout(() => { if (!i.files || !i.files.length) { ok([]); i.remove(); } }, 800), { once: true });
  });
}
async function importarArchivos(files) {
  const r = [];
  for (const f of files) {
    try { Tienda.aviso(`Importando "${f.name}"…`, "info", 1800); r.push(await Medios.importar(f)); }
    catch (e) { Tienda.aviso(e.message, "error", 6000); }
  }
  if (r.length) { Tienda.set({ versionMedios: (Tienda.get().versionMedios || 0) + 1 }); Tienda.aviso(r.length === 1 ? `Listo: ${r[0].nombre}` : `Importados ${r.length} archivos`, "ok"); }
  return r;
}
const durTxt = (s) => (s >= 60 ? fmtTiempo(s) : s.toFixed(s < 10 ? 1 : 0) + " s");
const pesoTxt = (b) => (b > 1e9 ? (b / 1e9).toFixed(2) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");
function haceTxt(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "recién"; if (s < 3600) return `hace ${Math.floor(s / 60)} min`; if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(ms).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}
