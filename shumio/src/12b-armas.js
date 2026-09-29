// ─────────────────────────────────────────────────────────────────────────────
// LAS ARMAS: como en el original, hay UNA arma principal (la de más prioridad: feto del cielo >
// cuchillo > feto > aro > lágrima mansa > rayo > láser > lágrima) y todo lo demás la modifica.
// El tercer ojo multiplica cualquier arma, el jarabe hace explotar lo que toque, la leche
// chocolatada deja cargar lo que sea, el pulmón lo vuelve ráfaga… Las sinergias famosas que no
// salen solas de esa regla están escritas a mano abajo (rayo+láser, rayo+jarabe, feto+rayo…).
// Números medidos en la wiki: el rayo pega 9 veces en 40 cuadros, el aro 15 veces por segundo,
// el feto hace ×10 (o ×5+30), el misil ×20, el cuchillo ×2 en la mano y ×6 tirado.
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Esta arma se carga manteniendo el disparo? */
function armaCarga(j) {
  const a = j.arma, f = j.f;
  if (a === "rayo") return !(f.soja || f.almendra || j.fr >= 15);   // con leche o cadencia altísima, el rayo sale continuo
  if (a === "anillo" || a === "cuchillo") return true;
  if (a === "lagrima" || a === "laser" || a === "feto") return !!(f.choco || f.pulmon);
  return false;
}
/** Cuadros que tarda la carga completa (fórmulas de la wiki pasadas a 60 Hz). */
function cuadrosCarga(j) {
  const a = j.arma, f = j.f;
  if (a === "anillo" || a === "cuchillo") return 180 / j.fr;      // ≈ 3 / cadencia
  if (f.choco && a !== "rayo") return 150 / j.fr;                 // la chocolatada: ≈ 2,5 / cadencia
  return 60 / j.fr;                                               // rayo, pulmón: ≈ 1 / cadencia
}
const dirDe = (dx, dy) => (dx > 0 ? DERECHA : dx < 0 ? IZQUIERDA : dy > 0 ? ABAJO : ARRIBA);

function actualizarArma(j, quieto) {
  if (j.enfriar > 0) j.enfriar--;
  const dx = quieto ? 0 : IN.dx, dy = quieto ? 0 : IN.dy, tira = !!(dx || dy), v = Math.hypot(j.vx, j.vy);
  if (tira) { j.mirar = dirDe(dx, dy); j.dirTiro = [dx, dy]; }
  else if (v > 0.3 || j.enfriar <= 0) j.mirar = j.mirarCue;
  const a = j.arma;
  const manso = a === "ludovico" || (a === "anillo" && j.f.ludovico);   // aro + lágrima mansa: un aro que se maneja
  if (!manso) J.ludo = null;
  if (a !== "cuchillo") J.cuchillo = null;
  if (a !== "epico") J.mira = null;
  if (manso) return ludovico(j, dx, dy);
  if (a === "cuchillo") return cuchillo(j, dx, dy, tira);
  if (a === "epico") return feteEpico(j, dx, dy, tira);
  if (a === "rayo" && !armaCarga(j)) return rayoContinuo(j, dx, dy, tira);
  if (armaCarga(j)) {
    if (tira && j.enfriar <= 0) {
      j.cargando = true; j.carga = Math.min(1, j.carga + 1 / cuadrosCarga(j));
      if (j.carga >= 1 && !j.avisoCarga) { j.avisoCarga = true; SFX.cargado(); }
      // con la leche, el aro y el pulmón salen solos al llenarse (como en el original con Almendra)
      return;
    }
    if (!tira && j.cargando) {
      const c = j.carga, [ddx, ddy] = j.dirTiro || [0, 1];
      j.cargando = false; j.carga = 0; j.avisoCarga = false;
      // el rayo y el pulmón sólo salen con la carga llena (salvo con la chocolatada)
      if ((a === "rayo" || (j.f.pulmon && !j.f.choco)) && c < 1) return;
      disparar(j, ddx, ddy, { carga: c, rafaga: !!j.f.pulmon && a !== "anillo" });
      j.enfriar = 6;
    }
    return;
  }
  if (tira && j.enfriar <= 0) { disparar(j, dx, dy, {}); j.enfriar = cuadrosEntreLagrimas(j); }
}

