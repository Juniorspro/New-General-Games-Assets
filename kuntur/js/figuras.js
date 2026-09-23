/* ============================================================================
   kuntur/js/figuras.js — los recortes que se mueven además de Killa.
   - Apu: pichón asomado del atado, después cóndor de papel con las alas
     aparte, colgadas del hombro, que se baten de verdad (y se inclinan hacia
     la cámara para que se note que son hojas en 3D).
   - Los vecinos que hablan: se dan vuelta como una hoja para mirar a Killa.
   - El puma que la corre por la Puna y el Viento Blanco del Nevado.
   ========================================================================== */
import * as THREE from 'three';
import { hojaRecortada, granoPapel } from './papel.js';
import { texDe } from './escenario.js';
import { ELENCO, ANIMALES, APU, DECOR, ANIM_GENTE, TAREA } from './elenco.js';
import { B, baldosa } from './fisica.js';
import { hash } from './azar.js';

const suave = (k, dt) => 1 - Math.pow(k, dt);
function ponerTex(h, tex) {
  if (h.material.map === tex) return;
  h.material.map = tex; h.material.needsUpdate = true;
  if (h.customDepthMaterial) { h.customDepthMaterial.map = tex; h.customDepthMaterial.needsUpdate = true; }
}
/* una hoja con uno de los dibujos de una función (se cachea cada uno) */
function hojaDe(nombre, fn, arg, mpx, o) {
  const { tex } = texDe(nombre, fn, arg), u = tex.userData;
  const h = hojaRecortada(tex, u.w * mpx, u.h * mpx, Object.assign({ oy: -u.m * mpx }, o || {}));
  h.userData.u = u; h.userData.mpx = mpx;
  return h;
}
/* el suelo que hay debajo de (x, y): para los que caminan sin física */
export function pisoBajo(m, x, y) {
  const tx = Math.floor(x);
  let ty = Math.min(m.h - 1, Math.floor(y));
  while (ty >= 0) { const b = baldosa(m, tx, ty); if (b === B.SOLIDO || b === B.HIELO || b === B.PLAT || b === B.ROMPE) return ty + (b === B.PLAT ? 0.9 : 1); ty--; }
  return 0;
}
/* girar como una hoja: de 0 a PI por el camino corto */
function girar(actual, dir, dt, rapido) {
  const meta = dir > 0 ? 0 : Math.PI;
  return actual + (meta - actual) * suave(rapido || 0.0005, dt);
}

/* ============================================================================
   LOS VECINOS: nunca quietos del todo. Cada uno tiene su tarea (la abuela
   teje, don Ceferino pica sal, Tomás palea carbón, Coquena flota); cuando
   Killa se acerca la dejan, se dan vuelta y la saludan; al hablar mueven las
   manos; en las escenas caminan, señalan, asienten y abrazan.
   ========================================================================== */
