/* ============================================================================
   ruta40/js/main.js — el que dirige: carga, pantallas, el bucle, el HUD y lo
   que pasa con cada evento del viaje (sonido, polvo, cartelitos, vibración).

   Detrás del menú no hay una foto: hay un viaje de verdad manejado por el
   piloto automático, en el tramo y con el vehículo que el jugador eligió.
   ========================================================================== */
import { Pantalla, esTactil } from './pantalla.js';
import { cargarArte, url } from './arte.js';
import { P, cargar, guardar, borrar, anotarViaje, CONTROLES_BASE } from './partida.js';
import { ponerIdioma, t, num, idioma } from './textos.js';
import { Dibujo } from './dibujo.js';
import { Viaje, picada, LARGO_PICADA } from './juego.js';
import { VEHICULOS } from './vehiculos.js';
import { crearPiloto } from './piloto.js';
import { Controles } from './controles.js';
import { Sonido } from './sonido.js';
import * as UI from './ui.js';

const lienzo = document.getElementById('lienzo');
const dib = new Dibujo(lienzo);
let viaje = null, demo = null, estado = 'carga', pausado = false, fondoVivo = false, resultadoMostrado = false;
let conf = null;           // con qué se armó el viaje actual (para "otra vez")
const hud = {};

/* ------------------------------------------------------------------ arrancar */
async function arrancar() {
  cargar();
  const nav = (navigator.language || 'es').slice(0, 2);
  ponerIdioma(P.idioma || (nav === 'pt' ? 'pt' : nav === 'en' ? 'en' : 'es'));
  Pantalla.giro = P.opciones.giro; Pantalla.calidad = P.opciones.calidad;
  Pantalla.iniciar();
  Pantalla.alCambiar.push(medir);
  UI.Polvo.iniciar();
  const carga = UI.pantallaCarga();
  await cargarArte(carga.progreso);
  try { await document.fonts.load('900 20px Overpass'); } catch (_) {}
  Sonido.vol = { musica: P.opciones.musica, motor: P.opciones.motor, efectos: P.opciones.efectos };
  Sonido.radio = P.opciones.radio; Sonido.estilo = P.opciones.estilo;
  Controles.iniciar(P.controles);
  Controles.alPausa = () => alternarPausa();
  armarHUD();
  medir();
  addEventListener('pointerdown', () => Sonido.iniciar(), { capture: true });
  addEventListener('keydown', (e) => {
    Sonido.iniciar();
    if (e.code === 'Escape' || e.code === 'KeyP') alternarPausa();
    if (e.code === 'KeyR' && estado === 'viaje' && !pausado) reiniciar();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (estado === 'viaje' && !pausado) alternarPausa(); if (Sonido.ctx) Sonido.ctx.suspend(); }
    else if (Sonido.ctx) Sonido.ctx.resume();
  });
  requestAnimationFrame(bucle);
  irIdioma();
}
function medir() { dib.medir(Pantalla.W * Pantalla.dpr, Pantalla.H * Pantalla.dpr); dib.dprCss = Pantalla.dpr; Controles.aplicar(); }

/* ------------------------------------------------------------------ el demo del fondo */
function arrancarDemo() {
  const tramo = P.abiertos[P.tramo] ? P.tramo : 'puna';
  const piloto = crearPiloto({ tope: 0.45, mira: 0.3, tol: 0.1, duda: 0.05, gasAlAterrizar: 1 }, (Math.random() * 1e6) | 0);
  demo = new Viaje({ tramo, vehiculo: P.vehiculo, niveles: P.mejoras[P.vehiculo], modo: 'viaje', record: 0 });
  demo.piloto = piloto;
  dib.ponerTramo(demo.R);
}

