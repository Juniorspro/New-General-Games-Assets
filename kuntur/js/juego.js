/* ============================================================================
   kuntur/js/juego.js — un capítulo en marcha: arma el diorama de papel, pone
   a Killa, a Apu y a los vecinos, corre la física a 60 por segundo, y cada
   cuadro mueve la cámara, los recortes, el clima y los efectos.
   Lo que pasa (eventos de la física) lo convierte en papelitos, temblores y
   gestos, y se lo pasa al director para el sonido, la historia y la interfaz.
   ========================================================================== */
import * as THREE from 'three';
import { crearMundo, pasarKilla, revivir, empezarEn, DT, NADA, B, baldosa } from './fisica.js';
import { biomaEn } from './biomas.js';
import { armarCarton, armarTeatrito, armarColgantes, pasarColgantes } from './papel.js';
import { Escenario } from './escenario.js';
import { KillaPapel } from './actores.js';
import { Apu, Vecino, Puma, VientoBlanco, Farol, Animal, Volador, pisoBajo } from './figuras.js';
import { LUGAR_ANIMAL } from './escenario.js';
import { DECOR } from './elenco.js';
import { Papelitos, Clima, AGUAYO } from './papelitos.js';
import { PaisajeTren } from './paisaje.js';
import { NIVEL } from './niveles.js';
import { Pantalla } from './pantalla.js';

const suave = (k, dt) => 1 - Math.pow(k, dt);
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

/* colores de lo que salpica cada causa */
const SALPICA = {
  agua: ['#7fd8d0', '#bfeff0', '#ffffff', '#4aa8c8'], pincho: AGUAYO, viga: AGUAYO, puma: AGUAYO, tormenta: ['#ffffff', '#e8f0fc', '#c0d4f0'], caida: AGUAYO,
};

export class Capitulo {
  /* o: { en: {x, y, id}, coplas: [...], habil: {...}, alEvento(e), temblor } */
  constructor(E, cielo, id, o) {
    o = o || {};
    this.E = E; this.cielo = cielo; this.id = id; this.o = o;
    const nivel = this.nivel = NIVEL[id];
    const m = this.m = crearMundo(nivel, { habil: o.habil, coplas: o.coplas });
    if (o.en) empezarEn(m, o.en, o.en.id);
    this.bioK = 0;
    this.bio = biomaEn(nivel.bioma, this.kBioma());
    E.ponerBioma(this.bio); cielo.poner(this.bio);
    const g = this.g = new THREE.Group(); g.name = 'capitulo:' + id;
    E.escena.add(g);
    /* el diorama */
    const car = armarCarton(m, this.bio);
    this.teatrito = nivel.tren ? null : armarTeatrito(this.bio, -20, m.w + 20, car.userData.perfil);
    this.colg = armarColgantes(this.bio, -20, m.w + 20);
    g.add(car, this.colg); if (this.teatrito) g.add(this.teatrito);
    this.esc = new Escenario(g, m, this.bio);
    if (nivel.tren) this.paisaje = new PaisajeTren(g, m, this.bio);
    /* los que actúan */
    this.killa = new KillaPapel(g);
    this.apu = new Apu(g, nivel.edad || 0);
    const modoApu = nivel.apu === 'nada' ? 'nada' : nivel.apu;
    this.apu.poner(modoApu, m.p.x - 1.2, m.p.y + 2.2);
    this.vecinos = {};
    for (const n of m.npcs) this.vecinos[n.id] = new Vecino(g, n.id, n.x, n.y);
    /* los animales del mapa */
    this.animales = [];
    nivel.mapa.forEach((fila, r) => { for (let x = 0; x < fila.length; x++) { const L = LUGAR_ANIMAL[fila[x]]; if (L) this.animales.push(new Animal(g, L[0], x + 0.5, m.h - 1 - r, L[1] - (x % 3) * 0.15, m)); } });
    /* el farol que pasa de mano en mano, para las escenas */
    this.voladores = {};
    this.puma = (nivel.persecuciones || []).some((q) => q.tipo === 'puma') ? new Puma(g) : null;
    this.ventisca = (nivel.persecuciones || []).some((q) => q.tipo === 'tormenta') ? new VientoBlanco(g) : null;
    this.farol = id === 'puna' ? new Farol(g) : null;
    this.pap = new Papelitos(g, m);
    this.clima = new Clima(this.pap, this.bio, m);
    /* la cámara */
    this.ancho = 21; this.anchoMeta = 21;
    this.cam = { x: m.p.x + 2, y: m.p.y + 1.2, mira: 1 };
    this.encuadre = null;      // la historia puede tomar la cámara: { x, y, ancho }
    this.temblor = 0; this.t = 0; this.acum = 0;
    this.entrada = null;       // la historia puede manejar a Killa: función que devuelve la entrada
    this.quieta = false;       // durante las charlas no corre la física
    this.caida = 0;            // el golpe al aterrizar (para el aplastado)
    this.saltoRecien = false;
    this.rayo = 0; this.proxRayo = 3;
    this.pasarCamara(1, true);
  }
  kBioma() {
    const n = this.nivel, p = this.m ? this.m.p : null;
    if (n.bioma !== 'nevado' || !p) return 0;
    /* del Viento Blanco al amanecer: cuando se escapa y sube */
    return lim((p.x - 92) / 24, 0, 1) * 0.6 + lim((p.y - 14) / 26, 0, 1) * 0.4;
  }

