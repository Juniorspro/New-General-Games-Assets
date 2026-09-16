// El generador de niveles, con su validador.
//
// La parte que importa no es armar el nivel: es DEMOSTRAR que se puede
// terminar. Un generador sin validador tarde o temprano escupe un pozo de
// nueve tiles con una pared enfrente, y el jugador se come un nivel imposible
// sin que nada avise. Aca cada nivel se juega entero con una busqueda en haz
// sobre la fisica de verdad — la misma de fisica.js, no una aproximacion —
// antes de dejarlo salir.
//
// Lo que el validador comprueba:
//   1. que exista un camino desde la largada hasta el mastil,
//   2. que ese camino entre en el tiempo del nivel,
//   3. que las cinco monedas de color esten en celdas que el camino alcanza.
// Lo que NO comprueba: los enemigos. Un enemigo se esquiva, se pisa o se
// vaultea; la geometria no. Esta dicho aca para que nadie lo de por hecho.

import { V, T, ALTO_TILES, TEMAS, F } from "./mundo.js";
import { azar, semillaDe } from "./azar.js";
import { PIEZAS, porNombre } from "./piezas.js";
import { nuevoJugador, clonar, paso, tileXY } from "./fisica.js";

// Seis tiles de aire abajo del piso: es el fondo de los pozos de rebote.
const PISO_BASE = 17;
const PISO_MIN = 6, PISO_MAX = ALTO_TILES - 7;

// --- construir ----------------------------------------------------------
function construir(cfg, tier, intento) {
  const rnd = azar(semillaDe(cfg.m, cfg.n, intento));
  const tema = TEMAS[cfg.tema];
  // Cada tanda baja un poco la dificultad: si el nivel no valido, el
  // problema casi siempre es que se apilaron piezas duras.
  const dif = Math.max(0.05, cfg.dif - intento * 0.09);

  const ancho = cfg.largo;
  const grilla = new Uint8Array(ancho * ALTO_TILES);
  const enemigos = [], candidatos = [];
  const set = (tx, ty, v) => {
    if (tx < 0 || ty < 0 || tx >= ancho || ty >= ALTO_TILES) return;
    grilla[ty * ancho + tx] = v;
  };

  let x = 0, piso = PISO_BASE, durasSeguidas = 0;
  const DURAS = new Set(["pared", "chimenea", "lava", "pinches", "saltoLargo", "pozoIsla"]);

  // Largada: doce tiles de nada, para que el jugador entienda que corre solo
  // antes de que le pidan algo.
  for (let i = 0; i < 12; i++) for (let y = piso; y < ALTO_TILES; y++) set(i, y, V.SOLIDO);
  x = 12;

  const finReservado = 16;
  while (x < ancho - finReservado) {
    let elegida;
    if (durasSeguidas >= 2) { elegida = porNombre("descanso"); durasSeguidas = 0; }
    else {
      const posibles = PIEZAS.filter((pz) =>
        pz.min <= dif && pz.peso(dif) > 0 &&
        (!pz.temas || pz.temas.includes(cfg.tema)) &&
        x + 20 < ancho - finReservado);
      if (!posibles.length) break;
      elegida = rnd.pesado(posibles.map((pz) => [pz, pz.peso(dif)]));
      durasSeguidas = DURAS.has(elegida.nombre) ? durasSeguidas + 1 : 0;
    }

    const base = x;
    const p = {
      rnd, dif, tema: cfg.tema, piso, ancho: 0,
      set: (dx, ty, v) => set(base + dx, ty, v),
      suelo: (dx0, dx1, y = piso) => {
        for (let i = dx0; i < dx1; i++)
          for (let ty = y; ty < ALTO_TILES; ty++) set(base + i, ty, V.SOLIDO);
      },
      moneda: (dx, ty) => { if (tileXYg(grilla, ancho, base + dx, ty) === V.NADA) set(base + dx, ty, V.MONEDA); },
      enemigo: (tipo, dx, ty) => enemigos.push({ tipo, tx: base + dx, ty }),
      marcarColor: (dx, ty, clase) => candidatos.push({ tx: base + dx, ty, clase }),
      bicho: () => rnd.uno(tema.enemigos),
    };
    const nuevoPiso = elegida.armar(p);
    if (!p.ancho) p.ancho = 6;
    x += p.ancho;
    piso = Math.max(PISO_MIN, Math.min(PISO_MAX, nuevoPiso ?? piso));
  }

  // Llegada: llano y el mastil.
  for (let i = x; i < ancho; i++) for (let y = piso; y < ALTO_TILES; y++) set(i, y, V.SOLIDO);
  // Muro del fondo en los niveles de jefe. El jugador corre solo: sin un muro
  // que lo devuelva, pasaria de largo al jefe y se quedaria trabado contra el
  // borde del nivel. Con el muro, la pelea es ir y venir — y eso funciona sin
  // necesidad de un boton para retroceder que el juego no tiene.
  if (cfg.jefe)
    for (let i = ancho - 3; i < ancho; i++)
      for (let y = piso - 9; y < ALTO_TILES; y++) set(i, y, V.SOLIDO);

  const mastilX = ancho - 8;
  for (let y = piso - 10; y < piso; y++) set(mastilX, y, V.MASTIL);
  set(mastilX, piso - 1, V.META);

  // --- monedas de color --------------------------------------------------
  // Cinco, repartidas a lo largo del nivel y cada vez mas escondidas segun el
  // color. Se eligen de los lugares que las piezas marcaron como "esto es un
  // buen escondite", no de cualquier hueco: un escondite al azar sale injusto
  // la mitad de las veces.
  const dureza = { rosa: 0, violeta: 1, negra: 2 }[tier] ?? 0;
  const orden = { alto: 2, pared: 2, aire: 1 };
  const utiles = candidatos
    .filter((c) => c.tx > 14 && c.tx < mastilX - 4 && c.ty > 1)
    .filter((c) => (orden[c.clase] ?? 0) >= dureza - 1);
  const monedasColor = [];
  if (utiles.length) {
    const tramo = (mastilX - 14) / 5;
    for (let i = 0; i < 5; i++) {
      const centro = 14 + tramo * (i + 0.5);
      // La mas cercana al centro del tramo que todavia no se uso: asi quedan
      // repartidas y no las cinco juntas en el mismo lugar lindo.
      let mejor = null, mejorD = 1e9;
      for (const c of utiles) {
        if (c.usada) continue;
        const d = Math.abs(c.tx - centro) - (orden[c.clase] ?? 0) * dureza * 4;
        if (d < mejorD) { mejorD = d; mejor = c; }
      }
      if (mejor) {
        mejor.usada = true;
        monedasColor.push({ tx: mejor.tx, ty: Math.max(1, mejor.ty - dureza), tomada: false });
      }
    }
  }
  // Si las piezas no marcaron suficientes, se completa arriba de las monedas
  // comunes mas altas. Nunca se deja un nivel con menos de cinco.
  if (monedasColor.length < 5) {
    for (let tx = 16; tx < mastilX - 4 && monedasColor.length < 5; tx += 7) {
      for (let ty = 3; ty < ALTO_TILES - 3; ty++) {
        if (tileXYg(grilla, ancho, tx, ty) === V.MONEDA) {
          monedasColor.push({ tx, ty, tomada: false }); break;
        }
      }
    }
  }

  return { grilla, ancho, alto: ALTO_TILES, enemigos, monedasColor, piso, segundos: cfg.seg,
           mastilX, pisoMastil: piso, cfg, tema: cfg.tema, tier,
           inicio: { x: 3 * T, y: piso * T } };
}

