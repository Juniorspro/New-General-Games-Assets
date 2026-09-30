// Morfi: una caja de cartón con hambre de caramelos. Se dibuja entera con
// código, como un títere de papel: la caja se ve un poco desde arriba (en
// perspectiva), las dos tapas de arriba son su boca y se abren a medida que
// el caramelo se acerca, los ojos son dos círculos de papel pegados que lo
// siguen, y tiene bracitos y patitas de cartón.
//
// Estados de ánimo: esperando (respira, parpadea, mira alrededor y a veces
// bosteza), con ganas (el caramelo cerca: abre la boca, saca la lengua,
// levanta los brazos), feliz (comió: cierra de golpe, se aplasta, salta y
// baila) y triste (se perdió el caramelo).
import { clamp, lerp, azar, elastico } from './util.js';
import { redondo, tono } from './papel.js';

const W = 62, H = 46, D = 30;           // la caja: ancho, alto y fondo
export const TAM_MORFI = 1.3;            // se dibuja un 30 % más grande que su caja de base (chico se perdía en el tablero)
const FUGA = 0.22, SUBE = 0.5;          // la perspectiva: atrás se angosta y sube

// de 3D (X a la derecha, Y arriba, Z hacia el fondo) a la pantalla, sin girar
function pr(X, Y, Z) { const f = 1 - (FUGA * Z) / D; return [X * f, -Y - Z * SUBE]; }

export const PIELES_MORFI = {
  kraft: { frente: '#c99a5f', lado: '#a97a44', tapa: '#d9ad72', adentro: '#4a2e16', borde: '#7a5530' },
  regalo: { frente: '#e0566c', lado: '#b93d52', tapa: '#ea7488', adentro: '#5a1422', borde: '#8e2438', cinta: '#f5c542' },
  zapatos: { frente: '#6d8fa8', lado: '#56768e', tapa: '#8aa9c0', adentro: '#23303c', borde: '#3b5063', franja: '#e8edf1' },
  pizza: { frente: '#f1ece2', lado: '#d8d0bf', tapa: '#fbf8f1', adentro: '#6b4a2a', borde: '#b8ae98', letras: '#d7432f' },
  mudanza: { frente: '#b88a50', lado: '#95693a', tapa: '#c9a068', adentro: '#40260f', borde: '#6d4a25', cintas: true },
  menta: { frente: '#7fcfb0', lado: '#5fb294', tapa: '#9fe0c6', adentro: '#1c4a3b', borde: '#3e8a6f' },
  noche: { frente: '#3f4a8a', lado: '#2f386e', tapa: '#55619f', adentro: '#12162e', borde: '#1d2350', estrellas: true },
  jx: { frente: '#1f2126', lado: '#15161a', tapa: '#2c2f36', adentro: '#060607', borde: '#060607', jx: true },
};

export class Morfi {
  constructor(piel = 'kraft', semilla = 7) {
    this.piel = PIELES_MORFI[piel] ? piel : 'kraft';
    this.t = 0; this.r = azar(semilla);
    this.boca = 0;                  // cuánto abren las tapas (0 a 1)
    this.mira = [0, -1];            // hacia dónde miran los ojos (unitario)
    this.parpado = 0; this.proxParpadeo = 1.5;
    this.animo = 'espera'; this.tAnimo = 0;
    this.salto = 0; this.vy = 0;
    this.aplasta = 0;               // 1 = recién aplastado (el mordiscón)
    this.brazos = 0;                // 0 abajo, 1 arriba
    this.lengua = 0;
    this.bostezo = 0; this.quieto = 0;
    this.miraDistraida = null; this.tDistraida = 2;
  }

