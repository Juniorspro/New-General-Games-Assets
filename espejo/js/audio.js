// Los efectos: grabaciones, con los osciladores de antes de respaldo.
//
// Un puzzle no tiene velocidad que informar, asi que no hay sonido de fondo:
// hay respuestas a los toques y nada mas. Un juego sin tiempo con musica
// insistente apura a alguien que justamente no tiene que apurarse.
//
// LAS GRABACIONES VIENEN EN BASE64 ADENTRO DE js/sonidos.js (lo genera
// sonidos/incrustar.py desde sonidos/espejo/): el archivo único se abre desde
// file:// y ahí `fetch` no lee nada. Se decodifican una vez, al crear el
// contexto; hasta que terminan —o si alguna falta— suena el oscilador de
// siempre, así que el primer toque nunca queda mudo.
//
// El contexto NO se crea al arrancar: los navegadores no dejan sonar nada hasta
// que hubo un gesto, y uno creado antes queda "suspended" para siempre.

let ac = null, maestro = null, busEf = null, volEf = 0.8;
const buf = {}, grupos = {};

// Un `const` de un script clásico no cuelga de window pero se ve por nombre
// desde un módulo; el `typeof` evita el ReferenceError cuando no está.
const crudas = () => globalThis.SONIDOS_B64 || (typeof SONIDOS_B64 !== "undefined" ? SONIDOS_B64 : null);
export const creditosSonidos = () => globalThis.SONIDOS_CREDITOS
  || (typeof SONIDOS_CREDITOS !== "undefined" ? SONIDOS_CREDITOS : []);

export function despertar() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  maestro = ac.createGain();
  maestro.gain.value = 0.5;
  maestro.connect(ac.destination);
  // Los efectos van por su propio bus: el volumen de efectos no puede tocar la
  // música, que cuelga del mismo maestro.
  busEf = ac.createGain();
  busEf.gain.value = volEf;
  busEf.connect(maestro);
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

/** El volumen de los efectos, de 0 a 1. */
export function volumenEfectos(v) {
  volEf = Math.max(0, Math.min(1, v));
  if (busEf) busEf.gain.setTargetAtTime(volEf, ac.currentTime, 0.03);
}

// El contexto y el maestro se comparten con la musica: dos AudioContext en la
// misma pagina es el error que hace que en un telefono uno de los dos no suene
// nunca —el navegador limita cuantos deja abiertos—.
export const contexto = () => ac;
export const salida = () => maestro;

/**
 * Una grabación suelta. `id` puede ser un grupo ("espejo" → espejo_1..3): se
 * elige una al azar y con la velocidad corrida un poco, porque cuarenta toques
 * iguales seguidos suenan a máquina. Devuelve false si no hay grabación.
 */
export function muestra(id, { vol = 0.6, rate = 1, azar = 0.04 } = {}) {
  if (!ac || volEf <= 0) return false;
  const b = buf[id] || (grupos[id] && grupos[id][Math.floor(Math.random() * grupos[id].length)]);
  if (!b) return false;
  const s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = b;
  s.playbackRate.value = rate * (1 - azar + Math.random() * azar * 2);
  g.gain.value = vol;
  s.connect(g); g.connect(busEf);
  s.start();
  return true;
}

function env(nodo, a, d, pico) {
  const g = ac.createGain(), t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  nodo.connect(g); g.connect(busEf);
  return t + a + d;
}

function tono(tipo, f0, f1, a, d, pico) {
  if (!ac || volEf <= 0) return;
  const o = ac.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f0, ac.currentTime);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + a + d);
  const fin = env(o, a, d, pico);
  o.start(); o.stop(fin + 0.02);
}

export const efe = {
  // LOS DOS SONIDOS QUE IMPORTAN SON DISTINTOS ENTRE SI: dar vuelta un espejo
  // y prender un objetivo. En un puzzle sin tiempo, el sonido es la única
  // respuesta inmediata que hay a un toque, y si los dos suenan parecido se
  // pierde la única señal de "esto estuvo bien" que el juego da antes de ganar.
  // El espejo suena DISTINTO segun para donde quede: más agudo para "/" y más
  // grave para "\\". Con la grabación se logra corriéndole la velocidad un
  // tono entero: tocando sin mirar se sabe en qué estado quedó.
  espejo(vuelco) {
    if (muestra("espejo", { vol: 0.55, rate: vuelco ? 1.12 : 0.89 })) return;
    vuelco ? tono("triangle", 980, 720, 0.003, 0.05, 0.09)
           : tono("triangle", 720, 980, 0.003, 0.05, 0.09);
  },
  prende() { if (!muestra("prende", { vol: 0.45 })) tono("sine", 880, 1320, 0.004, 0.16, 0.12); },
  apaga() { if (!muestra("apaga", { vol: 0.35, rate: 0.8 })) tono("sine", 620, 440, 0.004, 0.10, 0.07); },
  gana() {
    if (muestra("gana", { vol: 0.5, azar: 0 })) return;
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono("triangle", f, f, 0.01, 0.26, 0.13), i * 85));
  },
  pista() { if (!muestra("pista", { vol: 0.35, azar: 0 })) tono("square", 1200, 900, 0.004, 0.14, 0.07); },
  // El ultimo objetivo suena distinto de los otros —una campana más larga—: es
  // el aviso de que ya esta, y llega antes que la pantalla de victoria.
  ultimo() { if (!muestra("ultimo", { vol: 0.5, azar: 0 })) tono("sine", 1320, 1980, 0.004, 0.24, 0.13); },
  nivel() {
    if (muestra("nivel", { vol: 0.5 })) return;
    [784, 1047].forEach((f, i) => setTimeout(() => tono("triangle", f, f, 0.01, 0.18, 0.1), i * 80));
  },
  menu() { if (!muestra("ui_clic", { vol: 0.4 })) tono("square", 520, 700, 0.004, 0.07, 0.1); },
};
