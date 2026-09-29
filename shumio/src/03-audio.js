// ─────────────────────────────────────────────────────────────────────────────
// EL SONIDO, sintetizado (sin archivos), pero TOCADO, no de consola vieja. La referencia es la
// descripción oficial del disco del original (Steam): "dos músicos tocan todo; muchas guitarras
// mutiladas, baterías castigadas y voces raspadas; un toro analógico en la cristalería del
// chiptune", y la wiki: cada pista de piso tiene una CAPA MÁS PESADA (guitarra, batería) que
// entra cuando hay muchos enemigos. Así que acá hay:
//   · cuerdas pulsadas de verdad (Karplus-Strong: un ruido que se filtra y resuena como cuerda),
//     limpias para los arpegios y distorsionadas (saturación + caja de amplificador) para lo pesado;
//   · batería (bombo con golpe de parche, caja con bordonera, platillos de ruido);
//   · voces con formantes (la boca como filtros: "a", "o", "u") para el coro y los quejidos;
//   · piano (parciales con su poquito de desafinación y martillo), órgano y colchones;
//   · todo por una sala con reverberación (respuesta de sala generada) y una saturación de cinta.
// El AudioContext nace con el primer toque (los navegadores no dejan sonar antes).
// ─────────────────────────────────────────────────────────────────────────────

let MEDIDOR = null, SALIDA_EL = null, SALIDA_DEST = null;
// La salida: "directa" (a los parlantes) o "reproductor" (por un elemento <audio>, el mismo camino que
// usa un video; en algunos teléfonos es lo único que suena). Se elige en el menú y se recuerda.
let modoSalida = "directa";
try { modoSalida = localStorage.getItem("shumio-salida") || "directa"; } catch (e) { /* sin guardar */ }
let AC = null, SAL = null, MUS = null, EFX = null, RUIDO = null, ECO = null, ECO_LARGO = null;
let volMusica = 0.55, volEfectos = 0.8;
try { const g = JSON.parse(localStorage.getItem("shumio-audio") || "{}"); if (g.m != null) volMusica = g.m; if (g.e != null) volEfectos = g.e; } catch (e) { /* sin guardar */ }

/** Una respuesta de sala: ruido estéreo que se apaga y se oscurece (las paredes comen agudos). */
function salaImpulso(seg, caida, oscuro) {
  const sr = AC.sampleRate, n = Math.floor(sr * seg), b = AC.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n, k = oscuro + (1 - oscuro) * (1 - u);   // cada vez más opaco
      lp += ((Math.random() * 2 - 1) - lp) * k;
      d[i] = lp * Math.pow(1 - u, caida) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
    }
  }
  return b;
}
/** Una curva de saturación (tanh): la "cinta" del máster y la distorsión de la guitarra. */
const _curvas = {};
function curvaSat(k) {
  if (_curvas[k]) return _curvas[k];
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
  return (_curvas[k] = c);
}

// Lo que pasó con el audio, para mostrarlo en el menú (si en un teléfono no suena, que se vea por qué).
const AUDIO = { error: null, gestos: 0, desde: 0 };
function audioDespertar() {
  AUDIO.gestos++;
  if (AC) {
    if (AC.state !== "running" && AC.state !== "closed") AC.resume().catch((e) => { AUDIO.error = "resume: " + (e && e.message || e); });
    desbloquearElemento();
    return;
  }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) { AUDIO.error = "este navegador no tiene Web Audio"; return; }
    let ctx;
    try { ctx = new C({ latencyHint: "interactive", sampleRate: SR_MUSICA }); } catch (e) { ctx = new C({ latencyHint: "interactive" }); }
    armarAudio(ctx);
    AUDIO.desde = performance.now();
    if (AC.state !== "running") AC.resume().catch((e) => { AUDIO.error = "resume: " + (e && e.message || e); });
    prepararEfectos();
    Musica.arrancar();
    desbloquearElemento();
  } catch (e) { AUDIO.error = (e && e.message) || String(e); AC = null; }
}
/** Algunos Android (y los WebView de los visores de archivos) no dejan sonar nada hasta que un
 *  elemento <audio> suena dentro de un gesto: se toca un silencio cortito, una vez. */
let _elementoListo = false;
function desbloquearElemento() {
  if (_elementoListo) return;
  try {
    const sr = 8000, n = 800, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    const el = new Audio(URL.createObjectURL(new Blob([b], { type: "audio/wav" })));
    el.volume = 0.01;
    const p = el.play(); if (p && p.then) p.then(() => { _elementoListo = true; }).catch(() => {});
  } catch (e) { /* no importa: es una ayuda extra */ }
}
function conectarSalida() {
  if (!AC || !SAL) return;
  try { SAL.disconnect(); } catch (e) { /* nada */ }
  SAL.connect(MEDIDOR);
  if (modoSalida === "reproductor" && AC.createMediaStreamDestination) {
    SALIDA_DEST ||= AC.createMediaStreamDestination();
    SAL.connect(SALIDA_DEST);
    if (!SALIDA_EL) { SALIDA_EL = new Audio(); SALIDA_EL.autoplay = true; }
    SALIDA_EL.srcObject = SALIDA_DEST.stream;
    const p = SALIDA_EL.play(); if (p && p.catch) p.catch((e) => { AUDIO.error = "reproductor: " + (e && e.message || e); });
  } else {
    if (SALIDA_EL) SALIDA_EL.pause();
    SAL.connect(AC.destination);
  }
}
function cambiarSalida() {
  modoSalida = modoSalida === "directa" ? "reproductor" : "directa";
  try { localStorage.setItem("shumio-salida", modoSalida); } catch (e) { /* nada */ }
  conectarSalida(); probarSonido();
}
/** El pico de lo que sale, en dB (−∞ si nada). */
const _medida = new Float32Array(1024);
function nivelAudio() {
  if (!MEDIDOR) return -Infinity;
  MEDIDOR.getFloatTimeDomainData(_medida);
  let m = 0; for (let i = 0; i < _medida.length; i++) m = Math.max(m, Math.abs(_medida[i]));
  return m > 0 ? 20 * Math.log10(m) : -Infinity;
}
/** Cómo está el sonido, en palabras (lo muestra el menú). */
function estadoAudio() {
  if (AUDIO.error && !AC) return "ERROR: " + AUDIO.error.slice(0, 40).toUpperCase();
  if (!AC) return AUDIO.gestos ? "NO ARRANCÓ" : "TOCÁ PARA ACTIVAR";
  if (AC.state === "running") { const n = nivelAudio(), p = pendientesBanco(); return (p ? "PREPARANDO " + p + ", " : "ANDANDO, ") + "SALE " + (n > -90 ? Math.round(n) + " DB" : "SILENCIO"); }
  return AC.state === "suspended" ? "BLOQUEADO: TOCÁ OTRA VEZ" : AC.state.toUpperCase();
}
function probarSonido() {
  audioDespertar();
  if (!AC) return;
  SFX.objeto();
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.frequency.value = 440; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  o.connect(g); g.connect(EFX); o.start(t); o.stop(t + 0.55);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && AC && AC.state !== "running") AC.resume().catch(() => {}); });

