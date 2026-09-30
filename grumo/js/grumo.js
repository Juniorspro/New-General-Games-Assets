// Grumo: un grumo de plastilina con mal humor (el ceño de una sola ceja),
// que solo quiere llegar a la puerta. Se dibuja a 12 poses por segundo,
// como un muñeco de stop motion: el cuerpo tiene tres versiones del
// contorno que se turnan (el hervor de la plastilina tocada entre foto y
// foto), se estira al saltar, se aplasta al caer y queda hecho una tortilla
// cuando muere. Los ojos, la ceja, la boca, las patitas y el sombrero van
// arriba del cuerpo y se estiran con él.
import { armarPieza, guardado } from './plastilina.js';
import { azar, hash, tono, rgba, clamp } from './util.js';

export const PIELES = [
  { id: 'naranja', color: '#f28a2e', precio: 0 },
  { id: 'limon', color: '#f2cb35', precio: 30 },
  { id: 'menta', color: '#74d1ad', precio: 45 },
  { id: 'cielo', color: '#67aef0', precio: 60 },
  { id: 'chicle', color: '#f394bd', precio: 75 },
  { id: 'uva', color: '#9d78de', precio: 90 },
  { id: 'carbon', color: '#4a4d58', precio: 110 },
  { id: 'marmol', color: '#f28a2e', vetas: ['#f6d24a', '#e4553f', '#fff4d8'], precio: 150 },
  { id: 'oro', color: '#e6b23a', brillo: 0.8, precio: 260 },
];
export const SOMBREROS = [
  { id: 'nada', precio: 0 },
  { id: 'fiesta', precio: 40 },
  { id: 'boina', precio: 65 },
  { id: 'galera', precio: 95 },
  { id: 'helice', precio: 125 },
  { id: 'chef', precio: 160 },
  { id: 'corona', precio: 230 },
];
export const pielDe = (id) => PIELES.find((p) => p.id === id) || PIELES[0];

// el cuerpo: un óvalo gordito (superelipse) con la panza apoyada, y un
// temblequeo distinto en cada versión
function contorno(w, h, v) {
  const r = azar(900 + v * 31), f1 = r() * 6.28, f2 = r() * 6.28, a1 = 0.022 + r() * 0.012, a2 = 0.015 + r() * 0.01;
  const cx = w / 2, cy = h * 0.53, rx = w * 0.46, ry = h * 0.47, n = 2.5, p = new Path2D();
  for (let k = 0; k <= 64; k++) {
    const t = (k / 64) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    let x = Math.sign(c) * Math.abs(c) ** (2 / n), y = Math.sign(s) * Math.abs(s) ** (2 / n);
    // abajo, más ancho y más plano: está sentado en el piso
    if (y > 0) { x *= 1 + 0.07 * y; y *= 0.9; }
    const q = 1 + a1 * Math.sin(3 * t + f1) + a2 * Math.sin(5 * t + f2);
    const px = cx + rx * x * q, py = cy + ry * y * q;
    if (k) p.lineTo(px, py); else p.moveTo(px, py);
  }
  p.closePath();
  return p;
}
function cuerpo(piel, ts, v) {
  return guardado(`grumo:${piel.id}:${ts}:${v}`, () => {
    const w = Math.round(ts * 1.0), h = Math.round(ts * 0.9);
    return armarPieza(w, h, () => contorno(w, h, v), piel.color, {
      px: ts * 0.75, semilla: 50 + v, borroso: ts * 0.07, luz: 0.55, brillo: piel.brillo ?? 0.42, oscuridad: 0.35,
      // el marmolado: vetas de otros colores amasadas adentro
      pintar: piel.vetas ? (g, m) => {
        const r = azar(12 + v);
        g.save(); g.globalCompositeOperation = 'source-atop'; g.lineCap = 'round';
        for (let k = 0; k < 7; k++) {
          g.strokeStyle = piel.vetas[k % piel.vetas.length]; g.lineWidth = ts * (0.05 + r() * 0.06);
          g.beginPath(); let x = m + r() * w, y = m + r() * h; g.moveTo(x, y);
          for (let s = 0; s < 4; s++) { const nx = x + (r() - 0.5) * w * 0.6, ny = y + (r() - 0.5) * h * 0.5; g.quadraticCurveTo((x + nx) / 2 + (r() - 0.5) * w * 0.3, (y + ny) / 2, nx, ny); x = nx; y = ny; }
          g.stroke();
        }
        g.restore();
      } : null,
    });
  });
}

