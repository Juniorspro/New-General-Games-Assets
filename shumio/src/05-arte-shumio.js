// ─────────────────────────────────────────────────────────────────────────────
// SHUMIO: un chico-hongo. Cabeza grande y pálida (como los personajes de este género: la cabeza
// es la que llora y apunta), un sombrero de hongo rojo con manchas crema, ojos grandes y
// húmedos, túnica de musgo. La cabeza y el cuerpo van separados: la cabeza mira hacia donde
// llorás, el cuerpo hacia donde caminás.
// ─────────────────────────────────────────────────────────────────────────────

const CAB_W = 22, CAB_H = 22, CUE_W = 14, CUE_H = 12;
const TINTA = PAL.tinta;

/** vista: "frente" | "espalda" | "lado" (mirando a la derecha). gesto: 0 normal, 1 llorando (tira), 2 parpadeo, 3 dolor. */
function pintarCabeza(vista, gesto, pielR = PAL.piel, gorroR = PAL.hongo) {
  const p = new Pix(CAB_W, CAB_H);
  // Todo simétrico alrededor del centro de la cabeza: x = 10.5 en píxeles (la bola va de 1 a 20).
  const CX = 11;
  p.bola(CX, 13.7, vista === "lado" ? 9.0 : 9.4, 8.1, pielR, { luz: [-0.4, -0.55, 0.73], bajar: 0.22, trama: 0.55 });
  // El sombrero: el casquete de un hongo, centrado sobre la cabeza (de costado también: el ala
  // sobresale lo mismo adelante y atrás). El ala es una curva limpia, apenas caída en las puntas.
  const gy = vista === "espalda" ? 8.1 : 7.2, gry = vista === "espalda" ? 7.2 : 6.4;
  const alaY = (x) => Math.round(gy + 2.2 + 1.4 * Math.pow((x + 0.5 - CX) / 10, 2));
  p.bola(CX, gy, 10.2, gry, gorroR, { filtro: (x, y) => y <= alaY(x), luz: [-0.5, -0.7, 0.5], bajar: 0.1, trama: 0.7 });
  for (let x = 0; x < CAB_W; x++) {
    const y = alaY(x);
    if (!p.g(x, y)) continue;
    p.p(x, y, gorroR[1]);                                        // el canto del ala
    if (vista !== "espalda" && p.g(x, y + 1) && x > 2 && x < CAB_W - 3) p.p(x, y + 1, pielR[1]);   // la sombra en la frente
  }
  // las manchas: cada una con su luz arriba a la izquierda y su sombra abajo a la derecha
  const manchas = vista === "espalda" ? [[4, 6, 3], [10, 3, 3], [15, 6, 2], [8, 9, 2], [16, 10, 1]]
    : vista === "lado" ? [[3, 6, 2], [9, 3, 3], [15, 5, 2], [12, 8, 1], [6, 9, 1]]
    : [[4, 5, 2], [9, 2, 3], [15, 4, 2], [12, 7, 1], [6, 8, 1]];
  for (const [x, y, t] of manchas) {
    if (!p.g(x, y) || y >= alaY(x)) continue;
    const m = t === 3 ? [".cc.", "cCCd", ".dd."] : t === 2 ? ["cc", "Cd"] : ["c"];
    p.sello(x, y, m, { c: PAL.crema[3], C: PAL.crema[2], d: PAL.crema[1] });
  }
  const K = TINTA, pal = { e: K, W: "#ffffff", h: "#4f6c7a", t: PAL.espora[3] };
  if (vista === "frente") {
    // los ojos: la MISMA forma los dos (simétricos), y el brillo arriba a la izquierda en los dos (la luz)
    const ojo = gesto === 1 || gesto === 2 ? ["....", "eeee", ".tt."]
      : gesto === 3 ? ["e..e", ".ee.", "e..e"]
      : gesto === 4 ? ["....", ".ee.", "e..e"]                       // contento: los ojos cerrados en arco
      : gesto === 5 ? ["....", "eeee", "eWee", "eeee", ".ee."]        // triste: los párpados caídos
      : [".ee.", "eWee", "eeee", "eeeh", ".ee."];
    p.sello(5, 13, ojo, pal); p.sello(13, 13, ojo, pal);        // 5..8 y 13..16: centro 10.5
    p.p(4, 18, "#d99a90"); p.p(17, 18, "#d99a90");               // los cachetes (4 y 17)
    // la boca, de 2 px (10 y 11), centrada
    if (gesto === 1) p.sello(9, 18, [".kk.", "kmmk", ".kk."], { k: K, m: "#6a2c30" });
    else if (gesto === 3) p.sello(9, 18, [".kk.", "kmmk"], { k: K, m: "#6a2c30" });
    else if (gesto === 4) p.sello(8, 18, ["k....k", ".kmmk.", "..kk.."], { k: K, m: "#b04a50" });
    else if (gesto === 5) p.sello(9, 19, [".kk.", "k..k"], { k: K });
    else p.sello(10, 19, ["kk"], { k: "#5a3034" });
    // las esporas que le caen de los ojos (6 y 15: debajo del segundo píxel de cada ojo, espejados)
    if (gesto !== 3) { p.p(6, 18, PAL.espora[3]); p.p(15, 18, PAL.espora[3]); if (gesto === 1) { p.p(6, 19, PAL.espora[2]); p.p(15, 19, PAL.espora[2]); } }
  } else if (vista === "lado") {
    const ojo = gesto === 1 || gesto === 2 ? ["...", "eee", ".t."] : gesto === 3 ? ["e.e", ".e.", "e.e"] : [".e.", "eWe", "eee", "eeh", ".e."];
    p.sello(15, 13, ojo, pal);
    // (de costado sin cachete: pegado al contorno se lee como una mancha en la mandíbula)
    if (gesto === 1) p.sello(17, 18, ["k", "m", "k"], { k: K, m: "#6a2c30" }); else p.p(17, 19, "#5a3034");
    if (gesto !== 3) { p.p(16, 18, PAL.espora[3]); if (gesto === 1) p.p(16, 19, PAL.espora[2]); }
  } else {
    // de espaldas: la nuca con un poco más de sombra abajo
    for (let x = 4; x < 18; x++) if (p.g(x, 20) && p.g(x, 21)) p.p(x, 20, pielR[1]);
  }
  p.contorno(K);
  return p;
}

