/* ?prueba=nivel&nivel=colina — jugar un nivel con el teclado (flechas, Z/espacio, X), sin historia */
import { Pantalla } from './pantalla.js';
import { Post } from './post.js';
import { Nivel } from './juego.js';
import { lienzo2d } from './pixel.js';
import { DT } from './fisica.js';

export function probarNivel() {
  const q = new URLSearchParams(location.search);
  Pantalla.iniciar();
  const post = new Post(document.getElementById('c'));
  const habil = {}; for (const h of (q.get('habil') || '').split(',')) if (h) habil[h] = true;
  const N = new Nivel(q.get('nivel') || 'colina', { habil, en: q.has('x') ? { x: +q.get('x'), y: +q.get('y') } : null });
  let [base, g] = lienzo2d(Pantalla.w, Pantalla.h);
  const teclas = {}, antes = {};
  addEventListener('keydown', (e) => { teclas[e.code] = true; if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
  addEventListener('keyup', (e) => { teclas[e.code] = false; });
  const leer = () => {
    const s = !!(teclas.KeyZ || teclas.Space), a = !!teclas.KeyX;
    const r = { x: (teclas.ArrowRight ? 1 : 0) - (teclas.ArrowLeft ? 1 : 0), y: (teclas.ArrowUp ? 1 : 0) - (teclas.ArrowDown ? 1 : 0), salto: s, saltoE: s && !antes.s, accion: a, accionE: a && !antes.a };
    antes.s = s; antes.a = a; return r;
  };
  let acum = 0, ult = 0;
  window.__N = N; window.__paso = (inp, n = 1) => { for (let i = 0; i < n; i++) N.paso(inp); };
  const cuadroN = (ts) => {
    requestAnimationFrame(cuadroN);
    const dt = ult ? Math.min(0.1, (ts - ult) / 1000) : DT; ult = ts;
    const w = Pantalla.w, h = Pantalla.h;
    if (base.width !== w || base.height !== h) { [base, g] = lienzo2d(w, h); post.tamano(w, h, Pantalla.escala, Pantalla.lienzo); }
    if (!window.__congelado) { acum += dt; let n = 0; while (acum >= DT && n < 5) { N.paso(leer()); acum -= DT; n++; } }
    N.cuadro(dt);
    N.dibujar(g, w, h);
    const F = N.fondo;
    post.mostrar(base, { ...F.post, sol: F.sol, grado: F.grado, t: N.t });
  };
  post.tamano(Pantalla.w, Pantalla.h, Pantalla.escala, Pantalla.lienzo);
  requestAnimationFrame(cuadroN);
  window.__listo = true;
}
