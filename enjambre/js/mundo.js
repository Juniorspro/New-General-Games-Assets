// El mundo: bichos, tiros, gemas, cofres y el reloj. Sin dibujo y sin audio.
//
// POR QUE LA SIMULACION VIVE SOLA. Un juego de supervivencia se rompe por el
// balance, no por el dibujo: que el jefe sea imposible, que un arma no sirva
// nunca, que a los cinco minutos entren tantos bichos que el teléfono se
// arrastre. Nada de eso se ve mirando una captura. Acá un robot juega partidas
// enteras en milisegundos y las pruebas miden cuántas sobreviven, con qué arma
// y cuántos bichos llegó a haber a la vez.

import { azar, uno, entre } from "./azar.js";
import { BICHOS, ETAPAS, dureza, MAX_BICHOS, ELITE, probElite, RECICLAR } from "./bichos.js";
import { ARMAS, EVOLUCIONES, PASIVAS, xpParaNivel, ENVION } from "./armas.js";

/* LA REJILLA. Sin ella, separar a los bichos entre sí es comparar cada uno con
   cada uno: con doscientos son cuarenta mil comparaciones por cuadro y el
   teléfono se planta. Con celdas del tamaño del bicho más grande, cada uno
   mira sólo sus nueve celdas vecinas. */
class Rejilla {
  constructor(lado) { this.lado = lado; this.celdas = new Map(); }
  clave(x, y) { return ((x / this.lado) | 0) * 73856093 ^ ((y / this.lado) | 0) * 19349663; }
  limpiar() { this.celdas.clear(); }
  meter(o) {
    const k = this.clave(o.x, o.y);
    let c = this.celdas.get(k);
    if (!c) this.celdas.set(k, c = []);
    c.push(o);
  }
  *cerca(x, y) {
    const L = this.lado;
    for (let dy = -L; dy <= L; dy += L)
      for (let dx = -L; dx <= L; dx += L) {
        const c = this.celdas.get(this.clave(x + dx, y + dy));
        if (c) yield* c;
      }
  }
}

export class Mundo {
  constructor(semilla = 1, etapa = 1, opciones = {}) {
    this.r = azar(semilla);
    this.semilla = semilla;
    this.etapa = ETAPAS.find((e) => e.id === etapa) || ETAPAS[0];
    this.largo = this.etapa.largo;
    // El mundo es más grande que la pantalla para que huir signifique algo,
    // pero tiene borde: un mapa infinito se juega corriendo en línea recta.
    this.radioMapa = opciones.radioMapa || 900;
    this.jugador = {
      x: 0, y: 0, r: 14,
      vel: 140, vida: 100, vidaMax: 100, iman: 150, daño: 1, frecuencia: 1,
      rumbo: 0, invulnerable: 0,
      envion: 0, envionListo: 0, envionDir: { x: 1, y: 0 },
      armas: { chispa: 1 }, pasivas: {}, evolucionadas: {},
      nivel: 1, xp: 0, xpNecesaria: xpParaNivel(1),
    };
    this.bichos = [];
    this.tiros = [];      // los míos
    this.balas = [];      // los de ellos
    this.gemas = [];
    this.cofres = [];
    this.semillas = [];
    this.ondas = [];
    this.latigos = [];
    this.guadañas = [];
    this.golpes = [];
    this.rejilla = new Rejilla(48);
    this.t = 0;
    this.relojes = {};
    this.anguloOrbita = 0;
    this.muerto = false;
    this.gano = false;
    this.matados = 0;
    this.pendienteMejora = 0;
    this.proximaOleada = 0;
    this.jefesLargados = 0;
    this.jefesVivos = 0;
    this.picoBichos = 0;
  }

  // ── consultas ────────────────────────────────────────────────────────────
  nivelArma(n) { return this.jugador.armas[n] || 0; }
  evolucionada(n) { return !!this.jugador.evolucionadas[n]; }
  datosArma(n) {
    if (this.evolucionada(n)) return EVOLUCIONES[this.jugador.evolucionadas[n]].datos;
    return ARMAS[n].niveles[this.nivelArma(n) - 1];
  }
  terminada() { return this.muerto || this.gano; }
  maxArmas() { return 4; }

