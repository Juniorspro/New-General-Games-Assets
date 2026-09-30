// La intro de JXSTUDIOS en 2D, rápida (menos de tres segundos) y con
// movimiento de cámara: una raya de luz abre la fibra de carbono, la reja de
// metal entra desde los costados, el monograma se escribe con luz (cuatro
// puntas que dejan chispas), golpe con destello y onda, brillo que cruza el
// metal, la palabra JXStudios sube, y un empujón hacia adelante que da paso
// al juego. Arranca sola (main.js › esperarAudio). La música sale de
// sonido.js › jingleJXS, agendada con el mismo reloj; un toque la saltea.
import { monograma, palabra, puntas, CAJA } from './logojxs.js';
import { clamp, salida, salidaAtras } from './util.js';

const T = { raya: 0.16, abre: 0.5, traza: [0.15, 1.0], golpe: 1.05, brillo: [1.15, 1.7], palabra: 1.2, fin: 2.5, salto: 0.35 };

let carbono = null;
function patronCarbono(g) {
  if (carbono) return carbono;
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const q = c.getContext('2d');
  for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) {
    const s = ((x >> 1) + (y >> 1)) % 4 < 2;
    q.fillStyle = s ? '#27292e' : '#18191c'; q.fillRect(x, y, 2, 2);
    q.fillStyle = s ? '#2f3137' : '#1d1e22'; q.fillRect(x, y, 1, 1);
  }
  carbono = g.createPattern(c, 'repeat');
  return carbono;
}

// El fondo: carbono con un rombo al centro y la reja de metal alrededor.
function fondoJX(g, W, H, t, { entra = 1, zoom = 1 } = {}) {
  g.fillStyle = '#050506'; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(W / 2, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  const p = patronCarbono(g), esc = Math.max(1, Math.min(W, H) / 400);
  p.setTransform(new DOMMatrix([esc, 0, 0, esc, 0, 0]));
  g.fillStyle = p; g.fillRect(-W, -H, W * 3, H * 3);
  // la reja: barras de metal cepillado a ±45°, entrando desde los costados
  const paso = Math.min(W, H) * 0.22, grosor = paso * 0.1, rombo = Math.min(W, H) * 0.36;
  g.save();
  g.beginPath(); g.rect(-W, -H, W * 3, H * 3);
  g.moveTo(W / 2, H / 2 - rombo); g.lineTo(W / 2 - rombo, H / 2); g.lineTo(W / 2, H / 2 + rombo); g.lineTo(W / 2 + rombo, H / 2); g.closePath();
  g.clip('evenodd');
  const corre = (1 - salida(entra)) * W * 0.6;
  for (const lado of [-1, 1]) {
    g.save();
    g.translate(W / 2 + lado * corre, H / 2);
    g.rotate((lado * Math.PI) / 4);
    const metal = g.createLinearGradient(0, -grosor, 0, grosor);
    metal.addColorStop(0, '#5f646d'); metal.addColorStop(0.5, '#a3a8b1'); metal.addColorStop(1, '#3f434a');
    for (let k = -12; k <= 12; k++) {
      g.fillStyle = '#050506'; g.fillRect(-W * 2, k * paso - grosor / 2 - 2, W * 4, grosor + 4);
      g.fillStyle = metal; g.save(); g.translate(0, k * paso); g.fillRect(-W * 2, -grosor / 2, W * 4, grosor); g.restore();
    }
    g.restore();
  }
  g.restore();
  // el borde del rombo
  g.strokeStyle = '#8d929c'; g.lineWidth = Math.max(2, grosor * 0.35);
  g.beginPath(); g.moveTo(W / 2, H / 2 - rombo); g.lineTo(W / 2 - rombo, H / 2); g.lineTo(W / 2, H / 2 + rombo); g.lineTo(W / 2 + rombo, H / 2); g.closePath(); g.stroke();
  g.restore();
  // viñeta y un halo de luz arriba del centro
  const v = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,0.06)'); v.addColorStop(0.6, 'rgba(0,0,0,0.2)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
}

