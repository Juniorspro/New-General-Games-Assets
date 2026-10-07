/* ============================================================================
   Física del corte: línea de trazo del dedo, colisión con frutas, separación
   en dos mitades con rotación y caída, gravedad y rebote en piso.
   ========================================================================== */

const GRAV = 1500, REBOTE = 0.15, DRAG = 0.998;
const ANCHO_CORTE = 20;

function pasoFisica(frutas, dt) {
  const cortadas = [];

  for (const f of frutas) {
    if (f.muerto) continue;
    f.edad += dt;
    f.vy += GRAV * dt;
    f.vx *= DRAG;
    f.vy *= DRAG;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.ang += (f.vx / f.r) * dt;

    if (f.y - f.r > H) { f.muerto = true; }
    if (f.x - f.r < 0) { f.x = f.r; if (f.vx < 0) f.vx *= -0.2; }
    if (f.x + f.r > W) { f.x = W - f.r; if (f.vx > 0) f.vx *= -0.2; }
    if (f.y + f.r > H) {
      f.y = H - f.r;
      if (f.vy > 0) { if (f.vy > 200) f.golpe = Math.max(f.golpe || 0, f.vy); f.vy *= -REBOTE; }
      f.vx *= 0.985;
    }
  }

  return cortadas;
}

function cortarFruta(x1, y1, x2, y2, frutas, juego) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return [];

  const nx = dx / len, ny = dy / len;
  const cortadas = [];

  for (const f of frutas) {
    if (f.muerto || f.cortada) continue;
    const fx = f.x - x1, fy = f.y - y1;
    const t = Math.max(0, Math.min(len, fx * nx + fy * ny));
    const cx = x1 + t * nx, cy = y1 + t * ny;
    const ddx = f.x - cx, ddy = f.y - cy;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);

    if (d < f.r + ANCHO_CORTE / 2) {
      f.cortada = true;
      const a1 = f.ang + 0.3, a2 = f.ang - 0.3;
      const vx = nx * 300, vy = ny * 300 - 100;

      cortadas.push({
        tipo: f.tipo, x: f.x - nx * f.r * 0.3, y: f.y - ny * f.r * 0.3, vx: vx + azar(-50, 50), vy: vy + azar(-50, 50), ang: a1, cortada: true, mitad: 0, fruta: f
      });
      cortadas.push({
        tipo: f.tipo, x: f.x + nx * f.r * 0.3, y: f.y + ny * f.r * 0.3, vx: vx + azar(-50, 50), vy: vy + azar(-50, 50), ang: a2, cortada: true, mitad: 1, fruta: f
      });

      if (FRUTAS[f.tipo].bomba) { juego.bomba = true; }
      else { juego.cortadas++; juego.puntos += FRUTAS[f.tipo].pts; Sonido.sfx('fusion', 0); }
    }
  }

  return cortadas;
}
