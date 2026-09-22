// El dibujo. Neón vectorial, y todo lo caro cocinado una sola vez.
//
// LOS DESTELLOS VAN PRE-DIBUJADOS. `shadowBlur` se recalcula en cada llamada:
// con veinte notas en pantalla son veinte desenfoques por cuadro, y en un
// teléfono eso solo ya se come el presupuesto. Acá cada tipo de nota se dibuja
// UNA vez, con su resplandor, en un lienzo aparte, y después se estampa. Una
// estampa es una copia de píxeles y cuesta lo mismo tenga o no resplandor.

import { CARRILES } from "./carta.js";

export const COLORES = [
  { vivo: "#ff3d8b", flojo: "#7a1743" },   // carril grave
  { vivo: "#31e0c8", flojo: "#0f5d54" },   // medio
  { vivo: "#ffcc2f", flojo: "#7a5f0e" },   // agudo
];
const JUICIO = { perfecto: "#7cf6ff", bien: "#9dff6b", rozo: "#ffc247", error: "#ff5252" };

export class Pantalla {
  constructor(lienzo) {
    this.c = lienzo;
    this.x = lienzo.getContext("2d");
    this.chispas = [];
    this.anillos = [];
    this.sellos = null;
    this.medir();
  }

  medir() {
    /* EL LIENZO NO PASA DE UNOS DOS MILLONES Y MEDIO DE PIXELES.
       En una tablet, 768×1024 a densidad 2 son 3,1 millones de píxeles que hay
       que rellenar sesenta veces por segundo; medido, ahí los cuadros bajaban a
       54,8 por segundo. Lo que se dibuja son formas grandes de neón, no texto
       fino: bajar la densidad a 1,8 no se ve y devuelve los cuadros. En un
       teléfono normal el tope no se alcanza y la densidad queda intacta. */
    const TOPE = 2_600_000;
    const anCss = this.c.clientWidth || innerWidth, alCss = this.c.clientHeight || innerHeight;
    const cabe = Math.sqrt(TOPE / Math.max(1, anCss * alCss));
    this.dpr = Math.min(devicePixelRatio || 1, 2, Math.max(1, cabe));
    this.AN = anCss;
    this.AL = alCss;
    this.c.width = Math.round(this.AN * this.dpr);
    this.c.height = Math.round(this.AL * this.dpr);
    this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // La pista no ocupa todo el ancho: en un teléfono grande, tres carriles de
    // borde a borde obligan a estirar el pulgar hasta la esquina.
    this.anchoPista = Math.min(this.AN * 0.94, 520);
    this.x0 = (this.AN - this.anchoPista) / 2;
    this.anchoCarril = this.anchoPista / CARRILES;
    // La línea de juicio va abajo pero no pegada: el dedo tapa lo que toca, y
    // hace falta ver la nota entrar.
    this.linea = this.AL * 0.80;
    this.sellos = null;
    this.cocinarFondos();
  }

  /* LOS DEGRADADOS SE COCINAN AL MEDIR, NO EN CADA CUADRO.
     `createLinearGradient` y `createRadialGradient` construyen un objeto y su
     rampa de color cada vez que se los llama, y acá había tres por cuadro a
     pantalla completa. Medido en una tablet a 1536×2048: el cuadro costaba
     22,4 ms, o sea más que un cuadro entero a 60. Sólo dependen del tamaño de
     la pantalla, así que se rehacen cuando el tamaño cambia y no sesenta veces
     por segundo. */
  cocinarFondos() {
    const X = this.x;
    const rg = X.createRadialGradient(this.AN / 2, this.linea, 0, this.AN / 2, this.linea, this.AL * 0.55);
    rg.addColorStop(0, "rgba(120,60,200,1)");
    rg.addColorStop(1, "rgba(120,60,200,0)");
    this.gPulso = rg;
    this.gCarril = COLORES.map((col, c) => {
      const lg = X.createLinearGradient(0, this.linea - this.AL * .3, 0, this.linea);
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(1, col.vivo + "44");
      return lg;
    });
  }

  centroCarril(c) { return this.x0 + this.anchoCarril * (c + 0.5); }

