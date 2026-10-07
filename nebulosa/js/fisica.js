/* ============================================================================
   La física del frasco: círculos con gravedad, tres subpasos por cuadro y
   varias pasadas de separación por subpaso (así las pilas quedan quietas y no
   tiemblan), choque con un poquito de rebote y rozamiento con el piso. Dos
   iguales que se tocan se fusionan en el que sigue; dos agujeros negros hacen
   una supernova.
   ========================================================================== */

const GRAV = 1500, SUBPASOS = 3, PASADAS = 3, REBOTE = 0.12;
let idCuerpo = 1;
function nuevoCuerpo(tipo, x, y) {
  const r = CUERPOS[tipo].r;
  return { id: idCuerpo++, tipo, x, y, vx: 0, vy: 0, r, rT: r, ang: Math.random() * 6.28, edad: 0, muerto: false };
}
/* un paso de física; devuelve las fusiones que pasaron: [{ a, b, x, y, tipo }] */
function pasoFisica(cuerpos, dt) {
  const fus = [], h = dt / SUBPASOS;
  for (let s = 0; s < SUBPASOS; s++) {
    for (const b of cuerpos) {
      if (b.muerto) continue;
      b.edad += h;
      if (b.r < b.rT) b.r = Math.min(b.rT, b.r + b.rT * h * 6);
      b.vy += GRAV * h;
      b.vx *= 0.9995; b.vy *= 0.9995;
      b.x += b.vx * h; b.y += b.vy * h;
      b.ang += (b.vx / b.r) * h;
    }
    for (let it = 0; it < PASADAS; it++) {
      for (let i = 0; i < cuerpos.length; i++) {
        const a = cuerpos[i]; if (a.muerto) continue;
        for (let j = i + 1; j < cuerpos.length; j++) {
          const b = cuerpos[j]; if (b.muerto) continue;
          const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d;
          // dos iguales: se fusionan
          if (a.tipo === b.tipo && a.edad > 0.03 && b.edad > 0.03 && !a.fusion && !b.fusion) {
            a.muerto = b.muerto = true; a.fusion = b.fusion = true;
            const ma = a.r * a.r, mb = b.r * b.r;
            fus.push({ a, b, x: (a.x * ma + b.x * mb) / (ma + mb), y: (a.y * ma + b.y * mb) / (ma + mb), vx: (a.vx + b.vx) * 0.25, vy: (a.vy + b.vy) * 0.25, tipo: a.tipo });
            continue;
          }
          const pen = rr - d, ma = a.r * a.r, mb = b.r * b.r, ia = 1 / ma, ib = 1 / mb, k = pen / (ia + ib);
          a.x -= nx * k * ia; a.y -= ny * k * ia; b.x += nx * k * ib; b.y += ny * k * ib;
          if (it === 0) {
            const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny;
            if (vn < 0) {
              const jn = -(1 + REBOTE) * vn / (ia + ib);
              a.vx -= jn * nx * ia; a.vy -= jn * ny * ia; b.vx += jn * nx * ib; b.vy += jn * ny * ib;
              // rozamiento en la tangente
              const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, jt = -vt * 0.08 / (ia + ib);
              a.vx -= jt * tx * ia; a.vy -= jt * ty * ia; b.vx += jt * tx * ib; b.vy += jt * ty * ib;
              if (-vn > 160) a.golpe = b.golpe = Math.max(a.golpe || 0, -vn);
            }
          }
        }
      }
      // el frasco
      for (const b of cuerpos) {
        if (b.muerto) continue;
        if (b.x - b.r < JL) { b.x = JL + b.r; if (b.vx < 0) b.vx *= -0.2; }
        if (b.x + b.r > JR) { b.x = JR - b.r; if (b.vx > 0) b.vx *= -0.2; }
        if (b.y + b.r > JF) { b.y = JF - b.r; if (b.vy > 0) { if (b.vy > 200) b.golpe = Math.max(b.golpe || 0, b.vy); b.vy *= -REBOTE; } b.vx *= 0.985; }
      }
    }
  }
  return fus;
}
