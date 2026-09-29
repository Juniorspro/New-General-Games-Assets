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

// ── las lágrimas de Shumio: cada objeto les agrega una bandera y todas se combinan ──
const COLOR_POR_BANDERA = [["ipecac", "veneno"], ["hemo", "sangre"], ["fuego", "fuego"], ["espectral", "tinta"], ["buscadora", "violeta"], ["divino", "oro"], ["sangre", "sangre"]];
function colorLagrima(j) { for (const [k, c] of COLOR_POR_BANDERA) if (j.f[k]) return c; return "espora"; }
/** Crea una lágrima de Shumio (o de un familiar que copia sus lágrimas) con todas sus banderas. */
function lagrima(j, x, y, ang, kv = 1, o = {}) {
  const f = j.f, L = j.suerte, vel = 3.3 * j.velLag * kv;
  let vx = Math.cos(ang) * vel, vy = Math.sin(ang) * vel;
  // hereda un poco del paso (sólo de costado: así se "tuercen" como en el original)
  if (Math.abs(vx) > Math.abs(vy)) { vy += j.vy * 0.45; vx += j.vx * 0.25; } else { vx += j.vx * 0.45; vy += j.vy * 0.25; }
  const vida = (o.vida ?? alcancePx(j) / vel) * (f.orbita ? 2.2 : 1);
  let dano = o.danoFijo ?? danoDe(j) * (o.escala ?? 1), tipo = o.tipo || "lagrima";
  // lo que sale al azar (con la suerte, fórmulas de la wiki): un diente, una aguja, una luz santa
  if (tipo === "lagrima") {
    if (f.diente && A.si(chance.diente(L))) { tipo = "diente"; dano *= 3.2; }
    else if (f.aguja && A.si(chance.aguja(L))) { tipo = "aguja"; dano *= 3; }
    else if (f.santa && A.si(chance.santa(L))) tipo = "santa";
    else if (f.fractura) tipo = "hueso";
    else if (f.tendero) tipo = "moneda";
  }
  const r = lim(Math.round(radioLagrima(j) * (o.tam ?? 1) * (o.escala && o.escala > 1 ? Math.sqrt(o.escala) * 0.8 : 1) * (f.hemo ? 1.3 : 1)), 2, 12);
  const l = {
    x, y, cx: x, cy: y, z: 14, vx, vy, t: 0, vida, vidaMax: vida, r, r0: r, dano, dano0: dano, color: o.color || colorLagrima(j), tipo,
    espectral: o.espectral ?? !!(f.espectral || f.orbita || f.continuo || f.gusanoOnda || f.gusanoAnillo || f.gusanoGancho),
    atraviesa: o.atraviesa ?? !!(f.atraviesa || f.belial || tipo === "aguja"), rebote: !!f.rebote, buscadora: !!(f.buscadora || f.divino || f.corazonSagrado),
    onda: !!f.gusanoOnda, espiral: !!f.gusanoAnillo, gancho: !!f.gusanoGancho, pulso: !!f.gusanoPulso, chato: !!f.gusanoChato,
    orbita: !!f.orbita, boomerang: !!f.boomerang, continuo: !!f.continuo, flota: !!f.antigrav, arco: !!(f.ipecac || f.hemo) && !o.hija,
    ipecac: !!f.ipecac && !o.hija, hemo: !!f.hemo && !o.hija, grillo: !!f.grillo && !o.hija, parasito: f.parasito && (o.gen ?? 0) < 2, fractura: tipo === "hueso" && !o.hija, burstLaser: !!o.burstLaser,
    carbon: !!f.carbon, proptosis: !!f.proptosis, divino: !!f.divino, atractor: !!f.atractor, belial: !!f.belial, jacob: !!f.jacob, liquido: !!f.liquido, pegajosa: f.pegajosa && A.si(0.25),
    veneno: (f.veneno && A.si(chance.veneno(L))) || !!f.ipecac, hielo: f.lento && A.si(chance.lento(L)), fuego: !!f.fuego, miedo: f.miedo && A.si(chance.miedo(L)), piedra: f.piedra && A.si(chance.piedra(L)),
    urano: !!f.urano, empuje: (f.piscis ? 2.2 : 1) * (f.gusanoChato ? 1.5 : 1), gen: o.gen ?? 0, hija: !!o.hija, golpeo: false, tocados: null, dist: 0,
  };
  // la leche de almendra: cada lágrima sale con un gusano (o goma, o espejo) al azar
  if (f.almendra && !o.hija) { const k = A.uno(["onda", "espiral", "gancho", "pulso", "chato", "rebote", "boomerang"]); l[k] = true; if (k === "onda" || k === "espiral" || k === "gancho") l.espectral = true; }
  if (l.orbita) { l.ang = Math.atan2(y - j.y, x - j.x) + (A.f() - 0.5) * 0.3; l.R = 8; l.dirOrb = ang; }
  J.lagrimas.push(l);
  return l;
}
/** Una lágrima hija (el grillo, el parásito, el coágulo, la fractura): hereda casi todo. */
function hija(l, ang, factorDano, factorVida, o = {}) {
  const j = J.jug, vel = Math.hypot(l.vx, l.vy) || 3;
  const h = lagrima(j, l.x, l.y, ang, (o.kv ?? 1) * vel / (3.3 * j.velLag), { danoFijo: l.dano * factorDano, vida: Math.max(8, (l.vidaMax - l.t) * factorVida), hija: true, gen: (l.gen || 0) + 1, tipo: o.tipo || "lagrima", tam: o.tam ?? 0.65, color: l.color });
  h.parasito = !!o.parasito; h.z = Math.max(8, l.z); h.tocados = l.tocados ? new Set(l.tocados) : null;
  return h;
}

