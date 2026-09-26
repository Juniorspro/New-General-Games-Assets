// Piso, mesas y paredes a partir de los puntos 3D del SLAM, como los planos
// de ARCore: geometría, sin entrenar nada.
//
// La clave es que el mundo de XRSLAM tiene la gravedad bien puesta (z hacia
// arriba). Entonces:
//   - un plano horizontal (piso, mesa) es un montón de puntos a la MISMA
//     ALTURA: se buscan picos en el histograma de alturas y cada pico se
//     parte en superficies conectadas;
//   - una pared es un plano con la normal HORIZONTAL: RANSAC con esa
//     restricción (2 puntos alcanzan para proponer uno), y se corta en
//     tramos donde de verdad hay puntos.
//
// XRSLAM sólo entrega los puntos de su ventana actual (unos cientos): acá se
// acumulan en una grilla de vóxeles para que el mapa crezca al recorrer.
//
// Todo en el marco del mundo de XRSLAM (metros, z arriba).
//
// Límite, el mismo que ARCore sin su API de profundidad: una pared lisa sin
// textura no da puntos, y sin puntos no hay plano.

export class MapaPlanos {
  constructor({ voxel = 0.04, maxVoxeles = 40000 } = {}) {
    this.v = voxel; this.max = maxVoxeles;
    this.celdas = new Map();   // clave → {x, y, z, n, t}
    this.planos = [];
    this.proximoId = 1;
  }

