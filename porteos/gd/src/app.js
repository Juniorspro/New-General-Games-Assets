'use strict';
// La aplicación: carga lo justo para mostrar el menú, cambia de pantalla (menú, selector,
// partida), corre el bucle de dibujo, reparte la entrada (toques, mouse y teclado) y guarda en el
// navegador los récords, las monedas y los ajustes.

GD.SONIDOS = ['explode_11', 'playSound_01', 'quitSound_01', 'endStart_02', 'highscoreGet02', 'gold02', 'reward01'];
GD.TECLAS_SALTO = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter', 'NumpadEnter']);
GD.TECLAS_ATRAS = new Set(['Escape', 'KeyP', 'Backspace']);

// Lo guardado: si el navegador no deja (modo privado, almacenamiento bloqueado) se juega igual,
// sin guardar.
GD.Guardado = class {
  constructor(datos, clave = 'gd-jxstudios-1') {
    this.datos = datos;
    this.clave = clave;
    this.d = { niveles: {}, pagina: 0, musica: true, efectos: true };
    try {
      const t = localStorage.getItem(clave);
      if (t) Object.assign(this.d, JSON.parse(t));
    } catch (_) { /* sin almacenamiento */ }
  }

  escribir() { try { localStorage.setItem(this.clave, JSON.stringify(this.d)); } catch (_) { /* sin almacenamiento */ } }

  nivel(id) {
    let n = this.d.niveles[id];
    if (!n) n = this.d.niveles[id] = { normal: 0, practica: 0, intentos: 0, completo: false, monedas: [false, false, false] };
    return n;
  }

  intento(id) { this.nivel(id).intentos++; this.escribir(); }

  // Récord del modo normal: true si es nuevo (para el cartel de "New Best!").
  normal(id, pct) {
    const n = this.nivel(id);
    if (pct <= n.normal) return false;
    n.normal = pct;
    this.escribir();
    return true;
  }

  practica(id, pct) {
    const n = this.nivel(id);
    if (pct > n.practica) { n.practica = pct; this.escribir(); }
  }

  // Nivel completo en modo normal: las monedas agarradas quedan, y las estrellas se dan una vez.
  completar(id, monedas, estrellas) {
    const n = this.nivel(id), primera = !n.completo;
    n.completo = true;
    n.normal = 100;
    monedas.forEach((m, i) => { if (m) n.monedas[i] = true; });
    this.escribir();
    return primera ? estrellas : 0;
  }

  estrellas() {
    return this.datos.niveles.reduce((a, n) => a + (this.d.niveles[n.id] && this.d.niveles[n.id].completo ? n.estrellas : 0), 0);
  }
};

