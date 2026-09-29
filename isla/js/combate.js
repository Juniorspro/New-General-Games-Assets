// Pelear: el golpe de cada arma, el arco y sus flechas, el daño que recibís
// y los números que saltan. Lo que hace que un golpe se SIENTA:
// - parada de golpe: el mundo se congela 50 ms cuando el arma toca;
// - retroceso: el enemigo sale despedido y se frena solo;
// - destello blanco en el enemigo, astillas del color de lo que golpeaste,
//   sacudida de cámara y un número que salta y se apaga;
// - de a uno de cada diez golpes, crítico: más daño y un número dorado.
import * as THREE from '../vendor/three.module.min.js';
import { ITEMS } from './items.js';
import { matPixel } from './material.js';
import { mergeSimple } from './rocas.js';

const _v = new THREE.Vector3(), _dir = new THREE.Vector3();
const ADELANTE = new THREE.Vector3(1, 0, 0);

export class Combate {
  constructor(J) {
    this.J = J;
    this.invulnerable = 0;
    this.flechas = [];
    this.carga = 0;
    this.tensando = false;
    const caja = (w, h, d, x = 0) => new THREE.BoxGeometry(w, h, d).translate(x, 0, 0);
    this.geoFlecha = mergeSimple([caja(0.7, 0.025, 0.025, 0), caja(0.1, 0.06, 0.06, 0.38), caja(0.12, 0.07, 0.01, -0.32)]);
    this.matFlecha = matPixel('liso', { color: 0x9b6a36, texeles: 48, clave: 'flecha' });
  }

  // Cuánto pega lo que tenés en la mano.
  danoDe(it) {
    if (!it) return 1;
    if (it.dano) return it.dano;
    if (it.herr === 'hacha') return 3 + (it.poder || 1);
    if (it.herr === 'pico') return 2 + (it.poder || 1);
    return it.tipo === 'herramienta' ? 2 : 1;
  }

  // El golpe de la mano (en el impacto de la animación). true si pegó.
  golpe(it) {
    const J = this.J;
    const o = J.ojos, d = J.jugador.direccionMirada(_dir);
    const alcance = it && it.alcance ? it.alcance : it && it.tipo === 'herramienta' ? 2.4 : 2.0;
    const e = J.enemigos.apuntado(o, d, alcance + 0.3, 0.7);
    if (!e) {
      if (it && (it.herr === 'espada' || it.herr === 'lanza')) J.son.sfx('espada');
      return false;
    }
    const critico = Math.random() < 0.1;
    const dano = Math.round(this.danoDe(it) * (critico ? 1.6 : 1));
    this.pegar(e, dano, critico, it);
    return true;
  }

  pegar(e, dano, critico, it, desde = this.J.jugador.p) {
    const J = this.J;
    J.enemigos.golpear(e, dano, desde, it && it.herr === 'lanza' ? 7 : 5);
    const c = _v.copy(e.p).add({ x: 0, y: e.T.alto * 0.6, z: 0 });
    const colores = { cangrejo: [0xe0643a, 0xffffff], esqueleto: [0xf1ead8, 0xb9b09a], murcielago: [0x3a2848, 0xff3040], golem: [0x9a9284, 0x5ff6ff] }[e.tipo];
    J.part.rafaga(c, 10, colores, { vel: 3, arriba: 2.5, tam: 0.05, vida: 0.6 });
    if (it && it.id === 'espadaAmatista') J.part.rafaga(c, 12, [0xb46cff, 0xf0d8ff, 0x7a3cff], { vel: 2, arriba: 1, g: 0, vida: 0.8, tam: 0.04 });
    J.son.sfx(e.tipo === 'esqueleto' ? 'hueso' : e.tipo === 'golem' ? 'golpePiedra' : 'golpeCarne');
    if (it && (it.herr === 'espada' || it.herr === 'lanza')) J.son.sfx('espada');
    J.hud.numero(c, (critico ? '¡' : '') + dano, critico ? 'critico' : '');
    J.pausaGolpe = critico ? 0.09 : 0.05;
    J.sacudir(critico ? 0.22 : 0.1);
  }

  // ── el arco: mantener para tensar, soltar para tirar ─────────────────────
  arco(dt, apretado, it) {
    const J = this.J;
    if (apretado) {
      if (!this.tensando) { this.tensando = true; this.carga = 0; }
      this.carga = Math.min(1, this.carga + dt / 0.9);
    } else if (this.tensando) {
      this.tensando = false;
      if (this.carga > 0.18) this.disparar(this.carga, it);
      this.carga = 0;
    }
    J.mano.carga = this.carga;
    J.hud.progreso(this.tensando ? this.carga : null);
  }

