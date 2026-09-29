// ─────────────────────────────────────────────────────────────────────────────
// EL ARTE DE LOS ENEMIGOS Y LOS JEFES. Criaturas del subsuelo, cada una con su silueta: la
// forma se lee antes que el color. Simétricas donde miran de frente (se dibujan con el eje en
// x.5 y los detalles espejados), y con el brillo siempre arriba a la izquierda.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centrar a pixel exacto. c es el centro CONTINUO del cuerpo (la bola de centro 10.5 cubre los píxeles
 * 0..20: su píxel del medio es el 10). Un sello de ancho w queda centrado si empieza en c - w/2, y eso
 * tiene que ser entero: con centro x.5 van sellos de ancho impar, con centro entero, de ancho par.
 * Si no da exacto, avisa (así no queda nada "corrido medio píxel").
 */
function selloC(p, c, y, filas, pal) {
  const w = filas[0].length, x0 = c - w / 2;
  if (x0 !== Math.floor(x0)) console.warn("sello corrido medio píxel:", filas[0], "centro", c);
  p.sello(Math.floor(x0), y, filas, pal);
}
/**
 * Un par de ojos simétricos: la forma del derecho es el espejo del izquierdo, pero el BRILLO (W) queda
 * en el mismo lugar en los dos (la luz viene de arriba a la izquierda para los dos ojos).
 * gap: del centro al borde de adentro de cada ojo.
 */
function parDeOjos(p, c, gap, y, filas, pal) {
  const w = filas[0].length, xi = c - gap - w, xd = c + gap;
  if (xi !== Math.floor(xi)) console.warn("ojos corridos medio píxel:", filas[0], "centro", c, "gap", gap);
  const base = pal.e ? "e" : Object.keys(pal).find((k) => k !== "W");
  filas.forEach((f, dy) => {
    for (let i = 0; i < w; i++) {
      const ch = f[i];
      if (ch === "." || !pal[ch]) continue;
      p.p(xi + i, y + dy, pal[ch]);                                   // el izquierdo, tal cual
      p.p(xd + (w - 1 - i), y + dy, pal[ch === "W" ? base : ch]);    // el derecho, espejado (sin el brillo)
    }
    for (let i = 0; i < w; i++) if (f[i] === "W") p.p(xd + i, y + dy, pal.W);   // el brillo, en el mismo lugar
  });
}
const OJO_PAL = { e: PAL.tinta, W: "#ffffff", r: "#e8312a", R: "#ff8a6a", y: "#f2d64a", k: PAL.tinta, b: "#2b0a0e", t: PAL.hueso[4], m: "#4a0d14" };

