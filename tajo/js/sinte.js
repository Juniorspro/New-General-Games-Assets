// El sintetizador: batería, bajo, guitarra, bronces, colchón, piano eléctrico
// y una voz de "talkbox" que canta la letra. Cero archivos de audio.
//
// Recibe cualquier BaseAudioContext: el mismo código suena en vivo y se
// graba entero en un OfflineAudioContext para las pruebas (así se mide el
// volumen, el recorte y que cada golpe caiga donde el mapa dice, sin
// parlantes).
//
// POR QUÉ LA VOZ ES UN TALKBOX. Cantar con palabras de verdad sin una
// grabación es imposible; pero el castellano tiene cinco vocales puras, y
// una vocal es sólo una forma del espectro (los "formantes"). Un diente de
// sierra que pasa por tres filtros afinados en los formantes de la A suena a
// "aaa". Moviendo los filtros sílaba por sílaba sale el sonido del talkbox del
// funk de los ochenta: robótico a propósito, y la letra se lee en pantalla.

const DOS_PI = Math.PI * 2;

export function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// Formantes (Hz) de las cinco vocales del castellano, un poco subidos para
// que la voz quede entre hombre y mujer (el talkbox se oye así).
const FORMANTES = {
  a: [800, 1250, 2650, 3500],
  e: [480, 1900, 2600, 3500],
  i: [330, 2350, 3050, 3700],
  o: [520, 920, 2500, 3400],
  u: [350, 760, 2350, 3300],
  m: [280, 1050, 2300, 3300],   // nasal: la boca cerrada
  l: [380, 1150, 2500, 3300],
};
const PESOS = [1.0, 0.62, 0.32, 0.16];

function curvaDistorsion(k) {
  const n = 1024, c = new Float32Array(n);
  const t = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / t; }
  return c;
}

function azarFijo(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Respuesta al impulso de una sala: ruido que se apaga, oscureciéndose. */
function impulso(ctx, dur, decae, semilla = 3) {
  const sr = ctx.sampleRate, n = Math.floor(sr * dur);
  const buf = ctx.createBuffer(2, n, sr);
  const rng = azarFijo(semilla);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = Math.pow(1 - t / dur, decae) * (t < 0.012 ? t / 0.012 : 1);
      // Se oscurece con el tiempo: un filtro de un polo que se cierra.
      const k = 0.55 - 0.45 * (t / dur);
      lp += k * ((rng() * 2 - 1) - lp);
      d[i] = lp * env * 0.9;
    }
  }
  return buf;
}

export class Sinte {
  constructor(ctx, destino) {
    this.ctx = ctx;
    const c = ctx;

    // Cadena maestra: bus → compresor → limitador → destino.
    this.salida = c.createGain(); this.salida.gain.value = 0.8;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 3.2; this.comp.knee.value = 8;
    this.comp.attack.value = 0.006; this.comp.release.value = 0.2;
    this.lim = c.createDynamicsCompressor();
    this.lim.threshold.value = -3; this.lim.ratio.value = 20; this.lim.knee.value = 0;
    this.lim.attack.value = 0.001; this.lim.release.value = 0.09;
    this.salida.connect(this.comp); this.comp.connect(this.lim); this.lim.connect(destino);

    // Buses: la batería va directo; bajo, acordes y colchón pasan por el
    // "bombeo" que se agacha con cada bombo (el sidechain del house).
    this.busBateria = c.createGain(); this.busBateria.gain.value = 0.9; this.busBateria.connect(this.salida);
    this.busBombeo = c.createGain(); this.busBombeo.connect(this.salida);
    this.bombeoGain = this.busBombeo.gain;
    this.busMelodia = c.createGain(); this.busMelodia.gain.value = 0.85; this.busMelodia.connect(this.salida);
    this.busVoz = c.createGain(); this.busVoz.gain.value = 1.0; this.busVoz.connect(this.salida);

    // Reverb compartida.
    this.rev = c.createConvolver();
    this.rev.buffer = impulso(c, 2.6, 2.8);
    this.envioRev = c.createGain(); this.envioRev.gain.value = 1;
    this.revVuelta = c.createGain(); this.revVuelta.gain.value = 0.32;
    this.envioRev.connect(this.rev); this.rev.connect(this.revVuelta); this.revVuelta.connect(this.salida);

    // Eco (se ajusta al tempo con ponerTempo).
    this.eco = c.createDelay(2); this.eco.delayTime.value = 0.3;
    this.ecoVuelta = c.createGain(); this.ecoVuelta.gain.value = 0.3;
    this.ecoFiltro = c.createBiquadFilter(); this.ecoFiltro.type = "bandpass";
    this.ecoFiltro.frequency.value = 1800; this.ecoFiltro.Q.value = 0.5;
    this.envioEco = c.createGain(); this.envioEco.gain.value = 1;
    this.envioEco.connect(this.eco); this.eco.connect(this.ecoFiltro);
    this.ecoFiltro.connect(this.ecoVuelta); this.ecoVuelta.connect(this.eco);
    this.ecoFiltro.connect(this.salida); this.ecoFiltro.connect(this.envioRev);

    this.curvaSuave = curvaDistorsion(1.6);
    this.curvaFuerte = curvaDistorsion(4.5);

    // Un solo búfer de ruido: cada golpe lo lee desde un lugar distinto.
    const n = c.sampleRate * 2;
    this.ruido = c.createBuffer(1, n, c.sampleRate);
    const d = this.ruido.getChannelData(0);
    const rng = azarFijo(11);
    for (let i = 0; i < n; i++) d[i] = rng() * 2 - 1;
    this.rng = azarFijo(29);
    this.voces = [];
  }

