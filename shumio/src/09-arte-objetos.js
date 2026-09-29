// ─────────────────────────────────────────────────────────────────────────────
// LOS ÍCONOS DE LOS OBJETOS: 18×18, cada uno pintado a mano con la misma luz y el mismo
// contorno que el resto, para que un objeto se reconozca por su silueta sobre el pedestal.
// ─────────────────────────────────────────────────────────────────────────────

const ICONOS = {
  sombreroRojo(p) { p.bola(9, 8, 7.5, 5, PAL.hongo, { filtro: (x, y) => y <= 10 }); p.rect(3, 10, 12, 1, PAL.hongo[1]); p.caja(6, 11, 6, 5, PAL.crema); p.sello(5, 4, ["cc...c", "c....."], { c: PAL.crema[3] }); p.p(11, 7, PAL.crema[3]); },
  setaPicante(p) { p.caja(7, 9, 4, 7, PAL.crema); p.bola(9, 7, 6, 4.5, PAL.sangre, { filtro: (x, y) => y <= 9 }); for (const [x, y] of [[6, 5], [10, 4], [12, 7]]) p.p(x, y, PAL.fuego[4]); p.sello(12, 1, [".f", "ff", ".F"], { f: PAL.fuego[3], F: PAL.fuego[2] }); },
  cafeRaiz(p) { p.caja(4, 7, 9, 9, PAL.hueso.slice(1)); p.rect(5, 7, 7, 2, PAL.tierra[1]); p.sello(13, 9, ["hh.", "..h", "hh."], { h: PAL.hueso[2] }); p.sello(6, 1, [".s.s", "s.s.", ".s.s"], { s: "#8a8a8a" }); },
  zapatillas(p) { p.caja(2, 9, 13, 6, PAL.tierra.slice(1)); p.caja(2, 5, 6, 5, PAL.tierra.slice(2)); p.rect(2, 14, 14, 2, PAL.hueso[3]); p.sello(9, 8, ["w.w.w"], { w: PAL.hueso[4] }); },
  lupa(p) { p.bola(7, 7, 5, 5, PAL.hielo, {}); p.bola(7, 7, 3.4, 3.4, ["#9fd6ee", "#cfefff", "#ffffff"], {}); p.linea(11, 11, 15, 15, PAL.tierra[3]); p.linea(12, 11, 16, 15, PAL.tierra[2]); p.linea(5, 5, 9, 9, "#38617a"); },
  trebol(p) { for (const [x, y] of [[6, 5], [11, 5], [6, 10], [11, 10]]) p.bola(x, y, 3.2, 3.2, PAL.musgo.slice(1), {}); p.linea(9, 8, 12, 16, PAL.musgo[1]); p.sello(8, 7, ["kk", "kk"], { k: PAL.tierra[2] }); },
  corazonPiedra(p) { const c = corazonSpr("rojo"); p.sello(0, 0, [], {}); ICONOS._copiar(p, corazonSpr("espora"), 4, 4); for (const [x, y] of [[7, 7], [10, 9], [8, 11]]) p.p(x, y, "#9aa4b4"); },
  ojoVidrio(p) { p.bola(6, 9, 4.2, 4.2, PAL.hueso.slice(1), {}); p.bola(12, 9, 4.2, 4.2, PAL.hueso.slice(1), {}); p.bola(6, 9, 2, 2, PAL.azul.slice(1), {}); p.bola(12, 9, 2, 2, PAL.azul.slice(1), {}); p.p(5, 8, "#fff"); p.p(11, 8, "#fff"); },
  tercerOjo(p) { p.bola(9, 9, 7, 4.5, PAL.piel, {}); p.bola(9, 9, 3.2, 3.2, PAL.violeta, {}); p.bola(9, 9, 1.5, 1.5, [PAL.tinta, PAL.tinta], {}); p.p(8, 8, "#fff"); p.linea(2, 9, 4, 5, PAL.tinta); p.linea(16, 9, 14, 5, PAL.tinta); },
  iman(p) { p.caja(3, 3, 4, 10, PAL.sangre.slice(1)); p.caja(11, 3, 4, 10, PAL.sangre.slice(1)); p.bola(9, 13, 6, 3.5, PAL.sangre.slice(1), { filtro: (x, y) => y >= 12 }); p.rect(3, 3, 4, 2, PAL.hierro[4]); p.rect(11, 3, 4, 2, PAL.hierro[4]); p.rect(7, 12, 4, 2, "#00000000"); for (let x = 7; x < 11; x++) for (let y = 11; y < 14; y++) p.borrar(x, y); },
  esporasToxicas(p) { for (const [x, y, r] of [[6, 10, 3.5], [11, 7, 3], [11, 12, 2.5], [5, 5, 2]]) p.bola(x, y, r, r, COLOR_LAGRIMA.veneno.slice(1), {}); p.p(10, 6, "#e8ffc0"); },
  escarcha(p) { for (let a = 0; a < 6; a++) { const an = a * Math.PI / 3; p.linea(9, 9, 9 + Math.cos(an) * 7, 9 + Math.sin(an) * 7, PAL.hielo[3]); p.p(9 + Math.cos(an) * 4 + Math.cos(an + 1) * 1.5, 9 + Math.sin(an) * 4 + Math.sin(an + 1) * 1.5, PAL.hielo[4]); } p.bola(9, 9, 2, 2, PAL.hielo.slice(2), {}); },
  gomaElastica(p) { p.bola(9, 10, 6, 6, ["#5a1a3a", "#9a2e64", "#d4508e", "#f288b8", "#ffc2dc"], {}); p.linea(4, 7, 14, 13, "#5a1a3a"); p.p(6, 6, "#fff"); },
  velo(p) { p.bola(9, 8, 6, 6, ["#6e7688", "#a3aaba", "#d0d6e2", "#f2f5fa"], { filtro: (x, y) => y < 10 }); p.rect(3, 10, 12, 4, "#d0d6e2"); for (const x of [3, 7, 11]) { p.p(x, 14, "#a3aaba"); p.p(x + 1, 15, "#a3aaba"); } p.sello(6, 7, ["e..e"], { e: PAL.tinta }); },
  aguja(p) { p.linea(3, 15, 14, 2, PAL.hierro[4]); p.linea(4, 15, 15, 2, PAL.hierro[3]); p.sello(13, 1, ["kk", "k."], { k: PAL.tinta }); p.linea(14, 3, 17, 9, "#d6302a"); p.linea(17, 9, 12, 15, "#d6302a"); },
  brujula(p) { p.bola(9, 9, 7, 7, PAL.oro, {}); p.bola(9, 9, 5.2, 5.2, PAL.crema.slice(1), {}); p.linea(9, 4, 9, 9, "#d6302a"); p.linea(9, 9, 9, 14, PAL.hierro[2]); p.p(9, 9, PAL.tinta); },
  ojoCazador(p) { p.bola(9, 9, 7, 5, PAL.violeta, {}); p.bola(9, 9, 2.8, 4, [PAL.tinta, "#2a1040"], {}); p.p(8, 7, "#fff"); p.linea(1, 9, 3, 9, PAL.violeta[3]); p.linea(15, 9, 17, 9, PAL.violeta[3]); },
  cuerno(p) { p.caja(4, 11, 10, 5, PAL.hueso.slice(1)); for (let i = 0; i < 9; i++) { p.p(5 + i * 0.3, 11 - i, PAL.hueso[3 - (i > 5 ? 1 : 0)]); p.p(6 + i * 0.3, 11 - i, PAL.hueso[2]); } for (let i = 0; i < 9; i++) { p.p(12 - i * 0.3, 11 - i, PAL.hueso[3]); p.p(11 - i * 0.3, 11 - i, PAL.hueso[2]); } },
  moscaAmiga(p) { ICONOS._copiar(p, mosquinSpr(0), 2, 2); },
  hermanito(p) { p.bola(9, 8, 6, 5.5, PAL.piel, {}); p.bola(9, 4, 6, 3, PAL.musgo.slice(1), { filtro: (x, y) => y <= 5 }); p.sello(6, 8, ["e..e"], { e: PAL.tinta }); p.p(9, 11, "#5a3034"); p.caja(6, 13, 6, 4, PAL.musgo.slice(1)); },
  casco(p) { p.bola(9, 10, 7, 6, PAL.oro, { filtro: (x, y) => y <= 11 }); p.rect(1, 11, 16, 2, PAL.oro[1]); p.bola(9, 6, 2.5, 2, ["#f5e0a0", "#fff8d8", "#ffffff"], {}); p.linea(4, 9, 6, 6, PAL.oro[4]); },
  bombaGorda(p) { ICONOS._copiar(p, bombaSpr(1), 1, 0); p.sello(11, 11, [".p.", "ppp", ".p."], { p: "#ffffff" }); },
  bolsaMonedas(p) { p.bola(9, 11, 6.5, 5.5, PAL.tierra.slice(1), {}); p.rect(6, 5, 6, 2, PAL.tierra[2]); p.sello(7, 3, ["o.o", ".o."], { o: PAL.oro[4] }); p.bola(9, 11, 2.5, 2.5, PAL.oro.slice(1), {}); },
  llavero(p) { p.bola(6, 6, 4, 4, PAL.hierro, { filtro: (x, y) => Math.hypot(x + 0.5 - 6, y + 0.5 - 6) > 2 }); ICONOS._copiar(p, llaveSpr(), 7, 4); ICONOS._copiar(p, llaveSpr(), 10, 3); },
  plomo(p) { p.bola(9, 10, 6.5, 6, PAL.hierro, {}); p.sello(6, 8, ["P.b", "Pbb", "P.b"], { P: PAL.hierro[4], b: PAL.hierro[4] }); },
  lenteSangre(p) { p.bola(9, 9, 6.5, 6.5, PAL.sangre, {}); p.bola(9, 9, 4, 4, ["#6a0a10", "#c62a2a", "#ff6a5a", "#ffc0b0"], {}); p.p(7, 7, "#fff"); },
  chispa(p) { p.sello(5, 1, ["....ff.", "...ff..", "..fF...", ".fFFFf.", "...Ff..", "..fF...", ".fF....", "fF.....", "f......"], { f: PAL.fuego[3], F: PAL.fuego[4] }); },
  alasPolilla(p) { for (const s of [-1, 1]) p.bola(9 + s * 4.5, 8, 4, 6, ["#3a3226", "#6e6048", "#a8966e", "#d6c69a"], {}); p.caja(8, 4, 2, 11, PAL.tierra.slice(0, 3)); for (const s of [-1, 1]) p.bola(9 + s * 4.5, 7, 1.4, 1.4, ["#1a1410", "#3a3226"], {}); },
  caparazon(p) { p.bola(9, 10, 7, 6, ["#1a2a1a", "#2e4a2c", "#4a7044", "#6e9a62", "#9cc48c"], {}); p.linea(9, 4, 9, 16, "#1a2a1a"); p.linea(3, 10, 15, 10, "#1a2a1a"); p.p(6, 7, "#c8e8b8"); },
  hongoGigante(p) { p.bola(9, 7, 8, 6, PAL.violeta, { filtro: (x, y) => y <= 9 }); p.caja(6, 10, 6, 6, PAL.crema); for (const [x, y] of [[5, 5], [9, 3], [13, 6]]) p.p(x, y, PAL.crema[3]); },
  mediaLuna(p) { p.bola(9, 9, 7, 7, PAL.hueso.slice(1), { filtro: (x, y) => Math.hypot(x + 0.5 - 12, y + 0.5 - 7) > 5.5 }); },
  raizVieja(p) { for (const [x0, y0, x1, y1] of [[9, 2, 9, 9], [9, 9, 4, 16], [9, 9, 9, 16], [9, 9, 14, 15], [9, 5, 13, 3]]) { p.linea(x0, y0, x1, y1, PAL.tierra[3]); p.linea(x0 + 1, y0, x1 + 1, y1, PAL.tierra[2]); } p.bola(9, 2, 2, 1.5, PAL.musgo.slice(2), {}); },
  pactoSangre(p) { p.caja(3, 3, 12, 13, ["#1a0a06", "#3a1a0e", "#5c2c18", "#7e4026"]); p.rect(4, 4, 10, 11, "#e8dcc0"); for (let y = 6; y < 13; y += 2) p.linea(5, y, 12, y, "#8a7a60"); p.bola(12, 13, 2.5, 2.5, PAL.sangre.slice(1), {}); },
  // activos
  libroSetas(p) { p.caja(3, 3, 12, 13, ["#1a0a10", "#3e1432", "#65205a", "#8e3a80"]); p.rect(14, 4, 1, 11, "#e8dcc0"); ICONOS._copiar(p, matasSpr(1, 1), -4, -5, 0.6); p.bola(9, 8, 3.2, 2.6, PAL.oro, { filtro: (x, y) => y <= 8 }); p.rect(8, 9, 2, 3, PAL.crema[2]); },
  dadoViejo(p) { p.caja(3, 3, 12, 12, PAL.hueso.slice(1)); for (const [x, y] of [[5, 5], [11, 5], [8, 8], [5, 11], [11, 11]]) p.rect(x, y, 2, 2, PAL.tinta); },
  frascoMosquines(p) { p.bola(9, 11, 6, 5.5, ["#3a4a52", "#6e8894", "#a8c4d0", "#e0f0f6"], { trama: 0.3 }); p.caja(7, 2, 4, 4, PAL.tierra.slice(2)); ICONOS._copiar(p, mosquinSpr(1), 2, 5); },
  linterna(p) { p.caja(5, 5, 8, 10, PAL.hierro.slice(1)); p.bola(9, 10, 3, 3.5, ["#6a5a10", "#d8c030", "#fff080", "#ffffe0"], {}); p.rect(6, 2, 6, 2, PAL.hierro[3]); p.rect(8, 0, 2, 2, PAL.hierro[2]); for (const [x, y] of [[1, 3], [16, 5], [2, 14], [15, 13]]) p.p(x, y, "#fff080"); },
  mechaEterna(p) { ICONOS._copiar(p, bombaSpr(1, true, 0), 1, 0); p.sello(12, 1, ["i.i", ".i.", "i.i"], { i: PAL.oro[4] }); },
  gotaRocio(p) { p.bola(9, 11, 5.5, 5.5, PAL.hielo, {}); for (let i = 0; i < 5; i++) { p.p(9, 3 + i, PAL.hielo[3]); if (i > 1) { p.p(8, 3 + i, PAL.hielo[2]); p.p(10, 3 + i, PAL.hielo[3]); } } p.p(7, 9, "#fff"); },
  _copiar(p, c, x0, y0, escala = 1) {
    const g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i + 3] > 128) p.p(x0 + x * escala, y0 + y * escala, hex(d[i], d[i + 1], d[i + 2])); }
  },
};
function iconoSpr(id) {
  return hornear(`icono${id}`, () => {
    const p = new Pix(18, 18);
    (ICONOS[id] || ICONOS.dadoViejo)(p);
    p.contorno(PAL.tinta);
    return p.canvas();
  });
}
