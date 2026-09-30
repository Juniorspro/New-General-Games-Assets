// Morfi, de JXSTUDIOS: el arranque, las pantallas y el bucle.
//
// Cada cuadro la partida avanza lo que tardó el cuadro (adentro, la física
// va en pasos fijos de 1/120 s y el dibujo se interpola entre paso y paso),
// y se dibuja una vez. Los menús son HTML arriba del lienzo; el lienzo
// dibuja detrás la caja de cartón, el cartel que se hamaca y el caramelo del
// menú (que se puede cortar ahí mismo).
//
// Para probar: ?sinintro (directo al menú), ?directo=nivel:2-4, ?pausa (no
// avanza solo: __G.pasos(n); también saltea la intro, salvo con ?intro),
// ?limpio (sin lo guardado), ?idioma=en, ?todo (todo abierto).
import { Partida } from './partida.js';
import { NIVELES, CAJAS } from './niveles.js';
import { dibujarNivel, camaraTablero, Efectos, CARAMELOS, caramelo as spriteCaramelo } from './dibujo.js';
import { Morfi } from './morfi.js';
import { FondoMenu, ESCENA } from './menu.js';
import { dibujarHud, dibujarRastros } from './hud.js';
import { crearEntrada } from './entrada.js';
import { crearSonido } from './sonido.js';
import { crearIdioma, IDIOMAS } from './idioma.js';
import { cargar, guardar, base, estrellasTotal, estrellasCaja, cajaAbierta, nivelAbierto } from './guardado.js';
import { MORFIS, DULCES, premio, BONO_CAJA } from './pieles.js';
import { IntroJXS } from './intro.js';
import { fondo, pegar, pintarGrano } from './papel.js';
import { clamp, trozos } from './util.js';

const PASO = 1 / 60;
const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const lienzo = $('juego'), g = lienzo.getContext('2d');

let datos = q.has('limpio') ? base() : cargar();
if (IDIOMAS.includes(q.get('idioma'))) datos.ajustes.idioma = q.get('idioma');
if (q.has('todo')) { datos.mejor = datos.mejor.map((e) => Math.max(e, 3)); }
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
// dónde empieza lo usable arriba (debajo de la muesca), en píxeles de CSS:
// lo mide una sonda puesta en env(safe-area-inset-top), una vez por tamaño
let arribaSeguro = 0;
const arribaCss = () => Math.max(10, arribaSeguro + 8);
function medirTodo() { medir(); arribaSeguro = $('sonda').getBoundingClientRect().top || 0; }
medirTodo();
addEventListener('resize', medirTodo);

let estado = 'espera', partida = null, nivelI = 0, intro = null, t = 0, alfa = 1;
let morfi = new Morfi(datos.morfi, 3), efectos = new Efectos(), hud = { tomadas: [null, null, null] }, aviso = null;
let ayuda = null;                     // { texto, t, hasta } mientras se muestra la nota
const fondoMenu = new FondoMenu({ alEvento: (ev) => eventoMenu(ev) });
const tienda = { tipo: 'morfis', i: 0, muestra: new Morfi('kraft', 5) };
const nombreCaja = (c) => tr('caja_' + CAJAS[c].id);

// ── las pantallas de HTML ──────────────────────────────────────────────────
function mostrar(id) {
  for (const s of document.querySelectorAll('.pantalla')) s.classList.toggle('oculto', s.id !== id);
  const jugando = id === null && estado === 'juego';
  $('bPausa').classList.toggle('oculto', !jugando); $('bReiniciar').classList.toggle('oculto', !jugando);
}
function boton(id, fn) { $(id).addEventListener('click', () => { sonido.tocar('boton'); fn(); }); }

