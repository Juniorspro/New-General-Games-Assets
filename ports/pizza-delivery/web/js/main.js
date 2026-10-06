/* Pizza Delivery v0.2 (port): arranque, letras, el bucle y los modos (menú, jugando, pausa). */
import * as THREE from 'three';
import { cargarComun } from './escena.js';
import { Juego } from './juego.js';
import { G } from './historia.js';
import { crearControles } from './controles.js';
import { crearUI } from './ui.js';
import { crearPost } from './post.js';
import { Sonido } from './sonido.js';
import { D, guardar } from './guardado.js';
import { ponerSubtitulos } from './textos.js';

const BASE = window.PIZZA_BASE || '';
const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (!D.ajustes.calidad) { D.ajustes.calidad = tactil ? 'media' : 'alta'; guardar(); }
const CALIDAD = { baja: { px: 0.75 }, media: { px: 1 }, alta: { px: 1.5 } };
const Q = () => CALIDAD[D.ajustes.calidad] || CALIDAD.media;

const lienzo = document.querySelector('#lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !tactil, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const escena = new THREE.Scene();
const sonido = new Sonido();
const controles = crearControles(document.querySelector('#tactil'));
const post = crearPost(renderer);
let R = null, J = null, listo = false, modo = 'menu', pausado = false, partida = false;

const A = {
  sonido, controles, enPartida: () => partida,
  jugar, seguir, alMenu,
  alIdioma: () => { document.documentElement.lang = D.idioma; J?.armarTextos(); },
  alCalidad: () => ajustarTam(),
  alBrillo: () => { if (R) R.uMundo.uBrillo.value = D.ajustes.brillo; },
};
const U = crearUI(A);
controles.vibrar = (ms) => U.vibrar(ms);
controles.mostrar(false);

function ajustarTam() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q().px));
  renderer.setSize(innerWidth, innerHeight, false);
  if (J) { J.camara.aspect = innerWidth / innerHeight; J.camara.updateProjectionMatrix(); }
  controles.ubicar();
}
addEventListener('resize', ajustarTam);

async function arrancar() {
  U.mostrar('cargando');
  R = await cargarComun(BASE, renderer);
  ponerSubtitulos(R.subs);
  R.uMundo.uBrillo.value = D.ajustes.brillo;
  // las letras del juego (TextMesh y menús)
  const letras = {};
  await Promise.all(Object.entries(R.C.letras || {}).map(async ([nombre, arch]) => {
    const fam = 'L-' + nombre.replace(/\W/g, '');
    try { const f = new FontFace(fam, `url(${BASE}datos/${arch})`); await f.load(); document.fonts.add(f); letras[nombre] = fam; } catch { /* sin la letra */ }
  }));
  J = new Juego({ R, renderer, escena, sonido, post, letras, ui: {
    subtitulo: (t) => U.subtitulo(t), traducir: U.traducir, vibrar: (ms) => U.vibrar(ms),
    cargando: (si) => { if (si && modo !== 'menu') U.mostrar('cargando'); },
    alNivel: (n) => alNivel(n),
  } });
  ajustarTam();
  await J.cargarNivel('Menu');
  listo = true; window.__pizza.listo = true;
}

function alNivel(n) {
  if (n === 'Menu') {
    // del menú 3D del original quedan el título y los textos fijos; los botones son los de acá
    for (const nombre of ['Play', 'Controls', 'Credits', 'GammaOn', 'GammaOff', 'Quit', 'controlNote', 'creditNote']) { const i = J.S.buscar(nombre); if (i >= 0) J.activoRec(i, false); }
    if (partida && modo === 'jugando') partida = false;
    modo = 'menu'; controles.mostrar(false);
    if (document.pointerLockElement) document.exitPointerLock();
    U.mostrar(D.idioma ? 'menu' : 'idioma');
    return;
  }
  modo = 'jugando'; pausado = false;
  U.mostrar(null);
  controles.soltarTodo();
  const conJugador = !!J.jug && n !== 'end' && n !== 'DollHouse';
  controles.mostrar((tactil || controles.tactil) && conJugador);
  if (conJugador) { U.ayuda(tactil || controles.tactil); bloquear(); }
}

function jugar() {
  if (!listo) return;
  sonido.iniciar();
  partida = true; G.gamma = !!D.ajustes.gamma;
  modo = 'cargando'; U.mostrar('cargando');
  J.cargarNivel('NewScene1');
}
function seguir() {
  if (!partida || !J.S || J.nivel === 'Menu') return jugar();
  modo = 'jugando'; pausado = false; sonido.pausar(false);
  U.mostrar(null); controles.soltarTodo();
  controles.mostrar((tactil || controles.tactil) && !!J.jug);
  bloquear();
}
function pausar() {
  if (modo !== 'jugando' || pausado) return;
  pausado = true; sonido.pausar(true);
  controles.soltarTodo(); controles.mostrar(false);
  if (document.pointerLockElement) document.exitPointerLock();
  U.mostrar('pausa');
}
function alMenu() { pausado = false; sonido.pausar(false); partida = false; J.cargarNivel('Menu'); }

function bloquear() { if (!tactil && !controles.tactil) lienzo.requestPointerLock?.()?.catch?.(() => {}); }
controles.alMouse = () => { if (modo === 'jugando' && !pausado) bloquear(); };
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === lienzo) { controles.mirar.x += e.movementX; controles.mirar.y += e.movementY; } });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && modo === 'jugando' && !pausado && !controles.tactil) pausar(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (['ajustes', 'controles', 'creditos'].includes(U.actual)) U.mostrar(U.previa || 'menu');
  else if (U.actual === 'pausa') seguir();
});
const precargar = () => sonido.iniciar();
addEventListener('pointerdown', precargar, { capture: true });

let previo = performance.now();
const VACIO = { x: 0, y: 0, mx: 0, my: 0, pausa: false, toque: false };
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, (ahora - previo) / 1000); previo = ahora;
  if (!listo || !J.S || J.cargando) return;
  if (window.__pizza.congelar === 'todo') return; // (pruebas: sin dibujar)
  if (modo === 'jugando' && !pausado && !window.__pizza.congelar) {
    const inp = controles.leer(dt);
    if (inp.pausa) pausar(); else J.update(dt, inp, D.ajustes);
  } else if (modo === 'menu') J.update(dt, VACIO, D.ajustes);
  post.render(escena, J.camara, { gamma: D.ajustes.gamma });
  window.__pizza.cuadros++;
}
window.__pizza = { listo: false, cuadros: 0, dibujar: () => post.render(escena, J.camara, { gamma: D.ajustes.gamma }), get J() { return J; }, get G() { return G; }, renderer, escena, jugar, pausar, alMenu, get modo() { return modo; } };
requestAnimationFrame(cuadro);
arrancar().catch((e) => { console.error(e); document.querySelector('#pantallas').innerHTML = `<div class="caja"><p>ERROR: ${e.message}</p></div>`; });
