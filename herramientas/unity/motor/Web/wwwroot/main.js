// porteo: arranca .NET, trae los datos del juego y corre el bucle de cuadros.
// Los módulos van con import() y los datos por una "fuente" (datos.js): así el HTML único
// (empaquetar/empaquetar.py) da los suyos desde adentro, sin red.
const U = globalThis.porteoUnArchivo;
const modulo = (ruta) => (U ? U.url(ruta) : './' + ruta);
const { dotnet } = await import(modulo('_framework/dotnet.js'));
const { crearAudio } = await import(modulo('audio.js'));
const { crearFuentes } = await import(modulo('fuentes.js'));
const { crearControles } = await import(modulo('controles.js'));
const { crearFuenteRed } = await import(modulo('datos.js'));

const estado = document.getElementById('estado');
const lienzo = document.getElementById('lienzo');
const BASE = new URLSearchParams(location.search).get('datos') || 'datos/';
let escenaActual = '';   // la última que terminó de cargar (de lo que avisa el motor por la consola)

// el lienzo en píxeles del dispositivo (con tope: en teléfonos de mucha densidad no hace falta
// todo); ?escala=0.5 dibuja a menos resolución, fija. Si no, la mueve el sistema de velocidad
// (abajo, en cuadro)
const PARAMETROS = new URLSearchParams(location.search);
const ESCALA_FIJA = PARAMETROS.has('escala');
let escala = ESCALA_FIJA ? Math.min(Math.max(parseFloat(PARAMETROS.get('escala')) || 1, 0.1), 1) : 1;
function ajustar() {
  const r = Math.min(window.devicePixelRatio || 1, 2) * escala;
  lienzo.width = Math.max(1, Math.round(lienzo.clientWidth * r));
  lienzo.height = Math.max(1, Math.round(lienzo.clientHeight * r));
}
ajustar();
addEventListener('resize', ajustar);

const datos = U ? U.fuente : crearFuenteRed(BASE, estado);
const indice = await datos.indice();
// los .paq (árboles de objetos): todos a mano antes de empezar el juego; los recursos (texturas,
// mallas, audio, shaders), cuando el motor los pide. Se esperan recién antes de Iniciar: mientras
// llegan, arranca .NET (compilar el WebAssembly del juego lleva su rato)
const paquetes = datos.prepararPaquetes(Object.keys(indice.archivos));

