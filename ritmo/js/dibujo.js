// El dibujo. Flechas, receptores, salpicaduras y un fondo que late.
//
// TODO LO CARO SE COCINA UNA VEZ. Una flecha con resplandor cuesta un
// `shadowBlur`, y `shadowBlur` se recalcula en cada llamada: con veinte flechas
// en pantalla son veinte desenfoques por cuadro y ahí se va el presupuesto.
// Cada pieza —flecha, receptor apagado, receptor prendido, salpicadura— se
// dibuja UNA vez en su propio lienzo y después se estampa. Estampar es copiar
// píxeles y cuesta lo mismo tenga o no resplandor.
//
// Y EL FONDO FIJO NO SE PINTA ACA: lo pone el CSS detrás del lienzo. Rellenar
// un degradado a pantalla completa sesenta veces por segundo, para que quede
// exactamente igual, era el trabajo más caro del juego.

import { CARRILES } from "./carta.js";

/* Los cuatro carriles son direcciones, no números: izquierda, abajo, arriba,
   derecha. Se leen sin aprenderlas y cada una tiene su color. */
export const CARRILES_INFO = [
  { dir: "izq",    vivo: "#c24bff", flojo: "#4a1a6e", giro: Math.PI },
  { dir: "abajo",  vivo: "#00d9ff", flojo: "#0b4f5e", giro: Math.PI / 2 },
  { dir: "arriba", vivo: "#3ce06a", flojo: "#14532b", giro: -Math.PI / 2 },
  { dir: "der",    vivo: "#ff3d5a", flojo: "#6e1522", giro: 0 },
];
export const COLORES = CARRILES_INFO;
const JUICIO = { perfecto: "#7cf6ff", bien: "#9dff6b", rozo: "#ffc247", error: "#ff5252" };

/** La silueta de una flecha, mirando a la derecha, en una caja de -1 a 1. */
function trazarFlecha(x, r) {
  const p = (a, b) => [a * r, b * r];
  const pts = [[0.95, 0], [0.18, -0.85], [0.18, -0.34], [-0.95, -0.34],
               [-0.95, 0.34], [0.18, 0.34], [0.18, 0.85]];
  x.beginPath();
  pts.forEach((q, i) => { const [a, b] = p(q[0], q[1]); i ? x.lineTo(a, b) : x.moveTo(a, b); });
  x.closePath();
}

export class Pantalla {
  constructor(lienzo) {
    this.c = lienzo;
    this.x = lienzo.getContext("2d");
    this.chispas = [];
    this.salpicaduras = [];
    this.polvo = [];
    this.sellos = null;
    this.medir();
  }

  medir() {
    /* EL LIENZO NO PASA DE UNOS DOS MILLONES Y MEDIO DE PIXELES.
       En una tablet, 768×1024 a densidad 2 son 3,1 millones que hay que
       rellenar sesenta veces por segundo; medido, ahí los cuadros bajaban a
       54,8. Lo que se dibuja son formas grandes: bajar la densidad no se ve. */
    const TOPE = 2_600_000;
    const anCss = this.c.clientWidth || innerWidth, alCss = this.c.clientHeight || innerHeight;
    const cabe = Math.sqrt(TOPE / Math.max(1, anCss * alCss));
    this.dpr = Math.min(devicePixelRatio || 1, 2, Math.max(1, cabe));
    this.AN = anCss; this.AL = alCss;
    this.c.width = Math.round(this.AN * this.dpr);
    this.c.height = Math.round(this.AL * this.dpr);
    this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.anchoPista = Math.min(this.AN * 0.96, 560);
    this.x0 = (this.AN - this.anchoPista) / 2;
    this.anchoCarril = this.anchoPista / CARRILES;
    // Los receptores van arriba del todo o abajo del todo; abajo el dedo los
    // tapa justo cuando hay que mirarlos, así que van a tres cuartos.
    this.linea = this.AL * 0.775;
    this.radio = Math.min(this.anchoCarril * 0.33, this.AL * 0.042);
    this.sellos = null;
    this.cocinarFondos();
    this.sembrarPolvo();
  }

  cocinarFondos() {
    const X = this.x;
    const rg = X.createRadialGradient(this.AN / 2, this.linea, 0, this.AN / 2, this.linea, this.AL * 0.62);
    rg.addColorStop(0, "rgba(150,70,255,1)");
    rg.addColorStop(1, "rgba(150,70,255,0)");
    this.gPulso = rg;
    this.gCarril = CARRILES_INFO.map((col) => {
      const lg = X.createLinearGradient(0, this.linea - this.AL * .34, 0, this.linea);
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(1, col.vivo + "3a");
      return lg;
    });
  }

