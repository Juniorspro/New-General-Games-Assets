// La entrada: deslizar el dedo (o el mouse, o las flechas) y tocar.
//
// El deslizamiento sale apenas el dedo recorre el umbral, sin esperar a que
// se levante: en un juego de reflejos, esperar al `pointerup` se siente
// pegajoso. Después el origen se corre a donde está el dedo, así un mismo
// arrastre que dobla da otro deslizamiento sin levantar.
//
// Los eventos se juntan en una cola y la escena los lee en su paso; la cola
// se vacía AL FINAL del paso (si el bucle hace dos pasos en un cuadro, el
// segundo ya no los ve repetidos).
const UMBRAL_CSS = 14;       // px del navegador para que cuente como deslizamiento
const TOQUE_CSS = 10;        // si se movió menos que esto, fue un toque
const TECLAS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

export function crearEntrada(lienzo, pantalla) {
  const e = { cola: [], puntero: null, x: -1, y: -1, activo: false, teclado: false };
  const empujar = (ev) => e.cola.push(ev);

  lienzo.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    lienzo.setPointerCapture?.(ev.pointerId);
    if (e.puntero && e.puntero.id !== ev.pointerId) return;     // un solo dedo manda
    const { x, y } = pantalla.aJuego(ev.clientX, ev.clientY);
    e.puntero = { id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), deslizo: false, gx0: x, gy0: y };
    e.x = x; e.y = y; e.activo = true; e.teclado = false;
    empujar({ tipo: 'bajar', x, y });
  }, { passive: false });

  lienzo.addEventListener('pointermove', (ev) => {
    const { x, y } = pantalla.aJuego(ev.clientX, ev.clientY);
    e.x = x; e.y = y;
    const p = e.puntero;
    if (!p || p.id !== ev.pointerId) { empujar({ tipo: 'pasar', x, y }); return; }
    empujar({ tipo: 'mover', x, y });
    const dx = ev.clientX - p.ox, dy = ev.clientY - p.oy;
    if (Math.hypot(dx, dy) >= UMBRAL_CSS) {
      const [sx, sy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      empujar({ tipo: 'deslizar', dx: sx, dy: sy });
      p.ox = ev.clientX; p.oy = ev.clientY; p.deslizo = true;
    }
  });

  const soltar = (ev, cancelado) => {
    const p = e.puntero;
    if (!p || p.id !== ev.pointerId) return;
    const { x, y } = pantalla.aJuego(ev.clientX, ev.clientY);
    const recorrido = Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0);
    if (!cancelado && !p.deslizo && recorrido < TOQUE_CSS) empujar({ tipo: 'tocar', x, y });
    empujar({ tipo: 'soltar', x, y, cancelado });
    e.puntero = null; e.activo = false;
  };
  lienzo.addEventListener('pointerup', (ev) => soltar(ev, false));
  lienzo.addEventListener('pointercancel', (ev) => soltar(ev, true));
  // que el navegador no haga zoom, ni scroll, ni el menú del dedo largo
  for (const t of ['touchstart', 'touchmove', 'touchend']) lienzo.addEventListener(t, (ev) => ev.preventDefault(), { passive: false });
  lienzo.addEventListener('contextmenu', (ev) => ev.preventDefault());

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    e.teclado = true;
    if (TECLAS[ev.code]) { ev.preventDefault(); empujar({ tipo: 'deslizar', dx: TECLAS[ev.code][0], dy: TECLAS[ev.code][1], tecla: ev.code }); return; }
    if (ev.code === 'Enter' || ev.code === 'Space') { ev.preventDefault(); empujar({ tipo: 'confirmar' }); return; }
    if (ev.code === 'Escape' || ev.code === 'KeyP') { empujar({ tipo: 'atras' }); }
  });

  // La escena mira la cola con esto; el bucle la vacía después del paso.
  e.de = (tipo) => e.cola.filter((ev) => ev.tipo === tipo);
  e.vaciar = () => { e.cola.length = 0; };
  return e;
}