function actualizarLagrimas() {
  const L = J.lagrimas, j = J.jug, tira = !!(IN.dx || IN.dy);
  for (let i = L.length - 1; i >= 0; i--) {
    const l = L[i];
    // la antigravedad: flotan quietas mientras se mantenga el disparo (hasta 2 s)
    if (l.flota) { if (tira && l.t < 120) { l.t++; continue; } l.flota = false; l.t = 0; }
    l.t++;
    if (l.buscadora) {
      let obj = null, md = 110;
      for (const e of J.enemigos) { if (!blanco_(e)) continue; const d = dist(e.x, e.y, l.cx, l.cy); if (d < md) { md = d; obj = e; } }
      if (obj) {
        const v = Math.hypot(l.vx, l.vy), a0 = Math.atan2(l.vy, l.vx), a1 = Math.atan2(obj.y - 4 - l.cy, obj.x - l.cx);
        let da = a1 - a0; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const a = a0 + lim(da, -0.09, 0.09); l.vx = Math.cos(a) * v; l.vy = Math.sin(a) * v;
      }
    }
    // el espejo: a mitad de camino se da vuelta y vuelve a Shumio
    if (l.boomerang && l.t > l.vidaMax * 0.45) {
      const d = dist(j.x, j.y - 6, l.cx, l.cy) || 1, v = Math.hypot(l.vx, l.vy);
      l.vx += ((j.x - l.cx) / d * v - l.vx) * 0.12; l.vy += ((j.y - 6 - l.cy) / d * v - l.vy) * 0.12;
      if (d < 7 && l.t > l.vidaMax * 0.6) { L.splice(i, 1); continue; }
    }
    // el planetita: da vueltas alrededor de Shumio, corrido hacia donde llora
    if (l.orbita) {
      l.R = Math.min(34, l.R + 1.2); l.ang += 0.11 * Math.hypot(l.vx, l.vy) / 3.3;
      const [ddx, ddy] = j.dirTiro || [0, 1];
      l.cx = j.x + ddx * 8 + Math.cos(l.ang) * l.R; l.cy = j.y - 6 + ddy * 8 + Math.sin(l.ang) * l.R * 0.8;
    } else { l.cx += l.vx; l.cy += l.vy; }
    l.dist += Math.hypot(l.vx, l.vy);
    // los gusanos: la lágrima se corre de costado sobre su camino
    const v0 = Math.hypot(l.vx, l.vy) || 1, px = -l.vy / v0, py = l.vx / v0;
    let off = 0, adel = 0;
    if (l.onda) off += Math.sin(l.t * 0.17) * 8;
    if (l.gancho) { const k = Math.floor(l.t / 9) % 4; off += (k === 1 || k === 2 ? 7 : -7) * Math.min(1, (l.t % 9) / 3 + (k === 0 || k === 2 ? 0 : 1)); }
    if (l.espiral) { off += Math.sin(l.t * 0.42) * 7; adel = Math.cos(l.t * 0.42) * 7; }
    l.x = l.cx + px * off + (l.vx / v0) * adel; l.y = l.cy + py * off + (l.vy / v0) * adel;
    if (l.pulso) l.r = Math.round(l.r0 * (1.3 + 0.3 * Math.sin(l.t * 0.2)));
    // el bucle: sale por una pared y entra por la de enfrente
    if (l.continuo) {
      if (l.cx < IX0) l.cx += IX1 - IX0; else if (l.cx > IX1) l.cx -= IX1 - IX0;
      if (l.cy < IY0 - 4) l.cy += IY1 - IY0; else if (l.cy > IY1) l.cy -= IY1 - IY0;
    }
    // el daño según la distancia: los ojos saltones pierden, el carbón gana
    if (l.proptosis) { l.dano = l.dano0 * 3 * Math.max(0, 1 - l.t / 48); l.r = Math.max(2, Math.round(l.r0 * (1.2 - l.t / 60))); }
    if (l.carbon) l.dano = l.dano0 + l.dist / T * 0.55;
    // la aureola de la cabeza divina: 2 de daño 30 veces por segundo a lo que tenga cerca
    if (l.divino && l.t % 2 === 0) for (const e of J.enemigos) if (blanco_(e) && dist(e.x, e.y - 4, l.x, l.y) < e.r + l.r + 8) danarEnemigo(e, 2);
    // el atractor: tira de los enemigos (y de lo que hay en el piso) hacia la lágrima
    if (l.atractor) for (const e of J.enemigos) { if (!blanco_(e) || e.jefe) continue; const d = dist(e.x, e.y, l.x, l.y); if (d < 70 && d > 2) { e.kx += (l.x - e.x) / d * 0.35; e.ky += (l.y - e.y) / d * 0.35; } }
    l.vida--;
    // la altura: las de arco suben y bajan (el jarabe, el coágulo); las otras caen al final
    if (l.arco) l.z = 6 + Math.sin(Math.PI * Math.min(1, l.t / l.vidaMax)) * 34;
    else { const caida = l.vidaMax * 0.28; if (l.vida < caida) l.z = Math.max(0, 14 * (l.vida / caida)); }
    let rompe = l.vida <= 0 || (!l.arco && l.z <= 0) || (l.proptosis && l.t >= 48), pego = null;
    // muros
    if (!l.continuo && (l.x < IX0 + 2 || l.x > IX1 - 2 || l.y < IY0 + 1 || l.y > IY1 - 2)) {
      if (l.rebote && !l.orbita) { if (l.x < IX0 + 2 || l.x > IX1 - 2) l.vx = -l.vx; else l.vy = -l.vy; l.cx = lim(l.cx, IX0 + 3, IX1 - 3); l.cy = lim(l.cy, IY0 + 2, IY1 - 3); }
      else if (!l.orbita) rompe = true;
    }
    // obstáculos (las de arco pasan por encima mientras van altas)
    if (!rompe && !l.espectral && !(l.arco && l.z > 16)) {
      const c = celdaX(l.x), f = celdaY(l.y), o = celda(J.sala, c, f);
      if (frenaLagrima(o)) {
        golpearObstaculo(o, c, f, l.dano);
        if (l.rebote) { l.vx = -l.vx; l.vy = -l.vy; l.cx += l.vx * 2; l.cy += l.vy * 2; }
        else { rompe = true; pego = "obstaculo"; }
      }
    }
    // enemigos
    if (!rompe) for (const e of J.enemigos) {
      if (!blanco_(e) || (l.tocados && l.tocados.has(e))) continue;
      if (e.segmentos ? !tocaSegmento(e, l.x, l.y - (l.arco ? 0 : 0), l.r + 1) : dist(e.x, e.y - (e.alturaGolpe || 0), l.x, l.y) > e.r + l.r) continue;
      if (golpeLagrima(l, e)) { rompe = true; pego = e; break; }
    }
    if (rompe) { romperLagrima(l, pego); L.splice(i, 1); }
  }
}

