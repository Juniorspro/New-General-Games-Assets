// El sonido: grabaciones para los efectos, osciladores de respaldo y el atlas
// de voces.
//
// LAS GRABACIONES VIENEN EN BASE64 ADENTRO DE js/sonidos.js (lo genera
// sonidos/incrustar.py desde sonidos/dimension-n/): el archivo único se abre
// desde file:// y ahí `fetch` no lee nada. Se decodifican una vez, cuando se
// crea el contexto, y hasta que terminan —o si alguna falta— suena lo
// sintetizado de siempre: un golpe es ruido filtrado con una envolvente de
// sesenta milisegundos. El juego nunca queda mudo esperando un archivo.
//
// EL CONTEXTO NO SE CREA AL ARRANCAR. Los navegadores no dejan sonar nada
// hasta que hubo un gesto del usuario, y un AudioContext creado antes queda
// "suspended" para siempre aunque despues se toque la pantalla. Se crea en el
// primer toque y recien ahi.
//
// TRES BUSES: efectos, música (el zumbido) y voces, cada uno con su volumen.
// Son tres molestias distintas: la música cansa a la décima bajada, un golpe es
// información y una voz en castellano puede sobrar a quien juega en inglés.

let ac = null, maestro = null, busEf = null, busMus = null, busVoz = null;
let prendido = true;
const vol = { efectos: 0.8, musica: 0.6, voces: true };
const buf = {}, grupos = {};

// Las grabaciones, leídas del script clásico. Un `const` de un script clásico
// no cuelga de window pero sí se ve por nombre desde un módulo; el `typeof`
// evita el ReferenceError cuando no está (las pruebas en Node, o sin el archivo).
const crudas = () => globalThis.SONIDOS_B64
  || (typeof SONIDOS_B64 !== "undefined" ? SONIDOS_B64 : null);
export const creditosSonidos = () => globalThis.SONIDOS_CREDITOS
  || (typeof SONIDOS_CREDITOS !== "undefined" ? SONIDOS_CREDITOS : []);

export function despertar() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  maestro = ac.createGain();
  maestro.gain.value = prendido ? 0.5 : 0;
  // Un compresor suave al final: once puntos del ragdoll pegando a la vez más
  // el reactor más una voz saturaban la salida en el teléfono.
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  maestro.connect(comp); comp.connect(ac.destination);
  busEf = ac.createGain(); busEf.connect(maestro);
  busMus = ac.createGain(); busMus.connect(maestro);
  busVoz = ac.createGain(); busVoz.connect(maestro);
  aplicarVolumenes();
  decodificar();
  return ac;
}

function decodificar() {
  const datos = crudas();
  if (!datos) return;
  for (const [id, b64] of Object.entries(datos)) {
    let bytes;
    try {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } catch (e) { continue; }
    const listo = (b) => {
      if (!b) return;
      buf[id] = b;
      const g = id.replace(/_\d+$/, "");
      (grupos[g] = grupos[g] || []).push(b);
    };
    try {
      const p = ac.decodeAudioData(bytes.buffer, listo, () => {});
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* una grabación rota no puede tirar abajo las otras */ }
  }
}

/** Cuántas grabaciones ya están decodificadas (lo mira la prueba). */
export const decodificadas = () => Object.keys(buf).length;

function aplicarVolumenes() {
  if (!ac) return;
  const t = ac.currentTime;
  busEf.gain.setTargetAtTime(vol.efectos, t, 0.03);
  busMus.gain.setTargetAtTime(vol.musica, t, 0.03);
  busVoz.gain.setTargetAtTime(vol.voces ? Math.max(0.35, vol.efectos) : 0, t, 0.03);
}

export function volumenes(v) { Object.assign(vol, v); aplicarVolumenes(); }

export const sonando = (v) => { prendido = v; if (maestro) maestro.gain.value = v ? 0.5 : 0; };

/**
 * Una grabación suelta. `id` puede ser un grupo ("golpe" → golpe_1..3): se elige
 * una al azar y con la velocidad corrida un poco, porque el mismo golpe diez
 * veces seguidas suena a máquina y no a un cuerpo que rebota.
 * Devuelve false si no hay grabación, para que el que llama use el respaldo.
 */