// el próximo nivel para jugar: el primero sin ganar que esté abierto (o el último abierto)
function proximoNivel() {
  for (let i = 0; i < NIVELES.length; i++) if (datos.mejor[i] < 0 && nivelAbierto(datos, i)) return i;
  for (let i = NIVELES.length - 1; i >= 0; i--) if (nivelAbierto(datos, i)) return i;
  return 0;
}
function textos() {
  document.documentElement.lang = tr.actual();
  const n = proximoNivel(), todos = datos.mejor.every((e) => e >= 0);
  $('tJugar').textContent = tr('jugar');
  $('tNivelJugar').textContent = todos ? tr('todos') : `${nombreCaja(Math.floor(n / 10))} · ${NIVELES[n].id}`;
  $('bCajas').textContent = tr('cajas'); $('bTienda').textContent = tr('tienda'); $('bAjustes').textContent = tr('ajustes');
  $('tFirma').textContent = tr('creditos').toUpperCase();
  for (const id of ['tMonedas', 'tMonedasTienda', 'tMonedasCajas']) $(id).textContent = datos.monedas;
  $('tEstrellasMenu').textContent = `${estrellasTotal(datos)} / ${NIVELES.length * 3}`;
  $('tCajas').textContent = tr('cajas'); $('bVolverCajas').textContent = tr('volver'); $('bVolverNiveles').textContent = tr('volver');
  $('bPestMorfis').textContent = tr('morfis'); $('bPestDulces').textContent = tr('caramelos'); $('bVolverTienda').textContent = tr('volver');
  $('tAjustes').textContent = tr('ajustes'); $('bCerrarAjustes').textContent = tr('volver');
  $('tPausa').textContent = tr('pausa'); $('bSeguir').textContent = tr('seguir'); $('bOtraVezPausa').textContent = tr('otraVez'); $('bSalirPausa').textContent = tr('menu');
  $('bSiguienteNivel').textContent = tr('siguiente'); $('bOtraVez').textContent = tr('otraVez'); $('bMenuGano').textContent = tr('menu');
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
  entrada.activo = true; entrada.soltarTodo();
  sonido.musica('menu');
  setTimeout(() => $('bIdioma_' + tr.actual())?.focus(), 50);
}
// dónde empiezan los botones del menú (en píxeles de CSS), para que el caramelo del menú no quede detrás
let topeBotones = Infinity;
function medirBotones() { const r = $('botonera').getBoundingClientRect(); if (r.height) topeBotones = r.top; }
addEventListener('resize', () => { if (estado === 'menu') medirBotones(); });
function aMenu() {
  estado = 'menu'; partida = null;
  entrada.activo = true; entrada.soltarTodo();
  sonido.musica('menu');
  textos(); mostrar('menu');
  medirBotones();
}
function jugar(i) {
  i = clamp(i, 0, NIVELES.length - 1);
  nivelI = i; partida = new Partida(NIVELES[i]);
  datos.partidas++; guardarTodo();
  estado = 'juego'; alfa = 1; aviso = null;
  hud = { tomadas: [null, null, null] };
  morfi = new Morfi(datos.morfi, 3 + i); efectos = new Efectos();
  const clave = NIVELES[i].ayuda;
  ayuda = clave && !datos.ayudas.includes(clave) ? { texto: i === 0 && !tactil ? tr('consejoPc') : tr(clave), t: 0, hasta: 9 } : null;
  mostrar(null);
  entrada.activo = true; entrada.soltarTodo(); entrada.usos = 0;
  sonido.musica('juego');
}
function pausar() { if (estado !== 'juego' || !partida || partida.estado !== 'juego') return; estado = 'pausa'; entrada.soltarTodo(); mostrar('pausa'); }
function seguir() { if (estado !== 'pausa') return; estado = 'juego'; mostrar(null); }
function reiniciar() { if (partida) jugar(nivelI); }

