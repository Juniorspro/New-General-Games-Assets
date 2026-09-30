// Globo Libre, de JXSTUDIOS: el arranque, las pantallas y el bucle.
//
// Cada cuadro la partida avanza lo que tardó el cuadro, en pasos de a lo sumo
// 1/60 s (y adentro, la física en pasos de 1/120), y se dibuja una vez. Los
// menús son HTML arriba del lienzo; el lienzo dibuja detrás el cielo, el
// cartel que se hamaca y lo que se está eligiendo en la tienda.
//
// Para probar: ?sinintro (directo al menú), ?directo=nivel:4 o
// ?directo=infinito, ?pausa (no avanza solo: __G.pasos(n); también saltea la
// intro, salvo con ?intro), ?limpio (sin lo guardado), ?idioma=en.
import { Partida } from './partida.js';
import { NIVELES, ANCHO } from './niveles.js';
import { TEMAS, temaDeNivel } from './temas.js';
import { dibujarPartida, dibujarGlobo, dibujarEscudo } from './dibujo.js';
import { dibujarHud } from './hud.js';
import { FondoMenu } from './menu.js';
import { crearEntrada } from './entrada.js';
import { crearSonido } from './sonido.js';
import { crearIdioma, IDIOMAS } from './idioma.js';
import { cargar, guardar, base } from './guardado.js';
import { GLOBOS, ESCUDOS, globoPorId, escudoPorId } from './pieles.js';
import { IntroJXS } from './intro.js';
import { clamp, trozos } from './util.js';

const PASO = 1 / 60;
const SENS = { baja: 1.0, media: 1.3, alta: 1.7 };
const TECLAS_VEL = 430;              // el escudo con las flechas, en unidades por segundo
const COLOR_CIELO = { dia: '#3d8bff', tarde: '#ff9f43', noche: '#6c3cc4' };
const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const lienzo = $('juego'), g = lienzo.getContext('2d');

let datos = q.has('limpio') ? base() : cargar();
if (IDIOMAS.includes(q.get('idioma'))) datos.ajustes.idioma = q.get('idioma');
const tr = crearIdioma(datos.ajustes.idioma);
const sonido = crearSonido(datos.ajustes);
const entrada = crearEntrada(lienzo);
const tactil = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const guardarTodo = () => guardar(datos);
// antes del primer toque el navegador no deja vibrar (y lo avisa en la consola)
const vibrar = (p) => { if (datos.ajustes.vibrar && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) try { navigator.vibrate(p); } catch { /* no deja */ } };

// ── la pantalla: resolución de verdad, con tope según la calidad ──────────
let W = 0, H = 0, dpr = 1, dprTope = tactil ? 1.5 : 2;
function medir() {
  const tope = datos.ajustes.calidad === 'baja' ? 1 : datos.ajustes.calidad === 'alta' ? 2.5 : dprTope;
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, tope));
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (w !== W || h !== H) { W = lienzo.width = w; H = lienzo.height = h; }
}
medir();
addEventListener('resize', medir);

let estado = 'espera', partida = null, intro = null, t = 0, sacudida = 0, avisado = false, recordNuevo = false;
const fondo = new FondoMenu();
const tienda = { tipo: 'globos', i: 0 };

// la cámara del juego: el mundo (360 de ancho) entra a lo ancho en el
// teléfono parado; acostado, se ven al menos 560 de alto y sobran costados
function camara() {
  const esc = Math.min(W / ANCHO, H / 560);
  const sx = sacudida > 0 ? (Math.random() - 0.5) * sacudida * 14 * dpr : 0, sy = sacudida > 0 ? (Math.random() - 0.5) * sacudida * 14 * dpr : 0;
  return { esc, ox: (W - ANCHO * esc) / 2 + sx, arriba: partida.arriba() + sy / esc };
}

// ── las pantallas de HTML ──────────────────────────────────────────────────
function mostrar(id) {
  for (const s of document.querySelectorAll('.pantalla')) s.classList.toggle('oculto', s.id !== id);
  $('bPausa').classList.toggle('oculto', id !== null || estado !== 'juego');
}
function boton(id, fn) { $(id).addEventListener('click', () => { sonido.tocar('boton'); fn(); }); }