/** Arma el grafo (también sirve con un OfflineAudioContext, para grabar muestras en las pruebas). */
let _desfase = 0;
function armarAudio(ctx) {
  {
    AC = ctx;
    // el máster: una saturación suave (cinta) y un compresor que lo pega todo
    SAL = AC.createDynamicsCompressor(); SAL.threshold.value = -16; SAL.ratio.value = 3.5; SAL.attack.value = 0.006; SAL.release.value = 0.2;
    // el medidor: cuánta señal sale de verdad (si marca nivel y no se oye, el problema está afuera
    // del juego: el volumen del teléfono o los permisos de sonido del navegador)
    MEDIDOR = AC.createAnalyser(); MEDIDOR.fftSize = 1024; SAL.connect(MEDIDOR);
    conectarSalida();
    const cinta = AC.createWaveShaper(); cinta.curve = curvaSat(1.4); cinta.connect(SAL);
    MUS = AC.createGain(); MUS.gain.value = volMusica; MUS.connect(cinta);
    EFX = AC.createGain(); EFX.gain.value = volEfectos; EFX.connect(cinta);
    // dos salas: la del sótano (corta, de piedra) y una grande para el coro y los colchones
    ECO = AC.createConvolver(); ECO.buffer = salaImpulso(1.6, 3.4, 0.35);
    ECO_LARGO = AC.createConvolver(); ECO_LARGO.buffer = salaImpulso(3.8, 2.6, 0.2);
    const e1 = AC.createGain(); e1.gain.value = 0.32; ECO.connect(e1); e1.connect(cinta);
    const e2 = AC.createGain(); e2.gain.value = 0.3; ECO_LARGO.connect(e2); e2.connect(cinta);
    RUIDO = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const r = RUIDO.getChannelData(0); for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
  }
}


// ── EL BANCO DE SONIDOS ─────────────────────────────────────────────────────────────────────
// Sintetizar cada nota en vivo (7 osciladores por nota de piano, 3 filtros por voz, dos salas de
// reverberación calculándose todo el tiempo) no entra en tiempo real en un teléfono común: medido,
// la pista del jefe se calculaba apenas 4 veces más rápido que el tiempo real en un Xeon de
// servidor, y en el teléfono se cortaba (Android corta la salida cuando el audio no llega a tiempo).
// Así que cada nota y cada efecto se HORNEA una sola vez, en segundo plano (OfflineAudioContext),
// con su sala ya incluida, y después se toca como una grabación: dos nodos por nota. Suena igual.
let _grabando = false;          // true mientras se hornea: las primitivas suenan "de verdad"
let _soloJuntar = null;         // un Set: en vez de tocar, junta las claves que va a necesitar una pista
const BANCO = new Map();        // clave → { buf, pendiente, usado }
const COLA_YA = [], COLA = [];  // lo urgente (efectos, la pista que suena) y lo demás
let _horneando = false, BANCO_BYTES = 0;
// 24 kHz para todo (y el contexto en vivo también, así nada se convierte al tocar): alcanza para
// esta música oscura y en un parlante de teléfono no se nota; pesa la mitad que 48 kHz
const SR_MUSICA = 24000, SR_EFECTOS = 24000;
const PRIMITIVAS = {
  tono: { real: (o) => _tonoReal(o), vol: 0.2, dur: 0.12, eco: 0, ecoLargo: 0 },
  ruido: { real: (o) => _ruidoReal(o), vol: 0.25, dur: 0.15, eco: 0, ecoLargo: 0 },
  metal: { real: (o) => _metalReal(o), vol: 0.12, dur: 0.5, eco: 0.2, ecoLargo: 0 },
  voz: { real: (o) => _vozReal(o), vol: 0.15, dur: 0.4, eco: 0.2, ecoLargo: 0 },
  cuerda: { real: (o) => _cuerdaReal(o), vol: 0.2, dur: 1.2, eco: 0.25, ecoLargo: 0 },
  piano: { real: (o) => _pianoReal(o), vol: 0.12, dur: 2.5, eco: 0.3, ecoLargo: 0.15 },
  colchon: { real: (o) => _colchonReal(o), vol: 0.05, dur: 4, eco: 0, ecoLargo: 0.5 },
};
/** Las frecuencias se redondean a cuarto de semitono (si no, cada gota "al azar" sería una muestra nueva). */
const _cuarto = (f) => 440 * Math.pow(2, Math.round(48 * Math.log2(f / 440)) / 48);
function claveDe(tipo, o) {
  const q = {};
  for (const k of Object.keys(o).sort()) {
    if (k === "cuando" || k === "salida" || k === "vol") continue;
    let v = o[k];
    if ((k === "f" || k === "f2") && typeof v === "number" && v > 0) v = _cuarto(v);
    else if (typeof v === "number") v = Math.round(v * 100) / 100;
    q[k] = v;
  }
  return { clave: tipo + JSON.stringify(q), limpio: q };
}
function _tono(o = {}) { return _grabando ? _tonoReal(o) : banco("tono", o); }
function _ruido(o = {}) { return _grabando ? _ruidoReal(o) : banco("ruido", o); }
function _metal(o = {}) { return _grabando ? _metalReal(o) : banco("metal", o); }
function _voz(o = {}) { return _grabando ? _vozReal(o) : banco("voz", o); }
function _cuerda(o = {}) { return _grabando ? _cuerdaReal(o) : banco("cuerda", o); }
function _piano(o = {}) { return _grabando ? _pianoReal(o) : banco("piano", o); }
function _colchon(o = {}) { return _grabando ? _colchonReal(o) : banco("colchon", o); }
function banco(tipo, o) {
  if (!AC) return;
  const P = PRIMITIVAS[tipo], { clave, limpio } = claveDe(tipo, o);
  let e = BANCO.get(clave);
  if (!e) {
    e = { pendiente: true, usado: 0 };
    BANCO.set(clave, e);
    const dur = (limpio.dur ?? P.dur) + (limpio.cola || 0);
    const eco = limpio.eco ?? P.eco, largo = limpio.ecoLargo ?? P.ecoLargo;
    const segs = dur + (largo ? 2.9 : eco ? 1.4 : 0.1) + 0.05;
    const trabajo = { e, segs, sr: SR_MUSICA, hacer: () => P.real({ ...limpio, cuando: 0, vol: 1, salida: MUS }) };
    (_soloJuntar || o.salida === EFX ? COLA_YA : COLA).push(trabajo);
    hornearCola();
  }
  if (_soloJuntar) { _soloJuntar.add(e); return; }
  if (e.buf) tocarBuf(e, o.cuando || 0, o.vol ?? P.vol, o.salida || MUS, 1);
}
/** Toca una muestra horneada (a su hora; si ya se pasó, ya mismo). */
function tocarBuf(e, cuando, vol, salida, velocidad) {
  const t = Math.max(AC.currentTime, AC.currentTime + cuando + _desfase), s = AC.createBufferSource(), g = AC.createGain();
  s.buffer = e.buf; s.playbackRate.value = velocidad; g.gain.value = vol;
  s.connect(g); g.connect(salida || MUS); s.start(t);
  e.usado = AC.currentTime;
}
/** El grafo mínimo para hornear: sin compresor ni cinta (eso va en vivo), con las dos salas. */
const _salasPorSR = {}, _ruidoPorSR = {};
function armarBanco(ctx) {
  AC = ctx;
  MUS = EFX = ctx.createGain(); MUS.connect(ctx.destination);
  const sr = ctx.sampleRate;
  if (!_salasPorSR[sr]) { _salasPorSR[sr] = [salaImpulso(1.3, 3.4, 0.35), salaImpulso(2.8, 2.6, 0.2)]; }
  if (!_ruidoPorSR[sr]) { const r = ctx.createBuffer(1, sr * 2, sr), d = r.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; _ruidoPorSR[sr] = r; }
  ECO = ctx.createConvolver(); ECO.buffer = _salasPorSR[sr][0];
  ECO_LARGO = ctx.createConvolver(); ECO_LARGO.buffer = _salasPorSR[sr][1];
  const e1 = ctx.createGain(); e1.gain.value = 0.32; ECO.connect(e1); e1.connect(ctx.destination);
  const e2 = ctx.createGain(); e2.gain.value = 0.3; ECO_LARGO.connect(e2); e2.connect(ctx.destination);
  RUIDO = _ruidoPorSR[sr];
}
/** Hornea lo que haya en la cola POR TANDAS: muchas muestras una detrás de otra en un solo render
 *  (preparar las salas de reverberación es lo caro: así se prepara una vez por tanda, no por nota),
 *  y después se corta cada una. Lo urgente (efectos, la pista que suena) va primero. */