export class Vecino {
  constructor(padre, id, x, y) {
    this.id = id; this.fn = ELENCO[id] || ELENCO.abuela;
    this.mpx = id === 'coquena' ? 0.045 : 0.038;
    this.hoja = hojaDe(id, this.fn, 'quieto:0', this.mpx);
    this.piv = new THREE.Group(); this.piv.add(this.hoja);
    this.raiz = new THREE.Group(); this.raiz.add(this.piv);
    this.raiz.position.set(x, y, -0.25);
    padre.add(this.raiz);
    this.yaw = 0; this.dir = 1; this.habla = false; this.brinco = 0; this.x = x; this.y = y; this.x0 = x;
    this.visible = true; this.aparece = 1;
    this.tarea = TAREA[id] || 'quieto';
    this.anim = this.tarea; this.fa = Math.random() * 4; this.clave = '';
    this.accion = null;          // un gesto pedido por la escena: { anim, t, listo }
    this.meta = null;            // adónde camina: { x, vel, listo }
    this.forzado = null;         // para dónde mira en una escena
    this.cerca = false; this.saludo = 0; this.tLejos = 0;
    /* se imprimen todos sus cuadros de una vez, así no traba al cambiar */
    for (const [n, [c]] of Object.entries(ANIM_GENTE)) {
      if (id === 'coquena' ? !['quieto', 'habla', 'saluda', 'flota', 'baston'].includes(n) : ['flota', 'baston'].includes(n)) continue;
      for (let f = 0; f < c; f++) texDe(id, this.fn, n + ':' + f);
    }
  }
  saltito() { this.brinco = 0.28; }
  mostrar(v) { this.visible = v; if (v) { this.aparece = 0; this.raiz.visible = true; } }
  /* para las escenas: un gesto que dura seg (devuelve una promesa) */
  hacer(anim, seg) {
    if (this.accion && this.accion.listo) this.accion.listo();
    return new Promise((r) => { this.accion = { anim, t: seg == null ? ANIM_GENTE[anim][0] / ANIM_GENTE[anim][1] : seg, listo: r }; this.fa = 0; });
  }
  caminarA(x, vel) { return new Promise((r) => { this.meta = { x, vel: vel || 1.4, listo: r }; }); }
  mirar(dir) { this.forzado = dir; }
  pasar(dt, t, kx, ky) {
    if (!this.visible) { this.raiz.visible = false; return; }
    this.raiz.visible = true;
    const dx = kx - this.x, cerca = Math.abs(dx) < 3.2 && Math.abs((ky || this.y) - this.y) < 3;
    /* qué hace ahora */
    let anim, dir = this.dir;
    if (this.meta) {
      const d = this.meta.x - this.x;
      if (Math.abs(d) < 0.05) { const r = this.meta.listo; this.meta = null; r(); }
      else { this.x += Math.sign(d) * Math.min(Math.abs(d), this.meta.vel * dt); dir = Math.sign(d); anim = 'camina'; }
    }
    if (!anim && this.accion) {
      this.accion.t -= dt; anim = this.accion.anim;
      if (this.accion.t <= 0) { const r = this.accion.listo; this.accion = null; r(); }
    }
    if (!anim && this.habla) anim = 'habla';
    if (!anim && this.enCharla) anim = 'quieto';
    if (!anim) {
      /* Killa llega: deja la tarea, se da vuelta y la saluda una vez */
      if (cerca && !this.cerca) { this.saludo = ANIM_GENTE.saluda[0] / ANIM_GENTE.saluda[1] * 2; this.fa = 0; }
      if (!cerca) this.tLejos += dt; else this.tLejos = 0;
      this.cerca = cerca;
      if (this.saludo > 0) { this.saludo -= dt; anim = 'saluda'; }
      else anim = cerca || this.tLejos < 1.5 ? 'quieto' : this.tarea;
    }
    if (!this.meta) dir = this.forzado || (anim === this.tarea && this.tarea !== 'quieto' ? this.dir : (Math.abs(dx) < 9 ? (dx < -0.2 ? -1 : 1) : this.dir));
    this.dir = dir;
    this.yaw = girar(this.yaw, dir, dt, 0.004);
    this.piv.rotation.y = this.yaw;
    /* el cuadro */
    if (anim !== this.anim) { this.anim = anim; this.fa = 0; }
    const [n, fps] = ANIM_GENTE[anim] || ANIM_GENTE.quieto;
    this.fa += dt * fps;
    const clave = anim + ':' + (Math.floor(this.fa) % n);
    if (clave !== this.clave) { this.clave = clave; ponerTex(this.hoja, texDe(this.id, this.fn, clave).tex); }
    this.brinco = Math.max(0, this.brinco - dt);
    const b = this.brinco > 0 ? Math.sin((this.brinco / 0.28) * Math.PI) * 0.25 : 0;
    /* respira, y al hablar se estira un poquito */
    this.piv.scale.y = 1 + Math.sin(t * 2.1 + this.x0) * 0.012 + (anim === 'habla' ? Math.abs(Math.sin(t * 13)) * 0.02 : 0);
    this.piv.position.y = b;
    this.piv.rotation.z = anim === 'camina' ? Math.sin(this.fa * Math.PI / 3) * 0.03 : 0;
    this.raiz.position.set(this.x, this.y, -0.25);
    /* aparecer: se para como las figuras del libro desplegable */
    if (this.aparece < 1) {
      this.aparece = Math.min(1, this.aparece + dt / 0.5);
      const k = this.aparece, e = 1 - Math.pow(1 - k, 3) * Math.cos(k * 7);
      this.hoja.rotation.x = -Math.PI / 2 * (1 - e);
    } else this.hoja.rotation.x = 0;
    if (this.id === 'coquena') this.piv.position.y = b + 0.15 + Math.sin(t * 1.6) * 0.08;
  }
  /* la altura de la cabeza, para el globito */
  cabeza() { return new THREE.Vector3(this.x, this.y + (this.id === 'coquena' ? 1.3 : 1.65), 0); }
}

/* ============================================================================
   LOS ANIMALES: llamas que caminan y rumian, vicuñas que pastan y disparan si
   Killa se acerca, flamencos que picotean el agua.
   ========================================================================== */
