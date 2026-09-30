// ─────────────────────────────────────────────────────────────────────────────
// LOS ATAQUES DE LOS HÉROES. cd = segundos entre ataques (se divide por la velocidad de ataque);
// rango = el "attack_sensor" del original: si no hay nadie adentro, el ataque espera cargado.
// rango null = pasa solo, haya o no enemigos (curas, bombas, invocaciones).
// ─────────────────────────────────────────────────────────────────────────────

const angA = (u, e) => Math.atan2(e.y - u.y, e.x - u.x);
/** Un punto al azar cerca de la víbora, adentro de la arena. */
function cercaDe(u, r = 48) { return { x: lim(u.x + V.r(-r, r), AR.x1 + 12, AR.x2 - 12), y: lim(u.y + V.r(-r, r), AR.y1 + 12, AR.y2 - 12) }; }
/** Los enemigos cercanos (hasta n), del más cerca al más lejos. */
function nCercanos(u, r, n) { return enemigosEn(u.x, u.y, r).sort((a, b) => dist(a, u) - dist(b, u)).slice(0, n); }
function maldecir(u, r, n, tipo, dur) {
  const extra = (M.clases.nv.curser === 2 ? 3 : M.clases.nv.curser === 1 ? 1 : 0) + niv3(tieneObj("malediction"), 1, 3, 5) * (tieneObj("malediction") ? 1 : 0);
  const blancos = nCercanos(u, r, n + extra);
  if (!blancos.length) return false;
  sfx("maldice", 0.45);
  for (const e of blancos) {
    rayoFx(u, e, "purple");
    e.maldiciones = e.maldiciones.filter((c) => c.tipo !== tipo); e.maldiciones.push({ tipo, u, t: dur });
    if (tieneObj("hextouch")) ponerDot(e, niv3(tieneObj("hextouch"), 10, 15, 20), 3, u, "hex");
    if (tieneObj("doom")) { e.perdicion = (e.perdicion || 0) + 1; if (e.perdicion >= niv3(tieneObj("doom"), 4, 3, 2)) { e.perdicion = 0; herirEnemigo(e, niv3(tieneObj("doom"), 100, 150, 200), { u, tipo: "area" }); golpeFx(e.x, e.y, 12, "purple"); } }
  }
  return blancos;
}
function orbeCuraCerca(u) { const p = cercaDe(u, 60); soltarCura(p.x, p.y); }

