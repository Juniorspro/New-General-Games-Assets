// ─────────────────────────────────────────────────────────────────────────────
// LAS ARMAS: tiran solas. Cada una tiene su recarga; al cumplirse suelta una ráfaga de "cant"
// disparos separados por "int" segundos (como el original). Proyectiles con perforación, zonas que
// pegan cada tanto (re-golpe), y el daño se anota por arma para la tabla de resultados.
// ─────────────────────────────────────────────────────────────────────────────

const TAM = { latigoL: 64, latigoA: 14, ajo: 26, libro: 36, agua: 16, rayo: 12 };

function pasoArmas(dt) {
  const j = J.jug;
  for (const a of J.armas) {
    const p = paramsArma(a);
    if (a.k === "ajo" || a.k === "devora") { auraAjo(a, p, dt); continue; }
    if ((a.k === "libro" || a.k === "visperas") && a.libros && (a.libros.t > 0 || p.eterna)) { a.libros.t -= dt; if (a.libros.t > 0 || p.eterna) continue; }
    // la ráfaga en curso
    if (a.cola > 0) {
      a.tInt -= dt;
      while (a.cola > 0 && a.tInt <= 0) { disparar(a, p, p.cant - a.cola); a.cola--; a.tInt += p.int || 0; if (!p.int) a.tInt = 0; }
      continue;
    }
    a.t -= dt;
    if (a.t <= 0) {
      a.t = p.cd;
      if (a.k === "libro" || a.k === "visperas") { crearLibros(a, p); continue; }
      a.cola = Math.round(p.cant); a.tInt = 0;
      const s = (ARMAS[a.k] || ARMAS[EVOS[a.k].de]).sfx;
      if (s) sfx(s, 0.45);
    }
  }
  pasoProys(dt);
  pasoZonas(dt);
  pasoRayos(dt);
}

function masCercano(x, y, lejos = 260) {
  let mejor = null, md = lejos * lejos;
  for (const e of J.enemigos) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < md && enPantalla(e.x, e.y, 10)) { md = d; mejor = e; } }
  return mejor;
}
function alAzar() {
  const vis = J.enemigos.filter((e) => enPantalla(e.x, e.y, -4));
  return vis.length ? vis[Math.floor(A.f() * vis.length)] : null;
}
const enPantalla = (x, y, m = 0) => x > J.cam.x - m && x < J.cam.x + W + m && y > J.cam.y - m && y < J.cam.y + H + m;

function nuevoProy(o) { const q = { vida: 3, perf: 1, emp: 1, rehit: 0, golpeados: new Map(), rot: 0, r: 4, ...o }; J.proys.push(q); return q; }

