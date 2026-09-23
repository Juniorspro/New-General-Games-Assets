/* ============================================================================
   kuntur/js/ui.js — la interfaz, hecha como un teatrito de papel:
   - El telón es un aguayo (el tejido de colores de la Puna) que se abre
     frunciéndose hacia los costados.
   - Para elegir el idioma cuelgan tres cartelitos de hilos.
   - El menú son boletos del Tren a las Nubes: al elegir uno, lo sellan.
   - Los capítulos, un mapa doblado con el recorrido; las coplas, un
     cuaderno; la charla, globitos de papel que salen de la cabeza de cada uno.
   Todo se maneja con teclado, mando, mouse o dedos.
   ========================================================================== */
import { T, tr, IDIOMAS, TEXTOS } from './textos.js';
import { granoPapel } from './papel.js';
import { Entrada, PERILLA } from './entrada.js';
import { Pantalla } from './pantalla.js';

const $ = (tag, cls, padre, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (padre) padre.appendChild(e); return e; };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const COLOR_DE = { killa: '#c0282e', abuela: '#6a2f9a', rosa: '#1f6f8a', ceferino: '#8a5a3a', tomas: '#2a5aa8', coquena: '#b8902a', apu: '#4a4448' };
const PALETA = ['#c0282e', '#f2b632', '#1f8f6c', '#e8702a', '#6a2f9a', '#2a5aa8', '#e84a7a'];

export class UI {
  constructor(raiz) {
    this.r = raiz;
    try { document.documentElement.style.setProperty('--grano', `url(${granoPapel().toDataURL()})`); } catch (_) {}
    this.foco = null;          // la lista que se está manejando: { items, i, elegir(i), volver(), lados(i, d) }
    this.pilas = [];
    this.capa = $('div', 'capa', raiz);
    this.globos = new Set();
    /* el telón, cerrado de entrada */
    this.telonEl = $('div', 'telon cerrado', raiz, '<div class="ala izq"></div><div class="ala der"></div><div class="cenefa"></div>');
    this.hojaEl = $('div', 'pasahoja', raiz);
    this.tactil = null;
    addEventListener('keydown', (e) => { if (e.code === 'Tab' && this.foco) e.preventDefault(); });
  }

  /* ---------------- el telón ---------------- */
  async telon(cerrar) {
    const t = this.telonEl;
    if (cerrar === t.classList.contains('cerrado')) return;
    t.classList.toggle('cerrado', cerrar);
    await dormir(1250);
  }
  /* la hoja que pasa (cuando Killa se apaga): resuelve en la mitad */
  async pasarHoja() {
    const h = this.hojaEl;
    h.classList.remove('pasa'); void h.offsetWidth; h.classList.add('pasa');
    await dormir(430);
    setTimeout(() => h.classList.remove('pasa'), 600);
  }

  /* ---------------- navegar ---------------- */
  lista(items, o) {
    const L = { items, i: o.i || 0, elegir: o.elegir, volver: o.volver, lados: o.lados, cambio: o.cambio };
    items.forEach((el, i) => {
      el.addEventListener('pointerenter', () => { if (!el.disabled) this.enfocar(L, i); });
      el.addEventListener('click', (e) => { e.preventDefault(); if (el.classList.contains('cerrada')) { this.enfocar(L, i); this.sacudir(el); return; } this.enfocar(L, i); if (L.elegir) L.elegir(i, el); });
    });
    this.foco = L;
    this.enfocar(L, L.i);
    return L;
  }
  enfocar(L, i) {
    L.items.forEach((el, j) => el.classList.toggle('foco', j === i));
    L.i = i;
    if (L.cambio) L.cambio(i);
    if (this.alMover) this.alMover();
  }
  sacudir(el) { el.classList.remove('no'); void el.offsetWidth; el.classList.add('no'); if (this.alNo) this.alNo(); }
  /* cada cuadro: lo que se apretó */
  pasar(E) {
    const L = this.foco;
    if (!L) return false;
    const n = L.items.length;
    let usado = false;
    if (E.arr || E.izq) {
      if (E.izq && L.lados) L.lados(L.i, -1);
      else this.enfocar(L, (L.i - 1 + n) % n);
      usado = true;
    }
    if (E.aba || E.der) {
      if (E.der && L.lados) L.lados(L.i, 1);
      else this.enfocar(L, (L.i + 1) % n);
      usado = true;
    }
    if (E.aceptar) {
      const el = L.items[L.i];
      if (el.classList.contains('cerrada')) this.sacudir(el);
      else if (L.elegir) L.elegir(L.i, el);
      usado = true;
    }
    if (E.volver && L.volver) { L.volver(); usado = true; }
    return usado;
  }
  limpiar() {
    this.foco = null;
    this.capa.innerHTML = '';
    this.capa.className = 'capa';
  }

