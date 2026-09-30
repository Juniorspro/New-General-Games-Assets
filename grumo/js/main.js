// Grumo, de JXSTUDIOS: el arranque, las pantallas y el bucle.
//
// Cada escena se filma de a tomas: cuando Grumo se muere, "¡corten!",
// la cámara hace clic y arranca la toma siguiente desde el principio (como
// en el género: se aprende dónde está la trampa). Adentro, la partida va en
// pasos fijos de 1/120 s y Grumo se dibuja entre paso y paso; el mundo se
// mueve de a cuadros, 12 por segundo. Los menús son HTML arriba del lienzo;
// el lienzo dibuja detrás la mesa del animador y el set.
//
// Para probar: ?sinintro (directo al menú), ?directo=nivel:2-4, ?pausa (no
// avanza solo: __G.pasos(n); también saltea la intro, salvo con ?intro),
// ?limpio (sin lo guardado), ?idioma=en, ?todo (todo abierto).
import { Partida, COLS, FILAS, ALTO } from './partida.js';
import { NIVELES, SETS } from './niveles.js';
import { dibujarNivel, dibujarNotas, MUNDOS } from './escenario.js';
import { Grumo, PIELES, SOMBREROS, pielDe } from './grumo.js';
import { dibujarManos } from './mano.js';
import { Efectos } from './efectos.js';
import { FondoMenu } from './menu.js';
import { dibujarSet, sombraMarco, dibujarClaqueta, dibujarClaquetaGrande, CLAQUETA, lugarBotones, dibujarBotones, dibujarAyuda, dibujarOscuro } from './hud.js';
import { crearEntrada } from './entrada.js';
import { crearSonido } from './sonido.js';
import { crearIdioma, IDIOMAS } from './idioma.js';
import { cargar, guardar, base, premio, BONO_SET, hechos, nivelAbierto, setAbierto, setHecho } from './guardado.js';
import { IntroJXS, MESA } from './intro.js';
import { pintarGrano, vineta, pintarTitileo, huellas } from './plastilina.js';
import { clamp, lerp, trozos, hash } from './util.js';

const PASO = 1 / 60;
const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const lienzo = $('juego'), g = lienzo.getContext('2d');

let datos = q.has('limpio') ? base() : cargar();
if (IDIOMAS.includes(q.get('idioma'))) datos.ajustes.idioma = q.get('idioma');
if (q.has('todo')) datos.mejor = datos.mejor.map((m) => m || 9);
const tr = crearIdioma(datos.ajustes.idioma);
const sonido = crearSonido(datos.ajustes);
const entrada = crearEntrada(lienzo);
const tactil = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const guardarTodo = () => guardar(datos);
// antes del primer toque el navegador no deja vibrar (y lo avisa en la consola)
const vibrar = (p) => { if (datos.ajustes.vibrar && navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) try { navigator.vibrate(p); } catch { /* no deja */ } };
// las huellas digitales de los botones de HTML (la misma textura del lienzo)
try { document.documentElement.style.setProperty('--huellas', `url(${huellas().toDataURL()})`); } catch { /* sin textura */ }

// ── la pantalla: resolución de verdad, con tope según la calidad ──────────
let W = 0, H = 0, dpr = 1, dprTope = tactil ? 1.5 : 2;
function medir() {
  const tope = datos.ajustes.calidad === 'baja' ? 1 : datos.ajustes.calidad === 'alta' ? 2.5 : dprTope;
  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, tope));
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (w !== W || h !== H) { W = lienzo.width = w; H = lienzo.height = h; }
}
// la muesca de arriba y la barra de abajo del teléfono (en píxeles de CSS)
let arribaSeguro = 0, abajoSeguro = 0;
function medirTodo() { medir(); arribaSeguro = $('sonda').getBoundingClientRect().top || 0; abajoSeguro = innerHeight - ($('sondaAbajo').getBoundingClientRect().top || innerHeight); }
medirTodo();
addEventListener('resize', medirTodo);
const acostado = () => W > H * 1.1;
const conBotones = () => tactil || entrada.tactil;