function disparar(a, p, i) {
  const j = J.jug, k = a.k;
  switch (k) {
    case "latigo": case "carmesi": {
      // el primero hacia donde mirás, el segundo al otro lado; los que siguen, más arriba
      const lado = (i % 2 === 0 ? 1 : -1) * (j.izq ? -1 : 1), alto = Math.floor(i / 2);
      nuevoProy({ tipo: "tajo", a, sigue: true, dx: lado, dy: -6 - alto * 16, x: j.x, y: j.y, vida: 0.2, vidaMax: 0.2, dano: p.dano, emp: p.emp, perf: 999, largo: TAM.latigoL * p.area, alto: TAM.latigoA * p.area, crit: p.crit, xcrit: p.xcrit, cura: p.curaCrit, rojo: k === "carmesi" });
      break;
    }
    case "varita": case "sagrada": {
      const e = masCercano(j.x, j.y), ang = e ? Math.atan2(e.y - j.y, e.x - j.x) : A.f() * TAU, v = 150 * p.vel;
      nuevoProy({ tipo: "bala", spr: k, a, x: j.x, y: j.y - 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 2.2, dano: p.dano, emp: p.emp, perf: p.perf, r: 4, estela: k === "sagrada" ? "#ffe070" : "#8ac0ff" });
      break;
    }
    case "cuchillo": case "milfilos": {
      let dx = j.mirX, dy = j.mirY; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const v = 250 * p.vel, off = (A.f() - 0.5) * 10;
      nuevoProy({ tipo: "bala", spr: k, a, x: j.x - dy * off, y: j.y - 6 + dx * off, vx: dx * v, vy: dy * v, vida: 1.6, dano: p.dano, emp: p.emp, perf: p.perf, r: 4, rot: Math.atan2(dy, dx), fija: true });
      break;
    }
    case "hacha": {
      const lado = j.izq ? -1 : 1, abre = i === 0 ? (A.f() - 0.5) * 30 : lado * (18 + i * 22) * (i % 2 ? 1 : 0.6);
      nuevoProy({ tipo: "hacha", spr: "hacha", a, x: j.x, y: j.y - 8, vx: abre * p.vel, vy: -230 * p.vel, g: 420, vida: 3, dano: p.dano, emp: p.emp, perf: p.perf, r: 7 * p.area, esc: p.area, gira: 9 * (abre >= 0 ? 1 : -1) });
      break;
    }
    case "espiral": {
      const ang = (i / p.cant) * TAU + J.t, v = 140 * p.vel;
      nuevoProy({ tipo: "bala", spr: "espiral", a, x: j.x, y: j.y - 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 2.4, dano: p.dano, emp: p.emp, perf: 999, r: 9 * p.area, esc: p.area, gira: 10 });
      break;
    }
    case "cruz": case "celeste": {
      const e = masCercano(j.x, j.y), ang = e ? Math.atan2(e.y - j.y, e.x - j.x) : (j.izq ? Math.PI : 0), v = 170 * p.vel;
      nuevoProy({ tipo: "cruz", spr: k, a, x: j.x, y: j.y - 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, ang, v0: v, vida: 3, dano: p.dano, emp: p.emp, perf: 999, r: 7 * p.area, esc: p.area, gira: k === "cruz" ? 12 : 0, crit: p.crit, xcrit: p.xcrit, rot: k === "celeste" ? ang + Math.PI / 2 : 0 });
      break;
    }
    case "fuego": case "averno": {
      const e = alAzar(), base = e ? Math.atan2(e.y - j.y, e.x - j.x) : A.f() * TAU, v = 170 * p.vel;
      const ang = base + (i - (p.cant - 1) / 2) * 0.18;
      nuevoProy({ tipo: "bala", spr: k, a, x: j.x, y: j.y - 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: k === "averno" ? 4 : 2.5, dano: p.dano, emp: p.emp, perf: p.perf, r: k === "averno" ? 8 * p.area : 4, esc: k === "averno" ? p.area / 2.2 : 1, estela: "#ff8020", humo: 1 });
      if (i === 0) sfx("fuego", 0.4);
      break;
    }
    case "agua": case "marea": {
      const e = alAzar(), ang = A.f() * TAU, dd = 30 + A.f() * 60;
      const tx = e && A.si(0.6) ? e.x : j.x + Math.cos(ang) * dd, ty = e && A.si(0.6) ? e.y : j.y + Math.sin(ang) * dd;
      nuevoProy({ tipo: "frasco", spr: "agua", a, x: j.x, y: j.y - 8, x0: j.x, y0: j.y - 8, tx, ty, vida: 0.4, vidaMax: 0.4, dano: 0, perf: 0, p });
      break;
    }
    case "runa": case "sinmanana": {
      const ang = A.f() * TAU, v = 160 * p.vel;
      nuevoProy({ tipo: "runa", spr: k, a, x: j.x, y: j.y - 6, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: p.dur, dano: p.dano, emp: p.emp, perf: 999, rehit: 0.4, r: 5 * p.area, esc: p.area, explota: p.explota, estela: k === "runa" ? "#ff88c8" : "#70f0f0" });
      break;
    }
    case "rayo": case "tormenta": {
      const e = alAzar(); if (!e) break;
      rayo(e.x, e.y, TAM.rayo * p.area, p.dano, a, p.emp);
      if (p.doble) J.rayos.push({ x: e.x, y: e.y, t: 0.25, r: TAM.rayo * p.area, dano: p.dano, a, emp: p.emp });
      break;
    }
  }
}
/** Un rayo: cae de arriba, pega en área y deja la marca. */
function rayo(x, y, r, dano, a, emp) {
  J.efectos.push({ tipo: "rayo", x, y, t: 0.25, t0: 0.25, r, pts: rayoPuntos(x, y) });
  sfx("rayo", 0.35);
  cercanos(x, y, r, (e) => golpear(e, dano, emp, a, e.x - x, e.y - y));
}
function rayoPuntos(x, y) { const pts = []; let px = x + (V.f() - 0.5) * 20; for (let yy = y - H; yy < y; yy += 12) { pts.push([px, yy]); px += (V.f() - 0.5) * 14; } pts.push([x, y]); return pts; }
function pasoRayos(dt) { for (let i = J.rayos.length - 1; i >= 0; i--) { const r = J.rayos[i]; if ((r.t -= dt) <= 0) { rayo(r.x, r.y, r.r, r.dano, r.a, r.emp); J.rayos.splice(i, 1); } } }

