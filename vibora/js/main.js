// Víbora.io, de JXSTUDIOS: el arranque, las pantallas y el bucle.
//
// El mundo corre siempre (en el menú, los bots juegan atrás y la cámara sigue
// a una); al tocar JUGAR, tu víbora nace en ese mismo mundo. Cada cuadro la
// simulación avanza lo que tardó el cuadro, en pasos de a lo sumo 1/60 s, y
// se dibuja una vez.
//
// Para probar: ?sinintro (directo al menú), ?directo=juego, ?pausa (no avanza
// solo: __V.pasos(n); también saltea la intro, salvo con ?intro), ?limpio (sin
// lo guardado), ?idioma=en.
import { Mundo } from './mundo.js';
import { Vibora } from './vibora.js';
import { dibujarArena, dibujarVibora } from './dibujo.js';
import { pintarFondo, FONDOS } from './fondos.js';
import { dibujarHud } from './hud.js';
import { dibujarLogo } from './logo.js';
import { crearEntrada } from './entrada.js';
import { crearSonido } from './sonido.js';
import { crearIdioma, IDIOMAS } from './idioma.js';
import { cargar, guardar, base } from './guardado.js';
import { PIELES, pielPorId, abierta } from './pieles.js';
import { Intro } from './intro.js';
import { acercar, clamp, trozos } from './util.js';

const PASO = 1 / 60;
const BOTS = [10, 18, 26];
const HITOS = [100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000];
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
// en el teléfono, 1,5 de densidad: se ve nítido y pinta la mitad de píxeles que a 2
let W = 0, H = 0, dpr = 1, dprTope = tactil ? 1.5 : 2;
function medir() {
  const tope = datos.ajustes.calidad === 'baja' ? 1 : datos.ajustes.calidad === 'alta' ? 2.5 : dprTope;
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, tope));
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (w !== W || h !== H) { W = lienzo.width = w; H = lienzo.height = h; }
  entrada.dpr = dpr;
}
medir();
addEventListener('resize', medir);

// ── el mundo y la cámara ───────────────────────────────────────────────────
let mundo = nuevoMundo();
function nuevoMundo() { return new Mundo({ semilla: ((Date.now() / 1000) | 0) & 0xffffff, bots: BOTS[datos.nivelBots], nivelBots: datos.nivelBots }); }
let mia = null, seguida = null, estado = 'espera', intro = null, preview = null, muerteT = 0, avisos = [], hitoN = 0, t = 0, sonarRecord = false;
const cam = { x: 0, y: 0, zoom: 1 };

function camara(dt) {
  // al nacer se ven unas 600 unidades en el lado corto; al crecer, la cámara se aleja
  const base = Math.min(W, H) / 600;
  let obj = mia && mia.viva && (estado === 'juego' || estado === 'pausa') ? mia : null;
  if (!obj && estado !== 'muerte') {
    if (!seguida || !seguida.viva) seguida = mundo.tabla()[Math.min(3, mundo.viboras.length - 1)] || null;
    obj = seguida;
  }
  if (obj) {
    cam.x = acercar(cam.x, obj.x, 9, dt); cam.y = acercar(cam.y, obj.y, 9, dt);
    const z = base * clamp(1.25 - (obj.radio() - 13) / 55, 0.5, 1.2) * (estado === 'menu' ? 0.8 : 1);
    cam.zoom = acercar(cam.zoom, z, 2, dt);
  }
}

// ── las pantallas de HTML ──────────────────────────────────────────────────
function mostrar(id) { for (const s of document.querySelectorAll('.pantalla')) s.classList.toggle('oculto', s.id !== id); }

