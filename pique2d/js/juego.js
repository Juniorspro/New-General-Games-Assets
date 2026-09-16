// Una partida: un nivel corriendo.
//
// Junta la fisica, los enemigos, el dibujo y el sonido. La regla que ordena
// todo el archivo es que el ESTADO vive aca y el dibujo no decide nada: se
// puede correr una partida entera sin canvas (asi la prueban las pruebas).

import { T, V, F, TEMAS, ALTO_TILES, VISTA, ALTOS } from "./mundo.js";
import { nuevoJugador, paso, tileXY, sumarCombo } from "./fisica.js";
import * as E from "./entidades.js";
import * as D from "./dibujo.js";
import { dibujarCuadro, cuadroDe } from "./sprites.js";
import { efe, musica, pararMusica, latirMusica } from "./audio.js";

export const ESTADO = { JUGANDO: "jugando", BURBUJA: "burbuja", MASTIL: "mastil",
                        ESCENA: "escena", GANADO: "ganado", PERDIDO: "perdido" };

// Los tres tamanos y lo que dibuja cada uno.
//
// LA CAJA DE COLISION NO CAMBIA NUNCA, Y ES A PROPOSITO. El validador
// demuestra que cada nivel se puede terminar simulando un jugador de 11x15
// pixeles; si al agarrar un hongo la caja creciera, un pasaje de un tile que
// el validador cruzo dejaria de pasar y el nivel validado seria imposible. Lo
// que crece es el DIBUJO. El premio de ser grande es aguantar un golpe y
// —de gigante— arrasar con lo que se cruce, que se siente mas que ocupar mas
// lugar, y no le miente al jugador sobre por donde entra.
const ESCALA = [1, 1.45, 2.7];
const ESCENA_CUADROS = 200;      // lo que dura la escena del hongo gigante
const GIGANTE_CUADROS = 540;     // nueve segundos de gigante
const GIRO_CUADROS = 12;         // el pivote al darse vuelta

export class Partida {
  constructor(nv, tier, hojas = {}, patron = null, capas = {}) {
    this.capas = capas;
    this.hojas = hojas;
    this.patron = patron;
    this.nv = nv;
    this.tier = tier;
    this.j = nuevoJugador(nv.inicio.x, nv.inicio.y);
    this.bichos = nv.enemigos.map((e) => E.crear(e.tipo, e.tx, e.ty));
    this.part = [];
    this.camX = 0; this.camY = 0;
    this.t = 0;
    // Animaciones puntuales de tiles: clave -> cuadro en que empezo. Un bloque
    // golpeado o un resorte pisado tienen que MOVERSE; sin eso el jugador no
    // sabe si el golpe conto.
    this.animTiles = new Map();
    this.monedas = 0;
    this.color = nv.monedasColor.map((m) => ({ ...m, tomada: false }));
    this.burbujas = 2;             // igual que el original: dos, y despues se pierde
    this.estado = ESTADO.JUGANDO;
    this.segundos = nv.segundos;
    this.reloj = nv.segundos * 60;
    this.relojCorre = true;
    this.mastilAltura = 0;
    this.sacudida = 0;
    this.burbujaT = 0;
    this.jefe = null;
    this.jefeVivo = false;
    // --- hongos y tamano ---
    this.tam = 0;                  // 0 chico · 1 grande · 2 gigante
    this.escalaAct = 1;            // el dibujo persigue al tamano, no salta
    this.gigT = 0;                 // cuadros que le quedan de gigante
    this.invT = 0;                 // invulnerable despues de achicarse
    this.hongos = [];              // los que salieron de un bloque y vuelan
    this.escena = null;            // la escena del hongo gigante
    this.giroT = 0; this.giroDe = 1;
    this.dirPrev = this.j.dir;
    this.pasoGig = 0;
    if (nv.cfg.jefe) this.crearJefe(nv.cfg.jefe);
    musica(nv.tema, nv.mastilX * 7919);
  }

  crearJefe(tipo) {
    const x = (this.nv.mastilX - 12) * T;
    this.jefe = {
      tipo, x, y: this.nv.pisoMastil * T, vx: -0.9, vy: 0,
      w: 30, h: 30, vida: tipo === "bowser" ? 4 : 3, invuln: 0, t: 0, suelo: false,
    };
    this.jefeVivo = true;
  }

