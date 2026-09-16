// El sonido, sintetizado. No hay un solo archivo de audio en el juego.
//
// POR QUE. El juego entero pesa lo que pesa un mail justamente porque no
// carga nada: el dibujo es vectorial y el sonido son osciladores. Un golpe no
// es un .wav, es ruido filtrado con una envolvente de sesenta milisegundos, y
// se puede afinar cambiando un numero en vez de volver a grabarlo.
//
// EL CONTEXTO NO SE CREA AL ARRANCAR. Los navegadores no dejan sonar nada
// hasta que hubo un gesto del usuario, y un AudioContext creado antes queda
// "suspended" para siempre aunque despues se toque la pantalla. Se crea en el
// primer toque y recien ahi.

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
  const g = ac.createGain();
  const t = ac.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pico, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  nodo.connect(g); g.connect(maestro);
  return { g, t, fin: t + a + d };
}

function ruido(dur) {
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(); s.buffer = buf;
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
    const s = ruido(0.09);
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 260 + Math.min(1, fuerza / 16) * 1400;
    s.connect(f);
    const e = env(f, 0.004, 0.08, Math.min(0.5, 0.1 + fuerza * 0.02));
    s.start(); s.stop(e.fin + 0.02);
  },
  pincho() { tono("square", 620, 90, 0.005, 0.22, 0.22); },
  resorte() { tono("triangle", 220, 760, 0.01, 0.16, 0.22); },
  chatarra() { tono("square", 880, 1320, 0.005, 0.1, 0.13); },
  portal() {
    tono("sawtooth", 140, 900, 0.02, 0.5, 0.18);
    tono("sine", 320, 1400, 0.03, 0.55, 0.12);
  },
  roto() { tono("sawtooth", 300, 45, 0.01, 0.8, 0.28); },
  gano() {
    [0, 0.12, 0.24, 0.42].forEach((d, i) => setTimeout(() =>
      tono("triangle", [392, 523, 659, 784][i], [392, 523, 659, 784][i], 0.01, 0.35, 0.2), d * 1000));
  },
  menu() { tono("square", 520, 700, 0.005, 0.07, 0.1); },
};

// El zumbido del pozo: dos osciladores desafinados que cambian de nota al
// cambiar de capitulo. Es todo lo que hay de musica y alcanza, porque el juego
// suena a golpes.
let drone = null;
export function zumbido(nota) {
  if (!ac || !prendido) return;
  if (!drone) {
    const g = ac.createGain(); g.gain.value = 0.045; g.connect(maestro);
    const a = ac.createOscillator(), b = ac.createOscillator();
    a.type = b.type = "sawtooth";
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320;
    a.connect(f); b.connect(f); f.connect(g);
    a.start(); b.start();
    drone = { a, b, g };
  }
  drone.a.frequency.linearRampToValueAtTime(nota, ac.currentTime + 1.2);
  drone.b.frequency.linearRampToValueAtTime(nota * 1.01, ac.currentTime + 1.2);
}
export function callar() { if (drone) drone.g.gain.value = 0; }
export function volverASonar() { if (drone && prendido) drone.g.gain.value = 0.045; }
