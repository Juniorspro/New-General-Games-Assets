// ─────────────────────────────────────────────────────────────────────────────
// LA LETRA. Medido en capturas del original (wiki, pantalla de subir de nivel): el texto es una
// máquina de escribir con remates (tipo Courier) en negrita, blanca con contorno negro, nítida a la
// resolución de la pantalla. Acá: Courier Prime Bold (OFL), embebida, dibujada en la pasada de
// interfaz y cacheada por texto. La letra de píxeles de abajo queda sólo para el logo:
// una fuente de píxeles propia con mayúsculas (5×7, la de Shumio), minúsculas con
// ascendentes y descendentes, tildes, Ñ y signos. Cada texto se hornea UNA vez (degradé por fila,
// contorno negro) y se cachea: dibujar cientos de números por cuadro sale casi gratis.
// ─────────────────────────────────────────────────────────────────────────────

const GLIFOS = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#", B: "####.|#...#|#...#|####.|#...#|#...#|####.", C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.", E: "#####|#....|#....|####.|#....|#....|#####", F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.####", H: "#...#|#...#|#...#|#####|#...#|#...#|#...#", I: "###|.#.|.#.|.#.|.#.|.#.|###",
  J: "..###|...#.|...#.|...#.|#..#.|#..#.|.##..", K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#", L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#", N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#", O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....", Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#", R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.", T: "#####|..#..|..#..|..#..|..#..|..#..|..#..", U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..", W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#", X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..", Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  0: ".###.|#..##|#.#.#|#.#.#|##..#|#...#|.###.", 1: ".#.|##.|.#.|.#.|.#.|.#.|###", 2: ".###.|#...#|....#|...#.|..#..|.#...|#####",
  3: "####.|....#|....#|.###.|....#|....#|####.", 4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.", 5: "#####|#....|####.|....#|....#|#...#|.###.",
  6: ".###.|#....|#....|####.|#...#|#...#|.###.", 7: "#####|....#|...#.|..#..|..#..|..#..|..#..", 8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
  9: ".###.|#...#|#...#|.####|....#|....#|.###.",
  " ": "...|...|...|...|...|...|...", ".": ".|.|.|.|.|.|#", ",": "..|..|..|..|..|.#|#.", ":": ".|.|#|.|.|#|.", "!": "#|#|#|#|#|.|#", "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
  "¡": "#|.|#|#|#|#|#", "¿": "..#..|.....|..#..|.#...|#....|#...#|.###.", "'": "#|#|.|.|.|.|.", "-": "....|....|....|####|....|....|....", "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
  "/": "....#|....#|...#.|..#..|.#...|#....|#....", "%": "##..#|##..#|...#.|..#..|.#...|#..##|#..##", "(": ".#|#.|#.|#.|#.|#.|.#", ")": "#.|.#|.#|.#|.#|.#|#.", "×": ".....|#...#|.#.#.|..#..|.#.#.|#...#|.....",
  "=": ".....|.....|#####|.....|#####|.....|.....", "<": "...#|..#.|.#..|#...|.#..|..#.|...#", ">": "#...|.#..|..#.|...#|..#.|.#..|#...", "·": ".|.|.|#|.|.|.", "$": "..#..|.####|#.#..|.###.|..#.#|####.|..#..",
  "♥": ".....|##.##|#####|#####|.###.|..#..|.....", "♦": "..#..|.###.|#####|#####|.###.|..#..|.....",
};
// las minúsculas: 9 filas (0-1 ascendentes, 2-6 el cuerpo, 7-8 descendentes)
const MINUS = {
  a: ".....|.....|.###.|....#|.####|#...#|.####|.....|.....", b: "#....|#....|####.|#...#|#...#|#...#|####.|.....|.....",
  c: "....|....|.###|#...|#...|#...|.###|....|....", d: "....#|....#|.####|#...#|#...#|#...#|.####|.....|.....",
  e: ".....|.....|.###.|#...#|#####|#....|.###.|.....|.....", f: "..##|.#..|####|.#..|.#..|.#..|.#..|....|....",
  g: ".....|.....|.####|#...#|#...#|#...#|.####|....#|.###.", h: "#....|#....|####.|#...#|#...#|#...#|#...#|.....|.....",
  i: "#|.|#|#|#|#|#|.|.", j: "..#|...|..#|..#|..#|..#|..#|..#|##.", k: "#...|#...|#..#|#.#.|##..|#.#.|#..#|....|....",
  l: "#.|#.|#.|#.|#.|#.|.#|..|..", m: ".....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#|.....|.....",
  n: ".....|.....|####.|#...#|#...#|#...#|#...#|.....|.....", o: ".....|.....|.###.|#...#|#...#|#...#|.###.|.....|.....",
  p: ".....|.....|####.|#...#|#...#|#...#|####.|#....|#....", q: ".....|.....|.####|#...#|#...#|#...#|.####|....#|....#",
  r: "....|....|#.##|##..|#...|#...|#...|....|....", s: "....|....|.###|#...|.##.|...#|###.|....|....",
  t: ".#..|.#..|####|.#..|.#..|.#..|..##|....|....", u: ".....|.....|#...#|#...#|#...#|#...#|.####|.....|.....",
  v: ".....|.....|#...#|#...#|#...#|.#.#.|..#..|.....|.....", w: ".....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.|.....|.....",
  x: ".....|.....|#...#|.#.#.|..#..|.#.#.|#...#|.....|.....", y: ".....|.....|#...#|#...#|#...#|#...#|.####|....#|.###.",
  z: ".....|.....|#####|...#.|..#..|.#...|#####|.....|.....",
};
// tildes: la letra base con la marca encima. Mayúsculas: en las 2 filas de aire; minúsculas: en su fila 0-1
const MARCAS = { "Á": "A´", "É": "E´", "Í": "I´", "Ó": "O´", "Ú": "U´", "Ñ": "N~", "Ü": "U¨", "á": "a´", "é": "e´", "í": "i´", "ó": "o´", "ú": "u´", "ñ": "n~", "ü": "u¨" };
const ALTO_LETRA = 11;           // 2 de aire para tildes + 9 de letra
const _glifo = {};
function glifo(ch) {
  if (_glifo[ch]) return _glifo[ch];
  let filas;
  if (MINUS[ch]) filas = MINUS[ch].split("|");
  else { const gl = GLIFOS[ch] || GLIFOS[ch.toUpperCase()] || GLIFOS["?"]; filas = gl.split("|"); filas.push("", ""); }
  return (_glifo[ch] = { w: Math.max(...filas.map((f) => f.length)), filas });
}
function anchoLetra(ch) { const m = MARCAS[ch]; return glifo(m ? m[0] : ch).w; }
function anchoPixel(str) { let w = 0; for (const ch of str) w += anchoLetra(ch) + 1; return Math.max(0, w - 1); }

