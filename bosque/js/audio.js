// El sonido del bosque, todo sintetizado.
//
// NO HAY UN SOLO ARCHIVO DE AUDIO, y no por gusto: los generadores de música y
// de efectos de Higgsfield están habilitados solo para su propio constructor
// de juegos, no para usarse sueltos. Así que el bosque suena con osciladores y
// ruido filtrado, y tiene una ventaja: nada se repite. Un loop de ambiente de
// treinta segundos se reconoce a la tercera vuelta; esto no tiene vueltas.
//
// LO QUE MÁS VENDE UN LUGAR ES LO QUE ESTÁ LEJOS. Los pájaros, el pájaro
// carpintero y el agua pasan por una reverberación armada al arrancar (ruido
// que se apaga en 2,6 s): sin ella suenan pegados a la oreja, como en un
// estudio, y el bosque se achica a una habitación.
export class Sonido {
  constructor() {
    this.ctx = null;
    this.listo = false;
    this.interferencia = 0;
  }

  /** Solo puede arrancar después de un toque: los navegadores no dejan sonar
   *  nada antes de que la persona haga algo. */
  arrancar() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.maestro = c.createGain();
    this.maestro.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    this.maestro.connect(comp).connect(c.destination);

    // reverberación: ruido que decae, un poco más oscuro al final
    const largo = Math.floor(c.sampleRate * 2.6);
    const ir = c.createBuffer(2, largo, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let b = 0;
      for (let i = 0; i < largo; i++) {
        const t = i / largo;
        b = b * (0.2 + t * 0.7) + (Math.random() * 2 - 1) * (1 - (0.2 + t * 0.7));
        d[i] = b * Math.pow(1 - t, 2.4) * (i < c.sampleRate * 0.012 ? i / (c.sampleRate * 0.012) : 1);
      }
    }
    this.reverb = c.createConvolver();
    this.reverb.buffer = ir;
    this.envioRev = c.createGain(); this.envioRev.gain.value = 0.55;
    this.envioRev.connect(this.reverb).connect(this.maestro);

