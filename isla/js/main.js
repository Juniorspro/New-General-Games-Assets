// La Isla — el arranque y el bucle. Arma la isla desde la semilla, carga lo
// guardado, conecta cada parte y reparte cada cuadro entre el menú, el juego,
// la ventana de inventario y la pausa. También el final: el barco que viene a
// buscarte cuando el faro vuelve a alumbrar.
import * as THREE from '../vendor/three.module.min.js';
import { LUZ } from './material.js';
import { texturas } from './texturas.js';
import { Cielo } from './cielo.js';
import { Mundo } from './mundo.js';
import { Mina, MINA_Y } from './mina.js';
import { Reflejo } from './agua.js';
import { medirPantalla, pedirAcostado, pantalla } from './pantalla.js';
import { enlazarCielo } from './gemas.js';
import { ITEMS, estrellasTexto, precioTexto } from './items.js';
import { Inventario } from './inventario.js';
import { Entrada } from './entrada.js';
import { Jugador } from './jugador.js';
import { Particulas } from './particulas.js';
import { Objetos } from './objetos.js';
import { Luces } from './luces.js';
import { Bloques } from './construir.js';
import { Sonido } from './sonido.js';
import { Mano } from './mano.js';
import { Pesca } from './pesca.js';
import { Acciones } from './acciones.js';
import { Hud } from './hud.js';
import { Menu } from './menu.js';
import { Enemigos } from './enemigos.js';
import { Combate } from './combate.js';
import { Historia } from './historia.js';
import { Mercader } from './mercader.js';
import { Mapa } from './mapa.js';
import { Personaje, camaraTercera } from './personaje.js';
import { Paisaje } from './paisaje.js';
import { leerPartida, guardarPartida, aplicarPartida, borrarPartida, hayPartida, leerAjustes, guardarAjustes } from './guardado.js';
import { mulberry } from './azar.js';
import { t, ponerIdioma, detectarIdioma, locale } from './idioma.js';
import { IntroJXS } from './intro.js';

const url = new URLSearchParams(location.search);
const lienzo = document.getElementById('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;

const escena = new THREE.Scene();
const escenaMano = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(70, 1, 0.08, 1600);

// sombra, densidad de pasto y píxel más grande en los aparatos chicos
const CALIDADES = [
  { sombra: 1024, caja: 34, pasto: 0.45, pixelExtra: 1 },
  { sombra: 2048, caja: 42, pasto: 1, pixelExtra: 0 },
  { sombra: 4096, caja: 50, pasto: 1.35, pixelExtra: 0 },
];
const entrada = new Entrada(lienzo);
const [ajustes, habiaAjustes] = leerAjustes();
if (!habiaAjustes && entrada.tactil) ajustes.calidad = 0;
if (url.has('calidad')) ajustes.calidad = Math.max(0, Math.min(2, +url.get('calidad')));
// el idioma: el guardado, o el ?idioma= de las pruebas, o el del navegador
const idiomaElegido = !!ajustes.idioma || url.has('idioma');
ponerIdioma(url.get('idioma') || ajustes.idioma || detectarIdioma());
document.title = t('doc.titulo');

// Escala de píxel ENTERA: la pantalla se dibuja chica y se estira con
// image-rendering: pixelated. Con escalas no enteras los píxeles salen de
// tamaños distintos y todo tiembla al moverse.
let escala = 1, fovBase = 70, reflejo = null;
function medir() {
  // acostado siempre: con el teléfono parado la app se gira 90° (pantalla.js)
  const { w, h } = medirPantalla(entrada.tactil);
  escala = Math.max(1, Math.round(Math.max(w, h) / 760)) + CALIDADES[ajustes.calidad].pixelExtra;
  if (ajustes.pixel) escala = ajustes.pixel;
  if (url.has('escala')) escala = Math.max(1, +url.get('escala'));
  renderer.setPixelRatio(1 / escala);
  renderer.setSize(w, h, false);
  if (reflejo) { const t = renderer.getDrawingBufferSize(new THREE.Vector2()); reflejo.tamano(t.x, t.y); }
  camara.aspect = w / h;
  // Con el teléfono parado, 70° verticales dejan ver casi nada de costado:
  // se abre hasta tener unos 58° horizontales (con tope, si no se deforma).
  fovBase = w >= h ? 70 : Math.min(95, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(29)) / camara.aspect)));
  camara.fov = fovBase;
  camara.updateProjectionMatrix();
}
addEventListener('resize', medir);
medir();

// ── la intro de JXSTUDIOS, antes que nada ──────────────────────────────────
// Sale apenas carga la página, sin tocar nada. La isla tarda un par de
// segundos en armarse y traba la página mientras tanto: se arma recién
// cuando la intro termina en blanco, y la playa aparece desde ese blanco.
// ?directo (o volver de "isla nueva") no tiene intro; las pruebas (?pausa,
// ?cam, ?sinintro) tampoco, salvo con ?intro. → correrIntro, intro.js
const son = new Sonido();
let directo = url.has('directo');
try { if (sessionStorage.getItem('isla_directo')) { directo = true; sessionStorage.removeItem('isla_directo'); } } catch { /* nada */ }
const conIntro = !directo && (url.has('intro') || !(url.has('pausa') || url.has('cam') || url.has('sinintro')));
if (conIntro) await correrIntro();