  /* ---------------- un paso de física ---------------- */
  paso(inp) {
    const m = this.m;
    if (this.quieta) return;
    const e = this.entrada ? this.entrada(m.p) : this.bloqueo ? NADA : this.guion ? this.guion(m) : inp;
    pasarKilla(m, e || NADA);
    if (m.p.muerta && m.p.tMuerta > 1.25) revivir(m);
    for (const ev of m.eventos) this.alEvento(ev);
    m.eventos.length = 0;
  }
  alEvento(ev) {
    const m = this.m, p = m.p, P = this.pap;
    switch (ev.t) {
      case 'salto': this.saltoRecien = true; P.soltar('polvo', 5, { x: p.x, y: p.y + 0.05, abre: 0.8, col: this.colPolvo(), tam: 0.8 }); break;
      case 'aleteo':
        this.saltoRecien = true; this.apu.aletear();
        P.soltar('pluma', 3, { x: p.x, y: p.y + 1.8, abre: 1.2, col: this.apu.edad > 0.5 ? '#ffffff' : '#c8bcb0' });
        P.soltar('polvo', 6, { x: p.x, y: p.y + 1.2, abre: 1.4, col: '#ffffff', tam: 0.9 });
        break;
      case 'aterriza': {
        this.caida = ev.fuerza || 0;
        if (ev.fuerza > 8) { P.soltar('polvo', 10, { x: p.x, y: p.y + 0.05, abre: 1.6, vy: 0.4, col: this.colPolvo(), tam: 1 }); this.sacudir(Math.min(0.25, ev.fuerza * 0.012)); }
        break;
      }
      case 'empuja': P.soltar('polvo', 2, { x: p.x - p.dir * 0.2, y: p.y + 0.05, abre: 0.4, col: this.colPolvo(), tam: 0.6 }); break;
      case 'cajaCae': P.soltar('polvo', 14, { x: ev.x != null ? ev.x + 0.5 : p.x, y: ev.y != null ? ev.y : p.y, abre: 2, col: this.colPolvo() }); this.sacudir(0.3); break;
      case 'cabezazo': this.sacudir(0.08); break;
      case 'rompe': P.soltar('confeti', 16, { x: ev.x + 0.5, y: ev.y + 0.6, abre: 2, col: ['#bfe4f4', '#e8f6fc', '#ffffff'] }); break;
      case 'cruje': P.soltar('polvo', 4, { x: ev.x + 0.5, y: ev.y + 1, abre: 0.6, col: '#ffffff' }); break;
      case 'apacheta':
        P.soltar('chispa', 30, { x: ev.x, y: ev.y + 0.8, abre: 2.2, sube: 2, col: ['#ffe27a', '#ffffff', '#ffb040'] });
        P.soltar('confeti', 24, { x: ev.x, y: ev.y + 1.2, abre: 2.4, sube: 3, col: AGUAYO });
        break;
      case 'copla':
        P.soltar('chispa', 36, { x: ev.x, y: ev.y, abre: 2.6, col: ['#ffe27a', '#ffffff', '#f2b632'] });
        P.soltar('confeti', 40, { x: ev.x, y: ev.y, abre: 3.2, sube: 3, col: AGUAYO });
        break;
      case 'muere': this.morir(ev.causa); break;
      case 'revive': this.volver(); break;
      case 'apuVa': this.apu.ir(ev.x, ev.y + 0.3); break;
      case 'puerta': this.sacudir(0.1); break;
      case 'escapa': if (ev.tipo === 'puma' && this.puma) this.puma.irse(this.puma.ultimaX || p.x - 8); break;
      case 'persigue': this.sacudir(0.35); break;
    }
    if (this.o.alEvento) this.o.alEvento(ev, this);
  }
  colPolvo() { return this.bio.frente === 'nieve' ? ['#ffffff', '#e8f0fc'] : this.bio.frente === 'sal' ? ['#ffffff', '#f2f0ea'] : [this.bio.tope, '#e8d8b8']; }
  sacudir(f) { if (this.o.temblor !== false) this.temblor = Math.max(this.temblor, f); }
  morir(causa) {
    const p = this.m.p;
    this.killa.caer(causa);
    const col = SALPICA[causa] || AGUAYO;
    this.pap.soltar('confeti', 60, { x: p.x, y: p.y + 0.7, abre: 3.5, sube: 4, col });
    if (causa === 'agua') this.pap.soltar('confeti', 30, { x: p.x, y: p.y + 0.3, vy: 5, abre: 2, col });
    this.sacudir(0.4);
  }
  volver() {
    const p = this.m.p;
    this.killa.volver();
    this.pap.soltar('polvo', 14, { x: p.x, y: p.y + 0.1, abre: 1.4, col: this.colPolvo() });
    this.pap.soltar('confeti', 18, { x: p.x, y: p.y + 1.2, abre: 1.8, sube: 2, col: AGUAYO });
    if (this.apu.modo === 'sigue') this.apu.poner('sigue', p.x - 1.3, p.y + 2.2);
  }

