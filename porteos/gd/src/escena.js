'use strict';
// Lo que se ve de una partida: fondo con paralaje, objetos (con sus partes, colores, pulsos y
// efectos de entrada), piso, techo, línea y el jugador.

GD.ICONO = {
  cubo: ['player_01_2_001.png', 'player_01_001.png'],
  nave: ['ship_01_2_001.png', 'ship_01_001.png'],
  bola: ['player_ball_01_2_001.png', 'player_ball_01_001.png'],
  ovni: ['bird_01_2_001.png', 'bird_01_001.png', 'bird_01_3_001.png'],
  onda: ['dart_01_2_001.png', 'dart_01_001.png'],
  robot: ['robot_01_04_2_001.png', 'robot_01_04_001.png', 'robot_01_03_2_001.png', 'robot_01_03_001.png', 'robot_01_02_2_001.png', 'robot_01_02_001.png', 'robot_01_01_2_001.png', 'robot_01_01_001.png'],
  arana: ['spider_01_04_2_001.png', 'spider_01_04_001.png', 'spider_01_03_2_001.png', 'spider_01_03_001.png', 'spider_01_02_2_001.png', 'spider_01_02_001.png', 'spider_01_01_2_001.png', 'spider_01_01_001.png'],
  swing: ['swing_01_2_001.png', 'swing_01_001.png', 'swing_01_extra_001.png'],
};
const INVISIBLES = new Set([144, 145, 146, 147, 205, 206, 459, 673, 674, 740, 741, 742]);

