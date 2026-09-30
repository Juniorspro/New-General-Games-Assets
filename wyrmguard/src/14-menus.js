// ─────────────────────────────────────────────────────────────────────────────
// LOS MENÚS: portada con el logo, opciones, pausa, perder, ganar y créditos.
// El logo es nuestro: "WYRMGUARD" con la letra del juego agrandada, donde cada píxel es un
// cuadradito redondeado como los de la víbora, con los colores de las clases corriendo por las
// letras (el ícono del original es una víbora de colores; acá la víbora ES el nombre).
// ─────────────────────────────────────────────────────────────────────────────

let PANT = "titulo";
const MN = { t: 0, op: null, volver: "titulo" };
function irA(p) {
  const antes = PANT; PANT = p; UI.t = 0; IN.toques.length = 0;
  if (p === "titulo") { tocarTema("titulo"); M = null; }
  if (p === "tienda") entrarTienda();
  if (p === "objeto") entrarObjeto();
  if (p === "opciones") MN.volver = antes === "opciones" ? MN.volver : antes;
  if (p === "ganaste") ganarPartida();
}

// ── el logo ──
let _logo = null;
function pixelesLogo() {
  if (_logo && _logo.ok === FUENTE_OK) return _logo;
  const s = "WYRMGUARD", w = anchoTexto(s) + 2, c = document.createElement("canvas"); c.width = w; c.height = 12;
  const q = c.getContext("2d"); q.font = _fuente(); q.fillStyle = "#fff"; q.fillText(s, 1, 9);
  const d = q.getImageData(0, 0, w, 12).data, px = [];
  for (let y = 0; y < 12; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 110) px.push([x, y]);
  _logo = { px, w, ok: FUENTE_OK }; return _logo;
}
const ARCO = ["red", "orange", "yellow", "green", "blue", "blue2", "purple", "fg"];
function dibujarLogo(cx, cy, t, esc = 4) {
  const L0 = pixelesLogo(), w = L0.w * esc, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - 6 * esc);
  // la sombra primero, después los cuadraditos
  for (const [x, y] of L0.px) { const ola = Math.round(Math.sin(t * 3 + x * 0.35) * 1.5); cajaRed(x0 + x * esc + 1, y0 + y * esc + ola + 2, esc - 1, esc - 1, "#1c1c1c", 1); }
  for (const [x, y] of L0.px) {
    const ola = Math.round(Math.sin(t * 3 + x * 0.35) * 1.5), k = Math.floor((x * 0.18 - t * 1.2) % ARCO.length + ARCO.length) % ARCO.length;
    cajaRed(x0 + x * esc, y0 + y * esc + ola, esc - 1, esc - 1, COL[ARCO[k]], 1);
  }
}

