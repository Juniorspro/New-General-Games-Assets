"use strict";
// ════════════════════════════════════════════════════════════════════════
// Sonido: todo sintetizado con Web Audio (no hay archivos que bajar).
// ════════════════════════════════════════════════════════════════════════
const Sonido = (() => {
  let ctx = null, maestro = null, ruido = null, lazos = {}, volumen = 0.8;
  function bucleRuido(tipo, frec, q) {
    const s = ctx.createBufferSource(); s.buffer = ruido; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = frec; if (q) f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(maestro); s.start(); return g;
  }
  function iniciar() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    maestro = ctx.createGain(); maestro.gain.value = 0.6 * volumen;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    maestro.connect(comp).connect(ctx.destination);
    ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    lazos.tormenta = bucleRuido("lowpass", 240);
    lazos.viento = bucleRuido("bandpass", 700, 0.6);
    lazos.motor = bucleRuido("lowpass", 120);
    // El zumbido de los cofres: un acorde que titila, más fuerte cuanto más cerca.
    lazos.cofre = ctx.createGain(); lazos.cofre.gain.value = 0; lazos.cofre.connect(maestro);
    const trem = ctx.createGain(); trem.gain.value = 0.5; trem.connect(lazos.cofre);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 7; lfoG.gain.value = 0.5; lfo.connect(lfoG).connect(trem.gain); lfo.start();
    for (const f of [880, 1108.7, 1318.5]) { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g).connect(trem); o.start(); }
  }
  const salida = (vol, pan) => {
    const g = ctx.createGain(); g.gain.value = vol;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(pan || 0, -1, 1); g.connect(p).connect(maestro); } else g.connect(maestro);
    return g;
  };
  function golpeRuido(t, sal, { tipo = "lowpass", desde = 2400, hasta = 300, dur = 0.3, vol = 0.4, q }) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = tipo; f.frequency.setValueAtTime(desde, t); f.frequency.exponentialRampToValueAtTime(hasta, t + dur); if (q) f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sal); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  function tono(t, sal, { tipo = "sine", desde, hasta, dur, vol }) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo;
    o.frequency.setValueAtTime(desde, t); o.frequency.exponentialRampToValueAtTime(hasta || desde, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sal); o.start(t); o.stop(t + dur + 0.02);
  }
  // Un disparo según el arma; vol y pan dicen qué tan lejos y de qué lado.
  function disparo(arma, vol = 1, pan = 0) {
    if (!ctx || vol < 0.02) return;
    const t = ctx.currentTime, s = salida(vol, pan);
    if (arma === "rifle") { golpeRuido(t, s, { desde: 5000, hasta: 500, dur: 0.16, vol: 0.4 }); tono(t, s, { desde: 180, hasta: 60, dur: 0.12, vol: 0.3 }); }
    else if (arma === "escopeta") { golpeRuido(t, s, { desde: 3000, hasta: 200, dur: 0.45, vol: 0.55 }); tono(t, s, { desde: 110, hasta: 38, dur: 0.3, vol: 0.45 }); golpeRuido(t + 0.35, s, { tipo: "bandpass", desde: 1800, hasta: 900, dur: 0.08, vol: 0.12, q: 4 }); }
    else if (arma === "subfusil") { golpeRuido(t, s, { tipo: "highpass", desde: 2500, hasta: 1500, dur: 0.07, vol: 0.28 }); tono(t, s, { tipo: "square", desde: 700, hasta: 200, dur: 0.05, vol: 0.05 }); }
    else if (arma === "pistola") { golpeRuido(t, s, { desde: 4000, hasta: 600, dur: 0.12, vol: 0.32 }); tono(t, s, { desde: 260, hasta: 90, dur: 0.08, vol: 0.2 }); }
    else if (arma === "francotirador") { golpeRuido(t, s, { desde: 6000, hasta: 180, dur: 0.9, vol: 0.6 }); tono(t, s, { desde: 90, hasta: 30, dur: 0.5, vol: 0.5 }); golpeRuido(t + 0.25, s, { desde: 1200, hasta: 200, dur: 0.8, vol: 0.12 }); }
  }
  function pico(material) {
    if (!ctx) return;
    const t = ctx.currentTime, s = salida(0.9, 0);
    if (material === "madera") { tono(t, s, { tipo: "triangle", desde: 220, hasta: 110, dur: 0.12, vol: 0.3 }); golpeRuido(t, s, { tipo: "bandpass", desde: 900, hasta: 400, dur: 0.1, vol: 0.2, q: 2 }); }
    else if (material === "piedra") { golpeRuido(t, s, { tipo: "highpass", desde: 3000, hasta: 1200, dur: 0.12, vol: 0.3 }); tono(t, s, { desde: 1500, hasta: 900, dur: 0.1, vol: 0.06 }); }
    else if (material === "metal") { for (const f of [820, 1370, 2140]) tono(t, s, { desde: f, hasta: f * 0.98, dur: 0.5, vol: 0.07 }); golpeRuido(t, s, { tipo: "highpass", desde: 4000, hasta: 2000, dur: 0.06, vol: 0.2 }); }
    else golpeRuido(t, s, { desde: 800, hasta: 200, dur: 0.1, vol: 0.2 });
  }
  function construir(material, vol = 1) {
    if (!ctx) return;
    const t = ctx.currentTime, s = salida(vol, 0), f = material === "metal" ? 520 : material === "piedra" ? 300 : 200;
    for (let k = 0; k < 2; k++) tono(t + k * 0.07, s, { tipo: "triangle", desde: f * (k ? 0.8 : 1), hasta: f * 0.5, dur: 0.1, vol: 0.2 });
    golpeRuido(t, s, { tipo: "bandpass", desde: f * 4, hasta: f * 2, dur: 0.12, vol: 0.12, q: 2 });
  }
  function notas(lista, tipo = "sine", vol = 0.12, largo = 0.14) {
    if (!ctx) return;
    lista.forEach((f, i) => { const t = ctx.currentTime + i * largo * 0.8; tono(t, maestro, { tipo, desde: f, dur: largo * 1.6, vol }); });
  }
  function paso(vol = 1, pan = 0, agua = false) {
    if (!ctx || vol < 0.02) return;
    const t = ctx.currentTime;
    golpeRuido(t, salida(vol, pan), agua ? { tipo: "bandpass", desde: 1400, hasta: 600, dur: 0.18, vol: 0.12, q: 1 } : { tipo: "bandpass", desde: 420 + Math.random() * 200, hasta: 300, dur: 0.07, vol: 0.12, q: 1.2 });
  }
  const aTono = (g, v, tt = 0.2) => { if (g && ctx) g.gain.setTargetAtTime(v, ctx.currentTime, tt); };
  return {
    iniciar, disparo, pico, construir, paso, notas,
    ponerVolumen(v) { volumen = v; if (maestro) maestro.gain.value = 0.6 * v; },
    acierto: (escudo, cabeza) => notas(cabeza ? [1760, 2350] : escudo ? [1250] : [1500], escudo ? "triangle" : "sine", 0.06, 0.04),
    golpe: () => notas([170, 110], "sawtooth", 0.1, 0.06),
    escudoRoto: () => notas([1200, 800, 500], "triangle", 0.08, 0.05),
    cofre: () => notas([523, 659, 784, 1047, 1319], "triangle", 0.12, 0.09),
    recoger: () => notas([660, 990], "triangle", 0.07, 0.05),
    eliminado: () => notas([988, 1319, 1976], "square", 0.05, 0.07),
    recarga: () => notas([300, 420], "square", 0.05, 0.05),
    cura: () => notas([523, 784], "sine", 0.06, 0.12),
    boton: () => notas([700], "triangle", 0.05, 0.03),
    salto: () => notas([300, 450], "sine", 0.04, 0.05),
    caida: () => { if (ctx) golpeRuido(ctx.currentTime, maestro, { desde: 600, hasta: 80, dur: 0.3, vol: 0.4 }); },
    victoria: () => notas([523, 523, 659, 784, 659, 784, 1047], "triangle", 0.16, 0.16),
    derrota: () => notas([392, 330, 262, 196], "sawtooth", 0.08, 0.2),
    tormenta: (k) => aTono(lazos.tormenta, k * 0.35),
    viento: (k) => aTono(lazos.viento, k * 0.22),
    motor: (k) => aTono(lazos.motor, k * 0.3),
    zumbidoCofre: (k) => aTono(lazos.cofre, k * 0.5, 0.1),
  };
})();