function explosion(x, y, r, dano, a) {
  J.efectos.push({ tipo: "onda", x, y, t: 0.3, t0: 0.3, r, col: "#70f0f0" });
  cercanos(x, y, r, (e) => golpear(e, dano, 1, a, e.x - x, e.y - y));
}

function crearLibros(a, p) {
  a.libros = { t: p.dur, n: Math.round(p.cant), golpeados: new Map() };
  sfx("cruz", 0.3);
}
function auraAjo(a, p, dt) {
  const j = J.jug, r = TAM.ajo * p.area;
  a.radio = r;
  a.t -= dt;
  if (a.t > 0) return;
  a.t = 0.1;
  // devoraalmas: +1 de daño por cada 60 de vida curada (hasta +60)
  const extra = a.k === "devora" ? Math.min(60, Math.floor(J.sanado / 60)) : 0;
  const cd = p.cd;
  cercanos(j.x, j.y - 4, r, (e) => {
    const ult = e.ajo || -99;
    if (J.t - ult < cd) return;
    e.ajo = J.t;
    // cada golpe del ajo les baja la resistencia al empuje (+0,3) y al congelamiento
    e.empExtra = Math.min(1, (e.empExtra || 0) + 0.3);
    golpear(e, p.dano + extra, 0.6, a, e.x - j.x, e.y - j.y);
  });
}

