// ─────────────────────────────────────────────────────────────────────────────
// EL MUNDO: la víbora, los enemigos, los tiros, las áreas, los daños en el tiempo, las invocaciones,
// lo que se junta y los efectos. Las fórmulas son las del original (objects.lua):
//   héroe: vida 100·2^(nv−1), daño 10·2^(nv−1), velocidad 75, defensa 25, todo por los multiplicadores
//   de sus clases; daño recibido = daño · 100/(100+defensa). La víbora va a la velocidad PROMEDIO de
//   todos y dobla a 1,66π rad/s; cada seguidor va 10,4 px atrás del anterior por el mismo camino.
// ─────────────────────────────────────────────────────────────────────────────

let M = null;                                   // la arena en curso (null en la tienda y los menús)
const RADIO_H = 5, RADIO_E = 5;

// ── cuántos de cada clase y a qué nivel está el bono (get_class_levels del original) ──
function nivelesDeClase(ids) {
  const cuenta = {}; for (const k of Object.keys(CLASES)) cuenta[k] = 0;
  for (const id of ids) for (const c of HEROES[id].clases) cuenta[c]++;
  const nv = {};
  for (const [k, c] of Object.entries(CLASES)) { let n = 0; c.sets.forEach((s, i) => { if (cuenta[k] >= s) n = i + 1; }); nv[k] = n; }
  return { cuenta, nv };
}
const tieneObj = (k) => (M && M.obj[k]) || 0;
const heroesVivos = () => M.vib.filter((u) => !u.muerto);

// ── los héroes ──
function crearHeroe(id, lvl, idx) {
  const h = HEROES[id];
  return { id, h, lvl, idx, x: AR.cx, y: AR.cy, r: 0, hp: 1, maxhp: 1, dmg: 10, def: 25, aspd: 1, adm: 1, asz: 1, mv: 75, col: h.col, clases: h.clases,
    t: 0.5 + idx * 0.13, flash: 0, muerto: false, cuentaAtq: 0, b: {}, dano: 0, marcaCura: 0, salvado: false, zombi: 0, primera: true };
}
/** Recalcula los stats de un héroe con todo lo que lo afecta (se hace cada cuadro: son ≤12). */
function stats(u) {
  const m = { hp: 1, dmg: 1, aspd: 1, adm: 1, asz: 1, def: 1, mv: 1 };
  for (const c of u.clases) for (const s in m) m[s] *= MULT[c][s];
  const B = M.buf, nv = M.clases.nv, cl = (k) => u.clases.includes(k);
  let dmg = 1, aspd = 1, adm = 1, asz = 1, def = 1, mv = 1, defA = 0, hpM = 1;
  // héroes que dan bonos a todos
  if (B.squire) { dmg *= B.squire >= 3 ? 1.5 : 1.2; def *= B.squire >= 3 ? 1.5 : 1.2; if (B.squire >= 3) { aspd *= 1.3; mv *= 1.3; } }
  if (B.timekeeper) aspd *= 1.2;
  dmg *= nv.enchanter === 2 ? 1.25 : nv.enchanter === 1 ? 1.15 : 1;
  if (cl("warrior")) defA += nv.warrior === 2 ? 50 : nv.warrior === 1 ? 25 : 0;
  if (cl("nuker")) { const k = nv.nuker === 2 ? 1.25 : nv.nuker === 1 ? 1.15 : 1; adm *= k; asz *= k; if (tieneObj("unleash")) { adm *= 1 + M.t * 0.01; asz *= 1 + M.t * 0.01; } }
  if (cl("explorer")) { const n = Object.values(nv).filter((v) => v > 0).length; dmg *= 1 + 0.15 * n; aspd *= 1 + 0.15 * n; }
  if (u.id === "drifter" && u.lvl >= 3) { const n = Object.values(nv).filter((v) => v > 0).length; dmg *= 1 + 0.15 * n; aspd *= 1 + 0.15 * n; }
  if (u.id === "swordsman" && u.lvl >= 3) dmg *= 2;
  if (u.id === "outlaw" && u.lvl >= 3) aspd *= 1.5;
  if (u.id === "penitent" && u.lvl >= 3) hpM *= 2;
  // objetos
  const o = (k) => tieneObj(k);
  if (o("centipede")) mv *= 1 + 0.1 * o("centipede");
  if (o("amplify")) adm *= niv3(o("amplify"), 1.2, 1.35, 1.5);
  if (o("magnify")) asz *= niv3(o("magnify"), 1.2, 1.35, 1.5);
  if (o("ballista") && HEROES[u.id].proy) dmg *= niv3(o("ballista"), 1.2, 1.35, 1.5);
  if (o("chronomancy") && cl("mage")) aspd *= niv3(o("chronomancy"), 1.15, 1.25, 1.35);
  if (o("berserking") && cl("warrior")) aspd *= remap(u.hp / u.maxhp, 0, 1, niv3(o("berserking"), 1.5, 1.75, 2), 1);
  if (o("reinforce") && M.clases.cuenta.enchanter > 0) { const k = niv3(o("reinforce"), 1.1, 1.2, 1.3); dmg *= k; def *= k; aspd *= k; }
  if (o("speed_3") && u.idx === 2) aspd *= 1.5;
  if (o("damage_4") && u.idx === 3) dmg *= 1.3;
  const puntas = u.idx === 0 || u.idx === M.vib.filter((x) => !x.muerto).length - 1;
  if (o("defensive_stance") && puntas) def *= 1 + 0.1 * o("defensive_stance");
  if (o("offensive_stance") && puntas) dmg *= 1 + 0.1 * o("offensive_stance");
  if (o("dividends") && cl("mercenary")) dmg *= 1 + J.oro / 100;
  if (o("coil_l") && M.giroIzq > 1) def *= niv3(o("coil_l"), 1.15, 1.25, 1.35);
  if (M.ultimoEnPie && heroesVivos().length === 1) { dmg *= 1.2; def *= 1.2; aspd *= 1.2; adm *= 1.2; mv *= 1.2; }
  if (M.endurecer > 0) def *= 2.5;
  if (o("haste") && M.prisa > 0) mv *= 1 + 0.5 * (M.prisa / 4);
  // bonos del héroe (hadas, despertar, encantado, revancha, guardia)
  const b = u.b;
  if (b.hada > 0) aspd *= 2;
  if (b.despertar) { aspd *= b.despertar; dmg *= b.despertar; }
  if (b.encantado) aspd *= b.encantado;
  if (b.magia > 0) aspd *= 1.5;
  dmg *= 1 + (M.revancha || 0) + (M.penitencia || 0);
  def *= 1 + (M.implacable || 0) + (b.firme || 0);
  u.maxhp = 100 * Math.pow(2, u.lvl - 1) * m.hp * hpM;
  u.dmg = 10 * Math.pow(2, u.lvl - 1) * m.dmg * dmg;
  u.aspd = m.aspd * aspd; u.adm = m.adm * adm; u.asz = m.asz * asz;
  u.def = (25 + defA) * m.def * def;
  u.mv = 75 * m.mv * mv;
  if (u.primera) { u.hp = u.maxhp; u.primera = false; }
  if (u.hp > u.maxhp) u.hp = u.maxhp;
}