  // ---------------------------------------------------------------------
  actualizar(ent) {
    this.t++;
    latirMusica();
    if (this.sacudida > 0) this.sacudida--;
    for (let i = this.part.length - 1; i >= 0; i--) {
      const p = this.part[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g ?? 0.18;
      if (--p.vida <= 0) this.part.splice(i, 1);
    }

    if (this.estado === ESTADO.ESCENA) return this.pasoEscena();
    if (this.estado === ESTADO.BURBUJA) return this.pasoBurbuja(ent);
    if (this.estado === ESTADO.MASTIL) return this.pasoMastil();
    if (this.estado !== ESTADO.JUGANDO) return;

    // El reloj se frena parado en un bloque de pausa. Es la unica pausa real
    // del juego y por eso el bloque vale como acertijo.
    this.relojCorre = !this.j.frenado;
    if (this.relojCorre && --this.reloj <= 0) return this.perder("tiempo");
    if (this.reloj === 600) efe.apuro();
    if (this.reloj < 600 && this.reloj % 60 === 0) efe.apuro();

    if (this.invT > 0) this.invT--;
    if (this.giroT > 0) this.giroT--;
    // El gigante arrasa ANTES de que corra la fisica: si se dejara para
    // despues, el cuadro en que toca un ladrillo lo frena la pared y recien
    // al siguiente lo rompe. Se veria trabarse contra cada bloque.
    if (this.tam === 2) this.arrasar();

    const ev = {};
    paso(this.j, this.nv, ent, ev);
    this.sonarEventos(ev);
    // Darse vuelta dispara el pivote. Se mira el cambio de `dir` y no un
    // evento concreto porque hay tres formas de darse vuelta —pared, salto de
    // pared y el rebote del muro del jefe— y las tres tienen que girar igual.
    if (this.j.dir !== this.dirPrev) { this.giroT = GIRO_CUADROS; this.giroDe = this.dirPrev; }
    this.dirPrev = this.j.dir;
    if (ev.cabezazo) this.golpearBloque(ev.cabezazo.tx, ev.cabezazo.ty);
    if (!this.j.vivo) return this.morir(ev.muerte);

    this.recolectar();
    this.hongosPaso();
    this.bichosPaso(ev);
    if (this.jefeVivo) this.jefePaso();

    // El tamano de dibujo persigue al tamano real en vez de saltar de golpe:
    // asi crecer y achicarse se ven, que es la unica senal de que el hongo
    // hizo algo.
    this.escalaAct += ((ESCALA[this.tam] ?? 1) - this.escalaAct) * 0.13;
    if (this.tam === 2 && --this.gigT <= 0) this.terminarGigante();

    // El mastil: se toca y termina. La altura define el premio.
    const tx = Math.floor(this.j.x / T);
    if (tx >= this.nv.mastilX && !this.jefeVivo) {
      const suelo = this.nv.pisoMastil * T;
      const alto = Math.max(0, suelo - this.j.y);
      this.mastilAltura = Math.min(1, alto / (10 * T));
      this.estado = ESTADO.MASTIL;
      this.mastilY = this.j.y;
      pararMusica(); efe.mastil();
    }

    this.camara();
  }

  // Traduce los eventos del cuadro a sonido y particulas. Esta separado de la
  // fisica a proposito: la fisica corre tambien dentro del validador, donde no
  // hay ni audio ni canvas.
  sonarEventos(ev) {
    const j = this.j;
    if (ev.salto) efe.salto();
    if (ev.vaultSalto) { efe.saltoAlto(); this.chispas(j.x, j.y, "#ffe08a", 5); }
    if (ev.vault || ev.vaultHueco) efe.vault();
    if (ev.saltoPared) {
      efe.paredazo();
      this.chispas(j.x + (j.dir > 0 ? -6 : 6), j.y - 8, "#ffffff", 6);
    }
    if (ev.darVuelta) { efe.vault(); this.chispas(j.x, j.y - 8, "#ffffff", 5); }
    if (ev.salto2) { efe.salto(); this.chispas(j.x, j.y - 6, "#8ad8ff", 7); }
    if (ev.salto3) {
      efe.saltoAlto();
      this.chispas(j.x, j.y - 6, "#ffe08a", 10);
      this.texto(j.x, j.y - 24, "¡triple!", "#ffd447");
    }
    if (ev.resorte) efe.resorte();
    if (ev.saltoLargo) { efe.resorte(); this.texto(j.x, j.y - 22, "¡largo!", "#6aa8f0"); }
    if (ev.voltereta) { efe.saltoAlto(); this.texto(j.x, j.y - 22, "¡arriba!", "#d28ae8"); }
    if (ev.pausa) efe.pausa();
    if (ev.despausa) efe.pausa();
    if (ev.tobogan && this.t % 6 === 0) this.chispas(j.x, j.y, "#ffffff", 2);
    if (ev.trepada) this.chispas(j.x, j.y, "#ffffff", 3);
  }

  // --- camara ----------------------------------------------------------
  camara(brusco = false) {
    // El jugador va a un tercio de la pantalla, no al medio: corre siempre
    // para adelante, asi que lo que importa ver es lo que VIENE.
    const objX = this.j.x - VISTA.ancho * 0.30;
    this.camX += (objX - this.camX) * (brusco ? 1 : 0.16);
    this.camX = Math.max(0, Math.min(this.nv.ancho * T - VISTA.ancho, this.camX));
    // En vertical persigue mas suave y con zona muerta: seguir cada salto
    // marea y hace perder la referencia del piso.
    // Mas abajo en la pantalla cuanto mas alta es la vista: parado, el jugador
    // va en el tercio de abajo y arriba queda el cielo, como en el original.
    const frac = VISTA.alto > 300 ? 0.74 : 0.66;
    const objY = this.j.y - VISTA.alto * frac;
    const d = objY - this.camY;
    if (brusco) this.camY = objY;
    else if (Math.abs(d) > 20) this.camY += (d - Math.sign(d) * 20) * 0.12;
    // El minimo puede ser NEGATIVO: si la vista es mas alta que el nivel, la
    // camara sube por encima y se ve cielo. Clavarlo en 0 dejaba el nivel
    // pegado arriba y una franja vacia abajo.
    const minY = Math.min(0, ALTO_TILES * T - VISTA.alto);
    this.camY = Math.max(minY, Math.min(Math.max(minY, ALTO_TILES * T - VISTA.alto), this.camY));
  }

  // --- recolectar -------------------------------------------------------
  recolectar() {
    const j = this.j;
    const tx0 = Math.floor((j.x - F.ANCHO / 2) / T), tx1 = Math.floor((j.x + F.ANCHO / 2) / T);
    const ty0 = Math.floor((j.y - F.ALTO) / T), ty1 = Math.floor((j.y - 1) / T);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++)
        if (tileXY(this.nv, tx, ty) === V.MONEDA) {
          this.nv.grilla[ty * this.nv.ancho + tx] = V.NADA;
          this.monedas++; efe.moneda();
          this.chispas(tx * T + 8, ty * T + 8, "#ffd447", 4);
        }
    for (const m of this.color) {
      if (m.tomada) continue;
      if (Math.abs(j.x - (m.tx * T + 8)) < 13 && Math.abs((j.y - 8) - (m.ty * T + 8)) < 15) {
        m.tomada = true; this.monedas += 10; efe.monedaColor();
        this.texto(m.tx * T + 8, m.ty * T, "+10", "#ff9ad0");
        this.chispas(m.tx * T + 8, m.ty * T + 8, "#ff7ac0", 12);
      }
    }
  }

  // Marca un tile para que se anime una vez: el golpe de un bloque o el
  // pisoton de un resorte. Sin el rebote, el jugador no sabe si conto.
  marcarTile(tx, ty) { this.animTiles.set(`${tx},${ty}`, this.t); }

