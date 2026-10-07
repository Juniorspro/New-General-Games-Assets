/* ============================================================================
   El dibujo de la partida: la sala, los bichos ordenados por altura, la
   oscuridad con las luces en anillos de píxeles, las balas por encima (que
   siempre se vean), el HUD y los mandos de dedo.
   ========================================================================== */

let lienzoLuz = null, gl = null;
function prepararLuz() { lienzoLuz = hacerLienzo(W, H); gl = lienzoLuz.getContext('2d'); }

const MIRAN_IZQ = { vibora: true, lobito: true };

function dibujarPartida(g, t) {
  const B = BIOMAS[bioma()], j = J.jug;
  let sx = 0, sy = 0;
  if (J.sacudir > 0.2) { sx = Math.round(azar(-1, 1) * J.sacudir); sy = Math.round(azar(-1, 1) * J.sacudir); }
  const oy = SY + sy;
  g.save(); g.translate(sx, 0);
  g.drawImage(J.fondo, 0, oy);
  dibujarSalaViva(g, J.mapa, bioma(), t, J.limpia, oy);
  // zonas de fuego avisadas
  for (const z of J.zonas) {
    if (z.t < z.aviso) { if (Math.floor(z.t * 10) % 2 === 0) { g.globalAlpha = 0.25 + z.t / z.aviso * 0.5; circulo(g, z.x, oy + z.y, z.r, '#ff3a2a'); g.globalAlpha = 1; } }
    else { circulo(g, z.x, oy + z.y, z.r, '#ffb040'); circulo(g, z.x, oy + z.y, z.r - 3, '#fff0a0'); }
  }
  // el fogón
  if (J.tipo === 'fogon') dibujarFogon(g, oy, t);
  // los que se ordenan por altura
  const cosas = [];
  for (const e of J.enem) cosas.push({ y: e.y + e.d.pie, f: () => dibujarEnemigo(g, e, oy, t) });
  if (!J.muerto || Math.floor(t * 8) % 2) cosas.push({ y: j.y + 6, f: () => dibujarJugador(g, j, oy, t) });
  cosas.sort((a, b) => a.y - b.y);
  for (const it of J.items) dibujarItem(g, it, oy, t);
  for (const c of cosas) c.f();
  for (const cp of j.compas) dibujarSpr(g, 'anima', Math.floor(t * 4), cp.x, oy + cp.y + 6, { alfa: 0.85 });
  // la oscuridad
  dibujarLuces(g, oy, t, B);
  // por encima de la oscuridad: balas, chispas, números
  for (const o of j.orbes || []) { g.drawImage(brillo(8, 'rgba(255,200,80,0.7)'), Math.round(o.x - 8), Math.round(oy + o.y - 8)); circulo(g, o.x, oy + o.y, 2, '#ffe080'); g.fillStyle = '#fff'; g.fillRect(Math.round(o.x), Math.round(oy + o.y), 1, 1); }
  for (const b of J.balas) {
    const col = b.tipo === 'compa' ? '#7ad0ff' : '#fff0a0';
    g.globalAlpha = 0.45; circulo(g, b.x - b.vx * 0.012, oy + b.y - b.vy * 0.012, 1, col); g.globalAlpha = 1;
    circulo(g, b.x, oy + b.y, 2, col); g.fillStyle = '#fff'; g.fillRect(Math.round(b.x), Math.round(oy + b.y), 1, 1);
  }
  for (const b of J.balasE) {
    circulo(g, b.x, oy + b.y, b.r + 1, b.borde); circulo(g, b.x, oy + b.y, b.r, b.col);
    g.fillStyle = '#fff'; g.fillRect(Math.round(b.x - 1), Math.round(oy + b.y - 1), 1, 1);
  }
  for (const p of J.part) { g.globalAlpha = Math.min(1, p.t / p.vida * 1.5); g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(oy + p.y), p.tam, p.tam); }
  g.globalAlpha = 1;
  for (const r of J.rayos) dibujarRayo(g, r.a.x, oy + r.a.y, r.b.x, oy + r.b.y);
  for (const o of J.ondas) {
    g.strokeStyle = o.col; g.globalAlpha = 1 - o.t / 0.5; g.lineWidth = 2;
    g.beginPath(); g.arc(Math.round(o.x), Math.round(oy + o.y - 3), Math.max(1, o.r), 0, Math.PI * 2); g.stroke();
    g.globalAlpha = 1;
  }
  for (const n of J.numeros) { g.globalAlpha = Math.min(1, n.t * 3); numeroChico(g, n.txt, n.x, oy + n.y, n.col); }
  g.globalAlpha = 1;
  // la mira sobre el objetivo
  if (!j.mov && !J.muerto) { const ob = objetivo(); if (ob) mira(g, ob.x, oy + ob.y - 2, ob.r + 3, t); }
  g.restore();
  if (J.jefe && !J.jefe.muerto && J.jefe.aparece <= 0) barraJefe(g, J.jefe);
  if (J.destello > 0) { g.fillStyle = 'rgba(255,240,220,' + Math.min(0.5, J.destello) + ')'; g.fillRect(0, SY, W, SALA_H); }
  // la vida baja: el borde late en rojo
  if (j.vida < j.vidaMax * 0.25 && !J.muerto) {
    g.fillStyle = 'rgba(200,20,40,' + (0.15 + Math.sin(t * 6) * 0.1) + ')';
    g.fillRect(0, SY, W, 3); g.fillRect(0, SY + SALA_H - 3, W, 3); g.fillRect(0, SY, 3, SALA_H); g.fillRect(W - 3, SY, 3, SALA_H);
  }
}
function mira(g, x, y, r, t) {
  r = Math.round(r + Math.sin(t * 8)); x = Math.round(x); y = Math.round(y);
  g.fillStyle = '#ffcf4a';
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.fillRect(x + dx * r - (dx > 0 ? 2 : 0), y + dy * r, 3, 1); g.fillRect(x + dx * r, y + dy * r - (dy > 0 ? 2 : 0), 1, 3); }
}
function dibujarRayo(g, x1, y1, x2, y2) {
  const n = 6;
  g.fillStyle = '#c8f0ff';
  let px = x1, py = y1;
  for (let i = 1; i <= n; i++) {
    const x = i === n ? x2 : lerp(x1, x2, i / n) + azar(-3, 3), y = i === n ? y2 : lerp(y1, y2, i / n) + azar(-3, 3);
    const d = Math.max(1, Math.round(Math.hypot(x - px, y - py)));
    for (let k = 0; k < d; k++) g.fillRect(Math.round(lerp(px, x, k / d)), Math.round(lerp(py, y, k / d)), 1, 1);
    px = x; py = y;
  }
}
function dibujarJugador(g, j, oy, t) {
  sombra(g, j.x, oy + j.y + 6, 9);
  if (j.invul > 0 && j.flash <= 0 && Math.floor(t * 20) % 2) return;
  const fr = j.mov ? 1 + (Math.floor(j.anim) % 2) : 0;
  const bob = j.mov ? 0 : Math.round(Math.sin(t * 3) * 0.5);
  dibujarSpr(g, 'jug', fr, j.x, oy + j.y + 7 + bob, { voltear: j.cara < 0, blanco: j.flash > 0.6 });
  const fx = j.x + j.cara * 6 + (j.tiroAnim > 0 ? Math.cos(j.apunta) * 2 : 0), fy = oy + j.y + 4 + Math.round(Math.sin(t * 4 + 1));
  dibujarSpr(g, 'farol', 0, fx, fy, {});
}
function dibujarEnemigo(g, e, oy, t) {
  const pie = oy + e.y + e.d.pie;
  if (e.aparece > 0) {
    const tot = e.d.jefe ? 1.4 : 0.6, p = clamp(1 - e.aparece / tot, 0, 1);
    const r = Math.round((1 - p) * 14 + 4);
    g.fillStyle = '#b05aff';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * 4; g.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(oy + e.y + 3 + Math.sin(a) * r * 0.5), 1, 1); }
    if (p > 0.4) dibujarSpr(g, e.tipo, 0, e.x, pie, { blanco: true, alfa: (p - 0.4) / 0.6 });
    return;
  }
  // avisos
  if ((e.tipo === 'vibora' || e.tipo === 'lobito' || e.tipo === 'lobizon') && e.est === 'mira' && Math.floor(t * 16) % 2 === 0) {
    g.fillStyle = 'rgba(255,60,60,0.7)';
    for (let d = 8; d < (e.d.jefe ? 160 : 70); d += 4) g.fillRect(Math.round(e.x + Math.cos(e.ang) * d), Math.round(oy + e.y + Math.sin(e.ang) * d), 1, 1);
  }
  if (e.tipo === 'sapoRey' && (e.est === 'sube' || e.est === 'cae') && e.dest) {
    const p = e.est === 'cae' ? 1 - e.t / 0.6 : 0.2;
    sombra(g, e.dest.x, oy + e.dest.y + 8, 10 + p * 16);
    if (Math.floor(t * 12) % 2) { g.strokeStyle = 'rgba(255,60,60,0.8)'; g.lineWidth = 1; g.beginPath(); g.arc(Math.round(e.dest.x), Math.round(oy + e.dest.y + 6), 16, 0, Math.PI * 2); g.stroke(); }
  } else if (e.alfa > 0.3) sombra(g, e.x, pie - 1, e.r * 2 + 2);
  const fr = Math.floor(e.anim * (e.tipo === 'murcielago' ? 10 : 4));
  let escX = 1, escY = 1;
  if (e.tipo === 'sapo' && e.est === 'quieto') { escX = 1.15; escY = 0.85; }
  if (e.tipo === 'hongo' && e.est === 'infla') { escX = 1 + Math.sin((0.4 - e.t) * 20) * 0.12; escY = 2 - escX; }
  if (e.d.jefe && e.est === 'aulla') { escX = 1.08; escY = 1.08; }
  const volt = MIRAN_IZQ[e.tipo] ? e.cara > 0 : false;
  const frame = (e.tipo === 'sapoRey') ? (e.est === 'escupe' ? 1 : 0) : (e.tipo === 'sapo') ? (e.est === 'salta' ? 1 : 0) : fr;
  dibujarSpr(g, e.tipo, frame, e.x, pie - (e.alto || 0), { voltear: volt, blanco: e.flash > 0, alfa: e.alfa < 1 ? e.alfa : null, escX, escY });
  if (e.congelado > 0) { g.globalAlpha = 0.5; dibujarSpr(g, e.tipo, frame, e.x, pie, { blanco: true, voltear: volt }); g.globalAlpha = 1; g.fillStyle = '#9ae0ff'; g.fillRect(Math.round(e.x - e.r), Math.round(pie - 2), e.r * 2, 1); }
  // vida de los comunes, chiquita
  if (!e.d.jefe && e.vida < e.vidaMax) {
    const w = 10, x = Math.round(e.x - w / 2), y = Math.round(pie - SPR[e.tipo][0].h - 4);
    g.fillStyle = K; g.fillRect(x - 1, y - 1, w + 2, 3);
    g.fillStyle = '#ff4a5a'; g.fillRect(x, y, Math.max(1, Math.round(w * e.vida / e.vidaMax)), 1);
  }
}
function dibujarItem(g, it, oy, t) {
  const y = oy + it.y - it.alto;
  sombra(g, it.x, oy + it.y + 3, 5);
  if (it.tipo === 'xp') dibujarSpr(g, 'xp', Math.floor(t * 6 + it.x) % 2, it.x, y + 3);
  else if (it.tipo === 'alma') { g.drawImage(brillo(6, 'rgba(90,170,255,0.6)'), Math.round(it.x - 6), Math.round(y - 8)); dibujarSpr(g, 'alma', Math.floor(t * 6 + it.y) % 2, it.x, y + 3 + Math.round(Math.sin(t * 5 + it.x) * 1)); }
  else dibujarSpr(g, 'corazon', 0, it.x, y + 3 + Math.round(Math.sin(t * 5) * 1));
}
function dibujarFogon(g, oy, t) {
  const f = J.fogon, x = f.x, y = oy + f.y;
  sombra(g, x, y + 4, 16);
  g.fillStyle = '#4a3020'; g.fillRect(x - 7, y + 1, 14, 2); g.fillRect(x - 5, y - 1, 10, 2);
  for (let i = 0; i < 3; i++) {
    const h = 6 + Math.round(Math.sin(t * 9 + i * 2) * 2), cx = x - 3 + i * 3;
    g.fillStyle = '#f05a28'; g.fillRect(cx - 1, y - h, 3, h);
    g.fillStyle = '#ffb040'; g.fillRect(cx, y - h + 2, 1, h - 2);
  }
  if (Math.random() < 0.3) chispa(x + azar(-4, 4), f.y - 6, azar(-5, 5), -azar(15, 35), '#ffb040', 0.7);
  sombra(g, x + 22, y + 7, 10);
  dibujarSpr(g, 'pombero', Math.floor(t * 1.5) % 2, x + 22, y + 8, { voltear: false });
}
function dibujarLuces(g, oy, t, B) {
  const j = J.jug, L = gl;
  L.globalCompositeOperation = 'source-over';
  L.clearRect(0, 0, W, H);
  L.fillStyle = 'rgba(6,3,12,' + B.oscuro + ')';
  L.fillRect(0, oy, W, SALA_H);
  L.globalCompositeOperation = 'destination-out';
  const luz = (x, y, r) => { const s = sello(r); L.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2)); };
  luz(j.x, oy + j.y - 2, 96 + Math.sin(t * 7) * 2);
  luz(3 * T + 6, oy + T + 4, 44 + Math.sin(t * 9) * 2); luz(11 * T + 6, oy + T + 4, 44 + Math.cos(t * 8) * 2);
  if (J.limpia) luz(90, oy + T + 6, 40);
  if (J.tipo === 'fogon') luz(J.fogon.x, oy + J.fogon.y - 3, 80 + Math.sin(t * 10) * 3);
  for (const b of J.balas) luz(b.x, oy + b.y, 12);
  for (const b of J.balasE) luz(b.x, oy + b.y, 8);
  for (const z of J.zonas) luz(z.x, oy + z.y, z.t > z.aviso ? 40 : 18);
  for (const cp of j.compas) luz(cp.x, oy + cp.y, 20);
  for (const e of J.enem) if (e.tipo === 'brasa' || e.tipo === 'brasita' || e.d.jefe) luz(e.x, oy + e.y, e.d.jefe ? 50 : 22);
  if (B.pozo === 'lava') for (let f = 2; f < FILAS - 1; f++) for (let k = 1; k < COLS - 1; k++) if (J.mapa[idx(k, f)] === POZO) luz(k * T + 6, oy + f * T + 6, 16);
  L.globalCompositeOperation = 'source-over';
  g.drawImage(lienzoLuz, 0, 0);
  // brillos de color, sumados
  g.globalCompositeOperation = 'lighter';
  g.drawImage(brillo(26, 'rgba(255,190,90,0.22)'), Math.round(j.x + j.cara * 6 - 26), Math.round(oy + j.y - 26));
  for (const ax of [3 * T + 6, 11 * T + 6]) g.drawImage(brillo(18, hexA(B.antorcha, 0.3)), ax - 18, oy + T + 4 - 18);
  if (J.tipo === 'fogon') g.drawImage(brillo(30, 'rgba(255,140,40,0.3)'), J.fogon.x - 30, oy + J.fogon.y - 33);
  g.globalCompositeOperation = 'source-over';
}
const hexA = (h, a) => 'rgba(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16) + ',' + a + ')';