// ── el mundo ────────────────────────────────────────────────────────────────
const nueva = url.has('nueva');
const partida = nueva ? null : leerPartida();
const semilla = +(url.get('semilla') || (partida && partida.semilla) || 20260929);
const tex = texturas();
const cielo = new Cielo(escena);
enlazarCielo(cielo);   // antes de cualquier gema: sus materiales leen el cielo
const mundo = new Mundo(escena, tex, semilla, { pasto: CALIDADES[ajustes.calidad].pasto });
mundo.armarAgua(cielo);
// lo que se refleja en el agua (capa 1): con calidad alta, también el terreno
reflejo = new Reflejo(mundo.agua);
medir();
const enReflejo = (o, si = true) => o.traverse((h) => { if (si) h.layers.enable(1); else h.layers.disable(1); });
for (const o of [mundo.veg.troncos, mundo.veg.hojas, mundo.veg.cocos, mundo.choza.grupo, mundo.muelle.grupo, mundo.mina.grupo]) enReflejo(o);
const mina = new Mina(escena, tex, semilla);
const luces = new Luces();
for (const l of mina.lamparas) luces.agregar(l, [1.0, 0.72, 0.4, 7.5], 1.5);
const part = new Particulas(escena);
const bloques = new Bloques(escena, tex, luces, LUZ.uT);
mundo.bloques = bloques;

// La física pregunta acá: arriba es la isla, abajo (y < −30) la mina. Los
// objetos y la boya deciden por SU altura, no por dónde está el jugador: lo
// que quedó tirado en la playa no se cae a la mina cuando bajás.
const J = {
  THREE, renderer, escena, escenaMano, camara, cielo, mundo, mina, luces, part, bloques, entrada, LUZ, tex, t,
  ajustes, estado: 'carga', bajo: false, noche: 0, nivelAgua: 0, dia: 1, stats: {}, descubiertos: new Set(), objetivoI: 0,
  tiempo: 0, plata: 0, armadura: null, terceraPersona: false, pausaGolpe: 0,
  // de dónde sale todo lo que hace el jugador (golpes, flechas, la mano): los
  // ojos, no la cámara, que en tercera persona está atrás
  ojos: new THREE.Vector3(),
};
J.camaraOjos = { position: J.ojos, quaternion: camara.quaternion };
// la luz cian de la sala del guardián
for (const p of mina.lucesJefe) luces.agregar(p, [0.35, 0.9, 1.0, 13], 2.4);
const fisica = {
  suelo: (x, z, y, e = 0.55) => (y < -30 ? Math.max(MINA_Y, bloques.suelo(x, z, y, e)) : mundo.suelo(x, z, y, e)),
  techo: (x, z, y) => (y < -30 ? Math.min(mina.techo(), bloques.techo(x, z, y)) : mundo.techo(x, z, y)),
  obstaculos: (x, z, r) => (J.bajo ? mina.obstaculos(x, z, r) : mundo.obstaculos(x, z, r)),
  bloques: { empujar: (p, r, a, e) => { bloques.empujar(p, r, a, e); if (J.bajo) mina.empujar(p, r); } },
};
const objetos = new Objetos(escena, fisica, part, luces);
const mano = new Mano(escenaMano);
const pesca = new Pesca(escena, fisica, part, son);
const jugador = new Jugador(fisica);
const inv = new Inventario(36);
objetos.cabe = (id) => inv.cabe(id, 1);
Object.assign(J, { objetos, son, mano, pesca, jugador, inv, fisica });

// El propósito y lo que se mueve: el faro y el naufragio (tocan el terreno,
// así que van antes de cargar la partida), los enemigos, el mercader, el mapa
// con el tesoro, el náufrago de la tercera persona y los bichos del paisaje.
const historia = new Historia(J);
const enemigos = new Enemigos(J);
const combate = new Combate(J);
const mercader = new Mercader(J);
const mapa = new Mapa(J);
const personaje = new Personaje(escena);
const paisaje = new Paisaje(J);
Object.assign(J, { historia, enemigos, combate, mercader, mapa, personaje, paisaje });

// lo que se ve arriba y no abajo
const superficie = [mundo.terreno.grupo, mundo.agua, mundo.veg.grupo, mundo.rocas.grupo, mundo.pasto.grupo, mundo.choza.grupo, mundo.muelle.grupo, mundo.mina.grupo, historia.faro.grupo, historia.naufragio];
function ponerBajo(v) {
  // los enemigos comunes no cruzan de piso: se borran y aparecen otros
  if (v !== J.bajo) enemigos.limpiar(true);
  J.bajo = v;
  for (const o of superficie) o.visible = !v;
  if (J.menu) { J.menu.ajustes.grupo.visible = !v; J.menu.creditos.grupo.visible = !v; }
  mina.grupo.visible = v;
  cielo.bajoTierra = v ? 1 : 0;
  cielo.sol.castShadow = !v;
}

