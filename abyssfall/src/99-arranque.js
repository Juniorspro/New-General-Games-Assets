// ─────────────────────────────────────────────────────────────────────────────
// EL ARRANQUE: bucle a paso fijo (60 Hz), la pausa, y las sondas del banco de pruebas (window.__AB).
// ─────────────────────────────────────────────────────────────────────────────

const PANTALLAS = { titulo: pantallaTitulo, menu: pantallaMenu, estilos: pantallaEstilos, paletas: pantallaPaletas, opciones: pantallaOpciones };
let _acum = 0, _ultimo = 0, _n = 0;
_completaPendiente = matchMedia("(pointer: coarse)").matches;

function cuadro() {
  if (PANT === "juego" && J) {
    dibujarJuego();
    if (J.fase === "mejora") pantallaMejora();
    else if (J.fase === "fin") pantallaFin();
    else if (J.pausa) pantallaPausa();
    else {
      // la pausa: el ícono de arriba al centro, o Esc / P
      if (recien("atras") || recien("pausa") || IN.toques.some((t) => t.y < 20 && Math.abs(t.x - W / 2 - 4) < 14)) { J.pausa = true; UI.pantallaFoco = null; sfx("clic"); }
    }
  } else PANTALLAS[PANT]();
  volcar();
  finCuadroEntrada();
}
function bucle(ts) {
  requestAnimationFrame(bucle);
  const dt = Math.min(100, ts - (_ultimo || ts)); _ultimo = ts; _acum += dt;
  if (++_n % 15 === 0) medir();
  let pasos = 0;
  while (_acum >= CUADRO && pasos < 4) { _acum -= CUADRO; pasos++; if (PANT === "juego" && J) { pasoJuego(1 / 60); if (pasos === 1) EDGE.forEach((k) => { if (k === "salto") EDGE.delete(k); }); } }
  if (pasos === 4) _acum = 0;
  cuadro();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (PANT === "juego" && J && J.fase === "juego") J.pausa = true; if (AU.ctx) AU.ctx.suspend().catch(() => {}); }
  else if (AU.ctx) AU.ctx.resume().catch(() => {});
});

window.__AB = {
  get J() { return J; }, get PANT() { return PANT; }, G: () => G,
  nueva(semilla = 7) { nuevaPartida(semilla); PANT = "juego"; return true; },
  paso(n = 1, o = {}) { for (let i = 0; i < n; i++) { IN.teclas.clear(); if (o.izq) IN.teclas.add("izq"); if (o.der) IN.teclas.add("der"); if (o.salto) IN.teclas.add("salto"); if (o.press) EDGE.add("salto"); pasoJuego(1 / 60); finCuadroEntrada(); } IN.teclas.clear(); },
  dibujar() { cuadro(); }, ir(p) { irA(p); cuadro(); },
  nivel(z, n) { J.zona = z; J.nivel = n; empezarNivel(); },
  listo: true,
};
requestAnimationFrame(bucle);
