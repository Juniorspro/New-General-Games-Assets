// ─────────────────────────────────────────────────────────────────────────────
// LA PARTIDA: 4 zonas de 3 niveles y el Abismo con el jefe. Entre nivel y nivel se elige una mejora.
// El paso es fijo a 60 Hz; el dibujo ordena: roca, burbujas, adornos, gemas, bichos, tiros, el que
// cae, efectos y el HUD como el de celular del original.
// ─────────────────────────────────────────────────────────────────────────────

function nuevaPartida(semilla = (Math.random() * 1e9) | 0) {
  J = { semilla, zona: 0, nivel: 0, jug: nuevoJugador(G.estilo), mejoras: {}, arma: "metra", gemasPartida: 0, gemasJuntadas: 0, kills: 0, maxCombo: 0,
    t: 0, cuadro: 0, bichos: [], balas: [], gemas: [], efectos: [], adornos: [], cadena: [], camY: 0, temblor: 0, cartel: null, fase: "juego",
    rachaGemas: 0, rachaT: 0, bannerGH: 0, flash: 0, finT: 0, sala: null, salaDe: null, jefe: null, ganado: false, dron: { x: 0, y: 0 }, extraOpciones: 0, pausa: false, ayudaT: 6 };
  G.partidas++; guardar();
  empezarNivel();
}
function nombreNivel() { return J.zona < 4 ? `${L(ZONAS[J.zona].n)}-${J.nivel + 1}` : L(TX.abismo); }
function empezarNivel() {
  const E = ESTILOS[G.estilo] || ESTILOS.normal, semilla = J.semilla + J.zona * 17 + J.nivel * 5;
  const N = J.zona < 4 ? generarNivel(J.zona, J.nivel, semilla, { tienda: J.mejoras.tarjeta, soloArmas: E.soloArmas }) : generarAbismo(semilla);
  J.N = N; J.bichos = []; J.gemas = []; J.balas = []; J.cadena = []; J.jefe = null;
  for (const b of N.bichos) crearBicho(b.tipo, b.x, b.y);
  J.adornos = N.adornos.map((a) => ({ ...a, w: 8, h: 8, roto: false }));
  const j = J.jug;
  j.x = N.inicio.x; j.y = N.inicio.y; j.vx = 0; j.vy = 0; j.carga = j.cargaMax; j.globo = !!J.mejoras.globo; j.combo = 0;
  J.camY = j.y - H * 0.35;
  if (J.zona >= 4) crearJefe(N);
  cartel(nombreNivel(), 2.4);
  tocarTema(J.zona < 4 ? ZONAS[J.zona].tema : "jefe");
  if (J.zona >= 4) sfx("jefe", 0.7);
}
/** El Abismo: una sala alta con repisas a los costados y el jefe en el fondo; una tienda arriba. */
function generarAbismo(semilla) {
  rnd = mulberry(semilla);
  const filas = 44, t = new Uint8Array(filas * COLS), N = { zona: 4, nivel: 0, filas, t, puertas: [], bichos: [], adornos: [], abismo: true };
  const pon = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < filas) t[y * COLS + x] = c; };
  N.en = (x, y) => (x < 0 || x >= COLS ? ROCA : y < 0 ? VACIO : y >= filas ? ROCA : t[y * COLS + x]); N.pon = pon;
  for (let y = 0; y < filas; y++) { pon(0, y, ROCA); pon(COLS - 1, y, ROCA); }
  for (let x = 1; x < COLS - 1; x++) { pon(x, filas - 1, ROCA); pon(x, filas - 2, ROCA); if (x < 4 || x > 7) pon(x, 6, ROCA); }
  // la pared de bloques antes del jefe (wiki: una pared de rompibles) y repisas para respirar
  for (let x = 1; x < COLS - 1; x++) for (let y = 12; y < 14; y++) pon(x, y, BLOQUE);
  for (const [x0, y0] of [[1, 20], [8, 24], [1, 29], [8, 33]]) for (let i = 0; i < 3; i++) pon(x0 + i, y0, PLAT);
  N.inicio = { x: 2 * T, y: 6 * T - 1 };
  // la tienda asegurada, a la derecha de arriba
  pon(COLS - 1, 4, VACIO); pon(COLS - 1, 5, VACIO);
  N.puertas.push({ fila: 5, lado: 1, tipo: "tienda", x: COLS * T, y: 6 * T, usada: false });
  return N;
}

