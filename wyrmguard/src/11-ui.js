// ─────────────────────────────────────────────────────────────────────────────
// LA INTERFAZ: botones (se aprietan al SOLTAR), la ficha de información y los textos de los héroes.
// Estilo del original: píldoras grises claras con la letra oscura, todo en minúscula.
// ─────────────────────────────────────────────────────────────────────────────

const UI = { foco: null, hover: null, t: 0, info: null, aviso: null, avisoT: 0 };
const esRaton = () => !IN.tactil;
/** Un botón. Devuelve true si lo tocaron este cuadro. o: {col, tcol, apagado, chico, icono} */
function boton(x, y, w, h, txt, o = {}) {
  const sobre = encima(x, y, w, h), apag = o.apagado;
  const bg = o.col ? (apag ? rampa("bg", 3) : COL[o.col] || o.col) : apag ? rampa("bg", 3) : sobre ? rampa("bg", 16) : rampa("bg", 10);
  cajaRed(x, y, w, h, bg, Math.min(4, h / 2));
  if (sobre && !apag) marco(x - 1, y - 1, w + 2, h + 2, COL.fg, 4);
  texto(txt, x + w / 2, y + Math.floor((h - 7) / 2), { col: o.tcol || (apag ? rampa("bg", 8) : o.col ? "bg" : "bg"), ola: o.ola });
  const t = tocado(x, y, w, h);
  if (t) { if (apag) { sfx("no", 0.4); if (o.porQue) avisar(o.porQue); return false; } sfx("clic", 0.5); }
  return t;
}
function avisar(txt) { UI.aviso = txt; UI.avisoT = 2.2; }
function dibujarAviso(dt) {
  if (UI.avisoT <= 0) return; UI.avisoT -= dt;
  const w = anchoTexto(UI.aviso) + 16, x = Math.round(W / 2 - w / 2), y = H - 22;
  cajaRed(x, y, w, 14, rampa("bg", -4), 3); marco(x, y, w, 14, rampa("bg", 8), 3);
  texto(UI.aviso, W / 2, y + 4, { alfa: Math.min(1, UI.avisoT * 3) });
}

// ── los textos de un héroe: la descripción con los números del nivel ──
function statsBase(id, lvl) {
  const h = HEROES[id], m = { hp: 1, dmg: 1, aspd: 1, def: 1, mv: 1 };
  for (const c of h.clases) for (const s in m) m[s] *= MULT[c][s];
  return { hp: Math.round(100 * 2 ** (lvl - 1) * m.hp), dmg: Math.round(10 * 2 ** (lvl - 1) * m.dmg * 100) / 100, aspd: m.aspd, def: Math.round(25 * m.def), mv: Math.round(75 * m.mv) };
}
const _r2 = (x) => String(Math.round(x * 100) / 100);
function llenar(txt, d) {
  return txt.replace(/\{d(\d*|h)\}/g, (_, k) => _r2(k === "" ? d : k === "h" ? d / 2 : k === "015" ? d * 0.15 : k === "033" ? d / 3 : d * +k));
}
function textoHeroe(id, lvl) {
  const h = HEROES[id], s = statsBase(id, lvl);
  const clases = h.clases.map((c) => `[${CLASES[c].col}]${L(CLASES[c].n)}`).join("[fg], ");
  return {
    titulo: `[${h.col}]${h.n.toLowerCase()}[fg] - [yellow]lv.${lvl}[fg], tier [yellow]${h.tier}`,
    clases: `${IDIOMA === "es" ? "clases" : "classes"}: ${clases}`,
    stats: `[red]hp ${s.hp}[fg]  [red]dmg ${s.dmg}[fg]  [green]aspd ${_r2(s.aspd)}x[fg]  [yellow]def ${s.def}[fg]  [green]mv ${s.mv}`,
    desc: "[fg]" + llenar(L(h.d), s.dmg),
    ef: `${lvl >= 3 ? "[yellow]" : "[bg10]"}lv.3 ${IDIOMA === "es" ? "efecto" : "effect"} - ${h.ef.n.toLowerCase()}: ${lvl >= 3 ? "[fg]" : "[bg10]"}${llenar(L(h.ef), statsBase(id, 3).dmg).replace(/\[(fg|yellow)\]/g, lvl >= 3 ? "[$1]" : "[bg10]")}`,
  };
}
function textoClase(k, cuenta) {
  const c = CLASES[k], s = c.sets;
  let d = L(c.d).replace("{a}", s[0]).replace("{b}", s[1] ?? "").replace("{c}", s[2] ?? "");
  return { titulo: `[${c.col}]${L(c.n)}[fg] - ${cuenta}/${s[s.length - 1]}`, desc: "[fg]" + d };
}
function textoObjeto(o) {
  const x = OBJETOS[o.k], sube = x.niv && o.lvl < 3, max = o.lvl === 1 ? 2 : 3;
  return { titulo: `[fg]${L(x.n).toLowerCase()}${x.niv ? `, [yellow]lv.${o.lvl}` : ""}${sube ? `[fg], xp: [yellow]${o.xp}/${max}` : ""}`, desc: "[fg]" + L(x.d) };
}
/** La ficha de información: una caja con renglones que se cortan solos. */
function fichaInfo(x, y, w, renglonesTxt, o = {}) {
  const lineas = []; for (const r of renglonesTxt) if (r) lineas.push(...renglones(r, w - 12));
  // 11 px por renglón: con 10 las mayúsculas de uno tocaban las colas del de arriba
  const h = lineas.length * 11 + 7, Y = o.arriba ? y - h : y;
  cajaRed(x, Y, w, h, "rgba(26,26,26,0.92)", 4); marco(x, Y, w, h, rampa("bg", 6), 4);
  lineas.forEach((l, i) => texto(l, x + 6, Y + 6 + i * 11, { al: "izq" }));
  return h;
}
/** El cuadradito del héroe: color, nivel adentro (como la columna "party" del original). */
// los números de PixulBrush miden 9 px (las minúsculas 6): para centrarlos en una caja, la parte de
// arriba del número va a (alto−9)/2, y texto() la dibuja 2 px más arriba de la "y" que recibe
function numeroEnCaja(n, x, y, w, h, col = "bg") { texto(String(n), x + w / 2 + 0.5, y + Math.floor((h - 9) / 2) + 2, { col }); }
function cuadroHeroe(x, y, id, lvl, tam = 12) {
  cajaRed(x, y, tam, tam, COL[HEROES[id].col], 3);
  numeroEnCaja(lvl, x, y, tam, tam);
}
/** La baldosa de una clase con sus puntitos (cuántos hay de los que hacen falta). */
function baldosaClase(x, y, k, cuenta, activa) {
  const c = CLASES[k], col = COL[c.col];
  cajaRed(x, y, 12, 16, activa ? col : "#3c3c3c", 3);
  g.drawImage(iconoClase(k, activa ? "#303030" : col), x + 3, y + 5);
  const max = c.sets[c.sets.length - 1];
  for (let i = 0; i < max; i++) { const px = x + 2 + (i % 2) * 5, py = y + 18 + Math.floor(i / 2) * 3; caja(px, py, 3, 2, i < cuenta ? col : "#454545"); }
  return 18 + Math.ceil(max / 2) * 3;
}
