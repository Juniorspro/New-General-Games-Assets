// ─────────────────────────────────────────────────────────────────────────────
// LOS MENÚS Y EL LOGO. Botones de tinta sobre fondo; el elegido, lleno de acento (como el original:
// menús de texto gordo, sin adornos que distraigan). Se manejan con el dedo, el mouse o flechas+Enter.
// El logo: "ABYSS" y "FALL" en la letra gorda ×3, escalonados, con la franja de acento arriba de
// cada letra, un relieve hacia abajo y líneas de velocidad (se lee "caída" antes de leer la palabra).
// ─────────────────────────────────────────────────────────────────────────────

let PANT = "titulo";
const UI = { items: [], foco: 0, pantallaFoco: null };
function uiEmpezar(p) { if (UI.pantallaFoco !== p) { UI.pantallaFoco = p; UI.foco = 0; } UI.items = []; }
function boton(x, y, w, h, etiqueta, accion, o = {}) {
  const i = UI.items.length, foco = UI.foco === i;
  UI.items.push({ x, y, w, h, accion, apagado: o.apagado });
  g.fillStyle = foco ? C_ACENTO : C_FONDO; g.fillRect(x, y, w, h);
  g.fillStyle = foco ? C_ACENTO : C_TINTA; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  if (etiqueta) texto(L(etiqueta), x + w / 2, y + Math.round(h / 2) - 3, { alfa: o.apagado ? 0.45 : 1, sombra: !foco });
  return foco;
}
function uiProcesar(atras) {
  const it = UI.items;
  for (const t of IN.toques) for (let i = it.length - 1; i >= 0; i--) { const b = it[i]; if (t.x >= b.x && t.x < b.x + b.w && t.y >= b.y && t.y < b.y + b.h) { UI.foco = i; IN.toques.length = 0; if (b.apagado) sfx("no"); else { sfx("clic"); b.accion(); } return; } }
  if (it.length) {
    if (recien("k:ArrowDown") || recien("k:KeyS")) { UI.foco = (UI.foco + 1) % it.length; sfx("mover"); }
    if (recien("k:ArrowUp") || recien("k:KeyW")) { UI.foco = (UI.foco - 1 + it.length) % it.length; sfx("mover"); }
    UI.foco = lim(UI.foco, 0, it.length - 1);
    if (recien("ok") || recien("k:Space") || recien("k:KeyZ")) { const b = it[UI.foco]; if (b.apagado) sfx("no"); else { sfx("clic"); b.accion(); } return; }
  }
  if (atras && recien("atras")) { sfx("clic"); atras(); }
}
function irA(p) { PANT = p; UI.pantallaFoco = null; }

