// Manejar la víbora con el dedo, el mouse o el teclado.
//  - Dedo, modo "flecha" (el de siempre): la víbora va hacia donde está el
//    dedo, mirado desde el centro de la pantalla (ahí está su cabeza).
//  - Dedo, modo "joystick": donde se apoya el dedo queda la base; hacia donde
//    se arrastra, va la víbora.
//  - Turbo: el botón del rayo, o un segundo dedo en cualquier lado.
//  - Mouse: apuntar y mantener apretado para el turbo.
//  - Teclado: ← → (o A D) doblan, espacio o ↑ turbo (Escape y P, la pausa,
//    los atiende main.js).
// Todo en píxeles del lienzo (ya multiplicados por la densidad de pantalla).
export function crearEntrada(lienzo) {
  const e = {
    modo: 'flecha', dedos: new Map(), apunta: null, turboDedo: false, turboMouse: false, turboTecla: false,
    teclas: new Set(), pausa: false, joy: null, dpr: 1, botonTurbo: null, botonPausa: null, activo: false,
  };
  const aLienzo = (ev) => { const r = lienzo.getBoundingClientRect(); return [(ev.clientX - r.left) * e.dpr, (ev.clientY - r.top) * e.dpr]; };
  const dentro = (b, x, y) => b && Math.hypot(x - b.x, y - b.y) <= b.r * 1.25;

  lienzo.addEventListener('pointerdown', (ev) => {
    if (!e.activo) return;
    ev.preventDefault();
    lienzo.setPointerCapture?.(ev.pointerId);
    const [x, y] = aLienzo(ev);
    if (dentro(e.botonPausa, x, y)) { e.pausa = true; return; }
    if (ev.pointerType === 'mouse') { e.apunta = [x, y]; if (ev.button === 0) e.turboMouse = true; return; }
    if (dentro(e.botonTurbo, x, y)) { e.dedos.set(ev.pointerId, { turbo: true }); return; }
    // el segundo dedo (que no sea el de apuntar) es turbo
    const apuntando = [...e.dedos.values()].some((d) => !d.turbo);
    if (apuntando) { e.dedos.set(ev.pointerId, { turbo: true }); return; }
    e.dedos.set(ev.pointerId, { turbo: false, ox: x, oy: y });
    if (e.modo === 'joystick') e.joy = { x, y, dx: 0, dy: 0 };
    else e.apunta = [x, y];
  }, { passive: false });

  lienzo.addEventListener('pointermove', (ev) => {
    if (!e.activo) return;
    const [x, y] = aLienzo(ev);
    if (ev.pointerType === 'mouse') { e.apunta = [x, y]; return; }
    const d = e.dedos.get(ev.pointerId);
    if (!d || d.turbo) return;
    if (e.modo === 'joystick' && e.joy) { e.joy.dx = x - e.joy.x; e.joy.dy = y - e.joy.y; }
    else e.apunta = [x, y];
  });

  const soltar = (ev) => {
    if (ev.pointerType === 'mouse') { e.turboMouse = false; return; }
    const d = e.dedos.get(ev.pointerId);
    e.dedos.delete(ev.pointerId);
    if (d && !d.turbo && e.modo === 'joystick') e.joy = null;
  };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('contextmenu', (ev) => ev.preventDefault());
  for (const t of ['touchstart', 'touchmove', 'touchend']) lienzo.addEventListener(t, (ev) => { if (e.activo) ev.preventDefault(); }, { passive: false });

  window.addEventListener('keydown', (ev) => {
    if (ev.target && ev.target.tagName === 'INPUT') return;       // escribiendo el apodo
    e.teclas.add(ev.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'].includes(ev.code) && e.activo) ev.preventDefault();
  });
  window.addEventListener('keyup', (ev) => e.teclas.delete(ev.code));
  window.addEventListener('blur', () => { e.teclas.clear(); e.turboMouse = false; e.dedos.clear(); e.joy = null; });

  // El rumbo que se pide (o null: seguir derecho) mirando desde la cabeza en (cx, cy).
  e.rumbo = (actual, cx, cy, dt) => {
    const izq = e.teclas.has('ArrowLeft') || e.teclas.has('KeyA'), der = e.teclas.has('ArrowRight') || e.teclas.has('KeyD');
    if (izq || der) { e.apunta = null; return actual + (der ? 1 : -1) * 3.2 * dt * 3; }
    if (e.modo === 'joystick' && e.joy) {
      if (Math.hypot(e.joy.dx, e.joy.dy) < 8 * e.dpr) return null;
      return Math.atan2(e.joy.dy, e.joy.dx);
    }
    if (!e.apunta) return null;
    const dx = e.apunta[0] - cx, dy = e.apunta[1] - cy;
    if (Math.hypot(dx, dy) < 6 * e.dpr) return null;
    return Math.atan2(dy, dx);
  };
  e.turbo = () => e.turboMouse || e.teclas.has('Space') || e.teclas.has('ArrowUp') || e.teclas.has('KeyW') || [...e.dedos.values()].some((d) => d.turbo);
  e.sacarPausa = () => { const p = e.pausa; e.pausa = false; return p; };
  e.soltarTodo = () => { e.dedos.clear(); e.joy = null; e.turboMouse = false; e.apunta = null; };
  return e;
}