function textos() {
  document.documentElement.lang = tr.actual();
  const n = Math.min(datos.abierto, NIVELES - 1);
  $('tJugar').textContent = tr('jugar');
  $('tNivelJugar').textContent = datos.abierto >= NIVELES ? tr('todos') : tr('nivel', n + 1);
  $('bNiveles').textContent = tr('niveles'); $('bInfinito').textContent = tr('infinito');
  $('bTienda').textContent = tr('tienda'); $('bAjustes').textContent = tr('ajustes');
  $('tRecordMenu').textContent = datos.mejorAltura ? tr('record', datos.mejorAltura) : '';
  $('tFirma').textContent = tr('creditos').toUpperCase();
  $('tMonedas').textContent = datos.monedas; $('tMonedasTienda').textContent = datos.monedas;
  $('tNiveles').textContent = tr('niveles'); $('bVolverNiveles').textContent = tr('volver');
  $('bPestGlobos').textContent = tr('globos'); $('bPestEscudos').textContent = tr('escudos'); $('bVolverTienda').textContent = tr('volver');
  $('tAjustes').textContent = tr('ajustes'); $('bCerrarAjustes').textContent = tr('volver');
  $('tPausa').textContent = tr('pausa'); $('bSeguir').textContent = tr('seguir'); $('bSalirPausa').textContent = tr('menu');
  $('tPum').textContent = tr('pum'); $('bOtraVez').textContent = tr('otraVez'); $('bMenuPum').textContent = tr('menu');
  $('tGano').textContent = tr('superado'); $('bSiguienteNivel').textContent = tr('siguiente'); $('bMenuGano').textContent = tr('menu');
}

// ── el ir y venir ──────────────────────────────────────────────────────────
function entrar() {
  if (estado !== 'espera') return;
  sonido.despertar();
  estado = 'intro'; mostrar(null);
  intro = new IntroJXS({ sonido, vibrar, alTerminar: () => (datos.ajustes.idioma ? aMenu() : elegirIdioma()) });
  intro.textoPresenta = tr('presenta');
}
// después del logo, la primera vez, elegir el idioma (?idioma= ya lo trae elegido)
function elegirIdioma() {
  estado = 'idiomas'; mostrar('idiomas');
  sonido.musica('menu');
  setTimeout(() => $('bIdioma_' + tr.actual())?.focus(), 50);
}
// dónde empiezan los botones del menú (en píxeles de CSS), para que el globo de muestra no quede detrás
let topeBotones = Infinity;
function medirBotones() { const r = $('bJugar').getBoundingClientRect(); if (r.height) topeBotones = r.top; }
addEventListener('resize', () => { if (estado === 'menu') medirBotones(); });
function aMenu() {
  estado = 'menu'; partida = null;
  entrada.activo = false; entrada.soltarTodo();
  sonido.musica('menu');
  textos(); mostrar('menu');
  medirBotones();
}
function jugar(n = Math.min(datos.abierto, NIVELES - 1)) {
  partida = new Partida({ nivel: clamp(n, 0, NIVELES - 1) });
  empezar();
}
function infinito() {
  partida = new Partida({ infinito: true, semilla: (Date.now() & 0xffff) + 1 });
  empezar();
}
function empezar() {
  datos.partidas++; guardarTodo();
  estado = 'juego'; avisado = false; recordNuevo = false; sacudida = 0;
  mostrar(null);
  entrada.activo = true; entrada.soltarTodo(); entrada.toques = 0;
  sonido.musica('juego');
}
function pausar() { if (estado !== 'juego' || !partida || partida.estado !== 'juego') return; estado = 'pausa'; entrada.soltarTodo(); mostrar('pausa'); }
function seguir() { if (estado !== 'pausa') return; estado = 'juego'; mostrar(null); }

