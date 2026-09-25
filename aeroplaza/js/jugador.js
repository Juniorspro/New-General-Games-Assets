/* ============================================================================
   aeroplaza/js/jugador.js — cómo se mueve el muñeco propio.
   Estados: en el piso (camina / corre), en el aire (salta / cae, con doble
   salto de burbuja), en el agua (vadea si es bajo, nada si es hondo, bucea con
   ↓), adentro de una burbuja grande (flota y se maneja) y montado (delfín).
   Los géiseres y las flores gigantes lo tiran para arriba (mundo.solidos con
   "rebote"). Todo en metros y segundos.
   Los movimientos de parkour (this.mov), con la tecla de bajar (C / Q / ⤓):
   - corriendo: se desliza (más rápido al empezar, bajito: pasa por debajo de
     las barras; si salta en el medio, sale con toda la velocidad);
   - caminando o quieto: rueda para adelante;
   - en el aire: rueda al caer. Si cae de muy alto corriendo, rueda solo.
   - Saltando contra un borde a la altura del pecho, lo trepa solo.
   - En el aire contra una pared, saltar rebota en la pared.
   ========================================================================== */
import * as THREE from 'three';
import { Meeple } from './meeple.js';
import { materialBurbuja } from './naturaleza.js';

const RADIO = 0.32, ALTO = 1.35;
const CAMINA = 3.4, CORRE = 7.2, SALTO = 8.6, NADA = 2.8;   // (correr un poco más: la isla ahora es grande)
const ACEL_PISO = 38, ACEL_AIRE = 9;
const RUEDA = 0.56, DESLIZA = 0.8, TREPA = 0.46, PARED = 0.36;   // lo que dura cada uno (igual que su clip)

