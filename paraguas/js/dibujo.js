// Pintar el pozo. Todo vectorial menos el personaje y el paraguas.

import { VISTA, F, mezcla } from "./mundo.js";
import { TIPOS, dureza } from "./pozo.js";
import { dibujarHeroe } from "./heroe.js";

const ANCHO = 360, BORDE = 10, GRUESO = 14;

// LOS TRAMOS DEL POZO. Cada doscientos cincuenta metros cambia el color, y no
// es decoracion: en un juego sin final, lo unico que le dice al jugador que
// avanzo es que el lugar cambio. Un numero subiendo no alcanza.
// El `nombre` en castellano queda como respaldo: si el módulo de idiomas no
// carga, el HUD dice algo en vez de quedar vacío. Lo que se muestra es `clave`
// pasado por la tabla.
const TRAMOS = [
  { nombre: "El garaje", clave: "tramo.garaje", cielo: ["#161c2b", "#242e46"], pared: "#3a4667" },
  { nombre: "Las cañerías", clave: "tramo.canerias", cielo: ["#0f2020", "#1d3a38"], pared: "#2f5c58" },
  { nombre: "La fábrica", clave: "tramo.fabrica", cielo: ["#2a1020", "#4a1f38"], pared: "#75304f" },
  { nombre: "El vacío", clave: "tramo.vacio", cielo: ["#080c1c", "#141d3d"], pared: "#243055" },
  { nombre: "La panza", clave: "tramo.panza", cielo: ["#2b1a10", "#54331f"], pared: "#7a4c2c" },
  { nombre: "El basural", clave: "tramo.basural", cielo: ["#1c1c12", "#41412a"], pared: "#5e5e36" },
  { nombre: "La heladera", clave: "tramo.heladera", cielo: ["#0d2530", "#1b4a5c"], pared: "#2c7086" },
];
const LARGO_TRAMO = 25000;                 // 250 metros

// El módulo TIENE que ser positivo. La cámara arranca por encima del cero —mira
// más abajo que el jugador, así que al principio está en negativo— y en
// JavaScript `-1 % 7` es -1, no 6: el primer cuadro del juego pedía el tramo
// número menos uno y se dibujaba sobre undefined.
export const tramoDe = (y) =>
  TRAMOS[((Math.floor(y / LARGO_TRAMO) % TRAMOS.length) + TRAMOS.length) % TRAMOS.length];

const mezclarColor = (a, b, t) => {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return `rgb(${Math.round(mezcla(r1, r2, t))},${Math.round(mezcla(g1, g2, t))},${Math.round(mezcla(b1, b2, t))})`;
};

// El polvo del fondo: quinientos numeros que no cambian nunca.
const frac = (x) => x - Math.floor(x);
const POLVO = [];
for (let i = 0; i < 420; i++)
  POLVO.push({ x: frac(Math.sin(i * 12.9898) * 43758.5453) * ANCHO,
               y: frac(Math.sin(i * 78.233) * 43758.5453) * 4000,
               r: 0.5 + frac(Math.sin(i * 3.123) * 17231.1) * 1.5 });

let texturas = {};
export function registrarTexturas(t) { texturas = t || {}; }

/**
 * La pared del fondo, a media velocidad y teñida con el color del tramo.
 *
 * SE REPITE ESPEJADA, dando vuelta una copia sí y una no. Pedirle a un
 * generador una textura que empalme consigo misma no funciona —siempre se ve la
 * costura— y arreglarla a mano cuesta una tarde. Espejada, la costura es la
 * imagen contra sí misma: coincide por construcción, y en una pared de caños y
 * remaches nadie nota la simetría.
 *
 * Y SE TIÑE EN VEZ DE TENER UNA TEXTURA POR TRAMO. Siete imágenes son siete
 * veces el peso, y además se desincronizan con los colores del código apenas
 * alguien toca un tramo: así el fondo cambia de color solo, con el tramo.
 */
