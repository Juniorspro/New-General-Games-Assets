// Arranque: la pantalla, la entrada, el sonido, lo guardado, las escenas y
// el bucle. La simulación va a 60 pasos fijos por segundo (máximo 4 por
// cuadro: si el teléfono se traba, el juego se frena en vez de saltar) y se
// dibuja una vez por cuadro.
//
// Para probar: ?directo=nivel:4 (o torre, mapa, tienda, ajustes) entra
// directo; ?pausa no avanza solo (se avanza con __C.pasos); ?limpio arranca
// sin lo guardado; ?idioma=en fuerza el idioma. Con ?directo o ?pausa no hay
// intro (salvo que se pida con ?intro); ?sinintro la saca siempre.
import { crearPantalla } from './pantalla.js';
import { crearEntrada } from './entrada.js';
import { crearSonido } from './sonido.js';
import { crearIdioma } from './idioma.js';
import { cargar, guardar, borrar, base } from './guardado.js';
import { Portada, Mapa, Juego, Tienda, Ajustes } from './pantallas.js';
import { Espera } from './intro.js';
import { iris } from './ui.js';
import { NIVELES } from './niveles.js';
import { leer } from './reglas.js';
import { resolver } from './resolver.js';
import { salida, salidaAtras, clamp } from './util.js';

const PASO = 1 / 60;
const CIERRA = 0.28, ABRE = 0.34;
const lienzo = document.getElementById('juego');
const pantalla = crearPantalla(lienzo);
const entrada = crearEntrada(lienzo, pantalla);
const q = new URLSearchParams(location.search);
let datos = q.has('limpio') ? base() : cargar();
if (['es', 'en', 'pt'].includes(q.get('idioma'))) datos.ajustes.idioma = q.get('idioma');
const tr = crearIdioma(datos.ajustes.idioma);
document.documentElement.lang = tr.actual();
const sonido = crearSonido(datos.ajustes);

// El audio solo arranca dentro de un evento del usuario (no desde el bucle).
const despertar = () => sonido.despertar();
window.addEventListener('pointerdown', despertar, { capture: true });
window.addEventListener('keydown', despertar, { capture: true });

const app = {
  pantalla, entrada, sonido, tr,
  get datos() { return datos; },
  get W() { return pantalla.W; },
  get H() { return pantalla.H; },
  get cambio() { return pantalla.cambio; },
  escena: null,
  transicion: null,
  guardar: () => guardar(datos),
  vibrar: (patron) => {
    // antes del primer toque el navegador no deja (y lo avisa en la consola)
    if (!datos.ajustes.vibrar || !navigator.vibrate || navigator.userActivation?.hasBeenActive === false) return;
    try { navigator.vibrate(patron); } catch { /* hay navegadores que no dejan */ }
  },
  // Borra el progreso pero no los ajustes (idioma, sonido): eso es del teléfono.
  borrarTodo: () => { const nuevo = borrar(); nuevo.ajustes = datos.ajustes; datos = nuevo; guardar(datos); },
  // Cambiar de escena con un iris que se cierra sobre lo tocado.
  ir(fabrica, desde = null) {
    if (app.transicion) return;
    const x = desde ? desde.x + (desde.w || 0) / 2 : pantalla.W / 2, y = desde ? desde.y + (desde.h || 0) / 2 : pantalla.H / 2;
    app.transicion = { fase: 'cierra', t: 0, x, y, fabrica };
  },
};

function pasarTransicion(dt) {
  const tr_ = app.transicion;
  if (!tr_) return;
  tr_.t += dt;
  if (tr_.fase === 'cierra' && tr_.t >= CIERRA) {
    app.escena = tr_.fabrica();
    tr_.fase = 'abre'; tr_.t = 0;
    // se abre sobre Lu si la escena nueva es una partida
    const p = app.escena.partida;
    if (p) { p.medir(pantalla.W, pantalla.H); const [x, y] = p.centroLu(); tr_.x = x - Math.round(p.camX); tr_.y = y - Math.round(p.camY); }
    else { tr_.x = pantalla.W / 2; tr_.y = pantalla.H / 2; }
  } else if (tr_.fase === 'abre' && tr_.t >= ABRE) app.transicion = null;
}

