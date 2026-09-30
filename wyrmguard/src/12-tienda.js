// ─────────────────────────────────────────────────────────────────────────────
// LA TIENDA (buy_screen.lua): tres cartas sacadas con las probabilidades del nivel de tienda;
// cuestan su tier. Comprar uno que ya tenés lo sube: 3 copias = nivel 2, 9 = nivel 3.
// Vuelta de cartas: 2 de oro. Tienda +1 XP: 5 de oro (niveles 1→5 con 3/4/5/6 de XP).
// Vender devuelve tier × 1/2/6 según el nivel. El orden de la víbora importa (objetos por puesto):
// se reordena con las flechas. En el teléfono se toca una vez para ver y otra para comprar;
// con mouse, pasar por arriba muestra la ficha y el clic compra, como allá.
// ─────────────────────────────────────────────────────────────────────────────

const TI = { sel: null, t: 0 };
function sacarCartas() {
  const pesos = TIENDA_ODDS[J.tiendaNivel];
  let c;
  do { c = [0, 1, 2].map(() => A.uno(POR_TIER[A.peso(pesos)])); } while (c.every((id) => !HEROES[id].ataca));
  J.cartas = c;
}
function entrarTienda() {
  M = null; TI.sel = null;
  if (!J.cartas || (!J.bloqueo && J.cartasNivel !== J.nivel)) sacarCartas();
  J.cartasNivel = J.nivel; J.bloqueo = false;
  tocarTema("tienda");
  if (!G.vistoGuia) TI.guia = true;
}
function precioVenta(p) { const t = HEROES[p.id].tier; return t * (p.lvl === 1 ? 1 : p.lvl === 2 ? 2 : 6) + p.res[0] * t + p.res[1] * 3 * t; }
function comprar(i) {
  const id = J.cartas[i]; if (!id) return;
  const h = HEROES[id], ya = J.plantel.find((p) => p.id === id);
  if (J.oro < h.tier) { sfx("no"); avisar(IDIOMA === "es" ? "no te alcanza el oro" : "not enough gold"); return; }
  if (ya) {
    if (ya.lvl >= 3) { sfx("no"); avisar(IDIOMA === "es" ? "ya está al nivel máximo" : "this unit has already reached max level"); return; }
    J.oro -= h.tier;
    if (ya.lvl === 1) { ya.res[0]++; if (ya.res[0] > 1) { ya.res[0] = 0; ya.lvl = 2; sfx("subeNivel", 0.7); TI.brilla = { id, t: 0.6 }; } }
    else { ya.res[0]++; if (ya.res[0] > 2) { if (ya.res[1] === 1) { ya.res = [0, 0]; ya.lvl = 3; sfx("subeNivel", 0.8); TI.brilla = { id, t: 0.8 }; } else { ya.res[1]++; ya.res[0] = 0; } } }
  } else {
    if (J.plantel.length >= J.maxU) { sfx("no"); avisar((IDIOMA === "es" ? "máximo de héroes " : "maximum number of units ") + `[yellow](${J.maxU})[fg] ` + (IDIOMA === "es" ? "alcanzado" : "reached")); return; }
    J.oro -= h.tier; J.plantel.push({ id, lvl: 1, res: [0, 0] });
  }
  sfx("comprar", 0.6); J.cartas[i] = null; TI.sel = null;
  guardarPartida();
}
function vender(i) {
  const p = J.plantel[i]; if (!p) return;
  J.oro += precioVenta(p); J.plantel.splice(i, 1); sfx("vender", 0.6); TI.sel = null; guardarPartida();
}
function mover(i, d) { const j = i + d; if (j < 0 || j >= J.plantel.length) return; [J.plantel[i], J.plantel[j]] = [J.plantel[j], J.plantel[i]]; TI.sel = { tipo: "heroe", i: j }; sfx("roce", 0.6); guardarPartida(); }
function subirObjeto(i) {
  const o = J.objetos[i]; if (!o || !OBJETOS[o.k].niv || o.lvl >= 3) return;
  if (J.oro < 5) { sfx("no"); avisar(IDIOMA === "es" ? "no te alcanza el oro" : "not enough gold"); return; }
  J.oro -= 5; o.xp++; const max = o.lvl === 1 ? 2 : 3;
  if (o.xp >= max) { o.xp = 0; o.lvl++; sfx("subeNivel", 0.7); } else sfx("comprar", 0.5);
  guardarPartida();
}
function venderObjeto(i) { const o = J.objetos[i]; if (!o) return; J.oro += o.lvl * 3; J.pool.push(o.k); J.objetos.splice(i, 1); sfx("vender", 0.6); TI.sel = null; guardarPartida(); }

