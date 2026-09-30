// Lo que se dibuja arriba del tablero mientras se juega: la etiqueta del
// nivel en una tira de papel roto, las tres estrellas (las que faltan son un
// hueco; la que se junta salta a su lugar), la nota de ayuda de los niveles
// que enseñan algo, el rastro blanco del dedo y el cartelito de "¡se cayó!".
import { papelRoto, cinta, estrellaDe, pegar } from './papel.js';
import { estrella, estrellaVacia } from './dibujo.js';
import { clamp, elastico } from './util.js';

// `hud`: { tomadas: [t de cada estrella o null] } (lo lleva main.js)
// `arriba`: dónde empieza lo usable (debajo de la muesca del teléfono), en píxeles del lienzo
export function dibujarHud(g, W, H, { p, u, t, hud, arriba = 10 * u, ayuda = null, aviso = null, nombreCaja = '' }) {
  // la etiqueta: "1-4" grande y la caja chiquita, en papel blanco roto con cinta
  const w = 118 * u, h = 44 * u, x = W / 2 - w / 2, y = arriba;
  g.save();
  g.fillStyle = 'rgba(40,20,5,0.25)'; papelRoto(g, x + 2 * u, y + 3 * u, w, h, 'rgba(40,20,5,0.25)', 3, { dientes: 12, hondo: 3 * u });
  papelRoto(g, x, y, w, h, '#fbf8f1', 3, { dientes: 12, hondo: 3 * u });
  cinta(g, x + w / 2, y + 1 * u, 34 * u, 11 * u, -0.05);
  g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${Math.round(19 * u)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.fillText(p.def.id, W / 2, y + h * 0.42);
  g.font = `700 ${Math.round(9.5 * u)}px system-ui, sans-serif`; g.fillStyle = '#7a6552';
  g.fillText(nombreCaja.toUpperCase(), W / 2, y + h * 0.78);
  g.restore();
  // las estrellas, arriba a la derecha
  const r = 15 * u;
  for (let i = 0; i < 3; i++) {
    const sx = W - (22 + (2 - i) * 34) * u - r * 0.3, sy = arriba + 22 * u;
    estrellaVacia(g, sx, sy, r * 0.9);
    const tt = hud.tomadas[i];
    if (tt !== null && tt !== undefined) {
      const k = clamp((t - tt) / 0.45, 0, 1), e = elastico(k);
      pegar(g, estrella(u * 1.05), sx, sy, { alto: 2 * u, esc: 0.3 + e * 0.7, ang: (1 - k) * 1.2 });
    }
  }
  // la nota de ayuda (papelito amarillo abajo, con cinta)
  if (ayuda && ayuda.alfa > 0.01) {
    g.save(); g.globalAlpha = ayuda.alfa;
    const fs = Math.round(15 * u);
    g.font = `700 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const lineas = partir(g, ayuda.texto, Math.min(W * 0.8, 300 * u));
    const aw = Math.max(...lineas.map((l) => g.measureText(l).width)) + 30 * u, ah = lineas.length * fs * 1.3 + 22 * u;
    const ax = W / 2, ay = H - ah / 2 - Math.max(22 * u, H * 0.05);
    g.translate(ax, ay + (1 - ayuda.alfa) * 20 * u); g.rotate(-0.025);
    g.fillStyle = 'rgba(40,20,5,0.25)'; g.fillRect(-aw / 2 + 3 * u, -ah / 2 + 4 * u, aw, ah);
    g.fillStyle = '#fbe57a'; g.fillRect(-aw / 2, -ah / 2, aw, ah);
    g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(-aw / 2, ah / 2 - 6 * u, aw, 6 * u);
    cinta(g, 0, -ah / 2, 44 * u, 13 * u, 0.04);
    g.fillStyle = '#3b2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lineas.forEach((l, k) => g.fillText(l, 0, -ah / 2 + 11 * u + fs * 1.3 * (k + 0.5)));
    g.restore();
  }
  // "¡se cayó!" / "¡se rompió!", en un papel rojo que se estampa
  if (aviso) {
    const k = clamp(aviso.t / 0.25, 0, 1), e = k < 1 ? 1.6 - 0.6 * k * k : 1;
    g.save(); g.translate(W / 2, H * 0.42); g.rotate(-0.06); g.scale(e, e); g.globalAlpha = clamp(aviso.t / 0.08, 0, 1);
    const fs = Math.round(30 * u);
    g.font = `900 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, "Arial Black", sans-serif`;
    const tw = g.measureText(aviso.texto).width + 36 * u;
    g.fillStyle = 'rgba(40,20,5,0.3)'; g.fillRect(-tw / 2 + 4 * u, -fs * 0.8 + 5 * u, tw, fs * 1.6);
    g.fillStyle = '#e04a3a'; g.fillRect(-tw / 2, -fs * 0.8, tw, fs * 1.6);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2 * u; g.setLineDash([6 * u, 4 * u]); g.strokeRect(-tw / 2 + 6 * u, -fs * 0.8 + 6 * u, tw - 12 * u, fs * 1.6 - 12 * u); g.setLineDash([]);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(aviso.texto, 0, fs * 0.05);
    g.restore();
  }
}

// El rastro del dedo: una estela blanca que se afina y se apaga (en píxeles del lienzo)
export function dibujarRastros(g, rastros, u) {
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const r of rastros) {
    for (let k = 1; k < r.length; k++) {
      const a = r[k - 1], b = r[k], vida = 1 - b.edad;
      if (vida <= 0) continue;
      g.strokeStyle = `rgba(60,40,90,${0.18 * vida})`; g.lineWidth = (5 + 5 * vida) * u;
      g.beginPath(); g.moveTo(a.x + 1.5 * u, a.y + 2.5 * u); g.lineTo(b.x + 1.5 * u, b.y + 2.5 * u); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${0.9 * vida})`; g.lineWidth = (2 + 4.5 * vida) * u;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }
    // una chispita en la punta
    const p = r[r.length - 1];
    if (p && p.edad < 0.5) { g.fillStyle = `rgba(255,255,255,${1 - p.edad * 2})`; estrellaDe(g, p.x, p.y, 6 * u * (1 - p.edad), 4, 0.35); }
  }
  g.restore();
}

// partir un texto en renglones que entren en `ancho`
function partir(g, texto, ancho) {
  const out = []; let linea = '';
  for (const pal of texto.split(' ')) {
    const prueba = linea ? linea + ' ' + pal : pal;
    if (g.measureText(prueba).width > ancho && linea) { out.push(linea); linea = pal; } else linea = prueba;
  }
  if (linea) out.push(linea);
  return out;
}