const TIPO_ANIMAL = {
  llama: { mpx: 0.05, vel: 0.7, rango: 2.5, huye: 0, fpsQ: 0.9, fpsC: 5 },
  vicuna: { mpx: 0.05, vel: 1.1, rango: 3, huye: 5.5, fpsQ: 0.7, fpsC: 9 },
  flamenco: { mpx: 0.045, vel: 0.35, rango: 0.6, huye: 0, fpsQ: 1.1, fpsC: 3 },
};
export class Animal {
  constructor(padre, tipo, x, y, z, m) {
    this.tipo = tipo; this.T = TIPO_ANIMAL[tipo]; this.fn = ANIMALES[tipo]; this.m = m;
    for (let f = 0; f < 6; f++) texDe(tipo, this.fn, f);
    this.hoja = hojaDe(tipo, this.fn, 0, this.T.mpx);
    this.piv = new THREE.Group(); this.piv.add(this.hoja);
    this.raiz = new THREE.Group(); this.raiz.add(this.piv); padre.add(this.raiz);
    this.x = x; this.x0 = x; this.y = y; this.z = z;
    this.dir = hash(Math.round(x), 3, 9) < 0.5 ? -1 : 1; this.yaw = this.dir > 0 ? 0 : Math.PI;
    this.estado = 'quieto'; this.t = 1 + hash(Math.round(x), 4, 9) * 3; this.meta = x; this.fa = 0; this.f = -1;
    this.pop = -1; this.raiz.visible = false; this.hoja.rotation.x = -Math.PI / 2;
  }
  /* ¿se puede pisar ahí? (mismo suelo que en casa, para no tirarse de un borde) */
  pisable(x) { return Math.abs(pisoBajo(this.m, x, this.y + 1) - this.y) < 0.3 && Math.abs(pisoBajo(this.m, x + 0.6 * Math.sign(x - this.x || 1), this.y + 1) - this.y) < 0.3; }
  pasar(dt, t, p, camX, ancho) {
    /* aparece como los decorados, cuando la cámara se acerca */
    if (this.pop < 0 && Math.abs(this.x - camX) < ancho / 2 + 3) this.pop = 0;
    if (this.pop >= 0 && this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt / 0.45); this.raiz.visible = true;
      const k = this.pop, e = 1 - Math.pow(1 - k, 3) * Math.cos(k * 7);
      this.hoja.rotation.x = -Math.PI / 2 * (1 - e);
    }
    if (this.pop < 0) return;
    const T = this.T, dK = p.x - this.x;
    this.t -= dt;
    /* la vicuña se asusta */
    if (T.huye && this.estado !== 'huye' && Math.abs(dK) < 3.2 && Math.abs(p.y - this.y) < 2.5) {
      const d = -Math.sign(dK) || 1, x = this.x + d * 5;
      if (this.pisable(this.x + d * 0.8)) { this.estado = 'huye'; this.meta = x; this.t = 2.2; }
    }
    if (this.estado === 'quieto' && this.t <= 0) {
      /* elige adónde ir, sin alejarse de su lugar */
      const x = this.x0 + (hash(Math.round(t * 7), Math.round(this.x0), 5) - 0.5) * 2 * T.rango;
      this.meta = x; this.estado = 'camina'; this.t = 6;
    }
    if (this.estado !== 'quieto') {
      const d = this.meta - this.x, vel = this.estado === 'huye' ? T.huye : T.vel;
      const paso = Math.sign(d) * Math.min(Math.abs(d), vel * dt);
      if (Math.abs(d) < 0.05 || this.t <= 0 || !this.pisable(this.x + paso * 4)) { this.estado = 'quieto'; this.t = 1.5 + hash(Math.round(t * 3), Math.round(this.x0), 6) * 4; }
      else { this.x += paso; this.dir = Math.sign(d); }
    }
    /* el cuadro: 0-1 quieto, 2-5 caminando */
    const anda = this.estado !== 'quieto';
    this.fa += dt * (anda ? (this.estado === 'huye' ? T.fpsC * 1.6 : T.fpsC) : T.fpsQ);
    const f = anda ? 2 + Math.floor(this.fa) % 4 : Math.floor(this.fa) % 2;
    if (f !== this.f) { this.f = f; ponerTex(this.hoja, texDe(this.tipo, this.fn, f).tex); }
    this.yaw = girar(this.yaw, this.dir, dt, 0.003);
    this.piv.rotation.y = this.yaw;
    this.piv.rotation.z = anda ? Math.sin(this.fa * Math.PI / 2) * 0.04 : 0;
    this.raiz.position.set(this.x, this.y, this.z);
  }
}

