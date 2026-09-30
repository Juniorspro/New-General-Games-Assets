// ─────────────────────────────────────────────────────────────────────────────
// EL ARTE: cazadores, enemigos, recogibles y proyectiles, en píxeles, dibujados por código.
// Estilo de 16 bits gótico: siluetas claras que se leen en una multitud de 300, dos tonos por
// material y contorno oscuro del mismo color (AUTO). Cada sprite se hornea una vez.
// Los enemigos van en sellos de texto: cuerpo + dos juegos de piernas (así caminan en 2 cuadros).
// ─────────────────────────────────────────────────────────────────────────────

// la paleta de los sellos (una letra = un color)
const PS = {
  w: "#f4f0e8", l: "#b8b8c4", m: "#7a7a88", d: "#40404c", e: "#1a1016",
  y: "#ffe070", o: "#e0a020", n: "#8a5a10", f: "#ff9020",
  r: "#ff4838", R: "#b81c1c", q: "#5a0c10",
  g: "#98d060", G: "#4a8a30", h: "#1e4a1a",
  b: "#a8d8ff", B: "#3c74e0", v: "#1a2a78", c: "#70f0f0",
  p: "#ff88c8", P: "#c040a0", u: "#4a1a6a", k: "#6a3aa0",
  t: "#e0c090", T: "#9a6a40", x: "#4a2a18", s: "#f0c8a0", S: "#c8906a",
};
function sello(filas, pal = PS, contorno = AUTO) {
  const w = Math.max(...filas.map((f) => f.length)), p = new Pix(w + 2, filas.length + 2);
  p.sello(1, 1, filas, pal);
  if (contorno) p.contorno(contorno, true);
  return p;
}

// ── los cazadores: una plantilla de 12×18 que se pinta con los colores de cada uno ──
const CAZADOR = [
  "....HHHH....", "...HhhhhH...", "..HhhhhhhH..", "..HhsssshH..", "..Hhssesse..", "...hsssss...", "....SsSs....",
  "..KccccccK..", ".KcccgcccCK.", ".KccccccCcs.", ".KCcccccCK..", "..CgggggC...", "..CcccccC...", "..CCcccCC...",
];
const PIERNAS_A = ["...pp..pp...", "...pp..pp...", "..bbb..bbb.."];
const PIERNAS_B = ["....pp.pp...", "...pp...pp..", "..bbb...bbb."];
function cazadorSpr(clave, cuadro, izq) {
  return hornear(`caz|${clave}|${cuadro}|${izq}`, () => {
    const pj = PERSONAJES[clave], [C, c, p, s] = pj.pal;
    const pal = { ...PS, H: mezclar(pj.pelo, "#000000", 0.45), h: pj.pelo, s, S: mezclar(s, "#6a3a2a", 0.35), e: "#1a1016", c, C, K: mezclar(C, "#000000", 0.3), g: "#e0b040", p, b: "#2a1a14" };
    let px = sello(CAZADOR.concat(cuadro ? PIERNAS_B : PIERNAS_A), pal);
    if (izq) px = px.espejo();
    return px.canvas();
  });
}