// dónde va el set del juego (en píxeles del lienzo): arriba la claqueta,
// abajo los botones (en el teléfono); acostado, los botones a los costados
function camaraJuego() {
  const u = dpr, arriba = (arribaSeguro + 64) * u, marco = 12 * u;
  const abajo = conBotones() && !acostado() ? (abajoSeguro + 168) * u : (abajoSeguro + 14) * u;
  const libreW = W - 2 * marco - (conBotones() && acostado() ? 2 * 150 * u : 0), libreH = H - arriba - abajo - 2 * marco;
  const ts = Math.max(8, Math.floor(Math.min(libreW / COLS, libreH / FILAS)));
  return { ts, x: Math.round((W - COLS * ts) / 2), y: Math.round(arriba + marco + (libreH - FILAS * ts) / 2) };
}
// el set del menú: arriba (parado) o a la izquierda (acostado)
function camaraMenu() {
  const u = dpr, arriba = (arribaSeguro + 58) * u, marco = 12 * u;
  if (acostado()) {
    const libreW = W * 0.52 - 2 * marco, libreH = H - arriba - (abajoSeguro + 16) * u - 2 * marco;
    const ts = Math.max(8, Math.floor(Math.min(libreW / COLS, libreH / FILAS)));
    return { ts, x: Math.round(W * 0.03 + marco + (libreW - COLS * ts) / 2), y: Math.round(arriba + marco + (libreH - FILAS * ts) / 2) };
  }
  const r = $(estado === 'idiomas' ? 'idiomasBotones' : 'botonera').getBoundingClientRect();
  const techo = (r.height ? r.top : innerHeight * 0.6) * u - 18 * u;
  const libreH = techo - arriba - 2 * marco, libreW = W - 2 * marco - 24 * u;
  const ts = Math.max(8, Math.floor(Math.min(libreW / COLS, libreH / FILAS)));
  return { ts, x: Math.round((W - COLS * ts) / 2), y: Math.round(arriba + marco + Math.max(0, libreH - FILAS * ts) / 2) };
}

let estado = 'espera', intro = null, t = 0, alfa = 1;
let partida = null, nivelI = 0, toma = 1, tEscena = 0, golpeToma = 9, corteHasta = -1;
let grumo = new Grumo(datos.piel, datos.sombrero), efectos = new Efectos(), ayuda = null;
const resortes = new Map();
const fondoMenu = new FondoMenu({ alEvento: (ev) => eventoMenu(ev) });
const camarin = { tipo: 'pieles', i: 0, muestra: new Grumo() };
const mundoDe = (i) => SETS[Math.floor(i / 10)].id;
const nombreSet = (s) => tr('set_' + SETS[s].id);

// ── las pantallas de HTML ──────────────────────────────────────────────────
function mostrar(id) {
  for (const s of document.querySelectorAll('.pantalla')) s.classList.toggle('oculto', s.id !== id);
  $('bPausa').classList.toggle('oculto', !(id === null && estado === 'juego'));
}
function boton(id, fn) { $(id).addEventListener('click', () => { sonido.tocar('boton'); fn(); }); }

// la próxima escena para jugar: la primera sin terminar (o la última)
function proxima() { const i = datos.mejor.findIndex((m) => m === 0); return i < 0 ? NIVELES.length - 1 : i; }
function textos() {
  document.documentElement.lang = tr.actual();
  const n = proxima(), todas = hechos(datos) === NIVELES.length;
  $('tJugar').textContent = tr('jugar');
  $('tNivelJugar').textContent = todas ? tr('todos') : `${tr('escena', NIVELES[n].id)} · ${tr(NIVELES[n].nombre)}`;
  $('bEscenas').textContent = tr('niveles'); $('bCamarin').textContent = tr('tienda'); $('bAjustes').textContent = tr('ajustes');
  $('tFirma').textContent = tr('creditos').toUpperCase();
  for (const id of ['tMonedas', 'tMonedasEscenas', 'tMonedasCamarin']) $(id).textContent = datos.monedas;
  $('tTomasMenu').textContent = datos.tomas;
  $('tEscenas').textContent = tr('niveles'); $('bVolverEscenas').textContent = tr('volver'); $('bVolverNiveles').textContent = tr('volver');
  $('bPestPieles').textContent = tr('pieles'); $('bPestSombreros').textContent = tr('sombreros'); $('bVolverCamarin').textContent = tr('volver');
  $('tAjustes').textContent = tr('ajustes'); $('bCerrarAjustes').textContent = tr('volver');
  $('tPausa').textContent = tr('pausa'); $('bSeguir').textContent = tr('seguir'); $('bReiniciarPausa').textContent = tr('reiniciar'); $('bSalirPausa').textContent = tr('menu');
  $('bSiguienteNivel').textContent = tr('siguiente'); $('bOtraVez').textContent = tr('otraVez'); $('bMenuGano').textContent = tr('menu');
  $('bFinSeguir').textContent = tr('seguir');
}

