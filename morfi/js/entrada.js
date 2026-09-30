// El dedo corta: cada dedo apoyado deja un tramo (de dónde estaba a dónde
// está) y main.js corta los hilos que ese tramo cruce. Andan varios dedos a
// la vez (con dos se cortan dos hilos juntos). Apoyar el dedo también es un
// toque: revienta el globo o hace soplar el abanico que esté abajo.
//  - Mouse: arrastrar con el botón apretado.
// Todo en píxeles de CSS; main.js lo pasa al tablero.
const VIDA_RASTRO = 0.22;      // cuánto dura el rastro blanco del dedo, en segundos

export function crearEntrada(lienzo) {
  const e = { activo: false, dedos: new Map(), cortes: [], toques: [], rastros: new Map(), usos: 0 };
  const ahora = () => performance.now() / 1000;

  lienzo.addEventListener('pointerdown', (ev) => {
    if (!e.activo) return;
    ev.preventDefault();
    lienzo.setPointerCapture?.(ev.pointerId);
    e.usos++;
    e.dedos.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    e.toques.push([ev.clientX, ev.clientY]);
    e.rastros.set(ev.pointerId, [{ x: ev.clientX, y: ev.clientY, t: ahora() }]);
  }, { passive: false });
  lienzo.addEventListener('pointermove', (ev) => {
    const d = e.dedos.get(ev.pointerId);
    if (!e.activo || !d) return;
    // los movimientos juntados por el navegador entre cuadro y cuadro: un
    // tajo rápido no se come un hilo por pasar entre dos cuadros
    const lista = ev.getCoalescedEvents?.() || [];
    const rastro = e.rastros.get(ev.pointerId) || [];
    for (const p of lista.length ? lista : [ev]) {
      if (p.clientX === d.x && p.clientY === d.y) continue;
      e.cortes.push([d.x, d.y, p.clientX, p.clientY]);
      d.x = p.clientX; d.y = p.clientY;
      rastro.push({ x: d.x, y: d.y, t: ahora() });
    }
    e.rastros.set(ev.pointerId, rastro);
  });
  const soltar = (ev) => { e.dedos.delete(ev.pointerId); };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('lostpointercapture', soltar);
  lienzo.addEventListener('contextmenu', (ev) => ev.preventDefault());
  for (const t of ['touchstart', 'touchmove', 'touchend']) lienzo.addEventListener(t, (ev) => { if (e.activo) ev.preventDefault(); }, { passive: false });
  window.addEventListener('blur', () => e.dedos.clear());

  // los tramos y los toques desde la última vez (y se vacían)
  e.sacarCortes = () => { const r = e.cortes; e.cortes = []; return r; };
  e.sacarToques = () => { const r = e.toques; e.toques = []; return r; };
  // los rastros vivos, para dibujarlos: listas de puntos con su edad (0 a 1)
  e.rastrosVivos = () => {
    const t = ahora(), out = [];
    for (const [id, r] of e.rastros) {
      const vivos = r.filter((p) => t - p.t < VIDA_RASTRO);
      if (vivos.length) { e.rastros.set(id, vivos); out.push(vivos.map((p) => ({ x: p.x, y: p.y, edad: (t - p.t) / VIDA_RASTRO }))); }
      else e.rastros.delete(id);
    }
    return out;
  };
  e.soltarTodo = () => { e.dedos.clear(); e.cortes = []; e.toques = []; e.rastros.clear(); };
  return e;
}
