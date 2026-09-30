// ─────────────────────────────────────────────────────────────────────────────
// LAS SALAS LATERALES ("burbujas": afuera el tiempo se para). Tres clases, como en el original:
// una veta de gemas, un módulo de arma (con una cápsula de +1 vida o +2 carga) o una tienda con tres
// cosas al azar (precio base + 200 por zona; la tarjeta VIP descuenta 10%). Se compra tocando la cosa.
// ─────────────────────────────────────────────────────────────────────────────

function entrarSala(p) {
  const j = J.jug;
  p.usada = true;
  J.salaDe = { N: J.N, x: j.x, y: j.y, bichos: J.bichos, gemas: J.gemas, adornos: J.adornos, puerta: p };
  const N = generarSala(p.tipo, p.lado);
  J.N = N; J.bichos = []; J.gemas = []; J.adornos = []; J.balas = [];
  J.sala = { tipo: p.tipo, cosas: [] };
  // entrás por el costado y aparecés parado en el piso de la sala
  j.x = p.lado < 0 ? (COLS - 1.5) * T : 1.5 * T; j.y = N.piso * T; j.vx = 0; j.vy = 0;
  const xs = [3.5, 6, 8.5].map((c) => c * T), piso = N.piso * T;
  J.camY = 0;
  if (p.tipo === "tienda") {
    const zona = J.zona, desc = J.mejoras.tarjeta ? 0.9 : 1;
    // las cosas flotan a la altura de un salto: se compra SALTANDO hacia ellas (caminando por abajo no)
    A.mezclar(Object.keys(TIENDA)).slice(0, 3).forEach((k, i) => J.sala.cosas.push({ k, x: xs[i], y: piso - 30, precio: Math.round((TIENDA[k].precio + zona * 200) * desc / 10) * 10, vendido: false }));
  } else if (p.tipo === "modulo") {
    const libres = Object.keys(ARMAS).filter((k) => k !== J.arma && k !== "metra");
    J.sala.cosas.push({ k: A.uno(libres), x: 6 * T, y: piso - 34, modulo: true, bonus: A.si(0.5) ? "vida" : "carga" });
  }
  J.cartel = null;
  tocarTema("tienda");
  sfx("puerta");
}
function salirSala() {
  const s = J.salaDe, j = J.jug;
  J.N = s.N; J.bichos = s.bichos; J.gemas = s.gemas; J.adornos = s.adornos; J.balas = [];
  J.sala = null; J.salaDe = null;
  j.x = s.puerta.lado < 0 ? 1.4 * T + 8 : (COLS - 1.4) * T - 8; j.y = s.puerta.y; j.vx = 0; j.vy = 0;
  // correrlo hasta el borde de la pared para que no quede adentro de la roca
  while (solida(J.N.en(Math.floor(j.x / T), Math.floor((j.y - 4) / T))) && j.x > 8 && j.x < COLS * T - 8) j.x += s.puerta.lado < 0 ? 4 : -4;
  tocarTema(ZONAS[J.zona] ? ZONAS[J.zona].tema : "jefe");
  sfx("puerta");
}
function pasoSala(dt) {
  const j = J.jug;
  for (const c of J.sala.cosas) {
    // se toca con la cabeza o el cuerpo (la caja del jugador contra la cosa)
    if (c.vendido || Math.abs(j.x - c.x) > 8 || j.y - j.h > c.y + 6 || j.y < c.y - 6) { c.cerca = false; continue; }
    if (c.cerca) continue;
    c.cerca = true;
    if (c.modulo) {
      J.arma = c.k; c.vendido = true;
      if (c.bonus === "vida") curar(1); else { j.cargaMax += 2; j.carga = j.cargaMax; }
      cartel(L(ARMAS[c.k].n), 2, L(ARMAS[c.k].d)); sfx("elegir");
    } else {
      const d = TIENDA[c.k];
      if (J.gemasPartida < c.precio) { cartel(L(TX.pobre), 1.2); sfx("no"); continue; }
      J.gemasPartida -= c.precio; c.vendido = true;
      if (d.vida) curar(d.vida);
      if (d.carga) { j.cargaMax += d.carga; j.carga = j.cargaMax; }
      if (d.max) { j.vidaMax += d.max; j.vida += d.max; }
      cartel(L(TX.gracias), 1.2, L(d.n)); sfx("comprar");
    }
  }
}
function dibujarSala(cy) {
  const s = J.sala, t = performance.now() / 1000;
  const titulo = s.tipo === "tienda" ? L(TX.tienda) : s.tipo === "veta" ? L(TX.veta) : L(TX.modulo);
  texto(titulo, W / 2, 4 * T - cy, { escala: 2 });
  if (s.tipo === "tienda") {
    // el vendedor, detrás del mostrador
    const v = selloSpr("vendedor", ["..#####..", ".#######.", ".##o#o##.", ".#######.", "..#.#.#..", "#########", "#.#####.#", "#########"]);
    const py = (J.N.piso - 5.2) * T - cy;
    g.drawImage(v, Math.round(W / 2 - v.width / 2), Math.round(py - 30));
    g.fillStyle = C_TINTA; g.fillRect(W / 2 - 22, Math.round(py - 22), 44, 2);
  }
  // lo que dice la cosa más cercana (una sola a la vez: los tres textos juntos no entran)
  const j = J.jug; let cerca = null, md = 40;
  for (const c of s.cosas) if (!c.vendido && !c.modulo && Math.abs(c.x - j.x) < md) { md = Math.abs(c.x - j.x); cerca = c; }
  if (cerca) { texto(L(TIENDA[cerca.k].n), W / 2, 6 * T - cy); texto(L(TIENDA[cerca.k].d), W / 2, 6 * T + 11 - cy, { color: "acento" }); }
  for (const c of s.cosas) {
    if (c.vendido) continue;
    const Y = Math.round(c.y - cy + Math.sin(t * 3 + c.x) * 1.5);
    if (c.modulo) {
      const cap = capsulaSpr(ARMAS[c.k].letra); g.drawImage(cap, Math.round(c.x - cap.width / 2), Y - 8);
      const b = c.bonus === "vida" ? corazonSpr() : cargaSpr(); g.drawImage(b, Math.round(c.x - b.width / 2), Y + 12);
      texto(L(ARMAS[c.k].n), W / 2, Y - 22);
    } else {
      const ic = iconoSpr(TIENDA[c.k].ico); g.drawImage(ic, Math.round(c.x - ic.width / 2), Y - 4);
      texto(String(c.precio), c.x, Y + 9, { color: J.gemasPartida >= c.precio ? "tinta" : "acento" });
    }
  }
}