// ── enemigos ──
const ENE_SPR = {
  murcielago: { a: ["e............e", "ee..........ee", "eee..dddd..eee", ".eeeddrdrdeee.", "..eeddddddee..", ".....dddd.....", "......dd......"],
    b: [".....dddd.....", "....ddrdrd....", "..eedddddddd..", ".eeeeddddeeee.", "eee...dd...eee", "ee..........ee", "e............e"], pal: { e: "#3a1a3a", d: "#6a3a5a", r: "#ff3030" } },
  zombi: { c: ["....GGGG.....", "...GggggG....", "...ggrgrg....", "...gggggG....", "....gGgG.....", "..BBBBBB.....", ".BBvBBBBgggg.", ".BBBBBvBBGGG.", ".BvBBBBBB....", "..BBBvBB.....", "..BBBBBB.....", "..vvvvvv....."],
    a: ["..vv..vv.....", "..vv..vv.....", "..GG...GG....", ".GGG...GGG..."], b: ["...vv.vv.....", "...vv.vv.....", "...GG.GG.....", "..GGG.GGG...."], pal: { g: "#9ab070", G: "#5a7a3a", B: "#5a6a8a", v: "#343c54", r: "#e03020" } },
  esqueleto: { c: ["...wwww.....", "..wwwwww....", "..wddwdd....", "..wwwwww....", "...wlwl.....", "....ww......", "..wwwwww....", ".w.wlwlw.w..", ".w.wwwww.w..", "...wlwlw....", "....ww......", "...wwww....."],
    a: ["...w..w.....", "...w..w.....", "..ww..ww...."], b: ["....ww......", "...w..w.....", "..ww...ww..."], pal: { w: "#e8e2d0", l: "#a8a290", d: "#2a1a20" } },
  fantasma: { c: ["....wwww....", "..wwwwwwww..", ".wwwwwwwwww.", ".wweewwweew.", ".wwwwwwwwww.", ".wwwwweewwb.", "wwwwwwwwwwbb", "wwwwwwwwwwbb", "wwwwwwwwwbbb"],
    a: ["wwwwwwwwwbb.", ".wwbwwbwwbb.", ".w..ww..wb.."], b: ["wwwwwwwwwbb.", "..wwbwwbwwb.", "..w..ww..w.."], pal: { w: "#dce8ff", b: "#8aa0d0", e: "#1a2040" }, alfa: 0.82 },
  barro: { c: [".....tttt.....", "...ttTTTTtt...", "..tTTTTTTTTt..", "..TTyTTTyTTT..", "..TTTTTTTTTx..", ".tTTTxxxTTTTx.", "tTTTTTTTTTTTTx", "tTTTTTTTTTTTxx", ".TTTTTTTTTTTx.", "..TTTTTTTTTx..", "..TTTTTTTTxx..", "..xTTTxxTTx..."],
    a: ["..TTx..TTx....", "..TTx...TTx...", "..xxx...xxx..."], b: ["...TTx.TTx....", "...TTx.TTx....", "..xxx..xxx...."], pal: { t: "#8aa060", T: "#5a7040", x: "#34401e", y: "#f0e040" } },
  lobizon: { c: ["..d.....d.....", "..dm...dm.....", "..dmmmmmm.....", "..mmrmmrmd....", "...mmmmmmmwd..", "...mmmmmmmmm..", "....dmmmm.....", "..ddmmmmmmd...", ".dmmmmlllmmd..", ".dmmmllllmmd..", ".mmmmllllmmmw.", ".wm.mlllmm.w..", "...mmmmmmm....", "...dmmmmmd...."],
    a: ["...mm...mm....", "...mm...mm....", "..dmm...dmm...", "..ww.....ww..."], b: ["....mm.mm.....", "....mm.mm.....", "...dmm.dmm....", "...ww..ww....."], pal: { m: "#7a6a64", d: "#3e322e", l: "#b0a098", r: "#ff3020", w: "#f0e8e0" } },
  mantis: { c: ["......gg........", ".....gggg.......", ".....grgr.......", "......gg........", "..l...GG...l....", ".ll..gggg..ll...", "ll..ggGGgg..ll..", "l..gggGGggg..l..", "...ggGGGGgg.....", "....ggGGgg......", ".....gGGg.......", ".....gGGg.......", "....ggGGgg......", ".....GGGG......."],
    a: ["....G....G......", "...G......G.....", "..G........G...."], b: ["....G...G.......", "....G...G.......", "...G.....G......"], pal: { g: "#8ad050", G: "#3a8a2a", l: "#e0f0c0", r: "#ff4020" } },
  momia: { c: ["....tttt.....", "...ttTttt....", "...trttrt....", "...tTtttT....", "....tttt.....", "..tttTtttt...", ".ttTttttTtttt", ".tttttTtt.ttt", ".tTttttttT...", "..ttTttttt...", "..tttttTtt...", "..tTtttttt..."],
    a: ["..ttt..ttt...", "..tTt..tTt...", "..ttt..ttt..."], b: ["...ttt.ttt...", "...tTt.tTt...", "..ttt...ttt.."], pal: { t: "#e0d0a8", T: "#8a7a58", r: "#ff5020" } },
  flor: { c: ["...pp..pp...", "..pPPppPPp..", ".pPPPppPPPp.", "pPPyyqqyyPPp", "pPPyqeeqyPPp", ".pPyqeeqyPp.", "..pPyyyyPp..", "...pPPPPp...", "....pGGp...."],
    a: [".gg..GG..gg.", "ggGG.GG.GGgg", ".gGGGGGGGGg.", "...gGGGGg...", "....GGGG...."], b: ["..gg.GG.gg..", ".gGGGGGGGGg.", "gGGGGGGGGGGg", "...gGGGGg...", "....GGGG...."], pal: { p: "#ff90c8", P: "#d03890", y: "#ffe060", q: "#801030", e: "#300008", g: "#70c050", G: "#2a7a2a" } },
  parca: { c: ["..............ll", "...........llll.", ".........lll....", "....ddd.T.......", "...deeedT.......", "..deewwedT......", "..dewdwdeT......", "..deewwedT......", "..deeeeeeT......", ".deeeeeeeTd.....", ".deeweeeeeTd....", "deeeeeeeeeTed...", "deeeeeeeeeeTd...", "deeeeeeeeeeTd...", ".deeeeeeeeeeT..."],
    a: [".deeeeeeeeeeeT..", "..deeeeeeeeed...", "..deedeedeed...."], b: [".deeeeeeeeeeeT..", "..deeeeeeeeed...", "...deedeedeed..."], pal: { e: "#16101c", d: "#3a3048", w: "#f0ece0", l: "#d0d8e8", T: "#6a4a2a" } },
};
/** El sprite de un enemigo: cuadro 0/1, mirando a la izquierda o no, con su tinte. */
function enemigoSpr(spr, cuadro, izq, tinte) {
  return hornear(`ene|${spr}|${cuadro}|${izq}|${tinte || ""}`, () => {
    const d = ENE_SPR[spr], pal = { ...PS, ...d.pal };
    if (tinte) for (const k in d.pal) pal[k] = mezclar(d.pal[k], tinte, 0.55);
    let px = sello(d.c ? d.c.concat(cuadro ? d.b : d.a) : (cuadro ? d.b : d.a), pal);
    // los sellos miran a la derecha; el original da vuelta el sprite según hacia dónde camina
    if (izq) px = px.espejo();
    const c = px.canvas();
    if (d.alfa) { const q = lienzoNuevo(c.width, c.height), x = q.getContext("2d"); x.globalAlpha = d.alfa; x.drawImage(c, 0, 0); return q; }
    return c;
  });
}
const _azules = new WeakMap();
/** Congelado (el reloj): el sprite teñido de azul hielo, como el original. */
function azulado(c) {
  let b = _azules.get(c); if (b) return b;
  b = lienzoNuevo(c.width, c.height); const q = b.getContext("2d");
  q.drawImage(c, 0, 0); q.globalCompositeOperation = "source-atop"; q.fillStyle = "rgba(90,170,255,0.6)"; q.fillRect(0, 0, b.width, b.height);
  _azules.set(c, b); return b;
}

