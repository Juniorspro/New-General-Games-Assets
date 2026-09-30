// La mina, abajo de la isla: pasillos de roca con vigas de madera, rieles y
// vetas. Oscura: sin farol se ve poco, y la niebla negra se come lo lejano
// ("hacer que la luz ande bien a través de la niebla bajo tierra fue más
// difícil de lo que pensaba", dice el autor). Las vetas raras están lejos de
// la escalera.
import * as THREE from '../vendor/three.module.min.js';
import { matPixel } from './material.js';
import { mulberry, rango } from './azar.js';
import { Rocas, mergeSimple, geoCristales } from './rocas.js';
import { matGema } from './gemas.js';

export const MINA_Y = -60;
const CELDA = 6, NC = 9, ALTO = 3.6;
const T0 = -((NC * CELDA) / 2);    // borde de la mina en x y z
const NT = NC * CELDA;             // tiles de 1 m por lado

const VETAS_MINA = [
  ['tanzanita', 0x6b4dff], ['rubi', 0xff3048], ['zafiro', 0x3a66ff], ['esmeralda', 0x36e07a], ['aguamarina', 0x7ff2cf],
  ['lapislazuli', 0x2346d6], ['malaquita', 0x1db36a], ['amatista', 0xb46cff], ['citrino', 0xffcf33], ['cuarzo', 0xf1f5ff],
];
const RAROS = ['uranio', 'gravinita', 'antimateria', 'quarks', 'bismuto', 'opalo'];