  /* ---------------- el idioma: tres cartelitos colgados ---------------- */
  idioma(actual, alElegir) {
    this.limpiar();
    const c = $('div', 'idioma', this.capa);
    $('div', 'cinta', c, 'KUNTUR');
    $('div', 'elegi', c, IDIOMAS.map(([l]) => esc(TEXTOS[l].ui.elegi)).join(' <span>·</span> '));
    const tags = $('div', 'tags', c);
    const items = IDIOMAS.map(([l, nombre], i) => {
      const b = $('button', 'tag', tags, `<span class="ojal"></span><b>${esc(TEXTOS[l].ui.saludo)}</b><i>${esc(nombre)}</i>`);
      b.style.setProperty('--hilo', `calc(${18 + (i % 2) * 7} * var(--vh) * var(--corto, 1))`); b.style.setProperty('--fase', `${-i * 0.7}s`); b.style.setProperty('--col', PALETA[i * 2]);
      return b;
    });
    const i0 = Math.max(0, IDIOMAS.findIndex(([l]) => l === actual));
    this.lista(items, {
      i: i0,
      elegir: async (i, el) => {
        this.foco = null;
        el.classList.add('elegido');
        items.forEach((o) => { if (o !== el) o.classList.add('sube'); });
        await dormir(650);
        alElegir(IDIOMAS[i][0]);
      },
    });
  }

  /* ---------------- el título ---------------- */
  titulo(o) {
    this.limpiar();
    this.capa.classList.add('conTitulo');
    const c = $('div', 'titulo', this.capa);
    const logo = $('h1', 'logo', c);
    [...'KUNTUR'].forEach((l, i) => { const s = $('span', '', logo, l); s.style.setProperty('--col', PALETA[i % PALETA.length]); s.style.setProperty('--d', `${0.25 + i * 0.09}s`); s.style.setProperty('--g', `${(i % 2 ? 1 : -1) * (2 + i % 3)}deg`); });
    $('p', 'lema', c, esc(tr('lema')));
    const bs = $('div', 'boletos', c);
    const ops = o.opciones;
    const items = ops.map(([k, txt], i) => {
      const b = $('button', 'boleto', bs, `<span class="sombra"></span><span class="papel"></span><span class="num">Nº ${String(412 + i * 37).padStart(4, '0')}</span><span class="txt">${esc(txt)}</span><span class="sello">KUNTUR</span>`);
      b.style.setProperty('--col', PALETA[(i * 3) % PALETA.length]); b.style.setProperty('--g', `${(i % 2 ? 1 : -1) * 1.3}deg`); b.style.setProperty('--d', `${0.9 + i * 0.08}s`);
      b.dataset.k = k;
      return b;
    });
    this.lista(items, { i: o.i || 0, elegir: (i, el) => { el.classList.add('sellado'); setTimeout(() => el.classList.remove('sellado'), 700); o.elegir(ops[i][0], el); } });
    return c;
  }
  ponerTextoBoleto(el, txt) { el.querySelector('.txt').textContent = txt; }

