// ─────────────────────────────────────────────────────────────────────────────
// EL QUE CAE. Un solo botón: en el piso salta; en el aire dispara las botas hacia abajo (cada tiro
// frena la caída y gasta carga). La carga se llena al tocar piso o al pisar algo. Pisar lo blanco lo
// mata y rebota; pisar lo rojo duele. Los bichos que mueren en el aire suman combo; al aterrizar se
// cobra: 8+ = 100 gemas, 15+ = además +1 carga máxima, 25+ = además +1 de vida (wiki).
// Posición: x = centro, y = pies.
// ─────────────────────────────────────────────────────────────────────────────

let J = null;

function nuevoJugador(estilo) {
  const E = ESTILOS[estilo] || ESTILOS.normal;
  const vida = E.vida || 4;
  return { x: 0, y: 0, vx: 0, vy: 0, w: 7, h: 11, suelo: false, coyote: 0, izq: false, vida, vidaMax: vida, desborde: 0, carga: 8, cargaMax: 8,
    inv: 0, cadT: 0, rafaga: [], anim: 0, pose: "quieto", combo: 0, medidor: 0, gemHigh: false, bocados: 0, combustible: 5, globo: false, disparoT: 0, muerto: false };
}

/** Todo lo del jugador en un paso. Devuelve "salida" si cayó por el fondo del nivel. */
function pasoJugador(dt) {
  const j = J.jug, N = J.N, M = J.mejoras, E = ESTILOS[G.estilo] || ESTILOS.normal;
  const inp = leerEntrada();
  // correr (el estilo piedra acelera más)
  const dir = (inp.der ? 1 : 0) - (inp.izq ? 1 : 0), maxV = FIS.corre * (E.vida ? 1.1 : 1);
  const acel = j.suelo ? (dir ? FIS.acel * (E.vida ? 1.4 : 1) : FIS.frena) : FIS.acelAire;
  const obj = dir * maxV;
  j.vx += lim(obj - j.vx, -acel * dt, acel * dt);
  if (dir) j.izq = dir < 0;
  // saltar o disparar: el mismo botón
  j.cadT -= dt; j.disparoT -= dt;
  if (j.suelo) j.coyote = 0.08; else j.coyote -= dt;
  if (recien("salto") && j.coyote > 0) {
    j.vy = -FIS.salto * (M.cohete ? 1.3 : 1); j.suelo = false; j.coyote = 0; sfx("salto", 0.6);
    if (M.cohete) explosion(j.x, j.y + 2, 26, 2, true);
  } else if (inp.salto && !j.suelo && j.coyote <= 0) {
    // disparar pide apretar EN el aire: si se salta (o se rebota) con el botón apretado, no se gasta
    // la carga sola; manteniéndolo apretado después de apretarlo en el aire, tira en automático
    if (recien("salto")) j.armado = true;
    if (j.armado && j.carga > 0 && j.cadT <= 0) disparar();
    else if (j.carga <= 0 && M.mochila && j.combustible > 0) { j.vy = Math.min(j.vy, 25); j.combustible -= dt; if (J.cuadro % 3 === 0) particula(j.x + V.f() * 4 - 2, j.y, 0, 60, 0.25, "acento"); }
    else if (j.carga <= 0 && recien("salto")) sfx("vacio", 0.5);
  }
  if (!inp.salto || j.suelo) j.armado = false;
  // la ráfaga pendiente
  for (let i = j.rafaga.length - 1; i >= 0; i--) { if ((j.rafaga[i] -= dt) <= 0) { j.rafaga.splice(i, 1); tiro(0, 0); } }
  // gravedad (la pluma y el globo caen más lento)
  const flota = E.flota || (M.globo && j.globo) ? 0.55 : 1;
  j.vy = Math.min(j.vy + FIS.grav * dt * flota, FIS.caidaMax * flota);
  const antesSuelo = j.suelo, vyAntes = j.vy;
  const c = moverCaja(j, j.vx * dt, j.vy * dt, N);
  if (c.pared) j.vx = 0;
  if (c.techo) { j.vy = Math.max(0, j.vy); const tx = Math.floor(j.x / T), ty = Math.floor((j.y - j.h - 1) / T); if (rompible(N.en(tx, ty))) romper(tx, ty); }   // cabezazo
  j.suelo = c.suelo;
  if (c.suelo) {
    j.vy = 0;
    if (!antesSuelo) {
      aterrizar(vyAntes);
      // los pinches: duelen al caer encima, y rebotan
      if (c.pincha) { herir(); j.vy = -FIS.rebote; j.suelo = false; }
    }
  }
  // pisotones y choques con los bichos
  for (const b of J.bichos) {
    if (b.muerto || !solapa(j, b)) continue;
    const arriba = vyAntes > 0 && j.y - vyAntes * dt <= b.y - b.h + 5;
    if (arriba && b.d.pisa && !b.enojado && !(b.d.mueve === "calamar" && b.baja)) pisotear(b);
    else if (arriba && b.d.blindado && b.d.pisa) pisotear(b);
    else herir();
  }
  for (const a of J.adornos) if (!a.roto && solapa(j, a) && vyAntes > 0) { a.roto = true; rebote(); soltarGemas(a.x, a.y - 4, 4); particulas(a.x, a.y - 4, 8, "tinta"); sfx("pisoton", 0.5); }
  // gemas: imán corto (más con el imán de gemas)
  const radio = M.iman ? 46 : 14;
  for (let i = J.gemas.length - 1; i >= 0; i--) {
    const gm = J.gemas[i], dx = j.x - gm.x, dy = j.y - 5 - gm.y, d = Math.hypot(dx, dy);
    if (d < radio) { gm.x += dx / (d || 1) * 260 * dt; gm.y += dy / (d || 1) * 260 * dt; }
    if (d < 7) { J.gemas.splice(i, 1); juntarGema(gm.v); }
  }
  // el Gem High: 100 gemas seguidas llenan el medidor; se va vaciando (más lento con la fiebre)
  if (j.gemHigh) { j.medidor -= (M.fiebre ? 4 : 9) * dt; if (j.medidor <= 0) { j.gemHigh = false; j.medidor = 0; } }
  else j.medidor = Math.max(0, j.medidor - 22 * dt);
  if (j.inv > 0) j.inv -= dt;
  // la pose del dibujo
  j.anim += dt * (Math.abs(j.vx) > 10 ? 10 : 2);
  j.pose = j.suelo ? (Math.abs(j.vx) > 10 ? ["corre1", "corre2", "corre3", "corre2"][Math.floor(j.anim) % 4] : "quieto") : j.disparoT > 0 ? "dispara" : j.vy < 0 ? "sube" : "cae";
  // salas laterales y fondo del nivel
  if (!J.sala) {
    for (const p of N.puertas) if (!p.usada && Math.abs(j.y - p.y) < 20 && (p.lado < 0 ? j.x < 10 : j.x > COLS * T - 10)) { entrarSala(p); return; }
    if (j.y > N.filas * T + 24) return "salida";
  } else if (N.salidaX === 0 ? j.x < 6 : j.x > COLS * T - 6) { salirSala(); return; }
  return null;
}