/* un recorte que vuela de una mano a otra (el farol que da Tomás, la cinta de mamá) */
export class Volador {
  constructor(padre, nombre, fn, arg, mpx) {
    this.hoja = hojaDe(nombre, fn, arg, mpx);
    this.raiz = new THREE.Group(); this.raiz.add(this.hoja); padre.add(this.raiz);
    this.raiz.visible = false; this.v = null;
  }
  lanzar(desde, hasta, dur, alto) { return new Promise((r) => { this.v = { desde, hasta, dur, alto: alto == null ? 1.2 : alto, t: 0, listo: r }; this.raiz.visible = true; }); }
  pasar(dt) {
    if (this.sigue && !this.v) { const q = this.sigue.raiz.position; this.raiz.position.set(q.x + 0.1, q.y + 0.25, q.z + 0.05); this.raiz.visible = this.sigue.raiz.visible; }
    const v = this.v; if (!v) return;
    v.t += dt;
    const k = Math.min(1, v.t / v.dur), e = k * k * (3 - 2 * k);
    this.raiz.position.set(v.desde.x + (v.hasta.x - v.desde.x) * e, v.desde.y + (v.hasta.y - v.desde.y) * e + Math.sin(k * Math.PI) * v.alto, 0.3);
    this.raiz.rotation.z = Math.sin(k * Math.PI * 2) * 0.4;
    if (k >= 1) { const r = v.listo; this.v = null; r(); }
  }
  esconder() { this.raiz.visible = false; }
}

/* ============================================================================
   APU
   ========================================================================== */
export class Apu {
  constructor(padre, edad) {
    this.padre = padre;
    this.raiz = new THREE.Group(); padre.add(this.raiz);
    this.piv = new THREE.Group(); this.raiz.add(this.piv);
    this.pos = new THREE.Vector3(0, 0, 0.35); this.vel = new THREE.Vector3();
    this.modo = 'nada'; this.yaw = 0; this.dir = 1; this.fase = 0; this.aleteo = 0; this.va = null; this.t = 0;
    this.pio = 0; this.fp = -1;
    this.ponerEdad(edad || 0);
  }
  ponerEdad(edad) {
    this.edad = edad;
    while (this.piv.children.length) this.piv.remove(this.piv.children[0]);
    /* el pichón */
    this.pichon = hojaDe('apuP', APU.pichon, 0, 0.034);
    this.piv.add(this.pichon);
    /* el cóndor: cuerpo y dos alas colgadas del hombro */
    const k = this.k = 0.026 + edad * 0.032;
    const e = Math.round(edad * 20) / 20;
    this.cuerpo = hojaDe('apuC', APU.cuerpo, e, k);
    const ua = texDe('apuA', APU.ala, e).tex.userData;
    const ancho = ua.w * k, alto = ua.h * k;
    const ala = (lejos) => {
      const h = hojaDe('apuA', APU.ala, e, k, { ox: ancho / 2 - ua.m * k, oy: -alto / 2 });
      if (lejos) { h.material = h.material.clone(); h.material.color.setScalar(0.72); }
      const bate = new THREE.Group(); bate.add(h);
      const giro = new THREE.Group(); giro.add(bate);
      const hombro = new THREE.Group(); hombro.add(giro);
      hombro.position.set(-2.5 * k, 9.5 * k, lejos ? -0.04 : 0.04);
      giro.rotation.x = lejos ? -0.35 : 0.35;
      return { hombro, giro, bate, h };
    };
    this.alaL = ala(true); this.alaC = ala(false);
    this.condor = new THREE.Group();
    this.condor.add(this.alaL.hombro, this.cuerpo, this.alaC.hombro);
    this.piv.add(this.condor);
    /* las alitas del pichón cuando aletea en el atado */
    const kp = 0.012;
    this.alitas = [0, 1].map((i) => {
      const h = hojaDe('apuA', APU.ala, 0, kp, { ox: ua.w * kp / 2 - ua.m * kp });
      h.geometry.translate(0, -ua.h * kp / 2, 0);
      const g = new THREE.Group(); g.add(h); g.position.set(-0.02, 0.26, i ? -0.03 : 0.03); g.visible = false;
      this.piv.add(g); return g;
    });
    this.ajustar();
  }
  ajustar() {
    const volando = this.modo === 'baja' || this.modo === 'sigue' || this.modo === 'va' || this.modo === 'libre' || this.modo === 'lleva' || this.modo === 'cruza' || this.modo === 'orbita' || this.modo === 'posado';
    this.pichon.visible = this.modo === 'suelo' || this.modo === 'bulto' || this.modo === 'brazos';
    this.condor.visible = volando;
    this.raiz.visible = this.modo !== 'nada';
  }
  poner(modo, x, y) {
    this.modo = modo;
    if (x != null) this.pos.set(x, y, 0.35);
    this.vel.set(0, 0, 0);
    this.ajustar();
  }
  /* se fue volando a abrir una traba */
  ir(x, y) { this.va = { x0: this.pos.x, y0: this.pos.y, x, y, t: 0 }; this.modo = 'va'; this.ajustar(); }
  /* bajar volando hasta un lugar y quedarse posado (el nido de la cumbre) */
  aterrizar(x, y, dur) { this.baja = { x0: this.pos.x, y0: this.pos.y, x, y, t: 0, dur: dur || 1.3 }; this.modo = 'baja'; this.ajustar(); }
  soltar() { this.modo = 'libre'; this.libre = { t: 0, x0: this.pos.x, y0: this.pos.y }; this.ajustar(); }
  aletear() { this.aleteo = 0.5; this.pio = 0.3; }
  /* pasar volando por el cielo, de un lado al otro */
  cruzar(x0, x1, y, dur) { this.cruza = { x0, x1, y, dur, t: 0 }; this.modo = 'cruza'; this.pos.set(x0, y, -2.5); this.ajustar(); }
  /* dar vueltas arriba de alguien (la portada) */
  orbitar(cx, cy, R) { this.orb = { cx, cy, R, t: 0 }; this.modo = 'orbita'; this.ajustar(); }
  /* la pose del ala: a = ángulo del ala (PI/2 arriba, PI para atrás) */
  alas(aC, aL) { this.alaC.bate.rotation.z = aC; this.alaL.bate.rotation.z = aL; }
  /* un aletazo: sube con la punta adelante y baja hacia atrás, sin pasar de la horizontal */
  batir(k) {
    const s = Math.sin(this.fase), s2 = Math.sin(this.fase - 0.4);
    this.alas(2.65 + s * 0.62 * k, 2.52 + s2 * 0.58 * k);
  }

