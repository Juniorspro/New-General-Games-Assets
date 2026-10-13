// Las animaciones de Tom: anim.bin + anim.json (armar-datos.py, animaciones()) y quien las pasa a
// los huesos. Los clips del juego son "legacy" de Unity: cada uno trae todos los huesos (rotación y
// posición; algunos escala) y se reproducen como Animation.Play/CrossFade.

const ROT = 0, POS = 1, ESC = 2;

export class Animaciones {
  constructor(indice, buffer) {
    this.fps = indice.fps;
    this.huesos = indice.huesos;
    this.info = indice.clips;
    this.buf = buffer;
    this.cache = new Map();
  }

  tiene(nombre) { return nombre in this.info; }

  nombres() { return Object.keys(this.info); }

  // El clip decodificado: canales con sus claves (frames enteros a 30 por segundo) y valores
  // ya en coma flotante (rotaciones: cuaterniones x, y, z, w de three.js).
  clip(nombre) {
    let c = this.cache.get(nombre);
    if (c) return c;
    const inf = this.info[nombre];
    if (!inf) return null;
    const dv = new DataView(this.buf, inf.ofs, inf.len);
    let p = 0;
    const canales = [];
    for (let i = 0; i < inf.canales; i++) {
      const hueso = dv.getUint16(p, true), tipo = dv.getUint8(p + 2), modo = dv.getUint8(p + 3);
      p += 4;
      const nc = tipo === ROT ? 4 : 3;
      if (modo === 0) {
        const v = new Float32Array(nc);
        for (let k = 0; k < nc; k++, p += 4) v[k] = dv.getFloat32(p, true);
        canales.push({ hueso, tipo, n: 1, frames: null, valores: v });
        continue;
      }
      const n = dv.getUint16(p, true);
      p += 2;
      let mn = null, rango = null;
      if (tipo !== ROT) {
        mn = new Float32Array(nc); rango = new Float32Array(nc);
        for (let k = 0; k < nc; k++) mn[k] = dv.getFloat32(p + 4 * k, true);
        for (let k = 0; k < nc; k++) rango[k] = dv.getFloat32(p + 4 * (nc + k), true) - mn[k];
        p += 8 * nc;
      }
      const frames = new Uint16Array(n);
      for (let k = 1; k < n; k++) frames[k] = frames[k - 1] + dv.getUint8(p++);
      const valores = new Float32Array(n * nc);
      const acc = new Int32Array(nc);
      for (let k = 0; k < n; k++) {
        for (let j = 0; j < nc; j++, p += 2) {
          acc[j] = (acc[j] + dv.getUint16(p, true)) & 0xffff;
          valores[k * nc + j] = tipo === ROT
            ? (acc[j] >= 32768 ? acc[j] - 65536 : acc[j]) / 32767
            : mn[j] + (acc[j] / 65535) * rango[j];
        }
      }
      canales.push({ hueso, tipo, n, frames, valores });
    }
    c = { nombre, dur: inf.dur, frames: inf.frames, wrap: inf.wrap, eventos: inf.eventos || [], canales };
    this.cache.set(nombre, c);
    return c;
  }
}

// El valor de un canal en el cuadro f (con decimales): lineal entre claves (normalizado en rotaciones).
function valor(canal, f, out) {
  const nc = canal.tipo === ROT ? 4 : 3, v = canal.valores;
  let a = 0, b = 0, t = 0;
  if (canal.n > 1) {
    const fr = canal.frames, n = canal.n;
    if (f >= fr[n - 1]) { a = b = n - 1; }
    else if (f > 0) {
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fr[m] <= f) lo = m; else hi = m; }
      a = lo; b = hi; t = (f - fr[lo]) / (fr[hi] - fr[lo]);
    }
  }
  for (let j = 0; j < nc; j++) out[j] = v[a * nc + j] + (v[b * nc + j] - v[a * nc + j]) * t;
  if (nc === 4) {
    const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
    out[0] /= l; out[1] /= l; out[2] /= l; out[3] /= l;
  }
}

// Una pose: por hueso, rotación (4), posición (3) y escala (3), y qué partes tiene.
export class Pose {
  constructor(n) {
    this.n = n;
    this.q = new Float32Array(n * 4);
    this.p = new Float32Array(n * 3);
    this.s = new Float32Array(n * 3);
    this.tiene = new Uint8Array(n);       // bits: 1 rotación, 2 posición, 4 escala
  }
  limpiar() { this.tiene.fill(0); }
}