// cuando la partida termina (reventó o llegó), un rato después, la pantalla del final
function terminar() {
  const p = partida;
  if (p.estado === 'pum') {
    estado = 'pum';
    datos.monedas += p.tomadas;
    if (p.infinito) {
      const m = Math.floor(p.altura() / 10);
      recordNuevo = m > datos.mejorAltura;
      if (recordNuevo) datos.mejorAltura = m;
      $('tPumCausa').textContent = tr('llegaste', m);
      $('tPumRecord').textContent = recordNuevo ? tr('nuevoRecord') : '';
    } else {
      $('tPumCausa').textContent = tr('reventado') + ' · ' + Math.round(p.progreso() * 100) + '%';
      $('tPumRecord').textContent = '';
    }
    $('tPumDato').textContent = p.tomadas ? tr('juntaste', p.tomadas) : '';
    guardarTodo(); mostrar('pum');
    setTimeout(() => $('bOtraVez').focus({ preventScroll: true }), 50);
  } else {
    estado = 'gano';
    const premio = p.tomadas + 10 + p.nivel * 2;
    datos.monedas += premio;
    datos.abierto = Math.max(datos.abierto, p.nivel + 1);
    guardarTodo();
    $('tGanoMonedas').textContent = tr('ganaste', premio);
    $('tGano').textContent = p.nivel + 1 >= NIVELES ? tr('todos') : tr('superado');
    $('bSiguienteNivel').classList.toggle('oculto', p.nivel + 1 >= NIVELES);
    mostrar('gano');
    setTimeout(() => $('bSiguienteNivel').focus({ preventScroll: true }), 50);
  }
  entrada.activo = false; entrada.soltarTodo();
}
function otraVez() { if (partida?.infinito) infinito(); else jugar(partida ? partida.nivel : 0); }

// ── los niveles ────────────────────────────────────────────────────────────
function armarNiveles() {
  const grilla = $('grillaNiveles');
  grilla.textContent = '';
  for (let c = 0; c < 3; c++) {
    const h = document.createElement('h3'); h.textContent = tr('cielo_' + TEMAS[c].id); grilla.appendChild(h);
    const caja = document.createElement('div'); caja.className = 'cielo';
    for (let n = c * 10; n < c * 10 + 10; n++) {
      const b = document.createElement('button');
      const abierto = n <= datos.abierto;
      b.className = 'nivelB' + (abierto ? '' : ' cerrado') + (n < datos.abierto ? ' hecho' : '');
      b.style.background = COLOR_CIELO[TEMAS[c].id];
      b.textContent = abierto ? String(n + 1) : '🔒';
      b.setAttribute('aria-label', tr('nivel', n + 1));
      b.dataset.n = n;
      b.addEventListener('click', () => {
        if (n > datos.abierto) { sonido.tocar('error'); return; }
        sonido.tocar('boton'); jugar(n);
      });
      caja.appendChild(b);
    }
    grilla.appendChild(caja);
  }
}

// ── la tienda: una muestra grande en el medio, flechas y comprar o usar ────
function lista() { return tienda.tipo === 'globos' ? GLOBOS : ESCUDOS; }
function abrirTienda(tipo = tienda.tipo) {
  tienda.tipo = tipo;
  const actual = tipo === 'globos' ? datos.globo : datos.escudo;
  tienda.i = Math.max(0, lista().findIndex((p) => p.id === actual));
  estado = 'tienda'; mostrar('tienda');
  actualizarTienda();
}
function actualizarTienda() {
  const p = lista()[tienda.i], tipo = tienda.tipo, tengo = (tipo === 'globos' ? datos.globos : datos.escudos).includes(p.id);
  const usando = (tipo === 'globos' ? datos.globo : datos.escudo) === p.id;
  $('bPestGlobos').classList.toggle('elegida', tipo === 'globos'); $('bPestEscudos').classList.toggle('elegida', tipo === 'escudos');
  $('bPestGlobos').setAttribute('aria-selected', tipo === 'globos'); $('bPestEscudos').setAttribute('aria-selected', tipo === 'escudos');
  $('tNombre').textContent = tr((tipo === 'globos' ? 'globo_' : 'escudo_') + p.id);
  const b = $('bComprar');
  b.textContent = usando ? tr('enUso') : tengo ? tr('usar') : tr('comprar', p.precio);
  b.classList.toggle('apagado', usando || (!tengo && datos.monedas < p.precio));
  $('tAviso').textContent = !tengo && datos.monedas < p.precio ? tr('faltan', p.precio - datos.monedas) : '';
  $('tMonedasTienda').textContent = datos.monedas; $('tMonedas').textContent = datos.monedas;
}
function moverTienda(d) { tienda.i = (tienda.i + d + lista().length) % lista().length; sonido.tocar('cambia'); actualizarTienda(); }
function comprarOUsar() {
  const p = lista()[tienda.i], mias = tienda.tipo === 'globos' ? datos.globos : datos.escudos;
  if (!mias.includes(p.id)) {
    if (datos.monedas < p.precio) { sonido.tocar('error'); vibrar(40); return; }
    datos.monedas -= p.precio; mias.push(p.id); sonido.tocar('compra'); vibrar(20);
  }
  if (tienda.tipo === 'globos') datos.globo = p.id; else datos.escudo = p.id;
  guardarTodo(); actualizarTienda();
}