  /** Puntos [x, y, z, x, y, z, …] del SLAM en este momento. */
  agregar(pts, t = 0) {
    const v = this.v;
    for (let i = 0; i + 2 < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], z = pts[i + 2];
      if (!Number.isFinite(x + y + z)) continue;
      const k = `${Math.round(x / v)},${Math.round(y / v)},${Math.round(z / v)}`;
      const c = this.celdas.get(k);
      if (c) { c.x += (x - c.x) / (c.n + 1); c.y += (y - c.y) / (c.n + 1); c.z += (z - c.z) / (c.n + 1); c.n = Math.min(c.n + 1, 50); c.t = t; }
      else this.celdas.set(k, { x, y, z, n: 1, t });
    }
    if (this.celdas.size > this.max) {
      // Se van los vistos una sola vez y hace más tiempo.
      const orden = [...this.celdas.entries()].sort((a, b) => (a[1].n - b[1].n) || (a[1].t - b[1].t));
      for (let i = 0; i < this.celdas.size - this.max * 0.9; i++) this.celdas.delete(orden[i][0]);
    }
  }

  /** Recalcula los planos. cam: posición de la cámara (para saber cuál es el piso). */
  detectar(cam = null, opc = {}) {
    const { tol = 0.03, minPuntosH = 15, minPuntosV = 25, minArea = 0.08 } = opc;
    // Sólo celdas vistas 2+ veces: un punto visto una vez suele ser ruido.
    const todos = [...this.celdas.values()].filter((c) => c.n >= 2).map((c) => [c.x, c.y, c.z]);
    // La normal de cada punto (con sus vecinos a menos de 35 cm; el mapa es
    // ralo, ~30 puntos por m², y con 15 cm casi nadie tenía vecinos): sin esto,
    // los puntos de una pared a una misma altura parecen una mesa. Con EuRoC
    // salían decenas de "mesas" de 0,3 a 1,9 m que eran franjas de pared.
    const { horizontales, verticales, diag } = clasificarPorNormal(todos, 0.35, opc.planaridad ?? 0.5);
    this.diag = { ...diag, horizontales: horizontales.length, verticales: verticales.length, total: todos.length };
    const pts = horizontales;
    const usado = new Uint8Array(pts.length);
    const nuevos = [];

    // ── horizontales: picos del histograma de alturas ──
    const bin = 0.02, hist = new Map();
    for (const p of pts) { const b = Math.round(p[2] / bin); hist.set(b, (hist.get(b) || 0) + 1); }
    const suav = (b) => (hist.get(b - 1) || 0) + (hist.get(b) || 0) + (hist.get(b + 1) || 0);
    const picos = [...hist.keys()].filter((b) => suav(b) >= minPuntosH && suav(b) >= suav(b - 1) && suav(b) >= suav(b + 1))
      .sort((a, b) => suav(b) - suav(a));
    for (const b of picos) {
      const z0 = b * bin;
      const idx = [];
      for (let i = 0; i < pts.length; i++) if (!usado[i] && Math.abs(pts[i][2] - z0) < tol) idx.push(i);
      if (idx.length < minPuntosH) continue;
      for (const grupo of agrupar(idx.map((i) => pts[i]), idx, 0.25)) {
        if (grupo.length < minPuntosH) continue;
        const zs = grupo.map((i) => pts[i][2]), zm = zs.reduce((a, c) => a + c, 0) / zs.length;
        const casco = cascoConvexo(grupo.map((i) => [pts[i][0], pts[i][1]]));
        const area = areaPoligono(casco);
        // Una superficie, no una franja: el ancho menor tiene que pasar de 15 cm.
        if (area < minArea || anchoMenor(grupo.map((i) => pts[i])) < 0.15) continue;
        for (const i of grupo) usado[i] = 1;
        nuevos.push({ tipo: "horizontal", normal: [0, 0, 1], altura: zm, poligono: casco.map(([x, y]) => [x, y, zm]), puntos: grupo.length, area });
      }
    }

    // ── paredes: RANSAC de planos verticales sobre lo que queda ──
    let resto = verticales.slice();
    let semilla = 1234567;
    const azar = () => ((semilla = (semilla * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let pared = 0; pared < 10 && resto.length >= minPuntosV; pared++) {
      let mejor = null;
      for (let it = 0; it < 400; it++) {
        const a = resto[Math.floor(azar() * resto.length)], b = resto[Math.floor(azar() * resto.length)];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 0.2 || L > 4) continue;
        const n = [-dy / L, dx / L], d = -(n[0] * a[0] + n[1] * a[1]);
        let cnt = 0;
        for (const p of resto) if (Math.abs(n[0] * p[0] + n[1] * p[1] + d) < tol) cnt++;
        if (!mejor || cnt > mejor.cnt) mejor = { n, d, cnt };
      }
      if (!mejor || mejor.cnt < minPuntosV) break;
      // Afinado: la recta que mejor pasa por los inliers (en planta).
      let inl = resto.filter((p) => Math.abs(mejor.n[0] * p[0] + mejor.n[1] * p[1] + mejor.d) < tol);
      const ajuste = rectaPCA(inl);
      inl = resto.filter((p) => Math.abs(ajuste.n[0] * p[0] + ajuste.n[1] * p[1] + ajuste.d) < tol);
      const u = [-ajuste.n[1], ajuste.n[0]];
      // Cortar en tramos: huecos de más de 0,6 m a lo largo de la pared.
      const orden = inl.map((p) => ({ p, s: u[0] * p[0] + u[1] * p[1] })).sort((a, b) => a.s - b.s);
      let tramo = [];
      const cerrar = () => {
        if (tramo.length >= minPuntosV) {
          const s0 = tramo[0].s, s1 = tramo[tramo.length - 1].s;
          const zs = tramo.map((q) => q.p[2]).sort((a, b) => a - b);
          const z0 = zs[Math.floor(zs.length * 0.02)], z1 = zs[Math.floor(zs.length * 0.98)];
          if (s1 - s0 >= 0.4 && z1 - z0 >= 0.25) {
            const base = [-ajuste.n[0] * ajuste.d, -ajuste.n[1] * ajuste.d];   // el punto de la recta más cerca del origen
            const en = (s, z) => [base[0] + u[0] * s, base[1] + u[1] * s, z];
            nuevos.push({ tipo: "pared", normal: [ajuste.n[0], ajuste.n[1], 0], d: ajuste.d, s0, s1, z0, z1,
              poligono: [en(s0, z0), en(s1, z0), en(s1, z1), en(s0, z1)], puntos: tramo.length, area: (s1 - s0) * (z1 - z0) });
          }
        }
        tramo = [];
      };
      for (let i = 0; i < orden.length; i++) { if (i && orden[i].s - orden[i - 1].s > 0.6) cerrar(); tramo.push(orden[i]); }
      cerrar();
      const fuera = new Set(inl);
      resto = resto.filter((p) => !fuera.has(p));
    }

    // ── la misma pared en varios pedazos (la deriva del mapa la desdobla):
    // misma orientación, a menos de 15 cm y seguidos → una sola ──
    const paredes = nuevos.filter((p) => p.tipo === "pared").sort((a, b) => b.puntos - a.puntos);
    const unidas = [];
    for (const p of paredes) {
      const q = unidas.find((u) => {
        const c = u.normal[0] * p.normal[0] + u.normal[1] * p.normal[1];
        if (Math.abs(c) < 0.97) return false;
        const dp = c > 0 ? p.d : -p.d;                        // la d de p con la normal de u
        const e = [-u.normal[1], u.normal[0]];               // la dirección de u a lo largo
        const sp = [...p.poligono.slice(0, 2).map((v) => e[0] * v[0] + e[1] * v[1])].sort((a, b) => a - b);
        return Math.abs(dp - u.d) < 0.15 && sp[0] < u.s1 + 0.8 && sp[1] > u.s0 - 0.8;
      });
      if (!q) { unidas.push({ ...p }); continue; }
      const e = [-q.normal[1], q.normal[0]];
      const sp = p.poligono.map((v) => e[0] * v[0] + e[1] * v[1]);
      q.s0 = Math.min(q.s0, ...sp); q.s1 = Math.max(q.s1, ...sp);
      q.z0 = Math.min(q.z0, p.z0); q.z1 = Math.max(q.z1, p.z1);
      q.puntos += p.puntos;
      const base = [-q.normal[0] * q.d, -q.normal[1] * q.d], en = (s, z) => [base[0] + e[0] * s, base[1] + e[1] * s, z];
      q.poligono = [en(q.s0, q.z0), en(q.s1, q.z0), en(q.s1, q.z1), en(q.s0, q.z1)];
      q.area = (q.s1 - q.s0) * (q.z1 - q.z0);
    }
    nuevos.splice(0, nuevos.length, ...nuevos.filter((p) => p.tipo !== "pared"), ...unidas);

    // ── el piso: la altura del horizontal grande más bajo (debajo de la
    // cámara); todos los pedazos a esa altura (±6 cm) son piso ──
    const hs = nuevos.filter((p) => p.tipo === "horizontal" && p.area >= 0.5 && (!cam || p.altura < cam[2] - 0.4));
    if (hs.length) {
      const zPiso = Math.min(...hs.map((p) => p.altura));
      for (const p of nuevos) if (p.tipo === "horizontal" && Math.abs(p.altura - zPiso) < 0.06) p.tipo = "piso";
      this.alturaPiso = zPiso;
    }

    // Mismo id para el "mismo" plano que la vez anterior (así el dibujo no parpadea).
    for (const p of nuevos) {
      const c = centro(p.poligono);
      const antes = this.planos.find((q) => (q.tipo === p.tipo || (q.tipo !== "pared" && p.tipo !== "pared")) &&
        Math.abs(q.normal[0] * p.normal[0] + q.normal[1] * p.normal[1] + q.normal[2] * p.normal[2]) > 0.95 &&
        Math.hypot(...centro(q.poligono).map((v, i) => v - c[i])) < 1.0 && !q._tomado);
      if (antes) antes._tomado = true;
      p.id = antes ? antes.id : this.proximoId++;
    }
    this.planos = nuevos;
    return nuevos;
  }

  /** Cuántos puntos tiene el mapa acumulado. */
  get tamano() { return this.celdas.size; }
}