/** Degradés por fila, de arriba a abajo (11 filas). Todos con la misma luz: claro arriba. */
function _grad(a, b) { const out = []; for (let i = 0; i < ALTO_LETRA; i++) out.push(mezclar(a, b, lim((i - 2) / 8, 0, 1))); return out; }
const GRADIENTES = {
  blanco: _grad("#ffffff", "#d8d2c8"), oro: _grad("#fff3b0", "#e08a18"), rojo: _grad("#ffb0a0", "#c01818"),
  azul: _grad("#e8f4ff", "#6aa8ff"), verde: _grad("#e8ffd0", "#58c040"), gris: _grad("#c8c4bc", "#7c776e"),
  amarillo: _grad("#fffbe0", "#ffd84a"), violeta: _grad("#f4e4ff", "#a070e0"), negro: _grad("#2a2226", "#0a0608"),
};
/** Hornea un texto. o: {grad, contorno (color o 0), sombra} */
function textoSpr(str, o = {}) {
  str = String(str);
  const grad = o.grad || "blanco", cont = o.contorno ?? "#000000", som = o.sombra ?? 1;
  return hornear(`tx|${str}|${grad}|${cont}|${som}`, () => {
    const w = anchoPixel(str), p = new Pix(w + 2, ALTO_LETRA + 2), gr = GRADIENTES[grad] || GRADIENTES.blanco;
    let x = 1;
    for (const ch of str) {
      const m = MARCAS[ch], base = m ? m[0] : ch, gl = glifo(base), may = !MINUS[base];
      gl.filas.forEach((f, y) => { for (let i = 0; i < f.length; i++) if (f[i] === "#") p.p(x + i, 1 + 2 + y, gr[2 + y]); });
      if (m) {
        const cx0 = x + Math.floor(gl.w / 2), y0 = may ? 1 : 3;     // la marca: arriba de la mayúscula o en el hueco de la minúscula
        if (m[1] === "´") { p.p(cx0, y0 + 1, gr[0]); p.p(cx0 + 1, y0, gr[0]); }
        if (m[1] === "~") { p.p(cx0 - 2, y0 + 1, gr[0]); p.p(cx0 - 1, y0, gr[0]); p.p(cx0, y0 + 1, gr[0]); p.p(cx0 + 1, y0, gr[0]); }
        if (m[1] === "¨") { p.p(cx0 - 1, y0 + 1, gr[0]); p.p(cx0 + 1, y0 + 1, gr[0]); }
      }
      x += gl.w + 1;
    }
    if (cont) p.contorno(cont, true);
    let c = p.canvas();
    if (som) {
      const s = lienzoNuevo(c.width + 1, c.height + 1), q = s.getContext("2d");
      q.globalAlpha = 0.5; q.drawImage(c, 1, 1); q.globalCompositeOperation = "source-in"; q.fillStyle = "#000"; q.fillRect(0, 0, s.width, s.height);
      q.globalCompositeOperation = "source-over"; q.globalAlpha = 1; q.drawImage(c, 0, 0); c = s;
    }
    return c;
  });
}
/** El logo (letra de píxeles propia, gótica). o: {al, escala, grad, alfa} */
function textoPixel(str, x, y, o = {}) {
  const s = textoSpr(str, o), e = o.escala || 1, w = s.width * e;
  const X = o.al === "izq" ? x : o.al === "der" ? x - w : x - Math.floor(w / 2);
  if (o.alfa != null) g.globalAlpha = o.alfa;
  g.drawImage(s, Math.round(X), Math.round(y), w, s.height * e);
  if (o.alfa != null) g.globalAlpha = 1;
  return w;
}
/** Corta un texto en renglones que entren en `ancho` píxeles. */
function renglones(str, ancho) {
  const out = []; let r = "";
  for (const pal of String(str).split(" ")) { const prueba = r ? r + " " + pal : pal; if (anchoTexto(prueba) > ancho && r) { out.push(r); r = pal; } else r = prueba; }
  if (r) out.push(r);
  return out;
}