/** Arma la víbora con el plantel (en orden). Arranca al centro mirando a la derecha. */
function armarVibora(plantel) {
  M.vib = plantel.map((p, i) => crearHeroe(p.id, p.lvl, i));
  M.rumbo = 0; M.rastro = [];
  const L0 = M.vib[0];
  // el rastro inicial: una línea recta hacia atrás, así los seguidores arrancan en fila
  for (let i = 0; i < 600; i++) M.rastro.push({ x: AR.cx - 30 + 60 - i * 0.5, y: AR.cy });
  L0.x = AR.cx + 30; L0.y = AR.cy;
  seguirRastro();
}
function lider() { for (const u of M.vib) if (!u.muerto) return u; return null; }
function seguirRastro() {
  const vivos = heroesVivos(); if (!vivos.length) return;
  const cab = vivos[0];
  let k = 0, acum = 0, prev = { x: cab.x, y: cab.y };
  for (let i = 1; i < vivos.length; i++) {
    const obj = 10.4 * i;
    while (k < M.rastro.length) {
      const p = M.rastro[k], d = Math.hypot(p.x - prev.x, p.y - prev.y);
      if (acum + d >= obj) { const f = (obj - acum) / (d || 1); const u = vivos[i]; u.x = prev.x + (p.x - prev.x) * f; u.y = prev.y + (p.y - prev.y) * f; u.r = Math.atan2(prev.y - p.y, prev.x - p.x); break; }
      acum += d; prev = p; k++;
    }
  }
}
/** Mueve la cabeza, rebota en las paredes y graba el rastro. */
function moverVibora(dt, giro) {
  const vivos = heroesVivos(); if (!vivos.length) return;
  const cab = vivos[0];
  M.rumbo += giro * 1.66 * Math.PI * dt;
  // las técnicas del rulo miden cuánto hace que se gira para un mismo lado
  if (giro > 0) { M.giroDer += dt; M.giroIzq = 0; } else if (giro < 0) { M.giroIzq += dt; M.giroDer = 0; } else { M.giroDer = M.giroIzq = 0; }
  let v = 0; for (const u of vivos) v += u.mv; v = Math.floor(v / vivos.length);
  M.vel = v;
  cab.x += Math.cos(M.rumbo) * v * dt; cab.y += Math.sin(M.rumbo) * v * dt;
  let choco = false;
  if (cab.x < AR.x1 + RADIO_H) { cab.x = AR.x1 + RADIO_H; M.rumbo = Math.PI - M.rumbo; choco = true; }
  if (cab.x > AR.x2 - RADIO_H) { cab.x = AR.x2 - RADIO_H; M.rumbo = Math.PI - M.rumbo; choco = true; }
  if (cab.y < AR.y1 + RADIO_H) { cab.y = AR.y1 + RADIO_H; M.rumbo = -M.rumbo; choco = true; }
  if (cab.y > AR.y2 - RADIO_H) { cab.y = AR.y2 - RADIO_H; M.rumbo = -M.rumbo; choco = true; }
  cab.r = M.rumbo;
  if (choco) {
    sfx("pared", 0.5); temblor(1.5);
    vivos.forEach((u, i) => { u.flashPared = 0.12 + i * 0.05; });
  }
  M.rastro.unshift({ x: cab.x, y: cab.y });
  if (M.rastro.length > 900) M.rastro.length = 900;
  seguirRastro();
}

// ── consultas ──
function enemigosEn(x, y, r) { const out = []; for (const e of M.ene) if (!e.muerto && (e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.rad) ** 2) out.push(e); return out; }
function masCercano(x, y, r = 9999, fuera = null) {
  let mejor = null, md = r * r;
  for (const e of M.ene) { if (e.muerto || (fuera && fuera.has(e))) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < md) { md = d; mejor = e; } }
  return mejor;
}
const hayEnemigos = () => M.ene.some((e) => !e.muerto);

// ── el daño a los enemigos ──
function defensaEnemigo(e) {
  let d = 25 + (M.clases.nv.mage === 2 ? -30 : M.clases.nv.mage === 1 ? -15 : 0);
  if (tieneObj("seeping") && e.dots.length) d *= 1 - niv3(tieneObj("seeping"), 0.15, 0.25, 0.35);
  if (e.cabezazo) d *= 3;
  return d;
}
/**
 * Le pega a un enemigo. o: {u: el héroe (o null), tipo: "proy"|"area"|"dot"|"contacto", crit: bool, golpe: los extras del golpe}
 * Devuelve el daño hecho.
 */
