/* Las luces de UE son muchas: se dibujan sólo las más cercanas con un juego fijo de luces de three
   (así el shader no se recompila). Unidades: UE 4.16 sin unidades con caída 1/d² → intensidad*16/1e4. */
import * as THREE from 'three';
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
export class Luces {
  constructor(escena, nPuntos = 4, nFocos = 3) {
    this.puntos = []; this.focos = [];
    for (let i = 0; i < nPuntos; i++) { const l = new THREE.PointLight(0xffffff, 0, 1, 2); escena.add(l); this.puntos.push(l); }
    for (let i = 0; i < nFocos; i++) { const l = new THREE.SpotLight(0xffffff, 0, 1, 0.5, 0, 2); escena.add(l); escena.add(l.target); this.focos.push(l); }
    this.virtuales = []; this.escala = 16 / 1e4; this.extra = [];
  }
  usar(lista) { this.virtuales = lista; }
  visible(v) { for (let o = v.obj; o; o = o.parent) if (!o.visible) return false; return true; }
  update(cam) {
    const cand = { Point: [], Spot: [] };
    for (const v of [...this.virtuales, ...this.extra]) {
      if (v.int <= 0 || !this.visible(v)) continue;
      v.obj.getWorldPosition(_p);
      const dist = _p.distanceTo(cam), r = v.radio || 10;
      if (dist > r + 2) continue;
      cand[v.tipo]?.push({ v, pos: _p.clone(), peso: dist / r - (v.prioridad || 0) });
    }
    const poner = (luces, lista, foco) => {
      lista.sort((a, b) => a.peso - b.peso);
      luces.forEach((l, i) => {
        const c = lista[i];
        if (!c) { l.intensity = 0; return; }
        const v = c.v;
        l.position.copy(c.pos); l.color.setRGB(v.color[0], v.color[1], v.color[2]);
        l.intensity = v.int * (v.k ?? this.escala) * (v.mult ?? 1); l.distance = v.radio || 10; l.decay = 2;
        if (foco) {
          v.obj.getWorldQuaternion(_q); _d.set(1, 0, 0).applyQuaternion(_q);
          l.target.position.copy(c.pos).add(_d); l.target.updateMatrixWorld();
          const out = THREE.MathUtils.degToRad(Math.min(89, v.out ?? 44)); l.angle = out;
          l.penumbra = Math.min(1, Math.max(0.05, 1 - (v.in ?? 0) / Math.max(1e-3, v.out ?? 44)));
        }
      });
    };
    poner(this.puntos, cand.Point, false); poner(this.focos, cand.Spot, true);
  }
}
