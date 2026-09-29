// ─────────────────────────────────────────────────────────────────────────────
// EL PAPEL Y LA TINTA: las hojas rasgadas de los menús (con chinches y sombra), la pared de
// papel gris con garabatos desvaídos (dibujos "de chico" sacados de los mismos sprites), la
// franja de tinta de los rótulos, y el logo: letras de bloque enormes con degradé tramado,
// relieve oscuro y las pintitas del sombrero de Shumio, que gotean esporas.
// ─────────────────────────────────────────────────────────────────────────────

/** Un ruido suave de una dimensión (suma de senos con fase por semilla): para los bordes rasgados. */
function ruido1(r) {
  const f = [0.07 + r() * 0.05, 0.19 + r() * 0.1, 0.43 + r() * 0.2], a = [1.3, 0.8, 0.45], ph = f.map(() => r() * TAU);
  return (x) => f.reduce((s, fr, i) => s + Math.sin(x * fr + ph[i]) * a[i], 0);
}

const TONOS_PAPEL = {
  blanco: ["#f4f0ea", "#e9e4dc", "#dcd6cc", "#c9c2b6", "#8f877c"],
  crema: ["#f3e7d2", "#e8d8bd", "#d9c5a4", "#c4ad89", "#8a7457"],
  gris: ["#dcd8d2", "#cfcac2", "#c0bab1", "#aca59b", "#77716a"],
};
/** Una hoja rasgada de w×h (más la sombra). tono: blanco, crema, gris. */
function papelSpr(w, h, semilla = 1, tono = "blanco") {
  return hornear(`papel${w}x${h}|${semilla}|${tono}`, () => {
    const r = mulberry(semilla * 977 + w * 13 + h), R = TONOS_PAPEL[tono];
    const arr = ruido1(r), aba = ruido1(r), izq = ruido1(r), der = ruido1(r);
    const p = new Pix(w + 8, h + 8), o = 3;
    const dentro = (x, y) => {
      const t = arr(x) * 1.1, b = aba(x) * 1.2, l = izq(y) * 1.1, d = der(y) * 1.2;
      return y >= o + 1 + t && y <= o + h - 2 + b && x >= o + 1 + l && x <= o + w - 2 + d;
    };
    // un par de muescas (el papel arrancado de un cuaderno)
    const muescas = [];
    for (let i = 0; i < 2; i++) muescas.push([o + 4 + r() * (w - 8), r() < 0.5 ? o + 1 : o + h - 2, 2 + r() * 2.5]);
    const enMuesca = (x, y) => muescas.some(([mx, my, mr]) => Math.hypot(x - mx, (y - my) * 1.4) < mr);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      if (!dentro(x, y) || enMuesca(x, y)) continue;
      // luz de arriba a la izquierda, tramada, y alguna fibra del papel
      const l = 1 - (y - o) / h * 0.55 - (x - o) / w * 0.25 + bayer(x, y) * 0.25;
      let c = R[l > 0.72 ? 0 : l > 0.45 ? 1 : 2];
      if (r() < 0.012) c = R[2];
      p.p(x, y, c);
    }
    // rayones de lápiz, suaves (como la hoja del menú original)
    for (let i = 0; i < 3; i++) {
      const x0 = o + 4 + r() * (w - 14), y0 = o + 4 + r() * (h - 12), L = 4 + r() * 8, an = -0.7 + r() * 0.3;
      trazo(x0, y0, x0 + Math.cos(an) * L, y0 + Math.sin(an) * L, (x, y) => { if (p.g(x, y)) p.p(x, y, R[2]); });
    }
    p.bordeInterior({ [R[0]]: R[3], [R[1]]: R[3], [R[2]]: R[3] });
    p.contorno(R[4]);
    const c = p.canvas(), s = lienzoNuevo(c.width + 3, c.height + 3), g = s.getContext("2d");
    g.globalAlpha = 0.3; g.drawImage(tinte(c, "#0a0608"), 3, 3); g.globalAlpha = 1; g.drawImage(c, 0, 0);
    return s;
  });
}
/** La chinche que sostiene la hoja. */
function chincheSpr() {
  return hornear("chinche", () => {
    const p = new Pix(9, 9);
    p.bola(4.5, 4.5, 3.6, 3.4, ["#3a3c40", "#6a6e74", "#9ca0a6", "#d2d6da"], { luz: [-0.6, -0.7, 0.4], trama: 0.5 });
    p.p(3, 3, "#ffffff");
    p.contorno(PAL.tinta, true);
    return p.canvas();
  });
}