const ATQ = {
  drifter: { cd: 2, rango: 96, proy: true, fn: (u, e) => { sfx("tiro", 0.5); tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 220, dmg: u.dmg, u }); } },
  swordsman: { cd: 3, rango: 48, fn: (u) => { sfx("espada", 0.55); const rs = 32 * u.asz, n = enemigosEn(u.x, u.y, rs).length; crearArea({ x: u.x, y: u.y, rs, dmg: u.dmg * u.adm * (1 + 0.15 * n), u, col: u.col }); } },
  magician: { cd: 2, rango: 96, fn: (u, e) => { sfx("magia", 0.5); crearArea({ x: e.x, y: e.y, rs: 14 * u.asz, dmg: u.dmg * u.adm, u, col: u.col }); },
    tick: (u, dt) => { if (u.lvl < 3) return; u.b.magiaT = (u.b.magiaT || 0) + dt; if (u.b.magiaT >= 12) { u.b.magiaT = 0; u.b.magia = 6; } if (u.b.magia > 0) u.b.magia -= dt; } },
  archer: { cd: 2, rango: 160, proy: true, fn: (u, e) => { sfx("flecha", 0.55); tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 260, dmg: u.dmg, u, forma: "flecha", perfora: 999, rebota: u.lvl >= 3 ? 3 : 0 }); } },
  scout: { cd: 2, rango: 64, proy: true, fn: (u, e) => { sfx("cuchillo", 0.5); tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 250, dmg: u.dmg, u, forma: "cuchillo", salta: u.lvl >= 3 ? 6 : 3 }); } },
  cleric: { cd: 8, rango: null, fn: (u) => { const n = u.lvl >= 3 ? 4 : 1; for (let i = 0; i < n; i++) orbeCuraCerca(u); } },
  orbweaver: { cd: 4, rango: 128, proy: true, fn: (u, e) => {
    sfx("magia", 0.4);
    const a = angA(u, e), per = (u.lvl >= 3 ? 0.35 : 0.5), n = u.lvl >= 3 ? 2 : 1;
    crearInv({ x: u.x, y: u.y, vx: Math.cos(a) * 18, vy: Math.sin(a) * 18, dur: 6, u, cd: per, rs: 4,
      paso: (c, dt) => { c.x = lim(c.x + c.vx * dt, AR.x1 + 4, AR.x2 - 4); c.y = lim(c.y + c.vy * dt, AR.y1 + 4, AR.y2 - 4); c.cd -= dt; if (c.cd <= 0) { c.cd = per; const o = masCercano(c.x, c.y, 128); if (o) { for (let k = 0; k < n; k++) tiro({ x: c.x, y: c.y, ang: Math.atan2(o.y - c.y, o.x - c.x) + (k ? 0.25 : 0), v: 200, dmg: u.dmg, u }); sfx("tiro", 0.25, 1.3); } } },
      dibujar: (c) => { circulo(c.x, c.y, 4 + Math.sin(c.t * 8) * 0.6, COL.blue2); circulo(c.x, c.y, 2, COL.fg); } });
  } },
  merchant: { cd: 0, rango: null, pasivo: true },
  wizard: { cd: 2, rango: 128, proy: true, fn: (u, e) => { sfx("magia", 0.5); tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 200, dmg: u.dmg, u, area: 16, salta: u.lvl >= 3 ? 2 : 0 }); } },
  bomber: { cd: 8, rango: null, fn: (u) => {
    const k = u.lvl >= 3 ? 2 : 1, p = { x: u.x, y: u.y };
    crearInv({ x: p.x, y: p.y, dur: 3, u, construccion: true, dibujar: (c) => { const on = Math.floor(c.t * (c.t > 2 ? 12 : 4)) % 2; redondo(c.x, c.y, 6, 6, 0, on ? COL.fg : COL.orange, 2); },
      alIrse: (c) => { sfx("explota", 0.6); temblor(3); crearArea({ x: c.x, y: c.y, rs: 32 * u.asz * k, dmg: 2 * u.dmg * u.adm * k * conjBuf(), u, col: "orange" }); } });
  } },
  sage: { cd: 9, rango: 96, fn: (u, e) => {
    sfx("tirar", 0.5);
    const a = angA(u, e), vict = new Set();
    const p = tiro({ x: u.x, y: u.y, ang: a, v: 40, dmg: 0, u, forma: "orbe", vida: 4, sinChoque: true, col: "purple", tam: 2,
      cadaCuadro: (t, dt) => { for (const x of enemigosEn(t.x, t.y, 64)) { if (x.jefe) continue; const b = Math.atan2(t.y - x.y, t.x - x.x); x.x += Math.cos(b) * 50 * dt; x.y += Math.sin(b) * 50 * dt; vict.add(x); } },
      alMorir: (t) => { if (u.lvl >= 3) { for (const x of vict) herirEnemigo(x, 3 * u.dmg, { u, tipo: "area" }); crearArea({ x: t.x, y: t.y, rs: 40, dmg: 0, u, col: "purple" }); sfx("area", 0.6); } } });
    p.frena = 0;
  } },
  squire: { cd: 0, rango: null, pasivo: true },
  gunslinger: { cd: 2, rango: 96, proy: true, fn: (u, e) => {
    const par = (ang) => { for (const s of [-1, 1]) { const px = Math.cos(ang + Math.PI / 2) * 3 * s, py = Math.sin(ang + Math.PI / 2) * 3 * s; tiro({ x: u.x + px, y: u.y + py, ang, v: 260, dmg: u.dmg, u }); } sfx("tiro", 0.45, 0.8); };
    par(angA(u, e));
    u.cuentaGun = (u.cuentaGun || 0) + 1;
    if (u.lvl >= 3 && u.cuentaGun % 5 === 0) for (let i = 1; i <= 16; i++) setTimeoutJuego(i * 0.12, () => { if (u.muerto) return; const o = masCercano(u.x, u.y, 128); if (o) par(angA(u, o)); });
  } },
  sentry: { cd: 7, rango: null, proy: true, fn: (u) => {
    sfx("torreta", 0.6);
    const per = u.lvl >= 3 ? 0.67 : 1;
    crearInv({ x: u.x, y: u.y, dur: 10, u, construccion: true, cd: per, giro: 0, rs: 5,
      paso: (c, dt) => { c.giro += dt * 1.5; c.cd -= dt; if (c.cd <= 0) { c.cd = per; tirosTorreta(c, u); if (tieneObj("rearm")) setTimeoutJuego(0.2, () => tirosTorreta(c, u)); provocar(c); } },
      dibujar: (c) => { redondo(c.x, c.y, 9, 9, c.giro, COL.green, 2); for (let k = 0; k < 4; k++) { const a = c.giro + k * Math.PI / 2; linea(c.x, c.y, c.x + Math.cos(a) * 7, c.y + Math.sin(a) * 7, COL.fg, 2); } } });
  } },
  timekeeper: { cd: 0, rango: null, pasivo: true },
  barbarian: { cd: 8, rango: 48, fn: (u) => { sfx("empuja", 0.6); temblor(3); crearArea({ x: u.x, y: u.y, rs: 32 * u.asz, dmg: u.dmg * u.adm, u, col: u.col, aturdir: 4, sismo: u.lvl >= 3 }); } },
  frostcaller: { cd: 0, rango: null, aura: true, init: (u) => { u.aura = crearDot({ x: u.x, y: u.y, rs: 72 * u.asz, dps: u.dmg * u.adm, dur: 1e9, u, col: "blue", sigue: u, lento: u.lvl >= 3 ? 0.4 : 0, aura: true }); } },
  beastmaster: { cd: 2, rango: 160, proy: true, fn: (u, e) => { sfx("cuchillo", 0.5); tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 250, dmg: u.dmg, u, forma: "cuchillo", alPegar: (t, x, crit) => { if (crit > 1) for (let i = 0; i < 2; i++) crearBicho(x.x, x.y, u); } }); } },
  jester: { cd: 6, rango: 96, fn: (u) => { maldecir(u, 128, 6, "jester", 6); } },
  woodcarver: { cd: 16, rango: null, fn: (u) => {
    const p = cercaDe(u, 50), per = u.lvl >= 3 ? 3 : 6;
    crearInv({ x: p.x, y: p.y, dur: 12, u, construccion: true, cd: per, paso: (c, dt) => { c.cd -= dt; if (c.cd <= 0) { c.cd = per; soltarCura(c.x + V.r(-14, 14), c.y + V.r(-14, 14)); } provocar(c, dt); },
      dibujar: (c) => { if (u.lvl >= 3) { circulo(c.x, c.y - 4, 6, COL.green); g.fillStyle = COL.orange; g.fillRect(Math.round(c.x) - 1, Math.round(c.y), 3, 6); } else { redondo(c.x, c.y, 6, 10, 0, COL.fgAlt, 2); circulo(c.x, c.y - 6, 3, COL.fgAlt); } } });
  } },
  psychic: { cd: 3, rango: 64, fn: (u, e) => {
    const golpe = () => { const o = u.lvl >= 3 ? A.uno(M.ene.filter((x) => !x.muerto)) : masCercano(u.x, u.y, 64); if (!o) return; sfx("magia", 0.4, 0.8); crearArea({ x: o.x, y: o.y, rs: 14 * u.asz, dmg: u.dmg * u.adm, u, col: "fg" }); };
    golpe(); if (u.lvl >= 3) setTimeoutJuego(0.3, golpe);
  }, rangoLv3: 9999 },
  witch: { cd: 4, rango: null, fn: (u) => {
    if (!hayEnemigos()) return;
    const a = V.f() * TAU, v = 40;
    const d = crearDot({ x: u.x, y: u.y, rs: 20 * u.asz, dps: u.dmg * u.adm, dur: 4, u, col: "purple", vx: Math.cos(a) * v, vy: Math.sin(a) * v });
    if (u.lvl >= 3) { d.cada = 0; d.cadaTick = (dd) => { dd.cada += 0.25; if (dd.cada >= 1) { dd.cada = 0; const o = masCercano(dd.x, dd.y, 128); if (o) tiro({ x: dd.x, y: dd.y, ang: Math.atan2(o.y - dd.y, o.x - dd.x), v: 180, dmg: u.dmg, u, salta: 1, col: "purple" }); } }; }
    sfx("maldice", 0.3, 1.4);
  } },
  hushcaller: { cd: 6, rango: 96, fn: (u) => { const b = maldecir(u, 128, 5, "hush", 6); if (b) for (const e of b) { e.silencio = Math.max(e.silencio, 6); if (u.lvl >= 3) ponerDot(e, u.dmg, 6, u, "hush"); } } },
  outlaw: { cd: 3, rango: 96, proy: true, fn: (u, e) => { sfx("cuchillo", 0.55); const a = angA(u, e); for (let i = -2; i <= 2; i++) tiro({ x: u.x, y: u.y, ang: a + i * 0.2, v: 230, dmg: u.dmg, u, forma: "cuchillo", buscar: u.lvl >= 3 }); } },
  miner: { cd: 0, rango: null, pasivo: true, proy: true },
  tempest: { cd: 7, rango: 128, fn: (u) => {
    const cand = enemigosEn(u.x, u.y, 128); if (!cand.length) return; const o = A.uno(cand);
    sfx("viento", 0.6); sfx("area", 0.5); temblor(2);
    crearArea({ x: o.x, y: o.y, rs: 48 * u.asz, dmg: u.dmg * u.adm, u, col: "blue", lento: u.lvl >= 3 ? [0.4, 6] : null });
  } },
  sparkweaver: { cd: 0, rango: null, pasivo: true },
  runeblade: { cd: 2, rango: null, proy: true, fn: (u) => {
    if (!hayEnemigos()) return;
    sfx("cuchillo", 0.4, 1.2);
    const lv3 = u.lvl >= 3;
    tiro({ x: u.x, y: u.y, ang: u.r + V.r(-0.5, 0.5), v: lv3 ? 190 : 140, dmg: u.dmg, u, forma: "cuchillo", perfora: 999, espiral: lv3 ? 7 : 4.5, vida: 3 });
  } },
  mindkeeper: { cd: 0, rango: null, pasivo: true },
  engineer: { cd: 8, rango: null, proy: true, fn: (u) => {
    const n = u.lvl >= 3 ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const p = k ? cercaDe(u, 40) : { x: u.x, y: u.y }, per = u.lvl >= 3 ? 1 : 1.5, m = u.lvl >= 3 ? 1.5 : 1;
      crearInv({ x: p.x, y: p.y, dur: 16, u, construccion: true, cd: per,
        paso: (c, dt) => { c.cd -= dt; if (c.cd <= 0) { c.cd = per; const disp = () => { const o = masCercano(c.x, c.y, 160); if (!o) return; for (let i = 0; i < 3; i++) setTimeoutJuego(i * 0.08, () => tiro({ x: c.x, y: c.y, ang: Math.atan2(o.y - c.y, o.x - c.x) + V.r(-0.08, 0.08), v: 250, dmg: u.dmg * m * conjBuf(), u, col: "orange" })); sfx("torreta", 0.4); }; disp(); if (tieneObj("rearm")) setTimeoutJuego(0.3, disp); provocar(c); } },
        dibujar: (c) => { redondo(c.x, c.y, 8, 8, 0, COL.orange, 2); const o = masCercano(c.x, c.y, 160), a = o ? Math.atan2(o.y - c.y, o.x - c.x) : 0; linea(c.x, c.y, c.x + Math.cos(a) * 7, c.y + Math.sin(a) * 7, COL.fg, 2); } });
    }
    sfx("torreta", 0.6);
  } },
  juggernaut: { cd: 8, rango: 64, fn: (u) => { sfx("empuja", 0.7); temblor(3); crearArea({ x: u.x, y: u.y, rs: 32 * u.asz, dmg: u.dmg * u.adm, u, col: u.col, empuje: 150, alPegar: (e) => { if (u.lvl >= 3) e.golpePared = 4 * u.dmg; } }); } },
  pyromancer: { cd: 0, rango: null, aura: true, init: (u) => { u.aura = crearDot({ x: u.x, y: u.y, rs: 48 * u.asz, dps: u.dmg * u.adm, dur: 1e9, u, col: "red", sigue: u, aura: true }); } },
  broodmother: { cd: 2, rango: null, fn: (u) => { if (!hayEnemigos()) return; const n = u.lvl >= 3 ? 2 : 1; for (let i = 0; i < n; i++) crearBicho(u.x, u.y, u); }, cdLv3: 1 },
  assassin: { cd: 2, rango: 64, proy: true, fn: (u, e) => { sfx("cuchillo", 0.55); tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 260, dmg: u.dmg, u, forma: "cuchillo", perfora: 999, col: "purple",
    alPegar: (t, x, crit) => ponerDot(x, (u.dmg / 2) * (crit > 1 && u.lvl >= 3 ? 8 : 1), 3, u, "veneno") }); } },
  dreadbringer: { cd: 6, rango: 96, fn: (u) => { maldecir(u, 128, 6, "dread", 6); } },
  volleyer: { cd: 4, rango: 128, proy: true, fn: (u, e) => {
    u.cuentaVol = (u.cuentaVol || 0) + 1;
    const grande = u.lvl >= 3 && u.cuentaVol % 3 === 0, n = grande ? 15 : 3, a = angA(u, e);
    for (let i = 0; i < n; i++) setTimeoutJuego(i * 0.05, () => { if (!u.muerto) tiro({ x: u.x, y: u.y, ang: a + V.r(-0.25, 0.25), v: 260, dmg: u.dmg, u, forma: "flecha", empuje: grande ? 70 : 40 }); });
    sfx("flecha", 0.6);
  } },
  hivecaller: { cd: 6, rango: 96, fn: (u) => { maldecir(u, 128, 8, "hive", 6); } },
  penitent: { cd: 8, rango: null, fn: (u) => { if (!hayEnemigos()) return; herirHeroe(u, 2 * u.dmg); M.penitencia = (M.penitencia || 0) + (u.lvl >= 3 ? 0.12 : 0.04); golpeFx(u.x, u.y, 10, "red"); sfx("espada", 0.4, 0.7); } },
  tinkerer: { cd: 6, rango: null, proy: true, fn: (u) => {
    if (!hayEnemigos()) return;
    const k = u.lvl >= 3 ? 1.5 : 1, per = 1.5 / k;
    sfx("torreta", 0.5, 0.8);
    crearInv({ x: u.x, y: u.y, dur: 10, u, construccion: true, cd: per, r: 0, rs: 5,
      paso: (c, dt) => { const o = masCercano(c.x, c.y, 300); if (o) { c.r = Math.atan2(o.y - c.y, o.x - c.x); if (dist(c, o) > 50) { c.x += Math.cos(c.r) * 15 * k * dt; c.y += Math.sin(c.r) * 15 * k * dt; } } c.cd -= dt; if (c.cd <= 0 && o) { c.cd = per; tiro({ x: c.x, y: c.y, ang: c.r, v: 220, dmg: u.dmg * conjBuf(), u, col: "blue2" }); sfx("tiro", 0.25, 0.7); } provocar(c); },
      alIrse: (c) => { if (u.lvl >= 3) for (let i = 0; i < 12; i++) tiro({ x: c.x, y: c.y, ang: (i / 12) * TAU, v: 200, dmg: u.dmg, u, col: "blue2" }); golpeFx(c.x, c.y, 8, "blue2"); },
      dibujar: (c) => { redondo(c.x, c.y, 9, 7, c.r, COL.blue2, 2); redondo(c.x + Math.cos(c.r) * 3, c.y + Math.sin(c.r) * 3, 3, 3, c.r, COL.fg, 1); } });
  } },
  moneylender: { cd: 6, rango: 96, fn: (u) => {
    const b = maldecir(u, 128, 3, "debt", 1e9); if (!b) return;
    for (const e of b) { e.deuda = (e.deuda || 0) + 1; if (!e.dots.some((d) => d.tipo === "deuda")) ponerDot(e, u.dmg, 1e9, u, "deuda"); if (u.lvl >= 3 && e.deuda >= 3) { e.deuda = 0; herirEnemigo(e, 10 * u.dmg, { u, tipo: "area" }); golpeFx(e.x, e.y, 14, "yellow2"); sfx("oro", 0.6, 0.6); } }
  } },
  gambler: { cd: 2, rango: null, fn: (u) => {
    const vivos = M.ene.filter((e) => !e.muerto); if (!vivos.length) return;
    const veces = u.lvl >= 3 ? (A.si(20) ? 4 : A.si(40) ? 3 : A.si(60) ? 2 : 1) : 1;
    for (let i = 0; i < veces; i++) setTimeoutJuego(i * 0.15, () => { const o = A.uno(M.ene.filter((e) => !e.muerto)); if (!o) return; herirEnemigo(o, 2 * J.oro * (u.adm || 1), { u, tipo: "area" }); golpeFx(o.x, o.y, 10, "yellow2"); rayoFx(u, o, "yellow2"); sfx("oro", 0.35, 0.8 + i * 0.1); });
  } },
  priest: { cd: 12, rango: null, fn: (u) => { for (let i = 0; i < 3; i++) orbeCuraCerca(u); },
    init: (u) => { if (u.lvl >= 3) A.mezclar(heroesVivos().slice()).slice(0, 3).forEach((x) => { x.b.salvar = true; }); } },
  whirlblade: { cd: 4, rango: 36, fn: (u) => {
    const golpe = () => { if (u.muerto) return; sfx("espada", 0.6, 0.8); crearArea({ x: u.x, y: u.y, rs: 36 * u.asz, dmg: 5 * u.dmg * u.adm, u, col: u.col }); };
    golpe(); if (u.lvl >= 3) { setTimeoutJuego(0.25, golpe); setTimeoutJuego(0.5, golpe); }
  } },
  gravitist: { cd: 4, rango: null, fn: (u) => {
    const cer = enemigosEn(u.x, u.y, 128); if (!cer.length) return;
    let cx = 0, cy = 0; for (const e of cer) { cx += e.x; cy += e.y; } cx /= cer.length; cy /= cer.length;
    sfx("tirar", 0.6);
    crearDot({ x: cx, y: cy, rs: 64 * u.asz, dps: 0, dur: 2, u, col: "fg", tirar: 60,
      alTerminar: (d) => { if (u.lvl >= 3) { crearArea({ x: d.x, y: d.y, rs: d.rs, dmg: 4 * u.dmg * u.adm, u, col: "fg", empuje: 120 }); sfx("empuja", 0.6); temblor(3); } } });
  } },
  pixie: { cd: 6, rango: null, fn: (u) => {
    const n = u.lvl >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) orbeCuraCerca(u);
    const cand = heroesVivos().filter((x) => HEROES[x.id].ataca && x !== u);
    A.mezclar(cand).slice(0, n).forEach((x) => { x.b.hada = 6; rayoFx(u, x, "green"); });
    sfx("aparece", 0.5, 1.3);
  } },
  bladelord: { cd: 4, rango: 64, proy: true, fn: (u, e) => {
    sfx("espada", 0.5, 1.2);
    const a = angA(u, e);
    for (let i = -1; i <= 1; i++) tiro({ x: u.x, y: u.y, ang: a + i * 0.35, v: 180, dmg: u.dmg, u, forma: "hoja", vida: 0.6,
      alMorir: (t) => { const n = enemigosEn(t.x, t.y, 16 * u.asz).length; crearArea({ x: t.x, y: t.y, rs: 16 * u.asz, dmg: u.dmg * u.adm + (u.lvl >= 3 ? (u.dmg / 3) * n : 0), u, col: u.col }); } });
  } },
  plaguedoctor: { cd: 5, rango: null, fn: (u) => {
    const o = masCercano(u.x, u.y, 128); if (!o) return;
    sfx("fuego", 0.4, 0.6);
    crearDot({ x: o.x, y: o.y, rs: 24 * u.asz, dps: u.dmg * u.adm, dur: 4, u, col: "purple" });
  }, init: (u) => { if (u.lvl >= 3) u.aura = crearDot({ x: u.x, y: u.y, rs: 36 * u.asz, dps: u.dmg * u.adm, dur: 1e9, u, col: "purple", sigue: u, aura: true }); } },
  cannoneer: { cd: 6, rango: 128, proy: true, fn: (u, e) => {
    sfx("canon", 0.7); temblor(2);
    tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 200, dmg: 2 * u.dmg, u, forma: "cañon", area: 32, tam: 1.6,
      alPegar: (t, x) => { if (u.lvl >= 3) for (let i = 0; i < 7; i++) setTimeoutJuego(0.1 + i * 0.1, () => { crearArea({ x: x.x + V.r(-40, 40), y: x.y + V.r(-40, 40), rs: 24 * u.asz, dmg: (u.dmg / 2) * u.adm, u, col: u.col }); sfx("area", 0.3); }); } });
  } },
  magmaturge: { cd: 12, rango: 128, fn: (u, e) => {
    const n = u.lvl >= 3 ? 8 : 4, per = u.lvl >= 3 ? 0.5 : 1, p = { x: e.x, y: e.y };
    sfx("fuego", 0.6, 0.5);
    crearInv({ x: p.x, y: p.y, dur: n * per + 0.2, u, cd: per, veces: 0,
      paso: (c, dt) => { c.cd -= dt; if (c.cd <= 0 && c.veces < n) { c.cd = per; c.veces++; crearArea({ x: c.x + V.r(-12, 12), y: c.y + V.r(-12, 12), rs: 24 * u.asz, dmg: u.dmg * u.adm, u, col: "red" }); sfx("explota", 0.35); temblor(1.5); } },
      dibujar: (c) => { g.fillStyle = COL.red; g.beginPath(); g.moveTo(c.x - 7, c.y + 4); g.lineTo(c.x - 2, c.y - 5); g.lineTo(c.x + 2, c.y - 5); g.lineTo(c.x + 7, c.y + 4); g.fill(); g.fillStyle = COL.orange; g.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 6, 3, 2); } });
  } },
  warden: { cd: 12, rango: null, fn: (u) => {
    if (!hayEnemigos()) return;
    const n = u.lvl >= 3 ? 2 : 1;
    A.mezclar(heroesVivos().slice()).slice(0, n).forEach((x) => {
      sfx("aparece", 0.5, 0.7);
      crearInv({ x: x.x, y: x.y, dur: 6, u, campo: true, rs: 26, sigue: x,
        paso: (c) => { if (c.sigue.muerto) c.t = c.dur; c.x = c.sigue.x; c.y = c.sigue.y; for (const e of enemigosEn(c.x, c.y, c.rs)) { const a = Math.atan2(e.y - c.y, e.x - c.x); e.x = c.x + Math.cos(a) * (c.rs + e.rad); e.y = c.y + Math.sin(a) * (c.rs + e.rad); } },
        dibujar: (c) => { g.strokeStyle = alfa("yellow", 0.8); g.lineWidth = 1; g.beginPath(); g.arc(c.x, c.y, c.rs, 0, TAU); g.stroke(); g.fillStyle = alfa("yellow", 0.08); g.fill(); } });
    });
  } },
  blightbow: { cd: 2, rango: 160, proy: true, fn: (u, e) => { sfx("flecha", 0.5, 0.8); tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 260, dmg: u.dmg, u, forma: "flecha", alPegar: (t, x) => { if (u.lvl >= 3) for (let i = 0; i < 2; i++) crearBicho(x.x, x.y, u); } }); } },
  thief: { cd: 2, rango: 64, proy: true, fn: (u, e) => {
    sfx("cuchillo", 0.5, 1.1);
    const p = tiro({ x: u.x, y: u.y, ang: angA(u, e), v: 260, dmg: 2 * u.dmg, u, forma: "cuchillo", salta: 5 });
    p.alPegar = (t, x, crit) => { if (crit > 1 && u.lvl >= 3 && !t.ultra) { t.ultra = true; t.dmg = 10 * u.dmg; t.salta += 5; J.oro++; M.oroJuntado++; sfx("oro", 0.5); } };
  } },
};
for (const [k, a] of Object.entries(ATQ)) if (a.proy) HEROES[k].proy = true;

