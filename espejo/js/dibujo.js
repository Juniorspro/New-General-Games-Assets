// El dibujo del tablero. Todo vectorial: son rectángulos, líneas y círculos, y
// el código los hace más nítidos que cualquier imagen escalada.

import { VACIO, MURO, ESPEJO, FIJO, EMISOR, OBJETIVO, DIRS } from "./haz.js";

export const COLOR = {
  cian: { vivo: "#5ad8ff", apagado: "#1d4a5e", brillo: "rgba(90,216,255,.30)" },
  rosa: { vivo: "#ff7bd5", apagado: "#5e2450", brillo: "rgba(255,123,213,.30)" },
  ambar: { vivo: "#ffc24a", apagado: "#5e4418", brillo: "rgba(255,194,74,.30)" },
};

export const VISTA = { ancho: 360, alto: 640 };

/** Dónde cae el tablero adentro del lienzo, y cuánto mide una celda. */
export function medidas(nivel) {
  const margen = 14;
  const lado = Math.floor(Math.min((VISTA.ancho - margen * 2) / nivel.ancho,
                                   (VISTA.alto - 150) / nivel.alto));
  const an = lado * nivel.ancho, al = lado * nivel.alto;
  return { lado, x0: Math.round((VISTA.ancho - an) / 2), y0: Math.round((VISTA.alto - al) / 2 + 14) };
}

/** De un toque en el lienzo a una celda. Devuelve null si cayó afuera. */
export function celdaDe(nivel, px, py) {
  const { lado, x0, y0 } = medidas(nivel);
  const c = Math.floor((px - x0) / lado), f = Math.floor((py - y0) / lado);
  if (c < 0 || f < 0 || c >= nivel.ancho || f >= nivel.alto) return null;
  return { c, f };
}

export function dibujar(ctx, p, t) {
  const n = p.nivel;
  const { lado, x0, y0 } = medidas(n);
  ctx.clearRect(0, 0, VISTA.ancho, VISTA.alto);

  // El tablero: una cuadrícula tenue. Sin ella no se ve dónde se puede tocar y
  // el jugador prueba a ciegas — que en un puzzle es lo mismo que no jugar.
  ctx.fillStyle = "#101628";
  ctx.fillRect(x0 - 5, y0 - 5, lado * n.ancho + 10, lado * n.alto + 10);
  ctx.strokeStyle = "rgba(255,255,255,.055)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= n.ancho; c++) { ctx.moveTo(x0 + c * lado, y0); ctx.lineTo(x0 + c * lado, y0 + n.alto * lado); }
  for (let f = 0; f <= n.alto; f++) { ctx.moveTo(x0, y0 + f * lado); ctx.lineTo(x0 + n.ancho * lado, y0 + f * lado); }
  ctx.stroke();

  dibujarRayos(ctx, p, lado, x0, y0, t);

  for (let f = 0; f < n.alto; f++)
    for (let c = 0; c < n.ancho; c++)
      dibujarCelda(ctx, p, c, f, lado, x0, y0, t);
}

const cen = (c, f, lado, x0, y0) => [x0 + c * lado + lado / 2, y0 + f * lado + lado / 2];

function dibujarRayos(ctx, p, lado, x0, y0, t) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  // Se dibuja dos veces: una gorda y transparente para el resplandor, otra fina
  // y llena para el rayo. Un `shadowBlur` haría lo mismo y cuesta diez veces
  // más en un teléfono, porque desenfoca de verdad en vez de superponer.
  for (const pasada of [0, 1]) {
    for (const [c, f, entra, sale, color] of p.tramos) {
      const col = COLOR[color] || COLOR.cian;
      ctx.strokeStyle = pasada === 0 ? col.brillo : col.vivo;
      ctx.lineWidth = pasada === 0 ? Math.max(7, lado * 0.32) : 2.5;
      const [x, y] = cen(c, f, lado, x0, y0);
      const [ec, ef] = DIRS[entra];
      ctx.beginPath();
      ctx.moveTo(x - ec * lado / 2, y - ef * lado / 2);
      ctx.lineTo(x, y);
      if (sale) {
        const [sc, sf] = DIRS[sale];
        ctx.lineTo(x + sc * lado / 2, y + sf * lado / 2);
      }
      ctx.stroke();
    }
  }
}