  /* ---------------- los capítulos: un mapa doblado ---------------- */
  capitulos(lista, llegados, alElegir, alVolver) {
    this.limpiar();
    const c = $('div', 'panel mapa', this.capa);
    $('h2', '', c, esc(tr('capitulos')));
    const lugar = $('div', 'lugar', c);
    const plano = $('div', 'plano', c);
    const W = 100, pos = lista.map((_, i) => [8 + i * (84 / (lista.length - 1)), i % 2 ? 30 : 68]);
    const svg = `<svg viewBox="0 0 ${W} 100" preserveAspectRatio="none"><path d="M${pos.map((p) => p.join(' ')).join(' L')}" /></svg>`;
    plano.innerHTML = svg;
    const items = lista.map(([id, n, nombre], i) => {
      const b = $('button', 'parada', plano, `<span>${i === 0 ? '✦' : i === lista.length - 1 ? '✧' : i}</span>`);
      b.style.left = pos[i][0] + '%'; b.style.top = pos[i][1] + '%';
      b.style.setProperty('--col', PALETA[i % PALETA.length]);
      if (!llegados.includes(id)) b.classList.add('cerrada');
      return b;
    });
    const volver = $('button', 'boleto chico', c, `<span class="sombra"></span><span class="papel"></span><span class="txt">${esc(tr('volver'))}</span>`);
    items.push(volver);
    this.lista(items, {
      i: 0,
      cambio: (i) => { if (i < lista.length) { const [id, n, nombre] = lista[i]; lugar.innerHTML = llegados.includes(id) ? `<small>${esc(n)}</small><b>${esc(nombre)}</b>` : `<small>${esc(n)}</small><b>${esc(tr('cerrado'))}</b>`; } else lugar.innerHTML = ''; },
      elegir: (i) => { if (i === lista.length) alVolver(); else alElegir(lista[i][0]); },
      volver: alVolver,
    });
  }

  /* ---------------- las coplas: el cuaderno ---------------- */
  coplas(coplas, halladas, alVolver) {
    this.limpiar();
    const c = $('div', 'panel cuaderno', this.capa);
    $('h2', '', c, `${esc(tr('coplas'))} <small>${esc(tr('coplasDe', halladas.size, coplas.length))}</small>`);
    const hojas = $('div', 'hojas', c);
    const izq = $('div', 'pagina', hojas), der = $('div', 'pagina', hojas);
    const nav = $('div', 'nav', c);
    const ant = $('button', 'boleto chico', nav, '<span class="sombra"></span><span class="papel"></span><span class="txt">‹</span>');
    const volver = $('button', 'boleto chico', nav, `<span class="txt">${esc(tr('volver'))}</span>`);
    const sig = $('button', 'boleto chico', nav, '<span class="sombra"></span><span class="papel"></span><span class="txt">›</span>');
    let par = 0;
    const pintar = (dir) => {
      [izq, der].forEach((p, k) => {
        const i = par * 2 + k;
        if (i >= coplas.length) { p.innerHTML = ''; return; }
        p.innerHTML = halladas.has(i) ? `<em>${i + 1}</em>${coplas[i].map((v) => `<p>${esc(v)}</p>`).join('')}` : `<em>${i + 1}</em><p class="falta">· · ·</p><p class="falta chica">${esc(tr('falta'))}</p>`;
      });
      if (dir) { hojas.classList.remove('dobla', 'doblaAtras'); void hojas.offsetWidth; hojas.classList.add(dir > 0 ? 'dobla' : 'doblaAtras'); }
    };
    const pares = Math.ceil(coplas.length / 2);
    const mover = (d) => { const n = Math.max(0, Math.min(pares - 1, par + d)); if (n !== par) { par = n; pintar(d); if (this.alHoja) this.alHoja(); } };
    pintar(0);
    this.lista([ant, volver, sig], { i: 1, elegir: (i) => (i === 0 ? mover(-1) : i === 2 ? mover(1) : alVolver()), volver: alVolver, lados: (i, d) => mover(d) });
  }

  /* ---------------- opciones ---------------- */
  opciones(filas, alVolver) {
    this.limpiar();
    const c = $('div', 'panel tablero', this.capa);
    $('h2', '', c, esc(tr('opciones')));
    const items = filas.map((f) => {
      const b = $('button', 'fila' + (f.abrir ? ' abre' : ''), c, `<span class="n">${esc(f.nombre())}</span><span class="v">${f.abrir ? '✂' : '‹'} <b></b> ›</span>`);
      b.pintar = () => { b.querySelector('.n').textContent = f.nombre(); b.querySelector('b').innerHTML = f.valor(); };
      b.pintar();
      return b;
    });
    /* la ayuda del teclado, solo si hay teclado a mano */
    const teclas = matchMedia('(pointer: coarse)').matches ? null : $('p', 'teclas', c, esc(tr('controles')));
    const volver = $('button', 'boleto chico', c, `<span class="sombra"></span><span class="papel"></span><span class="txt">${esc(tr('volver'))}</span>`);
    items.push(volver);
    const repintar = () => { items.forEach((b) => b.pintar && b.pintar()); volver.querySelector('.txt').textContent = tr('volver'); c.querySelector('h2').textContent = tr('opciones'); if (teclas) teclas.textContent = tr('controles'); };
    this.lista(items, {
      i: 0,
      elegir: (i) => { if (i === filas.length) alVolver(); else if (filas[i].abrir) filas[i].abrir(); else { filas[i].cambiar(1); repintar(); } },
      lados: (i, d) => { if (i < filas.length && !filas[i].abrir) { filas[i].cambiar(d); repintar(); } },
      volver: alVolver,
    });
  }

