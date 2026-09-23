/* ============================================================================
   brillo/js/ui.js — la interfaz, de vidrio como las ventanas de los 2000:
   - El idioma se elige reventando una de tres burbujas que flotan.
   - "Iniciando sesión": los dos muñequitos giran uno alrededor del otro.
   - El título: letras de vidrio con reflejo; el menú, píldoras brillantes
     en un panel esmerilado.
   - Las charlas son una ventana de conversación ("Tito dice:", "Tito está
     escribiendo…"); los avisos aparecen abajo a la derecha, como cuando
     alguien iniciaba sesión.
   - Mundos, guiños, opciones y pausa son ventanas con su barra y su X.
   - Las transiciones son una ola de burbujas que tapa y destapa.
   Todo se maneja con teclado, mando, mouse o dedos.
   ========================================================================== */
import { TX, tr, IDIOMAS, TEXTOS, MUNDOS, EMO } from './textos.js';
import { cuadro } from './personajes.js';
import { orbe, guino as dibGuino, gota as dibGota, emoticon } from './objetos.js';
import { burbuja } from './efectos.js';

const $ = (tag, cls, padre, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (padre) padre.appendChild(e); return e; };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* un canvas de pixel art a imagen (para los avatares y los íconos) */
const png = new Map();
export function imagen(clave, fn) { if (!png.has(clave)) png.set(clave, fn().toDataURL()); return png.get(clave); }
export const avatar = (quien) => imagen('av' + quien, () => cuadro(quien === 'plano' ? 'gris' : quien, 'quieto', 0, false));
/* los emoticones de la charla: :) ;) :D <3 */
const CARITAS = { ':)': 'sonrisa', ';)': 'guino', ':D': 'risa', '<3': 'corazon' };
function conCaritas(t) {
  let s = esc(t);
  for (const [k, n] of Object.entries(CARITAS)) s = s.split(esc(k)).join(`<img class="emo" src="${imagen('emo' + n, () => emoticon(n))}" alt="${esc(k)}">`);
  return s;
}

export class UI {
  constructor(raiz) {
    this.r = raiz;
    this.foco = null;
    this.capa = $('div', 'capa', raiz);
    this.ola = $('div', 'ola', raiz);
    for (let i = 0; i < 34; i++) { const b = $('i', '', this.ola); b.style.setProperty('--x', `${(i * 37) % 100}%`); b.style.setProperty('--t', `${14 + (i * 13) % 26}`); b.style.setProperty('--d', `${(i % 9) * 0.035}s`); }
    this.avisos = $('div', 'avisos', raiz);
    this.tactil = null;
    addEventListener('keydown', (e) => { if (e.code === 'Tab' && this.foco) e.preventDefault(); });
  }

  /* ---------------- navegar con teclado y mando ---------------- */
  lista(items, o) {
    const L = { items, i: o.i || 0, elegir: o.elegir, volver: o.volver, lados: o.lados, cambio: o.cambio };
    items.forEach((el, i) => {
      el.addEventListener('pointerenter', () => { if (this.foco === L) this.enfocar(L, i); });
      el.addEventListener('click', (e) => { e.preventDefault(); if (this.foco !== L) return; if (el.classList.contains('cerrada')) { this.enfocar(L, i); this.sacudir(el); return; } this.enfocar(L, i); if (L.elegir) L.elegir(i, el); });
    });
    this.foco = L;
    this.enfocar(L, L.i, true);
    return L;
  }
  enfocar(L, i, callado) {
    L.items.forEach((el, j) => el.classList.toggle('foco', j === i));
    L.i = i;
    if (L.items[i] && L.items[i].scrollIntoView && L.items[i].closest('.desliza')) try { L.items[i].scrollIntoView({ block: 'nearest' }); } catch (_) {}
    if (L.cambio) L.cambio(i);
    if (!callado && this.alMover) this.alMover();
  }
  sacudir(el) { el.classList.remove('no'); void el.offsetWidth; el.classList.add('no'); if (this.alNo) this.alNo(); }
  pasar(E) {
    const L = this.foco;
    if (!L) return false;
    const n = L.items.length;
    let usado = false;
    if (E.arr || E.izq) { if (E.izq && L.lados) L.lados(L.i, -1); else this.enfocar(L, (L.i - 1 + n) % n); usado = true; }
    if (E.aba || E.der) { if (E.der && L.lados) L.lados(L.i, 1); else this.enfocar(L, (L.i + 1) % n); usado = true; }
    if (E.aceptar) { const el = L.items[L.i]; if (el.classList.contains('cerrada')) this.sacudir(el); else if (L.elegir) L.elegir(L.i, el); usado = true; }
    if (E.volver && L.volver) { L.volver(); usado = true; }
    return usado;
  }
  limpiar() { this.foco = null; this.capa.innerHTML = ''; this.capa.className = 'capa'; }

