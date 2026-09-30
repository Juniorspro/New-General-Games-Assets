// Un nivel en juego: el caramelo colgado de sus hilos, las estrellas, Morfi
// esperando con la boca abierta y lo que hay en el medio:
//   clips      alfileres con un radio: si el caramelo entra, le sale un hilo
//   globos     globos de papel: el caramelo que entra sube; un toque lo revienta
//   abanicos   un toque y soplan hacia donde miran
//   chinches   una fila de chinches: el caramelo que las toca se rompe
//   sobres     de a dos: el caramelo que entra en uno sale por el otro
//   elasticos  una gomita entre dos alfileres: rebota
//   pines que se mueven (el alfiler de un hilo va y viene)
// Todo en unidades del tablero: 320 de ancho por 480 de alto, y abajo es +y.
import { Mundo, PASO, aTramo } from './cuerdas.js';

export const ANCHO = 320;
export const ALTO = 480;
export const R_CARAMELO = 15;
const R_ESTRELLA = 13, R_BOCA = 30, R_GLOBO = 24, R_SOBRE = 17;
const BOCA_Y = -70;                 // la boca de Morfi (el hueco de arriba de la caja), desde sus pies: morfi.js › BOCA_MORFI
const ABRE = 135;                   // a esta distancia Morfi abre la boca
const SOPLO = { alcance: 240, cono: 0.62, fuerza: 780 };
const SUBE_GLOBO = 1.32;            // el globo tira para arriba 1,32 veces la gravedad (sube a 0,32 g)
// en el globo, el soplido rinde menos: el aire lo frena pero nada lo tira
// para abajo, y con el soplido entero cruzaba el tablero (medido: 420 px)
const VELA_GLOBO = 0.6;

export class Partida {
  constructor(def) {
    this.def = def;
    const m = (this.mundo = new Mundo());
    this.t = 0; this.pasos = 0;
    this.estado = 'juego';            // juego → comido | roto | perdido
    this.tFin = 0;
    this.eventos = [];
    this.estrellas = def.estrellas.map(([x, y], i) => ({ x, y, i, tomada: false, t: i * 0.7 }));
    this.tomadas = 0;
    this.morfi = { x: def.morfi[0], y: def.morfi[1] };
    const [cx, cy] = def.caramelo;
    this.c = m.particula(cx, cy, 1 / 6, 0.9985);
    this.enGlobo = null;
    this.giro = 0;                    // el caramelo gira: colgado, sigue al hilo; suelto, rueda
    // los hilos del principio, cada uno con su alfiler
    this.pines = [];
    (def.hilos || []).forEach((h, i) => {
      // el alfiler que se mueve arranca en la punta `a` de su riel (si no, al primer paso pega un tirón)
      const [px, py] = h.mueve ? h.mueve.a : h.pin;
      const pin = { x: px, y: py, mueve: h.mueve || null, ref: i };
      pin.p = m.particula(pin.x, pin.y, 0);
      this.pines.push(pin);
      const largo = h.largo ?? Math.hypot(cx - pin.x, cy - pin.y);
      m.hilo(pin.p, this.c, largo, { ref: i });
    });
    this.clips = (def.clips || []).map(([x, y, r], i) => ({ x, y, r, i, usado: false, t: 0 }));
    this.globos = (def.globos || []).map(([x, y], i) => ({ x, y, i, usado: false, t: i }));
    this.abanicos = (def.abanicos || []).map(([x, y, ang], i) => ({ x, y, ang, i, soplo: 0 }));
    this.chinches = (def.chinches || []).map(([ax, ay, bx, by], i) => ({ ax, ay, bx, by, i }));
    this.sobres = (def.sobres || []).map(([a, b], i) => ({ a: { x: a[0], y: a[1], ang: a[2] }, b: { x: b[0], y: b[1], ang: b[2] }, i, espera: 0 }));
    this.elasticos = (def.elasticos || []).map(([ax, ay, bx, by], i) => ({ ax, ay, bx, by, i, vibra: 0 }));
    this.acumulado = 0;
  }

  get x() { return this.mundo.x[this.c]; }
  get y() { return this.mundo.y[this.c]; }
  boca() { return [this.morfi.x, this.morfi.y + BOCA_Y]; }
  // 0 (lejos) a 1 (en la boca): cuánto abre Morfi
  apetito() { const [bx, by] = this.boca(); return this.estado !== 'juego' ? 0 : Math.max(0, Math.min(1, 1 - (Math.hypot(this.x - bx, this.y - by) - R_BOCA) / ABRE)); }