function herirEnemigo(e, dano, o = {}) {
  if (!e || e.muerto) return 0;
  let d = dano;
  if (tieneObj("vulnerability")) d *= niv3(tieneObj("vulnerability"), 1.1, 1.2, 1.3);
  if (e.aturdido > 0 && e.sismo) d *= 2;
  const def = defensaEnemigo(e);
  d = def >= 0 ? d * (100 / (100 + def)) : d * (2 - 100 / (100 + def));
  if (d <= 0) return 0;
  e.hp -= d; M.danoHecho += d;
  if (o.tipo !== "dot") { e.flash = 0.12; sfx("golpe", 0.35, 0.9 + V.f() * 0.2); }
  // golpe de gracia a los élites
  if (tieneObj("culling_strike") && (e.elite || e.jefe) && e.hp > 0 && e.hp < e.maxhp * 0.1 * tieneObj("culling_strike")) e.hp = 0;
  if (o.golpe) aplicarGolpe(e, o);
  if (o.u && o.u.id === "moneylender" && e.deuda) e.deuda = e.deuda;         // (la deuda se cuenta al maldecir)
  if (e.hp <= 0) matarEnemigo(e, o);
  return d;
}
/** Los extras de un golpe (objetos "strike" y efectos de ataque): veneno, fuego, aturdir, silenciar, empujar. */
function aplicarGolpe(e, o) {
  const G2 = o.golpe, u = o.u;
  if (G2.veneno) ponerDot(e, G2.veneno, 3, u, "veneno");
  if (G2.fuego) ponerDot(e, G2.fuego, 3, u, "fuego");
  if (G2.aturdir) e.aturdido = Math.max(e.aturdido, G2.aturdir);
  if (G2.silencio) e.silencio = Math.max(e.silencio, G2.silencio);
  if (G2.lento) { e.lento = G2.lento[0]; e.lentoT = Math.max(e.lentoT, G2.lento[1]); }
  if (G2.empuje && !e.jefe) empujar(e, G2.empuje, u ? Math.atan2(e.y - u.y, e.x - u.x) : V.f() * TAU, u);
  if (G2.oro) e.sueltaOro = true;
  if (G2.cura) e.sueltaCura = true;
  if (G2.bichos) e.bichosAlMorir = (e.bichosAlMorir || 0) + G2.bichos;
}
/** Tira los dados de los objetos "strike" para un ataque de un héroe. */
function tirarGolpe(u, extra = {}) {
  const o = tieneObj, g2 = Object.assign({}, extra);
  if (o("noxious_strike") && A.si(8 * o("noxious_strike"))) g2.veneno = (g2.veneno || 0) + u.dmg * 0.2;
  if (o("burning_strike") && A.si(15)) g2.fuego = (g2.fuego || 0) + u.dmg * 0.2;
  if (o("stunning_strike") && A.si(8 * o("stunning_strike"))) g2.aturdir = 2;
  if (o("silencing_strike") && A.si(8 * o("silencing_strike"))) g2.silencio = 2;
  if (o("kinetic_strike") && A.si(10 * o("kinetic_strike"))) g2.empuje = 60;
  if (o("lucky_strike") && A.si(8)) g2.oro = true;
  if (o("healing_strike") && A.si(8)) g2.cura = true;
  if (o("infesting_strike") && A.si(10 * o("infesting_strike"))) g2.bichos = 2;
  return g2;
}
/** ¿Critica? Devuelve el multiplicador (1 = no). */
function critico(u) {
  let x = 1;
  const rog = u.clases.includes("rogue"), nv = M.clases.nv.rogue;
  if (rog && nv && A.si(nv === 2 ? 30 : 15)) x = tieneObj("assassination") ? niv3(tieneObj("assassination"), 8, 10, 12) : 4;
  else if (tieneObj("critical_strike") && A.si(5 * tieneObj("critical_strike"))) x = 2;
  else if (rog && tieneObj("assassination")) x = 0.5;
  return x;
}
/** Daño en el tiempo: tipo "veneno"/"fuego"/… se apila; tick de 0,25 s (más rápido con el cronista). */
function ponerDot(e, dps, dur, u, tipo = "dot") {
  if (e.muerto) return;
  let k = 1;
  if (u && u.clases.includes("voider")) k *= M.clases.nv.voider === 2 ? 1.4 : M.clases.nv.voider === 1 ? 1.2 : 1;
  if (tieneObj("void_call")) k *= niv3(tieneObj("void_call"), 1.3, 1.6, 1.9);
  e.dots.push({ dps: dps * k, t: dur, u, tipo, acc: 0 });
}
function empujar(e, fuerza, ang, u) {
  if (e.muerto || e.jefe && fuerza < 200) return;
  const kb = M.clases.nv.forcer === 2 ? 1.5 : M.clases.nv.forcer === 1 ? 1.25 : 1;
  const f = fuerza * kb * (e.tanque ? 0.5 : 1);
  e.evx = Math.cos(ang) * f * 3; e.evy = Math.sin(ang) * f * 3; e.empujado = 0.6; e.fuerzaEmpuje = f; e.empujadoPor = u;
}

