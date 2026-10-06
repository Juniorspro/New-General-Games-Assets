/* Bus Stop Simulator (port): arranque, el bucle, los modos (menú, jugando, pausa, final) y la
   calidad. La escena de fondo del menú es la misma noche del juego, con la cámara dando vueltas
   a la parada. */
import * as THREE from 'three';
import { cargarEscena } from './escena.js';
import { crearFisica } from './fisica.js';
import { crearVegetacion } from './vegetacion.js';
import { Juego } from './juego.js';
import { crearControles } from './controles.js';
import { crearUI } from './ui.js';
import { Sonido } from './sonido.js';
import { D, guardar } from './guardado.js';
import { t } from './textos.js';

const BASE = window.BUS_BASE || '';
const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (!D.ajustes.calidad) { D.ajustes.calidad = tactil ? 'media' : 'alta'; guardar(); }
const CALIDAD = {
  baja: { px: 0.8, arbolesCerca: 40, arbolesLejos: 190, pasto: 16, pastoMax: 1500 },
  media: { px: 1.1, arbolesCerca: 65, arbolesLejos: 250, pasto: 26, pastoMax: 4000 },
  alta: { px: 1.6, arbolesCerca: 100, arbolesLejos: 320, pasto: 38, pastoMax: 9000 },
};
const Q = () => CALIDAD[D.ajustes.calidad] || CALIDAD.media;

const lienzo = document.querySelector('#lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: !tactil, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const escena = new THREE.Scene();
const camMenu = new THREE.PerspectiveCamera(55, 1, 0.1, 420);
const sonido = new Sonido();
const controles = crearControles(document.querySelector('#tactil'));
controles.vibrar = (ms) => U.vibrar(ms);
let S = null, fisica = null, veg = null, juego = null, listo = false;
let modo = 'menu', pausado = false, partida = false;

const A = {
  sonido, controles, get juego() { return juego; },
  enPartida: () => partida,
  jugar, seguir, alMenu,
  alIdioma: () => { controles.textos(); armarTeles(); document.documentElement.lang = D.idioma; },
  alCalidad: () => { ajustarTam(); veg?.actualizar(camActiva().position, true); },
  alBrillo: () => { if (S) S.uniformesMundo.uBrillo.value = D.ajustes.brillo; },
};
const U = crearUI(A);
controles.mostrar(false);

function ajustarTam() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q().px));
  renderer.setSize(w, h, false);
  for (const c of [camMenu, juego?.camara, juego?.camFinal]) if (c) { c.aspect = w / h; c.updateProjectionMatrix(); }
  controles.ubicar();
}
addEventListener('resize', ajustarTam);
ajustarTam();

/* las teles: el texto de cada TextMesh, con la letra del juego (typewcond), en un lienzo */
function armarTeles() {
  if (!S) return;
  const textos = S.tv?.[D.idioma] || S.tv?.en || null;
  for (const tv of S.teles) {
    const lineas = (textos?.[tv.num - 1] || tv.original).replace(/\r/g, '').split('\n');
    const F = 44, cv = document.createElement('canvas'), cx = cv.getContext('2d');
    cx.font = `bold ${F}px BusTipo, monospace`;
    const ancho = Math.ceil(Math.max(...lineas.map((l) => cx.measureText(l).width))) + 12, altoL = F * 1.32;
    cv.width = ancho; cv.height = Math.ceil(altoL * lineas.length) + 8;
    cx.font = `bold ${F}px BusTipo, monospace`; cx.textBaseline = 'top';
    const [r, g, b] = tv.color;
    // (un borde que contraste, para leerlo sobre la pantalla glitcheada)
    cx.lineJoin = 'round'; cx.lineWidth = 7;
    cx.strokeStyle = 0.3 * r + 0.59 * g + 0.11 * b < 0.35 ? 'rgba(235,235,235,.85)' : 'rgba(0,0,0,.85)';
    lineas.forEach((l, k) => cx.strokeText(l, 4, 4 + k * altoL));
    cx.fillStyle = `rgb(${r * 255},${g * 255},${b * 255})`;
    lineas.forEach((l, k) => cx.fillText(l, 4, 4 + k * altoL));
    const m = tv.plano.material;
    m.map?.dispose();
    m.map = new THREE.CanvasTexture(cv); m.map.anisotropy = 4; m.needsUpdate = true;
    const esc = tv.linea / altoL, w = cv.width * esc, h = cv.height * esc;
    tv.plano.scale.set(w, h, 1);
    tv.plano.position.set(-w / 2, h / 2, 0.002);
  }
}

