// ─────────────────────────────────────────────────────────────────────────────
// LOS ENEMIGOS: cada uno con su cabeza (una máquina de estados chica) y sus números, en la
// escala del original (una mosca aguanta 5, un "gaper" 10, un "clotty" 25, contra lágrimas de
// 3,5). Los que caminan rodean las rocas con un campo de distancias; los que vuelan, no.
// Los campeones (desde el piso 2) salen rojizos, con el doble de vida y un premio seguro.
// ─────────────────────────────────────────────────────────────────────────────

const ENEMIGOS = {
  mosquin: {
    nombre: "UN MOSQUÍN", vida: 5, r: 4, vuela: true, oy: -7, rastro: "sangre", peso: 0.6,
    crear(e) { e.a = V.f() * TAU; },
    pensar(e) {
      const j = J.jug, a = Math.atan2(j.y - e.y, j.x - e.x);
      e.a += difAng(a, e.a) * 0.025 + (V.f() - 0.5) * 0.6;
      const v = 0.5 * e.lento;
      e.vx = Math.cos(e.a) * v; e.vy = Math.sin(e.a) * v;
      if (V.f() < 0.004) SFX.zumbido();
    },
    spr: (e) => mosquinSpr((e.t >> 2) & 1),
  },
  mosquinRojo: {
    nombre: "UN MOSQUÍN ROJO", vida: 5, r: 4, vuela: true, oy: -7, rastro: "sangre", peso: 0.6,
    crear(e) { e.a = V.f() * TAU; },
    pensar(e) {
      const j = J.jug, a = Math.atan2(j.y - e.y, j.x - e.x);
      e.a += difAng(a, e.a) * 0.09 + Math.sin(e.t * 0.2) * 0.08;
      const v = 1.15 * e.lento;
      e.vx = Math.cos(e.a) * v; e.vy = Math.sin(e.a) * v;
      if (V.f() < 0.006) SFX.zumbido();
    },
    spr: (e) => mosquinSpr((e.t >> 1) & 1, true),
  },
  hongon: {
    nombre: "UN HONGÓN", vida: 10, r: 7, oy: 5, rastro: "sangre", voltea: true,
    pensar(e) {
      if (!e.sinGorro && e.vida <= e.max / 2) { e.sinGorro = true; particulas(e.x, e.y - 18, 8, ["#86643f", "#5e442c", "#a88558"], 2, 16); SFX.moho(); }
      const v = (e.sinGorro ? 1.05 : 0.72) * e.lento;
      const [dx, dy] = pasoCampo(J.sala, J.campo, e, J.jug.x, J.jug.y);
      e.vx += (dx * v - e.vx) * 0.2; e.vy += (dy * v - e.vy) * 0.2;
      if (Math.abs(e.vx) > 0.1) e.mira = sig(e.vx);
    },
    spr: (e) => hongonSpr(Math.floor(e.t / 8) % 4, e.sinGorro),
  },
  babosa: {
    nombre: "UNA BABOSA", vida: 14, r: 8, oy: 5, rastro: "baba", voltea: true,
    crear(e) { e.dir = V.ent(0, 3); e.tE = V.ent(60, 140); },
    pensar(e) {
      if (--e.tE <= 0 || e.choco) {
        const j = J.jug;
        e.dir = V.f() < 0.5 ? (Math.abs(j.x - e.x) > Math.abs(j.y - e.y) ? (j.x > e.x ? DERECHA : IZQUIERDA) : (j.y > e.y ? ABAJO : ARRIBA)) : V.ent(0, 3);
        e.tE = V.ent(70, 150);
      }
      const v = 0.36 * e.lento;
      e.vx = DIRS[e.dir][0] * v; e.vy = DIRS[e.dir][1] * v;
      if (e.vx) e.mira = sig(e.vx);
      if (e.t % 9 === 0) dejarBaba(e.x, e.y + 2, 8, 300);
    },
    spr: (e) => babosaSpr((e.t >> 4) & 1),
  },
  escupidor: {
    nombre: "UN ESCUPIDOR", vida: 10, r: 7, oy: 6, rastro: "sangre", peso: 3,
    crear(e) { e.tE = V.ent(60, 130); e.k = 0; },
    pensar(e) {
      e.vx *= 0.8; e.vy *= 0.8;
      e.tE--;
      e.k = e.tE < 26 ? 1 : 0;
      if (e.tE <= 0) {
        const j = J.jug, a = Math.atan2(j.y - e.y, j.x - e.x);
        if (J.piso.n >= 3) for (const d of [-0.22, 0, 0.22]) bala(e.x, e.y - 6, a + d, 2.1); else bala(e.x, e.y - 6, a, 2.2);
        SFX.escupe(); e.tE = V.ent(100, 140); e.tEsc = 10;
      }
      if (e.tEsc > 0) { e.tEsc--; e.k = 2; }
    },
    spr: (e) => escupidorSpr(e.k),
  },
  saltarin: {
    nombre: "UN SALTARÍN", vida: 10, r: 6, oy: 4, rastro: "sangre",
    crear(e) { e.est = "suelo"; e.tE = V.ent(30, 70); },
    pensar(e) {
      if (e.est === "suelo") {
        e.vx *= 0.7; e.vy *= 0.7;
        if (--e.tE <= 0) {
          const j = J.jug, lugar = lugarLibreCerca(j.x + V.ent(-40, 40), j.y + V.ent(-30, 30));
          e.est = "aire"; e.tE = 34; e.x0 = e.x; e.y0 = e.y; e.x1 = lugar[0]; e.y1 = lugar[1]; SFX.salto();
        }
      } else {
        const u = 1 - e.tE / 34;
        e.vx = e.vy = 0;
        e.x = lerp(e.x0, e.x1, u); e.y = lerp(e.y0, e.y1, u); e.z = Math.sin(u * Math.PI) * 18; e.alturaGolpe = e.z;
        if (--e.tE <= 0) { e.est = "suelo"; e.z = 0; e.alturaGolpe = 0; e.tE = V.ent(24, 50); particulas(e.x, e.y, 3, ["#634537", "#3c2a22"], 1, 1); }
      }
      e.vueloPropio = e.est === "aire";
    },
    spr: (e) => saltarinSpr(e.est === "aire" ? 1 : 0),
  },
  gusano: {
    nombre: "UN GUSANO", vida: 14, r: 7, oy: 6, rastro: "sangre", peso: 9,
    crear(e) { e.est = "bajo"; e.tE = V.ent(20, 60); e.oculto = true; },
    pensar(e) {
      e.vx = e.vy = 0;
      if (--e.tE > 0) {
        if (e.est === "bajo" && e.tE < 22 && e.tE % 4 === 0) particulas(e.x, e.y, 2, PAL.tierra.slice(2, 5), 1, 1);
        if (e.est === "afuera" && e.tE === 34) {
          const j = J.jug, a = Math.atan2(j.y - e.y, j.x - e.x);
          for (const d of [-0.3, 0, 0.3]) bala(e.x, e.y - 10, a + d, 2.2);
          SFX.escupe();
        }
        return;
      }
      if (e.est === "bajo") { e.est = "sube"; e.tE = 16; e.oculto = false; }
      else if (e.est === "sube") { e.est = "afuera"; e.tE = 56; }
      else if (e.est === "afuera") { e.est = "baja"; e.tE = 16; }
      else {
        e.est = "bajo"; e.tE = V.ent(50, 90); e.oculto = true;
        // sale en otro lado, no pegado a Shumio
        for (let i = 0; i < 30; i++) {
          const c = V.ent(0, COLS - 1), f = V.ent(0, FILAS - 1);
          if (celda(J.sala, c, f) || dist(cx(c), cy(f), J.jug.x, J.jug.y) < 56) continue;
          e.x = cx(c); e.y = cy(f); break;
        }
      }
    },
    spr(e) {
      const u = e.tE / 16;
      const k = e.est === "sube" ? lim(Math.floor((1 - u) * 4), 0, 3) : e.est === "baja" ? lim(Math.floor(u * 4), 0, 3) : 3;
      return gusanoSpr(k);
    },
  },
  bulbo: {
    nombre: "UN BULBO", vida: 18, r: 7, vuela: true, oy: -5, rastro: "espora", peso: 0.8,
    crear(e) { e.dx = V.f() < 0.5 ? -1 : 1; e.dy = V.f() < 0.5 ? -1 : 1; },
    pensar(e) { const v = 0.75 * e.lento; e.vx = e.dx * v; e.vy = e.dy * v; e.rebotaSolo = true; },
    morir(e) { anilloBalas(e.x, e.y - 6, 8, 2, 0, { color: "moho" }); SFX.escupe(); },
    spr: (e) => bulboSpr((e.t >> 3) & 1),
  },
  arana: {
    nombre: "UNA ARAÑITA", vida: 6, r: 5, oy: 3, rastro: "sangre", voltea: true,
    crear(e) { e.est = "quieta"; e.tE = V.ent(15, 50); },
    pensar(e) {
      if (e.est === "quieta") { e.vx *= 0.6; e.vy *= 0.6; if (--e.tE <= 0) { const j = J.jug, a = Math.atan2(j.y + V.ent(-24, 24) - e.y, j.x + V.ent(-24, 24) - e.x); e.est = "corre"; e.tE = V.ent(16, 26); e.vx = Math.cos(a) * 2.4 * e.lento; e.vy = Math.sin(a) * 2.4 * e.lento; } }
      else if (--e.tE <= 0) { e.est = "quieta"; e.tE = V.ent(20, 55); }
      if (Math.abs(e.vx) > 0.1) e.mira = sig(e.vx);
    },
    spr: (e) => aranaSpr(e.est === "corre" ? (e.t >> 1) & 1 : 0),
  },
  grumo: {
    nombre: "UN GRUMO", vida: 22, r: 7, oy: 5, rastro: "sangre",
    crear(e) { e.tE = V.ent(30, 60); e.tTiro = V.ent(60, 110); e.salto = 0; },
    pensar(e) {
      if (e.salto > 0) { e.salto--; } else { e.vx *= 0.75; e.vy *= 0.75; }
      if (--e.tE <= 0) { const a = V.f() * TAU; e.vx = Math.cos(a) * 1.3 * e.lento; e.vy = Math.sin(a) * 1.3 * e.lento; e.salto = 14; e.tE = V.ent(40, 70); }
      if (--e.tTiro <= 0) {
        const cruz = (e.tiros = (e.tiros || 0) + 1) % 2;
        for (let i = 0; i < 4; i++) bala(e.x, e.y - 6, i * TAU / 4 + (cruz ? 0 : TAU / 8), 1.9);
        SFX.escupe(); e.tTiro = V.ent(90, 130);
      }
      dejarBaba(e.x, e.y + 2, 6, 120, false);
    },
    spr: (e) => grumoSpr(e.salto > 0 ? 1 : 0),
  },
};

