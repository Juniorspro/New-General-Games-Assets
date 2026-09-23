/* ============================================================================
   kuntur/js/director.js — el que maneja la función: el idioma, el título, los
   capítulos uno tras otro, las charlas, la pausa, lo guardado y el final.
   La historia (historia.js) le pide cosas: "charlá esto", "esperá a que
   pise", "mové la cámara", "caminá hasta ahí".
   ========================================================================== */
import { Escena } from './escena.js';
import { Cielo } from './cielo.js';
import { Capitulo } from './juego.js';
import { UI, COLOR_DE } from './ui.js';
import { Sonido } from './sonido.js';
import { Entrada } from './entrada.js';
import { DT, NADA, revivir } from './fisica.js';
import { T, tr, Idioma, IDIOMAS } from './textos.js';
import { HISTORIA, ORDEN, siguiente, numeroDe } from './historia.js';
import { NIVEL } from './niveles.js';
import { Pantalla } from './pantalla.js';

const CLAVE = 'kuntur:partida', CLAVE_OP = 'kuntur:opciones';
const leer = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const COLOR_CAP = { prologo: '#6a2f9a', colores: '#c0282e', salinas: '#2a5aa8', tren: '#b8242a', puna: '#1f6f8a', nevado: '#4a6a9a', epilogo: '#e8702a' };
const VOZ = { killa: 1150, abuela: 640, rosa: 880, ceferino: 520, tomas: 600, coquena: 1400, apu: 2000 };

/* las coplas: en qué número empieza cada capítulo */
const BASE_COPLA = {}; let TOTAL_COPLAS = 0;
for (const id of ORDEN) { BASE_COPLA[id] = TOTAL_COPLAS; TOTAL_COPLAS += NIVEL[id].mapa.join('').split('K').length - 1; }
const indiceCopla = (id) => { const [cap, i] = id.split(':'); return (BASE_COPLA[cap] || 0) + (+i); };