function aterrizar(vy) {
  const j = J.jug;
  if (vy > 120) { particulas(j.x, j.y, 4, "tinta", 40); sfx("aterriza", 0.5); }
  if (j.carga < j.cargaMax) { j.carga = j.cargaMax; sfx("recarga", 0.35); }
  j.combustible = 5;
  cobrarCombo();
}
function rebote() {
  const j = J.jug, E = ESTILOS[G.estilo] || ESTILOS.normal;
  j.vy = -(IN.salto ? FIS.reboteAlto : FIS.rebote) * (E.vida ? 0.85 : 1);
  j.carga = j.cargaMax; j.combustible = 5; j.armado = false;
}
function pisotear(b) {
  rebote();
  sfx("pisoton", 0.8);
  if (J.mejoras.estallido) explosion(b.x, b.y - 4, 30, 2, true);
  if (J.mejoras.tenedor) { J.jug.bocados++; if (J.jug.bocados >= 10) { J.jug.bocados = 0; curar(1); cartel("OMNOMNOM!", 1.2); } }
  matarBicho(b, true);
}
function cobrarCombo() {
  const j = J.jug, n = j.combo;
  if (n >= 8) {
    // los premios no se suman: 100 gemas; +1 carga máx. desde 15; +1 de vida desde 25 (wiki)
    J.gemasPartida += 100; J.gemasJuntadas += 100;
    let txt = "+100";
    if (n >= 15) { j.cargaMax++; txt += " +1 CHARGE"; }
    if (n >= 25) { curar(1); txt += " +1 HP"; }
    cartel(L(TX.premio), 1.8, `${n} ${L(TX.combo)} · ${txt}`);
    sfx("combo");
  }
  J.maxCombo = Math.max(J.maxCombo, n);
  j.combo = 0;
}
function juntarGema(v) {
  const j = J.jug;
  J.gemasPartida += v; J.gemasJuntadas += v;
  j.medidor = Math.min(100, j.medidor + v);
  if (!j.gemHigh && j.medidor >= 100) { j.gemHigh = true; sfx("gemHigh"); J.bannerGH = 2; }
  if (J.mejoras.pila && V.f() < 0.25 && j.carga < j.cargaMax) j.carga++;
  if (J.mejoras.pochoclo) J.balas.push({ x: j.x, y: j.y - 12, vx: 0, vy: -300, vida: 0.4, dano: 1, w: 3, h: 6, arriba: true });
  sfx("gema", 0.4, 1 + Math.min(0.8, J.rachaGemas * 0.03));
  J.rachaGemas++; J.rachaT = 0.5;
}
function curar(n) {
  const j = J.jug;
  j.vida += n;
  // lo que sobra llena el desborde; 4 de desborde = +1 de vida máxima (wiki)
  if (j.vida > j.vidaMax) { j.desborde += j.vida - j.vidaMax; j.vida = j.vidaMax; while (j.desborde >= 4) { j.desborde -= 4; j.vidaMax++; j.vida++; } }
  sfx("corazon", 0.6);
}
function herir() {
  const j = J.jug;
  if (j.inv > 0 || j.muerto) return;
  if (J.mejoras.globo && j.globo) { j.globo = false; explosion(j.x, j.y - 14, 34, 3, true); j.inv = 0.6; return; }
  j.vida--; j.inv = FIS.invul * (J.mejoras.vela ? 1.8 : 1);
  j.vy = Math.min(j.vy, -170);
  temblor(6); J.flash = 0.15;
  sfx("dolor", 0.8);
  if (j.vida <= 0) { j.muerto = true; J.finT = 0; sfx("morir"); pararTema(); }
}

