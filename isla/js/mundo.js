// Arma la isla entera a partir de una semilla: terreno, mar, cielo, palmeras,
// rocas, la choza, el muelle y la boca de la mina. Mismo número, misma isla.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry, rango, fbm2, hash2 } from './azar.js';
import { Terreno, MITAD } from './terreno.js';
import { crearAgua } from './agua.js';
import { Vegetacion } from './vegetacion.js';
import { Rocas } from './rocas.js';
import { Pasto } from './pasto.js';
import { materiales, choza, muelle, bocaMina } from './estructuras.js';

const COLORES_VETA = { amatista: 0xb46cff, cuarzo: 0xf4f7ff, esmeralda: 0x3fe07a, citrino: 0xffd23a, aguamarina: 0x6fe8ff };

export class Mundo {
  constructor(escena, tex, semilla, calidad) {
    this.escena = escena;
    this.semilla = semilla;
    const T = (this.terreno = new Terreno(semilla, tex));
    escena.add(T.grupo);
    const r = mulberry(semilla ^ 0x9e3779b9);
    const M = (this.M = materiales(tex));

    // ── la choza y el muelle, sobre la arena frente a la laguna ──
    const L = T.laguna;
    const haciaCentro = new THREE.Vector2(-L.x, -L.z).normalize();
    let lugar = null;
    for (let d = 16; d < 40 && !lugar; d += 1) {
      for (let a = -0.9; a <= 0.9 && !lugar; a += 0.15) {
        const ca = Math.cos(a), sa = Math.sin(a);
        const dx = haciaCentro.x * ca - haciaCentro.y * sa, dz = haciaCentro.x * sa + haciaCentro.y * ca;
        const x = L.x + dx * d, z = L.z + dz * d;
        const h = T.altura(x, z);
        if (h > 0.7 && h < 1.8 && T.normal(x, z).y > 0.97) lugar = { x, z, h, dx, dz };
      }
    }
    if (!lugar) lugar = { x: L.x * 0.6, z: L.z * 0.6, h: T.altura(L.x * 0.6, L.z * 0.6), dx: haciaCentro.x, dz: haciaCentro.y };
    // aplanar donde va la choza
    for (let i = 0; i < 6; i++) T.pincel(lugar.x, lugar.z, 5.5, 0.6, 'aplanar', lugar.h);
    T.actualizar();
    T.base.set(T.alturas);
    const Ch = choza(M, Math.round(lugar.x), lugar.h, Math.round(lugar.z));
    escena.add(Ch.grupo);
    this.choza = Ch;
    // el muelle sale hacia la laguna, por el eje más cercano
    const hx = L.x - lugar.x, hz = L.z - lugar.z;
    const dir = Math.abs(hx) > Math.abs(hz) ? (hx > 0 ? 'x+' : 'x-') : (hz > 0 ? 'z+' : 'z-');
    const ejeX = dir[0] === 'x', s = dir[1] === '+' ? 1 : -1;
    const mx = Math.round(lugar.x) + (ejeX ? s * 2.6 : 0), mz = Math.round(lugar.z) + (ejeX ? 0 : s * 2.6);
    const Mu = muelle(M, mx, lugar.h + 0.45, mz, 16, dir);
    escena.add(Mu.grupo);
    this.muelle = Mu;
    // el jugador aparece en la arena, al costado de la choza (fuera del alero)
    // y del lado de la cámara del menú: así el vuelo de entrada es corto
    const D = new THREE.Vector3(ejeX ? s : 0, 0, ejeX ? 0 : s), P = new THREE.Vector3(-D.z, 0, D.x);
    this.spawn = new THREE.Vector3(Math.round(lugar.x), 0, Math.round(lugar.z)).addScaledVector(P, -5.8).addScaledVector(D, 0.6);
    this.spawn.y = T.altura(this.spawn.x, this.spawn.z);

    // ── la mina: en la ladera del cerro que mira al centro de la isla ──
    const C = T.cerro;
    const ang = Math.atan2(-C.x, -C.z);
    let bx = C.x, bz = C.z;
    for (let d = 4; d < 30; d += 0.5) {
      bx = C.x + Math.sin(ang) * d; bz = C.z + Math.cos(ang) * d;
      if (T.altura(bx, bz) < 6.2) break;
    }
    for (let i = 0; i < 4; i++) T.pincel(bx + Math.sin(ang) * 1.6, bz + Math.cos(ang) * 1.6, 3.2, 0.7, 'aplanar', T.altura(bx, bz));
    T.actualizar();
    T.base.set(T.alturas);
    const B = bocaMina(M, bx, T.altura(bx, bz), bz, ang);
    escena.add(B.grupo);
    this.mina = B;

    // ── vegetación ──
    const libre = (x, z, rad) => {
      const d1 = Math.hypot(x - Ch.grupo.position.x, z - Ch.grupo.position.z);
      const d2 = Math.hypot(x - bx, z - bz);
      const ex = Mu.pisos[0];
      const enMuelle = x > ex.x0 - rad && x < ex.x1 + rad && z > ex.z0 - rad && z < ex.z1 + rad;
      return d1 > 5 + rad && d2 > 4 + rad && !enMuelle;
    };
    this.libre = libre;
    const palmeras = [], arbustos = [], helechos = [];
    for (let i = 0; i < 12000 && palmeras.length < 230; i++) {
      const x = rango(r, -115, 115), z = rango(r, -115, 115);
      const h = T.altura(x, z);
      if (h < 0.45 || h > 9) continue;
      const pw = T.pasto(x, z);
      const playa = h < 2.2 && pw < 0.5;
      const prob = playa ? 0.5 : 0.08 + 0.25 * fbm2(x * 0.03, z * 0.03, 71, 2);
      if (r() > prob) continue;
      if (!libre(x, z, 1.5)) continue;
      if (palmeras.some((p) => Math.hypot(p.x - x, p.z - z) < 3.0)) continue;
      palmeras.push({ x, z, y: h });
    }
    for (let i = 0; i < 16000 && arbustos.length < 420; i++) {
      const x = rango(r, -110, 110), z = rango(r, -110, 110);
      const h = T.altura(x, z);
      if (h < 1.2 || T.pasto(x, z) < 0.6) continue;
      if (fbm2(x * 0.05, z * 0.05, 91, 2) < 0.52 && r() > 0.2) continue;
      if (!libre(x, z, 1)) continue;
      arbustos.push({ x, z, y: h });
    }
    for (let i = 0; i < 8000 && helechos.length < 140; i++) {
      const x = rango(r, -110, 110), z = rango(r, -110, 110);
      const h = T.altura(x, z);
      if (h < 1 || T.pasto(x, z) < 0.5 || !libre(x, z, 1)) continue;
      if (palmeras.some((p) => Math.hypot(p.x - x, p.z - z) < 4) || r() < 0.4) helechos.push({ x, z, y: h });
    }
    this.veg = new Vegetacion(tex, palmeras, arbustos, helechos);
    escena.add(this.veg.grupo);

    // ── rocas ──
    const decor = [], minables = [];
    for (let i = 0; i < 6000 && decor.length < 46; i++) {
      const x = rango(r, -120, 120), z = rango(r, -120, 120);
      const h = T.altura(x, z);
      const agua = h < 0.2 && h > -3.5;
      if (!(agua || (h > 0.2 && h < 2 && r() < 0.35))) continue;
      if (!libre(x, z, 3)) continue;
      // la playa de la choza queda despejada: ahí empieza el juego y mira el menú
      if (Math.hypot(x - Ch.grupo.position.x, z - Ch.grupo.position.z) < 18) continue;
      decor.push({ x, z, y: h, r: agua ? rango(r, 1.2, 3.4) : rango(r, 0.8, 2.2) });
    }
    const vetas = Object.keys(COLORES_VETA);
    for (let i = 0; i < 9000 && minables.length < 40; i++) {
      const x = rango(r, -105, 105), z = rango(r, -105, 105);
      const h = T.altura(x, z);
      if (h < 0.6 || h > 12 || T.normal(x, z).y < 0.9) continue;
      if (!libre(x, z, 2)) continue;
      if (minables.some((m) => Math.hypot(m.x - x, m.z - z) < 7)) continue;
      const cercaCerro = Math.hypot(x - C.x, z - C.z) < 30;
      const veta = cercaCerro && r() < 0.45 ? vetas[Math.floor(r() * vetas.length)] : null;
      minables.push({ x, z, y: h, r: rango(r, 0.9, 1.5), veta, colorVeta: veta ? COLORES_VETA[veta] : 0 });
    }
    // Al menos seis rocas con veta, las más cercanas al cerro: con la semilla
    // de siempre el azar no daba ninguna, y arriba no aparecía nunca una gema.
    const conVeta = minables.filter((m) => m.veta).length;
    if (conVeta < 6) {
      const orden = minables.filter((m) => !m.veta).sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z));
      for (const m of orden.slice(0, 6 - conVeta)) { m.veta = vetas[Math.floor(r() * vetas.length)]; m.colorVeta = COLORES_VETA[m.veta]; }
    }
    this.rocas = new Rocas(tex, decor, minables);
    escena.add(this.rocas.grupo);

    // ── pasto (el agua se arma con el cielo: necesita sus colores) ──
    this.agua = null;
    this.pasto = new Pasto(T, tex, calidad.pasto);

    // pisos y obstáculos fijos
    this.pisos = [...Ch.pisos, ...Mu.pisos];
    this.obstFijos = [...Ch.obst];
    this.bloques = null;   // lo enchufa construir.js
  }

  // El agua necesita los uniforms del cielo: se arma después de él.
  armarAgua(cielo) {
    this.agua = crearAgua(this.terreno, cielo);
    this.escena.add(this.agua);
    // sin pasto adentro de la choza, del muelle ni de los bloques puestos
    this.pasto.bloqueos = (x, z) => this.dentroDePiso(x, z, 0.3) || !!(this.bloques && this.bloques.columnas.has(`${Math.floor(x)},${Math.floor(z)}`));
    this.pasto.todo();
    this.escena.add(this.pasto.grupo);
  }

  dentroDePiso(x, z, margen = 0) {
    for (const p of this.pisos) if (x > p.x0 - margen && x < p.x1 + margen && z > p.z0 - margen && z < p.z1 + margen) return true;
    return false;
  }

  // El piso debajo de los pies: el terreno o un piso construido, el más alto
  // que no esté por encima del escalón.
  suelo(x, z, yPies, escalon = 0.55) {
    let s = this.terreno.altura(x, z);
    for (const p of this.pisos) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && p.y <= yPies + escalon && p.y > s) s = p.y;
    if (this.bloques) s = Math.max(s, this.bloques.suelo(x, z, yPies, escalon));
    return s;
  }

  techo(x, z, yCabeza) {
    return this.bloques ? this.bloques.techo(x, z, yCabeza) : Infinity;
  }

  obstaculos(x, z, radio) {
    const res = [];
    for (const o of this.obstFijos) if (Math.abs(o.x - x) < radio + o.r + 1 && Math.abs(o.z - z) < radio + o.r + 1) res.push(o);
    res.push(...this.veg.obstaculos(x, z, radio), ...this.rocas.obstaculos(x, z, radio));
    return res;
  }
}

export { COLORES_VETA, hash2 };
