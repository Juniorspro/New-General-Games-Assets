// ─────────────────────────────────────────────────────────────────────────────
// EL CICLO DE LA PARTIDA: un paso fijo de 1/60 s (mover, armas, enemigos, oleadas, recoger) y el
// dibujo del mundo ordenado por la altura de los pies, así el que está más abajo tapa al de arriba.
// ─────────────────────────────────────────────────────────────────────────────

function pasoJuego(dt) {
  if (J.fin) { J.finT += dt; pasoEfectos(dt); if (J.finT > 3.2) terminarPartida(); return; }
  if (J.modal) { pasoModal(dt); return; }
  if (J.pausa) return;
  const j = J.jug, st = J.st;
  J.t += dt; J.cuadro++;
  if (J.t < 61 && J.cuadro % 30 === 0) recalcular();     // lo temporal del personaje se va apagando
  // moverse: es lo único que manejás
  const m = leerMovimiento(), v = VEL_JUG * st.velMov * J.E.velJug;
  j.moviendo = Math.hypot(m.x, m.y) > 0.1;
  if (j.moviendo) {
    j.x += m.x * v * dt; j.y += m.y * v * dt; j.paso += dt * 9;
    const n = Math.hypot(m.x, m.y); j.mirX = m.x / n; j.mirY = m.y / n;
    if (Math.abs(m.x) > 0.2) j.izq = m.x < 0;
  }
  if (j.inv > 0) j.inv -= dt;
  if (j.golpe > 0) j.golpe -= dt;
  if (st.recup > 0 && j.vida < st.vidaMax) { j.vida = Math.min(st.vidaMax, j.vida + st.recup * dt); J.sanado += st.recup * dt; }
  if (J.congelado > 0) J.congelado -= dt;
  if (J.destello > 0) J.destello -= dt;
  if (J.cartel) J.cartel.t -= dt;
  pasoOleadas(dt);
  pasoEnemigos(dt);
  pasoArmas(dt);
  pasoRecoger(dt);
  pasoEfectos(dt);
  // la cámara: el cazador un poco más abajo del centro (arriba está el HUD)
  J.cam.x = j.x - W / 2; J.cam.y = j.y - H * 0.52;
  if (J.pendientes > 0 && !J.modal && !J.fin) abrirModalNivel();
}