function textos() {
  document.documentElement.lang = tr.actual();
  $('apodo').placeholder = tr('apodo');
  $('bJugar').textContent = tr('jugar');
  $('bPiel').textContent = tr('piel'); $('bFondo').textContent = tr('fondo'); $('bAjustes').textContent = tr('ajustes');
  $('tBots').textContent = tr('bots');
  document.querySelectorAll('.opcion[data-nivel]').forEach((b) => { b.textContent = tr('nivel_' + b.dataset.nivel); b.classList.toggle('elegida', +b.dataset.nivel === datos.nivelBots); });
  $('tMejor').textContent = datos.mejor ? tr('mejor', Math.floor(datos.mejor).toLocaleString('es-AR')) : '';
  $('tConsejo').textContent = tactil ? tr('consejo') : tr('consejoPc');
  $('tFirma').textContent = tr('creditos').toUpperCase();
  $('bListo').textContent = tr('listo');
  $('tAjustes').textContent = tr('ajustes'); $('bCerrarAjustes').textContent = tr('listo');
  $('tPausa').textContent = tr('pausa'); $('bSeguir').textContent = tr('seguir'); $('bSalirPausa').textContent = tr('menu');
  $('bOtraVez').textContent = tr('otraVez'); $('bMenu').textContent = tr('menu');
  $('tFinalRotulo').textContent = tr('final');
}

function boton(id, fn) { $(id).addEventListener('click', () => { sonido.tocar('boton'); fn(); }); }

// ── el ir y venir ──────────────────────────────────────────────────────────
function entrar() {
  if (estado !== 'espera') return;
  sonido.despertar();
  estado = 'intro'; mostrar(null);
  intro = new Intro({ sonido, vibrar, alTerminar: aMenu });
}
function aMenu() {
  estado = 'menu'; mia = null; preview = null;
  entrada.activo = false; entrada.soltarTodo();
  sonido.turbo(false); sonido.musica('menu');
  textos(); mostrar('menu');
  $('apodo').value = datos.apodo;
}
function jugar() {
  datos.apodo = $('apodo').value.trim().slice(0, 16);
  if (mundo.nivelBots !== datos.nivelBots) mundo = nuevoMundo();
  mia = mundo.nacer({ nombre: datos.apodo || 'Vos', piel: pielPorId(datos.piel), bot: false });
  datos.partidas++; guardarTodo();
  estado = 'juego'; mostrar(null);
  $('apodo').blur();
  entrada.activo = true; entrada.modo = datos.ajustes.control; entrada.soltarTodo();
  cam.x = mia.x; cam.y = mia.y;
  sonido.musica('juego'); sonido.tocar('nace');
  hitoN = 0; avisos = [];
}
function pausar() { if (estado !== 'juego') return; estado = 'pausa'; entrada.soltarTodo(); sonido.turbo(false); mostrar('pausa'); }
function seguir() { estado = 'juego'; mostrar(null); }
function morir(asesino) {
  estado = 'muerte'; muerteT = 0;
  entrada.activo = false; entrada.soltarTodo();
  sonido.turbo(false); sonido.tocar('muere'); vibrar([60, 40, 90]);
  const final = Math.floor(mia.masa), record = final > datos.mejor;
  if (record) datos.mejor = final;
  datos.bajas += mia.bajas;
  guardarTodo();
  $('tCausa').textContent = asesino ? tr('teComio', asesino.nombre) : tr('borde');
  $('tFinal').textContent = final.toLocaleString('es-AR');
  $('tRecord').textContent = record ? tr('nuevoRecord') : '';
  $('tBajas').textContent = mia.bajas ? tr('bajas', mia.bajas) : '';
  sonarRecord = record;
}