// Los pedazos de terreno bajo el mar profundo no se ven (el agua los tapa y
// abajo está el lecho plano): no se dibujan.
function ocultarFondo() {
  for (const c of mundo.terreno.chunks) c.visible = c.geometry.boundingBox.max.y > -7.6;
}
ocultarFondo();

// ── el juego, en funciones que usan las partes ──────────────────────────────
J.ponerBajo = ponerBajo;
J.hayPartida = hayPartida;
J.estadoMenu = () => J.estado === 'menu' || J.estado === 'pausa';
J.patrimonio = () => {
  let v = inv.valor() + J.plata;
  for (const c of bloques.cofres.values()) v += c.valor();
  return v;
};
J.hayMesaCerca = () => bloques.cerca(jugador.p.x, jugador.p.z, 4).some((b) => b.tipo === 'mesa' && Math.abs(b.y - jugador.p.y) < 3);
J.resumenPartida = () => {
  const d = leerPartida();
  if (!d) return '';
  const cuando = new Date(d.guardado || Date.now());
  return t('menu.guardada', { fecha: cuando.toLocaleDateString(locale()), hora: cuando.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hourCycle: locale() === 'en-US' ? 'h12' : 'h23' }), dia: d.dia || 1 });
};

const fundidos = [];
const velo = document.getElementById('velo');
J.fundido = (fn, espera = 0.45) => { velo.classList.add('on'); fundidos.push({ t: 0, fn, espera }); };

function descubrir(id) {
  if (J.descubiertos.has(id) || !ITEMS[id]) return false;
  J.descubiertos.add(id);
  const it = ITEMS[id];
  J.hud.noti(t('n.nuevo', { nombre: it.nombre, e: estrellasTexto(it.estrellas) }), id, 'n:' + id, 0, true);
  son.sfx(it.estrellas >= 4 ? 'estrella' : 'noti');
  return true;
}
function alJuntar(o) {
  const resto = inv.agregar(o.id, o.n);
  const n = o.n - resto;
  if (n > 0) {
    son.sfx('juntar');
    const it = ITEMS[o.id];
    if ((it.tipo === 'gema' || it.tipo === 'raro') && J.descubiertos.has(o.id)) son.sfx('cristal');
    if (!descubrir(o.id)) J.hud.noti(t('n.junta', { nombre: it.nombre }), o.id, 'j:' + o.id, n);
  }
  if (resto) J.hud.noti(t('n.llena'), null, 'lleno');
  return resto;
}
J.descubrir = descubrir;
J.alComprar = (o) => {
  J.stats.comprado = (J.stats.comprado || 0) + o.precio;
  if (!descubrir(o.id)) J.hud.noti(t('n.compraste', { nombre: ITEMS[o.id].nombre }), o.id, 'c:' + o.id);
};
J.alVencerJefe = () => {
  son.sfx('victoria');
  J.sacudir(0.6);
  J.hud.noti(t('n.jefeVencido'), 'corazonCristal', 'jefe', 0, true);
};
J.alFabricar = (rec) => {
  J.stats.fabricados = (J.stats.fabricados || 0) + 1;
  if (!descubrir(rec.id)) J.hud.noti(t('n.hiciste', { nombre: ITEMS[rec.id].nombre }), rec.id, 'f:' + rec.id);
};

let soltandoAPropósito = false;
J.alAbrirVentana = () => {
  J.estado = 'ventana';
  entrada.activo = false;
  soltandoAPropósito = !!document.pointerLockElement;
  entrada.soltarCaptura();
  bloques.mostrarHolo(null);
  J.acciones.anillo.visible = false;
  J.hud.aviso('');
  J.hud.progreso(null);
};
J.alCerrarVentana = () => {
  J.estado = 'jugando';
  entrada.activo = true;
  entrada.pedirCaptura();
};

J.aplicarAjustes = (guardar = true) => {
  const a = J.ajustes;
  son.volumen('musica', a.musica); son.volumen('efectos', a.efectos); son.volumen('ambiente', a.ambiente);
  entrada.sens = a.sens;
  const q = CALIDADES[a.calidad] || CALIDADES[1];
  reflejo.activo = a.calidad > 0;
  for (const c of mundo.terreno.chunks) enReflejo(c, a.calidad === 2);
  if (J.calidad !== a.calidad) {
    cielo.ponerCalidadSombra(q.sombra, q.caja);
    if (J.calidad !== undefined) { mundo.pasto.densidad = q.pasto; mundo.pasto.todo(); }
    J.calidad = a.calidad;
  }
  medir();
  if (guardar) guardarAjustes(a);
};

// ── objetivos: la historia los lleva en capítulos (historia.js) ────────────
const revisarObjetivo = () => historia.revisar();

