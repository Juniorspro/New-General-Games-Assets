// Pescar: como en Minecraft (el autor dice que por ahora es igual y que tal vez
// lo cambie): tirás, la boya flota, cuando se hunde tocás y sale lo que picó.
// Con la caña dorada salen más tesoros; de noche, más peces abisales.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { ITEMS } from './items.js';

const TABLA = [
  ['atun', 34], ['payaso', 20], ['calamar', 15], ['abisal', 5], ['rama', 6], ['fibra', 4],
  ['botella', 8], ['moneda', 3], ['cielo', 0.8], ['estrella', 0.7], ['perla', 0],
];

export class Pesca {
  constructor(escena, mundo, particulas, sonido) {
    this.mundo = mundo; this.part = particulas; this.son = sonido;
    this.estado = 'nada';   // nada · volando · esperando · pica · recogiendo
    this.boya = new THREE.Group();
    const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), matPixel('liso', { color: 0xff3a3a, texeles: 64, clave: 'boya' }));
    const tapa = new THREE.Mesh(new THREE.SphereGeometry(0.071, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), matPixel('liso', { color: 0xffffff, texeles: 64, clave: 'boyaTapa' }));
    this.boya.add(cuerpo, tapa);
    this.boya.visible = false;
    escena.add(this.boya);
    const g = new THREE.BufferGeometry();
    this.lineaPos = new Float32Array(16 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.lineaPos, 3));
    this.linea = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf4f6fa, transparent: true, opacity: 0.8 }));
    this.linea.frustumCulled = false;
    this.linea.visible = false;
    escena.add(this.linea);
    this.v = new THREE.Vector3();
    this.espera = 0; this.ventana = 0; this.t = 0;
    this.pez = null;
  }

  activa() { return this.estado !== 'nada'; }

  // Un toque con la caña en la mano: tirar, recoger o sacar lo que picó.
  tocar(origen, dir, nivel) {
    if (this.estado === 'nada') {
      this.boya.position.copy(origen).addScaledVector(dir, 0.6);
      this.v.copy(dir).multiplyScalar(11).add(new THREE.Vector3(0, 3.2, 0));
      this.estado = 'volando'; this.t = 0; this.nivel = nivel;
      this.boya.visible = this.linea.visible = true;
      this.son.sfx('lanzar');
      return null;
    }
    if (this.estado === 'pica') {
      const id = this.sortear();
      this.recoger();
      this.son.sfx('atrapar');
      this.part.rafaga(this.boya.position, 14, [0xffffff, 0x9ff5ea, 0x6fe3dc], { vel: 2, arriba: 4 });
      return { id, desde: this.boya.position.clone() };
    }
    this.recoger();
    return null;
  }

  recoger() { this.estado = 'nada'; this.boya.visible = this.linea.visible = false; }

  sortear() {
    const noche = this.noche || 0;
    const tabla = TABLA.filter(([id]) => ITEMS[id]).map(([id, p]) => {
      let w = p;
      if (id === 'abisal') w *= 1 + noche * 2.5;
      if (this.nivelCana >= 2 && ['botella', 'moneda', 'cielo', 'estrella'].includes(id)) w *= 2.4;
      return [id, w];
    });
    const total = tabla.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [id, w] of tabla) { r -= w; if (r <= 0) return id; }
    return 'atun';
  }

  actualizar(dt, puntaCana, jugador, nivelCana, noche) {
    this.nivelCana = nivelCana; this.noche = noche;
    if (this.estado === 'nada') return;
    this.t += dt;
    const b = this.boya.position;
    if (this.estado === 'volando') {
      this.v.y -= 14 * dt;
      b.addScaledVector(this.v, dt);
      const suelo = this.mundo.suelo(b.x, b.z, b.y);
      if (b.y <= this.nivel && suelo < this.nivel - 0.25) {
        b.y = this.nivel;
        this.estado = 'esperando';
        this.espera = 2.5 + Math.random() * 6 / nivelCana;
        this.son.sfx('plop');
        this.part.rafaga(b, 8, [0xffffff, 0x9ff5ea], { vel: 1, arriba: 2, tam: 0.05 });
      } else if (b.y <= suelo) { b.y = suelo; this.estado = 'enTierra'; this.t = 0; }
    } else if (this.estado === 'enTierra') {
      if (this.t > 0.8) this.recoger();
    } else if (this.estado === 'esperando') {
      b.y = this.nivel + Math.sin(this.t * 3) * 0.02;
      this.espera -= dt;
      if (Math.random() < dt * 0.6) this.part.rafaga(b, 1, 0xffffff, { vel: 0.3, arriba: 0.6, tam: 0.03, vida: 0.4 });
      if (this.espera <= 0) {
        this.estado = 'pica'; this.ventana = 1.1; this.son.sfx('pica');
        this.part.rafaga(b, 10, [0xffffff, 0x9ff5ea], { vel: 1.5, arriba: 3, tam: 0.05 });
      }
    } else if (this.estado === 'pica') {
      b.y = this.nivel - 0.14 + Math.sin(this.t * 30) * 0.03;
      this.ventana -= dt;
      if (this.ventana <= 0) { this.estado = 'esperando'; this.espera = 2 + Math.random() * 5; }
    }
    // si te alejás mucho, se corta la línea
    if (b.distanceTo(jugador.p) > 26) this.recoger();
    // la línea: una curva que cuelga entre la punta de la caña y la boya
    const n = this.lineaPos.length / 3;
    const tensa = this.estado === 'pica' ? 0.1 : 1;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = puntaCana.x + (b.x - puntaCana.x) * u, z = puntaCana.z + (b.z - puntaCana.z) * u;
      const y = puntaCana.y + (b.y - puntaCana.y) * u - Math.sin(Math.PI * u) * 0.6 * tensa;
      this.lineaPos[i * 3] = x; this.lineaPos[i * 3 + 1] = y; this.lineaPos[i * 3 + 2] = z;
    }
    this.linea.geometry.attributes.position.needsUpdate = true;
  }
}