  pasar(dt, t, p, o) {
    o = o || {};
    this.t = t;
    const dirK = p.dir || 1;
    let dir = this.dir;
    this.aleteo = Math.max(0, this.aleteo - dt);
    this.pio = Math.max(0, this.pio - dt);
    this.condor.position.y = 0; this.condor.rotation.z = 0; this.condor.scale.setScalar(1);
    switch (this.modo) {
      case 'nada': break;
      case 'suelo': {
        /* temblando de frío donde cayó */
        this.raiz.position.set(this.pos.x + Math.sin(t * 50) * 0.012, this.pos.y, 0.2);
        const f = this.pio > 0 || Math.sin(t * 2.3) > 0.85 ? 2 : Math.floor(t * 3) % 2;
        if (f !== this.fp) { this.fp = f; ponerTex(this.pichon, texDe('apuP', APU.pichon, f).tex); }
        this.pichon.position.set(0, 0, 0);
        dir = -1;
        break;
      }
      case 'brazos': {
        /* en brazos de Killa, contra el pecho */
        dir = dirK;
        this.raiz.position.set(p.x + dirK * (this.brazosX == null ? 0.3 : this.brazosX), p.y + (this.brazosY == null ? 0.52 : this.brazosY), 0.1);
        const f = this.pio > 0 ? 2 : Math.floor(t * 2) % 2;
        if (f !== this.fp) { this.fp = f; ponerTex(this.pichon, texDe('apuP', APU.pichon, f).tex); }
        for (const a of this.alitas) { a.visible = this.aleteo > 0; a.rotation.z = Math.PI * 0.75 + Math.sin(t * 40) * 0.9; }
        break;
      }
      case 'baja': {
        const B = this.baja; B.t += dt;
        const k = Math.min(1, B.t / B.dur), e = k * k * (3 - 2 * k);
        this.pos.set(B.x0 + (B.x - B.x0) * e, B.y0 + (B.y - B.y0) * e + Math.sin(k * Math.PI) * 0.8, 0.2);
        this.raiz.position.copy(this.pos);
        dir = Math.sign(B.x - B.x0) || this.dir;
        this.fase += dt * (k > 0.7 ? 18 : 9); this.batir(k > 0.7 ? 1.3 : 1);
        if (k >= 1) { this.modo = 'posado'; this.aletear(); }
        break;
      }
      case 'posado': {
        /* parado en el nido, con las alas plegadas; de vez en cuando las abre */
        this.raiz.position.set(this.pos.x, this.pos.y + Math.sin(t * 2) * 0.02, -0.35);
        const abre = this.aleteo > 0 ? Math.sin((this.aleteo / 0.5) * Math.PI) : 0;
        this.alas(3.05 - abre * 1.1, 2.95 - abre * 1.0);
        this.condor.rotation.z = 0.7; this.condor.position.y = 0.2 * this.k / 0.05; this.condor.scale.setScalar(0.85);
        dir = this.dir;
        break;
      }
      case 'bulto': {
        /* asomado del atado, en la espalda de Killa */
        dir = dirK;
        const salto = this.aleteo > 0 ? Math.sin((this.aleteo / 0.5) * Math.PI) : 0;
        const bob = p.enSuelo && Math.abs(p.vx) > 0.5 ? Math.abs(Math.sin(t * 11)) * 0.05 : 0;
        const agach = p.agachada ? -0.4 : 0;
        this.raiz.position.set(p.x - dirK * 0.2, p.y + 0.8 + agach + bob + salto * 0.9, -0.06);
        const f = this.pio > 0 ? 2 : Math.floor(t * 2.5) % 2;
        if (f !== this.fp) { this.fp = f; ponerTex(this.pichon, texDe('apuP', APU.pichon, f).tex); }
        for (let i = 0; i < 2; i++) {
          const a = this.alitas[i];
          a.visible = this.aleteo > 0;
          a.rotation.z = Math.PI * 0.75 + Math.sin(t * 40 + i) * 0.9;
        }
        break;
      }
      case 'sigue': case 'lleva': {
        const lleva = p.planeando || this.modo === 'lleva';
        let tx, ty;
        if (lleva) { tx = p.x; ty = p.y + 1.55; }
        else if (this.aleteo > 0) { tx = p.x; ty = p.y + 1.7; }
        else { tx = p.x - dirK * 1.3; ty = p.y + 2.2 + Math.sin(t * 1.7) * 0.25; }
        const rig = lleva || this.aleteo > 0 ? 260 : 26, amort = lleva || this.aleteo > 0 ? 0.00001 : 0.02;
        this.vel.x += (tx - this.pos.x) * rig * dt; this.vel.y += (ty - this.pos.y) * rig * dt;
        this.vel.multiplyScalar(Math.pow(amort, dt));
        if (lleva) { this.pos.x += (tx - this.pos.x) * suave(0.00001, dt); this.pos.y += (ty - this.pos.y) * suave(0.00001, dt); this.vel.set(p.vx, p.vy, 0); }
        else this.pos.addScaledVector(this.vel, dt);
        dir = Math.abs(this.vel.x) > 1.2 ? Math.sign(this.vel.x) : dirK;
        if (lleva) dir = p.vx ? Math.sign(p.vx) : dirK;
        this.raiz.position.set(this.pos.x, this.pos.y, lleva ? -0.12 : 0.35);
        /* las alas */
        if (lleva && !o.termica) { const fl = Math.sin(t * 9) * 0.06; this.alas(2.45 + fl, 2.3 + fl); }
        else {
          const rapido = this.aleteo > 0 || o.termica ? 16 : this.vel.y > 1 ? 10 : 6.5;
          this.fase += dt * rapido;
          this.batir(this.aleteo > 0 ? 1.2 : 1);
        }
        this.condor.rotation.z = Math.max(-0.35, Math.min(0.35, this.vel.y * 0.035)) + (lleva ? 0.08 : 0);
        this.condor.position.y = lleva ? -0.25 * this.edad : 0;
        break;
      }
      case 'va': {
        const v = this.va; v.t += dt;
        const ida = 0.9, quieto = 0.5, vuelta = 0.8;
        let x, y;
        if (v.t < ida) { const k = v.t / ida, e = k * k * (3 - 2 * k); x = v.x0 + (v.x - v.x0) * e; y = v.y0 + (v.y - v.y0) * e + Math.sin(k * Math.PI) * 1.5; dir = Math.sign(v.x - v.x0) || 1; this.fase += dt * 12; }
        else if (v.t < ida + quieto) { x = v.x; y = v.y; this.fase += dt * 18; dir = this.dir; }
        else {
          const k = Math.min(1, (v.t - ida - quieto) / vuelta), e = k * k * (3 - 2 * k);
          x = v.x + (p.x - dirK * 1.3 - v.x) * e; y = v.y + (p.y + 2.2 - v.y) * e + Math.sin(k * Math.PI) * 1.2; dir = Math.sign(p.x - v.x) || 1; this.fase += dt * 9;
          if (k >= 1) { this.modo = 'sigue'; this.vel.set(0, 0, 0); }
        }
        this.pos.set(x, y, 0.35);
        this.raiz.position.copy(this.pos);
        this.batir(1.1);
        break;
      }
      case 'cruza': {
        const C = this.cruza; C.t += dt;
        const k = Math.min(1, C.t / C.dur);
        const x = C.x0 + (C.x1 - C.x0) * k, y = C.y + Math.sin(k * Math.PI) * 1.2 + Math.sin(t * 1.3) * 0.25;
        this.pos.set(x, y, -2.5);
        this.raiz.position.copy(this.pos);
        dir = Math.sign(C.x1 - C.x0) || 1;
        this.fase += dt * 7;
        if (Math.sin(t * 0.9) > 0.2) { const fl = Math.sin(t * 7) * 0.05; this.alas(2.5 + fl, 2.35 + fl); }
        else this.batir(1);
        this.condor.rotation.z = Math.sin(t * 0.8) * 0.08;
        if (k >= 1) { this.modo = 'nada'; this.ajustar(); }
        break;
      }
      case 'orbita': {
        const O = this.orb; O.t += dt;
        const w = 0.42, a = O.t * w;
        const x = O.cx + Math.cos(a) * O.R, z = -1.5 + Math.sin(a) * O.R * 0.9, y = O.cy + Math.sin(a * 2) * 0.35;
        this.pos.set(x, y, z);
        this.raiz.position.copy(this.pos);
        dir = -Math.sin(a) >= 0 ? 1 : -1;
        this.fase += dt * 8;
        if (Math.sin(O.t * 0.7) > -0.4) { const fl = Math.sin(t * 6) * 0.05; this.alas(2.5 + fl, 2.35 + fl); }
        else this.batir(1);
        this.condor.rotation.z = Math.cos(a) * 0.12;
        break;
      }
      case 'libre': {
        /* la vuelta de despedida: sube en espiral y se va hacia el sol */
        const L = this.libre; L.t += dt;
        const k = L.t;
        const r = 2.5 + k * 0.6, w = 1.2;
        const x = L.x0 + Math.sin(k * w) * r + k * 0.6, y = L.y0 + 1 + k * 1.1 + Math.sin(k * 2.1) * 0.3;
        const z = 0.35 - Math.cos(k * w) * Math.min(3, k * 0.8);
        dir = Math.cos(k * w) >= 0 ? 1 : -1;
        this.pos.set(x, y, z);
        this.raiz.position.copy(this.pos);
        this.fase += dt * (k < 1 ? 14 : 5);
        if (k > 3 && Math.sin(k * 0.8) > 0) this.alas(2.5, 2.35);
        else this.batir(1.1);
        this.condor.rotation.z = 0.15;
        break;
      }
    }
    if (dir !== this.dir) this.dir = dir;
    this.yaw = girar(this.yaw, this.dir, dt, 0.0008);
    this.piv.rotation.y = this.yaw;
  }
}