function dibujarCelda(ctx, p, c, f, lado, x0, y0, t) {
  const cel = p.celda(c, f);
  if (!cel || cel.t === VACIO) return;
  const [x, y] = cen(c, f, lado, x0, y0);
  const r = lado * 0.38;

  if (cel.t === MURO) {
    ctx.fillStyle = "#2c3350";
    ctx.beginPath(); ctx.roundRect(x - lado * 0.42, y - lado * 0.42, lado * 0.84, lado * 0.84, 5); ctx.fill();
    ctx.strokeStyle = "#454f78"; ctx.lineWidth = 2; ctx.stroke();
    return;
  }

  if (cel.t === EMISOR) {
    const col = COLOR[cel.color];
    ctx.fillStyle = "#1b2440";
    ctx.beginPath(); ctx.roundRect(x - lado * 0.42, y - lado * 0.42, lado * 0.84, lado * 0.84, 7); ctx.fill();
    ctx.strokeStyle = col.vivo; ctx.lineWidth = 2.5; ctx.stroke();
    // La boca mira para donde sale el rayo: es lo único que dice hacia dónde
    // dispara, y sin eso hay que trazar el rayo con el dedo para enterarse.
    const [dc, df] = DIRS[cel.dir];
    ctx.fillStyle = col.vivo;
    ctx.beginPath();
    ctx.arc(x + dc * lado * 0.26, y + df * lado * 0.26, lado * 0.13, 0, 7);
    ctx.fill();
    return;
  }

  if (cel.t === OBJETIVO) {
    const col = COLOR[cel.color];
    const on = p.prendidos.has(`${c},${f}`);
    ctx.strokeStyle = on ? col.vivo : col.apagado;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, 7);
    ctx.fillStyle = on ? col.vivo : "transparent"; ctx.fill();
    if (on) {
      // Un anillo que late: el objetivo prendido tiene que verse desde el otro
      // lado de la pantalla, porque es la única forma de saber que vas bien.
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 0.005);
      ctx.strokeStyle = col.vivo; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    return;
  }

  // Los espejos. El movible se dibuja con un marco redondeado —"esto se toca"—
  // y el fijo sin nada: la diferencia tiene que leerse de un vistazo, porque
  // tocar veinte veces uno fijo es la forma más rápida de creer que el juego
  // está roto.
  const movible = cel.t === ESPEJO;
  const vuelco = movible ? p.estado[cel.i] : cel.vuelco;
  if (movible) {
    ctx.fillStyle = "rgba(90,216,255,.07)";
    ctx.strokeStyle = "rgba(90,216,255,.30)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x - lado * 0.44, y - lado * 0.44, lado * 0.88, lado * 0.88, 8);
    ctx.fill(); ctx.stroke();
  }
  const d = lado * 0.34;
  const [ax, ay, bx, by] = vuelco === 0 ? [x - d, y + d, x + d, y - d] : [x - d, y - d, x + d, y + d];
  ctx.strokeStyle = movible ? "#e8f3ff" : "#8b97b8";
  ctx.lineWidth = movible ? 5 : 4;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  // El canto oscuro del espejo, del lado de atrás: le da grosor y hace que se
  // lea como un objeto y no como una raya.
  ctx.strokeStyle = movible ? "#5b7fa8" : "#3f4763";
  ctx.lineWidth = 2;
  const off = lado * 0.07;
  ctx.beginPath();
  ctx.moveTo(ax + off, ay + off); ctx.lineTo(bx + off, by + off);
  ctx.stroke();
  if (!movible) {
    ctx.fillStyle = "#3f4763";
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
  }
}

/** El destello del espejo recién tocado: dura poco y no guarda estado. */
export function marcarToque(ctx, nivel, c, f, edad) {
  const { lado, x0, y0 } = medidas(nivel);
  const [x, y] = cen(c, f, lado, x0, y0);
  ctx.globalAlpha = Math.max(0, 1 - edad);
  ctx.strokeStyle = "#e8f3ff"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, lado * (0.4 + edad * 0.5), 0, 7); ctx.stroke();
  ctx.globalAlpha = 1;
}