/** El cuerpo: túnica de musgo, bracitos y piernas. vista frente/espalda/lado; paso 0..3. */
function pintarCuerpo(vista, paso, tunicaR = PAL.musgo, pielR = PAL.piel) {
  const p = new Pix(CUE_W, CUE_H);
  const pierna = [0, 1, 0, -1][paso];
  if (vista === "lado") {
    // piernas: una adelante y otra atrás según el paso
    const a = [2, 0, -2, 0][paso];
    p.caja(6 + a, 7, 2, 4, [pielR[1], pielR[2], pielR[3]]); p.p(6 + a, 10, pielR[0]); p.p(7 + a, 10, pielR[0]); p.p(8 + a, 10, TINTA);
    p.caja(6 - a, 7, 2, 4, [pielR[0], pielR[1], pielR[2]]); p.p(6 - a, 10, pielR[0]); p.p(7 - a, 10, TINTA);
    p.bola(7, 5, 3.9, 3.8, tunicaR, { bajar: 0.1 });
    // el brazo que se balancea
    const b = [-1, 0, 1, 0][paso];
    p.caja(7 + b, 4, 2, 3, [pielR[2], pielR[3]]);
    // el cinturón de raíz
    for (let x = 3; x < 11; x++) if (p.g(x, 6)) p.p(x, 6, PAL.tierra[2]);
  } else {
    const l = pierna, r = -pierna;
    p.caja(4, 7 + Math.max(0, l), 2, 4 - Math.max(0, l), [pielR[1], pielR[2], pielR[3]]);
    p.caja(8, 7 + Math.max(0, r), 2, 4 - Math.max(0, r), [pielR[1], pielR[2], pielR[3]]);
    p.p(4, 10, pielR[0]); p.p(5, 10, pielR[0]); p.p(8, 10, pielR[0]); p.p(9, 10, pielR[0]);
    p.bola(7, 4.6, 4.7, 4.0, tunicaR, { bajar: 0.12 });
    // los bracitos a los costados, que se mueven al caminar
    p.caja(1, 3 + Math.max(0, r), 2, 3, [pielR[1], pielR[2], pielR[3]]);
    p.caja(11, 3 + Math.max(0, l), 2, 3, [pielR[1], pielR[2], pielR[3]]);
    for (let x = 3; x < 12; x++) if (p.g(x, 6) && p.g(x, 6) !== pielR[1]) p.p(x, 6, PAL.tierra[2]);
    if (vista === "frente") { p.p(7, 3, tunicaR[4]); p.p(6, 2, tunicaR[3]); p.p(7, 6, PAL.oro[3]); }   // la hebilla
    else { for (let y = 1; y < 6; y++) if (p.g(7, y)) p.p(7, y, tunicaR[1]); }                          // la costura de atrás
  }
  p.contorno(AUTO);
  return p;
}

/** La pose de levantar un objeto (medida en el original: de frente, los dos brazos estirados
 *  arriba, a los costados de la cabeza, y el objeto sobre las manos): el cuerpo sin los bracitos
 *  y los brazos aparte, que se dibujan encima de la cabeza. */