const tmp4 = new Float32Array(4);

export function muestrear(clip, t, pose) {
  const f = t * 30;
  for (const c of clip.canales) {
    if (c.tipo === ROT) { valor(c, f, tmp4); pose.q.set(tmp4, c.hueso * 4); pose.tiene[c.hueso] |= 1; }
    else if (c.tipo === POS) { valor(c, f, tmp4); pose.p.set(tmp4.subarray(0, 3), c.hueso * 3); pose.tiene[c.hueso] |= 2; }
    else { valor(c, f, tmp4); pose.s.set(tmp4.subarray(0, 3), c.hueso * 3); pose.tiene[c.hueso] |= 4; }
  }
}

// a ← a·(1−w) + b·w (slerp aproximado: nlerp en el hemisferio de a)
export function mezclar(a, b, w) {
  if (w <= 0) return;
  for (let h = 0; h < a.n; h++) {
    const tb = b.tiene[h];
    if (!tb) continue;
    const ta = a.tiene[h];
    if (tb & 1) {
      const i = h * 4;
      if (ta & 1) {
        let d = a.q[i] * b.q[i] + a.q[i + 1] * b.q[i + 1] + a.q[i + 2] * b.q[i + 2] + a.q[i + 3] * b.q[i + 3];
        const sg = d < 0 ? -1 : 1;
        let l = 0;
        for (let k = 0; k < 4; k++) { a.q[i + k] = a.q[i + k] * (1 - w) + sg * b.q[i + k] * w; l += a.q[i + k] * a.q[i + k]; }
        l = Math.sqrt(l) || 1;
        for (let k = 0; k < 4; k++) a.q[i + k] /= l;
      } else for (let k = 0; k < 4; k++) a.q[i + k] = b.q[i + k];
    }
    if (tb & 2) {
      const i = h * 3;
      if (ta & 2) for (let k = 0; k < 3; k++) a.p[i + k] += (b.p[i + k] - a.p[i + k]) * w;
      else for (let k = 0; k < 3; k++) a.p[i + k] = b.p[i + k];
    }
    if (tb & 4) {
      const i = h * 3;
      if (ta & 4) for (let k = 0; k < 3; k++) a.s[i + k] += (b.s[i + k] - a.s[i + k]) * w;
      else for (let k = 0; k < 3; k++) a.s[i + k] = b.s[i + k];
    }
    a.tiene[h] |= tb;
  }
}

// Unity WrapMode: 0 Default (= Once), 1 Once, 2 Loop, 4 PingPong, 8 ClampForever
function tiempoEn(clip, t, bucle) {
  if (clip.dur <= 0) return 0;
  if (bucle) return t % clip.dur;
  return Math.min(t, clip.dur);
}

// --------------------------------------------------------------------------------------------------
// El componente Animation de Unity (legacy), para portar el código del juego tal cual: un estado por
// clip (AnimationState: capa, peso, tiempo, velocidad, wrapMode, blendMode, huesos de mezcla) y la
// mezcla de Unity: de la capa más alta a la más baja cada capa toma su peso (normalizado si pasa de 1)
// y deja el resto a las de abajo; los estados aditivos suman, encima, su diferencia con su primer
// cuadro. Los nombres de los métodos son los de Unity (play, stop, crossFade, blend…) a propósito.

const WRAP_ONCE = 1, WRAP_LOOP = 2, WRAP_PINGPONG = 4, WRAP_CLAMP = 8;
export const PLAY_STOP_SAME_LAYER = 0, PLAY_STOP_ALL = 4;
export const BLEND = 0, ADDITIVE = 1;

export class EstadoAnim {
  constructor(anim, nombre, clip) {
    this.anim = anim;
    this.name = nombre;
    this.clip = clip;
    this.enabled = false;
    this._weight = 0;
    this.time = 0;
    this.speed = 1;
    this.layer = 0;
    this.wrapMode = clip.wrap || 0;
    this.blendMode = BLEND;
    this.mezcla = null;          // Set de índices de hueso (AddMixingTransform), null = todos
    this.fade = null;            // {objetivo, ritmo, parar}
    this.pose = new Pose(anim.n);
  }

