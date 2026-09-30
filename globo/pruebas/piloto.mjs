// Un piloto automático para las pruebas: adivina qué va a tocar el globo en
// el próximo segundo (lo quieto lo alcanza el globo al subir; lo que cae,
// cae con la gravedad) y lleva el escudo a empujar lo más urgente para
// afuera de la columna. No planea como una persona, así que lo que gana es
// un piso: si él pasa un nivel, una persona también puede.
import { ANCHO } from '../js/niveles.js';
import { R_ESCUDO } from '../js/partida.js';
import { chocan } from '../js/fisica.js';

const VEL = 1300;            // lo que mueve el escudo por segundo, como mucho (un dedo rápido)
const MIRA = 1.3;            // cuántos segundos hacia adelante mira

// ¿en cuánto tiempo toca el globo? (Infinity si no lo toca en MIRA segundos).
// Con la forma de verdad (una caja girada no es su círculo) y su giro.
function cuandoToca(p, b) {
  const g = p.globo, gv = p.vel, grav = p.mundo.g * (b.gravedad ?? 1);
  const quieto = (b.dormido && !b.colgado) || b.tipo !== 2, cuelga = !!b.colgado;
  const sonda = { forma: 'bola', x: g.x, y: g.y, r: g.r + 6, hx: g.r + 6, hy: g.r + 6, c: 1, s: 0 };
  const falso = Object.create(Object.getPrototypeOf(b));
  Object.assign(falso, { forma: b.forma, hx: b.hx, hy: b.hy, r: b.r });
  // lo que cuelga de una cuerda se mueve como péndulo: se lo simula aparte
  let px = b.x, py = b.y, pvx = b.vx, pvy = b.vy;
  const cu = cuelga ? p.mundo.cuerdas.find((c) => c.b === b) : null;
  for (let t = 0; t <= MIRA; t += 1 / 30) {
    if (cu && !quieto) {
      for (let k = 0; k < 4; k++) {
        const h = 1 / 120;
        pvy += grav * h; px += pvx * h; py += pvy * h;
        const dx = px - cu.x, dy = py - cu.y, d = Math.hypot(dx, dy);
        if (d > cu.largo) { px = cu.x + (dx / d) * cu.largo; py = cu.y + (dy / d) * cu.largo; const vn = (pvx * dx + pvy * dy) / d; pvx -= (vn * dx) / d; pvy -= (vn * dy) / d; }
      }
      falso.x = px; falso.y = py;
    } else {
      falso.x = quieto ? b.x : b.x + b.vx * t;
      falso.y = quieto ? b.y : b.y + b.vy * t + (b.pivote ? 0 : 0.5 * grav * t * t);
    }
    const a = b.a + (quieto && !b.w ? 0 : b.w * t);
    falso.c = Math.cos(a); falso.s = Math.sin(a);
    sonda.y = g.y - gv * t;
    if (chocan(sonda, falso)) return t;
  }
  return Infinity;
}

export function piloto(p, dt) {
  const g = p.globo, e = p.escudo;
  let peor = null, peorT = Infinity;
  for (const b of p.mundo.cuerpos) {
    if (b === e || !b.vivo || b.tipo === 0 || b.datos?.pieza === 'aspa') continue;
    if (Math.abs(b.y - g.y) > 520 || Math.abs(b.x - g.x) > 200) continue;
    const t = cuandoToca(p, b);
    if (t < peorT) { peorT = t; peor = b; }
  }
  let ox = g.x, oy = g.y - 110;
  const cu = peor?.colgado ? p.mundo.cuerdas.find((c) => c.b === peor) : null;
  if (cu) {
    // un péndulo: esperarlo en su camino, entre la bola y el globo (rebota contra el escudo)
    const lado = Math.sign(peor.x - g.x) || 1, x = g.x + lado * (g.r + R_ESCUDO + 10), dx = x - cu.x;
    if (Math.abs(dx) < cu.largo) { ox = x; oy = cu.y + Math.sqrt(cu.largo * cu.largo - dx * dx); }
  } else if (peor && peor.pivote && peor.forma === 'caja') {
    // un molinete: empujar para arriba el pedazo de barra que está sobre el
    // globo (lejos del clavo, así gira despacio y se abre)
    const ux = Math.cos(peor.a), uy = Math.sin(peor.a), s = Math.abs(ux) > 0.2 ? (g.x - peor.x) / ux : 0;
    const k = Math.max(-peor.hx, Math.min(peor.hx, s));
    ox = peor.x + ux * k; oy = peor.y + uy * k + peor.hy + R_ESCUDO + 2;
    if (oy > g.y - g.r - R_ESCUDO - 8) oy = g.y - g.r - R_ESCUDO - 8;
  } else if (peor) {
    // ir a su costado del lado del globo, un poco abajo, y empujarlo para afuera
    const lado = peor.x < g.x ? 1 : -1, cerca = Math.hypot(e.x - peor.x, e.y - peor.y) < peor.r + R_ESCUDO + 10;
    const t = Math.min(peorT, 0.25), px = peor.dormido ? peor.x : peor.x + peor.vx * t, py = peor.dormido ? peor.y : peor.y + peor.vy * t;
    ox = px + lado * (peor.r * 0.6 + R_ESCUDO * 0.5) - (cerca ? lado * 60 : 0);
    oy = py + peor.r * 0.5 + R_ESCUDO * 0.6;
    // nunca pegado al globo (lo empujaría encima)
    if (oy > g.y - g.r - R_ESCUDO - 8) oy = g.y - g.r - R_ESCUDO - 8;
  }
  ox = Math.max(R_ESCUDO, Math.min(ANCHO - R_ESCUDO, ox));
  let dx = ox - e.x, dy = oy - e.y;
  const d = Math.hypot(dx, dy), max = VEL * dt;
  if (d > max) { dx *= max / d; dy *= max / d; }
  p.mover(dx, dy);
}

// Juega un nivel entero con el piloto. Devuelve cómo terminó.
export function jugarNivel(Partida, n, { dt = 1 / 60, tope = 150 } = {}) {
  const p = new Partida({ nivel: n });
  p.medir(360, 780);
  let t = 0;
  while (p.estado === 'juego' && t < tope) { piloto(p, dt); p.avanzar(dt); t += dt; }
  return { estado: p.estado, progreso: p.progreso(), t, monedas: p.tomadas, contra: p.culpable?.datos?.formacion?.tipo };
}
