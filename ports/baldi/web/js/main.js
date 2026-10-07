/* Baldi's Basics Classic en el navegador: intro de JXStudios mientras carga, el idioma (lo único que se
   elige, encima de la primera pantalla del juego difuminada) y después el juego tal cual, desde la
   advertencia del original. Todo corre en el "Unity chiquito" de motor.js/mundo.js. */
import * as THREE from 'three';
import { Mundo } from './mundo.js';
import { PlayerPrefs } from './motor.js';
import { traer, prepararEmbebidos } from './archivos.js';
import { recursosDibujo, Render } from './render.js';
import { Fisica } from './fisica.js';
import { Nav } from './nav.js';
import { Sonido } from './sonido.js';
import { Animacion } from './anim.js';
import { UI } from './ui.js';
import { Entrada } from './entrada.js';
import { U } from './unity.js';
import { T } from './textos.js';
import { P, revisarGiro, completa } from './pantalla.js';
import './guiones/escuela.js';
import './guiones/menus.js';

const BASE = '';
const lienzo = document.getElementById('lienzo'), lienzoUI = document.getElementById('ui');
const pant = document.getElementById('pantallas');
let idioma = (() => { try { return localStorage.getItem('baldi.idioma'); } catch { return null; } })();
if (!idioma) { const l = (navigator.language || 'es').toLowerCase(); idioma = l.startsWith('pt') ? 'pt' : l.startsWith('en') ? 'en' : 'es'; }
const t = (k) => T[idioma]?.[k] ?? T.es[k];

function intro() {
  return new Promise((ok) => {
    const el = document.getElementById('intro'); el.hidden = false;
    el.querySelector('.presenta').textContent = t('presenta');
    el.querySelector('.creditos').textContent = t('creditos');
    let hecho = false;
    const salir = () => { if (hecho) return; hecho = true; el.classList.add('fuera'); setTimeout(() => { el.hidden = true; ok(); }, 550); };
    const tm = setTimeout(salir, 4300);
    el.addEventListener('pointerdown', () => { clearTimeout(tm); salir(); }, { once: true });
  });
}

// el idioma, encima del juego que ya se ve (difuminado)
function elegirIdioma() {
  return new Promise((ok) => {
    const nombres = { es: 'Español', en: 'English', pt: 'Português' };
    const pintar = () => {
      pant.innerHTML = `<div class="caja"><h1>${t('idioma')}</h1><div class="idiomas">${['es', 'en', 'pt'].map((l) => `<button data-l="${l}"${l === idioma ? ' autofocus' : ''}>${nombres[l]}</button>`).join('')}</div><p class="aviso">${t('creditos')}</p></div>`;
    };
    pintar(); pant.hidden = false;
    pant.querySelector(`[data-l="${idioma}"]`)?.focus();
    pant.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-l]'); if (!b) return;
      idioma = b.dataset.l; try { localStorage.setItem('baldi.idioma', idioma); } catch { /* sin guardado */ }
      pant.hidden = true; pant.innerHTML = '';
      ok();
    });
  });
}

let mundo, renderer, eligiendo = true, ocupado = false, ult = 0;
function tam() {
  revisarGiro();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr); renderer.setSize(P.W, P.H, false);
  return [Math.round(P.W * dpr), Math.round(P.H * dpr)];
}
function dibujar() {
  const [W, H] = tam();
  mundo.render.ancho = W; mundo.render.alto = H;
  mundo.render.dibujar();
  mundo.ui.idioma = idioma;
  mundo.ui.dibujar(W, H);
}
async function cuadro(ts) {
  requestAnimationFrame(cuadro);
  const dt = ult ? (ts - ult) / 1000 : 1 / 60; ult = ts;
  if (ocupado) return;
  ocupado = true;
  try {
    if (eligiendo) { dibujar(); return; }
    await mundo.paso(dt);
  } catch (e) { console.error(e); } finally { ocupado = false; }
}

async function arrancar() {
  const vIntro = intro();
  await prepararEmbebidos(() => {});
  const [C, BIN] = await Promise.all([traer(BASE + 'datos/comun.json', 'json'), traer(BASE + 'datos/mallas.bin', 'arrayBuffer')]);
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance' });
  renderer.autoClear = true;
  const R = recursosDibujo(BASE, C, BIN, renderer);
  const clips = {};
  R.clip = (id) => clips[id] || (clips[id] = { id, name: C.audios[id]?.nombre || id, length: C.audios[id]?.dur || 0 });
  mundo = new Mundo(BASE, C, R);
  U.mundo = mundo;
  mundo.entrada = new Entrada(lienzoUI);
  mundo.fisica = mundo.sistema(new Fisica(C));
  mundo.nav = mundo.sistema(new Nav(BASE));
  mundo.sonido = mundo.sistema(new Sonido(BASE));
  mundo.render = mundo.sistema(new Render(renderer, R));
  mundo.sistema(new Animacion());
  mundo.ui = mundo.sistema(new UI(lienzoUI, mundo));
  mundo.ui.giro = (cx, cy) => { const p = P.xy(cx, cy); return { x: p.x, y: p.y, w: P.W, h: P.H }; };
  mundo.entrada.ui = mundo.ui;
  mundo.sistema({ antesDelCuadro: () => mundo.entrada.calcular(), finDelCuadro: () => { dibujar(); mundo.entrada.finCuadro(); mundo.ui.finCuadro(); } });
  await mundo.ui.cargarFuentes(C, BASE);
  // la primera vez el menú de opciones guarda la sensibilidad (2); por las dudas, desde ya
  if (!PlayerPrefs.HasKey('MouseSensitivity')) PlayerPrefs.SetFloat('MouseSensitivity', 2);
  await mundo.cargarEscena(0);
  window.__baldi = { mundo, U, C, R, THREE };
  requestAnimationFrame(cuadro);
  await vIntro;
  await elegirIdioma();
  mundo.sonido.iniciar();
  completa();
  await mundo.sonido.cargar(Object.keys(C.audios).filter((id) => C.audios[id].ok));
  eligiendo = false;
  window.__baldi.listo = true;
}
addEventListener('resize', () => { if (renderer) tam(); });
// sin foco el audio se apaga (y vuelve al tocar)
document.addEventListener('visibilitychange', () => { const c = mundo?.sonido?.ctx; if (!c) return; if (document.hidden) c.suspend(); else c.resume(); });
addEventListener('pointerdown', () => mundo?.sonido?.iniciar());
arrancar().catch((e) => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:8px;bottom:8px;color:#f66;z-index:99">${String(e?.stack || e).slice(0, 600)}</pre>`); });