  golpearBloque(tx, ty) {
    const v = tileXY(this.nv, tx, ty);
    const i = ty * this.nv.ancho + tx;
    this.marcarTile(tx, ty);
    if (v === V.LADRILLO) {
      // Queda RAJADO y solido, no en NADA. Ver el comentario de SOLIDOS en
      // mundo.js: sacar un solido rompe el camino que el validador demostro.
      this.nv.grilla[i] = V.RAJADO; efe.ladrillo();
      this.monedas += 1; this.texto(tx * T + 8, ty * T - 6, "+1", "#ffd447");
      this.chispas(tx * T + 8, ty * T + 8, TEMAS[this.nv.tema].tierra, 8);
      this.sacudida = 4;
    } else if (v === V.PREGUNTA) {
      this.nv.grilla[i] = V.USADO; efe.bloque();
      // QUE SALE DE CADA BLOQUE LO DECIDIO EL GENERADOR, bloque por bloque.
      //
      // Antes lo resolvia una cuenta sobre la posicion en el momento del
      // golpe. Era determinista —el mismo bloque daba siempre lo mismo, que
      // es lo que hace que aprenderse un nivel sirva— pero repartia a ciegas
      // sobre bloques que en la mitad de los niveles no existian. Ahora el
      // generador mira cuantos hay y a cuales se llega, y garantiza los
      // hongos; ver repartirPremios en generador.js. Sigue siendo el mismo
      // premio siempre para el mismo bloque del mismo nivel.
      const premio = this.nv.premios?.[`${tx},${ty}`];
      if (premio === "burbuja" && this.burbujas < 4) {
        this.burbujas++; efe.burbuja(); this.texto(tx * T + 8, ty * T - 6, "burbuja", "#8ad8ff");
      } else if (premio === "super" && this.tam < 2) {
        this.soltarHongo(tx, ty, "super");
      } else if (premio === "hongo" && this.tam < 1) {
        this.soltarHongo(tx, ty, "hongo");
      } else {
        this.monedas += 3; efe.moneda();
        this.texto(tx * T + 8, ty * T - 6, "+3", "#ffd447");
      }
      this.chispas(tx * T + 8, ty * T, "#ffd447", 6);
    } else if (v === V.TIEMPO) {
      this.nv.grilla[i] = V.USADO; efe.reloj();
      const antes = this.reloj;
      this.reloj = Math.min(99 * 60, this.reloj + 10 * 60);
      this.texto(tx * T + 8, ty * T - 6, `+${Math.round((this.reloj - antes) / 60)}s`, "#7fe39c");
    }
  }

  // --- enemigos ---------------------------------------------------------
  bichosPaso(ev) {
    const nuevos = [];
    for (const e of this.bichos) {
      if (!e.vivo) continue;
      if (Math.abs(e.x - this.j.x) > VISTA.ancho * 1.4) continue;  // fuera de vista, quieto
      E.actualizar(e, this.nv, this.j, ev, nuevos);
      if (e.tipo === "caracol" && e.caparazon && e.empujado) {
        const n = E.barrer(e, this.bichos);
        for (let k = 0; k < n; k++) {
          const p = sumarCombo(this.j); this.monedas += p;
          this.texto(e.x, e.y - 20, `+${p}`, "#ffd447"); efe.combo(this.j.combo);
        }
      }
      const res = this.invT > 0 || this.tam === 2 ? null : E.chocar(this.j, e);
      if (res === "pisar") {
        const pago = sumarCombo(this.j);
        this.monedas += pago * E.pisado(e, this.j, nuevos);
        this.j.vy = F.PISADA_REBOTE;
        // Pisar devuelve los saltos de aire: se deja en 1 —como si acabara
        // de saltar del piso— y no en 0, porque en 0 el toque siguiente
        // contaria como salto del suelo estando en el aire.
        this.j.saltos = 1; this.j.flip = 0;
        efe.pisada(); if (this.j.combo > 1) efe.combo(this.j.combo);
        this.texto(e.x, e.y - 22, `+${pago}`, this.j.combo > 2 ? "#ff9ad0" : "#ffd447");
        this.chispas(e.x, e.y - 6, "#ffffff", 5);
        this.sacudida = 3;
      } else if (res === "morir") {
        return this.morir(e.tipo);
      }
    }
    if (nuevos.length) this.bichos.push(...nuevos);
    if (ev.disparo) efe.bloque();
  }

  // --- jefe -------------------------------------------------------------
  jefePaso() {
    const b = this.jefe, j = this.j;
    b.t++;
    if (b.invuln > 0) b.invuln--;
    // Camina de un lado a otro del tramo final. El jugador, que corre solo,
    // rebota contra el muro del fondo y vuelve: por eso la pelea funciona
    // aunque no haya boton para retroceder.
    const izq = (this.nv.mastilX - 18) * T, der = (this.nv.mastilX - 4) * T;
    b.x += b.vx;
    if (b.x < izq) { b.x = izq; b.vx = Math.abs(b.vx); }
    if (b.x > der) { b.x = der; b.vx = -Math.abs(b.vx); }
    b.vy += 0.5;
    b.y = Math.min(b.y + b.vy, this.nv.pisoMastil * T);
    if (b.y >= this.nv.pisoMastil * T) { b.y = this.nv.pisoMastil * T; b.vy = 0; b.suelo = true; }
    if (b.suelo && b.t % (b.tipo === "bowser" ? 90 : 120) === 0) { b.vy = -7.5; b.suelo = false; efe.jefe(); }

    const dx = Math.abs(j.x - b.x), dy = Math.abs((j.y - 8) - (b.y - b.h / 2));
    if (dx < (F.ANCHO + b.w) / 2 && dy < (F.ALTO + b.h) / 2) {
      const cayendo = j.vy > 0.5 && (j.y - b.h * 0.3) < b.y - b.h / 2;
      if (cayendo && b.invuln === 0) {
        b.vida--; b.invuln = 50; j.vy = F.PISADA_REBOTE * 1.2;
        this.sacudida = 12; efe.jefe();
        this.chispas(b.x, b.y - b.h / 2, "#ff8a2a", 14);
        this.texto(b.x, b.y - b.h - 8, b.vida > 0 ? `${b.vida}` : "listo", "#ff9ad0");
        if (b.vida <= 0) {
          this.jefeVivo = false; this.monedas += 25;
          this.chispas(b.x, b.y - 20, "#ffd447", 30);
          this.texto(b.x, b.y - 40, "+25", "#ffd447");
        }
      } else if (b.invuln === 0) return this.morir("jefe");
    }
  }

