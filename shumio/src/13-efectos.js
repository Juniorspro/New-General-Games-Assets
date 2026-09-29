// ─────────────────────────────────────────────────────────────────────────────
// LO QUE VUELA Y LO QUE QUEDA: las lágrimas de Shumio (con su caída al final del alcance),
// las balas de los enemigos, las bombas y sus explosiones (rompen rocas, abren secretas),
// las partículas (tripas, esporas, cascotes), las manchas que quedan en el piso y la baba.
// ─────────────────────────────────────────────────────────────────────────────

function temblar(n) { J.temblor = Math.max(J.temblor, n); }

/** Un sprite tintado (veneno, hielo, fuego, campeones), cacheado por canvas y color. */
const _tintes = new Map();
function tinte(c, color) {
  let m = _tintes.get(color);
  if (!m) { m = new WeakMap(); _tintes.set(color, m); }
  let t = m.get(c);
  if (t) return t;
  t = lienzoNuevo(c.width, c.height);
  const g = t.getContext("2d"); g.drawImage(c, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = color; g.fillRect(0, 0, t.width, t.height);
  m.set(c, t);
  return t;
}
const _espejos = new WeakMap();
function espejado(c) {
  let e = _espejos.get(c);
  if (e) return e;
  e = lienzoNuevo(c.width, c.height);
  const g = e.getContext("2d"); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0);
  _espejos.set(c, e);
  return e;
}

// ── las lágrimas de Shumio ──
function actualizarLagrimas() {
  const L = J.lagrimas;
  for (let i = L.length - 1; i >= 0; i--) {
    const l = L[i];
    if (l.buscadora) {
      let obj = null, md = 90;
      for (const e of J.enemigos) { if (!blanco_(e)) continue; const d = dist(e.x, e.y, l.x, l.y); if (d < md) { md = d; obj = e; } }
      if (obj) {
        const v = Math.hypot(l.vx, l.vy), a0 = Math.atan2(l.vy, l.vx), a1 = Math.atan2(obj.y - l.y, obj.x - l.x);
        let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const a = a0 + lim(da, -0.09, 0.09); l.vx = Math.cos(a) * v; l.vy = Math.sin(a) * v;
      }
    }
    l.x += l.vx; l.y += l.vy; l.vida--;
    // al final del alcance, la lágrima cae (el arco del original)
    const caida = l.vidaMax * 0.28;
    if (l.vida < caida) l.z = Math.max(0, 14 * (l.vida / caida));
    let rompe = l.vida <= 0 || l.z <= 0;
    // muros
    if (l.x < IX0 + 2 || l.x > IX1 - 2 || l.y < IY0 + 1 || l.y > IY1 - 2) {
      if (l.rebote && !l.reboto) { if (l.x < IX0 + 2 || l.x > IX1 - 2) l.vx = -l.vx; else l.vy = -l.vy; l.reboto = true; l.x = lim(l.x, IX0 + 2, IX1 - 2); l.y = lim(l.y, IY0 + 1, IY1 - 2); }
      else rompe = true;
    }
    // obstáculos
    if (!rompe && !l.espectral) {
      const c = celdaX(l.x), f = celdaY(l.y), o = celda(J.sala, c, f);
      if (frenaLagrima(o)) {
        golpearObstaculo(o, c, f, l.dano);
        if (l.rebote && !l.reboto) { l.vx = -l.vx; l.vy = -l.vy; l.reboto = true; l.x += l.vx * 2; l.y += l.vy * 2; }
        else rompe = true;
      }
    }
    // enemigos
    if (!rompe) for (const e of J.enemigos) {
      if (!blanco_(e) || (l.tocados && l.tocados.has(e))) continue;
      if (e.segmentos ? !tocaSegmento(e, l.x, l.y, l.r + 1) : dist(e.x, e.y - (e.alturaGolpe || 0), l.x, l.y) > e.r + l.r) continue;
      danarEnemigo(e, l.dano, l.vx * 0.35, l.vy * 0.35, l);
      if (l.atraviesa) { (l.tocados ||= new Set()).add(e); } else { rompe = true; break; }
    }
    if (rompe) { chapoteo(l.x, l.y - l.z, l.color, l.r); L.splice(i, 1); }
  }
}
function blanco_(e) { return !e.muerto && !e.oculto && !e.intangible; }