function pasoProys(dt) {
  const j = J.jug;
  for (let i = J.proys.length - 1; i >= 0; i--) {
    const q = J.proys[i];
    q.vida -= dt;
    if (q.tipo === "tajo") {
      // el latigazo arranca DESDE el cuerpo (tapándolo): si deja un hueco, lo que se te pega encima nunca muere
      q.x = j.x + q.dx * (q.largo / 2 - 8); q.y = j.y + q.dy;
      if (!q.pego) { q.pego = 1; golpearRect(q, q.x - q.largo / 2, q.y - q.alto / 2, q.largo, q.alto); }
    } else if (q.tipo === "frasco") {
      const t = 1 - q.vida / q.vidaMax;
      q.x = lerp(q.x0, q.tx, t); q.y = lerp(q.y0, q.ty, t) - Math.sin(t * Math.PI) * 30; q.rot += dt * 12;
      if (q.vida <= 0) { crearCharco(q.a, q.p, q.tx, q.ty); J.proys.splice(i, 1); continue; }
      continue;
    } else {
      if (q.g) q.vy += q.g * dt;
      if (q.tipo === "cruz") {
        // la cruz frena, se da vuelta y vuelve pasando de largo (bumerán)
        const vv = q.vx * Math.cos(q.ang) + q.vy * Math.sin(q.ang), nv = vv - 260 * dt * (q.v0 / 170);
        q.vx = Math.cos(q.ang) * nv; q.vy = Math.sin(q.ang) * nv;
        if (vv > 0 && nv <= 0) q.golpeados.clear();
      }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.gira) q.rot += q.gira * dt;
      if (q.tipo === "runa") {
        // rebota en los bordes de la pantalla
        let reb = false;
        if (q.x < J.cam.x + 4 && q.vx < 0 || q.x > J.cam.x + W - 4 && q.vx > 0) { q.vx = -q.vx; reb = true; }
        if (q.y < J.cam.y + 30 && q.vy < 0 || q.y > J.cam.y + H - 4 && q.vy > 0) { q.vy = -q.vy; reb = true; }
        if (reb && q.explota) explosion(q.x, q.y, 22 * (q.esc || 1), q.dano, q.a);
      }
      if (q.estela && J.cuadro % 2 === 0) J.efectos.push({ tipo: "chispa", x: q.x, y: q.y, vx: 0, vy: q.humo ? -10 : 0, t: 0.25, t0: 0.25, col: q.estela });
      golpearCirculo(q);
    }
    if (q.vida <= 0 || q.perf <= 0 || (q.tipo !== "tajo" && q.tipo !== "runa" && !enPantalla(q.x, q.y, 80))) J.proys.splice(i, 1);
  }
  // los libros giran alrededor tuyo
  for (const a of J.armas) {
    if (!a.libros || !(a.k === "libro" || a.k === "visperas")) continue;
    const p = paramsArma(a), L2 = a.libros;
    if (L2.t <= 0 && !p.eterna) { L2.pos = []; continue; }
    const r = TAM.libro * p.area, n = p.eterna ? Math.round(p.cant) : L2.n, w = 3.2 * p.vel;
    L2.pos = [];
    for (let k = 0; k < n; k++) {
      const ang = J.t * w + (k / n) * TAU, x = j.x + Math.cos(ang) * r, y = j.y - 4 + Math.sin(ang) * r;
      L2.pos.push([x, y]);
      cercanos(x, y, 7 * Math.sqrt(p.area), (e) => {
        const ult = L2.golpeados.get(e) || -9;
        if (J.t - ult < 0.5) return;
        L2.golpeados.set(e, J.t);
        golpear(e, p.dano, p.emp, a, e.x - j.x, e.y - j.y);
      });
    }
  }
}
function golpearCirculo(q) {
  cercanos(q.x, q.y, q.r, (e) => {
    if (q.perf <= 0) return;
    const ult = q.golpeados.get(e);
    if (ult != null && (!q.rehit || J.t - ult < q.rehit)) return;
    q.golpeados.set(e, J.t);
    let d = q.dano;
    if (q.crit && A.si(q.crit * J.st.suerte)) d *= q.xcrit;
    golpear(e, d, q.emp, q.a, q.vx || e.x - J.jug.x, q.vy || e.y - J.jug.y, d !== q.dano);
    if (q.tipo === "bala" || q.tipo === "hacha") q.perf--;
  });
}
function golpearRect(q, x, y, w, h) {
  for (const e of J.enemigos) {
    if (e.x + e.r < x || e.x - e.r > x + w || e.y + e.r < y || e.y - e.r - 8 > y + h) continue;
    let d = q.dano, crit = false;
    if (q.crit && A.si(q.crit * J.st.suerte)) { d *= q.xcrit; crit = true; }
    golpear(e, d, q.emp, q.a, q.dx, 0, crit);
    // Látigo Carmesí: el crítico cura 8 (a lo sumo una vez por segundo)
    if (crit && q.cura && J.t - J.jug.ultCritCura >= 1) { J.jug.ultCritCura = J.t; curar(q.cura); }
  }
}

function crearCharco(a, p, x, y) {
  J.zonas.push({ a, x, y, r: TAM.agua * p.area, t: p.dur, t0: p.dur, dano: p.dano, golpeados: new Map(), sigue: p.sigue });
  sfx("agua", 0.35);
}
function pasoZonas(dt) {
  const j = J.jug;
  for (let i = J.zonas.length - 1; i >= 0; i--) {
    const z = J.zonas[i];
    z.t -= dt;
    // La Marea: los charcos se arrastran hacia vos y crecen (con tope)
    if (z.sigue) { const dx = j.x - z.x, dy = j.y - z.y, d = Math.hypot(dx, dy) || 1; z.x += dx / d * 18 * dt; z.y += dy / d * 18 * dt; z.r = Math.min(z.r + dt * 4, 60); }
    if (z.t <= 0) { J.zonas.splice(i, 1); continue; }
    if (J.cuadro % 3) continue;
    cercanos(z.x, z.y, z.r, (e) => {
      const ult = z.golpeados.get(e) || -9;
      if (J.t - ult < 0.5) return;       // el mismo enemigo, cada 0,5 s (wiki)
      z.golpeados.set(e, J.t);
      golpear(e, z.dano, 0, z.a, 0, 0);
    });
  }
}