function matarEnemigo(e, o = {}) {
  if (e.muerto) return;
  e.muerto = true; M.muertes++;
  sfx("muere", 0.5); golpeFx(e.x, e.y, 10, e.colorD);
  for (let i = 0; i < 5; i++) particula(e.x, e.y, e.colorD);
  const u = o.u;
  // lo que sueltan
  const merc = M.clases.nv.mercenary;
  if ((merc && A.si(merc === 2 ? 16 : 8)) || e.sueltaOro) soltarOro(e.x, e.y);
  if (e.sueltaCura) soltarCura(e.x, e.y);
  if (e.bichosAlMorir) for (let i = 0; i < e.bichosAlMorir; i++) crearBicho(e.x, e.y, u || lider());
  // las maldiciones que revientan al morir
  for (const c of e.maldiciones) {
    if (c.tipo === "jester") { const n = 4; for (let i = 0; i < n; i++) tiro({ x: e.x, y: e.y, ang: (i / n) * TAU, v: 200, dmg: c.u.dmg, u: c.u, forma: "cuchillo", buscar: c.u.lvl >= 3, perfora: c.u.lvl >= 3 ? 2 : 0, col: c.u.col }); sfx("cuchillo", 0.4); }
    if (c.tipo === "dread") crearDot({ x: e.x, y: e.y, rs: (c.u.lvl >= 3 ? 2 : 1) * 16 * c.u.asz, dps: c.u.dmg * c.u.adm, dur: 3, u: c.u, col: "purple" });
    if (c.tipo === "hive") { const n = 2 * (c.u.lvl >= 3 ? 3 : 1); for (let i = 0; i < n; i++) crearBicho(e.x, e.y, c.u); }
  }
  // los élites
  if (e.tipo === "booster" && !(e.silencio > 0 || e.aturdido > 0)) { const cer = enemigosEn(e.x, e.y, 128); sfx("aparece", 0.5); for (const x of cer) { rayoFx(e, x, "green"); impulsoVel(x, 3); } }
  if (e.tipo === "exploder" && !(e.silencio > 0 || e.aturdido > 0)) crearMina(e.x, e.y, e);
  if (e.tipo === "spawner" && !(e.silencio > 0 || e.aturdido > 0)) { sfx("bicho", 0.4); const n = A.ent(5, 8); for (let i = 0; i < n; i++) crearBichoEnemigo(e.x, e.y, e); }
  // los que matan y hacen algo
  if (u) {
    if (u.id === "pyromancer" && u.lvl >= 3 && o.tipo === "dot") crearArea({ x: e.x, y: e.y, rs: 16 * u.asz, dmg: u.dmg * u.adm, u, col: "red" });
    if (u.id === "blightbow" && o.tipo === "proy") for (let i = 0; i < 3; i++) crearBicho(e.x, e.y, u);
  }
  if (tieneObj("ceremonial_dagger") && lider()) { const c = lider(); tiro({ x: e.x, y: e.y, ang: V.f() * TAU, v: 160, dmg: c.dmg, u: c, forma: "cuchillo", buscar: true, col: "fg" }); }
  if (tieneObj("homing_barrage") && A.si(8 * tieneObj("homing_barrage")) && lider()) { const c = lider(); for (let i = 0; i < 4; i++) tiro({ x: e.x, y: e.y, ang: (i / 4) * TAU, v: 160, dmg: c.dmg, u: c, forma: "flecha", buscar: true, col: "green" }); }
  if (e.jefe) { M.lentoT = 1; sfx("explota", 0.8); temblor(6); for (let i = 0; i < 20; i++) particula(e.x, e.y, e.colorD, 1.6); }
}
/** Un boost de velocidad (el élite verde): ×k que se va a la mitad en ~3 s. */
function impulsoVel(e, k) { e.boost = k; e.boostT = 0; }

// ── el daño a los héroes ──
function herirHeroe(u, dano, o = {}) {
  if (u.muerto || M.fase === "limpio") return;
  if (u.b.escudoMagia > 0) return;                  // el mago en su momento de invulnerable
  let d = u.def >= 0 ? dano * (100 / (100 + u.def)) : dano * (2 - 100 / (100 + u.def));
  if (d <= 0) return;
  u.hp -= d; u.flash = 0.15; M.danoRecibido += d;
  sfx("dolor", 0.45); temblor(2.5);
  // los que reaccionan a que les peguen
  if (u.id === "mindkeeper") { u.marcaCura += d; while (u.marcaCura >= u.maxhp * 0.25) { u.marcaCura -= u.maxhp * 0.25; for (let i = 0; i < 3; i++) soltarCura(u.x + V.r(-20, 20), u.y + V.r(-20, 20)); } if (u.lvl >= 3) for (const e of M.ene) if (!e.muerto) herirEnemigo(e, 2 * d, { u, tipo: "area" }); }
  if (u.id === "beastmaster" && u.lvl >= 3) for (let i = 0; i < 4; i++) crearBicho(u.x, u.y, u);
  if (tieneObj("crucio")) { const k = niv3(tieneObj("crucio"), 0.2, 0.3, 0.4); for (const e of M.ene) if (!e.muerto) herirEnemigo(e, d * k, { u, tipo: "area" }); }
  if (tieneObj("payback") && u.clases.includes("enchanter")) M.revancha = (M.revancha || 0) + niv3(tieneObj("payback"), 0.02, 0.05, 0.08);
  if (tieneObj("unrelenting") && u.clases.includes("warrior")) M.implacable = (M.implacable || 0) + niv3(tieneObj("unrelenting"), 0.02, 0.05, 0.08);
  if (u.hp <= 0) {
    if (u.b.salvar) { u.b.salvar = false; u.hp = u.maxhp * 0.5; sfx("cura", 0.7); golpeFx(u.x, u.y, 14, "yellow"); return; }
    if (tieneObj("lasting_7") && u.idx === 6 && !u.zombiUsado) { u.zombiUsado = true; u.zombi = 10; u.hp = 1; return; }
    if (u.zombi > 0) { u.hp = 1; return; }
    matarHeroe(u);
  }
}
function matarHeroe(u) {
  if (u.muerto) return;
  u.muerto = true; u.hp = 0;
  sfx("muereHeroe", 0.7); temblor(5);
  golpeFx(u.x, u.y, 14, u.col); for (let i = 0; i < 10; i++) particula(u.x, u.y, u.col, 1.3);
  if (tieneObj("kinetic_bomb")) { crearArea({ x: u.x, y: u.y, rs: 48, dmg: 0, u, col: "yellow", golpe: {} }); for (const e of enemigosEn(u.x, u.y, 64)) empujar(e, 120, Math.atan2(e.y - u.y, e.x - u.x), u); }
  if (tieneObj("porcupine")) for (let i = 0; i < 8; i++) tiro({ x: u.x, y: u.y, ang: (i / 8) * TAU, v: 200, dmg: u.dmg, u, forma: "cuchillo", perfora: 2, rebota: 2, col: u.col });
  if (tieneObj("hardening")) M.endurecer = 3;
  if (tieneObj("annihilation") && u.clases.includes("voider")) for (const e of M.ene) if (!e.muerto) ponerDot(e, u.dmg, 3, u);
  if (tieneObj("insurance") && A.si(4 * (M.clases.nv.mercenary === 2 ? 16 : M.clases.nv.mercenary ? 8 : 0))) { soltarOro(u.x, u.y); soltarOro(u.x, u.y); }
  // la víbora se cierra y se reordenan los puestos
  heroesVivos().forEach((x, i) => { x.idx = i; });
  if (tieneObj("last_stand") && heroesVivos().length === 1 && !M.ultimoEnPie) { M.ultimoEnPie = true; const c = heroesVivos()[0]; c.hp = c.maxhp; sfx("cura"); }
}
function curar(u, cant) {
  if (!u || u.muerto) return;
  const k = tieneObj("blessing") ? niv3(tieneObj("blessing"), 1.1, 1.2, 1.3) : 1;
  u.hp = Math.min(u.maxhp, u.hp + cant * k); u.curaFx = 0.4;
}

