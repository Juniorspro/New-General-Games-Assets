// ─────────────────────────────────────────────────────────────────────────────
// EL SONIDO, HORNEADO. Lección de Shumio (memoria/juegos.md): sintetizar en vivo NO entra en tiempo
// real en el teléfono del usuario (TCL T671E) y Android deja la salida muda. Acá cada efecto y cada
// tema se renderiza UNA vez con OfflineAudioContext (mono, 24 kHz, con la sala incluida) y en vivo
// sólo se tocan buffers: un BufferSource + un Gain por sonido.
// El contexto se crea SÓLO en un gesto de verdad (pointerup/touchend/click/keydown).
// ─────────────────────────────────────────────────────────────────────────────

const SR = 24000;
const AU = { ctx: null, master: null, mus: null, sfx: null, buf: {}, listo: false, horneando: false, tema: null, fuente: null, ultimo: {}, voces: 0 };

function audioDespertar() {
  try {
    if (!AU.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      try { AU.ctx = new C({ sampleRate: SR, latencyHint: "playback" }); } catch (e) { AU.ctx = new C(); }
      AU.master = AU.ctx.createGain(); AU.master.connect(AU.ctx.destination);
      AU.mus = AU.ctx.createGain(); AU.mus.connect(AU.master);
      AU.sfx = AU.ctx.createGain(); AU.sfx.connect(AU.master);
      volumenes();
      // un buffer vacío tocado en el gesto destraba la salida en los WebView viejos
      const b = AU.ctx.createBuffer(1, 1, AU.ctx.sampleRate), s = AU.ctx.createBufferSource(); s.buffer = b; s.connect(AU.master); s.start();
      hornearTodo();
    }
    if (AU.ctx.state !== "running") AU.ctx.resume().catch(() => {});
  } catch (e) { /* sin audio: se juega igual */ }
}
function volumenes() { if (!AU.ctx) return; AU.mus.gain.value = G.op.musica * 0.55; AU.sfx.gain.value = G.op.efectos * 0.8; }