// Normal de cada punto por PCA de sus vecinos: separa los que están sobre
// una superficie horizontal (normal ≈ z) de los que están sobre una vertical.
function clasificarPorNormal(pts, radio, planaridad = 0.5) {
  const cel = new Map(), clave = (x, y, z) => `${Math.floor(x / radio)},${Math.floor(y / radio)},${Math.floor(z / radio)}`;
  pts.forEach((p, i) => { const k = clave(...p); if (!cel.has(k)) cel.set(k, []); cel.get(k).push(i); });
  const horizontales = [], verticales = [], r2 = radio * radio;
  const diag = { pocos: 0, noPlano: 0, inclinado: 0 };
  for (const p of pts) {
    const cx = Math.floor(p[0] / radio), cy = Math.floor(p[1] / radio), cz = Math.floor(p[2] / radio);
    let n = 0, mx = 0, my = 0, mz = 0;
    const vec = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = cel.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!l) continue;
      for (const j of l) { const q = pts[j], ex = q[0] - p[0], ey = q[1] - p[1], ez = q[2] - p[2]; if (ex * ex + ey * ey + ez * ez < r2) { vec.push(q); mx += q[0]; my += q[1]; mz += q[2]; n++; } }
    }
    if (n < 8) { diag.pocos++; continue; }
    mx /= n; my /= n; mz /= n;
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const q of vec) { const d = [q[0] - mx, q[1] - my, q[2] - mz]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b] / n; }
    const { valores, vectores } = eigen3(C);   // de menor a mayor
    // Laxo a propósito: el mapa tiene ~7 cm de espesor y para separar piso de
    // pared alcanza con una normal aproximada.
    if (valores[0] > planaridad * valores[1]) { diag.noPlano++; continue; }
    const nz = Math.abs(vectores[0][2]);
    if (nz > 0.85) horizontales.push(p); else if (nz < 0.35) verticales.push(p); else diag.inclinado++;
  }
  return { horizontales, verticales, diag };
}

