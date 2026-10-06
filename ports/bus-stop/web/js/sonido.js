/* Los sonidos del original (grillos, la música del colectivo, las teles, el grito de los
   KutteFucker) en 3D con WebAudio, con la caída de cada AudioSource de Unity:
   logarítmica (1/d desde "min") o la curva a mano, que acá es lineal de "min" a "max".
   Y tres efectos hechos en código: juntar una malla, morir y el glitch del menú. */
import { D } from './guardado.js';

export class Sonido {
  constructor() { this.ctx = null; this.buf = {}; this.fuentes = []; }
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.volumen(D.ajustes.volumen);
  }
  volumen(v) { if (this.master) this.master.gain.value = v; }
  async cargar(base, ids) {
    if (!this.ctx) return;
    await Promise.all(ids.map(async (id) => {
      if (this.buf[id]) return;
      try { const r = await fetch(base + 'datos/' + id + '.ogg'); this.buf[id] = await this.ctx.decodeAudioData(await r.arrayBuffer()); }
      catch (e) { console.warn('audio', id, e); }
    }));
  }
  /* una AudioSource de Unity pegada a un objeto (obj = null: 2D) */
  fuente(id, a, obj) {
    if (!this.ctx || !this.buf[id]) return null;
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.buf[id]; src.loop = !!a.loop;
    const g = c.createGain(); g.gain.value = a.mute ? 0 : a.vol;
    let pan = null;
    if (obj) {
      pan = c.createPanner();
      pan.panningModel = 'equalpower';
      if (a.caida === 0) { pan.distanceModel = 'inverse'; pan.refDistance = Math.max(0.5, a.min); pan.maxDistance = 10000; pan.rolloffFactor = 1; }
      else { pan.distanceModel = 'linear'; pan.refDistance = a.min; pan.maxDistance = a.max; pan.rolloffFactor = 1; }
      src.connect(g).connect(pan).connect(this.master);
    } else src.connect(g).connect(this.master);
    src.start(0, a.loop ? Math.random() * src.buffer.duration * 0.5 : 0);
    const f = { src, g, pan, obj, vol: a.vol, mute: !!a.mute,
      silencio: (m) => { f.mute = m; g.gain.setTargetAtTime(m ? 0 : f.vol, c.currentTime, 0.02); },
      parar: () => { try { src.stop(); } catch { /* ya parada */ } f.parada = true; } };
    this.fuentes.push(f);
    return f;
  }
  pararTodo() { for (const f of this.fuentes) f.parar(); this.fuentes = []; }
  pausar(p) { if (!this.ctx) return; if (p) this.ctx.suspend(); else this.ctx.resume(); }
  actualizar(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.getWorldPosition(this._p || (this._p = cam.position.clone()));
    const f = cam.getWorldDirection(this._f || (this._f = p.clone()));
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    for (const s of this.fuentes) {
      if (!s.pan || s.parada) continue;
      const o = s.obj.getWorldPosition(this._o || (this._o = p.clone()));
      if (s.pan.positionX) { s.pan.positionX.value = o.x; s.pan.positionY.value = o.y; s.pan.positionZ.value = o.z; } else s.pan.setPosition(o.x, o.y, o.z);
    }
  }
  /* efectos */
  _ruido(dur) {
    const c = this.ctx, b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  juntar() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    for (let k = 0; k < 6; k++) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = k % 2 ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(220 * Math.pow(2, [0, 7, 3, 12, 10, 19][k] / 12), t + k * 0.045);
      g.gain.setValueAtTime(0, t); g.gain.setValueAtTime(0.09, t + k * 0.045); g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.045 + 0.12);
      o.connect(g).connect(this.master); o.start(t + k * 0.045); o.stop(t + k * 0.045 + 0.14);
    }
    this.glitch(0.12, 0.08);
  }
  glitch(dur = 0.4, vol = 0.25) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = this._ruido(dur); f.type = 'bandpass'; f.Q.value = 6;
    for (let k = 0; k < 8; k++) f.frequency.setValueAtTime(300 + Math.random() * 4000, t + k * dur / 8);
    g.gain.setValueAtTime(vol, t); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t);
  }
  muerte() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.9);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 1);
    this.glitch(0.9, 0.35);
  }
}