// ── el ir y venir ──────────────────────────────────────────────────────────
function entrar() {
  if (estado !== 'espera') return;
  sonido.despertar();
  estado = 'intro'; mostrar(null);
  intro = new IntroJXS({ sonido, vibrar, alTerminar: () => (datos.ajustes.idioma ? aMenu() : elegirIdioma()) });
  intro.textoPresenta = tr('presenta');
}
function elegirIdioma() {
  estado = 'idiomas'; mostrar('idiomas');
  entrada.activo = false; entrada.soltarTodo();
  sonido.musica('menu');
  setTimeout(() => $('bIdioma_' + tr.actual())?.focus(), 50);
}
function aMenu() {
  estado = 'menu'; partida = null;
  entrada.activo = false; entrada.soltarTodo();
  sonido.musica('menu');
  textos(); mostrar('menu');
}
function jugar(i) {
  i = clamp(i, 0, NIVELES.length - 1);
  nivelI = i; toma = 1;
  empezarToma(true);
  estado = 'juego';
  const clave = NIVELES[i].ayuda;
  ayuda = clave ? { texto: tr(clave === 'ayudaMover' && !conBotones() ? 'ayudaTeclas' : clave), t: 0, hasta: 7 } : null;
  mostrar(null);
  entrada.activo = true;
  sonido.musica(mundoDe(i));
}
// una toma nueva: la escena desde el principio (la primera, con la claqueta grande)
function empezarToma(primera) {
  partida = new Partida(NIVELES[nivelI], { toma });
  grumo = new Grumo(datos.piel, datos.sombrero); grumo.nace = primera ? 9 : 0;
  efectos = new Efectos(); resortes.clear();
  tEscena = primera ? 0 : 9; golpeToma = primera ? 9 : 0;
  if (!primera) { corteHasta = t + 1 / 12; sonido.tocar('corte'); setTimeout(() => sonido.tocar('claqueta'), 90); }
}
function pausar() { if (estado !== 'juego' || !partida || partida.estado !== 'juego') return; estado = 'pausa'; entrada.soltarTodo(); mostrar('pausa'); }
function seguir() { if (estado !== 'pausa') return; estado = 'juego'; mostrar(null); }
function reiniciar() {
  if (!partida) return;
  // empezar de nuevo cuenta como una toma más
  if (estado === 'pausa') { estado = 'juego'; mostrar(null); }
  if (estado !== 'juego') return;
  toma++; datos.tomas++; guardarTodo();
  empezarToma(false);
}

// ganó: bolitas, sets nuevos y la tarjeta del final
function ganar() {
  const antes = datos.mejor[nivelI], s = Math.floor(nivelI / 10), setAntes = setHecho(datos, s);
  let bolitas = premio(datos, nivelI, toma);
  if (toma === 1 && !datos.unica.includes(NIVELES[nivelI].id)) datos.unica.push(NIVELES[nivelI].id);
  datos.mejor[nivelI] = antes ? Math.min(antes, toma) : toma;
  if (!setAntes && setHecho(datos, s)) bolitas += BONO_SET;
  datos.monedas += bolitas;
  guardarTodo();
  // la última escena, la primera vez: el final
  if (nivelI === NIVELES.length - 1 && !datos.final) { datos.final = true; guardarTodo(); return verFinal(); }
  estado = 'gano';
  entrada.activo = false; entrada.soltarTodo();
  $('tGano').textContent = toma === 1 ? tr('tomaUnica') : tr('buenaToma');
  $('tGanoTomas').textContent = toma === 1 ? tr('enUnaToma') : tr('enTomas', toma);
  $('tGanoMonedas').textContent = tr('ganaste', bolitas);
  const nuevoSet = nivelI % 10 === 9 && nivelI + 1 < NIVELES.length && !datos.vistos.includes(SETS[s + 1].id);
  if (nuevoSet) { datos.vistos.push(SETS[s + 1].id); guardarTodo(); }
  $('tGanoAviso').textContent = nuevoSet ? `${tr('setNuevo')} · ${nombreSet(s + 1)}` : '';
  const sig = nivelI + 1 < NIVELES.length;
  $('bSiguienteNivel').classList.toggle('oculto', !sig);
  mostrar('gano');
  setTimeout(() => (sig ? $('bSiguienteNivel') : $('bOtraVez')).focus({ preventScroll: true }), 60);
}
function verFinal() {
  estado = 'final';
  entrada.activo = false; entrada.soltarTodo();
  // el premio del final: la corona, de regalo
  if (!datos.sombreros.includes('corona')) { datos.sombreros.push('corona'); guardarTodo(); }
  $('tFinTitulo').textContent = tr('finTitulo'); $('tFinTexto').textContent = tr('finTexto'); $('tFinTomas').textContent = tr('finTomas', datos.tomas);
  sonido.musica('final');
  mostrar('final');
}