  /* ---------------- la ola de burbujas (transición) ---------------- */
  async olaTapa() { this.ola.classList.remove('destapa'); this.ola.classList.add('tapa'); if (this.alOla) this.alOla(); await dormir(700); }
  async olaDestapa() { this.ola.classList.add('destapa'); await dormir(750); this.ola.classList.remove('tapa', 'destapa'); }

  /* ---------------- el idioma: tres burbujas ---------------- */
  idioma(actual, alElegir) {
    this.limpiar();
    const c = $('div', 'idioma', this.capa);
    $('div', 'elegi', c, IDIOMAS.map(([l]) => esc(TEXTOS[l].ui.elegi)).join(' <span>·</span> '));
    const fila = $('div', 'burbujas', c);
    let elegido = false;
    const items = IDIOMAS.map(([l, nombre], i) => {
      const b = $('button', 'burbujaIdioma', fila, `<b>${esc(TEXTOS[l].ui.saludo)}</b><i>${esc(nombre)}</i>`);
      b.style.setProperty('--f', `${-i * 1.3}s`); b.style.setProperty('--h', ['190deg', '130deg', '300deg'][i]);
      return b;
    });
    this.lista(items, {
      i: Math.max(0, IDIOMAS.findIndex(([l]) => l === actual)),
      elegir: async (i, el) => {
        if (elegido) return; elegido = true; this.foco = null;
        el.classList.add('revienta');
        items.forEach((o) => { if (o !== el) o.classList.add('se-va'); });
        if (this.alPop) this.alPop();
        await dormir(600);
        alElegir(IDIOMAS[i][0]);
      },
    });
  }

  /* ---------------- "Iniciando sesión" ---------------- */
  async iniciandoSesion(ms = 2200) {
    this.limpiar();
    const v = $('div', 'ventana inicio', this.capa, `<div class="barra"><span>BRILLO</span><i class="x"></i></div><div class="cuerpo"><div class="giran"><img src="${avatar('nick')}"><img src="${avatar('mora')}"></div><p class="est">${esc(tr('iniciando'))}</p><p class="sub">${esc(tr('conectando'))}</p><div class="barrita"><i></i></div></div>`);
    await dormir(ms);
    v.classList.add('sale');
    await dormir(350);
  }

  /* ---------------- el título ---------------- */
  titulo(o) {
    this.limpiar();
    const c = $('div', 'titulo', this.capa);
    $('h1', 'logo', c, [...'BRILLO'].map((l, i) => `<span style="--i:${i}">${l}</span>`).join('') + '<em></em>');
    $('p', 'lema', c, esc(tr('lema')));
    const menu = $('div', 'menu vidrio', c);
    const items = o.opciones.map(([k, txt], i) => { const b = $('button', 'pildora' + (i === 0 ? ' verde' : ''), menu, `<span>${esc(txt)}</span>`); b.dataset.k = k; b.style.setProperty('--d', `${0.4 + i * 0.07}s`); return b; });
    this.lista(items, { i: o.i || 0, elegir: (i, el) => o.elegir(o.opciones[i][0], el) });
    return c;
  }
  ponerTexto(el, txt) { const s = el.querySelector('span'); if (s) s.textContent = txt; }

