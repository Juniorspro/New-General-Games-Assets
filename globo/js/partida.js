// Una partida: el globo que sube solo, el escudo que maneja el dedo, las
// formaciones que van apareciendo y la física que las mueve.
//
// El globo sube a velocidad fija por x = 180 y la cámara lo sigue (queda al
// 72 % del alto de la vista). El escudo es un cuerpo cinemático: se mueve con
// la cámara (si el dedo no se mueve, queda quieto en la pantalla y en el
// mundo va subiendo, empujando lo que tenga arriba) más lo que arrastre el
// dedo. Cualquier cosa que no sea el escudo y toque el globo, lo revienta.
//
// La física va a 120 pasos por segundo (a 60 el escudo rápido atravesaría las
// bolas chicas) y el movimiento del dedo de cada cuadro se reparte entre los
// pasos de ese cuadro.
import { Mundo, Cuerpo, ESTATICO, CINEMATICO, DINAMICO } from './fisica.js';
import { armarNivel, crearInfinito, ANCHO } from './niveles.js';
import { TEMAS } from './temas.js';
import { azar, clamp, trozos } from './util.js';

export const PASO_FIS = 1 / 120;
export const R_GLOBO = 22;
export const R_ESCUDO = 20;
export const R_MONEDA = 10;
// liviana, como en el aire: lo que se suelta cae despacio y da tiempo a atajarlo
const GRAVEDAD = 320;
const VEL_ESCUDO = 2600;        // tope del escudo, en unidades por segundo
const ALTO_GLOBO = 0.72;        // dónde va el globo en la vista (desde arriba)
export const VAIVEN = 12;        // cuánto se hamaca el globo de lado (niveles.js › COLUMNA lo tiene en cuenta)

export class Partida {
  // `formaciones`: una lista propia en vez de la del nivel (las pruebas arman así una formación sola)
  // `inmortal`: el globo no revienta (para que las pruebas recorran el infinito entero)
  constructor({ nivel = 0, infinito = false, semilla = 1, formaciones = null, inmortal = false } = {}) {
    this.nivel = nivel; this.infinito = infinito; this.inmortal = inmortal;
    this.def = infinito ? crearInfinito(semilla) : armarNivel(nivel);
    if (formaciones) {
      this.def.formaciones = formaciones;
      const ult = formaciones[formaciones.length - 1];
      this.def.largo = -(ult.y0 - ult.alto) + 300;
    }
    this.vel = this.def.vel;
    this.largo = this.def.largo;
    this.mundo = new Mundo({ gravedad: GRAVEDAD, iteraciones: 8, aire: 0.6 });
    this.globo = { x: ANCHO / 2, y: 0, r: R_GLOBO, vivo: true, vx: 0 };
    this.escudo = this.mundo.agregar(new Cuerpo({ tipo: CINEMATICO, forma: 'bola', r: R_ESCUDO, x: ANCHO / 2 - 70, y: -95, friccion: 0.5, rebote: 0.1 }));
    this.mundo.oido = this.escudo;
    this.vista = { w: ANCHO, h: 640 };
    // el escudo, medido desde el globo (así cambiar el alto de la vista no lo
    // corre). Arranca corrido a un costado: la primera caja está justo arriba
    // del globo y hay que moverlo para correrla (el nivel 1 lo enseña así).
    this.rel = { x: ANCHO / 2 - 70, y: -95 };
    this.relObj = { x: ANCHO / 2 - 70, y: -95 };
    this.pendientes = this.infinito ? [] : [...this.def.formaciones];
    this.activas = [];
    this.monedas = [];
    this.tomadas = 0;
    this.estado = 'juego';                     // juego → pum | meta
    this.tFin = 0; this.t = 0;
    this.eventos = [];
    this.particulas = [];
    this.azarVisual = azar(1234 + nivel);
    this.clavos = [];
    this.medir(ANCHO, 640);
    this.escudo.y = this.globo.y + this.rel.y;
    this.cargar();
  }

