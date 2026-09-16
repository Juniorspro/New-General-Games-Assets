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

// --- fondo en capas ------------------------------------------------------
//
// Tres capas a distinta velocidad: cielo, lejos y cerca. Una sola imagen de
// fondo se ve plana, y en vertical el cielo ocupa DOS TERCIOS de la pantalla —
// ahi es donde se decide si el juego se ve bien o se ve pobre.
//
// Las dos bandas se anclan al MUNDO y no a la pantalla: su base va a una Y
// fija del nivel, corrida por la camara con su propio factor. Ancladas a la
// pantalla se quedarian pegadas abajo al saltar, y el paralaje vertical
// —que es el que mas se nota en un juego donde se salta— no existiria.
const ANCLA_MUNDO = 18 * 16;          // la linea del horizonte, en el mundo

// El paralaje vertical se calcula RELATIVO a la camara de reposo, no en
// absoluto. Con `ancla - camY * factor` la banda se corre hacia abajo a medida
// que la camara sube, y en vertical —donde la camara queda muy por encima del
// nivel— terminaba tapando al jugador. Tomando como cero la camara de reposo,
// la banda se apoya SIEMPRE en la linea del piso y solo se mueve un poco
// alrededor de ahi, que es lo que hace el paralaje de verdad.
const camaraReposo = (alto) => 18 * 16 - alto * 0.74;

function repetirX(c, img, x, y, w, h, ancho) {
  // Se dibuja de nuevo a izquierda y derecha hasta tapar la vista. La imagen
  // es repetible en horizontal, asi que la junta no se ve.
  let x0 = x % w;
  if (x0 > 0) x0 -= w;
  for (let px = x0; px < ancho; px += w) c.drawImage(img, px | 0, y | 0, Math.ceil(w), Math.ceil(h));
}

export function fondo(c, tema, camX, camY, t, ancho, alto, capas = {}) {
  const tm = TEMAS[tema];

  // 1) cielo: cubre todo. Si no cargo, bandas planas de color.
  if (capas.cielo) {
    // Se escala por el ANCHO, no por el alto. Escalando para cubrir el alto —
    // que en vertical son 448 px contra 360 de la imagen— el factor se va a
    // 1,4 y una nube termina midiendo un tercio de la pantalla. Con 1,7
    // pantallas por imagen las nubes quedan del tamano que se dibujaron.
    const esc = (ancho * 1.7) / capas.cielo.width;
    const w = capas.cielo.width * esc, h = capas.cielo.height * esc;
    // Debajo de la imagen se rellena con su propio color de abajo, asi no
    // queda una franja vacia cuando la vista es mas alta que la imagen.
    R(c, 0, 0, ancho, alto, tm.cielo[1]);
    const ref = camaraReposo(alto);
    const y0 = -(camY - ref) * 0.10;
    repetirX(c, capas.cielo, -camX * 0.05, y0, w, h, ancho);
    if (y0 + h < alto) R(c, 0, y0 + h - 1, ancho, alto - (y0 + h) + 2, tm.cielo[1]);
  } else {
    const a = tm.cielo[0], b = tm.cielo[1];
    const mezcla = (p) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const m = (s) => Math.round((((pa >> s) & 255) * (1 - p) + ((pb >> s) & 255) * p));
      return `rgb(${m(16)},${m(8)},${m(0)})`;
    };
    for (let i = 0; i < 6; i++) R(c, 0, alto * i / 6, ancho, alto / 6 + 1, mezcla(i / 5));
  }

  // 2) las dos bandas
  for (const [clave, vel, velY, altoRel] of [["lejos", 0.22, 0.55, 0.30], ["cerca", 0.42, 0.80, 0.19]]) {
    const img = capas[clave];
    if (!img) continue;
    const h = Math.max(48, Math.min(alto * altoRel, 220));
    const w = img.width * (h / img.height);
    const ref = camaraReposo(alto);
    const baseY = (ANCLA_MUNDO - ref) - (camY - ref) * velY;
    repetirX(c, img, -camX * vel, baseY - h, w, h, ancho);
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
      dibujarTile(c, v, tx * T - camX, ty * T - camY, tm, t, tx, ty,
                  lee(tx, ty - 1) === V.NADA, patron, (dx) => lee(tx + dx, ty));
    }
  }
}

function dibujarTile(c, v, x, y, tm, t, tx, ty, arribaLibre, patron, vecino = () => 0) {
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
    case V.TUBO: {
      // Un tubo mide DOS tiles de ancho, asi que cada mitad dibuja la MITAD de
      // la pieza. La version anterior dibujaba la pieza entera en cada tile: la
      // boca salia dos veces, una al lado de la otra, y en pantalla se leia
      // como dos cajitas y no como un tubo.
      const pieza = arribaLibre ? piezas.tubo_boca : piezas.tubo_cuerpo;
      if (pieza) {
        const izq = vecino(-1) !== V.TUBO;
        const sw = pieza.width / 2, sx = izq ? 0 : sw;
        if (arribaLibre) {
          // La boca sobresale un pixel hacia afuera: es el labio del tubo.
          const fuera = izq ? -1 : 0;
          c.drawImage(pieza, sx, 0, sw, pieza.height,
                      (x + fuera) | 0, (y - 1) | 0, T + 1, T + 1);
        } else {
          c.drawImage(pieza, sx, 0, sw, pieza.height, x | 0, y | 0, T, T + 1);
        }
      } else {
        R(c, x, y, T, T, "#2a7f8f"); R(c, x, y, 3, T, "#4dbccf");
      }
      break;
    }
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

// Piezas sueltas (tubos, iconos). Las carga main.js y las deja aca.
export const piezas = {};
export function registrarPiezas(m) { Object.assign(piezas, m); }
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
