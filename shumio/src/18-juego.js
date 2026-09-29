// ─────────────────────────────────────────────────────────────────────────────
// EL JUEGO: la partida (semilla, pisos, salas), el paso fijo de 60 Hz, las puertas (se cierran
// al entrar con enemigos, se abren al limpiar, con llave, secretas), el deslizamiento entre
// salas, la presentación del jefe, la caída por la trampilla, y el orden de dibujo (piso,
// manchas, puertas, todo lo que está parado ordenado por su pie, lo que vuela, la viñeta).
// ─────────────────────────────────────────────────────────────────────────────

let J = null;
function enJuego() { return !!J && J.estado === "juego"; }
const cvSala = lienzoNuevo(SALA_W, SALA_H), gSala = cvSala.getContext("2d");
const cvViejo = lienzoNuevo(SALA_W, SALA_H), gViejo = cvViejo.getContext("2d");

function nuevaPartida(semilla) {
  semilla = semilla ?? ((Math.random() * 4294967296) >>> 0);
  rnd = mulberry(semilla);
  J = {
    semilla, estado: "juego", t: 0, tiempo: 0, piso: null, sala: null, jug: nuevoJugador(),
    lagrimas: [], balas: [], bombas: [], fx: [], part: [], babas: [], enemigos: [], jefes: [], familiares: [], pendientes: [],
    temblor: 0, destello: 0, congelado: 0, puertasAbiertas: true, cierre: 0, rotulos: [], muertes: 0, causa: null,
    jefesVistos: [], enPedestal: new Set(), trans: null, vs: null, fundido: 0, tEstado: 0, campo: null, cambioGrilla: true,
  };
  armarTandas(); sortearCapsulas();
  iniciarPiso(1);
  registro.partidas++; guardarRegistro();
}

function iniciarPiso(n) {
  J.jefeTipo = elegirJefe(n, J.jefesVistos); J.jefesVistos.push(J.jefeTipo);
  J.piso = generarPiso(n);
  J.maldicion = sortearMaldicion(n);
  if (J.jug.mapa) revelarMapa();
  J.jug.golpesPiso = 0;
  J.estado = "juego";
  entrarSala(J.piso.inicio, null);
  J.fundido = J.armando ? 0 : 45;
  rotulo(J.piso.nombre, "", J.maldicion ? MALDICIONES[J.maldicion].texto : null);
  Musica.poner(PISOS[n].musica);
}

function entrarSala(sala, desde) {
  const j = J.jug;
  J.sala = sala;
  for (const k of ["lagrimas", "balas", "bombas", "fx", "part", "babas", "enemigos", "jefes"]) J[k].length = 0;
  J.campo = null; J.cambioGrilla = true; J.jefeMuerto = false;
  j.danoSala = 0;
  sala.visitada = sala.vista = true;
  for (const p of sala.puertas) if (p && puertaVisible(p) && p.destino.tipo !== "secreta") p.destino.vista = true;
  if (!sala.fondo) sala.fondo = hornearFondo(J.piso.cap, sala.semilla);
  if (desde == null) { j.x = cx(6); j.y = cy(3) + 6; }
  else {
    const d = opuesta(desde), mY = IY0 + FILAS * T / 2;
    [j.x, j.y] = [[SALA_W / 2, IY0 + 9], [IX1 - 9, mY], [SALA_W / 2, IY1 - 7], [IX0 + 9, mY]][d];
    j.vx *= 0.3; j.vy *= 0.3;
  }
  armarFamiliares();
  for (const f of J.familiares) { f.x = j.x; f.y = j.y; }
  if (!sala.limpia) {
    poblarSala(sala);
    J.puertasAbiertas = false; SFX.puertaCierra();
    if (sala.tipo === "jefe") { J.vsPendiente = true; Musica.poner("jefe"); }
  } else J.puertasAbiertas = true;
  J.cierre = J.puertasAbiertas ? 0 : 1;
  if (sala.tipo === "pacto") Musica.poner("pacto");
  else if (sala.tipo !== "jefe" || sala.limpia) Musica.poner(PISOS[J.piso.n].musica);
}