  /* ---------------- pausa ---------------- */
  pausa(o) {
    this.limpiar();
    this.capa.classList.add('oscuro');
    const c = $('div', 'pausa', this.capa);
    const cartel = $('div', 'cartel quieto', c, `<small>${esc(o.capitulo)}</small><b>${esc(tr('pausa'))}</b><em>${esc(tr('coplasDe', o.coplas, o.total))}</em>`);
    cartel.style.setProperty('--col', '#6a2f9a');
    const bs = $('div', 'boletos', c);
    const items = o.opciones.map(([k, txt], i) => { const b = $('button', 'boleto', bs, `<span class="sombra"></span><span class="papel"></span><span class="num">Nº ${String(88 + i * 11).padStart(4, '0')}</span><span class="txt">${esc(txt)}</span><span class="sello">KUNTUR</span>`); b.style.setProperty('--col', PALETA[(i * 2 + 1) % PALETA.length]); b.style.setProperty('--d', `${i * 0.05}s`); return b; });
    this.lista(items, { i: 0, elegir: (i) => o.elegir(o.opciones[i][0]), volver: () => o.elegir('continuar') });
  }

  /* ---------------- el cartel del capítulo: baja colgado de dos hilos ---------------- */
  async cartel(chico, grande, col) {
    const c = $('div', 'cartel', this.r, `<small>${esc(chico)}</small><b>${esc(grande)}</b>`);
    c.style.setProperty('--col', col || '#c0282e');
    await dormir(2900);
    c.classList.add('sube');
    await dormir(700);
    c.remove();
  }

  /* ---------------- la narración: una hoja con renglones ---------------- */
  narrar(lineas, o) {
    o = o || {};
    return new Promise((listo) => {
      const c = $('div', 'narra' + (o.final ? ' final' : ''), this.r);
      const h = $('div', 'hoja', c);
      const ps = lineas.map((l) => $('p', '', h, esc(l)));
      const seguir = $('div', 'seguir', h, esc(tr('tocar')));
      let i = 0, t = null;
      const mostrar = () => {
        if (i < ps.length) { ps[i].classList.add('ve'); i++; clearTimeout(t); t = setTimeout(mostrar, 2600 + lineas[i - 1].length * 35); if (i === ps.length) seguir.classList.add('ve'); }
      };
      const avanzar = () => {
        if (i < ps.length) { mostrar(); return; }
        clearTimeout(t); this.narrando = null;
        c.classList.add('fuera'); setTimeout(() => c.remove(), 700); listo();
      };
      this.narrando = avanzar;
      c.addEventListener('pointerdown', (e) => { e.preventDefault(); avanzar(); });
      setTimeout(mostrar, 500);
    });
  }

