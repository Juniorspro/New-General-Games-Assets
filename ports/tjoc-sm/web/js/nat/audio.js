/* Sonido de Unreal con WebAudio: SoundWave/SoundCue (Random, Modulator, Mixer, Delay, Looping, Concatenator),
   AudioComponent (Play/Stop/FadeIn/FadeOut/volumen/tono/filtro paso bajo) y atenuación 3D con PannerNode.
   Los sonidos largos (> 20 s) van por <audio> en streaming para no decodificar minutos de PCM. */
import * as THREE from 'three';
import { Mundo } from '../mundo.js';
import { METODOS } from './motor.js';
import { pT } from '../conv.js';
import { UObj } from '../vm.js';

const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3();
export class Audio {
  constructor(mundo, base) {
    this.M = mundo; this.base = base; this.ctx = null; this.buffers = new Map(); this.info = {}; this.voces = new Set();
    this.tonoGlobalV = 1; this.volMaestro = 1;
  }
  iniciar() {
    if (this.ctx) return this.ctx;
    const C = globalThis.AudioContext || globalThis.webkitAudioContext; if (!C) return null;
    this.ctx = new C(); this.salida = this.ctx.createGain(); this.salida.gain.value = this.volMaestro; this.salida.connect(this.ctx.destination);
    return this.ctx;
  }
  async cargarIndice() { try { this.info = await (await fetch(this.base + 'sonidos.json')).json(); } catch { this.info = {}; } }
  datos(s) { return s ? this.info[s.asset || s] : null; }
  async buffer(f) {
    if (!this.ctx) return null;
    if (!this.buffers.has(f)) this.buffers.set(f, fetch(this.base + f).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).catch(() => null));
    return this.buffers.get(f);
  }
  /* precarga los buffers cortos de una lista de sonidos */
  async precargar(rutas) {
    if (!this.iniciar()) return;
    const ondas = new Set();
    const rec = (n) => { if (!n) return; if (n.w) { const d = this.info[n.w]; if (d && d.dur <= 20) ondas.add(d.f); } (n.h || []).forEach(rec); };
    for (const r of rutas) { const d = this.info[r]; if (!d) continue; if (d.f && d.dur <= 20) ondas.add(d.f); if (d.nodo) rec(d.nodo); }
    await Promise.all([...ondas].map((f) => this.buffer(f)));
  }
  liberar() { this.buffers.clear(); }
  /* Evalúa el grafo del cue → voces [{onda, vol, tono, loop, demora}] */
  evaluar(s) {
    const d = this.datos(s); if (!d) return [];
    if (d.f) return [{ onda: s.asset || s, vol: d.vol ?? 1, tono: d.tono ?? 1, loop: !!d.loop, demora: 0 }];
    const out = [];
    const rec = (n, vol, tono, loop, demora) => {
      if (!n) return;
      switch (n.t) {
        case 'w': out.push({ onda: n.w, vol: vol * (this.info[n.w]?.vol ?? 1), tono, loop: loop || !!n.loop || !!this.info[n.w]?.loop, demora }); break;
        case 'rnd': { const w = n.pesos || n.h.map(() => 1); let tot = w.reduce((a, b) => a + b, 0), r = Math.random() * tot, i = 0; for (; i < w.length - 1; i++) { r -= w[i]; if (r <= 0) break; } rec(n.h[i], vol, tono, loop, demora); break; }
        case 'mod': rec(n.h[0], vol * (n.v0 + Math.random() * (n.v1 - n.v0)), tono * (n.p0 + Math.random() * (n.p1 - n.p0)), loop, demora); break;
        case 'mix': n.h.forEach((h, i) => rec(h, vol * (n.vols?.[i] ?? 1), tono, loop, demora)); break;
        case 'del': rec(n.h[0], vol, tono, loop, demora + n.d0 + Math.random() * (n.d1 - n.d0)); break;
        case 'loop': rec(n.h[0], vol, tono, true, demora); break;
        case 'cat': { let t = demora; n.h.forEach((h, i) => { rec(h, vol * (n.vols?.[i] ?? 1), tono, loop, t); t += this.info[h?.w]?.dur || 0; }); break; }
        default: (n.h || []).forEach((h) => rec(h, vol, tono, loop, demora));
      }
    };
    rec(d.nodo, d.vol ?? 1, d.tono ?? 1, false, 0);
    return out;
  }
  aten(s, comp) {
    const d = this.datos(s) || {};
    const a = comp?.atenov || this.info[comp?.aten]?.aten || d.aten;
    return a || null;
  }
  /* Arranca un juego de voces; devuelve un manejador {parar, ganancia, fuentes} */
  arrancar(s, { vol = 1, tono = 1, ini = 0, pos = null, comp = null, ui = false } = {}) {
    if (!this.iniciar() || !s) return null;
    const voces = this.evaluar(s); if (!voces.length) return null;
    const ctx = this.ctx;
    const h = { fuentes: [], vivas: 0, gan: ctx.createGain(), comp, fin: null, s };
    h.gan.gain.value = vol;
    let ultimo = h.gan;
    if (comp) { h.lpf = ctx.createBiquadFilter(); h.lpf.type = 'lowpass'; h.lpf.frequency.value = comp.lpfOn || comp.lpf < 20000 ? Math.max(20, comp.lpf ?? 20000) : 22000; ultimo.connect(h.lpf); ultimo = h.lpf; }
    const at = this.aten(s, comp);
    if ((pos || comp) && at && at.espacial !== false) {
      h.pan = ctx.createPanner(); h.pan.panningModel = 'equalpower'; h.pan.distanceModel = 'linear';
      h.pan.refDistance = Math.max(0.01, (at.radio ?? 4) * 0.01); h.pan.maxDistance = h.pan.refDistance + Math.max(0.01, (at.caida ?? 3600) * 0.01); h.pan.rolloffFactor = 1;
      if (pos) { pT(pos, _p); h.pan.positionX.value = _p.x; h.pan.positionY.value = _p.y; h.pan.positionZ.value = _p.z; }
      ultimo.connect(h.pan); ultimo = h.pan;
    }
    ultimo.connect(this.salida);
    const t0 = ctx.currentTime;
    for (const v of voces) {
      const info = this.info[v.onda]; if (!info) continue;
      const rate = v.tono * tono * this.tonoGlobalV;
      h.vivas++;
      const terminar = () => { if (--h.vivas <= 0) { this.voces.delete(h); h.fin?.(); } };
      if (info.dur > 20 || info.stream) {
        const el = new globalThis.Audio(this.base + info.f); el.loop = v.loop; el.playbackRate = rate; el.preservesPitch = false;
        const src = ctx.createMediaElementSource(el); const g = ctx.createGain(); g.gain.value = v.vol; src.connect(g); g.connect(h.gan);
        el.currentTime = ini || 0; const arrancarEl = () => el.play().catch(() => {});
        if (v.demora > 0) setTimeout(arrancarEl, v.demora * 1000); else arrancarEl();
        el.addEventListener('ended', terminar);
        h.fuentes.push({ el, g, rate: v.tono, parar: () => { el.pause(); el.src = ''; } });
      } else {
        const g = ctx.createGain(); g.gain.value = v.vol; g.connect(h.gan);
        const f = { g, rate: v.tono, src: null, parada: false, parar: () => { f.parada = true; try { f.src?.stop(); } catch { /* ya parada */ } } };
        h.fuentes.push(f);
        this.buffer(info.f).then((buf) => {
          if (!buf || f.parada) { terminar(); return; }
          const src = ctx.createBufferSource(); src.buffer = buf; src.loop = v.loop; src.playbackRate.value = rate; src.connect(g);
          src.onended = terminar; f.src = src;
          const off = Math.max(0, Math.min(buf.duration - 0.01, ini || 0));
          src.start(Math.max(ctx.currentTime, t0 + v.demora), off);
        });
      }
    }
    this.voces.add(h);
    return h;
  }
  pararManejador(h, ya = true) { if (!h) return; for (const f of h.fuentes) f.parar(); this.voces.delete(h); if (ya) h.fin = null; }
  /* ---- API usada por los nativos ---- */
  reproducir2D(s, vol, tono, ini) { this.arrancar(s, { vol, tono, ini, ui: true }); }
  reproducirEn(s, loc, vol, tono, ini) { this.arrancar(s, { vol, tono, ini, pos: loc }); }
  compSuelto(s, vol, tono, ini, pos, pegado) {
    const M = this.M;
    const a = M.porNombre.get('__audio') || (() => { const x = M.nuevoActor('Actor', null, '__audio'); x.raiz = M.nuevoComp(x, 'SceneComponent', 'r'); M.escena.add(x.raiz.o3); M.registrar(x); x.empezo = true; x.esSistema = true; return x; })();
    const c = M.nuevoComp(a, 'AudioComponent', 'Audio' + a.comps.length);
    (pegado?.o3 || a.raiz.o3).add(c.o3);
    if (pos) { pT(pos, c.o3.position); }
    c.sonido = s; c.volMult = vol; c.tono = tono; c.ini = ini; c.es2D = !pos && !pegado; c.vivo = true;
    return c;
  }
  crearComp2D(s, vol, tono, ini, auto) { const c = this.compSuelto(s, vol, tono, ini); if (auto) this.play(c, ini); return c; }
  crearCompEn(s, loc, vol, tono, ini) { const c = this.compSuelto(s, vol, tono, ini, loc); this.play(c, ini); return c; }
  crearCompPegado(s, comp, vol, tono, ini) { const c = this.compSuelto(s, vol, tono, ini, null, comp); this.play(c, ini); return c; }
  registrarComp(c, n) {
    c.sonido = n.sonido ? this.M.asset(n.sonido, 'SoundBase') : null; c.volMult = n.vol ?? 1; c.tono = n.tono ?? 1; c.autoAct = n.auto !== false;
    c.aten = n.aten || null; c.atenov = n.atenov ? convAten(n.atenov) : null; c.ui = !!n.ui;
    c.alActivarInicio = true;
  }
  alActivar(c) { if (c.autoAct || c.forzar) this.play(c, 0); }
  play(c, ini = 0) {
    if (!c.sonido) return;
    this.parar(c, false);
    const h = this.arrancar(c.sonido, { vol: (c.volMult ?? 1) * (c.volFade ?? 1), tono: c.tono ?? 1, ini, comp: c.es2D ? null : c, ui: c.ui });
    c.h = h; c.sonando = !!h;
    if (h) h.fin = () => { if (c.h === h) { c.sonando = false; c.h = null; const d = c.v?.OnAudioFinished; if (d) for (const x of d) this.M.vm.llamar(x.obj, x.fn, []); } };
  }
  parar(c, avisar = true) { if (c.h) { const h = c.h; c.h = null; this.pararManejador(h); } c.sonando = false; }
  volumen(c) { if (c.h) c.h.gan.gain.setTargetAtTime((c.volMult ?? 1) * (c.volFade ?? 1), this.ctx.currentTime, 0.02); }
  tonoComp(c) { if (!c.h) return; for (const f of c.h.fuentes) { const r = f.rate * (c.tono ?? 1) * this.tonoGlobalV; if (f.src) f.src.playbackRate.value = r; if (f.el) f.el.playbackRate = r; } }
  filtro(c) { if (c.h?.lpf) c.h.lpf.frequency.value = Math.max(20, Math.min(22000, c.lpf ?? 20000)); }
  fundido(c, dur, desde, hasta, alTerminar) {
    if (!this.ctx) return;
    c.volFade = hasta;
    if (!c.h) return;
    const g = c.h.gan.gain, t = this.ctx.currentTime, base = c.volMult ?? 1;
    g.cancelScheduledValues(t); g.setValueAtTime(base * desde, t); g.linearRampToValueAtTime(base * hasta, t + Math.max(0.01, dur));
    if (alTerminar) { const h = c.h; setTimeout(() => { if (c.h === h) alTerminar(); }, dur * 1000); }
  }
  tonoGlobal(p) { this.tonoGlobalV = p; for (const h of this.voces) for (const f of h.fuentes) { const r = f.rate * (h.comp?.tono ?? 1) * p; if (f.src) f.src.playbackRate.value = r; if (f.el) f.el.playbackRate = r; } }
  pausar(b) { if (!this.ctx) return; if (b) this.ctx.suspend(); else this.ctx.resume(); }
  pararTodo() { for (const h of [...this.voces]) this.pararManejador(h); this.voces.clear(); this.tonoGlobalV = 1; }
  /* posición del oyente y de cada fuente 3D */
  tick(camara) {
    if (!this.ctx) return;
    const L = this.ctx.listener; camara.getWorldPosition(_p); camara.getWorldDirection(_f); _u.set(0, 1, 0).applyQuaternion(camara.quaternion);
    if (L.positionX) { L.positionX.value = _p.x; L.positionY.value = _p.y; L.positionZ.value = _p.z; L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z; L.upX.value = _u.x; L.upY.value = _u.y; L.upZ.value = _u.z; }
    for (const h of this.voces) if (h.pan && h.comp?.o3) { h.comp.o3.getWorldPosition(_p); h.pan.positionX.value = _p.x; h.pan.positionY.value = _p.y; h.pan.positionZ.value = _p.z; }
  }
}
function convAten(a) {
  return { radio: a.AttenuationShapeExtents?.X ?? 400, caida: a.FalloffDistance ?? 3600, espacial: a.bSpatialize !== false };
}