/** Un disparo del arma que toque, con todas sus copias (tercer ojo, siamés, ratón de biblioteca…). */
function disparar(j, dx, dy, o, desde) {
  const f = j.f, base = Math.atan2(dy, dx), n = j.n;
  const angulos = [];
  if (o.rafaga) {
    // el pulmón: 14 lágrimas (2,4 más por cada una extra del multidisparo), abiertas al azar
    const cuantas = Math.min(50, Math.round(14 + 2.4 * (n - 1)));
    for (let i = 0; i < cuantas; i++) angulos.push([base + (A.f() - 0.5) * 0.7, 0, 0.7 + A.f() * 0.5, 0.9 + A.f() * 0.43]);
  } else if (n === 2) angulos.push([base, -4, 1, 1], [base, 4, 1, 1]);     // los lentes: dos paralelas, una por ojo
  else for (let i = 0; i < n; i++) angulos.push([base + (i - (n - 1) / 2) * (n > 3 ? 0.13 : 0.16), 0, 1, 1]);
  if (f.siames) angulos.push([base - Math.PI / 4, 0, 1, 1], [base + Math.PI / 4, 0, 1, 1]);
  if (f.ratonLibro && A.si(0.25)) for (const q of angulos.slice()) q[1] -= 3, angulos.push([q[0], q[1] + 6, q[2], q[3]]);
  const escala = o.carga != null && f.choco && j.arma !== "rayo" && j.arma !== "anillo" ? 0.1 + 3.9 * o.carga : 1;
  const org = desde || j;
  const lado = (j.ojo = 1 - j.ojo) ? 1 : -1;
  const ox = dy ? lado * 3 : dx * 5, oy = (dx ? lado : dy * 3) + (dy < 0 ? -2 : 0);
  const X = org.x + ox, Y = org.y + oy;
  const fam = desde ? desde.escala ?? 1 : 1;
  switch (j.arma) {
    case "rayo": {
      const esc = o.carga != null && f.choco ? 0.25 + 2.25 * o.carga : 1;
      const rayos = f.pulmon ? A.ent(4, 6) : 0;
      for (const [a, desv] of angulos.slice(0, rayos ? 0 : 16)) rayo(j, org, a, desv, esc * fam, 40);
      for (let i = 0; i < rayos; i++) rayo(j, org, base + (A.f() - 0.5) * 0.8, 0, esc * fam, 40);
      SFX.rayo(); break;
    }
    case "anillo": {
      const c = o.carga ?? 1;
      for (const [a] of angulos.slice(0, 8)) anilloLuz(j, X, Y, a, c, fam);
      SFX.laser(); break;
    }
    case "laser":
      if (f.hemo) { for (const [a, desv, kv] of angulos) lagrima(j, X + Math.cos(a + 1.57) * desv, Y + Math.sin(a + 1.57) * desv, a, kv, { escala: escala * fam, burstLaser: true }); SFX.lagrima(); break; }
      for (const [a, desv] of angulos.slice(0, o.rafaga ? 7 : 16)) laser(j, X + Math.cos(a + 1.57) * desv, Y - 8 + Math.sin(a + 1.57) * desv, a, { dano: danoDe(j) * escala * fam });
      SFX.laser(); break;
    case "feto":
      for (const [a, desv, kv] of angulos.slice(0, o.rafaga ? 8 : 16)) {
        const v = 5.5 * j.velLag * kv;
        let d = danoDe(j) * 10 * escala * fam; if (d > 60) d = danoDe(j) * 5 * escala * fam + 30;
        J.bombas.push(nuevaBomba(j, X + Math.cos(a + 1.57) * desv, Y + 2, Math.cos(a) * v + j.vx * 0.4, Math.sin(a) * v + j.vy * 0.4, 60, { dano: d, feto: true, contacto: !!f.ipecac, danoJug: d >= 85 ? 2 : 1, rayos: f.rayo ? 4 : 0, lasers: f.laser ? 8 : 0, segunda: !!f.polifemo }));
      }
      SFX.escupe(); break;
    default:
      for (const [a, desv, kv, kt] of angulos) lagrima(j, X + Math.cos(a + 1.57) * desv, Y + Math.sin(a + 1.57) * desv, a, kv, { escala: escala * fam, tam: kt * (desde ? 0.7 : 1) });
      SFX.lagrima();
  }
  if (!desde && (!j.gesto || j.gesto === 1)) { j.gesto = 1; j.tGesto = 6; }
}

