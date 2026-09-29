// ─────────────────────────────────────────────────────────────────────────────
// EL ARTE DE LA SALA: el piso, los muros, las puertas y los obstáculos, por capítulo.
// El fondo de cada sala se hornea UNA vez (con su semilla: la misma sala se ve igual al volver)
// y encima se dibujan las manchas que van quedando (sangre, baba, quemaduras de bomba).
// ─────────────────────────────────────────────────────────────────────────────

const CAPITULOS = {
  sotano: {
    nombre: "SÓTANO HÚMEDO", piso: ["#1a1f1b", "#232a25", "#2c342d", "#363f36", "#434c41", "#525b4e"],
    junta: "#101411", ladrillo: ["#141815", "#1e2420", "#2a322b", "#39433a", "#4b564a", "#5e6a5c"], mortero: "#0c0f0d",
    musgo: PAL.musgo, mancha: "#161b17", oscuro: "#050706", tinte: [12, 18, 12],
  },
  raices: {
    nombre: "LAS RAÍCES", piso: ["#1d140e", "#281c13", "#34251a", "#413021", "#503c2a", "#614a35"],
    junta: "#130c08", ladrillo: ["#170f0a", "#231710", "#321f15", "#44291b", "#583624", "#6d4630"], mortero: "#0d0806",
    musgo: ["#1a1409", "#2e2410", "#4a3a18", "#6b5626", "#8d7536"], mancha: "#1a120c", oscuro: "#070403", tinte: [22, 12, 6],
  },
};