// quién sale en cada capítulo (e = común, E = fuerte)
const TANDAS = {
  sotano: { e: [["mosquin", 3], ["mosquinRojo", 2], ["hongon", 4], ["escupidor", 2], ["saltarin", 2], ["arana", 1]], E: [["grumo", 3], ["bulbo", 2], ["babosa", 2], ["gusano", 1]] },
  raices: { e: [["mosquinRojo", 3], ["hongon", 3], ["escupidor", 2], ["saltarin", 2], ["arana", 3], ["gusano", 2], ["babosa", 1]], E: [["grumo", 3], ["bulbo", 3], ["babosa", 2], ["gusano", 3]] },
};

function difAng(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function lugarLibreCerca(x, y) {
  let c = lim(celdaX(x), 0, COLS - 1), f = lim(celdaY(y), 0, FILAS - 1);
  if (!esSolida(celda(J.sala, c, f))) return [lim(x, IX0 + 8, IX1 - 8), lim(y, IY0 + 8, IY1 - 8)];
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const C = c + dx, F = f + dy;
    if (C >= 0 && F >= 0 && C < COLS && F < FILAS && !esSolida(celda(J.sala, C, F))) return [cx(C), cy(F)];
  }
  return [x, y];
}

function crearEnemigo(tipo, x, y, o = {}) {
  const d = ENEMIGOS[tipo];
  const escala = 1 + (J.piso.n - 1) * 0.2;
  const e = {
    tipo, def: d, x, y, r: d.r, vx: 0, vy: 0, z: 0, t: V.ent(0, 60), vuela: !!d.vuela, oy: d.oy ?? 4,
    vida: d.vida * escala, max: d.vida * escala, golpe: 0, kx: 0, ky: 0, mira: 1, lento: 1, frio: 0, veneno: null, quema: null,
    dormido: o.dormido ?? 34, jefe: !!d.jefe, campeon: false,
  };
  if (!e.jefe && J.piso.n >= 2 && !o.sinCampeon && A.si(0.06)) { e.campeon = true; e.vida = e.max = e.max * 2; }
  if (d.crear) d.crear(e);
  J.enemigos.push(e);
  return e;
}

