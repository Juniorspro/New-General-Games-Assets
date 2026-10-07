/* Animator de Unity para lo que usa Baldi: máquinas de estados con parámetros (bool, trigger, float, int),
   transiciones (con o sin tiempo de salida, desde cualquier estado) y clips de sprites (curvas PPtr sobre
   el SpriteRenderer o la Image de la interfaz). Los de la interfaz corren con tiempo sin escalar. */
import { Componente, Time } from './motor.js';
import { FABRICAS } from './mundo.js';

export class Animator extends Componente {
  static get tipos() { return ['Animator']; }
  constructor(n, d, mundo) {
    super(n, d);
    this.C = mundo.C; this.R = mundo.recursos;
    this.ctrl = d.ctrl ? mundo.C.ctrls[d.ctrl] : null;
    this.params = {}; this.tipos = {};
    for (const p of this.ctrl?.params || []) { this.params[p.n] = p.tipo === 4 || p.tipo === 9 ? false : 0; this.tipos[p.n] = p.tipo; }
    this.speed = 1; this.capas = (this.ctrl?.capas || []).map((c) => ({ c, estado: c.ini, t: 0, ant: -1 }));
  }
  SetBool(n, v) { if (n in this.params) this.params[n] = !!v; }
  GetBool(n) { return !!this.params[n]; }
  SetTrigger(n) { if (n in this.params) this.params[n] = true; }
  ResetTrigger(n) { if (n in this.params) this.params[n] = false; }
  SetFloat(n, v) { if (n in this.params) this.params[n] = v; }
  GetFloat(n) { return this.params[n] || 0; }
  SetInteger(n, v) { if (n in this.params) this.params[n] = v | 0; }
  GetInteger(n) { return this.params[n] | 0; }
  Play(nombre) { for (const k of this.capas) { const i = k.c.estados.findIndex((e) => e.n === nombre); if (i >= 0) { k.estado = i; k.t = 0; } } }
  _prender() { for (const k of this.capas) { k.estado = k.c.ini; k.t = 0; } this.aplicar(); }
  _cumple(tr) {
    for (const c of tr.conds) {
      const v = this.params[c.p];
      if (c.modo === 1 && !v) return false;
      if (c.modo === 2 && v) return false;
      if (c.modo === 3 && !(v > c.v)) return false;
      if (c.modo === 4 && !(v < c.v)) return false;
      if (c.modo === 6 && v !== c.v) return false;
      if (c.modo === 7 && v === c.v) return false;
    }
    return true;
  }
  _consumir(tr) { for (const c of tr.conds) if (this.tipos[c.p] === 9) this.params[c.p] = false; }
  _clip(k) { const e = k.c.estados[k.estado]; return e?.clip ? this.C.clips[e.clip] : null; }
  actualizar(dt) {
    if (!this.isActiveAndEnabled || !this.ctrl) return;
    for (const k of this.capas) {
      const e = k.c.estados[k.estado];
      if (!e) continue;
      const clip = this._clip(k), largo = clip?.largo || 0;
      k.t += dt * e.vel * this.speed;
      const norm = largo > 0 ? k.t / largo : 1;
      let tr = k.c.cualquiera.find((x) => x.conds.length && this._cumple(x));
      if (!tr) tr = e.trans.find((x) => (x.salida ? norm >= (x.tsalida ?? 1) : x.conds.length > 0) && this._cumple(x) && (x.salida || x.conds.length));
      if (tr) { this._consumir(tr); k.estado = tr.dest; k.t = 0; }
    }
    this.aplicar();
  }
  aplicar() {
    for (const k of this.capas) {
      const clip = this._clip(k);
      if (!clip) continue;
      const largo = clip.largo || 0;
      let t = k.t;
      if (largo > 0) t = clip.bucle ? ((t % largo) + largo) % largo : Math.min(t, largo);
      for (const cv of clip.curvas) {
        if (cv.tipo !== 'pptr' || !cv.k.length) continue;
        let val = cv.k[0][1];
        for (const [tk, v] of cv.k) { if (tk <= t + 1e-6) val = v; else break; }
        const destino = cv.ruta ? this.nodo.Find(cv.ruta) : this.nodo;
        if (!destino) continue;
        const sp = val ? this.R.sprite(val) : null;
        if (cv.clase === 212) { const r = destino.GetComponent('SpriteRenderer'); if (r) r.sprite = sp; }
        else { const im = destino.GetComponent('Image'); if (im) im.sprite = sp; }
      }
    }
  }
}

export class Animacion {
  trasUpdate() {
    for (const c of this.mundo.comps) if (c instanceof Animator) {
      if (c._ui === undefined) { let n = c.nodo; c._ui = false; while (n) { if (n.GetComponent('Canvas')) { c._ui = true; break; } n = n.parent; } }
      c.actualizar(c._ui ? Time.unscaledDeltaTime : Time.deltaTime);
    }
  }
}

FABRICAS.animador = (n, d, mundo) => [new Animator(n, d, mundo)];
