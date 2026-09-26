"use strict";
// ════════════════════════════════════════════════════════════════════════
// Sonido: todo sintetizado con Web Audio. Chicharras de tarde, grillos de
// noche, motores que se acercan, la radio de la central, la sirena, el
// alcoholímetro, las esposas y las voces (murmullo; el borracho, arrastrado).
// ════════════════════════════════════════════════════════════════════════
const Sonido = (() => {
  let ctx = null, maestro = null, ruido = null, amb = {}, motor = null, sirena = null, vol = 0.8;
  function bucle(tipo, frec, q, ganancia = 0) {
    const s = ctx.createBufferSource(); s.buffer = ruido; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = frec; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = ganancia; s.connect(f).connect(g).connect(maestro); s.start(Math.random()); return { g, f };
  }
  function iniciar() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    maestro = ctx.createGain(); maestro.gain.value = 0.7 * vol;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; maestro.connect(comp).connect(ctx.destination);
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Chicharras: ruido agudo con un temblor rápido.
    amb.chicharra = bucle("bandpass", 5200, 8);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 22; lg.gain.value = 0.5; lfo.connect(lg).connect(amb.chicharra.g.gain); lfo.start();
    amb.viento = bucle("lowpass", 380, 0, 0.05);
    // Grillos: un pulso de 4 kHz que se repite.
    amb.grillo = ctx.createGain(); amb.grillo.gain.value = 0; amb.grillo.connect(maestro);
    const osc = ctx.createOscillator(); osc.frequency.value = 4300; const pulso = ctx.createGain(); pulso.gain.value = 0; osc.connect(pulso).connect(amb.grillo); osc.start();
    const lfo2 = ctx.createOscillator(); lfo2.type = "square"; lfo2.frequency.value = 18; const lg2 = ctx.createGain(); lg2.gain.value = 0.05; lfo2.connect(lg2).connect(pulso.gain); lfo2.start();
    // Motor: un solo motor "cercano" que sigue al vehículo más próximo.
    const o1 = ctx.createOscillator(); o1.type = "sawtooth"; const o2 = ctx.createOscillator(); o2.type = "square";
    const fm = ctx.createBiquadFilter(); fm.type = "lowpass"; fm.frequency.value = 400; const gm = ctx.createGain(); gm.gain.value = 0;
    o1.connect(fm); o2.connect(fm); fm.connect(gm).connect(maestro); o1.start(); o2.start();
    const rm = bucle("lowpass", 600, 0, 0); motor = { o1, o2, fm, gm, rm };
    // Sirena.
    const so = ctx.createOscillator(); so.type = "triangle"; const sg = ctx.createGain(); sg.gain.value = 0; so.connect(sg).connect(maestro); so.start(); sirena = { so, sg };
  }
  const t0 = () => ctx.currentTime;
  function tono(frec, dur, { tipo = "sine", vol: v = 0.15, hasta, cuando = 0 } = {}) {
    if (!ctx) return; const t = t0() + cuando, o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo;
    o.frequency.setValueAtTime(frec, t); if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(maestro); o.start(t); o.stop(t + dur + 0.05);
  }
  function golpe(desde, hasta, dur, v = 0.3, tipo = "lowpass", cuando = 0) {
    if (!ctx) return; const t = t0() + cuando, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = tipo; f.frequency.setValueAtTime(desde, t); f.frequency.exponentialRampToValueAtTime(hasta, t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(maestro); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  // Voz: sílabas cortas con la entonación del texto. El borracho, grave y arrastrado.
  function voz(texto, { mujer = false, borracho = false, nervioso = false } = {}) {
    if (!ctx) return 0;
    const silabas = clamp(Math.round(texto.length / 3.2), 3, 34), dur = borracho ? 0.17 : nervioso ? 0.085 : 0.11, base = mujer ? 215 : 120;
    for (let i = 0; i < silabas; i++) {
      const t = t0() + i * dur, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      const fr = base * (0.88 + Math.random() * 0.3) * (i === silabas - 1 && texto.includes("?") ? 1.25 : 1) * (borracho ? 0.82 : 1);
      o.type = "sawtooth"; o2.type = "sine"; o.frequency.setValueAtTime(fr, t); o2.frequency.setValueAtTime(fr * 2, t);
      if (borracho) o.frequency.linearRampToValueAtTime(fr * 0.8, t + dur);
      f.type = "bandpass"; f.frequency.value = 600 + Math.random() * 1400; f.Q.value = 1.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);
      o.connect(f); o2.connect(f); f.connect(g).connect(maestro); o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
    }
    return silabas * dur;
  }
  return {
    iniciar, voz, tono,
    ponerVolumen(v) { vol = v; if (maestro) maestro.gain.value = 0.7 * v; },
    // noche: 0 = tarde (chicharras), 1 = noche (grillos)
    ambiente(noche) { if (!ctx) return; amb.chicharra.g.gain.setTargetAtTime(0.05 * (1 - noche), t0(), 1); amb.grillo.gain.setTargetAtTime(0.6 * noche, t0(), 1); },
    // Motor del vehículo más cercano: distancia en metros y velocidad en m/s.
    motor(dist, vel, camion) {
      if (!ctx) return; const k = clamp(1 - dist / 90, 0, 1) ** 1.6, rpm = (camion ? 32 : 45) + vel * (camion ? 3 : 5);
      motor.o1.frequency.setTargetAtTime(rpm, t0(), 0.2); motor.o2.frequency.setTargetAtTime(rpm * 0.5, t0(), 0.2);
      motor.gm.gain.setTargetAtTime(k * (camion ? 0.2 : 0.12), t0(), 0.15); motor.rm.g.gain.setTargetAtTime(k * clamp(vel / 20, 0, 1) * 0.25, t0(), 0.2);
      motor.fm.frequency.setTargetAtTime(250 + vel * 25, t0(), 0.2);
    },
    sirena(on) { if (!ctx) return; sirena.sg.gain.setTargetAtTime(on ? 0.07 : 0, t0(), 0.1); if (on) { const t = t0(); for (let i = 0; i < 8; i++) { sirena.so.frequency.setValueAtTime(700, t + i * 0.9); sirena.so.frequency.linearRampToValueAtTime(1150, t + i * 0.9 + 0.45); sirena.so.frequency.linearRampToValueAtTime(700, t + i * 0.9 + 0.9); } } },
    radio() { golpe(3000, 1500, 0.18, 0.12, "bandpass"); tono(1850, 0.08, { tipo: "square", vol: 0.05, cuando: 0.2 }); },
    bip(agudo = true) { tono(agudo ? 2200 : 900, agudo ? 0.07 : 0.5, { tipo: "square", vol: 0.06 }); },
    esposas() { tono(2600, 0.05, { tipo: "square", vol: 0.08 }); golpe(6000, 3000, 0.08, 0.2, "highpass", 0.06); tono(2400, 0.05, { tipo: "square", vol: 0.08, cuando: 0.2 }); golpe(6000, 3000, 0.08, 0.2, "highpass", 0.26); },
    baul() { golpe(500, 80, 0.3, 0.4); },
    puerta() { golpe(900, 100, 0.25, 0.45); },
    impresora() { for (let i = 0; i < 14; i++) golpe(3000, 2500, 0.05, 0.08, "bandpass", i * 0.07); },
    paso() { golpe(700 + Math.random() * 300, 250, 0.08, 0.07, "bandpass"); },
    hallazgo() { tono(660, 0.12, { tipo: "square", vol: 0.08 }); tono(880, 0.12, { tipo: "square", vol: 0.08, cuando: 0.12 }); tono(1320, 0.3, { tipo: "square", vol: 0.08, cuando: 0.24 }); },
    bien() { tono(880, 0.1, { vol: 0.08 }); tono(1320, 0.18, { vol: 0.08, cuando: 0.1 }); },
    mal() { tono(300, 0.2, { tipo: "sawtooth", vol: 0.06 }); tono(200, 0.3, { tipo: "sawtooth", vol: 0.06, cuando: 0.18 }); },
    clic() { tono(1200, 0.03, { tipo: "triangle", vol: 0.05 }); },
  };
})();