/* Métodos nativos del AudioComponent */
Object.assign(METODOS.AudioComponent = METODOS.AudioComponent || {}, {
  Play(c, [ini = 0]) { c.volFade = 1; this.audio?.play(c, ini); },
  Stop(c) { this.audio?.parar(c); },
  IsPlaying(c) { return !!c.sonando; },
  FadeIn(c, [dur = 1, vol = 1, ini = 0]) { c.volFade = 0; this.audio?.play(c, ini); this.audio?.fundido(c, dur, 0, vol); },
  FadeOut(c, [dur = 1, vol = 0]) { if (!c.sonando) return; this.audio?.fundido(c, dur, c.volFade ?? 1, vol, vol <= 0 ? () => this.audio.parar(c) : null); },
  AdjustVolume(c, [dur, vol]) { this.audio?.fundido(c, dur, c.volFade ?? 1, vol); },
  SetVolumeMultiplier(c, [v]) { c.volMult = v; this.audio?.volumen(c); },
  SetPitchMultiplier(c, [v]) { c.tono = v; this.audio?.tonoComp(c); },
  SetSound(c, [s]) { const sonaba = c.sonando; c.sonido = s; if (sonaba) this.audio?.play(c, 0); },
  SetUISound(c, [b]) { c.ui = b; },
  SetFloatParameter() {}, SetBoolParameter() {}, SetIntParameter() {}, SetWaveParameter() {},
});
Mundo.prototype.iniciarAudio = function () { if (!this.audio) this.audio = new Audio(this, this.base); return this.audio; };
void UObj;
