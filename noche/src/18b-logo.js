// ─────────────────────────────────────────────────────────────────────────────
// EL LOGO. Como el de Shumio (letras de bloque dibujadas a mano, con relieve hondo y sangre), pero en
// clave del género: góticas, con puntas en los palos y pies ensanchados, cara de hueso a sangre, un
// murciélago de escudo arriba y "CARMESÍ" chorreando. Las dos palabras forman un bloque parejo:
// "NOCHE" (más corta) va entre dos filetes con rombos. Se hornea una vez; al dibujarlo, un brillo
// lo recorre de vez en cuando y un resplandor rojo late detrás.
// ─────────────────────────────────────────────────────────────────────────────

// letras de 15 filas: palos de 3, puntas arriba, pies ensanchados (lo gótico, a escala de píxel)
const LETRAS_LOGO = {
  N: [".#.......#.", "###.....###", "####....###", "#####...###", "###.##..###", "###..##.###", "###...#####", "###....####", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "####...####"],
  O: ["...#####...", ".#########.", "####...####", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "####...####", ".#########.", "...#####..."],
  C: ["...#######", ".#########", "####....##", "###......#", "###.......", "###.......", "###.......", "###.......", "###.......", "###.......", "###.......", "###......#", "####....##", ".#########", "...#######"],
  H: [".#.......#.", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "###########", "###########", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "####...####"],
  E: ["##########", "##########", "###.....##", "###......#", "###.......", "###..#....", "#######...", "#######...", "###..#....", "###.......", "###.......", "###......#", "###.....##", "##########", "##########"],
  A: ["....###....", "...#####...", "..###.###..", ".###...###.", "###.....###", "###.....###", "###.....###", "###########", "###########", "###.....###", "###.....###", "###.....###", "###.....###", "###.....###", "####...####"],
  R: ["########...", "##########.", "###....####", "###.....###", "###.....###", "###....####", "##########.", "#########..", "###..###...", "###...###..", "###....###.", "###....###.", "###.....###", "###.....###", "####....###"],
  M: [".#.........#.", "###.......###", "####.....####", "#####...#####", "###.##.##.###", "###..###..###", "###...#...###", "###.......###", "###.......###", "###.......###", "###.......###", "###.......###", "###.......###", "###.......###", "####.....####"],
  S: ["..########", ".#########", "####....##", "###......#", "###.......", "####......", ".#######..", "..#######.", "......####", ".......###", ".......###", "#......###", "##....####", "#########.", "########.."],
  I: ["#####", "#####", ".###.", ".###.", ".###.", ".###.", ".###.", ".###.", ".###.", ".###.", ".###.", ".###.", ".###.", "#####", "#####"],
};
const TILDE_LOGO = ["..###", ".###.", "###.."];
const CARA_LOGO = ["#ffffff", "#ffeadc", "#ff9e8a", "#ee4436", "#b8161e", "#7a0c14"];

