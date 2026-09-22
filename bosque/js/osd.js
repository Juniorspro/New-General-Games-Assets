// Los letreros de la cámara: PLAY, la fecha y la hora, el contador de cintas.
//
// SE DIBUJAN ADENTRO DE LA IMAGEN, NO ENCIMA. En una cinta de verdad la fecha
// la estampó la cámara al grabar, así que viaja con la señal y se degrada con
// ella: se corre, sangra y tiembla igual que el bosque. Un texto HTML nítido
// encima de un video borroso se ve pegado, y rompe la ilusión entera.
//
// LA HORA AVANZA Y EL SOL NO. Arranca a las 18:47 y corre en tiempo real,
// pero el atardecer está quieto. Nadie lo dice; el que mira el reloj lo nota.
import * as THREE from "three";

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

export class Osd {
  constructor() {
    this.lienzo = document.createElement("canvas");
    this.ctx = this.lienzo.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.lienzo);
    this.tex.colorSpace = THREE.NoColorSpace;    // se mezcla ya en sRGB
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.play = 0;         // segundos que quedan mostrando PLAY
    this.cintas = 0;
    this.total = 5;
    this.aviso = "";       // TRACKING, cuando hay interferencia
    this.inicio = 18 * 3600 + 47 * 60;
    this.t = 0;
    this.ultimo = "";
    this.tamano(16 / 9);
  }

  tamano(aspecto) {
    // mismo aspecto que la imagen, o las letras salen estiradas en un
    // teléfono parado
    const w = 640, h = Math.round(w / aspecto);
    if (this.lienzo.width === w && this.lienzo.height === h) return;
    this.lienzo.width = w; this.lienzo.height = h;
    this.ultimo = "";
  }

  paso(dt, visible) {
    this.t += dt;
    if (this.play > 0) this.play -= dt;
    const seg = Math.floor(this.inicio + this.t);
    const hh = Math.floor(seg / 3600) % 24, mm = Math.floor(seg / 60) % 60, ss = seg % 60;
    const parpadeo = Math.floor(this.t * 2) % 2;
    const estado = [visible, hh, mm, ss, this.play > 0 ? parpadeo : -1, this.cintas, this.aviso, this.aviso ? parpadeo : 0].join("|");
    if (estado === this.ultimo) return;
    this.ultimo = estado;
    this.dibujar(hh, mm, ss, parpadeo, visible);
  }

  dibujar(hh, mm, ss, parpadeo, visible) {
    const c = this.ctx, W = this.lienzo.width, H = this.lienzo.height;
    c.clearRect(0, 0, W, H);
    if (!visible) { this.tex.needsUpdate = true; return; }
    const m = 30, tam = 26;
    c.font = `bold ${tam}px "Courier New", ui-monospace, monospace`;
    c.textBaseline = "top";
    const texto = (s, x, y, alinear = "left") => {
      c.textAlign = alinear;
      // la sombra negra corrida: así imprimían las cámaras, para que la letra
      // se leyera sobre el cielo blanco
      c.fillStyle = "rgba(0,0,0,0.85)"; c.fillText(s, x + 2, y + 2);
      c.fillStyle = "#f4f4ec"; c.fillText(s, x, y);
    };
    if (this.play > 0) texto((parpadeo ? "▶ " : "  ") + "PLAY", m, m);
    texto("SP", W - m, m, "right");
    texto(`CINTAS ${this.cintas}/${this.total}`, W - m, m + tam * 1.3, "right");
    if (this.aviso && parpadeo) texto(this.aviso, W / 2, H * 0.42, "center");
    const h12 = ((hh + 11) % 12) + 1;
    texto(`${hh < 12 ? "AM" : "PM"} ${h12}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, m, H - m - tam * 2.5);
    texto(`${MESES[8]}. 22 1996`, m, H - m - tam * 1.2);
    this.tex.needsUpdate = true;
  }
}
