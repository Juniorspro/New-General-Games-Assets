// Contra qué se choca: troncos, rocas, troncos caídos, la cabaña.
//
// TODO ES UN CÍRCULO, UNA CÁPSULA O UNA CAJA EN EL PLANO. El caminante no
// salta, así que la altura no importa: alcanza con empujarlo afuera en x,z.
// Empujar (en vez de frenar) es lo que hace que al rozar un tronco se deslice
// por el costado en lugar de quedarse pegado.
const CELDA = 8;

export class Colisiones {
  constructor() { this.g = new Map(); this.n = 0; }
  clave(i, j) { return i * 100003 + j; }
  poner(forma, x0, z0, x1, z1) {
    const i0 = Math.floor(x0 / CELDA), i1 = Math.floor(x1 / CELDA);
    const j0 = Math.floor(z0 / CELDA), j1 = Math.floor(z1 / CELDA);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this.clave(i, j);
      if (!this.g.has(k)) this.g.set(k, []);
      this.g.get(k).push(forma);
    }
    this.n++;
  }
  circulo(x, z, r) { this.poner({ t: 0, x, z, r }, x - r, z - r, x + r, z + r); }
  capsula(x0, z0, x1, z1, r) {
    this.poner({ t: 1, x0, z0, x1, z1, r }, Math.min(x0, x1) - r, Math.min(z0, z1) - r, Math.max(x0, x1) + r, Math.max(z0, z1) + r);
  }
  /** Caja girada: centro, medio ancho y medio largo, ángulo en el plano. */
  caja(x, z, hx, hz, ang) {
    const R = Math.hypot(hx, hz);
    this.poner({ t: 2, x, z, hx, hz, c: Math.cos(ang), s: Math.sin(ang) }, x - R, z - R, x + R, z + R);
  }

  /** Saca al círculo (x,z,r) de todo lo que pisa. Devuelve el punto corregido
   *  y si hubo contacto. Tres pasadas: en un rincón entre dos troncos, salir
   *  de uno te mete en el otro, y una sola pasada deja al caminante adentro. */
  resolver(p, r, extra) {
    let toco = false;
    for (let pasada = 0; pasada < 3; pasada++) {
      let movio = false;
      const lista = this.g.get(this.clave(Math.floor(p.x / CELDA), Math.floor(p.z / CELDA))) || [];
      for (const f of lista) if (this.empujar(f, p, r)) movio = toco = true;
      if (extra) extra(p, r, (f) => { if (this.empujar(f, p, r)) movio = toco = true; });
      if (!movio) break;
    }
    return toco;
  }

  empujar(f, p, r) {
    if (f.t === 0) {
      const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz), m = f.r + r;
      if (d >= m || d < 1e-6) return false;
      p.x = f.x + dx / d * m; p.z = f.z + dz / d * m;
      return true;
    }
    if (f.t === 1) {
      const vx = f.x1 - f.x0, vz = f.z1 - f.z0, l2 = vx * vx + vz * vz || 1;
      const u = Math.max(0, Math.min(1, ((p.x - f.x0) * vx + (p.z - f.z0) * vz) / l2));
      const cx = f.x0 + vx * u, cz = f.z0 + vz * u;
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), m = f.r + r;
      if (d >= m || d < 1e-6) return false;
      p.x = cx + dx / d * m; p.z = cz + dz / d * m;
      return true;
    }
    // caja: al sistema de la caja, el punto más cercano, y de vuelta
    const dx = p.x - f.x, dz = p.z - f.z;
    const lx = dx * f.c + dz * f.s, lz = -dx * f.s + dz * f.c;
    const qx = Math.max(-f.hx, Math.min(f.hx, lx)), qz = Math.max(-f.hz, Math.min(f.hz, lz));
    const ex = lx - qx, ez = lz - qz, d = Math.hypot(ex, ez);
    if (d >= r) return false;
    let sx, sz;
    if (d < 1e-6) {
      // adentro de la caja: se sale por el lado más cercano
      sx = lx; sz = lz;
      if (f.hx - Math.abs(lx) < f.hz - Math.abs(lz)) sx = (Math.sign(lx) || 1) * (f.hx + r);
      else sz = (Math.sign(lz) || 1) * (f.hz + r);
    } else {
      sx = qx + ex / d * r; sz = qz + ez / d * r;
    }
    p.x = f.x + sx * f.c - sz * f.s; p.z = f.z + sx * f.s + sz * f.c;
    return true;
  }
}
