// ─────────────────────────────────────────────────────────────────────────────
// LOS JEFES: la Madre Babosa (saltitos, el salto grande que cae con un anillo de baba, el
// escupitajo en abanico), el Rey Mosquín (se infla y revienta en lágrimas, llama a su corte),
// el Gusano Anillado (una serpiente de anillos que comparten la vida) y Micelia, la Madre
// Hongo del fondo, con tres fases. Al morir: un objeto, corazones y la trampilla (o el cofre).
// ─────────────────────────────────────────────────────────────────────────────

const NOMBRE_JEFE = { madreBabosa: "MADRE BABOSA", reyMosquin: "REY MOSQUÍN", gusanoAnillado: "GUSANO ANILLADO", micelia: "MICELIA" };

/** Qué jefe le toca a cada piso (sin repetir hasta el tercero). */
function elegirJefe(n, yaVistos) {
  if (n === ULTIMO_PISO) return "micelia";
  const todos = ["madreBabosa", "reyMosquin", "gusanoAnillado"];
  const pool = n === 1 ? ["madreBabosa", "reyMosquin"] : todos.filter((t) => !yaVistos.includes(t));
  return A.uno(pool.length ? pool : todos);
}

function crearJefe(sala, x, y) {
  const tipo = J.jefeTipo, e = crearEnemigo(tipo, x, y, { dormido: 20, sinCampeon: true });
  const escala = 1 + (J.piso.n - 1) * 0.25;
  e.vida = e.max = ENEMIGOS[tipo].vida * (tipo === "micelia" ? 1 : escala);
  J.jefes.push(e);
  return e;
}

function alMorirJefe(e) {
  temblar(16); SFX.explosion();
  for (let i = 0; i < 5; i++) J.pendientes.push(() => { particulas(e.x + V.ent(-16, 16), e.y - 10 + V.ent(-12, 12), 10, [PAL.sangre[2], PAL.sangre[3], PAL.hueso[3]], 3, 10); });
  J.jefeMuerto = true;
}

const DEF_JEFE = { jefe: true, peso: 99, alMorir: alMorirJefe };