export class Grumo {
  constructor(piel = 'naranja', sombrero = 'nada') {
    this.piel = piel; this.sombrero = sombrero;
    this.t = 0; this.aplasta = 0; this.estira = 0; this.susto = 0; this.mareo = 0;
    this.parpadea = 2.5; this.muerto = null; this.gano = null; this.mira = 1; this.vy = 0; this.suelo = true;
    this.pose = 'quieto'; this.agarrado = false; this.vx = 0; this.feliz = 0;
  }
  // lo que pasó en la partida: la cara y el cuerpo reaccionan
  evento(ev) {
    switch (ev.tipo) {
      case 'aterriza': this.aplasta = clamp((ev.v || 0) / 16, 0.35, 1); break;
      case 'salto': this.estira = 1; break;
      case 'resorte': this.estira = 1.3; break;
      case 'trampa': case 'mano': case 'cae': case 'aparece': case 'mueve': case 'puerta': this.susto = 0.7; break;
      case 'bonk': this.mareo = 1.1; this.susto = 0.4; break;
      case 'empujon': this.susto = 0.8; break;
      case 'muere': this.muerto = { t: 0, causa: ev.causa }; break;
      case 'gana': this.gano = { t: 0 }; break;
    }
  }
  reiniciar() { this.muerto = null; this.gano = null; this.aplasta = 0; this.estira = 0; this.susto = 0; this.mareo = 0; this.nace = 0; }
  // j: el estado de Grumo en la partida (o null en los menús)
  pasar(dt, j = null) {
    this.t += dt;
    this.aplasta = Math.max(0, this.aplasta - dt * 5.5);
    this.estira = Math.max(0, this.estira - dt * 4);
    this.susto = Math.max(0, this.susto - dt);
    this.mareo = Math.max(0, this.mareo - dt);
    this.feliz = Math.max(0, this.feliz - dt);
    if (this.nace !== undefined) this.nace += dt;
    if (this.muerto) this.muerto.t += dt;
    if (this.gano) this.gano.t += dt;
    this.parpadea -= dt;
    if (this.parpadea < -0.09) this.parpadea = 2 + hash(Math.floor(this.t * 10)) * 2.5;
    if (j) {
      if (j.mira) this.mira = j.mira;
      this.vy = j.vy; this.vx = j.vx; this.suelo = j.suelo; this.agarrado = j.agarrado;
    }
  }
  // (x, y) = los pies, en píxeles del lienzo; ts = el tamaño de una celda
  dibujar(g, x, y, ts, cuadro, { escala = 1, alfa = 1 } = {}) {
    const piel = pielDe(this.piel), s = ts * escala;
    let sx = 1, sy = 1, ang = 0, dy = 0, pies = 0, ojos = 'normal', boca = 'ceño', ceja = 'ceño';
    const f = cuadro % 4;
    // la pose sale del cuadro de 12 por segundo: nada se mueve "entre fotos"
    if (this.muerto) {
      const k = this.muerto.t;
      sx = k < 0.08 ? 1.35 : 1.75; sy = k < 0.08 ? 0.55 : 0.26; ojos = 'x'; boca = 'o'; ceja = 'nada';
      if (this.muerto.causa === 'caida') { sy = 1.1; sx = 0.9; ojos = 'grandes'; ceja = 'susto'; }
    } else if (this.agarrado) {
      sx = 0.84; sy = 1.22; ojos = 'enojo'; ceja = 'enojo'; boca = 'grito'; pies = Math.sin(cuadro * 1.3) * 0.5; dy = 0;
    } else if (this.gano) {
      sy = 1 + Math.abs(Math.sin(cuadro * 1.2)) * 0.08; ojos = 'feliz'; ceja = 'feliz'; boca = 'sonrisa';
    } else if (!this.suelo) {
      if (this.vy < 0) { sx = 0.9; sy = 1.12; boca = 'o'; } else { sx = 0.96; sy = 1.05; ojos = 'grandes'; }
      pies = this.vy < 0 ? -0.6 : 0.4;
    } else if (Math.abs(this.vx) > 0.6) {
      sy = [0.95, 1.05, 0.95, 1.05][f]; sx = 2 - sy; dy = [0, -0.05, 0, -0.05][f]; ang = this.mira * 0.09; pies = [1, 0, -1, 0][f];
    } else {
      const res = Math.sin(cuadro * 0.45);
      sy = 1 + res * 0.025; sx = 1 - res * 0.015;
    }
    if (this.aplasta > 0 && !this.muerto) { const a = this.aplasta; sx *= 1 + 0.24 * a; sy *= 1 - 0.24 * a; }
    if (this.estira > 0.6 && !this.muerto) { sx *= 0.93; sy *= 1.08; }
    if (this.susto > 0 && !this.muerto && !this.gano && !this.agarrado) { ojos = 'grandes'; ceja = 'susto'; if (this.suelo) boca = 'o'; }
    if (this.mareo > 0 && !this.muerto) { ojos = 'mareo'; }
    if (this.parpadea < 0 && ojos === 'normal') ojos = 'cerrados';
    // al renacer se rearma: de tortilla a grumo en cuatro cuadros
    if (this.nace !== undefined && this.nace < 0.34 && !this.muerto) { const k = Math.floor(this.nace * 12) / 4; sy *= 0.35 + 0.65 * k; sx *= 1.5 - 0.5 * k; }

    // el hervor: quieto cambia de versión cada dos cuadros; moviéndose, en cada uno
    const v = (Math.abs(this.vx) > 0.6 || !this.suelo || this.muerto ? cuadro : Math.floor(cuadro / 2)) % 3;
    const cp = cuerpo(piel, Math.round(s), v);
    const w = Math.round(s * 1.0), h = Math.round(s * 0.9);
    g.save();
    if (alfa < 1) g.globalAlpha = alfa;
    g.translate(x, y + dy * s);
    // las patitas, abajo del cuerpo (se ven cuando camina o salta)
    if (!this.muerto) this.patitas(g, s, piel, pies, sx);
    g.rotate(ang);
    g.scale(sx, sy);
    // sombra en el piso (achatada) y el cuerpo, apoyado en (0, 0)
    g.drawImage(cp.sombra, -w / 2 - cp.m + s * 0.04, -h - cp.m + s * 0.06);
    g.drawImage(cp.img, -w / 2 - cp.m, -h - cp.m);
    // la cara, en coordenadas del cuerpo (se estira con él)
    this.cara(g, s, piel, ojos, ceja, boca, cuadro);
    if (this.sombrero !== 'nada' && !this.muerto) sombrero(g, this.sombrero, s, cuadro, -h * 0.98);
    g.restore();
  }
  patitas(g, s, piel, paso, sx) {
    const col = tono(piel.color, -0.28);
    for (const lado of [-1, 1]) {
      const px = lado * s * 0.2 * sx + paso * lado * s * 0.07, py = paso * lado > 0 ? -s * 0.04 : 0;
      g.fillStyle = rgba('#000000', 0.18); g.beginPath(); g.ellipse(px + s * 0.02, s * 0.03, s * 0.12, s * 0.04, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(px, py - s * 0.02, s * 0.11, s * 0.065, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = rgba('#ffffff', 0.25); g.beginPath(); g.ellipse(px - s * 0.03, py - s * 0.05, s * 0.05, s * 0.02, 0, 0, Math.PI * 2); g.fill();
    }
  }
  cara(g, s, piel, ojos, ceja, boca, cuadro) {
    const oscuro = tono(piel.color, -0.62), mirX = this.mira * s * 0.035, mirY = clamp(this.vy * 0.004, -0.03, 0.03) * s;
    const ey = -s * 0.55;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // los ojos: dos bolitas blancas pegadas, con la pupila y su brillo
    for (const lado of [-1, 1]) {
      const ex = lado * s * 0.13 + this.mira * s * 0.03;
      if (ojos === 'cerrados' || ojos === 'feliz') {
        g.strokeStyle = oscuro; g.lineWidth = s * 0.04; g.beginPath();
        if (ojos === 'feliz') g.arc(ex, ey + s * 0.03, s * 0.07, Math.PI * 1.15, Math.PI * 1.85);
        else { g.moveTo(ex - s * 0.07, ey); g.quadraticCurveTo(ex, ey + s * 0.04, ex + s * 0.07, ey); }
        g.stroke();
        continue;
      }
      if (ojos === 'x') {
        g.strokeStyle = oscuro; g.lineWidth = s * 0.045;
        g.beginPath(); g.moveTo(ex - s * 0.06, ey - s * 0.06); g.lineTo(ex + s * 0.06, ey + s * 0.06); g.moveTo(ex + s * 0.06, ey - s * 0.06); g.lineTo(ex - s * 0.06, ey + s * 0.06); g.stroke();
        continue;
      }
      const big = ojos === 'grandes' ? 1.22 : 1, rx = s * 0.085 * big, ry = s * 0.105 * big;
      g.fillStyle = rgba('#000000', 0.18); g.beginPath(); g.ellipse(ex + s * 0.012, ey + s * 0.018, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fbf8f0'; g.beginPath(); g.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2); g.fill();
      if (ojos === 'mareo') {
        g.strokeStyle = oscuro; g.lineWidth = s * 0.022; g.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.3) { const rr = (a / (Math.PI * 4)) * rx * 0.8, aa = a + cuadro * 0.9 * lado; g.lineTo(ex + Math.cos(aa) * rr, ey + Math.sin(aa) * rr); }
        g.stroke();
        continue;
      }
      const pr = s * (ojos === 'enojo' ? 0.045 : 0.05);
      g.fillStyle = '#1d1712'; g.beginPath(); g.arc(ex + mirX, ey + mirY + s * 0.01, pr, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ex + mirX - pr * 0.35, ey + mirY - pr * 0.3, pr * 0.35, 0, Math.PI * 2); g.fill();
    }
    // la ceja: un chorizo de plastilina oscura sobre los dos ojos (el ceño)
    if (ceja !== 'nada') {
      const cy = -s * 0.72, cx = this.mira * s * 0.03;
      const tiritas = {
        ceño: [[-0.25, -0.02], [-0.03, 0.05], [0.03, 0.05], [0.25, -0.02]],
        enojo: [[-0.25, -0.05], [-0.03, 0.08], [0.03, 0.08], [0.25, -0.05]],
        susto: [[-0.25, 0.03], [-0.08, -0.07], [0.08, -0.07], [0.25, 0.03]],
        feliz: [[-0.24, 0.02], [-0.08, -0.03], [0.08, -0.03], [0.24, 0.02]],
      }[ceja];
      const camino = () => { g.beginPath(); g.moveTo(cx + tiritas[0][0] * s, cy + tiritas[0][1] * s); g.bezierCurveTo(cx + tiritas[1][0] * s, cy + tiritas[1][1] * s, cx + tiritas[2][0] * s, cy + tiritas[2][1] * s, cx + tiritas[3][0] * s, cy + tiritas[3][1] * s); };
      g.strokeStyle = rgba('#000000', 0.2); g.lineWidth = s * 0.085; g.save(); g.translate(s * 0.01, s * 0.02); camino(); g.stroke(); g.restore();
      g.strokeStyle = oscuro; g.lineWidth = s * 0.075; camino(); g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.22); g.lineWidth = s * 0.02; g.save(); g.translate(-s * 0.008, -s * 0.018); camino(); g.stroke(); g.restore();
    }
    // la boca
    const by = -s * 0.33, bx = this.mira * s * 0.03;
    g.strokeStyle = oscuro; g.lineWidth = s * 0.035;
    if (boca === 'ceño') { g.beginPath(); g.moveTo(bx - s * 0.07, by + s * 0.02); g.quadraticCurveTo(bx, by - s * 0.03, bx + s * 0.07, by + s * 0.02); g.stroke(); }
    else if (boca === 'sonrisa') { g.beginPath(); g.moveTo(bx - s * 0.08, by - s * 0.01); g.quadraticCurveTo(bx, by + s * 0.07, bx + s * 0.08, by - s * 0.01); g.stroke(); g.fillStyle = rgba('#ff7a8a', 0.4); for (const l of [-1, 1]) { g.beginPath(); g.ellipse(bx + l * s * 0.26, by - s * 0.08, s * 0.06, s * 0.035, 0, 0, Math.PI * 2); g.fill(); } }
    else {
      const rx = boca === 'grito' ? s * 0.07 : s * 0.045, ry = boca === 'grito' ? s * 0.06 : s * 0.05;
      g.fillStyle = '#3a1410'; g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d0455a'; g.beginPath(); g.ellipse(bx, by + ry * 0.4, rx * 0.6, ry * 0.4, 0, 0, Math.PI * 2); g.fill();
    }
  }
}

// ── los sombreros de la tienda (arriba de la cabeza: y = tope) ──────────────
function sombrero(g, id, s, cuadro, tope) {
  g.save(); g.translate(0, tope + s * 0.05);
  const sombra = () => { g.shadowColor = 'rgba(30,15,5,0.3)'; g.shadowBlur = s * 0.06; g.shadowOffsetX = s * 0.02; g.shadowOffsetY = s * 0.03; };
  const sin = () => { g.shadowColor = 'transparent'; };
  if (id === 'fiesta') {
    g.rotate(0.18); sombra();
    g.fillStyle = '#4fa3e8'; g.beginPath(); g.moveTo(-s * 0.17, 0); g.lineTo(0, -s * 0.5); g.lineTo(s * 0.17, 0); g.closePath(); g.fill(); sin();
    g.save(); g.clip(); g.fillStyle = '#ffd24a'; for (let k = 0; k < 4; k++) { g.save(); g.translate(0, -s * 0.12 * k); g.rotate(-0.4); g.fillRect(-s * 0.3, -s * 0.02, s * 0.6, s * 0.045); g.restore(); } g.restore();
    g.fillStyle = '#e4553f'; g.beginPath(); g.arc(0, -s * 0.52, s * 0.06, 0, Math.PI * 2); g.fill();
  } else if (id === 'boina') {
    sombra(); g.fillStyle = '#d23b3b'; g.beginPath(); g.ellipse(s * 0.04, -s * 0.04, s * 0.3, s * 0.09, 0.08, 0, Math.PI * 2); g.fill(); sin();
    g.fillStyle = '#a82828'; g.fillRect(s * 0.01, -s * 0.17, s * 0.03, s * 0.06);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-s * 0.06, -s * 0.08, s * 0.14, s * 0.03, 0.08, 0, Math.PI * 2); g.fill();
  } else if (id === 'galera') {
    sombra(); g.fillStyle = '#26232b'; g.beginPath(); g.ellipse(0, 0, s * 0.3, s * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(-s * 0.18, -s * 0.4, s * 0.36, s * 0.4); sin();
    g.fillStyle = '#d23b3b'; g.fillRect(-s * 0.18, -s * 0.11, s * 0.36, s * 0.07);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(-s * 0.14, -s * 0.38, s * 0.05, s * 0.26);
  } else if (id === 'helice') {
    sombra(); g.fillStyle = '#e4553f'; g.beginPath(); g.arc(0, 0, s * 0.2, Math.PI, 0); g.fill(); sin();
    g.fillStyle = '#ffd24a'; g.beginPath(); g.arc(0, 0, s * 0.2, Math.PI * 1.25, Math.PI * 1.75); g.lineTo(0, 0); g.fill();
    g.fillStyle = '#4a4d58'; g.fillRect(-s * 0.012, -s * 0.28, s * 0.024, s * 0.09);
    // la hélice gira de a cuadros (se ve de canto en unos y de frente en otros)
    const a = [1, 0.55, 0.12, 0.55][cuadro % 4];
    g.fillStyle = '#4fa3e8'; g.beginPath(); g.ellipse(-s * 0.15 * a, -s * 0.29, s * 0.15 * a + 0.5, s * 0.03, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#58b368'; g.beginPath(); g.ellipse(s * 0.15 * a, -s * 0.29, s * 0.15 * a + 0.5, s * 0.03, 0, 0, Math.PI * 2); g.fill();
  } else if (id === 'chef') {
    sombra(); g.fillStyle = '#fbfbf7';
    g.fillRect(-s * 0.16, -s * 0.16, s * 0.32, s * 0.16);
    for (const [dx, dy, r] of [[-0.11, -0.25, 0.12], [0.11, -0.25, 0.12], [0, -0.33, 0.14]]) { g.beginPath(); g.arc(dx * s, dy * s, r * s, 0, Math.PI * 2); g.fill(); }
    sin(); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = s * 0.015; g.beginPath(); g.moveTo(-s * 0.16, -s * 0.16); g.lineTo(s * 0.16, -s * 0.16); g.stroke();
  } else if (id === 'corona') {
    sombra(); g.fillStyle = '#f2c230';
    g.beginPath(); g.moveTo(-s * 0.2, 0); g.lineTo(-s * 0.22, -s * 0.24); g.lineTo(-s * 0.1, -s * 0.12); g.lineTo(0, -s * 0.3); g.lineTo(s * 0.1, -s * 0.12); g.lineTo(s * 0.22, -s * 0.24); g.lineTo(s * 0.2, 0); g.closePath(); g.fill(); sin();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-s * 0.18, -s * 0.07, s * 0.36, s * 0.03);
    for (const [dx, col] of [[-0.12, '#e4553f'], [0, '#4fa3e8'], [0.12, '#58b368']]) { g.fillStyle = col; g.beginPath(); g.arc(dx * s, -s * 0.05, s * 0.028, 0, Math.PI * 2); g.fill(); }
  }
  g.restore();
}
