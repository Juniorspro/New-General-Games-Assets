// "Tu canción": escuchar un archivo de audio y armarle un mapa.
//
// Acá sí hay que ADIVINAR dónde están los golpes (en las canciones propias el
// mapa sale de la partitura). El camino es el clásico:
//
//   1. "flujo espectral": cuánto aparece de nuevo en el espectro en cada
//      instante. Un golpe de batería es energía nueva de golpe; una nota
//      larga no lo es.
//   2. tempo: la autocorrelación de ese flujo tiene un pico en el período del
//      pulso. Se prefiere entre 80 y 170 bpm: una canción a 180 se juega a
//      90 igual de bien, y una a 60 a 120 se siente viva.
//   3. pulsos: programación dinámica (Ellis, 2007). Cada pulso cae donde hay
//      flujo, pero castigando alejarse del período. Así sigue a un baterista
//      que acelera un poco sin saltar a cada platillo suelto.
//   4. el "uno" del compás: de las cuatro fases posibles, la que junta más
//      graves en sus pulsos.
//
// Todo en el teléfono: el audio no sale de ahí.

import { programarLuces } from "./compositor.js";
import { generarMapa } from "./mapa.js";

const SR = 11025;
const N = 1024, SALTO = 128;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const esperar = () => new Promise(r => setTimeout(r, 0));

function decodificar(ctx, datos) {
  // Safari viejo sólo tiene la forma con callbacks.
  return new Promise((ok, mal) => {
    const p = ctx.decodeAudioData(datos, ok, mal);
    if (p && p.then) p.then(ok, mal);
  });
}

/** Envolvente de ataques en tres bandas, una muestra cada SALTO/SR s. */
async function flujo(mono, progreso, sr = SR) {
  const cuadros = Math.max(1, Math.floor((mono.length - N) / SALTO));
  const bajo = new Float32Array(cuadros), medio = new Float32Array(cuadros), alto = new Float32Array(cuadros), energia = new Float32Array(cuadros);
  const ventana = new Float32Array(N);
  for (let i = 0; i < N; i++) ventana[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const re = new Float32Array(N), im = new Float32Array(N);
  let previo = new Float32Array(N / 2), actual = new Float32Array(N / 2);
  const binHz = sr / N;
  const b1 = Math.round(180 / binHz), b2 = Math.round(1800 / binHz), b3 = Math.round(5000 / binHz);
  for (let c = 0; c < cuadros; c++) {
    const o = c * SALTO;
    let e = 0;
    for (let i = 0; i < N; i++) { const x = mono[o + i]; re[i] = x * ventana[i]; im[i] = 0; e += x * x; }
    energia[c] = Math.sqrt(e / N);
    fft(re, im);
    let fb = 0, fm = 0, fa = 0;
    for (let k = 1; k < N / 2; k++) {
      const m = Math.log1p(100 * Math.hypot(re[k], im[k]));
      actual[k] = m;
      const d = m - previo[k];
      if (d > 0) { if (k < b1) fb += d; else if (k < b2) fm += d; else if (k < b3) fa += d; }
    }
    bajo[c] = fb; medio[c] = fm; alto[c] = fa;
    const t = previo; previo = actual; actual = t;
    if (c % 2000 === 0) { progreso && progreso(`Escuchando… ${Math.round(c / cuadros * 100)}%`); await esperar(); }
  }
  return { bajo, medio, alto, energia, cuadros, dt: SALTO / sr };
}

/** Resta el promedio local (0,4 s) y normaliza: queda sólo lo que "salta". */
function realzar(x, dt) {
  const n = x.length, v = Math.max(1, Math.round(0.4 / dt));
  const out = new Float32Array(n);
  let suma = 0;
  const pref = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { suma += x[i]; pref[i + 1] = suma; }
  let max = 1e-9;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - v), b = Math.min(n, i + v);
    const media = (pref[b] - pref[a]) / (b - a);
    out[i] = Math.max(0, x[i] - media);
    if (out[i] > max) max = out[i];
  }
  // Normaliza por un percentil alto, no por el máximo: un solo golpe enorme
  // (el platillo del final) no tiene que aplastar el resto.
  const orden = Array.from(out).sort((a, b) => a - b);
  const p = orden[Math.floor(n * 0.985)] || max;
  for (let i = 0; i < n; i++) out[i] = Math.min(1.5, out[i] / (p || 1));
  return out;
}

