// ─────────────────────────────────────────────────────────────────────────────
// LA ENTRADA: en el juego sólo te movés (las armas tiran solas). En el teléfono, un joystick que
// nace donde apoyás el dedo, en cualquier parte de la pantalla, como el original en celular.
// En la PC, WASD o flechas. Los menús se tocan/clickean o se manejan con flechas + Enter.
// ─────────────────────────────────────────────────────────────────────────────

const IN = { x: 0, y: 0, teclas: new Set(), palo: null, toques: [], raton: null };
// flancos de un cuadro: se consumen AL FINAL del cuadro (guía 2D § 1: si no, nunca dan verdadero)
const EDGE = new Set();
const RADIO_PALO = 22;

const TECLA = { ArrowUp: "arr", KeyW: "arr", ArrowDown: "aba", KeyS: "aba", ArrowLeft: "izq", KeyA: "izq", ArrowRight: "der", KeyD: "der",
  Enter: "ok", Space: "ok", NumpadEnter: "ok", Escape: "atras", KeyP: "pausa", Backspace: "atras" };

addEventListener("keydown", (e) => {
  const k = TECLA[e.code];
  if (k) { if (!e.repeat) EDGE.add(k); IN.teclas.add(k); e.preventDefault(); }
  alGesto();
});
addEventListener("keyup", (e) => { const k = TECLA[e.code]; if (k) IN.teclas.delete(k); });
addEventListener("blur", () => { IN.teclas.clear(); IN.palo = null; });

// ── el dedo: un joystick flotante + toques para los menús ──
lienzo.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = aJuego(e.clientX, e.clientY);
  if (!IN.palo) IN.palo = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t: performance.now(), mouse: e.pointerType === "mouse" };
  // con mouse, el pointerdown SÍ es gesto para el navegador: el audio puede arrancar ya
  if (e.pointerType === "mouse") alGesto();
  try { lienzo.setPointerCapture(e.pointerId); } catch (er) {}
}, { passive: false });
lienzo.addEventListener("pointermove", (e) => {
  const p = aJuego(e.clientX, e.clientY);
  IN.raton = p; p.movido = e.pointerType === "mouse";
  if (IN.palo && IN.palo.id === e.pointerId) { IN.palo.x = p.x; IN.palo.y = p.y; }
});
function soltar(e) {
  const pl = IN.palo;
  if (pl && pl.id === e.pointerId) {
    const p = aJuego(e.clientX, e.clientY);
    // un toque (poco movimiento y corto) es un "click" para los menús
    if (Math.hypot(p.x - pl.x0, p.y - pl.y0) < 7 && performance.now() - pl.t < 600) IN.toques.push({ x: p.x, y: p.y });
    IN.palo = null;
  }
  alGesto();
}
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", (e) => { if (IN.palo && IN.palo.id === e.pointerId) IN.palo = null; });
// en Android el pointerdown de un dedo NO cuenta como gesto (memoria/juegos.md): touchend y click sí
lienzo.addEventListener("touchend", alGesto, { passive: true });
lienzo.addEventListener("click", alGesto);
lienzo.addEventListener("contextmenu", (e) => e.preventDefault());

let _completaPendiente = false;
function alGesto() {
  audioDespertar();
  if (_completaPendiente) { _completaPendiente = false; pedirCompleta(); }
}

/** El vector de movimiento de este cuadro (-1..1), del teclado o del joystick. */
function leerMovimiento() {
  let x = 0, y = 0;
  if (IN.teclas.has("izq")) x -= 1; if (IN.teclas.has("der")) x += 1;
  if (IN.teclas.has("arr")) y -= 1; if (IN.teclas.has("aba")) y += 1;
  if (x || y) { const n = Math.hypot(x, y); x /= n; y /= n; }
  const pl = IN.palo;
  if (pl) {
    let dx = pl.x - pl.x0, dy = pl.y - pl.y0;
    const d = Math.hypot(dx, dy);
    // el palo "arrastra" su base si el dedo se va lejos: así nunca queda trabado en el borde
    if (d > RADIO_PALO) { pl.x0 = pl.x - dx / d * RADIO_PALO; pl.y0 = pl.y - dy / d * RADIO_PALO; dx = pl.x - pl.x0; dy = pl.y - pl.y0; }
    const m = Math.hypot(dx, dy);
    if (m > 2) { const f = Math.min(1, (m - 2) / (RADIO_PALO * 0.55)); x = dx / m * f; y = dy / m * f; }
  }
  IN.x = x; IN.y = y;
  return IN;
}
/** Un toque/click dentro del rectángulo (lo consume). */
function tocado(x, y, w, h) {
  for (let i = 0; i < IN.toques.length; i++) { const t = IN.toques[i]; if (t.x >= x && t.x < x + w && t.y >= y && t.y < y + h) { IN.toques.splice(i, 1); return true; } }
  return false;
}
const recien = (k) => EDGE.has(k);
function finCuadroEntrada() { EDGE.clear(); IN.toques.length = 0; }
