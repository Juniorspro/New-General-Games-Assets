/* Slendytubbies V2 Beta (port): arranque, idioma, el menú 3D del original (cámaras y botones que se
   tocan), la partida, la pausa y el bucle. En el HTML de un solo archivo los datos vienen adentro. */
import * as THREE from 'three';
import { cargarComun } from './escena.js';
import { Juego } from './juego.js';
import { crearControles } from './controles.js';
import { crearUI } from './ui.js';
import { crearPost } from './post.js';
import { Sonido } from './sonido.js';
import { D, guardar } from './guardado.js';
import { prepararEmbebidos, url } from './archivos.js';
import { crearRed } from './red.js';

const BASE = window.SLENDY_BASE || '';
const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (!D.ajustes.calidad) { D.ajustes.calidad = tactil ? 'media' : 'alta'; guardar(); }
const CALIDAD = { baja: { px: 0.6, lejos: 160, pasto: { radio: 14, max: 1200 } }, media: { px: 1, lejos: 300, pasto: { radio: 24, max: 3000 } }, alta: { px: 1.5, lejos: 1000, pasto: { radio: 38, max: 6000 } } };
const Q = () => CALIDAD[D.ajustes.calidad] || CALIDAD.media;

const lienzo = document.querySelector('#lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !tactil, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const escena = new THREE.Scene();
const sonido = new Sonido();
const controles = crearControles(document.querySelector('#tactil'));
const post = crearPost(renderer);
let R = null, J = null, listo = false, modo = 'inicio', pausado = false;

const A = {
  sonido, controles,
  alIdioma: () => { document.documentElement.lang = D.idioma; R?.idiomaCambio(); U.reidiomar(); },
  trasIdioma: () => entrar(),
  alCalidad: () => ajustarTam(),
  alBrillo: () => { if (R) R.uMundo.uBrillo.value = D.ajustes.brillo; },
  empezar, seguir, alMenu, volver,
  vibrar: (ms) => { if (!D.ajustes.vibrar) return; try { navigator.vibrate?.(ms); } catch { /* */ } },
  imagenIdioma: (g) => { const t = R.C.texs[g.tex]; const f = t?.l?.[D.idioma] || t?.arch; return f ? url(BASE + 'datos/' + f) : g.src; },
  alBotones: () => botones(),
  chatEnviar: (txt) => J?.red?.chat(txt),
};
const U = crearUI(A);
controles.vibrar = (ms) => A.vibrar(ms);
controles.mostrar(false);

function ajustarTam() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q().px));
  renderer.setSize(innerWidth, innerHeight, false);
  if (J) { J.camara.aspect = innerWidth / innerHeight; J.camara.updateProjectionMatrix(); J.lejos = Q().lejos; J.cfgPasto = Q().pasto; }
  controles.ubicar();
}
addEventListener('resize', ajustarTam);

async function arrancar() {
  if (!D.idioma) { const l = (navigator.language || 'es').toLowerCase(); D.idioma = l.startsWith('pt') ? 'pt' : l.startsWith('en') ? 'en' : 'es'; document.documentElement.lang = D.idioma; }
  U.mostrar('cargando');
  await prepararEmbebidos((x) => U.avance(x * 0.6));
  R = await cargarComun(BASE, renderer, (x) => U.avance(0.6 + x * 0.3));
  R.uMundo.uBrillo.value = D.ajustes.brillo;
  J = new Juego({ R, renderer, escena, sonido, post, ui: {
    cargando: (si) => { if (si) { U.limpiarGUI(); controles.mostrar(false); if (modo !== 'inicio') U.mostrar('cargando'); } },
    alNivel: (n) => alNivel(n),
    gui: (l) => U.gui(l), botonVolver: U.botonVolver, calidadUnity: U.calidadUnity, empezar: U.empezar, personalizar: U.personalizar,
    atrapado: U.atrapado, alJugador: () => alJugador(), chatBoton: U.chatBoton, chatAbrir: U.chatAbrir,
  } });
  J.red = crearRed(J, U);
  ajustarTam();
  // los sonidos son pocos: se cargan todos de una
  listo = true; window.__slendy.listo = true;
  U.mostrar('tocar'); // arranca directo: el idioma se pide al tocar JUGAR
}

function empezar() { // JUGAR (el toque que habilita el audio) → idioma → menú
  if (!listo) return;
  sonido.iniciar();
  U.mostrar('idioma');
}
async function entrar() {
  U.mostrar('cargando');
  await sonido.cargar(BASE, Object.keys(R.C.audios));
  modo = 'menu';
  J.cargarNivel(0);
}