  /** ¿Qué armas están listas para evolucionar ahora mismo? */
  evolucionesListas() {
    const fuera = [];
    for (const [n, a] of Object.entries(ARMAS)) {
      if (!a.evoluciona || this.evolucionada(n)) continue;
      if (this.nivelArma(n) < a.niveles.length) continue;
      if ((this.jugador.pasivas[a.evoluciona.con] || 0) < PASIVAS[a.evoluciona.con].max) continue;
      fuera.push({ clase: "evolucion", nombre: n, en: a.evoluciona.en, nivel: 0, nueva: true });
    }
    return fuera;
  }

  /** Qué se ofrece al subir de nivel.
   *
   *  UNA EVOLUCION LISTA SE OFRECE SOLA Y PRIMERO. Mezclada entre dos mejoras
   *  comunes se elige sin entender que era la jugada de la partida, y esa es
   *  justo la decisión que el juego quiere que tomes mirando.
   *  Y NUNCA SE OFRECE ALGO YA AGOTADO: en el nivel veinte, tres casillas
   *  repetidas al máximo convierten la subida de nivel en un trámite. */
  ofertas() {
    const evo = this.evolucionesListas();
    if (evo.length) return [evo[0]];

    const bolsa = [];
    for (const n of Object.keys(ARMAS)) {
      if (this.evolucionada(n)) continue;
      const lv = this.nivelArma(n);
      if (lv >= ARMAS[n].niveles.length) continue;
      if (lv === 0 && Object.keys(this.jugador.armas).length >= this.maxArmas()) continue;
      bolsa.push({ clase: "arma", nombre: n, nivel: lv + 1, nueva: lv === 0 });
    }
    for (const n of Object.keys(PASIVAS)) {
      const lv = this.jugador.pasivas[n] || 0;
      if (lv >= PASIVAS[n].max) continue;
      bolsa.push({ clase: "pasiva", nombre: n, nivel: lv + 1, nueva: lv === 0 });
    }
    const fuera = [];
    while (fuera.length < 3 && bolsa.length) {
      const i = Math.floor(this.r() * bolsa.length) % bolsa.length;
      fuera.push(bolsa.splice(i, 1)[0]);
    }
    // Si ya no queda NADA que subir, se ofrece vida: una mejora vacía sería
    // una pantalla que no se puede cerrar.
    if (!fuera.length) fuera.push({ clase: "curar", nombre: "curar", nivel: 0, nueva: false });
    return fuera;
  }

  elegir(oferta) {
    if (!oferta) return;
    const p = this.jugador;
    if (oferta.clase === "arma") p.armas[oferta.nombre] = oferta.nivel;
    else if (oferta.clase === "evolucion") {
      p.evolucionadas[oferta.nombre] = oferta.en;
      this.golpes.push({ que: "evolucion", x: p.x, y: p.y });
    } else if (oferta.clase === "curar") p.vida = Math.min(p.vidaMax, p.vida + 40);
    else {
      p.pasivas[oferta.nombre] = oferta.nivel;
      PASIVAS[oferta.nombre].aplicar(p, oferta.nivel);
      if (oferta.nombre === "coraza") p.vida = Math.min(p.vidaMax, p.vida + 26);
    }
    this.pendienteMejora = Math.max(0, this.pendienteMejora - 1);
  }

  /** El envión. Devuelve true si salió. */
  lanzarEnvion() {
    const p = this.jugador;
    if (p.envionListo > 0 || p.envion > 0) return false;
    const m = Math.hypot(p.envionDir.x, p.envionDir.y) || 1;
    p.envion = ENVION.dura;
    p.envionListo = ENVION.espera;
    p.invulnerable = Math.max(p.invulnerable, ENVION.gracia);
    p.envionDir = { x: p.envionDir.x / m, y: p.envionDir.y / m };
    this.golpes.push({ que: "envion", x: p.x, y: p.y });
    return true;
  }