ENEMIGOS.madreBabosa = Object.assign({}, DEF_JEFE, {
  nombre: "LA MADRE BABOSA", vida: 250, r: 20, oy: 8, rastro: "baba",
  crear(e) { e.est = "espera"; e.tE = 50; e.k = 0; },
  pensar(e) {
    const j = J.jug;
    e.vx = e.vy = 0;
    switch (e.est) {
      case "espera": e.k = 0; if (--e.tE <= 0) {
        const q = A.pesos([["saltitos", 4], ["grande", 3], ["escupir", 3]]);
        if (q === "saltitos") { e.saltos = A.ent(2, 3); e.est = "agacha"; e.tE = 12; e.sig = "salto"; }
        else if (q === "grande") { e.est = "agacha"; e.tE = 18; e.sig = "subir"; }
        else { e.est = "escupir"; e.tE = 34; }
      } break;
      case "agacha": e.k = 1; if (--e.tE <= 0) {
        if (e.sig === "salto") { e.est = "salto"; e.tE = 30; e.x0 = e.x; e.y0 = e.y; const a = Math.atan2(j.y - e.y, j.x - e.x), d = Math.min(60, dist(j.x, j.y, e.x, e.y)); e.x1 = lim(e.x + Math.cos(a) * d, IX0 + 26, IX1 - 26); e.y1 = lim(e.y + Math.sin(a) * d, IY0 + 26, IY1 - 20); SFX.salto(); }
        else { e.est = "subir"; e.tE = 34; e.intangible = true; SFX.salto(); }
      } break;
      case "salto": { e.k = 2; const u = 1 - e.tE / 30; e.x = lerp(e.x0, e.x1, u); e.y = lerp(e.y0, e.y1, u); e.z = Math.sin(u * Math.PI) * 22; e.alturaGolpe = e.z * 0.5;
        if (--e.tE <= 0) { e.z = 0; aterrizaMadre(e, false); e.saltos--; if (e.saltos > 0) { e.est = "agacha"; e.tE = 10; e.sig = "salto"; } else { e.est = "espera"; e.tE = V.ent(40, 70); } } } break;
      case "subir": e.k = 2; e.z += 9; if (--e.tE <= 0) { e.est = "sombra"; e.tE = 60; } break;
      case "sombra": { e.k = 2; const d = dist(j.x, j.y, e.x, e.y) || 1, v = Math.min(d, 2.2); e.x = lim(e.x + (j.x - e.x) / d * v, IX0 + 26, IX1 - 26); e.y = lim(e.y + (j.y - e.y) / d * v, IY0 + 26, IY1 - 20);
        if (--e.tE <= 0) { e.est = "cae"; e.tE = 30; } } break;
      case "cae": e.k = 2; e.z = Math.max(0, e.z - 14); if (e.z <= 0) { e.intangible = false; aterrizaMadre(e, true); e.est = "espera"; e.tE = V.ent(50, 80); } break;
      case "escupir": e.k = 3; if (e.tE === 16) {
        const a = Math.atan2(j.y - e.y, j.x - e.x), n = J.piso.n >= 2 ? 14 : 11;
        for (let i = 0; i < n; i++) bala(e.x, e.y - 18, a + (A.f() - 0.5) * 0.9, 1.3 + A.f() * 1.7, { r: A.ent(2, 4), color: "moho", z: 16 + A.ent(0, 10) });
        SFX.escupe(); temblar(3);
      } if (--e.tE <= 0) { e.est = "espera"; e.tE = V.ent(40, 70); } break;
    }
    e.intangible = e.est === "subir" || e.est === "sombra" || (e.est === "cae" && e.z > 30);
  },
  spr: (e) => madreBabosaSpr(e.k),
});
function aterrizaMadre(e, grande) {
  temblar(grande ? 10 : 4); SFX.cae();
  dejarBaba(e.x, e.y, grande ? 20 : 12, 360);
  if (grande) anilloBalas(e.x, e.y - 6, J.piso.n >= 2 ? 14 : 10, 1.8, A.f() * TAU, { color: "moho", r: 3 });
  particulas(e.x, e.y, grande ? 12 : 5, PAL.baba.slice(1, 4), 2, 2);
}

ENEMIGOS.reyMosquin = Object.assign({}, DEF_JEFE, {
  nombre: "EL REY MOSQUÍN", vida: 220, r: 17, vuela: true, oy: -2, rastro: "sangre",
  crear(e) { e.tInf = 110; e.tInv = 200; e.k = 0; e.ang = 0; },
  pensar(e) {
    const j = J.jug;
    e.ang += 0.012;
    const ox = cx(6) + Math.cos(e.ang) * 70, oy = cy(3) + Math.sin(e.ang * 2) * 26;
    const tx = lerp(ox, j.x, 0.3), ty = lerp(oy, j.y, 0.3), d = dist(tx, ty, e.x, e.y) || 1, v = e.est === "inflar" ? 0.1 : 0.5;
    e.vx = (tx - e.x) / d * Math.min(v, d); e.vy = (ty - e.y) / d * Math.min(v, d);
    if (e.est === "inflar") {
      e.k = 1;
      if (--e.tE <= 0) {
        e.est = null; e.k = 0; temblar(5); SFX.escupe();
        anilloBalas(e.x, e.y - 12, J.piso.n >= 2 ? 12 : 10, 1.9, A.f() * TAU, { r: 3 });
        if (moscasVivas() < 6) for (let i = 0; i < 2; i++) crearEnemigo("mosquin", e.x + V.ent(-12, 12), e.y + V.ent(-8, 8), { dormido: 8, sinCampeon: true });
      }
    } else if (--e.tInf <= 0) { e.est = "inflar"; e.tE = 38; e.tInf = V.ent(130, 170); }
    if (--e.tInv <= 0) {
      e.tInv = V.ent(240, 300);
      if (moscasVivas() < 6) for (let i = 0; i < 3; i++) { const a = i * TAU / 3; crearEnemigo("mosquinRojo", e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 14, { dormido: 16, sinCampeon: true }); }
      SFX.zumbido();
    }
    if (V.f() < 0.02) SFX.zumbido();
  },
  spr: (e) => reyMosquinSpr(e.k),
});
function moscasVivas() { return J.enemigos.filter((x) => !x.muerto && (x.tipo === "mosquin" || x.tipo === "mosquinRojo")).length; }