// ── la portada: una víbora de adorno dando vueltas en la arena ──
const DEMO = { cuerpo: [], t: 0 };
function demoVibora(dt) {
  DEMO.t += dt;
  const t = DEMO.t, hx = AR.cx + Math.cos(t * 0.7) * AR.w * 0.36 + Math.cos(t * 1.9) * 20, hy = AR.cy + Math.sin(t * 1.1) * AR.h * 0.32;
  DEMO.cuerpo.unshift({ x: hx, y: hy }); if (DEMO.cuerpo.length > 200) DEMO.cuerpo.length = 200;
  const cols = ["red", "orange", "yellow", "green", "blue", "purple", "fg"];
  let acum = 0, k = 1;
  for (let i = 1; i < DEMO.cuerpo.length && k < 7; i++) { acum += Math.hypot(DEMO.cuerpo[i].x - DEMO.cuerpo[i - 1].x, DEMO.cuerpo[i].y - DEMO.cuerpo[i - 1].y); if (acum >= 10.4 * k) { const p = DEMO.cuerpo[i]; redondo(p.x, p.y, 9, 9, 0, COL[cols[k]], 3); k++; } }
  redondo(hx, hy, 9, 9, 0, COL[cols[0]], 3);
}
function pantallaTitulo(dt) {
  MN.t += dt;
  dibujarFondo(MN.t, true);
  demoVibora(dt);
  g.fillStyle = "rgba(41,41,41,0.55)"; g.fillRect(0, 0, W, H);
  dibujarLogo(W / 2, 56, MN.t, 4);
  const es = IDIOMA === "es";
  texto(es ? "[fg]una víbora de héroes" : "[fg]a snake of heroes", W / 2, 84, { col: "fg" });
  let y = 104; const bw = 110, bx = Math.round(W / 2 - bw / 2);
  if (G.partida) { if (boton(bx, y, bw, 17, `${es ? "seguir" : "continue"} - ${es ? "nivel" : "level"} ${G.partida.nivel}`, { col: "green" })) { seguirPartida(); return; } y += 21; }
  if (boton(bx, y, bw, 17, es ? "nueva partida" : "new run", { col: G.partida ? null : "green" })) { nuevaPartida(G.ng); return; }
  y += 21;
  if (G.ngMax > 0) {
    if (boton(bx, y, 18, 15, "<", { apagado: G.ng <= 0 })) { G.ng--; guardar(); }
    texto(`ng+${G.ng}`, W / 2, y + 4, { col: G.ng ? "yellow" : "fg" });
    if (boton(bx + bw - 18, y, 18, 15, ">", { apagado: G.ng >= G.ngMax })) { G.ng++; guardar(); }
    y += 19;
  }
  if (boton(bx, y, bw, 15, es ? "opciones" : "options")) { irA("opciones"); return; }
  y += 19;
  if (boton(bx, y, bw, 15, es ? "créditos" : "credits")) { irA("creditos"); return; }
  if (G.record.nivel) texto(`[bg10]${es ? "mejor nivel" : "best level"}: [yellow]${G.record.nivel}[bg10]  ·  ${es ? "ganadas" : "wins"}: [yellow]${G.record.ganadas}`, W / 2, H - 12, {});
}

// ── opciones ──
function pantallaOpciones(dt) {
  MN.t += dt;
  dibujarFondo(MN.t, MN.volver === "arena");
  if (MN.volver === "arena" && M) { dibujarMundo(); }
  g.fillStyle = "rgba(30,30,30,0.9)"; g.fillRect(0, 0, W, H);
  const es = IDIOMA === "es", bw = 170, bx = Math.round(W / 2 - bw / 2);
  texto(es ? "opciones" : "options", W / 2, 14, { esc: 2, ola: 1 });
  let y = 44;
  const fila = (txt, menos, mas) => {
    texto(txt, bx, y + 4, { al: "izq" });
    if (boton(bx + bw - 40, y, 18, 15, "-")) menos();
    if (boton(bx + bw - 18, y, 18, 15, "+")) mas();
    y += 20;
  };
  fila(`${es ? "música" : "music"}: [yellow]${Math.round(G.op.musica * 10)}`, () => { G.op.musica = Math.max(0, Math.round(G.op.musica * 10 - 1) / 10); volumenes(); guardar(); }, () => { G.op.musica = Math.min(1, Math.round(G.op.musica * 10 + 1) / 10); volumenes(); guardar(); });
  fila(`${es ? "efectos" : "sound effects"}: [yellow]${Math.round(G.op.efectos * 10)}`, () => { G.op.efectos = Math.max(0, Math.round(G.op.efectos * 10 - 1) / 10); volumenes(); guardar(); sfx("clic"); }, () => { G.op.efectos = Math.min(1, Math.round(G.op.efectos * 10 + 1) / 10); volumenes(); guardar(); sfx("clic"); });
  if (boton(bx, y, bw, 15, `${es ? "temblor de pantalla" : "screen shake"}: ${G.op.temblor ? (es ? "sí" : "on") : "no"}`)) { G.op.temblor = G.op.temblor ? 0 : 1; guardar(); }
  y += 20;
  if (boton(bx, y, bw, 15, es ? "idioma: español" : "language: english")) { cambiarIdioma(); }
  y += 20;
  if (boton(bx, y, bw, 15, es ? "pantalla completa" : "fullscreen")) { pedirCompleta(); }
  y += 26;
  if (boton(bx, y, bw, 17, es ? "volver" : "back", { col: "green" }) || recien("atras")) { PANT = MN.volver || "titulo"; if (PANT === "arena" && M) M.pausa = true; IN.toques.length = 0; }
}

