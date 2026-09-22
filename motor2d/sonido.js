/* ============================================================================
   motor2d/sonido.js — todo el sonido sale de osciladores y ruido: cero archivos.
   Instrumentos (pulsada por Karplus-Strong, flauta, bajo, parche, campana,
   percusión), un secuenciador que programa con adelanto y un bus de efectos.
   El AudioContext se crea en el primer toque: antes, el navegador no deja sonar.
   ========================================================================== */

const NOTAS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function midiDe(nota) {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(nota);
  if (!m) return null;
  return 12 * (+m[2] + 1) + NOTAS[m[1]];
}
const frecDe = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const Sonido = {
  ac: null, maestro: null, bMus: null, bFx: null, eco: null, ruido: null,
  volMusica: 0.7, volEfectos: 0.9,
  temas: Object.create(null),       // nombre → canción (las pone el juego)
  recetas: Object.create(null),     // nombre → function(S, t, o) (las pone el juego)
  sonando: null, temaNombre: '', paso: 0, tSig: 0,
  ultimos: Object.create(null),
  cacheKS: new Map(),
  amb: null,

  arrancar() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = this.ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.connect(ac.destination);
    this.maestro = this.ganancia(0.85, comp);
    this.bMus = this.ganancia(this.volMusica, this.maestro);
    this.bFx = this.ganancia(this.volEfectos, this.maestro);
    /* un solo eco para todo: lo lejano suena lejos y la música respira */
    const conv = ac.createConvolver();
    conv.buffer = this.respuesta(2.6);
    this.eco = this.ganancia(0.32, this.maestro);
    conv.connect(this.eco);
    this.envioEco = conv;
    const n = ac.sampleRate * 2, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.ruido = b;
    setInterval(() => this.programar(), 25);
    if (this.temaPedido) this.musica(this.temaPedido);
    if (this.ambPedido) this.ambiente(this.ambPedido);
  },

  ganancia(v, destino) {
    const g = this.ac.createGain();
    g.gain.value = v;
    if (destino) g.connect(destino);
    return g;
  },
  respuesta(seg) {
    const ac = this.ac, n = Math.floor(ac.sampleRate * seg), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
    }
    return b;
  },
  volumenes(musica, efectos) {
    this.volMusica = musica; this.volEfectos = efectos;
    if (!this.ac) return;
    this.bMus.gain.setTargetAtTime(musica, this.ac.currentTime, 0.05);
    this.bFx.gain.setTargetAtTime(efectos, this.ac.currentTime, 0.05);
  },

  /* ---------------- instrumentos ---------------- */
  env(g, t, vol, ataque, dur, caida) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + ataque);
    g.gain.setValueAtTime(Math.max(0.0002, vol), t + Math.max(ataque, dur - caida));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  },
  osc(tipo, f, t, dur, vol, destino, o) {
    o = o || {};
    const ac = this.ac, os = ac.createOscillator(), g = ac.createGain();
    os.type = tipo;
    os.frequency.setValueAtTime(f, t);
    if (o.f1) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.tf || dur));
    if (o.det) os.detune.value = o.det;
    if (o.vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.vib[0]; lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(f * o.vib[1], t + (o.vib[2] || 0.2));
      l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    this.env(g, t, vol, o.ataque || 0.005, dur, o.caida || dur * 0.8);
    os.connect(g); g.connect(destino || this.bFx);
    if (o.eco) g.connect(this.envioEco);
    os.start(t); os.stop(t + dur + 0.05);
    return g;
  },
  ruidoFiltrado(t, dur, vol, destino, o) {
    o = o || {};
    const ac = this.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = this.ruido; s.loop = true;
    f.type = o.tipo || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    this.env(g, t, vol, o.ataque || 0.003, dur, o.caida || dur * 0.9);
    s.connect(f); f.connect(g); g.connect(destino || this.bFx);
    if (o.eco) g.connect(this.envioEco);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return g;
  },
  /* cuerda pulsada (charango, arpa): Karplus-Strong precalculado por nota.
     Suena a cuerda de verdad por una fracción de lo que cuesta sintetizarla */
  pulsada(f, t, dur, vol, destino, brillo) {
    brillo = brillo == null ? 0.5 : brillo;
    const clave = Math.round(f * 10) + ':' + brillo;
    let b = this.cacheKS.get(clave);
    if (!b) {
      const ac = this.ac, sr = ac.sampleRate, n = Math.floor(sr * 1.6), N = Math.max(2, Math.round(sr / f));
      b = ac.createBuffer(1, n, sr);
      const d = b.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev + (r - prev) * (0.35 + brillo * 0.6); d[i] = prev; }
      const k = 0.4985 + brillo * 0.0012;
      for (let i = N; i < n; i++) d[i] = (d[i - N] + d[i - N + 1 < i ? i - N + 1 : i - N]) * k;
      this.cacheKS.set(clave, b);
    }
    const s = this.ac.createBufferSource(), g = this.ac.createGain();
    s.buffer = b;
    g.gain.setValueAtTime(vol, t);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.08);
    s.connect(g); g.connect(destino || this.bFx); g.connect(this.envioEco);
    s.start(t); s.stop(t + Math.min(1.6, dur + 0.6));
  },
  flauta(f, t, dur, vol, destino) {
    const d = destino || this.bFx;
    this.osc('sine', f, t, dur, vol, d, { ataque: 0.05, caida: Math.min(0.2, dur * 0.4), vib: [5.2, 0.012, 0.18], eco: true });
    this.osc('triangle', f * 2, t, dur, vol * 0.12, d, { ataque: 0.06, caida: Math.min(0.2, dur * 0.4) });
    this.ruidoFiltrado(t, Math.min(dur, 0.14), vol * 0.22, d, { f0: f * 3, q: 3, ataque: 0.01 });
  },
  bajo(f, t, dur, vol, destino) {
    this.osc('triangle', f, t, dur, vol, destino, { ataque: 0.008, caida: dur * 0.7 });
    this.osc('sine', f / 2, t, dur, vol * 0.6, destino, { ataque: 0.008, caida: dur * 0.7 });
  },
  parche(f, t, dur, vol, destino) {
    const ac = this.ac, lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(4000, f * 5); lp.Q.value = 0.6;
    lp.connect(destino || this.bFx); lp.connect(this.envioEco);
    for (const det of [-9, 8]) this.osc('sawtooth', f, t, dur, vol * 0.5, lp, { ataque: Math.min(0.5, dur * 0.35), caida: Math.min(0.9, dur * 0.5), det });
  },
  campana(f, t, dur, vol, destino) {
    const d = destino || this.bFx;
    this.osc('sine', f, t, dur, vol, d, { ataque: 0.003, caida: dur, eco: true });
    this.osc('sine', f * 2.76, t, dur * 0.5, vol * 0.35, d, { ataque: 0.002, caida: dur * 0.5 });
    this.osc('sine', f * 5.4, t, dur * 0.25, vol * 0.18, d, { ataque: 0.002, caida: dur * 0.25 });
  },
  bombo(t, vol, destino) {
    this.osc('sine', 130, t, 0.22, vol, destino, { f1: 42, tf: 0.16, ataque: 0.002, caida: 0.2 });
    this.ruidoFiltrado(t, 0.03, vol * 0.5, destino, { tipo: 'lowpass', f0: 900 });
  },
  caja(t, vol, destino) {
    this.ruidoFiltrado(t, 0.13, vol, destino, { tipo: 'highpass', f0: 1400, q: 0.7 });
    this.osc('triangle', 190, t, 0.07, vol * 0.5, destino, { f1: 120 });
  },
  platillo(t, vol, destino) { this.ruidoFiltrado(t, 0.05, vol, destino, { tipo: 'highpass', f0: 7000, q: 0.6 }); },

  /* ---------------- efectos ---------------- */
  sfx(nombre, o) {
    if (!this.ac) return;
    const t = this.ac.currentTime, ult = this.ultimos[nombre] || 0;
    if (t - ult < 0.028) return;          // el mismo efecto apilado 5 veces en un cuadro satura
    this.ultimos[nombre] = t;
    const r = this.recetas[nombre];
    if (r) r(this, t + 0.004, o || {});
  },

  /* ---------------- música ----------------
     Una canción: { bpm, pasos: 16, compases, pistas: [{ inst, vol, notas }] }.
     "notas" es texto: cada palabra un paso (semicorchea). "." silencio,
     "-" sigue la nota anterior, "A3" una nota, "x"/"X" un golpe (percusión).
     Una pista más corta que la canción se repite. */
  preparar(c) {
    if (c.listo) return c;
    c.total = (c.pasos || 16) * (c.compases || 1);
    for (const p of c.pistas) {
      const tok = p.notas.trim().split(/\s+/);
      p.largo = tok.length;
      p.ev = [];
      for (let i = 0; i < tok.length; i++) {
        const k = tok[i];
        if (k === '.' || k === '-') continue;
        let dur = 1;
        while (tok[i + dur] === '-') dur++;
        if (k === 'x' || k === 'X') p.ev[i] = { golpe: k === 'X' ? 1 : 0.6, dur };
        else {
          const m = midiDe(k);
          if (m != null) p.ev[i] = { f: frecDe(m + (p.trasponer || 0)), dur };
        }
      }
    }
    c.listo = true;
    return c;
  },
  musica(nombre) {
    this.temaPedido = nombre;
    if (!this.ac) return;
    if (this.temaNombre === nombre) return;
    const ac = this.ac, t = ac.currentTime;
    if (this.sonando) {
      const viejo = this.sonando.g;
      viejo.gain.setTargetAtTime(0.0001, t, 0.25);
      setTimeout(() => viejo.disconnect(), 1600);
    }
    this.temaNombre = nombre;
    const c = this.temas[nombre];
    if (!c) { this.sonando = null; return; }
    this.preparar(c);
    const g = this.ganancia(0.0001, this.bMus);
    g.gain.setTargetAtTime(c.vol || 1, t + 0.05, 0.3);
    this.sonando = { c, g };
    this.paso = 0;
    this.tSig = t + 0.12;
  },
  programar() {
    if (!this.ac || !this.sonando) return;
    const { c, g } = this.sonando;
    const d16 = 60 / c.bpm / 4;
    while (this.tSig < this.ac.currentTime + 0.16) {
      const i = this.paso;
      for (const p of c.pistas) {
        const e = p.ev[i % p.largo];
        if (!e) continue;
        const t = this.tSig, dur = e.dur * d16 * (p.legato || 0.92), v = p.vol || 0.3;
        switch (p.inst) {
          case 'pulsada': this.pulsada(e.f, t, dur, v, g, p.brillo); break;
          case 'flauta': this.flauta(e.f, t, dur, v, g); break;
          case 'bajo': this.bajo(e.f, t, dur, v, g); break;
          case 'parche': this.parche(e.f, t, dur, v, g); break;
          case 'campana': this.campana(e.f, t, Math.max(dur, 0.6), v, g); break;
          case 'onda': this.osc(p.onda || 'square', e.f, t, dur, v, g, { ataque: 0.004, caida: dur * 0.6 }); break;
          case 'bombo': this.bombo(t, v * e.golpe, g); break;
          case 'caja': this.caja(t, v * e.golpe, g); break;
          case 'platillo': this.platillo(t, v * e.golpe, g); break;
        }
      }
      this.paso = (this.paso + 1) % c.total;
      /* un poco de hamaca en las semicorcheas impares: la música programada
         derechita suena a metrónomo */
      this.tSig += d16 * (c.hamaca ? (i % 2 ? 1 - c.hamaca : 1 + c.hamaca) : 1);
    }
  },

  /* ruido de fondo que no para (viento, cueva). Cambia de a poco */
  ambiente(tipo) {
    this.ambPedido = tipo;
    if (!this.ac) return;
    if (this.amb && this.amb.tipo === tipo) return;
    const ac = this.ac, t = ac.currentTime;
    if (this.amb) { const v = this.amb; v.g.gain.setTargetAtTime(0.0001, t, 0.5); setTimeout(() => { try { v.s.stop(); } catch (_) {} }, 3000); }
    this.amb = null;
    const def = this.ambientes && this.ambientes[tipo];
    if (!def) return;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    const l = ac.createOscillator(), lg = ac.createGain(), l2 = ac.createOscillator(), l2g = ac.createGain();
    s.buffer = this.ruido; s.loop = true;
    f.type = def.filtro || 'bandpass'; f.frequency.value = def.f; f.Q.value = def.q || 0.8;
    l.frequency.value = def.lfo || 0.09; lg.gain.value = def.f * (def.barrido || 0.5);
    l.connect(lg); lg.connect(f.frequency);
    l2.frequency.value = (def.lfo || 0.09) * 1.7; l2g.gain.value = def.vol * 0.45;
    l2.connect(l2g); l2g.connect(g.gain);
    g.gain.value = 0.0001; g.gain.setTargetAtTime(def.vol, t, 0.8);
    s.connect(f); f.connect(g); g.connect(this.bFx); g.connect(this.envioEco);
    s.start(); l.start(); l2.start();
    this.amb = { tipo, s, g };
  },
};
