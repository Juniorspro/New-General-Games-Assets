// El dibujo, todo en pixel art.
//
// El juego se dibuja en un lienzo chico (320x180) y despues se estira a la
// pantalla con el suavizado APAGADO. Esa es la unica forma de que un pixel
// sea un pixel: dibujar grande y achicar produce bordes lavados, y un sprite
// pixel art lavado se ve peor que un dibujo suave hecho a proposito.

import { T, V, ALTO_TILES, ALTOS, F, TEMAS } from "./mundo.js";
import { dibujarCuadro, cuadroDe } from "./sprites.js";

const pi2 = Math.PI * 2;
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, Math.ceil(w), Math.ceil(h)); };

// --- fondo ---------------------------------------------------------------
export function fondo(c, tema, camX, camY, t, ancho, alto) {
  const tm = TEMAS[tema];
  // Bandas planas en vez de degrade continuo: un degrade suave sobre pixeles
  // cuadrados se ve como un error de compresion. Cuatro bandas se leen como
  // cielo y son coherentes con el resto.
  const a = tm.cielo[0], b = tm.cielo[1];
  const mezcla = (p) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const m = (s) => Math.round((((pa >> s) & 255) * (1 - p) + ((pb >> s) & 255) * p));
    return `rgb(${m(16)},${m(8)},${m(0)})`;
  };
  for (let i = 0; i < 5; i++) R(c, 0, alto * i / 5, ancho, alto / 5 + 1, mezcla(i / 4));

  if (tema === "cielo" || tema === "llano" || tema === "desierto") {
    for (let capa = 0; capa < 2; capa++) {
      const vel = 0.10 + capa * 0.14, esc = 1 - capa * 0.3;
      const off = (camX * vel) % 180;
      c.globalAlpha = 0.45 - capa * 0.15;
      for (let i = -1; i < ancho / 180 + 2; i++) {
        const x = i * 180 - off;
        if (tema === "cielo") nube(c, x, alto * 0.25 + capa * 34 - camY * vel * 0.3, 34 * esc, tm);
        else cerro(c, x, alto - 26 - capa * 16 - camY * vel * 0.25, 120 * esc, 52 * esc, tm.detalle);
      }
      c.globalAlpha = 1;
    }
  }
}
function nube(c, x, y, s, tm) {
  // Nube de bloques, no de circulos: mantiene la grilla de pixeles.
  R(c, x, y, s * 2, s * 0.7, "#ffffff");
  R(c, x + s * 0.4, y - s * 0.45, s * 1.1, s * 0.6, "#ffffff");
  R(c, x + s * 0.15, y + s * 0.6, s * 1.6, s * 0.4, "#ffffff");
}
function cerro(c, x, y, w, h, col) {
  c.fillStyle = col;
  const pasos = 8, pw = w / pasos;
  for (let i = 0; i < pasos; i++) {
    const p = Math.abs(i - (pasos - 1) / 2) / ((pasos - 1) / 2);
    const hh = h * (1 - p * p);
    c.fillRect((x + i * pw) | 0, (y + h - hh) | 0, Math.ceil(pw) + 1, Math.ceil(hh) + 1);
  }
}

// --- terreno -------------------------------------------------------------
// El terreno se pinta con la textura del tema como PATRON, corrida junto con
// la camara. Pintar cada tile con la textura entera adentro hace que un muro
// de veinte tiles se lea como veinte estampillas repetidas: el ojo cuenta los
// cubos. Con el patron corrido, la textura corre continua y el muro parece un
// muro.
export function tiles(c, nv, camX, camY, t, ancho, alto, patron) {
  const tm = TEMAS[nv.tema];
  const tx0 = Math.max(0, Math.floor(camX / T) - 1);
  const tx1 = Math.min(nv.ancho - 1, Math.ceil((camX + ancho) / T));
  const ty0 = Math.max(0, Math.floor(camY / T) - 1);
  const ty1 = Math.min(ALTO_TILES - 1, Math.ceil((camY + alto) / T));
  const lee = (tx, ty) => (tx < 0 || ty < 0 || tx >= nv.ancho || ty >= ALTO_TILES)
    ? V.NADA : nv.grilla[ty * nv.ancho + tx];

  // 1) todo el solido, de una, con el patron
  c.save();
  c.translate(-camX | 0, -camY | 0);
  c.beginPath();
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      if (lee(tx, ty) === V.SOLIDO) c.rect(tx * T, ty * T, T, T);
  c.fillStyle = patron || tm.tierra;
  c.fill();
  c.restore();

  // 2) el borde de arriba y la sombra de abajo, que es lo que da relieve
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (lee(tx, ty) !== V.SOLIDO) continue;
      const x = tx * T - camX, y = ty * T - camY;
      if (lee(tx, ty - 1) !== V.SOLIDO) {
        R(c, x, y, T, 3, tm.detalle);
        R(c, x, y + 3, T, 1, "rgba(0,0,0,.28)");
      }
      if (lee(tx - 1, ty) !== V.SOLIDO) R(c, x, y, 1, T, "rgba(255,255,255,.14)");
      if (lee(tx + 1, ty) !== V.SOLIDO) R(c, x + T - 1, y, 1, T, "rgba(0,0,0,.22)");
    }
  }

  // 3) el resto de las cosas
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const v = lee(tx, ty);
      if (v === V.NADA || v === V.SOLIDO) continue;
      dibujarTile(c, v, tx * T - camX, ty * T - camY, tm, t, tx, ty, lee(tx, ty - 1) === V.NADA, patron);
    }
  }
}

