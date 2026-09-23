/* ============================================================================
   brillo/js/tactil.js — los controles de dedo, a gusto del jugador.
   El joystick (flotante, fijo o en cruz), saltar, zumbido y pausa son
   burbujas de vidrio. Cada uno se puede arrastrar, agrandar (−/+ o
   pellizcando), cambiar de opacidad, espejar para zurdos, y el teléfono
   puede vibrar. Se guarda como { modo, alfa, vib, pos, tam } con las
   posiciones en fracción del marco del juego (sirven en otra pantalla).
   Mientras se acomoda, un escucha "de captura" se queda con los toques
   antes que los botones (así no se salta ni se camina).
   ========================================================================== */
import { Entrada, PERILLA } from './entrada.js';
import { Pantalla } from './pantalla.js';
import { tr } from './textos.js';

const $ = (tag, cls, padre, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (padre) padre.appendChild(e); return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* el tamaño de cada control, en fracción del alto del marco, y cómo se llama */
const TAM = { pal: 0.25, salto: 0.21, zumbido: 0.165, pausa: 0.11 };
const NOMBRE = { pal: 'cCaminar', salto: 'cSaltar', zumbido: 'cZumbido', pausa: 'cPausa' };
export const TACTIL_INICIAL = () => ({ modo: 'flotante', alfa: 0.85, vib: true, pos: {}, tam: { pal: 1, salto: 1, zumbido: 1, pausa: 1 } });

const ICONO_SALTO = '<svg viewBox="0 0 40 40"><circle cx="20" cy="22" r="12" fill="none" stroke="#fff" stroke-width="3"/><circle cx="15" cy="17" r="3" fill="#fff"/><path d="M20 3v8M14 7l6-5 6 5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONO_ZUMBIDO = '<svg viewBox="0 0 40 40"><circle cx="20" cy="13" r="6" fill="#fff"/><path d="M11 33c0-8 4-12 9-12s9 4 9 12z" fill="#fff"/><path d="M5 12l3 3-3 3 3 3M35 12l-3 3 3 3-3 3" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class Tactil {
  constructor(raiz, A, alPausa) {
    this.A = A;
    const t = this.el = $('div', 'tactil', raiz);
    const zona = $('div', 'zonaPal', t), aro = $('div', 'aro', zona, '<i class="brazo v"></i><i class="brazo h"></i><i class="fl i"></i><i class="fl d"></i><i class="fl a"></i><i class="fl b"></i>'), bola = $('div', 'bola', zona);
    const bs = $('div', 'bSalto', t, ICONO_SALTO), bz = $('div', 'bZumbido', t, ICONO_ZUMBIDO), bp = $('div', 'bPausa', t, '<i></i><i></i>');
    aro.dataset.control = 'pal'; bs.dataset.control = 'salto'; bz.dataset.control = 'zumbido'; bp.dataset.control = 'pausa';
    this.ctl = { pal: aro, salto: bs, zumbido: bz, pausa: bp, zona, bola };
    this.cfg = { radio: 44, modo: 'flotante', cx: 0, cy: 0 };
    this.reposo = Entrada.palanca(zona, aro, bola, this.cfg);
    Entrada.boton(bs, 'salto'); Entrada.boton(bz, 'accion');
    bp.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); alPausa(); });
    this.acomodar();
    this.editor();
  }
  ver(v) { this.el.classList.toggle('ve', v); }
  marco() { const L = Pantalla.lienzo; return { w: L.w, h: L.h }; }
  /* dónde va el centro de cada control, siempre adentro del marco */
  centro(k) {
    const M = this.marco(), A = this.A, s = Math.max(34, TAM[k] * M.h) * A.tam[k];
    const def = { pal: [M.h * 0.24, M.h * 0.76], salto: [M.w - M.h * 0.17, M.h * 0.8], zumbido: [M.w - M.h * 0.42, M.h * 0.78], pausa: [M.w - M.h * 0.09, M.h * 0.1] }[k];
    let x = A.pos[k] ? A.pos[k].x * M.w : def[0], y = A.pos[k] ? A.pos[k].y * M.h : def[1];
    const entre = (v, a, b) => (a > b ? (a + b) / 2 : Math.max(a, Math.min(b, v)));
    x = entre(x, s / 2 + 4, M.w - s / 2 - 4); y = entre(y, s / 2 + 4, M.h - s / 2 - 4);
    return { x, y, s };
  }
  acomodar() {
    const A = this.A, M = this.marco(), C = this.ctl;
    this.el.style.setProperty('--alfa', A.alfa);
    this.el.classList.toggle('cruz', A.modo === 'cruz');
    for (const k of ['salto', 'zumbido', 'pausa']) { const c = this.centro(k), el = C[k]; Object.assign(el.style, { width: c.s + 'px', height: c.s + 'px', left: c.x - c.s / 2 + 'px', top: c.y - c.s / 2 + 'px' }); }
    const c = this.centro('pal'), r = c.s / 2, z = C.zona.style;
    let zx, zy, zw, zh;
    /* el flotante escucha toda la mitad de su lado; el fijo y la cruz, un poco más que su dibujo */
    if (A.modo === 'flotante') { zx = c.x < M.w / 2 ? 0 : M.w / 2; zy = M.h * 0.18; zw = M.w / 2; zh = M.h * 0.82; }
    else { zw = zh = r * 3.2; zx = c.x - zw / 2; zy = c.y - zh / 2; }
    Object.assign(z, { left: zx + 'px', top: zy + 'px', width: zw + 'px', height: zh + 'px' });
    Object.assign(C.pal.style, { width: r * 2 + 'px', height: r * 2 + 'px' });
    Object.assign(C.bola.style, { width: r * PERILLA * 2 + 'px', height: r * PERILLA * 2 + 'px' });
    Object.assign(this.cfg, { radio: r, modo: A.modo, cx: c.x - zx, cy: c.y - zy });
    this.reposo();
    Entrada.vibrar = !!A.vib;
  }
  /* el arrastre y el pellizco mientras se acomoda */
  editor() {
    const t = this.el, dedos = new Map();
    let mov = null, pinza = null;
    const activo = (e) => t.classList.contains('editando') && !(this.barra && this.barra.contains(e.target));
    const pos = (e) => { const q = Pantalla.aCaja(e.clientX, e.clientY), L = Pantalla.lienzo; return { x: q.x - L.x, y: q.y - L.y }; };
    t.addEventListener('pointerdown', (e) => {
      if (!activo(e)) return;
      e.stopPropagation(); e.preventDefault();
      const q = pos(e); dedos.set(e.pointerId, q);
      try { t.setPointerCapture(e.pointerId); } catch (_) {}
      if (dedos.size === 1) {
        const el = e.target.closest && e.target.closest('[data-control]');
        mov = null;
        if (el) { this.elegir(el.dataset.control); const c = this.centro(this.sel); mov = { id: e.pointerId, dx: c.x - q.x, dy: c.y - q.y }; }
      } else if (dedos.size === 2) { const [a, b] = [...dedos.values()]; pinza = { d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), s0: this.A.tam[this.sel] }; mov = null; }
    }, true);
    t.addEventListener('pointermove', (e) => {
      if (!dedos.has(e.pointerId) || !t.classList.contains('editando')) return;
      e.stopPropagation(); e.preventDefault();
      const q = pos(e); dedos.set(e.pointerId, q);
      const M = this.marco();
      if (pinza && dedos.size >= 2) { const [a, b] = [...dedos.values()]; this.A.tam[this.sel] = Math.round(Math.max(0.6, Math.min(1.8, pinza.s0 * Math.hypot(a.x - b.x, a.y - b.y) / pinza.d0)) * 20) / 20; this.acomodar(); this.pintarBarra(); }
      else if (mov && e.pointerId === mov.id) { this.A.pos[this.sel] = { x: (q.x + mov.dx) / M.w, y: (q.y + mov.dy) / M.h }; this.barra.classList.add('lejos'); this.acomodar(); }
    }, true);
    const fin = (e) => {
      if (!dedos.delete(e.pointerId)) return;
      e.stopPropagation();
      if (dedos.size < 2) pinza = null;
      if (mov && mov.id === e.pointerId) { const c = this.centro(this.sel), M = this.marco(); this.A.pos[this.sel] = { x: c.x / M.w, y: c.y / M.h }; mov = null; }
      if (this.barra) this.barra.classList.remove('lejos');
      if (this.alCambio) this.alCambio();
    };
    t.addEventListener('pointerup', fin, true); t.addEventListener('pointercancel', fin, true);
  }
  elegir(k) { this.sel = k; for (const [n, el] of Object.entries(this.ctl)) if (TAM[n]) el.classList.toggle('elegido', n === k); this.pintarBarra(); }
  pintarBarra() {
    const b = this.barra, A = this.A; if (!b) return;
    const q = (s) => b.querySelector(s);
    q('[data-k=tam] em').textContent = `${tr(NOMBRE[this.sel])} · ${Math.round(A.tam[this.sel] * 100)}%`;
    q('[data-k=alfa] em').textContent = Math.round(A.alfa * 100) + '%';
    q('[data-k=modo] em').textContent = tr(A.modo);
    q('[data-k=vib] em').textContent = tr(A.vib ? 'si' : 'no');
  }
  /* abrir el editor: ui = la interfaz (para la lista de la barra), alCambio guarda, alListo vuelve */
  editar(ui, alCambio, alListo) {
    const t = this.el, A = this.A;
    const antes = t.classList.contains('ve');
    t.classList.add('editando', 've');
    for (const [k, el] of Object.entries(this.ctl)) if (NOMBRE[k]) el.dataset.nombre = tr(NOMBRE[k]);
    this.alCambio = alCambio;
    const par = (k, n) => `<div class="chip par" data-k="${k}"><button data-d="-1">−</button><span><i>${esc(tr(n))}</i><em></em></span><button data-d="1">+</button></div>`;
    const b = this.barra = $('div', 'acomoda vidrio', t, `<b class="tit">${esc(tr('acomodaTit'))}</b><small>${esc(tr('acomodaAyuda'))}</small>
      <div class="chips">${par('tam', 'tamano')}${par('alfa', 'opacidad')}
        <button class="chip" data-k="modo"><i>${esc(tr('palanca'))}</i><em></em></button>
        <button class="chip" data-k="vib"><i>${esc(tr('vibrar'))}</i><em></em></button>
        <button class="chip" data-k="espejo">${esc(tr('espejar'))}</button>
        <button class="chip" data-k="reset">${esc(tr('restablecer'))}</button>
        <button class="chip listo" data-k="listo">${esc(tr('listo'))}</button></div>`);
    const MODOS = ['flotante', 'fija', 'cruz'];
    const salir = () => {
      t.classList.remove('editando'); b.remove(); this.barra = null; this.alCambio = null;
      for (const el of Object.values(this.ctl)) el.classList.remove('elegido');
      this.ver(antes);
      alListo();
    };
    this.salirEditor = salir;
    const hacer = (k, d) => {
      const M = this.marco();
      if (k === 'tam') A.tam[this.sel] = Math.round(Math.max(0.6, Math.min(1.8, A.tam[this.sel] + d * 0.1)) * 10) / 10;
      else if (k === 'alfa') A.alfa = Math.round(Math.max(0.2, Math.min(1, A.alfa + d * 0.1)) * 10) / 10;
      else if (k === 'modo') A.modo = MODOS[(MODOS.indexOf(A.modo) + (d || 1) + 3) % 3];
      else if (k === 'vib') { A.vib = !A.vib; Entrada.vibrar = A.vib; Entrada.zumbar(30); }
      else if (k === 'espejo') for (const n of Object.keys(TAM)) { const c = this.centro(n); A.pos[n] = { x: 1 - c.x / M.w, y: c.y / M.h }; }
      else if (k === 'reset') { const I = TACTIL_INICIAL(); A.pos = {}; A.tam = I.tam; A.modo = I.modo; A.alfa = I.alfa; }
      else if (k === 'listo') { salir(); return; }
      this.acomodar(); this.pintarBarra();
      if (alCambio) alCambio();
    };
    const items = [...b.querySelectorAll('button')];
    ui.lista(items, { i: items.length - 1, elegir: (i, el) => { const e2 = el || items[i]; hacer(e2.closest('[data-k]').dataset.k, +(e2.dataset.d || 0)); }, volver: salir });
    this.elegir(this.sel || 'salto');
  }
}
