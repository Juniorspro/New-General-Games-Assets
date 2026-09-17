// El sonido, sintetizado. No hay un solo archivo de audio.
//
// Un puzzle no tiene velocidad que informar, asi que no hay sonido de fondo:
// hay respuestas a los toques y nada mas. Un juego sin tiempo con musica
// insistente apura a alguien que justamente no tiene que apurarse.
//
// El contexto NO se crea al arrancar: los navegadores no dejan sonar nada hasta
// que hubo un gesto, y uno creado antes queda "suspended" para siempre.

let ac = null, maestro = null, prendido = true;

export function despertar() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  maestro = ac.createGain();
  maestro.gain.value = 0.5;
  maestro.connect(ac.destination);
  return ac;
}

export const sonando = (v) => { prendido = v; if (maestro) maestro.gain.value = v ? 0.5 : 0; };

function env(nodo, a, d, pico) {
  const g = ac.createGain(), t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  nodo.connect(g); g.connect(maestro);
  return t + a + d;
}

function tono(tipo, f0, f1, a, d, pico) {
  if (!ac || !prendido) return;
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
  espejo() { tono("triangle", 760, 980, 0.003, 0.05, 0.09); },
  prende() { tono("sine", 880, 1320, 0.004, 0.16, 0.12); },
  apaga() { tono("sine", 620, 440, 0.004, 0.10, 0.07); },
  gana() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono("triangle", f, f, 0.01, 0.26, 0.13), i * 85)); },
  pista() { tono("square", 1200, 900, 0.004, 0.14, 0.07); },
  menu() { tono("square", 520, 700, 0.004, 0.07, 0.1); },
};
