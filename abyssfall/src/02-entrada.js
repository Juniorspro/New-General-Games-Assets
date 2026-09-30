// ─────────────────────────────────────────────────────────────────────────────
// LA ENTRADA. En el teléfono, como el original en celular: el pulgar izquierdo va y viene
// (mitad izquierda: primer cuarto ◀, segundo cuarto ▶) y el derecho salta / dispara (mitad derecha).
// Multitoque de verdad: cada dedo se sigue por su pointerId, así se puede correr y disparar a la vez.
// En la PC: flechas o A/D para moverse; Espacio, Z o flecha arriba para saltar y disparar.
// ─────────────────────────────────────────────────────────────────────────────

const IN = { izq: false, der: false, salto: false, teclas: new Set(), dedos: new Map(), toques: [], tactil: false };
const EDGE = new Set();          // flancos de un cuadro: se consumen al FINAL (guía 2D § 1)
const TECLA = { ArrowLeft: "izq", KeyA: "izq", ArrowRight: "der", KeyD: "der", Space: "salto", KeyZ: "salto", ArrowUp: "salto", KeyW: "salto", KeyK: "salto",
  ArrowDown: "aba", KeyS: "aba", Enter: "ok", NumpadEnter: "ok", Escape: "atras", KeyP: "pausa", Backspace: "atras" };

addEventListener("keydown", (e) => { const k = TECLA[e.code]; if (!e.repeat) EDGE.add("k:" + e.code); if (k) { if (!e.repeat) EDGE.add(k); IN.teclas.add(k); e.preventDefault(); } alGesto(); });
addEventListener("keyup", (e) => { const k = TECLA[e.code]; if (k) IN.teclas.delete(k); });
addEventListener("blur", () => { IN.teclas.clear(); IN.dedos.clear(); });

/** Qué botón es un punto de la pantalla (en píxeles del juego). */
function zonaDe(p) { if (p.y < 44) return null; return p.x < W * 0.25 ? "izq" : p.x < W * 0.5 ? "der" : "salto"; }
lienzo.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (e.pointerType !== "mouse") IN.tactil = true;
  const p = aJuego(e.clientX, e.clientY), z = zonaDe(p);
  IN.dedos.set(e.pointerId, { x0: p.x, y0: p.y, x: p.x, y: p.y, t: performance.now(), zona: z });
  if (z === "salto") EDGE.add("salto");
  if (e.pointerType === "mouse") alGesto();          // con mouse, el pointerdown sí es gesto
  try { lienzo.setPointerCapture(e.pointerId); } catch (er) {}
}, { passive: false });
lienzo.addEventListener("pointermove", (e) => {
  const d = IN.dedos.get(e.pointerId); if (!d) return;
  const p = aJuego(e.clientX, e.clientY); d.x = p.x; d.y = p.y;
  // el pulgar izquierdo puede deslizarse entre ◀ y ▶ sin levantar el dedo
  if (d.zona === "izq" || d.zona === "der") d.zona = p.x < W * 0.25 ? "izq" : p.x < W * 0.5 ? "der" : d.zona;
});
function soltar(e) {
  const d = IN.dedos.get(e.pointerId);
  if (d) { if (Math.hypot(d.x - d.x0, d.y - d.y0) < 8 && performance.now() - d.t < 600) IN.toques.push({ x: d.x, y: d.y }); IN.dedos.delete(e.pointerId); }
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

/** El estado de los botones de este cuadro (teclado + dedos). */
function leerEntrada() {
  let izq = IN.teclas.has("izq"), der = IN.teclas.has("der"), salto = IN.teclas.has("salto");
  for (const d of IN.dedos.values()) { if (d.zona === "izq") izq = true; if (d.zona === "der") der = true; if (d.zona === "salto") salto = true; }
  IN.izq = izq && !der; IN.der = der && !izq; IN.salto = salto;
  return IN;
}
const recien = (k) => EDGE.has(k);
function finCuadroEntrada() { EDGE.clear(); IN.toques.length = 0; }