/* ------------------------------------------------------------------ las pantallas */
function irIdioma() {
  estado = 'idioma'; fondoVivo = false;
  UI.pantallaIdioma((i) => {
    P.idioma = i; ponerIdioma(i); guardar();
    Sonido.iniciar(); Pantalla.acostar();
    UI.Polvo.pasar(() => { if (!P.vista.intro) irHistoria('intro', () => { P.vista.intro = true; guardar(); irMenu(true); }); else irMenu(true); });
  });
}
function irMenu(conPolvo = false) {
  const hacer = () => {
    estado = 'menu'; fondoVivo = true; salirDelViaje();
    if (!demo) arrancarDemo();
    Sonido.musica('menu');
    UI.pantallaMenu({ viajar: () => irMapa(), picadas: () => irMapa(), gomeria: () => irGomeria(), ajustes: () => irAjustes(), historia: () => UI.Polvo.pasar(() => irHistoria('intro', () => irMenu(true))) });
  };
  if (conPolvo === true) hacer(); else hacer();
}
function irMapa() { estado = 'mapa'; fondoVivo = false; Sonido.musica('menu'); UI.pantallaMapa({ volver: () => irMenu(), viajar: (id) => empezar({ tramo: id, modo: 'viaje' }), picada: (id) => irPicadas(id) }); }
function irPicadas(id) { estado = 'picadas'; fondoVivo = true; UI.pantallaPicadas(id, { volver: () => irMapa(), correr: (n) => empezar({ tramo: id, modo: 'picada', nivel: n }) }); }
function irGomeria() { estado = 'gomeria'; fondoVivo = false; Sonido.musica('menu'); const el = UI.pantallaGomeria({ volver: () => { el.cerrar && el.cerrar(); demo = null; irMenu(); } }); }
function irAjustes() {
  estado = 'ajustes'; fondoVivo = true;
  UI.pantallaAjustes({
    volver: () => irMenu(),
    idioma: (i) => { P.idioma = i; ponerIdioma(i); guardar(); irAjustes(); },
    calidad: (c) => { Pantalla.ponerCalidad(c); },
    giro: (g) => { Pantalla.ponerGiro(g); },
    estilo: (e) => { Sonido.estilo = e; const m = Sonido.modoMusica; Sonido.modoMusica = null; Sonido.musica(m); },
    controles: () => irControles(),
    borrar: () => { borrar(); demo = null; UI.Polvo.pasar(() => irIdioma()); },
  });
}
function irControles() {
  estado = 'controles'; fondoVivo = true;
  Controles.mostrar(true); Controles.editar(true, () => guardar());
  UI.pantallaControles({
    aplicar: () => Controles.aplicar(),
    lado: () => Controles.cambiarLado(),
    reset: () => { Object.assign(P.controles, CONTROLES_BASE()); Controles.cfg = P.controles; Controles.aplicar(); irControles(); },
    volver: () => { Controles.editar(false); Controles.mostrar(false); guardar(); irAjustes(); },
  });
}
function irHistoria(cual, alTerminar) { estado = 'historia'; fondoVivo = false; Sonido.musica('menu'); UI.pantallaHistoria(cual, () => UI.Polvo.pasar(alTerminar)); }

