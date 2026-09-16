// Todo lo que se ve, dibujado por codigo. Ni un PNG en el juego.
//
// Por que: un set de sprites decente son 200-400 KB que hay que bajar antes de
// jugar, y una carpeta de archivos que mantener. Dibujado, el personaje entero
// son treinta lineas, cambiarle el color es cambiar un string, y el juego pesa
// lo que pesa el codigo.

import { T, V, ALTO_TILES, F, TEMAS } from "./mundo.js";

const pi2 = Math.PI * 2;
const r = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
function redondeado(c, x, y, w, h, rad) {
  c.beginPath(); c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad); c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad); c.arcTo(x, y, x + w, y, rad); c.closePath();
}

// --- fondo ---------------------------------------------------------------
export function fondo(c, tema, camX, camY, t, ancho, alto) {
  const T_ = TEMAS[tema];
  const g = c.createLinearGradient(0, 0, 0, alto);
  g.addColorStop(0, T_.cielo[0]); g.addColorStop(1, T_.cielo[1]);
  r(c, 0, 0, ancho, alto, g);

  // Tres capas a distinta velocidad. El paralaje es lo unico que hace que un
  // fondo plano se sienta lejos.
  if (tema === "cielo" || tema === "llano" || tema === "desierto") {
    c.globalAlpha = 0.5;
    for (let capa = 0; capa < 2; capa++) {
      const vel = 0.12 + capa * 0.16, esc = 1 - capa * 0.25;
      const off = (camX * vel) % 260;
      for (let i = -1; i < ancho / 260 + 2; i++) {
        const x = i * 260 - off, y = alto - 40 - capa * 26 - camY * vel * 0.3;
        if (tema === "cielo") nube(c, x, alto * 0.3 + capa * 50 - camY * vel, 50 * esc);
        else cerro(c, x, y, 150 * esc, 70 * esc, capa ? T_.niebla : T_.detalle);
      }
    }
    c.globalAlpha = 1;
  } else {
    // Interiores: una reja de ladrillos apenas visible, para que el
    // desplazamiento se note aunque no haya paisaje.
    c.globalAlpha = 0.10; c.strokeStyle = T_.detalle; c.lineWidth = 1;
    const off = (camX * 0.25) % 48, offY = (camY * 0.25) % 48;
    c.beginPath();
    for (let x = -off; x < ancho; x += 48) { c.moveTo(x, 0); c.lineTo(x, alto); }
    for (let y = -offY; y < alto; y += 48) { c.moveTo(0, y); c.lineTo(ancho, y); }
    c.stroke(); c.globalAlpha = 1;
  }
}

function nube(c, x, y, s) {
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.arc(x, y, s * 0.5, 0, pi2); c.arc(x + s * 0.5, y - s * 0.2, s * 0.38, 0, pi2);
  c.arc(x + s * 0.9, y, s * 0.44, 0, pi2); c.arc(x + s * 0.45, y + s * 0.22, s * 0.4, 0, pi2);
  c.fill();
}
function cerro(c, x, y, w, h, col) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x - w / 2, y + h); c.quadraticCurveTo(x, y - h * 0.5, x + w / 2, y + h);
  c.closePath(); c.fill();
}

// --- tiles ---------------------------------------------------------------
export function tiles(c, nv, camX, camY, t, ancho, alto) {
  const tm = TEMAS[nv.tema];
  const tx0 = Math.max(0, Math.floor(camX / T) - 1);
  const tx1 = Math.min(nv.ancho - 1, Math.ceil((camX + ancho) / T));
  const ty0 = Math.max(0, Math.floor(camY / T) - 1);
  const ty1 = Math.min(ALTO_TILES - 1, Math.ceil((camY + alto) / T));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const v = nv.grilla[ty * nv.ancho + tx];
      if (v === V.NADA) continue;
      const x = tx * T - camX, y = ty * T - camY;
      const arribaLibre = ty === 0 || nv.grilla[(ty - 1) * nv.ancho + tx] === V.NADA;
      dibujarTile(c, v, x, y, tm, t, arribaLibre, tx, ty);
    }
  }
}