  // ── lo que hace quien juega ──
  cortar(x1, y1, x2, y2) {
    if (this.estado !== 'juego') return 0;
    const cortes = this.mundo.cortar(x1, y1, x2, y2);
    for (const c of cortes) this.eventos.push({ tipo: 'corte', x: c.x, y: c.y });
    return cortes.length;
  }
  // un toque: revienta el globo (si toca cerca del caramelo) o hace soplar un abanico
  tocar(x, y) {
    if (this.estado !== 'juego') return false;
    if (this.enGlobo && Math.hypot(x - this.x, y - this.y) < R_GLOBO + 22) { this.reventar(); return true; }
    for (const a of this.abanicos) if (Math.hypot(x - a.x, y - a.y) < 34) { this.soplar(a); return true; }
    return false;
  }
  reventar() {
    const m = this.mundo;
    this.eventos.push({ tipo: 'pop', x: this.x, y: this.y });
    this.enGlobo = null; m.ay[this.c] = 0; m.aire[this.c] = 0.9985;
  }
  soplar(a) {
    a.soplo = 0.35;
    this.eventos.push({ tipo: 'soplo', x: a.x, y: a.y, ang: a.ang });
    const dx = this.x - a.x, dy = this.y - a.y, d = Math.hypot(dx, dy);
    if (d > SOPLO.alcance || d < 1) return;
    const ux = Math.cos(a.ang), uy = Math.sin(a.ang), cos = (dx * ux + dy * uy) / d;
    if (cos < Math.cos(SOPLO.cono)) return;
    const f = SOPLO.fuerza * Math.sqrt(1 - d / SOPLO.alcance) * (0.6 + 0.4 * cos) * (this.enGlobo ? VELA_GLOBO : 1);
    const [vx, vy] = this.mundo.vel(this.c);
    this.mundo.ponerVel(this.c, vx + ux * f, vy + uy * f);
  }

  // Las acciones de una solución guardada: ['c', i] corta el hilo i del
  // nivel por el medio; ['g'] revienta el globo; ['a', i] hace soplar el abanico i.
  accion(a) {
    if (a[0] === 'c') {
      const h = this.mundo.hilos.find((h) => h.vivo && !h.suelto && h.ref === a[1] && h.p[h.p.length - 1] === this.c);
      if (h) { const c = this.mundo.cortarEn(h, Math.floor((h.p.length - 1) / 2)); if (c) this.eventos.push({ tipo: 'corte', x: c.x, y: c.y }); }
    } else if (a[0] === 'g') { if (this.enGlobo) this.reventar(); }
    else if (a[0] === 'a') this.soplar(this.abanicos[a[1]]);
  }

  // ── el tiempo ──
  // avanza el tiempo real en pasos fijos; devuelve cuánto del paso que viene
  // ya pasó (para dibujar entre un paso y el otro)
  avanzar(dtReal) {
    this.acumulado += Math.min(dtReal, 0.1);
    while (this.acumulado >= PASO) { this.paso(); this.acumulado -= PASO; }
    return this.acumulado / PASO;
  }