// ── partida nueva: la isla con cosas tiradas para empezar ──────────────────
function sembrar() {
  const r = mulberry(semilla ^ 0x51a3);
  const T = mundo.terreno;
  const poner = (id, x, z) => {
    if (mundo.dentroDePiso(x, z, 0.4)) return false;
    const y = fisica.suelo(x, z, 50);
    if (y < 0.3) return false;
    const o = objetos.soltar(id, 1, new THREE.Vector3(x, y, z), new THREE.Vector3());
    if (o) { o.quieto = true; o.t = 1; }
    return !!o;
  };
  const s = mundo.spawn;
  for (let i = 0, n = 0; i < 300 && n < 9; i++) {
    const a = r() * Math.PI * 2, d = 3 + r() * 9;
    if (poner(n < 5 ? 'rama' : 'piedra', s.x + Math.cos(a) * d, s.z + Math.sin(a) * d)) n++;
  }
  for (const p of mundo.veg.palmeras) if (!p.reserva && r() < 0.22) { const a = r() * 6.28, d = 0.9 + r() * 1.8; poner('rama', p.x + Math.cos(a) * d, p.z + Math.sin(a) * d); }
  for (let i = 0, k = 0; i < 800 && k < 30; i++) {
    const x = (r() * 2 - 1) * 95, z = (r() * 2 - 1) * 95;
    const h = T.altura(x, z);
    if (h < 0.5 || h > 8) continue;
    if (poner('piedra', x, z)) k++;
  }
  // la botella de la primera carta, en la arena al lado del barco roto
  const b = historia.posNaufragio;
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, d = 3.2 + r() * 2.5;
    const x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d, h = T.altura(x, z);
    if (h > 0.3 && h < 1.6 && poner('botella', x, z)) break;
  }
}

function yawHacia(desde, hacia) { return Math.atan2(-(hacia.x - desde.x), -(hacia.z - desde.z)); }

function nuevaPartida() {
  const s = mundo.spawn;
  jugador.ponerEn(s, yawHacia(s, mundo.muelle.punta));
  jugador.pitch = -0.08;
  cielo.hora = 0.3;
  sembrar();
}

// ── estados ────────────────────────────────────────────────────────────────
const dedos = document.getElementById('dedos');
document.body.classList.toggle('tactil', entrada.tactil);
function arrancarJuego() {
  J.estado = 'jugando';
  entrada.activo = true;
  J.menu.cerrar();
  J.hud.mostrar(true);
  dedos.classList.toggle('oculto', !entrada.tactil);
  son.musica('juego');
  if (J.stats.partidas === undefined) J.stats.partidas = 0;
  J.stats.partidas++;
  revisarObjetivo();
  // cada vez que se entra, el cartel del capítulo: para qué estás acá
  const n = historia.capitulo;
  J.hud.cartel(t('cap.titulo', { n, nombre: t('cap.' + n) }), t('cap.bajada.' + n));
}

const _eul = new THREE.Euler(0, 0, 0, 'YXZ'), _v = new THREE.Vector3(), _punta = new THREE.Vector3(), _tam = new THREE.Vector2();
J.empezar = (nuevaIsla) => {
  if (nuevaIsla && hayPartida()) {
    borrarPartida();
    try { sessionStorage.setItem('isla_directo', '1'); } catch { /* sin almacenamiento */ }
    J.guardarAlSalir = false;
    location.reload();
    return;
  }
  entrada.pedirCaptura();   // dentro del clic: si no, el navegador no deja
  if (entrada.tactil) pedirAcostado();
  if (jugador.p.y < -30) {
    J.menu.cerrar();
    J.fundido(() => { ponerBajo(true); arrancarJuego(); });
    return;
  }
  const destino = { pos: jugador.ojos(new THREE.Vector3()), quat: new THREE.Quaternion().setFromEuler(_eul.set(jugador.pitch, jugador.yaw, 0, 'YXZ')) };
  J.estado = 'menu';
  J.menu.entrar(destino, arrancarJuego);
};

J.pausar = () => {
  if (J.estado !== 'jugando') return;
  J.estado = 'pausa';
  entrada.activo = false;
  J.hud.mostrar(false);
  dedos.classList.add('oculto');
  J.menu.abrir('pausa');
  guardarPartida(J);
};
J.continuar = () => {
  if (J.estado !== 'pausa') return;
  J.menu.cerrar();
  J.estado = 'jugando';
  entrada.activo = true;
  J.hud.mostrar(true);
  dedos.classList.toggle('oculto', !entrada.tactil);
  entrada.pedirCaptura();
};
J.salirAlMenu = () => {
  guardarPartida(J);
  J.hud.mostrar(false);
  dedos.classList.add('oculto');
  entrada.activo = false;
  entrada.soltarCaptura();
  pesca.recoger();
  son.musica('menu');
  const ir = () => { J.estado = 'menu'; J.menu.abrir('principal', { desdeCamara: !J.bajo }); };
  if (J.bajo) J.fundido(() => { ponerBajo(false); J.menu.base.pos.copy(J.menu.principal.pos); J.menu.base.quat.copy(J.menu.principal.quat); ir(); });
  else ir();
};