  /* ---------------- una ventana (mundos, guiños, opciones, pausa, créditos) ---------------- */
  ventana(titulo, clase) {
    const v = $('div', 'ventana ' + (clase || ''), this.capa, `<div class="barra"><span>${esc(titulo)}</span><button class="x" aria-label="x"></button></div><div class="cuerpo desliza"></div>`);
    return { v, cuerpo: v.querySelector('.cuerpo'), x: v.querySelector('.x') };
  }
  mundos(lista, alElegir, alVolver) {
    this.limpiar(); this.capa.classList.add('oscuro');
    const { cuerpo, x } = this.ventana(tr('mundos'), 'mundos');
    const grilla = $('div', 'iconos', cuerpo);
    const items = lista.map(({ id, abierto, hecho }, i) => {
      const b = $('button', 'icono' + (abierto ? '' : ' cerrada') + (hecho ? ' hecho' : ''), grilla, `<img src="${imagen('orbeM' + id, () => orbe(id === 'plano' ? 'aurora' : id, 0))}"><b>${esc(tr('mundo', i + 1))}</b><i>${esc(abierto ? TX().mundos[id] : tr('cerrado'))}</i>`);
      return b;
    });
    x.addEventListener('click', () => alVolver());
    this.lista(items, { elegir: (i) => alElegir(lista[i].id), volver: alVolver });
  }
  guinos(juntados, alVolver) {
    this.limpiar(); this.capa.classList.add('oscuro');
    const { cuerpo, x } = this.ventana(`${tr('guinos')} · ${tr('guinosDe', juntados.size, EMO.length)}`, 'guinos');
    const grilla = $('div', 'emoticones', cuerpo);
    const items = EMO.map((n, i) => {
      const tiene = juntados.has(i);
      return $('button', 'emo' + (tiene ? '' : ' falta'), grilla, tiene ? `<img src="${imagen('emo' + n, () => emoticon(n))}"><i>${esc(TX().emoticones[n])}</i>` : `<img src="${imagen('emoF', () => dibGuino(0))}"><i>?</i>`);
    });
    const volver = $('button', 'pildora chica', cuerpo, `<span>${esc(tr('volver'))}</span>`);
    items.push(volver);
    x.addEventListener('click', () => alVolver());
    this.lista(items, { elegir: (i) => { if (i === items.length - 1) alVolver(); }, volver: alVolver });
  }
  opciones(filas, alVolver, o = {}) {
    this.limpiar(); this.capa.classList.add('oscuro');
    const { cuerpo, x } = this.ventana(tr('opciones'), 'opciones');
    const items = filas.map((f) => {
      const b = $('button', 'fila' + (f.abrir ? ' abre' : ''), cuerpo, `<span class="n"></span><span class="v"><em>${f.abrir ? '' : '‹'}</em><b></b><em>›</em></span>`);
      b.pintar = () => { b.querySelector('.n').textContent = f.nombre(); b.querySelector('b').innerHTML = f.valor(); };
      b.pintar();
      return b;
    });
    if (!o.tactil) $('p', 'teclas', cuerpo, esc(tr('controles')));
    const volver = $('button', 'pildora chica', cuerpo, `<span>${esc(tr('volver'))}</span>`);
    items.push(volver);
    const repintar = () => { items.forEach((b) => b.pintar && b.pintar()); this.ponerTexto(volver, tr('volver')); };
    x.addEventListener('click', () => alVolver());
    this.lista(items, {
      elegir: (i) => { if (i === filas.length) alVolver(); else if (filas[i].abrir) filas[i].abrir(); else { filas[i].cambiar(1); repintar(); } },
      lados: (i, d) => { if (i < filas.length && !filas[i].abrir) { filas[i].cambiar(d); repintar(); } },
      volver: alVolver,
    });
  }
  pausa(o) {
    this.limpiar(); this.capa.classList.add('oscuro');
    const { cuerpo, x } = this.ventana(`BRILLO — ${tr('pausa')}`, 'pausa');
    $('p', 'donde', cuerpo, `<b>${esc(o.mundo)}</b><span>${esc(tr('guinosDe', o.guinos, o.total))} · ${esc(tr('gotas'))}: ${o.gotas}</span>`);
    const items = o.opciones.map(([k, txt], i) => $('button', 'pildora' + (i === 0 ? ' verde' : ''), cuerpo, `<span>${esc(txt)}</span>`));
    x.addEventListener('click', () => o.elegir('continuar'));
    this.lista(items, { elegir: (i) => o.elegir(o.opciones[i][0]), volver: () => o.elegir('continuar') });
  }

