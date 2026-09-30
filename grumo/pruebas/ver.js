// Ver un nivel con el dibujo de verdad: ?nivel=1-2&mundo=taller&ts=56&t=1.2
// (t: los segundos que se avanza siguiendo la solución guardada, si hay).
import { Partida, jugarPlan, COLS, FILAS } from '../js/partida.js';
import { NIVELES } from '../js/niveles.js';
import { dibujarNivel, dibujarNotas } from '../js/escenario.js';
import { Grumo } from '../js/grumo.js';
import { dibujarManos } from '../js/mano.js';
import { Efectos } from '../js/efectos.js';
import { pintarGrano, vineta, pintarTitileo } from '../js/plastilina.js';

const q = new URLSearchParams(location.search);
const def = NIVELES.find((n) => n.id === (q.get('nivel') || '1-1')) || NIVELES[0];
const ts = +(q.get('ts') || 56), mundo = q.get('mundo') || 'taller';
const c = document.getElementById('c'); c.width = COLS * ts; c.height = FILAS * ts;
const g = c.getContext('2d');
const grumo = new Grumo(q.get('piel') || 'naranja', q.get('sombrero') || 'nada');
const efectos = new Efectos();
let p = new Partida(def);
async function preparar() {
  let plan = null;
  try { plan = (await (await fetch('soluciones.json')).json())[def.id]; } catch { /* sin soluciones */ }
  const hasta = +(q.get('t') || 0);
  if (plan && hasta > 0) p = jugarPlan(def, plan, { tope: hasta, alPaso: (pp) => { for (const e of pp.sacarEventos()) grumo.evento(e); grumo.pasar(1 / 120, pp.j); } });
}
function dibujar(cuadro) {
  const cam = { x: 0, y: 0, ts };
  dibujarNivel(g, p, cam, { mundo, cuadro });
  grumo.pasar(0, p.j);
  grumo.dibujar(g, p.j.x * ts, p.j.y * ts, ts, cuadro);
  efectos.dibujar(g, cam);
  dibujarManos(g, p, cam, cuadro);
  dibujarNotas(g, p, cam, (k) => k, cuadro);
  pintarTitileo(g, c.width, c.height, cuadro);
  pintarGrano(g, c.width, c.height, cuadro, 0.7);
  g.drawImage(vineta(c.width, c.height, 0.4), 0, 0);
}
await preparar();
dibujar(+(q.get('cuadro') || 0));
window.__V = { p, dibujar, grumo, def };
window.listo = true;
