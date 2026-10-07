/* Como en FNaF 2 para celular: el dedo hace de mouse y la linterna es la zona de toque (main.js). Acá solo la cruz
   de los minijuegos (WASD/flechas) y Enter donde no hay nada que tocar, más el engranaje de ajustes: volumen,
   mover/agrandar/transparentar los botones (se guarda) y volver al menú. */
import { t } from './textos.js';
import { P } from './pantalla.js';

const BASE = { ok: { x: 0.9, y: 0.7, tam: 0.8 }, cruz: { x: 0.13, y: 0.72, tam: 1 } };
export function crearControles(M, aj, guardar, caja) {
  const raiz = document.getElementById('tactil');
  const cfg = aj.botones = { opacidad: 0.6, ...(aj.botones || {}) };
  for (const k in BASE) cfg[k] = { ...BASE[k], ...(cfg[k] || {}) };
  const el = {};
  for (const k of ['ok', 'cruz']) {
    const b = document.createElement('div'); b.className = 'boton ' + k; b.dataset.k = k;
    if (k === 'cruz') b.innerHTML = '<i data-d="arr">▲</i><i data-d="aba">▼</i><i data-d="izq">◀</i><i data-d="der">▶</i>';
    raiz.appendChild(b); el[k] = b;
  }
  let teclasFrame = new Set(), visibles = new Set(), editando = false;
  const dedos = new Map();
  const CRUZ = { arr: [87, 38], aba: [83, 40], izq: [65, 37], der: [68, 39] };
  const teclasDe = (k, d) => (k === 'ok' ? [13] : CRUZ[d].filter((v) => teclasFrame.has(v)));
  function textos() { el.ok.textContent = 'OK'; }
  function ubicar() {
    const W = P.W, H = P.H, u = Math.min(W, H) / 420;
    for (const k in el) {
      const c = cfg[k], d = (k === 'cruz' ? 150 : 86) * c.tam * Math.max(0.7, Math.min(1.4, u));
      Object.assign(el[k].style, { width: d + 'px', height: d + 'px', left: c.x * W - d / 2 + 'px', top: c.y * H - d / 2 + 'px', opacity: cfg.opacidad, display: visibles.has(k) || editando ? '' : 'none' });
    }
  }
  function paraFrame(f) {
    teclasFrame = new Set();
    let mouse = false;
    for (const ev of f.eventos || []) for (const c of ev.c) {
      if (c[0] === -6 && (c[1] === -1 || c[1] === -2)) teclasFrame.add(c[6]?.[1]?.[0]);
      if (c[0] === -6 && c[1] <= -4) mouse = true;
    }
    visibles = new Set();
    const ochoDir = f.inst.some((d) => M.O[d.oi]?.movs?.some((m) => m.t === 3));
    if (ochoDir) for (const v of [37, 38, 39, 40]) teclasFrame.add(v);
    if (teclasFrame.has(87) || teclasFrame.has(83)) visibles.add('cruz');
    if (teclasFrame.has(13) && !mouse) visibles.add('ok');
    textos(); ubicar();
  }
  const apretar = (ks, on) => { for (const v of ks) M.tecla(v, on); };
  raiz.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.boton'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    try { raiz.setPointerCapture(e.pointerId); } catch { /* */ }
    const k = b.dataset.k, p = P.ev(e);
    if (editando) { dedos.set(e.pointerId, { k, mover: true, x: p.x, y: p.y, cx: cfg[k].x, cy: cfg[k].y }); return; }
    const d = e.target.dataset.d;
    const ks = teclasDe(k, d || 'arr'); if (k === 'cruz' && !d) return;
    dedos.set(e.pointerId, { k, ks }); apretar(ks, true); b.classList.add('apretado');
  });
  raiz.addEventListener('pointermove', (e) => {
    const f = dedos.get(e.pointerId); if (!f?.mover) return;
    const p = P.ev(e); const c = cfg[f.k];
    c.x = Math.min(0.97, Math.max(0.03, f.cx + (p.x - f.x) / P.W)); c.y = Math.min(0.97, Math.max(0.03, f.cy + (p.y - f.y) / P.H)); ubicar();
  });
  const soltar = (e) => {
    const f = dedos.get(e.pointerId); if (!f) return; dedos.delete(e.pointerId);
    if (f.mover) { guardar(); return; }
    apretar(f.ks, false); el[f.k].classList.remove('apretado');
  };
  raiz.addEventListener('pointerup', soltar); raiz.addEventListener('pointercancel', soltar);

  /* ajustes */
  const panel = document.getElementById('ajustes'), rueda = document.getElementById('engranaje');
  function pintar() {
    panel.innerHTML = `<h2>${t('ajustes')}</h2>
      <label>${t('volumen')} <input type="range" min="0" max="100" value="${aj.volumen ?? 100}" data-a="vol"></label>
      <label>${t('tamano')} <input type="range" min="0.6" max="1.6" step="0.05" value="${cfg.cruz.tam}" data-a="tam"></label>
      <label>${t('opacidad')} <input type="range" min="0.15" max="1" step="0.05" value="${cfg.opacidad}" data-a="op"></label>
      <button data-b="mover">${editando ? t('listo') : t('mover')}</button>
      <button data-b="reset">${t('restablecer')}</button>
      <button data-b="menu">${t('menu')}</button>
      <button data-b="cerrar">${t('cerrar')}</button>
      <p class="creditos">${t('aviso')}</p>`;
  }
  rueda.onclick = () => { pintar(); panel.hidden = false; };
  panel.addEventListener('input', (e) => {
    const a = e.target.dataset.a, v = +e.target.value;
    if (a === 'vol') { aj.volumen = v; M.sonido.ponerUsuario(v / 100); }
    if (a === 'tam') for (const k in BASE) cfg[k].tam = v;
    if (a === 'op') cfg.opacidad = v;
    guardar(); ubicar();
  });
  panel.addEventListener('click', (e) => {
    const b = e.target.dataset.b; if (!b) return;
    if (b === 'mover') { editando = !editando; ubicar(); if (editando) panel.hidden = true; else pintar(); document.body.classList.toggle('editando', editando); }
    if (b === 'reset') { for (const k in BASE) cfg[k] = { ...BASE[k] }; cfg.opacidad = 0.6; guardar(); ubicar(); pintar(); }
    if (b === 'menu') { panel.hidden = true; M.saltar(1); }
    if (b === 'cerrar') panel.hidden = true;
  });
  document.getElementById('fin-editar').onclick = () => { editando = false; document.body.classList.remove('editando'); guardar(); ubicar(); };
  addEventListener('resize', ubicar);
  textos(); ubicar();
  return { ubicar, paraFrame, textos };
}
