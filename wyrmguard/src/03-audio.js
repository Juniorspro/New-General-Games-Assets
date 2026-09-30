// ─────────────────────────────────────────────────────────────────────────────
// EL SONIDO, HORNEADO (motor de ABYSSFALL; lección de Shumio y Noche Carmesí, memoria/juegos.md): sintetizar en vivo no
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
function volumenes() { if (!AU.ctx) return; AU.mus.gain.value = G.op.musica * 0.5; AU.sfx.gain.value = G.op.efectos * 0.8; }

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

// ── los efectos: [duración, receta(c, salida)]. Nombres por lo que suenan, no por quién los usa ──
const RECETAS = {
  // disparos: el "pew" corto, la cuerda del arco, el cuchillo que corta el aire, el cañón
  tiro: [0.12, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.06, 0.25, 0.04, 0.02, 0.35); osc(c, "square", 1200, 0, 0.1, gan(c, x, 0.35), 380); ruido(c, 0, 0.05, gan(c, x, 0.35), "highpass", 3500); }],
  flecha: [0.2, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.12, 0.1, 0.05, 0.02, 0.4); osc(c, "triangle", 190, 0, 0.16, gan(c, x, 0.6), 120); ruido(c, 0, 0.12, gan(c, x, 0.4), "bandpass", 2600, 2, 900); }],
  cuchillo: [0.18, (c, o) => { const x = gan(c, o); env(x, 0, 0.02, 0.1, 0.2, 0.05, 0.04, 0.35); ruido(c, 0, 0.17, x, "bandpass", 1800, 3, 5200); }],
  espada: [0.3, (c, o) => { const x = gan(c, o); env(x, 0, 0.03, 0.15, 0.2, 0.08, 0.06, 0.45); ruido(c, 0, 0.28, x, "bandpass", 700, 1.2, 2600); osc(c, "sine", 120, 0, 0.2, gan(c, x, 0.3), 70); }],
  canon: [0.55, (c, o) => { const x = gan(c, sala(c, o, 0.8, 0.25)); env(x, 0, 0.001, 0.2, 0.2, 0.25, 0.03, 0.8); osc(c, "sine", 130, 0, 0.4, gan(c, x, 0.8), 38); ruido(c, 0, 0.35, gan(c, x, 0.6), "lowpass", 1600, 0.7, 150); }],
  magia: [0.3, (c, o) => { const x = gan(c, sala(c, o, 0.7, 0.3)); env(x, 0, 0.005, 0.15, 0.3, 0.1, 0.05, 0.3); osc(c, "sine", 660, 0, 0.28, gan(c, x, 0.5), 1320); osc(c, "triangle", 990, 0, 0.25, gan(c, x, 0.25), 1980); ruido(c, 0, 0.2, gan(c, x, 0.2), "highpass", 5000); }],
  // impactos de área: la magia que revienta, la explosión, el fuego, el hielo, el trueno
  area: [0.4, (c, o) => { const x = gan(c, sala(c, o, 0.8, 0.3)); env(x, 0, 0.001, 0.18, 0.25, 0.15, 0.03, 0.5); ruido(c, 0, 0.3, x, "lowpass", 2400, 1, 300); osc(c, "sine", 220, 0, 0.25, gan(c, x, 0.5), 60); }],
  explota: [0.7, (c, o) => { const x = gan(c, sala(c, o, 1, 0.3)); env(x, 0, 0.001, 0.25, 0.3, 0.35, 0.05, 0.55); ruido(c, 0, 0.6, x, "lowpass", 3000, 0.7, 110); osc(c, "sine", 100, 0, 0.45, gan(c, x, 0.7), 28); }],
  fuego: [0.35, (c, o) => { const x = gan(c, o); env(x, 0, 0.02, 0.15, 0.4, 0.12, 0.08, 0.35); ruido(c, 0, 0.33, x, "bandpass", 900, 0.6, 2800); }],
  hielo: [0.35, (c, o) => { const x = gan(c, sala(c, o, 0.9, 0.4)); env(x, 0, 0.002, 0.12, 0.3, 0.15, 0.04, 0.3); [2637, 3136, 3951].forEach((f, i) => osc(c, "sine", f, i * 0.03, 0.3, gan(c, x, 0.3))); ruido(c, 0, 0.1, gan(c, x, 0.3), "highpass", 6000); }],
  rayo: [0.3, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.08, 0.3, 0.15, 0.05, 0.4); osc(c, "sawtooth", 1800, 0, 0.25, gan(c, x, 0.3), 180); ruido(c, 0, 0.25, gan(c, x, 0.5), "highpass", 2500, 1, 800); }],
  tirar: [0.5, (c, o) => { const x = gan(c, sala(c, o, 0.8, 0.3)); env(x, 0, 0.1, 0.2, 0.5, 0.15, 0.2, 0.35); osc(c, "sine", 90, 0, 0.5, gan(c, x, 0.6), 220); osc(c, "sawtooth", 180, 0, 0.5, gan(c, x, 0.1), 440); }],
  empuja: [0.3, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.15, 0.2, 0.1, 0.02, 0.55); osc(c, "sine", 160, 0, 0.25, gan(c, x, 0.7), 50); ruido(c, 0, 0.12, gan(c, x, 0.3), "lowpass", 1200); }],
  maldice: [0.5, (c, o) => { const x = gan(c, sala(c, o, 1, 0.4)); env(x, 0, 0.02, 0.25, 0.3, 0.2, 0.1, 0.3); osc(c, "sawtooth", 220, 0, 0.45, gan(c, x, 0.2), 110); osc(c, "sine", 233, 0, 0.45, gan(c, x, 0.4), 116); }],
  bicho: [0.15, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.06, 0.3, 0.05, 0.03, 0.25); osc(c, "square", 1400, 0, 0.12, gan(c, x, 0.3), 2600); }],
  torreta: [0.1, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.05, 0.2, 0.03, 0.01, 0.3); osc(c, "square", 700, 0, 0.08, gan(c, x, 0.3), 300); ruido(c, 0, 0.04, gan(c, x, 0.4), "highpass", 4000); }],
  // golpes: al bicho, muere el bicho, le pegan a un héroe, la víbora contra la pared
  golpe: [0.08, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.04, 0.2, 0.02, 0.01, 0.4); ruido(c, 0, 0.07, x, "bandpass", 1500, 1.2); osc(c, "sine", 180, 0, 0.05, gan(c, x, 0.4), 90); }],
  muere: [0.2, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.1, 0.2, 0.06, 0.02, 0.5); ruido(c, 0, 0.18, x, "lowpass", 2200, 1, 220); osc(c, "sine", 140, 0, 0.14, gan(c, x, 0.5), 50); }],
  dolor: [0.35, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.16, 0.2, 0.1, 0.03, 0.6); osc(c, "sine", 120, 0, 0.3, gan(c, x, 0.8), 45); ruido(c, 0, 0.12, gan(c, x, 0.5), "lowpass", 900); }],
  pared: [0.12, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.06, 0.1, 0.03, 0.01, 0.45); osc(c, "sine", 520, 0, 0.1, gan(c, x, 0.5), 180); ruido(c, 0, 0.04, gan(c, x, 0.3), "lowpass", 1400); }],
  muereHeroe: [0.9, (c, o) => { const x = gan(c, sala(c, o, 1.2, 0.35)); env(x, 0, 0.002, 0.3, 0.3, 0.4, 0.1, 0.55); osc(c, "square", 330, 0, 0.8, gan(c, x, 0.25), 70); ruido(c, 0, 0.5, gan(c, x, 0.4), "lowpass", 1800, 1, 200); }],
  // recoger y la interfaz
  cura: [0.45, (c, o) => { const x = gan(c, sala(c, o, 0.9, 0.35)); [76, 81, 88].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.05, 0.004, 0.12, 0.3, 0.2, 0.03, 0.25); osc(c, "sine", mtof(m), i * 0.05, 0.42, y); osc(c, "triangle", mtof(m + 12), i * 0.05, 0.42, gan(c, y, 0.25)); }); }],
  oro: [0.3, (c, o) => { const x = gan(c, o); [2093, 2637].forEach((f, i) => { const y = gan(c, x); env(y, i * 0.06, 0.001, 0.1, 0.25, 0.1, 0.02, 0.3); osc(c, "square", f, i * 0.06, 0.28, gan(c, y, 0.3)); osc(c, "sine", f * 2, i * 0.06, 0.28, gan(c, y, 0.2)); }); }],
  aparece: [0.35, (c, o) => { const x = gan(c, sala(c, o, 0.6, 0.25)); env(x, 0, 0.01, 0.12, 0.3, 0.15, 0.05, 0.25); osc(c, "triangle", 440, 0, 0.3, x, 880); osc(c, "sine", 660, 0.03, 0.3, gan(c, x, 0.4), 1320); }],
  marca: [0.4, (c, o) => { const x = gan(c, sala(c, o, 0.8, 0.3)); [72, 79].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.08, 0.002, 0.1, 0.2, 0.15, 0.02, 0.3); osc(c, "square", mtof(m), i * 0.08, 0.35, gan(c, y, 0.3)); }); }],
  cuenta: [0.12, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.05, 0.2, 0.04, 0.01, 0.4); osc(c, "square", 880, 0, 0.1, gan(c, x, 0.4)); }],
  arranca: [0.35, (c, o) => { const x = gan(c, sala(c, o, 0.8, 0.3)); env(x, 0, 0.001, 0.12, 0.3, 0.15, 0.05, 0.45); osc(c, "square", 1320, 0, 0.3, gan(c, x, 0.35)); osc(c, "sine", 660, 0, 0.3, gan(c, x, 0.4)); }],
  subeNivel: [0.8, (c, o) => { const x = gan(c, sala(c, o, 1.2, 0.35)); [67, 72, 76, 79, 84].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.06, 0.003, 0.12, 0.35, 0.3, 0.04, 0.25); osc(c, "square", mtof(m), i * 0.06, 0.75, gan(c, y, 0.3)); osc(c, "triangle", mtof(m - 12), i * 0.06, 0.75, gan(c, y, 0.5)); }); }],
  comprar: [0.4, (c, o) => { const x = gan(c, sala(c, o, 0.8, 0.25)); [1760, 2349, 2794].forEach((f, i) => { const y = gan(c, x); env(y, i * 0.05, 0.001, 0.08, 0.25, 0.15, 0.02, 0.3); osc(c, "square", f, i * 0.05, 0.38, gan(c, y, 0.3)); }); ruido(c, 0, 0.06, gan(c, x, 0.2), "highpass", 6000); }],
  vender: [0.35, (c, o) => { const x = gan(c, o); [2349, 1760].forEach((f, i) => { const y = gan(c, x); env(y, i * 0.07, 0.001, 0.08, 0.25, 0.12, 0.02, 0.3); osc(c, "square", f, i * 0.07, 0.33, gan(c, y, 0.3)); }); }],
  reroll: [0.25, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.3, 0.08, 0.06, 0.3); osc(c, "square", 400, 0, 0.22, gan(c, x, 0.3), 1200); ruido(c, 0, 0.15, gan(c, x, 0.2), "bandpass", 3000, 1, 6000); }],
  clic: [0.06, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.03, 0.1, 0.02, 0.005, 0.35); osc(c, "square", 1100, 0, 0.05, gan(c, x, 0.35), 700); }],
  roce: [0.05, (c, o) => { const x = gan(c, o); env(x, 0, 0.001, 0.02, 0.1, 0.015, 0.005, 0.2); osc(c, "triangle", 1500, 0, 0.04, x); }],
  no: [0.22, (c, o) => { const x = gan(c, o); env(x, 0, 0.002, 0.1, 0.4, 0.05, 0.08, 0.35); osc(c, "square", 170, 0, 0.2, gan(c, x, 0.5)); osc(c, "square", 160, 0, 0.2, gan(c, x, 0.5)); }],
  elegir: [0.7, (c, o) => { const x = gan(c, sala(c, o, 1.2, 0.35)); [72, 76, 79, 84].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.05, 0.003, 0.1, 0.3, 0.35, 0.03, 0.26); osc(c, "square", mtof(m), i * 0.05, 0.65, gan(c, y, 0.35)); osc(c, "sine", mtof(m + 12), i * 0.05, 0.65, gan(c, y, 0.3)); }); }],
  viento: [0.6, (c, o) => { const x = gan(c, o); env(x, 0, 0.15, 0.2, 0.4, 0.2, 0.2, 0.35); ruido(c, 0, 0.58, x, "bandpass", 400, 1.5, 2400); }],
  jefe: [1.8, (c, o) => { const x = gan(c, sala(c, o, 1.8, 0.4)); env(x, 0, 0.02, 0.4, 0.6, 0.9, 0.3, 0.6); for (const m of [33, 40, 45]) osc(c, "sawtooth", mtof(m), 0, 1.6, gan(c, x, 0.28)); ruido(c, 0, 1.4, gan(c, x, 0.5), "lowpass", 400); }],
  gana: [1.6, (c, o) => { const x = gan(c, sala(c, o, 1.6, 0.4)); [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [88, 0.6]].forEach(([m, t]) => { const y = gan(c, x); env(y, t, 0.003, 0.15, 0.4, 0.6, 0.1, 0.25); osc(c, "square", mtof(m), t, 1.5, gan(c, y, 0.3)); osc(c, "triangle", mtof(m - 12), t, 1.5, gan(c, y, 0.5)); }); }],
  pierde: [2, (c, o) => { const x = gan(c, sala(c, o, 2, 0.45)); [69, 65, 62, 57].forEach((m, i) => { const y = gan(c, x); env(y, i * 0.28, 0.01, 0.2, 0.5, 0.5, 0.2, 0.3); osc(c, "square", mtof(m), i * 0.28, i * 0.28 + 0.9, gan(c, y, 0.25)); osc(c, "triangle", mtof(m - 12), i * 0.28, i * 0.28 + 0.9, y); }); }],
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
  // campanita: dos senos inarmónicos que se apagan (el brillo del menú)
  campana(c, o, t, f, d) { const x = gan(c, o); env(x, t, 0.002, 0.5, 0.15, 0.6, Math.min(d, 0.2), 0.16); osc(c, "sine", f, t, t + d + 0.7, x); osc(c, "sine", f * 2.01, t, t + d + 0.5, gan(c, x, 0.35)); osc(c, "sine", f * 3.98, t, t + 0.3, gan(c, x, 0.12)); },
  // la melodía "chip": cuadrada filtrada con vibrato tardío (suave, no un pitido)
  chip(c, o, t, f, d) {
    const x = gan(c, o), fl = c.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 2400; fl.Q.value = 0.8; fl.connect(x);
    env(x, t, 0.008, 0.12, 0.65, 0.12, d, 0.1);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.01, t + Math.min(0.3, d)); lfo.connect(lg); lfo.start(t); lfo.stop(t + d + 0.2);
    const o1 = osc(c, "square", f, t, t + d + 0.2, fl); lg.connect(o1.frequency); osc(c, "triangle", f / 2, t, t + d + 0.2, gan(c, fl, 0.5));
  },
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
// ── compositor chico: con los acordes de cada compás se arman el bajo, el arpegio y los colchones.
//    Así la armonía de cada voz es la misma siempre (escrito a mano, una nota mal y desafina) ──
const _NOM = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nombreNota = (m) => _NOM[m % 12] + (Math.floor(m / 12) - 1);
const AC = { Am: [57, 60, 64], F: [53, 57, 60], C: [60, 64, 67], G: [55, 59, 62], E: [56, 59, 64], Dm: [57, 62, 65], Em: [55, 59, 64], D: [54, 57, 62], B: [54, 59, 63],
  Fmaj7: [57, 60, 64, 65], Em7: [55, 59, 62, 64], Dm7: [57, 60, 62, 65], Cmaj7: [59, 60, 64, 67], Bb: [58, 62, 65], Gm: [55, 58, 62] };
