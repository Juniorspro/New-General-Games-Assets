// Pintar el mundo. Todo vectorial: no hay una sola imagen en el juego.

import { VISTA } from "./juego.js";
import { paredEn, capituloEn, ANCHO } from "./nivel.js";
import { dibujarCuerpo } from "./cuerpo.js";
import { T, COLS, FILAS, ANCHO_P, ALTO_P } from "./portales.js";

// Las texturas del mundo. Se registran una vez desde main.js y se guardan ya
// convertidas en patron: crear un CanvasPattern es caro y hacerlo por cuadro
// —que era lo obvio— tira a la basura todo lo que se gano usando una textura.
let TEX = {};
let PAT = {};
export function registrarTexturas(t) {
  TEX = t || {};
  PAT = {};
}
function patron(ctx, clave) {
  if (PAT[clave] !== undefined) return PAT[clave];
  PAT[clave] = TEX[clave] ? ctx.createPattern(TEX[clave], "repeat") : null;
  return PAT[clave];
}

const mezclar = (a, b, t) => {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const r = Math.round(r1 + (r2 - r1) * t), g = Math.round(g1 + (g2 - g1) * t), bb = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bb})`;
};

// El polvo del fondo. Se calcula una vez: son quinientos numeros que no
// cambian nunca y recalcularlos cada cuadro es regalar tiempo.
// La parte decimal, bien: `x % 1` en JavaScript devuelve NEGATIVO cuando x lo
// es, y de ahi salia un radio de -1 que hacia tirar excepcion a arc() sesenta
// veces por segundo. La consola del navegador lo cazo, la prueba lo mira.
const frac = (x) => x - Math.floor(x);
const POLVO = [];
for (let i = 0; i < 500; i++) {
  const a = frac(Math.sin(i * 12.9898) * 43758.5453);
  const b = frac(Math.sin(i * 78.233) * 43758.5453);
  const c = frac(Math.sin(i * 3.1234) * 17231.1);
  POLVO.push({ x: a * ANCHO, y: b * 13000, r: 0.6 + c * 1.6 });
}

export function dibujar(ctx, p) {
  const cam = p.cam;
  const nv = p.nv;
  const capA = capituloEn(nv, cam + VISTA.alto * 0.4);
  // El cruce entre capitulos se hace en los ultimos 260 px: si no, el fondo
  // cambia de color de golpe en un cuadro y parece un corte de edicion.
  const sig = nv.caps[capA.i + 1] || capA;
  const t = Math.max(0, Math.min(1, (cam + VISTA.alto * 0.4 - (capA.hasta - 260)) / 260));
  const c0 = mezclar(capA.cielo[0], sig.cielo[0], t);
  const c1 = mezclar(capA.cielo[1], sig.cielo[1], t);
  const paredColor = mezclar(capA.pared, sig.pared, t);

  const g = ctx.createLinearGradient(0, 0, 0, VISTA.alto);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VISTA.ancho, VISTA.alto);

  // El polvo, a un tercio de velocidad: es lo unico que da sensacion de
  // profundidad en un pozo donde todo lo demas esta a la misma distancia.
  ctx.fillStyle = "rgba(255,255,255,.14)";
  for (const d of POLVO) {
    const y = d.y - cam * 0.34;
    const yy = ((y % 13000) + 13000) % 13000;
    if (yy < -10 || yy > VISTA.alto + 10) continue;
    ctx.beginPath(); ctx.arc(d.x, yy, d.r, 0, 7); ctx.fill();
  }

  ctx.save();
  if (p.sacude > 0.3)
    ctx.translate((Math.random() - 0.5) * p.sacude, (Math.random() - 0.5) * p.sacude);
  ctx.translate(0, -cam);

  paredes(ctx, p, cam, paredColor);
  for (const o of nv.obst) {
    if (o.y - cam < -120 || o.y - cam > VISTA.alto + 120) continue;
    obstaculo(ctx, o, p.t);
  }
  for (const ch of nv.chatarra) {
    if (ch.tomada || ch.y - cam < -30 || ch.y - cam > VISTA.alto + 30) continue;
    chatarra(ctx, ch, p.t);
  }
  for (const po of nv.portales) {
    if (po.y - cam < -80 || po.y - cam > VISTA.alto + 80) continue;
    portal(ctx, po, p.t);
  }
  // La soga, antes que los cuerpos, para que salga por atras de las manos.
  // Se dibuja de mano a mano —que es lo que se entiende— aunque la
  // restriccion que aguanta el peso vaya de pecho a pecho.
  const a = p.mano.a, b = p.mano.b;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  // La panza: cuanto menos estirada, mas cuelga. Una linea recta entre dos
  // manos no es una soga, es una barra.
  const cy = my + Math.max(0, p.mano.largo - d) * 0.8 + 3;
  const enCurva = (t) => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y,
  });
  if (TEX.soga) {
    // LA SOGA SE DIBUJA EN OCHO TRAMOS, no de un saque. Una imagen no se puede
    // curvar con drawImage: estirada de punta a punta queda una tira recta que
    // no sigue la panza. Ocho pedacitos rectos sobre la curva se ven curvos, y
    // ocho drawImage no le hacen ni cosquillas a un cuadro.
    const N = 8, gr = 4;
    const anchoTex = TEX.soga.width / N;
    let ant = enCurva(0);
    for (let i = 1; i <= N; i++) {
      const pt = enCurva(i / N);
      const dx = pt.x - ant.x, dy = pt.y - ant.y;
      const l = Math.hypot(dx, dy) || 1;
      ctx.save();
      ctx.translate(ant.x, ant.y);
      ctx.rotate(Math.atan2(dy, dx));
      // CADA TRAMO DIBUJA SU PROPIO PEDAZO DE LA TEXTURA, no la textura entera.
      // Dibujando la imagen completa en cada tramo, el trenzado aparecía ocho
      // veces a lo largo de una soga de sesenta píxeles: quedaba una tira
      // rayada, no una soga. Así el dibujo del trenzado recorre la soga una
      // sola vez y conserva su proporción.
      // +1 de largo: sin el solape se ve una rayita de fondo entre tramo y tramo.
      ctx.drawImage(TEX.soga, (i - 1) * anchoTex, 0, anchoTex, TEX.soga.height,
                    0, -gr / 2, l + 1, gr);
      ctx.restore();
      ant = pt;
    }
  } else {
    ctx.strokeStyle = "#c98f4a"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx, cy, b.x, b.y);
    ctx.stroke();
  }

  dibujarCuerpo(ctx, p.tito);
  dibujarCuerpo(ctx, p.rilo);

  for (const ch of p.chispas) {
    ctx.globalAlpha = Math.min(1, ch.vida / 14);
    ctx.fillStyle = ch.color;
    ctx.fillRect(ch.x - 1.5, ch.y - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (p.estado === "roto") {
    ctx.fillStyle = "rgba(20,6,10,.5)";
    ctx.fillRect(0, 0, VISTA.ancho, VISTA.alto);
  }
}

function paredes(ctx, p, cam, color) {
  const nv = p.nv;
  const y0 = cam - 60, y1 = cam + VISTA.alto + 60;
  const mues = [];
  for (let y = y0; y <= y1; y += 50) mues.push({ y, ...paredEn(nv.perfil, y) });
  if (!mues.length) return;

  const tex = patron(ctx, "pared");
  for (const lado of ["izq", "der"]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(lado === "izq" ? -20 : ANCHO + 20, y0);
    for (const m of mues) ctx.lineTo(m[lado], m.y);
    ctx.lineTo(lado === "izq" ? -20 : ANCHO + 20, y1);
    ctx.closePath();
    ctx.fill();
    if (tex) {
      // La textura va ENCIMA del color plano y a media opacidad, no en lugar
      // de el. Sola, la misma imagen de chapa pinta los siete capitulos
      // iguales; arriba del color del capitulo, aporta el detalle y deja que
      // el color siga contando en que parte del pozo esta el jugador.
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = tex;
      ctx.fillRect(-40, y0, ANCHO + 80, y1 - y0);
      ctx.restore();
    }
    // El filo iluminado. Sin esto la pared y el fondo se leen como una sola
    // mancha y no se ve donde termina el pasillo.
    ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 2;
    ctx.beginPath();
    mues.forEach((m, i) => i ? ctx.lineTo(m[lado], m.y) : ctx.moveTo(m[lado], m.y));
    ctx.stroke();
  }
  // Las costillas del tunel: marcan que uno se mueve. Sin algo repetido y
  // regular en la pared, caer rapido y caer despacio se ven igual.
  ctx.strokeStyle = "rgba(0,0,0,.20)"; ctx.lineWidth = 3;
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    const w = paredEn(nv.perfil, y);
    ctx.beginPath();
    ctx.moveTo(w.izq - 16, y); ctx.lineTo(w.izq + 9, y + 4); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w.der + 16, y); ctx.lineTo(w.der - 9, y + 4); ctx.stroke();
  }
}

function obstaculo(ctx, o, t) {
  if (o.t === "aspa") {
    ctx.strokeStyle = "#ff7a59"; ctx.lineWidth = o.grosor * 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(o.ax ?? o.x, o.ay ?? o.y); ctx.lineTo(o.bx ?? o.x, o.by ?? o.y); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(o.ax ?? o.x, o.ay ?? o.y); ctx.lineTo(o.bx ?? o.x, o.by ?? o.y); ctx.stroke();
    ctx.fillStyle = "#3a2030";
    ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, 7); ctx.fill();
    return;
  }
  if (o.t === "gel") {
    const pulso = 1 + Math.sin(t / 26 + o.x) * 0.05;
    ctx.fillStyle = "rgba(120,220,150,.22)";
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r * pulso, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(160,255,190,.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r * pulso, 0, 7); ctx.stroke();
    return;
  }
  if (o.t === "pincho") {
    ctx.fillStyle = "#5a2530";
    ctx.fillRect(o.x, o.y + 6, o.an, o.al - 6);
    ctx.fillStyle = "#ff6b6b";
    const n = Math.max(1, Math.round(o.an / 11));
    for (let i = 0; i < n; i++) {
      const x = o.x + (i + 0.5) * (o.an / n);
      ctx.beginPath();
      ctx.moveTo(x - o.an / n / 2, o.y + 8); ctx.lineTo(x, o.y - 5);
      ctx.lineTo(x + o.an / n / 2, o.y + 8); ctx.closePath(); ctx.fill();
    }
    return;
  }
  if (o.t === "resorte") {
    ctx.fillStyle = "#1f3a2c"; ctx.fillRect(o.x, o.y + 7, o.an, o.al - 7);
    ctx.strokeStyle = "#7dffb0"; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = o.x; x <= o.x + o.an; x += 8)
      ctx.lineTo(x, o.y + 4 + (Math.floor(x / 8) % 2 ? 5 : 0));
    ctx.stroke();
    return;
  }
  ctx.fillStyle = "#2b3348"; ctx.fillRect(o.x, o.y, o.an, o.al);
  const tex = patron(ctx, "repisa");
  if (tex) {
    // El patron se ancla en el origen del lienzo, no en la repisa, asi que se
    // traslada a mano: sin esto la textura se "desliza" por debajo de cada
    // repisa segun donde este, y dos repisas iguales se ven distintas.
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = tex;
    ctx.fillRect(0, 0, o.an, o.al);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(o.x, o.y, o.an, 3);
}

function chatarra(ctx, ch, t) {
  const b = Math.sin(t / 14 + ch.x) * 2;
  ctx.save(); ctx.translate(ch.x, ch.y + b); ctx.rotate(t / 40);
  // El halo primero: una chatarra del tamano de la fisica se pierde contra el
  // fondo y el jugador no la ve hasta que ya paso de largo.
  ctx.fillStyle = "rgba(125,255,176,.18)";
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill();
  ctx.fillStyle = "#7dffb0";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * (i % 2 ? 4 : 9), Math.sin(a) * (i % 2 ? 4 : 9));
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
}

function portal(ctx, po, t) {
  const r = po.r + Math.sin(t / 18) * 2;
  ctx.save(); ctx.translate(po.x, po.y);
  // El agujero: un ovalo aplastado, porque se lo mira desde arriba al caer.
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
  g.addColorStop(0, po.usado ? "rgba(140,255,190,.9)" : "rgba(200,255,120,.95)");
  g.addColorStop(0.7, po.usado ? "rgba(60,160,110,.5)" : "rgba(90,200,70,.55)");
  g.addColorStop(1, "rgba(30,90,50,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.42, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = po.usado ? "rgba(180,255,210,.6)" : "rgba(220,255,150,.95)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.42, 0, 0, 7); ctx.stroke();
  // Las chispas del borde, girando.
  ctx.fillStyle = "rgba(230,255,180,.85)";
  for (let i = 0; i < 7; i++) {
    const a = t / 22 + (i / 7) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.42, 1.8, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ───────────── el modo portales ─────────────
//
// Pantalla fija: el nivel entero mide 352x544 y se centra en la vista. No hay
// cámara que seguir porque no hay nada fuera de la pantalla — es la mitad de
// lo que hace que sea un puzzle y no un juego de reflejos: todo lo que
// necesitás para resolverlo lo estás viendo.


const COLOR_PORTAL = ["#5ad2ff", "#ff9b3a"];

/**
 * Dónde arranca el escenario dentro de la vista.
 *
 * Lo necesita también la entrada: un toque llega en coordenadas de pantalla y
 * el disparo se hace en coordenadas del escenario. Sale de acá y no se
 * recalcula allá, porque dos fórmulas iguales escritas en dos archivos son dos
 * fórmulas que en algún momento dejan de ser iguales.
 */
export const origenEscenario = () => ({
  x: Math.round((VISTA.ancho - ANCHO_P) / 2),
  y: Math.round((VISTA.alto - ALTO_P) / 2),
});

export function dibujarEscenario(ctx, esc) {
  const { x: ox, y: oy } = origenEscenario();

  const g = ctx.createLinearGradient(0, 0, 0, VISTA.alto);
  g.addColorStop(0, "#141a2a"); g.addColorStop(1, "#0b0e18");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VISTA.ancho, VISTA.alto);

  ctx.save();
  if (esc.sacude > 0.3)
    ctx.translate((Math.random() - 0.5) * esc.sacude, (Math.random() - 0.5) * esc.sacude);
  ctx.translate(ox, oy);

  // El fondo de la sala, para que se vea dónde termina el nivel.
  ctx.fillStyle = "#1b2336";
  ctx.fillRect(0, 0, ANCHO_P, ALTO_P);

  const tex = patron(ctx, "pared");
  for (let y = 0; y < FILAS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = esc.rejilla[y][x];
      const px = x * T, py = y * T;
      if (c === "^") { pinchos(ctx, px, py); continue; }
      if (c === "~") { gel(ctx, px, py, esc.t); continue; }
      if (c === "=") { resorte(ctx, px, py); continue; }
      if (c === "d") { puertaAbierta(ctx, px, py); continue; }
      if (c !== "#" && c !== "X" && c !== "D") continue;
      // Un tile tapado por un portal es un agujero: no se dibuja.
      if (esc.portales.some((p) => p && p.celdas.some(([a, b]) => a === x && b === y))) continue;
      if (c === "D") { ctx.fillStyle = "#7a4b2c"; ctx.fillRect(px, py, T, T);
                       ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(px, py, T, 2); continue; }
      // LA PARED NEGRA SE VE DISTINTA A PROPÓSITO: es la única regla del juego
      // que no se puede deducir probando sin perder un tiro, así que tiene que
      // leerse de un vistazo.
      ctx.fillStyle = c === "X" ? "#11151f" : "#33405c";
      ctx.fillRect(px, py, T, T);
      if (c === "#" && tex) {
        ctx.save(); ctx.globalAlpha = 0.45; ctx.beginPath();
        ctx.rect(px, py, T, T); ctx.clip();
        ctx.fillStyle = tex; ctx.fillRect(px, py, T, T); ctx.restore();
      }
      ctx.fillStyle = c === "X" ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.16)";
      ctx.fillRect(px, py, T, 2);
      if (c === "X") {
        // La pared negra necesita un contorno o se lee como un agujero en vez
        // de como una pared, y es justo la que hay que reconocer de un vistazo:
        // es la única que rebota el disparo.
        ctx.strokeStyle = "rgba(120,140,180,.22)"; ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      }
    }
  }

  for (const b of esc.botones) placa(ctx, b);
  if (esc.salida) salida(ctx, esc.salida, esc.t);
  for (const c of esc.chatarra) if (!c.tomada) chatarra(ctx, c, esc.t);
  for (const p of esc.portales) if (p) portalBoca(ctx, p, esc.t);

  // La soga y los cuerpos, igual que en el pozo.
  const a = esc.mano.a, b = esc.mano.b;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  const cy = my + Math.max(0, esc.mano.largo - d) * 0.8 + 3;
  const enCurva = (t) => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y,
  });
  if (TEX.soga) {
    const N = 8, gr = 3, anchoTex = TEX.soga.width / N;
    let ant = enCurva(0);
    for (let i = 1; i <= N; i++) {
      const pt = enCurva(i / N);
      const dx = pt.x - ant.x, dy = pt.y - ant.y;
      const l = Math.hypot(dx, dy) || 1;
      ctx.save(); ctx.translate(ant.x, ant.y); ctx.rotate(Math.atan2(dy, dx));
      ctx.drawImage(TEX.soga, (i - 1) * anchoTex, 0, anchoTex, TEX.soga.height, 0, -gr / 2, l + 1, gr);
      ctx.restore();
      ant = pt;
    }
  } else {
    ctx.strokeStyle = "#c98f4a"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, cy, b.x, b.y); ctx.stroke();
  }
  dibujarCuerpo(ctx, esc.tito);
  dibujarCuerpo(ctx, esc.rilo);

  for (const c of esc.chispas) {
    ctx.globalAlpha = Math.min(1, c.vida / 14);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x - 1.3, c.y - 1.3, 2.6, 2.6);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (esc.estado === "roto") {
    ctx.fillStyle = "rgba(24,6,10,.45)";
    ctx.fillRect(0, 0, VISTA.ancho, VISTA.alto);
  }
}

function pinchos(ctx, px, py) {
  ctx.fillStyle = "#4a2028"; ctx.fillRect(px, py + T * 0.55, T, T * 0.45);
  ctx.fillStyle = "#ff6b6b";
  for (let i = 0; i < 2; i++) {
    const x = px + (i + 0.5) * (T / 2);
    ctx.beginPath();
    ctx.moveTo(x - T / 4, py + T * 0.6); ctx.lineTo(x, py + T * 0.08);
    ctx.lineTo(x + T / 4, py + T * 0.6); ctx.closePath(); ctx.fill();
  }
}

function gel(ctx, px, py, t) {
  ctx.fillStyle = "rgba(120,220,150,.20)"; ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "rgba(160,255,190,.35)";
  const r = 2 + Math.sin(t / 22 + px * 0.13 + py * 0.09) * 1.1;
  ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, r, 0, 7); ctx.fill();
}

function resorte(ctx, px, py) {
  ctx.fillStyle = "#1f3a2c"; ctx.fillRect(px, py + T * 0.5, T, T * 0.5);
  ctx.strokeStyle = "#7dffb0"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= T; x += 5) ctx.lineTo(px + x, py + T * 0.34 + (Math.floor(x / 5) % 2 ? 5 : 0));
  ctx.stroke();
}

function puertaAbierta(ctx, px, py) {
  ctx.strokeStyle = "rgba(200,140,90,.30)"; ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
}

function placa(ctx, b) {
  const y = b.y + (b.apretado ? 3 : 0);
  ctx.fillStyle = b.apretado ? "#7dffb0" : "#8fa0c0";
  ctx.fillRect(b.x - T * 0.7, y - 3, T * 1.4, 4);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(b.x - T * 0.5, y + 1, T, 3);
}

function salida(ctx, s, t) {
  const pulso = 1 + Math.sin(t / 16) * 0.08;
  ctx.save(); ctx.translate(s.x, s.y);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16 * pulso);
  g.addColorStop(0, "rgba(220,255,160,.95)");
  g.addColorStop(0.6, "rgba(120,220,90,.5)");
  g.addColorStop(1, "rgba(60,140,60,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 16 * pulso, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(220,255,150,.9)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.stroke();
  ctx.restore();
}

/**
 * La boca de un portal: un óvalo aplastado contra la pared.
 *
 * Se dibuja SOBRE la cara y girado con ella, así que el portal del techo se ve
 * como una elipse ancha y el de una pared lateral como una alta. Es la única
 * pista visual de por dónde se sale, y sin eso el jugador no sabe si va a
 * salir volando para arriba o para el costado.
 */
function portalBoca(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.ang + Math.PI / 2);
  const col = COLOR_PORTAL[p.color];
  const largo = T * 1.05, hondo = 5.5 + Math.sin(t / 14) * 0.7;
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, largo);
  g.addColorStop(0, "rgba(255,255,255,.95)");
  g.addColorStop(0.45, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, largo, hondo, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, largo, hondo, 0, 0, 7); ctx.stroke();
  ctx.restore();
}
