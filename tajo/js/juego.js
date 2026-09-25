// La partida: mueve los bloques, lee los trazos, decide cada corte y lleva
// el puntaje.
//
// EL CORTE SE DECIDE EN LA PANTALLA, NO EN 3D. El jugador dibuja sobre el
// vidrio: lo justo es preguntar si la línea que dibujó pasa por el bloque
// TAL COMO SE VE en ese momento. Un choque en 3D contra la hoja del sable
// (que es sólo decorado) haría cortes que el dedo no dibujó.
//
// EL PUNTAJE PREMIA EL GESTO ENTERO, como el original: el impulso que traías
// antes de entrar (70), lo que seguiste después de salir (30) y qué tan cerca
// del centro pasaste (15). Un toquecito encima del bloque corta, pero vale
// poco. Por eso los puntos aparecen un instante DESPUÉS del corte: hay que
// esperar a ver cuánto siguió el dedo.

import * as THREE from "../vendor/three.module.min.js";
import { CAM } from "./camara.js";
import { VECTOR_DIR, DIR } from "./mapa.js";
import { Puntaje } from "./puntaje.js";
import { TAM } from "./bloques.js";
import { PISTA } from "./escenario.js";

export const COLUMNAS_X = [-0.9, -0.3, 0.3, 0.9];
export const FILAS_Y = [0.82, 1.36, 1.9];
const Y_PISTA = PISTA.tope + TAM * 0.5;
const VUELO = 0.42;                 // lo que tarda en llegar volando desde el fondo
const ANG_DIR = [Math.PI, 0, -Math.PI / 2, Math.PI / 2, -3 * Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 4, Math.PI / 4, 0];
const COLOR_NOTA = [new THREE.Color("#ffd66e"), new THREE.Color("#9b6bff")];
const EJE_Z = new THREE.Vector3(0, 0, 1);

const lim = (x, a, b) => Math.max(a, Math.min(b, x));
const salida = (k) => 1 - Math.pow(1 - k, 3);
function reboteSalida(k) { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }

/** ¿El segmento p0→p1 toca el círculo? Devuelve el parámetro de entrada (0..1) o -1. */
function entraCirculo(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const fx = x0 - cx, fy = y0 - cy;
  const a = dx * dx + dy * dy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;                 // ya arrancó adentro
  if (a < 1e-6) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  return -1;
}

export class Juego {
  constructor({ motor, bloques, particulas, sables, entrada, reproductor, hud, letra, luces, escenario }) {
    Object.assign(this, { motor, bloques, particulas, sables, entrada, reproductor, hud, letra, luces, escenario });
    this.camara = motor.camara;
    this.notas = []; this.bombas = []; this.trozos = [];
    this.pendientes = [];
    this.opciones = { libre: false, sinPerder: false, tolerancia: 60 };
    this.estado = "nada";          // nada | jugando | pausa | fin | perdio
    this.bot = false;              // para las pruebas: corta solo
    this.relojManual = null;       // para las pruebas: la hora la pone la prueba
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._q = new THREE.Quaternion();
    this._items = []; this._itemsBomba = [];
    this.alTerminar = null;
    this.estadisticas = null;
  }