export class Director {
  constructor() {
    const tactil = matchMedia('(pointer: coarse)').matches;
    this.op = Object.assign({ musica: 7, efectos: 8, calidad: tactil ? 'baja' : 'media', temblor: true }, leer(CLAVE_OP, {}));
    /* los controles de dedo, como los dejó acomodados el jugador */
    const TA = this.op.tactil || {};
    this.op.tactil = { modo: 'flotante', alfa: 0.85, vib: true, ...TA, pos: { ...(TA.pos || {}) }, tam: { pal: 1, salto: 1, accion: 1, pausa: 1, ...(TA.tam || {}) } };
    Entrada.vibrar = this.op.tactil.vib;
    Pantalla.giro = this.op.giro || 'auto'; Pantalla.sensor();
    this.hayDedos = tactil || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.partida = leer(CLAVE, null);
    const calURL = new URLSearchParams(location.search).get('cal');
    this.E = new Escena(document.getElementById('c'), calURL || this.op.calidad);
    this.cielo = new Cielo(this.E.escena);
    this.ui = new UI(document.getElementById('ui'));
    this.ui.alMover = () => Sonido.sfx('mover');
    this.ui.alNo = () => Sonido.sfx('no');
    this.ui.alHoja = () => Sonido.sfx('hoja');
    this.ui.alLetra = (q) => Sonido.sfx('letra', { f: VOZ[q] || 900 });
    Sonido.volumenes(this.op.musica / 10, this.op.efectos / 10);
    Entrada.teclado({
      ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ArrowUp: 'arr', KeyW: 'arr', ArrowDown: 'aba', KeyS: 'aba',
      Space: ['salto', 'aceptar'], KeyZ: ['salto', 'aceptar'], KeyK: 'salto', KeyX: 'accion', KeyE: 'accion', KeyJ: 'accion',
      Enter: 'aceptar', Escape: ['pausa', 'volver'], KeyP: 'pausa', Backspace: 'volver',
    });
    Entrada.mando({ 0: ['salto', 'aceptar'], 1: ['accion', 'volver'], 2: 'accion', 3: 'accion', 9: 'pausa', 8: 'volver', 12: 'arr', 13: 'aba', 14: 'izq', 15: 'der' });
    Entrada.alUsar = (f) => this.ui.verTactil(f === 'toque' && this.estado === 'juego' && !(this.cap && this.cap.bloqueo));
    /* en el teléfono se arranca con los dedos (si no, pedía teclas y los botones no
       aparecían nunca: se prendían recién al tocarlos). Cualquier toque en la
       pantalla, también en los menús, pasa a dedos; una tecla, a teclado. */
    if (tactil) Entrada.fuente = 'toque';
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') Entrada.usar('toque'); }, true);
    Entrada.aJuego = (x, y) => Pantalla.aJuego(x, y); Entrada.caja = (el) => Pantalla.caja(el);
    this.estado = 'idioma'; this.cap = null; this.portada = null;
    this.esperas = []; this.condiciones = []; this.escuchas = [];
    this.charlaActual = null; this.gritos = []; this.pausado = false; this.acum = 0; this.ult = 0;
    this.toque = false;
    document.getElementById('ui').addEventListener('pointerdown', () => { this.toque = true; });
    document.getElementById('c').addEventListener('pointerdown', () => { this.toque = true; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.estado === 'juego' && !this.pausado && !this.charlaActual && !this.ui.narrando) this.pausar(); });
    window.__K = this; this.Entrada = Entrada;          // para las pruebas
    this._cuadro = (ts) => this.cuadro(ts);
    requestAnimationFrame(this._cuadro);
    this.arrancar();
  }

  /* ============================== el comienzo ============================== */
  arrancar() {
    const l = Idioma.guardado() || Idioma.delNavegador();
    Idioma.poner(l);
    this.ui.idioma(l, async (elegido) => {
      Pantalla.acostar();
      Idioma.poner(elegido);
      Sonido.iniciar();
      Sonido.sfx('elegir');
      Sonido.musica('titulo');
      await this.listaPortada;
      this.titulo(true);
    });
    /* la portada se arma atrás del telón, mientras se elige */
    this.listaPortada = dormir(60).then(() => this.armarPortada());
  }
  armarPortada() {
    if (this.portada) return;
    const P = this.portada = new Capitulo(this.E, this.cielo, 'portada', { temblor: false });
    P.quieta = true;
    const p = P.m.p; p.dir = 1;
    P.encuadre = { x: p.x + 2.5, y: p.y + 2.2, ancho: 17, libre: true };
    P.pasarCamara(1, true);
    P.apu.orbitar(p.x + 0.5, p.y + 4.2, 4.2);
    P.clima.fuerza = 0.6;
    P.tGesto = 3;
  }
  async titulo(abrir) {
    this.estado = 'titulo';
    this.pausado = false; this.hablando = false;
    this.ui.verTactil(false);
    this.ui.sinEtiquetas();
    if (!this.portada) { this.armarPortada(); }
    Sonido.musica('titulo'); Sonido.ambientar(null);
    const P = this.partida, hay = P && P.cap && !P.terminado;
    const ops = [];
    if (hay) { ops.push(['seguir', tr('seguir')]); ops.push(['nuevo', tr('nuevo')]); } else ops.push(['empezar', tr('empezar')]);
    ops.push(['capitulos', tr('capitulos')], ['coplas', tr('coplas')], ['opciones', tr('opciones')], ['creditos', tr('creditos')]);
    let seguro = false;
    this.ui.titulo({
      opciones: ops, i: this.iTitulo || 0,
      elegir: async (k, el) => {
        this.iTitulo = ops.findIndex((o) => o[0] === k);
        Sonido.sfx('elegir');
        if (k === 'nuevo' && !seguro) { seguro = true; this.ui.ponerTextoBoleto(el, tr('nuevoSeguro')); return; }
        /* "Empezar" después de terminar el viaje no borra lo juntado (coplas y capítulos); "Viaje nuevo" sí, y pregunta */
        if (k === 'empezar' || k === 'nuevo') { const guarda = k === 'empezar' && P; this.partida = { cap: 'prologo', en: null, coplas: guarda ? P.coplas || [] : [], llegados: guarda ? P.llegados || ['prologo'] : ['prologo'] }; this.guardar(); this.jugar('prologo', null); }
        else if (k === 'seguir') this.jugar(P.cap, P.en);
        else if (k === 'capitulos') this.verCapitulos();
        else if (k === 'coplas') this.verCoplas();
        else if (k === 'opciones') this.verOpciones(() => this.titulo());
        else if (k === 'creditos') { this.ui.limpiar(); await this.ui.creditos(T().creditos); this.titulo(); }
      },
    });
    if (abrir) { Sonido.sfx('telon'); await this.ui.telon(false); }
  }
  verCapitulos() {
    const lleg = (this.partida && this.partida.llegados) || ['prologo'];
    const lista = ORDEN.map((id, i) => [id, id === 'prologo' ? tr('prologo') : id === 'epilogo' ? tr('epilogo') : tr('capitulo', i), T().capitulos[id]]);
    this.ui.capitulos(lista, lleg, (id) => {
      Sonido.sfx('elegir');
      if (!this.partida) this.partida = { cap: id, en: null, coplas: [], llegados: ['prologo'] };
      this.partida.cap = id; this.partida.en = null; this.partida.terminado = false; this.guardar();
      this.jugar(id, null);
    }, () => this.titulo());
  }
  verCoplas() {
    const hall = new Set(((this.partida && this.partida.coplas) || []).map(indiceCopla));
    this.ui.coplas(T().coplas.slice(0, TOTAL_COPLAS), hall, () => this.titulo());
  }
  verOpciones(alVolver) {
    const o = this.op, barra = (v) => `<span class="barra">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span>`;
    const CAL = ['baja', 'media', 'alta'];
    const filas = [
      { nombre: () => tr('idioma'), valor: () => IDIOMAS.find(([l]) => l === Idioma.actual)[1], cambiar: (d) => { const i = IDIOMAS.findIndex(([l]) => l === Idioma.actual); Idioma.poner(IDIOMAS[(i + d + IDIOMAS.length) % IDIOMAS.length][0]); } },
      { nombre: () => tr('musica'), valor: () => barra(o.musica), cambiar: (d) => { o.musica = d === 1 && o.musica === 10 ? 0 : Math.max(0, Math.min(10, o.musica + d)); Sonido.volumenes(o.musica / 10, o.efectos / 10); } },
      { nombre: () => tr('efectos'), valor: () => barra(o.efectos), cambiar: (d) => { o.efectos = d === 1 && o.efectos === 10 ? 0 : Math.max(0, Math.min(10, o.efectos + d)); Sonido.volumenes(o.musica / 10, o.efectos / 10); Sonido.sfx('salto'); } },
      { nombre: () => tr('calidad'), valor: () => tr(o.calidad), cambiar: (d) => { const i = CAL.indexOf(o.calidad); o.calidad = CAL[(i + d + 3) % 3]; this.E.ponerCalidad(o.calidad); } },
      { nombre: () => tr('temblor'), valor: () => tr(o.temblor ? 'si' : 'no'), cambiar: () => { o.temblor = !o.temblor; } },
      { nombre: () => tr('pantalla'), valor: () => tr(document.fullscreenElement ? 'si' : 'no'), cambiar: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (_) {} } },
    ];
    const GIROS = ['auto', 'normal', 'reves'];
    if (this.hayDedos) filas.push({ nombre: () => tr('giro'), valor: () => tr(Pantalla.giro), cambiar: (d) => { o.giro = GIROS[(GIROS.indexOf(Pantalla.giro) + d + 3) % 3]; Pantalla.ponerGiro(o.giro); } });
    if (this.hayDedos) filas.push({ nombre: () => tr('tactiles'), valor: () => tr('acomodar'), abrir: () => { escribir(CLAVE_OP, this.op); this.editarTactil(alVolver); } });
    this.ui.opciones(filas, () => { escribir(CLAVE_OP, this.op); if (this.cap) this.cap.o.temblor = o.temblor; alVolver(); });
  }
  guardar() { escribir(CLAVE, this.partida); }
  armarTactil() { if (!this.ui.tactil) this.ui.controlesTactiles(() => { if (!this.pausado && !this.charlaActual && !this.ui.narrando) this.pausar(); }, this.op.tactil); }
  /* acomodar los controles de dedo: se guarda con cada cambio, y al terminar vuelve a las opciones */
  editarTactil(alVolver) {
    this.armarTactil();
    Sonido.sfx('hoja');
    this.ui.editarTactil(() => escribir(CLAVE_OP, this.op), () => { Sonido.sfx('elegir'); escribir(CLAVE_OP, this.op); this.verOpciones(alVolver); });
  }

  /* ============================== un capítulo ============================== */
  async jugar(id, en) {
    this.estado = 'cargando';
    this.ui.limpiar(); this.ui.sinEtiquetas();
    this.cerrarGlobos();
    Sonido.sfx('telon');
    await this.ui.telon(true);
    await dormir(40);
    this.cerrarGlobos();
    if (this.portada) { this.portada.destruir(); this.portada = null; }
    if (this.cap) { this.cap.destruir(); this.cap = null; }
    this.esperas = []; this.condiciones = []; this.escuchas = [];
    this.terminando = false; this.finEsperando = false; this.hablados = {}; this.ayudadas = new Set(); this.ultEmpuja = 0;
    this.pausado = false; this.hablando = false; this.zonasEnCurso = {}; this.vidas = 0;
    const H = this.H = HISTORIA[id] || {};
    const P = this.partida;
    this.cap = new Capitulo(this.E, this.cielo, id, {
      en, coplas: P.coplas, farol: !!P.farol, temblor: this.op.temblor,
      alEvento: (e, c) => this.alEvento(e, c),
    });
    this.reanudado = !!en;
    const c = this.cap;
    c.quieta = true;
    c.cuadro(0.016); c.dibujar();
    Sonido.musica(H.musica); Sonido.ambientar(H.ambiente);
    this.estado = 'juego';
    this.ui.verTactil(Entrada.fuente === 'toque');
    this.armarTactil();
    this.ui.verTactil(Entrada.fuente === 'toque');
    Sonido.sfx('telon');
    await this.ui.telon(false);
    if (this.cap !== c) return;
    const n = numeroDe(id);
    const chico = id === 'prologo' ? tr('prologo') : id === 'epilogo' ? tr('epilogo') : tr('capitulo', n);
    this.ui.cartel(chico, T().capitulos[id], COLOR_CAP[id]);
    if (!en) {
      /* el plano de entrada: desde lejos y alto, y después baja hasta Killa */
      const p = c.m.p;
      c.bloqueo = true;
      c.encuadre = { x: p.x + 14, y: p.y + 7, ancho: 36, libre: true, alzada: 5 };
      c.pasarCamara(1, true);
      await dormir(1600);
      if (this.cap !== c) return;
      await this.ui.narrar(T().narra[id] || []);
      if (this.cap !== c) return;
      c.encuadre = null;
      await dormir(700);
      c.bloqueo = false;
      this.ui.verTactil(Entrada.fuente === 'toque');
    } else await dormir(900);
    if (this.cap !== c) return;
    c.quieta = false;
    if (H.empezar) H.empezar(this);
    if (id === 'prologo' && c.m.hechos.has('pichon')) c.apu.poner('bulto');
  }
  async terminarCapitulo() {
    if (this.terminando || !this.cap || this.finEsperando) return;
    const esp = this.H.finEspera && this.zonasEnCurso && this.zonasEnCurso[this.H.finEspera];
    if (esp) {
      const c0 = this.cap;
      this.finEsperando = true; await esp; this.finEsperando = false;
      if (this.cap !== c0 || this.terminando) return;
    }
    this.terminando = true;
    const c = this.cap, id = c.id, H = this.H;
    if (H.terminar) await H.terminar(this);
    const sig = siguiente(id);
    const P = this.partida;
    if (sig) {
      P.cap = sig; P.en = null; P.llegados = Array.from(new Set([...(P.llegados || []), sig]));
      this.guardar();
      this.jugar(sig, null);
    } else {
      /* el final */
      P.terminado = true; P.cap = 'epilogo'; P.en = null; this.guardar();
      this.estado = 'final'; this.pausado = false;
      Sonido.musica('creditos');
      await this.ui.narrar(T().charlas.final || [], { final: true });
      Sonido.sfx('telon');
      await this.ui.telon(true);
      if (this.cap) { this.cap.destruir(); this.cap = null; }
      this.estado = 'creditos';
      await this.ui.creditos(T().creditos);
      this.armarPortada();
      this.titulo(true);
    }
  }
  pausar() {
    if (this.estado !== 'juego' || this.pausado) return;
    this.pausado = true;
    Entrada.soltarTodo();
    this.cerrarGritos();
    const c = this.cap;
    const coplas = (this.partida.coplas || []).length;
    const menu = () => (this.enRaizPausa = true) && this.ui.pausa({
      capitulo: T().capitulos[c.id], coplas, total: TOTAL_COPLAS,
      opciones: [['continuar', tr('continuar')], ['reintentar', tr('reintentar')], ['opciones', tr('opciones')], ['salir', tr('salir')]],
      elegir: async (k) => {
        Sonido.sfx('elegir');
        if (k === 'continuar') { this.ui.limpiar(); this.pausado = false; }
        else if (k === 'reintentar') {
          this.ui.limpiar(); this.pausado = false;
          if (!c.m.p.muerta && !this.charlaActual && !c.quieta && !c.bloqueo && !c.entrada && !this.hablando) { this.ui.pasarHoja().then(() => { if (this.cap === c) revivir(c.m); }); Sonido.sfx('hoja'); }
        } else if (k === 'opciones') { this.enRaizPausa = false; this.verOpciones(menu); }
        else if (k === 'salir') { this.pausado = false; this.salirAlTitulo(); }
      },
    });
    menu();
  }
  async salirAlTitulo() {
    this.estado = 'cargando';
    this.ui.foco = null;
    this.cerrarGlobos();
    Sonido.sfx('telon');
    await this.ui.telon(true);
    if (this.cap) { this.cap.destruir(); this.cap = null; }
    this.ui.limpiar();
    this.armarPortada();
    this.titulo(true);
  }

  /* ============================== lo que pasa ============================== */
  alEvento(e, c) {
    if (c !== this.cap) return;
    const p = c.m.p, sal = c.bio.frente === 'sal', nieve = c.bio.frente === 'nieve';
    switch (e.t) {
      case 'salto': Sonido.sfx('salto'); break;
      case 'aleteo': Sonido.sfx('aleteo', { grande: c.apu.edad > 0.5 }); break;
      case 'aterriza': Sonido.sfx('aterriza', { fuerza: e.fuerza }); break;
      case 'apacheta':
        Sonido.sfx('apacheta'); this.ui.aviso(tr('apacheta'));
        this.partida.en = { x: e.x, y: e.y, id: e.id }; this.partida.cap = c.id; this.guardar();
        break;
      case 'copla': {
        Sonido.sfx('copla');
        if (Entrada.fuente === 'toque') Entrada.zumbar([15, 40, 15, 40, 30]);
        const P = this.partida; P.coplas = Array.from(new Set([...(P.coplas || []), e.id])); this.guardar();
        const i = indiceCopla(e.id);
        this.ui.copla(T().coplas[i] || [], P.coplas.length, TOTAL_COPLAS);
        break;
      }
      case 'muere':
        this.vidas = (this.vidas || 0) + 1; this.escuchas = [];
        Sonido.sfx('muere');
        if (Entrada.fuente === 'toque') Entrada.zumbar([40, 50, 90]);
        this.cerrarGritos();
        this.esperar(0.72).then(() => { if (this.cap === c) { this.ui.pasarHoja(); Sonido.sfx('hoja'); } });
        break;
      case 'revive': Sonido.sfx('revive'); break;
      case 'habla': this.hablarCon(e.id); break;
      case 'zona': {
        const z = this.H.zonas && this.H.zonas[e.id];
        if (z) { const pr = Promise.resolve(z(this)); this.zonasEnCurso[e.id] = pr; pr.then(() => { if (this.zonasEnCurso[e.id] === pr) delete this.zonasEnCurso[e.id]; }); }
        break;
      }
      case 'fin': if (!this.H.finPorGuion) this.terminarCapitulo(); break;
      case 'puerta': Sonido.sfx('puerta'); break;
      case 'palanca': Sonido.sfx('palanca'); break;
      case 'apuVa': Sonido.sfx('aleteo', { grande: true }); break;
      case 'rafaga': Sonido.sfx('rafaga'); break;
      case 'rompe': Sonido.sfx('rompe'); break;
      case 'cruje': Sonido.sfx('cruje'); break;
      case 'cajaCae': Sonido.sfx('cajaCae'); break;
      case 'termica': Sonido.sfx('termica'); break;
      case 'planeo': Sonido.sfx('planeo'); break;
      case 'trepa': Sonido.sfx('trepa'); break;
      case 'cuelga': Sonido.sfx('cuelga'); break;
      case 'peldano': Sonido.sfx('peldano'); break;
      case 'empuja': if (c.t - this.ultEmpuja > 0.28) { this.ultEmpuja = c.t; Sonido.sfx('empuja'); } break;
      case 'rayo': Sonido.sfx('trueno'); break;
      case 'persigue': if (e.tipo === 'tormenta') Sonido.musica('tormenta'); break;
      case 'escapa': if (e.tipo === 'puma') Sonido.musica('puna'); break;
    }
    const ev = this.H.eventos && this.H.eventos[e.t];
    if (ev) ev(this, e);
    /* los que esperaban este evento */
    this.escuchas = this.escuchas.filter((q) => { if (q.tipo === e.t) { q.r(e); return false; } return true; });
    /* los pasos */
    void p; void sal; void nieve;
  }
  hablarCon(id) {
    if (this.charlaActual || this.cap.quieta || this.hablando || this.sinVecinos) return;
    const lista = (this.H.hablar || {})[id];
    if (!lista) return;
    const v = this.cap.vecinos[id];
    if (v && v.visible === false) return;
    const n = this.hablados[id] || 0;
    this.hablados[id] = n + 1;
    if (v) v.saltito();
    const c = this.cap, p = c.m.p, clave = lista[Math.min(n, lista.length - 1)];
    /* si quedó encima del vecino, da un pasito atrás para verse las caras */
    if (v && Math.abs(p.x - v.x) < 1.15) {
      const lado = p.x < v.x ? -1 : 1;
      this.hablando = true;
      this.caminarA(v.x + lado * 1.3).then(() => { p.dir = -lado; this.hablando = false; this.charla(clave); });
      return;
    }
    if (v) p.dir = p.x < v.x ? 1 : -1;
    this.charla(clave);
  }

  /* ============================== lo que la historia usa ============================== */
  charla(clave, o) {
    o = o || {};
    const todas = T().charlas[clave] || [];
    const lineas = todas.slice(o.desde || 0, o.hasta == null ? todas.length : o.hasta);
    const c = this.cap;
    if (!lineas.length || !c || (this.terminando && !o.alTerminar)) return Promise.resolve();
    if (this.charlaActual) return new Promise((r) => { this.condiciones.push({ fn: () => !this.charlaActual, r: () => this.charla(clave, o).then(r) }); });
    this.cerrarGritos();
    return new Promise((listo) => {
      const C = this.charlaActual = { lineas, i: -1, listo, globo: null, quietaAntes: c.quieta, encuadre: c.encuadre, cap: c, clave, desde: o.desde || 0 };
      c.quieta = true;
      Entrada.soltarTodo();
      for (const [q] of lineas) if (c.vecinos[q]) c.vecinos[q].enCharla = true;
      /* si nadie tomó la cámara, se acerca a los que hablan */
      if (!c.encuadre) {
        const p = c.m.p, xs = [p.x];
        for (const [q] of lineas) if (c.vecinos[q]) xs.push(c.vecinos[q].x);
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        c.encuadre = { x: (x0 + x1) / 2 + 0.5, y: p.y + 1.7, ancho: Math.max(12, (x1 - x0) + 8), auto: true };
      }
      this.siguienteLinea();
    });
  }
  siguienteLinea() {
    const C = this.charlaActual, c = C.cap;
    if (C.globo) C.globo.cerrar();
    for (const v of Object.values(c.vecinos)) v.habla = false;
    c.hablaKilla = false;
    C.i++;
    if (C.i >= C.lineas.length) {
      this.charlaActual = null;
      for (const v of Object.values(c.vecinos)) v.enCharla = false;
      if (c.encuadre && c.encuadre.auto) c.encuadre = C.encuadre;
      c.quieta = C.quietaAntes;
      C.listo();
      return;
    }
    const [quien, texto] = C.lineas[C.i];
    C.globo = this.ui.globo(quien, T().nombres[quien] || quien, texto);
    C.globo.quien = quien;
    if (c.vecinos[quien]) c.vecinos[quien].habla = true;
    if (quien === 'killa') c.hablaKilla = true;
    /* los gestos de cada línea (historia.js › gestos), y el que escucha asiente a veces */
    const G = (this.H.gestos || {})[C.clave], g = G && G[C.desde + C.i];
    if (g) for (const [q, anim, seg] of (Array.isArray(g[0]) ? g : [g])) this.gesto(q, anim, seg);
    else if (Math.random() < 0.4) {
      const oyente = quien === 'killa' ? C.lineas.map((l) => l[0]).find((q) => c.vecinos[q]) : 'killa';
      if (oyente) setTimeout(() => { if (this.charlaActual === C) this.gesto(oyente, 'asiente', 0.6); }, 500);
    }
    const conGestoApu = g && (Array.isArray(g[0]) ? g : [g]).some((q) => q[0] === 'apu');
    if (quien === 'apu' && !conGestoApu) { c.apu.aletear(); Sonido.sfx('pio', { grande: c.apu.edad > 0.5 }); }
    Sonido.sfx('mover');
  }
  grito(clave, desde) {
    const todas = T().charlas[clave] || [];
    const lineas = todas.slice(desde || 0);
    let t = 0;
    for (const [quien, texto] of lineas) {
      this.gritos.push({ quien, texto, t0: t, dur: 1.5 + texto.length * 0.045, globo: null });
      t += 1.6 + texto.length * 0.045;
    }
    this.gritoT = 0;
  }
  cerrarGritos() { for (const g of this.gritos) if (g.globo) g.globo.cerrar(); this.gritos = []; }
  cerrarGlobos() { this.cerrarGritos(); if (this.charlaActual) { if (this.charlaActual.globo) this.charlaActual.globo.cerrar(); this.charlaActual = null; } }
  ayuda(clave) {
    if (this.ayudadas.has(clave)) return;
    this.ayudadas.add(clave);
    const a = T().ayudas[clave]; if (!a) return;
    this.ui.ayuda(Entrada.fuente === 'toque' ? a[1] : a[0]);
  }
  esperar(s) { return new Promise((r) => this.esperas.push({ t: (this.cap ? this.cap.t : 0) + s, r, cap: this.cap })); }
  cuando(fn) { return new Promise((r) => this.condiciones.push({ fn, r })); }
  /* resuelve true al pisar, o false si Killa se apagó mientras tanto (el script tiene que cortar) */
  enSuelo() {
    const c = this.cap, vida = this.vidas;
    let murio = false;
    return this.cuando(() => { if (this.vidas !== vida || this.cap !== c) { murio = true; return true; } const p = c.m.p; return p.enSuelo && p.estado === 'normal' && !p.muerta; }).then(() => !murio);
  }
  evento(tipo) { return new Promise((r) => this.escuchas.push({ tipo, r })); }
  caminarA(x) {
    const c = this.cap;
    c.quieta = false;
    c.entrada = (p) => ({ x: Math.abs(x - p.x) > 0.12 ? Math.sign(x - p.x) : 0, y: 0, salto: false, saltoE: false, accion: false, accionE: false });
    return this.cuando(() => Math.abs(c.m.p.x - x) <= 0.12 || c.m.p.muerta).then(() => { c.entrada = null; c.m.p.vx = 0; if (c.bloqueo) c.quieta = true; });
  }
  telon(cerrar) { Sonido.sfx('telon'); return this.ui.telon(cerrar); }
  /* ---------------- las cinemáticas ---------------- */
  cine(on) {
    const c = this.cap; if (!c) return;
    if (this.alCine) this.alCine(on, c);
    c.bloqueo = !!on;
    /* en la escena el mundo se queda quieto (las vigas del tren no pasan, el viento no sopla) */
    c.quieta = !!on;
    this.ui.verTactil(!on && Entrada.fuente === 'toque');
    if (on) { this.ui.sinEtiquetas(); Entrada.soltarTodo(); this.ui.esconderNota(); }
  }
  /* un gesto: quien = 'killa', 'apu' o un vecino */
  gesto(quien, anim, seg) {
    const c = this.cap; if (!c) return Promise.resolve();
    if (quien === 'killa') { c.killa.hacer(anim, seg); return seg === Infinity ? Promise.resolve() : this.esperar(seg == null ? 1.2 : seg); }
    if (quien === 'apu') { c.apu.aletear(); Sonido.sfx('pio', { grande: c.apu.edad > 0.5 }); return this.esperar(0.5); }
    const v = c.vecinos[quien];
    if (!v || (v.accion && v.accion.t > 1e5)) return Promise.resolve();
    return v.hacer(anim, seg);
  }
  caminarVecino(quien, x, vel) { const v = this.cap && this.cap.vecinos[quien]; return v ? v.caminarA(x, vel) : Promise.resolve(); }
  mirar(quien, dir) { const c = this.cap; if (!c) return; if (quien === 'killa') c.m.p.dir = dir; else if (c.vecinos[quien]) c.vecinos[quien].mirar(dir); }
  lanzar(nombre, desde, hasta, dur, alto) { return this.cap.volador(nombre).lanzar(desde, hasta, dur, alto); }
  /* mover la cámara de a poco hasta un encuadre */
  viajar(meta, seg) {
    const c = this.cap, cam = c.cam, a = { x: cam.x, y: cam.y, ancho: c.ancho };
    let t = 0;
    const paso = () => {
      t += this.dtReal || 1 / 60; const k = Math.min(1, t / seg), e = k * k * (3 - 2 * k);
      c.encuadre = Object.assign({}, meta, { x: a.x + (meta.x - a.x) * e, y: a.y + (meta.y - a.y) * e, ancho: a.ancho + (meta.ancho - a.ancho) * e });
      return k >= 1;
    };
    return this.cuando(paso);
  }
  musica(n) { Sonido.musica(n); }
  ambiente(n) { Sonido.ambientar(n); }
  sfx(n, o) { Sonido.sfx(n, o); }
  dar(que) { if (que === 'farol') { this.partida.farol = true; this.guardar(); } }

  /* ============================== cada cuadro ============================== */
  pasarHistoria() {
    const c = this.cap;
    const ahora = c.t;
    this.esperas = this.esperas.filter((q) => { if (q.cap !== c) return false; if (ahora >= q.t) { q.r(); return false; } return true; });
    this.condiciones = this.condiciones.filter((q) => { let ok = false; try { ok = q.fn(); } catch (_) { ok = true; } if (ok) { q.r(); return false; } return true; });
    const p = c.m.p;
    if (this.H.ayudas && !this.charlaActual && !c.bloqueo) for (const [x, k] of this.H.ayudas) if (p.x >= x && !this.ayudadas.has(k)) this.ayuda(k);
  }
  pasarGlobos(dt) {
    const c = this.cap;
    const C = this.charlaActual;
    if (C && C.globo) {
      C.globo.escribir(dt);
      const s = c.aPantalla(c.cabezaDe(C.globo.quien));
      C.globo.poner(s.x, s.y);
    }
    if (this.gritos.length && !C) {
      this.gritoT += dt;
      for (const g of this.gritos) {
        if (!g.globo && this.gritoT >= g.t0) { g.globo = this.ui.globo(g.quien, T().nombres[g.quien] || g.quien, g.texto, { grito: true }); if (g.quien === 'apu') Sonido.sfx('pio', { grande: c.apu.edad > 0.5 }); }
        if (g.globo) {
          g.globo.escribir(dt);
          const s = c.aPantalla(c.cabezaDe(g.quien)); g.globo.poner(s.x, s.y);
          if (this.gritoT > g.t0 + g.dur) { g.globo.cerrar(); g.fin = true; }
        }
      }
      this.gritos = this.gritos.filter((g) => !g.fin);
    }
  }
  pasarEtiquetas() {
    const c = this.cap, m = c.m, ui = this.ui;
    if (this.charlaActual || c.quieta || m.p.muerta) { ui.sinEtiquetas(); return; }
    const tecla = Entrada.fuente === 'toque' ? '✋' : Entrada.fuente === 'mando' ? 'B' : 'X';
    const k = `<kbd>${tecla}</kbd>`;
    for (const n of m.npcs) {
      const v = c.vecinos[n.id];
      const ve = n.cerca && v && v.visible && (this.H.hablar || {})[n.id];
      if (ve) { const s = c.aPantalla(v.cabeza()); ui.etiqueta('n' + n.id, k + tr('hablar'), s.x, s.y); } else ui.etiqueta('n' + n.id, null);
    }
    m.palancas.forEach((l, i) => {
      const ve = l.cerca && !l.tirada;
      if (ve) { const s = c.aPantalla(c.cabezaDe('killa').setY(l.tipo === 'palanca' ? l.y + 1.2 : m.p.y + 2)); ui.etiqueta('l' + i, k + (l.tipo === 'palanca' ? tr('abrir') : tr('llamarApu')), s.x, s.y); }
      else ui.etiqueta('l' + i, null);
    });
    /* agarrar la piedra */
    const p = m.p;
    const cerca = p.estado === 'normal' && p.enSuelo && m.cajas.some((b) => Math.abs(b.y - p.y) < 0.3 && Math.abs(b.x + 0.5 - p.x) < 0.95 && Math.sign(b.x + 0.5 - p.x) === p.dir);
    if (cerca && !this.ayudadas.has('agarroUna')) { const s = c.aPantalla(c.cabezaDe('killa').add({ x: 0, y: 0.5, z: 0 })); ui.etiqueta('caja', k + tr('agarrar'), s.x, s.y); }
    else ui.etiqueta('caja', null);
    if (p.estado === 'agarrado') this.ayudadas.add('agarroUna');
  }

  cuadro(ts) {
    requestAnimationFrame(this._cuadro);
    const real = this.ult ? Math.min(0.1, (ts - this.ult) / 1000) : DT;
    this.ult = ts;
    if (this.congelado) return;
    this.logica(real);
    this.pintar();
  }
  /* para las pruebas: avanzar el juego sin dibujar */
  simular(seg, paso) { paso = paso || 1 / 30; for (let t = 0; t < seg; t += paso) this.logica(paso); this.pintar(); }
  logica(real) {
    this.dtReal = Math.min(0.1, real);
    Entrada.leerMando();
    const E = Entrada.EDGE;
    if (this.toque) { E.aceptarToque = true; this.toque = false; }
    Sonido.pasar();
    const avanza = E.salto || E.aceptar || E.accion || E.aceptarToque;
    const juega = this.estado === 'juego' && this.cap;
    if (this.ui.narrando) { if (avanza) { this.ui.narrando(); E.salto = E.aceptar = E.accion = false; } }
    else if (juega) {
      /* Esc manda 'pausa' y 'volver' juntos: al abrir la pausa, el 'volver' no la tiene que cerrar.
         En Opciones o en el editor de dedos, Esc vuelve un paso (y guarda), no cierra todo. */
      if (E.pausa) {
        E.pausa = false;
        if (this.pausado) { if (this.enRaizPausa) { this.ui.limpiar(); this.pausado = false; E.volver = false; } }
        else if (!this.charlaActual && !this.ui.narrando) { this.pausar(); E.volver = false; }
      }
      if (this.pausado) this.ui.pasar(E);
      else if (this.charlaActual) {
        const C = this.charlaActual;
        if (avanza) { if (!C.globo.listo) C.globo.completar(); else this.siguienteLinea(); E.salto = E.aceptar = E.accion = false; }
      }
    } else this.ui.pasar(E);
    E.aceptarToque = false;
    this.jugo = false;
    if (juega && !this.pausado) {
      const c = this.cap;
      this.acum += real;
      let n = 0;
      while (this.acum >= DT && n < 6) {
        this.acum -= DT;
        c.paso(this.charlaActual ? NADA : Entrada.leer());
        Entrada.fin();
        n++;
      }
      if (n >= 6) this.acum = 0;
      if (this.cap === c) {
        c.cuadro(real);
        this.pasarPasos(c);
        this.pasarHistoria();
        this.pasarGlobos(real);
        this.pasarEtiquetas();
        this.jugo = true;
      }
      E.aceptar = E.volver = E.arr = E.aba = false;
    } else {
      if (this.portada) {
        const P = this.portada;
        /* en la portada Killa le hace señas a Apu, que da vueltas arriba */
        P.tGesto -= real;
        if (P.tGesto < 0) { P.tGesto = 5 + Math.random() * 4; P.killa.hacer(['saluda', 'senala', 'levanta'][Math.floor(Math.random() * 3)], 1.8); }
        P.cuadro(real);
      }
      Entrada.fin();
    }
  }
  pintar() {
    if (this.jugo && this.cap) this.cap.dibujar();
    else if (this.portada) this.portada.dibujar();
    else if (this.cap) this.cap.dibujar();
  }
  /* los pasitos de papel al correr */
  pasarPasos(c) {
    const k = c.killa;
    if (k.anim === 'corre' || k.anim === 'gatea') {
      const f = k.cuadro % (k.anim === 'corre' ? 4 : 2);
      if (f !== this.pasoAnt && f === 0) Sonido.sfx('paso', { nieve: c.bio.frente === 'nieve', sal: c.bio.frente === 'sal' });
      this.pasoAnt = f;
    } else this.pasoAnt = -1;
  }
}
