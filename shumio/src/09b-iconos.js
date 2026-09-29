// ─────────────────────────────────────────────────────────────────────────────
// LOS ÍCONOS NUEVOS (armas, modificadores, familiares, activos, baratijas) y los sprites de las
// armas (cuchillo, misil, diente, aguja, hueso), con el mismo pintor y la misma luz que el resto:
// cada objeto se tiene que reconocer por la silueta sobre el pedestal, como en el original.
// ─────────────────────────────────────────────────────────────────────────────

const R_ = {
  blanco: ["#6e6a66", "#a8a39c", "#d6d2ca", "#f4f1ea", "#ffffff"], rosa: ["#5a1a30", "#9a3a5c", "#d86a8e", "#f2a0bc", "#ffd6e4"],
  negro: ["#050406", "#141018", "#26202c", "#3c3444", "#5a5064"], verde: ["#0f200c", "#255a1c", "#44922c", "#86d04a", "#d8ff9a"],
  choco: ["#1a0c06", "#3a1c0c", "#5e3218", "#8a5230", "#b87e52"], rojoV: ["#3a0408", "#7a0a10", "#c01a1a", "#f03a2a", "#ff9a7a"],
  cian: ["#062a30", "#0e5a66", "#1e9aa8", "#5ad6de", "#c8fbff"],
};
/** Pie de cosas chicas que se repiten: caritas, frascos, libros, leches, gusanos. */
const DIB = {
  carita(p, x, y, r, piel, o = {}) {
    p.bola(x, y, r, r * 0.95, piel, {});
    const e = o.ojos || PAL.tinta;
    p.p(x - r * 0.4, y - 0.5, e); p.p(x + r * 0.35, y - 0.5, e);
    if (o.boca) p.p(x, y + r * 0.45, o.boca);
    if (o.cuernos) { p.p(x - r * 0.7, y - r - 0.5, o.cuernos); p.p(x + r * 0.6, y - r - 0.5, o.cuernos); p.p(x - r * 0.8, y - r + 0.5, o.cuernos); p.p(x + r * 0.7, y - r + 0.5, o.cuernos); }
  },
  frasco(p, liquido, o = {}) {
    p.bola(9, 11, 5.5, 5.5, ["#3a4a52", "#6e8894", "#a8c4d0", "#e0f0f6"], {});
    p.bola(9, 12, 4.6, 4, liquido, { filtro: (x, y) => y >= 10 });
    p.caja(7, 3, 4, 4, PAL.hierro.slice(1));
    p.rect(6, 2, 6, 1, PAL.tierra[3]);
    p.p(7, 9, "#ffffff");
    if (o.cruz) { p.rect(8, 11, 3, 1, o.cruz); p.rect(9, 10, 1, 3, o.cruz); }
  },
  libro(p, tapa, simbolo) {
    p.caja(3, 3, 12, 13, tapa, { vertical: 0.5 });
    p.rect(3, 3, 2, 13, tapa[0]);
    p.rect(14, 4, 1, 11, "#e8dcc0"); p.rect(4, 15, 10, 1, "#e8dcc0");
    if (simbolo) simbolo(p);
  },
  leche(p, liquido, tapa, marca) {
    p.caja(5, 5, 8, 11, ["#9a968e", "#d6d2ca", "#f4f1ea", "#ffffff"], { vertical: 0.2 });
    p.sello(5, 2, ["..xxxx..", ".xxxxxx.", "xxxxxxxx"], { x: tapa });
    p.rect(6, 9, 6, 4, liquido[2]); p.rect(6, 9, 6, 1, liquido[3]);
    if (marca) p.p(8.5, 11, marca);
  },
  gusano(p, rampa, forma) {
    const pts = forma;
    pts.forEach(([x, y], i) => p.bola(x, y, 2.1 - i * 0.08, 2.1 - i * 0.08, rampa, {}));
    const [hx, hy] = pts[0]; p.p(hx - 1, hy - 1, PAL.tinta); p.p(hx + 1, hy - 1, PAL.tinta);
  },
  ojo(p, iris, o = {}) {
    p.bola(9, 9, o.rx || 7, o.ry || 5.5, R_.blanco, {});
    p.bola(9, 9, o.ri || 3, o.ri || 3, iris, {});
    p.bola(9, 9, 1.4, 1.4, [PAL.tinta, "#2a1a20"], {});
    p.p(8, 8, "#ffffff");
    if (o.venas) for (const [x0, y0, x1, y1] of [[3, 8, 5, 9], [14, 10, 12, 9], [5, 12, 6, 11]]) p.linea(x0, y0, x1, y1, "#c02a2a");
  },
  moscaRoja(p, x, y) { p.bola(x, y, 3, 2.6, PAL.sangre, {}); p.bola(x - 2, y - 3, 2, 1.5, ["#8a9aa8", "#c8d6e0", "#f0f6fa"], {}); p.bola(x + 2, y - 3, 2, 1.5, ["#8a9aa8", "#c8d6e0", "#f0f6fa"], {}); p.p(x - 1, y, PAL.tinta); p.p(x + 1, y, PAL.tinta); },
};

