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

// ── el protagonista (9×12, mira a la derecha) ──
const HEROE = {
  quieto: ["...####..", "..######.", "..####o#.", "..######.", "...####..", "..######.", ".#.####.#", "...####..", "...#..#..", "..rr.rr..", "..rr.rr..", ".rrr.rrr."],
  corre1: ["...####..", "..######.", "..####o#.", "..######.", "...####..", "..######.", ".#.####..", "...####.#", "..##..#..", ".rr...rr.", ".rr...rr.", "rrr...rrr"],
  corre2: ["...####..", "..######.", "..####o#.", "..######.", "...####..", "..######.", "..#####..", ".#.####.#", "...####..", "...rrr...", "...rrr...", "..rrrr..."],
  sube: ["...####..", "..######.", "..####o#.", "..######.", "...####..", ".########", "#..####..", "...####..", "..##..##.", "..rr..rr.", "..rr..rr.", "........."],
  cae: ["#..####.#", "#.######.", "#.####o#.", ".#######.", "...####..", "..######.", "...####..", "...####..", "..##..##.", ".rr....rr", ".rr....rr", "rrr....rr"],
  dispara: ["#..####.#", "#.######.", "#.####o#.", ".#######.", "...####..", "..######.", "...####..", "...####..", "...####..", "...rrrr..", "..rrrrrr.", "..rr..rr."],
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
/** La roca: tinta con motas de fondo; los bordes que dan al vacío se muerden (se ve rugosa, de cueva). */
function rocaSpr(bordes, v) {
  return hornear(`roca|${bordes}|${v}`, () => {
    const c = lienzoNuevo(T, T), q = c.getContext("2d"), r = mulberry(100 + v * 31 + bordes * 7);
    q.fillStyle = C_TINTA; q.fillRect(0, 0, T, T);
    q.fillStyle = C_FONDO;
    // motas: huequitos de 1 y 2 px (la textura de piedra de las capturas)
    // pocas motas y agrupadas (con muchas sueltas parecía estática de televisor)
    for (let i = 0; i < 4; i++) { const x = 1 + Math.floor(r() * (T - 3)), y = 1 + Math.floor(r() * (T - 3)); q.fillRect(x, y, 2, 1); if (r() < 0.5) q.fillRect(x + 1, y + 1, 1, 1); }
    if (r() < 0.5) { const x = 3 + Math.floor(r() * 9), y = 3 + Math.floor(r() * 9); q.fillRect(x, y, 3, 2); q.fillRect(x + 1, y + 2, 1, 1); }
    // mordidas en los lados abiertos: bit 1 arriba, 2 derecha, 4 abajo, 8 izquierda
    const morder = (lado) => { for (let i = 0; i < T; i++) { const d = r() < 0.45 ? 1 : r() < 0.2 ? 2 : 0; for (let k = 0; k < d; k++) { if (lado === 1) q.fillRect(i, k, 1, 1); if (lado === 4) q.fillRect(i, T - 1 - k, 1, 1); if (lado === 2) q.fillRect(T - 1 - k, i, 1, 1); if (lado === 8) q.fillRect(k, i, 1, 1); } } };
    for (const b of [1, 2, 4, 8]) if (bordes & b) morder(b);
    return c;
  });
}
/** El bloque que se rompe: cuadrado con reja; el rojo trae gemas adentro. */
function bloqueSpr(tipo) {
  return hornear(`blq|${tipo}`, () => {
    const c = lienzoNuevo(T, T), q = c.getContext("2d"), col = tipo === "gema" ? C_ACENTO : C_TINTA;
    q.fillStyle = col; q.fillRect(0, 0, T, T); q.fillStyle = C_FONDO; q.fillRect(1, 1, T - 2, T - 2);
    q.fillStyle = col; q.fillRect(2, 2, T - 4, T - 4); q.fillStyle = C_FONDO;
    for (let y = 3; y < T - 3; y++) for (let x = 3; x < T - 3; x++) if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) q.fillRect(x, y, 1, 1);
    if (tipo === "gema") { q.fillStyle = C_TINTA; q.fillRect(7, 5, 2, 1); q.fillRect(6, 6, 4, 1); q.fillRect(5, 7, 6, 2); q.fillRect(6, 9, 4, 1); q.fillRect(7, 10, 2, 1); }
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