function dibujarTile(c, v, x, y, tm, t, arribaLibre, tx, ty) {
  switch (v) {
    case V.SOLIDO:
      r(c, x, y, T, T, tm.tierra);
      // Pasto/borde solo donde se ve el cielo: dibujarlo siempre tapa el
      // relieve y hace que un bloque macizo parezca un damero.
      if (arribaLibre) { r(c, x, y, T, 4, tm.detalle); r(c, x, y + 4, T, 1, "rgba(0,0,0,.18)"); }
      r(c, x, y + T - 2, T, 2, tm.borde);
      r(c, x + T - 2, y, 2, T, "rgba(0,0,0,.10)");
      break;
    case V.LADRILLO:
      r(c, x, y, T, T, tm.tierra); r(c, x, y, T, T, "rgba(0,0,0,0)");
      c.strokeStyle = "rgba(0,0,0,.30)"; c.lineWidth = 1;
      c.strokeRect(x + .5, y + .5, T - 1, T - 1);
      c.beginPath(); c.moveTo(x, y + 8); c.lineTo(x + T, y + 8);
      c.moveTo(x + 8, y); c.lineTo(x + 8, y + 8); c.moveTo(x + 4, y + 8); c.lineTo(x + 4, y + T);
      c.moveTo(x + 12, y + 8); c.lineTo(x + 12, y + T); c.stroke();
      break;
    case V.PREGUNTA: {
      const s = Math.sin(t / 9 + tx) * 0.5 + 0.5;
      r(c, x, y, T, T, `rgb(${226 + s * 20},${170 + s * 30},${40})`);
      r(c, x + 1, y + 1, T - 2, 2, "rgba(255,255,255,.5)");
      c.fillStyle = "#6b4a10"; c.font = "bold 11px monospace"; c.textAlign = "center";
      c.fillText("?", x + T / 2, y + 12); c.textAlign = "left";
      break;
    }
    case V.USADO: r(c, x, y, T, T, "#8a6a3a"); r(c, x + 2, y + 2, T - 4, T - 4, "#6b5230"); break;
    case V.PAUSA: {
      const s = Math.sin(t / 7) * 0.5 + 0.5;
      r(c, x, y, T, T, `rgb(${60 + s * 40},${150 + s * 60},${230})`);
      r(c, x + 4, y + 4, 3, 8, "#fff"); r(c, x + 9, y + 4, 3, 8, "#fff");
      break;
    }
    case V.TIEMPO:
      r(c, x, y, T, T, "#3fa34d"); c.strokeStyle = "#fff"; c.lineWidth = 1.4;
      c.beginPath(); c.arc(x + 8, y + 8, 5, 0, pi2); c.moveTo(x + 8, y + 8);
      c.lineTo(x + 8, y + 4.5); c.moveTo(x + 8, y + 8); c.lineTo(x + 10.5, y + 9); c.stroke();
      break;
    case V.LARGO: case V.VOLTERETA: {
      r(c, x, y, T, T, v === V.LARGO ? "#2f7fd0" : "#c04fc0");
      c.fillStyle = "#fff"; c.beginPath();
      if (v === V.LARGO) { c.moveTo(x + 3, y + 10); c.lineTo(x + 13, y + 10); c.lineTo(x + 9, y + 6); }
      else { c.moveTo(x + 8, y + 4); c.lineTo(x + 12, y + 11); c.lineTo(x + 4, y + 11); }
      c.fill(); break;
    }
    case V.TUBO:
      r(c, x, y, T, T, "#2e9e4f"); r(c, x, y, 4, T, "#57c878");
      r(c, x + T - 3, y, 3, T, "#1d6b34");
      if (arribaLibre) { r(c, x - 1, y, T + 2, 5, "#37b45c"); r(c, x - 1, y, T + 2, 2, "#7fe39c"); }
      break;
    case V.PLATAFORMA:
      r(c, x, y, T, 5, tm.detalle); r(c, x, y, T, 2, "rgba(255,255,255,.45)");
      r(c, x, y + 5, T, 1, "rgba(0,0,0,.25)");
      break;
    case V.PINCHE:
      c.fillStyle = "#c9ccd6";
      for (let i = 0; i < 2; i++) {
        c.beginPath(); c.moveTo(x + i * 8, y + T); c.lineTo(x + 4 + i * 8, y + 3);
        c.lineTo(x + 8 + i * 8, y + T); c.fill();
      }
      r(c, x, y + T - 3, T, 3, "#7d828f");
      break;
    case V.LAVA: {
      const o = Math.sin(t / 12 + tx * 0.6) * 2;
      r(c, x, y + 2, T, T - 2, "#e8541e");
      c.fillStyle = "#ffb03a";
      c.beginPath(); c.moveTo(x, y + 4 + o); c.lineTo(x + T, y + 4 - o);
      c.lineTo(x + T, y + 8); c.lineTo(x, y + 8); c.fill();
      break;
    }
    case V.MONEDA: moneda(c, x + T / 2, y + T / 2, t, "#ffd447", "#c48f10"); break;
    case V.RESORTE: {
      r(c, x + 2, y + 9, T - 4, 6, "#9aa3b2");
      c.strokeStyle = "#5d6675"; c.lineWidth = 1.4; c.beginPath();
      for (let i = 0; i < 3; i++) { c.moveTo(x + 2, y + 10 + i * 2); c.lineTo(x + T - 2, y + 11 + i * 2); }
      c.stroke(); r(c, x + 1, y + 6, T - 2, 4, "#d24b4b");
      break;
    }
    case V.RAMPA_SUBE: case V.RAMPA_BAJA: {
      c.fillStyle = tm.tierra; c.beginPath();
      if (v === V.RAMPA_SUBE) { c.moveTo(x, y + T); c.lineTo(x + T, y); c.lineTo(x + T, y + T); }
      else { c.moveTo(x, y); c.lineTo(x + T, y + T); c.lineTo(x, y + T); }
      c.closePath(); c.fill();
      c.strokeStyle = tm.detalle; c.lineWidth = 3; c.beginPath();
      if (v === V.RAMPA_SUBE) { c.moveTo(x, y + T); c.lineTo(x + T, y); }
      else { c.moveTo(x, y); c.lineTo(x + T, y + T); }
      c.stroke();
      break;
    }
    case V.MASTIL: r(c, x + 7, y, 2, T, "#cfd6e0"); break;
    case V.META: r(c, x + 5, y + 4, 6, T - 4, "#2f7fd0"); break;
  }
}

