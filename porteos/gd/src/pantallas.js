'use strict';
// El menú principal y el selector de niveles, armados como los del juego (MenuLayer y
// LevelSelectLayer) con sus cuadros: el logo, el botón de jugar, una página por nivel con su
// carita de dificultad, estrellas, monedas y las barras de los modos normal y práctica.

// ── menú ─────────────────────────────────────────────────────────────────────
GD.Menu = class {
  constructor(app) {
    this.app = app;
    this.botones = new GD.Botonera();
    this.t = 0;
  }

  entrar() {
    const a = this.app.audio;
    if (!a.sonando('menuLoop')) a.musica('menuLoop', 0, true);
  }

  dibujar(dt) {
    const r = this.app.render, VW = r.VW, VH = r.VH;
    this.t += dt;
    // el fondo cambia de color despacio, como en el original
    const c = GD.hsv(200 + this.t * 9, 0.78, 1);
    r.empezar(c[0] * 0.5, c[1] * 0.5, c[2] * 0.5);
    this.app.fondoMenu.dibujar(r, dt, c, 120, 70);
    const [lw] = r.tamCuadro('GJ_logo_001.png');
    r.sprite('GJ_logo_001.png', VW / 2, VH - 64, Math.min(0.95, (VW - 40) / lw), 0, [1, 1, 1, 1]);
    const b = this.botones, a = this.app.audio;
    b.poner('jugar', 'GJ_playBtn_001.png', VW / 2, 160, () => this.app.irA('selector'), { escala: 0.95 });
    b.poner('musica', a.musicaSi ? 'GJ_musicOnBtn_001.png' : 'GJ_musicOffBtn_001.png', VW - 70, 28, () => this.app.ponerMusica(!a.musicaSi), { escala: 0.6, minimo: 44 });
    b.poner('efectos', a.efectosSi ? 'GJ_fxOnBtn_001.png' : 'GJ_fxOffBtn_001.png', VW - 28, 28, () => this.app.ponerEfectos(!a.efectosSi), { escala: 0.6, minimo: 44 });
    b.dibujar(r, dt);
    const estrellas = this.app.guardado.estrellas();
    r.sprite('GJ_starsIcon_001.png', 22, 28, 0.6, 0, [1, 1, 1, 1]);
    r.texto('bigFont', String(estrellas), 36, 28, 0.45, [1, 1, 1, 1], 0);
    r.terminar();
  }

  abajo(x, y, p) { this.botones.abajo(this.app.render, x, y, p); }
  mover(x, y, p) { this.botones.mover(this.app.render, x, y, p); }
  arriba(x, y, p) { this.botones.arriba(this.app.render, x, y, p); }
  tecla(salto, abajo, codigo) { if (abajo && (salto || codigo === 'Enter')) this.app.irA('selector'); }
  atras() { /* el segundo "atrás" seguido sale (web.js) */ }
};

