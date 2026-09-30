// La física de Globo Libre: cuerpos rígidos en 2D (bolas y cajas que giran)
// con choques, fricción, rebote, cuerdas y cuerpos que se duermen.
//
// Es el método de Box2D-lite (Erin Catto): cada paso se buscan los contactos,
// las velocidades se corrigen con impulsos en varias vueltas (acumulados y
// recortados, así una pila no se hunde ni salta) y recién al final se mueven
// las posiciones. Cajas contra cajas dan hasta dos puntos de contacto
// (recortando la arista que choca contra la cara de referencia): sin eso una
// caja apoyada se balancea sobre una esquina. Sin librerías: el repo es
// público y el juego va en un solo archivo.
//
// Coordenadas de pantalla: x a la derecha e y hacia ABAJO (la gravedad es +y).

// de a uno por línea: el empaquetador lee un solo nombre por `export const`
export const ESTATICO = 0;
export const CINEMATICO = 1;
export const DINAMICO = 2;

const BETA = 0.2;            // cuánto de la penetración se corrige por paso
const HOLGURA = 0.6;         // penetración que se tolera sin empujar (si no, tiembla)
const UMBRAL_REBOTE = 60;    // más lento que esto, no rebota (si no, nunca se queda quieto)
const CORRECCION_MAX = 240;  // a qué velocidad, como mucho, se separa lo que quedó metido (si no, sale disparado)
const AIRE_GIRO = 0.9;
const VEL_MAX = 2200, GIRO_MAX = 40;
const DORMIR_V2 = 9, DORMIR_W = 0.2, DORMIR_T = 0.6;
const CELDA = 64;

let siguiente = 1;

export class Cuerpo {
  // `pivote`: clavado por el centro, gira pero no se va (un molinete que se
  // empuja): masa infinita para correrse y la inercia de siempre para girar.
  constructor({ tipo = DINAMICO, forma = 'caja', x = 0, y = 0, a = 0, w = 20, h = 20, r = 10, densidad = 1, friccion = 0.45, rebote = 0.08, color = null, dormido = false, gravedad = 1, pivote = false, datos = null } = {}) {
    this.id = siguiente++;
    this.tipo = tipo; this.forma = forma;
    this.x = x; this.y = y; this.a = a;
    this.vx = 0; this.vy = 0; this.w = 0;
    this.hx = forma === 'bola' ? r : w / 2; this.hy = forma === 'bola' ? r : h / 2;
    this.r = forma === 'bola' ? r : Math.hypot(w, h) / 2;       // el radio que la envuelve
    this.friccion = friccion; this.rebote = rebote; this.gravedad = pivote ? 0 : gravedad;
    this.color = color; this.datos = datos; this.pivote = pivote;
    this.dormido = dormido && tipo === DINAMICO; this.quieto = 0;
    this.vivo = true; this.marca = 0; this.isla = null;
    if (tipo === DINAMICO) {
      const area = forma === 'bola' ? Math.PI * r * r : w * h;
      this.masa = area * densidad * 0.001;
      this.inercia = forma === 'bola' ? 0.5 * this.masa * r * r : (this.masa * (w * w + h * h)) / 12;
      this.im = pivote ? 0 : 1 / this.masa; this.ii = 1 / this.inercia;
    } else { this.masa = Infinity; this.inercia = Infinity; this.im = 0; this.ii = 0; }
    this.c = Math.cos(a); this.s = Math.sin(a);
  }
  girar(a) { this.a = a; this.c = Math.cos(a); this.s = Math.sin(a); }
  despertar() { if (this.dormido) { this.dormido = false; this.quieto = 0; } }
  // de local a mundo (para dibujar esquinas y puntos de la caja)
  aMundo(lx, ly) { return [this.x + this.c * lx - this.s * ly, this.y + this.s * lx + this.c * ly]; }
}