  // la vista en unidades del mundo (main.js la pasa según la pantalla)
  medir(w, h) {
    this.vista.w = w; this.vista.h = h;
    this.relObj.x = clamp(this.relObj.x, R_ESCUDO, ANCHO - R_ESCUDO);
    this.relObj.y = clamp(this.relObj.y, R_ESCUDO - h * ALTO_GLOBO, h * (1 - ALTO_GLOBO) - R_ESCUDO);
  }
  arriba() { return this.globo.y - this.vista.h * ALTO_GLOBO; }
  abajo() { return this.arriba() + this.vista.h; }
  altura() { return Math.max(0, -this.globo.y); }
  progreso() { return this.infinito ? 0 : clamp(this.altura() / this.largo, 0, 1); }
  tema() {
    if (!this.infinito) return TEMAS[this.def.tema];
    return TEMAS[this.def.tema(this.altura())];
  }

  // lo que arrastró el dedo en este cuadro, en unidades del mundo
  mover(dx, dy) {
    const h = this.vista.h;
    this.relObj.x = clamp(this.relObj.x + dx, R_ESCUDO, ANCHO - R_ESCUDO);
    this.relObj.y = clamp(this.relObj.y + dy, R_ESCUDO - h * ALTO_GLOBO, h * (1 - ALTO_GLOBO) - R_ESCUDO);
  }

  // ── las formaciones: se arman un poco antes de verse y se sacan al pasar ──
  cargar() {
    const tope = this.arriba() - 900;
    if (this.infinito) while (!this.pendientes.length || this.pendientes[this.pendientes.length - 1].y0 > tope) this.pendientes.push(this.def.siguiente());
    while (this.pendientes.length && this.pendientes[0].y0 > tope) this.armar(this.pendientes.shift());
  }
  armar(f) {
    const m = this.mundo, tema = this.tema(), cuerpos = [], grupos = new Map();
    const r = azar(Math.round(-f.y0) * 31 + 7);
    for (const p of f.piezas) {
      const tipo = p.tipo === 'fijo' ? ESTATICO : p.tipo === 'aspa' ? CINEMATICO : DINAMICO;
      const color = p.tipo === 'fijo' ? tema.fijo : r.uno(tema.cuerpos);
      const c = new Cuerpo({
        tipo, forma: p.forma, x: p.x, y: f.y0 + p.y, a: p.a || 0, w: p.w, h: p.h, r: p.r,
        densidad: p.densidad || 1, dormido: tipo === DINAMICO, pivote: p.tipo === 'molinete', color,
        friccion: p.forma === 'bola' ? 0.3 : 0.5, rebote: p.forma === 'bola' ? 0.25 : 0.08,
        datos: { pieza: p.tipo || 'suelta', formacion: f },
      });
      if (p.tipo === 'aspa') c.w = p.giro;
      // el molinete gira duro, como una bisagra con óxido: si girara libre, al
      // empujarlo daba media vuelta y la otra punta volvía contra el globo
      if (p.tipo === 'molinete') { c.roceGiro = 2.6; c.giroMax = 5; c.tope = p.tope; }
      m.agregar(c); cuerpos.push(c);
      if (p.grupo) { if (!grupos.has(p.grupo)) grupos.set(p.grupo, []); grupos.get(p.grupo).push(c); }
      if (p.tipo === 'pendulo') {
        // pesada: el aire casi no la frena (con el roce de todos, no llegaba a la columna)
        c.colgado = true; c.aire = 0.03;
        const clavo = m.agregar(new Cuerpo({ tipo: ESTATICO, forma: 'bola', r: 6, x: p.ax, y: f.y0 + p.ay, color: tema.fijo, datos: { pieza: 'clavo', formacion: f } }));
        cuerpos.push(clavo);
        c.cuerda = m.cuerda(c, p.ax, f.y0 + p.ay, p.largo);
        // cuánto tarda en llegar a la columna desde que se suelta: la bajada
        // (un cuarto de hamaca, un poco más por ser amplia) más el tramo hasta
        // la columna, que hace casi a su velocidad más alta
        const sep = Math.abs(p.ax - ANCHO / 2), cuarto = (Math.PI / 2) * Math.sqrt(p.largo / GRAVEDAD) * (1 + p.alzada * p.alzada / 16);
        const vmax = Math.sqrt(2 * GRAVEDAD * p.largo * (1 - Math.cos(p.alzada)));
        f.tarda = cuarto + (Math.asin(Math.min(1, sep / p.largo)) * p.largo) / vmax;
      }
    }
    for (const lista of grupos.values()) m.grupo(lista);
    for (const [x, y] of f.monedas) this.monedas.push({ x, y: f.y0 + y, tomada: false, t: r() * 6 });
    f.cuerpos = cuerpos; f.activada = f.cruce === undefined;
    // lo que llueve cae de a una pieza, cuando cada una asoma arriba de la
    // vista: todas juntas eran un bloque imposible de atajar
    f.caen = cuerpos.filter((c) => c.datos.pieza === 'cae');
    this.activas.push(f);
  }
  activar(f) {
    f.activada = true;
    for (const c of f.cuerpos) if (c.datos.pieza === 'pendulo') this.mundo.despertar(c);
    this.eventos.push({ tipo: 'pendulo' });
  }
  soltar(f, arriba) {
    for (let i = f.caen.length - 1; i >= 0; i--) {
      const c = f.caen[i];
      if (!c.vivo || !c.dormido) { f.caen.splice(i, 1); continue; }
      if (c.y + c.r > arriba + 4) {
        this.mundo.despertar(c); f.caen.splice(i, 1);
        if (!f.llovio) { f.llovio = true; this.eventos.push({ tipo: 'lluvia' }); }
      }
    }
  }

