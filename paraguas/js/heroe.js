// Rilo colgado del paraguas: el rig y el dibujo.
//
// NO ES UN RAGDOLL, Y ES A PROPOSITO. Este juego se gana pasando por huecos de
// veintisiete pixeles cayendo a trece por cuadro: la caja de choque tiene que
// ser exacta y predecible, y un muneco articulado que a veces mete un codo de
// mas convierte la precision en loteria. La caja la define el juego —el ancho
// del paraguas y un rectangulo para el cuerpo— y esto de aca solo DIBUJA.
//
// Pero dibujar un monigote rigido pegado a una coordenada se ve muerto. Asi que
// el cuerpo cuelga de una cadena de resortes: cada parte persigue a la de
// arriba con retraso. Cuando el jugador se corre de golpe, el cuerpo se queda
// atras y despues alcanza; cuando cae rapido, el viento le levanta las piernas.
// Es secundario puro: no toca la fisica, no cambia el choque, y es todo lo que
// hace falta para que parezca que hay alguien ahi.

import { F, mezcla } from "./mundo.js";
import { porId } from "./skins.js";

let ARTE = null;
export function registrarArte(a) { ARTE = a; }
export const hayArte = () => !!(ARTE && ARTE.paraguas_abierto);

// --- las skins -----------------------------------------------------------
//
// TEÑIR SE HACE UNA VEZ Y SE GUARDA. La receta —dibujar la pieza, pintarla
// encima en modo `color` y recortar el alfa con la pieza otra vez— cuesta tres
// operaciones de lienzo por pieza. Hecha en cada cuadro son veintisiete
// operaciones por cuadro, mil seiscientas por segundo, para dibujar siempre
// exactamente lo mismo. Hecha una vez y guardada, cuesta cero.
//
// Y el modo `color` reemplaza el matiz y la saturación pero DEJA LA LUMINOSIDAD:
// las sombras, los pliegues y el contorno negro del dibujo siguen ahí. Pintando
// con `source-atop` liso, la pieza queda una mancha plana con forma de brazo.
const teñidas = new Map();
let skin = porId("base");

export function ponerSkin(id) {
  skin = porId(id);
  return skin;
}
export const skinPuesta = () => skin;

function teñir(img, tinte, fuerza) {
  if (!img || !tinte) return img;
  const clave = `${img.src ? img.src.slice(-24) : img.width}|${tinte}|${fuerza}`;
  const hecha = teñidas.get(clave);
  if (hecha) return hecha;
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0);
  x.globalAlpha = fuerza;
  x.globalCompositeOperation = "color";
  x.fillStyle = tinte;
  x.fillRect(0, 0, c.width, c.height);
  // Y SE RECORTA EL ALFA DE VUELTA. `fillRect` pinta el rectángulo entero,
  // incluso donde la pieza es transparente: sin este paso, cada brazo queda
  // adentro de un cuadrado de color.
  x.globalAlpha = 1;
  x.globalCompositeOperation = "destination-in";
  x.drawImage(img, 0, 0);
  teñidas.set(clave, c);
  return c;
}

/** La pieza que le toca a la skin puesta, teñida y con el arte propio si tiene. */
function pieza(nombre) {
  const A = ARTE || {};
  // Una skin paga trae su propio dibujo para DOS piezas: la cabeza y el
  // paraguas abierto. Son las dos que se miran —la cara y el objeto que ocupa
  // media pantalla— y las únicas que justifican el peso. El resto cae al dibujo
  // base teñido, así que una skin paga es "otro personaje" donde importa y
  // sigue siendo el mismo muñeco donde no.
  //
  // El mapa es EXPLICITO y no un `replace` sobre el nombre: derivándolo, el
  // paraguas buscaba `pro_magma_paraguas_abierto` —que no existe— y caía al
  // paraguas base teñido sin que nada fallara. La skin se compraba, se ponía, y
  // el paraguas por el que se pagó no aparecía nunca.
  const PRO = { rilo_cabeza: "cabeza", paraguas_abierto: "paraguas" };
  if (skin.arte && PRO[nombre] && A[`${skin.arte}_${PRO[nombre]}`])
    return A[`${skin.arte}_${PRO[nombre]}`];
  const im = A[nombre];
  if (!im) return null;
  if (nombre === "rilo_cabeza") return teñir(im, skin.pelo, 0.5);
  if (nombre.startsWith("rilo_pierna")) return teñir(im, skin.pata, 0.75);
  if (nombre.startsWith("paraguas")) return teñir(im, skin.paraguas, 0.8);
  return teñir(im, skin.bata, 0.75);
}

