// ─────────────────────────────────────────────────────────────────────────────
// EL HUD: arriba a la izquierda el objeto activo (con su carga) y los corazones; abajo, las
// monedas, bombas y llaves, la cápsula y las cuentas (como en Repentance); arriba a la derecha
// el minimapa; la barra del jefe abajo; los rótulos de objeto y de piso; y, en el teléfono,
// los joysticks flotantes y los botones (bomba, activo, cápsula, pausa).
// En el TCL 20 SE todo cae en los costados que sobran; en pantallas más angostas, sobre el muro.
// ─────────────────────────────────────────────────────────────────────────────

// íconos chicos del HUD (7×7), pintados con la misma luz que el resto
function iconoHud(que) {
  return hornear(`hud${que}`, () => {
    const p = new Pix(9, 9);
    const S = {
      moneda: [[".ooo.", "oOOoo", "oOooo", "ooooo", ".ooo."], { o: PAL.oro[3], O: PAL.oro[4] }],
      bomba: [["..f..", ".kkk.", "kkKkk", "kkkkk", ".kkk."], { k: "#2e2d3a", K: "#7f7ea0", f: PAL.fuego[3] }],
      llave: [[".hh..", "h..h.", ".hh..", ".h...", ".hh..", ".h..."], { h: PAL.hueso[3] }],
      vel: [["..bb.", "..bb.", ".bbb.", "bbbbb"], { b: PAL.tierra[4] }],
      lag: [["..e..", ".eee.", "eeEee", "eeeee", ".eee."], { e: PAL.espora[2], E: PAL.espora[4] }],
      dano: [["..s..", ".sss.", "sssSs", "sssss", ".sss."], { s: PAL.sangre[3], S: PAL.sangre[4] }],
      alc: [["...a.", "aaaaa", "...a."], { a: PAL.hueso[3] }],
      tiro: [["a....", ".a.a.", "..aa.", ".aaa."], { a: PAL.hielo[3] }],
      suerte: [["g.g..", "ggg..", ".gg..", "..g.."], { g: PAL.musgo[4] }],
      calavera: [[".hhh.", "hkhkh", "hhhhh", ".h.h."], { h: PAL.hueso[4], k: PAL.tinta }],
      corona: [["o.o.o", "ooooo", "ooooo"], { o: PAL.oro[3] }],
      tienda: [[".ooo.", "o.o.o", ".ooo.", "o.o.o", ".ooo."], { o: PAL.oro[4] }],
      secreta: [[".ss.", "s..s", "..s.", ".s..", "....", ".s.."], { s: "#b8b0c8" }],
      pacto: [["r...r", ".rrr.", "rrrrr", ".r.r."], { r: PAL.sangre[3] }],
      inicio: [[".", "."], {}],
    }[que];
    const [f, pal] = S, x0 = Math.floor((9 - f[0].length) / 2), y0 = Math.floor((9 - f.length) / 2);
    p.sello(x0, y0, f, pal);
    p.contorno(PAL.tinta);
    return p.canvas();
  });
}
function monedaChica() { return iconoHud("moneda"); }
const dos = (n) => String(Math.max(0, Math.min(99, n | 0))).padStart(2, "0");

/** Un aro de píxeles (la base de los joysticks y los botones). */
function aro(r, relleno, borde) {
  return hornear(`aro${r}${relleno}${borde}`, () => {
    const s = r * 2 + 3, p = new Pix(s, s), c = s / 2;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d <= r + 0.5 && d > r - 1) p.p(x, y, borde); else if (d <= r - 1 && relleno) p.p(x, y, relleno);
    }
    return p.canvas();
  });
}

