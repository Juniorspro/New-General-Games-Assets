// ─────────────────────────────────────────────────────────────────────────────
// SHUMIO: moverse con inercia corta, llorar esporas en 4 direcciones y las cuentas del
// original. Retardo entre lágrimas = 16 − 6·√(1,3·L + 1) (en cuadros de 30 Hz), daño =
// 3,5·√(1 + 1,2·D) + plano, alcance 6,5 baldosas, velocidad 1 (tope 2). La cabeza mira hacia
// donde llora y cierra los ojos al soltar la lágrima; el cuerpo, hacia donde camina.
// ─────────────────────────────────────────────────────────────────────────────

function nuevoJugador() {
  return {
    x: cx(6), y: cy(3), r: 5, vx: 0, vy: 0, z: 0,
    cont: 6, vida: 6, esporas: 0,               // en medios corazones
    monedas: 0, bombas: 1, llaves: 0,
    danoUps: 0, danoPlano: 0, danoMult: 1, lagUps: 0, alcance: 6.5, velLag: 1, vel: 1, suerte: 0, tamLag: 1,
    triple: false, veneno: false, hielo: false, rebote: false, espectral: false, atraviesa: false, buscadora: false, fuego: false,
    vuela: false, iman: false, bombaGorda: false, colorLag: "espora",
    objetos: [], activo: null, capsula: null,
    inv: 0, enfriar: 0, mirar: ABAJO, mirarCue: ABAJO, gesto: 0, tGesto: 0, paso: 0, ojo: 0, tParpadeo: 120,
    danoSala: 0, sostiene: null, tSostiene: 0, muerto: false, tMuerte: 0, golpesPiso: 0, golpesJefe: 0,
  };
}

// ── las cuentas (las del original, pasadas a 60 Hz) ──
function danoDe(j) { return (3.5 * Math.sqrt(1 + 1.2 * Math.max(0, j.danoUps)) + j.danoPlano + j.danoSala) * j.danoMult; }
function retardoDe(j) {
  const L = j.lagUps;
  let d = L >= 0 ? 16 - 6 * Math.sqrt(L * 1.3 + 1) : L >= -0.77 ? 16 - 6 * Math.sqrt(L * 1.3 + 1) : 16 - 6 * L;
  d = Math.max(5, d);
  if (j.triple) d = d * 2.1 + 3;
  return d;
}
const cuadrosEntreLagrimas = (j) => (retardoDe(j) + 1) * 2;
const lagrimasPorSeg = (j) => 30 / (retardoDe(j) + 1);
const velDe = (j) => lim(j.vel, 0.4, 2);
const alcancePx = (j) => Math.max(2, j.alcance) * T;
const radioLagrima = (j) => lim(Math.round((2 + Math.sqrt(danoDe(j)) * 1.1) * j.tamLag), 2, 9);

function vidaTotal(j) { return j.vida + j.esporas; }
function curar(j, medios) { const antes = j.vida; j.vida = Math.min(j.cont, j.vida + medios); return j.vida > antes; }
function darEsporas(j, medios) { const tope = 24 - j.cont; if (j.esporas >= tope) return false; j.esporas = Math.min(tope, j.esporas + medios); return true; }
function sumarContenedor(j, n) { j.cont = lim(j.cont + n * 2, 0, 24); j.esporas = Math.min(j.esporas, 24 - j.cont); j.vida = Math.min(j.vida, j.cont); }

function herirJugador(j, medios, causa, dibujo) {
  if (j.inv > 0 || j.muerto || J.estado !== "juego") return false;
  if (J.sala.tipo === "jefe") j.golpesJefe++;
  j.golpesPiso++;
  let resto = medios;
  if (j.esporas > 0) { const q = Math.min(j.esporas, resto); j.esporas -= q; resto -= q; }
  if (resto > 0) j.vida = Math.max(0, j.vida - resto);
  j.inv = 60; j.gesto = 3; j.tGesto = 22;
  temblar(6);
  SFX.dolor();
  sangrar(j.x, j.y - 8, 6, PAL.sangre);
  if (vidaTotal(j) <= 0) { j.muerto = true; j.tMuerte = 0; J.causa = causa || "?"; J.causaSpr = dibujo || null; SFX.muere(); Musica.poner("silencio"); }
  return true;
}