// ── los choques: normal de A hacia B y puntos con su separación (<0: se meten) ──
function bolaBola(A, B) {
  const dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2), nx = d > 1e-9 ? dx / d : 1, ny = d > 1e-9 ? dy / d : 0;
  const sep = d - rr;
  return { nx, ny, puntos: [{ x: A.x + nx * (A.r + sep / 2), y: A.y + ny * (A.r + sep / 2), sep }] };
}

// A es la bola, B la caja.
function bolaCaja(A, B) {
  const dx = A.x - B.x, dy = A.y - B.y;
  const lx = B.c * dx + B.s * dy, ly = -B.s * dx + B.c * dy;
  const cx = lx < -B.hx ? -B.hx : lx > B.hx ? B.hx : lx, cy = ly < -B.hy ? -B.hy : ly > B.hy ? B.hy : ly;
  let nxL, nyL, sep, px, py;
  if (lx !== cx || ly !== cy) {
    const ex = lx - cx, ey = ly - cy, d = Math.hypot(ex, ey);
    if (d >= A.r) return null;
    nxL = ex / d; nyL = ey / d; sep = d - A.r; px = cx; py = cy;
  } else {
    // el centro quedó adentro: sale por la cara más cercana
    const fx = B.hx - Math.abs(lx), fy = B.hy - Math.abs(ly);
    if (fx < fy) { nxL = lx < 0 ? -1 : 1; nyL = 0; sep = -fx - A.r; px = nxL * B.hx; py = ly; }
    else { nxL = 0; nyL = ly < 0 ? -1 : 1; sep = -fy - A.r; px = lx; py = nyL * B.hy; }
  }
  const nwx = B.c * nxL - B.s * nyL, nwy = B.s * nxL + B.c * nyL;     // de la caja hacia la bola
  const [wx, wy] = B.aMundo(px, py);
  return { nx: -nwx, ny: -nwy, puntos: [{ x: wx, y: wy, sep }] };
}