// ── la caja de herramientas offline: cada receta arma su grafo sobre un OfflineAudioContext ──
function _ruidoBuf(c, seg) { const b = c.createBuffer(1, Math.ceil(seg * c.sampleRate), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
/** Una envolvente ADSR simple sobre un gain. */
function env(gn, t, a, d, s, r, dur, pico = 1) {
  const p = gn.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(pico, t + a);
  p.exponentialRampToValueAtTime(Math.max(0.0002, pico * s), t + a + d);
  p.setValueAtTime(Math.max(0.0002, pico * s), t + Math.max(a + d, dur)); p.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
  return t + Math.max(a + d, dur) + r;
}
function osc(c, tipo, f, t, fin, dest, f2, tf) {
  const o = c.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (tf || (fin - t)));
  o.connect(dest); o.start(t); o.stop(fin + 0.02); return o;
}
function ruido(c, t, fin, dest, tipo = "bandpass", f = 1000, q = 1, f2) {
  const s = c.createBufferSource(); s.buffer = c.__ruido || (c.__ruido = _ruidoBuf(c, 2)); s.loop = true;
  const fl = c.createBiquadFilter(); fl.type = tipo; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, fin);
  s.connect(fl); fl.connect(dest); s.start(t); s.stop(fin + 0.02); return fl;
}
function gan(c, dest, v = 1) { const x = c.createGain(); x.gain.value = v; x.connect(dest); return x; }
/** La sala: una respuesta al impulso de ruido que se apaga (catedral chica). */
function sala(c, dest, seg = 1.6, mezcla = 0.3) {
  const cv = c.createConvolver(), n = Math.ceil(seg * c.sampleRate), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
  cv.buffer = b; const seco = gan(c, dest, 1), hum = gan(c, dest, mezcla); cv.connect(hum);
  const ent = c.createGain(); ent.connect(seco); ent.connect(cv); return ent;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ── los efectos: [duración, receta(c, salida)] ──
const RECETAS = {
  gema: [0.12, (c, o) => { const x = gan(c, o); env(x, 0, 0.003, 0.05, 0.3, 0.05, 0.02, 0.5); osc(c, "sine", 1320, 0, 0.12, x, 1980, 0.04); osc(c, "triangle", 2640, 0, 0.08, gan(c, x, 0.2)); }],
  moneda: [0.35, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.08, 0.35, 0.22, 0.02, 0.45); osc(c, "square", 1568, 0, 0.06, gan(c, x, 0.25)); osc(c, "sine", 2093, 0.05, 0.35, x); osc(c, "sine", 3136, 0.05, 0.3, gan(c, x, 0.3)); }],
  golpe: [0.09, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.06, 0.2, 0.02, 0.01, 0.55); ruido(c, 0, 0.09, x, "lowpass", 2200, 1, 400); osc(c, "sine", 220, 0, 0.08, gan(c, x, 0.6), 80); }],
  muere: [0.16, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.2, 0.05, 0.02, 0.4); ruido(c, 0, 0.16, x, "bandpass", 900, 1.2, 200); osc(c, "triangle", 300, 0, 0.14, gan(c, x, 0.5), 60); }],
  latigo: [0.22, (c, o) => { const x = gan(c, o); env(x, 0, 0.03, 0.12, 0.3, 0.06, 0.05, 0.5); ruido(c, 0, 0.22, x, "bandpass", 700, 2.5, 4200); }],
  magia: [0.2, (c, o) => { const x = gan(c, sala(c, o, 0.6, 0.25)); env(x, 0, 0.002, 0.12, 0.2, 0.05, 0.02, 0.28); osc(c, "sawtooth", 1800, 0, 0.18, x, 600); osc(c, "sine", 2400, 0, 0.14, gan(c, x, 0.6), 1200); }],
  cuchillo: [0.12, (c, o) => { const x = gan(c, o); env(x, 0, 0.004, 0.07, 0.2, 0.03, 0.02, 0.4); ruido(c, 0, 0.12, x, "highpass", 3000, 1, 6000); }],
  hacha: [0.3, (c, o) => { const x = gan(c, o); env(x, 0, 0.05, 0.15, 0.3, 0.08, 0.06, 0.45); ruido(c, 0, 0.3, x, "bandpass", 400, 2, 1400); }],
  cruz: [0.4, (c, o) => { const x = gan(c, sala(c, o, 1, 0.35)); env(x, 0, 0.005, 0.2, 0.2, 0.15, 0.02, 0.22); for (const f of [1760, 2217, 2637]) osc(c, "sine", f, 0, 0.35, x); }],
  fuego: [0.35, (c, o) => { const x = gan(c, o); env(x, 0, 0.01, 0.2, 0.3, 0.1, 0.05, 0.5); ruido(c, 0, 0.35, x, "lowpass", 1400, 0.7, 300); osc(c, "sawtooth", 110, 0, 0.3, gan(c, x, 0.15), 60); }],
  rayo: [0.6, (c, o) => { const x = gan(c, sala(c, o, 1.2, 0.3)); env(x, 0, 0.001, 0.05, 0.4, 0.45, 0.03, 0.7); ruido(c, 0, 0.6, x, "lowpass", 7000, 0.5, 200); osc(c, "sawtooth", 90, 0, 0.5, gan(c, x, 0.3), 35); }],
  agua: [0.45, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.3, 0.3, 0.02, 0.4); ruido(c, 0, 0.45, x, "bandpass", 3000, 3, 500); for (const f of [2800, 3500]) osc(c, "sine", f, 0, 0.08, gan(c, x, 0.3)); }],
  runa: [0.18, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.2, 0.05, 0.02, 0.25); osc(c, "square", 880, 0, 0.16, gan(c, x, 0.4), 1760); }],
  dolor: [0.3, (c, o) => { const x = gan(c, o); env(x, 0, 0.004, 0.15, 0.3, 0.1, 0.03, 0.6); osc(c, "sawtooth", 220, 0, 0.28, x, 70); ruido(c, 0, 0.12, gan(c, x, 0.5), "lowpass", 900); }],
  subir: [1.1, (c, o) => { const x = gan(c, sala(c, o, 1.4, 0.35)); [72, 76, 79, 84, 88].forEach((m, i) => { const t = i * 0.07, y = gan(c, x); env(y, t, 0.004, 0.15, 0.4, 0.5, 0.05, 0.28); osc(c, "triangle", mtof(m), t, t + 0.75, y); osc(c, "sine", mtof(m + 12), t, t + 0.5, gan(c, y, 0.3)); }); }],
  elegir: [0.7, (c, o) => { const x = gan(c, sala(c, o, 1.2, 0.35)); [79, 84, 91].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.05, 0.003, 0.1, 0.3, 0.35, 0.03, 0.3); osc(c, "triangle", mtof(m), i * 0.05, 0.65, y); }); }],
  clic: [0.06, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.03, 0.1, 0.02, 0.005, 0.35); osc(c, "square", 1200, 0, 0.05, gan(c, x, 0.35), 800); }],
  mover: [0.05, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.025, 0.1, 0.02, 0.005, 0.2); osc(c, "triangle", 900, 0, 0.04, x); }],
  no: [0.2, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.4, 0.05, 0.08, 0.35); osc(c, "square", 160, 0, 0.18, gan(c, x, 0.5)); osc(c, "square", 151, 0, 0.18, gan(c, x, 0.5)); }],
  cofre: [0.5, (c, o) => { const x = gan(c, sala(c, o, 1, 0.3)); env(x, 0, 0.002, 0.15, 0.3, 0.3, 0.02, 0.6); ruido(c, 0, 0.3, x, "lowpass", 800); osc(c, "sine", 140, 0, 0.3, gan(c, x, 0.7), 60); }],
  pollo: [0.6, (c, o) => { const x = gan(c, sala(c, o, 1, 0.3)); [67, 71, 74, 79].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.06, 0.003, 0.12, 0.3, 0.25, 0.03, 0.3); osc(c, "sine", mtof(m), i * 0.06, 0.55, y); }); }],
  evolucion: [2.2, (c, o) => { const x = gan(c, sala(c, o, 2, 0.45)); [57, 64, 69, 72, 76, 81].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.09, 0.02, 0.4, 0.5, 1.2, 0.3, 0.2); osc(c, "sawtooth", mtof(m), i * 0.09, 2, gan(c, y, 0.3)); osc(c, "triangle", mtof(m), i * 0.09, 2, y); }); }],
  rosario: [1.4, (c, o) => { const x = gan(c, sala(c, o, 1.8, 0.45)); env(x, 0, 0.01, 0.4, 0.4, 0.8, 0.1, 0.5); ruido(c, 0, 1.3, x, "bandpass", 300, 1, 5000); for (const f of [523, 784, 1047]) osc(c, "sine", f, 0.05, 1.3, gan(c, x, 0.4)); }],
  reloj: [0.9, (c, o) => { const x = gan(c, sala(c, o, 1, 0.35)); for (let i = 0; i < 6; i++) { const y = gan(c, x); env(y, i * 0.13, 0.001, 0.05, 0.1, 0.03, 0.01, 0.3); osc(c, "square", 2000 - i * 200, i * 0.13, i * 0.13 + 0.08, gan(c, y, 0.4)); } }],
  iman: [0.9, (c, o) => { const x = gan(c, o); env(x, 0, 0.3, 0.3, 0.6, 0.3, 0.3, 0.4); osc(c, "sine", 200, 0, 0.9, x, 1600); osc(c, "triangle", 300, 0, 0.9, gan(c, x, 0.3), 2400); }],
  brasero: [0.25, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.08, 0.2, 0.12, 0.02, 0.5); ruido(c, 0, 0.25, x, "bandpass", 1600, 1.5, 500); }],
  morir: [2.4, (c, o) => { const x = gan(c, sala(c, o, 2.2, 0.45)); [64, 60, 57, 52].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.28, 0.01, 0.3, 0.6, 0.6, 0.3, 0.3); osc(c, "sawtooth", mtof(m), i * 0.28, i * 0.28 + 1.2, gan(c, y, 0.25)); osc(c, "sine", mtof(m - 12), i * 0.28, i * 0.28 + 1.2, y); }); }],
  jefe: [1.6, (c, o) => { const x = gan(c, sala(c, o, 1.6, 0.4)); env(x, 0, 0.01, 0.3, 0.6, 0.8, 0.3, 0.55); for (const m of [33, 40, 45]) osc(c, "sawtooth", mtof(m), 0, 1.4, gan(c, x, 0.3)); ruido(c, 0, 1.2, gan(c, x, 0.4), "lowpass", 300); }],
};

