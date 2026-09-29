// ─────────────────────────────────────────────────────────────────────────────
// SHUMIO: moverse con inercia corta, llorar esporas en 4 direcciones y las cuentas del
// original. Retardo entre lágrimas = 16 − 6·√(1,3·L + 1) (en cuadros de 30 Hz), daño =
// 3,5·√(1 + 1,2·D) + plano, alcance 6,5 baldosas, velocidad 1 (tope 2). La cabeza mira hacia
// donde llora y cierra los ojos al soltar la lágrima; el cuerpo, hacia donde camina.
// ─────────────────────────────────────────────────────────────────────────────

function nuevoJugador() {
  const j = {
    x: cx(6), y: cy(3), r: 5, vx: 0, vy: 0, z: 0,
    cont: 6, vida: 6,                            // en medios corazones
    almas: [],                                   // los de espora y los negros, de a medio: "e" o "n" (van al final de la barra)
    monedas: 0, bombas: 1, llaves: 0,
    // lo que suman las cápsulas y los pactos (lo de los objetos se recalcula siempre desde la lista)
    extra: { dano: 0, plano: 0, lag: 0, fr: 0, vel: 0, alc: 0, velLag: 0, suerte: 0 },
    objetos: [], vistos: new Set(), transf: [], activo: null, capsula: null, baratija: null, vidasExtra: 0,
    inv: 0, enfriar: 0, mirar: ABAJO, mirarCue: ABAJO, gesto: 0, tGesto: 0, paso: 0, ojo: 0, tParpadeo: 120,
    danoSala: 0, salaF: [], escudo: 0, sostiene: null, tSostiene: 0, muerto: false, tMuerte: 0, golpesPiso: 0, golpesJefe: 0,
    carga: 0, cargando: false, ojoMuerto: 0, fallos: 0, disparos: 0,
  };
  // "esporas" sigue siendo el total de medios corazones de alma (espora + negros): al bajarlo se
  // pierden desde el final, como en el original, y si se rompe un corazón negro entero, explota.
  Object.defineProperty(j, "esporas", {
    get() { return this.almas.length; },
    set(v) {
      v = Math.max(0, Math.round(v));
      while (this.almas.length > v) { const i = this.almas.length - 1, t = this.almas.pop(); if (t === "n" && i % 2 === 0) romperNegro(this); }
      while (this.almas.length < v) this.almas.push("e");
    },
  });
  recalcular(j);
  return j;
}
/** Un corazón negro que se rompe: el Necronomicón, 40 a todos (80 con la página perdida; wiki). */
function romperNegro(j) {
  if (!J || !J.enemigos) return;
  const dano = j.f && j.f.pagina ? 80 : 40;
  J.destello = Math.max(J.destello, 6); temblar(8); SFX.negro();
  for (const e of J.enemigos.slice()) danarEnemigo(e, dano);
}