  /** Cocina las notas con su resplandor. Se rehace sólo si cambia el tamaño. */
  cocinar() {
    const an = Math.round(this.anchoCarril * 0.74);
    const al = Math.round(Math.max(16, this.AL * 0.026));
    const pad = Math.round(al * 1.6);
    this.selloAn = an; this.selloAl = al; this.selloPad = pad;
    this.sellos = COLORES.map((col) => {
      const h = document.createElement("canvas");
      h.width = (an + pad * 2) * this.dpr; h.height = (al + pad * 2) * this.dpr;
      const g = h.getContext("2d");
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.shadowColor = col.vivo; g.shadowBlur = pad * 0.8;
      g.fillStyle = col.vivo;
      redondeado(g, pad, pad, an, al, al / 2); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "rgba(255,255,255,.85)";
      redondeado(g, pad + an * 0.14, pad + al * 0.26, an * 0.72, al * 0.3, al * 0.15); g.fill();
      return h;
    });
  }

  estampar(carril, cx, cy) {
    const s = this.sellos[carril], p = this.selloPad;
    this.x.drawImage(s, 0, 0, s.width, s.height,
      cx - this.selloAn / 2 - p, cy - this.selloAl / 2 - p,
      this.selloAn + p * 2, this.selloAl + p * 2);
  }

