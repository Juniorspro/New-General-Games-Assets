// El sonido.
//
// ═══════════════════════════════════════════════════════════════════════════
// DOS CAMINOS, Y EL PROCEDURAL NUNCA SE BORRA.
// ═══════════════════════════════════════════════════════════════════════════
// Si hay muestras horneadas, se usan. Si no llegaron —o el decodificador no
// quiso un MP3, que pasa— suenan los osciladores. Un juego mudo porque un
// archivo no cargo es peor que un juego con sintesis: el ladrido tiene que
// salir cuando se aprieta el boton, siempre.
//
// UN SOLO AudioContext. Dos en la misma pagina hacen que uno quede mudo en el
// telefono, y el sintoma es "a veces no suena" — que no se encuentra nunca.
//
// Y NADA ARRANCA SOLO: ningun navegador deja sonar antes de un gesto de
// verdad, asi que todo esto espera a `despierta()`.
import { ruta } from "./assets.js";

let AC = null, MAE = null, RUIDO = null, ANA = null;
let MUS_G = null, MUS_SRC = null, MUS_ACT = "", MUS_PED = "";
let MUE = {}, MUE_PED = false, MUE_N = 0, MUE_MAL = 0;

// LOS BUSES SE MIDEN, NO SE ELIGEN. El fondo tiene que quedar DEBAJO de lo que
// pasa: el ladrido es el unico acuse de recibo del unico boton del juego, y si
// la musica lo tapa el boton parece roto. Los numeros de aca salen del
// analizador colgado del maestro; estan anotados en el README.
const MUS_MENU = 0.42, MUS_JUEGO = 0.22;
const CRUCE = 0.9;                 // segundos de cruce entre pistas
let musV = MUS_MENU;

const PISTAS = { menu: "m_menu", camina: "m_camina", corre: "m_corre" };