// ── las cuentas (las del original, pasadas a 60 Hz). No se tocan a mano: cada objeto DECLARA lo
//    que suma (st), lo que multiplica y qué banderas trae (f), y recalcular() rearma todo desde la
//    lista. Así los objetos se combinan solos, como en el original, y sacar uno (el dado) no deja
//    restos. Las fórmulas y el orden de los multiplicadores son los de la wiki (Repentance). ──
const MULTIPLICA = new Set(["mult", "frMult", "alcMult", "velLagMult", "tam"]);
/** El arma principal: gana la de más prioridad; las demás se vuelven "sabores" de esa. */
const PRIORIDAD_ARMA = ["epico", "cuchillo", "feto", "anillo", "ludovico", "rayo", "laser"];
function fuentesDe(j) {
  const out = [];
  for (const id of j.objetos) if (OBJETOS[id]) out.push(OBJETOS[id]);
  if (j.activo && OBJETOS[j.activo.id] && OBJETOS[j.activo.id].f) out.push({ f: OBJETOS[j.activo.id].f });
  if (j.baratija && BARATIJAS[j.baratija]) out.push(BARATIJAS[j.baratija]);
  for (const t of j.transf) if (TRANSFORMACIONES[t]) out.push(TRANSFORMACIONES[t]);
  if (j.salaF.length) out.push({ f: j.salaF });   // lo que dan los activos sólo por esta sala (libro santo, telepatía…)
  return out;
}
function recalcular(j) {
  const s = { dano: 0, plano: 0, mult: 1, lag: 0, fr: 0, frMult: 1, alc: 0, alcMult: 1, velLag: 1, velLagMult: 1, vel: 1, suerte: 0, tam: 1 };
  const f = {};
  for (const d of fuentesDe(j)) {
    if (d.st) for (const k in d.st) { if (MULTIPLICA.has(k)) s[k] *= d.st[k]; else s[k] += d.st[k]; }
    if (d.f) for (const x of d.f) f[x] = (f[x] || 0) + 1;
  }
  for (const k in j.extra) s[k] += j.extra[k];
  j.f = f;
  j.arma = PRIORIDAD_ARMA.find((a) => f[a]) || "lagrima";

  // cuántas lágrimas por disparo: el tercer ojo da 3, la araña 4, juntos 5; los lentes suman una
  let n = 1;
  if (f.cuadruple) n = 4 + (f.cuadruple - 1);
  if (f.triple) n = n > 1 ? n + 1 : 3 + (f.triple - 1);
  if (f.veinte) n += 1;
  j.n = Math.min(16, n);

  // ── la cadencia: FR = (30 / (retardo + 1) + S) · P ──
  const L = s.lag;
  let d = L >= 0 ? 16 - 6 * Math.sqrt(L * 1.3 + 1) : L > -0.77 ? 16 - 6 * Math.sqrt(L * 1.3 + 1) - 6 * L : 16 - 6 * L;
  d = Math.max(5, d);
  let P = s.frMult;
  // las bajas de las armas pesadas no se apilan: van por prioridad (feto > rayo; el pulmón y el jarabe sí se apilan entre ellos)
  if (f.feto && f.pulmon) P /= 4.3; else if (f.feto) P *= 0.4; else if (f.rayo) P /= 3; else { if (f.pulmon) P /= 4.3; if (f.ipecac) P /= 3; }
  // el tercer ojo, la araña y el cíclope tampoco se apilan (vale la peor), y los lentes las anulan
  if (!f.veinte) { if (f.cuadruple || f.polifemo) P *= 0.42; else if (f.triple) P *= 0.51; }
  let fr = (30 / (d + 1) + s.fr) * Math.min(1, P);
  // el coágulo rehace el retardo (×2 + 11) antes de los multiplicadores que suben
  if (f.hemo) fr = 30 / ((30 / fr - 1) * 2 + 11 + 1);
  if (P > 1) fr *= P;
  if (f.almendra) fr *= 4; else if (f.soja) fr *= 5.5;
  j.fr = lim(fr, 0.2, 60);

  // ── el daño: (3,5 · √(1 + 1,2 · D) + plano) · multiplicadores ──
  let D = 3.5 * Math.sqrt(1 + 1.2 * Math.max(0, s.dano)) + s.plano;
  D *= s.mult;
  if (f.x15) D *= 1.5;                          // el hongo gigante y la cabeza de grillo: el ×1,5 no se apila
  if (f.x23) D *= 2.3;
  if (f.polifemo) D = j.n > 1 ? D + 5 : (D + 4) * 2;
  if (f.veinte) D *= 0.8;
  if (f.almendra) D *= 0.3; else if (f.soja) D *= 0.2;
  if (f.hemo) D = (D + 1) * 1.5;
  if (f.ipecac) D += 40;                         // el jarabe suma 40 que no multiplica nada
  j.danoBase = Math.max(0.5, D);

  let alc = (6.5 + s.alc) * s.alcMult, vl = s.velLag * s.velLagMult;
  if (f.ipecac) { alc *= 0.8; vl *= 0.8; }
  if (f.hemo) alc *= 0.8;
  j.alcance = Math.max(1, alc); j.velLag = lim(vl, 0.6, 2.2); j.vel = lim(s.vel, 0.4, 2); j.suerte = s.suerte;
  j.tam = s.tam * (f.ipecac ? 0.6 : 1) * (f.polifemo ? 1.6 : 1) * (f.proptosis ? 2 : 1) * (f.soja && !f.almendra ? 0.7 : 1);
  j.vuela = !!f.vuela;
}
const danoDe = (j) => (j.danoBase + j.danoSala) * (j.f.ojoMuerto ? 1 + 0.25 * Math.min(4, j.ojoMuerto) : 1);
const lagrimasPorSeg = (j) => j.fr;
const cuadrosEntreLagrimas = (j) => 60 / j.fr;
const velDe = (j) => j.vel;
const alcancePx = (j) => j.alcance * T;
const radioLagrima = (j) => lim(Math.round((2 + Math.sqrt(Math.min(danoDe(j), 60)) * 0.9) * j.tam), 2, 12);
/** Probabilidad de los efectos por suerte (fórmulas de la wiki). */
const chance = {
  veneno: (L) => 1 / Math.max(1, 4 - Math.floor(L * 0.25)),
  lento: (L) => 1 / Math.max(1, 4 - Math.floor(L / 5)),
  miedo: (L) => 1 / Math.max(1, 3 - Math.floor(L * 0.1)),
  piedra: (L) => Math.min(0.5, 1 / Math.max(1, 5 - Math.floor(L * 0.15))),
  diente: (L) => 1 / Math.max(1, 10 - Math.floor(L)),
  aguja: (L) => Math.min(0.25, 1 / Math.max(1, 30 - Math.floor(L * 2))),
  santa: (L) => Math.min(0.5, 1 / Math.max(1, 10 - Math.floor(L * 0.9))),
  estalla: (L) => 1 / Math.max(1, 10 - Math.floor(L * 0.7)),
};

