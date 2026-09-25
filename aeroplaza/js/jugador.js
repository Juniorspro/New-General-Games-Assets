/* ============================================================================
   aeroplaza/js/jugador.js — cómo se mueve el muñeco propio.
   Estados: en el piso (camina / corre), en el aire (salta / cae, con doble
   salto de burbuja), en el agua (vadea si es bajo, nada si es hondo, bucea con
   ↓), adentro de una burbuja grande (flota y se maneja) y montado (delfín).
   Los géiseres y las flores gigantes lo tiran para arriba (mundo.solidos con
   "rebote"). Todo en metros y segundos.
   Los movimientos de parkour (this.mov), con la tecla de bajar (C / Q / ⤓):
   - en el piso, SIEMPRE se desliza (corriendo, caminando o quieto: antes,
     sin el botón de correr prendido rodaba, y en el celu parecía que el
     deslizamiento no andaba): más rápido al empezar, bajito (pasa por
     debajo de las barras); si salta en el medio, sale con toda la velocidad;
   - en el aire: si lo aprieta justo antes de tocar el piso (o lo tiene
     apretado), se desliza al caer; si lo apretó antes, rueda al caer. Si cae
     de muy alto corriendo, rueda solo.
   - El reino puede cambiar la velocidad de correr (mundo.corre, el runner):
     ahí el deslizamiento no frena por debajo de esa velocidad.
   - Saltando contra un borde a la altura del pecho, lo trepa solo; si el borde
     está más alto (hasta 3,4 m), sube la pared corriendo y después trepa.
   - Corriendo contra algo a la altura de la cintura, lo salta apoyando una
     mano (una valla); si es una plataforma, se sube de un salto.
   - En el aire contra una pared, yendo a lo largo de ella, corre por la pared
     (hasta 1,1 s, casi sin caer); saltar rebota en la pared.
   (Los cuatro últimos salen del video de movimiento que mandó quien pide.)
   ========================================================================== */
import * as THREE from 'three';
import { Meeple } from './meeple.js';
import { materialBurbuja } from './naturaleza.js';