  // --- burbuja ----------------------------------------------------------
  // No hay vidas. Al morir se entra en una burbuja que vuelve para atras;
  // tocar la pincha y se sigue. Sin burbujas, se perdio el nivel.
  morir(causa) {
    // SER GRANDE SE PAGA CON EL TAMANO, NO CON UNA VIDA.
    //
    // Un golpe estando grande no cuesta una burbuja: cuesta volver a chico, y
    // deja un segundo de invulnerabilidad para salir de donde sea que lo
    // golpearon. Sin ese segundo, el mismo enemigo vuelve a tocar en el
    // cuadro siguiente y el hongo no habria servido para nada.
    //
    // El pozo y el reloj NO se perdonan, y tiene que ser asi: si el tamano
    // salvara tambien de caerse, el juego se quedaria sin ninguna forma de
    // perder y correr con cuidado dejaria de tener sentido.
    if (this.tam > 0 && causa !== "pozo" && causa !== "tiempo" && causa !== "encajado") {
      this.tam = Math.max(0, this.tam - 1);
      if (this.tam < 2) this.gigT = 0;
      this.invT = 72;
      this.j.vivo = true;
      this.j.vy = Math.min(this.j.vy, -3.2);
      this.sacudida = 8;
      efe.achicar();
      this.chispas(this.j.x, this.j.y - 12, "#ffffff", 12);
      this.texto(this.j.x, this.j.y - 30, "¡uf!", "#ffd447");
      return;
    }
    this.causa = causa;
    efe.pinchar();
    this.chispas(this.j.x, this.j.y - 8, "#ff6a6a", 14);
    this.sacudida = 14;
    if (this.burbujas <= 0) return this.perder(causa);
    this.burbujas--;
    this.monedas = Math.max(0, this.monedas - 5);   // se caen cinco monedas
    this.estado = ESTADO.BURBUJA;
    this.burbujaT = 0;
    this.burbX = this.j.x; this.burbY = Math.min(this.j.y - 20, (ALTO_TILES - 4) * T);
    this.j.combo = 0;
  }

  pasoBurbuja(ent) {
    this.burbujaT++;
    this.hongosPaso();
    this.burbX -= 1.5;
    this.burbY += Math.sin(this.burbujaT / 18) * 0.5;
    // Sube hasta quedar en aire libre: pinchar dentro de una pared seria
    // morir de nuevo al instante, que es la peor forma de perder.
    while (this.burbY > 2 * T && this.libre(this.burbX, this.burbY) === false) this.burbY -= T;
    this.camX = Math.max(0, Math.min(this.nv.ancho * T - VISTA.ancho, this.burbX - VISTA.ancho * 0.34));
    const minY2 = Math.min(0, ALTO_TILES * T - VISTA.alto);
    this.camY = Math.max(minY2, Math.min(Math.max(minY2, ALTO_TILES * T - VISTA.alto), this.burbY - VISTA.alto * 0.5));
    const seguro = this.libre(this.burbX, this.burbY);
    // RESCATE. La version anterior hacia `if (!seguro) return;` despues del
    // pinchado automatico: si la burbuja quedaba en un lugar donde `libre()`
    // nunca daba true —pegada a una pared, adentro de un tubo— el jugador se
    // quedaba en la burbuja PARA SIEMPRE. No tiraba error, no mostraba nada:
    // la pantalla quedaba quieta, que desde afuera es un cuelgue.
    //
    // Ahora, pasados cinco segundos, se busca un lugar seguro hacia arriba y
    // hacia atras, y si no aparece ninguno se vuelve a la largada del nivel.
    // Reaparecer al principio es malo; no reaparecer nunca es peor.
    if (this.burbujaT > 300) {
      let x = this.burbX, y = this.burbY, hallado = false;
      for (let intento = 0; intento < 40 && !hallado; intento++) {
        y -= T;
        if (y < 2 * T) { y = (ALTO_TILES - 8) * T; x -= 4 * T; }
        if (x < 2 * T) break;
        if (this.libre(x, y)) hallado = true;
      }
      if (!hallado) { x = this.nv.inicio.x; y = this.nv.inicio.y; }
      this.burbX = x; this.burbY = y;
      efe.burbuja();
      this.j = nuevoJugador(x, y);
      this.estado = ESTADO.JUGANDO;
      return;
    }
    if ((ent.toqueNuevo && seguro && this.burbujaT > 20) || this.burbujaT > 190) {
      if (!seguro) return;
      efe.burbuja();
      this.j = nuevoJugador(this.burbX, this.burbY);
      this.estado = ESTADO.JUGANDO;
    }
  }

  libre(x, y) {
    for (let dy = 0; dy < 2; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const v = tileXY(this.nv, Math.floor(x / T) + dx, Math.floor(y / T) - dy);
        if (v !== V.NADA && v !== V.MONEDA && v !== V.MASTIL) return false;
      }
    return true;
  }

  pasoMastil() {
    this.mastilY += 2.4;
    const suelo = this.nv.pisoMastil * T;
    if (this.mastilY >= suelo) {
      this.mastilY = suelo;
      if (!this.premioDado) {
        this.premioDado = true;
        this.premio = Math.round(this.mastilAltura * 10);
        this.monedas += this.premio;
        this.estado = ESTADO.GANADO;
        efe.ganar();
      }
    }
  }

  perder(causa) {
    this.causa = causa; this.estado = ESTADO.PERDIDO;
    pararMusica(); efe.perder();
  }

  // --- hongos -----------------------------------------------------------
  //
  // EL HONGO VA HACIA EL JUGADOR. En el juego del que sale la idea, el hongo
  // cae y camina, y la mitad de las veces se escapa por un barranco antes de
  // que uno lo alcance. Aca el jugador corre solo y no puede volver: un hongo
  // que se va es un hongo que no se agarra nunca. Sale del bloque, se queda un
  // momento arriba —para que se vea de donde salio— y despues vuela derecho.
  soltarHongo(tx, ty, tipo) {
    this.hongos.push({ tipo, x: tx * T + T / 2, y: ty * T + T / 2, vx: 0, vy: -2.2, t: 0 });
    efe.hongo();
    this.texto(tx * T + 8, ty * T - 8, tipo === "super" ? "¡SUPER!" : "¡hongo!",
               tipo === "super" ? "#ff7ac0" : "#ffd447");
  }