  get length() { return this.clip.dur; }
  get weight() { return this._weight; }
  set weight(w) { this._weight = w; this.fade = null; }
  get normalizedTime() { return this.clip.dur > 0 ? this.time / this.clip.dur : 0; }
  set normalizedTime(n) { this.time = n * this.clip.dur; }

  // AnimationState.AddMixingTransform(t, recursive = true)
  addMixingTransform(nodo, recursivo = true) {
    if (!this.mezcla) this.mezcla = new Set();
    const agregar = (o) => {
      const i = this.anim.indice.get(o.name);
      if (i !== undefined) this.mezcla.add(i);
      if (recursivo) for (const h of o.children) agregar(h);
    };
    agregar(nodo);
  }

  // el tiempo en el clip según el wrapMode
  tiempoClip() {
    const d = this.clip.dur;
    if (d <= 0) return 0;
    const w = this.wrapMode;
    if (w === WRAP_LOOP) return ((this.time % d) + d) % d;
    if (w === WRAP_PINGPONG) { const c = ((this.time % (2 * d)) + 2 * d) % (2 * d); return c > d ? 2 * d - c : c; }
    return Math.min(Math.max(this.time, 0), d);
  }
}

export class AnimacionUnity {
  constructor(anims, raiz) {
    this.anims = anims;
    this.n = anims.huesos.length;
    this.nodos = anims.huesos.map((n) => raiz.getObjectByName(n) || null);
    this.indice = new Map(anims.huesos.map((n, i) => [n, i]));
    this.estados = new Map();
    this.pose = new Pose(this.n);
    this.ref = new Map();         // clip → su primer cuadro (para lo aditivo)
    this.peso = { q: new Float32Array(this.n), p: new Float32Array(this.n), s: new Float32Array(this.n) };
    this.resto = { q: new Float32Array(this.n), p: new Float32Array(this.n), s: new Float32Array(this.n) };
    // por componente: bit en Pose.tiene, acumulador, peso juntado, peso que queda, componentes, campo
    this.comps = [[1, this.pose.q, this.peso.q, this.resto.q, 4, 'q'], [2, this.pose.p, this.peso.p, this.resto.p, 3, 'p'],
      [4, this.pose.s, this.peso.s, this.resto.s, 3, 's']];
  }

  // Animation[nombre] (con AddClip si hace falta): null si el clip no existe
  estado(nombre) {
    let e = this.estados.get(nombre);
    if (!e) {
      const clip = this.anims.clip(nombre);
      if (!clip) return null;
      e = new EstadoAnim(this, nombre, clip);
      this.estados.set(nombre, e);
    }
    return e;
  }

  get isPlaying() { for (const e of this.estados.values()) if (e.enabled) return true; return false; }
  estaSonando(nombre) { const e = this.estados.get(nombre); return !!(e && e.enabled); }

  detenerEstado(e) { e.enabled = false; e.time = 0; e.fade = null; }

  // Animation.Stop() / Stop(nombre): para y rebobina
  stop(nombre) {
    if (nombre === undefined) { for (const e of this.estados.values()) this.detenerEstado(e); return; }
    const e = this.estados.get(nombre);
    if (e) this.detenerEstado(e);
  }

  // Animation.Play(nombre, modo): sin fundido; para los de la misma capa (o todos)
  play(nombre, modo = PLAY_STOP_SAME_LAYER) {
    const e = this.estado(nombre);
    if (!e) return false;
    for (const o of this.estados.values()) {
      if (o !== e && o.enabled && (modo === PLAY_STOP_ALL || o.layer === e.layer)) this.detenerEstado(o);
    }
    if (!e.enabled) e.time = 0;
    e.enabled = true;
    e.weight = 1;
    return true;
  }

  // Animation.CrossFade(nombre, fundido, modo)
  crossFade(nombre, fundido = 0.3, modo = PLAY_STOP_SAME_LAYER) {
    const e = this.estado(nombre);
    if (!e) return;
    if (fundido <= 0) { this.play(nombre, modo); return; }
    for (const o of this.estados.values()) {
      if (o !== e && o.enabled && (modo === PLAY_STOP_ALL || o.layer === e.layer)) o.fade = { objetivo: 0, ritmo: 1 / fundido, parar: true };
    }
    if (!e.enabled) { e.time = 0; e._weight = 0; }
    e.enabled = true;
    e.fade = { objetivo: 1, ritmo: 1 / fundido, parar: false };
  }