const RADIO = 0.32, ALTO = 1.35;
const CAMINA = 3.4, CORRE = 7.2, SALTO = 8.6, NADA = 2.8;   // (correr un poco más: la isla ahora es grande)
const ACEL_PISO = 38, ACEL_AIRE = 9;
const RUEDA = 0.56, DESLIZA = 0.8, TREPA = 0.46, PARED = 0.36, CORRE_PARED = 1.1;   // lo que dura cada uno (igual que su clip)

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
  ponerEn(p, rumbo = 0) { this.p.copy(p); this.v.set(0, 0, 0); this.rumbo = rumbo; this.modo = 'pie'; this.burbuja.visible = false; this.montura = null; this.mov = null; this.pared = null; this.bajaAire = null; this.coyote = 0; this.enPiso = false; this.sync(); }
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
    const velMax = (E.corre ? W.corre || CORRE : CAMINA) * (vadea ? 0.6 : 1) * (0.75 + 0.25 * k) * (this.efecto === 'liviano' ? 1.15 : 1);
    let acel = this.enPiso ? ACEL_PISO : W.acelAire || ACEL_AIRE;   // (el runner deja doblar más en el aire)
    const obj = new THREE.Vector2(quiere.x * velMax * cuanto, quiere.y * velMax * cuanto);
    /* bajar recién apretado: en el piso se desliza siempre; en el aire, se anota cuándo (al caer decide) */
    const bajaYa = !!E.baja && !this._baja; this._baja = !!E.baja;
    const horiz0 = Math.hypot(this.v.x, this.v.z);
    /* apretado y moviéndose, vuelve a deslizar solo (con un respiro de 0,25 s entre uno y otro) */
    this.tDesliza = (this.tDesliza || 0) - dt;
    const sigueBajo = E.baja && !this.mov && this.enPiso && horiz0 > 2.5 && this.tDesliza <= 0;
    if ((bajaYa || sigueBajo) && !vadea && (!this.mov || this.mov.tipo === 'rueda')) {
      if (this.enPiso || this.coyote > 0) this.deslizar(horiz0, quiere, cuanto);
      else this.bajaAire = 0;
    }
    if (this.bajaAire != null) this.bajaAire += dt;
    if (this.mov) {
      const M = this.mov; M.t += dt;
      if (M.tipo === 'trepa') return this.seguirTrepa(dt);
      if (M.tipo === 'valla') return this.seguirValla(dt, W);
      if (M.tipo === 'subePared') return this.seguirSube(dt, W, k);
      if (M.tipo === 'corrPared') {
        /* a lo largo de la pared, apretado contra ella (así sigue tocándola) */
        const n = this.pared || M.n; M.n = n;
        const vel = Math.max(M.v0, W.corre ? W.corre * 0.9 : 6.5);
        obj.set(M.dir.x * vel - n.nx * 1.2, M.dir.y * vel - n.nz * 1.2); acel = 60;
        if (!this.pared) M.sinPared = (M.sinPared || 0) + dt; else M.sinPared = 0;
        if (M.sinPared > 0.12 || this.enPiso) M.t = M.dur;
      }
      if (M.tipo === 'desliza' || M.tipo === 'rueda') {
        if (cuanto > 0.1) M.dir.lerp(quiere, Math.min(1, dt * (M.tipo === 'desliza' ? 1.2 : 2.5))).normalize();
        const vel = M.tipo === 'desliza' ? Math.max(W.corre || 2.4, M.v0 - 6 * M.t) : M.v0;
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
    if (this.mov && this.mov.tipo === 'corrPared') this.v.y = Math.max(this.v.y + g * dt * 0.8, -1.2);   // (corriendo por la pared casi no se cae)
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
    /* se avanza de a medio radio: deslizándose va a más de 10 m/s y, de un solo salto, se
       metía más de la mitad en una pared fina y el empujón lo sacaba del otro lado */
    const pasos = Math.min(8, Math.max(1, Math.ceil(Math.hypot(this.v.x, this.v.z) * dt / (RADIO * k * 0.5))));
    let ex = 0, ez = 0;
    for (let i = 0; i < pasos; i++) {
      this.p.x += this.v.x * dt / pasos; this.p.z += this.v.z * dt / pasos;
      const ax = this.p.x, az = this.p.z;
      W.empujar(this.p, RADIO * k, alto);
      ex += this.p.x - ax; ez += this.p.z - az;
    }
    /* tocar una pared en el aire (para el rebote): para dónde lo empujó es para dónde mira la pared */
    const e = Math.hypot(ex, ez);
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
      else if (!antes && golpe > 4) { this.eventos.push('aterriza'); if (golpe > 14) { this.golpe = golpe; this.eventos.push('impacto'); } }   // (caer fuerte: grietas y la cámara que tiembla)
      /* al caer: deslizarse si apretó bajar recién (o lo tiene apretado); rodar si lo apretó antes, o si cae de muy alto corriendo */
      if (!antes && (!this.mov || this.mov.tipo === 'pared')) {
        const h = Math.hypot(this.v.x, this.v.z), pidio = this.bajaAire != null;
        if (pidio && (this.bajaAire < 0.35 || E.baja)) this.deslizar(h, quiere, cuanto);
        else if ((pidio || golpe > 11.5) && h > 2.4) this.empezarMov('rueda', new THREE.Vector2(this.v.x, this.v.z).normalize(), Math.max(h, 6.2), RUEDA);
      }
      if (!antes) this.bajaAire = null;
      this.pisando = s.s;
    } else {
      /* bajando una rampa: pegarse al piso en vez de salir volando */
      if (antes && this.v.y <= 0 && this.p.y - s.y < 0.35) { this.p.y = s.y; this.v.y = 0; this.enPiso = true; }
      else this.enPiso = false;
    }
    /* los géiseres empujan desde abajo aunque no se los pise */
    for (const q of W.solidos) if (q.empuje && q.activo && W.dentro(q, this.p.x, this.p.z) && this.p.y < q.y1 + q.empujeAlto) { this.v.y = Math.max(this.v.y, q.empuje); this.enPiso = false; this.lanzado = true; if (!this._enGeiser) this.eventos.push('geiser'); this._enGeiser = q; }
    if (this._enGeiser && !W.dentro(this._enGeiser, this.p.x, this.p.z)) this._enGeiser = null;
    /* trepar: en el aire, yendo contra un borde a la altura del pecho (o más alto: sube la pared) */
    if (!this.enPiso && !this.mov && cuanto > 0.4) this.probarTrepa(W, k, quiere);
    /* correr por la pared: en el aire, tocándola y yendo a lo largo */
    if (!this.enPiso && (!this.mov || (this.mov.tipo === 'pared' && this.mov.t > 0.2)) && this.pared && cuanto > 0.3) this.probarCorrerPared(W, k);
    /* la valla: en el piso, corriendo contra algo a la altura de la cintura */
    if (this.enPiso && !this.mov && !W.sinValla && cuanto > 0.5 && horiz0 > 3.0) this.probarValla(W, k, quiere, horiz0);
    if (this.mov && (this.mov.tipo === 'valla' || this.mov.tipo === 'subePared')) { this.estado = this.mov.tipo; this.sync(); this.m.animar(dt, this.estado, 0); return; }
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
    this.sync(); this.m.animar(dt, d.pose || (d.tren ? 'sentado' : 'monta'), d.hamacaFase || 0);
    /* el monorriel solo deja bajar cuando para, y baja en la parada (no donde está el asiento) */
    if (E.accion) {
      if (d.puedeBajar && !d.puedeBajar()) this.eventos.push('noBaja');
      else { const sale = d.salida && d.salida(); this.bajarse(W); if (sale) { this.p.copy(sale); this.v.set(0, 0, 0); this.sync(); this.eventos.push('bajaTren'); } }
    }
  }
  /* ------------------------------------------------ los movimientos de parkour */
  /* deslizarse para donde va (o para donde apunta el palito, o para donde mira si está quieto) */
  deslizar(h, quiere, cuanto) {
    const dir = h > 0.5 ? new THREE.Vector2(this.v.x, this.v.z).normalize() : cuanto > 0.1 ? quiere.clone() : new THREE.Vector2(Math.sin(this.rumbo), Math.cos(this.rumbo));
    this.empezarMov('desliza', dir, Math.max(h * 1.12, h > CAMINA + 0.5 ? 8.4 : 7.6), DESLIZA);
    this.bajaAire = null;
  }
  empezarMov(tipo, dir, v0, dur) { this.mov = { tipo, t: 0, dur, dir: dir.clone(), v0 }; this.eventos.push(tipo); }
  hayTecho(W, k) { return W.techo(this.p.x, this.p.z, this.p.y, ALTO * k) < this.p.y + ALTO * k; }
  /* se termina, salvo el deslizarse debajo de algo: ahí sigue bajito hasta salir */
  terminarMov(W, k) {
    const M = this.mov;
    if (M.tipo === 'desliza' && this.hayTecho(W, k)) { M.dur += 0.1; M.v0 = Math.max(M.v0, 2.4 + 6 * M.t); return; }
    /* mientras se tenga apretado bajar, sigue deslizando (hasta 1,6 s) */
    if (M.tipo === 'desliza' && this._baja && M.t < 1.6) { M.dur += 0.1; return; }
    if (M.tipo === 'desliza') this.tDesliza = 0.25;
    this.mov = null;
  }
  /* ¿hay un borde adelante, entre la rodilla y un poco más arriba de la cabeza, con lugar arriba?
     Si está más alto (hasta 3,4 m) y viene recién saltado contra la pared, la sube corriendo */
  probarTrepa(W, k, quiere) {
    const d = RADIO * k + 0.3, fx = this.p.x + quiere.x * d, fz = this.p.z + quiere.y * d;
    let tope = W.suelo(fx, fz, this.p.y + 2.0 * k - 0.45), sube = false;
    if (!tope.s || tope.y - this.p.y < 0.45 * k) { const t2 = W.suelo(fx, fz, this.p.y + 3.4 * k - 0.45); if (t2.s && t2.y - this.p.y > 2.0 * k && this.tAire < 0.55 && this.v.y > -2) { tope = t2; sube = true; } }
    const alto = tope.y - this.p.y;
    if (!tope.s || alto < 0.45 * k || alto > (sube ? 3.4 : 2.0) * k || tope.s.rebote || (tope.s.t === 'c' && tope.s.r < 0.5)) return;
    if (!sube && this.v.y >= 4.5) return;   // (trepar, recién cuando el salto ya no sube fuerte; subir la pared, en cualquier momento)
    const lx = this.p.x + quiere.x * (d + 0.4), lz = this.p.z + quiere.y * (d + 0.4);
    if (Math.abs(W.suelo(lx, lz, tope.y + 0.1).y - tope.y) > 0.3) return;   // arriba sigue habiendo piso (no es el canto de una pared)
    if (W.techo(lx, lz, tope.y, ALTO * k) < tope.y + ALTO * k) return;
    if (sube) { this.mov = { tipo: 'subePared', t: 0, dur: 2, p1: new THREE.Vector3(lx, tope.y, lz), tope: tope.y, dir: quiere.clone() }; this.v.set(0, 0, 0); this.rumbo = Math.atan2(quiere.x, quiere.y); this.eventos.push('subePared'); return; }
    this.mov = { tipo: 'trepa', t: 0, dur: TREPA, p0: this.p.clone(), p1: new THREE.Vector3(lx, tope.y, lz) };
    this.v.set(0, 0, 0); this.rumbo = Math.atan2(quiere.x, quiere.y); this.eventos.push('trepa');
  }
  /* subir la pared corriendo: para arriba a 5,5 m/s hasta tener el borde al pecho, y ahí trepa */
  seguirSube(dt, W, k) {
    const M = this.mov;
    this.p.y += 5.5 * dt; this.v.set(0, 0, 0); this.enPiso = false;
    if (this.p.y >= M.tope - 1.35 * k || M.t > 0.9) { this.mov = { tipo: 'trepa', t: 0, dur: TREPA, p0: this.p.clone(), p1: M.p1 }; this.eventos.push('trepa'); }
    this.estado = 'subePared'; this.sync(); this.m.animar(dt, 'subePared', 0);
  }
  /* la valla: algo entre la cintura y el pecho, adelante; si del otro lado baja, se pasa por arriba; si no, se sube */
  probarValla(W, k, quiere, horiz) {
    const d = RADIO * k + 0.3, fx = this.p.x + quiere.x * d, fz = this.p.z + quiere.y * d;
    const tope = W.suelo(fx, fz, this.p.y + 1.3 * k), alto = tope.y - this.p.y;
    if (!tope.s || alto < 0.5 * k || alto > 1.25 * k || tope.s.rebote || tope.s.fantasma) return;
    let fin = null;
    for (let s = 0.3; s <= 2.4; s += 0.15) { const h = W.suelo(fx + quiere.x * s, fz + quiere.y * s, tope.y + 0.1).y; if (h < tope.y - 0.3) { fin = s; break; } }
    const dist = fin != null ? d + fin + 0.6 : d + 0.9;
    const x1 = this.p.x + quiere.x * dist, z1 = this.p.z + quiere.y * dist, y1 = fin != null ? W.suelo(x1, z1, tope.y).y : tope.y;
    /* arriba de la valla tiene que caber el cuerpo entero (si no, un marco de ventana es una valla y te saca por la ventana) */
    for (const u of [0, 0.5, 1]) { const qx = fx + (x1 - fx) * u, qz = fz + (z1 - fz) * u; if (W.techo(qx, qz, tope.y, ALTO * k + 0.4) < tope.y + ALTO * k + 0.3) return; }
    if (W.techo(x1, z1, y1, ALTO * k) < y1 + ALTO * k) return;
    this.mov = { tipo: 'valla', t: 0, dur: 0.3 + dist * 0.05, p0: this.p.clone(), p1: new THREE.Vector3(x1, y1, z1), cima: tope.y + 0.3 * k, dir: quiere.clone(), v0: Math.max(horiz, 5.5) };
    this.rumbo = Math.atan2(quiere.x, quiere.y); this.eventos.push('valla');
  }
  seguirValla(dt, W) {
    const M = this.mov, u = Math.min(1, M.t / M.dur);
    /* por arriba: sube hasta la cima a los 0,45 y baja al otro lado */
    const y = u < 0.45 ? M.p0.y + (M.cima - M.p0.y) * Math.sin(u / 0.45 * Math.PI / 2) : M.cima + (M.p1.y - M.cima) * Math.pow((u - 0.45) / 0.55, 2);
    this.p.set(M.p0.x + (M.p1.x - M.p0.x) * u, y, M.p0.z + (M.p1.z - M.p0.z) * u);
    this.v.set(M.dir.x * M.v0, 0, M.dir.y * M.v0); this.enPiso = false;
    if (u >= 1) { this.mov = null; this.p.copy(M.p1); this.enPiso = true; this.saltos = 0; this.coyote = 0.12; }
    this.estado = 'valla'; this.sync(); this.m.animar(dt, 'valla', 0);
  }
  /* correr por la pared: tocándola en el aire y yendo a lo largo (lo de ir contra ella es para el rebote) */
  probarCorrerPared(W, k) {
    const n = this.pared, vn = this.v.x * n.nx + this.v.z * n.nz, tx = this.v.x - vn * n.nx, tz = this.v.z - vn * n.nz, vt = Math.hypot(tx, tz);
    if (vt < 3.5 || this.p.y - W.suelo(this.p.x, this.p.z, this.p.y).y < 0.7 || (this._tCorrPared || 0) > performance.now() - 450) return;
    /* hay pared de verdad al costado (y alta): se prueba un punto adentro */
    const px = this.p.x - n.nx * (RADIO * k + 0.15), pz = this.p.z - n.nz * (RADIO * k + 0.15);
    if (!W.cerca(px, pz).some((s) => !s.fantasma && s.y1 > this.p.y + 1.2 && s.y0 < this.p.y + 0.3 && W.dentro(s, px, pz))) return;
    this._tCorrPared = performance.now();
    this.mov = { tipo: 'corrPared', t: 0, dur: CORRE_PARED, dir: new THREE.Vector2(tx / vt, tz / vt), v0: vt, n };
    /* de qué lado está la pared (para ladear el cuerpo): + a la derecha del que corre */
    this.m.ladoPared = Math.sign(n.nx * tz / vt - n.nz * tx / vt) || 1;
    this.v.y = Math.max(this.v.y, 2.2); this.eventos.push('corrPared');
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
