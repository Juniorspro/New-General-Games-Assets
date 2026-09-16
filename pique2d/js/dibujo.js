// El dibujo, todo en pixel art.
//
// El juego se dibuja en un lienzo chico (320x180) y despues se estira a la
// pantalla con el suavizado APAGADO. Esa es la unica forma de que un pixel
// sea un pixel: dibujar grande y achicar produce bordes lavados, y un sprite
// pixel art lavado se ve peor que un dibujo suave hecho a proposito.

import { T, V, ALTO_TILES, ALTOS, F, TEMAS, GRAF, PATRON } from "./mundo.js";
import { dibujarCuadro, cuadroDe } from "./sprites.js";
const dibujarCuadroTile = (c, h, i, x, y, alto) => dibujarCuadro(c, h, i, x, y, alto);

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
  // EL PASO TIENE QUE SER MAYOR QUE CERO, Y HAY QUE COMPROBARLO.
  //
  // Aca estaba el cuelgue. `w` sale de `img.width * (h / img.height)`: si una
  // imagen de fondo carga con ancho cero —pasa con un archivo cortado, con un
  // data: URI mal armado, o cuando el navegador dispara onload sobre algo que
  // no pudo decodificar— entonces w vale 0, `px += 0` no avanza nunca y el
  // bucle no termina JAMAS. Eso no es un error que se pueda atrapar: es la
  // pestana congelada, sin consola, sin nada. Se arregla mirando el numero
  // antes de usarlo.
  if (!(w > 0.5) || !(h > 0.5) || !img.width || !img.height) return;
  const pasos = Math.ceil(ancho / w) + 2;
  let x0 = x % w;
  if (x0 > 0) x0 -= w;
  for (let i = 0, px = x0; i < pasos && px < ancho; i++, px += w)
    c.drawImage(img, px | 0, y | 0, Math.ceil(w), Math.ceil(h));
}