export function arranca() {
  if (AC) return true;
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
  catch (e) { return false; }
  MAE = AC.createGain(); MAE.gain.value = 0.62; MAE.connect(AC.destination);
  ANA = AC.createAnalyser(); ANA.fftSize = 2048; MAE.connect(ANA);
  MUS_G = AC.createGain(); MUS_G.gain.value = musV; MUS_G.connect(MAE);
  const n = AC.sampleRate | 0;
  RUIDO = AC.createBuffer(1, n, AC.sampleRate);
  const d = RUIDO.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

export function despierta() {
  if (!arranca()) return;
  if (AC.state === "suspended") AC.resume();
  cargaMuestras();
}

/* --- las muestras -------------------------------------------------------- */
const ARCHIVOS = {
  ladra: "assets/ladra.mp3", ladra2: "assets/ladra2.mp3",
  m_menu: "assets/m_menu.mp3", m_camina: "assets/m_camina.mp3",
  m_corre: "assets/m_corre.mp3",
};

function cargaMuestras() {
  if (MUE_PED || !AC) return;
  MUE_PED = true;
  for (const k in ARCHIVOS) {
    const r = ruta(ARCHIVOS[k]);
    // NO SE PIDE NADA POR RUTA CUANDO SE ABRIO CON DOBLE CLIC. Desde `file://`
    // un `fetch` a un archivo vecino lo bloquea CORS aunque el archivo exista,
    // asi que el pedido no puede salir bien nunca y lo unico que deja es un
    // error rojo en la consola por cada muestra. Embebido, `ruta()` devuelve un
    // `data:` y ese si se puede pedir; suelto con servidor, la ruta anda.
    // En los dos casos que no sirven, se cae directo a la sintesis.
    if (!r.startsWith("data:") && location.protocol === "file:") { MUE_MAL++; continue; }
    fetch(r)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((ab) => AC.decodeAudioData(ab))
      .then((buf) => {
        MUE[k] = buf; MUE_N++;
        // LA PISTA PEDIDA PUEDE HABER LLEGADO ANTES QUE SU MUESTRA. Sin este
        // reintento, la primera partida se juega entera sin musica y desde
        // afuera parece que el juego no tiene.
        if (MUS_PED && !MUS_SRC) musica(MUS_PED);
      })
      .catch(() => { MUE_MAL++; });
  }
}

export const estado = () => ({ n: MUE_N, mal: MUE_MAL, mus: MUS_ACT, pedida: MUS_PED,
                               claves: Object.keys(MUE).length, ctx: AC ? AC.state : "" });

/* --- musica --------------------------------------------------------------
   `clave` es 'menu' | 'camina' | 'corre'. El cruce evita el corte en seco, que
   se escucha mas que la musica que entra. */
export function musica(clave) {
  MUS_PED = clave;
  if (!AC || !MUS_G) return;
  if (MUS_ACT === clave && MUS_SRC) return;
  const buf = MUE[PISTAS[clave]];
  if (!buf) { proceduralFondo(clave); return; }
  const t = AC.currentTime;
  if (MUS_SRC) {
    const vs = MUS_SRC, vg = vs._g;
    vg.gain.setValueAtTime(vg.gain.value, t);
    vg.gain.linearRampToValueAtTime(0, t + CRUCE);
    try { vs.stop(t + CRUCE + 0.05); } catch (e) {}
  }
  const s = AC.createBufferSource();
  s.buffer = buf; s.loop = true;
  const g = AC.createGain(); g.gain.value = 0;
  s.connect(g); g.connect(MUS_G); s.start();
  g.gain.linearRampToValueAtTime(1, t + CRUCE);
  s._g = g; MUS_SRC = s; MUS_ACT = clave;
  paraFondo();
}

/** El nivel de la musica segun donde estemos. Una sola puerta: con dos, el dia
 *  que se agregue una pantalla una de las dos se queda sin ajustar. */
export function nivel(enJuego) {
  musV = enJuego ? MUS_JUEGO : MUS_MENU;
  if (MUS_G && AC) MUS_G.gain.setTargetAtTime(musV, AC.currentTime, 0.3);
}

/* --- el respaldo procedural ---------------------------------------------
   No imita las pistas: sostiene un fondo que no molesta. Tres notas de un
   acorde mayor con un filtro que respira. Pesa cero y no se corta nunca. */
let FONDO = null;
const ACORDES = { menu: [130.8, 164.8, 196.0], camina: [146.8, 185.0, 220.0],
                  corre: [164.8, 207.7, 246.9] };
function proceduralFondo(clave) {
  if (!AC) return;
  paraFondo();
  const g = AC.createGain(); g.gain.value = 0; g.connect(MUS_G);
  // EL FONDO PROCEDURAL VA BAJO. Medido con el analizador: a 0,5 el fondo daba
  // rms 0,0280 y el ladrido 0,0277 — o sea que el ladrido, que es el unico
  // boton del juego, EMPATABA con el fondo y el boton parecia roto. A 0,30 el
  // fondo baja y el ladrido queda por encima con margen.
  g.gain.linearRampToValueAtTime(0.30, AC.currentTime + 0.8);
  const nodos = [];
  (ACORDES[clave] || ACORDES.menu).forEach((hz, i) => {
    const o = AC.createOscillator(); o.type = i === 2 ? "triangle" : "sine";
    o.frequency.value = hz * (1 + (i - 1) * 0.002);   // desafinado: dos senos
    const og = AC.createGain(); og.gain.value = [0.5, 0.32, 0.18][i]; // iguales
    o.connect(og); og.connect(g); o.start();          // suenan a tono de prueba
    nodos.push(o);
  });
  const lfo = AC.createOscillator(); lfo.frequency.value = 1 / 11;
  const lg = AC.createGain(); lg.gain.value = 0.16;
  lfo.connect(lg); lg.connect(g.gain); lfo.start();
  nodos.push(lfo);
  FONDO = { g, nodos };
  MUS_ACT = clave;
}
function paraFondo() {
  if (!FONDO || !AC) return;
  const { g, nodos } = FONDO; FONDO = null;
  g.gain.setTargetAtTime(0, AC.currentTime, 0.2);
  nodos.forEach((o) => { try { o.stop(AC.currentTime + 1.2); } catch (e) {} });
}

/* --- el ladrido ----------------------------------------------------------
   Si hay muestra, suena la muestra. Si no, se sintetiza: un ladrido es un
   golpe de aire con una resonancia que cae. Se arma con ruido pasado por un
   pasabanda que baja de tono, mas un tono corto que le da el cuerpo. */
export function ladra(agudo) {
  if (!AC) return false;
  const k = agudo ? "ladra2" : "ladra";
  if (MUE[k]) {
    const s = AC.createBufferSource(); s.buffer = MUE[k];
    const g = AC.createGain(); g.gain.value = 0.92;
    s.connect(g); g.connect(MAE); s.start();
    return true;
  }
  const t0 = AC.currentTime, base = agudo ? 780 : 520;
  // el cuerpo
  const o = AC.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(base * 1.5, t0);
  o.frequency.exponentialRampToValueAtTime(base * 0.55, t0 + 0.16);
  const og = AC.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.52, t0 + 0.012);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
  // LA BOCA. Un pasabanda que se abre y se cierra es lo que convierte un tono
  // en una vocal: sin esto suena a bocina, no a perro.
  const boca = AC.createBiquadFilter(); boca.type = "bandpass"; boca.Q.value = 2.4;
  boca.frequency.setValueAtTime(base * 2.2, t0);
  boca.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + 0.17);
  o.connect(boca); boca.connect(og); og.connect(MAE); o.start(t0); o.stop(t0 + 0.25);
  // el golpe de aire del principio
  const s = AC.createBufferSource(); s.buffer = RUIDO; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = "bandpass";
  f.frequency.value = base * 2.6; f.Q.value = 0.9;
  const sg = AC.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.26, t0 + 0.008);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  s.connect(f); f.connect(sg); sg.connect(MAE); s.start(t0); s.stop(t0 + 0.14);
  return true;
}

/** Un toque de boton. Corto y claro: es el unico acuse de recibo del menu. */
export function toque() {
  if (!AC) return;
  const t0 = AC.currentTime;
  const o = AC.createOscillator(); o.type = "triangle";
  o.frequency.setValueAtTime(620, t0);
  o.frequency.exponentialRampToValueAtTime(880, t0 + 0.07);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  o.connect(g); g.connect(MAE); o.start(t0); o.stop(t0 + 0.12);
}

/** Una pisada. Suena con el paso de la animacion, no con un temporizador: asi
 *  el sonido cae cuando la pata TOCA, que es lo unico que lo hace creible. */
export function pisada(fuerte) {
  if (!AC || !RUIDO) return;
  const t0 = AC.currentTime;
  const s = AC.createBufferSource(); s.buffer = RUIDO; s.loop = true;
  const f = AC.createBiquadFilter(); f.type = "lowpass";
  f.frequency.value = fuerte ? 1500 : 1000; f.Q.value = 0.6;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(fuerte ? 0.055 : 0.028, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (fuerte ? 0.085 : 0.06));
  s.connect(f); f.connect(g); g.connect(MAE); s.start(t0); s.stop(t0 + 0.12);
}

/** Para medir desde afuera lo que sale por los parlantes. */
export function rms() {
  if (!ANA) return 0;
  const b = new Float32Array(ANA.fftSize);
  ANA.getFloatTimeDomainData(b);
  let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i];
  return Math.sqrt(s / b.length);
}