// ── la música: tracker de texto. Cada ficha es un paso (corchea): "A4" nota, "." sigue, "-" silencio ──
function pistas(txt, desde = 0) {
  const out = []; let paso = desde, ult = null;
  for (const f of txt.trim().split(/\s+/)) {
    if (f === "|") continue;
    if (f === ".") { if (ult) ult.len++; }
    else if (f === "-") ult = null;
    else { const m = /^([A-G])(#|b)?(-?\d)$/.exec(f); if (m) { const n = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (+m[3] + 1) * 12; ult = { paso, m: n, len: 1 }; out.push(ult); } }
    paso++;
  }
  return out;
}
const INSTR = {
  // el bajo: sierra con filtro que se abre al golpe (rock gótico, no chiptune)
  bajo(c, o, t, f, d) { const x = gan(c, o), fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 3; fl.frequency.setValueAtTime(1600, t); fl.frequency.exponentialRampToValueAtTime(300, t + d); fl.connect(x); env(x, t, 0.005, 0.1, 0.6, 0.05, d, 0.5); osc(c, "sawtooth", f, t, t + d + 0.06, fl); osc(c, "square", f / 2, t, t + d + 0.06, gan(c, fl, 0.4)); },
  // órgano de tubos: senos en armónicos (como tirar los registros)
  organo(c, o, t, f, d) { const x = gan(c, o); env(x, t, 0.02, 0.1, 0.8, 0.12, d, 0.12); for (const [k, v] of [[1, 1], [2, 0.6], [3, 0.3], [4, 0.35], [8, 0.12]]) osc(c, "sine", f * k, t, t + d + 0.14, gan(c, x, v)); },
  // clavicémbalo: pulso filtrado con caída rápida (la cuerda pellizcada)
  clave(c, o, t, f, d) { const x = gan(c, o), fl = c.createBiquadFilter(); fl.type = "highpass"; fl.frequency.value = 300; fl.connect(x); env(x, t, 0.002, 0.18, 0.15, 0.1, Math.min(d, 0.12), 0.16); osc(c, "square", f, t, t + d + 0.3, fl); osc(c, "sawtooth", f * 2.003, t, t + d + 0.3, gan(c, fl, 0.3)); },
  // la voz principal: dos sierras desafinadas, filtro y vibrato (un "violín" de sintetizador)
  lead(c, o, t, f, d) {
    const x = gan(c, o), fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.Q.value = 1.5; fl.frequency.setValueAtTime(900, t); fl.frequency.linearRampToValueAtTime(2600, t + 0.06); fl.frequency.exponentialRampToValueAtTime(1400, t + d + 0.1); fl.connect(x);
    env(x, t, 0.015, 0.15, 0.7, 0.14, d, 0.11);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.35, d)); lfo.connect(lg); lfo.start(t); lfo.stop(t + d + 0.2);
    for (const k of [0.997, 1.004]) { const o2 = osc(c, "sawtooth", f * k, t, t + d + 0.2, fl); lg.connect(o2.frequency); }
  },
  coro(c, o, t, f, d) { const x = gan(c, o), fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 1100; fl.connect(x); env(x, t, 0.35, 0.3, 0.8, 0.5, d, 0.06); for (const k of [0.995, 1, 1.006]) osc(c, "sawtooth", f * k, t, t + d + 0.55, fl); },
  bombo(c, o, t) { const x = gan(c, o); env(x, t, 0.001, 0.14, 0.01, 0.05, 0.02, 0.9); osc(c, "sine", 140, t, t + 0.2, x, 42, 0.12); },
  caja(c, o, t) { const x = gan(c, o); env(x, t, 0.001, 0.1, 0.05, 0.08, 0.02, 0.45); ruido(c, t, t + 0.2, x, "bandpass", 1800, 0.8); osc(c, "triangle", 210, t, t + 0.1, gan(c, x, 0.6), 150); },
  plato(c, o, t) { const x = gan(c, o); env(x, t, 0.001, 0.03, 0.05, 0.02, 0.01, 0.12); ruido(c, t, t + 0.06, x, "highpass", 7000); },
};
// Los temas NO se renderizan enteros (medido: 5,2 s para 26 s de música en un Xeon = 5× el tiempo
// real; en el teléfono no llega). Cada nota distinta (instrumento + altura + largo) se hornea UNA vez,
// y el tema se arma sumando esas notas en JS; la sala es una reverb de peines (Freeverb chico), también en JS.
const NOTAS = new Map();
async function notaBuf(nom, m, largo) {
  const clave = `${nom}|${m}|${largo.toFixed(3)}`;
  if (NOTAS.has(clave)) return NOTAS.get(clave);
  const dur = largo + (nom === "coro" ? 0.7 : 0.45), c = new OfflineAudioContext(1, Math.ceil(dur * SR), SR), o = c.createGain(); o.connect(c.destination);
  if (m == null) INSTR[nom](c, o, 0); else INSTR[nom](c, o, 0, mtof(m), largo);
  const p = c.startRendering().then((b) => b.getChannelData(0));
  NOTAS.set(clave, p);
  return p;
}
function reverbJS(x, mezcla) {
  // 4 peines en paralelo + 2 pasatodo (los retardos de Freeverb llevados a 24 kHz)
  const n = x.length, out = new Float32Array(n);
  for (const d of [607, 646, 695, 738]) {
    const buf = new Float32Array(d); let i = 0, filt = 0;
    for (let k = 0; k < n; k++) { const y = buf[i]; filt = y * 0.75 + filt * 0.25; buf[i] = x[k] + filt * 0.8; out[k] += y * 0.25; if (++i >= d) i = 0; }
  }
  for (const d of [302, 240]) {
    const buf = new Float32Array(d); let i = 0;
    for (let k = 0; k < n; k++) { const b = buf[i], v = out[k]; buf[i] = v + b * 0.5; out[k] = b - v; if (++i >= d) i = 0; }
  }
  for (let k = 0; k < n; k++) x[k] += out[k] * mezcla;
}
async function hornearTema(nombre, tm) {
  const paso = 60 / tm.bpm / 2, dur = tm.pasos * paso, N = Math.ceil((dur + (tm.cola ?? 2.5)) * SR);
  const humedo = new Float32Array(N), seco = new Float32Array(N), trabajos = [];
  for (const [ins, txt] of Object.entries(tm.voces)) {
    const [nom0, vol = 1] = ins.split("*"), nom = nom0.replace(/\d$/, ""), dest = nom === "bajo" ? seco : humedo;
    for (const n of pistas(txt)) trabajos.push([notaBuf(nom, n.m, Math.round(n.len * paso * 0.92 * 1000) / 1000), Math.floor(n.paso * paso * SR), +vol, dest]);
  }
  for (const [ins, txt] of Object.entries(tm.bat || {})) {
    const v = ins === "plato" ? 0.7 : 1;
    [...txt.replace(/\s|\|/g, "")].forEach((ch, i) => { if (ch === "x") trabajos.push([notaBuf(ins, null, 0.2), Math.floor(i * paso * SR), v, seco]); });
  }
  for (const [p, desde, vol, dest] of trabajos) { const d = await p; for (let i = 0, j = desde; i < d.length && j < N; i++, j++) dest[j] += d[i] * vol; }
  reverbJS(humedo, 0.35);
  for (let i = 0; i < N; i++) seco[i] += humedo[i];
  // todos los temas al mismo pico (0,85): nada satura y ninguno queda bajito
  let pico = 0; for (let i = 0; i < N; i++) { const a = Math.abs(seco[i]); if (a > pico) pico = a; }
  const k = pico > 0 ? 0.85 / pico : 1;
  const largo = tm.loop ? Math.floor(dur * SR) : N, out = AU.ctx.createBuffer(1, largo, SR), od = out.getChannelData(0);
  // en bucle: la cola se suma al principio, así el bucle no corta
  for (let i = 0; i < N; i++) od[tm.loop ? i % largo : i] += seco[i] * k;
  AU.buf["tema:" + nombre] = out;
}
// progresiones en La menor armónica (el Mi mayor con sol# le da lo gótico)
const TEMAS = {
  titulo: { bpm: 84, pasos: 64, loop: true, voces: {
    "organo": "A3 . . . . . . . F3 . . . . . . . D3 . . . . . . . E3 . . . . . . . A3 . . . . . . . F3 . . . . . . . G3 . . . E3 . . . . . . . . . . .",
    "organo2": "E4 . . . . . . . C4 . . . . . . . A3 . . . . . . . G#3 . . . . . . . E4 . . . . . . . C4 . . . . . . . D4 . . . B3 . . . . . . . . . . .",
    "coro*1.3": "A4 . . . . . . . . . . . C5 . B4 . A4 . . . . . . . G#4 . . . . . . . A4 . . . . . . . E5 . . . D5 . C5 . B4 . . . . . . . . . . . . . . .",
    "clave*0.8": "A5 E5 C5 E5 A5 E5 C5 E5 A5 F5 C5 F5 A5 F5 C5 F5 A5 F5 D5 F5 A5 F5 D5 F5 B5 G#5 E5 G#5 B5 G#5 E5 G#5 A5 E5 C5 E5 A5 E5 C5 E5 A5 F5 C5 F5 A5 F5 C5 F5 B5 G5 D5 G5 B5 G#5 E5 G#5 B5 G#5 E5 G#5 E5 - - -",
  } },
  bosque: { bpm: 148, pasos: 128, loop: true, voces: {
    "bajo": "A2 A2 A3 A2 A2 A3 A2 G2 | F2 F2 F3 F2 F2 F3 F2 E2 | D2 D2 D3 D2 D2 D3 D2 E2 | E2 E2 E3 E2 E2 E3 G#2 B2 | A2 A2 A3 A2 A2 A3 A2 G2 | F2 F2 F3 F2 F2 F3 F2 E2 | D2 D2 D3 D2 E2 E2 E3 E2 | A2 A2 A3 A2 E2 E3 G#2 B2 | A2 A2 A3 A2 A2 A3 A2 G2 | F2 F2 F3 F2 F2 F3 F2 E2 | G2 G2 G3 G2 G2 G3 G2 F2 | E2 E2 E3 E2 E2 E3 G#2 B2 | F2 F2 F3 F2 G2 G2 G3 G2 | E2 E2 E3 E2 E2 E3 E2 E2 | A2 A2 A3 A2 D2 D2 D3 D2 | E2 E2 E3 E2 E2 E3 G#2 B2",
    "clave*0.7": "A4 C5 E5 A5 E5 C5 A4 C5 | F4 A4 C5 F5 C5 A4 F4 A4 | D4 F4 A4 D5 A4 F4 D4 F4 | E4 G#4 B4 E5 B4 G#4 E4 G#4 | A4 C5 E5 A5 E5 C5 A4 C5 | F4 A4 C5 F5 C5 A4 F4 A4 | D4 F4 A4 D5 E4 G#4 B4 E5 | A4 C5 E5 A5 E5 B4 G#4 E4 | A4 C5 E5 A5 E5 C5 A4 C5 | F4 A4 C5 F5 C5 A4 F4 A4 | G4 B4 D5 G5 D5 B4 G4 B4 | E4 G#4 B4 E5 B4 G#4 E4 G#4 | F4 A4 C5 F5 G4 B4 D5 G5 | E4 G#4 B4 E5 B4 G#4 E4 D4 | C4 E4 A4 C5 D4 F4 A4 D5 | E4 G#4 B4 E5 G#5 E5 B4 G#4",
    "lead": "- - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | A5 . . . E5 . A5 . | C6 . B5 . A5 . G5 . | F5 . . . A5 . . . | G#5 . . . . . E5 . | A5 . . . E5 . A5 . | C6 . B5 . A5 . C6 . | D6 . C6 . B5 . G5 . | E6 . . . . . . . | F6 . E6 . D6 . C6 . | B5 . C6 . D6 . . . | E6 . D6 . C6 . A5 . | B5 . . . G#5 . E5 .",
    "coro*0.9": "A3 . . . . . . . | F3 . . . . . . . | D3 . . . . . . . | E3 . . . . . . . | A3 . . . . . . . | F3 . . . . . . . | D3 . . . E3 . . . | A3 . . . E3 . . . | A3 . . . . . . . | F3 . . . . . . . | G3 . . . . . . . | E3 . . . . . . . | F3 . . . G3 . . . | E3 . . . . . . . | A3 . . . D3 . . . | E3 . . . . . . .",
  }, bat: {
    bombo: "x...x...x...x..x".repeat(8), caja: "....x.......x...".repeat(8), plato: "x.x.x.x.x.x.x.x.".repeat(8),
  } },
  cementerio: { bpm: 132, pasos: 128, loop: true, voces: {
    "bajo": "D2 . D3 D2 . D2 D3 C2 | Bb1 . Bb2 Bb1 . Bb1 Bb2 A1 | G1 . G2 G1 . G1 G2 A1 | A1 . A2 A1 . C#2 E2 A1 | D2 . D3 D2 . D2 D3 C2 | Bb1 . Bb2 Bb1 . Bb1 Bb2 A1 | G1 . G2 G1 A1 . A2 A1 | D2 . D3 D2 A1 . C#2 E2 | D2 . D3 D2 . D2 D3 C2 | Bb1 . Bb2 Bb1 . Bb1 Bb2 A1 | C2 . C3 C2 . C2 C3 Bb1 | A1 . A2 A1 . C#2 E2 A1 | Bb1 . Bb2 Bb1 C2 . C3 C2 | A1 . A2 A1 . A2 A1 A1 | D2 . D3 D2 G1 . G2 G1 | A1 . A2 A1 . C#2 E2 A1",
    "organo*0.8": "D4 . . . . . . . | Bb3 . . . . . . . | G3 . . . . . . . | A3 . . . . . . . | D4 . . . . . . . | Bb3 . . . . . . . | G3 . . . A3 . . . | D4 . . . A3 . . . | D4 . . . . . . . | Bb3 . . . . . . . | C4 . . . . . . . | A3 . . . . . . . | Bb3 . . . C4 . . . | A3 . . . . . . . | D4 . . . G3 . . . | A3 . . . . . . .",
    "lead": "- - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | D5 . . F5 . A5 . . | Bb5 . A5 . G5 . F5 . | G5 . . . Bb5 . . . | A5 . . . . . . . | D6 . . C6 . A5 . . | Bb5 . A5 . G5 . A5 . | C6 . Bb5 . A5 . G5 . | E5 . . . . . A5 . | Bb5 . A5 . G5 . A5 . | C#6 . . . E6 . . . | D6 . C6 . Bb5 . A5 . | A5 . . . C#5 . E5 .",
    "clave*0.55": "D5 A4 F4 A4 D5 A4 F4 A4 | D5 Bb4 F4 Bb4 D5 Bb4 F4 Bb4 | D5 Bb4 G4 Bb4 D5 Bb4 G4 Bb4 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 | D5 A4 F4 A4 D5 A4 F4 A4 | D5 Bb4 F4 Bb4 D5 Bb4 F4 Bb4 | D5 Bb4 G4 Bb4 E5 C#5 A4 C#5 | F5 D5 A4 D5 E5 C#5 A4 C#5 | D5 A4 F4 A4 D5 A4 F4 A4 | D5 Bb4 F4 Bb4 D5 Bb4 F4 Bb4 | E5 C5 G4 C5 E5 C5 G4 C5 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 | D5 Bb4 F4 Bb4 E5 C5 G4 C5 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 | F5 D5 A4 D5 D5 Bb4 G4 Bb4 | E5 C#5 A4 C#5 A5 E5 C#5 A4",
  }, bat: { bombo: "x..x..x.x..x..x.".repeat(8), caja: "....x.......x...".repeat(8), plato: "..x...x...x...x.".repeat(8) } },
  // el cofre: una fanfarria que sube (el original pone su propia música mientras se abre)
  tesoro: { bpm: 150, pasos: 40, cola: 2.5, voces: {
    "clave": "C5 E5 G5 C6 E5 G5 C6 E6 D5 F5 A5 D6 F5 A5 D6 F6 E5 G5 B5 E6 G5 B5 E6 G6 F5 A5 C6 F6 G5 B5 D6 G6 C6 . . . . . . .",
    "coro": "C4 . . . . . . . D4 . . . . . . . E4 . . . . . . . F4 . . . G4 . . . C5 . . . . . . .",
    "organo": "C3 . . . . . . . D3 . . . . . . . E3 . . . . . . . F3 . . . G3 . . . C4 . . . . . . .",
  } },
  fin: { bpm: 70, pasos: 32, cola: 3, voces: {
    "organo": "A3 . . . . . . . F3 . . . . . . . D3 . . . E3 . . . A2 . . . . . . .",
    "coro*1.2": "E4 . . . C4 . . . A3 . . . . . . . F3 . . . G#3 . . . A3 . . . . . . .",
  } },
};