// ── el paso de la lógica (60 veces por segundo) ──
function pasoJuego() {
  J.t++;
  if (J.fundido > 0) J.fundido--;
  if (J.temblor > 0) J.temblor *= 0.86, J.temblor < 0.4 && (J.temblor = 0);
  if (J.destello > 0) J.destello--;
  if (J.estado === "transicion") { if (++J.trans.t >= J.trans.dur) { J.trans = null; J.estado = "juego"; if (J.vsPendiente) empezarVs(); } return; }
  if (J.estado === "vs") { J.vs.t++; if (J.vs.t > 150 || (J.vs.t > 30 && (recien("toque") || recien("aceptar")))) J.estado = "juego"; return; }
  if (J.estado === "cayendo") { if (++J.tEstado > CAIDA.sale + CAIDA.negro) { J.jug.x = cx(6); J.jug.y = cy(3); iniciarPiso(J.piso.n + 1); J.armando = CAIDA.entra; for (const r of J.rotulos) r.t = -CAIDA.entra + 4; /* el nombre sale cuando la imagen ya se armó */ } return; }
  if (J.estado === "ganando") { if (++J.tEstado > 90) { J.estado = "victoria"; J.tEstado = 0; abrirMenu("victoria"); } return; }
  if (J.estado !== "juego") return;
  J.tiempo++;
  const j = J.jug;
  if (recien("pausa")) { abrirMenu("pausa"); return; }
  if (J.congelado > 0) J.congelado--;
  if (!j.muerto) {
    if (recien("bomba")) tirarBomba(j);
    if (recien("activo")) usarActivo(j);
    if (recien("capsula")) tomarCapsula(j);
  }
  actualizarJugador(j);
  actualizarFamiliares();
  actualizarEnemigos();
  actualizarLagrimas();
  actualizarBalas();
  actualizarBombas();
  actualizarCosas();
  actualizarBabas();
  actualizarParticulas();
  actualizarFx();
  const pend = J.pendientes; J.pendientes = [];
  for (const f of pend) f();
  // las puertas: animación y llaves
  const meta = J.puertasAbiertas ? 0 : 4;
  J.cierre += lim(meta - J.cierre, -0.34, 0.34);
  for (let d = 0; d < 4; d++) {
    const p = J.sala.puertas[d];
    if (p && p.llave && puertaVisible(p) && dist(j.x, j.y, PUERTA[d].x, PUERTA[d].y) < 20 && j.llaves > 0 && J.puertasAbiertas) {
      j.llaves--; p.llave = false; if (p.par) p.par.llave = false; SFX.llave(); SFX.puertaAbre();
    }
  }
  // ¿limpió la sala?
  if (!J.sala.limpia && J.enemigos.length === 0) salaLimpia();
  if (J.jefeMuerto && J.jefes.every((e) => e.muerto) && !J.sala.premiada) jefeDerrotado();
  // ¿sale por una puerta?
  if (!j.muerto) {
    let d = -1;
    if (j.y < IY0 - 5) d = ARRIBA; else if (j.y > IY1 + 5) d = ABAJO; else if (j.x < IX0 - 5) d = IZQUIERDA; else if (j.x > IX1 + 5) d = DERECHA;
    if (d >= 0) pasarPuerta(d);
  }
  if (j.muerto && j.tMuerte > 80 && J.estado === "juego") { J.estado = "muerte"; J.tEstado = 0; registro.muertes++; guardarRegistro(); abrirMenu("muerte"); }
}

function salaLimpia() {
  const s = J.sala;
  s.limpia = true;
  J.puertasAbiertas = true; SFX.puertaAbre();
  cargarActivo(1);
  if (s.tipo === "normal") premioSala();
}

function jefeDerrotado() {
  const s = J.sala, n = J.piso.n;
  s.premiada = true;
  J.sala.limpia = true; J.puertasAbiertas = true;
  registro.jefes = (registro.jefes || 0) + 1; guardarRegistro();
  cargarActivo(1);
  Musica.poner("silencio");
  if (n === ULTIMO_PISO) {
    const c = recogible("cofreFinal", cx(6), cy(4)); c.quieto = true; s.cosas.push(c);
    rotulo("¡MICELIA CAYÓ!", "Abrí el cofre");
    return;
  }
  s.cosas.push(pedestal(cx(6), cy(4) + 4, sacarObjeto("jefe")));
  for (let i = 0; i < A.ent(1, 2); i++) soltarPremio(cx(6) + V.ent(-20, 20), cy(3), "corazon");
  const tr = recogible("trampilla", cx(6), cy(1)); tr.quieto = true; s.cosas.push(tr);
  // la puerta del pacto: más probable si no te tocaron en la pelea
  if (A.si(probPacto())) {
    const libres = [0, 1, 2, 3].filter((d) => !s.puertas[d]);
    if (libres.length) { crearSalaPacto(J.piso, s, A.uno(libres)); J.pendientes.push(() => SFX.pacto()); }
  }
  J.jug.golpesJefe = 0;
}

