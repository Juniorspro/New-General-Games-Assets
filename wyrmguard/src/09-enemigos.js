// ─────────────────────────────────────────────────────────────────────────────
// LOS ENEMIGOS. Los "seekers" del original: pastillas rojas de 14×6 que persiguen a la cabeza.
// Con la curva y[nivel] del original: vida 25+16,5·y y daño 4,5+2,5·y, por los multiplicadores de la
// clase "seeker" (vida ×0,5, velocidad ×0,3: son lentos y la víbora los esquiva). Los élites
// (verde acelera, azul revienta, blanco dispara, naranja cabecea, amarillo aguanta, violeta pare)
// y los cinco jefes (niveles 6, 12, 18, 24 y 25) hacen lo mismo que allá.
// ─────────────────────────────────────────────────────────────────────────────

function statsEnemigo(lvl, jefe) {
  const ng = J.ng, y = jefe ? Y_JEFE[lvl] : Y_ENE[lvl];
  let hp, dmg, mv;
  if (jefe) {
    hp = 100 + ng * 5 + (90 + ng * 10) * y; dmg = 12 + ng * 2 + (2 + ng) * y; mv = 35 + 1.5 * y;
    if (lvl === 25) { dmg = 12 + ng * 2 + (1.25 + (ng ? 0.5 * ng : 0)) * y; mv = 35 + 1.1 * y; }
  } else if (ng === 0) { hp = 25 + 16.5 * y; dmg = 4.5 + 2.5 * y; mv = 70 + 3 * y; }
  else { hp = 22 + ng * 3 + (15 + ng * 2.7) * y; dmg = 4 + ng * 1.15 + (2 + ng * 0.83) * y; mv = 70 + 3 * y; }
  return { hp: hp * (jefe ? 1 : 0.5), dmg, mv: mv * 0.3 };
}
function crearEnemigo(x, y, tipo = null, jefe = null) {
  const lvl = J.nivel, s = statsEnemigo(lvl, jefe);
  const e = { x, y, vx: 0, vy: 0, r: V.f() * TAU, lvl, tipo, jefe, elite: !!tipo, hp: s.hp, maxhp: s.hp, dmg: s.dmg, mv0: s.mv, rad: jefe ? 9 : RADIO_E,
    w: jefe ? 24 : 14, h: jefe ? 10 : 6, col: jefe ? COLOR_JEFE[jefe] : tipo ? COLOR_ELITE[tipo] : "red", flash: 0, muerto: false,
    aturdido: 0, silencio: 0, lento: 1, lentoT: 0, dots: [], maldiciones: [], boost: 1, boostT: 99, empujado: 0, evx: 0, evy: 0, contactoT: 0, t: 0, cd: V.r(2, 4), cd2: 0 };
  e.colorD = e.col;
  if (tipo === "tank") { e.hp = e.maxhp = s.hp * (1.25 + 0.1 * lvl + 0.4 * J.ng); e.tanque = true; }
  if (tipo === "booster" || tipo === "exploder") e.autodestruye = V.r(16, 24);
  if (tipo === "headbutter") e.ultimoCabezazo = -99;
  if (tieneObj("intimidation") && !jefe && tipo !== "tank") { e.hp *= 1 - 0.1 * tieneObj("intimidation"); e.maxhp = e.hp; }
  if (jefe) { e.cd = jefe === "booster" ? 8 : jefe === "forcer" || jefe === "randomizer" ? 6 : 4; M.jefe = e; }
  M.ene.push(e);
  return e;
}

function velEnemigo(e) {
  let v = e.mv0;
  if (e.tanque) v *= 0.35;
  if (e.boostT < 3) v *= e.boost * remap(e.boostT, 0, 3, 1, 0.5);
  if (e.lentoT > 0) v *= e.lento;
  if (tieneObj("temporal_chains")) v *= 1 - 0.1 * tieneObj("temporal_chains");
  if (tieneObj("deceleration") && (e.dots.length || e.enDot > 0)) v *= 1 - niv3(tieneObj("deceleration"), 0.15, 0.25, 0.35);
  return v;
}

