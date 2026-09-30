// ─────────────────────────────────────────────────────────────────────────────
// LA ENTRADA. Como el original en Android ("tocá la mitad izquierda o la derecha"): mientras un dedo
// apoya en la mitad izquierda la víbora dobla a la izquierda, en la derecha a la derecha; con los dos,
// sigue derecho. En la PC: A/D o flechas, y también clic izquierdo/derecho (el m1/m2 del original).
// Los menús se tocan AL SOLTAR (un toque corto), así apoyar para doblar nunca aprieta un botón.
// ─────────────────────────────────────────────────────────────────────────────

const IN = { izq: false, der: false, teclas: new Set(), dedos: new Map(), toques: [], raton: { x: -1, y: -1, izq: false, der: false }, tactil: false };
const EDGE = new Set();          // flancos de un cuadro: se consumen al FINAL del cuadro
const TECLA = { ArrowLeft: "izq", KeyA: "izq", ArrowRight: "der", KeyD: "der", KeyE: "der", ArrowUp: "arr", KeyW: "arr", ArrowDown: "aba", KeyS: "aba",
  Enter: "ok", NumpadEnter: "ok", Space: "ok", Escape: "atras", KeyP: "atras", Backspace: "atras", KeyR: "reroll" };

addEventListener("keydown", (e) => { const k = TECLA[e.code]; if (!e.repeat) EDGE.add("k:" + e.code); if (k) { if (!e.repeat) EDGE.add(k); IN.teclas.add(k); e.preventDefault(); } alGesto(); });
addEventListener("keyup", (e) => { const k = TECLA[e.code]; if (k) IN.teclas.delete(k); });
addEventListener("blur", () => { IN.teclas.clear(); IN.dedos.clear(); IN.raton.izq = IN.raton.der = false; });

lienzo.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = aJuego(e.clientX, e.clientY);
  if (e.pointerType === "mouse") {
    IN.raton.x = p.x; IN.raton.y = p.y;
    if (e.button === 2) IN.raton.der = true; else IN.raton.izq = true;
    alGesto();                                       // con mouse, el pointerdown sí es gesto
  } else IN.tactil = true;
  IN.dedos.set(e.pointerId, { x0: p.x, y0: p.y, x: p.x, y: p.y, t: performance.now(), raton: e.pointerType === "mouse", boton: e.button });
  try { lienzo.setPointerCapture(e.pointerId); } catch (er) {}
}, { passive: false });
lienzo.addEventListener("pointermove", (e) => {
  const p = aJuego(e.clientX, e.clientY);
  if (e.pointerType === "mouse") { IN.raton.x = p.x; IN.raton.y = p.y; }
  const d = IN.dedos.get(e.pointerId); if (d) { d.x = p.x; d.y = p.y; }
});
function soltar(e) {
  const d = IN.dedos.get(e.pointerId);
  if (d) {
    // un toque: poco movimiento y corto (en la PC el clic izquierdo también cuenta)
    if (Math.hypot(d.x - d.x0, d.y - d.y0) < 10 && performance.now() - d.t < 700 && d.boton !== 2) IN.toques.push({ x: d.x, y: d.y, largo: performance.now() - d.t });
    IN.dedos.delete(e.pointerId);
  }
  if (e.pointerType === "mouse") { if (e.button === 2) IN.raton.der = false; else IN.raton.izq = false; }
  alGesto();
}
lienzo.addEventListener("pointerup", soltar);
lienzo.addEventListener("pointercancel", (e) => IN.dedos.delete(e.pointerId));
// en Android el pointerdown de un dedo NO es gesto para el navegador: touchend y click sí (memoria/juegos.md)
lienzo.addEventListener("touchend", alGesto, { passive: true });
lienzo.addEventListener("click", alGesto);
lienzo.addEventListener("contextmenu", (e) => e.preventDefault());

let _completaPendiente = false;
function alGesto() { audioDespertar(); if (_completaPendiente) { _completaPendiente = false; pedirCompleta(); } }

/** Para dónde dobla la víbora este cuadro: -1, 0 o 1. */
function leerGiro() {
  let izq = IN.teclas.has("izq"), der = IN.teclas.has("der");
  for (const d of IN.dedos.values()) {
    if (d.raton) { if (d.boton === 2) der = true; else izq = true; }
    else if (d.x < W / 2) izq = true; else der = true;
  }
  IN.izq = izq && !der; IN.der = der && !izq;
  return IN.izq ? -1 : IN.der ? 1 : 0;
}
const recien = (k) => EDGE.has(k);
function finCuadroEntrada() { EDGE.clear(); IN.toques.length = 0; }
/** ¿Hubo un toque adentro de la caja este cuadro? (lo consume) */
function tocado(x, y, w, h) {
  for (let i = 0; i < IN.toques.length; i++) { const t = IN.toques[i]; if (t.x >= x && t.x < x + w && t.y >= y && t.y < y + h) { IN.toques.splice(i, 1); return true; } }
  return false;
}
/** El mouse (o un dedo apoyado) arriba de la caja: para el resaltado y la ficha de info. */
function encima(x, y, w, h) {
  const r = IN.raton; if (r.x >= x && r.x < x + w && r.y >= y && r.y < y + h) return true;
  for (const d of IN.dedos.values()) if (!d.raton && d.x >= x && d.x < x + w && d.y >= y && d.y < y + h) return true;
  return false;
}
