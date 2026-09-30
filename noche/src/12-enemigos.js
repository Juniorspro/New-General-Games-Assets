// ─────────────────────────────────────────────────────────────────────────────
// LOS ENEMIGOS: la multitud. Cada minuto es una oleada (wiki): si hay menos que el mínimo,
// aparecen de a muchos hasta llegar; si no, uno de cada tipo cada "intervalo". Aparecen justo afuera
// de la pantalla, caminan hacia vos, se empujan entre ellos (grilla espacial: 300 enemigos sin
// que el teléfono sufra) y los que quedan muy lejos se reubican del otro lado.
// ─────────────────────────────────────────────────────────────────────────────

const CELDA = 24, GRID = new Map();
const TOPE_NORMAL = 300, TOPE_TOTAL = 400;
function armarGrilla() {
  GRID.clear();
  for (const e of J.enemigos) { const k = (Math.floor(e.x / CELDA) + 5000) * 10000 + (Math.floor(e.y / CELDA) + 5000); let c = GRID.get(k); if (!c) GRID.set(k, (c = [])); c.push(e); }
}
/** Llama fn(e) para cada enemigo a menos de r de (x, y). */
function cercanos(x, y, r, fn) {
  const c0 = Math.floor((x - r - 12) / CELDA), c1 = Math.floor((x + r + 12) / CELDA), f0 = Math.floor((y - r - 12) / CELDA), f1 = Math.floor((y + r + 12) / CELDA);
  for (let cx = c0; cx <= c1; cx++) for (let cy = f0; cy <= f1; cy++) {
    const c = GRID.get((cx + 5000) * 10000 + (cy + 5000)); if (!c) continue;
    for (const e of c) { if (e.muerto) continue; const rr = r + e.r; if ((e.x - x) ** 2 + (e.y - 4 - y) ** 2 <= rr * rr) fn(e); }
  }
}

/** Un punto justo afuera de la pantalla (en un anillo alrededor de lo que se ve). */
function puntoAfuera(margen = 18) {
  const c = J.cam, lado = A.f() * (2 * (W + H));
  if (lado < W) return [c.x + lado, c.y - margen];
  if (lado < 2 * W) return [c.x + lado - W, c.y + H + margen];
  if (lado < 2 * W + H) return [c.x - margen, c.y + lado - 2 * W];
  return [c.x + W + margen, c.y + lado - 2 * W - H];
}
function aparecer(tipo, x, y, extra) {
  const d = ENEMIGOS[tipo]; if (!d) return null;
  if (x == null) [x, y] = puntoAfuera(d.jefe ? 30 : 18);
  const maldicion = J.st ? J.st.maldicion : 1;
  let vida = d.vida * (d.xnivel ? J.nivel : 1) * J.E.vida * (d.jefe ? 1 : maldicion);
  const e = { tipo, d, x, y, vida, max: vida, r: d.r, vel: d.vel * VEL_U * J.E.velEne * (0.92 + A.f() * 0.16) * maldicion,
    kb: 0, kvx: 0, kvy: 0, flash: 0, cuadro: A.f() * 2, izq: false, muerto: false, ...extra };
  J.enemigos.push(e);
  return e;
}

