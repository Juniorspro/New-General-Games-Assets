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
  for (let i = 0; i < j.esporas; i += 2) lista.push(j.esporas >= i + 2 ? "espora" : "esporaMedio");
  const late = vidaTotal(j) <= 2 && !j.muerto && ((J.t >> 4) & 1);
  lista.forEach((t, i) => {
    const s = corazonSpr(t);
    g.drawImage(late && i === 0 ? blanco(s) : s, hx + (i % 6) * 10, 3 + Math.floor(i / 6) * 9);
  });
  // ── los contadores: el ícono y las cifras gordas ──
  let y = j.activo || lista.length > 6 ? 27 : 21;
  for (const [ic, n] of [["moneda", j.monedas], ["bomba", j.bombas], ["llave", j.llaves]]) {
    g.drawImage(iconoHud(ic), 2, y); g.drawImage(cifrasSpr(dos(n)), 11, y);
    y += 10;
  }
  // ── las cuentas (como en Repentance: ícono y número; sólo si hay lugar al costado) ──
  if (PANT.salaX >= 56) {
    y += 5;
    const cuentas = [["vel", velDe(j)], ["lag", lagrimasPorSeg(j)], ["dano", danoDe(j)], ["alc", j.alcance], ["tiro", j.velLag], ["suerte", j.suerte]];
    for (const [ic, v] of cuentas) {
      g.globalAlpha = 0.9;
      g.drawImage(iconoHud(ic), 2, y); g.drawImage(cifrasSpr(v.toFixed(2)), 11, y);
      // el cambio reciente, en verde o en rojo, que se apaga solo
      const c = J.cambios && J.cambios[ic];
      if (c && c.t > 0) { g.globalAlpha = Math.min(1, c.t / 30); g.drawImage(cifrasSpr((c.d > 0 ? "+" : "") + c.d.toFixed(2), c.d > 0 ? "verde" : "rojo"), 44, y); c.t--; }
      g.globalAlpha = 1;
      y += 10;
    }
  }
  // ── la cápsula: abajo a la derecha, con su nombre (como la carta/píldora del original) ──
  if (j.capsula != null && !IN.usaTactil) {
    const s = capsulaSpr(j.capsula), n = textoSpr(nombreCapsula(j.capsula), { grad: "blanco" });
    g.drawImage(s, W - s.width - 4, H - s.height - 5);
    g.drawImage(n, W - s.width - 8 - n.width, H - n.height - 2);
  }
  dibujarMinimapa(g);
  // ── la barra del jefe: marco oscuro redondeado, rojo con brillo arriba, la calavera a la izquierda ──
  const vivos = J.jefes.filter((e) => !e.muerto);
  if (vivos.length && J.estado !== "vs") {
    const tot = vivos.reduce((s, e) => s + Math.max(0, e.vida), 0), max = J.jefes.reduce((s, e) => s + e.max, 0);
    const bw = 104, bx = Math.round(W / 2 - bw / 2) + 6, by = PANT.salaY + SALA_H - 14;
    g.drawImage(barraJefeSpr(bw), bx - 3, by - 3);
    const w = Math.round((bw - 2) * tot / max);
    g.fillStyle = "#8e1a19"; g.fillRect(bx + 1, by + 1, w, 5);
    g.fillStyle = "#d8352b"; g.fillRect(bx + 1, by + 1, w, 3);
    g.fillStyle = "#ff7a5e"; g.fillRect(bx + 1, by + 1, w, 1);
    g.drawImage(iconoHud("calavera"), bx - 14, by - 2);
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
  return hornear(`barraJefe${bw}`, () => {
    const p = new Pix(bw + 6, 13);
    for (let y = 0; y < 13; y++) for (let x = 0; x < bw + 6; x++) {
      const bx = Math.min(x, bw + 5 - x), by = Math.min(y, 12 - y);
      if (bx + by < 2) continue;
      p.p(x, y, bx < 2 || by < 2 ? "#0c0708" : "#2a0b0e");
    }
    return p.canvas();
  });
}
function algunaRevelada(s) { return s.puertas.some((p) => p && p.revelada); }

// ── los rótulos: el nombre del objeto (y su lema) o del piso, que entra, se queda y se va ──
function rotulo(titulo, sub, grad = "blanco") {
  J.rotulos = J.rotulos.filter((r) => r.titulo !== titulo);
  J.rotulos.push({ titulo, sub, grad, t: 0 });
  if (J.rotulos.length > 2) J.rotulos.shift();
}
function dibujarRotulos(g) {
  const W = PANT.W;
  for (let i = J.rotulos.length - 1; i >= 0; i--) { if (++J.rotulos[i].t > 170) J.rotulos.splice(i, 1); }
  const r = J.rotulos[J.rotulos.length - 1];
  if (!r) return;
  // la franja entra de un costado, la letra de bloque aparece encima; al final, todo se va
  const t = r.t, entra = 1 - Math.pow(1 - Math.min(1, t / 9), 3), sale = t > 150 ? Math.pow((t - 150) / 20, 2) : 0;
  const s1 = rotuloSpr(r.titulo), s2 = r.sub ? subtituloSpr(comoFrase(r.sub)) : null;
  const bw = Math.min(W, Math.max(s1.width + 150, Math.round(W * 0.72))), banda = bandaSpr(bw);
  const y = PANT.salaY + 30;
  // entra desde la izquierda y se va por la derecha (rápido), el texto viaja con la franja
  const dx = Math.round((1 - entra) * -W + sale * W);
  const bx = Math.round(W / 2 - bw / 2) + dx;
  g.drawImage(banda, bx, y);
  g.drawImage(s1, Math.round(W / 2 - s1.width / 2) + dx, y + Math.round(12 - s1.height / 2) + 1);
  if (s2) g.drawImage(s2, Math.round(W / 2 - s2.width / 2) + dx, y + 20);
  g.globalAlpha = 1;
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