function pintarCuerpoLevanta(tunicaR = PAL.musgo, pielR = PAL.piel) {
  const p = new Pix(CUE_W, CUE_H);
  p.caja(4, 7, 2, 4, [pielR[1], pielR[2], pielR[3]]); p.caja(8, 7, 2, 4, [pielR[1], pielR[2], pielR[3]]);
  p.p(4, 10, pielR[0]); p.p(5, 10, pielR[0]); p.p(8, 10, pielR[0]); p.p(9, 10, pielR[0]);
  p.bola(7, 4.6, 4.7, 4.0, tunicaR, { bajar: 0.12 });
  for (let x = 3; x < 12; x++) if (p.g(x, 6)) p.p(x, 6, PAL.tierra[2]);
  p.p(7, 3, tunicaR[4]); p.p(6, 2, tunicaR[3]); p.p(7, 6, PAL.oro[3]);
  p.contorno(AUTO);
  return p;
}
function pintarBrazosArriba(pielR = PAL.piel) {
  // 30 × 26: bracitos gorditos que salen del hombro (y 23), abren el codo hacia afuera y terminan
  // con la mano redonda arriba, sobre el ala del sombrero (y 4)
  const p = new Pix(30, 26), R = [pielR[1], pielR[2], pielR[3], pielR[4]];
  for (const lado of [-1, 1]) {
    const x0 = 15 + lado * 6, y0 = 23, xc = 15 + lado * 14, yc = 15, x1 = 15 + lado * 11, y1 = 5;
    for (let t = 0; t <= 1; t += 0.04) {
      const x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * xc + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * yc + t * t * y1;
      p.bola(x, y, 1.7, 1.7, R, { luz: [-0.5 * lado, -0.6, 0.6] });
    }
    p.bola(x1, y1 - 1, 2.6, 2.4, R, {});   // la mano
  }
  p.contorno(AUTO);
  return p;
}
/** Los sprites de Shumio, horneados: cabezas por vista y gesto, cuerpos por vista y paso. */
function spritesShumio(pielR = PAL.piel, gorroR = PAL.hongo, tunicaR = PAL.musgo, clave = "shumio") {
  return hornear(clave, () => {
    const s = { cab: {}, cue: {} };
    for (const v of ["frente", "espalda", "lado"]) {
      s.cab[v] = [0, 1, 2, 3, 4, 5].map((g) => pintarCabeza(v, v === "frente" || g < 4 ? g : 0, pielR, gorroR).canvas());
      s.cab[v + "I"] = [0, 1, 2, 3, 4, 5].map((g) => pintarCabeza(v, v === "frente" || g < 4 ? g : 0, pielR, gorroR).espejo().canvas());
      s.cue[v] = [0, 1, 2, 3].map((k) => pintarCuerpo(v, k, tunicaR, pielR).canvas());
      if (v === "frente") { s.levanta = pintarCuerpoLevanta(tunicaR, pielR).canvas(); s.brazos = pintarBrazosArriba(pielR).canvas(); }
      s.cue[v + "I"] = [0, 1, 2, 3].map((k) => pintarCuerpo(v, k, tunicaR, pielR).espejo().canvas());
    }
    return s;
  });
}

