// ─────────────────────────────────────────────────────────────────────────────
// LA PARTIDA Y LA ARENA (arena.lua del original): 25 niveles. Cada nivel cuenta 3, 2, 1 y suelta
// oleadas de 8 + 2·(oleada−1) enemigos cada vez que la arena queda vacía; los niveles 6, 12, 18, 24 y
// 25 son de jefe (el jefe más tandas de 8 + nivel/2 cuando queda solo). Al limpiar: oro del nivel +
// interés (1 cada 5 de oro, máximo 5; el mercader suma 1 cada 10, máximo 10). Cada 3 niveles se elige
// un objeto de cuatro (hasta 8). Se empieza con 3 de oro y la tienda vacía.
// ─────────────────────────────────────────────────────────────────────────────

let J = null;                      // la partida: nivel, oro, plantel, objetos, tienda
function nuevaPartida(ng = G.ng || 0) {
  J = { nivel: 1, ng, oro: 3, plantel: [], objetos: [], tiendaNivel: 1, tiendaXp: 0, pool: Object.keys(OBJETOS), bloqueo: null, maxU: lim(7 + ng, 7, 12), cartas: null, stats: { muertes: 0, dano: 0, oroTotal: 3 } };
  G.record.partidas++; guardar();
  guardarPartida();
  irA("tienda");
}
function guardarPartida() { if (!J) return; G.partida = JSON.parse(JSON.stringify(J)); guardar(); }
function seguirPartida() { if (!G.partida) return false; J = Object.assign({ stats: { muertes: 0, dano: 0, oroTotal: 0 } }, JSON.parse(JSON.stringify(G.partida))); irA("tienda"); return true; }

function empezarNivel() {
  M = { t: 0, vib: [], rastro: [], ene: [], proy: [], proyE: [], dots: [], inv: [], pick: [], bichos: [], fx: [], marcas: [], timers: [], orbesPsi: [],
    fase: "cuenta", cuenta: 3, cuentaT: 0, oleada: 0, maxOleadas: OLEADAS[J.nivel] || 5, generando: 0, jefeNivel: !!JEFES[J.nivel], jefe: null,
    temblor: 0, lentoT: 0, danoHecho: 0, danoRecibido: 0, muertes: 0, oroJuntado: 0, giroDer: 0, giroIzq: 0, vel: 75, rumbo: 0, buf: {}, obj: {}, esperaOla: 0, finT: 0, pausa: false,
    camX: 0, camY: 0 };
  for (const o of J.objetos) M.obj[o.k] = o.lvl;
  M.clases = nivelesDeClase(J.plantel.map((p) => p.id));
  armarVibora(J.plantel);
  prepararHeroes();
  tocarTema(M.jefeNivel ? "jefe" : "arena");
}