function vidaTotal(j) { return j.vida + j.esporas; }
function curar(j, medios) { const antes = j.vida; j.vida = Math.min(j.cont, j.vida + medios); return j.vida > antes; }
/** Corazones negros: se suman al final; si ya no hay lugar, convierten los de espora de arriba (wiki). */
function darNegras(j, medios) {
  const tope = 24 - j.cont;
  let dio = false;
  for (let k = 0; k < medios; k++) {
    if (j.almas.length < tope) { j.almas.push("n"); dio = true; continue; }
    const i = j.almas.lastIndexOf("e"); if (i < 0) break; j.almas[i] = "n"; dio = true;
  }
  return dio;
}
function darEsporas(j, medios) { const tope = 24 - j.cont; if (j.esporas >= tope) return false; j.esporas = Math.min(tope, j.esporas + medios); return true; }
function sumarContenedor(j, n) { j.cont = lim(j.cont + n * 2, 0, 24); j.esporas = Math.min(j.esporas, 24 - j.cont); j.vida = Math.min(j.vida, j.cont); }

function herirJugador(j, medios, causa, dibujo) {
  if (j.inv > 0 || j.muerto || J.estado !== "juego") return false;
  if (j.escudo > 0) return false;
  if (J.sala.tipo === "jefe") j.golpesJefe++;
  j.golpesPiso++;
  let resto = medios;
  if (j.esporas > 0) { const q = Math.min(j.esporas, resto); j.esporas -= q; resto -= q; }
  if (resto > 0) j.vida = Math.max(0, j.vida - resto);
  j.inv = 60; j.gesto = 3; j.tGesto = 22;
  temblar(6);
  SFX.dolor();
  sangrar(j.x, j.y - 8, 6, PAL.sangre);
  alHerir(j);
  if (vidaTotal(j) <= 0) {
    if (j.vidasExtra > 0) { revivir(j); return true; }
    j.muerto = true; j.tMuerte = 0; J.causa = causa || "?"; J.causaSpr = dibujo || null; SFX.muere(); Musica.poner("muerte");
  }
  return true;
}
/** Lo que pasa cuando a Shumio le pegan (baratijas, bebé araña, la página perdida…). */
function alHerir(j) {
  const f = j.f;
  if (f.monedaTragada) soltarPremio(j.x, j.y, "moneda");
  if (f.pagina) { J.destello = 4; for (const e of J.enemigos.slice()) danarEnemigo(e, 80); }
  if (f.aranaHerido) for (let i = 0; i < A.ent(3, 5); i++) J.familiares.push(moscaAzul(j.x, j.y, "arana"));
  if (f.pajaro && !J.familiares.some((m) => m.tipo === "pajaro")) J.familiares.push({ tipo: "pajaro", x: j.x, y: j.y - 20, t: 0 });
}
/** Una vida de más (el gato muerto, el hongo 1UP): vuelve con un corazón. */
function revivir(j) {
  j.vidasExtra--;
  j.cont = Math.max(2, Math.min(j.cont, 2)); j.vida = 2; j.inv = 120;
  rotulo("¡OTRA VIDA!", j.vidasExtra ? `Te quedan ${j.vidasExtra}` : "");
  SFX.objeto(); J.destello = 6;
}