// ── los ajustes, armados con botones de opción ─────────────────────────────
let borrarArmado = false;
function armarAjustes() {
  const a = datos.ajustes, listaA = $('listaAjustes');
  listaA.textContent = '';
  const fila = (nombre, opciones, actual, poner) => {
    const d = document.createElement('div'); d.className = 'item';
    const s = document.createElement('span'); s.textContent = nombre; d.appendChild(s);
    const ops = document.createElement('div'); ops.className = 'ops';
    for (const [valor, texto, clase] of opciones) {
      const b = document.createElement('button'); b.className = 'opcion' + (valor === actual ? ' elegida' : '') + (clase ? ' ' + clase : ''); b.textContent = texto;
      b.addEventListener('click', () => { poner(valor); sonido.aplicar(); guardarTodo(); sonido.tocar('boton'); textos(); armarAjustes(); });
      ops.appendChild(b);
    }
    d.appendChild(ops); listaA.appendChild(d);
  };
  const siNo = [[true, tr('si')], [false, tr('no')]];
  fila(tr('musica'), siNo, a.musica, (v) => (a.musica = v));
  fila(tr('sonido'), siNo, a.sonido, (v) => (a.sonido = v));
  fila(tr('vibrar'), siNo, a.vibrar, (v) => { a.vibrar = v; if (v) vibrar(30); });
  fila(tr('sensibilidad'), [['baja', tr('baja')], ['media', tr('media')], ['alta', tr('alta')]], a.sensibilidad, (v) => (a.sensibilidad = v));
  fila(tr('calidad'), [['auto', tr('auto')], ['alta', tr('alta')], ['baja', tr('baja')]], a.calidad, (v) => { a.calidad = v; medir(); });
  fila(tr('idioma'), IDIOMAS.map((l) => [l, l.toUpperCase()]), tr.actual(), (v) => { a.idioma = v; tr.poner(v); });
  // borrar el progreso pide dos toques (los ajustes y el idioma quedan)
  fila('', [['borrar', borrarArmado ? tr('borrarSeguro') : tr('borrar'), 'peligro']], null, () => {
    if (!borrarArmado) { borrarArmado = true; return; }
    borrarArmado = false;
    const nuevo = base(); nuevo.ajustes = datos.ajustes; datos = nuevo;
  });
}

for (const l of IDIOMAS) boton('bIdioma_' + l, () => { datos.ajustes.idioma = l; tr.poner(l); guardarTodo(); aMenu(); });
boton('bJugar', () => jugar());
boton('bNiveles', () => { armarNiveles(); estado = 'niveles'; mostrar('niveles'); });
boton('bInfinito', infinito);
boton('bTienda', () => abrirTienda());
boton('bAjustes', () => { borrarArmado = false; armarAjustes(); estado = 'ajustes'; mostrar('ajustes'); });
boton('bVolverNiveles', aMenu);
boton('bVolverTienda', aMenu);
boton('bCerrarAjustes', aMenu);
boton('bPestGlobos', () => abrirTienda('globos'));
boton('bPestEscudos', () => abrirTienda('escudos'));
boton('bAnterior', () => moverTienda(-1));
boton('bSiguiente', () => moverTienda(1));
$('bComprar').addEventListener('click', comprarOUsar);
boton('bPausa', pausar);
boton('bSeguir', seguir);
boton('bSalirPausa', aMenu);
boton('bOtraVez', otraVez);
boton('bMenuPum', aMenu);
boton('bSiguienteNivel', () => jugar(partida.nivel + 1));
boton('bMenuGano', aMenu);
// el primer toque en cualquier lado despierta el audio (tiene que ser dentro del evento)
addEventListener('pointerdown', () => sonido.despertar(), { capture: true });
addEventListener('keydown', (ev) => {
  sonido.despertar();
  if (estado === 'intro') intro?.saltear();
  else if (estado === 'tienda' && ev.code === 'ArrowLeft') moverTienda(-1);
  else if (estado === 'tienda' && ev.code === 'ArrowRight') moverTienda(1);
  // la pausa se maneja acá: si no, la misma tecla que la saca la vuelve a poner
  else if ((ev.code === 'Escape' || ev.code === 'KeyP') && !ev.repeat) {
    if (estado === 'juego') pausar();
    else if (estado === 'pausa') seguir();
    else if (['niveles', 'tienda', 'ajustes'].includes(estado) && ev.code === 'Escape') aMenu();
  }
}, { capture: true });
// el dedo sobre el fondo de los menús empuja el cartel (en la ventana: el
// menú de HTML tapa el lienzo entero y el lienzo no se enteraba)
let ultimoX = null;
const sobreBoton = (ev) => ev.target?.closest?.('button, input');
lienzo.addEventListener('pointerdown', () => { if (estado === 'intro') intro?.saltear(); });
addEventListener('pointerdown', (ev) => {
  ultimoX = ev.clientX;
  if (estado === 'menu' && !sobreBoton(ev)) fondo.empujar((ev.clientX < innerWidth / 2 ? -1 : 1) * 0.5);
});
addEventListener('pointermove', (ev) => {
  if (estado === 'juego' || estado === 'intro') return;
  const dx = ultimoX === null ? 0 : ev.clientX - ultimoX;
  ultimoX = ev.clientX;
  fondo.mover(ev.clientX * dpr, ev.clientY * dpr, ev.buttons || ev.pointerType !== 'mouse' ? dx : dx * 0.4);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pausar(); sonido.lava(0); } else sonido.lava(0.9); });

