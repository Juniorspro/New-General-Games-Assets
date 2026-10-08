'use strict';
// Una partida: el nivel corriendo al ritmo de su música, los intentos, la muerte y el reintento,
// el modo práctica con sus puntos de control, las monedas, la barra de progreso, la pausa y el
// final. Los textos que se ven son los del juego (en inglés, como el original).

GD.MUERTE = 1.0;            // segundos entre la explosión y el reintento
GD.MUERTE_PRACTICA = 0.7;
GD.CADA_CONTROL = 2.5;      // práctica: un punto de control solo cada tanto, si el jugador está firme
GD.VERDE = [0, 1, 0, 1];    // la barra del modo normal
GD.CELESTE = [0, 1, 1, 1];  // la del modo práctica

GD.Partida = class {
  constructor(app, info, nivel, tex) {
    this.app = app;
    this.info = info;
    this.nivel = nivel;
    const j = this.juego = new GD.Juego(nivel);
    this.escena = new GD.Escena(app.render, j, tex.fondo, tex.piso, tex.piso2);
    this.botones = new GD.Botonera();
    this.practica = false;
    this.controles = [];
    this.ultimoControl = 0;
    this.estado = 'jugando';    // jugando | muerto | completo | pausa
    this.t = 0;                 // segundos en el estado actual (muerte, final)
    this.reloj = 0;             // tiempo del nivel que debería haber corrido (sigue a la música)
    this.desfase = nivel.ajustes.desfaseCancion || 0;
    this.saltos = 0;
    this.segundos = 0;          // tiempo jugado en esta visita al nivel
    this.record = null;         // el cartel de "New Best!"
    this.dedos = new Set();     // punteros apretados que cuentan como salto
    // las monedas, en el orden del nivel: así se guardan cuáles se agarraron
    this.ordenMonedas = nivel.objetos.filter((o) => o.tipo === 'moneda').sort((a, b) => a.x - b.x);
    j.on('muerte', () => this.alMorir());
    j.on('completo', () => this.alCompletar());
    j.on('moneda', (o) => this.alMoneda(o));
    j.on('salto', () => { this.saltos++; });
    j.on('romper', (o) => this.escena.explotar(o.x, o.y, [0.85, 0.85, 0.85], 14));
    this.empezar();
  }

  get sosteniendo() { return this.dedos.size > 0 || this.app.teclaSalto; }

  // Un intento desde el principio.
  empezar() {
    const j = this.juego;
    if (j.pasos || j.muerto || j.completo) j.reiniciar();
    this.reloj = 0;
    this.estado = 'jugando';
    this.record = null;
    this.ultimoControl = 0;
    this.escena.ajustar();
    this.rotular();
    this.app.guardado.intento(this.info.id);
    const a = this.app.audio;
    if (!this.practica) a.musica(this.info.cancion, this.desfase);
    else if (!a.sonando('StayInsideMe')) a.musica('StayInsideMe', 0, true);
    // si el dedo sigue apoyado, el cubo salta apenas arranca (como en el original)
    if (this.sosteniendo) j.jugador.presionar();
  }

  // "Attempt N" en el mundo, un poco adelante del jugador: se va con el nivel.
  rotular() {
    const j = this.juego, J = j.jugador;
    const y = j.techo !== null ? j.centro + 40 : Math.max(110, J.y + 70);
    this.escena.rotulo = { texto: `Attempt ${j.intento}`, x: J.x + 170, y };
  }

  // ── el tiempo ────────────────────────────────────────────────────────────
  actualizar(dt) {
    dt = Math.min(dt, 0.1);
    if (this.estado === 'pausa') return;
    this.t += dt;
    if (this.record) this.record.t += dt;
    if (this.estado === 'muerto') {
      if (this.t >= (this.practica ? GD.MUERTE_PRACTICA : GD.MUERTE)) this.reintentar();
      return;
    }
    if (this.estado !== 'jugando') return;
    this.segundos += dt;
    const j = this.juego, a = this.app.audio;
    this.reloj += dt;
    // La canción manda: si el juego se atrasa (un cuadro lento) corre más pasos para alcanzarla,
    // y las diferencias chicas se corrigen de a poco para que no se note.
    if (!this.practica && a.sonando(this.info.cancion)) {
      const p = a.posicion();
      if (p !== null) {
        const dif = p - this.desfase - this.reloj;
        if (Math.abs(dif) > 0.15) a.musica(this.info.cancion, this.desfase + this.reloj);
        else this.reloj += dif * 0.08;
      }
    }
    const paso = 1 / GD.PASOS;
    let n = 0;
    while (j.tiempo + paso <= this.reloj + 1e-9 && n < 120 && !j.muerto && !j.completo) { j.paso(); n++; }
    if (n === 120) this.reloj = j.tiempo;      // muy atrasado: no intenta recuperar más
    if (this.practica && !j.muerto && !j.completo && j.tiempo - this.ultimoControl >= GD.CADA_CONTROL && this.firme()) this.ponerControl();
  }

  // Un buen momento para un punto de control automático: apoyado, o volando.
  firme() {
    const J = this.juego.jugador;
    return J.volador ? !J.acelerando : J.enSuelo && !J.impulsado;
  }

  // ── eventos del juego ───────────────────────────────────────────────────
  alMorir() {
    const j = this.juego, J = j.jugador, a = this.app.audio, g = this.app.guardado;
    this.estado = 'muerto';
    this.t = 0;
    this.escena.explotar(J.x, J.y, GD.JUGADOR1);
    a.efecto('explode_11');
    const pct = Math.floor(j.progreso * 100);
    if (this.practica) { g.practica(this.info.id, pct); return; }
    a.pararMusica(0.05);
    if (g.normal(this.info.id, pct)) {
      this.record = { pct, t: 0 };
      a.efecto('highscoreGet02');
    }
  }

  reintentar() {
    const j = this.juego;
    this.record = null;
    if (this.practica && this.controles.length) {
      const c = this.controles[this.controles.length - 1];
      j.restaurar(c.estado);
      j.intento++;
      this.reloj = j.tiempo;
      this.ultimoControl = j.tiempo;
      this.estado = 'jugando';
      this.escena.ajustar();
      this.rotular();
      this.app.guardado.intento(this.info.id);
      if (this.sosteniendo) j.jugador.presionar(); else j.jugador.soltar();
      return;
    }
    this.empezar();
  }

  alCompletar() {
    const j = this.juego, a = this.app.audio, g = this.app.guardado;
    this.estado = 'completo';
    this.t = 0;
    this.premio = 0;
    a.efecto('endStart_02');
    if (this.practica) g.practica(this.info.id, 100);
    else {
      const monedas = this.ordenMonedas.map((o) => j.monedas.has(o));
      this.premio = g.completar(this.info.id, monedas, this.info.estrellas);
    }
    this.escena.explotar(j.jugador.x, j.jugador.y, [1, 1, 1], 60);
  }

  alMoneda(o) {
    this.app.audio.efecto('gold02');
    this.escena.moneda(o);
  }

  // ── práctica ─────────────────────────────────────────────────────────────
  ponerControl() {
    const j = this.juego;
    if (j.muerto || j.completo) return;
    this.controles.push({ estado: j.guardar(), x: j.jugador.x, y: j.jugador.y });
    this.ultimoControl = j.tiempo;
    this.escena.controles = this.controles;
  }

  quitarControl() {
    this.controles.pop();
    this.escena.controles = this.controles;
  }

  // Desde la pausa, como en el original: a práctica sigue desde donde estaba (con la música de
  // práctica); de vuelta a normal, el nivel arranca de nuevo.
  cambiarPractica() {
    const a = this.app.audio;
    this.practica = !this.practica;
    this.controles = [];
    this.escena.controles = this.controles;
    this.dedos.clear();
    this.juego.jugador.soltar();
    a.pausada = null;
    if (this.practica) {
      a.musica('StayInsideMe', 0, true);
      this.ultimoControl = this.juego.tiempo;
      this.estado = this.antes;
    } else {
      a.pararMusica();
      this.estado = 'jugando';
      this.empezar();
    }
  }

  // ── pausa ────────────────────────────────────────────────────────────────
  pausar() {
    if (this.estado !== 'jugando' && this.estado !== 'muerto') return;
    this.antes = this.estado;
    this.estado = 'pausa';
    this.app.audio.pausar();
    this.botones.cancelar();
  }

  seguir() {
    if (this.estado !== 'pausa') return;
    this.dedos.clear();
    this.juego.jugador.soltar();
    this.estado = this.antes;
    this.app.audio.seguir();
  }

  reiniciarDesdePausa() {
    this.dedos.clear();
    this.controles = [];
    this.escena.controles = this.controles;
    this.estado = 'jugando';
    this.app.audio.pausada = null;
    this.empezar();
  }

  // ── toques ───────────────────────────────────────────────────────────────
  abajo(x, y, puntero) {
    const r = this.app.render;
    if (this.botones.abajo(r, x, y, puntero)) return;
    if (this.estado === 'pausa' || this.estado === 'completo') return;
    this.dedos.add(puntero);
    this.juego.jugador.presionar();
  }

  mover(x, y, puntero) { this.botones.mover(this.app.render, x, y, puntero); }

  arriba(x, y, puntero) {
    if (this.botones.arriba(this.app.render, x, y, puntero)) return;
    this.dedos.delete(puntero);
    if (!this.sosteniendo) this.juego.jugador.soltar();
  }

  tecla(salto, abajo) {
    if (!salto || this.estado === 'pausa' || this.estado === 'completo') return;
    if (abajo) this.juego.jugador.presionar();
    else if (!this.sosteniendo) this.juego.jugador.soltar();
  }

  atras() {
    if (this.estado === 'pausa') this.seguir();
    else if (this.estado === 'completo') this.app.irA('selector');
    else this.pausar();
  }

  // ── dibujo ───────────────────────────────────────────────────────────────
  dibujar(dt) {
    const r = this.app.render;
    this.escena.dibujar(this.estado === 'pausa' ? 0 : dt);
    if (this.estado !== 'completo') this.dibujarHUD();
    if (this.record) this.dibujarRecord();
    if (this.estado === 'completo') this.dibujarFin();
    if (this.estado === 'pausa') this.dibujarPausa();
    this.botones.dibujar(r, dt);
    r.terminar();
  }

  dibujarHUD() {
    const r = this.app.render, VW = r.VW, VH = r.VH, j = this.juego;
    const ancho = Math.min(210, VW * 0.36);
    GD.barraProgreso(r, VW / 2, VH - 9, ancho, j.progreso, this.practica ? GD.CELESTE : GD.VERDE);
    r.texto('bigFont', `${Math.floor(j.progreso * 100)}%`, VW / 2 + ancho / 2 + 6, VH - 9, 0.42, [1, 1, 1, 1], 0);
    if (this.estado === 'pausa') return;
    this.botones.poner('pausa', 'GJ_pauseBtn_001.png', VW - 22, VH - 22, () => this.pausar(), { escala: 0.7, alfa: 0.55, minimo: 46 });
    if (this.practica) {
      this.botones.poner('control+', 'GJ_checkpointBtn_001.png', VW / 2 - 42, 30, () => this.ponerControl(), { escala: 0.6, alfa: 0.75, minimo: 44 });
      this.botones.poner('control-', 'GJ_removeCheckBtn_001.png', VW / 2 + 42, 30, () => this.quitarControl(), { escala: 0.6, alfa: 0.75, minimo: 44 });
    }
  }

  dibujarRecord() {
    const r = this.app.render, t = this.record.t;
    const k = t < 0.35 ? GD.rebote(t / 0.35) : 1;
    const a = t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.2) : 1;
    r.modo(false);
    r.sprite('GJ_newBest_001.png', r.VW / 2, r.VH / 2 + 40, 0.75 * k, 0, [1, 1, 1, a]);
    r.texto('bigFont', `${this.record.pct}%`, r.VW / 2, r.VH / 2 - 2, 0.9 * k, [1, 1, 1, a]);
  }

  dibujarPausa() {
    const r = this.app.render, VW = r.VW, VH = r.VH, g = this.app.guardado.nivel(this.info.id);
    r.modo(false);
    r.rect(0, 0, VW, VH, [0, 0, 0, 0.6]);
    GD.textoAjustado(r, 'bigFont', this.info.nombre, VW / 2, VH - 40, 0.9, VW - 60, [1, 1, 1, 1]);
    const ancho = Math.min(240, VW * 0.5);
    r.texto('bigFont', 'Normal Mode', VW / 2, VH - 82, 0.45, [1, 1, 1, 1]);
    GD.barraProgreso(r, VW / 2, VH - 102, ancho, g.normal / 100, GD.VERDE);
    r.texto('bigFont', `${g.normal}%`, VW / 2, VH - 102, 0.38, [1, 1, 1, 1]);
    r.texto('bigFont', 'Practice Mode', VW / 2, VH - 128, 0.45, [1, 1, 1, 1]);
    GD.barraProgreso(r, VW / 2, VH - 148, ancho, g.practica / 100, GD.CELESTE);
    r.texto('bigFont', `${g.practica}%`, VW / 2, VH - 148, 0.38, [1, 1, 1, 1]);
    const y = 80, b = this.botones;
    b.poner('practica', this.practica ? 'GJ_normalBtn_001.png' : 'GJ_practiceBtn_001.png', VW / 2 - 120, y, () => this.cambiarPractica(), { escala: 0.8 });
    b.poner('seguir', 'GJ_playBtn2_001.png', VW / 2 - 35, y, () => this.seguir(), { escala: 0.85 });
    b.poner('otra', 'GJ_replayBtn_001.png', VW / 2 + 50, y, () => this.reiniciarDesdePausa(), { escala: 0.8 });
    b.poner('menu', 'GJ_menuBtn_001.png', VW / 2 + 125, y, () => this.app.irA('selector'), { escala: 0.8 });
    const a = this.app.audio;
    b.poner('musica', a.musicaSi ? 'GJ_musicOnBtn_001.png' : 'GJ_musicOffBtn_001.png', 28, 26, () => this.app.ponerMusica(!a.musicaSi), { escala: 0.6, minimo: 44 });
    b.poner('efectos', a.efectosSi ? 'GJ_fxOnBtn_001.png' : 'GJ_fxOffBtn_001.png', 70, 26, () => this.app.ponerEfectos(!a.efectosSi), { escala: 0.6, minimo: 44 });
  }

  dibujarFin() {
    const r = this.app.render, VW = r.VW, VH = r.VH, t = this.t;
    r.modo(false);
    if (t < 0.3) r.rect(0, 0, VW, VH, [1, 1, 1, 0.7 * (1 - t / 0.3)]);
    const cartel = this.practica ? 'GJ_practiceComplete_001.png' : 'GJ_levelComplete_001.png';
    const [cw] = r.tamCuadro(cartel);
    const ec = Math.min(0.85, (VW - 40) / cw);
    const PANEL = 1.6;
    if (t < PANEL + 0.25) {
      const k = t < 0.45 ? GD.rebote(t / 0.45) : 1;
      const a = t > PANEL ? Math.max(0, 1 - (t - PANEL) / 0.25) : 1;
      r.sprite(cartel, VW / 2, VH / 2 + 30, ec * k, 0, [1, 1, 1, a]);
    }
    if (t < PANEL) return;
    // el cuadro del final baja desde arriba
    const u = Math.min(1, (t - PANEL) / 0.45);
    const cy = VH / 2 - 6 + (1 - GD.rebote(u)) * VH;
    r.rect(0, 0, VW, VH, [0, 0, 0, 0.35 * u]);
    const w = Math.min(380, VW - 40), h = 220;
    r.panel('GJ_square01.png', VW / 2 - w / 2, cy - h / 2, VW / 2 + w / 2, cy + h / 2, [1, 1, 1, 1], 16);
    r.sprite(cartel, VW / 2, cy + h / 2 - 8, Math.min(0.6, (w + 30) / cw), 0, [1, 1, 1, 1]);
    const seg = Math.floor(this.segundos);
    const tiempo = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;
    r.texto('goldFont', `Attempts: ${this.juego.intento}`, VW / 2, cy + 52, 0.75, [1, 1, 1, 1]);
    r.texto('goldFont', `Jumps: ${this.saltos}`, VW / 2, cy + 26, 0.75, [1, 1, 1, 1]);
    r.texto('goldFont', `Time: ${tiempo}`, VW / 2, cy, 0.75, [1, 1, 1, 1]);
    if (this.premio) {
      r.texto('bigFont', `+${this.premio}`, VW / 2 + w / 2 - 62, cy + 30, 0.6, [1, 1, 1, 1], 1);
      r.sprite('GJ_bigStar_001.png', VW / 2 + w / 2 - 38, cy + 30, 0.4, 0, [1, 1, 1, 1]);
    }
    if (u < 1) return;
    this.botones.poner('otra', 'GJ_replayBtn_001.png', VW / 2 - 50, cy - 62, () => this.reiniciarDesdePausa(), { escala: 0.8 });
    this.botones.poner('menu', 'GJ_menuBtn_001.png', VW / 2 + 50, cy - 62, () => this.app.irA('selector'), { escala: 0.8 });
  }

  // Al salir: que no quede nada sonando.
  cerrar() { this.app.audio.pararMusica(0.1); this.app.audio.pausada = null; }
};

// Rebote como CCEaseBackOut: pasa un poco y vuelve (t de 0 a 1).
GD.rebote = function (t) {
  const s = 1.70158;
  t = Math.min(1, Math.max(0, t)) - 1;
  return t * t * ((s + 1) * t + s) + 1;
};