// ── el logo ──
function logoSpr() {
  return hornear("logo", () => {
    const E = 3, palabras = [["ABYSS", 0, 0], ["FALL", 0, 0]];
    const a1 = anchoTexto("ABYSS") * E, a2 = anchoTexto("FALL") * E, WL = Math.max(a1, a2 + 22) + 12, HL = 7 * E * 2 + 30;
    palabras[0][1] = 6; palabras[0][2] = 6; palabras[1][1] = WL - 6 - a2; palabras[1][2] = 6 + 7 * E + 8;
    const c = lienzoNuevo(WL, HL), q = c.getContext("2d"), m = new Uint8Array(WL * HL);
    for (const [pal, x0, y0] of palabras) {
      let x = x0;
      for (const ch of pal) {
        const gl = LETRA[ch];
        gl.forEach((f, y) => { for (let i = 0; i < f.length; i++) if (f[i] === "#") for (let a = 0; a < E; a++) for (let b = 0; b < E; b++) m[(y0 + y * E + b) * WL + x + i * E + a] = y < 3 ? 2 : 1; });
        x += (gl[0].length + 1) * E;
      }
    }
    const en = (x, y) => x >= 0 && y >= 0 && x < WL && y < HL && m[y * WL + x];
    // líneas de velocidad por detrás (la caída)
    q.fillStyle = C_TINTA; const r = mulberry(5);
    for (let i = 0; i < 18; i++) { const x = Math.floor(r() * WL), y = Math.floor(r() * HL * 0.7), l = 6 + Math.floor(r() * 16); q.globalAlpha = 0.35; q.fillRect(x, y, 1, l); }
    q.globalAlpha = 1;
    // el borde de fondo, el relieve de acento (3 px abajo) y la cara con la franja de arriba
    for (let y = 0; y < HL; y++) for (let x = 0; x < WL; x++) {
      if (en(x, y)) continue;
      if (en(x, y - 1) || en(x, y - 2) || en(x, y - 3)) { q.fillStyle = C_ACENTO; q.fillRect(x, y, 1, 1); }
    }
    for (let y = 0; y < HL; y++) for (let x = 0; x < WL; x++) {
      if (!en(x, y)) continue;
      q.fillStyle = m[y * WL + x] === 2 ? C_ACENTO : C_TINTA; q.fillRect(x, y, 1, 1);
      if (m[y * WL + x] === 2 && y % 3 === 1) { q.fillStyle = C_TINTA; q.fillRect(x, y, 1, 1); }      // rayado en la franja
    }
    // el borde del color de fondo alrededor de todo
    const out = lienzoNuevo(WL + 2, HL + 2), o2 = out.getContext("2d");
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) { o2.globalCompositeOperation = "source-over"; const t2 = lienzoNuevo(WL, HL), q2 = t2.getContext("2d"); q2.drawImage(c, 0, 0); q2.globalCompositeOperation = "source-in"; q2.fillStyle = C_FONDO; q2.fillRect(0, 0, WL, HL); o2.drawImage(t2, dx, dy); }
    o2.drawImage(c, 1, 1);
    return out;
  });
}
function dibujarLogo(y) {
  const s = logoSpr(), x = Math.round(W / 2 - s.width / 2);
  g.drawImage(s, x, y);
  // el que cae, entre las dos palabras
  const h = heroeSpr(Math.floor(performance.now() / 150) % 2 ? "cae" : "dispara", false);
  g.drawImage(h, x + 10, y + 30 + Math.round(Math.sin(performance.now() / 300) * 2));
  return y + s.height;
}

// ── el fondo de los menús: un pozo que cae para siempre ──
const _fondo = { y: 0, cosas: Array.from({ length: 10 }, () => ({ x: 20 + Math.random() * 140, y: Math.random() * 500, t: Math.random() < 0.3 ? "gema" : "blq" })) };
function dibujarFondoMenu() {
  g.fillStyle = C_FONDO; g.fillRect(0, 0, W, H);
  _fondo.y += 1.2;
  const f0 = Math.floor(_fondo.y / T);
  for (let fy = f0 - 1; fy < f0 + Math.ceil(H / T) + 2; fy++) {
    const Y = Math.round(fy * T - _fondo.y), l = 1 + ((fy * 7919) >>> 3) % 2, r = 1 + ((fy * 104729) >>> 4) % 2;
    for (let x = 0; x < l; x++) g.drawImage(rocaSpr(2, fy & 3), x * T - 6, Y);
    for (let x = 0; x < r; x++) g.drawImage(rocaSpr(8, (fy + 1) & 3), W - (x + 1) * T + 6, Y);
  }
  for (const c of _fondo.cosas) { c.y -= 0.9; if (c.y < -20) { c.y = H + 20; c.x = 24 + Math.random() * (W - 48); } g.drawImage(c.t === "gema" ? gemaSpr(true) : bloqueSpr("n"), Math.round(c.x), Math.round(c.y)); }
}