/** Una línea continua (Bresenham): sin huecos ni saltos, como la trazaría un pixelador. */
function trazo(x0, y0, x1, y1, fn) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) { fn(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
/** Una grieta: 2 a 4 tramos que cambian de rumbo de a poco, con el borde de abajo iluminado (la profundidad). */
function grieta(r, x, y, largo, pintar, iluminar) {
  let a = r() * TAU;
  const tramos = 2 + Math.floor(r() * 3);
  for (let k = 0; k < tramos; k++) {
    const l = largo / tramos * (0.7 + r() * 0.6), nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
    trazo(x, y, nx, ny, (X, Y) => { pintar(X, Y); if (iluminar) iluminar(X + 1, Y + 1); });
    x = nx; y = ny; a += (r() - 0.5) * 1.3;
  }
}

/** El fondo entero de una sala (muros + piso), horneado con su semilla. */
function hornearFondoPixel(capituloId, semilla) {
  const C = CAPITULOS[capituloId], r = mulberry(semilla), W = SALA_W, H = SALA_H;
  const cv = lienzoNuevo(W, H), g = cv.getContext("2d"), im = g.createImageData(W, H), d = im.data;
  const px = (x, y, col) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const [R, G, B] = rgba(col), i = (y * W + x) * 4; d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = 255; };
  const tono = (rampa, i) => rampa[lim(Math.round(i), 0, rampa.length - 1)];
  const oscurecer = (x, y, t) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] *= t; d[i + 1] *= t; d[i + 2] *= t; };
  // ── el piso: losas de 24 con bisel, motas, grietas, musgo junto a los muros ──
  for (let f = 0; f < FILAS; f++) for (let c = 0; c < COLS; c++) {
    const x0 = IX0 + c * T, y0 = IY0 + f * T, base = 2.6 + (r() - 0.5) * 1.1;
    // algunas losas partidas en dos
    const partida = r() < 0.18 ? (r() < 0.5 ? "h" : "v") : null;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let i = base + bayer(x + c, y + f) * 0.9;
      if (x === 0 || y === 0) i += 0.9;                 // el borde de arriba/izquierda, iluminado
      if (x === T - 1 || y === T - 1) i = 0;            // la junta
      if (x === T - 2 || y === T - 2) i -= 0.7;
      if (partida === "h" && y === 11 && x > 1) i = 0.4;
      if (partida === "v" && x === 11 && y > 1) i = 0.4;
      const m = r();
      if (m < 0.05) i -= 1; else if (m > 0.97) i += 1;  // las motas
      px(x0 + x, y0 + y, i <= 0.05 ? C.junta : tono(C.piso, i));
    }
  }
  // las grietas (sobre las losas ya pintadas: el borde iluminado lee el tono de al lado)
  for (let k = 0; k < 16; k++) {
    const x = IX0 + 4 + r() * (COLS * T - 8), y = IY0 + 4 + r() * (FILAS * T - 8);
    grieta(r, x, y, 6 + r() * 10, (X, Y) => px(X, Y, C.junta), (X, Y) => { if (X > IX0 && Y > IY0 && X < IX1 && Y < IY1) { const i = (Y * W + X) * 4; if (d[i] > 30) px(X, Y, C.piso[4]); } });
  }
  // manchas de humedad: una mancha sólida de borde irregular, que oscurece lo que tiene abajo (no un color encima)
  for (let k = 0; k < 7; k++) {
    const mx = IX0 + 10 + r() * (COLS * T - 20), my = IY0 + 10 + r() * (FILAS * T - 20), rr = 6 + r() * 9, f1 = r() * TAU, f2 = r() * TAU;
    for (let y = -rr - 3; y <= rr + 3; y++) for (let x = -rr * 1.4 - 3; x <= rr * 1.4 + 3; x++) {
      const an = Math.atan2(y, x), borde = rr * (1 + 0.22 * Math.sin(an * 3 + f1) + 0.14 * Math.sin(an * 5 + f2));
      const dd = Math.hypot(x / 1.4, y) - borde, X = Math.round(mx + x), Y = Math.round(my + y);
      if (dd < -1.5) oscurecer(X, Y, 0.78); else if (dd < 0.5 && bayer(X, Y) < 0) oscurecer(X, Y, 0.86);
    }
  }
  // musgo: manchones al pie de los muros, con el centro más claro y el borde tramado
  for (let k = 0; k < 14; k++) {
    const lado = Math.floor(r() * 4);
    const mx = lado === 3 ? IX0 + 2 : lado === 1 ? IX1 - 3 : IX0 + 8 + r() * (COLS * T - 16);
    const my = lado === 0 ? IY0 + 2 : lado === 2 ? IY1 - 3 : IY0 + 8 + r() * (FILAS * T - 16);
    const rx = lado % 2 ? 3 + r() * 3 : 6 + r() * 9, ry = lado % 2 ? 6 + r() * 9 : 3 + r() * 3;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const e = (x * x) / (rx * rx) + (y * y) / (ry * ry), X = Math.round(mx + x), Y = Math.round(my + y);
      if (X < IX0 || Y < IY0 || X >= IX1 || Y >= IY1) continue;
      if (e < 0.35) px(X, Y, C.musgo[3]); else if (e < 0.7) px(X, Y, C.musgo[2]); else if (e < 1 && bayer(X, Y) < 0.1) px(X, Y, C.musgo[1]);
    }
  }
  // ── los muros: hileras de ladrillos (el de arriba más alto) ──
  const ladrillos = (x0, y0, w, h, alto, anchoL, desde) => {
    for (let y = y0; y < y0 + h; y++) {
      const hilera = Math.floor((y - y0) / alto), dentroY = (y - y0) % alto, corr = (hilera % 2) * Math.floor(anchoL / 2);
      for (let x = x0; x < x0 + w; x++) {
        const dentroX = (x - x0 + corr) % anchoL, id = hilera * 97 + Math.floor((x - x0 + corr) / anchoL);
        if (dentroY === alto - 1 || dentroX === anchoL - 1) { px(x, y, C.mortero); continue; }
        const semi = ((id * 2654435761) >>> 0) / 4294967296;
        let i = desde + (semi - 0.5) * 1.2 + (dentroY === 0 ? 0.9 : 0) - (dentroY === alto - 2 ? 0.6 : 0) + bayer(x, y) * 0.7;
        if (semi > 0.93 && dentroX > 2 && dentroX < anchoL - 3 && dentroY > 1) i -= 1.6;   // un ladrillo roto
        px(x, y, tono(C.ladrillo, i));
      }
    }
  };
  ladrillos(0, 0, W, MURO_A, 8, 16, 3.2);                     // arriba
  ladrillos(0, H - MURO_B, W, MURO_B, 8, 16, 2.4);             // abajo
  ladrillos(0, MURO_A, MURO_L, H - MURO_A - MURO_B, 8, 12, 2.7);   // izquierda
  ladrillos(W - MURO_L, MURO_A, MURO_L, H - MURO_A - MURO_B, 8, 12, 2.7);
  // la sombra de los muros sobre el piso (más larga abajo del muro de arriba) y el zócalo
  for (let x = IX0; x < IX1; x++) for (let k = 0; k < 9; k++) oscurecer(x, IY0 + k, 0.45 + k * 0.06);
  for (let y = IY0; y < IY1; y++) { for (let k = 0; k < 5; k++) { oscurecer(IX0 + k, y, 0.55 + k * 0.09); oscurecer(IX1 - 1 - k, y, 0.55 + k * 0.09); } }
  for (let x = IX0; x < IX1; x++) for (let k = 0; k < 3; k++) oscurecer(x, IY1 - 1 - k, 0.7 + k * 0.1);
  // el borde de arriba de cada muro (el canto), iluminado, y los rincones más oscuros
  for (let x = IX0 - 2; x < IX1 + 2; x++) { px(x, IY0 - 1, C.ladrillo[5]); px(x, IY1, C.ladrillo[1]); }
  for (let y = IY0 - 1; y < IY1 + 1; y++) { px(IX0 - 1, y, C.ladrillo[4]); px(IX1, y, C.ladrillo[4]); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // la luz: el centro de la sala más claro, los muros y los rincones se van a oscuro
    const nx = (x - W / 2) / (W / 2), ny = (y - (H / 2 + 6)) / (H / 2), e = nx * nx * 0.75 + ny * ny;
    oscurecer(x, y, lim(1.12 - e * 0.55, 0.28, 1.12));
  }
  // el techo que no se ve: negro con el borde de los muros comido
  for (let x = 0; x < W; x++) for (let y = 0; y < 3; y++) oscurecer(x, y, 0.2 + y * 0.25);
  g.putImageData(im, 0, 0);
  // detalles del capítulo, a mano: raíces colgando, telarañas, huesitos
  const q = new Pix(W, H);
  if (capituloId === "raices") {
    for (let k = 0; k < 9; k++) {
      let x = 10 + r() * (W - 20), y = 0; const n = 10 + r() * 22;
      for (let i = 0; i < n; i++) { q.p(x, y, PAL.tierra[i % 3 === 0 ? 1 : 2]); q.p(x + 1, y, PAL.tierra[1]); y += 1; x += (r() - 0.5) * 1.2; if (y > MURO_A + 4) break; }
    }
    // vigas de madera en los muros de costado
    for (const bx of [4, W - 10]) for (let y = MURO_A + 10; y < H - MURO_B - 6; y += 46) q.caja(bx, y, 6, 20, PAL.tierra.slice(1), { vertical: 0.2 });
  } else {
    for (let k = 0; k < 6; k++) { const x = 6 + r() * (W - 12); for (let y = 0; y < 5 + r() * 16; y++) q.p(x, y, C.musgo[2 + (y % 2)]); }
  }
  // telarañas en los rincones de arriba: tres hilos desde el rincón y dos vueltas que los unen
  for (const [x0, s] of [[IX0, 1], [IX1 - 1, -1]]) {
    const hilo = "#5d625a", vuelta = "#474b45", L = 13;
    const ang = [0.12, 0.62, 1.2];
    for (const a of ang) trazo(x0, IY0, x0 + s * Math.cos(a) * L, IY0 + Math.sin(a) * L, (X, Y) => q.p(X, Y, hilo));
    for (const rad of [5, 9]) {
      let ant = null;
      for (let t = 0; t <= 12; t++) {
        const a = ang[0] + (ang[2] - ang[0]) * t / 12, cae = Math.sin(t / 12 * Math.PI * 2 % Math.PI) * 0.8;
        const P = [x0 + s * Math.cos(a) * rad, IY0 + Math.sin(a) * rad + cae];
        if (ant) trazo(ant[0], ant[1], P[0], P[1], (X, Y) => q.p(X, Y, vuelta));
        ant = P;
      }
    }
  }
  g.drawImage(q.canvas(), 0, 0);
  return cv;
}

