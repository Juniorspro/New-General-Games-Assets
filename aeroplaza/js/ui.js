/* ============================================================================
   aeroplaza/js/ui.js — todas las pantallas y ventanas (HTML encima del lienzo).
   Orden: idioma → aviso → menú de canales → canal Plaza → juego (HUD).
   Encima del juego: pausa, opciones, controles (con el editor de dedos),
   probador, viaje en tren, diálogos con NPC, discos, gestos, mapa y construir.
   Lo que escribe la gente (nombres, chat) va siempre como texto, nunca como HTML.
   ========================================================================== */
import { t, sumar, ponerIdioma, idioma, IDIOMAS } from './textos.js';
import { timbre } from './timbres.js';
import { RANURAS, PALETA, PALETA_PELO, loTengo, precio, DE_MISION, MUEBLES } from './catalogo.js';
import { NPCS } from './misiones.js';
import { ESTILOS, ALTOS_PIXEL } from './motor.js';
import { Pantalla } from './pantalla.js';
import { Teclado } from './teclado.js';
import { NIVELES, miniaturaParkour, formatoTiempo } from './reinos/parkour.js';
import { miniaturaTiro, TIRO } from './reinos/tiro.js';

sumar({
  es: { op_anim: 'Animaciones', anim_suave: 'Suave', anim_lineal: 'Lineal', anim_chop: 'Chop', noti_zona: 'Nueva zona', noti_bien: '¡Listo!', noti_info: 'AEROPLAZA', noti_error: 'Ups', mis_titulo: 'Misiones', mis_ninguna: 'No tenés misiones. Hablá con la gente de la isla (💬) y te van a pedir cosas.', mis_volver: '✓ Listo: volvé a hablar con {n}.', mis_hechas: 'Hechas: {n}', boton_misiones: 'Misiones', boton_voz: 'Chat de voz' },
  en: { op_anim: 'Animations', anim_suave: 'Smooth', anim_lineal: 'Linear', anim_chop: 'Chop', noti_zona: 'New area', noti_bien: 'Done!', noti_info: 'AEROPLAZA', noti_error: 'Oops', mis_titulo: 'Quests', mis_ninguna: 'No quests yet. Talk to the people on the island (💬) and they will ask you for things.', mis_volver: '✓ Done: go back and talk to {n}.', mis_hechas: 'Completed: {n}', boton_misiones: 'Quests', boton_voz: 'Voice chat' },
  pt: { op_anim: 'Animações', anim_suave: 'Suave', anim_lineal: 'Linear', anim_chop: 'Chop', noti_zona: 'Nova área', noti_bien: 'Pronto!', noti_info: 'AEROPLAZA', noti_error: 'Opa', mis_titulo: 'Missões', mis_ninguna: 'Sem missões. Fale com o pessoal da ilha (💬) e eles vão pedir coisas.', mis_volver: '✓ Pronto: volte e fale com {n}.', mis_hechas: 'Feitas: {n}', boton_misiones: 'Missões', boton_voz: 'Chat de voz' },
});
const $ = (sel, raiz = document) => raiz.querySelector(sel);
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
/* el muñeco de gelatina dibujado, para los canales */
const muneco = (c, alto) => `<svg class="muneco" style="position:absolute;left:0;right:0;margin:auto;top:${(100 - alto) / 2 - 4}%;height:${alto}%" viewBox="0 0 60 100"><defs><radialGradient id="g${c.slice(1)}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></radialGradient></defs><ellipse cx="30" cy="96" rx="20" ry="3" fill="rgba(0,0,0,.12)"/><path d="M10 94 Q6 60 20 46 Q30 38 40 46 Q54 60 50 94 Z" fill="url(#g${c.slice(1)})"/><circle cx="30" cy="24" r="17" fill="url(#g${c.slice(1)})"/><ellipse cx="24" cy="17" rx="5" ry="3" fill="#fff" opacity=".8"/></svg>`;
/* la muestra de cada estilo: el fondo del menú achicado y pasado por el efecto (en un canvas 2D) */
const MUESTRAS = {};
function muestraEstilo(n) {
  if (MUESTRAS[n] !== undefined) return MUESTRAS[n];
  const url = window.ARCHIVOS && window.ARCHIVOS['fondo-menu.webp']; if (!url) return (MUESTRAS[n] = '');
  MUESTRAS[n] = '';
  const img = new Image();
  img.onload = () => {
    const E = ESTILOS[n], lin = ALTOS_PIXEL[E.pix] || 180, h = Math.round(lin / 4), w = Math.round(h * 16 / 9);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), p = d.data;
    const GB = [[8, 24, 32], [52, 104, 86], [136, 192, 112], [224, 248, 208]];
    const P8 = ['1a1c2c','5d275d','b13e53','ef7d57','ffcd75','a7f070','38b764','257179','29366f','3b5dc9','41a6f6','73eff7','f4f4f4','94b0c2','566c86','333c57'].map((x) => [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)));
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4, tr = (B[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * (E.trama ? 1 : 0);
      let r = p[k], gg = p[k + 1], b = p[k + 2];
      if (E.paleta === 1) { const l = Math.min(0.999, Math.max(0, Math.pow((0.299 * r + 0.587 * gg + 0.114 * b) / 255, 1.3) * 1.15 + tr * 0.28)); [r, gg, b] = GB[Math.floor(l * 4)]; }
      else if (E.paleta === 2) { const L = 0.299 * r + 0.587 * gg + 0.114 * b; r = L + (r - L) * 1.3; gg = L + (gg - L) * 1.3; b = L + (b - L) * 1.3; let m = 1e9, e = P8[0]; for (const q of P8) { const dd = (r + tr * 36 - q[0]) ** 2 * 0.9 + (gg + tr * 36 - q[1]) ** 2 * 1.3 + (b + tr * 36 - q[2]) ** 2 * 0.6; if (dd < m) { m = dd; e = q; } } [r, gg, b] = e; }
      else if (E.niveles) { const n2 = [0, 31, 15, 7, 4][E.niveles]; [r, gg, b] = [r, gg, b].map((v) => Math.round(Math.floor(v / 255 * n2 + 0.5 + tr) / n2 * 255)); }
      if (E.vhs) { r = Math.min(255, r * 1.05 + (Math.random() - 0.5) * 30); b = Math.min(255, b * 1.05); }
      if (E.barrido && y % 2) { r *= 0.8; gg *= 0.8; b *= 0.8; }
      p[k] = r; p[k + 1] = gg; p[k + 2] = b;
    }
    g.putImageData(d, 0, 0);
    MUESTRAS[n] = c.toDataURL();
    document.querySelectorAll('.muestra-estilo.' + n).forEach((q) => { q.style.backgroundImage = `url(${MUESTRAS[n]})`; });
  };
  img.src = url;
  return '';
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const REINOS = [['plaza', '🏝️', 'linear-gradient(160deg,#dfffe6,#d6f2ff)'], ['aqua', '🐬', 'linear-gradient(160deg,#d6f6ff,#b8e8ff)'], ['aurora', '🌌', 'linear-gradient(160deg,#e6dcff,#cfe8ff)'], ['jardin', '🪷', 'linear-gradient(160deg,#ffe6f4,#e0ffe9)'], ['casa', '🏡', 'linear-gradient(160deg,#fff6d6,#e6f6ff)']];
const HOT = [['burbujero', '🫧'], ['gestos', '👋'], ['discos', '💿'], ['foto', '📷'], ['mapa', '🗺️']];
const GESTOS = ['saludar', 'festejar', 'aplaudir', 'saltito', 'voltereta', 'pensar', 'sentarse', 'bailar1', 'bailar2', 'bailar3'];
/* todos los discos escondidos en los reinos (6 en la isla y uno en cada otro reino) */
const TOTAL_DISCOS = 10;
const CANCIONES = ['titulo', 'colina', 'arrecife', 'ciudad', 'cielo', 'aurora', 'playa', 'bosque'];

