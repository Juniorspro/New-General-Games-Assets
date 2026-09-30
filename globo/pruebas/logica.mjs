// Las pruebas sin navegador: la física, los niveles y las partidas enteras
// (con el piloto automático, sin nadie y con el escudo estacionado).
//   node globo/pruebas/logica.mjs
import { Mundo, Cuerpo, ESTATICO, CINEMATICO, DINAMICO } from '../js/fisica.js';
import { armarNivel, crearInfinito, formacion, fijoEnColumna, FORMACIONES, NIVELES } from '../js/niveles.js';
import { Partida } from '../js/partida.js';
import { validar, base } from '../js/guardado.js';
import { GLOBOS, ESCUDOS } from '../js/pieles.js';
import { TABLA, IDIOMAS } from '../js/idioma.js';
import { azar, trozos } from '../js/util.js';
import { piloto } from './piloto.mjs';

let bien = 0, mal = 0;
const notas = [];
function ok(cond, nombre, dato = '') {
  if (cond) bien++; else { mal++; console.log(`  FALLA ${nombre}${dato ? ' — ' + dato : ''}`); }
}
const nota = (s) => { notas.push(s); console.log('  · ' + s); };

// ── la física ──────────────────────────────────────────────────────────────
function pila(n, { it = 10, rebote = 0.08 } = {}) {
  const m = new Mundo({ iteraciones: it }); m.agregar(new Cuerpo({ tipo: ESTATICO, x: 180, y: 600, w: 400, h: 40 }));
  const cs = []; for (let k = 0; k < n; k++) cs.push(m.agregar(new Cuerpo({ x: 180, y: 559.4 - k * 40, w: 40, h: 40, rebote })));
  let vmax = 0, dormidas = -1;
  for (let k = 0; k < 720; k++) {
    m.paso(1 / 120);
    if (k > 360) vmax = Math.max(vmax, ...cs.map((c) => Math.hypot(c.vx, c.vy)));
    if (dormidas < 0 && cs.every((c) => c.dormido)) dormidas = k / 120;
  }
  return { vmax, dormidas, arriba: cs[n - 1].y };
}
for (const [n, it] of [[1, 10], [6, 10], [6, 30], [8, 30]]) {
  const r = pila(n, { it });
  // más vueltas del resolvedor tienen que asentar mejor, no peor (así se encontró el error del rebote)
  ok(r.vmax < 1 && r.dormidas > 0 && r.dormidas < 5, `una pila de ${n} con ${it} vueltas se asienta y se duerme`, JSON.stringify(r));
}
{
  // el rebote se mide antes del arranque de impulsos: con rebote alto la pila tampoco salta
  const r = pila(6, { rebote: 0.4 });
  ok(r.vmax < 1, 'una pila de 6 con rebote 0,4 no salta', JSON.stringify(r));
}
{
  // el molinete gira clavado y frena contra su tope
  const m = new Mundo();
  const barra = m.agregar(new Cuerpo({ x: 180, y: 300, w: 200, h: 14, pivote: true, dormido: true }));
  barra.tope = [-0.25, Math.PI / 2];
  m.agregar(new Cuerpo({ forma: 'bola', r: 14, x: 250, y: 200 }));
  let amax = 0;
  for (let k = 0; k < 360; k++) { m.paso(1 / 120); amax = Math.max(amax, barra.a); }
  ok(Math.abs(barra.x - 180) < 1e-6 && Math.abs(barra.y - 300) < 1e-6 && amax > 0.3 && amax <= Math.PI / 2 + 1e-6, 'el molinete gira sin moverse y frena en el tope', `a máx ${amax.toFixed(2)}`);
}
{
  // un grupo dormido se despierta entero y la caja de abajo no se hunde
  const m = new Mundo(); m.agregar(new Cuerpo({ tipo: ESTATICO, x: 180, y: 600, w: 400, h: 40 }));
  const torre = []; for (let k = 0; k < 5; k++) torre.push(m.agregar(new Cuerpo({ x: 180, y: 559.7 - k * 40, w: 40, h: 40, dormido: true })));
  m.grupo(torre);
  const e = m.agregar(new Cuerpo({ tipo: CINEMATICO, forma: 'bola', r: 22, x: 100, y: 380 })); e.vx = 300;
  let todas = false, yMax = 0;
  for (let k = 0; k < 60; k++) { m.paso(1 / 120); if (torre.every((c) => !c.dormido)) todas = true; yMax = Math.max(yMax, torre[0].y); }
  ok(todas && yMax < 560.8, 'tocar una caja de la torre dormida despierta a todas y la de abajo no se hunde', `y ${yMax.toFixed(2)}`);
}
{
  // la cuerda del péndulo no se estira
  const m = new Mundo({ gravedad: 320 });
  const b = m.agregar(new Cuerpo({ forma: 'bola', r: 16, x: 280, y: 100 })); b.colgado = true;
  m.cuerda(b, 180, 100, 100);
  let min = Infinity, max = 0;
  for (let k = 0; k < 600; k++) { m.paso(1 / 120); const d = Math.hypot(b.x - 180, b.y - 100); min = Math.min(min, d); max = Math.max(max, d); }
  ok(max < 101.5 && min > 95, 'el péndulo mantiene el largo de la cuerda', `${min.toFixed(1)} a ${max.toFixed(1)}`);
}
{
  // 150 cuerpos cayendo en un pozo: nada atraviesa el piso y todo termina dormido
  const m = new Mundo(); m.agregar(new Cuerpo({ tipo: ESTATICO, x: 180, y: 600, w: 400, h: 40 }));
  m.agregar(new Cuerpo({ tipo: ESTATICO, x: -10, y: 300, w: 20, h: 700 })); m.agregar(new Cuerpo({ tipo: ESTATICO, x: 370, y: 300, w: 20, h: 700 }));
  for (let k = 0; k < 150; k++) m.agregar(k % 2 ? new Cuerpo({ x: 20 + (k * 37) % 330, y: -200 + k * 4, w: 14 + (k % 5) * 4, h: 14 + (k % 3) * 5, a: k }) : new Cuerpo({ forma: 'bola', r: 6 + (k % 4) * 3, x: 20 + (k * 53) % 330, y: -200 + k * 4 }));
  const t0 = performance.now();
  for (let k = 0; k < 720; k++) m.paso(1 / 120);
  const ms = (performance.now() - t0) / 720, din = m.cuerpos.filter((b) => b.tipo === DINAMICO);
  ok(din.every((b) => b.y < 585) && din.every((b) => b.dormido), 'el pozo de 150 cuerpos: nada bajo el piso y todos dormidos a los 6 s', `${din.filter((b) => !b.dormido).length} despiertos`);
  nota(`física: ${ms.toFixed(2)} ms por paso de 1/120 con 150 cuerpos (el pozo, 6 s, en Node)`);
}

