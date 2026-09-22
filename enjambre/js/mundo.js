// El mundo: bichos, tiros, gemas y el reloj. Sin dibujo y sin audio.
//
// POR QUE LA SIMULACION VIVE SOLA. Un juego de supervivencia se rompe por el
// balance, no por el dibujo: que el jefe sea imposible, que una arma no sirva
// nunca, que a los cinco minutos entren tantos bichos que el teléfono se
// arrastre. Nada de eso se ve mirando una captura. Acá un robot juega partidas
// enteras en milisegundos y las pruebas miden cuántas sobreviven, con qué arma
// y cuántos bichos llegó a haber en pantalla.

import { azar, uno, entre } from "./azar.js";
import { BICHOS, OLEADAS, dureza, LARGO, MAX_BICHOS } from "./bichos.js";
import { ARMAS, PASIVAS, xpParaNivel } from "./armas.js";

/* LA REJILLA. Sin ella, separar a los bichos entre sí es comparar cada uno con
   cada uno: con doscientos en pantalla son cuarenta mil comparaciones por
   cuadro y el teléfono se planta. Con celdas del tamaño del bicho más grande,
   cada uno mira sólo sus nueve celdas vecinas. */
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
  constructor(semilla = 1, opciones = {}) {
    this.r = azar(semilla);
    this.semilla = semilla;
    // El mundo es más grande que la pantalla para que huir signifique algo,
    // pero tiene borde: un mapa infinito se juega corriendo para siempre en
    // línea recta, que es aburrido y además nunca se pierde.
    this.radioMapa = opciones.radioMapa || 900;
    this.jugador = {
      x: 0, y: 0, vx: 0, vy: 0, r: 13,
      vel: 140, vida: 100, vidaMax: 100, iman: 150, daño: 1, frecuencia: 1,
      rumbo: 0, invulnerable: 0,
      armas: { chispa: 1 }, pasivas: {},
      nivel: 1, xp: 0, xpNecesaria: xpParaNivel(1),
    };
    this.bichos = [];
    this.tiros = [];
    this.gemas = [];
    this.semillas = [];
    this.ondas = [];
    this.latigos = [];
    this.golpes = [];          // avisos para el dibujo y el sonido
    this.rejilla = new Rejilla(44);
    this.t = 0;
    this.relojes = {};         // cada arma con su propio contador
    this.anguloOrbita = 0;
    this.muerto = false;
    this.gano = false;
    this.matados = 0;
    this.pendienteMejora = 0;  // cuántas elecciones debe el juego
    this.proximaOleada = 0;
    this.jefesLargados = 0;
    this.picoBichos = 0;
  }

  // ── consultas ────────────────────────────────────────────────────────────
  nivelArma(n) { return this.jugador.armas[n] || 0; }
  datosArma(n) { return ARMAS[n].niveles[this.nivelArma(n) - 1]; }
  terminada() { return this.muerto || this.gano; }

  /** Qué tres cosas se ofrecen al subir de nivel.
   *
   *  NUNCA OFRECE ALGO QUE YA ESTA AL MAXIMO, y siempre ofrece tres cosas
   *  distintas. Si no, en el nivel doce la pantalla de mejoras muestra tres
   *  veces lo mismo agotado y la subida de nivel se vuelve un trámite. */
  ofertas() {
    const bolsa = [];
    for (const n of Object.keys(ARMAS)) {
      const lv = this.nivelArma(n);
      if (lv >= ARMAS[n].niveles.length) continue;
      // un arma nueva sólo si quedan manos: seis armas a la vez es ruido
      if (lv === 0 && Object.keys(this.jugador.armas).length >= 4) continue;
      bolsa.push({ clase: "arma", nombre: n, nivel: lv + 1, nueva: lv === 0 });
    }
    for (const n of Object.keys(PASIVAS)) {
      const lv = this.jugador.pasivas[n] || 0;
      if (lv >= PASIVAS[n].max) continue;
      bolsa.push({ clase: "pasiva", nombre: n, nivel: lv + 1, nueva: lv === 0 });
    }
    // se sortea sin repetir; si no quedan tres, se devuelve lo que haya
    const fuera = [];
    while (fuera.length < 3 && bolsa.length) {
      const i = Math.floor(this.r() * bolsa.length) % bolsa.length;
      fuera.push(bolsa.splice(i, 1)[0]);
    }
    return fuera;
  }

  elegir(oferta) {
    if (!oferta) return;
    if (oferta.clase === "arma") this.jugador.armas[oferta.nombre] = oferta.nivel;
    else {
      this.jugador.pasivas[oferta.nombre] = oferta.nivel;
      PASIVAS[oferta.nombre].aplicar(this.jugador, oferta.nivel);
      if (oferta.nombre === "coraza") this.jugador.vida += 26;
    }
    this.pendienteMejora = Math.max(0, this.pendienteMejora - 1);
  }

  // ── el paso de simulación ────────────────────────────────────────────────
  /**
   * @param dt segundos
   * @param mov {x,y} dirección de movimiento, de módulo 0 a 1
   */
  avanzar(dt, mov) {
    if (this.terminada() || this.pendienteMejora > 0) return;
    this.t += dt;
    this.golpes.length = 0;

    this.moverJugador(dt, mov);
    this.largarBichos();
    this.rearmarRejilla();
    this.moverBichos(dt);
    this.dispararArmas(dt);
    this.moverTiros(dt);
    this.moverOrbita(dt);
    this.moverOndas(dt);
    this.moverSemillas(dt);
    this.moverLatigos(dt);
    this.recogerGemas(dt);

    if (this.jugador.vida <= 0) { this.jugador.vida = 0; this.muerto = true; }
    if (this.t >= LARGO && !this.muerto) this.gano = true;
    if (this.bichos.length > this.picoBichos) this.picoBichos = this.bichos.length;
  }

  moverJugador(dt, mov) {
    const p = this.jugador;
    const m = Math.hypot(mov.x, mov.y);
    if (m > 0.02) {
      const k = Math.min(1, m);
      p.x += (mov.x / m) * p.vel * k * dt;
      p.y += (mov.y / m) * p.vel * k * dt;
      p.rumbo = Math.atan2(mov.y, mov.x);
    }
    // el borde: se frena, no se rebota. Rebotar contra una pared invisible con
    // treinta bichos encima se siente como que el juego te empujó a la muerte.
    const d = Math.hypot(p.x, p.y);
    if (d > this.radioMapa) { p.x = (p.x / d) * this.radioMapa; p.y = (p.y / d) * this.radioMapa; }
    if (p.invulnerable > 0) p.invulnerable -= dt;
  }

  oleadaActual() {
    let cual = OLEADAS[0];
    for (const o of OLEADAS) if (this.t >= o.desde) cual = o;
    return cual;
  }

  largarBichos() {
    const o = this.oleadaActual();
    // los jefes salen una sola vez cada uno
    if (o.jefe && this.jefesLargados < OLEADAS.filter((q) => q.jefe && q.desde <= this.t).length) {
      this.jefesLargados++;
      this.nacer(o.jefe, 1);
      return;
    }
    if (!o.cada) return;
    if (this.t < this.proximaOleada) return;
    this.proximaOleada = this.t + o.cada;
    // el techo frena la entrada, no mata lo que ya está: los que hay se ganan
    if (this.bichos.length >= MAX_BICHOS) return;
    for (let i = 0; i < o.porVez && this.bichos.length < MAX_BICHOS; i++)
      this.nacer(uno(this.r, o.tipos), 1);
  }

  /** Nace fuera de la pantalla, en un anillo alrededor del jugador.
   *
   *  NUNCA ENCIMA: un bicho que aparece pegado al jugador le saca vida antes de
   *  que se lo pueda ver, y eso se siente como trampa y no como dificultad. */
  nacer(tipo, cuantos) {
    const b = BICHOS[tipo];
    for (let i = 0; i < cuantos; i++) {
      const a = this.r() * 6.283, d = entre(this.r, 420, 520);
      const x = this.jugador.x + Math.cos(a) * d, y = this.jugador.y + Math.sin(a) * d;
      this.bichos.push({
        tipo, x, y, vx: 0, vy: 0, r: b.r,
        vida: b.vida * dureza(this.t), vidaMax: b.vida * dureza(this.t),
        golpeado: 0, fase: this.r() * 6.283,
      });
    }
  }

  rearmarRejilla() {
    this.rejilla.limpiar();
    for (const b of this.bichos) this.rejilla.meter(b);
  }

  moverBichos(dt) {
    const p = this.jugador;
    for (let i = this.bichos.length - 1; i >= 0; i--) {
      const b = this.bichos[i], d = BICHOS[b.tipo];
      let dx = p.x - b.x, dy = p.y - b.y;
      const dist = Math.hypot(dx, dy) || 1;
      dx /= dist; dy /= dist;
      if (d.errante) {
        // los erráticos no van derecho: se les suma un vaivén con su propia fase
        const s = Math.sin(this.t * 3.4 + b.fase) * 0.75;
        const nx = -dy, ny = dx;
        dx += nx * s; dy += ny * s;
        const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      }
      b.vx = dx * d.vel; b.vy = dy * d.vel;

      /* SEPARACION ENTRE BICHOS. Sin esto, cincuenta bichos convergen al mismo
         punto y se apilan en uno solo: se ve un bicho y te pega por cincuenta.
         Los pesados empujan a los livianos y no al revés. */
      let sx = 0, sy = 0;
      for (const o of this.rejilla.cerca(b.x, b.y)) {
        if (o === b) continue;
        const ox = b.x - o.x, oy = b.y - o.y;
        const dd = ox * ox + oy * oy;
        const min = (b.r + o.r) * 0.92;
        if (dd > min * min || dd < 1e-6) continue;
        const l = Math.sqrt(dd);
        const fuerza = (min - l) / min * (BICHOS[o.tipo].peso / d.peso);
        sx += (ox / l) * fuerza; sy += (oy / l) * fuerza;
      }
      b.x += (b.vx + sx * 90) * dt;
      b.y += (b.vy + sy * 90) * dt;
      if (b.golpeado > 0) b.golpeado -= dt;

      // contacto
      if (dist < b.r + p.r && p.invulnerable <= 0) {
        p.vida -= d.daño;
        /* MEDIO SEGUNDO DE GRACIA Y NO MENOS. Es lo que separa "me comí un
           golpe" de "me fundieron en un segundo y no vi nada": sin ventana, un
           abrazo de treinta bichos saca la barra entera antes de que el dedo
           reaccione, y eso no es dificultad, es no dejar jugar. */
        p.invulnerable = 0.45;
        this.golpes.push({ que: "jugador", x: p.x, y: p.y });
      }
      if (b.vida <= 0) this.matar(i);
    }
  }

  matar(i) {
    const b = this.bichos[i];
    const d = BICHOS[b.tipo];
    this.bichos.splice(i, 1);
    this.matados++;
    this.gemas.push({ x: b.x, y: b.y, xp: d.xp, r: d.jefe ? 9 : 4.5, vx: 0, vy: 0 });
    this.golpes.push({ que: "muere", x: b.x, y: b.y, jefe: !!d.jefe });
    // el jefe se deshace en motas: el remate tiene que ser un momento
    if (d.jefe) for (let k = 0; k < 10; k++) this.nacerEn("mota", b.x, b.y, 60);
  }

  nacerEn(tipo, x, y, disp) {
    const b = BICHOS[tipo];
    this.bichos.push({
      tipo, x: x + entre(this.r, -disp, disp), y: y + entre(this.r, -disp, disp),
      vx: 0, vy: 0, r: b.r, vida: b.vida * dureza(this.t), vidaMax: b.vida * dureza(this.t),
      golpeado: 0, fase: this.r() * 6.283,
    });
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

  dispararArmas(dt) {
    const p = this.jugador;
    if (this.nivelArma("chispa")) {
      const a = this.datosArma("chispa");
      if (this.reloj("chispa", a.cada, dt)) {
        for (let k = 0; k < a.cuantos; k++) {
          /* EL ALCANCE DEL ARMA Y EL DEL IMAN TIENEN QUE HABLARSE.
             Con 520 de alcance, los bichos morían lejísimos y la gema quedaba
             donde murieron. Medido a los 20 segundos: 21 bichos matados, 20
             gemas en el piso y NINGUNA a menos de 179 px de un imán de 150.
             El juego dejaba de premiar en silencio. Se dispara más cerca. */
          const b = this.masCercano(p.x, p.y, 290);
          if (!b) break;
          const ang = Math.atan2(b.y - p.y, b.x - p.x) + (k - (a.cuantos - 1) / 2) * 0.18;
          this.tiros.push({ x: p.x, y: p.y, vx: Math.cos(ang) * a.vel, vy: Math.sin(ang) * a.vel,
                            r: a.radio, daño: a.daño * p.daño, vida: 1.6, atraviesa: a.atraviesa, tocados: new Set() });
        }
        this.golpes.push({ que: "tiro", x: p.x, y: p.y });
      }
    }
    if (this.nivelArma("onda")) {
      const a = this.datosArma("onda");
      if (this.reloj("onda", a.cada, dt)) {
        this.ondas.push({ x: p.x, y: p.y, r: 0, rMax: a.radio, daño: a.daño * p.daño, empuje: a.empuje, tocados: new Set() });
        this.golpes.push({ que: "onda", x: p.x, y: p.y });
      }
    }
    if (this.nivelArma("semilla")) {
      const a = this.datosArma("semilla");
      if (this.reloj("semilla", a.cada, dt))
        this.semillas.push({ x: p.x, y: p.y, r: a.radio, daño: a.daño * p.daño, dura: a.dura, listo: 0.5, tocados: new Set() });
    }
    if (this.nivelArma("hilo")) {
      const a = this.datosArma("hilo");
      if (this.reloj("hilo", a.cada, dt)) {
        this.latigos.push({ x: p.x, y: p.y, rumbo: p.rumbo, largo: a.largo, ancho: a.ancho,
                            daño: a.daño * p.daño, vida: 0.18, tocados: new Set() });
        this.golpes.push({ que: "hilo", x: p.x, y: p.y });
      }
    }
  }

  dañar(b, cuanto) {
    b.vida -= cuanto;
    b.golpeado = 0.12;
    this.golpes.push({ que: "pega", x: b.x, y: b.y, cuanto });
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
    if (!this.nivelArma("orbita")) return;
    const a = this.datosArma("orbita"), p = this.jugador;
    this.anguloOrbita += a.giro * dt;
    for (let k = 0; k < a.cuantos; k++) {
      const ang = this.anguloOrbita + (k / a.cuantos) * 6.283;
      const x = p.x + Math.cos(ang) * a.radio, y = p.y + Math.sin(ang) * a.radio;
      for (const b of this.rejilla.cerca(x, y)) {
        if ((b.x - x) ** 2 + (b.y - y) ** 2 > (b.r + a.r) ** 2) continue;
        // la órbita pega por tiempo, no por toque: si no, un bicho pegado al
        // jugador recibe sesenta golpes por segundo y todo lo demás sobra
        b.cooldownOrbita = (b.cooldownOrbita || 0) - dt;
        if (b.cooldownOrbita > 0) continue;
        b.cooldownOrbita = 0.3;
        this.dañar(b, a.daño * p.daño);
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
        if (d > o.r || d < o.r - 40) continue;
        o.tocados.add(b);
        this.dañar(b, o.daño);
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
    }
    this.limpiarMuertos();
  }

  moverLatigos(dt) {
    for (let i = this.latigos.length - 1; i >= 0; i--) {
      const l = this.latigos[i];
      l.vida -= dt;
      if (l.vida <= 0) { this.latigos.splice(i, 1); continue; }
      const cx = l.x + Math.cos(l.rumbo) * l.largo * 0.5;
      const cy = l.y + Math.sin(l.rumbo) * l.largo * 0.5;
      for (const b of this.bichos) {
        if (l.tocados.has(b)) continue;
        // se mira en el sistema del latigazo: a lo largo y a lo ancho
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

  limpiarMuertos() {
    for (let i = this.bichos.length - 1; i >= 0; i--) if (this.bichos[i].vida <= 0) this.matar(i);
  }

  recogerGemas(dt) {
    const p = this.jugador;
    for (let i = this.gemas.length - 1; i >= 0; i--) {
      const g = this.gemas[i];
      let d = Math.hypot(g.x - p.x, g.y - p.y);
      /* LA GEMA TIENE QUE CORRER MAS QUE VOS, Y NO SOLTARTE.
         La primera versión la atraía a 120 px/s mientras el jugador corre a
         140: huyendo —que es lo que uno hace todo el tiempo en este juego— la
         gema quedaba atrás, salía del radio del imán y se frenaba para siempre.
         Medido en el juego real: 25 bichos matados, 21 gemas tiradas en el
         piso y 4 de experiencia juntada. La prueba sin navegador no lo vio
         porque en seis minutos uno termina pisando muchas por casualidad, así
         que el nivel final igual subía y el número tapaba el agujero.
         Una vez que entró al imán, ya es tuya: no se suelta aunque te alejes. */
      /* Y LA GEMA SIEMPRE VIENE, esté donde esté. Con un radio, una gema que
         cayó afuera queda muerta para siempre y el jugador nunca se entera de
         que perdió experiencia: no hay ningún aviso, sólo sube más lento de lo
         que debería. Lejos viene despacio —hay que ir a buscarla, que es la
         decisión— y adentro del imán se acelera. Lo que sube el imán es la
         velocidad, no un límite. */
      if (d < p.iman) g.atraida = true;
      const v = g.atraida ? p.vel * 1.75 + (p.iman - Math.min(d, p.iman)) * 3 : 34;
      g.x += ((p.x - g.x) / (d || 1)) * v * dt;
      g.y += ((p.y - g.y) / (d || 1)) * v * dt;
      // la distancia se vuelve a medir DESPUES de mover la gema: usando la de
      // antes, la gema que llegó justo en este cuadro se recoge recién en el
      // siguiente, y a velocidad alta eso es pasársela de largo
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
  }
}
