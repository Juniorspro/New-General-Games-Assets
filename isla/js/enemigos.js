// Los enemigos: cangrejos en la playa (de día se hacen los tontos, de noche
// te buscan), esqueletos piratas que salen de noche y se queman al amanecer,
// murciélagos en la mina y el Guardián: un gólem de piedra con el corazón de
// cristal del faro, en la sala más honda.
//
// Todos siguen la misma máquina: pasear → cazar → cargar (se ve venir: el
// esqueleto levanta la espada, el gólem los brazos y marca el piso en rojo) →
// golpe → pausa. Un golpe recibido los frena, los empuja y los pone blancos.
// Los modelos son de bloques, como todo lo demás, y se animan con senos.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { matGema } from './gemas.js';
import { geoRoca, geoCristales, mergeSimple } from './rocas.js';
import { MINA_Y } from './mina.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const caja = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const liso = (color, op = {}) => matPixel('liso', { color, texeles: 24, clave: `enemigo|${color}|${op.emisivo || 0}`, ...op });
const BLANCO = () => matPixel('liso', { color: 0xffffff, emisivo: 0xffffff, clave: 'enemigoDestello' });

export const TIPOS_ENEMIGO = {
  cangrejo: { vida: 10, dano: 6, vel: 2.4, radio: 0.45, alto: 0.55, vista: 7, alcance: 1.25, carga: 0.35, pausa: 0.9, peso: 1, botin: [['carneCangrejo', 1, 1], ['caparazon', 1, 0.65]] },
  esqueleto: { vida: 26, dano: 12, vel: 3.3, radio: 0.35, alto: 1.8, vista: 18, alcance: 1.7, carga: 0.55, pausa: 1.0, peso: 1, botin: [['hueso', 2, 1], ['moneda', 1, 0.15], ['flecha', 3, 0.3]] },
  murcielago: { vida: 6, dano: 5, vel: 4.4, radio: 0.3, alto: 0.4, vista: 12, alcance: 1.1, carga: 0.25, pausa: 0.8, vuela: true, peso: 0.6, botin: [['carbon', 1, 0.3]] },
  golem: { vida: 320, dano: 26, vel: 1.9, radio: 1.2, alto: 3.4, vista: 18, alcance: 3.3, carga: 1.0, pausa: 1.3, jefe: true, peso: 6, botin: [['corazonCristal', 1, 1], ['amatista', 3, 1], ['tanzanita', 1, 1], ['oro', 2, 1]] },
};

// ── modelos ─────────────────────────────────────────────────────────────────
function modeloCangrejo() {
  const g = new THREE.Group(), cuerpo = new THREE.Group();
  const rojo = liso(0xe0643a), oscuro = liso(0xa8402a), ojo = liso(0x101010), blanco = liso(0xffffff);
  cuerpo.add(new THREE.Mesh(caja(0.7, 0.26, 0.5, 0, 0.3, 0), rojo));
  cuerpo.add(new THREE.Mesh(caja(0.56, 0.08, 0.4, 0, 0.46, 0), oscuro));
  for (const s of [-1, 1]) {
    cuerpo.add(new THREE.Mesh(caja(0.05, 0.16, 0.05, s * 0.12, 0.52, 0.2), rojo));
    cuerpo.add(new THREE.Mesh(caja(0.08, 0.08, 0.08, s * 0.12, 0.62, 0.2), blanco));
    cuerpo.add(new THREE.Mesh(caja(0.04, 0.04, 0.02, s * 0.12, 0.62, 0.245), ojo));
  }
  g.add(cuerpo);
  const pinzas = [], patas = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(caja(0.12, 0.1, 0.3, 0, 0, 0.15), rojo));
    const tapa = new THREE.Mesh(caja(0.2, 0.18, 0.2, 0, 0.04, 0.36), rojo);
    p.add(tapa);
    p.position.set(s * 0.3, 0.3, 0.2);
    p.rotation.y = s * -0.35;
    g.add(p); pinzas.push(p);
    for (let k = 0; k < 3; k++) {
      const pata = new THREE.Mesh(caja(0.36, 0.05, 0.05, s * 0.18, 0, 0), oscuro);
      pata.position.set(s * 0.3, 0.22, -0.15 + k * 0.14);
      g.add(pata); patas.push({ m: pata, s, k });
    }
  }
  g.userData = { cuerpo, pinzas, patas };
  return g;
}

