// Una partida: un nivel corriendo.
//
// Junta la fisica, los enemigos, el dibujo y el sonido. La regla que ordena
// todo el archivo es que el ESTADO vive aca y el dibujo no decide nada: se
// puede correr una partida entera sin canvas (asi la prueban las pruebas).

import { T, V, F, TEMAS, ALTO_TILES, ANCHO_VISTA, ALTO_VISTA } from "./mundo.js";
import { nuevoJugador, paso, tileXY, sumarCombo } from "./fisica.js";
import * as E from "./entidades.js";
import * as D from "./dibujo.js";
import { efe, musica, pararMusica, latirMusica } from "./audio.js";

export const ESTADO = { JUGANDO: "jugando", BURBUJA: "burbuja", MASTIL: "mastil",
                        GANADO: "ganado", PERDIDO: "perdido" };

export class Partida {
  constructor(nv, tier) {
    this.nv = nv;
    this.tier = tier;
    this.j = nuevoJugador(nv.inicio.x, nv.inicio.y);
    this.bichos = nv.enemigos.map((e) => E.crear(e.tipo, e.tx, e.ty));
    this.part = [];
    this.camX = 0; this.camY = 0;
    this.t = 0;
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

    if (this.estado === ESTADO.BURBUJA) return this.pasoBurbuja(ent);
    if (this.estado === ESTADO.MASTIL) return this.pasoMastil();
    if (this.estado !== ESTADO.JUGANDO) return;

    // El reloj se frena parado en un bloque de pausa. Es la unica pausa real
    // del juego y por eso el bloque vale como acertijo.
    this.relojCorre = !this.j.frenado;
    if (this.relojCorre && --this.reloj <= 0) return this.perder("tiempo");
    if (this.reloj === 600) efe.apuro();
    if (this.reloj < 600 && this.reloj % 60 === 0) efe.apuro();

    const ev = {};
    paso(this.j, this.nv, ent, ev);
    this.sonarEventos(ev);
    if (ev.cabezazo) this.golpearBloque(ev.cabezazo.tx, ev.cabezazo.ty);
    if (!this.j.vivo) return this.morir(ev.muerte);

    this.recolectar();
    this.bichosPaso(ev);
    if (this.jefeVivo) this.jefePaso();

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
    if (ev.giro) this.chispas(j.x, j.y - 8, "#8ad8ff", 4);
    if (ev.resorte) efe.resorte();
    if (ev.saltoLargo) { efe.resorte(); this.texto(j.x, j.y - 22, "¡largo!", "#6aa8f0"); }
    if (ev.voltereta) { efe.saltoAlto(); this.texto(j.x, j.y - 22, "¡arriba!", "#d28ae8"); }
    if (ev.pausa) efe.pausa();
    if (ev.despausa) efe.pausa();
    if (ev.tobogan && this.t % 6 === 0) this.chispas(j.x, j.y, "#ffffff", 2);
    if (ev.trepada) this.chispas(j.x, j.y, "#ffffff", 3);
  }

