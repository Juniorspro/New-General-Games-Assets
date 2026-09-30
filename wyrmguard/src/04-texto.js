// ─────────────────────────────────────────────────────────────────────────────
// LA LETRA: PixulBrush, la misma del original (Mercyssh, mercyssh.itch.io: libre para proyectos
// personales, con crédito — está en los créditos). La fuente no traía tildes ni eñe: se las agregamos
// (fuentes/acentos.py). Cada píxel de la letra es 128 unidades → a 8 px cae justo en la grilla.
// Cada texto se hornea UNA vez a 8 px y se le corta el alfa en 50 %: sin eso el navegador suaviza los
// bordes y la letra de píxeles sale borrosa. Colores por etiquetas, como allá: "[fg]oro: [yellow]34".
// ─────────────────────────────────────────────────────────────────────────────

const FAM = "PixulBrushES";
let FUENTE_OK = false;
(async () => {
  try {
    const bin = Uint8Array.from(atob(FUENTE_B64), (c) => c.charCodeAt(0));
    const f = new FontFace(FAM, bin.buffer);
    await f.load(); document.fonts.add(f); FUENTE_OK = true; _txt.clear(); _anchos.clear();
  } catch (e) { /* queda la monoespaciada del sistema */ }
})();

const TAG = {
  fg: COL.fg, yellow: COL.yellow, orange: COL.orange, blue: COL.blue, green: COL.green, red: COL.red, purple: COL.purple, blue2: COL.blue2, yellow2: COL.yellow2,
  white: "#ffffff", black: "#000000", bg: COL.bg,
};
/** Un color por nombre de etiqueta: "fg", "yellow", "bg10" (rampa +10), "fgm5" (rampa −5)… */
function colorTag(nom) {
  if (TAG[nom]) return TAG[nom];
  if (/^h[0-9a-f]{6}$/.test(nom)) return "#" + nom.slice(1);          // un color suelto: [h1a1a1a]
  let m = /^([a-z]+?)(m?)(\d+)$/.exec(nom);
  if (m && COL[m[1] === "light_bg" ? "bg" : m[1]]) return rampa(m[1], (m[2] ? -1 : 1) * +m[3]);
  if (nom === "light_bg") return rampa("bg", 5);
  return COL[nom] || nom;
}
const _med = document.createElement("canvas").getContext("2d");
const _anchos = new Map();
function _fuente() { return FUENTE_OK ? `8px ${FAM}` : "8px monospace"; }
/** Saca las etiquetas: [{t, c}] */
function trozos(str, col = "fg") {
  const out = []; let c = colorTag(col), re = /\[([a-z0-9_]+)\]/g, i = 0, m;
  str = String(str);
  while ((m = re.exec(str))) { if (m.index > i) out.push({ t: str.slice(i, m.index), c }); c = colorTag(m[1]); i = re.lastIndex; }
  if (i < str.length) out.push({ t: str.slice(i), c });
  return out;
}
const sinTags = (s) => String(s).replace(/\[[a-z0-9_]+\]/g, "");
function anchoTexto(str, esc = 1) {
  const s = sinTags(str); let w = _anchos.get(s);
  if (w == null) { _med.font = _fuente(); w = Math.round(_med.measureText(s).width); _anchos.set(s, w); }
  return w * esc;
}
const ALTO_T = 13, BASE_T = 9;       // alto de la caja y dónde cae la línea de base (ascenso 9 px)
const _txt = new Map();
/** Hornea el texto (con colores) nítido. */
function textoSpr(str, col = "fg") {
  const k = str + "|" + col; let c = _txt.get(k);
  if (c) return c;
  const w = Math.max(1, anchoTexto(str) + 2);
  c = document.createElement("canvas"); c.width = w; c.height = ALTO_T; const q = c.getContext("2d");
  q.font = _fuente(); q.textBaseline = "alphabetic";
  let x = 1;
  for (const p of trozos(str, col)) { q.fillStyle = p.c; q.fillText(p.t, x, BASE_T); _med.font = _fuente(); x += Math.round(_med.measureText(p.t).width); }
  const d = q.getImageData(0, 0, w, ALTO_T), a = d.data;
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] >= 110 ? 255 : 0;
  q.putImageData(d, 0, 0);
  if (_txt.size > 1500) _txt.clear();
  _txt.set(k, c);
  return c;
}
/**
 * Dibuja un texto. o: {al: "centro"|"izq"|"der", esc (entera), col, sombra, alfa, ola (amplitud en px)}.
 * y es el ARRIBA de las mayúsculas (la caja empieza 1 px más arriba). Devuelve el ancho.
 */
function texto(str, x, y, o = {}) {
  const esc = o.esc || 1, col = o.col || "fg", w = anchoTexto(str, esc);
  let X = o.al === "izq" ? x : o.al === "der" ? x - w : x - Math.floor(w / 2);
  X = Math.round(X); const Y = Math.round(y - 2 * esc);
  if (o.alfa != null) g.globalAlpha = o.alfa;
  if (o.ola) {
    // letra por letra, cada una en su onda (el "wavy" del original)
    const t = performance.now() / 1000; let cx = X, i = 0;
    for (const p of trozos(str, col)) for (const ch of p.t) {
      const s = textoSpr(ch, "fg"), dy = Math.round(Math.sin(t * 4 + i * 0.6) * o.ola);
      if (o.sombra) { g.drawImage(textoTinta(ch, "#000000"), cx, Y + dy + esc, s.width * esc, s.height * esc); }
      g.drawImage(textoTinta(ch, p.c), cx, Y + dy, s.width * esc, s.height * esc);
      cx += anchoTexto(ch, esc); i++;
    }
  } else {
    const s = textoSpr(str, col);
    if (o.sombra) g.drawImage(textoTinta(sinTags(str), o.sombra === true ? "#1a1a1a" : o.sombra), X, Y + esc, s.width * esc, s.height * esc);
    g.drawImage(s, X, Y, s.width * esc, s.height * esc);
  }
  if (o.alfa != null) g.globalAlpha = 1;
  return w;
}
/** El mismo texto todo de un color (para sombras y letras sueltas). */
function textoTinta(str, color) { return textoSpr("[" + color.replace("#", "h") + "]" + str, "fg"); }
/** Corta un texto en renglones que entren en `ancho` (respeta las etiquetas de color). */
function renglones(str, ancho, esc = 1) {
  const out = []; let r = "", col = "";
  for (const pal of String(str).split(" ")) {
    const pr = r ? r + " " + pal : pal;
    if (anchoTexto(pr, esc) > ancho && r) { out.push(r); const m = r.match(/\[[a-z0-9_]+\](?!.*\[[a-z0-9_]+\])/); col = m ? m[0] : col; r = col + pal; } else r = pr;
  }
  if (r) out.push(r);
  return out;
}
function parrafo(str, x, y, ancho, o = {}) {
  const rs = renglones(L(str), ancho, o.esc || 1), paso = o.paso || 10 * (o.esc || 1);
  rs.forEach((r, i) => texto(r, x, y + i * paso, o));
  return rs.length * paso;
}
