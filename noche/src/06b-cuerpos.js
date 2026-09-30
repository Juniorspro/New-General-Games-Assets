// ─────────────────────────────────────────────────────────────────────────────
// LOS CUERPOS, POR PIEZAS. Los sellos tipeados a mano salían chuecos (filas corridas, brazos que no
// empalman). Acá cada personaje y cada enemigo se arma con volúmenes sombreados (bola, caja,
// triángulos) sobre un esqueleto fijo con coordenadas medidas: cabeza, cuello, torso, capa, brazos
// que se balancean y piernas en 3 poses (quieto y dos pasos). Simétrico donde tiene que serlo,
// con la luz siempre de arriba a la izquierda y el contorno oscuro teñido (AUTO).
// Todo mira a la derecha; el espejo lo da vuelta.
// ─────────────────────────────────────────────────────────────────────────────

const R4 = (c) => rampaDe(c, 4);
/** Un triángulo lleno (para alas, capas, sombreros, hojas). */
function tri(p, ax, ay, bx, by, cx, cy, col) {
  const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx)), y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
  const ar = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (!ar) return;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / ar, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / ar, w2 = 1 - w0 - w1;
    if (w0 >= 0 && w1 >= 0 && w2 >= 0) p.p(x, y, typeof col === "function" ? col(x, y) : col);
  }
}