  /* ---------------- la cámara ---------------- */
  pasarCamara(dt, ya) {
    const m = this.m, p = m.p, c = this.cam;
    let tx, ty, ancho;
    const persigue = m.perseguidor && m.perseguidor.activo;
    if (this.encuadre) { tx = this.encuadre.x; ty = this.encuadre.y; ancho = this.encuadre.ancho; }
    else {
      c.mira += ((p.dir || 1) - c.mira) * suave(0.2, dt);
      tx = p.x + c.mira * (persigue ? 3.2 : 2.2);
      ty = p.y + 1.2;
      ancho = persigue ? 25 : this.nivel.id === 'nevado' && p.x > 100 ? 23 : 21;
      /* en lo alto, no seguir cada saltito: solo si se aleja o pisa */
      const dy = ty - c.y;
      if (!p.enSuelo && Math.abs(dy) < 2.2 && p.estado === 'normal') ty = c.y + dy * 0.15;
    }
    /* con el teléfono parado se ve menos de ancho (si no, Killa queda chiquita) */
    if (this.E.aspecto < 1) ancho = Math.max(9, ancho * Math.pow(this.E.aspecto, 0.7));
    this.anchoMeta = ancho;
    this.ancho += (this.anchoMeta - this.ancho) * suave(0.08, dt);
    const alto = this.ancho / this.E.aspecto;
    /* no mostrar afuera del diorama */
    if (!this.encuadre || !this.encuadre.libre) {
      tx = lim(tx, this.ancho / 2 + 0.3, m.w - this.ancho / 2 - 0.3);
      ty = Math.max(ty, alto * 0.42);
    }
    const kx = ya ? 1 : suave(this.encuadre ? 0.12 : 0.02, dt), ky = ya ? 1 : suave(this.encuadre ? 0.12 : 0.05, dt);
    c.x += (tx - c.x) * kx; c.y += (ty - c.y) * ky;
  }
  colocarCamara(t) {
    const E = this.E, c = this.cam;
    const d = E.distancia(this.ancho, this.ancho / 1.9);
    let sx = 0, sy = 0;
    if (this.temblor > 0.001) { sx = (Math.random() - 0.5) * this.temblor; sy = (Math.random() - 0.5) * this.temblor; }
    /* un vaivén de cámara en mano, apenas */
    const vx = Math.sin(t * 0.37) * 0.06, vy = Math.sin(t * 0.29) * 0.04;
    /* la altura de la cámara: un poco arriba, o abajo mirando al cielo en las escenas */
    const alz = this.encuadre && this.encuadre.alzada != null ? this.encuadre.alzada : 2.1;
    this.alzada = this.alzada == null ? alz : this.alzada + (alz - this.alzada) * 0.04;
    E.camara.position.set(c.x + sx + vx, c.y + this.alzada + sy + vy, d);
    E.camara.lookAt(c.x + sx * 0.5, c.y + 0.35 + sy * 0.5, 0);
    E.seguirLuz(c.x, c.y);
  }

