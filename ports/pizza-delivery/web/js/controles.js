/* Los controles: en el teléfono, un joystick para caminar, el resto de la pantalla para mirar y el
   botón de pausa; se pueden mover, agrandar, hacer más transparentes y espejar para zurdos (se guarda).
   En el original la interacción es automática (al tocar las cosas): no hacen falta más botones.
   En la compu: WASD y el mouse, como el original. Tocar la pantalla = el clic de "Click to continue". */
import { D, guardar } from './guardado.js';

const IDS = ['joy', 'pausa'];
export const FABRICA = () => ({
  opacidad: 0.8, zurdo: false,
  b: { joy: { x: 0.15, y: 0.72, tam: 1 }, pausa: { x: 0.05, y: 0.09, tam: 0.6 } },
});
const ICONO = {
  correr: '<svg viewBox="0 0 64 64"><path d="M16 14 L34 32 L16 50 M32 14 L50 32 L32 50" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  saltar: '<svg viewBox="0 0 64 64"><path d="M12 42 L32 18 L52 42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  linterna: '<svg viewBox="0 0 64 64"><path d="M10 26 h16 l18 -12 v36 l-18 -12 h-16 z" fill="currentColor"/><path d="M50 22 l8 -4 M52 32 h8 M50 42 l8 4" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  usar: '<b>E</b>',
  pausa: '<svg viewBox="0 0 64 64"><rect x="16" y="14" width="11" height="36" fill="currentColor"/><rect x="37" y="14" width="11" height="36" fill="currentColor"/></svg>',
};
const BASE = { joy: 150, correr: 74, saltar: 84, linterna: 74, usar: 92, pausa: 64 };