// ── el paso ────────────────────────────────────────────────────────────────
function paso(dt) {
  t += dt;
  if (estado === 'espera') return;
  if (estado === 'intro') { intro.pasar(dt, W, H); return; }
  fondo.pasar(dt, W, H);
  if (!partida || estado === 'pausa') return;
  if (estado === 'juego' && partida.estado === 'juego') {
    // el arrastre del dedo (en píxeles de CSS) pasa al mundo; las flechas, a velocidad fija
    const esc = Math.min(W / ANCHO, H / 560), s = SENS[datos.ajustes.sensibilidad] || 1.3;
    const [dx, dy] = entrada.sacar(), [fx, fy] = entrada.flechas();
    partida.mover((dx * dpr * s) / esc + fx * TECLAS_VEL * dt, (dy * dpr * s) / esc + fy * TECLAS_VEL * dt);
  }
  partida.medir(W / Math.min(W / ANCHO, H / 560), H / Math.min(W / ANCHO, H / 560));
  partida.avanzar(dt);
  for (const ev of partida.sacarEventos()) {
    if (ev.tipo === 'golpe') { sonido.tocar('golpe', { vel: ev.vel }); if (ev.vel > 600) vibrar(12); }
    else if (ev.tipo === 'moneda') { sonido.tocar('moneda'); vibrar(8); }
    else if (ev.tipo === 'pum') { sonido.tocar('pum'); vibrar([40, 30, 70]); sacudida = 1; }
    else if (ev.tipo === 'meta') { sonido.tocar('meta'); vibrar([20, 40, 20]); }
    else if (ev.tipo === 'lluvia') sonido.tocar('lluvia');
    else if (ev.tipo === 'pendulo') sonido.tocar('pendulo');
  }
  sacudida = Math.max(0, sacudida - dt * 3);
  if (estado === 'juego' && partida.estado !== 'juego' && partida.tFin > (partida.estado === 'pum' ? 1.1 : 1.8)) terminar();
}