// ── EL JEFE: La Fauce, en el fondo del Abismo ──
// Un ojo gigante rojo (no se pisa) que se abre y se cierra: abierto se le puede pegar, cerrado es
// inmune. Tira tres bolas (la del medio apuntada a vos), llama murciélagos y le caen dientes del techo.
function crearJefe(N) {
  J.jefe = { x: COLS * T / 2, y: (N.filas - 4) * T, vida: 70, max: 70, t: 0, abierto: false, ciclo: 0, disparoT: 2, dienteT: 1.5, llamaT: 7, flash: 0, muerto: false, muerteT: 0 };
}
function pasoJefe(dt) {
  const B = J.jefe, j = J.jug;
  if (!B) return;
  if (B.muerto) { B.muerteT += dt; if (J.cuadro % 4 === 0) { explosion(B.x + (V.f() - 0.5) * 60, B.y - 20 + (V.f() - 0.5) * 40, 16, 0, true); } if (B.muerteT > 2.5 && !J.ganado) { J.ganado = true; J.finT = 0; } return; }
  B.t += dt; B.ciclo += dt; if (B.flash > 0) B.flash -= dt;
  // se abre 2,6 s y se cierra 3 s
  const periodo = 5.6, f = B.ciclo % periodo; B.abierto = f < 2.6;
  B.x = COLS * T / 2 + Math.sin(B.t * 0.6) * 38;
  if ((B.disparoT -= dt) <= 0) {
    B.disparoT = B.vida < B.max / 2 ? 1.5 : 2.2;
    const ang = Math.atan2(j.y - 6 - (B.y - 30), j.x - B.x);
    for (const k of [-0.4, 0, 0.4]) { const b = crearBicho("bola", B.x, B.y - 34); b.vx = Math.cos(ang + k) * 95; b.vy = Math.sin(ang + k) * 95; }
    sfx("tiroGordo", 0.5);
  }
  if ((B.dienteT -= dt) <= 0) { B.dienteT = 1.1 + V.f() * 0.8; const d = crearBicho("diente", 2 * T + V.f() * (COLS - 4) * T, J.camY - 10); d.vy = 120; }
  if ((B.llamaT -= dt) <= 0) { B.llamaT = 8; for (const s of [-1, 1]) { const m = crearBicho("murcielago", B.x + s * 40, B.y - 50); m.suelto = true; } }
  // tocar al jefe duele (es rojo)
  if (Math.abs(j.x - B.x) < 30 && j.y > B.y - 50 && j.y - j.h < B.y) herir();
  // los tiros que le dan al ojo abierto
  for (let i = J.balas.length - 1; i >= 0; i--) {
    const q = J.balas[i];
    if (Math.abs(q.x - B.x) < 30 && q.y > B.y - 52 && q.y < B.y) {
      J.balas.splice(i, 1);
      if (B.abierto && Math.abs(q.x - B.x) < 12) { B.vida -= q.dano; B.flash = 0.08; sfx("golpe", 0.5); if (B.vida <= 0) { B.muerto = true; sfx("jefe"); temblor(10); for (const b of J.bichos) b.muerto = true; } }
      else chispa(q.x, q.y);
    }
  }
}
function dibujarJefe(cy) {
  const B = J.jefe; if (!B || (B.muerto && B.muerteT > 2.4)) return;
  const x = Math.round(B.x), y = Math.round(B.y - cy), t = B.t;
  // el cuerpo: una masa roja con dientes, que respira
  const R = 30 + Math.sin(t * 2) * 1.5;
  g.fillStyle = C_FONDO; g.beginPath(); g.arc(x, y - 22, R + 2, Math.PI, 0); g.fill();
  g.fillStyle = B.flash > 0 ? C_TINTA : C_ACENTO; g.beginPath(); g.arc(x, y - 22, R, Math.PI, 0); g.fill(); g.fillRect(x - R, y - 22, R * 2, 22);
  g.fillStyle = C_FONDO; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(x + k * 8 - 4, y); g.lineTo(x + k * 8, y - 8); g.lineTo(x + k * 8 + 4, y); g.fill(); }
  // el ojo
  if (B.abierto) {
    g.fillStyle = C_TINTA; g.beginPath(); g.ellipse(x, y - 30, 13, 9, 0, 0, TAU); g.fill();
    const j = J.jug, a = Math.atan2(j.y - (B.y - 30), j.x - x);
    g.fillStyle = C_FONDO; g.beginPath(); g.arc(x + Math.cos(a) * 5, y - 30 + Math.sin(a) * 3, 4.5, 0, TAU); g.fill();
  } else { g.fillStyle = C_FONDO; g.fillRect(x - 13, y - 31, 26, 2); for (let k = -2; k <= 2; k++) g.fillRect(x + k * 5, y - 29, 1, 3); }
  // la barra de vida del jefe, abajo de todo
  const bw = W - 40, k = lim(B.vida / B.max, 0, 1);
  g.fillStyle = C_FONDO; g.fillRect(19, H - 17, bw + 2, 8); g.fillStyle = C_TINTA; g.fillRect(20, H - 16, bw, 6); g.fillStyle = C_FONDO; g.fillRect(21, H - 15, bw - 2, 4); g.fillStyle = C_ACENTO; g.fillRect(21, H - 15, Math.round((bw - 2) * k), 4);
  texto(L(TX.jefe), W / 2, H - 29);
}