  paso() {
    const m = this.mundo, dt = PASO;
    this.t += dt; this.pasos++;
    // los alfileres que se mueven van y vienen, suave
    for (const pin of this.pines) {
      if (!pin.mueve) continue;
      const { a, b, periodo } = pin.mueve, k = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.t) / periodo);
      pin.x = a[0] + (b[0] - a[0]) * k; pin.y = a[1] + (b[1] - a[1]) * k;
      m.px[pin.p] = m.x[pin.p]; m.py[pin.p] = m.y[pin.p];
      m.x[pin.p] = pin.x; m.y[pin.p] = pin.y;
    }
    if (this.estado === 'juego') m.paso(dt);
    else if (this.estado !== 'roto') m.paso(dt);
    for (const e of this.estrellas) e.t += dt;
    for (const a of this.abanicos) a.soplo = Math.max(0, a.soplo - dt);
    for (const e of this.elasticos) e.vibra = Math.max(0, e.vibra - dt);
    for (const s of this.sobres) s.espera = Math.max(0, s.espera - dt);
    if (this.estado !== 'juego') { this.tFin += dt; return; }
    const x = this.x, y = this.y;
    // el giro del caramelo: colgado, el envoltorio queda de través al hilo
    const sost = m.sostienen(this.c);
    if (sost.length) {
      const h = sost[0], q = h.p[h.p.length - 2], obj = Math.atan2(m.y[q] - y, m.x[q] - x) + Math.PI / 2;
      let d = obj - this.giro; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.giro += d * Math.min(1, dt * 10);
    } else this.giro += (m.vel(this.c)[0] / R_CARAMELO) * dt * 0.4;
    // las estrellas
    for (const e of this.estrellas) {
      if (e.tomada || Math.hypot(x - e.x, y - e.y) > R_CARAMELO + R_ESTRELLA) continue;
      e.tomada = true; this.tomadas++;
      this.eventos.push({ tipo: 'estrella', n: this.tomadas, x: e.x, y: e.y, i: e.i });
    }
    // los clips: al entrar en su radio, sale un hilo tenso
    for (const cl of this.clips) {
      if (cl.usado || Math.hypot(x - cl.x, y - cl.y) > cl.r) continue;
      cl.usado = true;
      cl.p = m.particula(cl.x, cl.y, 0);
      m.hilo(cl.p, this.c, Math.max(24, Math.hypot(x - cl.x, y - cl.y)), { ref: 100 + cl.i, clip: cl.i });
      this.eventos.push({ tipo: 'clip', x: cl.x, y: cl.y });
    }
    // los globos
    for (const gl of this.globos) {
      if (gl.usado || this.enGlobo || Math.hypot(x - gl.x, y - gl.y) > R_GLOBO + 4) continue;
      gl.usado = true; this.enGlobo = gl;
      m.ay[this.c] = -m.g * SUBE_GLOBO; m.aire[this.c] = 0.975;
      // entra frenando: el globo lo ataja
      const [vx, vy] = m.vel(this.c); m.ponerVel(this.c, vx * 0.35, vy * 0.35);
      this.eventos.push({ tipo: 'globo', x: gl.x, y: gl.y });
    }
    // los sobres: entra por uno, sale por el otro para donde mira
    for (const s of this.sobres) {
      if (s.espera > 0) continue;
      for (const [de, a] of [[s.a, s.b], [s.b, s.a]]) {
        if (Math.hypot(x - de.x, y - de.y) > R_SOBRE) continue;
        const [vx, vy] = m.vel(this.c), v = Math.max(160, Math.hypot(vx, vy));
        // los hilos se cortan del lado del caramelo (el alfiler queda con su pedazo)
        m.soltarDe(this.c);
        m.llevar(this.c, a.x + Math.cos(a.ang) * (R_SOBRE + R_CARAMELO + 2), a.y + Math.sin(a.ang) * (R_SOBRE + R_CARAMELO + 2));
        m.ponerVel(this.c, Math.cos(a.ang) * v, Math.sin(a.ang) * v);
        s.espera = 0.4;
        this.eventos.push({ tipo: 'sobre', x: de.x, y: de.y, x2: a.x, y2: a.y });
        break;
      }
    }
    // las gomitas: rebotan con un poco más de lo que llega
    for (const e of this.elasticos) {
      const [d, qx, qy] = aTramo(this.x, this.y, e.ax, e.ay, e.bx, e.by);
      if (d > R_CARAMELO + 3) continue;
      let nx = this.x - qx, ny = this.y - qy; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const [vx, vy] = m.vel(this.c), vn = vx * nx + vy * ny;
      if (vn >= 0) continue;
      const k = 1 + 1.15;
      m.llevar(this.c, qx + nx * (R_CARAMELO + 3.5), qy + ny * (R_CARAMELO + 3.5));
      m.ponerVel(this.c, vx - k * vn * nx, vy - k * vn * ny);
      e.vibra = 0.5;
      this.eventos.push({ tipo: 'boing', x: qx, y: qy, fuerza: -vn });
    }
    // ¿llegó a la boca? La caja abre arriba: lo que viene subiendo (en un
    // globo, desde abajo) choca con el fondo y no entra; lo que cae o llega
    // de costado, sí. (Probado: con "más arriba que el medio de la boca" en
    // vez de la velocidad, el globo que subía por adentro de Morfi se comía.)
    const [bx, by] = this.boca();
    if (Math.hypot(this.x - bx, this.y - by) < R_BOCA && m.vel(this.c)[1] > -30) { this.terminar('comido'); return; }
    // las chinches lo rompen
    for (const ch of this.chinches) {
      if (aTramo(this.x, this.y, ch.ax, ch.ay, ch.bx, ch.by)[0] < R_CARAMELO + 3) { this.terminar('roto'); return; }
    }
    // se fue del tablero
    if (this.y > ALTO + 70 || this.x < -70 || this.x > ANCHO + 70 || this.y < -110) this.terminar('perdido');
  }

  terminar(como) {
    this.estado = como; this.tFin = 0;
    const m = this.mundo;
    if (como === 'comido' || como === 'roto') {
      // el caramelo deja de existir: sus hilos se sueltan
      m.soltarDe(this.c);
      m.activa[this.c] = 0;
    }
    if (this.enGlobo && como !== 'perdido') this.enGlobo = null;
    this.eventos.push({ tipo: como, x: this.x, y: this.y });
  }

  sacarEventos() { const e = this.eventos; this.eventos = []; return e; }
}

// Jugar una solución guardada sin dibujar: [[segundos, acción...], ...].
// Devuelve cómo terminó, cuántas estrellas y en cuánto tiempo.
export function jugarSolucion(def, sol = def.sol, tope = 14) {
  const p = new Partida(def);
  const acciones = [...(sol || [])].sort((a, b) => a[0] - b[0]);
  let k = 0;
  while (p.estado === 'juego' && p.t < tope) {
    while (k < acciones.length && acciones[k][0] <= p.t + 1e-9) p.accion(acciones[k++].slice(1));
    p.paso();
  }
  return { estado: p.estado, estrellas: p.tomadas, t: p.t, p };
}
