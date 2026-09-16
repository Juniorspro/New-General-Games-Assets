// La partida: los dos cuerpos, lo que chocan y lo que les pasa cuando chocan.

import { integrar, resolver, palo, contraCaja, contraSegmento, empujar,
         teletransportar, rapidez, G } from "./verlet.js";
import { crearCuerpo, ovillar, centro, RILO, TITO, ALTO_CUERPO } from "./cuerpo.js";
import { paredEn, capituloEn, ANCHO } from "./nivel.js";

export const VISTA = { ancho: 360, alto: 640 };

// El golpe que se aguanta sin pagar nada, contra los 7,6 px por cuadro que da
// la caida a fondo: rozar una pared o apoyarse en una repisa despacio sale
// gratis, llegar a una repisa cayendo derecho cuesta.
const UMBRAL = 5.8;
// Un cobro por vez. Un ragdoll que cae de costado apoya once puntos en el
// mismo cuadro y la fisica se resuelve tres veces por cuadro: cobrando cada
// contacto, una caida comun descuenta treinta y tres veces y la barra se
// vacia en dos segundos. Se guarda EL PEOR golpe del cuadro y se cobra ese, y
// despues no se vuelve a cobrar por doce cuadros — lo que dura un rebote.
const ESPERA = 12;

export class Partida {
  constructor(nv) {
    this.nv = nv;
    this.reiniciarEn(0);
  }

  /** Arrancar —o volver— desde el portal `cap`. */
  reiniciarEn(cap) {
    const nv = this.nv;
    const y = cap === 0 ? 40 : nv.portales[cap - 1].y + 40;
    const w = paredEn(nv.perfil, y);
    const x = (w.izq + w.der) / 2;

    this.rilo = crearCuerpo(x - 12, y, RILO);
    this.tito = crearCuerpo(x + 18, y - 6, TITO);
    // LA SOGA. Tito no es decoracion: cuelga de Rilo con una restriccion que
    // solo tira cuando se estira, asi que es peso muerto que arrastra en las
    // curvas — que es exactamente lo que es un nieto atado con una soga.
    //
    // VA DE PECHO A PECHO Y NO DE MANO A MANO, y esa es toda la diferencia.
    // Una mano pesa 0,7 contra los 14 del cuerpo entero: atando la soga ahi,
    // el tiron sale disparado al punto liviano, el antebrazo se estira —medido,
    // 32% de mas— y el tiron recien llega al cuerpo un par de cuadros despues,
    // por los huesos. De pecho a pecho tira del peso de una sola vez y ningun
    // hueso paga el viaje.
    this.soga = palo(this.rilo.p.pecho, this.tito.p.pecho,
                     { largo: 56, tipo: "cuerda", rigidez: 1 });
    // Y esta, floja, es la que acerca las dos manos para que la soga DIBUJADA
    // salga de una mano y no del esternon. No aguanta peso: si lo aguantara,
    // volveriamos al brazo de goma.
    this.mano = palo(this.rilo.p.manoIzq, this.tito.p.manoDer,
                     { largo: 26, tipo: "cuerda", rigidez: 0.28 });
    this.puntos = [...this.rilo.puntos, ...this.tito.puntos];
    this.palos = [...this.rilo.palos, ...this.tito.palos, this.mano, this.soga];

    this.desdeCap = cap;
    this.integridad = cap === 0 ? 100 : 72;
    this.estado = "jugando";           // jugando | roto | gano
    this.peor = null;                  // el golpe mas fuerte de este cuadro
    this.espera = 0;
    this.cuenta = 0;
    this.cam = centro(this.rilo).y - VISTA.alto * 0.34;
    this.sacude = 0;
    this.chispas = [];
    this.prof = y;
    this.marca = y;
    this.t = 0;
    this.dicho = null;                 // el cartel de dialogo que esta puesto
    this.dichoT = 0;
    this.decir(nv.caps[cap].dice, nv.caps[cap].nombre, `c${cap}`);
    for (const c of nv.chatarra) if (c.y > y) c.tomada = false;
  }

  /**
   * Poner un cartel de dialogo.
   *
   * `clave` es el prefijo con el que se busca la voz de cada linea ("c3" →
   * "c3l0", "c3l1"). Sale de aca y no de un contador aparte porque las voces
   * se generan leyendo el mismo nivel.js: si el prefijo se calculara en otro
   * lado, un capitulo agregado en el medio correria todas las voces una
   * posicion y nadie se enteraria hasta escucharlo.
   */
  decir(lineas, titulo, clave) {
    this.dicho = { lineas, titulo, i: 0, clave };
    this.dichoT = 0;
  }

