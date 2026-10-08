// porteo: jugar con teclado y mouse. La versión de Android sólo se maneja con sus controles
// táctiles (TouchControlsKit): acá cada tecla aprieta, con un dedo virtual, el control que le
// corresponde, y el mouse trabado (pointer lock) arrastra el touchpad para mirar.
//   WASD/flechas: joystick (con Shift, a fondo: corre)   mouse: mirar
//   clic izquierdo: disparar   clic derecho: aspirar   Espacio: saltar / jetpack
//   E: usar   Q: pulso de aire   G: modo artefacto   Tab/M: mapa   rueda o 1-5: ranura
export function crearControles(exp, lienzo) {
  const DEDO_JOY = 20, DEDO_PAD = 21, DEDO_BOTON = 22;
  const BOTONES = {
    Space: 'Jump', KeyE: 'Interact', KeyF: 'Interact', KeyQ: 'Burst', KeyG: 'Gadget', Tab: 'Map', KeyM: 'Map',
  };
  const teclas = new Set();
  const rects = new Map();      // control → [cx, cy, w, h, radio] (píxeles del lienzo, origen abajo)
  let ultimaConsulta = 0;
  const apretados = new Map();  // control → dedo
  let siguienteDedo = DEDO_BOTON;
  let joy = null;               // [x0, y0] donde se apoyó el dedo del joystick
  let pad = null;               // posición actual del dedo del touchpad
  let padQuieto = 0;
  let movX = 0, movY = 0;       // movimiento del mouse trabado desde el último cuadro

  function rect(nombre) {
    return rects.get(nombre);
  }

  function consultar(ahora) {
    if (ahora - ultimaConsulta < 2000) return;
    ultimaConsulta = ahora;
    for (const n of ['Joystick', 'Touchpad', 'Jump', 'Interact', 'Burst', 'Gadget', 'Map', 'Vacum', 'Attack', 'PrevSlot', 'NextSlot', 'Pause']) {
      const r = exp.ControlTactil(n);
      if (r && r.length) rects.set(n, Array.from(r)); else rects.delete(n);
    }
  }

  function tocar(dedo, fase, x, y) { exp.Toque(dedo, fase, x, y); }

  function apretar(control) {
    const r = rect(control);
    if (!r || apretados.has(control)) return;
    const d = siguienteDedo++;
    if (siguienteDedo > 40) siguienteDedo = DEDO_BOTON;
    apretados.set(control, d);
    tocar(d, 0, r[0], r[1]);
  }

  function soltar(control) {
    const d = apretados.get(control);
    if (d === undefined) return;
    apretados.delete(control);
    const r = rect(control) || [0, 0];
    tocar(d, 3, r[0], r[1]);
  }

  // un toque corto (las ranuras)
  function tocarUnaVez(control) {
    apretar(control);
    setTimeout(() => soltar(control), 80);
  }

  const trabado = () => document.pointerLockElement === lienzo;

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    teclas.add(e.code);
    const b = BOTONES[e.code];
    if (b) { apretar(b); if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); }
    if (/^Digit[1-5]$/.test(e.code)) tocarUnaVez(e.code === 'Digit1' ? 'PrevSlot' : 'NextSlot');
  });
  addEventListener('keyup', (e) => {
    teclas.delete(e.code);
    const b = BOTONES[e.code];
    if (b) soltar(b);
  });
  addEventListener('blur', () => {
    teclas.clear();
    for (const c of [...apretados.keys()]) soltar(c);
  });

  // el mouse trabado: los botones disparan y aspiran; el movimiento mira. Sin trabar, el mouse es
  // el de siempre (menús). Se escucha en la fase de captura para que main.js no lo mande como mouse.
  lienzo.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!trabado()) {
      if (exp.EnJuego() && e.button === 0 && lienzo.requestPointerLock) {
        lienzo.requestPointerLock();
        e.stopImmediatePropagation();
        e.preventDefault();
      }
      return;
    }
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.button === 0) apretar('Attack');
    else if (e.button === 2) apretar('Vacum');
  }, true);
  lienzo.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'mouse' || !trabado()) return;
    e.stopImmediatePropagation();
    if (e.button === 0) soltar('Attack');
    else if (e.button === 2) soltar('Vacum');
  }, true);
  lienzo.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !trabado()) return;
    e.stopImmediatePropagation();
    movX += e.movementX || 0;
    movY += e.movementY || 0;
  }, true);
  lienzo.addEventListener('wheel', (e) => {
    if (!trabado()) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    tocarUnaVez(e.deltaY > 0 ? 'NextSlot' : 'PrevSlot');
  }, { capture: true, passive: false });
  document.addEventListener('pointerlockchange', () => {
    if (!trabado()) { soltar('Attack'); soltar('Vacum'); }
  });

  // cada cuadro, antes de Cuadro: el joystick según las teclas y el touchpad según el mouse
  function cuadro(ahora) {
    consultar(ahora);
    // en un menú o en pausa, el mouse se suelta
    if (trabado() && !exp.EnJuego()) document.exitPointerLock();
    const j = rect('Joystick');
    const dx = (teclas.has('KeyD') || teclas.has('ArrowRight') ? 1 : 0) - (teclas.has('KeyA') || teclas.has('ArrowLeft') ? 1 : 0);
    const dy = (teclas.has('KeyW') || teclas.has('ArrowUp') ? 1 : 0) - (teclas.has('KeyS') || teclas.has('ArrowDown') ? 1 : 0);
    if (j && (dx || dy)) {
      // el centro de la zona; a 0.85 del radio camina, a fondo (con Shift) corre
      const radio = j[4] > 0 ? j[4] : Math.min(j[2], j[3]) * 0.3;
      const k = (teclas.has('ShiftLeft') || teclas.has('ShiftRight') ? 1.2 : 0.85) * radio / Math.hypot(dx, dy);
      if (!joy) { joy = [j[0], j[1]]; tocar(DEDO_JOY, 0, joy[0], joy[1]); }
      tocar(DEDO_JOY, 1, joy[0] + dx * k, joy[1] + dy * k);
    } else if (joy) {
      tocar(DEDO_JOY, 3, joy[0], joy[1]);
      joy = null;
    }
    const p = rect('Touchpad');
    if (p && (movX || movY)) {
      if (!pad) { pad = [p[0], p[1]]; tocar(DEDO_PAD, 0, pad[0], pad[1]); }
      pad = [pad[0] + movX, pad[1] - movY];
      tocar(DEDO_PAD, 1, pad[0], pad[1]);
      padQuieto = 0;
      // si se va del touchpad, se levanta y vuelve a apoyarse en el centro
      if (Math.abs(pad[0] - p[0]) > p[2] * 0.4 || Math.abs(pad[1] - p[1]) > p[3] * 0.4) { tocar(DEDO_PAD, 3, pad[0], pad[1]); pad = null; }
    } else if (pad && ++padQuieto > 6) {
      tocar(DEDO_PAD, 3, pad[0], pad[1]);
      pad = null;
    }
    movX = 0; movY = 0;
  }

  return { cuadro };
}
