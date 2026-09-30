// ─────────────────────────────────────────────────────────────────────────────
// EL JUGADOR Y SUS NÚMEROS: la partida (J), las estadísticas que salen de sumar personaje +
// mejoras de la tienda + pasivos + bonus por nivel (como el original: todo se recalcula de cero,
// así nunca se desincroniza), y los parámetros finales de cada arma.
// ─────────────────────────────────────────────────────────────────────────────

let J = null;       // la partida en curso

function nuevaPartida(pj, esc, semilla = (Math.random() * 1e9) | 0) {
  rnd = mulberry(semilla);
  const P = PERSONAJES[pj];
  J = {
    semilla, pj, esc, E: ESCENARIOS[esc], t: 0, cuadro: 0, fin: false, parcas: 0,
    duracion: (G.op.duracion || 30) * 60,
    jug: { x: 0, y: 0, vx: 0, vy: 0, mirX: 1, mirY: 0, izq: false, vida: 1, inv: 0, paso: 0, moviendo: false, golpe: 0, curado: 0, ultCritCura: -9 },
    enemigos: [], proys: [], zonas: [], gemas: [], cosas: [], efectos: [], numeros: [], rayos: [],
    kills: 0, oro: 0, nivel: 1, xp: 0, xpSig: xpPara(1), pendientes: 0,
    armas: [], pasivos: [], desterrados: new Set(), evolucionesHechas: [],
    rerolls: G.mejoras.rerolls ? G.mejoras.rerolls * 2 : 0, saltos: G.mejoras.saltos ? G.mejoras.saltos * 2 : 0, destierros: G.mejoras.destierros ? G.mejoras.destierros * 2 : 0,
    revividas: 0, congelado: 0, fuegoBoca: 0, cam: { x: -W / 2, y: -H / 2 }, temblor: 0, destello: 0,
    spawnT: 0, minuto: -1, eventos: [], brasT: 0, cofres: 0, modal: null, cartel: null, rojaGrande: null, sanado: 0,
  };
  darArma(P.arma);
  recalcular();
  J.jug.vida = J.st.vidaMax;
  // arrancan unos pocos (el original pone 10 al empezar) para que el primer segundo ya tenga acción
  for (let i = 0; i < 10; i++) aparecer(J.E.oleadas[0].e[0]);
  return J;
}

const ST_BASE = { vidaMax: 100, recup: 0, armadura: 0, velMov: 1, poder: 1, area: 1, vel: 1, dur: 1, cant: 0, cd: 1, suerte: 1, crec: 1, codicia: 1, maldicion: 1, revivir: 0 };
/** Recalcula todo de cero. Lo multiplicativo (vida, imán) se multiplica; lo demás se suma. */
function recalcular() {
  const P = PERSONAJES[J.pj], st = { ...ST_BASE };
  let vidaMult = 1, imanMult = 1;
  const sumar = (o, k = 1) => { for (const [c, v] of Object.entries(o)) { if (c === "vidaMult") vidaMult *= 1 + v * k; else if (c === "imanMult") imanMult *= 1 + v * k; else if (c === "vidaMax") st.vidaMax += v * k; else st[c] = (st[c] || 0) + v * k; } };
  sumar(P.st);
  for (const m of MEJORAS) if (G.mejoras[m[0]] && !["rerolls", "saltos", "destierros"].includes(m[0])) sumar(m[4], G.mejoras[m[0]]);
  for (const p of J.pasivos) if (p.k !== "orbe") sumar(PASIVOS[p.k].st, p.nivel);
  sumar(P.crece(J.nivel));
  // lo temporal del personaje (Perla, Clementina) se apaga en el primer minuto de partida
  if (P.temp) sumar(P.temp, Math.max(0, 1 - J.t / 60));
  st.vidaMax = Math.round(st.vidaMax * vidaMult);
  const orbe = J.pasivos.find((p) => p.k === "orbe");
  st.iman = 30 * imanMult * IMAN_ORBE[orbe ? orbe.nivel : 0];
  st.cd = Math.max(0.1, st.cd);
  st.suerte = Math.max(0.1, st.suerte + (J.trebolitos || 0) * 0.1);
  J.st = st;
  if (J.jug.vida > st.vidaMax) J.jug.vida = st.vidaMax;
}
/** Los parámetros finales de un arma de la partida (base + niveles, por las estadísticas). */
function paramsArma(a) {
  const def = EVOS[a.k] || ARMAS[a.k], b = { ...def.b };
  if (!EVOS[a.k]) for (let i = 0; i < a.nivel - 1; i++) for (const [c, v] of Object.entries(def.nv[i])) b[c] = (b[c] || 0) + v;
  const st = J.st;
  return { ...b, dano: b.dano * st.poder, cd: b.cd * st.cd, cant: b.cant + st.cant, area: b.area * st.area, vel: b.vel * st.vel, dur: b.dur * st.dur };
}
const esEvo = (k) => !!EVOS[k];
const nombreDe = (k) => L((ARMAS[k] || EVOS[k] || PASIVOS[k] || {}).n);
const maxNivel = (k) => (ARMAS[k] ? 8 : EVOS[k] ? 1 : PASIVOS[k].max);