function dibujarTile(c, v, x, y, tm, t, tx, ty, arribaLibre, patron) {
  switch (v) {
    case V.LADRILLO:
      // Con la textura del tema y no con un color plano: un rectangulo liso al
      // lado de un suelo texturado se lee como un error de dibujo.
      if (patron) {
        c.save(); c.translate(x - (tx * T) % 32, y - (ty * T) % 32);
        c.fillStyle = patron; c.fillRect((tx * T) % 32, (ty * T) % 32, T, T); c.restore();
        R(c, x, y, T, T, "rgba(150,90,40,.35)");
      } else R(c, x, y, T, T, tm.tierra);
      R(c, x, y, T, 1, "rgba(255,255,255,.2)"); R(c, x, y + T - 1, T, 1, "rgba(0,0,0,.3)");
      c.fillStyle = "rgba(0,0,0,.35)";
      c.fillRect(x, y + 7, T, 1); c.fillRect(x + 7, y, 1, 7); c.fillRect(x + 3, y + 8, 1, 8); c.fillRect(x + 11, y + 8, 1, 8);
      break;
    case V.PREGUNTA: {
      const s = (Math.sin(t / 9 + tx) * 0.5 + 0.5) * 22;
      R(c, x, y, T, T, `rgb(${226 + s},${162 + s},40)`);
      R(c, x, y, T, 2, "#ffe9a8"); R(c, x, y + T - 2, T, 2, "#a06e10");
      c.fillStyle = "#6b4a10";
      c.fillRect(x + 6, y + 4, 4, 2); c.fillRect(x + 9, y + 6, 2, 2);
      c.fillRect(x + 7, y + 8, 2, 2); c.fillRect(x + 7, y + 11, 2, 2);
      break;
    }
    case V.USADO: R(c, x, y, T, T, "#8a6a3a"); R(c, x + 2, y + 2, T - 4, T - 4, "#6b5230"); break;
    case V.PAUSA: {
      const s = (Math.sin(t / 7) * 0.5 + 0.5) * 40;
      R(c, x, y, T, T, `rgb(${50 + s},${150 + s},230)`);
      R(c, x + 4, y + 4, 3, 8, "#fff"); R(c, x + 9, y + 4, 3, 8, "#fff");
      break;
    }
    case V.TIEMPO:
      R(c, x, y, T, T, "#3fa34d"); R(c, x + 4, y + 4, 8, 8, "#eaffee");
      R(c, x + 7, y + 6, 2, 3, "#2a6b34"); R(c, x + 8, y + 8, 3, 2, "#2a6b34");
      break;
    case V.LARGO: case V.VOLTERETA: {
      R(c, x, y, T, T, v === V.LARGO ? "#2f7fd0" : "#a84fc0");
      c.fillStyle = "#fff";
      if (v === V.LARGO) { c.fillRect(x + 3, y + 9, 10, 2); c.fillRect(x + 9, y + 7, 2, 2); c.fillRect(x + 11, y + 8, 2, 2); }
      else { c.fillRect(x + 7, y + 4, 2, 8); c.fillRect(x + 5, y + 6, 2, 2); c.fillRect(x + 9, y + 6, 2, 2); }
      break;
    }
    case V.TUBO:
      R(c, x, y, T, T, "#2a7f8f"); R(c, x, y, 3, T, "#4dbccf"); R(c, x + T - 3, y, 3, T, "#17505c");
      if (arribaLibre) { R(c, x - 1, y, T + 2, 4, "#ffb43a"); R(c, x - 1, y, T + 2, 1, "#ffe0a0"); }
      break;
    case V.PLATAFORMA:
      R(c, x, y, T, 4, tm.detalle); R(c, x, y, T, 1, "rgba(255,255,255,.5)");
      R(c, x, y + 4, T, 1, "rgba(0,0,0,.35)");
      break;
    case V.PINCHE:
      c.fillStyle = "#d8dae2";
      for (let i = 0; i < 3; i++) {
        const px = x + i * 5 + 1;
        c.fillRect(px + 2, y + 2, 1, 14); c.fillRect(px + 1, y + 6, 3, 10); c.fillRect(px, y + 11, 5, 5);
      }
      R(c, x, y + T - 2, T, 2, "#6e7280");
      break;
    case V.LAVA: {
      const o = Math.round(Math.sin(t / 12 + tx * 0.7) * 2);
      R(c, x, y + 3, T, T - 3, "#e8541e");
      R(c, x, y + 2 + o, T, 3, "#ffb03a"); R(c, x, y + 1 + o, T, 1, "#ffe08a");
      break;
    }
    case V.MASTIL: R(c, x + 7, y, 2, T, "#cfd6e0"); R(c, x + 7, y, 1, T, "#ffffff"); break;
    case V.META: R(c, x + 4, y + 3, 8, T - 3, "#2a7f8f"); break;
  }
}

