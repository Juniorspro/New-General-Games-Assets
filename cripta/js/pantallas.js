// Las escenas: portada, mapa, partida (con pausa, resultado y fin de la
// torre encima), tienda y ajustes. Cada una tiene pasar(dt) y dibujar(g, W, H);
// la app las cambia con un iris (main.js › ir).
import { P, MUNDOS_COLOR } from './paleta.js';
import { texto, anchoTexto } from './fuente.js';
import * as S from './sprites.js';
import { Boton, Botonera, panel, velo, contador, cartelTitulo, luVolando, FondoMenu, iris } from './ui.js';
import { Partida } from './juego.js';
import { leer } from './reglas.js';
import { NIVELES } from './niveles.js';
import { Torre, dificultadTorre } from './infinito.js';
import { CELDA, patronRoca } from './nivel.js';
import { luzRedonda } from './juego.js';
import { PIELES_TIENDA, MEJORAS, NIVEL_MAX, PRECIO_MEJORA, REVIVIR, PREMIO } from './catalogo.js';
import { IDIOMAS } from './idioma.js';
import { salidaAtras, rebote, clamp, acercar } from './util.js';

const silencio = { tocar() {}, lava() {} };
const MUNDOS = 3;

// ¿Se puede jugar el nivel i? El primero siempre; los demás, si se terminó el anterior.
export const abierto = (datos, i) => i === 0 || !!datos.hechos[NIVELES[i - 1].id];
const estrellasDe = (datos, m) => NIVELES.filter((n) => n.mundo === m).reduce((s, n) => s + (datos.estrellas[n.id] || 0), 0);

// Un botón chiquito con un ícono (volver, pausa, ajustes).
const botonIcono = (icono, x, y, accion, op = {}) => new Boton({ icono, x, y, w: 15, h: 13, accion, sonidoAl: 'atras', ...op });

// ── la demo de la portada: la torre, jugada por un bot que conoce el camino ──
function crearDemo(app) {
  const torre = new Torre({ semilla: 20260930, mundo: 0, dificultad: (a) => ({ ...dificultadTorre(a), carriles: 0, erizos: 0, movedizos: 0, poderParada: 0, poder: 0 }) });
  torre.asegurar(torre.nv.alto - 90);
  const p = new Partida({ nv: torre.nv, modo: 'demo', torre, piel: app.datos.piel, sonido: silencio });
  let espera = 1.2;
  return {
    partida: p,
    pasar(dt) {
      p.medir(app.W, app.H);
      if (!p.lu.mueve && p.estado === 'jugando' && (espera -= dt) <= 0) {
        // el tramo que sale de donde está parada (el último, si hay varios)
        const seg = [...torre.segmentos].reverse().find((s) => s.x === p.lu.x && s.y === p.lu.y);
        if (seg) p.deslizar(seg.dx, seg.dy);
        espera = 0.35 + Math.random() * 0.4;
      }
      p.pasar(dt);
    },
    dibujar(g, W, H) { p.dibujar(g, W, H); },
  };
}

// ════════════════════════════════════════════════════════════════════════════
export class Portada {
  constructor(app) {
    this.app = app; this.t = 0; this.nombre = 'portada';
    this.demo = crearDemo(app);
    this.botones = new Botonera(app.sonido);
    this.cambio = -1;
    this.chispas = [];
    this.balanceo = 0; this.vel = 0;
    app.sonido.musica('portada');
  }

  armar() {
    const { W, H, tr } = this.app, b = this.botones;
    b.vaciar();
    const acostado = W > H * 1.25;
    const ancho = Math.min(112, W - 28), h = 20;
    const cx = acostado ? Math.round(W * 0.72) : Math.round(W / 2);
    const y0 = acostado ? Math.round(H / 2 - 44) : Math.round(H - 112);
    const x = Math.round(cx - ancho / 2);
    b.agregar({ id: 'jugar', texto: tr('jugar'), icono: S.ICONO.jugar, x, y: y0, w: ancho, h: h + 4, esc: 1, retraso: 0.15, color: MUNDOS_COLOR[0].borde, accion: (bt) => this.app.ir(() => new Mapa(this.app), bt) });
    b.agregar({ id: 'torre', texto: tr('torre'), icono: S.ICONO.mundo, x, y: y0 + h + 12, w: ancho, h, retraso: 0.25, color: MUNDOS_COLOR[3].borde, accion: (bt) => this.app.ir(() => new Juego(this.app, { torre: true }), bt) });
    b.agregar({ id: 'tienda', texto: tr('tienda'), icono: S.ICONO.carrito, x, y: y0 + 2 * h + 22, w: ancho, h, retraso: 0.35, color: P.moneda, accion: (bt) => this.app.ir(() => new Tienda(this.app), bt) });
    b.agregar(botonIcono(S.ICONO.engranaje, 4, 4, (bt) => this.app.ir(() => new Ajustes(this.app), bt), { id: 'ajustes', retraso: 0.4 }));
    this.acostado = acostado;
    this.cambio = this.app.cambio;
  }

  pasar(dt) {
    const app = this.app;
    if (this.cambio !== app.cambio) this.armar();
    this.t += dt;
    this.demo.pasar(dt);
    this.botones.pasar(dt);
    this.botones.manejar(app.entrada);
    // el cartel se hamaca: un péndulo con resorte que el dedo empuja
    for (const ev of app.entrada.de('deslizar')) if (!ev.tecla) this.vel += ev.dx * 0.05;
    for (const ev of app.entrada.de('tocar')) if (ev.y < app.H * 0.4) this.vel += (ev.x < app.W / 2 ? -1 : 1) * 0.04;
    this.vel += (-this.balanceo * 9 - this.vel * 1.6) * dt;
    this.balanceo += this.vel * dt;
    // la estela de Lu dando vueltas al título
    const [lx, ly] = this.posLu();
    if (Math.random() < 0.7) this.chispas.push({ x: lx + (Math.random() - 0.5) * 3, y: ly + 3, t: 0, col: S.PIELES[app.datos.piel]?.L || P.lu });
    for (const c of this.chispas) { c.t += dt; c.y += dt * 6; }
    this.chispas = this.chispas.filter((c) => c.t < 0.8);
  }

  cxLogo() { return this.acostado ? Math.round(this.app.W * 0.3) : Math.round(this.app.W / 2); }
  yLogo() { return this.acostado ? Math.round(this.app.H / 2 - 38) : 34; }
  posLu() {
    const t = this.t * 0.9, cx = this.cxLogo(), cy = this.yLogo() + 30;
    return [cx + Math.sin(t) * 58, cy + Math.sin(t * 2) * 26 - 4];
  }