function pasarPuerta(d) {
  const p = J.sala.puertas[d];
  if (!p) return;
  // una foto de la sala que se va (para el deslizamiento)
  gViejo.drawImage(cvSala, 0, 0);
  J.trans = { dir: d, t: 0, dur: 8 };   // medido en el video: ~4 cuadros a 30 fps
  J.estado = "transicion";
  const j = J.jug;
  entrarSala(p.destino, d);
  j.inv = Math.max(j.inv, 0);
  J.congelado = 8;
}

function empezarVs() { J.vsPendiente = false; J.estado = "vs"; J.vs = { t: 0, tipo: J.jefeTipo }; SFX.jefe(); }

function bajarPiso() {
  if (J.piso.n >= ULTIMO_PISO) return;
  J.estado = "cayendo"; J.tEstado = 0; SFX.pozo();
  registro.mejorPiso = Math.max(registro.mejorPiso || 1, J.piso.n + 1); guardarRegistro();
}
function ganar() {
  J.estado = "ganando"; J.tEstado = 0; SFX.objeto(); SFX.secreto();
  registro.victorias++; guardarRegistro();
}

// ── el dibujo ──
const _orden = [];
function dibujarSala(g) {
  const s = J.sala;
  g.drawImage(s.fondo, 0, 0);
  if (s.decal) g.drawImage(s.decal, 0, 0);
  dibujarTutorial(g);
  // lo que está a ras del piso
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
    const o = s.celdas[f * COLS + c];
    if (!o) continue;
    const x = IX0 + c * T, y = IY0 + f * T;
    if (o.t === "pozo") { const es = (C, F) => { const q = celda(s, C, F); return !!q && q.t === "pozo"; }; g.drawImage(pozoSpr(es(c, f - 1), es(c - 1, f), es(c + 1, f), es(c, f + 1)), x, y); }
    else if (o.t === "pinchos") g.drawImage(pinchosSpr(true), x, y);
  }
  dibujarBabas(g);
  for (const c of s.cosas) if (c.t === "trampilla") dibujarCosa(g, c);
  // las puertas
  for (let d = 0; d < 4; d++) {
    const p = s.puertas[d];
    if (!p || !puertaVisible(p)) continue;
    const tipo = p.secreta ? "secreta" : p.tipo, est = p.llave ? 5 : Math.round(J.cierre);
    const [x, y] = lugarPuerta(d);
    g.drawImage(puertaRotada(tipo, tipo === "secreta" ? 0 : est, d), Math.round(x), Math.round(y));
  }
  // todo lo que está parado, ordenado por su pie
  _orden.length = 0;
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
    const o = s.celdas[f * COLS + c];
    if (o && o.t !== "pozo" && o.t !== "pinchos" && !(o.t === "matas" && o.vida <= 0)) _orden.push([cy(f) + T / 2 - 2, 0, o, c, f]);
  }
  for (const c of s.cosas) if (c.t !== "trampilla") _orden.push([c.y, 1, c]);
  for (const e of J.enemigos) _orden.push([e.y + (e.jefe && e.z > 40 ? 999 : 0), 2, e]);
  for (const f of J.familiares) _orden.push([f.y, 3, f]);
  for (const b of J.bombas) _orden.push([b.y, 4, b]);
  _orden.push([J.jug.y, 5, J.jug]);
  for (const l of J.lagrimas) _orden.push([l.y, 6, l]);
  for (const b of J.balas) _orden.push([b.y, 7, b]);
  _orden.sort((a, b) => a[0] - b[0]);
  for (const it of _orden) {
    const o = it[2];
    switch (it[1]) {
      case 0: dibujarObstaculo(g, o, it[3], it[4]); break;
      case 1: dibujarCosa(g, o); break;
      case 2: if (o.def.dibujar) o.def.dibujar(g, o); else dibujarEnemigo(g, o); break;
      case 3: dibujarFamiliar(g, o); break;
      case 4: dibujarBomba(g, o); break;
      case 5: if (J.estado !== "cayendo") dibujarJugador(g, o); break;
      case 6: dibujarLagrima(g, o); break;
      case 7: dibujarBala(g, o); break;
    }
  }
  dibujarFx(g);
  dibujarParticulas(g);
  if (J.estado === "cayendo") {
    const u = Math.min(1, J.tEstado / 30), sp = spritesShumio(), j = J.jug;
    const e = 1 - u;
    if (e > 0.05) { g.save(); g.translate(Math.round(j.x), Math.round(j.y)); g.scale(e, e); g.drawImage(sp.cue.frente[0], -7, -8); g.drawImage(sp.cab.frente[3], -11, -24); g.restore(); }

  }
  g.drawImage(vineta(), -20, -20);
  if (J.maldicion === "oscuridad") { const o = oscuridadSpr(); g.drawImage(o, Math.round(J.jug.x - o.width / 2), Math.round(J.jug.y - 8 - o.height / 2)); }
}
function dibujarObstaculo(g, o, c, f) {
  const x = cx(c), yb = cy(f) + T / 2 + 1;
  let s;
  switch (o.t) {
    case "roca": s = rocaSpr(o.v, o.marcada); break;
    case "matas": s = matasSpr(o.vida, o.dorada ? 1 : 0); break;
    case "brasero": s = braseroSpr((J.t >> 3) & 3, o.prendido); break;
    case "barril": s = barrilSpr(); break;
    case "bloque": s = bloqueSpr(); break;
    default: return;
  }
  g.drawImage(s, Math.round(x - s.width / 2), yb - s.height);
}

