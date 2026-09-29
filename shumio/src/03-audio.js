// ─────────────────────────────────────────────────────────────────────────────
// EL SONIDO, sintetizado (sin archivos): efectos con osciladores y un búfer de ruido, y una
// música oscura por pasos (un bordón grave, un arpegio de caja de música en menor, un coro
// de ruido filtrado; en el jefe, bajo y percusión). El AudioContext nace con el primer toque.
// ─────────────────────────────────────────────────────────────────────────────

let AC = null, SAL = null, MUS = null, EFX = null, RUIDO = null, ECO = null;
let volMusica = 0.55, volEfectos = 0.8;
try { const g = JSON.parse(localStorage.getItem("shumio-audio") || "{}"); if (g.m != null) volMusica = g.m; if (g.e != null) volEfectos = g.e; } catch (e) { /* sin guardar */ }

function audioDespertar() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    SAL = AC.createDynamicsCompressor(); SAL.threshold.value = -14; SAL.ratio.value = 4; SAL.connect(AC.destination);
    MUS = AC.createGain(); MUS.gain.value = volMusica; MUS.connect(SAL);
    EFX = AC.createGain(); EFX.gain.value = volEfectos; EFX.connect(SAL);
    // un eco de sótano (reverberación corta, ruido que se apaga)
    ECO = AC.createConvolver();
    const n = AC.sampleRate * 1.8, b = AC.createBuffer(2, n, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    ECO.buffer = b;
    const eg = AC.createGain(); eg.gain.value = 0.28; ECO.connect(eg); eg.connect(SAL);
    RUIDO = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const r = RUIDO.getChannelData(0); for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
    Musica.arrancar();
  } catch (e) { AC = null; }
}