function modeloEsqueleto() {
  const g = new THREE.Group();
  const hueso = liso(0xf1ead8), sombra = liso(0xb9b09a), negro = liso(0x141414), panuelo = liso(0xc8252e), oxido = liso(0x8a8f9a, { brillo: 0.5 });
  const cabeza = new THREE.Group();
  cabeza.add(new THREE.Mesh(caja(0.34, 0.32, 0.32, 0, 0.16, 0), hueso));
  cabeza.add(new THREE.Mesh(caja(0.08, 0.08, 0.02, -0.08, 0.2, 0.165), negro));
  cabeza.add(new THREE.Mesh(caja(0.08, 0.08, 0.02, 0.08, 0.2, 0.165), negro));
  cabeza.add(new THREE.Mesh(caja(0.2, 0.04, 0.02, 0, 0.06, 0.165), negro));
  cabeza.add(new THREE.Mesh(caja(0.36, 0.1, 0.34, 0, 0.3, 0), panuelo));
  cabeza.add(new THREE.Mesh(caja(0.1, 0.18, 0.06, -0.12, 0.2, -0.19), panuelo));
  cabeza.position.set(0, 1.42, 0);
  g.add(cabeza);
  const torso = new THREE.Mesh(mergeSimple([caja(0.08, 0.6, 0.08, 0, 1.08, 0), caja(0.34, 0.05, 0.2, 0, 1.3, 0), caja(0.3, 0.05, 0.18, 0, 1.18, 0), caja(0.26, 0.05, 0.16, 0, 1.06, 0), caja(0.28, 0.08, 0.14, 0, 0.8, 0)]), hueso);
  g.add(torso);
  const miembro = (x, y, largo, mat) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(caja(0.07, largo, 0.07, 0, -largo / 2, 0), mat));
    p.position.set(x, y, 0);
    g.add(p);
    return p;
  };
  const brazoI = miembro(-0.24, 1.3, 0.56, sombra), brazoD = miembro(0.24, 1.3, 0.56, sombra);
  const espada = new THREE.Mesh(mergeSimple([caja(0.05, 0.62, 0.02, 0, -0.9, 0.18), caja(0.16, 0.03, 0.04, 0, -0.58, 0.18)]), oxido);
  espada.rotation.x = -0.6;
  brazoD.add(espada);
  const piernaI = miembro(-0.1, 0.78, 0.76, hueso), piernaD = miembro(0.1, 0.78, 0.76, hueso);
  g.userData = { cabeza, brazoI, brazoD, piernaI, piernaD };
  return g;
}

function modeloMurcielago() {
  const g = new THREE.Group();
  const cuerpoMat = liso(0x3a2848), alaMat = liso(0x2a1d36), ojo = liso(0xff3040, { emisivo: 0xff2030 });
  g.add(new THREE.Mesh(caja(0.2, 0.22, 0.2, 0, 0, 0), cuerpoMat));
  g.add(new THREE.Mesh(caja(0.05, 0.04, 0.02, -0.05, 0.03, 0.105), ojo));
  g.add(new THREE.Mesh(caja(0.05, 0.04, 0.02, 0.05, 0.03, 0.105), ojo));
  const alas = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group();
    a.add(new THREE.Mesh(caja(0.42, 0.03, 0.26, s * 0.21, 0, 0), alaMat));
    a.position.x = s * 0.1;
    g.add(a); alas.push({ a, s });
  }
  g.userData = { alas };
  return g;
}