function dibujarJuego(g) {
  const W = PANT.W, H = PANT.H;
  g.fillStyle = "#07060a"; g.fillRect(0, 0, W, H);
  dibujarSala(gSala);
  let ox = PANT.salaX, oy = PANT.salaY;
  if (J.temblor > 0) { ox += Math.round((V.f() - 0.5) * J.temblor); oy += Math.round((V.f() - 0.5) * J.temblor); }
  if (J.trans) {
    const u = J.trans.t / J.trans.dur, e = u * u * (3 - 2 * u), [dx, dy] = DIRS[J.trans.dir];
    const sx = Math.round(-dx * SALA_W * e), sy = Math.round(-dy * SALA_H * e);
    g.drawImage(cvViejo, ox + sx, oy + sy);
    g.drawImage(cvSala, ox + sx + dx * SALA_W, oy + sy + dy * SALA_H);
    // en el medio del deslizamiento, todo se oscurece un poco (como en el original)
    g.fillStyle = `rgba(0,0,0,${(Math.sin(u * Math.PI) * 0.38).toFixed(3)})`; g.fillRect(0, 0, W, H);
  } else g.drawImage(cvSala, ox, oy);
  if (J.destello > 0) { g.fillStyle = `rgba(255,248,235,${J.destello * 0.08})`; g.fillRect(0, 0, W, H); }
  if (J.estado !== "vs") dibujarHud(g);
  if (J.estado === "vs") dibujarVs(g);
  if (J.fundido > 0) { g.fillStyle = `rgba(0,0,0,${J.fundido / 45})`; g.fillRect(0, 0, W, H); }
  // el mosaico del cambio de piso: cuadrados cada vez más grandes mientras se apaga, y al revés
  if (J.estado === "cayendo") mosaico(g, Math.min(1, J.tEstado / CAIDA.sale));
  else if (J.armando > 0) { mosaico(g, J.armando / CAIDA.entra); J.armando--; }
  if (J.estado === "ganando") { g.fillStyle = `rgba(255,250,240,${Math.min(1, J.tEstado / 80)})`; g.fillRect(0, 0, W, H); }
}

