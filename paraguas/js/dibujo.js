// Pintar el pozo. Todo vectorial menos el personaje y el paraguas.

import { VISTA, F, mezcla } from "./mundo.js";
import { TIPOS, dureza } from "./pozo.js";
import { dibujarHeroe } from "./heroe.js";

const ANCHO = 360, BORDE = 10, GRUESO = 14;

// LOS TRAMOS DEL POZO. Cada doscientos cincuenta metros cambia el color, y no
// es decoracion: en un juego sin final, lo unico que le dice al jugador que
// avanzo es que el lugar cambio. Un numero subiendo no alcanza.
const TRAMOS = [
  { nombre: "El garaje", cielo: ["#161c2b", "#242e46"], pared: "#3a4667" },
  { nombre: "Las cañerías", cielo: ["#0f2020", "#1d3a38"], pared: "#2f5c58" },
  { nombre: "La fábrica", cielo: ["#2a1020", "#4a1f38"], pared: "#75304f" },
  { nombre: "El vacío", cielo: ["#080c1c", "#141d3d"], pared: "#243055" },
  { nombre: "La panza", cielo: ["#2b1a10", "#54331f"], pared: "#7a4c2c" },
  { nombre: "El basural", cielo: ["#1c1c12", "#41412a"], pared: "#5e5e36" },
  { nombre: "La heladera", cielo: ["#0d2530", "#1b4a5c"], pared: "#2c7086" },
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

export function dibujar(ctx, p) {
  const cam = p.cam;
  const t = (((cam % LARGO_TRAMO) + LARGO_TRAMO) % LARGO_TRAMO) / LARGO_TRAMO;
  const a = tramoDe(cam), b = tramoDe(cam + LARGO_TRAMO);
  // El cruce se hace en el ultimo 12% del tramo: de golpe se ve como un corte.
  const m = t > 0.88 ? (t - 0.88) / 0.12 : 0;
  const c0 = mezclarColor(a.cielo[0], b.cielo[0], m);
  const c1 = mezclarColor(a.cielo[1], b.cielo[1], m);
  const pared = mezclarColor(a.pared, b.pared, m);

  const g = ctx.createLinearGradient(0, 0, 0, VISTA.alto);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VISTA.ancho, VISTA.alto);

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

function paredes(ctx, cam, color) {
  const y0 = cam - 40, y1 = cam + VISTA.alto + 40;
  ctx.fillStyle = color;
  ctx.fillRect(-40, y0, BORDE + 40, y1 - y0);
  ctx.fillRect(ANCHO - BORDE, y0, BORDE + 40, y1 - y0);
  const tex = texturas.pared;
  if (tex) {
    ctx.save(); ctx.globalAlpha = 0.45;
    const pat = ctx.createPattern(tex, "repeat");
    ctx.fillStyle = pat;
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
      ctx.translate(a, y); ctx.fillStyle = ctx.createPattern(texturas.repisa, "repeat");
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