document.addEventListener('pointerlockchange', () => {
  const capturado = document.pointerLockElement === lienzo;
  if (capturado && J.estado === 'jugando') J.hud.aviso('');
  if (!capturado && J.estado === 'jugando' && !soltandoAPropósito) J.pausar();
  soltandoAPropósito = false;
});
document.getElementById('bPausa').addEventListener('click', () => J.pausar());
document.getElementById('bMapa').addEventListener('click', () => { if (J.estado === 'jugando' || J.hud.capa === 'mapa') mapa.abrir(); });
document.getElementById('bVista').addEventListener('click', () => J.alternarVista());
J.alternarVista = () => {
  if (J.estado !== 'jugando') return;
  J.terceraPersona = !J.terceraPersona;
  son.sfx('ui');
};

// ── el final: subir al barco ────────────────────────────────────────────────
const elFinal = document.getElementById('final');
J.final = () => {
  if (J.estado !== 'jugando') return;
  const primera = !historia.rescatado;
  historia.rescatado = true;
  J.alAbrirVentana();
  son.sfx('victoria');
  const s = J.stats;
  document.getElementById('finalTitulo').textContent = t('fin.titulo');
  document.getElementById('finalTexto').textContent = t(J.dia === 1 ? 'fin.texto1' : 'fin.texto', { d: J.dia });
  document.getElementById('finalStats').textContent = t('fin.stats', { a: s.enemigos || 0, b: s.palmeras || 0, c: s.rocas || 0, e: s.peces || 0, p: precioTexto(J.patrimonio()) });
  document.getElementById('finalPie').textContent = t('menu.pie');
  const b = document.getElementById('finalSeguir');
  b.textContent = t('fin.seguir');
  elFinal.classList.remove('oculto');
  J.hud.mostrar(false);
  if (primera) guardarPartida(J);
  setTimeout(() => b.focus(), 50);
};
document.getElementById('finalSeguir').addEventListener('click', () => {
  elFinal.classList.add('oculto');
  J.hud.mostrar(true);
  J.alCerrarVentana();
  revisarObjetivo();
});
// el audio arranca con el primer gesto: antes, el navegador no deja
const despertar = () => son.iniciar();
addEventListener('pointerdown', despertar);
addEventListener('keydown', despertar);
addEventListener('touchstart', despertar);
J.guardarAlSalir = true;
const guardarSiJuega = () => { if (J.guardarAlSalir && ['jugando', 'ventana', 'pausa'].includes(J.estado)) guardarPartida(J); };
document.addEventListener('visibilitychange', () => { if (document.hidden) guardarSiJuega(); });
addEventListener('pagehide', guardarSiJuega);

// ── cada cuadro ────────────────────────────────────────────────────────────
const NEUTRO = { x: 0, z: 0, correr: false, salto: false, saltoRecien: false, usar: false, usarRecien: false, poner: false, e: false, inv: false, pausa: false, soltar: false, comer: false, pincel: false, mapa: false, vista: false, todo: false, num: -1, rueda: 0, mdx: 0, mdy: 0 };
const bajoAgua = document.getElementById('bajoAgua');
let tGuardar = 40, tObjetivo = 0, horaAntes = 0, sacudida = 0, tAvisoHambre = 0, nocheAvisada = false;
J.sacudir = (k) => { sacudida = Math.max(sacudida, k); };

function superficiePaso() {
  if (J.bajo) return 'piedra';
  const p = jugador.p, T = mundo.terreno;
  const h = T.altura(p.x, p.z);
  if (h < J.nivelAgua - 0.05 && p.y < J.nivelAgua + 0.05) return 'agua';
  if (p.y > h + 0.08) {
    const b = bloques.cerca(p.x, p.z, 0.4).find((q) => Math.abs(bloques.cajaDe(q).y1 - p.y) < 0.06);
    if (b) return b.tipo === 'piedra' ? 'piedra' : 'madera';
    if (mundo.dentroDePiso(p.x, p.z)) return 'madera';
  }
  return T.pasto(p.x, p.z) > 0.5 && T.tierra(p.x, p.z) < 0.5 ? 'pasto' : 'arena';
}

function eventosJugador() {
  for (const ev of jugador.eventos) {
    if (ev === 'paso') son.sfx('paso', { sup: superficiePaso() });
    else if (ev === 'salto') son.sfx('salto');
    else if (ev === 'aterriza') son.sfx('aterriza');
    else if (ev === 'golpe') { son.sfx('dolor'); sacudida = 0.35; }
    else if (ev === 'chapuzon') {
      son.sfx('chapuzon');
      part.rafaga(_v.set(jugador.p.x, J.nivelAgua + 0.05, jugador.p.z), 22, [0xffffff, 0x9ff5ea, 0x6fe3dc], { vel: 2.5, arriba: 4, tam: 0.06 });
    }
  }
  // chapoteo al caminar por el agua baja
  const h = mundo.terreno.altura(jugador.p.x, jugador.p.z);
  if (!J.bajo && h < J.nivelAgua - 0.2 && jugador.enPiso && Math.hypot(jugador.v.x, jugador.v.z) > 2 && Math.random() < 0.3) {
    part.rafaga(_v.set(jugador.p.x, J.nivelAgua + 0.02, jugador.p.z), 2, [0xffffff, 0x9ff5ea], { vel: 1.2, arriba: 2, tam: 0.04, vida: 0.5 });
  }
}