// Autovalores/autovectores de una simétrica 3×3 (Jacobi), de menor a mayor.
function eigen3(A) {
  const a = A.map((f) => f.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let barrido = 0; barrido < 12; barrido++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-14) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
  }
  const orden = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]);
  return { valores: orden.map((i) => a[i][i]), vectores: orden.map((i) => [V[0][i], V[1][i], V[2][i]]) };
}

// El ancho menor de un grupo en planta (2·desvío en el eje de menos dispersión).
function anchoMenor(pts) {
  let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= pts.length; my /= pts.length;
  let sxx = 0, sxy = 0, syy = 0; for (const p of pts) { const x = p[0] - mx, y = p[1] - my; sxx += x * x; sxy += x * y; syy += y * y; }
  sxx /= pts.length; sxy /= pts.length; syy /= pts.length;
  const l = (sxx + syy) / 2 - Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
  return 2 * Math.sqrt(Math.max(0, l));
}

// Grupos conectados en planta (x, y): celdas de `celda` m, vecinos de 8.
function agrupar(ptsGrupo, idx, celda) {
  const cel = new Map();
  ptsGrupo.forEach((p, j) => { const k = `${Math.floor(p[0] / celda)},${Math.floor(p[1] / celda)}`; if (!cel.has(k)) cel.set(k, []); cel.get(k).push(idx[j]); });
  const visto = new Set(), grupos = [];
  for (const k of cel.keys()) {
    if (visto.has(k)) continue;
    const g = [], cola = [k]; visto.add(k);
    while (cola.length) {
      const c = cola.pop(); g.push(...cel.get(c));
      const [cx, cy] = c.split(",").map(Number);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const v = `${cx + dx},${cy + dy}`;
        if (cel.has(v) && !visto.has(v)) { visto.add(v); cola.push(v); }
      }
    }
    grupos.push(g);
  }
  return grupos;
}

function cascoConvexo(p) {
  const q = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (q.length < 3) return q;
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const ab = [], ar = [];
  for (const x of q) { while (ab.length >= 2 && cruz(ab[ab.length - 2], ab[ab.length - 1], x) <= 0) ab.pop(); ab.push(x); }
  for (let i = q.length - 1; i >= 0; i--) { const x = q[i]; while (ar.length >= 2 && cruz(ar[ar.length - 2], ar[ar.length - 1], x) <= 0) ar.pop(); ar.push(x); }
  ab.pop(); ar.pop();
  return ab.concat(ar);
}
function areaPoligono(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
function centro(pol) { const c = [0, 0, 0]; for (const p of pol) for (let i = 0; i < 3; i++) c[i] += p[i] / pol.length; return c; }
function rectaPCA(pts) {
  let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= pts.length; my /= pts.length;
  let sxx = 0, sxy = 0, syy = 0; for (const p of pts) { const x = p[0] - mx, y = p[1] - my; sxx += x * x; sxy += x * y; syy += y * y; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);   // dirección de la recta
  const n = [-Math.sin(ang), Math.cos(ang)];
  return { n, d: -(n[0] * mx + n[1] * my) };
}