  /** Prepara una partida. `mapa` sale de generarMapa; `cancion` del compositor
   *  (o de auto.js en el modo "tu canción"). */
  cargar(cancion, mapa, opciones = {}, desde = 0) {
    this.opciones = { libre: false, sinPerder: false, tolerancia: 60, ...opciones };
    this.cancion = cancion;
    this.mapa = mapa;
    const rng = (i) => ((Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1;
    this.notas = mapa.notas.map((n, i) => ({
      ...n, i, estado: 0, pos: new THREE.Vector3(), quat: new THREE.Quaternion(),
      sx: 0, sy: 0, r: 0, brillo: 0, visible: false, alfa: 1,
      giro: (rng(i) < 0.5 ? -1 : 1) * (0.6 + rng(i + 7) * 0.9),
    })).sort((a, b) => a.t - b.t);
    this.bombasMapa = mapa.bombas.map((b, i) => ({ ...b, i, estado: 0, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), sx: 0, sy: 0, r: 0, visible: false, alfa: 1 }));
    this.trozos = [];
    this.pendientes = [];
    this.puntaje = new Puntaje(this.notas.length, { sinPerder: this.opciones.sinPerder });
    this.iNota = 0;
    // Arrancar a mitad de canción (la portada): lo anterior ya pasó.
    while (this.iNota < this.notas.length && this.notas[this.iNota].t < desde + 0.5) { this.notas[this.iNota].estado = 2; this.iNota++; }
    for (const b of this.bombasMapa) if (b.t < desde + 0.5) b.estado = 2;
    const njs = mapa.njs;
    this.ventAntes = Math.max(0.2, 2.4 / njs);
    this.ventDespues = Math.max(0.12, 1.4 / njs);
    this.particulas.vaciar();
    this.letra.cargar(cancion.letra);
    this.luces.usarPaleta(cancion.paleta || "dragon");
    this.luces.cargar(cancion.luces || [], cancion.giros || []);
    this.tPrevio = -1;
    this.estadisticas = null;
  }

  empezar(desde = 0) {
    this.estado = "jugando";
    this.entrada.activa = true;
    if (this.relojManual === null) {
      if (this.cancion.buffer) this.reproductor.arrancarBuffer(this.cancion.buffer, desde, 0.6);
      else this.reproductor.arrancar(this.cancion, desde, 0.6);
    }
  }

  tiempo() { return this.relojManual !== null ? this.relojManual : this.reproductor.tiempo(); }

  pausar() {
    if (this.estado !== "jugando") return;
    this.estado = "pausa";
    this.reproductor.pausar();
    this.entrada.soltarTodo();
  }

  reanudar() {
    if (this.estado !== "pausa") return;
    this.estado = "jugando";
    this.reproductor.reanudar();
  }

  abandonar() {
    this.estado = "nada";
    this.reproductor.parar(0.2);
    this.letra.ocultar();
    this.bloques.dibujar([], []);
  }

  // ── la pose de un bloque en el tiempo t ──
  _pose(n, t, esBomba = false) {
    const { hjd, njs } = this.mapa;
    const a = n.t - t;
    const x = COLUMNAS_X[n.col];
    const yF = FILAS_Y[n.fila];
    const zSalto = CAM.zCorte - hjd * njs;
    let z, y, rot;
    const base = esBomba ? 0 : ANG_DIR[n.dir];
    if (a > hjd) {
      const s = lim((a - hjd) / VUELO, 0, 1);
      z = zSalto - 40 * s * s;
      y = Y_PISTA;
      rot = base + (n.giro || 0);
    } else {
      z = CAM.zCorte - a * njs;
      const k = lim((hjd - a) / (hjd * 0.5), 0, 1);
      y = Y_PISTA + (yF - Y_PISTA) * reboteSalida(k);
      rot = base + (n.giro || 0) * (1 - salida(k));
    }
    n.pos.set(x, y, z);
    if (esBomba) n.quat.setFromEuler(new THREE.Euler(t * 1.3 + n.i, t * 0.9, 0));
    else n.quat.setFromAxisAngle(EJE_Z, rot);
    // Proyección a la pantalla (en píxeles CSS).
    const W = this.motor.cssAncho, H = this.motor.cssAlto;
    this._v.copy(n.pos).project(this.camara);
    n.sx = (this._v.x + 1) * 0.5 * W; n.sy = (1 - this._v.y) * 0.5 * H;
    this._v2.set(TAM * 0.5, 0, 0).applyQuaternion(this.camara.quaternion).add(n.pos).project(this.camara);
    n.r = Math.hypot((this._v2.x - this._v.x) * 0.5 * W, (this._v2.y - this._v.y) * 0.5 * H);
  }

  // ── el cuadro ──
  cuadro(dt, ahora) {
    if (this.estado !== "jugando") {
      // En pausa se sigue dibujando lo que había, quieto.
      this._dibujarBloques();
      this.sables.actualizar(ahora, 0);
      return;
    }
    const t = this.tiempo();
    const { hjd } = this.mapa;
    // Aparecer.
    while (this.iNota < this.notas.length && this.notas[this.iNota].t - t < hjd + VUELO) {
      this.notas[this.iNota].estado = 1; this.notas[this.iNota].visible = true; this.iNota++;
    }
    for (const b of this.bombasMapa) if (b.estado === 0 && b.t - t < hjd + VUELO) { b.estado = 1; b.visible = true; }

    // Poses y ventanas.
    for (let i = Math.max(0, this.iNota - 60); i < this.iNota; i++) {
      const n = this.notas[i];
      if (!n.visible) continue;
      this._pose(n, t);
      const a = n.t - t;
      n.cortable = n.estado === 1 && a <= this.ventAntes && a >= -this.ventDespues;
      n.brillo = n.cortable ? 1 : 0;
      if (n.estado === 1 && a < -this.ventDespues) {
        n.estado = 3;                      // perdido
        this.puntaje.perdido();
        this.hud.flotante("FALLO", n.sx, n.sy, "fallo");
      }
      if (n.estado === 3) {
        n.alfa = lim(1 - (n.pos.z - (CAM.zCorte + 0.6)) / 1.6, 0, 1);
        if (n.alfa <= 0) n.visible = false;
      }
    }
    for (const b of this.bombasMapa) {
      if (!b.visible) continue;
      this._pose(b, t, true);
      if (b.pos.z > CAM.zCorte + 2) b.visible = false;
    }

    // Trazos.
    if (this.bot) this._bot(t, ahora);
    for (const tr of this.entrada.pendientes()) this._leerTrazo(tr, ahora);
    // Los cortes que esperan el "después" se cierran por tiempo.
    for (const p of this.pendientes) if (!p.cerrado && ahora - p.t0 > 0.26) this._cerrar(p);
    this.pendientes = this.pendientes.filter(p => !p.cerrado);

    // Trozos y chispas.
    for (const z of this.trozos) {
      z.edad += dt;
      z.vel.y -= 9.5 * dt;
      z.pos.addScaledVector(z.vel, dt);
      this._q.setFromAxisAngle(z.eje, z.giro * dt);
      z.quat.premultiply(this._q);
      z.alfa = lim(1 - (z.edad - 0.35) / 0.35, 0, 1);
    }
    this.trozos = this.trozos.filter(z => z.alfa > 0);
    this.particulas.actualizar(dt);
    this.sables.actualizar(ahora, dt);
    this._dibujarBloques();

    // Letra, luces, espectro.
    this.letra.actualizar(t);
    this.luces.actualizar(t, dt);
    const L = this.luces;
    this.bloques.ponerLuz(this._mezclaLuz(L, 0), this._mezclaLuz(L, 1));

    // Progreso y final.
    this.hud.actualizar(this.puntaje, lim(t / this.cancion.duracion, 0, 1));
    if (this.puntaje.perdio && this.estado === "jugando") this._terminar(true);
    else if (t > this.cancion.duracion - 0.5 && this.iNota >= this.notas.length && !this.pendientes.length) this._terminar(false);
    this.tPrevio = t;
  }

  _mezclaLuz(L, cual) {
    const c = this._luzTmp || (this._luzTmp = [new THREE.Color(), new THREE.Color()]);
    const g = cual === 0 ? 0 : 1;
    c[cual].copy(L.color[g]).multiplyScalar(Math.min(1.6, 0.35 + L.int[g] * 0.6));
    return c[cual];
  }

  _dibujarBloques() {
    const it = this._items; it.length = 0;
    for (let i = Math.max(0, this.iNota - 60); i < this.iNota; i++) {
      const n = this.notas[i];
      if (!n.visible || n.estado === 2) continue;
      it.push({ color: n.color, pos: n.pos, quat: n.quat, corte: null, flecha: n.dir !== DIR.PUNTO, brillo: n.brillo, alfa: n.alfa });
    }
    for (const z of this.trozos) it.push({ color: z.color, pos: z.pos, quat: z.quat, corte: z.corte, flecha: z.flecha, brillo: 0, alfa: z.alfa });
    const ib = this._itemsBomba; ib.length = 0;
    for (const b of this.bombasMapa) if (b.visible && b.estado !== 2) ib.push(b);
    this.bloques.dibujar(it, ib);
  }

  // ── lectura de un trazo ──
  _leerTrazo(tr, ahora) {
    const P = tr.puntos;
    const W = this.motor.cssAncho, H = this.motor.cssAlto;
    const vMin = 0.62 * Math.min(W, H);       // píxeles por segundo para que corte
    if (tr.nuevo) {
      tr.nuevo = false; tr.dir = null; tr.carrera = 0;
      const p = P[0];
      this.sables.mover(tr.sable, p.x, p.y, p.t);
      if (tr.leido === 0) tr.leido = 1;
    }
    for (let i = Math.max(1, tr.leido); i < P.length; i++) {
      const p0 = P[i - 1], p1 = P[i];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const dist = Math.hypot(dx, dy);
      const dts = Math.max(1e-3, p1.t - p0.t);
      const vel = dist / dts;
      if (dist > 0.3) {
        const ux = dx / dist, uy = dy / dist;
        if (tr.dir) {
          const cos = ux * tr.dir.x + uy * tr.dir.y;
          if (cos < -0.2) tr.carrera = 0;               // dio la vuelta: arranca otro golpe
          tr.dir.x = tr.dir.x * 0.45 + ux * 0.55; tr.dir.y = tr.dir.y * 0.45 + uy * 0.55;
          const l = Math.hypot(tr.dir.x, tr.dir.y) || 1; tr.dir.x /= l; tr.dir.y /= l;
        } else tr.dir = { x: ux, y: uy };
        tr.carrera += dist;
      }
      this.sables.mover(tr.sable, p1.x, p1.y, p1.t);
      // El "después" de los cortes que esperan.
      for (const pe of this.pendientes) {
        if (pe.trazo !== tr || pe.cerrado) continue;
        if (dist > 0.3) {
          const cos = (dx * pe.dir.x + dy * pe.dir.y) / dist;
          if (cos < 0.26) { this._cerrar(pe); continue; }      // dobló: se terminó el golpe
          const fuera = Math.hypot(p1.x - pe.cx, p1.y - pe.cy) > pe.R;
          if (fuera) pe.post += dist * cos;
        }
      }
      if (vel < vMin || !tr.dir) continue;
      // ¿Toca algún bloque?
      for (let k = Math.max(0, this.iNota - 60); k < this.iNota; k++) {
        const n = this.notas[k];
        if (!n.cortable || n.estado !== 1) continue;
        const R = n.r * 1.38;
        const s = entraCirculo(p0.x, p0.y, p1.x, p1.y, n.sx, n.sy, R);
        if (s < 0) continue;
        const ex = p0.x + dx * s, ey = p0.y + dy * s;
        const antes = Math.max(0, tr.carrera - dist * (1 - s));
        this._cortar(n, tr, ex, ey, antes, R, ahora);
      }
      for (const b of this.bombasMapa) {
        if (!b.visible || b.estado !== 1) continue;
        const a = b.t - this.tiempo();
        if (a > this.ventAntes || a < -this.ventDespues) continue;
        if (entraCirculo(p0.x, p0.y, p1.x, p1.y, b.sx, b.sy, b.r * 1.1) >= 0) this._explotar(b);
      }
    }
    tr.leido = P.length;
    if (!tr.vivo) {
      for (const pe of this.pendientes) if (pe.trazo === tr && !pe.cerrado) this._cerrar(pe);
      this.sables.soltar(tr.sable);
    }
  }

  _cortar(n, tr, ex, ey, antes, R, ahora) {
    const req = VECTOR_DIR[n.dir];
    const rx = req[0], ry = -req[1];                  // en pantalla y va para abajo
    const colorBien = this.opciones.libre || tr.sable === n.color;
    const cosTol = Math.cos(THREE.MathUtils.degToRad(this.opciones.tolerancia));
    const dirBien = n.dir === DIR.PUNTO || (tr.dir.x * rx + tr.dir.y * ry) >= cosTol;
    n.estado = 2;
    n.tCorte = this.tiempo();
    const d = Math.abs((n.sx - ex) * tr.dir.y - (n.sy - ey) * tr.dir.x);
    this._partir(n, tr.dir, ex, ey, colorBien && dirBien);
    if (colorBien && dirBien) {
      const precision = 15 * lim(1 - d / (R * 0.8), 0, 1);
      const pre = 70 * lim(antes / (R * 1.6), 0, 1);
      this.pendientes.push({ nota: n, trazo: tr, dir: { x: tr.dir.x, y: tr.dir.y }, pre, precision, post: 0, t0: ahora, R, cx: n.sx, cy: n.sy, cerrado: false });
      this.reproductor.sonidoCorte(0.9, n.color);
    } else {
      this.puntaje.malCorte();
      this.hud.flotante("✕", n.sx, n.sy, "malo");
      this.reproductor.sonidoMalCorte();
    }
  }

  _cerrar(pe) {
    pe.cerrado = true;
    const post = 30 * lim(pe.post / (pe.R * 1.0), 0, 1);
    const valor = Math.round(pe.pre + post + pe.precision);
    this.puntaje.acierto(valor);
    const clase = valor >= 110 ? "genial" : valor >= 100 ? "bien" : "flojo";
    this.hud.flotante(String(valor), pe.cx, pe.cy - pe.R * 0.8, clase);
  }

  /** Parte el bloque en dos por la línea que dibujó el dedo. */
  _partir(n, dir, ex, ey, bueno) {
    const c = this.camara;
    const W = this.motor.cssAncho, H = this.motor.cssAlto;
    const rayo = (sx, sy, out) => out.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1, 0.5).unproject(c).sub(c.position).normalize();
    const r1 = rayo(ex, ey, new THREE.Vector3());
    const r2 = rayo(ex + dir.x * 60, ey + dir.y * 60, new THREE.Vector3());
    const normal = new THREE.Vector3().crossVectors(r1, r2).normalize();
    // La dirección del corte en el mundo, a la altura del bloque.
    const dist = n.pos.distanceTo(c.position);
    const a3 = c.position.clone().addScaledVector(r1, dist);
    const b3 = c.position.clone().addScaledVector(r2, dist);
    const dir3 = b3.sub(a3).normalize();
    const inv = n.quat.clone().invert();
    const nl = normal.clone().applyQuaternion(inv);
    const w = normal.dot(this._v.subVectors(n.pos, c.position)) / TAM;
    const color = COLOR_NOTA[n.color];
    for (const s of [1, -1]) {
      const vel = new THREE.Vector3(0, 0.9, this.mapa.njs * 0.08)
        .addScaledVector(normal, s * 1.5).addScaledVector(dir3, 1.4);
      const eje = new THREE.Vector3().crossVectors(normal, dir3).normalize();
      if (eje.lengthSq() < 0.01) eje.set(1, 0, 0);
      this.trozos.push({
        color: n.color, pos: n.pos.clone(), quat: n.quat.clone(), vel, eje: eje.multiplyScalar(s),
        giro: 5 + Math.random() * 5, corte: [nl.x * s, nl.y * s, nl.z * s, w * s],
        flecha: n.dir !== DIR.PUNTO, edad: 0, alfa: 1,
      });
    }
    this.particulas.chispas(n.pos, dir3, color, bueno ? 26 : 12);
    if (bueno) this.particulas.tajo(n.pos, dir3, color);
  }