  // Animation.Blend(nombre, peso, fundido)
  blend(nombre, peso = 1, fundido = 0.3) {
    const e = this.estado(nombre);
    if (!e) return;
    if (!e.enabled) { e.time = 0; e._weight = 0; e.enabled = true; }
    if (fundido <= 0) { e._weight = peso; e.fade = null; return; }
    e.fade = { objetivo: peso, ritmo: Math.abs(peso - e._weight) / fundido || 1e9, parar: false };
  }

  // Avanza los tiempos y los fundidos (lo que Unity hace antes de muestrear)
  avanzar(dt) {
    for (const e of this.estados.values()) {
      if (!e.enabled) continue;
      if (e.fade) {
        const f = e.fade, d = f.objetivo - e._weight, paso = f.ritmo * dt;
        if (Math.abs(d) <= paso) {
          e._weight = f.objetivo;
          e.fade = null;
          if (f.parar && f.objetivo <= 0) { this.detenerEstado(e); continue; }
        } else e._weight += Math.sign(d) * paso;
      }
      e.time += dt * e.speed;
      const w = e.wrapMode;
      if ((w === 0 || w === WRAP_ONCE) && e.clip.dur >= 0 && e.time >= e.clip.dur && e.speed > 0) this.detenerEstado(e);
    }
  }

  referencia(clip) {
    let r = this.ref.get(clip);
    if (!r) { r = new Pose(this.n); muestrear(clip, 0, r); this.ref.set(clip, r); }
    return r;
  }