/* ============================================================================
   EL PUMA
   ========================================================================== */
export class Puma {
  constructor(padre) {
    this.hoja = hojaDe('puma', ANIMALES.puma, 0, 0.05, { ox: -0.3 });
    this.piv = new THREE.Group(); this.piv.add(this.hoja);
    this.raiz = new THREE.Group(); this.raiz.add(this.piv); padre.add(this.raiz);
    this.raiz.visible = false; this.y = 0; this.vy = 0; this.fase = 0; this.f = -1; this.yaw = 0; this.dir = 1; this.huye = 0;
  }
  pasar(dt, t, m) {
    const q = m.perseguidor;
    const activo = q && q.tipo === 'puma' && q.activo;
    if (!activo && !this.huye) { this.raiz.visible = false; this.ultimaX = null; return; }
    this.raiz.visible = true;
    let x;
    if (activo) { x = q.x; this.dir = 1; } else { this.huye -= dt; this.x0 = (this.x0 || this.ultimaX || 0) - dt * 7; x = this.x0; this.dir = -1; if (this.huye <= 0) { this.huye = 0; this.x0 = null; } }
    this.ultimaX = x;
    /* corre por arriba del terreno: salta los escalones */
    const piso = pisoBajo(m, x + 0.8, Math.max(this.y, m.p.y) + 3.5);
    if (this.y < piso) { this.vy = Math.max(this.vy, 9); }
    this.vy -= 30 * dt; this.y += this.vy * dt;
    if (this.y < piso) { this.y = piso; this.vy = 0; }
    const enAire = this.y > piso + 0.05;
    this.fase += dt * (activo ? 10 : 11);
    const f = enAire ? 1 : Math.floor(this.fase) % 4;
    if (f !== this.f) { this.f = f; ponerTex(this.hoja, texDe('puma', ANIMALES.puma, f).tex); }
    this.raiz.position.set(x, this.y, 0.15);
    this.yaw = girar(this.yaw, this.dir, dt, 0.00001);
    this.piv.rotation.y = this.yaw;
    this.piv.rotation.z = enAire ? Math.max(-0.3, Math.min(0.3, this.vy * 0.04)) * this.dir : Math.sin(this.fase * 1.57) * 0.03;
  }
  irse(x) { this.huye = 2.5; this.x0 = x; }
}