// ── la figura humana (22×32, pies en y=30) ──
// o: {piel, pelo, peinado, ropa, pantalon, botas, capa, sombrero, barba, ojos, zombi, vendas, sotana, cinto}
function humano(o, f) {
  const p = new Pix(22, 32), Y = 2;          // Y: aire arriba para sombreros
  const piel = R4(o.piel), ropa = R4(o.ropa), pant = R4(o.pantalon || "#3a2a24"), bota = R4(o.botas || "#2a1c16");
  const paso = f === 1 ? 1 : f === 2 ? -1 : 0, bob = f ? 0 : 0, ag = o.encorvado ? 1 : 0;
  // la capa, atrás de todo, con el ruedo que se mece al caminar
  if (o.capa) {
    const cp = R4(o.capa), sway = paso;
    tri(p, 6, Y + 12, 16, Y + 12, 3 - sway, Y + 26, cp[1]); tri(p, 16, Y + 12, 3 - sway, Y + 26, 15 - sway, Y + 26, cp[1]);
    tri(p, 7, Y + 13, 5 - sway, Y + 25, 9, Y + 25, cp[0]);
    for (let x = 3; x <= 15; x += 3) p.borrar(x - sway, Y + 26);
  }
  // piernas: la de atrás (más oscura) y la de adelante
  const pierna = (x, alto, rampa, tono) => { p.caja(x, Y + 20, 3, alto, rampa, { vertical: 0.3 }); p.caja(x, Y + 20 + alto - 2, 4, 2, bota); if (tono) p.rect(x, Y + 20, 1, alto - 2, rampa[0]); };
  if (!o.sotana) { pierna(8 - paso, f === 2 ? 7 : 8, pant, 1); pierna(12 + paso, f === 1 ? 7 : 8, pant, 0); }
  else { p.caja(6, Y + 20, 11, 7, ropa, { vertical: 0.4 }); p.rect(8 - paso, Y + 27, 4, 2, bota[1]); p.rect(12 + paso, Y + 27, 4, 2, bota[2]); }
  // brazo de atrás
  const brazo = (x, y, rampa, adelante) => {
    if (adelante) { p.caja(x, y, 6, 2, rampa, { vertical: 0.6 }); p.rect(x + 6, y, 2, 2, piel[2]); return; }
    p.caja(x, y, 2, 6, rampa, { vertical: 0.2 }); p.rect(x, y + 6, 2, 2, piel[2]);
  };
  if (o.zombi) brazo(13 + ag, Y + 16, R4(mezclar(o.ropa, "#000000", 0.35)), true);
  else brazo(6 + paso, Y + 14, R4(mezclar(o.ropa, "#000000", 0.35)), false);
  // torso, cinto y cuello
  p.caja(7, Y + 13, 9, 8, ropa, { vertical: 0.55 });
  p.rect(7, Y + 13, 9, 1, ropa[3]);
  if (o.cinto !== 0) { p.rect(7, Y + 19, 9, 1, o.cinto || "#2a1a10"); p.p(11, Y + 19, "#e0b040"); }
  if (o.vendas) for (let y = Y + 13; y < Y + 28; y += 2) for (let x = 6; x < 17; x++) if (p.g(x, y) && (x + y) % 5 === 0) p.p(x, y, mezclar(o.ropa, "#3a2a18", 0.45));
  if (o.harapos) for (const x of [8, 11, 14]) { p.borrar(x, Y + 20); p.p(x + 1, Y + 20, ropa[0]); }
  p.rect(10 + ag, Y + 12, 3, 1, piel[1]);
  // cabeza (redonda, 9×10) con la luz arriba a la izquierda
  const hx = 11.5 + ag, hy = Y + 7.5 + ag * 0.5;
  p.bola(hx, hy, 4.6, 4.9, piel);
  // pelo
  if (o.pelo && o.peinado !== "calvo") {
    const pe = R4(o.pelo);
    if (o.peinado === "capucha") {
      const cap = R4(o.capucha || o.pelo);
      p.bola(hx - 0.5, hy - 0.5, 5.8, 6, cap);
      for (let y = Math.floor(hy - 3); y <= hy + 3; y++) for (let x = Math.floor(hx); x <= hx + 5; x++) if ((x - hx - 1.2) ** 2 / 14 + (y - hy - 0.5) ** 2 / 12 < 1) p.p(x, y, piel[x > hx + 3 ? 2 : 1]);
    } else {
      p.bola(hx - 0.7, hy - 2.2, 5, 3.4, pe, { filtro: (x, y) => y <= hy - 1 });
      for (let x = Math.floor(hx) ; x <= hx + 3; x++) p.p(x, Math.floor(hy - 2), pe[1]);
      p.caja(Math.floor(hx - 5), Math.floor(hy - 3), 3, 6, pe);
      if (o.peinado === "largo") p.caja(Math.floor(hx - 5), Math.floor(hy - 1), 3, 10, pe, { vertical: 0.2 });
      if (o.peinado === "cola") p.bola(hx - 6, hy + 2, 1.8, 3.6, pe);
      if (o.peinado === "moño") p.bola(hx - 2, hy - 5.8, 2.4, 2, pe);
      if (o.peinado === "pelado") for (const x of [0, 2, 4]) p.p(Math.floor(hx - 3 + x), Math.floor(hy - 5), pe[1]);
    }
  }
  // cara: ojos, boca, barba
  const ex = Math.floor(hx + 1), ey = Math.floor(hy);
  const ojo = o.ojos || "#1a1016";
  p.p(ex, ey, ojo); p.p(ex, ey + 1, ojo); p.p(ex + 2, ey, ojo); p.p(ex + 2, ey + 1, ojo);
  if (!o.ojos) { p.p(ex, ey - 1, piel[3]); }
  p.p(ex + 2, ey + 3, piel[0]);
  if (o.barba) { const b = R4(o.barba); p.caja(Math.floor(hx - 1), Math.floor(hy + 2), 6, 4, b); p.p(ex + 2, ey + 3, b[0]); }
  // sombreros
  if (o.sombrero === "bruja") { const s = R4(o.somCol || "#2a2a5a"); p.rect(4, Y + 2, 15, 2, s[1]); p.rect(4, Y + 3, 15, 1, s[0]); tri(p, 7, Y + 2, 16, Y + 2, 10, Y - 6, s[2]); tri(p, 10, Y - 6, 7, Y + 2, 9, Y + 2, s[1]); }
  if (o.sombrero === "corona") { const c = ["#8a5a10", "#e0a020", "#ffe070"]; p.rect(8, Y + 2, 8, 2, c[1]); for (const x of [8, 11, 15]) { p.p(x, Y + 1, c[2]); p.p(x, Y, c[2]); } p.p(12, Y + 2, "#ff4050"); }
  if (o.sombrero === "boina") { const s = R4(o.somCol || "#6a1a2a"); p.bola(11, Y + 3, 6, 2.4, s); }
  if (o.sombrero === "tricornio") { const s = R4(o.somCol || "#2a1a14"); p.rect(4, Y + 3, 15, 2, s[1]); p.bola(11.5, Y + 2, 4.6, 2.6, s); p.p(4, Y + 2, s[2]); p.p(18, Y + 2, s[2]); }
  // brazo de adelante (tapa el torso)
  if (o.zombi) brazo(12 + ag, Y + 14, ropa, true);
  else brazo(15 - paso, Y + 14, ropa, false);
  if (o.arma === "baston") { p.linea(18 - paso, Y + 6, 18 - paso, Y + 29, "#6a4a2a"); p.p(18 - paso, Y + 5, "#ffe070"); }
  p.contorno(AUTO, true);
  return p;
}