  // ── el tiempo ──────────────────────────────────────────────────────────────
  avanzar(dtCuadro) {
    const [n, d] = trozos(dtCuadro, PASO_FIS);
    const x0 = this.rel.x, y0 = this.rel.y;
    for (let k = 1; k <= n; k++) this.paso(d, x0 + ((this.relObj.x - x0) * k) / n, y0 + ((this.relObj.y - y0) * k) / n);
  }

  paso(dt, relX, relY) {
    this.t += dt;
    const g = this.globo, m = this.mundo, e = this.escudo;
    if (this.infinito) this.vel = this.def.velEn(this.altura());
    // el globo sube (después de reventar, ya no; en la meta, sigue y se va) y
    // se hamaca un poco de lado a lado, como un globo de verdad
    if (this.estado === 'juego' || this.estado === 'meta') {
      g.y -= this.vel * dt * (this.estado === 'meta' ? 1.6 : 1);
      g.x = ANCHO / 2 + Math.sin(this.t * 0.9) * VAIVEN + Math.sin(this.t * 2.3) * 1.5;
    }
    const arriba = this.arriba(), abajo = arriba + this.vista.h;
    // el escudo va hacia donde lo lleva el dedo, sin pasar el tope de velocidad
    if (this.estado === 'juego') {
      const ox = relX, oy = g.y + relY;
      let vx = (ox - e.x) / dt, vy = (oy - e.y) / dt;
      const v = Math.hypot(vx, vy);
      if (v > VEL_ESCUDO) { vx *= VEL_ESCUDO / v; vy *= VEL_ESCUDO / v; }
      e.vx = vx; e.vy = vy;
      this.rel.x = relX; this.rel.y = relY;
    } else { e.vx *= 0.9; e.vy = -this.vel * (this.estado === 'meta' ? 1.6 : 0); }
    m.ventana[0] = arriba - 420; m.ventana[1] = abajo + 160;
    this.cargar();
    for (const f of this.activas) {
      // el péndulo se suelta cuando al globo le falta `tarda` segundos para llegar al cruce
      if (!f.activada && g.y - (f.y0 + f.cruce) < this.vel * f.tarda) this.activar(f);
      if (f.caen.length) this.soltar(f, arriba);
    }
    m.paso(dt);
    // los golpes del escudo, para el sonido y el polvo
    for (const gp of m.golpes) {
      if (gp.vel > 140) {
        this.eventos.push({ tipo: 'golpe', vel: gp.vel });
        this.polvo(gp.x, gp.y, Math.min(8, 2 + gp.vel / 150), gp.cuerpo.color);
      }
    }
    m.golpes.length = 0;
    if (this.estado === 'juego') {
      // ¿algo toca el globo?
      let quien = null;
      m.cerca(g.x, g.y, g.r * 0.92, (b) => { if (b !== e && !quien) quien = b; });
      if (quien && !this.inmortal) this.reventar(quien);
      else if (!this.infinito && -g.y >= this.largo) this.meta();
    }
    // las monedas: las junta el escudo (o el globo, si pasa por encima)
    for (const mo of this.monedas) {
      if (mo.tomada || mo.y < arriba - 40 || mo.y > abajo + 40) continue;
      mo.t += dt;
      const aEscudo = Math.hypot(mo.x - e.x, mo.y - e.y) < R_ESCUDO + R_MONEDA, aGlobo = this.estado === 'juego' && Math.hypot(mo.x - g.x, mo.y - g.y) < R_GLOBO + R_MONEDA;
      if (aEscudo || aGlobo) {
        mo.tomada = true; this.tomadas++;
        this.eventos.push({ tipo: 'moneda', n: this.tomadas });
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; this.particulas.push({ tipo: 'brillo', x: mo.x, y: mo.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, t: 0, vida: 0.4, color: '#ffd23f', r: 3 }); }
      }
    }
    this.monedas = this.monedas.filter((mo) => !mo.tomada && mo.y < abajo + 200);
    // lo que cayó por debajo de la vista (o salió por los costados) se va
    for (const b of m.cuerpos) {
      if (b === e) continue;
      if (b.y - b.r > abajo + 140 || b.x < -260 || b.x > ANCHO + 260) m.sacar(b);
    }
    this.activas = this.activas.filter((f) => f.y0 - f.alto < abajo + 400 || f.cuerpos.some((c) => c.vivo && c.tipo !== ESTATICO));
    for (const p of this.particulas) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * (p.roce ?? 2); p.vy = p.vy * (1 - dt * (p.roce ?? 2)) + (p.g ?? 0) * dt;
      if (p.giro) p.a = (p.a || 0) + p.giro * dt;
    }
    this.particulas = this.particulas.filter((p) => p.t < p.vida);
    if (this.estado !== 'juego') this.tFin += dt;
  }

  polvo(x, y, n, color) {
    const r = this.azarVisual;
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, v = 40 + r() * 110;
      this.particulas.push({ tipo: 'polvo', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.35 + r() * 0.25, color: color || '#ffffff', r: 2 + r() * 3 });
    }
  }

  reventar(quien) {
    const g = this.globo;
    this.estado = 'pum'; g.vivo = false; this.tFin = 0;
    this.culpable = quien;
    this.eventos.push({ tipo: 'pum' });
    // los pedazos del globo, del color del globo (dibujo.js les pone el color)
    const r = this.azarVisual;
    for (let k = 0; k < 18; k++) {
      const a = r() * Math.PI * 2, v = 120 + r() * 260;
      this.particulas.push({ tipo: 'pedazo', x: g.x + Math.cos(a) * g.r * 0.6, y: g.y + Math.sin(a) * g.r * 0.6, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, vida: 0.9 + r() * 0.5, g: 520, roce: 1.2, r: 3 + r() * 5, a: r() * 6, giro: (r() - 0.5) * 20 });
    }
  }

  meta() {
    this.estado = 'meta'; this.tFin = 0;
    this.eventos.push({ tipo: 'meta' });
    const r = this.azarVisual, cols = this.tema().cuerpos;
    for (let k = 0; k < 70; k++) {
      // desde los dos costados, hacia arriba y hacia el medio
      const lado = k % 2 ? 1 : -1, ang = 0.35 + r() * 0.6, v = 380 + r() * 380;
      this.particulas.push({ tipo: 'papel', x: lado < 0 ? 0 : ANCHO, y: this.globo.y + 40, vx: -lado * Math.sin(ang) * v, vy: -Math.cos(ang) * v, t: 0, vida: 2.2 + r(), g: 300, roce: 1.4, r: 3 + r() * 3, a: r() * 6, giro: (r() - 0.5) * 14, color: cols[k % cols.length] });
    }
  }

  sacarEventos() { const e = this.eventos; this.eventos = []; return e; }
}