// El gólem: piedra más clara que la de la mina (si no, se pierde contra la
// pared), hombros anchos, puños grandes, ojos y grietas cian, y en el pecho el
// corazón de cristal del faro: se ve de frente, que es lo que hay que ir a buscar.
function modeloGolem() {
  const g = new THREE.Group();
  const piedra = matPixel('liso', { color: 0x9a9284, bari: true, borde: 0.45, texeles: 12, clave: 'golemPiedra' });
  const oscura = matPixel('liso', { color: 0x6e685e, bari: true, borde: 0.9, texeles: 12, clave: 'golemOscura' });
  const cristal = matGema(0x5ff6ff, 'cristal', { emision: 0.55 });
  const brillo = liso(0x9ffcff, { emisivo: 0x40e8ff });
  const torso = new THREE.Group();
  torso.add(new THREE.Mesh(geoRoca(211, 0.9).scale(1.35, 1.1, 0.85).translate(0, 2.25, 0), piedra));
  torso.add(new THREE.Mesh(geoRoca(212, 0.8).scale(0.8, 0.55, 0.6).translate(0, 1.35, 0), oscura));
  // las grietas que brillan y el corazón en el pecho
  torso.add(new THREE.Mesh(mergeSimple([caja(0.08, 0.5, 0.05, -0.45, 2.4, 0.78).rotateZ(0.4), caja(0.07, 0.4, 0.05, 0.5, 2.0, 0.74).rotateZ(-0.5), caja(0.06, 0.35, 0.05, 0.1, 1.6, 0.62)]), brillo));
  const corazon = new THREE.Mesh(new THREE.OctahedronGeometry(0.3).scale(1, 1.4, 0.7).translate(0, 2.35, 0.86), cristal);
  torso.add(corazon);
  torso.add(new THREE.Mesh(geoCristales(233, 4).scale(1.1, 1.3, 1.1).translate(0, 2.7, -0.6), cristal));
  g.add(torso);
  const cabeza = new THREE.Group();
  cabeza.add(new THREE.Mesh(geoRoca(223, 0.8).scale(0.55, 0.48, 0.5), piedra));
  cabeza.add(new THREE.Mesh(caja(0.2, 0.1, 0.06, -0.17, 0.02, 0.44), brillo));
  cabeza.add(new THREE.Mesh(caja(0.2, 0.1, 0.06, 0.17, 0.02, 0.44), brillo));
  cabeza.add(new THREE.Mesh(caja(0.62, 0.12, 0.2, 0, 0.16, 0.36), oscura));   // la frente, ceñuda
  cabeza.position.set(0, 3.3, 0.25);
  g.add(cabeza);
  const brazo = (s) => {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(geoRoca(237 + s, 0.9).scale(0.62, 0.55, 0.62), piedra));                       // el hombro
    b.add(new THREE.Mesh(geoRoca(240 + s, 0.9).scale(0.42, 0.75, 0.42).translate(0, -0.85, 0), oscura));
    b.add(new THREE.Mesh(geoRoca(250 + s, 0.8).scale(0.62, 0.55, 0.62).translate(0, -1.8, 0.08), piedra));  // el puño
    b.position.set(s * 1.4, 2.75, 0);
    g.add(b);
    return b;
  };
  const brazoI = brazo(-1), brazoD = brazo(1);
  const pierna = (s) => {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(geoRoca(260 + s, 0.9).scale(0.5, 0.66, 0.5).translate(0, -0.55, 0), oscura));
    p.add(new THREE.Mesh(caja(0.7, 0.2, 0.85, 0, -1.08, 0.1), piedra));
    p.position.set(s * 0.55, 1.2, 0);
    g.add(p);
    return p;
  };
  const piernaI = pierna(-1), piernaD = pierna(1);
  g.userData = { cabeza, brazoI, brazoD, piernaI, piernaD, corazon };
  return g;
}

const MODELOS = { cangrejo: modeloCangrejo, esqueleto: modeloEsqueleto, murcielago: modeloMurcielago, golem: modeloGolem };