  soltarArco() { this.tensando = false; this.carga = 0; this.J.mano.carga = 0; }

  disparar(carga, it) {
    const J = this.J;
    if (!J.inv.quitar('flecha', 1)) { J.hud.noti(J.t('n.sinFlechas'), 'flecha', 'flechas'); return; }
    const d = J.jugador.direccionMirada(_dir);
    const m = new THREE.Mesh(this.geoFlecha, this.matFlecha);
    m.castShadow = true;
    m.position.copy(J.ojos).addScaledVector(d, 0.5).add({ x: 0, y: -0.1, z: 0 });
    J.escena.add(m);
    const v = d.clone().multiplyScalar(16 + 26 * carga);
    this.flechas.push({ m, v, t: 0, clavada: 0, dano: Math.round((it ? it.dano : 11) * (0.45 + 0.55 * carga)) });
    J.son.sfx('arco');
    J.son.sfx('flecha');
  }

  actualizarFlechas(dt) {
    const J = this.J;
    for (let i = this.flechas.length - 1; i >= 0; i--) {
      const f = this.flechas[i];
      const p = f.m.position;
      if (f.clavada > 0) {
        f.clavada -= dt;
        if (f.clavada <= 0) {
          // la mitad se puede volver a usar
          if (Math.random() < 0.5) { const o = J.objetos.soltar('flecha', 1, p.clone(), new THREE.Vector3(0, 1, 0)); if (o) o.t = 0.2; }
          J.escena.remove(f.m); this.flechas.splice(i, 1);
        }
        continue;
      }
      f.t += dt;
      f.v.y -= 11 * dt;
      // de a pasos cortos: a 40 m/s una flecha atraviesa un cangrejo en un cuadro
      const n = Math.max(1, Math.ceil(f.v.length() * dt / 0.3));
      let fin = false;
      for (let k = 0; k < n && !fin; k++) {
        p.addScaledVector(f.v, dt / n);
        for (const e of J.enemigos.lista) {
          if (e.estado === 'muerto') continue;
          _v.copy(e.p).add({ x: 0, y: e.T.alto * 0.55, z: 0 });
          if (_v.distanceTo(p) < e.T.radio + 0.35 + (e.T.jefe ? 0.8 : 0)) {
            const critico = Math.random() < 0.12;
            this.pegar(e, Math.round(f.dano * (critico ? 1.6 : 1)), critico, null, p.clone().addScaledVector(f.v, -0.05));
            J.escena.remove(f.m); this.flechas.splice(i, 1);
            fin = true; break;
          }
        }
        if (fin) break;
        const s = J.fisica.suelo(p.x, p.z, p.y + 0.3);
        if (p.y <= s || f.t > 5) { f.clavada = 8; J.son.sfx('clavar'); J.part.rafaga(p, 4, [0xe8d3a0, 0x9aa0ab], { vel: 1, arriba: 1.5, tam: 0.03 }); fin = true; }
      }
      if (!fin && f.v.lengthSq() > 1e-4) f.m.quaternion.setFromUnitVectors(ADELANTE, _v.copy(f.v).normalize());
    }
  }

  // ── lo que te pegan ─────────────────────────────────────────────────────
  danarJugador(dano, desde) {
    const J = this.J, jp = J.jugador;
    if (this.invulnerable > 0 || jp.vida <= 0 || J.estado !== 'jugando') return;
    const defensa = J.armadura && ITEMS[J.armadura] ? ITEMS[J.armadura].defensa : 0;
    const d = Math.max(1, Math.round(dano * (1 - defensa)));
    jp.vida -= d;
    const dir = _v.copy(jp.p).sub(desde).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0);
    dir.normalize();
    jp.v.x += dir.x * 7; jp.v.z += dir.z * 7; jp.v.y = Math.max(jp.v.y, 4.5);
    this.invulnerable = 0.6;
    J.hud.dano();
    J.sacudir(0.35);
    J.son.sfx('dolor');
    J.stats.golpesRecibidos = (J.stats.golpesRecibidos || 0) + 1;
  }

  actualizar(dt) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.actualizarFlechas(dt);
  }
}
