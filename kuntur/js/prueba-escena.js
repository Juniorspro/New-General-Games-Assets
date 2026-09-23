// escena de prueba: la física, el terreno y una cápsula en lugar de Killa
import * as THREE from 'three';
import { Escena } from './escena.js';
import { biomaEn } from './biomas.js';
import { crearMundo, pasarKilla, DT } from './fisica.js';
import { Cielo } from './cielo.js';
import { Entrada } from './entrada.js';
import { KillaPapel } from './actores.js';
import { armarCarton, armarTeatrito, armarColgantes, pasarColgantes } from './papel.js';
import { Escenario } from './escenario.js';

export function probarEscena(nivel, bioNombre) {
  const E = new Escena(document.getElementById('c'), new URLSearchParams(location.search).get('cal') || 'alta');
  const bio = biomaEn(bioNombre, +(new URLSearchParams(location.search).get('k') || 0));
  const m = crearMundo(nivel);
  E.ponerBioma(bio);
  const cielo = new Cielo(E.escena); cielo.poner(bio);
  const estilo = new URLSearchParams(location.search).get('estilo') || 'papel';
  let colg = null, esc = null;
  if (estilo === 'papel') {
    const car = armarCarton(m, bio);
    colg = armarColgantes(bio, 0, m.w);
    E.escena.add(car, armarTeatrito(bio, 0, m.w, car.userData.perfil), colg);
    esc = new Escenario(E.escena, m, bio);
  }
  const killa = new KillaPapel(E.escena);
  const q = new URLSearchParams(location.search);
  const zoom = +(q.get('zoom') || 1);
  Entrada.teclado({ ArrowLeft: 'izq', ArrowRight: 'der', ArrowUp: 'arr', ArrowDown: 'aba', Space: 'salto', KeyZ: 'salto', KeyX: 'accion' });
  let t = 0, acum = 0, ult = 0;
  const cam = { x: m.p.x, y: m.p.y };
  window.__K = { m, E, killa, get esc() { return esc; }, anda(n) { for (let i = 0; i < n; i++) paso(); }, listo: true };
  const ultimos = [];
  function paso() { pasarKilla(m, Entrada.leer()); ultimos.push(...m.eventos); m.eventos.length = 0; Entrada.fin(); t += DT; }
  function cuadro(ts) {
    requestAnimationFrame(cuadro);
    const real = ult ? Math.min(0.1, (ts - ult) / 1000) : DT; ult = ts; acum += real;
    while (acum >= DT) { acum -= DT; paso(); }
    const p = m.p;
    let aterrizo = 0;
    for (const e of ultimos) if (e.t === 'aterriza') aterrizo = e.fuerza;
    let salto = false; for (const e of ultimos) if (e.t === 'salto') salto = true;
    ultimos.length = 0;
    const dt = real;
    killa.actualizar(p, { t, dt, aterrizo, salto });
    cam.x += (p.x + p.dir * 1.5 - cam.x) * 0.08; cam.y += (p.y + 1.5 - cam.y) * 0.08;
    const d = E.distancia(22 / zoom, 11 / zoom);
    E.camara.position.set(cam.x, cam.y + 2.2 / zoom, d);
    E.camara.lookAt(cam.x, cam.y + 0.4 - (zoom > 1 ? 0.8 : 0), 0);
    if (window.__cam) { const c = window.__cam(p); E.camara.position.set(...c.p); E.camara.lookAt(...c.t); }
    E.seguirLuz(p.x, p.y);
    cielo.pasar(t, E.camara);
    if (colg) pasarColgantes(colg, t, E.camara.position.x);
    if (esc) esc.pasar(dt, t, E.camara.position.x, 24 / zoom, m);
    E.dibujar(t);
  }
  requestAnimationFrame(cuadro);
}