// --- monedas -------------------------------------------------------------
export function monedasVisibles(c, nv, camX, camY, t, ancho, alto, hoja) {
  const tx0 = Math.max(0, Math.floor(camX / T) - 1), tx1 = Math.min(nv.ancho - 1, Math.ceil((camX + ancho) / T));
  const ty0 = Math.max(0, Math.floor(camY / T) - 1), ty1 = Math.min(ALTO_TILES - 1, Math.ceil((camY + alto) / T));
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      if (nv.grilla[ty * nv.ancho + tx] === V.MONEDA) {
        const i = cuadroDe(t / 60, hoja, 10, tx * 3);   // desfase por columna:
        // sin eso todas las monedas giran al unisono y se ve como una sola
        // moneda repetida, no como monedas.
        if (hoja) dibujarCuadro(c, hoja, i, tx * T + T / 2 - camX, ty * T + T - 2 - camY, ALTOS.moneda);
        else { R(c, tx * T + 5 - camX, ty * T + 3 - camY, 6, 10, "#ffd447"); }
      }
}

const tintado = {};
export function monedaColor(c, x, y, t, tier, hoja) {
  const col = { rosa: "#ff7ac0", violeta: "#b07aff", negra: "#4a4a58" }[tier] || "#ff7ac0";
  const i = cuadroDe(t / 60, hoja, 10);
  c.save();
  // Halo: son cinco por nivel y son lo que el jugador busca. Que se vean de
  // lejos es media mecanica.
  const r = 10 + Math.sin(t / 14) * 2;
  const g = c.createRadialGradient(x, y - 7, 1, x, y - 7, r);
  g.addColorStop(0, col + "cc"); g.addColorStop(1, col + "00");
  c.fillStyle = g; c.beginPath(); c.arc(x, y - 7, r, 0, pi2); c.fill();
  c.restore();
  // El sprite se tine en un lienzo APARTE y recien despues se pega.
  // El primer intento usaba source-atop directo sobre el lienzo del juego: eso
  // tine todo lo ya dibujado debajo del rectangulo, no el sprite, y la moneda
  // quedaba adentro de un cuadrado rosa opaco.
  if (hoja) {
    if (!tintado.lienzo) {
      tintado.lienzo = document.createElement("canvas");
      tintado.lienzo.width = tintado.lienzo.height = 48;
      tintado.ctx = tintado.lienzo.getContext("2d");
      tintado.ctx.imageSmoothingEnabled = false;
    }
    const tc = tintado.ctx;
    tc.clearRect(0, 0, 48, 48);
    dibujarCuadro(tc, hoja, i, 24, 40, ALTOS.moneda + 2);
    tc.globalCompositeOperation = "source-atop";
    tc.fillStyle = col; tc.globalAlpha = 0.72;
    tc.fillRect(0, 0, 48, 48);
    tc.globalAlpha = 1; tc.globalCompositeOperation = "source-over";
    c.drawImage(tintado.lienzo, Math.round(x - 24), Math.round(y - 40));
  }
}

// --- particulas ----------------------------------------------------------
export function particula(c, p, camX, camY) {
  const x = (p.x - camX) | 0, y = (p.y - camY) | 0;
  c.globalAlpha = Math.max(0, p.vida / p.total);
  if (p.tipo === "texto") {
    c.fillStyle = p.col;
    c.font = "8px monospace"; c.textAlign = "center";
    c.fillText(p.txt, x, y); c.textAlign = "left";
  } else {
    c.fillStyle = p.col;
    const s = Math.max(1, Math.round(p.r));
    c.fillRect(x - (s >> 1), y - (s >> 1), s, s);
  }
  c.globalAlpha = 1;
}
