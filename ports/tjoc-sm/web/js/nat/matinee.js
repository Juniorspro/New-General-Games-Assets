/* Matinee (AMatineeActor de UE 4.16): curvas FInterpCurve, pistas de movimiento, propiedades, sonido,
   animación, eventos (llaman a <MatineeControllerName>_<Evento> en el guion del nivel), director, visibilidad y fundido. */
import * as THREE from 'three';
import { Mundo } from '../mundo.js';
import { METODOS } from './motor.js';
import { V, rotAQuat, quatARot, qmul, qrot } from './libs.js';
import { pUE, qUE, mundoUE, ponerMundo } from '../conv.js';

/* Evalúa una curva [[t, v, llegada, salida, modo]] en x. v escalar o arreglo. */
export function evalCurva(c, x) {
  if (!c || !c.length) return null;
  if (x <= c[0][0] || c.length === 1) return c[0][1];
  const n = c.length;
  if (x >= c[n - 1][0]) return c[n - 1][1];
  let i = 0; while (i < n - 2 && x >= c[i + 1][0]) i++;
  const a = c[i], b = c[i + 1], d = b[0] - a[0], t = d > 0 ? (x - a[0]) / d : 0, m = a[4];
  const f = (v0, v1, s0, s1) => {
    if (m === 'Constant') return v0;
    if (m === 'Linear') return v0 + (v1 - v0) * t;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * s0 * d + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * s1 * d;
  };
  if (Array.isArray(a[1])) return a[1].map((v, k) => f(v, b[1][k], a[3]?.[k] ?? 0, b[2]?.[k] ?? 0));
  return f(a[1], b[1], a[3] ?? 0, b[2] ?? 0);
}
const _p = new THREE.Vector3();