// ── el rayo (el llanto de azufre): 9 golpes en 40 cuadros, sale de la cara y la sigue ──
const TICKS_RAYO = new Set([0, 11, 15, 19, 23, 27, 31, 35, 39]);
function rayo(j, org, ang, desv, esc, dur) {
  const coil = !!j.f.laser;                          // rayo + láser: el láser se enrosca y el daño ×1,5
  J.laseres.push({ tipo: "rayo", org, ang, desv, t: 0, dur, dano: danoDe(j) * esc * (coil ? 1.5 : 1), ancho: lim(9 + Math.sqrt(danoDe(j)) * 1.5 * Math.sqrt(esc), 8, 22), coil, ipecac: !!j.f.ipecac, tocados: null, x0: org.x, y0: org.y - 10 });
}
/** Hasta dónde llega una línea desde (x, y) con ángulo a: hasta la pared (pasa por encima de todo lo demás). */
function finDeRayo(x, y, a) {
  const c = Math.cos(a), s = Math.sin(a);
  let t = 999;
  if (c > 0.001) t = Math.min(t, (IX1 - 1 - x) / c); else if (c < -0.001) t = Math.min(t, (IX0 + 1 - x) / c);
  if (s > 0.001) t = Math.min(t, (IY1 - 1 - y) / s); else if (s < -0.001) t = Math.min(t, (IY0 - 6 - y) / s);
  t = Math.max(0, t);
  return [x + c * t, y + s * t, t];
}
function distSegmento(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1;
  const u = lim(((px - x0) * dx + (py - y0) * dy) / L, 0, 1);
  return Math.hypot(px - (x0 + dx * u), py - (y0 + dy * u));
}
/** A todos los que toca la línea, un golpe (con los efectos de lágrima de Shumio). */
function golpearLinea(x0, y0, x1, y1, ancho, dano, efectos) {
  let alguno = false;
  for (const e of J.enemigos) {
    if (!blanco_(e)) continue;
    const d = e.segmentos ? Math.min(distSegmento(e.x, e.y, x0, y0, x1, y1), ...e.segmentos.map((s) => distSegmento(s.x, s.y, x0, y0, x1, y1))) : distSegmento(e.x, e.y - (e.alturaGolpe || 4), x0, y0, x1, y1);
    if (d > e.r + ancho / 2) continue;
    const a = Math.atan2(y1 - y0, x1 - x0);
    danarEnemigo(e, dano, Math.cos(a) * 0.6, Math.sin(a) * 0.6, efectos ? efectosDeGolpe(J.jug) : null);
    alguno = true;
  }
  // también rompe matas y apaga braseros (como el rayo del original)
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12);
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n, c = celdaX(x), f = celdaY(y), o = celda(J.sala, c, f);
    if (o && (o.t === "matas" || o.t === "brasero" || o.t === "barril")) golpearObstaculo(o, c, f, dano);
  }
  return alguno;
}
/** Los efectos al azar (veneno, lentitud, miedo…) para un golpe que no es una lágrima. */
function efectosDeGolpe(j) {
  const f = j.f, L = j.suerte;
  return { veneno: f.veneno && A.si(chance.veneno(L)), hielo: f.lento && A.si(chance.lento(L)), fuego: !!f.fuego, miedo: f.miedo && A.si(chance.miedo(L)), piedra: f.piedra && A.si(chance.piedra(L)) };
}