// cómo es cada cazador (los colores de ropa salen de PERSONAJES.pal)
const LOOK = {
  antonia: { peinado: "largo", capa: "#8a1414" },
  isolda: { peinado: "largo", sombrero: "bruja", somCol: "#2a3a8a" },
  pascuala: { peinado: "cola" },
  gaspar: { peinado: "corto", barba: "#1a1410", capa: "#2a3a1a" },
  arcadio: { peinado: "corto", capa: "#5a2a0a", arma: "baston" },
  perla: { peinado: "moño" },
  lamia: { peinado: "capucha", capucha: "#8a8a98" },
  poli: { peinado: "calvo", barba: "#e8e8e8" },
  clementina: { peinado: "capucha", capucha: "#f0f0f4" },
  domingo: { peinado: "corto", sotana: 1, cinto: "#c8a050" },
  kiro: { peinado: "cola", sombrero: "boina", somCol: "#0a4a3a" },
};
function cazadorSpr(clave, cuadro, izq) {
  return hornear(`caz2|${clave}|${cuadro}|${izq}`, () => {
    const pj = PERSONAJES[clave], [, c, pa, s] = pj.pal;
    let px = humano({ piel: s, pelo: pj.pelo, ropa: c, pantalon: pa, botas: "#2a1a14", ...LOOK[clave] }, cuadro);
    if (izq) px = px.espejo();
    return px.canvas();
  });
}