  dibujar(g, W, H) {
    const app = this.app, tr = app.tr;
    this.demo.dibujar(g, W, H);
    velo(g, W, H, 0.5);
    // la estela y Lu por detrás del cartel cuando pasa "atrás" (mitad del recorrido)
    const [lx, ly] = this.posLu(), atras = Math.cos(this.t * 0.9) < 0;
    const dibLu = () => {
      for (const c of this.chispas) if (((c.t * 20) | 0) % 3) { g.fillStyle = c.col; g.fillRect(Math.round(c.x), Math.round(c.y), 1, 1); }
      luVolando(g, app.datos.piel, lx, ly, this.t, { mira: Math.cos(this.t * 0.9) > 0 ? 'der' : 'izq' });
    };
    if (atras) dibLu();
    cartelTitulo(g, tr, this.cxLogo(), this.yLogo(), this.t, { esc: 3, balanceo: this.balanceo });
    if (!atras) dibLu();
    contador(g, S.ICONO.moneda, app.datos.monedas, W - 5, 6, { alinear: 'der' });
    this.botones.dibujar(g);
    const rec = app.datos.torre.record;
    if (rec > 0) texto(g, tr('mejorAltura', rec), this.acostado ? Math.round(W * 0.72) : W / 2, H - 16, P.gris, { alinear: 'centro', sombra: P.negro });
    if (!app.sonido.activo() && ((this.t * 2) | 0) % 2) texto(g, tr('tocaAudio'), W / 2, H - 28, P.blanco, { alinear: 'centro', borde: P.negro });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// El mapa: los tres mundos uno arriba del otro, cada uno con sus diez
// niveles en un camino que serpentea. Se arrastra para subir y bajar.
const ALTO_MUNDO = 334, PASO_NODO = 27;
export class Mapa {
  constructor(app, { enfocar = null } = {}) {
    this.app = app; this.t = 0; this.nombre = 'mapa';
    this.fondo = new FondoMenu();
    this.botones = new Botonera(app.sonido);
    this.scroll = 0; this.vel = 0; this.arrastre = null;
    this.cambio = -1;
    // se arranca mirando el último nivel abierto (o el pedido)
    let ultimo = 0;
    NIVELES.forEach((n, i) => { if (abierto(app.datos, i)) ultimo = i; });
    this.sel = enfocar ?? ultimo;
    this.primera = true;
    app.sonido.musica('portada');
  }

  armar() {
    const { W } = this.app;
    this.botones.vaciar();
    this.botones.agregar(botonIcono(S.ICONO.volver, 4, 4, (bt) => this.app.ir(() => new Portada(this.app), bt), { id: 'volver' }));
    this.cambio = this.app.cambio;
    this.ancho = Math.min(W - 20, 150);
  }

  // Todo en coordenadas del contenido (0 arriba de todo): el mundo 1 abajo
  // y el nivel 1 abajo de su franja, porque en la cripta se sube.
  largoTotal() { return 40 + MUNDOS * ALTO_MUNDO; }
  fondoMundo(m) { return this.largoTotal() - m * ALTO_MUNDO; }
  posNodo(i) {
    const { W } = this.app, def = NIVELES[i], k = i - NIVELES.findIndex((n) => n.mundo === def.mundo);
    const x = Math.round(W / 2 + Math.sin(k * 1.05 + def.mundo) * (this.ancho * 0.32));
    return [x, this.fondoMundo(def.mundo) - 62 - k * PASO_NODO];
  }

  enfocarNodo(i, suave = true) {
    const [, y] = this.posNodo(i);
    const obj = clamp(y - this.app.H * 0.55, 0, Math.max(0, this.largoTotal() - this.app.H));
    if (suave) this.objetivo = obj; else { this.scroll = obj; this.objetivo = null; }
  }

  pasar(dt) {
    const app = this.app, e = app.entrada;
    if (this.cambio !== app.cambio) this.armar();
    if (this.primera) { this.enfocarNodo(this.sel, false); this.primera = false; }
    this.t += dt;
    this.fondo.pasar(dt, e, app.W, app.H);
    this.botones.pasar(dt);
    const usado = this.botones.manejar(e);
    const max = Math.max(0, this.largoTotal() - app.H);
    for (const ev of e.cola) {
      if (usado) break;
      if (ev.tipo === 'bajar') { this.arrastre = { y: ev.y, s: this.scroll, ultimo: ev.y, t: 0 }; this.vel = 0; this.objetivo = null; }
      else if (ev.tipo === 'mover' && this.arrastre) {
        const d = ev.y - this.arrastre.y;
        this.scroll = clamp(this.arrastre.s - d, -20, max + 20);
        this.vel = (this.arrastre.ultimo - ev.y) * 60 * 0.5 + this.vel * 0.5;
        this.arrastre.ultimo = ev.y;
      } else if (ev.tipo === 'soltar') this.arrastre = null;
      else if (ev.tipo === 'rueda') { this.scroll = clamp(this.scroll + ev.dy * 0.4 / app.pantalla.s, 0, max); this.vel = 0; this.objetivo = null; }
      else if (ev.tipo === 'tocar') this.tocar(ev.x, ev.y);
      else if (ev.tipo === 'deslizar' && ev.tecla) {
        const n = clamp(this.sel + (ev.dy < 0 || ev.dx > 0 ? 1 : -1), 0, NIVELES.length - 1);
        if (abierto(app.datos, n)) { this.sel = n; this.enfocarNodo(n); app.sonido.tocar('pasos'); }
      } else if (ev.tipo === 'confirmar') this.jugar(this.sel);
      else if (ev.tipo === 'atras') this.app.ir(() => new Portada(this.app));
    }
    if (!this.arrastre) {
      if (this.objetivo !== null && this.objetivo !== undefined) { this.scroll = acercar(this.scroll, this.objetivo, 8, dt); if (Math.abs(this.scroll - this.objetivo) < 0.5) this.objetivo = null; }
      else { this.scroll += this.vel * dt; this.vel *= Math.exp(-4 * dt); }
      if (this.scroll < 0) this.scroll = acercar(this.scroll, 0, 12, dt);
      if (this.scroll > max) this.scroll = acercar(this.scroll, max, 12, dt);
    }
  }

  tocar(px, py) {
    for (let i = 0; i < NIVELES.length; i++) {
      const [x, y] = this.posNodo(i), yr = y - this.scroll;
      if (Math.abs(px - x) <= 11 && Math.abs(py - yr) <= 11) {
        if (!abierto(this.app.datos, i)) { this.app.sonido.tocar('error'); this.sacude = { i, t: 0.35 }; return; }
        this.sel = i;
        this.jugar(i, { x, y: yr });
        return;
      }
    }
  }

  jugar(i, desde) {
    if (!abierto(this.app.datos, i)) return;
    this.app.sonido.tocar('abrir');
    this.app.ir(() => new Juego(this.app, { indice: i }), desde);
  }

  dibujar(g, W, H) {
    const app = this.app, tr = app.tr, d = app.datos, s = Math.round(this.scroll);
    this.fondo.dibujar(g, W, H, 0);
    // las franjas de cada mundo, con su piedra y su color (la de un mundo
    // cerrado, más apagada)
    for (let m = 0; m < MUNDOS; m++) {
      const yTop = this.fondoMundo(m) - ALTO_MUNDO - s, c = MUNDOS_COLOR[m];
      if (yTop > H || yTop + ALTO_MUNDO < 0) continue;
      g.save();
      g.beginPath(); g.rect(0, yTop, W, ALTO_MUNDO); g.clip();
      g.translate(0, -Math.round(s * 0.5) % 16);
      g.fillStyle = patronRoca(g, m); g.fillRect(0, yTop - 16, W, ALTO_MUNDO + 32);
      g.restore();
      g.fillStyle = abierto(d, m * 10) ? 'rgba(5,4,11,0.45)' : 'rgba(5,4,11,0.72)';
      g.fillRect(0, yTop, W, ALTO_MUNDO);
      // el camino ancho por donde van los nodos, un poco más claro
      g.fillStyle = 'rgba(5,4,11,0.35)';
      const aw = Math.round(this.ancho * 0.8);
      g.fillRect(Math.round(W / 2 - aw / 2), yTop, aw, ALTO_MUNDO);
      g.fillStyle = c.borde; g.fillRect(0, yTop, W, 1);
      g.fillStyle = c.claro; g.fillRect(0, yTop + 1, W, 1);
      this.antorchas(g, m, yTop, W);
    }
    // el camino entre nodos: puntitos que avanzan hacia el que sigue
    for (let i = 0; i < NIVELES.length - 1; i++) {
      const [x0, y0] = this.posNodo(i), [x1, y1] = this.posNodo(i + 1);
      const a = [x0, y0 - s], b = [x1, y1 - s];
      if (Math.max(a[1], b[1]) < -10 || Math.min(a[1], b[1]) > H + 10) continue;
      const hecho = !!d.hechos[NIVELES[i].id];
      const pasos = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
      for (let k = 1; k < pasos; k++) {
        const q = k / pasos, fase = ((k - this.t * 6) % 3 + 3) % 3;
        g.fillStyle = hecho ? (fase < 1 ? P.chispa : '#8a7a30') : P.grisOsc;
        g.fillRect(Math.round(a[0] + (b[0] - a[0]) * q), Math.round(a[1] + (b[1] - a[1]) * q), 1, 1);
      }
    }
    // el cartel de cada mundo, en la entrada (abajo del primer nivel), colgado y hamacándose
    for (let m = 0; m < MUNDOS; m++) {
      const y = this.fondoMundo(m) - 40 - s;
      if (y < -40 || y > H + 10) continue;
      const cerrado = !abierto(d, m * 10);
      const nombre = tr('mundo_' + m), sub = cerrado ? tr('cerrado', m) : tr('mundo', m + 1);
      const cuenta = `${estrellasDe(d, m)}/30`;
      const w = Math.min(W - 8, Math.max(anchoTexto(nombre), anchoTexto(sub), anchoTexto(cuenta) + 10) + 14);
      const bx = Math.round(W / 2 - w / 2 + Math.sin(this.t * 1.2 + m) * 2);
      g.fillStyle = '#6a6690';
      for (let k = 0; k < 8; k += 3) { g.fillRect(bx + 6, y - 8 + k, 1, 2); g.fillRect(bx + w - 7, y - 8 + k, 1, 2); }
      panel(g, bx, y, w, 33, { borde: cerrado ? P.grisOsc : MUNDOS_COLOR[m].borde, fondo: P.fondo2 });
      texto(g, sub, bx + w / 2, y + 2, cerrado ? P.rojoLuz : P.gris, { alinear: 'centro' });
      texto(g, nombre, bx + w / 2, y + 12, cerrado ? P.gris : MUNDOS_COLOR[m].borde, { alinear: 'centro', sombra: P.negro });
      if (cerrado) g.drawImage(S.ICONO.candado, Math.round(bx + w / 2 - 2), y + 23);
      else contador(g, S.ICONO.estrella, cuenta, bx + w / 2, y + 21, { alinear: 'centro', color: P.estrella });
    }
    // los nodos
    let actual = -1;
    NIVELES.forEach((n, i) => { if (abierto(d, i)) actual = i; });
    for (let i = 0; i < NIVELES.length; i++) {
      const [x, y0] = this.posNodo(i), y = y0 - s;
      if (y < -20 || y > H + 20) continue;
      this.nodo(g, i, x, y, i === actual);
    }
    // Lu flotando arriba del nivel que toca
    if (actual >= 0) {
      const [x, y0] = this.posNodo(actual), y = y0 - s;
      g.globalCompositeOperation = 'lighter';
      g.drawImage(luzRedonda('#2a3a0c', 16), x - 16, y - 33);
      g.globalCompositeOperation = 'source-over';
      luVolando(g, d.piel, x, y - 17 + Math.round(Math.sin(this.t * 3) * 2), this.t);
    }
    // la barra de arriba
    g.fillStyle = 'rgba(5,4,11,0.85)'; g.fillRect(0, 0, W, 21);
    g.fillStyle = MUNDOS_COLOR[0].borde; g.fillRect(0, 21, W, 1);
    texto(g, tr('mapa'), W / 2, 6, P.blanco, { alinear: 'centro', sombra: P.negro });
    contador(g, S.ICONO.moneda, d.monedas, W - 5, 6, { alinear: 'der' });
    this.botones.dibujar(g);
  }

  // Antorchas a los costados del camino (en el jardín, hongos que brillan;
  // en el horno, grietas de brasa), fijas en el mapa y con su luz.
  antorchas(g, m, yTop, W) {
    const x0 = Math.round(W / 2 - this.ancho * 0.46), x1 = Math.round(W / 2 + this.ancho * 0.46);
    for (let k = 0; k < 6; k++) {
      const y = yTop + 30 + k * 52, x = k % 2 ? x1 : x0;
      if (y < -20 || y > this.app.H + 20) continue;
      const luz = ['#4a2a10', '#3a1450', '#5a2008'][m];
      g.globalCompositeOperation = 'lighter';
      g.drawImage(luzRedonda(luz, 16), x - 16, y - 14);
      g.globalCompositeOperation = 'source-over';
      if (m === 1) {
        const late = ((this.t * 2 + k) | 0) % 2;
        g.fillStyle = late ? '#ff9af0' : '#e66bff'; g.fillRect(x - 3, y, 7, 2); g.fillRect(x - 2, y - 1, 5, 1);
        g.fillStyle = '#ffe0fb'; g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 2, y + 1, 1, 1);
        g.fillStyle = '#d7b6e8'; g.fillRect(x, y + 2, 1, 4);
      } else if (m === 2) {
        const f = ((this.t * 6 + k * 3) | 0) % 3;
        g.fillStyle = P.lavaOsc; g.fillRect(x - 3, y + 2, 7, 1); g.fillRect(x - 1, y + 1, 3, 3);
        g.fillStyle = f ? P.fuego : P.lavaLuz; g.fillRect(x, y + 1 - f, 1, 2 + f);
      } else g.drawImage(S.ANTORCHA[((this.t * 9 + k * 5) | 0) % 3], x - 2, y - 3);
    }
  }

  nodo(g, i, x, y, esActual) {
    const d = this.app.datos, def = NIVELES[i], c = MUNDOS_COLOR[def.mundo];
    const abre = abierto(d, i), hecho = !!d.hechos[def.id];
    const k = i - NIVELES.findIndex((n) => n.mundo === def.mundo) + 1;
    let ox = 0;
    if (this.sacude && this.sacude.i === i && this.sacude.t > 0) { ox = Math.round(Math.sin(this.sacude.t * 70) * 2); this.sacude.t -= 1 / 60; }
    const late = esActual ? Math.round(Math.sin(this.t * 5) * 1) : 0;
    // al abrir el mapa los nodos brotan de a uno, desde el más cercano a Lu
    const brota = salidaAtras(clamp((this.t - Math.abs(i - this.sel) * 0.035) / 0.3, 0, 1));
    if (brota <= 0.05) return;
    const r = Math.max(2, Math.round((9 + late) * Math.min(1.15, brota))), px = x + ox;
    // una piedra redonda de a píxel
    const borde = !abre ? P.grisOsc : hecho ? c.borde : P.blanco;
    for (let yy = -r - 1; yy <= r + 1; yy++) for (let xx = -r - 1; xx <= r + 1; xx++) {
      const dd = Math.hypot(xx + 0.5, yy + 0.5);
      if (dd > r + 1) continue;
      g.fillStyle = dd > r ? P.negro : dd > r - 1 ? borde : yy < -r / 3 ? (abre ? c.relleno : '#1a1830') : (abre ? c.sombra : '#121024');
      g.fillRect(px + xx, y + yy, 1, 1);
    }
    if (brota < 0.8) return;
    if (!abre) g.drawImage(S.ICONO.candado, px - 2, y - 3);
    else texto(g, String(k), px + 1, y - 5, hecho ? c.borde : P.blanco, { alinear: 'centro', sombra: P.negro });
    if (hecho) {
      const n = d.estrellas[def.id] || 0;
      for (let e = 0; e < 3; e++) {
        const sx = px - 11 + e * 8, sy = y + r + 2 - (e === 1 ? 1 : 0);
        g.drawImage(e < n ? S.ESTRELLA[0] : S.ESTRELLA_VACIA, sx, sy);
      }
    }
    if (esActual && ((this.t * 3) | 0) % 2) { g.fillStyle = P.blanco; g.fillRect(px - r - 3, y, 1, 1); g.fillRect(px + r + 3, y, 1, 1); }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// La partida con su interfaz. En un nivel, morir es volver a empezar al toque
// (un iris que se cierra sobre Lu y se abre en la entrada); en la torre, el
// cartel del final.
export class Juego {
  constructor(app, { indice = null, torre = false }) {
    this.app = app; this.indice = indice; this.esTorre = torre; this.t = 0;
    this.nombre = torre ? 'torre' : 'nivel';
    // en la partida las flechas mueven a Lu, no pasean entre botones
    this.botones = new Botonera(app.sonido, { teclado: false });
    this.capa = null;
    this.muertes = 0;
    this.cambio = -1;
    this.reinicio = null;           // el iris de volver a empezar
    this.cobrado = 0;               // en la torre: monedas ya sumadas al monedero
    this.nueva();
    if (torre) app.sonido.musica('torre'); else app.sonido.musicaDeMundo(NIVELES[indice].mundo);
  }

  get def() { return this.indice === null ? null : NIVELES[this.indice]; }

  nueva() {
    const app = this.app, d = app.datos;
    const comun = { piel: d.piel, mejoras: d.mejoras, sonido: app.sonido, vibrar: app.vibrar, tr: app.tr };
    if (this.esTorre) {
      const semilla = ((Date.now() / 1000) | 0) ^ (d.torre.partidas * 7919);
      const torre = new Torre({ semilla, mundo: 3 });
      torre.asegurar(torre.nv.alto - 80);
      this.partida = new Partida({ ...comun, nv: torre.nv, modo: 'torre', torre, lava: { y: (torre.nv.alto + 3) * CELDA, vel: 0.7, espera: 2.5 } });
      this.partida.cartel = { clave: 'aviso_torre', t: 0 };
      this.revivio = false; this.cobrado = 0;
      this.hito = 0; this.pasoRecord = false; this.cartelHito = null;
      d.torre.partidas++;
    } else {
      const def = this.def, nv = leer(def);
      this.partida = new Partida({ ...comun, nv, lava: def.lava ? { y: (nv.alto + 2) * CELDA, vel: def.lava.vel, espera: def.lava.espera ?? 2 } : null });
      // el cartel del principio: siempre en el primer intento, después no molesta
      if (this.muertes > 0) this.partida.cartel = null;
    }
    this.partida.medir(app.W, app.H);
    this.intro = this.muertes === 0 ? 0 : 99;
  }

  armar() {
    this.botones.vaciar();
    this.botones.agregar(botonIcono(S.ICONO.pausa, 3, 1, () => this.pausar(), { id: 'pausa', h: 12, w: 13, t: 1 }));
    this.cambio = this.app.cambio;
  }

  pausar() {
    if (this.capa || this.partida.estado !== 'jugando') return;
    this.capa = new Pausa(this);
    this.app.sonido.tocar('atras');
  }

  pasar(dt) {
    const app = this.app, e = app.entrada, p = this.partida;
    if (this.cambio !== app.cambio) { this.armar(); if (this.capa?.armar) this.capa.armar(); }
    this.t += dt; this.intro += dt;
    if (this.capa) { this.capa.pasar(dt); p.fx.pasar(dt * 0.3); return; }
    if (this.reinicio) { this.pasarReinicio(dt); return; }
    if (e.cola.some((ev) => ev.tipo === 'atras')) { this.pausar(); return; }
    this.botones.pasar(dt);
    const usado = this.botones.manejar(e);
    if (!usado && !this.botones.bajado) for (const ev of e.de('deslizar')) {
      p.deslizar(ev.dx, ev.dy);
      if (p.cartel && p.cartel.t > 1.2) p.cartel.t = Math.max(p.cartel.t, 4.5);
    }
    p.medir(app.W, app.H);
    p.pasar(dt);
    if (p.recogido.monedas > (this.monedasVistas || 0)) { this.golpeMoneda = 0.18; this.monedasVistas = p.recogido.monedas; }
    if (this.golpeMoneda > 0) this.golpeMoneda -= dt;
    if (this.esTorre) this.pasarHitos(dt);
    // el rumor de la lava cuando está cerca
    if (p.lava) {
      const lejos = p.lava.y / CELDA - p.posLu()[1];
      app.sonido.lava(p.estado === 'jugando' ? 1 - clamp((lejos - 4) / 22, 0, 1) : 0);
    }
    if (p.estado === 'terminado') this.terminar();
  }

  // En la torre, cada 50 m un cartel que cae, y otro al pasar el récord.
  pasarHitos(dt) {
    const p = this.partida, rec = this.app.datos.torre.record;
    const hito = Math.floor(p.altoMax / 50);
    if (hito > (this.hito || 0)) {
      this.hito = hito;
      this.cartelHito = { txt: this.app.tr('metros', hito * 50), t: 0, col: MUNDOS_COLOR[3].borde };
      this.app.sonido.tocar('ganada', { n: Math.min(4, hito) });
      this.app.vibrar(20);
    }
    if (rec > 0 && !this.pasoRecord && p.altoMax > rec) {
      this.pasoRecord = true;
      this.cartelHito = { txt: this.app.tr('nuevoRecord'), t: 0, col: P.estrella };
      this.app.sonido.tocar('record');
    }
    if (this.cartelHito && (this.cartelHito.t += dt) > 1.8) this.cartelHito = null;
  }

  dibujarHito(g, W) {
    const c = this.cartelHito;
    if (!c) return;
    const entra = clamp(c.t / 0.3, 0, 1), sale = clamp((c.t - 1.4) / 0.4, 0, 1);
    if (sale > 0 && ((c.t * 20) | 0) % 2) return;
    const y = Math.round(28 - (1 - rebote(entra)) * 30);
    texto(g, c.txt, W / 2, y, c.col, { alinear: 'centro', esc: 2, borde: P.negro });
  }

  terminar() {
    const p = this.partida;
    this.app.sonido.lava(0);
    if (this.esTorre) { this.capa = new FinTorre(this); return; }
    if (p.fin.gano) { this.capa = new Resultado(this); return; }
    // volver a empezar: el iris se cierra sobre donde murió
    this.muertes++;
    const [x, y] = p.centroLu();
    this.reinicio = { t: 0, x: x - Math.round(p.camX), y: y - Math.round(p.camY) };
  }

  pasarReinicio(dt) {
    const r = this.reinicio;
    r.t += dt;
    if (r.t >= 0.28 && !r.hecho) {
      r.hecho = true;
      this.nueva();
      const [x, y] = this.partida.centroLu();
      r.x2 = x - Math.round(this.partida.camX); r.y2 = y - Math.round(this.partida.camY);
    }
    if (r.hecho) this.partida.pasar(dt);
    if (r.t >= 0.62) this.reinicio = null;
  }

  // En la torre: sumar al monedero lo juntado desde la última vez.
  cobrarTorre() {
    const d = this.app.datos, p = this.partida;
    const total = p.recogido.monedas + Math.floor(p.altoMax / 10);
    d.monedas += Math.max(0, total - this.cobrado);
    this.cobrado = total;
    if (p.altoMax > d.torre.record) d.torre.record = p.altoMax;
    this.app.guardar();
  }

  revivir() {
    const d = this.app.datos, p = this.partida;
    if (d.monedas < REVIVIR || this.revivio) return false;
    d.monedas -= REVIVIR; this.revivio = true; this.app.guardar();
    const lu = p.lu;
    const [px, py] = p.ultimaParada || [lu.x, lu.y];
    Object.assign(lu, { x: px, y: py, dx: 0, dy: 0, avance: 0, mueve: false, visible: true, escala: 1, rastro: [] });
    p.estado = 'jugando'; p.fin = null;
    p.invulnerable = 2.2;
    p.poder.escudo = 3;
    if (p.lava) p.lava.y = Math.max(p.lava.y, (py + 14) * CELDA);
    p.bolas = [];
    p.fx.anillo(...p.centroLu(), { r1: 24, col: P.escudo, vida: 0.5 });
    this.app.sonido.tocar('poder');
    this.capa = null;
    return true;
  }

  dibujar(g, W, H) {
    const app = this.app, p = this.partida;
    p.dibujar(g, W, H);
    this.hud(g, W, H);
    if (p.cartel && app.tr.hay(p.cartel.clave)) p.dibujarCartel(g, W, H, app.tr(p.cartel.clave));
    this.dibujarIntro(g, W, H);
    this.dibujarPista(g);
    if (this.esTorre) this.dibujarHito(g, W);
    if (this.capa) this.capa.dibujar(g, W, H);
    if (this.reinicio) {
      const r = this.reinicio, k = r.t < 0.28 ? 1 - r.t / 0.28 : (r.t - 0.28) / 0.34;
      const rad = Math.max(0, salidaAtras(clamp(k, 0, 1)) * Math.hypot(W, H));
      iris(g, W, H, r.hecho ? r.x2 : r.x, r.hecho ? r.y2 : r.y, rad);
    }
  }

  // En el primer nivel, hasta el primer movimiento: una flecha que late
  // arriba de Lu (el camino arranca para arriba).
  dibujarPista(g) {
    const p = this.partida;
    if (this.indice !== 0 || p.movimientos > 0 || p.estado !== 'jugando' || this.intro < 1.2) return;
    const [x, y] = p.centroLu(), sx = Math.round(x - p.camX), sy = Math.round(y - p.camY) - 12 - Math.round(Math.abs(Math.sin(this.t * 4)) * 5);
    g.fillStyle = P.blanco;
    for (let k = 0; k < 4; k++) g.fillRect(sx - k, sy + k, 1 + 2 * k, 1);
    g.fillRect(sx - 1, sy + 4, 3, 4);
  }

  // El cartelito del principio: el número del nivel y el nombre del mundo.
  dibujarIntro(g, W, H) {
    if (this.esTorre || this.intro > 1.6) return;
    const k = this.intro, entra = clamp(k / 0.35, 0, 1), sale = clamp((k - 1.2) / 0.35, 0, 1);
    const y = Math.round(H * 0.32 - (1 - salidaAtras(entra)) * 40 - sale * sale * 60);
    const def = this.def, c = MUNDOS_COLOR[def.mundo];
    const t1 = def.id, t2 = this.app.tr('mundo_' + def.mundo);
    const w = Math.max(anchoTexto(t1, 2), anchoTexto(t2)) + 16;
    panel(g, W / 2 - w / 2, y, w, 34, { borde: c.borde, fondo: P.fondo2 });
    texto(g, t1, W / 2, y + 3, P.blanco, { alinear: 'centro', esc: 2, sombra: P.negro });
    texto(g, t2, W / 2, y + 22, c.borde, { alinear: 'centro' });
  }

  hud(g, W, H) {
    const p = this.partida, tr = this.app.tr, c = MUNDOS_COLOR[p.nv.mundo] || MUNDOS_COLOR[0];
    g.fillStyle = 'rgba(5,4,11,0.82)'; g.fillRect(0, 0, W, 14);
    g.fillStyle = c.borde; g.fillRect(0, 14, W, 1);
    if (this.esTorre) {
      texto(g, tr('metros', p.alto > 0 ? p.alto : 0), W / 2, 3, P.blanco, { alinear: 'centro', sombra: P.negro });
      contador(g, S.ICONO.moneda, p.recogido.monedas, W - 4, 3, { alinear: 'der' });
      this.hudTorre(g, W, H);
    } else {
      texto(g, this.def.id, W / 2, 3, P.blanco, { alinear: 'centro', sombra: P.negro });
      for (let e = 0; e < 3; e++) g.drawImage(e < p.recogido.estrellas.length ? S.ESTRELLA[0] : S.ESTRELLA_VACIA, W - 26 + e * 8, 4);
      // la barra de chispas, debajo de la línea
      const k = p.nv.chispas ? p.recogido.chispas / p.nv.chispas : 0;
      g.fillStyle = P.chispa; g.fillRect(0, 14, Math.round(W * k), 1);
      if (p.recogido.monedas) contador(g, S.ICONO.moneda, p.recogido.monedas, W - 4, 17 - (this.golpeMoneda > 0 ? 1 : 0), { alinear: 'der', color: this.golpeMoneda > 0 ? P.monedaLuz : P.blanco });
      this.barraAltura(g, W, H);
    }
    // los poderes que están andando, con su barrita
    let y = 18;
    for (const k of ['escudo', 'iman', 'hielo', 'doble']) {
      const quedan = p.poder[k];
      if (quedan <= 0) continue;
      if (quedan < 1.5 && ((this.t * 8) | 0) % 2) { y += 12; continue; }
      g.drawImage(S.PODER[k], 3, y);
      g.fillStyle = P.negro; g.fillRect(15, y + 4, 22, 3);
      g.fillStyle = { escudo: P.escudo, iman: P.iman, hielo: P.hielo, doble: P.doble }[k];
      g.fillRect(16, y + 5, Math.round(20 * clamp(quedan / p.dur[k], 0, 1)), 1);
      y += 12;
    }
    this.botones.dibujar(g);
  }

  // Una barrita vertical al costado: dónde está Lu entre la entrada y la salida.
  barraAltura(g, W, H) {
    const p = this.partida, nv = p.nv;
    if (nv.alto * CELDA <= H) return;
    const xl = Math.round(-p.camX + nv.ancho * CELDA + 5), x = xl + 3 < W ? xl : W - 3;
    const y0 = 34, y1 = H - 10, largo = y1 - y0;
    g.fillStyle = P.grisOsc;
    for (let y = y0; y <= y1; y += 2) g.fillRect(x, y, 1, 1);
    const alto = nv.inicio.y - (nv.salida?.y ?? 0);
    const q = clamp((nv.inicio.y - p.posLu()[1]) / Math.max(1, alto), 0, 1);
    g.fillStyle = ((this.t * 4) | 0) % 2 ? P.portalA : P.portalB; g.fillRect(x - 1, y0 - 3, 3, 3);
    const ly = Math.round(y1 - q * largo);
    g.fillStyle = P.negro; g.fillRect(x - 2, ly - 2, 5, 5);
    g.fillStyle = S.PIELES[this.app.datos.piel]?.L || P.lu; g.fillRect(x - 1, ly - 1, 3, 3);
  }

  hudTorre(g, W, H) {
    const p = this.partida, tr = this.app.tr, d = this.app.datos;
    // la raya del récord, cruzando la torre a esa altura
    if (d.torre.record > 0) {
      const fila = p.nv.inicio.y - d.torre.record, y = Math.round(fila * CELDA - p.camY);
      if (y > 16 && y < H) {
        const x0 = Math.round(-p.camX), x1 = x0 + p.nv.ancho * CELDA;
        g.fillStyle = P.estrella;
        for (let x = x0; x < x1; x += 4) g.fillRect(x, y, 2, 1);
        texto(g, tr('record'), x1 - 2, y - 10, P.estrella, { alinear: 'der', borde: P.negro });
      }
    }
    // la lava, si está abajo de la pantalla: cuánto falta
    if (p.lava) {
      const yl = Math.round(p.lava.y - p.camY), lejos = Math.max(0, Math.round(p.lava.y / CELDA - p.posLu()[1]));
      if (yl > H) {
        const cerca = lejos < 10;
        if (!cerca || ((this.t * 6) | 0) % 2) {
          g.fillStyle = P.lava;
          const cx = Math.round(W / 2);
          for (let k = 0; k < 4; k++) g.fillRect(cx - 3 + k, H - 9 + k, 7 - 2 * k, 1);
          texto(g, tr('metros', lejos), cx + 8, H - 12, cerca ? P.rojo : P.lava, { borde: P.negro });
        }
      }
    }
  }
}

// ── pausa ──────────────────────────────────────────────────────────────────
class Pausa {
  constructor(juego) {
    this.juego = juego; this.app = juego.app; this.t = 0;
    this.botones = new Botonera(this.app.sonido);
    this.armar();
  }
  armar() {
    const { W, H, tr } = this.app, b = this.botones, j = this.juego;
    b.vaciar();
    const w = Math.min(104, W - 30), x = Math.round(W / 2 - w / 2), y0 = Math.round(H / 2 - 30);
    b.agregar({ texto: tr('seguir'), icono: S.ICONO.jugar, x, y: y0, w, h: 18, accion: () => { j.capa = null; } });
    b.agregar({ texto: tr('reintentar'), icono: S.ICONO.reintentar, x, y: y0 + 26, w, h: 18, retraso: 0.05, accion: () => { if (j.esTorre) j.cobrarTorre(); j.capa = null; j.muertes = 0; j.nueva(); } });
    b.agregar({ texto: tr(j.esTorre ? 'menu' : 'mapa'), icono: j.esTorre ? S.ICONO.casa : S.ICONO.mundo, x, y: y0 + 52, w, h: 18, retraso: 0.1, color: P.gris, accion: (bt) => {
      if (j.esTorre) { j.cobrarTorre(); this.app.ir(() => new Portada(this.app), bt); } else this.app.ir(() => new Mapa(this.app, { enfocar: j.indice }), bt);
    } });
    const a = this.app.datos.ajustes;
    const tog = (k, icono, xx) => b.agregar({ icono, x: xx, y: y0 + 80, w: 22, h: 14, retraso: 0.15, color: a[k] ? MUNDOS_COLOR[0].borde : P.grisOsc, accion: (bt) => {
      a[k] = !a[k]; bt.color = a[k] ? MUNDOS_COLOR[0].borde : P.grisOsc; this.app.sonido.aplicar(); this.app.guardar();
    } });
    tog('musica', S.ICONO.musica, Math.round(W / 2 - 25));
    tog('sonido', S.ICONO.parlante, Math.round(W / 2 + 3));
  }
  pasar(dt) {
    this.t += dt;
    const e = this.app.entrada;
    this.botones.pasar(dt);
    if (e.cola.some((ev) => ev.tipo === 'atras')) { this.juego.capa = null; return; }
    this.botones.manejar(e);
  }
  dibujar(g, W, H) {
    velo(g, W, H, 0.65);
    const k = clamp(this.t / 0.3, 0, 1), y = Math.round(H / 2 - 58 - (1 - salidaAtras(k)) * 30);
    texto(g, this.app.tr('pausa'), W / 2, y, P.blanco, { alinear: 'centro', esc: 2, sombra: P.negro });
    this.botones.dibujar(g);
  }
}

// ── el resultado de un nivel ───────────────────────────────────────────────
class Resultado {
  constructor(juego) {
    this.juego = juego; this.app = juego.app; this.t = 0;
    const p = juego.partida, d = this.app.datos, def = juego.def;
    this.n = p.recogido.estrellas.length;
    this.total = p.nv.chispas;
    this.juntadas = Math.min(p.recogido.chispas, this.total);
    this.pct = this.total ? Math.round((100 * this.juntadas) / this.total) : 100;
    this.limpio = this.juntadas >= this.total;
    this.premio = PREMIO.base + this.n * PREMIO.porEstrella + (this.limpio ? PREMIO.limpio : 0);
    this.monedas = p.recogido.monedas;
    this.antes = d.estrellas[def.id] || 0;
    const eraNuevoMundo = juego.indice + 1 < NIVELES.length && NIVELES[juego.indice + 1].mundo !== def.mundo && !d.hechos[def.id];
    d.estrellas[def.id] = Math.max(this.antes, this.n);
    d.chispas[def.id] = Math.max(d.chispas[def.id] || 0, this.pct);
    d.hechos[def.id] = true;
    d.monedas += this.monedas + this.premio;
    this.app.guardar();
    this.nuevoMundo = eraNuevoMundo;
    this.mostradas = 0; this.cuenta = 0;
    this.chispazos = [];
    this.botones = new Botonera(this.app.sonido);
    this.armar();
    this.app.sonido.tocar('victoria');
  }
  armar() {
    const { W, H, tr } = this.app, b = this.botones, j = this.juego;
    b.vaciar();
    const w = Math.min(112, W - 24), x = Math.round(W / 2 - w / 2), y0 = Math.round(H / 2 + 38);
    const hay = j.indice + 1 < NIVELES.length;
    if (hay) b.agregar({ texto: tr('siguiente'), icono: S.ICONO.jugar, x, y: y0, w, h: 20, retraso: 1.6, accion: (bt) => this.app.ir(() => new Juego(this.app, { indice: j.indice + 1 }), bt) });
    else b.agregar({ texto: tr('torre'), icono: S.ICONO.mundo, x, y: y0, w, h: 20, retraso: 1.6, color: MUNDOS_COLOR[3].borde, accion: (bt) => this.app.ir(() => new Juego(this.app, { torre: true }), bt) });
    const y1 = y0 + 26, mitad = Math.floor((w - 4) / 2);
    b.agregar({ texto: tr('reintentar'), icono: S.ICONO.reintentar, x, y: y1, w: mitad, h: 16, retraso: 1.7, color: P.gris, accion: () => { j.capa = null; j.muertes = 0; j.nueva(); } });
    b.agregar({ texto: tr('mapa'), icono: S.ICONO.mundo, x: x + w - mitad, y: y1, w: mitad, h: 16, retraso: 1.75, color: P.gris, accion: (bt) => this.app.ir(() => new Mapa(this.app, { enfocar: Math.min(NIVELES.length - 1, j.indice + 1) }), bt) });
  }
  pasar(dt) {
    this.t += dt;
    // las estrellas caen de a una, con su ruido y su chispazo
    const tocaMostrar = Math.min(this.n, Math.floor((this.t - 0.55) / 0.33) + 1);
    while (this.mostradas < tocaMostrar) {
      this.mostradas++;
      this.app.sonido.tocar('ganada', { n: this.mostradas });
      this.app.vibrar(15);
      const [x, y] = this.posEstrella(this.mostradas - 1);
      for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 50; this.chispazos.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, col: Math.random() < 0.5 ? P.estrella : P.blanco }); }
    }
    for (const c of this.chispazos) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.94; c.vy = c.vy * 0.94 + 60 * dt; }
    this.chispazos = this.chispazos.filter((c) => c.t < 0.7);
    // el contador de monedas sube con tic tic
    const meta = this.monedas + this.premio;
    if (this.t > 1.2 && this.cuenta < meta) {
      const antes = Math.floor(this.cuenta);
      this.cuenta = Math.min(meta, this.cuenta + dt * Math.max(20, meta * 1.5));
      if (Math.floor(this.cuenta) !== antes && Math.floor(this.cuenta) % 2 === 0) this.app.sonido.tocar('contar');
    }
    this.botones.pasar(dt);
    this.botones.manejar(this.app.entrada);
  }
  posEstrella(e) {
    const { W, H } = this.app;
    return [Math.round(W / 2 - 22 + e * 22), Math.round(H / 2 - 36 - (e === 1 ? 5 : 0))];
  }
  dibujar(g, W, H) {
    const tr = this.app.tr, def = this.juego.def, c = MUNDOS_COLOR[def.mundo];
    velo(g, W, H, 0.6);
    const k = clamp(this.t / 0.5, 0, 1), caida = Math.round((1 - rebote(k)) * -H * 0.6);
    const pw = Math.min(128, W - 10), px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - 80) + caida, ph = 168;
    panel(g, px, py, pw, ph, { borde: c.borde, fondo: P.fondo2 });
    texto(g, tr('superado'), W / 2, py + 6, P.estrella, { alinear: 'centro', esc: 1, sombra: P.negro });
    texto(g, def.id + ' · ' + tr('mundo_' + def.mundo), W / 2, py + 17, P.gris, { alinear: 'centro' });
    // tres lugares de estrella; las ganadas caen con rebote y quedan grandes
    for (let e = 0; e < 3; e++) {
      const [x, y0] = this.posEstrella(e), y = y0 + caida;
      if (e < this.mostradas) {
        const tt = this.t - 0.55 - e * 0.33, kk = clamp(tt / 0.3, 0, 1), esc = kk < 1 ? 3 + Math.round((1 - kk) * 2) : 3;
        const spr = S.ESTRELLA[((this.t * 3 + e) | 0) % 2];
        g.drawImage(spr, x - Math.round((spr.width * esc) / 2), y - Math.round((spr.height * esc) / 2) - Math.round((1 - rebote(kk)) * 16), spr.width * esc, spr.height * esc);
      } else g.drawImage(S.ESTRELLA_VACIA, x - 10, y - 10, 21, 21);
    }
    for (const ch of this.chispazos) { g.fillStyle = ch.col; g.fillRect(Math.round(ch.x), Math.round(ch.y + caida), 1, 1); }
    // los números
    const y = py + 64;
    texto(g, tr('chispas'), px + 8, y, P.gris);
    texto(g, `${this.juntadas}/${this.total}`, px + pw - 8, y, this.limpio ? P.chispa : P.blanco, { alinear: 'der' });
    texto(g, tr('monedas'), px + 8, y + 11, P.gris);
    contador(g, S.ICONO.moneda, '+' + this.monedas, px + pw - 8, y + 11, { alinear: 'der' });
    texto(g, this.limpio ? tr('limpio') : tr('premio'), px + 8, y + 22, this.limpio ? P.chispa : P.gris);
    texto(g, '+' + this.premio, px + pw - 8, y + 22, P.moneda, { alinear: 'der' });
    g.fillStyle = P.grisOsc; g.fillRect(px + 8, y + 33, pw - 16, 1);
    contador(g, S.ICONO.moneda, Math.floor(this.cuenta), W / 2, y + 37, { alinear: 'centro', color: P.moneda });
    if (this.nuevoMundo && this.t > 1.4 && ((this.t * 3) | 0) % 2) texto(g, tr('nuevoMundo'), W / 2, py - 12, P.chispa, { alinear: 'centro', borde: P.negro });
    if (this.juego.indice === NIVELES.length - 1 && this.t > 1.2) texto(g, tr('finJuego'), W / 2, py - 12, ((this.t * 4) | 0) % 2 ? P.estrella : P.blanco, { alinear: 'centro', borde: P.negro });
    this.botones.dibujar(g);
  }
}