// ganó: estrellas, monedas, cajas nuevas y la tarjeta del final
function ganar() {
  const p = partida, n = p.tomadas, antes = datos.mejor[nivelI], c = Math.floor(nivelI / 10);
  const abiertasAntes = CAJAS.map((_, k) => cajaAbierta(datos, k));
  let monedas = premio(antes, n);
  datos.mejor[nivelI] = Math.max(antes, n);
  if (estrellasCaja(datos, c) === 30 && !datos.bonos.includes(CAJAS[c].id)) { datos.bonos.push(CAJAS[c].id); monedas += BONO_CAJA; }
  datos.monedas += monedas;
  const clave = NIVELES[nivelI].ayuda;
  if (clave && !datos.ayudas.includes(clave)) datos.ayudas.push(clave);
  guardarTodo();
  const nueva = CAJAS.findIndex((_, k) => !abiertasAntes[k] && cajaAbierta(datos, k));
  estado = 'gano';
  entrada.activo = false; entrada.soltarTodo();
  $('tGano').textContent = n === 3 ? tr('perfecto') : tr('superado');
  $('tGanoMonedas').textContent = tr('ganaste', monedas);
  $('tGanoAviso').textContent = nueva >= 0 ? `${tr('cajaNueva')} · ${nombreCaja(nueva)}` : datos.mejor.every((e) => e >= 0) && antes < 0 && nivelI === NIVELES.length - 1 ? tr('todos') : '';
  const sig = nivelI + 1 < NIVELES.length && nivelAbierto(datos, nivelI + 1);
  $('bSiguienteNivel').classList.toggle('oculto', !sig);
  $('tGanoFalta').textContent = !sig && nivelI + 1 < NIVELES.length ? tr('juntaEstrellas', CAJAS[Math.floor((nivelI + 1) / 10)].estrellas) : '';
  const spans = document.querySelectorAll('#ganoEstrellas span');
  spans.forEach((s, k) => { s.classList.remove('llena', 'pega'); void s.offsetWidth; if (k < n) s.classList.add('llena', 'pega'); });
  for (let k = 0; k < n; k++) setTimeout(() => { if (estado === 'gano') { sonido.tocar('pega', { n: k + 1 }); vibrar(12); } }, 380 + k * 300);
  sonido.tocar('gana');
  mostrar('gano');
  setTimeout(() => (sig ? $('bSiguienteNivel') : $('bOtraVez')).focus({ preventScroll: true }), 60);
}

// ── las cajas y los niveles ────────────────────────────────────────────────
function armarCajas() {
  const lista = $('listaCajas');
  lista.textContent = '';
  CAJAS.forEach((caja, c) => {
    const b = document.createElement('button'), abierta = cajaAbierta(datos, c);
    b.className = `caja caja-${caja.id}` + (abierta ? '' : ' cerrada');
    const nombre = document.createElement('span'); nombre.className = 'nombre-caja'; nombre.textContent = nombreCaja(c);
    const dato = document.createElement('span'); dato.className = 'dato-caja';
    dato.textContent = abierta ? `★ ${estrellasCaja(datos, c)} / 30` : `🔒 ${tr('juntaEstrellas', caja.estrellas)}`;
    b.append(nombre, dato);
    b.addEventListener('click', () => {
      if (!abierta) { sonido.tocar('error'); vibrar(30); return; }
      sonido.tocar('boton'); armarNiveles(c); estado = 'niveles'; mostrar('niveles');
    });
    lista.appendChild(b);
  });
}
let cajaVista = 0;
function armarNiveles(c) {
  cajaVista = c;
  $('tNiveles').textContent = nombreCaja(c);
  const grilla = $('grillaNiveles');
  grilla.textContent = '';
  grilla.className = `grilla caja-${CAJAS[c].id}`;
  for (let i = c * 10; i < c * 10 + 10; i++) {
    const b = document.createElement('button'), abierto = nivelAbierto(datos, i), e = datos.mejor[i];
    b.className = 'nivelB' + (abierto ? '' : ' cerrado');
    const num = document.createElement('span'); num.className = 'num'; num.textContent = abierto ? String(i % 10 + 1) : '🔒';
    const est = document.createElement('span'); est.className = 'est';
    est.textContent = abierto && e >= 0 ? '★'.repeat(e) + '☆'.repeat(3 - e) : '';
    b.append(num, est);
    b.setAttribute('aria-label', tr('nivel', NIVELES[i].id));
    b.addEventListener('click', () => {
      if (!abierto) { sonido.tocar('error'); return; }
      sonido.tocar('boton'); jugar(i);
    });
    grilla.appendChild(b);
  }
}

