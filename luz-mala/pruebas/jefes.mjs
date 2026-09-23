// Los tres jefes con la física del juego, en Node: que usen todos sus ataques,
// que lleguen a todas sus fases, que no se traben en un estado, que no se
// salgan de la arena y que, al morir, avisen (jefeFin).
// También un "jugador torpe": salta cada tanto y golpea cuando lo tiene cerca.
// Si ése le gana con la vida del juego, la pelea se puede ganar.
//     node luz-mala/pruebas/jefes.mjs
import { cargar } from "./cargar.mjs";
const L = cargar();
const DT = 1 / 60;
let mal = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) mal++; };

const ARENAS = { torito: "A1", viuda: "A2", reina: "A3" };
const ATAQUES = { torito: ["carga", "salto", "cornada", "mareado"], viuda: ["baja", "escupe", "crias", "suelo"], reina: ["oleada", "acido", "golpe", "embestida"] };
const FASES = { torito: 2, viuda: 2, reina: 3 };

function arena(tipo, invencible) {
  const sala = L.SALA_POR_ID[ARENAS[tipo]];
  const m = L.crearMundoLM(sala, { habil: { aleteo: 1, resina: 1 } });
  m.rompibles = m.rompibles.filter((r) => !r.compuerta);
  m.asist = { invencible };
  m.p.x = 8 * 8; m.p.y = m.spawn ? m.spawn.y : 16;
  /* parada en el piso de la arena */
  for (let y = 1; y < m.h; y++) if (sala.mapa[y][9] === "#" && sala.mapa[y - 1][9] !== "#") { m.p.y = y * 8 - L.LF.ALTO; break; }
  m.jefe = L.crearJefe(tipo, m);
  return m;
}
function paso(m, inp) {
  L.pasarChispa(m, inp); L.pasarBichos(m); L.pasarBalas(m); L.pasarJefe(m); L.pasarAmbar(m);
  const ev = m.eventos.slice(); m.eventos.length = 0; m.congelar = 0;
  return ev;
}

/* 1. el jefe solo, contra una Chispa invencible que no se mueve: se le baja la vida de a poco */
for (const tipo of Object.keys(ARENAS)) {
  const m = arena(tipo, true), j = m.jefe;
  const vistos = new Set(), largo = {};
  let t = 0, fin = false, fuera = false, nan = false, antes = j.est, desde = 0, trabado = null;
  const NADA = { x: 0, y: 0, salto: false, saltoE: false, golpeE: false, dashE: false, curar: false };
  while (t < 120 && !fin) {
    const ev = paso(m, NADA);
    t += DT;
    if (ev.some((e) => e.t === "jefeFin")) fin = true;
    vistos.add(j.est.replace("Prep", ""));
    if (j.est !== antes) { antes = j.est; desde = t; }
    if (t - desde > 7 && !j.muerto && !trabado) trabado = j.est;
    if (!isFinite(j.x) || !isFinite(j.y)) nan = true;
    if (j.x < -4 || j.x + j.w > m.w * 8 + 4 || j.y < -4 || j.y + j.h > m.h * 8 + 4) fuera = true;
    /* un golpe cada 0,9 s pasada la presentación */
    if (j.est !== "presenta" && !j.muerto && Math.round(t * 60) % 54 === 0) L.danarJefe(m, j, 1);
  }
  const faltan = ATAQUES[tipo].filter((a) => !vistos.has(a));
  ver(!faltan.length, `${tipo}: usa todos sus ataques${faltan.length ? " (falta " + faltan.join(", ") + ")" : ""}`);
  ver(j.fase === FASES[tipo], `${tipo}: llega a la fase ${FASES[tipo]} (llegó a ${j.fase})`);
  ver(!trabado, `${tipo}: no se traba en un estado${trabado ? " (se quedó en " + trabado + ")" : ""}`);
  ver(!fuera && !nan, `${tipo}: no se sale de la arena`);
  ver(fin, `${tipo}: al morir avisa que terminó (${t.toFixed(1)} s)`);
}

/* 2. el jugador torpe: juega como una persona que aprendió lo básico de cada
      jefe (saltar la embestida, pegarle cuando queda mareado, ponerse abajo de
      la Viuda y pegar para arriba), pero con reflejos flojos: la mitad de las
      veces que podría golpear, no golpea. Vida 5, sin compras. */
