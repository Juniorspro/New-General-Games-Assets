// Los cuerpos: como se arman y como se dibujan.
//
// TODO ES VECTOR, no hay una sola imagen en el juego. No es capricho: un
// ragdoll no tiene poses, tiene articulaciones, y no existe la hoja de sprites
// que cubra las infinitas formas en las que un muneco se puede caer por una
// escalera. Dibujando de las articulaciones para afuera —un brazo es una linea
// gruesa entre dos puntos— el dibujo SIEMPRE coincide con la fisica, porque es
// la misma informacion mirada de otra forma.
//
// El esqueleto tiene once puntos. Menos que eso y las rodillas no se doblan;
// mas, y el solucionador empieza a pelearse consigo mismo sin que se note la
// diferencia en pantalla.
//
// LOS PALOS DE FORMA. Un ragdoll hecho solo con los huesos que unen partes
// vecinas se dobla al medio como una toalla: nada impide que la cabeza toque
// los pies. Los palos "forma" —cabeza a cadera, pecho a rodillas, codo a
// codo— son restricciones flojas que no se ven, y son la diferencia entre una
// persona que cae y una bolsa de papas.

import { punto, palo } from "./verlet.js";
import { MEDIDAS } from "./medidas.js";

// EL ESQUELETO SE CALCULA DE LAS MEDIDAS DEL DIBUJO, no se escribe a mano.
//
// `js/medidas.js` lo escribe cortar_cuerpos.py midiendo la ilustración de la
// que salieron las piezas: dónde está el hombro, dónde la cadera, cuánto mide
// el muslo. Armar el muñeco con esos números hace que las piezas encajen por
// construcción; escritos a mano nunca terminan de coincidir y uno se pasa la
// tarde moviendo un torso de a dos píxeles.
//
// UNO POR PERSONAJE, y es la mitad de lo que los distingue. Rilo es alto y
// flaco —64 px, torso largo porque el guardapolvo le llega a la rodilla—;
// Tito es bajo y cabezón —54 px, y su cabeza sola es el 36% de su altura
// contra el 29% de la del abuelo—. Eso también cambia cómo caen: los miembros
// largos de Rilo tienen más palanca y se voltean más.

// Cuánto mide cada uno EN EL JUEGO, en píxeles del mundo (que son 360 de
// ancho). Con las piezas dibujadas hace falta más tamaño que con las líneas
// vectoriales: una cara de 20 píxeles es una mancha, y lo que se ganó
// dibujando a Rilo con su guardapolvo se pierde si no se le ve.
const ALTO = { rilo: 76, tito: 62 };
let escala = 1;


/**
 * De las fracciones del dibujo a los once puntos del ragdoll.
 *
 * Las masas sí van a mano: no salen de ningún dibujo. La cabeza y el pecho
 * pesan porque son el centro del cuerpo, las manos casi nada. Los radios son
 * la mitad del grosor de cada parte, redondeados a lo que hace falta para que
 * el muñeco no se hunda en el piso.
 */
function esqueleto(clave) {
  const m = MEDIDAS[clave], H = ALTO[clave] * escala;
  const hombro = m.cabeza * H;
  const cadera = hombro + m.torso * H;
  const rodilla = cadera + m.muslo * H;
  const pie = rodilla + m.canilla * H;
  const codo = hombro + m.brazo_alto * H;
  const mano = codo + m.brazo_bajo * H;
  const w = m.hombro_ancho * H;
  return [
    // La cabeza va al MEDIO de la cabeza dibujada, no arriba de todo: es el
    // punto que la física empuja y tiene que estar donde está el peso.
    ["cabeza", 0, hombro * 0.5, Math.max(5.5, hombro * 0.34), 2.3],
    ["pecho", 0, hombro, w * 0.34, 3.0],
    ["cadera", 0, cadera, w * 0.30, 2.6],
    ["codoIzq", -w * 0.62, codo, 2.8, 0.9], ["manoIzq", -w * 0.78, mano, 2.8, 0.8],
    ["codoDer", w * 0.62, codo, 2.8, 0.9], ["manoDer", w * 0.78, mano, 2.8, 0.8],
    // Rodillas y pies PESADOS, y no por realismo. La canilla de Rilo mide ocho
    // píxeles —el guardapolvo le tapa la pierna hasta la rodilla— y un hueso
    // corto entre dos puntos livianos es lo que más se estira cuando le pega
    // algo: el mismo golpe lo mueve más y el solucionador tiene menos largo
    // para repartir la corrección. Con masa 1,5 el estirón bajó de 25% a 13%.
    ["rodIzq", -w * 0.24, rodilla, 3.0, 1.5], ["pieIzq", -w * 0.28, pie, 3.4, 1.5],
    ["rodDer", w * 0.24, rodilla, 3.0, 1.5], ["pieDer", w * 0.28, pie, 3.4, 1.5],
  ];
}