  // --- un cuadro ---------------------------------------------------------
  paso(ent) {
    this.t++;
    // Los avisos del cuadro. La partida NO suena nada: no sabe que existe el
    // audio. Deja anotado que paso y main.js decide. Asi se puede correr la
    // fisica entera en una prueba, sin navegador y sin sonido.
    this.ev = { golpe: 0, pincho: false, resorte: false, portal: false,
                chatarra: 0, roto: false, gano: false, capitulo: null };
    if (this.sacude > 0) this.sacude *= 0.88;
    if (this.dicho) {
      this.dichoT++;
      // Cada linea se queda dos segundos y medio. No frena el juego: se sigue
      // cayendo mientras hablan, que es medio el chiste.
      if (this.dichoT > 150) { this.dichoT = 0; this.dicho.i++;
                               if (this.dicho.i >= this.dicho.lineas.length) this.dicho = null; }
    }

    if (this.estado === "roto") {
      this.cuenta++;
      this.fisica(ent, true);
      if (this.cuenta > 110) this.reiniciarEn(this.desdeCap);
      return;
    }
    if (this.estado === "gano") { this.fisica(ent, true); return; }

    this.fisica(ent, false);

    const c = centro(this.rilo);
    this.prof = Math.max(this.prof, c.y);
    this.marca = c.y;
    // La camara persigue con retraso y mira un poco mas abajo que el muneco:
    // en un juego de caer, lo que importa es lo que VIENE.
    const obj = c.y - VISTA.alto * 0.34;
    this.cam += (obj - this.cam) * 0.14;

    this.portales(c);
    this.juntar();
    if (this.integridad <= 0) {
      this.integridad = 0; this.estado = "roto"; this.cuenta = 0; this.sacude = 14;
      this.ev.roto = true;
    }
    for (const ch of this.chispas) {
      ch.x += ch.vx; ch.y += ch.vy; ch.vy += 0.18; ch.vida--;
    }
    this.chispas = this.chispas.filter((ch) => ch.vida > 0);
  }

  fisica(ent, suelto) {
    const r = this.rilo, t = this.tito;
    // EL REACTOR. El unico control del juego: un empujon lateral al pecho de
    // Rilo. Va al pecho y no al centro de masa porque empujar el pecho hace
    // que el cuerpo se incline y las piernas queden atras, que es como se ve
    // alguien empujado. Un empujon al centro de masa mueve un ladrillo.
    if (!suelto && ent.mover) {
      // EL EMPUJON VA A TODO EL CUERPO, repartido por masa, y encima un extra
      // al pecho. Puesto solo en el pecho —que es lo que parecia mas natural—
      // el reactor tiene que arrastrar por los huesos los otros diez puntos de
      // Rilo mas los once de Tito: la aceleracion real daba 0,11 px por cuadro
      // al cuadrado y cruzar el pasillo llevaba cuatro segundos, o sea que
      // esquivar era imposible. Repartido, la aceleracion es la que dice el
      // numero; el extra del pecho es lo que hace que el cuerpo se incline y
      // las piernas queden atras, que es como se ve alguien empujado.
      const a = ent.mover * 0.34;
      for (const pt of r.puntos) empujar(pt, a * pt.masa, 0);
      empujar(r.p.pecho, ent.mover * 0.5, 0);
      empujar(r.p.cabeza, ent.mover * 0.2, 0);
      r.mirada = ent.mover;
      if (this.t % 3 === 0)
        this.chispa(r.p.cadera.x - ent.mover * 8, r.p.cadera.y + 6, "#8fe3f5", 1, -ent.mover * 2);
    } else {
      r.mirada += (0 - r.mirada) * 0.08;
    }
    const bol = suelto ? 0 : (ent.bolita ? 1 : 0);
    ovillar(r, bol);
    ovillar(t, bol * 0.85);
    t.mirada = Math.max(-1, Math.min(1, (t.p.pecho.x - t.px0 || 0)));
    t.px0 = t.p.pecho.x;

    this.peor = null;
    if (this.espera > 0) this.espera--;
    integrar(this.puntos);
    // Resolver y chocar intercalados. Resolver todo y despues chocar deja al
    // muneco medio hundido en el piso: la ultima palabra la tiene el hueso, y
    // el hueso no sabe que abajo hay una repisa. Tres rondas cortas alcanzan.
    // EL CUADRO TERMINA CON LOS HUESOS ENTEROS. Antes las aspas y la ultima
    // ronda de choques movian puntos DESPUES del ultimo resolver, y el cuadro
    // quedaba dibujado con los huesos violados —medido, hasta 41% de
    // diferencia— aunque el cuadro siguiente lo arreglara. Ahora todo lo que
    // mueve puntos pasa adentro del bucle y afuera queda un resolver final. A
    // cambio, un punto puede terminar uno o dos pixeles adentro de una
    // repisa, que no lo ve nadie.
    this.aspasMover();
    for (let k = 0; k < 3; k++) {
      resolver(this.palos, 2);
      for (const p of this.puntos) this.chocarPunto(p);
      this.aspasChocar();
    }
    // SIETE VUELTAS AL FINAL, y el numero se midio. Con cinco, la canilla de
    // Rilo —que es larga y liviana— se estiraba 23% cuando le pegaban en el
    // pie; con siete baja a 14% y no cuesta un microsegundo mas, porque lo
    // caro del cuadro son las colisiones, no el solucionador.
    resolver(this.palos, 7);
    this.cobrar();
  }