const RAIZ = { Am: 45, F: 41, C: 48, G: 43, E: 40, Dm: 38, Em: 40, D: 38, B: 35, Fmaj7: 41, Em7: 40, Dm7: 38, Cmaj7: 36, Bb: 34, Gm: 43 };
/** El bajo: por compás, el patrón de 8 corcheas en semitonos sobre la raíz (null = silencio, "." = sigue). */
function bajoDe(acordes, patron) { return acordes.map((a) => patron.map((p) => (p === "." ? "." : p == null ? "-" : nombreNota(RAIZ[a] + p))).join(" ")).join(" | "); }
/** El arpegio: índices de las notas del acorde (+4 = una octava arriba). */
function arpegioDe(acordes, patron, oct = 12) { return acordes.map((a) => patron.map((i) => { if (i === "." || i == null) return i === "." ? "." : "-"; const n = AC[a], k = n.length; return nombreNota(n[i % k] + oct * Math.floor(i / k) + oct); }).join(" ")).join(" | "); }
/** Un colchón: una voz del acorde sostenida todo el compás. */
function colchonDe(acordes, voz, oct = 0) { return acordes.map((a) => [nombreNota(AC[a][voz % AC[a].length] + oct), ".", ".", ".", ".", ".", ".", "."].join(" ")).join(" | "); }
const _AREN = ["Am", "F", "C", "G", "Am", "F", "C", "E", "F", "G", "Am", "Am", "F", "G", "E", "E"];
const _TIT = ["Am", "F", "C", "G", "Am", "F", "G", "E"];
const _TIE = ["Fmaj7", "Em7", "Dm7", "Cmaj7", "Fmaj7", "Em7", "Dm7", "E"];
const _JEF = ["Em", "C", "D", "B", "Em", "C", "Am", "B"];
const TEMAS = {
  // el menú: colchón y campanitas lentas, sin batería (como abrir el juego a la noche)
  titulo: { bpm: 84, pasos: 64, loop: true, voces: {
    "coro*0.7": colchonDe(_TIT, 0), "coro2*0.6": colchonDe(_TIT, 1), "coro3*0.5": colchonDe(_TIT, 2),
    "bajo*0.6": bajoDe(_TIT, [0, ".", ".", ".", 0, ".", 7, "."]),
    "campana*0.7": arpegioDe(_TIT, [0, null, 1, null, 2, null, 4, null]),
    "chip*0.5": "- - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | E5 . . . A5 . . . | C6 . . . A5 . G5 . | G5 . . . D5 . . . | G#5 . . . . . . .",
  } },
  // la arena: la que empuja (bajo en corcheas, arpegio, batería en negras, melodía la segunda vuelta)
  arena: { bpm: 124, pasos: 128, loop: true, voces: {
    "bajo": bajoDe(_AREN, [0, 0, 12, 0, 0, 12, 0, 7]),
    "clave*0.55": arpegioDe(_AREN, [0, 1, 2, 3, 2, 1, 0, 1]),
    "coro*0.35": colchonDe(_AREN, 0, -12), "coro2*0.3": colchonDe(_AREN, 2, -12),
    "chip*0.85": "- - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | - - - - - - - - | A5 . . G5 F5 . E5 . | D5 . . . G5 . B5 . | C6 . . B5 A5 . E5 . | A5 . . . . . - - | F5 . A5 . C6 . A5 . | B5 . . . D6 . B5 . | G#5 . . . B5 . . . | E6 . . . D6 . B5 .",
  }, bat: { bombo: "x...x...".repeat(16), caja: "..x...x.".repeat(16), plato: "x.x.x.xx".repeat(16) } },
  // la tienda: acordes con séptima, tranquilo (se piensa acá)
  tienda: { bpm: 96, pasos: 64, loop: true, voces: {
    "bajo*0.7": bajoDe(_TIE, [0, ".", ".", 7, 12, ".", 7, "."]),
    "clave*0.5": arpegioDe(_TIE, [0, 2, 1, 3, 0, 2, 1, 3]),
    "coro*0.45": colchonDe(_TIE, 0), "coro2*0.4": colchonDe(_TIE, 2),
    "campana*0.45": "- - - - E6 . . . | - - - - D6 . . . | - - - - C6 . . . | - - - - B5 . . . | - - - - A5 . C6 . | - - - - B5 . G5 . | - - - - A5 . F5 . | G#5 . . . . . . .",
  }, bat: { bombo: "x.......x.......".repeat(4), caja: "....x.......x...".repeat(4), plato: "..x...x...x...x.".repeat(4) } },
  // el jefe: Mi menor a 150, todo en corcheas
  jefe: { bpm: 150, pasos: 64, loop: true, voces: {
    "bajo": bajoDe(_JEF, [0, 0, 12, 0, 0, 12, 10, 12]),
    "clave*0.5": arpegioDe(_JEF, [0, 1, 2, 4, 2, 1, 0, 1]),
    "lead*0.75": "E5 . B5 . E6 . D6 C6 | B5 . . . G5 . E5 . | F#5 . . . A5 . D6 . | D#6 . . . B5 . . . | E6 . D6 . C6 . B5 . | C6 . B5 . A5 . G5 . | A5 . C6 . E6 . D6 . | D#6 . . . F#6 . . .",
  }, bat: { bombo: "x.x.x.x.".repeat(8), caja: "..x...xx".repeat(8), plato: "xxxxxxxx".repeat(8) } },
  // perder: bajando despacio, sin bucle
  fin: { bpm: 72, pasos: 32, cola: 3, voces: {
    "organo*0.8": "A3 . . . . . . . F3 . . . . . . . D3 . . . E3 . . . A2 . . . . . . .",
    "coro*1.1": "E4 . . . C4 . . . A3 . . . . . . . F3 . . . G#3 . . . A3 . . . . . . .",
  } },
  // ganar el nivel 25
  victoria: { bpm: 110, pasos: 32, cola: 3, voces: {
    "chip": "C5 . E5 . G5 . C6 . | A5 . F5 . C6 . . . | G5 . B5 . D6 . G6 . | E6 . . . . . . .",
    "coro*0.6": colchonDe(["C", "F", "G", "C"], 0), "coro2*0.5": colchonDe(["C", "F", "G", "C"], 2),
    "bajo*0.7": bajoDe(["C", "F", "G", "C"], [0, ".", 12, ".", 0, ".", 7, "."]),
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
    for (const k of ["titulo", "arena", "tienda", "jefe", "fin", "victoria"]) { await hornearTema(k, TEMAS[k]); if (AU.pedido === k) tocarTema(k); }
  } catch (e) { AU.error = String(e); }
  AU.msHorneo = Math.round(performance.now() - t0);
}

/** Toca un efecto. Los que se repiten mucho (gemas, golpes) tienen un mínimo entre dos. */
const SEPARA = { golpe: 0.035, muere: 0.04, tiro: 0.04, flecha: 0.05, cuchillo: 0.05, torreta: 0.05, area: 0.06, fuego: 0.12, hielo: 0.1, rayo: 0.06, pared: 0.08, oro: 0.05, cura: 0.08, bicho: 0.08, dolor: 0.06, aparece: 0.03, espada: 0.06, magia: 0.05 };
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
