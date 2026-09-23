/* ============================================================================
   brillo/js/director.js — el que dirige: arma todo, lleva la partida y decide
   qué se ve: el idioma, "iniciando sesión", el título (con la colina de
   fondo), los mundos, el juego, las charlas, la pausa, las opciones, el
   editor de los controles de dedo y los créditos.
   La lógica corre a 60 pasos fijos por segundo; el dibujo, a lo que dé la
   pantalla. Lo que se aprieta se junta en Entrada y se gasta en el paso.
   ========================================================================== */
import { Pantalla } from './pantalla.js';
import { Post } from './post.js';
import { UI, imagen, avatar } from './ui.js';
import { Tactil, TACTIL_INICIAL } from './tactil.js';
import { Entrada } from './entrada.js';
import { Sonido } from './sonido.js';
import { Nivel } from './juego.js';
import { DT, NADA, revivir } from './fisica.js';
import { NIVELES, ORDEN } from './niveles.js';
import { HISTORIA } from './historia.js';
import { Idioma, IDIOMAS, TX, tr, MUNDOS, EMO } from './textos.js';
import { lienzo2d } from './pixel.js';
import { plano as dibPlano } from './personajes.js';
import { orbe as dibOrbe, emoticon } from './objetos.js';
import { burbuja } from './efectos.js';

const GUARDA = 'brillo:partida', OPC = 'brillo:opciones';
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const esTactil = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const TECLAS = {
  ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arr', KeyW: 'arr', ArrowDown: 'aba', KeyS: 'aba',
  Space: ['salto', 'aceptar'], KeyZ: ['salto', 'aceptar'], KeyK: 'salto', KeyX: 'accion', KeyE: 'accion', KeyJ: 'accion',
  Enter: 'aceptar', NumpadEnter: 'aceptar', Escape: ['pausa', 'volver'], KeyP: 'pausa', Backspace: 'volver',
};
const MANDO = { 0: ['salto', 'aceptar'], 1: ['accion', 'volver'], 2: 'accion', 3: 'accion', 8: 'volver', 9: 'pausa', 12: 'arr', 13: 'aba', 14: 'izq', 15: 'der' };
/* la voz de cada uno cuando escribe (el tic de las letras) */
const VOZ = { nick: 1250, mora: 1700, tito: 950, plano: 520, dorado: 1100, lila: 1850, sol: 1450, vio: 1550 };

const PARTIDA_NUEVA = () => ({ mundo: ORDEN[0], en: null, juntadas: [], rotos: {}, habil: {}, hechos: [] });
const OPCIONES = () => ({ musica: 7, efectos: 8, calidad: 'alta', giro: 'auto', tactil: TACTIL_INICIAL() });

/* todos los guiños del juego en orden (mundo por mundo, de izquierda a
   derecha): el guiño número i destapa el emoticón número i */
function listaGuinos() {
  const r = [];
  for (const id of ORDEN) {
    const g = [];
    NIVELES[id].filas.forEach((f, y) => { for (let x = 0; x < f.length; x++) if (f[x] === 'G') g.push({ id: `${id}:G${x},${y}`, x }); });
    g.sort((a, b) => a.x - b.x);
    r.push(...g.map((q) => q.id));
  }
  return r;
}