function actualizarJugador(j) {
  if (j.muerto) { j.tMuerte++; return; }
  if (j.inv > 0) j.inv--;
  if (j.tGesto > 0 && --j.tGesto === 0) j.gesto = 0;
  if (j.tSostiene > 0 && --j.tSostiene === 0 && j.reaccion) { j.gesto = j.reaccion; j.tGesto = 36; j.reaccion = 0; }
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

  // llorar: cada arma se dispara a su manera (12b-armas)
  actualizarArma(j, quieto);
  if (j.f.bob && v > 0.3 && J.t % 5 === 0) dejarBaba(j.x, j.y + 2, 7, 150, false, "amiga");
  if (j.f.virus || j.f.tacos) for (const e of J.enemigos) if (blanco_(e) && dist(e.x, e.y, j.x, j.y) < e.r + 7) {
    if (J.t % 5 === 0) danarEnemigo(e, j.f.tacos ? 12 : 0.5);
    if (j.f.virus) e.veneno = { t: 80, dano: 2 };
  }
  if (j.escudo > 0) j.escudo--;

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

function tirarBomba(j) {
  if (j.bombas <= 0 || j.muerto) return;
  j.bombas--;
  J.bombas.push(nuevaBomba(j, j.x, j.y + 2, j.vx * 0.3, j.vy * 0.3, 90));
  SFX.mecha();
}
/** Una bomba con lo que le agregan los objetos (gorda, podrida, la del feto…). */
function nuevaBomba(j, x, y, vx, vy, t, o = {}) {
  return { x, y, t, vx, vy, r: 5, gorda: !!j.f.bombaGorda, veneno: !!j.f.bombaPodrida, dano: o.dano, feto: !!o.feto, contacto: !!o.contacto, danoJug: o.danoJug ?? 2, rayos: o.rayos, lasers: o.lasers, segunda: o.segunda };
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
  if (j.escudo > 0) { g.globalAlpha = 0.35 + 0.15 * Math.sin(J.t * 0.3); g.drawImage(aro(15, "rgba(20,10,30,0.5)", "rgba(200,170,255,0.8)"), Math.round(j.x) - 15, Math.round(j.y) - 26); g.globalAlpha = 1; }
  const z = Math.round(j.vuela ? 5 + Math.sin(J.t * 0.08) * 1.5 : 0);
  g.drawImage(sombra(7, 3), X - 7, Y + 2);
  if (j.vuela) { const a = alitaSpr((J.t >> 2) & 1); g.drawImage(a, X - 15, Y - 22 - z); g.drawImage(espejado(a), X + 3, Y - 22 - z); }
  // levantando algo: de frente, brazos arriba y el objeto sobre las manos (0,8 s, como el original).
  // Los primeros cuadros se estira hacia arriba y vuelve (el "¡ta-daa!").
  if (j.tSostiene > 0 && j.sostiene) {
    const e = LEVANTA - j.tSostiene, k = 1 + 0.16 * Math.max(0, 1 - e / 7) - 0.05 * Math.max(0, Math.min(1, (e - 7) / 3)) * Math.max(0, 1 - (e - 10) / 4);
    g.save(); g.translate(X, Y + 3 - z); g.scale(2 - k, k); g.translate(-X, -(Y + 3));
    g.drawImage(s.levanta, X - 7, Y - 8);
    g.drawImage(s.cab.frente[j.gesto === 3 ? 3 : 0], X - 11, Y - 24);
    g.drawImage(s.brazos, X - 15, Y - 30);
    g.drawImage(j.sostiene, X - Math.round(j.sostiene.width / 2), Y - 28 - j.sostiene.height + 2);
    g.restore();
    return;
  }
  const mov = Math.hypot(j.vx, j.vy) > 0.3;
  const kPaso = mov ? Math.floor(j.paso / 7) % 4 : 0;
  const vc = j.mirarCue === ARRIBA ? "espalda" : j.mirarCue === ABAJO ? "frente" : j.mirarCue === DERECHA ? "lado" : "ladoI";
  const cue = s.cue[vc][kPaso];
  // la cabeza baja un píxel al soltar la lágrima (el "puchero")
  const cab = s.cab[VISTA_CAB[j.mirar]][j.gesto], baja = j.gesto === 1 ? 1 : 0;
  const bob = mov && (kPaso === 1 || kPaso === 3) ? 1 : 0;
  g.drawImage(cue, X - 7, Y - 8 - z);
  g.drawImage(cab, X - 11, Y - 24 - z + baja + bob);
}
/** Cuánto dura levantar un objeto: 0,8 s (medido en el video, 12 cuadros a 15 por segundo). */
const LEVANTA = 48;
/** Shumio levanta algo sobre la cabeza (un objeto, una cápsula, una baratija). */
function levantar(j, spr, dura = LEVANTA) { j.sostiene = spr; j.tSostiene = dura; j.mirar = ABAJO; j.gesto = 0; }

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

function alitaSpr(k) {
  return hornear(`alita${k}`, () => {
    const p = new Pix(12, 12);
    p.bola(6, k ? 6 : 5, 5, k ? 4 : 5, ["#3a3226", "#6e6048", "#a8966e", "#d6c69a"], { luz: [-0.2, -0.8, 0.5] });
    p.bola(5, 5, 1.4, 1.4, ["#1a1410", "#3a3226"], {});
    for (let y = 0; y < 12; y++) for (let x = 9; x < 12; x++) p.borrar(x, y);
    p.contorno(AUTO);
    return p.canvas();
  });
}
