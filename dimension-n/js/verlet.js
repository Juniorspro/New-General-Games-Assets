// El motor: integracion de Verlet con restricciones de distancia.
//
// POR QUE VERLET Y NO UN MOTOR DE FUERZAS. Un ragdoll es una docena de puntos
// unidos por huesos que no se estiran. Con un motor clasico eso se escribe
// como fuerzas de resorte, y un resorte rigido explota: para que el hueso no
// se estire hay que subirle la constante, y cuanto mas alta, mas chico tiene
// que ser el paso de tiempo o el sistema se va a infinito en tres cuadros.
//
// Verlet no guarda velocidad: la velocidad ES la diferencia entre la posicion
// de ahora y la del cuadro anterior. Entonces una restriccion se cumple
// MOVIENDO los puntos, no empujandolos, y mover un punto le cambia la
// velocidad solo, gratis y de forma consistente. Un hueso se vuelve "poneme
// estos dos puntos a 14 pixeles" repetido unas cuantas veces por cuadro, y eso
// es estable por construccion: no hay constante que ajustar ni nada que pueda
// divergir.
//
// El precio es que las restricciones se cumplen POR APROXIMACION: cada vuelta
// del solucionador acerca el sistema a la respuesta sin llegar nunca. Con
// pocas vueltas el muneco queda de goma; con muchas, rigido y caro. Seis es
// donde se ve articulado y no elastico, medido en pruebas/fisica.mjs.

export const G = 0.46;          // gravedad, en pixeles por cuadro al cuadrado
export const ROCE_AIRE = 0.994; // lo que conserva de velocidad cada cuadro
export const VUELTAS = 6;       // pasadas del solucionador de restricciones
// LA VELOCIDAD MAXIMA DE CAIDA, y es un numero de diseno, no de fisica. Sin
// tope, el roce del aire deja una terminal de 76 px por cuadro: el pasillo
// entero pasa en medio segundo y no hay forma humana de meterse en un hueco.
// Con 7,6 se cruza la pantalla en un segundo y medio, que es el tiempo que
// hace falta para ver un obstaculo y corregir. Solo limita la CAIDA: para los
// costados y para arriba no hay tope, asi que un resorte sigue disparando.
export const TOPE_CAIDA = 7.6;

export function punto(x, y, opc = {}) {
  return {
    x, y, px: x, py: y,          // posicion de ahora y la del cuadro anterior
    radio: opc.radio ?? 4,
    masa: opc.masa ?? 1,
    fijo: !!opc.fijo,
    roce: opc.roce ?? 0.72,      // cuanto frena al rozar una superficie
    rebote: opc.rebote ?? 0.24,
    nombre: opc.nombre || "",
    tocando: false,              // si este cuadro toco algo solido
    golpe: 0,                    // la velocidad con la que llego al choque
  };
}

/** El largo de un palo se mide al crearlo: asi el cuerpo define su propia forma. */
export function palo(a, b, opc = {}) {
  const largo = opc.largo ?? Math.hypot(a.x - b.x, a.y - b.y);
  return { a, b, largo, rigidez: opc.rigidez ?? 1, tipo: opc.tipo || "hueso" };
}

export const vel = (p) => ({ x: p.x - p.px, y: p.y - p.py });
export const rapidez = (p) => Math.hypot(p.x - p.px, p.y - p.py);

/** Mover un punto SIN que cuente como velocidad: se arrastra tambien el pasado. */
export function teletransportar(p, dx, dy) {
  p.x += dx; p.y += dy; p.px += dx; p.py += dy;
}

export function empujar(p, fx, fy) {
  // Un empujon es un cambio de velocidad, y en Verlet la velocidad es la
  // distancia al pasado: para acelerar hay que ALEJAR el pasado.
  p.px -= fx / p.masa;
  p.py -= fy / p.masa;
}

/**
 * Un paso de integracion.
 *
 * El tope de velocidad no es cosmetico: un punto que en un cuadro se mueve mas
 * que el grosor de una pared la atraviesa entera y aparece del otro lado, y
 * despues la restriccion del hueso lo arrastra a la nada. Con 22 px por cuadro
 * de tope, nada del nivel es mas fino que un paso.
 */