// ── los tiros de los héroes ──
/**
 * p: {x, y, ang, v, dmg, u, forma: "bola"|"flecha"|"cuchillo"|"hoja"|"cañon"|"orbe", col, perfora, salta, rebota,
 *     buscar, area (radio al pegar), empuje, vida, golpe, espiral, tira(atrae), rayo}
 */
function tiro(p) {
  const u = p.u;
  const t = Object.assign({ perfora: 0, salta: 0, rebota: 0, buscar: false, area: 0, empuje: 0, vida: 3, forma: "bola", col: u ? u.col : "fg", tam: 1 }, p);
  t.vx = Math.cos(t.ang) * t.v; t.vy = Math.sin(t.ang) * t.v; t.golpeados = new Set(); t.saltos = 0;
  if (u && u.clases.includes("rogue") && tieneObj("flying_daggers") && (t.forma === "cuchillo")) t.salta += 1 + tieneObj("flying_daggers");
  if (u && u.clases.includes("ranger") && t.forma === "flecha") {
    if (tieneObj("blunt_arrow") && A.si(10 * tieneObj("blunt_arrow"))) t.empuje = Math.max(t.empuje, 50);
    if (tieneObj("explosive_arrow") && A.si(10 * tieneObj("explosive_arrow"))) { t.area = Math.max(t.area, 16); t.areaK = 0.1 * tieneObj("explosive_arrow"); }
    if (tieneObj("machine_arrow") && A.si(10 * tieneObj("machine_arrow"))) { t.buscar = true; t.perfora += tieneObj("machine_arrow"); }
  }
  if (u && tieneObj("lightning_strike") && A.si(5 * tieneObj("lightning_strike"))) t.rayoK = niv3(tieneObj("lightning_strike"), 0.6, 0.8, 1);
  if (M.buf.sparkweaver) t.chispa = M.buf.sparkweaver;
  M.proy.push(t);
  return t;
}
function pasoTiros(dt) {
  for (let i = M.proy.length - 1; i >= 0; i--) {
    const t = M.proy[i];
    t.vida -= dt;
    if (t.vida <= 0) { if (t.alMorir) t.alMorir(t); M.proy.splice(i, 1); continue; }
    if (t.buscar) {
      const obj = masCercano(t.x, t.y, 160, t.golpeados);
      if (obj) { const a = Math.atan2(obj.y - t.y, obj.x - t.x), cur = Math.atan2(t.vy, t.vx), nv = cur + lim(difAng(cur, a), -6 * dt, 6 * dt); t.vx = Math.cos(nv) * t.v; t.vy = Math.sin(nv) * t.v; }
    }
    if (t.espiral) { const cur = Math.atan2(t.vy, t.vx) + t.espiral * dt; t.espiral *= 1 - 0.6 * dt; t.vx = Math.cos(cur) * t.v; t.vy = Math.sin(cur) * t.v; }
    if (t.frena) { t.v = Math.max(t.v - t.frena * dt, 8); const a = Math.atan2(t.vy, t.vx); t.vx = Math.cos(a) * t.v; t.vy = Math.sin(a) * t.v; }
    t.x += t.vx * dt; t.y += t.vy * dt;
    if (t.cadaCuadro) t.cadaCuadro(t, dt);
    // las paredes
    let pared = false;
    if (t.x < AR.x1 || t.x > AR.x2) { pared = true; if (t.rebota > 0) { t.vx = -t.vx; t.x = lim(t.x, AR.x1, AR.x2); } }
    if (t.y < AR.y1 || t.y > AR.y2) { pared = true; if (t.rebota > 0) { t.vy = -t.vy; t.y = lim(t.y, AR.y1, AR.y2); } }
    if (pared) {
      if (t.rebota > 0) { t.rebota--; t.golpeados.clear(); }
      else { golpeFx(t.x, t.y, 4, t.col); if (t.area) areaDeTiro(t); if (t.alMorir) t.alMorir(t); M.proy.splice(i, 1); continue; }
    }
    if (t.sinChoque) continue;
    // los enemigos
    for (const e of M.ene) {
      if (e.muerto || t.golpeados.has(e)) continue;
      if ((e.x - t.x) ** 2 + (e.y - t.y) ** 2 > (e.rad + 3 * t.tam) ** 2) continue;
      t.golpeados.add(e);
      golpeTiro(t, e);
      if (t.salta > 0) {
        t.salta--; t.saltos++;
        if (tieneObj("ultimatum")) t.dmg *= 1 + 0.1 * tieneObj("ultimatum");
        if (t.u && t.u.id === "scout" && t.u.lvl >= 3) t.dmg *= 1.25;
        const sig = masCercano(e.x, e.y, 128, t.golpeados);
        if (sig) { const a = Math.atan2(sig.y - t.y, sig.x - t.x); t.vx = Math.cos(a) * t.v; t.vy = Math.sin(a) * t.v; t.vida = Math.max(t.vida, 1); continue; }
      }
      if (t.perfora > 0) { t.perfora--; continue; }
      if (t.alMorir) t.alMorir(t);
      M.proy.splice(i, 1); break;
    }
  }
}
function golpeTiro(t, e) {
  const u = t.u, x = u ? critico(u) : 1;
  const d = t.dmg * x;
  golpeFx(e.x, e.y, x > 1 ? 9 : 6, x > 1 ? "yellow" : "fg");
  herirEnemigo(e, d, { u, tipo: "proy", crit: x > 1, golpe: u ? tirarGolpe(u, t.golpe) : t.golpe });
  if (t.empuje) empujar(e, t.empuje, Math.atan2(t.vy, t.vx), u);
  if (t.alPegar) t.alPegar(t, e, x);
  if (t.area) areaDeTiro(t, e);
  if (t.chispa && u) rayoEncadenado(e, t.dmg * 0.2, t.chispa >= 3 ? 4 : 2, t.chispa >= 3 ? 128 : 64, u);
  if (t.rayoK && u) rayoEncadenado(e, t.dmg * t.rayoK, 2, 64, u);
}
function areaDeTiro(t, e) {
  const u = t.u; if (!u) return;
  crearArea({ x: e ? e.x : t.x, y: e ? e.y : t.y, rs: t.area * u.asz, dmg: t.dmg * (t.areaK || 1) * u.adm, u, col: t.col, cuadrado: true });
}
function rayoEncadenado(desde, dano, n, alcance, u) {
  const vistos = new Set([desde]); let a = desde;
  for (let i = 0; i < n; i++) {
    const b = masCercano(a.x, a.y, alcance, vistos); if (!b) break;
    vistos.add(b); rayoFx(a, b, "blue"); herirEnemigo(b, dano, { u, tipo: "proy" }); a = b;
  }
  if (vistos.size > 1) sfx("rayo", 0.3);
}