function dibujarHud(g) {
  const j = J.jug, W = PANT.W, H = PANT.H;
  // ── el activo y los corazones ──
  let hx = 4;
  if (j.activo) {
    const a = j.activo, ic = iconoSpr(a.id), lleno = a.carga >= a.max;
    g.drawImage(aro(11, "rgba(8,6,10,0.55)", "rgba(200,190,170,0.35)"), 2, 2);
    g.drawImage(lleno && (J.t >> 4) & 1 ? blanco(ic) : ic, 5, 5);
    // la barra de carga, con una rayita por carga
    const bh = 20, bx = 28, by = 4;
    g.fillStyle = PAL.tinta; g.fillRect(bx, by, 5, bh + 2);
    const alto = Math.round(bh * a.carga / a.max);
    g.fillStyle = lleno ? "#f2d64a" : "#c9a23a"; g.fillRect(bx + 1, by + 1 + bh - alto, 3, alto);
    g.fillStyle = PAL.tinta; for (let i = 1; i < a.max; i++) g.fillRect(bx + 1, by + 1 + Math.round(bh * i / a.max), 3, 1);
    hx = 36;
  }
  const lista = [];
  for (let i = 0; i < j.cont; i += 2) lista.push(j.vida >= i + 2 ? "rojo" : j.vida === i + 1 ? "medio" : "vacio");
  for (let i = 0; i < j.esporas; i += 2) { const t = j.almas[i] === "n" ? "negro" : "espora"; lista.push(j.esporas >= i + 2 ? t : t + "Medio"); }
  const late = vidaTotal(j) <= 2 && !j.muerto && ((J.t >> 4) & 1);
  if (J.maldicion === "desconocido") {   // no se ve la vida: un corazón vacío con un signo
    g.drawImage(corazonHudSpr("vacio"), hx, 3); g.drawImage(subtituloSpr("?"), hx + 14, 3);
  } else lista.forEach((t, i) => {
    const s = corazonHudSpr(t);
    g.drawImage(late && i === 0 ? blanco(s) : s, hx + (i % 6) * 12, 3 + Math.floor(i / 6) * 11);
  });
  // ── los contadores: el ícono y las cifras gordas (medido: 9 px de alto, filas cada 14) ──
  let y = j.activo || lista.length > 6 ? 29 : 22;
  for (const [ic, n] of [["moneda", j.monedas], ["bomba", j.bombas], ["llave", j.llaves]]) {
    g.drawImage(iconoHud(ic), 2, y); g.drawImage(cifrasSpr(dos(n)), 11, y - 1);
    y += 12;
  }
  // ── las cuentas: ícono y cifras finas al 60 %, una fila cada 12 (medido: 13,4 en el original);
  //    la última, la chance de que aparezca el pacto (como la del diablo en Repentance) ──
  {   // como en Repentance: encima de la pared de la izquierda, semitransparentes
    y += 6;
    const cuentas = [["vel", velDe(j).toFixed(2)], ["lag", lagrimasPorSeg(j).toFixed(2)], ["dano", danoDe(j).toFixed(2)], ["alc", j.alcance.toFixed(2)], ["tiro", j.velLag.toFixed(2)], ["suerte", j.suerte.toFixed(2)], ["pacto", (probPacto() * 100).toFixed(1) + "%"]];
    for (const [ic, v] of cuentas) {
      g.globalAlpha = 0.6;
      g.drawImage(iconoHud(ic), 2, y - 2); g.drawImage(finasSpr(v), 12, y - 1);
      // el cambio reciente, en verde o en rojo, que se apaga solo
      const c = J.cambios && J.cambios[ic];
      if (c && c.t > 0) { g.globalAlpha = Math.min(1, c.t / 30); g.drawImage(finasSpr((c.d > 0 ? "+" : "") + c.d.toFixed(2), c.d > 0 ? "#7fe05a" : "#f0553d"), 38, y - 1); c.t--; }
      g.globalAlpha = 1;
      y += 12;
    }
  }
  // ── la cápsula: abajo a la derecha, con su nombre (como la carta/píldora del original) ──
  if (j.capsula != null && !IN.usaTactil) {
    const s = capsulaSpr(j.capsula), n = textoSpr(tr(nombreCapsula(j.capsula)), { grad: "blanco" });
    g.drawImage(s, W - s.width - 4, H - s.height - 5);
    g.drawImage(n, W - s.width - 8 - n.width, H - n.height - 2);
  }
  // ── la baratija: abajo a la izquierda (como en Repentance) ──
  if (j.baratija) { const b = baratijaSpr(j.baratija); g.drawImage(b, 4, H - b.height - 4); }
  if (J.maldicion !== "extraviado") dibujarMinimapa(g);
  // ── la barra del jefe (medida: 121×8 en el original, acá 108×7): roja plana, marco oscuro
  //    redondeado y la calavera grande pisando la punta izquierda ──
  const vivos = J.jefes.filter((e) => !e.muerto);
  if (vivos.length && J.estado !== "vs") {
    const tot = vivos.reduce((s, e) => s + Math.max(0, e.vida), 0), max = J.jefes.reduce((s, e) => s + e.max, 0);
    const bw = 108, bx = Math.round(W / 2 - bw / 2) + 6, by = PANT.salaY + SALA_H - 13;
    g.drawImage(barraJefeSpr(bw), bx - 2, by - 2);
    g.fillStyle = "#d40000"; g.fillRect(bx - 1, by - 1, Math.round((bw + 2) * tot / max), 5);
    const cal = calaveraJefeSpr(); g.drawImage(cal, bx - 13, by - 7);
  }
  dibujarRotulos(g);
  if (IN.usaTactil) dibujarControles(g);
}