/* ------------------------------------------------------------------ el viaje */
function empezar(c) {
  conf = c;
  UI.Polvo.pasar(() => {
    demo = null;
    const o = { tramo: c.tramo, vehiculo: P.vehiculo, niveles: P.mejoras[P.vehiculo], modo: c.modo, record: P.record[c.tramo] || 0, alEvento: evento };
    if (c.modo === 'picada') o.picada = picada(c.tramo, c.nivel);
    viaje = new Viaje(o);
    dib.ponerTramo(viaje.R);
    estado = 'viaje'; pausado = false; fondoVivo = true; resultadoMostrado = false;
    UI.limpiar();
    mostrarHUD(true);
    Controles.mostrar(esTactil() || P.controles.modo === 'mitades');
    Controles.editar(false);
    Sonido.musica('ruta');
    Sonido.motorEncender(VEHICULOS[P.vehiculo].ruido);
    if (!P.vista.tuto) tutorial();
    if (c.modo === 'picada') semaforo(0);
  });
}
function reiniciar() { if (conf) empezar(conf); }
function salirDelViaje() { if (viaje) { Sonido.motorApagar(); viaje = null; } mostrarHUD(false); Controles.mostrar(false); pausado = false; }
function alternarPausa() {
  if (estado !== 'viaje' || !viaje || viaje.fin) return;
  pausado = !pausado;
  if (pausado) {
    Sonido.motorApagar(); Controles.mostrar(false);
    UI.pantallaPausa({ seguir: () => alternarPausa(), reiniciar: () => { pausado = false; reiniciar(); }, salir: () => { pausado = false; salirDelViaje(); UI.Polvo.pasar(() => irMapa()); } });
  } else {
    UI.limpiar(); Controles.mostrar(esTactil() || P.controles.modo === 'mitades'); Sonido.motorEncender(VEHICULOS[P.vehiculo].ruido);
  }
}
function terminarViaje() {
  resultadoMostrado = true;
  const v = viaje, metros = Math.floor(v.metros);
  let r;
  if (v.modo === 'picada') {
    const pc = v.o.picada, gano = v.fin === 'meta' && v.puesto === 1;
    const premio = gano ? pc.premio : Math.round(v.puesto === 2 ? pc.premio * 0.2 : 0);
    if (gano) P.picadas[conf.tramo] = Math.max(P.picadas[conf.tramo] || 0, conf.nivel + 1);
    P.monedas += premio; guardar();
    r = { picada: true, causa: v.fin, puesto: v.fin === 'meta' ? v.puesto : 4, metros: Math.min(metros, LARGO_PICADA), premio, total: premio };
    Sonido.efecto(gano ? 'llego' : 'perdio');
  } else {
    const total = v.monedas;
    P.monedas += total;
    const a = anotarViaje(conf.tramo, metros, v.fin === 'llego');
    r = { causa: v.fin, metros, deMonedas: v.deMonedas, deMojones: v.deMojones, deTrucos: v.deTrucos, total, nuevo: a.nuevo && metros > 30, abrio: a.abrio };
    if (!P.vista.tuto) { P.vista.tuto = true; guardar(); }
  }
  Sonido.motorApagar(); Controles.mostrar(false); mostrarHUD(false);
  UI.pantallaResultado(r, {
    otra: () => reiniciar(),
    gomeria: () => { salirDelViaje(); UI.Polvo.pasar(() => irGomeria()); },
    mapa: () => {
      salirDelViaje();
      UI.Polvo.pasar(() => { if (conf.tramo === 'glaciar' && r.causa === 'llego' && !P.vista.fin) { P.vista.fin = true; guardar(); irHistoria('fin', () => irMapa()); } else irMapa(); });
    },
  });
  estado = 'resultado';
}

