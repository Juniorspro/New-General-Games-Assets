/* TJOC:SM en el navegador/APK: idioma, arranque del motor, cambios de nivel con pantalla de carga,
   controles táctiles y ajustes (sensibilidad, brillo, tamaño y lugar de los botones). */
import { crearJuego } from './juego.js';
import { Controles } from './controles.js';
import { IDIOMAS, ponerIdioma, t, cargarTabla, traducir } from './textos.js';

const CLAVE = 'tjoc.ajustes';
let aj = {}; try { aj = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch { aj = {}; }
const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(aj)); } catch { /* sin almacenamiento */ } };
const $ = (s) => document.querySelector(s);
const NIVEL_INICIAL = 'SM_Warning';

function pantallaIdioma() {
  return new Promise((ok) => {
    const p = $('#idioma'); p.hidden = false;
    const lista = p.querySelector('.idiomas'); lista.innerHTML = '';
    for (const [k, n] of Object.entries(IDIOMAS)) {
      const b = document.createElement('button'); b.textContent = n; b.onclick = () => { aj.idioma = k; guardar(); p.hidden = true; ok(); };
      lista.appendChild(b);
    }
    p.querySelector('.aviso').textContent = t('aviso');
  });
}
function tocarParaEmpezar() {
  return new Promise((ok) => { const p = $('#empezar'); p.hidden = false; p.querySelector('span').textContent = t('tocar'); p.querySelector('.aviso').textContent = t('aviso'); p.onclick = () => { p.hidden = true; ok(); }; });
}
async function fuentes() {
  try {
    const ui = await (await fetch('datos/ui.json')).json();
    for (const [r, f] of Object.entries(ui.fuentes || {})) {
      const fam = /Sufficit/.test(r) ? 'Sufficit' : /Eight_Days/.test(r) ? 'EightDays' : null;
      if (fam) { const ff = new FontFace(fam, `url(datos/${f})`); document.fonts.add(await ff.load()); }
    }
  } catch { /* sin fuentes */ }
}
async function main() {
  await fuentes();
  if (!aj.idioma) await pantallaIdioma();
  ponerIdioma(aj.idioma);
  await tocarParaEmpezar();
  const carga = $('#carga'); carga.hidden = false; carga.querySelector('span').textContent = t('cargando');
  await cargarTabla('datos/');
  const J = await crearJuego({ contenedor: $('#juego'), opciones: { k: aj.brillo ?? 1.3 } });
  window.__tjoc = { J, listo: false };
  const M = J.M;
  M.audio.iniciar();
  M.textos = (src) => traducir(src);
  M.ui.umg.idioma = aj.idioma;
  const ctl = new Controles($('#juego'), M, aj, guardar);
  const ALIAS = { SM_Outside: 'SMMenu' };
  M.alAbrirNivel = async (n) => {
    n = ALIAS[n] || n;
    carga.hidden = false;
    try { await M.cargarNivel(n); }
    catch (e) { console.error('nivel', n, e?.stack || e); if (n !== 'SMMenu') { await M.cargarNivel('SMMenu'); } }
    carga.hidden = true;
  };
  M.alSalir = () => { M.abrirNivel('SMMenu'); };
  window.__atras = () => { M.tecla('Escape', true); setTimeout(() => M.tecla('Escape', false), 80); };
  // ajustes
  const panel = $('#ajustes');
  $('#engranaje').onclick = () => { panel.hidden = !panel.hidden; pintarAjustes(); };
  function pintarAjustes() {
    panel.innerHTML = `<h2>${t('ajustes')}</h2>
      <label>${t('sens')} <input type="range" min="0.3" max="3" step="0.1" id="aj-sens" value="${aj.sens ?? 1}"></label>
      <label>${t('brillo')} <input type="range" min="0.6" max="3" step="0.1" id="aj-brillo" value="${aj.brillo ?? 1.3}"></label>
      <label>${t('tam')} <input type="range" min="0.6" max="1.8" step="0.1" id="aj-tam" value="${aj.tamBotones ?? 1}"></label>
      <div class="fila"><button id="aj-editar">${t('editar')}</button><button id="aj-rest">${t('restablecer')}</button></div>
      <div class="fila">${Object.entries(IDIOMAS).map(([k, n]) => `<button class="${k === aj.idioma ? 'sel' : ''}" data-i="${k}">${n}</button>`).join('')}</div>
      <button id="aj-volver">${t('volver')}</button>`;
    panel.querySelector('#aj-sens').oninput = (e) => { aj.sens = +e.target.value; guardar(); };
    panel.querySelector('#aj-brillo').oninput = (e) => { aj.brillo = +e.target.value; J.post.k = aj.brillo; guardar(); };
    panel.querySelector('#aj-tam').oninput = (e) => { aj.tamBotones = +e.target.value; guardar(); ctl.relayout(); };
    panel.querySelector('#aj-editar').onclick = () => { panel.hidden = true; ctl.editar(true); $('#fin-editar').hidden = false; };
    panel.querySelector('#aj-rest').onclick = () => ctl.restablecer();
    panel.querySelector('#aj-volver').onclick = () => { panel.hidden = true; };
    for (const b of panel.querySelectorAll('[data-i]')) b.onclick = () => { aj.idioma = b.dataset.i; ponerIdioma(aj.idioma); M.ui.umg.idioma = aj.idioma; guardar(); M.ui.umg.relayout(); for (const w of M.ui.umg.activos) for (const x of w.widgets.values()) M.ui.umg.estilo(x); ctl.clave = null; ctl.actualizarBotones(); pintarAjustes(); };
  }
  $('#fin-editar').onclick = () => { ctl.editar(false); $('#fin-editar').hidden = true; };
  $('#fin-editar').textContent = t('listo');
  addEventListener('resize', () => ctl.relayout());
  await M.cargarNivel(new URLSearchParams(location.search).get('n') || NIVEL_INICIAL);
  carga.hidden = true;
  window.__tjoc.listo = true;
}
main();