/** Una lágrima que pega en una roca, una mata, un brasero o un barril. */
function golpearObstaculo(o, c, f, dano) {
  if (o.t === "matas" && o.vida > 0) {
    o.vida--; SFX.moho();
    particulas(cx(c), cy(f), 4, ["#7a5636", "#a8835a", "#4d3421"], 1.2);
    if (o.vida <= 0) { if (A.si(o.dorada ? 1 : 0.18)) soltarPremio(cx(c), cy(f), o.dorada ? "moneda" : null); J.cambioGrilla = true; }
  } else if (o.t === "brasero" && o.prendido) {
    o.vida--; particulas(cx(c), cy(f) - 10, 3, PAL.fuego.slice(2), 1);
    if (o.vida <= 0) { o.prendido = false; SFX.moho(); humo(cx(c), cy(f) - 6); if (A.si(0.2)) soltarPremio(cx(c), cy(f)); J.cambioGrilla = true; }
  } else if (o.t === "barril") {
    o.vida -= dano >= 6 ? 2 : 1;
    if (o.vida <= 0) { J.sala.celdas[f * COLS + c] = null; explotar(cx(c), cy(f), false); J.cambioGrilla = true; }
  }
}

function chapoteo(x, y, color, r) {
  const col = COLOR_LAGRIMA[color] ? color : "espora";
  J.fx.push({ anim: [0, 1, 2, 3, 4].map((k) => chapoteoSpr(col, k)), x, y, t: 0, cada: 3, centro: true, escala: r > 5 ? 1 : 1 });
  if (V.f() < 0.5) SFX.chapoteo();
}

// ── las balas de los enemigos ──
function bala(x, y, ang, vel, o = {}) {
  J.balas.push({ x, y, z: o.z ?? 8, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, r: o.r || 3, vida: o.vida || 240, color: o.color || "enemigo", curva: o.curva || 0, acel: o.acel || 0, espectral: !!o.espectral, de: J.quien ? J.quien.def.nombre : null, deSpr: J.quien ? J.quien.def.spr(J.quien) : null });
}
function anilloBalas(x, y, n, vel, desfase = 0, o) { for (let i = 0; i < n; i++) bala(x, y, desfase + i * TAU / n, vel, o); }
function actualizarBalas() {
  const B = J.balas, j = J.jug;
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i];
    if (b.curva) { const a = Math.atan2(b.vy, b.vx) + b.curva, v = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; }
    if (b.acel) { b.vx *= 1 + b.acel; b.vy *= 1 + b.acel; }
    b.x += b.vx; b.y += b.vy; b.vida--;
    if (b.vida < 20) b.z = Math.max(0, b.z - 0.5);
    let rompe = b.vida <= 0 || b.x < IX0 || b.x > IX1 || b.y < IY0 - 2 || b.y > IY1;
    if (!rompe && !b.espectral) { const o = celda(J.sala, celdaX(b.x), celdaY(b.y)); if (frenaLagrima(o)) rompe = true; }
    if (!rompe) for (const m of J.familiares) if (m.bloquea && dist(m.x, m.y, b.x, b.y) < 7) { rompe = true; break; }
    if (!rompe && !j.muerto && dist(j.x, j.y - 5, b.x, b.y) < b.r + 4) { herirJugador(j, J.piso.n >= 3 ? 2 : 1, b.de || "UNA LÁGRIMA MALA", b.deSpr || lagrimaSpr(5, "enemigo")); rompe = true; }
    if (rompe) { chapoteo(b.x, b.y - b.z, b.color, b.r); B.splice(i, 1); }
  }
}

// ── las bombas ──
function actualizarBombas() {
  for (let i = J.bombas.length - 1; i >= 0; i--) {
    const b = J.bombas[i];
    b.t--;
    b.vx *= 0.85; b.vy *= 0.85;
    moverEnSala(J.sala, b, b.vx, b.vy, false);
    // Shumio las empuja al caminar contra ellas
    const j = J.jug, d = dist(j.x, j.y, b.x, b.y);
    if (d < 9 && d > 0.01 && b.t < 80) { b.vx += (b.x - j.x) / d * 0.5; b.vy += (b.y - j.y) / d * 0.5; }
    if (b.t <= 0) { J.bombas.splice(i, 1); explotar(b.x, b.y, true, b.gorda); }
  }
}