Object.assign(ICONOS, {
  // ── cuentas ──
  cebolla(p) { p.bola(9, 11, 6, 5.5, ["#5a3a1a", "#9a6a2a", "#d6a24a", "#f0d08a", "#fff0c8"], {}); p.linea(9, 5, 9, 2, "#6a8a3a"); p.linea(10, 5, 12, 1, "#86a84a"); p.p(6, 11, "#3a78c0"); p.p(6, 12, "#5a98e0"); p.p(11, 11, "#3a78c0"); p.p(11, 12, "#5a98e0"); p.p(8, 14, PAL.tinta); p.p(9, 14, PAL.tinta); },
  hongoAzul(p) { p.bola(9, 8, 8, 6, PAL.azul, { filtro: (x, y) => y <= 9 }); p.caja(6, 10, 6, 6, PAL.crema); for (const [x, y] of [[5, 5], [9, 3], [13, 6], [8, 7]]) p.p(x, y, "#dfe8ff"); },
  hongoChico(p) { p.bola(9, 10, 5, 4, PAL.hongo, { filtro: (x, y) => y <= 11 }); p.caja(7, 12, 4, 4, PAL.crema); p.p(7, 8, PAL.crema[3]); p.p(10, 7, PAL.crema[3]); },
  hongoRaro(p) { p.bola(9, 6, 4, 4, PAL.violeta, { filtro: (x, y) => y <= 7 }); p.caja(8, 7, 2, 9, PAL.crema); p.bola(9, 6, 1, 1, ["#ffe07a", "#fff"], {}); p.p(6, 5, PAL.violeta[4]); },
  unaVidaMas(p) { p.bola(9, 8, 8, 6, PAL.musgo.slice(1).concat("#a8d890"), { filtro: (x, y) => y <= 9 }); p.caja(6, 10, 6, 6, PAL.crema); for (const [x, y] of [[4, 6], [9, 3], [14, 6]]) { p.bola(x, y, 1.6, 1.6, R_.blanco.slice(2), {}); } p.p(7, 12, PAL.tinta); p.p(10, 12, PAL.tinta); },
  hormonas(p) { p.caja(4, 6, 10, 6, ["#6e8894", "#a8c4d0", "#e0f0f6"], { vertical: 0.3 }); p.rect(5, 7, 6, 4, "#e05a2a"); p.rect(14, 8, 3, 2, PAL.hierro[3]); p.rect(1, 8, 3, 2, PAL.hierro[4]); p.linea(0, 9, -2, 9, PAL.hierro[4]); p.rect(2, 5, 1, 8, PAL.hierro[2]); },
  bolaVeloz(p) { p.bola(10, 9, 5.5, 5.5, ["#1a3a6a", "#2a5aa8", "#4a86e0", "#8ab8ff", "#e0eeff"], {}); for (const y of [6, 9, 12]) p.linea(1, y, 4, y, "#8ab8ff"); p.linea(7, 5, 13, 13, "#e0eeff"); },
  cabezaGrillo(p) { p.bola(9, 9, 6.5, 6, ["#3a0a0a", "#6a1a14", "#9a2a1e", "#c84a2e", "#f07a4a"], {}); p.linea(6, 3, 3, 0, "#3a0a0a"); p.linea(12, 3, 15, 0, "#3a0a0a"); p.bola(6.5, 9, 1.6, 2, ["#ffe07a", "#fff8c8"], {}); p.bola(11.5, 9, 1.6, 2, ["#ffe07a", "#fff8c8"], {}); p.linea(7, 13, 11, 13, PAL.tinta); },
  pentagrama(p) { const pts = [0, 1, 2, 3, 4].map((k) => [9 + Math.cos(-Math.PI / 2 + k * TAU / 5) * 7, 9.5 + Math.sin(-Math.PI / 2 + k * TAU / 5) * 7]); for (let k = 0; k < 5; k++) { const a = pts[k], b = pts[(k + 2) % 5]; p.linea(a[0], a[1], b[0], b[1], "#d0201c"); } for (let a = 0; a < 24; a++) p.p(9 + Math.cos(a / 24 * TAU) * 8, 9.5 + Math.sin(a / 24 * TAU) * 8, "#7a0a10"); },
  marca(p) { p.bola(9, 9, 7, 7, ["#3a0408", "#7a0a10", "#a8141a"], {}); p.sello(5, 4, ["..#..#..", "..#..#..", "########", "..#..#..", "..#..#..", "########", "..#..#..", "..#..#.."], { "#": "#ff6a5a" }); },
  elPacto(p) { p.caja(3, 2, 12, 15, ["#8a7a60", "#c8b89a", "#ecdfc8", "#f8f0e0"], { vertical: 0.3 }); for (let y = 4; y < 12; y += 2) p.linea(5, y, 12, y, "#8a7a60"); p.linea(5, 14, 10, 13, "#a8141a"); p.bola(12, 13, 1.8, 1.8, PAL.sangre.slice(1), {}); },
  sangreMartir(p) { p.bola(9, 11, 5.5, 5, PAL.sangre, {}); for (let i = 0; i < 5; i++) p.p(9, 3 + i, PAL.sangre[3 - (i > 2 ? 1 : 0)]); p.bola(9, 5, 5, 1.5, PAL.oro.slice(2), { filtro: (x, y) => Math.abs(y - 5) >= 1 }); p.p(7, 9, "#ffd0c0"); },
  aureola(p) { for (let a = 0; a < 40; a++) { const an = a / 40 * TAU, x = 9 + Math.cos(an) * 7, y = 9 + Math.sin(an) * 3.2; p.p(x, y, an < Math.PI ? PAL.oro[3] : PAL.oro[4]); p.p(x, y + 1, PAL.oro[2]); } },
  rosario(p) { for (let a = 0; a < 14; a++) { const an = a / 14 * TAU; p.bola(9 + Math.cos(an) * 5.5, 7 + Math.sin(an) * 5, 1.2, 1.2, ["#5a3a1a", "#9a6a3a", "#d6a26a"], {}); } p.rect(8, 12, 2, 6, PAL.oro[3]); p.rect(6, 14, 6, 2, PAL.oro[3]); },
  corazonSagrado(p) { ICONOS._copiar(p, corazonSpr("rojo"), 4, 5); p.bola(9, 3, 3, 1.2, PAL.oro.slice(2), {}); for (const [x, y] of [[2, 5], [16, 5], [1, 10], [17, 10]]) p.p(x, y, PAL.oro[4]); },
  // ── armas ──
  rayo(p) { p.bola(9, 6, 6, 5, ["#2a0406", "#5a0a0e", "#8a1418", "#b82a2a", "#e05a4a"], {}); p.p(6, 6, "#fff0e0"); p.p(11, 6, "#fff0e0"); p.rect(7, 10, 4, 7, "#c8141a"); p.rect(8, 10, 2, 7, "#ff8a6a"); p.p(4, 1, "#3a0408"); p.p(13, 1, "#3a0408"); p.p(5, 2, "#3a0408"); p.p(12, 2, "#3a0408"); },
  laser(p) { DIB.ojo(p, R_.rojoV, { rx: 6, ry: 4.5, ri: 2.6 }); p.rect(3, 13, 12, 2, PAL.hierro[3]); p.rect(3, 3, 12, 2, PAL.hierro[3]); p.rect(3, 3, 1, 12, PAL.hierro[2]); p.rect(14, 3, 1, 12, PAL.hierro[2]); for (const x of [5, 9, 13]) p.p(x, 14, "#ff4a5a"); },
  anillo(p) { for (let a = 0; a < 40; a++) { const an = a / 40 * TAU; p.p(9 + Math.cos(an) * 7, 9 + Math.sin(an) * 6, "#ff3a4a"); p.p(9 + Math.cos(an) * 6, 9 + Math.sin(an) * 5, "#ffc0c8"); } p.bola(9, 9, 2, 2, ["#6a0a10", "#c01a2a", "#ff6a7a"], {}); },
  feto(p) { p.bola(9, 9, 7, 7, ["#3a4a52", "#6e8894", "#a8c4d0", "#e0f0f6"], {}); p.bola(9, 10, 4.5, 4, PAL.piel, {}); p.bola(11, 8, 2.5, 2.5, PAL.piel, {}); p.p(12, 8, PAL.tinta); ICONOS._copiar(p, bombaSpr(0.5), 2, 7); p.p(6, 5, "#ffffff"); },
  epico(p) { p.caja(7, 2, 4, 11, PAL.hierro.slice(1), { vertical: 0.2 }); p.bola(9, 2.5, 2, 2, ["#6a0a10", "#c01a1a", "#f05a4a"], {}); p.sello(5, 11, ["#......#", "##....##", "###..###"], { "#": PAL.sangre[3] }); p.rect(8, 14, 2, 3, PAL.fuego[3]); p.p(8, 17, PAL.fuego[4]); p.p(9, 16, PAL.fuego[4]); },
  ludovico(p) { p.bola(9, 9, 6.5, 6.5, PAL.espora, {}); for (let a = 0; a < 28; a++) { const an = a / 28 * TAU; p.p(9 + Math.cos(an) * 8, 9 + Math.sin(an) * 8, (a & 1) ? PAL.espora[3] : null); } p.p(7, 6, "#ffffff"); p.p(6, 7, "#ffffff"); },
  cuchillo(p) {   // la hoja en diagonal (clara arriba, gris abajo), la guarda y el mango de madera
    for (let i = 0; i < 10; i++) { p.p(7 + i, 10 - i, "#f4f6f8"); p.p(7 + i, 11 - i, "#c8ced4"); p.p(8 + i, 11 - i, "#8a929a"); }
    p.linea(4, 9, 8, 13, PAL.hierro[3]);
    for (let i = 0; i < 5; i++) { p.p(2 + i, 15 - i, PAL.tierra[3]); p.p(3 + i, 15 - i, PAL.tierra[4]); p.p(2 + i, 16 - i, PAL.tierra[2]); }
  },
  // ── lágrimas ──
  cuadruple(p) { p.bola(9, 9, 4, 3.5, R_.negro.slice(1), {}); for (const s of [-1, 1]) for (const k of [0, 1, 2, 3]) { const y = 6 + k * 2; p.linea(9 + s * 3, y, 9 + s * 7, y - 2 + k, R_.negro[2]); } for (const [x, y] of [[7, 8], [11, 8], [8, 10], [10, 10]]) p.p(x, y, "#ff3a2a"); },
  veinte(p) { for (const x of [5, 13]) { p.bola(x, 9, 3.6, 3.6, ["#9fd6ee", "#cfefff", "#ffffff"], {}); for (let a = 0; a < 20; a++) p.p(x + Math.cos(a / 20 * TAU) * 4, 9 + Math.sin(a / 20 * TAU) * 4, PAL.tierra[2]); } p.linea(8, 8, 10, 8, PAL.tierra[2]); p.linea(1, 8, 0, 6, PAL.tierra[2]); p.linea(17, 8, 18, 6, PAL.tierra[2]); p.rect(3, 9, 5, 1, "#5a8aa8"); p.rect(11, 9, 5, 1, "#5a8aa8"); },
  polifemo(p) { DIB.ojo(p, PAL.hongo, { rx: 8, ry: 7, ri: 4.2, venas: true }); },
  soja(p) { DIB.leche(p, ["#b8b4a8", "#d8d4c8", "#f0ece0", "#fffff4"], "#5a8a3a", "#5a8a3a"); p.bola(9, 12, 1.3, 1, ["#6a8a3a", "#9ac05a"], {}); },
  almendra(p) { DIB.leche(p, ["#c8b090", "#e0cca8", "#f4e6cc", "#fff8ea"], "#8a5a2a", "#8a5a2a"); p.bola(9, 11, 1.6, 1.1, ["#6a4020", "#9a6a3a", "#c89a6a"], {}); },
  choco(p) { DIB.leche(p, R_.choco, "#5e3218", "#fff"); p.caja(6, 9, 6, 4, R_.choco.slice(1)); p.p(7, 10, R_.choco[4]); },
  pulmon(p) { for (const s of [-1, 1]) p.bola(9 + s * 3.5, 10, 3.6, 6, ["#5a0a1a", "#9a2a3a", "#d85a6a", "#f8a0a8"], {}); p.rect(8, 1, 2, 6, "#e8c8c0"); p.linea(9, 6, 6, 8, "#e8c8c0"); p.linea(9, 6, 12, 8, "#e8c8c0"); },
  ipecac(p) { DIB.frasco(p, R_.verde); p.sello(7, 11, ["x.x", ".x.", "x.x"], { x: PAL.tinta }); },
  hemo(p) { p.bola(9, 10, 6.5, 6.5, ["#2a0406", "#5c0c12", "#8a1418", "#b82a2a"], {}); for (const [x, y] of [[2, 3], [15, 4], [1, 14], [16, 15], [9, 1]]) p.bola(x, y, 1.3, 1.3, PAL.sangre.slice(2), {}); p.p(7, 8, "#f08a7a"); },
  proptosis(p) { for (const [x, y] of [[5, 7], [13, 7]]) { p.bola(x, y, 4, 4, R_.blanco, {}); p.bola(x, y + 0.5, 2, 2, PAL.hongo, {}); p.p(x, y + 0.5, PAL.tinta); } p.linea(5, 11, 7, 16, "#c02a2a"); p.linea(13, 11, 11, 16, "#c02a2a"); },
  carbon(p) { p.bola(9, 10, 6.5, 5.5, R_.negro, { luz: [-0.4, -0.8, 0.4] }); for (const [x, y] of [[6, 8], [11, 7], [9, 12]]) p.p(x, y, "#6a6474"); p.p(5, 7, "#8a8494"); },
  ojoMuerto(p) { DIB.ojo(p, ["#3a3a3a", "#6a6a6a", "#9a9a9a"], { rx: 7, ry: 5.5, ri: 3 }); p.linea(3, 3, 15, 15, PAL.sangre[3]); p.linea(15, 3, 3, 15, PAL.sangre[3]); },
  planeta(p) { p.bola(9, 9, 5, 5, ["#1a2a5a", "#2a4a9a", "#4a7ad0", "#8ab4f0"], {}); for (let a = 0; a < 36; a++) { const an = a / 36 * TAU, x = 9 + Math.cos(an) * 8.5, y = 9 + Math.sin(an) * 2.5; if (!(an > Math.PI && Math.abs(x - 9) < 5)) p.p(x, y, "#d6c69a"); } p.p(7, 6, "#e0eeff"); },
  espejo(p) { p.bola(9, 8, 6, 7, ["#5a4a1a", "#9a7a2a", "#d0a83a"], {}); p.bola(9, 8, 4.6, 5.6, ["#6a8aa0", "#a8c8dc", "#dff0fa"], {}); p.rect(8, 15, 2, 3, PAL.oro[2]); p.linea(7, 5, 10, 11, "#ffffff"); },
  bucle(p) { for (let a = 0; a < 60; a++) { const t = a / 60 * TAU, x = 9 + 7 * Math.sin(t), y = 9 + 4.5 * Math.sin(t) * Math.cos(t) * 1.6; p.p(x, y, "#8a5cc0"); p.p(x, y + 1, "#c19ae8"); } },
  antigrav(p) { for (const [x, y] of [[5, 5], [12, 4], [8, 10], [14, 11]]) p.bola(x, y, 2.4, 2.4, PAL.espora.slice(1), {}); for (const x of [3, 8, 13]) p.linea(x, 14, x, 17, "#8ab4f0"); p.linea(2, 15, 3, 14, "#8ab4f0"); p.linea(4, 15, 3, 14, "#8ab4f0"); },
  grillo(p) { p.bola(9, 11, 5, 4.5, ["#3a0a0a", "#6a1a14", "#9a2a1e", "#c84a2e"], {}); p.bola(9, 5.5, 3, 2.6, ["#3a0a0a", "#6a1a14", "#9a2a1e", "#c84a2e"], {}); for (const s of [-1, 1]) { p.linea(9 + s * 4, 11, 9 + s * 8, 7, "#3a0a0a"); p.linea(9 + s * 3, 14, 9 + s * 7, 17, "#3a0a0a"); } },
  parasito(p) { DIB.gusano(p, R_.rosa.slice(1), [[5, 5], [7, 7], [9, 9], [11, 11], [13, 13]]); p.bola(13, 5, 2, 2, PAL.espora.slice(2), {}); p.bola(5, 13, 2, 2, PAL.espora.slice(2), {}); },
  fractura(p) { p.linea(3, 14, 12, 5, R_.blanco[3]); p.linea(4, 14, 13, 5, R_.blanco[2]); p.bola(3, 15, 2, 2, R_.blanco.slice(2), {}); p.bola(13, 4, 2, 2, R_.blanco.slice(2), {}); p.linea(9, 6, 11, 10, PAL.sangre[3]); p.p(14, 8, R_.blanco[3]); p.p(15, 10, R_.blanco[3]); },
  pegajosa(p) { p.bola(9, 10, 6, 5.5, R_.verde.slice(1), {}); ICONOS._copiar(p, bombaSpr(0.55), 3, 1); for (const [x, y] of [[4, 15], [13, 15]]) p.linea(x, y - 1, x, y + 1, R_.verde[3]); },
  raizElectrica(p) { p.linea(9, 1, 6, 7, "#ffe07a"); p.linea(6, 7, 11, 9, "#ffe07a"); p.linea(11, 9, 7, 16, "#ffe07a"); p.linea(10, 1, 7, 7, "#fff8c8"); p.linea(7, 7, 12, 9, "#fff8c8"); for (const [x, y] of [[3, 12], [14, 4], [15, 12]]) p.p(x, y, "#c8e8ff"); },
  luzSanta(p) { p.bola(9, 9, 5, 5, ["#6a8aa0", "#a8d4ee", "#e0f6ff", "#ffffff"], {}); for (let a = 0; a < 8; a++) { const an = a * TAU / 8; p.linea(9 + Math.cos(an) * 6, 9 + Math.sin(an) * 6, 9 + Math.cos(an) * 8.5, 9 + Math.sin(an) * 8.5, "#bfe6ff"); } },
  amorDuro(p) { p.sello(4, 2, [".######.", "########", "########", "########", "#######.", "##..###.", "##...##.", ".#....#.", ".#....#."], { "#": "x" }); for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) if (p.g(x, y)) p.p(x, y, x < 7 && y < 6 ? "#ffffff" : y > 7 ? "#c8bca8" : "#ece4d4"); },
  eutanasia(p) { p.linea(2, 16, 12, 6, PAL.hierro[4]); p.caja(10, 3, 5, 5, ["#6e8894", "#a8c4d0", "#e0f0f6"]); p.rect(11, 4, 3, 3, "#9a2a2a"); p.linea(14, 2, 16, 0, PAL.hierro[3]); p.p(1, 17, "#ffffff"); },
  picadura(p) { p.bola(9, 10, 4, 3.5, R_.negro.slice(1), {}); for (const s of [-1, 1]) for (const k of [0, 1, 2]) p.linea(9 + s * 3, 8 + k * 2, 9 + s * 7, 6 + k * 3, R_.negro[2]); p.linea(8, 13, 8, 16, "#e8e8e8"); p.linea(10, 13, 10, 16, "#e8e8e8"); p.p(8, 9, "#ff3a2a"); p.p(10, 9, "#ff3a2a"); },
  materiaOscura(p) { p.bola(9, 9, 7, 7, R_.negro, {}); for (let a = 0; a < 12; a++) { const an = a / 12 * TAU + 0.3; p.p(9 + Math.cos(an) * (3 + a % 3), 9 + Math.sin(an) * (3 + a % 3), a % 2 ? "#5a3a8a" : "#8a5cc0"); } p.p(9, 9, "#c19ae8"); },
  lentesAbuela(p) { for (const x of [5, 13]) { p.bola(x, 9, 3.5, 3, ["#8ad0c0", "#c8f0e8", "#f0fffa"], {}); for (let a = 0; a < 20; a++) p.p(x + Math.cos(a / 20 * TAU) * 4, 9 + Math.sin(a / 20 * TAU) * 3.5, "#d86a8e"); } p.linea(8, 8, 10, 8, "#d86a8e"); },
  perfumeAbuela(p) { p.bola(9, 12, 5, 4.5, R_.rosa, {}); p.caja(8, 5, 2, 3, PAL.oro.slice(2)); p.bola(9, 3.5, 2, 1.6, PAL.oro.slice(2), {}); p.bola(14, 3, 2, 1.6, R_.rosa.slice(2), {}); p.linea(11, 4, 13, 3, "#8a4a5a"); p.p(7, 10, "#fff"); },
  labialAbuela(p) { p.caja(6, 9, 6, 8, PAL.oro.slice(1)); p.caja(7, 4, 4, 5, PAL.sangre.slice(1)); p.sello(7, 2, ["..##", ".###", "####"], { "#": PAL.sangre[3] }); p.p(8, 5, PAL.sangre[4]); },
  tacosAbuela(p) { p.sello(1, 5, ["......####", ".....#####", "....######", "###.######", "##########", "#########.", "#.......#.", "#.......#."], { "#": "x" }); for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) if (p.g(x, y)) p.p(x, y, y < 9 ? "#d0201c" : y < 11 ? "#8a0a10" : "#3a0408"); },
  liquido(p) { DIB.frasco(p, ["#0a2a10", "#1a5a2a", "#3a9a4a", "#7ad08a"]); p.p(8, 12, "#c8ffd0"); p.p(10, 13, "#c8ffd0"); },
  cabezaTendero(p) { DIB.carita(p, 9, 10, 6.5, ["#3a3a3a", "#6a6a6a", "#9a9a9a", "#c8c8c8"], { ojos: "#fff", boca: "#1a1a1a" }); ICONOS._copiar(p, monedaSpr(0), 4, 0); p.linea(5, 14, 13, 14, PAL.tinta); for (const x of [6, 8, 10, 12]) p.p(x, 15, PAL.tinta); },
  atractor(p) { p.bola(9, 9, 6, 6, ["#1a1a3a", "#2a2a6a", "#4a4aa8"], {}); for (let a = 0; a < 3; a++) for (let r = 2; r < 8; r += 0.5) p.p(9 + Math.cos(a * TAU / 3 + r * 0.6) * r, 9 + Math.sin(a * TAU / 3 + r * 0.6) * r, "#c8c8ff"); },
  piscis(p) { p.bola(8, 9, 6, 4, ["#1a3a5a", "#2a6a9a", "#4a9ad0", "#9ad0f0"], {}); p.sello(13, 5, ["#..", "##.", "###", "##.", "#.."], { "#": "#4a9ad0" }); p.sello(13, 9, ["###", "##.", "#.."], { "#": "#2a6a9a" }); p.p(4, 8, PAL.tinta); p.p(3, 7, "#fff"); },
  ojoBelial(p) { DIB.ojo(p, PAL.sangre, { rx: 7.5, ry: 4.5, ri: 2.6 }); for (const x of [3, 6, 9, 12, 15]) p.linea(x, 5, x + (x - 9) * 0.2, 2, R_.negro[2]); },
  cabezaDivina(p) { p.bola(9, 10, 6, 6, ["#8a7a60", "#c8b89a", "#ecdfc8", "#fff8ea"], {}); for (let a = 0; a < 30; a++) { const an = a / 30 * TAU; p.p(9 + Math.cos(an) * 8, 3.5 + Math.sin(an) * 2, PAL.oro[3]); } p.p(7, 10, PAL.tinta); p.p(11, 10, PAL.tinta); p.bola(9, 3.5, 1.5, 1, PAL.oro.slice(3), {}); },
  virus(p) { p.bola(9, 9, 5, 5, R_.verde.slice(1), {}); for (let a = 0; a < 8; a++) { const an = a * TAU / 8; p.linea(9 + Math.cos(an) * 5, 9 + Math.sin(an) * 5, 9 + Math.cos(an) * 8, 9 + Math.sin(an) * 8, R_.verde[2]); p.p(9 + Math.cos(an) * 8, 9 + Math.sin(an) * 8, R_.verde[4]); } p.p(8, 8, R_.verde[4]); },
  // ── vuelo y más ──
  palomaMuerta(p) { p.bola(9, 10, 6, 4, R_.blanco, {}); p.bola(13, 7, 2.8, 2.6, R_.blanco, {}); p.sello(15, 7, ["#"], { "#": PAL.oro[3] }); p.sello(12, 6, ["x"], { x: PAL.tinta }); p.bola(6, 6, 4, 2.5, R_.blanco.slice(1), {}); p.linea(3, 13, 5, 16, R_.blanco[1]); },
  espirituNoche(p) { p.bola(9, 8, 6, 6, R_.negro.slice(1), { filtro: (x, y) => y < 11 }); p.rect(3, 10, 12, 4, R_.negro[2]); for (const x of [3, 7, 11]) { p.p(x, 14, R_.negro[2]); p.p(x + 1, 15, R_.negro[2]); } p.sello(6, 7, ["e..e"], { e: "#ff3a2a" }); for (const s of [-1, 1]) p.bola(9 + s * 7, 7, 2.5, 4, R_.negro.slice(1), {}); },
  maldicionPodrida(p) { ICONOS._copiar(p, bombaSpr(1), 1, 0); p.sello(4, 8, ["..v.", ".vvv", "..v."], { v: R_.verde[3] }); p.bola(13, 14, 2, 2, R_.verde.slice(1), {}); },
  colaGato(p) { for (let i = 0; i < 14; i++) { const x = 3 + i, y = 15 - Math.sin(i / 14 * Math.PI * 1.3) * 11; p.bola(x, y, 1.8, 1.8, ["#3a2a1a", "#6a4a2a", "#9a7a4a", "#c8a87a"], {}); } p.bola(16, 4, 2, 2, ["#9a7a4a", "#f0e0c0"], {}); },
  gatoMuerto(p) { DIB.carita(p, 9, 10, 6, ["#1a1a1a", "#3a3a3a", "#5a5a5a", "#7a7a7a"], { ojos: "#fff" }); p.sello(3, 2, ["#.......#.", "##.....##.", "###...###."], { "#": "#3a3a3a" }); p.sello(5, 8, ["x.x...x.x", ".x.....x.", "x.x...x.x"], { x: "#ffffff" }); for (const s of [-1, 1]) { p.linea(9 + s * 4, 12, 9 + s * 8, 11, "#9a9a9a"); p.linea(9 + s * 4, 13, 9 + s * 8, 14, "#9a9a9a"); } },
  pajaroMuerto(p) { p.bola(9, 11, 6, 4, R_.negro.slice(1), {}); p.bola(13, 8, 3, 2.8, R_.negro.slice(1), {}); p.sello(16, 8, ["#"], { "#": PAL.oro[3] }); p.sello(12, 7, ["x.", ".x"], { x: "#ffffff" }); p.linea(6, 15, 5, 17, PAL.oro[2]); p.linea(9, 15, 9, 17, PAL.oro[2]); },
  bebeArana(p) { DIB.carita(p, 9, 10, 5.5, R_.negro.slice(1), { ojos: "#ff3a2a" }); for (const s of [-1, 1]) for (const k of [0, 1, 2]) p.linea(9 + s * 5, 8 + k * 2.5, 9 + s * 8.5, 5 + k * 4, R_.negro[2]); },
  // ── familiares ──
  admiradora(p) { DIB.moscaRoja(p, 9, 10); for (let a = 0; a < 30; a++) { const an = a / 30 * TAU; if (a % 3) p.p(9 + Math.cos(an) * 8, 9 + Math.sin(an) * 7, "#c8a8a8"); } },
  coronaMoscas(p) { for (let a = 0; a < 5; a++) { const an = a / 5 * TAU; ICONOS._copiar(p, tinte(mosquinSpr(0), "rgba(110,170,255,0.55)"), 5 + Math.cos(an) * 5, 5 + Math.sin(an) * 4, 0.55); } },
  angelGuardian(p) { DIB.carita(p, 9, 10, 5, PAL.piel, { boca: "#c06a6a" }); for (const s of [-1, 1]) p.bola(9 + s * 6.5, 9, 2.5, 4.5, R_.blanco.slice(1), {}); for (let a = 0; a < 20; a++) p.p(9 + Math.cos(a / 20 * TAU) * 4, 3.5 + Math.sin(a / 20 * TAU) * 1.3, PAL.oro[3]); },
  bolaPelos(p) { p.bola(9, 10, 6.5, 6, ["#3a2a1a", "#6a4a2a", "#9a7a4a", "#c8a87a"], {}); for (let a = 0; a < 16; a++) { const an = a / 16 * TAU; p.p(9 + Math.cos(an) * 7.5, 10 + Math.sin(an) * 7, "#6a4a2a"); } p.linea(9, 4, 12, 0, "#6a4a2a"); },
  hermanita(p) { DIB.carita(p, 9, 10, 6, PAL.piel, { boca: "#8a3a3a" }); p.bola(9, 5, 6, 3, PAL.sangre.slice(1), { filtro: (x, y) => y <= 6 }); p.bola(3, 8, 2, 3, PAL.sangre.slice(1), {}); p.bola(15, 8, 2, 3, PAL.sangre.slice(1), {}); },
  bebeDemonio(p) { DIB.carita(p, 9, 10, 6, ["#1a0a0a", "#3a1414", "#5a2222", "#7a3434", "#a05050"], { ojos: "#ff3a2a", cuernos: "#c8c8c8" }); p.linea(7, 13, 11, 13, "#fff"); },
  roboBebe(p) { p.caja(3, 4, 12, 11, PAL.hierro.slice(1)); p.rect(5, 7, 3, 3, "#ff3a3a"); p.rect(10, 7, 3, 3, "#ff3a3a"); p.rect(6, 12, 6, 1, PAL.tinta); p.linea(9, 4, 9, 1, PAL.hierro[3]); p.p(9, 0, "#ff3a3a"); },
  incubo(p) { DIB.carita(p, 9, 10, 6, ["#140a1a", "#2a1434", "#46225a", "#643480", "#8a52a8"], { ojos: "#fff", cuernos: "#c19ae8" }); for (const s of [-1, 1]) p.bola(9 + s * 7, 9, 2, 4, ["#140a1a", "#46225a"], {}); },
  gordito(p) { p.bola(9, 10, 7, 6, ["#5a3a3a", "#8a5a5a", "#c08a8a", "#e8b8b0"], {}); p.rect(4, 11, 10, 3, "#2a0a0a"); for (const x of [5, 7, 9, 11]) p.p(x, 11, "#fff"); p.p(6, 7, PAL.tinta); p.p(12, 7, PAL.tinta); },
  cerebroPodrido(p) { p.bola(9, 9, 7, 6, ["#3a2a1a", "#6a5a2a", "#9a8a4a", "#c8b87a"], {}); p.linea(9, 3, 9, 15, "#3a2a1a"); for (const [x0, y0, x1, y1] of [[4, 7, 7, 9], [11, 6, 14, 8], [5, 11, 8, 12], [11, 11, 14, 12]]) p.linea(x0, y0, x1, y1, "#6a5a2a"); p.bola(13, 14, 1.6, 1.6, R_.verde.slice(2), {}); },
  sanguijuela(p) { DIB.gusano(p, ["#1a0a0a", "#3a1414", "#6a2a2a", "#9a4a4a"], [[14, 5], [12, 7], [10, 9], [8, 11], [6, 12], [4, 13]]); p.bola(14, 4, 1, 1, PAL.sangre.slice(3), {}); },
  bolsaCentavos(p) { p.bola(9, 11, 6, 5, ["#5a4a2a", "#8a7a4a", "#b8a87a", "#e0d0a8"], {}); p.rect(7, 5, 4, 2, "#8a7a4a"); p.sello(6, 3, ["o...o", ".o.o."], { o: "#b8a87a" }); ICONOS._copiar(p, monedaSpr(0), 5, 8, 0.7); },
  // ── activos ──
  necronomicon(p) { DIB.libro(p, ["#1a0a06", "#3a1a0e", "#5c2c18", "#7e4026"], (q) => { DIB.carita(q, 9, 9, 3.5, ["#6a6a5a", "#a8a898", "#d8d8c8"], { ojos: PAL.tinta }); }); },
  libroRevelacion(p) { DIB.libro(p, ["#2a2a2a", "#4a4a4a", "#6a6a6a", "#8a8a8a"], (q) => { q.rect(8, 5, 2, 8, "#e8e8e8"); q.rect(6, 7, 6, 2, "#e8e8e8"); }); },
  libroSombras(p) { DIB.libro(p, ["#0a0a14", "#1a1a2e", "#2a2a4a", "#3a3a66"], (q) => { for (let a = 0; a < 20; a++) q.p(9 + Math.cos(a / 20 * TAU) * 3.5, 9 + Math.sin(a / 20 * TAU) * 3.5, "#c19ae8"); }); },
  libroSanto(p) { DIB.libro(p, ["#3a2a0a", "#6a4a1a", "#9a7a2a", "#c8a84a"], (q) => { q.rect(8, 5, 2, 8, PAL.oro[4]); q.rect(6, 7, 6, 2, PAL.oro[4]); }); },
  telepatia(p) { DIB.libro(p, ["#1a2a4a", "#2a4a7a", "#4a7ab0", "#7aa8d8"], (q) => { q.bola(9, 9, 3, 3, R_.rosa.slice(1), {}); q.linea(9, 6, 9, 12, R_.rosa[1]); }); },
  anarquista(p) { DIB.libro(p, ["#1a1a1a", "#3a3a3a", "#5a5a5a", "#7a7a7a"], (q) => { q.sello(6, 5, ["#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#####"], { "#": "#d0201c" }); }); },
  shoop(p) { DIB.carita(p, 9, 8, 6.5, ["#6a4a1a", "#9a7a2a", "#d0b04a", "#f0d880"], {}); p.bola(9, 12, 3.5, 3, ["#1a0406", "#5a0a0e"], {}); p.rect(8, 14, 2, 4, "#d0201c"); p.sello(4, 5, ["##...##"], { "#": PAL.tinta }); },
  remoto(p) { p.caja(5, 4, 8, 13, PAL.hierro.slice(1)); p.rect(7, 6, 4, 3, "#1a3a1a"); p.p(8, 7, "#5aff5a"); p.bola(9, 13, 1.8, 1.8, ["#6a0a10", "#c01a1a", "#ff6a5a"], {}); p.linea(11, 4, 14, 0, PAL.hierro[3]); },
  kamikaze(p) { ICONOS._copiar(p, bombaSpr(1, true, 0), 1, 0); p.bola(9, 11, 3, 2, ["#fff", "#fff"], { filtro: (x, y) => y === 10 }); p.rect(5, 10, 8, 1, "#ffffff"); p.bola(9, 10, 1, 1, ["#d0201c", "#d0201c"], {}); },
  relojArena(p) { p.rect(4, 2, 10, 2, PAL.tierra[3]); p.rect(4, 15, 10, 2, PAL.tierra[3]); p.sello(5, 4, ["########", ".######.", "..####..", "...##...", "...##...", "..####..", ".######.", "########", "########", "########", "########"].map((f) => f), { "#": "#cfefff" }); p.sello(6, 5, ["######", ".####.", "..##.."], { "#": PAL.oro[3] }); p.sello(5, 12, ["...##...", ".######."], { "#": PAL.oro[3] }); },
  unicornio(p) { p.bola(9, 11, 6, 5, R_.blanco, {}); p.bola(12, 7, 3.2, 3, R_.blanco, {}); p.linea(13, 4, 16, 0, PAL.oro[3]); p.linea(8, 7, 7, 3, "#d86a8e"); p.linea(9, 7, 8, 4, "#8a5cc0"); p.p(12, 7, PAL.tinta); },
  tammy(p) { DIB.carita(p, 9, 10, 6.5, ["#3a2a1a", "#6a4a2a", "#9a7a4a", "#c8a87a"], { ojos: PAL.tinta, boca: "#5a2a1a" }); for (let a = 0; a < 10; a++) { const an = a / 10 * TAU; p.p(9 + Math.cos(an) * 8.5, 10 + Math.sin(an) * 8, PAL.espora[3]); } },
  cabezaGato(p) { DIB.carita(p, 9, 10, 6, ["#1a1a1a", "#3a3a3a", "#5a5a5a", "#7a7a7a"], { ojos: "#ffe07a" }); p.sello(3, 2, ["#.......#.", "##.....##.", "###...###."], { "#": "#3a3a3a" }); p.bola(9, 13, 1, 1, ["#d86a8e", "#d86a8e"], {}); },
  patitaGato(p) { p.bola(9, 11, 5, 4.5, ["#1a1a1a", "#3a3a3a", "#5a5a5a"], {}); for (const [x, y] of [[4, 6], [7, 4], [11, 4], [14, 6]]) p.bola(x, y, 1.8, 1.8, ["#3a3a3a", "#5a5a5a"], {}); p.bola(9, 12, 2.4, 2, R_.rosa.slice(1), {}); },
  cabezaPodrida(p) { DIB.carita(p, 9, 10, 6.5, ["#2a3a1a", "#4a5a2a", "#6a7a3a", "#8a9a4a"], { ojos: "#1a1a0a" }); p.rect(6, 13, 6, 2, "#1a1a0a"); for (const x of [7, 10]) p.p(x, 13, "#c8c8a0"); p.linea(9, 3, 11, 0, PAL.crema[2]); p.p(12, 0, PAL.fuego[4]); },
  cajaAranas(p) { p.caja(3, 7, 12, 9, PAL.tierra.slice(2), { vertical: 0.6 }); p.rect(3, 7, 12, 2, PAL.tierra[5]); ICONOS._copiar(p, aranaSpr(0), 5, 1, 0.7); },
  // ── baratijas ──
  gusanoOnda(p) { DIB.gusano(p, R_.rosa.slice(1), [[3, 9], [5, 7], [7, 7], [9, 9], [11, 11], [13, 11], [15, 9]]); },
  gusanoAnillo(p) { const pts = []; for (let i = 0; i < 9; i++) { const a = i / 9 * TAU * 0.9; pts.push([9 + Math.cos(a) * 5.5, 9 + Math.sin(a) * 5.5]); } DIB.gusano(p, ["#3a1a4a", "#6a3a8a", "#9a5ac0", "#c89ae8"], pts); },
  gusanoGancho(p) { DIB.gusano(p, ["#3a2a0a", "#7a5a1a", "#b08a2a", "#e0c05a"], [[4, 4], [4, 7], [4, 10], [7, 10], [10, 10], [10, 13], [13, 13]]); },
  gusanoPulso(p) { DIB.gusano(p, ["#0a2a3a", "#1a5a7a", "#3a8ab0", "#8ac8e8"], [[4, 9], [6, 9], [8, 9], [10, 9], [12, 9], [14, 9]]); p.bola(9, 9, 3, 3, ["#1a5a7a", "#3a8ab0", "#8ac8e8"], {}); },
  gusanoChato(p) { for (let i = 0; i < 6; i++) p.bola(4 + i * 2, 9, 1.6, 3.2, ["#3a2a1a", "#7a5a3a", "#b08a5a", "#e0c090"], {}); p.p(3, 8, PAL.tinta); p.p(3, 10, PAL.tinta); },
  ojitoRosa(p) { DIB.ojo(p, R_.rosa, { rx: 6.5, ry: 5, ri: 2.8, venas: true }); },
  clip(p) { for (const [x0, y0, x1, y1] of [[6, 3, 6, 14], [6, 14, 12, 14], [12, 14, 12, 5], [12, 5, 9, 5], [9, 5, 9, 12]]) { p.linea(x0, y0, x1, y1, PAL.hierro[4]); p.linea(x0 + 1, y0, x1 + 1, y1, PAL.hierro[3]); } },
  dedoSuerte(p) { p.bola(9, 11, 3, 5.5, PAL.piel, {}); p.bola(9, 6, 2.6, 2, ["#f0e0e0", "#ffffff"], {}); p.linea(6, 15, 12, 15, PAL.piel[1]); p.p(14, 4, PAL.oro[4]); p.p(4, 5, PAL.oro[4]); },
  tenedor(p) { p.rect(8, 8, 2, 9, PAL.hierro[4]); p.rect(5, 6, 8, 2, PAL.hierro[3]); for (const x of [5, 7, 10, 12]) p.rect(x, 1, 1, 6, PAL.hierro[4]); },
  garrapata(p) { p.bola(9, 10, 5.5, 5, ["#3a1a0a", "#6a2a14", "#9a4a24", "#c86a3a"], {}); p.bola(9, 4.5, 2, 1.6, ["#1a0a04", "#3a1a0a"], {}); for (const s of [-1, 1]) for (const k of [0, 1, 2, 3]) p.linea(9 + s * 4, 7 + k * 2, 9 + s * 7.5, 6 + k * 2.6, "#1a0a04"); },
  paginaPerdida(p) { p.sello(3, 2, ["##########.", "###########", "###########", "###########", "###########", "##########.", "###########", "##########.", "###########", "#########..", "##########.", "########...", "#######...."], { "#": "x" }); for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) if (p.g(x, y)) p.p(x, y, (y - 2) % 2 && x > 4 && x < 12 ? "#8a7a60" : "#ecdfc8"); p.bola(10, 9, 2.4, 2.4, PAL.sangre.slice(1), {}); },
  monedaTragada(p) { p.bola(9, 10, 6.5, 6, PAL.piel, {}); ICONOS._copiar(p, monedaSpr(0), 4, 5); p.linea(4, 5, 14, 5, PAL.piel[1]); },
});

