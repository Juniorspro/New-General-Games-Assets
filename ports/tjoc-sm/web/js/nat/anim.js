/* Animación esquelética: clips exportados (muestreados por cuadro, ya en espacio three) → THREE.AnimationClip.
   SkeletalMeshComponent en modo "single node": PlayAnimation, SetAnimation, SetPosition, SetPlayRate, Play/Stop.
   Matinee y LevelSequence fijan clip y tiempo a mano (controlado = true). Notifies de sonido incluidos.
   Modo AnimationBlueprint: la AnimBP es un objeto de la VM (corre BlueprintUpdateAnimation y los
   EvaluateGraphExposedInputs que copian variables a los nodos) y su grafo, que vive en el CDO como
   AnimGraphNode_*, se evalúa acá: SequencePlayer y BlendSpacePlayer (mezcla de las dos muestras vecinas). */
import * as THREE from 'three';
import { Mundo } from '../mundo.js';
import { METODOS } from './motor.js';
import { UObj } from '../vm.js';

export class Animaciones {
  constructor(M, base) { this.M = M; this.base = base; this.indice = {}; this.clips = new Map(); this.pend = new Map(); this.comps = new Set(); }
  async cargarIndice() {
    try { this.indice = await (await fetch(this.base + 'anims.json')).json(); } catch { this.indice = {}; }
    try { this.bs = await (await fetch(this.base + 'bs.json')).json(); } catch { this.bs = {}; }
  }
  async cargar(ruta) {
    if (!ruta) return null;
    if (this.clips.has(ruta)) return this.clips.get(ruta);
    if (this.pend.has(ruta)) return this.pend.get(ruta);
    const d = this.indice[ruta]; if (!d) return null;
    const p = (async () => {
      const buf = await (await fetch(this.base + d.f)).arrayBuffer();
      const tracks = []; const n = d.frames; const fps = d.fps || 30;
      const tiempos = (k) => { const t = new Float32Array(k); for (let i = 0; i < k; i++) t[i] = k === 1 ? 0 : Math.min(d.dur, i / fps); return t; };
      for (const [hueso, tipo, off, k, esc] of d.pistas) {
        const t = tiempos(k);
        if (tipo === 'r') {
          const q = new Int16Array(buf, off, k * 4), v = new Float32Array(k * 4);
          for (let i = 0; i < k * 4; i++) v[i] = q[i] / 32767;
          tracks.push(new THREE.QuaternionKeyframeTrack(d.huesos[hueso] + '.quaternion', t, v));
        } else {
          const q = new Int16Array(buf, off, k * 3), v = new Float32Array(k * 3);
          for (let i = 0; i < k * 3; i++) v[i] = q[i] * esc;
          tracks.push(new THREE.VectorKeyframeTrack(d.huesos[hueso] + (tipo === 'p' ? '.position' : '.scale'), t, v));
        }
      }
      void n;
      const clip = new THREE.AnimationClip(ruta.split('.').pop(), d.dur, tracks);
      clip.userData = { notifies: d.notifies || [], dur: d.dur };
      this.clips.set(ruta, clip); this.pend.delete(ruta);
      return clip;
    })();
    this.pend.set(ruta, p);
    return p;
  }
  async precargar(rutas) { await Promise.all([...rutas].map((r) => this.cargar(r).catch(() => null))); }
  /* estado de animación del componente */
  prepararComp(c, n) {
    const m = c.malla; if (!m) return;
    c.anim = { mixer: new THREE.AnimationMixer(m), accion: null, ruta: null, loop: n?.loop ?? true, tocando: n?.tocando ?? true, vel: n?.vel ?? 1, t: 0, modo: n?.modo || 'AnimationBlueprint' };
    if (n?.anim && (n.modo === 'AnimationSingleNode' || !n.modo)) { c.anim.inicial = n.anim; }
    if (n?.animbp && !/SingleNode/.test(n.modo || '')) this.ponerBP(c, n.animbp.split('.').pop());
    this.comps.add(c);
  }
  /* ---- AnimBP */
  ponerBP(c, nombre) {
    const M = this.M, cl = M.vm.claseSync(nombre);
    if (!cl) { M.vm.falta?.('animbp ' + nombre); return; }
    const ai = new UObj(cl, 'AnimInstance'); ai.nat = 'AnimInstance'; ai.comp = c; ai.nombre = nombre;
    M.vm.iniciarVars(ai, cl, (v) => M.resolverValor(v));
    c.animInst = ai;
    const nodos = {};
    for (let k = cl; k; k = k.superClase) for (const [nn, v] of Object.entries(k.j.cdo || {})) if (nn.startsWith('AnimGraphNode_') && !(nn in nodos)) nodos[nn] = v;
    const evals = []; for (let k = cl; k; k = k.superClase) for (const f of Object.keys(k.funcs)) if (f.startsWith('EvaluateGraphExposedInputs_')) evals.push(f);
    // el nodo de salida: lo que el Root tiene enchufado (con un solo nodo de pose, es ese)
    const poses = Object.keys(nodos).filter((nn) => /^AnimGraphNode_(SequencePlayer|BlendSpacePlayer)_/.test(nn));
    c.anim.bp = { ai, evals, salida: poses.length === 1 ? poses[0] : poses[0] || null, tn: 0, acciones: new Map() };
    c.anim.modo = 'AnimationBlueprint';
  }
  tickBP(c, dt) {
    const M = this.M, b = c.anim.bp, ai = b.ai;
    try {
      if (M.vm.tiene(ai, 'BlueprintUpdateAnimation')) M.vm.llamar(ai, 'BlueprintUpdateAnimation', [dt]);
      for (const f of b.evals) M.vm.llamar(ai, f, []);
    } catch (e) { M.log?.('animbp', e?.message || e); }
    if (!b.salida) return;
    const nodo = ai.v[b.salida] || {};
    // las muestras con su peso
    let muestras = [];
    if (b.salida.includes('SequencePlayer')) { const r = nodo.Sequence?.asset; if (r) muestras = [[r, 1, 1]]; }
    else {
      const bs = this.bs?.[nodo.BlendSpace?.asset];
      if (bs?.muestras?.length) {
        const x = +nodo.X || 0, l = [...bs.muestras].sort((p, q) => p[1] - q[1]);
        if (x <= l[0][1]) muestras = [[l[0][0], 1, l[0][3]]];
        else if (x >= l[l.length - 1][1]) muestras = [[l[l.length - 1][0], 1, l[l.length - 1][3]]];
        else for (let k = 0; k < l.length - 1; k++) if (x >= l[k][1] && x <= l[k + 1][1]) { const f = (x - l[k][1]) / Math.max(1e-6, l[k + 1][1] - l[k][1]); muestras = [[l[k][0], 1 - f, l[k][3]], [l[k + 1][0], f, l[k + 1][3]]]; break; }
      }
    }
    if (!muestras.length) return;
    if (c.anim.accion) { c.anim.accion.stop(); c.anim.accion = null; } // (venía de una animación suelta)
    // el tiempo va normalizado (las muestras de un blend space andan sincronizadas)
    const clips = muestras.map(([r]) => this.clips.get(r));
    if (clips.some((x) => !x)) { for (const [r] of muestras) this.cargar(r); return; }
    const durMedia = muestras.reduce((s2, [, w], i) => s2 + w * clips[i].duration, 0) || 1;
    const vel = (nodo.PlayRate ?? 1) * muestras.reduce((s2, [, w, rs]) => s2 + w * (rs || 1), 0);
    const antes = b.tn;
    b.tn = (b.tn + dt * vel / durMedia) % 1;
    const usadas = new Set();
    muestras.forEach(([r, w], i) => {
      const cl = clips[i]; usadas.add(r);
      let ac = b.acciones.get(r);
      if (!ac) { ac = c.anim.mixer.clipAction(cl); ac.setLoop(THREE.LoopRepeat, Infinity); ac.play(); ac.paused = true; b.acciones.set(r, ac); }
      ac.enabled = true; if (!ac.isScheduled()) { ac.play(); ac.paused = true; }
      ac.setEffectiveWeight(w); ac.time = b.tn * cl.duration;
      // notifies de la muestra que más pesa
      if (w >= 0.5) for (const nf of cl.userData.notifies || []) { const tt = nf.t / Math.max(1e-6, cl.duration); if ((antes < tt && b.tn >= tt) || (b.tn < antes && (tt >= antes || tt <= b.tn))) this.notificar(c, nf); }
    });
    for (const [r, ac] of b.acciones) if (!usadas.has(r)) { ac.setEffectiveWeight(0); ac.enabled = false; }
    c.anim.mixer.update(0);
  }
  arrancarInicial(c) { const a = c.anim; if (a?.inicial && a.tocando) this.poner(c, a.inicial, a.loop, true); else if (a?.inicial) this.poner(c, a.inicial, a.loop, false); }
  poner(c, ruta, loop, tocar, t0 = 0) {
    const a = c.anim; if (!a) return;
    a.ruta = ruta; a.loop = !!loop; a.tocando = !!tocar; a.t = t0; a.fin = false;
    const clip = this.clips.get(ruta);
    const aplicar = (cl) => {
      if (a.ruta !== ruta || !cl) return;
      a.mixer.stopAllAction();
      a.accion = a.mixer.clipAction(cl); a.accion.setLoop(THREE.LoopRepeat, Infinity); a.accion.clampWhenFinished = true;
      a.accion.play(); a.accion.paused = true; a.accion.time = a.t; a.dur = cl.duration; a.notifies = cl.userData.notifies;
      a.mixer.update(0);
    };
    if (clip) aplicar(clip); else this.cargar(ruta).then(aplicar);
  }
  tick(dt) {
    for (const c of this.comps) {
      const a = c.anim; if (!a || c.vivo === false) continue;
      if (a.bp && a.modo === 'AnimationBlueprint' && !a.controlado) { this.tickBP(c, dt); continue; }
      if (!a.accion) continue;
      if (a.controlado) { a.accion.time = a.t; a.mixer.update(0); continue; }
      if (!a.tocando) continue;
      if (c.malla && !c.malla.visible && !a.siempre) { a.t += dt * a.vel; continue; }
      const antes = a.t;
      a.t += dt * a.vel;
      if (a.t >= a.dur) { if (a.loop) a.t = a.dur > 0 ? a.t % a.dur : 0; else { a.t = a.dur; a.tocando = false; a.fin = true; } }
      if (a.t < 0) { if (a.loop) a.t = a.dur + (a.t % a.dur); else { a.t = 0; a.tocando = false; } }
      if (a.notifies?.length) for (const nf of a.notifies) { if ((antes < nf.t && a.t >= nf.t) || (a.t < antes && (nf.t >= antes || nf.t <= a.t))) this.notificar(c, nf); }
      a.accion.time = Math.min(a.t, Math.max(0, a.dur - 1e-4));
      a.mixer.update(0);
    }
  }
  notificar(c, nf) {
    if (nf.nombre && c.animInst) { const ev = 'AnimNotify_' + nf.nombre; if (this.M.vm.tiene(c.animInst, ev)) try { this.M.vm.llamar(c.animInst, ev, []); } catch (e) { this.M.log?.(ev, e?.message || e); } }
    if (nf.sonido) { const s = this.M.asset(nf.sonido, 'SoundBase'); this.M.audio?.arrancar(s, { vol: nf.vol ?? 1, tono: nf.tono ?? 1, pos: nf.seguir === false ? null : null, comp: c }); }
  }
  quitar(c) { this.comps.delete(c); }
}

