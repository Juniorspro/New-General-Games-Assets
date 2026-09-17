// La partida: la caida, los choques y el puntaje.
//
// No hay motor de fisica ni ragdoll: hay UN punto con velocidad y dos cajas
// colgadas de el. Es a proposito. Este juego se gana pasando por huecos de
// veintidos pixeles cayendo a trece por cuadro, y para eso la caja de choque
// tiene que ser exacta y predecible — un muneco articulado que a veces mete un
// codo de mas convierte la precision en loteria.

import { F, M, mezcla, VISTA } from "./mundo.js";
import { Pozo, TIPOS } from "./pozo.js";

const ANCHO = 360, BORDE = 10;
const GRUESO_VIGA = 14;
const CAIDA_CUERPO = 26;        // cuanto cuelga el cuerpo debajo del paraguas
const INVULNERABLE = 42;

export class Partida {
  constructor(semilla) {
    this.pozo = new Pozo(semilla ?? (Math.random() * 1e9) | 0);
    this.x = ANCHO / 2;
    this.y = 0;
    this.vx = 0;
    this.vy = 2;
    this.abierto = 1;             // 0 cerrado, 1 abierto
    this.objetivo = 1;
    this.varillas = F.VARILLAS;
    this.monedas = 0;
    this.roces = 0;
    this.estado = "cayendo";      // cayendo | muerto
    this.cuenta = 0;
    this.invul = 0;
    this.t = 0;
    this.sacude = 0;
    this.chispas = [];
    this.cam = 0;
    this.pasadas = new Set();
    this.golpeParaguas = 0;       // cuadros que le quedan al fogonazo
    this.avisadas = new Set();    // filas angostas ya avisadas
    this.ev = {};
  }

  get anchoParaguas() { return mezcla(F.ANCHO_CERRADO, F.ANCHO_ABIERTO, this.abierto); }
  get metros() { return M(this.y); }
  /** La velocidad de caida a la que tiende ahora mismo. */
  get terminal() { return mezcla(F.TERMINAL_CERRADO, F.TERMINAL_ABIERTO, this.abierto); }

  cajas(y = this.y) {
    const w = this.anchoParaguas;
    return [
      { x0: this.x - w / 2, x1: this.x + w / 2, y0: y - F.ALTO_PARAGUAS / 2, y1: y + F.ALTO_PARAGUAS / 2 },
      { x0: this.x - F.CUERPO_AN / 2, x1: this.x + F.CUERPO_AN / 2,
        y0: y + CAIDA_CUERPO - F.CUERPO_AL / 2, y1: y + CAIDA_CUERPO + F.CUERPO_AL / 2 },
    ];
  }

  paso(ent) {
    this.t++;
    this.ev = { golpe: false, pinchos: false, moneda: 0, roce: false,
                muerto: false, paraguas: false, angosto: false };
    if (this.sacude > 0) this.sacude *= 0.87;
    for (const c of this.chispas) { c.x += c.vx; c.y += c.vy; c.vy += 0.16; c.vida--; }
    this.chispas = this.chispas.filter((c) => c.vida > 0);

    if (this.estado === "muerto") { this.cuenta++; this.caerMuerto(); return; }
    if (this.invul > 0) this.invul--;

    // EL PARAGUAS. `ent.cerrar` es el dedo apoyado: apretado cierra, suelto
    // abre. No es un boton que alterna — es un resorte, y por eso el gesto
    // natural (mantener) es el que cuesta.
    const antes = this.objetivo;
    this.objetivo = ent.cerrar ? 0 : 1;
    if (antes !== this.objetivo) { this.ev.paraguas = true; this.golpeParaguas = 12; }
    if (this.golpeParaguas > 0) this.golpeParaguas--;
    this.abierto += (this.objetivo - this.abierto) * F.VEL_PARAGUAS;
    if (Math.abs(this.abierto - this.objetivo) < 0.004) this.abierto = this.objetivo;

    // De costado: el dedo dice adonde, y el paraguas cuanto se puede.
    //
    // SIN DEDO NO SE FRENA, SE PLANEA. Soltando, la velocidad de costado se
    // apaga muy de a poco en vez de irse a cero, y eso es lo que hace que el
    // control funcione: el dedo cierra el paraguas, asi que si soltar cortara
    // el envion tambien, no habria forma de corregir cayendo lento. Se apunta
    // apretando —cerrando— y se suelta para llegar planeando.
    //
    // Y UN TOQUE CORTO APUNTA SIN CERRAR. El paraguas tarda nueve cuadros en
    // cerrarse: un toque de tres no lo cierra casi nada y en cambio da toda la
    // maniobrabilidad del paraguas abierto, que es la buena. De ahi sale solo
    // el gesto del juego: toquecitos para acomodarse, apreton largo para
    // bajar.
    const vmax = mezcla(F.VX_CERRADO, F.VX_ABIERTO, this.abierto);
    const reaccion = mezcla(F.REACCION_CERRADO, F.REACCION_ABIERTO, this.abierto);
    if (ent.mover === null || ent.mover === undefined) this.vx *= 0.985;
    else this.vx += (ent.mover * vmax - this.vx) * reaccion;

    // La caida tiende a su terminal en vez de acelerar sin fin: es lo que hace
    // que abrir el paraguas FRENE de verdad y no solo acelere menos.
    this.vy += (this.terminal - this.vy) * F.ROCE + F.GRAVEDAD * 0.12;
    if (this.vy > F.TERMINAL_CERRADO) this.vy = F.TERMINAL_CERRADO;

    // EL AVISO DE FILA ANGOSTA SUENA UNA VEZ Y TEMPRANO: cuando la fila entra en
    // el alcance del ojo, no cuando se cruza. Un aviso que llega cuando ya
    // estás adentro no es un aviso.
    const prox = this.pozo.siguiente(this.y + 12);
    if (prox && prox.angosto && prox.y - this.y < 330 && !this.avisadas.has(prox.y)) {
      this.avisadas.add(prox.y);
      this.ev.angosto = true;
    }

    this.mover();
    this.pozo.generarHasta(this.y + VISTA.alto * 2);
    this.pozo.limpiar(this.y);
    this.juntar();

    // La camara mira mas abajo cuanto mas rapido se cae: a trece por cuadro,
    // ver lo mismo que a cuatro es no ver nada.
    const mira = mezcla(0.30, 0.16, this.abierto);
    this.cam += ((this.y - VISTA.alto * mira) - this.cam) * 0.16;
  }