/** Un garabato hecho "a mano" desde un sprite: su contorno y sus partes oscuras, en tinta. */
function garabato(c, tinta = "#2b2326", escala = 2, relleno = null) {
  return hornear(`garabato|${tinta}|${escala}|${relleno}|` + (c.__id ||= Math.random().toString(36).slice(2)), () => {
    const g = c.getContext("2d"), d = g.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const a = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 100;
    const lum0 = (x, y) => { const i = (y * W + x) * 4; return (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; };
    // la luz promediada en 3×3 (así el tramado no cuenta como borde: sólo los cambios de verdad)
    const L = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (a(x + dx, y + dy)) { s += lum0(x + dx, y + dy); n++; }
      L[y * W + x] = n ? s / n : 0;
    }
    const lum = (x, y) => L[y * W + x];
    const p = new Pix(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!a(x, y)) continue;
      const borde = !a(x + 1, y) || !a(x - 1, y) || !a(x, y + 1) || !a(x, y - 1);
      // además del contorno, los bordes de adentro (donde el color cambia mucho): como un dibujo para colorear
      const salto = (a(x + 1, y) && Math.abs(lum(x, y) - lum(x + 1, y)) > 0.17) || (a(x, y + 1) && Math.abs(lum(x, y) - lum(x, y + 1)) > 0.17);
      if (borde || lum0(x, y) < 0.12 || salto) p.p(x, y, tinta);
      else if (relleno) p.p(x, y, relleno);
    }
    const q = p.canvas(), out = lienzoNuevo(W * escala, H * escala), go = out.getContext("2d");
    go.imageSmoothingEnabled = false; go.drawImage(q, 0, 0, W * escala, H * escala);
    return out;
  });
}

/** La pared de papel gris con dibujos desvaídos (el fondo de todos los menús). */
function fondoMenuSpr(W, H) {
  return hornear(`fondoMenu${W}x${H}`, () => {
    const c = lienzoNuevo(W, H), g = c.getContext("2d"), r = mulberry(31337);
    const p = new Pix(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - W * 0.55) / (W * 0.62), ny = (y - H * 0.42) / (H * 0.8), e = nx * nx + ny * ny;
      const k = e + bayer(x, y) * 0.22;
      p.p(x, y, k < 0.35 ? "#c9c4bc" : k < 0.62 ? "#bdb7ae" : k < 0.95 ? "#aca69c" : "#958f86");
    }
    g.drawImage(p.canvas(), 0, 0);
    // los dibujos del chico en la pared: Shumio, hongos, un mosquín, un cofre, un corazón, una gota
    const tinta = "rgba(92,84,80,0.22)";
    const dibujos = [spritesShumio().cab.frente[0], matasSpr(3), mosquinSpr(0), cofreSpr(false, false), corazonSpr("rojo"), lagrimaSpr(6), hongonSpr(0), iconoSpr("brujula"), bombaSpr(1), aranaSpr(0)];
    const lugares = [[0.08, 0.12], [0.86, 0.1], [0.06, 0.62], [0.9, 0.66], [0.2, 0.86], [0.74, 0.88], [0.93, 0.36], [0.03, 0.36], [0.62, 0.05], [0.36, 0.93]];
    dibujos.forEach((s, i) => {
      const gb = garabato(s, tinta, 2), [u, v] = lugares[i];
      g.save(); g.translate(Math.round(u * W), Math.round(v * H)); g.rotate((r() - 0.5) * 0.5);
      g.drawImage(gb, -gb.width / 2, -gb.height / 2); g.restore();
    });
    // rayas, estrellitas y círculos sueltos
    g.fillStyle = tinta;
    for (let i = 0; i < 16; i++) {
      const x = r() * W, y = r() * H, t = r();
      if (t < 0.4) { const L = 4 + r() * 8, an = r() * TAU; trazo(x, y, x + Math.cos(an) * L, y + Math.sin(an) * L, (a, b) => g.fillRect(a, b, 2, 2)); }
      else if (t < 0.7) { g.fillRect(x - 3, y, 7, 2); g.fillRect(x, y - 3, 2, 7); }
      else { const rr = 3 + r() * 5; for (let k = 0; k < 24; k++) { const an = k / 24 * TAU; g.fillRect(Math.round(x + Math.cos(an) * rr), Math.round(y + Math.sin(an) * rr * 0.8), 1, 1); } }
    }
    return c;
  });
}

