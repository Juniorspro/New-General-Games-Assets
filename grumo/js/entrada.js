// Los controles: teclado (flechas o A/D para moverse; espacio, W, Z o
// flecha arriba para saltar) y, en el teléfono, tres botones de plastilina
// abajo: izquierda y derecha con el pulgar izquierdo, saltar con el
// derecho. Cada dedo va por su id: se puede correr y saltar a la vez, y
// deslizar el pulgar de una flecha a la otra sin levantarlo.
//
// main.js le dice dónde está cada botón (en píxeles de CSS) con `zonas`.
const IZQ = ['ArrowLeft', 'KeyA'], DER = ['ArrowRight', 'KeyD'], SALTO = ['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyK'];

export function crearEntrada(lienzo) {
  const e = {
    activo: false, teclas: new Set(), dedos: new Map(), zonas: null, usos: 0, tactil: false,
    empujes: [],                       // arrastres del dedo en el menú (empujan el título)
  };
  addEventListener('keydown', (ev) => {
    if (![...IZQ, ...DER, ...SALTO].includes(ev.code)) return;
    if (e.activo) { ev.preventDefault(); e.usos++; }
    e.teclas.add(ev.code);
  });
  addEventListener('keyup', (ev) => e.teclas.delete(ev.code));
  addEventListener('blur', () => { e.teclas.clear(); e.dedos.clear(); });

  // qué botón hay en (x, y): la zona de abajo se parte en tres, generosa
  // (el pulgar no apunta: cae más o menos ahí)
  function boton(x, y) {
    const z = e.zonas;
    if (!z || y < z.techo) return null;
    if (x >= z.corte) return 'salto';
    return x < z.medio ? 'izq' : 'der';
  }
  let ultimo = { x: 0, y: 0 };
  lienzo.addEventListener('pointerdown', (ev) => {
    ultimo = { x: ev.clientX, y: ev.clientY };
    if (!e.activo) return;
    ev.preventDefault();
    if (ev.pointerType === 'touch') e.tactil = true;
    const b = boton(ev.clientX, ev.clientY);
    if (!b) return;
    lienzo.setPointerCapture?.(ev.pointerId);
    e.usos++;
    e.dedos.set(ev.pointerId, b);
  }, { passive: false });
  lienzo.addEventListener('pointermove', (ev) => {
    if (e.dedos.has(ev.pointerId)) {
      // la flecha se cambia deslizando; el salto se queda salto
      const b = boton(ev.clientX, ev.clientY), antes = e.dedos.get(ev.pointerId);
      if (b && antes !== 'salto' && b !== 'salto') e.dedos.set(ev.pointerId, b);
    } else if (ev.buttons) e.empujes.push(ev.clientX - ultimo.x);
    ultimo = { x: ev.clientX, y: ev.clientY };
  });
  const soltar = (ev) => { e.dedos.delete(ev.pointerId); };
  lienzo.addEventListener('pointerup', soltar);
  lienzo.addEventListener('pointercancel', soltar);
  lienzo.addEventListener('lostpointercapture', soltar);
  lienzo.addEventListener('contextmenu', (ev) => ev.preventDefault());
  for (const t of ['touchstart', 'touchmove', 'touchend']) lienzo.addEventListener(t, (ev) => { if (e.activo) ev.preventDefault(); }, { passive: false });

  const alguna = (lista) => lista.some((k) => e.teclas.has(k));
  // el control de este momento: { dir: -1 | 0 | 1, salto }
  e.leer = () => {
    let izq = alguna(IZQ), der = alguna(DER), salto = alguna(SALTO);
    for (const b of e.dedos.values()) { if (b === 'izq') izq = true; else if (b === 'der') der = true; else salto = true; }
    return { dir: izq === der ? 0 : izq ? -1 : 1, salto };
  };
  e.apretados = () => { const s = new Set(e.dedos.values()); if (alguna(IZQ)) s.add('izq'); if (alguna(DER)) s.add('der'); if (alguna(SALTO)) s.add('salto'); return s; };
  e.sacarEmpujes = () => { const r = e.empujes; e.empujes = []; return r; };
  e.soltarTodo = () => { e.dedos.clear(); e.teclas.clear(); e.empujes = []; };
  return e;
}