// los números chicos (3×5) para el daño: blancos con contorno, como el original
const CHICOS = { 0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###", 2: "###|..#|###|#..|###", 3: "###|..#|.##|..#|###", 4: "#.#|#.#|###|..#|..#",
  5: "###|#..|###|..#|###", 6: "###|#..|###|#.#|###", 7: "###|..#|..#|.#.|.#.", 8: "###|#.#|###|#.#|###", 9: "###|#.#|###|..#|###", k: "#..|#.#|##.|#.#|#.#", ".": "...|...|...|...|.#.", "+": "...|.#.|###|.#.|..." };
function numeroSpr(str, color = "#ffffff") {
  str = String(str);
  return hornear(`num|${str}|${color}`, () => {
    const p = new Pix(str.length * 4 + 1, 7);
    [...str].forEach((ch, i) => { const gl = CHICOS[ch]; if (!gl) return; gl.split("|").forEach((f, y) => { for (let k = 0; k < 3; k++) if (f[k] === "#") p.p(1 + i * 4 + k, 1 + y, color); }); });
    p.contorno("#000000", true);
    return p.canvas();
  });
}
/** 12345 → "12.3k" (el original usa prefijos para cifras grandes). */
const corto = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? (n / 1e3).toFixed(1) + "k" : String(Math.round(n)));