// ── selector de niveles ──────────────────────────────────────────────────────
GD.Selector = class {
  constructor(app) {
    this.app = app;
    this.botones = new GD.Botonera();
    this.pagina = GD.limitar(app.guardado.d.pagina || 0, 0, app.datos.niveles.length - 1);
    this.vista = this.pagina;
    this.arrastre = null;
    this.quieto = 0;
  }

  get niveles() { return this.app.datos.niveles; }

  entrar() {
    const a = this.app.audio;
    if (!a.sonando('menuLoop')) a.musica('menuLoop', 0, true);
    this.vista = this.pagina;
  }

  ir(i) {
    this.pagina = GD.limitar(i, 0, this.niveles.length - 1);
    this.app.guardado.d.pagina = this.pagina;
    this.app.guardado.escribir();
    this.quieto = 0;
  }

  colorDe(i) {
    const c = this.niveles[GD.limitar(i, 0, this.niveles.length - 1)].color || [40, 125, 255];
    return [c[0] / 255, c[1] / 255, c[2] / 255];
  }

  caja() {
    const r = this.app.render;
    const w = Math.min(r.VW * 0.66, 380), h = 104;
    return { w, h, y: 196 };
  }

  dibujar(dt) {
    const r = this.app.render, VW = r.VW, VH = r.VH, N = this.niveles.length;
    if (!this.arrastre) this.vista += (this.pagina - this.vista) * Math.min(1, dt * 9);
    // la música del nivel que se está mirando se prepara de antemano (sale al instante al tocar)
    this.quieto += dt;
    if (this.quieto > 0.35 && !this.arrastre) this.app.precargar(this.niveles[this.pagina]);

    const v = GD.limitar(this.vista, 0, N - 1), i0 = Math.floor(v), f = v - i0;
    const c0 = this.colorDe(i0), c1 = this.colorDe(i0 + 1);
    const c = [GD.mezclar(c0[0], c1[0], f), GD.mezclar(c0[1], c1[1], f), GD.mezclar(c0[2], c1[2], f)];
    r.empezar(c[0], c[1], c[2]);
    r.modo(false);
    r.recorte('GJ_gradientBG.png', 0, 0, VW, VH, 1, [c[0], c[1], c[2], 1]);
    this.app.fondoMenu.dibujar(r, 0, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], 0, 46, false);
    r.sprite('GJ_sideArt_001.png', 36, 36, 0.9, 0, [1, 1, 1, 1]);
    r.sprite('GJ_sideArt_001.png', VW - 36, 36, 0.9, 0, [1, 1, 1, 1], -1, 1);

    for (let i = Math.max(0, i0 - 1); i <= Math.min(N - 1, i0 + 2); i++) {
      const x = VW / 2 + (i - this.vista) * VW;
      if (x > -VW / 2 && x < VW * 1.5) this.dibujarPagina(i, x);
    }

    // puntos de página
    const paso = Math.min(12, (VW - 140) / N), x0 = VW / 2 - (N - 1) * paso / 2;
    for (let i = 0; i < N; i++) r.sprite('uiDot_001.png', x0 + i * paso, 14, 0.7, 0, [1, 1, 1, i === this.pagina ? 1 : 0.3]);

    const b = this.botones;
    b.poner('volver', 'GJ_arrow_01_001.png', 26, VH - 26, () => this.app.irA('menu'), { escala: 0.8, minimo: 46 });
    if (this.pagina > 0) b.poner('izq', 'navArrowBtn_001.png', 26, 196, () => this.ir(this.pagina - 1), { escala: 0.8, voltearX: true, minimo: 50 });
    if (this.pagina < N - 1) b.poner('der', 'navArrowBtn_001.png', VW - 26, 196, () => this.ir(this.pagina + 1), { escala: 0.8, minimo: 50 });
    b.dibujar(r, dt);
    if (this.app.cargandoNivel) {
      r.rect(0, 0, VW, VH, [0, 0, 0, 0.45]);
      r.texto('bigFont', 'Loading...', VW / 2, VH / 2, 0.6, [1, 1, 1, 1]);
    }
    r.terminar();
  }

  dibujarPagina(i, x) {
    const r = this.app.render, n = this.niveles[i], g = this.app.guardado.nivel(n.id);
    const { w, h, y } = this.caja();
    const toque = this.arrastre && this.arrastre.enCaja && !this.arrastre.movio && i === this.pagina ? 0.06 : 0;
    const e = 1 + toque;
    r.modo(false);
    r.panel('square02_001.png', x - w / 2 * e, y - h / 2 * e, x + w / 2 * e, y + h / 2 * e, [0, 0, 0, 0.42], 10);
    const cara = n.dificultad >= 6 ? 'difficulty_06_btn_001.png' : `difficulty_0${n.dificultad}_btn_001.png`;
    r.sprite(cara, x - w / 2 + 40, y + 4, 1.05, 0, [1, 1, 1, 1]);
    GD.textoAjustado(r, 'bigFont', n.nombre, x + 22, y + 18, 0.85, w - 120, [1, 1, 1, 1]);
    // estrellas y monedas
    r.texto('bigFont', String(n.estrellas), x + w / 2 - 34, y - 26, 0.5, [1, 1, 1, 1], 1);
    r.sprite('GJ_starsIcon_001.png', x + w / 2 - 20, y - 26, 0.55, 0, g.completo ? [1, 1, 1, 1] : [0.45, 0.45, 0.45, 1]);
    for (let k = 0; k < 3; k++) {
      const tiene = g.monedas && g.monedas[k];
      r.sprite('secretCoinUI_001.png', x + 22 + (k - 1) * 26, y - 22, 0.42, 0, tiene ? [1, 1, 1, 1] : [0.25, 0.25, 0.25, 0.8]);
    }
    // barras de progreso
    const ancho = Math.min(w * 0.8, 280);
    r.texto('bigFont', 'Normal Mode', x, 128, 0.42, [1, 1, 1, 1]);
    GD.barraProgreso(r, x, 110, ancho, g.normal / 100, GD.VERDE, 0.4);
    r.texto('bigFont', `${g.normal}%`, x, 110, 0.36, [1, 1, 1, 1]);
    r.texto('bigFont', 'Practice Mode', x, 88, 0.42, [1, 1, 1, 1]);
    GD.barraProgreso(r, x, 70, ancho, g.practica / 100, GD.CELESTE, 0.4);
    r.texto('bigFont', `${g.practica}%`, x, 70, 0.36, [1, 1, 1, 1]);
  }

  enCaja(x, y) {
    const r = this.app.render, { w, h, y: cy } = this.caja();
    return Math.abs(x - r.VW / 2) <= w / 2 && Math.abs(y - cy) <= h / 2;
  }

  abajo(x, y, p) {
    if (this.app.cargandoNivel) return;
    if (this.botones.abajo(this.app.render, x, y, p)) return;
    if (this.arrastre) return;
    this.arrastre = { p, x0: x, x, t: performance.now(), vista0: this.vista, movio: false, enCaja: this.enCaja(x, y) };
  }

  mover(x, y, p) {
    if (this.botones.mover(this.app.render, x, y, p)) return;
    const a = this.arrastre;
    if (!a || a.p !== p) return;
    const VW = this.app.render.VW;
    if (Math.abs(x - a.x0) > 8) a.movio = true;
    a.vel = (x - a.x) / Math.max(1, performance.now() - a.t);
    a.x = x; a.t = performance.now();
    if (a.movio) this.vista = GD.limitar(a.vista0 - (x - a.x0) / VW, -0.3, this.niveles.length - 0.7);
  }

  arriba(x, y, p) {
    if (this.botones.arriba(this.app.render, x, y, p)) return;
    const a = this.arrastre;
    if (!a || a.p !== p) return;
    this.arrastre = null;
    if (!a.movio) {
      if (a.enCaja && this.enCaja(x, y)) this.app.jugar(this.niveles[this.pagina]);
      return;
    }
    // soltar: la página más cercana, o la siguiente si fue un deslizón rápido
    let destino = Math.round(this.vista);
    if (Math.abs(a.vel || 0) > 0.4) destino = a.vel < 0 ? Math.floor(this.vista) + 1 : Math.ceil(this.vista) - 1;
    this.ir(destino);
  }

  tecla(salto, abajo, codigo) {
    if (!abajo || this.app.cargandoNivel) return;
    if (codigo === 'ArrowLeft') this.ir(this.pagina - 1);
    else if (codigo === 'ArrowRight') this.ir(this.pagina + 1);
    else if (salto || codigo === 'Enter') this.app.jugar(this.niveles[this.pagina]);
  }

  atras() { this.app.irA('menu'); }
};
