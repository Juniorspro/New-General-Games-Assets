// La partida: el péndulo, el gancho y la caída.
//
// NO HAY MOTOR DE FISICA. Hay un punto con velocidad y, cuando el gancho está
// clavado, una restricción de distancia. Es a propósito: el juego entero es
// predecir por dónde vas a salir cuando sueltes, y eso sólo funciona si la
// física es exactamente la misma cada vez. Un motor genérico con resolución
// iterativa devuelve trayectorias que dependen del orden en que resolvió los
// contactos — parecido no alcanza.

import { F, ANCHO, VISTA, M, limitar } from "./mundo.js";
import { Torre } from "./torre.js";

export const PARED = 12;             // dónde empieza la pared dibujada
const INVUL = 30;

export class Partida {
  constructor(semilla) {
    this.torre = new Torre(semilla);
    this.x = ANCHO / 2;
    this.y = 0;
    this.vx = 0;
    this.vy = -3.2;                  // un empujoncito inicial hacia arriba
    this.ancla = null;               // la argolla enganchada
    this.largo = 0;
    this.tuercas = 0;
    this.estado = "trepando";        // trepando | muerto
    this.alto = 0;                   // el punto más alto alcanzado, en píxeles
    this.t = 0;
    this.cuenta = 0;
    this.invul = INVUL;
    this.cam = 0;
    this.sube = 0;
    this.sacude = 0;
    this.chispas = [];
    this.ev = {};
    this.torre.generarHasta(-VISTA.alto * 3);
  }

  get metros() { return M(this.alto); }
  get puntaje() { return this.metros + this.tuercas * 8; }
  get enganchado() { return !!this.ancla; }

  /**
   * Un cuadro.
   *
   * `ent.dedo` es null si no hay dedo, o {x, y} en coordenadas del mundo. El
   * gancho se clava mientras haya dedo y se suelta cuando no lo hay: es un
   * resorte, no un interruptor, y por eso el gesto que cuesta (mantener) es el
   * que da altura.
   */
  paso(ent) {
    this.t++;
    this.ev = { engancha: false, suelta: false, tuerca: 0, pared: false,
                rompe: false, muerto: false };
    if (this.sacude > 0) this.sacude *= 0.86;
    if (this.invul > 0) this.invul--;
    for (const c of this.chispas) { c.x += c.vx; c.y += c.vy; c.vy += 0.22; c.vida--; }
    this.chispas = this.chispas.filter((c) => c.vida > 0);

    if (this.estado === "muerto") { this.cuenta++; this.caerMuerto(); return; }

    this.gancho(ent);
    this.mover();
    this.paredes();
    this.juntar();

    this.torre.generarHasta(this.y - VISTA.alto * 3);
    this.torre.limpiar(this.y);

    if (-this.y > this.alto) this.alto = -this.y;

    // LA CAMARA NO BAJA NUNCA, y eso no es un detalle de presentación: es la
    // regla que termina la partida. Mientras subís te sigue; cuando caés se
    // queda, y el borde de abajo de la pantalla es la muerte. Sin eso el juego
    // no tendría final y una caída larga sería gratis.
    // EL BICHO VA AL 42% DE LA PANTALLA, no abajo de todo. Poniéndolo abajo se
    // ve más torre por delante, que es lo que uno querría en un juego de trepar
    // — pero entonces el margen para caerse son doscientos ochenta píxeles, y
    // un péndulo de soga larga baja ciento setenta en un solo arco: se moría de
    // fallas que no eran fallas. Arriba del 42% se ven dos argollas por
    // delante, que es todo lo que hace falta, y abajo queda pantalla de sobra
    // para equivocarse una vez. La línea de muerte es el BORDE DE ABAJO: lo que
    // te mata se ve.
    const quiere = this.y - VISTA.alto * 0.42;
    if (quiere < this.cam) this.cam += (quiere - this.cam) * 0.12;
    // Y a partir de cierta altura sube SOLA, cada vez más rápido. Es lo que
    // convierte "no caerse" en "no demorarse": sin eso, colgarse de una argolla
    // buena y hamacarse tranquilo es una estrategia ganadora y aburrida.
    // Y ARRANCA POR ALTURA O POR TIEMPO, lo que pase primero. Sólo por altura,
    // el que se queda hamacándose abajo del corte no se muere nunca: el
    // validador encontró una torre donde el robot se trababa a diez metros y
    // seguía vivo a los cinco minutos. Un juego sin fin tiene que terminar.
    if (this.alto > F.SUBE_DESDE || this.t > F.SUBE_TIEMPO) {
      const v = Math.min(F.SUBE_MAX,
                         F.SUBE_VEL * (1 + Math.max(this.alto - F.SUBE_DESDE, 0) / 9000));
      this.cam -= v;
      this.sube = v;
    }
    if (this.y > this.cam + VISTA.alto + 40) this.morir();
  }