GD.App = class {
  // traer(ruta) → Promise<Response>: fetch, o lo que lo reemplace (el .html único lo parcha).
  constructor(canvas, datos, hojas) {
    this.canvas = canvas;
    this.datos = datos;
    this.render = new GD.Render(canvas, datos, hojas);
    this.audio = new GD.Audio();
    this.guardado = new GD.Guardado(datos);
    this.audio.musicaSi = this.guardado.d.musica !== false;
    this.audio.efectosSi = this.guardado.d.efectos !== false;
    this.imagenes = new Map();
    this.teclas = new Set();
    this.cargandoNivel = null;
    this.precargada = null;
    this.menu = new GD.Menu(this);
    this.selector = new GD.Selector(this);
    this.partida = null;
    this.pantalla = this.menu;
  }

  get teclaSalto() { return this.teclas.size > 0; }

  // ── carga ────────────────────────────────────────────────────────────────
  traer(ruta) {
    return fetch(ruta).then((r) => { if (!r.ok) throw new Error(`No se pudo leer ${ruta} (${r.status})`); return r; });
  }

  // Decodificada fuera del hilo principal y ya premultiplicada (createImageBitmap); con <img>
  // si el navegador no lo tiene.
  imagen(ruta) {
    if (!this.imagenes.has(ruta)) {
      this.imagenes.set(ruta, window.createImageBitmap
        ? this.traer(ruta).then((r) => r.blob()).then((b) => createImageBitmap(b, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'none' }))
        : new Promise((ok, mal) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.onerror = () => mal(new Error(`No se pudo leer ${ruta}`));
          i.src = ruta;
        }));
    }
    return this.imagenes.get(ruta);
  }

  musica(nombre) {
    return this.audio.cargar(nombre, () => this.traer(`datos/musica/${nombre}.ogg`).then((r) => r.arrayBuffer()));
  }

  // Lo que hace falta para mostrar el menú. La música y los sonidos siguen cargando de fondo.
  async preparar() {
    const [f, p] = await Promise.all([this.imagen('datos/fondos/fondo_1.webp'), this.imagen('datos/fondos/piso_1.webp')]);
    this.fondoMenu = new GD.FondoMenu(this.render.textura('menuFondo', f), this.render.textura('menuPiso', p));
    for (const s of GD.SONIDOS) this.audio.cargar(s, () => this.traer(`datos/sonidos/${s}.ogg`).then((r) => r.arrayBuffer())).catch(() => {});
    this.musica('menuLoop').then(() => {
      if (this.pantalla === this.menu || this.pantalla === this.selector) this.pantalla.entrar();
    }).catch(() => {});
  }

  // La canción del nivel que se está mirando en el selector, para que al tocarlo arranque ya.
  precargar(info) {
    if (this.precargada === info.cancion) return;
    this.precargada = info.cancion;
    this.audio.olvidar(['menuLoop', ...GD.SONIDOS, info.cancion]);
    this.musica(info.cancion).catch(() => {});
  }

  // ── pantallas ────────────────────────────────────────────────────────────
  irA(nombre) {
    if (this.partida) {
      this.partida.cerrar();
      this.partida = null;
      this.audio.efecto('quitSound_01');
    }
    this.pantalla = nombre === 'menu' ? this.menu : this.selector;
    this.pantalla.entrar();
  }

  async jugar(info) {
    if (this.cargandoNivel) return;
    this.cargandoNivel = info;
    try {
      const [texto] = await Promise.all([
        this.traer(`datos/niveles/${info.id}.txt`).then((r) => r.text()).then(GD.decodificarNivel),
        this.musica(info.cancion).catch(() => null),
      ]);
      const nivel = new GD.Nivel(texto, this.datos.objetos);
      const a = nivel.ajustes;
      const fondo = this.datos.fondos.includes(a.fondo) ? a.fondo : 1;
      const piso = this.datos.pisos.includes(a.piso) ? a.piso : 1;
      const [f, p, p2] = await Promise.all([
        this.imagen(`datos/fondos/fondo_${fondo}.webp`),
        this.imagen(`datos/fondos/piso_${piso}.webp`),
        this.datos.pisos2.includes(piso) ? this.imagen(`datos/fondos/piso_${piso}_2.webp`) : null,
      ]);
      const r = this.render;
      const tex = { fondo: r.textura('fondo', f), piso: r.textura('piso', p), piso2: p2 ? r.textura('piso2', p2) : null };
      this.audio.pararMusica();
      this.audio.efecto('playSound_01');
      this.partida = new GD.Partida(this, info, nivel, tex);
      this.pantalla = this.partida;
      // decodificada, una canción ocupa ~30 MB: sólo quedan la del nivel y la del menú
      this.audio.olvidar(['menuLoop', ...GD.SONIDOS, info.cancion]);
    } catch (e) {
      this.fallo(e);
    } finally {
      this.cargandoNivel = null;
    }
  }

  atras() { if (this.pantalla) this.pantalla.atras(); }

  ponerMusica(si) {
    this.audio.ponerMusica(si);
    this.guardado.d.musica = si;
    this.guardado.escribir();
  }

  ponerEfectos(si) {
    this.audio.efectosSi = si;
    this.guardado.d.efectos = si;
    this.guardado.escribir();
  }

  // ── bucle ────────────────────────────────────────────────────────────────
  arrancar() {
    this.escuchar();
    this.irA('menu');
    let antes = performance.now();
    const cuadro = (ahora) => {
      const dt = Math.min(0.1, Math.max(0, (ahora - antes) / 1000));
      antes = ahora;
      try {
        if (this.pantalla === this.partida) this.partida.actualizar(dt);
        this.pantalla.dibujar(dt);
      } catch (e) {
        this.fallo(e);
        return;
      }
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  }

  fallo(e) {
    console.error(e);
    if (typeof this.alFallar === 'function') this.alFallar(e);
  }

  // ── entrada ──────────────────────────────────────────────────────────────
  escuchar() {
    const c = this.canvas;
    const punto = (e) => {
      const b = c.getBoundingClientRect(), r = this.render;
      return [(e.clientX - b.left) / b.width * r.VW, (1 - (e.clientY - b.top) / b.height) * r.VH];
    };
    // el audio sólo arranca dentro de un gesto: cualquier toque o tecla sirve (también el que
    // saltea la intro)
    addEventListener('pointerdown', () => this.audio.desbloquear(), true);
    addEventListener('keydown', () => this.audio.desbloquear(), true);
    c.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
      const [x, y] = punto(e);
      this.pantalla.abajo(x, y, e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      const [x, y] = punto(e);
      this.pantalla.mover(x, y, e.pointerId);
    });
    c.addEventListener('pointerup', (e) => {
      const [x, y] = punto(e);
      this.pantalla.arriba(x, y, e.pointerId);
    });
    // un toque cancelado (el sistema se lo llevó) suelta, pero no aprieta ningún botón
    c.addEventListener('pointercancel', (e) => this.pantalla.arriba(-1e6, -1e6, e.pointerId));
    addEventListener('keydown', (e) => {
      if (GD.TECLAS_ATRAS.has(e.code)) { e.preventDefault(); if (!e.repeat) this.atras(); return; }
      const salto = GD.TECLAS_SALTO.has(e.code);
      if (salto || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      if (salto) this.teclas.add(e.code);
      this.pantalla.tecla(salto, true, e.code);
    });
    addEventListener('keyup', (e) => {
      const salto = GD.TECLAS_SALTO.has(e.code);
      if (salto) this.teclas.delete(e.code);
      this.pantalla.tecla(salto, false, e.code);
    });
    // al cambiar de app o apagar la pantalla: pausa y silencio
    const irse = () => {
      this.teclas.clear();
      if (this.pantalla === this.partida && this.partida) this.partida.pausar();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { irse(); this.audio.suspender(); } else this.audio.desbloquear();
    });
    addEventListener('blur', irse);
  }
};