// elegir piel o fondo: una víbora de muestra que culebrea en el centro
function elegir(tipo) {
  const lista = tipo === 'piel' ? PIELES.map((p) => p.id) : FONDOS;
  const actual = tipo === 'piel' ? datos.piel : datos.fondo;
  preview = { tipo, lista, i: Math.max(0, lista.indexOf(actual)), fondo: datos.fondo };
  nuevaMuestra();
  estado = 'elegir'; mostrar('elegir');
  $('tElegir').textContent = tr(tipo);
  actualizarElegir();
}
function nuevaMuestra() {
  const piel = preview.tipo === 'piel' ? pielPorId(preview.lista[preview.i]) : pielPorId(datos.piel);
  preview.v = new Vibora({ id: 0, nombre: '', piel, x: 0, y: 0, ang: 0, masa: 90 });
}
function actualizarElegir() {
  const id = preview.lista[preview.i];
  if (preview.tipo === 'piel') {
    const p = pielPorId(id), libre = abierta(p, datos.mejor);
    $('tNombre').textContent = tr('piel_' + id);
    $('tCandado').textContent = libre ? '' : '🔒 ' + tr('bloqueada', p.mejor.toLocaleString('es-AR'));
    $('bListo').style.opacity = libre ? '1' : '0.5';
  } else {
    preview.fondo = id;
    $('tNombre').textContent = tr('fondo_' + id); $('tCandado').textContent = ''; $('bListo').style.opacity = '1';
  }
}
function moverElegir(d) {
  preview.i = (preview.i + d + preview.lista.length) % preview.lista.length;
  if (preview.tipo === 'piel') nuevaMuestra();
  sonido.tocar('cambia');
  actualizarElegir();
}
function listoElegir() {
  const id = preview.lista[preview.i];
  if (preview.tipo === 'piel') {
    if (!abierta(pielPorId(id), datos.mejor)) { sonido.tocar('error'); return; }
    datos.piel = id;
  } else datos.fondo = id;
  guardarTodo(); aMenu();
}

// los ajustes, armados con botones de opción
function armarAjustes() {
  const a = datos.ajustes, lista = $('listaAjustes');
  lista.textContent = '';
  const fila = (nombre, opciones, actual, poner) => {
    const d = document.createElement('div'); d.className = 'item';
    const s = document.createElement('span'); s.textContent = nombre; d.appendChild(s);
    const ops = document.createElement('div'); ops.className = 'ops';
    for (const [valor, texto] of opciones) {
      const b = document.createElement('button'); b.className = 'opcion' + (valor === actual ? ' elegida' : ''); b.textContent = texto;
      b.addEventListener('click', () => { poner(valor); sonido.aplicar(); guardarTodo(); sonido.tocar('boton'); textos(); armarAjustes(); });
      ops.appendChild(b);
    }
    d.appendChild(ops); lista.appendChild(d);
  };
  const siNo = [[true, tr('si')], [false, tr('no')]];
  fila(tr('musica'), siNo, a.musica, (v) => (a.musica = v));
  fila(tr('sonido'), siNo, a.sonido, (v) => (a.sonido = v));
  fila(tr('vibrar'), siNo, a.vibrar, (v) => { a.vibrar = v; if (v) vibrar(30); });
  fila(tr('nombres'), siNo, a.nombres, (v) => (a.nombres = v));
  fila(tr('control'), [['flecha', tr('flecha')], ['joystick', tr('joystick')]], a.control, (v) => (a.control = v));
  fila(tr('calidad'), [['auto', tr('auto')], ['alta', tr('alta')], ['baja', tr('baja')]], a.calidad, (v) => { a.calidad = v; medir(); });
  fila(tr('idioma'), IDIOMAS.map((l) => [l, l.toUpperCase()]), tr.actual(), (v) => { a.idioma = v; tr.poner(v); });
}