  chocarPunto(p) {
    const nv = this.nv;
    const w = paredEn(nv.perfil, p.y);
    // La velocidad se saca ANTES de mover el punto. Calculada despues, `p.x -
    // p.px` mezcla la posicion corregida con el pasado viejo y sale un numero
    // que no es la velocidad de nada: el punto salia disparado de la pared y
    // de ahi venian estirones de hueso del 50%.
    if (p.x - p.radio < w.izq || p.x + p.radio > w.der) {
      const vx = p.x - p.px, vy = p.y - p.py;
      const v = Math.hypot(vx, vy);
      p.x = p.x - p.radio < w.izq ? w.izq + p.radio : w.der - p.radio;
      p.px = p.x + vx * 0.25;      // rebota poco: la pared no es un resorte
      p.py = p.y - vy * 0.9;       // y frena un poco al raspar
      p.tocando = true; this.pegar(p, v * 0.5);
    }
    for (const o of nv.obst) {
      if (o.t === "aspa") continue;
      if (o.t === "gel") {
        const d = Math.hypot(p.x - o.x, p.y - o.y);
        if (d < o.r + p.radio) {
          // La gelatina no choca: frena. Se le come velocidad y buena parte de
          // la gravedad del cuadro, asi que adentro se cae en camara lenta.
          p.px = p.x - (p.x - p.px) * 0.80;
          p.py = p.y - (p.y - p.py) * 0.74 - G * 0.5;
        }
        continue;
      }
      if (p.y + p.radio < o.y - 2 || p.y - p.radio > o.y + o.al + 2) continue;
      // Las repisas son RESBALOSAS a proposito. Con roce de verdad, un cuerpo
      // caido encima tarda cinco segundos en arrastrarse cien pixeles y el
      // juego se detiene; ademas este no es un juego de pararse en las
      // plataformas, es uno de pasarlas de largo. Ojo que el roce se aplica
      // una vez por ronda de colision, tres veces por cuadro: 0,93 al cubo es
      // 0,80, que es el roce real por cuadro.
      const opc = o.t === "resorte" ? { rebote: 1.22, roce: 0.95 } : { roce: 0.93 };
      const v = contraCaja(p, o.x, o.y, o.an, o.al, opc);
      if (!v) continue;
      if (o.t === "pincho") { this.pegar(p, v, 13); if (this.ev) this.ev.pincho = true; }
      else if (o.t === "resorte") {
        if (v > 4) { this.chispa(p.x, p.y, "#7dffb0", 3, -2); if (this.ev) this.ev.resorte = true; }
      }
      else this.pegar(p, v);
    }
  }

  /** Girar las aspas: UNA vez por cuadro, aunque la fisica corra tres rondas. */
  aspasMover() {
    for (const o of this.nv.obst) {
      if (o.t !== "aspa") continue;
      const a = o.fase + this.t * o.vel;
      o.ax = o.x + Math.cos(a) * o.largo; o.ay = o.y + Math.sin(a) * o.largo;
      o.bx = o.x - Math.cos(a) * o.largo; o.by = o.y - Math.sin(a) * o.largo;
    }
  }

