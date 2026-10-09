/*
 * Truco: la página. Rearma las pantallas del original (Truco Blyts, Unity IL2CPP) con sus imágenes,
 * voces y textos, sacados del APK por armar-datos.py; las reglas son truco.js y la computadora,
 * truco-ia.js. Las medidas salen de las escenas del original (GP1v1, GP2v2, GP3v3, Menu, Map,
 * Region, Counter): un escenario de 1200 de ancho, como su CanvasScaler.
 *
 * Lo del original que necesita servidor (online, torneos, ranking, tienda, chat) no está.
 */
(function () {
  'use strict';
  const D = 'datos/';
  const ESC = document.getElementById('escenario');
  let IND = null, TXT = {}, JUG = null;
  const App = window.TrucoApp = { test: {} };

  // ── utilidades ─────────────────────────────────────────────────────────────────────────
  function el(tag, clase, padre, txt) {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (txt != null) e.textContent = txt;
    if (padre) padre.appendChild(e);
    return e;
  }
  function pos(e, x, y, w, h) {
    e.style.left = x + 'px'; e.style.top = y + 'px';
    if (w != null) e.style.width = w + 'px';
    if (h != null) e.style.height = h + 'px';
    return e;
  }
  function T(k, ...a) {
    const s = TXT[k];
    if (s == null) return k;
    return s.replace(/\{(\d+)(?::K)?\}/g, (m, i) => (a[+i] != null ? a[+i] : ''));
  }
  const FRASES = {};
  function indexarFrases() {
    for (const k of Object.keys(TXT)) {
      const m = /^(.*)_(\d+)$/.exec(k);
      if (m) (FRASES[m[1]] = FRASES[m[1]] || []).push([+m[2], TXT[k]]);
    }
    for (const b of Object.keys(FRASES)) FRASES[b] = FRASES[b].sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  }
  const frases = (b) => FRASES[b] || [];
  const azar = () => Math.random();
  const elegir = (l) => l[Math.floor(azar() * l.length)];
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const entre = (a, b) => a + azar() * (b - a);
  function leer(clave, def) {
    try { const v = JSON.parse(localStorage.getItem(clave)); return v && typeof v === 'object' ? Object.assign(def, v) : def; } catch (_) { return def; }
  }
  function guardar(clave, v) { try { localStorage.setItem(clave, JSON.stringify(v)); } catch (_) { /* sin lugar: se juega igual */ } }
  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (_) {} }
  function tocar(e, fn) {
    e.classList.add('toca');
    e.addEventListener('click', (ev) => { ev.stopPropagation(); vibrar(); Sonido.efecto('menuclick', 0.7); fn(ev); });
    return e;
  }

  // ── ajustes (los del panel del original: "Ajustes partido" y "Ajustes perfil") ────────────
  const AJ = leer('truco.ajustes', { flor: false, puntos: 15, rapido: false, sexo: 'hombre', mazo: 'default', voces: true,
    voz: 'porteno', musica: true, efectos: true, nombre: '', mostrar: true, modo: 2 });
  const guardarAjustes = () => guardar('truco.ajustes', AJ);
  const VOCES = {
    hombre: { original: 'maleoriginal', porteno: 'maleporteno', tanguero: 'maletanguero', gaucho: 'malegaucho', cordoba: 'malecordoba', misiones: 'malemisiones', english: 'malebritanico' },
    mujer: { original: 'femaleoriginal', porteno: 'femaleporteno', interior: 'femalevieja', cordoba: 'femalecordoba', misiones: 'femalemisiones' },
  };
  const miVoz = () => VOCES[AJ.sexo][AJ.voz] || VOCES[AJ.sexo].porteno;
  const miNombre = () => AJ.nombre || (AJ.sexo === 'mujer' ? 'Vos' : 'Vos');
  const miAvatar = () => (AJ.sexo === 'mujer' ? 'female' : 'male');
  const MAZOS = ['default', 'gaucho', 'peronista', 'rocknacional', 'vllc', 'worldcup'];

  // ── el escenario: 1200 de ancho, el alto que dé la pantalla ───────────────────────────────
  const sa = { arriba: 0, abajo: 0 };
  let escala = 1, altoEsc = 2600;
  function medirSafeArea() {
    const p = el('div', null, document.body);
    p.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    const cs = getComputedStyle(p);
    const r = [parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingBottom) || 0];
    p.remove();
    return r;
  }
  function encajar() {
    const W = innerWidth, H = innerHeight;
    let e = W / 1200, alto = H / e;
    if (alto < 2000) { e = H / 2000; alto = 2000; }     // ventana ancha (compu, tablet): una columna en el medio
    escala = e; altoEsc = alto;
    const [sArr, sAb] = medirSafeArea();
    sa.arriba = Math.round(sArr / e); sa.abajo = Math.round(sAb / e);
    ESC.style.height = alto + 'px';
    ESC.style.transform = `translate(${Math.round((W - 1200 * e) / 2)}px,0) scale(${e})`;
    ESC.style.setProperty('--sa-arriba', sa.arriba + 'px');
    ESC.style.setProperty('--sa-abajo', sa.abajo + 'px');
    if (App.alEncajar) App.alEncajar();
  }
  App.medidas = () => ({ escala, alto: altoEsc, sa: Object.assign({}, sa) });

  // ── los datos ──────────────────────────────────────────────────────────────────────────
  async function json(r) {
    const x = await fetch(D + r);
    if (!x.ok) throw new Error(`${r}: ${x.status}`);
    return x.json();
  }
  const blobs = {};
  function blobUrl(ruta) {
    if (!blobs[ruta]) {
      blobs[ruta] = fetch(D + ruta).then((r) => { if (!r.ok) throw new Error(`${ruta}: ${r.status}`); return r.blob(); })
        .then((b) => URL.createObjectURL(b));
    }
    return blobs[ruta];
  }
  const FAMILIAS = { 'YanoneKaffeesatz-Regular': 'Yanone', 'YanoneKaffeesatz-Bold': 'YanoneB', TitilliumText22L001: 'Tit1',
    TitilliumText22L002: 'Tit2', TitilliumText22L003: 'Tit3', TitilliumText22L004: 'Tit4', TitilliumText22L005: 'Tit5',
    TitilliumText22L_Bold: 'TitB', TitilliumText22L_Med: 'TitM', TitilliumText22L_Light: 'TitL', VistaSanMed: 'Vista',
    VistaSanAltMed: 'VistaAlt', ifc_los_benditos: 'Benditos' };
  async function cargarDatos(alAvanzar) {
    [IND, TXT, JUG] = await Promise.all([json('indice.json'), json('textos.json'), json('jugadores.json')]);
    indexarFrases();
    const raiz = document.documentElement.style;
    const tareas = [];
    for (const n of Object.keys(IND.ui)) tareas.push(blobUrl(`ui/${n}.webp`).then((u) => raiz.setProperty('--u-' + n, `url("${u}")`)));
    for (const [n, r] of Object.entries(IND.fuentes)) {
      if (!FAMILIAS[n] || !window.FontFace) continue;
      const f = new FontFace(FAMILIAS[n], `url(${D + r})`);
      tareas.push(f.load().then(() => document.fonts.add(f)).catch(() => {}));
    }
    tareas.push(blobUrl('fondos/menu.webp').then((u) => raiz.setProperty('--fondo-menu', `url("${u}")`)));
    tareas.push(blobUrl('fondos/costado.webp').then((u) => raiz.setProperty('--fondo-costado', `url("${u}")`)));
    let hechas = 0;
    await Promise.all(tareas.map((t) => t.then(() => alAvanzar && alAvanzar(++hechas, tareas.length))));
  }
  const ui = (n) => `datos/ui/${n}.webp`;
  // fondo de un elemento con un archivo de datos/: por fetch (así anda también en el .html de un solo
  // archivo, que atiende fetch, <img> y <audio> pero no las url() que se ponen en un style)
  function fondo(e, ruta) {
    blobUrl(ruta).then((u) => { e.style.backgroundImage = `url("${u}")`; }).catch(() => {});
    return e;
  }
  const avatarUrl = (n) => `${D}avatares/${n}.webp`;
  const cartaUrl = (c, mazo) => `${D}cartas/${mazo || AJ.mazo}/${c.palo}-${c.num}.webp`;
  function img(src, clase, padre) { const i = el('img', clase, padre); i.alt = ''; i.draggable = false; i.src = src; return i; }

  // ── el sonido: efectos y voces con WebAudio, la música con <audio> ─────────────────────────
  const Sonido = {
    ctx: null, buffers: {}, musica: null, pista: null, quiere: null,
    iniciar() {
      if (this.ctx) return;
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      try { this.ctx = new C(); this.salida = this.ctx.createGain(); this.salida.connect(this.ctx.destination); } catch (_) { this.ctx = null; }
    },
    desbloquear() {
      this.iniciar();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (this.musica && this.musica.paused && AJ.musica && !document.hidden) this.musica.play().catch(() => {});
    },
    buffer(ruta) {
      if (!this.ctx) return Promise.resolve(null);
      if (!this.buffers[ruta]) {
        this.buffers[ruta] = fetch(D + ruta).then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((b) => b && new Promise((ok, mal) => this.ctx.decodeAudioData(b, ok, mal))).catch(() => null);
      }
      return this.buffers[ruta];
    },
    async tocar(ruta, vol) {
      if (!this.ctx) return;
      const b = await this.buffer(ruta);
      if (!b || !this.ctx) return;
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      const g = this.ctx.createGain();
      g.gain.value = vol == null ? 1 : vol;
      s.connect(g); g.connect(this.salida);
      s.start();
      App.test.ultimoSonido = ruta;
      return new Promise((r) => { s.onended = r; setTimeout(r, b.duration * 1000 + 200); });
    },
    efecto(n, vol) { if (AJ.efectos) return this.tocar(`sonidos/${n}.mp3`, vol); },
    voz(carpeta, canto) {
      if (!AJ.voces || !IND) return;
      const n = IND.voces[carpeta] && IND.voces[carpeta][canto];
      if (!n) return;
      return this.tocar(`voces/${carpeta}/${canto}-${1 + Math.floor(azar() * n)}.mp3`);
    },
    precargarVoz(carpeta) {
      if (!IND || !IND.voces[carpeta]) return;
      for (const [canto, n] of Object.entries(IND.voces[carpeta])) for (let i = 1; i <= Math.min(n, 2); i++) this.buffer(`voces/${carpeta}/${canto}-${i}.mp3`);
    },
    tema(pista) {
      this.quiere = pista;
      if (!AJ.musica) { if (this.musica) this.musica.pause(); return; }
      if (this.pista === pista && this.musica) { if (this.musica.paused && !document.hidden) this.musica.play().catch(() => {}); return; }
      if (this.musica) this.musica.pause();
      const a = this.musica = new Audio();
      a.loop = true; a.volume = 0.4; a.preload = 'auto';
      this.pista = pista;
      blobUrl(`musica/${pista}.mp3`).then((u) => {
        if (this.musica !== a) return;
        a.src = u;
        if (!document.hidden && AJ.musica) a.play().catch(() => {});
      }).catch(() => {});
    },
    actualizarMusica() {
      if (!AJ.musica) { if (this.musica) this.musica.pause(); } else if (this.quiere) { this.pista = null; this.tema(this.quiere); }
    },
  };
  App.Sonido = Sonido;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (Sonido.musica) Sonido.musica.pause(); if (Sonido.ctx) Sonido.ctx.suspend().catch(() => {}); }
    else { if (Sonido.ctx) Sonido.ctx.resume().catch(() => {}); if (Sonido.musica && AJ.musica) Sonido.musica.play().catch(() => {}); }
  });
  ['pointerdown', 'touchend', 'keydown'].forEach((t) => addEventListener(t, () => Sonido.desbloquear(), { capture: true, passive: true }));

  // ── pantallas y ventanas ─────────────────────────────────────────────────────────────────
  let actual = null;
  function mostrar(p, nombre) {
    if (actual && actual.salir) actual.salir();
    if (actual) actual.el.remove();
    actual = { el: p, nombre };
    ESC.insertBefore(p, ESC.firstChild);
    App.test.pantalla = nombre;
    return actual;
  }
  const ventanas = [];
  function ventana(o) {
    const velo = el('div', 'velo', ESC);
    const v = el('div', 'ventana ' + (o.caja === 'modal' ? 'modal9' : 'caja'), velo);
    if (o.ancho) v.style.width = o.ancho + 'px';
    v.style.padding = o.relleno || '20px 40px 60px';
    if (o.firu !== false) el('div', 'firu' + (o.flor ? ' flor' : ''), v);
    if (o.titulo) el('h2', 'texto-contorno', v, o.titulo);
    if (o.sub) el('div', 'sub', v, o.sub);
    if (o.msg) el('div', 'msg', v, o.msg);
    if (o.cuerpo) v.appendChild(o.cuerpo);
    let resolver;
    const promesa = new Promise((r) => { resolver = r; });
    const reg = { velo, v, promesa, cerrar: null, atras: o.atras };
    function cerrar(valor) {
      if (reg.cerrado) return;
      reg.cerrado = true;
      velo.classList.remove('ver');
      const i = ventanas.indexOf(reg);
      if (i >= 0) ventanas.splice(i, 1);
      setTimeout(() => velo.remove(), 220);
      resolver(valor);
    }
    reg.cerrar = cerrar;
    if (o.botones && o.botones.length) {
      const bs = el('div', 'botones', v);
      for (const b of o.botones) {
        const x = el('div', 'boton caja', bs, b.texto);
        if (b.ancho) x.style.width = b.ancho + 'px';
        tocar(x, () => cerrar(b.valor));
      }
    }
    if (o.x) tocar(el('div', 'cerrar-x', v), () => cerrar(null));
    if (o.afuera !== false) velo.addEventListener('click', (ev) => { if (ev.target === velo) cerrar(null); });
    ventanas.push(reg);
    requestAnimationFrame(() => velo.classList.add('ver'));
    if (o.dura) setTimeout(() => cerrar(null), o.dura);
    App.test.ventana = o.titulo || o.sub || o.msg || '';
    return reg;
  }
  App.ventana = ventana;
  App.mostrar = mostrar;
  let avisoT = null;
  function aviso(txt, ms) {
    let a = ESC.querySelector('.aviso');
    if (!a) a = el('div', 'aviso', ESC);
    a.textContent = txt;
    a.style.opacity = 1;
    clearTimeout(avisoT);
    avisoT = setTimeout(() => { a.style.opacity = 0; }, ms || 2000);
    App.test.aviso = txt;
  }
  App.aviso = aviso;

  // el botón atrás (el de Android o Escape): cierra la ventana de arriba o vuelve una pantalla
  App.atras = function () {
    if (costadoAbierto) { cerrarCostado(); return true; }
    const v = ventanas[ventanas.length - 1];
    if (v) { if (v.atras !== false) v.cerrar(null); return true; }
    if (actual && actual.atras) { actual.atras(); return true; }
    return false;
  };

  function panelArriba(p, titulo, atras) {
    const c = el('div', 'panel-arriba', p);
    el('div', 'titulo', c, titulo);
    if (atras) tocar(el('div', 'boton-atras', c), () => { Sonido.efecto('back', 0.6); atras(); });
    tocar(el('div', 'boton-menu', c), () => abrirCostado());
    return c;
  }

  // ── el menú: Inicio, Jugar y Extras, con las cápsulas del original ───────────────────────────
  function menu(seccion) {
    seccion = seccion || 'inicio';
    const p = el('div', 'pantalla menu');
    el('div', 'fondo-menu', p);
    const cab = el('div', 'cab', p);
    const sonido = tocar(pos(el('div', 'boton-icono s', cab), 1200 - 160 - 120, 25), () => {
      AJ.musica = !AJ.musica; guardarAjustes(); Sonido.actualizarMusica(); pintarSonido();
    });
    const pintarSonido = () => { sonido.style.backgroundImage = `var(--u-${AJ.musica ? 'icon_sound_on' : 'icon_sound_off'})`; };
    pintarSonido();
    tocar(pos(el('div', 'boton-icono s', cab), 1200 - 50 - 100, 25), () => abrirCostado()).style.backgroundImage = 'var(--u-icon_hambuerger)';
    el('div', 'logo', p);
    const caps = el('div', 'capsulas', p);
    caps.style.top = `calc(var(--sa-arriba) + 470px)`;
    caps.style.bottom = `calc(var(--sa-abajo) + 300px)`;
    const items = {
      inicio: [
        ['icon_play', 'Jugar', 'Partida rápida y Gira Nacional', () => menu('jugar')],
        ['icon_signs', 'Perfil', 'Editá tu perfil.', () => ventanaPerfil()],
        ['icon_academy', 'Academia', T('help_desc'), () => ayuda('reglas')],
        ['icon_couple', T('counter'), 'Contabilizá los puntos de partidas reales.', () => anotador()],
      ],
      jugar: [
        ['icon_solo', T('fast_match'), T('fast_match_desc'), () => elegirPartida()],
        ['icon_tour', T('national_tour'), 'Competí a lo largo de Argentina.', () => mapa()],
      ],
      extras: [
        ['icon_help', 'Ayuda', T('help_desc'), () => ayuda('reglas')],
        ['icon_points', T('points_title'), T('points_desc'), () => ayuda('puntos')],
        ['icon_decks', T('deck_title'), 'Elegí el mazo con el que jugás.', () => ventanaMazos()],
        ['icon_trivia', T('modal_copyright_title'), 'Blyts, la música y los que hicieron el juego.', () => creditos()],
      ],
    }[seccion];
    el('div', 'firulete', caps);
    items.forEach(([icono, titulo, desc, fn], i) => {
      const c = el('div', 'capsula ' + (items.length === 1 ? 'sola' : i === 0 ? 'arriba' : i === items.length - 1 ? 'abajo' : 'medio'), caps);
      c.dataset.prueba = titulo;
      el('div', 'icono', c).style.backgroundImage = `var(--u-${icono})`;
      const ct = el('div', 'contenido', c);
      el('div', 'titulo', ct, titulo);
      el('div', 'desc', ct, desc);
      tocar(c, fn);
    });
    el('div', 'firulete al-reves', caps);
    const pie = el('div', 'pie', p);
    for (const [s, sprite, txt] of [['inicio', 'btn_home', 'Inicio'], ['jugar', 'btn_offline', 'Jugar'], ['extras', 'btn_tools', 'Extras']]) {
      const t = el('div', 'tab' + (s === seccion ? ' sel' : ''), pie);
      t.style.backgroundImage = `var(--u-${sprite}${s === seccion ? '_sel' : ''})`;
      t.dataset.prueba = txt;
      el('span', null, t, txt);
      tocar(t, () => { if (s !== seccion) menu(s); });
    }
    const a = mostrar(p, 'menu-' + seccion);
    a.atras = seccion === 'inicio' ? null : () => menu('inicio');
    Sonido.tema('mainmenu');
  }
  App.menu = menu;

  // ── el panel del costado: los ajustes ─────────────────────────────────────────────────────
  let costado = null, costadoAbierto = false;
  function cerrarCostado() { if (costado) { costado.classList.remove('abierto'); costadoAbierto = false; } }
  function abrirCostado() {
    if (!costado) {
      costado = el('div', 'costado', ESC);
      costado.addEventListener('click', (e) => e.stopPropagation());
      ESC.addEventListener('pointerdown', (e) => { if (costadoAbierto && !costado.contains(e.target)) { e.stopPropagation(); cerrarCostado(); } }, true);
    }
    costado.textContent = '';
    const sep = (t) => el('div', 'sep', costado, t);
    const interruptor = (titulo, op, valor, cambiar, ayudaK) => {
      const it = el('div', 'item', costado);
      el('span', null, it, titulo);
      const s = el('div', 'interruptor', it);
      op.forEach(([v, txt]) => {
        const b = el('i', v === valor() ? 'si' : '', s, txt);
        tocar(b, () => { cambiar(v); guardarAjustes(); abrirCostado(); });
      });
      if (ayudaK) tocar(el('div', 'ayuda', it, '?'), () => ventana({ msg: T(ayudaK), x: true, ancho: 900, botones: [{ texto: T('ok'), valor: 1 }] }));
      return it;
    };
    const desplegable = (titulo, txt, fn) => {
      const it = el('div', 'item', costado);
      el('span', null, it, titulo);
      tocar(el('div', 'desplegable entrada', it, txt), fn);
    };
    sep('Ajustes partido');
    interruptor('Flor', [[true, T('yes')], [false, T('no')]], () => AJ.flor, (v) => { AJ.flor = v; }, 'help_body_flor');
    interruptor('Puntos', [[15, 'a 15'], [30, 'a 30']], () => AJ.puntos, (v) => { AJ.puntos = v; }, 'help_body_points');
    interruptor(T('mode'), [[true, T('fast')], [false, T('slow')]], () => AJ.rapido, (v) => { AJ.rapido = v; }, 'help_body_mode');
    interruptor('Mostrar cartas', [[true, T('yes')], [false, T('no')]], () => AJ.mostrar, (v) => { AJ.mostrar = v; });
    sep('Ajustes perfil');
    interruptor(T('sex'), [['hombre', 'Hombre'], ['mujer', 'Mujer']], () => AJ.sexo, (v) => {
      AJ.sexo = v;
      if (!VOCES[v][AJ.voz]) AJ.voz = 'porteno';
    });
    desplegable(T('deck'), T('deck_' + AJ.mazo), () => { cerrarCostado(); ventanaMazos(); });
    interruptor(T('voices'), [[true, T('yes')], [false, T('no')]], () => AJ.voces, (v) => { AJ.voces = v; }, 'help_body_voices');
    desplegable('Voz', T('voice_' + AJ.voz), () => { cerrarCostado(); ventanaVoz(); });
    interruptor('Música', [[true, T('yes')], [false, T('no')]], () => AJ.musica, (v) => { AJ.musica = v; Sonido.actualizarMusica(); });
    interruptor('Efectos', [[true, T('yes')], [false, T('no')]], () => AJ.efectos, (v) => { AJ.efectos = v; });
    requestAnimationFrame(() => { costado.classList.add('abierto'); costadoAbierto = true; });
  }
  App.abrirCostado = abrirCostado;

  function ventanaVoz() {
    const cuerpo = el('div', 'opciones-lista');
    const r = ventana({ titulo: 'Voz', cuerpo, x: true, ancho: 900 });
    for (const v of Object.keys(VOCES[AJ.sexo])) {
      const o = el('div', 'op caja' + (v === AJ.voz ? ' sel' : ''), cuerpo, T('voice_' + v));
      tocar(o, () => {
        AJ.voz = v; guardarAjustes();
        cuerpo.querySelectorAll('.op').forEach((x) => x.classList.toggle('sel', x === o));
        Sonido.voz(miVoz(), elegir(['truco', 'envido', 'quiero']));
      });
    }
    return r;
  }
  function ventanaMazos() {
    const cuerpo = el('div', 'mazos');
    const r = ventana({ titulo: T('deck_title'), cuerpo, x: true, ancho: 1100 });
    for (const m of MAZOS) {
      const d = el('div', 'mz' + (m === AJ.mazo ? ' sel' : ''), cuerpo);
      fondo(el('i', null, d), `mazos/${m}.webp`);
      el('span', null, d, T('deck_' + m));
      d.dataset.prueba = m;
      tocar(d, () => {
        AJ.mazo = m; guardarAjustes();
        cuerpo.querySelectorAll('.mz').forEach((x) => x.classList.toggle('sel', x === d));
      });
    }
    return r;
  }
  function ventanaPerfil() {
    const cuerpo = el('div', 'perfil');
    cuerpo.style.padding = '10px 20px 0';
    const arriba = el('div', 'arriba', cuerpo);
    const cara = el('div', 'cara', arriba);
    img(avatarUrl(miAvatar()), null, cara);
    const der = el('div', null, arriba);
    el('div', 'dato', der, 'Nombre');
    const entrada = el('input', 'entrada', der);
    entrada.value = AJ.nombre; entrada.maxLength = 14; entrada.placeholder = 'Vos';
    entrada.style.cssText = 'width:520px;height:100px;font:56px Tit3,sans-serif;color:#fff;padding:0 24px;outline:none;margin-top:10px';
    entrada.addEventListener('input', () => { AJ.nombre = entrada.value.trim(); guardarAjustes(); });
    entrada.addEventListener('pointerdown', (e) => e.stopPropagation());
    const g = el('div', 'barras-p', cuerpo);
    const fila = (t, txt, fn) => { el('span', null, g, t); tocar(el('div', 'desplegable entrada', g, txt), fn).style.position = 'relative'; };
    fila(T('sex'), AJ.sexo === 'mujer' ? 'Mujer' : 'Hombre', () => {
      AJ.sexo = AJ.sexo === 'mujer' ? 'hombre' : 'mujer';
      if (!VOCES[AJ.sexo][AJ.voz]) AJ.voz = 'porteno';
      guardarAjustes(); r.cerrar(); ventanaPerfil();
    });
    fila('Voz', T('voice_' + AJ.voz), () => { r.cerrar(); ventanaVoz(); });
    fila(T('deck'), T('deck_' + AJ.mazo), () => { r.cerrar(); ventanaMazos(); });
    g.querySelectorAll('.desplegable').forEach((d) => { d.style.left = '0'; d.style.top = '0'; });
    const r = ventana({ titulo: 'Perfil', cuerpo, x: true, ancho: 1000 });
    return r;
  }
  function creditos() {
    ventana({ titulo: T('modal_copyright_title'), msg: T('modal_copyright_body') + '\n\nPort no oficial para la web: JXStudios.', x: true, ancho: 1050,
      botones: [{ texto: T('ok'), valor: 1 }] }).v.querySelector('.msg').style.fontSize = '48px';
  }

  // ── la ayuda (reglas, puntos, regiones) con los textos del original ───────────────────────────
  function ayuda(tema) {
    const p = el('div', 'pantalla ayuda');
    el('div', 'fondo-menu', p);
    const titulo = { reglas: T('rules_help_title_1') === 'Lo básico' ? 'Reglas' : 'Reglas', puntos: T('points_title'), regiones: T('regions_title') }[tema];
    panelArriba(p, titulo, () => menu('inicio'));
    const l = el('div', 'lista', p);
    l.style.bottom = 'var(--sa-abajo)';
    const t = el('div', 'texto-largo', l);
    const seccion = (h, txt) => { if (h) el('h3', null, t, h); if (txt) el('div', null, t, txt); };
    if (tema === 'reglas') {
      for (let i = 1; i <= 6; i++) seccion(T('rules_help_title_' + i), T('rules_help_' + i));
      seccion(T('rules_help_title_7'));
      const cv = el('div', 'cartas-valor', l);
      const orden = [['espada', 1], ['basto', 1], ['espada', 7], ['oro', 7], [null, 3], [null, 2], ['oro', 1], ['copa', 1], [null, 12], [null, 11], [null, 10], ['basto', 7], ['copa', 7], [null, 6], [null, 5], [null, 4]];
      orden.forEach(([palo, num], i) => {
        const f = el('figure', null, cv);
        img(cartaUrl({ palo: palo || 'espada', num }), null, f);
        el('figcaption', null, f, `${i + 1}º ${palo ? '' : '(todos)'}`.trim());
      });
      const otras = el('div', 'texto-largo', l);
      el('h3', null, otras, T('points_help_title_1'));
      el('div', null, otras, T('points_help_1'));
    } else if (tema === 'puntos') {
      seccion(T('points_help_title_1'), T('points_help_1'));
      seccion(T('regions_help_title_1'), T('regions_help_1'));
    }
    mostrar(p, 'ayuda-' + tema).atras = () => menu('inicio');
  }

  // ── el anotador (Counter): palitos de a cinco, nosotros y ellos ─────────────────────────────
  function anotador() {
    const A = leer('truco.anotador', { nos: 0, ellos: 0, a: 30 });
    const p = el('div', 'pantalla anotador');
    el('div', 'fondo-menu', p);
    panelArriba(p, 'Contador', () => menu('inicio'));
    el('div', 'linea-v', p);
    const cols = {};
    for (const lado of ['nos', 'ellos']) {
      const c = el('div', 'col ' + lado, p);
      el('h3', null, c, lado === 'nos' ? 'Nos' : 'Ellos');
      cols[lado] = { palos: el('div', 'palos', c), total: el('div', 'total', c) };
      const zona = el('div', 'abs', c);
      zona.style.cssText = 'left:0;right:0;top:120px;bottom:0';
      tocar(zona, () => sumar(lado, 1));
    }
    const pintar = () => {
      for (const lado of ['nos', 'ellos']) {
        const c = cols[lado];
        c.palos.textContent = '';
        const cajas = A.a / 5;
        for (let i = 0; i < cajas; i++) {
          const n = Math.max(0, Math.min(5, A[lado] - i * 5));
          const x = el('i', null, c.palos);
          x.style.backgroundImage = n ? `var(--u-sticks-${n})` : 'none';
          x.style.opacity = n ? 1 : 0.15;
          if (!n) x.style.backgroundImage = 'var(--u-sticks-5)';
          if (A.a === 30 && i === 2) { const s = el('i', null, c.palos); s.style.cssText = 'height:5px;width:300px;background:#7d5d31'; }
        }
        c.total.textContent = A[lado] + (A.a === 30 ? (A[lado] > 15 ? ' (buenas)' : ' (malas)') : '');
      }
      guardar('truco.anotador', A);
      App.test.anotador = Object.assign({}, A);
    };
    const sumar = (lado, d) => {
      const antes = A[lado];
      A[lado] = Math.max(0, Math.min(A.a, A[lado] + d));
      if (A[lado] !== antes) Sonido.efecto(d > 0 ? 'tap' : 'back', 0.7);
      pintar();
      if (A[lado] === A.a && antes < A.a) { Sonido.efecto('matchwin'); aviso(`¡Ganaron ${lado === 'nos' ? 'nosotros' : 'ellos'}!`); }
    };
    for (const [lado, x] of [['nos', 30], ['ellos', 1200 - 30 - 126]]) {
      const mas = tocar(el('div', 'mas', p), () => sumar(lado, 1));
      mas.style.cssText += `;left:${x}px;bottom:calc(var(--sa-abajo) + 600px);background-image:var(--u-btn_add)`;
      const menos = tocar(el('div', 'menos', p), () => sumar(lado, -1));
      menos.style.cssText += `;left:${x}px;bottom:calc(var(--sa-abajo) + 450px);background-image:var(--u-btn_minus)`;
      mas.dataset.prueba = 'mas-' + lado; menos.dataset.prueba = 'menos-' + lado;
    }
    const nuevo = tocar(el('div', 'boton caja abs', p, 'Nuevo Partido'), async () => {
      const r = await ventana({ titulo: 'Nuevo Partido', botones: [{ texto: 'a 15', valor: 15 }, { texto: 'a 30', valor: 30 }], x: true }).promesa;
      if (r) { A.nos = 0; A.ellos = 0; A.a = r; pintar(); }
    });
    nuevo.style.cssText += ';left:350px;width:500px;height:130px;bottom:calc(var(--sa-abajo) + 235px);font:60px/1 Tit4,sans-serif';
    pintar();
    mostrar(p, 'anotador').atras = () => menu('inicio');
  }

  // ── la Gira Nacional: el mapa, cada región y sus personajes ─────────────────────────────────
  const REGIONES = [
    // id, nombre en jugadores.json, sprite del mapa, centro (en el mapa de 1280×2982), escala, puntos para destrabarla
    { id: 'buenos-aires', mapa: 'buenos-aires', x: 682, y: 1414, esc: 1.7, w: 238, h: 256, pts: 0 },
    { id: 'cuyo', mapa: 'cuyo', x: 345, y: 1279, esc: 1.7, w: 208, h: 370, pts: 150 },
    { id: 'patagonia', mapa: 'patagonia', x: 397, y: 1898, esc: 1.7, w: 257, h: 490, pts: 350 },
    { id: 'mesopotamia', mapa: 'mesopotamia', x: 775, y: 988, esc: 1.7, w: 348, h: 319, pts: 600 },
    { id: 'norte', mapa: 'norte', x: 497, y: 919, esc: 1.7, w: 340, h: 315, pts: 900 },
    { id: 'malvinas', mapa: 'malvinas', x: 887, y: 2102, esc: 1.7, w: 134, h: 97, pts: 1300 },
  ];
  const DECORADO = [{ mapa: 'cataratas', x: 940, y: 814, esc: 1.12, w: 181, h: 147 }, { mapa: 'fragata', x: 1046, y: 1680, esc: 1.7, w: 146, h: 98 }];
  const GIRA = leer('truco.gira', { total: 0, region: {}, ganados: {}, jugados: 0, victorias: 0 });
  const guardarGira = () => guardar('truco.gira', GIRA);
  const regionDe = (id) => JUG.regions.find((r) => r.id === id);
  const destrabada = (R) => GIRA.total >= R.pts;
  App.test.gira = () => JSON.parse(JSON.stringify(GIRA));
  function rankingDe(id) {
    const reg = regionDe(id);
    const filas = reg.players.map((pj) => ({ pj, pts: pj.points }));
    filas.push({ yo: true, pts: GIRA.region[id] || 0 });
    filas.sort((a, b) => b.pts - a.pts || (a.yo ? 1 : -1));
    const yoEn = filas.findIndex((f) => f.yo);
    // se puede desafiar a todos los de abajo y a los tres que están justo arriba
    filas.forEach((f, i) => { f.pos = i + 1; f.trabado = !f.yo && i < yoEn - 3; });
    return { filas, yoEn };
  }
  function mapa() {
    const p = el('div', 'pantalla gira');
    p.style.background = '#c9b48e';
    const m = el('div', 'mapa', p);
    // el mapa (1280×2982) es más alto que la pantalla: se acomoda para que se vea de Norte (y≈650) a
    // Malvinas (y≈2350), centrado en lo que queda debajo de la cabecera; si no entra, se achica
    const libre = altoEsc - sa.arriba - sa.abajo - 150;
    const k = Math.min(1, libre / 1700);
    m.style.transformOrigin = '50% 0';
    m.style.transform = `scale(${k.toFixed(3)})`;
    m.style.top = `calc(var(--sa-arriba) + ${Math.round(150 + Math.max(0, (libre - 1700) / 2) - 650 * k)}px)`;
    blobUrl('mapa/mapa.webp').then((u) => m.style.setProperty('--mapa', `url("${u}")`));
    for (const d of DECORADO) {
      const r = el('div', 'region', m);
      pos(r, d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
      r.style.transform = `scale(${d.esc})`;
      fondo(r, `mapa/${d.mapa}.webp`);
      r.style.opacity = 0.9;
    }
    for (const R of REGIONES) {
      const reg = regionDe(R.id);
      const r = el('div', 'region' + (destrabada(R) ? '' : ' trabada'), m);
      pos(r, R.x - R.w / 2, R.y - R.h / 2, R.w, R.h);
      r.style.transform = `scale(${R.esc})`;
      fondo(r, `mapa/${R.mapa}.webp`);
      r.dataset.prueba = R.id;
      const rot = el('div', 'rotulo', m);
      pos(rot, R.x, R.y + (R.id === 'malvinas' ? -70 : 0));
      if (destrabada(R)) {
        rot.textContent = reg.name.toUpperCase();
        const { yoEn } = rankingDe(R.id);
        el('small', null, rot, `#${yoEn + 1} · ${GIRA.region[R.id] || 0} pts`);
      } else {
        el('i', 'candado', rot);
        rot.appendChild(document.createTextNode(reg.name.toUpperCase()));
        el('small', null, rot, `En ${R.pts - GIRA.total} pts`);
      }
      tocar(r, () => {
        if (destrabada(R)) region(R.id);
        else aviso(`Te faltan ${R.pts - GIRA.total} puntos para destrabar ${reg.name}.`);
      });
    }
    panelArriba(p, T('national_tour'), () => menu('jugar'));
    const tot = el('div', 'abs', p, `${T('points_dot')} ${GIRA.total}`);
    tot.style.cssText = 'left:0;right:0;bottom:calc(var(--sa-abajo) + 40px);text-align:center;font:60px/1 Yanone,sans-serif;text-shadow:0 0 8px #000,0 0 4px #000';
    mostrar(p, 'mapa').atras = () => menu('jugar');
    Sonido.tema('mainmenu');
  }
  App.mapa = mapa;

  function region(id) {
    const reg = regionDe(id);
    const p = el('div', 'pantalla region');
    el('div', 'fondo-menu', p);
    panelArriba(p, reg.name, () => mapa());
    const l = el('div', 'lista', p);
    l.style.bottom = 'var(--sa-abajo)';
    const { filas, yoEn } = rankingDe(id);
    for (const f of filas) {
      const fila = el('div', 'fila' + (f.yo ? ' yo' : '') + (f.trabado ? ' trabada' : ''), l);
      el('div', 'renglon', fila);
      el('div', 'pos', fila, f.pos);
      const cara = el('div', 'cara', fila);
      img(avatarUrl(f.yo ? miAvatar() : f.pj.avatar), null, cara).loading = 'lazy';
      el('div', 'aro', fila);
      el('div', 'nombre', fila, f.yo ? miNombre() : f.pj.name);
      el('div', 'pts', fila, f.pts);
      if (f.trabado) el('div', 'candado', fila);
      if (!f.yo) {
        fila.dataset.prueba = f.pj.avatar;
        tocar(fila, () => perfilPersonaje(f.pj, id, f));
      }
    }
    mostrar(p, 'region-' + id).atras = () => mapa();
    requestAnimationFrame(() => { const y = l.children[yoEn]; if (y) l.scrollTop = Math.max(0, y.offsetTop - 600); });
  }
  App.region = region;

  function perfilPersonaje(pj, regionId, fila) {
    const c = el('div', 'perfil');
    c.style.padding = '0 10px';
    const ar = el('div', 'arriba', c);
    img(avatarUrl(pj.avatar), null, el('div', 'cara', ar));
    const d = el('div', null, ar);
    el('h3', null, d, pj.name);
    const dato = (t, v) => { const x = el('div', 'dato', d, t + ' '); el('b', null, x, v); };
    dato(T('points_dot'), pj.points);
    dato('Edad:', pj.age);
    dato(T('won_dot'), `${pj.wins} · Perdidos: ${pj.loses}`);
    const b = el('div', 'barras-p', c);
    const barra = (t, v) => { el('span', null, b, t); const pr = el('div', 'prog', b); el('i', null, pr).style.width = Math.max(4, Math.min(100, v)) + '%'; };
    const agr = { EXTREMELY_PASIVE: 5, VERY_PASIVE: 18, PASIVE: 34, NEUTRAL: 50, AGGRESSIVE: 66, VERY_AGGRESSIVE: 82, EXTREMELY_AGGRESSIVE: 96 }[pj.style] || 50;
    barra('Mentiroso:', (pj.lier_envido + pj.lier_truco) / 2);
    barra('Pescador:', (pj.fishing_envido + pj.fishing_truco) / 2);
    barra('Agresivo:', agr);
    el('div', 'desc', c, pj.description);
    const botones = fila && fila.trabado ? [] : [{ texto: 'Desafiar', valor: 'jugar', ancho: 420 }];
    const r = ventana({ cuerpo: c, x: true, ancho: 1000, firu: false, caja: 'modal', relleno: '60px 50px 50px', botones });
    if (fila && fila.trabado) el('div', 'msg', r.v, 'Ganale a los de más abajo para poder desafiarlo.').style.fontSize = '50px';
    r.promesa.then((v) => { if (v === 'jugar') jugarGira(pj, regionId, fila); });
  }

  function personajeAlAzar(excluir) {
    const todos = JUG.regions.flatMap((r) => r.players.map((pj) => Object.assign({ region: r.id }, pj)));
    let pj;
    do { pj = elegir(todos); } while (excluir.includes(pj.avatar));
    return pj;
  }
  function elegirPartida() {
    const c = el('div', 'modos');
    const r = ventana({ titulo: T('fast_match'), cuerpo: c, x: true, ancho: 1100 });
    for (const [n, sprite, txt] of [[2, 'single_match', 'Solo'], [4, 'pairs_match', '2 vs 2'], [6, 'triple_match', '3 vs 3']]) {
      const m = el('div', 'modo' + (n === 6 ? ' tres' : ''), c);
      m.style.backgroundImage = `var(--u-${sprite})`;
      m.dataset.prueba = 'modo-' + n;
      el('span', null, m, txt);
      tocar(m, () => r.cerrar(n));
    }
    const aviso2 = el('div', 'msg', r.v, T('fast_match_warn') + (AJ.flor ? '\n' + T('pairs_warning') : ''));
    aviso2.style.cssText += ';font:44px/1.25 TitM,sans-serif;margin-top:110px;color:#ddd';
    r.promesa.then((n) => {
      if (!n) return;
      AJ.modo = n; guardarAjustes();
      const usados = [];
      const asientos = [];
      for (let s = 1; s < n; s++) { const pj = personajeAlAzar(usados); usados.push(pj.avatar); asientos.push(pj); }
      const reg = elegir(REGIONES.filter((R) => destrabada(R)));
      App.Mesa.jugar({ tipo: 'rapida', jugadores: n, puntos: AJ.puntos, flor: n === 2 && AJ.flor, personajes: asientos, region: reg.id })
        .then(() => menu('jugar'));
    });
  }
  App.elegirPartida = elegirPartida;

  async function jugarGira(pj, regionId, fila) {
    await App.Mesa.jugar({ tipo: 'gira', jugadores: 2, puntos: AJ.puntos, flor: AJ.flor, personajes: [Object.assign({ region: regionId }, pj)],
      region: regionId, rankingRival: fila ? fila.pos : null, rankingYo: rankingDe(regionId).yoEn + 1 });
    region(regionId);
  }
  App.jugarGira = jugarGira;
  // los puntos de cada partido de la Gira (también los que se pierden al abandonar)
  App.acreditarGira = function (cfg, res) {
    if (!res || !res.puntosGira) return;
    const antes = GIRA.total, id = cfg.region, pj = cfg.personajes[0];
    GIRA.total = Math.max(0, GIRA.total + res.puntosGira);
    GIRA.region[id] = Math.max(0, (GIRA.region[id] || 0) + res.puntosGira);
    GIRA.jugados++;
    if (res.gane) { GIRA.victorias++; GIRA.ganados[pj.avatar] = (GIRA.ganados[pj.avatar] || 0) + 1; }
    guardarGira();
    const nueva = REGIONES.find((R) => R.pts > antes && R.pts <= GIRA.total);
    if (nueva) { Sonido.efecto('achievementcompleted'); setTimeout(() => aviso(`¡Destrabaste ${regionDe(nueva.id).name}!`, 3500), 400); }
  };

  // ── arrancar ───────────────────────────────────────────────────────────────────────────
  App.datos = () => ({ IND, TXT, JUG, AJ });
  App.util = { fondo, el, pos, T, frases, elegir, espera, entre, img, tocar, vibrar, cartaUrl, avatarUrl, blobUrl, guardar, leer, ui, miVoz, miNombre, miAvatar, aviso };
  App.AJ = AJ;
  App.REGIONES = REGIONES;
  App.regionDe = (id) => regionDe(id);

  async function arrancar() {
    encajar();
    addEventListener('resize', encajar);
    if (window.Porteo && Porteo.web) Porteo.web({ orientacion: 'portrait', atras: () => App.atras(), despierto: true });
    // en una compu, Escape hace lo mismo que el atrás del teléfono
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && App.listo) { e.preventDefault(); App.atras(); } });
    const carga = el('div', '', ESC);
    carga.id = 'carga';
    const barra = el('div', 'barra', carga);
    const relleno = el('i', null, barra);
    const msg = el('p', null, carga, 'Cargando…');
    let intro = Promise.resolve();
    if (window.Porteo && Porteo.intro && !sessionStorage.getItem('truco-sin-intro')) {
      intro = Porteo.intro({ aviso: { es: 'Port no oficial de «Truco» de Blyts, para jugar sin internet.', en: 'Unofficial port of Blyts\' «Truco».', pt: 'Port não oficial de «Truco», da Blyts.' } });
    }
    try {
      if (window.Porteo && Porteo.actualizar) {
        const recargar = await Porteo.actualizar({ alAvanzar: (h, t) => { msg.textContent = 'Actualizando…'; relleno.style.width = (100 * h / t) + '%'; } });
        if (recargar) { location.reload(); return; }
      }
      await cargarDatos((h, t) => { relleno.style.width = (100 * h / t) + '%'; });
    } catch (e) {
      msg.textContent = 'No se pudieron cargar los datos del juego: ' + e.message;
      throw e;
    }
    await intro;
    try { sessionStorage.setItem('truco-sin-intro', '1'); } catch (_) {}
    carga.style.opacity = 0;
    carga.style.pointerEvents = 'none';     // mientras se desvanece, los toques ya van al menú
    setTimeout(() => carga.remove(), 450);
    App.listo = true;
    const pend = App.Mesa && App.Mesa.pendiente && App.Mesa.pendiente();
    menu('inicio');
    if (pend) App.Mesa.ofrecerReanudar(pend);
  }
  App.arrancar = arrancar;      // lo llama index.html, después de mesa.js
})();
