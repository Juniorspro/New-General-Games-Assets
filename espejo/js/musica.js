// La música. Dos cosas distintas, y a propósito.
//
// EN EL MENU SUENA UN TEMA GRABADO. Es un bucle corto —el modelo que lo generó
// da nueve segundos y de ahí sale un bucle de cinco— y eso en un menú no
// molesta: nadie se queda diez minutos mirando un menú. Da atmósfera, que es
// justo lo que un puñado de osciladores no da.
//
// EN EL JUEGO LA MUSICA SE TOCA SOLA, con osciladores, y no se repite nunca.
// Un bucle de seis segundos abajo de alguien que está pensando hace treinta y
// cinco vueltas en tres minutos y vuelve loco a cualquiera. Acá hay una
// progresión de acordes, un bajo y campanas sueltas, y la densidad sube con los
// objetivos que ya prendiste: la música dice cuánto te falta.
//
// Y ACA NO HAY PERCUSION NUNCA. Un bombo marca un tempo, un tempo es un apuro y
// este juego no tiene reloj: apurar a alguien que está resolviendo un puzzle es
// la forma más rápida de que lo deje.
//
// Y NO PESA NADA. Cero archivos, cero kilobytes, y nunca se desactualiza.

import { ruta } from "./assets.js";

// La escala y los acordes. Mayor lidio —una cuarta aumentada— que es el sonido
// de "esto se puede resolver": acá no hay peligro ni apuro, hay un problema
// arriba de una mesa, y la música tiene que dejar pensar en vez de empujar.
const ESCALA = [0, 2, 4, 6, 7, 9, 11];         // semitonos desde la tónica
const ACORDES = [                               // grados, en semitonos
  [0, 4, 7], [2, 7, 11], [-3, 4, 9], [-5, 2, 7],
];
const TONICA = 65.4;                            // Do2, en hercios
const COMPAS = 8;                               // corcheas por acorde
const PULSO = 0.34;                             // segundos por corchea (≈ 44 BPM)

const nota = (semi) => TONICA * Math.pow(2, semi / 12);

let ac = null, maestro = null, bus = null;
let prendida = true, corriendo = false;
let paso = 0, proximo = 0, reloj = null;
let intensidad = 0, objetivo = 0;
let tema = null, temaGan = null;

/** Se engancha al mismo contexto y al mismo maestro que los efectos. */
export function conectar(contexto, salidaMaestra) {
  if (!contexto || ac) return;
  ac = contexto;
  maestro = salidaMaestra;
  bus = ac.createGain();
  // La música va MAS BAJA que los efectos, y bastante. Un efecto que no se
  // escucha por encima de la música es un efecto que no existe: el sonido del
  // paraguas cerrándose es información, y la música es decoración.
  bus.gain.value = 0.3;
  bus.connect(maestro);
}

export function sonando(v) {
  prendida = v;
  if (bus) bus.gain.setTargetAtTime(v ? 0.3 : 0, ac.currentTime, 0.12);
  if (tema) tema.volume = v ? 0.5 : 0;
  if (!v) parar();
}

/** ¿Está corriendo el secuenciador? Lo usa la prueba de sonido.
 *
 * NO ALCANZA CON CONTAR OSCILADORES para comprobar que la música se apagó: el
 * juego sigue pasando mientras se mide —el bicho se cae, algo choca— y cada
 * efecto es un oscilador más. Contando nomás, la prueba fallaba por sonidos que
 * tenían que sonar. Esto distingue "no hay música" de "no hay ningún sonido".
 */
export const andando = () => corriendo;

/** `v` de 0 a 1: qué tan intenso viene el juego. Se suaviza solo. */
export const empujar = (v) => { objetivo = Math.max(0, Math.min(1, v)); };