// ── la pausa (en la arena) ──
function pantallaPausa() {
  g.fillStyle = "rgba(30,30,30,0.85)"; g.fillRect(0, 0, W, H);
  const es = IDIOMA === "es", bw = 130, bx = Math.round(W / 2 - bw / 2);
  texto(es ? "pausa" : "paused", W / 2, 22, { esc: 2, ola: 1 });
  texto(es ? "[bg10]mitad izquierda: dobla a la izquierda      mitad derecha: dobla a la derecha" : "[bg10]left half: turn left      right half: turn right", W / 2, 50, {});
  let y = 72;
  if (boton(bx, y, bw, 17, es ? "seguir" : "resume", { col: "green" }) || recien("atras")) { M.pausa = false; IN.toques.length = 0; return; }
  y += 22;
  if (boton(bx, y, bw, 15, es ? "reiniciar nivel" : "restart level")) { empezarNivel(); return; }
  y += 20;
  if (boton(bx, y, bw, 15, es ? "opciones" : "options")) { irA("opciones"); return; }
  y += 20;
  if (boton(bx, y, bw, 15, es ? "salir al menú" : "main menu")) { guardarPartida(); irA("titulo"); return; }
  // el armado, para mirarlo con calma
  y += 26;
  texto(es ? "tu armado" : "your build", W / 2, y, {});
  const n = J.plantel.length, x0 = Math.round(W / 2 - (n * 14) / 2);
  J.plantel.forEach((p, i) => cuadroHeroe(x0 + i * 14, y + 12, p.id, p.lvl));
  const m = J.objetos.length, x1 = Math.round(W / 2 - (m * 16) / 2);
  J.objetos.forEach((o, i) => g.drawImage(runa(o.k, 13, COL.fgAlt), x1 + i * 16, y + 28));
}

// ── perder ──
function pantallaFin(dt) {
  MN.t += dt;
  dibujarFondo(MN.t, true);
  if (M) dibujarMundo();
  g.fillStyle = "rgba(30,30,30,0.86)"; g.fillRect(0, 0, W, H);
  const es = IDIOMA === "es";
  texto(es ? "[red]perdiste" : "[red]you died", W / 2, 30, { esc: 2, ola: 1 });
  const s = J.stats;
  const filas = [
    `[fg]${es ? "llegaste al nivel" : "reached level"} [yellow]${J.nivel}[fg]/25${J.ng ? `  ng+${J.ng}` : ""}`,
    `[fg]${es ? "enemigos" : "enemies killed"}: [yellow]${s.muertes + (M ? M.muertes : 0)}`,
    `[fg]${es ? "daño hecho" : "damage dealt"}: [yellow]${Math.round(s.dano + (M ? M.danoHecho : 0))}`,
    `[fg]${es ? "oro ganado" : "gold earned"}: [yellow]${s.oroTotal}`,
  ];
  filas.forEach((f, i) => texto(f, W / 2, 64 + i * 12, {}));
  const n = J.plantel.length, x0 = Math.round(W / 2 - (n * 14) / 2);
  J.plantel.forEach((p, i) => cuadroHeroe(x0 + i * 14, 118, p.id, p.lvl));
  const bw = 120, bx = Math.round(W / 2 - bw / 2);
  if (boton(bx, 144, bw, 17, es ? "otra partida" : "try again", { col: "green" })) { nuevaPartida(J.ng); return; }
  if (boton(bx, 166, bw, 15, es ? "menú" : "main menu")) { irA("titulo"); return; }
}