export class Intro {
  constructor({ sonido, vibrar = () => {}, alTerminar }) {
    this.t = 0; this.chispas = []; this.golpeado = false; this.terminado = false;
    this.alTerminar = alTerminar; this.vibrar = vibrar;
    this.musica = sonido.jingleJXS?.() || null;
    this.lienzoLogo = null;
  }
  saltear() {
    if (this.t < T.salto || this.terminado) return;
    this.musica?.cortar();
    this.t = Math.max(this.t, T.fin);
  }
  pasar(dt, W, H) {
    this.t += dt;
    const ancho = this.ancho(W, H);
    if (this.t > T.traza[0] && this.t < T.traza[1] && this.puntasPantalla) {
      for (const [x, y] of this.puntasPantalla) for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90;
        this.chispas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.3 + Math.random() * 0.3, col: Math.random() < 0.6 ? '#ffffff' : '#9fdcff' });
      }
    }
    if (!this.golpeado && this.t >= T.golpe) {
      this.golpeado = true;
      this.vibrar([30, 20, 40]);
      for (let k = 0; k < 120; k++) {
        const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 380;
        this.chispas.push({ x: W / 2 + (Math.random() - 0.5) * ancho * 0.8, y: H * 0.44 + (Math.random() - 0.5) * ancho * 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, vida: 0.5 + Math.random() * 0.7, col: ['#ffffff', '#ffe7a8', '#c9ccd4', '#9fdcff'][k % 4] });
      }
    }
    for (const c of this.chispas) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 0.95; c.vy = c.vy * 0.95 + 160 * dt; }
    this.chispas = this.chispas.filter((c) => c.t < c.vida);
    if (this.t >= T.fin + 0.35 && !this.terminado) { this.terminado = true; this.alTerminar?.(); }
  }
  ancho(W, H) { return Math.min(W * 0.72, H * 0.95, 760); }

  dibujar(g, W, H) {
    const t = this.t, ancho = this.ancho(W, H), cy = H * 0.44;
    g.save();
    // la sacudida del golpe
    const sac = t > T.golpe && t < T.golpe + 0.4 ? (1 - (t - T.golpe) / 0.4) * 10 * (W / 800) : 0;
    if (sac) g.translate((Math.random() - 0.5) * sac, (Math.random() - 0.5) * sac);
    // el empujón final hacia adelante
    const fin = clamp((t - T.fin) / 0.35, 0, 1), zoom = 1 + fin * fin * 0.6;
    if (t < T.raya) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const w = W * salida(t / T.raya);
      const gr = g.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(W / 2 - w / 2, cy - 1, w, 2);
      g.restore();
      return;
    }
    const abre = clamp((t - T.raya) / (T.abre - T.raya), 0, 1);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.save();
    const alto = (Math.max(cy, H - cy) + 10) * salidaAtras(abre);
    g.beginPath(); g.rect(0, cy - alto, W, alto * 2); g.clip();
    fondoJX(g, W, H, t, { entra: clamp((t - 0.2) / 0.6, 0, 1), zoom: (1.12 - 0.12 * salida(abre)) * zoom });
    g.restore();
    // el monograma: se escribe, golpea y brilla
    const avance = clamp((t - T.traza[0]) / (T.traza[1] - T.traza[0]), 0, 1);
    if (avance > 0) {
      const brillo = t > T.brillo[0] && t < T.brillo[1] ? (t - T.brillo[0]) / (T.brillo[1] - T.brillo[0]) : -1;
      const golpe = t >= T.golpe ? salida(clamp((t - T.golpe) / 0.25, 0, 1)) : 0;
      const escala = (avance < 1 ? 1 : 1 + (1 - golpe) * 0.06) * zoom;
      this.lienzoLogo = monograma(ancho * escala, { avance, brillo, lienzo: this.lienzoLogo });
      const m = this.lienzoLogo, x0 = W / 2 - m.width / 2, y0 = cy - m.height / 2;
      // mientras se escribe, las puntas brillan con luz
      if (avance < 1) {
        const esc = (ancho * escala) / CAJA.w;
        this.puntasPantalla = puntas(avance).map(([px, py]) => [x0 + m.margen + px * esc, y0 + m.margen + py * esc]);
        g.globalCompositeOperation = 'lighter';
        for (const [px, py] of this.puntasPantalla) {
          const r = ancho * 0.05, gr = g.createRadialGradient(px, py, 0, px, py, r);
          gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(160,220,255,0.5)'); gr.addColorStop(1, 'rgba(160,220,255,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      } else this.puntasPantalla = null;
      g.drawImage(m, x0, y0);
      // el destello y la onda del golpe
      if (t >= T.golpe && t < T.golpe + 0.5) {
        const k = (t - T.golpe) / 0.5;
        g.fillStyle = `rgba(255,255,255,${(1 - k) * (1 - k) * 0.9})`; g.fillRect(0, 0, W, H);
        g.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.7})`; g.lineWidth = 6 * (1 - k) + 1;
        g.beginPath(); g.arc(W / 2, cy, ancho * (0.3 + k * 0.9), 0, Math.PI * 2); g.stroke();
      }
    }
    // la palabra que sube
    if (t > T.palabra) {
      const k = salida(clamp((t - T.palabra) / 0.45, 0, 1));
      const p = this.palabraC || (this.palabraC = palabra(ancho * 0.72));
      g.globalAlpha = k;
      g.drawImage(p, W / 2 - (p.width * zoom) / 2, cy + ancho * 0.26 + (1 - k) * ancho * 0.08, p.width * zoom, p.height * zoom);
      g.globalAlpha = 1;
    }
    for (const c of this.chispas) {
      const a = 1 - c.t / c.vida;
      g.fillStyle = c.col; g.globalAlpha = a;
      g.fillRect(c.x - 1.5, c.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
    g.restore();
  }
}