/** La viñeta de la sala: oscuridad tramada (Bayer) que se come los bordes, como luz de vela. */
function vinetaPixel() {
  return hornear("vineta", () => {
    const W = SALA_W + 40, H = SALA_H + 40, p = new Pix(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - W / 2) / (W / 2), ny = (y - H / 2) / (H / 2), e = Math.pow(nx * nx * 0.8 + ny * ny * 0.95, 1.4);
      const k = e * 1.25 - 0.35 + bayer(x, y) * 0.35;
      if (k > 0.66) p.p(x, y, "rgba(3,2,5,0.72)"); else if (k > 0.42) p.p(x, y, "rgba(3,2,5,0.45)"); else if (k > 0.2) p.p(x, y, "rgba(3,2,5,0.22)");
    }
    return p.canvas();
  });
}

// ── las puertas: el marco y las hojas, por tipo de sala ──
// El sprite es de la puerta de ARRIBA (32×30); las otras se dibujan rotadas.
const TIPO_PUERTA = {
  normal: { marco: PAL.piedra, brillo: null },
  tesoro: { marco: PAL.oro, brillo: "#ffd96a" },
  jefe: { marco: PAL.sangre, brillo: "#ff3b2f" },
  tienda: { marco: PAL.piedra, brillo: null },
  secreta: { marco: null },
  pacto: { marco: ["#0a0406", "#220a0e", "#3d0f15", "#651a20", "#8e2a2a"], brillo: "#ff2a2a" },
};
function puertaSpr(tipo, estado, prof = MURO_A) {
  return hornear(`puerta${tipo}${estado}${prof}`, () => {
    // todo se dibuja con el piso abajo (y = prof es el borde del piso): en un muro más finito, lo
    // que se pierde es lo de arriba (lo más lejano), no la boca de la puerta
    const H = prof, o = H - 32, p = new Pix(34, H), t = TIPO_PUERTA[tipo];
    const P = (x, y, c) => p.p(x, y + o, c);
    if (tipo === "secreta") {
      for (let y = 6; y < 32; y++) for (let x = 5; x < 29; x++) {
        const nx = (x - 17) / 11, ny = (y - 22) / 14;
        if (nx * nx + ny * ny < 1 + bayer(x, y) * 0.3) P(x, y, y > 26 ? "#050305" : "#0b080a");
      }
      // cascotes alrededor del boquete
      for (const [x, y] of [[6, 14], [8, 10], [27, 13], [25, 9], [5, 22], [28, 21]]) { P(x, y, PAL.piedra[3]); P(x + 1, y, PAL.piedra[2]); P(x, y + 1, PAL.piedra[1]); }
      p.contorno(AUTO);
      return p.canvas();
    }
    // el hueco oscuro, con un poco de luz que entra desde el otro lado
    for (let y = 6; y < 32; y++) for (let x = 8; x < 26; x++) P(x, y, y < 12 && bayer(x, y) > 0.3 ? "#0d090c" : "#050305");
    // las hojas (cerrada: se juntan en el medio)
    const cierre = estado >= 4 ? 1 : estado / 4;
    if (cierre > 0) {
      const w = Math.round(9 * cierre), q = new Pix(34, 32);
      q.caja(8, 7, w, 25, PAL.tierra.slice(1, 5), { vertical: 0.3 }); q.caja(26 - w, 7, w, 25, PAL.tierra.slice(1, 5), { vertical: 0.3 });
      for (let y = 12; y < 32; y += 6) { q.linea(8, y, 8 + w - 1, y, PAL.tierra[1]); q.linea(26 - w, y, 25, y, PAL.tierra[1]); }
      if (cierre >= 1) { q.linea(17, 7, 17, 31, PAL.tierra[0]); q.rect(15, 18, 1, 3, PAL.hierro[3]); q.rect(19, 18, 1, 3, PAL.hierro[3]); }
      for (let y = 0; y < 32; y++) for (let x = 0; x < 34; x++) { const c = q.g(x, y); if (c) P(x, y, c); }
    }
    // el marco: un arco de dovelas (piedra, oro, o carne con dientes para el jefe)
    const m = t.marco, junta = m[0];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 34; x++) {
      const dentro = x >= 8 && x < 26 && y >= 6;
      const arco = y < 12 ? Math.hypot(x + 0.5 - 17, (y + 0.5 - 12) * 1.3) : Math.abs(x + 0.5 - 17);
      if (dentro && arco < 9) continue;
      if (arco < 16.5) {
        const l = 1 - Math.min(1, arco / 16.5) * 0.55 - (y / 32) * 0.3;
        P(x, y, m[lim(Math.floor(l * m.length + bayer(x, y) * 0.6), 1, m.length - 1)]);
      }
    }
    // las juntas entre dovelas: rayos continuos del borde de adentro al de afuera
    for (let k = 0; k <= 6; k++) {
      const an = Math.PI + k * Math.PI / 6;
      trazo(17 + Math.cos(an) * 9.5, 12 + Math.sin(an) * 9.5 / 1.3, 17 + Math.cos(an) * 16, 12 + Math.sin(an) * 16 / 1.3, (x, y) => P(x, y, junta));
    }
    for (const y of [18, 25]) { trazo(1, y, 7, y, (x, yy) => P(x, yy, junta)); trazo(26, y, 32, y, (x, yy) => P(x, yy, junta)); }
    if (tipo === "jefe" || tipo === "pacto") {
      for (let k = 0; k < 4; k++) { const x = 9 + k * 4 + 1; P(x, 6, PAL.hueso[3]); P(x + 1, 6, PAL.hueso[3]); P(x + 1, 7, PAL.hueso[2]); }
      for (const [x0, s] of [[1, 1], [32, -1]]) for (let k = 0; k < 4; k++) { P(x0 + s * k, k, PAL.hueso[2]); P(x0 + s * (k + 1), k, PAL.hueso[3]); }
      P(16, 2, t.brillo); P(17, 2, t.brillo);
    }
    if (tipo === "tesoro") { const q = [".ff.", "fggf", ".ff."]; q.forEach((f, y) => [...f].forEach((c, x) => { if (c !== ".") P(15 + x, y, c === "f" ? PAL.oro[4] : PAL.oro[2]); })); }
    if (tipo === "tienda") { [".kkkk.", "kmmmmk", "kmkkmk", ".kkkk."].forEach((f, y) => [...f].forEach((c, x) => { if (c !== ".") P(14 + x, 1 + y, c === "k" ? PAL.tinta : PAL.oro[3]); })); }
    if (estado === 5) { [".kkk.", "k...k", "kkkkk", "kOOOk", "kOkOk", "kOOOk", "kkkkk"].forEach((f, y) => [...f].forEach((c, x) => { if (c !== ".") P(15 + x, 15 + y, c === "k" ? PAL.tinta : PAL.oro[3]); })); }
    p.contorno(AUTO);
    return p.canvas();
  });
}
/** La profundidad de cada muro (arriba, derecha, abajo, izquierda). */
const PROF_MURO = [MURO_A, MURO_L, MURO_B, MURO_L];
/** La puerta de cada muro: hecha para su grosor y rotada con el piso hacia adentro. */
function puertaRotada(tipo, estado, dir) {
  return hornear(`puertaR${tipo}${estado}${dir}`, () => {
    const s = puertaSpr(tipo, estado, PROF_MURO[dir]), c = lienzoNuevo(dir % 2 ? s.height : s.width, dir % 2 ? s.width : s.height), g = c.getContext("2d");
    g.translate(c.width / 2, c.height / 2); g.rotate(dir * Math.PI / 2); g.drawImage(s, -s.width / 2, -s.height / 2);
    return c;
  });
}
/** Dónde va la esquina de la puerta de cada muro, en la sala. */
function lugarPuerta(dir) {
  const s = puertaRotada("normal", 0, dir);
  if (dir === ARRIBA) return [SALA_W / 2 - s.width / 2, 0];
  if (dir === ABAJO) return [SALA_W / 2 - s.width / 2, SALA_H - s.height];
  if (dir === IZQUIERDA) return [0, IY0 + FILAS * T / 2 - s.height / 2];
  return [SALA_W - s.width, IY0 + FILAS * T / 2 - s.height / 2];
}