  aspasChocar() {
    for (const o of this.nv.obst) {
      if (o.t !== "aspa" || o.ax === undefined) continue;
      for (const p of this.puntos) {
        if (Math.abs(p.y - o.y) > o.largo + 20) continue;
        const v = contraSegmento(p, o.ax, o.ay, o.bx, o.by, o.grosor,
                                 { empuje: Math.abs(o.vel) * o.largo * 0.9, roce: 0.6 });
        if (v) this.pegar(p, v, 6);
      }
    }
  }

  /**
   * Anotar un golpe. NO cobra: solo se queda con el peor del cuadro.
   *
   * La cabeza cuesta casi el doble que el cuerpo y un pie casi nada, asi que
   * caer parado es barato y caer de cabeza es caro — que es la unica razon
   * por la que vale la pena aprender a acomodarse en el aire.
   */
  pegar(p, v, extra = 0) {
    if (this.estado !== "jugando") return;
    if (v < UMBRAL && !extra) return;
    const parte = p.nombre === "cabeza" ? 1.7 : p.nombre.startsWith("pie") ? 0.5 : 1;
    const d = (Math.max(0, v - UMBRAL) * 2.6 + extra) * parte;
    if (!this.peor || d > this.peor.d) this.peor = { d, v, p, extra };
  }

  /**
   * Cobrar el peor golpe del cuadro.
   *
   * Hacerse bolita descuenta dos tercios, y no es un escudo: es que once
   * puntos apretados llegan todos juntos en vez de clavar la cabeza sola, asi
   * que el golpe se reparte. Igual se paga, porque llegar rapido cuesta.
   */
  cobrar() {
    const g = this.peor;
    if (!g || this.espera > 0) return;
    const bol = Math.max(0, this.rilo.bolita);
    const d = g.d * (1 - bol * 0.66);
    if (d < 0.6) return;
    this.espera = ESPERA;
    this.integridad -= d;
    if (this.ev) this.ev.golpe = Math.max(this.ev.golpe, g.v);
    this.sacude = Math.min(12, this.sacude + d * 0.4);
    this.chispa(g.p.x, g.p.y, g.extra ? "#ff6b6b" : "#ffd447", Math.min(8, 2 + d * 0.35));
  }

  chispa(x, y, color, n = 3, vx0 = 0) {
    for (let i = 0; i < n; i++)
      this.chispas.push({ x, y, vx: vx0 + (Math.random() - 0.5) * 3,
                          vy: (Math.random() - 0.7) * 2.4, color, vida: 16 + Math.random() * 14 });
  }

  portales(c) {
    for (const po of this.nv.portales) {
      // La zona es un rectangulo y no un circulo: se entra cayendo a siete
      // pixeles por cuadro, asi que la ventana de altura tiene que durar
      // varios cuadros o el portal se puede atravesar entre dos posiciones.
      if (po.usado) continue;
      if (Math.abs(c.x - po.x) > po.r + 8 || Math.abs(c.y - po.y) > 34) continue;
      po.usado = true;
      this.sacude = 6;
      this.chispa(po.x, po.y, "#8fe3f5", 16);
      if (this.ev) this.ev.portal = true;
      if (po.ultimo) { this.estado = "gano"; if (this.ev) this.ev.gano = true; return; }
      if (this.ev) this.ev.capitulo = po.cap + 1;
      this.desdeCap = po.cap + 1;
      this.integridad = Math.min(100, this.integridad + 26);
      const sig = this.nv.caps[po.cap + 1];
      this.decir(sig.dice, sig.nombre, `c${po.cap + 1}`);
    }
  }

  juntar() {
    for (const p of this.puntos) {
      for (const ch of this.nv.chatarra) {
        if (ch.tomada || Math.abs(ch.y - p.y) > 14 || Math.abs(ch.x - p.x) > 14) continue;
        ch.tomada = true;
        if (this.ev) this.ev.chatarra++;
        this.chispa(ch.x, ch.y, "#7dffb0", 6);
      }
    }
  }

  get juntada() { return this.nv.chatarra.filter((c) => c.tomada).length; }
  get metros() { return Math.max(0, Math.round(this.prof / 100)); }
  get total() { return Math.round(this.nv.alto / 100); }
  get capitulo() { return capituloEn(this.nv, this.marca); }
}
