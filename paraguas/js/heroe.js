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

let ARTE = null;
export function registrarArte(a) { ARTE = a; }
export const hayArte = () => !!(ARTE && ARTE.paraguas_abierto);

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
  const viento = Math.min(1, Math.max(0, (vy - 5) / 9));
  const atras = vx * 1.8 + 0 * abierto;
  for (const [pie, lado] of [[h.pieIzq, -1], [h.pieDer, 1]]) {
    const ox = h.cadera.x + lado * 6 - atras - sx * 6 * viento;
    const oy = h.cadera.y + mezcla(19, 7, viento);
    seguir(pie, ox, oy, 0.15, 0.78);
  }
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

  // El cuerpo primero, el paraguas encima: el mango tiene que tapar la mano.
  const hombro = { x: h.pecho.x, y: h.pecho.y };
  const codo = { x: (h.mano.x + hombro.x) / 2 + sx * 3, y: (h.mano.y + hombro.y) / 2 };
  if (A.rilo_pierna_alta) {
    tramo(ctx, A.rilo_pierna_alta, h.cadera, { x: (h.cadera.x + h.pieDer.x) / 2, y: (h.cadera.y + h.pieDer.y) / 2 }, 0.95, 1.3);
    tramo(ctx, A.rilo_pierna_baja, { x: (h.cadera.x + h.pieDer.x) / 2, y: (h.cadera.y + h.pieDer.y) / 2 }, h.pieDer, 0.95, 1.25);
    tramo(ctx, A.rilo_pierna_alta, h.cadera, { x: (h.cadera.x + h.pieIzq.x) / 2, y: (h.cadera.y + h.pieIzq.y) / 2 }, 0.95, 1.3);
    tramo(ctx, A.rilo_pierna_baja, { x: (h.cadera.x + h.pieIzq.x) / 2, y: (h.cadera.y + h.pieIzq.y) / 2 }, h.pieIzq, 0.95, 1.25);
    tramo(ctx, A.rilo_torso, h.pecho, h.cadera, 1.0, 1.12);
    tramo(ctx, A.rilo_brazo_alto, hombro, codo, 0.9, 1.3);
    tramo(ctx, A.rilo_brazo_bajo, codo, h.mano, 0.9, 1.3);
    // La cabeza, centrada arriba del pecho y girada con el cuerpo.
    const im = A.rilo_cabeza;
    const alt = 30, an = alt * (im.width / im.height);
    ctx.save();
    ctx.translate(h.pecho.x - sx * 13, h.pecho.y - cx * 13);
    ctx.rotate(h.giro);
    ctx.drawImage(im, -an / 2, -alt * 0.5, an, alt);
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
  const im = abierto > 0.5 ? A.paraguas_abierto : A.paraguas_cerrado;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(h.giro);
  if (im) {
    const an = ancho;
    const alt = an * (im.height / im.width) * (abierto > 0.5 ? 1 : 0.42);
    ctx.drawImage(im, -an / 2, -alt * 0.30, an, alt);
  } else {
    ctx.fillStyle = "#e08b2c";
    ctx.beginPath();
    ctx.ellipse(0, 0, ancho / 2, F.ALTO_PARAGUAS * (0.5 + abierto), 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = "#5a3a1c"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 30); ctx.stroke();
  }
  ctx.restore();
}
