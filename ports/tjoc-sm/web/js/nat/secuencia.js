/* LevelSequence (MovieScene de UE 4.16): transformaciones 3D, animación esquelética, audio, propiedades
   (FOV/foco de cámara de cine, posproceso), fundido y cortes de cámara. LevelSequencePlayer como UObj. */
import { Mundo } from '../mundo.js';
import { METODOS, NATIVOS } from './motor.js';
import { evalRich } from './timeline.js';
import { rotAQuat } from './libs.js';
import { mundoUE, ponerMundo, rotT, pT, sT } from '../conv.js';
import { UObj } from '../vm.js';

const val = (c, t, d) => { if (!c) return d; if (c.k?.length) return evalRich(c.k, t); return c.d ?? d; };
export class Secuencias {
  constructor(M, base) { this.M = M; this.base = base; this.indice = {}; this.datos = new Map(); this.players = new Set(); }
  async cargarIndice() { try { this.indice = await (await fetch(this.base + 'secuencias.json')).json(); } catch { this.indice = {}; } }
  async precargar(rutas) { await Promise.all(rutas.map((r) => this.cargar(r))); }
  async cargar(r) {
    if (!r || this.datos.has(r)) return this.datos.get(r);
    const f = this.indice[r]; if (!f) return null;
    const d = await (await fetch(this.base + f)).json(); this.datos.set(r, d); return d;
  }
  crearPlayer(asset, ajustes = {}) {
    const p = new UObj(null, 'LevelSequencePlayer'); p.nat = 'LevelSequencePlayer';
    p.sec = { ruta: asset?.asset, t: 0, tocando: false, vel: ajustes.PlayRate || 1, vueltas: ajustes.LoopCount || 0, sonidos: new Map(), vista: null };
    p.v.OnFinished = []; p.v.OnPlay = []; p.v.OnStop = []; p.v.OnPause = [];
    this.players.add(p);
    return p;
  }
  objetos(d, guid, cache) {
    if (cache.has(guid)) return cache.get(guid);
    const M = this.M; const res = [];
    const refs = d.refs[guid] || [];
    const b = d.ms.bindings.find((x) => x.guid === guid);
    for (const r of refs) {
      if (r.startsWith('PersistentLevel.')) { const a = M.porNombre.get(r.slice(16)); if (a) res.push(a); }
      else if (b?.padre && b.padre !== '00000000-00000000-00000000-00000000') { for (const pa of this.objetos(d, b.padre, cache)) { const c = pa.comps?.find((x) => x.nombre === r); if (c) res.push(c); } }
    }
    if (!res.length && b?.n) { const a = M.porNombre.get(b.n); if (a) res.push(a); }
    cache.set(guid, res); return res;
  }
  aplicar(p, ant, t, disparar) {
    const M = this.M; const d = this.datos.get(p.sec.ruta); if (!d) return;
    const cache = p.sec.cache || (p.sec.cache = new Map());
    const enSec = (s) => s.inf || (t >= (s.ini ?? 0) && t <= (s.fin ?? 1e9));
    const pista = (tr, objs) => {
      for (const s of tr.secs) {
        if (!enSec(s) && tr.t !== 'Audio') continue;
        const c = s.can;
        switch (tr.t) {
          case '3DTransform': {
            const loc = { X: val(c.Translation, t, 0), Y: val(c['Translation[1]'], t, 0), Z: val(c['Translation[2]'], t, 0) };
            const rot = { Roll: val(c.Rotation, t, 0), Pitch: val(c['Rotation[1]'], t, 0), Yaw: val(c['Rotation[2]'], t, 0) };
            const esc = { X: val(c.Scale, t, 1), Y: val(c['Scale[1]'], t, 1), Z: val(c['Scale[2]'], t, 1) };
            for (const o of objs) { const tgt = o.raiz || o; if (!tgt.o3) continue; if (tgt.o3.parent === M.nivel?.raiz || tgt.o3.parent === M.escena) ponerMundo(tgt.o3, loc, rotAQuat(rot), esc); else { pT(loc, tgt.o3.position); rotT(rot, tgt.o3.quaternion); sT(esc, tgt.o3.scale); tgt.o3.updateMatrixWorld(true); } }
            break;
          }
          case 'SkeletalAnimation': {
            const pr = s.extra.Params || s.extra; const an = pr.Animation || pr.AnimSequence; if (!an?.asset) break;
            const rate = pr.PlayRate ?? 1, so = pr.StartOffset ?? 0;
            const at = so + (t - (s.ini ?? 0)) * rate;
            for (const o of objs) for (const comp of (o.comps || [o])) if (comp.anim) { comp.anim.controlado = true; if (comp.anim.ruta !== an.asset) M.animar.poner(comp, an.asset, false, false, at); comp.anim.t = Math.max(0, at); }
            break;
          }
          case 'Audio': {
            const ini = s.ini ?? 0; if (!disparar || p.sec.sonidos.has(s)) break;
            const snd = s.extra.Sound; if (!snd?.asset) break;
            if (t >= ini && t <= (s.fin ?? 1e9)) {
              const off = (s.extra.AudioStartOffset ?? 0) + (t - ini);
              const pos = objs[0]?.raiz ? mundoUE(objs[0].raiz.o3).Translation : null;
              const h = M.audio?.arrancar(M.asset(snd.asset, 'SoundBase'), { vol: val(c.SoundVolume, t, val(c.AudioVolume, t, 1)), tono: val(c.PitchMultiplier, t, 1), ini: off, pos });
              p.sec.sonidos.set(s, h);
            }
            break;
          }
          case 'Float': {
            const v = val(c.FloatCurve, t, null); if (v === null) break;
            for (const o of objs) {
              const prop = tr.prop || '';
              if (/CurrentFocalLength/.test(prop) && o.esComp) { const ancho = o.nodo?.cine?.ancho ?? 24.89; o.fov = 2 * Math.atan(ancho / (2 * Math.max(1, v))) * 180 / Math.PI; }
              else if (/FieldOfView/.test(prop)) o.fov = v;
              else if (/^PostProcessSettings\./.test(prop) && o.esComp) { const k = prop.split('.')[1]; o.pp = { ...(o.pp || {}), [k]: v, ['bOverride_' + k]: true }; }
              else if (o.luz && /Intensity/.test(prop)) o.luz.int = v;
              else M.escribir(o, prop.split('.').pop(), v);
            }
            break;
          }
          case 'Fade': { const v = val(c.FloatCurve, t, null); if (v !== null) M.ui?.fadeMatinee?.(v, s.extra.FadeColor); break; }
          case 'CameraCut': {
            const g = s.extra.CameraGuid; if (!g) break; const cam = this.objetos(d, g, cache)[0]; const a = cam?.actor || cam;
            if (a && M.cm?.vista?.obj !== a) M.ponerVista(a, 0);
            break;
          }
          case 'Visibility': { const v = val(c.BoolCurve || c.Curve, t, null); if (v !== null) for (const o of objs) METODOS.Actor.SetActorHiddenInGame.call(M, o.actor || o, [!v]); break; }
          default: break;
        }
      }
    };
    for (const b of d.ms.bindings) { const objs = this.objetos(d, b.guid, cache); if (objs.length) for (const tr of b.pistas) pista(tr, objs); }
    for (const tr of d.ms.pistas) pista(tr, []);
  }
  play(p) {
    const s = p.sec; if (s.tocando) return;
    s.tocando = true;
    for (const d of p.v.OnPlay || []) this.M.vm.llamar(d.obj, d.fn, []);
    this.cargar(s.ruta).then(() => this.aplicar(p, s.t, s.t, true));
  }
  stop(p, avisar = true) {
    const s = p.sec; s.tocando = false;
    for (const h of s.sonidos.values()) this.M.audio?.pararManejador(h);
    s.sonidos.clear();
    for (const [, objs] of s.cache || []) for (const o of objs) for (const c of (o.comps || [o])) if (c.anim) c.anim.controlado = false;
    if (avisar) for (const d of p.v.OnStop || []) this.M.vm.llamar(d.obj, d.fn, []);
  }
  tick(dt) {
    for (const p of [...this.players]) {
      const s = p.sec; if (!s.tocando) continue;
      const d = this.datos.get(s.ruta); if (!d) continue;
      const ant = s.t; s.t += dt * s.vel;
      const fin = d.ms.rango?.[1] ?? 0;
      if (s.t >= fin) {
        if (s.vueltas < 0 || s.vueltas > 0) { s.vueltas--; s.t = (d.ms.rango?.[0] ?? 0); s.sonidos.clear(); continue; }
        s.t = fin; this.aplicar(p, ant, s.t, true); s.tocando = false;
        for (const x of p.v.OnFinished || []) this.M.vm.llamar(x.obj, x.fn, []);
        continue;
      }
      this.aplicar(p, ant, s.t, true);
    }
  }
}
Object.assign(METODOS.MovieSceneSequencePlayer = METODOS.MovieSceneSequencePlayer || {}, {
  Play(p) { this.secuencias?.play(p); },
  PlayLooping(p, [n]) { p.sec.vueltas = n ?? -1; this.secuencias?.play(p); },
  Pause(p) { p.sec.tocando = false; },
  Stop(p) { p.sec.t = 0; this.secuencias?.stop(p); },
  IsPlaying(p) { return !!p.sec.tocando; },
  GetPlaybackPosition(p) { return p.sec.t; },
  SetPlaybackPosition(p, [t]) { const ant = p.sec.t; p.sec.t = t; this.secuencias?.aplicar(p, ant, t, false); },
  GetLength(p) { return this.secuencias?.datos.get(p.sec.ruta)?.ms.rango?.[1] ?? 0; },
  SetPlayRate(p, [r]) { p.sec.vel = r; },
  JumpToPosition(p, [t]) { p.sec.t = t; },
});
NATIVOS['LevelSequencePlayer:CreateLevelSequencePlayer'] = (T, [ctx, seq, ajustes], r, F, vm) => vm.mundo.secuencias?.crearPlayer(seq, ajustes || {}) ?? null;
Mundo.prototype.iniciarSecuencias = function () { if (!this.secuencias) this.secuencias = new Secuencias(this, this.base); return this.secuencias; };