// ── los sets y las escenas ─────────────────────────────────────────────────
function armarSets() {
  const lista = $('listaSets');
  lista.textContent = '';
  SETS.forEach((set, s) => {
    const b = document.createElement('button'), abierto = setAbierto(datos, s);
    b.className = `set set-${set.id}` + (abierto ? '' : ' cerrado');
    const nombre = document.createElement('span'); nombre.className = 'nombre-set'; nombre.textContent = nombreSet(s);
    const dato = document.createElement('span'); dato.className = 'dato-set';
    const n = datos.mejor.slice(s * 10, s * 10 + 10).filter((m) => m > 0).length;
    dato.textContent = abierto ? `${n} / 10` : `🔒 ${tr('setCerrado', nombreSet(s - 1))}`;
    b.append(nombre, dato);
    b.addEventListener('click', () => {
      if (!abierto) { sonido.tocar('error'); vibrar(30); return; }
      sonido.tocar('boton'); armarNiveles(s); estado = 'niveles'; mostrar('niveles');
    });
    lista.appendChild(b);
  });
}
function armarNiveles(s) {
  $('tNiveles').textContent = nombreSet(s);
  const grilla = $('grillaNiveles');
  grilla.textContent = '';
  for (let i = s * 10; i < s * 10 + 10; i++) {
    const b = document.createElement('button'), abierto = nivelAbierto(datos, i), m = datos.mejor[i];
    b.className = 'nivelB' + (abierto ? '' : ' cerrado') + (m ? ' hecho' : '') + (datos.unica.includes(NIVELES[i].id) ? ' unica' : '');
    const num = document.createElement('span'); num.className = 'num'; num.textContent = abierto ? String(i % 10 + 1) : '🔒';
    const est = document.createElement('span'); est.className = 'est';
    est.textContent = m ? (m === 1 ? '★' : '🎬' + m) : '';
    b.append(num, est);
    b.setAttribute('aria-label', `${tr('escena', NIVELES[i].id)} · ${tr(NIVELES[i].nombre)}`);
    b.addEventListener('click', () => { if (!abierto) { sonido.tocar('error'); return; } sonido.tocar('boton'); jugar(i); });
    grilla.appendChild(b);
  }
}