  ponerTempo(bpm) {
    this.bpm = bpm;
    this.eco.delayTime.value = (60 / bpm) * 0.75;    // corchea con puntillo
  }

  // ── utilidades ──
  _ruido(t, dur, destino) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ruido;
    s.connect(destino);
    s.start(t, this.rng() * 1.5, dur + 0.05);
    return s;
  }
  _gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  _filtro(tipo, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = tipo; b.frequency.value = f; b.Q.value = q; return b; }
  _paneo(p, destino) {
    if (!this.ctx.createStereoPanner) return destino;
    const s = this.ctx.createStereoPanner(); s.pan.value = p; s.connect(destino); return s;
  }
  _env(g, t, ataque, pico, decae, fin = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(pico, 0.0002), t + ataque);
    g.gain.exponentialRampToValueAtTime(fin, t + ataque + decae);
  }

  /** El agache del bombeo: se hunde con el bombo y vuelve en una negra. */
  bombear(t, cuanto = 0.55) {
    const g = this.bombeoGain;
    g.setTargetAtTime(1 - cuanto, t, 0.004);
    g.setTargetAtTime(1, t + 0.03, 0.11);
  }

  // ── batería ──
  bombo(t, v = 1, bombeo = true) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.32);
    const g = this._gain(0);
    this._env(g, t, 0.002, 1.05 * v, 0.40);
    const sat = c.createWaveShaper(); sat.curve = this.curvaSuave;
    o.connect(g); g.connect(sat); sat.connect(this.busBateria);
    o.start(t); o.stop(t + 0.46);
    // El "click" del parche: sin esto el bombo no se oye en un parlante chico.
    const gc = this._gain(0); this._env(gc, t, 0.001, 0.32 * v, 0.012);
    const hp = this._filtro("highpass", 2400); hp.connect(gc); gc.connect(this.busBateria);
    this._ruido(t, 0.02, hp);
    if (bombeo) this.bombear(t);
  }

  caja(t, v = 1) {
    const g = this._gain(0); this._env(g, t, 0.001, 1.3 * v, 0.2);
    const hp = this._filtro("highpass", 1200); const bp = this._filtro("peaking", 3200, 0.8); bp.gain.value = 5;
    hp.connect(bp); bp.connect(g);
    const pan = this._paneo(0.04, this.busBateria);
    g.connect(pan);
    const r = this._gain(0.28 * v); g.connect(r); r.connect(this.envioRev);
    this._ruido(t, 0.24, hp);
    const o = this.ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.08);
    const go = this._gain(0); this._env(go, t, 0.001, 0.8 * v, 0.09);
    o.connect(go); go.connect(this.busBateria); o.start(t); o.stop(t + 0.12);
  }

  palmas(t, v = 1) {
    const bp = this._filtro("bandpass", 1150, 1.4);
    const g = this._gain(0);
    // Tres golpecitos pegados y una cola: eso es lo que hace que suenen a palmas.
    g.gain.setValueAtTime(0.0001, t);
    for (const k of [0, 0.011, 0.023]) {
      g.gain.setValueAtTime(2.6 * v, t + k);
      g.gain.exponentialRampToValueAtTime(0.35 * v, t + k + 0.009);
    }
    g.gain.setValueAtTime(2.1 * v, t + 0.032);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    bp.connect(g);
    const pan = this._paneo(-0.06, this.busBateria);
    g.connect(pan);
    const r = this._gain(0.35 * v); g.connect(r); r.connect(this.envioRev);
    this._ruido(t, 0.22, bp);
  }

  hat(t, v = 1, abierto = false) {
    const hp = this._filtro("highpass", 7200); const bp = this._filtro("bandpass", 10500, 0.9);
    const g = this._gain(0);
    this._env(g, t, 0.001, (abierto ? 0.55 : 0.75) * v, abierto ? 0.26 : 0.035);
    hp.connect(bp); bp.connect(g);
    const pan = this._paneo(0.22, this.busBateria);
    g.connect(pan);
    this._ruido(t, abierto ? 0.3 : 0.06, hp);
  }

  platillo(t, v = 1) {
    const c = this.ctx;
    const hp = this._filtro("highpass", 5200);
    const g = this._gain(0); this._env(g, t, 0.002, 0.3 * v, 1.9);
    hp.connect(g);
    const pan = this._paneo(-0.25, this.busBateria);
    g.connect(pan);
    const r = this._gain(0.3 * v); g.connect(r); r.connect(this.envioRev);
    this._ruido(t, 2.0, hp);
    // Parciales metálicos inarmónicos, los del 808.
    const bp = this._filtro("bandpass", 8200, 0.6); const hp2 = this._filtro("highpass", 6000);
    const gm = this._gain(0); this._env(gm, t, 0.002, 0.07 * v, 1.2);
    bp.connect(hp2); hp2.connect(gm); gm.connect(pan);
    for (const f of [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]) {
      const o = c.createOscillator(); o.type = "square"; o.frequency.value = f * 1.9;
      o.connect(bp); o.start(t); o.stop(t + 1.3);
    }
  }

  tambor(t, v = 1, tono = 0) {
    // Un tom para los redobles de cierre de frase.
    const o = this.ctx.createOscillator(); o.type = "sine";
    const f0 = 150 + tono * 40;
    o.frequency.setValueAtTime(f0 * 1.6, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.05);
    const g = this._gain(0); this._env(g, t, 0.002, 0.7 * v, 0.28);
    o.connect(g);
    const pan = this._paneo(tono * 0.3 - 0.3, this.busBateria);
    g.connect(pan);
    o.start(t); o.stop(t + 0.32);
  }

  // ── bajo ──
  bajo(t, m, dur, v = 1, desliza = 0) {
    const c = this.ctx, f = mtof(m);
    const g = this._gain(0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 * v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.15 * v, t + 0.09);
    const fin = t + Math.max(0.05, dur);
    g.gain.setValueAtTime(0.15 * v, fin - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, fin + 0.04);
    const lp = this._filtro("lowpass", 200, 5.5);
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(900 + 1400 * v, t + 0.008);
    lp.frequency.exponentialRampToValueAtTime(420, t + 0.14);
    const sat = c.createWaveShaper(); sat.curve = this.curvaSuave;
    lp.connect(sat); sat.connect(g); g.connect(this.busBombeo);
    const oscs = [["sawtooth", 1, 0.55], ["square", 0.5, 0.45], ["sawtooth", 1.004, 0.3]];
    for (const [tipo, k, a] of oscs) {
      const o = c.createOscillator(); o.type = tipo;
      o.frequency.setValueAtTime(f * k, t);
      if (desliza) o.frequency.exponentialRampToValueAtTime(mtof(m + desliza) * k, fin);
      const ga = this._gain(a); o.connect(ga); ga.connect(lp);
      o.start(t); o.stop(fin + 0.06);
    }
  }

  // ── guitarra funk (rasguido corto y apagado) ──
  guitarra(t, notas, v = 1, pan = 0.3, largo = 0.1) {
    const c = this.ctx;
    const hp = this._filtro("highpass", 320); const lp = this._filtro("lowpass", 3400, 0.9);
    const sat = c.createWaveShaper(); sat.curve = this.curvaFuerte;
    const g = this._gain(0); this._env(g, t, 0.003, 0.34 * v, largo);
    hp.connect(sat); sat.connect(lp); lp.connect(g);
    const p = this._paneo(pan, this.busBombeo); g.connect(p);
    const r = this._gain(0.15); g.connect(r); r.connect(this.envioRev);
    notas.forEach((m, i) => {
      // El rasguido: cada cuerda entra 4 ms después de la anterior.
      const o = c.createOscillator(); o.type = "sawtooth";
      o.frequency.value = mtof(m); o.detune.value = (this.rng() - 0.5) * 12;
      o.connect(hp); o.start(t + i * 0.004); o.stop(t + largo + 0.12);
    });
  }

  rasguidoMudo(t, v = 1, pan = 0.3) {
    const bp = this._filtro("bandpass", 1900, 1.8);
    const g = this._gain(0); this._env(g, t, 0.002, 0.16 * v, 0.03);
    bp.connect(g); const p = this._paneo(pan, this.busBombeo); g.connect(p);
    this._ruido(t, 0.05, bp);
  }

  // ── bronces (sierras desafinadas con filtro que abre) ──
  bronce(t, notas, dur, v = 1) {
    const c = this.ctx;
    const lp = this._filtro("lowpass", 600, 1.2);
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(3600 * (0.6 + 0.4 * v), t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(1700, t + 0.04 + Math.min(0.4, dur));
    const g = this._gain(0);
    const fin = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.12);
    g.gain.setValueAtTime(0.2 * v, Math.max(t + 0.12, fin - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, fin + 0.12);
    lp.connect(g); g.connect(this.busMelodia);
    const r = this._gain(0.22); g.connect(r); r.connect(this.envioRev);
    const e = this._gain(0.12); g.connect(e); e.connect(this.envioEco);
    for (const m of notas) {
      for (const d of [-8, 0, 8]) {
        const o = c.createOscillator(); o.type = "sawtooth";
        o.frequency.value = mtof(m); o.detune.value = d;
        // Una caída de afinación al principio: el "ataque" del labio.
        o.detune.setValueAtTime(d - 40, t); o.detune.linearRampToValueAtTime(d, t + 0.05);
        const ga = this._gain(0.33); o.connect(ga); ga.connect(lp);
        o.start(t); o.stop(fin + 0.15);
      }
    }
  }

  // ── colchón ──
  colchon(t, notas, dur, v = 1) {
    const c = this.ctx;
    const lp = this._filtro("lowpass", 1300, 0.6);
    const g = this._gain(0);
    const fin = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05 * v, t + Math.min(0.45, dur * 0.4));
    g.gain.setValueAtTime(0.05 * v, fin);
    g.gain.linearRampToValueAtTime(0.0001, fin + 0.7);
    lp.connect(g); g.connect(this.busBombeo);
    const r = this._gain(0.5); g.connect(r); r.connect(this.envioRev);
    for (const m of notas) {
      for (const [tipo, d, a] of [["sawtooth", -11, 0.35], ["sawtooth", 11, 0.35], ["triangle", 0, 0.5]]) {
        const o = c.createOscillator(); o.type = tipo; o.frequency.value = mtof(m); o.detune.value = d;
        const ga = this._gain(a); o.connect(ga); ga.connect(lp);
        o.start(t); o.stop(fin + 0.75);
      }
    }
  }

  // ── piano eléctrico (FM de dos operadores) ──
  piano(t, notas, dur, v = 1) {
    const c = this.ctx;
    const g = this._gain(0);
    const fin = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.065 * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.022 * v, t + 0.9);
    g.gain.setValueAtTime(0.022 * v, Math.max(t + 0.01, fin));
    g.gain.exponentialRampToValueAtTime(0.0001, fin + 0.25);
    g.connect(this.busBombeo);
    const r = this._gain(0.35); g.connect(r); r.connect(this.envioRev);
    for (const m of notas) {
      const f = mtof(m);
      const car = c.createOscillator(); car.type = "sine"; car.frequency.value = f;
      const mod = c.createOscillator(); mod.type = "sine"; mod.frequency.value = f;
      const idx = this._gain(0);
      idx.gain.setValueAtTime(f * 1.4 * v, t);
      idx.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.6);
      mod.connect(idx); idx.connect(car.frequency);
      car.connect(g);
      car.start(t); mod.start(t); car.stop(fin + 0.3); mod.stop(fin + 0.3);
    }
  }

  // ── solista (para los riffs de sintetizador) ──
  solista(t, m, dur, v = 1, desde = null) {
    const c = this.ctx;
    const f = mtof(m);
    const lp = this._filtro("lowpass", 2600, 2);
    lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(3800, t + 0.03);
    lp.frequency.exponentialRampToValueAtTime(2000, t + 0.25);
    const g = this._gain(0);
    const fin = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1 * v, t + 0.01);
    g.gain.setValueAtTime(0.085 * v, Math.max(t + 0.011, fin - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, fin + 0.08);
    lp.connect(g); g.connect(this.busMelodia);
    const e = this._gain(0.2); g.connect(e); e.connect(this.envioEco);
    const r = this._gain(0.2); g.connect(r); r.connect(this.envioRev);
    for (const [tipo, d] of [["sawtooth", -6], ["square", 6]]) {
      const o = c.createOscillator(); o.type = tipo; o.detune.value = d;
      if (desde !== null) {
        o.frequency.setValueAtTime(mtof(desde), t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      } else o.frequency.value = f;
      const ga = this._gain(0.5); o.connect(ga); ga.connect(lp);
      o.start(t); o.stop(fin + 0.1);
    }
  }

  // ── efectos de transición ──
  subida(t, dur, v = 1) {
    const bp = this._filtro("bandpass", 400, 2.2);
    bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(7500, t + dur);
    const g = this._gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * v, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    bp.connect(g); g.connect(this.salida);
    const r = this._gain(0.4); g.connect(r); r.connect(this.envioRev);
    const s = this.ctx.createBufferSource(); s.buffer = this.ruido; s.loop = true;
    s.connect(bp); s.start(t); s.stop(t + dur + 0.08);
  }

  impacto(t, v = 1) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    const g = this._gain(0); this._env(g, t, 0.003, 0.8 * v, 1.5);
    o.connect(g); g.connect(this.salida); o.start(t); o.stop(t + 1.6);
    const lp = this._filtro("lowpass", 900);
    const gr = this._gain(0); this._env(gr, t, 0.002, 0.5 * v, 0.9);
    lp.connect(gr); gr.connect(this.salida);
    const r = this._gain(0.8); gr.connect(r); r.connect(this.envioRev);
    this._ruido(t, 1.0, lp);
  }

  inverso(t, dur, v = 1) {
    // El platillo al revés: crece y se corta justo en el golpe.
    const hp = this._filtro("highpass", 3200);
    const g = this._gain(0);
    g.gain.setValueAtTime(0.0001, t - dur);
    g.gain.exponentialRampToValueAtTime(0.28 * v, t - 0.005);
    g.gain.setValueAtTime(0.0001, t);
    hp.connect(g); g.connect(this.salida);
    const s = this.ctx.createBufferSource(); s.buffer = this.ruido; s.loop = true;
    s.connect(hp); s.start(t - dur); s.stop(t + 0.01);
  }

  // ── la voz ──
  /** Arma una voz persistente (oscilador + formantes). Se reusa toda la
   *  canción: crear filtros por sílaba serían miles de nodos. */
  crearVoz({ octava = 0, volumen = 1, pan = 0 } = {}) {
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = "sawtooth";
    const o2 = c.createOscillator(); o2.type = "square"; o2.detune.value = -9;
    // Vibrato: un LFO que se le suma a la afinación, con profundidad que
    // arranca en cero y crece en cada nota larga.
    const lfo = c.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 5.6;
    const prof = this._gain(0);
    lfo.connect(prof); prof.connect(o1.detune); prof.connect(o2.detune);
    const mezcla = this._gain(1);
    const g2 = this._gain(0.45);
    o1.connect(mezcla); o2.connect(g2); g2.connect(mezcla);
    const suma = this._gain(1);
    const filtros = FORMANTES.a.map((f, i) => {
      const b = this._filtro("bandpass", f, i === 0 ? 7 : 9);
      const gg = this._gain(PESOS[i] * (i === 0 ? 1.4 : 2.2));
      mezcla.connect(b); b.connect(gg); gg.connect(suma);
      return b;
    });
    const env = this._gain(0);
    const brillo = this._filtro("highshelf", 2800); brillo.gain.value = 5;
    const sat = c.createWaveShaper(); sat.curve = this.curvaSuave;
    suma.connect(brillo); brillo.connect(sat); sat.connect(env);
    const nivel = this._gain(0.62 * volumen);
    env.connect(nivel);
    const p = this._paneo(pan, this.busVoz);
    nivel.connect(p);
    const r = this._gain(0.3); nivel.connect(r); r.connect(this.envioRev);
    const e = this._gain(0.16); nivel.connect(e); e.connect(this.envioEco);
    const ahora = c.currentTime;
    for (const o of [o1, o2, lfo]) o.start(ahora);
    const voz = { o1, o2, lfo, prof, filtros, env, nivel, salidaRuido: p, octava, vivos: [o1, o2, lfo] };
    this.voces.push(voz);
    return voz;
  }

  _formantes(voz, vocal, t, tau = 0.018) {
    const F = FORMANTES[vocal] || FORMANTES.a;
    voz.filtros.forEach((b, i) => b.frequency.setTargetAtTime(F[i], t, tau));
  }

  _consonante(voz, letra, t, v) {
    // Ruido corto por la salida de la voz, sin pasar por los formantes.
    let f = 0, q = 1, dur = 0, a = 0, tipo = "bandpass";
    if ("sz".includes(letra)) { f = 6500; q = 0.8; dur = 0.07; a = 0.2; tipo = "highpass"; }
    else if (letra === "c+" ) { f = 6000; q = 0.8; dur = 0.06; a = 0.17; tipo = "highpass"; }
    else if (letra === "f") { f = 3500; q = 0.5; dur = 0.06; a = 0.12; }
    else if (letra === "j") { f = 1800; q = 1.2; dur = 0.07; a = 0.13; }
    else if (letra === "ch") { f = 3800; q = 1; dur = 0.06; a = 0.2; }
    else if ("td".includes(letra)) { f = 4200; q = 0.9; dur = 0.014; a = 0.2; }
    else if ("kcqg".includes(letra)) { f = 2100; q = 1.1; dur = 0.02; a = 0.2; }
    else if ("pbv".includes(letra)) { f = 900; q = 0.9; dur = 0.014; a = 0.22; }
    if (!dur) return 0;
    const b = this._filtro(tipo, f, q);
    const g = this._gain(0); this._env(g, t, 0.003, a * v, dur);
    b.connect(g); g.connect(voz.salidaRuido);
    this._ruido(t, dur + 0.02, b);
    return dur;
  }

  /** Canta una sílaba. `silaba` en minúsculas y sin tildes; `m` la nota. */
  silaba(voz, t, m, dur, silaba, v = 1, fin = false) {
    const f = mtof(m + voz.octava * 12);
    const { inicio, vocales, cierre } = partirSilaba(silaba);
    // Portamento corto: la voz "llega" a la nota como una garganta.
    voz.o1.frequency.setTargetAtTime(f, t - 0.012, 0.014);
    voz.o2.frequency.setTargetAtTime(f, t - 0.012, 0.014);
    // Consonante de ataque.
    let atraso = 0;
    if (inicio === "m" || inicio === "n" || inicio === "ñ") {
      this._formantes(voz, "m", t, 0.008);
      voz.env.gain.setTargetAtTime(0.55 * v, t, 0.008);
      atraso = 0.045;
    } else if (inicio === "l" || inicio === "ll" || inicio === "y") {
      this._formantes(voz, inicio === "l" ? "l" : "i", t, 0.008);
      voz.env.gain.setTargetAtTime(0.7 * v, t, 0.008);
      atraso = 0.035;
    } else if (inicio === "r" || inicio === "rr") {
      // La erre: un par de golpes de amplitud.
      voz.env.gain.setTargetAtTime(0.25 * v, t, 0.004);
      voz.env.gain.setTargetAtTime(0.8 * v, t + 0.018, 0.004);
      if (inicio === "rr") { voz.env.gain.setTargetAtTime(0.25 * v, t + 0.036, 0.004); }
      atraso = inicio === "rr" ? 0.05 : 0.025;
    } else if (inicio) {
      const d = this._consonante(voz, inicio, t, v);
      voz.env.gain.setTargetAtTime(0.0001, t, 0.005);
      atraso = Math.min(0.05, d * 0.8);
    }
    const tv = t + atraso;
    const v0 = vocales[0] || "a";
    this._formantes(voz, v0, tv, 0.014);
    voz.env.gain.setTargetAtTime(1.0 * v, tv, 0.01);
    // Diptongo: se desliza a la segunda vocal a mitad de nota.
    if (vocales[1]) this._formantes(voz, vocales[1], tv + (dur - atraso) * 0.45, 0.03);
    // Vibrato sólo en notas largas, entrando de a poco.
    voz.prof.gain.setTargetAtTime(0, t, 0.02);
    if (dur > 0.32) voz.prof.gain.setTargetAtTime(22, t + 0.18, 0.12);
    const tf = t + dur;
    // Consonante de cierre y soltar la nota.
    if (cierre === "s" || cierre === "z") this._consonante(voz, "s", tf - 0.07, v * 0.8);
    if (cierre === "n" || cierre === "m") this._formantes(voz, "m", tf - 0.06, 0.012);
    if (cierre === "l") this._formantes(voz, "l", tf - 0.05, 0.012);
    const suelta = fin ? 0.05 : 0.018;
    voz.env.gain.setTargetAtTime(0.0001, tf - (fin ? 0.02 : 0.03), suelta);
  }

  soltarVoces(t) {
    for (const v of this.voces) {
      v.env.gain.setTargetAtTime(0.0001, t, 0.02);
      for (const o of v.vivos) { try { o.stop(t + 0.3); } catch (e) { /* ya parado */ } }
    }
    this.voces = [];
  }
}