function dibujarJuego() {
  const cx = Math.round(J.cam.x), cy = Math.round(J.cam.y), j = J.jug;
  g.fillStyle = SUELOS[J.E.suelo].fondo; g.fillRect(0, 0, W, H);
  const adornos = dibujarSuelo(J.E.suelo, cx, cy);
  // lo que está en el piso: charcos, aura del ajo, gemas, cosas
  for (const z of J.zonas) {
    const X = Math.round(z.x - cx), Y = Math.round(z.y - cy), k = Math.min(1, z.t / 0.4), rojo = z.a && z.a.k === "marea";
    g.globalAlpha = 0.35 * k; g.fillStyle = rojo ? "#ff4050" : "#60a8ff"; g.beginPath(); g.ellipse(X, Y, z.r, z.r * 0.7, 0, 0, TAU); g.fill();
    g.globalAlpha = 0.9 * k; g.fillStyle = rojo ? "#ffb0b8" : "#d8f0ff";
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + J.t * 2, rr = z.r * (0.3 + 0.6 * ((i * 37) % 10) / 10), fx = X + Math.cos(a) * rr, fy = Y + Math.sin(a) * rr * 0.7, fh = 2 + ((J.cuadro >> 2) + i) % 3; g.fillRect(Math.round(fx), Math.round(fy - fh), 2, fh); }
    g.globalAlpha = 1;
  }
  for (const a of J.armas) if (a.radio) {
    const X = j.x - cx, Y = j.y - 4 - cy, dev = a.k === "devora", pul = 1 + Math.sin(J.t * 6) * 0.03;
    g.globalAlpha = 0.14; g.fillStyle = dev ? "#b070ff" : "#fff4e0"; g.beginPath(); g.arc(X, Y, a.radio * pul, 0, TAU); g.fill();
    g.globalAlpha = 0.35; g.strokeStyle = dev ? "#d0a0ff" : "#ffffff"; g.lineWidth = 1; g.beginPath(); g.arc(X, Y, a.radio * pul, 0, TAU); g.stroke(); g.globalAlpha = 1;
  }
  for (const gm of J.gemas) { const s = gemaSpr(gm.tipo); if (gm.x - cx > -8 && gm.x - cx < W + 8 && gm.y - cy > -8 && gm.y - cy < H + 8) g.drawImage(s, Math.round(gm.x - cx - s.width / 2), Math.round(gm.y - cy - s.height / 2)); }
  for (const c of J.cosas) {
    const s = c.tipo === "cofre" ? cofreSpr(false) : recogibleSpr(c.tipo), bob = Math.round(Math.sin(J.t * 4 + c.x) * 1.5);
    if (c.tipo === "cofre") { g.globalAlpha = 0.3 + 0.2 * Math.sin(J.t * 5); g.fillStyle = "#ffe070"; g.beginPath(); g.arc(c.x - cx, c.y - cy - 4, 14, 0, TAU); g.fill(); g.globalAlpha = 1; }
    g.drawImage(s, Math.round(c.x - cx - s.width / 2), Math.round(c.y - cy - s.height / 2 + bob));
  }
  // los que tienen pies: adornos, enemigos y el cazador, ordenados por y
  const cosas = adornos.map((a) => ({ y: a.pie, a }));
  for (const e of J.enemigos) if (enPantalla(e.x, e.y, 40)) cosas.push({ y: e.y, e });
  cosas.push({ y: j.y, jug: 1 });
  cosas.sort((p, q) => p.y - q.y);
  const frio = J.congelado > 0;
  for (const o of cosas) {
    if (o.a) { g.drawImage(o.a.spr, Math.round(o.a.x - cx), Math.round(o.a.y - cy)); continue; }
    if (o.jug) { dibujarCazador(cx, cy); continue; }
    const e = o.e;
    let s = e.d.brasero ? braseroSpr(Math.floor(e.cuadro) % 3) : enemigoSpr(e.d.spr, Math.floor(e.cuadro) % 2, e.izq, e.d.tinte);
    if (e.flash > 0) s = blanco(s); else if (frio && !e.d.parca) s = azulado(s);
    const esc = Math.max(1, Math.round(e.d.esc || 1)), w = s.width * esc, h = s.height * esc;
    const X = Math.round(e.x - cx - w / 2), Y = Math.round(e.y - cy - h + 2 - (e.d.vuela ? 5 : 0));
    if (!e.d.vuela || esc > 1) g.drawImage(sombra(Math.max(3, Math.round(w / 3)), Math.max(1, Math.round(w / 9))), Math.round(e.x - cx - w / 3), Math.round(e.y - cy - 1));
    g.drawImage(s, X, Y, w, h);
  }
  // proyectiles y libros, por encima
  for (const q of J.proys) {
    const X = q.x - cx, Y = q.y - cy;
    if (q.tipo === "tajo") {
      const s = latigoSpr(Math.round(q.largo), Math.round(q.alto), q.rojo), k = q.vida / q.vidaMax;
      g.globalAlpha = Math.min(1, k * 2.2); g.save(); g.translate(Math.round(X), Math.round(Y)); if (q.dx < 0) g.scale(-1, 1);
      g.drawImage(s, -Math.round(q.largo / 2), -Math.round(q.alto / 2)); g.restore(); g.globalAlpha = 1; continue;
    }
    const s = proySpr(q.spr), esc = q.esc && q.esc > 1.4 ? Math.round(q.esc) : 1;
    if (q.rot) { g.save(); g.translate(Math.round(X), Math.round(Y)); g.rotate(q.rot); g.drawImage(s, -s.width * esc / 2, -s.height * esc / 2, s.width * esc, s.height * esc); g.restore(); }
    else g.drawImage(s, Math.round(X - s.width * esc / 2), Math.round(Y - s.height * esc / 2), s.width * esc, s.height * esc);
  }
  for (const a of J.armas) if (a.libros && a.libros.pos) { const s = proySpr(a.k === "visperas" ? "visperas" : "libro"); for (const [x, y] of a.libros.pos) g.drawImage(s, Math.round(x - cx - s.width / 2), Math.round(y - cy - s.height / 2)); }
  dibujarEfectos(cx, cy);
  vineta(J.E.suelo === "tumbas" ? 0.7 : 0.45);
  if (frio) { g.fillStyle = "rgba(80,150,255,0.14)"; g.fillRect(0, 0, W, H); }
  if (J.destello > 0 && G.op.destellos) { g.fillStyle = `rgba(255,255,255,${Math.min(0.6, J.destello)})`; g.fillRect(0, 0, W, H); }
  if (j.golpe > 0) { g.fillStyle = `rgba(200,0,0,${j.golpe * 0.6})`; g.fillRect(0, 0, W, H); }
}
/** La pasada de interfaz (a la resolución de la pantalla): números de daño, HUD, carteles y ventanas. */
function dibujarUIJuego() {
  const cx = Math.round(J.cam.x), cy = Math.round(J.cam.y);
  if (G.op.numeros) dibujarNumeros(cx, cy);
  dibujarHUD();
  if (!J.modal && !J.pausa) dibujarPalo();
  if (J.fin) {
    const a = Math.min(1, J.finT / 1.2);
    g.fillStyle = `rgba(20,0,0,${a * 0.75})`; g.fillRect(0, 0, W, H);
    texto(L(J.ganaste ? TX.sobreviviste : TX.moriste), W / 2, H * 0.42, { escala: 2, grad: J.ganaste ? "oro" : "rojo", alfa: a });
  }
  if (J.pausa) dibujarPausa();
  else if (J.modal && J.modal.tipo === "nivel") dibujarModalNivel();
  else if (J.modal && J.modal.tipo === "cofre") dibujarModalCofre();
}
function dibujarCazador(cx, cy) {
  const j = J.jug, s = cazadorSpr(J.pj, j.moviendo ? 1 + Math.floor(j.paso) % 4 : 0, j.izq);
  const X = Math.round(j.x - cx - s.width / 2), Y = Math.round(j.y - cy - s.height + 2);
  g.drawImage(sombra(5, 2), Math.round(j.x - cx - 5), Math.round(j.y - cy - 1));
  // parpadeo mientras es invulnerable (después de un golpe)
  if (!(j.inv > 0 && J.cuadro % 6 < 3 && j.golpe > -1)) g.drawImage(j.golpe > 0.1 ? rojizo(s) : s, X, Y);
  // la barrita de vida
  const bw = 16, k = lim(j.vida / J.st.vidaMax, 0, 1), bx = Math.round(j.x - cx - bw / 2), by = Math.round(j.y - cy + 3);
  g.fillStyle = "#000"; g.fillRect(bx - 1, by - 1, bw + 2, 4); g.fillStyle = "#3a0a0a"; g.fillRect(bx, by, bw, 2); g.fillStyle = "#ff2828"; g.fillRect(bx, by, Math.round(bw * k), 2);
}