// ── recogibles ──
const GEMA = ["..w..", ".wbB.", "wbbBv", "bbBBv", ".bBv.", "..v.."];
const COLOR_GEMA = { azul: { w: "#e8f8ff", b: "#60b8ff", B: "#2a6ae0", v: "#1a3090" }, verde: { w: "#f0fff0", b: "#70e070", B: "#20a040", v: "#105a20" }, roja: { w: "#fff0f0", b: "#ff7070", B: "#d02030", v: "#6a0a14" } };
function gemaSpr(tipo) { return hornear(`gema|${tipo}`, () => sello(GEMA, COLOR_GEMA[tipo], "#0a0a1a").canvas()); }
const RECOGIBLES = {
  moneda: [["..ooo..", ".oyyyo.", "oyyoyyn", "oyyoyyn", "oyyoyyn", ".onnnn.", "..nnn.."]],
  bolsa: [["...xx...", "..xTTx..", "...xx...", "..TttT..", ".TtyytT.", "TtyoyytT", "TtyyoytT", "TttyyttT", ".TTTTTT."]],
  bolsaRica: [["...xx...", "..xRRx..", "...xx...", "..RrrR..", ".RryyrR.", "RryoyyrR", "RryyoyrR", "RrryyrrR", ".RRRRRR."]],
  pollo: [["......ttt..", "....tTTTTt.", "...tTffTTTt", "..tTTTTTTTt", ".wwTTTTTTT.", "wwwwxTTTx..", ".ww..xxx..."]],
  rosario: [["..bbbbb..", ".b.....b.", "b.......b", "b.......b", ".b.....b.", "..bb.bb..", "....o....", "...ooo...", "....o....", "....o...."]],
  reloj: [["...ooo...", ".ooyyyoo.", "oyywyyyyo", "oyywyyyyo", "oyywwwyyo", "oyyyyyyyo", ".ooyyyoo.", "...ooo...", "..n...n.."]],
  aspiradora: [[".RR...RR.", ".RR...RR.", ".RR...RR.", ".RR...RR.", ".RRRRRRR.", "..RRRRR..", "ll.....ll", "ll.....ll"]],
  trebolito: [[".gg.gg.", "gGGgGGg", ".gGGGg.", "gGGgGGg", ".gg.gg.", "...G...", "..G...."]],
  corazoncito: [[".rr.rr.", "rRRrRRr", "rRRRRRr", ".rRRRr.", "..rRr..", "...r..."]],
};
function recogibleSpr(k) { return hornear(`rec|${k}`, () => sello(RECOGIBLES[k][0]).canvas()); }