// ── ganar (nivel 25) ──
function ganarPartida() {
  G.record.ganadas++;
  if (J.ng >= G.ngMax) G.ngMax = Math.min(5, J.ng + 1);
  G.ng = Math.min(G.ngMax, J.ng + 1);
  G.partida = null; guardar();
  tocarTema("victoria", { bucle: false }); AU.despues = "titulo";
  sfx("gana", 0.8);
}
function pantallaGanaste(dt) {
  MN.t += dt;
  dibujarFondo(MN.t, true);
  demoVibora(dt);
  g.fillStyle = "rgba(30,30,30,0.7)"; g.fillRect(0, 0, W, H);
  const es = IDIOMA === "es";
  dibujarLogo(W / 2, 34, MN.t, 3);
  texto(es ? "[yellow]¡felicitaciones!" : "[yellow]congratulations!", W / 2, 58, { esc: 2, ola: 1.5 });
  texto(`[fg]${es ? "ganaste" : "you beat"} ${J.ng ? `ng+${J.ng}` : es ? "el juego" : "the game"}  ·  ${es ? "se destrabó" : "unlocked"} [yellow]ng+${Math.min(5, J.ng + 1)}`, W / 2, 86, {});
  texto(es ? "[bg10]en ng+ los enemigos pegan más y entran más héroes en la víbora" : "[bg10]on ng+ enemies hit harder and your party can grow bigger", W / 2, 99, {});
  texto(es ? "tu armado" : "your build", W / 2, 118, {});
  const n = J.plantel.length, x0 = Math.round(W / 2 - (n * 14) / 2);
  J.plantel.forEach((p, i) => cuadroHeroe(x0 + i * 14, 130, p.id, p.lvl));
  const m = J.objetos.length, x1 = Math.round(W / 2 - (m * 16) / 2);
  J.objetos.forEach((o, i) => g.drawImage(runa(o.k, 13, COL.fg), x1 + i * 16, 146));
  const bw = 130, bx = Math.round(W / 2 - bw / 2);
  if (boton(bx, 170, bw, 17, `${es ? "jugar" : "play"} ng+${G.ng}`, { col: "green" })) { nuevaPartida(G.ng); return; }
  if (boton(bx, 192, bw, 15, es ? "menú" : "main menu")) { irA("titulo"); return; }
}

// ── créditos ──
function pantallaCreditos(dt) {
  MN.t += dt;
  dibujarFondo(MN.t, false);
  const es = IDIOMA === "es";
  dibujarLogo(W / 2, 30, MN.t, 3);
  const f = [
    es ? "[fg]un homenaje a [yellow]SNKRX[fg] de [yellow]a327ex[fg] (reglas y números tomados de su código, MIT)" : "[fg]a homage to [yellow]SNKRX[fg] by [yellow]a327ex[fg] (rules and numbers from its MIT source)",
    es ? "[fg]letra: [yellow]PixulBrush[fg] de [yellow]Mercyssh[fg] - mercyssh.itch.io (con tildes agregadas)" : "[fg]font: [yellow]PixulBrush[fg] by [yellow]Mercyssh[fg] - mercyssh.itch.io (accents added)",
    es ? "[fg]código, dibujos, nombres, música y sonidos: hechos para este juego" : "[fg]code, art, names, music and sounds: made for this game",
    es ? "[bg10]todo va en un solo archivo, sin conexión" : "[bg10]everything lives in a single offline file",
  ];
  f.forEach((l, i) => renglones(l, W - 40).forEach((r, j) => texto(r, W / 2, 62 + i * 24 + j * 10, {})));
  if (boton(W / 2 - 50, H - 30, 100, 17, es ? "volver" : "back", { col: "green" }) || recien("atras")) irA("titulo");
}