/** Fin de la partida: el oro va a la bolsa, se guardan récords y desbloqueos, y a los resultados. */
function terminarPartida() {
  if (J.terminada) return;           // una sola vez: si no, el oro se suma en cada cuadro
  J.terminada = true;
  const oro = J.oro;
  G.oro += oro; G.partidas++; G.kills += J.kills;
  const rk = `${J.esc}|${J.pj}`, r = G.record[rk] || { t: 0, kills: 0, nivel: 0 };
  G.record[rk] = { t: Math.max(r.t, J.t), kills: Math.max(r.kills, J.kills), nivel: Math.max(r.nivel, J.nivel) };
  const mejorT = Math.max(G.record[`bosque|t`] || 0, J.esc === "bosque" ? J.t * 1800 / J.duracion : 0);
  G.record["bosque|t"] = mejorT;
  RES = { pj: J.pj, esc: J.esc, t: J.t, oro, nivel: J.nivel, kills: J.kills, ganaste: J.ganaste, armas: J.armas.map((a) => ({ k: a.k, nivel: a.nivel, dano: a.dano, tiempo: J.t - a.desde })), pasivos: J.pasivos.slice(), abre: mejorT >= 900 && !G.vistos.cementerio };
  if (RES.abre) G.vistos.cementerio = 1;
  guardar();
  PANT = "resultados"; UI.pantallaFoco = null;
  tocarTema("titulo");
}