  /* ---------------- los globitos de charla ---------------- */
  globo(quien, nombre, texto, o) {
    o = o || {};
    const g = $('div', 'globo' + (o.grito ? ' grito' : ''), this.r, `<span class="nombre">${esc(nombre)}</span><p></p>${o.grito ? '' : '<i class="mas">▼</i>'}`);
    g.style.setProperty('--col', COLOR_DE[quien] || '#6a5a4a');
    const p = g.querySelector('p');
    const G = { el: g, quien, texto, n: 0, listo: false, t: 0 };
    G.escribir = (dt) => {
      if (G.listo) return;
      G.t += dt; const n = Math.min(texto.length, Math.floor(G.t * 48));
      if (n !== G.n) { G.n = n; p.textContent = texto.slice(0, n); if (this.alLetra && n % 3 === 0 && texto[n - 1] !== ' ') this.alLetra(quien); }
      if (n >= texto.length) { G.listo = true; g.classList.add('listo'); }
    };
    G.completar = () => { G.t = 999; G.escribir(0); };
    G.poner = (x, y) => {
      const w = g.offsetWidth, h = g.offsetHeight;
      const W = Pantalla.w, H = Pantalla.h;
      const lado = W * 0.075 + 8, arriba = Math.max(64, H * 0.1);
      const X = Math.max(lado, Math.min(W - w - lado, x - w * 0.35)), Y = Math.max(arriba, Math.min(H - h - 12, y - h - 26));
      g.style.transform = `translate(${X}px,${Y}px)`;
      g.style.setProperty('--cola', `${Math.max(18, Math.min(w - 26, x - X))}px`);
    };
    G.cerrar = () => { this.globos.delete(G); g.classList.add('fuera'); setTimeout(() => g.remove(), 300); };
    this.globos.add(G);
    requestAnimationFrame(() => g.classList.add('ve'));
    return G;
  }

  /* ---------------- ayudas, avisos, coplas, contador ---------------- */
  ayuda(texto) {
    if (this.notaEl) this.notaEl.remove();
    const n = this.notaEl = $('div', 'nota', this.r, `<i></i>${esc(texto)}`);
    setTimeout(() => n.classList.add('ve'), 30);
    clearTimeout(this.tNota);
    this.tNota = setTimeout(() => { n.classList.remove('ve'); setTimeout(() => n.remove(), 500); }, 6500);
  }
  esconderNota() { if (this.notaEl) { const n = this.notaEl; n.classList.remove('ve'); setTimeout(() => n.remove(), 500); this.notaEl = null; } }
  aviso(texto) {
    const a = $('div', 'aviso', this.r, esc(texto));
    setTimeout(() => a.classList.add('ve'), 30);
    setTimeout(() => { a.classList.remove('ve'); setTimeout(() => a.remove(), 500); }, 2600);
  }
  copla(versos, n, total) {
    if (this.coplaEl) this.coplaEl.remove();
    const c = this.coplaEl = $('div', 'coplaCard', this.r, `<small>${esc(tr('copla'))}</small>${versos.map((v) => `<p>${esc(v)}</p>`).join('')}<em>${esc(tr('coplasDe', n, total))}</em>`);
    setTimeout(() => c.classList.add('ve'), 30);
    clearTimeout(this.tCopla);
    this.tCopla = setTimeout(() => { c.classList.remove('ve'); setTimeout(() => c.remove(), 600); }, 6500);
    this.contador(n, total);
  }
  contador(n, total) {
    if (!this.contEl) this.contEl = $('div', 'contador', this.r);
    this.contEl.innerHTML = `<i></i><b>${n}</b><span>/${total}</span>`;
    this.contEl.classList.add('ve');
    clearTimeout(this.tCont);
    this.tCont = setTimeout(() => this.contEl.classList.remove('ve'), 3500);
  }
  /* la etiquetita de "X hablar" arriba de alguien */
  etiqueta(id, texto, x, y) {
    this.etis = this.etis || new Map();
    let e = this.etis.get(id);
    if (!texto) { if (e) { e.classList.remove('ve'); } return; }
    if (!e) { e = $('div', 'etiqueta', this.r); this.etis.set(id, e); }
    if (e.dataset.t !== texto) { e.innerHTML = texto; e.dataset.t = texto; }
    e.classList.add('ve');
    e.style.transform = `translate(${x - e.offsetWidth / 2}px,${y - e.offsetHeight - 8}px)`;
  }
  sinEtiquetas() { if (this.etis) for (const e of this.etis.values()) e.classList.remove('ve'); }

  /* ---------------- los créditos: un rollo de papel ---------------- */
  creditos(lineas) {
    return new Promise((listo) => {
      const c = $('div', 'creditos', this.r);
      const rollo = $('div', 'rollo', c);
      lineas.forEach((l, i) => $('p', i === 0 ? 'grande' : '', rollo, esc(l)));
      $('p', 'fin', rollo, `${esc(tr('fin'))}`);
      let fin = false;
      const cerrar = () => { if (fin) return; fin = true; this.narrando = null; c.classList.add('fuera'); setTimeout(() => { c.remove(); listo(); }, 800); };
      this.narrando = cerrar;
      c.addEventListener('pointerdown', cerrar);
      setTimeout(() => c.classList.add('ve'), 50);
      setTimeout(cerrar, 4000 + lineas.length * 2600);
    });
  }