function logoSpr() {
  return hornear("logo-noche", () => {
    const E = 2, GAP = 1, MX = 8, ALTO = 15 * E;
    const base = (ch) => (ch === "Í" ? "I" : ch);
    const anchoPal = (s) => { let w = 0; for (const ch of s) w += LETRAS_LOGO[base(ch)][0].length + GAP; return (w - GAP) * E; };
    const w1 = anchoPal("NOCHE"), w2 = anchoPal("CARMESÍ");
    const WL = Math.max(w1, w2) + MX * 2 + 6, y1 = 20, y2 = y1 + ALTO + 12, HL = y2 + ALTO + 22;
    const x1 = Math.round((WL - w1) / 2), x2 = Math.round((WL - w2) / 2);
    const masc = new Uint8Array(WL * HL), p = new Pix(WL, HL), r = mulberry(1313);
    const en = (x, y) => x >= 0 && y >= 0 && x < WL && y < HL && masc[y * WL + x];
    const marcar = (x, y, id) => { if (x >= 0 && y >= 0 && x < WL && y < HL) masc[y * WL + x] = id; };
    const poner = (s, x0, y0, id) => {
      let x = x0;
      for (const ch of s) {
        const f = LETRAS_LOGO[base(ch)], w = f[0].length;
        f.forEach((fila, y) => { for (let i = 0; i < w; i++) if (fila[i] === "#") for (let a = 0; a < E; a++) for (let b = 0; b < E; b++) marcar(x + i * E + a, y0 + y * E + b, id); });
        if (ch === "Í") TILDE_LOGO.forEach((fila, y) => { for (let i = 0; i < fila.length; i++) if (fila[i] === "#") for (let a = 0; a < E; a++) for (let b = 0; b < E; b++) marcar(x + i * E + a + 1, y0 - 9 + y * E + b, id); });
        x += (w + GAP) * E;
      }
    };
    poner("NOCHE", x1, y1, 1); poner("CARMESÍ", x2, y2, 2);
    // 1) el relieve hondo: la letra empujada abajo y un poco a la derecha, en dos rojos muy oscuros
    for (let k = 5; k >= 1; k--) for (let y = 0; y < HL; y++) for (let x = 0; x < WL; x++) {
      if (en(x, y)) continue;
      if (en(x - Math.ceil(k / 2), y - k)) p.p(x, y, k > 2 ? "#2e0408" : "#5c0a10");
    }
    // 2) la cara: bandas de hueso a sangre con el cambio en damero, filo de luz arriba, bisel abajo/derecha
    for (let y = 0; y < HL; y++) for (let x = 0; x < WL; x++) {
      const id = en(x, y); if (!id) continue;
      const y0 = id === 1 ? y1 : y2, t = (y - y0) / ALTO, dam = (x + y) & 1;
      let k = t < 0.2 ? 1 : t < 0.28 ? (dam ? 1 : 2) : t < 0.44 ? 2 : t < 0.52 ? (dam ? 2 : 3) : t < 0.7 ? 3 : t < 0.78 ? (dam ? 3 : 4) : 4;
      if (!en(x, y - 1)) k = 0;                                        // el filo de arriba
      else if (!en(x - 1, y)) k = Math.max(0, k - 1);                 // el costado con luz
      else if (!en(x + 1, y) || !en(x, y + 1)) k = Math.min(5, k + 1); // el bisel en sombra
      p.p(x, y, CARA_LOGO[k]);
    }
    // 3) la sangre que chorrea de "CARMESÍ" (y un poco de "NOCHE"): gotas de 2 px con la punta redonda
    const chorrear = (y0, n, largoMax) => {
      const cand = [];
      for (let x = 0; x < WL - 1; x++) if (en(x, y0) && en(x + 1, y0) && !en(x, y0 + 1)) cand.push(x);
      const usados = [];
      for (let i = 0; i < 200 && usados.length < n; i++) {
        const x = cand[Math.floor(r() * cand.length)];
        if (x == null || usados.some((u) => Math.abs(u - x) < 7)) continue;
        usados.push(x);
        const L = 3 + Math.floor(r() * largoMax);
        for (let y = 1; y <= L; y++) { p.p(x, y0 + y, "#d8202a"); p.p(x + 1, y0 + y, "#9a0c16"); }
        for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 2; xx++) if (Math.hypot(xx - 0.5, yy) <= 1.7) p.p(x + xx, y0 + L + 1 + yy, xx <= 0 ? "#e8303a" : "#a01018");
        p.p(x, y0 + L + 1, "#ff8a80");
      }
    };
    chorrear(y2 + ALTO - 1, 9, 11);
    chorrear(y1 + ALTO - 1, 3, 3);
    // 4) los filetes con rombos a los costados de "NOCHE" (emparejan el ancho de las dos palabras)
    const my = y1 + Math.round(ALTO / 2) - 1, rombo = (cx, cy, rr) => { for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (Math.abs(xx) + Math.abs(yy) <= rr) p.p(cx + xx, cy + yy, Math.abs(xx) + Math.abs(yy) === rr ? "#8a1018" : yy < 0 ? "#ff8a78" : "#d8283a"); };
    for (const [a, b] of [[x2 + 2, x1 - 8], [x1 + w1 + 8, x2 + w2 - 2]]) {
      for (let x = Math.min(a, b); x <= Math.max(a, b); x++) { p.p(x, my, "#ff7060"); p.p(x, my + 1, "#b8161e"); }
      rombo(a, my, 3); rombo(b, my, 2);
    }
    // 5) el murciélago del escudo, arriba al centro, con las alas festoneadas
    const cx = Math.round(WL / 2), cy = 9, neg = "#1c0a16", ala = "#2e1024";
    tri(p, cx - 2, cy, cx - 24, cy - 6, cx - 14, cy + 6, ala); tri(p, cx - 2, cy, cx - 14, cy + 6, cx - 3, cy + 6, ala);
    tri(p, cx + 2, cy, cx + 24, cy - 6, cx + 14, cy + 6, ala); tri(p, cx + 2, cy, cx + 14, cy + 6, cx + 3, cy + 6, ala);
    for (const s of [-1, 1]) for (const [bx, br] of [[8, 2.6], [14, 2.8], [20, 2.4]]) for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (Math.hypot(xx, yy) <= br) p.borrar(cx + s * bx + xx, cy + 7 + yy);
    for (const s of [-1, 1]) { p.linea(cx + s * 3, cy, cx + s * 22, cy - 5, "#5a1a34"); p.linea(cx + s * 4, cy + 1, cx + s * 13, cy + 4, "#4a1428"); }
    p.bola(cx, cy + 1, 3, 4, [neg, "#2e1024", "#4a1a34", "#6a2a4a"]);
    tri(p, cx - 3, cy - 2, cx - 1, cy - 2, cx - 2.5, cy - 6, neg); tri(p, cx + 1, cy - 2, cx + 3, cy - 2, cx + 2.5, cy - 6, neg);
    p.p(cx - 1, cy, "#ff3030"); p.p(cx + 1, cy, "#ff3030");
    // 6) el contorno grueso, en dos pasadas (negro y rojo muy oscuro)
    p.contorno("#0a0204", true); p.contorno("#2a0408", false);
    const c = p.canvas();
    // la máscara de la cara, para el brillo que la recorre
    const m = lienzoNuevo(WL, HL), q = m.getContext("2d"), im = q.createImageData(WL, HL);
    for (let i = 0; i < masc.length; i++) if (masc[i]) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = 255; }
    q.putImageData(im, 0, 0);
    c.mascara = m; c.yFin = y2 + ALTO;
    return c;
  });
}
let _brilloLogo = null;
/** Dibuja el logo centrado en x con su resplandor rojo y, cada tanto, un brillo que lo cruza. */
function dibujarLogo(cx, y) {
  const s = logoSpr(), x = Math.round(cx - s.width / 2), t = performance.now() / 1000;
  // el resplandor que late detrás
  const R = s.width * 0.62, gy = y + s.height * 0.5;
  const gr = g.createRadialGradient(cx, gy, 8, cx, gy, R);
  gr.addColorStop(0, `rgba(200,20,30,${0.26 + 0.1 * Math.sin(t * 2)})`); gr.addColorStop(1, "rgba(200,20,30,0)");
  g.fillStyle = gr; g.fillRect(cx - R, gy - R, R * 2, R * 2);        // el cuadrado cubre todo el radio: sin bordes
  g.drawImage(s, x, y);
  // el brillo: una franja diagonal que cruza la cara cada 4 s (sólo sobre las letras)
  const fase = (t % 4) / 1.1;
  if (fase < 1) {
    if (!_brilloLogo || _brilloLogo.width !== s.width) _brilloLogo = lienzoNuevo(s.width, s.height);
    const b = _brilloLogo.getContext("2d"), bx = -30 + fase * (s.width + 60);
    b.globalCompositeOperation = "source-over"; b.clearRect(0, 0, s.width, s.height);
    b.fillStyle = "rgba(255,255,255,0.55)"; b.beginPath(); b.moveTo(bx, 0); b.lineTo(bx + 10, 0); b.lineTo(bx - 20, s.height); b.lineTo(bx - 30, s.height); b.fill();
    b.globalCompositeOperation = "destination-in"; b.drawImage(s.mascara, 0, 0);
    g.drawImage(_brilloLogo, x, y);
  }
  return y + s.yFin;
}
