'use strict';
// Sonido con WebAudio. La música de cada nivel se decodifica entera (no un <audio>) porque su
// reloj es el que manda: el juego corre al ritmo de la canción, como en el original, y con un
// <audio> la posición llega a saltos. El contexto arranca suspendido hasta el primer toque: los
// navegadores no dejan sonar nada antes.

GD.Audio = class {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    try { this.ctx = AC ? new AC({ latencyHint: 'interactive' }) : null; } catch (_) { this.ctx = null; }
    this.buffers = new Map();       // nombre → AudioBuffer
    this.pedidos = new Map();       // nombre → Promise<AudioBuffer> (para no decodificar dos veces)
    this.actual = null;             // { nombre, fuente, ganancia, inicio, bucle }
    this.pausada = null;            // { nombre, pos, bucle } mientras está en pausa
    this.musicaSi = true;
    this.efectosSi = true;
    if (this.ctx) {
      this.salidaEfectos = this.ctx.createGain();
      this.salidaEfectos.connect(this.ctx.destination);
    }
  }

  get anda() { return !!this.ctx && this.ctx.state === 'running'; }

  // Dentro de un gesto del usuario (toque o tecla).
  desbloquear() {
    if (this.ctx && this.ctx.state !== 'running' && !document.hidden) this.ctx.resume().catch(() => {});
  }

  suspender() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }

  // traer: () => Promise<ArrayBuffer>. Devuelve el AudioBuffer (o null sin audio).
  cargar(nombre, traer) {
    if (!this.ctx) return Promise.resolve(null);
    if (this.buffers.has(nombre)) return Promise.resolve(this.buffers.get(nombre));
    if (!this.pedidos.has(nombre)) {
      const p = traer()
        .then((ab) => new Promise((ok, mal) => this.ctx.decodeAudioData(ab, ok, mal)))
        .then((b) => { this.buffers.set(nombre, b); this.pedidos.delete(nombre); return b; })
        .catch((e) => { this.pedidos.delete(nombre); throw e; });
      this.pedidos.set(nombre, p);
    }
    return this.pedidos.get(nombre);
  }

  listo(nombre) { return this.buffers.has(nombre); }

  // Suelta las canciones de nivel que no hacen falta (decodificada, una canción ocupa ~30 MB).
  olvidar(salvo) {
    for (const n of [...this.buffers.keys()]) if (!salvo.includes(n)) this.buffers.delete(n);
  }

  // Desde cuánto atrás viene lo que se escucha: lo que tarda en salir por el parlante.
  get demora() { return this.ctx ? (this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0) : 0; }

  // Música: arranca en `desde` segundos de la canción. Con `bucle`, la del menú y la de práctica.
  musica(nombre, desde = 0, bucle = false) {
    this.pararMusica();
    this.pausada = null;
    const b = this.buffers.get(nombre);
    if (!this.ctx || !b) return false;
    let d = Math.max(0, desde);
    if (bucle) d %= b.duration;
    else if (d >= b.duration) return false;
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = b;
    fuente.loop = bucle;
    const ganancia = this.ctx.createGain();
    ganancia.gain.value = this.musicaSi ? 1 : 0;
    fuente.connect(ganancia);
    ganancia.connect(this.ctx.destination);
    fuente.start(0, d);
    this.actual = { nombre, fuente, ganancia, inicio: this.ctx.currentTime - d, bucle, duracion: b.duration };
    return true;
  }

  sonando(nombre) { return !!this.actual && (!nombre || this.actual.nombre === nombre); }

  // Segundo de la canción que se está escuchando ahora (null si no suena nada).
  posicion() {
    const a = this.actual;
    if (!a || !this.anda) return null;
    let p = this.ctx.currentTime - a.inicio - this.demora;
    if (a.bucle) p %= a.duracion;
    return p;
  }

  pararMusica(fundido = 0) {
    const a = this.actual;
    if (!a) return;
    this.actual = null;
    try {
      if (fundido > 0 && this.anda) {
        const t = this.ctx.currentTime;
        a.ganancia.gain.setValueAtTime(a.ganancia.gain.value, t);
        a.ganancia.gain.linearRampToValueAtTime(0, t + fundido);
        a.fuente.stop(t + fundido);
      } else a.fuente.stop();
    } catch (_) { /* ya estaba parada */ }
  }

  pausar() {
    const a = this.actual;
    if (!a) return;
    this.pausada = { nombre: a.nombre, pos: this.ctx.currentTime - a.inicio, bucle: a.bucle };
    this.pararMusica();
  }

  seguir() {
    const p = this.pausada;
    this.pausada = null;
    if (p) this.musica(p.nombre, p.pos, p.bucle);
  }

  ponerMusica(si) {
    this.musicaSi = si;
    if (this.actual) this.actual.ganancia.gain.value = si ? 1 : 0;
  }

  efecto(nombre, vol = 1) {
    const b = this.buffers.get(nombre);
    if (!b || !this.anda || !this.efectosSi) return;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(g);
    g.connect(this.salidaEfectos);
    s.start();
  }
};