async function hornearCola() {
  if (_horneando || typeof OfflineAudioContext === "undefined") return;
  _horneando = true;
  try {
    while (COLA_YA.length || COLA.length) {
      const cola = COLA_YA.length ? COLA_YA : COLA, sr = cola[0].sr, tanda = [];
      let total = 0;
      while (cola.length && cola[0].sr === sr && total < 24 && tanda.length < 48) { const tr = cola.shift(); tr.desde = total; total += tr.segs + 0.05; tanda.push(tr); }
      const ctx = new OfflineAudioContext(2, Math.ceil(sr * total), sr);
      const antes = [AC, SAL, MUS, EFX, RUIDO, ECO, ECO_LARGO, MEDIDOR], desf = _desfase;
      try { armarBanco(ctx); _grabando = true; for (const tr of tanda) { _desfase = tr.desde; tr.hacer(); } }
      catch (err) { AUDIO.error = "horno: " + (err && err.message || err); }
      finally { _grabando = false; _desfase = desf; [AC, SAL, MUS, EFX, RUIDO, ECO, ECO_LARGO, MEDIDOR] = antes; }
      const todo = await ctx.startRendering();
      for (const tr of tanda) {
        const i0 = Math.floor(tr.desde * sr), n = Math.min(todo.length - i0, Math.ceil(tr.segs * sr));
        // en mono (el parlante del teléfono lo es): la mitad de memoria y de trabajo al tocar
        const L = todo.getChannelData(0), R = todo.getChannelData(1), m = new Float32Array(Math.max(1, n));
        for (let i = 0; i < n; i++) m[i] = (L[i0 + i] + R[i0 + i]) * 0.5;
        let buf = new AudioBuffer({ length: m.length, numberOfChannels: 1, sampleRate: sr });
        buf.copyToChannel(m, 0);
        buf = recortarSilencio(buf);
        tr.e.buf = buf; tr.e.pendiente = false;
        BANCO_BYTES += buf.length * 4;
      }
      if (BANCO_BYTES > 40e6) olvidarViejas();
    }
  } finally { _horneando = false; }
}
/** Saca la cola de silencio del final (la sala se apaga antes de lo que se reservó). */
function recortarSilencio(b) {
  let fin = 0;
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = d.length - 1; i > fin; i--) if (Math.abs(d[i]) > 1e-3) { fin = i; break; } }   // −60 dB: ya no se oye
  const n = Math.max(1, fin + 1);
  if (n >= b.length - 64) return b;
  const r = new AudioBuffer({ length: n, numberOfChannels: b.numberOfChannels, sampleRate: b.sampleRate });
  for (let c = 0; c < b.numberOfChannels; c++) r.copyToChannel(b.getChannelData(c).subarray(0, n), c);
  return r;
}
/** Si el banco pesa demasiado (teléfonos con poca memoria), se olvidan las muestras que hace más no suenan. */
function olvidarViejas() {
  const listas = [...BANCO.entries()].filter(([, e]) => e.buf).sort((a, b) => a[1].usado - b[1].usado);
  for (const [k, e] of listas) { if (BANCO_BYTES < 28e6) break; if (AC && AC.currentTime - e.usado < 30) continue; BANCO_BYTES -= e.buf.length * e.buf.numberOfChannels * 4; BANCO.delete(k); }
}
const pendientesBanco = () => COLA_YA.length + COLA.length + (_horneando ? 1 : 0);

// ── piezas chicas ──
/** Una envolvente: sube en `ataque`, se sostiene y cae exponencial en `dur`. */
function _env(g, t, vol, ataque, dur, cola = 0) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + ataque);
  if (cola) g.gain.setValueAtTime(vol, t + Math.max(ataque, dur - cola));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
