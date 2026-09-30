// ─────────────────────────────────────────────────────────────────────────────
// EL POZO. Una grilla de 12 columnas × N filas de 16 px. Paredes rugosas que se angostan y se
// ensanchan (caminata al azar, siempre con 6 o más de hueco), salientes de roca o de bloques,
// grupos de bloques que se rompen (los rojos traen gemas), plataformas que se pasan desde abajo,
// pinches en las zonas hondas y 2–3 salas laterales con su burbuja. Abajo el fondo está abierto:
// al caer por ahí se pasa al nivel siguiente. Todo sale de la semilla (el mismo número, el mismo pozo).
// ─────────────────────────────────────────────────────────────────────────────

const COLS = 12, VACIO = 0, ROCA = 1, BLOQUE = 2, BGEMA = 3, PLAT = 4, PINCHE = 5;
const solida = (c) => c === ROCA || c === BLOQUE || c === BGEMA || c === PINCHE;
const rompible = (c) => c === BLOQUE || c === BGEMA;

function generarNivel(zona, nivel, semilla, opciones = {}) {
  rnd = mulberry(semilla);
  const Z = ZONAS[zona], filas = 110 + zona * 12 + nivel * 10, t = new Uint8Array(filas * COLS);
  const N = { zona, nivel, filas, t, puertas: [], bichos: [], adornos: [], salida: filas * T };
  const pon = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < filas) t[y * COLS + x] = c; };
  const en = (x, y) => (x < 0 || x >= COLS ? ROCA : y < 0 || y >= filas ? VACIO : t[y * COLS + x]);
  N.en = en; N.pon = pon;
  // 1) las paredes: grosor de 1 a 3 por lado, que cambia de a poco
  // el primer nivel arranca a cielo abierto (estrellas y el título arriba del pozo, como el original):
  // el piso de salida queda a un 62% de la pantalla y todo lo demás se corre para abajo
  const a0 = zona === 0 && nivel === 0 ? Math.max(6, Math.round(H * 0.62 / T)) : 6;
  N.arranque = a0;
  const izq = new Uint8Array(filas), der = new Uint8Array(filas);
  let l = 1, r = 1;
  for (let y = 0; y < filas; y++) {
    if (y > a0 + 2 && A.si(0.22)) { if (A.si(0.5)) l = lim(l + (A.si(0.5) ? 1 : -1), 1, 3); else r = lim(r + (A.si(0.5) ? 1 : -1), 1, 3); }
    while (COLS - l - r < 6) { if (l > r) l--; else r--; }
    izq[y] = l; der[y] = r;
    if (y < a0 && a0 > 6) continue;
    for (let x = 0; x < l; x++) pon(x, y, ROCA);
    for (let x = COLS - r; x < COLS; x++) pon(x, y, ROCA);
  }
  N.izq = izq; N.der = der;
  // 2) el arranque: un piso arriba con un agujero (se empieza parado y se cae por ahí)
  const hueco = A.si(0.5) ? izq[a0] + 1 : COLS - der[a0] - 4;
  for (let x = 0; x < COLS; x++) if (x < hueco || x > hueco + 2) pon(x, a0, ROCA);
  N.inicio = { x: (hueco > COLS / 2 ? izq[a0] + 1.5 : COLS - der[a0] - 1.5) * T, y: a0 * T - 1 };
  // 3) lo de adentro, fila por fila (dejando siempre un paso de 3 en la roca)
  const libres = (y) => { let n = 0, mejor = 0; for (let x = 0; x < COLS; x++) { if (en(x, y) === VACIO || rompible(en(x, y)) || en(x, y) === PLAT) { n++; mejor = Math.max(mejor, n); } else n = 0; } return mejor; };
  let y = a0 + 6;
  while (y < filas - 10) {
    const a = izq[y], b = COLS - der[y], ancho = b - a, tirada = A.f();
    if (tirada < 0.34) {                                   // saliente desde una pared
      const lado = A.si(0.5), largo = A.ent(2, Math.max(2, ancho - 4)), grueso = A.si(0.3) ? 2 : 1, mat = A.si(Z.bloques * 0.55) ? BLOQUE : ROCA;
      for (let k = 0; k < largo; k++) for (let g2 = 0; g2 < grueso; g2++) pon(lado ? a + k : b - 1 - k, y + g2, mat);
      if (mat === ROCA && Z.pinches && A.si(Z.pinches)) for (let k = 0; k < largo; k++) if (A.si(0.7)) pon(lado ? a + k : b - 1 - k, y - 1, PINCHE);
    } else if (tirada < 0.34 + 0.34 * Z.bloques) {         // un grupo de bloques que se rompen
      const w = A.ent(1, 3), h = A.ent(1, 2), x0 = A.ent(a, Math.max(a, b - w));
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) pon(x0 + i, y + j, A.si(0.12) ? BGEMA : BLOQUE);
      if (A.si(0.2)) pon(x0 + Math.floor(w / 2), y + h, ROCA);
    } else if (tirada < 0.34 + 0.34 * Z.bloques + 0.3 * Z.plataformas) {   // plataformas
      const w = A.ent(2, 3), x0 = A.ent(a, Math.max(a, b - w));
      for (let i = 0; i < w; i++) pon(x0 + i, y, PLAT);
    } else if (Z.pinches > 0.4 && A.si(0.5)) {             // el limbo: islas de pinches
      const w = A.ent(2, 4), x0 = A.ent(a, Math.max(a, b - w));
      for (let i = 0; i < w; i++) { pon(x0 + i, y + 1, ROCA); pon(x0 + i, y, PINCHE); }
    }
    // si esta fila quedó cerrada con roca, se abre un paso de 3
    for (const yy of [y, y + 1]) if (libres(yy) < 3) { const x0 = A.ent(izq[yy], COLS - der[yy] - 3); for (let i = 0; i < 3; i++) pon(x0 + i, yy, VACIO); }
    y += A.ent(3, 6);
  }
  // 4) las salas laterales: un hueco en la pared con piso, marcado por una burbuja
  const nSalas = 2 + (opciones.tienda ? 1 : 0);
  const tipos = opciones.soloArmas ? ["modulo", "modulo", "modulo"] : A.mezclar(["tienda", "veta", "modulo", A.uno(["veta", "modulo", "tienda"])]);
  if (opciones.tienda && !tipos.slice(0, nSalas).includes("tienda")) tipos[0] = "tienda";
  for (let i = 0; i < nSalas; i++) {
    const fy = Math.floor(a0 + 16 + (filas - a0 - 34) * (i + 0.5 + (A.f() - 0.5) * 0.4) / nSalas), lado = A.si(0.5) ? -1 : 1;
    const grosor = lado < 0 ? izq[fy] : der[fy];
    for (let k = 0; k < grosor + 1; k++) { const x = lado < 0 ? k : COLS - 1 - k; pon(x, fy, VACIO); pon(x, fy - 1, VACIO); pon(x, fy + 1, ROCA); pon(x, fy - 2, ROCA); }
    // un escalón de piso delante de la entrada, para poder pararse
    pon(lado < 0 ? grosor + 1 : COLS - grosor - 2, fy + 1, ROCA);
    N.puertas.push({ fila: fy, lado, tipo: tipos[i], x: lado < 0 ? 0 : COLS * T, y: fy * T + T, usada: false });
  }
  // 5) los bichos: una tanda cada 6 filas, más densa en los niveles de más abajo
  const densidad = 0.95 + nivel * 0.3 + zona * 0.15;
  const sobrePiso = (x, y2) => en(x, y2) === VACIO && en(x, y2 - 1) === VACIO && (solida(en(x, y2 + 1)) || en(x, y2 + 1) === PLAT);
  const bajoTecho = (x, y2) => en(x, y2) === VACIO && solida(en(x, y2 - 1));
  for (let banda = a0 + 8; banda < filas - 8; banda += 6) {
    let n = Math.floor(densidad + A.f());
    for (let k = 0; k < n; k++) {
      const tipo = A.uno(Z.bichos), d = BICHOS_D[tipo];
      for (let intento = 0; intento < 14; intento++) {
        const x = A.ent(1, COLS - 2), yy = banda + A.ent(0, 5);
        const camina = ["patrulla", "salta", "tira", "rebota"].includes(d.mueve), cuelga = d.mueve === "colgado";
        if (camina ? sobrePiso(x, yy) : cuelga ? bajoTecho(x, yy) : en(x, yy) === VACIO) {
          N.bichos.push({ tipo, x: x * T + T / 2, y: cuelga ? yy * T + d.h : camina ? (yy + 1) * T : yy * T + T / 2 });
          break;
        }
      }
    }
  }
  // 6) los adornos que se pisan (recargan sin cortar el combo)
  for (let yy = a0 + 10; yy < filas - 8; yy += A.ent(9, 16)) {
    for (let intento = 0; intento < 10; intento++) {
      const x = A.ent(1, COLS - 2);
      if (Z.adorno === "farol" ? en(x, yy) === VACIO : sobrePiso(x, yy)) { N.adornos.push({ tipo: Z.adorno, x: x * T + T / 2, y: Z.adorno === "farol" ? yy * T + 8 : (yy + 1) * T }); break; }
    }
  }
  return N;
}

