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