// ── el conjunto ─────────────────────────────────────────────────────────────
export class Enemigos {
  constructor(J) {
    this.J = J;
    this.lista = [];
    this.tPoblar = 2;
    this.jefeVencido = false;
    this.jefe = null;
    this.proyectiles = [];
    // el anillo rojo que avisa dónde va a caer el golpe del gólem
    this.aviso = new THREE.Mesh(new THREE.RingGeometry(0.2, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    this.aviso.visible = false;
    this.aviso.renderOrder = 4;
    J.escena.add(this.aviso);
    this.matRoca = matPixel('liso', { color: 0x9a9284, bari: true, borde: 0.45, texeles: 12, clave: 'golemPiedra' });
  }

  crear(tipo, x, y, z) {
    const T = TIPOS_ENEMIGO[tipo];
    const g = MODELOS[tipo]();
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.mat = o.material; } });
    if (tipo === 'golem') g.scale.setScalar(1);
    this.J.escena.add(g);
    const e = { tipo, T, g, p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), yaw: Math.random() * 6.28, vida: T.vida, estado: 'paseo', t: 0, casa: new THREE.Vector3(x, y, z), destino: null, fase: Math.random() * 6, destello: 0, frenado: 0, enojado: false, saliendo: 0, aire: 1.2 + Math.random(), tAtaque: 0, sonido: 2 + Math.random() * 3 };
    this.lista.push(e);
    if (T.jefe) this.jefe = e;
    return e;
  }

  quitar(e) {
    this.J.escena.remove(e.g);
    this.lista.splice(this.lista.indexOf(e), 1);
    if (e === this.jefe) this.jefe = null;
  }

  limpiar(soloComunes = true) { for (const e of [...this.lista]) if (!soloComunes || !e.T.jefe) this.quitar(e); }

  // ── aparecer ──────────────────────────────────────────────────────────────
  poblar() {
    const J = this.J, pj = J.jugador.p;
    const cerca = (tipo, r) => this.lista.filter((e) => e.tipo === tipo && e.p.distanceTo(pj) < r).length;
    // lejos se borran (menos el jefe): lo que no se ve no hace falta
    for (const e of [...this.lista]) if (!e.T.jefe && e.p.distanceTo(pj) > 75) this.quitar(e);
    if (J.bajo) {
      if (cerca('murcielago', 40) < 4) this.aparecerMina('murcielago');
      if (!this.jefeVencido && !this.jefe && J.mina.salaJefe) {
        const s = J.mina.salaJefe;
        this.crear('golem', s.x, MINA_Y, s.z).enojado = false;
      }
      return;
    }
    const noche = J.noche;
    if (cerca('cangrejo', 50) < (noche > 0.6 ? 4 : 2)) this.aparecerPlaya();
    if (noche > 0.68 && cerca('esqueleto', 60) < 4) this.aparecerNoche();
  }

  lugarLibre(x, z) {
    const J = this.J;
    if (J.mundo.dentroDePiso(x, z, 2)) return false;
    const C = J.mundo.choza.grupo.position;
    if (Math.hypot(x - C.x, z - C.z) < 10) return false;
    // la luz de una fogata espanta: ahí no aparece nada de noche
    for (const f of J.bloques.fogatas) if (Math.hypot(f.x + 0.5 - x, f.z + 0.5 - z) < 15) return false;
    return true;
  }

  aparecerPlaya() {
    const J = this.J, T = J.mundo.terreno, pj = J.jugador.p;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 22;
      const x = pj.x + Math.cos(a) * d, z = pj.z + Math.sin(a) * d;
      const h = T.altura(x, z);
      if (h < 0.15 || h > 1.6 || T.pasto(x, z) > 0.35 || !this.lugarLibre(x, z)) continue;
      this.crear('cangrejo', x, h, z);
      return;
    }
  }

  aparecerNoche() {
    const J = this.J, T = J.mundo.terreno, pj = J.jugador.p;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 18;
      const x = pj.x + Math.cos(a) * d, z = pj.z + Math.sin(a) * d;
      const h = T.altura(x, z);
      if (h < 0.7 || !this.lugarLibre(x, z)) continue;
      const e = this.crear('esqueleto', x, h, z);
      // salen de la arena: arrancan hundidos y suben
      e.saliendo = 1;
      J.part.rafaga(_v.set(x, h + 0.2, z), 12, [0xe8d3a0, 0xf1ead8, 0xc9b07a], { vel: 1.5, arriba: 3, tam: 0.06 });
      return;
    }
  }

  aparecerMina(tipo) {
    const J = this.J, M = J.mina, pj = J.jugador.p;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, d = 12 + Math.random() * 16;
      const x = pj.x + Math.cos(a) * d, z = pj.z + Math.sin(a) * d;
      if (!M.abiertoEn(x, z) || Math.hypot(x - M.salida.x, z - M.salida.z) < 8) continue;
      this.crear(tipo, x, MINA_Y + 2.2, z);
      return;
    }
  }

  // ── cada cuadro ─────────────────────────────────────────────────────────
  actualizar(dt) {
    const J = this.J;
    this.tPoblar -= dt;
    if (this.tPoblar <= 0) { this.tPoblar = 2.5; this.poblar(); }
    const pj = J.jugador.p;
    const amanece = J.noche < 0.3;
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const e = this.lista[i];
      if (e.estado === 'muerto') { this.animarMuerte(e, dt); continue; }
      // al amanecer los esqueletos se queman
      if (e.tipo === 'esqueleto' && amanece && !J.bajo) { e.quemandose = (e.quemandose || 0) + dt; if (Math.random() < dt * 12) J.part.rafaga(_v.copy(e.p).add({ x: 0, y: 1, z: 0 }), 2, [0xff8a10, 0xffe27a, 0x3a3a3a], { vel: 0.6, arriba: 2, g: -2, tam: 0.07 }); if (e.quemandose > 2) { this.morir(e, false); continue; } }
      this.pensar(e, dt, pj);
      this.animar(e, dt);
    }
    this.actualizarProyectiles(dt);
  }

  pensar(e, dt, pj) {
    const J = this.J, T = e.T;
    e.t += dt;
    e.destello = Math.max(0, e.destello - dt);
    if (e.saliendo > 0) { e.saliendo = Math.max(0, e.saliendo - dt * 0.8); }
    const dx = pj.x - e.p.x, dz = pj.z - e.p.z;
    const dj = Math.hypot(dx, dz), dy = Math.abs(pj.y - e.p.y);
    const mismoPiso = (pj.y < -30) === (e.p.y < -30);
    const lo_ve = mismoPiso && dj < T.vista && dy < 6 && J.jugador.vida > 0;
    // sonidos sueltos cuando están cerca
    e.sonido -= dt;
    if (e.sonido <= 0 && dj < 16 && mismoPiso) { e.sonido = 3 + Math.random() * 4; J.son.sfx(e.tipo === 'golem' ? 'golem' : e.tipo, { anti: 300 }); }
    if (e.frenado > 0) {
      // retroceso: se desliza con el empujón y se frena
      e.frenado -= dt;
      e.p.addScaledVector(e.v, dt);
      e.v.multiplyScalar(Math.exp(-dt * 6));
      this.apoyar(e);
      return;
    }
    const cazador = e.tipo !== 'cangrejo' || J.noche > 0.55 || e.enojado;
    switch (e.estado) {
      case 'paseo': {
        if (lo_ve && cazador && e.saliendo <= 0) { e.estado = 'caza'; break; }
        if (!e.destino || e.t > 5) {
          e.t = 0;
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
          e.destino = _w.set(e.casa.x + Math.cos(a) * r, 0, e.casa.z + Math.sin(a) * r).clone();
        }
        this.mover(e, dt, e.destino, T.vel * 0.4);
        break;
      }
      case 'caza':
        if (!lo_ve && dj > T.vista * 1.6) { e.estado = 'paseo'; e.t = 0; break; }
        if (e.tipo === 'golem') this.pensarGolem(e, dt, dj);
        if (e.estado !== 'caza') break;
        if (dj < T.alcance) { e.estado = 'carga'; e.t = 0; break; }
        this.mover(e, dt, pj, T.vel * (e.enojado && e.tipo === 'golem' ? 1.45 : 1));
        break;
      case 'carga':
        // se ve venir: mira al jugador y prepara el golpe
        e.yaw = girar(e.yaw, Math.atan2(dx, dz), dt * 8);
        if (e.tipo === 'golem') this.mostrarAviso(e, e.t / (T.carga / (e.enojado ? 1.4 : 1)));
        if (e.t >= T.carga / (e.enojado ? 1.4 : 1)) {
          e.estado = 'golpe'; e.t = 0;
          this.aviso.visible = false;
          if (e.tipo === 'golem') {
            J.son.sfx('golemGolpe');
            J.sacudir(0.5);
            J.part.rafaga(_v.copy(e.p).addScaledVector(_w.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)), 2).add({ x: 0, y: 0.2, z: 0 }), 30, [0x55595f, 0x7a7e86, 0x3a3d45], { vel: 4, arriba: 4, tam: 0.12, esparcir: 2 });
            const golpe = _v.copy(e.p).addScaledVector(_w.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)), 2);
            if (Math.hypot(pj.x - golpe.x, pj.z - golpe.z) < 3.3 && dy < 3) J.combate.danarJugador(T.dano, e.p);
          } else if (dj < T.alcance * 1.3 && dy < 2) J.combate.danarJugador(T.dano, e.p);
        }
        break;
      case 'golpe':
        if (e.t > 0.25) { e.estado = 'pausa'; e.t = 0; }
        break;
      case 'pausa':
        if (e.t > T.pausa / (e.enojado ? 1.5 : 1)) { e.estado = 'caza'; e.t = 0; }
        if (e.tipo !== 'golem') this.mover(e, dt, _w.copy(e.p).sub(_v.set(dx, 0, dz).normalize()), T.vel * 0.3);   // recula un poco
        break;
      default: break;
    }
    this.apoyar(e);
  }

  // el gólem tira rocas si estás lejos, y a media vida se enoja
  pensarGolem(e, dt, dj) {
    const J = this.J;
    if (!e.enojado && e.vida < e.T.vida * 0.5) {
      e.enojado = true;
      J.son.sfx('golem');
      J.hud.noti(J.t('n.jefeEnojado'), null, 'jefe');
      J.part.rafaga(_v.copy(e.p).add({ x: 0, y: 2.5, z: 0 }), 40, [0x5ff6ff, 0xffffff, 0x2cc3dc], { vel: 5, arriba: 4, tam: 0.1 });
    }
    e.tAtaque -= dt;
    if (dj > 5 && dj < 15 && e.tAtaque <= 0) {
      e.tAtaque = e.enojado ? 2.2 : 3.4;
      const desde = _v.copy(e.p).add({ x: 0, y: 3.2, z: 0 });
      const hacia = J.jugador.p.clone().add({ x: 0, y: 0.8, z: 0 });
      const T = 1.1;
      const vel = new THREE.Vector3((hacia.x - desde.x) / T, (hacia.y - desde.y + 0.5 * 14 * T * T) / T, (hacia.z - desde.z) / T);
      const m = new THREE.Mesh(geoRoca(300 + Math.floor(Math.random() * 20), 0.85).scale(0.45, 0.45, 0.45), this.matRoca);
      m.castShadow = true;
      m.position.copy(desde);
      J.escena.add(m);
      this.proyectiles.push({ m, v: vel, t: 0, dano: 16 });
      J.son.sfx('lanzar');
    }
  }

  mostrarAviso(e, u) {
    const a = this.aviso;
    a.visible = true;
    a.position.copy(e.p).addScaledVector(_w.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)), 2);
    a.position.y = this.J.fisica.suelo(a.position.x, a.position.z, e.p.y + 1) + 0.05;
    a.scale.setScalar(3.3 * Math.min(1, 0.4 + u * 0.6));
    a.material.opacity = 0.25 + 0.4 * u;
  }

  actualizarProyectiles(dt) {
    const J = this.J, pj = J.jugador.p;
    for (let i = this.proyectiles.length - 1; i >= 0; i--) {
      const r = this.proyectiles[i];
      r.t += dt;
      r.v.y -= 14 * dt;
      r.m.position.addScaledVector(r.v, dt);
      r.m.rotation.x += dt * 5; r.m.rotation.z += dt * 3;
      const p = r.m.position;
      const pega = _v.set(pj.x, pj.y + 0.9, pj.z).distanceTo(p) < 1.0;
      const suelo = J.fisica.suelo(p.x, p.z, p.y + 0.5);
      if (pega || p.y <= suelo + 0.2 || r.t > 4) {
        if (pega) J.combate.danarJugador(r.dano, p);
        J.part.rafaga(p, 16, [0x9a9284, 0x6e685e, 0xb8b0a0], { vel: 3, arriba: 3, tam: 0.09 });
        J.son.sfx('romperPiedra');
        J.escena.remove(r.m);
        this.proyectiles.splice(i, 1);
      }
    }
  }

  // Caminar hacia un punto, sin meterse al agua honda ni atravesar paredes.
  mover(e, dt, destino, vel) {
    const J = this.J, T = e.T;
    const dx = destino.x - e.p.x, dz = destino.z - e.p.z, d = Math.hypot(dx, dz);
    if (d < 0.2) { e.v.x *= 0.8; e.v.z *= 0.8; return; }
    e.yaw = girar(e.yaw, Math.atan2(dx, dz), dt * (T.jefe ? 2.5 : 7));
    // el cangrejo camina de costado, como corresponde
    const ang = e.tipo === 'cangrejo' ? e.yaw + Math.sin(e.t * 1.3 + e.fase) * 0.9 : e.yaw;
    const nx = e.p.x + Math.sin(ang) * vel * dt, nz = e.p.z + Math.cos(ang) * vel * dt;
    if (!T.vuela && e.p.y > -30) {
      const h = J.mundo.terreno.altura(nx, nz);
      if (h < (e.tipo === 'cangrejo' ? -0.7 : -0.35)) return;   // al agua honda no
    }
    e.p.x = nx; e.p.z = nz;
  }

  // Pegarlo al piso (o hacerlo volar) y empujarlo fuera de lo sólido.
  apoyar(e) {
    const J = this.J, T = e.T;
    if (e.p.y < -30) {
      J.mina.empujar(e.p, T.radio);
      if (T.vuela) {
        const alto = MINA_Y + 1.6 + Math.sin(e.t * 2 + e.fase) * 0.5;
        e.p.y += (alto - e.p.y) * 0.08;
      } else e.p.y = MINA_Y;
      return;
    }
    for (const o of J.mundo.obstaculos(e.p.x, e.p.z, T.radio)) {
      const dx = e.p.x - o.x, dz = e.p.z - o.z, d = Math.hypot(dx, dz), min = o.r + T.radio;
      if (d < min && d > 1e-5) { e.p.x = o.x + (dx / d) * min; e.p.z = o.z + (dz / d) * min; }
    }
    J.bloques.empujar(e.p, T.radio, T.alto, 0.4);
    const s = J.fisica.suelo(e.p.x, e.p.z, e.p.y + 0.5);
    e.p.y = T.vuela ? s + 1.6 : s - (e.saliendo || 0) * 1.6;
  }

  // ── recibir ─────────────────────────────────────────────────────────────
  golpear(e, dano, desde, empuje = 5) {
    const J = this.J;
    if (e.estado === 'muerto') return;
    e.vida -= dano;
    e.destello = 0.09;
    e.enojado = true;
    const dir = _v.copy(e.p).sub(desde).setY(0).normalize();
    e.v.copy(dir).multiplyScalar(empuje / e.T.peso);
    e.frenado = e.T.jefe ? 0.08 : 0.25;
    if (e.estado === 'carga' && !e.T.jefe) e.estado = 'caza';
    if (e.vida <= 0) this.morir(e, true);
  }

  morir(e, conBotin) {
    const J = this.J;
    e.estado = 'muerto';
    e.t = 0;
    this.aviso.visible = false;
    const c = _v.copy(e.p).add({ x: 0, y: e.T.alto * 0.5, z: 0 });
    const colores = { cangrejo: [0xe0643a, 0xa8402a, 0xffffff], esqueleto: [0xf1ead8, 0xb9b09a, 0xc8252e], murcielago: [0x3a2848, 0x2a1d36], golem: [0x9a9284, 0x5ff6ff, 0x6e685e, 0xffffff] }[e.tipo];
    J.part.rafaga(c, e.T.jefe ? 80 : 24, colores, { vel: e.T.jefe ? 6 : 3, arriba: 4, tam: e.T.jefe ? 0.14 : 0.07, esparcir: e.T.radio });
    J.son.sfx(e.tipo === 'esqueleto' ? 'hueso' : e.tipo === 'golem' ? 'golemGolpe' : 'golpeCarne');
    if (conBotin) {
      for (const [id, n, prob] of e.T.botin) if (Math.random() < prob) J.objetos.soltar(id, n, c.clone());
      J.stats.enemigos = (J.stats.enemigos || 0) + 1;
      J.stats['vencidos_' + e.tipo] = (J.stats['vencidos_' + e.tipo] || 0) + 1;
    }
    if (e.T.jefe && conBotin) {
      this.jefeVencido = true;
      J.alVencerJefe();
    }
  }

  animarMuerte(e, dt) {
    e.t += dt;
    e.g.rotation.z = Math.min(1.5, e.t * 4) * (e.tipo === 'golem' ? 0.3 : 1);
    e.g.position.y -= dt * (e.tipo === 'golem' ? 0.8 : 0.4);
    const k = Math.max(0, 1 - e.t / 0.7);
    e.g.scale.setScalar(Math.max(0.01, k));
    if (e.t > 0.7) this.quitar(e);
  }

  // ── animar ──────────────────────────────────────────────────────────────
  animar(e, dt) {
    const g = e.g, U = g.userData;
    g.position.copy(e.p);
    g.rotation.set(0, e.yaw, 0);
    const vel = e.estado === 'caza' || e.estado === 'paseo' ? 1 : 0;
    e.fase += dt * (e.estado === 'caza' ? 11 : 6) * vel;
    const s = Math.sin(e.fase);
    // el destello blanco del golpe: cambiar los materiales un momento
    const blanco = e.destello > 0;
    if (blanco !== e.enBlanco) {
      e.enBlanco = blanco;
      g.traverse((o) => { if (o.isMesh) o.material = blanco ? BLANCO() : o.userData.mat; });
    }
    const carga = e.estado === 'carga' ? Math.min(1, e.t / e.T.carga) : 0;
    const golpe = e.estado === 'golpe' ? 1 - Math.min(1, e.t / 0.25) : 0;
    if (e.tipo === 'cangrejo') {
      for (const p of U.patas) p.m.rotation.z = p.s * (0.35 + Math.sin(e.fase * 2 + p.k * 2) * 0.3);
      U.pinzas.forEach((p, k) => { p.rotation.x = -carga * 0.8 + golpe * 0.6 + Math.sin(e.t * 3 + k) * 0.08; });
      U.cuerpo.position.y = Math.abs(s) * 0.03;
    } else if (e.tipo === 'esqueleto') {
      U.piernaI.rotation.x = s * 0.6; U.piernaD.rotation.x = -s * 0.6;
      U.brazoI.rotation.x = -s * 0.5;
      U.brazoD.rotation.x = s * 0.4 - carga * 2.4 + golpe * 1.6;
      U.cabeza.rotation.y = Math.sin(e.t * 1.7) * 0.2;
      g.position.y += Math.abs(s) * 0.04;
    } else if (e.tipo === 'murcielago') {
      const aleteo = Math.sin(e.t * 26);
      for (const { a, s: lado } of U.alas) a.rotation.z = lado * aleteo * 0.8;
      g.position.y += Math.sin(e.t * 5) * 0.08;
    } else if (e.tipo === 'golem') {
      U.piernaI.rotation.x = s * 0.35; U.piernaD.rotation.x = -s * 0.35;
      const arriba = carga * 2.6 - golpe * 2.2;
      U.brazoI.rotation.x = -s * 0.25 - arriba; U.brazoD.rotation.x = s * 0.25 - arriba;
      U.cabeza.rotation.y = Math.sin(e.t * 0.9) * 0.3;
      g.position.y += Math.abs(s) * 0.06;
      // el corazón de cristal destella en el lomo
      if (Math.random() < dt * 3) this.J.part.destello(_v.copy(e.p).add({ x: (Math.random() - 0.5), y: 2.5 + Math.random(), z: -0.6 }), { color: 0x9ffcff, tam: 0.35 });
    }
  }

  // El más cercano en el cono de la mira, al alcance del arma.
  apuntado(origen, dir, alcance, cono = 0.8) {
    let mejor = null, dmin = alcance;
    for (const e of this.lista) {
      if (e.estado === 'muerto') continue;
      _v.copy(e.p).add({ x: 0, y: e.T.alto * 0.5, z: 0 }).sub(origen);
      const d = _v.length() - e.T.radio;
      if (d > dmin) continue;
      _v.normalize();
      if (_v.dot(dir) < cono) continue;
      dmin = d; mejor = e;
    }
    return mejor;
  }

  serializar() { return { jefeVencido: this.jefeVencido }; }
  cargar(d) { this.jefeVencido = !!(d && d.jefeVencido); }
}

function girar(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