  // --- el gancho ---------------------------------------------------------
  gancho(ent) {
    const d = ent && ent.dedo;
    if (!d) {
      if (this.ancla) { this.ancla = null; this.ev.suelta = true; }
      return;
    }
    if (!this.ancla) {
      // SE APUNTA CON EL DEDO, no con el personaje. Enganchar siempre a la más
      // cercana al cuerpo convertiría el juego en un solo botón; con dos
      // argollas al alcance, cuál agarrás es la decisión.
      const a = this.torre.masCerca(d.x, d.y, 999) || null;
      if (!a) return;
      const dist = Math.hypot(a.x - this.x, a.y - this.y);
      if (dist > F.ALCANCE) return;
      this.ancla = a;
      // El largo es la distancia QUE YA HABIA. Fijar un largo nominal daría un
      // tirón en el momento de enganchar, y un tirón que el jugador no pidió es
      // exactamente lo que rompe la confianza en un juego de precisión.
      this.largo = Math.max(F.LARGO_MIN, dist);
      a.tocada = this.t;
      this.ev.engancha = true;
    }
    const a = this.ancla;
    if (a.oxidada && this.t - a.tocada > F.VIDA_OXIDADA) {
      a.rota = true; this.ancla = null;
      this.ev.rompe = true; this.sacude = 6;
      this.chispear(a.x, a.y, "#c9762f", 10);
      return;
    }
    // HAMACARSE. El dedo, mientras estés colgado, ya no apunta: empuja. Cuanto
    // más lejos del cuerpo lo pongas, más fuerte, hasta un tope. La soga se
    // queda con la parte del empuje que va en su dirección (la proyección de
    // más abajo), así que lo único que sobrevive es lo tangencial: exactamente
    // lo que pasa cuando estirás las piernas en una hamaca.
    this.vx += limitar((d.x - this.x) / 50, -1, 1) * F.EMPUJE;

  }

  mover() {
    this.vy += F.GRAVEDAD;
    this.x += this.vx;
    this.y += this.vy;

    if (this.ancla) {
      const a = this.ancla;
      let dx = this.x - a.x, dy = this.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > this.largo) {
        // La soga TIRA PERO NO EMPUJA: sólo corrige cuando está estirada. Si
        // corrigiera siempre, sería una barra rígida y el bicho podría quedar
        // parado arriba de la argolla, que es ridículo y además gratis.
        const k = this.largo / d;
        this.x = a.x + dx * k;
        this.y = a.y + dy * k;
        // Y la velocidad se proyecta sobre la TANGENTE: lo que iba en la
        // dirección de la soga se pierde en el tirón. Sin esto el péndulo gana
        // energía sola en cada corrección y termina dando vueltas enteras.
        const nx = dx / d, ny = dy / d;
        const radial = this.vx * nx + this.vy * ny;
        if (radial > 0) { this.vx -= radial * nx; this.vy -= radial * ny; }
      }
      this.vx *= F.ROCE_SOGA; this.vy *= F.ROCE_SOGA;
    } else {
      this.vx *= F.ROCE_AIRE; this.vy *= F.ROCE_AIRE;
    }

    const v = Math.hypot(this.vx, this.vy);
    if (v > F.VEL_MAX) { this.vx = this.vx / v * F.VEL_MAX; this.vy = this.vy / v * F.VEL_MAX; }
  }

  paredes() {
    const r = F.BICHO;
    if (this.x - r < PARED) {
      this.x = PARED + r; this.vx = Math.abs(this.vx) * 0.45;
      this.ev.pared = true; this.sacude = 3;
    } else if (this.x + r > ANCHO - PARED) {
      this.x = ANCHO - PARED - r; this.vx = -Math.abs(this.vx) * 0.45;
      this.ev.pared = true; this.sacude = 3;
    }
  }

  juntar() {
    for (const t of this.torre.tuercas) {
      if (t.tomada) continue;
      if ((t.x - this.x) ** 2 + (t.y - this.y) ** 2 < 22 * 22) {
        t.tomada = true; this.tuercas++; this.ev.tuerca++;
        this.chispear(t.x, t.y, "#ffd84a", 7);
      }
    }
  }

  morir() {
    if (this.estado === "muerto") return;
    this.estado = "muerto";
    this.ancla = null;
    this.ev.muerto = true;
    this.sacude = 12;
    this.chispear(this.x, this.y, "#ff6b6b", 16);
  }

  caerMuerto() {
    this.vy += F.GRAVEDAD;
    this.x += this.vx; this.y += this.vy;
    this.vx *= 0.99;
  }

  chispear(x, y, color, n) {
    for (let i = 0; i < n; i++)
      this.chispas.push({ x, y, vx: (Math.random() - 0.5) * 5,
                          vy: (Math.random() - 0.5) * 5 - 1,
                          color, vida: 22 + Math.random() * 16 });
  }
}

export { limitar };