    // ruidos: blanco y marrón, de 4 s, en bucle
    const N = c.sampleRate * 4;
    this.blanco = c.createBuffer(1, N, c.sampleRate);
    this.marron = c.createBuffer(1, N, c.sampleRate);
    const wb = this.blanco.getChannelData(0), wm = this.marron.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < N; i++) {
      wb[i] = Math.random() * 2 - 1;
      ult = (ult + 0.02 * wb[i]) / 1.02;
      wm[i] = ult * 3.5;
    }

    this.armarViento();
    this.armarFuego();
    this.armarLago();
    this.armarEstatica();
    this.proximoPajaro = c.currentTime + 1.5;
    this.proximoCarpintero = c.currentTime + 14;
    this.listo = true;
  }

  fuente(buf, bucle = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = bucle;
    return s;
  }

  armarViento() {
    const c = this.ctx;
    // dos bandas: el soplido grave y el siseo de las agujas, cada una con su
    // propia ráfaga para que no suban y bajen juntas
    const bandas = [[380, 0.6, 0.55], [1500, 0.8, 0.18], [5200, 1.2, 0.06]];
    this.viento = bandas.map(([f, q, vol], i) => {
      const s = this.fuente(i === 0 ? this.marron : this.blanco);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      const pan = c.createStereoPanner(); pan.pan.value = (i - 1) * 0.4;
      s.connect(bp).connect(g).connect(pan).connect(this.maestro);
      s.start(c.currentTime + i * 0.37);
      return { g, bp, vol, fase: Math.random() * 100, f };
    });
  }

  armarFuego() {
    const c = this.ctx;
    const s = this.fuente(this.marron);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
    this.fuegoRugido = c.createGain(); this.fuegoRugido.gain.value = 0;
    this.fuegoPan = c.createStereoPanner();
    s.connect(lp).connect(this.fuegoRugido).connect(this.fuegoPan).connect(this.maestro);
    s.start();
    this.fuegoVol = 0;
    this.proximaChispa = 0;
  }

  armarLago() {
    const c = this.ctx;
    const s = this.fuente(this.marron);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 520; bp.Q.value = 0.9;
    this.lagoG = c.createGain(); this.lagoG.gain.value = 0;
    s.connect(bp).connect(this.lagoG).connect(this.maestro);
    this.lagoG.connect(this.envioRev);
    s.start();
  }

  armarEstatica() {
    const c = this.ctx;
    // la cinta: siseo agudo más el zumbido de 50 Hz de la red (Argentina)
    const s = this.fuente(this.blanco);
    const hp = c.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = 3800; hp.Q.value = 0.5;
    const zumbido = c.createOscillator(); zumbido.type = "sawtooth"; zumbido.frequency.value = 50;
    const lpZ = c.createBiquadFilter(); lpZ.type = "lowpass"; lpZ.frequency.value = 320;
    const gZ = c.createGain(); gZ.gain.value = 0.35;
    this.estatica = c.createGain(); this.estatica.gain.value = 0;
    s.connect(hp).connect(this.estatica);
    zumbido.connect(lpZ).connect(gZ).connect(this.estatica);
    this.estatica.connect(this.maestro);
    s.start(); zumbido.start();
    // el siseo de fondo de la cinta, siempre, bajito
    const s2 = this.fuente(this.blanco);
    const hp2 = c.createBiquadFilter(); hp2.type = "highpass"; hp2.frequency.value = 6000;
    this.siseo = c.createGain(); this.siseo.gain.value = 0.0;
    s2.connect(hp2).connect(this.siseo).connect(this.maestro);
    s2.start();
  }

  /** Un pájaro: frases de notas puras que se deslizan. Cada especie es una
   *  receta distinta; cada canto sale distinto dentro de su receta. */
  pajaro() {
    const c = this.ctx, t0 = c.currentTime + 0.05;
    const pan = c.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    const g = c.createGain();
    const lejos = 0.25 + Math.random() * 0.75;
    g.gain.value = 0.11 * lejos;
    const seco = c.createGain(); seco.gain.value = 0.5 * lejos;
    g.connect(pan); pan.connect(seco).connect(this.maestro); pan.connect(this.envioRev);
    const tipo = Math.random();
    const osc = c.createOscillator(); osc.type = "sine";
    const env = c.createGain(); env.gain.value = 0;
    osc.connect(env).connect(g);
    let t = t0;
    if (tipo < 0.5) {
      // zorzal: 3 a 6 notas que suben o bajan
      const base = 2400 + Math.random() * 1600, n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const f0 = base * (1 + (Math.random() - 0.4) * 0.5), f1 = f0 * (0.8 + Math.random() * 0.5), d = 0.07 + Math.random() * 0.12;
        osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + d);
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.012); env.gain.linearRampToValueAtTime(0, t + d);
        t += d + 0.04 + Math.random() * 0.09;
      }
    } else if (tipo < 0.82) {
      // trino: una nota que tiembla rápido
      const f = 4200 + Math.random() * 1800, d = 0.5 + Math.random() * 0.6;
      osc.frequency.setValueAtTime(f, t);
      const am = c.createOscillator(); am.frequency.value = 22 + Math.random() * 12;
      const amG = c.createGain(); amG.gain.value = 0.5;
      am.connect(amG).connect(env.gain);
      env.gain.setValueAtTime(0.5, t); env.gain.linearRampToValueAtTime(0, t + d);
      am.start(t); am.stop(t + d + 0.05);
      t += d;
    } else {
      // uno que silba dos notas, lejos: la segunda más baja
      for (const [f, d] of [[1900, 0.32], [1500, 0.45]]) {
        osc.frequency.setValueAtTime(f * (1 + Math.random() * 0.06), t);
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.8, t + 0.05); env.gain.linearRampToValueAtTime(0, t + d);
        t += d + 0.12;
      }
    }
    osc.start(t0); osc.stop(t + 0.1);
    osc.onended = () => { g.disconnect(); pan.disconnect(); };
  }

  carpintero() {
    const c = this.ctx;
    const pan = c.createStereoPanner(); pan.pan.value = Math.random() * 1.4 - 0.7;
    const g = c.createGain(); g.gain.value = 0.16;
    g.connect(pan); pan.connect(this.maestro); pan.connect(this.envioRev);
    const n = 12 + Math.floor(Math.random() * 8), ritmo = 1 / (15 + Math.random() * 6);
    let t = c.currentTime + 0.05;
    for (let i = 0; i < n; i++) {
      const s = this.fuente(this.blanco, false);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900 + Math.random() * 100; bp.Q.value = 7;
      const e = c.createGain(); e.gain.setValueAtTime(1 - i / n * 0.6, t); e.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      s.connect(bp).connect(e).connect(g);
      s.start(t, Math.random() * 3, 0.04);
      t += ritmo * (1 + i / n * 0.25);
    }
  }

  /** Un paso. `v` de 0 a 1 (caminar a correr), `hondo` metros de agua. */
  paso(v, hondo, sobreSendero) {
    if (!this.listo) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.fuente(this.blanco, false);
    const g = c.createGain();
    const vol = 0.18 + v * 0.22;
    if (hondo > 0.08) {
      // en el agua: un chapoteo que se abre
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.22);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 1.4, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      s.connect(bp).connect(g).connect(this.maestro);
      s.start(t, Math.random() * 3, 0.35);
      return;
    }
    const lp = c.createBiquadFilter(); lp.type = "lowpass";
    lp.frequency.value = sobreSendero ? 700 + Math.random() * 300 : 1400 + Math.random() * 900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09 + v * 0.03);
    s.connect(lp).connect(g).connect(this.maestro);
    s.start(t, Math.random() * 3, 0.14);
    // el crujido de las agujas y las ramitas, fuera del sendero
    if (!sobreSendero) {
      const s2 = this.fuente(this.blanco, false);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 3200 + Math.random() * 2000; bp.Q.value = 2.5;
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0, t + 0.01); g2.gain.linearRampToValueAtTime(vol * 0.35, t + 0.02); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      s2.connect(bp).connect(g2).connect(this.maestro);
      s2.start(t, Math.random() * 3, 0.1);
    }
  }

  /** La casetera: el clac de la cinta al entrar y el motor. */
  recoger() {
    if (!this.listo) return;
    const c = this.ctx, t = c.currentTime;
    const s = this.fuente(this.blanco, false);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    s.connect(bp).connect(g).connect(this.maestro);
    s.start(t, 0, 0.08);
    const m = c.createOscillator(); m.type = "sawtooth";
    m.frequency.setValueAtTime(70, t + 0.1); m.frequency.linearRampToValueAtTime(190, t + 1.0);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
    const gm = c.createGain(); gm.gain.setValueAtTime(0, t + 0.1); gm.gain.linearRampToValueAtTime(0.1, t + 0.3); gm.gain.linearRampToValueAtTime(0, t + 1.3);
    m.connect(lp).connect(gm).connect(this.maestro);
    m.start(t + 0.1); m.stop(t + 1.4);
  }

  /** Una vez por cuadro, con lo que el oído necesita saber del mundo. */
  actualizar(dt, e) {
    if (!this.listo) return;
    const c = this.ctx, t = c.currentTime;
    // el viento: ráfagas lentas que no se repiten
    for (const b of this.viento) {
      b.fase += dt * (0.08 + b.f / 40000);
      const racha = 0.55 + 0.45 * Math.sin(b.fase) * Math.sin(b.fase * 0.37 + 1.1);
      b.g.gain.setTargetAtTime(b.vol * racha * (e.enAbierto ? 1.25 : 0.85), t, 0.4);
    }
    if (t > this.proximoPajaro) { this.pajaro(); this.proximoPajaro = t + 1.2 + Math.random() * 5.5; }
    if (t > this.proximoCarpintero) { this.carpintero(); this.proximoCarpintero = t + 25 + Math.random() * 40; }

    // el fuego: se oye si estás cerca, y del lado donde está
    const vf = 1 / (1 + (e.dFuego / 5) ** 2);
    this.fuegoRugido.gain.setTargetAtTime(vf * 0.35, t, 0.2);
    this.fuegoPan.pan.setTargetAtTime(e.panFuego, t, 0.1);
    if (vf > 0.02 && t > this.proximaChispa) {
      const s = this.fuente(this.blanco, false);
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1500 + Math.random() * 3000;
      const g = c.createGain(); g.gain.setValueAtTime(vf * (0.15 + Math.random() * 0.4), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.012 + Math.random() * 0.02);
      s.connect(hp).connect(g).connect(this.fuegoPan);
      s.start(t, Math.random() * 3, 0.04);
      this.proximaChispa = t + Math.random() * Math.random() * 0.25;
    }
    // el agua que lame la orilla
    const ola = 0.6 + 0.4 * Math.sin(t * 0.9) * Math.sin(t * 0.31);
    this.lagoG.gain.setTargetAtTime(e.cercaAgua * 0.16 * ola, t, 0.3);
    // la cinta que está cerca: estática que crece
    this.estatica.gain.setTargetAtTime(this.interferencia * this.interferencia * 0.2, t, 0.15);
    this.siseo.gain.setTargetAtTime(e.vhs ? 0.012 : 0, t, 0.5);
  }

  silencio(si) {
    if (!this.ctx) return;
    this.maestro.gain.setTargetAtTime(si ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }
}
