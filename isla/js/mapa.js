// El mapa (tecla M): la isla vista de arriba, pintada desde las alturas y los
// materiales, con sombra de relieve; encima, marcas: vos (una flecha que mira
// para donde mirás), la choza, la mina, el faro, el mercader, las fogatas y,
// si tenés el mapa del tesoro, la X. En la mina muestra el laberinto que ya
// caminaste (lo demás queda en negro).
//
// Acá también vive el tesoro: una X en una playa lejana que se cava con la
// pala; al bajar medio metro sale un cofre con oro, monedas y gemas.
import * as THREE from '../vendor/three.module.min.js';
import { MITAD, TAM } from './terreno.js';
import { mulberry } from './azar.js';
import { matPixel } from './material.js';
import { mergeSimple } from './rocas.js';

const R = 256;   // píxeles del mapa: uno por metro

export class Mapa {
  constructor(J) {
    this.J = J;
    this.el = document.getElementById('mapa');
    this.lienzo = this.el.querySelector('canvas');
    this.lienzo.width = this.lienzo.height = R;
    this.g = this.lienzo.getContext('2d');
    this.base = null;
    this.abierto = false;
    this.explorado = new Uint8Array(54 * 54);   // las baldosas de la mina que ya viste
    // el tesoro: en arena, lejos de la choza, sin agua encima
    const T = J.mundo.terreno, C = J.mundo.choza.grupo.position;
    const r = mulberry(J.mundo.semilla ^ 0x7e50);
    let mejor = null;
    for (let i = 0; i < 4000; i++) {
      const x = (r() * 2 - 1) * 100, z = (r() * 2 - 1) * 100;
      const h = T.altura(x, z);
      if (h < 0.5 || h > 2 || T.pasto(x, z) > 0.3 || J.mundo.dentroDePiso(x, z, 3)) continue;
      const d = Math.hypot(x - C.x, z - C.z);
      if (d > 55 && (!mejor || d > mejor.d)) mejor = { x, z, d };
      if (mejor && mejor.d > 90) break;
    }
    this.tesoro = mejor ? { x: mejor.x, z: mejor.z, encontrado: false } : null;
    // la X en la arena: dos maderas cruzadas, solo si tenés el mapa
    if (this.tesoro) {
      const tabla = (a) => new THREE.BoxGeometry(1.4, 0.06, 0.22).rotateY(a);
      this.cruz = new THREE.Mesh(mergeSimple([tabla(0.785), tabla(-0.785)]), matPixel('liso', { color: 0x8a3a22, clave: 'cruzTesoro' }));
      this.cruz.position.set(this.tesoro.x, T.altura(this.tesoro.x, this.tesoro.z) + 0.03, this.tesoro.z);
      this.cruz.visible = false;
      J.escena.add(this.cruz);
    }
  }

  // ── el tesoro ──────────────────────────────────────────────────────────
  actualizarTesoro() {
    const J = this.J, t = this.tesoro;
    if (!t || !this.cruz) return;
    this.cruz.visible = !t.encontrado && J.inv.contar('mapaTesoro') > 0 && !J.bajo;
    if (this.cruz.visible) this.cruz.position.y = J.mundo.terreno.altura(t.x, t.z) + 0.03;
  }

  // la pala bajó el terreno en (x, z): si es la X y ya hay medio metro, sale el cofre
  cavado(x, z) {
    const J = this.J, t = this.tesoro;
    if (!t || t.encontrado || J.inv.contar('mapaTesoro') < 1) return false;
    if (Math.hypot(x - t.x, z - t.z) > 2.2) return false;
    const h = J.mundo.terreno.altura(t.x, t.z), h0 = J.mundo.terreno.base[Math.round(t.z + MITAD) * (TAM + 1) + Math.round(t.x + MITAD)];
    if (h0 - h < 0.5) return false;
    t.encontrado = true;
    J.inv.quitar('mapaTesoro', 1);
    const p = new THREE.Vector3(t.x, h + 0.3, t.z);
    for (const [id, n] of [['oro', 3], ['moneda', 5], ['rubi', 1], ['zafiro', 1], ['esmeralda', 1]]) J.objetos.soltar(id, n, p.clone());
    J.part.rafaga(p, 50, [0xffcf40, 0xffffff, 0xffe27a], { vel: 5, arriba: 6, tam: 0.08 });
    J.son.sfx('victoria');
    J.hud.noti(J.t('n.tesoro'), 'moneda', 'tesoro', 0, true);
    J.stats.tesoros = (J.stats.tesoros || 0) + 1;
    return true;
  }

