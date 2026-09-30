// ─────────────────────────────────────────────────────────────────────────────
// LOS EFECTOS Y LA INTERFAZ BÁSICA: números de daño que suben y se apagan, chispas, ondas,
// rayos y la muerte en blanco de los enemigos; y el kit de botones/paneles de todos los menús
// (azules con borde dorado, como el original), manejables con el dedo, el mouse o el teclado.
// ─────────────────────────────────────────────────────────────────────────────

const TOPE_NUMEROS = 90;
function numero(x, y, txt, col) {
  if (J.numeros.length >= TOPE_NUMEROS) J.numeros.shift();
  J.numeros.push({ x, y, txt, col, t: 0.55 });
}
function pasoEfectos(dt) {
  for (let i = J.efectos.length - 1; i >= 0; i--) { const f = J.efectos[i]; f.t -= dt; if (f.vx != null) { f.x += f.vx * dt; f.y += f.vy * dt; } if (f.t <= 0) J.efectos.splice(i, 1); }
  for (let i = J.numeros.length - 1; i >= 0; i--) { const n = J.numeros[i]; n.t -= dt; n.y -= 22 * dt; if (n.t <= 0) J.numeros.splice(i, 1); }
}
function dibujarEfectos(cx, cy) {
  for (const f of J.efectos) {
    const k = f.t / f.t0, X = Math.round(f.x - cx), Y = Math.round(f.y - cy);
    if (f.tipo === "chispa") { g.globalAlpha = k; g.fillStyle = f.col; g.fillRect(X - 1, Y - 1, 2, 2); }
    else if (f.tipo === "onda") { g.globalAlpha = k * 0.8; g.strokeStyle = f.col; g.lineWidth = 1; g.beginPath(); g.arc(X, Y, f.r * (1.2 - k * 0.6), 0, TAU); g.stroke(); }
    else if (f.tipo === "muerte") {
      // el enemigo se va en blanco, achicándose y subiendo (se lee aun en una multitud)
      const s = f.spr, e = f.esc, w = s.width * e * (0.4 + k * 0.6), h = s.height * e * (0.4 + k * 0.6);
      g.globalAlpha = k; g.drawImage(blanco(s), Math.round(X - w / 2), Math.round(Y - h / 2 - (1 - k) * 6), Math.round(w), Math.round(h));
    } else if (f.tipo === "rayo") {
      g.globalAlpha = Math.min(1, k * 1.6);
      g.strokeStyle = "#c8e8ff"; g.lineWidth = 3; g.beginPath(); f.pts.forEach(([px, py], i) => (i ? g.lineTo(px - cx, py - cy) : g.moveTo(px - cx, py - cy))); g.stroke();
      g.strokeStyle = "#ffffff"; g.lineWidth = 1; g.stroke();
      g.fillStyle = "rgba(200,230,255,0.35)"; g.beginPath(); g.arc(X, Y, f.r * (1.3 - k * 0.3), 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }
}
function dibujarNumeros(cx, cy) {
  // el original: números blancos (amarillos los críticos) con contorno, chicos
  for (const n of J.numeros) texto(n.txt, n.x - cx, n.y - cy - 4, { escala: 0.8, grad: n.col, alfa: Math.min(1, n.t * 4) });
}
// ── el kit de interfaz ──
const UI = { items: [], foco: 0, pantallaFoco: null };
// Colores medidos en las capturas del original: el panel de subir de nivel es violeta pizarra liso
// con un filete dorado; las tarjetas, grises; los botones, azul (Reroll) y rojo (Skip/Banish).
const ESTILOS = {
  azul: { a: "#4a66f0", b: "#2a3cc0", borde: "#e8b860", luz: "#fff0b8", sombra: "#7a5020", brillo: 1 },
  rojo: { a: "#f25a3c", b: "#c42818", borde: "#e8b860", luz: "#fff0b8", sombra: "#7a5020", brillo: 1 },
  verde: { a: "#44b04a", b: "#22782a", borde: "#e8b860", luz: "#fff0b8", sombra: "#7a5020", brillo: 1 },
  gris: { a: "#6a6a74", b: "#4a4a54", borde: "#9a9aa4", luz: "#c8c8d0", sombra: "#2a2a30", brillo: 1 },
  oscuro: { a: "#4d4f84", b: "#45477a", borde: "#caa262", luz: "#f4dca0", sombra: "#7a5a2a" },
  tarjeta: { a: "#8e8e8e", b: "#848484", borde: "#c09050", luz: "#ecc88c", sombra: "#6a4a20" },
  elegida: { a: "#a8a8a8", b: "#9a9a9a", borde: "#ffe070", luz: "#fff6c8", sombra: "#8a6a20" },
};
/** Un panel horneado: degradé vertical, borde dorado con luz arriba y sombra abajo, esquinas cortadas. */
function panelSpr(w, h, estilo = "azul") {
  w = Math.round(w); h = Math.round(h);
  return hornear(`panel|${w}|${h}|${estilo}`, () => {
    const E = ESTILOS[estilo], c = lienzoNuevo(w, h), q = c.getContext("2d");
    const gr = q.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, E.a); gr.addColorStop(1, E.b);
    q.fillStyle = "#000"; q.fillRect(1, 0, w - 2, h); q.fillRect(0, 1, w, h - 2);
    q.fillStyle = E.borde; q.fillRect(2, 1, w - 4, h - 2); q.fillRect(1, 2, w - 2, h - 4);
    q.fillStyle = E.luz; q.fillRect(2, 1, w - 4, 1);
    q.fillStyle = E.sombra; q.fillRect(2, h - 2, w - 4, 1);
    q.fillStyle = gr; q.fillRect(3, 3, w - 6, h - 6);
    if (E.brillo) { q.fillStyle = "rgba(255,255,255,0.12)"; q.fillRect(3, 3, w - 6, Math.floor((h - 6) / 2)); }
    // los remaches dorados de las esquinas (el panel del original los tiene)
    q.fillStyle = E.luz; for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) q.fillRect(x, y, 1, 1);
    return c;
  });
}
function panel(x, y, w, h, estilo) { g.drawImage(panelSpr(w, h, estilo), Math.round(x), Math.round(y)); }
/** Un botón: se dibuja y queda anotado para el toque o el teclado. Devuelve si tiene el foco. */
function boton(x, y, w, h, etiqueta, accion, o = {}) {
  const idx = UI.items.length, foco = UI.foco === idx;
  UI.items.push({ x, y, w, h, accion, apagado: o.apagado });
  panel(x, y, w, h, o.apagado ? "gris" : o.estilo || "azul");
  if (foco && !o.sinFoco) {
    const t = (performance.now() / 400) % 1;
    g.strokeStyle = `rgba(255,255,255,${0.55 + 0.45 * Math.sin(t * TAU)})`; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  if (etiqueta != null && etiqueta !== "") {
    const esc = o.escala || (h >= 22 ? 1.3 : 1);
    if (o.sub != null) { texto(L(etiqueta), x + w / 2, y + h / 2 - 11 * esc / 2 - 4, { grad: o.apagado ? "gris" : o.grad || "blanco", escala: esc }); texto(L(o.sub), x + w / 2, y + h / 2 + 1, { escala: 0.9, grad: o.apagado ? "gris" : "blanco" }); }
    else texto(L(etiqueta), x + w / 2 + (o.dx || 0), y + h / 2 - 6 * esc, { grad: o.apagado ? "gris" : o.grad || "blanco", escala: esc });
  }
  return foco;
}
/** Corre las acciones de este cuadro: toque/click → el botón tocado; teclas → mover foco / aceptar. */
function uiProcesar(atras) {
  const it = UI.items;
  if (IN.raton && IN.raton.movido) {
    for (let i = 0; i < it.length; i++) { const b = it[i]; if (IN.raton.x >= b.x && IN.raton.x < b.x + b.w && IN.raton.y >= b.y && IN.raton.y < b.y + b.h) UI.foco = i; }
    IN.raton.movido = false;
  }
  for (const t of IN.toques) {
    for (let i = it.length - 1; i >= 0; i--) { const b = it[i]; if (t.x >= b.x && t.x < b.x + b.w && t.y >= b.y && t.y < b.y + b.h) { UI.foco = i; if (b.apagado) sfx("no"); else { sfx("clic", 0.7); b.accion(); } IN.toques.length = 0; return; } }
  }
  if (it.length) {
    if (recien("aba") || recien("der")) { UI.foco = (UI.foco + 1) % it.length; sfx("mover", 0.6); }
    if (recien("arr") || recien("izq")) { UI.foco = (UI.foco - 1 + it.length) % it.length; sfx("mover", 0.6); }
    UI.foco = lim(UI.foco, 0, it.length - 1);
    if (recien("ok")) { const b = it[UI.foco]; if (b.apagado) sfx("no"); else { sfx("clic", 0.7); b.accion(); } return; }
  }
  if (atras && (recien("atras") || recien("pausa"))) { sfx("clic", 0.6); atras(); }
}
function uiEmpezar(pantalla) { if (UI.pantallaFoco !== pantalla) { UI.pantallaFoco = pantalla; UI.foco = 0; } UI.items = []; }
/** Un texto en varios renglones; devuelve cuánto bajó. */
function parrafo(str, x, y, ancho, o = {}) {
  const rs = renglones(L(str), ancho), paso = o.paso || 10;
  rs.forEach((r, i) => texto(r, x, y + i * paso, { al: o.al || "izq", grad: o.grad }));
  return rs.length * paso;
}