/** Manda un nodo a la salida y, si se pide, a la sala. */
function _salida(n, salida, eco, ecoLargo) {
  n.connect(salida);
  if (eco) { const g = AC.createGain(); g.gain.value = eco; n.connect(g); g.connect(ECO); }
  if (ecoLargo) { const g = AC.createGain(); g.gain.value = ecoLargo; n.connect(g); g.connect(ECO_LARGO); }
}
function _tonoReal({ f = 440, f2 = null, dur = 0.12, tipo = "sine", vol = 0.2, ataque = 0.004, salida = EFX, eco = 0, ecoLargo = 0, cuando = 0, filtro = 0, q = 1, vib = 0 }) {
  if (!AC || f > AC.sampleRate * 0.45) return;   // lo que no se oye no se toca
  const t = AC.currentTime + cuando + _desfase, o = AC.createOscillator(), g = AC.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  if (vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 5.5; lg.gain.value = f * vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  _env(g, t, vol, ataque, dur);
  let n = o;
  if (filtro) { const fl = AC.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filtro; fl.Q.value = q; o.connect(fl); n = fl; }
  n.connect(g); _salida(g, salida, eco, ecoLargo);
  o.start(t); o.stop(t + dur + 0.05);
}
function _ruidoReal({ dur = 0.15, vol = 0.25, f = 1200, f2 = null, tipo = "lowpass", q = 1, salida = EFX, eco = 0, ecoLargo = 0, cuando = 0, ataque = 0.002 }) {
  if (!AC) return;
  const t = AC.currentTime + cuando + _desfase, s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = RUIDO; s.playbackRate.value = 0.7 + Math.random() * 0.6;
  fl.type = tipo; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
  _env(g, t, vol, ataque, dur);
  s.connect(fl); fl.connect(g); _salida(g, salida, eco, ecoLargo);
  s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
}
const va = (x, p = 0.1) => x * (1 - p + Math.random() * p * 2);   // variar ±10 % lo que se repite
const midiF = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Una campana o un metal: parciales inarmónicos que se apagan a distinto ritmo. */
function _metalReal({ f = 1800, dur = 0.5, vol = 0.12, cuando = 0, salida = EFX, eco = 0.2, parciales = [1, 2.76, 5.4, 8.93], ecoLargo = 0 }) {
  parciales.forEach((p, i) => _tono({ f: f * p, dur: dur / (1 + i * 0.7), tipo: "sine", vol: vol / (1 + i * 0.9), ataque: 0.001, cuando, salida, eco, ecoLargo }));
}

/** Una voz: una glotis (diente de sierra con vibrato y respiración) por los formantes de la vocal. */
const VOCALES = { a: [[800, 1], [1150, 0.5], [2900, 0.25]], o: [[450, 1], [800, 0.45], [2830, 0.15]], u: [[325, 1], [700, 0.3], [2530, 0.1]], e: [[400, 1], [1600, 0.5], [2700, 0.25]] };
function _vozReal({ f = 220, f2 = null, dur = 0.4, vol = 0.15, vocal = "a", cuando = 0, salida = EFX, eco = 0.2, ecoLargo = 0, ataque = 0.02, vib = 0.012, aire = 0.15, raspa = 0, cola = 0 }) {
  if (!AC) return;
  const t = AC.currentTime + cuando + _desfase, o = AC.createOscillator(), mezcla = AC.createGain(), g = AC.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 4.8 + Math.random(); lg.gain.value = f * vib; l.connect(lg); lg.connect(o.frequency);
  let fuente = o;
  if (raspa) { const w = AC.createWaveShaper(); w.curve = curvaSat(1 + raspa * 8); o.connect(w); fuente = w; }
  for (const [ff, a] of VOCALES[vocal]) { const b = AC.createBiquadFilter(); b.type = "bandpass"; b.frequency.value = ff * (f > 300 ? 1.08 : 1); b.Q.value = 7; const bg = AC.createGain(); bg.gain.value = a * 2.2; fuente.connect(b); b.connect(bg); bg.connect(mezcla); }
  if (aire) { const s = AC.createBufferSource(), fl = AC.createBiquadFilter(), ag = AC.createGain(); s.buffer = RUIDO; fl.type = "bandpass"; fl.frequency.value = VOCALES[vocal][1][0]; fl.Q.value = 1.5; ag.gain.value = aire; s.connect(fl); fl.connect(ag); ag.connect(mezcla); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  _env(g, t, vol, ataque, dur, cola);
  mezcla.connect(g); _salida(g, salida, eco, ecoLargo);
  o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
}

// ── la cuerda pulsada (Karplus-Strong): se calcula una vez por nota y se guarda ──
const _cuerdas = new Map();
function cuerdaBuf(midi, brillo = 0.5, seg = 2.2) {
  const k = `${midi}|${brillo}|${AC.sampleRate}`;
  if (_cuerdas.has(k)) return _cuerdas.get(k);
  const sr = AC.sampleRate, n = Math.floor(sr * seg), b = AC.createBuffer(1, n, sr), d = b.getChannelData(0);
  const f = midiF(midi), P = Math.max(2, Math.round(sr / f)), linea = new Float32Array(P);
  // el "púa": ruido filtrado según el brillo (más oscuro = dedo, más claro = púa)
  let lp = 0; for (let i = 0; i < P; i++) { lp += ((Math.random() * 2 - 1) - lp) * (0.25 + brillo * 0.7); linea[i] = lp; }
  const perdida = 0.996 - (f > 400 ? 0.004 : 0) + (f < 110 ? 0.002 : 0);
  let j = 0, prev = 0;
  for (let i = 0; i < n; i++) { const x = linea[j]; const y = perdida * (0.5 * x + 0.5 * prev); prev = x; linea[j] = y; d[i] = x; j = (j + 1) % P; }
  _cuerdas.set(k, b);
  return b;
}
/** Una nota de cuerda. dist: 0 limpia; >0 guitarra saturada por un "amplificador". */
function _cuerdaReal({ midi, cuando = 0, dur = 1.2, vol = 0.2, salida = MUS, eco = 0.25, ecoLargo = 0, brillo = 0.5, dist = 0, filtro = 5000, pan = 0 }) {
  if (!AC) return;
  const t = AC.currentTime + cuando + _desfase, s = AC.createBufferSource(), g = AC.createGain();
  s.buffer = cuerdaBuf(midi, brillo);
  let n = s;
  if (dist) { const pre = AC.createGain(); pre.gain.value = 1 + dist * 6; const w = AC.createWaveShaper(); w.curve = curvaSat(2 + dist * 6); w.oversample = "2x"; s.connect(pre); pre.connect(w); n = w; }
  const fl = AC.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = dist ? Math.min(filtro, 3200) : filtro; fl.Q.value = dist ? 1.2 : 0.7;
  n.connect(fl); n = fl;
  if (dist) { const m = AC.createBiquadFilter(); m.type = "peaking"; m.frequency.value = 800; m.gain.value = -6; m.Q.value = 1; n.connect(m); n = m; }   // el "hueco" de medios de la guitarra pesada
  if (pan && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; }
  g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(g); _salida(g, salida, eco, ecoLargo);
  s.start(t); s.stop(t + dur + 0.05);
}

/** Un piano: cada parcial un poquito más agudo de lo justo (la cuerda rígida) y el golpe del martillo. */
function _pianoReal({ midi, cuando = 0, dur = 2.5, vol = 0.12, salida = MUS, eco = 0.3, ecoLargo = 0.15 }) {
  const f = midiF(midi);
  for (let k = 1; k <= 6; k++) _tono({ f: f * k * (1 + 0.0004 * k * k), dur: dur / (0.6 + k * 0.5), tipo: "sine", vol: vol / (k * k * 0.6 + 0.4), ataque: 0.003, cuando, salida, eco, ecoLargo });
  _ruido({ dur: 0.03, vol: vol * 0.25, f: 2500, tipo: "bandpass", q: 1, cuando, salida });
}
/** Un colchón: tres sierras desafinadas por nota, con filtro que respira (cuerdas / órgano viejo). */
function _colchonReal({ notas, cuando = 0, dur = 4, vol = 0.05, salida = MUS, filtro = 900, ecoLargo = 0.5, ataque = 0.8 }) {
  if (!AC) return;
  const t = AC.currentTime + cuando + _desfase, fl = AC.createBiquadFilter(), g = AC.createGain();
  fl.type = "lowpass"; fl.frequency.setValueAtTime(filtro * 0.5, t); fl.frequency.linearRampToValueAtTime(filtro, t + dur * 0.5); fl.frequency.linearRampToValueAtTime(filtro * 0.6, t + dur); fl.Q.value = 0.8;
  for (const m of notas) for (const d of [-9, 0, 8]) { const o = AC.createOscillator(); o.type = "sawtooth"; o.frequency.value = midiF(m); o.detune.value = d + (Math.random() - 0.5) * 4; o.connect(fl); o.start(t); o.stop(t + dur + 0.1); }
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + ataque); g.gain.setValueAtTime(vol, t + dur - ataque); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  fl.connect(g); _salida(g, salida, 0, ecoLargo);
}

// ── la batería (tocada: cada golpe varía un poco) ──
const BAT = {
  bombo(cuando, vol = 0.5, salida = MUS) { _tono({ f: va(130, 0.05), f2: 42, dur: 0.32, tipo: "sine", vol, ataque: 0.002, cuando, salida, eco: 0.08 }); _ruido({ dur: 0.02, vol: vol * 0.4, f: 3000, tipo: "lowpass", cuando, salida }); },
  caja(cuando, vol = 0.3, salida = MUS) { _ruido({ dur: va(0.2, 0.1), vol, f: 1900, f2: 900, tipo: "bandpass", q: 0.7, cuando, salida, eco: 0.3 }); _tono({ f: va(210, 0.04), f2: 150, dur: 0.1, tipo: "triangle", vol: vol * 0.7, cuando, salida }); },
  tom(cuando, f = 110, vol = 0.35, salida = MUS) { _tono({ f, f2: f * 0.6, dur: 0.4, tipo: "sine", vol, ataque: 0.002, cuando, salida, eco: 0.3 }); _ruido({ dur: 0.05, vol: vol * 0.3, f: 1200, tipo: "bandpass", cuando, salida }); },
  hihat(cuando, vol = 0.06, abierto = false, salida = MUS) { _ruido({ dur: abierto ? 0.35 : 0.04, vol, f: 7500, tipo: "highpass", q: 0.5, cuando, salida }); },
  platillo(cuando, vol = 0.12, salida = MUS) { _ruido({ dur: 1.8, vol, f: 5500, tipo: "highpass", q: 0.4, cuando, salida, ecoLargo: 0.3 }); _metal({ f: 420, dur: 1.2, vol: vol * 0.3, cuando, salida, eco: 0.2, parciales: [1, 1.48, 2.21, 3.1] }); },
};

// ── los efectos: orgánicos (agua, carne, piedra, metal, voces) ──
const SFX = {
  // la lágrima: un "plip" mojado (gota que cae) — corto y suave, porque suena todo el tiempo
  lagrima: () => { _tono({ f: va(900), f2: 260, dur: 0.07, tipo: "sine", vol: 0.1, ataque: 0.002 }); _ruido({ dur: 0.035, vol: 0.05, f: va(1600), tipo: "bandpass", q: 3 }); },
  chapoteo: () => { _ruido({ dur: 0.12, vol: 0.09, f: va(1300), f2: 350, tipo: "bandpass", q: 1.6 }); _tono({ f: va(240), f2: 90, dur: 0.07, tipo: "sine", vol: 0.06 }); },
  golpe: () => { _ruido({ dur: 0.08, vol: 0.18, f: va(1400), f2: 260, tipo: "lowpass" }); _tono({ f: va(170), f2: 60, dur: 0.09, tipo: "sine", vol: 0.14 }); },
  // Shumio se queja: una voz de nene, "ugh", que cae
  dolor: () => { _voz({ f: va(420, 0.05), f2: 250, dur: 0.3, vol: 0.22, vocal: "u", eco: 0.25, raspa: 0.3, ataque: 0.01 }); _ruido({ dur: 0.1, vol: 0.08, f: 900, tipo: "lowpass" }); },
  muere: () => { _ruido({ dur: 0.3, vol: 0.2, f: va(1300), f2: 200, tipo: "lowpass", eco: 0.3 }); _tono({ f: va(120), f2: 40, dur: 0.25, tipo: "sine", vol: 0.2 }); _ruido({ dur: 0.18, vol: 0.1, f: 700, f2: 300, tipo: "bandpass", q: 2, cuando: 0.05 }); },
  // las puertas de piedra: un golpe sordo y la piedra que raspa
  puertaAbre: () => { _ruido({ dur: 0.45, vol: 0.16, f: 500, f2: 180, tipo: "bandpass", q: 2.5, eco: 0.35 }); _tono({ f: 70, f2: 45, dur: 0.35, tipo: "sine", vol: 0.3, cuando: 0.2 }); },
  puertaCierra: () => { _tono({ f: 85, f2: 38, dur: 0.3, tipo: "sine", vol: 0.42, eco: 0.4 }); _ruido({ dur: 0.22, vol: 0.24, f: 700, f2: 120, tipo: "lowpass", eco: 0.3 }); },
  // el objeto: un coro que canta un acorde mayor (las "voces raspadas" del disco, en luz)
  objeto: () => { [0, 4, 7, 12].forEach((s, i) => _voz({ f: midiF(64 + s), dur: 1.4, vol: 0.07, vocal: "a", cuando: i * 0.05, ataque: 0.12, ecoLargo: 0.6, eco: 0, aire: 0.08, cola: 0.8 })); _metal({ f: 1320, dur: 1.2, vol: 0.05, ecoLargo: 0.4 }); },
  malo: () => { [0, -4, -9].forEach((s, i) => _voz({ f: midiF(52 + s), dur: 0.7, vol: 0.09, vocal: "o", cuando: i * 0.14, ataque: 0.05, ecoLargo: 0.4, raspa: 0.2 })); },
  moneda: () => { _metal({ f: va(2200, 0.03), dur: 0.35, vol: 0.09 }); _metal({ f: va(2700, 0.03), dur: 0.45, vol: 0.07, cuando: 0.06 }); },
  corazon: () => { _ruido({ dur: 0.18, vol: 0.12, f: 400, f2: 1500, tipo: "bandpass", q: 3 }); _tono({ f: 280, f2: 520, dur: 0.16, tipo: "sine", vol: 0.12 }); _voz({ f: 520, dur: 0.25, vol: 0.05, vocal: "a", ecoLargo: 0.3, cuando: 0.05 }); },
  llave: () => { _metal({ f: 3100, dur: 0.18, vol: 0.07, parciales: [1, 2.4, 4.1] }); _metal({ f: 3600, dur: 0.25, vol: 0.06, cuando: 0.07, parciales: [1, 2.4, 4.1] }); },
  recoger: () => { _tono({ f: 420, f2: 880, dur: 0.09, tipo: "sine", vol: 0.12 }); _ruido({ dur: 0.04, vol: 0.05, f: 2400, tipo: "bandpass", q: 2 }); },
  // la mecha: siseo con chisporroteos
  mecha: () => { _ruido({ dur: 1.1, vol: 0.05, f: 4500, tipo: "highpass" }); for (let i = 0; i < 8; i++) _ruido({ dur: 0.015, vol: 0.06, f: 3000, tipo: "bandpass", q: 2, cuando: Math.random() * 1.0 }); },
  explosion: () => { _ruido({ dur: 1.3, vol: 0.55, f: 2600, f2: 70, tipo: "lowpass", eco: 0.5, ecoLargo: 0.3 }); _tono({ f: 75, f2: 28, dur: 0.9, tipo: "sine", vol: 0.55 }); for (let i = 0; i < 6; i++) _ruido({ dur: 0.05, vol: 0.08, f: 1500, tipo: "bandpass", cuando: 0.2 + Math.random() * 0.7 }); },
  roca: () => { for (let i = 0; i < 5; i++) _ruido({ dur: 0.08 + Math.random() * 0.1, vol: 0.14, f: va(900, 0.4), tipo: "bandpass", q: 2, cuando: i * 0.03 + Math.random() * 0.03 }); _tono({ f: 90, f2: 50, dur: 0.18, tipo: "sine", vol: 0.2 }); },
  moho: () => { _ruido({ dur: 0.12, vol: 0.12, f: va(800), f2: 300, tipo: "bandpass", q: 1.2 }); },
  // el jefe: un rugido de voz grave y raspada, con la sala grande
  jefe: () => { _voz({ f: 70, f2: 55, dur: 1.5, vol: 0.3, vocal: "a", raspa: 1, ecoLargo: 0.6, ataque: 0.08, aire: 0.4 }); _ruido({ dur: 1.3, vol: 0.14, f: 400, f2: 90, tipo: "lowpass", ecoLargo: 0.4 }); BAT.bombo(0, 0.5, EFX); },
  secreto: () => { [0, 7, 12, 16, 19].forEach((s, i) => { _voz({ f: midiF(67 + s), dur: 0.9, vol: 0.05, vocal: "o", cuando: i * 0.09, ataque: 0.06, ecoLargo: 0.6, eco: 0, aire: 0.05 }); _metal({ f: midiF(79 + s), dur: 0.8, vol: 0.03, cuando: i * 0.09, ecoLargo: 0.3 }); }); },
  clic: () => _ruido({ dur: 0.02, vol: 0.1, f: 2200, tipo: "bandpass", q: 3 }),
  escupe: () => { _ruido({ dur: 0.12, vol: 0.13, f: va(1500), f2: 500, tipo: "bandpass", q: 2.5 }); _tono({ f: va(300), f2: 150, dur: 0.06, tipo: "sine", vol: 0.06 }); },
  salto: () => _ruido({ dur: 0.2, vol: 0.1, f: 300, f2: 1400, tipo: "bandpass", q: 2 }),
  cae: () => { _tono({ f: 80, f2: 32, dur: 0.3, tipo: "sine", vol: 0.42 }); _ruido({ dur: 0.25, vol: 0.22, f: 500, f2: 90, tipo: "lowpass" }); },
  zumbido: () => _tono({ f: va(190, 0.06), dur: 0.14, tipo: "sawtooth", vol: 0.018, filtro: 650, q: 3, vib: 0.08 }),
  capsula: () => { _ruido({ dur: 0.1, vol: 0.06, f: 3500, tipo: "bandpass", q: 4 }); _tono({ f: 320, f2: 120, dur: 0.18, tipo: "sine", vol: 0.14, cuando: 0.08 }); },
  cargado: () => _metal({ f: 1760, dur: 0.6, vol: 0.07, ecoLargo: 0.3 }),
  activo: () => { _ruido({ dur: 0.4, vol: 0.12, f: 400, f2: 3000, tipo: "bandpass", q: 1.5, ecoLargo: 0.3 }); _metal({ f: 880, dur: 0.8, vol: 0.05, cuando: 0.2 }); },
  pacto: () => { [0, 1, 6].forEach((s, i) => _voz({ f: midiF(40 + s), dur: 2, vol: 0.1, vocal: "o", cuando: i * 0.06, ataque: 0.5, ecoLargo: 0.7, raspa: 0.4, cola: 1 })); },
  pozo: () => { _tono({ f: 500, f2: 60, dur: 1, tipo: "sine", vol: 0.14, ecoLargo: 0.5 }); _ruido({ dur: 1.2, vol: 0.1, f: 300, f2: 1200, tipo: "bandpass", q: 1, ataque: 0.4 }); },
  // el rayo: un rugido de sangre (ruido que baja + voz grave saturada)
  rayo: () => { _ruido({ dur: 0.75, vol: 0.3, f: 2600, f2: 260, tipo: "lowpass", eco: 0.4 }); _voz({ f: 62, f2: 50, dur: 0.7, vol: 0.2, vocal: "a", raspa: 1.2, eco: 0.2, ataque: 0.01, aire: 0.5 }); },
  laser: () => { _tono({ f: 1300, f2: 380, dur: 0.12, tipo: "sawtooth", vol: 0.05, filtro: 2800, q: 4 }); _ruido({ dur: 0.07, vol: 0.05, f: 5000, tipo: "highpass" }); },
  // el corazón negro que se rompe: un golpe grave y un coro oscuro (el Necronomicón)
  negro: () => { BAT.bombo(0, 0.5, EFX); [0, 1, 6].forEach((s, i) => _voz({ f: midiF(38 + s), dur: 1.2, vol: 0.12, vocal: "o", cuando: i * 0.03, ataque: 0.02, ecoLargo: 0.6, raspa: 0.8 })); _ruido({ dur: 0.8, vol: 0.2, f: 900, f2: 120, tipo: "lowpass", ecoLargo: 0.4 }); },
  santa: () => { _voz({ f: midiF(76), dur: 0.7, vol: 0.06, vocal: "a", ecoLargo: 0.6, ataque: 0.03 }); _metal({ f: 1568, dur: 0.9, vol: 0.05, ecoLargo: 0.4 }); },
};

// Los efectos también se hornean enteros (cada uno con sus capas y su sala), y los que suenan todo
// el tiempo tienen dos o tres versiones (cada una con su azar), así no suenan siempre idénticos.
const SFX_REAL = { ...SFX };
const SFX_LARGO = { explosion: 2.6, jefe: 3.2, pacto: 3.4, pozo: 2.4, objeto: 2.8, secreto: 2.6, negro: 2.6, malo: 2.0, rayo: 2.0, muere: 1.6, mecha: 1.4, activo: 2.0, corazon: 1.4, santa: 2.2, cargado: 1.6 };
const SFX_VARIAS = { lagrima: 3, chapoteo: 3, golpe: 3, moho: 2, escupe: 2, roca: 2, zumbido: 2, moneda: 2, dolor: 2 };
const BANCO_SFX = {};
function sfxBanco(k) {
  if (_grabando) return SFX_REAL[k]();
  if (!AC) return;
  let v = BANCO_SFX[k];
  if (!v) { sfxBancoSolo(k); v = BANCO_SFX[k]; }
  const listas = v.filter((e) => e.buf);
  if (listas.length) tocarBuf(listas[Math.floor(Math.random() * listas.length)], 0, 1, EFX, 0.96 + Math.random() * 0.08);
}
for (const k of Object.keys(SFX_REAL)) SFX[k] = () => sfxBanco(k);
/** Deja horneados todos los efectos de entrada (se piden al arrancar el audio, antes que la música). */
function prepararEfectos() { for (const k of Object.keys(SFX_REAL)) sfxBancoSolo(k); }
function sfxBancoSolo(k) {
  if (BANCO_SFX[k]) return;
  const v = BANCO_SFX[k] = [];
  // la primera versión, ya; las otras (para que no suenen idénticos), cuando haya tiempo
  for (let i = 0; i < (SFX_VARIAS[k] || 1); i++) { const e = { pendiente: true, usado: 0 }; v.push(e); (i ? COLA : COLA_YA).push({ e, segs: SFX_LARGO[k] || 1.2, sr: SR_EFECTOS, hacer: () => SFX_REAL[k]() }); }
  hornearCola();
}

// ── la música: por compases, con el reloj del audio. Cada pista tiene su capa tranquila y su
//    capa PESADA (como en el original): la pesada sube cuando hay muchos enemigos en la sala. ──
const ESCALAS = { menor: [0, 2, 3, 5, 7, 8, 10], frigio: [0, 1, 3, 5, 7, 8, 10], dorico: [0, 2, 3, 5, 7, 9, 10], armonica: [0, 2, 3, 5, 7, 8, 11] };
/** La nota de un grado de la escala (grados negativos o > 6 cambian de octava). */
function grado(raiz, esc, g) { const E = ESCALAS[esc], o = Math.floor(g / 7); return raiz + E[((g % 7) + 7) % 7] + o * 12; }
const acorde = (raiz, esc, g) => [grado(raiz, esc, g), grado(raiz, esc, g + 2), grado(raiz, esc, g + 4)];

const TEMAS = {
  // el título: un piano solo sobre un colchón, lento y triste
  menu: { bpm: 58, raiz: 45, esc: "menor", prog: [0, 5, 3, 4], compas(t, n, c) {
    const g = this.prog[n % 4], ac = acorde(this.raiz, this.esc, g), b = 60 / this.bpm;
    _colchon({ notas: ac.map((m) => m + 12), cuando: t, dur: b * 4.2, vol: 0.03, salida: c.calma, filtro: 700 });
    [0, 2, 1, 2, 0, 2, 1, 4].forEach((k, i) => { if (i % 2 === 0 || Math.random() < 0.7) _piano({ midi: grado(this.raiz + 24, this.esc, g + [0, 2, 4, 7, 9][k]), cuando: t + i * b / 2, vol: 0.07, salida: c.calma }); });
    _piano({ midi: ac[0] - 12, cuando: t, dur: b * 4, vol: 0.09, salida: c.calma });
  } },
  // el sótano: un canto fúnebre de cuerdas limpias; lo pesado: guitarras saturadas y batería
  sotano: { bpm: 72, raiz: 43, esc: "menor", prog: [0, 5, 3, 4, 0, 5, 6, 4], compas(t, n, c) {
    const g = this.prog[n % 8], ac = acorde(this.raiz, this.esc, g), b = 60 / this.bpm;
    _colchon({ notas: [ac[0], ac[2]], cuando: t, dur: b * 4.1, vol: 0.035, salida: c.calma, filtro: 600 });
    const arp = [0, 1, 2, 1, 3, 2, 1, 2];
    arp.forEach((k, i) => { const m = k === 3 ? ac[0] + 12 : ac[k] + 12; _cuerda({ midi: m, cuando: t + i * b / 2, dur: b * 1.6, vol: 0.11, salida: c.calma, brillo: 0.35, pan: (i % 2 ? 0.3 : -0.3) }); });
    _cuerda({ midi: ac[0] - 12, cuando: t, dur: b * 3.8, vol: 0.14, salida: c.calma, brillo: 0.2, filtro: 900 });
    if (Math.random() < 0.4) _tono({ f: 1800 + Math.random() * 1400, f2: 900, dur: 0.1, tipo: "sine", vol: 0.025, salida: c.calma, ecoLargo: 0.8, cuando: t + Math.random() * b * 4 });
    if (c.pesadaActiva) {
      for (let i = 0; i < 8; i++) { const m = ac[0] - 12; _cuerda({ midi: m, cuando: t + i * b / 2, dur: b * 0.45, vol: 0.09, salida: c.pesada, dist: 1, brillo: 0.7, pan: -0.5 }); _cuerda({ midi: m + 7, cuando: t + i * b / 2 + 0.008, dur: b * 0.45, vol: 0.07, salida: c.pesada, dist: 1, brillo: 0.7, pan: 0.5 }); }
      for (let i = 0; i < 4; i++) { if (i % 2 === 0) BAT.bombo(t + i * b, 0.4, c.pesada); else BAT.caja(t + i * b, 0.26, c.pesada); BAT.hihat(t + i * b + b / 2, 0.05, false, c.pesada); if (i === 3 && n % 2) BAT.bombo(t + i * b + b / 2, 0.3, c.pesada); }
      if (n % 4 === 0) BAT.platillo(t, 0.08, c.pesada);
    }
  } },
  // las raíces: frigio, más lento, un coro que murmura; lo pesado: tambores graves y guitarra
  raices: { bpm: 64, raiz: 41, esc: "frigio", prog: [0, 1, 0, 6, 0, 1, 3, 1], compas(t, n, c) {
    const g = this.prog[n % 8], ac = acorde(this.raiz, this.esc, g), b = 60 / this.bpm;
    _colchon({ notas: [ac[0], ac[1] + 12], cuando: t, dur: b * 4.1, vol: 0.03, salida: c.calma, filtro: 500 });
    if (n % 2 === 0) _voz({ f: midiF(ac[0] + 12), dur: b * 7.5, vol: 0.05, vocal: "u", cuando: t, salida: c.calma, ataque: 1.2, ecoLargo: 0.7, eco: 0, aire: 0.1, cola: 2 });
    [0, 2, 1, 0, 2, 1].forEach((k, i) => _cuerda({ midi: ac[k] + 12, cuando: t + i * b * 2 / 3, dur: b * 2, vol: 0.1, salida: c.calma, brillo: 0.3, pan: i % 2 ? 0.35 : -0.35 }));
    _cuerda({ midi: ac[0] - 12, cuando: t, dur: b * 3.8, vol: 0.15, salida: c.calma, brillo: 0.15, filtro: 700 });
    if (c.pesadaActiva) {
      BAT.tom(t, 90, 0.4, c.pesada); BAT.tom(t + b * 1.5, 80, 0.3, c.pesada); BAT.caja(t + b * 2, 0.24, c.pesada); BAT.tom(t + b * 3, 70, 0.35, c.pesada); BAT.bombo(t + b * 3.5, 0.3, c.pesada);
      _cuerda({ midi: ac[0] - 12, cuando: t, dur: b * 1.8, vol: 0.1, salida: c.pesada, dist: 1.2, brillo: 0.6 });
      _cuerda({ midi: ac[1] - 12, cuando: t + b * 2, dur: b * 1.8, vol: 0.09, salida: c.pesada, dist: 1.2, brillo: 0.6 });
    }
  } },
  // el jefe: sangre que bombea — batería siempre, riff saturado en semicorcheas y coro que corta
  jefe: { bpm: 148, raiz: 40, esc: "frigio", prog: [0, 0, 1, 0, 0, 0, 6, 5], compas(t, n, c) {
    const g = this.prog[n % 8], r = grado(this.raiz, this.esc, g), b = 60 / this.bpm;
    const riff = [0, 0, 12, 0, 0, 1, 0, 0, 12, 0, 3, 0, 0, 1, 0, 6];
    riff.forEach((s, i) => _cuerda({ midi: r + s, cuando: t + i * b / 4, dur: b * (s ? 0.4 : 0.22), vol: s ? 0.1 : 0.08, salida: c.calma, dist: 1.4, brillo: 0.8, pan: i % 2 ? 0.4 : -0.4 }));
    for (let i = 0; i < 8; i++) { if (i % 4 === 0 || i === 3 || i === 6) BAT.bombo(t + i * b / 2, 0.45, c.calma); if (i % 4 === 2) BAT.caja(t + i * b / 2, 0.3, c.calma); BAT.hihat(t + i * b / 2, 0.05, i === 7, c.calma); }
    if (n % 4 === 0) BAT.platillo(t, 0.1, c.calma);
    _tono({ f: midiF(r - 12), dur: b * 4, tipo: "sawtooth", vol: 0.07, filtro: 300, q: 2, salida: c.calma, cuando: t });
    if (n % 2 === 0) [0, 3, 7].forEach((s) => _voz({ f: midiF(r + 24 + s), dur: b * 1.6, vol: 0.05, vocal: "a", cuando: t, salida: c.calma, ataque: 0.05, ecoLargo: 0.5, eco: 0, raspa: 0.3 }));
  } },
  // después del jefe: la calma (colchón y un piano que se aleja)
  calma: { bpm: 50, raiz: 43, esc: "dorico", prog: [0, 3, 0, 4], compas(t, n, c) {
    const g = this.prog[n % 4], ac = acorde(this.raiz, this.esc, g), b = 60 / this.bpm;
    _colchon({ notas: ac.map((m) => m + 12), cuando: t, dur: b * 4.2, vol: 0.03, salida: c.calma, filtro: 800, ataque: 1.5 });
    [0, 1, 2].forEach((k, i) => _piano({ midi: ac[k] + 24, cuando: t + i * b * 1.3, vol: 0.05, salida: c.calma }));
  } },
  // el pacto: un órgano grave y un coro de voces raspadas, casi quieto
  pacto: { bpm: 46, raiz: 38, esc: "frigio", prog: [0, 1, 0, 6], compas(t, n, c) {
    const g = this.prog[n % 4], ac = acorde(this.raiz, this.esc, g), b = 60 / this.bpm;
    _colchon({ notas: [ac[0] - 12, ac[0], ac[1] + 12], cuando: t, dur: b * 4.2, vol: 0.04, salida: c.calma, filtro: 450, ataque: 1.5 });
    [0, 1, 2].forEach((k) => _voz({ f: midiF(ac[k] + 12), dur: b * 4, vol: 0.045, vocal: "o", cuando: t, salida: c.calma, ataque: 1.5, ecoLargo: 0.7, eco: 0, raspa: 0.35, cola: 1.5 }));
    if (n % 2 === 0) _metal({ f: midiF(ac[0] + 24), dur: 4, vol: 0.04, cuando: t, salida: c.calma, ecoLargo: 0.5, parciales: [1, 2.4, 3.9, 5.6] });
  } },
  // la tienda: una cajita de música medio desafinada sobre un bajo que camina
  tienda: { bpm: 96, raiz: 50, esc: "dorico", prog: [0, 3, 4, 0], compas(t, n, c) {
    const g = this.prog[n % 4], ac = acorde(this.raiz, this.esc, g), b = 60 / this.bpm;
    [0, 2, 1, 2, 0, 1, 2, 1].forEach((k, i) => _metal({ f: midiF(ac[k] + 12) * (1 + (Math.random() - 0.5) * 0.004), dur: 0.9, vol: 0.05, cuando: t + i * b / 2, salida: c.calma, eco: 0.3, parciales: [1, 3.01, 5.2] }));
    [0, 2, 4, 2].forEach((k, i) => _cuerda({ midi: grado(this.raiz - 12, this.esc, g + k), cuando: t + i * b, dur: b * 0.9, vol: 0.12, salida: c.calma, brillo: 0.2, filtro: 800 }));
  } },
  // la sala secreta: nada más que un colchón y gotas
  secreta: { bpm: 40, raiz: 47, esc: "menor", prog: [0, 5], compas(t, n, c) {
    const g = this.prog[n % 2], ac = acorde(this.raiz, this.esc, g), b = 60 / this.bpm;
    _colchon({ notas: ac, cuando: t, dur: b * 4.2, vol: 0.035, salida: c.calma, filtro: 1100, ataque: 2 });
    for (let i = 0; i < 3; i++) _metal({ f: midiF(ac[i] + 24), dur: 2, vol: 0.02, cuando: t + Math.random() * b * 4, salida: c.calma, ecoLargo: 0.8 });
  } },
  // la muerte: una frase de piano y silencio (como "Acceptance" del original: un tema propio)
  muerte: { bpm: 52, raiz: 45, esc: "menor", unaVez: 2, compas(t, n, c) {
    const b = 60 / this.bpm, frase = n === 0 ? [[7, 0], [5, 1], [3, 2], [2, 3]] : [[0, 0], [-1, 1.5], [0, 2.5]];
    for (const [k, i] of frase) _piano({ midi: grado(this.raiz + 12, this.esc, k), cuando: t + i * b, vol: 0.09, dur: 3.5, salida: c.calma });
    _piano({ midi: this.raiz - 12 + (n ? 0 : 5), cuando: t, vol: 0.1, dur: 5, salida: c.calma });
  } },
  silencio: null,
};

const Musica = {
  tema: "silencio", deseado: "menu", n: 0, prox: 0, capas: null, intensidad: 0,
  poner(n) { this.deseado = n; },
  /** Cuánta "pesadez" pide el juego (0 a 1): la capa pesada sube o baja despacio. */
  pesar(x) { this.intensidad = x; if (this.capas) this.capas.pesada.gain.setTargetAtTime(0.0001 + x, AC.currentTime, x > 0.5 ? 0.6 : 1.4); },
  arrancar() { this.prox = AC.currentTime + 0.1; setInterval(() => this.tic(), 70); },
  tic() {
    if (!AC) return;
    if (this.deseado !== this.tema) this.cambiar();
    const t = TEMAS[this.tema];
    if (!t || !this.capas) return;
    // antes de sonar, la pista se hornea (hasta 8 s de espera; lo que falte, se hornea sonando)
    if (this.juntadas && performance.now() - this.desdeCambio < 8000 && [...this.juntadas].some((e) => e.pendiente)) { this.prox = AC.currentTime + 0.1; return; }
    const largo = 4 * 60 / t.bpm;
    while (this.prox < AC.currentTime + 0.4) {
      if (t.unaVez && this.n >= t.unaVez) return;
      const c = this.capas;
      c.pesadaActiva = this.intensidad > 0.02 || c.pesada.gain.value > 0.02;
      t.compas(this.prox - AC.currentTime, this.n++, c);
      this.prox += largo;
    }
  },
  /** Junta (sin tocar) todas las notas que usa una pista en sus primeros compases, y las manda a hornear. */
  juntar(nombre, urgente) {
    const t = TEMAS[nombre];
    if (!t || !AC) return new Set();
    const set = new Set(), antes = _soloJuntar, desde = COLA_YA.length;
    _soloJuntar = set;
    const c = { calma: MUS, pesada: MUS, pesadaActiva: true };
    try { for (let n = 0; n < (t.unaVez || 8); n++) t.compas(0, n, c); } finally { _soloJuntar = antes; }
    if (!urgente) for (const tr of COLA_YA.splice(desde)) COLA.push(tr);   // lo de esta pista, al fondo
    return set;
  },
  cambiar() {
    // la pista vieja se apaga en un segundo (sus notas ya programadas se van con su capa)
    if (this.capas) { const v = this.capas; v.calma.gain.setTargetAtTime(0.0001, AC.currentTime, 0.35); v.pesada.gain.setTargetAtTime(0.0001, AC.currentTime, 0.35); setTimeout(() => { v.calma.disconnect(); v.pesada.disconnect(); }, 3000); }
    this.tema = this.deseado; this.n = 0; this.prox = AC.currentTime + 0.08;
    this.juntadas = this.juntar(this.tema, true); this.desdeCambio = performance.now();
    // y de paso, las que probablemente vengan después (el jefe y la calma), sin apuro
    if (this.tema === "sotano" || this.tema === "raices") { this.juntar("jefe", false); this.juntar("calma", false); }
    const calma = AC.createGain(), pesada = AC.createGain();
    calma.gain.value = 1; pesada.gain.value = 0.0001 + this.intensidad;
    calma.connect(MUS); pesada.connect(MUS);
    this.capas = { calma, pesada, pesadaActiva: false };
  },
};
function guardarVolumen() { try { localStorage.setItem("shumio-audio", JSON.stringify({ m: volMusica, e: volEfectos })); } catch (e) { /* nada */ } if (MUS) { MUS.gain.value = volMusica; EFX.gain.value = volEfectos; } }
