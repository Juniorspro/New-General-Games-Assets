"use strict";
// ════════════════════════════════════════════════════════════════════════
// Exportador: arma el MP4 final cuadro por cuadro (más rápido que tiempo
// real en una compu, y sin saltos aunque el celular sea lento).
// WebCodecs codifica (H.264 + AAC si se puede; si no, VP9 / Opus) y
// mp4-muxer arma el archivo. Sin WebCodecs: se graba en tiempo real con
// MediaRecorder (sale WebM o MP4 según el navegador).
// ════════════════════════════════════════════════════════════════════════
const Exportador = (() => {
  const CALIDADES = {
    alta: { nombre: "Alta (1080p)", escala: 1, bits: 12e6 },
    normal: { nombre: "Normal (1080p, pesa menos)", escala: 1, bits: 7e6 },
    liviana: { nombre: "Liviana (720p)", escala: 2 / 3, bits: 4e6 },
  };
  const par = (n) => Math.max(2, Math.round(n / 2) * 2);
  async function elegirVideo(w, h, fps, bits) {
    const prueba = [
      ["avc1.640028", "avc"], ["avc1.4d0028", "avc"], ["avc1.640032", "avc"], ["avc1.42e032", "avc"],
      ["vp09.00.40.08", "vp9"], ["vp09.00.10.08", "vp9"],
    ];
    for (const [codec, mux] of prueba) {
      const conf = { codec, width: w, height: h, bitrate: bits, framerate: fps, latencyMode: "quality", ...(mux === "avc" ? { avc: { format: "avc" } } : {}) };
      try { const r = await VideoEncoder.isConfigSupported(conf); if (r.supported) return { conf: r.config || conf, mux }; } catch (e) { /* sigue */ }
    }
    return null;
  }
  async function elegirAudio(sr) {
    for (const [codec, mux] of [["mp4a.40.2", "aac"], ["opus", "opus"]]) {
      const conf = { codec, sampleRate: sr, numberOfChannels: 2, bitrate: 160000 };
      try { const r = await AudioEncoder.isConfigSupported(conf); if (r.supported) return { conf: r.config || conf, mux }; } catch (e) { /* sigue */ }
    }
    return null;
  }
  function nombreArchivo(p, ext) {
    const base = (p.nombre || "video").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "video";
    return `papuchon-${base}.${ext}`;
  }

  // opciones: { calidad, alAvance(f, cuadro), cancelado() }
  async function exportar(p, opciones = {}) {
    const cal = CALIDADES[opciones.calidad] || CALIDADES.alta;
    if (Plataforma.puede("webcodecs") && typeof Mp4Muxer !== "undefined") {
      try { return await conWebCodecs(p, cal, opciones); }
      catch (e) { if (e.message === "cancelado") throw e; console.warn("WebCodecs falló, pruebo en tiempo real", e); }
    }
    return enTiempoReal(p, cal, opciones);
  }

  async function conWebCodecs(p, cal, op) {
    const fps = p.formato.fps || 30, W = par(p.formato.ancho * cal.escala), H = par(p.formato.alto * cal.escala), sr = 48000;
    const D = Proyecto.duracion(p), total = Math.ceil(D * fps);
    const vid = await elegirVideo(W, H, fps, cal.bits); if (!vid) throw new Error("sin codificador de video");
    const aud = await elegirAudio(sr);
    const objetivo = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({
      target: objetivo, fastStart: "in-memory", firstTimestampBehavior: "offset",
      video: { codec: vid.mux, width: W, height: H, frameRate: fps },
      ...(aud ? { audio: { codec: aud.mux, numberOfChannels: 2, sampleRate: sr } } : {}),
    });
    let error = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { error = e; } });
    venc.configure(vid.conf);
    // Audio: se mezcla todo de una vez y se codifica en pedazos.
    op.alAvance && op.alAvance(0, null, "Mezclando el audio…");
    if (aud) {
      const ab = await Mezcla.renderizar(p, 0, D, sr);
      const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { error = e; } });
      aenc.configure(aud.conf);
      const L = ab.getChannelData(0), R = ab.numberOfChannels > 1 ? ab.getChannelData(1) : L, paso = 4800;
      for (let i = 0; i < ab.length; i += paso) {
        const n = Math.min(paso, ab.length - i), d = new Float32Array(n * 2);
        d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: "f32-planar", sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / sr) * 1e6), data: d });
        aenc.encode(ad); ad.close();
      }
      await aenc.flush(); aenc.close();
    }
    // Video: cuadro por cuadro, cada video ubicado exacto antes de dibujar.
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d", { alpha: false });
    const rec = { ...(await Compositor.recursos(Tienda.get().marca)), esc: W / p.formato.ancho };
    const t0 = performance.now();
    for (let i = 0; i < total; i++) {
      if (error) throw error;
      if (op.cancelado && op.cancelado()) { try { venc.close(); } catch (e) { /* */ } throw new Error("cancelado"); }
      const t = i / fps;
      await Compositor.ubicar(p, t, 0.25 / fps, true);
      Compositor.dibujar(ctx, p, t, rec);
      const fr = new VideoFrame(cv, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / fps) });
      venc.encode(fr, { keyFrame: i % (fps * 2) === 0 }); fr.close();
      while (venc.encodeQueueSize > 6) await esperar(4);
      if (op.alAvance && (i % 3 === 0 || i === total - 1)) {
        const pasado = (performance.now() - t0) / 1000, resta = (pasado / (i + 1)) * (total - i - 1);
        op.alAvance((i + 1) / total, cv, `Cuadro ${i + 1} de ${total} · faltan ${Math.ceil(resta)} s`);
      }
    }
    await venc.flush(); venc.close();
    if (error) throw error;
    muxer.finalize();
    const blob = new Blob([objetivo.buffer], { type: "video/mp4" });
    return { blob, nombre: nombreArchivo(p, "mp4"), mime: "video/mp4", duracion: D, ancho: W, alto: H, codec: vid.mux + (aud ? "+" + aud.mux : ""), segundos: (performance.now() - t0) / 1000 };
  }

  // Plan B: reproducir y grabar el canvas en tiempo real.
  async function enTiempoReal(p, cal, op) {
    if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) throw new Error("Este navegador no puede exportar video. Probá con Chrome.");
    const fps = p.formato.fps || 30, W = par(p.formato.ancho * cal.escala), H = par(p.formato.alto * cal.escala), D = Proyecto.duracion(p);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d");
    const rec = { ...(await Compositor.recursos(Tienda.get().marca)), esc: W / p.formato.ancho };
    const a = Motor.audio(); if (a.state === "suspended") await a.resume();
    const destino = a.createMediaStreamDestination();
    const flujo = new MediaStream([...cv.captureStream(fps).getVideoTracks(), ...destino.stream.getAudioTracks()]);
    const tipo = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x)) || "";
    const grab = new MediaRecorder(flujo, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: cal.bits, audioBitsPerSecond: 160000 });
    const trozos = []; grab.ondataavailable = (e) => e.data.size && trozos.push(e.data);
    await Compositor.ubicar(p, 0); await Mezcla.precargar(p);
    const base = a.currentTime + 0.15, mezcla = await Mezcla.armar(a, p, 0, base, destino);
    grab.start(500);
    const usados = new Set();
    await new Promise((ok, mal) => {
      const paso = () => {
        if (op.cancelado && op.cancelado()) { mezcla.parar(); grab.stop(); return mal(new Error("cancelado")); }
        const t = Math.max(0, a.currentTime - base);
        if (t >= D) return ok();
        for (const f of Compositor.fuentesEn(p, t)) {
          const v = Medios.video(f.c.medio, f.k); if (!v) continue; usados.add(v);
          if (v.paused) { v.currentTime = f.ts; v.play().catch(() => {}); } else if (Math.abs(v.currentTime - f.ts) > 0.3) v.currentTime = f.ts;
        }
        Compositor.dibujar(ctx, p, t, rec);
        op.alAvance && op.alAvance(t / D, cv, `Grabando en tiempo real… ${fmtTiempo(t)} de ${fmtTiempo(D)}`);
        requestAnimationFrame(paso);
      };
      paso();
    });
    mezcla.parar(); for (const v of usados) v.pause();
    await new Promise((ok) => { grab.onstop = ok; grab.stop(); });
    const mime = (grab.mimeType || "video/webm").split(";")[0], blob = new Blob(trozos, { type: mime });
    return { blob, nombre: nombreArchivo(p, mime.includes("mp4") ? "mp4" : "webm"), mime, duracion: D, ancho: W, alto: H, codec: "MediaRecorder" };
  }

  // Una foto del cuadro actual (portada para TikTok).
  async function foto(p, t) {
    const W = p.formato.ancho, H = p.formato.alto, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    await Compositor.ubicar(p, t);
    Compositor.dibujar(cv.getContext("2d"), p, t, { ...(await Compositor.recursos(Tienda.get().marca)), esc: 1 });
    const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.92));
    return { blob, nombre: nombreArchivo(p, "jpg").replace(".jpg", "-portada.jpg") };
  }
  return { exportar, foto, CALIDADES, nombreArchivo };
})();