// ── el láser (el ojo mecánico): instantáneo, atraviesa todo y llega a la pared ──
function laser(j, x, y, ang, o = {}) {
  const [x1, y1] = finDeRayo(x, y, ang);
  golpearLinea(x, y, x1, y1, 5, o.dano ?? danoDe(j), true);
  J.laseres.push({ tipo: "laser", x0: x, y0: y, x1, y1, t: 0, dur: 9, ancho: o.ancho || 3, color: o.color });
}

// ── el aro de luz: se carga, sale girando y quema a lo que queda en su borde ──
function anilloLuz(j, x, y, ang, carga, esc = 1) {
  const v = 3.2 * j.velLag, R = 7 + 21 * carga, rayoAro = !!j.f.rayo;
  J.anillos.push({ x, y: y - 6, vx: Math.cos(ang) * v + j.vx * 0.5, vy: Math.sin(ang) * v + j.vy * 0.5, R, vida: alcancePx(j) * 1.3 / v, t: 0, dano: danoDe(j) * (0.25 + 0.75 * carga) * esc * (rayoAro ? 1.5 : 1), rojo: rayoAro, pared: 0 });
}
function actualizarAnillos() {
  for (let i = J.anillos.length - 1; i >= 0; i--) {
    const a = J.anillos[i];
    a.t++;
    if (a.control) { a.x = J.ludo ? J.ludo.x : a.x; a.y = J.ludo ? J.ludo.y : a.y; }
    else if (a.pared > 0) { if (--a.pared <= 0) { J.anillos.splice(i, 1); continue; } }
    else {
      a.x += a.vx; a.y += a.vy;
      if (a.x < IX0 || a.x > IX1 || a.y < IY0 - 4 || a.y > IY1 || --a.vida <= 0) { a.pared = 12; a.x = lim(a.x, IX0, IX1); a.y = lim(a.y, IY0 - 4, IY1); }   // se queda un ratito en la pared
    }
    if (a.t % 4 === 0) for (const e of J.enemigos) {
      if (!blanco_(e)) continue;
      const d = dist(e.x, e.y - 4, a.x, a.y);
      if (Math.abs(d - a.R) < e.r + (a.rojo ? 5 : 3)) danarEnemigo(e, a.dano, 0, 0, efectosDeGolpe(J.jug));
    }
  }
}

// ── el rayo continuo (rayo + leche, o cadencia ≥ 15): dura mientras se mantiene el disparo ──
function rayoContinuo(j, dx, dy, tira) {
  let r = J.laseres.find((l) => l.continuo);
  if (!tira) { if (r) r.dur = Math.min(r.dur, r.t + 6); return; }
  const ang = Math.atan2(dy, dx);
  if (!r) {
    rayo(j, j, ang, 0, 1, 99999); r = J.laseres[J.laseres.length - 1]; r.continuo = true; r.ancho *= 0.7;
    SFX.rayo();
  }
  r.ang = ang; r.dur = r.t + 30;
}