/** El cofre del tesoro: madera con zunchos de oro y cerradura. */
function cofreSpr(abierto) {
  return hornear(`cofre|${abierto}`, () => {
    const p = new Pix(16, 14), mad = ["#3a1c0c", "#6a3a18", "#9a5a28"], oro = ["#8a5a10", "#e0a020", "#ffe070"];
    if (!abierto) { p.caja(1, 2, 14, 5, mad); p.rect(1, 1, 14, 1, mad[2]); } else { p.caja(1, 0, 14, 3, mad); p.rect(2, 3, 12, 3, "#ffe8a0"); }
    p.caja(1, 7, 14, 6, mad);
    for (const x of [3, 12]) p.rect(x, abierto ? 0 : 1, 1, 13, oro[1]);
    p.rect(1, 6, 14, 1, oro[2]); p.rect(1, 12, 14, 1, oro[0]);
    p.rect(7, 6, 2, 3, oro[2]); p.p(7, 8, "#1a1010");
    p.contorno(AUTO, true);
    return p.canvas();
  });
}
/** Los braseros: la luz del escenario; al romperlos sueltan algo. 3 cuadros de llama. */
function braseroSpr(cuadro) {
  return hornear(`bras|${cuadro}`, () => {
    const p = new Pix(11, 18), hi = ["#1a1a22", "#3a3a48", "#6a6a7a"];
    p.caja(2, 7, 7, 3, hi); p.rect(4, 10, 3, 5, hi[1]); p.rect(2, 15, 7, 2, hi[0]); p.rect(3, 14, 5, 1, hi[1]);
    const fl = [[".y.", "yfy", "fff"], ["..y", ".yf", "ffr"], ["y..", "fy.", "rff"]][cuadro];
    const pal = { y: "#fff0a0", f: "#ff9020", r: "#e03010" };
    p.sello(4, 1, ["..y..", ".yfy.", "yfffy", "frrrf"], pal);
    p.sello(4, 1 + (cuadro % 2), fl, pal);
    p.contorno(AUTO, true);
    return p.canvas();
  });
}

