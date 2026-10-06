/* ============================================================================
   barro/js/sonido.js — todo el sonido sintetizado con WebAudio (no hay
   archivos): el motor del jugador (dos osciladores con distorsión, que suben
   de vueltas y cambian de marcha), el ruido de la manada de rivales, la
   tierra que tira la rueda, los golpes al caer, la caída, el portón, la
   cuenta, el público y la música (rock en Mi menor, con batería).
   ========================================================================== */
let A = null;
const S = { vol: { musica: 0.55, efectos: 0.9 } };

export function iniciarSonido() {
  if (A) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4; comp.connect(ctx.destination);
  const efectos = ctx.createGain(); efectos.gain.value = S.vol.efectos; efectos.connect(comp);
  const musica = ctx.createGain(); musica.gain.value = S.vol.musica * 0.55; musica.connect(comp);
  // ruido blanco de 2 s para todo lo que suena a roce
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  A = { ctx, comp, efectos, musica, ruido: nb, motor: null, manada: null, tierra: null, publico: null, tema: null };
  armarMotor(); armarLazos();
}
export function volumen(tipo, v) { S.vol[tipo] = v; if (!A) return; if (tipo === 'efectos') A.efectos.gain.value = v; else A.musica.gain.value = v * 0.55; }

function curvaDist(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  return c;
}
function ruidoLazo(filtro, f, q) {
  const s = A.ctx.createBufferSource(); s.buffer = A.ruido; s.loop = true;
  const fl = A.ctx.createBiquadFilter(); fl.type = filtro; fl.frequency.value = f; fl.Q.value = q;
  const g = A.ctx.createGain(); g.gain.value = 0;
  s.connect(fl); fl.connect(g); g.connect(A.efectos); s.start();
  return { s, fl, g };
}
function armarMotor() {
  const c = A.ctx;
  const o1 = c.createOscillator(), o2 = c.createOscillator(), o3 = c.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'sawtooth';
  const ws = c.createWaveShaper(); ws.curve = curvaDist(18);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 3;
  const g = c.createGain(); g.gain.value = 0;
  const g2 = c.createGain(); g2.gain.value = 0.35; o2.connect(g2);
  o1.connect(ws); g2.connect(ws); o3.connect(ws); ws.connect(lp); lp.connect(g); g.connect(A.efectos);
  o1.start(); o2.start(); o3.start();
  A.motor = { o1, o2, o3, lp, g, rpm: 0.2, marcha: 1 };
  // la manada de rivales, más grave y lejana
  const m1 = c.createOscillator(), m2 = c.createOscillator(); m1.type = 'sawtooth'; m2.type = 'sawtooth';
  const mws = c.createWaveShaper(); mws.curve = curvaDist(8);
  const mlp = c.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 700;
  const mg = c.createGain(); mg.gain.value = 0;
  m1.connect(mws); m2.connect(mws); mws.connect(mlp); mlp.connect(mg); mg.connect(A.efectos);
  m1.start(); m2.start();
  A.manada = { m1, m2, mg };
}
function armarLazos() {
  A.tierra = ruidoLazo('bandpass', 1400, 0.8);
  A.publico = ruidoLazo('bandpass', 900, 0.6);
  A.viento = ruidoLazo('highpass', 2500, 0.5);
}

