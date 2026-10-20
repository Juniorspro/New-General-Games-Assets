"use strict";
// ════════════════════════════════════════════════════════════════════════
// Estudio Papuchón — base: constantes, la marca por defecto, utilidades y
// qué puede hacer el navegador en el que corre (githack, artifact o archivo).
// ════════════════════════════════════════════════════════════════════════
const EP = {
  VERSION: "1.0.0",
  FORMATOS: {
    "9:16": { id: "9:16", nombre: "Vertical", detalle: "TikTok, Reels, Shorts", ancho: 1080, alto: 1920 },
    "16:9": { id: "16:9", nombre: "Horizontal", detalle: "YouTube", ancho: 1920, alto: 1080 },
    "1:1": { id: "1:1", nombre: "Cuadrado", detalle: "Feed", ancho: 1080, alto: 1080 },
    "4:5": { id: "4:5", nombre: "Retrato", detalle: "Instagram", ancho: 1080, alto: 1350 },
  },
  FPS: 30,
  // Lo que tapa la app de TikTok en 9:16 (medido, memoria/video.md).
  SEGURA_916: { arriba: 180, abajo: 1570, derecha: 940, subsY: [1424, 1562] },
  MARCA: {
    nombre: "Noticias El Papuchón", usuario: "@elpapuchon", firma: "",
    rojo: "#E01B24", rojoOscuro: "#9E0E14", amarillo: "#FFC21A", naranja: "#FF7A00",
    blanco: "#FFFFFF", negro: "#0B0B0D", gris: "#1C1C21",
    logoActivo: "logo-papuchon",
  },
};

function id(prefijo = "x") { return prefijo + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function suave(a, b, t) { const x = clamp((t - a) / (b - a || 1e-6), 0, 1); return x * x * (3 - 2 * x); }
const facil = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
function rebote(t) { t = clamp(t, 0, 1); const c = 1.70158, d = c + 1; return 1 + d * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function fmtTiempo(s, decimas = false) {
  s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60;
  return m + ":" + (decimas ? r.toFixed(1).padStart(4, "0") : String(Math.floor(r)).padStart(2, "0"));
}
function leerLS(k, d) { try { const v = localStorage.getItem("ep:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function guardarLS(k, v) { try { localStorage.setItem("ep:" + k, JSON.stringify(v)); } catch (e) { /* modo privado: no pasa nada */ } }
function demorar(fn, ms) { let t = 0; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
function copia(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
// Color "marca.rojo" → el de la marca vigente; un #hex pasa igual.
function color(c, marca) { if (typeof c === "string" && c.startsWith("marca.")) return (marca || EP.MARCA)[c.slice(6)] || "#fff"; return c || "#fff"; }

const Plataforma = (() => {
  // Dentro de claude.ai la página tiene window.claude.use; ahí la CSP no deja bajar
  // modelos ni usar cámara o micrófono, y descargar pasa por la capacidad "downloads".
  const artifact = !!(window.claude && typeof window.claude.use === "function");
  const tactil = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  // Dentro de la app de Android (android/): guardar y compartir pasan por Java.
  const android = typeof window.AndroidPapuchon === "object" && window.AndroidPapuchon !== null;
  async function aAndroid(blob, nombre, compartir) {
    const A = window.AndroidPapuchon, h = A.abrir(nombre, blob.type || "application/octet-stream");
    if (!h || h.startsWith("error")) throw new Error("No se pudo guardar (" + h + ")");
    const T = 786432;   // múltiplo de 3: cada pedazo se pasa a base64 sin relleno en el medio
    for (let o = 0; o < blob.size; o += T) {
      const u8 = new Uint8Array(await blob.slice(o, o + T).arrayBuffer()); let s = "";
      for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
      if (!A.escribir(h, btoa(s))) throw new Error("No se pudo escribir el archivo");
    }
    const r = A.cerrar(h, !!compartir); if (r.startsWith("error")) throw new Error("No se pudo guardar (" + r + ")");
    return "guardado";
  }
  const caps = {};
  function capacidad(n) {
    if (!artifact) return Promise.resolve(null);
    if (!caps[n]) caps[n] = Promise.race([window.claude.use(n).catch(() => null), esperar(10000).then(() => null)]);
    return caps[n];
  }
  let ia = false;
  capacidad("sample").then((s) => { ia = !!s; });
  function puede(cosa) {
    switch (cosa) {
      case "camara": case "microfono": return !artifact && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      case "vozNeural": return !artifact && typeof WebAssembly === "object";
      case "compartir": if (android) return !!window.AndroidPapuchon.puedeCompartir(); try { return !artifact && !!navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.mp4", { type: "video/mp4" })] }); } catch (e) { return false; }
      case "ia": return ia;
      case "webcodecs": return typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";
      default: return true;
    }
  }
  async function guardarArchivo(blob, nombre) {
    if (android) return aAndroid(blob, nombre, false);
    if (artifact) {
      const d = await capacidad("downloads");
      if (!d) throw new Error("Desde acá no se puede descargar. Abrí el editor desde el link de githack.");
      await d.save({ filename: nombre, data: blob }); return "guardado";
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); return "descargado";
  }
  async function compartir(blob, nombre, texto) {
    if (android) return aAndroid(blob, nombre, true);
    const f = new File([blob], nombre, { type: blob.type });
    await navigator.share({ files: [f], title: nombre, text: texto || "" });
  }
  return { artifact, android, tactil, capacidad, puede, guardarArchivo, compartir };
})();
