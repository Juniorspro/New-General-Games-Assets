// ─────────────────────────────────────────────────────────────────────────────
// EL SONIDO, HORNEADO (lección de Shumio y Noche Carmesí, memoria/juegos.md): sintetizar en vivo no
// entra en tiempo real en el teléfono del usuario. Cada efecto se renderiza UNA vez con
// OfflineAudioContext (mono, 24 kHz) y los temas se arman con un banco de notas sumado en JS.
// En vivo sólo se tocan buffers. El contexto se crea SÓLO en un gesto de verdad.
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
  // el disparo de las botas: un chirrido cuadrado que cae (corto: se dispara mucho)
  tiro: [0.1, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.05, 0.3, 0.03, 0.02, 0.4); osc(c, "square", 880, 0, 0.09, gan(c, x, 0.5), 220); ruido(c, 0, 0.05, gan(c, x, 0.4), "highpass", 3000); }],
  tiroGordo: [0.16, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.08, 0.3, 0.05, 0.02, 0.5); osc(c, "square", 520, 0, 0.14, gan(c, x, 0.5), 110); ruido(c, 0, 0.1, gan(c, x, 0.5), "bandpass", 1400, 1, 300); }],
  laser: [0.3, (c, o) => { const x = gan(c, sala(c, o, 0.6, 0.2)); env(x, 0, 0.002, 0.2, 0.4, 0.08, 0.1, 0.35); osc(c, "sawtooth", 1600, 0, 0.28, x, 300); osc(c, "square", 2400, 0, 0.2, gan(c, x, 0.3), 600); }],
  pisoton: [0.18, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.1, 0.2, 0.05, 0.02, 0.6); osc(c, "square", 200, 0, 0.16, gan(c, x, 0.5), 520); osc(c, "sine", 90, 0, 0.12, x, 45); }],
  muere: [0.22, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.12, 0.2, 0.08, 0.02, 0.5); ruido(c, 0, 0.2, x, "lowpass", 3000, 1, 200); osc(c, "square", 400, 0, 0.18, gan(c, x, 0.3), 60); }],
  golpe: [0.07, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.04, 0.2, 0.02, 0.01, 0.4); ruido(c, 0, 0.06, x, "bandpass", 2400, 1.5); }],
  bloque: [0.25, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.12, 0.25, 0.1, 0.02, 0.55); ruido(c, 0, 0.24, x, "lowpass", 1800, 0.8, 250); osc(c, "square", 160, 0, 0.1, gan(c, x, 0.3), 70); }],
  // la gema: dos senos brillantes; el tono sube con la racha (se toca con playbackRate)
  gema: [0.14, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.06, 0.35, 0.06, 0.02, 0.4); osc(c, "square", 1760, 0, 0.12, gan(c, x, 0.25)); osc(c, "sine", 2637, 0.02, 0.14, x); }],
  salto: [0.14, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.08, 0.2, 0.03, 0.02, 0.35); osc(c, "square", 300, 0, 0.13, gan(c, x, 0.5), 720); }],
  aterriza: [0.08, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.05, 0.1, 0.02, 0.01, 0.35); ruido(c, 0, 0.07, x, "lowpass", 900); }],
  recarga: [0.2, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.3, 0.06, 0.03, 0.25); [880, 1320].forEach((f, i) => osc(c, "square", f, i * 0.05, i * 0.05 + 0.08, gan(c, x, 0.4))); }],
  vacio: [0.12, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.06, 0.2, 0.03, 0.02, 0.3); osc(c, "square", 140, 0, 0.1, gan(c, x, 0.5)); }],
  dolor: [0.45, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.25, 0.3, 0.15, 0.05, 0.7); osc(c, "sawtooth", 330, 0, 0.4, x, 55); ruido(c, 0, 0.2, gan(c, x, 0.6), "lowpass", 2000, 1, 300); }],
  corazon: [0.6, (c, o) => { const x = gan(c, sala(c, o, 1, 0.3)); [72, 76, 79, 84].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.07, 0.003, 0.12, 0.3, 0.2, 0.03, 0.3); osc(c, "square", mtof(m), i * 0.07, i * 0.07 + 0.3, gan(c, y, 0.4)); }); }],
  combo: [0.5, (c, o) => { const x = gan(c, sala(c, o, 1, 0.3)); [67, 71, 74, 79, 83].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.05, 0.002, 0.08, 0.3, 0.15, 0.02, 0.25); osc(c, "square", mtof(m + 12), i * 0.05, i * 0.05 + 0.25, gan(c, y, 0.4)); }); }],
  gemHigh: [1.2, (c, o) => { const x = gan(c, sala(c, o, 1.4, 0.4)); for (let i = 0; i < 10; i++) { const y = gan(c, x); env(y, i * 0.05, 0.002, 0.1, 0.4, 0.2, 0.02, 0.18); osc(c, "square", mtof(72 + [0, 4, 7, 12, 16, 19, 24, 28, 31, 36][i]), i * 0.05, i * 0.05 + 0.4, gan(c, y, 0.5)); } }],
  puerta: [0.7, (c, o) => { const x = gan(c, sala(c, o, 1.2, 0.4)); env(x, 0, 0.1, 0.3, 0.5, 0.3, 0.2, 0.4); osc(c, "sine", 220, 0, 0.7, x, 880); osc(c, "triangle", 330, 0, 0.7, gan(c, x, 0.3), 1320); }],
  comprar: [0.5, (c, o) => { const x = gan(c, sala(c, o, 1, 0.3)); [1568, 2093, 2637].forEach((f, i) => { const y = gan(c, x); env(y, i * 0.06, 0.002, 0.1, 0.3, 0.2, 0.02, 0.3); osc(c, "square", f, i * 0.06, i * 0.06 + 0.3, gan(c, y, 0.35)); }); }],
  elegir: [0.7, (c, o) => { const x = gan(c, sala(c, o, 1.2, 0.35)); [79, 84, 88, 91].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.06, 0.003, 0.1, 0.3, 0.35, 0.03, 0.28); osc(c, "square", mtof(m), i * 0.06, 0.65, gan(c, y, 0.4)); osc(c, "triangle", mtof(m - 12), i * 0.06, 0.65, y); }); }],
  clic: [0.06, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.03, 0.1, 0.02, 0.005, 0.35); osc(c, "square", 1200, 0, 0.05, gan(c, x, 0.35), 800); }],
  mover: [0.05, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.025, 0.1, 0.02, 0.005, 0.2); osc(c, "square", 700, 0, 0.04, gan(c, x, 0.4)); }],
  no: [0.2, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.4, 0.05, 0.08, 0.35); osc(c, "square", 160, 0, 0.18, gan(c, x, 0.5)); osc(c, "square", 151, 0, 0.18, gan(c, x, 0.5)); }],
  jefe: [1.8, (c, o) => { const x = gan(c, sala(c, o, 1.8, 0.4)); env(x, 0, 0.02, 0.4, 0.6, 0.9, 0.3, 0.6); for (const m of [28, 35, 40]) osc(c, "sawtooth", mtof(m), 0, 1.6, gan(c, x, 0.3)); ruido(c, 0, 1.4, gan(c, x, 0.5), "lowpass", 400); }],
  explota: [0.6, (c, o) => { const x = gan(c, sala(c, o, 1, 0.3)); env(x, 0, 0.001, 0.2, 0.3, 0.3, 0.05, 0.8); ruido(c, 0, 0.55, x, "lowpass", 2500, 0.7, 120); osc(c, "sine", 110, 0, 0.4, gan(c, x, 0.6), 30); }],
  morir: [2.2, (c, o) => { const x = gan(c, sala(c, o, 2, 0.45)); [64, 61, 57, 52, 45].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.22, 0.01, 0.2, 0.5, 0.5, 0.2, 0.3); osc(c, "square", mtof(m), i * 0.22, i * 0.22 + 0.9, gan(c, y, 0.3)); osc(c, "triangle", mtof(m - 12), i * 0.22, i * 0.22 + 0.9, y); }); }],
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
// los temas: energía de pozo (bajo que empuja, arpegio de "clave", batería) en Re y La menor
const TEMAS = {
  titulo: { bpm: 96, pasos: 64, loop: true, voces: {
    "coro*1.1": "D3 . . . . . . . Bb2 . . . . . . . C3 . . . . . . . A2 . . . . . . . D3 . . . . . . . Bb2 . . . . . . . G2 . . . A2 . . . . . . . . . . .",
    "clave*0.8": "D5 A4 F4 A4 D5 A4 F4 A4 D5 Bb4 F4 Bb4 D5 Bb4 F4 Bb4 E5 C5 G4 C5 E5 C5 G4 C5 E5 C#5 A4 C#5 E5 C#5 A4 C#5 D5 A4 F4 A4 D5 A4 F4 A4 D5 Bb4 F4 Bb4 D5 Bb4 F4 Bb4 D5 Bb4 G4 Bb4 E5 C#5 A4 C#5 E5 C#5 A4 C#5 A5 - - -",
    "lead*0.7": "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - A5 . . . F5 . . . G5 . . . D5 . . . E5 . . . C5 . . . C#5 . . . . . . . . . . .",
  } },
  pozo: { bpm: 152, pasos: 128, loop: true, voces: {
    "bajo": "A2 A2 A3 A2 A2 A3 A2 G2 | A2 A2 A3 A2 C3 C3 B2 G2 | F2 F2 F3 F2 F2 F3 F2 E2 | E2 E2 E3 E2 G#2 G#2 B2 E2 | A2 A2 A3 A2 A2 A3 A2 G2 | A2 A2 A3 A2 C3 C3 B2 G2 | F2 F2 F3 F2 G2 G2 G3 G2 | E2 E2 E3 E2 E2 E3 G#2 B2 | D3 D3 D2 D3 D3 D2 D3 C3 | Bb2 Bb2 Bb1 Bb2 Bb2 Bb1 Bb2 A2 | G2 G2 G1 G2 A2 A2 A1 A2 | A2 A2 A1 A2 C#3 C#3 E3 A2 | D3 D3 D2 D3 F3 F3 E3 D3 | Bb2 Bb2 Bb1 Bb2 C3 C3 C2 C3 | A2 A2 A1 A2 A2 A1 A2 A2 | E2 E2 E3 E2 G#2 G#2 B2 E2",
    "clave*0.6": "A4 E5 A5 E5 C6 E5 A5 E5 | A4 E5 A5 E5 C6 E5 B5 G5 | F4 C5 F5 C5 A5 C5 F5 C5 | E4 B4 E5 B4 G#5 B4 E5 B4 | A4 E5 A5 E5 C6 E5 A5 E5 | A4 E5 A5 E5 C6 E5 B5 G5 | F4 C5 F5 C5 G4 D5 G5 D5 | E4 B4 E5 B4 G#5 B4 E5 B4 | D5 A5 D6 A5 F5 A5 D6 A5 | Bb4 F5 Bb5 F5 D5 F5 Bb5 F5 | G4 D5 G5 D5 A4 E5 A5 E5 | A4 E5 A5 E5 C#5 E5 A5 E5 | D5 A5 D6 A5 F5 A5 E6 A5 | Bb4 F5 Bb5 F5 C5 G5 C6 G5 | A4 E5 A5 E5 C6 E5 A5 E5 | E4 B4 E5 B4 G#5 B4 E5 B4",
    "lead": "- - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | A5 . . . C6 . E6 . | D6 . C6 . B5 . G5 . | A5 . . . F5 . G5 . | G#5 . . . . . E5 . | D6 . . . F6 . . . | D6 . C6 . Bb5 . A5 . | G5 . . . A5 . . . | C#6 . . . E6 . . . | F6 . E6 . D6 . A5 . | Bb5 . A5 . G5 . E5 . | A5 . . . . . . . | G#5 . . . B5 . . .",
  }, bat: { bombo: "x...x..xx...x...".repeat(8), caja: "....x.......x...".repeat(8), plato: "x.x.x.x.x.x.x.xx".repeat(8) } },
  profundo: { bpm: 144, pasos: 128, loop: true, voces: {
    "bajo": "D2 . D3 D2 D2 D3 D2 C2 | D2 . D3 D2 F2 F2 E2 C2 | Bb1 . Bb2 Bb1 Bb1 Bb2 Bb1 A1 | A1 . A2 A1 C#2 C#2 E2 A1 | D2 . D3 D2 D2 D3 D2 C2 | D2 . D3 D2 F2 F2 E2 C2 | G1 . G2 G1 A1 . A2 A1 | A1 . A2 A1 C#2 E2 G2 A2 | D2 . D3 D2 D2 D3 D2 C2 | Bb1 . Bb2 Bb1 Bb1 Bb2 Bb1 A1 | C2 . C3 C2 C2 C3 C2 Bb1 | A1 . A2 A1 C#2 C#2 E2 A1 | Bb1 . Bb2 Bb1 C2 . C3 C2 | A1 . A2 A1 A1 A2 A1 A1 | D2 . D3 D2 G1 . G2 G1 | A1 . A2 A1 C#2 E2 G2 A2",
    "organo*0.7": "D4 . . . . . . . | D4 . . . . . . . | Bb3 . . . . . . . | A3 . . . . . . . | D4 . . . . . . . | D4 . . . . . . . | G3 . . . A3 . . . | A3 . . . . . . . | D4 . . . . . . . | Bb3 . . . . . . . | C4 . . . . . . . | A3 . . . . . . . | Bb3 . . . C4 . . . | A3 . . . . . . . | D4 . . . G3 . . . | A3 . . . . . . .",
    "lead": "- - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | D6 . . . A5 . D6 . | F6 . E6 . D6 . C6 . | Bb5 . . . D6 . . . | C#6 . . . . . A5 . | D6 . . . F6 . A6 . | G6 . F6 . E6 . D6 . | E6 . . . C6 . . . | A5 . . . . . . . | Bb5 . A5 . G5 . A5 . | C#6 . . . E6 . . . | F6 . E6 . D6 . A5 . | A5 . . . C#6 . E6 .",
    "clave*0.45": "D5 A4 F4 A4 D5 A4 F4 A4 | D5 A4 F4 A4 D5 A4 F4 A4 | D5 Bb4 F4 Bb4 D5 Bb4 F4 Bb4 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 | D5 A4 F4 A4 D5 A4 F4 A4 | D5 A4 F4 A4 D5 A4 F4 A4 | D5 Bb4 G4 Bb4 E5 C#5 A4 C#5 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 | D5 A4 F4 A4 D5 A4 F4 A4 | D5 Bb4 F4 Bb4 D5 Bb4 F4 Bb4 | E5 C5 G4 C5 E5 C5 G4 C5 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 | D5 Bb4 F4 Bb4 E5 C5 G4 C5 | E5 C#5 A4 C#5 E5 C#5 A4 C#5 | F5 D5 A4 D5 D5 Bb4 G4 Bb4 | E5 C#5 A4 C#5 A5 E5 C#5 A4",
  }, bat: { bombo: "x..x..x.x..x..x.".repeat(8), caja: "....x.......x..x".repeat(8), plato: "..x...x...x...x.".repeat(8) } },
  jefe: { bpm: 168, pasos: 64, loop: true, voces: {
    "bajo": "E2 E2 E3 E2 F2 F2 F3 F2 | E2 E2 E3 E2 G2 G2 F2 E2 | C2 C2 C3 C2 D2 D2 D3 D2 | B1 B1 B2 B1 D#2 D#2 F#2 B1 | E2 E2 E3 E2 F2 F2 F3 F2 | E2 E2 E3 E2 G2 G2 F2 E2 | C2 C2 C3 C2 D2 D2 D3 D2 | B1 B1 B2 B1 B1 B2 D#3 F#3",
    "lead": "E5 . B5 . E6 . D6 C6 | B5 . . . G5 . F5 . | E5 . . . C6 . B5 . | D#6 . . . F#5 . . . | E6 . D6 . C6 . B5 . | C6 . B5 . A5 . G5 . | A5 . B5 . C6 . D6 . | D#6 . . . . . . .",
    "clave*0.5": "E4 B4 E5 B4 F4 C5 F5 C5 | E4 B4 E5 B4 G4 D5 G5 D5 | C4 G4 C5 G4 D4 A4 D5 A4 | B3 F#4 B4 F#4 D#4 F#4 B4 F#4 | E4 B4 E5 B4 F4 C5 F5 C5 | E4 B4 E5 B4 G4 D5 G5 D5 | C4 G4 C5 G4 D4 A4 D5 A4 | B3 F#4 B4 F#4 D#5 F#5 B5 F#5",
  }, bat: { bombo: "x.x.x.x.x.x.x.x.".repeat(4), caja: "....x.......x.xx".repeat(4), plato: "xxxxxxxxxxxxxxxx".repeat(4) } },
  tienda: { bpm: 88, pasos: 64, loop: true, voces: {
    "clave*0.7": "C5 E5 G5 E5 C5 E5 G5 E5 A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 F4 A4 C5 A4 G4 B4 D5 B4 G4 B4 D5 B4 C5 E5 G5 E5 C5 E5 G5 E5 A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 G4 B4 D5 B4 C5 - - - - - - -",
    "coro*0.9": "C4 . . . . . . . A3 . . . . . . . F3 . . . . . . . G3 . . . . . . . C4 . . . . . . . A3 . . . . . . . F3 . . . G3 . . . C4 . . . . . . .",
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
    for (const k of ["titulo", "pozo", "tienda", "profundo", "jefe", "fin"]) { await hornearTema(k, TEMAS[k]); if (AU.pedido === k) tocarTema(k); }
  } catch (e) { AU.error = String(e); }
  AU.msHorneo = Math.round(performance.now() - t0);
}

/** Toca un efecto. Los que se repiten mucho (gemas, golpes) tienen un mínimo entre dos. */
const SEPARA = { gema: 0.03, golpe: 0.04, muere: 0.04, tiro: 0.03, bloque: 0.04, aterriza: 0.08, vacio: 0.1 };
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