// ── los sprites de las armas ──
function cuchilloSpr() {
  return hornear("cuchilloArma", () => {
    const p = new Pix(22, 7);
    p.caja(0, 2, 7, 3, PAL.tierra.slice(2), { vertical: 0.7 });
    p.rect(7, 1, 2, 5, PAL.hierro[2]);
    for (let x = 9; x < 22; x++) { const h = x > 18 ? 22 - x : 2; for (let y = 0; y < h; y++) p.p(x, 3 - (y ? 1 : 0) + (y > 1 ? -1 : 0) + 0, y ? "#dfe4e8" : "#9aa2aa"); p.p(x, 4, "#6a7278"); if (x < 20) p.p(x, 2, "#f6f8fa"); }
    p.contorno(AUTO);
    return p.canvas();
  });
}
function misilSpr() {
  return hornear("misil", () => {
    const p = new Pix(10, 20);
    p.caja(3, 2, 4, 13, PAL.hierro.slice(1), { vertical: 0.2 });
    p.bola(5, 15, 2, 3, R_.rojoV, {});
    p.sello(1, 0, ["#......#", "##....##", ".#....#."], { "#": PAL.sangre[3] });
    p.contorno(AUTO);
    return p.canvas();
  });
}
function proyectilSpr(tipo) {
  return hornear(`proy${tipo}`, () => {
    const p = new Pix(10, 7);
    if (tipo === "aguja") { p.linea(0, 3, 7, 3, PAL.hierro[4]); p.rect(6, 2, 3, 3, "#a8c4d0"); p.p(7, 3, "#9a2a2a"); }
    else if (tipo === "hueso") { p.rect(2, 2, 6, 2, R_.blanco[3]); p.bola(2, 2, 1.5, 1.5, R_.blanco.slice(2), {}); p.bola(2, 4, 1.5, 1.5, R_.blanco.slice(2), {}); p.bola(8, 2, 1.5, 1.5, R_.blanco.slice(2), {}); p.bola(8, 4, 1.5, 1.5, R_.blanco.slice(2), {}); }
    else { p.sello(2, 0, [".####.", "######", "######", "##.###", "#...##", "#....#"], { "#": "#ece4d4" }); p.p(3, 1, "#ffffff"); }
    p.contorno(AUTO);
    return p.canvas();
  });
}
function baratijaSpr(id) {
  return hornear(`baratija${id}`, () => {
    const s = iconoSpr(id), c = lienzoNuevo(14, 14), g = c.getContext("2d");
    g.imageSmoothingEnabled = true; g.drawImage(s, 0, 0, 14, 14);
    return c;
  });
}
/** Los familiares sin cara de bebé (ángel, pelos, gordito, cerebro, sanguijuela, bolsa, araña). */
function familiarSpr(tipo, k) {
  const id = { angel: "angelGuardian", pelos: "bolaPelos", gordito: "gordito", cerebro: "cerebroPodrido", sanguijuela: "sanguijuela", bolsa: "bolsaCentavos", aranaFam: "bebeArana" }[tipo];
  if (!id) return null;
  return hornear(`fam${tipo}${k}`, () => {
    const s = iconoSpr(id), c = lienzoNuevo(15, 15 + k), g = c.getContext("2d");
    g.imageSmoothingEnabled = true; g.drawImage(s, 0, k, 15, 15);
    return c;
  });
}
