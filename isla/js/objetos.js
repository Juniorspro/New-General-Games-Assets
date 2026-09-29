// Los ítems sueltos en el mundo: caen, rebotan, ruedan un poco y en el agua
// FLOTAN ("todo flota por ahora, así no perdés cosas en el mar", como dice el
// autor). Las gemas destellan y los raros hacen lo suyo: los quarks aparecen y
// desaparecen, el uranio deja estelas, la gravinita muestra la grilla del
// espacio-tiempo y la estrella caída ilumina.
import * as THREE from '../vendor/three.module.min.js';
import { ITEMS, modeloItem } from './items.js';

const _v = new THREE.Vector3();

export class Objetos {
  constructor(escena, mundo, particulas, luces) {
    this.escena = escena;
    this.mundo = mundo;
    this.part = particulas;
    this.luces = luces;
    this.lista = [];
    this.grilla = null;
    this.cabe = null;   // (id) → si entra en el inventario; si no, queda en el piso
  }

  soltar(id, n, pos, vel = null) {
    if (!ITEMS[id] || n <= 0) return null;
    const g = modeloItem(id);
    const esc = ITEMS[id].tipo === 'herramienta' ? 0.75 : 1;
    g.scale.setScalar(esc);
    g.position.copy(pos);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.escena.add(g);
    const o = { id, n, g, esc, v: vel ? vel.clone() : new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2), t: 0, quieto: false, flota: false, fase: Math.random() * 6.28, luz: null, juntando: 0 };
    const it = ITEMS[id];
    if (it.luz) o.luz = this.luces.agregar(o.g.position, it.luz);
    this.lista.push(o);
    return o;
  }

  quitar(o) {
    this.escena.remove(o.g);
    if (o.luz) this.luces.quitar(o.luz);
    this.lista.splice(this.lista.indexOf(o), 1);
  }

  // El ítem al que apunta la mira (para el cartelito y para juntar con E).
  apuntado(origen, dir, alcance = 3.6) {
    let mejor = null, dmin = Infinity;
    for (const o of this.lista) {
      if (o.juntando) continue;
      _v.copy(o.g.position).add({ x: 0, y: 0.12, z: 0 }).sub(origen);
      const t = _v.dot(dir);
      if (t < 0 || t > alcance) continue;
      const lat = Math.sqrt(Math.max(0, _v.lengthSq() - t * t));
      if (lat < 0.32 && t < dmin) { dmin = t; mejor = o; }
    }
    return mejor;
  }

  actualizar(dt, jugador, nivelAgua, alJuntar) {
    const M = this.mundo;
    const pj = jugador.p;
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const o = this.lista[i];
      o.t += dt;
      const p = o.g.position;
      if (o.juntando > 0) {
        // vuela hacia el jugador y se suma al inventario al llegar
        o.juntando += dt;
        const destino = _v.set(pj.x, pj.y + 1.1, pj.z);
        p.lerp(destino, Math.min(1, dt * 12));
        o.g.scale.multiplyScalar(Math.max(0.2, 1 - dt * 3));
        if (p.distanceTo(destino) < 0.35 || o.juntando > 0.6) {
          const resto = alJuntar(o);
          if (resto > 0) { o.n = resto; o.juntando = 0; o.t = -2; o.quieto = false; o.g.scale.setScalar(o.esc); o.v.set(0, 2, 0); }
          else this.quitar(o);
        }
        continue;
      }
      const s = M.suelo(p.x, p.z, p.y + 0.3);
      // en la mina no hay mar: sin esto, lo que se suelta abajo "flota" hasta el nivel 0
      const nivel = p.y < -30 ? -1e9 : nivelAgua;
      if (s < nivel - 0.05 && p.y < nivel + 0.1) {
        // flotar: un resorte sobre el nivel del agua y un vaivén lento
        o.flota = true;
        const obj = nivel - 0.06 + Math.sin(o.t * 1.6 + o.fase) * 0.035;
        o.v.y += ((obj - p.y) * 10 - o.v.y * 3) * dt;
        o.v.x *= Math.exp(-dt * 1.5); o.v.z *= Math.exp(-dt * 1.5);
        o.v.x += Math.sin(o.t * 0.3 + o.fase) * 0.05 * dt; o.v.z += Math.cos(o.t * 0.25 + o.fase) * 0.05 * dt;
        p.addScaledVector(o.v, dt);
        o.g.rotation.z = Math.sin(o.t * 1.3 + o.fase) * 0.12;
        o.g.rotation.x = Math.cos(o.t * 1.1 + o.fase) * 0.1;
      } else if (!o.quieto) {
        o.flota = false;
        o.v.y -= 18 * dt;
        p.addScaledVector(o.v, dt);
        if (p.y <= s) {
          p.y = s;
          if (o.v.y < -2) { o.v.y *= -0.3; o.v.x *= 0.5; o.v.z *= 0.5; }
          else { o.v.set(0, 0, 0); o.quieto = true; }
        }
        o.g.rotation.y += dt * (Math.abs(o.v.x) + Math.abs(o.v.z));
      } else if (p.y > s + 0.02 || p.y < s - 0.3) { o.quieto = false; }

      // cada objeto suelto es un draw call: lo lejano no se dibuja
      const lejos = p.distanceToSquared(pj) > 48 * 48;
      o.g.visible = !lejos;
      if (lejos) continue;
      const it = ITEMS[o.id];
      // destellos de gemas y raros
      if ((it.tipo === 'gema' || it.tipo === 'raro' || o.id === 'oro') && Math.random() < dt * 2.2) {
        this.part.destello(_v.copy(p).add({ x: (Math.random() - 0.5) * 0.4, y: 0.1 + Math.random() * 0.3, z: (Math.random() - 0.5) * 0.4 }), { color: 0xffffff, tam: 0.1 });
      }
      const anim = o.g.userData.animar;
      if (anim === 'quarks') {
        for (const h of o.g.children) if (h.userData.quark !== undefined) {
          const k = Math.max(0, Math.sin(o.t * 5 + h.userData.quark * 1.7));
          h.scale.setScalar(0.2 + k * 1.1);
        }
      } else if (anim === 'uranio') {
        if (Math.random() < dt * 14) this.part.rafaga(_v.copy(p).add({ x: 0, y: 0.15, z: 0 }), 1, [0x9fff4a, 0x6aff2a], { vel: 2.2, arriba: 0.8, g: 0, vida: 1.4, tam: 0.035 });
      } else if (anim === 'gravinita') {
        this.grilla = this.grilla || this.crearGrilla();
        this.grilla.visible = true;
        this.grilla.position.copy(p);
        this.grilla.material.opacity = 0.5 + 0.2 * Math.sin(o.t * 2);
      } else if (o.id === 'estrella') {
        if (Math.random() < dt * 10) this.part.rafaga(_v.copy(p).add({ x: 0, y: 0.18, z: 0 }), 1, [0xffd040, 0xff8a10, 0xffe27a], { vel: 0.4, arriba: 1.2, g: -1, vida: 0.7, tam: 0.05 });
      }
      if (o.luz) o.luz.pos.copy(p).add({ x: 0, y: 0.3, z: 0 });
      // juntar solo si pasás por arriba
      if (o.t > 0.6 && Math.hypot(p.x - pj.x, p.z - pj.z) < 1.1 && Math.abs(p.y - pj.y - 0.5) < 1.3 && (!this.cabe || this.cabe(o.id))) o.juntando = 0.001;
    }
    if (this.grilla && !this.lista.some((o) => o.g.userData.animar === 'gravinita' && !o.juntando)) this.grilla.visible = false;
  }

  crearGrilla() {
    // la red del espacio-tiempo: líneas en el mundo que se ven cerca del ítem
    const pos = [], R = 1.6, paso = 0.4;
    for (let a = -R; a <= R + 1e-6; a += paso) for (let b = -R; b <= R + 1e-6; b += paso) {
      pos.push(-R, a, b, R, a, b); pos.push(a, -R + R, b, a, R + R, b); pos.push(a, b + R, -R, a, b + R, R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x7a5cff, transparent: true, opacity: 0.5, depthWrite: false }));
    this.escena.add(l);
    return l;
  }

  serializar() { return this.lista.filter((o) => !o.juntando).map((o) => [o.id, o.n, +o.g.position.x.toFixed(2), +o.g.position.y.toFixed(2), +o.g.position.z.toFixed(2)]); }
  cargar(datos) {
    for (const o of [...this.lista]) this.quitar(o);
    if (!Array.isArray(datos)) return;
    for (const d of datos.slice(0, 600)) {
      if (!Array.isArray(d) || !ITEMS[d[0]] || !d.slice(2, 5).every(Number.isFinite)) continue;
      const o = this.soltar(d[0], Math.max(1, d[1] | 0), new THREE.Vector3(d[2], d[3], d[4]), new THREE.Vector3());
      if (o) o.quieto = true;
    }
  }
}