// LOS CUERPOS SE PUEDEN ACHICAR, y hace falta. En el pozo el pasillo mide 360
// y un Rilo de 76 píxeles se lee bien; en el modo portales el escenario es una
// grilla de tiles de 16 y el agujero de un portal mide dos: por ahí no entra
// un muñeco de cinco tiles. Achicándolos a dos tercios, el portal pasa a ser
// una puerta y no una ranura. Se cambia ANTES de crear los cuerpos: el
// esqueleto se recalcula acá y crearCuerpo lee el resultado.
export function escalarCuerpos(k) {
  if (k === escala) return;
  escala = k;
  ESQUELETOS.rilo = esqueleto("rilo");
  ESQUELETOS.tito = esqueleto("tito");
}
export const altoDe = (clave) => ALTO[clave] * escala;

const ESQUELETOS = { rilo: esqueleto("rilo"), tito: esqueleto("tito") };

export const ALTO_CUERPO = ALTO.rilo;

export function crearCuerpo(x, y, pinta) {
  const p = {};
  const puntos = [];
  for (const [n, dx, dy, r, m] of ESQUELETOS[pinta.clave]) {
    const pt = punto(x + dx, y + dy, { radio: r, masa: m, nombre: n });
    p[n] = pt; puntos.push(pt);
  }
  const palos = [];
  const unir = (a, b, opc) => palos.push(palo(p[a], p[b], opc));
  unir("cabeza", "pecho");            // cuello
  unir("pecho", "cadera");            // columna
  unir("pecho", "codoIzq"); unir("codoIzq", "manoIzq");
  unir("pecho", "codoDer"); unir("codoDer", "manoDer");
  unir("cadera", "rodIzq"); unir("rodIzq", "pieIzq");
  unir("cadera", "rodDer"); unir("rodDer", "pieDer");

  // Los flojos. Se guardan aparte porque hacerse bolita los acorta.
  const forma = [];
  const dar = (a, b, rig) => {
    const s = palo(p[a], p[b], { rigidez: rig, tipo: "forma" });
    s.base = s.largo; palos.push(s); forma.push(s);
  };
  dar("cabeza", "cadera", 0.14);
  dar("pecho", "rodIzq", 0.07); dar("pecho", "rodDer", 0.07);
  dar("codoIzq", "codoDer", 0.06);
  dar("rodIzq", "rodDer", 0.05);
  dar("cabeza", "manoIzq", 0.03); dar("cabeza", "manoDer", 0.03);
  // Estos dos casi no existen mientras el cuerpo esta suelto —rigidez 0,02 no
  // corrige nada— y son los que doblan al muneco al medio cuando se hace
  // bolita: son los unicos que unen la cabeza con los pies, que es la
  // distancia que hay que acortar para que un cuerpo se vuelva una pelota.
  dar("cabeza", "pieIzq", 0.02); dar("cabeza", "pieDer", 0.02);

  return { puntos, palos, forma, p, pinta, bolita: 0, mirada: 0 };
}

/**
 * Hacerse bolita: los palos de forma se acortan y se endurecen.
 *
 * Es la unica defensa que tiene el jugador contra un golpe, y funciona porque
 * un cuerpo hecho un ovillo reparte el golpe entre once puntos en vez de
 * clavar la cabeza sola contra el piso. La fisica lo hace sola: no hay un
 * "modo invulnerable", hay un cuerpo con otra forma.
 */