export function muestra(id, { vol: v = 0.6, rate = 1, azar = 0.06 } = {}) {
  if (!ac || !prendido) return false;
  const b = buf[id] || (grupos[id] && grupos[id][Math.floor(Math.random() * grupos[id].length)]);
  if (!b) return false;
  const s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = b;
  s.playbackRate.value = rate * (1 - azar + Math.random() * azar * 2);
  g.gain.value = v;
  s.connect(g); g.connect(busEf);
  s.start();
  return true;
}

function env(nodo, a, d, pico, bus = busEf) {
  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  nodo.connect(g); g.connect(bus);
  return { g, t, fin: t + a + d };
}

function ruido(dur) {
  const n = Math.floor(ac.sampleRate * dur);
  const b = ac.createBuffer(1, n, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(); s.buffer = b;
  return s;
}

function tono(tipo, f0, f1, a, d, pico) {
  if (!ac || !prendido) return;
  const o = ac.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, ac.currentTime);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + a + d);
  const e = env(o, a, d, pico);
  o.start(); o.stop(e.fin + 0.02);
}

// Un tope de golpes por cuadro: un ragdoll que cae de costado toca once puntos
// a la vez y once ruidos juntos no suenan a golpe, suenan a distorsion.
let ultimoGolpe = 0;

export const efe = {
  golpe(fuerza) {
    if (!ac || !prendido) return;
    const ahora = ac.currentTime;
    if (ahora - ultimoGolpe < 0.06) return;
    ultimoGolpe = ahora;
    // Cuanto más fuerte, más grave y más alto: un cuerpo que viene rápido no
    // hace el mismo "toc" que uno que se apoya.
    const k = Math.min(1, fuerza / 22);
    if (muestra(fuerza > 16 ? "golpe_fuerte" : "golpe", { vol: 0.25 + k * 0.55, rate: 1.1 - k * 0.25 })) return;
    const s = ruido(0.09);
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 260 + Math.min(1, fuerza / 16) * 1400;
    s.connect(f);
    const e = env(f, 0.004, 0.08, Math.min(0.5, 0.1 + fuerza * 0.02));
    s.start(); s.stop(e.fin + 0.02);
  },
  pincho() { if (!muestra("pincho", { vol: 0.55 })) tono("square", 620, 90, 0.005, 0.22, 0.22); },
  resorte() { if (!muestra("resorte", { vol: 0.5 })) tono("triangle", 220, 760, 0.01, 0.16, 0.22); },
  placa() { if (!muestra("placa", { vol: 0.55 })) tono("triangle", 220, 760, 0.01, 0.16, 0.22); },
  chatarra() { if (!muestra("chatarra", { vol: 0.5, rate: 1.15 })) tono("square", 880, 1320, 0.005, 0.1, 0.13); },
  disparo() { muestra("disparo", { vol: 0.35 }); },
  portal() {
    if (muestra("portal", { vol: 0.6 })) return;
    tono("sawtooth", 140, 900, 0.02, 0.5, 0.18);
    tono("sine", 320, 1400, 0.03, 0.55, 0.12);
  },
  roto() { if (!muestra("roto", { vol: 0.6, azar: 0 })) tono("sawtooth", 300, 45, 0.01, 0.8, 0.28); },
  gano() {
    if (muestra("gano", { vol: 0.6, azar: 0 })) return;
    [0, 0.12, 0.24, 0.42].forEach((d, i) => setTimeout(() =>
      tono("triangle", [392, 523, 659, 784][i], [392, 523, 659, 784][i], 0.01, 0.35, 0.2), d * 1000));
  },
  menu() { if (!muestra("ui_clic", { vol: 0.45 })) tono("square", 520, 700, 0.005, 0.07, 0.1); },
};

// --- los dos loops del cuerpo en el aire ---------------------------------
//
// EL REACTOR Y EL VIENTO NO SON EFECTOS SUELTOS, SON ESTADOS: suenan mientras
// dura lo que los provoca. Se arrancan una vez, en loop y en silencio, y cada
// cuadro sólo se mueve su volumen; arrancar y parar una fuente por cuadro deja
// un clic en cada corte. `AudioBufferSource.loop` empalma sin hueco (un
// `<audio loop>` deja uno).
let lazos = null;
function armarLazos() {
  if (lazos || !buf.reactor || !buf.viento) return lazos;
  const uno = (b) => {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = b; s.loop = true; g.gain.value = 0;
    s.connect(g); g.connect(busEf);
    s.start(0, Math.random() * b.duration);
    return { s, g };
  };
  lazos = { reactor: uno(buf.reactor), viento: uno(buf.viento) };
  return lazos;
}