// La arista de la caja b que mira más en contra de la normal n (Box2D-lite › ComputeIncidentEdge).
function aristaIncidente(b, nx, ny) {
  const lx = -(b.c * nx + b.s * ny), ly = -(-b.s * nx + b.c * ny);
  let p1x, p1y, p2x, p2y;
  if (Math.abs(lx) > Math.abs(ly)) {
    if (lx > 0) { p1x = b.hx; p1y = -b.hy; p2x = b.hx; p2y = b.hy; } else { p1x = -b.hx; p1y = b.hy; p2x = -b.hx; p2y = -b.hy; }
  } else if (ly > 0) { p1x = b.hx; p1y = b.hy; p2x = -b.hx; p2y = b.hy; } else { p1x = -b.hx; p1y = -b.hy; p2x = b.hx; p2y = -b.hy; }
  return [b.aMundo(p1x, p1y), b.aMundo(p2x, p2y)];
}
function recortar(v, nx, ny, desde) {
  const [a, b] = v, out = [];
  const d0 = nx * a[0] + ny * a[1] - desde, d1 = nx * b[0] + ny * b[1] - desde;
  if (d0 <= 0) out.push(a);
  if (d1 <= 0) out.push(b);
  if (d0 * d1 < 0) { const t = d0 / (d0 - d1); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  return out;
}

// Caja contra caja (Box2D-lite › Collide): el eje de menor penetración entre
// las cuatro caras, la arista incidente recortada por los costados de la cara
// de referencia, y hasta dos puntos.
function cajaCaja(A, B) {
  const hAx = A.hx, hAy = A.hy, hBx = B.hx, hBy = B.hy, cA = A.c, sA = A.s, cB = B.c, sB = B.s;
  const dpx = B.x - A.x, dpy = B.y - A.y;
  const dAx = cA * dpx + sA * dpy, dAy = -sA * dpx + cA * dpy;
  const dBx = cB * dpx + sB * dpy, dBy = -sB * dpx + cB * dpy;
  const c11 = cA * cB + sA * sB, c12 = -cA * sB + sA * cB, c21 = -sA * cB + cA * sB, c22 = sA * sB + cA * cB;
  const a11 = Math.abs(c11), a12 = Math.abs(c12), a21 = Math.abs(c21), a22 = Math.abs(c22);
  const fAx = Math.abs(dAx) - hAx - (a11 * hBx + a12 * hBy);
  const fAy = Math.abs(dAy) - hAy - (a21 * hBx + a22 * hBy);
  if (fAx > 0 || fAy > 0) return null;
  const fBx = Math.abs(dBx) - (a11 * hAx + a21 * hAy) - hBx;
  const fBy = Math.abs(dBy) - (a12 * hAx + a22 * hAy) - hBy;
  if (fBx > 0 || fBy > 0) return null;
  let eje = 0, sep = fAx, nx = dAx > 0 ? cA : -cA, ny = dAx > 0 ? sA : -sA;
  if (fAy > 0.95 * sep + 0.01 * hAy) { eje = 1; sep = fAy; nx = dAy > 0 ? -sA : sA; ny = dAy > 0 ? cA : -cA; }
  if (fBx > 0.95 * sep + 0.01 * hBx) { eje = 2; sep = fBx; nx = dBx > 0 ? cB : -cB; ny = dBx > 0 ? sB : -sB; }
  if (fBy > 0.95 * sep + 0.01 * hBy) { eje = 3; sep = fBy; nx = dBy > 0 ? -sB : sB; ny = dBy > 0 ? cB : -cB; }
  let fnx, fny, frente, snx, sny, neg, pos, inc;
  if (eje === 0) { fnx = nx; fny = ny; frente = A.x * fnx + A.y * fny + hAx; snx = -sA; sny = cA; const l = A.x * snx + A.y * sny; neg = -l + hAy; pos = l + hAy; inc = aristaIncidente(B, fnx, fny); }
  else if (eje === 1) { fnx = nx; fny = ny; frente = A.x * fnx + A.y * fny + hAy; snx = cA; sny = sA; const l = A.x * snx + A.y * sny; neg = -l + hAx; pos = l + hAx; inc = aristaIncidente(B, fnx, fny); }
  else if (eje === 2) { fnx = -nx; fny = -ny; frente = B.x * fnx + B.y * fny + hBx; snx = -sB; sny = cB; const l = B.x * snx + B.y * sny; neg = -l + hBy; pos = l + hBy; inc = aristaIncidente(A, fnx, fny); }
  else { fnx = -nx; fny = -ny; frente = B.x * fnx + B.y * fny + hBy; snx = cB; sny = sB; const l = B.x * snx + B.y * sny; neg = -l + hBx; pos = l + hBx; inc = aristaIncidente(A, fnx, fny); }
  let cp = recortar(inc, -snx, -sny, neg);
  if (cp.length < 2) return null;
  cp = recortar(cp, snx, sny, pos);
  if (cp.length < 2) return null;
  const puntos = [];
  for (const [px, py] of cp) {
    const s = fnx * px + fny * py - frente;
    if (s <= 0) puntos.push({ x: px - s * fnx, y: py - s * fny, sep: s });
  }
  return puntos.length ? { nx, ny, puntos } : null;
}

export function chocan(A, B) {
  if (A.forma === 'bola') return B.forma === 'bola' ? bolaBola(A, B) : bolaCaja(A, B);
  if (B.forma === 'bola') { const c = bolaCaja(B, A); if (c) { c.nx = -c.nx; c.ny = -c.ny; } return c; }
  return cajaCaja(A, B);
}

// ── el mundo ────────────────────────────────────────────────────────────────
export class Mundo {
  // `aire`: el roce con el aire (por segundo); con más, las cosas caen más lentas y se atajan mejor
  constructor({ gravedad = 900, iteraciones = 10, aire = 0.35 } = {}) {
    this.g = gravedad; this.iteraciones = iteraciones; this.aire = aire;
    this.cuerpos = []; this.cuerdas = []; this.contactos = [];
    this.grilla = new Map();
    this.ventana = [-Infinity, Infinity];        // de qué alto a qué alto chocan las cosas
    this.golpes = [];                            // choques fuertes contra `this.oido` (para el sonido)
    this.oido = null;
    this.hayMuertos = false;
    // los contactos del paso anterior: su impulso arranca el de este (así una
    // pila se asienta y se duerme en vez de temblar para siempre)
    this.previos = new Map();
    this.despiertos = [];
  }
  agregar(c) { this.cuerpos.push(c); return c; }
  sacar(c) { if (c.vivo) { c.vivo = false; this.hayMuertos = true; } }
  // Los que nacen dormidos juntos (una torre, una pared) se despiertan juntos:
  // al tocar una caja, la torre entera siente el golpe.
  grupo(lista) { const isla = { cuerpos: lista.filter((c) => c.dormido) }; for (const c of isla.cuerpos) c.isla = isla; return isla; }
  // una bola colgada de un punto fijo (o de un cuerpo que se mueve), de largo fijo
  cuerda(b, x, y, largo, desde = null) { const c = { b, x, y, largo, desde }; this.cuerdas.push(c); return c; }

  armarGrilla() {
    const g = this.grilla; g.clear();
    const [arriba, abajo] = this.ventana;
    for (const b of this.cuerpos) {
      if (!b.vivo || b.y + b.r < arriba || b.y - b.r > abajo) continue;
      const i0 = Math.floor((b.x - b.r) / CELDA), i1 = Math.floor((b.x + b.r) / CELDA);
      const j0 = Math.floor((b.y - b.r) / CELDA), j1 = Math.floor((b.y + b.r) / CELDA);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * 4096 + i;
        let l = g.get(k); if (!l) { l = []; g.set(k, l); }
        l.push(b);
      }
    }
  }
  // todo lo que toca el círculo (x, y, r); `fn(cuerpo, contacto)`
  cerca(x, y, r, fn) {
    const sonda = { forma: 'bola', x, y, r, hx: r, hy: r, c: 1, s: 0 };
    const i0 = Math.floor((x - r) / CELDA), i1 = Math.floor((x + r) / CELDA), j0 = Math.floor((y - r) / CELDA), j1 = Math.floor((y + r) / CELDA);
    const vistos = new Set();
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const b of this.grilla.get(j * 4096 + i) || []) {
      if (vistos.has(b) || !b.vivo) continue;
      vistos.add(b);
      const c = chocan(sonda, b);
      if (c) fn(b, c);
    }
  }

  // Despierta a un dormido y a los que se durmieron con él (su "isla"): si se
  // despertara solo la caja de arriba de una pila, la de abajo seguiría
  // dormida sin sentir el peso.
  despertar(b) {
    const lista = b.isla ? b.isla.cuerpos : [b];
    for (const c of lista) if (c.vivo && c.dormido) { c.despertar(); c.isla = null; this.despiertos.push(c); }
  }

  detectar() {
    this.contactos.length = 0;
    this.despiertos = [];
    const previos = this.previos, nuevos = new Map();
    const g = this.grilla, [arriba, abajo] = this.ventana;
    // la marca de "ya probado con A" no vuelve a empezar nunca: si empezara de
    // cero en cada paso, lo marcado en el paso anterior parecería ya probado
    // (una caja sola atravesaba el piso)
    let marca = this.marca || 0;
    const probar = (A, tarde) => {
      marca++;
      const i0 = Math.floor((A.x - A.r) / CELDA), i1 = Math.floor((A.x + A.r) / CELDA);
      const j0 = Math.floor((A.y - A.r) / CELDA), j1 = Math.floor((A.y + A.r) / CELDA);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const l = g.get(j * 4096 + i);
        if (!l) continue;
        for (const B of l) {
          if (B === A || B.marca === marca || !B.vivo) continue;
          B.marca = marca;
          const Bmueve = B.tipo !== ESTATICO && !B.dormido;
          if (Bmueve && B.id < A.id) continue;                   // ese par ya lo probó B
          if (A.tipo !== DINAMICO && (B.tipo !== DINAMICO)) continue;  // cinemático contra fijo: nada
          // uno que se despertó en este paso puede tener ya el par, probado del otro lado
          if (tarde && nuevos.has(B.id * 1048576 + A.id)) continue;
          const dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r;
          if (dx * dx + dy * dy > rr * rr) continue;
          const c = chocan(A, B);
          if (!c) continue;
          if (B.dormido) this.despertar(B);
          c.a = A; c.b = B;
          c.f = Math.sqrt(A.friccion * B.friccion); c.e = Math.max(A.rebote, B.rebote);
          const clave = A.id * 1048576 + B.id, viejo = previos.get(clave);
          if (viejo) for (const p of c.puntos) {
            let mejor = null, d2m = 4;
            for (const q of viejo.puntos) { const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d2 < d2m) { d2m = d2; mejor = q; } }
            if (mejor) { p.pn = mejor.pn; p.pt = mejor.pt; }
          }
          nuevos.set(clave, c);
          this.contactos.push(c);
        }
      }
    };
    const enVentana = (A) => A.y + A.r >= arriba && A.y - A.r <= abajo;
    // buscan pareja los que se mueven; los quietos (estáticos y dormidos) solo esperan
    for (const A of this.cuerpos) if (A.vivo && A.tipo !== ESTATICO && !A.dormido && enVentana(A)) probar(A, false);
    // Los que se despertaron recién ya habían pasado dormidos por la vuelta:
    // se prueban ahora, si no la caja de abajo de la pila se quedaba este paso
    // sin el piso y la de arriba la hundía.
    for (let k = 0; k < this.despiertos.length; k++) { const A = this.despiertos[k]; if (enVentana(A)) probar(A, true); }
    this.marca = marca;
    this.previos = nuevos;
  }

  // Se duermen de a islas (los que se tocan): una caja de abajo que se durmiera
  // sola mientras la de arriba todavía se acomoda la despertaría a cada rato,
  // y cada despertar es un golpe (la pila no paraba nunca).
  dormir(dt) {
    const act = [];
    const raiz = (b) => { while (b.padre !== b) { b.padre = b.padre.padre; b = b.padre; } return b; };
    for (const b of this.cuerpos) {
      if (!b.vivo || b.tipo !== DINAMICO || b.dormido) continue;
      if (b.vx * b.vx + b.vy * b.vy < DORMIR_V2 && Math.abs(b.w) < DORMIR_W && !b.colgado) b.quieto += dt; else b.quieto = 0;
      b.padre = b; b.menor = b.quieto; act.push(b);
    }
    for (const ct of this.contactos) {
      const A = ct.a, B = ct.b;
      if (A.tipo !== DINAMICO || B.tipo !== DINAMICO || A.dormido || B.dormido) {
        // apoyado en algo que se mueve solo (el escudo): no se duerme
        if (A.tipo === CINEMATICO) B.menor = 0; else if (B.tipo === CINEMATICO) A.menor = 0;
        continue;
      }
      const ra = raiz(A), rb = raiz(B);
      if (ra !== rb) { rb.padre = ra; if (rb.menor < ra.menor) ra.menor = rb.menor; }
    }
    const islas = new Map();
    for (const b of act) {
      const r = raiz(b);
      if (b.menor < r.menor) r.menor = b.menor;
    }
    for (const b of act) {
      const r = raiz(b);
      if (r.menor <= DORMIR_T) continue;
      let isla = islas.get(r); if (!isla) { isla = { cuerpos: [] }; islas.set(r, isla); }
      isla.cuerpos.push(b);
      b.dormido = true; b.vx = b.vy = b.w = 0; b.isla = isla;
    }
  }

  paso(dt) {
    const inv = 1 / dt, [arriba, abajo] = this.ventana;
    this.armarGrilla();
    this.detectar();
    // la gravedad después de buscar los choques: así la reciben también los que se despertaron recién
    const activo = (b) => b.vivo && !b.dormido && b.y + b.r >= arriba - 200 && b.y - b.r <= abajo + 200;
    for (const b of this.cuerpos) if (b.tipo === DINAMICO && activo(b)) {
      b.vy += this.g * b.gravedad * dt;
      const k = 1 / (1 + dt * (b.aire ?? this.aire)); b.vx *= k; b.vy *= k; b.w /= 1 + dt * (b.roceGiro ?? AIRE_GIRO);
    }
    // primero se miden todos los choques y recién después se aplica el
    // arranque: si el arranque de un contacto entrara antes de medir el
    // siguiente, el de más arriba "veía" un golpe fuerte que no existía y
    // rebotaba (una pila de 6 cajas no se quedaba quieta nunca)
    for (const ct of this.contactos) preparar(ct, inv);
    for (const ct of this.contactos) arrancar(ct);
    for (let it = 0; it < this.iteraciones; it++) {
      for (const ct of this.contactos) resolver(ct);
      for (const cu of this.cuerdas) tirar(cu, inv);
    }
    // los golpes contra el que escucha (el escudo), con la velocidad del choque: para el sonido
    if (this.oido) for (const ct of this.contactos) if ((ct.a === this.oido || ct.b === this.oido) && ct.impacto > UMBRAL_REBOTE) {
      this.golpes.push({ vel: ct.impacto, x: ct.puntos[0].x, y: ct.puntos[0].y, cuerpo: ct.a === this.oido ? ct.b : ct.a });
    }
    for (const b of this.cuerpos) {
      if (!b.vivo || b.tipo === ESTATICO || b.dormido) continue;
      const v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 > VEL_MAX * VEL_MAX) { const k = VEL_MAX / Math.sqrt(v2); b.vx *= k; b.vy *= k; }
      const gm = b.giroMax ?? GIRO_MAX;
      if (b.w > gm) b.w = gm; else if (b.w < -gm) b.w = -gm;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.w) b.girar(b.a + b.w * dt);
      // el tope de giro (un molinete que abre como tranquera): contra el tope, se frena
      if (b.tope) {
        if (b.a < b.tope[0]) { b.girar(b.tope[0]); if (b.w < 0) b.w = 0; }
        else if (b.a > b.tope[1]) { b.girar(b.tope[1]); if (b.w > 0) b.w = 0; }
      }
    }
    // quieto un rato: se duerme (una pila que ya cayó no gasta nada)
    this.dormir(dt);
    if (this.hayMuertos) {
      this.cuerpos = this.cuerpos.filter((b) => b.vivo);
      this.cuerdas = this.cuerdas.filter((c) => c.b.vivo);
      this.hayMuertos = false;
    }
  }
}

