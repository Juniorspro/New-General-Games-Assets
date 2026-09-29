// La interfaz del juego: la barra de 9 ranuras, vida y hambre, la plata, la
// hora, los avisos de la mira, las notificaciones, y la ventana con pestañas
// (Mochila, Mesa, Cofre, Colección). Como en los videos: ranuras grises
// translúcidas, y al pasar por arriba un cartel oscuro con el nombre, las
// estrellas de rareza y el precio en una pastilla verde.
//
// Mover cosas es a lo Minecraft: clic levanta la pila (derecho, la mitad),
// clic la deja (derecho, de a una), Shift+clic la manda al otro lado.
import { ITEMS, RECETAS, COLOR_ESTRELLAS, icono, nodoIcono, estrellasTexto, precioTexto } from './items.js';
import { PINCELES } from './acciones.js';
import { t } from './idioma.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Hud {
  constructor(J) {
    this.J = J;
    this.raiz = $('hud');
    this.elAviso = $('aviso');
    this.elAccion = $('accion');
    this.elAccion.innerHTML = '<i></i>';
    this.barraAccion = this.elAccion.firstChild;
    this.elVida = $('vida').firstChild; this.elHambre = $('hambre').firstChild;
    this.elPlata = $('plata'); this.elHora = $('hora');
    this.elBarra = $('barra'); this.elPinceles = $('pinceles'); this.elNotis = $('notis');
    this.elObjetivo = $('objetivo');
    this.elVentana = $('ventana'); this.elPestanas = $('vPestanas'); this.elCuerpo = $('vCuerpo');
    this.elTip = $('tip'); this.elArrastre = $('arrastre');
    this.t = 0;
    this.textoAviso = null;

    // la barra
    this.ranBarra = [];
    for (let i = 0; i < 9; i++) {
      const d = this.crearRanura();
      d.dataset.i = i;
      this.elBarra.appendChild(d);
      this.ranBarra.push(d);
    }
    this.elBarra.addEventListener('pointerdown', (ev) => {
      const r = ev.target.closest('.ranura');
      if (r && !this.abierta) { J.acciones.seleccionar(+r.dataset.i); ev.preventDefault(); ev.stopPropagation(); }
    });
    this.versionBarra = -1; this.selBarra = -1;

    // los pinceles de la pala
    this.botPincel = PINCELES.map((p, i) => {
      const b = document.createElement('button');
      b.title = t('pincel.titulo', { nombre: p.nombre });
      b.textContent = p.glifo;
      b.style.background = p.color;
      b.addEventListener('pointerdown', (ev) => { J.acciones.pincel = i; ev.preventDefault(); ev.stopPropagation(); });
      this.elPinceles.appendChild(b);
      return b;
    });
    this.elPinceles.classList.add('oculto');

    // la ventana
    this.abierta = null;       // 'mochila' | 'mesa' | 'cofre' | 'coleccion'
    this.cofre = null;         // el Inventario del cofre abierto
    this.cursor = null;        // la pila que se está moviendo { id, n }
    this.vistas = [];          // ranuras dibujadas en la ventana: { inv, i, el }
    this.versiones = '';
    $('vCerrar').addEventListener('click', () => this.cerrar());
    this.elVentana.addEventListener('pointerdown', (ev) => {
      if (ev.target !== this.elVentana) return;
      // clic afuera con algo levantado: se tira al piso
      if (this.cursor) { J.acciones.lanzar(this.cursor.id, this.cursor.n); this.cursor = null; this.dibujarCursor(); }
      else this.cerrar();
    });
    this.elVentana.addEventListener('contextmenu', (ev) => ev.preventDefault());
    addEventListener('keydown', (ev) => {
      if (!this.abierta) return;
      if (['Tab', 'KeyE', 'Escape', 'KeyI'].includes(ev.code)) { ev.preventDefault(); this.cerrar(); }
    });
    addEventListener('pointermove', (ev) => {
      this.mx = ev.clientX; this.my = ev.clientY;
      if (this.cursor) this.moverCursor();
      if (!this.elTip.classList.contains('oculto')) this.moverTip();
    });

    this.notis = [];
    this.tPlata = 0;
    this.mostrado = false;
  }

  // Al cambiar de idioma: lo que ya está escrito se vuelve a escribir.
  refrescar() {
    this.botPincel.forEach((b, i) => { b.title = t('pincel.titulo', { nombre: PINCELES[i].nombre }); });
    this.tPlata = 0;
    this.textoAviso = null;
    if (this.abierta) this.render();
  }

  mostrar(v) {
    this.mostrado = v;
    this.raiz.classList.toggle('oculto', !v);
    if (!v) this.elTip.classList.add('oculto');
  }

  crearRanura() {
    const d = document.createElement('div');
    d.className = 'ranura vacia';
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    d.appendChild(c);
    d.appendChild(document.createElement('b'));
    d._id = undefined; d._n = undefined;
    return d;
  }

  pintarRanura(d, r) {
    const id = r ? r.id : null, n = r ? r.n : 0;
    if (d._id === id && d._n === n) return;
    d._id = id; d._n = n;
    const g = d.firstChild.getContext('2d');
    g.clearRect(0, 0, 16, 16);
    if (id) { g.drawImage(icono(id), 0, 0); d.classList.remove('vacia'); d.lastChild.textContent = n > 1 ? n : ''; }
    else { d.classList.add('vacia'); d.lastChild.textContent = ''; }
  }

  // ── cada cuadro ───────────────────────────────────────────────────────────
  actualizar(dt) {
    const J = this.J;
    this.t += dt;
    if (J.inv.version !== this.versionBarra || J.acciones.sel !== this.selBarra) {
      this.versionBarra = J.inv.version; this.selBarra = J.acciones.sel;
      this.ranBarra.forEach((d, i) => { this.pintarRanura(d, J.inv.ranuras[i]); d.classList.toggle('sel', i === J.acciones.sel); });
    }
    this.elVida.style.height = `${Math.max(0, J.jugador.vida)}%`;
    this.elHambre.style.height = `${Math.max(0, J.jugador.hambre)}%`;
    this.tPlata -= dt;
    if (this.tPlata <= 0) {
      this.tPlata = 0.5;
      this.elPlata.textContent = precioTexto(J.patrimonio());
      this.elHora.textContent = t('hud.dia', { n: J.dia, hora: J.cielo.horaTexto() });
    }
    const it = J.acciones.item();
    const conPala = !!(it && it.herr === 'pala') && !this.abierta;
    this.elPinceles.classList.toggle('oculto', !conPala);
    if (conPala) this.botPincel.forEach((b, i) => b.classList.toggle('sel', i === J.acciones.pincel));
    // notificaciones
    for (let i = this.notis.length - 1; i >= 0; i--) {
      const q = this.notis[i];
      q.vida -= dt;
      if (q.vida <= 0 && !q.saliendo) { q.saliendo = true; q.el.classList.add('sale'); }
      if (q.vida <= -0.35) { q.el.remove(); this.notis.splice(i, 1); }
    }
    // la ventana abierta sigue al inventario (algo que juntaste mientras miraba)
    if (this.abierta) {
      const v = `${J.inv.version}|${this.cofre ? this.cofre.version : ''}`;
      if (v !== this.versiones) { this.versiones = v; this.repintar(); }
    }
  }

  aviso(html) {
    if (html === this.textoAviso) return;
    this.textoAviso = html;
    this.elAviso.innerHTML = this.J.entrada.tactil ? html.replace(/<kbd>E<\/kbd>/, '') : html;
  }

  progreso(f) {
    if (f === null || f === undefined) { this.elAccion.style.opacity = 0; return; }
    this.elAccion.style.opacity = 1;
    this.barraAccion.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
  }

  objetivo(texto) {
    if (!this.elObjetivo) return;
    this.elObjetivo.textContent = texto || '';
    this.elObjetivo.dataset.t = t('hud.objetivo');
    this.elObjetivo.classList.toggle('oculto', !texto);
  }

  // texto con {n}: si llega otra con la misma clave, se suman
  noti(texto, id = null, clave = null, n = 0, nueva = false) {
    const armar = (k) => (n ? texto.replace('{n}', k) : texto);
    const q = clave && this.notis.find((x) => x.clave === clave && !x.saliendo);
    if (q) {
      q.n += n; q.vida = 3.2;
      q.span.textContent = armar(q.n);
      q.el.classList.remove('late'); void q.el.offsetWidth; q.el.classList.add('late');
      return;
    }
    const el = document.createElement('div');
    el.className = 'noti' + (nueva ? ' nueva' : '');
    if (id && ITEMS[id]) el.appendChild(nodoIcono(id, 16));
    const span = document.createElement('span');
    span.textContent = armar(n);
    el.appendChild(span);
    this.elNotis.appendChild(el);
    this.notis.push({ el, span, clave, n, vida: nueva ? 5 : 3.2 });
    if (this.notis.length > 6) { const v = this.notis.shift(); v.el.remove(); }
  }

  // ── la ventana ───────────────────────────────────────────────────────────
  abrir(pestana = 'mochila', cofre = null) {
    const J = this.J;
    this.abierta = pestana;
    this.cofre = cofre || (pestana === 'cofre' ? this.cofre : null);
    if (pestana === 'mesa') this.mesaCerca = true;
    else if (pestana === 'mochila') this.mesaCerca = J.hayMesaCerca();
    this.elVentana.classList.remove('oculto');
    $('mira').classList.add('oculto');
    J.alAbrirVentana();
    this.render();
  }

  alternar(pestana = 'mochila') { if (this.abierta) this.cerrar(); else this.abrir(pestana); }

  cerrar() {
    const J = this.J;
    if (!this.abierta) return;
    if (this.cursor) {
      const resto = J.inv.agregar(this.cursor.id, this.cursor.n);
      if (resto) J.acciones.lanzar(this.cursor.id, resto);
      this.cursor = null; this.dibujarCursor();
    }
    this.abierta = null;
    this.cofre = null;
    this.elVentana.classList.add('oculto');
    this.elTip.classList.add('oculto');
    $('mira').classList.remove('oculto');
    J.entrada.recien.clear();
    J.alCerrarVentana();
  }

  render() {
    const J = this.J;
    const tabs = [['mochila', t('v.mochila')], ['mesa', t('v.mesa')], ...(this.cofre ? [['cofre', t('v.cofre')]] : []), ['coleccion', t('v.coleccion')]];
    this.elPestanas.innerHTML = '';
    for (const [id, nombre] of tabs) {
      const b = document.createElement('button');
      b.textContent = nombre;
      if (id === this.abierta) b.classList.add('sel');
      b.addEventListener('click', () => { this.abierta = id; this.J.son.sfx('ui'); this.render(); });
      this.elPestanas.appendChild(b);
    }
    this.vistas = [];
    const C = this.elCuerpo;
    C.innerHTML = '';
    if (this.abierta === 'mochila') {
      C.appendChild(this.titulo(t('v.mochila')));
      C.appendChild(this.grilla(J.inv, 9, 36));
      C.appendChild(this.separa());
      C.appendChild(this.grilla(J.inv, 0, 9));
      C.appendChild(this.titulo(t('v.fabricarMano')));
      C.appendChild(this.recetas(RECETAS.filter((r) => !r.mesa)));
      const falta = RECETAS.filter((r) => r.mesa).length;
      const nota = document.createElement('div');
      nota.className = 'resumen';
      nota.textContent = t(this.mesaCerca ? 'v.mesaCerca' : 'v.mesaFalta', { n: falta });
      C.appendChild(nota);
    } else if (this.abierta === 'mesa') {
      C.appendChild(this.titulo(t(this.mesaCerca ? 'v.mesaTitulo' : 'v.mesaLejos')));
      C.appendChild(this.recetas(RECETAS, !this.mesaCerca));
      C.appendChild(this.titulo(t('v.barra')));
      C.appendChild(this.grilla(J.inv, 0, 9));
    } else if (this.abierta === 'cofre' && this.cofre) {
      C.appendChild(this.titulo(t('v.cofre')));
      C.appendChild(this.grilla(this.cofre, 0, 27));
      C.appendChild(this.titulo(t('v.mochila')));
      C.appendChild(this.grilla(J.inv, 9, 36));
      C.appendChild(this.separa());
      C.appendChild(this.grilla(J.inv, 0, 9));
    } else {
      this.abierta = 'coleccion';
      C.appendChild(this.coleccion());
    }
    this.versiones = `${J.inv.version}|${this.cofre ? this.cofre.version : ''}`;
  }

  // Refresca solo el contenido (sin rehacer la ventana: si no, un clic se pierde).
  repintar() {
    for (const v of this.vistas) this.pintarRanura(v.el, v.inv.ranuras[v.i]);
    for (const r of this.elCuerpo.querySelectorAll('.receta')) this.pintarReceta(r);
  }

  titulo(t) { const d = document.createElement('div'); d.className = 'titulo'; d.textContent = t; return d; }
  separa() { const d = document.createElement('div'); d.className = 'separa'; return d; }

  grilla(inv, a, b) {
    const g = document.createElement('div');
    g.className = 'grilla';
    for (let i = a; i < b; i++) {
      const d = this.crearRanura();
      this.pintarRanura(d, inv.ranuras[i]);
      if (inv === this.J.inv && i === this.J.acciones.sel) d.classList.add('sel');
      d.addEventListener('pointerdown', (ev) => { ev.preventDefault(); this.clicRanura(inv, i, ev); this.tipDe(inv.ranuras[i]); });
      d.addEventListener('pointerenter', () => this.tipDe(inv.ranuras[i]));
      d.addEventListener('pointerleave', () => this.elTip.classList.add('oculto'));
      this.vistas.push({ inv, i, el: d });
      g.appendChild(d);
    }
    return g;
  }

  clicRanura(inv, i, ev) {
    const der = ev.button === 2;
    const r = inv.ranuras[i];
    if (ev.shiftKey && r && !this.cursor) { this.moverRapido(inv, i); this.J.son.sfx('ui'); return; }
    if (!this.cursor) {
      if (!r) return;
      const n = der ? Math.ceil(r.n / 2) : r.n;
      this.cursor = { id: r.id, n };
      r.n -= n;
      if (r.n <= 0) inv.ranuras[i] = null;
    } else {
      const c = this.cursor, max = inv.pila(c.id);
      if (!r) { const n = der ? 1 : Math.min(c.n, max); inv.ranuras[i] = { id: c.id, n }; c.n -= n; }
      else if (r.id === c.id) { const n = Math.min(der ? 1 : c.n, max - r.n); r.n += n; c.n -= n; }
      else if (!der) { inv.ranuras[i] = c; this.cursor = r; }
      if (this.cursor && this.cursor.n <= 0) this.cursor = null;
    }
    inv.tocado();
    this.J.son.sfx('ui');
    this.dibujarCursor();
    this.repintar();
  }

  // Shift+clic: del cofre a la mochila y al revés; sin cofre, barra ↔ mochila.
  moverRapido(inv, i) {
    const J = this.J, r = inv.ranuras[i];
    if (this.abierta === 'cofre' && this.cofre) {
      const destino = inv === this.cofre ? J.inv : this.cofre;
      const resto = destino.agregar(r.id, r.n);
      if (resto === r.n) return;
      r.n = resto;
      if (!r.n) inv.ranuras[i] = null;
      inv.tocado();
      return;
    }
    const [a, b] = i < 9 ? [9, 36] : [0, 9];
    const max = inv.pila(r.id);
    for (let k = a; k < b && r.n > 0; k++) {
      const q = inv.ranuras[k];
      if (q && q.id === r.id && q.n < max) { const m = Math.min(r.n, max - q.n); q.n += m; r.n -= m; }
    }
    for (let k = a; k < b && r.n > 0; k++) if (!inv.ranuras[k]) { inv.ranuras[k] = { id: r.id, n: r.n }; r.n = 0; }
    if (r.n <= 0) inv.ranuras[i] = null;
    inv.tocado();
  }

  dibujarCursor() {
    const A = this.elArrastre;
    if (!this.cursor) { A.classList.add('oculto'); A.innerHTML = ''; return; }
    A.innerHTML = '';
    A.appendChild(nodoIcono(this.cursor.id, 16));
    if (this.cursor.n > 1) { const b = document.createElement('b'); b.textContent = this.cursor.n; A.appendChild(b); }
    A.classList.remove('oculto');
    this.moverCursor();
  }
  moverCursor() { this.elArrastre.style.left = `${this.mx}px`; this.elArrastre.style.top = `${this.my}px`; }

  tipDe(r, desconocido = false) {
    const T = this.elTip;
    if (!r) { T.classList.add('oculto'); return; }
    const it = ITEMS[r.id];
    if (desconocido) T.innerHTML = `<div class="n">???</div><div class="d">${esc(t('tip.desconocido'))}</div>`;
    else {
      const col = COLOR_ESTRELLAS[Math.min(5, it.estrellas)];
      const precio = r.n > 1 ? t('tip.cu', { p: precioTexto(it.valor), t: precioTexto(it.valor * r.n) }) : precioTexto(it.valor);
      T.innerHTML = `<div class="n">${esc(it.nombre)}</div><div class="e" style="color:${col}">${estrellasTexto(it.estrellas)}</div>`
        + `<span class="p">${precio}</span>${it.desc ? `<div class="d">${esc(it.desc)}</div>` : ''}${it.comida ? `<div class="d">${esc(t('tip.comida', { n: it.comida }))}</div>` : ''}`;
    }
    T.classList.remove('oculto');
    this.moverTip();
  }
  moverTip() {
    const T = this.elTip;
    const w = T.offsetWidth, h = T.offsetHeight;
    let x = this.mx + 16, y = this.my + 14;
    if (x + w > innerWidth - 6) x = this.mx - w - 12;
    if (y + h > innerHeight - 6) y = innerHeight - h - 6;
    T.style.left = `${x}px`; T.style.top = `${y}px`;
  }

  recetas(lista, bloqueadas = false) {
    const cont = document.createElement('div');
    cont.className = 'recetas';
    for (const rec of lista) {
      const d = document.createElement('div');
      d.className = 'receta';
      d._rec = rec; d._bloq = bloqueadas || (rec.mesa && !this.mesaCerca);
      d.appendChild(nodoIcono(rec.id, 16));
      const nom = document.createElement('div');
      nom.className = 'nom';
      nom.textContent = ITEMS[rec.id].nombre + (rec.da > 1 ? ` ×${rec.da}` : '');
      d.appendChild(nom);
      const ing = document.createElement('div');
      ing.className = 'ing';
      for (const id of Object.keys(rec.pide)) {
        const s = document.createElement('span');
        s.appendChild(nodoIcono(id, 16));
        s.appendChild(document.createElement('i'));
        s.dataset.id = id;
        s.title = ITEMS[id].nombre;
        ing.appendChild(s);
      }
      d.appendChild(ing);
      const b = document.createElement('button');
      b.textContent = t('v.hacer');
      b.addEventListener('click', () => this.fabricar(rec));
      d.appendChild(b);
      d.addEventListener('pointerenter', () => this.tipDe({ id: rec.id, n: rec.da }));
      d.addEventListener('pointerleave', () => this.elTip.classList.add('oculto'));
      this.pintarReceta(d);
      cont.appendChild(d);
    }
    return cont;
  }

  pintarReceta(d) {
    const J = this.J, rec = d._rec;
    for (const s of d.querySelectorAll('.ing span')) {
      const id = s.dataset.id, tengo = J.inv.contar(id), pide = rec.pide[id];
      s.lastChild.textContent = `${Math.min(tengo, 999)}/${pide}`;
      s.classList.toggle('falta', tengo < pide);
    }
    d.querySelector('button').disabled = d._bloq || !J.inv.puedeHacer(rec) || !J.inv.cabe(rec.id, rec.da);
  }

  fabricar(rec) {
    const J = this.J;
    if ((rec.mesa && !this.mesaCerca) || !J.inv.hacer(rec)) { J.son.sfx('ui'); return; }
    J.son.sfx('craftear');
    J.alFabricar(rec);
    this.repintar();
  }

  coleccion() {
    const J = this.J;
    const cont = document.createElement('div');
    const ids = Object.keys(ITEMS);
    const vistos = ids.filter((id) => J.descubiertos.has(id)).length;
    cont.appendChild(this.titulo(t('v.coleccionTitulo', { a: vistos, b: ids.length })));
    const g = document.createElement('div');
    g.className = 'coleccion';
    for (const id of ids) {
      const d = document.createElement('div');
      const visto = J.descubiertos.has(id);
      if (!visto) d.className = 'no';
      d.appendChild(nodoIcono(id, 16));
      d.addEventListener('pointerenter', () => this.tipDe({ id, n: 1 }, !visto));
      d.addEventListener('pointerleave', () => this.elTip.classList.add('oculto'));
      g.appendChild(d);
    }
    cont.appendChild(g);
    const s = J.stats;
    const r = document.createElement('div');
    r.className = 'resumen';
    r.innerHTML = t('v.patrimonio', { p: precioTexto(J.patrimonio()), d: J.dia }) + '<br>'
      + esc(t('v.stats', { a: s.palmeras || 0, b: s.rocas || 0, c: s.peces || 0, d: s.bloques || 0 }));
    cont.appendChild(r);
    return cont;
  }
}