ENEMIGOS.gusanoAnillado = Object.assign({}, DEF_JEFE, {
  nombre: "EL GUSANO ANILLADO", vida: 300, r: 10, oy: 6, rastro: "sangre",
  crear(e) {
    e.dir = ABAJO; e.tGiro = 50; e.tTiro = 120; e.hist = [];
    e.segmentos = [];
    for (let i = 0; i < 8; i++) e.segmentos.push({ x: e.x, y: e.y, r: i === 7 ? 6 : 8, dir: ABAJO, cabeza: e });
    for (let i = 0; i < 120; i++) e.hist.push([e.x, e.y]);
  },
  pensar(e) {
    const j = J.jug, v = (e.vida < e.max / 2 ? 1.5 : 1.15) * e.lento;
    if (--e.tGiro <= 0 || e.choco) {
      // gira hacia Shumio si puede (nunca se da vuelta en el lugar)
      const quiere = Math.abs(j.x - e.x) > Math.abs(j.y - e.y) ? (j.x > e.x ? DERECHA : IZQUIERDA) : (j.y > e.y ? ABAJO : ARRIBA);
      const opciones = [0, 1, 2, 3].filter((d) => d !== opuesta(e.dir) && (!e.choco || d !== e.dir));
      e.dir = opciones.includes(quiere) && A.si(0.7) ? quiere : A.uno(opciones);
      e.tGiro = V.ent(36, 80);
    }
    e.vx = DIRS[e.dir][0] * v; e.vy = DIRS[e.dir][1] * v;
    e.hist.unshift([e.x, e.y]);
    if (e.hist.length > 160) e.hist.length = 160;
    const paso = Math.round(12 / v);
    e.segmentos.forEach((s, i) => {
      const h = e.hist[Math.min(e.hist.length - 1, (i + 1) * paso)], h2 = e.hist[Math.min(e.hist.length - 1, (i + 1) * paso - 2)];
      s.x = h[0]; s.y = h[1];
      const dx = h2[0] - h[0], dy = h2[1] - h[1];
      if (Math.abs(dx) + Math.abs(dy) > 0.1) s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DERECHA : IZQUIERDA) : (dy > 0 ? ABAJO : ARRIBA);
    });
    e.k = e.tTiro < 16 ? 1 : 0;
    if (--e.tTiro <= 0) {
      const a = Math.atan2(j.y - e.y, j.x - e.x);
      for (const d of [-0.28, 0, 0.28]) bala(e.x, e.y - 8, a + d, 2.2);
      SFX.escupe(); e.tTiro = V.ent(90, 130);
    }
  },
  spr: (e) => gusanoAnilladoSpr("cabeza", (e.dir + 2) % 4, e.k),
  dibujar(g, e) {
    const flash = (s) => (e.golpe > 0 && (e.golpe & 2) ? blanco(s) : s);
    for (let i = e.segmentos.length - 1; i >= 0; i--) {
      const s = e.segmentos[i], sp = flash(gusanoAnilladoSpr(i === e.segmentos.length - 1 ? "cola" : "cuerpo", (s.dir + 2) % 4, 0));
      g.drawImage(sombra(s.r, 3), Math.round(s.x - s.r), Math.round(s.y) - 1);
      g.drawImage(sp, Math.round(s.x - 13), Math.round(s.y + 4 - 26));
    }
    const c = flash(gusanoAnilladoSpr("cabeza", (e.dir + 2) % 4, e.k));
    g.drawImage(sombra(10, 3), Math.round(e.x - 10), Math.round(e.y) - 1);
    g.drawImage(c, Math.round(e.x - 13), Math.round(e.y + 5 - 26));
  },
});

