"use strict";
// ════════════════════════════════════════════════════════════════════════
// Música y efectos del canal, sintetizados acá mismo (sin derechos de
// nadie: se pueden subir a TikTok sin que los silencien). Se generan una
// vez y quedan guardados como medios con id fijo.
// ════════════════════════════════════════════════════════════════════════
const Musica = (() => {
  const SR = 44100;
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // ── Instrumentos ──
  function kit(ctx, salida) {
    const ruido = ctx.createBuffer(1, SR * 2, SR), d = ruido.getChannelData(0);
    let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    const env = (g, t, a, v, caida) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + caida); };
    function fuenteRuido(t, d0, filtro, f, q = 1) { const s = ctx.createBufferSource(); s.buffer = ruido; const fl = ctx.createBiquadFilter(); fl.type = filtro; fl.frequency.value = f; fl.Q.value = q; s.connect(fl); s.start(t, Math.random() * 1.5, d0 + 0.05); return fl; }
    function osc(tipo, f, t, dur, v, dest = salida, { a = 0.005, corte = 0, det = 0 } = {}) {
      const o = ctx.createOscillator(); o.type = tipo; o.frequency.value = f; o.detune.value = det;
      const g = ctx.createGain(); env(g, t, a, v, dur);
      if (corte) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = corte; o.connect(fl); fl.connect(g); } else o.connect(g);
      g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05); return o;
    }
    return {
      osc,
      bombo(t, v = 0.9) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const g = ctx.createGain(); env(g, t, 0.002, v, 0.4); o.connect(g); g.connect(salida); o.start(t); o.stop(t + 0.5); },
      caja(t, v = 0.45) { const n = fuenteRuido(t, 0.2, "highpass", 1400), g = ctx.createGain(); env(g, t, 0.001, v, 0.18); n.connect(g); g.connect(salida); osc("triangle", 190, t, 0.08, v * 0.5); },
      hat(t, v = 0.12, largo = 0.04) { const n = fuenteRuido(t, largo, "highpass", 7500), g = ctx.createGain(); env(g, t, 0.001, v, largo); n.connect(g); g.connect(salida); },
      palma(t, v = 0.35) { for (let i = 0; i < 3; i++) { const n = fuenteRuido(t + i * 0.012, 0.1, "bandpass", 1300, 1.5), g = ctx.createGain(); env(g, t + i * 0.012, 0.001, v, i === 2 ? 0.15 : 0.02); n.connect(g); g.connect(salida); } },
      platillo(t, v = 0.25) { const n = fuenteRuido(t, 2, "highpass", 5000), g = ctx.createGain(); env(g, t, 0.002, v, 1.8); n.connect(g); g.connect(salida); },
      pad(notas, t, dur, v = 0.07, corte = 1400) { for (const n of notas) for (const det of [-9, 8]) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(n); o.detune.value = det; const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = corte; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.5); g.gain.setValueAtTime(v, t + dur - 0.4); g.gain.linearRampToValueAtTime(0, t + dur + 0.3); o.connect(fl); fl.connect(g); g.connect(salida); o.start(t); o.stop(t + dur + 0.4); } },
      metal(notas, t, v = 0.11, dur = 0.35) { for (const n of notas) { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(n); const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 2; fl.frequency.setValueAtTime(400, t); fl.frequency.exponentialRampToValueAtTime(3200, t + 0.04); fl.frequency.exponentialRampToValueAtTime(700, t + dur); const g = ctx.createGain(); env(g, t, 0.01, v, dur); o.connect(fl); fl.connect(g); g.connect(salida); o.start(t); o.stop(t + dur + 0.1); } },
      bajo(n, t, dur, v = 0.28) { osc("sawtooth", hz(n), t, dur, v, salida, { corte: 380 }); osc("sine", hz(n - 12), t, dur, v * 0.6); },
      pluck(n, t, v = 0.16) { osc("triangle", hz(n), t, 0.35, v); osc("sine", hz(n + 12), t, 0.15, v * 0.3); },
      campana(n, t, v = 0.18, dur = 1.6) { for (const [m, a] of [[1, 1], [2.76, 0.4], [5.4, 0.2], [2, 0.3]]) osc("sine", hz(n) * m, t, dur / (m * 0.6 + 0.4), v * a); },
      ruido: fuenteRuido, env,
    };
  }
  // Render con eco de sala y un limitador al final.
  async function render(dur, fn, sala = 0.18) {
    const ctx = new OfflineAudioContext(2, Math.ceil(dur * SR), SR);
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -6; lim.ratio.value = 8; lim.connect(ctx.destination);
    const seco = ctx.createGain(); seco.connect(lim);
    if (sala > 0) {
      const ir = ctx.createBuffer(2, SR * 2, SR);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.5); }
      const cv = ctx.createConvolver(); cv.buffer = ir; const g = ctx.createGain(); g.gain.value = sala; seco.connect(cv); cv.connect(g); g.connect(lim);
    }
    fn(ctx, kit(ctx, seco), seco);
    return ctx.startRendering();
  }
  // Repite un compás de `pulsos` negras a `bpm` hasta cubrir la duración.
  const compases = (bpm, dur) => { const n = 60 / bpm; return { negra: n, compas: n * 4, cant: Math.ceil(dur / (n * 4)) }; };

  const CORTINAS = {
    urgente: {
      nombre: "Último momento", detalle: "Tensa, con pulso. Para primicias.", dur: 48,
      hacer: (ctx, k) => {
        const { negra, compas, cant } = compases(124, 48), acordes = [[50, 57, 62], [46, 53, 58], [53, 57, 60], [48, 55, 60]];
        for (let c = 0; c < cant; c++) {
          const t = c * compas, a = acordes[c % 4]; k.pad(a.map((n) => n + 12), t, compas, 0.045, 1100);
          for (let i = 0; i < 8; i++) k.bajo(a[0] - 12, t + i * negra / 2, negra * 0.35, 0.22);
          for (let i = 0; i < 16; i++) k.hat(t + i * negra / 4, i % 4 === 2 ? 0.1 : 0.05);
          k.bombo(t); k.bombo(t + negra * 2.5, 0.6); if (c % 2 === 0) k.metal(a.map((n) => n + 12), t, 0.06, 0.5);
          if (c % 4 === 3) k.caja(t + negra * 3.5, 0.3);
        }
      },
    },
    central: {
      nombre: "Noticiero central", detalle: "Brillante y seria. Apertura y notas.", dur: 48,
      hacer: (ctx, k) => {
        const { negra, compas, cant } = compases(100, 48), acordes = [[48, 55, 64], [43, 55, 62], [45, 57, 64], [41, 57, 65]];
        for (let c = 0; c < cant; c++) {
          const t = c * compas, a = acordes[c % 4]; k.pad(a.map((n) => n + 12), t, compas, 0.04, 1800);
          k.metal(a.map((n) => n + 12), t, 0.09, 0.4); k.metal(a.map((n) => n + 12), t + negra * 1.5, 0.06, 0.25);
          for (let i = 0; i < 4; i++) { k.bombo(t + i * negra, i % 2 ? 0.5 : 0.8); k.bajo(a[0] - 12, t + i * negra, negra * 0.7, 0.2); }
          k.caja(t + negra, 0.3); k.caja(t + negra * 3, 0.3);
          for (let i = 0; i < 8; i++) k.hat(t + i * negra / 2, 0.06);
        }
      },
    },
    tension: {
      nombre: "Policiales", detalle: "Oscura, latido. Para casos y misterio.", dur: 48,
      hacer: (ctx, k) => {
        const { negra, compas, cant } = compases(68, 48);
        k.osc("sine", hz(38), 0, 48, 0.25, undefined, { a: 2 }); k.osc("sawtooth", hz(50), 0, 48, 0.03, undefined, { a: 3, corte: 300, det: 6 });
        for (let c = 0; c < cant; c++) {
          const t = c * compas; k.bombo(t, 0.7); k.bombo(t + 0.22, 0.45); k.bombo(t + negra * 2, 0.6); k.bombo(t + negra * 2 + 0.22, 0.4);
          if (c % 2 === 1) k.campana(86 + (c % 4 === 1 ? 0 : -3), t + negra * 3, 0.05, 2.5);
          k.pad([50, 53, 57].map((n) => n + (c % 4 < 2 ? 0 : -2)), t, compas, 0.03, 700);
        }
      },
    },
    viral: {
      nombre: "Viral", detalle: "Alegre y picante. Para lo insólito.", dur: 40,
      hacer: (ctx, k) => {
        const { negra, compas, cant } = compases(118, 40), esc = [60, 62, 64, 67, 69, 72], mel = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 3, 4, 3, 2, 1, 0];
        const raices = [48, 45, 41, 43];
        for (let c = 0; c < cant; c++) {
          const t = c * compas, r = raices[c % 4];
          for (let i = 0; i < 4; i++) { k.bombo(t + i * negra, 0.7); k.bajo(r - 12 + (i % 2 ? 12 : 0), t + i * negra + negra / 2, negra * 0.4, 0.22); }
          k.palma(t + negra); k.palma(t + negra * 3);
          for (let i = 0; i < 8; i++) k.hat(t + i * negra / 2 + negra / 4, 0.07);
          if (c % 2 === 0 || c > 3) for (let i = 0; i < 8; i++) k.pluck(esc[mel[(c * 8 + i) % 16]], t + i * negra / 2, 0.12);
        }
      },
    },
  };
  const EFECTOS = {
    whoosh: { nombre: "Whoosh", dur: 0.9, hacer: (ctx, k, s) => { const n = k.ruido(0, 0.9, "bandpass", 300, 2); n.frequency.setValueAtTime(250, 0); n.frequency.exponentialRampToValueAtTime(4200, 0.45); n.frequency.exponentialRampToValueAtTime(300, 0.85); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.9, 0.42); g.gain.exponentialRampToValueAtTime(0.0001, 0.88); n.connect(g); g.connect(s); } },
    golpe: { nombre: "Golpe", dur: 2, hacer: (ctx, k, s) => { const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, 0); o.frequency.exponentialRampToValueAtTime(32, 0.6); const g = ctx.createGain(); k.env(g, 0, 0.005, 1, 1.4); o.connect(g); g.connect(s); o.start(0); o.stop(1.6); const n = k.ruido(0, 0.4, "lowpass", 900), g2 = ctx.createGain(); k.env(g2, 0, 0.002, 0.6, 0.35); n.connect(g2); g2.connect(s); k.platillo(0, 0.08); } },
    noticia: { nombre: "Campana de noticia", dur: 2.6, hacer: (ctx, k) => { k.campana(76, 0, 0.2); k.campana(81, 0.18, 0.2); k.campana(88, 0.36, 0.24, 2); } },
    ultimo: { nombre: "Sting último momento", dur: 2.6, hacer: (ctx, k) => { const a = [62, 65, 69]; k.metal(a, 0, 0.12, 0.18); k.metal(a, 0.2, 0.12, 0.18); k.metal(a.map((n) => n - 2), 0.42, 0.14, 1.4); k.bombo(0); k.bombo(0.2); k.bombo(0.42, 1); k.platillo(0.42, 0.18); } },
    redoble: { nombre: "Redoble y platillo", dur: 3.4, hacer: (ctx, k) => { for (let i = 0; i < 40; i++) k.caja(i * 0.04, 0.05 + 0.3 * (i / 40)); k.platillo(1.62, 0.35); k.bombo(1.62, 1); } },
    tictac: { nombre: "Reloj", dur: 4.1, hacer: (ctx, k) => { for (let i = 0; i < 8; i++) k.osc("square", i % 2 ? 1600 : 2100, i * 0.5, 0.02, 0.12, undefined, { corte: 4000 }); } },
    error: { nombre: "Error", dur: 0.9, hacer: (ctx, k) => { k.osc("square", 150, 0, 0.25, 0.22, undefined, { corte: 1200 }); k.osc("square", 110, 0.3, 0.45, 0.22, undefined, { corte: 1200 }); } },
    aviso: { nombre: "Notificación", dur: 0.8, hacer: (ctx, k) => { k.osc("sine", 1318, 0, 0.12, 0.3); k.osc("sine", 1760, 0.12, 0.35, 0.3); } },
    risa: { nombre: "Bocina de humor", dur: 1.4, hacer: (ctx, k) => { [0, 0.28, 0.56].forEach((t, i) => k.osc("sawtooth", [233, 220, 196][i], t, i === 2 ? 0.7 : 0.2, 0.18, undefined, { corte: 1600 })); } },
  };
  // Devuelve el medio (lo genera la primera vez).
  async function medio(tipo, clave) {
    const lista = tipo === "cortina" ? CORTINAS : EFECTOS, d = lista[clave]; if (!d) throw new Error("no existe " + clave);
    const mid = `m_${tipo === "cortina" ? "mus" : "sfx"}_${clave}`;
    return Medios.importarFijo(mid, async () => Mezcla.wav(await render(d.dur + (tipo === "cortina" ? 0.5 : 0.3), d.hacer, tipo === "cortina" ? 0.15 : 0.22)), (tipo === "cortina" ? "Música: " : "Efecto: ") + d.nombre + ".wav", { origen: tipo });
  }
  return { CORTINAS, EFECTOS, medio, render };
})();