  hongosPaso() {
    // Si el jugador esta en la burbuja, el hongo va hacia la burbuja. Sin
    // esto quedaba flotando quieto en el aire hasta que volviera, y si moria
    // justo despues de romper el bloque, el premio ya ganado se quedaba ahi
    // colgado para siempre.
    const j = this.estado === ESTADO.BURBUJA
      ? { x: this.burbX, y: this.burbY + 10 } : this.j;
    for (let i = this.hongos.length - 1; i >= 0; i--) {
      const h = this.hongos[i];
      h.t++;
      if (h.t < 16) {
        // Sale del bloque y flota: si volara desde el cuadro cero, el jugador
        // no llega a ver de donde salio.
        h.y += h.vy; h.vy += 0.16;
      } else {
        // Persecucion con aceleracion. La velocidad se topa para que no se
        // teletransporte: tiene que VERSE venir.
        const dx = j.x - h.x, dy = (j.y - 10) - h.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const vel = Math.min(7, 1.6 + (h.t - 16) * 0.18);
        h.x += (dx / d) * vel; h.y += (dy / d) * vel;
        if (this.t % 3 === 0)
          this.chispas(h.x, h.y, h.tipo === "super" ? "#ff9ad0" : "#ffe08a", 1);
        if (d < 12) { this.hongos.splice(i, 1); this.tomarHongo(h); continue; }
      }
      // Un hongo que quedo dando vueltas mas de diez segundos se toma solo.
      // Es un premio ya ganado: no se pierde por un caso raro de geometria.
      if (h.t > 600) { this.hongos.splice(i, 1); this.tomarHongo(h); }
    }
  }

  tomarHongo(h) {
    if (h.tipo === "super") {
      // El gigante entra por la escena, no de una. Es lo unico del juego que
      // se mira en vez de jugarse y por eso tiene su propio estado.
      this.estado = ESTADO.ESCENA;
      this.escena = { t: 0 };
      efe.hongoSuper();
      return;
    }
    if (this.tam < 1) {
      this.tam = 1;
      this.chispas(this.j.x, this.j.y - 12, "#ffe08a", 14);
      this.texto(this.j.x, this.j.y - 30, "¡grande!", "#ffd447");
      efe.hongo();
    } else { this.monedas += 5; efe.moneda(); }
  }

  // --- gigante ----------------------------------------------------------
  //
  // ARRASA CON TODO MENOS CON EL PISO, y esa excepcion no es timidez: el
  // camino que el validador demostro se apoya en el terreno solido. Romper
  // ladrillos, bloques y tubos abre camino y no cierra ninguno; romper el
  // piso podria dejar un pozo que no se cruza, en un nivel que se prometio
  // terminable. Lo que se rompe es lo que esta A LA ALTURA DEL CUERPO, que
  // ademas es lo unico que se ve romper.
  arrasar() {
    const j = this.j;
    const ROMPIBLE = new Set([V.LADRILLO, V.RAJADO, V.PREGUNTA, V.USADO,
                              V.TIEMPO, V.PAUSA, V.TUBO, V.LARGO, V.VOLTERETA]);
    const pieTy = Math.floor((j.y - 1) / T);
    let rompio = 0;
    for (let dx = 0; dx <= 1; dx++) {
      const tx = Math.floor((j.x + j.dir * (6 + dx * T)) / T);
      for (let d = 0; d <= 3; d++) {
        const ty = pieTy - d;
        const v = tileXY(this.nv, tx, ty);
        if (!ROMPIBLE.has(v)) continue;
        this.nv.grilla[ty * this.nv.ancho + tx] = V.NADA;
        this.chispas(tx * T + 8, ty * T + 8, TEMAS[this.nv.tema].tierra, 6);
        rompio++;
      }
    }
    if (rompio) { efe.romper(); this.sacudida = Math.max(this.sacudida, 4); }
    // Los bichos que toca se hacen puré. No hace falta pisarlos.
    for (const e of this.bichos) {
      if (!e.vivo) continue;
      if (Math.abs(e.x - j.x) < 26 && Math.abs(e.y - (j.y - 14)) < 34) {
        e.vivo = false;
        this.monedas += 2;
        this.chispas(e.x, e.y - 6, "#ffffff", 8);
        efe.pisada();
      }
    }
    // Los pasos: lentos, pesados y con temblor. Es lo unico que hace que un
    // sprite mas grande se sienta mas grande.
    if (j.suelo && ++this.pasoGig >= 22) {
      this.pasoGig = 0;
      efe.pisoton();
      this.sacudida = Math.max(this.sacudida, 7);
      for (let i = 0; i < 6; i++)
        this.part.push({ tipo: "chispa", x: j.x + (Math.random() - 0.5) * 30, y: j.y,
          r: 2 + Math.random() * 3, col: "#e8e2d4", g: 0.06,
          vx: (Math.random() - 0.5) * 2.2, vy: -Math.random() * 1.6,
          vida: 26, total: 26 });
    }
  }

  terminarGigante() {
    this.tam = 1; this.gigT = 0; this.invT = 60;
    this.chispas(this.j.x, this.j.y - 16, "#ffffff", 16);
    efe.achicar();
  }

  // --- la escena del hongo gigante --------------------------------------
  pasoEscena() {
    const es = this.escena;
    es.t++;
    if (es.t >= ESCENA_CUADROS) {
      this.estado = ESTADO.JUGANDO;
      this.escena = null;
      this.tam = 2;
      this.gigT = GIGANTE_CUADROS;
      this.sacudida = 12;
      this.chispas(this.j.x, this.j.y - 20, "#ffffff", 26);
    }
  }

  // --- particulas -------------------------------------------------------
  chispas(x, y, col, n) {
    for (let i = 0; i < n; i++)
      this.part.push({ tipo: "chispa", x, y, r: 2 + Math.random() * 2, col,
        vx: (Math.random() - 0.5) * 3.4, vy: -Math.random() * 3 - 0.5,
        vida: 24 + Math.random() * 16, total: 34 });
  }
  texto(x, y, txt, col) {
    this.part.push({ tipo: "texto", x, y, txt, col, vx: 0, vy: -0.9, g: 0.012,
                     vida: 52, total: 52 });
  }