  // `blanco`: [x, y] adonde mirar (el caramelo, relativo a los pies de Morfi) o null
  // `ganas`: 0 a 1, qué tan cerca está el caramelo de la boca
  pasar(dt, { blanco = null, ganas = 0 } = {}) {
    this.t += dt; this.tAnimo += dt;
    const r = this.r;
    // hacia dónde mira: al caramelo; si no hay, de vez en cuando a otro lado
    let ox = 0, oy = -1;
    if (blanco && this.animo !== 'feliz') {
      const dx = blanco[0], dy = blanco[1] + H * 0.58, l = Math.hypot(dx, dy) || 1;
      ox = dx / l; oy = dy / l;
    } else if (this.animo === 'espera' || !blanco) {
      if ((this.tDistraida -= dt) <= 0) { this.miraDistraida = r() < 0.6 ? [r() * 2 - 1, r() * 1.4 - 0.9] : null; this.tDistraida = 1.2 + r() * 2.5; }
      if (this.miraDistraida) [ox, oy] = this.miraDistraida;
    }
    this.mira[0] += (ox - this.mira[0]) * Math.min(1, dt * 10);
    this.mira[1] += (oy - this.mira[1]) * Math.min(1, dt * 10);
    // parpadear (no con los ojos de feliz, que ya están cerrados)
    if ((this.proxParpadeo -= dt) <= 0) { this.parpado = 1; this.proxParpadeo = 1.8 + r() * 3.2; }
    this.parpado = Math.max(0, this.parpado - dt * 7);
    // la boca (las tapas)
    let boca = 0;
    if (this.animo === 'espera') {
      boca = ganas > 0 ? 0.25 + ganas * 0.85 : 0;
      // bostezo si nada pasa por un rato
      this.quieto = ganas > 0.05 ? 0 : this.quieto + dt;
      if (this.quieto > 9 && this.bostezo === 0) this.bostezo = 0.0001;
      if (this.bostezo > 0) { this.bostezo += dt; boca = Math.max(boca, Math.sin(Math.min(1, this.bostezo / 1.6) * Math.PI) * 0.75); if (this.bostezo > 1.6) { this.bostezo = 0; this.quieto = 0; } }
      else if (Math.sin(this.t * 0.7) > 0.995) boca = Math.max(boca, 0.12);   // un tic de las tapas
    } else if (this.animo === 'feliz') boca = this.tAnimo < 0.12 ? 0 : Math.max(0, Math.sin(this.tAnimo * 9) * 0.1);
    else if (this.animo === 'triste') boca = 0.18 + Math.sin(this.tAnimo * 3) * 0.05;
    const vel = boca > this.boca ? 9 : this.animo === 'feliz' ? 40 : 7;
    this.boca += (boca - this.boca) * Math.min(1, dt * vel);
    this.lengua += ((this.animo === 'espera' && ganas > 0.55 ? 1 : 0) - this.lengua) * Math.min(1, dt * 8);
    this.brazos += ((this.animo === 'feliz' ? 1 : this.animo === 'triste' ? -0.3 : ganas * 0.9) - this.brazos) * Math.min(1, dt * 6);
    // saltos y aplastones
    this.vy -= 900 * dt; this.salto = Math.max(0, this.salto + this.vy * dt);
    if (this.salto === 0 && this.vy < 0) this.vy = 0;
    this.aplasta = Math.max(0, this.aplasta - dt * 2.2);
    if (this.animo === 'feliz' && this.tAnimo > 0.45 && this.salto === 0 && this.tAnimo < 3.2 && ((this.tAnimo * 10) | 0) % 7 === 0) this.vy = 150;
    if (this.animo !== 'espera' && this.tAnimo > 3.5 && this.animo !== 'feliz') this.animar('espera');
  }

  animar(animo) {
    this.animo = animo; this.tAnimo = 0;
    if (animo === 'feliz') { this.aplasta = 1; this.vy = 210; this.boca = Math.min(this.boca, 1); }
    if (animo === 'espera') { this.quieto = 0; }
  }
  comer() { this.animar('feliz'); }
  llorar() { this.animar('triste'); }