export class Director {
  constructor() {
    this.opc = Object.assign(OPCIONES(), leer(OPC) || {});
    this.opc.tactil = Object.assign(TACTIL_INICIAL(), this.opc.tactil || {});
    this.partida = leer(GUARDA);
    if (this.partida) this.partida = Object.assign(PARTIDA_NUEVA(), this.partida);
    this.todosGuinos = listaGuinos();
    Pantalla.giro = this.opc.giro;
    Pantalla.iniciar();
    this.post = new Post(document.getElementById('c'));
    this.post.calidad = this.opc.calidad;
    this.raiz = document.getElementById('ui');
    const ui = this.ui = new UI(this.raiz);
    /* entrada: teclado, mando y dedos (en el teléfono se arranca con los dedos) */
    Entrada.aCaja = (x, y) => Pantalla.aCaja(x, y);
    Entrada.caja = (el) => Pantalla.caja(el);
    Entrada.teclado(TECLAS); Entrada.mando(MANDO);
    Entrada.iniciar(esTactil());
    this.tactil = new Tactil(this.raiz, this.opc.tactil, () => this.pausar());
    Entrada.alUsar = () => this.verTactil();
    Pantalla.alCambiar = () => { this.tactil.acomodar(); this.base = null; };
    /* el sonido: se prende con el primer toque o la primera tecla */
    Sonido.volumenes(this.opc.musica / 10, this.opc.efectos / 10);
    const prender = () => Sonido.iniciar();
    addEventListener('pointerdown', prender, true); addEventListener('keydown', prender, true);
    ui.alMover = () => Sonido.sfx('mover');
    ui.alNo = () => Sonido.sfx('no');
    ui.alPop = () => { Sonido.iniciar(); Sonido.sfx('pop'); if (this.estado === 'idioma' && esTactil()) Pantalla.acostar(); };
    ui.alLetra = () => Sonido.sfx('letra', { f: VOZ[this.hablante] || 1300 });
    ui.alOla = () => Sonido.sfx('ola');
    /* tocar la pantalla pasa la charla */
    addEventListener('pointerdown', (e) => { if (this.avanzar && !this.pausado && !this.ui.foco) { e.preventDefault(); this.avanzar(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.guardar(); this.pausar(); } });
    addEventListener('pagehide', () => this.guardar());

    this.vez = 0; this.estado = 'idioma'; this.pausado = false; this.guion = false;
    this.esperas = []; this.tweens = []; this.grisT = null; this.grisV = 0;
    this.acum = 0; this.ult = 0;
    this.fondoTitulo();
    this._cuadro = (ts) => this.cuadro(ts);
    requestAnimationFrame(this._cuadro);
    this.idioma();
    window.__brillo = this;
  }

  /* ---------------- el bucle ---------------- */
  cuadro(ts) {
    requestAnimationFrame(this._cuadro);
    const dt = this.ult ? Math.min(0.1, (ts - this.ult) / 1000) : DT; this.ult = ts;
    Entrada.leerMando();
    Sonido.pasar();
    const w = Pantalla.w, h = Pantalla.h;
    if (!this.base || this.base.width !== w || this.base.height !== h) { [this.base, this.g] = lienzo2d(w, h); this.post.tamano(w, h, Pantalla.escala, Pantalla.lienzo); }
    this.pasarEntrada();
    const N = this.N;
    if (!N) return;
    const corre = !this.pausado;
    if (corre && this.estado === 'jugando') {
      this.acum += dt; let n = 0;
      while (this.acum >= DT && n < 5) { N.paso(this.control()); Entrada.fin(); this.acum -= DT; n++; }
      if (n === 5) this.acum = 0;
    } else this.acum = 0;
    if (corre) {
      this.pasarTiempo(dt);
      if (this.paseo) {
        const m = N.m, largo = Math.max(0, Math.min(m.W * 16 - w, 1500)), u = 0.5 - 0.5 * Math.cos(N.t * 0.03);
        N.encuadre = { x: w / 2 + u * largo, y: m.H * 16 - h / 2 };
      }
      N.cuadro(dt);
    }
    if (this.charlaR) { this.charlaR.pasar(dt); this.animarHablante(); }
    N.dibujar(this.g, w, h);
    const F = N.fondo;
    this.post.mostrar(this.base, { ...F.post, sol: F.sol, grado: this.grado(F.grado), t: N.t });
  }
  /* el color: el Plano lo apaga (0 = normal, 1 = gris) */
  grado(G) {
    if (!this.grisV) return G;
    const b = G || { tinte: [1, 1, 1], levantar: [0, 0, 0], sat: 1.08, contraste: 1.04 }, k = this.grisV;
    return { tinte: b.tinte.map((v) => v + (0.96 - v) * k), levantar: b.levantar.map((v) => v + (0.04 - v) * k), sat: b.sat * (1 - 0.85 * k), contraste: b.contraste * (1 - 0.18 * k) };
  }
  pasarTiempo(dt) {
    for (const e of this.esperas.slice()) {
      e.t -= dt;
      if ((e.si && e.si()) || e.t <= 0) { this.esperas.splice(this.esperas.indexOf(e), 1); e.listo(); }
    }
    for (const q of this.tweens.slice()) {
      q.t = Math.min(q.dur, q.t + dt);
      const u = q.t / q.dur, k = u * u * (3 - 2 * u);
      q.o.x = q.x0 + (q.x1 - q.x0) * k; q.o.y = q.y0 + (q.y1 - q.y0) * k;
      if (q.t >= q.dur) { this.tweens.splice(this.tweens.indexOf(q), 1); q.listo(); }
    }
    if (this.grisT) { const g = this.grisT; g.t = Math.min(g.dur, g.t + dt); this.grisV = g.a + (g.b - g.a) * (g.t / g.dur); if (g.t >= g.dur) this.grisT = null; }
  }
  control() { return this.guion || this.charlaR ? NADA : Entrada.leer(); }

  /* lo que se apretó, según lo que se esté viendo */
  pasarEntrada() {
    const E = Entrada.EDGE;
    if (this.ui.narrando && !this.pausado) { if (E.aceptar || E.salto || E.accion || E.volver) this.ui.narrando(); Entrada.fin(); return; }
    if (this.avanzar && !this.pausado) { if (E.aceptar || E.salto || E.accion) this.avanzar(); if (E.pausa) this.pausar(); Entrada.fin(); return; }
    if (this.estado === 'jugando' && !this.pausado) { if (E.pausa) this.pausar(); return; }
    if (this.pausado && E.pausa && this.enPausa) { this.continuar(); Entrada.fin(); return; }
    if (this.ui.foco) this.ui.pasar(E);
    Entrada.fin();
  }

  /* ---------------- idioma, sesión y título ---------------- */
  idioma() {
    this.estado = 'idioma';
    this.ui.idioma(Idioma.guardado() || Idioma.delNavegador(), async (l) => {
      Idioma.poner(l);
      Sonido.musica('titulo');
      await this.ui.iniciandoSesion();
      Sonido.sfx('sesion');
      this.titulo();
    });
  }
  /* la colina de fondo, con la cámara paseando despacito */
  fondoTitulo() {
    this.N = new Nivel(ORDEN[0]);
    this.N.quieto = true; this.paseo = true;
  }
  hayPartida() { const P = this.partida; return !!(P && (P.en || P.hechos.length || P.juntadas.length || P.mundo !== ORDEN[0])); }
  async titulo(conOla) {
    const vez = ++this.vez;
    this.estado = 'titulo'; this.pausado = false; this.enPausa = false; this.guion = false;
    this.verTactil(); this.ui.verHud(false);
    if (conOla) { await this.ui.olaTapa(); if (vez !== this.vez) return; }
    this.quitarEscena();
    if (!this.paseo) this.fondoTitulo();
    Sonido.musica('titulo'); Sonido.agua(false);
    if (conOla) this.ui.olaDestapa();
    this.menuTitulo();
  }
  menuTitulo(i = 0) {
    const hay = this.hayPartida(), P = this.partida;
    const op = hay ? [['seguir', tr('seguir')], ['nuevo', tr('nuevo')]] : [['empezar', tr('empezar')]];
    if (P && P.hechos.length) op.push(['mundos', tr('mundos')]);
    op.push(['guinos', tr('guinos')], ['opciones', tr('opciones')], ['creditos', tr('creditos')]);
    let seguro = false;
    this.ui.titulo({
      opciones: op, i,
      elegir: (k, el) => {
        const idx = op.findIndex((o) => o[0] === k);
        if (k !== 'nuevo' && seguro) { seguro = false; }
        if (k === 'seguir') { Sonido.sfx('elegir'); this.jugar(P.mundo, P.en); }
        else if (k === 'empezar' || (k === 'nuevo' && seguro)) { Sonido.sfx('elegir'); this.partida = PARTIDA_NUEVA(); this.guardar(); this.jugar(ORDEN[0], null); }
        else if (k === 'nuevo') { seguro = true; Sonido.sfx('aviso'); this.ui.ponerTexto(el, tr('nuevoSeguro')); }
        else if (k === 'mundos') { Sonido.sfx('elegir'); this.menuMundos(() => this.menuTitulo(idx)); }
        else if (k === 'guinos') { Sonido.sfx('elegir'); this.ui.guinos(this.guinosJuntados(), () => this.menuTitulo(idx)); }
        else if (k === 'opciones') { Sonido.sfx('elegir'); this.menuOpciones(() => this.menuTitulo(idx)); }
        else if (k === 'creditos') { Sonido.sfx('elegir'); this.creditos(false); }
      },
    });
  }
  menuMundos(volver) {
    const P = this.partida || PARTIDA_NUEVA();
    const lista = MUNDOS.map((id, i) => ({ id, abierto: !!NIVELES[id] && (i === 0 || P.hechos.includes(MUNDOS[i - 1])), hecho: P.hechos.includes(id) }));
    this.ui.mundos(lista, (id) => { Sonido.sfx('elegir'); this.jugar(id, null); }, volver);
  }
  guinosJuntados() {
    const P = this.partida, s = new Set();
    if (P) this.todosGuinos.forEach((id, i) => { if (P.juntadas.includes(id)) s.add(i); });
    return s;
  }
  async creditos(final) {
    this.ui.limpiar(); this.ui.verHud(false);
    Sonido.musica('creditos');
    await this.ui.creditos(TX().creditos);
    if (final) this.titulo(true);
    else { Sonido.musica('titulo'); this.menuTitulo(); }
  }

  /* ---------------- las opciones ---------------- */
  menuOpciones(volver) {
    const O = this.opc;
    const barra = (n) => `<span class="barra-v">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    const ciclo = (lista, v, d) => lista[(lista.indexOf(v) + d + lista.length) % lista.length];
    const filas = [
      { nombre: () => tr('idioma'), valor: () => IDIOMAS.find(([l]) => l === Idioma.actual)[1], cambiar: (d) => { Idioma.poner(ciclo(IDIOMAS.map(([l]) => l), Idioma.actual, d)); } },
      { nombre: () => tr('musica'), valor: () => barra(O.musica), cambiar: (d) => { O.musica = Math.max(0, Math.min(10, O.musica + d)); Sonido.volumenes(O.musica / 10, O.efectos / 10); this.guardarOpc(); } },
      { nombre: () => tr('efectos'), valor: () => barra(O.efectos), cambiar: (d) => { O.efectos = Math.max(0, Math.min(10, O.efectos + d)); Sonido.volumenes(O.musica / 10, O.efectos / 10); Sonido.sfx('gota', { k: O.efectos }); this.guardarOpc(); } },
      { nombre: () => tr('calidad'), valor: () => tr(O.calidad), cambiar: (d) => { O.calidad = ciclo(['alta', 'baja'], O.calidad, d); this.post.calidad = O.calidad; this.guardarOpc(); } },
    ];
    if (document.documentElement.requestFullscreen) filas.push({ nombre: () => tr('pantalla'), valor: () => tr(document.fullscreenElement ? 'si' : 'no'), cambiar: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else Pantalla.acostar(); } catch (_) {} } });
    if (esTactil()) {
      filas.push({ nombre: () => tr('giro'), valor: () => tr(O.giro), cambiar: (d) => { O.giro = ciclo(['auto', 'normal', 'reves'], O.giro, d); Pantalla.ponerGiro(O.giro); this.guardarOpc(); } });
    }
    filas.push({ nombre: () => tr('tactiles'), valor: () => tr('acomodar') + ' ›', abrir: () => { Sonido.sfx('elegir'); this.editarTactil(() => this.menuOpciones(volver)); } });
    this.ui.opciones(filas, () => { Sonido.sfx('elegir'); volver(); }, { tactil: Entrada.fuente === 'toque' });
  }
  guardarOpc() { escribir(OPC, this.opc); }
  editarTactil(volver) {
    this.ui.limpiar();
    this.tactil.editar(this.ui, () => this.guardarOpc(), () => { this.guardarOpc(); this.verTactil(); volver(); });
  }

  /* ---------------- la pausa ---------------- */
  pausar() {
    if (this.estado !== 'jugando' || this.pausado || this.ui.narrando) return;
    this.pausado = true; this.enPausa = true;
    Entrada.soltarTodo(); Entrada.fin();
    this.verTactil(); this.guardar();
    Sonido.sfx('elegir');
    this.menuPausa();
  }
  menuPausa() {
    this.enPausa = true;
    const op = [['continuar', tr('continuar')]];
    if (!this.guion && !this.charlaR) op.push(['reintentar', tr('reintentar')]);
    op.push(['opciones', tr('opciones')], ['salir', tr('salir')]);
    this.ui.pausa({
      mundo: TX().mundos[this.mundo], guinos: this.guinosJuntados().size, total: this.todosGuinos.length, gotas: this.gotas(), opciones: op,
      elegir: (k) => {
        if (k === 'continuar') this.continuar();
        else if (k === 'reintentar') { this.continuar(); if (!this.N.m.p.muerto) revivir(this.N.m); }
        else if (k === 'opciones') { this.enPausa = false; Sonido.sfx('elegir'); this.menuOpciones(() => this.menuPausa()); }
        else if (k === 'salir') { Sonido.sfx('elegir'); this.guardar(); this.titulo(true); }
      },
    });
  }
  continuar() {
    if (!this.pausado) return;
    this.pausado = false; this.enPausa = false;
    this.ui.limpiar(); Sonido.sfx('elegir');
    this.verTactil();
  }

  /* ---------------- los controles de dedo y lo de arriba ---------------- */
  verTactil() {
    const jugando = this.estado === 'jugando' && !this.pausado && !this.guion && !this.charlaR && !this.ui.narrando;
    const dedos = Entrada.fuente === 'toque' && jugando;
    this.tactil.ver(dedos);
    this.raiz.classList.toggle('conDedos', dedos);
    this.tactil.ctl.zumbido.classList.toggle('oculto', !(this.N && this.N.m.habil.zumbido));
    this.ui.verHud(jugando || (this.estado === 'jugando' && this.pausado));
  }
  gotas() { const P = this.partida; return P ? P.juntadas.filter((id) => id.includes(':g')).length : 0; }
  pintarHud() {
    if (this.N && this.partida) this.partida.juntadas = [...this.N.m.juntadas];
    this.ui.hud(this.gotas(), this.guinosJuntados().size, this.todosGuinos.length);
  }
  guardar() {
    const P = this.partida;
    if (!P) return;
    if (this.N && this.estado === 'jugando') { P.juntadas = [...this.N.m.juntadas]; P.habil = Object.assign({}, P.habil, this.N.m.habil); }
    escribir(GUARDA, P);
  }

  /* ---------------- un mundo ---------------- */
  quitarEscena() {
    this.esperas = []; this.tweens = []; this.grisT = null; this.grisV = 0;
    if (this.charlaR) { this.charlaR.cerrar(); this.charlaR = null; }
    this.avanzar = null; this.hablante = null;
    for (const el of this.raiz.querySelectorAll('.narra,.mensaje,.cartelMundo,.creditos')) el.remove();
    this.ui.narrando = null;
    this.ui.limpiar();
  }
  async jugar(id, en) {
    const vez = ++this.vez;
    if (!this.partida) this.partida = PARTIDA_NUEVA();
    const P = this.partida;
    this.estado = 'cargando'; this.pausado = false; this.enPausa = false; this.guion = false;
    this.ui.foco = null;
    this.verTactil();
    await this.ui.olaTapa();
    if (vez !== this.vez) return;
    this.quitarEscena();
    const retomado = !!en || P.hechos.includes(id);
    const N = this.N = new Nivel(id, { habil: P.habil, en, juntadas: P.juntadas, rotos: (P.rotos || {})[id] || [] });
    for (const v of N.npcs) v.orig = v.id;
    N.alEvento = (e) => this.evento(e, vez);
    this.paseo = false; this.mundo = id;
    P.mundo = id; if (!en) P.en = null;
    this.guardar();
    this.combo = { k: 0, t: -9 };
    const H = HISTORIA[id] || {};
    Sonido.musica(H.musica || id); Sonido.agua(false);
    this.estado = 'jugando';
    this.pintarHud();
    this.verTactil();
    this.ui.olaDestapa();
    this.j = this.guionista(vez);
    if (H.inicio) H.inicio(this.j, retomado); else this.j.empezar();
  }
  async terminarMundo() {
    const P = this.partida, id = this.mundo;
    if (!P.hechos.includes(id)) P.hechos.push(id);
    const sig = ORDEN[ORDEN.indexOf(id) + 1];
    P.mundo = sig || id; P.en = null;
    this.guardar();
    if (sig) this.jugar(sig, null);
    else this.titulo(true);
  }

  /* lo que avisa la física */
  evento(e, vez) {
    if (vez !== this.vez) return;
    const N = this.N, H = HISTORIA[this.mundo] || {};
    switch (e.t) {
      case 'salto': Sonido.sfx('salto'); break;
      case 'burbuja': Sonido.sfx('burbuja'); break;
      case 'aterriza': Sonido.sfx('aterriza'); break;
      case 'hongo': Sonido.sfx('hongo'); break;
      case 'brazada': Sonido.sfx('brazada'); break;
      case 'agua': Sonido.sfx('agua'); Sonido.agua(true); break;
      case 'saleAgua': Sonido.sfx('agua'); Sonido.agua(false); break;
      case 'entra': Sonido.sfx('entra'); break;
      case 'sale': Sonido.sfx('pop'); break;
      case 'zumbido': Sonido.sfx('zumbido'); Entrada.zumbar(40); if (e.rotos.length) setTimeout(() => Sonido.sfx('rompe'), 90); break;
      case 'restaura': Sonido.sfx('restaura'); break;
      case 'muere': Sonido.sfx('muere'); Entrada.zumbar(90); Sonido.agua(false); break;
      case 'revive': Sonido.sfx('revive'); break;
      case 'gota': {
        const c = this.combo; c.k = N.t - c.t < 0.7 ? c.k + 1 : 0; c.t = N.t;
        Sonido.sfx('gota', { k: c.k });
        this.pintarHud(); this.ui.latido('gota');
        break;
      }
      case 'guino': {
        Sonido.sfx('guino');
        this.pintarHud(); this.ui.latido('guino');
        const i = this.todosGuinos.indexOf(e.id), n = EMO[i];
        if (n) this.ui.aviso(TX().emoticones[n], { titulo: tr('guino'), img: imagen('emo' + n, () => emoticon(n)), clase: 'dorado', dura: 3600 });
        this.guardar();
        break;
      }
      case 'sesion': {
        Sonido.sfx('sesion');
        const P = this.partida;
        P.en = { x: e.x, y: e.y, id: e.id };
        P.rotos = P.rotos || {}; P.rotos[this.mundo] = [...N.m.rotos];
        this.guardar();
        this.ui.aviso(tr('sesion'), { titulo: 'BRILLO', img: avatar('nick'), clase: 'verde' });
        break;
      }
      case 'zona': {
        this.guardar();
        const f = H.zonas && H.zonas[e.id];
        if (f) f(this.j);
        this.verTactil();
        break;
      }
      case 'fin': if (H.fin) H.fin(this.j); else this.terminarMundo(); break;
    }
  }

  /* ---------------- la charla ---------------- */
  charla(lineas, o = {}) {
    return new Promise((listo) => {
      if (!lineas || !lineas.length) { listo(); return; }
      const otro = o.con || (lineas.find(([q]) => q !== 'nick') || ['nick'])[0];
      const R = this.charlaR = this.ui.charla(otro);
      this.verTactil();
      let i = 0;
      const decir = () => {
        const [q, t] = lineas[i];
        this.hablante = q;
        R.linea(q, t);
        Sonido.sfx('aviso');
        if (o.alLinea) o.alLinea(i);
      };
      this.avanzar = () => {
        if (!R.listo) { R.completar(); return; }
        i++;
        if (i < lineas.length) { decir(); return; }
        this.callarHablante();
        R.cerrar(); this.charlaR = null; this.avanzar = null; this.hablante = null;
        this.verTactil();
        listo();
      };
      decir();
    });
  }
  /* el que habla mueve la boca mientras escribe */
  animarHablante() {
    const N = this.N, R = this.charlaR, q = this.hablante;
    const hablando = R && !R.listo && R.t >= 0;
    for (const v of N.npcs) {
      const es = hablando && (v.orig || v.id) === q;
      if (es && v.anim !== 'habla') { v.animAntes = v.anim; v.anim = 'habla'; }
      else if (!es && v.anim === 'habla') v.anim = v.animAntes || 'quieto';
    }
    const nick = hablando && q === 'nick';
    if (nick && N.gestoNick !== 'habla') { this.gestoAntes = N.gestoNick; N.gestoNick = 'habla'; }
    else if (!nick && N.gestoNick === 'habla') N.gestoNick = this.gestoAntes || null;
    for (const a of N.actores) a.habla = hablando && a.quien === q;
  }
  callarHablante() { this.hablante = null; if (this.N) this.animarHablante(); }

  /* ---------------- lo que la historia puede hacer ---------------- */
  guionista(vez) {
    const d = this, N = this.N, ui = this.ui;
    /* una promesa que solo vuelve si seguimos en el mismo mundo */
    const vale = (p) => new Promise((r) => { Promise.resolve(p).then((v) => { if (d.vez === vez) r(v); }); });
    const esperar = (s, si) => vale(new Promise((listo) => d.esperas.push({ t: s, si, listo })));
    const j = {
      N,
      npc: (id) => N.npcs.find((v) => (v.orig || v.id) === id),
      esperar: (s) => esperar(s),
      hastaQue: (si, max = 4) => esperar(max, si),
      guion(si) { d.guion = si; if (si) Entrada.soltarTodo(); d.verTactil(); },
      quieto(si) { N.quieto = si; },
      musica: (n) => Sonido.musica(n),
      sfx: (n, o) => Sonido.sfx(n, o),
      gris(b, dur = 1) { d.grisT = { a: d.grisV, b, t: 0, dur }; },
      chispas(x, y, col) { N.fx.soltar(x, y, 16, { v: 60, col }); },
      gestoNick(g) { N.gestoNick = g; },
      camara(x, y) { N.encuadre = x == null ? null : { x, y }; },
      mover: (o, x, y, dur) => vale(new Promise((listo) => d.tweens.push({ o, x0: o.x, y0: o.y, x1: x, y1: y, t: 0, dur, listo }))),
      plano(x, y) {
        const a = { quien: 'plano', x, y, visible: true, habla: false, img: (t) => dibPlano(a.habla ? Math.floor(t * 8) % 3 : Math.floor(t * 2) % 7 === 6 ? 3 : Math.floor(t * 5) % 11 === 0 ? 1 : 0) };
        N.actores.push(a);
        return a;
      },
      narrar(id) {
        const p = ui.narrar(TX().narra[id] || []);
        d.verTactil();
        return vale(p.then(() => d.verTactil()));
      },
      charla: (id, o) => vale(d.charla(TX().charlas[id], o)),
      /* esperar a que Nick pise algo, frenar todo, charlar, y seguir */
      async hablar(id, alFin) {
        j.guion(true);
        await j.hastaQue(() => N.m.p.enSuelo || N.m.p.enAgua || N.m.p.muerto);
        N.quieto = true;
        await j.charla(id);
        if (alFin) alFin();
        N.quieto = false;
        j.guion(false);
      },
      /* una ayuda abajo a la derecha (espera a que no haya charla ni escena) */
      async ayuda(k) {
        const a = TX().ayudas[k];
        if (!a) return;
        if (d.charlaR || d.guion) await j.hastaQue(() => !d.charlaR && !d.guion, 60);
        ui.aviso(a[Entrada.fuente === 'toque' ? 1 : 0], { img: imagen('ayuda', () => burbuja(9)), dura: 5600 });
      },
      aprendio(k, quien) {
        Sonido.sfx('guino');
        ui.aviso(tr('aprendio', tr(k)), { titulo: TX().nombres[quien] || '', img: avatar(quien || 'nick'), clase: 'verde', dura: 4200 });
        d.verTactil();
      },
      /* el comienzo del mundo: el cartel, lo de arriba y las primeras ayudas */
      async empezar(ayudas = []) {
        d.verTactil();
        const i = MUNDOS.indexOf(d.mundo);
        ui.cartel(tr('mundo', i + 1), TX().mundos[d.mundo]);
        for (const k of ayudas) { await j.esperar(3.4); j.ayuda(k); }
      },
      /* tomar el orbe */
      async orbe() {
        j.guion(true);
        await j.hastaQue(() => N.m.p.enSuelo || N.m.p.enAgua);
        N.quieto = true;
        N.orbeTomado = true;
        const s = N.m.salida;
        N.fx.soltar(s.x, s.y - 26, 40, { v: 110, col: '#fff5b8' });
        N.ondas.push({ x: s.x, y: s.y - 26, t: 0, dorada: true });
        Sonido.sfx('orbe');
        N.gestoNick = 'feliz';
        ui.aviso(TX().mundos[d.mundo], { titulo: tr('orbe', TX().orbes[d.mundo] || ''), img: imagen('orbeM' + d.mundo, () => dibOrbe(d.mundo, 0)), clase: 'dorado', dura: 4400 });
        await j.esperar(2.2);
        N.gestoNick = null;
      },
      /* un mensaje sin conexión de Mora (y lo que contesta Nick) */
      async mensaje(id) {
        const L = TX().charlas[id] || [];
        const [quien, texto] = L[0] || ['mora', ''];
        Sonido.sfx('aviso');
        const el = await ui.mensaje(quien, texto);
        await vale(new Promise((listo) => { d.avanzar = () => { d.avanzar = null; listo(); }; }));
        el.classList.remove('ve');
        setTimeout(() => el.remove(), 450);
        if (L.length > 1) await j.charla(null, { lineas: L.slice(1) });
      },
      terminar: () => d.terminarMundo(),
    };
    /* charla(null, { lineas }) usa las líneas que se le dan */
    const charlaId = j.charla;
    j.charla = (id, o = {}) => (id == null ? vale(d.charla(o.lineas, o)) : charlaId(id, o));
    return j;
  }
}