function preparar(ct, inv) {
  const A = ct.a, B = ct.b, nx = ct.nx, ny = ct.ny, tx = ny, ty = -nx;
  ct.impacto = 0;
  for (const p of ct.puntos) {
    p.r1x = p.x - A.x; p.r1y = p.y - A.y; p.r2x = p.x - B.x; p.r2y = p.y - B.y;
    const rn1 = p.r1x * nx + p.r1y * ny, rn2 = p.r2x * nx + p.r2y * ny;
    const r1 = p.r1x * p.r1x + p.r1y * p.r1y, r2 = p.r2x * p.r2x + p.r2y * p.r2y;
    const kn = A.im + B.im + A.ii * (r1 - rn1 * rn1) + B.ii * (r2 - rn2 * rn2);
    p.mn = kn > 0 ? 1 / kn : 0;
    const rt1 = p.r1x * tx + p.r1y * ty, rt2 = p.r2x * tx + p.r2y * ty;
    const kt = A.im + B.im + A.ii * (r1 - rt1 * rt1) + B.ii * (r2 - rt2 * rt2);
    p.mt = kt > 0 ? 1 / kt : 0;
    p.sesgo = Math.min(CORRECCION_MAX, -BETA * inv * Math.min(0, p.sep + HOLGURA));
    const dvx = B.vx - B.w * p.r2y - (A.vx - A.w * p.r1y), dvy = B.vy + B.w * p.r2x - (A.vy + A.w * p.r1x);
    const vn = dvx * nx + dvy * ny;
    if (vn < -UMBRAL_REBOTE) p.sesgo = Math.max(p.sesgo, -ct.e * vn);
    if (-vn > ct.impacto) ct.impacto = -vn;
    p.pn = p.pn || 0; p.pt = p.pt || 0;
  }
}