Object.assign(METODOS.SkeletalMeshComponent = METODOS.SkeletalMeshComponent || {}, {
  PlayAnimation(c, [anim, loop]) { if (!anim) return; if (c.anim) { c.anim.modo = 'AnimationSingleNode'; for (const ac of c.anim.bp?.acciones.values() || []) { ac.setEffectiveWeight(0); ac.enabled = false; } } this.animar?.poner(c, anim.asset, loop, true); },
  SetAnimation(c, [anim]) { if (!anim || !c.anim) return; this.animar?.poner(c, anim.asset, c.anim.loop, c.anim.tocando); },
  SetAnimationMode(c, [m]) { if (c.anim) c.anim.modo = ['AnimationBlueprint', 'AnimationSingleNode', 'AnimationCustomMode'][m] || 'AnimationSingleNode'; },
  Play(c, [loop]) { if (!c.anim) return; c.anim.loop = !!loop; c.anim.tocando = true; if (c.anim.fin) { c.anim.t = 0; c.anim.fin = false; } },
  Stop(c) { if (c.anim) c.anim.tocando = false; },
  IsPlaying(c) { return !!c.anim?.tocando; },
  SetPosition(c, [t]) { if (c.anim) { c.anim.t = t; if (c.anim.accion) { c.anim.accion.time = t; c.anim.mixer.update(0); } } },
  GetPosition(c) { return c.anim?.t ?? 0; },
  SetPlayRate(c, [r]) { if (c.anim) c.anim.vel = r; },
  GetPlayRate(c) { return c.anim?.vel ?? 1; },
  GetAnimInstance(c) { return c.animInst || (c.animInst = { __ref: true, nat: 'AnimInstance', comp: c, v: {}, id: 'ai' + c.id }); },
  SetAnimInstanceClass(c, [cl]) { const n = cl?.n || cl?.asset?.split('.').pop(); if (n && c.anim) this.animar?.ponerBP(c, n); },
  SetSkeletalMesh(c, [m]) { this.cambiarMalla?.(c, m); },
  SetMorphTarget() {}, ClearMorphTargets() {},
  GetBoneLocation(c, [n]) { const b = c.malla?.skeleton?.bones.find((x) => x.name === n); if (!b) return { X: 0, Y: 0, Z: 0 }; const p = b.getWorldPosition(new THREE.Vector3()); return { X: p.x * 100, Y: p.z * 100, Z: p.y * 100 }; },
  GetSocketLocation(c, [n]) { return METODOS.SkeletalMeshComponent.GetBoneLocation.call(this, c, [n]); },
});
Object.assign(METODOS.AnimInstance = METODOS.AnimInstance || {}, {
  GetOwningActor(ai) { return ai.comp?.actor || null; },
  TryGetPawnOwner(ai) { const a = ai.comp?.actor; return a && /Pawn|Character/.test(a.nat || '') ? a : null; },
  GetOwningComponent(ai) { return ai.comp || null; },
  GetRelevantAnimTimeRemaining(ai) { const a = ai.comp?.anim; return a ? Math.max(0, (a.dur || 0) - a.t) : 0; },
  GetInstanceAssetPlayerTimeFromEnd(ai) { const a = ai.comp?.anim; return a ? Math.max(0, (a.dur || 0) - a.t) : 0; },
  Montage_Play() { return 0; }, Montage_Stop() {}, Montage_IsPlaying() { return false; },
});
Mundo.prototype.iniciarAnim = function () { if (!this.animar) this.animar = new Animaciones(this, this.base); return this.animar; };