// ── el dibujo ──────────────────────────────────────────────────────────────
function temaMenu() { return temaDeNivel(Math.min(datos.abierto, NIVELES - 1)); }
function dibujar() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (estado === 'espera') { g.fillStyle = '#9fd8ff'; g.fillRect(0, 0, W, H); return; }
  if (estado === 'intro') { intro.dibujar(g, W, H); return; }
  const pielGlobo = globoPorId(datos.globo), pielEscudo = escudoPorId(datos.escudo);
  if (partida && ['juego', 'pausa', 'pum', 'gano'].includes(estado)) {
    const cam = camara();
    dibujarPartida(g, W, H, partida, cam, { pielGlobo, pielEscudo, tr, t });
    if (estado === 'juego' || estado === 'pausa') {
      const consejo = partida.nivel === 0 && !partida.infinito && partida.t < 7 && entrada.toques === 0 ? { texto: tactil ? tr('consejo') : tr('consejoPc'), alfa: clamp((7 - partida.t) / 1.5, 0, 1) * clamp(partida.t / 0.4, 0, 1) } : null;
      dibujarHud(g, W, H, { p: partida, u: dpr, tr, monedas: datos.monedas + partida.tomadas, pielGlobo, consejo, t, record: datos.mejorAltura });
    }
    return;
  }
  const acostado = W > H * 1.2;
  if (estado === 'tienda') {
    fondo.dibujar(g, W, H, dpr, { tema: temaMenu() });
    const p = lista()[tienda.i], cx = W / 2, cy = acostado ? H * 0.5 : H * 0.42, r = Math.min(W, H) * (acostado ? 0.13 : 0.15);
    if (tienda.tipo === 'globos') dibujarGlobo(g, cx, cy - r * 0.3 + Math.sin(t * 1.6) * r * 0.06, r, p, t, { hilo: r * 2.4, inclina: Math.cos(t * 0.9) * 0.08 });
    else {
      dibujarGlobo(g, cx, cy + r * 1.1, r * 0.55, pielGlobo, t, { hilo: r * 1.2 });
      dibujarEscudo(g, cx + Math.sin(t * 1.2) * r * 0.3, cy - r * 0.35, r * 0.8, p, t);
    }
    return;
  }
  const ancho = acostado ? Math.min(W * 0.4, H * 0.85) : Math.min(W * 0.84, 440 * dpr);
  const zona = estado === 'menu' || estado === 'idiomas' ? { cx: acostado ? W * 0.27 : W / 2, y: ancho * 0.42 + (acostado ? 70 : 90) * dpr, ancho } : null;
  // el globo del jugador flota entre el cartel y los botones, si hay lugar
  let jugador = null;
  if (estado === 'menu' && !acostado) {
    const abajoCartel = zona.y + ancho * 0.5, arribaBotones = topeBotones * dpr, lugar = arribaBotones - abajoCartel;
    if (lugar > 130 * dpr) jugador = { x: W / 2, y: abajoCartel + lugar * 0.4, pielGlobo, pielEscudo };
  }
  fondo.dibujar(g, W, H, dpr, { tema: temaMenu(), zona, jugador });
  if (estado === 'niveles' || estado === 'ajustes') { g.fillStyle = 'rgba(29,36,64,0.25)'; g.fillRect(0, 0, W, H); }
}

// ── el bucle, con calidad que se ajusta sola ──────────────────────────────
let ultimo = performance.now(), lento = 0;
const manual = q.has('pausa');
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dtReal = Math.min(0.1, (ahora - ultimo) / 1000);
  ultimo = ahora;
  // si los cuadros tardan mucho seguido, se baja la resolución (un cuarto de punto por vez)
  if (datos.ajustes.calidad === 'auto' && estado === 'juego') {
    lento = dtReal > 0.026 ? lento + 1 : Math.max(0, lento - 1);
    if (lento > 45 && dprTope > 1) { dprTope = Math.max(1, dprTope - 0.25); lento = 0; medir(); }
  }
  if (!manual) {
    const [n, d] = trozos(dtReal, PASO);
    for (let k = 0; k < n; k++) paso(d);
  }
  dibujar();
}

textos();
const conIntro = q.has('intro') || !(q.has('directo') || q.has('pausa') || q.has('sinintro'));
// La intro arranca apenas abre, sin tocar nada. Si el navegador deja sonar
// sin un toque, el audio nace andando y la música va en fase; si no (lo
// normal), la intro va muda y el primer toque la saltea y prende el sonido.
if (conIntro) { mostrar(null); entrar(); }
else {
  aMenu();
  const d = q.get('directo') || '';
  if (d.startsWith('nivel:')) jugar((+d.slice(6) || 1) - 1);
  else if (d === 'infinito') infinito();
}
requestAnimationFrame(cuadro);

// Las sondas para las pruebas (pruebas/juego.mjs).
window.__G = {
  get estado() { return estado; }, get partida() { return partida; }, get datos() { return datos; }, get intro() { return intro; },
  get tienda() { return tienda; }, get fondo() { return fondo; },
  pasos(n, dib = false) { for (let k = 0; k < n; k++) paso(PASO); if (dib) dibujar(); },
  mover(dx, dy) { partida.mover(dx, dy); },
  dibujar, entrar, jugar, infinito, aMenu, pausar, seguir, elegirIdioma, abrirTienda, moverTienda, comprarOUsar, entrada, sonido, tr,
  get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
};
window.listo = true;