  // Dibuja con los pies en (x, y); `s` = píxeles por unidad del tablero.
  dibujar(g, x, y, s, { sombra = true } = {}) {
    const c = PIELES_MORFI[this.piel], t = this.t;
    // la respiración y el aplastón (se aplasta en alto y se ensancha)
    const resp = Math.sin(t * 2.3) * 0.018;
    const ap = this.aplasta > 0 ? Math.sin(this.aplasta * Math.PI) * (this.aplasta > 0.5 ? 1 : 0.4) : 0;
    const sy = 1 + resp - ap * 0.2, sx = 1 - resp * 0.5 + ap * 0.14;
    const baile = this.animo === 'feliz' && this.tAnimo > 0.4 ? Math.sin(this.tAnimo * 11) * 0.07 * Math.max(0, 1 - (this.tAnimo - 2.5) / 1.5) : this.animo === 'triste' ? Math.sin(this.tAnimo * 2.5) * 0.03 : 0;
    g.save();
    g.translate(x, y);
    g.scale(s * TAM_MORFI, s * TAM_MORFI);
    // la sombra en el piso (más chica cuando salta)
    if (sombra) {
      const k = 1 - Math.min(0.5, this.salto / 60);
      g.fillStyle = 'rgba(40,24,8,0.28)';
      g.beginPath(); g.ellipse(4, 3, W * 0.62 * k * sx, 7 * k, 0, 0, Math.PI * 2); g.fill();
    }
    g.translate(0, -this.salto);
    g.rotate(baile);
    g.scale(sx, sy);
    // las patitas
    g.fillStyle = c.borde;
    for (const lado of [-1, 1]) {
      const paso = this.animo === 'feliz' ? Math.max(0, Math.sin(this.tAnimo * 11 + lado)) * 3 : 0;
      redondo(g, lado * 15 - 7, -3 - paso, 14, 8, 3.5); g.fill();
    }
    // los bracitos (atrás de la caja cuando están abajo)
    const brazo = (lado) => {
      const a = lerp(0.35, -2.2, clamp(this.brazos, -0.4, 1)) + Math.sin(t * 3 + lado) * 0.06 + (this.animo === 'feliz' ? Math.sin(this.tAnimo * 14) * 0.25 : 0);
      g.save(); g.translate(lado * (W / 2 - 2), -H * 0.55); g.scale(lado, 1); g.rotate(-a);
      g.fillStyle = c.lado; redondo(g, -3, 0, 7, 20, 3.5); g.fill();
      g.fillStyle = c.frente; g.beginPath(); g.arc(0.5, 20, 5, 0, Math.PI * 2); g.fill();
      g.restore();
    };
    brazo(-1); brazo(1);
    this.caja(g, c);
    g.restore();
  }

