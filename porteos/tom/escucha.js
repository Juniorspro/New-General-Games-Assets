// Escuchar y repetir: Outfit7.TalkBack (MicrophoneHandler, RecordingBuffer, ProcessedSound,
// TalkBackHandler) portado del juego. El micrófono va en bloques de 0,1 s: con el ruido del ambiente
// arma una "barrera" (promedio de los máximos de los últimos 5 bloques); empieza a grabar cuando un
// bloque la pasa con ganas y corta tras 5 bloques seguidos de silencio (o 15 s). La voz de Tom sale
// de voz.js (en vez del ZtxPlugin nativo) y la boca, de un histograma del volumen 15 veces por segundo.
//
//   const e = new Escucha(sonido, { cansado: () => necesidades.mustSleep });
//   await e.pedirMicrofono();          // en un toque (el navegador lo pide)
//   ctl.conectarEscucha(e);            // el controlador llama tryStartListening/stopListening/update

import { vozTom } from './voz.js';

// TomTalkBackSettings (escena level1)
export const AJUSTES = {
  TempoValueNormal: 0.85, TempoValueTired: 1.25, Pitch: 1.65, Rate: 1,
  MaxRecordingTime: 15, TalkFramesPerSecond: 15, MinTalkFrameVolume: 0.01,
  ListenSilenceStartFactor: 1.3, ListenSilenceEndFactor: 1.2, ListenAverageFramesCount: 5,
  ListenStartRecordingFactor: 0.0015259254723787308, ListenStopMaxSilenceChunks: 5,
  ListenNormalizationFactor: 0.7629627585411072, ListenNoiseLimit: 0.027466658502817154,
  ListenSilenceEnviromentAbsDeltaStart: 0.06103701889514923, ListenSilenceEnviromentAbsDeltaEnd: 0.030518509447574615,
  TalkFrameBins: 32, MicrophoneRecordingStartDelay: 0.1, ListenEndCutoff: 0, ListenEndFadeout: 0,
};

const IDLE = 0, SILENCE_BARRIER = 2, ANALYSING = 3, RECORDING = 4;