async function hornearSonido(nombre, [dur, receta]) {
  const c = new OfflineAudioContext(1, Math.ceil(dur * SR), SR), o = c.createGain(); o.connect(c.destination);
  receta(c, o);
  AU.buf[nombre] = await c.startRendering();
}
async function hornearTodo() {
  if (AU.horneando) return; AU.horneando = true;
  const t0 = performance.now();
  // los efectos primero (son cortos); los temas después, en el orden en que se necesitan
  try {
    const efectos = Object.entries(RECETAS);
    for (let i = 0; i < efectos.length; i += 6) await Promise.all(efectos.slice(i, i + 6).map(([k, r]) => hornearSonido(k, r)));
    AU.listo = true;
    for (const k of ["titulo", "bosque", "tesoro", "fin", "cementerio"]) { await hornearTema(k, TEMAS[k]); if (AU.pedido === k) tocarTema(k); }
  } catch (e) { AU.error = String(e); }
  AU.msHorneo = Math.round(performance.now() - t0);
}

/** Toca un efecto. Los que se repiten mucho (gemas, golpes) tienen un mínimo entre dos. */
const SEPARA = { gema: 0.045, golpe: 0.05, muere: 0.05, moneda: 0.06, cuchillo: 0.05, magia: 0.05, runa: 0.08 };
function sfx(nombre, vol = 1, tono = 1) {
  const c = AU.ctx, b = AU.buf[nombre];
  if (!c || !b || c.state !== "running") return;
  const t = c.currentTime;
  if (SEPARA[nombre] && t - (AU.ultimo[nombre] || 0) < SEPARA[nombre]) return;
  if (AU.voces > 24) return;          // tope de voces: con 300 enemigos, que no se sature
  AU.ultimo[nombre] = t;
  const s = c.createBufferSource(), x = c.createGain(); s.buffer = b; s.playbackRate.value = tono * (1 + (Math.random() - 0.5) * 0.06); x.gain.value = vol;
  s.connect(x); x.connect(AU.sfx); AU.voces++; s.onended = () => { AU.voces--; x.disconnect(); }; s.start();
}
/** Cambia de tema con un fundido corto; si todavía se está horneando, queda pedido. */
function tocarTema(nombre, { bucle = true } = {}) {
  AU.pedido = nombre;
  const c = AU.ctx; if (!c) return;
  if (AU.tema === nombre && AU.fuente) return;
  const b = AU.buf["tema:" + nombre];
  if (AU.fuente) { const f = AU.fuente; try { f.g.gain.setTargetAtTime(0, c.currentTime, 0.15); f.s.stop(c.currentTime + 0.8); } catch (e) {} AU.fuente = null; }
  AU.tema = null;
  if (!b) return;
  const s = c.createBufferSource(), x = c.createGain(); s.buffer = b; s.loop = bucle && !!TEMAS[nombre].loop;
  x.gain.setValueAtTime(0, c.currentTime); x.gain.linearRampToValueAtTime(1, c.currentTime + 0.3);
  s.connect(x); x.connect(AU.mus); s.start(); AU.fuente = { s, g: x }; AU.tema = nombre;
  if (!s.loop) s.onended = () => { if (AU.fuente && AU.fuente.s === s) { AU.fuente = null; AU.tema = null; if (AU.despues) { const d = AU.despues; AU.despues = null; tocarTema(d); } } };
}
function pararTema() { AU.pedido = null; tocarTema("__nada"); }