/** La franja de los rótulos: una pincelada de sangre seca, casi negra, con los bordes deshilachados
 *  y gotas que cuelgan (como la de los nombres de piso del original). */
function bandaSpr(w, h = 34) {
  return hornear(`banda${w}x${h}`, () => {
    const p = new Pix(w, h + 10), r = mulberry(w * 7 + h), arr = ruido1(r), aba = ruido1(r);
    const fondo = (x, y) => (bayer(x, y) > 0.3 ? "rgba(34,6,9,0.9)" : "rgba(14,3,5,0.9)");
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1), punta = Math.min(u, 1 - u) * 2, f = 1 - Math.min(1, punta * 2.6);
      const t = 3 + arr(x * 0.5) * 1.6 + f * 8, b = h - 3 + aba(x * 0.5) * 1.6 - f * 8;
      for (let y = Math.max(0, Math.floor(t)); y < Math.min(h, Math.ceil(b)); y++) {
        if (punta < 0.3 && ((y * 5 + (x >> 1)) % 4 === 0) && r() < 0.85) continue;     // las cerdas en las puntas
        const borde = y < t + 1.2 || y > b - 1.8;
        p.p(x, y, borde ? "rgba(78,12,16,0.85)" : fondo(x, y));
      }
      // gotas que chorrean de la pincelada
      if (punta > 0.35 && r() < 0.035) {
        const L = 2 + Math.floor(r() * 8), y0 = Math.ceil(b) - 1;
        for (let y = 0; y < L; y++) { p.p(x, y0 + y, fondo(x, y0 + y)); if (y < L - 2) p.p(x + 1, y0 + y, fondo(x + 1, y0 + y)); }
        p.p(x, y0 + L, "rgba(78,12,16,0.85)");
      }
    }
    return p.canvas();
  });
}

/** El logo, con la construcción del original: "SHUMIO'S" enorme en bloque (×3), con bandas de rojo
 *  en damero, el filo de arriba con luz y un relieve hondo abajo a la derecha; "DEPTHS" en rojo claro,
 *  abajo a la derecha (como el subtítulo); una salpicadura que chorrea, y las pintitas del sombrero. */