boton('bJugar', jugar);
$('apodo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { sonido.tocar('boton'); jugar(); } });
boton('bPiel', () => elegir('piel'));
boton('bFondo', () => elegir('fondo'));
boton('bAjustes', () => { armarAjustes(); estado = 'ajustes'; mostrar('ajustes'); });
boton('bCerrarAjustes', aMenu);
document.querySelectorAll('.opcion[data-nivel]').forEach((b) => b.addEventListener('click', () => { datos.nivelBots = +b.dataset.nivel; guardarTodo(); sonido.tocar('boton'); textos(); }));
boton('bAnterior', () => moverElegir(-1));
boton('bSiguiente', () => moverElegir(1));
boton('bListo', listoElegir);
boton('bSeguir', seguir);
boton('bSalirPausa', aMenu);
boton('bOtraVez', jugar);
boton('bMenu', aMenu);
// el primer toque en cualquier lado despierta el audio (tiene que ser dentro del evento)
addEventListener('pointerdown', () => sonido.despertar(), { capture: true });
addEventListener('keydown', (ev) => {
  sonido.despertar();
  if (estado === 'intro') intro?.saltear();
  else if (estado === 'elegir' && ev.code === 'ArrowLeft') moverElegir(-1);
  else if (estado === 'elegir' && ev.code === 'ArrowRight') moverElegir(1);
  // la pausa se maneja acá y no en entrada.js: si no, la misma tecla que la
  // saca la vuelve a poner en el paso siguiente
  else if ((ev.code === 'Escape' || ev.code === 'KeyP') && !ev.repeat) {
    if (estado === 'juego') pausar();
    else if (estado === 'pausa') seguir();
    else if ((estado === 'elegir' || estado === 'ajustes') && ev.code === 'Escape') aMenu();
  }
}, { capture: true });
lienzo.addEventListener('pointerdown', () => { if (estado === 'intro') intro?.saltear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });

// ── el paso de simulación ──────────────────────────────────────────────────
function paso(dt) {
  t += dt;
  if (estado === 'espera') return;
  if (estado === 'intro') { intro.pasar(dt, W, H); return; }
  if (estado === 'pausa') return;
  if (estado === 'elegir' && preview) {
    const v = preview.v;
    v.angObj = Math.sin(t * 1.6) * 1.1;
    v.pasar(dt, null);
    cam.x = v.x; cam.y = v.y; cam.zoom = Math.min(W, H) / 520;
    return;
  }
  if (estado === 'juego' && mia && mia.viva) {
    const cx = (mia.x - cam.x) * cam.zoom + W / 2, cy = (mia.y - cam.y) * cam.zoom + H / 2;
    const r = entrada.rumbo(mia.angObj, cx, cy, dt);
    if (r !== null) mia.angObj = r;
    mia.turbo = entrada.turbo() && mia.masa > 12;
    sonido.turbo(mia.turbo);
    if (entrada.sacarPausa()) pausar();
  }
  mundo.pasar(dt);
  for (const ev of mundo.sacarEventos()) {
    if (ev.tipo === 'come' && ev.v === mia) sonido.tocar('come', { valor: ev.valor });
    else if (ev.tipo === 'muere') {
      if (ev.v === mia) morir(ev.asesino);
      else if (ev.asesino && ev.asesino === mia) {
        avisos.push({ txt: tr('comiste', ev.v.nombre), t: 0, dura: 2.2, color: '#ffd35c', grande: true });
        sonido.tocar('baja'); vibrar(35);
      }
    }
  }
  if (mia && mia.viva && hitoN < HITOS.length && mia.masa >= HITOS[hitoN]) {
    avisos.push({ txt: tr('hito', HITOS[hitoN].toLocaleString('es-AR')), t: 0, dura: 1.8, color: '#8cff3a' });
    sonido.tocar('hito'); hitoN++;
  }
  for (const a of avisos) a.t += dt;
  avisos = avisos.filter((a) => a.t < a.dura).slice(-3);
  if (estado === 'muerte' && (muerteT += dt) > 0.9 && $('muerte').classList.contains('oculto')) {
    mostrar('muerte');
    if (sonarRecord) { sonido.tocar('record'); sonarRecord = false; }
  }
  camara(dt);
}

// ── el dibujo ──────────────────────────────────────────────────────────────
const calidad = () => (dpr >= 1.5 ? 2 : 1);
function dibujar() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (estado === 'espera') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
  if (estado === 'intro') { intro.dibujar(g, W, H); return; }
  if (estado === 'elegir' && preview) {
    pintarFondo(g, preview.fondo, cam, W, H);
    dibujarVibora(g, preview.v, cam, W, H, t, calidad());
    return;
  }
  dibujarArena(g, mundo, cam, W, H, { fondoId: datos.fondo, calidad: calidad(), destacada: mia, nombres: datos.ajustes.nombres, esc: dpr });
  if (estado === 'menu' || estado === 'ajustes') {
    g.fillStyle = 'rgba(5,6,12,0.45)'; g.fillRect(0, 0, W, H);
    dibujarLogoMenu();
    return;
  }
  const botones = estado === 'juego' && tactil;
  const rt = 34 * dpr;
  entrada.botonTurbo = botones ? { x: 16 * dpr + rt, y: H - 78 * dpr - rt, r: rt } : null;
  entrada.botonPausa = estado === 'juego' ? { x: 16 * dpr + 18 * dpr, y: 16 * dpr + 18 * dpr, r: 18 * dpr } : null;
  dibujarHud(g, W, H, {
    mundo, mia: mia && mia.viva ? mia : null, esc: dpr, tr, avisos,
    turboBoton: entrada.botonTurbo && { ...entrada.botonTurbo, activo: mia?.turbo }, pausa: entrada.botonPausa,
    joystick: entrada.joy && { x: entrada.joy.x, y: entrada.joy.y, dx: clamp(entrada.joy.dx, -50 * dpr, 50 * dpr), dy: clamp(entrada.joy.dy, -50 * dpr, 50 * dpr), r: 50 * dpr },
  });
}
const lienzoLogo = $('logo'), gl = lienzoLogo.getContext('2d');
function dibujarLogoMenu() {
  const w = Math.round(lienzoLogo.clientWidth * dpr), h = Math.round(lienzoLogo.clientHeight * dpr);
  if (!w || !h) return;
  if (lienzoLogo.width !== w || lienzoLogo.height !== h) { lienzoLogo.width = w; lienzoLogo.height = h; }
  gl.clearRect(0, 0, w, h);
  const alto = Math.min(h * 0.7, w / 6.6);
  dibujarLogo(gl, w / 2, h * 0.52, alto, t);
}