const VOCALES = "aeiou";
/** "cor" → {inicio:"c", vocales:["o"], cierre:"r"}; "nues" → n, [u,e], s.
 *  Maneja los dígrafos del castellano (ch, ll, rr, qu, gu) y la c/g suaves. */
export function partirSilaba(s0) {
  const s = s0.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zñ]/g, "");
  let i = 0, inicio = "";
  const dos = s.slice(0, 2);
  if (["ch", "ll", "rr"].includes(dos)) { inicio = dos; i = 2; }
  else if (dos === "qu" || (dos === "gu" && "ei".includes(s[2] || ""))) { inicio = dos[0] === "q" ? "k" : "g"; i = 2; }
  else if (s[0] && !VOCALES.includes(s[0])) {
    inicio = s[0]; i = 1;
    if (inicio === "c" && "ei".includes(s[1] || "")) inicio = "c+";
    if (inicio === "g" && "ei".includes(s[1] || "")) inicio = "j";
    if (inicio === "h") inicio = "";
    // Grupos como "br", "tr", "pl": se toma la primera.
    if (s[1] && !VOCALES.includes(s[1])) i = 2;
  }
  const vocales = [];
  while (i < s.length && VOCALES.includes(s[i])) { if (vocales.length < 2) vocales.push(s[i]); i++; }
  const cierre = s.slice(i, i + 1);
  return { inicio, vocales, cierre };
}