  _explotar(b) {
    b.estado = 2; b.visible = false;
    this.puntaje.bomba();
    this.particulas.explosion(b.pos);
    this.reproductor.sonidoBomba();
    this.hud.flotante("✕", b.sx, b.sy, "malo");
    this.motor.flash = 1.2; this.motor.flashColor.setRGB(1.2, 0.35, 0.2);
  }

  /** El bot de las pruebas: dibuja un trazo perfecto por cada bloque que llega. */
  _bot(t, ahora) {
    for (let k = Math.max(0, this.iNota - 60); k < this.iNota; k++) {
      const n = this.notas[k];
      if (n.estado !== 1 || n.bot || n.t - t > Math.min(0.08, this.ventAntes * 0.5)) continue;
      n.bot = true;
      const req = VECTOR_DIR[n.dir === DIR.PUNTO ? DIR.ABAJO : n.dir];
      const rx = req[0], ry = -req[1];
      const L = n.r * 12;
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const s = -0.55 + i / 12 * 1.1;
        pts.push({ x: n.sx + rx * L * s, y: n.sy + ry * L * s, t: ahora - 0.06 + i * 0.01 });
      }
      this.entrada.simular(n.color, pts);
    }
  }

  _terminar(perdio) {
    if (this.estado !== "jugando") return;
    this.estado = perdio ? "perdio" : "fin";
    const p = this.puntaje;
    this.estadisticas = {
      puntos: p.puntos, precision: p.cortes + p.perdidos + p.malos ? p.puntos / Math.max(1, p.maximoHasta) : 0,
      rango: p.rango(), comboMax: p.comboMax, cortes: p.cortes, perdidos: p.perdidos, malos: p.malos,
      bombas: p.bombas, total: this.notas.length, promedio: p.cortes ? p.sumaCortes / p.cortes : 0,
      perfectos: p.cortesPerfectos, perdio,
    };
    if (perdio) {
      this.reproductor.parar(0.8);
      this.motor.flash = 1.6; this.motor.flashColor.setRGB(1.3, 0.2, 0.25);
    }
    this.entrada.soltarTodo();
    if (this.alTerminar) this.alTerminar(this.estadisticas);
  }
}