const _dirVista = new THREE.Vector3();
function camaraDelJugador(dt, e) {
  jugador.ojos(J.ojos);
  camara.position.copy(J.ojos);
  _eul.set(jugador.pitch, jugador.yaw, 0, 'YXZ');
  if (sacudida > 0) {
    sacudida = Math.max(0, sacudida - dt);
    _eul.x += (Math.random() - 0.5) * sacudida * 0.08;
    _eul.y += (Math.random() - 0.5) * sacudida * 0.08;
  }
  camara.quaternion.setFromEuler(_eul);
  // tercera persona: la cámara atrás y arriba, mirando para el mismo lado
  if (J.terceraPersona) camaraTercera(J, J.ojos, jugador.direccionMirada(_dirVista), camara.position);
  // correr abre un poco el campo de visión
  const rapido = e.correr && Math.hypot(jugador.v.x, jugador.v.z) > 5.5;
  const fov = fovBase + (rapido ? 6 : 0);
  if (Math.abs(camara.fov - fov) > 0.05) { camara.fov += (fov - camara.fov) * Math.min(1, dt * 6); camara.updateProjectionMatrix(); }
}

// Las fogatas: llamas que se estiran, la luz que tiembla y chispas que suben.
function fogatas(dt) {
  const k = LUZ.uT.value;
  for (const f of bloques.fogatas) {
    const ll = f.malla && f.malla.userData.llamas;
    if (ll) ll.forEach((l, i) => {
      const s = 0.86 + Math.sin(k * (9 + i * 3) + f.x) * 0.12 + Math.sin(k * 23 + i * 2) * 0.06;
      l.scale.set(1.1 - s * 0.25, s, 1.1 - s * 0.25);
      l.rotation.y = k * (1.2 + i * 0.7);
    });
    if (f.luz) f.luz.intensidad = 2.1 + Math.sin(k * 11 + f.z) * 0.25 + Math.sin(k * 27 + f.x) * 0.12;
    if ((f.y < -30) === J.bajo && Math.random() < dt * 6) part.rafaga(_v.set(f.x + 0.5, f.y + 0.55, f.z + 0.5), 1, [0xff8a10, 0xffe27a, 0xffb040], { vel: 0.25, arriba: 1.2, g: -1.2, vida: 1.3, tam: 0.035, esparcir: 0.25 });
  }
}

function mundoComun(dt, centro) {
  J.tiempo = LUZ.uT.value;
  const c = cielo.actualizar(dt, camara, centro);
  if (cielo.hora < horaAntes - 0.5) J.dia++;
  horaAntes = cielo.hora;
  J.noche = c.noche;
  cielo.enlazarSombra();
  const abajoDelAgua = !J.bajo && camara.position.y < J.nivelAgua - 0.02 && mundo.terreno.altura(camara.position.x, camara.position.z) < J.nivelAgua;
  if (abajoDelAgua) { LUZ.uNieblaColor.value.setRGB(0.08, 0.42, 0.58); LUZ.uNieblaDens.value = 0.085; }
  bajoAgua.classList.toggle('on', abajoDelAgua);
  luces.actualizar(dt, camara);
  part.actualizar(dt, (x, z) => fisica.suelo(x, z, camara.position.y + 1), renderer.getDrawingBufferSize(_tam).y, camara.fov);
  if (mundo.terreno.actualizar()) ocultarFondo();
  mundo.pasto.actualizar(camara.position);
  mundo.veg.crecer(dt);
  fogatas(dt);
  historia.actualizar(dt);
  mercader.actualizar(dt);
  mapa.actualizarTesoro();
  paisaje.actualizar(dt, renderer.getDrawingBufferSize(_tam).y, camara.fov, centro);
  const h = mundo.terreno.altura(camara.position.x, camara.position.z);
  son.actualizarAmbiente(dt, Math.max(0, Math.min(1, 1 - (h - 0.4) / 5)), J.noche, J.bajo);
}