// ── los enemigos ──
const CUERPOS = {
  zombi: (f) => humano({ piel: "#8aa860", pelo: "#3a4a2a", peinado: "pelado", ropa: "#4e5e80", pantalon: "#343c54", botas: "#5a6a3a", ojos: "#ff3020", zombi: 1, encorvado: 1, harapos: 1, cinto: 0 }, f ? 1 + (f % 2) : 1),
  momia: (f) => humano({ piel: "#dccca4", pelo: null, peinado: "calvo", ropa: "#d4c49a", pantalon: "#c8b88e", botas: "#b0a078", ojos: "#ffb020", zombi: 1, vendas: 1, cinto: 0 }, f ? 1 + (f % 2) : 1),
  esqueleto(f) {
    const p = new Pix(22, 32), Y = 2, hu = ["#6a6456", "#a8a290", "#dcd6c4", "#f6f2e6"], paso = f ? 1 : -1;
    // piernas (huesos finos) y pelvis
    p.rect(9 - paso, Y + 20, 2, 8, hu[1]); p.rect(12 + paso, Y + 20, 2, 8, hu[2]); p.rect(9 - paso, Y + 27, 3, 1, hu[1]); p.rect(12 + paso, Y + 27, 3, 1, hu[2]);
    p.caja(8, Y + 18, 7, 3, hu);
    // columna y costillas
    p.rect(11, Y + 12, 1, 7, hu[2]);
    for (let k = 0; k < 3; k++) p.caja(8, Y + 13 + k * 2, 7, 1, hu);
    // brazos
    p.rect(6 + paso, Y + 13, 2, 6, hu[1]); p.rect(15 - paso, Y + 13, 2, 6, hu[2]);
    // calavera
    p.bola(11.5, Y + 7.5, 4.5, 4.6, hu);
    p.rect(12, Y + 7, 2, 2, "#1a1016"); p.rect(15, Y + 7, 1, 2, "#1a1016"); p.rect(13, Y + 11, 3, 1, hu[0]); p.p(14, Y + 11, "#1a1016");
    p.contorno(AUTO, true);
    return p;
  },
  lobizon(f) {
    const p = humano({ piel: "#7a6a64", pelo: null, peinado: "calvo", ropa: "#6a5a54", pantalon: "#5a4a44", botas: "#3a2e2a", encorvado: 1, cinto: 0 }, f ? 1 + (f % 2) : 1), Y = 2;
    const pe = ["#2e2420", "#5a4a44", "#8a7a70", "#b8a898"];
    // la cabeza de lobo encima de la humana: hocico, orejas, ojo rojo, colmillo
    p.bola(12.5, Y + 8.5, 5, 4.6, pe);
    p.caja(15, Y + 9, 5, 3, pe); p.p(20, Y + 9, "#1a1016");
    tri(p, 9, Y + 5, 12, Y + 4, 9.5, Y - 0.5, pe[1]); tri(p, 12, Y + 4, 15, Y + 5, 13, Y - 0.5, pe[2]);
    p.p(15, Y + 7, "#ff3020"); p.p(16, Y + 7, "#ff8060"); p.p(18, Y + 12, "#ffffff");
    p.caja(9, Y + 14, 5, 5, ["#8a7a70", "#b0a098", "#d0c4b8", "#e8e0d8"]);
    p.p(8, Y + 22, "#ffffff"); p.p(17, Y + 22, "#ffffff");
    p.contorno(AUTO, true);
    return p;
  },
  barro(f) {
    const p = new Pix(24, 30), bar = ["#34401e", "#5a7040", "#7a9050", "#9ab070"], sq = f ? 1 : 0;
    p.bola(12, 18 + sq, 9 + sq, 9 - sq, bar);
    p.bola(13, 8 + sq, 5.5, 5, bar);
    p.bola(4 - sq, 17, 2.6, 4, bar); p.bola(20 + sq, 16, 2.6, 4, bar);
    for (const x of [6, 11, 17]) { p.rect(x, 26, 2, 2 + ((x + f) % 2), bar[1]); }
    p.rect(14, 7 + sq, 2, 2, "#f0e040"); p.rect(17, 7 + sq, 2, 2, "#f0e040"); p.rect(14, 11 + sq, 4, 1, bar[0]);
    p.contorno(AUTO, true);
    return p;
  },
  fantasma(f) {
    const p = new Pix(20, 24), bl = ["#6a7aa8", "#a8b8e0", "#d8e4ff", "#f4f8ff"];
    p.bola(10, 9, 7.5, 7.5, bl);
    p.caja(3, 9, 15, 9, bl, { vertical: 0.2 });
    for (let x = 3; x < 18; x++) { const ola = Math.round(Math.sin((x + f * 2.5) * 0.9) * 1.5); for (let y = 18; y < 20 + ola; y++) p.p(x, y, bl[1]); }
    p.bola(4, 13, 2, 1.6, bl); p.bola(17, 12, 2, 1.6, bl);
    p.rect(11, 8, 2, 3, "#1a2040"); p.rect(15, 8, 2, 3, "#1a2040"); p.rect(12, 13, 3, 2, "#1a2040");
    p.contorno(AUTO, true);
    return p;
  },
  murcielago(f) {
    const p = new Pix(22, 14), cu = ["#2a1224", "#4a2240", "#6a3a5a", "#8a5a7a"], ala = ["#3a1a34", "#5a2a4c"];
    if (!f) {       // alas arriba
      tri(p, 9, 7, 1, 1, 4, 9, ala[0]); tri(p, 9, 7, 4, 9, 7, 10, ala[1]);
      tri(p, 13, 7, 21, 1, 18, 9, ala[1]); tri(p, 13, 7, 18, 9, 15, 10, ala[0]);
    } else {        // alas abajo
      tri(p, 9, 6, 1, 11, 6, 12, ala[0]); tri(p, 13, 6, 21, 11, 16, 12, ala[1]);
    }
    p.bola(11, 7.5, 3, 3.5, cu); p.bola(11, 3.8, 2.4, 2.2, cu);
    tri(p, 9, 3, 10, 1.5, 9, -0.5, cu[2]); tri(p, 12, 1.5, 13, 3, 13, -0.5, cu[2]);
    p.p(10, 4, "#ff3030"); p.p(12, 4, "#ff3030");
    p.contorno(AUTO, true);
    return p;
  },
  mantis(f) {
    const p = new Pix(26, 30), v = ["#1e4a1a", "#3a8a2a", "#6ac040", "#a8e070"], paso = f ? 1 : -1;
    // patas finas
    for (const [x0, dx] of [[9, -3], [12, 2], [14, 4]]) { p.linea(x0, 19, x0 + dx + paso, 25, v[1]); p.linea(x0 + dx + paso, 25, x0 + dx + paso, 28, v[1]); }
    // abdomen, tórax, cabeza triangular con ojos grandes
    p.bola(8, 18, 4.6, 6.5, v);
    p.caja(11, 10, 3, 10, v);
    tri(p, 12, 5, 20, 6, 15, 11, v[2]); p.p(18, 6, "#ff4020"); p.p(14, 6, "#ff4020");
    p.linea(15, 4, 17, 0, v[2]); p.linea(13, 5, 12, 1, v[2]);
    // las guadañas
    p.linea(13, 12, 18 + paso, 14, v[2]); p.linea(18 + paso, 14, 21 + paso, 7, "#e8ffd0"); p.linea(19 + paso, 14, 22 + paso, 8, v[3]);
    p.linea(12, 14, 16 - paso, 17, v[1]); p.linea(16 - paso, 17, 19 - paso, 11, "#d0f0b0");
    p.contorno(AUTO, true);
    return p;
  },
  flor(f) {
    const p = new Pix(22, 26), ve = ["#1a5a1a", "#2a8a2a", "#5ac048", "#90e070"], pe = ["#801a50", "#d03890", "#ff70b8", "#ffb0d8"];
    p.rect(10, 13, 2, 11, ve[1]); p.rect(11, 13, 1, 11, ve[2]);
    tri(p, 10, 19, 2, 15 + f, 6, 21, ve[2]); tri(p, 12, 19, 20, 15 - f, 16, 21, ve[1]);
    p.bola(11, 24.5, 5, 1.6, ve);
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + f * 0.2; p.bola(11 + Math.cos(a) * 5.2, 8 + Math.sin(a) * 4.6, 2.8, 2.6, pe); }
    p.bola(11, 8, 3.6, 3.4, ["#6a0a20", "#a01a30", "#e0c040", "#ffe070"]);
    if (f) { p.rect(9, 8, 5, 2, "#300008"); p.p(10, 8, "#ffffff"); p.p(12, 9, "#ffffff"); }
    else p.rect(9, 9, 5, 1, "#300008");
    p.contorno(AUTO, true);
    return p;
  },
  parca(f) {
    const p = new Pix(28, 34), ro = ["#0c0812", "#1e1628", "#342a44", "#4a3e5c"], hu = ["#8a8478", "#c8c2b0", "#eeeae0", "#ffffff"];
    // la guadaña atrás: palo y hoja curva
    p.linea(21, 3, 18, 33, "#6a4a2a"); p.linea(22, 3, 19, 33, "#8a6a3a");
    // la túnica (trapecio) con el ruedo rasgado que flota
    tri(p, 9, 8, 18, 8, 3, 30, ro[1]); tri(p, 18, 8, 3, 30, 21, 30, ro[1]); tri(p, 9, 10, 4, 29, 10, 29, ro[0]);
    for (let x = 3; x <= 21; x += 3) p.borrar(x + (f ? 1 : 0), 30);
    // capucha y calavera
    p.bola(13, 8, 6, 6.4, ro);
    p.bola(14.5, 9, 3.2, 3.4, hu);
    p.rect(14, 8, 1, 2, "#0a0610"); p.rect(16, 8, 1, 2, "#0a0610"); p.rect(14, 11, 3, 1, hu[0]);
    // la mano huesuda en el palo, y la hoja curva por encima de la capucha (si va antes, la tapa)
    p.rect(18, 15, 3, 2, hu[1]);
    p.linea(21, 0, 22, 3, "#8a6a3a");
    for (let k = 0; k <= 16; k++) { const a = k / 16, x = 21 - a * 16, y = 1 + Math.sin(a * Math.PI) * -1 + a * a * 5; p.p(x, y, hu[3]); p.p(x, y + 1, hu[1]); if (k < 12) p.p(x, y + 2, hu[0]); }
    p.contorno(AUTO, true);
    return p;
  },
};
/** El sprite de un enemigo: cuadro 0/1, mirando a la izquierda o no, con su tinte. */
function enemigoSpr(spr, cuadro, izq, tinte) {
  return hornear(`ene2|${spr}|${cuadro}|${izq}|${tinte || ""}`, () => {
    let px = CUERPOS[spr](cuadro);
    if (tinte) px = px.tenido((c) => mezclar(c, tinte, 0.5));
    if (izq) px = px.espejo();
    const c = px.canvas();
    if (spr === "fantasma") { const q = lienzoNuevo(c.width, c.height), x = q.getContext("2d"); x.globalAlpha = 0.85; x.drawImage(c, 0, 0); return q; }
    return c;
  });
}
