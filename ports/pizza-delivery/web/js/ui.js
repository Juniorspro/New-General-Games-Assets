/* Las pantallas (idioma, menú, ajustes, controles, créditos, pausa, cargando) y los subtítulos. */
import { D, guardar } from './guardado.js';
import { t, IDIOMAS, traducir } from './textos.js';

const $ = (s) => document.querySelector(s);
export function crearUI(A) {
  const P = $('#pantallas');
  const U = { actual: null, traducir };
  const titulo = () => `<h1 class="titulo">PIZZA DELIVERY</h1><p class="sub">${t('sub')}</p>`;
  const boton = (id, txt, extra = '') => `<button data-b="${id}" ${extra}>${txt}</button>`;
  const fila = (txt, ctl) => `<label class="fila"><span>${txt}</span>${ctl}</label>`;
  const desliz = (id, min, max, paso, v) => `<input type="range" data-a="${id}" min="${min}" max="${max}" step="${paso}" value="${v}">`;
  const sino = (id, v) => `<button class="sino ${v ? 'si' : ''}" data-s="${id}">${v ? t('si') : t('no')}</button>`;
  const PANT = {
    cargando: () => `<p class="cargando">${t('cargando')}</p>`,
    idioma: () => `<div class="botones">${boton('es', 'ESPAÑOL', 'data-i="es"')}${boton('en', 'ENGLISH', 'data-i="en"')}${boton('pt', 'PORTUGUÊS', 'data-i="pt"')}</div>`,
    menu: () => `<div class="botones">${A.enPartida() ? boton('seguir', t('seguir')) : ''}${boton('jugar', A.enPartida() ? t('reiniciar') : t('jugar'))}${boton('controles', t('controles'))}${boton('ajustes', t('ajustes'))}${boton('creditos', t('creditos'))}</div><p class="chico">${t('advertencia')}</p>`,
    pausa: () => `<h2>${t('pausa')}</h2><div class="botones">${boton('seguir', t('seguir'))}${boton('ajustes', t('ajustes'))}${boton('controles', t('controles'))}${boton('menu', t('menu'))}</div>`,
    ajustes: () => `<h2>${t('ajustes')}</h2><div class="panel">
      ${fila(t('sens'), desliz('sens', 0.3, 2.5, 0.05, D.ajustes.sens))}
      ${fila(t('invertir'), sino('invertir', D.ajustes.invertir))}
      ${fila(t('brillo'), desliz('brillo', 0.7, 2.5, 0.05, D.ajustes.brillo))}
      ${fila(t('gamma'), sino('gamma', D.ajustes.gamma))}
      ${fila(t('musica'), desliz('volumen', 0, 1, 0.05, D.ajustes.volumen))}
      ${fila(t('calidad'), `<span class="grupo">${['baja', 'media', 'alta'].map((c) => `<button class="opc ${D.ajustes.calidad === c ? 'si' : ''}" data-c="${c}">${t(c)}</button>`).join('')}</span>`)}
      ${fila(t('subs'), sino('subsGrandes', D.ajustes.subsGrandes))}
      ${fila(t('vibrar'), sino('vibrar', D.ajustes.vibrar))}
      ${fila(t('idioma'), `<span class="grupo">${IDIOMAS.map((i) => `<button class="opc ${D.idioma === i ? 'si' : ''}" data-i="${i}">${i.toUpperCase()}</button>`).join('')}</span>`)}
      </div><div class="botones">${boton('volver', t('volver'))}</div>`,
    creditos: () => `<h2>${t('creditos')}</h2><div class="panel texto">${t('creditosTxt')}</div><div class="botones">${boton('volver', t('volver'))}</div>`,
    controles: () => `<div class="editor"><p>${t('editor')}</p>
      ${fila(t('tam'), desliz('tam', 0.5, 1.8, 0.05, A.controles.sel ? A.controles.cfg.b[A.controles.sel].tam : 1))}
      ${fila(t('opacidad'), desliz('opacidad', 0.2, 1, 0.05, A.controles.cfg.opacidad))}
      ${fila(t('zurdo'), sino('zurdo', A.controles.cfg.zurdo))}
      <div class="botones fila2">${boton('fabrica', t('fabrica'))}${boton('volver', t('listo'))}</div></div>`,
  };
  U.mostrar = (n) => {
    U.actual = n;
    P.className = n ? `p-${n}` : '';
    P.innerHTML = n ? `<div class="caja">${PANT[n]()}</div>` : '';
    document.body.classList.toggle('en-menu', !!n && n !== 'controles');
    A.controles.editar(n === 'controles');
    if (n === 'controles') A.controles.alElegir = () => { const r = P.querySelector('[data-a="tam"]'); if (r) r.value = A.controles.cfg.b[A.controles.sel].tam; };
  };
  P.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    A.sonido.iniciar(); A.sonido.clic();
    if (b.dataset.i) { D.idioma = b.dataset.i; guardar(); A.alIdioma(); U.mostrar(U.actual === 'idioma' ? 'menu' : U.actual); return; }
    if (b.dataset.c) { D.ajustes.calidad = b.dataset.c; guardar(); A.alCalidad(); U.mostrar(U.actual); return; }
    if (b.dataset.s) {
      const k = b.dataset.s;
      if (k === 'zurdo') A.controles.zurdo(!A.controles.cfg.zurdo);
      else { D.ajustes[k] = !D.ajustes[k]; guardar(); if (k === 'subsGrandes') document.body.classList.toggle('subs-grandes', D.ajustes.subsGrandes); }
      U.mostrar(U.actual); return;
    }
    const id = b.dataset.b;
    if (id === 'jugar') A.jugar();
    else if (id === 'seguir') A.seguir();
    else if (id === 'menu') A.alMenu();
    else if (['ajustes', 'controles', 'creditos'].includes(id)) { U.previa = U.actual; U.mostrar(id); }
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
  /* subtítulos (el GUI.Button de abajo del original) */
  const sub = $('#subtitulo'), ayuda = $('#ayuda');
  U.subtitulo = (txt) => { const tt = traducir(txt); sub.textContent = tt; sub.classList.toggle('ve', !!tt); sub.classList.toggle('otro', !!tt && tt.startsWith('>')); };
  U.ayuda = (tactil) => { ayuda.textContent = tactil ? t('ayudaTacto') : t('ayudaTeclas'); ayuda.classList.add('ve'); clearTimeout(U.tA); U.tA = setTimeout(() => ayuda.classList.remove('ve'), 8000); };
  U.vibrar = (ms) => { if (!D.ajustes.vibrar) return; try { if (window.PizzaNativo) window.PizzaNativo.vibrar(ms); else navigator.vibrate?.(ms); } catch { /* */ } };
  document.body.classList.toggle('subs-grandes', !!D.ajustes.subsGrandes);
  return U;
}