/** La explosión: daña (a Shumio también), rompe obstáculos y abre las puertas secretas. */
function explotar(x, y, dePlayer, gorda = false) {
  const R = gorda ? 52 : 42, dano = gorda ? 75 : 60;
  SFX.explosion(); temblar(gorda ? 14 : 10);
  J.fx.push({ anim: [0, 1, 2, 3, 4, 5].map(explosionSpr), x, y: y + 6, t: 0, cada: 4, centro: false });
  J.destello = 3;
  mancha("quemado", x, y, 1.4);
  particulas(x, y, 14, ["#3a2c28", "#5a4640", "#f59a26", "#ffe07a"], 3);
  for (const e of J.enemigos) if (!e.muerto && !e.oculto && dist(e.x, e.y, x, y) < R + e.r) { const d = dist(e.x, e.y, x, y) || 1; danarEnemigo(e, dano, (e.x - x) / d * 5, (e.y - y) / d * 5); }
  const j = J.jug;
  if (dist(j.x, j.y, x, y) < R + 2) { herirJugador(j, 2, "UNA BOMBA", bombaSpr(1)); const d = dist(j.x, j.y, x, y) || 1; j.vx += (j.x - x) / d * 5; j.vy += (j.y - y) / d * 5; }
  for (const b of J.bombas) { const d = dist(b.x, b.y, x, y) || 1; if (d < R) { b.vx += (b.x - x) / d * 4; b.vy += (b.y - y) / d * 4; } }
  for (const c of J.sala.cosas) if (!c.quieto && c.t !== "objeto" && c.t !== "trampilla") { const d = dist(c.x, c.y, x, y) || 1; if (d < R) { c.vx += (c.x - x) / d * 4; c.vy += (c.y - y) / d * 4; c.vz = 2; } }
  // los obstáculos
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
    const o = celda(J.sala, c, f);
    if (!o || dist(cx(c), cy(f), x, y) > R + 10) continue;
    if (o.t === "roca") {
      J.sala.celdas[f * COLS + c] = null; SFX.roca();
      particulas(cx(c), cy(f), 8, PAL.piedra.slice(2), 2.4);
      mancha("quemado", cx(c), cy(f), 0.8);
      if (o.marcada) { SFX.secreto(); soltarPremio(cx(c), cy(f), A.pesos([["espora", 5], ["bomba", 3], ["llave", 2]])); }
      else if (A.si(0.04)) soltarPremio(cx(c), cy(f));
      J.cambioGrilla = true;
    } else if (o.t === "matas" && o.vida > 0) { o.vida = 0; J.cambioGrilla = true; particulas(cx(c), cy(f), 6, ["#7a5636", "#a8835a"], 2); }
    else if (o.t === "brasero") { J.sala.celdas[f * COLS + c] = null; J.cambioGrilla = true; humo(cx(c), cy(f)); }
    else if (o.t === "barril") { J.sala.celdas[f * COLS + c] = null; J.cambioGrilla = true; J.pendientes.push(() => explotar(cx(c), cy(f), false)); }
  }
  // las puertas secretas
  for (let d = 0; d < 4; d++) {
    const p = J.sala.puertas[d];
    if (!p || !p.secreta || p.revelada) continue;
    const q = PUERTA[d];
    if (dist(q.x, q.y, x, y) < R + 16) { p.revelada = true; if (p.par) p.par.revelada = true; SFX.secreto(); particulas(q.x, q.y, 10, PAL.piedra.slice(2), 2.5); }
  }
  // las puertas con llave no se vuelan (como en el original), pero tiemblan
}

// ── partículas: pedacitos con altura (z) que caen y rebotan en el piso ──
function particulas(x, y, n, colores, fuerza = 2, z = 6) {
  for (let i = 0; i < n; i++) {
    const a = V.f() * TAU, v = (0.4 + V.f()) * fuerza * 0.6;
    J.part.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, vz: 1 + V.f() * fuerza, c: V.uno(colores), t: 60 + V.ent(0, 60), s: V.f() < 0.3 ? 2 : 1 });
  }
}
function sangrar(x, y, n, rampa) { particulas(x, y, n, [rampa[1], rampa[2], rampa[3]], 2, 8); }
function actualizarParticulas() {
  const P = J.part;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= 0.22;
    if (p.z <= 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; if (Math.abs(p.vz) < 0.3) p.vz = 0; }
    if (--p.t <= 0) P.splice(i, 1);
  }
  if (P.length > 260) P.splice(0, P.length - 260);
}
function humo(x, y) { J.fx.push({ anim: [0, 1, 2, 3].map(humoSpr), x, y, t: 0, cada: 5, centro: true }); }

