"use strict";
// ════════════════════════════════════════════════════════════════════════
// Cámara: el "modo filmable". Filmás con el celular y ves los gráficos del
// canal encima (mosca, zócalo, ticker) como en un estudio. Se puede grabar
// con los gráficos pegados o limpio (y ponerlos después en el editor).
// ════════════════════════════════════════════════════════════════════════
const Camara = (() => {
  let flujo = null, video = null, canvas = null, ctx = null, raf = 0, t0 = 0, graficos = [], conGraficos = true, rec = null;
  let grabador = null, trozos = [], inicioGrab = 0, espejo = true, frontal = true;
  const W = 1080, H = 1920;
  async function abrir(cv, opciones = {}) {
    if (!Plataforma.puede("camara")) throw new Error("Este navegador no deja usar la cámara desde acá. Abrí el editor desde el link de githack.");
    cerrar();
    frontal = opciones.frontal !== false; canvas = cv; canvas.width = W; canvas.height = H; ctx = canvas.getContext("2d");
    flujo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: frontal ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    video = document.createElement("video"); video.muted = true; video.playsInline = true; video.srcObject = flujo; await video.play();
    espejo = frontal; rec = await Compositor.recursos(Tienda.get().marca); t0 = performance.now();
    const paso = () => { dibujar(); raf = requestAnimationFrame(paso); }; paso();
  }
  function dibujar(conGraf = conGraficos) {
    if (!ctx || !video) return;
    const vw = video.videoWidth || 16, vh = video.videoHeight || 9, e = Math.max(W / vw, H / vh);
    ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    if (espejo) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, (W - vw * e) / 2, (H - vh * e) / 2, vw * e, vh * e); ctx.restore();
    if (conGraf) { const t = (performance.now() - t0) / 1000; for (const g of graficos) Plantillas.dibujarClip(ctx, { ...g, inicio: 0, duracion: 1e6 }, t, W, H, rec); }
  }
  // Los gráficos que se ven encima: [{ plantilla, params }]. Reinicia sus animaciones de entrada.
  function ponerGraficos(lista, pegar = true) { graficos = lista.map((g) => ({ id: g.plantilla, plantilla: g.plantilla, params: g.params || {}, caja: { x: 0, y: 0, escala: 1, rot: 0 } })); conGraficos = pegar; t0 = performance.now(); }
  function grabar() {
    if (!flujo) return;
    t0 = performance.now();
    const pistas = [...canvas.captureStream(30).getVideoTracks(), ...flujo.getAudioTracks()];
    const tipo = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x)) || "";
    grabador = new MediaRecorder(new MediaStream(pistas), { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 8e6 });
    trozos = []; grabador.ondataavailable = (e) => e.data.size && trozos.push(e.data); grabador.start(500); inicioGrab = performance.now();
  }
  function cortar() {
    return new Promise((ok) => {
      if (!grabador) return ok(null);
      grabador.onstop = async () => {
        const mime = (grabador.mimeType || "video/webm").split(";")[0], blob = new Blob(trozos, { type: mime }); grabador = null;
        const nombre = "Filmado " + new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/[/:]/g, "-") + (mime.includes("mp4") ? ".mp4" : ".webm");
        try { ok(await Medios.importar(blob, nombre, { origen: "camara" })); } catch (e) { Tienda.aviso(e.message, "error"); ok(null); }
      };
      grabador.stop();
    });
  }
  function cerrar() {
    cancelAnimationFrame(raf); raf = 0;
    if (grabador) try { grabador.stop(); } catch (e) { /* */ } grabador = null;
    if (flujo) flujo.getTracks().forEach((t) => t.stop()); flujo = null; video = null;
  }
  return {
    abrir, cerrar, grabar, cortar, ponerGraficos,
    get grabando() { return !!grabador; }, get segundos() { return grabador ? (performance.now() - inicioGrab) / 1000 : 0; },
    get frontal() { return frontal; }, set espejo(v) { espejo = v; },
  };
})();
