// La cabeza de los bots. Piensan diez veces por segundo (entre medio siguen
// doblando hacia lo último que decidieron):
//  1. miran con nueve "rayos" hacia adelante hasta dónde está libre (cuerpos
//     de otras y el borde);
//  2. si adelante hay peligro, doblan hacia el rayo más libre (y con turbo si
//     está muy cerca);
//  3. si no, van a comer: la comida que más rinde por distancia (la de una
//     muerta, grande, tira mucho);
//  4. las agresivas, si tienen una más chica adelante, le cortan el camino
//     apuntando a donde va a estar su cabeza.
import { difAng } from './util.js';

const RAYOS = [0, -0.35, 0.35, -0.7, 0.7, -1.1, 1.1, -1.6, 1.6];

// Cuánto se puede avanzar por un rayo hasta tocar algo (o `largo` si nada).
function libre(v, mundo, ang, largo) {
  const r = v.radio(), vi = mundo.viboras.indexOf(v), paso = Math.max(10, r * 0.8);
  const cs = Math.cos(ang), sn = Math.sin(ang);
  for (let d = r; d <= largo; d += paso) {
    const x = v.x + cs * d, y = v.y + sn * d;
    if (x * x + y * y > (mundo.radio - r * 1.5) ** 2) return d;
    const c = mundo.celdaDe(x, y), nc = mundo.nc;
    for (const cc of [c, c - 1, c + 1, c - nc, c + nc]) {
      const lista = mundo.celdasCuerpo[cc];
      if (!lista) continue;
      for (const s of lista) {
        if (mundo.sv[s] === vi) continue;
        const toca = mundo.sr[s] + r * 0.9;
        if ((mundo.sx[s] - x) ** 2 + (mundo.sy[s] - y) ** 2 < toca * toca) return d;
      }
    }
  }
  return largo;
}

// La comida que más rinde cerca (valor / distancia), o null.
function mejorComida(v, mundo, alcance) {
  let mejor = null, puntaje = 0;
  const celdas = Math.ceil(alcance / 128);
  const cx = Math.floor((v.x + mundo.radio) / 128) + 1, cy = Math.floor((v.y + mundo.radio) / 128) + 1;
  for (let j = cy - celdas; j <= cy + celdas; j++) for (let i = cx - celdas; i <= cx + celdas; i++) {
    if (i < 0 || j < 0 || i >= mundo.nc || j >= mundo.nc) continue;
    for (const f of mundo.grilla[j * mundo.nc + i]) {
      const d = Math.hypot(mundo.fx[f] - v.x, mundo.fy[f] - v.y);
      if (d > alcance) continue;
      // lo que queda detrás cuesta dar la vuelta: vale menos
      const atras = Math.abs(difAng(v.ang, Math.atan2(mundo.fy[f] - v.y, mundo.fx[f] - v.x))) / Math.PI;
      const p = mundo.fv[f] / (d + 40) / (1 + atras * 1.5);
      if (p > puntaje) { puntaje = p; mejor = f; }
    }
  }
  return mejor;
}

export function pensar(v, mundo) {
  const ia = v.ia, r = v.radio();
  const largo = r * 3.5 + 90 * ia.prudencia;
  // 1. los ojos
  const vistos = RAYOS.map((da) => ({ da, ang: v.ang + da, d: libre(v, mundo, v.ang + da, largo) }));
  const frente = vistos[0].d;
  v.turbo = false;
  // 2. peligro adelante: al más libre (a igualdad, el que menos obliga a doblar)
  if (frente < largo * 0.7) {
    let mejor = vistos[0];
    for (const o of vistos) if (o.d - Math.abs(o.da) * 12 > mejor.d - Math.abs(mejor.da) * 12) mejor = o;
    v.angObj = mejor.ang;
    if (frente < largo * 0.35 && v.masa > 25 && mundo.r() < 0.6) v.turbo = true;
    return;
  }
  // 4. cortarle el paso a una más chica que viene de frente o de costado
  if (ia.agresion > 0.3 && v.masa > 40) {
    for (const o of mundo.viboras) {
      if (o === v || !o.viva || o.masa > v.masa * 0.8) continue;
      const d = Math.hypot(o.x - v.x, o.y - v.y);
      if (d > 380) continue;
      const adelante = d * 0.55, px = o.x + Math.cos(o.ang) * adelante, py = o.y + Math.sin(o.ang) * adelante;
      const ang = Math.atan2(py - v.y, px - v.x);
      if (libre(v, mundo, ang, Math.min(largo, d)) < Math.min(largo, d) * 0.8) continue;
      v.angObj = ang;
      v.turbo = d < 240 && mundo.r() < ia.agresion;
      return;
    }
  }
  // 3. comer
  const f = mejorComida(v, mundo, 260 + 140 * ia.codicia);
  if (f !== null) {
    const ang = Math.atan2(mundo.fy[f] - v.y, mundo.fx[f] - v.x);
    // si para ir a la comida hay que pasar cerca de algo, mejor no
    if (libre(v, mundo, ang, largo * 0.8) >= largo * 0.6) { v.angObj = ang; return; }
  }
  // sin nada: pasear con un rumbo que cambia despacio, y de vuelta al centro si está lejos
  ia.deambula += (mundo.r() - 0.5) * 0.6;
  const lejos = Math.hypot(v.x, v.y) > mundo.radio * 0.75;
  v.angObj = lejos ? Math.atan2(-v.y, -v.x) : v.ang + difAng(v.ang, ia.deambula) * 0.3;
}