/** Un resorte que persigue: devuelve la posicion nueva. */
function seguir(p, ox, oy, k, amort) {
  p.vx = (p.vx + (ox - p.x) * k) * amort;
  p.vy = (p.vy + (oy - p.y) * k) * amort;
  p.x += p.vx; p.y += p.vy;
}

export function crearHeroe(x, y) {
  const q = (px, py) => ({ x: px, y: py, vx: 0, vy: 0 });
  return {
    mano: q(x, y + 24),
    pecho: q(x, y + 44),
    cadera: q(x, y + 62),
    pieIzq: q(x - 6, y + 82),
    pieDer: q(x + 6, y + 82),
    giro: 0,
    // El aura de la skin. Vive en el muñeco y no en la partida a propósito: es
    // secundario puro, como los resortes — no toca la física, no cambia el
    // choque, y si se borra entero el juego se juega exactamente igual.
    aura: [],
  };
}

/**
 * Acomodar el cuerpo debajo del paraguas.
 *
 * `vy` entra en la cuenta de los pies: cayendo rapido el viento se los lleva
 * para arriba y para atras, que es la unica forma de que la velocidad se VEA
 * sin poner un numero en pantalla.
 */
export function pasoHeroe(h, x, y, vx, vy, abierto) {
  // SI EL CUERPO QUEDO LEJOS, SE LO REUBICA DE UNA. Los resortes persiguen al
  // paraguas, y eso supone que el paraguas se mueve de a poco. Si el juego
  // estuvo pausado, la pestaña quedo en segundo plano o hubo un tiron de lag,
  // el paraguas puede aparecer mil pixeles mas abajo: los resortes tardarian
  // segundos en alcanzarlo y, mientras tanto, cada pieza se dibuja estirada
  // entre dos puntos separados por mil pixeles — o sea, un torso del tamaño de
  // la pantalla. Se vio, y es exactamente lo que pasaba.
  const lejos = Math.hypot(h.mano.x - x, h.mano.y - y) > 200;
  if (lejos) {
    const dx = x - h.mano.x, dy = y + 24 - h.mano.y;
    for (const q of [h.mano, h.pecho, h.cadera, h.pieIzq, h.pieDer]) {
      q.x += dx; q.y += dy; q.vx = 0; q.vy = 0;
    }
  }
  const inclina = Math.max(-0.5, Math.min(0.5, -vx * 0.045));
  h.giro += (inclina - h.giro) * 0.12;
  const sx = Math.sin(h.giro), cx = Math.cos(h.giro);
  // La mano agarra el mango, que cuelga del centro del paraguas y se inclina
  // con el.
  seguir(h.mano, x + sx * 26, y + cx * 26, 0.45, 0.62);
  seguir(h.pecho, h.mano.x + sx * 18 - vx * 1.1, h.mano.y + cx * 18, 0.22, 0.74);
  seguir(h.cadera, h.pecho.x + sx * 16 - vx * 1.4, h.pecho.y + cx * 16, 0.18, 0.76);
  pasoAura(h, x, y, vy);
  const viento = Math.min(1, Math.max(0, (vy - 5) / 9));
  const atras = vx * 1.8 + 0 * abierto;
  for (const [pie, lado] of [[h.pieIzq, -1], [h.pieDer, 1]]) {
    const ox = h.cadera.x + lado * 6 - atras - sx * 6 * viento;
    const oy = h.cadera.y + mezcla(19, 7, viento);
    seguir(pie, ox, oy, 0.15, 0.78);
  }
}