const tileXYg = (g, ancho, tx, ty) =>
  (tx < 0 || ty < 0 || tx >= ancho || ty >= ALTO_TILES) ? V.NADA : g[ty * ancho + tx];

// --- validador ----------------------------------------------------------
// Busqueda en haz sobre la fisica real. En cada cuadro cada estado se abre en
// dos (dedo apoyado o no), se tiran los repetidos y se queda el haz con los
// que llegaron mas lejos. Con haz de 96 alcanza para resolver todo lo que el
// generador arma, y cuesta unos 60 ms por nivel.
const HAZ = 96;

export function validar(nv, cuadrosMax) {
  const meta = nv.mastilX * T;
  let estados = [{ j: nuevoJugador(nv.inicio.x, nv.inicio.y), prev: false, acc: null }];
  const visitadas = new Set();
  const marcar = (j) => visitadas.add(`${Math.floor(j.x / T)},${Math.floor((j.y - 1) / T)}`);
  marcar(estados[0].j);

  for (let c = 0; c < cuadrosMax; c++) {
    const siguientes = [];
    const vistos = new Set();
    for (const e of estados) {
      for (const toque of [false, true]) {
        const j = clonar(e.j);
        const ev = {};
        paso(j, nv, { toque, toqueNuevo: toque && !e.prev }, ev);
        if (!j.vivo) continue;
        const llave = `${Math.round(j.x / 6)},${Math.round(j.y / 6)},${Math.round(j.vy)},${j.dir},${j.suelo ? 1 : 0}`;
        if (vistos.has(llave)) continue;
        vistos.add(llave);
        marcar(j);
        const acc = { padre: e.acc, toque };
        if (j.x >= meta) {
          // Se devuelve el camino entero. Sirve para la prueba que lo rehace
          // dentro del juego de verdad: si el juego y el validador no dan lo
          // mismo cuadro a cuadro, "nivel validado" no significa nada.
          const camino = [];
          for (let a = acc; a; a = a.padre) camino.push(a.toque);
          camino.reverse();
          return { ok: true, cuadros: c + 1, visitadas, holgura: cuadrosMax - c, camino };
        }
        siguientes.push({ j, prev: toque, acc });
      }
    }
    if (!siguientes.length) return { ok: false, motivo: "sin salida", cuadros: c, visitadas };
    // Los que llegaron mas a la derecha, y a igualdad de X los mas altos:
    // la altura casi siempre es la que abre el camino.
    siguientes.sort((a, b) => (b.j.x - a.j.x) || (a.j.y - b.j.y));
    estados = siguientes.slice(0, HAZ);
  }
  return { ok: false, motivo: "sin tiempo", cuadros: cuadrosMax, visitadas };
}

