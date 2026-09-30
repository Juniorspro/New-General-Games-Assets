// ─────────────────────────────────────────────────────────────────────────────
// EL ARTE, A TRES COLORES. Cada sprite es un sello: '#' tinta, 'r' acento, 'o' fondo (ojos, huecos),
// '.' nada. Siluetas chicas y claras (el género se lee por la forma y por el ROJO: lo rojo no se
// pisa). Se hornean con la paleta activa; al cambiar de paleta se rehornea todo.
// ─────────────────────────────────────────────────────────────────────────────

function selloSpr(clave, filas, izq = false) {
  return hornear(`s|${clave}|${izq}`, () => {
    const w = Math.max(...filas.map((f) => f.length)), c = lienzoNuevo(w, filas.length), q = c.getContext("2d");
    filas.forEach((f, y) => { for (let x = 0; x < f.length; x++) { const k = f[izq ? w - 1 - x : x] || "."; if (k === ".") continue; q.fillStyle = k === "#" ? C_TINTA : k === "r" ? C_ACENTO : C_FONDO; q.fillRect(x, y, 1, 1); } });
    return c;
  });
}

// ── el protagonista (11×14, mira a la derecha): un buzo del abismo, de perfil. Casco redondo con el
//    visor adelante (con su brillo), el tanque de aire atrás con la válvula arriba y las botas-cañón
//    rojas. Los miembros se separan con líneas de fondo, como en el original: la versión anterior era
//    un bloque con un ojo y se leía como un robot de frente. ──
const HEROE = {
  quieto: ["....####...", "...######..", "..####ooo#.", "..####o#o#.", "..########.", ".#.######..", ".##o#####..", ".##o####o#.", ".##o####o#.", "..#o####o#.", "....####...", "....#..#...", "...rr..rr..", "...rr..rrr."],
  corre1: ["....####...", "...######..", "..####ooo#.", "..####o#o#.", "..########.", ".#.######..", ".##o#####..", ".##o####o..", ".##o####o#.", "..#o####.#.", "....####...", "...#...##..", "..rr....rr.", "..rr....rrr"],
  corre2: ["...........", "....####...", "...######..", "..####ooo#.", "..####o#o#.", "..########.", ".#.######..", ".##o#####..", ".##o####o#.", ".##o####o#.", "..#o####...", "....####...", ".....##....", "....rrrr..."],
  corre3: ["....####...", "...######..", "..####ooo#.", "..####o#o#.", "..########.", ".#.######..", ".##o#####..", ".##o#####..", ".##o####o..", "..#o####o#.", "....####...", "...##..#...", "..rr...rr..", ".rr....rrr."],
  sube: ["....####...", "...######..", "..####ooo#.", "..####o#o#.", "..#######o#", ".#.######o#", ".##o####o#.", ".##o####...", ".##o####...", "..#o####...", "....####...", "...##..##..", "...rr..rr..", "..........."],
  cae: ["....####...", "...######..", "..####ooo#.", "..####o#o#.", "..########.", ".#.######.#", ".##o####o#.", ".##o####...", ".##o####...", "..#o####...", "...######..", "..##....##.", "..rr....rr.", "..rr....rr."],
  dispara: ["....####...", "...######..", "..####ooo#.", "..####o#o#.", "..########.", ".#.######..", ".##o#####..", ".##o####o#.", ".##o####o.#", "..#o####...", "....####...", "....#..#...", "....r..r...", "...rrrrrr.."],
};
function heroeSpr(pose, izq) { return selloSpr("h" + pose, HEROE[pose] || HEROE.quieto, izq); }