function actualizarJugador(j) {
  if (j.muerto) { j.tMuerte++; return; }
  if (j.inv > 0) j.inv--;
  if (j.tGesto > 0 && --j.tGesto === 0) j.gesto = 0;
  if (j.tSostiene > 0) j.tSostiene--;
  // parpadeo de vez en cuando (el ojo cerrado dos cuadros de dibujo)
  if (--j.tParpadeo <= 0) { if (!j.gesto) { j.gesto = 2; j.tGesto = 7; } j.tParpadeo = V.ent(140, 320); }

  // moverse: inercia corta (se siente pesado y rápido a la vez, como el original)
  const vmax = 2.2 * velDe(j);
  const quieto = J.congelado > 0;
  const ax = quieto ? 0 : IN.mx * vmax, ay = quieto ? 0 : IN.my * vmax;
  const k = ax || ay ? 0.24 : 0.2;
  j.vx += (ax - j.vx) * k; j.vy += (ay - j.vy) * k;
  if (Math.abs(j.vx) < 0.02) j.vx = 0; if (Math.abs(j.vy) < 0.02) j.vy = 0;
  moverEnSala(J.sala, j, j.vx, j.vy, j.vuela, bordesJugador());
  chocarConCosas(j);
  const v = Math.hypot(j.vx, j.vy);
  j.paso += v;
  if (v > 0.3) j.mirarCue = Math.abs(j.vx) > Math.abs(j.vy) * 1.1 ? (j.vx > 0 ? DERECHA : IZQUIERDA) : (j.vy > 0 ? ABAJO : ARRIBA);

  // llorar
  if (j.enfriar > 0) j.enfriar--;
  const dx = quieto ? 0 : IN.dx, dy = quieto ? 0 : IN.dy;
  if (dx || dy) {
    j.mirar = dx > 0 ? DERECHA : dx < 0 ? IZQUIERDA : dy > 0 ? ABAJO : ARRIBA;
    if (j.enfriar <= 0) { dispararJugador(j, dx, dy); j.enfriar = cuadrosEntreLagrimas(j); }
  } else if (v > 0.3) j.mirar = j.mirarCue;
  else if (j.enfriar <= 0) j.mirar = j.mirarCue;

  // pinchos, brasas, baba
  if (!j.vuela) {
    const o = celda(J.sala, celdaX(j.x), celdaY(j.y));
    if (o && o.t === "pinchos") herirJugador(j, J.piso.n >= 3 ? 2 : 1, "UNOS PINCHOS", pinchosSpr(true));
    for (const b of J.babas) if (b.danina && dist(b.x, b.y, j.x, j.y) < b.r) { herirJugador(j, 1, "LA BABA", manchaSpr("baba", 0)); break; }
  }
  for (const o of alrededor(J.sala, j.x, j.y)) if (o.t === "brasero" && o.prendido && dist(o.px, o.py, j.x, j.y) < 14) herirJugador(j, J.piso.n >= 3 ? 2 : 1, "EL FUEGO", braseroSpr(0, true));
}

/** Las celdas que tocan un punto (para mirar braseros cerca). */
function alrededor(sala, x, y) {
  const out = [], c0 = celdaX(x), f0 = celdaY(y);
  for (let f = f0 - 1; f <= f0 + 1; f++) for (let c = c0 - 1; c <= c0 + 1; c++) { const o = celda(sala, c, f); if (o) { o.px = cx(c); o.py = cy(f); out.push(o); } }
  return out;
}

/** Los bordes por donde puede andar: el piso, y el hueco de una puerta abierta. */
function bordesJugador() {
  const b = { x0: IX0, y0: IY0, x1: IX1, y1: IY1 }, j = J.jug;
  if (!J.puertasAbiertas) return b;
  const P = J.sala.puertas, mitadX = SALA_W / 2, mitadY = IY0 + FILAS * T / 2;
  if (puertaPasable(P[ARRIBA]) && Math.abs(j.x - mitadX) < 8) b.y0 = IY0 - 18;
  if (puertaPasable(P[ABAJO]) && Math.abs(j.x - mitadX) < 8) b.y1 = IY1 + 18;
  if (puertaPasable(P[IZQUIERDA]) && Math.abs(j.y - mitadY) < 8) b.x0 = IX0 - 18;
  if (puertaPasable(P[DERECHA]) && Math.abs(j.y - mitadY) < 8) b.x1 = IX1 + 18;
  return b;
}
function puertaPasable(p) { return p && puertaVisible(p) && !p.llave; }

function dispararJugador(j, dx, dy) {
  const d = danoDe(j), r = radioLagrima(j), vel = 3.3 * j.velLag;
  const lado = (j.ojo = 1 - j.ojo) ? 1 : -1;
  const n = j.triple ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const abre = n === 1 ? 0 : (i - 1) * 0.16;
    const ang = Math.atan2(dy, dx) + abre;
    let vx = Math.cos(ang) * vel, vy = Math.sin(ang) * vel;
    // hereda un poco del paso (sólo de costado: así las lágrimas "se tuercen" como en el original)
    if (dx) vy += j.vy * 0.45; else vx += j.vx * 0.45;
    if (dx) vx += j.vx * 0.25; else vy += j.vy * 0.25;
    const ox = dy ? lado * 3 : dx * 5, oy = dx ? lado * 1 : dy * 3;
    const vida = alcancePx(j) / vel;
    J.lagrimas.push({
      x: j.x + ox, y: j.y + oy + (dy < 0 ? -2 : 0), z: 14, vx, vy, vida, vidaMax: vida, r, dano: d,
      color: j.colorLag, atraviesa: j.atraviesa, espectral: j.espectral, rebote: j.rebote, buscadora: j.buscadora,
      veneno: j.veneno && A.si(0.25 + j.suerte * 0.06), hielo: j.hielo && A.si(0.3 + j.suerte * 0.06), fuego: j.fuego && A.si(0.2 + j.suerte * 0.05),
      tocados: null,
    });
  }
  if (!j.gesto || j.gesto === 1) { j.gesto = 1; j.tGesto = 6; }
  SFX.lagrima();
}

