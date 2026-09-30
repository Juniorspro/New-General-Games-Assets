// ─────────────────────────────────────────────────────────────────────────────
// LO QUE SE MUEVE EN EL POZO: bichos (cada uno con su manera), tiros, gemas, bloques que se
// rompen, explosiones, partículas y temblor. Sólo se actualiza lo que está cerca de la cámara
// (un pozo tiene 60+ bichos y el teléfono no tiene por qué pensar en los de abajo de todo).
// ─────────────────────────────────────────────────────────────────────────────

function crearBicho(tipo, x, y, extra) {
  const d = BICHOS_D[tipo];
  const b = { tipo, d, x, y, w: d.w, h: d.h, vx: 0, vy: 0, vida: d.vida, t: V.f() * 3, flash: 0, muerto: false, izq: V.f() < 0.5, dir: V.f() < 0.5 ? -1 : 1, ...extra };
  if (d.mueve === "orbita") { b.cx = x; b.cy = y; b.ang = V.f() * TAU; }
  if (d.mueve === "vertical") b.vy = (V.f() < 0.5 ? -1 : 1) * d.vel;
  if (d.mueve === "diagonal") { b.vx = d.vel * (V.f() < 0.5 ? -1 : 1); b.vy = d.vel * (V.f() < 0.5 ? -1 : 1); }
  J.bichos.push(b);
  return b;
}

function pasoBichos(dt) {
  const j = J.jug, N = J.N, arriba = J.camY - 60, abajo = J.camY + H + 80;
  for (const b of J.bichos) {
    if (b.muerto) continue;
    if (b.y < arriba - 200 || b.y > abajo) { if (b.d.mueve !== "proyectil") continue; }
    b.t += dt; if (b.flash > 0) b.flash -= dt;
    const d = b.d, dx = j.x - b.x, dy = (j.y - 5) - (b.y - b.h / 2), dist = Math.hypot(dx, dy) || 1;
    switch (d.mueve) {
      case "persigueLento": { const v = d.vel * Math.min(2.2, 1 + b.t * 0.08); b.vx = lerp(b.vx, dx / dist * v, 0.03); b.vy = lerp(b.vy, dy / dist * v, 0.03); mover(b, dt, true); break; }
      case "colgado": {
        // cuelga del techo hasta que pasás cerca; después se tira encima tuyo
        if (!b.suelto) { if (Math.abs(dx) < 70 && dy > -20 && dy < 110) { b.suelto = true; sfx("golpe", 0.3); } break; }
        b.vx = lerp(b.vx, dx / dist * d.vel, 0.08); b.vy = lerp(b.vy, dy / dist * d.vel, 0.08); mover(b, dt, true); break;
      }
      case "salta": {
        b.vy += FIS.grav * dt * 0.8; const c = moverCaja(b, b.vx * dt, b.vy * dt, N);
        if (c.suelo) { b.vx = 0; b.vy = 0; b.carga = (b.carga || 0) + dt; if (b.carga > 1.4 && Math.abs(dx) < 110 && Math.abs(dy) < 120) { b.carga = 0; b.vy = -270; b.vx = sig(dx) * d.vel; b.izq = dx < 0; } }
        break;
      }
      case "patrulla": case "nada": {
        if (d.mueve === "nada") { b.vx = b.dir * d.vel; const c = moverCaja(b, b.vx * dt, 0, N); if (c.pared) b.dir *= -1; b.y += Math.sin(b.t * 2) * 0.15; }
        else {
          if (b.parar > 0) { b.parar -= dt; break; }
          const nx = b.x + b.dir * (b.w / 2 + 1), bajoPie = N.en(Math.floor(nx / T), Math.floor((b.y + 1) / T));
          if (!(solida(bajoPie) || bajoPie === PLAT)) b.dir *= -1;
          const c = moverCaja(b, b.dir * d.vel * dt, 0, N); if (c.pared) b.dir *= -1;
          if (d.blindado && V.f() < 0.004) b.parar = 0.8 + V.f();            // la tortuga se frena de vez en cuando
        }
        b.izq = b.dir < 0; break;
      }
      case "circula": { const a = b.t * 2.2; b.vx = lerp(b.vx, dx / dist * d.vel + Math.cos(a) * 45, 0.05); b.vy = lerp(b.vy, dy / dist * d.vel + Math.sin(a) * 45, 0.05); mover(b, dt, true); break; }
      case "persigue": {
        if (d.sube && !b.visto) { if (dist < 150) b.visto = true; else break; }
        b.vx = lerp(b.vx, dx / dist * d.vel, 0.04); b.vy = lerp(b.vy, dy / dist * d.vel, 0.04); mover(b, dt, !d.atraviesa); b.izq = dx < 0; break;
      }
      case "rebota": { b.vy += FIS.grav * dt * 0.7; const c = moverCaja(b, b.vx * dt, b.vy * dt, N); if (c.suelo) { b.vy = -160 - V.f() * 60; b.vx = sig(dx) * d.vel * (0.5 + V.f()); } if (c.pared) b.vx *= -1; break; }
      case "vaga": { const v = b.enojado ? 58 : d.vel; if (b.enojado) { b.vx = lerp(b.vx, dx / dist * v, 0.06); b.vy = lerp(b.vy, dy / dist * v, 0.06); } else { b.vx = Math.cos(b.t * 0.7) * v; b.vy = Math.sin(b.t * 1.1) * v * 0.6; } mover(b, dt, true); break; }
      case "tira": {
        b.izq = dx < 0;
        if (Math.abs(dy) < 130 && Math.abs(dx) < 120) { b.carga = (b.carga || 0) + dt; if (b.carga > 2.4) { b.carga = 0; const h = crearBicho("hueso", b.x, b.y - 8); h.vx = dx * 0.9; h.vy = -200; h.grav = 1; } }
        break;
      }
      case "ondea": { b.x += b.dir * d.vel * dt; b.y += Math.sin(b.t * 3) * 0.6; if (b.x < 20 || b.x > COLS * T - 20) b.dir *= -1; break; }
      case "zigzag": { const f = b.t % 2.2; if (f < 1.5) { b.x += Math.sin(b.t * 5) * 1.1; b.y -= d.vel * dt; } if (b.y < J.camY - 30) b.y = J.camY + H + 20; break; }
      case "calamar": {
        if (!b.baja) { b.y -= d.vel * 0.6 * dt; if (dy > 0 && Math.abs(dx) < 60) { b.baja = true; } }
        else { b.y += d.vel * 1.8 * dt; if (b.y > J.camY + H + 30) { b.baja = false; } }
        b.x += lim(dx, -1, 1) * 0.4; break;
      }
      case "vertical": { b.y += b.vy * dt; if (Math.abs(b.y - (b.y0 ?? (b.y0 = b.y))) > 90) b.vy *= -1; break; }
      case "orbita": { b.ang += d.vel * dt; b.x = b.cx + Math.cos(b.ang) * 26; b.y = b.cy + Math.sin(b.ang) * 26; break; }
      case "diagonal": { const c = moverCaja(b, b.vx * dt, b.vy * dt, N); if (c.pared) b.vx *= -1; if (c.suelo || c.techo) b.vy *= -1; break; }
      case "proyectil": {
        if (b.grav) b.vy += FIS.grav * dt * 0.6;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.t > 5 || solida(N.en(Math.floor(b.x / T), Math.floor(b.y / T))) && b.tipo !== "diente") b.muerto = true;
        if (b.tipo === "diente" && b.y > J.camY + H + 20) b.muerto = true;
        break;
      }
    }
  }
  for (let i = J.bichos.length - 1; i >= 0; i--) if (J.bichos[i].muerto) J.bichos.splice(i, 1);
}
/** Movimiento libre de los voladores (chocan con la roca si `choca`). */
function mover(b, dt, choca) {
  if (!choca) { b.x += b.vx * dt; b.y += b.vy * dt; }
  else { const c = moverCaja(b, b.vx * dt, b.vy * dt, J.N); if (c.pared) b.vx *= -0.8; if (c.suelo || c.techo) b.vy *= -0.8; }
  b.x = lim(b.x, 8, COLS * T - 8);
}