// ── el bucle, con calidad que se ajusta sola ──────────────────────────────
let ultimo = performance.now(), lento = 0;
const manual = q.has('pausa');
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  const dtReal = Math.min(0.1, (ahora - ultimo) / 1000);
  ultimo = ahora;
  // si los cuadros tardan mucho seguido, se baja la resolución (medio punto por vez)
  if (datos.ajustes.calidad === 'auto' && (estado === 'juego' || estado === 'menu')) {
    lento = dtReal > 0.026 ? lento + 1 : Math.max(0, lento - 1);
    if (lento > 45 && dprTope > 1) { dprTope = Math.max(1, dprTope - 0.25); lento = 0; medir(); }
  }
  if (!manual) {
    // cada cuadro avanza lo que tardó de verdad, en pasos de a lo sumo 1/60 s
    const [n, d] = trozos(dtReal, PASO);
    for (let k = 0; k < n; k++) paso(d);
  }
  dibujar();
}

textos();
const conIntro = q.has('intro') || !(q.has('directo') || q.has('pausa') || q.has('sinintro'));
// La intro arranca apenas abre, sin tocar nada. El sonido se decide en el
// acto: si el navegador deja sonar sin un toque, el audio nace andando y la
// música va en fase; si no (lo normal), nace suspendido y la intro va muda:
// el primer toque la saltea y prende el sonido.
if (conIntro) { mostrar(null); entrar(); }
else { aMenu(); if (q.get('directo') === 'juego') jugar(); }
requestAnimationFrame(cuadro);

// Las sondas para las pruebas (pruebas/juego.mjs).
window.__V = {
  get estado() { return estado; }, get mundo() { return mundo; }, get mia() { return mia; }, get datos() { return datos; }, get cam() { return cam; },
  get avisos() { return avisos; }, get intro() { return intro; }, get preview() { return preview; },
  pasos(n, dib = false) { for (let k = 0; k < n; k++) paso(PASO); if (dib) dibujar(); },
  dibujar, entrar, jugar, aMenu, pausar, seguir, elegir, moverElegir, listoElegir, entrada, sonido, tr,
  matar() { if (mia && mia.viva) mundo.morir(mia, null); },
  get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
};
window.listo = true;