export function ovillar(c, cuanto) {
  c.bolita += (cuanto - c.bolita) * 0.22;
  const k = 1 - c.bolita * 0.45;
  for (const s of c.forma) {
    s.largo = s.base * k;
    // La rigidez sube casi hasta la de un hueso: un palo de forma flojo
    // acortado no encoge nada, lo tironea el hueso de al lado y gana el hueso.
    // Se queda por debajo de la rigidez de un hueso (1) a proposito: si la
    // pasa, el palo de forma le gana al hueso y el brazo se comprime a la
    // mitad — el ovillo queda bien y los brazos quedan cortos.
    s.rigidez = 0.06 + c.bolita * 0.30;
  }
}

export function centro(c) {
  return { x: (c.p.pecho.x + c.p.cadera.x) / 2, y: (c.p.pecho.y + c.p.cadera.y) / 2 };
}

// --- dibujo con piezas ---------------------------------------------------
//
// CADA PIEZA SE DIBUJA ENTRE DOS ARTICULACIONES. No hay poses ni cuadros de
// animacion: se toma el hueso que va del codo a la mano, se rota la imagen del
// antebrazo a ese angulo y se la estira a ese largo. Como el hueso lo movio la
// fisica, el dibujo la sigue sin que nadie tenga que sincronizar nada.
//
// TODAS LAS PIEZAS VIENEN VERTICALES, con la articulacion de arriba en el
// borde superior y la de abajo en el inferior (lo garantiza preparar_assets.py
// recortando al contenido). Por eso alcanza con rotar `atan2(b−a) − 90°`: el
// "abajo" de la imagen es el "hacia b" del hueso.
//
// Y SI LAS IMAGENES NO ESTAN, se dibuja igual. El juego arranco siendo
// vectorial y esa version sigue entera mas abajo: si una pieza no cargo —red
// caida, archivo faltante— el muneco se dibuja solo con lineas y circulos en
// vez de desaparecer.

let PIEZAS = null;
export function registrarPiezas(p) { PIEZAS = p; }
export const hayPiezas = () => !!PIEZAS;

// `k` es el ancho relativo al que sale de la proporcion de la imagen, y
// `sobra` cuanto se pasa la pieza del largo del hueso para que las
// articulaciones se solapen en vez de mostrar el hueco entre dos piezas.
const AJUSTE = {
  torso:       { k: 1.00, sobra: 1.12 },
  brazo_alto:  { k: 0.90, sobra: 1.34 },
  brazo_bajo:  { k: 0.90, sobra: 1.30 },
  pierna_alta: { k: 0.95, sobra: 1.30 },
  pierna_baja: { k: 0.95, sobra: 1.26 },
};

function tramo(ctx, img, a, b, parte) {
  if (!img) return false;
  const cfg = AJUSTE[parte];
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const alto = d * cfg.sobra;
  const an = alto * (img.width / img.height) * cfg.k;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  ctx.drawImage(img, -an / 2, -d * (cfg.sobra - 1) / 2, an, alto);
  ctx.restore();
  return true;
}

function cabezaImg(ctx, c, img) {
  // La cabeza no va entre dos puntos: va CENTRADA en el suyo, con el pelo
  // asomando para arriba. `ancla` dice a que altura de la imagen cae la cara,
  // porque el pelo de Rilo ocupa media pieza y centrarla a la mitad le dejaria
  // la cara en el pecho.
  const p = c.p;
  const ax = p.cabeza.x - p.pecho.x, ay = p.cabeza.y - p.pecho.y;
  // El alto de la cabeza también sale de la medida: es la fracción del dibujo
  // por la altura del personaje, con un pelín de más para que tape el cuello.
  const alto = MEDIDAS[c.pinta.clave].cabeza * altoDe(c.pinta.clave) * 1.06;
  const an = alto * (img.width / img.height);
  ctx.save();
  ctx.translate(p.cabeza.x, p.cabeza.y);
  ctx.rotate(Math.atan2(ay, ax) + Math.PI / 2);
  ctx.drawImage(img, -an / 2, -alto * c.pinta.cabezaAncla, an, alto);
  ctx.restore();
}