function logoSpr() {
  return hornear("logo4", () => {
    const grande = "SHUMIO'S", chico = "DEPTHS", E1 = 4, E2 = 3, HONDO = 6;
    const ancho = (s) => _medir(s, (ch) => glifoBloque(ch).w, 1);
    const w1 = ancho(grande) * E1, w2 = ancho(chico) * E2, h1 = ALTO_BLOQUE * E1, h2 = ALTO_BLOQUE * E2;
    const W = w1 + 40, H = h1 + h2 + 46;
    const p = new Pix(W, H), x1 = 26, y1 = 6, x2 = x1 + w1 - w2 + 4, y2 = y1 + h1 + HONDO - 1;
    const masc = new Uint8Array(W * H), capa = new Uint8Array(W * H);
    const poner = (s, x0, y0, E, id) => {
      let x = x0;
      for (const ch of s) {
        const gl = glifoBloque(ch);
        gl.filas.forEach((f, y) => { for (let i = 0; i < f.length; i++) if (f[i] !== ".") for (let a = 0; a < E; a++) for (let b = 0; b < E; b++) { const X = x + i * E + a, Y = y0 + y * E + b; if (X < W && Y < H) { masc[Y * W + X] = 1; capa[Y * W + X] = id; } } });
        x += (gl.w + 1) * E;
      }
    };
    poner(grande, x1, y1, E1, 1); poner(chico, x2, y2, E2, 2);
    const lleno = (x, y) => x >= 0 && y >= 0 && x < W && y < H && masc[y * W + x];
    const r = mulberry(4040);
    // 0) la salpicadura, detrás de la primera letra: una mancha con gotas y chorros
    const sx = x1 - 6, sy = y1 + h1 + 4, SANG = ["#4a0508", "#7e0c10", "#b3161a", "#d8261f"];
    const disco = (cx0, cy0, rr, c) => { for (let y = Math.floor(cy0 - rr); y <= cy0 + rr; y++) for (let x = Math.floor(cx0 - rr); x <= cx0 + rr; x++) if (Math.hypot(x + 0.5 - cx0, (y + 0.5 - cy0) * 1.15) <= rr) p.p(x, y, c); };
    disco(sx, sy, 9, SANG[2]); disco(sx - 6, sy + 3, 6, SANG[2]); disco(sx + 4, sy - 5, 5, SANG[3]);
    for (let i = 0; i < 16; i++) {   // gotas que saltaron, más chicas cuanto más lejos
      const a = Math.PI * (0.35 + r() * 1.25), d = 12 + r() * 16, rr = Math.max(0.7, 2.6 - d / 12);
      disco(sx + Math.cos(a) * d, sy + Math.sin(a) * d * 0.8, rr, SANG[2]);
    }
    for (let i = 0; i < 4; i++) {    // chorros que caen
      const x = sx - 10 + i * 5 + Math.floor(r() * 3), L = 8 + Math.floor(r() * 16), y0 = sy + 5;
      for (let y = 0; y < L; y++) { p.p(x, y0 + y, SANG[2]); p.p(x + 1, y0 + y, SANG[1]); }
      disco(x + 1, y0 + L, 1.6, SANG[2]);
    }
    // 1) el relieve hondo (dos tonos)
    for (let k = HONDO; k >= 1; k--) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (lleno(x - k, y - k) && !lleno(x, y)) {
      const id = capa[(y - k) * W + x - k];
      p.p(x, y, id === 1 ? (k > 2 ? "#300709" : "#560d10") : (k > 1 ? "#3a0a0c" : "#5c1216"));
    }
    // 2) la cara: bandas de rojo con transición en damero; el filo de arriba y el de la izquierda con luz
    const ROJO = ["#ff8a70", "#ec4a38", "#c8281f", "#9a1a16"], CLARO = ["#ffc2ae", "#ff8a70", "#f06a52", "#c8402f"];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!lleno(x, y)) continue;
      const id = capa[y * W + x], y0 = id === 1 ? y1 : y2, hh = id === 1 ? h1 : h2, R = id === 1 ? ROJO : CLARO;
      const t = (y - y0) / hh, dam = (x + y) & 1;
      let k = t < 0.28 ? 1 : t < 0.36 ? (dam ? 1 : 2) : t < 0.62 ? 2 : t < 0.7 ? (dam ? 2 : 3) : 3;
      if (!lleno(x, y - 1) || !lleno(x, y - 2)) k = 0;               // el filo de arriba (2 px con luz)
      else if (!lleno(x - 1, y) && k > 1) k--;
      p.p(x, y, R[k]);
    }
    // 3) las pintitas del sombrero de Shumio, en la banda de arriba de las letras grandes
    for (let i = 0; i < 40; i++) {
      const x = x1 + Math.floor(r() * w1), y = y1 + 4 + Math.floor(r() * (h1 * 0.4));
      const ok = [[-1, -1], [0, -1], [1, -1], [2, -1], [3, -1], [-1, 0], [3, 0], [-1, 1], [3, 1], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2]].every(([dx, dy]) => lleno(x + dx, y + dy) && capa[(y + dy) * W + x + dx] === 1);
      if (!ok) continue;
      p.sello(x, y, [".cc", "ccC"], { c: "#fff2dc", C: "#e2c8a6" });
    }
    // 4) el contorno grueso, en dos pasadas
    p.contorno(PAL.tinta, true); p.contorno(PAL.tinta, false);
    return p.canvas();
  });
}

