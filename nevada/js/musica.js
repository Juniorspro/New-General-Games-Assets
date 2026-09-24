/* ============================================================================
   nevada/js/musica.js — el sonido, todo sintetizado en el momento (no hay un
   solo archivo de audio): un phonk original a 120 BPM en fa menor —el cencerro
   con eco que es la marca del género, 808 con glide, bombo, clap y hi-hats— y
   los efectos de la cinemática: viento, pisadas en la nieve, los zumbidos de
   las transiciones, el rugido y el motor que se aleja.
   No es la canción del video de referencia ni la imita nota por nota: es un
   tema propio con la misma energía.
   Se programa todo junto al darle play, con el reloj del audio, así cae justo
   en los cortes aunque el cuadro se atrase.
   ========================================================================== */
const BPM = 120, T = 60 / BPM, S = T / 4;   // un tiempo = 0,5 s; una semicorchea = 0,125 s
const nota = (n) => 440 * Math.pow(2, (n - 69) / 12);
// fa menor: F4=65
const F = 53, Ab = 56, C = 60, Db = 61, Eb = 63;

export function crearMusica() {
  let ctx = null, maestro, reverb, eco, ecoFb, seco, ruidoBuf, t0 = 0, fuentes = [], activo = false;
  let volumen = 0.62;

  function armar() {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return false;
    ctx = new A();
    maestro = ctx.createGain(); maestro.gain.value = volumen;
    /* la cadena del final: se saca la continua (nada la debería traer, pero
       por las dudas), se comprime el conjunto y un limitador deja los picos
       abajo de 0 dB, que si no el golpe del drop satura */
    const sinDC = ctx.createBiquadFilter(); sinDC.type = 'highpass'; sinDC.frequency.value = 22; sinDC.Q.value = 0.7;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.18;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    const salida = ctx.createGain(); salida.gain.value = 0.78;
    maestro.connect(sinDC); sinDC.connect(comp); comp.connect(lim); lim.connect(salida); salida.connect(ctx.destination);
    seco = ctx.createGain(); seco.connect(maestro);
    // reverb: una sala larga hecha con ruido que se apaga (el "slowed + reverb")
    const n = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.8); }
    reverb = ctx.createConvolver(); reverb.buffer = ir;
    const rv = ctx.createGain(); rv.gain.value = 0.5; reverb.connect(rv); rv.connect(maestro);
    // eco de corchea con puntillo, filtrado: el del cencerro
    eco = ctx.createDelay(1); eco.delayTime.value = S * 3;
    ecoFb = ctx.createGain(); ecoFb.gain.value = 0.38;
    const ecoF = ctx.createBiquadFilter(); ecoF.type = 'bandpass'; ecoF.frequency.value = 1400; ecoF.Q.value = 0.7;
    eco.connect(ecoF); ecoF.connect(ecoFb); ecoFb.connect(eco); ecoF.connect(maestro); ecoF.connect(reverb);
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  const guarda = (x) => { fuentes.push(x); return x; };
  /* OJO: todo se programa de una al darle play, así que cada nota existe desde
     el principio aunque suene a los 15 s. Una ganancia vale 1 hasta su primer
     evento: arranca en 0, que si no deja pasar lo que haya antes de la nota */
  const ganancia = () => { const g = ctx.createGain(); g.gain.value = 0; return g; };
  function env(g, t, a, pico, dec, fin = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pico, t + a); g.gain.exponentialRampToValueAtTime(fin, t + a + dec); }
  function ruido(t, dur) { const s = guarda(ctx.createBufferSource()); s.buffer = ruidoBuf; s.loop = true; s.start(t, Math.random()); s.stop(t + dur + 0.05); return s; }
  /* la curva tiene que dar 0 justo con entrada 0 (cantidad impar de puntos):
     con 1024 daba −0,002 en el silencio, y con veinte 808 esperando su turno
     eso era una continua de −0,04 en toda la intro */
  const saturar = (k) => { const w = ctx.createWaveShaper(), c = new Float32Array(1025); for (let i = 0; i < 1025; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * k); } w.curve = c; return w; };

  /* ---------------- instrumentos ---------------- */
  function cencerro(t, n, v = 1, filtro = 6000) {
    const f = nota(n + 12);
    const g = ganancia(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 1.9; bp.Q.value = 1.4;
    lp.type = 'lowpass'; lp.frequency.value = filtro;
    for (const k of [1, 1.504]) { const o = guarda(ctx.createOscillator()); o.type = 'square'; o.frequency.value = f * k; o.connect(bp); o.start(t); o.stop(t + 0.4); }
    bp.connect(lp); lp.connect(g);
    env(g, t, 0.003, 0.22 * v, 0.2);
    g.connect(seco); g.connect(eco); g.connect(reverb);
  }
  function ochoOcho(t, n, dur, v = 1, glideA) {
    const o = guarda(ctx.createOscillator()), g = ganancia(), sat = saturar(2.4), lp = ctx.createBiquadFilter();
    o.type = 'sine';
    o.frequency.setValueAtTime(nota(n) * 2, t); o.frequency.exponentialRampToValueAtTime(nota(n), t + 0.04);
    if (glideA) o.frequency.exponentialRampToValueAtTime(nota(glideA), t + dur * 0.9);
    lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(sat); sat.connect(lp); lp.connect(g); g.connect(seco);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.01); g.gain.setTargetAtTime(0.25 * v, t + 0.05, dur * 0.5); g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    o.start(t); o.stop(t + dur + 0.4);
  }
  function bombo(t, v = 1) {
    const o = guarda(ctx.createOscillator()), g = ganancia();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    o.connect(g); g.connect(seco); env(g, t, 0.002, 0.9 * v, 0.32);
    o.start(t); o.stop(t + 0.4);
  }
  function clap(t, v = 1) {
    const g = ganancia(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
    const s = ruido(t, 0.3); s.connect(bp); bp.connect(g); g.connect(seco); g.connect(reverb);
    g.gain.setValueAtTime(0.0001, t);
    for (const [dt, a] of [[0, 0.5], [0.011, 0.4], [0.023, 0.55]]) { g.gain.setValueAtTime(a * v, t + dt); g.gain.exponentialRampToValueAtTime(0.05 * v, t + dt + 0.01); }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  }
  function hat(t, v = 1, largo = 0.04) {
    const g = ganancia(), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const s = ruido(t, largo + 0.02); s.connect(hp); hp.connect(g); g.connect(seco);
    env(g, t, 0.001, 0.13 * v, largo);
  }
  /* ---------------- efectos ---------------- */
  function zumbido(t, dur = 0.45, v = 1, sube = true) {
    const g = ganancia(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3;
    bp.frequency.setValueAtTime(sube ? 250 : 3500, t); bp.frequency.exponentialRampToValueAtTime(sube ? 3800 : 260, t + dur);
    const s = ruido(t, dur); s.connect(bp); bp.connect(g); g.connect(seco); g.connect(reverb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function subida(t, dur) {
    const g = ganancia(), hp = ctx.createBiquadFilter(); hp.type = 'highpass';
    hp.frequency.setValueAtTime(300, t); hp.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const s = ruido(t, dur); s.connect(hp); hp.connect(g); g.connect(seco); g.connect(reverb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.95); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    const o = guarda(ctx.createOscillator()), go = ganancia(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    o.connect(lp); lp.connect(go); go.connect(seco); go.connect(reverb);
    go.gain.setValueAtTime(0.0001, t); go.gain.exponentialRampToValueAtTime(0.06, t + dur * 0.95); go.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function rugido(t) {
    const dur = 1.25;
    // el cuerpo: una sierra grave que sube y baja, temblando a 27 Hz
    const o = guarda(ctx.createOscillator()); o.type = 'sawtooth';
    o.frequency.setValueAtTime(62, t); o.frequency.linearRampToValueAtTime(118, t + 0.28); o.frequency.linearRampToValueAtTime(92, t + 0.8); o.frequency.linearRampToValueAtTime(55, t + dur);
    const am = guarda(ctx.createOscillator()), amg = ctx.createGain(); am.frequency.value = 27; amg.gain.value = 0.45;
    const g = ctx.createGain(); g.gain.value = 0;
    am.connect(amg); amg.connect(g.gain);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(1500, t + 0.3); lp.frequency.linearRampToValueAtTime(600, t + dur);
    const sat = saturar(3);
    o.connect(sat); sat.connect(lp); lp.connect(g);
    const ge = ganancia(); g.connect(ge); ge.connect(seco); ge.connect(reverb);
    ge.gain.setValueAtTime(0.0001, t); ge.gain.exponentialRampToValueAtTime(0.9, t + 0.07); ge.gain.setTargetAtTime(0.5, t + 0.35, 0.3); ge.gain.setTargetAtTime(0.0001, t + dur - 0.2, 0.12);
    o.start(t); o.stop(t + dur + 0.5); am.start(t); am.stop(t + dur + 0.5);
    // el aire: ruido por dos formantes que se abren (la "a" del rugido)
    for (const [f0, f1, q, v] of [[450, 850, 3, 0.6], [1100, 1700, 4, 0.35]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + 0.35); bp.frequency.linearRampToValueAtTime(f0 * 0.8, t + dur);
      const gn = ganancia(); const s = ruido(t, dur);
      s.connect(bp); bp.connect(gn); gn.connect(seco); gn.connect(reverb);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v, t + 0.08); gn.gain.setTargetAtTime(0.0001, t + dur - 0.25, 0.15);
    }
    bombo(t, 1.2);
  }
  function pisada(t, v = 0.5) {
    const g = ganancia(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 + Math.random() * 500; bp.Q.value = 0.6;
    const s = ruido(t, 0.16); s.connect(bp); bp.connect(g); g.connect(seco);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  }
  function viento(t, dur) {
    const g = ganancia(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.5;
    const lfo = guarda(ctx.createOscillator()), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t); lfo.stop(t + dur);
    const s = ruido(t, dur); s.connect(bp); bp.connect(g); g.connect(maestro);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 1.5); g.gain.setValueAtTime(0.06, t + dur - 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function motor(t, dur) {
    const g = ganancia(), lp = ctx.createBiquadFilter(), sat = saturar(2);
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    const base = [], rpm = (x) => (x < 0.45 ? 70 + x / 0.45 * 95 : 105 + (x - 0.45) / 0.55 * 85);
    for (const k of [1, 2, 3.02]) {
      const o = guarda(ctx.createOscillator()); o.type = k === 1 ? 'sawtooth' : 'square';
      for (let i = 0; i <= 20; i++) { const x = i / 20; o.frequency.setValueAtTime(rpm(x) * k, t + x * dur); }
      const gk = ctx.createGain(); gk.gain.value = k === 1 ? 0.5 : 0.12; o.connect(gk); gk.connect(sat);
      o.start(t); o.stop(t + dur + 0.2); base.push(o);
    }
    sat.connect(lp); lp.connect(g); g.connect(seco); g.connect(reverb);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.25); g.gain.setTargetAtTime(0.1, t + dur * 0.55, dur * 0.3); g.gain.setTargetAtTime(0.0001, t + dur, 0.3);
    // petardeos del escape al cambiar
    for (const dt of [dur * 0.45, dur * 0.47, dur * 0.52]) { const gp = ganancia(), s = ruido(t + dt, 0.05), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; s.connect(bp); bp.connect(gp); gp.connect(seco); env(gp, t + dt, 0.002, 0.35, 0.04); }
  }

  /* ---------------- la partitura ---------------- */
  // el riff del cencerro, en semicorcheas (dos compases = 32): [paso, nota]
  const RIFF = [[0, F], [2, Ab], [4, C], [6, Ab], [7, F], [8, Eb], [10, F], [12, Ab], [14, C],
    [16, Db], [18, C], [20, Ab], [22, F], [24, Eb], [26, C], [28, Eb], [30, F]];
  const BAJOS = [[0, F, 8], [8, Eb, 8, F], [16, Db, 8], [24, Eb, 6, C], [30, C, 2]];

  function programar(desde) {
    const ahora = ctx.currentTime + 0.08;
    t0 = ahora - desde;
    const en = (s) => t0 + s;           // segundo de la cinemática → reloj del audio
    const vale = (s) => en(s) >= ahora - 0.001;
    const compases = Math.ceil(18.5 / (T * 8)) + 1;
    viento(Math.max(ahora, en(0)), Math.max(1, 18.5 - Math.max(0, desde)));
    for (let c = 0; c < compases; c++) {
      const base = c * T * 8;     // cada vuelta del riff: 2 compases = 4 s
      for (const [p, n] of RIFF) {
        const s = base + p * S;
        if (s >= 16.5 || (s >= 9.5 && s < 10.5) || !vale(s)) continue;
        const intro = s < 3;
        cencerro(en(s), n, intro ? 1.25 : 1, intro ? 1500 + s * 1800 : 7000);
      }
      for (const [p, n, dur, glide] of BAJOS) {
        const s = base + p * S;
        if (s < 3 || s >= 16.5 || (s >= 9.5 && s < 10.5) || !vale(s)) continue;
        ochoOcho(en(s), n - 24, dur * S, 1, glide ? glide - 24 : undefined);
      }
      for (let k = 0; k < 32; k++) {
        const s = base + k * S;
        if (s < 3 || s >= 16.5 || (s >= 9.5 && s < 10.5) || !vale(s)) continue;
        if (k % 16 === 0 || k % 16 === 10) bombo(en(s));
        if (k % 8 === 4) clap(en(s));
        if (k % 2 === 0) hat(en(s), k % 4 === 0 ? 0.7 : 1);
        if ((k % 16 === 13 || k % 16 === 15) && s > 5) { hat(en(s + S / 3), 0.6); hat(en(s + (2 * S) / 3), 0.6); }   // tresillos
      }
    }
    // el final: un golpe de 808 largo con el cencerro que se va en eco
    if (vale(16.5)) { ochoOcho(en(16.5), F - 24, 1.6, 1.1); cencerro(en(16.5), F, 1); bombo(en(16.5), 1.2); }
    // efectos
    if (vale(1.2)) subida(en(Math.max(desde, 1.2)), 3 - Math.max(desde, 1.2));
    for (const [s, sube] of [[2.75, true], [4.8, true], [7.0, true], [10.55, true], [11.0, false]]) if (vale(s)) zumbido(en(s), 0.42, 1, sube);
    if (vale(9.5)) rugido(en(9.5));
    for (let s = 3.1; s < 4.5; s += 0.38) if (vale(s)) pisada(en(s), 0.6);
    if (vale(13.0)) motor(en(13.0), 4.4);
  }

  return {
    get t0() { return t0; }, get ctx() { return ctx; },
    /** arranca desde el segundo `desde` de la cinemática */
    async iniciar(desde = 0) {
      if (!ctx && !armar()) return false;
      if (ctx.state !== 'running') await ctx.resume();
      this.parar();
      activo = true;
      programar(desde);
      return true;
    },
    parar() { for (const s of fuentes) { try { s.stop(); } catch (_) {} } fuentes = []; activo = false; },
    volumen(v) { volumen = v; if (maestro) maestro.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    /** el segundo de la cinemática según el reloj del audio (el que manda cuando suena) */
    tiempo() { return ctx && activo ? ctx.currentTime - t0 : null; },
  };
}