function dibujarConPiezas(ctx, c, im) {
  const p = c.p;
  // El orden ES la profundidad: lo de atras primero. El brazo y la pierna
  // derechos van detras del torso, los izquierdos adelante; asi el muneco se
  // lee con volumen aunque todo sea plano.
  tramo(ctx, im.brazo_alto, p.pecho, p.codoDer, "brazo_alto");
  tramo(ctx, im.brazo_bajo, p.codoDer, p.manoDer, "brazo_bajo");
  tramo(ctx, im.pierna_alta, p.cadera, p.rodDer, "pierna_alta");
  tramo(ctx, im.pierna_baja, p.rodDer, p.pieDer, "pierna_baja");
  tramo(ctx, im.pierna_alta, p.cadera, p.rodIzq, "pierna_alta");
  tramo(ctx, im.pierna_baja, p.rodIzq, p.pieIzq, "pierna_baja");
  tramo(ctx, im.torso, p.pecho, p.cadera, "torso");
  tramo(ctx, im.brazo_alto, p.pecho, p.codoIzq, "brazo_alto");
  tramo(ctx, im.brazo_bajo, p.codoIzq, p.manoIzq, "brazo_bajo");
  cabezaImg(ctx, c, im.cabeza);
}

// --- dibujo vectorial (el respaldo) --------------------------------------

const linea = (ctx, a, b, gr, color) => {
  ctx.strokeStyle = color; ctx.lineWidth = gr; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
};

/** Los hombros y las caderas salen de la columna, girados 90 grados. */
function ejes(c) {
  const dx = c.p.cadera.x - c.p.pecho.x, dy = c.p.cadera.y - c.p.pecho.y;
  const d = Math.hypot(dx, dy) || 1;
  return { nx: -dy / d, ny: dx / d };
}

export function dibujarCuerpo(ctx, c) {
  const im = PIEZAS && PIEZAS[c.pinta.clave];
  if (im && im.torso && im.cabeza) return dibujarConPiezas(ctx, c, im);
  return dibujarVector(ctx, c);
}