// ── el camarín: Grumo grande en el set, flechas, comprar o poner ───────────
const lista = () => (camarin.tipo === 'pieles' ? PIELES : SOMBREROS);
function abrirCamarin(tipo = camarin.tipo) {
  camarin.tipo = tipo;
  const actual = tipo === 'pieles' ? datos.piel : datos.sombrero;
  camarin.i = Math.max(0, lista().findIndex((p) => p.id === actual));
  estado = 'camarin'; mostrar('camarin');
  actualizarCamarin();
}
function actualizarCamarin() {
  const p = lista()[camarin.i], tipo = camarin.tipo, mias = tipo === 'pieles' ? datos.pieles : datos.sombreros, tengo = mias.includes(p.id);
  const puesto = (tipo === 'pieles' ? datos.piel : datos.sombrero) === p.id;
  $('bPestPieles').classList.toggle('elegida', tipo === 'pieles'); $('bPestSombreros').classList.toggle('elegida', tipo === 'sombreros');
  $('bPestPieles').setAttribute('aria-selected', tipo === 'pieles'); $('bPestSombreros').setAttribute('aria-selected', tipo === 'sombreros');
  $('tNombre').textContent = tr((tipo === 'pieles' ? 'piel_' : 'sombrero_') + p.id);
  const b = $('bComprar');
  b.textContent = puesto ? tr('enUso') : tengo ? tr('usar') : tr('comprar', p.precio);
  b.classList.toggle('apagado', puesto || (!tengo && datos.monedas < p.precio));
  $('tAviso').textContent = !tengo && datos.monedas < p.precio ? tr('faltan', p.precio - datos.monedas) : '';
  for (const id of ['tMonedas', 'tMonedasEscenas', 'tMonedasCamarin']) $(id).textContent = datos.monedas;
  camarin.muestra.piel = tipo === 'pieles' ? p.id : datos.piel;
  camarin.muestra.sombrero = tipo === 'sombreros' ? p.id : datos.sombrero;
}
function moverCamarin(d) { camarin.i = (camarin.i + d + lista().length) % lista().length; sonido.tocar('cambia'); camarin.muestra.evento({ tipo: 'aterriza', v: 10 }); actualizarCamarin(); }
function comprarOPoner() {
  const p = lista()[camarin.i], mias = camarin.tipo === 'pieles' ? datos.pieles : datos.sombreros;
  if (!mias.includes(p.id)) {
    if (datos.monedas < p.precio) { sonido.tocar('error'); vibrar(40); return; }
    datos.monedas -= p.precio; mias.push(p.id); sonido.tocar('compra'); vibrar(20);
    camarin.muestra.evento({ tipo: 'gana' }); setTimeout(() => { camarin.muestra.gano = null; }, 900);
  } else sonido.tocar('boton');
  if (camarin.tipo === 'pieles') datos.piel = p.id; else datos.sombrero = p.id;
  guardarTodo(); actualizarCamarin();
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
boton('bJugar', () => jugar(proxima()));
boton('bEscenas', () => { armarSets(); estado = 'escenas'; mostrar('escenas'); });
boton('bCamarin', () => abrirCamarin());
boton('bAjustes', () => { borrarArmado = false; armarAjustes(); estado = 'ajustes'; mostrar('ajustes'); });
boton('bVolverEscenas', aMenu);
boton('bVolverNiveles', () => { armarSets(); estado = 'escenas'; mostrar('escenas'); });
boton('bVolverCamarin', aMenu);
boton('bCerrarAjustes', aMenu);
boton('bPestPieles', () => abrirCamarin('pieles'));
boton('bPestSombreros', () => abrirCamarin('sombreros'));
boton('bAnterior', () => moverCamarin(-1));
boton('bSiguiente', () => moverCamarin(1));
$('bComprar').addEventListener('click', comprarOPoner);
boton('bPausa', pausar);
boton('bSeguir', seguir);
boton('bReiniciarPausa', reiniciar);
boton('bSalirPausa', aMenu);
boton('bOtraVez', () => jugar(nivelI));
boton('bMenuGano', aMenu);
boton('bSiguienteNivel', () => jugar(nivelI + 1));
boton('bFinSeguir', aMenu);
// el primer toque en cualquier lado despierta el audio (tiene que ser dentro del evento)
addEventListener('pointerdown', () => sonido.despertar(), { capture: true });
addEventListener('keydown', (ev) => {
  sonido.despertar();
  if (estado === 'intro') intro?.saltear();
  else if (estado === 'camarin' && ev.code === 'ArrowLeft') moverCamarin(-1);
  else if (estado === 'camarin' && ev.code === 'ArrowRight') moverCamarin(1);
  else if (estado === 'juego' && ev.code === 'KeyR' && !ev.repeat) reiniciar();
  // la pausa se maneja acá: si no, la misma tecla que la saca la vuelve a poner
  else if ((ev.code === 'Escape' || ev.code === 'KeyP') && !ev.repeat) {
    if (estado === 'juego') pausar();
    else if (estado === 'pausa') seguir();
    else if (['escenas', 'camarin', 'ajustes'].includes(estado) && ev.code === 'Escape') aMenu();
    else if (estado === 'niveles' && ev.code === 'Escape') { armarSets(); estado = 'escenas'; mostrar('escenas'); }
  }
}, { capture: true });
lienzo.addEventListener('pointerdown', (ev) => {
  if (estado === 'intro') intro?.saltear();
  else if (estado === 'menu' || estado === 'idiomas') fondoMenu.tocar();
  else if (estado === 'juego' && tEscena < CLAQUETA.golpe - 0.02) tEscena = CLAQUETA.golpe - 0.01;       // saltear la claqueta (el golpe suena igual)
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pausar(); sonido.lava(0); } else sonido.lava(0.9); });