// ── el final de una subida a la torre ──────────────────────────────────────
class FinTorre {
  constructor(juego) {
    this.juego = juego; this.app = juego.app; this.t = 0;
    const p = juego.partida, d = this.app.datos;
    this.alto = p.altoMax;
    this.recordAntes = d.torre.record;
    this.nuevo = this.alto > this.recordAntes;
    this.causa = p.fin?.causa || 'lava';
    juego.cobrarTorre();
    this.monedas = juego.cobrado;
    this.botones = new Botonera(this.app.sonido);
    this.armar();
    this.sonoRecord = !this.nuevo;
  }
  armar() {
    const { W, H, tr } = this.app, b = this.botones, j = this.juego, d = this.app.datos;
    b.vaciar();
    const w = Math.min(110, W - 24), x = Math.round(W / 2 - w / 2), y0 = Math.round(H / 2 + 22);
    let y = y0;
    if (!j.revivio) {
      b.agregar({ texto: tr('revivir'), icono: S.ICONO.moneda, sub: null, x, y, w, h: 20, retraso: 0.5, color: P.escudo, desactivado: d.monedas < REVIVIR, accion: () => j.revivir() });
      y += 28;
    }
    const mitad = Math.floor((w - 6) / 2);
    b.agregar({ texto: tr('reintentar'), icono: S.ICONO.reintentar, x, y, w: mitad, h: 16, retraso: 0.6, accion: () => { j.capa = null; j.nueva(); } });
    b.agregar({ texto: tr('menu'), icono: S.ICONO.casa, x: x + w - mitad, y, w: mitad, h: 16, retraso: 0.65, color: P.gris, accion: (bt) => this.app.ir(() => new Portada(this.app), bt) });
  }
  pasar(dt) {
    this.t += dt;
    if (!this.sonoRecord && this.t > 0.45) { this.sonoRecord = true; this.app.sonido.tocar('record'); }
    this.botones.pasar(dt);
    this.botones.manejar(this.app.entrada);
  }
  dibujar(g, W, H) {
    const tr = this.app.tr;
    velo(g, W, H, 0.62);
    const k = clamp(this.t / 0.45, 0, 1), caida = Math.round((1 - rebote(k)) * -H * 0.6);
    const pw = Math.min(128, W - 12), px = Math.round(W / 2 - pw / 2), py = Math.round(H / 2 - 78) + caida;
    panel(g, px, py, pw, 92, { borde: MUNDOS_COLOR[3].borde, fondo: P.fondo2 });
    texto(g, tr('finTorre'), W / 2, py + 6, P.blanco, { alinear: 'centro', sombra: P.negro });
    texto(g, tr('causa_' + this.causa), W / 2, py + 17, P.rojoLuz, { alinear: 'centro' });
    texto(g, tr('altura'), W / 2, py + 31, P.gris, { alinear: 'centro' });
    texto(g, tr('metros', this.alto), W / 2, py + 41, P.blanco, { alinear: 'centro', esc: 2, sombra: P.negro });
    if (this.nuevo) { if (((this.t * 4) | 0) % 2) texto(g, tr('nuevoRecord'), W / 2, py + 62, P.estrella, { alinear: 'centro' }); }
    else texto(g, tr('record') + ' ' + tr('metros', this.recordAntes), W / 2, py + 62, P.gris, { alinear: 'centro' });
    contador(g, S.ICONO.moneda, '+' + this.monedas, W / 2, py + 76, { alinear: 'centro', color: P.moneda });
    const rv = this.botones.botones.find((b) => b.texto === tr('revivir'));
    if (rv && rv.entrada() >= 1) texto(g, String(REVIVIR), rv.x + rv.w - 6, rv.y + 6, P.moneda, { alinear: 'der' });
    this.botones.dibujar(g);
  }
}