// ── el disparo de las botas ──
function disparar() {
  const j = J.jug, A2 = ARMAS[J.arma];
  j.carga = Math.max(0, j.carga - A2.costo);
  j.cadT = A2.cad * (j.gemHigh && J.arma === "metra" ? 0.8 : 1);
  j.disparoT = 0.12;
  // cada tiro frena la caída; el láser y la escopeta levantan como un salto (wiki)
  if (A2.alza) j.vy = -FIS.salto * 0.8;
  else j.vy = Math.max(-95, Math.min(j.vy, 0) - 45);
  if (A2.rafaga) { tiro(0, 0); j.rafaga.push(A2.rafaga, A2.rafaga * 2); }
  else if (A2.rayo) rayoLaser();
  else for (let i = 0; i < A2.balas; i++) {
    const off = A2.junto ? (i - 1) * 3 : 0;
    let ang = A2.balas > 1 ? (i / (A2.balas - 1) - 0.5) * A2.abre * 2 : 0;
    if (A2.sesgo) ang = (j.vx > 10 ? 0.5 : j.vx < -10 ? -0.5 : 0) + (V.f() - 0.5) * 0.25;
    if (A2.perfora) ang += (V.f() - 0.5) * 0.12;
    tiro(ang, off);
  }
  if (J.mejoras.dron) J.balas.push(balaNueva(J.dron.x, J.dron.y + 4, 0, 1));
  sfx(A2.rayo ? "laser" : A2.alza ? "tiroGordo" : "tiro", 0.5);
  particula(j.x, j.y + 2, 0, 80, 0.12, "acento");
}
function balaNueva(x, y, ang, escala = 1) {
  const j = J.jug, A2 = ARMAS[J.arma], alto = j.gemHigh ? 1.4 : 1, rango = FIS.alcance * alto * (J.mejoras.mira ? 1.3 : 1) * (A2.corto || 1);
  const v = FIS.velBala;
  return { x, y, vx: Math.sin(ang) * v, vy: Math.cos(ang) * v, vida: rango / v, dano: A2.dano * (j.gemHigh ? 1.6 : 1) * escala, w: j.gemHigh ? 5 : 3, h: j.gemHigh ? 10 : 7, perfora: A2.perfora, rojo: j.gemHigh };
}
function tiro(ang, off) { const j = J.jug; J.balas.push(balaNueva(j.x + off, j.y + 2, ang)); }
function rayoLaser() {
  // el láser: una columna larga que atraviesa bichos y bloques, y se corta en la roca
  const j = J.jug, N = J.N, x = j.x, largo = 200 * (j.gemHigh ? 1.3 : 1), dano = ARMAS.laser.dano * (j.gemHigh ? 1.25 : 1);
  let fin = j.y + largo;
  for (let y = j.y; y < j.y + largo; y += 4) { const c = N.en(Math.floor(x / T), Math.floor(y / T)); if (c === ROCA) { fin = y; break; } if (rompible(c)) romper(Math.floor(x / T), Math.floor(y / T)); }
  for (const b of J.bichos) if (!b.muerto && Math.abs(b.x - x) < b.w / 2 + 3 && b.y > j.y && b.y - b.h < fin) danarBicho(b, dano);
  J.efectos.push({ tipo: "laser", x, y0: j.y, y1: fin, t: 0.15, t0: 0.15 });
}