// ── los eventos de la partida: sonido, migas y la cara de Grumo ───────────
function evento(ev) {
  const p = partida, j = p.j, col = pielDe(datos.piel).color, bloque = MUNDOS[mundoDe(nivelI)].bloque;
  grumo.evento(ev);
  switch (ev.tipo) {
    case 'salto': sonido.tocar('salto'); break;
    case 'aterriza': if (ev.v > 4) { sonido.tocar('aterriza', { v: ev.v }); if (ev.v > 11) { efectos.polvo(j.x, j.y, 4); vibrar(8); } } break;
    case 'resorte': sonido.tocar('resorte'); efectos.polvo(ev.x, ev.y, 3); resortes.set(ev.g ?? `${Math.floor(ev.x)},${Math.floor(ev.y - 0.5)}`, t); break;
    case 'cabeza': sonido.tocar('cabeza'); break;
    case 'muere':
      sonido.tocar('muere', { causa: ev.causa }); vibrar([30, 20, 60]);
      if (ev.causa !== 'caida') efectos.migas(ev.x, ev.y - 0.3, 14, [col, col, '#ffffff'], { vel: 6, arriba: 4 });
      break;
    case 'gana': sonido.tocar('gana'); efectos.chispas(ev.x, ev.y - 0.8, 14); vibrar([15, 30, 15]); break;
    case 'mano': sonido.tocar('mano', { fase: ev.fase }); break;
    case 'empujon': sonido.tocar('empujon'); vibrar(20); break;
    case 'cae': sonido.tocar('cae'); break;
    case 'tiembla': sonido.tocar('tiembla'); break;
    case 'aparece': sonido.tocar('aparece', { golpe: ev.golpe }); break;
    case 'desaparece': { sonido.tocar('desaparece'); const gr = p.g[ev.g]; if (gr) efectos.puf((gr.c0 + gr.c1) / 2 + gr.ox, (gr.f0 + gr.f1) / 2 + gr.oy, { color: '#f4eadc' }); break; }
    case 'mueve': sonido.tocar('mueve', { rapido: ev.rapido }); break;
    case 'cruje': sonido.tocar('cruje'); break;
    case 'desarma': { sonido.tocar('desarma'); const gr = p.g[ev.g]; if (gr) efectos.migas((gr.c0 + gr.c1) / 2 + gr.ox, (gr.f0 + gr.f1) / 2 + gr.oy, 16, [bloque], { vel: 4, arriba: 2 }); break; }
    case 'puerta': sonido.tocar('puerta', ev); break;
    case 'bola': sonido.tocar('bola'); break;
    case 'luz': sonido.tocar('luz'); break;
    case 'nota': sonido.tocar('nota'); break;
    case 'corte': sonido.tocar('corte'); corteHasta = t + 1 / 12; break;
    case 'temblor': sonido.tocar('temblor'); vibrar(60); break;
    case 'bonk': sonido.tocar('bonk'); efectos.chispas(ev.x, ev.y - 1, 6); vibrar(25); break;
  }
}
function eventoMenu(ev) {
  if (ev.tipo === 'salto') sonido.tocar('salto');
  else if (ev.tipo === 'aterriza' && ev.v > 4) sonido.tocar('aterriza', { v: ev.v });
  else if (ev.tipo === 'mano') sonido.tocar('mano', { fase: ev.fase });
  else if (ev.tipo === 'empujon') sonido.tocar('empujon');
}