/* ============================================================================
   EL VIENTO BLANCO: una pared de papel blanco rasgado que avanza
   ========================================================================== */
function texVentisca(sem) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0);
  gr.addColorStop(0, 'rgba(236,242,250,1)'); gr.addColorStop(0.75, 'rgba(214,226,242,0.95)'); gr.addColorStop(1, 'rgba(200,214,236,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(0, 0);
  for (let y = 0; y <= 512; y += 8) { const x = 170 + Math.sin(y * 0.03 + sem) * 30 + Math.sin(y * 0.11 + sem * 2) * 14 + (hash(y, sem, 3) - 0.5) * 18; g.lineTo(x, y); }
  g.lineTo(0, 512); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-atop';
  g.strokeStyle = 'rgba(160,180,215,0.35)'; g.lineWidth = 3;
  for (let i = 0; i < 26; i++) { const y = hash(i, sem, 5) * 512; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(60, y - 20, 120, y + 20, 200, y - 6); g.stroke(); }
  g.globalAlpha = 0.4; g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(granoPapel(), 'repeat'); g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export class VientoBlanco {
  constructor(padre) {
    this.raiz = new THREE.Group(); padre.add(this.raiz); this.raiz.visible = false;
    this.hojas = [];
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshStandardMaterial({ map: texVentisca(i * 1.7), transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 1, emissive: '#6a7a9a', emissiveIntensity: 0.35 });
      const h = new THREE.Mesh(new THREE.PlaneGeometry(9, 34), mat);
      h.position.set(-4.5 + i * 0.6, 12, -3.5 + i * 1.3);
      h.renderOrder = 5;
      this.raiz.add(h); this.hojas.push(h);
    }
    this.x = 0; this.ver = 0;
  }
  pasar(dt, t, m) {
    const q = m.perseguidor;
    const activo = q && q.tipo === 'tormenta' && q.activo;
    this.ver += ((activo ? 1 : 0) - this.ver) * suave(0.05, dt);
    this.raiz.visible = this.ver > 0.02;
    if (!this.raiz.visible) return;
    if (activo) this.x = q.x;
    else this.x += dt * 2;
    this.raiz.position.set(this.x, m.p.y - 10, 0);
    this.hojas.forEach((h, i) => {
      h.position.x = -4.5 + i * 0.6 + Math.sin(t * (1.3 + i * 0.4) + i) * 0.5;
      h.rotation.y = Math.sin(t * 0.9 + i) * 0.12;
      h.material.opacity = this.ver * (0.55 + i * 0.1);
    });
  }
}

