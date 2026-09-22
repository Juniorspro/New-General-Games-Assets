// Sonido sintetizado. Ni un archivo: se fabrica con osciladores.
//
// EL LIMITE DE VOCES EXISTE POR UNA RAZON. Con doscientos bichos muriendo, un
// sonido por muerte son cincuenta voces por segundo: el navegador se traba y lo
// que se escucha es un zumbido. Acá hay un techo por tipo y por ventana de
// tiempo — si ya sonó hace poco, el siguiente no suena. Se pierde nada y se
// gana que se entienda lo que pasa.

export class Ruido {
  constructor() { this.AC = null; this.vol = 1; this.ultimo = {}; }

  despertar() {
    if (this.AC) { if (this.AC.state === "suspended") this.AC.resume(); return true; }
    try { this.AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    this.maestro = this.AC.createGain();
    this.maestro.gain.value = 0.55;
    this.maestro.connect(this.AC.destination);
    return true;
  }

  /** ¿Puede sonar `n` otra vez? Separa las repeticiones al menos `sep` segundos. */
  deja(n, sep) {
    if (!this.AC) return false;
    const t = this.AC.currentTime;
    if (this.ultimo[n] && t - this.ultimo[n] < sep) return false;
    this.ultimo[n] = t;
    return true;
  }

  env(cuando, pico, ataque, caida) {
    const g = this.AC.createGain();
    g.gain.setValueAtTime(0.0001, cuando);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico * this.vol), cuando + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, cuando + ataque + caida);
    g.connect(this.maestro);
    return g;
  }

  ruidoBuf(seg) {
    const n = Math.max(1, (this.AC.sampleRate * seg) | 0);
    const b = this.AC.createBuffer(1, n, this.AC.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = this.AC.createBufferSource(); s.buffer = b; return s;
  }

  tono(hz, hz2, pico, largo, tipo = "square") {
    const t = this.AC.currentTime;
    const o = this.AC.createOscillator(); o.type = tipo;
    o.frequency.setValueAtTime(hz, t);
    if (hz2) o.frequency.exponentialRampToValueAtTime(hz2, t + largo);
    o.connect(this.env(t, pico, 0.004, largo));
    o.start(t); o.stop(t + largo + 0.08);
  }

  tiro()   { if (this.deja("tiro", 0.07))  this.tono(680, 380, 0.045, 0.06, "square"); }
  pega()   { if (this.deja("pega", 0.045)) this.tono(300, 170, 0.035, 0.05, "triangle"); }
  muere()  {
    if (!this.deja("muere", 0.055)) return;
    const t = this.AC.currentTime, s = this.ruidoBuf(0.1);
    const f = this.AC.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1400;
    s.connect(f); f.connect(this.env(t, 0.06, 0.003, 0.08));
    s.start(t); s.stop(t + 0.14);
  }
  gema()   { if (this.deja("gema", 0.05))  this.tono(1250, 1750, 0.03, 0.05, "sine"); }
  golpe()  { if (!this.deja("golpe", 0.2)) return;
             const t = this.AC.currentTime, s = this.ruidoBuf(0.25);
             const f = this.AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 480;
             s.connect(f); f.connect(this.env(t, 0.18, 0.004, 0.22)); s.start(t); s.stop(t + 0.3); }
  onda()   { if (this.deja("onda", 0.2))   this.tono(140, 60, 0.13, 0.28, "sine"); }
  nivel()  { if (!this.AC) return;
             // tres notas que suben: es el único sonido que celebra algo
             [523, 659, 880].forEach((hz, i) => setTimeout(() => this.tono(hz, hz, 0.09, 0.16, "triangle"), i * 85)); }
  jefe()   { if (!this.AC) return; this.tono(90, 42, 0.26, 0.9, "sawtooth"); }
  fin()    { if (!this.AC) return; [440, 330, 262].forEach((hz, i) => setTimeout(() => this.tono(hz, hz, 0.1, 0.3, "triangle"), i * 150)); }
}