// ── el paso ────────────────────────────────────────────────────────────────
function paso(dt) {
  t += dt;
  if (estado === 'espera') return;
  if (estado === 'intro') { intro.pasar(dt, W, H); return; }
  if (['menu', 'idiomas', 'escenas', 'niveles', 'ajustes'].includes(estado)) {
    for (const dx of entrada.sacarEmpujes()) fondoMenu.mover(dx);
    fondoMenu.pasar(dt);
  } else entrada.sacarEmpujes();
  if (estado === 'camarin') camarin.muestra.pasar(dt, null);
  if (!partida || estado === 'pausa' || estado === 'final') return;
  const p = partida;
  const antes = tEscena;
  tEscena += dt; golpeToma += dt;
  // el golpe de la claqueta grande (¡acción!) suena justo cuando se cierra
  if (antes < CLAQUETA.golpe && tEscena >= CLAQUETA.golpe) { sonido.tocar('claqueta'); vibrar(12); }
  // con la claqueta grande todavía arriba no se puede mover (¡acción! es el golpe)
  const c = estado === 'juego' && tEscena >= CLAQUETA.golpe ? entrada.leer() : { dir: 0, salto: false };
  p.control.dir = c.dir; p.control.salto = c.salto;
  alfa = p.avanzar(dt);
  for (const ev of p.sacarEventos()) evento(ev);
  grumo.pasar(dt, p.j);
  efectos.pasar(dt);
  if (ayuda) { ayuda.t += dt; if (entrada.usos > 3 && ayuda.hasta > ayuda.t + 2.5) ayuda.hasta = ayuda.t + 2.5; }
  if (estado === 'juego' && p.estado === 'muerto' && p.tFin > 0.55) { toma++; datos.tomas++; guardarTodo(); empezarToma(false); }
  if (estado === 'juego' && p.estado === 'gano' && p.tFin > 1.05) ganar();
}

