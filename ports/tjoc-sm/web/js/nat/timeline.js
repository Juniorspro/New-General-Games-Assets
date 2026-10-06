/* TimelineComponent de Blueprint: curvas (FRichCurve) que escriben variables <TL>_<Pista>_<GUID>,
   llaman <TL>__UpdateFunc / __FinishedFunc y los eventos <TL>__<Pista>__EventFunc. */
import { Mundo } from '../mundo.js';
import { METODOS } from './motor.js';

export function evalRich(k, t) {
  if (!k || !k.length) return 0;
  if (t <= k[0][0]) return k[0][1];
  const n = k.length; if (t >= k[n - 1][0]) return k[n - 1][1];
  let i = 0; while (i < n - 2 && t >= k[i + 1][0]) i++;
  const a = k[i], b = k[i + 1], d = b[0] - a[0], u = d > 0 ? (t - a[0]) / d : 0;
  if (a[4] === 'Constant') return a[1];
  if (a[4] === 'Linear') return a[1] + (b[1] - a[1]) * u;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a[1] + (u3 - 2 * u2 + u) * a[3] * d + (-2 * u3 + 3 * u2) * b[1] + (u3 - u2) * b[2] * d;
}
Mundo.prototype.iniciarTimelines = function (a) {
  const tls = []; for (let c = a.clase; c; c = c.superClase) tls.push(...(c.j.timelines || []));
  for (const d of tls) {
    let comp = a.comps.find((c) => c.nombre === d.n && c.nat === 'TimelineComponent');
    if (!comp) { comp = this.nuevoComp(a, 'TimelineComponent', d.n); comp.noEscena = true; }
    let largo = d.len;
    if (d.modo === 'TL_LastKeyFrame') { largo = 0; for (const t of [...d.f, ...d.ev]) for (const k of t.c || []) largo = Math.max(largo, k[0]); }
    comp.tl = { d, pos: 0, tocando: false, reversa: false, vel: 1, loop: d.loop, largo };
    a.v[d.n] = comp;
    (this.timelines || (this.timelines = new Set())).add(comp);
    if (d.auto) comp.tl.tocando = true;
  }
};
function aplicar(M, comp, ant, disparar = true) {
  const tl = comp.tl, a = comp.actor, d = tl.d, p = tl.pos;
  for (const f of d.f) a.v[`${d.n}_${f.n}_${d.guid}`] = evalRich(f.c, p);
  for (const v of d.v) if (v.c) a.v[`${d.n}_${v.n}_${d.guid}`] = { X: evalRich(v.c[0], p), Y: evalRich(v.c[1], p), Z: evalRich(v.c[2], p) };
  for (const v of d.col) if (v.c) a.v[`${d.n}_${v.n}_${d.guid}`] = { R: evalRich(v.c[0], p), G: evalRich(v.c[1], p), B: evalRich(v.c[2], p), A: v.c[3] ? evalRich(v.c[3], p) : 1 };
  a.v[`${d.n}__Direction_${d.guid}`] = tl.reversa ? 1 : 0;
  if (disparar) for (const e of d.ev) for (const k of e.c || []) {
    const t = k[0]; const cruza = tl.reversa ? (ant > t && p <= t) : (ant < t && p >= t) || (ant === 0 && t === 0);
    if (cruza) M.vm.llamar(a, `${d.n}__${e.n}__EventFunc`, []);
  }
  M.vm.llamar(a, `${d.n}__UpdateFunc`, []);
}
Mundo.prototype.tickTimelines = function (dt) {
  if (!this.timelines) return;
  for (const comp of [...this.timelines]) {
    const tl = comp.tl; if (!comp.actor.vivo) { this.timelines.delete(comp); continue; }
    if (!tl.tocando) continue;
    const ant = tl.pos;
    tl.pos += (tl.reversa ? -dt : dt) * tl.vel;
    let fin = false;
    if (!tl.reversa && tl.pos >= tl.largo) { if (tl.loop) { tl.pos -= tl.largo; } else { tl.pos = tl.largo; fin = true; } }
    if (tl.reversa && tl.pos <= 0) { if (tl.loop) tl.pos += tl.largo; else { tl.pos = 0; fin = true; } }
    aplicar(this, comp, ant);
    if (fin) { tl.tocando = false; this.vm.llamar(comp.actor, `${tl.d.n}__FinishedFunc`, []); }
  }
};
Object.assign(METODOS.TimelineComponent = METODOS.TimelineComponent || {}, {
  Play(c) { c.tl.reversa = false; c.tl.tocando = true; },
  PlayFromStart(c) { c.tl.pos = 0; c.tl.reversa = false; c.tl.tocando = true; aplicar(this, c, 0); },
  Reverse(c) { c.tl.reversa = true; c.tl.tocando = true; },
  ReverseFromEnd(c) { c.tl.pos = c.tl.largo; c.tl.reversa = true; c.tl.tocando = true; aplicar(this, c, c.tl.largo); },
  Stop(c) { c.tl.tocando = false; },
  SetNewTime(c, [t]) { const ant = c.tl.pos; c.tl.pos = Math.max(0, Math.min(c.tl.largo, t)); aplicar(this, c, ant, false); },
  SetPlaybackPosition(c, [t, eventos]) { const ant = c.tl.pos; c.tl.pos = t; aplicar(this, c, ant, !!eventos); },
  GetPlaybackPosition(c) { return c.tl.pos; },
  SetPlayRate(c, [r]) { c.tl.vel = r; },
  GetPlayRate(c) { return c.tl.vel; },
  IsPlaying(c) { return c.tl.tocando; },
  IsReversing(c) { return c.tl.tocando && c.tl.reversa; },
  SetLooping(c, [b]) { c.tl.loop = !!b; },
  IsLooping(c) { return c.tl.loop; },
  GetTimelineLength(c) { return c.tl.largo; },
  SetTimelineLength(c, [l]) { c.tl.largo = l; },
});