// redondeo de .NET (al par)
function redondear(x) {
  const r = Math.round(x);
  return Math.abs(x - Math.trunc(x)) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

// RecordingBuffer.AnalyseFrames: cuánto abre la boca en cada tramo de sr/15 muestras
export function cuadrosDeBoca(x, sr, a = AJUSTES) {
  const lote = Math.trunc(sr / a.TalkFramesPerSecond), nb = a.TalkFrameBins, ruido = a.ListenNoiseLimit;
  const out = [], cajas = new Int32Array(nb);
  for (let i = 0; i < x.length; i += lote) {
    const n = Math.min(lote, x.length - i);
    cajas.fill(0);
    for (let k = 0; k < n; k++) {
      let b = redondear(Math.abs(x[i + k]) / (1 / nb));
      if (b < 0 || b >= nb) b = nb - 1;
      cajas[b]++;
    }
    let v = 0;
    for (let k = 0; k < nb; k++) if (cajas[k] > Math.trunc(n / 50)) v = k;
    v /= nb;
    let f = 0;
    if (ruido <= v) {
      v = (v - ruido) / (1 - ruido);
      f = v <= 0.8 ? v / 0.8 : 0.8;          // (sic: arriba de 0,8 queda en 0,8)
    }
    out.push(Math.pow(f, 1.5));
  }
  return Float32Array.from(out);
}

export class Escucha {
  constructor(sonido, { cansado = () => false, ajustes = AJUSTES } = {}) {
    this.sonido = sonido;
    this.a = ajustes;
    this.cansado = cansado;
    this.disponible = false;            // micrófono con permiso
    this.estado = IDLE;                 // MicrophoneHandler.microphoneState
    this.cola = [];                     // lo que llegó del micrófono
    this.listening = false;
    this.canTalk = false;
    this.playing = false;               // Talking
    this.procesado = null;              // ProcessedSound
    this.fuente = null;
    this.callbackRecordingStarted = null;
    this.callbackRecordingStopped = null;
    this.callbackTalk = null;
    this.callbackTalkingStopped = null;
    this.reloj = 0;
  }

  get talking() { return this.playing; }

  async pedirMicrofono() {
    if (this.disponible || this.pidiendo) return this.disponible;
    this.pidiendo = true;
    try {
      const ctx = this.sonido.contexto();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      });
      const src = ctx.createMediaStreamSource(this.stream);
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      proc.onaudioprocess = (ev) => {
        if (this.estado >= SILENCE_BARRIER && this.estado <= RECORDING) this.cola.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
      };
      const mudo = ctx.createGain();
      mudo.gain.value = 0;
      src.connect(proc); proc.connect(mudo); mudo.connect(ctx.destination);
      this.sr = ctx.sampleRate;
      this.iniciarBuffer();
      this.disponible = true;
    } catch (e) {
      console.warn('micrófono', e.message || e);
      this.disponible = false;
    }
    this.pidiendo = false;
    return this.disponible;
  }

  // RecordingBuffer(…): tamaños en muestras
  iniciarBuffer() {
    const sr = this.sr, a = this.a;
    this.maxMuestras = a.MaxRecordingTime * sr;
    this.muestras = new Float32Array(this.maxMuestras);
    this.minSilencio = redondear(a.MicrophoneRecordingStartDelay * sr);
    this.ultimosMax = new Float32Array(a.ListenAverageFramesCount);
    this.nUltimos = 0;
    this.promedio = 0;
    this.silencios = [];
  }
  initSamplesBuffer() { this.capturadas = 0; this.promedio = 0; this.silencios = []; this.nUltimos = 0; }

  // ---- TalkBackHandler / MicrophoneHandler
  tryStartListening() {
    if (!this.disponible || this.estado !== IDLE) return;
    // AcquireMicrophone: ya está abierto
    this.initSamplesBuffer();
    this.inicioGrabacion = this.reloj;
    this.cola = [];
    this.estado = SILENCE_BARRIER;
    this.canTalk = false;
  }
  stopListening() {
    this.listening = false;
    if (this.estado !== IDLE) { this.estado = IDLE; this.cola = []; }
  }
  stopRepeating(interrupted) {
    if (this.fuente) { try { this.fuente.stop(); } catch (x) { /* ya paró */ } this.fuente = null; }
    this.canTalk = false;
    if (this.playing) {
      this.playing = false;
      if (this.callbackTalkingStopped) this.callbackTalkingStopped(interrupted);
    }
  }

  // AddSamplesToRecordingBuffer: lo que llegó (después de los primeros 0,1 s)
  agregar() {
    if (this.reloj < this.inicioGrabacion + this.a.MicrophoneRecordingStartDelay) { this.cola = []; return -1; }
    if (!this.cola.length) return -1;
    let total = 0;
    for (const d of this.cola) {
      let n = d.length;
      if (this.capturadas + n >= this.maxMuestras) n = this.maxMuestras - this.capturadas - 1;
      if (n < 1) { this.cola = []; return n; }
      this.muestras.set(d.subarray(0, n), this.capturadas);
      this.capturadas += n;
      total += n;
    }
    this.cola = [];
    return total;
  }

  maximoBloque(desde) {
    let m = 0;
    for (let i = desde; i < desde + this.minSilencio; i++) { const v = Math.abs(this.muestras[i]); if (v > m) m = v; }
    return Math.min(m, 1);
  }
  // AddNewSilenceFrameMax + CalcNewSilenceAvg
  nuevoMaximo(v) {
    const n = this.ultimosMax.length;
    this.nUltimos = Math.min(this.nUltimos + 1, n);
    this.ultimosMax.copyWithin(0, 1);
    this.ultimosMax[n - 1] = v;
    let s = 0;
    for (let i = 0; i < this.nUltimos; i++) s += this.ultimosMax[i];
    this.promedio = s / this.nUltimos;
  }
  shouldStartRecording() {
    const a = this.a, p = this.promedio;
    const umbral = Math.max(p * a.ListenSilenceStartFactor, p + a.ListenSilenceEnviromentAbsDeltaStart);
    let suma = 0, n = 0;
    for (let i = 0; i < this.minSilencio; i++) { const v = Math.abs(this.muestras[i]); suma += v; if (umbral < v) n++; }
    return a.ListenStartRecordingFactor * this.minSilencio <= suma && n > 20;
  }
  isSilence(desde) {
    const a = this.a, p = this.promedio;
    const umbral = Math.max(p * a.ListenSilenceEndFactor, p + a.ListenSilenceEnviromentAbsDeltaEnd);
    let n = 0;
    for (let i = desde; i < desde + this.minSilencio; i++) if (umbral < Math.abs(this.muestras[i])) n++;
    return n < 20;
  }
  shouldStopRecording() {
    while (this.minSilencio * (this.silencios.length + 1) < this.capturadas) {
      this.silencios.push(this.isSilence(this.minSilencio * this.silencios.length));
    }
    let seguidos = 0;
    for (let i = this.silencios.length - 1; i > 0 && this.silencios[i]; i--) seguidos++;
    return this.a.ListenStopMaxSilenceChunks <= seguidos;
  }

  // MicrophoneHandler.Update + TalkBackHandler.Update
  update(dt) {
    this.reloj += dt;
    if (this.estado === SILENCE_BARRIER) {
      this.agregar();
      if (this.capturadas > this.minSilencio) {
        this.nuevoMaximo(this.maximoBloque(0));
        this.capturadas = 0;
        this.estado = ANALYSING;
      }
    } else if (this.estado === ANALYSING) {
      this.agregar();
      if (this.capturadas > this.minSilencio) {
        if (this.shouldStartRecording()) {
          this.estado = RECORDING;
          this.listening = true;
          if (this.callbackRecordingStarted) this.callbackRecordingStarted();
        } else {
          this.nuevoMaximo(this.maximoBloque(0));
          this.capturadas = 0;
        }
      }
    } else if (this.estado === RECORDING) {
      const n = this.agregar();
      if (n >= 0 && (n === 0 || this.shouldStopRecording())) {
        this.estado = IDLE;
        this.procesar();
      }
    }
    if (this.playing) {
      const ctx = this.sonido.contexto(), p = this.procesado;
      const t = ctx.currentTime - this.inicioVoz;
      if (t < p.buffer.duration) { if (this.callbackTalk) this.callbackTalk(this.cuadro(t * p.sr)); }
      else {
        this.playing = false;
        this.fuente = null;
        if (this.callbackTalkingStopped) this.callbackTalkingStopped(false);
      }
    }
  }

  // RecordingBuffer.ProcessSamples + OnConvertingDone
  procesar() {
    const a = this.a, sr = this.sr;
    const grabado = this.muestras.slice(0, this.capturadas);
    const tempo = this.cansado() ? a.TempoValueTired : a.TempoValueNormal;
    const y = vozTom(grabado, sr, { pitch: a.Pitch, tempo, rate: a.Rate });
    const cuadros = cuadrosDeBoca(y, sr, a);
    const lim = a.ListenNormalizationFactor;
    for (let i = 0; i < y.length; i++) y[i] = Math.max(-lim, Math.min(lim, y[i]));
    const ctx = this.sonido.contexto();
    const buffer = ctx.createBuffer(1, Math.max(1, y.length), sr);
    buffer.copyToChannel(y, 0);
    this.procesado = { buffer, sr, cuadros };
    this.listening = false;
    this.canTalk = true;
    if (this.callbackRecordingStopped) this.callbackRecordingStopped(buffer.duration);
  }

  // ProcessedSound.TalkFrame
  cuadro(muestra) {
    const p = this.procesado, por = Math.trunc(p.sr / this.a.TalkFramesPerSecond);
    let i = redondear(muestra / por);
    if (i >= p.cuadros.length) i = p.cuadros.length - 1;
    return p.cuadros[Math.max(0, i)] || 0;
  }

  // TalkBackHandler.StartTalking
  startTalking() {
    if (!this.canTalk) return;
    this.canTalk = false;
    this.listening = false;
    if (this.fuente) { try { this.fuente.stop(); } catch (x) { /* ya paró */ } }
    const ctx = this.sonido.contexto();
    const f = ctx.createBufferSource();
    f.buffer = this.procesado.buffer;
    f.connect(this.sonido.salida);
    f.start();
    this.fuente = f;
    this.inicioVoz = ctx.currentTime;
    this.playing = true;
    if (this.callbackTalk) this.callbackTalk(this.cuadro(0));
  }
}