// ── los tiros enemigos ──
function tiroEnemigo(x, y, ang, v, dmg, col = "fg") { M.proyE.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, dmg, col, vida: 5 }); }
function pasoTirosEnemigos(dt) {
  for (let i = M.proyE.length - 1; i >= 0; i--) {
    const t = M.proyE[i]; t.vida -= dt; t.x += t.vx * dt; t.y += t.vy * dt;
    if (t.vida <= 0 || t.x < AR.x1 || t.x > AR.x2 || t.y < AR.y1 || t.y > AR.y2) { golpeFx(t.x, t.y, 4, t.col); M.proyE.splice(i, 1); continue; }
    let fuera = false;
    // los campos de fuerza y los bichitos con escudo de carne los frenan
    for (const c of M.inv) if (c.campo && Math.hypot(c.x - t.x, c.y - t.y) < c.rs) { fuera = true; break; }
    if (!fuera && tieneObj("meat_shield")) for (const b of M.bichos) if (!b.muerto && !b.enemigo && Math.hypot(b.x - t.x, b.y - t.y) < 5) { fuera = true; b.vidas--; if (b.vidas <= 0) b.muerto = true; break; }
    if (!fuera) for (const u of M.vib) if (!u.muerto && Math.hypot(u.x - t.x, u.y - t.y) < RADIO_H + 2) { herirHeroe(u, t.dmg); fuera = true; break; }
    if (fuera) { golpeFx(t.x, t.y, 6, t.col); M.proyE.splice(i, 1); }
  }
}

// ── las áreas instantáneas (el "Area" del original: un cuadrado girado que pega una vez) ──
/** a: {x, y, rs, dmg, u, col, golpe (extras), aturdir, empuje, lento, cuadrado, sinEco, alPegar(e)} */
function crearArea(a) {
  const u = a.u;
  const tocados = enemigosEn(a.x, a.y, a.rs);
  let dmg = a.dmg;
  if (tieneObj("resonance") && tocados.length) dmg *= 1 + niv3(tieneObj("resonance"), 0.03, 0.05, 0.07) * tocados.length;
  for (const e of tocados) {
    const x = u ? critico(u) : 1;
    if (dmg > 0) herirEnemigo(e, dmg * x, { u, tipo: "area", crit: x > 1, golpe: u ? tirarGolpe(u, a.golpe) : a.golpe });
    if (a.aturdir) { e.aturdido = Math.max(e.aturdido, a.aturdir); if (a.sismo) e.sismo = true; }
    if (a.lento) { e.lento = a.lento[0]; e.lentoT = Math.max(e.lentoT, a.lento[1]); }
    if (a.empuje) empujar(e, a.empuje, Math.atan2(e.y - a.y, e.x - a.x), u);
    if (a.alPegar) a.alPegar(e);
  }
  M.fx.push({ tipo: "area", x: a.x, y: a.y, rs: a.rs, col: a.col || "fg", t: 0, dur: 0.25, r: V.f() * TAU, cuadrado: a.cuadrado !== false });
  // el eco: áreas secundarias al lado
  if (!a.sinEco && tieneObj("echo_barrage") && tocados.length && A.si(10 * tieneObj("echo_barrage"))) {
    for (let i = 0; i < tieneObj("echo_barrage"); i++) setTimeoutJuego(0.15 * (i + 1), () => crearArea(Object.assign({}, a, { x: a.x + V.r(-a.rs, a.rs), y: a.y + V.r(-a.rs, a.rs), rs: a.rs * 0.6, sinEco: true })));
  }
  return tocados.length;
}