export function moneda(c, cx, cy, t, col = "#ffd447", oscuro = "#c48f10", fase = 0) {
  // Gira achicando el ancho. Es el truco mas viejo del rubro y sigue siendo el
  // que mejor rinde: cuesta una linea y se lee al instante.
  const w = Math.abs(Math.cos(t / 11 + fase)) * 5 + 1.6;
  c.fillStyle = oscuro; c.beginPath(); c.ellipse(cx, cy, w + 1, 6.5, 0, 0, pi2); c.fill();
  c.fillStyle = col; c.beginPath(); c.ellipse(cx, cy, w, 5.6, 0, 0, pi2); c.fill();
}

const COLOR_TIER = { rosa: ["#ff7ac0", "#c4407f"], violeta: ["#b07 aff", "#6a3fbf"],
                     negra: ["#3a3a46", "#18181f"] };
export function monedaColor(c, cx, cy, t, tier) {
  const [a, b] = tier === "violeta" ? ["#b07aff", "#6a3fbf"]
               : tier === "negra" ? ["#4a4a58", "#16161c"] : ["#ff7ac0", "#c4407f"];
  c.save(); c.shadowColor = a; c.shadowBlur = 10;
  moneda(c, cx, cy, t, a, b); c.restore();
}

// --- jugador -------------------------------------------------------------
export function jugador(c, j, t, camX, camY) {
  const x = j.x - camX, y = j.y - camY;
  const d = j.dir;
  c.save(); c.translate(x, y);
  if (j.giro > 0) c.rotate((F.GIRO_CUADROS - j.giro) / F.GIRO_CUADROS * pi2);
  c.scale(d, 1);

  const corriendo = j.suelo && !j.frenado;
  const paso = Math.sin(t / 3.2);
  // Estirarse al subir y achatarse al caer. Es la misma idea que el squash de
  // una animacion: sin esto el salto se ve rigido aunque los numeros esten bien.
  const est = j.suelo ? 1 : Math.max(0.86, Math.min(1.14, 1 - j.vy * 0.022));

  c.save(); c.scale(1 / est, est);
  // piernas
  c.fillStyle = "#2b4a8f";
  if (corriendo) {
    r(c, -5, -7, 4, 7 + paso * 2, "#2b4a8f");
    r(c, 1, -7, 4, 7 - paso * 2, "#2b4a8f");
    r(c, -6, -1 + paso * 2, 5, 2, "#6b3a1a"); r(c, 2, -1 - paso * 2, 5, 2, "#6b3a1a");
  } else {
    r(c, -5, -8, 4, 6, "#2b4a8f"); r(c, 1, -6, 4, 6, "#2b4a8f");
    r(c, -6, -2, 5, 2, "#6b3a1a"); r(c, 2, 0, 5, 2, "#6b3a1a");
  }
  // cuerpo
  r(c, -5, -13, 10, 6, "#d8402f");
  r(c, -1, -13, 2, 6, "#e8e0d0");
  // brazos
  const br = corriendo ? -paso * 3 : (j.suelo ? 0 : -3);
  r(c, -7, -12 + br, 3, 5, "#d8402f"); r(c, 4, -12 - br, 3, 5, "#d8402f");
  // cabeza
  c.fillStyle = "#f0c090"; redondeado(c, -5, -20, 10, 8, 3); c.fill();
  r(c, 2, -18, 2, 2, "#3a2a1a");                         // ojo
  r(c, 3, -15, 3, 1.5, "#8a5a3a");                        // bigote
  // gorra
  c.fillStyle = "#d8402f"; redondeado(c, -6, -22, 12, 5, 2); c.fill();
  r(c, 1, -19, 7, 2, "#d8402f");
  c.fillStyle = "#fff"; c.beginPath(); c.arc(-1, -20, 2, 0, pi2); c.fill();
  c.restore();
  c.restore();

  // Pegado a una pared: unas rayitas de roce. Le dice al jugador "aca podes
  // rebotar" sin ningun cartel.
  if (j.pared !== 0 && !j.suelo) {
    c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const yy = y - 4 - i * 5 + ((t * 2) % 10);
      c.beginPath(); c.moveTo(x + j.pared * 7, yy); c.lineTo(x + j.pared * 11, yy + 3); c.stroke();
    }
  }
}