// ════════════════════════════════════════════════════════════════════════════
export class Tienda {
  constructor(app) {
    this.app = app; this.t = 0; this.nombre = 'tienda';
    this.fondo = new FondoMenu();
    this.botones = new Botonera(app.sonido);
    this.pestana = 'pieles';
    this.cambio = -1;
    this.brillos = [];
    this.aviso = null;
    app.sonido.musica('tienda');
  }

  armar() {
    const { W, H, tr } = this.app, b = this.botones, d = this.app.datos;
    b.vaciar();
    b.agregar(botonIcono(S.ICONO.volver, 4, 4, (bt) => this.app.ir(() => new Portada(this.app), bt), { id: 'volver' }));
    const mitad = Math.min(64, Math.floor((W - 16) / 2));
    const tab = (id, x) => b.agregar({ id: 'tab_' + id, texto: tr(id), x, y: 27, w: mitad, h: 13, color: this.pestana === id ? P.moneda : P.grisOsc, colorTexto: this.pestana === id ? P.blanco : P.gris, accion: () => { this.pestana = id; this.armar(); } });
    tab('pieles', Math.round(W / 2 - mitad - 2));
    tab('mejoras', Math.round(W / 2 + 2));
    const acostado = W > H * 1.25;
    if (this.pestana === 'pieles') {
      const cols = acostado ? 4 : 2, cw = acostado ? 62 : Math.min(62, Math.floor((W - 14) / 2)), ch = 46, gap = 4;
      const x0 = Math.round(W / 2 - (cols * cw + (cols - 1) * gap) / 2), y0 = 48;
      PIELES_TIENDA.forEach((pl, k) => {
        const x = x0 + (k % cols) * (cw + gap), y = y0 + Math.floor(k / cols) * (ch + gap);
        const tiene = d.pieles.includes(pl.id), puesta = d.piel === pl.id;
        b.agregar({ id: 'piel_' + pl.id, x, y, w: cw, h: ch, retraso: 0.03 * k, color: puesta ? P.chispa : tiene ? MUNDOS_COLOR[0].borde : P.grisOsc, piel: pl, accion: (bt) => this.elegirPiel(pl, bt) });
      });
    } else {
      const rw = Math.min(W - 12, 180), x = Math.round(W / 2 - rw / 2), rh = 36;
      MEJORAS.forEach((m, k) => {
        const nivel = d.mejoras[m], y = 48 + k * (rh + 4);
        const precio = nivel < NIVEL_MAX ? PRECIO_MEJORA[nivel] : null;
        b.agregar({ id: 'mejora_' + m, x, y, w: rw, h: rh, retraso: 0.04 * k, color: precio === null ? P.chispa : MUNDOS_COLOR[0].borde, mejora: m, accion: (bt) => this.comprarMejora(m, bt) });
      });
    }
    // los botones de la tienda se dibujan a mano (tienen mucho adentro)
    for (const bt of b.botones) if (bt.piel || bt.mejora) bt.dibujar = (g, foco) => this.tarjeta(g, bt, foco);
    this.cambio = this.app.cambio;
  }

