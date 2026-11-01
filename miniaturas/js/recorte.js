"use strict";
// ════════════════════════════════════════════════════════════════════════
// Recorte: saca a la persona de una foto (tu cara, la del invitado) para
// pegarla encima del fondo con borde blanco, como las miniaturas de verdad.
// Es la foto real, no una cara inventada por la IA. Corre en el teléfono
// (MediaPipe, modelo de 16 MB que se baja una vez); si no se puede, la foto
// va entera en un recuadro.
// ════════════════════════════════════════════════════════════════════════
const Recorte = (() => {
  const VER = "0.10.14", BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
  const MODELOS = [
    { url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite", fondoEnCero: true },
    { url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite", fondoEnCero: false },
  ];
  let seg = null, cargando = null;
  function cargar() {
    if (cargando) return cargando;
    cargando = (async () => {
      const v = await import(BASE + "/vision_bundle.mjs");
      const fs = await v.FilesetResolver.forVisionTasks(BASE + "/wasm");
      for (const m of MODELOS) {
        try {
          const s = await v.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: m.url, delegate: "CPU" }, runningMode: "IMAGE", outputCategoryMask: false, outputConfidenceMasks: true });
          seg = { s, fondoEnCero: m.fondoEnCero }; return seg;
        } catch (e) { console.warn("recorte", m.url, e); }
      }
      throw new Error("no se pudo cargar el recortador");
    })().catch((e) => { cargando = null; throw e; });
    return cargando;
  }
  // Separa las manchas y se queda con las que tienen cara (una persona de espaldas: la más grande).
  // Así no se cuelan autos, fuego o carteles que el modelo confunde con ropa.
  function soloPersonas(d, cara, w, h) {
    const et = new Int32Array(w * h), tam = [0], caras = [0]; let n = 0;
    for (let i = 0; i < w * h; i++) {
      if (d[i] < 0.5 || et[i]) continue;
      n++; let c = 0, f = 0; const pila = [i]; et[i] = n;
      while (pila.length) { const j = pila.pop(); c++; if (cara && cara[j] > 0.5) f++; const x = j % w, y = (j / w) | 0;
        for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (k >= 0 && !et[k] && d[k] >= 0.5) { et[k] = n; pila.push(k); } }
      tam.push(c); caras.push(f);
    }
    if (n < 2) return;
    const max = Math.max(...tam), conCara = tam.map((t, i) => i > 0 && caras[i] > Math.max(12, t * 0.01));
    const queda = conCara.some(Boolean) ? conCara : tam.map((t, i) => i > 0 && t === max);
    for (let i = 0; i < w * h; i++) if (et[i] && !queda[et[i]]) d[i] = 0;
    // Bordes suaves que quedaron lejos de una mancha elegida: afuera.
    for (let i = 0; i < w * h; i++) if (!et[i] && d[i] > 0.15) { const x = i % w, y = (i / w) | 0; let cerca = false; for (let dy = -2; dy <= 2 && !cerca; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy, k = yy * w + xx; if (xx >= 0 && yy >= 0 && xx < w && yy < h && et[k] && queda[et[k]]) { cerca = true; break; } } if (!cerca) d[i] = 0; }
  }
  const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // Devuelve { blob: PNG con transparencia, recortado a la persona } o null si no encontró a nadie.
  async function recortar(blob) {
    const bm = await createImageBitmap(blob), k = Math.min(1, 1400 / Math.max(bm.width, bm.height));
    const W = Math.round(bm.width * k), H = Math.round(bm.height * k);
    const foto = document.createElement("canvas"); foto.width = W; foto.height = H; foto.getContext("2d").drawImage(bm, 0, 0, W, H);
    const { s, fondoEnCero } = await cargar();
    // Probabilidad de "persona". En el modelo multiclase se suman pelo, cuerpo, cara y ropa
    // (las máscaras 1 a 4): la 5 ("otros/accesorios") a veces se lleva autos o carteles del fondo.
    let datos = null, cara = null, mw = 0, mh = 0;
    s.segment(foto, (r) => {
      const ms = r.confidenceMasks, m0 = ms[0]; mw = m0.width; mh = m0.height;
      if (fondoEnCero && ms.length >= 5) { datos = new Float32Array(mw * mh); for (let k = 1; k <= 4; k++) { const a = ms[k].getAsFloat32Array(); for (let i = 0; i < a.length; i++) datos[i] += a[i]; } cara = ms[3].getAsFloat32Array().slice(); }
      else datos = fondoEnCero ? m0.getAsFloat32Array().map((v) => 1 - v) : m0.getAsFloat32Array().slice();
    });
    if (!datos) return null;
    soloPersonas(datos, cara, mw, mh);
    // Máscara chica con el alfa de la persona (bordes firmes pero sin serrucho).
    const mc = document.createElement("canvas"); mc.width = mw; mc.height = mh;
    const g = mc.getContext("2d"), id = g.createImageData(mw, mh);
    let x0 = mw, y0 = mh, x1 = 0, y1 = 0, n = 0;
    for (let i = 0; i < mw * mh; i++) {
      const p = datos[i], a = suave(0.35, 0.7, p);
      id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255; id.data[i * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) { const x = i % mw, y = (i / mw) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (n < mw * mh * 0.02) return null;   // menos del 2 %: no hay nadie
    g.putImageData(id, 0, 0);
    const out = document.createElement("canvas"); out.width = W; out.height = H; const o = out.getContext("2d");
    o.drawImage(foto, 0, 0); o.globalCompositeOperation = "destination-in"; o.imageSmoothingQuality = "high"; o.drawImage(mc, 0, 0, W, H);
    // Recorte a la caja de la persona, con un poco de aire.
    const sx = W / mw, sy = H / mh, mg = 0.02 * Math.max(W, H);
    const cx = Math.max(0, x0 * sx - mg), cy = Math.max(0, y0 * sy - mg), cw = Math.min(W, (x1 + 1) * sx + mg) - cx, ch = Math.min(H, (y1 + 1) * sy + mg) - cy;
    const fin = document.createElement("canvas"); fin.width = Math.round(cw); fin.height = Math.round(ch);
    fin.getContext("2d").drawImage(out, cx, cy, cw, ch, 0, 0, fin.width, fin.height);
    return { blob: await new Promise((ok) => fin.toBlob(ok, "image/png")), ancho: fin.width, alto: fin.height, tocaAbajo: (y1 + 1) / mh > 0.95 };
  }
  // Sin recortador: la foto entera, en un recuadro (para que igual sirva).
  async function enRecuadro(blob) {
    const bm = await createImageBitmap(blob), k = Math.min(1, 900 / Math.max(bm.width, bm.height));
    const c = document.createElement("canvas"); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    return { blob: await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.92)), ancho: c.width, alto: c.height, recuadro: true };
  }
  return { cargar, recortar, enRecuadro, puede: () => !Plataforma.artifact };
})();