// ── el dibujo ──────────────────────────────────────────────────────────────
let camJuego = null, zonasHechas = '';
function dibujar() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (estado === 'espera') { g.fillStyle = '#050300'; g.fillRect(0, 0, W, H); return; }
  if (estado === 'intro') { intro.dibujar(g, W, H); return; }
  const cuadroReal = Math.floor(t * 12);
  if (partida && ['juego', 'pausa', 'gano'].includes(estado)) { dibujarJuego(cuadroReal); return; }
  // los menús: la mesa, el set con GRUMO colgado y Grumo en su tarima
  const cam = camaraMenu();
  dibujarSet(g, W, H, cam, dpr);
  if (estado === 'camarin') {
    const p = fondoMenu.p;
    dibujarNivel(g, p, cam, { mundo: 'taller', cuadro: cuadroReal, hervor: Math.floor(cuadroReal / 2) });
    camarin.muestra.dibujar(g, cam.x + (COLS / 2) * cam.ts, cam.y + 10 * cam.ts, cam.ts, cuadroReal, { escala: 2.6 });
  } else {
    const mundo = mundoDe(proxima());
    fondoMenu.dibujar(g, cam, { mundo, piel: datos.piel, sombrero: datos.sombrero, u: dpr });
  }
  sombraMarco(g, cam);
  pintarTitileo(g, W, H, cuadroReal, 0.025);
  pintarGrano(g, W, H, cuadroReal, 0.55);
  g.drawImage(vineta(W, H, 0.45), 0, 0);
  if (['escenas', 'niveles', 'ajustes'].includes(estado)) { g.fillStyle = 'rgba(30,16,6,0.4)'; g.fillRect(0, 0, W, H); }
  if (estado === 'final') { g.fillStyle = 'rgba(30,16,6,0.25)'; g.fillRect(0, 0, W, H); }
}
function dibujarJuego(cuadroReal) {
  const p = partida, cam = camaraJuego(), u = dpr;
  camJuego = cam;
  // los botones táctiles: dónde están (para entrada.js, en píxeles de CSS)
  const lugar = conBotones() ? lugarBotones(W, H, cam, u, abajoSeguro * u) : null;
  if (lugar) {
    const k = `${W}x${H}:${cam.ts}`;
    if (k !== zonasHechas) {
      zonasHechas = k;
      const a = acostado();
      entrada.zonas = a ? { techo: 0, medio: (lugar.izq[0] + lugar.der[0]) / 2 / u, corte: W / 2 / u } : { techo: (lugar.izq[1] - lugar.r * 1.6) / u, medio: (lugar.izq[0] + lugar.der[0]) / 2 / u, corte: (lugar.der[0] + lugar.salto[0]) / 2 / u };
    }
  } else entrada.zonas = null;
  // el temblor: la cámara salta de a cuadros
  const tiembla = p.temblor > p.T ? 1 : 0;
  const cx = cam.x + (tiembla ? (hash(p.tick, 1) - 0.5) * cam.ts * 0.18 : 0), cy = cam.y + (tiembla ? (hash(p.tick, 2) - 0.5) * cam.ts * 0.18 : 0);
  const c2 = { ...cam, x: cx, y: cy };
  dibujarSet(g, W, H, cam, u);
  g.save();
  g.beginPath(); g.rect(cam.x, cam.y, COLS * cam.ts, FILAS * cam.ts); g.clip();
  const mundo = mundoDe(nivelI);
  // el set "hierve" de a dos cuadros (el grumo, en cada uno)
  dibujarNivel(g, p, c2, { mundo, cuadro: p.tick, hervor: Math.floor(p.tick / 2), resortes: apretados() });
  // Grumo: entre paso y paso; al ganar, camina adentro de la puerta
  const j = p.j;
  let gx = lerp(j.px, j.x, alfa), gy = lerp(j.py, j.y, alfa), ga = 1;
  if (p.estado === 'gano') { const k = clamp(p.tFin / 0.5, 0, 1); gx = lerp(j.x, p.puerta.x, k); gy = p.puerta.y; ga = 1 - clamp((p.tFin - 0.45) / 0.3, 0, 1); }
  if (ga > 0) grumo.dibujar(g, c2.x + gx * cam.ts, c2.y + gy * cam.ts, cam.ts, cuadroReal, { alfa: ga });
  efectos.dibujar(g, c2);
  dibujarManos(g, p, c2, p.tick);
  dibujarNotas(g, p, c2, tr, p.tick);
  if (p.oscuro > p.T) dibujarOscuro(g, c2, c2.x + gx * cam.ts, c2.y + (gy - ALTO / 2) * cam.ts, 1);
  sombraMarco(g, cam);
  g.restore();
  pintarTitileo(g, W, H, cuadroReal);
  pintarGrano(g, W, H, cuadroReal, 0.6);
  g.drawImage(vineta(W, H, 0.4), 0, 0);
  // el corte de cámara: un cuadro negro
  if (t < corteHasta) { g.fillStyle = 'rgba(0,0,0,0.92)'; g.fillRect(cam.x, cam.y, COLS * cam.ts, FILAS * cam.ts); }
  if (estado === 'gano') return;
  // arriba, la claqueta con la escena y la toma
  const arriba = (arribaSeguro + 8) * u;
  if (tEscena >= CLAQUETA.sube) dibujarClaqueta(g, W, arriba, u, { escena: NIVELES[nivelI].id, toma: tr('toma', toma), golpe: golpeToma, corten: p.estado === 'muerto' ? tr('corten') : '' });
  if (lugar) dibujarBotones(g, lugar, estado === 'juego' ? entrada.apretados() : new Set());
  if (ayuda && ayuda.t < ayuda.hasta && tEscena > CLAQUETA.sube) dibujarAyuda(g, W, cam, u, ayuda.texto, clamp((ayuda.t - 0.9) / 0.3, 0, 1) * clamp((ayuda.hasta - ayuda.t) / 0.4, 0, 1));
  if (tEscena < CLAQUETA.sube) dibujarClaquetaGrande(g, W, H, u, tEscena, { escena: tr('escena', NIVELES[nivelI].id), toma: tr('toma', toma), nombre: tr(NIVELES[nivelI].nombre) });
}
// los resortes apretados: 1 recién pisado, 0 suelto (en 0,25 s)
function apretados() {
  const m = new Map();
  for (const [k, t0] of resortes) { const v = 1 - (t - t0) / 0.25; if (v > 0) m.set(k, v); else resortes.delete(k); }
  return m;
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
  get camarin() { return camarin; }, get fondo() { return fondoMenu; }, get grumo() { return grumo; }, get camJuego() { return camJuego; },
  get nivelI() { return nivelI; }, get toma() { return toma; }, get ayuda() { return ayuda; }, get tEscena() { return tEscena; },
  pasos(n, dib = false) { for (let k = 0; k < n; k++) paso(PASO); if (dib) dibujar(); },
  dibujar, entrar, jugar, aMenu, pausar, seguir, reiniciar, elegirIdioma, abrirCamarin, moverCamarin, comprarOPoner, armarSets, armarNiveles, verFinal, entrada, sonido, tr,
  get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
};
window.listo = true;
