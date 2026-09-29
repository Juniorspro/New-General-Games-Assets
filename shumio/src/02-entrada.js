// ─────────────────────────────────────────────────────────────────────────────
// LA ENTRADA: dos joysticks que aparecen donde apoyás el pulgar (izquierda = moverse,
// derecha = llorar en 4 direcciones, como el original), botones de bomba, objeto activo,
// cápsula y pausa, y el teclado (WASD + flechas, E bomba, Espacio activo, Q cápsula).
// Cada dedo se sigue por su pointerId: moverse y disparar a la vez no se pisan.
// Los "flancos" (apretó recién) se consumen AL FINAL del cuadro (guía 2D § 1).
// ─────────────────────────────────────────────────────────────────────────────

const IN = { mx: 0, my: 0, dx: 0, dy: 0, teclas: new Set(), usaTactil: false };
const FLANCO = {};                         // bomba, activo, capsula, pausa, aceptar, toque:{x,y}
const STICKS = { mover: null, tirar: null };  // {id, x0, y0, x, y}
const RADIO_STICK = 26;
let BOTONES = [];                          // {id, x, y, r} en píxeles del mundo (los pone el HUD)
const dedos = new Map();

function recien(k) { return !!FLANCO[k]; }
function finEntrada() { for (const k in FLANCO) delete FLANCO[k]; }

const TECLAS = {
  KeyW: "arriba", KeyS: "abajo", KeyA: "izq", KeyD: "der",
  ArrowUp: "tArriba", ArrowDown: "tAbajo", ArrowLeft: "tIzq", ArrowRight: "tDer",
  KeyI: "tArriba", KeyK: "tAbajo", KeyJ: "tIzq", KeyL: "tDer",
};
addEventListener("keydown", (e) => {
  if (e.repeat) return;
  IN.usaTactil = false;
  FLANCO["k" + e.code] = true;          // cualquier tecla, para los menús
  const k = TECLAS[e.code];
  if (k) { IN.teclas.add(k); e.preventDefault(); }
  if (e.code === "KeyE" || e.code === "ShiftLeft") FLANCO.bomba = true;
  if (e.code === "Space") { FLANCO.activo = true; e.preventDefault(); }
  if (e.code === "KeyQ") FLANCO.capsula = true;
  if (e.code === "Escape" || e.code === "KeyP") FLANCO.pausa = true;
  if (e.code === "Enter" || e.code === "Space") FLANCO.aceptar = true;
  if (e.code === "KeyM") FLANCO.mapa = true;
  if (e.code === "KeyF") pantallaCompleta(!enPantallaCompleta());
  alGesto(null);
});
addEventListener("keyup", (e) => { const k = TECLAS[e.code]; if (k) IN.teclas.delete(k); });
addEventListener("blur", () => { IN.teclas.clear(); STICKS.mover = STICKS.tirar = null; dedos.clear(); });

function botonEn(x, y) {
  for (const b of BOTONES) if (Math.hypot(x - b.x, y - b.y) <= b.r + 4) return b;
  return null;
}
let _primerToque = true;
/** Lo que necesita un gesto de verdad (sonido, pantalla completa): se hace al levantar el dedo o
 *  al hacer clic, que es cuando el navegador lo cuenta como gesto (en Android el pointerdown no). */