/* cada cuadro: cómo suena la moto del jugador y el resto */
export function motor(estado) {
  if (!A) return;
  const t = A.ctx.currentTime, M = A.motor;
  const { v = 0, gas = 0, aire = false, caido = false, gira = 0, rivales = 0, publico = 0, activo = true } = estado;
  // la caja: cada marcha cubre 7 m/s; en el aire con gas, se dispara
  const marcha = Math.min(4, Math.floor(v / 7.5));
  let objetivo = aire ? 0.35 + gas * 0.6 : 0.22 + ((v - marcha * 7.5) / 7.5) * 0.65 + gas * 0.12;
  if (caido) objetivo = 0.12;
  if (marcha !== M.marcha) { M.marcha = marcha; M.rpm *= 0.72; }
  M.rpm += (Math.max(0.1, Math.min(1, objetivo)) - M.rpm) * 0.12;
  const f = 32 + M.rpm * 92;
  M.o1.frequency.setTargetAtTime(f, t, 0.02); M.o2.frequency.setTargetAtTime(f * 0.5, t, 0.02); M.o3.frequency.setTargetAtTime(f * 1.007, t, 0.02);
  M.lp.frequency.setTargetAtTime(500 + M.rpm * 1800 + gas * 600, t, 0.04);
  M.g.gain.setTargetAtTime(activo ? (caido ? 0.04 : 0.1 + gas * 0.12 + M.rpm * 0.05) : 0, t, 0.05);
  A.manada.m1.frequency.setTargetAtTime(38 + rivales * 30, t, 0.1); A.manada.m2.frequency.setTargetAtTime(41 + rivales * 33, t, 0.1);
  A.manada.mg.gain.setTargetAtTime(activo ? rivales * 0.08 : 0, t, 0.1);
  A.tierra.g.gain.setTargetAtTime(activo ? Math.min(0.25, gira * 0.3) : 0, t, 0.05);
  A.viento.g.gain.setTargetAtTime(activo ? Math.min(0.08, v / 300) : 0, t, 0.1);
  A.publico.g.gain.setTargetAtTime(publico * 0.09 * (0.8 + 0.2 * Math.sin(t * 2.3)), t, 0.2);
}

function env(g, t, a, pico, dura) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(pico, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dura); }
function golpeRuido(t, f, pico, dura, tipo = 'lowpass') {
  const s = A.ctx.createBufferSource(); s.buffer = A.ruido;
  const fl = A.ctx.createBiquadFilter(); fl.type = tipo; fl.frequency.value = f;
  const g = A.ctx.createGain(); env(g, t, 0.003, pico, dura);
  s.connect(fl); fl.connect(g); g.connect(A.efectos); s.start(t, Math.random()); s.stop(t + dura + 0.1);
}
function tono(t, f, tipo, pico, dura, fFin) {
  const o = A.ctx.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (fFin) o.frequency.exponentialRampToValueAtTime(fFin, t + dura);
  const g = A.ctx.createGain(); env(g, t, 0.004, pico, dura);
  o.connect(g); g.connect(A.efectos); o.start(t); o.stop(t + dura + 0.1);
}

export function sfx(n, k = 1) {
  if (!A) return;
  const t = A.ctx.currentTime;
  switch (n) {
    case 'cae': tono(t, 70, 'sine', 0.5 * k, 0.25, 34); golpeRuido(t, 500, 0.35 * k, 0.2); break;
    case 'perfecto': tono(t, 880, 'triangle', 0.12, 0.12); tono(t + 0.07, 1320, 'triangle', 0.12, 0.18); break;
    case 'caida': golpeRuido(t, 900, 0.6, 0.5); tono(t, 90, 'square', 0.25, 0.3, 40); tono(t + 0.08, 420, 'square', 0.08, 0.06); tono(t + 0.16, 310, 'square', 0.06, 0.06); break;
    case 'porton': tono(t, 180, 'square', 0.25, 0.12, 90); golpeRuido(t, 2500, 0.35, 0.15, 'bandpass'); break;
    case 'bip': tono(t, 660, 'square', 0.16, 0.12); break;
    case 'ya': tono(t, 990, 'square', 0.2, 0.4); break;
    case 'clic': tono(t, 1200, 'triangle', 0.08, 0.04); break;
    case 'plata': tono(t, 1046, 'triangle', 0.1, 0.08); tono(t + 0.06, 1568, 'triangle', 0.1, 0.14); break;
    case 'ovacion': golpeRuido(t, 1100, 0.35, 2.2, 'bandpass'); break;
    case 'meta': [523, 659, 784, 1046].forEach((f, i) => tono(t + i * 0.09, f, 'square', 0.12, 0.22)); break;
    case 'pasa': tono(t, 520, 'sawtooth', 0.05, 0.3, 380); break;
  }
}

