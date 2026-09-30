// ─────────────────────────────────────────────────────────────────────────────
// EL ARRANQUE: el bucle a paso fijo (60 Hz; el dibujo va a lo que dé la pantalla) y las sondas
// para el banco de pruebas (window.__NC). Guía 2D § 1.
// ─────────────────────────────────────────────────────────────────────────────

const PANTALLAS = { portada: pantallaPortada, menu: pantallaMenu, personajes: pantallaPersonajes, escenarios: pantallaEscenarios, mejoras: pantallaMejoras, opciones: pantallaOpciones, resultados: pantallaResultados };
let _acum = 0, _ultimo = 0, _cuadros = 0;
// en el teléfono, la pantalla completa se pide con el primer toque (un gesto de verdad)
_completaPendiente = matchMedia("(pointer: coarse)").matches;

function cuadro() {
  if (PANT === "juego") {
    dibujarJuego();
  } else {
    PANTALLAS[PANT]();
  }
  volcar();
  finCuadroEntrada();
}
function bucle(ts) {
  requestAnimationFrame(bucle);
  const dt = Math.min(100, ts - (_ultimo || ts)); _ultimo = ts; _acum += dt;
  if (++_cuadros % 15 === 0) medir();
  let pasos = 0;
  while (_acum >= CUADRO && pasos < 4) { _acum -= CUADRO; pasos++; if (PANT === "juego" && J) pasoJuego(1 / 60); }
  if (pasos === 4) _acum = 0;
  cuadro();
}
document.addEventListener("visibilitychange", () => {
  // al salir de la app: pausa (y el audio se suspende para no gastar batería)
  if (document.hidden) { if (PANT === "juego" && J && !J.modal && !J.fin) J.pausa = true; if (AU.ctx) AU.ctx.suspend().catch(() => {}); }
  else if (AU.ctx) AU.ctx.resume().catch(() => {});
});

// ── sondas ──
window.__NC = {
  get J() { return J; }, get PANT() { return PANT; }, G: () => G, AU,
  nueva(pj = "antonia", esc = "bosque", semilla = 7) { nuevaPartida(pj, esc, semilla); PANT = "juego"; UI.pantallaFoco = null; return true; },
  paso(n = 1, mx = 0, my = 0) { for (let i = 0; i < n; i++) { IN.teclas.clear(); if (mx < 0) IN.teclas.add("izq"); if (mx > 0) IN.teclas.add("der"); if (my < 0) IN.teclas.add("arr"); if (my > 0) IN.teclas.add("aba"); pasoJuego(1 / 60); finCuadroEntrada(); } IN.teclas.clear(); },
  dibujar() { cuadro(); },
  ir(p) { irA(p); cuadro(); },
  tocar(x, y) { IN.toques.push({ x, y }); cuadro(); },
  tecla(k) { EDGE.add(k); cuadro(); },
  dar(...ks) { for (const k of ks) { if (ARMAS[k]) darArma(k); else if (EVOS[k]) { if (!J.armas.find((a) => a.k === EVOS[k].de)) darArma(EVOS[k].de); evolucionar(k); } else if (PASIVOS[k]) darPasivo(k); } recalcular(); },
  cofre(evo = true) { J.cosas.push({ tipo: "cofre", x: J.jug.x, y: J.jug.y, jefe: "mantisJefe", evo }); },
  medida() { return { W, H, PX, OFX }; },
  audio() { return { listo: AU.listo, ms: AU.msHorneo, bufs: Object.keys(AU.buf), estado: AU.ctx && AU.ctx.state, error: AU.error }; },
  listo: true,
};
requestAnimationFrame(bucle);