  elegirPiel(pl, bt) {
    const d = this.app.datos;
    if (d.pieles.includes(pl.id)) { d.piel = pl.id; this.app.guardar(); this.armar(); return; }
    if (d.monedas < pl.precio) { bt.sacudir(); this.app.sonido.tocar('error'); this.aviso = { txt: this.app.tr('faltan'), t: 1.4 }; return; }
    d.monedas -= pl.precio; d.pieles.push(pl.id); d.piel = pl.id;
    this.app.guardar();
    this.app.sonido.tocar('comprar'); this.app.vibrar(20);
    this.celebrar(bt.x + bt.w / 2, bt.y + 18);
    this.armar();
  }

  comprarMejora(m, bt) {
    const d = this.app.datos, nivel = d.mejoras[m];
    if (nivel >= NIVEL_MAX) { bt.sacudir(); return; }
    const precio = PRECIO_MEJORA[nivel];
    if (d.monedas < precio) { bt.sacudir(); this.app.sonido.tocar('error'); this.aviso = { txt: this.app.tr('faltan'), t: 1.4 }; return; }
    d.monedas -= precio; d.mejoras[m]++;
    this.app.guardar();
    this.app.sonido.tocar('comprar'); this.app.vibrar(20);
    this.celebrar(bt.x + bt.w - 30, bt.y + bt.h / 2);
    this.armar();
  }