ENEMIGOS.micelia = Object.assign({}, DEF_JEFE, {
  nombre: "MICELIA", vida: 760, r: 26, oy: 12, rastro: "espora", fijo: true,
  crear(e) { e.x0 = e.x; e.y = e.y0 = cy(2) + 4; e.fase = 1; e.tA = 70; e.tB = 200; e.tS = 0; e.ang = 0; e.k = 0; e.grito = 0; },
  pensar(e) {
    const j = J.jug, f = e.vida > e.max * 0.66 ? 1 : e.vida > e.max * 0.33 ? 2 : 3;
    e.x = e.x0 + Math.sin(e.t * 0.011) * (f === 3 ? 70 : 46);
    e.y = e.y0 + Math.sin(e.t * 0.023) * 6;
    if (f !== e.fase) {   // el grito del cambio de fase: limpia las balas y llama a su prole
      e.fase = f; e.grito = 50; SFX.jefe(); temblar(12);
      J.balas.length = 0;
      for (let i = 0; i < 2; i++) crearEnemigo(f === 2 ? "hongon" : "arana", cx(i ? 10 : 2), cy(5), { dormido: 20, sinCampeon: true });
    }
    e.k = f === 3 ? 3 : e.golpe > 3 ? 2 : 0;
    if (e.grito > 0) { e.grito--; e.k = 1; return; }
    const boca = (n) => { e.tBoca = n; };
    if (e.tBoca > 0) { e.tBoca--; if (f < 3) e.k = 1; }
    const bx = e.x, by = e.y - 30;
    if (f === 1) {
      if (--e.tA <= 0) { anilloBalas(bx, by, 12, 1.7, (e.alterna = !e.alterna) ? 0 : TAU / 24, { color: "violeta", r: 3, z: 20 }); SFX.escupe(); boca(20); e.tA = 80; }
      if (--e.tB <= 0) { if (J.enemigos.length < 5) for (let i = 0; i < 2; i++) crearEnemigo("hongon", cx(i ? 10 : 2), cy(5), { dormido: 20, sinCampeon: true }); e.tB = 280; }
    } else if (f === 2) {
      e.tS++;
      if (e.tS % 170 < 100) { if (e.tS % 6 === 0) { e.ang += 0.26; for (let k = 0; k < 2; k++) bala(bx, by, e.ang + k * Math.PI, 1.8, { color: "violeta", r: 3, z: 20 }); boca(8); } }
      else if (e.tS % 170 === 130) { const a = Math.atan2(j.y - by, j.x - bx); for (let i = -2; i <= 2; i++) bala(bx, by, a + i * 0.2, 2.3, { color: "violeta", r: 3, z: 20 }); SFX.escupe(); boca(20); }
      if (--e.tB <= 0) { if (J.enemigos.length < 5) for (let i = 0; i < 2; i++) crearEnemigo("mosquinRojo", bx + (i ? 30 : -30), by, { dormido: 12, sinCampeon: true }); e.tB = 320; }
    } else {
      e.tS++;
      if (e.tS % 5 === 0) { e.ang += 0.21; for (let k = 0; k < 3; k++) bala(bx, by, e.ang + k * TAU / 3, 1.9, { color: "violeta", r: 3, z: 20, curva: 0.004 }); }
      if (--e.tA <= 0) { anilloBalas(bx, by, 16, 1.5, A.f() * TAU, { color: "sangre", r: 4, z: 20 }); SFX.escupe(); temblar(4); e.tA = 150; }
      if (--e.tB <= 0) { if (J.enemigos.length < 5) for (let i = 0; i < 2; i++) crearEnemigo("saltarin", cx(i ? 10 : 2), cy(5), { dormido: 20, sinCampeon: true }); e.tB = 300; }
    }
  },
  spr: (e) => miceliaSpr(e.k),
});