// ── las áreas que duran (DoT): siguen a un héroe, quedan quietas o rebotan (la bruja) ──
/** d: {x, y, rs, dps, dur, u, col, sigue (héroe), vx, vy, lento, tirar (fuerza de atracción), alTerminar, cadaTick} */
function crearDot(d) {
  const k = d.u && d.u.clases.includes("conjurer") && d.construccion ? conjBuf() : 1;
  const o = Object.assign({ t: 0, tick: 0, dur: 4, col: "purple" }, d); o.dur *= k;
  M.dots.push(o); return o;
}
function pasoDots(dt) {
  const vel = M.buf.timekeeper3 ? 1.5 : 1;
  for (let i = M.dots.length - 1; i >= 0; i--) {
    const d = M.dots[i]; d.t += dt;
    if (d.sigue) { if (d.sigue.muerto) d.t = d.dur; else { d.x = d.sigue.x; d.y = d.sigue.y; } }
    if (d.vx) { d.x += d.vx * dt; d.y += d.vy * dt; if (d.x < AR.x1 + d.rs || d.x > AR.x2 - d.rs) d.vx = -d.vx; if (d.y < AR.y1 + d.rs || d.y > AR.y2 - d.rs) d.vy = -d.vy; }
    if (d.tirar) for (const e of enemigosEn(d.x, d.y, d.rs)) { if (e.jefe) continue; const a = Math.atan2(d.y - e.y, d.x - e.x), dd = Math.hypot(d.y - e.y, d.x - e.x); if (dd > 3) { e.x += Math.cos(a) * d.tirar * dt; e.y += Math.sin(a) * d.tirar * dt; } e.atraidoPor = d; }
    d.tick -= dt * vel;
    if (d.tick <= 0) {
      d.tick = 0.25;
      if (d.dps) for (const e of enemigosEn(d.x, d.y, d.rs)) { herirEnemigo(e, d.dps * 0.25 * dotMult(d.u), { u: d.u, tipo: "dot" }); e.enDot = 0.3; }
      if (d.lento) for (const e of enemigosEn(d.x, d.y, d.rs)) { e.lento = d.lento; e.lentoT = Math.max(e.lentoT, 0.3); }
      if (d.cadaTick) d.cadaTick(d);
    }
    if (d.t >= d.dur) { if (d.alTerminar) d.alTerminar(d); M.dots.splice(i, 1); }
  }
}
function dotMult(u) {
  let k = 1;
  if (u && u.clases.includes("voider")) k *= M.clases.nv.voider === 2 ? 1.4 : M.clases.nv.voider === 1 ? 1.2 : 1;
  if (tieneObj("void_call")) k *= niv3(tieneObj("void_call"), 1.3, 1.6, 1.9);
  return k;
}
/** Los DoT pegados a cada enemigo (veneno, fuego, deuda, maldiciones que pegan). */
function pasoDotsEnemigo(e, dt) {
  const vel = M.buf.timekeeper3 ? 1.5 : 1;
  for (let i = e.dots.length - 1; i >= 0; i--) {
    const d = e.dots[i]; d.t -= dt; d.acc += dt * vel;
    while (d.acc >= 0.25 && !e.muerto) { d.acc -= 0.25; herirEnemigo(e, d.dps * 0.25, { u: d.u, tipo: "dot" }); }
    if (d.t <= 0) e.dots.splice(i, 1);
  }
}

// ── lo que se junta: orbes de cura y monedas ──
function soltarCura(x, y) { M.pick.push({ tipo: "cura", x: lim(x, AR.x1 + 6, AR.x2 - 6), y: lim(y, AR.y1 + 6, AR.y2 - 6), t: 0 }); if (M.clases.nv.healer && A.si(M.clases.nv.healer === 2 ? 30 : 15)) M.pick.push({ tipo: "cura", x: lim(x + V.r(-12, 12), AR.x1 + 6, AR.x2 - 6), y: lim(y + V.r(-12, 12), AR.y1 + 6, AR.y2 - 6), t: 0 }); sfx("aparece", 0.25); }
function soltarOro(x, y) { M.pick.push({ tipo: "oro", x: lim(x, AR.x1 + 6, AR.x2 - 6), y: lim(y, AR.y1 + 6, AR.y2 - 6), t: 0 }); }
function pasoRecoger(dt) {
  const cab = lider(); if (!cab) return;
  const iman = tieneObj("magnetism") ? 56 : 0;
  for (let i = M.pick.length - 1; i >= 0; i--) {
    const p = M.pick[i]; p.t += dt;
    let toca = null;
    for (const u of M.vib) { if (u.muerto) continue; const d = Math.hypot(u.x - p.x, u.y - p.y); if (d < 8) { toca = u; break; } if (iman && d < iman) { const a = Math.atan2(u.y - p.y, u.x - p.x); p.x += Math.cos(a) * 90 * dt; p.y += Math.sin(a) * 90 * dt; } }
    if (!toca) continue;
    M.pick.splice(i, 1);
    if (p.tipo === "cura") {
      let peor = null, pr = 2; for (const u of heroesVivos()) { const r = u.hp / u.maxhp; if (r < pr) { pr = r; peor = u; } }
      if (peor) curar(peor, 0.2 * peor.maxhp);
      sfx("cura", 0.6); golpeFx(p.x, p.y, 8, "green");
      if (tieneObj("haste")) M.prisa = 4;
      if (tieneObj("divine_barrage") && A.si(20 * tieneObj("divine_barrage"))) { const c = lider(); for (let k = 0; k < 5; k++) tiro({ x: c.x, y: c.y, ang: V.f() * TAU, v: 180, dmg: c.dmg, u: c, forma: "flecha", rebota: 3, col: "green" }); }
    } else {
      J.oro++; M.oroJuntado++; sfx("oro", 0.5); golpeFx(p.x, p.y, 7, "yellow2");
      const min = M.vib.find((u) => !u.muerto && u.id === "miner");
      if (min) { const n = min.lvl >= 3 ? 8 : 4; for (let k = 0; k < n; k++) tiro({ x: p.x, y: p.y, ang: (k / n) * TAU, v: 150, dmg: min.dmg, u: min, forma: "bola", buscar: true, perfora: min.lvl >= 3 ? 2 : 0, col: "yellow2" }); }
    }
  }
}