// Estira una tira de una fila de la imagen —la de arriba o la de abajo— para
// tapar lo que la imagen no llega a cubrir. Se toman DOS pixeles de alto y no
// uno: con uno, algunos navegadores suavizan contra el borde de la textura y
// sale una linea mas clara justo en la union.
// Un color del tema, mas oscuro. `p` es cuanto se va hacia el negro.
function oscurecer(hex, p) {
  const n = parseInt(hex.slice(1), 16);
  const m = (s) => Math.round(((n >> s) & 255) * (1 - p));
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

// --- pre-escalado de las capas del fondo ---------------------------------
//
// ESTO ES LA MITAD DEL COSTO DE DIBUJAR UN CUADRO, y era gratis sacarlo.
//
// Las capas llegan en 1024 px de ancho y se dibujan a 240 o 350: cada copia
// era un drawImage que ACHICABA una imagen grande, tres o cuatro veces por
// capa, sesenta veces por segundo. Achicar cuesta; copiar 1 a 1 no. Se medio:
// el fondo era 0,82 ms de los 1,73 que costaba el cuadro entero.
//
// Aca se achica UNA VEZ, cuando cambia el tamano de la vista, y despues se
// copia sin escalar. La cache cuelga de la imagen misma —WeakMap— asi que si
// el juego suelta una capa, su version chica se va con ella.
const cacheEscala = new WeakMap();
function aMedida(img, w, h) {
  if (!img || !img.width || !img.height || !(w > 0.5) || !(h > 0.5)) return null;
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const esc = GRAF.esc;
  let porImagen = cacheEscala.get(img);
  if (!porImagen) { porImagen = new Map(); cacheEscala.set(img, porImagen); }
  const llave = `${w}x${h}@${esc}`;
  let hecho = porImagen.get(llave);
  if (hecho) return hecho;
  try {
    // El lienzo va en pixeles DE LIENZO —w por esc— y despues se dibuja
    // pidiendo w pixeles de juego. Asi la copia cae 1 a 1 sobre la pantalla:
    // guardandolo en pixeles de juego, el contexto lo agrandaba por esc al
    // dibujarlo y se perdia todo el detalle que el supermuestreo agrega.
    const l = document.createElement("canvas");
    l.width = w * esc; l.height = h * esc;
    const cc = l.getContext("2d");
    cc.imageSmoothingEnabled = false;
    cc.drawImage(img, 0, 0, w * esc, h * esc);
    // El color de la fila de arriba, para rellenar lo que la imagen no cubre
    // sin tener que estirar dos pixeles a lo alto de media pantalla —que es
    // el caso de escalado mas caro que hay—.
    let arriba = null;
    try {
      const d = cc.getImageData(Math.floor(w / 2), 0, 1, 1).data;
      arriba = `rgb(${d[0]},${d[1]},${d[2]})`;
    } catch (e) { /* lienzo sucio: se sigue sin el color */ }
    hecho = { lienzo: l, w, h, esc, arriba };
    // Una sola medida por imagen: cambiar de tamano de pantalla no tiene que
    // dejar veinte lienzos viejos colgados.
    porImagen.clear();
    porImagen.set(llave, hecho);
    return hecho;
  } catch (e) {
    return null;
  }
}

// Copia una capa ya achicada, repetida a lo ancho. Sin escalar: 1 a 1.
function repetirListo(c, hecho, x, y, ancho) {
  const { lienzo, w, h } = hecho;
  const pasos = Math.ceil(ancho / w) + 2;
  let x0 = x % w;
  if (x0 > 0) x0 -= w;
  for (let i = 0, px = x0; i < pasos && px < ancho; i++, px += w)
    c.drawImage(lienzo, px | 0, y | 0, w, h);
}

export function fondo(c, tema, camX, camY, t, ancho, alto, capas = {}) {
  const tm = TEMAS[tema];
  const ref = camaraReposo(alto);
  // La linea del horizonte, con el paralaje lento del cielo.
  const horizonte = (ANCLA_MUNDO - ref) - (camY - ref) * 0.10;

  // 1) cielo.
  //
  // Se escala por el ANCHO, no por el alto: escalando para cubrir el alto
  // —448 px de vista contra 572 de imagen— una nube termina midiendo un
  // tercio de la pantalla. Con 1,7 pantallas por imagen las nubes quedan del
  // tamano que se dibujaron.
  //
  // Y SE APOYA EN EL HORIZONTE, no en el borde de arriba. Antes empezaba
  // arriba y lo que sobraba abajo se tapaba con un color plano del tema: con
  // los fondos nuevos ese color no coincidia con nada y quedaba una franja
  // lisa cruzando la pantalla —blanca en el castillo, violeta en el
  // fantasma—. Se veia en cada captura.
  const cielo = aMedida(capas.cielo,
                        ancho * 1.7,
                        capas.cielo ? capas.cielo.height * (ancho * 1.7) / capas.cielo.width : 0);
  if (cielo) {
    const y0 = horizonte - cielo.h;
    const px = -camX * 0.05;
    // Arriba, color plano de la propia imagen. Antes se estiraban dos filas
    // de pixeles a lo alto de media pantalla: el caso de escalado mas caro
    // que existe, y para dar el mismo color.
    if (y0 > 0) { c.fillStyle = cielo.arriba || tm.cielo[0]; c.fillRect(0, 0, ancho, Math.ceil(y0) + 1); }
    repetirListo(c, cielo, px, y0, ancho);
  } else {
    const a = tm.cielo[0], b = tm.cielo[1];
    const mezcla = (q) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const m = (sh) => Math.round((((pa >> sh) & 255) * (1 - q) + ((pb >> sh) & 255) * q));
      return `rgb(${m(16)},${m(8)},${m(0)})`;
    };
    for (let i = 0; i < 6; i++) R(c, 0, alto * i / 6, ancho, alto / 6 + 1, mezcla(i / 5));
  }

  // 2) DEBAJO DEL HORIZONTE NO HAY CIELO: HAY TIERRA VISTA DE LEJOS.
  //
  // Antes ahi iba el color plano del cielo, y se veia clarisimo en cuanto el
  // terreno tenia un pozo: por el agujero asomaba un rectangulo celeste liso,
  // del color del cielo, a metros por debajo del pasto. Arranca ya oscuro y
  // seis pixeles mas arriba de la linea, asi el hueco que se abre entre el
  // borde del cielo y la base de la banda —se corren a distinta velocidad—
  // queda tapado por la banda.
  if (horizonte < alto) {
    const y1 = horizonte - 6;
    const g2 = c.createLinearGradient(0, y1, 0, alto);
    g2.addColorStop(0, oscurecer(tm.borde, 0.22));
    g2.addColorStop(1, oscurecer(tm.borde, 0.78));
    c.fillStyle = g2;
    c.fillRect(0, y1 | 0, ancho, Math.ceil(alto - y1 + 2));
  }

  // 3) las dos bandas
  for (const [clave, vel, velY, altoRel] of [["lejos", 0.22, 0.55, 0.30], ["cerca", 0.42, 0.80, 0.19]]) {
    const img = capas[clave];
    if (!img || !img.height) continue;
    const h = Math.max(48, Math.min(alto * altoRel, 220));
    const hecho = aMedida(img, img.width * (h / img.height), h);
    if (!hecho) continue;
    const baseY = (ANCLA_MUNDO - ref) - (camY - ref) * velY;
    repetirListo(c, hecho, -camX * vel, baseY - hecho.h, ancho);
  }
}