/**
 * El aura: partículas que deja atrás la skin.
 *
 * LAS PARTICULAS SUBEN, no bajan. El personaje cae a trece píxeles por cuadro y
 * una partícula que además cae se queda pegada a él: no se ve una estela, se ve
 * una mancha. Quedándose quietas en el mundo, la caída las deja atrás sola, que
 * es exactamente lo que hace el humo de verdad.
 */
const AURA = {
  chispas:  { cada: 3, vida: 26, r: 1.8, sube: 0.4, desvio: 1.6, color: (k) => k.pelo },
  fuego:    { cada: 2, vida: 22, r: 3.2, sube: 0.9, desvio: 1.1, color: () => (Math.random() < 0.5 ? "#ff8a2a" : "#ffd24a") },
  hielo:    { cada: 4, vida: 34, r: 2.2, sube: 0.2, desvio: 2.0, color: () => "#cdefff" },
  estatica: { cada: 2, vida: 12, r: 1.4, sube: 0.1, desvio: 4.0, color: (k) => k.brillo || "#7bf5ff" },
  humo:     { cada: 5, vida: 44, r: 4.5, sube: 0.7, desvio: 0.9, color: () => "#6a6a78" },
  estrellas:{ cada: 6, vida: 40, r: 2.0, sube: 0.3, desvio: 2.6, color: () => (Math.random() < 0.4 ? "#ffffff" : "#c0a8ff") },
  burbujas: { cada: 5, vida: 38, r: 3.0, sube: 1.2, desvio: 1.4, color: () => "#a8e6ff" },
};

function pasoAura(h, x, y, vy) {
  const cfg = AURA[skin.aura];
  for (let i = h.aura.length - 1; i >= 0; i--) {
    const a = h.aura[i];
    a.x += a.vx; a.y -= a.sube;
    a.vida--;
    if (a.vida <= 0) h.aura.splice(i, 1);
  }
  if (!cfg) return;
  // El tope no es decoración: sin él, una partida larga con el aura más densa
  // junta miles de partículas y el teléfono se arrastra.
  if (h.aura.length > 70) return;
  if ((h.t = (h.t || 0) + 1) % cfg.cada) return;
  h.aura.push({
    x: h.pecho.x + (Math.random() - 0.5) * 14,
    y: h.pecho.y + (Math.random() - 0.5) * 16,
    vx: (Math.random() - 0.5) * cfg.desvio,
    sube: cfg.sube + Math.min(3, vy * 0.06),
    r: cfg.r * (0.6 + Math.random() * 0.8),
    vida: cfg.vida, max: cfg.vida,
    color: cfg.color(skin),
  });
}

// --- dibujo --------------------------------------------------------------

function tramo(ctx, img, a, b, k, sobra, tope = 60) {
  if (!img) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  // El tope es un cinturon de seguridad, no una regla de dibujo: ningun hueso
  // de este muñeco mide mas de treinta pixeles, asi que si alguno pide sesenta
  // es que algo se rompio y es mejor dibujar algo raro y chico que tapar la
  // pantalla con un torso.
  const d = Math.min(Math.hypot(dx, dy) || 1, tope);
  const alto = d * sobra;
  const an = alto * (img.width / img.height) * k;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  ctx.drawImage(img, -an / 2, -d * (sobra - 1) / 2, an, alto);
  ctx.restore();
}