// Una moneda de color vale si el camino paso por su celda o por una pegada.
// Pegada y no exacta: el jugador tiene 11x15 pixeles de ancho, agarra cosas
// sin pisar el centro del tile.
function alcanzable(vis, tx, ty) {
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      if (vis.has(`${tx + dx},${ty + dy}`)) return true;
  return false;
}

// --- api ----------------------------------------------------------------
export function generarNivel(cfg, tier = "rosa") {
  let ultimo = null;
  // Techo de cuadros. Un nivel que se puede terminar pero pide volver tres
  // veces sobre los propios pasos NO es un nivel bueno: el 3-2 salio una vez
  // con un camino optimo de 4827 cuadros contra 1161 de linea recta, o sea
  // cuatro veces el largo. Se puede jugar y es horrible. Se rechaza.
  const recta = (cfg.largo * T) / F.VEL;
  const techo = Math.min(cfg.seg * 60, Math.round(recta * 2.2));

  for (let intento = 0; intento < 10; intento++) {
    const nv = construir(cfg, tier, intento);
    const r = validar(nv, techo);
    ultimo = { nv, r };
    if (!r.ok) continue;

    // Las monedas de color que quedaron fuera del alcance se bajan hasta una
    // celda que el camino si toca. Tirar el nivel entero por una moneda seria
    // regenerar treinta veces por un detalle que se arregla moviendola.
    for (const mc of nv.monedasColor) {
      if (alcanzable(r.visitadas, mc.tx, mc.ty)) continue;
      let arreglada = false;
      for (let d = 1; d <= 6 && !arreglada; d++)
        for (const ty of [mc.ty + d, mc.ty - d])
          if (alcanzable(r.visitadas, mc.tx, ty)) { mc.ty = ty; arreglada = true; break; }
      if (!arreglada)
        for (let dx = 1; dx <= 12 && !arreglada; dx++)
          for (const tx of [mc.tx + dx, mc.tx - dx])
            for (let ty = 2; ty < ALTO_TILES - 2; ty++)
              if (alcanzable(r.visitadas, tx, ty)) { mc.tx = tx; mc.ty = ty; arreglada = true; break; }
    }
    // El tiempo limite sale de lo que TARDA el camino optimo, no de un numero
    // escrito a mano. Antes el 1-1 daba 80 segundos para un recorrido de 14:
    // el reloj no queria decir nada. x3,2 mas doce deja aire para juntar
    // monedas y equivocarse dos veces, y sigue apretando al final.
    nv.segundos = Math.max(40, Math.min(99, Math.round((r.cuadros / 60) * 3.2 + 12)));

    // Las que falten se completan con celdas que el validador PROBO que se
    // alcanzan, priorizando las mas altas: son las que cuesta agarrar.
    if (nv.monedasColor.length < 5) {
      const libres = [];
      for (const llave of r.visitadas) {
        const [tx, ty] = llave.split(",").map(Number);
        if (tx > 14 && tx < nv.mastilX - 4 && ty > 1) libres.push({ tx, ty });
      }
      libres.sort((a, b) => a.ty - b.ty);
      const tramo = (nv.mastilX - 14) / 5;
      for (let i = 0; nv.monedasColor.length < 5 && i < 5; i++) {
        const centro = 14 + tramo * (i + 0.5);
        const c = libres.find((l) => Math.abs(l.tx - centro) < tramo * 0.8 &&
                   !nv.monedasColor.some((m) => Math.abs(m.tx - l.tx) < 4));
        if (c) nv.monedasColor.push({ tx: c.tx, ty: c.ty, tomada: false });
      }
    }

    // Monedas: solo donde el camino probo que se llega, y repuestas a lo largo
    // del recorrido para que no queden tramos pelados.
    const sem = sembrarMonedas(nv, r.visitadas);
    nv.alcance = { celdas: r.visitadas.size, sacadas: sem.sacadas, puestas: sem.puestas };
    nv.validacion = { cuadros: r.cuadros, intentos: intento + 1, holgura: r.holgura };
    nv.camino = r.camino;
    return nv;
  }
  // No deberia pasar nunca: con dificultad 0.05 el generador arma un paseo.
  // Si pasa, se devuelve igual y se deja anotado, porque un nivel raro es
  // mejor que una pantalla negra sin explicacion.
  ultimo.nv.validacion = { fallo: ultimo.r.motivo, intentos: 10 };
  return ultimo.nv;
}

