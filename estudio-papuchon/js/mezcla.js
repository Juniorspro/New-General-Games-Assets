"use strict";
// ════════════════════════════════════════════════════════════════════════
// Mezcla: el audio del proyecto con Web Audio. El mismo armado sirve para
// escuchar en vivo (AudioContext) y para exportar (OfflineAudioContext).
// Ducking: mientras habla la voz, la música y el audio del video bajan solos.
// ════════════════════════════════════════════════════════════════════════
const Mezcla = (() => {
  const RAMPA = 0.25;
  // Tramos [t0, t1] donde suena alguna voz (pista "voz"), unidos si están cerca.
  function tramosVoz(p) {
    const r = [];
    for (const k of p.pistas) if (k.tipo === "audio" && k.sub === "voz" && !k.silenciada) for (const c of k.clips) r.push([c.inicio, Proyecto.fin(c)]);
    r.sort((a, b) => a[0] - b[0]);
    const u = [];
    for (const x of r) { const l = u[u.length - 1]; if (l && x[0] <= l[1] + 0.6) l[1] = Math.max(l[1], x[1]); else u.push([...x]); }
    return u;
  }
  function automatizarDucking(g, tramos, nivel, t0, base) {
    // t0: segundo del proyecto que cae en `base` del reloj de audio.
    const a = (t) => base + Math.max(0, t - t0);
    g.gain.setValueAtTime(1, base);
    for (const [x0, x1] of tramos) {
      if (x1 < t0) continue;
      const s0 = x0 - RAMPA;
      if (s0 > t0) { g.gain.setValueAtTime(1, a(s0)); g.gain.linearRampToValueAtTime(nivel, a(x0)); } else g.gain.setValueAtTime(nivel, base);
      g.gain.setValueAtTime(nivel, a(x1)); g.gain.linearRampToValueAtTime(1, a(x1 + RAMPA * 1.6));
    }
  }
  // Clips con sonido: los del video principal, los de encima y las pistas de audio.
  function clipsConAudio(p) {
    const r = [];
    for (const k of p.pistas) {
      if (k.silenciada || !["video", "superpuesta", "audio"].includes(k.tipo)) continue;
      const bus = k.tipo === "audio" ? k.sub || "efectos" : "video";
      for (const c of k.clips) { if (!c.medio || (c.volumen ?? 1) <= 0) continue; const d = Medios.datos(c.medio); if (d && d.tipo !== "imagen" && d.tieneAudio !== false) r.push({ c, k, bus }); }
    }
    return r;
  }
  // Arma el grafo desde el segundo t0 del proyecto, arrancando en `base` del reloj de ctx.
  // Devuelve las fuentes creadas (para frenarlas) o null si falta algún audio todavía.
  async function armar(ctx, p, t0, base, destino) {
    const ducking = p.audio && p.audio.ducking !== false, nivel = (p.audio && p.audio.nivelDucking) || 0.3, tramos = tramosVoz(p);
    const salida = ctx.createDynamicsCompressor(); // un limitador suave para que nada sature
    salida.threshold.value = -3; salida.knee.value = 4; salida.ratio.value = 12; salida.attack.value = 0.003; salida.release.value = 0.15;
    salida.connect(destino || ctx.destination);
    const buses = {};
    for (const b of ["video", "voz", "musica", "efectos"]) {
      const g = ctx.createGain(); g.connect(salida); buses[b] = g;
      if (ducking && tramos.length && (b === "musica" || b === "video")) automatizarDucking(g, tramos, b === "musica" ? nivel : Math.min(1, nivel * 1.6), t0, base);
    }
    const fuentes = [], lista = clipsConAudio(p);
    const buffers = await Promise.all(lista.map((x) => Medios.audioBuffer(x.c.medio)));
    lista.forEach((x, i) => {
      const ab = buffers[i]; if (!ab) return;
      const c = x.c, v = c.velocidad || 1, d = Proyecto.dur(c), f = Proyecto.fin(c);
      if (f <= t0) return;
      const en = Math.max(0, c.inicio - t0), salto = Math.max(0, t0 - c.inicio);   // segundos del proyecto
      const off = c.desde + salto * v, largo = (d - salto) * v;
      if (off >= ab.duration || largo <= 0.01) return;
      const s = ctx.createBufferSource(); s.buffer = ab; s.playbackRate.value = v;
      const g = ctx.createGain(), vol = (c.volumen ?? 1) * (x.k.volumen ?? 1), ini = base + en;
      // Fundidos del clip (también en el audio).
      const fe = c.fundidoEntrada || 0, fs = c.fundidoSalida || 0;
      if (fe > salto) { g.gain.setValueAtTime(vol * (salto / fe), ini); g.gain.linearRampToValueAtTime(vol, ini + (fe - salto)); } else g.gain.setValueAtTime(vol, ini);
      if (fs > 0) { const z = base + (f - t0); g.gain.setValueAtTime(vol, Math.max(ini, z - fs)); g.gain.linearRampToValueAtTime(0, z); }
      s.connect(g); g.connect(buses[x.bus] || buses.efectos);
      s.start(ini, off, largo); fuentes.push(s);
    });
    return { fuentes, salida, parar() { for (const s of fuentes) try { s.stop(); } catch (e) { /* ya paró */ } try { salida.disconnect(); } catch (e) { /* */ } } };
  }
  const precargar = (p) => Promise.all(clipsConAudio(p).map((x) => Medios.audioBuffer(x.c.medio)));
  // Render completo para exportar.
  async function renderizar(p, desde = 0, hasta = Proyecto.duracion(p), sr = 48000) {
    const n = Math.max(1, Math.ceil((hasta - desde) * sr));
    const ctx = new OfflineAudioContext(2, n, sr);
    await armar(ctx, p, desde, 0, ctx.destination);
    return ctx.startRendering();
  }
  // AudioBuffer → WAV (para las voces y la música generada).
  function wav(ab) {
    const ch = Math.min(2, ab.numberOfChannels), n = ab.length, sr = ab.sampleRate, buf = new ArrayBuffer(44 + n * ch * 2), d = new DataView(buf);
    const s = (o, x) => { for (let i = 0; i < x.length; i++) d.setUint8(o + i, x.charCodeAt(i)); };
    s(0, "RIFF"); d.setUint32(4, 36 + n * ch * 2, true); s(8, "WAVE"); s(12, "fmt "); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, ch, true);
    d.setUint32(24, sr, true); d.setUint32(28, sr * ch * 2, true); d.setUint16(32, ch * 2, true); d.setUint16(34, 16, true); s(36, "data"); d.setUint32(40, n * ch * 2, true);
    const datos = [...Array(ch)].map((_, i) => ab.getChannelData(i));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = clamp(datos[c][i], -1, 1); d.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
    return new Blob([buf], { type: "audio/wav" });
  }
  function wavDeMuestras(f32, sr) { return wav({ numberOfChannels: 1, length: f32.length, sampleRate: sr, getChannelData: () => f32 }); }
  return { armar, precargar, renderizar, wav, wavDeMuestras, tramosVoz };
})();