  // ── el paso ──────────────────────────────────────────────────────────────
  avanzar(dt, mov) {
    if (this.terminada() || this.pendienteMejora > 0) return;
    this.t += dt;
    this.golpes.length = 0;

    this.moverJugador(dt, mov);
    this.largarBichos();
    this.rearmarRejilla();
    this.moverBichos(dt);
    this.moverBalas(dt);
    this.dispararArmas(dt);
    this.moverTiros(dt);
    this.moverOrbita(dt);
    this.moverOndas(dt);
    this.moverSemillas(dt);
    this.moverLatigos(dt);
    this.moverGuadañas(dt);
    this.recogerCosas(dt);

    if (this.jugador.vida <= 0) { this.jugador.vida = 0; this.muerto = true; }
    /* SE GANA POR AGUANTAR, no por matar al jefe.
       La primera versión pedía además que no quedara ningún jefe vivo, y eso
       hace la etapa imposible de terminar: medido, el robot sobrevivía 318
       segundos de una etapa de 300 y perdía igual, porque nunca llegaba a
       bajar los 1500 puntos de vida del jefe mientras huía. El jefe es una
       amenaza a esquivar, no un peaje. */
    if (this.t >= this.largo && !this.muerto) this.gano = true;
    if (this.bichos.length > this.picoBichos) this.picoBichos = this.bichos.length;
  }

  moverJugador(dt, mov) {
    const p = this.jugador;
    if (p.envionListo > 0) p.envionListo -= dt;
    const m = Math.hypot(mov.x, mov.y);
    if (m > 0.02) {
      p.rumbo = Math.atan2(mov.y, mov.x);
      p.envionDir = { x: mov.x / m, y: mov.y / m };
    }
    if (p.envion > 0) {
      // durante el envión no se dirige: es un compromiso, no un movimiento
      p.envion -= dt;
      const v = ENVION.distancia / ENVION.dura;
      p.x += p.envionDir.x * v * dt;
      p.y += p.envionDir.y * v * dt;
    } else if (m > 0.02) {
      const k = Math.min(1, m);
      p.x += (mov.x / m) * p.vel * k * dt;
      p.y += (mov.y / m) * p.vel * k * dt;
    }
    // el borde frena, no rebota: rebotar con treinta bichos encima se siente
    // como que el juego te empujó a la muerte
    const d = Math.hypot(p.x, p.y);
    if (d > this.radioMapa) { p.x = (p.x / d) * this.radioMapa; p.y = (p.y / d) * this.radioMapa; }
    if (p.invulnerable > 0) p.invulnerable -= dt;
  }

  oleadaActual() {
    let cual = this.etapa.oleadas[0];
    for (const o of this.etapa.oleadas) if (this.t >= o.desde && o.cada) cual = o;
    return cual;
  }

  largarBichos() {
    // los jefes salen una sola vez cada uno, en su momento
    const debidos = this.etapa.oleadas.filter((q) => q.jefe && q.desde <= this.t);
    if (this.jefesLargados < debidos.length) {
      const q = debidos[this.jefesLargados];
      this.jefesLargados++;
      this.nacer(q.jefe, 1);
      this.jefesVivos++;
      this.golpes.push({ que: "jefe", x: this.jugador.x, y: this.jugador.y });
      return;
    }
    const o = this.oleadaActual();
    if (!o || !o.cada || this.t < o.desde) return;
    if (this.t < this.proximaOleada) return;
    this.proximaOleada = this.t + o.cada;
    // el techo frena la entrada, no mata lo que ya está: los que hay se ganan
    if (this.bichos.length >= MAX_BICHOS) return;
    for (let i = 0; i < o.porVez && this.bichos.length < MAX_BICHOS; i++) {
      let tipo = uno(this.r, o.tipos);
      // si esa especie llegó a su techo, entra otra en vez de saltear el turno:
      // saltear haría que la oleada entera se afine cuando sobra de una sola
      if (BICHOS[tipo].maxVivos && this.cuantosDe(tipo) >= BICHOS[tipo].maxVivos)
        tipo = uno(this.r, o.tipos.filter((q) => !BICHOS[q].maxVivos || this.cuantosDe(q) < BICHOS[q].maxVivos) ,
                  ) || tipo;
      this.nacer(tipo, 1);
    }
  }

  /** Nace fuera de la pantalla, en un anillo alrededor del jugador.
   *
   *  NUNCA ENCIMA: uno que aparece pegado saca vida antes de que se lo vea, y
   *  eso se siente como trampa y no como dificultad. */
  nacer(tipo, cuantos) {
    for (let i = 0; i < cuantos; i++) {
      const a = this.r() * 6.283, d = entre(this.r, 430, 540);
      this.nacerEn(tipo, this.jugador.x + Math.cos(a) * d, this.jugador.y + Math.sin(a) * d, 0);
    }
  }