// ── Mosquín: una mosca gorda del sótano. 2 cuadros de alas. rabioso = rojo, te persigue ──
function mosquinSpr(k, rabioso = false) {
  return hornear(`mosquin${k}${rabioso}`, () => {
    const p = new Pix(15, 14), cuerpo = rabioso ? ["#1c0506", "#3f0b0d", "#6e1a18", "#9c3326"] : ["#0d100c", "#1e241b", "#343c2e", "#4f5944"];
    // las alas (atrás del cuerpo): arriba o abajo según el cuadro
    const ala = k === 0 ? ["..aa.", ".aAAa", "aAAa.", ".aa.."] : ["....", ".aa.", "aAAa", ".aAa"];
    // las alas: la derecha es el espejo exacto de la izquierda (alrededor del píxel 7)
    const alaI = k === 0 ? ["..aa.", ".aAAa", "aAAa.", ".aa.."] : ["....", ".aa.", "aAAa", ".aAa"];
    p.sello(1, k === 0 ? 1 : 3, alaI, { a: "#8a9693", A: "#c9d2cf" });
    p.sello(14 - alaI[0].length, k === 0 ? 1 : 3, alaI.map((f) => [...f].reverse().join("")), { a: "#8a9693", A: "#c9d2cf" });
    p.bola(7.5, 8.5, 4, 3.6, cuerpo, { luz: [-0.4, -0.7, 0.5] });
    // las rayas del abdomen (espejadas: 6 y 8) y los ojos
    p.p(6, 10, cuerpo[0]); p.p(8, 10, cuerpo[0]);
    parDeOjos(p, 7.5, 0.5, 6, ["We", "ee"], { e: rabioso ? "#ff4a3a" : "#c9392f", W: rabioso ? "#ffd0a0" : "#ff9a86" });
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── Hongón: un muerto con cabeza de hongo que camina hacia vos, boca abierta, ojos vacíos ──
function hongonSpr(k, sinGorro = false) {
  return hornear(`hongon${k}${sinGorro}`, () => {
    const p = new Pix(21, 26), piel = ["#3b3130", "#6a5a55", "#9a8a80", "#c2b3a4", "#ddd0c0"], capR = ["#1c130d", "#3b2a1c", "#5e442c", "#86643f", "#a88558"];
    // las piernas (4 cuadros)
    const a = [1, 0, -1, 0][k];
    p.caja(6, 19 + Math.max(0, a), 3, 6 - Math.max(0, a), piel.slice(0, 3)); p.caja(12, 19 + Math.max(0, -a), 3, 6 - Math.max(0, -a), piel.slice(0, 3));
    // el cuerpo flaco, con los brazos caídos adelante
    p.bola(10.5, 16.5, 5.4, 4.8, ["#171513", "#2c2723", "#453c35", "#5f544a"], { bajar: 0.1 });
    p.caja(3, 14 + (a > 0 ? 1 : 0), 2, 6, piel.slice(0, 4)); p.caja(16, 14 + (a < 0 ? 1 : 0), 2, 6, piel.slice(0, 4));
    // la cabeza
    p.bola(10.5, 9.5, 6.6, 5.8, piel, { luz: [-0.4, -0.5, 0.7], trama: 0.5 });
    if (!sinGorro) {
      const ala = (x) => Math.round(6.6 + 1.2 * Math.pow((x + 0.5 - 10.5) / 9, 2));
      p.bola(10.5, 5, 9.4, 5.2, capR, { filtro: (x, y) => y <= ala(x), luz: [-0.5, -0.7, 0.5], trama: 0.7 });
      for (let x = 0; x < 21; x++) { const y = ala(x); if (p.g(x, y)) p.p(x, y, capR[1]); }
      // las laminillas del hongo, que se ven por abajo del ala
      for (let x = 4; x <= 17; x += 2) if (p.g(x, ala(x) + 1)) p.p(x, ala(x) + 1, capR[0]);
    }
    // los ojos vacíos y la boca abierta que gotea
    parDeOjos(p, 10.5, 1.5, 9, ["ee.", "eee"], { e: PAL.tinta });
    selloC(p, 10.5, 12, [".kkk.", "kmmmk", "kmmmk", ".kkk."], { k: PAL.tinta, m: "#4a0d14" });
    p.p(10, 16, PAL.baba[3]); if (k % 2) p.p(10, 17, PAL.baba[2]);
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── Babosa: larga, brillante, con dos antenas con ojo. 2 cuadros (estirada / encogida) ──
function babosaSpr(k) {
  return hornear(`babosa${k}`, () => {
    const p = new Pix(24, 15), R = ["#1f200b", "#454a16", "#737a24", "#a3aa3a", "#cfd37a"], est = k ? 1.12 : 0.92;
    p.bola(12, 10, 9.5 * est, 4.2 / est, R, { luz: [-0.3, -0.9, 0.35], bajar: 0.1 });
    // el borde del pie, más oscuro, y las manchitas
    for (let x = 2; x < 23; x++) if (p.g(x, 13)) p.p(x, 13, R[1]);
    for (const [x, y] of [[8, 8], [12, 7], [15, 9], [10, 10]]) if (p.g(x, y)) p.p(x, y, R[1]);
    // las antenas con sus ojos (del lado de adelante: la derecha; se espeja al girar)
    const ax = Math.round(12 + 7 * est);
    p.linea(ax - 2, 7, ax - 3, 2, R[2]); p.linea(ax, 7, ax + 1, 2, R[2]);
    p.sello(ax - 4, 0, ["ee", "eW"], { e: PAL.tinta, W: "#ffffff" }); p.sello(ax, 0, ["ee", "eW"], { e: PAL.tinta, W: "#ffffff" });
    p.p(ax + 1, 10, PAL.tinta); p.p(ax, 11, PAL.tinta);
    // el brillo mojado
    p.p(9, 7, R[4]); p.p(10, 7, R[4]); p.p(14, 7, R[4]);
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── Escupidor: un bejín (hongo pedo de lobo) plantado, que escupe esporas por la boca ──
function escupidorSpr(k /* 0 cerrado, 1 inflado, 2 escupiendo */) {
  return hornear(`escupidor${k}`, () => {
    const p = new Pix(22, 22), R = ["#2c231b", "#5a4a3a", "#8c7a62", "#b9a88a", "#e0d4b8"], inf = [1, 1.1, 0.94][k];
    p.bola(11, 12.5, 8.4 * inf, 7.6 * inf, R, { luz: [-0.5, -0.6, 0.6], trama: 0.8 });
    // los poros
    for (const [x, y] of [[6, 9], [9, 7], [14, 8], [16, 12], [7, 14], [12, 16], [15, 16]]) if (p.g(x, y)) { p.p(x, y, R[1]); p.p(x + 1, y + 1, R[3]); }
    // la boca de arriba (la que escupe)
    if (k === 2) selloC(p, 11, 3, ["..kk..", ".kmmk.", "kmmmmk"], { k: PAL.tinta, m: "#140a08" });
    else selloC(p, 11, 4, [".kk.", "kmmk"], { k: PAL.tinta, m: "#1e120c" });
    // la base con raicitas
    p.sello(4, 19, ["r.r..r..r.r..", ".rrrrrrrrrrr."], { r: PAL.tierra[2] });
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── Saltarín: un sapo de barro, con la boca grande. 0 agachado, 1 en el aire ──
function saltarinSpr(k) {
  return hornear(`saltarin${k}`, () => {
    const p = new Pix(20, 17), R = ["#1b1310", "#3c2a22", "#634537", "#8c664f", "#b28a6a"];
    const alto = k ? 6 : 4.6, ancho = k ? 6.4 : 7.8;
    p.bola(10, 16 - alto - 1, ancho, alto, R, { luz: [-0.4, -0.7, 0.55] });
    // las patas
    if (k) { p.caja(4, 12, 3, 4, R.slice(0, 3)); p.caja(13, 12, 3, 4, R.slice(0, 3)); }
    else { p.caja(1, 13, 5, 2, R.slice(0, 3)); p.caja(14, 13, 5, 2, R.slice(0, 3)); }
    const oy = 16 - alto * 2;
    // ojos saltones amarillos con la pupila negra (la pupila, igual en los dos: miran para el mismo lado)
    parDeOjos(p, 10, 2, Math.round(oy), [".ee.", "eeWe", ".ee."], { e: "#f2d64a", W: PAL.tinta });
    selloC(p, 10, Math.round(oy + 4), ["kkkkkk"], { k: PAL.tinta });
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── Gusano: sale del piso, anillado, con una corona de dientes. 0..2 = saliendo, 3 = afuera ──
function gusanoSpr(k) {
  return hornear(`gusano${k}`, () => {
    const p = new Pix(16, 24), R = ["#2e1016", "#5e2430", "#8f3d4a", "#bf6670", "#e09aa0"];
    const alto = [5, 10, 15, 18][k];
    for (let i = 0; i < alto; i += 3) {
      const y = 21 - i, rx = 4.6 - i * 0.06;
      p.bola(8, y, rx, 2.2, R, { luz: [-0.5, -0.5, 0.6], trama: 0.4 });
      for (let x = 4; x < 12; x++) if (p.g(x, y + 1)) p.p(x, y + 1, R[1]);
    }
    // la boca con dientes, arriba
    const yb = 21 - alto + 2;
    p.bola(8, yb, 4.2, 2.6, R.slice(1), {});
    selloC(p, 8, yb - 1, ["ttkktt", "kmmmmk"], { t: PAL.hueso[4], k: PAL.tinta, m: "#1a0406" });
    // el pozo de tierra
    p.sello(1, 21, ["..dddddddddddd", ".dDDDDDDDDDDDDd", "dDDDDDDDDDDDDDd"].map((f) => f.slice(0, 15)), { d: PAL.tierra[1], D: PAL.tierra[0] });
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── Bulbo: una ampolla hinchada que late; al reventar tira 8 esporas ──
function bulboSpr(k) {
  return hornear(`bulbo${k}`, () => {
    const p = new Pix(20, 20), R = ["#2a260e", "#5a5420", "#8d8534", "#bcb456", "#e6e098"], s = k ? 1.06 : 0.96;
    p.bola(10, 11, 7.6 * s, 7.2 * s, R, { luz: [-0.5, -0.6, 0.6] });
    // las venas y la cabeza del grano
    // las venas, por los costados y abajo (lejos de la cara)
    for (const [x0, y0, x1, y1] of [[4, 9, 5, 14], [16, 9, 15, 14], [8, 17, 12, 17]]) trazo(x0, y0, x1, y1, (x, y) => { if (p.g(x, y)) p.p(x, y, R[1]); });
    p.bola(10, 5.5, 2.6, 2, ["#6b2a14", "#a8471f", "#d97a3a", "#f5b070"], {});
    parDeOjos(p, 10, 1, 11, ["We", "ee"], { e: PAL.tinta, W: "#fff5c0" });
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── Arañita: patas que se mueven de a pares, ojitos rojos ──
function aranaSpr(k) {
  return hornear(`arana${k}`, () => {
    const p = new Pix(19, 13), pata = PAL.tinta;
    const L = k ? [[1, 4, 4, 7], [0, 9, 4, 8], [2, 12, 5, 9]] : [[0, 5, 4, 7], [1, 10, 4, 8], [3, 12, 5, 9]];
    for (const [x0, y0, x1, y1] of L) { p.linea(x0, y0, x1, y1, "#2a2226"); p.linea(18 - x0, y0, 18 - x1, y1, "#2a2226"); }
    p.bola(9.5, 7.5, 5, 4.2, ["#0c0a0c", "#1d181c", "#332a30", "#4d4048"], {});
    p.bola(9.5, 4, 3, 2.4, ["#0c0a0c", "#241d22", "#3a3036"], {});
    selloC(p, 9.5, 3, ["rr.rr"], { r: "#ff3b2f" });
    p.p(8, 7, "#5e5058");
    p.contorno(pata);
    return p.canvas();
  });
}

// ── Grumo: un coágulo oscuro que salta y escupe ──
function grumoSpr(k) {
  return hornear(`grumo${k}`, () => {
    const p = new Pix(18, 16), R = PAL.sangre, a = k ? 5.6 : 4.4, b = k ? 6.2 : 7.2;
    p.bola(9, 15 - a - 0.5, b, a, R, { luz: [-0.5, -0.6, 0.6] });
    parDeOjos(p, 9, 1, Math.round(15 - a * 1.4), ["We", "ee"], { e: PAL.tinta, W: "#ffd0c4" });
    if (k) selloC(p, 9, Math.round(15 - a * 0.7), ["kk"], { k: PAL.tinta });
    p.p(5, Math.round(15 - a * 1.9), R[4]);
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ════════════════════════════ LOS JEFES ════════════════════════════

// ── La Madre Babosa: una montaña de baba con una boca enorme. 0 quieta, 1 agachada, 2 estirada (salta), 3 boca abierta ──
function madreBabosaSpr(k) {
  return hornear(`madreBabosa${k}`, () => {
    const p = new Pix(64, 56), R = ["#1a1c08", "#3b3f12", "#62681e", "#8f962e", "#bcc25a", "#dfe29a"];
    const ax = [1, 1.14, 0.84, 1.04][k], ay = [1, 0.84, 1.18, 1.02][k];
    p.bola(32, 54 - 21 * ay, 25 * ax, 21 * ay, R, { luz: [-0.45, -0.6, 0.62], bajar: 0.2 });
    // gotas que le chorrean por los costados
    for (const [x, y] of [[12, 40], [52, 42], [18, 48], [46, 49]]) { const X = 32 + (x - 32) * ax, Y = 54 - (54 - y) * ay; if (p.g(X, Y)) { p.p(X, Y + 1, R[2]); p.p(X, Y + 2, R[1]); } }
    // la cara
    const cy0 = 54 - 26 * ay;
    parDeOjos(p, 32, 4, Math.round(cy0 - 10 * ay), ["..eeee..", ".eWWeee.", "eWeeeeee", "eeeeeeee", ".eeeeee.", "..eeee.."], { e: PAL.tinta, W: "#fff8d0" });
    const bocaAlto = k === 3 ? 12 : k === 1 ? 4 : 6;
    for (let y = 0; y < bocaAlto; y++) for (let x = -11; x <= 10; x++) {   // de 21 a 42: centrada en 32
      const X = x + 0.5, e = (X * X) / (121) + ((y - bocaAlto / 2) * (y - bocaAlto / 2)) / ((bocaAlto / 2 + 0.5) * (bocaAlto / 2 + 0.5));
      if (e <= 1) p.p(32 + x, Math.round(cy0 + 2 + y), y > bocaAlto - 3 && Math.abs(X) < 7 ? "#8e2a3a" : "#2a0810");
    }
    // los dientes, de a pares espejados alrededor del centro (el píxel p y el 63 − p)
    if (k === 3) for (const x of [22, 25, 28, 31]) for (const X of [x, 63 - x]) { p.p(X, Math.round(cy0 + 2), PAL.hueso[4]); p.p(X, Math.round(cy0 + 3), PAL.hueso[3]); }
    // brillos mojados
    for (const [x, y] of [[20, 20], [21, 20], [23, 18], [40, 16]]) { const X = 32 + (x - 32) * ax, Y = 54 - (54 - y) * ay; if (p.g(X, Y)) p.p(X, Y, R[5]); }
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── El Rey Mosquín: una mosca enorme e hinchada, con corona de pelos y muchos ojos ──
function reyMosquinSpr(k /* 0 normal, 1 inflado */) {
  return hornear(`reyMosquin${k}`, () => {
    const p = new Pix(56, 50), R = ["#0c0e0a", "#1c2218", "#2f382a", "#48543f", "#66735a", "#8a977a"], s = k ? 1.08 : 1;
    // las alas, grandes y translúcidas
    for (const sx of [-1, 1]) {
      const q = new Pix(56, 50);
      q.bola(28 + sx * 18, 12, 11, 7, ["#5d6966", "#8a9693", "#b8c2bf", "#dce3e0"], { luz: [-0.2, -0.9, 0.3], trama: 0.3 });
      for (let x = 0; x < 56; x += 3) for (let y = 0; y < 50; y++) if (q.g(x, y) && (x + y) % 5 === 0) q.p(x, y, "#6f7b78");
      p.pegar(q, 0, k ? -2 : 0);
    }
    p.bola(28, 29, 20 * s, 17 * s, R, { luz: [-0.4, -0.6, 0.65], bajar: 0.22 });
    // las verrugas
    for (const [x, y] of [[15, 24], [40, 22], [19, 37], [37, 38], [28, 42]]) { p.p(x, y, R[4]); p.p(x + 1, y, R[3]); p.p(x, y + 1, R[1]); }
    // la fila de ojos rojos
    for (const [x, y, r] of [[21, 24, 3], [35, 24, 3], [16, 28, 2], [40, 28, 2], [28, 21, 2]]) {
      p.bola(x, y, r, r * 0.85, ["#3a0406", "#8e1016", "#d6302a", "#ff7a5a"], { trama: 0.3 });
      p.p(x - 1, y - 1, "#ffd0b0");
    }
    // la boca con la trompa
    selloC(p, 28, 32, [".kkkkkkkk.", "kmmmmmmmmk", "kmmtmmtmmk", ".kmmmmmmk.", "..kkkkkk.."], { k: PAL.tinta, m: "#3a0a10", t: PAL.hueso[3] });
    // la corona de pelos duros
    for (let i = 0; i < 9; i++) { const x = 16 + i * 3; p.linea(x, 12 + Math.abs(4 - i), x + (i - 4) * 0.4, 7 + Math.abs(4 - i), R[0]); }
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── El Gusano Anillado: cabeza con mandíbulas, anillos y cola ──
function gusanoAnilladoSpr(parte /* cabeza, cuerpo, cola */, dir = 0, k = 0) {
  return hornear(`anillado${parte}${dir}${k}`, () => {
    const p = new Pix(26, 26), R = ["#2a0f14", "#56202b", "#86363f", "#b55a5c", "#d98a86", "#f2c0b0"];
    if (parte === "cuerpo") {
      p.bola(13, 14, 10, 9, R, { luz: [-0.4, -0.6, 0.6] });
      for (let x = 4; x < 23; x++) { if (p.g(x, 9)) p.p(x, 9, R[1]); if (p.g(x, 18)) p.p(x, 18, R[1]); }
      p.p(9, 10, R[5]); p.p(10, 10, R[5]);
    } else if (parte === "cola") {
      p.bola(13, 14, 7, 6.5, R, { luz: [-0.4, -0.6, 0.6] });
      p.p(13, 20, R[0]);
    } else {
      p.bola(13, 13, 11, 10, R, { luz: [-0.4, -0.6, 0.6] });
      // las mandíbulas se abren y cierran
      const ab = k ? 2 : 0;
      p.sello(6 - ab, 16, ["hh..", ".hHh", "..hH"], { h: PAL.hueso[3], H: PAL.hueso[1] });
      p.sello(16 + ab, 16, ["..hh", "hHh.", "Hh.."], { h: PAL.hueso[3], H: PAL.hueso[1] });
      parDeOjos(p, 13, 2, 9, ["Wee", "eee", ".e."], { e: PAL.tinta, W: "#ffe0d0" });
      selloC(p, 13, 17, ["kkkkkk", "kmmmmk"], { k: PAL.tinta, m: "#2a0408" });
    }
    p.contorno(AUTO);
    let c = p.canvas();
    if (dir) {   // girar hacia donde va (0 abajo, 1 izquierda, 2 arriba, 3 derecha)
      const r = lienzoNuevo(26, 26), g = r.getContext("2d"); g.translate(13, 13); g.rotate(dir * Math.PI / 2); g.drawImage(c, -13, -13); c = r;
    }
    return c;
  });
}

// ── Micelia, la Madre Hongo: la reina del fondo. Un hongo enorme con cara en el tallo, que llora esporas ──
function miceliaSpr(k /* 0 quieta, 1 boca abierta, 2 herida, 3 furiosa (fase 3) */) {
  return hornear(`micelia${k}`, () => {
    const W = 96, H = 84, p = new Pix(W, H);
    const cap = k === 3 ? ["#1e0610", "#48101f", "#7a1a30", "#b0304a", "#d8586a", "#f08a90"] : ["#1e0a18", "#3e1432", "#65205a", "#8e3a80", "#b862a4", "#dc98c8"];
    const tallo = ["#3a3028", "#6e6052", "#a39481", "#cbbca6", "#e8dcc6"];
    // las raíces que se clavan en el piso
    for (const [x0, x1] of [[30, 12], [38, 24], [58, 72], [66, 86], [48, 48]]) trazo(48 + (x0 - 48) * 0.3, 70, x1, 82, (x, y) => { p.p(x, y, PAL.tierra[2]); p.p(x + 1, y, PAL.tierra[1]); });
    // el tallo, grueso, con la cara
    p.bola(48, 60, 17, 20, tallo, { luz: [-0.4, -0.5, 0.75], bajar: 0.25, trama: 0.6 });
    // la falda (el anillo del hongo)
    p.bola(48, 44, 22, 5, tallo.slice(1), { luz: [-0.3, -0.9, 0.3] });
    for (let x = 27; x < 70; x += 3) if (p.g(x, 48)) { p.p(x, 48, tallo[1]); p.p(x, 49, tallo[1]); }
    // el sombrero enorme, con las laminillas abajo
    const ala = (x) => Math.round(36 + 4 * Math.pow((x + 0.5 - 48) / 46, 2));
    p.bola(48, 26, 46, 22, cap, { filtro: (x, y) => y <= ala(x), luz: [-0.5, -0.65, 0.55], bajar: 0.12 });
    for (let x = 4; x < 92; x++) { const y = ala(x); if (p.g(x, y)) { p.p(x, y, cap[1]); if (x % 3 === 0) { p.p(x, y + 1, cap[0]); p.p(x, y + 2, cap[0]); } } }
    // las manchas del sombrero
    for (const [x, y, r] of [[26, 16, 4], [46, 9, 5], [66, 15, 4], [36, 26, 3], [60, 27, 3], [80, 24, 2], [15, 26, 2]]) {
      p.bola(x, y, r, r * 0.7, ["#8a7a6a", "#c9b9a2", "#eee2cc"], { trama: 0.3 });
    }
    // la cara, en el tallo: ojos tristes que lloran esporas (o furiosos)
    // ojos tristes (caídos hacia afuera), una X de dolor, o rojos de furia
    const ojos = k === 2 ? ["e...e", ".e.e.", "..e..", ".e.e.", "e...e"] : k === 3 ? ["rr...", ".rrr.", ".rrrr", "..rr."] : ["...ee", ".eeWe", "eeeee", ".eee."];
    parDeOjos(p, 48, 4, 54, ojos, { e: PAL.tinta, W: "#ffffff", r: "#ff3b2f" });
    // las esporas que le caen, una por ojo, en el mismo lugar espejado (el píxel p y el 95 − p)
    if (k !== 2) for (const x of [41, 95 - 41]) for (let y = 59; y < 68; y += 2) p.p(x, y, PAL.espora[(y / 2) % 2 ? 3 : 2]);
    const bocaAb = k === 1 || k === 3 ? 6 : 2;
    for (let y = 0; y < bocaAb; y++) { const a = 5 + (y > 0 && y < bocaAb - 1 ? 1 : 0); for (let x = 48 - a; x < 48 + a; x++) p.p(x, 66 + y, y === 0 || y === bocaAb - 1 ? PAL.tinta : "#2a0814"); }
    p.contorno(AUTO);
    return p.canvas();
  });
}

// ── efectos ──
function explosionSpr(k) {
  return hornear(`explosion${k}`, () => {
    const p = new Pix(64, 56), r = 6 + k * 5.2;
    if (k < 6) {
      p.bola(32, 30, r, r * 0.86, k < 2 ? ["#f59a26", "#ffe07a", "#fff7d0", "#ffffff"] : k < 4 ? PAL.fuego : ["#1a1414", "#3a2c28", "#5a4640", "#7a645a"], { luz: [-0.3, -0.7, 0.6], trama: 1.4 });
      // bordes deshilachados
      for (let a = 0; a < 18; a++) { const an = a / 18 * TAU, d = r + (a % 3) * 2; p.p(32 + Math.cos(an) * d, 30 + Math.sin(an) * d * 0.86, k < 4 ? PAL.fuego[2] : "#3a2c28"); }
    }
    return p.canvas();
  });
}
function humoSpr(k) {
  return hornear(`humo${k}`, () => {
    const p = new Pix(24, 24), r = 3 + k * 2.5;
    for (let i = 0; i < 5; i++) { const an = i / 5 * TAU + k; p.bola(12 + Math.cos(an) * r * 0.7, 12 + Math.sin(an) * r * 0.6, 3.4 - k * 0.5, 3 - k * 0.45, ["#4a4650", "#6e6a74", "#9a96a0", "#c6c2cc"], { trama: 0.6 }); }
    return p.canvas();
  });
}
/** Una mancha para el piso (sangre, baba, esporas): una forma irregular sólida con salpicaduras. */
function manchaSpr(tipo, v) {
  return hornear(`mancha${tipo}${v}`, () => {
    const R = tipo === "baba" ? PAL.baba : tipo === "espora" ? PAL.espora : tipo === "quemado" ? ["#050404", "#0e0b0a", "#1a1512", "#241e1a"] : PAL.sangre;
    const p = new Pix(26, 20), r = mulberry(v * 31 + tipo.length), f1 = r() * TAU;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 26; x++) {
      const dx = (x - 13) / 1.35, dy = y - 10, an = Math.atan2(dy, dx), rr = 6.5 * (1 + 0.25 * Math.sin(an * 3 + f1) + 0.15 * Math.sin(an * 5 + f1 * 2));
      const d0 = Math.hypot(dx, dy);
      if (d0 < rr) p.p(x, y, d0 < rr * 0.55 ? R[1] : R[tipo === "quemado" ? 2 : 2]);
    }
    for (let i = 0; i < 6; i++) { const an = r() * TAU, d = 9 + r() * 3; p.p(13 + Math.cos(an) * d * 1.35, 10 + Math.sin(an) * d, R[2]); }
    return p.canvas();
  });
}
/** El "puf" de cuando aparece un enemigo. */
function aparicionSpr(k) {
  return hornear(`aparicion${k}`, () => {
    const p = new Pix(24, 24);
    for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, d = 3 + k * 2.4; p.bola(12 + Math.cos(an) * d, 12 + Math.sin(an) * d * 0.7, 2.6 - k * 0.5, 2.2 - k * 0.4, ["#2a2630", "#4c4652", "#6e6878"], { trama: 0.5 }); }
    return p.canvas();
  });
}
