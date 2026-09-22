// El dibujo. Todo por código: siluetas simples que se leen con doscientos
// bichos en pantalla.
//
// LA SILUETA ANTES QUE EL DETALLE. Con cuarenta bichos encima, nadie mira una
// textura: mira si eso que viene es redondo, puntiagudo o cuadrado. Por eso
// cada especie es una FORMA distinta y el color sólo confirma.
//
// Y TODO LO CARO SE COCINA UNA VEZ. Cada especie se dibuja con su resplandor en
// un lienzo aparte al arrancar, y después se estampa. Un `shadowBlur` por bicho
// y por cuadro son doscientos desenfoques: ahí se va el teléfono.

import { BICHOS } from "./bichos.js";
import { ARMAS } from "./armas.js";
import { imagen } from "./assets.js";

const PISO = "#141021", PISO2 = "#1b1630";

export class Pantalla {
  constructor(lienzo) {
    this.c = lienzo;
    this.x = lienzo.getContext("2d");
    this.sacudida = 0;
    this.numeros = [];
    this.trozos = [];
    this.sellos = null;
    this.medir();
  }

  medir() {
    const TOPE = 2_600_000;
    const anCss = this.c.clientWidth || innerWidth, alCss = this.c.clientHeight || innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 2, Math.max(1, Math.sqrt(TOPE / Math.max(1, anCss * alCss))));
    this.AN = anCss; this.AL = alCss;
    this.c.width = Math.round(this.AN * this.dpr);
    this.c.height = Math.round(this.AL * this.dpr);
    this.x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.sellos = null;
  }

  /** Dibuja la silueta de una especie, centrada en el origen. */
  silueta(g, forma, r) {
    g.beginPath();
    if (forma === "gota") {
      g.moveTo(0, -r);
      g.bezierCurveTo(r * 1.05, -r * .55, r * .95, r * .75, 0, r);
      g.bezierCurveTo(-r * .95, r * .75, -r * 1.05, -r * .55, 0, -r);
    } else if (forma === "punta") {
      g.moveTo(r, 0); g.lineTo(-r * .7, -r * .8); g.lineTo(-r * .3, 0); g.lineTo(-r * .7, r * .8);
      g.closePath();
    } else if (forma === "rombo") {
      g.moveTo(0, -r); g.lineTo(r * .78, 0); g.lineTo(0, r); g.lineTo(-r * .78, 0); g.closePath();
    } else {                       // placa: un hexágono achatado
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283 + 0.52;
        const px = Math.cos(a) * r, py = Math.sin(a) * r * .82;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
    }
  }

  cocinar() {
    this.hojas = {};
    for (const [nombre, d] of Object.entries(BICHOS)) {
      const r = d.r, pad = Math.round(r * .75), lado = Math.round((r + pad) * 2);
      const h = document.createElement("canvas");
      h.width = h.height = lado * this.dpr;
      const g = h.getContext("2d");
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.translate(lado / 2, lado / 2);
      g.shadowColor = d.color; g.shadowBlur = pad * .8;
      g.fillStyle = d.color; this.silueta(g, d.forma, r); g.fill();
      g.shadowBlur = 0;
      // un ojo: es lo único que convierte una mancha en un bicho
      g.fillStyle = "rgba(10,6,20,.8)";
      g.beginPath(); g.ellipse(r * .12, -r * .12, r * .26, r * .3, 0, 0, 6.283); g.fill();
      g.fillStyle = "rgba(255,255,255,.92)";
      g.beginPath(); g.arc(r * .2, -r * .2, r * .11, 0, 6.283); g.fill();
      // brillo de arriba
      g.fillStyle = "rgba(255,255,255,.18)";
      g.beginPath(); g.ellipse(-r * .22, -r * .42, r * .3, r * .16, -.5, 0, 6.283); g.fill();
      this.hojas[nombre] = { h, lado };
    }
    this.sellos = true;
  }

  sacudir(f) { this.sacudida = Math.min(14, this.sacudida + f); }

  numero(x, y, texto, color) {
    if (this.numeros.length > 40) return;         // con doscientos bichos, no todos
    this.numeros.push({ x, y, texto, color, vida: 1 });
  }

  estallar(x, y, color, cuantos) {
    for (let i = 0; i < cuantos; i++) {
      const a = Math.random() * 6.283, v = 40 + Math.random() * 180;
      this.trozos.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, color,
                         r: 1.6 + Math.random() * 2.4 });
    }
  }

  dibujar(w, dt, mando) {
    const X = this.x;
    if (!this.sellos) this.cocinar();
    const p = w.jugador;
    X.clearRect(0, 0, this.AN, this.AL);

    // la cámara sigue al jugador, con la sacudida encima
    let sx = 0, sy = 0;
    if (this.sacudida > 0.1) {
      sx = (Math.random() - .5) * this.sacudida;
      sy = (Math.random() - .5) * this.sacudida;
      this.sacudida *= 0.86;
    }
    const cx = this.AN / 2 - p.x + sx, cy = this.AL / 2 - p.y + sy;
    X.save(); X.translate(cx, cy);

    this.piso(X, p, w);
    this.cosas(X, w, dt);
    X.restore();

    this.hud(X, w, mando);
  }

  piso(X, p, w) {
    // El piso se dibuja sólo donde se ve: pintar el mapa entero es pintar cinco
    // pantallas de las que se miran una.
    const x0 = p.x - this.AN, y0 = p.y - this.AL, an = this.AN * 2, al = this.AL * 2;
    X.fillStyle = PISO; X.fillRect(x0, y0, an, al);
    const paso = 64;
    X.strokeStyle = "rgba(255,255,255,.035)"; X.lineWidth = 1;
    X.beginPath();
    for (let x = Math.floor(x0 / paso) * paso; x < x0 + an; x += paso) { X.moveTo(x, y0); X.lineTo(x, y0 + al); }
    for (let y = Math.floor(y0 / paso) * paso; y < y0 + al; y += paso) { X.moveTo(x0, y); X.lineTo(x0 + an, y); }
    X.stroke();
    // el borde del mapa: se ve, así que nadie se sorprende al chocarlo
    X.strokeStyle = "rgba(255,110,169,.35)"; X.lineWidth = 4;
    X.beginPath(); X.arc(0, 0, w.radioMapa, 0, 6.283); X.stroke();
    X.strokeStyle = "rgba(255,110,169,.10)"; X.lineWidth = 26;
    X.beginPath(); X.arc(0, 0, w.radioMapa + 13, 0, 6.283); X.stroke();
  }

  cosas(X, w, dt) {
    const p = w.jugador;

    // semillas en el piso
    for (const s of w.semillas) {
      X.fillStyle = `rgba(138,208,106,${s.listo > 0 ? .12 : .20})`;
      X.beginPath(); X.arc(s.x, s.y, s.r, 0, 6.283); X.fill();
      X.strokeStyle = "rgba(138,208,106,.5)"; X.lineWidth = 2;
      X.beginPath(); X.arc(s.x, s.y, s.r, 0, 6.283); X.stroke();
    }
    // ondas
    for (const o of w.ondas) {
      X.strokeStyle = `rgba(180,140,255,${1 - o.r / o.rMax})`;
      X.lineWidth = 7 * (1 - o.r / o.rMax) + 2;
      X.beginPath(); X.arc(o.x, o.y, o.r, 0, 6.283); X.stroke();
    }
    // gemas
    for (const g of w.gemas) {
      X.fillStyle = "#7cf6ff";
      X.beginPath(); X.moveTo(g.x, g.y - g.r); X.lineTo(g.x + g.r, g.y);
      X.lineTo(g.x, g.y + g.r); X.lineTo(g.x - g.r, g.y); X.closePath(); X.fill();
    }
    // bichos
    for (const b of w.bichos) {
      const d = BICHOS[b.tipo], hoja = this.hojas[b.tipo];
      const img = imagen(`bicho-${b.tipo}.png`);
      const bamboleo = 1 + Math.sin(w.t * 7 + b.fase) * 0.05;
      const l = hoja.lado * bamboleo;
      if (img && img.complete && img.naturalWidth) {
        X.drawImage(img, b.x - l / 2, b.y - l / 2, l, l);
      } else {
        X.drawImage(hoja.h, b.x - l / 2, b.y - l / 2, l, l);
      }
      if (b.golpeado > 0) {
        X.globalAlpha = b.golpeado * 5;
        X.fillStyle = "#fff";
        this.contexto(X, b.x, b.y, () => this.silueta(X, d.forma, d.r));
        X.fill(); X.globalAlpha = 1;
      }
      // barra de vida sólo en los que aguantan: en una mota es ruido
      if (d.vida >= 50 && b.vida < b.vidaMax) {
        const an = d.r * 2;
        X.fillStyle = "rgba(0,0,0,.6)"; X.fillRect(b.x - an / 2, b.y - d.r - 9, an, 4);
        X.fillStyle = "#ff6ea9"; X.fillRect(b.x - an / 2, b.y - d.r - 9, an * (b.vida / b.vidaMax), 4);
      }
    }
    // latigazos
    for (const l of w.latigos) {
      X.save(); X.translate(l.x, l.y); X.rotate(l.rumbo);
      X.fillStyle = `rgba(255,110,169,${l.vida * 4})`;
      X.fillRect(0, -l.ancho / 2, l.largo, l.ancho);
      X.restore();
    }
    // órbita
    if (w.nivelArma("orbita")) {
      const a = w.datosArma("orbita");
      for (let k = 0; k < a.cuantos; k++) {
        const ang = w.anguloOrbita + (k / a.cuantos) * 6.283;
        const x = p.x + Math.cos(ang) * a.radio, y = p.y + Math.sin(ang) * a.radio;
        X.fillStyle = ARMAS.orbita.color;
        X.beginPath(); X.arc(x, y, a.r, 0, 6.283); X.fill();
      }
    }
    // tiros
    for (const t of w.tiros) {
      X.fillStyle = ARMAS.chispa.color;
      X.beginPath(); X.arc(t.x, t.y, t.r, 0, 6.283); X.fill();
    }
    // el jugador
    const img = imagen("jugador.png");
    const parpadea = p.invulnerable > 0 && (Math.floor(p.invulnerable * 18) % 2 === 0);
    if (!parpadea) {
      if (img && img.complete && img.naturalWidth) {
        X.drawImage(img, p.x - p.r * 1.8, p.y - p.r * 1.8, p.r * 3.6, p.r * 3.6);
      } else {
        X.save(); X.translate(p.x, p.y); X.rotate(p.rumbo);
        X.shadowColor = "#7cf6ff"; X.shadowBlur = 14;
        X.fillStyle = "#e8f4ff";
        X.beginPath();
        X.moveTo(p.r * 1.25, 0); X.lineTo(-p.r * .85, -p.r * .95);
        X.lineTo(-p.r * .35, 0); X.lineTo(-p.r * .85, p.r * .95);
        X.closePath(); X.fill();
        X.shadowBlur = 0;
        X.fillStyle = "#1a2740";
        X.beginPath(); X.arc(p.r * .25, 0, p.r * .3, 0, 6.283); X.fill();
        X.restore();
      }
    }
    // trozos y números
    for (let i = this.trozos.length - 1; i >= 0; i--) {
      const s = this.trozos[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= .93; s.vy *= .93; s.vida -= dt * 2.1;
      if (s.vida <= 0) { this.trozos.splice(i, 1); continue; }
      X.globalAlpha = s.vida; X.fillStyle = s.color;
      X.beginPath(); X.arc(s.x, s.y, s.r, 0, 6.283); X.fill();
    }
    X.globalAlpha = 1;
    X.textAlign = "center";
    for (let i = this.numeros.length - 1; i >= 0; i--) {
      const n = this.numeros[i];
      n.vida -= dt * 1.5; n.y -= dt * 42;
      if (n.vida <= 0) { this.numeros.splice(i, 1); continue; }
      X.globalAlpha = Math.min(1, n.vida * 1.6);
      X.fillStyle = n.color;
      X.font = `800 ${Math.round(13 + 6 * n.vida)}px system-ui,sans-serif`;
      X.fillText(n.texto, n.x, n.y);
    }
    X.globalAlpha = 1;
  }

  contexto(X, x, y, f) { X.save(); X.translate(x, y); X.beginPath(); f(); X.restore(); }

  hud(X, w, mando) {
    const p = w.jugador;
    // barra de experiencia, pegada arriba: es la que se mira todo el tiempo
    X.fillStyle = "rgba(255,255,255,.10)"; X.fillRect(0, 0, this.AN, 7);
    X.fillStyle = "#7cf6ff";
    X.fillRect(0, 0, this.AN * Math.min(1, p.xp / p.xpNecesaria), 7);
    // vida
    const an = Math.min(this.AN * .62, 280), x0 = (this.AN - an) / 2, y = 16;
    X.fillStyle = "rgba(0,0,0,.5)"; X.fillRect(x0 - 2, y - 2, an + 4, 12);
    X.fillStyle = "#ff3d5a"; X.fillRect(x0, y, an, 8);
    X.fillStyle = "#3ce06a"; X.fillRect(x0, y, an * Math.max(0, p.vida / p.vidaMax), 8);

    // el mando, donde el dedo lo puso
    if (mando && mando.activo) {
      X.strokeStyle = "rgba(255,255,255,.22)"; X.lineWidth = 2;
      X.beginPath(); X.arc(mando.ox, mando.oy, mando.radio, 0, 6.283); X.stroke();
      X.fillStyle = "rgba(255,255,255,.30)";
      X.beginPath(); X.arc(mando.x, mando.y, mando.radio * .38, 0, 6.283); X.fill();
    }
  }
}