function pasoJuego(dt) {
  if (J.pausa) return;
  if (J.fase === "mejora" || J.fase === "fin") return;
  J.t += dt; J.cuadro++;
  const j = J.jug;
  if (j.muerto || J.ganado) { J.finT += dt; pasoEfectos(dt); if (J.finT > 1.8) terminarPartida(); return; }
  const r = pasoJugador(dt);
  if (r === "salida") { terminarNivel(); return; }
  if (J.sala) pasoSala(dt);
  pasoBichos(dt); pasoBalas(dt); pasoGemas(dt); pasoEfectos(dt); pasoJefe(dt);
  // el dron sigue al jugador flotando a un costado
  if (J.mejoras.dron) { const d = J.dron, ox = j.x + (j.izq ? 12 : -12), oy = j.y - 20 + Math.sin(J.t * 3) * 2; d.x = lerp(d.x || ox, ox, 0.15); d.y = lerp(d.y || oy, oy, 0.15); }
  if (J.flash > 0) J.flash -= dt;
  if (J.bannerGH > 0) J.bannerGH -= dt;
  if (J.ayudaT > 0) J.ayudaT -= dt;
  // la cámara: el que cae arriba de la mitad (se ve lo que viene), sin pasarse de los bordes
  if (J.sala) { J.camY = 0; return; }
  const obj = j.y - H * (j.vy > 60 ? 0.3 : 0.4), maxY = J.N.filas * T - H + (J.N.abismo || J.sala ? 0 : 40);
  J.camY = lerp(J.camY, lim(obj, -20, Math.max(-20, maxY)), 0.14);
}
function terminarNivel() {
  const j = J.jug;
  cobrarCombo();
  if (J.zona >= 4) return;
  // las mejoras: 3 al azar (+1 con el agua de vertiente, −1 con el estilo piedra)
  const E = ESTILOS[G.estilo] || ESTILOS.normal, n = 3 + J.extraOpciones + (E.opciones || 0);
  const pool = Object.keys(MEJORAS).filter((k) => !J.mejoras[k] || MEJORAS[k].repite);
  J.opciones = A.mezclar(pool).slice(0, n);
  J.fase = "mejora"; UI.foco = 0; UI.pantallaFoco = null;
  sfx("elegir");
}
function elegirMejora(k) {
  const j = J.jug;
  J.mejoras[k] = true;
  if (k === "manzana") { curar(4); J.mejoras.manzana = false; }
  if (k === "juventud") { j.vidaMax++; j.vida++; J.extraOpciones++; }
  if (k === "globo") j.globo = true;
  sfx("comprar");
  J.nivel++; if (J.nivel > 2) { J.nivel = 0; J.zona++; }
  J.fase = "juego";
  empezarNivel();
}
function terminarPartida() {
  if (J.fase === "fin") return;
  J.fase = "fin"; UI.pantallaFoco = null;
  const antes = G.totalGemas;
  G.totalGemas += J.gemasJuntadas;
  const prof = J.zona * 3 + J.nivel + 1;
  G.record.prof = Math.max(G.record.prof, J.ganado ? 13 : prof); G.record.gemas = Math.max(G.record.gemas, J.gemasJuntadas); G.record.combo = Math.max(G.record.combo, J.maxCombo);
  if (J.ganado) G.ganadas++;
  // lo que se destrabó con esta partida
  J.nuevos = [];
  for (const [k, p] of Object.entries(PALETAS)) if (p.precio > antes && p.precio <= G.totalGemas) J.nuevos.push(p.n);
  for (const [k, e] of Object.entries(ESTILOS)) if (e.precio > antes && e.precio <= G.totalGemas) J.nuevos.push(L(e.n));
  guardar();
  tocarTema(J.ganado ? "titulo" : "fin", { bucle: !!J.ganado });
}