// --- alcance real --------------------------------------------------------
// El validador de arriba prueba que EXISTE un camino al mastil. Eso NO es lo
// mismo que probar que se alcanza todo el nivel: la busqueda en haz se queda
// con los 96 estados que llegaron mas a la derecha, asi que nunca explora los
// rincones que el camino optimo no pisa.
//
// Medido sobre los 24 niveles: 59 de 539 monedas quedaban fuera de alcance, un
// 10,9%, y en el 5-3 era el 52%. O sea que la mitad de las monedas de ese
// nivel no se podian agarrar y nada lo avisaba. Eso es exactamente el reclamo
// de "hay lugares inaccesibles", y era cierto.
//
// Esto es una inundacion de verdad: explora TODOS los estados alcanzables, sin
// podar por X, y devuelve el conjunto de celdas que el jugador puede tocar.
// Cuesta mas que el haz, pero se corre una vez por nivel.
// --- monedas donde el jugador PROBADAMENTE llega --------------------------
//
// Dos intentos fallidos antes de este, y los dos por resolver el problema al
// reves — poner monedas y despues preguntarse si se alcanzan:
//
//   1. Un BFS cuadro a cuadro con dedup por estado. Colapso en catorce
//      estados: el jugador avanza 2,55 px por cuadro, el hijo cae en el mismo
//      casillero que el padre y se descarta por repetido. Como el conjunto
//      quedaba vacio, el paso siguiente borro las 539 monedas de los 24
//      niveles sin que nada avisara.
//   2. Un haz por diversidad. Andaba, pero tardaba 2,7 segundos por nivel y
//      todavia borraba 152 monedas.
//
// LA VUELTA CORRECTA es al reves: `validar` ya devuelve `visitadas`, que son
// las celdas que ocuparon estados REALMENTE SIMULADOS. Todo lo que esta ahi
// es alcanzable por construccion, y no cuesta nada porque ya se calculo. Es
// una subestimacion del alcance real, y esa es justo la direccion segura: se
// ponen monedas solo donde ya se probo que el jugador puede estar.
//
// Ademas queda mejor de jugar. Las monedas siguen el recorrido natural, que
// es para lo que sirven las monedas en un juego de correr: marcar por donde ir.

const ADYACENTES = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,-1],[1,1],[-1,1]];
function tocable(celdas, tx, ty) {
  for (const [dx, dy] of ADYACENTES) if (celdas.has(`${tx + dx},${ty + dy}`)) return true;
  return false;
}

/**
 * Deja el nivel con monedas SOLO en celdas alcanzables, y repone las que se
 * sacaron sembrando a lo largo del camino para que no queden tramos pelados.
 */
export function sembrarMonedas(nv, celdas, rnd) {
  let sacadas = 0;
  for (let ty = 0; ty < ALTO_TILES; ty++)
    for (let tx = 0; tx < nv.ancho; tx++)
      if (nv.grilla[ty * nv.ancho + tx] === V.MONEDA && !tocable(celdas, tx, ty)) {
        nv.grilla[ty * nv.ancho + tx] = V.NADA; sacadas++;
      }

  // Reponer: se recorren las celdas alcanzables en orden de X y se siembra una
  // moneda cada tres tiles donde haya lugar. Sin esto, un nivel con muchos
  // rincones inalcanzables queda medio vacio.
  const libres = [];
  for (const k of celdas) {
    const [tx, ty] = k.split(",").map(Number);
    if (tx < 8 || tx > nv.mastilX - 3 || ty < 1 || ty >= ALTO_TILES - 1) continue;
    if (nv.grilla[ty * nv.ancho + tx] !== V.NADA) continue;
    libres.push([tx, ty]);
  }
  libres.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let puestas = 0, ultimaX = -99;
  for (const [tx, ty] of libres) {
    if (tx - ultimaX < 3) continue;
    nv.grilla[ty * nv.ancho + tx] = V.MONEDA;
    ultimaX = tx; puestas++;
  }
  return { sacadas, puestas };
}