// ── proyectiles y efectos de armas ──
/** El latigazo: una media luna blanca que se afina en la punta (largo 64×área, alto 14). */
function latigoSpr(largo, alto, rojo) {
  return hornear(`lat|${largo}|${alto}|${rojo}`, () => {
    const p = new Pix(largo, alto), col = rojo ? ["#ff3030", "#ff8080", "#ffe0e0"] : ["#9aa0c0", "#dde0f0", "#ffffff"];
    for (let x = 0; x < largo; x++) {
      const t = x / largo, grosor = Math.sin(t * Math.PI) * (alto * 0.45) * (0.4 + t * 0.6), cyy = alto * 0.55 - Math.sin(t * Math.PI) * alto * 0.25;
      for (let y = 0; y < alto; y++) { const d = Math.abs(y - cyy); if (d <= grosor) p.p(x, y, d < grosor * 0.35 ? col[2] : d < grosor * 0.7 ? col[1] : col[0]); }
    }
    return p.canvas();
  });
}
function bolaSpr(r, ramp, clave) {
  return hornear(`bola|${clave}|${r}`, () => { const p = new Pix(r * 2 + 3, r * 2 + 3); p.bola(r + 1.5, r + 1.5, r + 0.5, r + 0.5, ramp); p.contorno(AUTO, true); return p.canvas(); });
}
const PROY = {
  varita: () => bolaSpr(2, ["#3a70e0", "#8ac0ff", "#e8f8ff"], "varita"),
  sagrada: () => bolaSpr(2, ["#e0a020", "#ffe070", "#ffffff"], "sagrada"),
  fuego: () => bolaSpr(3, ["#b02010", "#ff8020", "#ffe070"], "fuego"),
  averno: () => bolaSpr(6, ["#801008", "#ff5010", "#ffd060"], "averno"),
  cuchillo: () => hornear("cuch", () => sello(["....www.", "wlllllww", "TTllllw.", "........"], PS, "#1a1a24").canvas()),
  milfilos: () => hornear("mil", () => sello(["....yyy.", "yooooooyy", "TToooy..", "........"], PS, "#2a1a08").canvas()),
  hacha: () => hornear("hacha", () => sello(["..llll...", ".lwwwll..", "lwwlllTl.", "lwlllTTl.", ".llllTl..", "..ll.T...", ".....T...", "......T..", ".......T."], PS).canvas()),
  espiral: () => hornear("guad", () => sello(["...lllll..", ".llwwwwll.", "lw.....lw.", "l.......T.", "........T.", ".......T..", "......T...", ".....T...."], PS).canvas()),
  cruz: () => hornear("cruz", () => sello(["...yy...", "...yy...", "yyyyyyyy", "yyywwyyy", "...yy...", "...yy...", "...oo...", "...oo..."], PS).canvas()),
  celeste: () => hornear("espada", () => sello(["....b....", "...bwb...", "...bwb...", "...bwb...", "...bwb...", "...bwb...", "...bwb...", ".ooyyyoo.", "...TTT...", "...TTT...", "...yyy..."], PS).canvas()),
  libro: () => hornear("libro", () => sello(["BBBBBBBB.", "BbbbbbbBw", "BbbwwbbBw", "BbwwwwbBw", "BbbwwbbBw", "BbbwwbbBw", "BbbbbbbBw", "BBBBBBBB."], PS).canvas()),
  visperas: () => hornear("libroO", () => sello(["uuuuuuuu.", "ukkkkkkuw", "ukkyykkuw", "ukyyyykuw", "ukkyykkuw", "ukkyykkuw", "ukkkkkkuw", "uuuuuuuu."], PS).canvas()),
  agua: () => hornear("frasco", () => sello(["..ll..", "..ww..", ".bbbb.", "bbwbbB", "bBBBBB", ".BBBB."], PS).canvas()),
  runa: () => hornear("runa", () => sello(["...p...", "..pwp..", ".pwPwp.", "pwPPPwp", ".pwPwp.", "..pwp..", "...p..."], PS).canvas()),
  sinmanana: () => hornear("runaN", () => sello(["...c...", "..cwc..", ".cwBwc.", "cwBBBwc", ".cwBwc.", "..cwc..", "...c..."], PS).canvas()),
};
function proySpr(k) { return (PROY[k] || PROY.varita)(); }
