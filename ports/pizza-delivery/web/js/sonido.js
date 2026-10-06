/* Los AudioSource de Unity con WebAudio: cada Play() arranca el clip de cero; en 3D con la caída
   logarítmica (1/d desde "min") o lineal (la curva a mano); los que cuelgan del jugador o de la
   cámara suenan en 2D. */
import { D } from './guardado.js';

export class Sonido {
  constructor() { this.ctx = null; this.buf = {}; this.vivos = new Set(); }
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.volumen(D.ajustes.volumen);
  }
  volumen(v) { if (this.master) this.master.gain.value = v; }
  async cargar(base, ids) {
    if (!this.ctx) return;
    await Promise.all(ids.map(async (id) => {
      if (this.buf[id] !== undefined) return;
      this.buf[id] = null;
      try { const r = await fetch(base + 'datos/' + id + '.ogg'); this.buf[id] = await this.ctx.decodeAudioData(await r.arrayBuffer()); }
      catch (e) { console.warn('audio', id, e?.message); }
    }));
  }
  reproducir(clip, def, obj, es2D) {
    const h = { tocando: false, parar() {}, loop() {} };
    if (!this.ctx || !clip || !this.buf[clip]) return h;
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.buf[clip]; src.loop = !!def.loop; src.playbackRate.value = def.tono || 1;
    const g = c.createGain(); g.gain.value = def.mute ? 0 : def.vol;
    let pan = null;
    if (!es2D && obj) {
      pan = c.createPanner(); pan.panningModel = 'equalpower';
      if (def.caida === 1) { pan.distanceModel = 'linear'; pan.refDistance = def.min; pan.maxDistance = Math.max(def.min + 0.1, def.max); }
      else { pan.distanceModel = 'inverse'; pan.refDistance = Math.max(0.3, def.min); pan.maxDistance = 10000; pan.rolloffFactor = 1; }
      src.connect(g).connect(pan).connect(this.master);
    } else src.connect(g).connect(this.master);
    src.start();
    Object.assign(h, { tocando: true, src, pan, obj, parar: () => { try { src.stop(); } catch { /* */ } h.tocando = false; this.vivos.delete(h); }, loop: (v) => { src.loop = v; } });
    src.onended = () => { h.tocando = false; this.vivos.delete(h); };
    this.vivos.add(h);
    return h;
  }
  pararTodo() { for (const h of [...this.vivos]) h.parar(); }
  pausar(p) { if (!this.ctx) return; if (p) this.ctx.suspend(); else this.ctx.resume(); }
  actualizar(cam) {
    if (!this.ctx) return;
    const L = this.ctx.listener, p = cam.position, f = this._f || (this._f = p.clone());
    cam.getWorldDirection(f);
    if (!Number.isFinite(p.x + p.y + p.z + f.x + f.y + f.z)) return;
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    const o = this._o || (this._o = p.clone());
    for (const h of this.vivos) if (h.pan && h.obj) { h.obj.getWorldPosition(o); if (!Number.isFinite(o.x + o.y + o.z)) continue; if (h.pan.positionX) { h.pan.positionX.value = o.x; h.pan.positionY.value = o.y; h.pan.positionZ.value = o.z; } else h.pan.setPosition(o.x, o.y, o.z); }
  }
  clic() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.12);
  }
}