function pasoEnemigos(dt) {
  const j = J.jug, frio = J.congelado > 0;
  armarGrilla();
  for (const e of J.enemigos) {
    if (e.flash > 0) e.flash -= dt;
    let dx = j.x - e.x, dy = j.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    // muy lejos: los normales se reubican del otro lado; los jefes vuelven cerca (wiki)
    if (dist > Math.max(W, H) * 1.1) { if (e.recto || e.d.brasero) { e.muerto = true; continue; } const [nx, ny] = puntoAfuera(e.d.jefe ? 30 : 18); e.x = nx; e.y = ny; continue; }
    if (e.d.brasero) { e.cuadro += dt * 8; continue; }
    if (frio && !e.d.parca) { e.cuadro += 0; continue; }
    if (e.kb > 0) { e.kb -= dt; e.x += e.kvx * dt; e.y += e.kvy * dt; continue; }
    let mx, my;
    if (e.recto) { mx = e.dirX; my = e.dirY; }
    else { mx = dx / dist; my = dy / dist; }
    e.x += mx * e.vel * dt; e.y += my * e.vel * dt;
    if (Math.abs(mx) > 0.15) e.izq = mx < 0;
    e.cuadro += dt * (e.d.vuela ? 7 : 4);
    // empujarse entre ellos: la multitud se ve como una marea, no un punto
    if (!e.recto) {
      const cxx = Math.floor(e.x / CELDA), cyy = Math.floor(e.y / CELDA);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const c = GRID.get((cxx + ox + 5000) * 10000 + (cyy + oy + 5000)); if (!c) continue;
        for (const o of c) {
          if (o === e || !o.d.vuela !== !e.d.vuela || o.recto) continue;   // los que vuelan se separan entre ellos, los de a pie entre ellos
          const ddx = e.x - o.x, ddy = e.y - o.y, rr = (e.r + o.r) * 0.8, d2 = ddx * ddx + ddy * ddy;
          if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2), f = (rr - d) / d * 0.25; e.x += ddx * f; e.y += ddy * f; }
        }
      }
    }
    // tocarte duele (y te encierran: te empujan un poco)
    const toca = e.r + 5;
    if (dist < toca) {
      herirJugador(e.d.dano);
      const emp = (toca - dist) / dist;
      e.x -= dx * emp * 0.7; e.y -= dy * emp * 0.7;
      if (!e.d.parca) { j.x += dx * emp * 0.25; j.y += dy * emp * 0.25; }
    }
  }
  // los muertos se van
  for (let i = J.enemigos.length - 1; i >= 0; i--) if (J.enemigos[i].muerto) J.enemigos.splice(i, 1);
}

/** Pega a un enemigo: daño, destello blanco, empuje (dirección dx, dy), número. */
function golpear(e, dano, emp, a, dx, dy, crit) {
  if (e.muerto) return;
  if (e.d.parca && dano < 1e6) dano = Math.min(dano, 1);   // la parca no se deja
  e.vida -= dano; e.flash = 0.12;
  if (a) a.dano += Math.min(dano, e.vida + dano);
  const k = emp * ((e.d.emp || 0) + (e.empExtra || 0));
  if (k > 0 && !e.d.jefe && J.congelado <= 0) { const n = Math.hypot(dx, dy) || 1; e.kb = 0.12; e.kvx = dx / n * 110 * Math.min(k, 3); e.kvy = dy / n * 110 * Math.min(k, 3); }
  if (G.op.numeros) numero(e.x, e.y - 10 - V.f() * 4, corto(dano), crit ? "#ffe060" : "#ffffff");
  sfx("golpe", 0.25);
  if (e.vida <= 0) matar(e);
}
function matar(e, sinBotin) {
  if (e.muerto) return;
  e.muerto = true;
  if (e.d.brasero) { sfx("brasero", 0.6); J.efectos.push({ tipo: "onda", x: e.x, y: e.y - 6, t: 0.3, t0: 0.3, r: 10, col: "#ffc040" }); if (!sinBotin) botinBrasero(e.x, e.y); return; }
  J.kills++;
  J.efectos.push({ tipo: "muerte", x: e.x, y: e.y - 6, t: 0.3, t0: 0.3, spr: enemigoSpr(e.d.spr, 0, e.izq, e.d.tinte), esc: Math.max(1, Math.round(e.d.esc || 1)) });
  sfx("muere", 0.3);
  if (sinBotin) return;
  if (e.d.xp) soltarGema(e.x, e.y, e.d.xp);
  if (e.d.jefe && COFRES_JEFE[e.tipo]) J.cosas.push({ tipo: "cofre", x: e.x, y: e.y, jefe: e.tipo, evo: J.t >= 600 * (J.duracion / 1800) || J.minuto <= 1 });
  // Devoraalmas: los caídos sueltan corazoncitos que curan 1
  if (J.armas.some((a) => a.k === "devora") && A.si(0.08)) J.cosas.push({ tipo: "corazoncito", x: e.x + 4, y: e.y });
  if (A.si(0.004)) J.cosas.push({ tipo: "moneda", x: e.x - 3, y: e.y });
}