// ── el bucle: paso fijo de 60 Hz, dibujo cuando hubo paso ──
let _acum = 0, _ultimo = 0;
const PERF = { cuadros: 0, pasos: 0, msDibujo: 0 };
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  if (!_ultimo) _ultimo = ahora;
  _acum += Math.min(100, ahora - _ultimo); _ultimo = ahora;
  let n = 0;
  while (_acum >= CUADRO && n < 4) { paso(); _acum -= CUADRO; n++; }
  if (n >= 4) _acum = 0;
  if (n > 0) { const t0 = performance.now(); dibujar(); PERF.msDibujo = PERF.msDibujo * 0.95 + (performance.now() - t0) * 0.05; PERF.cuadros++; }
}
function paso() {
  PERF.pasos++;
  leerEntrada();
  ubicarBotones();
  if (PANT.vertical) { if (enJuego()) abrirMenu("pausa"); finEntrada(); return; }
  if (MENU.activo) pasoMenu();
  else if (J) pasoJuego();
  finEntrada();
}
function dibujar() {
  const g = cxM;
  g.imageSmoothingEnabled = false;
  if (J && (!MENU.activo || MENU.activo.sobreJuego)) dibujarJuego(g);
  if (MENU.activo) dibujarMenu(g);
  if (PANT.vertical) dibujarGirar(g);
  presentar();
}
function alMedir() { if (typeof ubicarBotones === "function") ubicarBotones(); }
function arrancar() { medir(); abrirMenu("titulo"); requestAnimationFrame(cuadro); }

/** La chance de que se abra el pacto al matar al jefe de este piso (se muestra en el HUD). */
function probPacto() {
  if (!J || !J.piso || J.piso.n < 2 || J.piso.n >= ULTIMO_PISO) return 0;
  return J.jug.golpesJefe === 0 ? 0.7 : 0.33;
}

const CAIDA = { sale: 96, negro: 18, entra: 72 };
const cvMosaico = lienzoNuevo(8, 8), gMosaico = cvMosaico.getContext("2d");
/** El mundo en cuadrados de b píxeles (el color de cada uno, promediado) y oscurecido. u: 0 → 1. */
function mosaico(g, u) {
  const W = PANT.W, H = PANT.H, b = Math.max(1, Math.round(1 + Math.pow(u, 1.4) * 27));
  if (b > 1) {
    const w = Math.ceil(W / b), h = Math.ceil(H / b);
    if (cvMosaico.width !== w || cvMosaico.height !== h) { cvMosaico.width = w; cvMosaico.height = h; }
    gMosaico.imageSmoothingEnabled = true; gMosaico.imageSmoothingQuality = "low";
    gMosaico.drawImage(g.canvas, 0, 0, W, H, 0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.drawImage(cvMosaico, 0, 0, w, h, 0, 0, w * b, h * b);
  }
  g.fillStyle = `rgba(0,0,0,${Math.min(1, Math.pow(u, 1.2)).toFixed(3)})`; g.fillRect(0, 0, W, H);
}

// ── la maldición de la oscuridad: sólo se ve alrededor de Shumio (una luz tramada) ──
function oscuridadSpr() {
  return hornear("oscuridad", () => {
    const W = SALA_W * 2, H = SALA_H * 2, p = new Pix(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - W / 2, (y - H / 2) * 1.15) / 78 + bayer(x, y) * 0.18;
      if (d > 1.15) p.p(x, y, "rgba(0,0,0,0.9)"); else if (d > 0.9) p.p(x, y, "rgba(0,0,0,0.62)"); else if (d > 0.7) p.p(x, y, "rgba(0,0,0,0.3)");
    }
    return p.canvas();
  });
}