/** Shumio dibujado a mano para la hoja del título: trazos limpios de marcador (se pinta a 1 px y se
 *  agranda ×2, así cada línea queda de 2). llora: las lágrimas de esporas cayendo. */
function dibujoShumio(llora = 0) {
  return hornear(`dibujoShumio${llora}`, () => {
    const p = new Pix(36, 40), T = TINTA_MANO;
    const aro = (cx0, cy0, rx, ry, desde, hasta) => {   // un arco de elipse, continuo (ángulos en radianes)
      let ant = null;
      for (let i = 0; i <= 90; i++) {
        const a = desde + (hasta - desde) * i / 90, x = Math.round(cx0 + Math.cos(a) * rx), y = Math.round(cy0 + Math.sin(a) * ry);
        if (ant) trazo(ant[0], ant[1], x, y, (X, Y) => p.p(X, Y, T)); ant = [x, y];
      }
    };
    const lin = (a, b, c, d) => trazo(a, b, c, d, (X, Y) => p.p(X, Y, T));
    // el sombrero: media elipse y el ala, apenas curvada
    aro(18, 14, 15, 11, Math.PI, TAU);
    for (let x = 3; x <= 33; x++) p.p(x, Math.round(14 + Math.pow((x - 18) / 15, 2) * 1.6), T);
    // las pintitas del sombrero
    for (const [x, y, r] of [[11, 8, 2.2], [20, 5.5, 2.4], [26.5, 10, 1.9]]) aro(x, y, r, r, 0, TAU);
    // la cara: los costados y la barbilla redonda
    lin(6, 15, 6, 20); lin(30, 15, 30, 20);
    aro(18, 20, 12, 7, 0, Math.PI);
    // los ojos, grandes y rellenos, con el brillo
    for (const ex of [13, 23]) { for (let y = 16; y <= 21; y++) for (let x = ex - 2; x <= ex + 1; x++) if (Math.hypot(x + 0.5 - ex, (y + 0.5 - 18.5) * 0.8) <= 2.1) p.p(x, y, T); p.borrar(ex - 1, 17); }
    lin(17, 24, 18, 24);                                    // la boquita
    // el cuerpo, los bracitos y los pies
    lin(13, 27, 12, 34); lin(23, 27, 24, 34); lin(12, 34, 24, 34);
    lin(12, 29, 8, 32); lin(24, 29, 28, 32);
    aro(15, 36, 2, 1.4, 0, Math.PI); aro(21, 36, 2, 1.4, 0, Math.PI);
    // las lágrimas: gotitas que caen de los ojos
    if (llora) for (const ex of [11, 25]) { lin(ex, 23, ex, 25); p.p(ex - 1, 26, T); p.p(ex + 1, 26, T); p.p(ex, 27, T); }
    const c = p.canvas(), out = lienzoNuevo(72, 80), g = out.getContext("2d");
    g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, 72, 80);
    return out;
  });
}

/** Una gotita dibujada a mano (las lágrimas que caen en la hoja del título). */
function gotitaDibujo() {
  return hornear("gotitaDibujo", () => {
    const p = new Pix(5, 6);
    p.sello(0, 0, ["..#..", ".#.#.", "#...#", "#...#", "#...#", ".###."], { "#": TINTA_MANO });
    const c = p.canvas(), out = lienzoNuevo(10, 12), g = out.getContext("2d");
    g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, 10, 12);
    return out;
  });
}