  caja(g, c) {
    const boca = this.boca, A = W / 2;
    // ── el lado de arriba: el hueco (la boca) y las tapas ──
    const tl = pr(-A, H, 0), tr = pr(A, H, 0), br = pr(A, H, D), bl = pr(-A, H, D);
    if (boca > 0.02) {
      g.fillStyle = c.adentro;
      g.beginPath(); g.moveTo(...tl); g.lineTo(...tr); g.lineTo(...br); g.lineTo(...bl); g.closePath(); g.fill();
      // la pared de atrás, adentro, un poco más clara: da hondura
      g.fillStyle = tono(c.adentro, 0.12);
      const f = pr(-A * 0.9, H - 6, D), f2 = pr(A * 0.9, H - 6, D);
      g.beginPath(); g.moveTo(...bl); g.lineTo(...br); g.lineTo(...f2); g.lineTo(...f); g.closePath(); g.fill();
      // la lengua de papel rosa: con ganas asoma apenas detrás de los dientes
      // y se relame de un lado a otro (más alta parecía un globo rosa)
      if (this.lengua > 0.05) {
        const l = this.lengua, [lx, ly] = pr(Math.sin(this.t * 5) * 5 * l, H - 3 + l * 4 + Math.sin(this.t * 12) * 0.8 * l, D * 0.32);
        g.fillStyle = '#e8799f'; g.beginPath(); g.ellipse(lx, ly, 8.5, 3.5 + l * 2.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#c95c82'; g.fillRect(lx - 0.6, ly - 2 - l, 1.2, 4 + l * 2);
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(lx - 3.5, ly - 1.2, 2.4, 1.2, -0.3, 0, Math.PI * 2); g.fill();
      }
      // los dientes de cartón en el borde de adelante
      g.fillStyle = '#fbf8f1';
      for (let k = 0; k < 6; k++) {
        const x0 = -A + 6 + k * ((W - 12) / 6), [px, py] = pr(x0, H, 0), [qx, qy] = pr(x0 + (W - 12) / 6, H, 0), [mx, my] = pr(x0 + (W - 12) / 12, H + 5, 2.5);
        g.beginPath(); g.moveTo(px, py); g.lineTo(mx, my); g.lineTo(qx, qy); g.closePath(); g.fill();
      }
    } else {
      g.fillStyle = c.tapa;
      g.beginPath(); g.moveTo(...tl); g.lineTo(...tr); g.lineTo(...br); g.lineTo(...bl); g.closePath(); g.fill();
    }
    // ── el frente ──
    const [fx0, fy0] = pr(-A, 0, 0), [fx1, fy1] = pr(A, H, 0);
    g.fillStyle = c.frente;
    redondo(g, fx0, fy1, fx1 - fx0, fy0 - fy1, 3); g.fill();
    // el corrugado que asoma en el borde de arriba y una sombra suave abajo
    g.fillStyle = tono(c.frente, -0.12); g.fillRect(fx0, fy0 - 5, fx1 - fx0, 5);
    g.strokeStyle = c.borde; g.lineWidth = 1.4; redondo(g, fx0, fy1, fx1 - fx0, fy0 - fy1, 3); g.stroke();
    this.adornos(g, c, fx0, fy1, fx1 - fx0, fy0 - fy1);
    this.cara(g, c);
    // ── las tapas: giran desde los bordes de arriba, izquierdo y derecho ──
    const tapa = (lado) => {
      // abierta hasta ~2,1 rad (se pasan de parado, como mandíbulas); temblando con ganas
      const th = boca * 2.1 + (boca > 0.3 ? Math.sin(this.t * 22 + lado) * 0.06 * boca : 0);
      const pts = [], u = A * 0.98;
      for (const [uu, z] of [[0, 0], [u, 0], [u, D], [0, D]]) pts.push(pr(lado * (A - uu * Math.cos(th)), H + uu * Math.sin(th), z));
      const cae = th > Math.PI / 2;
      // la cara de adentro de la tapa (más oscura) si ya pasó de parada
      g.fillStyle = cae ? tono(c.tapa, -0.28) : th > 0.9 ? tono(c.tapa, -0.1) : c.tapa;
      g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.fill();
      g.strokeStyle = c.borde; g.lineWidth = 1.2; g.stroke();
      // el pliegue marcado cerca de la bisagra
      g.strokeStyle = tono(c.tapa, -0.2); g.lineWidth = 0.8;
      const a = pr(lado * (A - 3 * Math.cos(th)), H + 3 * Math.sin(th), 0), b = pr(lado * (A - 3 * Math.cos(th)), H + 3 * Math.sin(th), D);
      g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
      // la cinta de regalo cruza también las tapas
      if (c.cinta) {
        g.fillStyle = c.cinta;
        const m0 = pr(lado * (A - u * 0.95 * Math.cos(th)), H + u * 0.95 * Math.sin(th), D * 0.42), m1 = pr(lado * (A - u * 0.95 * Math.cos(th)), H + u * 0.95 * Math.sin(th), D * 0.58);
        const h0 = pr(lado * A, H, D * 0.42), h1 = pr(lado * A, H, D * 0.58);
        g.beginPath(); g.moveTo(...h0); g.lineTo(...m0); g.lineTo(...m1); g.lineTo(...h1); g.closePath(); g.fill();
      }
    };
    // primero la que queda atrás según hacia dónde mira: las dos se ven parejas
    tapa(-1); tapa(1);
    // el moño del regalo, arriba de todo, cuando está cerrada
    if (c.cinta && boca < 0.3) {
      const [mx, my] = pr(0, H + 1, D * 0.5);
      g.fillStyle = c.cinta;
      for (const lado of [-1, 1]) { g.beginPath(); g.ellipse(mx + lado * 7, my - 3, 7, 4.5, lado * 0.5, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = tono(c.cinta, -0.2); g.beginPath(); g.arc(mx, my - 2, 3, 0, Math.PI * 2); g.fill();
    }
  }

  adornos(g, c, x, y, w, h) {
    if (c.cinta) { g.fillStyle = c.cinta; g.fillRect(x + w / 2 - 4, y, 8, h); }
    if (c.franja) { g.fillStyle = c.franja; g.fillRect(x, y + h * 0.18, w, 5); }
    if (c.letras) { g.fillStyle = c.letras; g.font = '900 9px "Arial Black", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PIZZA', x + w / 2, y + h * 0.86); }
    if (c.cintas) {
      g.fillStyle = 'rgba(214,178,120,0.85)'; g.fillRect(x, y + h * 0.78, w, 6);
      g.fillStyle = 'rgba(190,40,30,0.65)'; g.font = '900 6px "Arial Black", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FRÁGIL', x + w / 2, y + h * 0.78 + 3.2);
    }
    if (c.estrellas) { g.fillStyle = 'rgba(255,240,170,0.8)'; for (const [a, b] of [[0.12, 0.2], [0.85, 0.3], [0.7, 0.85], [0.2, 0.8]]) { g.beginPath(); g.arc(x + w * a, y + h * b, 1.3, 0, Math.PI * 2); g.fill(); } }
    if (c.jx) { g.fillStyle = '#c9ccd4'; g.font = '900 8px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('JXS', x + w / 2, y + h * 0.86); }
  }

  cara(g, c) {
    const ey = -H * 0.6, ex = W * 0.21, r = 9.2 * (1 + (this.animo === 'espera' ? this.boca * 0.12 : 0));
    const [mx, my] = this.mira;
    for (const lado of [-1, 1]) {
      const cx = lado * ex, cy = ey;
      // el ojo es un círculo de papel pegado: con su sombrita
      g.fillStyle = 'rgba(40,24,8,0.25)'; g.beginPath(); g.arc(cx + 0.8, cy + 1.2, r, 0, Math.PI * 2); g.fill();
      if (this.animo === 'feliz' && this.tAnimo > 0.1) {
        // feliz: ojitos cerrados como ^ ^
        g.strokeStyle = '#2a1c10'; g.lineWidth = 2.6; g.lineCap = 'round';
        g.beginPath(); g.arc(cx, cy + 3, r * 0.62, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        continue;
      }
      g.fillStyle = '#fbf8f1'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 0.8; g.stroke();
      const triste = this.animo === 'triste';
      const px = cx + mx * r * 0.42, py = cy + (triste ? r * 0.3 : my * r * 0.42);
      g.fillStyle = '#1d140c'; g.beginPath(); g.arc(px, py, r * 0.47, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px - r * 0.16, py - r * 0.18, r * 0.15, 0, Math.PI * 2); g.fill();
      // el párpado: parpadeo, sueño en el bostezo, pena en triste
      const cierre = Math.max(this.parpado > 0.5 ? 1 - (this.parpado - 0.5) * 2 : this.parpado * 2, this.bostezo > 0 ? 0.6 : 0, triste ? 0.4 : 0);
      if (cierre > 0.02) {
        g.save(); g.beginPath(); g.arc(cx, cy, r + 0.5, 0, Math.PI * 2); g.clip();
        g.fillStyle = c.frente; g.fillRect(cx - r - 1, cy - r - 1, 2 * r + 2, (2 * r + 2) * cierre);
        g.strokeStyle = c.borde; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - r, cy - r + (2 * r + 2) * cierre - 1); g.lineTo(cx + r, cy - r + (2 * r + 2) * cierre - 1); g.stroke();
        g.restore();
      }
      // las cejas: tiras de papel oscuro que dicen el ánimo
      const ceja = triste ? 0.35 * lado : this.boca > 0.4 ? -0.25 * lado : 0;
      g.save(); g.translate(cx, cy - r - 4 - (this.boca > 0.4 ? 2 : 0)); g.rotate(ceja);
      g.fillStyle = tono(c.borde, -0.25); redondo(g, -6, -1.3, 12, 2.6, 1.3); g.fill(); g.restore();
    }
    // los cachetes
    g.fillStyle = this.animo === 'feliz' ? 'rgba(240,110,140,0.55)' : 'rgba(240,110,140,0.3)';
    for (const lado of [-1, 1]) { g.beginPath(); g.ellipse(lado * W * 0.36, ey + 11, 5, 3, 0, 0, Math.PI * 2); g.fill(); }
    // la boquita del frente: sonrisa, "o" con ganas, o puchero triste
    g.strokeStyle = '#2a1c10'; g.lineWidth = 2; g.lineCap = 'round';
    const by = ey + 13;
    if (this.animo === 'feliz') { g.fillStyle = '#5a2b16'; g.beginPath(); g.arc(0, by - 1, 5.5, 0.1, Math.PI - 0.1); g.closePath(); g.fill(); }
    else if (this.animo === 'triste') { g.beginPath(); g.arc(0, by + 4, 4.5, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
    else if (this.boca > 0.35) { g.fillStyle = '#5a2b16'; g.beginPath(); g.ellipse(0, by, 3 + this.boca * 1.5, 2.5 + this.boca * 2.5, 0, 0, Math.PI * 2); g.fill(); }
    else { g.beginPath(); g.arc(0, by - 3, 4.5, 0.3, Math.PI - 0.3); g.stroke(); }
  }
}

// Dónde queda la boca (el hueco de arriba), desde los pies: para el juego.
export const BOCA_MORFI = [0, -(H + D * SUBE * 0.5) * TAM_MORFI];
export { elastico };
