/* brillo/js/tiles.js — el piso y las paredes, en baldosas de 16 píxeles.
   Cada baldosa se pinta píxel por píxel mirando a sus vecinas: si arriba no
   hay nada, lleva pasto (con el filo de brillo y el borde irregular); si al
   costado no hay nada, un borde más oscuro; las esquinas de afuera se
   redondean. La tierra se oscurece con la profundidad y tiene piedritas. El
   nivel entero se pinta una vez, en pedazos, y en cada cuadro solo se copian
   los que se ven. */
import { rgb, RAMPA, mezclar } from './pixel.js';

export const T = 16;
const h32 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/* los estilos de cada mundo: de qué rampas salen el pasto y el cuerpo */
export const ESTILOS = {
  colina: { tope: RAMPA.verde, cuerpo: RAMPA.tierra, piedras: true, hondo: 3 },
};

/* pinta el mapa en pedazos de 256x256. esSolido(tx, ty) dice qué es pared */
export function pintarNivel(anchoT, altoT, esSolido, estilo) {
  const E = ESTILOS[estilo] || ESTILOS.colina;
  const P = 256, piezas = new Map();
  const sol = (x, y) => (x < 0 || x >= anchoT ? esSolido(Math.max(0, Math.min(anchoT - 1, x)), y) : y < 0 ? false : y >= altoT ? true : esSolido(x, y));
  /* cuántas baldosas sólidas hay arriba (para oscurecer con la profundidad) */
  const hondura = (x, y) => { let k = 0; while (k < 6 && sol(x, y - k - 1)) k++; return k; };
  const tope = E.tope.map(rgb), cuerpo = E.cuerpo.map(rgb);
  for (let py = 0; py < Math.ceil(altoT * T / P); py++) for (let px = 0; px < Math.ceil(anchoT * T / P); px++) {
    const c = document.createElement('canvas'); c.width = P; c.height = P;
    const g = c.getContext('2d'), img = g.createImageData(P, P), d = img.data;
    let algo = false;
    const tx0 = px * P / T, ty0 = py * P / T;
    for (let ty = ty0; ty < ty0 + P / T; ty++) for (let tx = tx0; tx < tx0 + P / T; tx++) {
      if (tx >= anchoT || ty >= altoT || !sol(tx, ty)) continue;
      algo = true;
      const arr = !sol(tx, ty - 1), aba = !sol(tx, ty + 1), izq = !sol(tx - 1, ty), der = !sol(tx + 1, ty);
      const hd = hondura(tx, ty);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        /* esquinas redondas de afuera */
        const r = 4;
        const esq = (cx, cy) => { const dx = cx - x - 0.5, dy = cy - y - 0.5; return dx * dx + dy * dy > r * r; };
        if (arr && izq && x < r && y < r && esq(r, r)) continue;
        if (arr && der && x >= T - r && y < r && esq(T - r, r)) continue;
        if (aba && izq && x < r && y >= T - r && esq(r, T - r)) continue;
        if (aba && der && x >= T - r && y >= T - r && esq(T - r, T - r)) continue;
        const X = tx * T + x, Y = ty * T + y;
        let col;
        /* el pasto de arriba: grueso, con el filo de brillo, y el borde de abajo gotea en puntas */
        const gota = 7 + Math.floor(h32(X, 0, 3) * 2.5) + (h32(X >> 1, ty, 5) < 0.18 ? 3 : 0) - (h32(X >> 2, ty, 6) < 0.15 ? 2 : 0);
        if (arr && y < gota) {
          col = y === 0 ? tope[6] : y === 1 ? tope[6] : y === 2 ? tope[5] : y < gota - 3 ? tope[4] : y < gota - 1 ? tope[3] : tope[2];
          if (y === 0 && h32(X, Y, 9) < 0.35) col = tope[7];
          /* un brillo corto más abajo, como la luz en el pasto mojado */
          if (y === 4 && h32(X, Y, 11) < 0.12) col = tope[6];
          if (y < 2 && (izq && x < 2 || der && x > T - 3)) col = tope[5];
        } else {
          /* la tierra: un degradé con la profundidad hecho con puntillado (Bayer), piedritas claras y raíces */
          const prof = hd * T + y + (h32(X >> 3, ty, 4) - 0.5) * 6;
          const nivel = Math.max(0, Math.min(1, prof / 70));
          const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(Y & 3) * 4 + (X & 3)] / 16;
          const fi = 5.4 - nivel * 3.4;                       // de 5.4 (arriba) a 2 (hondo)
          let i = Math.floor(fi) + (fi - Math.floor(fi) > bayer ? 1 : 0);
          i = Math.max(1, Math.min(6, i));
          col = cuerpo[i];
          const n = h32(X, Y, 1);
          /* piedritas: de 2x2 con su brillo arriba */
          const pq = h32(X >> 1, Y >> 1, 12);
          if (E.piedras && pq < 0.018) col = (X & 1) === 0 && (Y & 1) === 0 ? cuerpo[Math.min(7, i + 3)] : cuerpo[Math.min(7, i + 1)];
          else if (n < 0.05) col = cuerpo[Math.max(0, i - 1)];
          /* raicitas cerca del pasto */
          if (arr && y > gota && y < gota + 5 && h32(X, ty, 13) < 0.08) col = cuerpo[Math.max(0, i - 2)];
          /* justo abajo del pasto, una sombrita */
          if (arr && y === gota) col = cuerpo[Math.max(0, i - 2)];
          if (izq && x === 0 || der && x === T - 1) col = cuerpo[1];
          else if (izq && x === 1 || der && x === T - 2) col = cuerpo[Math.max(0, i - 1)];
          if (aba && y === T - 1) col = cuerpo[0];
          else if (aba && y === T - 2) col = cuerpo[1];
        }
        const k = ((Y - py * P) * P + (X - px * P)) * 4;
        d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
      }
      /* las hojitas de pasto que se asoman arriba */
      if (arr && ty > 0) for (let x = 0; x < T; x++) {
        const X = tx * T + x, q = h32(X, ty, 7);
        if (q > 0.45) continue;
        if ((izq && x < 3) || (der && x > T - 4)) continue;
        const alto = q < 0.12 ? 3 : q < 0.3 ? 2 : 1;
        for (let k2 = 1; k2 <= alto; k2++) {
          const Y = ty * T - k2; if (Y < py * P) continue;
          const kk = ((Y - py * P) * P + (X - px * P)) * 4, cc = k2 === alto ? tope[5] : tope[4];
          d[kk] = cc[0]; d[kk + 1] = cc[1]; d[kk + 2] = cc[2]; d[kk + 3] = 255;
        }
      }
    }
    if (!algo) continue;
    g.putImageData(img, 0, 0);
    piezas.set(px + ',' + py, c);
  }
  return {
    P, piezas,
    dibujar(g2, cam, w, h) {
      for (let py = Math.floor(cam.y / P); py <= Math.floor((cam.y + h) / P); py++) for (let px = Math.floor(cam.x / P); px <= Math.floor((cam.x + w) / P); px++) {
        const c = piezas.get(px + ',' + py); if (c) g2.drawImage(c, px * P - Math.round(cam.x), py * P - Math.round(cam.y));
      }
    },
  };
}