function dibujarTransicion(g, W, H) {
  const tr_ = app.transicion;
  if (!tr_) return;
  const R = Math.hypot(W, H);
  const r = tr_.fase === 'cierra' ? (1 - salida(clamp(tr_.t / CIERRA, 0, 1))) * R : salidaAtras(clamp(tr_.t / ABRE, 0, 1)) * R;
  iris(g, W, H, tr_.x, tr_.y, Math.max(0, r));
}

function paso() {
  // mientras corre el iris no se toca nada
  if (app.transicion) entrada.vaciar();
  app.escena.pasar(PASO);
  pasarTransicion(PASO);
  entrada.vaciar();
}

function dibujar() {
  const g = pantalla.g, W = pantalla.W, H = pantalla.H;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  app.escena.dibujar(g, W, H);
  dibujarTransicion(g, W, H);
  pantalla.presentar();
}

// la escena de entrada
function escenaDirecta() {
  const d = q.get('directo') || '';
  if (d.startsWith('nivel:')) return new Juego(app, { indice: clamp(+d.slice(6) || 0, 0, NIVELES.length - 1) });
  if (d === 'torre') return new Juego(app, { torre: true });
  if (d === 'mapa') return new Mapa(app);
  if (d === 'tienda') return new Tienda(app);
  if (d === 'ajustes') return new Ajustes(app);
  return new Portada(app);
}
// Primero la intro de JXSTUDIOS, que arranca sola (intro.js › Espera).
const conIntro = q.has('intro') || !(q.has('directo') || q.has('pausa') || q.has('sinintro'));
app.escena = conIntro ? new Espera(app, escenaDirecta) : escenaDirecta();

// si la pestaña se esconde: pausa y silencio
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { app.escena?.pausar?.(); sonido.lava(0); }
});

let acumulado = 0, ultimo = performance.now(), cuadros = 0;
const manual = q.has('pausa');
function cuadro(ahora) {
  requestAnimationFrame(cuadro);
  if (++cuadros % 15 === 0) pantalla.medir();
  const dt = Math.min(0.1, (ahora - ultimo) / 1000);
  ultimo = ahora;
  if (!manual) {
    acumulado += dt;
    let n = 0;
    while (acumulado >= PASO && n < 4) { paso(); acumulado -= PASO; n++; }
    if (n === 4) acumulado = 0;
  }
  dibujar();
}
requestAnimationFrame(cuadro);

// Sondas para las pruebas (ver pruebas/juego.mjs).
window.__C = {
  app,
  get escena() { return app.escena.nombre; },
  get partida() { return app.escena.partida || null; },
  get datos() { return datos; },
  pasos(n, dib = false) { for (let k = 0; k < n; k++) paso(); if (dib) dibujar(); },
  dibujar,
  deslizar(dx, dy) { entrada.cola.push({ tipo: 'deslizar', dx, dy }); },
  tocar(x, y) { entrada.cola.push({ tipo: 'bajar', x, y }, { tipo: 'soltar', x, y }, { tipo: 'tocar', x, y }); },
  tecla(tipo, dx = 0, dy = 0) { entrada.cola.push({ tipo, dx, dy, tecla: 'prueba' }); },
  boton(id) {
    const b = [app.escena.botones, app.escena.capa?.botones].filter(Boolean).flatMap((bs) => bs.botones).find((b) => b.id === id || b.texto === id);
    if (!b) return false;
    const x = b.x + b.w / 2, y = b.y + b.h / 2;
    this.tocar(x, y);
    return true;
  },
  botones() { return [app.escena.botones, app.escena.capa?.botones].filter(Boolean).flatMap((bs) => bs.botones).map((b) => b.id || b.texto); },
  camino(i) { return resolver(leer(NIVELES[i])).camino; },
  niveles: NIVELES.length,
};
window.listo = true;