// ── el texto de la interfaz: Courier Prime Bold ──
const FAM = "NocheMono", FAM_CSS = `${FAM}, "Courier Prime", "Courier New", Courier, monospace`;
const TAM_LETRA = 8;                 // en píxeles del mundo (×PX en la pantalla): 12 px CSS en un teléfono
let FUENTE_OK = false;
const _txt = new Map(), _med = document.createElement("canvas").getContext("2d");
(async () => {
  try {
    const bin = Uint8Array.from(atob(FUENTE_B64), (c) => c.charCodeAt(0));
    const f = new FontFace(FAM, bin.buffer, { weight: "700" });
    await f.load(); document.fonts.add(f); FUENTE_OK = true; _txt.clear();
  } catch (e) { /* queda la monoespaciada del sistema */ }
})();
const COLORES = { blanco: ["#ffffff"], amarillo: ["#fff04a"], oro: ["#fff4c0", "#f0b030"], rojo: ["#ffa090", "#e8301c"], azul: ["#e4e8ff"], gris: ["#b8b8c2"], verde: ["#90ff7a"], violeta: ["#dcb8ff"], negro: ["#141414"] };
const fuenteCSS = (tam) => `700 ${tam}px ${FAM_CSS}`;
function anchoTexto(str, escala = 1) { _med.font = fuenteCSS(TAM_LETRA * escala * 4); return _med.measureText(String(str)).width / 4; }
const encaje = (v) => Math.round(v * PX) / PX;
/** Hornea un texto a la resolución de la pantalla (PX por píxel del mundo), con contorno negro. */
function textoHD(str, tam, grad, contorno) {
  const k = `${str}|${tam}|${grad}|${contorno}|${PX}|${FUENTE_OK}`;
  let c = _txt.get(k); if (c) return c;
  if (_txt.size > 2500) _txt.clear();
  const s = PX, px = tam * s, w = Math.ceil(anchoTexto(str, tam / TAM_LETRA) * s + px * 0.4 + 4), h = Math.ceil(px * 1.4 + 4);
  c = lienzoNuevo(w, h); const q = c.getContext("2d");
  q.font = fuenteCSS(px); q.textBaseline = "middle"; q.lineJoin = "round";
  const x = Math.ceil(px * 0.2) + 2, y = Math.round(h / 2);
  if (contorno) { q.lineWidth = Math.max(2, s * 1.2 * Math.min(1.6, tam / TAM_LETRA)); q.strokeStyle = contorno; q.strokeText(str, x, y); }
  const cols = grad && grad[0] === "#" ? [grad] : COLORES[grad] || COLORES.blanco;
  if (cols.length > 1) { const gr = q.createLinearGradient(0, y - px * 0.4, 0, y + px * 0.4); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); q.fillStyle = gr; } else q.fillStyle = cols[0];
  q.fillText(str, x, y);
  c.ox = x / s; c.s = s;
  _txt.set(k, c); return c;
}
/** Dibuja un texto de interfaz. o: {al: "izq"|"der"|"centro", escala, grad (nombre o #color), alfa, contorno} → ancho */
function texto(str, x, y, o = {}) {
  str = String(str);
  const esc = o.escala || 1, c = textoHD(str, TAM_LETRA * esc, o.grad || "blanco", o.contorno === 0 ? 0 : o.contorno || "#000000");
  const w = anchoTexto(str, esc), X = o.al === "izq" ? x : o.al === "der" ? x - w : x - w / 2;
  // la línea media del texto cae donde caía la de la letra vieja (fila 6 de 11): no se corre ningún menú
  const Y = y + 6 * esc - c.height / c.s / 2;
  if (o.alfa != null) g.globalAlpha = o.alfa;
  g.drawImage(c, encaje(X - c.ox), encaje(Y), c.width / c.s, c.height / c.s);
  if (o.alfa != null) g.globalAlpha = 1;
  return w;
}