// ═══════════════════════════════════════════════════════════════════════════
// EL TINTE SE HORNEA UNA VEZ POR COLOR, NO SE APLICA POR CUADRO.
// ═══════════════════════════════════════════════════════════════════════════
// La version anterior dibujaba las baldosas del fondo y despues tapaba LA
// PANTALLA ENTERA con un `fillRect` en modo `color`. Ese modo no es un relleno:
// para cada pixel convierte el color de abajo a HSL, le cambia el matiz y lo
// vuelve a RGB. En un telefono con pantalla de 3x eso son 2,3 MILLONES de
// pixeles con esa cuenta, sesenta veces por segundo.
// Y se nota en la medicion: el dibujo pasaba de 0,26 ms con pixeles 1x a 16,2
// con 3x. Sesenta y dos veces mas caro cuando los pixeles son seis veces mas —
// o sea que no era "mas pixeles", era esto.
// Ahora el matiz se le aplica A LA TEXTURA, una sola vez por color, en un
// lienzo aparte que queda guardado. Dibujar la textura ya teñida cuesta lo
// mismo que dibujar la textura.
const TENIDAS = new Map();

function fondoTenido(im, color) {
  const clave = color;
  let c = TENIDAS.get(clave);
  if (c) return c;
  // LA CACHE TIENE TOPE. Los colores salen de mezclar dos tramos con un cruce
  // continuo, asi que si no se corta habria un lienzo nuevo por cada cuadro del
  // cruce y la memoria crece para siempre.
  if (TENIDAS.size > 24) TENIDAS.clear();
  c = document.createElement("canvas");
  c.width = im.width; c.height = im.height;
  const x = c.getContext("2d");
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = "color";
  x.globalAlpha = 0.75;
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  // `destination-in` devuelve el alfa original: sin esto el rectangulo del
  // tinte deja opaco lo que la textura tenia transparente.
  x.globalCompositeOperation = "destination-in";
  x.globalAlpha = 1;
  x.drawImage(im, 0, 0);
  TENIDAS.set(clave, c);
  return c;
}

function fondo(ctx, cam, color) {
  const im = texturas.fondo_pozo;
  if (!im) return;
  const tinta = fondoTenido(im, color);
  const alto = im.height, ancho = ANCHO;
  const ox = Math.round((VISTA.ancho - ANCHO) / 2);
  // A la mitad de la velocidad de la camara: la pared del fondo esta "lejos".
  const desp = cam * 0.5;
  const primera = Math.floor(desp / alto);
  ctx.save();
  ctx.globalAlpha = 0.42;
  for (let k = -1; k <= Math.ceil(VISTA.alto / alto); k++) {
    const i = primera + k;
    const y = i * alto - desp;
    if (y > VISTA.alto || y + alto < 0) continue;
    ctx.save();
    // El modulo tiene que ser positivo: arriba del cero la camara es negativa y
    // en JavaScript `-1 % 2` es -1, no 1.
    if (((i % 2) + 2) % 2 === 1) { ctx.translate(ox, y + alto); ctx.scale(1, -1); }
    else ctx.translate(ox, y);
    ctx.drawImage(tinta, 0, 0, ancho, alto);
    ctx.restore();
  }
  ctx.restore();
}

// El degrade del cielo se rehace SOLO cuando cambian sus dos colores. Durante
// el 88 % de cada tramo son los mismos dos, asi que casi siempre se reusa.
let CIELO = null, CIELO_C0 = "", CIELO_C1 = "";
function cielo(ctx, c0, c1) {
  if (CIELO && c0 === CIELO_C0 && c1 === CIELO_C1) return CIELO;
  CIELO = ctx.createLinearGradient(0, 0, 0, VISTA.alto);
  CIELO.addColorStop(0, c0); CIELO.addColorStop(1, c1);
  CIELO_C0 = c0; CIELO_C1 = c1;
  return CIELO;
}