function pantallaTitulo() {
  dibujarFondoMenu();
  const fin = dibujarLogo(Math.round(H * 0.16));
  if (Math.floor(performance.now() / 500) % 2) texto(L(IN.tactil || matchMedia("(pointer: coarse)").matches ? TX.tocar : TX.tecla), W / 2, Math.max(fin + 40, Math.round(H * 0.58)));
  texto(`${L(TX.totalGemas)} ${G.totalGemas}`, W / 2, H - 22, { alfa: 0.8 });
  // sólo al LEVANTAR el dedo (el toque) o con una tecla: si avanzara al apoyarlo, al soltarlo ese
  // mismo toque caía sobre el botón del menú que queda debajo (cambiaba el idioma sin querer)
  if (IN.toques.length || recien("k:Space") || recien("ok") || recien("k:KeyZ")) { IN.toques.length = 0; irA("menu"); sfx("elegir"); tocarTema("titulo"); }
}
function pantallaMenu() {
  dibujarFondoMenu();
  const fin = dibujarLogo(24);
  uiEmpezar("menu");
  const bw = 120, x = Math.round(W / 2 - bw / 2); let y = Math.max(fin + 20, Math.round(H * 0.38));
  boton(x, y, bw, 18, TX.jugar, () => { nuevaPartida(); irA("juego"); }); y += 24;
  boton(x, y, bw, 18, `${L(TX.estilo)}: ${L(ESTILOS[G.estilo].n)}`, () => irA("estilos")); y += 24;
  boton(x, y, bw, 18, `${L(TX.paleta)}: ${PALA.n}`, () => irA("paletas")); y += 24;
  boton(x, y, bw, 18, TX.opciones, () => irA("opciones")); y += 24;
  boton(x, y, bw, 18, TX.idioma, () => cambiarIdioma());
  texto(`${L(TX.totalGemas)} ${G.totalGemas}`, W / 2, H - 34);
  if (G.record.prof) texto(`${L(TX.prof)} ${G.record.prof} · ${L(TX.maxCombo)} ${G.record.combo}`, W / 2, H - 22, { alfa: 0.7 });
  uiProcesar(() => irA("titulo"));
}
function pantallaEstilos() {
  dibujarFondoMenu();
  texto(L(TX.estilo), W / 2, 12, { escala: 2 });
  uiEmpezar("estilos");
  let y = 40;
  for (const [k, e] of Object.entries(ESTILOS)) {
    const abierto = G.totalGemas >= e.precio;
    boton(8, y, W - 16, 44, "", () => { if (abierto) { G.estilo = k; guardar(); sfx("elegir"); } }, { apagado: !abierto });
    texto((G.estilo === k ? "> " : "") + L(e.n), W / 2, y + 5, { color: G.estilo === k ? "acento" : "tinta" });
    if (abierto) parrafo(e.d, W / 2, y + 17, W - 30, { paso: 9 });
    else texto(`${L(TX.bloqueado)} · ${e.precio}`, W / 2, y + 22, { alfa: 0.6 });
    y += 50;
  }
  boton(Math.round(W / 2 - 50), y + 6, 100, 18, TX.volver, () => irA("menu"));
  uiProcesar(() => irA("menu"));
}
function pantallaPaletas() {
  dibujarFondoMenu();
  texto(L(TX.paleta), W / 2, 12, { escala: 2 });
  uiEmpezar("paletas");
  let y = 38;
  for (const [k, p] of Object.entries(PALETAS)) {
    const abierto = G.totalGemas >= p.precio;
    boton(10, y, W - 20, 22, "", () => { if (abierto) { ponerPaleta(k); sfx("elegir"); } }, { apagado: !abierto });
    p.c.forEach((col, i) => { g.fillStyle = "#808080"; g.fillRect(15 + i * 11, y + 5, 11, 12); g.fillStyle = col; g.fillRect(16 + i * 11, y + 6, 9, 10); });
    texto(abierto ? (G.paleta === k ? "> " : "") + p.n : `${L(TX.bloqueado)} ${p.precio}`, 55, y + 8, { al: "izq", alfa: abierto ? 1 : 0.6 });
    y += 26;
  }
  boton(Math.round(W / 2 - 50), y + 6, 100, 18, TX.volver, () => irA("menu"));
  uiProcesar(() => irA("menu"));
}
function pantallaOpciones() {
  dibujarFondoMenu();
  texto(L(TX.opciones), W / 2, 12, { escala: 2 });
  uiEmpezar("opciones");
  const x = 18, w = W - 36; let y = 44;
  const vol = (k) => { G.op[k] = G.op[k] >= 1 ? 0 : Math.round((G.op[k] + 0.2) * 10) / 10; volumenes(); guardar(); if (k === "efectos") sfx("gema"); };
  boton(x, y, w, 18, `${L(TX.musica)}: ${Math.round(G.op.musica * 100)}%`, () => vol("musica")); y += 24;
  boton(x, y, w, 18, `${L(TX.efectos)}: ${Math.round(G.op.efectos * 100)}%`, () => vol("efectos")); y += 24;
  boton(x, y, w, 18, `${L(TX.temblor)}: ${L(G.op.temblor ? TX.si : TX.no)}`, () => { G.op.temblor = G.op.temblor ? 0 : 1; guardar(); }); y += 24;
  boton(x, y, w, 18, TX.idioma, () => cambiarIdioma()); y += 24;
  boton(x, y, w, 18, TX.completa, () => { _completaPendiente = true; }); y += 32;
  boton(Math.round(W / 2 - 50), y, 100, 18, TX.volver, () => irA("menu"));
  uiProcesar(() => irA("menu"));
}