export class Matinee {
  constructor(M, actor, d) {
    this.M = M; this.actor = actor; this.d = d; this.pos = 0; this.tocando = false; this.reversa = false; this.pausado = false;
    this.largo = d.len || 0; this.loop = !!d.bLooping; this.vel = d.PlayRate ?? 1; this.iniciado = false; this.iniciales = new Map();
    this.ctrl = d.MatineeControllerName || null;
  }
  actoresGrupo(g) { return (g.actores || []).map((i) => this.M.indice[i]).filter((a) => a && a.vivo); }
  iniciar() {
    if (this.iniciado) return; this.iniciado = true;
    for (const g of this.d.grupos) for (const a of this.actoresGrupo(g)) if (a.raiz && !this.iniciales.has(a)) this.iniciales.set(a, mundoUE(a.raiz.o3));
    this.vistaPrevia = null;
    if (this.d.grupos.some((g) => g.pistas.some((p) => p.t === 'dir'))) { this.vistaPrevia = this.M.cm?.vista?.obj || null; }
  }
  terminar() {
    if (!this.iniciado) return; this.iniciado = false;
    for (const g of this.d.grupos) for (const p of g.pistas) if (p.t === 'anim') for (const a of this.actoresGrupo(g)) for (const c of a.comps) if (c.anim) c.anim.controlado = false;
    if (this.vistaPrevia !== null && this.d.grupos.some((g) => g.pistas.some((p) => p.t === 'dir'))) { this.M.ponerVista(this.M.pc?.peon || this.vistaPrevia, 0); }
    if (this.M.ui?.fadeMatinee && !this.fadePersiste) this.M.ui.fadeMatinee(0);
  }
  play() {
    const d = this.d;
    if (!this.tocando || this.reversa || this.pausado) {
      if (!this.tocando) this.iniciar();
      if (d.bRewindOnPlay && (!this.tocando || d.bRewindIfAlreadyPlaying)) this.setPos(0, false);
      else if (this.pos >= this.largo) this.setPos(0, false);
      this.reversa = false; this.tocando = true; this.pausado = false;
      this.aplicar(this.pos, this.pos, true);
    }
  }
  reverse() { if (!this.tocando) this.iniciar(); if (this.pos <= 0) this.setPos(this.largo, false); this.reversa = true; this.tocando = true; this.pausado = false; }
  stop() { if (!this.tocando && !this.iniciado) return; this.tocando = false; this.pausado = false; this.avisar('Finished'); this.terminar(); }
  pause() { if (this.tocando) this.pausado = !this.pausado; }
  setPos(p, saltar) { const ant = this.pos; this.pos = Math.max(0, Math.min(this.largo, p)); this.aplicar(ant, this.pos, !saltar); }
  avisar(ev) {
    if (!this.ctrl || !this.M.lsa) return;
    const fn = this.ctrl + '_' + ev;
    if (this.M.vm.tiene(this.M.lsa, fn)) this.M.vm.llamar(this.M.lsa, fn, []);
  }
  tick(dt) {
    if (!this.tocando || this.pausado) return;
    const ant = this.pos;
    let p = this.pos + (this.reversa ? -dt : dt) * this.vel;
    let fin = false;
    if (!this.reversa && p >= this.largo) { if (this.loop) { this.aplicar(ant, this.largo, true); p = p - this.largo; this.pos = 0; this.aplicar(0, p, true); this.pos = p; return; } p = this.largo; fin = true; }
    if (this.reversa && p <= 0) { if (this.loop) { p = this.largo + p; } else { p = 0; fin = true; } }
    this.pos = p;
    this.aplicar(ant, p, true);
    if (fin) { this.tocando = false; this.avisar('Finished'); this.terminar(); }
  }
  /* Aplica todas las pistas en p (ant → p para disparar claves cruzadas) */
  aplicar(ant, p, disparar) {
    const M = this.M;
    for (const g of this.d.grupos) {
      const actores = this.actoresGrupo(g);
      for (const tr of g.pistas) {
        switch (tr.t) {
          case 'mov': {
            const pos = evalCurva(tr.pos, p), eul = evalCurva(tr.eul, p);
            for (const a of actores) {
              if (!a.raiz) continue;
              let loc = pos ? { X: pos[0] * 100, Y: pos[2] * 100, Z: pos[1] * 100 } : null;
              let q = eul ? rotAQuat({ Roll: eul[0], Pitch: eul[1], Yaw: eul[2] }) : null;
              if (tr.frame === 'IMF_RelativeToInitial') {
                const ini = this.iniciales.get(a);
                if (ini) { if (loc) loc = { X: ini.Translation.X + loc.X, Y: ini.Translation.Y + loc.Y, Z: ini.Translation.Z + loc.Z }; if (q) q = qmul(ini.Rotation, q); }
              }
              ponerMundo(a.raiz.o3, tr.pos?.length ? loc : null, tr.eul?.length ? q : null);
            }
            break;
          }
          case 'fprop': { const v = evalCurva(tr.c, p); if (v === null) break; for (const a of actores) this.ponerProp(a, tr.prop, v); break; }
          case 'cprop': { const v = evalCurva(tr.c, p); if (!v) break; for (const a of actores) this.ponerProp(a, tr.prop, { R: v[0], G: v[1], B: v[2], A: v[3] ?? 1 }, true); break; }
          case 'bprop': { for (const a of actores) { let v = null; for (const [t, b] of tr.k) if (t <= p) v = b; if (v !== null) this.ponerProp(a, tr.prop, v); } break; }
          case 'snd': {
            if (!disparar || this.reversa) break;
            for (const [t, vol, tono, s] of tr.k) if ((ant < t && p >= t) || (ant === 0 && t === 0 && p >= 0 && !this._snd0?.has(tr))) {
              const sa = M.asset(s, 'SoundBase');
              const a = actores[0];
              if (a?.raiz) { const loc = mundoUE(a.raiz.o3).Translation; M.audio?.arrancar(sa, { vol, tono, pos: loc }); } else M.audio?.arrancar(sa, { vol, tono });
            }
            (this._snd0 || (this._snd0 = new Set())).add(tr);
            if (p === 0) this._snd0.delete(tr);
            break;
          }
          case 'anim': {
            let key = null; for (const k of tr.k) if (k[0] <= p + 1e-6) key = k;
            if (!key) break;
            const [t0, seq, so, eo, rate, loop] = key;
            const d = M.animar?.indice[seq]?.dur || 0;
            let at = so + (p - t0) * (rate || 1);
            const lim = Math.max(0, d - eo);
            if (loop && lim > so) at = so + ((at - so) % (lim - so)); else at = Math.min(at, lim);
            for (const a of actores) for (const c of a.comps) if (c.anim) {
              c.anim.controlado = true;
              if (c.anim.ruta !== seq) M.animar.poner(c, seq, loop, false, at);
              c.anim.t = at;
            }
            break;
          }
          case 'ev': {
            if (!disparar) break;
            const adelante = p >= ant;
            if ((adelante && tr.adelante === false) || (!adelante && tr.atras === false)) break;
            for (const [t, n] of tr.k) {
              const cruza = adelante ? (ant < t && p >= t) || (ant === 0 && t === 0 && p === 0) : (ant > t && p <= t);
              if (cruza) this.avisar(n);
            }
            break;
          }
          case 'dir': {
            let key = null; for (const k of tr.k) if (k[0] <= p + 1e-6) key = k;
            if (key) { const gr = this.d.grupos.find((x) => x.n === key[1]); const cam = gr ? this.actoresGrupo(gr)[0] : null; if (cam && M.cm?.vista?.obj !== cam) M.ponerVista(cam, key[2] || 0); }
            break;
          }
          case 'vis': {
            if (!disparar) break;
            for (const [t, acc] of tr.k) if (ant < t && p >= t || (t === 0 && ant === 0)) for (const a of actores) {
              const ocultar = acc === 'EVTA_Hide' ? true : acc === 'EVTA_Show' ? false : !a.ocultoJuego;
              METODOS.Actor.SetActorHiddenInGame.call(M, a, [ocultar]);
            }
            break;
          }
          case 'tog': {
            if (!disparar) break;
            for (const [t, acc] of tr.k) if (ant < t && p >= t || (t === 0 && ant === 0)) for (const a of actores) {
              const on = acc !== 'ETTA_Off' && (acc !== 'ETTA_Toggle' || !a.togOn); a.togOn = on;
              for (const c of a.comps) { if (c.luz) c.luz.visible = on; if (c.nat === 'ParticleSystemComponent') M.particulas?.activar(c, on); }
            }
            break;
          }
          case 'fade': { const v = evalCurva(tr.c, p); if (v !== null) { this.fadePersiste = tr.persistir; M.ui?.fadeMatinee?.(v, tr.color); } break; }
          case 'fmat': case 'vmat': { const v = evalCurva(tr.c, p); if (v !== null) for (const m of tr.mats) M.materiales?.paramAsset?.(m, tr.param, v); break; }
          default: break;
        }
      }
    }
  }
  ponerProp(a, prop, v, color) {
    const M = this.M;
    const partes = String(prop).split('.');
    let obj = a, n = partes.pop();
    for (const x of partes) { const c = a.comps.find((k) => k.nombre === x) || M.leer(obj, x); if (c) obj = c; }
    if (n === 'FOVAngle') { const c = a.comps.find((k) => /CameraComponent/.test(k.nat)); if (c) c.fov = v; return; }
    if (obj === a) {
      const luz = a.comps.find((k) => k.luz);
      if (luz && (n === 'Brightness' || n === 'Intensity')) { luz.luz.int = v; return; }
      if (luz && n === 'LightColor') { luz.luz.color = [v.R, v.G, v.B]; return; }
    }
    if (obj.luz && (n === 'Intensity' || n === 'Brightness')) { obj.luz.int = v; return; }
    if (obj.luz && n === 'LightColor') { obj.luz.color = [v.R, v.G, v.B]; return; }
    M.escribir(obj, n, v);
  }
}

Mundo.prototype.crearMatinee = function (a, d) { const m = new Matinee(this, a, d); (this.matinees || (this.matinees = [])).push(m); m.alEmpezar = () => { if (d.bPlayOnLevelLoad) m.play(); }; return m; };
Object.assign(METODOS.MatineeActor = METODOS.MatineeActor || {}, {
  Play(a) { a.matinee?.play(); }, Stop(a) { a.matinee?.stop(); }, Pause(a) { a.matinee?.pause(); }, Reverse(a) { a.matinee?.reverse(); },
  SetPosition(a, [p, saltar]) { a.matinee?.setPos(p, saltar); }, ChangePlaybackDirection(a) { if (a.matinee) a.matinee.reversa = !a.matinee.reversa; },
  SetLoopingState(a, [b]) { if (a.matinee) a.matinee.loop = !!b; }, EnableGroupByName() {}, EnableGroupByName_Deprecated() {},
});
Object.assign((METODOS.MatineeActor.__props = {}), {});
