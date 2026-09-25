// El reproductor: arranca el audio, agenda la partitura y da la hora.
//
// POR QUÉ EL RELOJ ES EL DEL AUDIO. requestAnimationFrame late lo que tarda
// el cuadro; en un teléfono que baja a 40 cuadros, un reloj contado con rAF se
// corre milisegundos por segundo y a los treinta segundos el bloque ya no
// llega con el golpe. AudioContext.currentTime lo lleva el hardware. Acá rAF
// sólo dibuja; la hora se le pregunta al audio.
//
// Y POR QUÉ SE AGENDA CON ANTICIPO Y CON UN TEMPORIZADOR APARTE. Un sonido
// disparado en el cuadro en que toca llega tarde y desparejo. Se agenda todo
// lo que entra en los próximos 250 ms con su hora exacta. Y la agenda no
// depende sólo del cuadro: si el dibujo se traba medio segundo (un teléfono
// que recibe un mensaje), un setInterval de 25 ms sigue cargando la agenda y
// la música no se corta.

import { Sinte } from "./sinte.js";

const ANTICIPO = 0.25;

/** Ejecuta un evento de la partitura en el sintetizador. */
function ejecutar(sinte, voces, e, t) {
  if (e.f === "silaba") {
    const [cual, m, dur, silaba, v, fin] = e.a;
    const voz = voces[cual] || voces.voz;
    if (voz) sinte.silaba(voz, t, m, dur, silaba, v, fin);
    return;
  }
  const f = sinte[e.f];
  if (f) f.call(sinte, t, ...e.a);
}

/** Arma las voces de una canción en un sintetizador. */
function armarVoces(sinte, cancion) {
  const voces = {};
  for (const v of cancion.voces || [{ nombre: "voz" }]) voces[v.nombre] = sinte.crearVoz(v);
  return voces;
}

/** Para las pruebas: graba la canción en un OfflineAudioContext agendando
 *  de a una ventana, igual que en vivo. Agendarla ENTERA de una vez deja
 *  treinta mil nodos colgados del grafo desde el segundo cero, y el render
 *  tarda más de diez minutos por recorrerlos, aunque estén callados. */
export async function grabarFueraDeLinea(ctx, destino, cancion, hasta) {
  const sinte = new Sinte(ctx, destino);
  sinte.ponerTempo(cancion.bpm);
  const voces = armarVoces(sinte, cancion);
  const lista = cancion.audio.filter(e => e.t < hasta);
  let i = 0;
  const VENTANA = 0.5;
  const cargar = (tHasta) => {
    while (i < lista.length && lista[i].t < tHasta) { const e = lista[i++]; ejecutar(sinte, voces, e, e.t + 0.02); }
  };
  cargar(VENTANA * 2);
  for (let t = VENTANA; t < hasta; t += VENTANA) {
    ctx.suspend(t).then(() => { cargar(t + VENTANA * 2); ctx.resume(); });
  }
  return ctx.startRendering();
}

export class Reproductor {
  constructor() {
    this.ctx = null;
    this.t0 = 0;
    this.sonando = false;
    this.desfase = 0;          // calibración del usuario, en segundos
    this.volMusica = 0.9;
    this.volEfectos = 0.8;
    this._intervalo = null;
    this.bandas = new Float32Array(32);
  }