// `dibujar` en falso corre solo la lógica: las pruebas avanzan cientos de
// cuadros sin pagar el dibujo de cada uno (en SwiftShader, segundos por cuadro).
function paso(dt, dibujar = true) {
  LUZ.uT.value += dt;
  const e = entrada.leer();
  for (let i = fundidos.length - 1; i >= 0; i--) {
    const f = fundidos[i];
    f.t += dt;
    if (f.t >= f.espera) { fundidos.splice(i, 1); f.fn(); if (!fundidos.length) velo.classList.remove('on'); }
  }

  if (J.estado === 'libre') {
    // cámara fija de las pruebas (?cam=x,y,z&mira=x,y,z): el mundo corre igual
    mundoComun(dt, camara.position);
  } else if (J.estado === 'menu' || J.estado === 'carga') {
    J.menu.actualizar(dt);
    mundoComun(dt, camara.position);
  } else if (J.estado === 'jugando' || J.estado === 'ventana') {
    const jugando = J.estado === 'jugando';
    if (jugando && e.pausa) J.pausar();
    else if (jugando && e.inv) J.hud.abrir('mochila');
    else if (jugando && e.mapa) mapa.abrir();
    else if (jugando && e.vista) J.alternarVista();
    const ee = J.estado === 'jugando' ? e : NEUTRO;
    // La parada de golpe: cuando el arma toca, el arma y los enemigos se
    // congelan unos 50 ms. El jugador no (moverse no se tiene que trabar).
    const dg = J.pausaGolpe > 0 ? 0 : dt;
    J.pausaGolpe = Math.max(0, J.pausaGolpe - dt);
    jugador.actualizar(dt, ee, J.bajo ? -1e9 : J.nivelAgua);
    eventosJugador();
    camaraDelJugador(dt, ee);
    if (J.estado === 'jugando') J.acciones.actualizar(dg, ee);
    else mano.actualizar(dt, J.camaraOjos, jugador);
    combate.actualizar(dg);
    enemigos.actualizar(dg);
    const it = J.acciones.item();
    const r = inv.ranuras[J.acciones.sel];
    personaje.poner(r ? r.id : null);
    personaje.actualizar(dt, jugador, mano.golpe, J.terceraPersona);
    objetos.actualizar(dt, jugador, J.nivelAgua, alJuntar);
    pesca.actualizar(dt, mano.puntaMundo(_punta), jugador, it && it.herr === 'cana' ? it.poder : 1, J.noche);
    if (J.bajo) mapa.explorar();
    mundoComun(dt, jugador.p);
    J.hud.actualizar(dt);
    tObjetivo -= dt;
    if (tObjetivo <= 0) { tObjetivo = 0.5; revisarObjetivo(); }
    tGuardar -= dt;
    if (tGuardar <= 0) { tGuardar = 40; guardarPartida(J); }
    // hambre y desmayo
    tAvisoHambre -= dt;
    if (jugador.hambre < 18 && tAvisoHambre <= 0) { tAvisoHambre = 60; J.hud.noti(t('n.hambre'), 'coco', 'hambre'); }
    // al lado del fuego te recuperás de a poco
    if (jugador.vida > 0 && jugador.vida < 100 && J.acciones.fogataCerca()) jugador.vida = Math.min(100, jugador.vida + dt * 1.5);
    // el aviso de la noche (los esqueletos) y del mercader, la primera vez
    if (!J.bajo && J.noche > 0.62 && !nocheAvisada) { nocheAvisada = true; J.hud.noti(t('n.noche'), null, 'noche'); }
    if (J.noche < 0.3) nocheAvisada = false;
    if (!J.bajo && !J.stats.mercaderVisto && mercader.grupo.visible && mercader.pos.distanceTo(jugador.p) < 60) { J.stats.mercaderVisto = 1; J.hud.noti(t('n.mercader'), 'moneda', 'mercader', 0, true); }
    if (jugador.vida <= 0 && !J.desmayo) {
      J.desmayo = true;
      son.sfx('dolor');
      J.fundido(() => {
        ponerBajo(false);
        jugador.ponerEn(mundo.spawn, yawHacia(mundo.spawn, mundo.muelle.punta));
        jugador.vida = 100; jugador.hambre = Math.max(jugador.hambre, 55);
        J.desmayo = false;
        J.hud.noti(t('n.desmayo'), null, 'desmayo');
      }, 1.0);
    }
  } else if (J.estado === 'pausa') {
    J.menu.actualizar(dt);
    cielo.enlazarSombra();
  }

  if (dibujar) {
    // el reflejo del agua primero (si la cámara está bajo el agua, no hace falta)
    if (!J.bajo && camara.position.y > J.nivelAgua + 0.05) reflejo.dibujar(renderer, escena, camara, cielo.domo, J.nivelAgua);
    else mundo.agua.material.uniforms.uHayReflejo.value = 0;
    renderer.clear();
    renderer.render(escena, camara);
    if ((J.estado === 'jugando' || J.estado === 'ventana' || J.estado === 'pausa') && !J.terceraPersona) {
      renderer.clearDepth();
      renderer.render(escenaMano, camara);
    }
    // el blanco de la intro se va recién con la playa ya dibujada
    if (J.revelar) { J.revelar = false; document.getElementById('blanco').classList.remove('on', 'cargando'); }
  }
  entrada.finCuadro();
}

// ── idioma: todo lo escrito se vuelve a escribir ────────────────────────────
const ETIQUETAS = { bPausa: 'b.pausa', bMapa: 'b.mapa', bVista: 'b.vista', vCerrar: 'b.cerrar', tSalto: 'b.saltar', tUsar: 'b.usar', tPoner: 'b.poner', tE: 'b.e', tInv: 'b.inv' };
function etiquetar() {
  document.title = t('doc.titulo');
  for (const [id, clave] of Object.entries(ETIQUETAS)) { const el = document.getElementById(id); if (el) el.setAttribute('aria-label', t(clave)); }
}
J.cambiarIdioma = (c) => {
  if (!ponerIdioma(c)) return;
  J.ajustes.idioma = c;
  guardarAjustes(J.ajustes);
  etiquetar();
  J.menu.refrescar();
  J.hud.refrescar();
  if (J.estado !== 'menu') revisarObjetivo();
};
etiquetar();

