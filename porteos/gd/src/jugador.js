'use strict';
// El jugador: la física de cada modo sigue PlayerObject::updateJump de la 2.2 (descompilado en
// camila314/gdp), con el 0,9 del tiempo vertical que usa el original (OpenGD, gdclone), y los
// impulsos de orbes y pads de OpenGD. Velocidades en unidades por cuadro de 60 Hz.

// PlayerObject::updateTimeMod: salto, gravedad y avance de cada velocidad.
GD.VELOCIDAD = {
  0.7: { salto: 10.620032, gravedad: 0.940199, avance: 5.980002 },
  0.9: { salto: 11.1800318, gravedad: 0.958199024, avance: 5.77000189 },
  1.1: { salto: 11.420032, gravedad: 0.957199, avance: 5.870002 },
  1.3: { salto: 11.230032, gravedad: 0.961199, avance: 6.000002 },
  1.6: { salto: 11.230032, gravedad: 0.961199, avance: 6.000002 },
};
const VOLADORES = new Set(['nave', 'ovni', 'onda', 'swing']);

GD.Jugador = class {
  constructor(segundo) {
    this.segundo = !!segundo;
    this.reiniciar({ modo: 'cubo', mini: false, velocidad: 0.9, gravedadInvertida: false });
  }

  reiniciar(aj, x = 0, y) {
    this.modo = aj.modo;
    this.mini = !!aj.mini;
    this.invertido = !!aj.gravedadInvertida;
    this.ponerVelocidad(aj.velocidad);
    this.x = x;
    this.y = y ?? (this.invertido ? 300 : 0) + (this.invertido ? -1 : 1) * this.medio();
    this.vy = 0;
    this.rot = 0;
    this.velRot = 0;
    this.enSuelo = !this.invertido;
    this.impulsado = false;     // m_maybeIsBoosted: subiendo por un salto o un impulso
    this.acelerando = false;    // m_isAccelerating: un pad o un orbe lo sacó del tope de velocidad
    this.sosteniendo = false;   // m_jumpBuffered
    this.toqueNuevo = false;    // m_stateRingJump: un toque que todavía no se usó
    this.tocoPad = false;
    this.robotExtra = 0;
    this.muerto = false;
    this.xAnterior = this.x; this.yAnterior = this.y;
    this.ultimoSueloY = this.y;
    this.dash = null;
    this.enRampa = null;
    this.rampaAntes = null;
    this.rampaPrev = null;
  }

  ponerVelocidad(v) {
    this.velocidad = v;
    const t = GD.VELOCIDAD[v] || GD.VELOCIDAD[0.9];
    this.salto = t.salto; this.gravedad = t.gravedad; this.avance = t.avance;
  }

  get volador() { return VOLADORES.has(this.modo); }
  get tam() { return this.mini ? 0.6 : 1; }
  medio() { return 15 * (this.mini ? 0.6 : 1); }
  signo() { return this.invertido ? -1 : 1; }
  cayendo() { return this.invertido ? this.vy > this.gravedad : this.vy < this.gravedad; }   // playerIsFalling (2.1)

  presionar() { this.sosteniendo = true; this.toqueNuevo = true; }
  soltar() { this.sosteniendo = false; this.toqueNuevo = false; if (this.dash) this.dash = null; }

  invertirGravedad(arriba) {
    if (this.invertido === arriba) return;
    this.invertido = arriba;
    this.vy /= 2;                // OpenGD: flipGravity
    this.enSuelo = false;
  }

  cambiarModo(modo) {
    if (this.modo === modo) return;
    this.modo = modo;
    this.rot = 0;
    this.velRot = 0;
    this.acelerando = false;
    this.impulsado = false;
    if (modo === 'robot' || modo === 'arana' || modo === 'cubo') this.vy = Math.max(-this.salto, Math.min(this.salto, this.vy));
  }

  // ── un paso de física (dt en cuadros de 60 Hz) ──────────────────────────
  paso(dt) {
    this.xAnterior = this.x; this.yAnterior = this.y;
    const dv = dt * 0.9;
    if (this.dash) {
      // orbe dash: va derecho mientras se sostenga
      this.vy = 0;
      this.y += this.dash.vy * dv;
    } else {
      this.saltar(dv);
      this.y += this.vy * dv;
    }
    this.x += this.avance * this.velocidad * dt;
  }

  saltar(dt) {
    const f = this.signo();
    // v16: 0,8 en mini, salvo los que vuelan, que usan 0,85 (updateJump de la 2.2)
    const tam = this.mini ? (this.volador ? 0.85 : 0.8) : 1;
    const gUsada = (this.modo === 'bola' || this.volador || this.modo === 'arana') ? 0.9582 : this.gravedad;
    let g = gUsada;

    if (this.volador) {
      let tope = 0.8;                                    // v42
      if (this.modo !== 'nave') {
        let div = tam;
        if (this.modo === 'swing') {
          if (this.toqueNuevo && this.sosteniendo) {
            this.toqueNuevo = false;
            const v = this.vy;
            this.invertirGravedad(!this.invertido);
            this.vy = v * 0.8;
          }
          this.vy -= g * dt * this.signo() * (this.mini ? 0.6 : 0.4);
          div = 1;
        } else if (this.modo === 'onda') {
          this.vy = this.avance * this.velocidad * f * (this.sosteniendo ? 1 : -1) * (this.mini ? 2 : 1);
        } else if (this.toqueNuevo && this.sosteniendo) {   // ovni: aleteo
          this.toqueNuevo = false;
          const v = f * (this.mini ? 8 : 7) * tam;
          if (this.invertido ? v < this.vy : v > this.vy) this.vy = v;
        }
        if (this.modo !== 'onda') {
          const k = this.cayendo() ? 0.8 : 1.2;
          this.vy -= g * dt * this.signo() * k * 0.5 / div;
        }
      } else {
        // nave
        let k;
        if (this.sosteniendo) k = (this.acelerando && (this.invertido ? this.vy <= 0 : this.vy >= 0)) ? 0.8 : -1;
        else k = this.cayendo() ? 0.8 : 1.2;
        let extra = this.cayendo() ? 0.5 : 0.4;
        if (this.acelerando) { if (k < 0) g = gUsada; }
        else if (!this.sosteniendo) extra = 0.4;
        this.vy -= k * g * dt * f * extra / tam;
      }
      // se sale del impulso cuando la velocidad vuelve a lo normal
      const sube = 8 / tam, baja = -6.4 / tam;
      const ys = this.vy * f;
      if ((ys >= 0 && ys < sube) || (ys <= 0 && ys > baja)) this.acelerando = false;
      if (!this.acelerando && this.modo !== 'onda') {
        const max = 8 / tam, min = -tope * 8 / tam;
        this.vy = this.invertido ? GD.limitar(this.vy, -max, -min) : GD.limitar(this.vy, min, max);
      }
      if (this.sosteniendo) this.enSuelo = false;
      return;
    }

    // cubo, bola, robot, araña
    const kGrav = (this.modo === 'bola' || this.modo === 'arana') ? 0.6 : this.modo === 'robot' ? 0.9 : 1;
    const puede = this.sosteniendo && (this.toqueNuevo || this.modo !== 'robot');
    if (this.enSuelo && puede) {
      if (this.alSaltar) this.alSaltar();
      if (this.modo === 'arana') { this.pidioArana = true; this.toqueNuevo = false; this.sosteniendo = false; return; }
      this.impulsado = true;
      this.enSuelo = false;
      this.toqueNuevo = false;
      this.tocoPad = false;
      this.robotExtra = 0;
      const salto = this.modo === 'robot' ? this.salto * 0.5 : this.salto;
      this.vy = f * salto * tam;
      // saltar desde una rampa que sube suma un cuarto de su velocidad (con tope de 1,4 veces)
      if (this.rampaAntes) this.vy = f * Math.min(salto * tam * 1.4, salto * tam + GD.velocidadRampa(this.rampaAntes, this) * 0.25);
      if (this.modo === 'bola') {
        this.invertirGravedad(!this.invertido);
        this.sosteniendo = false;
        this.vy *= 0.6;
      } else if (this.modo === 'cubo') this.girarSalto();
      return;
    }
    if (this.impulsado) {
      const d = f * g * dt * kGrav;
      if (this.modo === 'robot' && this.sosteniendo && !this.tocoPad && this.robotExtra < 1.5) {
        this.robotExtra += dt / 10;
        this.vy += d;
      }
      this.vy -= d;
      if (this.cayendo()) this.impulsado = false;
    } else {
      if (this.cayendo()) this.enSuelo = false;
      this.vy -= g * dt * f * kGrav;
      this.vy = this.invertido ? Math.min(this.vy, 15) : Math.max(this.vy, -15);
      if (this.modo === 'cubo' && !this.enSuelo && this.velRot === 0 && (this.invertido ? this.vy > 0.25 : this.vy < -0.25)) this.girarSalto();
    }
  }

  // ── impulsos ─────────────────────────────────────────────────────────────
  // Pad: 16 × fuerza (amarillo 1, rosa 0,65, rojo 1,25, azul 0,8 y da vuelta la gravedad).
  pad(sub) {
    const fuerza = { amarillo: 1, rosa: 0.65, rojo: 1.25, azul: 0.8 }[sub] || 1;
    this.vy = this.signo() * 16 * fuerza * (this.mini ? 0.8 : 1);
    if (this.modo === 'bola' || this.modo === 'arana') this.vy *= 0.6;
    this.impulsado = true; this.acelerando = true; this.enSuelo = false; this.tocoPad = true;
    if (this.modo === 'cubo') this.girarSalto(true);
    if (sub === 'azul') this.invertirGravedad(!this.invertido);
  }

  // Orbe (ringJump de OpenGD, con el salto de la velocidad actual como en la 2.2).
  orbe(sub, objeto) {
    let v = this.salto;
    const m = this.modo;
    if (sub === 'negro') {
      v = (m === 'ovni' ? -11.2 : m === 'nave' || m === 'onda' ? -14 : m === 'arana' ? -16.5 : -15) * this.signo();
      this.vy = v;
      if (m === 'bola') this.sosteniendo = false;
      this.impulsado = true; this.acelerando = true; this.enSuelo = false;
      return;
    }
    if (sub === 'dash_verde' || sub === 'dash_rosa') {
      if (sub === 'dash_rosa') this.invertirGravedad(!this.invertido);
      const ang = -(objeto ? objeto.rot : 0) * Math.PI / 180;
      this.dash = { vy: Math.tan(GD.limitar(ang, -1.3, 1.3)) * this.avance * this.velocidad };
      this.enSuelo = false;
      return;
    }
    if (sub === 'verde') this.invertirGravedad(!this.invertido);
    if (sub === 'rojo') v *= m === 'nave' ? (this.mini ? 1.4 : 1) : m === 'ovni' ? (this.mini ? 1.36 : 1.02) : (m === 'arana' || m === 'bola') ? 1.34 : m === 'robot' ? 1.28 : 1.38;
    else if (sub === 'rosa') v *= m === 'nave' ? 0.37 : m === 'ovni' ? 0.42 : m === 'bola' ? 0.77 : 0.72;
    else if (sub === 'azul') v *= 0.8;
    else if (sub === 'verde') { if (m === 'nave') v *= 0.7; }
    else if (m === 'robot') v *= 0.9;
    v *= this.signo() * (this.mini ? 0.8 : 1);
    this.vy = v;
    if (m === 'bola' || m === 'arana') { this.sosteniendo = false; this.vy *= 0.7; }
    this.impulsado = true; this.acelerando = true; this.enSuelo = false;
    if (m === 'cubo') this.girarSalto(true);
    if (sub === 'azul') this.invertirGravedad(!this.invertido);
  }

  // El cubo gira media vuelta por salto (y un poco más rápido con los impulsos, boostPlayer).
  girarSalto(impulso) {
    const duracion = 2 * this.salto / (this.gravedad * 0.9) / 60;
    this.velRot = (impulso ? 1.5 : 1) * 180 / duracion * this.signo();
  }

  // Al tocar suelo o techo (hitGround).
  tocarSuelo() {
    this.enSuelo = true;
    this.toco = true;              // se apoyó en este paso (la salida de una rampa lo mira)
    this.impulsado = false;
    this.acelerando = false;
    this.tocoPad = false;
    this.ultimoSueloY = this.y;
    if (this.modo === 'cubo') this.velRot = 0;
  }

  // Rotación de cada paso (dt en cuadros de 60 Hz): updateRotation / updateShipRotation.
  girar(dt) {
    const m = this.modo;
    if (m === 'bola') {
      const v = (this.mini ? 0.16 : 0.2) * ({ 0.7: 1.2405638, 1.1: 0.80424345, 1.3: 0.6657693, 1.6: 0.5409375 }[this.velocidad] || 1);
      this.rot += (120 * this.signo() / v) * dt / 60;
      return;
    }
    if (this.volador) {
      const dx = this.x - this.xAnterior, dy = this.y - this.yAnterior;
      if (dx * dx + dy * dy < dt * 1.2 * 0.01) return;
      let ang = -Math.atan2(dy, dx) * 180 / Math.PI;
      let k = 0.15;
      if (m === 'ovni') ang = GD.limitar(ang * 0.4, -12, 12);
      else if (m === 'onda') k = this.mini ? 0.4 : 0.25;
      this.rot = this.acercarAngulo(this.rot, ang, Math.min(1, dt * k));
      return;
    }
    if (m === 'robot' || m === 'arana') { this.rot = this.acercarAngulo(this.rot, 0, Math.min(1, dt * 0.5)); return; }
    if (this.enSuelo) {
      const destino = Math.round(this.rot / 90) * 90;
      this.rot = this.acercarAngulo(this.rot, destino, Math.min(1, dt * this.velocidad * 0.175 * 3));
      if (Math.abs(this.rot - destino) < 0.5) this.rot = destino;
    } else if (this.velRot) {
      this.rot += this.velRot * dt / 60;
    }
  }

  acercarAngulo(de, a, t) {
    let d = ((a - de) % 360 + 540) % 360 - 180;
    return de + d * t;
  }

  // Caja del jugador (centrada; `k` achica: 0,3 es la interior con la que mueren los sólidos).
  caja(k = 1) {
    const m = this.medio() * k;
    return { x0: this.x - m, x1: this.x + m, y0: this.y - m, y1: this.y + m };
  }
};