export function integrar(puntos, gravedad = G, tope = 22) {
  for (const p of puntos) {
    p.tocando = false; p.golpe = 0;
    if (p.fijo) { p.px = p.x; p.py = p.y; continue; }
    let vx = (p.x - p.px) * ROCE_AIRE;
    let vy = (p.y - p.py) * ROCE_AIRE + gravedad;
    const v = Math.hypot(vx, vy);
    if (v > tope) { vx = vx / v * tope; vy = vy / v * tope; }
    // El tope se aplica DESPUES de sumar la gravedad. Aplicado antes, cada
    // cuadro le vuelve a sumar los 0,46 de la gravedad encima del tope y la
    // caida real termina siendo tope + gravedad: el numero del codigo y el
    // numero medido no coinciden, que es la peor clase de constante.
    if (vy > TOPE_CAIDA) vy = TOPE_CAIDA;
    p.px = p.x; p.py = p.y;
    p.x += vx;
    p.y += vy;
  }
}

/**
 * Cumplir las restricciones.
 *
 * "hueso" mantiene una distancia exacta; "cuerda" SOLO tira cuando se estiro
 * de mas —una soga empuja nada— y "resorte" es un hueso blando que se usa para
 * las articulaciones que tienen que ceder un poco.
 */
export function resolver(palos, vueltas = VUELTAS) {
  for (let v = 0; v < vueltas; v++) {
    for (const s of palos) {
      const { a, b } = s;
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d < 0.0001) { dx = 0.01; d = 0.01; }
      if (s.tipo === "cuerda" && d <= s.largo) continue;
      const dif = (s.largo - d) / d * s.rigidez * 0.5;
      const ox = dx * dif, oy = dy * dif;
      // El reparto va por masa invertida: la cabeza pesa mas que una mano y
      // tiene que moverse menos cuando el cuello tira de las dos.
      const ia = a.fijo ? 0 : 1 / a.masa, ib = b.fijo ? 0 : 1 / b.masa;
      const tot = ia + ib;
      if (tot === 0) continue;
      a.x -= ox * (ia / tot) * 2; a.y -= oy * (ia / tot) * 2;
      b.x += ox * (ib / tot) * 2; b.y += oy * (ib / tot) * 2;
    }
  }
}

/**
 * Chocar un punto contra un rectangulo, sacandolo por el lado mas cercano.
 *
 * Sale por el lado MENOS hundido y no por el de arriba siempre: un punto que
 * entra por el costado de una repisa y se lo saca para arriba aparece parado
 * encima de la nada, y es la diferencia entre una repisa y un ascensor.
 *
 * Devuelve la rapidez con la que llego, para que quien llame decida si eso
 * fue un golpe o un apoyo.
 */
export function contraCaja(p, x, y, an, al, opc = {}) {
  const r = p.radio;
  if (p.x + r < x || p.x - r > x + an || p.y + r < y || p.y - r > y + al) return 0;
  const izq = (p.x + r) - x, der = (x + an) - (p.x - r);
  const arr = (p.y + r) - y, aba = (y + al) - (p.y - r);
  const min = Math.min(izq, der, arr, aba);
  const llego = rapidez(p);
  const rebote = opc.rebote ?? p.rebote, roce = opc.roce ?? p.roce;
  let vx = p.x - p.px, vy = p.y - p.py;
  if (min === arr)      { p.y = y - r;      if (vy > 0) vy = -vy * rebote; vx *= roce; }
  else if (min === aba) { p.y = y + al + r; if (vy < 0) vy = -vy * rebote; vx *= roce; }
  else if (min === izq) { p.x = x - r;      if (vx > 0) vx = -vx * rebote; vy *= roce; }
  else                  { p.x = x + an + r; if (vx < 0) vx = -vx * rebote; vy *= roce; }
  p.px = p.x - vx; p.py = p.y - vy;
  p.tocando = true; p.golpe = Math.max(p.golpe, llego);
  return llego;
}

/** Chocar un punto contra un segmento grueso: es lo que son las aspas. */
export function contraSegmento(p, x1, y1, x2, y2, grosor, opc = {}) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((p.x - x1) * dx + (p.y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + dx * t, cy = y1 + dy * t;
  let nx = p.x - cx, ny = p.y - cy;
  let d = Math.hypot(nx, ny);
  const min = grosor + p.radio;
  if (d >= min) return 0;
  if (d < 0.0001) { nx = 0; ny = -1; d = 1; }
  const llego = rapidez(p);
  nx /= d; ny /= d;
  p.x = cx + nx * min; p.y = cy + ny * min;
  // Se le suma la velocidad de la propia aspa en ese punto: sin esto el aspa
  // atraviesa al muneco sin despeinarlo, que es lo contrario de lo que hace
  // un aspa.
  const emp = opc.empuje ?? 0;
  p.px = p.x - (p.x - p.px) * (opc.roce ?? 0.5) - nx * emp;
  p.py = p.y - (p.y - p.py) * (opc.roce ?? 0.5) - ny * emp;
  p.tocando = true; p.golpe = Math.max(p.golpe, llego);
  return llego;
}