// ── los controles dibujados en el piso de la primera sala (como el MOVE / ATTACK / BOMB / ITEM) ──
function dibujarTutorial(g) {
  if (!(J.piso.n === 1 && J.sala === J.piso.inicio)) return;
  const tinta = "#050403", cols = [0.13, 0.38, 0.63, 0.88].map((u) => Math.round(IX0 + COLS * T * u)), yT = IY0 + 10;
  g.save(); g.globalAlpha = 0.62;
  const tactil = IN.usaTactil;
  const titulos = ["MOVERSE", "LLORAR", "BOMBA", "OBJETO"];
  titulos.forEach((t, i) => { const s = etiquetaSpr(t, tinta); g.drawImage(s, cols[i] - Math.round(s.width / 2), yT); });
  // los dibujitos: Shumio (a un píxel de trazo) con lo que hace
  // el trazo, engrosado un píxel a la derecha (como marcador), en la misma tinta que las letras
  const fig = tinte(dibujoShumioChico(), tinta);
  cols.forEach((x) => { g.drawImage(fig, x - 18, yT + 18); g.drawImage(fig, x - 17, yT + 18); });
  const P = (x, y, w, h) => { g.fillStyle = tinta; g.fillRect(x, y, w, h); };
  const flecha = (x, y, d) => { for (let k = 0; k < 4; k++) { if (d === 0) P(x - k, y + k, 2 * k + 1, 1); if (d === 2) P(x - k, y - k, 2 * k + 1, 1); if (d === 1) P(x - k, y - k, 1, 2 * k + 1); if (d === 3) P(x + k, y - k, 1, 2 * k + 1); } };
  const x0 = cols[0], yc = yT + 38;
  flecha(x0, yc - 26, 0); flecha(x0, yc + 26, 2); flecha(x0 - 26, yc, 3); flecha(x0 + 26, yc, 1);
  // llorar: lágrimas en las cuatro direcciones, con la línea de puntos
  const x1 = cols[1];
  for (const [dx, dy] of DIRS) { for (let k = 12; k < 22; k += 3) P(x1 + dx * k, yc + dy * k, 1, 1); const cxl = x1 + dx * 26, cyl = yc + dy * 26; for (let a = 0; a < 12; a++) P(Math.round(cxl + Math.cos(a / 12 * TAU) * 3), Math.round(cyl + Math.sin(a / 12 * TAU) * 3), 1, 1); }
  // bomba: la bomba al lado, con chispas
  const x2 = cols[2] + 16;
  for (let a = 0; a < 20; a++) P(Math.round(x2 + Math.cos(a / 20 * TAU) * 5), Math.round(yc + 8 + Math.sin(a / 20 * TAU) * 5), 1, 1);
  P(x2 + 2, yc + 1, 1, 3); for (const [a, b] of [[4, -1], [6, 0], [5, -3]]) P(x2 + a, yc + b, 1, 1);
  // objeto: algo levantado sobre la cabeza
  const x3 = cols[3];
  for (let a = 0; a < 16; a++) P(Math.round(x3 + Math.cos(a / 16 * TAU) * 4), Math.round(yT + 12 + Math.sin(a / 16 * TAU) * 4), 1, 1);
  for (const [a, b] of [[-9, 10], [-8, 14], [8, 10], [7, 14]]) P(x3 + a, yT + b, 3, 1);
  // las teclas (PC) o los controles del teléfono
  const yK = yc + 34;
  const tecla = (x, y, t, w = 11) => { g.strokeStyle = tinta; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w, 11); const s = etiquetaSpr(t, tinta); g.drawImage(s, Math.round(x + w / 2 - s.width / 2 + 1), y - 2); };
  if (!tactil) {
    ["W", "A", "S", "D"].forEach((k, i) => tecla(x0 - 26 + i * 13, yK, k));
    ["↑", "←", "↓", "→"].forEach((k, i) => { const x = x1 - 26 + i * 13; g.strokeStyle = tinta; g.strokeRect(x + 0.5, yK + 0.5, 11, 11); flecha(x + 6, yK + 6, [0, 3, 2, 1][i]); });
    tecla(cols[2] - 6, yK, "E");
    tecla(x3 - 20, yK, "ESPACIO", 40);
  } else {
    const aroT = (x, y, r) => { for (let a = 0; a < 28; a++) P(Math.round(x + Math.cos(a / 28 * TAU) * r), Math.round(y + Math.sin(a / 28 * TAU) * r), 1, 1); };
    aroT(x0, yK + 6, 8); aroT(x0 + 3, yK + 4, 3);
    aroT(x1, yK + 6, 8); aroT(x1 - 3, yK + 6, 3);
    aroT(cols[2], yK + 6, 7); aroT(x3, yK + 6, 6);
    const s = etiquetaSpr("IZQUIERDA", tinta), s2 = etiquetaSpr("DERECHA", tinta);
    g.drawImage(s, x0 - Math.round(s.width / 2), yK + 16); g.drawImage(s2, x1 - Math.round(s2.width / 2), yK + 16);
  }
  g.restore();
}