function estimarTempo(o, dt) {
  const minL = Math.round(60 / 200 / dt), maxL = Math.round(60 / 60 / dt);
  const n = o.length;
  let mejor = 0, mejorL = minL;
  const puntaje = [];
  for (let L = minL; L <= maxL; L++) {
    let s = 0;
    for (let i = L; i < n; i++) s += o[i] * o[i - L];
    s /= (n - L);
    const bpm = 60 / (L * dt);
    // Preferencia por el rango jugable (una campana en escala logarítmica).
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 125) / 0.9, 2));
    puntaje[L] = s * w;
    if (s * w > mejor) { mejor = s * w; mejorL = L; }
  }
  // Refinado parabólico alrededor del pico.
  const a = puntaje[mejorL - 1] || 0, b = puntaje[mejorL], c = puntaje[mejorL + 1] || 0;
  const d = (a - 2 * b + c) ? 0.5 * (a - c) / (a - 2 * b + c) : 0;
  let periodo = (mejorL + Math.max(-0.5, Math.min(0.5, d))) * dt;
  let bpm = 60 / periodo;
  while (bpm > 170) { bpm /= 2; periodo *= 2; }
  while (bpm < 80) { bpm *= 2; periodo /= 2; }
  return { bpm, periodo };
}

/** Pulsos por programación dinámica. Devuelve los tiempos en segundos. */
function seguirPulsos(o, dt, periodo) {
  const n = o.length, P = periodo / dt;
  const puntaje = new Float32Array(n), previo = new Int32Array(n).fill(-1);
  const alfa = 120;
  for (let i = 0; i < n; i++) {
    let mejor = -1e9, arg = -1;
    const desde = Math.max(0, Math.round(i - 2 * P)), hasta = Math.round(i - P / 2);
    for (let j = desde; j <= hasta; j++) {
      const r = Math.log((i - j) / P);
      const s = puntaje[j] - alfa * r * r;
      if (s > mejor) { mejor = s; arg = j; }
    }
    puntaje[i] = o[i] + (arg >= 0 ? mejor : 0);
    previo[i] = arg;
  }
  // El final: el mejor puntaje en el último período.
  let fin = n - 1, m = -1e9;
  for (let i = Math.max(0, n - Math.round(P)); i < n; i++) if (puntaje[i] > m) { m = puntaje[i]; fin = i; }
  const pulsos = [];
  for (let i = fin; i >= 0; i = previo[i]) pulsos.push(i * dt);
  return pulsos.reverse();
}