function alGesto(e) {
  audioDespertar();
  if (_completaPendiente != null) pantallaCompleta(_completaPendiente);
  else if (e && e.pointerType && e.pointerType !== "mouse" && _primerToque && !enPantallaCompleta()) pantallaCompleta(true);
  if (e && e.pointerType && e.pointerType !== "mouse" && enPantallaCompleta()) _primerToque = false;
}
for (const ev of ["pointerup", "touchend", "click"]) addEventListener(ev, alGesto, { passive: true });
lienzo.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  // con el mouse el pointerdown sí cuenta como gesto; con el dedo, el audio se arma al levantarlo
  if (e.pointerType === "mouse") audioDespertar(); else IN.usaTactil = true;
  const p = aMundo(e.clientX, e.clientY);
  const d = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), que: null };
  const b = enJuego() ? botonEn(p.x, p.y) : null;
  if (b) { d.que = "boton"; FLANCO[b.id] = true; b.apretado = 8; }
  else if (enJuego() && e.pointerType !== "mouse") {   // con mouse (PC) no hay joysticks: se juega con el teclado
    if (p.x < PANT.W / 2 && !STICKS.mover) { d.que = "mover"; STICKS.mover = d; }
    else if (p.x >= PANT.W / 2 && !STICKS.tirar) { d.que = "tirar"; STICKS.tirar = d; }
  }
  dedos.set(e.pointerId, d);
  try { lienzo.setPointerCapture(e.pointerId); } catch (err) { /* ya se fue */ }
}, { passive: false });
lienzo.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") { const q = aMundo(e.clientX, e.clientY); IN.px = q.x; IN.py = q.y; IN.movio = true; }
  const d = dedos.get(e.pointerId);
  if (!d) return;
  const p = aMundo(e.clientX, e.clientY);
  d.x = p.x; d.y = p.y;
  // el joystick flota: si el dedo se va más allá del radio, la base lo sigue
  if (d.que === "mover" || d.que === "tirar") {
    const vx = d.x - d.x0, vy = d.y - d.y0, l = Math.hypot(vx, vy), max = RADIO_STICK * 1.25;
    if (l > max) { d.x0 = d.x - vx / l * max; d.y0 = d.y - vy / l * max; }
  }
}, { passive: false });
function soltarDedo(e) {
  const d = dedos.get(e.pointerId);
  if (!d) return;
  dedos.delete(e.pointerId);
  if (STICKS.mover === d) STICKS.mover = null;
  if (STICKS.tirar === d) STICKS.tirar = null;
  // un toque corto (menús)
  if (performance.now() - d.t0 < 450 && Math.hypot(d.x - d.x0, d.y - d.y0) < 14) FLANCO.toque = { x: d.x, y: d.y };
}
lienzo.addEventListener("pointerup", soltarDedo);
lienzo.addEventListener("pointercancel", soltarDedo);
lienzo.addEventListener("contextmenu", (e) => e.preventDefault());

/** Cada cuadro: los joysticks y las teclas → mover (analógico) y llorar (4 direcciones). */
function leerEntrada() {
  let mx = 0, my = 0, dx = 0, dy = 0;
  const t = IN.teclas;
  if (t.has("izq")) mx -= 1; if (t.has("der")) mx += 1; if (t.has("arriba")) my -= 1; if (t.has("abajo")) my += 1;
  if (mx && my) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
  const m = STICKS.mover;
  if (m) {
    let vx = (m.x - m.x0) / RADIO_STICK, vy = (m.y - m.y0) / RADIO_STICK, l = Math.hypot(vx, vy);
    if (l < 0.18) vx = vy = 0; else if (l > 1) { vx /= l; vy /= l; }
    mx = vx; my = vy;
  }
  // llorar: la última flecha apretada manda (como en el original: una sola dirección)
  if (t.has("tIzq")) dx = -1; else if (t.has("tDer")) dx = 1; else if (t.has("tArriba")) dy = -1; else if (t.has("tAbajo")) dy = 1;
  const s = STICKS.tirar;
  if (s) {
    const vx = s.x - s.x0, vy = s.y - s.y0;
    if (Math.hypot(vx, vy) > RADIO_STICK * 0.3) { if (Math.abs(vx) > Math.abs(vy)) { dx = sig(vx); dy = 0; } else { dx = 0; dy = sig(vy); } }
  }
  // (sonda de pruebas: un tiro forzado durante n cuadros)
  if (IN.forzarTiro) { [dx, dy] = IN.forzarTiro; if (--IN.forzarTiro[2] <= 0) IN.forzarTiro = null; }
  IN.mx = mx; IN.my = my; IN.dx = dx; IN.dy = dy;
}