function pasoEnemigos(dt) {
  const cab = lider(); if (!cab) return;
  for (const e of M.ene) {
    if (e.muerto) continue;
    e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.contactoT > 0) e.contactoT -= dt; if (e.enDot > 0) e.enDot -= dt;
    if (e.aturdido > 0) e.aturdido -= dt; if (e.silencio > 0) e.silencio -= dt; if (e.lentoT > 0) e.lentoT -= dt; if (e.boostT < 3) e.boostT += dt;
    for (let i = e.maldiciones.length - 1; i >= 0; i--) { e.maldiciones[i].t -= dt; if (e.maldiciones[i].t <= 0) e.maldiciones.splice(i, 1); }
    pasoDotsEnemigo(e, dt); if (e.muerto) continue;
    const libre = !(e.aturdido > 0), especial = libre && !(e.silencio > 0);
    // empujado: vuela sin dirigirse y puede chocar la pared
    if (e.empujado > 0) {
      e.empujado -= dt; e.x += e.evx * dt; e.y += e.evy * dt; e.evx *= 1 - 3 * dt; e.evy *= 1 - 3 * dt;
      let pared = false;
      if (e.x < AR.x1 + e.rad || e.x > AR.x2 - e.rad) { e.evx = -e.evx * 0.5; pared = true; }
      if (e.y < AR.y1 + e.rad || e.y > AR.y2 - e.rad) { e.evy = -e.evy * 0.5; pared = true; }
      e.x = lim(e.x, AR.x1 + e.rad, AR.x2 - e.rad); e.y = lim(e.y, AR.y1 + e.rad, AR.y2 - e.rad);
      if (pared && !e.chocoPared) { e.chocoPared = true; golpeDePared(e); }
      if (e.empujado <= 0) { e.chocoPared = false; e.golpePared = 0; }
      continue;
    }
    // el cabezazo: carga 2 s (se pone blanco) y embiste a 300 px/s
    if (e.tipo === "headbutter") {
      if (e.cargando != null) { e.cargando += dt; if (e.cargando >= 2) { e.cargando = null; if (especial) { e.embiste = 0.75; const a = Math.atan2(cab.y - e.y, cab.x - e.x); e.vx = Math.cos(a) * 300; e.vy = Math.sin(a) * 300; sfx("viento", 0.4, 1.5); } else e.cabezazo = false; } }
      else if (!e.embiste && especial && dist(e, cab) < 76 && e.t - e.ultimoCabezazo > 10) { e.cargando = 0; e.cabezazo = true; e.ultimoCabezazo = e.t; }
    }
    if (e.embiste > 0) { e.embiste -= dt; if (e.embiste <= 0) { e.cabezazo = false; } }
    else if (libre && e.cargando == null) {
      // perseguir: a la cabeza (o a quien lo provocó), con un giro limitado y sin apilarse
      const obj = e.provocado && e.provocado.t > 0 ? e.provocado : cab;
      if (e.provocado) e.provocado.t -= dt;
      const a = Math.atan2(obj.y - e.y, obj.x - e.x), v = velEnemigo(e);
      e.vx += (Math.cos(a) * v - e.vx) * Math.min(1, 4 * dt); e.vy += (Math.sin(a) * v - e.vy) * Math.min(1, 4 * dt);
    } else { e.vx *= 1 - 4 * dt; e.vy *= 1 - 4 * dt; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (e.x < AR.x1 + e.rad || e.x > AR.x2 - e.rad) e.vx = -e.vx * 0.5;
    if (e.y < AR.y1 + e.rad || e.y > AR.y2 - e.rad) e.vy = -e.vy * 0.5;
    e.x = lim(e.x, AR.x1 + e.rad, AR.x2 - e.rad); e.y = lim(e.y, AR.y1 + e.rad, AR.y2 - e.rad);
    if (Math.hypot(e.vx, e.vy) > 2) e.r += lim(difAng(e.r, Math.atan2(e.vy, e.vx)), -8 * dt, 8 * dt);
    // los élites
    if (e.autodestruye != null) { e.autodestruye -= dt; if (e.autodestruye <= 0) { e.autodestruye = null; herirEnemigo(e, 1e6, {}); continue; } }
    if (e.tipo === "tank" && especial) { e.cd -= dt; if (e.cd <= 0) { e.cd = V.r(3, 5); const o = M.ene.find((x) => x !== e && !x.muerto && dist(x, e) < 64); if (o) { rayoFx(e, o, "yellow"); sfx("magia", 0.3, 0.6); const a = Math.atan2(cab.y - o.y, cab.x - o.x); o.evx = Math.cos(a) * 120; o.evy = Math.sin(a) * 120; o.empujado = 0.5; } } }
    if (e.tipo === "shooter" && especial) { e.cd -= dt; if (e.cd <= 0) { e.cd = V.r(4, 6); for (let i = 0; i < 3; i++) setTimeoutJuego(Math.max(1 - e.lvl * 0.01, 0.25) * 0.15 * i, () => { if (e.muerto) return; const a = Math.atan2(cab.y - e.y, cab.x - e.x); sfx("tiro", 0.25, 0.7); golpeFx(e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, 4); tiroEnemigo(e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, a, Math.min(140 + 3.5 * e.lvl + 2 * J.ng, 300), e.dmg * (1 + 0.05 * J.ng)); }); } }
    if (e.jefe && especial) pasoJefe(e, dt, cab);
  }
  // que no se apilen: se corren de a pares (barato con ≤150)
  const vivos = M.ene.filter((e) => !e.muerto);
  for (let i = 0; i < vivos.length; i++) for (let j = i + 1; j < vivos.length; j++) {
    const a = vivos[i], b = vivos[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, r = a.rad + b.rad;
    if (d2 < r * r && d2 > 0.01) { const d = Math.sqrt(d2), k = (r - d) / d * 0.5; const ma = a.jefe ? 0.1 : 1, mb = b.jefe ? 0.1 : 1; a.x -= dx * k * ma; a.y -= dy * k * ma; b.x += dx * k * mb; b.y += dy * k * mb; }
  }
  // el choque con la víbora: el enemigo sale despedido, se lleva el daño del héroe y le pega el suyo
  for (const e of vivos) {
    if (e.muerto || e.contactoT > 0) continue;
    for (const u of M.vib) {
      if (u.muerto) continue;
      const dx = e.x - u.x, dy = e.y - u.y, r = e.rad + RADIO_H;
      if (dx * dx + dy * dy > r * r) continue;
      e.contactoT = 0.35;
      const a = Math.atan2(dy, dx);
      empujar(e, V.r(25, 35), a, u);
      golpeFx((e.x + u.x) / 2, (e.y + u.y) / 2, 6);
      particula(e.x, e.y, u.col); particula(e.x, e.y, e.col);
      herirEnemigo(e, (u.id === "drifter" || u.id === "mindkeeper" ? 2 : 1) * u.dmg, { u, tipo: "contacto" });
      if (e.embiste > 0 || e.cabezazo) { herirHeroe(u, (4 + Math.floor(e.lvl / 3)) * e.dmg); e.embiste = 0; e.cabezazo = false; }
      else herirHeroe(u, e.dmg);
      break;
    }
  }
  for (let i = M.ene.length - 1; i >= 0; i--) if (M.ene[i].muerto) M.ene.splice(i, 1);
}

/** Un enemigo empujado que da contra la pared (juggernaut, impacto pesado, temblor, fractura). */
function golpeDePared(e) {
  sfx("golpe", 0.4, 0.6);
  const f = e.fuerzaEmpuje || 30, u = e.empujadoPor || lider();
  if (e.golpePared) herirEnemigo(e, e.golpePared, { u, tipo: "area" });
  if (tieneObj("heavy_impact")) herirEnemigo(e, f * 0.5, { u, tipo: "area" });
  if (tieneObj("tremor")) { crearArea({ x: e.x, y: e.y, rs: Math.min(48, 8 + f * 0.2), dmg: f * 0.3, u, col: "yellow" }); temblor(2); }
  if (tieneObj("fracture") && u) for (let k = 0; k < 6; k++) tiro({ x: e.x, y: e.y, ang: (k / 6) * TAU, v: 200, dmg: 30, u, forma: "cuchillo", perfora: 1, col: "red" });
}

// ── los jefes ──
function pasoJefe(e, dt, cab) {
  if (e.jefe === "randomizer" && Math.floor(e.t / 0.07) !== e.ultColor) { e.ultColor = Math.floor(e.t / 0.07); e.colorD = V.uno(["green", "purple", "yellow", "blue"]); }
  e.cd -= dt;
  if (e.tirando) { const tt = e.tirando; tt.t += dt; for (const x of M.ene) if (x !== e && !x.muerto && dist(x, tt) < 160) { const a = Math.atan2(tt.y - x.y, tt.x - x.x); x.x += Math.cos(a) * 60 * dt; x.y += Math.sin(a) * 60 * dt; } if (tt.t >= 2) { e.tirando = null; sfx("empuja", 0.7); temblor(4); for (const x of M.ene) if (x !== e && !x.muerto && dist(x, tt) < 160) { const a = Math.atan2(cab.y - x.y, cab.x - x.x); x.evx = Math.cos(a) * 220; x.evy = Math.sin(a) * 220; x.empujado = 0.9; } } }
  if (e.cd > 0) return;
  let k = e.jefe;
  if (k === "randomizer") k = V.uno(["booster", "exploder", "swarmer", "forcer"]);
  e.cd = { booster: 8, exploder: 4, swarmer: 4, forcer: 6 }[k];
  if (e.jefe === "randomizer") e.cd = 6;
  const otros = M.ene.filter((x) => x !== e && !x.muerto);
  if (k === "booster") { const cer = otros.filter((x) => dist(x, e) < 128).slice(0, 4); if (cer.length) sfx("aparece", 0.5); for (const x of cer) { rayoFx(e, x, "green"); impulsoVel(x, 3 + e.lvl * 0.015 + J.ng * 0.1); } }
  if (k === "exploder" && otros.length) { const x = V.uno(otros); rayoFx(e, x, "blue"); crearMina(x.x, x.y, e); }
  if (k === "swarmer" && otros.length) { const x = V.uno(otros); rayoFx(e, x, "purple"); sfx("bicho", 0.5); x.muerto = true; golpeFx(x.x, x.y, 10, "purple"); const n = A.ent(4, 6); for (let i = 0; i < n; i++) crearBichoEnemigo(x.x, x.y, e); }
  if (k === "forcer") { let cx = 0, cy = 0; const l = otros.length ? otros : [cab]; for (const x of l) { cx += x.x; cy += x.y; } cx = cx / l.length + V.r(-16, 16); cy = cy / l.length + V.r(-16, 16); e.tirando = { x: cx, y: cy, t: 0 }; sfx("tirar", 0.6); }
}

// ── cómo aparecen: una marca que titila y después, uno cada 0,1 s alrededor ──
const OFFS = [{ x: 0, y: 0 }, { x: -12, y: -12 }, { x: 12, y: -12 }, { x: 12, y: 12 }, { x: -12, y: 12 }];
function marcaYSpawn(p, n, retraso = 1.125, conElite = true) {
  M.marcas.push({ x: p.x, y: p.y, t: 0, dur: retraso });
  sfx("marca", 0.4);
  M.generando++;
  setTimeoutJuego(retraso, () => {
    for (let i = 0; i < n; i++) setTimeoutJuego(i * 0.1, () => {
      if (M.fase !== "pelea") return;
      const o = OFFS[i % 5], x = lim(p.x + o.x, AR.x1 + 8, AR.x2 - 8), y = lim(p.y + o.y, AR.y1 + 8, AR.y2 - 8);
      if (M.vib.some((u) => !u.muerto && Math.hypot(u.x - x, u.y - y) < 10)) return;      // encima de la víbora no aparece
      sfx("aparece", 0.2); golpeFx(x, y, 8, "fg");
      let tipo = null;
      const pesos = ELITE_PESOS[J.nivel], suma = pesos.reduce((s, v) => s + (v || 0), 0);
      if (conElite && A.si(suma)) tipo = ELITE_TIPOS[J.nivel][A.peso(pesos)];
      crearEnemigo(x, y, tipo);
    });
    setTimeoutJuego(n * 0.1 + 0.05, () => { M.generando--; });
  });
}
/** Oleada normal: por un costado o al centro; a veces repartida en cuatro puntos. */
function soltarOleada(n) {
  if (A.si(REPARTIDOS[J.nivel])) {
    for (let k = 0; k < 4; k++) { const p = { x: V.r(AR.x1 + 30, AR.x2 - 30), y: V.r(AR.y1 + 30, AR.y2 - 30) }; setTimeoutJuego(k * 0.25, () => marcaYSpawn(p, Math.max(1, Math.floor(n / 4)))); }
  } else {
    const lado = A.uno(["izq", "medio", "der"]);
    const p = { izq: { x: AR.x1 + 32, y: AR.cy }, medio: { x: AR.cx, y: AR.cy }, der: { x: AR.x2 - 32, y: AR.cy } }[lado];
    // que no aparezca arriba de la cabeza: si está cerca, el punto se corre al otro lado
    const c = lider(); if (c && Math.hypot(c.x - p.x, c.y - p.y) < 50) p.y = c.y < AR.cy ? AR.y2 - 30 : AR.y1 + 30;
    marcaYSpawn(p, n);
  }
}