function darArma(k) {
  const ya = J.armas.find((a) => a.k === k);
  if (ya) { ya.nivel++; return ya; }
  const a = { k, nivel: 1, t: 0.2, cola: 0, tInt: 0, dano: 0, desde: J.t, zona: null };
  J.armas.push(a); return a;
}
function darPasivo(k) {
  const ya = J.pasivos.find((p) => p.k === k);
  if (ya) ya.nivel++; else J.pasivos.push({ k, nivel: 1 });
  recalcular();
}
/** Evoluciona: el arma base se reemplaza por la evolución en el mismo lugar. */
function evolucionar(k) {
  const e = EVOS[k], a = J.armas.find((x) => x.k === e.de);
  if (!a) return;
  a.k = k; a.nivel = 1; a.t = 0; a.cola = 0;
  J.evolucionesHechas.push(k);
}
/** Qué evoluciones se pueden hacer ahora: arma en nivel 8 + su pasivo (cualquier nivel). */
function evolucionesPosibles() {
  const out = [];
  for (const a of J.armas) { const d = ARMAS[a.k]; if (d && a.nivel >= 8 && J.pasivos.some((p) => p.k === d.evo[0]) && !J.desterrados.has(d.evo[1])) out.push(d.evo[1]); }
  return out;
}

function curar(n) {
  const j = J.jug, antes = j.vida;
  // cada 0,1 de recuperación da +10% de curación a lo que se levanta (wiki)
  j.vida = Math.min(J.st.vidaMax, j.vida + n);
  const cura = j.vida - antes;
  J.sanado += cura;
  if (cura >= 1) numero(j.x, j.y - 16, "+" + Math.round(cura), "#60ff60");
}
function herirJugador(dano) {
  const j = J.jug;
  if (j.inv > 0 || J.fin) return;
  const d = Math.max(1, dano - J.st.armadura);
  j.vida -= d; j.inv = 0.24; j.golpe = 0.2;           // 240 ms de invulnerable: el número de la wiki
  sfx("dolor", 0.7);
  if (G.op.destellos) J.destello = Math.max(J.destello, 0.12);
  // Sin Mañana: estalla cuando te pegan
  for (const a of J.armas) if (a.k === "sinmanana") explosion(j.x, j.y, 40 * paramsArma(a).area, paramsArma(a).dano * (1 + J.st.armadura * 0.1), a);
  if (j.vida <= 0) morir();
}
function morir() {
  const j = J.jug;
  if (J.revividas < J.st.revivir) {
    J.revividas++; j.vida = J.st.vidaMax * 0.5; j.inv = 2.5;
    J.cartel = { txt: TX.revivir, t: 2 };
    for (const e of J.enemigos) if (!e.d.parca && Math.hypot(e.x - j.x, e.y - j.y) < 120) golpear(e, 9999, 3, null, e.x - j.x, e.y - j.y);
    sfx("rosario"); return;
  }
  j.vida = 0; J.fin = true; J.finT = 0; J.ganaste = J.t >= J.duracion;
  pararTema(); sfx("morir");
}