export async function analizarArchivo(archivo, ctx, progreso) {
  progreso && progreso("Decodificando…");
  const datos = await archivo.arrayBuffer();
  const buffer = await decodificar(ctx, datos);
  const factor = Math.max(1, Math.round(buffer.sampleRate / SR));
  const srReal = buffer.sampleRate / factor;
  const n = Math.floor(buffer.length / factor);
  const mono = new Float32Array(n);
  const canales = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) canales.push(buffer.getChannelData(c));
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) for (const ch of canales) s += ch[i * factor + k];
    mono[i] = s / (factor * canales.length);
  }
  await esperar();
  const f = await flujo(mono, progreso, srReal);
  const dt = (SALTO / srReal);
  progreso && progreso("Buscando el pulso…");
  await esperar();
  const oB = realzar(f.bajo, dt), oM = realzar(f.medio, dt), oA = realzar(f.alto, dt);
  const total = new Float32Array(f.cuadros);
  for (let i = 0; i < f.cuadros; i++) total[i] = oB[i] * 1.1 + oM[i] + oA[i] * 0.6;
  const { bpm, periodo } = estimarTempo(total, dt);
  await esperar();
  const pulsos = seguirPulsos(total, dt, periodo);
  const valor = (arr, t) => { const i = Math.round(t / dt); let m = 0; for (let k = i - 2; k <= i + 2; k++) if (arr[k] > m) m = arr[k]; return m; };

  // El "uno": la fase de cuatro que junta más graves.
  let fase = 0, mfase = -1;
  for (let p = 0; p < 4; p++) {
    let s = 0;
    for (let i = p; i < pulsos.length; i += 4) s += valor(oB, pulsos[i]);
    if (s > mfase) { mfase = s; fase = p; }
  }

  // Intensidad por compás (energía suavizada, relativa a la canción).
  const energiaEn = (a, b) => { let s = 0, c = 0; for (let i = Math.floor(a / dt); i < Math.min(f.cuadros, b / dt); i++) { s += f.energia[i]; c++; } return c ? s / c : 0; };
  const compases = [];
  for (let i = fase; i + 4 < pulsos.length; i += 4) compases.push({ t: pulsos[i], fin: pulsos[i + 4], e: energiaEn(pulsos[i], pulsos[i + 4]) });
  const orden = compases.map(c => c.e).sort((a, b) => a - b);
  const q = (x) => orden.length ? orden[Math.min(orden.length - 1, Math.floor(orden.length * x))] : 0;
  const bajoE = q(0.3), altoE = q(0.72);
  // Secciones: tramos de 4 compases con el mismo "piso" de energía.
  const secciones = [];
  for (let i = 0; i < compases.length; i += 4) {
    const grupo = compases.slice(i, i + 4);
    const e = grupo.reduce((a, c) => a + c.e, 0) / grupo.length;
    const tipo = e >= altoE ? "coro" : e <= bajoE ? (i === 0 ? "intro" : "puente") : "verso";
    const intensidad = Math.max(0.2, Math.min(1, (e - q(0.05)) / Math.max(1e-6, q(0.95) - q(0.05))));
    const previa = secciones[secciones.length - 1];
    if (previa && previa.tipo === tipo) { previa.fin = grupo[grupo.length - 1].fin; previa.intensidad = (previa.intensidad + intensidad) / 2; }
    else secciones.push({ t: grupo[0].t, fin: grupo[grupo.length - 1].fin, tipo, nombre: tipo, intensidad });
  }
  if (!secciones.length) secciones.push({ t: 0, fin: buffer.duration, tipo: "verso", nombre: "verso", intensidad: 0.6 });
  secciones[0].t = 0;
  secciones[secciones.length - 1].fin = buffer.duration;

  // Pistas: cada pulso, cada corchea y cada semicorchea que tengan ataque.
  const pistas = [], golpes = [];
  const sube = (t, p, bajo, med, alto) => {
    if (bajo > 0.5) { pistas.push({ t, tipo: "bombo", fuerza: Math.min(1, bajo), pos16: p }); golpes.push({ t, f: "bombo" }); }
    if (med > 0.55) { pistas.push({ t, tipo: "caja", fuerza: Math.min(1, med), pos16: p }); golpes.push({ t, f: "caja" }); }
    if (alto > 0.6) pistas.push({ t, tipo: "hat", fuerza: Math.min(1, alto), pos16: p });
  };
  for (let i = 0; i + 1 < pulsos.length; i++) {
    const a = pulsos[i], b = pulsos[i + 1];
    const enCompas = ((i - fase) % 4 + 4) % 4;
    for (let s = 0; s < 4; s++) {
      const t = a + (b - a) * s / 4;
      const p = enCompas * 4 + s;
      const fuerzaBase = s === 0 ? 1 : s === 2 ? 0.7 : 0.45;
      sube(t, p, valor(oB, t) * fuerzaBase * 1.2, valor(oM, t) * fuerzaBase, valor(oA, t) * fuerzaBase);
      if (s === 0) pistas.push({ t, tipo: "bajo", fuerza: 0.5 + valor(total, t) * 0.3, pos16: p });
    }
  }
  // Platillo al entrar a cada sección con más fuerza que la anterior.
  for (let i = 1; i < secciones.length; i++) {
    if (secciones[i].intensidad > secciones[i - 1].intensidad + 0.15) { pistas.push({ t: secciones[i].t, tipo: "platillo", fuerza: 1.3, pos16: 0 }); golpes.push({ t: secciones[i].t, f: "platillo" }); }
  }
  pistas.sort((a, b) => a.t - b.t);
  golpes.sort((a, b) => a.t - b.t);

  // Luces: la misma coreografía de las canciones propias, sobre lo detectado.
  const luces = [], giros = [];
  const luz = (t, g, m, c = 3, fz = 1) => luces.push({ t, g, m, c, f: fz });
  const paso = periodo / 4;
  for (const s of secciones) {
    programarLuces({ ...s, compases: Math.max(1, Math.round((s.fin - s.t) / (periodo * 4))) }, 0, null, golpes, luz, giros, s.t, s.fin, paso);
  }

  const titulo = (archivo.name || "Tu canción").replace(/\.[^.]+$/, "").slice(0, 60);
  const cancion = {
    id: "tuya", titulo, autor: "tu archivo", bpm, duracion: buffer.duration, negra: periodo, arranque: pulsos[fase] || 0,
    pistas, letra: [], luces, giros, secciones, buffer, sinRecord: true, pulsos,
  };
  cancion.mapaPropio = (dif) => generarMapa(cancion, dif);
  progreso && progreso("Listo.");
  return cancion;
}

// Para las pruebas: el mismo análisis sobre un AudioBuffer ya armado.
export { flujo as _flujo, estimarTempo as _estimarTempo, seguirPulsos as _seguirPulsos, realzar as _realzar };