/** La lágrima le pega a un enemigo. Devuelve true si la lágrima se rompe. */
function golpeLagrima(l, e) {
  const j = J.jug, vida0 = e.vida;
  l.golpeo = true;
  if (j.f.ojoMuerto) j.ojoMuerto = Math.min(4, j.ojoMuerto + 1), j.fallos = 0;
  if (l.ipecac) return true;                               // el jarabe explota al tocar (en romperLagrima)
  if (l.pegajosa) { J.pegadas.push({ e, t: 90, dano: 60 + l.dano, dx: l.x - e.x, dy: l.y - e.y }); }
  danarEnemigo(e, l.dano, l.vx * 0.35 * l.empuje, l.vy * 0.35 * l.empuje, l);
  if (l.tipo === "santa") { J.luces.push({ x: e.x, y: e.y, t: 20 }); for (const q of J.enemigos) if (blanco_(q) && dist(q.x, q.y, e.x, e.y) < q.r + 14) danarEnemigo(q, l.dano * 3); SFX.santa(); }
  if (l.jacob) chispa(e, l.dano * 0.5);
  if (l.tipo === "moneda" && A.si(0.05)) soltarPremio(e.x, e.y, "moneda");
  if (j.f.guppy && A.si(0.66) && J.familiares.filter((m) => m.tipo === "moscaAzul").length < 16) J.familiares.push(moscaAzul(e.x, e.y));
  if (l.urano && e.muerto) congelado(e);
  if (l.liquido) dejarBaba(l.x, l.y, 8, 90, false, "amiga");
  // el ojo de Belial: después del primero que atraviesa, pega el doble y busca
  if (l.belial && !l.tocados) { l.dano *= 2; l.buscadora = true; l.r = Math.round(l.r * 1.3); l.color = "sangre"; }
  // el cíclope: si lo mató, sigue con el daño que le sobró
  if (j.f.polifemo && e.muerto && l.dano > vida0) { l.dano -= Math.max(0, vida0); (l.tocados ||= new Set()).add(e); return false; }
  if (l.rebote && !l.atraviesa) { const d = dist(e.x, e.y, l.x, l.y) || 1; const v = Math.hypot(l.vx, l.vy); l.vx = (l.x - e.x) / d * v; l.vy = (l.y - e.y) / d * v; (l.tocados ||= new Set()).add(e); return false; }
  if (l.atraviesa) { (l.tocados ||= new Set()).add(e); return false; }
  return true;
}