function danarEnemigo(e, d, kx = 0, ky = 0, lag = null) {
  if (e.muerto || e.oculto || e.intangible) return;
  if (e.cabeza) e = e.cabeza;           // los anillos del gusano jefe comparten la vida
  e.vida -= d; e.golpe = 5;
  if (!e.jefe) { const p = e.def.peso ?? 1; e.kx += kx / p; e.ky += ky / p; }
  if (lag) {
    if (lag.veneno) e.veneno = { t: 80, dano: 2 };
    if (lag.hielo) e.frio = 100;
    if (lag.fuego) e.quema = { t: 60, dano: 1.5 };
  }
  if (e.vida <= 0) matarEnemigo(e);
}

function matarEnemigo(e) {
  if (e.muerto) return;
  e.muerto = true;
  const d = e.def;
  if (d.morir) d.morir(e);
  const r = d.rastro === "baba" ? PAL.baba : d.rastro === "espora" ? PAL.espora : PAL.sangre;
  sangrar(e.x, e.y - 6, e.jefe ? 30 : 9, r);
  mancha(d.rastro === "baba" ? "baba" : d.rastro === "espora" ? "espora" : "sangre", e.x, e.y, e.jefe ? 2 : e.r > 6 ? 1 : 0.7);
  SFX.muere();
  J.muertes++;
  if (e.campeon) soltarPremio(e.x, e.y);
  if (e.segmentos) for (const s of e.segmentos) { sangrar(s.x, s.y - 6, 6, PAL.sangre); mancha("sangre", s.x, s.y, 1); }
  if (e.jefe && d.alMorir) d.alMorir(e);
}

