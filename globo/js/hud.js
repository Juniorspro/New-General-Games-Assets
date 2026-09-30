// Lo que se lee jugando, dibujado en el lienzo: arriba la barra del nivel (con
// un globito que avanza) o la altura en el infinito, y las monedas; abajo, al
// empezar el primer nivel, cómo se juega. `u` es un píxel de CSS en píxeles
// del lienzo (la densidad de la pantalla). La pausa es un botón de HTML.
import { dibujarGlobo, cajaRedonda, estrella } from './dibujo.js';

export function dibujarHud(g, W, H, { p, u, tr, monedas, pielGlobo, consejo, t, record }) {
  const tema = p.tema(), arriba = 14 * u, fuente = (px, peso = 900) => `${peso} ${Math.round(px * u)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  g.textBaseline = 'middle';
  if (!p.infinito) {
    const w = Math.min(W - 150 * u, 300 * u), x = (W - w) / 2, y = arriba + 20 * u, h = 12 * u;
    g.font = fuente(13, 800); g.textAlign = 'center';
    sombreado(g, tr('nivel', p.nivel + 1), W / 2, arriba + 4 * u, '#ffffff', tema.tinta);
    g.fillStyle = 'rgba(0,0,0,0.22)'; cajaRedonda(g, x, y + 2 * u, w, h, h / 2); g.fill();
    g.fillStyle = '#ffffff'; cajaRedonda(g, x, y, w, h, h / 2); g.fill();
    const k = p.progreso();
    if (k > 0) { g.fillStyle = tema.meta; cajaRedonda(g, x + 2 * u, y + 2 * u, Math.max(h - 4 * u, (w - 4 * u) * k), h - 4 * u, (h - 4 * u) / 2); g.fill(); }
    // la bandera de la meta en la punta y el globito que avanza
    g.fillStyle = tema.tinta; g.fillRect(x + w + 4 * u, y - 8 * u, 2 * u, h + 10 * u);
    g.fillStyle = tema.meta; g.beginPath(); g.moveTo(x + w + 6 * u, y - 8 * u); g.lineTo(x + w + 16 * u, y - 4 * u); g.lineTo(x + w + 6 * u, y); g.closePath(); g.fill();
    dibujarGlobo(g, x + (w - 4 * u) * k + 2 * u, y - 2 * u, 7 * u, pielGlobo, t, { hilo: 6 * u });
  } else {
    g.font = fuente(30); g.textAlign = 'center';
    sombreado(g, tr('metros', Math.floor(p.altura() / 10)), W / 2, arriba + 18 * u, '#ffffff', tema.tinta);
    if (record > 0) { g.font = fuente(12, 800); sombreado(g, tr('record', record), W / 2, arriba + 42 * u, '#ffffff', tema.tinta); }
  }
  // las monedas, arriba a la derecha
  const mx = W - 16 * u, my = arriba + 16 * u;
  g.font = fuente(18); g.textAlign = 'right';
  sombreado(g, String(monedas), mx - 22 * u, my + 1 * u, '#ffffff', tema.tinta);
  g.fillStyle = '#e0a800'; g.beginPath(); g.arc(mx - 9 * u, my + 1.5 * u, 9 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(mx - 9 * u, my, 9 * u, 0, Math.PI * 2); g.fill();
  estrella(g, mx - 9 * u, my, 4.5 * u, '#f0b400');
  // cómo se juega: una mano que arrastra, abajo, los primeros segundos
  if (consejo) {
    const a = consejo.alfa, y = H - 70 * u;
    g.globalAlpha = a;
    g.font = fuente(15, 800); g.textAlign = 'center';
    sombreado(g, consejo.texto, W / 2, y, '#ffffff', tema.tinta);
    const dx = Math.sin(t * 3) * 40 * u;
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(W / 2 + dx, y + 32 * u, 10 * u, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3 * u; g.lineCap = 'round';
    g.beginPath(); g.moveTo(W / 2 - 40 * u, y + 32 * u); g.lineTo(W / 2 + 40 * u, y + 32 * u); g.stroke();
    g.lineCap = 'butt';
    g.globalAlpha = 1;
  }
}

// un texto con su sombra plana abajo (se lee arriba de cualquier cielo)
export function sombreado(g, txt, x, y, color, sombra) {
  g.fillStyle = sombra; g.globalAlpha *= 0.55; g.fillText(txt, x, y + 2);
  g.globalAlpha /= 0.55; g.fillStyle = color; g.fillText(txt, x, y);
}
