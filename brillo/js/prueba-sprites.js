/* ?prueba=sprites — todos los cuadros de los muñequitos, grandes, para mirarlos */
import { cuadro, ANIMS, cuadrosDe, CUADRO } from './personajes.js';

export function probarSprites() {
  const q = new URLSearchParams(location.search);
  const quienes = (q.get('quien') || 'nick,mora,tito,lila,gris').split(',');
  const K = +(q.get('k') || 3);
  const c = document.getElementById('c');
  const filas = [];
  for (const quien of quienes) for (const a of ANIMS) filas.push([quien, a]);
  const cols = 8;
  c.width = cols * CUADRO.w * K + 120; c.height = filas.length * CUADRO.h * K;
  Object.assign(c.style, { position: 'absolute', left: 0, top: 0, width: c.width + 'px', height: c.height + 'px', imageRendering: 'pixelated', background: 'linear-gradient(#bfe6ff,#eaf8ff)' });
  document.body.style.overflow = 'auto';
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.font = '12px sans-serif'; g.fillStyle = '#123';
  filas.forEach(([quien, a], fila) => {
    g.fillText(`${quien} ${a}`, 4, fila * CUADRO.h * K + 16);
    for (let f = 0; f < cuadrosDe(a); f++) g.drawImage(cuadro(quien, a, f, false), 120 + f * CUADRO.w * K, fila * CUADRO.h * K, CUADRO.w * K, CUADRO.h * K);
  });
  window.__listo = true;
}