  // Muestrea, mezcla y aplica a los huesos
  muestrear() {
    const n = this.n, pose = this.pose, { peso, resto } = this;
    peso.q.fill(0); peso.p.fill(0); peso.s.fill(0);
    resto.q.fill(1); resto.p.fill(1); resto.s.fill(1);
    pose.limpiar();
    pose.q.fill(0); pose.p.fill(0); pose.s.fill(0);
    const activos = [];
    for (const e of this.estados.values()) if (e.enabled && e._weight > 0) activos.push(e);
    if (!activos.length) return;
    for (const e of activos) { e.pose.limpiar(); muestrear(e.clip, e.tiempoClip(), e.pose); }
    const base = activos.filter((e) => e.blendMode !== ADDITIVE);
    const capas = [...new Set(base.map((e) => e.layer))].sort((a, b) => b - a);
    const q = pose.q, p = pose.p, s = pose.s;
    for (const capa of capas) {
      const es = base.filter((e) => e.layer === capa);
      for (let h = 0; h < n; h++) {
        // por componente: rotación (1), posición (2), escala (4)
        for (const [bit, acc, w, r, nc, val] of this.comps) {
          if (r[h] <= 1e-6) continue;
          let suma = 0;
          for (const e of es) if ((e.pose.tiene[h] & bit) && (!e.mezcla || e.mezcla.has(h))) suma += e._weight;
          if (suma <= 0) continue;
          const k = (suma > 1 ? 1 / suma : 1) * r[h];
          for (const e of es) {
            if (!(e.pose.tiene[h] & bit) || (e.mezcla && !e.mezcla.has(h))) continue;
            const ew = e._weight * k, v = e.pose[val], i = h * nc;
            if (bit === 1 && w[h] > 0) {
              // mismo hemisferio que lo acumulado
              const d = acc[i] * v[i] + acc[i + 1] * v[i + 1] + acc[i + 2] * v[i + 2] + acc[i + 3] * v[i + 3];
              const sg = d < 0 ? -1 : 1;
              for (let j = 0; j < 4; j++) acc[i + j] += sg * v[i + j] * ew;
            } else for (let j = 0; j < nc; j++) acc[i + j] += v[i + j] * ew;
            w[h] += ew;
            pose.tiene[h] |= bit;
          }
          r[h] *= 1 - Math.min(1, suma);
        }
      }
    }
    // normalizar lo acumulado
    for (let h = 0; h < n; h++) {
      if (peso.q[h] > 0) {
        const i = h * 4, l = Math.hypot(q[i], q[i + 1], q[i + 2], q[i + 3]) || 1;
        for (let j = 0; j < 4; j++) q[i + j] /= l;
      }
      if (peso.p[h] > 0) for (let j = 0; j < 3; j++) p[h * 3 + j] /= peso.p[h];
      if (peso.s[h] > 0) for (let j = 0; j < 3; j++) s[h * 3 + j] /= peso.s[h];
    }
    // lo que ninguna animación base mueve parte del primer cuadro de la aditiva más baja que lo mueve
    // (Tom cansado tocado: el toque y el cuello caído son aditivos sin nada debajo; partir del hueso
    // como quedó el cuadro anterior acumularía)
    const aditivos = activos.filter((e) => e.blendMode === ADDITIVE).sort((a, b) => a.layer - b.layer);
    if (aditivos.length) {
      for (let h = 0; h < n; h++) {
        for (const [bit, , , , nc, val] of this.comps) {
          if (pose.tiene[h] & bit) continue;
          for (const e of aditivos) {
            if (e.mezcla && !e.mezcla.has(h)) continue;
            const ref = this.referencia(e.clip);
            if (!(ref.tiene[h] & bit)) continue;
            for (let j = 0; j < nc; j++) pose[val][h * nc + j] = ref[val][h * nc + j];
            pose.tiene[h] |= bit;
            break;
          }
        }
      }
      for (const e of aditivos) {
        const ref = this.referencia(e.clip), w = Math.min(1, e._weight), ep = e.pose;
        for (let h = 0; h < n; h++) {
          const t = ep.tiene[h];
          if (!t || (e.mezcla && !e.mezcla.has(h))) continue;
          if ((t & 1) && (ref.tiene[h] & 1)) {
            // delta = ref⁻¹ · actual; q ← q · slerp(1, delta, w)
            const i = h * 4;
            const rx = -ref.q[i], ry = -ref.q[i + 1], rz = -ref.q[i + 2], rw = ref.q[i + 3];
            const cx = ep.q[i], cy = ep.q[i + 1], cz = ep.q[i + 2], cw = ep.q[i + 3];
            let dx = rw * cx + rx * cw + ry * cz - rz * cy;
            let dy = rw * cy - rx * cz + ry * cw + rz * cx;
            let dz = rw * cz + rx * cy - ry * cx + rz * cw;
            let dw = rw * cw - rx * cx - ry * cy - rz * cz;
            if (dw < 0) { dx = -dx; dy = -dy; dz = -dz; dw = -dw; }
            dx *= w; dy *= w; dz *= w; dw = 1 + (dw - 1) * w;
            const l = Math.hypot(dx, dy, dz, dw) || 1;
            dx /= l; dy /= l; dz /= l; dw /= l;
            const ax = q[i], ay = q[i + 1], az = q[i + 2], aw = q[i + 3];
            q[i] = aw * dx + ax * dw + ay * dz - az * dy;
            q[i + 1] = aw * dy - ax * dz + ay * dw + az * dx;
            q[i + 2] = aw * dz + ax * dy - ay * dx + az * dw;
            q[i + 3] = aw * dw - ax * dx - ay * dy - az * dz;
            pose.tiene[h] |= 1;
          }
          if ((t & 2) && (ref.tiene[h] & 2)) { for (let j = 0; j < 3; j++) p[h * 3 + j] += (ep.p[h * 3 + j] - ref.p[h * 3 + j]) * w; pose.tiene[h] |= 2; }
          if ((t & 4) && (ref.tiene[h] & 4)) { for (let j = 0; j < 3; j++) s[h * 3 + j] += (ep.s[h * 3 + j] - ref.s[h * 3 + j]) * w; pose.tiene[h] |= 4; }
        }
      }
    }
    this.aplicar(pose);
  }

  update(dt) {
    this.avanzar(dt);
    this.muestrear();
  }

  // ¿escribió la animación ese hueso en este cuadro? (bit: 1 rotación, 2 posición, 4 escala)
  escribio(nombre, bit) {
    const i = this.indice.get(nombre);
    return i !== undefined && !!(this.pose.tiene[i] & bit);
  }

  aplicar(pose) { Reproductor.prototype.aplicar.call(this, pose); }
}

