"use strict";
// ════════════════════════════════════════════════════════════════════════
// Voces: locutor hombre generado en el navegador, sin servidor.
// Piper (red neuronal VITS) con la voz es_MX "claude" (licencia Apache-2.0,
// voz sintética: no copia a ninguna persona). El modelo pesa 63 MB: se baja
// una vez y queda guardado en IndexedDB. Fonemas: espeak-ng compilado a WASM.
// También: grabar tu voz con el micrófono.
// ════════════════════════════════════════════════════════════════════════
const Voces = (() => {
  const ORT = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/";
  const FONEMAS = "https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/dist/piper-o91UDS6e.js";
  const ESPEAK = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";
  const MODELO = "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx";
  const CLAVE = "piper:es_MX-claude-high";
  const ESTILOS = {
    locutor: { nombre: "Locutor", ruido: 0.667, ruidoW: 0.8, vel: 1 },
    serio: { nombre: "Serio", ruido: 0.45, ruidoW: 0.6, vel: 0.95 },
    urgente: { nombre: "Urgente", ruido: 0.75, ruidoW: 0.9, vel: 1.12 },
  };
  let sesion = null, cfg = null, crearFonemas = null, cargando = null;
  const oyentes = new Set(); let estado = { fase: "sin cargar", avance: 0 };
  const avisar = (e) => { estado = { ...estado, ...e }; for (const f of oyentes) f(estado); };

  function script(src) {
    return new Promise((ok, mal) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => mal(new Error("no se pudo bajar " + src.split("/").pop())); document.head.appendChild(s); });
  }
  async function bajar(url, nombre) {
    const r = await fetch(url); if (!r.ok) throw new Error(nombre + ": " + r.status);
    const total = +r.headers.get("content-length") || 0; if (!r.body || !total) return r.arrayBuffer();
    const lector = r.body.getReader(), partes = []; let n = 0;
    for (;;) { const { done, value } = await lector.read(); if (done) break; partes.push(value); n += value.length; avisar({ fase: "Bajando la voz", avance: n / total }); }
    const u8 = new Uint8Array(n); let o = 0; for (const p of partes) { u8.set(p, o); o += p.length; } return u8.buffer;
  }
  function cargar() {
    if (cargando) return cargando;
    cargando = (async () => {
      if (!Plataforma.puede("vozNeural")) throw new Error("La voz generada funciona abriendo el editor desde el link de githack o el archivo descargado (acá adentro no deja bajar el modelo).");
      avisar({ fase: "Preparando", avance: 0 });
      if (typeof ort === "undefined") await script(ORT + "ort.wasm.min.js");
      ort.env.wasm.wasmPaths = ORT; ort.env.wasm.numThreads = 1;
      crearFonemas = (await import(FONEMAS)).createPiperPhonemize;
      let guardado = await Almacen.cache(CLAVE).catch(() => null);
      if (!guardado || !guardado.modelo) {
        const c = await (await fetch(MODELO + ".json")).json();
        const m = await bajar(MODELO, "modelo de voz");
        guardado = { cfg: c, modelo: m };
        await Almacen.guardarCache(CLAVE, guardado).catch(() => {});   // si no entra, se vuelve a bajar la próxima
      }
      cfg = guardado.cfg;
      avisar({ fase: "Encendiendo la voz", avance: 1 });
      sesion = await ort.InferenceSession.create(guardado.modelo, { executionProviders: ["wasm"] });
      avisar({ fase: "lista", avance: 1 });
    })().catch((e) => { cargando = null; avisar({ fase: "error", error: e.message }); throw e; });
    return cargando;
  }
  function fonemas(texto) {
    return new Promise(async (ok, mal) => {
      const tm = setTimeout(() => mal(new Error("los fonemas tardaron demasiado")), 20000);
      try {
        const m = await crearFonemas({
          print: (d) => { clearTimeout(tm); ok(JSON.parse(d).phoneme_ids); }, printErr: () => {},
          locateFile: (u) => (u.endsWith(".wasm") ? ESPEAK + ".wasm" : u.endsWith(".data") ? ESPEAK + ".data" : u),
        });
        m.callMain(["-l", cfg.espeak.voice, "--input", JSON.stringify([{ text: texto }]), "--espeak_data", "/espeak-ng-data"]);
      } catch (e) { clearTimeout(tm); mal(e); }
    });
  }
  // Para que el locutor lea bien lo que se escribe en una nota.
  function normalizar(t) {
    return String(t || "")
      .replace(/\*/g, "").replace(/%/g, " por ciento").replace(/\$\s?(\d)/g, "$1 pesos ").replace(/US\$/g, "dólares ")
      .replace(/\bkm\b/gi, "kilómetros").replace(/\bhs\.?\b/gi, "horas").replace(/\bDr\.\s/g, "doctor ").replace(/\bSr\.\s/g, "señor ")
      .replace(/(\d)\.(\d{3})\b/g, "$1$2").replace(/[«»"“”]/g, "").replace(/\s+/g, " ").trim();
  }
  // Oraciones (cada una se sintetiza aparte; entre una y otra va una pausa).
  function oraciones(t) { return (t.match(/[^.!?¡¿…]+[.!?…]*|[¡¿][^!?]+[!?]/g) || [t]).map((s) => s.trim()).filter((s) => /[\p{L}\d]/u.test(s)); }

  // Peso de cada palabra según sus fonemas (si espeak no las cuenta igual, por letras).
  function pesosPalabras(palabras, ids) {
    const mapa = cfg.phoneme_id_map || {}, esp = (mapa[" "] || [3])[0], pad = (mapa["_"] || [0])[0], ini = (mapa["^"] || [1])[0], fin = (mapa["$"] || [2])[0];
    const grupos = []; let n = 0;
    for (const i of ids) { if (i === pad || i === ini || i === fin) continue; if (i === esp) { if (n) grupos.push(n); n = 0; } else n++; }
    if (n) grupos.push(n);
    if (grupos.length === palabras.length) return grupos;
    return palabras.map((p) => p.replace(/[^\p{L}\d]/gu, "").length + 1);
  }
  // Recorta el silencio de las puntas (para que los subtítulos caigan justo).
  function puntas(x, sr) {
    const u = 0.012; let a = 0, b = x.length - 1;
    while (a < b && Math.abs(x[a]) < u) a++; while (b > a && Math.abs(x[b]) < u) b--;
    return [Math.max(0, a - sr * 0.03) | 0, Math.min(x.length, b + sr * 0.06) | 0];
  }
  // Un toque más grave: se genera un 9 % más rápido y se estira (baja el tono sin cambiar el ritmo).
  function engravar(x, f) {
    const n = Math.floor(x.length / f), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const p = i * f, j = p | 0, k = p - j; y[i] = (x[j] || 0) * (1 - k) + (x[j + 1] || 0) * k; }
    return y;
  }
  async function sintetizar(texto, { estilo = "locutor", velocidad = 1, grave = true, pausa = 0.28 } = {}) {
    await cargar();
    const e = ESTILOS[estilo] || ESTILOS.locutor, sr = cfg.audio.sample_rate, F = grave ? 0.91 : 1;
    const ls = (cfg.inference.length_scale || 1) / (velocidad * e.vel) * F;
    const partes = [], palabras = []; let t = 0;
    for (const o of oraciones(normalizar(texto))) {
      avisar({ fase: "Hablando", avance: 0 });
      await esperar(20);   // deja respirar la pantalla antes del cálculo pesado
      const ids = await fonemas(o);
      const r = await sesion.run({
        input: new ort.Tensor("int64", ids, [1, ids.length]), input_lengths: new ort.Tensor("int64", [ids.length]),
        scales: new ort.Tensor("float32", [e.ruido, ls, e.ruidoW]),
      });
      let x = r.output.data; if (F !== 1) x = engravar(x, F);
      const [a, b] = puntas(x, sr); x = x.slice(a, b);
      // Palabras de la oración repartidas según sus fonemas.
      const pals = o.split(/\s+/).filter(Boolean), pesos = pesosPalabras(pals, ids), tot = pesos.reduce((s, v) => s + v, 0) || 1, d = x.length / sr;
      let acc = 0;
      pals.forEach((p, i) => { const t0 = t + 0.04 + (acc / tot) * (d - 0.1); acc += pesos[i]; palabras.push({ p, t0, t1: t + 0.04 + (acc / tot) * (d - 0.1) }); });
      partes.push(x); t += d;
      const silencio = new Float32Array(Math.round(sr * (/[.!?…]$/.test(o) ? pausa : pausa * 0.6))); partes.push(silencio); t += silencio.length / sr;
    }
    if (!partes.length) throw new Error("No hay nada para leer");
    partes.pop(); // sin silencio al final
    const n = partes.reduce((s, p) => s + p.length, 0), muestras = new Float32Array(n); let o = 0;
    for (const p of partes) { muestras.set(p, o); o += p.length; }
    // Normaliza el volumen a -1 dBFS de pico.
    let pico = 0; for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(muestras[i]));
    if (pico > 0) { const g = 0.89 / pico; for (let i = 0; i < n; i++) muestras[i] *= g; }
    avisar({ fase: "lista" });
    return { muestras, sr, palabras, duracion: n / sr };
  }
  // Genera y guarda como medio (con su texto y los tiempos de cada palabra, para subtítulos).
  async function generarMedio(texto, opciones = {}) {
    const r = await sintetizar(texto, opciones);
    const blob = Mezcla.wavDeMuestras(r.muestras, r.sr), corto = texto.replace(/\s+/g, " ").trim().slice(0, 34);
    return Medios.importar(blob, "Voz: " + corto + (texto.length > 34 ? "…" : "") + ".wav", { texto, palabras: r.palabras, origen: "voz" });
  }

  // ── Grabar con el micrófono ──
  let grabador = null, flujo = null, trozos = [];
  async function grabar() {
    if (!Plataforma.puede("microfono")) throw new Error("Este navegador no deja usar el micrófono desde acá.");
    flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const tipo = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    grabador = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : {}); trozos = [];
    grabador.ondataavailable = (e) => e.data.size && trozos.push(e.data); grabador.start(250);
  }
  function cortar() {
    return new Promise((ok) => {
      if (!grabador) return ok(null);
      grabador.onstop = async () => {
        flujo.getTracks().forEach((t) => t.stop());
        const blob = new Blob(trozos, { type: grabador.mimeType || "audio/webm" }); grabador = null;
        const ext = /mp4/.test(blob.type) ? "m4a" : /ogg/.test(blob.type) ? "ogg" : "webm";
        ok(await Medios.importar(blob, "Mi voz " + new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) + "." + ext, { origen: "microfono" }));
      };
      grabador.stop();
    });
  }
  return {
    cargar, sintetizar, generarMedio, grabar, cortar, ESTILOS, normalizar,
    get estado() { return estado; }, get grabando() { return !!grabador; }, get lista() { return !!sesion; },
    alCambiar: (f) => (oyentes.add(f), () => oyentes.delete(f)),
  };
})();