function actualizarLaseres() {
  const j = J.jug;
  for (let i = J.laseres.length - 1; i >= 0; i--) {
    const l = J.laseres[i];
    if (l.tipo === "rayo") {
      // sale de la cara de quien lo tira y lo sigue mientras camina
      l.x0 = l.org.x + Math.cos(l.ang + 1.57) * l.desv; l.y0 = l.org.y - 10 + Math.sin(l.ang + 1.57) * l.desv;
      [l.x1, l.y1] = finDeRayo(l.x0, l.y0, l.ang);
      const golpea = l.continuo ? l.t % 4 === 0 : TICKS_RAYO.has(l.t);
      if (golpea) {
        golpearLinea(l.x0, l.y0, l.x1, l.y1, l.ancho, l.dano, true);
        if (l.t % 8 === 0) temblar(2);
        // rayo + jarabe: explota a lo largo del rayo (una vez por disparo)
        if (l.ipecac && l.t === 0) { const L = Math.hypot(l.x1 - l.x0, l.y1 - l.y0); for (let d = 36; d < L; d += 44) { const x = l.x0 + Math.cos(l.ang) * d, y = l.y0 + Math.sin(l.ang) * d + 10; J.pendientes.push(() => explotar(x, y, true, false, { dano: l.dano, radio: 30, danoJug: 1, veneno: true })); } }
      }
    }
    if (++l.t >= l.dur) J.laseres.splice(i, 1);
  }
}

// ── la lágrima mansa (ludovico): una sola lágrima grande que se maneja con el disparo ──
function ludovico(j, dx, dy) {
  let L = J.ludo;
  if (!L) L = J.ludo = { x: j.x, y: j.y - 16, vx: 0, vy: 0, t: 0 };
  L.t++;
  const v = 2.4 * j.velLag;
  if (dx || dy) { L.vx += (dx * v - L.vx) * 0.12; L.vy += (dy * v - L.vy) * 0.12; }
  else { L.vx *= 0.92; L.vy *= 0.92; }
  L.x = lim(L.x + L.vx, IX0 + 4, IX1 - 4); L.y = lim(L.y + L.vy, IY0 + 2, IY1 - 4);
  L.r = lim(radioLagrima(j) * 1.5, 5, 14);
  const f = j.f;
  L.aro = f.rayo ? "rojo" : f.laser || f.anillo ? "laser" : null;
  const cada = L.aro ? 4 : Math.max(2, Math.round(60 / Math.min(30, j.fr)));
  if (L.t % cada === 0) for (const e of J.enemigos) {
    if (!blanco_(e)) continue;
    const d = dist(e.x, e.y - 4, L.x, L.y);
    const toca = L.aro ? Math.abs(d - 18) < e.r + (L.aro === "rojo" ? 6 : 3) : d < e.r + L.r;
    if (toca) { danarEnemigo(e, danoDe(j) * (L.aro === "rojo" ? 1.2 : 1), L.vx * 0.3, L.vy * 0.3, efectosDeGolpe(j)); if (f.jacob) chispa(e, danoDe(j) * 0.5); }
  }
}

// ── el cuchillo de la abuela: pega en la mano, se carga y se tira; vuelve solo ──
function cuchillo(j, dx, dy, tira) {
  let K = J.cuchillo;
  if (!K) K = J.cuchillo = { est: "mano", d: 10, ang: Math.PI / 2, carga: 0, t: 0, golpes: new Map() };
  K.t++;
  if (K.est === "mano") {
    if (tira) {
      K.ang = Math.atan2(dy, dx);
      j.cargando = true; K.carga = j.carga = Math.min(1, K.carga + 1 / cuadrosCarga(j));
      if (j.carga >= 1 && !j.avisoCarga) { j.avisoCarga = true; SFX.cargado(); }
    } else if (K.carga > 0.05) {
      // se tira: más carga, más lejos y más daño (×6 desde un tercio de carga)
      K.est = "vuela"; K.dmax = 26 + K.carga * Math.max(90, alcancePx(j) * 1.1); K.danoVuelo = 2 + 4 * Math.min(1, K.carga * 3);
      const extra = (j.n - 1) + (j.f.rayo ? 2 + Math.floor(K.carga * 6) : 0);
      for (let i = 0; i < extra; i++) {
        const a = K.ang + (i % 2 ? 1 : -1) * (0.16 + Math.floor(i / 2) * 0.14);
        lagrima(j, j.x, j.y - 6, a, 1.8, { tipo: "cuchillo", atraviesa: true, espectral: true, danoFijo: danoDe(j) * 2 });
      }
      j.cargando = false; j.carga = 0; j.avisoCarga = false; K.carga = 0; SFX.escupe();
    } else { K.carga = 0; j.cargando = false; j.carga = 0; }
    K.d = 10 - K.carga * 4;
  } else if (K.est === "vuela") { K.d += 7; if (K.d >= K.dmax) K.est = "vuelve"; }
  else { K.d -= 6; if (K.d <= 10) { K.est = "mano"; K.d = 10; } }
  K.x = j.x + Math.cos(K.ang) * K.d; K.y = j.y - 6 + Math.sin(K.ang) * K.d;
  // el filo: pega 20 veces por segundo (cada 3 cuadros) a lo que toca
  const mult = K.est === "vuela" ? K.danoVuelo : 2;
  for (const e of J.enemigos) {
    if (!blanco_(e)) continue;
    if (dist(e.x, e.y - 4, K.x, K.y) > e.r + 6) continue;
    const u = K.golpes.get(e) || 0;
    if (K.t - u < 3) continue;
    K.golpes.set(e, K.t);
    danarEnemigo(e, danoDe(j) * mult, Math.cos(K.ang) * 1.2, Math.sin(K.ang) * 1.2, efectosDeGolpe(j));
  }
}