// ── el dibujo ──
function dibujarJuego() {
  const j = J.jug, N = J.N;
  g.fillStyle = C_FONDO; g.fillRect(0, 0, W, H);
  const sx = J.temblor ? Math.round((V.f() - 0.5) * J.temblor) : 0, sy = J.temblor ? Math.round((V.f() - 0.5) * J.temblor) : 0;
  const cx = Math.round((COLS * T - W) / 2) - sx, cy = Math.round(J.camY) - sy;
  // motas del fondo lejano (se mueven a la mitad: dan profundidad sin ensuciar)
  g.fillStyle = C_TINTA; g.globalAlpha = 0.18;
  for (let i = 0; i < 26; i++) { const y = ((i * 97 - cy * 0.5) % (H + 20) + H + 20) % (H + 20) - 10, x = (i * 53) % W; g.fillRect(x, Math.round(y), 1, 1); }
  g.globalAlpha = 1;
  // la roca y los bloques visibles
  const f0 = Math.floor(cy / T) - 1, f1 = Math.floor((cy + H) / T) + 1;
  for (let fy = f0; fy <= f1; fy++) for (let fx = 0; fx < COLS; fx++) {
    const c = N.en(fx, fy); if (!c) continue;
    const X = fx * T - cx, Y = fy * T - cy;
    if (c === ROCA) {
      const vacio = (a, b) => { const k = N.en(fx + a, fy + b); return !(k === ROCA || rompible(k) || k === PINCHE); };
      const bordes = (vacio(0, -1) ? 1 : 0) | (vacio(1, 0) ? 2 : 0) | (vacio(0, 1) ? 4 : 0) | (vacio(-1, 0) ? 8 : 0);
      g.drawImage(rocaSpr(bordes, (fx * 7 + fy * 13) & 3), X, Y);
    } else if (c === BLOQUE) g.drawImage(bloqueSpr("n"), X, Y);
    else if (c === BGEMA) g.drawImage(bloqueSpr("gema"), X, Y);
    else if (c === PLAT) g.drawImage(plataformaSpr(), X, Y);
    else if (c === PINCHE) g.drawImage(pinchesSpr(), X, Y);
  }
  // las burbujas de las salas laterales (y el cartel de tienda)
  if (!J.sala) for (const p of N.puertas) {
    if (p.usada) continue;
    const X = (p.lado < 0 ? 10 : COLS * T - 10) - cx, Y = p.y - 16 - cy;
    if (Y < -30 || Y > H + 30) continue;
    g.strokeStyle = C_TINTA; g.lineWidth = 1; g.setLineDash([2, 2]); g.beginPath(); g.arc(X, Y, 18 + Math.sin(J.t * 3) * 1, 0, TAU); g.stroke(); g.setLineDash([]);
    if (p.tipo === "tienda") { const sx2 = lim(X, 18, W - 18); g.fillStyle = C_FONDO; g.fillRect(sx2 - 14, Y - 33, 28, 11); g.strokeStyle = C_TINTA; g.strokeRect(sx2 - 13.5, Y - 32.5, 27, 10); texto("SHOP", sx2, Y - 31); }
  }
  if (J.sala) dibujarSala(cy);
  // adornos, gemas
  for (const a of J.adornos) if (!a.roto) { const s = bichoSpr(a.tipo, 0, false); g.drawImage(s, Math.round(a.x - s.width / 2 - cx), Math.round(a.y - s.height - cy + (a.tipo === "farol" ? Math.sin(J.t * 2 + a.x) * 2 : 0))); }
  for (const gm of J.gemas) { if (gm.t < 2 && J.cuadro % 6 < 3) continue; const s = gemaSpr(gm.grande); g.drawImage(s, Math.round(gm.x - s.width / 2 - cx), Math.round(gm.y - s.height / 2 - cy)); }
  // bichos
  for (const b of J.bichos) {
    const Y = b.y - cy; if (Y < -30 || Y > H + 30) continue;
    const spr = b.enojado ? "calavera" : b.d.spr, s = bichoSpr(spr, Math.floor(b.t * 5), !b.izq);
    if (b.flash > 0) { g.globalAlpha = 0.5; }
    g.drawImage(s, Math.round(b.x - s.width / 2 - cx), Math.round(b.y - s.height - cy));
    g.globalAlpha = 1;
  }
  dibujarJefe(cy);
  // los tiros
  for (const q of J.balas) { g.fillStyle = q.rojo ? C_ACENTO : C_TINTA; g.fillRect(Math.round(q.x - q.w / 2 - cx), Math.round(q.y - q.h / 2 - cy), q.w, q.h); if (!q.rojo) { g.fillStyle = C_ACENTO; g.fillRect(Math.round(q.x - 0.5 - cx), Math.round(q.y - q.h / 2 - cy), 1, 2); } }
  // la mira láser
  if (J.mejoras.mira && !j.suelo && !J.sala) { g.fillStyle = C_ACENTO; for (let y = 4; y < FIS.alcance * 1.3; y += 4) g.fillRect(Math.round(j.x - cx), Math.round(j.y + y - cy), 1, 2); }
  // el que cae (parpadea mientras es invencible) y su globo y su dron
  if (!(j.inv > 0 && J.cuadro % 8 < 4) && !j.muerto) {
    const s = heroeSpr(j.pose, j.izq);
    g.drawImage(s, Math.round(j.x - s.width / 2 - cx), Math.round(j.y - s.height - cy));
  }
  if (j.globo) { const s = corazonSpr(); g.drawImage(s, Math.round(j.x - 3 - cx), Math.round(j.y - 26 - cy)); g.fillStyle = C_TINTA; g.fillRect(Math.round(j.x - cx), Math.round(j.y - 19 - cy), 1, 7); }
  if (J.mejoras.dron) { const s = iconoSpr("dron"); g.drawImage(s, Math.round(J.dron.x - 4 - cx), Math.round(J.dron.y - 4 - cy)); }
  // efectos
  for (const f of J.efectos) {
    const k = f.t / f.t0;
    if (f.tipo === "p") { g.fillStyle = f.color === "acento" ? C_ACENTO : C_TINTA; g.fillRect(Math.round(f.x - cx), Math.round(f.y - cy), k > 0.5 ? 2 : 1, k > 0.5 ? 2 : 1); }
    else if (f.tipo === "onda") { g.strokeStyle = C_ACENTO; g.lineWidth = 2; g.beginPath(); g.arc(f.x - cx, f.y - cy, f.r * (1.2 - k * 0.6), 0, TAU); g.stroke(); }
    else if (f.tipo === "laser") { g.fillStyle = C_TINTA; g.fillRect(Math.round(f.x - 2 - cx), Math.round(f.y0 - cy), 4, Math.round(f.y1 - f.y0)); g.fillStyle = C_ACENTO; g.fillRect(Math.round(f.x - cx), Math.round(f.y0 - cy), 1, Math.round(f.y1 - f.y0)); }
    else if (f.tipo === "combo") texto(String(f.n), f.x - cx, f.y - cy, { color: f.n >= 8 ? "acento" : "tinta", alfa: Math.min(1, k * 3) });
  }
  if (J.flash > 0) { g.fillStyle = C_ACENTO; g.globalAlpha = J.flash * 2; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  dibujarHUD();
}

function dibujarHUD() {
  const j = J.jug;
  // vida: barra roja con "x/y" (como el original en celular) y el desborde de 4 casillas abajo
  const hw = 72;
  g.fillStyle = C_FONDO; g.fillRect(2, 2, hw + 2, 17);
  g.fillStyle = C_TINTA; g.fillRect(3, 3, hw, 11); g.fillStyle = C_FONDO; g.fillRect(4, 4, hw - 2, 9);
  g.fillStyle = C_ACENTO; g.fillRect(5, 5, Math.round((hw - 4) * lim(j.vida / j.vidaMax, 0, 1)), 7);
  texto(`${Math.max(0, j.vida)}/${j.vidaMax}`, 3 + hw / 2, 5);
  g.fillStyle = C_TINTA; g.fillRect(3, 15, hw, 4); g.fillStyle = C_FONDO; g.fillRect(4, 16, hw - 2, 2);
  for (let i = 0; i < 4; i++) { if (i < j.desborde) { g.fillStyle = C_TINTA; g.fillRect(5 + i * ((hw - 4) / 4), 16, (hw - 4) / 4 - 2, 2); } g.fillStyle = C_ACENTO; if (i) g.fillRect(4 + i * ((hw - 4) / 4), 15, 1, 4); }
  // gemas: el número, el rombo grande y la línea del medidor del GEM HIGH
  texto(String(J.gemasPartida), W - 16, 5, { al: "der" });
  const gg = gemaSpr(true); g.drawImage(gg, W - 12, 4);
  g.fillStyle = C_ACENTO; const ml = Math.round(66 * j.medidor / 100); g.fillRect(W - 14 - ml, 15, ml, 2);
  // la pausa (arriba al centro)
  g.fillStyle = C_TINTA; g.fillRect(W / 2 + 1, 5, 2, 7); g.fillRect(W / 2 + 5, 5, 2, 7);
  // la carga: la píldora roja con el número y las pastillas (agrupadas según lo que gasta el arma)
  const yb = 22, costo = ARMAS[J.arma].costo;
  g.fillStyle = C_ACENTO; g.fillRect(3, yb, 24, 10); g.fillStyle = C_FONDO; g.fillRect(3, yb, 1, 1); g.fillRect(26, yb, 1, 1); g.fillRect(3, yb + 9, 1, 1); g.fillRect(26, yb + 9, 1, 1);
  texto(String(j.carga), 15, yb + 2);
  g.fillStyle = C_ACENTO; g.fillRect(29, yb, W - 32, 10); g.fillStyle = C_FONDO; g.fillRect(30, yb + 1, W - 34, 8);
  const n = j.cargaMax, grupos = Math.ceil(n / costo), hueco = 1, ancho = W - 36, pw = Math.max(1, Math.min(10, Math.floor((ancho - grupos * hueco) / n)));
  let x = 32;
  for (let i = 0; i < n; i++) { if (i && i % costo === 0) x += hueco + 1; g.fillStyle = i < j.carga ? C_TINTA : C_FONDO; g.fillRect(x, yb + 2, pw - 1, 6); if (i >= j.carga) { g.fillStyle = C_ACENTO; g.fillRect(x, yb + 7, pw - 1, 1); } x += pw; }
  // GEM HIGH: la franja con el nombre, arriba del pozo
  if (j.gemHigh) {
    const y = 36, parpadeo = J.bannerGH > 0 && J.cuadro % 8 < 4;
    if (!parpadeo) { g.fillStyle = C_TINTA; g.fillRect(8, y + 3, W - 16, 3); g.fillStyle = C_ACENTO; g.fillRect(8, y + 6, W - 16, 1); g.fillRect(6, y + 3, 2, 3); g.fillRect(W - 8, y + 3, 2, 3); g.fillStyle = C_FONDO; g.fillRect(W / 2 - 34, y, 68, 10); texto(L(J.mejoras.fiebre ? TX.gemFiebre : TX.gemHigh), W / 2, y + 1); }
  }
  // las mejoras que tenés, en fila abajo
  let ix = 3;
  for (const k of Object.keys(J.mejoras)) if (J.mejoras[k]) { g.drawImage(iconoSpr(MEJORAS[k].ico), ix, H - 12); ix += 11; }
  // el nombre del nivel y los carteles
  if (J.cartel) {
    const k = J.cartel.t / J.cartel.t0, a = Math.min(1, J.cartel.t * 3);
    texto(J.cartel.txt, W / 2, Math.round(H * 0.28), { escala: J.cartel.sub ? 1 : 2, alfa: a });
    if (J.cartel.sub) parrafo(J.cartel.sub, W / 2, Math.round(H * 0.28) + 13, W - 20, { alfa: a });
  }
  // la ayuda de los controles (los primeros segundos)
  if (J.ayudaT > 0 && J.zona === 0 && J.nivel === 0 && !J.sala) {
    const a = Math.min(1, J.ayudaT);
    if (IN.tactil) {
      g.globalAlpha = 0.25 * a; g.fillStyle = C_TINTA; g.fillRect(0, H - 70, W / 4 - 1, 70); g.fillRect(W / 4 + 1, H - 70, W / 4 - 2, 70); g.fillRect(W / 2 + 1, H - 70, W / 2 - 1, 70); g.globalAlpha = 1;
      texto("<", W / 8, H - 40, { escala: 2, alfa: a }); texto(">", W * 3 / 8, H - 40, { escala: 2, alfa: a }); texto(IDIOMA === "es" ? "SALTO" : "JUMP", W * 3 / 4, H - 44, { alfa: a }); texto(IDIOMA === "es" ? "DISPARO" : "SHOOT", W * 3 / 4, H - 32, { alfa: a });
    } else parrafo(TX.ayudaPC, W / 2, H - 46, W - 16, { alfa: a });
    parrafo(TX.stompa, W / 2, H - 92, W - 16, { alfa: a, color: "acento" });
  }
}