function tirarBomba(j) {
  if (j.bombas <= 0 || j.muerto) return;
  j.bombas--;
  J.bombas.push({ x: j.x, y: j.y + 2, t: 90, gorda: j.bombaGorda, vx: j.vx * 0.3, vy: j.vy * 0.3, r: 5 });
  SFX.mecha();
}

// ── el dibujo ──
const VISTA_CAB = ["espalda", "lado", "frente", "ladoI"];
function dibujarJugador(g, j) {
  const s = spritesShumio();
  const X = Math.round(j.x), Y = Math.round(j.y);
  if (j.muerto) {
    // cae de costado y se deshace en esporas
    const t = Math.min(j.tMuerte, 30);
    g.drawImage(sombra(7, 3), X - 7, Y + 2);
    g.save(); g.translate(X, Y + 2); g.rotate(-Math.PI / 2 * Math.min(1, t / 14));
    g.drawImage(s.cue.frente[0], -7, -10); g.drawImage(s.cab.frente[3], -11, -26);
    g.restore();
    return;
  }
  if (j.inv > 0 && ((j.inv >> 2) & 1)) return;   // parpadea mientras es invencible
  const z = Math.round(j.vuela ? 5 + Math.sin(J.t * 0.08) * 1.5 : 0);
  g.drawImage(sombra(7, 3), X - 7, Y + 2);
  const mov = Math.hypot(j.vx, j.vy) > 0.3;
  const kPaso = mov ? Math.floor(j.paso / 7) % 4 : 0;
  const vc = j.mirarCue === ARRIBA ? "espalda" : j.mirarCue === ABAJO ? "frente" : j.mirarCue === DERECHA ? "lado" : "ladoI";
  const cue = s.cue[vc][kPaso];
  // la cabeza baja un píxel al soltar la lágrima (el "puchero")
  const cab = s.cab[VISTA_CAB[j.mirar]][j.gesto], baja = j.gesto === 1 ? 1 : 0;
  const bob = mov && (kPaso === 1 || kPaso === 3) ? 1 : 0;
  g.drawImage(cue, X - 7, Y - 8 - z);
  g.drawImage(cab, X - 11, Y - 24 - z + baja + bob);
  if (j.tSostiene > 0 && j.sostiene) g.drawImage(j.sostiene, X - 9, Y - 44 - z);
}

/** Los pedestales son un bloque firme (caja) y los cofres se empujan (como en el original): Shumio
 *  choca contra ellos y, al tocarlos, los usa. */
const RADIO_SOLIDO = { objeto: 10, cofre: 8, cofreFinal: 14 };
function chocarConCosas(e) {
  for (const c of J.sala.cosas) {
    if (c.t === "objeto") {
      // la caja del pedestal: 20×12, apoyada en su base
      const x0 = c.x - 10, x1 = c.x + 10, y0 = c.y - 8, y1 = c.y + 4;
      const px = lim(e.x, x0, x1), py = lim(e.y, y0, y1), dx = e.x - px, dy = e.y - py, d = Math.hypot(dx, dy);
      if (d < e.r) {
        if (d > 0.001) { e.x = px + dx / d * e.r; e.y = py + dy / d * e.r; }
        else { const izq = e.x - x0, der = x1 - e.x, arr = e.y - y0, aba = y1 - e.y, m = Math.min(izq, der, arr, aba); if (m === izq) e.x = x0 - e.r; else if (m === der) e.x = x1 + e.r; else if (m === arr) e.y = y0 - e.r; else e.y = y1 + e.r; }
        c.tocado = true;
      }
    } else if (c.t === "cofre" || c.t === "cofreFinal") {
      const R = RADIO_SOLIDO[c.t], dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy) || 0.001, m = R + e.r;
      if (d >= m) continue;
      const falta = m - d, nx = dx / d, ny = dy / d;
      if (c.t === "cofre") {            // se empuja: el cofre se corre y choca con las paredes
        const antes = [c.x, c.y];
        c.r = R; moverEnSala(J.sala, c, nx * falta * 0.8, ny * falta * 0.8, false);
        const movido = Math.hypot(c.x - antes[0], c.y - antes[1]);
        const resto = Math.max(0, falta - movido);
        e.x -= nx * resto; e.y -= ny * resto;
      } else { e.x -= nx * falta; e.y -= ny * falta; }
      c.tocado = true;
    }
  }
}