export function dibujar(ctx, p) {
  const cam = p.cam;
  const t = (((cam % LARGO_TRAMO) + LARGO_TRAMO) % LARGO_TRAMO) / LARGO_TRAMO;
  const a = tramoDe(cam), b = tramoDe(cam + LARGO_TRAMO);
  // El cruce se hace en el ultimo 12% del tramo: de golpe se ve como un corte.
  const m = t > 0.88 ? (t - 0.88) / 0.12 : 0;
  const c0 = mezclarColor(a.cielo[0], b.cielo[0], m);
  const c1 = mezclarColor(a.cielo[1], b.cielo[1], m);
  const pared = mezclarColor(a.pared, b.pared, m);

  ctx.fillStyle = cielo(ctx, c0, c1);
  ctx.fillRect(0, 0, VISTA.ancho, VISTA.alto);

  fondo(ctx, cam, pared);

  // El polvo a un tercio de velocidad: es lo unico que da profundidad en un
  // pozo donde todo lo demas esta a la misma distancia.
  ctx.fillStyle = "rgba(255,255,255,.13)";
  for (const d of POLVO) {
    const y = ((d.y - cam * 0.32) % 4000 + 4000) % 4000;
    if (y > VISTA.alto + 4) continue;
    ctx.beginPath(); ctx.arc(d.x, y, d.r, 0, 7); ctx.fill();
  }

  ctx.save();
  if (p.sacude > 0.4)
    ctx.translate((Math.random() - 0.5) * p.sacude, (Math.random() - 0.5) * p.sacude);
  const ox = Math.round((VISTA.ancho - ANCHO) / 2);
  ctx.translate(ox, -cam);

  paredes(ctx, cam, pared);
  for (const f of p.pozo.filas) {
    if (f.y < cam - 40 || f.y > cam + VISTA.alto + 40) continue;
    viga(ctx, f, pared, p.t);
  }
  for (const mo of p.pozo.monedas) {
    if (mo.tomada || mo.y < cam - 20 || mo.y > cam + VISTA.alto + 20) continue;
    moneda(ctx, mo, p.t);
  }

  // LAS RAYAS DE VELOCIDAD. Es el aviso mas importante que da la pantalla: a
  // trece pixeles por cuadro el fondo se mueve tan rapido que ya no se percibe
  // como movimiento, y sin las rayas el jugador no siente que esta cayendo mas
  // rapido — siente que el pozo empezo a aparecer mas rapido.
  const veloz = Math.max(0, (p.vy - F.TERMINAL_ABIERTO) / (F.TERMINAL_CERRADO - F.TERMINAL_ABIERTO));
  if (veloz > 0.05) {
    ctx.strokeStyle = `rgba(255,255,255,${0.05 + veloz * 0.22})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const rx = frac(Math.sin((i + Math.floor(p.t / 3) * 0.37) * 91.7) * 7331) * ANCHO;
      const ry = cam + frac(Math.sin((i * 3.7 + Math.floor(p.t / 3) * 0.91)) * 4331) * VISTA.alto;
      const largo = 20 + veloz * 90;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry + largo); ctx.stroke();
    }
  }

  // EL FOGONAZO DEL PARAGUAS: un anillo que se abre cuando el paraguas termina
  // de cambiar de estado. El cambio dura nueve cuadros y es gradual, así que sin
  // esto no hay ningún momento en que se vea "listo, ya está cerrado" — y ese
  // momento es el que hay que sincronizar con el hueco.
  if (p.golpeParaguas > 0) {
    const k = p.golpeParaguas / 12;
    ctx.globalAlpha = k * 0.55;
    ctx.strokeStyle = p.objetivo ? "#8fe3f5" : "#97ce4c";
    ctx.lineWidth = 2 + k * 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, (1 - k) * 46 + 10, ((1 - k) * 46 + 10) * 0.45, 0, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  dibujarHeroe(ctx, p.heroe, p.x, p.y, p.abierto, p.anchoParaguas, p.invul);

  for (const c of p.chispas) {
    ctx.globalAlpha = Math.min(1, c.vida / 14);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - 1.6, c.y - 1.6, 3.2, 3.2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (p.estado === "muerto") {
    ctx.fillStyle = "rgba(20,6,10,.42)";
    ctx.fillRect(0, 0, VISTA.ancho, VISTA.alto);
  }
}

// UN PATRON POR TEXTURA Y NO UNO POR CUADRO. `createPattern` no es gratis: hay
// que volver a preparar la imagen para que se pueda repetir. Estaba llamandose
// una vez por cuadro para la pared y UNA VEZ POR VIGA VISIBLE para las repisas,
// o sea entre cinco y diez veces por cuadro. El patron no depende de nada que
// cambie, asi que se hace una vez y queda.
const PATRONES = new Map();
function patron(ctx, clave, im) {
  let p = PATRONES.get(clave);
  if (!p) { p = ctx.createPattern(im, "repeat"); PATRONES.set(clave, p); }
  return p;
}

function paredes(ctx, cam, color) {
  const y0 = cam - 40, y1 = cam + VISTA.alto + 40;
  ctx.fillStyle = color;
  ctx.fillRect(-40, y0, BORDE + 40, y1 - y0);
  ctx.fillRect(ANCHO - BORDE, y0, BORDE + 40, y1 - y0);
  const tex = texturas.pared;
  if (tex) {
    ctx.save(); ctx.globalAlpha = 0.45;
    ctx.fillStyle = patron(ctx, "pared", tex);
    ctx.fillRect(-40, y0, BORDE + 40, y1 - y0);
    ctx.fillRect(ANCHO - BORDE, y0, BORDE + 40, y1 - y0);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.fillRect(BORDE - 2, y0, 2, y1 - y0);
  ctx.fillRect(ANCHO - BORDE, y0, 2, y1 - y0);
  // Las costillas: sin algo repetido y regular en la pared, caer rapido y caer
  // despacio se ven igual.
  ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = 3;
  for (let y = Math.floor(y0 / 80) * 80; y < y1; y += 80) {
    ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(BORDE + 4, y + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ANCHO + 6, y); ctx.lineTo(ANCHO - BORDE - 4, y + 5); ctx.stroke();
  }
}

function viga(ctx, f, color, t) {
  const y = f.y - GRUESO / 2;
  const x0 = f.x - f.hueco / 2, x1 = f.x + f.hueco / 2;
  const partes = [[BORDE, x0], [x1, ANCHO - BORDE]];
  for (const [a, b] of partes) {
    if (b - a < 1) continue;
    ctx.fillStyle = f.tipo === TIPOS.PINCHOS ? "#4a2028" : "#2b3348";
    ctx.fillRect(a, y, b - a, GRUESO);
    if (texturas.repisa) {
      ctx.save(); ctx.beginPath(); ctx.rect(a, y, b - a, GRUESO); ctx.clip();
      ctx.translate(a, y); ctx.fillStyle = patron(ctx, "repisa", texturas.repisa);
      ctx.fillRect(0, 0, b - a, GRUESO); ctx.restore();
    }
    ctx.fillStyle = "rgba(255,255,255,.16)";
    ctx.fillRect(a, y, b - a, 2);
    if (f.tipo === TIPOS.PINCHOS) {
      ctx.fillStyle = "#ff6b6b";
      const n = Math.max(1, Math.round((b - a) / 11));
      for (let i = 0; i < n; i++) {
        const cx = a + (i + 0.5) * ((b - a) / n);
        ctx.beginPath();
        ctx.moveTo(cx - (b - a) / n / 2, y); ctx.lineTo(cx, y - 9);
        ctx.lineTo(cx + (b - a) / n / 2, y); ctx.closePath(); ctx.fill();
      }
    }
  }
  // Los bordes del hueco, marcados: es lo unico que hay que mirar.
  const col = f.angosto ? "#ff9b3a" : "#8fe3f5";
  ctx.fillStyle = col;
  ctx.fillRect(x0 - 3, y, 3, GRUESO);
  ctx.fillRect(x1, y, 3, GRUESO);
  if (f.angosto) {
    // La fila angosta avisa con dos flechas: hay que cerrar el paraguas, y
    // enterarse al llegar es enterarse tarde.
    ctx.globalAlpha = 0.55 + Math.sin(t / 9) * 0.25;
    ctx.fillStyle = col;
    for (const [sx, dir] of [[x0 - 12, 1], [x1 + 12, -1]]) {
      ctx.beginPath();
      ctx.moveTo(sx, y - 12); ctx.lineTo(sx + dir * 7, y - 6); ctx.lineTo(sx, y);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function moneda(ctx, m, t) {
  const r = 5 + Math.sin(t / 10 + m.y * 0.05) * 0.6;
  ctx.fillStyle = "rgba(255,225,74,.28)";
  ctx.beginPath(); ctx.arc(m.x, m.y, r * 2.1, 0, 7); ctx.fill();
  // AMARILLO Y NO VERDE. El paraguas pasó a ser verde ácido, y dos verdes
  // distintos a veinte metros de distancia se leen como el mismo color: la
  // chatarra desaparecía contra el propio personaje.
  ctx.fillStyle = "#ffe14a";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t / 40;
    ctx.lineTo(m.x + Math.cos(a) * (i % 2 ? r * 0.45 : r), m.y + Math.sin(a) * (i % 2 ? r * 0.45 : r));
  }
  ctx.closePath(); ctx.fill();
}