/* el farol que le dio Tomás: un recorte con su luz, colgado de la mano */
export class Farol {
  constructor(padre, sinLuz) {
    this.hoja = hojaDe('farol', DECOR.farol, 0, 0.03);
    this.raiz = new THREE.Group(); this.raiz.add(this.hoja); padre.add(this.raiz);
    this.luz = sinLuz ? { intensity: 0 } : new THREE.PointLight('#ffc070', 2.4, 10, 1.2);
    if (!sinLuz) { this.luz.position.set(0, 0.3, 1.5); this.raiz.add(this.luz); }
    this.hoja.material.emissive = new THREE.Color('#ffb040'); this.hoja.material.emissiveIntensity = 0.5;
    this.f = 0;
  }
  pasar(dt, t, p) {
    const dir = p.dir || 1;
    this.raiz.position.set(p.x + dir * 0.28, p.y + (p.agachada ? 0.25 : 0.5), 0.12);
    this.raiz.rotation.z = Math.sin(t * 5) * 0.12 - p.vx * 0.03;
    this.luz.intensity = 2.4 + Math.sin(t * 13) * 0.18 + Math.sin(t * 31) * 0.12;
    const f = Math.floor(t * 5) % 2;
    if (f !== this.f) { this.f = f; ponerTex(this.hoja, texDe('farol', DECOR.farol, f).tex); }
  }
}
