// ─────────────────────────────────────────────────────────────────────────────
// EL ARRANQUE: bucle a paso fijo (60 Hz; la entrada se consume al final de cada paso), el reparto
// por pantalla y las sondas del banco de pruebas (window.__WG).
// ─────────────────────────────────────────────────────────────────────────────

const PANTALLAS = { titulo: pantallaTitulo, tienda: pantallaTienda, objeto: pantallaObjeto, opciones: pantallaOpciones, fin: pantallaFin, ganaste: pantallaGanaste, creditos: pantallaCreditos };
let _acum = 0, _ultimo = 0;
_completaPendiente = matchMedia("(pointer: coarse)").matches;

function pasoArenaYDibujo(dt) {
  if (!M.pausa) pasoArena(dt);
  if (PANT !== "arena") return;             // el paso pudo cambiar de pantalla (ganar, objeto, fin)
  dibujarFondo(M.t, true);
  g.save();
  const sx = M.temblor ? (V.f() - 0.5) * M.temblor : 0, sy = M.temblor ? (V.f() - 0.5) * M.temblor : 0;
  g.translate(Math.round(M.camX + sx), Math.round(M.camY + sy));
  dibujarAyudaPiso();
  dibujarMundo();
  g.restore();
  dibujarHUD(dt);
  if (M.pausa) pantallaPausa();
}
function cuadro(dt) {
  UI.t += dt;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  if (PANT === "arena" && M) pasoArenaYDibujo(dt);
  else (PANTALLAS[PANT] || pantallaTitulo)(dt);
  dibujarAviso(dt);
  finCuadroEntrada();
}
function bucle(t) {
  requestAnimationFrame(bucle);
  if (!_ultimo) _ultimo = t;
  _acum += Math.min(100, t - _ultimo); _ultimo = t;
  const paso = 1000 / 60;
  let pasos = 0; while (_acum >= paso && pasos < 4) { _acum -= paso; pasos++; }
  if (_acum > paso) _acum = 0;                     // atrasado de verdad: se pierde tiempo, no se acumula
  // un solo dibujo por cuadro: si el teléfono se atrasa, los pasos de más avanzan la arena sin dibujar
  for (let i = 0; i < pasos; i++) {
    if (i < pasos - 1 && PANT === "arena" && M && !M.pausa) { pasoArena(1 / 60); EDGE.clear(); }
    else cuadro(1 / 60);
  }
  if (pasos) volcar();
}
document.addEventListener("visibilitychange", () => { if (document.hidden && PANT === "arena" && M && M.fase !== "muerto") M.pausa = true; });

tocarTema("titulo");
irA("titulo");
requestAnimationFrame(bucle);

window.__WG = {
  get J() { return J; }, get M() { return M; }, get PANT() { return PANT; }, G: () => G,
  nueva(ng = 0, semilla = 7) { rnd = mulberry(semilla); nuevaPartida(ng); return true; },
  comprar: (i) => comprar(i), ir: (p) => irA(p),
  /** Arma un plantel a mano: [["archer",3], ["wizard",2]…] y arranca el nivel n. */
  armar(lista, nivel = 1, objetos = []) { J.plantel = lista.map(([id, lvl]) => ({ id, lvl, res: [0, 0] })); J.nivel = nivel; J.objetos = objetos.map((k) => ({ k, lvl: 1, xp: 0 })); empezarNivel(); irA("arena"); },
  paso(n = 1, giro = 0) { for (let i = 0; i < n; i++) { IN.teclas.clear(); if (giro < 0) IN.teclas.add("izq"); if (giro > 0) IN.teclas.add("der"); if (PANT === "arena" && M && !M.pausa) pasoArena(1 / 60); finCuadroEntrada(); } IN.teclas.clear(); },
  dibujar() { cuadro(0); volcar(); },
  listo: true,
};