  sembrarPolvo() {
    // Motas que suben despacio. Es lo que hace que el fondo no parezca una foto.
    this.polvo = [];
    const n = Math.round((this.AN * this.AL) / 26000);
    for (let i = 0; i < n; i++)
      this.polvo.push({ x: Math.random() * this.AN, y: Math.random() * this.AL,
                        v: 0.15 + Math.random() * 0.5, r: 0.8 + Math.random() * 1.8,
                        a: 0.08 + Math.random() * 0.2 });
  }

  centroCarril(c) { return this.x0 + this.anchoCarril * (c + 0.5); }

  /** Cocina flechas, receptores y salpicadura. Sólo al cambiar de tamaño. */
  cocinar() {
    const r = this.radio, pad = Math.round(r * 0.9);
    const lado = Math.round((r + pad) * 2);
    this.padSello = pad; this.ladoSello = lado;
    const nuevo = () => {
      const h = document.createElement("canvas");
      h.width = h.height = lado * this.dpr;
      const g = h.getContext("2d");
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.translate(lado / 2, lado / 2);
      return [h, g];
    };

    this.flechas = []; this.receptores = []; this.prendidos = [];
    for (const info of CARRILES_INFO) {
      // ── la flecha que cae ──
      let [h, g] = nuevo();
      g.rotate(info.giro);
      g.shadowColor = info.vivo; g.shadowBlur = pad * 0.85;
      g.fillStyle = info.vivo; trazarFlecha(g, r); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,.30)"; trazarFlecha(g, r * 0.62); g.fill();
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = Math.max(1.5, r * 0.09);
      trazarFlecha(g, r); g.stroke();
      this.flechas.push(h);

      // ── el receptor apagado: el mismo contorno, hueco ──
      [h, g] = nuevo();
      g.rotate(info.giro);
      g.strokeStyle = "rgba(255,255,255,.30)"; g.lineWidth = Math.max(2, r * 0.13);
      trazarFlecha(g, r); g.stroke();
      g.fillStyle = "rgba(255,255,255,.045)"; trazarFlecha(g, r); g.fill();
      this.receptores.push(h);

      // ── el receptor prendido: lleno y con halo ──
      [h, g] = nuevo();
      g.rotate(info.giro);
      g.shadowColor = info.vivo; g.shadowBlur = pad * 1.1;
      g.fillStyle = info.vivo; trazarFlecha(g, r); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,.55)"; trazarFlecha(g, r * 0.55); g.fill();
      this.prendidos.push(h);
    }

    // La salpicadura del acierto perfecto: una estrella blanca que se abre.
    const [hs, gs] = nuevo();
    gs.fillStyle = "#fff";
    for (let i = 0; i < 12; i++) {
      gs.save(); gs.rotate((i / 12) * 6.283);
      gs.beginPath(); gs.moveTo(0, -r * .2); gs.lineTo(r * 1.0, 0); gs.lineTo(0, r * .2);
      gs.closePath(); gs.fill(); gs.restore();
    }
    this.salpicadura = hs;
    this.sellos = true;
  }

  estampar(hoja, cx, cy, escala = 1, alfa = 1) {
    const l = this.ladoSello * escala;
    if (alfa !== 1) this.x.globalAlpha = alfa;
    this.x.drawImage(hoja, cx - l / 2, cy - l / 2, l, l);
    if (alfa !== 1) this.x.globalAlpha = 1;
  }

  chispear(carril, clase) {
    const cx = this.centroCarril(carril);
    const col = JUICIO[clase] || "#fff";
    if (clase === "error") {
      for (let i = 0; i < 6; i++)
        this.chispas.push({ x: cx + (Math.random() - .5) * this.anchoCarril * .5, y: this.linea,
                            vx: (Math.random() - .5) * 2, vy: 1.6 + Math.random() * 2,
                            vida: 1, col: "#ff5252" });
      return;
    }
    if (clase === "perfecto") this.salpicaduras.push({ carril, vida: 1 });
    const n = clase === "perfecto" ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random();
      const v = 2.4 + Math.random() * 3.6;
      this.chispas.push({ x: cx, y: this.linea, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.4,
                          vida: 1, col: i % 3 ? col : CARRILES_INFO[carril].vivo });
    }
  }

  /**
   * Un cuadro.
   * @param t hora de la canción
   * @param o {anticipo, pulso, latido, apretados, juicio, vida, progreso, combo}
   */
  dibujar(partida, t, o) {
    const X = this.x;
    if (!this.sellos) this.cocinar();
    const { anticipo, pulso, latido, apretados, juicio } = o;
    X.clearRect(0, 0, this.AN, this.AL);

    this.fondo(X, t, pulso, latido);

    /* LA CAMARA REBOTA CON EL PULSO, y el rebote se aplica a TODA la pista de
       una sola vez con una transformación. Escalando cada cosa por su cuenta,
       las flechas y los receptores se despegan entre sí en el rebote y se ve
       como un error de dibujo. */
    const rebote = 1 + 0.018 * Math.max(0, pulso);
    X.save();
    X.translate(this.AN / 2, this.linea);
    X.scale(rebote, rebote);
    X.translate(-this.AN / 2, -this.linea);

    this.pista(X, apretados);
    this.notas(X, partida, t, anticipo);
    this.receptoresYSalpicaduras(X, partida, t, apretados);
    X.restore();

    this.particulas(X);
    this.carteles(X, partida, t, juicio, o);
  }

  // ── fondo ──────────────────────────────────────────────────────────────
  fondo(X, t, pulso, latido) {
    // galones que bajan: dan sensación de velocidad sin tapar nada
    const paso = this.AL * 0.19;
    const corr = ((t * this.AL * 0.045) % paso + paso) % paso;
    X.strokeStyle = "rgba(255,255,255,.028)";
    X.lineWidth = Math.max(8, this.AL * 0.016);
    for (let y = -paso; y < this.AL + paso; y += paso) {
      X.beginPath();
      X.moveTo(-10, y + corr - this.AN * .12);
      X.lineTo(this.AN / 2, y + corr);
      X.lineTo(this.AN + 10, y + corr - this.AN * .12);
      X.stroke();
    }

    // el reflector detrás de los receptores, que late con el bombo
    if (pulso > 0.01) {
      const r = this.AL * 0.62;
      X.globalAlpha = 0.26 * pulso;
      X.fillStyle = this.gPulso;
      X.fillRect(0, Math.max(0, this.linea - r), this.AN, Math.min(this.AL, r * 2));
      X.globalAlpha = 1;
    }

    // anillos que salen del centro en cada tiempo
    if (latido !== undefined) {
      for (const f of [latido, latido + 1]) {
        const v = f % 1;
        if (v > 0.98) continue;
        X.globalAlpha = 0.16 * (1 - v);
        X.strokeStyle = "#a071ff";
        X.lineWidth = 2 + 6 * (1 - v);
        X.beginPath();
        X.arc(this.AN / 2, this.linea, this.AL * 0.10 + v * this.AL * 0.55, 0, 6.283);
        X.stroke();
        X.globalAlpha = 1;
      }
    }

    // el fogonazo del bombo: blanco, muy poco, y sólo en el golpe
    if (pulso > 0.75) {
      X.fillStyle = `rgba(255,255,255,${(pulso - 0.75) * 0.10})`;
      X.fillRect(0, 0, this.AN, this.AL);
    }
  }

  pista(X, apretados) {
    X.fillStyle = "rgba(0,0,0,.26)";
    X.fillRect(this.x0, 0, this.anchoPista, this.AL);
    for (let c = 0; c <= CARRILES; c++) {
      X.strokeStyle = "rgba(255,255,255,.07)"; X.lineWidth = 1;
      X.beginPath();
      X.moveTo(this.x0 + c * this.anchoCarril, 0);
      X.lineTo(this.x0 + c * this.anchoCarril, this.AL);
      X.stroke();
    }
    for (let c = 0; c < CARRILES; c++) {
      if (!apretados[c]) continue;
      X.fillStyle = this.gCarril[c];
      X.fillRect(this.x0 + c * this.anchoCarril, this.linea - this.AL * .34, this.anchoCarril, this.AL * .34);
    }
  }

  notas(X, partida, t, anticipo) {
    const vel = this.linea / anticipo;
    for (const n of partida.notas) {
      const dt = n.t - t;
      if (dt > anticipo + 0.2) break;
      if (n.juzgada && n.largo === 0) continue;
      const y = this.linea - dt * vel;
      if (y > this.AL + this.radio * 3) continue;
      const cx = this.centroCarril(n.carril);
      if (n.largo > 0) {
        const y2 = this.linea - (n.t + n.largo - t) * vel;
        const arriba = Math.min(y, y2), alto = Math.abs(y - y2);
        const col = CARRILES_INFO[n.carril];
        X.fillStyle = col.flojo;
        X.fillRect(cx - this.radio * .30, arriba, this.radio * .60, alto);
        // la parte ya mantenida se prende
        if (n.juzgada && n.sostenidaHasta > n.t) {
          const hasta = this.linea - (n.sostenidaHasta - t) * vel;
          X.fillStyle = col.vivo;
          X.fillRect(cx - this.radio * .30, Math.min(y, hasta), this.radio * .60, Math.abs(hasta - y));
        }
      }
      if (!n.juzgada) this.estampar(this.flechas[n.carril], cx, y);
    }
  }

  receptoresYSalpicaduras(X, partida, t, apretados) {
    for (let c = 0; c < CARRILES; c++) {
      const cx = this.centroCarril(c);
      this.estampar(this.receptores[c], cx, this.linea);
      if (apretados[c]) this.estampar(this.prendidos[c], cx, this.linea, 1.06);
    }
    for (let i = this.salpicaduras.length - 1; i >= 0; i--) {
      const s = this.salpicaduras[i];
      s.vida -= 0.075;
      if (s.vida <= 0) { this.salpicaduras.splice(i, 1); continue; }
      this.estampar(this.salpicadura, this.centroCarril(s.carril), this.linea,
                    1.1 + (1 - s.vida) * 1.5, s.vida * 0.8);
    }
  }

  particulas(X) {
    for (const p of this.polvo) {
      p.y -= p.v;
      if (p.y < -4) { p.y = this.AL + 4; p.x = Math.random() * this.AN; }
      X.fillStyle = `rgba(210,180,255,${p.a})`;
      X.beginPath(); X.arc(p.x, p.y, p.r, 0, 6.283); X.fill();
    }
    for (let i = this.chispas.length - 1; i >= 0; i--) {
      const s = this.chispas[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.24; s.vida -= 0.036;
      if (s.vida <= 0) { this.chispas.splice(i, 1); continue; }
      X.fillStyle = s.col; X.globalAlpha = s.vida;
      X.fillRect(s.x - 1.8, s.y - 1.8, 3.6, 3.6);
      X.globalAlpha = 1;
    }
  }

  carteles(X, partida, t, juicio, o) {
    // ── barra de progreso, arriba del todo ──
    if (o.progreso !== undefined) {
      X.fillStyle = "rgba(255,255,255,.10)";
      X.fillRect(0, 0, this.AN, 3);
      X.fillStyle = "#c24bff";
      X.fillRect(0, 0, this.AN * Math.max(0, Math.min(1, o.progreso)), 3);
    }

    /* ── barra de vida, ARRIBA ──
       Abajo es donde la pone el género, y abajo estaba: el problema es que el
       espacio de abajo es el único que queda libre para el cartel del juicio, y
       el juicio no puede ir en el medio de la pista porque tapa las flechas que
       hay que leer. Entre las dos cosas, la que se mira de reojo es la vida. */
    if (o.vida !== undefined) {
      const an = this.anchoPista, x0 = this.x0, y = this.AL * 0.088, al = Math.max(9, this.AL * 0.014);
      /* LA BANDEJA VA DE BORDE A BORDE. Con un marco justo alrededor de la
         barra, las flechas que pasan por detrás quedaban cortadas al medio y se
         leía como un error de dibujo en vez de como algo que está adelante. */
      X.fillStyle = "rgba(6,3,14,.88)";
      X.fillRect(0, y - al * .9, this.AN, al * 2.8);
      X.fillStyle = "#ff3d5a"; X.fillRect(x0, y, an, al);
      X.fillStyle = "#3ce06a"; X.fillRect(x0, y, an * o.vida, al);
      // el cursor que separa las dos mitades: es lo que se mira de reojo
      X.fillStyle = "#fff";
      X.fillRect(x0 + an * o.vida - 2, y - 3, 4, al + 6);
    }

    /* ── el juicio y la racha, DEBAJO DE LOS RECEPTORES ──
       Estaban en el medio de la pista, que es donde caen las flechas: tapaban
       justo lo que hay que leer para jugar. Es el mismo error que ya se había
       arreglado una vez y volvió al rehacer el dibujo, así que queda escrito.
       Debajo de los receptores no pasa nada y el ojo ya está mirando ahí. */
    if (juicio && juicio.texto) {
      const edad = t - juicio.t;
      if (edad >= 0 && edad < .62) {
        const v = edad / .62;
        // un golpe de escala que se asienta: aparece grande y se acomoda
        const esc = 1 + 0.40 * Math.exp(-edad * 22) - v * 0.10;
        X.save();
        X.globalAlpha = Math.min(1, (1 - v) * 2.4);
        X.translate(this.AN / 2, this.linea + this.AL * 0.095 + v * v * 22);
        X.scale(esc, esc);
        X.textAlign = "center";
        X.lineWidth = Math.max(3, this.AL * 0.006);
        X.strokeStyle = "rgba(0,0,0,.85)";
        X.fillStyle = JUICIO[juicio.clase] || "#fff";
        X.font = `900 ${Math.round(this.AL * .034)}px system-ui,sans-serif`;
        X.strokeText(juicio.texto, 0, 0);
        X.fillText(juicio.texto, 0, 0);
        if (partida.combo >= 3) {
          X.font = `900 ${Math.round(this.AL * .050)}px system-ui,sans-serif`;
          X.fillStyle = "#fff";
          X.strokeText(partida.combo, 0, this.AL * .058);
          X.fillText(partida.combo, 0, this.AL * .058);
        }
        X.restore();
      }
    }
  }
}
