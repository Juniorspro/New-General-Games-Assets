// El dibujo. Siluetas simples que se leen con doscientos bichos encima.
//
// LA SILUETA ANTES QUE EL DETALLE. Con cuarenta bichos arriba nadie mira una
// textura: mira si lo que viene es redondo, puntiagudo o cuadrado. Cada especie
// es una FORMA distinta y el color sólo confirma. Lo que les da carácter no es
// el detalle sino el MOVIMIENTO: patas que caminan, alas que baten, un cuerpo
// que se aplasta al golpear. Eso se lee aunque el bicho mida doce píxeles.
//
// Y TODO LO CARO SE COCINA UNA VEZ. Cada especie se dibuja con su resplandor en
// un lienzo aparte al arrancar y después se estampa. Un `shadowBlur` por bicho
// y por cuadro son doscientos desenfoques: ahí se va el teléfono.

import { BICHOS, ELITE } from "./bichos.js";
import { ARMAS, EVOLUCIONES, ENVION } from "./armas.js";
import { imagen } from "./assets.js";

export class Pantalla {
  constructor(lienzo) {
    this.c = lienzo;
    this.x = lienzo.getContext("2d");
    this.sacudida = 0;
    this.numeros = [];
    this.trozos = [];
    this.marcas = [];      // manchas del piso, para que no sea una grilla vacía
    this.sellos = null;
    this.destello = 0;
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

  /** La silueta de una especie, centrada en el origen. */
  silueta(g, forma, r) {
    g.beginPath();
    if (forma === "gota") {
      g.moveTo(0, -r);
      g.bezierCurveTo(r * 1.05, -r * .55, r * .95, r * .78, 0, r);
      g.bezierCurveTo(-r * .95, r * .78, -r * 1.05, -r * .55, 0, -r);
    } else if (forma === "punta") {
      g.moveTo(r, 0); g.lineTo(-r * .7, -r * .82); g.lineTo(-r * .28, 0); g.lineTo(-r * .7, r * .82);
      g.closePath();
    } else if (forma === "rombo") {
      g.moveTo(0, -r); g.lineTo(r * .8, 0); g.lineTo(0, r); g.lineTo(-r * .8, 0); g.closePath();
    } else {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283 + 0.52;
        const px = Math.cos(a) * r, py = Math.sin(a) * r * .84;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
    }
  }

  /** Cocina el cuerpo de cada especie con su resplandor, sin las partes que se
   *  mueven: esas se dibujan en vivo porque cambian en cada cuadro. */
  cocinar() {
    this.hojas = {};
    for (const [nombre, d] of Object.entries(BICHOS)) {
      const r = d.r, pad = Math.round(r * .8), lado = Math.round((r + pad) * 2);
      const h = document.createElement("canvas");
      h.width = h.height = lado * this.dpr;
      const g = h.getContext("2d");
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.translate(lado / 2, lado / 2);
      g.shadowColor = d.color; g.shadowBlur = pad * .8;
      g.fillStyle = d.color; this.silueta(g, d.forma, r); g.fill();
      g.shadowBlur = 0;
      // el borde oscuro: lo que hace que no se fundan entre ellos cuando se
      // amontonan, que es todo el tiempo
      g.strokeStyle = "rgba(8,4,16,.55)"; g.lineWidth = Math.max(1.5, r * .12);
      this.silueta(g, d.forma, r); g.stroke();
      // brillo de arriba
      g.fillStyle = "rgba(255,255,255,.16)";
      g.beginPath(); g.ellipse(-r * .2, -r * .44, r * .34, r * .17, -.5, 0, 6.283); g.fill();
      this.hojas[nombre] = { h, lado };
    }
    this.sellos = true;
  }

  sacudir(f) { this.sacudida = Math.min(16, this.sacudida + f); }
  fogonazo(f) { this.destello = Math.min(1, this.destello + f); }

  numero(x, y, texto, color) {
    if (this.numeros.length > 34) return;   // con doscientos bichos, no todos
    this.numeros.push({ x, y, texto, color, vida: 1 });
  }

  estallar(x, y, color, cuantos, fuerza = 1) {
    for (let i = 0; i < cuantos; i++) {
      const a = Math.random() * 6.283, v = (40 + Math.random() * 180) * fuerza;
      this.trozos.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 1, color,
                         r: (1.6 + Math.random() * 2.6) * fuerza });
    }
  }

  /** Manchas fijas del piso, sembradas una vez por partida. */
  sembrar(w) {
    this.marcas = [];
    const r = w.radioMapa;
    for (let i = 0; i < 150; i++) {
      const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r;
      this.marcas.push({ x: Math.cos(a) * d, y: Math.sin(a) * d,
                         r: 6 + Math.random() * 34, g: Math.random() * 6.283 });
    }
  }

  dibujar(w, dt, mando) {
    const X = this.x;
    if (!this.sellos) this.cocinar();
    if (!this.marcas.length) this.sembrar(w);
    const p = w.jugador, E = w.etapa;
    X.clearRect(0, 0, this.AN, this.AL);

    let sx = 0, sy = 0;
    if (this.sacudida > 0.1) {
      sx = (Math.random() - .5) * this.sacudida;
      sy = (Math.random() - .5) * this.sacudida;
      this.sacudida *= 0.86;
    }
    X.save();
    X.translate(this.AN / 2 - p.x + sx, this.AL / 2 - p.y + sy);

    this.piso(X, p, w, E);
    this.cosas(X, w, dt, E);
    X.restore();

    if (this.destello > 0.01) {
      X.fillStyle = `rgba(255,255,255,${this.destello * .35})`;
      X.fillRect(0, 0, this.AN, this.AL);
      this.destello *= 0.82;
    }
    this.hud(X, w, mando, E);
  }

  piso(X, p, w, E) {
    const x0 = p.x - this.AN, y0 = p.y - this.AL, an = this.AN * 2, al = this.AL * 2;
    X.fillStyle = E.piso; X.fillRect(x0, y0, an, al);

    // las manchas: sólo las que se ven, y se ven porque la cámara sigue al jugador
    X.fillStyle = E.niebla;
    for (const m of this.marcas) {
      if (Math.abs(m.x - p.x) > this.AN || Math.abs(m.y - p.y) > this.AL) continue;
      X.save(); X.translate(m.x, m.y); X.rotate(m.g);
      X.beginPath(); X.ellipse(0, 0, m.r, m.r * .62, 0, 0, 6.283); X.fill();
      X.restore();
    }

    const paso = 72;
    X.strokeStyle = E.reja; X.lineWidth = 1;
    X.beginPath();
    for (let x = Math.floor(x0 / paso) * paso; x < x0 + an; x += paso) { X.moveTo(x, y0); X.lineTo(x, y0 + al); }
    for (let y = Math.floor(y0 / paso) * paso; y < y0 + al; y += paso) { X.moveTo(x0, y); X.lineTo(x0 + an, y); }
    X.stroke();

    // el borde del mapa: se ve, así que nadie se sorprende al chocarlo
    X.strokeStyle = E.borde + "66"; X.lineWidth = 5;
    X.beginPath(); X.arc(0, 0, w.radioMapa, 0, 6.283); X.stroke();
    X.strokeStyle = E.borde + "1a"; X.lineWidth = 30;
    X.beginPath(); X.arc(0, 0, w.radioMapa + 15, 0, 6.283); X.stroke();
  }

  /** Un bicho, con lo que se mueve dibujado en vivo. */
  bicho(X, b, t) {
    const d = BICHOS[b.tipo], hoja = this.hojas[b.tipo];
    const esc = b.r / d.r;
    const anda = Math.sin(t * 9 + b.fase);
    // el cuerpo se aplasta al caminar y se estira al saltar: es lo que hace que
    // una mancha parezca un bicho y no un sprite arrastrado
    const ex = 1 + anda * 0.05 + (b.golpeado > 0 ? 0.22 : 0);
    const ey = 1 - anda * 0.05 - (b.golpeado > 0 ? 0.14 : 0);
    const img = imagen(`bicho-${b.tipo}.png`);
    const l = hoja.lado * esc;

    X.save();
    X.translate(b.x, b.y);
    if (b.elite) {
      X.strokeStyle = ELITE.aura; X.lineWidth = 2.5;
      X.globalAlpha = .55 + Math.sin(t * 5 + b.fase) * .2;
      X.beginPath(); X.arc(0, 0, b.r + 7, 0, 6.283); X.stroke();
      X.globalAlpha = 1;
    }
    // patas: dos palitos que alternan
    if (d.patas) {
      X.strokeStyle = "rgba(8,4,16,.5)"; X.lineWidth = Math.max(1.6, b.r * .14);
      for (const s of [-1, 1]) {
        X.beginPath();
        X.moveTo(s * b.r * .45, b.r * .5);
        X.lineTo(s * b.r * .62, b.r * (1.0 + s * anda * .22));
        X.stroke();
      }
    }
    // alas: dos elipses que baten rápido
    if (d.alas) {
      const bat = Math.abs(Math.sin(t * 26 + b.fase));
      X.fillStyle = "rgba(255,255,255,.28)";
      for (const s of [-1, 1]) {
        X.save(); X.translate(s * b.r * .7, -b.r * .2); X.rotate(s * (0.5 + bat * 0.7));
        X.beginPath(); X.ellipse(0, 0, b.r * .75, b.r * .28, 0, 0, 6.283); X.fill();
        X.restore();
      }
    }
    X.scale(ex, ey);
    if (img && img.complete && img.naturalWidth) X.drawImage(img, -l / 2, -l / 2, l, l);
    else X.drawImage(hoja.h, -l / 2, -l / 2, l, l);
    X.restore();

    // EL OJO MIRA AL JUGADOR. Es un detalle de dos círculos y es lo que hace
    // que cuarenta manchas se lean como cuarenta bichos que te vienen a buscar.
    const rr = b.r;
    X.fillStyle = "rgba(10,6,20,.85)";
    X.beginPath(); X.ellipse(b.x + b.mirada * rr * .18, b.y - rr * .1, rr * .3, rr * .34, 0, 0, 6.283); X.fill();
    X.fillStyle = "#fff";
    X.beginPath(); X.arc(b.x + b.mirada * rr * .26, b.y - rr * .18, rr * .13, 0, 6.283); X.fill();

    if (b.golpeado > 0) {
      X.save(); X.translate(b.x, b.y);
      X.globalAlpha = Math.min(1, b.golpeado * 6); X.fillStyle = "#fff";
      this.silueta(X, d.forma, b.r); X.fill();
      X.restore(); X.globalAlpha = 1;
    }
    // barra de vida sólo en los que aguantan: en una mota es ruido
    if ((d.vida >= 46 || b.elite) && b.vida < b.vidaMax && !d.jefe) {
      const an = b.r * 2;
      X.fillStyle = "rgba(0,0,0,.6)"; X.fillRect(b.x - an / 2, b.y - b.r - 10, an, 4);
      X.fillStyle = b.elite ? ELITE.aura : "#ff6ea9";
      X.fillRect(b.x - an / 2, b.y - b.r - 10, an * (b.vida / b.vidaMax), 4);
    }
  }

  cosas(X, w, dt, E) {
    const p = w.jugador, t = w.t;

    for (const s of w.semillas) {
      X.fillStyle = `rgba(138,208,106,${s.listo > 0 ? .10 : .18})`;
      X.beginPath(); X.arc(s.x, s.y, s.r, 0, 6.283); X.fill();
      X.strokeStyle = "rgba(138,208,106,.5)"; X.lineWidth = 2;
      X.beginPath(); X.arc(s.x, s.y, s.r, 0, 6.283); X.stroke();
    }
    // las raíces se unen entre sí
    for (let i = 1; i < w.semillas.length; i++) {
      const a = w.semillas[i], b = w.semillas[i - 1];
      if (!a.raiz || !b.raiz) continue;
      X.strokeStyle = "rgba(182,240,154,.5)"; X.lineWidth = 4;
      X.beginPath(); X.moveTo(a.x, a.y); X.lineTo(b.x, b.y); X.stroke();
    }
    for (const o of w.ondas) {
      const v = 1 - o.r / o.rMax;
      X.strokeStyle = `rgba(180,140,255,${v})`;
      X.lineWidth = 8 * v + 2;
      X.beginPath(); X.arc(o.x, o.y, o.r, 0, 6.283); X.stroke();
    }
    for (const g of w.gemas) {
      X.fillStyle = g.xp >= 6 ? "#ffd166" : "#7cf6ff";
      X.beginPath(); X.moveTo(g.x, g.y - g.r); X.lineTo(g.x + g.r, g.y);
      X.lineTo(g.x, g.y + g.r); X.lineTo(g.x - g.r, g.y); X.closePath(); X.fill();
    }
    for (const c of w.cofres) {
      const lat = 1 + Math.sin(t * 6) * .12;
      X.save(); X.translate(c.x, c.y); X.scale(lat, lat);
      X.fillStyle = "#ffd166"; X.fillRect(-c.r, -c.r * .8, c.r * 2, c.r * 1.6);
      X.fillStyle = "#8a6a1f"; X.fillRect(-c.r, -c.r * .15, c.r * 2, c.r * .3);
      X.restore();
    }

    // los bichos, ordenados por Y para que los de adelante tapen a los de atrás
    const lista = w.bichos;
    for (const b of lista) b.mirada = Math.sign(p.x - b.x) || 1;
    lista.sort((a, b) => a.y - b.y);
    for (const b of lista) this.bicho(X, b, t);

    // los jefes llevan su barra grande arriba de la cabeza
    for (const b of lista) {
      if (!BICHOS[b.tipo].jefe) continue;
      const an = b.r * 3;
      X.fillStyle = "rgba(0,0,0,.65)"; X.fillRect(b.x - an / 2 - 2, b.y - b.r - 20, an + 4, 9);
      X.fillStyle = BICHOS[b.tipo].color;
      X.fillRect(b.x - an / 2, b.y - b.r - 18, an * (b.vida / b.vidaMax), 5);
    }

    for (const b of w.balas) {
      X.fillStyle = "#ff9d6e";
      X.beginPath(); X.arc(b.x, b.y, b.r, 0, 6.283); X.fill();
      X.strokeStyle = "rgba(255,255,255,.6)"; X.lineWidth = 1.5;
      X.beginPath(); X.arc(b.x, b.y, b.r, 0, 6.283); X.stroke();
    }
    for (const l of w.latigos) {
      X.save(); X.translate(l.x, l.y); X.rotate(l.rumbo);
      X.fillStyle = `rgba(255,110,169,${l.vida * 4})`;
      X.fillRect(0, -l.ancho / 2, l.largo, l.ancho);
      X.restore();
    }
    for (const g of w.guadañas) {
      X.strokeStyle = `rgba(255,168,204,${g.vida * 3})`;
      X.lineWidth = 14;
      X.beginPath(); X.arc(p.x, p.y, g.radio, g.rumbo - .5, g.rumbo); X.stroke();
    }
    if (w.nivelArma("orbita")) {
      const a = w.datosArma("orbita");
      const col = w.evolucionada("orbita") ? EVOLUCIONES[w.jugador.evolucionadas.orbita].color : ARMAS.orbita.color;
      if (w.evolucionada("orbita")) {
        X.strokeStyle = col; X.lineWidth = a.grosor;
        X.globalAlpha = .55;
        X.beginPath(); X.arc(p.x, p.y, a.radio, 0, 6.283); X.stroke();
        X.globalAlpha = 1;
      } else {
        for (let k = 0; k < a.cuantos; k++) {
          const ang = w.anguloOrbita + (k / a.cuantos) * 6.283;
          X.fillStyle = col;
          X.beginPath(); X.arc(p.x + Math.cos(ang) * a.radio, p.y + Math.sin(ang) * a.radio, a.r, 0, 6.283); X.fill();
        }
      }
    }
    for (const q of w.tiros) {
      X.fillStyle = q.color || "#ffe066";
      X.beginPath(); X.arc(q.x, q.y, q.r, 0, 6.283); X.fill();
    }

    this.jugador(X, p, t);

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
      n.vida -= dt * 1.5; n.y -= dt * 44;
      if (n.vida <= 0) { this.numeros.splice(i, 1); continue; }
      X.globalAlpha = Math.min(1, n.vida * 1.6);
      X.fillStyle = n.color;
      X.font = `800 ${Math.round(13 + 7 * n.vida)}px system-ui,sans-serif`;
      X.fillText(n.texto, n.x, n.y);
    }
    X.globalAlpha = 1;
  }

  jugador(X, p, t) {
    const img = imagen("jugador.png");
    const parpadea = p.invulnerable > 0 && Math.floor(p.invulnerable * 20) % 2 === 0;
    // la estela del envión: se ve de dónde venís, que es lo que hace que el
    // envión se sienta rápido en vez de sólo teletransportarte
    if (p.envion > 0) {
      X.globalAlpha = .3; X.fillStyle = "#7cf6ff";
      for (let k = 1; k <= 4; k++) {
        X.beginPath();
        X.arc(p.x - p.envionDir.x * k * 15, p.y - p.envionDir.y * k * 15, p.r * (1 - k * .16), 0, 6.283);
        X.fill();
      }
      X.globalAlpha = 1;
    }
    if (parpadea) return;
    X.save(); X.translate(p.x, p.y); X.rotate(p.rumbo);
    if (img && img.complete && img.naturalWidth) {
      X.drawImage(img, -p.r * 1.9, -p.r * 1.9, p.r * 3.8, p.r * 3.8);
    } else {
      X.shadowColor = "#7cf6ff"; X.shadowBlur = 16;
      X.fillStyle = "#e8f4ff";
      X.beginPath();
      X.moveTo(p.r * 1.3, 0); X.lineTo(-p.r * .85, -p.r * .95);
      X.lineTo(-p.r * .3, 0); X.lineTo(-p.r * .85, p.r * .95);
      X.closePath(); X.fill();
      X.shadowBlur = 0;
      X.strokeStyle = "rgba(10,20,40,.5)"; X.lineWidth = 2; X.stroke();
      X.fillStyle = "#1a2740";
      X.beginPath(); X.arc(p.r * .3, 0, p.r * .28, 0, 6.283); X.fill();
    }
    X.restore();
  }

  hud(X, w, mando, E) {
    const p = w.jugador;
    X.fillStyle = "rgba(255,255,255,.10)"; X.fillRect(0, 0, this.AN, 7);
    X.fillStyle = "#7cf6ff";
    X.fillRect(0, 0, this.AN * Math.min(1, p.xp / p.xpNecesaria), 7);

    const an = Math.min(this.AN * .62, 280), x0 = (this.AN - an) / 2, y = 16;
    X.fillStyle = "rgba(0,0,0,.5)"; X.fillRect(x0 - 2, y - 2, an + 4, 12);
    X.fillStyle = "#ff3d5a"; X.fillRect(x0, y, an, 8);
    X.fillStyle = "#3ce06a"; X.fillRect(x0, y, an * Math.max(0, p.vida / p.vidaMax), 8);

    /* EL ENVION SE MUESTRA COMO UN ANILLO ALREDEDOR DEL PULGAR, y no como un
       número en una esquina. Es lo único que se aprieta en el juego: mirarlo
       tiene que costar cero, porque se lo necesita justo cuando no hay tiempo
       de mirar nada. */
    const listo = p.envionListo <= 0;
    const cx = this.AN - 52, cy = this.AL - 52 - 10;
    X.strokeStyle = listo ? "#7cf6ff" : "rgba(255,255,255,.18)";
    X.lineWidth = 4;
    X.beginPath();
    X.arc(cx, cy, 24, -Math.PI / 2, -Math.PI / 2 + 6.283 * (listo ? 1 : 1 - p.envionListo / ENVION.espera));
    X.stroke();
    X.fillStyle = listo ? "rgba(124,246,255,.16)" : "rgba(255,255,255,.05)";
    X.beginPath(); X.arc(cx, cy, 21, 0, 6.283); X.fill();
    X.fillStyle = listo ? "#7cf6ff" : "rgba(255,255,255,.35)";
    X.font = "800 15px system-ui,sans-serif"; X.textAlign = "center"; X.textBaseline = "middle";
    X.fillText("»", cx, cy + 1);
    X.textBaseline = "alphabetic";

    if (mando && mando.activo) {
      X.strokeStyle = "rgba(255,255,255,.22)"; X.lineWidth = 2;
      X.beginPath(); X.arc(mando.ox, mando.oy, mando.radio, 0, 6.283); X.stroke();
      X.fillStyle = "rgba(255,255,255,.30)";
      X.beginPath(); X.arc(mando.x, mando.y, mando.radio * .38, 0, 6.283); X.fill();
    }
  }
}