  // --- dibujo -----------------------------------------------------------
  dibujar(c) {
    const H = this.hojas;
    const sx = this.sacudida ? Math.round((Math.random() - 0.5) * this.sacudida * 0.5) : 0;
    const sy = this.sacudida ? Math.round((Math.random() - 0.5) * this.sacudida * 0.5) : 0;
    c.save(); c.translate(sx, sy);
    D.fondo(c, this.nv.tema, this.camX, this.camY, this.t, VISTA.ancho, VISTA.alto, this.capas);
    D.tiles(c, this.nv, this.camX, this.camY, this.t, VISTA.ancho, VISTA.alto,
            this.patron, this.animTiles, H);
    D.monedasVisibles(c, this.nv, this.camX, this.camY, this.t, VISTA.ancho, VISTA.alto, H.moneda_girar);

    // mastil
    const mx = this.nv.mastilX * T - this.camX;
    if (mx > -40 && mx < VISTA.ancho + 40) {
      const topY = (this.nv.pisoMastil - 10) * T - this.camY;
      const banderaY = (this.estado === ESTADO.MASTIL || this.estado === ESTADO.GANADO)
        ? this.mastilY - this.camY - 12 : topY + 4;
      c.fillStyle = this.jefeVivo ? "#8a8a96" : "#e2495f";
      c.fillRect((mx + 9) | 0, banderaY | 0, 14, 10);
      c.fillStyle = "#ffd447"; c.fillRect((mx + 5) | 0, (topY - 3) | 0, 6, 6);
    }

    for (const m of this.color)
      if (!m.tomada) D.monedaColor(c, m.tx * T + 8 - this.camX, m.ty * T + T - 2 - this.camY,
                                   this.t, this.tier, H.moneda_girar);

    for (const h of this.hongos) this.dibujarHongo(c, h);
    for (const e of this.bichos) this.dibujarBicho(c, e);
    if (this.jefeVivo) this.dibujarJefe(c);
    for (const p of this.part) D.particula(c, p, this.camX, this.camY);

    if (this.estado === ESTADO.BURBUJA) {
      const x = this.burbX - this.camX, y = this.burbY - this.camY;
      this.dibujarHeroe(c, x, y, "quieto", false);
      c.save(); c.globalAlpha = 0.75; c.strokeStyle = "#bfe8ff"; c.lineWidth = 1;
      c.beginPath(); c.arc(x, y - 14, 15, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 0.18; c.fillStyle = "#bfe8ff"; c.fill(); c.restore();
    } else if (this.estado !== ESTADO.GANADO || !this.premioDado) {
      // Parpadeo mientras dura la invulnerabilidad: es la unica forma de que
      // el jugador sepa por que no lo estan matando.
      if (!(this.invT > 0 && Math.floor(this.t / 3) % 2))
        this.dibujarHeroe(c, this.j.x - this.camX, this.j.y - this.camY,
          this.j.frenado ? "quieto" : (this.j.suelo ? "correr" : "saltar"), this.j.dir < 0);
    }
    c.restore();
    // La escena va SIN la sacudida y SIN la camara: ocupa la pantalla entera.
    if (this.estado === ESTADO.ESCENA) this.dibujarEscena(c);
  }

  dibujarHongo(c, h) {
    const H = this.hojas;
    const hoja = h.tipo === "super" ? H.hongo_super : H.hongo_crecer;
    const x = h.x - this.camX, y = h.y - this.camY;
    const alto = h.tipo === "super" ? 22 : 16;
    // Un halo, porque un hongo volando entre monedas amarillas se pierde.
    c.save();
    const r = alto * 0.7 + Math.sin(this.t / 6) * 2;
    const g = c.createRadialGradient(x, y - alto / 2, 1, x, y - alto / 2, r);
    const col = h.tipo === "super" ? "#ff7ac0" : "#ffe08a";
    g.addColorStop(0, col + "aa"); g.addColorStop(1, col + "00");
    c.fillStyle = g; c.beginPath(); c.arc(x, y - alto / 2, r, 0, Math.PI * 2); c.fill();
    c.restore();
    if (hoja) dibujarCuadro(c, hoja, cuadroDe(this.t / 60, hoja, 12), x, y + alto / 2, alto);
    else { c.fillStyle = col; c.fillRect((x - 6) | 0, (y - 6) | 0, 12, 12); }
  }

  /**
   * La escena del hongo arcoiris: pantalla completa, unos tres segundos.
   *
   * SON VEINTICUATRO FOTOGRAMAS DE UN VIDEO, y esa es toda la diferencia. Una
   * hoja de sprites se le pide al modelo dibujo por dibujo: sale una
   * animacion, pero cada cuadro es un dibujo aparte y se nota en el temblor.
   * Un video se genera como una sola cosa continua, asi que los fotogramas ya
   * vienen encadenados — el destello, el fogonazo blanco, el remolino y el
   * personaje creciendo son UN movimiento y no veinticuatro dibujos parecidos.
   * Los saca extraer_cuadros.py y quedan en assets/escena/.
   *
   * Si la hoja no cargo se dibuja una version hecha con codigo. Una escena que
   * no aparece seria peor que una escena simple.
   */
  dibujarEscena(c) {
    const es = this.escena;
    if (!es) return;
    const W = VISTA.ancho, Hh = VISTA.alto;
    const p = es.t / ESCENA_CUADROS;
    const cx = W / 2, cy = Hh * 0.46;

    const hoja = this.escenaHongo;
    if (hoja && hoja.img && hoja.img.width) {
      const cw = hoja.img.width / hoja.cols, ch = hoja.img.height / hoja.filas;
      const i = Math.min(hoja.n - 1, Math.floor(p * hoja.n));
      const sx = (i % hoja.cols) * cw, sy = Math.floor(i / hoja.cols) * ch;
      // Se llena la pantalla recortando los costados, salvo que haya que
      // recortar tanto que se pierda la escena —el telefono acostado, donde
      // la proporcion no tiene nada que ver— y ahi se muestra entera con
      // bandas negras.
      const llenar = Math.max(W / cw, Hh / ch);
      const entrar = Math.min(W / cw, Hh / ch);
      const esc = (1 - entrar / llenar) <= 0.35 ? llenar : entrar;
      const dw = cw * esc, dh = ch * esc;
      c.fillStyle = "#07040f"; c.fillRect(0, 0, W, Hh);
      c.drawImage(hoja.img, sx, sy, cw, ch,
                  Math.round((W - dw) / 2), Math.round((Hh - dh) / 2),
                  Math.ceil(dw), Math.ceil(dh));
    } else {
      c.save();
      c.fillStyle = "#1a1030"; c.fillRect(0, 0, W, Hh);
      c.translate(cx, cy);
      c.rotate(es.t * 0.016);
      const RAYOS = 14, largo = Math.hypot(W, Hh);
      for (let k = 0; k < RAYOS; k++) {
        c.fillStyle = `hsl(${(k * 360 / RAYOS + es.t * 2.4) % 360} 85% 56%)`;
        c.beginPath(); c.moveTo(0, 0);
        const a0 = (k * 2 * Math.PI) / RAYOS, a1 = a0 + Math.PI / RAYOS;
        c.lineTo(Math.cos(a0) * largo, Math.sin(a0) * largo);
        c.lineTo(Math.cos(a1) * largo, Math.sin(a1) * largo);
        c.closePath(); c.fill();
      }
      c.restore();
      const hc = this.hojas.heroe_comer;
      const alto = Math.min(Hh * 0.46, W * 0.82);
      if (hc) dibujarCuadro(c, hc, Math.min(hc.n - 1, Math.floor(p * hc.n)), cx, cy + alto / 2, alto);
      else this.dibujarHeroe(c, cx, cy + alto / 2, "quieto", false);
    }

    c.save();
    c.textAlign = "center";
    c.font = "bold 13px monospace";
    c.fillStyle = "#1a1030";
    c.fillText("¡SUPER HONGO!", cx + 1, Hh * 0.93 + 1);
    c.fillStyle = "#fff";
    c.fillText("¡SUPER HONGO!", cx, Hh * 0.93);
    c.textAlign = "left";
    if (p > 0.9) {
      c.globalAlpha = (p - 0.9) / 0.1;
      c.fillStyle = "#fff"; c.fillRect(0, 0, W, Hh);
    }
    c.restore();
  }

  // El heroe: cinco hojas. Correr y quieto ciclan; las tres de salto no.
  //
  // El primer salto avanza CON LA ALTURA —agacharse, despegar, subir, caer,
  // aterrizar salen en el momento que corresponde en vez de girar en redondo—
  // y el doble y el triple avanzan CON EL RELOJ, porque un volteo es una
  // vuelta completa que tiene que terminar aunque la altura no acompane: si
  // se lo atara a vy, un doble salto contra un techo dejaria al heroe clavado
  // boca abajo.
  dibujarHeroe(c, x, y, estado, espejo) {
    const H = this.hojas;
    const esc = this.escalaAct ?? 1;
    const alto = ALTOS.heroe * esc;
    // De gigante el cuerpo va bajo el arcoiris. Se dibuja en un lienzo aparte
    // y se tine ahi: pintando el degrade directo sobre el del juego con
    // `source-atop` se tine TODO lo que ya estaba abajo, que fue el mismo
    // error que costo entender con las monedas de color.
    if (this.tam === 2 && esc > 1.6) {
      const l = this.lienzoArcoiris(alto);
      const tc = l.getContext("2d");
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.clearRect(0, 0, l.width, l.height);
      this.dibujarHeroeHoja(tc, l.width / 2, l.height - 2, estado, espejo, alto);
      tc.globalCompositeOperation = "source-atop";
      const g = tc.createLinearGradient(0, 0, l.width * 0.8, l.height);
      // El arcoiris CORRE sobre el cuerpo: el desfase sale del reloj, asi que
      // las bandas pasan de abajo hacia arriba en vez de quedarse pintadas.
      for (let i = 0; i <= 6; i++)
        g.addColorStop(i / 6, `hsl(${(i * 60 + this.t * 6) % 360} 95% 58%)`);
      tc.globalAlpha = 0.46; tc.fillStyle = g;
      tc.fillRect(0, 0, l.width, l.height);
      tc.globalAlpha = 1; tc.globalCompositeOperation = "source-over";
      c.drawImage(l, Math.round(x - l.width / 2), Math.round(y - l.height + 2),
                  l.width, l.height);
      return;
    }
    this.dibujarHeroeHoja(c, x, y, estado, espejo, alto);
  }

  lienzoArcoiris(alto) {
    const lado = Math.ceil(alto * 1.6);
    if (!this._arco || this._arco.width < lado) {
      this._arco = document.createElement("canvas");
      this._arco.width = this._arco.height = lado;
      this._arco.getContext("2d").imageSmoothingEnabled = false;
    }
    return this._arco;
  }

  dibujarHeroeHoja(c, x, y, estado, espejo, alto) {
    const H = this.hojas;
    // El pivote gana a todo lo demas: si se esta dando vuelta, lo que importa
    // es que se vea girar.
    if (this.giroT > 0 && H.heroe_girar) {
      const h = H.heroe_girar;
      const i = Math.min(h.n - 1, Math.floor((1 - this.giroT / GIRO_CUADROS) * h.n));
      // La hoja gira de derecha a izquierda. Girando al otro lado se espeja.
      dibujarCuadro(c, h, i, x, y, alto, this.giroDe < 0);
      return;
    }
    if (estado === "saltar" && this.j.flip > 0) {
      const hoja = this.j.flipTipo === 3 ? H.heroe_triple : H.heroe_doble;
      if (hoja) {
        const p = Math.min(1, (this.j.flip - 1) / F.FLIP_CUADROS);
        dibujarCuadro(c, hoja, Math.min(hoja.n - 1, Math.floor(p * hoja.n)),
                      x, y, alto, espejo);
        return;
      }
    }
    if (estado === "saltar" && H.heroe_saltar) {
      const n = H.heroe_saltar.n;
      // vy va de -10 (subiendo fuerte) a +9 (cayendo): se mapea al cuadro.
      const p = Math.max(0, Math.min(1, (this.j.vy + 9) / 18));
      dibujarCuadro(c, H.heroe_saltar, Math.round(1 + p * (n - 2)), x, y, alto, espejo);
      return;
    }
    const hoja = estado === "correr" ? H.heroe_correr : H.heroe_quieto;
    if (hoja) {
      // 22 cuadros por segundo para correr y no 14. Con 14, los dieciseis
      // dibujos de un ciclo tardan 1,14 s en pasar: el personaje avanza casi
      // tres tiles por zancada y se ve arrastrando los pies. A 22 el ciclo
      // dura 0,73 s, que es el paso de alguien corriendo.
      //
      // El gigante va a la mitad: pasos lentos y pesados, que es lo que se
      // pidio y ademas lo unico que hace que el tamano se sienta.
      const fps = estado === "correr" ? (this.tam === 2 ? 9 : 22) : 8;
      dibujarCuadro(c, hoja, cuadroDe(this.t / 60, hoja, fps), x, y, alto, espejo);
      return;
    }
    // Respaldo si una hoja no cargo. Un heroe invisible es lo peor que puede
    // pasar; un rectangulo naranja se entiende.
    c.fillStyle = "#ffb43a";
    c.fillRect((x - 6) | 0, (y - alto) | 0, 12, alto);
  }

  dibujarBicho(c, e) {
    if (!e.vivo) return;
    const H = this.hojas;
    const cajas = E.cajas(e);
    if (!cajas.length) return;
    const x = e.x - this.camX, y = e.y - this.camY;
    const espejo = e.dir > 0;
    const t = this.t / 60;
    const HOJA = {
      bolo: "bolo_caminar", coraza: "bolo_caminar", caracol: "caracol_caminar",
      aleta: "aleta_volar", erizo: "erizo_caminar", fauces: "fauces_morder",
      osario: "osario_caminar", vela: "vela_flotar", perno: "perno_volar",
      brasa: "brasa_saltar", vigia: "aleta_volar", torrepua: "erizo_caminar",
      mortero: "perno_volar",
    };
    if (e.tipo === "caracol" && e.caparazon) {
      const h = H.caracol_concha;
      if (h) dibujarCuadro(c, h, cuadroDe(t, h, e.empujado ? 22 : 4), x, y, ALTOS.caracol * 0.8, espejo);
      return;
    }
    if (e.tipo === "fauces") {
      const h = H.fauces_morder;
      const boca = (e.baseY ?? e.y) - this.camY;     // la linea de la boca del tubo
      if (!h) {
        c.fillStyle = "#3fa34d";
        c.fillRect((x - 3) | 0, (boca - (e.salida ?? 0) * ALTOS.fauces) | 0, 6, (e.salida ?? 0) * ALTOS.fauces);
        return;
      }
      c.save();
      // SE RECORTA EN LA BOCA DEL TUBO. El sprite se dibuja entero y lo que
      // cae por debajo de la boca no se pinta: asi la planta SALE del tubo en
      // vez de aparecer y desaparecer en el aire, que era el reclamo. El
      // recorte es lo que hace el efecto, no una animacion de encogerse.
      c.beginPath();
      c.rect(x - 26, boca - ALTOS.fauces - 40, 52, ALTOS.fauces + 40);
      c.clip();
      // LA HOJA SE LEE DE IDA Y DE VUELTA. Esta dibujada abriendo nada mas
      // —cuadro 0 cerrada, cuadro 15 a tope— porque dieciseis cuadros de
      // abrir-y-cerrar tienen las poses repetidas de a pares y el control
      // numerico rechaza la hoja. Leida en zigzag, esos dieciseis dibujos dan
      // una mordida entera de treinta cuadros sin repetir ninguno.
      const n = h.n, ida = Math.floor(this.t / 2) % (n * 2 - 2);
      const i = ida < n ? ida : (n * 2 - 2 - ida);
      dibujarCuadro(c, h, i, x, boca + (1 - (e.salida ?? 0)) * ALTOS.fauces,
                    ALTOS.fauces, false);
      c.restore();
      return;
    }
    if (e.tipo === "torrepua") {
      const h = H.erizo_caminar;
      for (let i = 0; i < (e.segmentos ?? 3); i++)
        if (h) dibujarCuadro(c, h, cuadroDe(t, h, 8, i * 4), x, y - i * 14, ALTOS.erizo, espejo);
      return;
    }
    if (e.tipo === "rueda") {
      for (const b of cajas) {
        c.fillStyle = "#ff8a2a"; c.fillRect((b.x - this.camX - 4) | 0, (b.y - this.camY - 4) | 0, 8, 8);
        c.fillStyle = "#ffe08a"; c.fillRect((b.x - this.camX - 2) | 0, (b.y - this.camY - 2) | 0, 4, 4);
      }
      return;
    }
    const h = H[HOJA[e.tipo]];
    const alto = ALTOS[e.tipo] ?? 20;
    const alpha = e.tipo === "vela" && e.tapado ? 0.4 : 1;
    if (e.tipo === "osario" && e.roto > 0) {
      c.fillStyle = "#e8e4d8";
      for (let i = 0; i < 4; i++) c.fillRect((x - 8 + i * 4) | 0, (y - 4) | 0, 3, 3);
      return;
    }
    if (h) dibujarCuadro(c, h, cuadroDe(t, h, 10, e.ini ? e.ini.tx * 5 : 0), x, y, alto, espejo, alpha);
    else { c.fillStyle = "#c8552f"; c.fillRect((x - 7) | 0, (y - alto) | 0, 14, alto); }
  }

  dibujarJefe(c) {
    const b = this.jefe, x = b.x - this.camX, y = b.y - this.camY;
    const h = this.hojas[b.tipo === "coloso" ? "coloso_caminar" : "yunque_caminar"];
    if (h) {
      const visible = b.invuln === 0 || (b.invuln >> 2) % 2 === 0;
      if (visible) dibujarCuadro(c, h, cuadroDe(this.t / 60, h, 8), x, y, ALTOS[b.tipo] ?? 44, b.vx > 0);
      const max = b.tipo === "coloso" ? 4 : 3;
      c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect((x - 16) | 0, (y - (ALTOS[b.tipo] ?? 44) - 8) | 0, 32, 4);
      c.fillStyle = "#e2495f"; c.fillRect((x - 15) | 0, (y - (ALTOS[b.tipo] ?? 44) - 7) | 0, 30 * (b.vida / max), 2);
      return;
    }
    c.save(); c.translate(x, y);
    if (b.invuln > 0 && (b.invuln >> 2) % 2) c.globalAlpha = 0.45;
    if (b.tipo === "bowser") {
      c.fillStyle = "#3fa34d";
      c.beginPath(); c.ellipse(0, -16, 16, 15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#e8a83a";
      c.beginPath(); c.ellipse(0, -12, 11, 10, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#d8d0c0";
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + i / 4 * Math.PI;
        c.beginPath(); c.arc(Math.cos(a) * 15, -16 + Math.sin(a) * 14, 3, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = "#3fa34d"; c.beginPath(); c.arc(-12, -30, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff"; c.fillRect(-18, -32, 5, 3);
      c.fillStyle = "#000"; c.fillRect(-17, -31, 2, 2);
    } else {
      c.fillStyle = "#c8442a";
      c.beginPath(); c.ellipse(0, -15, 15, 14, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#e8e0d0"; c.beginPath(); c.ellipse(0, -11, 10, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#2a2a34"; c.beginPath(); c.arc(0, -28, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#fff"; c.fillRect(-5, -30, 4, 3); c.fillRect(1, -30, 4, 3);
    }
    c.globalAlpha = 1;
    // vida
    c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(-16, -46, 32, 5);
    c.fillStyle = "#d84a6a";
    const max = b.tipo === "bowser" ? 4 : 3;
    c.fillRect(-15, -45, 30 * (b.vida / max), 3);
    c.restore();
  }
}