// ── los niveles ────────────────────────────────────────────────────────────
{
  const tipos = new Set();
  let fijos = 0, cortos = 0, largos = 0;
  for (let n = 0; n < NIVELES; n++) {
    const d = armarNivel(n), dura = d.largo / d.vel;
    for (const f of d.formaciones) { tipos.add(f.tipo); if (fijoEnColumna(f)) fijos++; }
    if (dura < 25) cortos++; if (dura > 75) largos++;
  }
  ok(fijos === 0, 'ningún nivel tiene algo fijo en la columna del globo', `${fijos}`);
  ok(cortos === 0 && largos === 0, 'cada nivel dura entre 25 y 75 segundos', `cortos ${cortos} largos ${largos}`);
  ok(FORMACIONES.every((t) => tipos.has(t)), 'aparecen todas las formaciones', [...FORMACIONES].filter((t) => !tipos.has(t)).join(' '));
  ok(JSON.stringify(armarNivel(7)) === JSON.stringify(armarNivel(7)), 'el nivel 8 es siempre el mismo (semilla)');
  const n1 = armarNivel(0).formaciones.map((f) => f.tipo);
  ok(n1[0] === 'caja' && n1[1] === 'fila', 'el nivel 1 empieza con una caja y una fila', n1.join(' '));
}
{
  // el infinito: fórmulas a pedido, cada vez más rápido
  const inf = crearInfinito(3);
  let y = 0, fijos = 0;
  for (let k = 0; k < 120; k++) { const f = inf.siguiente(); if (fijoEnColumna(f)) fijos++; y = f.y0; }
  ok(fijos === 0 && -y > 20000 && inf.velEn(20000) > inf.velEn(0), 'el infinito arma formaciones sin fin, sin fijos en la columna y cada vez más rápido', `${Math.round(-y)} de alto`);
}

