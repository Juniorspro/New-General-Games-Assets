// Todo el sonido, sintetizado: golpes de piedra y de madera, metales que no
// suenen a ollas, gemas que suenan a vidrio, agua, pasos distintos en arena,
// pasto y madera, las olas, los pájaros de día y los grillos de noche.
// El AudioContext arranca recién con el primer toque: antes, el navegador no
// deja sonar nada.
export class Sonido {
  constructor() {
    this.ctx = null;
    this.vol = { efectos: 0.8, musica: 0.45, ambiente: 0.6 };
    this.pendiente = null;
    this.ultimo = {};
    this.bajoTierra = 0; this.noche = 0; this.bajoAgua = false;
  }

  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch { return; }
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 3.5;
    this.comp.connect(c.destination);
    this.bEfectos = c.createGain(); this.bEfectos.gain.value = this.vol.efectos; this.bEfectos.connect(this.comp);
    this.filtroMusica = c.createBiquadFilter(); this.filtroMusica.type = 'lowpass'; this.filtroMusica.frequency.value = 9000;
    this.bMusica = c.createGain(); this.bMusica.gain.value = this.vol.musica; this.bMusica.connect(this.filtroMusica); this.filtroMusica.connect(this.comp);
    this.bAmb = c.createGain(); this.bAmb.gain.value = this.vol.ambiente; this.bAmb.connect(this.comp);
    // reverb con una respuesta generada: ruido que se apaga en 2,2 s
    const n = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, n, c.sampleRate);
    for (let k = 0; k < 2; k++) { const d = ir.getChannelData(k); let y = 0; for (let i = 0; i < n; i++) { y += (Math.random() * 2 - 1 - y) * 0.55; d[i] = y * (1 - i / n) ** 3; } }
    this.rev = c.createConvolver(); this.rev.buffer = ir;
    this.bRev = c.createGain(); this.bRev.gain.value = 0.25; this.bRev.connect(this.rev); this.rev.connect(this.comp);
    // ruido blanco para todo lo que suena a roce
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.ruido = nb;
    this.armarAmbiente();
    if (this.pendiente) { const p = this.pendiente; this.pendiente = null; this.musica(p); }
  }

  volumen(tipo, v) {
    this.vol[tipo] = v;
    if (!this.ctx) return;
    const b = { efectos: this.bEfectos, musica: this.bMusica, ambiente: this.bAmb }[tipo];
    if (b) b.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  // ── piezas ────────────────────────────────────────────────────────────────
  env(g, t, a, pico, sostenido, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pico, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sostenido), t + dur);
  }
  tono(f0, f1, dur, vol, tipo = 'sine', t = 0, rev = 0.15, destino = this.bEfectos) {
    const c = this.ctx, ahora = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f0, ahora); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ahora + dur);
    this.env(g, ahora, 0.005, vol, 0.0001, dur);
    o.connect(g); g.connect(destino);
    if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r); r.connect(this.bRev); }
    o.start(ahora); o.stop(ahora + dur + 0.05);
  }
  soplo(frec, q, dur, vol, t = 0, barrido = null, destino = this.bEfectos, tipoFiltro = 'bandpass') {
    const c = this.ctx, ahora = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = this.ruido; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = tipoFiltro; f.frequency.setValueAtTime(frec, ahora); f.Q.value = q;
    if (barrido) f.frequency.exponentialRampToValueAtTime(barrido, ahora + dur);
    const g = c.createGain(); this.env(g, ahora, 0.004, vol, 0.0001, dur);
    s.connect(f); f.connect(g); g.connect(destino);
    s.start(ahora, Math.random()); s.stop(ahora + dur + 0.05);
  }
  // campana/vidrio: parciales inarmónicos que se apagan a distinta velocidad
  vidrio(f, vol, t = 0, largo = 0.9) {
    for (const [k, a, d] of [[1, 1, 1], [2.76, 0.45, 0.55], [5.4, 0.25, 0.3], [8.9, 0.12, 0.2]]) this.tono(f * k, f * k * 0.998, largo * d, vol * a, 'sine', t, 0.35);
  }

  // ── efectos ───────────────────────────────────────────────────────────────
  sfx(nombre, op = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ahora = performance.now();
    if (this.ultimo[nombre] && ahora - this.ultimo[nombre] < (op.anti ?? 40)) return;
    this.ultimo[nombre] = ahora;
    const v = (x) => x * (0.9 + Math.random() * 0.2);   // ±10 %: lo repetido no cansa
    switch (nombre) {
      case 'golpePiedra': this.soplo(v(1800), 1.2, 0.09, 0.5); this.tono(v(220), 90, 0.12, 0.35, 'square'); this.soplo(v(4200), 3, 0.05, 0.2, 0.01); break;
      case 'romperPiedra': this.soplo(v(900), 0.8, 0.28, 0.6, 0, 300); this.tono(v(140), 50, 0.25, 0.4, 'triangle'); for (let i = 0; i < 4; i++) this.soplo(v(2400), 4, 0.04, 0.25, 0.04 + i * 0.05); break;
      case 'golpeMadera': this.tono(v(420), 160, 0.08, 0.45, 'triangle'); this.soplo(v(1200), 2.5, 0.06, 0.35); break;
      case 'romperMadera': this.tono(v(260), 80, 0.3, 0.45, 'triangle'); this.soplo(v(700), 1.5, 0.3, 0.45, 0, 250); break;
      case 'metal': for (const [f, a] of [[v(1320), 0.3], [v(1320) * 2.41, 0.14], [v(1320) * 3.93, 0.08]]) this.tono(f, f * 0.995, 0.5, a, 'sine', 0, 0.3); this.soplo(6000, 5, 0.03, 0.1); break;
      case 'cristal': { const nota = [880, 988, 1175, 1319, 1568][Math.floor(Math.random() * 5)]; this.vidrio(nota, 0.22); this.vidrio(nota * 1.5, 0.1, 0.06, 0.6); break; }
      case 'juntar': this.tono(v(520), v(880), 0.09, 0.25, 'square', 0, 0.1); this.tono(v(880), v(1320), 0.07, 0.15, 'sine', 0.05); break;
      case 'paso': {
        const sup = op.sup || 'arena';
        if (sup === 'madera') { this.tono(v(180), 110, 0.07, 0.22, 'triangle'); this.soplo(900, 2, 0.04, 0.1); }
        else if (sup === 'piedra') { this.soplo(v(2600), 2, 0.05, 0.16); this.tono(v(300), 150, 0.04, 0.08, 'square'); }
        else if (sup === 'pasto') this.soplo(v(3200), 0.8, 0.09, 0.12, 0, 1800, this.bEfectos, 'highpass');
        else if (sup === 'agua') this.soplo(v(900), 1, 0.16, 0.22, 0, 400);
        else this.soplo(v(1500), 0.9, 0.08, 0.14, 0, 700);
        break;
      }
      case 'salto': this.soplo(v(700), 1, 0.12, 0.12); break;
      case 'aterriza': this.soplo(v(500), 0.8, 0.16, 0.3, 0, 200); this.tono(90, 50, 0.12, 0.25, 'sine'); break;
      case 'chapuzon': this.soplo(v(1200), 0.7, 0.45, 0.5, 0, 300); this.soplo(v(3000), 1.5, 0.3, 0.2, 0.05); for (let i = 0; i < 5; i++) this.tono(v(600 + i * 120), 1200, 0.06, 0.06, 'sine', 0.1 + i * 0.06); break;
      case 'plop': this.tono(v(600), 200, 0.12, 0.35, 'sine'); this.soplo(1800, 2, 0.08, 0.2); break;
      case 'lanzar': this.soplo(v(2000), 1.5, 0.25, 0.2, 0, 700); break;
      case 'pica': this.tono(v(700), 300, 0.1, 0.4, 'sine'); this.soplo(1500, 1.5, 0.2, 0.35, 0.02, 600); break;
      case 'atrapar': this.soplo(v(1000), 0.7, 0.4, 0.45, 0, 300); this.vidrio(1047, 0.18, 0.15); this.vidrio(1568, 0.14, 0.3); break;
      case 'cortar': this.soplo(v(4000), 1.2, 0.14, 0.3, 0, 1500); this.soplo(v(2200), 0.8, 0.1, 0.15, 0.03); break;
      case 'pala': this.soplo(v(600), 0.7, 0.2, 0.4, 0, 250); this.tono(110, 60, 0.15, 0.25, 'triangle'); break;
      case 'poner': this.tono(v(240), 120, 0.1, 0.4, 'triangle'); this.soplo(900, 1.5, 0.08, 0.2); break;
      case 'craftear': this.tono(660, 660, 0.08, 0.2, 'square'); this.tono(990, 990, 0.12, 0.2, 'square', 0.08); this.vidrio(1320, 0.12, 0.16); break;
      case 'ui': this.tono(v(1400), 1600, 0.035, 0.08, 'sine', 0, 0); break;
      case 'uiSi': this.tono(880, 880, 0.05, 0.12, 'square', 0, 0); this.tono(1320, 1320, 0.07, 0.1, 'square', 0.05, 0); break;
      case 'noti': this.vidrio(1175, 0.1); break;
      case 'cofre': this.tono(v(300), 200, 0.25, 0.2, 'sawtooth'); this.soplo(500, 3, 0.2, 0.15); break;
      case 'estrella': this.soplo(3000, 1, 1.2, 0.2, 0, 400); for (let i = 0; i < 6; i++) this.vidrio(1568 + i * 180, 0.06, 0.1 + i * 0.12, 0.5); break;
      case 'comer': for (let i = 0; i < 3; i++) this.soplo(v(1500), 2, 0.07, 0.25, i * 0.11); break;
      case 'dolor': this.tono(300, 140, 0.2, 0.3, 'sawtooth'); break;
      case 'mina': this.soplo(200, 0.7, 1.5, 0.3, 0, 90); this.tono(70, 50, 1.2, 0.2, 'sine'); break;
      // ── pelea ──
      case 'espada': this.soplo(v(2600), 1.4, 0.16, 0.32, 0, 900); this.soplo(v(5200), 3, 0.06, 0.12, 0.03); break;
      case 'golpeCarne': this.tono(v(160), 70, 0.12, 0.5, 'sine'); this.soplo(v(700), 1, 0.1, 0.4, 0, 250); break;
      case 'hueso': for (let i = 0; i < 3; i++) this.tono(v(900 + i * 260), 500, 0.04, 0.22, 'square', i * 0.035, 0.1); break;
      case 'cangrejo': for (let i = 0; i < 2; i++) this.soplo(v(3500), 6, 0.03, 0.25, i * 0.07); break;
      case 'esqueleto': for (let i = 0; i < 5; i++) this.tono(v(700 + Math.random() * 500), 400, 0.03, 0.12, 'square', i * 0.05, 0); break;
      case 'murcielago': this.tono(v(3200), 2400, 0.08, 0.1, 'sine', 0, 0.2); this.tono(v(3600), 2800, 0.06, 0.07, 'sine', 0.09, 0.2); break;
      case 'golem': this.tono(55, 38, 1.1, 0.5, 'sawtooth', 0, 0.4); this.soplo(160, 0.6, 1.0, 0.4, 0, 70); break;
      case 'golemGolpe': this.tono(80, 30, 0.7, 0.8, 'sine'); this.soplo(420, 0.6, 0.8, 0.8, 0, 90); for (let i = 0; i < 6; i++) this.soplo(v(2000), 3, 0.05, 0.25, 0.05 + i * 0.07); break;
      case 'arco': this.tono(v(180), 120, 0.12, 0.35, 'triangle'); this.tono(v(360), 240, 0.08, 0.15, 'sine'); break;
      case 'flecha': this.soplo(v(3000), 2, 0.2, 0.18, 0, 1200); break;
      case 'clavar': this.tono(v(400), 150, 0.06, 0.3, 'triangle'); this.soplo(1800, 3, 0.04, 0.2); break;
      case 'moneda': this.vidrio(1760, 0.1); this.vidrio(2349, 0.08, 0.06, 0.5); break;
      case 'fuego': this.soplo(v(1600), 0.7, 0.14, 0.12, 0, 900); break;
      case 'barco': this.tono(110, 108, 1.6, 0.35, 'sawtooth', 0, 0.5); this.tono(165, 163, 1.6, 0.25, 'sawtooth', 0, 0.5); break;
      case 'victoria': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tono(f, f, 0.22, 0.2, 'square', i * 0.14, 0.2)); break;
      case 'faro': for (let i = 0; i < 4; i++) this.vidrio(784 + i * 196, 0.12, i * 0.18, 1.2); break;
      default: break;
    }
  }

  // ── ambiente: olas, pájaros, grillos, gotas en la mina ──────────────────
  armarAmbiente() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.ruido; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    this.olas = c.createGain(); this.olas.gain.value = 0.0;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.11; lg.gain.value = 0.09;
    lfo.connect(lg); lg.connect(this.olas.gain);
    s.connect(f); f.connect(this.olas); this.olas.connect(this.bAmb);
    s.start(); lfo.start();
    this.tAmb = 0;
  }

  actualizarAmbiente(dt, cercaMar, noche, bajoTierra) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.olas.gain.setTargetAtTime(bajoTierra ? 0.0 : 0.1 + 0.18 * cercaMar, t, 0.8);
    this.tAmb -= dt;
    if (this.tAmb > 0) return;
    this.tAmb = 0.6 + Math.random() * 2.5;
    if (bajoTierra) {
      if (Math.random() < 0.5) { const f = 900 + Math.random() * 1400; this.tono(f, f * 0.6, 0.12, 0.08, 'sine', 0, 0.8, this.bAmb); }
    } else if (noche > 0.6) {
      for (let i = 0; i < 3; i++) this.tono(4200, 4150, 0.03, 0.025, 'square', i * 0.07, 0, this.bAmb);
    } else if (Math.random() < 0.55) {
      const f = 2200 + Math.random() * 1600;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tono(f, f * (1.15 + Math.random() * 0.2), 0.07, 0.04, 'sine', i * 0.11, 0.3, this.bAmb);
    }
  }

  // ── música: marimba sobre cuatro acordes fijos (una progresión al azar
  //    suena a nada; la lección de ritmo/) ──────────────────────────────────
  musica(tema) {
    if (!this.ctx) { this.pendiente = tema; return; }
    if (this.temaActual === tema) return;
    this.temaActual = tema;
    if (this.relojMusica) clearInterval(this.relojMusica);
    if (!tema) return;
    const PROG = tema === 'menu' ? [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]] : [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
    const bpm = tema === 'menu' ? 92 : 80, negra = 60 / bpm;
    let paso = 0;
    const c = this.ctx;
    let prox = c.currentTime + 0.1;
    const marimba = (midi, t, vol) => {
      const f = 440 * 2 ** ((midi - 69) / 12);
      const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
      o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 4;
      this.env(g, t, 0.004, vol, 0.0001, 0.5 + (84 - midi) * 0.01); this.env(g2, t, 0.002, vol * 0.25, 0.0001, 0.06);
      o.connect(g); o2.connect(g2); g.connect(this.bMusica); g2.connect(this.bMusica);
      const r = c.createGain(); r.gain.value = 0.3; g.connect(r); r.connect(this.bRev);
      o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 0.2);
    };
    this.relojMusica = setInterval(() => {
      // programar medio segundo adelante: el reloj del audio no se atrasa aunque el hilo se trabe
      while (prox < c.currentTime + 0.5) {
        const acorde = PROG[Math.floor(paso / 8) % 4];
        const i = paso % 8;
        const nota = acorde[[0, 1, 2, 1, 0, 2, 1, 2][i]] + (i >= 4 ? 12 : 0);
        marimba(nota, prox, i % 2 ? 0.07 : 0.1);
        if (i === 0) marimba(acorde[0] - 12, prox, 0.12);
        prox += negra / 2; paso++;
      }
    }, 120);
  }
}