/* ------------------------------------------------------------------ lo que pasa en el viaje */
function evento(e) {
  const d = dib;
  switch (e.tipo) {
    case 'moneda':
      Sonido.efecto('moneda', e); d.echar('brillo', e.x, e.y, 0, 1, 2, { tam: 0.45, dura: 0.4, abre: 2 });
      if (e.v >= 25) d.cartel('+' + e.v, e.x, e.y + 0.6, e.v >= 100 ? '#ffd84a' : '#e8f0ff');
      hud.suma = true; break;
    case 'nafta': Sonido.efecto('nafta'); d.cartel(t('nafta') + '!', e.x, e.y + 1, '#ff9a6a'); d.echar('brillo', e.x, e.y, 0, 1, 6, { tam: 0.6, dura: 0.5, abre: 4 }); Controles.vibrar(20); break;
    case 'mojon': Sonido.efecto('mojon'); anunciar(`${t('mojon', { n: num(e.n) })} +${num(e.bono)}`); d.cartel('+' + num(e.bono), e.x, e.y, '#ffd84a', true); break;
    case 'truco': Sonido.efecto('truco', { grande: e.plata >= 300 }); d.cartel(`${e.texto}  +${num(e.plata)}`, e.x, e.y, e.vueltas ? '#ffd84a' : '#ffffff', e.plata >= 300); if (e.plata >= 300) { d.sacudon = 0.3; Controles.vibrar(35); } hud.suma = true; break;
    case 'record': Sonido.efecto('record'); anunciar(t('nuevoRecord')); for (let i = 0; i < 30; i++) d.echar('confeti', e.x, e.y, (Math.random() - 0.5) * 8, 4 + Math.random() * 4, 1, { color: ['#74acdf', '#ffffff', '#f6b40e'][i % 3], dura: 2.2, abre: 3 }); break;
    case 'naftaBaja': Sonido.efecto('naftaBaja'); break;
    case 'aterriza': {
      Sonido.efecto('aterriza', e); d.sacudon = Math.max(d.sacudon, e.fuerza * 0.6);
      const V = d.V; d.echar(V.pasto === 'nieve' || V.pasto === 'sal' ? 'nieve' : 'polvo', e.x, e.y - 0.6, 0, 1.2, Math.round(6 + e.fuerza * 10), { color: V.polvo, tam: 0.4, dura: 1.2, abre: 5 });
      if (e.fuerza > 0.5) Controles.vibrar(Math.round(20 + e.fuerza * 40));
      break;
    }
    case 'rebote': Sonido.efecto('rebote', e); break;
    case 'golpe': Sonido.efecto('golpe', e); d.sacudon = Math.max(d.sacudon, e.fuerza * 0.8); d.echar('chispa', e.x, e.y - 0.3, 0, 3, 8, { dura: 0.5, abre: 7 }); Controles.vibrar(40); break;
    case 'semaforo': Sonido.efecto('semaforo'); semaforo(4 - e.n); break;
    case 'largada': Sonido.efecto('largada'); semaforo(4); setTimeout(() => semaforo(-1), 700); break;
    case 'rivalMeta': break;
    case 'fin': {
      const A = viaje.yo;
      if (e.causa === 'cabeza') { Sonido.efecto('cabeza'); d.sacudon = 0.9; Controles.vibrar(120); const c = A.def.cabeza; for (let i = 0; i < 5; i++) d.echar('estrella', A.x + c.x, A.y + c.y + 0.4, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, 1, { tam: 0.3, dura: 1.4, abre: 1 }); }
      else if (e.causa === 'llego' || (e.causa === 'meta' && e.puesto === 1)) { Sonido.efecto('llego'); for (let i = 0; i < 60; i++) d.echar('confeti', A.x + 3, A.y + 4, (Math.random() - 0.5) * 12, 5 + Math.random() * 6, 1, { color: ['#74acdf', '#ffffff', '#f6b40e', '#e34b3a'][i % 4], dura: 2.8, abre: 4 }); }
      else if (e.causa === 'nafta') Sonido.efecto('perdio');
      else if (e.causa === 'volco') Sonido.efecto('golpe', { fuerza: 0.6 });
      anunciar(e.causa === 'meta' ? (e.puesto === 1 ? t('pc_ganaste') : t('pc_puesto', { n: e.puesto })) : { cabeza: t('cabeza'), nafta: t('sinNafta'), volco: t('volco'), llego: t('llegada') }[e.causa]);
      break;
    }
  }
}