// ── los bichitos (critters): los nuestros persiguen y muerden; los enemigos, al revés ──
function crearBicho(x, y, u) {
  if (!u || M.bichos.length > 80) return;
  const extra = (M.clases.nv.swarmer === 2 ? 3 : M.clases.nv.swarmer === 1 ? 1 : 0) + (tieneObj("hive") || 0);
  M.bichos.push({ x, y, r: V.f() * TAU, v: 55, dmg: u.dmg * 0.5, u, vidas: 1 + extra, t: 0, muerto: false, cd: 0, dur: 10 });
  sfx("bicho", 0.25);
}
function crearBichoEnemigo(x, y, e) { M.bichos.push({ x, y, r: V.f() * TAU, v: 45 + e.lvl, dmg: e.dmg * 1.5, enemigo: true, hp: 10 + 5 * e.lvl, vidas: 1, t: 0, muerto: false, cd: 0, dur: 12, e }); }
function pasoBichos(dt) {
  for (let i = M.bichos.length - 1; i >= 0; i--) {
    const b = M.bichos[i]; b.t += dt; b.cd -= dt;
    if (b.muerto || b.t > b.dur) { if (!b.muerto) golpeFx(b.x, b.y, 4, b.enemigo ? "purple" : "orange"); M.bichos.splice(i, 1); continue; }
    let obj = null;
    if (b.enemigo) { let md = 1e9; for (const u of M.vib) if (!u.muerto) { const d = Math.hypot(u.x - b.x, u.y - b.y); if (d < md) { md = d; obj = u; } } }
    else obj = masCercano(b.x, b.y, 200);
    if (obj) { const a = Math.atan2(obj.y - b.y, obj.x - b.x); b.r += lim(difAng(b.r, a), -5 * dt, 5 * dt); }
    b.x += Math.cos(b.r) * b.v * dt; b.y += Math.sin(b.r) * b.v * dt;
    if (b.x < AR.x1 + 2 || b.x > AR.x2 - 2) b.r = Math.PI - b.r; if (b.y < AR.y1 + 2 || b.y > AR.y2 - 2) b.r = -b.r;
    b.x = lim(b.x, AR.x1 + 2, AR.x2 - 2); b.y = lim(b.y, AR.y1 + 2, AR.y2 - 2);
    if (b.cd > 0 || !obj) continue;
    if (Math.hypot(obj.x - b.x, obj.y - b.y) < (b.enemigo ? RADIO_H : obj.rad) + 3) {
      b.cd = 0.4;
      if (b.enemigo) { herirHeroe(obj, b.dmg); b.muerto = true; }
      else {
        if (tieneObj("baneling")) { crearArea({ x: b.x, y: b.y, rs: 18, dmg: 50 * tieneObj("baneling"), u: b.u, col: "orange" }); b.muerto = true; sfx("area", 0.4); continue; }
        herirEnemigo(obj, b.dmg, { u: b.u, tipo: "contacto" }); empujar(obj, 15, b.r, b.u); b.r += Math.PI;
        b.vidas--; if (b.vidas <= 0) b.muerto = true;
      }
    }
  }
}

// ── las invocaciones (torretas, bombas, volcanes, autómatas, estatuas, orbes, campos) ──
/** c: {x, y, dur, paso(c, dt), dibujar(c), alIrse(c), u, rs} — el "Construct" genérico. */
function crearInv(c) { const o = Object.assign({ t: 0, dur: 10, rs: 5 }, c); if (o.construccion) o.dur *= conjBuf(); M.inv.push(o); return o; }
/** El bono de los invocadores: +25/50 % daño y duración de construcciones. */
function conjBuf() { return M.clases.nv.conjurer === 2 ? 1.5 : M.clases.nv.conjurer === 1 ? 1.25 : 1; }
function pasoInv(dt) {
  for (let i = M.inv.length - 1; i >= 0; i--) {
    const c = M.inv[i]; c.t += dt;
    if (c.paso) c.paso(c, dt);
    if (c.t >= c.dur) {
      if (c.construccion && tieneObj("construct_instability") && c.u) { crearArea({ x: c.x, y: c.y, rs: 24, dmg: c.u.dmg * niv3(tieneObj("construct_instability"), 1, 1.5, 2) * conjBuf(), u: c.u, col: "orange" }); sfx("explota", 0.4); }
      if (c.alIrse) c.alIrse(c);
      M.inv.splice(i, 1);
    }
  }
}

// ── la mina del élite azul (y del jefe azul): titila y revienta en proyectiles ──
function crearMina(x, y, e) {
  sfx("torreta", 0.5);
  crearInv({ x, y, dur: 1.5 + V.f() * 0.5, mina: true, e, dibujar: (c) => { const on = Math.floor(c.t * 8) % 2; g.fillStyle = on ? COL.blue : COL.fg; g.fillRect(Math.round(c.x) - 2, Math.round(c.y) - 2, 4, 4); },
    alIrse: (c) => { const n = 12, lvl = e.lvl || 1; sfx("explota", 0.45); for (let k = 0; k < n; k++) tiroEnemigo(c.x, c.y, (k / n) * TAU, 110 + 3 * lvl, e.dmg * 1.2, "blue"); golpeFx(c.x, c.y, 12, "blue"); } });
}

// ── los temporizadores del juego (respetan la cámara lenta y la pausa) ──
function setTimeoutJuego(seg, fn) { M.timers.push({ t: seg, fn }); }
function pasoTimers(dt) { for (let i = M.timers.length - 1; i >= 0; i--) { const x = M.timers[i]; x.t -= dt; if (x.t <= 0) { M.timers.splice(i, 1); x.fn(); } } }

// ── los efectos ──
function golpeFx(x, y, rs, col = "fg") { if (M.fx.length < 400) M.fx.push({ tipo: "golpe", x, y, rs, col, t: 0, dur: 0.18 }); }
function particula(x, y, col = "fg", k = 1) { if (M.fx.length < 400) { const a = V.f() * TAU, v = V.r(60, 180) * k; M.fx.push({ tipo: "part", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col, t: 0, dur: V.r(0.2, 0.45), w: V.r(2, 4) }); } }
function rayoFx(a, b, col = "blue") { M.fx.push({ tipo: "rayo", ax: a.x, ay: a.y, bx: b.x, by: b.y, col, t: 0, dur: 0.15, s: V.f() * 1000 }); }
function temblor(k) { if (M) M.temblor = Math.max(M.temblor, k * G.op.temblor); }
function pasoFx(dt) {
  for (let i = M.fx.length - 1; i >= 0; i--) { const f = M.fx[i]; f.t += dt; if (f.tipo === "part") { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 1 - 5 * dt; f.vy *= 1 - 5 * dt; } if (f.t >= f.dur) M.fx.splice(i, 1); }
  M.temblor = Math.max(0, M.temblor - 12 * dt);
}
