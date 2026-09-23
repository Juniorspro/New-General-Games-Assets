/* ?prueba=fondo&mundo=colina&x=0 — el paisaje de un mundo, con piso y Nick, para mirarlo */
import { Pantalla } from './pantalla.js';
import { Post } from './post.js';
import { Fondo } from './fondos.js';
import { pintarNivel, T } from './tiles.js';
import { cuadro } from './personajes.js';
import { lienzo2d } from './pixel.js';
import { BurbujasAmbiente, pastoFrente } from './efectos.js';

export function probarFondo() {
  const q = new URLSearchParams(location.search);
  Pantalla.iniciar();
  const post = new Post(document.getElementById('c'));
  const F = new Fondo(q.get('mundo') || 'colina', 7);
  /* un pedacito de nivel: piso con un escalón y una isla flotando */
  const A = 120, H = 23;
  const mapa = (x, y) => y >= 19 || (x > 30 && x < 42 && y >= 16) || (x > 50 && x < 57 && y === 12) || (x > 70 && y >= 17);
  const N = pintarNivel(A, H, mapa, 'colina');
  let [base, g] = lienzo2d(Pantalla.w, Pantalla.h);
  const B = new BurbujasAmbiente(40, 3), P = pastoFrente(900, 5);
  const t0 = performance.now();
  const cam = { x: +(q.get('x') || 0), y: H * T - Pantalla.h };
  const cuadroN = () => {
    requestAnimationFrame(cuadroN);
    const w = Pantalla.w, h = Pantalla.h;
    if (base.width !== w || base.height !== h) { [base, g] = lienzo2d(w, h); post.tamano(w, h, Pantalla.escala, Pantalla.lienzo); }
    const t = q.has('t') ? +q.get('t') : (performance.now() - t0) / 1000;
    if (q.has('mover')) cam.x = +(q.get('x') || 0) + t * 40;
    F.atras(g, cam, t, w, h, cam.y);
    B.dibujar(g, cam, t, w, h, 'atras');
    N.dibujar(g, cam, w, h);
    const f = Math.floor(t * 8);
    g.drawImage(cuadro('nick', 'quieto', f, false), Math.round(12 * T - cam.x), Math.round(19 * T - 36 - cam.y));
    g.drawImage(cuadro('mora', 'saluda', f, true), Math.round(15 * T - cam.x), Math.round(19 * T - 36 - cam.y));
    g.drawImage(cuadro('nick', 'corre', f, false), Math.round(20 * T - cam.x), Math.round(19 * T - 36 - cam.y));
    { const per = P.width, ox = -((cam.x * 1.3) % per + per) % per; for (let x = Math.round(ox); x < w; x += per) g.drawImage(P, x, h - P.height + 26); }
    B.dibujar(g, cam, t, w, h, 'frente');
    post.mostrar(base, { ...F.post, sol: F.sol, grado: F.grado, t });
  };
  post.tamano(Pantalla.w, Pantalla.h, Pantalla.escala, Pantalla.lienzo);
  requestAnimationFrame(cuadroN);
  window.__listo = true;
}