export class Jugador {
  constructor(escena, apariencia, nombre) {
    this.m = new Meeple(apariencia, nombre);
    this.m.ponerNombre(nombre, true);
    escena.add(this.m.raiz);
    this.p = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.rumbo = 0;
    this.enPiso = false; this.saltos = 0; this.modo = 'pie';   // pie | agua | burbuja | montado
    this.estado = 'quieto';
    this.hp = 100; this.escala = 1; this.tEfecto = 0; this.efecto = null;
    this.bajoAgua = false; this.hondo = 0;
    this.tAire = 0; this.coyote = 0; this.bufferSalto = 0;
    this.burbuja = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 20), materialBurbuja(1));
    this.burbuja.visible = false; this.burbuja.renderOrder = 3;
    this.m.raiz.add(this.burbuja);
    this.eventos = [];   // lo que pasó este cuadro (para el sonido y la red): 'salto', 'aterriza', 'chapuzon', 'rebote'…
    this.montura = null;
  }
  ponerEn(p, rumbo = 0) { this.p.copy(p); this.v.set(0, 0, 0); this.rumbo = rumbo; this.modo = 'pie'; this.burbuja.visible = false; this.montura = null; this.mov = null; this.pared = null; this.ruedaAlCaer = false; this.sync(); }
  sync() { this.m.raiz.position.copy(this.p); this.m.raiz.rotation.y = this.rumbo; this.m.raiz.scale.setScalar(this.escala); }
  entrarBurbuja() { this.modo = 'burbuja'; this.tBurbuja = 40; this.burbuja.visible = true; this.v.y = 2; this.eventos.push('burbuja'); }
  salirBurbuja(reventar = true) { if (this.modo !== 'burbuja') return; this.modo = 'pie'; this.burbuja.visible = false; this.v.y = 3; if (reventar) this.eventos.push('pop'); }

  /* entrada: { x, z } del palito (ya girado por la cámara), corre, salta (recién apretado), sostiene, baja */
  actualizar(dt, E, mundo) {
    this.eventos.length = 0;
    const W = mundo;
    /* quiere: para dónde (unitario); cuanto: cuánto se inclina el palito (0 a 1) */
    const quiere = new THREE.Vector2(E.x, E.z); const cuanto = Math.min(1, quiere.length());
    if (cuanto > 0.001) quiere.normalize();
    if (E.salta) this.bufferSalto = 0.14; else this.bufferSalto -= dt;
    const agua = W.agua;
    const piso = W.suelo(this.p.x, this.p.z, this.p.y);
    const hondo = agua == null ? 0 : agua - piso.y;   // qué tan hondo es donde estoy
    this.hondo = hondo;
    const k = this.escala;

    if (this.modo === 'montado' && this.montura) return this.actualizarMontado(dt, E, W, quiere, cuanto);

    if (this.modo === 'burbuja') {
      this.tBurbuja -= dt;
      const vel = 4.2;
      this.v.x += (quiere.x * vel * cuanto - this.v.x) * Math.min(1, dt * 2.5);
      this.v.z += (quiere.y * vel * cuanto - this.v.z) * Math.min(1, dt * 2.5);
      const vy = (E.sostiene ? 3.5 : 0) - (E.baja ? 3.5 : 0) + 0.35;
      this.v.y += (vy - this.v.y) * Math.min(1, dt * 2);
      this.p.addScaledVector(this.v, dt);
      if (this.p.y < piso.y + 0.2) { this.p.y = piso.y + 0.2; this.v.y = Math.max(0, this.v.y); }
      if (this.p.y > 90) this.p.y = 90;
      W.empujar(this.p, 1.0, 2);
      if (cuanto > 0.1) this.rumbo = girarHacia(this.rumbo, Math.atan2(quiere.x, quiere.y), dt * 4);
      if (this.tBurbuja <= 0 || E.accion) this.salirBurbuja(true);
      this.estado = 'flota'; this.enPiso = false;
      this.burbuja.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.03);
      this.burbuja.position.y = 0.62;
      this.sync(); this.m.animar(dt, 'flota', 0);
      return;
    }

    /* ¿agua? se nada cuando el agua pasa la cintura */
    const nadando = agua != null && hondo > 0.95 * k && this.p.y < agua - 0.55 * k + 0.25;
    if (nadando && this.modo !== 'agua') { this.modo = 'agua'; if (this.v.y < -3) this.eventos.push('chapuzon'); }
    if (!nadando && this.modo === 'agua') this.modo = 'pie';

    if (this.modo === 'agua') {
      const flota = agua - 0.72 * k;
      const buceo = E.baja;
      const vel = (E.corre ? NADA * 1.5 : NADA) * (buceo ? 0.9 : 1);
      this.v.x += (quiere.x * vel * cuanto - this.v.x) * Math.min(1, dt * 3);
      this.v.z += (quiere.y * vel * cuanto - this.v.z) * Math.min(1, dt * 3);
      if (buceo) this.v.y += (-2.2 - this.v.y) * Math.min(1, dt * 3);
      else this.v.y += ((flota - this.p.y) * 5 - this.v.y) * Math.min(1, dt * 4);
      this.p.addScaledVector(this.v, dt);
      if (this.p.y < piso.y) this.p.y = piso.y;
      /* salir del agua de un salto */
      if (this.bufferSalto > 0 && this.p.y > flota - 0.4) { this.v.y = SALTO * 0.85; this.p.y = flota + 0.1; this.modo = 'pie'; this.bufferSalto = 0; this.eventos.push('salto'); }
      W.empujar(this.p, RADIO * k, ALTO * k);
      if (cuanto > 0.05) this.rumbo = girarHacia(this.rumbo, Math.atan2(quiere.x, quiere.y), dt * 7);
      this.bajoAgua = this.p.y + 1.1 * k < agua - 0.1;
      this.estado = cuanto > 0.1 || buceo ? 'nada' : 'flota';
      this.enPiso = false; this.saltos = 0;
      this.sync(); this.m.animar(dt, this.estado, cuanto * vel);
      if (cuanto > 0.1 && Math.random() < dt * 3) this.eventos.push('brazada');
      return;
    }
    this.bajoAgua = false;

    /* a pie */
    const vadea = agua != null && hondo > 0.15 && this.p.y < agua;
    const velMax = (E.corre ? CORRE : CAMINA) * (vadea ? 0.6 : 1) * (0.75 + 0.25 * k) * (this.efecto === 'liviano' ? 1.15 : 1);
    let acel = this.enPiso ? ACEL_PISO : ACEL_AIRE;
    const obj = new THREE.Vector2(quiere.x * velMax * cuanto, quiere.y * velMax * cuanto);
    /* bajar recién apretado: deslizarse (corriendo), rodar (caminando) o rodar al caer (en el aire) */
    const bajaYa = !!E.baja && !this._baja; this._baja = !!E.baja;
    const horiz0 = Math.hypot(this.v.x, this.v.z);
    if (bajaYa && !vadea && !this.mov) {
      if (this.enPiso) {
        const dir = horiz0 > 0.5 ? new THREE.Vector2(this.v.x, this.v.z).normalize() : new THREE.Vector2(Math.sin(this.rumbo), Math.cos(this.rumbo));
        if (horiz0 > CAMINA + 0.5) this.empezarMov('desliza', dir, Math.max(horiz0 * 1.12, 8.4), DESLIZA);
        else this.empezarMov('rueda', dir, 6.2, RUEDA);
      } else this.ruedaAlCaer = true;
    }
    if (this.mov) {
      const M = this.mov; M.t += dt;
      if (M.tipo === 'trepa') return this.seguirTrepa(dt);
      if (M.tipo === 'desliza' || M.tipo === 'rueda') {
        if (cuanto > 0.1) M.dir.lerp(quiere, Math.min(1, dt * (M.tipo === 'desliza' ? 1.2 : 2.5))).normalize();
        const vel = M.tipo === 'desliza' ? Math.max(2.4, M.v0 - 6 * M.t) : M.v0;
        obj.set(M.dir.x * vel, M.dir.y * vel); acel = 80;
      } else if (M.tipo === 'pared') acel = 2.5;   // (el empujón de la pared no se lo come el palito)
      if (M.t >= M.dur) this.terminarMov(W, k);
    }
    const dv = new THREE.Vector2(obj.x - this.v.x, obj.y - this.v.z);
    const paso = acel * dt;
    if (dv.length() > paso) dv.setLength(paso);
    this.v.x += dv.x; this.v.z += dv.y;
    const g = W.gravedad * (this.efecto === 'liviano' ? 0.45 : 1) * (W.sueno ? 0.3 : 1);
    this.v.y -= g * dt;
    if (!E.sostiene && this.v.y > 0 && !this.lanzado) this.v.y -= g * dt * 1.1;   // salto corto si se suelta
    /* saltar: del piso (con un poquito de tiempo de gracia) o el doble salto de burbuja */
    this.coyote = this.enPiso ? 0.12 : this.coyote - dt;
    if (this.bufferSalto > 0) {
      /* (saltar deslizándose sale con toda la velocidad: el truco del parkour) */
      if (this.coyote > 0) { this.v.y = SALTO * (0.9 + 0.1 * k); this.saltos = 1; this.coyote = 0; this.bufferSalto = 0; this.eventos.push('salto'); this.lanzado = false; if (this.mov && this.mov.tipo !== 'pared' && !this.hayTecho(W, k)) this.mov = null; }
      else if (this.pared && this.pared.t > 0 && !(this.mov && this.mov.tipo === 'pared')) {
        /* rebote en la pared: sale para el otro lado y para arriba (lo que iba a lo largo de la
           pared se conserva: así se avanza de pared en pared), y le queda el doble salto */
        const n = this.pared, vn = this.v.x * n.nx + this.v.z * n.nz, tx = (this.v.x - vn * n.nx) * 0.92, tz = (this.v.z - vn * n.nz) * 0.92;
        this.v.x = tx + n.nx * 6.8; this.v.z = tz + n.nz * 6.8; this.v.y = SALTO * 0.95;
        this.rumbo = Math.atan2(this.v.x, this.v.z); this.saltos = 1; this.bufferSalto = 0; this.lanzado = true; this.pared = null;
        this.mov = { tipo: 'pared', t: 0, dur: PARED }; this.eventos.push('pared');
      }
      else if (this.saltos < 2) { this.v.y = SALTO * 0.85; this.saltos = 2; this.bufferSalto = 0; this.eventos.push('doble'); this.lanzado = false; }
    }
    /* deslizándose o rodando se es bajito (pasa por debajo de las barras) */
    const bajo = this.mov && (this.mov.tipo === 'desliza' || this.mov.tipo === 'rueda'), alto = (bajo ? 0.72 : ALTO) * k;
    this.p.x += this.v.x * dt; this.p.z += this.v.z * dt;
    const x0 = this.p.x, z0 = this.p.z;
    W.empujar(this.p, RADIO * k, alto);
    /* tocar una pared en el aire (para el rebote): para dónde lo empujó es para dónde mira la pared */
    const ex = this.p.x - x0, ez = this.p.z - z0, e = Math.hypot(ex, ez);
    if (!this.enPiso && e > 0.002) this.pared = { nx: ex / e, nz: ez / e, t: 0.22 };
    else if (this.pared) { this.pared.t -= dt; if (this.pared.t <= 0 || this.enPiso) this.pared = null; }
    this.p.y += this.v.y * dt;
    const techo = W.techo(this.p.x, this.p.z, this.p.y, alto);
    if (this.p.y + alto > techo) { this.p.y = techo - alto; this.v.y = Math.min(0, this.v.y); }
    const s = W.suelo(this.p.x, this.p.z, this.p.y + Math.max(0, -this.v.y * dt));
    const antes = this.enPiso;
    if (this.p.y <= s.y + 0.02 && this.v.y <= 0.01) {
      const golpe = -this.v.y;
      this.p.y = s.y; this.v.y = 0;
      this.enPiso = true; this.saltos = 0; this.lanzado = false;
      if (s.s && s.s.rebote) { this.v.y = s.s.rebote; this.enPiso = false; this.saltos = 1; this.lanzado = true; this.eventos.push('rebote'); if (s.s.alRebotar) s.s.alRebotar(); }
      else if (!antes && golpe > 4) this.eventos.push('aterriza');
      /* rodar al caer: si lo pidió en el aire, o cae de muy alto corriendo */
      if (!antes && !this.mov && (this.ruedaAlCaer || golpe > 11.5) && Math.hypot(this.v.x, this.v.z) > 2.4) this.empezarMov('rueda', new THREE.Vector2(this.v.x, this.v.z).normalize(), Math.max(Math.hypot(this.v.x, this.v.z), 6.2), RUEDA);
      if (!antes) this.ruedaAlCaer = false;
      this.pisando = s.s;
    } else {
      /* bajando una rampa: pegarse al piso en vez de salir volando */
      if (antes && this.v.y <= 0 && this.p.y - s.y < 0.35) { this.p.y = s.y; this.v.y = 0; this.enPiso = true; }
      else this.enPiso = false;
    }
    /* los géiseres empujan desde abajo aunque no se los pise */
    for (const q of W.solidos) if (q.empuje && q.activo && W.dentro(q, this.p.x, this.p.z) && this.p.y < q.y1 + q.empujeAlto) { this.v.y = Math.max(this.v.y, q.empuje); this.enPiso = false; this.lanzado = true; if (!this._enGeiser) this.eventos.push('geiser'); this._enGeiser = q; }
    if (this._enGeiser && !W.dentro(this._enGeiser, this.p.x, this.p.z)) this._enGeiser = null;
    /* trepar: en el aire, yendo contra un borde a la altura del pecho */
    if (!this.enPiso && !this.mov && cuanto > 0.4 && this.v.y < 4.5) this.probarTrepa(W, k, quiere);
    if (this.mov && this.mov.tipo === 'trepa') { this.estado = 'trepa'; this.sync(); this.m.animar(dt, 'trepa', 0); return; }
    const horiz = Math.hypot(this.v.x, this.v.z);
    if (horiz > 0.3 && (cuanto > 0.05 || bajo)) this.rumbo = girarHacia(this.rumbo, Math.atan2(this.v.x, this.v.z), dt * 12);
    if (this.p.y < -30) this.eventos.push('caida');
    this.tAire = this.enPiso ? 0 : this.tAire + dt;
    this.estado = !this.enPiso ? (this.v.y > 0 ? 'salta' : 'cae') : horiz > CAMINA + 0.6 ? 'corre' : horiz > 0.25 ? 'camina' : 'quieto';
    if (this.estado === 'cae' && this.tAire < 0.12) this.estado = horiz > 0.25 ? 'camina' : 'quieto';
    if (this.mov) this.estado = this.mov.tipo;
    if (vadea && horiz > 1 && Math.random() < dt * 6) this.eventos.push('salpica');
    this.sync(); this.m.animar(dt, this.estado, horiz);
  }
  actualizarMontado(dt, E, W, quiere, cuanto) {
    const d = this.montura;
    d.manejar(dt, E, quiere, cuanto, W);
    this.p.copy(d.asiento()); this.rumbo = d.rumbo;
    this.estado = 'monta'; this.enPiso = false; this.bajoAgua = d.bajoAgua;
    this.sync(); this.m.animar(dt, d.tren ? 'sentado' : 'monta', 0);
    /* el monorriel solo deja bajar cuando para, y baja en la parada (no donde está el asiento) */
    if (E.accion) {
      if (d.puedeBajar && !d.puedeBajar()) this.eventos.push('noBaja');
      else { const sale = d.salida && d.salida(); this.bajarse(W); if (sale) { this.p.copy(sale); this.v.set(0, 0, 0); this.sync(); this.eventos.push('bajaTren'); } }
    }
  }
  /* ------------------------------------------------ los movimientos de parkour */
  empezarMov(tipo, dir, v0, dur) { this.mov = { tipo, t: 0, dur, dir: dir.clone(), v0 }; this.eventos.push(tipo); }
  hayTecho(W, k) { return W.techo(this.p.x, this.p.z, this.p.y, ALTO * k) < this.p.y + ALTO * k; }
  /* se termina, salvo el deslizarse debajo de algo: ahí sigue bajito hasta salir */
  terminarMov(W, k) {
    const M = this.mov;
    if (M.tipo === 'desliza' && this.hayTecho(W, k)) { M.dur += 0.1; M.v0 = Math.max(M.v0, 2.4 + 6 * M.t); return; }
    this.mov = null;
  }
  /* ¿hay un borde adelante, entre la rodilla y un poco más arriba de la cabeza, con lugar arriba? */
  probarTrepa(W, k, quiere) {
    const d = RADIO * k + 0.3, fx = this.p.x + quiere.x * d, fz = this.p.z + quiere.y * d;
    const tope = W.suelo(fx, fz, this.p.y + 2.0 * k - 0.45);
    const alto = tope.y - this.p.y;
    if (!tope.s || alto < 0.45 * k || alto > 2.0 * k || tope.s.rebote || (tope.s.t === 'c' && tope.s.r < 0.5)) return;
    const lx = this.p.x + quiere.x * (d + 0.4), lz = this.p.z + quiere.y * (d + 0.4);
    if (Math.abs(W.suelo(lx, lz, tope.y + 0.1).y - tope.y) > 0.3) return;   // arriba sigue habiendo piso (no es el canto de una pared)
    if (W.techo(lx, lz, tope.y, ALTO * k) < tope.y + ALTO * k) return;
    this.mov = { tipo: 'trepa', t: 0, dur: TREPA, p0: this.p.clone(), p1: new THREE.Vector3(lx, tope.y, lz) };
    this.v.set(0, 0, 0); this.rumbo = Math.atan2(quiere.x, quiere.y); this.eventos.push('trepa');
  }
  /* trepar va solo: primero sube (agarrado), después pasa arriba */
  seguirTrepa(dt) {
    const M = this.mov, u = Math.min(1, M.t / M.dur), up = Math.min(1, u / 0.6), fw = Math.max(0, (u - 0.45) / 0.55), e = 1 - (1 - up) * (1 - up);
    this.p.set(M.p0.x + (M.p1.x - M.p0.x) * fw, M.p0.y + (M.p1.y - M.p0.y) * e, M.p0.z + (M.p1.z - M.p0.z) * fw);
    this.v.set(0, 0, 0); this.enPiso = false;
    if (u >= 1) { this.mov = null; this.p.copy(M.p1); this.enPiso = true; this.saltos = 0; this.coyote = 0.12; }
    this.estado = 'trepa'; this.sync(); this.m.animar(dt, 'trepa', 0);
  }
  montar(d) { this.modo = 'montado'; this.montura = d; d.jinete = this; this.eventos.push('monta'); }
  bajarse() { if (!this.montura) return; this.montura.jinete = null; this.montura = null; this.modo = 'pie'; this.v.set(0, 4, 0); }
  /* comer una fruta: el efecto dura 45 s */
  ponerEfecto(ef) {
    this.efecto = ef; this.tEfecto = 45;
    this.escalaObj = ef === 'grande' ? 1.7 : ef === 'chico' ? 0.55 : 1;
  }
  paso(dt) {
    if (this.tEfecto > 0) { this.tEfecto -= dt; if (this.tEfecto <= 0) { this.efecto = null; this.escalaObj = 1; } }
    this.escala += ((this.escalaObj || 1) - this.escala) * Math.min(1, dt * 4);
  }
}
export function girarHacia(a, b, k) {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