  /* ---------------- los controles de dedo ----------------
     A (las opciones guardadas): { modo, alfa, vib, pos: { k: {x, y} en fracción
     de la pantalla }, tam: { k: escala } } con k = pal, salto, accion, pausa.
     Sin posición guardada, cada uno va a su lugar de siempre, adentro del telón. */
  controlesTactiles(alPausa, A) {
    if (this.tactil) return;
    this.A = A;
    const t = this.tactil = $('div', 'tactil', this.r);
    const zona = $('div', 'zonaPal', t), aro = $('div', 'aro', zona, '<i class="brazo v"></i><i class="brazo h"></i><i class="fl i"></i><i class="fl d"></i><i class="fl a"></i><i class="fl b"></i>'), bola = $('div', 'bola', zona);
    const bs = $('div', 'bSalto', t, '<svg viewBox="0 0 40 40"><path d="M20 3c7 6 9 16 4 26l-4 8-4-8C11 19 13 9 20 3z"/><path class="c" d="M20 7v29"/></svg>');
    const ba = $('div', 'bAccion', t, '<svg viewBox="0 0 40 40"><path d="M13 22V10a2.5 2.5 0 015 0v9-12a2.5 2.5 0 015 0v12-10a2.5 2.5 0 015 0v12-6a2.5 2.5 0 015 0v10c0 8-5 13-12 13-5 0-8-3-11-7l-5-7a2.5 2.5 0 014-3z"/></svg>');
    const bp = $('div', 'bPausa', t, '<i></i><i></i>');
    aro.dataset.control = 'pal'; bs.dataset.control = 'salto'; ba.dataset.control = 'accion'; bp.dataset.control = 'pausa';
    this.ctl = { pal: aro, salto: bs, accion: ba, pausa: bp, zona, bola };
    this.cfgPal = { radio: 44, modo: 'flotante', cx: 0, cy: 0 };
    this.reposoPal = Entrada.palanca(zona, aro, bola, this.cfgPal);
    Entrada.boton(bs, 'salto'); Entrada.boton(ba, 'accion');
    bp.addEventListener('pointerdown', (e) => { e.preventDefault(); alPausa(); });
    this.acomodar();
    addEventListener('resize', () => this.acomodar());
    addEventListener('orientationchange', () => setTimeout(() => this.acomodar(), 300));
    this.editorTactil(t);
  }
  verTactil(v) { if (this.tactil) this.tactil.classList.toggle('ve', v); }

  /* el marco del teatrito: lo que tapan el telón abierto y la cenefa */
  marco() {
    const w = Pantalla.w, h = Pantalla.h;
    return { w, h, izq: w * 0.067, der: w - w * 0.067, arr: Math.max(56, h * 0.09), aba: h };
  }
  /* dónde va el centro de cada control, en px del juego, siempre adentro del marco */
  centro(k) {
    const M = this.marco(), A = this.A, s = TAM_CTL[k] * A.tam[k];
    const def = { pal: [M.izq + 66, M.h - 126], salto: [M.der - 56, M.h - 72], accion: [M.der - 142, M.h - 116], pausa: [M.der - 33, M.arr + 27] }[k];
    let x = A.pos[k] ? A.pos[k].x * M.w : def[0], y = A.pos[k] ? A.pos[k].y * M.h : def[1];
    const entre = (v, a, b) => (a > b ? (a + b) / 2 : Math.max(a, Math.min(b, v)));
    x = entre(x, M.izq + s / 2 + 2, M.der - s / 2 - 2); y = entre(y, M.arr + s / 2, M.aba - s / 2 - 4);
    return { x, y, s };
  }
  acomodar() {
    const t = this.tactil, A = this.A;
    if (!t) return;
    const M = this.marco(), C = this.ctl;
    t.style.setProperty('--alfa', A.alfa);
    t.classList.toggle('cruz', A.modo === 'cruz');
    for (const k of ['salto', 'accion', 'pausa']) {
      const c = this.centro(k), el = C[k];
      Object.assign(el.style, { width: c.s + 'px', height: c.s + 'px', left: c.x - c.s / 2 + 'px', top: c.y - c.s / 2 + 'px' });
    }
    /* la palanca flotante escucha toda la mitad de su lado; la fija y la cruz, un poco más que su dibujo */
    const c = this.centro('pal'), r = c.s / 2, z = C.zona.style;
    let zx, zy, zw, zh;
    if (A.modo === 'flotante') { zx = c.x < M.w / 2 ? 0 : M.w / 2; zy = M.arr; zw = M.w / 2; zh = M.h - M.arr; }
    else { zw = zh = r * 3.2; zx = c.x - zw / 2; zy = c.y - zh / 2; }
    Object.assign(z, { left: zx + 'px', top: zy + 'px', width: zw + 'px', height: zh + 'px' });
    Object.assign(C.pal.style, { width: r * 2 + 'px', height: r * 2 + 'px' });
    Object.assign(C.bola.style, { width: r * PERILLA * 2 + 'px', height: r * PERILLA * 2 + 'px' });
    Object.assign(this.cfgPal, { radio: r, modo: A.modo, cx: c.x - zx, cy: c.y - zy });
    this.reposoPal();
    Entrada.vibrar = !!A.vib;
  }