/** `empuje` y `caida` van de 0 a 1. Se llama cada cuadro; con ceros, calla. */
export function aire(empuje, caida) {
  if (!ac || !armarLazos()) return;
  const t = ac.currentTime, on = prendido ? 1 : 0;
  lazos.reactor.g.gain.setTargetAtTime(on * empuje * 0.32, t, 0.05);
  lazos.reactor.s.playbackRate.setTargetAtTime(0.85 + empuje * 0.3, t, 0.1);
  lazos.viento.g.gain.setTargetAtTime(on * caida * caida * 0.5, t, 0.2);
  lazos.viento.s.playbackRate.setTargetAtTime(0.8 + caida * 0.45, t, 0.3);
}

// --- las voces -----------------------------------------------------------
//
// UN SOLO MP3 CON TODAS LAS LINEAS PEGADAS, y un indice que dice donde empieza
// y cuanto dura cada una. Veintitres archivos sueltos serian veintitres
// pedidos de red, veintitres decodificaciones y —en el archivo unico—
// veintitres bloques de base64. Asi es un pedido, un decode, y reproducir una
// linea es `start(0, desde, largo)`.
//
// Se decodifica una sola vez y se guarda el AudioBuffer: un <audio> por linea
// tambien funcionaria, pero no se puede pedir "de tal segundo a tal otro" con
// precision, y en el telefono cada elemento nuevo cuesta.
let vozBuf = null, vozIndice = null, vozAhora = null;

export async function cargarVoces(url, indice) {
  if (!indice) return;
  vozIndice = indice;
  try {
    const r = await fetch(url);
    const datos = await r.arrayBuffer();
    // El contexto puede no existir todavia —no hubo gesto del usuario— asi que
    // se guardan los bytes y se decodifican en el primer `voz()`.
    vozBuf = { crudo: datos };
  } catch (e) { vozIndice = null; }
}

export function voz(clave) {
  if (!ac || !prendido || !vol.voces || !vozIndice || !vozBuf) return;
  const tramo = vozIndice[clave];
  if (!tramo) return;
  const soltar = () => {
    // UNA VOZ POR VEZ. Los carteles se pisan cuando el jugador cruza un portal
    // mientras habla el anterior, y dos lineas encimadas no se entiende
    // ninguna: la nueva corta a la vieja.
    if (vozAhora) { try { vozAhora.stop(); } catch (e) {} }
    const s = ac.createBufferSource();
    s.buffer = vozBuf.buffer;
    const g = ac.createGain();
    g.gain.value = 1.35;          // la voz por encima de los golpes
    s.connect(g); g.connect(busVoz);
    s.start(0, tramo[0], tramo[1]);
    vozAhora = s;
  };
  if (vozBuf.buffer) return soltar();
  if (vozBuf.decodificando) return;
  vozBuf.decodificando = true;
  ac.decodeAudioData(vozBuf.crudo.slice(0), (b) => {
    vozBuf.buffer = b; soltar();
  }, () => { vozIndice = null; });
}

// El zumbido del pozo: dos osciladores desafinados que cambian de nota al
// cambiar de capitulo. Es la música del juego y se queda sintetizada a
// propósito: sube y baja con el capítulo, y una grabación no sabe hacer eso.
let drone = null;
export function zumbido(nota) {
  if (!ac || !prendido) return;
  if (!drone) {
    const g = ac.createGain(); g.gain.value = 0.045; g.connect(busMus);
    const a = ac.createOscillator(), b = ac.createOscillator();
    a.type = b.type = "sawtooth";
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320;
    a.connect(f); b.connect(f); f.connect(g);
    a.start(); b.start();
    drone = { a, b, g };
  }
  drone.g.gain.value = 0.045;
  drone.a.frequency.linearRampToValueAtTime(nota, ac.currentTime + 1.2);
  drone.b.frequency.linearRampToValueAtTime(nota * 1.01, ac.currentTime + 1.2);
}
export function callar() { if (drone) drone.g.gain.value = 0; aire(0, 0); }
export function volverASonar() { if (drone && prendido) drone.g.gain.value = 0.045; }