// el impulso del paso anterior, de arranque
function arrancar(ct) {
  const A = ct.a, B = ct.b, nx = ct.nx, ny = ct.ny, tx = ny, ty = -nx;
  for (const p of ct.puntos) {
    if (!p.pn && !p.pt) continue;
    const px = p.pn * nx + p.pt * tx, py = p.pn * ny + p.pt * ty;
    A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (p.r1x * py - p.r1y * px);
    B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (p.r2x * py - p.r2y * px);
  }
}

function resolver(ct) {
  const A = ct.a, B = ct.b, nx = ct.nx, ny = ct.ny, tx = ny, ty = -nx;
  for (const p of ct.puntos) {
    let dvx = B.vx - B.w * p.r2y - (A.vx - A.w * p.r1y), dvy = B.vy + B.w * p.r2x - (A.vy + A.w * p.r1x);
    let d = p.mn * (-(dvx * nx + dvy * ny) + p.sesgo);
    const pn0 = p.pn; p.pn = Math.max(pn0 + d, 0); d = p.pn - pn0;
    let px = d * nx, py = d * ny;
    A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (p.r1x * py - p.r1y * px);
    B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (p.r2x * py - p.r2y * px);
    dvx = B.vx - B.w * p.r2y - (A.vx - A.w * p.r1y); dvy = B.vy + B.w * p.r2x - (A.vy + A.w * p.r1x);
    d = p.mt * -(dvx * tx + dvy * ty);
    const tope = ct.f * p.pn, pt0 = p.pt;
    p.pt = Math.max(-tope, Math.min(tope, pt0 + d)); d = p.pt - pt0;
    px = d * tx; py = d * ty;
    A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (p.r1x * py - p.r1y * px);
    B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (p.r2x * py - p.r2y * px);
  }
}

// La cuerda: la bola no se aleja del punto más que su largo (una vara, además,
// no deja que se acerque). Se corrige la velocidad a lo largo de la cuerda,
// con la misma corrección de a poco que los contactos.
function tirar(cu, inv) {
  const b = cu.b;
  if (!b.vivo || b.dormido) return;
  const ox = cu.desde ? cu.desde.x : cu.x, oy = cu.desde ? cu.desde.y : cu.y;
  const dx = b.x - ox, dy = b.y - oy, d = Math.hypot(dx, dy);
  if (d < 1e-6) return;
  const nx = dx / d, ny = dy / d, err = d - cu.largo;
  if (!cu.vara && err < 0) return;                 // floja: no tira
  const ovx = cu.desde ? cu.desde.vx : 0, ovy = cu.desde ? cu.desde.vy : 0;
  const l = -((b.vx - ovx) * nx + (b.vy - ovy) * ny + BETA * inv * err);
  if (!cu.vara && l > 0) return;                   // una cuerda tira, no empuja
  b.vx += l * nx; b.vy += l * ny;
}