  // --- camara ----------------------------------------------------------
  camara() {
    // El jugador va a un tercio de la pantalla, no al medio: corre siempre
    // para adelante, asi que lo que importa ver es lo que VIENE.
    const objX = this.j.x - ANCHO_VISTA * 0.34;
    this.camX += (objX - this.camX) * 0.16;
    this.camX = Math.max(0, Math.min(this.nv.ancho * T - ANCHO_VISTA, this.camX));
    // En vertical persigue mas suave y con zona muerta: seguir cada salto
    // marea y hace perder la referencia del piso.
    const objY = this.j.y - ALTO_VISTA * 0.62;
    const d = objY - this.camY;
    if (Math.abs(d) > 28) this.camY += (d - Math.sign(d) * 28) * 0.10;
    this.camY = Math.max(0, Math.min(ALTO_TILES * T - ALTO_VISTA, this.camY));
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

  golpearBloque(tx, ty) {
    const v = tileXY(this.nv, tx, ty);
    const i = ty * this.nv.ancho + tx;
    if (v === V.LADRILLO) {
      this.nv.grilla[i] = V.NADA; efe.ladrillo();
      this.chispas(tx * T + 8, ty * T + 8, TEMAS[this.nv.tema].tierra, 8);
      this.sacudida = 4;
    } else if (v === V.PREGUNTA) {
      this.nv.grilla[i] = V.USADO; efe.bloque();
      // Una de cada cinco da burbuja en vez de monedas. Sin eso, quedarse sin
      // burbujas a mitad de nivel no tiene vuelta y el nivel se abandona.
      if (this.burbujas < 4 && ((tx * 7 + ty * 13) % 5 === 0)) {
        this.burbujas++; efe.burbuja(); this.texto(tx * T + 8, ty * T - 6, "burbuja", "#8ad8ff");
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
      if (Math.abs(e.x - this.j.x) > ANCHO_VISTA * 1.4) continue;  // fuera de vista, quieto
      E.actualizar(e, this.nv, this.j, ev, nuevos);
      if (e.tipo === "koopa" && e.caparazon && e.empujado) {
        const n = E.barrer(e, this.bichos);
        for (let k = 0; k < n; k++) {
          const p = sumarCombo(this.j); this.monedas += p;
          this.texto(e.x, e.y - 20, `+${p}`, "#ffd447"); efe.combo(this.j.combo);
        }
      }
      const res = E.chocar(this.j, e);
      if (res === "pisar") {
        const pago = sumarCombo(this.j);
        this.monedas += pago * E.pisado(e, this.j, nuevos);
        this.j.vy = F.PISADA_REBOTE;
        this.j.giroUsado = false;              // pisar devuelve el giro
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
    this.burbX -= 1.5;
    this.burbY += Math.sin(this.burbujaT / 18) * 0.5;
    // Sube hasta quedar en aire libre: pinchar dentro de una pared seria
    // morir de nuevo al instante, que es la peor forma de perder.
    while (this.burbY > 2 * T && this.libre(this.burbX, this.burbY) === false) this.burbY -= T;
    this.camX = Math.max(0, Math.min(this.nv.ancho * T - ANCHO_VISTA, this.burbX - ANCHO_VISTA * 0.34));
    this.camY = Math.max(0, Math.min(ALTO_TILES * T - ALTO_VISTA, this.burbY - ALTO_VISTA * 0.5));
    const seguro = this.libre(this.burbX, this.burbY);
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
    const sx = this.sacudida ? (Math.random() - 0.5) * this.sacudida * 0.7 : 0;
    const sy = this.sacudida ? (Math.random() - 0.5) * this.sacudida * 0.7 : 0;
    c.save(); c.translate(sx, sy);
    D.fondo(c, this.nv.tema, this.camX, this.camY, this.t, ANCHO_VISTA, ALTO_VISTA);
    D.tiles(c, this.nv, this.camX, this.camY, this.t, ANCHO_VISTA, ALTO_VISTA);

    // mastil
    const mx = this.nv.mastilX * T - this.camX;
    if (mx > -40 && mx < ANCHO_VISTA + 40) {
      const topY = (this.nv.pisoMastil - 10) * T - this.camY;
      const banderaY = this.estado === ESTADO.MASTIL || this.estado === ESTADO.GANADO
        ? this.mastilY - this.camY - 14 : topY + 4;
      c.fillStyle = this.jefeVivo ? "#8a8a96" : "#d84a6a";
      c.beginPath(); c.moveTo(mx + 9, banderaY); c.lineTo(mx + 26, banderaY + 7);
      c.lineTo(mx + 9, banderaY + 14); c.fill();
      c.fillStyle = "#e8e8f0"; c.beginPath(); c.arc(mx + 8, topY, 4, 0, Math.PI * 2); c.fill();
      if (this.jefeVivo) {
        c.fillStyle = "rgba(0,0,0,.45)"; c.font = "9px system-ui"; c.textAlign = "center";
        c.fillText("trabado", mx + 8, topY - 8); c.textAlign = "left";
      }
    }

    for (const m of this.color)
      if (!m.tomada) D.monedaColor(c, m.tx * T + 8 - this.camX, m.ty * T + 8 - this.camY, this.t, this.tier);
    for (const e of this.bichos) E.cajas(e).length && D.enemigo(c, e, this.t, this.camX, this.camY);
    if (this.jefeVivo) this.dibujarJefe(c);
    for (const p of this.part) D.particula(c, p, this.camX, this.camY);

    if (this.estado === ESTADO.BURBUJA) {
      const x = this.burbX - this.camX, y = this.burbY - this.camY - 8;
      c.save(); c.globalAlpha = 0.85;
      const g = c.createRadialGradient(x - 3, y - 3, 2, x, y, 16);
      g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(.7, "rgba(160,220,255,.45)");
      g.addColorStop(1, "rgba(120,190,255,.15)");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 1.2; c.stroke();
      c.restore();
      c.save(); c.translate(0, 0);
      D.jugador(c, { ...this.j, x: this.burbX, y: this.burbY, suelo: false, vy: 0, giro: 0, pared: 0 },
                this.t, this.camX, this.camY);
      c.restore();
    } else if (this.estado !== ESTADO.GANADO || !this.premioDado) {
      D.jugador(c, this.j, this.t, this.camX, this.camY);
    }
    c.restore();
  }

  dibujarJefe(c) {
    const b = this.jefe, x = b.x - this.camX, y = b.y - this.camY;
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