/* ------------------------------------------------------------------ el HUD */
function armarHUD() {
  const { h } = UI;
  const el = document.getElementById('hud');
  hud.tanque = h('i'); hud.nafta = h('div', { class: 'nafta' }, h('img', { src: url('bidon'), alt: '' }), h('div', { class: 'tanque' }, hud.tanque));
  hud.metros = h('b', { text: '0' }); hud.prog = h('div', { class: 'progreso' });
  hud.monedas = h('span', { text: '0' }); hud.monBox = h('div', { class: 'monedasHUD' }, h('img', { src: url('moneda100'), alt: '' }), hud.monedas);
  hud.agujaRpm = h('div', { class: 'aguja' }); hud.agujaVel = h('div', { class: 'aguja' }); hud.vel = h('b', { text: '0' });
  hud.anuncio = h('div', { class: 'anuncio' }); hud.puesto = h('div', { class: 'puesto' }); hud.sem = h('div', { class: 'semaforo oculto' }, h('i'), h('i'), h('i'), h('i'));
  el.append(hud.nafta,
    h('div', { class: 'distancia' }, h('div', { class: 'mojonHUD' }, h('small', { text: 'RN 40' }), hud.metros, ' m'), hud.prog),
    h('div', { class: 'derecha' }, hud.monBox, h('button', { class: 'pare botonPare', onclick: (e) => { e.stopPropagation(); alternarPausa(); } }, h('span', { text: t('pausa') }))),
    h('div', { class: 'relojes' },
      h('div', { class: 'reloj' }, h('div', { class: 'marcas' }), h('div', { class: 'rojo' }), hud.agujaRpm, h('small', { text: 'RPM' })),
      h('div', { class: 'reloj' }, h('div', { class: 'marcas' }), hud.agujaVel, hud.vel, h('small', { text: 'KM/H' }))),
    hud.puesto, hud.anuncio, hud.sem);
  hud.el = el;
}
function mostrarHUD(si) {
  hud.el.classList.toggle('visible', si);
  if (!si || !viaje) return;
  hud.el.querySelector('.botonPare span').textContent = t('pausa');
  /* la barra de progreso: los mojones, el récord y los autos */
  hud.prog.innerHTML = '';
  const largo = viaje.meta;
  if (viaje.modo === 'viaje') {
    for (const m of viaje.R.mojones) hud.prog.append(UI.h('i', { style: { left: m.x / largo * 100 + '%' } }));
    if (viaje.record > 30) hud.prog.append(UI.h('i', { class: 'rec', style: { left: Math.min(100, viaje.record / largo * 100) + '%' } }));
  }
  hud.rivales = viaje.rivales.map(() => { const i = UI.h('i', { class: 'rival' }); hud.prog.append(i); return i; });
  hud.yo = UI.h('i', { class: 'yo' }); hud.prog.append(hud.yo);
  hud.nafta.classList.toggle('oculto', viaje.modo === 'picada');
  hud.puesto.classList.toggle('oculto', viaje.modo !== 'picada');
  hud.ult = {};
}
function actualizarHUD() {
  const v = viaje, A = v.yo, u = hud.ult;
  const m = Math.floor(v.metros);
  if (u.m !== m) { hud.metros.textContent = num(m); u.m = m; }
  if (u.mon !== v.monedas) { hud.monedas.textContent = num(v.monedas); u.mon = v.monedas; if (hud.suma) { hud.monBox.classList.remove('suma'); void hud.monBox.offsetWidth; hud.monBox.classList.add('suma'); hud.suma = false; } }
  const f = Math.max(0, A.nafta / A.tanque);
  hud.tanque.style.transform = `scaleX(${f.toFixed(3)})`;
  hud.nafta.classList.toggle('baja', f < 0.22 && v.modo === 'viaje');
  const rpm = Sonido.m ? Sonido.m.rpm : A.rpm, kmh = Math.abs(A.vx) * 3.6;
  hud.agujaRpm.style.transform = `translateX(-50%) rotate(${-120 + rpm * 240}deg)`;
  hud.agujaVel.style.transform = `translateX(-50%) rotate(${-120 + Math.min(1, kmh / 120) * 240}deg)`;
  const k = Math.round(kmh); if (u.k !== k) { hud.vel.textContent = k; u.k = k; }
  hud.yo.style.left = Math.min(100, v.metros / v.meta * 100) + '%';
  v.rivales.forEach((B, i) => { hud.rivales[i].style.left = Math.min(100, Math.max(0, B.x - 4) / v.meta * 100) + '%'; });
  if (v.modo === 'picada') {
    const delante = v.rivales.filter((B) => B.x > A.x || B.llego).length + 1;
    if (u.p !== delante) { hud.puesto.innerHTML = `${delante}º<small> / ${v.rivales.length + 1}</small>`; u.p = delante; }
  }
}
function anunciar(txt) { const a = hud.anuncio; a.textContent = txt; a.classList.remove('va'); void a.offsetWidth; a.classList.add('va'); }
function semaforo(n) {
  const s = hud.sem, luces = [...s.children];
  if (n < 0) { s.classList.add('oculto'); return; }
  s.classList.remove('oculto');
  luces.forEach((l, i) => { l.className = n >= 4 ? 'verde' : i < n ? 'rojo' : ''; });
}
function tutorial() {
  const el = document.getElementById('hud');
  const cartel = (txt, estilo, simbolo) => { const c = UI.h('div', { class: 'tutoCartel', style: estilo }, UI.h('div', { class: 'rombo' }, UI.h('span', { text: simbolo })), UI.h('p', { text: txt })); el.append(c); setTimeout(() => c.remove(), 6500); };
  if (esTactil()) {
    const pg = P.controles.pos.gas, pf = P.controles.pos.freno;
    cartel(t('tutoGas'), { left: `calc(${pg.x * 100}% - 130px)`, top: `calc(${pg.y * 100}% - 260px)` }, '→');
    cartel(t('tutoFreno'), { left: `calc(${pf.x * 100}% - 60px)`, top: `calc(${pf.y * 100}% - 260px)` }, '←');
  } else cartel(t('tutoTeclas'), { left: 'calc(50% - 130px)', top: '30%' }, '⇆');
  setTimeout(() => { if (viaje && !viaje.fin) cartel(t('tutoAire'), { left: 'calc(50% - 130px)', top: '26%' }, '↻'); }, 7000);
  setTimeout(() => { if (viaje && !viaje.fin) cartel(t('tutoCabeza'), { left: 'calc(50% - 130px)', top: '26%' }, '!'); }, 14000);
}