/** La lágrima se rompe: acá salen las explosiones, las ráfagas y las divisiones. */
function romperLagrima(l, pego) {
  const j = J.jug;
  chapoteo(l.x, l.y - l.z, l.color, l.r);
  if (!l.golpeo && j.f.ojoMuerto && j.ojoMuerto > 0) { j.fallos++; if (A.si([0.2, 0.33, 0.5][Math.min(2, j.fallos - 1)])) j.ojoMuerto = 0; }
  if (l.ipecac) explotar(l.x, l.y, true, false, { dano: l.dano, radio: 30, danoJug: l.dano >= 85 ? 2 : 1, veneno: true });
  if (l.hemo) {                                            // el coágulo: revienta en 6–11 lágrimas (50–83 % del daño)
    if (l.burstLaser) for (let k = 0; k < 8; k++) laser(j, l.x, l.y - 4, k * TAU / 8, { dano: l.dano * 0.66 });
    else { const n = A.ent(6, 11); for (let k = 0; k < n; k++) hija(l, A.f() * TAU, 0.5 + A.f() * 0.33, 0, { kv: 0.6 + A.f() * 0.5 }).vida = 20 + A.ent(0, 18); }
  }
  if (l.grillo) for (let k = 0; k < 4; k++) hija(l, Math.atan2(l.vy, l.vx) + Math.PI / 4 + k * Math.PI / 2, 0.5, 0.4);
  if (l.parasito && pego && l.dano > 1) { const a = Math.atan2(l.vy, l.vx); for (const s of [-1, 1]) hija(l, a + Math.PI + s * 0.9, 0.5, 0.5, { parasito: true }); }
  if (l.fractura && pego) { const n = A.ent(1, 3), a = Math.atan2(l.vy, l.vx); for (let k = 0; k < n; k++) hija(l, a + Math.PI + (A.f() - 0.5) * 2.4, 0.5, 0.35, { tipo: "hueso", tam: 0.5 }); }
  if (l.liquido && !pego) dejarBaba(l.x, l.y, 8, 90, false, "amiga");
  if (l.jacob && pego === "obstaculo") { const a = V.f() * TAU; J.chispas.push({ x0: l.x, y0: l.y, x1: l.x + Math.cos(a) * 24, y1: l.y + Math.sin(a) * 24, t: 8 }); }
  if (j.f.estalla && pego && pego !== "obstaculo" && A.si(chance.estalla(j.suerte))) J.pendientes.push(() => explotar(l.x, l.y, true, false, { dano: l.dano, radio: 22, danoJug: 1, fuego: true }));
}