// ── el feto del cielo: una mira que se mueve y, 1,5 s después, cae un misil (×20) ──
function feteEpico(j, dx, dy, tira) {
  let M = J.mira;
  if (!M && tira && j.enfriar <= 0) M = J.mira = { x: lim(j.x + dx * 30, IX0 + 8, IX1 - 8), y: lim(j.y + dy * 30, IY0 + 8, IY1 - 8), t: 0 };
  if (!M) return;
  M.t++;
  if (tira) { M.x = lim(M.x + dx * 3.2, IX0 + 6, IX1 - 6); M.y = lim(M.y + dy * 3.2, IY0 + 6, IY1 - 6); }
  if (M.t >= 90) {
    const n = Math.min(16, j.n + (j.f.siames ? 2 : 0));
    for (let i = 0; i < n; i++) J.misiles.push({ x: M.x + (i ? (A.f() - 0.5) * 26 : 0), y: M.y + (i ? (A.f() - 0.5) * 20 : 0), t: -i * 6, dur: 24, dano: danoDe(j) * 20 });
    J.mira = null; j.enfriar = cuadrosEntreLagrimas(j);
  }
}
function actualizarMisiles() {
  const j = J.jug;
  for (let i = J.misiles.length - 1; i >= 0; i--) {
    const m = J.misiles[i];
    if (++m.t < m.dur) continue;
    J.misiles.splice(i, 1);
    explotar(m.x, m.y, true, true, { dano: m.dano, radio: 50, danoJug: m.dano >= 85 ? 2 : 1, rayos: j.f.rayo ? A.ent(4, 6) : 0, lasers: j.f.laser ? 8 : 0, veneno: !!j.f.bombaPodrida });
  }
}

/** Una chispa eléctrica (la raíz eléctrica): salta al enemigo más cerca y encadena hasta 4. */
function chispa(e0, dano) {
  let de = e0; const vistos = new Set([e0]);
  for (let k = 0; k < 4; k++) {
    let prox = null, md = 60;
    for (const e of J.enemigos) { if (!blanco_(e) || vistos.has(e)) continue; const d = dist(e.x, e.y, de.x, de.y); if (d < md) { md = d; prox = e; } }
    if (!prox) { if (k === 0) { const a = V.f() * TAU; J.chispas.push({ x0: de.x, y0: de.y - 6, x1: de.x + Math.cos(a) * 26, y1: de.y - 6 + Math.sin(a) * 26, t: 8 }); } break; }
    J.chispas.push({ x0: de.x, y0: de.y - 6, x1: prox.x, y1: prox.y - 6, t: 8 });
    danarEnemigo(prox, dano); vistos.add(prox); de = prox;
  }
}