// --- enemigos ------------------------------------------------------------
export function enemigo(c, e, t, camX, camY) {
  if (!e.vivo) return;
  const x = e.x - camX, y = e.y - camY;
  c.save(); c.translate(x, y);
  switch (e.tipo) {
    case "goomba": {
      const p = Math.sin(t / 5) * 1.5;
      c.fillStyle = "#8a5a2a"; redondeado(c, -7, -14, 14, 11, 5); c.fill();
      r(c, -7, -4, 5, 3, "#5a3a18"); r(c, 2, -4, 5, 3, "#5a3a18");
      c.fillStyle = "#fff"; r(c, -4 + p * .3, -11, 3, 4, "#fff"); r(c, 1 + p * .3, -11, 3, 4, "#fff");
      r(c, -3 + p * .3, -10, 1.6, 2.4, "#000"); r(c, 2 + p * .3, -10, 1.6, 2.4, "#000");
      break;
    }
    case "buzzy":
      c.fillStyle = "#2a2a3a"; redondeado(c, -7, -12, 14, 9, 4.5); c.fill();
      r(c, -5, -14, 10, 3, "#4a4a6a"); r(c, -6, -3, 4, 3, "#c8b060"); r(c, 2, -3, 4, 3, "#c8b060");
      break;
    case "koopa":
      if (e.caparazon) {
        c.fillStyle = e.empujado ? "#4fd07a" : "#2e9e4f";
        redondeado(c, -7, -12, 14, 12, 5); c.fill();
        c.strokeStyle = "#1d6b34"; c.lineWidth = 1.2;
        c.beginPath(); c.arc(0, -6, 4.5, 0, pi2); c.stroke();
      } else {
        c.fillStyle = "#2e9e4f"; redondeado(c, -6, -13, 12, 10, 4); c.fill();
        c.fillStyle = "#f0d060"; redondeado(c, -2 * e.dir - 4, -20, 9, 8, 3.5); c.fill();
        r(c, 1 * e.dir, -18, 2, 2, "#000");
        r(c, -5, -4, 4, 3, "#f0d060"); r(c, 1, -4, 4, 3, "#f0d060");
      }
      break;
    case "paratroopa": {
      const a = Math.sin(t / 4) * 0.7;
      if (e.alas) {
        c.fillStyle = "#fff"; c.save(); c.rotate(-a);
        redondeado(c, -13, -14, 8, 10, 4); c.fill(); c.restore();
        c.save(); c.rotate(a); redondeado(c, 5, -14, 8, 10, 4); c.fill(); c.restore();
      }
      c.fillStyle = "#c8443a"; redondeado(c, -6, -13, 12, 10, 4); c.fill();
      c.fillStyle = "#f0d060"; redondeado(c, -2 * e.dir - 4, -20, 9, 8, 3.5); c.fill();
      r(c, 1 * e.dir, -18, 2, 2, "#000");
      break;
    }
    case "huesos": {
      if (e.roto > 0) {
        c.fillStyle = "#e8e4d8";
        for (let i = 0; i < 4; i++) r(c, -8 + i * 4.5, -3, 3.5, 3, "#e8e4d8");
        break;
      }
      c.fillStyle = "#e8e4d8"; redondeado(c, -6, -12, 12, 9, 3); c.fill();
      redondeado(c, -5, -20, 10, 8, 4); c.fill();
      r(c, 1 * e.dir, -18, 2.5, 3, "#3a3a3a"); r(c, -3 * e.dir, -18, 2.5, 3, "#3a3a3a");
      r(c, -5, -3, 4, 3, "#e8e4d8"); r(c, 1, -3, 4, 3, "#e8e4d8");
      break;
    }
    case "spiny":
      c.fillStyle = "#d84a3a"; redondeado(c, -7, -12, 14, 10, 5); c.fill();
      c.fillStyle = "#f0f0f0";
      for (let i = 0; i < 4; i++) {
        c.beginPath(); c.moveTo(-6 + i * 4, -11); c.lineTo(-4 + i * 4, -17); c.lineTo(-2 + i * 4, -11); c.fill();
      }
      r(c, -3, -7, 2, 2, "#fff"); r(c, 1, -7, 2, 2, "#fff");
      break;
    case "planta": {
      if ((e.salida ?? 0) < 0.05) break;
      const h = 20 * e.salida;
      r(c, -2.5, -h, 5, h, "#3fa34d");
      c.fillStyle = "#e04a6a";
      c.beginPath(); c.arc(0, -h - 3, 7, 0, pi2); c.fill();
      c.fillStyle = "#fff";
      const b = Math.abs(Math.sin(t / 8)) * 4 + 1;
      c.beginPath(); c.moveTo(-6, -h - 3 - b); c.lineTo(6, -h - 3 - b);
      c.lineTo(6, -h - 3 + b); c.lineTo(-6, -h - 3 + b); c.fill();
      break;
    }
    case "bala":
      c.fillStyle = "#2a2a34"; c.save(); c.scale(e.dir, 1);
      redondeado(c, -8, -10, 16, 11, 5); c.fill();
      r(c, -9, -8, 3, 7, "#4a4a58"); c.restore();
      r(c, -3, -8, 3, 3, "#fff");
      break;
    case "canion":
      r(c, -8, -14, 16, 14, "#3a3a48"); r(c, -8, -14, 16, 3, "#5a5a70");
      c.fillStyle = "#1a1a22"; c.beginPath(); c.arc(0, -8, 4.5, 0, pi2); c.fill();
      break;
    case "lakitu": {
      c.fillStyle = "#f0f4ff"; c.beginPath();
      c.arc(-6, 0, 7, 0, pi2); c.arc(2, -2, 8, 0, pi2); c.arc(8, 1, 6, 0, pi2); c.fill();
      c.fillStyle = "#2e9e4f"; redondeado(c, -6, -16, 12, 10, 4); c.fill();
      c.fillStyle = "#f0d060"; redondeado(c, -4, -22, 9, 8, 3.5); c.fill();
      r(c, 1, -20, 2, 2, "#000");
      break;
    }
    case "boo": {
      c.globalAlpha = e.tapado ? 0.45 : 0.9;
      c.fillStyle = "#f0eaf8"; c.beginPath();
      c.arc(0, -8, 8, Math.PI, 0); 
      c.lineTo(8, -2);
      for (let i = 0; i < 4; i++) c.quadraticCurveTo(6 - i * 4, 1 + (i % 2) * 3, 4 - i * 4, -2);
      c.closePath(); c.fill();
      if (e.tapado) { r(c, -6, -10, 5, 4, "#f0eaf8"); r(c, 1, -10, 5, 4, "#f0eaf8"); }
      else { r(c, -4, -10, 2.5, 3.5, "#2a1a3a"); r(c, 2, -10, 2.5, 3.5, "#2a1a3a");
             r(c, -2, -5, 4, 2, "#c06a8a"); }
      c.globalAlpha = 1;
      break;
    }
    case "pokey": {
      for (let i = 0; i < e.segmentos; i++) {
        const o = Math.sin(t / 14 + i) * 2;
        c.fillStyle = "#8cc152";
        c.beginPath(); c.arc(o, -8 - i * 15, 8, 0, pi2); c.fill();
        c.fillStyle = "#f0f0d0";
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * pi2;
          c.beginPath(); c.arc(o + Math.cos(a) * 8, -8 - i * 15 + Math.sin(a) * 8, 1.3, 0, pi2); c.fill();
        }
      }
      r(c, -3, -12 - (e.segmentos - 1) * 15, 2, 2.5, "#000");
      r(c, 1, -12 - (e.segmentos - 1) * 15, 2, 2.5, "#000");
      break;
    }
    case "lavita": {
      if (!e.activa) break;
      c.fillStyle = "#ff8a2a"; c.beginPath(); c.arc(0, -7, 7, 0, pi2); c.fill();
      c.fillStyle = "#ffd06a"; c.beginPath(); c.arc(-1.5, -8.5, 3.5, 0, pi2); c.fill();
      r(c, -3, -9, 1.8, 2, "#000"); r(c, 1.5, -9, 1.8, 2, "#000");
      break;
    }
    case "barra": {
      c.translate(e.pivote.x - e.x, e.pivote.y - e.y);
      r(c, -4, -4, 8, 8, "#6b5560");
      for (let i = 1; i <= e.largo; i++) {
        const fx = Math.cos(e.ang) * i * 14, fy = Math.sin(e.ang) * i * 14;
        c.fillStyle = "#ff8a2a"; c.beginPath(); c.arc(fx, fy, 6, 0, pi2); c.fill();
        c.fillStyle = "#ffe08a"; c.beginPath(); c.arc(fx, fy, 3, 0, pi2); c.fill();
      }
      break;
    }
  }
  c.restore();
}

// --- particulas ----------------------------------------------------------
export function particula(c, p, camX, camY) {
  const x = p.x - camX, y = p.y - camY;
  c.globalAlpha = Math.max(0, p.vida / p.total);
  if (p.tipo === "texto") {
    c.fillStyle = p.col; c.font = "bold 11px system-ui, sans-serif"; c.textAlign = "center";
    c.fillText(p.txt, x, y); c.textAlign = "left";
  } else if (p.tipo === "chispa") {
    r(c, x - p.r / 2, y - p.r / 2, p.r, p.r, p.col);
  } else {
    c.fillStyle = p.col; c.beginPath(); c.arc(x, y, p.r, 0, pi2); c.fill();
  }
  c.globalAlpha = 1;
}