/** Mueve una caja contra la grilla, eje por eje. Devuelve {suelo, techo, pared, pincha}. */
function moverCaja(o, dx, dy, N) {
  const r = { suelo: false, techo: false, pared: false, pincha: false }, hw = o.w / 2;
  // eje x
  o.x += dx;
  {
    const y0 = Math.floor((o.y - o.h + 1) / T), y1 = Math.floor((o.y - 1) / T);
    if (dx > 0) { const cx = Math.floor((o.x + hw) / T); for (let cy = y0; cy <= y1; cy++) if (solida(N.en(cx, cy))) { o.x = cx * T - hw - 0.01; r.pared = true; break; } }
    else if (dx < 0) { const cx = Math.floor((o.x - hw) / T); for (let cy = y0; cy <= y1; cy++) if (solida(N.en(cx, cy))) { o.x = (cx + 1) * T + hw + 0.01; r.pared = true; break; } }
  }
  // eje y
  const antes = o.y;
  o.y += dy;
  {
    const x0 = Math.floor((o.x - hw + 0.5) / T), x1 = Math.floor((o.x + hw - 0.5) / T);
    if (dy > 0) {
      const cy = Math.floor(o.y / T);
      for (let cx = x0; cx <= x1; cx++) {
        const c = N.en(cx, cy);
        if (solida(c) || (c === PLAT && antes <= cy * T + 0.5)) { o.y = cy * T; r.suelo = true; if (c === PINCHE) r.pincha = true; }
      }
    } else if (dy < 0) {
      const cy = Math.floor((o.y - o.h) / T);
      for (let cx = x0; cx <= x1; cx++) if (solida(N.en(cx, cy))) { o.y = (cy + 1) * T + o.h + 0.01; r.techo = true; }
    }
    // parado quieto encima: seguir en el piso
    if (dy === 0 || (!r.suelo && dy >= 0)) { const cy = Math.floor((o.y + 0.5) / T); for (let cx = x0; cx <= x1; cx++) { const c = N.en(cx, cy); if ((solida(c) || c === PLAT) && Math.abs(o.y - cy * T) < 0.6) r.suelo = true; } }
  }
  return r;
}
const solapa = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1 && a.y > b.y - b.h + 1 && a.y - a.h < b.y - 1;