function dibujarMinimapa(g) {
  const W = PANT.W, cw = 9, ch = 8;
  let c0 = 99, c1 = -1, f0 = 99, f1 = -1;
  const salas = [...J.piso.salas.values()].filter((s) => s.vista && (s.tipo !== "secreta" || s.visitada || algunaRevelada(s)));
  for (const s of salas) { c0 = Math.min(c0, s.c); c1 = Math.max(c1, s.c); f0 = Math.min(f0, s.f); f1 = Math.max(f1, s.f); }
  if (c1 < 0) return;
  const w = (c1 - c0 + 1) * cw + 1, h = (f1 - f0 + 1) * ch + 1, x0 = W - w - 6, y0 = 24;
  g.drawImage(marcoMapaSpr(w + 8, h + 8), x0 - 4, y0 - 4);
  for (const s of salas) {
    const x = x0 + (s.c - c0) * cw, y = y0 + (s.f - f0) * ch, actual = s === J.sala || (J.sala.tipo === "pacto" && s === J.piso.jefe);
    g.drawImage(celdaMapaSpr(actual ? 2 : s.visitada ? 1 : 0), x, y);
    const ic = { jefe: "calavera", tesoro: "corona", tienda: "tienda", secreta: "secreta" }[s.tipo];
    if (ic && (s.visitada || s.tipo !== "secreta")) g.drawImage(iconoHud(ic), x, y - 1);
  }
}
/** La celda del minimapa: un cuadradito redondeado (0 vista, 1 visitada, 2 donde estás). */
function celdaMapaSpr(k) {
  return hornear(`celdaMapa${k}`, () => {
    const p = new Pix(10, 9), c = [["#3c3a3a", "#2a2828"], ["#a19b92", "#7d776f"], ["#ffffff", "#d8d2c8"]][k];
    p.rect(1, 1, 8, 7, c[0]); p.rect(1, 6, 8, 1, c[1]);
    p.borrar(1, 1); p.borrar(8, 1); p.borrar(1, 7); p.borrar(8, 7);
    p.contorno(PAL.tinta);
    return p.canvas();
  });
}
function marcoMapaSpr(w, h) {
  return hornear(`marcoMapa${w}x${h}`, () => {
    const p = new Pix(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bx = Math.min(x, w - 1 - x), by = Math.min(y, h - 1 - y);
      if (bx + by < 3) continue;          // las esquinas, redondeadas
      p.p(x, y, bx < 1 || by < 1 ? "rgba(0,0,0,0.75)" : "rgba(8,6,10,0.5)");
    }
    return p.canvas();
  });
}
function barraJefeSpr(bw) {
  return hornear(`barraJefe2|${bw}`, () => {
    const p = new Pix(bw + 4, 7);
    for (let y = 0; y < 7; y++) for (let x = 0; x < bw + 4; x++) {
      const bx = Math.min(x, bw + 3 - x), by = Math.min(y, 6 - y);
      if (bx + by < 2) continue;                              // las puntas redondeadas
      p.p(x, y, bx < 1 || by < 1 ? "#140404" : "#3a0606");    // el marco y el fondo vacío
    }
    return p.canvas();
  });
}
// ── los rótulos: el nombre del objeto (y su lema) o del piso, que entra, se queda y se va ──
function rotulo(titulo, sub, maldicion = null) {
  J.rotulos = J.rotulos.filter((r) => r.titulo !== titulo);
  J.rotulos.push({ titulo, sub, maldicion, t: 0 });
  if (J.rotulos.length > 2) J.rotulos.shift();
}
// Los tiempos del rótulo, medidos en el video (a 30 fps; acá, al doble): la franja crece desde la
// izquierda en 6 cuadros; el texto entra volando, se pasa 11 px y vuelve en otros 6; queda quieto
// 1,76 s; toma envión 19 px a la izquierda en 8 cuadros y sale disparado a la derecha en 3; la
// franja se encoge hacia la derecha.
const ROT = { crece: 6, llega: 8, asienta: 14, quieto: 120, envion: 128, fuga: 131, fin: 140 };
function posRotulo(t, W) {
  const ease = (u) => 1 - Math.pow(1 - lim(u, 0, 1), 3);
  if (t < 3) return -W;
  if (t < ROT.llega) return lerp(-W * 0.55, 11, ease((t - 3) / (ROT.llega - 3)));
  if (t < ROT.asienta) return lerp(11, 0, ease((t - ROT.llega) / (ROT.asienta - ROT.llega)));
  if (t < ROT.quieto) return 0;
  if (t < ROT.envion) { const u = (t - ROT.quieto) / (ROT.envion - ROT.quieto); return -19 * (u * u * (3 - 2 * u)); }
  if (t < ROT.fuga) return lerp(-19, W, Math.pow((t - ROT.envion) / (ROT.fuga - ROT.envion), 2));
  return W;
}
function dibujarRotulos(g) {
  const W = PANT.W;
  for (let i = J.rotulos.length - 1; i >= 0; i--) { if (++J.rotulos[i].t > ROT.fin) J.rotulos.splice(i, 1); }
  const r = J.rotulos[J.rotulos.length - 1];
  if (!r) return;
  const t = r.t;
  // se traduce al dibujar: si se cambia el idioma, cambia hasta el cartel que está en pantalla
  const s1 = rotuloSpr(tr(r.titulo)), s2 = r.sub ? subtituloSpr(comoFrase(tr(r.sub))) : null, per = r.maldicion ? pergaminoSpr(tr(r.maldicion)) : null;
  const bw = Math.round(Math.min(W - 100, Math.max(s1.width + 120, 330))), banda = bandaSpr(bw), m = 8;   // 83 % en el original
  const y = PANT.salaY + 22, bx = Math.round(W / 2 - bw / 2);
  // la franja: crece desde la izquierda y, al irse, se come desde la izquierda hacia la derecha
  const u0 = t >= ROT.envion + 2 ? lim((t - ROT.envion - 2) / (ROT.fin - ROT.envion - 2), 0, 1) : 0;
  const u1 = lim(t / ROT.crece, 0, 1);
  const x0 = Math.round(banda.width * u0 * u0), x1 = Math.round(banda.width * (1 - Math.pow(1 - u1, 2)));
  if (x1 > x0) g.drawImage(banda, x0, 0, x1 - x0, banda.height, bx - m + x0, y - m, x1 - x0, banda.height);
  const dx = Math.round(posRotulo(t, W));
  // el texto va en la parte de abajo de la franja (medido: 15 px arriba, 6 abajo)
  // medido: el título casi centrado en la mancha (8 px arriba, 5–7 abajo; acá 7 y 4), el subtítulo
  // 7 px más abajo que el título (acá 6–7) y la etiqueta de la maldición 11 px más abajo (acá 10)
  g.drawImage(s1, Math.round(W / 2 - s1.width / 2) + dx, y + 2);
  if (s2) g.drawImage(s2, Math.round(W / 2 - s2.width / 2) + dx, y + 21);
  if (per) g.drawImage(per, Math.round(W / 2 - per.width / 2) + dx, y + 24);
}