GD.Escena = class {
  constructor(render, juego, texFondo, texPiso, texPiso2) {
    this.r = render;
    this.juego = juego;
    this.texFondo = texFondo; this.texPiso = texPiso; this.texPiso2 = texPiso2;
    this.sueloVis = juego.suelo; this.techoVis = juego.techo;
    this.particulas = [];
    this.espejoK = 0;
    this.rotulo = null;          // "Attempt N": { texto, x, y } en el mundo
    this.controles = [];         // puntos de control de la práctica
    this.voladoras = [];         // monedas agarradas, que suben y se desvanecen
    this.reloj = 0;
    this.linea = ['floorLine_001.png', 'floorLine_01_001.png', 'floorLine_02_001.png'][juego.nivel.ajustes.linea] || 'floorLine_001.png';
  }

  dibujar(dt) {
    const r = this.r, j = this.juego, J = j.jugador, col = j.colores;
    r.lienzo();
    j.camara(r.VW, dt);
    const sac = j.triggers.sacudida;
    this.camX = j.camX + (sac ? sac.dx : 0);
    this.camY = j.camY + (sac ? sac.dy : 0);
    this.espejoK += ((j.espejo ? 1 : 0) - this.espejoK) * Math.min(1, dt * 4);
    // el piso va hacia su lugar en 0,1 s, como el original (tweenBottomGround)
    const k = Math.min(1, dt * 12);
    this.sueloVis += (j.suelo - this.sueloVis) * k;
    if (j.techo === null) this.techoVis = null;
    else this.techoVis = this.techoVis === null ? j.techo : this.techoVis + (j.techo - this.techoVis) * k;

    const bg = col.calcular(1000);
    r.empezar(bg[0], bg[1], bg[2]);
    this.dibujarFondo(bg);
    this.reloj += dt;
    this.dibujarObjetos();
    this.dibujarExtras(dt);
    this.dibujarPisos();
    if (!J.muerto && !j.triggers.jugadorOculto) this.dibujarJugador(J);
    this.dibujarParticulas(dt);
    r.terminar();
  }

  aPantalla(x, y) {
    let sx = x - this.camX;
    if (this.espejoK > 0.001) sx = GD.mezclar(sx, this.r.VW - sx, this.espejoK);
    return [sx, y - this.camY];
  }

  dibujarFondo(bg) {
    const r = this.r;
    r.modo(false);
    // la textura (1024 px, 512 unidades) se mueve a un décimo de la cámara
    const tam = 512;
    r.mosaico(this.texFondo, 0, 0, r.VW, r.VH, tam, -this.camX * 0.1, -this.camY * 0.1 - 40, [bg[0], bg[1], bg[2], 1]);
  }

  dibujarPisos() {
    const r = this.r, col = this.juego.colores;
    const g1 = col.calcular(1001), g2 = col.calcular(1009), l = col.calcular(1002);
    const tam = 128;
    const piso = (y, arriba) => {
      const sy = y - this.camY;
      const y0 = arriba ? sy : -200, y1 = arriba ? r.VH + 200 : sy;
      r.modo(false);
      // el piso se repite con el mundo; arriba (techo) va dado vuelta
      const desdeY = arriba ? sy + tam : sy - tam;
      r.mosaico(this.texPiso, 0, y0, r.VW, y1, tam, -this.camX, desdeY, [g1[0], g1[1], g1[2], 1]);
      if (this.texPiso2 !== null) r.mosaico(this.texPiso2, 0, y0, r.VW, y1, tam, -this.camX, desdeY, [g2[0], g2[1], g2[2], 1]);
      r.modo(!!l.mezcla);
      const [lw] = r.tamCuadro(this.linea);
      const esc = lw ? Math.max(1, r.VW / lw) : 1;
      r.sprite(this.linea, r.VW / 2, sy, 1, 0, [l[0], l[1], l[2], l[3]], esc, arriba ? -1 : 1);
    };
    piso(this.sueloVis, false);
    if (this.techoVis !== null) piso(this.techoVis, true);
  }

  // ── objetos ──────────────────────────────────────────────────────────────
  dibujarObjetos() {
    const r = this.r, j = this.juego, col = j.colores, trig = j.triggers;
    const VW = r.VW;
    const x0 = this.camX - 120, x1 = this.camX + VW + 120;
    const lista = j.cerca(x0, x1);
    const partes = [];
    const efecto = trig.efectoEntrada;
    const jx = j.jugador.x - this.camX;
    for (const o of lista) {
      if (!o.partes.length || !trig.objetoActivo(o) || j.rotos.has(o) || j.monedas.has(o)) continue;
      let sx = o.x - this.camX;
      if (sx < -90 || sx > VW + 90) continue;
      let alfa = trig.alfaDeObjeto(o);
      if (alfa <= 0.001) continue;
      // fundido y efecto de entrada cerca de los bordes de la pantalla
      let dx = 0, dy = 0, esc = 1, giro = 0;
      if (!o.sinFundido) {
        const der = (VW - sx) / 90, izq = sx / 60;
        const kk = GD.limitar(Math.min(der, izq), 0, 1);
        if (kk < 1) {
          const lado = der < izq ? 1 : -1, falta = 1 - kk;
          switch (efecto) {
            case 'abajo': dy = -falta * 100; break;
            case 'arriba': dy = falta * 100; break;
            case 'izquierda': dx = -falta * 100 * lado; break;
            case 'derecha': dx = falta * 100 * lado; break;
            case 'crece': esc = kk; break;
            case 'achica': esc = 1 + falta; break;
            case 'gira': giro = falta * 180; break;
            case 'gira_inv': giro = -falta * 180; break;
            default: break;
          }
          alfa *= kk;
        }
      }
      if (INVISIBLES.has(o.id)) alfa *= GD.limitar((Math.abs(sx - jx) - 60) / 120, 0, 1);
      if (alfa <= 0.001) continue;
      this.partesDe(o, alfa, dx, dy, esc, giro, partes, col);
    }
    partes.sort((a, b) => a.capa - b.capa || a.z - b.z || a.i - b.i || a.pi - b.pi);
    for (const p of partes) {
      r.modo(p.mezcla);
      r.cuadro(p.tex, p.M, p.color, p.ancla);
    }
    r.modo(false);
  }

  partesDe(o, alfa, dx, dy, esc, giro, salida, col) {
    const [px, py] = this.aPantalla(o.x + dx, o.y + dy);
    const ang = -(o.rot + giro) * Math.PI / 180;
    const espejo = this.espejoK > 0.5 ? -1 : 1;
    const cs = Math.cos(ang), sn = Math.sin(ang), sx = o.sx * esc * espejo, sy = o.sy * esc;
    const base = [cs * sx, sn * sx, -sn * sy, cs * sy, px, py];
    const mats = [];
    const giraMoneda = o.tipo === 'moneda' ? this.cuadroMoneda(o) : null;
    for (let pi = 0; pi < o.partes.length; pi++) {
      const p = o.partes[pi];
      const P = p.padre >= 0 ? mats[p.padre] : base;
      let M = P;
      if (p.padre >= 0 || p.x || p.y || p.rot || p.sx !== 1 || p.sy !== 1) {
        const a = p.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const L = [c * p.sx, s * p.sx, -s * p.sy, c * p.sy, p.x, p.y];
        M = [P[0] * L[0] + P[2] * L[1], P[1] * L[0] + P[3] * L[1], P[0] * L[2] + P[2] * L[3], P[1] * L[2] + P[3] * L[3],
             P[0] * L[4] + P[2] * L[5] + P[4], P[1] * L[4] + P[3] * L[5] + P[5]];
      }
      mats.push(M);
      const tipo = p.color;
      let c, mezcla = false;
      if (tipo === 'Base' || tipo === 'Detail') {
        const canal = tipo === 'Base' ? o.cBase : o.cDetalle;
        c = canal ? col.calcular(canal) : [1, 1, 1, 1];
        mezcla = !!c.mezcla;
        const hsv = tipo === 'Base' ? o.hsvBase : o.hsvDetalle;
        if (hsv) { const m2 = c.mezcla; c = GD.aplicarHSV(c, hsv); c.mezcla = m2; }
        c = col.pulsosDeGrupo(o, c, tipo);
      } else if (tipo === 'Black') {
        const canal = o.cBase || o.cDetalle;
        const cc = canal ? col.calcular(canal) : null;
        mezcla = !!(cc && cc.mezcla);
        c = [0, 0, 0, 1];
      } else {
        c = col.pulsosDeGrupo(o, [1, 1, 1, 1], 'Base');
      }
      const a = c[3] * alfa * p.op;
      if (a <= 0.001) continue;
      const capa = o.capa - ((mezcla !== (o.capa % 2 === 0)) ? 1 : 0);
      salida.push({ tex: pi === 0 && giraMoneda ? giraMoneda : p.tex, M, ancla: p.ax || p.ay ? [p.ax, p.ay] : null, color: [c[0], c[1], c[2], a],
                    mezcla, capa, z: o.orden + p.z, i: o.i, pi });
    }
  }

  // La moneda gira con sus cuatro cuadros (secretCoin_01_001…004).
  cuadroMoneda(o) {
    const t = o.def.texture || '';
    if (!/_001\.png$/.test(t)) return null;
    const n = Math.floor(this.reloj * 10) % 4 + 1;
    const nombre = t.replace(/_001\.png$/, `_00${n}.png`);
    return this.r.cuadros[nombre] ? nombre : null;
  }

  moneda(o) {
    this.voladoras.push({ o, x: o.x, y: o.y, t: 0 });
  }

  // Vuelve a dibujar todo como corresponde después de un salto en el tiempo (reintento o punto
  // de control): el piso y el techo en su lugar, sin restos de la explosión.
  ajustar() {
    this.sueloVis = this.juego.suelo;
    this.techoVis = this.juego.techo;
    this.particulas = [];
    this.voladoras = [];
  }

  dibujarExtras(dt) {
    const r = this.r;
    r.modo(false);
    for (const c of this.controles) {
      const [sx, sy] = this.aPantalla(c.x, c.y);
      if (sx < -40 || sx > r.VW + 40) continue;
      r.sprite('checkpoint_01_001.png', sx, sy, 1, 0, [1, 1, 1, 1]);
    }
    for (const v of this.voladoras) {
      v.t += dt;
      const [sx, sy] = this.aPantalla(v.x, v.y + v.t * 120);
      const a = Math.max(0, 1 - v.t / 0.6);
      if (a > 0) r.sprite(this.cuadroMoneda(v.o) || v.o.def.texture, sx, sy, 1 + v.t, 0, [1, 1, 1, a]);
    }
    this.voladoras = this.voladoras.filter((v) => v.t < 0.6);
    if (this.rotulo) {
      const [sx, sy] = this.aPantalla(this.rotulo.x, this.rotulo.y);
      if (sx > -300 && sx < r.VW + 300) r.texto('bigFont', this.rotulo.texto, sx, sy, 0.75, [1, 1, 1, 1]);
    }
  }

  // ── jugador ──────────────────────────────────────────────────────────────
  dibujarJugador(J) {
    const r = this.r;
    const [x, y] = this.aPantalla(J.x, J.y);
    const k = J.tam;
    const inv = J.invertido ? -1 : 1;
    const c1 = [...GD.JUGADOR1, 1], c2 = [...GD.JUGADOR2, 1];
    r.modo(false);
    const capas = GD.ICONO[J.modo] || GD.ICONO.cubo;
    const pintar = (lista, px, py, esc, giro, ey) => {
      for (const n of lista) {
        const color = n.includes('_2_') ? c2 : n.includes('extra') || n.includes('_3_') ? [1, 1, 1, 1] : c1;
        r.sprite(n, px, py, esc, giro, color, 1, ey);
      }
    };
    if (J.modo === 'nave' || J.modo === 'ovni') {
      // el cubo va adentro, más chico, arriba de la nave
      const ang = J.rot * Math.PI / 180;
      const off = (J.modo === 'nave' ? 10 : 5) * k * inv;
      pintar(GD.ICONO.cubo, x + Math.sin(ang) * off, y + Math.cos(ang) * off, 0.55 * k, J.rot, inv);
      pintar(capas, x, y - (J.modo === 'nave' ? 5 : 6) * k * inv, k, J.rot, inv);
    } else {
      pintar(capas, x, y, k, J.rot, J.modo === 'cubo' ? 1 : inv);
    }
  }

  // ── partículas (la explosión al morir y el brillo de los impulsos) ──────
  explotar(x, y, color, cantidad = 40) {
    for (let i = 0; i < cantidad; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220;
      this.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.4 + Math.random() * 0.5,
                             tam: 0.12 + Math.random() * 0.18, color });
    }
    this.particulas.push({ x, y, vx: 0, vy: 0, t: 0, vida: 0.5, tam: 0, anillo: true, color });
  }

  dibujarParticulas(dt) {
    if (!this.particulas.length) return;
    const r = this.r;
    r.modo(true);
    for (const p of this.particulas) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 300 * dt;
      const k = 1 - p.t / p.vida;
      if (k <= 0) continue;
      const [sx, sy] = this.aPantalla(p.x, p.y);
      if (p.anillo) r.sprite('square_01_001.png', sx, sy, (1 - k) * 3 + 0.5, 45, [p.color[0], p.color[1], p.color[2], k * 0.7]);
      else r.sprite('square_01_001.png', sx, sy, p.tam * (0.5 + k), 0, [p.color[0], p.color[1], p.color[2], k]);
    }
    this.particulas = this.particulas.filter((p) => p.t < p.vida);
    r.modo(false);
  }
};