  /* ---------------- acomodar los controles: se arrastran como recortes sobre el escenario ----------------
     Mientras se acomoda, un escucha "de captura" en el contenedor se queda con
     los toques antes que los botones: así no se salta ni se camina. */
  editorTactil(t) {
    const dedos = new Map();
    let mov = null, pinza = null;
    const activo = (e) => t.classList.contains('editando') && !(this.barraEd && this.barraEd.contains(e.target));
    const pos = (e) => Pantalla.aJuego(e.clientX, e.clientY);
    t.addEventListener('pointerdown', (e) => {
      if (!activo(e)) return;
      e.stopPropagation(); e.preventDefault();
      const q = pos(e);
      dedos.set(e.pointerId, q);
      try { t.setPointerCapture(e.pointerId); } catch (_) {}
      if (dedos.size === 1) {
        const el = e.target.closest && e.target.closest('[data-control]');
        mov = null;
        if (el) { this.elegirCtl(el.dataset.control); const c = this.centro(this.sel); mov = { id: e.pointerId, dx: c.x - q.x, dy: c.y - q.y }; }
      } else if (dedos.size === 2) {
        const [a, b] = [...dedos.values()];
        pinza = { d0: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), s0: this.A.tam[this.sel] }; mov = null;
      }
    }, true);
    t.addEventListener('pointermove', (e) => {
      if (!dedos.has(e.pointerId) || !t.classList.contains('editando')) return;
      e.stopPropagation(); e.preventDefault();
      const q = pos(e);
      dedos.set(e.pointerId, q);
      const M = this.marco();
      if (pinza && dedos.size >= 2) {
        const [a, b] = [...dedos.values()];
        this.A.tam[this.sel] = Math.round(Math.max(0.6, Math.min(1.8, pinza.s0 * Math.hypot(a.x - b.x, a.y - b.y) / pinza.d0)) * 20) / 20;
        this.acomodar(); this.pintarBarra();
      } else if (mov && e.pointerId === mov.id) {
        this.A.pos[this.sel] = { x: (q.x + mov.dx) / M.w, y: (q.y + mov.dy) / M.h };
        this.barraEd.classList.add('lejos');
        this.acomodar();
      }
    }, true);
    const fin = (e) => {
      if (!dedos.delete(e.pointerId)) return;
      e.stopPropagation();
      if (dedos.size < 2) pinza = null;
      if (mov && mov.id === e.pointerId) {
        /* queda guardado donde se ve (ya metido adentro del marco) */
        const c = this.centro(this.sel), M = this.marco();
        this.A.pos[this.sel] = { x: c.x / M.w, y: c.y / M.h };
        mov = null;
      }
      if (this.barraEd) this.barraEd.classList.remove('lejos');
      if (this.alCambioTactil) this.alCambioTactil();
    };
    t.addEventListener('pointerup', fin, true); t.addEventListener('pointercancel', fin, true);
  }
  elegirCtl(k) {
    this.sel = k;
    for (const [n, el] of Object.entries(this.ctl)) if (TAM_CTL[n]) el.classList.toggle('elegido', n === k);
    this.pintarBarra();
  }
  pintarBarra() {
    const b = this.barraEd, A = this.A;
    if (!b) return;
    const q = (s) => b.querySelector(s);
    q('[data-k=tam] em').textContent = `${tr(NOMBRE_CTL[this.sel])} · ${Math.round(A.tam[this.sel] * 100)}%`;
    q('[data-k=alfa] em').textContent = Math.round(A.alfa * 100) + '%';
    q('[data-k=modo] em').textContent = tr(A.modo);
    q('[data-k=vib] em').textContent = tr(A.vib ? 'si' : 'no');
  }
  editarTactil(alCambio, alListo) {
    const t = this.tactil, A = this.A;
    this.limpiar();
    this.capa.classList.add('oscuro');
    const antes = t.classList.contains('ve');
    t.classList.add('editando', 've');
    for (const [k, el] of Object.entries(this.ctl)) if (NOMBRE_CTL[k]) el.dataset.nombre = tr(NOMBRE_CTL[k]);
    this.alCambioTactil = alCambio;
    const par = (k, n) => `<div class="chip par" data-k="${k}"><button data-d="-1">−</button><span><i>${esc(tr(n))}</i><em></em></span><button data-d="1">+</button></div>`;
    const b = this.barraEd = $('div', 'acomoda', t, `<b class="tit">${esc(tr('acomodaTit'))}</b><small>${esc(tr('acomodaAyuda'))}</small>
      <div class="chips">${par('tam', 'tamano')}${par('alfa', 'opacidad')}
        <button class="chip" data-k="modo"><i>${esc(tr('palanca'))}</i><em></em></button>
        <button class="chip" data-k="vib"><i>${esc(tr('vibrar'))}</i><em></em></button>
        <button class="chip" data-k="espejo">${esc(tr('espejar'))}</button>
        <button class="chip" data-k="reset">${esc(tr('restablecer'))}</button>
        <button class="chip listo" data-k="listo">${esc(tr('listo'))}</button></div>`);
    const MODOS = ['flotante', 'fija', 'cruz'];
    const salir = () => {
      t.classList.remove('editando'); b.remove(); this.barraEd = null; this.alCambioTactil = null;
      for (const el of Object.values(this.ctl)) el.classList.remove('elegido');
      this.verTactil(antes);
      alListo();
    };
    const hacer = (k, d) => {
      const M = this.marco();
      if (k === 'tam') A.tam[this.sel] = Math.round(Math.max(0.6, Math.min(1.8, A.tam[this.sel] + d * 0.1)) * 10) / 10;
      else if (k === 'alfa') A.alfa = Math.round(Math.max(0.2, Math.min(1, A.alfa + d * 0.1)) * 10) / 10;
      else if (k === 'modo') A.modo = MODOS[(MODOS.indexOf(A.modo) + (d || 1) + 3) % 3];
      else if (k === 'vib') { A.vib = !A.vib; Entrada.vibrar = A.vib; Entrada.zumbar(30); }
      else if (k === 'espejo') for (const n of Object.keys(TAM_CTL)) { const c = this.centro(n); A.pos[n] = { x: 1 - c.x / M.w, y: c.y / M.h }; }
      else if (k === 'reset') { A.pos = {}; A.tam = { pal: 1, salto: 1, accion: 1, pausa: 1 }; A.modo = 'flotante'; A.alfa = 0.85; }
      else if (k === 'listo') { salir(); return; }
      this.acomodar(); this.pintarBarra();
      if (alCambio) alCambio();
    };
    /* cada botón de la barra, también con flechas y mando */
    const items = [...b.querySelectorAll('button')];
    const accion = (el) => [el.closest('[data-k]').dataset.k, +(el.dataset.d || 0)];
    this.lista(items, {
      i: items.length - 1,
      elegir: (i, el) => { const [k, d] = accion(el || items[i]); hacer(k, d); },
      volver: salir,
    });
    this.elegirCtl(this.sel || 'salto');
  }
}

/* el tamaño de cada control a escala 1 (la palanca, de diámetro) y cómo se llama */
const TAM_CTL = { pal: 88, salto: 76, accion: 64, pausa: 46 };
const NOMBRE_CTL = { pal: 'cCaminar', salto: 'cSaltar', accion: 'cMano', pausa: 'cPausa' };