async function arrancar() {
  U.mostrar('cargando');
  try {
    const f = new FontFace('BusTipo', `url(${BASE}datos/fuente.ttf)`);
    await f.load(); document.fonts.add(f);
  } catch { /* sin la letra, monospace */ }
  S = await cargarEscena({ base: BASE, renderer, progreso: (p) => U.progreso(p * 0.9) });
  escena.add(S.raiz);
  const R = S.render;
  const niebla = new THREE.Color(...R.niebla_color.slice(0, 3));
  escena.background = niebla;
  if (R.niebla) escena.fog = new THREE.FogExp2(niebla, R.niebla_dens);
  escena.add(new THREE.AmbientLight(new THREE.Color(...R.ambiente.slice(0, 3)), 2));
  S.uniformesMundo.uBrillo.value = D.ajustes.brillo;
  fisica = crearFisica(S);
  veg = crearVegetacion(S, renderer, escena, Q);
  juego = new Juego({ S, fisica, sonido, escena, ui: U, aspecto: innerWidth / innerHeight });
  armarTeles();
  ajustarTam();
  // compila todo antes de mostrar (sin tirones al girar la primera vez)
  veg.actualizar(juego.camara.position, true);
  renderer.compile(escena, juego.camara);
  U.progreso(1);
  listo = true;
  window.__bus.listo = true;
  U.mostrar(D.idioma ? 'menu' : 'idioma');
}

const camActiva = () => (modo === 'menu' || !juego ? camMenu : juego.camaraActiva);

/* el audio se decodifica con el primer toque (antes no se puede) y no frena el arranque */
let audioListo = null;
function precargarAudio() {
  sonido.iniciar();
  if (!audioListo && sonido.ctx) audioListo = sonido.cargar(BASE, ['s122', 's123', 's124', 's125']);
  return audioListo;
}
addEventListener('pointerdown', precargarAudio, { capture: true });
addEventListener('keydown', precargarAudio, { capture: true });

function jugar() {
  if (!listo) return;
  sonido.pararTodo();
  juego.reiniciar();
  const p = precargarAudio();
  if (p) p.then(() => { if (partida) juego.sonar(); });
  partida = true; pausado = false; modo = 'jugando';
  sonido.pausar(false);
  U.mostrar(null);
  controles.soltarTodo();
  controles.mostrar(tactil || controles.tactil);
  U.ayuda(tactil || controles.tactil);
  D.partidas++; guardar();
  bloquear();
}
function seguir() {
  if (!partida) return jugar();
  modo = 'jugando'; pausado = false;
  sonido.pausar(false);
  U.mostrar(null);
  controles.soltarTodo();
  controles.mostrar(tactil || controles.tactil);
  bloquear();
}
function pausar() {
  if (modo !== 'jugando' || pausado || juego.estado !== 'jugando') return;
  pausado = true;
  sonido.pausar(true);
  controles.soltarTodo(); controles.mostrar(false);
  if (document.pointerLockElement) document.exitPointerLock();
  U.mostrar('pausa');
}
function alMenu() {
  modo = 'menu'; pausado = false;
  if (juego?.estado !== 'jugando') partida = false;
  sonido.pausar(false); sonido.pararTodo();
  controles.mostrar(false);
  if (document.pointerLockElement) document.exitPointerLock();
  U.mostrar('menu');
}

/* mouse (compu): el puntero queda trabado en el juego, como Screen.lockCursor del original */
function bloquear() { if (!tactil && !controles.tactil) lienzo.requestPointerLock?.()?.catch?.(() => {}); }
controles.alMouse = () => { if (modo === 'jugando' && !pausado) bloquear(); };
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === lienzo) { controles.mirar.x += e.movementX; controles.mirar.y += e.movementY; } });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && modo === 'jugando' && !pausado && !controles.tactil) pausar(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });
/* atrás del teléfono (llega como Escape) y Escape en la compu: en la pausa sigue; en un submenú, vuelve */
addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' || e.repeat) return;
  if (['ajustes', 'controles', 'creditos'].includes(U.actual)) U.mostrar(U.previa || 'menu');
  else if (U.actual === 'pausa') seguir();
});

let previo = performance.now(), tReloj = 0, ang = 0;
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dt = Math.min(0.05, (ahora - previo) / 1000); previo = ahora;
  if (!listo) return;
  tReloj += dt;
  if (modo === 'jugando' && !pausado && !window.__bus.congelar) {
    const inp = controles.leer(dt);
    if (inp.pausa && juego.estado === 'jugando') pausar();
    else {
      juego.update(dt, inp, D.ajustes);
      U.hud(juego);
      if (juego.estado === 'final' && juego.final > 9 && U.actual !== 'final') {
        if (!D.record || juego.tiempo < D.record) { D.record = juego.tiempo; guardar(); }
        partida = false; controles.mostrar(false);
        U.mostrar('final');
      }
    }
  } else if (modo === 'menu') {
    ang += dt * 0.05;
    const c = new THREE.Vector3(25.4, 1.5, 6);
    camMenu.position.set(c.x + Math.cos(ang) * 13, 3.2, c.z + Math.sin(ang) * 13);
    camMenu.lookAt(c);
    juego.bichosUpdate?.(0);
  }
  const cam = camActiva();
  veg.actualizar(cam.position);
  veg.tick(tReloj);
  sonido.actualizar(cam);
  renderer.render(escena, cam);
  window.__bus.cuadros++;
}

window.__bus = { listo: false, cuadros: 0, get juego() { return juego; }, get S() { return S; }, renderer, escena, jugar, pausar, alMenu, get modo() { return modo; }, veg: () => veg?.cuantos() };
requestAnimationFrame(cuadro);
arrancar().catch((e) => { console.error(e); document.querySelector('#pantallas').innerHTML = `<div class="caja"><p>ERROR: ${e.message}</p></div>`; });