// las partidas guardadas: un archivo por clave en IndexedDB (se cargan antes de arrancar)
const disco = await abrirDisco();
async function abrirDisco() {
  try {
    const db = await new Promise((ok, mal) => {
      const r = indexedDB.open('porteo-slime-rancher', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('archivos');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    const archivos = await new Promise((ok, mal) => {
      const t = db.transaction('archivos', 'readonly').objectStore('archivos');
      const l = [];
      const c = t.openCursor();
      c.onsuccess = () => { const x = c.result; if (!x) return ok(l); l.push([x.key, x.value]); x.continue(); };
      c.onerror = () => mal(c.error);
    });
    return { db, archivos };
  } catch (e) {
    console.warn('porteo: sin IndexedDB, las partidas no se guardan', e);
    return { db: null, archivos: [] };
  }
}
function discoEscribir(fn) {
  if (!disco.db) return;
  try {
    const t = disco.db.transaction('archivos', 'readwrite');
    fn(t.objectStore('archivos'));
  } catch (e) { console.warn('porteo: no se pudo guardar', e); }
}

let arranque = dotnet.withDiagnosticTracing(false);
// en el HTML único, el runtime y los ensamblados también salen de adentro
if (U) arranque = arranque.withResourceLoader(U.cargadorDotnet);
const { setModuleImports, getAssemblyExports, getConfig, runMain } = await arranque.create();
const TIPOS = ['error', 'assert', 'warn', 'log', 'exception'];
const audio = crearAudio(datos);
setModuleImports('porteo', {
  ...audio,
  ...crearFuentes(),
  tamanoPaquete: (n) => { const p = datos.paquete(n); return p ? p.length : -1; },
  copiarPaquete: (n, vista) => { vista.set(datos.paquete(n)); vista.dispose(); },
  hayRecurso: (id) => datos.hay(id),
  tamanoRecurso: (id) => { const r = datos.recurso(id); return r ? r.length : -1; },
  // lo mismo sin descomprimir acá (las texturas: ver Anfitrion.LeerRecursoListo)
  tamanoRecursoListo: (id) => { const r = datos.recursoListo ? datos.recursoListo(id) : datos.recurso(id); return r ? r.length : -1; },
  copiarRecurso: (id, vista) => { vista.set(datos.recurso(id)); vista.dispose(); datos.usado(id); },
  pedirRecurso: (id) => datos.pedir(id),
  discoGuardar: (ruta, vista) => { const b = vista.slice(); vista.dispose(); discoEscribir((s) => s.put(b, ruta)); },
  discoBorrar: (ruta) => discoEscribir((s) => s.delete(ruta)),
  consola: (t, tipo) => {
    // a la pantalla de carga del HTML (pantalla.js): cada escena que termina de cargar
    if (t.startsWith('porteo: escena ')) {
      escenaActual = t.slice(15, t.indexOf(' en '));
      if (globalThis.porteoCarga) porteoCarga.escena(escenaActual);
    }
    const k = TIPOS[tipo] || 'log';
    if (k === 'error' || k === 'exception' || k === 'assert') console.error(t);
    else if (k === 'warn') console.warn(t);
    else console.log(t);
  },
});
await runMain();
const exp = (await getAssemblyExports(getConfig().mainAssemblyName)).Programa;
await paquetes;
// para probar desde afuera (la consola del navegador o las pruebas automáticas)
globalThis.porteo = exp;
estado.textContent = '';
if (globalThis.porteoCarga) porteoCarga.motor();
const movil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
for (const [ruta, datos] of disco.archivos) exp.PonerArchivo(ruta, Array.from(datos));
// los datos llegan de a poco por la red (el sitio, o datos/ al lado de la página): las escenas no
// esperan el sonido (suena cuando llega) y, mientras la pantalla de carga tapa el juego, tampoco
// las texturas: el menú se arma con lo mínimo y la pantalla se queda hasta que llegó lo que se ve
// (pantalla.js). Después, cada escena espera sus texturas (ver Programa.Diferir)
const deARatos = U ? !!U.web : true;
const conPantalla = !!globalThis.porteoCarga;
exp.Diferir(deARatos, deARatos && conPantalla);
if (deARatos && conPantalla) porteoCarga.alListo(() => exp.Diferir(true, false));
exp.Iniciar(indice.escenas, 0, 96 * (window.devicePixelRatio || 1), movil);
// al irse de la página (o pasarla a segundo plano) se manda lo último que se guardó
addEventListener('pagehide', () => exp.GuardarPartida());
document.addEventListener('visibilitychange', () => { if (document.hidden) exp.GuardarPartida(); });
// ?perfil: cuánto tarda la GPU en cada dibujo (lento: espera a la GPU después de cada uno)
if (new URLSearchParams(location.search).has('perfil')) exp.PerfilGpu(true);
// ?apagar=sin3d,sinui...: partes del dibujo apagadas, para aislar problemas
for (const x of (new URLSearchParams(location.search).get('apagar') || '').split(',')) if (x) exp.Apagar(x);
for (const x of (new URLSearchParams(location.search).get('ocultar') || '').split(',')) if (x) exp.Ocultar(x);
for (const x of (new URLSearchParams(location.search).get('sinshader') || '').split(',')) if (x) exp.OcultarShader(x);
// ?verfs=SR/Slime/Body|normalize(vs_TEXCOORD3)*0.5+0.5: la salida de ese shader reemplazada (depurar)
if (new URLSearchParams(location.search).has('verfs')) { const [s, e] = new URLSearchParams(location.search).get('verfs').split('|'); exp.VerFs(s, e); }
// ?desarrollo: como una versión de desarrollo de Unity (el juego muestra sus avisos en la consola)
if (new URLSearchParams(location.search).has('desarrollo')) exp.Desarrollo(true);
// ?variantes=Standard: qué variante se elige para cada combinación de palabras clave
if (new URLSearchParams(location.search).has('variantes')) exp.VerVariantes(new URLSearchParams(location.search).get('variantes'));
// ?uniformes=SR/Slime/Body: qué valores recibe ese shader (en la consola)
if (new URLSearchParams(location.search).has('uniformes')) exp.VolcarUniformes(new URLSearchParams(location.search).get('uniformes'));
// ?camara=x,y,z,yaw,pitch: la cámara principal fija ahí (para mirar algo de cerca)
if (new URLSearchParams(location.search).has('camara')) {
  const c = new URLSearchParams(location.search).get('camara').split(',').map(Number);
  exp.FijarCamara(c[0] || 0, c[1] || 0, c[2] || 0, c[3] || 0, c[4] || 0);
}
// ?diag=jerarquia:FPSCamera;cerca:6&diagen=30: diagnósticos en la consola (cuadros después del adelanto)
if (new URLSearchParams(location.search).has('diag'))
  exp.DiagnosticoLuego(new URLSearchParams(location.search).get('diag'), parseInt(new URLSearchParams(location.search).get('diagen')) || 30);
// ?ir=x,y,z (o x,z: a la altura del rancho) o ?ir=nombre de un destino de teletransporte: el
// jugador aparece ahí al terminar el adelanto (para mirar otras zonas)
if (new URLSearchParams(location.search).has('ir')) {
  const ir = new URLSearchParams(location.search).get('ir');
  const c = ir.split(',').map(Number);
  if (c.some(isNaN)) exp.IrADestino(ir);
  else if (c.length >= 3) exp.IrA(c[0], c[1], c[2]);
  else exp.IrA(c[0] || 0, 30, c[1] || 0);
}
// ?nueva: una partida nueva apenas aparece el menú (capturas del juego)
if (new URLSearchParams(location.search).has('nueva')) exp.NuevaPartida();
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

const controles = crearControles(exp, lienzo);

// ── el sistema de velocidad ──
// Si el teléfono no da abasto (menos de 24 cuadros por segundo durante 3 segundos), se dibuja a
// menos resolución, de a pasos y hasta la mitad; si sobra (más de 50), vuelve a subir. Si bajar no
// sirvió (lo que pesa es la CPU, no el dibujo), vuelve a como estaba y no insiste por un minuto.
// No mide mientras la pantalla de carga tapa el juego ni cuando hubo un cuadro de más de un
// segundo (una carga: eso es un tirón, no lentitud). ?escala=X la deja fija; ?turbo=0 lo apaga.
const TURBO = !ESCALA_FIJA && PARAMETROS.get('turbo') !== '0';
const vel = { cuadros: 0, desde: 0, tiron: false, espera: 0, probando: false, fpsAntes: 0, escalaAntes: 1, inutil: 0 };
function cambiarEscala(nueva, fps) {
  escala = nueva;
  ajustar();
  vel.espera = 1;   // la ventana siguiente todavía mezcla las dos resoluciones
  console.log(`porteo: velocidad: resolución al ${Math.round(escala * 100)}% (${fps.toFixed(0)} cuadros/s)`);
}
function velocidad(ahora, dt) {
  if (!TURBO) return;
  if (!vel.desde || document.hidden || (globalThis.porteoCarga && porteoCarga.tapado())) { vel.cuadros = 0; vel.desde = ahora; return; }
  if (dt > 1) vel.tiron = true;
  vel.cuadros++;
  if (ahora - vel.desde < 3000) return;
  const fps = vel.cuadros * 1000 / (ahora - vel.desde), tiron = vel.tiron;
  vel.cuadros = 0; vel.desde = ahora; vel.tiron = false;
  if (tiron) return;
  if (vel.espera > 0) { vel.espera--; return; }
  if (vel.probando) {
    vel.probando = false;
    if (fps < vel.fpsAntes * 1.15) { cambiarEscala(vel.escalaAntes, fps); vel.inutil = 20; return; }
  }
  if (vel.inutil > 0) { vel.inutil--; return; }
  if (fps < 24 && escala > 0.5) {
    vel.probando = true; vel.fpsAntes = fps; vel.escalaAntes = escala;
    cambiarEscala(Math.max(0.5, Math.round((escala - 0.15) * 100) / 100), fps);
  } else if (fps > 50 && escala < 1) {
    cambiarEscala(Math.min(1, Math.round((escala + 0.1) * 100) / 100), fps);
  }
}

// la primera escena (en Slime Rancher, el logo de la empresa: fundidos con tiempos fijos) corre a
// toda velocidad mientras la pantalla de carga la tapa, un segundo de juego sin dibujar por
// cuadro: nadie la ve y el menú llega unos 6 s antes. ?sinacelerar la deja como es
const PRIMERA = (indice.escenas[0] || '').replace(/^.*\//, '').replace(/\.unity$/, '');
const ACELERAR = !PARAMETROS.has('sinacelerar');

let antes = performance.now();
const medir = new URLSearchParams(location.search).has('perfil');
let nCuadros = 0, enCuadro = 0, desdeMedida = antes;
function cuadro(ahora) {
  const real = (ahora - antes) / 1000;
  const dt = Math.min(real, 0.25);
  antes = ahora;
  if (ACELERAR && escenaActual === PRIMERA && globalThis.porteoCarga && porteoCarga.tapado()) exp.Acelerar(1);
  velocidad(ahora, real);
  const t0 = performance.now();
  controles.cuadro(ahora);
  exp.Cuadro(dt);
  // los cuadros dibujados: la pantalla de carga espera unos con el menú antes de irse (pantalla.js)
  globalThis.porteoCuadros = (globalThis.porteoCuadros || 0) + 1;
  if (medir) {
    enCuadro += performance.now() - t0;
    nCuadros++;
    if (ahora - desdeMedida > 5000) {
      console.log(`porteo js: ${(nCuadros * 1000 / (ahora - desdeMedida)).toFixed(1)} rAF/s, ${(enCuadro / nCuadros).toFixed(1)} ms en Cuadro${datos.resumen ? ', ' + datos.resumen() : ''}`);
      nCuadros = 0; enCuadro = 0; desdeMedida = ahora;
    }
  }
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);
