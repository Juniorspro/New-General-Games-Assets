/* ============================================================================
   barro/js/controles.js — los mandos: cuatro botones de dedo (atrás,
   adelante, freno y gas) con varios toques a la vez, y el teclado. Se pueden
   mover, agrandar, hacer más transparentes, espejar para zurdos y elegir si
   vibran; todo se guarda. Pasar el dedo de ATRÁS a ADELANTE sin levantarlo
   también vale.
   ========================================================================== */
import { D, guardar } from './guardado.js';
import { t } from './textos.js';

const BOTONES = ['atras', 'adelante', 'freno', 'gas'];
const FABRICA = () => ({
  opacidad: 0.85, zurdo: false,
  b: { atras: { x: 0.14, y: 0.87, tam: 1 }, adelante: { x: 0.37, y: 0.87, tam: 1 }, freno: { x: 0.63, y: 0.89, tam: 0.85 }, gas: { x: 0.86, y: 0.85, tam: 1.2 } },
});
const ICONO = {
  atras: '<svg viewBox="0 0 64 64"><path d="M40 12 L18 32 L40 52" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  adelante: '<svg viewBox="0 0 64 64"><path d="M24 12 L46 32 L24 52" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  freno: '<svg viewBox="0 0 64 64"><rect x="14" y="22" width="36" height="20" rx="5" fill="currentColor"/></svg>',
  gas: '<svg viewBox="0 0 64 64"><path d="M14 46 L32 14 L50 46 Z" fill="currentColor"/></svg>',
};

export function crearControles(raiz) {
  const K = { raiz, botones: {}, pulsado: { atras: false, adelante: false, freno: false, gas: false }, teclas: new Set(), dedos: new Map(), editando: false, sel: null };
  K.cfg = D.ajustes.controles ? JSON.parse(JSON.stringify(D.ajustes.controles)) : FABRICA();
  for (const id of BOTONES) {
    const b = document.createElement('div');
    b.className = `boton b-${id}`; b.dataset.id = id;
    b.innerHTML = `${ICONO[id]}<span>${t(id)}</span>`;
    raiz.appendChild(b);
    K.botones[id] = b;
  }
  ubicar(K);

  const tocado = (x, y) => {
    let mejor = null, dist = Infinity;
    for (const id of BOTONES) {
      const r = K.botones[id].getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rad = r.width * 0.62;
      const d = Math.hypot(x - cx, y - cy);
      if (d < rad && d < dist) { dist = d; mejor = id; }
    }
    return mejor;
  };
  const recalcular = () => {
    for (const id of BOTONES) K.pulsado[id] = false;
    for (const id of K.dedos.values()) if (id) K.pulsado[id] = true;
    for (const id of BOTONES) K.botones[id].classList.toggle('apretado', K.pulsado[id]);
  };
  raiz.addEventListener('pointerdown', (e) => {
    const id = tocado(e.clientX, e.clientY);
    if (K.editando) {
      if (id) { K.sel = id; K.arrastre = { id, dx: e.clientX, dy: e.clientY, x0: K.cfg.b[id].x, y0: K.cfg.b[id].y }; raiz.setPointerCapture(e.pointerId); K.alElegir?.(id); marcarSel(K); }
      return;
    }
    if (!id) return;
    e.preventDefault();
    K.dedos.set(e.pointerId, id);
    try { raiz.setPointerCapture(e.pointerId); } catch { /* algunos navegadores */ }
    recalcular();
    if (D.ajustes.vibrar && navigator.vibrate) navigator.vibrate(8);
  });
  raiz.addEventListener('pointermove', (e) => {
    if (K.editando && K.arrastre) {
      const a = K.arrastre, W = window.innerWidth, H = window.innerHeight;
      const espejo = K.cfg.zurdo ? -1 : 1;
      K.cfg.b[a.id].x = Math.max(0.06, Math.min(0.94, a.x0 + espejo * (e.clientX - a.dx) / W));
      K.cfg.b[a.id].y = Math.max(0.1, Math.min(0.95, a.y0 + (e.clientY - a.dy) / H));
      ubicar(K);
      return;
    }
    if (!K.dedos.has(e.pointerId)) return;
    const id = tocado(e.clientX, e.clientY);
    const antes = K.dedos.get(e.pointerId);
    // deslizar entre atrás y adelante sin levantar el dedo
    if (id && id !== antes && (['atras', 'adelante'].includes(id) === ['atras', 'adelante'].includes(antes))) { K.dedos.set(e.pointerId, id); recalcular(); }
  });
  const soltar = (e) => { if (K.editando) { K.arrastre = null; return; } if (K.dedos.delete(e.pointerId)) recalcular(); };
  raiz.addEventListener('pointerup', soltar);
  raiz.addEventListener('pointercancel', soltar);
  raiz.addEventListener('contextmenu', (e) => e.preventDefault());

  const MAPA = { ArrowLeft: 'atras', KeyA: 'atras', ArrowRight: 'adelante', KeyD: 'adelante', ArrowDown: 'freno', KeyS: 'freno', ArrowUp: 'gas', KeyW: 'gas', Space: 'gas' };
  addEventListener('keydown', (e) => { if (MAPA[e.code]) { K.teclas.add(MAPA[e.code]); e.preventDefault(); } });
  addEventListener('keyup', (e) => { if (MAPA[e.code]) K.teclas.delete(MAPA[e.code]); });
  addEventListener('blur', () => { K.teclas.clear(); K.dedos.clear(); recalcular(); });
  K.soltarTodo = () => { K.teclas.clear(); K.dedos.clear(); recalcular(); };
  return K;
}

export function ubicar(K) {
  const W = window.innerWidth, H = window.innerHeight, base = Math.min(W, H) * 0.2;
  for (const id of BOTONES) {
    const c = K.cfg.b[id], b = K.botones[id];
    const tam = Math.round(base * c.tam);
    const x = (K.cfg.zurdo ? 1 - c.x : c.x) * W, y = c.y * H;
    b.style.width = b.style.height = tam + 'px';
    b.style.left = Math.round(x - tam / 2) + 'px'; b.style.top = Math.round(y - tam / 2) + 'px';
    b.style.opacity = K.cfg.opacidad;
  }
}
function marcarSel(K) { for (const id of BOTONES) K.botones[id].classList.toggle('elegido', K.editando && K.sel === id); }

/* lo que mandan los botones y el teclado */
export function entrada(K) {
  const p = (id) => K.pulsado[id] || K.teclas.has(id);
  return { gas: p('gas') ? 1 : 0, freno: p('freno') ? 1 : 0, inclinar: (p('adelante') ? 1 : 0) - (p('atras') ? 1 : 0) };
}

/* el editor: se prende y se apaga desde la UI */
export function editar(K, si) {
  K.editando = si; K.sel = si ? 'gas' : null; K.soltarTodo();
  K.raiz.classList.toggle('editando', si);
  marcarSel(K);
  if (!si) { D.ajustes.controles = JSON.parse(JSON.stringify(K.cfg)); guardar(); }
}
export function restablecer(K) { K.cfg = FABRICA(); ubicar(K); marcarSel(K); }
export function vibrar(ms) { if (D.ajustes.vibrar && navigator.vibrate) navigator.vibrate(ms); }