function danarBicho(b, dano) {
  if (b.muerto) return;
  if (b.d.blindado) { sfx("golpe", 0.3); chispa(b.x, b.y - b.h); return; }       // la tortuga no se deja: hay que pisarla
  b.vida -= dano; b.flash = 0.08;
  if (b.d.enoja && !b.enojado) b.enojado = true;
  sfx("golpe", 0.35);
  if (b.vida <= 0) matarBicho(b, false);
}
function matarBicho(b, pisado) {
  if (b.muerto) return;
  b.muerto = true;
  particulas(b.x, b.y - b.h / 2, 10, b.d.pisa ? "tinta" : "acento", 90);
  sfx("muere", 0.5);
  if (b.d.gemas) soltarGemas(b.x, b.y - b.h / 2, b.d.gemas);
  if (!b.d.sinCombo) {
    J.kills++;
    if (!J.jug.suelo) { J.jug.combo++; J.efectos.push({ tipo: "combo", n: J.jug.combo, x: J.jug.x, y: J.jug.y - 18, t: 0.8, t0: 0.8 }); }
  }
}
/** Las gemas saltan del lugar: grandes de 10 y chicas de 2. */
function soltarGemas(x, y, valor) {
  const grandes = Math.floor(valor / 10), chicas = Math.ceil((valor % 10) / 2);
  for (let i = 0; i < grandes + chicas; i++) {
    const a = V.f() * TAU, v = 40 + V.f() * 80;
    J.gemas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, v: i < grandes ? 10 : 2, t: 9 + V.f() * 3, grande: i < grandes });
  }
}
function pasoGemas(dt) {
  for (let i = J.gemas.length - 1; i >= 0; i--) {
    const gm = J.gemas[i];
    gm.vx *= 1 - 3 * dt; gm.vy = gm.vy * (1 - 3 * dt) + 30 * dt;
    gm.x += gm.vx * dt; gm.y += gm.vy * dt; gm.x = lim(gm.x, 6, COLS * T - 6);
    if ((gm.t -= dt) <= 0) J.gemas.splice(i, 1);
  }
}

