// Las luces chicas (farol en la mano, faroles de pie, estrellas caídas): hay
// cuatro lugares en el shader, así que cada cuadro se eligen las cuatro más
// cercanas a la cámara. Más luces que eso en pantalla no se notan.
import { LUZ } from './material.js';

export class Luces {
  constructor() { this.lista = []; }
  agregar(pos, [r, g, b, radio], intensidad = 1.6) {
    // arriba o en la mina se decide por la altura (como los objetos): una luz
    // de la superficie nunca alumbra un pasillo de abajo aunque quede cerca
    const l = { pos: pos.clone(), r, g, b, radio, intensidad, parpadeo: Math.random() * 6, encendida: true };
    this.lista.push(l);
    return l;
  }
  quitar(l) { const i = this.lista.indexOf(l); if (i >= 0) this.lista.splice(i, 1); }
  actualizar(dt, camara) {
    const orden = this.lista
      .filter((l) => l.encendida && (l.pos.y < -30) === (camara.position.y < -30))
      .map((l) => ({ l, d: l.pos.distanceToSquared(camara.position) }))
      .filter((x) => x.d < 60 * 60)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const P = LUZ.uLucesPos.value[i], C = LUZ.uLucesColor.value[i];
      const x = orden[i];
      if (!x) { C.w = 0; continue; }
      const l = x.l;
      l.parpadeo += dt;
      const temblor = 1 + Math.sin(l.parpadeo * 9.3) * 0.04 + Math.sin(l.parpadeo * 17.1) * 0.03;
      P.set(l.pos.x, l.pos.y, l.pos.z, l.radio);
      C.set(l.r, l.g, l.b, l.intensidad * temblor);
    }
  }
}