function pantallaTienda(dt) {
  TI.t += dt;
  dibujarFondo(TI.t, false);
  if (TI.guia) { guiaTienda(); return; }          // la guía tapa todo: que un toque no compre de rebote
  const ox = Math.max(0, Math.floor((W - 480) / 2)), es = IDIOMA === "es";
  const raton = esRaton();
  let info = null;          // lo que muestra la ficha este cuadro
  // ── la fila de arriba ──
  // la fila de arriba se acomoda al largo del oro ("tienda - oro: 123" es más largo que "shop - gold: 3")
  const tOro = `[fg]${es ? "tienda" : "shop"} - ${es ? "oro" : "gold"}: [yellow]${J.oro}`, bx0 = ox + 14 + Math.max(84, anchoTexto(tOro));
  texto(tOro, ox + 8, 8, { al: "izq" });
  if (boton(bx0, 5, 56, 13, `reroll: [bg]2`, { apagado: J.oro < 2, porQue: es ? "no te alcanza el oro" : "not enough gold" })) { J.oro -= 2; sacarCartas(); sfx("reroll", 0.6); TI.sel = null; guardarPartida(); }
  if (boton(bx0 + 60, 5, 36, 13, J.bloqueo ? (es ? "fijo" : "locked") : (es ? "fijar" : "lock"), { col: J.bloqueo ? "yellow" : null })) { J.bloqueo = !J.bloqueo; }
  const xpMax = TIENDA_XP[J.tiendaNivel];
  if (boton(bx0 + 100, 5, 70, 13, J.tiendaNivel >= 5 ? (es ? "tienda 5" : "shop lv.5") : `${es ? "tienda" : "shop"} ${J.tiendaNivel} +xp`, { apagado: J.tiendaNivel >= 5 || J.oro < 5, porQue: J.tiendaNivel >= 5 ? null : es ? "no te alcanza el oro" : "not enough gold" })) {
    J.oro -= 5; J.tiendaXp++; if (J.tiendaXp >= xpMax) { J.tiendaXp = 0; J.tiendaNivel++; sfx("subeNivel", 0.7); } else sfx("comprar", 0.5); guardarPartida();
  }
  if (encima(bx0 + 100, 5, 70, 13)) { const od = TIENDA_ODDS[J.tiendaNivel]; info = [`[yellow]lv.${J.tiendaNivel}[fg] ${es ? "tienda" : "shop"}${J.tiendaNivel < 5 ? `, xp: [yellow]${J.tiendaXp}/${xpMax}[fg], +1 xp: [yellow]5` : ""}`, `[fg]tier 1: [yellow]${od[0]}%[fg]  tier 2: [yellow]${od[1]}%[fg]  tier 3: [yellow]${od[2]}%[fg]  tier 4: [yellow]${od[3]}%`]; }
  for (let i = 0; i < 6; i++) caja(bx0 + 121 + i * 5, 20, 4, 2, J.tiendaNivel >= 5 || i < J.tiendaXp ? COL.yellow : i < xpMax ? "#4a4a4a" : "#2c2c2c");
  // ── las tres cartas ──
  const cuenta = nivelesDeClase(J.plantel.map((p) => p.id)).cuenta;
  for (let i = 0; i < 3; i++) {
    const id = J.cartas[i], x = ox + 8 + i * 86, y = 26, w = 80, h = 74;
    if (!id) { marco(x, y, w, h, "#333333", 4); continue; }
    const hh = HEROES[id], sel = TI.sel && TI.sel.tipo === "carta" && TI.sel.i === i, sobre = encima(x, y, w, h);
    if (sel || (raton && sobre)) { cajaRed(x, y, w, h, "#3a3a3a", 4); marco(x, y, w, h, sel ? COL.fg : rampa("bg", 8), 4); }
    const s = Math.sin(TI.t * 3 + i) * (sel ? 1 : 0);
    cajaRed(x + w / 2 - 6, y + 4 + s, 12, 12, COL[hh.col], 3); numeroEnCaja(hh.tier, x + w / 2 - 6, y + 4 + s, 12, 12);
    texto(`[${hh.col}]${hh.n.toLowerCase()}`, x + w / 2, y + 21, {});
    const n = hh.clases.length, tw = n * 16 - 4;
    hh.clases.forEach((c, k) => baldosaClase(Math.round(x + w / 2 - tw / 2 + k * 16), y + 33, c, cuenta[c] + (J.plantel.some((p) => p.id === id) ? 0 : 1) * 0, cuenta[c] >= CLASES[c].sets[0]));
    if (sel) texto(es ? "[yellow]¡comprar!" : "[yellow]tap to buy", x + w / 2, y + h - 9, {});
    if (sel || (raton && sobre)) { const tx = textoHeroe(id, J.plantel.find((p) => p.id === id)?.lvl || 1); info = [tx.titulo + `[fg] - ${es ? "cuesta" : "costs"} [yellow]${hh.tier}`, tx.clases, tx.desc, tx.ef]; }
    if (tocado(x, y, w, h)) { if (raton || sel) comprar(i); else { TI.sel = { tipo: "carta", i }; sfx("roce", 0.6); } }
  }
  // ── los objetos ──
  texto(es ? "objetos" : "items", ox + 8, 106, { al: "izq" });
  J.objetos.forEach((o, i) => {
    const x = ox + 8 + i * 28, y = 118, sel = TI.sel && TI.sel.tipo === "objeto" && TI.sel.i === i, sobre = encima(x, y, 24, 24);
    if (sel || (raton && sobre)) cajaRed(x - 2, y - 2, 28, 28, "#3a3a3a", 4);
    g.drawImage(runa(o.k, 22, COL.fg), x + 1, y + 1);
    for (let k = 0; k < (OBJETOS[o.k].niv ? 3 : 0); k++) caja(x + 5 + k * 5, y + 24, 4, 2, k < o.lvl ? COL.yellow : "#4a4a4a");
    if (sel || (raton && sobre)) { const tx = textoObjeto(o); info = [tx.titulo, tx.desc]; }
    if (tocado(x, y, 24, 26)) { TI.sel = sel ? null : { tipo: "objeto", i }; sfx("roce", 0.6); }
  });
  if (!J.objetos.length) texto(es ? "[bg10]cada 3 niveles elegís uno" : "[bg10]choose one every 3 levels", ox + 8, 122, { al: "izq" });
  // ── las clases del grupo ──
  texto(es ? "clases" : "classes", ox + 306, 8, {});
  const presentes = Object.keys(CLASES).filter((k) => cuenta[k] > 0);
  presentes.forEach((k, i) => {
    const x = ox + 272 + (i % 4) * 17, y = 22 + Math.floor(i / 4) * 32, act = cuenta[k] >= CLASES[k].sets[0];
    baldosaClase(x, y, k, cuenta[k], act);
    if ((raton && encima(x, y, 14, 30)) || (TI.sel && TI.sel.tipo === "clase" && TI.sel.k === k)) { const tx = textoClase(k, cuenta[k]); info = [tx.titulo, tx.desc]; }
    if (tocado(x, y, 14, 30)) { TI.sel = { tipo: "clase", k }; sfx("roce", 0.6); }
  });
  // ── el grupo (la víbora, en orden) ──
  texto(`${es ? "grupo" : "party"} ${J.plantel.length}/${J.maxU}`, ox + 412, 8, {});
  J.plantel.forEach((p, i) => {
    const x = ox + 350, y = 22 + i * 15, sel = TI.sel && TI.sel.tipo === "heroe" && TI.sel.i === i, sobre = encima(x, y, 124, 13);
    if (sel || (raton && sobre)) cajaRed(x - 2, y - 1, 126, 14, "#3a3a3a", 3);
    const br = TI.brilla && TI.brilla.id === p.id && TI.brilla.t > 0;
    cuadroHeroe(x, y, p.id, p.lvl);
    if (br) marco(x - 2, y - 2, 15, 15, COL.fg, 4);
    texto(`[${HEROES[p.id].col}]${HEROES[p.id].n.toLowerCase()}`, x + 15, y + 2, { al: "izq" });
    // las copias de reserva, como puntitos (dos filas: nivel 1 y grupos de nivel 2)
    for (let k = 0; k < p.res[0]; k++) caja(x + 114 - k * 4, y + 2, 3, 3, COL[HEROES[p.id].col]);
    for (let k = 0; k < p.res[1]; k++) caja(x + 114 - k * 4, y + 7, 3, 3, COL.fg);
    if (sel || (raton && sobre)) { const tx = textoHeroe(p.id, p.lvl); info = [tx.titulo + `[fg] - ${es ? "se vende a" : "sells for"} [yellow]${precioVenta(p)}`, tx.clases, tx.stats, tx.desc, tx.ef]; }
    if (tocado(x, y, 124, 13)) { TI.sel = sel ? null : { tipo: "heroe", i }; sfx("roce", 0.6); }
  });
  if (TI.brilla) TI.brilla.t -= dt;
  // ── acciones del seleccionado ──
  const bx = ox + 8, by = H - 22;
  if (TI.sel && TI.sel.tipo === "heroe" && J.plantel[TI.sel.i]) {
    const i = TI.sel.i;
    if (boton(bx, by, 70, 15, `${es ? "vender" : "sell"} +${precioVenta(J.plantel[i])}`, { col: "red" })) vender(i);
    else if (boton(bx + 74, by, 30, 15, es ? "sube" : "up", { apagado: i === 0 })) mover(i, -1);
    else if (boton(bx + 108, by, 34, 15, es ? "baja" : "down", { apagado: i === J.plantel.length - 1 })) mover(i, 1);
  } else if (TI.sel && TI.sel.tipo === "objeto" && J.objetos[TI.sel.i]) {
    const i = TI.sel.i, o = J.objetos[i], puede = OBJETOS[o.k].niv && o.lvl < 3;
    if (boton(bx, by, 70, 15, "+1 xp: 5", { apagado: !puede || J.oro < 5, porQue: puede ? (es ? "no te alcanza el oro" : "not enough gold") : (es ? "no se sube de nivel" : "can't be leveled") })) subirObjeto(i);
    else if (boton(bx + 74, by, 70, 15, `${es ? "vender" : "sell"} +${o.lvl * 3}`, { col: "red" })) venderObjeto(i);
  }
  // ── la ficha ──
  if (info) fichaInfo(ox + 8, 146, 336, info);
  // ── el nivel que viene y el botón de ir ──
  const jefe = JEFES[J.nivel];
  texto(`[fg]${es ? "nivel" : "level"} [yellow]${J.nivel}[fg]/25${jefe ? (es ? " - [red]jefe" : " - [red]boss") : ""}${J.ng ? `  [fg]ng+${J.ng}` : ""}`, ox + 412, H - 44, {});
  if (boton(ox + 362, H - 30, 100, 20, es ? "¡a pelear!" : "go!", { col: J.plantel.length ? "green" : null, apagado: !J.plantel.length, porQue: es ? "comprá al menos un héroe" : "hire at least one hero", ola: J.plantel.length ? 1 : 0 })) {
    guardarPartida(); empezarNivel(); irA("arena");
  }
  if (boton(W - 18, 5, 13, 13, "?", {})) TI.guia = true;
  if (boton(4, 5, 13, 13, "<", {})) irA("titulo");
}
/** La guía (la del original, primera vez en la tienda). */
function guiaTienda() {
  g.fillStyle = "rgba(20,20,20,0.9)"; g.fillRect(0, 0, W, H);
  const es = IDIOMA === "es", x = W / 2;
  const L2 = es ? [
    "[fg]Manejás una víbora de héroes que atacan solos a los enemigos cerca.",
    "[fg]Doblás tocando la [yellow]mitad izquierda[fg] o la [yellow]derecha[fg] de la pantalla ([yellow]A/D[fg] o flechas en la PC).",
    "[fg]Juntá copias del mismo héroe para subirlo: [yellow]3 = nivel 2[fg], [yellow]9 = nivel 3[fg].",
    "[fg]Al [yellow]nivel 3[fg] cada héroe destraba un efecto especial.",
    "[fg]Contratá héroes de la misma clase para destrabar sus bonos. Cada héroe tiene de [yellow]1 a 3[fg] clases.",
    "[fg]Ganás [yellow]1 de interés cada 5 de oro[fg], hasta 5: guardar más de [yellow]25[fg] no da más interés.",
    "[yellow]¡Suerte!",
  ] : [
    "[fg]You control a snake of multiple heroes that auto-attack nearby enemies.",
    "[fg]Steer by holding the [yellow]left half[fg] or the [yellow]right half[fg] of the screen ([yellow]A/D[fg] or arrows on PC).",
    "[fg]Combine the same heroes to level them up: [yellow]3 = Lv.2[fg], [yellow]9 = Lv.3[fg].",
    "[fg]At [yellow]Lv.3[fg] heroes unlock special effects.",
    "[fg]Hire heroes of the same classes to unlock class passives. Each hero can have between [yellow]1 to 3[fg] classes.",
    "[fg]You gain [yellow]1 interest per 5 gold[fg], up to a maximum of 5. Saving above [yellow]25 gold[fg] doesn't yield more interest.",
    "[yellow]Good luck!",
  ];
  texto(es ? "guía" : "guide", x, 16, { esc: 2, ola: 1 });
  let y = 44;
  for (const l of L2) { const rs = renglones(l, Math.min(W - 40, 420)); rs.forEach((r) => { texto(r, x, y); y += 11; }); y += 5; }
  if (boton(x - 40, H - 28, 80, 18, es ? "entendido" : "got it", { col: "green" }) || recien("ok") || recien("atras")) { TI.guia = false; G.vistoGuia = true; guardar(); }
  IN.toques.length = 0;
}
