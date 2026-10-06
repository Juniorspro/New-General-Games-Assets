/* Arma el juego: renderer, escena, recursos, mundo (VM + sistemas), UI (UMG, fundidos, controles) y el bucle. */
import * as THREE from 'three';
import { Recursos } from './ue.js';
import { Mundo } from './mundo.js';
import './nat/jugador.js';
import { Audio } from './nat/audio.js';
import { Animaciones } from './nat/anim.js';
import './nat/matinee.js';
import './nat/timeline.js';
import { UMG } from './nat/umg.js';
import './nat/sistemas.js';
import './nat/secuencia.js';
import { Post } from './post.js';

export async function crearJuego({ base = 'datos/', contenedor = document.body, opciones = {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1) * (opciones.resolucion ?? 1));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = opciones.exposicion ?? 1.4;
  renderer.domElement.className = 'lienzo';
  contenedor.appendChild(renderer.domElement);
  const escena = new THREE.Scene(); escena.background = new THREE.Color(0);
  const camara = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 400);
  escena.add(camara);
  const ambiente = new THREE.AmbientLight(0xffffff, opciones.ambiente ?? 0.03); escena.add(ambiente);
  // capas de UI
  const capaUMG = document.createElement('div'); capaUMG.id = 'umg'; contenedor.appendChild(capaUMG);
  const fundido = document.createElement('div'); fundido.id = 'fundido'; contenedor.appendChild(fundido);
  const R = new Recursos(base, renderer);
  await R.cargarIndices();
  const M = new Mundo({ renderer, R, escena, camara, base, log: opciones.log, nPuntos: 4, nFocos: 3, lm: 4 * Math.PI * (opciones.lm ?? 1) });
  M.iniciarSistemas();
  M.audio = new Audio(M, base); M.animar = new Animaciones(M, base);
  const umg = new UMG(M, capaUMG, base);
  M.iniciarSecuencias();
  await Promise.all([M.audio.cargarIndice(), M.animar.cargarIndice(), umg.cargarIndice(), M.secuencias.cargarIndice()]);
  const fades = { cam: 0, mat: 0, colCam: null, colMat: null };
  const pintarFundido = () => {
    const a = Math.max(fades.cam, fades.mat); const c = fades.mat > fades.cam ? fades.colMat : fades.colCam;
    fundido.style.opacity = a; fundido.style.background = c ? `rgb(${Math.round((c.R ?? 0) * 255)},${Math.round((c.G ?? 0) * 255)},${Math.round((c.B ?? 0) * 255)})` : '#000';
  };
  M.ui = {
    umg,
    limpiar: () => umg.limpiar(),
    fundidoCamara: (a, c) => { fades.cam = a; fades.colCam = c; pintarFundido(); },
    fadeMatinee: (a, c) => { fades.mat = a; fades.colMat = c; pintarFundido(); },
    cursor: () => {},
  };
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix(); });
  camara.aspect = innerWidth / innerHeight; camara.updateProjectionMatrix();
  // al cargar cada nivel: precargar sonidos y animaciones del nivel, arrancar animaciones iniciales
  const cargarNivelOrig = M.cargarNivel.bind(M);
  M.cargarNivel = async (n, o = {}) => {
    M.audio.pararTodo();
    await cargarNivelOrig(n, { ...o, antesDeEmpezar: async (m) => {
      await Promise.all([m.audio.precargar(m.N.sonidos || []), m.animar.precargar(m.N.anims || []), m.secuencias.precargar(m.N.secuencias || [])]);
      for (const c of m.comps) if (c?.anim) m.animar.arrancarInicial(c);
      for (const c of m.comps) if (c && c.nat === 'AudioComponent') c.forzar = false;
      if (o.antesDeEmpezar) await o.antesDeEmpezar(m);
    } });
    for (const c of M.comps) if (c && c.nat === 'AudioComponent' && c.autoAct && c.activo !== false && !c.sonando) M.audio.play(c, 0);
  };
  let ultimo = performance.now(), corriendo = true;
  const post = new Post(renderer, M, { k: opciones.k ?? 1 });
  M.post = post;
  const J = { renderer, escena, camara, R, M, umg, ambiente, post, dt: 0.016, dibujar() { M.luces.update(camara.position); post.render(escena, camara, J.dt); } };
  // J.acelerar (pruebas): ticks extra por cuadro para recorrer una noche entera rápido
  J.paso = (dt) => { J.dt = dt; for (let i = 0; i < (J.acelerar || 0); i++) M.tick(dt); M.tick(dt); M.audio.tick(camara); J.dibujar(); };
  function bucle(t) {
    if (!corriendo) return;
    const dt = Math.min(0.1, (t - ultimo) / 1000); ultimo = t;
    if (M.nivel && !J.congelado) J.paso(dt);
    requestAnimationFrame(bucle);
  }
  requestAnimationFrame(bucle);
  J.parar = () => { corriendo = false; };
  return J;
}