// ── la tienda: la muestra grande en el lienzo, flechas y comprar o usar ────
function lista() { return tienda.tipo === 'morfis' ? MORFIS : DULCES; }
function abrirTienda(tipo = tienda.tipo) {
  tienda.tipo = tipo;
  const actual = tipo === 'morfis' ? datos.morfi : datos.dulce;
  tienda.i = Math.max(0, lista().findIndex((p) => p.id === actual));
  estado = 'tienda'; mostrar('tienda');
  entrada.activo = false;
  actualizarTienda();
}
function actualizarTienda() {
  const p = lista()[tienda.i], tipo = tienda.tipo, tengo = (tipo === 'morfis' ? datos.morfis : datos.dulces).includes(p.id);
  const usando = (tipo === 'morfis' ? datos.morfi : datos.dulce) === p.id;
  $('bPestMorfis').classList.toggle('elegida', tipo === 'morfis'); $('bPestDulces').classList.toggle('elegida', tipo === 'dulces');
  $('bPestMorfis').setAttribute('aria-selected', tipo === 'morfis'); $('bPestDulces').setAttribute('aria-selected', tipo === 'dulces');
  $('tNombre').textContent = tr((tipo === 'morfis' ? 'morfi_' : 'caramelo_') + p.id);
  const b = $('bComprar');
  b.textContent = usando ? tr('enUso') : tengo ? tr('usar') : tr('comprar', p.precio);
  b.classList.toggle('apagado', usando || (!tengo && datos.monedas < p.precio));
  $('tAviso').textContent = !tengo && datos.monedas < p.precio ? tr('faltan', p.precio - datos.monedas) : '';
  for (const id of ['tMonedas', 'tMonedasTienda', 'tMonedasCajas']) $(id).textContent = datos.monedas;
  tienda.muestra.piel = tipo === 'morfis' ? p.id : datos.morfi;
}
function moverTienda(d) { tienda.i = (tienda.i + d + lista().length) % lista().length; sonido.tocar('cambia'); actualizarTienda(); }
function comprarOUsar() {
  const p = lista()[tienda.i], mias = tienda.tipo === 'morfis' ? datos.morfis : datos.dulces;
  if (!mias.includes(p.id)) {
    if (datos.monedas < p.precio) { sonido.tocar('error'); vibrar(40); return; }
    datos.monedas -= p.precio; mias.push(p.id); sonido.tocar('compra'); vibrar(20);
    tienda.muestra.comer();
  } else sonido.tocar('boton');
  if (tienda.tipo === 'morfis') datos.morfi = p.id; else datos.dulce = p.id;
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
boton('bJugar', () => jugar(proximoNivel()));
boton('bCajas', () => { armarCajas(); estado = 'cajas'; entrada.activo = false; mostrar('cajas'); });
boton('bTienda', () => abrirTienda());
boton('bAjustes', () => { borrarArmado = false; armarAjustes(); estado = 'ajustes'; entrada.activo = false; mostrar('ajustes'); });
boton('bVolverCajas', aMenu);
boton('bVolverNiveles', () => { armarCajas(); estado = 'cajas'; mostrar('cajas'); });
boton('bVolverTienda', aMenu);
boton('bCerrarAjustes', aMenu);
boton('bPestMorfis', () => abrirTienda('morfis'));
boton('bPestDulces', () => abrirTienda('dulces'));
boton('bAnterior', () => moverTienda(-1));
boton('bSiguiente', () => moverTienda(1));
$('bComprar').addEventListener('click', comprarOUsar);
boton('bPausa', pausar);
boton('bReiniciar', reiniciar);
boton('bSeguir', seguir);
boton('bOtraVezPausa', reiniciar);
boton('bSalirPausa', aMenu);
boton('bOtraVez', reiniciar);
boton('bMenuGano', aMenu);
boton('bSiguienteNivel', () => jugar(nivelI + 1));
// el primer toque en cualquier lado despierta el audio (tiene que ser dentro del evento)
addEventListener('pointerdown', () => sonido.despertar(), { capture: true });
addEventListener('keydown', (ev) => {
  sonido.despertar();
  if (estado === 'intro') intro?.saltear();
  else if (estado === 'tienda' && ev.code === 'ArrowLeft') moverTienda(-1);
  else if (estado === 'tienda' && ev.code === 'ArrowRight') moverTienda(1);
  else if (estado === 'juego' && ev.code === 'KeyR' && !ev.repeat) reiniciar();
  // la pausa se maneja acá: si no, la misma tecla que la saca la vuelve a poner
  else if ((ev.code === 'Escape' || ev.code === 'KeyP') && !ev.repeat) {
    if (estado === 'juego') pausar();
    else if (estado === 'pausa') seguir();
    else if (['cajas', 'tienda', 'ajustes'].includes(estado) && ev.code === 'Escape') aMenu();
    else if (estado === 'niveles' && ev.code === 'Escape') { armarCajas(); estado = 'cajas'; mostrar('cajas'); }
  }
}, { capture: true });
lienzo.addEventListener('pointerdown', () => { if (estado === 'intro') intro?.saltear(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pausar(); sonido.lava(0); } else sonido.lava(0.9); });

// ── los eventos de la partida: sonido, papelitos y la cara de Morfi ────────
const COLORES_PAPEL = ['#e8423a', '#f5c542', '#3f7fd1', '#58b368', '#ff93b3'];
function evento(ev, fx, m, p) {
  const col = CARAMELOS[datos.dulce] || CARAMELOS.rojo;
  switch (ev.tipo) {
    case 'corte': sonido.tocar('corte'); fx.papelitos(ev.x, ev.y, 6, ['#e2c48f', '#fff4dc', '#b68e55'], { vel: 90, arriba: 20, tam: 2 }); vibrar(6); break;
    case 'estrella': sonido.tocar('estrella', { n: ev.n }); fx.brillos(ev.x, ev.y, 10); fx.papelitos(ev.x, ev.y, 8, ['#ffd84a', '#f0b21c'], { vel: 120, tam: 2.4 }); if (p === partida) hud.tomadas[ev.n - 1] = t; vibrar(10); break;
    case 'clip': sonido.tocar('clip'); break;
    case 'globo': sonido.tocar('globo'); break;
    case 'pop': sonido.tocar('pop'); fx.papelitos(ev.x, ev.y, 14, ['#9ad0f5', '#7dbbea', '#b8def8'], { vel: 170, tam: 3.2 }); vibrar(14); break;
    case 'soplo': sonido.tocar('soplo'); fx.aire(ev.x, ev.y, ev.ang); break;
    case 'sobre': sonido.tocar('sobre'); fx.papelitos(ev.x2, ev.y2, 6, ['#f7f1e3', '#cfc3a8'], { vel: 80, tam: 2.5 }); break;
    case 'boing': sonido.tocar('boing', { fuerza: ev.fuerza }); break;
    case 'comido': sonido.tocar('comer'); m.comer(); fx.papelitos(ev.x, ev.y - 10, 22, COLORES_PAPEL, { vel: 220, arriba: 120 }); vibrar([18, 30, 18]); break;
    case 'roto': sonido.tocar('roto'); m.llorar(); fx.papelitos(ev.x, ev.y, 18, [col.a, col.b, col.papel], { vel: 190, tam: 3 }); vibrar([30, 20, 50]); if (p === partida) aviso = { texto: tr('roto'), t: 0 }; break;
    case 'perdido': sonido.tocar('perdido'); m.llorar(); if (p === partida) aviso = { texto: tr('perdido'), t: 0 }; break;
  }
}
function eventoMenu(ev) {
  if (ev.tipo === 'corte') { sonido.tocar('corte'); vibrar(6); }
  else if (ev.tipo === 'comido') { sonido.tocar('comer'); vibrar(15); }
}

// ── el paso ────────────────────────────────────────────────────────────────
let camJuego = null;
const aTablero = (cam, x, y) => [(x * dpr - cam.ox) / cam.esc, (y * dpr - cam.oy) / cam.esc];
function paso(dt) {
  t += dt;
  if (estado === 'espera') return;
  if (estado === 'intro') { intro.pasar(dt, W, H); return; }
  if (estado === 'menu' || estado === 'idiomas') {
    // el dedo en el menú: el tajo corta el hilo del caramelo del menú y empuja el cartel
    entrada.sacarToques();
    for (const [x1, y1, x2, y2] of entrada.sacarCortes()) { fondoMenu.cortar(x1 * dpr, y1 * dpr, x2 * dpr, y2 * dpr); fondoMenu.mover(x2 - x1); }
  }
  if (!['juego', 'pausa', 'gano'].includes(estado)) fondoMenu.pasar(dt);
  if (estado === 'tienda') tienda.muestra.pasar(dt, { blanco: tienda.tipo === 'dulces' ? [0, -170] : [Math.sin(t * 0.8) * 60, -80], ganas: tienda.tipo === 'dulces' ? 0.55 : 0 });
  if (!partida || estado === 'pausa') return;
  const p = partida;
  if (estado === 'juego' && p.estado === 'juego' && camJuego) {
    for (const [x, y] of entrada.sacarToques()) p.tocar(...aTablero(camJuego, x, y));
    for (const [x1, y1, x2, y2] of entrada.sacarCortes()) p.cortar(...aTablero(camJuego, x1, y1), ...aTablero(camJuego, x2, y2));
  } else { entrada.sacarToques(); entrada.sacarCortes(); }
  alfa = p.avanzar(dt);
  for (const ev of p.sacarEventos()) evento(ev, efectos, morfi, p);
  morfi.pasar(dt, { blanco: p.estado === 'juego' ? [p.x - p.morfi.x, p.y - p.morfi.y] : null, ganas: p.apetito() });
  efectos.pasar(dt);
  if (aviso) aviso.t += dt;
  if (ayuda) {
    ayuda.t += dt;
    if (entrada.usos > 0 && ayuda.hasta > ayuda.t + 2.5) ayuda.hasta = ayuda.t + 2.5;
  }
  if (estado === 'juego' && p.estado === 'comido' && p.tFin > 1.35) ganar();
  // se cayó o se rompió: como en los juegos del género, vuelve a empezar solo
  if (estado === 'juego' && (p.estado === 'roto' || p.estado === 'perdido') && p.tFin > 1.25) jugar(nivelI);
}

// ── el dibujo ──────────────────────────────────────────────────────────────
function dibujar() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (estado === 'espera') { g.fillStyle = '#b7864f'; g.fillRect(0, 0, W, H); return; }
  if (estado === 'intro') { intro.dibujar(g, W, H); return; }
  if (partida && ['juego', 'pausa', 'gano'].includes(estado)) {
    const arriba = arribaCss() * dpr;
    camJuego = camaraTablero(W, H, { margenArriba: arriba + 50 * dpr });
    const c = Math.floor(nivelI / 10);
    dibujarNivel(g, W, H, partida, camJuego, { t, alfa, morfi, pielCaramelo: datos.dulce, efectos, mundo: CAJAS[c].id, dpr });
    if (estado !== 'gano') {
      const ay = ayuda && ayuda.t < ayuda.hasta ? { texto: ayuda.texto, alfa: clamp(ayuda.t / 0.3, 0, 1) * clamp((ayuda.hasta - ayuda.t) / 0.4, 0, 1) } : null;
      dibujarHud(g, W, H, { p: partida, u: dpr, t, hud, arriba, ayuda: ay, aviso, nombreCaja: nombreCaja(c) });
      dibujarRastros(g, entrada.rastrosVivos().map((r) => r.map((q2) => ({ x: q2.x * dpr, y: q2.y * dpr, edad: q2.edad }))), dpr);
    }
    return;
  }
  const acostado = W > H * 1.2;
  if (estado === 'tienda') {
    g.drawImage(fondo('carton', W, H, dpr), 0, 0);
    const cx = W / 2, piso = acostado ? H * 0.72 : H * 0.62, s = Math.min(W, H) / 250;
    if (tienda.tipo === 'dulces') {
      // el caramelo elegido colgado de un hilo y Morfi abajo, con ganas
      const p = lista()[tienda.i], cy = piso - 150 * s, bal = Math.sin(t * 1.5) * 0.12;
      const hx = cx + Math.sin(bal) * 70 * s, hy = cy - 70 * s + Math.cos(bal) * 70 * s;
      g.strokeStyle = '#e2c48f'; g.lineWidth = 3.2 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, cy - 70 * s); g.lineTo(hx, hy); g.stroke();
      pegar(g, spriteCaramelo(s * 1.6, p.id), hx, hy + 6 * s, { ang: bal * 0.6, alto: 5 * s });
      tienda.muestra.dibujar(g, cx, piso, s * 0.9);
    } else tienda.muestra.dibujar(g, cx, piso, s * 1.3);
    pintarGrano(g, W, H, 0.35);
    return;
  }
  // los menús: parado, el cartel arriba, Morfi con su caramelo en el medio (si
  // hay lugar) y los botones abajo; acostado (o en la compu), Morfi grande a
  // la izquierda y el cartel arriba de los botones, a la derecha
  const arriba = arribaCss() * dpr;
  let zona, escena = null;
  if (acostado) {
    const r = $(estado === 'idiomas' ? 'idiomasBotones' : 'botonera').getBoundingClientRect();
    const cx = r.width ? ((r.left + r.right) / 2) * dpr : W * 0.74, techo = r.height ? r.top * dpr : H * 0.55;
    // el cartel ocupa de los alfileres a la tira del subtítulo unos 0,86 de su ancho
    const ancho = Math.max(120 * dpr, Math.min(W * 0.38, H * 0.6, (techo - arriba - 48 * dpr) / 0.86));
    zona = { cx, y: arriba + 40 * dpr + ancho * 0.3, ancho };
    if (estado === 'menu' || estado === 'idiomas') escena = { x: W * 0.03, y: arriba, w: W * 0.46, h: H - arriba - 10 * dpr };
  } else {
    const ancho = Math.min(W * 0.86, 460 * dpr);
    // el cartel cuelga debajo de las bolsas de monedas y estrellas (si no, tapaban los alfileres)
    zona = { cx: W / 2, y: arriba + 50 * dpr + ancho * 0.3, ancho };
    if (estado === 'menu' || estado === 'idiomas') {
      const abajoCartel = zona.y + ancho * 0.62, tope = (estado === 'menu' ? topeBotones : $('idiomasBotones').getBoundingClientRect().top || Infinity) * dpr;
      if (tope - abajoCartel > 110 * dpr) escena = { x: W * 0.08, y: abajoCartel, w: W * 0.84, h: Math.min(tope - abajoCartel - 6 * dpr, (W * 0.84 * ESCENA.h) / ESCENA.w) };
    }
  }
  // en las cajas, los niveles y los ajustes el cartel no va: se pisaba con el título
  const conCartel = estado === 'menu' || estado === 'idiomas';
  fondoMenu.dibujar(g, W, H, dpr, { zona: conCartel ? zona : null, escena, pielMorfi: datos.morfi, pielDulce: datos.dulce, subtitulo: tr('subtitulo') });
  if (estado === 'menu' || estado === 'idiomas') dibujarRastros(g, entrada.rastrosVivos().map((r) => r.map((q2) => ({ x: q2.x * dpr, y: q2.y * dpr, edad: q2.edad }))), dpr);
  if (['cajas', 'niveles', 'ajustes'].includes(estado)) { g.fillStyle = 'rgba(40,24,8,0.28)'; g.fillRect(0, 0, W, H); }
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
  if (d.startsWith('nivel:')) { const i = NIVELES.findIndex((n) => n.id === d.slice(6)); jugar(i >= 0 ? i : 0); }
}
requestAnimationFrame(cuadro);

// Las sondas para las pruebas (pruebas/juego.mjs).
window.__G = {
  get estado() { return estado; }, get partida() { return partida; }, get datos() { return datos; }, get intro() { return intro; },
  get tienda() { return tienda; }, get fondo() { return fondoMenu; }, get morfi() { return morfi; }, get hud() { return hud; }, get camJuego() { return camJuego; },
  get nivelI() { return nivelI; }, get ayuda() { return ayuda; },
  pasos(n, dib = false) { for (let k = 0; k < n; k++) paso(PASO); if (dib) dibujar(); },
  dibujar, entrar, jugar, aMenu, pausar, seguir, reiniciar, elegirIdioma, abrirTienda, moverTienda, comprarOUsar, armarCajas, armarNiveles, entrada, sonido, tr,
  get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
};
window.listo = true;