function _tono({ f = 440, f2 = null, dur = 0.12, tipo = "square", vol = 0.2, ataque = 0.004, salida = EFX, eco = 0, cuando = 0, filtro = 0, q = 1 }) {
  if (!AC) return;
  const t = AC.currentTime + cuando, o = AC.createOscillator(), g = AC.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let n = o;
  if (filtro) { const fl = AC.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filtro; fl.Q.value = q; o.connect(fl); n = fl; }
  n.connect(g); g.connect(salida);
  if (eco) { const ge = AC.createGain(); ge.gain.value = eco; g.connect(ge); ge.connect(ECO); }
  o.start(t); o.stop(t + dur + 0.05);
}
function _ruido({ dur = 0.15, vol = 0.25, f = 1200, f2 = null, tipo = "lowpass", q = 1, salida = EFX, eco = 0, cuando = 0 }) {
  if (!AC) return;
  const t = AC.currentTime + cuando, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = RUIDO; s.playbackRate.value = 0.6 + Math.random() * 0.8;
  fl.type = tipo; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(salida);
  if (eco) { const ge = AC.createGain(); ge.gain.value = eco; g.connect(ge); ge.connect(ECO); }
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const va = (x, p = 0.1) => x * (1 - p + Math.random() * p * 2);   // variar ±10 % lo que se repite

const SFX = {
  lagrima: () => { _tono({ f: va(520), f2: 260, dur: 0.07, tipo: "sine", vol: 0.12 }); _ruido({ dur: 0.04, vol: 0.05, f: 2600 }); },
  chapoteo: () => { _ruido({ dur: 0.09, vol: 0.09, f: va(1800), f2: 500, tipo: "bandpass", q: 2 }); _tono({ f: va(300), f2: 120, dur: 0.06, tipo: "sine", vol: 0.06 }); },
  golpe: () => { _ruido({ dur: 0.08, vol: 0.18, f: va(900), f2: 200 }); _tono({ f: va(180), f2: 70, dur: 0.08, tipo: "square", vol: 0.07, filtro: 900 }); },
  dolor: () => { _tono({ f: 330, f2: 150, dur: 0.28, tipo: "sawtooth", vol: 0.16, filtro: 1400, q: 6, eco: 0.3 }); _tono({ f: 340, f2: 155, dur: 0.28, tipo: "sawtooth", vol: 0.1, filtro: 1200 }); _ruido({ dur: 0.12, vol: 0.12, f: 700 }); },
  muere: () => { _ruido({ dur: 0.25, vol: 0.22, f: va(1400), f2: 180, eco: 0.25 }); _tono({ f: va(140), f2: 45, dur: 0.22, tipo: "square", vol: 0.08, filtro: 600 }); },
  puertaAbre: () => { _ruido({ dur: 0.35, vol: 0.2, f: 400, f2: 120, q: 3, eco: 0.4 }); _tono({ f: 70, f2: 50, dur: 0.3, tipo: "sine", vol: 0.25 }); },
  puertaCierra: () => { _tono({ f: 90, f2: 40, dur: 0.25, tipo: "sine", vol: 0.35, eco: 0.4 }); _ruido({ dur: 0.18, vol: 0.25, f: 500, f2: 90 }); },
  objeto: () => { [0, 4, 7, 12, 16].forEach((s, i) => _tono({ f: 392 * Math.pow(2, s / 12), dur: 0.35, tipo: "triangle", vol: 0.13, cuando: i * 0.07, eco: 0.45 })); },
  malo: () => { [0, -3, -7].forEach((s, i) => _tono({ f: 262 * Math.pow(2, s / 12), dur: 0.3, tipo: "sawtooth", vol: 0.08, filtro: 1100, cuando: i * 0.11, eco: 0.4 })); },
  moneda: () => { _tono({ f: 1318, dur: 0.07, tipo: "square", vol: 0.07 }); _tono({ f: 1760, dur: 0.18, tipo: "square", vol: 0.06, cuando: 0.06 }); },
  corazon: () => { _tono({ f: 523, f2: 784, dur: 0.16, tipo: "sine", vol: 0.16 }); _tono({ f: 784, dur: 0.2, tipo: "sine", vol: 0.1, cuando: 0.1 }); },
  llave: () => { _tono({ f: 2093, dur: 0.05, tipo: "triangle", vol: 0.1 }); _tono({ f: 2637, dur: 0.12, tipo: "triangle", vol: 0.08, cuando: 0.05 }); },
  recoger: () => { _tono({ f: 660, f2: 990, dur: 0.1, tipo: "triangle", vol: 0.12 }); },
  mecha: () => { _ruido({ dur: 0.9, vol: 0.05, f: 5000, tipo: "highpass" }); },
  explosion: () => { _ruido({ dur: 0.9, vol: 0.5, f: 1600, f2: 60, eco: 0.5 }); _tono({ f: 90, f2: 25, dur: 0.6, tipo: "sine", vol: 0.5 }); },
  roca: () => { _ruido({ dur: 0.22, vol: 0.25, f: 1100, f2: 200, q: 2 }); },
  moho: () => { _ruido({ dur: 0.12, vol: 0.14, f: va(700), f2: 250, q: 1.5 }); },
  jefe: () => { _tono({ f: 55, f2: 40, dur: 1.4, tipo: "sawtooth", vol: 0.25, filtro: 300, q: 8, eco: 0.6 }); _ruido({ dur: 1.2, vol: 0.18, f: 300, f2: 80, eco: 0.5 }); },
  secreto: () => { [0, 7, 12, 19].forEach((s, i) => _tono({ f: 523 * Math.pow(2, s / 12), dur: 0.5, tipo: "sine", vol: 0.1, cuando: i * 0.1, eco: 0.6 })); },
  clic: () => _tono({ f: 900, dur: 0.04, tipo: "square", vol: 0.06 }),
  escupe: () => { _ruido({ dur: 0.1, vol: 0.12, f: va(900), f2: 400, tipo: "bandpass", q: 3 }); },
  salto: () => _tono({ f: 180, f2: 90, dur: 0.18, tipo: "sine", vol: 0.14 }),
  cae: () => { _tono({ f: 80, f2: 30, dur: 0.3, tipo: "sine", vol: 0.4 }); _ruido({ dur: 0.25, vol: 0.25, f: 400, f2: 80 }); },
  zumbido: () => _tono({ f: va(220, 0.05), dur: 0.12, tipo: "sawtooth", vol: 0.02, filtro: 700 }),
  capsula: () => { _tono({ f: 300, f2: 600, dur: 0.12, tipo: "sine", vol: 0.12 }); _ruido({ dur: 0.08, vol: 0.06, f: 3000 }); },
  cargado: () => { _tono({ f: 880, dur: 0.08, tipo: "triangle", vol: 0.1 }); _tono({ f: 1320, dur: 0.15, tipo: "triangle", vol: 0.1, cuando: 0.07 }); },
  activo: () => { _tono({ f: 200, f2: 900, dur: 0.3, tipo: "sawtooth", vol: 0.08, filtro: 2000, eco: 0.4 }); },
  pacto: () => { [0, 1, 6].forEach((s, i) => _tono({ f: 110 * Math.pow(2, s / 12), dur: 1.2, tipo: "sawtooth", vol: 0.07, filtro: 600, cuando: i * 0.05, eco: 0.6 })); },
  pozo: () => { _tono({ f: 400, f2: 60, dur: 0.8, tipo: "sine", vol: 0.2, eco: 0.5 }); },
};

// ── la música: por pasos, con el reloj del audio (sin setTimeout que se atrase) ──
const ESCALAS = { menor: [0, 2, 3, 5, 7, 8, 10], frigio: [0, 1, 3, 5, 7, 8, 10] };
const TEMAS = {
  menu: { raiz: 45, escala: "menor", paso: 0.42, arpegio: [0, 4, 2, 7, 4, 2], bordon: true, coro: 0.5 },
  sotano: { raiz: 43, escala: "menor", paso: 0.36, arpegio: [0, 2, 4, 2, 7, 4, 2, 1], bordon: true, coro: 0.4, gotas: true },
  raices: { raiz: 41, escala: "frigio", paso: 0.33, arpegio: [0, 1, 4, 3, 7, 4, 1, 3], bordon: true, coro: 0.55, gotas: true },
  jefe: { raiz: 40, escala: "frigio", paso: 0.15, arpegio: [0, 0, 7, 0, 1, 0, 6, 3], bajo: true, bateria: true, coro: 0.2 },
  pacto: { raiz: 38, escala: "frigio", paso: 0.5, arpegio: [0, 1, 6, 1], bordon: true, coro: 0.8 },
  silencio: null,
};
const Musica = {
  tema: "silencio", deseado: "menu", paso: 0, prox: 0, nodosBordon: null,
  poner(n) { this.deseado = n; },
  arrancar() { this.prox = AC.currentTime + 0.1; setInterval(() => this.tic(), 60); },
  midi: (m) => 440 * Math.pow(2, (m - 69) / 12),
  tic() {
    if (!AC) return;
    if (this.deseado !== this.tema) this.cambiar();
    const t = TEMAS[this.tema];
    if (!t) return;
    const esc = ESCALAS[t.escala];
    while (this.prox < AC.currentTime + 0.25) {
      const cuando = this.prox - AC.currentTime, i = this.paso++;
      const g = t.arpegio[i % t.arpegio.length], oct = Math.floor(g / 7), nota = t.raiz + 24 + esc[g % 7] + oct * 12;
      if (!t.bajo || i % 2 === 0) _tono({ f: this.midi(nota), dur: t.paso * 2.6, tipo: "triangle", vol: t.bajo ? 0.035 : 0.07, salida: MUS, eco: 0.55, cuando });
      if (t.bajo) { const b = t.raiz + esc[(i >> 3) % 2 ? 1 : 0]; _tono({ f: this.midi(b), dur: t.paso * 0.9, tipo: "sawtooth", vol: 0.1, filtro: 420, q: 5, salida: MUS, cuando }); }
      if (t.bateria) {
        if (i % 4 === 0) _tono({ f: 120, f2: 38, dur: 0.22, tipo: "sine", vol: 0.45, salida: MUS, cuando });
        if (i % 8 === 4) _ruido({ dur: 0.16, vol: 0.18, f: 1800, tipo: "bandpass", salida: MUS, cuando });
        if (i % 2 === 1) _ruido({ dur: 0.03, vol: 0.04, f: 7000, tipo: "highpass", salida: MUS, cuando });
      }
      if (t.coro && i % 16 === 0) { const f = this.midi(t.raiz + 12 + esc[(i >> 4) % 3 * 2]); _tono({ f, dur: t.paso * 14, tipo: "sine", vol: 0.05 * t.coro, ataque: 1.6, salida: MUS, eco: 0.8, cuando }); _tono({ f: f * 1.5, dur: t.paso * 14, tipo: "sine", vol: 0.03 * t.coro, ataque: 2.0, salida: MUS, eco: 0.8, cuando }); }
      if (t.gotas && Math.random() < 0.06) _tono({ f: 1800 + Math.random() * 1400, f2: 900, dur: 0.12, tipo: "sine", vol: 0.03, salida: MUS, eco: 0.9, cuando });
      this.prox += t.paso;
    }
  },
  cambiar() {
    if (this.nodosBordon) { const { o, g } = this.nodosBordon; g.gain.setTargetAtTime(0.0001, AC.currentTime, 0.4); o.forEach((x) => x.stop(AC.currentTime + 2)); this.nodosBordon = null; }
    this.tema = this.deseado; this.paso = 0; this.prox = Math.max(this.prox, AC.currentTime + 0.05);
    const t = TEMAS[this.tema];
    if (t && t.bordon) {
      const g = AC.createGain(), fl = AC.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 260; fl.Q.value = 2;
      g.gain.value = 0.0001; g.gain.setTargetAtTime(0.09, AC.currentTime, 1.5);
      const o = [0, 7, -12].map((s, k) => { const x = AC.createOscillator(); x.type = k === 2 ? "sine" : "sawtooth"; x.frequency.value = this.midi(t.raiz + s); x.detune.value = (k - 1) * 7; x.connect(fl); x.start(); return x; });
      fl.connect(g); g.connect(MUS);
      this.nodosBordon = { o, g };
    }
  },
};
function guardarVolumen() { try { localStorage.setItem("shumio-audio", JSON.stringify({ m: volMusica, e: volEfectos })); } catch (e) { /* nada */ } if (MUS) { MUS.gain.value = volMusica; EFX.gain.value = volEfectos; } }