export function dibujarHeroe(ctx, h, x, y, abierto, ancho, invul) {
  if (invul > 0 && Math.floor(invul / 4) % 2) return;   // parpadea al chocar
  const A = ARTE || {};
  const sx = Math.sin(h.giro), cx = Math.cos(h.giro);

  ctx.save();
  // Las legendarias y las pagas tienen un HALO: es lo único que se ve desde el
  // otro lado de la pantalla y lo que hace que valga la pena ponérsela. Va
  // debajo de todo para que no lave el dibujo.
  if (skin.brillo) {
    const g = ctx.createRadialGradient(x, y + 30, 4, x, y + 30, 54);
    g.addColorStop(0, skin.brillo + "55");
    g.addColorStop(1, skin.brillo + "00");
    ctx.fillStyle = g;
    ctx.fillRect(x - 54, y - 24, 108, 108);
  }
  if (skin.alfa) ctx.globalAlpha = skin.alfa;
  // La de prisma cambia de color sola: un giro de matiz atado al reloj. Cuesta
  // un filtro y es la única skin que no se puede describir con una paleta.
  if (skin.arcoiris) ctx.filter = `hue-rotate(${(Date.now() / 22) % 360}deg) saturate(1.6)`;

  // El aura va DEBAJO del muñeco: encima le taparía la cara, que es lo único
  // que hace que una skin se reconozca.
  for (const a of h.aura) {
    ctx.globalAlpha = (a.vida / a.max) * 0.75 * (skin.alfa || 1);
    ctx.fillStyle = a.color;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r * (a.vida / a.max), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = skin.alfa || 1;

  // El cuerpo primero, el paraguas encima: el mango tiene que tapar la mano.
  const hombro = { x: h.pecho.x, y: h.pecho.y };
  const codo = { x: (h.mano.x + hombro.x) / 2 + sx * 3, y: (h.mano.y + hombro.y) / 2 };
  if (A.rilo_pierna_alta) {
    const piernaA = pieza("rilo_pierna_alta"), piernaB = pieza("rilo_pierna_baja");
    tramo(ctx, piernaA, h.cadera, { x: (h.cadera.x + h.pieDer.x) / 2, y: (h.cadera.y + h.pieDer.y) / 2 }, 0.95, 1.3);
    tramo(ctx, piernaB, { x: (h.cadera.x + h.pieDer.x) / 2, y: (h.cadera.y + h.pieDer.y) / 2 }, h.pieDer, 0.95, 1.25);
    tramo(ctx, piernaA, h.cadera, { x: (h.cadera.x + h.pieIzq.x) / 2, y: (h.cadera.y + h.pieIzq.y) / 2 }, 0.95, 1.3);
    tramo(ctx, piernaB, { x: (h.cadera.x + h.pieIzq.x) / 2, y: (h.cadera.y + h.pieIzq.y) / 2 }, h.pieIzq, 0.95, 1.25);
    tramo(ctx, pieza("rilo_torso"), h.pecho, h.cadera, 1.0, 1.12);
    tramo(ctx, pieza("rilo_brazo_alto"), hombro, codo, 0.9, 1.3);
    tramo(ctx, pieza("rilo_brazo_bajo"), codo, h.mano, 0.9, 1.3);
    // La cabeza, centrada arriba del pecho y girada con el cuerpo.
    const im = pieza("rilo_cabeza") || A.rilo_cabeza;
    const alt = 30, an = alt * (im.width / im.height);
    ctx.save();
    ctx.translate(h.pecho.x - sx * 13, h.pecho.y - cx * 13);
    ctx.rotate(h.giro);
    ctx.drawImage(im, -an / 2, -alt * 0.5, an, alt);
    if (skin.accesorio) accesorio(ctx, skin, alt);
    ctx.restore();
  } else {
    // Respaldo sin imagenes: el juego se tiene que poder jugar igual.
    ctx.strokeStyle = "#e9eef7"; ctx.lineWidth = 5; ctx.lineCap = "round";
    for (const p of [h.pieIzq, h.pieDer]) {
      ctx.beginPath(); ctx.moveTo(h.cadera.x, h.cadera.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(h.pecho.x, h.pecho.y); ctx.lineTo(h.cadera.x, h.cadera.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hombro.x, hombro.y); ctx.lineTo(h.mano.x, h.mano.y); ctx.stroke();
    ctx.fillStyle = "#d9b48f";
    ctx.beginPath(); ctx.arc(h.pecho.x - sx * 13, h.pecho.y - cx * 13, 9, 0, 7); ctx.fill();
  }

  // El paraguas. Se dibuja el abierto o el cerrado segun de que lado esta, y
  // se lo ESTIRA al ancho exacto de la caja de choque: lo que se ve es lo que
  // choca, que en un juego de pasar por huecos no es un detalle.
  const im = abierto > 0.5 ? pieza("paraguas_abierto") : pieza("paraguas_cerrado");
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h.giro);
  if (im) {
    const an = ancho;
    const alt = an * (im.height / im.width) * (abierto > 0.5 ? 1 : 0.42);
    ctx.drawImage(im, -an / 2, -alt * 0.30, an, alt);
  } else {
    ctx.fillStyle = "#97ce4c";
    ctx.beginPath();
    ctx.ellipse(0, 0, ancho / 2, F.ALTO_PARAGUAS * (0.5 + abierto), 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#8a9099"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

/**
 * Los accesorios: diez formas vectoriales que se dibujan arriba de la cabeza.
 *
 * SON VECTORIALES Y NO IMAGENES porque una gorra son cuatro líneas y una imagen
 * son ocho kilobytes; con diez accesorios, eso es ochenta kilobytes para algo
 * que el código dibuja igual de bien a este tamaño. Y porque así heredan el
 * color de la skin sin generar una versión por color.
 */
function accesorio(ctx, k, alt) {
  const w = alt * 0.62;
  ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.strokeStyle = "#141820";
  ctx.fillStyle = k.bata || "#888";
  const arriba = -alt * 0.5;
  switch (k.accesorio) {
    case "gorra":
      ctx.beginPath();
      ctx.ellipse(0, arriba + 3, w * 0.72, alt * 0.22, 0, Math.PI, 0);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w * 0.35, arriba + 4, w * 0.6, alt * 0.06, 0, 0, Math.PI);
      ctx.fill(); ctx.stroke();
      break;
    case "corona":
      ctx.beginPath();
      ctx.moveTo(-w * 0.6, arriba + 2);
      for (let i = 0; i <= 4; i++) {
        const px = -w * 0.6 + (i / 4) * w * 1.2;
        ctx.lineTo(px, arriba + (i % 2 ? -5 : 2));
      }
      ctx.lineTo(w * 0.6, arriba + 2);
      ctx.closePath();
      ctx.fillStyle = k.brillo || "#ffd24a";
      ctx.fill(); ctx.stroke();
      break;
    case "aureola":
      ctx.strokeStyle = k.brillo || "#fff3b0";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, arriba - 5, w * 0.6, alt * 0.09, 0, 0, 7);
      ctx.stroke();
      break;
    case "cuernos":
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(lado * w * 0.34, arriba + 4);
        ctx.quadraticCurveTo(lado * w * 0.72, arriba - 2, lado * w * 0.52, arriba - 9);
        ctx.quadraticCurveTo(lado * w * 0.46, arriba - 1, lado * w * 0.34, arriba + 4);
        ctx.fill(); ctx.stroke();
      }
      break;
    case "casco":
      ctx.beginPath();
      ctx.ellipse(0, arriba + 5, w * 0.72, alt * 0.3, 0, Math.PI, 0);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, arriba + 5); ctx.lineTo(w * 0.8, arriba + 5);
      ctx.stroke();
      break;
    case "antena":
      ctx.strokeStyle = "#8f9bb3";
      ctx.beginPath();
      ctx.moveTo(0, arriba + 2); ctx.lineTo(w * 0.22, arriba - 10);
      ctx.stroke();
      ctx.fillStyle = k.brillo || "#7bf5ff";
      ctx.beginPath(); ctx.arc(w * 0.22, arriba - 11, 2.6, 0, 7); ctx.fill();
      break;
    case "vincha":
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, arriba + 7); ctx.lineTo(w * 0.8, arriba + 7);
      ctx.lineWidth = 3.5; ctx.strokeStyle = k.bata || "#888"; ctx.stroke();
      break;
    case "sombrero":
      ctx.beginPath();
      ctx.ellipse(0, arriba + 6, w * 1.05, alt * 0.09, 0, 0, 7);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, arriba + 1, w * 0.52, alt * 0.2, 0, Math.PI, 0);
      ctx.fill(); ctx.stroke();
      break;
    case "auriculares":
      ctx.strokeStyle = "#232a3e"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, arriba + 6, w * 0.78, alt * 0.3, 0, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = k.brillo || k.pelo || "#7bf5ff";
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(lado * w * 0.78, arriba + 7, 3, 4.5, 0, 0, 7);
        ctx.fill();
      }
      break;
  }
}
