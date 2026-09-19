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
  ladra1: "assets/ladra1.mp3", ladra2: "assets/ladra2.mp3", ladra3: "assets/ladra3.mp3",
  jadeo: "assets/jadeo.mp3", pasos: "assets/pasos.mp3",
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
   ═══════════════════════════════════════════════════════════════════════════
   ESTE ES EL SONIDO QUE MAS SE ESCUCHA, ASI QUE ES EL QUE MAS TRABAJO LLEVA.
   ═══════════════════════════════════════════════════════════════════════════
   Si hay muestra grabada, gana la muestra. Cuando no hay, esto no es un bip:
   un ladrido tiene cuatro cosas y las cuatro estan aca.

    1. UN GOLPE DE AIRE al abrir la boca: ruido corto y agudo, 8 ms.
    2. UN CUERPO ARMONICO que CAE de tono rapido. Un tono que no cae suena a
       bocina; lo que hace "perro" es la caida.
    3. TRES FORMANTES, no uno. Un solo pasabanda da una vocal sola y suena a
       juguete. La garganta y la boca de un bicho arman varias resonancias a la
       vez: con tres filtros en paralelo aparece la "a" del guau.
    4. LA BOCA QUE SE CIERRA: los tres formantes bajan juntos durante el
       ladrido. Eso es literalmente el hocico cerrandose, y es lo que convierte
       "aaa" en "auu".

   Y CADA LADRIDO SALE UN POCO DISTINTO. Repetido identico, a la tercera vez
   deja de sonar a perro y suena a boton: el tono, el largo y los formantes se
   mueven un poco al azar en cada uno. */
const VOCES = [
  // grave y corto, mediano, agudo. Ninguno se repite dos veces seguidas.
  { f0: 300, dur: 0.20, form: [620, 1180, 2400] },
  { f0: 380, dur: 0.17, form: [740, 1420, 2700] },
  { f0: 470, dur: 0.14, form: [880, 1700, 3100] },
];
let ultimaVoz = -1;

export function ladra(agudo) {
  if (!AC) return false;
  // Las muestras, cuando existan: se elige una de las tres sin repetir.
  const conMuestra = ["ladra1", "ladra2", "ladra3"].filter((k) => MUE[k]);
  if (conMuestra.length) {
    let i = Math.floor(Math.random() * conMuestra.length);
    if (conMuestra.length > 1 && i === ultimaVoz) i = (i + 1) % conMuestra.length;
    ultimaVoz = i;
    const s = AC.createBufferSource(); s.buffer = MUE[conMuestra[i]];
    s.playbackRate.value = 0.94 + Math.random() * 0.13;   // ni dos iguales
    const g = AC.createGain(); g.gain.value = 0.95;
    s.connect(g); g.connect(MAE); s.start();
    return true;
  }

  let iv = agudo ? 2 : Math.floor(Math.random() * 2);
  if (iv === ultimaVoz && VOCES.length > 1) iv = (iv + 1) % VOCES.length;
  ultimaVoz = iv;
  const V = VOCES[iv];
  const t0 = AC.currentTime;
  const rnd = 0.92 + Math.random() * 0.17;
  const f0 = V.f0 * rnd, dur = V.dur * (0.9 + Math.random() * 0.22);

  const bus = AC.createGain();
  bus.gain.value = 1;
  bus.connect(MAE);

  // 2. el cuerpo: diente de sierra (muchos armonicos, que es lo que los
  //    formantes necesitan para tener de donde filtrar) cayendo de tono
  const o = AC.createOscillator(); o.type = "sawtooth";
  o.frequency.setValueAtTime(f0 * 1.7, t0);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.52, t0 + dur * 0.85);
  // un temblorcito: una cuerda vocal no da un tono perfecto
  const vib = AC.createOscillator(); vib.frequency.value = 34;
  const vibG = AC.createGain(); vibG.gain.value = f0 * 0.05;
  vib.connect(vibG); vibG.connect(o.frequency); vib.start(t0); vib.stop(t0 + dur + 0.1);

  const env = AC.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.85, t0 + 0.014);
  env.gain.exponentialRampToValueAtTime(0.22, t0 + dur * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(env);

  // 3 y 4. tres formantes en paralelo, todos cerrandose
  const pesos = [0.55, 0.30, 0.16];
  V.form.forEach((hz, k) => {
    const f = AC.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 5.5 - k * 1.4;
    const a = hz * rnd;
    f.frequency.setValueAtTime(a * 1.18, t0);
    f.frequency.exponentialRampToValueAtTime(a * 0.62, t0 + dur * 0.9);
    const g = AC.createGain(); g.gain.value = pesos[k];
    env.connect(f); f.connect(g); g.connect(bus);
  });
  o.start(t0); o.stop(t0 + dur + 0.08);

  // 1. el golpe de aire de la apertura
  const s = AC.createBufferSource(); s.buffer = RUIDO; s.loop = true;
  const fs = AC.createBiquadFilter(); fs.type = "bandpass";
  fs.frequency.value = V.form[2] * rnd; fs.Q.value = 0.8;
  const sg = AC.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.30, t0 + 0.008);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);
  s.connect(fs); fs.connect(sg); sg.connect(bus);
  s.start(t0); s.stop(t0 + 0.12);

  return true;
}

/* --- el jadeo -------------------------------------------------------------
   Corriendo, el perro respira. Es lo que convierte un modelo que se desplaza
   en un bicho que se cansa, y cuesta cuatro nodos. Se enciende y se apaga con
   una sola ganancia, asi que no hay que crear nada por cuadro. */
let JADEO = null;
export function jadeo(fuerza) {
  if (!AC) return;
  if (!JADEO) {
    const g = AC.createGain(); g.gain.value = 0; g.connect(MAE);
    const s = AC.createBufferSource(); s.buffer = RUIDO; s.loop = true;
    const f = AC.createBiquadFilter(); f.type = "bandpass";
    f.frequency.value = 900; f.Q.value = 1.4;
    // EL RITMO ES UNA GANANCIA QUE LATE, no un sonido repetido: un jadeo es
    // aire entrando y saliendo, o sea la MISMA fuente subiendo y bajando.
    const lat = AC.createOscillator(); lat.type = "triangle"; lat.frequency.value = 3.1;
    const latG = AC.createGain(); latG.gain.value = 0.6;
    const base = AC.createGain(); base.gain.value = 0.6;
    lat.connect(latG); latG.connect(base.gain);
    s.connect(f); f.connect(base); base.connect(g);
    s.start(); lat.start();
    JADEO = { g };
  }
  JADEO.g.gain.setTargetAtTime(Math.max(0, Math.min(1, fuerza)) * 0.075,
                               AC.currentTime, 0.35);
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