/* ------------------------------------------------------------------ el bucle */
let antes = performance.now();
function bucle(ahora) {
  const dt = Math.min(0.1, (ahora - antes) / 1000); antes = ahora;
  try {
    if (estado === 'viaje' && viaje) {
      if (!pausado) {
        const inp = viaje.fin ? { gas: 0, freno: 0 } : Controles.leer();
        viaje.avanzar(dt, inp, dib);
        const A = viaje.yo;
        Sonido.motor(A.rpm, inp.gas, A.patina, Math.hypot(A.vx, A.vy), A.tocaAlguna, viaje.R.T.viento, dt);
        actualizarHUD();
        if (viaje.fin && viaje.finT > 1.4 && !resultadoMostrado) terminarViaje();
      }
      dib.cuadro(viaje.estado, pausado ? 0 : dt);
    } else if (estado === 'resultado' && viaje) {
      viaje.avanzar(dt, { gas: 0, freno: 0 }, dib);
      dib.cuadro(viaje.estado, dt);
    } else if (fondoVivo && demo) {
      demo.avanzar(dt, demo.fin ? { gas: 0, freno: 0 } : demo.piloto(demo.yo, demo.R.S, dt), dib);
      /* el demo maneja con su piloto (que decide con el estado de cada cuadro, alcanza) */
      if (demo.fin && demo.finT > 2.5) arrancarDemo();
      dib.cuadro(demo.estado, dt);
    }
  } catch (err) { console.error(err); }
  requestAnimationFrame(bucle);
}

/* para las pruebas (pruebas/navegador.mjs) */
window.__r40 = { P, terminar: (c) => viaje && viaje.terminar(c), get viaje() { return viaje; }, get demo() { return demo; }, get estado() { return estado; }, empezar, irMapa, irGomeria, irMenu, alternarPausa, Sonido, dib };
arrancar();
