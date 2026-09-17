// La música. Dos cosas distintas, y a propósito.
//
// EN EL MENU SUENA UN TEMA GRABADO. Es un bucle corto —el modelo que lo generó
// da nueve segundos y de ahí sale un bucle de cinco— y eso en un menú no
// molesta: nadie se queda diez minutos mirando un menú. Da atmósfera, que es
// justo lo que un puñado de osciladores no da.
//
// EN EL JUEGO LA MUSICA SE TOCA SOLA, con osciladores, y no se repite nunca.
// Un bucle de cinco segundos abajo de una partida de tres minutos es una
// tortura: se escucha la costura treinta y seis veces. Acá hay una progresión
// de acordes, un bajo, un arpegio y una percusión de ruido, y lo que toca cada
// uno DEPENDE DE COMO VENIS: cuanto más rápido caés, más denso el arpegio, más
// abierto el filtro y más fuerte el bombo. La música no acompaña al juego — lo
// informa, igual que el viento.
//
// Y NO PESA NADA. Cero archivos, cero kilobytes, y nunca se desactualiza.

import { ruta } from "./assets.js";

// La escala y los acordes. Menor natural, que es lo que suena a "esto va a
// salir mal": el juego se trata de caer a un pozo sin fondo.
const ESCALA = [0, 2, 3, 5, 7, 8, 10];         // semitonos desde la tónica
const ACORDES = [                               // grados, en semitonos
  [0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14],
];
const TONICA = 55;                              // La1, en hercios
const COMPAS = 8;                               // corcheas por acorde
const PULSO = 0.135;                            // segundos por corchea (≈ 111 BPM)

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
  bus.gain.value = 0.34;
  bus.connect(maestro);
}

export function sonando(v) {
  prendida = v;
  if (bus) bus.gain.setTargetAtTime(v ? 0.34 : 0, ac.currentTime, 0.12);
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

  // El arpegio: es la voz que cuenta la velocidad. Quieto toca una de cada
  // cuatro corcheas; a fondo toca todas, una octava más arriba.
  const densidad = int > 0.66 ? 1 : int > 0.33 ? 2 : 4;
  if (en % densidad === 0) {
    const grado = ESCALA[(i * 3) % ESCALA.length];
    const oct = int > 0.66 ? 48 : 36;
    voz("square", nota(acorde[0] + grado + oct), t, 0.004, 0.11, 0.028 + int * 0.02,
        1400 + int * 4000);
  }

  // La percusión aparece recién a media intensidad: en un juego que arranca
  // suave, entrar con bombo desde el primer compás le saca el arranque suave.
  if (int > 0.28 && en % 4 === 0) {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    env(o, t, 0.004, 0.13, 0.10 * int);
    o.start(t); o.stop(t + 0.2);
  }
  if (int > 0.5 && en % 2 === 1) {
    const n = ac.createBufferSource();
    const largo = Math.floor(ac.sampleRate * 0.04);
    const buf = ac.createBuffer(1, largo, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let k = 0; k < largo; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / largo);
    n.buffer = buf;
    const fl = ac.createBiquadFilter();
    fl.type = "highpass"; fl.frequency.value = 6000;
    n.connect(fl);
    env(fl, t, 0.002, 0.04, 0.05 * int);
    n.start(t);
  }
}