// ── la intro de JXSTUDIOS, con su propio bucle ────────────────────────────
// Corre antes de que exista el juego (ni J ni su bucle): se resuelve cuando
// terminó en blanco. El audio se crea ya: si el navegador deja sonar sin un
// toque, nace andando y la intro trae su música; si no (lo normal), va muda
// y el primer toque la saltea y prende el sonido. Con ?pausa no corre sola:
// las pruebas la avanzan con window.__intro.paso(dt, dibujar).
function correrIntro() {
  return new Promise((listo) => {
    document.getElementById('precarga')?.remove();
    const capa = document.getElementById('intro'), blanco = document.getElementById('blanco');
    blanco.dataset.texto = t('intro.cargando');
    capa.classList.remove('oculto');
    lienzo.style.imageRendering = 'auto';
    son.iniciar();
    const intro = new IntroJXS({
      renderer, son, presenta: t('intro.presenta'),
      alTerminar: () => {
        blanco.classList.add('on', 'cargando');
        capa.classList.add('oculto');
        intro.liberar();
        lienzo.style.imageRendering = '';
        medir();                        // vuelve la resolución pixelada del juego
        window.__intro = null;
        // dos cuadros: que el blanco y el "armando la isla" se pinten antes
        // de que armarla trabe la página
        requestAnimationFrame(() => requestAnimationFrame(() => listo()));
      },
    });
    intro.empezar();
    const _t = new THREE.Vector2();
    const paso = (dt, dibujar = true) => {
      intro.actualizar(dt);
      if (!dibujar || intro.terminado) return;
      // a resolución completa: se vuelve a poner porque medir() la pisa si la pantalla gira
      const pr = Math.min(2, Math.max(1.5, devicePixelRatio || 1));
      if (renderer.getPixelRatio() !== pr) renderer.setPixelRatio(pr);
      renderer.getSize(_t);
      if (_t.x !== pantalla.w || _t.y !== pantalla.h) renderer.setSize(pantalla.w, pantalla.h, false);
      intro.dibujar(pantalla.w, pantalla.h);
    };
    let ultimo = performance.now();
    const bucle = (ahora) => {
      if (intro.terminado) return;
      requestAnimationFrame(bucle);
      paso(Math.max(0, Math.min(0.05, (ahora - ultimo) / 1000)));
      ultimo = ahora;
    };
    if (!url.has('pausa')) requestAnimationFrame(bucle);
    capa.addEventListener('pointerdown', () => { son.iniciar(); intro.saltear(); });
    addEventListener('keydown', () => { son.iniciar(); if (!intro.terminado) intro.saltear(); });
    window.__intro = { intro, paso };
  });
}

// ── arranque ───────────────────────────────────────────────────────────────
J.acciones = new Acciones(J);
J.hud = new Hud(J);
J.menu = new Menu(J);
enReflejo(J.menu.ajustes.grupo); enReflejo(J.menu.creditos.grupo);
// al girar el teléfono la toma del menú se vuelve a elegir (parado mira más a la choza)
addEventListener('resize', () => {
  J.menu.ubicar();
  if (['principal', 'jugar', 'idioma', 'confirmar'].includes(J.menu.modo) && !J.menu.vuelo) {
    J.menu.base.pos.copy(J.menu.principal.pos); J.menu.base.quat.copy(J.menu.principal.quat);
  }
});
J.aplicarAjustes(false);
son.musica('menu');

if (partida) {
  if (!aplicarPartida(J, partida)) nuevaPartida();
  else if (!Number.isFinite(jugador.p.y) || Math.abs(jugador.p.x) > 130 || Math.abs(jugador.p.z) > 130) jugador.ponerEn(mundo.spawn, 0);
} else nuevaPartida();
ponerBajo(false);

// la primera vez se elige el idioma, sobre la misma playa del menú
J.estado = 'menu';
J.menu.abrir(idiomaElegido || directo ? 'principal' : 'idioma');
if (directo) J.empezar(false);
// después de la intro, el blanco se saca recién con la playa dibujada (paso)
if (conIntro) J.revelar = true;

if (url.has('hora')) cielo.hora = +url.get('hora');
if (url.has('cam')) {
  const v = (k) => url.get(k).split(',').map(Number);
  J.menu.cerrar();
  J.estado = 'libre';
  camara.position.set(...v('cam'));
  if (url.has('mira')) camara.lookAt(...v('mira'));
}
document.getElementById('precarga')?.remove();

let ultimo = performance.now();
function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dt = Math.max(0, Math.min(0.05, (ahora - ultimo) / 1000));
  ultimo = ahora;
  paso(dt);
}
if (!url.has('pausa')) requestAnimationFrame(bucle);

// para las pruebas (pruebas/*.mjs): el juego entero y un paso manual
window.__isla = { THREE, J, LUZ, paso, guardar: () => guardarPartida(J), borrar: borrarPartida, listo: true };
