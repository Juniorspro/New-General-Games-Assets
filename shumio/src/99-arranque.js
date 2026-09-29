// ─────────────────────────────────────────────────────────────────────────────
// EL ARRANQUE y las sondas para las pruebas (window.__SH).
// ─────────────────────────────────────────────────────────────────────────────
window.__SH = {
  SPR, PAL, Pix,
  /** Dibuja una lista de sprites (canvas) en una hoja, agrandados ×z, para mirarlos. */
  hoja(lista, z = 6, fondo = "#2b2a2e") {
    const pad = 4, cols = 8, cw = Math.max(...lista.map((c) => c.width)), ch = Math.max(...lista.map((c) => c.height));
    const W = cols * (cw + pad) * z, H = Math.ceil(lista.length / cols) * (ch + pad) * z;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.fillStyle = fondo; g.fillRect(0, 0, W, H);
    lista.forEach((s, i) => g.drawImage(s, (i % cols) * (cw + pad) * z, Math.floor(i / cols) * (ch + pad) * z, s.width * z, s.height * z));
    return c.toDataURL();
  },
  listo: true,
};
if (typeof arrancar === "function") arrancar();
window.__SH.hojaDe = (grupo) => {
  if (grupo === "shumio") {
    const s = spritesShumio(), l = [];
    for (const v of ["frente", "lado", "espalda"]) l.push(...s.cab[v]);
    for (const v of ["frente", "lado", "espalda"]) l.push(...s.cue[v]);
    l.push(...[2, 3, 4, 5, 7, 9].map((r) => lagrimaSpr(r)), ...[0, 1, 2, 3, 4].map((k) => chapoteoSpr("espora", k)));
    return window.__SH.hoja(l, 8);
  }
  if (grupo === "enemigos") {
    const l = [];
    for (let k = 0; k < 2; k++) l.push(mosquinSpr(k), mosquinSpr(k, true));
    for (let k = 0; k < 4; k++) l.push(hongonSpr(k));
    l.push(babosaSpr(0), babosaSpr(1), escupidorSpr(0), escupidorSpr(1), escupidorSpr(2), saltarinSpr(0), saltarinSpr(1));
    for (let k = 0; k < 4; k++) l.push(gusanoSpr(k));
    l.push(bulboSpr(0), bulboSpr(1), aranaSpr(0), aranaSpr(1), grumoSpr(0), grumoSpr(1));
    return window.__SH.hoja(l, 6);
  }
  if (grupo === "jefes") {
    const l = [0, 1, 2, 3].map(madreBabosaSpr).concat([reyMosquinSpr(0), reyMosquinSpr(1), gusanoAnilladoSpr("cabeza"), gusanoAnilladoSpr("cuerpo"), gusanoAnilladoSpr("cola")], [0, 1, 2, 3].map(miceliaSpr));
    return window.__SH.hoja(l, 3);
  }
  if (grupo === "sala" || grupo === "raices") {
    const cap = grupo === "sala" ? "sotano" : "raices";
    const c = lienzoNuevo(SALA_W, SALA_H), g = c.getContext("2d");
    g.drawImage(hornearFondo(cap, 1234), 0, 0);
    const dibujar = (s, x, y) => g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height));
    for (const [tipo, est, dir] of [["normal", 0, 0], ["tesoro", 4, 1], ["jefe", 0, 3], ["tienda", 5, 2]]) { const [x, y] = lugarPuerta(dir); g.drawImage(puertaRotada(tipo, est, dir), x, y); }
    const en = (c0, f0) => [cx(c0), cy(f0) + T / 2];
    for (const [c0, f0, s] of [[1, 1, rocaSpr(0)], [2, 1, rocaSpr(1)], [1, 2, rocaSpr(2)], [10, 1, matasSpr(4)], [11, 1, matasSpr(3)], [11, 2, matasSpr(2)], [10, 5, braseroSpr(1, true)], [3, 5, bloqueSpr()], [4, 5, barrilSpr()], [8, 5, rocaSpr(0, true)]]) { const [x, y] = en(c0, f0); dibujar(s, x, y + 1); }
    for (const [c0, f0] of [[6, 1], [7, 1]]) g.drawImage(pozoSpr(false, c0 === 7, c0 === 6, true), IX0 + c0 * T, IY0 + f0 * T);
    g.drawImage(pinchosSpr(true), IX0 + 5 * T, IY0 + 5 * T);
    const s = spritesShumio();
    g.drawImage(sombra(7, 3), cx(6) - 7, cy(3) + 6);
    g.drawImage(s.cue.frente[0], cx(6) - 7, cy(3) - 4); g.drawImage(s.cab.frente[0], cx(6) - 11, cy(3) - 20);
    g.drawImage(lagrimaSpr(4), cx(6) - 5, cy(4)); 
    const recog = [corazonSpr("rojo"), corazonSpr("medio"), corazonSpr("espora"), monedaSpr(0), monedaSpr(0, 5), bombaSpr(), llaveSpr(), cofreSpr(false, false), cofreSpr(true, false), capsulaSpr(2)];
    recog.forEach((r, i) => g.drawImage(r, IX0 + 30 + i * 24, IY0 + 4 * T + 6));
    g.drawImage(pedestalSpr(), cx(2) - 11, cy(5) - 6); g.drawImage(trampillaSpr(true), cx(6) - 14, cy(5) - 10);
    const v = vineta(); g.drawImage(v, -20, -20);
    const z = 4, out = lienzoNuevo(SALA_W * z, SALA_H * z), go = out.getContext("2d"); go.imageSmoothingEnabled = false; go.drawImage(c, 0, 0, SALA_W * z, SALA_H * z);
    return out.toDataURL();
  }
  return null;
};
// sondas para las pruebas: el estado de la partida y atajos para llegar rápido a cada cosa
Object.assign(window.__SH, {
  juego: () => J, menu: () => MENU, perf: () => PERF, pant: () => PANT,
  nueva: (s) => { MENU.activo = null; nuevaPartida(s); },
  irA: (tipo) => { const s = [...J.piso.salas.values()].find((x) => x.tipo === tipo); if (s) { entrarSala(s, null); J.estado = "juego"; } return !!s; },
  vs: () => { if (J.vsPendiente) empezarVs(); },
  matarTodo: () => { for (const e of J.enemigos.slice()) matarEnemigo(e); },
});
