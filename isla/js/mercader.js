// El mercader: de día (desde el segundo) amarra su bote al costado del muelle
// y de noche se va.
// Compra lo que juntaste al 80 % de lo que vale y vende lo que no se fabrica.
// Le da sentido a los precios de las gemas: la plata ahora sirve.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { mergeSimple } from './rocas.js';
import { ITEMS } from './items.js';

const caja = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const _v = new THREE.Vector3();

export const OFERTAS = [
  { id: 'flecha', n: 10, precio: 60 },
  { id: 'pocion', n: 1, precio: 300 },
  { id: 'coco', n: 3, precio: 40 },
  { id: 'farol', n: 1, precio: 350 },
  { id: 'mapaTesoro', n: 1, precio: 1200, unico: true },
  { id: 'espadaHierro', n: 1, precio: 900 },
  { id: 'petoHierro', n: 1, precio: 1600 },
  { id: 'canaBuena', n: 1, precio: 1800 },
];
export const PARTE_VENTA = 0.8;

export class Mercader {
  constructor(J) {
    this.J = J;
    const W = J.mundo, M = W.M;
    const C = W.choza.grupo.position, pu = W.muelle.punta;
    const D = new THREE.Vector3(pu.x - C.x, 0, pu.z - C.z).normalize();
    const P = new THREE.Vector3(-D.z, 0, D.x);
    this.pos = C.clone().addScaledVector(D, 9).addScaledVector(P, 2.9);
    this.pos.y = 0;
    const g = (this.grupo = new THREE.Group());
    // el bote
    g.add(new THREE.Mesh(mergeSimple([caja(1.5, 0.5, 3.4, 0, 0.1, 0), caja(1.1, 0.35, 0.9, 0, 0.2, 1.9).rotateX(-0.3), caja(1.6, 0.12, 3.6, 0, 0.38, 0)]), M.maderaOscura));
    g.add(new THREE.Mesh(caja(1.3, 0.06, 3.1, 0, 0.36, 0), M.madera));
    // mercancía: cajones atrás bajo el toldo; él adelante, a la vista del muelle
    g.add(new THREE.Mesh(mergeSimple([caja(0.5, 0.4, 0.5, 0.3, 0.6, -0.9), caja(0.45, 0.35, 0.45, -0.3, 0.58, -1.0), caja(0.4, 0.3, 0.4, 0.2, 0.95, -0.95)]), M.madera));
    const toldo = matPixel('liso', { color: 0xe8b42f, lados: THREE.DoubleSide, clave: 'toldo' });
    g.add(new THREE.Mesh(mergeSimple([caja(0.08, 1.6, 0.08, 0.65, 1.2, -0.25), caja(0.08, 1.6, 0.08, -0.65, 1.2, -0.25), caja(0.08, 1.6, 0.08, 0.65, 1.2, -1.55), caja(0.08, 1.6, 0.08, -0.65, 1.2, -1.55)]), M.madera));
    g.add(new THREE.Mesh(caja(1.6, 0.06, 1.6, 0, 2.02, -0.9), toldo));
    // el mercader: de bloques, con sombrero y barba
    const piel = matPixel('liso', { color: 0xd99a6c, clave: 'pielMercader' });
    const ropa = matPixel('liso', { color: 0x2f7a8a, clave: 'ropaMercader' });
    const pelo = matPixel('liso', { color: 0xe8e2d6, clave: 'barba' });
    const sombrero = matPixel('liso', { color: 0xc9a458, clave: 'sombrero' });
    const npc = (this.npc = new THREE.Group());
    npc.add(new THREE.Mesh(caja(0.46, 0.6, 0.28, 0, 1.0, 0), ropa));
    npc.add(new THREE.Mesh(caja(0.36, 0.36, 0.34, 0, 1.5, 0), piel));
    npc.add(new THREE.Mesh(caja(0.3, 0.16, 0.06, 0, 1.38, 0.17), pelo));
    npc.add(new THREE.Mesh(mergeSimple([caja(0.62, 0.05, 0.62, 0, 1.72, 0), caja(0.36, 0.2, 0.36, 0, 1.84, 0)]), sombrero));
    npc.add(new THREE.Mesh(caja(0.16, 0.5, 0.16, -0.14, 0.45, 0), ropa));
    npc.add(new THREE.Mesh(caja(0.16, 0.5, 0.16, 0.14, 0.45, 0), ropa));
    this.brazo = new THREE.Group();
    this.brazo.add(new THREE.Mesh(caja(0.14, 0.5, 0.14, 0, -0.25, 0), ropa));
    this.brazo.position.set(0.31, 1.28, 0);
    npc.add(this.brazo);
    npc.add(new THREE.Mesh(caja(0.14, 0.5, 0.14, -0.31, 1.03, 0), ropa));
    npc.position.set(0, 0.4, 0.8);
    g.add(npc);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.layers.enable(1); } });
    g.position.copy(this.pos);
    g.rotation.y = Math.atan2(-P.x, -P.z);   // mira al muelle
    J.escena.add(g);
    this.vendidos = new Set();   // las ofertas únicas que ya compraste
    this.t = 0;
  }

  // el primer día no viene: todavía no tenés nada para venderle
  presente() { const h = this.J.cielo.hora; return this.J.dia >= 2 && h > 0.29 && h < 0.76; }

  cerca(p) { return this.grupo.visible && Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 4.2 && p.y > -5; }

  actualizar(dt) {
    const J = this.J;
    this.t += dt;
    this.grupo.visible = this.presente() && !J.bajo;
    if (!this.grupo.visible) return;
    this.grupo.position.y = -0.2 + Math.sin(this.t * 1.1) * 0.06;
    this.grupo.rotation.z = Math.sin(this.t * 0.8) * 0.025;
    // saluda cuando te acercás
    const cerca = Math.hypot(J.jugador.p.x - this.pos.x, J.jugador.p.z - this.pos.z) < 7;
    this.brazo.rotation.z = cerca ? -2.4 + Math.sin(this.t * 6) * 0.35 : -0.1;
    this.npc.rotation.y = cerca ? Math.atan2(J.jugador.p.x - this.pos.x, J.jugador.p.z - this.pos.z) - this.grupo.rotation.y : 0;
  }

  precioVenta(id) { return Math.max(1, Math.round((ITEMS[id]?.valor || 0) * PARTE_VENTA)); }

  // vender de una ranura: uno o la pila entera
  vender(inv, i, todo) {
    const J = this.J, r = inv.ranuras[i];
    if (!r) return 0;
    if (r.id === 'corazonCristal' || r.id === 'mapaTesoro') { J.hud.noti(J.t('n.noVende'), r.id, 'noVende'); return 0; }
    const n = todo ? r.n : 1;
    const plata = this.precioVenta(r.id) * n;
    inv.quitarDe(i, n);
    J.plata += plata;
    J.stats.vendido = (J.stats.vendido || 0) + plata;
    J.son.sfx('moneda');
    return plata;
  }

  comprar(o) {
    const J = this.J;
    if (o.unico && this.vendidos.has(o.id)) return false;
    if (J.plata < o.precio || !J.inv.cabe(o.id, o.n)) { J.son.sfx('ui'); return false; }
    J.plata -= o.precio;
    J.inv.agregar(o.id, o.n);
    if (o.unico) this.vendidos.add(o.id);
    J.son.sfx('moneda');
    J.alComprar(o);
    return true;
  }

  serializar() { return [...this.vendidos]; }
  cargar(d) { this.vendidos = new Set(Array.isArray(d) ? d.filter((id) => ITEMS[id]) : []); }
}
