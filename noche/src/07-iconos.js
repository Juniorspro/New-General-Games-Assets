// ─────────────────────────────────────────────────────────────────────────────
// LOS ÍCONOS (12×12): armas, evoluciones, pasivos y las mejoras. Van en el HUD (a escala 1), en
// las tarjetas de subir de nivel y en la tienda (a ×2, entera). Las evoluciones son el ícono del
// arma base con otros colores y un brillo: se reconocen de un vistazo, como en el original.
// ─────────────────────────────────────────────────────────────────────────────

const ICONOS = {
  latigo: ["......TTTT..", "....TT....T.", "...T.......T", "..T....TT..T", "..T...T..T.T", "..T...T..T..", "...T...TT...", "....TT......", ".....T......", "....ooo.....", "...xox......", "..xx........"],
  varita: [".........y..", "........yyy.", ".......yywyy", "........yyy.", ".......T.y..", "......T.....", ".....T......", "....T.......", "...T........", "..T.........", ".x..........", "x..........."],
  cuchillo: ["...........w", "..........wl", ".........wl.", "........wl..", ".......wl...", "......wl....", ".....wl.....", "...oo.......", "....x.......", "...x.o......", "..x.........", ".x.........."],
  hacha: ["...llll.....", "..lwwwll....", ".lwwlllTl...", ".lwlllTTl...", "..llllTl....", "...ll.T.....", ".....T......", "....T.......", "....T.......", "...T........", "...x........", "..x........."],
  cruz: ["....oyyo....", "....oyyo....", "....oyyo....", "oooooyyooooo", "yyyyywwyyyyy", "oooooyyooooo", "....oyyo....", "....oyyo....", "....oyyo....", "....oyyo....", "....nnnn....", "............"],
  libro: ["..BBBBBBBBB.", ".BbbbbbbbbBw", ".BbbbwwbbbBw", ".BbbwwwwbbBw", ".BbbbwwbbbBw", ".BbbbwwbbbBw", ".BbbbwwbbbBw", ".BbbbbbbbbBw", ".BBBBBBBBBBw", ".wwwwwwwwww.", "............", "............"],
  fuego: [".........y..", "........yfy.", ".......yfrfy", "........frf.", ".......R.f..", "......R.....", ".....R......", "....R.......", "...R........", "..R.........", ".q..........", "q..........."],
  ajo: ["......g.....", ".....gG.....", ".....ww.....", "....wwww....", "...wwlwww...", "..wwwlwwww..", "..wwlwwlww..", "..wwlwwlww..", "..wwwlwlww..", "...wwwwww...", "....llll....", "............"],
  agua: ["....llll....", "....wwww....", ".....ww.....", "....bbbb....", "...bbwbbb...", "..bbwbbbbB..", "..bBbbbbBB..", "..bBBbbBBB..", "..BBBBBBBB..", "...BBBBBB...", "....vvvv....", "............"],
  runa: [".....pp.....", "....pwwp....", "...pwPPwp...", "..pwPPPPwp..", ".pwPPkkPPwp.", "pwPPkkkkPPwp", ".pwPPkkPPwp.", "..pwPPPPwp..", "...pwPPwp...", "....pwwp....", ".....pp.....", "............"],
  rayo: ["....oooo....", "..oo....oo..", ".o...yy...o.", ".o..yy....o.", "o..yyyyy...o", "o....yy....o", "o...yy.....o", ".o.yy.....o.", ".o........o.", "..oo....oo..", "....oooo....", "............"],
  espinaca: ["....gg......", "...gGGg.....", "..gGGGGg.gg.", "..gGhGGggGGg", "...gGhGgGhGg", "....gGhgGhg.", ".gg..gGhhg..", "gGGg..ghhg..", "gGhGGggh....", ".gGhhhhh....", "..ggg.h.....", "......h....."],
  armadura: ["..ll....ll..", ".lwwl..lwwl.", ".lwwllllwwl.", "..lwwwwwwl..", "..lwlwwlwl..", "..lwwwwwwl..", "..lwlwwlwl..", "..lwwwwwwl..", "...lwwwwl...", "....llll....", "............", "............"],
  corazon: ["............", ".RRR....RRR.", "RrrrR..RrrrR", "Rr..RRRR..rR", "Rr........rR", "Rr........rR", ".Rr......rR.", "..Rr....rR..", "...Rr..rR...", "....RrrR....", ".....RR.....", "............"],
  tomate: [".....g......", "...gGgGg....", "..RRgGgRR...", ".RrrRRRRrR..", "RrwwrRRRRrR.", "RrwrRRRRRRR.", "RrrRRRRRRRR.", "RRRRRRRRRRq.", ".RRRRRRRRq..", "..RRRRRRq...", "...qqqqq....", "............"],
  tomo: ["..TTTTTTTT..", ".TttttttttT.", ".Ttwwwwwwtw.", ".Ttwllllwtw.", ".Ttwwwwwwtw.", ".Ttwllllwtw.", ".Ttwwwwwwtw.", ".Ttwllllwtw.", ".Ttwwwwwwtw.", ".TTTTTTTTTw.", "..wwwwwwww..", "............"],
  candelabro: [".y...y...y..", "yfy.yfy.yfy.", ".w...w...w..", ".w...w...w..", ".o...o...o..", ".ooooooooo..", ".....o......", ".....o......", "....ooo.....", "...ooooo....", "..nnnnnnn...", "............"],
  brazal: ["............", "..oooooooo..", ".oyyyyyyyyo.", ".onnnnnnnno.", ".oyyywwyyyo.", ".onnnnnnnno.", ".oyyyyyyyyo.", ".onnnnnnnno.", ".oyyyyyyyyo.", "..oooooooo..", "............", "............"],
  hechizo: ["....kkkk....", "..kk....kk..", ".k..pppp..k.", ".k.p....p.k.", "k.p..ww..p.k", "k.p.wwww.p.k", "k.p.wwww.p.k", "k.p..ww..p.k", ".k.p....p.k.", ".k..pppp..k.", "..kk....kk..", "....kkkk...."],
  duplicador: [".....yyy....", "...yy...yy..", "..y.oo.oo.y.", "..y.o.o..oy.", ".y.o...o..y.", ".y.o...o..y.", ".y.o...o..y.", "..y.o.o..oy.", "..y..o.oo.y.", "...yy...yy..", ".....yyy....", "............"],
  alas: ["............", "w..........w", "ww........ww", "wlw......wlw", "wllw....wllw", ".wllw..wllw.", ".wlllwwlllw.", "..wlllllllw.", "...wwllllw..", ".....wwww...", "............", "............"],
  orbe: ["....bbbb....", "..bbBBBBbb..", ".bBwwBBBBBb.", ".bBwBBBBBBb.", "bBBBBBBBBBBb", "bBBBBBBBBBvb", "bBBBBBBBBBvb", "bBBBBBBBBvvb", ".bBBBBBBvvb.", ".bbBBBvvvbb.", "..bbbbbbbb..", "............"],
  trebol: ["...gg..gg...", "..gGGggGGg..", "..gGGGGGGg..", "...gGhhGg...", ".gg.ghhg.gg.", "gGGghhhhgGGg", "gGGGghhgGGGg", ".gGGgggggGg.", "..gg.hh.gg..", ".....hh.....", "....hh......", "............"],
  corona: ["............", "y....y....y.", "oy..yoy..yo.", "oyyyoooyyyo.", "ooyooRooyoo.", "ooooooooooo.", "oyyyyyyyyyo.", "onnnnnnnnno.", "............", "............", "............", "............"],
  mascara: ["...llllll...", "..lwwwwwwl..", ".lwwwwwwwwl.", ".lwddwwddwl.", ".lweewweewl.", ".lwwwwwwwwl.", ".lwwwllwwwl.", "..lwwwwwwl..", "..lwdddwwl..", "...lwwwwl...", "....llll....", "............"],
  calavera: ["...wwwwww...", "..wwwwwwww..", ".wwwwwwwwww.", ".wweewweeww.", ".wweewweeww.", ".wwwwwwwwww.", "..wwwddwww..", "...wwwwww...", "...wlwlwl...", "...wwwwww...", "............", "............"],
  tiramisu: ["............", "............", "......ttt...", "....ttTTTt..", "..ttTTTTTTt.", ".xxxxxxxxxx.", ".tttttttttt.", ".xxxxxxxxxx.", ".tttttttttt.", ".TTTTTTTTTT.", "............", "............"],
  _reroll: ["....yyyy....", "..yy....yy..", ".y........y.", ".y.........", "y......yyyyy", "y.......yyy.", "y........y..", ".y..........", ".y........y.", "..yy....yy..", "....yyyy....", "............"],
  _salto: ["............", "..w...w.....", "..ww..ww....", "..www.www...", "..wwwwwwww..", "..wwwwwwwww.", "..wwwwwwww..", "..www.www...", "..ww..ww....", "..w...w.....", "............", "............"],
  _destierro: ["............", ".RR......RR.", ".RRR....RRR.", "..RRR..RRR..", "...RRRRRR...", "....RRRR....", "....RRRR....", "...RRRRRR...", "..RRR..RRR..", ".RRR....RRR.", ".RR......RR.", "............"],
  oro: ["", "", ""].concat(RECOGIBLES.moneda[0].map((f) => "..." + f)),
  pollo: ["............", "............"].concat(RECOGIBLES.pollo[0]),
};
// las evoluciones: [ícono base, colores que cambian]
const ICONO_EVO = {
  carmesi: ["latigo", { T: "#d02020", x: "#6a0a0a" }], sagrada: ["varita", { T: "#e0a020", y: "#ffffff" }], milfilos: ["cuchillo", { w: "#ffe070", l: "#e0a020" }],
  espiral: ["hacha", { l: "#8040c0", w: "#e0c0ff", T: "#401060" }], celeste: ["cruz", { o: "#3c74e0", y: "#a8d8ff" }], visperas: ["libro", { B: "#4a1a6a", b: "#8040c0", w: "#ffe070" }],
  averno: ["fuego", { R: "#301010", y: "#ffffff", f: "#ff3010" }], devora: ["ajo", { w: "#c090ff", l: "#6a3aa0" }], marea: ["agua", { b: "#ff9090", B: "#c02030", v: "#6a0a14" }],
  sinmanana: ["runa", { p: "#70f0f0", P: "#3c74e0", k: "#1a2a78" }], tormenta: ["rayo", { o: "#8040c0", y: "#70f0f0" }],
};
function iconoSpr(k) {
  return hornear(`ico|${k}`, () => {
    if (ICONO_EVO[k]) {
      const [base, cambios] = ICONO_EVO[k], px = sello(ICONOS[base], { ...PS, ...cambios });
      // el brillo de lo evolucionado: cuatro puntitos blancos en las esquinas
      for (const [x, y] of [[1, 1], [12, 2], [2, 12], [12, 12]]) px.p(x, y, "#ffffff");
      return px.canvas();
    }
    return sello(ICONOS[k] || ICONOS._salto).canvas();
  });
}
/** El marco de un ícono: el HUD del original pone cada arma en una cajita oscura con borde. */
function marcoIcono(x, y, k, nivel, max) {
  g.fillStyle = "#0c0a18"; g.fillRect(x, y, 14, 14);
  g.fillStyle = max ? "#e0a020" : "#5a5a7a"; g.fillRect(x, y, 14, 1); g.fillRect(x, y + 13, 14, 1); g.fillRect(x, y, 1, 14); g.fillRect(x + 13, y, 1, 14);
  if (k) g.drawImage(iconoSpr(k), x, y);
}
