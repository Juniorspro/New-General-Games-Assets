"use strict";
// ════════════════════════════════════════════════════════════════════════
// Sonido con Web Audio. Lo que hay grabado (js/sonidos.js, generado desde
// sonidos/ con licencias CC0 y CC-BY) suena de verdad: motores, sirena, radio,
// chicharras, grillos, viento, tránsito, puertas, baúl, esposas, impresora,
// levantavidrios, bocina y pasos. Lo sintetizado queda de respaldo mientras se
// decodifica, y para lo que no tiene grabación (moto, bips, voces).
// ════════════════════════════════════════════════════════════════════════
const Sonido = (() => {
  let ctx = null, maestro = null, ruido = null, amb = {}, motor = null, sirena = null, vol = 0.8;
  const buf = {}, grupos = {}; let real = null, sirenaOn = false;
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
    decodificar();
  }
  // Las grabaciones vienen en base64 adentro de sonidos.js (el descargable anda desde file://).
  function decodificar() {
    if (typeof SONIDOS_B64 === "undefined") return;
    const pend = Object.entries(SONIDOS_B64).map(([id, b64]) => {
      const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new Promise((ok) => { try { const p = ctx.decodeAudioData(u.buffer, ok, () => ok(null)); if (p && p.catch) p.catch(() => ok(null)); } catch (e) { ok(null); } })
        .then((b) => { if (!b) return; buf[id] = b; const g = id.replace(/_\d+$/, ""); (grupos[g] = grupos[g] || []).push(b); });
    });
    Promise.all(pend).then(armarReales);
  }
  function lazo(id, v = 0, rate = 1) {
    if (!buf[id]) return null;
    const s = ctx.createBufferSource(); s.buffer = buf[id]; s.loop = true; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 20000;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null, g = ctx.createGain(); g.gain.value = v;
    s.connect(f); (p ? f.connect(p).connect(g) : f.connect(g)).connect(maestro); s.start(0, Math.random() * buf[id].duration);
    return { s, f, p, g };
  }
  // Una grabación suelta; si es un grupo (pasos_asfalto_1..5) elige una al azar.
  function muestra(id, { vol: v = 0.5, rate = 1, cuando = 0, desde = 0, dur } = {}) {
    const b = buf[id] || (grupos[id] && grupos[id][Math.floor(Math.random() * grupos[id].length)]);
    if (!ctx || !b) return false;
    const t = t0() + cuando, s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.playbackRate.value = rate;
    g.gain.setValueAtTime(v, t); if (dur) { g.gain.setValueAtTime(v, t + dur - 0.08); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    s.connect(g).connect(maestro); s.start(t, desde); if (dur) s.stop(t + dur + 0.02); return true;
  }
  // Con las grabaciones listas se apagan los bucles sintetizados que reemplazan.
  function armarReales() {
    const voz = () => ({ auto: lazo("motor_auto"), camion: lazo("motor_camion") });
    real = {
      chicharras: lazo("chicharras"), grillos: lazo("grillos"), viento: lazo("viento", 0.13), trafico: lazo("trafico_ruta", 0.05),
      sirena: lazo("sirena"), motores: [voz(), voz()],
    };
    for (const a of [amb.chicharra.g, amb.grillo, amb.viento.g, motor.gm, motor.rm.g, sirena.sg]) a.gain.setTargetAtTime(0, t0(), 0.3);
    Sonido.ambiente(ultimaNoche);
  }
  const t0 = () => ctx.currentTime;
  let ultimaNoche = 0;
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
    ambiente(noche) {
      if (!ctx) return; ultimaNoche = noche;
      if (real) { real.chicharras && real.chicharras.g.gain.setTargetAtTime(0.32 * (1 - noche) ** 2, t0(), 1); real.grillos && real.grillos.g.gain.setTargetAtTime(0.34 * noche, t0(), 1); return; }
      amb.chicharra.g.gain.setTargetAtTime(0.05 * (1 - noche), t0(), 1); amb.grillo.gain.setTargetAtTime(0.6 * noche, t0(), 1);
    },
    // Motores de los dos vehículos más cercanos: [{dist, vel, tipo ("auto"|"camion"|"moto"), pan}].
    // La moto no tiene grabación propia: es el motor de auto más agudo y más fino.
    motores(lista) {
      if (!ctx) return;
      if (!real) { const m = lista[0] || { dist: 999, vel: 0, tipo: "auto" }; return this.motor(m.dist, m.vel, m.tipo === "camion"); }
      real.motores.forEach((voz, i) => {
        const m = lista[i], k = m ? clamp(1 - m.dist / 90, 0, 1) ** 1.7 : 0, t = t0();
        const tipo = m ? m.tipo : "auto", vel = m ? m.vel : 0;
        for (const [clave, fuente] of Object.entries(voz)) {
          if (!fuente) continue;
          const usa = clave === "camion" ? tipo === "camion" : tipo !== "camion";
          const rate = tipo === "camion" ? 0.78 + vel / 45 : tipo === "moto" ? 1.55 + vel / 18 : 0.82 + vel / 32;
          fuente.s.playbackRate.setTargetAtTime(clamp(rate, 0.5, 2.6), t, 0.25);
          fuente.g.gain.setTargetAtTime(usa ? k * (tipo === "camion" ? 0.75 : tipo === "moto" ? 0.32 : 0.5) : 0, t, 0.15);
          fuente.f.frequency.setTargetAtTime(700 + 9000 * k, t, 0.2);
          if (fuente.p && m) fuente.p.pan.setTargetAtTime(clamp(m.pan, -1, 1) * 0.8, t, 0.1);
        }
      });
    },
    // Motor del vehículo más cercano: distancia en metros y velocidad en m/s (sintetizado).
    motor(dist, vel, camion) {
      if (!ctx) return; const k = clamp(1 - dist / 90, 0, 1) ** 1.6, rpm = (camion ? 32 : 45) + vel * (camion ? 3 : 5);
      motor.o1.frequency.setTargetAtTime(rpm, t0(), 0.2); motor.o2.frequency.setTargetAtTime(rpm * 0.5, t0(), 0.2);
      motor.gm.gain.setTargetAtTime(k * (camion ? 0.2 : 0.12), t0(), 0.15); motor.rm.g.gain.setTargetAtTime(k * clamp(vel / 20, 0, 1) * 0.25, t0(), 0.2);
      motor.fm.frequency.setTargetAtTime(250 + vel * 25, t0(), 0.2);
    },
    // La sirena del patrullero; dist en metros para que se oiga llegar.
    sirena(on, dist = 30) {
      if (!ctx) return; const cambia = on !== sirenaOn; sirenaOn = on;
      if (real && real.sirena) { real.sirena.g.gain.setTargetAtTime(on ? 0.45 * clamp(1 - dist / 260, 0.15, 1) : 0, t0(), 0.15); return; }
      sirena.sg.gain.setTargetAtTime(on ? 0.07 : 0, t0(), 0.1); if (on && cambia) { const t = t0(); for (let i = 0; i < 8; i++) { sirena.so.frequency.setValueAtTime(700, t + i * 0.9); sirena.so.frequency.linearRampToValueAtTime(1150, t + i * 0.9 + 0.45); sirena.so.frequency.linearRampToValueAtTime(700, t + i * 0.9 + 0.9); } }
    },
    // Radio: pip, un soplido de estática y el pip de cierre.
    radio() {
      if (muestra("radio_pip", { vol: 0.35 })) { muestra("radio_estatica", { vol: 0.2, cuando: 0.18, desde: Math.random() * 3, dur: 0.75 }); muestra("radio_pip", { vol: 0.25, rate: 0.8, cuando: 0.95 }); return; }
      golpe(3000, 1500, 0.18, 0.12, "bandpass"); tono(1850, 0.08, { tipo: "square", vol: 0.05, cuando: 0.2 });
    },
    bip(agudo = true) { tono(agudo ? 2200 : 900, agudo ? 0.07 : 0.5, { tipo: "square", vol: 0.06 }); },
    esposas() { if (muestra("esposas", { vol: 0.7 })) return; tono(2600, 0.05, { tipo: "square", vol: 0.08 }); golpe(6000, 3000, 0.08, 0.2, "highpass", 0.06); tono(2400, 0.05, { tipo: "square", vol: 0.08, cuando: 0.2 }); golpe(6000, 3000, 0.08, 0.2, "highpass", 0.26); },
    baul() { if (!muestra("baul", { vol: 0.8 })) golpe(500, 80, 0.3, 0.4); },
    puerta(dist = 3) { if (!muestra("puerta_auto", { vol: 0.8 * clamp(1 - dist / 60, 0.1, 1), rate: 0.95 + Math.random() * 0.1 })) golpe(900, 100, 0.25, 0.45); },
    bocina(dist = 10) { if (!muestra("bocina", { vol: 0.6 * clamp(1 - dist / 120, 0.1, 1) })) tono(420, 0.4, { tipo: "square", vol: 0.05 }); },
    impresora() { if (muestra("impresora", { vol: 0.45 })) return; for (let i = 0; i < 14; i++) golpe(3000, 2500, 0.05, 0.08, "bandpass", i * 0.07); },
    // Pasos: asfalto sobre la calzada; tierra y ripio en la banquina y la playa.
    paso(ripio) { if (!muestra(ripio ? "pasos_ripio" : "pasos_asfalto", { vol: ripio ? 0.3 : 0.45, rate: 0.9 + Math.random() * 0.2 })) golpe(700 + Math.random() * 300, 250, 0.08, 0.07, "bandpass"); },
    hallazgo() { tono(660, 0.12, { tipo: "square", vol: 0.08 }); tono(880, 0.12, { tipo: "square", vol: 0.08, cuando: 0.12 }); tono(1320, 0.3, { tipo: "square", vol: 0.08, cuando: 0.24 }); },
    bien() { tono(880, 0.1, { vol: 0.08 }); tono(1320, 0.18, { vol: 0.08, cuando: 0.1 }); },
    mal() { tono(300, 0.2, { tipo: "sawtooth", vol: 0.06 }); tono(200, 0.3, { tipo: "sawtooth", vol: 0.06, cuando: 0.18 }); },
    // Motorcito del levantavidrios eléctrico.
    levantavidrios() { if (!ctx || muestra("levantavidrios", { vol: 0.35, dur: 1.45 })) return; const t = t0(), o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = "sawtooth"; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(120, t + 1.3); f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.05); g.gain.setValueAtTime(0.05, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); o.connect(f).connect(g).connect(maestro); o.start(t); o.stop(t + 1.45); },
    // Para la prueba: cuántas grabaciones se decodificaron.
    estado() { return { contexto: !!ctx, grabaciones: Object.keys(buf).length, reales: !!real }; },
    clic() { tono(1200, 0.03, { tipo: "triangle", vol: 0.05 }); },
  };
})();