// ── los obstáculos ──
function rocaSpr(v, marcada = false) {
  return hornear(`roca${v}${marcada}`, () => {
    const p = new Pix(26, 26), r = mulberry(99 + v * 17), R = marcada ? ["#141619", "#262b33", "#3b4250", "#58637a", "#7e8ba3", "#a8b3c7"] : PAL.piedra;
    // dos o tres bultos que se tocan: parece una piedra de verdad, no una bola
    const bultos = v === 0 ? [[13, 15, 10, 8], [9, 11, 6, 5]] : v === 1 ? [[12, 15, 9, 8], [17, 12, 6, 6], [8, 16, 5, 5]] : [[13, 14, 10, 9]];
    for (const [x, y, rx, ry] of bultos) p.bola(x, y, rx, ry, R.slice(1), { luz: [-0.6, -0.7, 0.4], bajar: 0.3, trama: 0.9 });
    // una o dos grietas de verdad: trazo continuo oscuro con el labio de arriba iluminado
    const n = v === 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const x = 9 + r() * 8, y = 10 + r() * 4;
      grieta(r, x, y, 7 + r() * 4, (X, Y) => { if (p.g(X, Y) && p.g(X, Y + 1) && p.g(X + 1, Y)) p.p(X, Y, R[1]); }, (X, Y) => { if (p.g(X - 1, Y - 2) && p.g(X - 1, Y - 2) !== R[1]) p.p(X - 1, Y - 2, R[5]); });
    }
    // musgo: una mata en la parte de arriba (donde da la humedad), no puntitos sueltos
    if (!marcada) {
      const mx = 10 + r() * 6, my = 6 + r() * 2;
      for (let y = -2; y <= 1; y++) for (let x = -4; x <= 4; x++) {
        const e = (x * x) / 16 + (y * y) / 4;
        if (e <= 1 && p.g(mx + x, my + y) && p.g(mx + x, my + y - 1) !== undefined) p.p(mx + x, my + y, e < 0.4 ? PAL.musgo[4] : e < 0.8 ? PAL.musgo[3] : PAL.musgo[2]);
      }
    }
    if (marcada) { p.sello(10, 11, ["o...o", ".o.o.", "..o..", ".o.o.", "o...o"], { o: "#cfe0ff" }); }
    p.contorno(AUTO);
    return p.canvas();
  });
}
/** Las matas de hongos (lo que se rompe a lágrimazos): 4 = entera … 1 = un tronquito, 0 = nada. */
function matasSpr(vida, tipo = 0) {
  return hornear(`matas${vida}${tipo}`, () => {
    const p = new Pix(26, 26), cap = tipo === 1 ? PAL.oro.slice(0, 5) : ["#261a10", "#4d3421", "#7a5636", "#a8835a", "#cdb08a"];
    const tallo = PAL.crema, hongos = [[8, 12, 6, 4.5], [17, 10, 5.5, 4], [12, 16, 5, 3.6], [19, 17, 3.6, 2.8]].slice(0, Math.max(0, vida));
    // los tallos primero
    for (const [x, y, rx] of hongos) p.caja(Math.round(x - rx * 0.35), Math.round(y), Math.max(2, Math.round(rx * 0.7)), 6, tallo.slice(0, 4), { vertical: 0.1 });
    for (const [x, y, rx, ry] of hongos) {
      p.bola(x, y, rx, ry, cap, { filtro: (X, Y) => Y <= y + 1, luz: [-0.5, -0.8, 0.4] });
      p.p(x - rx * 0.4, y - ry * 0.4, cap[4]);
      for (let X = Math.floor(x - rx); X <= x + rx; X++) if (p.g(X, Math.floor(y + 1))) p.p(X, Math.floor(y + 1), cap[1]);
    }
    if (vida <= 1) { p.caja(9, 18, 8, 4, PAL.tierra.slice(1, 5)); p.sello(10, 17, ["c.c..c", "cccccc"], { c: tallo[2] }); }
    p.contorno(AUTO);
    return p.canvas();
  });
}
function braseroSpr(k, prendido) {
  return hornear(`brasero${k}${prendido}`, () => {
    const p = new Pix(24, 30);
    // la llama: 4 cuadros que titilan
    if (prendido) {
      const alto = [11, 13, 12, 14][k], anch = [5, 4.5, 5.3, 4.2][k];
      p.bola(12, 14 - alto * 0.3, anch, alto * 0.62, PAL.fuego, { luz: [0, 0.9, 0.3], bajar: -0.2, filtro: (x, y) => y > 14 - alto || Math.abs(x - 12) < 2 });
      p.bola(12, 15, anch * 0.5, alto * 0.3, [PAL.fuego[3], PAL.fuego[4], "#fff7d0"], { trama: 0.3 });
      for (let i = 0; i < 3; i++) p.p(9 + ((k * 3 + i * 5) % 7), 2 + ((k + i * 2) % 5), PAL.fuego[3]);
    }
    // el cuenco de hierro con patas
    p.bola(12, 19, 8, 4, PAL.hierro, { luz: [-0.4, -0.8, 0.4] });
    p.rect(5, 19, 15, 1, PAL.hierro[4]);
    p.caja(7, 22, 2, 6, PAL.hierro.slice(0, 3)); p.caja(15, 22, 2, 6, PAL.hierro.slice(0, 3)); p.caja(11, 22, 2, 7, PAL.hierro.slice(1, 4));
    if (prendido) for (let x = 6; x < 19; x++) if (bayer(x, 18) > 0) p.p(x, 18, PAL.fuego[2]);
    p.contorno(AUTO);
    return p.canvas();
  });
}
function pinchosSpr(arriba) {
  return hornear(`pinchos${arriba}`, () => {
    const p = new Pix(24, 24);
    p.rect(2, 2, 20, 20, "#1a1c1c"); p.rect(3, 3, 18, 18, "#232626");
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const X = 5 + x * 7, Y = 6 + y * 6;
      if (arriba) p.sello(X - 1, Y - 3, [".h.", ".H.", "hHk", "HHk"], { h: PAL.hueso[4], H: PAL.hueso[2], k: PAL.hueso[1] });
      else p.rect(X, Y, 2, 1, "#0a0b0b");
    }
    return p.canvas();
  });
}
function barrilSpr() {
  return hornear("barril", () => {
    const p = new Pix(22, 24);
    p.bola(11, 13, 8.5, 10, PAL.tierra.slice(1), { luz: [-0.7, -0.2, 0.6], bajar: 0.2 });
    for (const y of [5, 12, 20]) for (let x = 2; x < 21; x++) if (p.g(x, y)) { p.p(x, y, PAL.hierro[2]); if (p.g(x, y + 1)) p.p(x, y + 1, PAL.hierro[1]); }
    p.bola(11, 4, 6.5, 2.2, PAL.tierra.slice(2), { luz: [-0.3, -0.9, 0.3] });
    p.sello(7, 12, [".ggg.", "g.g.g", ".ggg."], { g: PAL.baba[4] });
    p.contorno(AUTO);
    return p.canvas();
  });
}
function bloqueSpr() {
  return hornear("bloque", () => {
    const p = new Pix(24, 26);
    p.caja(1, 5, 22, 20, PAL.hierro, { vertical: 0.6 }); p.caja(1, 1, 22, 5, PAL.hierro.slice(2), { vertical: 0.9 });
    for (const [x, y] of [[3, 8], [19, 8], [3, 21], [19, 21]]) { p.p(x, y, PAL.hierro[4]); p.p(x + 1, y + 1, PAL.hierro[0]); }
    p.rect(1, 5, 22, 1, PAL.hierro[4]);
    p.contorno(AUTO);
    return p.canvas();
  });
}
/** Un pozo: la baldosa entera negra, con el borde de arriba iluminado y la pared del pozo. */
function pozoSpr(arriba, izq, der, abajo) {
  return hornear(`pozo${+arriba}${+izq}${+der}${+abajo}`, () => {
    const p = new Pix(24, 24);
    p.rect(0, 0, 24, 24, "#020203");
    if (!arriba) { p.caja(0, 0, 24, 6, ["#0a0808", "#1a1614", "#2b2522"], { vertical: 1 }); p.rect(0, 0, 24, 1, "#4a423c"); }
    if (!izq) p.rect(0, 0, 1, 24, "#1c1917");
    if (!der) p.rect(23, 0, 1, 24, "#141211");
    if (!abajo) p.rect(0, 23, 24, 1, "#0e0c0b");
    return p.canvas();
  });
}

