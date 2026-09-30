// ─────────────────────────────────────────────────────────────────────────────
// ELEGIR UN OBJETO (cada 3 niveles, hasta 8): cuatro cartas sacadas del mazo de la partida (las
// que no se eligen vuelven al mazo). Vuelta: 5 de oro (la primera gratis con el mercader nv.3).
// Las cartas van escalonadas, como en el original ("choose one").
// ─────────────────────────────────────────────────────────────────────────────

const OB = { cartas: [], sel: -1, t: 0, gratis: false };
function entrarObjeto() {
  OB.sel = -1; OB.t = 0;
  OB.gratis = J.plantel.some((p) => p.id === "merchant" && p.lvl >= 3);
  sacarObjetos();
}
function sacarObjetos() {
  J.pool.push(...OB.cartas.filter(Boolean)); OB.cartas = [];
  A.mezclar(J.pool);
  for (let i = 0; i < 4 && J.pool.length; i++) OB.cartas.push(J.pool.pop());
}
function elegirObjeto(i) {
  const k = OB.cartas[i]; if (!k) return;
  OB.cartas.splice(i, 1);
  J.pool.push(...OB.cartas); OB.cartas = [];
  J.objetos.push({ k, lvl: 1, xp: 0 });
  sfx("elegir", 0.7);
  pasarDeNivel();
}
function pantallaObjeto(dt) {
  OB.t += dt;
  dibujarFondo(OB.t, true);
  if (M) { g.save(); dibujarMundo(); g.restore(); }
  g.fillStyle = "rgba(24,24,24,0.82)"; g.fillRect(0, 0, W, H);
  const es = IDIOMA === "es", raton = esRaton();
  texto(es ? "elegí uno" : "choose one", W / 2, 14, { esc: 2, ola: 1 });
  texto(`[fg]${es ? "oro" : "gold"}: [yellow]${J.oro}`, 10, 8, { al: "izq" });
  const n = OB.cartas.length, cw = 96, gap = 12, tot = n * cw + (n - 1) * gap, x0 = Math.round(W / 2 - tot / 2);
  let info = null;
  OB.cartas.forEach((k, i) => {
    const x = x0 + i * (cw + gap), y = 38 + (i % 2) * 10, h = 142, sel = OB.sel === i, sobre = encima(x, y, cw, h);
    cajaRed(x, y, cw, h, sel || (raton && sobre) ? "#3d3d3d" : "#353535", 5);
    marco(x, y, cw, h, sel ? COL.fg : (raton && sobre) ? rampa("bg", 10) : rampa("bg", 5), 5);
    const o = OBJETOS[k];
    texto(L(o.n).toLowerCase(), x + cw / 2, y + 8, {});
    const s = Math.sin(OB.t * 2 + i) * 2;
    g.drawImage(runa(k, 44, COL.fg), Math.round(x + cw / 2 - 22), Math.round(y + 24 + s));
    const rs = renglones(L(o.d), cw - 10).slice(0, 6);
    rs.forEach((r, j) => texto(r, x + cw / 2, y + 76 + j * 10, {}));
    if (sel) texto(es ? "[yellow]tocá para elegir" : "[yellow]tap to choose", x + cw / 2, y + h + 5, {});
    if (sel || (raton && sobre)) info = [`[fg]${L(o.n).toLowerCase()}`, "[fg]" + L(o.d)];
    if (tocado(x, y, cw, h)) { if (raton || sel) elegirObjeto(i); else { OB.sel = i; sfx("roce", 0.6); } }
  });
  const costo = OB.gratis ? 0 : 5;
  if (boton(W - 92, H - 26, 82, 16, `reroll: [bg]${costo}`, { apagado: J.oro < costo, porQue: es ? "no te alcanza el oro" : "not enough gold" })) { J.oro -= costo; OB.gratis = false; sacarObjetos(); OB.sel = -1; sfx("reroll", 0.6); }
  // tu armado, a la izquierda abajo (para decidir sabiendo qué tenés)
  texto(es ? "tu armado" : "your build", 10, H - 44, { al: "izq" });
  J.plantel.forEach((p, i) => cuadroHeroe(10 + i * 14, H - 30, p.id, p.lvl));
  J.objetos.forEach((o, i) => g.drawImage(runa(o.k, 12, COL.fgAlt), 10 + i * 15, H - 15));
  if (!OB.cartas.length) pasarDeNivel();
}