function actualizarEnemigos() {
  const j = J.jug;
  // el campo hacia Shumio, cada tanto
  if (!J.campo || J.t % 12 === 0 || J.cambioGrilla) { J.campo = campoHacia(J.sala, j.x, j.y); J.cambioGrilla = false; }
  for (const e of J.enemigos) {
    if (e.muerto) continue;
    e.t++;
    if (e.golpe > 0) e.golpe--;
    if (e.dormido > 0) { e.dormido--; continue; }
    e.lento = e.frio > 0 ? 0.5 : 1;
    if (e.frio > 0) e.frio--;
    for (const k of ["veneno", "quema"]) {
      const s = e[k];
      if (!s) continue;
      if (--s.t <= 0) e[k] = null; else if (s.t % 20 === 0) { e.vida -= s.dano; e.golpe = 2; if (e.vida <= 0) matarEnemigo(e); }
    }
    if (e.muerto) continue;
    J.quien = e;
    e.def.pensar(e);
    J.quien = null;
    if (e.muerto) continue;
    const vuela = e.vuela || e.vueloPropio;
    if (e.rebotaSolo) {
      moverEnSala(J.sala, e, e.vx + e.kx, 0, vuela); if (e.choco) e.dx = -e.dx;
      moverEnSala(J.sala, e, 0, e.vy + e.ky, vuela); if (e.choco) e.dy = -e.dy;
    } else if (!e.fijo) moverEnSala(J.sala, e, e.vx + e.kx, e.vy + e.ky, vuela);
    e.kx *= 0.78; e.ky *= 0.78;
    // el golpe a Shumio al tocarlo
    if (!e.oculto && !e.intangible && !j.muerto && (e.z || 0) < 10) {
      const toca = e.segmentos ? tocaSegmento(e, j.x, j.y, 4) : dist(e.x, e.y, j.x, j.y) < e.r + 4;
      if (toca) herirJugador(j, e.jefe || J.piso.n >= 3 ? 2 : 1, e.def.nombre, e.def.spr(e));
    }
  }
  // que no se amontonen (los que caminan se empujan entre sí)
  const E = J.enemigos;
  for (let a = 0; a < E.length; a++) for (let b = a + 1; b < E.length; b++) {
    const p = E[a], q = E[b];
    if (p.muerto || q.muerto || p.oculto || q.oculto || p.jefe || q.jefe) continue;
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), m = p.r + q.r - 2;
    if (d < m && d > 0.01) { const f = (m - d) / d * 0.25; p.x -= dx * f; p.y -= dy * f; q.x += dx * f; q.y += dy * f; }
  }
  for (let i = E.length - 1; i >= 0; i--) if (E[i].muerto) E.splice(i, 1);
}

