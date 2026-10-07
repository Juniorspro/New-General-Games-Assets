/* AudioSource de Unity con WebAudio: Play/Stop/Pause/UnPause, PlayOneShot (Stop también los corta e
   isPlaying los cuenta, como en Unity), volumen, tono y bucle en vivo, y el 3D a mano cada cuadro:
   caída logarítmica (min/d) o lineal hasta "max", mezclada con spatialBlend, y paneo izquierda/derecha
   según el AudioListener (la cámara). */
import { Componente, v3, Time } from './motor.js';
import { FABRICAS } from './mundo.js';
import { url } from './archivos.js';

export class Sonido {
  constructor(base) { this.base = base; this.ctx = null; this.buf = {}; this.fuentes = new Set(); this.listener = null; this.volumen = 1; }
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volumen; this.master.connect(this.ctx.destination);
  }
  async cargar(ids) {
    if (!this.ctx) return;
    await Promise.all(ids.map(async (id) => {
      if (this.buf[id] !== undefined) return;
      this.buf[id] = null;
      try { const r = await fetch(url(this.base + 'datos/' + id + '.ogg')); this.buf[id] = await this.ctx.decodeAudioData(await r.arrayBuffer()); }
      catch (e) { console.warn('audio', id, e?.message); }
    }));
  }
  nuevoComp(c) { if (c instanceof AudioSource) c.S = this; }
  trasLateUpdate() {
    if (!this.ctx) return;
    const L = this.listener && this.listener.nodo._activoH && !this.listener.nodo.destruido ? this.listener.nodo : null;
    const lp = L ? L.position : v3(), der = L ? L.right : v3(1, 0, 0);
    for (const f of this.fuentes) f._espacial(lp, der, !!L);
  }
  pararTodo() { for (const f of [...this.fuentes]) f._cortar(); }
}

export class AudioListener extends Componente {
  static get tipos() { return ['AudioListener']; }
  _prender() { if (this.S) this.S.listener = this; }
}

export class AudioSource extends Componente {
  static get tipos() { return ['AudioSource']; }
  constructor(n, d, mundo) {
    super(n, d);
    this.clip = d.clip ? mundo.recursos.clip(d.clip) : null;
    this._vol = d.vol ?? 1; this._tono = d.tono ?? 1; this.loop = !!d.loop; this.mute = !!d.mute; this.playOnAwake = !!d.auto;
    this.minDistance = d.min ?? 1; this.maxDistance = d.max ?? 500; this.rolloffMode = d.caida ?? 0; this.spatialBlend = d.esp ?? 0;
    this.voces = []; this._pausa = false; this._t0 = 0;
  }
  get volume() { return this._vol; }
  set volume(v) { this._vol = v; for (const x of this.voces) x.g.gain.value = this.mute ? 0 : v * x.esc * this._atenuar; }
  get pitch() { return this._tono; }
  set pitch(v) { this._tono = v; for (const x of this.voces) if (x.src.playbackRate) x.src.playbackRate.value = Math.max(0.01, Math.min(16, Math.abs(v))); }
  get isPlaying() { return this.voces.length > 0 && !this._pausa; }
  get time() { const v = this.voces.find((x) => !x.una); return v && this.S?.ctx ? (this.S.ctx.currentTime - v.t0) * this._tono : 0; }
  _prender() { this._atenuar = 1; if (this.playOnAwake && this.clip) this.Play(); }
  _apagar() { this._cortar(); }
  _voz(clip, esc, una) {
    const S = this.S; if (!S?.ctx || !clip) return null;
    const b = S.buf[clip.id]; if (!b) return null;
    const c = S.ctx, src = c.createBufferSource();
    src.buffer = b; src.loop = !una && this.loop; src.playbackRate.value = Math.max(0.01, Math.min(16, Math.abs(this._tono)));
    const g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : null;
    this._atenuar ??= 1;
    g.gain.value = this.mute ? 0 : this._vol * esc * this._atenuar;
    if (p) src.connect(g).connect(p).connect(S.master); else src.connect(g).connect(S.master);
    const v = { src, g, p, esc, una, t0: c.currentTime };
    src.onended = () => { const i = this.voces.indexOf(v); if (i >= 0) this.voces.splice(i, 1); if (!this.voces.length) S.fuentes.delete(this); };
    src.start();
    this.voces.push(v); S.fuentes.add(this);
    this._espacialUna(v);
    return v;
  }
  Play() {
    if (!this.isActiveAndEnabled) return;
    for (const v of this.voces.filter((x) => !x.una)) this._parar(v);
    this._pausa = false;
    this._voz(this.clip, 1, false);
  }
  PlayOneShot(clip, esc = 1) { if (!this.isActiveAndEnabled) return; this._voz(clip, esc, true); }
  Stop() { this._cortar(); }
  _parar(v) { try { v.src.onended = null; v.src.stop(); } catch { /* ya terminó */ } const i = this.voces.indexOf(v); if (i >= 0) this.voces.splice(i, 1); if (!this.voces.length) this.S?.fuentes.delete(this); }
  _cortar() { for (const v of [...this.voces]) this._parar(v); this._pausa = false; }
  Pause() { if (this._pausa || !this.voces.length) return; this._pausa = true; for (const v of this.voces) v.src.playbackRate.value = 1e-4, v.g.gain.value = 0; }
  UnPause() { if (!this._pausa) return; this._pausa = false; for (const v of this.voces) { v.src.playbackRate.value = Math.max(0.01, Math.abs(this._tono)); } this._espacial(); }
  _espacialUna(v) { if (this.S) this._espacial(this.S.listener?.nodo?.position, this.S.listener?.nodo?.right, !!this.S.listener, [v]); }
  _espacial(lp, der, hay, voces = this.voces) {
    let at = 1, pan = 0;
    if (this.spatialBlend > 0 && hay && lp) {
      const p = this.nodo.position, d = Math.max(1e-3, p.distanceTo(lp));
      const min = Math.max(1e-3, this.minDistance), max = Math.max(min, this.maxDistance);
      let a;
      if (this.rolloffMode === 1) a = d <= min ? 1 : d >= max ? 0 : 1 - (d - min) / (max - min);
      else a = d <= min ? 1 : min / Math.min(d, max);
      at = 1 - this.spatialBlend + this.spatialBlend * a;
      const dir = p.clone().sub(lp).normalize();
      pan = Math.max(-1, Math.min(1, dir.dot(der))) * this.spatialBlend * 0.8;
    }
    this._atenuar = at;
    for (const v of voces) {
      v.g.gain.value = this.mute || this._pausa ? 0 : this._vol * v.esc * at;
      if (v.p) v.p.pan.value = pan;
    }
  }
}

FABRICAS.audios = (n, lista, mundo) => lista.map((d) => new AudioSource(n, d, mundo));
FABRICAS.otros = (n, lista) => (lista.includes('AudioListener') ? [new AudioListener(n, {})] : []);
// (Time se usa para que los que pausa el juego no sigan en silencio de más)
void Time;