  celebrar(x, y) {
    for (let k = 0; k < 22; k++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 60; this.brillos.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, col: [P.moneda, P.chispa, P.blanco][k % 3] }); }
  }

  pasar(dt) {
    const app = this.app;
    if (this.cambio !== app.cambio) this.armar();
    this.t += dt;
    this.fondo.pasar(dt, app.entrada, app.W, app.H);
    this.botones.pasar(dt);
    if (app.entrada.cola.some((ev) => ev.tipo === 'atras')) { app.ir(() => new Portada(app)); return; }
    // nada se aprieta entre pestañas: el sonido del botón sale de la botonera
    this.botones.manejar(app.entrada);
    for (const b of this.brillos) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 120 * dt; b.vx *= 0.97; }
    this.brillos = this.brillos.filter((b) => b.t < 0.8);
    if (this.aviso && (this.aviso.t -= dt) <= 0) this.aviso = null;
  }

  tarjeta(g, bt, foco) {
    if (bt.entrada() <= 0) return;
    const d = this.app.datos, tr = this.app.tr;
    const k = bt.entrada(), oy = Math.round((1 - salidaAtras(k)) * 20), ox = bt.meneo > 0 ? Math.round(Math.sin(bt.meneo * 70) * 2) : 0;
    const x = bt.x + ox, y = bt.y + oy + (bt.apretado ? 1 : 0);
    panel(g, x, y, bt.w, bt.h, { borde: bt.color, fondo: bt.apretado ? '#241e46' : P.fondo2 });
    if (foco) { g.fillStyle = P.blanco; g.fillRect(x - 3, y + bt.h / 2 - 2, 2, 5); }
    if (bt.piel) {
      const pl = bt.piel, tiene = d.pieles.includes(pl.id), puesta = d.piel === pl.id;
      // Lu en grande (×2), aleteando; la puesta además flota
      const spr = S.lu(pl.id, 'quieto', ((this.t * (puesta ? 12 : 5) + x) | 0) % 2 ? 'arriba' : 'abajo', ((this.t * 0.5 + x * 0.01) % 3) > 2.9);
      const flota = puesta ? Math.round(Math.sin(this.t * 4) * 1.5) : 0;
      if (!tiene) g.globalAlpha = 0.55;
      g.drawImage(spr, Math.round(x + bt.w / 2 - spr.width), y + 4 + flota, spr.width * 2, spr.height * 2);
      g.globalAlpha = 1;
      texto(g, tr('piel_' + pl.id), x + bt.w / 2, y + 24, tiene ? P.blanco : P.gris, { alinear: 'centro' });
      if (puesta) texto(g, tr('puesta'), x + bt.w / 2, y + 34, P.chispa, { alinear: 'centro' });
      else if (tiene) texto(g, tr('usar'), x + bt.w / 2, y + 34, MUNDOS_COLOR[0].borde, { alinear: 'centro' });
      else contador(g, S.ICONO.moneda, pl.precio, x + bt.w / 2, y + 34, { alinear: 'centro', color: d.monedas >= pl.precio ? P.moneda : P.rojo });
    } else {
      const m = bt.mejora, nivel = d.mejoras[m];
      g.drawImage(S.PODER[m], x + 5, y + 6);
      texto(g, tr('poder_' + m), x + 19, y + 4, P.blanco, { sombra: P.negro });
      texto(g, tr('desc_' + m), x + 19, y + 14, P.gris);
      // puntitos del nivel y la duración que da
      for (let n = 0; n < NIVEL_MAX; n++) { g.fillStyle = n < nivel ? P.chispa : P.grisOsc; g.fillRect(x + 19 + n * 6, y + 27, 4, 3); }
      const dur = this.duracion(m, nivel);
      texto(g, tr('segundos', dur), x + 19 + NIVEL_MAX * 6 + 4, y + 24, P.gris);
      if (nivel >= NIVEL_MAX) texto(g, tr('maximo'), x + bt.w - 6, y + 24, P.chispa, { alinear: 'der' });
      else contador(g, S.ICONO.moneda, PRECIO_MEJORA[nivel], x + bt.w - 6, y + 24, { alinear: 'der', color: d.monedas >= PRECIO_MEJORA[nivel] ? P.moneda : P.rojo });
    }
  }

  duracion(m, nivel) {
    const tabla = { iman: 6 + 2 * nivel, hielo: 4 + 1.5 * nivel, doble: 8 + 3 * nivel, escudo: 6 + 2 * nivel };
    return String(tabla[m]).replace('.', ',');
  }

  dibujar(g, W, H) {
    const app = this.app, tr = app.tr;
    this.fondo.dibujar(g, W, H, 2);
    g.fillStyle = 'rgba(5,4,11,0.85)'; g.fillRect(0, 0, W, 21);
    g.fillStyle = P.moneda; g.fillRect(0, 21, W, 1);
    texto(g, tr('tienda'), W / 2, 6, P.blanco, { alinear: 'centro', sombra: P.negro });
    contador(g, S.ICONO.moneda, app.datos.monedas, W - 5, 6, { alinear: 'der', color: P.moneda });
    this.botones.dibujar(g);
    for (const b of this.brillos) { g.fillStyle = b.col; g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1); }
    if (this.aviso && ((this.aviso.t * 6) | 0) % 2) texto(g, this.aviso.txt, W / 2, H - 16, P.rojo, { alinear: 'centro', borde: P.negro });
  }
}