function tocaSegmento(e, x, y, r) {
  if (dist(e.x, e.y, x, y) < e.r + r) return true;
  for (const s of e.segmentos) if (dist(s.x, s.y, x, y) < s.r + r) return true;
  return false;
}

function dibujarEnemigo(g, e) {
  if (e.oculto) return;
  const d = e.def;
  let s = d.spr(e);
  if (e.mira < 0 && d.voltea) s = espejado(s);
  if (e.campeon) s = tinte(s, "rgba(230,40,30,0.38)");
  if (e.veneno) s = tinte(s, "rgba(90,220,60,0.4)");
  else if (e.frio > 0) s = tinte(s, "rgba(120,200,255,0.45)");
  else if (e.quema) s = tinte(s, "rgba(255,140,40,0.4)");
  if (e.golpe > 0 && (e.golpe & 2)) s = blanco(s);
  const rx = Math.max(3, Math.round(e.r * (e.jefe ? 1.05 : 0.95))), ry = Math.max(2, Math.round(rx * 0.38));
  const X = Math.round(e.x), Y = Math.round(e.y);
  if (!(e.est === "bajo")) g.drawImage(sombra(rx, ry), X - rx, Y - ry + 2);
  const z = Math.round(e.z || 0) + (d.vuela ? Math.round(Math.sin(e.t * 0.15) * 1.2) : 0);
  if (e.dormido > 0 && (e.dormido & 2)) g.globalAlpha = 0.6;
  g.drawImage(s, X - Math.floor(s.width / 2), Y + e.oy - s.height - z);
  g.globalAlpha = 1;
}

/** Los enemigos de una sala al entrar (según su diseño y el capítulo). */
function poblarSala(sala) {
  const tanda = TANDAS[J.piso.cap];
  for (const h of sala.huecos) {
    const x = cx(h.c), y = cy(h.f);
    if (h.tipo === "e") crearEnemigo(A.pesos(tanda.e), x, y);
    else if (h.tipo === "E") crearEnemigo(A.pesos(tanda.E), x, y);
    else if (h.tipo === "v") crearEnemigo(J.piso.n >= 2 ? "mosquinRojo" : "mosquin", x, y);
    else if (h.tipo === "j") crearJefe(sala, x, y);
    J.fx.push({ anim: [0, 1, 2, 3, 4].map(aparicionSpr), x, y: y - 4, t: 0, cada: 4, centro: true });
  }
}