// ── bloques ──
function romper(cx, cy) {
  const N = J.N, c = N.en(cx, cy);
  if (!rompible(c)) return;
  N.pon(cx, cy, VACIO);
  const x = cx * T + T / 2, y = cy * T + T / 2;
  particulas(x, y, 8, c === BGEMA ? "acento" : "tinta", 70);
  sfx("bloque", 0.45);
  if (c === BGEMA) soltarGemas(x, y, 10); else if (V.f() < 0.12) soltarGemas(x, y, 2);
  // bloques de pólvora: se rompen los de al lado, en cadena
  if (J.mejoras.polvora) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (rompible(N.en(cx + a, cy + b))) J.cadena.push({ cx: cx + a, cy: cy + b, t: 0.07 });
}
function explosion(x, y, r, dano, amiga) {
  J.efectos.push({ tipo: "onda", x, y, r, t: 0.3, t0: 0.3 });
  particulas(x, y, 14, "acento", 120);
  for (const b of J.bichos) if (!b.muerto && Math.hypot(b.x - x, b.y - b.h / 2 - y) < r + b.w / 2) { if (b.d.blindado) matarBicho(b, false); else danarBicho(b, dano); }
  const N = J.N;
  for (let cy = Math.floor((y - r) / T); cy <= Math.floor((y + r) / T); cy++) for (let cx = Math.floor((x - r) / T); cx <= Math.floor((x + r) / T); cx++) if (Math.hypot(cx * T + 8 - x, cy * T + 8 - y) < r + 4) romper(cx, cy);
  temblor(4); sfx("explota", 0.6);
}

// ── los tiros ──
function pasoBalas(dt) {
  const N = J.N;
  for (let i = J.balas.length - 1; i >= 0; i--) {
    const q = J.balas[i];
    q.x += q.vx * dt; q.y += q.vy * dt; q.vida -= dt;
    let muere = q.vida <= 0;
    const cx = Math.floor(q.x / T), cy = Math.floor((q.y + (q.arriba ? 0 : q.h / 2)) / T), c = N.en(cx, cy);
    if (!muere && rompible(c)) { romper(cx, cy); if (!q.perfora) muere = true; }
    else if (!muere && solida(c)) { muere = true; chispa(q.x, q.y); }
    if (!muere) for (const b of J.bichos) {
      if (b.muerto || (q.golpe && q.golpe.has(b))) continue;
      if (Math.abs(b.x - q.x) < b.w / 2 + q.w / 2 && q.y + q.h / 2 > b.y - b.h && q.y - q.h / 2 < b.y) {
        danarBicho(b, q.dano);
        if (q.perfora) { (q.golpe || (q.golpe = new Set())).add(b); } else { muere = true; break; }
      }
    }
    if (muere) J.balas.splice(i, 1);
  }
  for (let i = J.cadena.length - 1; i >= 0; i--) { const k = J.cadena[i]; if ((k.t -= dt) <= 0) { J.cadena.splice(i, 1); romper(k.cx, k.cy); } }
}

// ── efectos ──
function particula(x, y, vx, vy, t, color) { if (J.efectos.length < 260) J.efectos.push({ tipo: "p", x, y, vx, vy, t, t0: t, color }); }
function particulas(x, y, n, color, v = 60) { for (let i = 0; i < n; i++) { const a = V.f() * TAU, s = v * (0.3 + V.f() * 0.7); particula(x, y, Math.cos(a) * s, Math.sin(a) * s - 20, 0.3 + V.f() * 0.3, color); } }
function chispa(x, y) { for (let i = 0; i < 3; i++) particula(x, y, (V.f() - 0.5) * 80, -V.f() * 60, 0.15, "tinta"); }
function temblor(n) { if (G.op.temblor) J.temblor = Math.max(J.temblor, n); }
function cartel(txt, t = 1.5, sub = null) { J.cartel = { txt, sub, t, t0: t }; }
function pasoEfectos(dt) {
  for (let i = J.efectos.length - 1; i >= 0; i--) { const f = J.efectos[i]; f.t -= dt; if (f.tipo === "p") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 160 * dt; } else if (f.tipo === "combo") f.y -= 14 * dt; if (f.t <= 0) J.efectos.splice(i, 1); }
  if (J.temblor > 0) J.temblor = Math.max(0, J.temblor - 30 * dt);
  if (J.cartel && (J.cartel.t -= dt) <= 0) J.cartel = null;
  if (J.rachaT > 0 && (J.rachaT -= dt) <= 0) J.rachaGemas = 0;
}