/* ---------- la música ---------- */
const MI = 40; // Mi grave (midi)
const CANCION = {
  carrera: { bpm: 142, acordes: [0, 0, 8, 8, 3, 3, 10, 10], bateria: true },
  menu: { bpm: 104, acordes: [0, 8, 3, 10], bateria: false },
};
export function musica(nombre) {
  if (!A) return;
  if (A.tema && A.tema.nombre === nombre) return;
  if (A.tema) { clearInterval(A.tema.reloj); A.tema.salida.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3); }
  if (!nombre) { A.tema = null; return; }
  const c = A.ctx, cfg = CANCION[nombre], negra = 60 / cfg.bpm, cor = negra / 2;
  const salida = c.createGain(); salida.gain.value = 0; salida.connect(A.musica); salida.gain.setTargetAtTime(1, c.currentTime, 0.4);
  const tema = { nombre, salida, paso: 0, prox: c.currentTime + 0.1 };
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const nota = (t, m, tipo, vol, dura, corte = 1800) => {
    const o = c.createOscillator(); o.type = tipo; o.frequency.value = hz(m);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = corte;
    const g = c.createGain(); env(g, t, 0.005, vol, dura);
    o.connect(f); f.connect(g); g.connect(salida); o.start(t); o.stop(t + dura + 0.05);
  };
  const tambor = (t, tipo) => {
    if (tipo === 'bombo') { const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const g = c.createGain(); env(g, t, 0.002, 0.5, 0.18); o.connect(g); g.connect(salida); o.start(t); o.stop(t + 0.3); }
    else {
      const s = c.createBufferSource(); s.buffer = A.ruido;
      const f = c.createBiquadFilter(); f.type = tipo === 'caja' ? 'bandpass' : 'highpass'; f.frequency.value = tipo === 'caja' ? 1800 : 7000;
      const g = c.createGain(); env(g, t, 0.002, tipo === 'caja' ? 0.3 : 0.07, tipo === 'caja' ? 0.14 : 0.04);
      s.connect(f); f.connect(g); g.connect(salida); s.start(t, Math.random()); s.stop(t + 0.2);
    }
  };
  tema.reloj = setInterval(() => {
    while (tema.prox < c.currentTime + 0.25) {
      const t = tema.prox, p = tema.paso, compas = Math.floor(p / 8) % cfg.acordes.length, i = p % 8;
      const raiz = MI + cfg.acordes[compas];
      if (cfg.bateria) {
        // guitarra: quinta con distorsión en corcheas, bajo y batería
        nota(t, raiz + 12, 'sawtooth', 0.05, cor * 0.9, 1400); nota(t, raiz + 19, 'sawtooth', 0.04, cor * 0.9, 1400);
        nota(t, raiz, 'triangle', 0.18, cor * 0.95, 600);
        if (i % 4 === 0) tambor(t, 'bombo');
        if (i === 6) tambor(t, 'bombo');
        if (i % 4 === 2) tambor(t, 'caja');
        tambor(t, 'platillo');
        if (i === 0 && compas % 2 === 0) nota(t, raiz + 24 + [0, 3, 5, 7][compas % 4], 'square', 0.035, negra * 1.5, 2600);
      } else {
        const arpegio = [0, 7, 12, 15, 12, 7, 3, 7][i];
        nota(t, raiz + 12 + arpegio, 'triangle', 0.07, cor * 1.6, 2200);
        if (i === 0) nota(t, raiz, 'sine', 0.16, negra * 3.5, 500);
      }
      tema.prox += cor; tema.paso++;
    }
  }, 60);
  A.tema = tema;
}
export function pausarSonido(si) { if (A) { if (si) A.ctx.suspend(); else A.ctx.resume(); } }
