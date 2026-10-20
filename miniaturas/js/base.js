"use strict";
// ════════════════════════════════════════════════════════════════════════
// Miniaturas Papuchón — base: formatos, utilidades, dónde corre (web, app
// de Android o claude.ai) y el guardado en IndexedDB.
// ════════════════════════════════════════════════════════════════════════
const MP = {
  VERSION: "1.0.0",
  // Tamaños finales de cada red (lo que se exporta).
  FORMATOS: {
    youtube: { id: "youtube", nombre: "YouTube", detalle: "1280×720", ancho: 1280, alto: 720 },
    vertical: { id: "vertical", nombre: "Shorts · TikTok · Reels", detalle: "1080×1920", ancho: 1080, alto: 1920 },
    cuadrado: { id: "cuadrado", nombre: "Instagram", detalle: "1080×1080", ancho: 1080, alto: 1080 },
    retrato: { id: "retrato", nombre: "Instagram vertical", detalle: "1080×1350", ancho: 1080, alto: 1350 },
    portada: { id: "portada", nombre: "Portada de canal", detalle: "2560×1440", ancho: 2560, alto: 1440 },
  },
  MARCA: { nombre: "Noticias El Papuchón", rojo: "#E01B24", rojoOscuro: "#9E0E14", amarillo: "#FFC21A", naranja: "#FF7A00" },
};

function id(prefijo = "x") { return prefijo + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esperar = (ms, senal) => new Promise((ok, mal) => {
  const t = setTimeout(ok, ms);
  if (senal) senal.addEventListener("abort", () => { clearTimeout(t); mal(new DOMException("cancelado", "AbortError")); }, { once: true });
});
function copia(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
function leerLS(k, d) { try { const v = localStorage.getItem("mp:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function guardarLS(k, v) { try { localStorage.setItem("mp:" + k, JSON.stringify(v)); } catch (e) { /* modo privado */ } }
// Número pseudoazaroso repetible (para que el mismo pedido dé el mismo fondo local).
function azar(semilla) { let s = semilla >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const semillaNueva = () => Math.floor(Math.random() * 2147483647);
function cargarImagen(src) {
  return new Promise((ok, mal) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => mal(new Error("no se pudo abrir la imagen")); im.src = src; });
}
async function blobAImagen(blob) { const u = URL.createObjectURL(blob); try { const im = await cargarImagen(u); im._url = u; return im; } catch (e) { URL.revokeObjectURL(u); throw e; } }

const Plataforma = (() => {
  const artifact = !!(window.claude && typeof window.claude.use === "function");
  const android = typeof window.AndroidPapuchon === "object" && window.AndroidPapuchon !== null;
  let caps = {};
  function capacidad(n) {
    if (!artifact) return Promise.resolve(null);
    if (!caps[n]) caps[n] = Promise.race([window.claude.use(n).catch(() => null), esperar(10000).then(() => null)]);
    return caps[n];
  }
  // Adentro de la app de Android, guardar y compartir pasan por Java en pedazos base64.
  async function aAndroid(blob, nombre, compartir) {
    const A = window.AndroidPapuchon, h = A.abrir(nombre, blob.type || "image/jpeg");
    if (!h || h.startsWith("error")) throw new Error("No se pudo guardar (" + h + ")");
    const T = 786432;
    for (let o = 0; o < blob.size; o += T) {
      const u8 = new Uint8Array(await blob.slice(o, o + T).arrayBuffer()); let s = "";
      for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      if (!A.escribir(h, btoa(s))) throw new Error("No se pudo escribir el archivo");
    }
    const r = A.cerrar(h, !!compartir); if (r.startsWith("error")) throw new Error("No se pudo guardar (" + r + ")");
    return "guardado";
  }
  async function guardarArchivo(blob, nombre) {
    if (android) return aAndroid(blob, nombre, false);
    if (artifact) {
      const d = await capacidad("downloads");
      if (!d) throw new Error("Desde acá no se puede descargar. Abrí la app desde el link de githack.");
      await d.save({ filename: nombre, data: blob }); return "guardado";
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); return "descargado";
  }
  function puedeCompartir() {
    if (android) return !!window.AndroidPapuchon.puedeCompartir();
    try { return !artifact && !!navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.jpg", { type: "image/jpeg" })] }); } catch (e) { return false; }
  }
  async function compartir(blob, nombre) {
    if (android) return aAndroid(blob, nombre, true);
    await navigator.share({ files: [new File([blob], nombre, { type: blob.type })], title: nombre });
  }
  // Rezona solo anda desde la app: su API no acepta pedidos de páginas que no sean de rezona.ai,
  // y la llave vive en Java (nunca pasa por la página).
  const conRezona = android && typeof window.AndroidPapuchon.rezonaDisponible === "function";
  return {
    artifact, android, conRezona, capacidad, guardarArchivo, puedeCompartir, compartir,
    get rezona() { return conRezona && !!window.AndroidPapuchon.rezonaDisponible(); },
  };
})();

// ── Guardado: IndexedDB (las imágenes pesan; localStorage no alcanza). En memoria si no se puede.
const Almacen = (() => {
  const STORES = ["creaciones", "imagenes", "config"];
  const mem = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  let db = null;
  const abierto = new Promise((ok) => {
    try {
      const r = indexedDB.open("miniaturas-papuchon", 1);
      r.onupgradeneeded = () => { for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
      r.onsuccess = () => { db = r.result; ok(); }; r.onerror = r.onblocked = () => ok();
    } catch (e) { ok(); }
  });
  async function op(store, modo, fn) {
    await abierto; if (!db) return fn(null, mem[store]);
    return new Promise((ok, mal) => {
      const tx = db.transaction(store, modo), s = tx.objectStore(store); let res; const r = fn(s);
      if (r) r.onsuccess = () => { res = r.result; };
      tx.oncomplete = () => ok(res); tx.onerror = tx.onabort = () => mal(tx.error || new Error("No se pudo guardar"));
    });
  }
  const leer = (st, k) => op(st, "readonly", (s, m) => (s ? s.get(k) : m.get(k)));
  const poner = (st, k, v) => op(st, "readwrite", (s, m) => (s ? s.put(v, k) : m.set(k, v)));
  const sacar = (st, k) => op(st, "readwrite", (s, m) => (s ? s.delete(k) : m.delete(k)));
  const todos = (st) => op(st, "readonly", (s, m) => (s ? s.getAll() : [...m.values()]));
  return {
    guardarImagen: (k, blob) => poner("imagenes", k, blob), imagen: (k) => leer("imagenes", k), borrarImagen: (k) => sacar("imagenes", k),
    guardarCreacion: (c) => poner("creaciones", c.id, c), creacion: (k) => leer("creaciones", k), borrarCreacion: (k) => sacar("creaciones", k),
    creaciones: async () => (await todos("creaciones")).sort((a, b) => b.editada - a.editada),
    config: async (k, d) => { const v = await leer("config", k); return v === undefined ? d : v; }, guardarConfig: (k, v) => poner("config", k, v),
  };
})();
