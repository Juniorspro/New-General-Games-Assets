// Sonido: efectos sintetizados + musica grabada.
//
// La division no es capricho, es lo que midio la practica. Los efectos
// generados por IA vinieron de 380 KB cada uno —clips largos donde el juego
// necesita un golpe de medio segundo— y en un corredor el efecto tiene que
// sonar EN el cuadro del salto: sintetizado sale exacto y pesa cero. La
// musica es al reves: sintetizada suena a demo de teclado, y los 390 KB de
// una pista grabada de verdad se pagan solos.
//
// Si una pista no esta, se cae al generador sintetizado sin avisar. Un juego
// mudo porque falto un archivo es peor que un juego con musica de teclado.

import { ruta } from "./assets.js";

let ctx = null, maestro = null, canalMus = null, canalEfe = null;
let musicaAndando = false, proximaNota = 0, pasoMus = 0, temaActual = null;

// El contexto NO se puede crear al cargar la pagina: los navegadores lo dejan
// "suspended" hasta que hay un gesto del usuario, y todo sonido disparado
// antes se pierde en silencio sin ningun error. Se crea en el primer toque.
export function despertar() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  maestro = ctx.createGain(); maestro.gain.value = 0.55; maestro.connect(ctx.destination);
  canalMus = ctx.createGain(); canalMus.gain.value = 0.30; canalMus.connect(maestro);
  canalEfe = ctx.createGain(); canalEfe.gain.value = 0.85; canalEfe.connect(maestro);
}

export function volumen(musica, efectos) {
  if (!ctx) return;
  canalMus.gain.value = musica ? 0.30 : 0;
  canalEfe.gain.value = efectos ? 0.85 : 0;
}

function tono({ f = 440, f2 = null, dur = 0.12, tipo = "square", vol = 0.25,
                ataque = 0.005, canal = null, detune = 0 }) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.value = f; o.detune.value = detune;
  if (f2 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), ctx.currentTime + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g); g.connect(canal || canalEfe);
  o.start(); o.stop(ctx.currentTime + dur + 0.02);
}

function ruido({ dur = 0.15, vol = 0.2, corte = 1200, tipo = "lowpass" }) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = corte;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(canalEfe); s.start();
}

export const efe = {
  salto:    () => tono({ f: 300, f2: 620, dur: 0.11, vol: 0.18 }),
  saltoAlto:() => tono({ f: 340, f2: 820, dur: 0.16, vol: 0.20 }),
  paredazo: () => tono({ f: 500, f2: 260, dur: 0.09, tipo: "triangle", vol: 0.18 }),
  vault:    () => tono({ f: 600, f2: 900, dur: 0.07, tipo: "triangle", vol: 0.14 }),
  moneda:   () => { tono({ f: 988, dur: 0.05, vol: 0.16 });
                    setTimeout(() => tono({ f: 1319, dur: 0.11, vol: 0.16 }), 45); },
  monedaColor: () => { [880, 1175, 1568, 2093].forEach((f, i) =>
                    setTimeout(() => tono({ f, dur: 0.12, tipo: "triangle", vol: 0.2 }), i * 55)); },
  pisada:   () => { tono({ f: 180, f2: 90, dur: 0.09, vol: 0.22 }); ruido({ dur: 0.07, vol: 0.12, corte: 900 }); },
  combo:    (n) => tono({ f: 520 + n * 130, dur: 0.09, tipo: "triangle", vol: 0.2 }),
  bloque:   () => { tono({ f: 150, f2: 80, dur: 0.07, vol: 0.2 }); ruido({ dur: 0.06, vol: 0.14, corte: 700 }); },
  ladrillo: () => ruido({ dur: 0.18, vol: 0.24, corte: 2600, tipo: "highpass" }),
  resorte:  () => tono({ f: 220, f2: 1100, dur: 0.2, tipo: "sine", vol: 0.22 }),
  burbuja:  () => tono({ f: 700, f2: 1400, dur: 0.28, tipo: "sine", vol: 0.18 }),
  pinchar:  () => { tono({ f: 400, f2: 120, dur: 0.3, tipo: "sawtooth", vol: 0.22 }); ruido({ dur: 0.2, vol: 0.15, corte: 500 }); },
  pausa:    () => tono({ f: 660, dur: 0.06, tipo: "sine", vol: 0.14 }),
  reloj:    () => tono({ f: 1200, dur: 0.05, tipo: "sine", vol: 0.12 }),
  apuro:    () => tono({ f: 1568, dur: 0.07, tipo: "square", vol: 0.16 }),
  mastil:   () => { [523, 659, 784, 1047].forEach((f, i) =>
                    setTimeout(() => tono({ f, dur: 0.22, tipo: "triangle", vol: 0.22 }), i * 90)); },
  ganar:    () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
                    setTimeout(() => tono({ f, dur: 0.3, tipo: "triangle", vol: 0.24 }), i * 130)); },
  perder:   () => { [392, 349, 311, 262].forEach((f, i) =>
                    setTimeout(() => tono({ f, dur: 0.4, tipo: "sawtooth", vol: 0.2 }), i * 180)); },
  jefe:     () => { tono({ f: 90, f2: 50, dur: 0.5, tipo: "sawtooth", vol: 0.3 }); ruido({ dur: 0.4, vol: 0.2, corte: 300 }); },
  menu:     () => tono({ f: 780, dur: 0.05, tipo: "sine", vol: 0.14 }),
};