// ── los recogibles ──
function corazonSpr(tipo /* rojo, medio, espora, esporaMedio, vacio */, chico = false) {
  return hornear(`cor${tipo}${chico}`, () => {
    const forma = chico ? [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."] : [".xxx.xxx.", "xxxxxxxxx", "xxxxxxxxx", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "...xxx...", "....x...."];
    const w = forma[0].length, h = forma.length, p = new Pix(w + 2, h + 2);
    const R = tipo.startsWith("espora") ? PAL.azul : PAL.sangre;
    const medio = tipo.endsWith("edio"), vacio = tipo === "vacio";
    forma.forEach((f, y) => { for (let x = 0; x < w; x++) if (f[x] === "x") {
      const l = 1 - (y / h) * 0.9 - (x / w) * 0.25;
      let c = vacio ? "#26161a" : R[lim(Math.floor(l * 4 + bayer(x, y) * 0.5) + 1, 1, 4)];
      if (medio && x >= w / 2) c = "#26161a";
      p.p(x + 1, y + 1, c);
    } });
    if (!vacio) { p.p(2, 2, "#fff0ec"); if (!chico) p.p(3, 2, R[4]); }
    p.contorno(AUTO);
    return p.canvas();
  });
}
function monedaSpr(k, valor = 1) {
  return hornear(`moneda${k}${valor}`, () => {
    const R = valor === 5 ? PAL.hueso : PAL.oro, p = new Pix(11, 11), w = [4, 3, 1.4, 3][k];
    p.bola(5.5, 5.5, w, 4.4, R.slice(1), { trama: 0.5 });
    if (w > 2) { p.rect(5, 3, 1, 5, R[1]); p.p(4, 3, R[4]); }
    p.contorno(AUTO);
    return p.canvas();
  });
}
function bombaSpr(tamano = 1, prendida = false, k = 0) {
  return hornear(`bomba${tamano}${prendida}${k}`, () => {
    const p = new Pix(16, 18), r = 5.4 * tamano;
    p.bola(8, 11, r, r * 0.95, ["#0b0a0d", "#1b1a22", "#2e2d3a", "#4a4960", "#7f7ea0"], { luz: [-0.6, -0.6, 0.5] });
    p.rect(7, 4, 3, 2, PAL.hierro[3]);
    p.linea(8, 3, 10, 1, PAL.crema[2]);
    if (prendida) { p.p(10 + (k % 2), 0, PAL.fuego[4]); p.p(11, 1, PAL.fuego[3]); p.p(9, 0, k % 2 ? PAL.fuego[2] : null); }
    p.p(5, 8, "#bfbfe0");
    p.contorno(AUTO);
    return p.canvas();
  });
}
function llaveSpr() {
  return hornear("llave", () => {
    const p = new Pix(8, 14);
    p.sello(0, 0, [".hhh.", "h...h", "h...h", ".hhh.", "..h..", "..h..", "..hh.", "..h..", "..hh.", "..h.."], { h: PAL.hueso[3] });
    p.p(1, 1, PAL.hueso[4]); p.p(2, 4, PAL.hueso[2]);
    p.contorno(AUTO);
    return p.canvas();
  });
}
function cofreSpr(dorado, abierto) {
  return hornear(`cofre${dorado}${abierto}`, () => {
    const p = new Pix(20, 17), madera = dorado ? PAL.oro.slice(1) : PAL.tierra.slice(2), herraje = dorado ? PAL.hueso.slice(2) : PAL.hierro.slice(2);
    p.caja(1, 7, 18, 9, madera, { vertical: 0.6 });
    if (abierto) { p.caja(1, 1, 18, 5, madera.map((c) => mezclar(c, "#000000", 0.35)), { vertical: 0.6 }); p.rect(2, 7, 16, 2, "#0b0608"); }
    else { p.bola(10, 7, 9, 4.5, madera, { filtro: (x, y) => y <= 7, luz: [-0.4, -0.9, 0.3] }); }
    for (const x of [4, 15]) p.caja(x, abierto ? 7 : 3, 2, abierto ? 9 : 13, herraje);
    if (!abierto) p.sello(8, 7, ["kkkk", "kOOk", "kOOk"], { k: PAL.tinta, O: dorado ? PAL.hueso[4] : PAL.oro[3] });
    p.contorno(AUTO);
    return p.canvas();
  });
}
const COLORES_CAPSULA = [["#e84a3c", "#f2efe8"], ["#3f78e0", "#f2efe8"], ["#f2c43a", "#9a5bd6"], ["#4ec46a", "#f2efe8"], ["#1b1b22", "#e84a3c"], ["#f28ab0", "#5ad3d8"], ["#f2efe8", "#f2efe8"], ["#e08a3a", "#3a2a1a"]];
function capsulaSpr(i) {
  return hornear(`capsula${i}`, () => {
    const [a, b] = COLORES_CAPSULA[i % COLORES_CAPSULA.length], p = new Pix(12, 8);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) {
      const nx = (x - 4) / 4.5, ny = (y - 2) / 2.5; if (Math.abs(nx) + ny * ny * 0.9 > 1.2) continue;
      const c = x < 4.5 ? a : b, sh = y < 1 ? 0.35 : y > 3 ? -0.35 : 0;
      p.p(x + 1, y + 1, sh > 0 ? mezclar(c, "#ffffff", sh) : sh < 0 ? mezclar(c, "#000000", -sh) : c);
    }
    p.p(3, 2, "#ffffff");
    p.contorno(AUTO);
    return p.canvas();
  });
}
function pedestalSpr() {
  return hornear("pedestal", () => {
    const p = new Pix(22, 18);
    p.caja(3, 4, 16, 12, PAL.piedra.slice(1), { vertical: 0.3 });
    p.bola(11, 4, 9, 3, PAL.piedra.slice(2), { luz: [-0.3, -0.9, 0.3] });
    p.rect(2, 15, 18, 2, PAL.piedra[1]);
    for (let y = 6; y < 15; y += 3) p.p(5 + (y % 2), y, PAL.piedra[1]);
    p.contorno(AUTO);
    return p.canvas();
  });
}
function trampillaSpr(abierta) {
  return hornear(`trampilla${abierta}`, () => {
    const p = new Pix(28, 28);
    p.bola(14, 14, 12, 11, ["#010101", "#050404", "#0b0908"], { trama: 0.4 });
    for (let a = 0; a < 16; a++) { const an = a / 16 * TAU, x = 14 + Math.cos(an) * 12, y = 14 + Math.sin(an) * 11; p.p(x, y, PAL.tierra[a % 2 ? 2 : 3]); }
    if (!abierta) { p.caja(4, 6, 20, 16, PAL.tierra.slice(1, 5), { vertical: 0.4 }); for (let y = 8; y < 22; y += 4) p.linea(4, y, 23, y, PAL.tierra[1]); }
    p.contorno(AUTO);
    return p.canvas();
  });
}

