/* Sonido como el de Clickteam: canales numerados (cada uno con su volumen, que queda puesto aunque cambie el
   sonido), volumen principal y «tocar n veces» (0 = para siempre). Los .ogg (Opus) se decodifican la primera vez
   que se piden; cada frame pide de antemano los suyos. */
export class Sonido {
  constructor(url) { this.url = url; this.ctx = null; this.buf = new Map(); this.prom = new Map(); this.canales = new Map(); this.vol = new Map(); this.princ = 100; this.libre = 1000; }
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (!C) return;
    this.ctx = new C(); this.maestro = this.ctx.createGain(); this.aplicar(); this.maestro.connect(this.ctx.destination);
    for (const h of this.prom.keys()) if (!this.buf.has(h)) this.prom.delete(h);
  }
  cargar(h) {
    if (!this.ctx) return Promise.resolve(null);
    let p = this.prom.get(h);
    if (!p) {
      p = fetch(this.url(h)).then((r) => r.arrayBuffer()).then((a) => this.ctx.decodeAudioData(a)).then((b) => { this.buf.set(h, b); return b; }).catch(() => null);
      this.prom.set(h, p);
    }
    return p;
  }
  tocar(h, canal, vueltas) {
    if (!this.ctx) return;
    if (!canal) canal = this.libre++;
    this.pararCanal(canal);
    const pedido = { h }; this.canales.set(canal, pedido);
    const ya = this.buf.get(h);
    const empezar = (b) => {
      if (!b || this.canales.get(canal) !== pedido) return;
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
      s.buffer = b; g.gain.value = (this.vol.get(canal) ?? 100) / 100;
      if (vueltas !== 1) { s.loop = true; if (vueltas > 1) s.stop(this.ctx.currentTime + b.duration * vueltas); }
      s.connect(g).connect(this.maestro); s.start();
      pedido.s = s; pedido.g = g;
      s.onended = () => { if (this.canales.get(canal) === pedido) this.canales.delete(canal); };
    };
    if (ya) empezar(ya); else this.cargar(h).then(empezar);
  }
  pararCanal(c) { const p = this.canales.get(c); if (p) { try { p.s?.stop(); } catch { /* ya terminó */ } this.canales.delete(c); } }
  pararTodo() { for (const c of [...this.canales.keys()]) this.pararCanal(c); }
  volumen(c, v) { v = Math.max(0, Math.min(100, v)); this.vol.set(c, v); const p = this.canales.get(c); if (p?.g) p.g.gain.value = v / 100; }
  volumenCanal(c) { return this.vol.get(c) ?? 100; }
  principal(v) { this.princ = Math.max(0, Math.min(100, v)); this.aplicar(); }
  ponerUsuario(k) { this.usuario = k; this.aplicar(); }
  aplicar() { if (this.maestro) this.maestro.gain.value = (this.princ / 100) * (this.usuario ?? 1); }
  pausar(b) { if (!this.ctx) return; if (b) this.ctx.suspend(); else this.ctx.resume(); }
}
