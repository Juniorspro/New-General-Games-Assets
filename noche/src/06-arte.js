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

// (los cazadores y los enemigos se arman por piezas en 06b-cuerpos.js)
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
