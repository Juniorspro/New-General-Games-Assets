// porteo: arranca .NET, trae los datos del juego y corre el bucle de cuadros.
import { dotnet } from './_framework/dotnet.js';

const estado = document.getElementById('estado');
const lienzo = document.getElementById('lienzo');
const BASE = new URLSearchParams(location.search).get('datos') || 'datos/';

// el lienzo en píxeles del dispositivo (con tope: en teléfonos de mucha densidad no hace falta
// todo); ?escala=0.5 dibuja a menos resolución
const ESCALA = Math.min(Math.max(parseFloat(new URLSearchParams(location.search).get('escala')) || 1, 0.1), 1);
function ajustar() {
  const r = Math.min(window.devicePixelRatio || 1, 2) * ESCALA;
  lienzo.width = Math.max(1, Math.round(lienzo.clientWidth * r));
  lienzo.height = Math.max(1, Math.round(lienzo.clientHeight * r));
}
ajustar();
addEventListener('resize', ajustar);

const indice = await (await fetch(BASE + 'indice.json')).json();

// los .paq (árboles de objetos): todos antes de empezar
const paquetes = new Map();
let listos = 0;
const nombres = Object.keys(indice.archivos);
await Promise.all(nombres.map(async (n) => {
  const r = await fetch(BASE + 'paquetes/' + encodeURIComponent(n) + '.paq');
  if (r.ok) paquetes.set(n, new Uint8Array(await r.arrayBuffer()));
  estado.textContent = `datos ${++listos}/${nombres.length}`;
}));

// los recursos (texturas, mallas, audio, shaders): cuando el motor los pide, de a varios a la
// vez (al cargar una escena pide cientos de una)
const recursos = new Map();
const pedidos = new Set();
const cola = [];
let enVuelo = 0;
const SIMULTANEOS = 8;
function pedir(id) {
  if (recursos.has(id) || pedidos.has(id)) return;
  pedidos.add(id);
  cola.push(id);
  seguir();
}
function seguir() {
  while (enVuelo < SIMULTANEOS && cola.length) {
    const id = cola.shift();
    enVuelo++;
    fetch(BASE + 'recursos/' + id + '.bin')
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((b) => { recursos.set(id, new Uint8Array(b)); })
      .catch((e) => console.warn('porteo: recurso ' + id, e))
      .finally(() => { pedidos.delete(id); enVuelo--; seguir(); });
  }
}

const { setModuleImports, getAssemblyExports, getConfig, runMain } = await dotnet.withDiagnosticTracing(false).create();
const TIPOS = ['error', 'assert', 'warn', 'log', 'exception'];
setModuleImports('porteo', {
  tamanoPaquete: (n) => { const p = paquetes.get(n); return p ? p.length : -1; },
  copiarPaquete: (n, vista) => { vista.set(paquetes.get(n)); vista.dispose(); },
  tamanoRecurso: (id) => { const r = recursos.get(id); return r ? r.length : -1; },
  copiarRecurso: (id, vista) => { vista.set(recursos.get(id)); vista.dispose(); },
  pedirRecurso: pedir,
  consola: (t, tipo) => {
    const k = TIPOS[tipo] || 'log';
    if (k === 'error' || k === 'exception' || k === 'assert') console.error(t);
    else if (k === 'warn') console.warn(t);
    else console.log(t);
  },
});
await runMain();
const exp = (await getAssemblyExports(getConfig().mainAssemblyName)).Programa;
estado.textContent = '';
const movil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
exp.Iniciar(indice.escenas, 0, 96 * (window.devicePixelRatio || 1), movil);
// ?perfil: cuánto tarda la GPU en cada dibujo (lento: espera a la GPU después de cada uno)
if (new URLSearchParams(location.search).has('perfil')) exp.PerfilGpu(true);
// ?apagar=sin3d,sinui...: partes del dibujo apagadas, para aislar problemas
for (const x of (new URLSearchParams(location.search).get('apagar') || '').split(',')) if (x) exp.Apagar(x);
for (const x of (new URLSearchParams(location.search).get('ocultar') || '').split(',')) if (x) exp.Ocultar(x);
// ?adelantar=N[&escena=X]: N segundos de juego sin dibujar al llegar a la escena (capturas de prueba)
if (new URLSearchParams(location.search).has('adelantar'))
  exp.Adelantar(parseFloat(new URLSearchParams(location.search).get('adelantar')) || 0, new URLSearchParams(location.search).get('escena') || 'MainMenu');

// ── entrada ──
// Las coordenadas van en píxeles del lienzo con el origen abajo a la izquierda (como
// Input.mousePosition) y las teclas como KeyCode de Unity.
function punto(e) {
  const r = lienzo.getBoundingClientRect();
  return [(e.clientX - r.left) * lienzo.width / r.width, lienzo.height - (e.clientY - r.top) * lienzo.height / r.height];
}

// los dedos de Unity son números chicos que se reusan; los pointerId del navegador no
const dedos = new Map();
function dedoLibre() {
  const usados = new Set(dedos.values());
  let d = 0;
  while (usados.has(d)) d++;
  return d;
}

// botones del DOM (0 izq, 1 medio, 2 der) → los de Unity (0 izq, 1 der, 2 medio)
const BOTON = [0, 2, 1, 3, 4];