  /**
   * Avanzar en pasos chicos.
   *
   * A trece pixeles por cuadro contra una viga de catorce de grueso, un solo
   * paso de integracion la atraviesa entera algunas veces y otras no, segun
   * donde caiga el cuadro: se pasa de largo por una viga solida y se muere
   * contra otra igual. En pasos de cuatro pixeles eso no puede pasar.
   */
  mover() {
    const pasos = Math.max(1, Math.ceil(this.vy / 4));
    for (let i = 0; i < pasos && this.estado === "cayendo"; i++) {
      this.x += this.vx / pasos;
      this.y += this.vy / pasos;
      const w = this.anchoParaguas / 2;
      // Las paredes no lastiman: frenan. Un pozo que te mata por rozar el
      // costado castiga el unico movimiento que el juego te pide hacer.
      if (this.x - w < BORDE) { this.x = BORDE + w; this.vx *= -0.2; }
      if (this.x + w > ANCHO - BORDE) { this.x = ANCHO - BORDE - w; this.vx *= -0.2; }
      this.chocar();
    }
  }

  chocar() {
    for (const f of this.pozo.filas) {
      if (f.y < this.y - 80 || f.y > this.y + 80) continue;
      const vy0 = f.y - GRUESO_VIGA / 2, vy1 = f.y + GRUESO_VIGA / 2;
      const hx0 = f.x - f.hueco / 2, hx1 = f.x + f.hueco / 2;
      let pego = false;
      for (const c of this.cajas()) {
        if (c.y1 < vy0 || c.y0 > vy1) continue;
        if (c.x0 >= hx0 && c.x1 <= hx1) continue;   // entero dentro del hueco
        pego = true; break;
      }
      if (pego) { this.golpe(f); return; }
      // Pasada limpia: se anota, y si fue al ras se paga mejor.
      if (!this.pasadas.has(f.n) && this.y > f.y + 6) {
        this.pasadas.add(f.n);
        const luz = Math.min(this.x - this.anchoParaguas / 2 - hx0,
                             hx1 - (this.x + this.anchoParaguas / 2));
        if (luz < 7) {
          this.roces++; this.ev.roce = true;
          this.chispa(this.x, f.y, "#ffd447", 6);
        }
      }
    }
  }

  golpe(f) {
    if (this.invul > 0) return;
    if (f.tipo === TIPOS.PINCHOS) {
      this.ev.pinchos = true;
      this.chispa(this.x, f.y, "#ff6b6b", 14);
      return this.morir();
    }
    this.varillas--;
    this.invul = INVULNERABLE;
    this.sacude = 11;
    this.ev.golpe = true;
    this.chispa(this.x, f.y, "#ffd447", 12);
    // Rebota para arriba y para el lado del hueco: un golpe que te deja pegado
    // contra la viga te saca las tres varillas de una y no se entiende por que.
    this.y = f.y - GRUESO_VIGA / 2 - F.ALTO_PARAGUAS;
    this.vy = -2.2;
    this.vx = (f.x > this.x ? 1 : -1) * 2.4;
    if (this.varillas <= 0) this.morir();
  }

  morir() {
    if (this.estado === "muerto") return;
    this.estado = "muerto";
    this.cuenta = 0;
    this.sacude = 14;
    this.ev.muerto = true;
  }

  /** Despues de morir se sigue cayendo, sin chocar: que se vea el final. */
  caerMuerto() {
    this.vy += 0.5;
    this.y += Math.min(this.vy, 18);
    this.x += this.vx;
    this.vx *= 0.99;
    this.cam += ((this.y - VISTA.alto * 0.3) - this.cam) * 0.1;
  }

  juntar() {
    for (const m of this.pozo.monedas) {
      if (m.tomada || Math.abs(m.y - (this.y + 10)) > 22) continue;
      if (Math.abs(m.x - this.x) > 18) continue;
      m.tomada = true; this.monedas++; this.ev.moneda++;
      this.chispa(m.x, m.y, "#ffe14a", 5);
    }
  }

  chispa(x, y, color, n) {
    for (let i = 0; i < n; i++)
      this.chispas.push({ x, y, vx: (Math.random() - 0.5) * 4,
                          vy: (Math.random() - 0.5) * 4 - 1, color,
                          vida: 14 + Math.random() * 16 });
  }

  /** El puntaje: los metros mandan, lo demas suma. */
  get puntaje() { return this.metros + this.monedas * 5 + this.roces * 10; }
}