/** Un nivel chico (sala lateral): paredes, piso, y lo que tiene adentro lo pone quien lo llama. */
function generarSala(tipo, ladoEntrada) {
  // la sala llena la pantalla entera (cámara fija arriba) y el piso queda arriba de los pulgares
  const filas = Math.max(16, Math.ceil(H / T) + 1), piso = filas - 7, t = new Uint8Array(filas * COLS);
  const N = { sala: tipo, filas, t, puertas: [], bichos: [], adornos: [], ladoEntrada, piso };
  const pon = (x, y, c) => { if (x >= 0 && x < COLS && y >= 0 && y < filas) t[y * COLS + x] = c; };
  N.en = (x, y) => (x < 0 || x >= COLS ? ROCA : y < 0 ? ROCA : y >= filas ? ROCA : t[y * COLS + x]); N.pon = pon;
  for (let x = 0; x < COLS; x++) { pon(x, 0, ROCA); pon(x, 1, ROCA); pon(x, 2, ROCA); for (let y = piso; y < filas; y++) pon(x, y, ROCA); }
  for (let y = 0; y < filas; y++) { pon(0, y, ROCA); pon(COLS - 1, y, ROCA); }
  // la entrada, del lado por donde se vino (a la altura del piso)
  const xe = ladoEntrada < 0 ? COLS - 1 : 0;
  pon(xe, piso - 1, VACIO); pon(xe, piso - 2, VACIO);
  N.salidaX = xe;
  if (tipo === "veta") for (let x = 3; x < 9; x++) for (let y = piso - 7; y < piso - 3; y++) if ((x + y) % 3 !== 0) pon(x, y, BGEMA);
  return N;
}