  /** En el primer toque: ningún navegador deja sonar antes. */
  despertar() {
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !this.pausado) this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    // iPhone con la tecla de silencio: el audio web va por el canal del
    // "timbre" y se calla. Pedir la sesión de reproducción (iOS 17+) lo pasa
    // al canal de la música, como un reproductor.
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* no hay */ }
    try { this.ctx = new AC({ latencyHint: "interactive" }); } catch (e) { return false; }
    const c = this.ctx;
    this.maestro = c.createGain(); this.maestro.gain.value = 1;
    this.analizador = c.createAnalyser(); this.analizador.fftSize = 512;
    this.analizador.smoothingTimeConstant = 0.6;
    this.maestro.connect(this.analizador); this.analizador.connect(c.destination);
    this.busMusica = c.createGain(); this.busMusica.gain.value = this.volMusica; this.busMusica.connect(this.maestro);
    this.busEfectos = c.createGain(); this.busEfectos.gain.value = this.volEfectos; this.busEfectos.connect(this.maestro);
    this._espectro = new Uint8Array(this.analizador.frequencyBinCount);
    this.efectos = new Sinte(c, this.busEfectos);
    return true;
  }

  latencia() {
    if (!this.ctx) return 0;
    return (this.ctx.outputLatency || 0) || (this.ctx.baseLatency || 0);
  }

  ponerVolumenes(musica, efectos) {
    this.volMusica = musica; this.volEfectos = efectos;
    if (this.busMusica) this.busMusica.gain.value = musica;
    if (this.busEfectos) this.busEfectos.gain.value = efectos;
  }

  /** Arranca una canción compuesta. `desde` en segundos de canción. */
  arrancar(cancion, desde = 0, espera = 0.35) {
    if (!this.despertar()) return false;
    this.parar();
    const c = this.ctx;
    this.pausado = false;
    if (c.state === "suspended") c.resume();
    this.cancion = cancion;
    this.bus = c.createGain(); this.bus.gain.value = 1; this.bus.connect(this.busMusica);
    this.sinte = new Sinte(c, this.bus);
    this.sinte.ponerTempo(cancion.bpm);
    this.voces = armarVoces(this.sinte, cancion);
    this.t0 = c.currentTime + espera - desde;
    this.i = 0;
    const lista = cancion.audio;
    while (this.i < lista.length && lista[this.i].t < desde - 0.02) this.i++;
    this.sonando = true;
    this.agendar();
    this._intervalo = setInterval(() => this.agendar(), 25);
    return true;
  }

  /** Arranca un audio del usuario (modo "tu canción"). */
  arrancarBuffer(buffer, desde = 0, espera = 0.35) {
    if (!this.despertar()) return false;
    this.parar();
    const c = this.ctx;
    this.pausado = false;
    if (c.state === "suspended") c.resume();
    this.cancion = null;
    this.bus = c.createGain(); this.bus.gain.value = 1; this.bus.connect(this.busMusica);
    const s = c.createBufferSource(); s.buffer = buffer; s.connect(this.bus);
    this.t0 = c.currentTime + espera - desde;
    s.start(c.currentTime + espera, Math.max(0, desde));
    this.fuente = s;
    this.sonando = true;
    return true;
  }

  agendar() {
    if (!this.sonando || !this.cancion || !this.ctx) return;
    const ahora = this.ctx.currentTime;
    const hasta = ahora + ANTICIPO - this.t0;
    const lista = this.cancion.audio;
    while (this.i < lista.length && lista[this.i].t <= hasta) {
      const e = lista[this.i++];
      const t = this.t0 + e.t;
      // Lo que ya pasó (una traba larga) no se toca tarde: se saltea. Un
      // golpe fuera de lugar suena peor que un golpe que falta.
      if (t < ahora - 0.03) continue;
      ejecutar(this.sinte, this.voces, e, Math.max(t, ahora));
    }
  }

  /** Segundos de canción, tal como se ESCUCHAN (descontada la latencia). */
  tiempo() {
    if (!this.ctx) return 0;
    return this.ctx.currentTime - this.t0 - this.latencia() - this.desfase;
  }

  pausar() {
    if (!this.ctx || this.pausado) return;
    this.pausado = true;
    this.ctx.suspend();
  }

  reanudar() {
    if (!this.ctx) return;
    this.pausado = false;
    this.ctx.resume();
  }

  parar(fundido = 0.06) {
    if (this._intervalo) { clearInterval(this._intervalo); this._intervalo = null; }
    this.sonando = false;
    if (!this.ctx) return;
    const c = this.ctx;
    const bus = this.bus, sinte = this.sinte, fuente = this.fuente;
    this.bus = null; this.sinte = null; this.fuente = null; this.cancion = null;
    if (bus) {
      bus.gain.setTargetAtTime(0, c.currentTime, fundido / 3);
      setTimeout(() => { try { bus.disconnect(); } catch (e) { /* ya */ } }, fundido * 1000 + 400);
    }
    if (sinte) sinte.soltarVoces(c.currentTime + fundido);
    if (fuente) { try { fuente.stop(c.currentTime + fundido + 0.05); } catch (e) { /* ya */ } }
  }

  /** 32 bandas del espectro (0..1), en escala logarítmica, para los LEDs. */
  espectro() {
    if (!this.analizador) return this.bandas;
    this.analizador.getByteFrequencyData(this._espectro);
    const n = this._espectro.length;
    for (let b = 0; b < 32; b++) {
      const a = Math.floor(Math.pow(n, b / 32)), z = Math.max(a + 1, Math.floor(Math.pow(n, (b + 1) / 32)));
      let m = 0;
      for (let i = a; i < z && i < n; i++) m = Math.max(m, this._espectro[i]);
      this.bandas[b] = Math.pow(m / 255, 1.6);
    }
    return this.bandas;
  }

  // ── efectos de juego (no son parte de la canción: no se cortan con ella) ──

  sonidoCorte(fuerza = 1, color = 0) {
    if (!this.ctx || this.pausado) return;
    const s = this.efectos, t = this.ctx.currentTime + 0.003;
    // Un "tsk" seco: un golpe de ruido agudo y un clic con cuerpo. El tono
    // cambia apenas en cada corte para que una ráfaga no suene a máquina.
    const f = 0.9 + Math.random() * 0.2;
    const hp = s._filtro("bandpass", (color ? 5200 : 4300) * f, 1.2);
    const g = s._gain(0); s._env(g, t, 0.001, 0.55 * fuerza, 0.07);
    hp.connect(g); g.connect(this.busEfectos);
    s._ruido(t, 0.09, hp);
    const o = this.ctx.createOscillator(); o.type = "triangle";
    o.frequency.setValueAtTime(1400 * f, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.04);
    const go = s._gain(0); s._env(go, t, 0.001, 0.35 * fuerza, 0.05);
    o.connect(go); go.connect(this.busEfectos); o.start(t); o.stop(t + 0.08);
  }

  sonidoMalCorte() {
    if (!this.ctx || this.pausado) return;
    const s = this.efectos, t = this.ctx.currentTime + 0.003;
    const o = this.ctx.createOscillator(); o.type = "square";
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.18);
    const lp = s._filtro("lowpass", 1200);
    const g = s._gain(0); s._env(g, t, 0.002, 0.25, 0.2);
    o.connect(lp); lp.connect(g); g.connect(this.busEfectos); o.start(t); o.stop(t + 0.25);
  }

  sonidoBomba() {
    if (!this.ctx || this.pausado) return;
    this.efectos.impacto(this.ctx.currentTime + 0.003, 0.9);
  }

  sonidoMenu(agudo = false) {
    if (!this.ctx) return;
    const s = this.efectos, t = this.ctx.currentTime + 0.003;
    const o = this.ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(agudo ? 1320 : 880, t);
    const g = s._gain(0); s._env(g, t, 0.002, 0.16, 0.09);
    o.connect(g); g.connect(this.busEfectos); o.start(t); o.stop(t + 0.12);
  }
}