// ── las manchas: se pintan UNA vez en el piso de la sala y se quedan ──
function mancha(tipo, x, y, escala = 1) {
  const s = J.sala;
  if (!s.decal) s.decal = lienzoNuevo(SALA_W, SALA_H);
  const g = s.decal.getContext("2d"), m = manchaSpr(tipo, V.ent(0, 5));
  g.save(); g.globalAlpha = tipo === "quemado" ? 0.8 : 0.72; g.beginPath(); g.rect(IX0, IY0, COLS * T, FILAS * T); g.clip();
  const w = Math.round(m.width * escala), h = Math.round(m.height * escala);
  g.imageSmoothingEnabled = false;
  g.drawImage(m, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  g.restore();
}

// ── la baba (el rastro de las babosas, y el de algunos jefes): daña si la pisás ──
function dejarBaba(x, y, r = 9, dura = 240, danina = true) {
  if (J.babas.length > 90) J.babas.shift();
  J.babas.push({ x, y, r, t: dura, max: dura, danina, v: V.ent(0, 5) });
}
function actualizarBabas() { for (let i = J.babas.length - 1; i >= 0; i--) if (--J.babas[i].t <= 0) J.babas.splice(i, 1); }
function dibujarBabas(g) {
  for (const b of J.babas) {
    const s = manchaSpr("baba", b.v), k = b.r / 9;
    g.globalAlpha = Math.min(1, b.t / 40) * 0.8;
    g.drawImage(s, Math.round(b.x - s.width * k / 2), Math.round(b.y - s.height * k / 2), Math.round(s.width * k), Math.round(s.height * k));
  }
  g.globalAlpha = 1;
}

// ── dibujar lo que vuela ──
function dibujarLagrima(g, l) {
  const s = lagrimaSpr(l.r, l.veneno ? "veneno" : l.hielo ? "hielo" : l.fuego ? "fuego" : l.color);
  const x = Math.round(l.x - s.width / 2), y = Math.round(l.y - l.z - s.height / 2);
  const sh = sombra(Math.max(2, l.r - 1), Math.max(1, Math.round(l.r / 2)));
  g.drawImage(sh, Math.round(l.x - sh.width / 2), Math.round(l.y - sh.height / 2 + 2));
  g.drawImage(s, x, y);
}
function dibujarBala(g, b) {
  const s = lagrimaSpr(b.r + 1, b.color);
  g.drawImage(sombra(b.r, 1), Math.round(b.x - b.r), Math.round(b.y + 1));
  g.drawImage(s, Math.round(b.x - s.width / 2), Math.round(b.y - b.z - s.height / 2));
}
function dibujarBomba(g, b) {
  const s = bombaSpr(b.gorda ? 1.25 : 1, true, (J.t >> 2) & 1);
  const late = b.t < 30 ? ((b.t >> 1) & 1) : ((b.t >> 3) & 1);
  const e = b.t < 30 ? 1 + (1 - b.t / 30) * 0.2 : 1;
  g.drawImage(sombra(6, 2), Math.round(b.x - 6), Math.round(b.y + 1));
  const w = Math.round(s.width * e), h = Math.round(s.height * e);
  g.drawImage(late && b.t < 60 ? tinte(s, "rgba(255,70,40,0.55)") : s, Math.round(b.x - w / 2), Math.round(b.y + 4 - h), w, h);
}
function dibujarParticulas(g) {
  for (const p of J.part) {
    g.fillStyle = p.c;
    g.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.s, p.s);
  }
}
function actualizarFx() { for (let i = J.fx.length - 1; i >= 0; i--) { const f = J.fx[i]; if (++f.t >= f.anim.length * f.cada) J.fx.splice(i, 1); } }
function dibujarFx(g) {
  for (const f of J.fx) {
    const s = f.anim[Math.min(f.anim.length - 1, Math.floor(f.t / f.cada))];
    g.drawImage(s, Math.round(f.x - s.width / 2), Math.round(f.centro ? f.y - s.height / 2 : f.y - s.height));
  }
}
