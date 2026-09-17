// El dibujo del tablero. Todo vectorial: son rectángulos, líneas y círculos, y
// el código los hace más nítidos que cualquier imagen escalada.

import { VACIO, MURO, ESPEJO, FIJO, EMISOR, OBJETIVO, DIRS } from "./haz.js";
import { ruta } from "./assets.js";

export const COLOR = {
  cian: { vivo: "#5ad8ff", apagado: "#1d4a5e", brillo: "rgba(90,216,255,.30)" },
  rosa: { vivo: "#ff7bd5", apagado: "#5e2450", brillo: "rgba(255,123,213,.30)" },
  ambar: { vivo: "#ffc24a", apagado: "#5e4418", brillo: "rgba(255,194,74,.30)" },
};

export const VISTA = { ancho: 360, alto: 640 };

const arte = {};
export function registrarArte(nombre, imagen) { if (imagen) arte[nombre] = imagen; }
export const rutaArte = (n) => ruta(`assets/arte/${n}.webp`);

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

export function dibujar(ctx, p, t, anim) {
  const n = p.nivel;
  const { lado, x0, y0 } = medidas(n);
  ctx.clearRect(0, 0, VISTA.ancho, VISTA.alto);

  // El tablero: una cuadrícula tenue. Sin ella no se ve dónde se puede tocar y
  // el jugador prueba a ciegas — que en un puzzle es lo mismo que no jugar.
  ctx.fillStyle = "#101628";
  ctx.fillRect(x0 - 5, y0 - 5, lado * n.ancho + 10, lado * n.alto + 10);
  // La mesa: una textura CASI NEGRA por debajo de todo. Arriba van rayos de
  // colores saturados, y una textura con carácter propio les pelea el contraste
  // justo donde hay que leer por dónde pasa el rayo. Se recorta al tablero para
  // que el borde del tablero siga siendo un borde.
  if (arte.fondo_mesa) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 5, y0 - 5, lado * n.ancho + 10, lado * n.alto + 10);
    ctx.clip();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(arte.fondo_mesa, x0 - 5, y0 - 5, lado * n.ancho + 10, lado * n.alto + 10);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(255,255,255,.055)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= n.ancho; c++) { ctx.moveTo(x0 + c * lado, y0); ctx.lineTo(x0 + c * lado, y0 + n.alto * lado); }
  for (let f = 0; f <= n.alto; f++) { ctx.moveTo(x0, y0 + f * lado); ctx.lineTo(x0 + n.ancho * lado, y0 + f * lado); }
  ctx.stroke();

  dibujarRayos(ctx, p, lado, x0, y0, t);

  for (let f = 0; f < n.alto; f++)
    for (let c = 0; c < n.ancho; c++)
      dibujarCelda(ctx, p, c, f, lado, x0, y0, t, anim);
  dibujarChispas(ctx, lado, x0, y0, t);
}

// --- las chispas ---------------------------------------------------------
//
// SON POCAS Y DURAN POCO A PROPOSITO. Un puzzle no se mira como un juego de
// acción: la vista está quieta sobre el tablero, y cualquier cosa que se mueva
// mucho tiempo pasa de ser una celebración a ser una distracción justo cuando
// alguien está contando rebotes.
const CHISPAS = [];
export function chispear(c, f, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + Math.random();
    const v = 0.9 + Math.random() * 1.6;
    CHISPAS.push({ c, f, dx: Math.cos(a) * v, dy: Math.sin(a) * v, color,
                   nacida: performance.now(), vida: 320 + Math.random() * 260 });
  }
}

function dibujarChispas(ctx, lado, x0, y0, ahora) {
  for (let i = CHISPAS.length - 1; i >= 0; i--) {
    const ch = CHISPAS[i];
    const edad = (ahora - ch.nacida) / ch.vida;
    if (edad >= 1) { CHISPAS.splice(i, 1); continue; }
    const [x, y] = cen(ch.c, ch.f, lado, x0, y0);
    ctx.globalAlpha = (1 - edad) * 0.9;
    ctx.fillStyle = ch.color;
    const d = edad * lado * 0.9;
    ctx.fillRect(x + ch.dx * d - 1.6, y + ch.dy * d - 1.6, 3.2, 3.2);
  }
  ctx.globalAlpha = 1;
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

function dibujarCelda(ctx, p, c, f, lado, x0, y0, t, anim) {
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
  // EL ESPEJO GIRA, no salta. Los dos estados están exactamente a noventa
  // grados, así que la animación es la rotación de verdad y no un truco: en
  // ciento cuarenta milisegundos se ve DE DONDE a DONDE fue, que es justo lo que
  // hay que entender para saber si el toque sirvió. Saltando, en un tablero con
  // once espejos, ni se nota cuál se movió.
  let giro = 0;
  if (movible && anim && anim.c === c && anim.f === f && !anim.pista) {
    const k = Math.min(1, (performance.now() - anim.t) / 140);
    // Arranca rápido y frena: `1-(1-k)^3`. Lineal se ve como una pieza empujada
    // por una máquina; con freno se ve como algo que se soltó.
    const suave = 1 - Math.pow(1 - k, 3);
    giro = (1 - suave) * (Math.PI / 2) * (vuelco === 0 ? 1 : -1);
  }
  if (movible) {
    ctx.fillStyle = "rgba(90,216,255,.07)";
    ctx.strokeStyle = "rgba(90,216,255,.30)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x - lado * 0.44, y - lado * 0.44, lado * 0.88, lado * 0.88, 8);
    ctx.fill(); ctx.stroke();
  }
  const d = lado * 0.34;
  ctx.save();
  ctx.translate(x, y);
  if (giro) ctx.rotate(giro);
  const [ax, ay, bx, by] = vuelco === 0 ? [-d, d, d, -d] : [-d, -d, d, d];
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
  ctx.restore();
  if (!movible) {
    ctx.fillStyle = "#3f4763";
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
  }
}

/** El barrido de la victoria: una banda de luz que cruza el tablero una vez. */
export function barrido(ctx, nivel, edad) {
  const { lado, x0, y0 } = medidas(nivel);
  const an = lado * nivel.ancho, al = lado * nivel.alto;
  const y = y0 - 40 + edad * (al + 80);
  const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
  g.addColorStop(0, "rgba(182,240,255,0)");
  g.addColorStop(0.5, `rgba(182,240,255,${0.5 * (1 - edad)})`);
  g.addColorStop(1, "rgba(182,240,255,0)");
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - 5, y0 - 5, an + 10, al + 10); ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 5, y - 60, an + 10, 120);
  ctx.restore();
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