  nacerEn(tipo, x, y, disp, forzarElite) {
    const b = BICHOS[tipo];
    const elite = forzarElite ?? (!b.jefe && this.r() < probElite(this.t));
    const vida = b.vida * dureza(this.t, this.etapa.id) * (elite ? ELITE.vida : 1);
    this.bichos.push({
      tipo, elite,
      x: x + (disp ? entre(this.r, -disp, disp) : 0),
      y: y + (disp ? entre(this.r, -disp, disp) : 0),
      r: b.r * (elite ? ELITE.r : 1),
      vida, vidaMax: vida,
      golpeado: 0, fase: this.r() * 6.283, aturdido: 0,
      reloj: this.r() * 2, salto: 0, saltoDir: { x: 0, y: 0 },
    });
  }

  cuantosDe(tipo) {
    let n = 0;
    for (const b of this.bichos) if (b.tipo === tipo) n++;
    return n;
  }

  rearmarRejilla() {
    this.rejilla.limpiar();
    for (const b of this.bichos) this.rejilla.meter(b);
  }

  moverBichos(dt) {
    const p = this.jugador;
    for (let i = this.bichos.length - 1; i >= 0; i--) {
      const b = this.bichos[i], d = BICHOS[b.tipo];
      if (b.aturdido > 0) { b.aturdido -= dt; continue; }
      const lejos = Math.hypot(b.x - p.x, b.y - p.y);
      // el que acecha o dispara y quedó lejísimos se borra: no amenaza a nadie
      if (d.olvida && lejos > d.olvida) { this.bichos.splice(i, 1); continue; }
      // el resto no se borra, se RECICLA: vuelve a entrar por el otro lado
      if (!d.jefe && lejos > RECICLAR) {
        const a = this.r() * 6.283, dd = entre(this.r, 430, 520);
        b.x = p.x + Math.cos(a) * dd;
        b.y = p.y + Math.sin(a) * dd;
        continue;
      }
      let dx = p.x - b.x, dy = p.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      const vel = d.vel * (b.elite ? ELITE.vel : 1);

      if (d.acecha) {
        /* EL QUE ACECHA se queda quieto hasta que entrás en su radio y ahí se
           impulsa. Hace que cruzar un claro vacío deje de ser gratis. */
        b.reloj -= dt;
        if (b.salto > 0) {
          b.salto -= dt;
          b.x += b.saltoDir.x * d.acecha.impulso * dt;
          b.y += b.saltoDir.y * d.acecha.impulso * dt;
        } else if (dist < d.acecha.radio && b.reloj <= 0) {
          b.salto = 0.32; b.saltoDir = { x: dx, y: dy };
          b.reloj = d.acecha.descanso;
          this.golpes.push({ que: "acecho", x: b.x, y: b.y });
        }
      } else if (d.distancia) {
        /* EL QUE ESCUPE guarda distancia: se acerca si está lejos y se aleja si
           está cerca. Es el único al que hay que IR a buscar, y sin él alejarse
           siempre sería gratis. */
        const signo = dist > d.distancia ? 1 : (dist < d.distancia * 0.72 ? -1 : 0);
        b.x += dx * vel * signo * dt;
        b.y += dy * vel * signo * dt;
        b.reloj -= dt;
        if (b.reloj <= 0 && dist < d.distancia * 1.5) {
          b.reloj = d.escupe.cada;
          this.balas.push({ x: b.x, y: b.y, vx: dx * d.escupe.vel, vy: dy * d.escupe.vel,
                            r: d.escupe.r, daño: d.escupe.daño, vida: 3 });
          this.golpes.push({ que: "escupe", x: b.x, y: b.y });
        }
      } else {
        if (d.errante) {
          const s = Math.sin(this.t * 3.4 + b.fase) * 0.75;
          const nx = -dy, ny = dx;
          dx += nx * s; dy += ny * s;
          const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
        }
        b.x += dx * vel * dt;
        b.y += dy * vel * dt;
      }

      // los jefes que crían y los que abren en abanico
      if (d.cria) {
        b.reloj -= dt;
        if (b.reloj <= 0) {
          b.reloj = d.cria.cada;
          for (let k = 0; k < d.cria.cuantos && this.bichos.length < MAX_BICHOS; k++)
            this.nacerEn(d.cria.tipo, b.x, b.y, 40, false);
        }
      }
      if (d.abanico) {
        b.reloj -= dt;
        if (b.reloj <= 0) {
          b.reloj = d.abanico.cada;
          const base = Math.atan2(p.y - b.y, p.x - b.x);
          for (let k = 0; k < d.abanico.cuantos; k++) {
            const a = base + (k - (d.abanico.cuantos - 1) / 2) * 0.22;
            this.balas.push({ x: b.x, y: b.y, vx: Math.cos(a) * d.abanico.vel, vy: Math.sin(a) * d.abanico.vel,
                              r: d.abanico.r, daño: d.abanico.daño, vida: 4 });
          }
          this.golpes.push({ que: "escupe", x: b.x, y: b.y });
        }
      }

      /* SEPARACION. Sin esto, cincuenta bichos convergen al mismo punto y se
         apilan en uno: se ve un bicho y te pega por cincuenta. Los pesados
         empujan a los livianos y no al revés. */
      let sx = 0, sy = 0;
      for (const o of this.rejilla.cerca(b.x, b.y)) {
        if (o === b) continue;
        const ox = b.x - o.x, oy = b.y - o.y;
        const dd = ox * ox + oy * oy;
        const min = (b.r + o.r) * 0.92;
        if (dd > min * min || dd < 1e-6) continue;
        const l = Math.sqrt(dd);
        const f = (min - l) / min * (BICHOS[o.tipo].peso / d.peso);
        sx += (ox / l) * f; sy += (oy / l) * f;
      }
      b.x += sx * 90 * dt; b.y += sy * 90 * dt;
      if (b.golpeado > 0) b.golpeado -= dt;

      if (dist < b.r + p.r && p.invulnerable <= 0) {
        p.vida -= d.daño;
        /* MEDIO SEGUNDO DE GRACIA. Es lo que separa "me comí un golpe" de "me
           fundieron en un segundo y no vi nada": sin ventana, un abrazo saca la
           barra entera antes de que el dedo reaccione. */
        p.invulnerable = 0.45;
        this.golpes.push({ que: "jugador", x: p.x, y: p.y });
      }
      if (b.vida <= 0) this.matar(i);
    }
  }

