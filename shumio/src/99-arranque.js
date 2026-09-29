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
  if (grupo === "objetos") return window.__SH.hoja([...Object.keys(OBJETOS), ...Object.keys(BARATIJAS)].map(iconoSpr), 4);
  if (grupo === "armas") return window.__SH.hoja([cuchilloSpr(), misilSpr(), proyectilSpr("aguja"), proyectilSpr("hueso"), proyectilSpr("diente"), ...["normal", "dorado", "piedra", "pinchos", "rojo"].flatMap((k) => [cofreSpr(k, false), cofreSpr(k, true)])], 6);
  if (grupo === "sala" || grupo === "raices") {
    const cap = grupo === "sala" ? "sotano" : "raices";
    const c = lienzoNuevo(SALA_W, SALA_H), g = c.getContext("2d");
    g.drawImage(hornearFondo(cap, 1234), 0, 0);
    const dibujar = (s, x, y) => g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height));
    for (const [tipo, est, dir] of [["normal", 0, 0], ["tesoro", 4, 1], ["jefe", 0, 3], ["tienda", 5, 2]]) { const [x, y] = lugarPuerta(dir); g.drawImage(puertaRotada(tipo, est, dir), x, y); }
    const en = (c0, f0) => [cx(c0), cy(f0) + T / 2];
    for (const [c0, f0, s] of [[1, 1, rocaSpr(0)], [2, 1, rocaSpr(1)], [1, 2, rocaSpr(2)], [10, 1, matasSpr(4)], [11, 1, matasSpr(3)], [11, 2, matasSpr(2)], [10, 5, braseroSpr(1, true)], [3, 5, bloquePiedraSpr()], [4, 5, barrilSpr()], [8, 5, rocaSpr(0, true)]]) { const [x, y] = en(c0, f0); dibujar(s, x, y + 1); }
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
  rotuloPrueba: (tit, sub, ancho = 330) => {
    const s1 = rotuloSpr(tit), s2 = sub ? subtituloSpr(sub) : null, banda = bandaSpr(ancho), c = lienzoNuevo(ancho, 40), g = c.getContext("2d");
    g.fillStyle = "#2a211d"; g.fillRect(0, 0, ancho, 40); g.drawImage(banda, 0, 2); g.drawImage(s1, Math.round(ancho / 2 - s1.width / 2), 2 + Math.round(12 - s1.height / 2) + 1); if (s2) g.drawImage(s2, Math.round(ancho / 2 - s2.width / 2), 22);
    const z = 4, o = lienzoNuevo(ancho * z, 40 * z), go = o.getContext("2d"); go.imageSmoothingEnabled = false; go.drawImage(c, 0, 0, ancho * z, 40 * z); return o.toDataURL();
  },
  maldecir: (k) => { J.maldicion = k; J.rotulos = []; rotulo(J.piso.nombre, "", k ? MALDICIONES[k].texto : null); },
  cuadroRotulo: (t) => { for (const r of J.rotulos) r.t = t - 1; J.rotulos.forEach(() => {}); MENU.activo = null; dibujar(); },
  tactil: (v) => { IN.usaTactil = v; },
  vs: () => { if (J.vsPendiente) empezarVs(); },
  paso: () => paso(), dibujar: () => dibujar(),
  /** La hoja de las lágrimas: la de cada objeto (con su efecto forzado si es al azar), sobre el piso. */
  hojaLagrimas: (ids) => {
    const cols = 6, cw = 62, ch = 44, filas = Math.ceil(ids.length / cols), c = lienzoNuevo(cols * cw, filas * ch), g = c.getContext("2d");
    const piso = hornearFondo("sotano", 3);
    for (let y = 0; y < c.height; y += 150) for (let x = 0; x < c.width; x += 300) g.drawImage(piso, IX0 + 20, IY0 + 10, 300, 150, x, y, 300, 150);
    const PROC = { esporasToxicas: "veneno", lentesAbuela: "piedra", materiaOscura: "miedo", perfumeAbuela: "miedo", picadura: "hielo", pegajosa: "pegajosa", luzSanta: "santa", amorDuro: "diente", eutanasia: "aguja" };
    ids.forEach((id, i) => {
      nuevaPartida(5); const j = J.jug; if (id !== "base") window.__SH.dar(id);
      const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * ch + 16;
      const l = lagrima(j, x - 6, y + 14, 0, 1); l.z = 14; l.vx = 3; l.vy = 0; l.t = 3;
      const k = PROC[id]; if (k === "santa" || k === "diente" || k === "aguja") l.tipo = k; else if (k) l[k] = true;
      if (k) l.look = aspectoLagrima(j, l);
      dibujarLagrima(g, l);
      const n = etiquetaSpr(id === "base" ? "SIN NADA" : (OBJETOS[id] || BARATIJAS[id]).nombre.slice(0, 13), "#fff");
      g.drawImage(n, Math.round(x - n.width / 2), y + 20);
    });
    J.lagrimas.length = 0;
    const z = 3, o = lienzoNuevo(c.width * z, c.height * z), go = o.getContext("2d"); go.imageSmoothingEnabled = false; go.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL();
  },
  /** Graba una muestra de audio sin parlantes (OfflineAudioContext) y la devuelve como WAV en base64.
   *  tipo "musica": n compases de una pista (con o sin la capa pesada); "sfx": una lista de efectos. */
  audioMuestra: async (tipo, que, segs = 12, pesada = true) => {
    const sr = 44100, ctx = new OfflineAudioContext(2, sr * segs, sr), antes = [AC, SAL, MUS, EFX, RUIDO, ECO, ECO_LARGO];
    armarAudio(ctx); MUS.gain.value = 0.55; EFX.gain.value = 0.8;
    if (tipo === "musica") { const t = TEMAS[que]; let n = 0; for (let x = 0.05; x < segs - 1; x += 4 * 60 / t.bpm) { if (t.unaVez && n >= t.unaVez) break; t.compas(x, n++, { calma: MUS, pesada: MUS, pesadaActiva: pesada }); } }
    else que.forEach((k, i) => { _desfase = 0.1 + i * 1.0; SFX[k](); _desfase = 0; });
    const b = await ctx.startRendering();
    [AC, SAL, MUS, EFX, RUIDO, ECO, ECO_LARGO] = antes; _cuerdas.clear();
    const L = b.getChannelData(0), R = b.getChannelData(1), n = L.length, buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, lim(L[i], -1, 1) * 32767, true); v.setInt16(46 + i * 4, lim(R[i], -1, 1) * 32767, true); }
    let bin = ""; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return btoa(bin);
  },
  matarTodo: () => { for (const e of J.enemigos.slice()) matarEnemigo(e); },
  /** Le da objetos a Shumio de una (para probar combinaciones): dar("rayo", "tercerOjo"). */
  dar: (...ids) => { const j = J.jug; for (const id of ids) { if (BARATIJAS[id]) { j.baratija = id; continue; } const d = OBJETOS[id]; if (!d) continue; if (d.activo) j.activo = { id, carga: d.activo, max: d.activo }; else { j.objetos.push(id); if (d.alTomar) d.alTomar(j); } j.vistos.add(id); } recalcular(j); revisarTransformaciones(j); recalcular(j); armarFamiliares(); return { arma: j.arma, n: j.n, fr: j.fr, dano: danoDe(j), f: j.f }; },
  sala: (tipo) => { const s = [...J.piso.salas.values()].find((x) => x.tipo === tipo && !x.limpia); if (s) { entrarSala(s, null); J.estado = "juego"; } return !!s; },
  tirar: (dx, dy, cuadros) => { IN.forzarTiro = [dx, dy, cuadros]; },
  cuenta: () => ({ objetos: Object.keys(OBJETOS).length, activos: Object.values(OBJETOS).filter((o) => o.activo).length, baratijas: Object.keys(BARATIJAS).length, transformaciones: Object.keys(TRANSFORMACIONES).length }),
});
