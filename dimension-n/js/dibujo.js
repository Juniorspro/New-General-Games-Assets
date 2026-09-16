// Pintar el mundo. Todo vectorial: no hay una sola imagen en el juego.

import { VISTA } from "./juego.js";
import { paredEn, capituloEn, ANCHO } from "./nivel.js";
import { dibujarCuerpo } from "./cuerpo.js";

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
  ctx.strokeStyle = "#c98f4a"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  // La panza: cuanto menos estirada, mas cuelga. Una linea recta entre dos
  // manos no es una soga, es una barra.
  ctx.quadraticCurveTo(mx, my + Math.max(0, p.mano.largo - d) * 0.8 + 3, b.x, b.y);
  ctx.stroke();

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

  for (const lado of ["izq", "der"]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(lado === "izq" ? -20 : ANCHO + 20, y0);
    for (const m of mues) ctx.lineTo(m[lado], m.y);
    ctx.lineTo(lado === "izq" ? -20 : ANCHO + 20, y1);
    ctx.closePath(); ctx.fill();
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