// ── enemigos: dos cuadros; los "r" (rojos) no se pisan ──
const BICHOS = {
  murcielago: [["#.......#", "##.....##", "###.#.###", ".#######.", "..#o#o#..", "...###...", "....#...."], ["...#.#...", "..#####..", ".#######.", "###o#o###", "##.###.##", "#...#...#", "........."]],
  murcielagoR: [["r.......r", "rr.....rr", "rrr.r.rrr", ".rrrrrrr.", "..roror..", "...rrr...", "....r...."], ["...r.r...", "..rrrrr..", ".rrrrrrr.", "rrrorrorr", "rr.rrr.rr", "r...r...r", "........."]],
  caracol: [["...####...", "..######..", ".###..###.", ".##.##.##.", ".###..###o", "##########", "#########."], ["...####...", "..######..", ".###..###.", ".##.##.##.", ".###..###.", "#########o", ".#########"]],
  erizo: [["r.r.r.r.r.", ".rrrrrrrr.", "rrrrrrrrrr", ".rrorrorr.", "rrrrrrrrrr", ".rrrrrrrr.", "r.r..r..r."], [".r.r.r.r.r", ".rrrrrrrr.", "rrrrrrrrrr", ".rrorrorr.", "rrrrrrrrrr", ".rrrrrrrr.", ".r..r..r.r"]],
  medusa: [["..####..", ".######.", "##o##o##", "########", "#.#..#.#", "#.#..#.#", ".#....#."], ["..####..", ".######.", "##o##o##", "########", ".#.##.#.", "#..##..#", "#......#"]],
  rana: [["..##..##.", ".#o####o#", ".########", "##..##..#", "#########", ".#.....#.", "##.....##"], ["..##..##.", ".#o####o#", ".########", "##..##..#", "#########", "#.......#", "........."]],
  calavera: [["..rrrrr..", ".rrrrrrr.", "rrorrrorr", "rrorrrorr", ".rrrrrrr.", "..r.r.r..", "..rrrrr.."], ["..rrrrr..", ".rrrrrrr.", "rrorrrorr", "rrorrrorr", ".rrrrrrr.", "..rrrrr..", "...r.r..."]],
  arana: [["....#....", "....#....", "..#####..", "#.#o#o#.#", ".#######.", "#.#####.#", ".#.#.#.#."], ["....#....", "....#....", "..#####..", ".##o#o##.", "#.#####.#", ".#######.", "#..#.#..#"]],
  calamar: [["...##...", "..####..", ".######.", "##o##o##", ".######.", ".#.##.#.", "#..##..#", "#.#..#.#"], ["...##...", "..####..", ".######.", "##o##o##", ".######.", "..####..", ".#.##.#.", ".#.##.#."]],
  pez: [["...rrrr..r", ".rrrrrrrrr", "rorrrrrrr.", "rrrrrrrrrr", ".rrrrrr..r"], ["...rrrr...", ".rrrrrrr.r", "rorrrrrrrr", "rrrrrrrr.r", ".rrrrrr..."]],
  gota: [["...##...", "..####..", ".######.", "##o##o##", "########", ".######."], ["........", "...##...", ".######.", "##o##o##", "########", "########"]],
};
function bichoSpr(tipo, cuadro, izq) { const b = BICHOS[tipo]; return selloSpr(`b${tipo}${cuadro}`, b[cuadro % b.length], izq); }