  // ── pintar ─────────────────────────────────────────────────────────────
  pintarBase() {
    const T = this.J.mundo.terreno;
    const img = this.g.createImageData(R, R), d = img.data;
    const col = (h, x, z) => {
      if (h < -3) return [10, 78, 166];
      if (h < -1) return [24, 150, 200];
      if (h < 0) return [102, 220, 214];
      if (T.tierra(x, z) > 0.5) return [138, 89, 50];
      if (h > 9) return [122, 128, 139];
      if (T.pasto(x, z) > 0.5) return [95, 204, 52];
      return [240, 221, 180];
    };
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const x = (i / R) * TAM - MITAD, z = (j / R) * TAM - MITAD;
      const h = T.altura(x, z);
      const [r0, g0, b0] = col(h, x, z);
      // sombra de relieve: la pendiente hacia el noroeste oscurece
      const k = h > 0 ? 1 + (T.altura(x - 1, z - 1) - h) * -0.12 : 1;
      const o = (j * R + i) * 4;
      d[o] = r0 * k; d[o + 1] = g0 * k; d[o + 2] = b0 * k; d[o + 3] = 255;
    }
    // palmeras: puntitos verde oscuro
    for (const p of this.J.mundo.veg.palmeras) {
      if (!p.viva) continue;
      const i = Math.round(((p.x + MITAD) / TAM) * R), j = Math.round(((p.z + MITAD) / TAM) * R);
      if (i < 0 || j < 0 || i >= R || j >= R) continue;
      const o = (j * R + i) * 4;
      d[o] = 40; d[o + 1] = 120; d[o + 2] = 30;
    }
    this.base = img;
  }

  // se abre como capa del HUD (suelta el puntero y se cierra con M, E o un toque)
  abrir() {
    const H = this.J.hud;
    if (this.abierto) { H.cerrarCapa(); return; }
    if (!H.abrirCapa('mapa')) return;
    this.abierto = true;
    this.J.son.sfx('ui');
    this.dibujar();
  }
  cerrar() { this.abierto = false; }

  aPixel(x, z) { return [((x + MITAD) / TAM) * R, ((z + MITAD) / TAM) * R]; }

  dibujar() {
    const J = this.J, g = this.g;
    if (J.bajo) { this.dibujarMina(); return; }
    this.pintarBase();
    g.putImageData(this.base, 0, 0);
    const marca = (x, z, color, forma = 'punto', tam = 4) => {
      const [px, py] = this.aPixel(x, z);
      g.fillStyle = color; g.strokeStyle = '#15181f'; g.lineWidth = 1;
      if (forma === 'casa') { g.fillRect(px - 4, py - 2, 8, 6); g.beginPath(); g.moveTo(px - 5, py - 2); g.lineTo(px, py - 7); g.lineTo(px + 5, py - 2); g.fill(); }
      else if (forma === 'x') { g.lineWidth = 3; g.strokeStyle = color; g.beginPath(); g.moveTo(px - 5, py - 5); g.lineTo(px + 5, py + 5); g.moveTo(px + 5, py - 5); g.lineTo(px - 5, py + 5); g.stroke(); }
      else { g.fillRect(px - tam / 2, py - tam / 2, tam, tam); g.strokeRect(px - tam / 2 - 0.5, py - tam / 2 - 0.5, tam + 1, tam + 1); }
    };
    const W = J.mundo, C = W.choza.grupo.position;
    marca(C.x, C.z, '#e8b42f', 'casa');
    marca(W.mina.entrada.x, W.mina.entrada.z, '#3a3d45', 'punto', 6);
    if (J.historia) { const f = J.historia.faro.pos; marca(f.x, f.z, J.historia.faro.etapa >= 4 ? '#fff1b0' : '#c8402f', 'punto', 7); }
    if (J.mercader && J.mercader.grupo.visible) marca(J.mercader.pos.x, J.mercader.pos.z, '#2f7a8a', 'punto', 5);
    for (const f of J.bloques.fogatas) marca(f.x + 0.5, f.z + 0.5, '#ff8a10', 'punto', 3);
    if (this.tesoro && !this.tesoro.encontrado && J.inv.contar('mapaTesoro') > 0) marca(this.tesoro.x, this.tesoro.z, '#d9542a', 'x');
    this.flecha(J.jugador.p.x, J.jugador.p.z);
  }

  flecha(x, z) {
    const g = this.g, [px, py] = this.aPixel(x, z), yaw = this.J.jugador.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#15181f'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(px + fx * 7, py + fz * 7);
    g.lineTo(px - fx * 4 + fz * 4, py - fz * 4 - fx * 4);
    g.lineTo(px - fx * 4 - fz * 4, py - fz * 4 + fx * 4);
    g.closePath(); g.fill(); g.stroke();
  }

  // En la mina: el laberinto que ya viste, a escala de 4 píxeles por baldosa.
  explorar() {
    const J = this.J;
    if (!J.bajo) return;
    const p = J.jugador.p, T0 = -27;
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dz * dz > 25) continue;
      const i = Math.floor(p.x + dx - T0), j = Math.floor(p.z + dz - T0);
      if (i >= 0 && j >= 0 && i < 54 && j < 54) this.explorado[j * 54 + i] = 1;
    }
  }

  dibujarMina() {
    const J = this.J, g = this.g, M = J.mina, T0 = -27, k = R / 54;
    g.fillStyle = '#0b0a09'; g.fillRect(0, 0, R, R);
    for (let j = 0; j < 54; j++) for (let i = 0; i < 54; i++) {
      if (!this.explorado[j * 54 + i]) continue;
      g.fillStyle = M.abierto[j * 54 + i] ? '#b8a890' : '#4a4038';
      g.fillRect(i * k, j * k, Math.ceil(k), Math.ceil(k));
    }
    const px = (M.salida.x - T0) * k, pz = (M.salida.z - T0) * k;
    g.fillStyle = '#e8b42f'; g.fillRect(px - 3, pz - 3, 6, 6);
    const S = M.salaJefe;
    if (S && this.explorado[Math.floor(S.z - T0) * 54 + Math.floor(S.x - T0)]) { g.fillStyle = '#5ff6ff'; g.fillRect((S.x - T0) * k - 4, (S.z - T0) * k - 4, 8, 8); }
    const p = J.jugador.p, yaw = J.jugador.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const x = (p.x - T0) * k, z = (p.z - T0) * k;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(x + fx * 7, z + fz * 7); g.lineTo(x - fx * 4 + fz * 4, z - fz * 4 - fx * 4); g.lineTo(x - fx * 4 - fz * 4, z - fz * 4 + fx * 4); g.closePath(); g.fill();
  }

  serializar() {
    let s = '';
    for (let i = 0; i < this.explorado.length; i += 6) { let b = 0; for (let k = 0; k < 6; k++) b |= (this.explorado[i + k] ? 1 : 0) << k; s += String.fromCharCode(48 + b); }
    return { tesoro: this.tesoro ? this.tesoro.encontrado : false, mina: s };
  }
  cargar(d) {
    if (!d) return;
    if (this.tesoro) this.tesoro.encontrado = !!d.tesoro;
    if (typeof d.mina === 'string') for (let c = 0; c < d.mina.length; c++) { const b = d.mina.charCodeAt(c) - 48; for (let k = 0; k < 6; k++) if (c * 6 + k < this.explorado.length) this.explorado[c * 6 + k] = (b >> k) & 1; }
  }
}