export function crearControles(raiz) {
  const K = {
    mover: { x: 0, y: 0 }, mirar: { x: 0, y: 0 }, correr: false, saltar: false, usar: false, linterna: false, pausa: false,
    teclas: new Set(), dedos: new Map(), editando: false, sel: null, tactil: false, ejes: { x: 0, y: 0 }, correrFijo: false,
  };
  K.cfg = D.ajustes.controles ? JSON.parse(JSON.stringify(D.ajustes.controles)) : FABRICA();
  for (const id of IDS) if (!K.cfg.b[id]) K.cfg.b[id] = FABRICA().b[id];
  const el = {};
  for (const id of IDS) {
    const b = document.createElement('div');
    b.className = `ctl c-${id}`; b.dataset.id = id;
    b.innerHTML = id === 'joy' ? '<div class="perilla"></div>' : ICONO[id];
    raiz.appendChild(b); el[id] = b;
  }
  K.el = el;
  function ubicar() {
    const W = innerWidth, H = innerHeight, u = Math.min(W, H) / 400;
    for (const id of IDS) {
      const c = K.cfg.b[id], d = BASE[id] * c.tam * Math.max(0.75, Math.min(1.35, u));
      const x = (K.cfg.zurdo ? 1 - c.x : c.x) * W, y = c.y * H;
      Object.assign(el[id].style, { width: d + 'px', height: d + 'px', left: x - d / 2 + 'px', top: y - d / 2 + 'px', opacity: id === 'joy' ? K.cfg.opacidad * 0.8 : K.cfg.opacidad });
    }
  }
  K.ubicar = ubicar;
  addEventListener('resize', ubicar);
  ubicar();
  const textos = () => {};
  K.textos = textos;

  const centro = (id) => { const r = el[id].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };
  const tocado = (x, y) => {
    let mejor = null, dm = Infinity;
    for (const id of IDS) {
      if (el[id].classList.contains('oculto') && !K.editando) continue;
      const c = centro(id), d = Math.hypot(x - c.x, y - c.y), lim = id === 'joy' ? c.r * 1.35 : c.r * 1.12;
      if (d < lim && d < dm) { dm = d; mejor = id; }
    }
    return mejor;
  };
  const joy = (e, f) => {
    const c = centro('joy');
    let dx = (e.clientX - c.x) / c.r, dy = (e.clientY - c.y) / c.r;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    K.mover.x = dx; K.mover.y = -dy;
    el.joy.firstChild.style.transform = `translate(${dx * c.r * 0.55}px, ${dy * c.r * 0.55}px)`;
    if (f) f.joy = true;
  };
  raiz.addEventListener('pointerdown', (e) => {
    K.tactil = K.tactil || e.pointerType === 'touch';
    const id = tocado(e.clientX, e.clientY);
    if (K.editando) {
      if (id) { K.sel = id; K.arrastre = { id, x: e.clientX, y: e.clientY, cx: K.cfg.b[id].x, cy: K.cfg.b[id].y }; try { raiz.setPointerCapture(e.pointerId); } catch { /* */ } K.alElegir?.(id); marcar(); }
      return;
    }
    if (!id) K.toque = true;
    if (e.pointerType === 'mouse' && !id) { K.alMouse?.(e); return; }
    e.preventDefault();
    try { raiz.setPointerCapture(e.pointerId); } catch { /* */ }
    const f = { id, x: e.clientX, y: e.clientY };
    K.dedos.set(e.pointerId, f);
    if (id === 'joy') joy(e, f);
    else if (id) apretar(id, true);
  });
  raiz.addEventListener('pointermove', (e) => {
    if (K.editando && K.arrastre) {
      const a = K.arrastre, c = K.cfg.b[a.id];
      const dx = (e.clientX - a.x) / innerWidth * (K.cfg.zurdo ? -1 : 1);
      c.x = Math.min(0.97, Math.max(0.03, a.cx + dx)); c.y = Math.min(0.97, Math.max(0.03, a.cy + (e.clientY - a.y) / innerHeight));
      ubicar(); return;
    }
    const f = K.dedos.get(e.pointerId);
    if (!f) return;
    if (f.id === 'joy') joy(e);
    else if (!f.id) { K.mirar.x += e.clientX - f.x; K.mirar.y += e.clientY - f.y; }
    f.x = e.clientX; f.y = e.clientY;
  });
  const soltar = (e) => {
    if (K.editando) { if (K.arrastre) { K.arrastre = null; guardarCfg(); } return; }
    const f = K.dedos.get(e.pointerId);
    if (!f) return;
    K.dedos.delete(e.pointerId);
    if (f.id === 'joy') { K.mover.x = K.mover.y = 0; el.joy.firstChild.style.transform = ''; }
    else if (f.id) apretar(f.id, false);
  };
  raiz.addEventListener('pointerup', soltar);
  raiz.addEventListener('pointercancel', soltar);

  function apretar(id, si) {
    el[id].classList.toggle('apretado', si);
    if (si && D.ajustes.vibrar) K.vibrar?.(12);
    if (si) K[id] = true; // pausa: se consume en el cuadro
  }

  /* teclado */
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    K.teclas.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') K.pausa = true;
    if (e.code === 'Space' || e.code === 'Enter') K.toque = true;
  });
  addEventListener('keyup', (e) => K.teclas.delete(e.code));
  addEventListener('blur', () => K.teclas.clear());

  /* lo que lee el juego en cada cuadro: los ejes de Unity (suben y bajan a 3/s, como en Input) */
  K.leer = (dt) => {
    const k = K.teclas;
    const tx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ty = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const eje = (v, tg) => { if (tg && Math.sign(tg) !== Math.sign(v) && v !== 0) v = 0; const d = tg - v, p = 3 * dt; return Math.abs(d) <= p ? tg : v + Math.sign(d) * p; };
    K.ejes.x = eje(K.ejes.x, tx); K.ejes.y = eje(K.ejes.y, ty);
    const mx = Math.abs(K.mover.x) > 0.08 ? K.mover.x : 0, my = Math.abs(K.mover.y) > 0.08 ? K.mover.y : 0;
    const r = {
      x: Math.max(-1, Math.min(1, K.ejes.x + mx)), y: Math.max(-1, Math.min(1, K.ejes.y + my)),
      mx: K.mirar.x, my: K.mirar.y,
      pausa: K.pausa, toque: K.toque,
    };
    K.mirar.x = K.mirar.y = 0; K.pausa = K.toque = false;
    return r;
  };
  K.soltarTodo = () => { K.pausa = K.toque = false; K.dedos.clear(); K.mover.x = K.mover.y = 0; el.joy.firstChild.style.transform = ''; for (const id of IDS) el[id].classList.remove('apretado'); };
  K.mostrar = (si) => raiz.classList.toggle('sin-tactil', !si);

  /* el editor */
  function marcar() { for (const id of IDS) el[id].classList.toggle('elegido', K.editando && K.sel === id); }
  function guardarCfg() { D.ajustes.controles = JSON.parse(JSON.stringify(K.cfg)); guardar(); }
  K.editar = (si) => { K.editando = si; raiz.classList.toggle('editando', si); K.sel = si ? K.sel || 'joy' : null; marcar(); ubicar(); if (!si) guardarCfg(); };
  K.tam = (v) => { if (K.sel) { K.cfg.b[K.sel].tam = v; ubicar(); guardarCfg(); } };
  K.opacidad = (v) => { K.cfg.opacidad = v; ubicar(); guardarCfg(); };
  K.zurdo = (v) => { K.cfg.zurdo = v; ubicar(); guardarCfg(); };
  K.fabrica = () => { K.cfg = FABRICA(); ubicar(); guardarCfg(); };
  return K;
}