// ════════════════════════════════════════════════════════════════════════════
export class Ajustes {
  constructor(app) {
    this.app = app; this.t = 0; this.nombre = 'ajustes';
    this.fondo = new FondoMenu();
    this.botones = new Botonera(app.sonido);
    this.cambio = -1;
    this.borrarListo = 0;
    this.aviso = null;
  }

  armar() {
    const { W, tr } = this.app, b = this.botones, a = this.app.datos.ajustes;
    b.vaciar();
    b.agregar(botonIcono(S.ICONO.volver, 4, 4, (bt) => this.app.ir(() => new Portada(this.app), bt), { id: 'volver' }));
    const w = Math.min(116, W - 24), x = Math.round(W / 2 - w / 2);
    let y = 32;
    const toggle = (k, icono) => {
      b.agregar({ id: 'aj_' + k, texto: tr(k) + ': ' + tr(a[k] ? 'si' : 'no'), icono, x, y, w, h: 16, retraso: y * 0.002, color: a[k] ? MUNDOS_COLOR[0].borde : P.grisOsc, accion: () => {
        a[k] = !a[k]; this.app.sonido.aplicar(); this.app.guardar(); this.armar();
        if (k === 'vibrar' && a[k]) this.app.vibrar(30);
      } });
      y += 22;
    };
    toggle('musica', S.ICONO.musica);
    toggle('sonido', S.ICONO.parlante);
    toggle('vibrar', S.ICONO.vibra);
    y += 12;
    this.yIdioma = y;
    y += 11;
    const bw = Math.floor((w - 8) / 3);
    IDIOMAS.forEach((l, k) => {
      b.agregar({ id: 'idioma_' + l, texto: l.toUpperCase(), x: x + k * (bw + 4), y, w: bw, h: 16, retraso: 0.1 + k * 0.03, color: this.app.tr.actual() === l ? P.chispa : P.grisOsc, accion: () => {
        a.idioma = l; this.app.tr.poner(l); this.app.guardar(); this.armar();
      } });
    });
    y += 32;
    b.agregar({ id: 'borrar', texto: this.borrarListo > 0 ? tr('borrarSeguro') : tr('borrar'), x, y, w, h: 16, retraso: 0.2, color: P.rojo, accion: () => {
      if (this.borrarListo > 0) { this.app.borrarTodo(); this.aviso = { txt: tr('borrado'), t: 1.6 }; this.borrarListo = 0; }
      else this.borrarListo = 2.5;
      this.armar();
    } });
    this.yCreditos = y + 30;
    this.cambio = this.app.cambio;
  }