function barraJefe(g, e) {
  const nombre = tr('jefes')[JEFES.indexOf(e.tipo)], x = anchoTexto(nombre) + 10, w = W - x - 6, y = SY + 4;
  textoPx(g, nombre, 4, y - 1, { grad: GRAD.rojo });
  g.fillStyle = K; g.fillRect(x - 1, y - 1, w + 2, 6);
  g.fillStyle = '#3a1020'; g.fillRect(x, y, w, 4);
  const p = Math.max(0, e.vida / e.vidaMax);
  g.fillStyle = '#e8404a'; g.fillRect(x, y, Math.round(w * p), 4);
  g.fillStyle = '#ff9a8a'; g.fillRect(x, y, Math.round(w * p), 1);
  for (const m of [0.33, 0.66]) { g.fillStyle = K; g.fillRect(Math.round(x + w * m), y, 1, 4); }
}

/* --------------------------------------------------------------- el HUD */
function dibujarHUD(g, t) {
  const j = J.jug;
  g.fillStyle = '#100818'; g.fillRect(0, 0, W, SY);
  g.fillStyle = '#3a2410'; g.fillRect(0, SY - 2, W, 1);
  g.fillStyle = '#c8902a'; g.fillRect(0, SY - 1, W, 1);
  // vida
  const vy = SY - HUD_H;
  dibujarSpr(g, 'corazon', 0, 7, vy + 11);
  const bw = 58, p = clamp(j.vida / j.vidaMax, 0, 1);
  g.fillStyle = K; g.fillRect(13, vy + 4, bw + 2, 8);
  g.fillStyle = '#3a1020'; g.fillRect(14, vy + 5, bw, 6);
  g.fillStyle = p < 0.25 ? (Math.floor(t * 6) % 2 ? '#ff4a5a' : '#c8202a') : '#e8404a'; g.fillRect(14, vy + 5, Math.round(bw * p), 6);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(14, vy + 5, Math.round(bw * p), 1);
  numeroChico(g, String(Math.ceil(j.vida)), 14 + bw / 2, vy + 7, '#ffffff');
  // piso y sala
  textoPx(g, J.piso + '-' + J.sala, W / 2 + 6, vy + 5, { alin: 'centro', grad: GRAD.ocre });
  // almas
  dibujarSpr(g, 'alma', Math.floor(t * 4) % 2, W - 46, vy + 13);
  textoPx(g, String(J.almas), W - 40, vy + 5, { grad: GRAD.celeste });
  // pausa
  g.fillStyle = K; g.fillRect(W - 15, vy + 3, 12, 11);
  g.fillStyle = '#c8902a'; g.fillRect(W - 14, vy + 4, 10, 9);
  g.fillStyle = '#2a1408'; g.fillRect(W - 12, vy + 6, 2, 5); g.fillRect(W - 8, vy + 6, 2, 5);
  // experiencia
  textoPx(g, tr('nv') + j.nivel, 3, vy + 16, { grad: GRAD.oro, sinSombra: true });
  const xw = W - 34, xp = clamp(j.xp / xpSig(j.nivel), 0, 1);
  g.fillStyle = K; g.fillRect(29, vy + 18, xw + 2, 5);
  g.fillStyle = '#24123a'; g.fillRect(30, vy + 19, xw, 3);
  g.fillStyle = '#a86cff'; g.fillRect(30, vy + 19, Math.round(xw * xp), 3);
  g.fillStyle = '#e0c8ff'; g.fillRect(30, vy + 19, Math.round(xw * xp), 1);
  // abajo: las cartas que tenés
  const y0 = SY + SALA_H + 3;
  g.fillStyle = '#100818'; g.fillRect(0, SY + SALA_H, W, H - SY - SALA_H);
  const ids = Object.keys(j.cartas);
  if (H - y0 > 10) {
    let x = 4;
    for (const id of ids) { if (x > W - 12) break; g.drawImage(icono(id, CARTAS[id].palo), x, y0); if (j.cartas[id] > 1) numeroChico(g, String(j.cartas[id]), x + 9, y0 + 8, '#ffffff'); x += 12; }
  }
}
function dibujarMandos(g, t) {
  const j = J.jug;
  // la palanca
  const P = Entrada.pal, r = radioPal();
  if (P.activa || (CTRL.tipo === 'fija' && !Entrada.usoTeclado)) {
    const bx = P.activa ? P.bx : posPalanca().x, by = P.activa ? P.by : posPalanca().y;
    g.globalAlpha = CTRL.opac * (P.activa ? 1 : 0.6);
    g.strokeStyle = '#e8d8b0'; g.lineWidth = 1;
    g.beginPath(); g.arc(Math.round(bx) + 0.5, Math.round(by) + 0.5, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(20,10,30,0.35)'; g.beginPath(); g.arc(Math.round(bx), Math.round(by), r - 1, 0, Math.PI * 2); g.fill();
    const kx = P.activa ? P.x : bx, ky = P.activa ? P.y : by;
    circulo(g, kx, ky, Math.round(r * 0.42), '#c8902a'); circulo(g, kx, ky - 1, Math.round(r * 0.42) - 2, '#ffcf4a');
    g.globalAlpha = 1;
  }
  // la copla
  if (!Entrada.usoTeclado || j.copla >= 100) dibujarBotonCopla(g, posBoton(), radioBtn(), j.copla, t, CTRL.opac);
}
function dibujarBotonCopla(g, p, r, carga, t, opac) {
  const lleno = carga >= 100;
  g.globalAlpha = lleno ? 1 : Math.max(0.35, opac);
  if (lleno) g.drawImage(brillo(r + 8, 'rgba(255,200,80,0.5)'), Math.round(p.x - r - 8), Math.round(p.y - r - 8));
  circulo(g, p.x, p.y, r, K);
  circulo(g, p.x, p.y, r - 1, lleno ? '#5a2a10' : '#24142e');
  // el anillo de carga
  g.strokeStyle = lleno ? '#ffe080' : '#c8902a'; g.lineWidth = 2;
  g.beginPath(); g.arc(Math.round(p.x), Math.round(p.y), r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, carga / 100)); g.stroke();
  const ic = icono('copla', 'oros');
  const e = r >= 14 ? 2 : 1;
  g.drawImage(ic, Math.round(p.x - 4.5 * e), Math.round(p.y - 4.5 * e + (lleno ? Math.sin(t * 8) : 0)), 9 * e, 9 * e);
  g.globalAlpha = 1;
}