/** El corazón del HUD, medido en el video: 13×12 con contorno, rojo vivo, la base más oscura y el
 *  brillo arriba a la izquierda. tipo: rojo, medio, espora, esporaMedio, vacio. */
function corazonHudSpr(tipo) {
  return hornear(`corHud${tipo}`, () => {
    const forma = [".####.####.", "###########", "###########", "###########", ".#########.", "..#######..", "...#####...", "....###....", ".....#....."];
    const p = new Pix(13, 11), esp = tipo.startsWith("espora"), medio = tipo.endsWith("edio"), vacio = tipo === "vacio";
    const R = esp ? ["#1c3a8c", "#2c5ad8", "#4a86ff", "#bcd6ff"] : ["#8a0a10", "#d01018", "#f02a30", "#ffb0b0"];
    forma.forEach((f, y) => { for (let x = 0; x < 11; x++) {
      if (f[x] !== "#") continue;
      let c = vacio ? "#2a1418" : y >= 6 ? R[0] : y >= 4 ? R[1] : R[2];
      if (!vacio && medio && x >= 5.5) c = "#2a1418";
      p.p(x + 1, y + 1, c);
    } });
    if (!vacio) { p.p(2, 2, "#ffffff"); p.p(3, 2, R[3]); p.p(2, 3, R[3]); }
    p.contorno(AUTO, true);
    return p.canvas();
  });
}
/** La calavera de la barra del jefe (medida: 16×17 px, gris clara con los ojos negros). */
function calaveraJefeSpr() {
  return hornear("calaveraJefe", () => {
    const p = new Pix(16, 16);
    p.bola(8, 6.5, 6.6, 5.8, ["#6e6660", "#a09892", "#c8c0ba", "#e6e0da"], { luz: [-0.4, -0.7, 0.5], trama: 0.5 });
    p.rect(4, 10, 8, 3, "#b0a8a2"); p.rect(4, 12, 8, 1, "#8a827c");
    for (const x of [6, 9]) p.rect(x, 11, 1, 3, "#3a3432");
    for (const x of [4, 9]) { p.rect(x, 5, 3, 3, PAL.tinta); p.p(x, 5, "#3a3432"); }
    p.p(7, 9, PAL.tinta); p.p(8, 9, PAL.tinta);
    p.contorno(AUTO, true);
    return p.canvas();
  });
}