/** Urano: el que muere helado queda como estatua y revienta en 8 carámbanos. */
function congelado(e) {
  const j = J.jug;
  particulas(e.x, e.y, 10, PAL.hielo.slice(2), 2);
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8, l = lagrima(j, e.x, e.y - 4, a, 0.9, { danoFijo: danoDe(j), hija: true, color: "hielo", tam: 0.7, vida: 40 });
    l.urano = false;
  }
}

/** Las lágrimas pegajosas: quedan en el enemigo y explotan a los 1,5 s (60 + el daño). */
function actualizarPegadas() {
  for (let i = J.pegadas.length - 1; i >= 0; i--) {
    const p = J.pegadas[i];
    if (--p.t > 0 && !p.e.muerto) continue;
    J.pegadas.splice(i, 1);
    explotar(p.e.x + p.dx, p.e.y + p.dy, true, false, { dano: p.dano, radio: 34, danoJug: 1 });
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

// ── las bombas (las de Shumio y las del feto) ──
function actualizarBombas() {
  for (let i = J.bombas.length - 1; i >= 0; i--) {
    const b = J.bombas[i];
    b.t--;
    const roce = b.feto ? 0.93 : 0.85;
    b.vx *= roce; b.vy *= roce;
    moverEnSala(J.sala, b, b.vx, b.vy, false);
    // Shumio las empuja al caminar contra ellas
    const j = J.jug, d = dist(j.x, j.y, b.x, b.y);
    if (!b.feto && d < 9 && d > 0.01 && b.t < 80) { b.vx += (b.x - j.x) / d * 0.5; b.vy += (b.y - j.y) / d * 0.5; }
    // feto + jarabe: explotan al tocar
    if (b.contacto && J.enemigos.some((e) => blanco_(e) && dist(e.x, e.y, b.x, b.y) < e.r + 5)) b.t = 0;
    if (b.t <= 0) {
      J.bombas.splice(i, 1);
      explotar(b.x, b.y, true, b.gorda, { dano: b.dano, danoJug: b.danoJug, veneno: b.veneno, rayos: b.rayos, lasers: b.lasers });
      // feto + cíclope: aparece otra bomba donde explotó, con la mitad del daño
      if (b.segunda && b.dano) J.bombas.push({ ...b, t: 40, vx: 0, vy: 0, dano: b.dano / 2, segunda: false });
    }
  }
}

/** La explosión: daña (a Shumio también), rompe obstáculos y abre las puertas secretas.
 *  o: { dano, radio, danoJug, veneno, rayos (rayos que salen), lasers, fuego } */
function explotar(x, y, dePlayer, gorda = false, o = {}) {
  const j = J.jug;
  const R = o.radio ?? (gorda ? 52 : 42), dano = (o.dano ?? 60) * (gorda && o.dano ? 1.85 : 1) + (gorda && !o.dano ? 15 : 0);
  SFX.explosion(); temblar(gorda || R > 44 ? 14 : R < 32 ? 5 : 10);
  const escala = R / 42;
  J.fx.push({ anim: [0, 1, 2, 3, 4, 5].map(explosionSpr), x, y: y + 6 * escala, t: 0, cada: 4, centro: false, escala });
  J.destello = Math.max(J.destello, R > 32 ? 3 : 1);
  mancha("quemado", x, y, 1.4 * escala);
  particulas(x, y, Math.round(14 * escala), o.veneno ? ["#255a1c", "#44922c", "#86d04a"] : ["#3a2c28", "#5a4640", "#f59a26", "#ffe07a"], 3 * escala);
  for (const e of J.enemigos) if (!e.muerto && !e.oculto && dist(e.x, e.y, x, y) < R + e.r) {
    const d = dist(e.x, e.y, x, y) || 1;
    danarEnemigo(e, dano, (e.x - x) / d * 5, (e.y - y) / d * 5, o.veneno || o.fuego ? { veneno: o.veneno, fuego: o.fuego } : null);
  }
  if (dist(j.x, j.y, x, y) < R + 2 && !j.f.inmuneExplosion) { herirJugador(j, o.danoJug ?? 2, "TU PROPIA EXPLOSIÓN", bombaSpr(1)); const d = dist(j.x, j.y, x, y) || 1; j.vx += (j.x - x) / d * 5; j.vy += (j.y - y) / d * 5; }
  for (const b of J.bombas) { const d = dist(b.x, b.y, x, y) || 1; if (d < R) { b.vx += (b.x - x) / d * 4; b.vy += (b.y - y) / d * 4; } }
  for (const c of J.sala.cosas) {
    if (c.t === "cofre" && c.sub === "piedra" && !c.abierto && dist(c.x, c.y, x, y) < R + 8) abrirCofre(c);
    if (!c.quieto && c.t !== "objeto" && c.t !== "trampilla") { const d = dist(c.x, c.y, x, y) || 1; if (d < R) { c.vx += (c.x - x) / d * 4; c.vy += (c.y - y) / d * 4; c.vz = 2; } }
  }
  // feto + rayo / feto + láser: la explosión suelta rayos o láseres
  if (o.rayos) for (let k = 0; k < o.rayos; k++) { const a = o.rayos === 4 ? k * Math.PI / 2 : A.f() * TAU; rayo(j, { x, y: y + 10 }, a, 0, 1, 40); }
  if (o.lasers) for (let k = 0; k < o.lasers; k++) laser(j, x, y - 4, k * TAU / o.lasers + 0.2);
  // los obstáculos
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
    const q = celda(J.sala, c, f);
    if (!q || dist(cx(c), cy(f), x, y) > R + 10) continue;
    if (q.t === "roca") {
      J.sala.celdas[f * COLS + c] = null; SFX.roca();
      particulas(cx(c), cy(f), 8, PAL.piedra.slice(2), 2.4);
      mancha("quemado", cx(c), cy(f), 0.8);
      if (q.marcada) { SFX.secreto(); soltarPremio(cx(c), cy(f), A.pesos([["espora", 5], ["bomba", 3], ["llave", 2]])); }
      else if (A.si(0.04)) soltarPremio(cx(c), cy(f));
      J.cambioGrilla = true;
    } else if (q.t === "matas" && q.vida > 0) { q.vida = 0; J.cambioGrilla = true; particulas(cx(c), cy(f), 6, ["#7a5636", "#a8835a"], 2); }
    else if (q.t === "brasero") { J.sala.celdas[f * COLS + c] = null; J.cambioGrilla = true; humo(cx(c), cy(f)); }
    else if (q.t === "barril") { J.sala.celdas[f * COLS + c] = null; J.cambioGrilla = true; J.pendientes.push(() => explotar(cx(c), cy(f), false)); }
  }
  // las puertas secretas
  for (let d = 0; d < 4; d++) {
    const p = J.sala.puertas[d];
    if (!p || !p.secreta || p.revelada) continue;
    const q = PUERTA[d];
    if (dist(q.x, q.y, x, y) < R + 16) { p.revelada = true; if (p.par) p.par.revelada = true; SFX.secreto(); particulas(q.x, q.y, 10, PAL.piedra.slice(2), 2.5); }
  }
  // las puertas con llave no se vuelan (como en el original)
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
function dejarBaba(x, y, r = 9, dura = 240, danina = true, tipo = "baba") {
  if (J.babas.length > 90) J.babas.shift();
  J.babas.push({ x, y, r, t: dura, max: dura, danina, tipo, v: V.ent(0, 5) });
}
/** La baba amiga (la de Bob, el líquido misterioso): 20 de daño por segundo a lo que la pisa. */
function actualizarBabas() {
  for (let i = J.babas.length - 1; i >= 0; i--) {
    const b = J.babas[i];
    if (b.tipo === "amiga" && J.t % 3 === 0) for (const e of J.enemigos) if (blanco_(e) && !e.vuela && dist(e.x, e.y, b.x, b.y) < b.r + e.r * 0.5) danarEnemigo(e, 1);
    if (--b.t <= 0) J.babas.splice(i, 1);
  }
}
function dibujarBabas(g) {
  for (const b of J.babas) {
    const s = b.tipo === "amiga" ? tinte(manchaSpr("baba", b.v), "rgba(70,200,40,0.55)") : manchaSpr("baba", b.v), k = b.r / 9;
    g.globalAlpha = Math.min(1, b.t / 40) * 0.8;
    g.drawImage(s, Math.round(b.x - s.width * k / 2), Math.round(b.y - s.height * k / 2), Math.round(s.width * k), Math.round(s.height * k));
  }
  g.globalAlpha = 1;
}

// ── dibujar lo que vuela ──
function dibujarLagrima(g, l) {
  const sh = sombra(Math.max(2, l.r - 1), Math.max(1, Math.round(l.r / 2)));
  g.drawImage(sh, Math.round(l.x - sh.width / 2), Math.round(l.y - sh.height / 2 + 2));
  const X = l.x, Y = l.y - l.z;
  if (l.tipo === "cuchillo" || l.tipo === "aguja" || l.tipo === "hueso" || l.tipo === "diente") {
    const s = l.tipo === "cuchillo" ? cuchilloSpr() : proyectilSpr(l.tipo);
    g.save(); g.translate(Math.round(X), Math.round(Y)); g.rotate(Math.atan2(l.vy, l.vx) + (l.tipo === "hueso" ? l.t * 0.3 : 0)); g.drawImage(s, -s.width / 2, -s.height / 2); g.restore();
    return;
  }
  if (l.tipo === "moneda") { const s = monedaSpr(Math.floor(l.t / 4) % 4); g.drawImage(s, Math.round(X - s.width / 2), Math.round(Y - s.height / 2)); return; }
  let s = lagrimaSpr(l.r, l.veneno ? "veneno" : l.hielo ? "hielo" : l.fuego ? "fuego" : l.piedra ? "hueso" : l.miedo ? "tinta" : l.tipo === "santa" ? "hielo" : l.color);
  if (l.chato) { const w = Math.round(s.width * 1.5); g.drawImage(s, Math.round(X - w / 2), Math.round(Y - s.height / 2), w, s.height); }
  else g.drawImage(s, Math.round(X - s.width / 2), Math.round(Y - s.height / 2));
  if (l.tipo === "santa" || l.divino) { g.globalAlpha = 0.35; g.drawImage(aro(l.r + 4, "rgba(255,250,210,0.35)", "rgba(255,240,170,0.7)"), Math.round(X - l.r - 4), Math.round(Y - l.r - 4)); g.globalAlpha = 1; }
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
    const s = f.anim[Math.min(f.anim.length - 1, Math.floor(f.t / f.cada))], k = f.escala || 1;
    const w = Math.round(s.width * k), h = Math.round(s.height * k);
    g.drawImage(s, Math.round(f.x - w / 2), Math.round(f.centro ? f.y - h / 2 : f.y - h), w, h);
  }
}