export const UI = {
  J: null, raiz: null, ventanaAbierta: null,
  iniciar(J) {
    /* la onda de luz al apretar cualquier botón (también los de dedo) */
    document.addEventListener('pointerdown', (e) => {
      const b = e.target.closest && e.target.closest('.boton, .redondo, .ranura, .dedo-boton, .tecla-aero');
      if (!b || b.disabled) return;
      const o = document.createElement('i'); o.className = 'onda'; b.appendChild(o); setTimeout(() => o.remove(), 600);
    }, true);
    this.J = J; this.raiz = document.getElementById('ui');
    /* los sonidos de la interfaz: pasar por encima y elegir */
    this.raiz.addEventListener('pointerover', (e) => { const b = e.target.closest('button'); if (b && b !== this._ult) { this._ult = b; J.sfx('mover'); } });
    this.raiz.addEventListener('click', (e) => { if (e.target.closest('button')) J.sfx('elegir'); });
    document.body.classList.toggle('calidadBaja', J.G.opciones.calidad === 'baja');
    /* el cartel de "cargando" que trae el HTML (por si el visor no corre JavaScript) ya no hace falta */
    document.getElementById('precarga')?.remove();
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
      ['probador', `<div class="vista probador">${muneco(J.G.A.color, 62)}</div>`],
      ['salas', `<div class="vista salas"><b class="cuenta-linea">·</b><small>${t('en_linea')}</small></div>`],
      ['casa', `<div class="vista icono"><span>🏡</span></div>`],
      ['discos', `<div class="vista icono"><div class="disco"></div></div>`],
      ['opciones', `<div class="vista icono gira"><span>⚙️</span></div>`],
      ['controles', `<div class="vista icono"><span>🎮</span></div>`],
      ['creditos', `<div class="vista icono"><span style="font-size:.5em;font-weight:900;color:#34bef0">AERO<span style="color:#56d05a">PLAZA</span></span></div>`],
      ['estilo', `<div class="vista estilo"><span>👾</span></div>`],
    ];
    const vacios = 12 - canales.length;
    const p = this.poner(el(`<div class="pantalla menu"><div class="rayado"></div>
      <button class="boton primario jugar-grande" data-a="jugar">▶ ${t('jugar')}</button>
      <div class="canales" style="position:relative">${canales.map(([id, v]) => `<button class="canal" data-c="${id}">${v}<div class="nombre">${t('canal_' + id)}</div></button>`).join('')}${'<div class="canal vacio"></div>'.repeat(vacios)}</div>
      <div class="barra-abajo"><svg viewBox="0 0 1000 150" preserveAspectRatio="none"><path d="M0 40 Q 180 40 250 70 Q 320 100 500 100 Q 680 100 750 70 Q 820 40 1000 40 L1000 150 L0 150 Z" fill="#f4f6f8" stroke="#d9dde1" stroke-width="3"/></svg>
        <div class="reloj">--:--</div><div class="fecha"></div>
        <div class="izq"><button class="redondo" data-c="plaza" title="AEROPLAZA">A·P</button></div>
        <div class="der"><button class="redondo" data-c="salas"><span class="punto ${J.red.estado}"></span></button></div></div></div>`));
    p.querySelectorAll('[data-c]').forEach((b) => b.onclick = () => this.abrirCanal(b.dataset.c, b));
    /* el atajo: directo a la plaza, sin pasar por el canal */
    $('[data-a=jugar]', p).onclick = () => { J.sfx('sesion'); J.empezar('plaza'); };
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
    this.focoTeclado(p, '[data-a=jugar]');
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
    if (id === 'estilo') return this.estilo();
    const r = Pantalla.caja(desde);
    const fondo = window.ARCHIVOS && window.ARCHIVOS['fondo-menu.webp'];
    const titulo = id === 'plaza' ? t('canal_plaza') : id === 'probador' ? t('canal_probador') : t('canal_casa');
    const desc = id === 'plaza' ? t('plaza_desc') : id === 'probador' ? t('prob_titulo') : t('reino_casa_d');
    const vista = id === 'plaza' ? `<div class="vista plaza" style="background-image:url(${fondo || ''});background-color:#bfe9ff"></div>` : id === 'probador' ? `<div class="vista probador">${muneco(J.G.A.color, 46)}</div>` : `<div class="vista icono" style="font-size:20vmin">🏡</div>`;
    const c = this.poner(el(`<div class="canal-abierto"><div class="grande">${vista}<div class="titulo-canal">${titulo}</div><div class="desc">${esc(desc)}</div></div>
      <div class="pie"><button class="boton" data-a="menu">${t('menu')}</button><button class="boton primario" data-a="empezar">${t('empezar')}</button></div></div>`));
    c.animate([{ clipPath: `inset(${r.top}px ${Pantalla.w - r.right}px ${Pantalla.h - r.bottom}px ${r.left}px round 18px)` }, { clipPath: 'inset(0 0 0 0 round 0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    $('[data-a=menu]', c).onclick = () => { c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => c.remove(); };
    $('[data-a=empezar]', c).onclick = () => { J.sfx('sesion'); J.empezar(id === 'plaza' ? 'plaza' : id === 'casa' ? 'casa' : 'plaza', { probador: id === 'probador' }); };
    this.focoTeclado(c, '[data-a=empezar]');
  },
  cargando() { this.limpiar(); this.poner(el(`<div class="pantalla carga"><div class="rayado"></div><div class="ruedita" style="position:relative"></div><b style="position:relative">${t('cargando')}</b><small style="position:relative;font-weight:700;color:#8a9098;max-width:80vw;text-align:center">${t('consejo_' + (1 + Math.floor(Math.random() * 4)))}</small></div>`)); },

  /* ------------------------------------------------------------ el HUD del juego */
  juego() {
    this.limpiar();
    const J = this.J;
    const h = this.hud = this.poner(el(`<div class="hud">
      <div class="franja arriba"></div><div class="franja abajo"></div>
      <div class="arriba-izq"><div class="pildora"><i class="orbe-icono"></i><span class="orbes">0</span></div><div class="espuma" title="${t('espuma')}"><i style="width:100%"></i></div></div>
      <div class="arriba-der"><div class="pildora estado-red"><span><span class="punto"></span> <span class="red-txt"></span><b class="red-n"></b></span><small class="sala-txt"></small></div>
        <button class="redondo" data-a="voz" title="${t('boton_voz')}">🎤</button><button class="redondo" data-a="misiones" title="${t('boton_misiones')}">📜<i class="insignia"></i></button><button class="redondo" data-a="estilo" title="${t('estilo_titulo')}">👾</button><button class="redondo" data-a="chat" title="Chat">💬</button><button class="redondo siempre" data-a="pausa" title="${t('pausa')}">☰</button></div>
      <div class="notis"></div>
      <div class="chat"></div>
      <div class="hotbar">${HOT.map(([k, e], i) => `<button class="ranura" data-h="${i + 1}" title="${t('hot_' + k)}"><small>${i + 1}</small>${e}</button>`).join('')}</div>
    </div>`));
    $('[data-a=pausa]', h).onclick = () => J.pausar(true);
    $('[data-a=chat]', h).onclick = () => this.abrirChat();
    $('[data-a=misiones]', h).onclick = () => this.panelMisiones();
    $('[data-a=voz]', h).onclick = () => J.alternarVoz && J.alternarVoz();
    $('[data-a=estilo]', h).onclick = () => { J.pausar(true, true); this.estilo(() => J.pausar(false, true)); };
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
  /* las misiones ya no quedan siempre a la vista: el botón 📜 dice cuántas hay
     (y se pone verde si alguna está lista) y abre el panel */
  actualizarMisiones() {
    if (!this.hud) return;
    const A = this.J.misiones.activas(), b = $('[data-a=misiones]', this.hud);
    if (b) { const i = $('.insignia', b); i.textContent = A.length || ''; b.classList.toggle('con', A.length > 0); b.classList.toggle('lista', A.some((m) => m.e === 'lista')); }
    const p = $('.panel-misiones', this.hud); if (p) this.llenarMisiones(p);
  },
  panelMisiones() {
    if (!this.hud) return;
    let p = $('.panel-misiones', this.hud);
    if (p) { p.classList.add('sale'); setTimeout(() => p.remove(), 200); $('[data-a=misiones]', this.hud)?.classList.remove('abierto'); return; }
    p = el(`<div class="panel-misiones"><div class="pm-cabeza"><b>📜 ${t('mis_titulo')}</b><button class="noti-x" aria-label="cerrar">✕</button></div><div class="pm-lista"></div><small class="pm-hechas"></small></div>`);
    $('.noti-x', p).onclick = () => this.panelMisiones();
    this.hud.appendChild(p); $('[data-a=misiones]', this.hud)?.classList.add('abierto');
    this.llenarMisiones(p); this.J.sfx('elegir');
  },
  llenarMisiones(p) {
    const J = this.J, L = $('.pm-lista', p), A = J.misiones.activas(); L.innerHTML = '';
    if (!A.length) { const v = el('<p class="pm-nada"></p>'); v.textContent = t('mis_ninguna'); L.appendChild(v); }
    for (const m of A) {
      const d = el(`<div class="pm-mision ${m.e === 'lista' ? 'lista' : ''}"><div class="pm-fila"><b></b><span></span></div><div class="barrita"><i style="width:${Math.round(m.n / m.meta * 100)}%"></i></div><small></small></div>`);
      $('b', d).textContent = t('npc_' + m.id); $('span', d).textContent = m.e === 'lista' ? '✓' : `${m.n}/${m.meta}`;
      $('small', d).textContent = m.e === 'lista' ? t('mis_volver', { n: t('npc_' + m.id) }) : t('d_' + m.id + '_1', { n: m.n, m: m.meta });
      L.appendChild(d);
    }
    const hechas = Object.values(J.G.misiones || {}).filter((s) => s.e === 'hecha').length;
    $('.pm-hechas', p).textContent = hechas ? t('mis_hechas', { n: hechas }) : '';
  },
  /* el botón del micrófono: apagado, prendido, hablando, sin permiso */
  estadoVoz(estado, nivel = 0) {
    const b = this.hud && $('[data-a=voz]', this.hud); if (!b) return;
    b.dataset.voz = estado; b.style.setProperty('--nivel', Math.min(1, nivel).toFixed(2));
  },
  actualizarRed() {
    if (!this.hud) return;
    const R = this.J.red;
    $('.estado-red .punto', this.hud).className = 'punto ' + R.estado;
    $('.red-txt', this.hud).textContent = t(R.estado === 'en_linea' ? 'en_linea' : R.estado === 'conectando' ? 'conectando' : 'sin_red');
    $('.sala-txt', this.hud).textContent = R.estado === 'en_linea' && R.sala ? `${t('sala')} ${R.sala} · ${t('jugadores', { n: this.J.remotos.cuantos + 1 })}` : t('solo');
    /* compacta: el punto y cuántos hay; lo demás, al pasar por encima */
    $('.red-n', this.hud).textContent = R.estado === 'en_linea' ? String(this.J.remotos.cuantos + 1) : '';
    $('.estado-red', this.hud).title = $('.red-txt', this.hud).textContent + ' · ' + $('.sala-txt', this.hud).textContent;
    this.ubicarNotis();
  },
  /* los avisos: globitos de vidrio arriba de todo, como las notificaciones de
     Windows 7 (ícono, título, texto, la cruz y una rayita que marca el tiempo),
     con su campanita (timbres.js). **Uno solo a la vez** (25/09: al pasar de
     una zona a otra salían dos o tres): el nuevo reemplaza al que estaba, sin
     animación de salida. Si llega uno igual al que está, ese se renueva y suma
     ×2 en vez de repetirse. En el parkour no se muestran: no tapan la carrera. */
  notificar({ titulo = '', texto = '', icono = 'ℹ️', tipo = 'info', sonido = true }) {
    const c = this.hud && $('.notis', this.hud); if (!c) return null;
    if (this.hud.classList.contains('modo-parkour') && tipo !== 'error') return null;
    const clave = titulo + '|' + texto, igual = [...c.children].find((q) => q._clave === clave && !q.classList.contains('sale'));
    if (igual) {
      igual._veces = (igual._veces || 1) + 1; $('.noti-n', igual).textContent = '×' + igual._veces;
      this.programarNoti(igual); return igual;
    }
    const d = el(`<div class="noti ${tipo}" role="status"><div class="noti-ico"></div><div class="noti-txt">${titulo ? '<b></b>' : ''}<span></span></div><em class="noti-n"></em><button class="noti-x" aria-label="cerrar">✕</button><i class="noti-t"></i></div>`);
    $('.noti-ico', d).textContent = icono; if (titulo) $('b', d).textContent = titulo; $('span', d).textContent = texto;
    d._clave = clave;
    this.ubicarNotis();
    $('.noti-x', d).onclick = (e) => { e.stopPropagation(); this.cerrarNoti(d); };
    for (const q of [...c.children]) { clearTimeout(q._t); q.remove(); }
    c.prepend(d);
    this.programarNoti(d);
    if (sonido) timbre(tipo);
    return d;
  },
  /* van en el hueco entre los dos grupos de arriba; si no entran, una fila más abajo */
  ubicarNotis() {
    const h = this.hud, c = h && $('.notis', h), L = h && $('.arriba-izq', h), R = h && $('.arriba-der', h); if (!c || !L || !R) return;
    const W = h.offsetWidth, izq = L.offsetLeft + L.offsetWidth + 10, der = R.offsetLeft - 10, ancho = Math.min(320, der - izq);
    if (ancho >= 210) { c.style.width = ancho + 'px'; c.style.left = Math.round((izq + der) / 2) + 'px'; c.style.top = ''; }
    else { c.style.width = Math.min(320, W - 24) + 'px'; c.style.left = Math.round(W / 2) + 'px'; c.style.top = (Math.max(L.offsetTop + L.offsetHeight, R.offsetTop + R.offsetHeight) + 6) + 'px'; }
  },
  programarNoti(d) {
    const dur = Math.min(6500, 3200 + d.textContent.length * 35);
    clearTimeout(d._t); d._t = setTimeout(() => this.cerrarNoti(d), dur);
    const barra = $('.noti-t', d); barra.style.animation = 'none'; void barra.offsetWidth; barra.style.animation = ''; barra.style.setProperty('--dur', dur + 'ms');
  },
  cerrarNoti(d) { if (!d.isConnected || d.classList.contains('sale')) return; clearTimeout(d._t); d.classList.add('sale'); setTimeout(() => d.remove(), 280); },
  /* el aviso de siempre: si empieza con un emoji, ese es el ícono */
  avisar(texto, tipo = '') {
    this.historial = [...(this.historial || []), texto].slice(-30);   // (para las pruebas)
    const m = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/su.exec(String(texto));
    const k = tipo === 'bien' ? 'bien' : tipo === 'error' ? 'error' : 'info';
    this.notificar({ titulo: tipo ? t('noti_' + k) : '', texto: m ? m[2] : texto, icono: m ? m[1] : k === 'bien' ? '✔️' : k === 'error' ? '⛔' : 'ℹ️', tipo: k, sonido: !!tipo });
  },
  /* al entrar a una región: el aviso con su ícono (antes era un cartel grande en el medio) */
  lugar(nombre, icono = '') {
    this.historial = [...(this.historial || []), '@' + nombre].slice(-30);
    this.notificar({ titulo: t('noti_zona'), texto: nombre, icono: icono || '📍', tipo: 'zona' });
  },
  /* ------------------------------------------------------------ PARKOUR AERO */
  /* el menú de los cinco mapas: miniatura, nombre, récord, estrellas y candado */
  menuParkour(P, alElegir, alCerrar, alTiro) {
    const todo = el('<div class="pk-menu"><div class="pk-opciones"></div><div class="pk-cartas"></div></div>'), c = $('.pk-cartas', todo);
    /* el parkour en primera persona (como Mirror's Edge) o de atrás */
    const fp = el('<button class="boton chico pk-fp"></button>'), pintarFP = () => { fp.textContent = `${t('pk_fp')}: ${t(P.fp ? 'pk_fp_si' : 'pk_fp_no')}`; fp.classList.toggle('primario', !!P.fp); };
    fp.onclick = () => { P.fp = !P.fp; pintarFP(); this.J.sfx('elegir'); this.J.guardar(); }; pintarFP();
    const ayuda = el('<small class="pk-ayuda"></small>'); ayuda.textContent = t('pk_mov');
    $('.pk-opciones', todo).append(fp, ayuda);
    NIVELES.forEach((N, n) => {
      const abierto = n === 0 || P.mejor[n - 1] != null, est = P.estrellas[n] || 0;
      const b = el(`<button class="pk-carta ${abierto ? '' : 'bloq'}"><img alt=""><b></b><span class="est">${'★'.repeat(est)}${'☆'.repeat(3 - est)}</span><small></small>${abierto ? '' : '<i class="candado">🔒</i>'}</button>`);
      $('img', b).src = miniaturaParkour(n, 320, 200).toDataURL('image/jpeg', 0.85);
      $('b', b).textContent = `${n + 1}. ${t('pk_' + N.id)}`;
      $('small', b).textContent = !abierto ? t('pk_bloq') : P.mejor[n] != null ? t('pk_mejor', { s: formatoTiempo(P.mejor[n]) }) : t('pk_sin');
      if (abierto) b.onclick = () => { this.J.sfx('elegir'); v.cerrar(true); alElegir(n); };
      c.appendChild(b);
    });
    /* el tiro de burbujas (primera persona) */
    if (alTiro) {
      const T = this.J.G.tiro || {}, est = T.estrellas || 0;
      const b = el(`<button class="pk-carta tiro"><img alt=""><b></b><span class="est">${'★'.repeat(est)}${'☆'.repeat(3 - est)}</span><small></small></button>`);
      $('img', b).src = miniaturaTiro(320, 200).toDataURL('image/jpeg', 0.85);
      $('b', b).textContent = '🎯 ' + t('tiro_titulo'); $('small', b).textContent = T.mejor ? t('tiro_mejor', { n: T.mejor }) : t('tiro_desc');
      b.onclick = () => { this.J.sfx('elegir'); v.cerrar(true); alTiro(); };
      c.appendChild(b);
    }
    const v = this.ventana('🎮 ' + t('pk_titulo'), todo, { ancho: 900, alCerrar: () => alCerrar && alCerrar() });
    const cerrar0 = v.cerrar; v.cerrar = (sin) => { if (sin) { const f = alCerrar; alCerrar = null; cerrar0(); alCerrar = f; } else cerrar0(); };
    this.focoTeclado(v);
  },
  /* la píldora de arriba mientras se corre: mapa, reloj, caídas, reiniciar y salir */
  parkourHud(E) {
    if (!this.hud) return;
    let d = $('.pk-hud', this.hud);
    this.hud.classList.toggle('modo-parkour', !!E);
    if (!E) { d && d.remove(); return; }
    if (!d) {
      d = el(`<div class="pk-hud"><span class="pk-nombre"></span><span class="pk-reloj">0:00.0</span><span class="pk-caidas"></span><button class="redondo" data-a="otra" title="${t('pk_repetir')}">⟲</button><button class="redondo" data-a="salir" title="${t('pk_volver')}">✕</button></div>`);
      $('[data-a=otra]', d).onclick = () => this.J.parkourReiniciar(); $('[data-a=salir]', d).onclick = () => this.J.parkourSalir();
      this.hud.appendChild(d);
    }
    const tx = formatoTiempo(E.tiempo);
    if (d._t !== tx) { d._t = tx; $('.pk-reloj', d).textContent = '⏱ ' + tx; }
    const cc = `💧 ${E.caidas}`; if (d._c !== cc) { d._c = cc; $('.pk-caidas', d).textContent = cc; }
    const nn = `${NIVELES[E.nivel].icono} ${E.nombre}`; if (d._n !== nn) { d._n = nn; $('.pk-nombre', d).textContent = nn; }
    d.classList.toggle('fin', E.fase === 'fin');
  },
  /* TIRO DE BURBUJAS: la píldora de arriba (tiempo, puntos, racha, reiniciar y salir) */
  tiroHud(E) {
    if (!this.hud) return;
    let d = $('.pk-hud.tiro', this.hud);
    if (!E) { d && d.remove(); if (!$('.pk-hud', this.hud)) this.hud.classList.remove('modo-parkour'); return; }
    this.hud.classList.add('modo-parkour');
    if (!d) {
      d = el(`<div class="pk-hud tiro"><span class="pk-nombre">🎯 ${t('tiro_titulo')}</span><span class="pk-reloj">1:00</span><span class="pk-puntos">✨ 0</span><span class="pk-mult"></span><button class="redondo" data-a="otra" title="${t('pk_repetir')}">⟲</button><button class="redondo" data-a="salir" title="${t('pk_volver')}">✕</button></div>`);
      $('[data-a=otra]', d).onclick = () => this.J.tiroReiniciar(); $('[data-a=salir]', d).onclick = () => this.J.tiroSalir();
      this.hud.appendChild(d);
    }
    const s = Math.ceil(E.tiempo), tx = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (d._t !== tx) { d._t = tx; $('.pk-reloj', d).textContent = tx; d.classList.toggle('apurado', E.fase === 'juega' && E.tiempo < 10); }
    const pt = `✨ ${E.puntos}`; if (d._p !== pt) { d._p = pt; $('.pk-puntos', d).textContent = pt; }
    const mu = E.mult > 1 ? `×${E.mult}` : ''; if (d._m !== mu) { d._m = mu; const q = $('.pk-mult', d); q.textContent = mu; q.classList.remove('sube'); void q.offsetWidth; if (mu) q.classList.add('sube'); }
  },
  resultadoTiro(R, alRepetir, alVolver) {
    const punteria = R.tiros ? Math.round(R.aciertos / R.tiros * 100) : 0;
    const c = el(`<div class="pk-resultado"><div class="pk-est">${[0, 1, 2].map((i) => `<i class="${i < R.estrellas ? 'si' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</i>`).join('')}</div>
      <div class="pk-cifras"><div><small>${t('tiro_puntos')}</small><b>${R.puntos}</b></div><div><small>${t('tiro_aciertos')}</small><b>${R.aciertos}</b></div><div><small>${t('tiro_punteria')}</small><b>${punteria}%</b></div><div><small>${t('pk_orbes')}</small><b>+${R.premio}</b></div></div>
      ${R.record ? `<div class="pk-record">🏆 ${t('pk_record')}</div>` : ''}
      <div class="fila"><button class="boton primario" data-a="otra">⟲ ${t('pk_repetir')}</button><button class="boton" data-a="volver">${t('pk_volver')}</button></div></div>`);
    const v = this.ventana(`🎯 ${t('tiro_fin')}`, c, { ancho: 560 });
    $('[data-a=otra]', c).onclick = () => { v.cerrar(); alRepetir(); };
    $('[data-a=volver]', c).onclick = () => { v.cerrar(); alVolver(); };
    this.focoTeclado(v, '[data-a=otra]');
  },
  /* un destello verde en el reloj (el control, en vez de un aviso que tape) */
  pkDestello(clase = 'control') {
    const d = this.hud && $('.pk-hud', this.hud); if (!d) return;
    d.classList.remove(clase); void d.offsetWidth; d.classList.add(clase); setTimeout(() => d.classList.remove(clase), 700);
  },
  /* 3, 2, 1, ¡YA! (chico y arriba: no tapa el camino) */
  cuenta(txt, ya = false) {
    if (!this.hud || this._cuenta === txt) return;
    this._cuenta = txt;
    $('.pk-cuenta', this.hud)?.remove();
    const d = el(`<div class="pk-cuenta ${ya ? 'ya' : ''}"></div>`); d.textContent = txt; this.hud.appendChild(d);
    if (!ya) this.J.sfx('letra', { f: 900 });
    setTimeout(() => { d.remove(); if (this._cuenta === txt) this._cuenta = null; }, ya ? 900 : 1000);
  },
  resultadoParkour(R, alSiguiente, alRepetir, alVolver) {
    const N = NIVELES[R.nivel];
    const c = el(`<div class="pk-resultado"><div class="pk-est">${[0, 1, 2].map((i) => `<i class="${i < R.estrellas ? 'si' : ''}" style="animation-delay:${0.2 + i * 0.25}s">★</i>`).join('')}</div>
      <div class="pk-cifras"><div><small>${t('pk_tiempo')}</small><b>${formatoTiempo(R.tiempo)}</b></div><div><small>${t('pk_caidas')}</small><b>${R.caidas}</b></div><div><small>${t('pk_orbes')}</small><b>+${R.premio}</b></div></div>
      ${R.record ? `<div class="pk-record">🏆 ${t('pk_record')}</div>` : ''}
      <div class="fila">${R.hay ? `<button class="boton primario" data-a="sig">${t('pk_siguiente')} ▶</button>` : ''}<button class="boton" data-a="otra">⟲ ${t('pk_repetir')}</button><button class="boton" data-a="volver">${t('pk_volver')}</button></div></div>`);
    const v = this.ventana(`${N.icono} ${t('pk_fin')}`, c, { ancho: 560 });
    $('[data-a=otra]', c).onclick = () => { v.cerrar(); alRepetir(); };
    $('[data-a=volver]', c).onclick = () => { v.cerrar(); alVolver(); };
    if (R.hay) $('[data-a=sig]', c).onclick = () => { v.cerrar(); alSiguiente(); };
    this.focoTeclado(v, R.hay ? '[data-a=sig]' : '[data-a=otra]');
  },
  /* la pildorita del monorriel: cuánto falta, la próxima parada (null la saca) */
  estadoTren(texto) {
    if (!this.hud) return;
    let d = $('.tren-estado', this.hud);
    if (!texto) { d && d.remove(); this._tren = null; return; }
    if (this._tren === texto && d) return;
    this._tren = texto;
    if (!d) { d = el('<div class="tren-estado pildora"><i>🚝</i> <span></span></div>'); this.hud.appendChild(d); }
    d.lastElementChild.textContent = texto;
  },
  /* el punto del medio de la primera persona: se agranda y brilla cuando apunta a algo que se usa */
  mira(si, apunta = false) {
    let m = this.hud && $('.mira', this.hud);
    if (!si) { if (m) m.remove(); return; }
    if (!this.hud) return;
    if (!m) { m = el('<div class="mira"><i></i><b></b></div>'); this.hud.appendChild(m); }
    m.classList.toggle('apunta', !!apunta);
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
    const cerrar = () => { if (!f.isConnected) return; f.remove(); Teclado.cerrar(true); J.ent.bloqueado = false; this.hud && $('.chat', this.hud).classList.remove('abierto'); };
    f.onsubmit = (e) => { e.preventDefault(); if (i.value.trim()) J.decir(i.value); cerrar(); };
    i.onkeydown = (e) => { if (e.key === 'Escape') cerrar(); e.stopPropagation(); };
    this.hud.appendChild(f);
    /* en el celu, el teclado propio (el del sistema sale parado con el juego acostado) */
    if (J.ent.tactil) Teclado.abrir(i, { alEnviar: () => { if (i.value.trim()) J.decir(i.value); cerrar(); }, alCerrar: cerrar, sonido: () => J.sfx('letra', { f: 1200 + Math.random() * 400 }) });
    else { i.onblur = () => setTimeout(() => { if (f.isConnected) cerrar(); }, 150); i.focus(); }
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
    /* ojo: se agregó en captura, así que se saca en captura (si no, queda enganchado y se come el Escape de la pausa) */
    const cerrar = () => { if (!v.isConnected) return; v.remove(); if (this.ventanaAbierta === v) this.ventanaAbierta = null; removeEventListener('keydown', tecla, true); alCerrar && alCerrar(); };
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
      <button class="boton" data-a="estilo">👾 ${t('estilo_titulo')}</button><button class="boton" data-a="discos">${t('canal_discos')}</button>
      <button class="boton" data-a="menu" style="grid-column:1/-1">${t('salir_menu')}</button></div>`);
    const pie = `<div class="barra-pausa"><span class="p-nombre"></span><span><i class="orbe-icono" style="display:inline-block;width:14px;height:14px;vertical-align:-2px"></i> ${J.G.orbes}</span><span class="p-sala"></span></div>`;
    const v = this.ventana(t('pausa'), cuerpo, { alCerrar: () => J.pausar(false), pie });
    $('.p-nombre', v).textContent = J.G.nombre;
    $('.p-sala', v).textContent = J.red.estado === 'en_linea' && J.red.sala ? `${J.red.sala} · ${J.remotos.cuantos + 1}` : t('solo');
    cuerpo.querySelector('[data-a=seguir]').onclick = () => v.cerrar();
    cuerpo.querySelector('[data-a=probador]').onclick = () => { v.remove(); this.ventanaAbierta = null; J.pausar(false); J.abrirProbador(); };
    cuerpo.querySelector('[data-a=opciones]').onclick = () => this.opciones(() => this.pausa());
    cuerpo.querySelector('[data-a=controles]').onclick = () => this.controles(() => this.pausa());
    cuerpo.querySelector('[data-a=discos]').onclick = () => this.discos(() => this.pausa());
    cuerpo.querySelector('[data-a=estilo]').onclick = () => this.estilo(() => this.pausa());
    cuerpo.querySelector('[data-a=menu]').onclick = () => { v.remove(); this.ventanaAbierta = null; J.salirAlMenu(); };
    this.focoTeclado(v, '[data-a=seguir]');
  },
  segmentos(opciones, actual, alElegir) {
    const s = el('<div class="segmentos"></div>');
    for (const [v, txt] of opciones) { const b = el(`<button class="${v === actual ? 'si' : ''}"></button>`); b.textContent = txt; b.onclick = () => { s.querySelectorAll('button').forEach((q) => q.classList.remove('si')); b.classList.add('si'); alElegir(v); }; s.appendChild(b); }
    return s;
  },
  /* pestañas arriba y el contenido abajo, para que nada tenga que desplazarse.
     defs: [[id, 'emoji', 'nombre', (caja) => {...}]] */
  pestanas(defs, inicial = defs[0][0], alCambiar = () => {}) {
    const c = el('<div class="con-pestanas"><div class="tira"></div><div class="panel"></div></div>'), tira = $('.tira', c), panel = $('.panel', c);
    const ir = (id) => {
      tira.querySelectorAll('button').forEach((b) => b.classList.toggle('si', b.dataset.t === id));
      panel.innerHTML = ''; const d = defs.find((q) => q[0] === id); d[3](panel); panel.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 180 });
      alCambiar(id); this.J.sfx('elegir');
    };
    for (const [id, emo, nombre] of defs) { const b = el(`<button data-t="${id}"><i>${emo}</i><span></span></button>`); b.lastElementChild.textContent = nombre; b.onclick = () => ir(id); tira.appendChild(b); }
    c.ir = ir; setTimeout(() => ir(inicial), 0);
    return c;
  },
  fila(etiqueta, control) { const f = el('<div class="op"><span></span></div>'); f.firstElementChild.textContent = etiqueta; f.appendChild(control); return f; },
  deslizador(min, max, paso, valor, alMover) { const i = el(`<input type="range" min="${min}" max="${max}" step="${paso}" value="${valor}">`); i.oninput = () => alMover(+i.value); return i; },
  opciones(volver, pest = 'sonido') {
    const J = this.J, O = J.G.opciones, A = J.aparato || {};
    const c = this.pestanas([
      ['sonido', '🔊', t('op_t_sonido'), (p) => {
        p.appendChild(this.fila(t('op_idioma'), this.segmentos(IDIOMAS.map((i) => [i, i.toUpperCase()]), idioma(), (i) => { ponerIdioma(i); J.G.idioma = i; J.guardar(); J.alCambiarIdioma(); this.opciones(volver, 'sonido'); })));
        p.appendChild(this.fila(t('op_musica'), this.deslizador(0, 1, 0.05, O.musica, (v) => { O.musica = v; J.volumen(); J.guardar(); })));
        p.appendChild(this.fila(t('op_efectos'), this.deslizador(0, 1, 0.05, O.efectos, (v) => { O.efectos = v; J.volumen(); J.guardar(); })));
        p.appendChild(this.fila('🎤 ' + t('op_voz'), this.deslizador(0, 1.5, 0.05, O.volVoz ?? 1, (v) => J.volumenVoz(v))));
      }],
      ['imagen', '🖥️', t('op_t_imagen'), (p) => {
        p.appendChild(this.fila(t('op_anim'), this.segmentos(['suave', 'lineal', 'chop'].map((q) => [q, t('anim_' + q)]), O.animEstilo || 'suave', (q) => { O.animEstilo = q; J.ponerAnim(q); J.guardar(); })));
        p.appendChild(this.fila(t('op_calidad'), this.segmentos(['auto', 'alta', 'media', 'baja'].map((q) => [q, t('cal_' + q)]), O.calidad, (q) => { O.calidad = q; J.ponerCalidad(q); J.guardar(); document.body.classList.toggle('calidadBaja', q === 'baja'); })));
        const ap = el('<div class="aparato"><i>🔎</i><div><b></b><small></small></div></div>');
        $('b', ap).textContent = t('op_aparato', { q: t('cal_' + (A.calidad || 'media')) });
        $('small', ap).textContent = [A.gpu || '?', A.mem ? A.mem + ' GB' : '', A.nucleos ? A.nucleos + ' ' + t('op_nucleos') : '', A.tactil ? '✋' : '🖱️'].filter(Boolean).join(' · ');
        p.appendChild(ap);
        const btnEstilo = el(`<button class="boton chico primario">👾 ${t('estilo_titulo')}</button>`);
        btnEstilo.onclick = () => this.estilo(() => this.opciones(volver, 'imagen'));
        p.appendChild(this.fila(t('op_retro'), btnEstilo));
      }],
      ['juego', '🎮', t('op_t_juego'), (p) => {
        p.appendChild(this.fila(t('op_camara'), this.deslizador(0.3, 2.5, 0.1, O.sensCam, (v) => { O.sensCam = v; J.guardar(); })));
        p.appendChild(this.fila(t('op_invertir'), this.segmentos([[false, t('no')], [true, t('si')]], O.invertirY, (v) => { O.invertirY = v; J.guardar(); })));
        p.appendChild(this.fila(t('op_cam_auto'), this.segmentos([[true, t('si')], [false, t('no')]], O.camAuto !== false, (v) => { O.camAuto = v; J.guardar(); })));
        p.appendChild(this.fila(t('op_nombres'), this.segmentos([[true, t('si')], [false, t('no')]], O.nombres, (v) => { O.nombres = v; J.guardar(); J.mostrarNombres(); })));
        p.appendChild(this.fila(t('op_reloj'), this.segmentos([[true, t('si')], [false, t('no')]], O.reloj24, (v) => { O.reloj24 = v; J.guardar(); })));
        /* con el celu parado el juego se acuesta solo (sin pantalla completa); para qué lado, o no girarlo */
        if (Pantalla.tactil) p.appendChild(this.fila(t('op_giro'), this.segmentos([['auto', t('giro_auto')], ['normal', t('giro_normal')], ['reves', t('giro_reves')], ['no', t('giro_no')]], O.giro || 'auto', (v) => { O.giro = v; J.guardar(); Pantalla.ponerGiro(v); })));
      }],
      ['datos', '💾', t('op_t_datos'), (p) => {
        const res = el('<div class="resumen"></div>');
        for (const [emo, n] of [['🫧', J.G.orbes + ' ' + t('orbes')], ['💿', J.G.discos.length + '/' + TOTAL_DISCOS], ['✅', Object.values(J.G.misiones || {}).filter((m) => m.e === 'hecha').length + ' ' + t('op_misiones')], ['👕', (J.G.tengo || []).length + ' ' + t('op_cosas')]]) { const d = el('<div><i></i><b></b></div>'); d.firstElementChild.textContent = emo; d.lastElementChild.textContent = n; res.appendChild(d); }
        p.appendChild(res);
        const borrar = el(`<button class="boton chico" style="border-color:#ffb3c0;color:#e0405e">${t('op_borrar')}</button>`);
        borrar.onclick = () => this.confirmar(t('op_borrar_seguro'), () => J.borrarTodo());
        p.appendChild(this.fila('', borrar));
      }],
    ], pest);
    this.ventana(t('canal_opciones'), c, { alCerrar: volver, ancho: 660 });
  },
  controles(volver) {
    const J = this.J, C = J.ent.config;
    const txt = (p, s2) => { const q = el('<p class="texto-ctl"></p>'); q.textContent = s2; p.appendChild(q); };
    const c = this.pestanas([
      ['teclado', '⌨️', t('ctl_teclado'), (p) => txt(p, t('ctl_teclas'))],
      ['mando', '🎮', t('ctl_mando'), (p) => txt(p, t('ctl_mando_txt'))],
      ['dedos', '✋', t('ctl_dedos'), (p) => {
        const editar = el(`<button class="boton primario chico">${t('ctl_editar')}</button>`);
        editar.onclick = () => { this.cerrarVentana(); this.editorDedos(volver); };
        p.appendChild(this.fila(t('ctl_botones'), editar));
        p.appendChild(this.fila(t('ctl_palanca'), this.segmentos([['fija', t('ctl_fija')], ['flotante', t('ctl_flotante')]], C.palanca, (v) => { C.palanca = v; J.guardarControles(); })));
        p.appendChild(this.fila(t('ctl_zurdo'), this.segmentos([[false, t('no')], [true, t('si')]], C.zurdo, (v) => { C.zurdo = v; J.ent.ubicarDedos(); J.guardarControles(); })));
        p.appendChild(this.fila(t('ctl_vibra'), this.segmentos([[true, t('si')], [false, t('no')]], C.vibra, (v) => { C.vibra = v; J.guardarControles(); })));
      }],
    ], J.ent.tactil ? 'dedos' : 'teclado');
    this.ventana(t('ctl_titulo'), c, { alCerrar: volver, ancho: 620 });
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
    const c = el('<div class="lista-discos grilla"></div>');
    const auto = el(`<button class="disco-fila ${!J.musicaElegida ? 'si' : ''}"><div class="disco"></div><span>${t('cal_auto')}</span></button>`);
    auto.onclick = () => { J.elegirMusica(null); this.discos(volver); };
    c.appendChild(auto);
    /* solo las canciones que están en esta versión */
    for (const k of CANCIONES.filter((k) => J.hayCancion(k))) {
      const tiene = J.cancionDesbloqueada(k);
      const b = el(`<button class="disco-fila ${tiene ? '' : 'bloq'} ${J.musicaElegida === k ? 'si' : ''}"><div class="disco"></div><span></span></button>`);
      b.lastElementChild.textContent = tiene ? t('can_' + k) + (J.musicaElegida === k ? ' · ' + t('disco_sonando') : '') : '??? · ' + t('disco_bloq');
      if (tiene) b.onclick = () => { J.elegirMusica(k); this.discos(volver); };
      c.appendChild(b);
    }
    this.ventana(t('discos_titulo') + ` · ${J.G.discos.length}/${TOTAL_DISCOS}`, c, { alCerrar: volver, ancho: 720 });
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
  probador(alCerrar, alGirar = () => {}) {
    const J = this.J, G = J.G;
    let pest = 'color', grupo = 'cuerpo', pag = 0;
    /* dos grupos de seis pestañas (el cuerpo y las cosas): entran en una fila sin desplazar */
    const GRUPOS = {
      cuerpo: [['color', '🎨', t('prob_color')], ['color2', '🌈', t('prob_color2')], ['ojos', '👀', t('prob_ojos')], ['motivo', '🌀', t('prob_motivo')], ['motivoCabeza', '🙂', t('prob_cabeza')], ['material', '✨', t('prob_material')]],
      cosas: [['sombrero', '🎩', t('prob_sombrero')], ['peinado', '💇', t('prob_pelo')], ['colorPelo', '🖌️', t('prob_color_pelo')], ['anteojos', '🕶️', t('prob_anteojos')], ['espalda', '🎒', t('prob_espalda')], ['particulas', '💫', t('prob_particulas')]],
    };
    const p = this.poner(el(`<div class="probador"><div class="cabeza" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px"><h2 style="margin:0;font-size:22px">${t('prob_titulo')}</h2><div class="segmentos grupos"><button data-g="cuerpo">${t('prob_cuerpo')}</button><button data-g="cosas">${t('prob_cosas')}</button></div><span class="pildora" style="font-size:15px"><i class="orbe-icono"></i><span class="p-orbes"></span></span></div>
      <div class="pestanas"></div><div class="opciones-prob"></div>
      <div class="paginas"><button class="redondo" data-pg="-1">◀</button><span></span><button class="redondo" data-pg="1">▶</button></div>
      <div class="prob-pie"><input maxlength="16"><button class="boton chico" data-a="azar">🎲</button><button class="boton chico primario" data-a="listo">${t('listo')}</button></div></div>`));
    const tira = $('.pestanas', p), paginas = $('.paginas', p);
    const ponerTira = () => {
      tira.innerHTML = GRUPOS[grupo].map(([k, e, n]) => `<button data-p="${k}"><i>${e}</i><span>${n}</span></button>`).join('');
      tira.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { pest = b.dataset.p; pag = 0; J.sfx('elegir'); dibujar(); });
      p.querySelectorAll('[data-g]').forEach((b) => b.classList.toggle('si', b.dataset.g === grupo));
    };
    p.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { grupo = b.dataset.g; pest = GRUPOS[grupo][0][0]; pag = 0; ponerTira(); dibujar(); });
    paginas.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => { pag += +b.dataset.pg; J.sfx('elegir'); dibujar(); });
    /* lo que no entra va en páginas (◀ ▶) en vez de desplazar: se mide cuántas caben */
    const paginar = (extra, items) => {
      grilla.innerHTML = ''; if (extra) grilla.appendChild(extra);
      for (const b of items) grilla.appendChild(b);
      const cols = Math.max(1, getComputedStyle(grilla).gridTemplateColumns.split(' ').length);
      const alto = items[0] ? items[0].offsetHeight + 10 : 90, libre = grilla.clientHeight - 24 - (extra ? extra.offsetHeight + 10 : 0);
      const filas = Math.max(1, Math.floor((libre + 10) / alto)), por = filas * cols, n = Math.max(1, Math.ceil(items.length / por));
      pag = Math.max(0, Math.min(n - 1, pag));
      items.forEach((b, i) => { if (i < pag * por || i >= (pag + 1) * por) b.remove(); });
      paginas.classList.toggle('una', n <= 1);
      paginas.querySelector('span').textContent = `${pag + 1} / ${n}`;
      paginas.querySelector('[data-pg="-1"]').disabled = pag <= 0; paginas.querySelector('[data-pg="1"]').disabled = pag >= n - 1;
    };
    /* las flechas verdes para girar el muñeco (como en los videos); también se gira arrastrando */
    const giros = this.poner(el(`<div class="giros"><button class="flecha-giro" data-g="-1">⟲</button><button class="flecha-giro" data-g="1">⟳</button></div>`));
    giros.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => alGirar(+b.dataset.g * 0.8));
    const nombre = $('input', p); nombre.value = G.nombre; nombre.placeholder = t('prob_nombre');
    nombre.onfocus = () => { J.ent.bloqueado = true; }; nombre.onblur = () => { if (!Teclado.abierto) J.ent.bloqueado = false; };
    if (J.ent.tactil) nombre.onpointerdown = (e) => { e.preventDefault(); J.ent.bloqueado = true; Teclado.abrir(nombre, { alEnviar: () => { J.ent.bloqueado = false; }, alCerrar: () => { J.ent.bloqueado = false; }, sonido: () => J.sfx('letra', { f: 1200 + Math.random() * 400 }) }); };
    nombre.onkeydown = (e) => e.stopPropagation();
    nombre.oninput = () => { const v = nombre.value.replace(/[<>]/g, '').trim(); if (v) { G.nombre = v.slice(0, 16); J.cambiarNombre(); } };
    const grilla = $('.opciones-prob', p);
    const dibujar = () => {
      $('.p-orbes', p).textContent = G.orbes;
      p.querySelectorAll('[data-p]').forEach((b) => b.classList.toggle('si', b.dataset.p === pest));
      grilla.classList.toggle('colores', pest === 'color' || pest === 'color2' || pest === 'colorPelo');
      const items = []; let extra = null;
      if (pest === 'color' || pest === 'color2' || pest === 'colorPelo') {
        const lista = pest === 'colorPelo' ? PALETA_PELO : PALETA;
        if (pest === 'color2') { extra = el(`<div class="deslizador"><span>${t('prob_degrade')}</span></div>`); extra.appendChild(this.deslizador(0, 1, 0.05, G.A.degrade ?? 0.55, (v) => { G.A.degrade = v; J.aplicarApariencia(); })); }
        for (const c of lista) { const b = el(`<button class="color ${G.A[pest] === c ? 'si' : ''}" style="background:${c}"></button>`); b.onclick = () => { G.A[pest] = c; J.aplicarApariencia(); dibujar(); }; items.push(b); }
        const libre = el(`<label class="color" style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);display:block"><input type="color" style="opacity:0;width:100%;height:100%"></label>`);
        const inp = $('input', libre); inp.value = G.A[pest]; inp.oninput = () => { G.A[pest] = inp.value; J.aplicarApariencia(); };
        items.push(libre);
        paginar(extra, items);
        return;
      }
      const R = RANURAS.find((q) => q.r === pest);
      if (pest === 'motivo') {
        extra = el(`<div class="deslizador"><span>${t('prob_cubre')}</span></div>`);
        extra.appendChild(this.deslizador(0, 1.3, 0.02, G.A.cubre, (v) => { G.A.cubre = v; J.aplicarApariencia(); }));
      }
      for (const v of R.lista) {
        const clave = pest + ':' + v, tiene = loTengo(G, clave), pr = precio(clave), mis = DE_MISION[clave];
        const tex = (pest === 'motivo' || pest === 'motivoCabeza') && v !== 'ninguno' && v !== 'igual' && window.ARCHIVOS && window.ARCHIVOS['motivo-' + v + '.webp'];
        const b = el(`<button class="item ${G.A[pest] === v ? 'si' : ''} ${tiene ? '' : 'bloq'}">${tex ? `<span class="muestra" style="background-image:url(${tex})"></span>` : ''}<span class="n"></span>${tiene ? '' : mis ? `<span class="precio">🔒</span>` : `<span class="precio"><i class="orbe-icono"></i>${pr}</span>`}${tiene ? '' : '<span class="candado">🔒</span>'}</button>`);
        $('.n', b).textContent = v === 'igual' ? t('mot_igual') : t(R.pre + '_' + v);
        b.onclick = () => {
          if (tiene) { G.A[pest] = v; J.aplicarApariencia(); dibujar(); return; }
          if (mis) { J.avisarPantalla(t('prob_bloq_mision') + ' · ' + t('npc_' + mis)); J.probarPuesto(pest, v); return; }
          J.probarPuesto(pest, v);
          if (G.orbes < pr) { J.avisarPantalla(t('prob_faltan', { n: pr - G.orbes })); J.sfx('no'); return; }
          this.confirmar(t('prob_comprar', { q: t(R.pre + '_' + v), n: pr }), () => { G.orbes -= pr; G.tengo.push(clave); G.A[pest] = v; J.aplicarApariencia(); J.sfx('orbe'); J.avisarPantalla(t('prob_comprado')); dibujar(); }, () => J.aplicarApariencia());
        };
        items.push(b);
      }
      paginar(extra, items);
    };
    ponerTira();
    const alGirarPantalla = () => { if (p.isConnected) dibujar(); };
    Pantalla.alCambiar.push(alGirarPantalla);
    $('[data-a=azar]', p).onclick = () => {
      const r = (l) => l[Math.floor(Math.random() * l.length)];
      G.A.color = r(PALETA); G.A.color2 = r(PALETA); G.A.colorPelo = r(PALETA_PELO); G.A.cubre = Math.random() * 0.9;
      for (const R of RANURAS) { const ok = R.lista.filter((v) => loTengo(G, R.r + ':' + v)); G.A[R.r] = r(ok); }
      G.A.degrade = Math.random(); if (Math.random() < 0.7) G.A.motivoCabeza = 'igual'; if (Math.random() < 0.6) G.A.ojos = 'ovalos';
      J.aplicarApariencia(); dibujar();
    };
    $('[data-a=listo]', p).onclick = () => { Teclado.cerrar(true); p.remove(); giros.remove(); J.ent.bloqueado = false; Pantalla.alCambiar.splice(Pantalla.alCambiar.indexOf(alGirarPantalla), 1); alCerrar(); };
    requestAnimationFrame(() => dibujar());
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
  /* ------------------------------------------------------------ estilo retro */
  estilo(volver, pest = 'estilos') {
    const J = this.J, G = J.G;
    const iconos = { normal: '✨', pixel: '👾', ps1: '🕹️', tubo: '📺', gameboy: '🟩', ochobits: '🎨', vhs: '📼' };
    const R = G.opciones.retro;
    const c = this.pestanas([
      ['estilos', '👾', t('estilo_titulo'), (p) => {
        const g = el('<div class="estilos"></div>');
        for (const n of Object.keys(ESTILOS)) {
          const b = el(`<button class="estilo-carta ${G.opciones.estilo === n ? 'si' : ''}" data-e="${n}"><span class="muestra-estilo ${n}" style="${muestraEstilo(n) ? `background-image:url(${MUESTRAS[n]})` : ''}"><span>${iconos[n]}</span></span><b>${t('est_' + n)}</b><small>${t('est_' + n + '_d')}</small>${ESTILOS[n].pix >= 2 ? `<i class="rapido">⚡ ${t('est_rapido')}</i>` : ''}</button>`);
          b.onclick = () => { J.ponerEstilo(n); J.sfx('guino'); this.estilo(volver, 'estilos'); };
          g.appendChild(b);
        }
        p.appendChild(g);
      }],
      ['ajuste', '🎛️', t('estilo_ajuste'), (p) => {
        const pon = (k, v) => { R[k] = v; J.ponerRetro(); J.guardar(); };
        const dos = el('<div class="dos-columnas"></div>'); p.appendChild(dos);
        dos.appendChild(this.fila(t('op_pix'), this.segmentos([[0, t('op_ninguno')], ...ALTOS_PIXEL.slice(1).map((a, i) => [i + 1, a + 'p'])], R.pix, (v) => pon('pix', v))));
        dos.appendChild(this.fila(t('estilo_paleta'), this.segmentos([[0, t('paleta_no')], [1, t('paleta_gb')], [2, t('paleta_8')]], R.paleta || 0, (v) => pon('paleta', v))));
        dos.appendChild(this.fila(t('op_niveles'), this.segmentos([[0, t('op_ninguno')], [1, '32'], [2, '16'], [3, '8'], [4, '5']], R.niveles, (v) => pon('niveles', v))));
        const onoff = (k) => this.segmentos([[0, t('no')], [1, t('si')]], R[k] ? 1 : 0, (v) => pon(k, v));
        for (const [k, n] of [['trama', 'op_trama'], ['ps1', 'estilo_ps1'], ['barrido', 'op_barrido'], ['tubo', 'op_tubo'], ['aberracion', 'op_aberracion'], ['vhs', 'est_vhs']]) dos.appendChild(this.fila(t(n), onoff(k)));
      }],
    ], pest);
    this.ventana(t('estilo_titulo'), c, { ancho: 760, alCerrar: volver });
  },

  /* preguntar sí o no dentro del juego (confirm() del navegador no anda en todos lados) */
  confirmar(texto, alSi, alNo = () => {}) {
    const d = this.poner(el(`<div class="velo" style="z-index:25"><div class="ventana" style="width:min(440px,92vw)"><div class="cuerpo" style="display:flex;flex-direction:column;gap:16px;text-align:center"><b style="font-size:19px;line-height:1.4"></b><div class="fila"><button class="boton chico" data-a="no">${t('no')}</button><button class="boton chico primario" data-a="si">${t('si')}</button></div></div></div></div>`));
    $('b', d).textContent = texto;
    const fin = (f) => { d.remove(); f(); };
    $('[data-a=si]', d).onclick = () => fin(alSi); $('[data-a=no]', d).onclick = () => fin(alNo);
    setTimeout(() => $('[data-a=si]', d).focus(), 50);
  },
  /* un error: se avisa sin tapar el juego, con dos salidas */
  error(msg, alBajar) {
    if (!this.raiz) return;
    const d = this.poner(el(`<div class="cartel-error"><b>⚠️ ${t('error_titulo')}</b><p></p><small></small><div class="fila"><button class="boton chico" data-a="baja">${t('error_baja')}</button><button class="boton chico" data-a="recargar">${t('error_recargar')}</button><button class="boton chico primario" data-a="ok">${t('seguir')}</button></div></div>`));
    $('p', d).textContent = t('error_texto'); $('small', d).textContent = msg;
    $('[data-a=ok]', d).onclick = () => d.remove();
    $('[data-a=baja]', d).onclick = () => { alBajar(); d.remove(); };
    $('[data-a=recargar]', d).onclick = () => location.reload();
  },
  /* el cartel del tutorial (null lo saca) */
  tuto(texto) {
    if (!this.hud) return;
    let d = $('.tuto', this.hud);
    if (!texto) { d && d.remove(); this._tuto = null; return; }
    if (this._tuto === texto && d) return;
    this._tuto = texto;
    if (!d) { d = el('<div class="tuto"></div>'); this.hud.appendChild(d); }
    d.textContent = texto; d.style.animation = 'none'; void d.offsetWidth; d.style.animation = '';
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
