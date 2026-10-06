/* Las pantallas (idioma, menú, ajustes, controles, créditos, pausa, final) y el HUD
   (el contador de arriba a la derecha y el aviso del centro, como los GUIText del original). */
import { D, guardar } from './guardado.js';
import { t, IDIOMAS } from './textos.js';

const $ = (s) => document.querySelector(s);
export function crearUI(A) {
  const P = $('#pantallas');
  const U = { actual: null };
  const titulo = () => `<h1 class="titulo" data-t="BUS STOP SIMULATOR">BUS STOP SIMULATOR</h1><p class="sub">BETA 1.0.1 · port</p>`;
  const boton = (id, txt, extra = '') => `<button data-b="${id}" ${extra}>${txt}</button>`;
  const fila = (txt, ctl) => `<label class="fila"><span>${txt}</span>${ctl}</label>`;
  const desliz = (id, min, max, paso, v) => `<input type="range" data-a="${id}" min="${min}" max="${max}" step="${paso}" value="${v}">`;
  const sino = (id, v) => `<button class="sino ${v ? 'si' : ''}" data-s="${id}">${v ? t('si') : t('no')}</button>`;

  const PANT = {
    cargando: () => `${titulo()}<div class="barra"><i style="width:${Math.round((U.prog || 0) * 100)}%"></i></div><p class="chico">${t('cargando')}</p>`,
    idioma: () => `${titulo()}<div class="botones">${boton('es', 'ESPAÑOL', 'data-i="es"')}${boton('en', 'ENGLISH', 'data-i="en"')}${boton('pt', 'PORTUGUÊS', 'data-i="pt"')}</div>`,
    menu: () => `${titulo()}<div class="botones">${A.enPartida() ? boton('seguir', t('seguir')) : ''}${boton('jugar', A.enPartida() ? t('reiniciar') : t('jugar'))}${boton('controles', t('controles'))}${boton('ajustes', t('ajustes'))}${boton('creditos', t('creditos'))}</div>
      ${D.record ? `<p class="chico">${t('record')}: ${reloj(D.record)}</p>` : ''}`,
    pausa: () => `<h2>${t('pausa')}</h2><div class="botones">${boton('seguir', t('seguir'))}${boton('jugar', t('reiniciar'))}${boton('ajustes', t('ajustes'))}${boton('controles', t('controles'))}${boton('menu', t('menu'))}</div>`,
    ajustes: () => `<h2>${t('ajustes')}</h2><div class="panel">
      ${fila(t('sens'), desliz('sens', 0.3, 2.5, 0.05, D.ajustes.sens))}
      ${fila(t('invertir'), sino('invertir', D.ajustes.invertir))}
      ${fila(t('brillo'), desliz('brillo', 0.7, 2.2, 0.05, D.ajustes.brillo))}
      ${fila(t('musica'), desliz('volumen', 0, 1, 0.05, D.ajustes.volumen))}
      ${fila(t('calidad'), `<span class="grupo">${['baja', 'media', 'alta'].map((c) => `<button class="opc ${D.ajustes.calidad === c ? 'si' : ''}" data-c="${c}">${t(c)}</button>`).join('')}</span>`)}
      ${fila(t('correrFijo'), sino('correrFijo', D.ajustes.correrFijo))}
      ${fila(t('vibrar'), sino('vibrar', D.ajustes.vibrar))}
      ${fila(t('idioma'), `<span class="grupo">${IDIOMAS.map((i) => `<button class="opc ${D.idioma === i ? 'si' : ''}" data-i="${i}">${i.toUpperCase()}</button>`).join('')}</span>`)}
      </div><div class="botones">${boton('volver', t('volver'))}</div>`,
    creditos: () => `<h2>${t('creditos')}</h2><div class="panel texto">${t('creditosTxt')}</div><div class="botones">${boton('volver', t('volver'))}</div>`,
    controles: () => `<div class="editor"><p>${t('editor')}</p>
      ${fila(t('tam'), desliz('tam', 0.5, 1.8, 0.05, A.controles.sel ? A.controles.cfg.b[A.controles.sel].tam : 1))}
      ${fila(t('opacidad'), desliz('opacidad', 0.2, 1, 0.05, A.controles.cfg.opacidad))}
      ${fila(t('zurdo'), sino('zurdo', A.controles.cfg.zurdo))}
      <div class="botones fila2">${boton('fabrica', t('fabrica'))}${boton('volver', t('listo'))}</div></div>`,
    final: () => `<div class="fin"><h2 class="glitchy" data-t="${t('fin2')}">${t('fin2')}</h2>
      <p>${t('tiempo')}: ${reloj(A.juego.tiempo)} · ${t('muertes')}: ${A.juego.muertes}${D.record ? ` · ${t('record')}: ${reloj(D.record)}` : ''}</p>
      <div class="botones">${boton('jugar', t('finBoton'))}${boton('menu', t('menu'))}</div></div>`,
  };
  const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  U.mostrar = (n, volverA) => {
    U.actual = n; U.volverA = volverA || U.volverA;
    P.className = n ? `p-${n}` : '';
    P.innerHTML = n ? `<div class="caja">${PANT[n]()}</div>` : '';
    document.body.classList.toggle('en-menu', !!n && n !== 'controles');
    A.controles.editar(n === 'controles');
    if (n === 'controles') A.controles.alElegir = () => { const r = P.querySelector('[data-a="tam"]'); if (r) r.value = A.controles.cfg.b[A.controles.sel].tam; };
  };
  U.progreso = (p) => { U.prog = p; const i = P.querySelector('.barra i'); if (i) i.style.width = Math.round(p * 100) + '%'; };

  P.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    A.sonido.iniciar(); A.sonido.glitch(0.06, 0.06);
    if (b.dataset.i) { D.idioma = b.dataset.i; guardar(); A.alIdioma(); U.mostrar(U.actual === 'idioma' ? 'menu' : U.actual); return; }
    if (b.dataset.c) { D.ajustes.calidad = b.dataset.c; guardar(); A.alCalidad(); U.mostrar(U.actual); return; }
    if (b.dataset.s) {
      const k = b.dataset.s;
      if (k === 'zurdo') A.controles.zurdo(!A.controles.cfg.zurdo);
      else { D.ajustes[k] = !D.ajustes[k]; guardar(); }
      U.mostrar(U.actual); return;
    }
    const id = b.dataset.b;
    if (id === 'jugar') A.jugar();
    else if (id === 'seguir') A.seguir();
    else if (id === 'menu') A.alMenu();
    else if (id === 'ajustes' || id === 'controles' || id === 'creditos') { U.previa = U.actual; U.mostrar(id); }
    else if (id === 'fabrica') { A.controles.fabrica(); U.mostrar('controles'); }
    else if (id === 'volver') U.mostrar(U.previa || 'menu');
  });
  P.addEventListener('input', (e) => {
    const r = e.target.closest('input[type=range]');
    if (!r) return;
    const k = r.dataset.a, v = +r.value;
    if (k === 'tam') A.controles.tam(v);
    else if (k === 'opacidad') A.controles.opacidad(v);
    else { D.ajustes[k] = v; guardar(); if (k === 'volumen') A.sonido.volumen(v); if (k === 'brillo') A.alBrillo(); }
  });

  /* HUD */
  const cont = $('#contador'), prompt = $('#prompt'), aviso = $('#aviso'), fx = $('#efecto'), ayuda = $('#ayuda');
  U.hud = (j) => {
    cont.textContent = j.juntadas >= 1 ? t('contador', { n: j.juntadas }) : '';
    const p = j.estado === 'jugando' ? (j.mirando === 'malla' ? t('juntar') : j.mirando === 'bus' ? t('sentarse') : '') : '';
    if (prompt.textContent !== p) prompt.textContent = p;
    A.controles.puedeUsar(!!j.mirando);
  };
  let tAviso = 0;
  U.aviso = (k, seg = 6) => { aviso.textContent = t(k); aviso.classList.add('ve'); clearTimeout(tAviso); tAviso = setTimeout(() => aviso.classList.remove('ve'), seg * 1000); };
  U.muerte = (porque) => {
    fx.classList.remove('muerte'); void fx.offsetWidth; fx.classList.add('muerte');
    clearTimeout(U.tFx); U.tFx = setTimeout(() => fx.classList.remove('muerte'), 1200);
    U.aviso(porque === 'caida' ? 'caida' : 'muerte', 3);
    U.vibrar(300);
  };
  U.ayuda = (tactil) => { ayuda.textContent = tactil ? t('ayudaTacto') : t('ayudaTeclas'); ayuda.classList.add('ve'); setTimeout(() => ayuda.classList.remove('ve'), 7000); };
  U.vibrar = (ms) => { if (!D.ajustes.vibrar) return; try { if (window.BusStopNativo) window.BusStopNativo.vibrar(ms); else navigator.vibrate?.(ms); } catch { /* */ } };
  U.fin = () => { prompt.textContent = ''; fx.classList.remove('muerte'); void fx.offsetWidth; fx.classList.add('muerte'); clearTimeout(U.tFx); U.tFx = setTimeout(() => fx.classList.remove('muerte'), 1200); };
  return U;
}
