// Las luces del escenario, manejadas por eventos como en el juego original:
// cada grupo (el fondo, los láseres, las alas, la pista…) recibe órdenes de
// "prender", "apagar", "destello" o "desvanecer" con un color de la paleta.
//
// POR QUÉ UN SOLO OBJETO DE UNIFORMS COMPARTIDO. Todos los materiales del
// escenario leen el MISMO arreglo de colores e intensidades. Cambiar un número
// acá cambia a la vez la roca, el ala y su reflejo en el piso: no hay que
// recorrer materiales, y los reflejos no se pueden desincronizar del original.

import * as THREE from "../vendor/three.module.min.js";

import { G, N_GRUPOS, MODO, PALETAS } from "./constantes.js";
export { G, N_GRUPOS, MODO, PALETAS };

export class Luces {
  constructor() {
    this.color = Array.from({ length: N_GRUPOS }, () => new THREE.Color(0, 0, 0));
    this.int = new Float32Array(N_GRUPOS);
    this.uniforms = {
      uLuzColor: { value: this.color },
      uLuzInt: { value: this.int },
      uTiempo: { value: 0 },
      uAbanico: { value: 0 },    // cuánto está girado el abanico
      uEnergia: { value: 0 },    // cuánta "fuerza" tiene la música ahora (0..1)
    };
    this.paleta = PALETAS.dragon.map(c => new THREE.Color(c));
    this.porGrupo = Array.from({ length: N_GRUPOS }, () => []);
    this.cursor = new Int32Array(N_GRUPOS);
    this.suave = false;          // luces suaves: sin estroboscópico
    this.giro = 0; this.velGiro = 0.05;
    this.giroEventos = [];
    this.iGiro = 0;
    this.base = 0.0;             // un piso de luz para el menú
  }

  usarPaleta(nombre) {
    const p = PALETAS[nombre] || PALETAS.dragon;
    this.paleta = p.map(c => new THREE.Color(c));
  }

  /** eventos: [{t, g, m, c}] en segundos. Se ordenan por grupo una vez. */
  cargar(eventos, giros = []) {
    this.porGrupo = Array.from({ length: N_GRUPOS }, () => []);
    for (const e of eventos) this.porGrupo[e.g].push(e);
    for (const l of this.porGrupo) l.sort((a, b) => a.t - b.t);
    this.cursor.fill(0);
    this.giroEventos = [...giros].sort((a, b) => a.t - b.t);
    this.iGiro = 0;
  }

  /** Vuelve atrás los cursores (reinicio o salto hacia atrás en el tiempo). */
  rebobinar() { this.cursor.fill(0); this.iGiro = 0; }

  actualizar(t, dt) {
    const suave = this.suave;
    for (let g = 0; g < N_GRUPOS; g++) {
      const lista = this.porGrupo[g];
      let i = this.cursor[g];
      if (i > 0 && lista[i - 1] && lista[i - 1].t > t) { i = 0; }
      while (i < lista.length && lista[i].t <= t) i++;
      this.cursor[g] = i;
      const e = lista[i - 1];
      let inten = this.base, col = null;
      if (e) {
        const d = t - e.t;
        col = e.c === 3 ? null : this.paleta[e.c | 0];
        switch (e.m) {
          case MODO.APAGAR: inten = 0; break;
          case MODO.PRENDER: inten = 1; break;
          case MODO.DESTELLO:
            // Luces suaves: el pico apenas sobresale y baja despacio. Es lo
            // que pide cualquiera que se marea con los estroboscópicos.
            inten = suave ? 1 + 0.35 * Math.exp(-d / 0.25) : 1 + 2.2 * Math.exp(-d / 0.11);
            break;
          case MODO.DESVANECER:
            inten = suave ? 1.2 * Math.exp(-d / 0.6) : 3.0 * Math.exp(-d / 0.32);
            break;
        }
        if (e.f !== undefined) inten *= e.f;     // un evento puede venir más tenue
      }
      if (col) {
        // El color no salta: se corre en ~60 ms, como una lámpara de verdad.
        const k = Math.min(1, dt * 16);
        this.color[g].lerp(col, k);
      }
      this.int[g] = Math.max(inten, this.base);
    }
    // El giro del abanico acelera con eventos y frena solo.
    while (this.iGiro < this.giroEventos.length && this.giroEventos[this.iGiro].t <= t) {
      this.velGiro = this.giroEventos[this.iGiro].v; this.iGiro++;
    }
    this.giro += this.velGiro * dt;
    this.uniforms.uAbanico.value = this.giro;
    this.uniforms.uTiempo.value = t;
  }

  /** Un estado fijo para cuando no hay canción (portada, menús). */
  ambiente(t, dt, energia = 0.3) {
    const p = this.paleta;
    const lento = 0.5 + 0.5 * Math.sin(t * 0.4);
    const pulso = Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.9), 6);
    const mezclar = (g, c, i) => { this.color[g].lerp(c, Math.min(1, dt * 3)); this.int[g] = i; };
    mezclar(G.FONDO, lento > 0.5 ? p[0] : p[1], 0.75 + 0.2 * pulso * energia);
    mezclar(G.VERTICAL, p[2], 0.35 + 0.4 * pulso * energia);
    mezclar(G.ABANICO, p[0], 0.25 * energia);
    mezclar(G.ALA_IZQ, p[2], 0.7);
    mezclar(G.ALA_DER, p[2], 0.7);
    mezclar(G.PISTA, p[2], 0.8);
    mezclar(G.CUERNOS, p[0], 1);
    mezclar(G.ROCAS, p[1], 0.8);
    this.giro += 0.05 * dt;
    this.uniforms.uAbanico.value = this.giro;
    this.uniforms.uTiempo.value = t;
  }
}