// --- terreno -------------------------------------------------------------
// El terreno se pinta con la textura del tema como PATRON, corrida junto con
// la camara. Pintar cada tile con la textura entera adentro hace que un muro
// de veinte tiles se lea como veinte estampillas repetidas: el ojo cuenta los
// cubos. Con el patron corrido, la textura corre continua y el muro parece un
// muro.
export function tiles(c, nv, camX, camY, t, ancho, alto, patron, anim = null, hojas = {}) {
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
      // Golpe: el tile salta y vuelve. Diez cuadros, y la curva es un seno —
      // sube rapido y baja frenando, que es como se siente un golpe.
      let dy = 0;
      if (anim) {
        const t0 = anim.get(`${tx},${ty}`);
        if (t0 !== undefined) {
          const e = t - t0;
          if (e < 10) dy = -Math.sin((e / 10) * Math.PI) * 5;
          else anim.delete(`${tx},${ty}`);
        }
      }
      dibujarTile(c, v, tx * T - camX, ty * T - camY + dy, tm, t, tx, ty,
                  lee(tx, ty - 1) === V.NADA, patron, (dx) => lee(tx + dx, ty), hojas, anim);
    }
  }
}

function dibujarTile(c, v, x, y, tm, t, tx, ty, arribaLibre, patron, vecino = () => 0, hojas = {}, anim = null) {
  switch (v) {
    case V.RAJADO:
    case V.LADRILLO:
      // Con la textura del tema y no con un color plano: un rectangulo liso al
      // lado de un suelo texturado se lee como un error de dibujo.
      if (patron) {
        c.save(); c.translate(x - (tx * T) % PATRON, y - (ty * T) % PATRON);
        c.fillStyle = patron; c.fillRect((tx * T) % PATRON, (ty * T) % PATRON, T, T); c.restore();
        R(c, x, y, T, T, "rgba(150,90,40,.35)");
      } else R(c, x, y, T, T, tm.tierra);
      R(c, x, y, T, 1, "rgba(255,255,255,.2)"); R(c, x, y + T - 1, T, 1, "rgba(0,0,0,.3)");
      c.fillStyle = "rgba(0,0,0,.35)";
      c.fillRect(x, y + 7, T, 1); c.fillRect(x + 7, y, 1, 7); c.fillRect(x + 3, y + 8, 1, 8); c.fillRect(x + 11, y + 8, 1, 8);
      // El rajado se distingue de un vistazo: sin marca, el jugador lo golpea
      // otra vez esperando otra moneda y no entiende por que no sale.
      if (v === V.RAJADO) {
        c.fillStyle = "rgba(0,0,0,.55)";
        c.fillRect(x + 4, y + 2, 1, 4); c.fillRect(x + 5, y + 4, 1, 3);
        c.fillRect(x + 10, y + 9, 1, 5); c.fillRect(x + 9, y + 11, 1, 3);
        c.fillStyle = "rgba(255,255,255,.18)";
        c.fillRect(x + 5, y + 2, 1, 4); c.fillRect(x + 11, y + 9, 1, 5);
      }
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
    case V.PLATAFORMA: {
      // Con la pieza dibujada, y cortada en tres: punta izquierda, cuerpo y
      // punta derecha. Era una barra de cuatro pixeles de color plano y se
      // leia como una franja de pintura arriba del fondo, no como algo donde
      // pararse. Los herrajes de las puntas son lo que hace que se entienda
      // donde empieza y donde termina la plataforma.
      const pz = piezas.plataforma;
      if (pz && pz.width) {
        const izq = vecino(-1) !== V.PLATAFORMA, der = vecino(1) !== V.PLATAFORMA;
        // Un tercio de la imagen por parte. La del medio se repite.
        const sw = pz.width / 3;
        const sx = izq ? 0 : (der ? sw * 2 : sw);
        // El alto sale de la PROPORCION de la pieza, no de un numero puesto a
        // mano: con 13 fijos, la losa nueva —que es mucho mas baja— salia
        // estirada a lo alto y los bulones quedaban ovalados.
        const alto = Math.max(5, Math.min(T, Math.round(T * pz.height / sw)));
        c.drawImage(pz, sx, 0, sw, pz.height, x | 0, y | 0, T, alto);
      } else {
        R(c, x, y, T, 5, tm.detalle); R(c, x, y, T, 1, "rgba(255,255,255,.5)");
        R(c, x, y + 5, T, 1, "rgba(0,0,0,.35)");
      }
      break;
    }
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
    case V.RESORTE: {
      // El resorte usa su hoja: quieto muestra el primer cuadro, y al pisarlo
      // corre la animacion una vez. Dibujado con rectangulos no se notaba que
      // habia funcionado.
      const h = hojas.resorte_saltar;
      if (h) {
        let i = 0;
        const t0 = anim && anim.get(`${tx},${ty}`);
        if (t0 !== undefined && t0 !== false && t0 !== null) {
          const e = t - t0;
          i = e < 16 ? Math.min(h.n - 1, Math.floor(e * 0.9)) : 0;
        }
        dibujarCuadroTile(c, h, i, x + T / 2, y + T + 1, 15);
      } else {
        R(c, x + 2, y + 9, T - 4, 6, "#9aa3b2"); R(c, x + 1, y + 6, T - 2, 4, "#d24b4b");
      }
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
    // Se rehace si cambio la calidad: si no, la moneda se queda dibujada a la
    // resolucion vieja y es lo unico borroso (o lo unico caro) de la pantalla.
    if (tintado.lienzo && tintado.esc !== GRAF.esc) tintado.lienzo = null;
    if (!tintado.lienzo) {
      tintado.lienzo = document.createElement("canvas");
      // El lienzo auxiliar va a la MISMA resolucion que el del juego. Si se
      // quedara en 48 pixeles, la moneda seria lo unico grueso de la pantalla.
      tintado.lienzo.width = tintado.lienzo.height = 48 * GRAF.esc;
      tintado.esc = GRAF.esc;
      tintado.ctx = tintado.lienzo.getContext("2d");
      tintado.ctx.imageSmoothingEnabled = false;
      tintado.ctx.setTransform(GRAF.esc, 0, 0, GRAF.esc, 0, 0);
    }
    const tc = tintado.ctx;
    tc.clearRect(0, 0, 48, 48);
    dibujarCuadro(tc, hoja, i, 24, 40, ALTOS.moneda + 2);
    tc.globalCompositeOperation = "source-atop";
    tc.fillStyle = col; tc.globalAlpha = 0.72;
    tc.fillRect(0, 0, 48, 48);
    tc.globalAlpha = 1; tc.globalCompositeOperation = "source-over";
    c.drawImage(tintado.lienzo, Math.round(x - 24), Math.round(y - 40), 48, 48);
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