function pasoArena(dt) {
  if (M.pausa) return;
  if (M.lentoT > 0) { M.lentoT -= dt; dt *= 0.35; }
  M.t += dt;
  const giro = M.fase === "muerto" || M.fase === "ganado" ? 0 : leerGiro();
  if (M.fase !== "muerto") moverVibora(dt, giro);
  pasoTimers(dt);
  // la cuenta regresiva (con el "clic" del original en cada número)
  if (M.fase === "cuenta") {
    M.cuentaT += dt;
    if (M.cuentaT >= 1) { M.cuentaT -= 1; M.cuenta--; if (M.cuenta > 0) sfx("cuenta", 0.6); else { sfx("arranca", 0.7); temblor(3); M.fase = "pelea"; if (M.jefeNivel) aparecerJefe(); } }
  } else if (M.fase === "pelea") {
    if (M.jefeNivel) {
      const jefeVivo = M.jefe && !M.jefe.muerto, resto = M.ene.filter((e) => !e.muerto && e !== M.jefe).length;
      if (M.jefe && jefeVivo && resto === 0 && M.generando === 0 && M.esperaOla <= 0) { M.esperaOla = 0.5; setTimeoutJuego(0.5, () => { M.esperaOla = 0; if (M.fase === "pelea" && M.jefe && !M.jefe.muerto) soltarOleada(8 + Math.floor(J.nivel / 2)); }); }
      if (M.jefe && !jefeVivo && !hayEnemigos() && M.generando === 0) nivelLimpio();
    } else if (!hayEnemigos() && M.generando === 0 && M.esperaOla <= 0) {
      if (M.oleada >= M.maxOleadas) nivelLimpio();
      else { M.oleada++; M.esperaOla = 0.5; M.golpeOla = 0.3; setTimeoutJuego(0.5, () => { M.esperaOla = 0; soltarOleada(8 + (M.oleada - 1) * 2); }); }
    }
  }
  if (M.golpeOla > 0) M.golpeOla -= dt;
  if (M.fase === "pelea" || M.fase === "limpio" || M.fase === "cuenta") pasoHeroes(dt);
  pasoEnemigos(dt); pasoTiros(dt); pasoTirosEnemigos(dt); pasoDots(dt); pasoInv(dt); pasoBichos(dt); pasoRecoger(dt); pasoFx(dt);
  for (let i = M.marcas.length - 1; i >= 0; i--) { M.marcas[i].t += dt; if (M.marcas[i].t > M.marcas[i].dur) M.marcas.splice(i, 1); }
  // una cámara que se asoma un poco para donde va la víbora (como el original)
  const cab = lider();
  if (cab) { M.camX = lerp(M.camX, Math.cos(M.rumbo) * 6, 2 * dt); M.camY = lerp(M.camY, Math.sin(M.rumbo) * 3, 2 * dt); }
  // morir
  if (M.fase !== "muerto" && !heroesVivos().length) { M.fase = "muerto"; M.finT = 0; tocarTema("fin", { bucle: false }); sfx("pierde", 0.6); G.record.nivel = Math.max(G.record.nivel, J.nivel); G.partida = null; guardar(); }
  if (M.fase === "muerto") { M.finT += dt; if (M.finT > 2) irA("fin"); }
  if (M.fase === "limpio") {
    M.finT += dt;
    if (M.finT > 3) {
      if (J.nivel >= 25) { irA("ganaste"); return; }
      if (J.nivel % 3 === 0 && J.objetos.length < 8 && J.pool.length) irA("objeto");
      else pasarDeNivel();
    }
  }
}
function aparecerJefe() {
  const p = { x: AR.cx, y: AR.cy }, c = lider();
  if (c && dist(c, p) < 60) p.y = c.y < AR.cy ? AR.y2 - 40 : AR.y1 + 40;
  M.marcas.push({ x: p.x, y: p.y, t: 0, dur: 1.125 });
  sfx("jefe", 0.7); temblor(4);
  M.generando++;
  setTimeoutJuego(1.125, () => { crearEnemigo(p.x, p.y, null, JEFES[J.nivel]); M.generando--; golpeFx(p.x, p.y, 20); for (let i = 0; i < 12; i++) particula(p.x, p.y, COLOR_JEFE[JEFES[J.nivel]], 1.4); });
}
function nivelLimpio() {
  if (M.fase !== "pelea") return;
  M.fase = "limpio"; M.finT = 0;
  sfx("subeNivel", 0.7);
  // el oro: el del nivel + el interés (+ el del mercader)
  const [a, b] = ORO_NIVEL[J.nivel] || [10, 10], gan = A.ent(a, b);
  const merc = J.plantel.some((p) => p.id === "merchant");
  const inter = Math.min(Math.floor(J.oro / 5), 5) + (merc ? Math.min(Math.floor(J.oro / 10), 10) : 0);
  M.resumen = { gan, inter, junt: M.oroJuntado };
  J.oro += gan + inter; J.stats.oroTotal += gan + inter + M.oroJuntado;
  J.stats.muertes += M.muertes; J.stats.dano += M.danoHecho;
  // lo que quedó en el piso se junta solo
  for (const p of M.pick) { if (p.tipo === "oro") { J.oro++; M.resumen.junt++; } }
  M.pick = [];
  for (const e of M.ene) e.muerto = true;
  M.proyE = [];
}
function pasarDeNivel() {
  J.nivel++; J.cartas = null;
  G.record.nivel = Math.max(G.record.nivel, J.nivel);
  guardarPartida();
  irA("tienda");
}