// ── las oleadas ──
function minutoDe(t) { return Math.floor(t / (60 * J.duracion / 1800)); }
function pasoOleadas(dt) {
  const min = minutoDe(J.t);
  if (J.t >= J.duracion) { llegaLaParca(); return; }
  const ol = J.E.oleadas[Math.min(min, J.E.oleadas.length - 1)];
  if (min !== J.minuto) {
    J.minuto = min;
    for (const b of ol.jefes || []) aparecer(b);
    if ((ol.jefes || []).some((b) => ENEMIGOS[b].jefe)) sfx("jefe", 0.6);
    if (ol.ev && A.si(ol.ev[1])) for (let k = 0; k < ol.ev[2]; k++) J.eventos.push({ tipo: ol.ev[0], t: k * 5 });
  }
  // eventos pendientes (enjambres, anillo de flores)
  for (let i = J.eventos.length - 1; i >= 0; i--) { const ev = J.eventos[i]; if ((ev.t -= dt) <= 0) { evento(ev.tipo); J.eventos.splice(i, 1); } }
  const normales = J.enemigos.length, maldicion = J.st.maldicion;
  if (normales >= TOPE_NORMAL) return;
  const minimo = Math.min(TOPE_NORMAL, Math.round(ol.min * maldicion * 0.8));
  if (normales < minimo) { for (let k = 0; k < 4 && J.enemigos.length < minimo; k++) aparecer(A.uno(ol.e)); return; }
  J.spawnT -= dt * maldicion;
  if (J.spawnT <= 0) { J.spawnT = Math.max(0.12, ol.int); for (const t of ol.e) aparecer(t); }
}
function evento(tipo) {
  const j = J.jug;
  if (tipo === "enjambre" || tipo === "fantasmas") {
    // una bandada que cruza la pantalla en línea recta, apuntada a donde estás
    const lado = A.ent(0, 3), n = 22, t = tipo === "enjambre" ? "enjambre" : "fantasmaEnj";
    for (let k = 0; k < n; k++) {
      const off = (k - n / 2) * 7 + (A.f() - 0.5) * 6;
      let x, y; if (lado === 0) { x = J.cam.x - 20 - A.f() * 20; y = j.y + off; } else if (lado === 1) { x = J.cam.x + W + 20 + A.f() * 20; y = j.y + off; } else if (lado === 2) { x = j.x + off; y = J.cam.y - 20 - A.f() * 20; } else { x = j.x + off; y = J.cam.y + H + 20 + A.f() * 20; }
      const dx = j.x - x, dy = j.y - y;
      if (J.enemigos.length < TOPE_TOTAL) aparecer(t, x, y, { recto: 1, dirX: lado < 2 ? Math.sign(dx) : 0, dirY: lado < 2 ? 0 : Math.sign(dy) });
    }
  } else if (tipo === "flores") {
    // el anillo de flores: te encierran y se van cerrando despacio
    const n = 36, r = Math.max(W, H) * 0.42;
    for (let k = 0; k < n; k++) { const a = (k / n) * TAU; if (J.enemigos.length < TOPE_TOTAL) aparecer("flor", j.x + Math.cos(a) * r, j.y + Math.sin(a) * r); }
  }
}
function llegaLaParca() {
  if (J.parcas === 0) {
    for (const e of J.enemigos) if (!e.d.parca) matar(e, true);
    J.cartel = { txt: TX.parca, t: 3, rojo: true };
    sfx("jefe"); tocarTema("fin");
  }
  const cuantas = 1 + Math.floor((J.t - J.duracion) / 60);
  while (J.parcas < cuantas) { J.parcas++; aparecer("parca"); }
}