// ── las lágrimas (esporas) ──
const COLOR_LAGRIMA = {
  espora: PAL.espora, sangre: PAL.sangre, veneno: ["#0f200c", "#255a1c", "#44922c", "#86d04a", "#d8ff9a"],
  violeta: PAL.violeta, hielo: PAL.hielo, fuego: PAL.fuego, oro: PAL.oro, hueso: PAL.hueso, enemigo: ["#1a0306", "#4a0a10", "#8e1a1e", "#d0392f", "#ff8b6a"],
  moho: PAL.baba, tinta: ["#050305", "#1a1320", "#2f2638", "#4d4260", "#7a6c90"],
  // los colores de las lágrimas de los objetos, tomados de las imágenes de la wiki (sus "tears")
  ouija: ["#1a2228", "#4a5a62", "#7a9aa4", "#a8c4cc", "#e0f0f4"], sagrado: ["#1a2a2e", "#8ab8bc", "#b8dcdc", "#d8ecec", "#ffffff"],
  carbon: ["#050508", "#141820", "#1e2430", "#2e3644", "#5a6270"], hemo: ["#2a0204", "#9a0a10", "#e01a1a", "#ff4a3a", "#ffffff"],
  choco: ["#120806", "#3a1c12", "#5a2e1e", "#7a4630", "#a8704e"], rosa: ["#200408", "#6a1022", "#a01e3c", "#c83a58", "#f08aa0"],
  perfume: ["#2a2a06", "#8a8a2a", "#c8d468", "#e0ec90", "#fffff0"], oscura: ["#000000", "#0a0a0e", "#141418", "#26262c", "#4a4a54"],
  llama: ["#3a0c04", "#c04010", "#f07a2a", "#ffb060", "#ffffff"], resfrio: ["#0a2018", "#2a6a4a", "#4a9a70", "#7ac8a0", "#c8f0dc"],
  liquido: ["#0a2a0a", "#2a8a2a", "#5ad05a", "#a0ff90", "#ffffff"], gris: ["#0a0a0a", "#3a3a3a", "#5a5a5a", "#8a8a8a", "#d0d0d0"],
  parasito: ["#200c04", "#6a3010", "#a0582a", "#c0784a", "#f0b080"], blanco: ["#101010", "#4a4a4a", "#9a9a9a", "#d8d8d8", "#ffffff"],
  urano: ["#0a1a30", "#4a70b8", "#8ab0f0", "#c0d8ff", "#ffffff"], piscis: ["#0a1a3a", "#1a4a8a", "#3a7ad0", "#7ab0f0", "#e0f0ff"],
  soja: ["#40403a", "#a8a8a0", "#d8d8d0", "#f0f0e8", "#ffffff"], almendra: ["#3a2a1a", "#a88a6a", "#d8c0a0", "#f0e0c8", "#fffaf0"],
  electrica: ["#062a3a", "#1a7ab0", "#5ac8f0", "#b0f0ff", "#ffffff"], cupido: ["#0a0a14", "#5a7ad0", "#9ab8f8", "#c8dcff", "#ffffff"],
};
/** Una lágrima con forma (la flecha de Cupido, el carámbano de Urano), mirando a la derecha: se rota al dibujar. */
function lagrimaFormaSpr(forma, r, color) {
  r = lim(Math.round(r), 2, 10);
  return hornear(`lagForma${forma}${color}${r}`, () => {
    const R = COLOR_LAGRIMA[color] || PAL.espora, L = forma === "carambano" ? r * 4 + 2 : r * 3 + 2, H = r * 2 + 3, p = new Pix(L, H), c = H / 2;
    for (let x = 0; x < L; x++) for (let y = 0; y < H; y++) {
      const u = x / (L - 1);
      // carámbano: gordo atrás y en punta adelante; flecha: cuerpo redondo con la punta triangular
      const ancho = forma === "carambano" ? r * (1 - u) * 1.1 + 0.3 : u < 0.6 ? r * Math.sqrt(1 - Math.pow((u - 0.3) / 0.32, 2)) : r * 1.1 * (1 - (u - 0.6) / 0.4);
      const d = Math.abs(y + 0.5 - c);
      if (!(ancho > 0) || d > ancho) continue;
      const l = 1 - (y + 0.5 - (c - ancho)) / (2 * ancho + 0.01);
      p.p(x, y, R[lim(Math.round(1 + l * 2.6), 1, 4)]);
    }
    p.p(Math.round(L * 0.35), Math.round(c - r * 0.45), R[4]);
    p.contorno(R[0]);
    return p.canvas();
  });
}
/** Una lágrima de radio r (2..9) y color. Con un brillo arriba a la izquierda y el contorno oscuro. */
function lagrimaSpr(r, color = "espora") {
  r = lim(Math.round(r), 2, 10);
  return hornear(`lag${color}${r}`, () => {
    const rampa = COLOR_LAGRIMA[color] || PAL.espora, s = r * 2 + 3, p = new Pix(s, s), c = s / 2;
    p.bola(c, c, r + 0.3, r + 0.3, rampa.slice(1), { luz: [-0.55, -0.6, 0.58], bajar: 0.05, trama: 0.6 });
    if (r >= 3) { p.p(Math.floor(c - r * 0.45), Math.floor(c - r * 0.5), rampa[4]); if (r >= 5) p.p(Math.floor(c - r * 0.45) + 1, Math.floor(c - r * 0.5), rampa[4]); }
    p.contorno(rampa[0]);
    return p.canvas();
  });
}
/** El chapoteo de una lágrima que se rompe: 5 cuadros. */
function chapoteoSpr(color = "espora", k) {
  return hornear(`chap${color}${k}`, () => {
    const rampa = COLOR_LAGRIMA[color] || PAL.espora, p = new Pix(17, 17), c = 8;
    const r = 2 + k * 1.3;
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + k * 0.2, d = r + (i % 2) * 1.2;
      const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d * 0.8;
      if (k < 4) p.p(x, y, rampa[k < 2 ? 3 : 2]);
      if (k < 2) p.p(x + Math.cos(a), y + Math.sin(a) * 0.8, rampa[2]);
    }
    if (k < 3) p.bola(c, c, 3 - k, 2.4 - k * 0.7, rampa.slice(1), { trama: 0.3 });
    return p.canvas();
  });
}
