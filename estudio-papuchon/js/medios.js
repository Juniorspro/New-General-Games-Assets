"use strict";
// ════════════════════════════════════════════════════════════════════════
// Medios: los archivos del usuario (videos, fotos, audios). Se guardan
// en IndexedDB y se analizan (duración, tamaño, miniaturas, onda de audio).
// Lo lento (miniaturas, onda) va en segundo plano después de importar.
// ════════════════════════════════════════════════════════════════════════
const Medios = (() => {
  const datos = new Map(), urls = new Map(), videos = new Map(), imagenes = new Map(), buffers = new Map(), enCurso = new Set();
  const oyentes = new Set();
  const avisar = (m) => { for (const f of oyentes) f(m); };
  function tipoDe(mime, nombre) {
    if (/^video\//.test(mime) || /\.(mp4|mov|webm|m4v|mkv|3gp)$/i.test(nombre)) return "video";
    if (/^image\//.test(mime) || /\.(png|jpe?g|webp|gif|heic)$/i.test(nombre)) return "imagen";
    if (/^audio\//.test(mime) || /\.(mp3|m4a|wav|ogg|opus|aac|flac)$/i.test(nombre)) return "audio";
    return null;
  }
  function esperarEvento(el, ok, mal = "error", ms = 15000) {
    return new Promise((res, rej) => {
      const t = setTimeout(() => { limpiar(); rej(new Error("tardó demasiado")); }, ms);
      const a = () => { limpiar(); res(); }, b = () => { limpiar(); rej(new Error("no se pudo leer")); };
      const limpiar = () => { clearTimeout(t); el.removeEventListener(ok, a); el.removeEventListener(mal, b); };
      el.addEventListener(ok, a, { once: true }); el.addEventListener(mal, b, { once: true });
    });
  }
  function urlDeBlob(mid, blob) { if (!urls.has(mid)) urls.set(mid, URL.createObjectURL(blob)); return urls.get(mid); }
  async function preparar(mid) {
    if (urls.has(mid)) return urls.get(mid);
    if (!datos.has(mid)) { const d = await Almacen.medio(mid); if (d) datos.set(mid, d); }
    const b = await Almacen.blob(mid); return b ? urlDeBlob(mid, b) : null;
  }
  async function cargarDe(ids) { await Promise.all(ids.map((i) => preparar(i).catch(() => null))); }
  async function analizar(medio, blob) {
    const url = urlDeBlob(medio.id, blob);
    if (medio.tipo === "video") {
      const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
      await esperarEvento(v, "loadedmetadata");
      medio.duracion = isFinite(v.duration) ? v.duration : 0; medio.ancho = v.videoWidth; medio.alto = v.videoHeight;
      // Algunos WebM grabados no dicen su duración hasta llegar al final.
      if (!medio.duracion) { v.currentTime = 1e7; await esperarEvento(v, "seeked").catch(() => {}); medio.duracion = isFinite(v.duration) ? v.duration : 10; }
      v.removeAttribute("src"); v.load();
    } else if (medio.tipo === "imagen") {
      const bm = await createImageBitmap(blob); medio.ancho = bm.width; medio.alto = bm.height; imagenes.set(medio.id, bm);
      const c = document.createElement("canvas"), h = 96; c.height = h; c.width = Math.max(1, Math.round(h * bm.width / bm.height)); c.getContext("2d").drawImage(bm, 0, 0, c.width, h);
      medio.miniaturas = [c.toDataURL("image/jpeg", 0.7)];
    } else {
      const ab = await audioBuffer(medio.id, blob); if (!ab) throw new Error("no se pudo leer el audio");
      medio.duracion = ab.duration;
    }
  }
  // Miniaturas del video: hasta 12 cuadros repartidos, a 96 px de alto.
  async function miniaturas(medio) {
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = urls.get(medio.id);
    await esperarEvento(v, "loadeddata").catch(() => {});
    const n = clamp(Math.ceil(medio.duracion / 3), 1, 12), h = 96, w = Math.max(1, Math.round(h * (medio.ancho || 16) / (medio.alto || 9)));
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), out = [];
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(medio.duracion - 0.05, (i + 0.5) * medio.duracion / n);
      try { await esperarEvento(v, "seeked", "error", 6000); g.drawImage(v, 0, 0, w, h); out.push(c.toDataURL("image/jpeg", 0.6)); } catch (e) { break; }
    }
    v.removeAttribute("src"); v.load(); return out;
  }
  async function picos(mid) {
    const ab = await audioBuffer(mid); if (!ab) return null;
    const n = Math.min(6000, Math.ceil(ab.duration * 40)), d = ab.getChannelData(0), paso = Math.floor(d.length / n) || 1, out = new Array(n);
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * paso, f = Math.min(d.length, j + paso); j < f; j += 4) { const v = Math.abs(d[j]); if (v > m) m = v; } out[i] = Math.round(Math.min(1, m) * 100) / 100; }
    return out;
  }
  async function enSegundoPlano(medio) {
    try {
      if (medio.tipo === "video") medio.miniaturas = await miniaturas(medio);
      if (medio.tipo !== "imagen") { medio.picos = await picos(medio.id); medio.tieneAudio = !!medio.picos; }
      await Almacen.guardarMedio(medio); datos.set(medio.id, { ...medio }); avisar(medio);
    } catch (e) { console.warn("análisis", medio.nombre, e); }
  }
  async function importar(archivo, nombre, extra = {}) {
    nombre = nombre || archivo.name || "medio";
    const tipo = tipoDe(archivo.type || "", nombre);
    if (!tipo) throw new Error(`"${nombre}" no es un video, una foto ni un audio`);
    const medio = { id: id("m"), tipo, nombre, mime: archivo.type, tamano: archivo.size, duracion: 0, ancho: 0, alto: 0, tieneAudio: tipo !== "imagen", miniaturas: [], picos: null, creado: Date.now(), ...extra };
    enCurso.add(medio.id);
    try {
      await analizar(medio, archivo);
      await Almacen.guardarMedio(medio, archivo); datos.set(medio.id, medio);
    } catch (e) {
      urls.delete(medio.id); throw new Error(`No pude abrir "${nombre}" (${e.message}). Si es un video del celular, probá exportarlo como MP4.`);
    } finally { enCurso.delete(medio.id); }
    enSegundoPlano(medio);
    return medio;
  }
  // Un medio con id fijo (el logo, la música generada): si ya está guardado no se repite.
  async function importarFijo(mid, blob, nombre, extra = {}) {
    if (datos.has(mid) && urls.has(mid)) return datos.get(mid);
    const d = await Almacen.medio(mid);
    if (d) { datos.set(mid, d); await preparar(mid); return d; }
    if (typeof blob === "function") blob = await blob();
    const mime = blob.type || "";
    const medio = { id: mid, tipo: tipoDe(mime, nombre), nombre, mime, tamano: blob.size, duracion: 0, ancho: 0, alto: 0, tieneAudio: true, miniaturas: [], picos: null, creado: Date.now(), incluido: true, ...extra };
    await analizar(medio, blob); await Almacen.guardarMedio(medio, blob); datos.set(mid, medio);
    if (medio.tipo !== "imagen") enSegundoPlano(medio);
    return medio;
  }
  async function importarB64(mid, b64, mime, nombre) {
    if (datos.has(mid) && urls.has(mid)) return datos.get(mid);
    return importarFijo(mid, () => {
      const bin = atob(b64.slice(b64.indexOf(",") + 1)), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type: mime });
    }, nombre);
  }
  function video(mid, clave = "") {
    const k = mid + "|" + clave; if (videos.has(k)) return videos.get(k);
    const u = urls.get(mid); if (!u) { preparar(mid); return null; }
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = u;
    v.setAttribute("playsinline", ""); videos.set(k, v); return v;
  }
  async function imagen(mid) {
    if (imagenes.has(mid)) return imagenes.get(mid);
    const b = await Almacen.blob(mid); if (!b) return null;
    const bm = await createImageBitmap(b); imagenes.set(mid, bm); return bm;
  }
  const imagenYa = (mid) => imagenes.get(mid) || (imagen(mid), null);
  let ctxDecodificar = null;
  async function audioBuffer(mid, blob) {
    if (buffers.has(mid)) return buffers.get(mid);
    const pr = (async () => {
      try {
        const b = blob || (await Almacen.blob(mid)); if (!b) return null;
        ctxDecodificar = ctxDecodificar || new OfflineAudioContext(2, 1, 48000);
        return await ctxDecodificar.decodeAudioData(await b.arrayBuffer());
      } catch (e) { return null; }   // un video sin audio cae acá
    })();
    buffers.set(mid, pr); return pr;
  }
  return {
    importar, importarFijo, importarB64, preparar, cargarDe, video, imagen, imagenYa, audioBuffer,
    datos: (mid) => datos.get(mid), url: (mid) => urls.get(mid) || null, tipoDe,
    todos: () => [...datos.values()], listos: () => Promise.all([...enCurso].map(() => esperar(100))),
    alCambiar: (f) => (oyentes.add(f), () => oyentes.delete(f)),
    async borrar(mid) { await Almacen.borrarMedio(mid); datos.delete(mid); const u = urls.get(mid); if (u) URL.revokeObjectURL(u); urls.delete(mid); },
    async cargarTodos() { for (const d of await Almacen.medios()) if (!datos.has(d.id)) datos.set(d.id, d); },
  };
})();