  /* ---------------- la charla: una ventana de conversación ---------------- */
  charla(conQuien) {
    if (this.chat) this.chat.remove();
    const nick = TX().nicks[conQuien] || TX().nombres[conQuien] || conQuien;
    const c = this.chat = $('div', 'chat', this.r, `<div class="barra"><img src="${avatar(conQuien)}"><span><b>${esc(TX().nombres[conQuien] || conQuien)}</b><small>${esc(nick)}</small></span><i class="x"></i></div><div class="lineas"></div><div class="escribe"></div><div class="toca">${esc(tr('tocar'))} ▸</div>`);
    requestAnimationFrame(() => c.classList.add('ve'));
    const lineas = c.querySelector('.lineas'), escribe = c.querySelector('.escribe');
    const R = {
      /* una línea: primero "está escribiendo…", después el texto letra por letra */
      linea: (quien, texto) => {
        const nombre = TX().nombres[quien] || quien;
        escribe.textContent = tr('escribiendo', nombre);
        const l = $('div', 'linea ' + (quien === 'nick' ? 'mia' : 'suya') + (quien === 'plano' ? ' plana' : ''), lineas, `<img src="${avatar(quien)}"><div><b>${esc(tr('dice', nombre))}</b><p></p></div>`);
        while (lineas.children.length > 3) lineas.removeChild(lineas.firstChild);
        const p = l.querySelector('p');
        R.listo = false; R.t = -0.35; R.texto = texto; R.p = p; R.escribe = escribe;
        return l;
      },
      pasar(dt) {
        if (R.listo || !R.p) return;
        R.t += dt;
        if (R.t < 0) return;
        R.escribe.textContent = '';
        const n = Math.min(R.texto.length, Math.floor(R.t * 55));
        R.p.textContent = R.texto.slice(0, n);
        if (n >= R.texto.length) R.completar();
        else if (this.alLetra && Math.floor(R.t * 55) % 3 === 0) this.alLetra();
      },
      completar() { if (!R.p) return; R.p.innerHTML = conCaritas(R.texto); R.listo = true; R.escribe.textContent = ''; },
      cerrar() { c.classList.remove('ve'); c.classList.add('sale'); setTimeout(() => c.remove(), 400); if (this.chat === c) this.chat = null; },
    };
    return R;
  }

  /* ---------------- los avisos de abajo a la derecha ---------------- */
  aviso(texto, o = {}) {
    const a = $('div', 'aviso' + (o.clase ? ' ' + o.clase : ''), this.avisos, `${o.img ? `<img src="${o.img}">` : ''}<span>${o.titulo ? `<b>${esc(o.titulo)}</b>` : ''}${esc(texto)}</span>`);
    requestAnimationFrame(() => a.classList.add('ve'));
    setTimeout(() => { a.classList.remove('ve'); a.classList.add('sale'); setTimeout(() => a.remove(), 500); }, o.dura || 3200);
    while (this.avisos.children.length > 3) this.avisos.removeChild(this.avisos.firstChild);
  }

