/* Las pantallas del port (idioma, inicio, ajustes, controles, pausa, cargando) y la capa del OnGUI del
   original: las imágenes a pantalla completa (GUI.DrawTexture), el botón de volver al menú, la caja de
   calidad, la ventana de personalizar el personaje y el botón de empezar (la E). */
import { D, guardar } from './guardado.js';
import { t, IDIOMAS } from './textos.js';

const $ = (s) => document.querySelector(s);
export function crearUI(A) {
  const P = $('#pantallas'), GUI = $('#gui'), VEN = $('#ventanas');
  const U = { actual: null };
  const boton = (id, txt, extra = '') => `<button data-b="${id}" ${extra}>${txt}</button>`;
  const fila = (txt, ctl) => `<label class="fila"><span>${txt}</span>${ctl}</label>`;
  const desliz = (id, min, max, paso, v) => `<input type="range" data-a="${id}" min="${min}" max="${max}" step="${paso}" value="${v}">`;
  const sino = (id, v) => `<button class="sino ${v ? 'si' : ''}" data-s="${id}">${v ? t('si') : t('no')}</button>`;
  const PANT = {
    cargando: () => `<p class="cargando">${t('cargando')}<span class="barra"><i style="width:${Math.round((U.progreso || 0) * 100)}%"></i></span></p>`,
    idioma: () => `<div class="logo">SLENDYTUBBIES <em>V2</em></div><div class="botones">${boton('es', 'ESPAÑOL', 'data-i="es"')}${boton('en', 'ENGLISH', 'data-i="en"')}${boton('pt', 'PORTUGUÊS', 'data-i="pt"')}</div><p class="aviso chico">${t('aviso')}</p>`,
    tocar: () => `<div class="logo">SLENDYTUBBIES <em>V2</em></div><p class="aviso">${t('aviso')}</p><p class="aviso rojo">${t('terror')}</p><div class="botones">${boton('empezar', t('tocar'))}</div>`,
    pausa: () => `<h2>${t('pausa')}</h2><div class="botones">${boton('seguir', t('seguir'))}${boton('ajustes', t('ajustes'))}${boton('controles', t('controles'))}${boton('menu', t('menu'))}</div>`,
    ajustes: () => `<h2>${t('ajustes')}</h2><div class="panel">
      ${fila(t('sens'), desliz('sens', 0.3, 2.5, 0.05, D.ajustes.sens))}
      ${fila(t('invertir'), sino('invertir', D.ajustes.invertir))}
      ${fila(t('brillo'), desliz('brillo', 0.6, 2.5, 0.05, D.ajustes.brillo))}
      ${fila(t('volumen'), desliz('volumen', 0, 1, 0.05, D.ajustes.volumen))}
      ${fila(t('calidad'), `<span class="grupo">${['baja', 'media', 'alta'].map((c) => `<button class="opc ${D.ajustes.calidad === c ? 'si' : ''}" data-c="${c}">${t(c)}</button>`).join('')}</span>`)}
      ${fila(t('vibrar'), sino('vibrar', D.ajustes.vibrar))}
      ${fila(t('idioma'), `<span class="grupo">${IDIOMAS.map((i) => `<button class="opc ${D.idioma === i ? 'si' : ''}" data-i="${i}">${i.toUpperCase()}</button>`).join('')}</span>`)}
      </div><div class="botones">${boton('controles', t('controles'))}${boton('volver', t('volver'))}</div>`,
    controles: () => `<div class="editor"><p>${t('editor')}</p>
      ${fila(t('tam'), desliz('tam', 0.5, 1.8, 0.05, A.controles.sel ? A.controles.cfg.b[A.controles.sel].tam : 1))}
      ${fila(t('opacidad'), desliz('opacidad', 0.2, 1, 0.05, A.controles.cfg.opacidad))}
      ${fila(t('zurdo'), sino('zurdo', A.controles.cfg.zurdo))}
      <div class="botones fila2">${boton('fabrica', t('fabrica'))}${boton('volver', t('listo'))}</div></div>`,
  };
  U.mostrar = (n) => {
    if (n !== U.actual && n && !['ajustes', 'controles'].includes(n)) U.base = n;
    U.actual = n;
    P.className = n ? `p-${n}` : '';
    P.innerHTML = n ? `<div class="caja">${PANT[n]()}</div>` : '';
    document.body.classList.toggle('con-pantalla', !!n && n !== 'controles');
    A.controles.editar(n === 'controles');
    if (n === 'controles') A.controles.alElegir = () => { const r = P.querySelector('[data-a="tam"]'); if (r) r.value = A.controles.cfg.b[A.controles.sel].tam; };
  };
  U.progreso = 0;
  U.avance = (x) => { U.progreso = x; const b = P.querySelector('.barra i'); if (b) b.style.width = Math.round(x * 100) + '%'; };
  P.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    A.sonido.iniciar(); A.sonido.clic();
    if (b.dataset.i) { D.idioma = b.dataset.i; guardar(); A.alIdioma(); if (U.actual === 'idioma') A.trasIdioma(); else U.mostrar(U.actual); return; }
    if (b.dataset.c) { D.ajustes.calidad = b.dataset.c; guardar(); A.alCalidad(); U.mostrar(U.actual); return; }
    if (b.dataset.s) {
      const k = b.dataset.s;
      if (k === 'zurdo') A.controles.zurdo(!A.controles.cfg.zurdo);
      else { D.ajustes[k] = !D.ajustes[k]; guardar(); }
      U.mostrar(U.actual); return;
    }
    const id = b.dataset.b;
    if (id === 'empezar') A.empezar();
    else if (id === 'seguir') A.seguir();
    else if (id === 'menu') A.alMenu();
    else if (id === 'ajustes' || id === 'controles') { U.previa = U.actual; U.mostrar(id); }
    else if (id === 'fabrica') { A.controles.fabrica(); U.mostrar('controles'); }
    else if (id === 'volver') A.volver(U.previa);
  });
  P.addEventListener('input', (e) => {
    const r = e.target.closest('input[type=range]');
    if (!r) return;
    const k = r.dataset.a, v = +r.value;
    if (k === 'tam') A.controles.tam(v);
    else if (k === 'opacidad') A.controles.opacidad(v);
    else { D.ajustes[k] = v; guardar(); if (k === 'volumen') A.sonido.volumen(v); if (k === 'brillo') A.alBrillo(); }
  });

  /* ---------- el OnGUI del original */
  const vivas = new Map();
  U.gui = (lista) => {
    const ahora = new Set();
    for (const g of lista) {
      ahora.add(g);
      if (!vivas.has(g)) { const im = document.createElement('img'); im.src = A.imagenIdioma(g); im.alt = ''; GUI.appendChild(im); vivas.set(g, im); }
    }
    for (const [g, im] of vivas) if (!ahora.has(g)) { im.remove(); vivas.delete(g); }
  };
  U.limpiarGUI = () => { for (const [, im] of vivas) im.remove(); vivas.clear(); VEN.innerHTML = ''; };
  U.reidiomar = () => { for (const [g, im] of vivas) im.src = A.imagenIdioma(g); };
  const ventana = (id, html) => { let v = VEN.querySelector(`[data-v="${id}"]`); if (!html) { v?.remove(); return null; } if (!v) { v = document.createElement('div'); v.dataset.v = id; VEN.appendChild(v); } v.className = 'unity ' + id; v.innerHTML = html; return v; };
  U.botonVolver = (si) => { const v = ventana('volver', si ? `<button>${t('volverMenu')}</button>` : null); if (v) v.querySelector('button').onclick = () => A.alMenu(); };
  U.calidadUnity = (si) => {
    const v = ventana('calidad', si ? `<div class="caja-u"><p>${t('calidadUnity')}</p>${t('calidades').map((c, k) => `<button data-q="${k}">${c}</button>`).join('')}</div>` : null);
    if (v) v.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = +b.dataset.q; D.ajustes.calidad = k < 2 ? 'baja' : k < 4 ? 'media' : 'alta'; guardar(); A.alCalidad(); };
  };
  U.empezar = (si) => { U.hayEmpezar = si; A.alBotones(); };
  U.personalizar = (si, aplicar) => {
    if (!si) { ventana('personalizar', null); return; }
    const COL = ['#c8242b', '#7a3fb0', '#3e9a3a', '#e3c832', '#f2f2f2'];
    const elegido = { ...(D.colores || {}) };
    let abierta = false;
    const pintar = () => {
      const v = ventana('personalizar', `<button class="abrir">${t('personalizar')}</button>${abierta ? `<div class="caja-u ven"><p>${t('personaje')}</p>${t('partes').map((p, k) => `<span>${p}</span><div>${t('colores').map((c, j) => `<button data-p="${k}" data-c="${j}" class="${elegido[k] === j ? 'si' : ''}" style="--c:${COL[j]}">${c}</button>`).join('')}</div>`).join('')}</div>` : ''}`);
      v.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.classList.contains('abrir')) { if (abierta) { aplicar(elegido); D.colores = elegido; guardar(); ventana('personalizar', null); return; } abierta = true; pintar(); return; }
        elegido[b.dataset.p] = +b.dataset.c; pintar();
      };
    };
    pintar();
  };
  /* GameMenu: el GUILayout del original (la IP es un código de sala) */
  U.red = (o) => {
    if (!o) { ventana('red', null); return; }
    const v = ventana('red', `<input maxlength="4" placeholder="${t('codigo')}" autocapitalize="characters" spellcheck="false"><button data-r="con">${t('conectar')}</button><button data-r="host">${t(o.host)}</button><button data-r="solo">${t('solo')}</button><span class="estado"></span>`);
    const inp = v.querySelector('input');
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    v.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.r === 'con') o.alConectar(inp.value); else if (b.dataset.r === 'host') o.alHost(); else o.solo();
    };
  };
  U.redEstado = (e, x) => { const el = VEN.querySelector('.unity.red .estado'); const txt = t(e).replace('{X}', x || ''); if (el) el.textContent = txt; if (e === 'enSala') U.chat({ sistema: true, t: x }); };
  /* el Chat del original: el botón de abajo a la derecha y la ventana (T la abre) */
  const lineas = [];
  let chatAbierto = false;
  const pintarChat = () => {
    const b = ventana('botonchat', U.chatVisible ? `<button>${chatAbierto ? t('ocultarChat') : t('verChat')}</button>` : null);
    if (b) b.querySelector('button').onclick = () => { chatAbierto = !chatAbierto; pintarChat(); };
    const v = ventana('chat', U.chatVisible && chatAbierto ? `<div class="caja-u"><p>${t('chat')}</p></div><div class="lineas"></div><input maxlength="200">` : null);
    if (!v) return;
    v.classList.add('caja-u');
    const L = v.querySelector('.lineas');
    for (const l of lineas) { const sp = document.createElement('span'); sp.className = l.mio ? 'mio' : 'otro'; sp.textContent = l.sistema ? t('chatSala').replace('{X}', l.t) : l.t; L.appendChild(sp); }
    L.scrollTop = 1e6;
    const inp = v.querySelector('input');
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && inp.value.trim()) { const txt = inp.value.trim(); inp.value = ''; U.chat({ t: txt, mio: true }); A.chatEnviar?.(txt); setTimeout(() => v.querySelector('input')?.focus(), 0); }
      if (e.key === 'Escape') { chatAbierto = false; pintarChat(); }
    });
    if (U.enfocar) { U.enfocar = false; setTimeout(() => inp.focus(), 0); }
  };
  U.chatBoton = (si) => { U.chatVisible = si; if (!si) { chatAbierto = false; lineas.length = 0; } pintarChat(); };
  U.chatAbrir = () => { if (!U.chatVisible) return; chatAbierto = true; U.enfocar = true; if (document.pointerLockElement) document.exitPointerLock(); pintarChat(); };
  U.chat = (l) => { if (!l) { lineas.length = 0; pintarChat(); return; } lineas.push(l); if (lineas.length > 50) lineas.shift(); if (chatAbierto) pintarChat(); };
  U.atrapado = () => A.vibrar(400);
  U.ayuda = (tactil) => { const a = $('#ayuda'); a.textContent = tactil ? t('ayudaTacto') : t('ayudaTeclas'); a.classList.add('ve'); clearTimeout(U.tA); U.tA = setTimeout(() => a.classList.remove('ve'), 9000); };
  return U;
}
