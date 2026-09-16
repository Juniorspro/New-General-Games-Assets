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

// El esqueleto, en pixeles y con el (0,0) en la cabeza. Cambiarlo cambia la
// forma del muneco y nada mas: los huesos miden su largo de aca.
const HUESOS = [
  ["cabeza", 0, 0, 7.0, 2.4],
  ["pecho", 0, 15, 5.5, 3.0],
  ["cadera", 0, 27, 5.0, 2.6],
  ["codoIzq", -9, 21, 3.0, 0.9], ["manoIzq", -14, 31, 3.0, 0.7],
  ["codoDer", 9, 21, 3.0, 0.9], ["manoDer", 14, 31, 3.0, 0.7],
  ["rodIzq", -6, 39, 3.5, 1.1], ["pieIzq", -7, 51, 3.8, 0.9],
  ["rodDer", 6, 39, 3.5, 1.1], ["pieDer", 7, 51, 3.8, 0.9],
];

export const ALTO_CUERPO = 58;

export function crearCuerpo(x, y, pinta) {
  const p = {};
  const puntos = [];
  for (const [n, dx, dy, r, m] of HUESOS) {
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
  const k = 1 - c.bolita * 0.55;
  for (const s of c.forma) {
    s.largo = s.base * k;
    // La rigidez sube casi hasta la de un hueso: un palo de forma flojo
    // acortado no encoge nada, lo tironea el hueso de al lado y gana el hueso.
    // Se queda por debajo de la rigidez de un hueso (1) a proposito: si la
    // pasa, el palo de forma le gana al hueso y el brazo se comprime a la
    // mitad — el ovillo queda bien y los brazos quedan cortos.
    s.rigidez = 0.06 + c.bolita * 0.42;
  }
}

export function centro(c) {
  return { x: (c.p.pecho.x + c.p.cadera.x) / 2, y: (c.p.pecho.y + c.p.cadera.y) / 2 };
}

// --- dibujo --------------------------------------------------------------

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

// Las dos pintas del juego. Son originales a proposito: homenaje, no calco.
export const RILO = {
  torso: "#eef2f7", solapa: "#cdd6e2", brazo: "#eef2f7", piel: "#d9b48f",
  pantalon: "#3a4a63", zapato: "#22293a", pelo: "pinchos", pelocolor: "#8fe3f5",
  ceja: true, baba: true,
};
export const TITO = {
  torso: "#f5d341", solapa: null, brazo: "#f5d341", piel: "#e2b483",
  pantalon: "#2f4d7a", zapato: "#2a2f3d", pelo: "tazon", pelocolor: "#7a4a2a",
  ceja: false, baba: false,
};
