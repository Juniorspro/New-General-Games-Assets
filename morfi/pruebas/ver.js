// El visor de niveles (para diseñarlos): el nivel quieto y el camino que
// hace el caramelo con la solución guardada (verde, con un punto por cada
// acción) y sin tocar nada (rojo). ?nivel=1-3&t=0.8 muestra el instante 0,8 s
// de la solución.
import { NIVELES, nivelPorId, cajaDe } from '../js/niveles.js';
import { Partida } from '../js/partida.js';
import { dibujarNivel, camaraTablero, aP, Efectos } from '../js/dibujo.js';
import { Morfi } from '../js/morfi.js';

const q = new URLSearchParams(location.search);
// ?desde=archivo.json: los niveles de un borrador (en esta carpeta) en vez de los de niveles.js
const borrador = q.get('desde') ? await (await fetch(q.get('desde'))).json() : null;
const def = (borrador && borrador.find((n) => n.id === q.get('nivel'))) || nivelPorId(q.get('nivel') || '1-1') || NIVELES[0];
const c = document.getElementById('c'), g = c.getContext('2d');
const dpr = devicePixelRatio || 1;
c.width = innerWidth * dpr; c.height = innerHeight * dpr;

function camino(sol) {
  const p = new Partida(def), pts = [], acc = [...(sol || [])].sort((a, b) => a[0] - b[0]), marcas = [];
  let k = 0;
  while (p.estado === 'juego' && p.t < 12) {
    while (k < acc.length && acc[k][0] <= p.t + 1e-9) { p.accion(acc[k++].slice(1)); marcas.push([p.x, p.y]); }
    p.paso();
    if (p.pasos % 3 === 0) pts.push([p.x, p.y]);
  }
  return { pts, marcas, estado: p.estado, estrellas: p.tomadas, t: p.t };
}

const p = new Partida(def);
const tVer = +(q.get('t') || 0), acc = [...(def.sol || [])].sort((a, b) => a[0] - b[0]);
let k = 0;
while (p.t < tVer) { while (k < acc.length && acc[k][0] <= p.t + 1e-9) p.accion(acc[k++].slice(1)); p.paso(); }
const morfi = new Morfi('kraft');
morfi.pasar(0.3, { blanco: [p.x - p.morfi.x, p.y - p.morfi.y], ganas: p.apetito() });
const cam = camaraTablero(c.width, c.height);
dibujarNivel(g, c.width, c.height, p, cam, { t: 0, morfi, efectos: new Efectos(), mundo: cajaDe(def.id).id, dpr });
const con = camino(def.sol), sin = camino([]);
for (const [r, col] of [[sin, 'rgba(230,40,40,0.8)'], [con, 'rgba(20,170,60,0.9)']]) {
  g.strokeStyle = col; g.lineWidth = 2 * dpr; g.beginPath();
  r.pts.forEach(([x, y], i) => { const [sx, sy] = aP(cam, x, y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.stroke();
  g.fillStyle = col; for (const [x, y] of r.marcas) { const [sx, sy] = aP(cam, x, y); g.beginPath(); g.arc(sx, sy, 5 * dpr, 0, Math.PI * 2); g.fill(); }
}
g.fillStyle = '#fff'; g.font = `${14 * dpr}px monospace`;
g.fillText(`${def.id}: solución → ${con.estado} ${con.estrellas}★ ${con.t.toFixed(1)} s · sin tocar → ${sin.estado} ${sin.estrellas}★`, 10 * dpr, c.height - 12 * dpr);
window.listo = { con: { estado: con.estado, estrellas: con.estrellas, t: con.t }, sin: { estado: sin.estado, estrellas: sin.estrellas } };