// ── dentro de la partida ──
function pantallaPausa() {
  g.fillStyle = C_FONDO; g.globalAlpha = 0.82; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  texto(L(TX.pausa), W / 2, Math.round(H * 0.2), { escala: 2 });
  texto(nombreNivel(), W / 2, Math.round(H * 0.2) + 20, { color: "acento" });
  uiEmpezar("pausa");
  const bw = 110, x = Math.round(W / 2 - bw / 2); let y = Math.round(H * 0.34);
  boton(x, y, bw, 18, TX.seguir, () => { J.pausa = false; }); y += 24;
  boton(x, y, bw, 18, TX.reintentar, () => { J.pausa = false; nuevaPartida(); }); y += 24;
  boton(x, y, bw, 18, `${L(TX.musica)}: ${Math.round(G.op.musica * 100)}%`, () => { G.op.musica = G.op.musica >= 1 ? 0 : Math.round((G.op.musica + 0.2) * 10) / 10; volumenes(); guardar(); }); y += 24;
  boton(x, y, bw, 18, TX.idioma, () => cambiarIdioma()); y += 24;
  boton(x, y, bw, 18, TX.salir, () => { J.pausa = false; J.jug.muerto = true; terminarPartida(); });
  texto(`${L(ARMAS[J.arma].n)}`, W / 2, y + 34, { alfa: 0.8 });
  uiProcesar(() => { J.pausa = false; });
}
function pantallaMejora() {
  g.fillStyle = C_FONDO; g.globalAlpha = 0.9; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  texto(nombreNivel(), W / 2, 20, { color: "acento" });
  texto(L(TX.elegir), W / 2, 34, { escala: 2 });
  uiEmpezar("mejora" + J.zona + J.nivel);
  let y = 62;
  for (const k of J.opciones) {
    const M2 = MEJORAS[k], foco = boton(8, y, W - 16, 46, "", () => elegirMejora(k));
    const ic = iconoSpr(M2.ico); g.fillStyle = C_FONDO; g.fillRect(13, y + 7, 20, 20); g.drawImage(ic, 14, y + 8, 18, 18);
    texto(L(M2.n), 38, y + 6, { al: "izq", sombra: !foco });
    renglones(L(M2.d), W - 56).slice(0, 3).forEach((r, i) => texto(r, 38, y + 17 + i * 9, { al: "izq", sombra: !foco }));
    y += 52;
  }
  texto(`${L(TX.gemas)} ${J.gemasPartida}`, W / 2, H - 20);
  uiProcesar(null);
}
function pantallaFin() {
  g.fillStyle = C_FONDO; g.globalAlpha = 0.92; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  const y0 = Math.round(H * 0.12);
  parrafo(J.ganado ? TX.ganaste : TX.muerto, W / 2, y0, W - 20, { escala: 2, paso: 18 });
  const filas = [[TX.prof, J.ganado ? L(TX.abismo) : nombreNivel()], [TX.gemas, J.gemasJuntadas], [TX.bichos, J.kills], [TX.maxCombo, J.maxCombo], [TX.tiempo, reloj(J.t)], [TX.totalGemas, G.totalGemas]];
  let y = y0 + 52;
  for (const [k, v] of filas) { texto(L(k), 16, y, { al: "izq" }); texto(String(v), W - 16, y, { al: "der", color: "acento" }); y += 14; }
  if (J.nuevos && J.nuevos.length) { y += 4; texto(L(TX.desbloqueado), W / 2, y, { color: "acento" }); y += 12; for (const n of J.nuevos) { texto(n, W / 2, y); y += 11; } }
  uiEmpezar("fin");
  const bw = 100, x = Math.round(W / 2 - bw / 2); y = Math.max(y + 12, Math.round(H * 0.66));
  boton(x, y, bw, 18, TX.otraVez, () => { nuevaPartida(); }); y += 24;
  boton(x, y, bw, 18, TX.menu, () => { irA("menu"); tocarTema("titulo"); });
  uiProcesar(null);
}
const reloj = (s) => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