function tirosTorreta(c, u) { const lv3 = u.lvl >= 3; for (let k = 0; k < 4; k++) tiro({ x: c.x, y: c.y, ang: c.giro + k * Math.PI / 2, v: 220, dmg: u.dmg * conjBuf(), u, col: "green", rebota: lv3 ? 2 : 0 }); sfx("torreta", 0.3); }
/** Provocar (objeto): las construcciones atraen a los enemigos cercanos por 2 s. */
function provocar(c) { if (!tieneObj("taunt") || !A.si(10 * tieneObj("taunt"))) return; for (const e of enemigosEn(c.x, c.y, 64)) { e.provocado = { x: c.x, y: c.y, t: 2 }; } }

/** Al empezar un nivel: auras, bonos de los que no pegan y los objetos que eligen a alguien. */
function prepararHeroes() {
  const vivos = heroesVivos();
  M.buf = {};
  for (const u of vivos) {
    if (u.id === "squire") M.buf.squire = Math.max(M.buf.squire || 0, u.lvl);
    if (u.id === "timekeeper") { M.buf.timekeeper = true; if (u.lvl >= 3) M.buf.timekeeper3 = true; }
    if (u.id === "sparkweaver") M.buf.sparkweaver = Math.max(M.buf.sparkweaver || 0, u.lvl);
  }
  for (const u of vivos) stats(u);
  for (const u of vivos) { const a = ATQ[u.id]; if (a && a.init) a.init(u); }
  if (tieneObj("awakening")) { const magos = vivos.filter((u) => u.clases.includes("mage") && HEROES[u.id].ataca); if (magos.length) A.uno(magos).b.despertar = niv3(tieneObj("awakening"), 1.5, 1.75, 2); }
  if (tieneObj("enchanted") && M.clases.cuenta.enchanter >= 2) { const c = vivos.filter((u) => HEROES[u.id].ataca); if (c.length) A.uno(c).b.encantado = niv3(tieneObj("enchanted"), 1.33, 1.66, 1.99); }
  // los orbes psíquicos (bono de clase): orbitan la cabeza y pegan al tocar
  const nvP = M.clases.nv.psyker;
  M.orbesPsi = [];
  if (nvP || tieneObj("psyker_orbs")) {
    const n = (nvP ? 2 * nvP + M.clases.cuenta.psyker : 0) + (tieneObj("psyker_orbs") ? niv3(tieneObj("psyker_orbs"), 1, 2, 4) : 0);
    for (let i = 0; i < n; i++) M.orbesPsi.push({ a: (i / n) * TAU, x: 0, y: 0, cd: new Map() });
  }
}
/** Cada cuadro: los ataques de cada héroe, el hechicero que repite, la ráfaga de los tiradores y los objetos con reloj. */
function pasoHeroes(dt) {
  const vivos = heroesVivos();
  for (const u of vivos) {
    stats(u);
    if (u.flash > 0) u.flash -= dt; if (u.flashPared > 0) u.flashPared -= dt; if (u.curaFx > 0) u.curaFx -= dt;
    if (u.b.hada > 0) u.b.hada -= dt;
    if (u.zombi > 0) { u.zombi -= dt; if (u.zombi <= 0) matarHeroe(u); }
    const a = ATQ[u.id]; if (!a || a.pasivo || a.aura) { if (a && a.aura && u.aura) { u.aura.rs = (u.id === "pyromancer" ? 48 : 72) * u.asz; u.aura.dps = u.dmg * u.adm; } continue; }
    if (a.tick) a.tick(u, dt);
    const cd = (u.lvl >= 3 && a.cdLv3) || a.cd;
    u.cdTotal = cd;
    if (u.t > 0) { u.t -= dt * u.aspd; continue; }
    let obj = null;
    const rango = (u.lvl >= 3 && a.rangoLv3) || a.rango;
    if (rango) { obj = masCercano(u.x, u.y, rango); if (!obj) continue; }
    a.fn(u, obj);
    u.t = cd;
    u.cuentaAtq++;
    // hechiceros: repiten cada 4/3/2 ataques (y los campos de los objetos)
    const nvS = M.clases.nv.sorcerer;
    if (nvS && u.clases.includes("sorcerer") && u.cuentaAtq % (5 - nvS) === 0) setTimeoutJuego(0.25, () => { if (u.muerto) return; const o = rango ? masCercano(u.x, u.y, rango) : null; if (rango && !o) return; a.fn(u, o); camposHechicero(u, o || u); });
    // tiradores: 8/16 % de soltar una ráfaga
    const nvR = M.clases.nv.ranger;
    if (nvR && u.clases.includes("ranger") && obj && A.si(nvR === 2 ? 16 : 8)) rafaga(u, angA(u, obj));
  }
  // los orbes psíquicos
  const cab = lider();
  if (cab && M.orbesPsi.length) {
    const vel = 2 * (1 + 0.25 * (tieneObj("orbitism") || 0)), rad = 22 * (1 + 0.33 * (tieneObj("psychosense") || 0));
    const psis = vivos.filter((u) => u.clases.includes("psyker")), base = psis.length ? psis.reduce((s, u) => s + u.dmg, 0) / psis.length : cab.dmg;
    const dmg = base * 0.5 * (1 + 0.4 * (tieneObj("psychosink") || 0));
    for (const o of M.orbesPsi) {
      o.a += vel * dt; o.x = cab.x + Math.cos(o.a) * rad; o.y = cab.y + Math.sin(o.a) * rad;
      for (const e of enemigosEn(o.x, o.y, 3)) { const t = o.cd.get(e) || 0; if (M.t - t > 0.5) { o.cd.set(e, M.t); herirEnemigo(e, dmg, { u: cab, tipo: "contacto" }); golpeFx(o.x, o.y, 5, "fg"); } }
    }
  }
  // objetos con reloj
  M.relojes = M.relojes || {};
  const R = M.relojes, cada = (k, s) => { R[k] = (R[k] || 0) + dt; if (R[k] >= s) { R[k] -= s; return true; } return false; };
  if (tieneObj("coil_r") && M.giroDer > 1 && cab && cada("coilR", 1 / niv3(tieneObj("coil_r"), 2, 3, 4))) { const u = A.uno(vivos), o = masCercano(u.x, u.y, 96); rafaga(u, o ? angA(u, o) : V.f() * TAU, 1); }
  if (tieneObj("shoot_5") && vivos[4] && cada("tiro5", 1 / 3)) { const u = vivos[4], o = masCercano(u.x, u.y, 128); if (o) { tiro({ x: u.x, y: u.y, ang: angA(u, o), v: 220, dmg: u.dmg, u }); sfx("tiro", 0.2); } }
  if (tieneObj("death_6") && vivos[5] && cada("muerte6", 3)) herirHeroe(vivos[5], vivos[5].maxhp * 0.1);
  if (tieneObj("psycholeak") && cab && cada("psifuga", 10)) M.orbesPsi.push({ a: V.f() * TAU, x: 0, y: 0, cd: new Map() });
  if (tieneObj("divine_blessing") && cab && cada("bendicion", 8)) orbeCuraCerca(cab);
  if (tieneObj("divine_punishment") && cada("castigo", 5)) { const magos = vivos.filter((u) => u.clases.includes("mage")); if (magos.length) { const d = magos.reduce((s, u) => s + u.dmg, 0) * 0.5; for (const e of M.ene) if (!e.muerto) { herirEnemigo(e, d, { u: magos[0], tipo: "area" }); golpeFx(e.x, e.y, 6, "blue"); } sfx("rayo", 0.5, 0.7); } }
  if (tieneObj("unwavering") && cada("firme", 5)) for (const u of vivos) if (u.clases.includes("warrior")) u.b.firme = (u.b.firme || 0) + 0.04 * tieneObj("unwavering");
  if (M.endurecer > 0) M.endurecer -= dt;
  if (M.prisa > 0) M.prisa -= dt;
}
/** La ráfaga: varios tiros abiertos (bono de tiradores, rulo, ráfaga divina). */
function rafaga(u, ang, n = 4) { sfx("flecha", 0.4, 1.2); for (let i = 0; i < n; i++) setTimeoutJuego(i * 0.05, () => { if (!u.muerto) tiro({ x: u.x, y: u.y, ang: ang + V.r(-0.3, 0.3), v: 250, dmg: u.dmg, u, forma: "flecha" }); }); }
function camposHechicero(u, p) {
  if (tieneObj("freezing_field")) crearDot({ x: p.x, y: p.y, rs: 36, dps: 0, dur: 2, u, col: "blue", lento: 0.5 });
  if (tieneObj("burning_field")) crearDot({ x: p.x, y: p.y, rs: 36, dps: 30, dur: 2, u, col: "red" });
  if (tieneObj("gravity_field")) crearDot({ x: p.x, y: p.y, rs: 40, dps: 0, dur: 1, u, col: "fg", tirar: 60 });
}