  /* ---------------- lo de arriba: gotitas y guiños ---------------- */
  hud(gotas, guinos, total) {
    if (!this.hudEl) {
      this.hudEl = $('div', 'hud', this.r, `<span class="g"><img src="${imagen('gotaHud', () => dibGota(0))}"><b></b></span><span class="w"><img src="${imagen('guinoHud', () => dibGuino(1))}"><b></b></span>`);
    }
    this.hudEl.querySelector('.g b').textContent = gotas;
    this.hudEl.querySelector('.w b').textContent = `${guinos}/${total}`;
  }
  verHud(v) { if (this.hudEl) this.hudEl.classList.toggle('ve', v); }
  latido(que) { if (!this.hudEl) return; const e = this.hudEl.querySelector(que === 'guino' ? '.w' : '.g'); e.classList.remove('late'); void e.offsetWidth; e.classList.add('late'); }

  /* ---------------- el cartel del mundo ---------------- */
  async cartel(chico, grande) {
    const c = $('div', 'cartelMundo', this.r, `<small>${esc(chico)}</small><b>${esc(grande)}</b>`);
    await dormir(3000);
    c.classList.add('sale');
    await dormir(600);
    c.remove();
  }

  /* ---------------- la narración: una hoja de vidrio con renglones ---------------- */
  narrar(lineas, o = {}) {
    return new Promise((listo) => {
      const c = $('div', 'narra' + (o.final ? ' final' : ''), this.r);
      const hoja = $('div', 'hoja vidrio', c);
      const ps = lineas.map((l) => $('p', '', hoja, esc(l)));
      const pie = $('small', '', hoja, esc(tr('tocar')));
      let i = 0, fin = false;
      const mostrar = () => { ps.forEach((p, k) => p.classList.toggle('ve', k <= i)); pie.classList.toggle('ve', i >= ps.length - 1); };
      const cerrar = () => { if (fin) return; fin = true; this.narrando = null; c.classList.add('sale'); setTimeout(() => { c.remove(); listo(); }, 500); };
      const avanzar = () => { if (i < ps.length - 1) { i++; mostrar(); } else cerrar(); };
      this.narrando = avanzar;
      c.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); avanzar(); });
      requestAnimationFrame(() => { c.classList.add('ve'); mostrar(); });
    });
  }

  /* ---------------- los créditos ---------------- */
  creditos(lineas) {
    return new Promise((listo) => {
      const c = $('div', 'creditos', this.r);
      const v = $('div', 'rollo vidrio', c);
      lineas.forEach((l, i) => $('p', i === 0 ? 'grande' : '', v, esc(l)));
      const fila = $('div', 'todos', v);
      for (const q of ['nick', 'mora', 'tito', 'lila', 'sol', 'vio']) $('img', '', fila).src = avatar(q);
      let fin = false;
      const cerrar = () => { if (fin) return; fin = true; this.narrando = null; c.classList.add('sale'); setTimeout(() => { c.remove(); listo(); }, 800); };
      this.narrando = cerrar;
      c.addEventListener('pointerdown', (e) => { e.stopPropagation(); cerrar(); });
      requestAnimationFrame(() => c.classList.add('ve'));
      setTimeout(cerrar, 5000 + lineas.length * 2200);
    });
  }

  /* un mensaje sin conexión (los recuerdos de Mora): se lee como un aviso grande */
  async mensaje(quien, texto) {
    const m = $('div', 'mensaje vidrio', this.r, `<div class="barra"><img src="${avatar(quien)}"><span>${esc(tr('mensaje'))} · <b>${esc(TX().nombres[quien])}</b></span></div><p>${conCaritas(texto)}</p>`);
    requestAnimationFrame(() => m.classList.add('ve'));
    return m;
  }
}