// ── los controles táctiles ──
function ubicarBotones() {
  const W = PANT.W, H = PANT.H, j = J && J.jug;
  const b = [{ id: "pausa", x: W - 11, y: 11, r: 8 }];
  if (enJuego()) {
    b.push({ id: "bomba", x: W - 24, y: H - 24, r: 14 });
    if (j && j.activo) b.push({ id: "activo", x: W - 24, y: H - 60, r: 12 });
    if (j && j.capsula != null) b.push({ id: "capsula", x: W - 58, y: H - 20, r: 10 });
  }
  for (const n of b) { const v = BOTONES.find((o) => o.id === n.id); if (v) n.apretado = v.apretado; }
  BOTONES = b;
}
function dibujarControles(g) {
  const j = J.jug;
  for (const b of BOTONES) {
    const ap = b.apretado > 0;
    if (ap) b.apretado--;
    if (b.id === "pausa") {
      g.drawImage(aro(b.r, "rgba(8,6,10,0.5)", "rgba(220,210,190,0.5)"), b.x - b.r - 1, b.y - b.r - 1);
      g.fillStyle = "rgba(230,222,205,0.85)"; g.fillRect(b.x - 3, b.y - 3, 2, 7); g.fillRect(b.x + 1, b.y - 3, 2, 7);
      continue;
    }
    g.drawImage(aro(b.r, ap ? "rgba(60,50,40,0.6)" : "rgba(8,6,10,0.45)", "rgba(220,210,190,0.45)"), b.x - b.r - 1, b.y - b.r - 1);
    let s = null, n = null;
    if (b.id === "bomba") { s = bombaSpr(1); n = j.bombas; }
    if (b.id === "activo" && j.activo) s = iconoSpr(j.activo.id);
    if (b.id === "capsula" && j.capsula != null) s = capsulaSpr(j.capsula);
    if (s) { g.globalAlpha = b.id === "bomba" && !j.bombas ? 0.35 : b.id === "activo" && j.activo.carga < j.activo.max ? 0.55 : 0.95; g.drawImage(s, Math.round(b.x - s.width / 2), Math.round(b.y - s.height / 2) + (ap ? 1 : 0)); g.globalAlpha = 1; }
    if (n != null) g.drawImage(cifrasSpr(dos(n)), b.x + 3, b.y + 5);
  }
  for (const [st, col] of [[STICKS.mover, "rgba(220,210,190,0.35)"], [STICKS.tirar, "rgba(160,230,215,0.4)"]]) {
    if (!st) continue;
    g.drawImage(aro(RADIO_STICK, "rgba(8,6,10,0.25)", col), Math.round(st.x0 - RADIO_STICK - 1), Math.round(st.y0 - RADIO_STICK - 1));
    const vx = st.x - st.x0, vy = st.y - st.y0, l = Math.hypot(vx, vy), m = Math.min(l, RADIO_STICK);
    const kx = st.x0 + (l ? vx / l * m : 0), ky = st.y0 + (l ? vy / l * m : 0);
    g.drawImage(aro(9, "rgba(230,222,205,0.35)", "rgba(240,235,225,0.6)"), Math.round(kx - 10), Math.round(ky - 10));
  }
}