function torpe(m, rnd) {
  const p = m.p, j = m.jefe, cx = p.x + 4, cy = p.y + 6;
  const jx = j.x + j.w / 2, dx = jx - cx, dist = Math.abs(dx), hacia = Math.sign(dx) || 1;
  const inp = { x: 0, y: 0, salto: false, saltoE: false, golpeE: false, dashE: false, curar: false };
  const saltar = () => { if (p.enSuelo || p.coyote > 0) { inp.saltoE = true; inp.salto = true; } };
  const alcance = j.w / 2 + 10;
  const acercarse = () => { if (dist > alcance + 3) inp.x = hacia; else if (dist < alcance - 3) inp.x = -hacia; };
  const pegar = () => { if (dist < alcance + 12 && Math.abs(j.y + j.h / 2 - cy) < j.h / 2 + 10 && rnd() < 0.5) { inp.golpeE = true; inp.x = 0; p.dir = hacia; } };
  const huir = () => { inp.x = -hacia; if (L.paredLM(m, p, inp.x)) { inp.x = hacia; saltar(); } };
  const e = j.est;
  if (j.tipo === 'torito') {
    if (e === 'cargaPrep') { inp.x = 0; }
    else if (e === 'carga') { if (dist < 44 && Math.sign(j.vx) === hacia * -1) saltar(); }
    else if (e === 'saltoPrep' || e === 'salto') huir();
    else if (e === 'cornadaPrep' || e === 'cornada') huir();
    else { acercarse(); pegar(); }
  } else if (j.tipo === 'viuda') {
    if (e === 'bajaPrep' || e === 'baja') huir();
    else if (e === 'suelo') { acercarse(); pegar(); }
    else if (e === 'arriba' || e === 'sube' || e === 'escupePrep' || e === 'criasPrep') {
      /* abajo de ella, saltar y pegar para arriba */
      if (dist > 5) inp.x = hacia;
      if (dist < 12) saltar();
      if (!p.enSuelo && j.y + j.h > p.y - 20 && dist < 16) { inp.golpeE = rnd() < 0.5; inp.y = -1; }
    }
  } else {
    if (e === 'embestidaPrep' || e === 'embestida') { if (dist < 80) saltar(); inp.x = hacia; }
    else if (e === 'acidoPrep') huir();
    else { acercarse(); pegar(); }
  }
  /* lo de siempre: saltar las ondas, esquivar lo que vuela, matar a los chicos */
  const ondas = m.balas.filter((b) => b.tipo === 'onda' && Math.abs(b.x - cx) < 30 && Math.sign(cx - b.x) === Math.sign(b.vx));
  if (ondas.length) saltar();
  const balas = m.balas.filter((b) => b.tipo !== 'onda' && Math.hypot(b.x - cx, b.y - cy) < 34);
  if (balas.length && rnd() < 0.25) { inp.x = Math.sign(cx - balas[0].x) || 1; if (rnd() < 0.2) inp.dashE = true; }
  const bicho = m.bichos.filter((b) => !b.muerto).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
  if (bicho && Math.abs(bicho.x + bicho.w / 2 - cx) < 24 && Math.abs(bicho.y + bicho.h / 2 - cy) < 14 && rnd() < 0.5) { inp.golpeE = true; inp.y = 0; inp.x = 0; p.dir = Math.sign(bicho.x + bicho.w / 2 - cx) || p.dir; }
  if (!p.enSuelo && p.vy < 0) inp.salto = true;
  if (p.luz >= 33 && p.vida <= 3 && p.enSuelo && dist > 70 && !balas.length && !ondas.length) { inp.curar = true; inp.x = 0; inp.golpeE = inp.saltoE = false; }
  return inp;
}
for (const tipo of Object.keys(ARENAS)) {
  let gana = 0, intentos = 30, tiempo = 0;
  for (let n = 0; n < intentos; n++) {
    const m = arena(tipo, false);
    let s = n * 7919 + 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    let t = 0;
    while (t < 150) {
      const ev = paso(m, torpe(m, rnd));
      t += DT;
      if (ev.some((e) => e.t === "jefeFin")) { gana++; tiempo += t; break; }
      if (m.p.muerta) break;
    }
  }
  const pct = Math.round(gana / intentos * 100);
  console.log(`      ${tipo}: el jugador torpe gana ${gana} de ${intentos} (${pct}%)${gana ? ", en " + (tiempo / gana).toFixed(0) + " s promedio" : ""}`);
  ver(gana > 0, `${tipo}: se puede ganar`);
}
console.log(mal ? `${mal} problema(s)` : "los tres jefes andan");
process.exit(mal ? 1 : 0);