function dibujarVector(ctx, c) {
  const { p, pinta } = c;
  const { nx, ny } = ejes(c);

  // Las piernas y los brazos de atras primero: el orden de pintado es la
  // unica profundidad que tiene un dibujo plano.
  linea(ctx, p.cadera, p.rodDer, 7, pinta.pantalon);
  linea(ctx, p.rodDer, p.pieDer, 6, pinta.pantalon);
  linea(ctx, p.cadera, p.rodIzq, 7, pinta.pantalon);
  linea(ctx, p.rodIzq, p.pieIzq, 6, pinta.pantalon);
  for (const pie of [p.pieDer, p.pieIzq]) {
    ctx.fillStyle = pinta.zapato;
    ctx.beginPath(); ctx.ellipse(pie.x, pie.y + 1, 5.5, 3.6, 0, 0, 7); ctx.fill();
  }

  // El torso: un cuadrilatero entre hombros y caderas, no un rectangulo. Al
  // doblarse la columna el tronco se dobla con ella.
  const ho = 9, ca = 7;
  ctx.fillStyle = pinta.torso;
  ctx.beginPath();
  ctx.moveTo(p.pecho.x + nx * ho, p.pecho.y + ny * ho);
  ctx.lineTo(p.cadera.x + nx * ca, p.cadera.y + ny * ca);
  ctx.lineTo(p.cadera.x - nx * ca, p.cadera.y - ny * ca);
  ctx.lineTo(p.pecho.x - nx * ho, p.pecho.y - ny * ho);
  ctx.closePath(); ctx.fill();
  if (pinta.solapa) {
    // El guardapolvo abierto: dos solapas y una linea al medio. Es lo que
    // hace que de lejos se lea "cientifico" y no "tipo de remera blanca".
    ctx.strokeStyle = pinta.solapa; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.pecho.x, p.pecho.y); ctx.lineTo(p.cadera.x, p.cadera.y);
    ctx.stroke();
    ctx.fillStyle = pinta.solapa;
    ctx.beginPath();
    ctx.moveTo(p.pecho.x + nx * ho, p.pecho.y + ny * ho);
    ctx.lineTo(p.pecho.x + nx * 2, p.pecho.y + ny * 2 + 9);
    ctx.lineTo(p.pecho.x + nx * ho * 0.6, p.pecho.y + ny * ho * 0.6 + 2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.pecho.x - nx * ho, p.pecho.y - ny * ho);
    ctx.lineTo(p.pecho.x - nx * 2, p.pecho.y - ny * 2 + 9);
    ctx.lineTo(p.pecho.x - nx * ho * 0.6, p.pecho.y - ny * ho * 0.6 + 2);
    ctx.closePath(); ctx.fill();
  }

  linea(ctx, p.pecho, p.codoDer, 5.5, pinta.brazo);
  linea(ctx, p.codoDer, p.manoDer, 5, pinta.brazo);
  linea(ctx, p.pecho, p.codoIzq, 5.5, pinta.brazo);
  linea(ctx, p.codoIzq, p.manoIzq, 5, pinta.brazo);
  for (const mano of [p.manoDer, p.manoIzq]) {
    ctx.fillStyle = pinta.piel;
    ctx.beginPath(); ctx.arc(mano.x, mano.y, 3.4, 0, 7); ctx.fill();
  }

  // El cuello, para que la cabeza no flote.
  linea(ctx, p.pecho, p.cabeza, 5, pinta.piel);

  // La cabeza. El angulo sale del vector cuello→cabeza: la cara mira para
  // donde apunta el cuello, siempre, sin guardar ningun estado.
  const ax = p.cabeza.x - p.pecho.x, ay = p.cabeza.y - p.pecho.y;
  const ang = Math.atan2(ay, ax) + Math.PI / 2;
  ctx.save();
  ctx.translate(p.cabeza.x, p.cabeza.y);
  ctx.rotate(ang);
  if (pinta.pelo === "pinchos") {
    // El pelo del viejo: nueve pinchos alrededor de la media cabeza de
    // arriba. Se dibujan antes que la cara para que salgan de atras.
    ctx.fillStyle = pinta.pelocolor;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r = i % 2 ? 15.5 : 8;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 1);
    }
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = pinta.piel;
  ctx.beginPath(); ctx.arc(0, 0, 7.6, 0, 7); ctx.fill();
  if (pinta.pelo === "tazon") {
    // El flequillo del pibe: un casquete que le tapa media frente.
    ctx.fillStyle = pinta.pelocolor;
    ctx.beginPath();
    ctx.arc(0, -0.5, 8, Math.PI, 0);
    ctx.lineTo(8, -0.5); ctx.lineTo(-8, -0.5);
    ctx.closePath(); ctx.fill();
  }
  // Los ojos miran para donde va el cuerpo. Es el detalle mas barato que hay
  // y el que mas hace: un ragdoll con los ojos quietos parece un maniqui.
  const m = Math.max(-1, Math.min(1, c.mirada));
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(s * 3.1, 0.5, 2.9, 3.3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#13161f";
    ctx.beginPath(); ctx.arc(s * 3.1 + m * 1.3, 1.1, 1.35, 0, 7); ctx.fill();
  }
  if (pinta.ceja) {
    ctx.strokeStyle = pinta.pelocolor; ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-6, -3.6); ctx.lineTo(-1.2, -4.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1.2, -5.2); ctx.lineTo(6, -3.2); ctx.stroke();
  }
  ctx.strokeStyle = "#7a3b46"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 4, 2.4, 0.25, Math.PI - 0.25); ctx.stroke();
  if (pinta.baba) {
    // La babita. Es un personaje, no un muneco de pruebas.
    ctx.fillStyle = "rgba(180,230,255,.75)";
    ctx.beginPath(); ctx.ellipse(2.6, 6.4, 1, 2.1, 0, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// Las dos pintas del juego. Los colores son los del respaldo vectorial; con
// las piezas cargadas mandan las imagenes. `cabezaAncla` es a que altura de la
// imagen de la cabeza cae la cara: Rilo lleva media pieza de pelo arriba, Tito
// casi nada, y centrar las dos en el mismo lugar le deja la cara a uno donde
// el otro tiene la nuca.
export const RILO = {
  clave: "rilo", cabezaAncla: 0.5,
  torso: "#eef2f7", solapa: "#cdd6e2", brazo: "#eef2f7", piel: "#d9b48f",
  pantalon: "#6b5535", zapato: "#3a3f4a", pelo: "pinchos", pelocolor: "#8fe3f5",
  ceja: true, baba: true,
};
export const TITO = {
  clave: "tito", cabezaAncla: 0.48,
  torso: "#f5d341", solapa: null, brazo: "#f5d341", piel: "#e2b483",
  pantalon: "#2f4d7a", zapato: "#e8eaf0", pelo: "tazon", pelocolor: "#7a4a2a",
  ceja: false, baba: false,
};