  chispear(carril, clase) {
    const cx = this.centroCarril(carril);
    const col = JUICIO[clase] || "#fff";
    this.anillos.push({ x: cx, y: this.linea, r: this.anchoCarril * 0.18, vida: 1, col });
    if (clase === "error") return;
    const n = clase === "perfecto" ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + Math.random();
      const v = 2.2 + Math.random() * 3.4;
      this.chispas.push({ x: cx, y: this.linea, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.2,
                          vida: 1, col });
    }
  }

  /** Un cuadro. `t` es la hora de la canción; `pulso` late con el bombo. */
  dibujar(partida, t, opciones) {
    const { anticipo, pulso, apretados, juicio } = opciones;
    const X = this.x;
    if (!this.sellos) this.cocinar();
    X.clearRect(0, 0, this.AN, this.AL);

    /* EL FONDO FIJO NO SE PINTA ACA: lo pone el CSS detrás del lienzo, y el
       navegador lo compone una sola vez en vez de rellenarlo sesenta veces por
       segundo. Un degradado a pantalla completa por cuadro era, en la tablet,
       más de tres millones de píxeles de trabajo que nunca cambiaban. */
    // el latido, y SOLO sobre el rectángulo que el halo alcanza: pintarlo a
    // pantalla completa era rellenar de transparente todo lo que queda afuera
    if (pulso > 0.01) {
      const r = this.AL * 0.55;
      X.globalAlpha = 0.20 * pulso;
      X.fillStyle = this.gPulso;
      X.fillRect(0, Math.max(0, this.linea - r), this.AN, Math.min(this.AL, r * 2));
      X.globalAlpha = 1;
    }

    // ── la pista ─────────────────────────────────────────────────────────
    X.fillStyle = "rgba(255,255,255,.028)";
    X.fillRect(this.x0, 0, this.anchoPista, this.AL);
    for (let c = 0; c <= CARRILES; c++) {
      X.strokeStyle = "rgba(255,255,255,.10)"; X.lineWidth = 1;
      X.beginPath(); X.moveTo(this.x0 + c * this.anchoCarril, 0);
      X.lineTo(this.x0 + c * this.anchoCarril, this.AL); X.stroke();
    }
    // el carril apretado se prende: sin eso no se ve si el toque entró
    for (let c = 0; c < CARRILES; c++) {
      if (!apretados[c]) continue;
      X.fillStyle = this.gCarril[c];
      X.fillRect(this.x0 + c * this.anchoCarril, this.linea - this.AL * .3, this.anchoCarril, this.AL * .3);
    }

    // ── las notas ────────────────────────────────────────────────────────
    const vel = this.linea / anticipo;          // píxeles por segundo
    const alto = this.selloAl;
    for (const n of partida.notas) {
      const dt = n.t - t;
      if (dt > anticipo + 0.1) break;           // ordenadas: lo que sigue está más lejos
      if (n.juzgada && n.largo === 0) continue;
      const y = this.linea - dt * vel;
      if (y > this.AL + 60) continue;
      const cx = this.centroCarril(n.carril);
      if (n.largo > 0) {
        // la sostenida es una barra; lo ya mantenido se apaga
        const y2 = this.linea - (n.t + n.largo - t) * vel;
        const col = COLORES[n.carril];
        X.fillStyle = n.juzgada ? col.flojo : col.vivo + "66";
        redondeado(X, cx - this.selloAn * .28, Math.min(y, y2), this.selloAn * .56, Math.abs(y - y2), this.selloAn * .28);
        X.fill();
      }
      if (!n.juzgada) this.estampar(n.carril, cx, y);
    }

    // ── la línea de juicio ───────────────────────────────────────────────
    X.strokeStyle = "rgba(255,255,255,.55)"; X.lineWidth = 2;
    X.beginPath(); X.moveTo(this.x0, this.linea); X.lineTo(this.x0 + this.anchoPista, this.linea); X.stroke();
    for (let c = 0; c < CARRILES; c++) {
      X.strokeStyle = COLORES[c].vivo; X.lineWidth = 3;
      X.globalAlpha = apretados[c] ? 1 : .5;
      X.beginPath();
      X.moveTo(this.x0 + c * this.anchoCarril + 6, this.linea);
      X.lineTo(this.x0 + (c + 1) * this.anchoCarril - 6, this.linea);
      X.stroke();
      X.globalAlpha = 1;
    }

    // ── chispas y anillos ────────────────────────────────────────────────
    for (let i = this.anillos.length - 1; i >= 0; i--) {
      const a = this.anillos[i]; a.vida -= 0.055; a.r += this.anchoCarril * 0.035;
      if (a.vida <= 0) { this.anillos.splice(i, 1); continue; }
      X.strokeStyle = a.col; X.globalAlpha = a.vida * .8; X.lineWidth = 3 * a.vida;
      X.beginPath(); X.arc(a.x, a.y, a.r, 0, 6.284); X.stroke(); X.globalAlpha = 1;
    }
    for (let i = this.chispas.length - 1; i >= 0; i--) {
      const s = this.chispas[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.22; s.vida -= 0.035;
      if (s.vida <= 0) { this.chispas.splice(i, 1); continue; }
      X.fillStyle = s.col; X.globalAlpha = s.vida;
      X.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      X.globalAlpha = 1;
    }

    // ── racha y juicio ───────────────────────────────────────────────────
    if (partida.combo >= 3) {
      X.textAlign = "center";
      X.fillStyle = "rgba(255,255,255,.90)";
      X.font = `800 ${Math.round(this.AL * .062)}px system-ui,sans-serif`;
      X.fillText(partida.combo, this.AN / 2, this.AL * .40);
      X.fillStyle = "rgba(255,255,255,.34)";
      X.font = `700 ${Math.round(this.AL * .017)}px system-ui,sans-serif`;
      X.fillText("×" + partida.multiplicador().toFixed(1), this.AN / 2, this.AL * .435);
    }
    if (juicio && juicio.texto) {
      const edad = t - juicio.t;
      if (edad >= 0 && edad < .55) {
        X.textAlign = "center";
        X.globalAlpha = 1 - edad / .55;
        X.fillStyle = JUICIO[juicio.clase] || "#fff";
        X.font = `800 ${Math.round(this.AL * .028)}px system-ui,sans-serif`;
        /* EL CARTEL VA DEBAJO DE LA LINEA. Arriba cae justo donde bajan las
           notas que vienen, y tapar lo que hay que leer para jugar es el peor
           lugar posible para poner un adorno. Debajo no hay nada. */
        X.fillText(juicio.texto, this.AN / 2, this.linea + this.AL * .055 + edad * 22);
        X.globalAlpha = 1;
      }
    }
  }
}

function redondeado(x, X0, Y0, an, al, r) {
  r = Math.min(r, an / 2, al / 2);
  x.beginPath();
  x.moveTo(X0 + r, Y0);
  x.arcTo(X0 + an, Y0, X0 + an, Y0 + al, r);
  x.arcTo(X0 + an, Y0 + al, X0, Y0 + al, r);
  x.arcTo(X0, Y0 + al, X0, Y0, r);
  x.arcTo(X0, Y0, X0 + an, Y0, r);
  x.closePath();
}
