// El sonido, sintetizado. No hay un solo archivo de audio.
//
// EL VIENTO ES EL INSTRUMENTO PRINCIPAL. El sonido no acompaña: informa. El
// ruido sube de volumen y se abre de filtro con la velocidad, asi que se
// escucha a que velocidad vas sin mirar ningun numero — y se escucha ANTES de
// verlo, porque el oido no tiene que apartarse de la proxima argolla para
// enterarse.
//
// El contexto NO se crea al arrancar: los navegadores no dejan sonar nada hasta
// que hubo un gesto, y uno creado antes queda "suspended" para siempre.

let ac = null, maestro = null, prendido = true, viento = null;

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

function ruidoBuffer(dur) {
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

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

function golpeRuido(dur, corte, pico) {
  if (!ac || !prendido) return;
  const s = ac.createBufferSource();
  s.buffer = ruidoBuffer(dur);
  const f = ac.createBiquadFilter();
  f.type = "lowpass"; f.frequency.value = corte;
  s.connect(f);
  const fin = env(f, 0.004, dur, pico);
  s.start(); s.stop(fin + 0.02);
}

export const efe = {
  // EL ENGANCHE Y LA SOLTADA SUENAN DISTINTO Y CORTO. Son las dos únicas cosas
  // que hace el jugador, pasan cincuenta veces por partida y muchas veces
  // seguidas: un sonido largo se pisa consigo mismo y se vuelve barro.
  engancha() { golpeRuido(0.05, 2200, 0.3); tono("square", 640, 1080, 0.003, 0.05, 0.1); },
  suelta() { tono("triangle", 900, 420, 0.003, 0.07, 0.08); },
  tuerca() { tono("square", 880, 1380, 0.004, 0.09, 0.12); },
  pared() { golpeRuido(0.1, 500, 0.3); },
  // La argolla que se rompe suena a metal cediendo: dos tonos que bajan juntos
  // desafinados. Tiene que asustar sin ser el sonido de perder.
  rompe() { tono("sawtooth", 420, 90, 0.004, 0.3, 0.2); tono("square", 390, 80, 0.004, 0.3, 0.12); },
  muerto() { tono("sawtooth", 300, 42, 0.01, 0.9, 0.28); },
  hito() { [523, 659, 784].forEach((f, i) => setTimeout(() => tono("triangle", f, f, 0.01, 0.22, 0.14), i * 70)); },
  menu() { tono("square", 520, 700, 0.004, 0.07, 0.1); },
};

/**
 * El viento, que suena siempre y cambia con la velocidad.
 *
 * Es un ruido blanco pasado por un pasabanda: subiendo la frecuencia del
 * filtro, el mismo ruido pasa de "aire" a "silbido". Una fuente que arranca una
 * vez y no para nunca cuesta nada; crear un buffer por cuadro, en cambio,
 * derrite un telefono.
 */
export function arrancarViento() {
  if (!ac || viento) return;
  const s = ac.createBufferSource();
  s.buffer = ruidoBuffer(2.5);
  s.loop = true;
  const f = ac.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = 400; f.Q.value = 0.7;
  const g = ac.createGain(); g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(maestro);
  s.start();
  viento = { s, f, g };
}

/** `v` de 0 a 1: a que parte de la velocidad maxima vas. */
export function soplar(v) {
  if (!viento || !ac) return;
  const t = ac.currentTime;
  viento.g.gain.setTargetAtTime(prendido ? 0.03 + v * 0.22 : 0, t, 0.08);
  viento.f.frequency.setTargetAtTime(380 + v * 1500, t, 0.1);
}

export function callarViento() { if (viento) viento.g.gain.setTargetAtTime(0, ac.currentTime, 0.1); }
