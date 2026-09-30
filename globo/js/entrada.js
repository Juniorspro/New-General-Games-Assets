// Mover el escudo: se arrastra en CUALQUIER lado de la pantalla y el escudo
// se mueve lo mismo que el dedo (arrastre relativo, como en los juegos del
// género): así el dedo nunca tapa lo que viene. Manda el primer dedo que se
// apoya; los demás no hacen nada (una palma apoyada no lo mueve).
//  - Mouse: arrastrar con el botón apretado.
//  - Teclado: flechas o WASD (Escape y P, la pausa, los atiende main.js).
// Devuelve el arrastre acumulado en píxeles de CSS; main.js lo pasa al mundo.
export function crearEntrada(lienzo) {
  const e = { activo: false, dedo: null, ux: 0, uy: 0, dx: 0, dy: 0, teclas: new Set(), toques: 0 };

  lienzo.addEventListener('pointerdown', (ev) => {
    if (!e.activo) return;
    ev.preventDefault();
    e.toques++;
    if (e.dedo !== null) return;
    lienzo.setPointerCapture?.(ev.pointerId);
    e.dedo = ev.pointerId; e.ux = ev.clientX; e.uy = ev.clientY;
  }, { passive: false });
  lienzo.addEventListener('pointermove', (ev) => {
    if (!e.activo || ev.pointerId !== e.dedo) return;
    // los movimientos juntados por el navegador entre cuadro y cuadro (más parejo en teléfonos rápidos)
    const lista = ev.getCoalescedEvents?.() || [];
    const ult = lista.length ? lista[lista.length - 1] : ev;
    e.dx += ult.clientX - e.ux; e.dy += ult.clientY - e.uy;
    e.ux = ult.clientX; e.uy = ult.clientY;
  });
  const soltar = (ev) => { if (ev.pointerId === e.dedo) e.dedo = null; };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('lostpointercapture', soltar);
  lienzo.addEventListener('contextmenu', (ev) => ev.preventDefault());
  for (const t of ['touchstart', 'touchmove', 'touchend']) lienzo.addEventListener(t, (ev) => { if (e.activo) ev.preventDefault(); }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    e.teclas.add(ev.code);
    if (e.activo && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(ev.code)) ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => e.teclas.delete(ev.code));
  window.addEventListener('blur', () => { e.teclas.clear(); e.dedo = null; });

  // el arrastre desde la última vez (y lo pone en cero)
  e.sacar = () => { const r = [e.dx, e.dy]; e.dx = 0; e.dy = 0; return r; };
  // hacia dónde piden las teclas (-1, 0 o 1 en cada eje)
  e.flechas = () => {
    const t = e.teclas;
    return [(t.has('ArrowRight') || t.has('KeyD') ? 1 : 0) - (t.has('ArrowLeft') || t.has('KeyA') ? 1 : 0), (t.has('ArrowDown') || t.has('KeyS') ? 1 : 0) - (t.has('ArrowUp') || t.has('KeyW') ? 1 : 0)];
  };
  e.soltarTodo = () => { e.dedo = null; e.dx = 0; e.dy = 0; };
  return e;
}