// ── el dibujo de las armas (pintado liso, con brillo, como el resto) ──
function dibujarArmas(g) {
  const j = J.jug;
  // la mira del feto del cielo y los misiles que caen
  if (J.mira) { const M = J.mira, p = 0.6 + 0.4 * Math.sin(M.t * 0.3); g.save(); g.globalAlpha = 0.9; g.strokeStyle = `rgba(230,30,30,${p})`; g.lineWidth = 1.5; g.beginPath(); g.ellipse(M.x, M.y, 9, 6, 0, 0, TAU); g.moveTo(M.x - 13, M.y); g.lineTo(M.x + 13, M.y); g.moveTo(M.x, M.y - 10); g.lineTo(M.x, M.y + 10); g.stroke(); g.restore(); }
  for (const m of J.misiles) {
    if (m.t < 0) continue;
    const u = m.t / m.dur, s = misilSpr();
    g.drawImage(sombra(Math.round(3 + u * 7), Math.round(1 + u * 3)), Math.round(m.x - 3 - u * 7), Math.round(m.y - 1 - u * 3));
    g.drawImage(s, Math.round(m.x - s.width / 2), Math.round(m.y - s.height - (1 - u) * 200));
  }
  // la lágrima mansa
  if (J.ludo) {
    const L = J.ludo;
    if (L.aro) dibujarAro(g, L.x, L.y, 18, L.aro === "rojo", L.t);
    else { const s = lagrimaSpr(Math.round(L.r), colorLagrima(j)); g.drawImage(sombra(Math.round(L.r), Math.round(L.r / 2)), Math.round(L.x - L.r), Math.round(L.y + 12)); g.drawImage(s, Math.round(L.x - s.width / 2), Math.round(L.y - s.height / 2)); }
    for (let i = 1; i < j.n; i++) { const a = L.t * 0.08 + i * TAU / (j.n - 1), s = lagrimaSpr(3, colorLagrima(j)); g.drawImage(s, Math.round(L.x + Math.cos(a) * 16 - s.width / 2), Math.round(L.y + Math.sin(a) * 12 - s.height / 2)); }
  }
  for (const a of J.anillos) dibujarAro(g, a.x, a.y, a.R, a.rojo, a.t, a.pared ? a.pared / 12 : 1);
  for (const l of J.laseres) dibujarLaser(g, l);
  for (const c of J.chispas) { g.strokeStyle = `rgba(190,230,255,${c.t / 8})`; g.lineWidth = 1; g.beginPath(); g.moveTo(c.x0, c.y0); const n = 5; for (let k = 1; k < n; k++) g.lineTo(c.x0 + (c.x1 - c.x0) * k / n + (V.f() - 0.5) * 6, c.y0 + (c.y1 - c.y0) * k / n + (V.f() - 0.5) * 6); g.lineTo(c.x1, c.y1); g.stroke(); c.t--; }
  J.chispas = J.chispas.filter((c) => c.t > 0);
  for (const h of J.luces) { const u = h.t / 20; g.fillStyle = `rgba(200,235,255,${0.55 * u})`; g.fillRect(Math.round(h.x - 7), 0, 14, Math.round(h.y)); g.fillStyle = `rgba(255,255,255,${0.7 * u})`; g.fillRect(Math.round(h.x - 3), 0, 6, Math.round(h.y)); g.beginPath(); g.ellipse(h.x, h.y, 14, 6, 0, 0, TAU); g.fill(); h.t--; }
  J.luces = J.luces.filter((h) => h.t > 0);
}
/** El cuchillo, en la mano o volando (se dibuja con el orden de profundidad del jugador). */
function dibujarCuchillo(g) {
  const K = J.cuchillo;
  if (!K || K.x == null) return;
  const s = cuchilloSpr();
  g.save(); g.translate(Math.round(K.x), Math.round(K.y)); g.rotate(K.ang + (K.est === "vuelve" ? Math.PI : 0) * 0); g.drawImage(s, -s.width / 2, -s.height / 2); g.restore();
}
function dibujarAro(g, x, y, R, rojo, t, alfa = 1) {
  g.save(); g.globalAlpha = alfa;
  const w = rojo ? 5 : 2.5;
  g.strokeStyle = rojo ? "rgba(90,0,0,0.55)" : "rgba(160,20,40,0.45)"; g.lineWidth = w + 3; g.beginPath(); g.ellipse(x, y, R, R * 0.8, 0, 0, TAU); g.stroke();
  g.strokeStyle = rojo ? "#c8141a" : "#ff4a5a"; g.lineWidth = w; g.stroke();
  g.strokeStyle = rojo ? "#ff9a7a" : "#ffe0e4"; g.lineWidth = Math.max(1, w * 0.35); g.setLineDash([6, 4]); g.lineDashOffset = -t * 0.8; g.stroke();
  g.restore();
}
function dibujarLaser(g, l) {
  const u = l.t / l.dur;
  g.save(); g.lineCap = "round";
  if (l.tipo === "rayo") {
    const aparece = Math.min(1, l.t / 3), va = l.continuo ? 1 : Math.min(1, (l.dur - l.t) / 8);
    const w = l.ancho * aparece * va * (1 + Math.sin(l.t * 0.9) * 0.08);
    g.globalAlpha = 0.5; g.strokeStyle = "#5a0006"; g.lineWidth = w + 5; linea(g, l);
    g.globalAlpha = 1; g.strokeStyle = "#b80c12"; g.lineWidth = w; linea(g, l);
    g.strokeStyle = "#ff3a2a"; g.lineWidth = w * 0.55; linea(g, l);
    g.strokeStyle = "#ffd0b0"; g.lineWidth = Math.max(1, w * 0.2); linea(g, l);
    if (l.coil) {   // el láser enroscado alrededor del rayo
      g.strokeStyle = "rgba(255,120,150,0.9)"; g.lineWidth = 1.2; g.beginPath();
      const L = Math.hypot(l.x1 - l.x0, l.y1 - l.y0), c = Math.cos(l.ang), s = Math.sin(l.ang);
      for (let d = 0; d < L; d += 3) { const o = Math.sin(d * 0.25 - l.t * 0.6) * w * 0.6; const x = l.x0 + c * d - s * o, y = l.y0 + s * d + c * o; d ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    }
    // el fogonazo en la cara y la salpicadura en la pared
    g.fillStyle = "rgba(255,80,60,0.7)"; g.beginPath(); g.arc(l.x0, l.y0, w * 0.7, 0, TAU); g.fill();
    g.fillStyle = "rgba(255,60,40,0.55)"; g.beginPath(); g.ellipse(l.x1, l.y1, w * 0.9, w * 0.6, 0, 0, TAU); g.fill();
  } else {
    const a = 1 - u;
    g.globalAlpha = a * 0.6; g.strokeStyle = l.color || "#c01030"; g.lineWidth = l.ancho + 3; linea(g, l);
    g.globalAlpha = a; g.strokeStyle = "#ff5a70"; g.lineWidth = l.ancho; linea(g, l);
    g.strokeStyle = "#fff0f2"; g.lineWidth = 1; linea(g, l);
  }
  g.restore();
}
function linea(g, l) { g.beginPath(); g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1); g.stroke(); }
/** La barrita de carga al lado de la cabeza (la del original, roja y que titila al llenarse). */
function dibujarCarga(g, j) {
  if (!j.cargando || j.carga <= 0 || j.muerto) return;
  const x = Math.round(j.x + 10), y = Math.round(j.y - 30), h = 14, lleno = j.carga >= 1;
  g.fillStyle = "rgba(10,6,8,0.8)"; g.fillRect(x, y, 4, h + 2);
  g.fillStyle = lleno && (J.t >> 2) & 1 ? "#ffffff" : "#e02a2a";
  const a = Math.round(h * j.carga); g.fillRect(x + 1, y + 1 + h - a, 2, a);
}