// --- el tema del menú ----------------------------------------------------
//
// Va como <audio> y no por el grafo de WebAudio porque no necesita nada del
// grafo —ni filtros, ni mezcla, ni sincronía con nada— y un <audio> se repite
// solo, empieza sin contexto y no se rompe si el navegador todavía no dejó
// sonar nada.
export function arrancarTema() {
  if (!prendida) return;
  if (!tema) {
    tema = new Audio(ruta("assets/arte/tema.mp3"));
    tema.loop = true;
    tema.volume = 0;
  }
  tema.play().then(() => {
    // La entrada es a mano y no con un `afade` en el archivo: el archivo es un
    // bucle y un fundido adentro del bucle se escucharía en cada vuelta.
    let v = 0;
    clearInterval(temaGan);
    temaGan = setInterval(() => {
      v = Math.min(0.5, v + 0.03);
      tema.volume = prendida ? v : 0;
      if (v >= 0.5) clearInterval(temaGan);
    }, 60);
  }).catch(() => {});
}

export function pararTema() {
  if (!tema) return;
  clearInterval(temaGan);
  let v = tema.volume;
  temaGan = setInterval(() => {
    v = Math.max(0, v - 0.05);
    tema.volume = v;
    if (v <= 0) { clearInterval(temaGan); tema.pause(); }
  }, 40);
}

// --- la música del juego -------------------------------------------------
export function arrancar() {
  if (!ac || corriendo || !prendida) return;
  corriendo = true;
  paso = 0;
  intensidad = 0;
  proximo = ac.currentTime + 0.08;
  // EL PLANIFICADOR VA ADELANTADO. Programar una nota en el momento exacto en
  // que suena la deja a merced del temporizador del navegador, que se atrasa
  // veinte o treinta milisegundos cuando el juego dibuja: el ritmo tiembla y se
  // escucha. Se programan las notas de los próximos 120 ms contra el reloj del
  // audio, que no se atrasa nunca, y el temporizador sólo decide cuándo volver
  // a mirar.
  reloj = setInterval(planificar, 25);
}

export function parar() {
  corriendo = false;
  clearInterval(reloj);
  reloj = null;
}

function planificar() {
  if (!corriendo || !ac) return;
  intensidad += (objetivo - intensidad) * 0.06;
  while (proximo < ac.currentTime + 0.12) {
    tocar(paso, proximo);
    proximo += PULSO;
    paso++;
  }
}

function env(nodo, t, a, d, pico) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  nodo.connect(g); g.connect(bus);
  return g;
}

function voz(tipo, f, t, a, d, pico, corte) {
  const o = ac.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t);
  let n = o;
  if (corte) {
    const fl = ac.createBiquadFilter();
    fl.type = "lowpass";
    fl.frequency.setValueAtTime(corte, t);
    o.connect(fl); n = fl;
  }
  env(n, t, a, d, pico);
  o.start(t); o.stop(t + a + d + 0.05);
}

function tocar(i, t) {
  const acorde = ACORDES[Math.floor(i / COMPAS) % ACORDES.length];
  const en = i % COMPAS;
  const int = intensidad;

  // El bajo: la fundamental, en la primera y en la quinta corchea. Es lo único
  // que suena siempre, con el juego quieto o a toda velocidad, y es lo que hace
  // que se sienta que hay un tema y no ruidos sueltos.
  if (en === 0 || en === 4)
    voz("sawtooth", nota(acorde[0]), t, 0.01, 0.34, 0.09, 420 + int * 900);

  // El pad: el acorde entero, largo, una vez por compás. Se abre de filtro con
  // la intensidad, así que a toda velocidad el mismo acorde suena agresivo.
  if (en === 0)
    for (const g of acorde)
      voz("sawtooth", nota(g + 24), t, 0.09, 1.0, 0.022 + int * 0.012, 600 + int * 2400);

  // Las campanas: una nota suelta cada tanto, de la escala del acorde. Es lo
  // único que cambia con la intensidad —o sea, con cuántos objetivos prendiste—
  // y cambia poniéndose MAS FRECUENTE, no más fuerte: subir el volumen para
  // decir "vas bien" es la manera de arruinar una música tranquila.
  const densidad = int > 0.66 ? 2 : int > 0.33 ? 4 : 8;
  if (en % densidad === 0) {
    const grado = ESCALA[(i * 5) % ESCALA.length];
    voz("triangle", nota(acorde[0] + grado + 36), t, 0.006, 0.9, 0.03, 2600);
    voz("sine", nota(acorde[0] + grado + 48), t, 0.004, 0.5, 0.014, 5000);
  }

}