// --- musica --------------------------------------------------------------
// Una linea de bajo y una melodia sacadas de una escala. La escala y el patron
// salen del tema del nivel, asi que el subterraneo suena menor y el cielo
// mayor, sin que haya dos archivos distintos.
const ESCALAS = {
  mayor:    [0, 2, 4, 5, 7, 9, 11],
  menor:    [0, 2, 3, 5, 7, 8, 10],
  frigia:   [0, 1, 3, 5, 7, 8, 10],   // castillo: suena amenazante
  hexa:     [0, 2, 4, 6, 8, 10],      // casa fantasma: tonos enteros, sin reposo
};
const TEMAS_MUS = {
  llano: { escala: "mayor", raiz: 60, bpm: 132 },
  subte: { escala: "menor", raiz: 55, bpm: 124 },
  cielo: { escala: "mayor", raiz: 67, bpm: 138 },
  castillo: { escala: "frigia", raiz: 50, bpm: 118 },
  fantasma: { escala: "hexa", raiz: 58, bpm: 104 },
  desierto: { escala: "menor", raiz: 62, bpm: 128 },
  nave: { escala: "menor", raiz: 53, bpm: 142 },
  torre: { escala: "frigia", raiz: 57, bpm: 130 },
};
const nota = (m) => 440 * Math.pow(2, (m - 69) / 12);

// --- musica grabada ------------------------------------------------------
const PISTAS = {};          // tema -> AudioBuffer
let fuenteMus = null;

export async function cargarPistas(mapa) {
  despertar();
  if (!ctx) return;
  await Promise.all(Object.entries(mapa).map(async ([tema, url]) => {
    const u = ruta(url);
    // Desde file://, fetch a una ruta suelta lo bloquea CORS y ensucia la
    // consola con tres errores rojos que no son un problema: la version de un
    // solo archivo sin musica usa la sintetizada a proposito. Si la pista no
    // vino embebida y estamos en file://, ni se intenta.
    if (!u.startsWith("data:") && location.protocol === "file:") return;
    try {
      const r = await fetch(u);
      if (!r.ok) return;
      PISTAS[tema] = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch (e) { /* sin pista: se usa la sintetizada */ }
  }));
}

function sonarPista(buf) {
  if (fuenteMus) { try { fuenteMus.stop(); } catch (e) {} }
  fuenteMus = ctx.createBufferSource();
  fuenteMus.buffer = buf;
  fuenteMus.loop = true;
  fuenteMus.connect(canalMus);
  fuenteMus.start();
}

export function musica(tema, semilla) {
  despertar();
  if (!ctx) return;
  // Los temas comparten pista por familia: tres pistas para ocho temas suena
  // mejor que ocho pistas mediocres, y pesa la mitad.
  const familia = { llano: "llano", cielo: "llano", desierto: "llano", nave: "llano",
                    subte: "subte", fantasma: "subte", torre: "subte",
                    castillo: "castillo" }[tema] || "llano";
  if (PISTAS[familia]) { musicaAndando = false; sonarPista(PISTAS[familia]); return; }
  temaActual = TEMAS_MUS[tema] || TEMAS_MUS.llano;
  const esc = ESCALAS[temaActual.escala];
  // El patron se congela con la semilla: el mismo nivel suena igual siempre.
  let s = (semilla >>> 0) || 1;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  temaActual.mel = Array.from({ length: 16 }, () =>
    rnd() < 0.22 ? null : esc[Math.floor(rnd() * esc.length)] + (rnd() < 0.3 ? 12 : 0));
  temaActual.bajo = Array.from({ length: 8 }, () => esc[Math.floor(rnd() * 3) * 2]);
  musicaAndando = true; pasoMus = 0; proximaNota = ctx.currentTime + 0.05;
}

export function pararMusica() {
  musicaAndando = false;
  if (fuenteMus) { try { fuenteMus.stop(); } catch (e) {} fuenteMus = null; }
}

// Se programa por adelantado en el reloj del audio y no con setInterval: el
// temporizador del navegador se atrasa cuando la pestana pierde foco o el
// cuadro tarda, y la musica queda renga. El reloj de audio no se atrasa nunca.
export function latirMusica() {
  if (!musicaAndando || !ctx || !temaActual) return;
  const paso = 60 / temaActual.bpm / 2;
  while (proximaNota < ctx.currentTime + 0.2) {
    const t = proximaNota, i = pasoMus % 16;
    const n = temaActual.mel[i];
    if (n !== null) programar(nota(temaActual.raiz + n), t, paso * 0.9, "square", 0.10);
    if (i % 2 === 0) programar(nota(temaActual.raiz + temaActual.bajo[(pasoMus >> 1) % 8] - 24),
                               t, paso * 1.7, "triangle", 0.14);
    proximaNota += paso; pasoMus++;
  }
}

function programar(f, t, dur, tipo, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = tipo; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(canalMus); o.start(t); o.stop(t + dur + 0.02);
}
