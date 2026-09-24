/* ============================================================================
   aeroplaza/js/ui.js — todas las pantallas y ventanas (HTML encima del lienzo).
   Orden: idioma → aviso → menú de canales → canal Plaza → juego (HUD).
   Encima del juego: pausa, opciones, controles (con el editor de dedos),
   probador, viaje en tren, diálogos con NPC, discos, gestos, mapa y construir.
   Lo que escribe la gente (nombres, chat) va siempre como texto, nunca como HTML.
   ========================================================================== */
import { t, ponerIdioma, idioma, IDIOMAS } from './textos.js';
import { RANURAS, PALETA, PALETA_PELO, loTengo, precio, DE_MISION, MUEBLES } from './catalogo.js';
import { NPCS } from './misiones.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REINOS = [['plaza', '🏝️', 'linear-gradient(160deg,#dfffe6,#d6f2ff)'], ['aqua', '🐬', 'linear-gradient(160deg,#d6f6ff,#b8e8ff)'], ['aurora', '🌌', 'linear-gradient(160deg,#e6dcff,#cfe8ff)'], ['jardin', '🪷', 'linear-gradient(160deg,#ffe6f4,#e0ffe9)'], ['casa', '🏡', 'linear-gradient(160deg,#fff6d6,#e6f6ff)']];
const HOT = [['burbujero', '🫧'], ['gestos', '👋'], ['discos', '💿'], ['foto', '📷'], ['mapa', '🗺️']];
const GESTOS = ['saludar', 'festejar', 'sentarse', 'bailar1', 'bailar2', 'bailar3'];
const CANCIONES = ['titulo', 'colina', 'arrecife', 'ciudad', 'cielo', 'aurora'];

export const UI = {
  J: null, raiz: null, ventanaAbierta: null,
  iniciar(J) {
    this.J = J; this.raiz = document.getElementById('ui');
    /* los sonidos de la interfaz: pasar por encima y elegir */
    this.raiz.addEventListener('pointerover', (e) => { const b = e.target.closest('button'); if (b && b !== this._ult) { this._ult = b; J.sfx('mover'); } });
    this.raiz.addEventListener('click', (e) => { if (e.target.closest('button')) J.sfx('elegir'); });
    document.body.classList.toggle('calidadBaja', J.G.opciones.calidad === 'baja');
  },
  limpiar() { this.raiz.innerHTML = ''; this.hud = null; this.ventanaAbierta = null; },
  poner(nodo) { this.raiz.appendChild(nodo); return nodo; },

  /* ------------------------------------------------------------ idioma */
  idioma(alElegir) {
    this.limpiar();
    const banderas = { es: 'linear-gradient(#74acdf 33%,#fff 33% 66%,#74acdf 66%)', en: 'linear-gradient(135deg,#012169 25%,#fff 25% 30%,#c8102e 30% 45%,#fff 45% 55%,#c8102e 55% 70%,#fff 70% 75%,#012169 75%)', pt: 'radial-gradient(circle,#002776 22%,#ffdf00 23% 44%,#009c3b 45%)' };
    const nombres = { es: 'Español', en: 'English', pt: 'Português' };
    const p = this.poner(el(`<div class="pantalla"><div class="rayado"></div>
      <div style="position:relative;display:flex;flex-direction:column;align-items:center">
        <div class="logo">AERO<span>PLAZA</span></div>
        <div class="subtitulo">Elegí tu idioma · Choose your language · Escolha seu idioma</div>
        <div class="idiomas">${IDIOMAS.map((i) => `<button class="boton" data-i="${i}"><span class="bandera" style="background:${banderas[i]}"></span>${nombres[i]}</button>`).join('')}</div>
      </div></div>`));
    p.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { ponerIdioma(b.dataset.i); alElegir(b.dataset.i); });
    this.focoTeclado(p);
  },
  /* ------------------------------------------------------------ aviso */
  aviso(alSeguir) {
    this.limpiar();
    const tactil = matchMedia('(pointer: coarse)').matches;
    const p = this.poner(el(`<div class="pantalla aviso"><div class="icono">!</div><h1>${t('aviso_titulo')}</h1><p>${t('aviso_texto')}</p><div class="latido">${t(tactil ? 'aviso_seguir' : 'aviso_seguir_pc')}</div><div class="linea-aviso"></div></div>`));
    let hecho = false;
    const seguir = () => { if (hecho) return; hecho = true; removeEventListener('keydown', seguir); alSeguir(); };
    p.addEventListener('pointerdown', seguir); addEventListener('keydown', seguir);
  },
  /* ------------------------------------------------------------ el menú de canales */
  menu() {
    this.limpiar();
    const J = this.J;
    const fondo = window.ARCHIVOS && window.ARCHIVOS['fondo-menu.webp'];
    const canales = [
      ['plaza', `<div class="vista plaza" style="background-image:url(${fondo || ''});background-color:#bfe9ff"></div>${[10, 30, 55, 75, 88].map((x, i) => `<i class="burbujita" style="left:${x}%;animation-delay:${i * 0.9}s"></i>`).join('')}`],
      ['probador', `<div class="vista probador"><div class="muneco" style="--c:${J.G.A.color}"></div></div>`],
      ['salas', `<div class="vista salas"><b class="cuenta-linea">·</b><small>${t('en_linea')}</small></div>`],
      ['casa', `<div class="vista icono"><span>🏡</span></div>`],
      ['discos', `<div class="vista icono"><div class="disco"></div></div>`],
      ['opciones', `<div class="vista icono gira"><span>⚙️</span></div>`],
      ['controles', `<div class="vista icono"><span>🎮</span></div>`],
      ['creditos', `<div class="vista icono"><span style="font-size:.5em;font-weight:900;color:#34bef0">AERO<span style="color:#56d05a">PLAZA</span></span></div>`],
    ];
    const vacios = 12 - canales.length;
    const p = this.poner(el(`<div class="pantalla menu"><div class="rayado"></div>
      <div class="canales" style="position:relative">${canales.map(([id, v]) => `<button class="canal" data-c="${id}">${v}<div class="nombre">${t('canal_' + id)}</div></button>`).join('')}${'<div class="canal vacio"></div>'.repeat(vacios)}</div>
      <div class="barra-abajo"><svg viewBox="0 0 1000 150" preserveAspectRatio="none"><path d="M0 40 Q 180 40 250 70 Q 320 100 500 100 Q 680 100 750 70 Q 820 40 1000 40 L1000 150 L0 150 Z" fill="#f4f6f8" stroke="#d9dde1" stroke-width="3"/></svg>
        <div class="reloj">--:--</div><div class="fecha"></div>
        <div class="izq"><button class="redondo" data-c="plaza" title="AEROPLAZA">A·P</button></div>
        <div class="der"><button class="redondo" data-c="salas"><span class="punto ${J.red.estado}"></span></button></div></div></div>`));
    p.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => this.abrirCanal(b.dataset.c, b));
    const reloj = () => {
      if (!p.isConnected) return;
      const d = new Date(), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
      $('.reloj', p).textContent = J.G.opciones.reloj24 ? `${h}:${m}` : `${(h % 12) || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
      $('.fecha', p).textContent = d.toLocaleDateString(idioma() === 'en' ? 'en-US' : idioma() === 'pt' ? 'pt-BR' : 'es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' });
      $('.cuenta-linea', p).textContent = J.red.estado === 'en_linea' ? String(J.red.cuantosEn() + 1) : '·';
      $('.der .punto', p).className = 'punto ' + J.red.estado;
      setTimeout(reloj, 1000);
    };
    reloj();
    this.focoTeclado(p);
    J.musica('titulo');
  },
  /* el zoom al canal: el cuadrito se agranda hasta ocupar la pantalla */
  abrirCanal(id, desde) {
    const J = this.J;
    if (id === 'opciones') return this.opciones();
    if (id === 'controles') return this.controles();
    if (id === 'discos') return this.discos();
    if (id === 'creditos') return this.creditos();
    if (id === 'salas') return this.salas();
    const r = desde.getBoundingClientRect();
    const fondo = window.ARCHIVOS && window.ARCHIVOS['fondo-menu.webp'];
    const titulo = id === 'plaza' ? t('canal_plaza') : id === 'probador' ? t('canal_probador') : t('canal_casa');
    const desc = id === 'plaza' ? t('plaza_desc') : id === 'probador' ? t('prob_titulo') : t('reino_casa_d');
    const vista = id === 'plaza' ? `<div class="vista plaza" style="background-image:url(${fondo || ''});background-color:#bfe9ff"></div>` : id === 'probador' ? `<div class="vista probador"><div class="muneco" style="--c:${J.G.A.color};width:18%"></div></div>` : `<div class="vista icono" style="font-size:20vmin">🏡</div>`;
    const c = this.poner(el(`<div class="canal-abierto"><div class="grande">${vista}<div class="titulo-canal">${titulo}</div><div class="desc">${esc(desc)}</div></div>
      <div class="pie"><button class="boton" data-a="menu">${t('menu')}</button><button class="boton primario" data-a="empezar">${t('empezar')}</button></div></div>`));
    c.animate([{ clipPath: `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px round 18px)` }, { clipPath: 'inset(0 0 0 0 round 0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    $('[data-a=menu]', c).onclick = () => { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => c.remove(); };
    $('[data-a=empezar]', c).onclick = () => { J.sfx('sesion'); J.empezar(id === 'plaza' ? 'plaza' : id === 'casa' ? 'casa' : 'plaza', { probador: id === 'probador' }); };
    this.focoTeclado(c, '[data-a=empezar]');
  },
  cargando() { this.limpiar(); this.poner(el(`<div class="pantalla carga"><div class="rayado"></div><div class="ruedita" style="position:relative"></div><b style="position:relative">${t('cargando')}</b></div>`)); },

  /* ------------------------------------------------------------ el HUD del juego */
  juego() {
    this.limpiar();
    const J = this.J;
    const h = this.hud = this.poner(el(`<div class="hud">
      <div class="franja arriba"></div><div class="franja abajo"></div>
      <div class="arriba-izq"><div class="pildora"><i class="orbe-icono"></i><span class="orbes">0</span></div><div class="espuma" title="${t('espuma')}"><i style="width:100%"></i></div><div class="misiones"></div></div>
      <div class="arriba-der"><div class="pildora estado-red"><span><span class="punto"></span> <span class="red-txt"></span></span><small class="sala-txt"></small></div>
        <button class="redondo" data-a="chat" title="Chat">💬</button><button class="redondo siempre" data-a="pausa" title="${t('pausa')}">☰</button></div>
      <div class="avisos"></div>
      <div class="chat"></div>
      <div class="hotbar">${HOT.map(([k, e], i) => `<button class="ranura" data-h="${i + 1}" title="${t('hot_' + k)}"><small>${i + 1}</small>${e}</button>`).join('')}</div>
    </div>`));
    $('[data-a=pausa]', h).onclick = () => J.pausar(true);
    $('[data-a=chat]', h).onclick = () => this.abrirChat();
    h.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => J.hotbar(+b.dataset.h));
    this.actualizarHud(); this.actualizarMisiones(); this.actualizarRed();
  },
  actualizarHud() {
    if (!this.hud) return;
    const J = this.J;
    $('.orbes', this.hud).textContent = J.G.orbes;
    $('.espuma i', this.hud).style.width = Math.max(0, J.yo ? J.yo.hp : 100) + '%';
    this.hud.querySelectorAll('.ranura').forEach((b, i) => b.classList.toggle('elegida', J.slot === i + 1));
  },
  actualizarMisiones() {
    if (!this.hud) return;
    const c = $('.misiones', this.hud); c.innerHTML = '';
    for (const m of this.J.misiones.activas()) {
      const d = el(`<div class="mision ${m.e === 'lista' ? 'lista' : ''}"><span></span><div class="barrita"><i style="width:${Math.round(m.n / m.meta * 100)}%"></i></div></div>`);
      d.firstElementChild.textContent = `${t('npc_' + m.id)} · ${m.e === 'lista' ? '✓' : `${m.n}/${m.meta}`}`;
      c.appendChild(d);
    }
  },
  actualizarRed() {
    if (!this.hud) return;
    const R = this.J.red;
    $('.estado-red .punto', this.hud).className = 'punto ' + R.estado;
    $('.red-txt', this.hud).textContent = t(R.estado === 'en_linea' ? 'en_linea' : R.estado === 'conectando' ? 'conectando' : 'sin_red');
    $('.sala-txt', this.hud).textContent = R.estado === 'en_linea' && R.sala ? `${t('sala')} ${R.sala} · ${t('jugadores', { n: this.J.remotos.cuantos + 1 })}` : t('solo');
  },
  /* un cartelito arriba que se va solo */
  avisar(texto, tipo = '') {
    this.historial = [...(this.historial || []), texto].slice(-30);   // (para las pruebas)
    const c = this.hud && $('.avisos', this.hud); if (!c) return;
    const d = el(`<div class="avisito ${tipo}"></div>`); d.textContent = texto; c.appendChild(d);
    while (c.children.length > 4) c.firstChild.remove();
    setTimeout(() => d.remove(), 3300);
  },
  /* el cartel de "E  Viajar" */
  accion(texto) {
    if (!this.hud) return;
    let a = $('.aviso-accion', this.hud);
    if (!texto) { if (a) a.remove(); this._accion = null; return; }
    if (this._accion === texto && a) return;
    this._accion = texto;
    if (!a) { a = el('<div class="aviso-accion pildora"></div>'); this.hud.appendChild(a); }
    a.innerHTML = `<span class="tecla">${this.J.ent.tactil ? '✋' : 'E'}</span> <span></span>`;
    a.lastElementChild.textContent = texto;
  },
  /* ------------------------------------------------------------ chat */
  lineaChat(nombre, texto, sistema = false) {
    const c = this.hud && $('.chat', this.hud); if (!c) return;
    const d = el(`<div class="linea ${sistema ? 'sistema' : ''}"></div>`);
    if (nombre) { const b = document.createElement('b'); b.textContent = nombre + ': '; d.appendChild(b); }
    d.appendChild(document.createTextNode(texto));
    c.appendChild(d);
    while (c.children.length > 8) c.firstChild.remove();
    setTimeout(() => d.classList.add('vieja'), 12000);
  },
  abrirChat() {
    if (!this.hud || $('.chat-entrada', this.hud)) return;
    const J = this.J;
    J.ent.bloqueado = true;
    const f = el(`<form class="chat-entrada"><input maxlength="120" enterkeyhint="send" autocomplete="off"><button class="boton chico primario" type="submit">${t('chat_enviar')}</button></form>`);
    const i = $('input', f); i.placeholder = t('chat_poner');
    $('.chat', this.hud).classList.add('abierto');
    const cerrar = () => { f.remove(); J.ent.bloqueado = false; this.hud && $('.chat', this.hud).classList.remove('abierto'); };
    f.onsubmit = (e) => { e.preventDefault(); if (i.value.trim()) J.decir(i.value); cerrar(); };
    i.onkeydown = (e) => { if (e.key === 'Escape') cerrar(); e.stopPropagation(); };
    i.onblur = () => setTimeout(() => { if (f.isConnected) cerrar(); }, 150);
    this.hud.appendChild(f); i.focus();
  },
  /* ------------------------------------------------------------ diálogo con NPC */
  dialogo(quien, lineas, botones = [], alTerminar = () => {}) {
    const J = this.J;
    this.hud.classList.add('cine');
    const d = el(`<div class="dialogo"><div class="quien"></div><div class="texto"></div><div class="acciones"></div><div class="sigue">▼</div></div>`);
    $('.quien', d).textContent = quien;
    this.hud.appendChild(d);
    let i = 0, escribiendo = null;
    const mostrar = () => {
      const txt = lineas[i]; let k = 0; const caja = $('.texto', d); caja.textContent = '';
      $('.acciones', d).innerHTML = ''; $('.sigue', d).style.display = 'none';
      clearInterval(escribiendo);
      escribiendo = setInterval(() => {
        k += 2; caja.textContent = txt.slice(0, k);
        if (k % 4 === 0) J.sfx('letra', { f: 1200 + (k % 8) * 60 });
        if (k >= txt.length) { clearInterval(escribiendo); escribiendo = null; fin(); }
      }, 22);
    };
    const fin = () => {
      $('.texto', d).textContent = lineas[i];
      if (i < lineas.length - 1) { $('.sigue', d).style.display = ''; return; }
      if (!botones.length) { $('.sigue', d).style.display = ''; return; }
      const a = $('.acciones', d);
      botones.forEach(([txt, f, prim]) => { const b = el(`<button class="boton chico ${prim ? 'primario' : ''}"></button>`); b.textContent = txt; b.onclick = (e) => { e.stopPropagation(); cerrar(); f(); }; a.appendChild(b); });
      a.querySelector('.primario')?.focus();
    };
    const cerrar = () => { clearInterval(escribiendo); d.remove(); this.hud && this.hud.classList.remove('cine'); J.finDialogo(); removeEventListener('keydown', tecla); };
    const avanzar = () => {
      if (escribiendo) { clearInterval(escribiendo); escribiendo = null; fin(); return; }
      if (i < lineas.length - 1) { i++; mostrar(); return; }
      if (!botones.length) { cerrar(); alTerminar(); }
    };
    const tecla = (e) => { if (['Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); if (!(botones.length && i === lineas.length - 1 && !escribiendo)) avanzar(); } };
    d.addEventListener('click', avanzar);
    setTimeout(() => addEventListener('keydown', tecla), 50);
    mostrar();
  },

  /* ------------------------------------------------------------ ventanas */
  ventana(titulo, cuerpo, { alCerrar, ancho, pie = '' } = {}) {
    this.cerrarVentana();
    const v = this.poner(el(`<div class="velo"><div class="ventana" ${ancho ? `style="width:min(${ancho}px,94vw)"` : ''}><div class="cabeza"><h2></h2><button class="redondo" data-a="x" style="width:40px;height:40px;font-size:18px">✕</button></div><div class="cuerpo"></div>${pie}</div></div>`));
    $('h2', v).textContent = titulo;
    const c = $('.cuerpo', v);
    if (typeof cuerpo === 'string') c.innerHTML = cuerpo; else c.appendChild(cuerpo);
    const cerrar = () => { v.remove(); if (this.ventanaAbierta === v) this.ventanaAbierta = null; removeEventListener('keydown', tecla); alCerrar && alCerrar(); };
    const tecla = (e) => { if (e.code === 'Escape' && !e.target.closest('input')) { e.preventDefault(); e.stopPropagation(); cerrar(); } };
    addEventListener('keydown', tecla, true);
    $('[data-a=x]', v).onclick = cerrar;
    v.addEventListener('pointerdown', (e) => { if (e.target === v) cerrar(); });
    v.cerrar = cerrar;
    this.ventanaAbierta = v;
    return v;
  },
  cerrarVentana() { if (this.ventanaAbierta) this.ventanaAbierta.cerrar(); },
  pausa() {
    const J = this.J;
    const cuerpo = el(`<div class="pausa-menu">
      <button class="boton primario" data-a="seguir">${t('seguir')}</button><button class="boton" data-a="probador">${t('canal_probador')}</button>
      <button class="boton" data-a="opciones">${t('canal_opciones')}</button><button class="boton" data-a="controles">${t('canal_controles')}</button>
      <button class="boton" data-a="discos">${t('canal_discos')}</button><button class="boton" data-a="menu">${t('salir_menu')}</button></div>`);
    const pie = `<div class="barra-pausa"><span class="p-nombre"></span><span><i class="orbe-icono" style="display:inline-block;width:14px;height:14px;vertical-align:-2px"></i> ${J.G.orbes}</span><span class="p-sala"></span></div>`;
    const v = this.ventana(t('pausa'), cuerpo, { alCerrar: () => J.pausar(false), pie });
    $('.p-nombre', v).textContent = J.G.nombre;
    $('.p-sala', v).textContent = J.red.estado === 'en_linea' && J.red.sala ? `${J.red.sala} · ${J.remotos.cuantos + 1}` : t('solo');
    cuerpo.querySelector('[data-a=seguir]').onclick = () => v.cerrar();
    cuerpo.querySelector('[data-a=probador]').onclick = () => { v.remove(); this.ventanaAbierta = null; J.pausar(false); J.abrirProbador(); };
    cuerpo.querySelector('[data-a=opciones]').onclick = () => this.opciones(() => this.pausa());
    cuerpo.querySelector('[data-a=controles]').onclick = () => this.controles(() => this.pausa());
    cuerpo.querySelector('[data-a=discos]').onclick = () => this.discos(() => this.pausa());
    cuerpo.querySelector('[data-a=menu]').onclick = () => { v.remove(); this.ventanaAbierta = null; J.salirAlMenu(); };
    this.focoTeclado(v, '[data-a=seguir]');
  },
  segmentos(opciones, actual, alElegir) {
    const s = el('<div class="segmentos"></div>');
    for (const [v, txt] of opciones) { const b = el(`<button class="${v === actual ? 'si' : ''}"></button>`); b.textContent = txt; b.onclick = () => { s.querySelectorAll('button').forEach((q) => q.classList.remove('si')); b.classList.add('si'); alElegir(v); }; s.appendChild(b); }
    return s;
  },
  fila(etiqueta, control) { const f = el('<div class="op"><span></span></div>'); f.firstElementChild.textContent = etiqueta; f.appendChild(control); return f; },
  deslizador(min, max, paso, valor, alMover) { const i = el(`<input type="range" min="${min}" max="${max}" step="${paso}" value="${valor}">`); i.oninput = () => alMover(+i.value); return i; },
  opciones(volver) {
    const J = this.J, O = J.G.opciones;
    const c = document.createElement('div');
    c.appendChild(this.fila(t('op_idioma'), this.segmentos(IDIOMAS.map((i) => [i, i.toUpperCase()]), idioma(), (i) => { ponerIdioma(i); J.G.idioma = i; J.guardar(); J.alCambiarIdioma(); this.opciones(volver); })));
    c.appendChild(this.fila(t('op_musica'), this.deslizador(0, 1, 0.05, O.musica, (v) => { O.musica = v; J.volumen(); J.guardar(); })));
    c.appendChild(this.fila(t('op_efectos'), this.deslizador(0, 1, 0.05, O.efectos, (v) => { O.efectos = v; J.volumen(); J.guardar(); })));
    c.appendChild(this.fila(t('op_calidad'), this.segmentos(['auto', 'alta', 'media', 'baja'].map((q) => [q, t('cal_' + q)]), O.calidad, (q) => { O.calidad = q; J.ponerCalidad(q); J.guardar(); document.body.classList.toggle('calidadBaja', q === 'baja'); })));
    c.appendChild(el(`<div class="op"><h3>${t('op_retro')}</h3></div>`));
    const R = O.retro;
    const niveles = (k, n) => this.segmentos([[0, t('op_ninguno')], ...Array.from({ length: n }, (_, i) => [i + 1, String(i + 1)])], R[k], (v) => { R[k] = v; J.ponerRetro(); J.guardar(); });
    c.appendChild(this.fila(t('op_pix'), niveles('pix', 4)));
    c.appendChild(this.fila(t('op_niveles'), niveles('niveles', 4)));
    const onoff = (k) => this.segmentos([[0, t('no')], [1, t('si')]], R[k] ? 1 : 0, (v) => { R[k] = v; J.ponerRetro(); J.guardar(); });
    c.appendChild(this.fila(t('op_trama'), onoff('trama')));
    c.appendChild(this.fila(t('op_barrido'), onoff('barrido')));
    c.appendChild(this.fila(t('op_tubo'), onoff('tubo')));
    c.appendChild(this.fila(t('op_aberracion'), onoff('aberracion')));
    c.appendChild(el('<div class="op"><h3>·</h3></div>'));
    c.appendChild(this.fila(t('op_camara'), this.deslizador(0.3, 2.5, 0.1, O.sensCam, (v) => { O.sensCam = v; J.guardar(); })));
    c.appendChild(this.fila(t('op_invertir'), this.segmentos([[false, t('no')], [true, t('si')]], O.invertirY, (v) => { O.invertirY = v; J.guardar(); })));
    c.appendChild(this.fila(t('op_nombres'), this.segmentos([[true, t('si')], [false, t('no')]], O.nombres, (v) => { O.nombres = v; J.guardar(); J.mostrarNombres(); })));
    c.appendChild(this.fila(t('op_reloj'), this.segmentos([[true, t('si')], [false, t('no')]], O.reloj24, (v) => { O.reloj24 = v; J.guardar(); })));
    const borrar = el(`<button class="boton chico" style="border-color:#ffb3c0;color:#e0405e">${t('op_borrar')}</button>`);
    borrar.onclick = () => { if (confirm(t('op_borrar_seguro'))) J.borrarTodo(); };
    c.appendChild(this.fila('', borrar));
    this.ventana(t('canal_opciones'), c, { alCerrar: volver });
  },
  controles(volver) {
    const J = this.J, C = J.ent.config;
    const c = document.createElement('div');
    const txt = (s) => { const p = el('<p style="font-weight:700;line-height:1.6;margin:6px 0 14px"></p>'); p.textContent = s; return p; };
    c.appendChild(el(`<div class="op"><h3>${t('ctl_teclado')}</h3></div>`)); c.appendChild(txt(t('ctl_teclas')));
    c.appendChild(el(`<div class="op"><h3>${t('ctl_mando')}</h3></div>`)); c.appendChild(txt(t('ctl_mando_txt')));
    c.appendChild(el(`<div class="op"><h3>${t('ctl_dedos')}</h3></div>`));
    const editar = el(`<button class="boton primario chico">${t('ctl_editar')}</button>`);
    editar.onclick = () => { this.cerrarVentana(); this.editorDedos(volver); };
    c.appendChild(this.fila('', editar));
    c.appendChild(this.fila(t('ctl_palanca'), this.segmentos([['fija', t('ctl_fija')], ['flotante', t('ctl_flotante')]], C.palanca, (v) => { C.palanca = v; J.guardarControles(); })));
    c.appendChild(this.fila(t('ctl_zurdo'), this.segmentos([[false, t('no')], [true, t('si')]], C.zurdo, (v) => { C.zurdo = v; J.ent.ubicarDedos(); J.guardarControles(); })));
    c.appendChild(this.fila(t('ctl_vibra'), this.segmentos([[true, t('si')], [false, t('no')]], C.vibra, (v) => { C.vibra = v; J.guardarControles(); })));
    this.ventana(t('ctl_titulo'), c, { alCerrar: volver });
  },
  /* el editor de los botones de dedo: arrastrar, agrandar, transparencia */
  editorDedos(volver) {
    const J = this.J, E = J.ent, C = E.config;
    E.editar(true);
    const p = this.poner(el(`<div class="editor-dedos"><b style="display:block;margin-bottom:6px">${t('ctl_elegi')}</b></div>`));
    const tam = this.deslizador(0.5, 1.8, 0.05, 1, (v) => { if (E.elegido) { C.botones[E.elegido].tam = v; E.ubicarDedos(); } });
    tam.disabled = true;
    E.alElegir = (n) => { tam.disabled = false; tam.value = C.botones[n].tam; };
    p.appendChild(this.fila(t('ctl_tam'), tam));
    p.appendChild(this.fila(t('ctl_opacidad'), this.deslizador(0.2, 1, 0.05, C.opacidad, (v) => { C.opacidad = v; E.ubicarDedos(); })));
    p.appendChild(this.fila(t('ctl_zurdo'), this.segmentos([[false, t('no')], [true, t('si')]], C.zurdo, (v) => { C.zurdo = v; E.ubicarDedos(); })));
    const fila = el('<div class="fila" style="margin-top:8px"></div>');
    const rest = el(`<button class="boton chico">${t('ctl_restablecer')}</button>`); rest.onclick = () => { E.ponerConfig({}); J.guardarControles(); tam.value = 1; };
    const listo = el(`<button class="boton chico primario">${t('listo')}</button>`); listo.onclick = () => { E.editar(false); E.mostrarDedos(J.enJuego); J.guardarControles(); p.remove(); volver && volver(); };
    fila.append(rest, listo); p.appendChild(fila);
  },
  discos(volver) {
    const J = this.J;
    const c = el('<div class="lista-discos"></div>');
    const auto = el(`<button class="disco-fila ${!J.musicaElegida ? 'si' : ''}"><div class="disco"></div><span>${t('cal_auto')}</span></button>`);
    auto.onclick = () => { J.elegirMusica(null); this.discos(volver); };
    c.appendChild(auto);
    for (const k of CANCIONES) {
      const tiene = J.cancionDesbloqueada(k);
      const b = el(`<button class="disco-fila ${tiene ? '' : 'bloq'} ${J.musicaElegida === k ? 'si' : ''}"><div class="disco"></div><span></span></button>`);
      b.lastElementChild.textContent = tiene ? t('can_' + k) + (J.musicaElegida === k ? ' · ' + t('disco_sonando') : '') : '??? · ' + t('disco_bloq');
      if (tiene) b.onclick = () => { J.elegirMusica(k); this.discos(volver); };
      c.appendChild(b);
    }
    this.ventana(t('discos_titulo') + ` · ${J.G.discos.length}/6`, c, { alCerrar: volver });
  },
  creditos() {
    const c = el(`<div style="text-align:center;font-weight:800;line-height:1.7"><div class="logo" style="font-size:40px">AERO<span>PLAZA</span></div><p></p><p style="color:#8a9098"></p></div>`);
    c.children[1].textContent = t('creditos_txt'); c.children[2].textContent = t('creditos_inspira');
    this.ventana(t('canal_creditos'), c);
  },
  salas() {
    const J = this.J, R = J.red;
    const c = document.createElement('div');
    const cab = el('<p style="font-weight:800"></p>');
    cab.textContent = R.estado === 'en_linea' ? t('total_linea', { n: R.cuantosEn() + 1 }) : t(R.estado === 'conectando' ? 'conectando' : 'sin_red');
    c.appendChild(cab);
    const g = el('<div class="reinos"></div>');
    for (const [id, emo, fondo] of REINOS) {
      if (id === 'casa') continue;
      const d = el(`<div class="reino" style="background:${fondo}"><span class="emoji">${emo}</span><b>${t('reino_' + id)}</b><small>${t('reino_' + id + '_d')}</small><span class="gente">${t('jugadores', { n: R.cuantosEn(id) })}</span></div>`);
      g.appendChild(d);
    }
    c.appendChild(g);
    this.ventana(t('canal_salas'), c, { ancho: 760 });
  },
  /* ------------------------------------------------------------ el tren */
  viaje(aqui, alElegir) {
    const J = this.J, R = J.red;
    const c = document.createElement('div');
    const g = el('<div class="reinos"></div>');
    for (const [id, emo, fondo] of REINOS) {
      const d = el(`<button class="reino ${id === aqui ? 'aqui' : ''}" style="background:${fondo}"><span class="emoji">${emo}</span><b>${t('reino_' + id)}</b><small>${t('reino_' + id + '_d')}</small><span class="gente">${R.estado === 'en_linea' ? t('jugadores', { n: R.cuantosEn(id) }) : ''}</span></button>`);
      d.onclick = () => { this.cerrarVentana(); alElegir(id); };
      g.appendChild(d);
    }
    c.appendChild(g);
    const casas = R.casasAbiertas().filter((q) => q.id !== J.id);
    const h = el(`<div class="op"><h3>${t('casas_abiertas')}</h3></div>`); c.appendChild(h);
    if (!casas.length) { const p = el('<p style="font-weight:700;color:#8a9098"></p>'); p.textContent = t('ninguna_casa'); c.appendChild(p); }
    else { const g2 = el('<div class="reinos"></div>'); for (const q of casas) { const d = el('<button class="reino"><span class="emoji">🏠</span><b></b><span class="gente"></span></button>'); d.querySelector('b').textContent = t('reino_casa_de', { n: q.nombre }); d.querySelector('.gente').textContent = t('jugadores', { n: q.gente }); d.onclick = () => { this.cerrarVentana(); alElegir('casa', q.id, q.nombre); }; g2.appendChild(d); } c.appendChild(g2); }
    this.ventana(t('a_donde'), c, { ancho: 820, alCerrar: () => J.pausar(false, true) });
  },
  pantallaViaje(nombre) {
    const v = this.poner(el(`<div class="viaje"><div class="nubecita" style="top:22%"></div><div class="nubecita" style="top:64%;animation-delay:-1.1s;transform:scale(.7)"></div><div class="tren"></div><p></p></div>`));
    $('p', v).textContent = t('viajando', { n: nombre });
    v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
    return { cerrar: () => { const a = v.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450 }); a.onfinish = () => v.remove(); } };
  },
  /* ------------------------------------------------------------ el probador */
  probador(alCerrar) {
    const J = this.J, G = J.G;
    let pest = 'color';
    const pestanas = [['color', t('prob_color')], ['color2', t('prob_color2')], ['motivo', t('prob_motivo')], ['material', t('prob_material')], ['sombrero', t('prob_sombrero')], ['peinado', t('prob_pelo')], ['colorPelo', t('prob_color_pelo')], ['anteojos', t('prob_anteojos')], ['espalda', t('prob_espalda')], ['particulas', t('prob_particulas')]];
    const p = this.poner(el(`<div class="probador"><div class="cabeza" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px"><h2 style="margin:0;font-size:22px">${t('prob_titulo')}</h2><span class="pildora" style="font-size:15px"><i class="orbe-icono"></i><span class="p-orbes"></span></span></div>
      <div class="pestanas">${pestanas.map(([k, n]) => `<button data-p="${k}">${n}</button>`).join('')}</div><div class="opciones-prob"></div>
      <div class="prob-pie"><input maxlength="16"><button class="boton chico" data-a="azar">🎲</button><button class="boton chico primario" data-a="listo">${t('listo')}</button></div></div>`));
    const nombre = $('input', p); nombre.value = G.nombre; nombre.placeholder = t('prob_nombre');
    nombre.onfocus = () => { J.ent.bloqueado = true; }; nombre.onblur = () => { J.ent.bloqueado = false; };
    nombre.onkeydown = (e) => e.stopPropagation();
    nombre.oninput = () => { const v = nombre.value.replace(/[<>]/g, '').trim(); if (v) { G.nombre = v.slice(0, 16); J.cambiarNombre(); } };
    const grilla = $('.opciones-prob', p);
    const dibujar = () => {
      $('.p-orbes', p).textContent = G.orbes;
      p.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('si', b.dataset.p === pest));
      grilla.innerHTML = '';
      if (pest === 'color' || pest === 'color2' || pest === 'colorPelo') {
        const lista = pest === 'colorPelo' ? PALETA_PELO : PALETA;
        for (const c of lista) { const b = el(`<button class="color ${G.A[pest] === c ? 'si' : ''}" style="background:${c}"></button>`); b.onclick = () => { G.A[pest] = c; J.aplicarApariencia(); dibujar(); }; grilla.appendChild(b); }
        const libre = el(`<label class="color" style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);display:block"><input type="color" style="opacity:0;width:100%;height:100%"></label>`);
        const inp = $('input', libre); inp.value = G.A[pest]; inp.oninput = () => { G.A[pest] = inp.value; J.aplicarApariencia(); };
        grilla.appendChild(libre);
        return;
      }
      const R = RANURAS.find((q) => q.r === pest);
      if (pest === 'motivo') {
        const d = el(`<div class="deslizador"><span>${t('prob_cubre')}</span></div>`);
        d.appendChild(this.deslizador(0, 1.3, 0.02, G.A.cubre, (v) => { G.A.cubre = v; J.aplicarApariencia(); }));
        grilla.appendChild(d);
      }
      for (const v of R.lista) {
        const clave = pest + ':' + v, tiene = loTengo(G, clave), pr = precio(clave), mis = DE_MISION[clave];
        const tex = pest === 'motivo' && v !== 'ninguno' && window.ARCHIVOS && window.ARCHIVOS['motivo-' + v + '.webp'];
        const b = el(`<button class="item ${G.A[pest] === v ? 'si' : ''} ${tiene ? '' : 'bloq'}">${tex ? `<span class="muestra" style="background-image:url(${tex})"></span>` : ''}<span class="n"></span>${tiene ? '' : mis ? `<span class="precio">🔒</span>` : `<span class="precio"><i class="orbe-icono"></i>${pr}</span>`}${tiene ? '' : '<span class="candado">🔒</span>'}</button>`);
        $('.n', b).textContent = t(R.pre + '_' + v);
        b.onclick = () => {
          if (tiene) { G.A[pest] = v; J.aplicarApariencia(); dibujar(); return; }
          if (mis) { J.avisarPantalla(t('prob_bloq_mision') + ' · ' + t('npc_' + mis)); J.probarPuesto(pest, v); return; }
          J.probarPuesto(pest, v);
          if (G.orbes < pr) { J.avisarPantalla(t('prob_faltan', { n: pr - G.orbes })); J.sfx('no'); return; }
          if (confirm(t('prob_comprar', { q: t(R.pre + '_' + v), n: pr }))) { G.orbes -= pr; G.tengo.push(clave); G.A[pest] = v; J.aplicarApariencia(); J.sfx('orbe'); J.avisarPantalla(t('prob_comprado')); dibujar(); }
          else J.aplicarApariencia();
        };
        grilla.appendChild(b);
      }
    };
    p.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { pest = b.dataset.p; dibujar(); });
    $('[data-a=azar]', p).onclick = () => {
      const r = (l) => l[Math.floor(Math.random() * l.length)];
      G.A.color = r(PALETA); G.A.color2 = r(PALETA); G.A.colorPelo = r(PALETA_PELO); G.A.cubre = Math.random() * 0.9;
      for (const R of RANURAS) { const ok = R.lista.filter((v) => loTengo(G, R.r + ':' + v)); G.A[R.r] = r(ok); }
      J.aplicarApariencia(); dibujar();
    };
    $('[data-a=listo]', p).onclick = () => { p.remove(); J.ent.bloqueado = false; alCerrar(); };
    dibujar();
    this._probador = p;
  },
  /* ------------------------------------------------------------ gestos, mapa, construir */
  gestos() {
    const J = this.J, c = el('<div class="gestos"></div>');
    for (const g of GESTOS) { const b = el(`<button class="boton"></button>`); b.textContent = t('gesto_' + g); b.onclick = () => { this.cerrarVentana(); J.gesto(g); }; c.appendChild(b); }
    this.ventana(t('hot_gestos'), c, { ancho: 480 });
  },
  mapa(dibujar) {
    const c = el('<div class="mapa"><canvas width="512" height="512"></canvas></div>');
    const v = this.ventana(t('mapa_titulo'), c, { ancho: 560 });
    const cv = $('canvas', c);
    const vuelta = () => { if (!v.isConnected) return; dibujar(cv); requestAnimationFrame(vuelta); };
    vuelta();
  },
  construir(alElegir, alGirar, alQuitar, alListo) {
    const J = this.J;
    const p = this.poner(el(`<div class="construir"><div class="catalogo">${MUEBLES.map(([k, e]) => `<button data-k="${k}" title="${k}">${e}</button>`).join('')}</div>
      <div class="fila"><button class="boton chico" data-a="girar">↻ ${t('casa_girar')}</button><button class="boton chico" data-a="quitar">🗑 ${t('casa_quitar')}</button><button class="boton chico primario" data-a="listo">${t('casa_listo')}</button></div></div>`));
    p.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { p.querySelectorAll('[data-k]').forEach((q) => q.classList.toggle('si', q === b)); alElegir(b.dataset.k); });
    $('[data-a=girar]', p).onclick = alGirar; $('[data-a=quitar]', p).onclick = alQuitar;
    $('[data-a=listo]', p).onclick = () => { p.remove(); alListo(); };
    return p;
  },
  /* flechas y Enter para moverse entre botones (con teclado o mando) */
  focoTeclado(raiz, primero) {
    const botones = () => [...raiz.querySelectorAll('button:not([disabled])')].filter((b) => b.offsetParent);
    setTimeout(() => { const b = primero ? raiz.querySelector(primero) : botones()[0]; b && b.focus({ preventScroll: true }); }, 60);
    const tecla = (e) => {
      if (!raiz.isConnected) { removeEventListener('keydown', tecla); return; }
      const l = botones(); if (!l.length) return;
      const i = l.indexOf(document.activeElement);
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); l[(i + 1) % l.length].focus(); this.J.sfx('mover'); }
      else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); this.J.sfx('mover'); }
    };
    addEventListener('keydown', tecla);
  },
};
export { REINOS, esc };