// ── las partidas ───────────────────────────────────────────────────────────
function jugar(n, modo, { formaciones = null, tope = 150 } = {}) {
  const p = new Partida({ nivel: n, formaciones });
  p.medir(360, 780);
  if (modo === 'estacionado') p.mover(70, 0);       // una vez al medio, y nada más
  let t = 0;
  while (p.estado === 'juego' && t < tope) { if (modo === 'piloto') piloto(p, 1 / 60); p.avanzar(1 / 60); t += 1 / 60; }
  return p;
}
{
  let quietoGana = 0, estacionadoGana = 0, pilotoGana = 0, primeros = 0, avance = 0;
  const t0 = performance.now();
  for (let n = 0; n < NIVELES; n++) {
    if (jugar(n, 'quieto').estado === 'meta') quietoGana++;
    if (jugar(n, 'estacionado').estado === 'meta') estacionadoGana++;
    const p = jugar(n, 'piloto');
    if (p.estado === 'meta') { pilotoGana++; if (n < 8) primeros++; }
    avance += p.progreso();
  }
  ok(quietoGana === 0, 'sin tocar nada no se gana ningún nivel', `${quietoGana}`);
  ok(estacionadoGana <= 2, 'con el escudo estacionado arriba del globo se ganan 2 niveles o menos', `${estacionadoGana}`);
  ok(primeros >= 6 && pilotoGana >= 8, 'el piloto automático pasa 6 de los primeros 8 niveles y 8 o más de los 30', `${primeros} de 8, ${pilotoGana} de 30`);
  nota(`partidas: el piloto gana ${pilotoGana} de 30 (avance medio ${Math.round((avance / NIVELES) * 100)} %); estacionado, ${estacionadoGana}; sin tocar, ${quietoGana} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}
{
  // cada formación sola, a dificultad baja y media: el piloto la pasa casi siempre
  const flojas = [];
  for (const tipo of FORMACIONES) for (const d of [0.1, 0.5]) {
    let gana = 0;
    for (let s = 0; s < 6; s++) {
      const f = formacion(tipo, azar(s * 77 + 1), d); f.y0 = -520;
      if (jugar(5, 'piloto', { formaciones: [f], tope: 40 }).estado === 'meta') gana++;
    }
    if (gana < 5) flojas.push(`${tipo}@${d}:${gana}/6`);
  }
  ok(flojas.length === 0, 'cada formación sola (dificultad 0,1 y 0,5) la pasa el piloto 5 de 6 veces o más', flojas.join(' '));
}
{
  // el péndulo se suelta a tiempo: si nadie lo ataja, pega en el globo
  let pega = 0;
  for (let s = 0; s < 6; s++) {
    const f = formacion('pendulo', azar(s * 77 + 1), 0.3); f.y0 = -520;
    const p = new Partida({ nivel: 9, formaciones: [f] }); p.medir(360, 780);
    p.mover(f.piezas[0].ax > 180 ? -300 : 300, 300);
    let t = 0; while (p.estado === 'juego' && t < 30) { p.avanzar(1 / 60); t += 1 / 60; }
    if (p.estado === 'pum' && p.culpable?.datos?.pieza === 'pendulo') pega++;
  }
  ok(pega === 6, 'el péndulo que nadie ataja pega en el globo', `${pega} de 6`);
}
{
  // las monedas: el escudo las junta al pasar por encima
  const p = new Partida({ nivel: 0 }); p.medir(360, 780);
  p.monedas = [{ x: p.escudo.x + 40, y: p.escudo.y, tomada: false, t: 0 }];
  p.mover(40, 0); p.avanzar(1 / 60); p.avanzar(1 / 60);
  ok(p.tomadas === 1 && p.sacarEventos().some((e) => e.tipo === 'moneda'), 'el escudo junta la moneda que toca');
}
{
  // el infinito, tres minutos con un globo que no revienta: sube cada vez más
  // rápido, cambia de cielo y no junta cuerpos de más
  const p = new Partida({ infinito: true, semilla: 5, inmortal: true }); p.medir(360, 780);
  const cielos = new Set();
  let t = 0, maxCuerpos = 0;
  while (t < 180) { piloto(p, 1 / 60); p.avanzar(1 / 60); t += 1 / 60; cielos.add(p.tema().id); maxCuerpos = Math.max(maxCuerpos, p.mundo.cuerpos.length); }
  ok(p.altura() > 18000 && cielos.size === 3 && maxCuerpos < 260, 'el infinito sube sin fin, pasa por los tres cielos y no junta cuerpos de más', `${Math.round(p.altura() / 10)} m, ${cielos.size} cielos, ${maxCuerpos} cuerpos como mucho`);
  nota(`infinito (3 min, sin reventar): ${Math.round(p.altura() / 10)} m, hasta ${maxCuerpos} cuerpos en el mundo; el piloto solo, sin inmortal, llega a unos 100 m`);
}

// ── lo guardado, los textos y el reloj ─────────────────────────────────────
{
  ok(JSON.stringify(validar(null)) === JSON.stringify(base()), 'lo guardado roto vuelve a lo de fábrica');
  const v = validar({ abierto: 999, monedas: -5, globos: ['azul', 'nada', 'azul'], globo: 'nada', escudo: 'hielo', escudos: ['blanco'], ajustes: { idioma: 'fr', sensibilidad: 'alta', musica: 'si' } });
  ok(v.abierto === NIVELES && v.monedas === 0 && v.globos.join() === 'rojo,azul' && v.globo === 'rojo' && v.escudo === 'blanco' && v.ajustes.idioma === null && v.ajustes.sensibilidad === 'alta' && v.ajustes.musica === true, 'lo guardado se valida campo por campo', JSON.stringify(v));
  const faltan = [];
  for (const [k, fila] of Object.entries(TABLA)) if (fila.length !== IDIOMAS.length || fila.some((x) => !x)) faltan.push(k);
  for (const g of GLOBOS) if (!TABLA['globo_' + g.id]) faltan.push('globo_' + g.id);
  for (const e of ESCUDOS) if (!TABLA['escudo_' + e.id]) faltan.push('escudo_' + e.id);
  ok(faltan.length === 0, 'todos los textos están en los tres idiomas (y cada globo y escudo tiene nombre)', faltan.join(' '));
  const precios = [...GLOBOS, ...ESCUDOS].map((p) => p.precio);
  ok(GLOBOS[0].precio === 0 && ESCUDOS[0].precio === 0 && precios.every((x) => x >= 0), 'el primer globo y el primer escudo son gratis');
  for (const hz of [60, 90, 120, 144]) {
    const [n, d] = trozos(1 / hz, 1 / 60);
    ok(n === 1 && Math.abs(d - 1 / hz) < 1e-12, `a ${hz} Hz cada cuadro es un paso de su tiempo real`);
  }
  const [n, d] = trozos(0.05, 1 / 60);
  ok(n === 3 && Math.abs(n * d - 0.05) < 1e-12, 'un cuadro lento se parte en pasos de a lo sumo 1/60');
}

console.log(`\n${mal ? 'FALLAN ' + mal : 'todo bien'}: ${bien + mal} comprobaciones, ${bien} bien`);
process.exit(mal ? 1 : 0);