// los que faltan (los rojos no se pisan: el color ES la regla)
const rojo = (filas) => filas.map((f) => f.replace(/#/g, "r"));
Object.assign(BICHOS, {
  gusano: [["..........", "...####...", "..######..", ".#o######.", "##########"], ["..........", "..........", ".#######..", "#o#########".slice(0, 10), "##########"]],
  tortuga: [["...#####...", "..##.#.##..", ".#########.", "##########.", "#o#########", ".##..##..#.", ".##..##..#."], ["...#####...", "..##.#.##..", ".#########.", "##########.", "#o#########", "..##..##.#.", "..##..##.#."]],
  aranaR: BICHOS.arana.map(rojo),
  ojo: [["..rrrrr..", ".rrrrrrr.", "rrr###rrr", "rr##o##rr", "rr##o##rr", "rrr###rrr", ".rrrrrrr.", "..rrrrr..", "...r.r..."], ["..rrrrr..", ".rrrrrrr.", "rrr###rrr", "rr#o###rr", "rr#o###rr", "rrr###rrr", ".rrrrrrr.", "..rrrrr..", "..r...r.."]],
  fantasma: [["..#####..", ".#######.", "##o###o##", "##o###o##", "#########", "####o####", "#########", "#########", "##.###.##", "#...#...#"], ["..#####..", ".#######.", "##o###o##", "##o###o##", "#########", "####o####", "#########", "#########", "#.###.###", "...#...#."]],
  calaveraB: [[".######.", "########", "#oo##oo#", "#oo##oo#", "########", ".#.##.#.", ".######."], [".######.", "########", "#oo##oo#", "#oo##oo#", "########", ".######.", ".#.##.#."]],
  esqueleto: [["..####..", ".######.", ".#o##o#.", ".######.", "..#..#..", "########", "#.####.#", "..####..", "..#..#..", "..#..#..", ".##..##."], ["..####..", ".######.", ".#o##o#.", ".######.", "..#..#..", "#.####.#", "########", "..####..", "..#..#..", ".#....#.", "##....##"]],
  espectro: [["..rrrrr..", ".rrrrrrr.", "rrorrrorr", "rrrrrrrrr", "rrrrrrrrr", "rr.rrr.rr", "r...r...r"], ["..rrrrr..", ".rrrrrrr.", "rrorrrorr", "rrrrrrrrr", "rrrrrrrrr", "r.rrr.rrr", "..r...r.."]],
  medusaR: BICHOS.medusa.map(rojo),
  cosaV: [["...r...", "..rrr..", "..rrr..", ".rrrrr.", ".rr#rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr.."], ["..rrr..", ".rrrrr.", "rrrrrrr", "rrrrrrr", ".rr#rr.", ".rrrrr.", "..rrr..", "..rrr..", "...r..."]],
  cosaO: [["..rrrr..", ".rrrrrr.", "rrr##rrr", "rr#oo#rr", "rr#oo#rr", "rrr##rrr", ".rrrrrr.", "..rrrr.."], ["..rrrr..", ".rr##rr.", "rr#rr#rr", "rr#oo#rr", "rr#oo#rr", "rr#rr#rr", ".rr##rr.", "..rrrr.."]],
  cosaD: [["rrr......", "r#r......", "rrrr.....", "...rr....", "....rr...", ".....rrrr", "......r#r", "......rrr"], ["......rrr", "......r#r", ".....rrrr", "....rr...", "...rr....", "rrrr.....", "r#r......", "rrr......"]],
  hueso: [["r...rr", ".r..rr", "..rr..", "..rr..", "rr..r.", "rr...r"], ["rr...r", "rr..r.", "..rr..", "..rr..", ".r..rr", "r...rr"]],
  bola: [[".rrr.", "rr#rr", "r###r", "rr#rr", ".rrr."], [".rrr.", "rrrrr", "rr#rr", "rrrrr", ".rrr."]],
  diente: [["rrrrrrr", "rrrrrrr", ".rrrrr.", ".rr#rr.", "..rrr..", "..rrr..", "...r...", "...r...", "......."]],
  hongo: [["..####..", ".##oo##.", "########", "#o####o#", "..####..", "..#..#..", ".######."]],
  vela: [["...r...", "..rrr..", "...r...", "..###..", "..#.#..", "..###..", "..###..", ".#####."]],
  vasija: [["..####..", "...##...", ".######.", "##.##.##", "########", "##.##.##", ".######."]],
  farol: [["...#...", "..###..", ".#####.", "##r#r##", "#rrrrr#", "##r#r##", ".#####.", "...#..."]],
});

// ── gemas: rombo rojo con brillo de tinta (la chica vale 2, la grande 10) ──
function gemaSpr(grande) {
  return grande ? selloSpr("gemaG", ["...r...", "..r#r..", ".rr#rr.", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."]) : selloSpr("gema", ["..r..", ".r#r.", "rrrrr", ".rrr.", "..r.."]);
}
function corazonSpr() { return selloSpr("cor", [".rr.rr.", "rrrrrrr", "r#rrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."]); }
function cargaSpr() { return selloSpr("carga", ["..###..", "#######", "#rrrrr#", "#rrrrr#", "#rrrrr#", "#rrrrr#", "#######"]); }
/** La cápsula de un módulo de arma: burbuja de tinta con la letra adentro. */
function capsulaSpr(letra) {
  return hornear(`caps|${letra}`, () => {
    const c = lienzoNuevo(15, 17), q = c.getContext("2d");
    q.fillStyle = C_TINTA; q.beginPath(); q.arc(7.5, 8.5, 7.5, 0, TAU); q.fill();
    q.fillStyle = C_FONDO; q.beginPath(); q.arc(7.5, 8.5, 6, 0, TAU); q.fill();
    q.drawImage(textoSpr(letra, "acento"), 2, 1);
    return c;
  });
}

// ── las baldosas (16×16) ──
const T = 16;
/** La roca, medida en las capturas del Play Store: la masa es NEGRA y sólo la cara que da al vacío
 *  es un empedrado apretado de adoquines blancos (3–7 × 2–3 px) con juntas negras de 1 px, lleno en
 *  el filo y que se desgrana hacia adentro. Con motas sueltas quedaba como estática de tele, y con la
 *  baldosa blanca entera el pozo encandilaba. Bits: 1 arriba, 2 derecha, 4 abajo, 8 izquierda, y las
 *  esquinas de adentro (16 ↖, 32 ↗, 64 ↘, 128 ↙) para que el empedrado no se corte en los rincones. */
const FILAS_ADOQ = [0, 4, 8, 12, 16];     // hiladas de 4 px (adoquín de 3 + junta): cierran justo en 16
function rocaSpr(bordes, v) {
  return hornear(`roca4|${bordes}|${v}`, () => {
    const c = lienzoNuevo(T, T), q = c.getContext("2d"), r = mulberry(100 + v * 31 + bordes * 7);
    q.fillStyle = C_FONDO; q.fillRect(0, 0, T, T);
    q.fillStyle = C_TINTA;
    if (!bordes) { if (r() < 0.5) q.fillRect(Math.floor(r() * T), Math.floor(r() * T), 1, 1); return c; }
    const dist = (x, y) => Math.min(
      bordes & 1 ? y : 99, bordes & 4 ? T - 1 - y : 99, bordes & 8 ? x : 99, bordes & 2 ? T - 1 - x : 99,
      bordes & 16 ? Math.hypot(x, y) : 99, bordes & 32 ? Math.hypot(T - 1 - x, y) : 99,
      bordes & 64 ? Math.hypot(T - 1 - x, T - 1 - y) : 99, bordes & 128 ? Math.hypot(x, T - 1 - y) : 99);
    // adoquines de 5 × 3 (a veces uno largo de 11) con las puntas comidas: a 3 × 2 se leía como tejido
    for (let fi = 0; fi < 4; fi++) {
      const y0 = FILAS_ADOQ[fi], alto = 3, corr = (fi + v) % 2 ? 3 : 0;
      for (let x0 = -corr; x0 < T; x0 += 6) {
        const largo = r() < 0.2 ? 11 : 5, d = dist(lim(x0 + largo / 2, 0, T - 1), y0 + 1);
        if (d > 11 || (d > 5 && r() < (d - 5) / 6 + 0.2)) { continue; }
        for (let y = 0; y < alto; y++) for (let x = 0; x < largo; x++) {
          const X = x0 + x, Y = y0 + y;
          if (X < 0 || X >= T) continue;
          const punta = (x === 0 || x === largo - 1) && (y === 0 || y === alto - 1);
          if (punta && r() < 0.6) continue;   // puntas comidas al azar: con las cuatro siempre salían pastillas
          q.fillRect(X, Y, 1, 1);
        }
        // una grieta o un poro adentro (el original tiene la piedra moteada)
        if (r() < 0.25) { q.fillStyle = C_FONDO; q.fillRect(x0 + 1 + Math.floor(r() * (largo - 2)), y0 + (r() < 0.5 ? 0 : alto - 1), 1, 1); q.fillStyle = C_TINTA; }
        if (largo === 11) x0 += 6;
      }
    }
    // migas sueltas donde se desgrana, para que el borde de adentro no quede recto
    for (let i = 0; i < 6; i++) { const x = Math.floor(r() * T), y = Math.floor(r() * T), d = dist(x, y); if (d > 5 && d < 11) q.fillRect(x, y, 1, 1); }
    // el filo que da al vacío, mordido (de cueva, no de ladrillo)
    q.fillStyle = C_FONDO;
    for (let i = 0; i < T; i++) if (r() < 0.22) { if (bordes & 1) q.fillRect(i, 0, 1, 1); if (bordes & 4) q.fillRect(i, T - 1, 1, 1); if (bordes & 8) q.fillRect(0, i, 1, 1); if (bordes & 2) q.fillRect(T - 1, i, 1, 1); }
    return c;
  });
}
/** El bloque que se rompe: un cuadrado de empedrado entero, con 1 px negro alrededor que lo separa del
 *  vecino (la pared, en cambio, es negra con empedrado sólo en la cara). Con un contorno de tinta
 *  parecía un cajón. El rojo trae gemas: se ve la gema. */
function bloqueSpr(tipo) {
  return hornear(`blq5|${tipo}`, () => {
    const c = lienzoNuevo(T, T), q = c.getContext("2d"), col = tipo === "gema" ? C_ACENTO : C_TINTA, r = mulberry(tipo === "gema" ? 9 : 3);
    q.fillStyle = C_FONDO; q.fillRect(0, 0, T, T);
    // una masa de piedra entera (14 × 14, puntas comidas) partida por juntas que zigzaguean, como el
    // empedrado suelto del original; con piedritas sueltas quedaba una grilla de lunares
    q.fillStyle = col; q.fillRect(1, 1, T - 2, T - 2);
    q.fillStyle = C_FONDO;
    q.fillRect(1, 1, 1, 1); q.fillRect(T - 2, 1, 1, 1); q.fillRect(1, T - 2, 1, 1); q.fillRect(T - 2, T - 2, 1, 1);
    for (const y0 of [5, 10]) {
      let y = y0;
      for (let x = 1; x < T - 1; x++) { q.fillRect(x, y, 1, 1); if (r() < 0.25) y = lim(y + (r() < 0.5 ? -1 : 1), y0 - 1, y0 + 1); }
    }
    for (let fi = 0; fi < 3; fi++) {   // juntas verticales corridas por hilada
      const ya = fi === 0 ? 1 : fi * 5 + 1, yb = fi === 2 ? T - 2 : fi * 5 + 5;
      for (let x = (fi % 2 ? 3 : 6) + Math.floor(r() * 2); x < T - 2; x += 6 + Math.floor(r() * 2)) q.fillRect(x, ya, 1, yb - ya);
    }
    for (let i = 0; i < 6; i++) q.fillRect(2 + Math.floor(r() * (T - 4)), 2 + Math.floor(r() * (T - 4)), 1, 1);
    if (tipo === "gema") { q.fillStyle = C_FONDO; q.fillRect(4, 4, 8, 8); q.fillStyle = C_TINTA; q.fillRect(7, 5, 2, 1); q.fillRect(6, 6, 4, 1); q.fillRect(5, 7, 6, 2); q.fillRect(6, 9, 4, 1); q.fillRect(7, 10, 2, 1); }
    return c;
  });
}
function plataformaSpr() {
  return hornear("plat", () => { const c = lienzoNuevo(T, 6), q = c.getContext("2d"); q.fillStyle = C_TINTA; q.fillRect(0, 0, T, 3); q.fillStyle = C_FONDO; for (let x = 1; x < T; x += 4) q.fillRect(x, 1, 2, 1); q.fillStyle = C_TINTA; q.fillRect(2, 3, 1, 3); q.fillRect(T - 3, 3, 1, 3); return c; });
}
function pinchesSpr() {
  return hornear("pinches", () => { const c = lienzoNuevo(T, T), q = c.getContext("2d"); q.fillStyle = C_ACENTO; for (let k = 0; k < 4; k++) for (let y = 0; y < 8; y++) { const w = Math.floor((y + 1) / 2); q.fillRect(k * 4 + 2 - w, 8 + y, w * 2, 1); } q.fillRect(0, 14, T, 2); return c; });
}

// ── íconos de mejoras y de la tienda (9×9) ──
const ICONOS = {
  manzana: ["....#....", "...#.....", ".rrrrrr..", "rr#rrrrr.", "r#rrrrrrr", "rrrrrrrrr", "rrrrrrrr.", ".rrrrrr..", "..rr.rr.."],
  agua: ["...###...", "...#.#...", "..#####..", ".#rrrrr#.", ".#rrrrr#.", ".#r#rrr#.", ".#rrrrr#.", ".#rrrrr#.", "..#####.."],
  bomba: [".....r#..", "....#....", "..####...", ".######..", "##o#####.", "#o######.", "########.", ".######..", "..####..."],
  cohete: ["....#....", "...###...", "..##o##..", "..#####..", "..#####..", ".#######.", "#..###..#", "...r.r...", "..r.r.r.."],
  vela: ["....r....", "...rrr...", "....r....", "...###...", "...#.#...", "...###...", "...###...", "..#####..", ".#######."],
  dron: ["#.......#", ".#.....#.", "..#####..", ".##o#o##.", ".#######.", "..#####..", "...r.r...", "..r...r..", "........."],
  iman: ["rr.....rr", "rr.....rr", "##.....##", "##.....##", "##.....##", "##.....##", ".##...##.", "..#####..", "...###..."],
  pila: ["...###...", ".#######.", ".#rrrrr#.", ".#rrrrr#.", ".#rr#rr#.", ".#rrrrr#.", ".#rrrrr#.", ".#rrrrr#.", ".#######."],
  pila2: ["..#...#..", "#########", "#rrr#rrr#", "#rrr#rrr#", "#r#r#r#r#", "#rrr#rrr#", "#rrr#rrr#", "#rrr#rrr#", "#########"],
  fiebre: ["...r.....", "..rrr....", ".rr#rr...", "rrrrrrr..", ".rrrrr.#.", "..rrr..##", "...r...##", "......###", ".....####"],
  pochoclo: ["..#.#.#..", ".#######.", "..#####..", ".r.r.r.r.", ".r.r.r.r.", ".rrrrrrr.", ".r.r.r.r.", ".rrrrrrr.", "..rrrrr.."],
  polvora: [".....r...", "....#....", ".#######.", ".#.#.#.#.", ".#######.", ".#.#.#.#.", ".#######.", ".#.#.#.#.", ".#######."],
  globo: ["..rr.rr..", ".rrrrrrr.", ".r#rrrrr.", ".rrrrrrr.", "..rrrrr..", "...rrr...", "....#....", "....#....", "...#....."],
  tenedor: ["#.#.#..#.", "#.#.#.##.", "#####.##.", ".###..##.", "..#...##.", "..#....#.", "..#....#.", "..#....#.", "..#....#."],
  mira: ["....r....", "....r....", "..#####..", ".#..r..#.", "rr.rrr.rr", ".#..r..#.", "..#####..", "....r....", "....r...."],
  tarjeta: ["#########", "#rrrrrrr#", "#########", "#.......#", "#.##.##.#", "#.......#", "#.####..#", "#.......#", "#########"],
  mochila: ["..#####..", ".#######.", ".##r#r##.", ".#######.", ".##r#r##.", ".#######.", "..#.#.#..", "..r.r.r..", ".r.r.r.r."],
  pan: ["..#####..", ".#######.", "#########", "#.#.#.#.#", "#########", "#########", ".#######.", ".........", "........."],
  guiso: [".#..#..#.", "..#..#...", ".#..#..#.", "#########", "#rrrrrrr#", "#rrrrrrr#", ".#rrrrr#.", "..#####..", "........."],
  soda: ["...##....", "...##....", "..####...", "..#rr#...", "..#rr#...", "..####...", "..#rr#...", "..#rr#...", "..####..."],
  aji: [".....##..", "....#....", "...rrr...", "..rrrr...", "..rr#r...", ".rrrrr...", ".rrrr....", "rrrr.....", "rr......."],
};
function iconoSpr(k) { return selloSpr("ico" + k, ICONOS[k] || ICONOS.pan); }

// ── los botones en pantalla, como el original en celular: dos flechas blancas en relieve y el botón
//    cuadrado de salto. Blancos con la cara de abajo tramada (el relieve) y acento al apretarlos. ──
function botonSpr(tipo, apretado) {
  return hornear(`btn|${tipo}|${apretado}`, () => {
    const w = tipo === "salto" ? 42 : 40, h = 28, c = lienzoNuevo(w, h + 4), q = c.getContext("2d");
    const cara = apretado ? C_ACENTO : C_TINTA;
    const forma = (x, y) => {
      if (tipo === "salto") return x >= 1 && x < w - 1 && y >= 1 && y < h - 1;
      const punta = 12, yy = Math.abs(y - h / 2 + 0.5);
      if (tipo === "izq") return x >= punta - (h / 2 - yy) * punta / (h / 2) && x < w - 1 && y >= 1 && y < h - 1;
      return x < w - punta + (h / 2 - yy) * punta / (h / 2) && x >= 1 && y >= 1 && y < h - 1;
    };
    const dy = apretado ? 2 : 0;
    // el relieve: la misma forma corrida 3 px abajo, tramada
    if (!apretado) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (forma(x, y)) for (let k = 1; k <= 3; k++) if ((x + y + k) % 2 === 0) { q.fillStyle = C_TINTA; q.fillRect(x, y + k, 1, 1); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (forma(x, y)) { q.fillStyle = cara; q.fillRect(x, y + dy, 1, 1); }
    // el borde de fondo para que se despegue del pozo
    q.fillStyle = C_FONDO;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (forma(x, y) && (!forma(x - 1, y) || !forma(x + 1, y) || !forma(x, y - 1))) q.fillRect(x, y + dy, 1, 1);
    return c;
  });
}