  /* ---------------- cada cuadro ---------------- */
  cuadro(real, pasos) {
    const dt = Math.min(0.05, real), m = this.m, p = m.p;
    this.t += dt;
    const t = this.t;
    /* el Nevado va cambiando de la ventisca al amanecer */
    if (this.nivel.bioma === 'nevado') {
      const k = this.kBioma();
      if (Math.abs(k - this.bioK) > 0.01) { this.bioK += (k - this.bioK) * suave(0.2, dt); this.bio = biomaEn('nevado', this.bioK); this.E.ponerBioma(this.bio); this.cielo.poner(this.bio); }
    }
    this.temblor *= Math.pow(0.004, dt);
    /* las franjas de cine en las escenas */
    this.barras = (this.barras || 0) + ((this.bloqueo ? 1 : 0) - (this.barras || 0)) * suave(0.015, dt);
    this.E.u.uBarras.value = this.barras;
    this.pasarCamara(dt);
    this.colocarCamara(t);
    const camX = this.E.camara.position.x;
    /* Killa */
    const hablando = this.hablaKilla;
    this.killa.actualizar(p, { t, dt, aterrizo: this.caida, salto: this.saltoRecien, habla: hablando, quieta: this.quieta });
    this.caida = 0; this.saltoRecien = false;
    this.apu.pasar(dt, t, p, { termica: p.enTermica });
    for (const v of Object.values(this.vecinos)) v.pasar(dt, t, p.x, p.y);
    for (const a of this.animales) a.pasar(dt, t, p, this.cam.x, this.ancho);
    for (const v of Object.values(this.voladores)) v.pasar(dt);
    if (this.puma) this.puma.pasar(dt, t, m);
    if (this.ventisca) {
      this.ventisca.pasar(dt, t, m);
      const q = m.perseguidor;
      const cerca = q && q.activo && q.tipo === 'tormenta' ? lim(1 - (p.x - q.x) / 12, 0, 1) : 0;
      this.E.u.uFrio.value += (cerca - this.E.u.uFrio.value) * suave(0.1, dt);
      if (cerca > 0.6) this.sacudir(0.05 * cerca);
    }
    if (this.farol) this.farol.pasar(dt, t, p);
    /* el escenario y el cielo */
    this.esc.pasar(dt, t, camX, this.ancho, m);
    pasarColgantes(this.colg, t, camX);
    if (this.paisaje) {
      this.paisaje.pasar(dt, t, camX, this.ancho, this.colg);
      const o = this.paisaje.oscuro;
      this.E.luz.intensity = this.bio.luz.int * (1 - 0.85 * o); this.E.hemi.intensity = this.bio.hemi.int * (1 - 0.75 * o);
    }
    this.cielo.pasar(t, this.E.camara);
    this.clima.pasar(dt, t, this.cam, this.ancho, this.ancho / this.E.aspecto);
    this.pap.pasar(dt, t);
    /* la granizada: relámpagos */
    if (this.bio.clima === 'granizo') {
      this.proxRayo -= dt;
      if (this.proxRayo < 0) { this.rayo = 1; this.proxRayo = 4 + Math.random() * 6; if (this.o.alEvento) this.o.alEvento({ t: 'rayo' }, this); }
      this.rayo = Math.max(0, this.rayo - dt * 2.5);
      const r = this.rayo > 0.6 || (this.rayo > 0.25 && this.rayo < 0.4) ? this.rayo : 0;
      this.E.u.uFlash.value = r * 0.35;
      this.cielo.u.uRayo.value = r;
    }
  }
  dibujar() { this.E.dibujar(this.t); }
  /* el farol que le dio Tomás, en la mano (en el tren todavía sin luz: es de día) */
  darFarol() { if (!this.farol) this.farol = new Farol(this.g, true); }
  volador(nombre) {
    if (!this.voladores[nombre]) this.voladores[nombre] = new Volador(this.g, nombre, nombre === 'farol' ? DECOR.farol : DECOR.copla, 0, nombre === 'farol' ? 0.03 : 0.035);
    return this.voladores[nombre];
  }

  /* dónde está algo en la pantalla (para los globitos de charla) */
  aPantalla(v) {
    const q = v.clone().project(this.E.camara);
    return { x: (q.x * 0.5 + 0.5) * Pantalla.w, y: (-q.y * 0.5 + 0.5) * Pantalla.h, adelante: q.z < 1 };
  }
  cabezaDe(quien) {
    const p = this.m.p;
    if (quien === 'killa') return new THREE.Vector3(p.x, p.y + (p.agachada ? 1.0 : 1.55), 0);
    if (quien === 'apu') return this.apu.raiz.position.clone().add(new THREE.Vector3(0, this.apu.modo === 'bulto' ? 0.5 : 0.6, 0));
    const v = this.vecinos[quien];
    return v ? v.cabeza() : new THREE.Vector3(p.x, p.y + 2, 0);
  }

  destruir() {
    this.E.escena.remove(this.g);
    this.g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) for (const mt of [].concat(o.material)) { if (mt.map && mt.map.userData.w == null) mt.map.dispose(); mt.dispose(); }
    });
    this.E.u.uFrio.value = 0; this.E.u.uFlash.value = 0; this.E.u.uBarras.value = 0;
    this.cielo.u.uRayo.value = 0;
  }
}