  moverBalas(dt) {
    const p = this.jugador;
    for (let i = this.balas.length - 1; i >= 0; i--) {
      const b = this.balas[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.vida -= dt;
      if (b.vida <= 0) { this.balas.splice(i, 1); continue; }
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + p.r) ** 2) {
        this.balas.splice(i, 1);
        if (p.invulnerable <= 0) {
          p.vida -= b.daño; p.invulnerable = 0.45;
          this.golpes.push({ que: "jugador", x: p.x, y: p.y });
        }
      }
    }
  }

  matar(i) {
    const b = this.bichos[i];
    const d = BICHOS[b.tipo];
    this.bichos.splice(i, 1);
    this.matados++;
    const xp = d.xp * (b.elite ? ELITE.xp : 1);
    this.gemas.push({ x: b.x, y: b.y, xp, r: d.jefe ? 10 : (b.elite ? 7 : 5) });
    this.golpes.push({ que: "muere", x: b.x, y: b.y, jefe: !!d.jefe, elite: b.elite, tipo: b.tipo });
    if (b.elite || d.jefe) this.cofres.push({ x: b.x, y: b.y, r: 13, jefe: !!d.jefe });
    if (d.jefe) this.jefesVivos = Math.max(0, this.jefesVivos - 1);
    // los que se parten: el saco deja crías, el jefe se deshace
    if (d.parte) for (const t of d.parte)
      if (this.bichos.length < MAX_BICHOS) this.nacerEn(t, b.x, b.y, d.jefe ? 70 : 26, false);
  }

  masCercano(x, y, hasta = 1e9) {
    let mejor = null, mejorD = hasta * hasta;
    for (const b of this.bichos) {
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < mejorD) { mejorD = d; mejor = b; }
    }
    return mejor;
  }

  reloj(n, cada, dt) {
    this.relojes[n] = (this.relojes[n] || 0) + dt;
    if (this.relojes[n] < cada * this.jugador.frecuencia) return false;
    this.relojes[n] = 0;
    return true;
  }

  /** El daño que recibe un bicho, ya descontado su blindaje. */
  dañar(b, cuanto) {
    const bl = BICHOS[b.tipo].blindado || 0;
    // EL BLINDAJE ES UNA FRACCION Y NO UN RESTO FIJO. Restando un número, un
    // arma de muchos golpes chiquitos deja de hacer NADA y el jugador no
    // entiende por qué; con fracción siempre pega, sólo que menos.
    const real = cuanto * (1 - bl);
    b.vida -= real;
    b.golpeado = 0.12;
    this.golpes.push({ que: "pega", x: b.x, y: b.y, cuanto: real, blindado: bl > 0 });
  }

  dispararArmas(dt) {
    const p = this.jugador;
    for (const nombre of Object.keys(p.armas)) {
      const evo = p.evolucionadas[nombre];
      const tipo = evo ? EVOLUCIONES[evo].tipo : ARMAS[nombre].tipo;
      const a = this.datosArma(nombre);
      if (tipo === "tiro" && this.reloj(nombre, a.cada, dt)) {
        for (let k = 0; k < a.cuantos; k++) {
          const b = this.masCercano(p.x, p.y, a.alcance);
          if (!b) break;
          const ang = Math.atan2(b.y - p.y, b.x - p.x) + (k - (a.cuantos - 1) / 2) * 0.17;
          this.tiros.push({ x: p.x, y: p.y, vx: Math.cos(ang) * a.vel, vy: Math.sin(ang) * a.vel,
                            r: a.radio, daño: a.daño * p.daño, vida: 1.7,
                            atraviesa: a.atraviesa, tocados: new Set(), color: evo ? EVOLUCIONES[evo].color : ARMAS[nombre].color });
        }
        this.golpes.push({ que: "tiro", x: p.x, y: p.y });
      } else if (tipo === "onda" && this.reloj(nombre, a.cada, dt)) {
        this.ondas.push({ x: p.x, y: p.y, r: 0, rMax: a.radio, daño: a.daño * p.daño,
                          empuje: a.empuje, aturde: a.aturde || 0, tocados: new Set() });
        this.golpes.push({ que: "onda", x: p.x, y: p.y });
      } else if (tipo === "semilla" && this.reloj(nombre, a.cada, dt)) {
        this.semillas.push({ x: p.x, y: p.y, r: a.radio, daño: a.daño * p.daño, dura: a.dura,
                             listo: 0.45, tocados: new Set() });
      } else if (tipo === "raiz" && this.reloj(nombre, a.cada, dt)) {
        this.semillas.push({ x: p.x, y: p.y, r: a.radio, daño: a.daño * p.daño, dura: a.dura,
                             listo: 0.25, tocados: new Set(), raiz: true });
      } else if (tipo === "hilo" && this.reloj(nombre, a.cada, dt)) {
        this.latigos.push({ x: p.x, y: p.y, rumbo: p.rumbo, largo: a.largo, ancho: a.ancho,
                            daño: a.daño * p.daño, vida: 0.18, tocados: new Set() });
        this.golpes.push({ que: "hilo", x: p.x, y: p.y });
      } else if (tipo === "guadaña" && this.reloj(nombre, a.cada, dt)) {
        this.guadañas.push({ rumbo: p.rumbo - a.arco / 2, arco: a.arco, radio: a.radio,
                             daño: a.daño * p.daño, vida: 0.3, tocados: new Set() });
        this.golpes.push({ que: "hilo", x: p.x, y: p.y });
      }
    }
  }

  moverTiros(dt) {
    for (let i = this.tiros.length - 1; i >= 0; i--) {
      const t = this.tiros[i];
      t.x += t.vx * dt; t.y += t.vy * dt; t.vida -= dt;
      if (t.vida <= 0) { this.tiros.splice(i, 1); continue; }
      for (const b of this.rejilla.cerca(t.x, t.y)) {
        if (t.tocados.has(b)) continue;
        if ((b.x - t.x) ** 2 + (b.y - t.y) ** 2 > (b.r + t.r) ** 2) continue;
        this.dañar(b, t.daño);
        t.tocados.add(b);
        if (t.tocados.size > t.atraviesa) { this.tiros.splice(i, 1); break; }
      }
    }
    this.limpiarMuertos();
  }

  moverOrbita(dt) {
    const p = this.jugador;
    const evo = p.evolucionadas.orbita;
    if (!this.nivelArma("orbita")) return;
    const a = this.datosArma("orbita");
    this.anguloOrbita += a.giro * dt;
    if (evo) {
      // el anillo: un aro completo, así que se mira la distancia y no cada trozo
      for (const b of this.bichos) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (Math.abs(d - a.radio) > a.grosor + b.r) continue;
        b.cdOrbita = (b.cdOrbita || 0) - dt;
        if (b.cdOrbita > 0) continue;
        b.cdOrbita = 0.28;
        this.dañar(b, a.daño * p.daño);
      }
    } else {
      for (let k = 0; k < a.cuantos; k++) {
        const ang = this.anguloOrbita + (k / a.cuantos) * 6.283;
        const x = p.x + Math.cos(ang) * a.radio, y = p.y + Math.sin(ang) * a.radio;
        for (const b of this.rejilla.cerca(x, y)) {
          if ((b.x - x) ** 2 + (b.y - y) ** 2 > (b.r + a.r) ** 2) continue;
          // pega por tiempo y no por toque: si no, un bicho pegado recibe
          // sesenta golpes por segundo y todo lo demás sobra
          b.cdOrbita = (b.cdOrbita || 0) - dt;
          if (b.cdOrbita > 0) continue;
          b.cdOrbita = 0.3;
          this.dañar(b, a.daño * p.daño);
        }
      }
    }
    this.limpiarMuertos();
  }

  moverOndas(dt) {
    for (let i = this.ondas.length - 1; i >= 0; i--) {
      const o = this.ondas[i];
      o.r += (o.rMax / 0.45) * dt;
      if (o.r >= o.rMax) { this.ondas.splice(i, 1); continue; }
      for (const b of this.bichos) {
        if (o.tocados.has(b)) continue;
        const d = Math.hypot(b.x - o.x, b.y - o.y);
        if (d > o.r || d < o.r - 44) continue;
        o.tocados.add(b);
        this.dañar(b, o.daño);
        if (o.aturde) b.aturdido = Math.max(b.aturdido, o.aturde);
        const m = d || 1;
        b.x += ((b.x - o.x) / m) * o.empuje * 0.12;
        b.y += ((b.y - o.y) / m) * o.empuje * 0.12;
      }
    }
    this.limpiarMuertos();
  }

  moverSemillas(dt) {
    for (let i = this.semillas.length - 1; i >= 0; i--) {
      const s = this.semillas[i];
      s.dura -= dt;
      if (s.listo > 0) { s.listo -= dt; continue; }
      if (s.dura <= 0) { this.semillas.splice(i, 1); continue; }
      for (const b of this.rejilla.cerca(s.x, s.y)) {
        if (s.tocados.has(b)) continue;
        if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 > (b.r + s.r) ** 2) continue;
        s.tocados.add(b);
        this.dañar(b, s.daño);
      }
      // la raíz además une con la semilla anterior y quema la línea
      if (s.raiz && i > 0) {
        const q = this.semillas[i - 1];
        if (q && q.raiz) for (const b of this.bichos) {
          const dx = b.x - s.x, dy = b.y - s.y;
          const lx = q.x - s.x, ly = q.y - s.y;
          const ll = lx * lx + ly * ly || 1;
          const u = Math.max(0, Math.min(1, (dx * lx + dy * ly) / ll));
          const px = s.x + lx * u, py = s.y + ly * u;
          if ((b.x - px) ** 2 + (b.y - py) ** 2 > (b.r + 12) ** 2) continue;
          b.cdRaiz = (b.cdRaiz || 0) - dt;
          if (b.cdRaiz > 0) continue;
          b.cdRaiz = 0.4;
          this.dañar(b, s.daño * 0.35);
        }
      }
    }
    this.limpiarMuertos();
  }

  moverLatigos(dt) {
    for (let i = this.latigos.length - 1; i >= 0; i--) {
      const l = this.latigos[i];
      l.vida -= dt;
      if (l.vida <= 0) { this.latigos.splice(i, 1); continue; }
      for (const b of this.bichos) {
        if (l.tocados.has(b)) continue;
        const dx = b.x - l.x, dy = b.y - l.y;
        const a = dx * Math.cos(l.rumbo) + dy * Math.sin(l.rumbo);
        const o = -dx * Math.sin(l.rumbo) + dy * Math.cos(l.rumbo);
        if (a < -b.r || a > l.largo + b.r || Math.abs(o) > l.ancho / 2 + b.r) continue;
        l.tocados.add(b);
        this.dañar(b, l.daño);
      }
    }
    this.limpiarMuertos();
  }

  moverGuadañas(dt) {
    const p = this.jugador;
    for (let i = this.guadañas.length - 1; i >= 0; i--) {
      const g = this.guadañas[i];
      g.vida -= dt;
      if (g.vida <= 0) { this.guadañas.splice(i, 1); continue; }
      const avance = g.arco * (dt / 0.3);
      g.rumbo += avance;
      for (const b of this.bichos) {
        if (g.tocados.has(b)) continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d > g.radio + b.r) continue;
        const a = Math.atan2(b.y - p.y, b.x - p.x);
        let dif = ((a - g.rumbo + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(dif) > avance * 1.6 + 0.25) continue;
        g.tocados.add(b);
        this.dañar(b, g.daño);
      }
    }
    this.limpiarMuertos();
  }

  limpiarMuertos() {
    for (let i = this.bichos.length - 1; i >= 0; i--) if (this.bichos[i].vida <= 0) this.matar(i);
  }

  recogerCosas(dt) {
    const p = this.jugador;
    for (let i = this.gemas.length - 1; i >= 0; i--) {
      const g = this.gemas[i];
      let d = Math.hypot(g.x - p.x, g.y - p.y);
      /* LA GEMA SIEMPRE VIENE, esté donde esté, y una vez atraída no suelta.
         Con un radio, una gema que cayó afuera queda muerta para siempre y el
         jugador nunca se entera de que perdió experiencia: sólo sube más lento
         de lo que debería. Lejos viene despacio —hay que ir a buscarla, que es
         la decisión— y adentro del imán se acelera. */
      if (d < p.iman) g.atraida = true;
      const v = g.atraida ? p.vel * 1.75 + (p.iman - Math.min(d, p.iman)) * 3 : 34;
      g.x += ((p.x - g.x) / (d || 1)) * v * dt;
      g.y += ((p.y - g.y) / (d || 1)) * v * dt;
      d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < p.r + g.r + 6) {
        this.gemas.splice(i, 1);
        p.xp += g.xp;
        this.golpes.push({ que: "gema", x: g.x, y: g.y });
        while (p.xp >= p.xpNecesaria) {
          p.xp -= p.xpNecesaria;
          p.nivel++;
          p.xpNecesaria = xpParaNivel(p.nivel);
          this.pendienteMejora++;
        }
      }
    }
    for (let i = this.cofres.length - 1; i >= 0; i--) {
      const c = this.cofres[i];
      if (Math.hypot(c.x - p.x, c.y - p.y) > p.r + c.r + 4) continue;
      this.cofres.splice(i, 1);
      this.abrirCofre(c);
    }
  }

  /** El cofre. Es el único premio del juego que no se elige: cae lo que cae. */
  abrirCofre(c) {
    const p = this.jugador;
    const q = this.r();
    if (c.jefe || q < 0.34) {
      // subida de nivel gratis: el premio grande
      this.pendienteMejora++;
      this.golpes.push({ que: "cofre", x: c.x, y: c.y, premio: "nivel" });
    } else if (q < 0.7) {
      p.vida = Math.min(p.vidaMax, p.vida + 45);
      this.golpes.push({ que: "cofre", x: c.x, y: c.y, premio: "vida" });
    } else {
      // arrasa: todo lo que está cerca recibe un golpe grande
      for (const b of this.bichos) {
        if (Math.hypot(b.x - p.x, b.y - p.y) > 340) continue;
        this.dañar(b, 120 * p.daño);
      }
      this.golpes.push({ que: "cofre", x: c.x, y: c.y, premio: "bomba" });
      this.limpiarMuertos();
    }
  }
}