function alNivel(n) {
  pausado = false; cursorLibre = false;
  U.mostrar(null);
  controles.soltarTodo();
  if (document.pointerLockElement) document.exitPointerLock(); // (hasta que aparezca el jugador, el mouse es para la GUI)
  if (n === 0 || n === 10) {
    modo = 'menu';
    if (document.pointerLockElement) document.exitPointerLock();
    controles.mostrar(false);
    document.body.classList.add('en-menu');
    return;
  }
  modo = 'jugando';
  document.body.classList.remove('en-menu');
  botones();
}
function alJugador() {
  modo = 'jugando';
  controles.mostrar(tactil || controles.tactil);
  U.ayuda(tactil || controles.tactil);
  botones();
  bloquear();
}
/* los botones que se ven: la E mientras está el cartel de empezar; la visión solo para el Tinky del versus */
function botones() {
  const l = ['joy', 'pausa', 'linterna', 'correr', 'agachar', 'saltar', 'mapa'];
  if (U.hayEmpezar) l.push('usar');
  if (J?.soyTinky) { l.push('vision'); l.splice(l.indexOf('mapa'), 1); }
  controles.ver(l);
}

function seguir() {
  if (!J?.S) return;
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
function alMenu() { pausado = false; sonido.pausar(false); U.mostrar(null); J.red?.salir(); J.cargarNivel(0); }
function volver(previa) {
  if (previa === 'pausa') U.mostrar('pausa');
  else if (previa === 'tocar' || previa === 'idioma') U.mostrar(previa);
  else U.mostrar(null);
}

let cursorLibre = false;
function bloquear() { if (!tactil && !controles.tactil && J?.jug && !cursorLibre) lienzo.requestPointerLock?.()?.catch?.(() => {}); }
/* G y H: "Press G and H to show/hide your cursor" (para tocar los botones del OnGUI sin pausar) */
addEventListener('keydown', (e) => {
  if (modo !== 'jugando' || pausado || e.repeat || !J?.jug || U.actual) return;
  if (e.code === 'KeyG') { cursorLibre = true; if (document.pointerLockElement) document.exitPointerLock(); }
  if (e.code === 'KeyH') { cursorLibre = false; bloquear(); }
});
controles.alMouse = (e) => {
  if (modo === 'jugando' && !pausado && J?.jug) { cursorLibre = false; bloquear(); return; }
  tocarMenu(e);
};
/* en el menú (o sin jugador): el clic va a los objetos 3D (OnMouseDown) */
function tocarMenu(e) {
  if (!J?.S || U.actual) return;
  sonido.iniciar();
  // los créditos y la ayuda se cierran con Espacio: un toque hace lo mismo
  if (J.conTag('Creditsandhelp').length) { J.teclasExtra = ['Space']; return; }
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  J.clic(nx, ny);
}
controles.alToque = (e) => { if (modo === 'menu' || !J?.jug) tocarMenu(e); };
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === lienzo) { controles.mirar.x += e.movementX; controles.mirar.y += e.movementY; } });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && modo === 'jugando' && !pausado && !controles.tactil && J?.jug && !cursorLibre) pausar(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (U.actual === 'ajustes' || U.actual === 'controles') volver(U.previa);
  else if (U.actual === 'pausa') seguir();
  else if (modo === 'menu' && J?.S && !U.actual) { U.previa = null; U.mostrar('ajustes'); }
});
document.querySelector('#engranaje').addEventListener('click', () => { sonido.iniciar(); if (modo === 'jugando' && !pausado) pausar(); else if (!U.actual || U.actual === 'tocar') { U.previa = U.actual; U.mostrar('ajustes'); } });

let previo = performance.now();
const VACIO = { x: 0, y: 0, mx: 0, my: 0, pausa: false, teclas: new Set() };
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, (ahora - previo) / 1000); previo = ahora;
  if (!listo || !J) return;
  if (window.__slendy.congelar === 'todo') return;
  if (!J.S || J.cargando) { if (J.pendiente != null) J.update(dt, VACIO, D.ajustes); return; }
  if (pausado || U.actual === 'ajustes' || U.actual === 'controles') { if (!pausado) J.update(dt, { ...VACIO }, D.ajustes); else { post.render(escena, J.camara, {}); return; } }
  else {
    const inp = controles.leer(dt);
    if (J.teclasExtra) { for (const k of J.teclasExtra) inp.teclas.add(k); J.teclasExtra = null; }
    if (cursorLibre) { inp.mx = 0; inp.my = 0; }
    if (inp.pausa && modo === 'jugando') { pausar(); return; }
    J.update(dt, modo === 'jugando' ? inp : { ...inp, x: 0, y: 0, mx: 0, my: 0 }, D.ajustes);
  }
  if (!J.S) return;
  if (window.__slendy.congelar === 'dibujo') return; // (pruebas: la lógica a velocidad real, sin dibujar)
  post.render(escena, J.camara, {});
  window.__slendy.cuadros++;
}
window.__slendy = { listo: false, cuadros: 0, get J() { return J; }, get modo() { return modo; }, renderer, escena, empezar, pausar, alMenu, dibujar: () => post.render(escena, J.camara, {}) };
requestAnimationFrame(cuadro);
arrancar().catch((e) => { console.error(e); document.querySelector('#pantallas').innerHTML = `<div class="caja"><p>ERROR: ${e.message}</p></div>`; });