lienzo.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { lienzo.setPointerCapture(e.pointerId); } catch {}
  const [x, y] = punto(e);
  if (e.pointerType === 'touch') {
    const d = dedoLibre();
    dedos.set(e.pointerId, d);
    exp.Toque(d, 0, x, y);
  } else {
    exp.Raton(x, y);
    exp.BotonRaton(BOTON[e.button] ?? e.button, true);
  }
});
lienzo.addEventListener('pointermove', (e) => {
  const [x, y] = punto(e);
  if (e.pointerType === 'touch') {
    const d = dedos.get(e.pointerId);
    if (d !== undefined) exp.Toque(d, 1, x, y);
  } else exp.Raton(x, y);
});
function soltar(e, fase) {
  const [x, y] = punto(e);
  if (e.pointerType === 'touch') {
    const d = dedos.get(e.pointerId);
    if (d === undefined) return;
    dedos.delete(e.pointerId);
    exp.Toque(d, fase, x, y);
  } else if (fase === 3) {
    exp.Raton(x, y);
    exp.BotonRaton(BOTON[e.button] ?? e.button, false);
  }
}
lienzo.addEventListener('pointerup', (e) => soltar(e, 3));
lienzo.addEventListener('pointercancel', (e) => soltar(e, 4));
lienzo.addEventListener('contextmenu', (e) => e.preventDefault());
lienzo.addEventListener('wheel', (e) => {
  e.preventDefault();
  // una muesca de la rueda es 1 en Unity (el navegador da ~100 píxeles o 3 líneas)
  const k = e.deltaMode === 1 ? 3 : e.deltaMode === 2 ? 0.01 : 100;
  exp.Rueda(-e.deltaX / k, -e.deltaY / k);
}, { passive: false });

// KeyboardEvent.code → KeyCode de Unity
const TECLAS = {
  Backspace: 8, Tab: 9, Enter: 13, Pause: 19, Escape: 27, Space: 32, Delete: 127,
  Quote: 39, Comma: 44, Minus: 45, Period: 46, Slash: 47, Semicolon: 59, Equal: 61,
  BracketLeft: 91, Backslash: 92, BracketRight: 93, Backquote: 96,
  NumpadDecimal: 266, NumpadDivide: 267, NumpadMultiply: 268, NumpadSubtract: 269, NumpadAdd: 270, NumpadEnter: 271, NumpadEqual: 272,
  ArrowUp: 273, ArrowDown: 274, ArrowRight: 275, ArrowLeft: 276, Insert: 277, Home: 278, End: 279, PageUp: 280, PageDown: 281,
  NumLock: 300, CapsLock: 301, ScrollLock: 302, ShiftRight: 303, ShiftLeft: 304, ControlRight: 305, ControlLeft: 306,
  AltRight: 307, AltLeft: 308, MetaRight: 309, MetaLeft: 310, PrintScreen: 316, ContextMenu: 319,
};
function tecla(code) {
  if (code in TECLAS) return TECLAS[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return 97 + m[1].charCodeAt(0) - 65;
  m = /^Digit(\d)$/.exec(code);
  if (m) return 48 + +m[1];
  m = /^Numpad(\d)$/.exec(code);
  if (m) return 256 + +m[1];
  m = /^F(\d+)$/.exec(code);
  if (m && +m[1] >= 1 && +m[1] <= 15) return 281 + +m[1];
  return 0;
}
// las que el navegador usa para moverse por la página
const PROPIAS = new Set([8, 9, 32, 273, 274, 275, 276, 278, 279, 280, 281]);
const abajo = new Set();
addEventListener('keydown', (e) => {
  const k = tecla(e.code);
  if (k && PROPIAS.has(k) && !e.ctrlKey && !e.metaKey) e.preventDefault();
  if (k && !e.repeat) { abajo.add(k); exp.Tecla(k, true); }
  // Input.inputString: los caracteres, "\b" al borrar y "\n" con Enter
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) exp.Texto(e.key);
  else if (e.key === 'Backspace') exp.Texto('\b');
  else if (e.key === 'Enter') exp.Texto('\n');
});
addEventListener('keyup', (e) => {
  const k = tecla(e.code);
  if (k) { abajo.delete(k); exp.Tecla(k, false); }
});
// al perder el foco no llegan los keyup: se sueltan todas
addEventListener('blur', () => {
  for (const k of abajo) exp.Tecla(k, false);
  abajo.clear();
});

let antes = performance.now();
const medir = new URLSearchParams(location.search).has('perfil');
let nCuadros = 0, enCuadro = 0, desdeMedida = antes;
function cuadro(ahora) {
  const dt = Math.min((ahora - antes) / 1000, 0.25);
  antes = ahora;
  const t0 = performance.now();
  exp.Cuadro(dt);
  if (medir) {
    enCuadro += performance.now() - t0;
    nCuadros++;
    if (ahora - desdeMedida > 5000) {
      console.log(`porteo js: ${(nCuadros * 1000 / (ahora - desdeMedida)).toFixed(1)} rAF/s, ${(enCuadro / nCuadros).toFixed(1)} ms en Cuadro, ${enVuelo} recursos en vuelo, ${cola.length} en cola, ${recursos.size} llegados`);
      nCuadros = 0; enCuadro = 0; desdeMedida = ahora;
    }
  }
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);