export class Mina {
  constructor(escena, tex, semilla) {
    this.grupo = new THREE.Group();
    this.grupo.visible = false;
    escena.add(this.grupo);
    const r = mulberry(semilla ^ 0x51ed27);
    // ── laberinto ──
    const abierto = new Uint8Array(NT * NT);
    const abrir = (x0, z0, x1, z1) => {
      for (let z = Math.max(0, Math.floor(z0)); z < Math.min(NT, Math.ceil(z1)); z++)
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(NT, Math.ceil(x1)); x++) abierto[z * NT + x] = 1;
    };
    const visto = new Uint8Array(NC * NC);
    const pila = [[4, NC - 1]];
    visto[(NC - 1) * NC + 4] = 1;
    const centros = [];
    const conex = [];
    while (pila.length) {
      const [cx, cz] = pila[pila.length - 1];
      const vec = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => x >= 0 && z >= 0 && x < NC && z < NC && !visto[z * NC + x]);
      if (!vec.length) { pila.pop(); continue; }
      const [nx, nz] = vec[Math.floor(r() * vec.length)];
      visto[nz * NC + nx] = 1;
      conex.push([cx, cz, nx, nz]);
      pila.push([nx, nz]);
    }
    // unos lazos de más: un laberinto perfecto es un fastidio para volver
    for (let i = 0; i < 12; i++) {
      const cx = Math.floor(r() * (NC - 1)), cz = Math.floor(r() * NC);
      conex.push([cx, cz, cx + 1, cz]);
    }
    const ancho = 3.2;
    for (let cz = 0; cz < NC; cz++) for (let cx = 0; cx < NC; cx++) {
      const x = cx * CELDA + CELDA / 2, z = cz * CELDA + CELDA / 2;
      const sala = r() < 0.18;
      const m = sala ? 2.8 : ancho / 2;
      abrir(x - m, z - m, x + m, z + m);
      centros.push({ cx, cz, x: x + T0, z: z + T0, sala, prof: Math.hypot(cx - 4, cz - (NC - 1)) });
    }
    for (const [ax, az, bx, bz] of conex) {
      const x0 = Math.min(ax, bx) * CELDA + CELDA / 2, x1 = Math.max(ax, bx) * CELDA + CELDA / 2;
      const z0 = Math.min(az, bz) * CELDA + CELDA / 2, z1 = Math.max(az, bz) * CELDA + CELDA / 2;
      abrir(x0 - ancho / 2, z0 - ancho / 2, x1 + ancho / 2, z1 + ancho / 2);
    }
    // La sala del Guardián: la celda más lejos de la escalera, agrandada a 14 m.
    // Ahí espera el gólem con el corazón de cristal del faro.
    const lejos = centros.filter((c) => !(c.cx === 4 && c.cz === NC - 1)).sort((a, b) => b.prof - a.prof || r() - 0.5)[0];
    const sx = lejos.cx * CELDA + CELDA / 2, sz = lejos.cz * CELDA + CELDA / 2;
    abrir(Math.max(1, sx - 7), Math.max(1, sz - 7), Math.min(NT - 1, sx + 7), Math.min(NT - 1, sz + 7));
    this.salaJefe = { x: sx + T0, z: sz + T0, cx: lejos.cx, cz: lejos.cz };
    this.abierto = abierto;

    // ── geometría: paredes donde un tile cerrado toca uno abierto ──
    const paredes = [];
    const esAbierto = (x, z) => x >= 0 && z >= 0 && x < NT && z < NT && abierto[z * NT + x];
    for (let z = -1; z <= NT; z++) for (let x = -1; x <= NT; x++) {
      if (esAbierto(x, z)) continue;
      if (esAbierto(x + 1, z) || esAbierto(x - 1, z) || esAbierto(x, z + 1) || esAbierto(x, z - 1) || esAbierto(x + 1, z + 1) || esAbierto(x - 1, z - 1) || esAbierto(x + 1, z - 1) || esAbierto(x - 1, z + 1)) {
        const alto = ALTO + 0.4;
        paredes.push(new THREE.BoxGeometry(1, alto, 1).translate(x + T0 + 0.5, MINA_Y + alto / 2 - 0.2, z + T0 + 0.5));
      }
    }
    const matRoca = matPixel('mundo', { mapa: tex.roca, tam: [32, 32], color: 0xb8a890, clave: 'rocaMina' });
    const mPared = new THREE.Mesh(mergeSimple(paredes), matRoca);
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(NT + 4, NT + 4).rotateX(-Math.PI / 2).translate(0, MINA_Y, 0), matPixel('mundo', { mapa: tex.roca, tam: [32, 32], color: 0xd8c8a8, clave: 'pisoMina' }));
    const techo = new THREE.Mesh(new THREE.PlaneGeometry(NT + 4, NT + 4).rotateX(Math.PI / 2).translate(0, MINA_Y + ALTO, 0), matRoca);
    for (const m of [mPared, piso, techo]) { m.receiveShadow = true; this.grupo.add(m); }

    // vigas cada tanto, rieles en los pasillos largos
    const matMadera = matPixel('mundo', { mapa: tex.madera, tam: [32, 32], clave: 'maderaMina' });
    const vigas = [], rieles = [], durmientes = [];
    for (const [ax, az, bx, bz] of conex) {
      const x = ((ax + bx) / 2) * CELDA + CELDA / 2 + T0, z = ((az + bz) / 2) * CELDA + CELDA / 2 + T0;
      const enX = az === bz;
      const o = ancho / 2 - 0.15;
      if (r() < 0.8) {
        if (enX) vigas.push(new THREE.BoxGeometry(0.25, ALTO, 0.25).translate(x, MINA_Y + ALTO / 2, z - o), new THREE.BoxGeometry(0.25, ALTO, 0.25).translate(x, MINA_Y + ALTO / 2, z + o), new THREE.BoxGeometry(0.3, 0.3, ancho).translate(x, MINA_Y + ALTO - 0.2, z));
        else vigas.push(new THREE.BoxGeometry(0.25, ALTO, 0.25).translate(x - o, MINA_Y + ALTO / 2, z), new THREE.BoxGeometry(0.25, ALTO, 0.25).translate(x + o, MINA_Y + ALTO / 2, z), new THREE.BoxGeometry(ancho, 0.3, 0.3).translate(x, MINA_Y + ALTO - 0.2, z));
      }
      if (r() < 0.45) {
        const largo = CELDA;
        for (const s of [-0.45, 0.45]) rieles.push(enX ? new THREE.BoxGeometry(largo, 0.08, 0.07).translate(x, MINA_Y + 0.12, z + s) : new THREE.BoxGeometry(0.07, 0.08, largo).translate(x + s, MINA_Y + 0.12, z));
        for (let k = -2.5; k <= 2.5; k += 0.8) durmientes.push(enX ? new THREE.BoxGeometry(0.22, 0.08, 1.3).translate(x + k, MINA_Y + 0.04, z) : new THREE.BoxGeometry(1.3, 0.08, 0.22).translate(x, MINA_Y + 0.04, z + k));
      }
    }
    if (vigas.length) { const m = new THREE.Mesh(mergeSimple(vigas), matMadera); m.castShadow = m.receiveShadow = true; this.grupo.add(m); }
    if (durmientes.length) this.grupo.add(new THREE.Mesh(mergeSimple(durmientes), matMadera));
    if (rieles.length) this.grupo.add(new THREE.Mesh(mergeSimple(rieles), matPixel('liso', { color: 0x9aa0ab, brillo: 0.6, clave: 'riel' })));

    // faroles colgados en algunos cruces: sin ellos la mina es negra (de a
    // cuatro alumbran de verdad, los más cercanos; el resto solo brilla)
    this.centros = centros;
    this.lamparas = [];
    const lamparas = [], sogas = [];
    for (const c of centros) {
      if (!(c.cx === 4 && c.cz === NC - 1) && r() > 0.3) continue;
      const y = MINA_Y + ALTO - 0.62;
      lamparas.push(new THREE.BoxGeometry(0.22, 0.28, 0.22).translate(c.x, y, c.z));
      sogas.push(new THREE.BoxGeometry(0.04, 0.5, 0.04).translate(c.x, y + 0.38, c.z), new THREE.BoxGeometry(0.3, 0.05, 0.3).translate(c.x, y + 0.16, c.z));
      this.lamparas.push(new THREE.Vector3(c.x, y, c.z));
    }
    this.grupo.add(new THREE.Mesh(mergeSimple(lamparas), matPixel('liso', { color: 0xffd36a, emisivo: 0xffb040, clave: 'lamparaMina' })));
    // cristales gigantes en la sala del Guardián: se ven venir desde el pasillo
    const S = this.salaJefe, gigantes = [];
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + r() * 0.4, d = rango(r, 4.5, 6.2);
      gigantes.push(geoCristales(400 + k, 3).scale(2.2, 2.6, 2.2).rotateY(r() * 6).translate(S.x + Math.cos(a) * d, MINA_Y, S.z + Math.sin(a) * d));
    }
    const mCrist = new THREE.Mesh(mergeSimple(gigantes), matGema(0x5ff6ff, 'cristal', { emision: 0.45 }));
    mCrist.castShadow = true;
    this.grupo.add(mCrist);
    this.lucesJefe = [new THREE.Vector3(S.x - 3, MINA_Y + 2.4, S.z), new THREE.Vector3(S.x + 3, MINA_Y + 2.4, S.z)];
    this.grupo.add(new THREE.Mesh(mergeSimple(sogas), matPixel('liso', { color: 0x3a3d45, clave: 'metalOscuro' })));

    // la escalera de salida, en la celda de entrada
    const ent = centros.find((c) => c.cx === 4 && c.cz === NC - 1);
    this.salida = new THREE.Vector3(ent.x, MINA_Y, ent.z + 1.0);
    const escalera = [];
    for (const s of [-0.35, 0.35]) escalera.push(new THREE.BoxGeometry(0.08, 6, 0.08).translate(ent.x + s, MINA_Y + 3, ent.z + 1.4));
    for (let y = 0.3; y < 6; y += 0.4) escalera.push(new THREE.BoxGeometry(0.7, 0.05, 0.05).translate(ent.x, MINA_Y + y, ent.z + 1.4));
    this.grupo.add(new THREE.Mesh(mergeSimple(escalera), matMadera));
    this.entrada = new THREE.Vector3(ent.x, MINA_Y, ent.z - 0.5);

    // ── vetas ──
    const minables = [];
    const libres = [];
    for (let z = 1; z < NT - 1; z++) for (let x = 1; x < NT - 1; x++) {
      if (!abierto[z * NT + x]) continue;
      const pegado = !abierto[z * NT + x + 1] || !abierto[z * NT + x - 1] || !abierto[(z + 1) * NT + x] || !abierto[(z - 1) * NT + x];
      if (pegado) libres.push([x + T0 + 0.5, z + T0 + 0.5]);
    }
    for (let i = 0; i < 600 && minables.length < 42; i++) {
      const [x, z] = libres[Math.floor(r() * libres.length)];
      if (Math.hypot(x - this.salida.x, z - this.salida.z) < 5) continue;
      if (Math.hypot(x - this.salaJefe.x, z - this.salaJefe.z) < 8) continue;   // la sala queda libre para pelear
      if (minables.some((m) => Math.hypot(m.x - x, m.z - z) < 3.2)) continue;
      const prof = Math.hypot(x - this.salida.x, z - this.salida.z);
      const u = r();
      let veta = null, color = 0, raro = false;
      if (u < 0.5) { const v = VETAS_MINA[Math.floor(r() * VETAS_MINA.length)]; veta = v[0]; color = v[1]; }
      else if (u < 0.5 + 0.2 * Math.min(1, prof / 28)) { raro = true; veta = 'raro'; color = [0x39f6ff, 0xff4fe0, 0xb6ff3a][Math.floor(r() * 3)]; }
      minables.push({ x, z, y: MINA_Y, r: rango(r, 0.75, 1.1), veta, colorVeta: color, raro });
    }
    this.rocas = new Rocas(tex, [], minables);
    this.grupo.add(this.rocas.grupo);
    this.RAROS = RAROS;
  }

  // ── choque (misma interfaz que el mundo de arriba) ──
  abiertoEn(x, z) {
    const i = Math.floor(x - T0), j = Math.floor(z - T0);
    return i >= 0 && j >= 0 && i < NT && j < NT && this.abierto[j * NT + i] === 1;
  }
  suelo() { return MINA_Y; }
  techo() { return MINA_Y + ALTO; }
  obstaculos(x, z, radio) {
    const res = [...this.rocas.obstaculos(x, z, radio)];
    return res;
  }
  empujar(p, radio) {
    for (let j = Math.floor(p.z - radio - T0) - 1; j <= Math.floor(p.z + radio - T0) + 1; j++)
      for (let i = Math.floor(p.x - radio - T0) - 1; i <= Math.floor(p.x + radio - T0) + 1; i++) {
        const abierto = i >= 0 && j >= 0 && i < NT && j < NT && this.abierto[j * NT + i] === 1;
        if (abierto) continue;
        const x0 = i + T0, z0 = j + T0;
        const cx = Math.max(x0, Math.min(p.x, x0 + 1)), cz = Math.max(z0, Math.min(p.z, z0 + 1));
        const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (d < radio && d > 1e-5) { p.x = cx + (dx / d) * radio; p.z = cz + (dz / d) * radio; }
      }
  }
}

export { VETAS_MINA };
