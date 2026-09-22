// Los senderos: curvas suaves por los puntos de config.js, y la pregunta que
// hacen todos los demás módulos: "¿a cuánto estoy del camino más cercano?".
//
// El terreno la hace 58 mil veces al armarse y la flora otras tantas, así que
// la respuesta sale de una grilla de tramos y no de recorrer todos los tramos.
import { SENDEROS } from "./config.js";

/** Catmull-Rom centrípeta no hace falta: con puntos bien repartidos la
 *  uniforme no hace rulos, y es la mitad de cuentas. */
function curva(puntos, porTramo = 10) {
  const fuera = [];
  const p = [puntos[0], ...puntos, puntos[puntos.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    const [a, b, c, d] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let k = 0; k < porTramo; k++) {
      const t = k / porTramo, t2 = t * t, t3 = t2 * t;
      const f = (u0, u1, u2, u3) =>
        0.5 * (2 * u1 + (-u0 + u2) * t + (2 * u0 - 5 * u1 + 4 * u2 - u3) * t2 + (-u0 + 3 * u1 - 3 * u2 + u3) * t3);
      fuera.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]);
    }
  }
  fuera.push(puntos[puntos.length - 1]);
  return fuera;
}

const TRAMOS = [];            // [x0, z0, x1, z1, ancho]
for (const s of SENDEROS) {
  const c = curva(s.puntos);
  for (let i = 0; i < c.length - 1; i++) TRAMOS.push([c[i][0], c[i][1], c[i + 1][0], c[i + 1][1], s.ancho]);
}

const CELDA = 12;
const grilla = new Map();
const clave = (i, j) => i * 100003 + j;
for (let t = 0; t < TRAMOS.length; t++) {
  const [x0, z0, x1, z1] = TRAMOS[t];
  // cada tramo se anota en todas las celdas que toca más un margen: una
  // consulta hasta 12 m del camino tiene que encontrarlo mirando SOLO su celda
  const m = CELDA;
  const i0 = Math.floor((Math.min(x0, x1) - m) / CELDA), i1 = Math.floor((Math.max(x0, x1) + m) / CELDA);
  const j0 = Math.floor((Math.min(z0, z1) - m) / CELDA), j1 = Math.floor((Math.max(z0, z1) + m) / CELDA);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const k = clave(i, j);
    if (!grilla.has(k)) grilla.set(k, []);
    grilla.get(k).push(t);
  }
}

/** Distancia al borde del camino más cercano, en metros (negativa adentro),
 *  y la dirección del camino ahí. Lejos de todo devuelve 99. */
export function aCamino(x, z) {
  const lista = grilla.get(clave(Math.floor(x / CELDA), Math.floor(z / CELDA)));
  if (!lista) return 99;
  let mejor = 99;
  for (const t of lista) {
    const [x0, z0, x1, z1, ancho] = TRAMOS[t];
    const dx = x1 - x0, dz = z1 - z0;
    const l2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2));
    const px = x0 + dx * u - x, pz = z0 + dz * u - z;
    const d = Math.sqrt(px * px + pz * pz) - ancho * 0.5;
    if (d < mejor) mejor = d;
  }
  return mejor;
}

export const tramos = TRAMOS;