  pasar(dt) {
    const app = this.app;
    if (this.cambio !== app.cambio) this.armar();
    this.t += dt;
    this.fondo.pasar(dt, app.entrada, app.W, app.H);
    this.botones.pasar(dt);
    if (app.entrada.cola.some((ev) => ev.tipo === 'atras')) { app.ir(() => new Portada(app)); return; }
    this.botones.manejar(app.entrada);
    if (this.borrarListo > 0 && (this.borrarListo -= dt) <= 0) this.armar();
    if (this.aviso && (this.aviso.t -= dt) <= 0) this.aviso = null;
  }

  dibujar(g, W, H) {
    const tr = this.app.tr;
    this.fondo.dibujar(g, W, H, 1);
    g.fillStyle = 'rgba(5,4,11,0.85)'; g.fillRect(0, 0, W, 21);
    g.fillStyle = MUNDOS_COLOR[1].borde; g.fillRect(0, 21, W, 1);
    texto(g, tr('ajustes'), W / 2, 6, P.blanco, { alinear: 'centro', sombra: P.negro });
    texto(g, tr('idioma'), W / 2, this.yIdioma, P.gris, { alinear: 'centro' });
    this.botones.dibujar(g);
    // créditos: Lu volando de un lado al otro por debajo
    const lx = W / 2 + Math.sin(this.t * 0.8) * (W * 0.3);
    luVolando(g, this.app.datos.piel, lx, this.yCreditos + 22, this.t, { mira: Math.cos(this.t * 0.8) > 0 ? 'der' : 'izq' });
    const lineas = tr('creditos').split(' ');
    const mitad = Math.ceil(lineas.length / 2);
    texto(g, lineas.slice(0, mitad).join(' '), W / 2, this.yCreditos, P.gris, { alinear: 'centro' });
    texto(g, lineas.slice(mitad).join(' '), W / 2, this.yCreditos + 10, P.gris, { alinear: 'centro' });
    if (this.aviso) texto(g, this.aviso.txt, W / 2, H - 16, P.chispa, { alinear: 'centro', borde: P.negro });
  }
}