// Reproduce clips en un esqueleto (los huesos por nombre), con fundidos como CrossFade de Unity:
// el clip que se va sigue andando mientras baja su peso.
export class Reproductor {
  constructor(anims, raiz) {
    this.anims = anims;
    this.nodos = anims.huesos.map((n) => raiz.getObjectByName(n) || null);
    this.pose = new Pose(anims.huesos.length);
    this.otra = new Pose(anims.huesos.length);
    this.capas = [];        // [{clip, t, vel, bucle, peso, objetivo, ritmo, alTerminar, eventos}]
    this.alEvento = null;   // (clip, evento) para los AnimationEvent de los clips
  }

  // Lo que suena ahora (la capa de arriba).
  get actual() { return this.capas.length ? this.capas[this.capas.length - 1] : null; }

  play(nombre, op = {}) {
    const clip = this.anims.clip(nombre);
    if (!clip) { console.warn('no hay clip', nombre); return null; }
    const capa = {
      clip, t: op.desde || 0, vel: op.velocidad ?? 1, bucle: op.bucle ?? (clip.wrap === 2),
      peso: op.fundido ? 0 : 1, ritmo: op.fundido ? 1 / op.fundido : 0, alTerminar: op.alTerminar || null,
      sig: 0, terminado: false,
    };
    if (!op.fundido) this.capas = [];
    else for (const c of this.capas) c.ritmoSalida = 1 / op.fundido;
    this.capas.push(capa);
    return capa;
  }

  detener() { this.capas = []; }

  update(dt) {
    if (!this.capas.length) return;
    for (const c of this.capas) {
      const antes = c.t;
      c.t += dt * c.vel;
      if (c.ritmo) { c.peso = Math.min(1, c.peso + dt * c.ritmo); if (c.peso >= 1) c.ritmo = 0; }
      if (c.ritmoSalida) c.salida = Math.min(1, (c.salida || 0) + dt * c.ritmoSalida);
      // eventos del clip (AnimationEvent) entre antes y ahora
      const ev = c.clip.eventos;
      if (ev.length && this.alEvento) {
        const d = c.clip.dur || 1;
        for (const e of ev) {
          const te = e[0];
          if (c.bucle) {
            const v0 = Math.floor(antes / d), v1 = Math.floor(c.t / d);
            for (let v = v0; v <= v1; v++) { const x = v * d + te; if (x > antes && x <= c.t) this.alEvento(c.clip, e); }
          } else if (te > antes && te <= c.t) this.alEvento(c.clip, e);
          else if (antes === 0 && te === 0 && c.t > 0) this.alEvento(c.clip, e);
        }
      }
      if (!c.bucle && !c.terminado && c.t >= c.clip.dur) {
        c.terminado = true;
        if (c.alTerminar) { const f = c.alTerminar; c.alTerminar = null; f(c); }
      }
    }
    // las que terminaron de irse
    this.capas = this.capas.filter((c) => !(c.salida >= 1));
    // la pose: la primera capa entera y cada una de arriba mezclada con su peso
    this.pose.limpiar();
    let primera = true;
    for (const c of this.capas) {
      const w = c.peso * (1 - (c.salida || 0) * 0);  // la de abajo se tapa con la de arriba
      if (primera) { muestrear(c.clip, tiempoEn(c.clip, c.t, c.bucle), this.pose); primera = false; continue; }
      this.otra.limpiar();
      muestrear(c.clip, tiempoEn(c.clip, c.t, c.bucle), this.otra);
      mezclar(this.pose, this.otra, w);
    }
    this.aplicar(this.pose);
    if (this.despues) {
      const a = this.actual;
      this.despues(a ? a.clip.nombre : null, a && a.clip.dur ? tiempoEn(a.clip, a.t, a.bucle) / a.clip.dur : 0, dt);
    }
  }

  aplicar(pose) {
    for (let h = 0; h < pose.n; h++) {
      const t = pose.tiene[h], o = this.nodos[h];
      if (!t || !o) continue;
      if (t & 1) o.quaternion.set(pose.q[h * 4], pose.q[h * 4 + 1], pose.q[h * 4 + 2], pose.q[h * 4 + 3]);
      if (t & 2) o.position.set(pose.p[h * 3], pose.p[h * 3 + 1], pose.p[h * 3 + 2]);
      if (t & 4) o.scale.set(pose.s[h * 3], pose.s[h * 3 + 1], pose.s[h * 3 + 2]);
    }
  }
}
