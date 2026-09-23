/* ============================================================================
   brillo/trailer/audio.js — la banda de sonido del tráiler: la música de BRILLO
   hecha con su propio sintetizador (js/sonido.js) en un OfflineAudioContext,
   más los efectos que el juego pidió en cada toma, en el pedazo que usa cada
   plano. Sigue el mismo guion que Remotion (guion.js), así los golpes caen en
   los cortes. Sale un WAV (48 kHz, estéreo, 16 bits).   ?idioma=es

   El sintetizador empieza un tema 0,4 s después de pedirlo, así que el guion
   lo pide 0,4 s antes del compás. Para poder pedirlo antes del primer cuadro
   se hace un preámbulo que después se corta.
   Ojo: todo se programa antes de renderizar, así que cancelScheduledValues
   se pide desde `ahora`. Con 0 borraba también las subidas de antes (el
   gancho entero sonaba a 0,0001 porque el corte de la historia le borró la
   entrada).
   ========================================================================== */
import { Sonido } from '../js/sonido.js';
import { tiempos, TOMAS } from './guion.js';

const q = new URLSearchParams(location.search);
const IDI = q.get('idioma') || 'es';
const PRE = 1;
const log = (...a) => console.log('[tráiler]', ...a);

async function hacer() {
  const leer = async (u) => (await fetch(u)).json();
  const comun = await leer('/brillo/trailer/remotion/public/tomas/comun.json');
  const datos = await leer(`/brillo/trailer/remotion/public/tomas/${IDI}.json`);
  const { planos, total } = tiempos();
  const dur = total / 30;
  /* las indicaciones de cada plano (relativas a su inicio) y lo que pidió el juego en el pedazo de toma que usa */
  const marcas = [];
  for (const P of planos) {
    for (const m of P.musica || []) marcas.push({ ...m, t: P.inicioS + m.t });
    const son = (TOMAS[P.toma].porIdioma ? datos.sonidos : comun.sonidos)[P.toma] || [];
    if (!q.has('soloMusica')) for (const s of son) if (s.t >= P.desde && s.t < P.desde + P.largoS) marcas.push({ t: P.inicioS + s.t - P.desde, sfx: s.n, o: s.o });
  }
  marcas.sort((a, b) => a.t - b.t);
  const fr = 48000, off = new OfflineAudioContext(2, Math.ceil(fr * (PRE + dur + 0.5)), fr);
  let ahora = 0;
  Object.defineProperty(off, 'currentTime', { get: () => ahora });
  window.AudioContext = function () { return off; };
  window.setTimeout = () => 0;      // las limpiezas de nodos del juego no hacen falta acá
  Sonido.iniciar(); Sonido.volumenes(0.85, 0.5);
  /* el tema entra de una en el compás, no de a poco */
  /* también el filtro y la reverb van directo a su valor: el sintetizador los abre de a poco (medio
     segundo de constante) y al arrancar el tráiler el gancho sonaba apagado */
  const golpe = () => {
    if (!Sonido.actual) return;
    const T = Sonido.actual.T, G = Sonido.actual.g.gain, chip = Sonido.modo === 'chip', v = (T.vol || 1) * (chip ? 1.15 : 1);
    G.cancelScheduledValues(ahora); G.setValueAtTime(0.0001, ahora); G.linearRampToValueAtTime(v, ahora + 0.38);
    const F = Sonido.filtro && Sonido.filtro.frequency; if (F) { F.cancelScheduledValues(ahora); F.setValueAtTime(T.filtro || 9000, ahora); }
    const R = Sonido.revIn && Sonido.revIn.gain; if (R) { R.cancelScheduledValues(ahora); R.setValueAtTime((T.reverb ?? 0.4) * (chip ? 0.3 : 1), ahora); }
  };
  let apagar = null;
  for (let k = 0; ahora < PRE + dur + 0.5; ahora += 0.01) {
    while (k < marcas.length && marcas[k].t + PRE <= ahora) {
      const m = marcas[k++];
      if (m.musica !== undefined) { Sonido.musica(m.musica); if (m.golpe) golpe(); }
      else if (m.modo) { Sonido.ponerModo(m.modo); golpe(); }
      else if (m.corte) {
        /* la música se corta de golpe (el glitch de la Actualización) */
        const A = Sonido.actual;
        Sonido.musica(null);
        if (A) { const G = A.g.gain; G.cancelScheduledValues(ahora); G.setValueAtTime(A.T.vol || 1, ahora); G.linearRampToValueAtTime(0.0001, ahora + 0.03); }
      } else if (m.apagar) apagar = { t: m.t, d: m.apagar };
      else if (m.sfx) Sonido.sfx(m.sfx, m.o || {});
    }
    Sonido.pasar();
  }
  ahora = 0;
  const buf = await off.startRendering();
  /* se corta el preámbulo, el final se apaga, y a 16 bits */
  const n = Math.round(dur * fr), o = Math.round(PRE * fr), wav = new DataView(new ArrayBuffer(44 + n * 4));
  const txt = (p, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(p + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); txt(8, 'WAVE'); txt(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
  wav.setUint32(24, fr, true); wav.setUint32(28, fr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); txt(36, 'data'); wav.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let pico = 0;
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(L[o + i]), Math.abs(R[o + i]));
  const norma = pico > 0.98 ? 0.98 / pico : 1;
  for (let i = 0; i < n; i++) {
    const t = i / fr;
    let v = Math.min(1, t / 0.01) * norma;
    if (apagar && t > apagar.t) v *= Math.max(0, 1 - (t - apagar.t) / apagar.d);
    wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[o + i] * v)) * 32767, true);
    wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[o + i] * v)) * 32767, true);
  }
  await fetch(`/guardar?carpeta=audio&nombre=${IDI}${q.has('soloMusica') ? '-musica' : ''}.wav`, { method: 'POST', body: wav.buffer });
  log(`música lista: ${dur.toFixed(1)} s, pico ${pico.toFixed(2)}, ${marcas.length} marcas`);
  return { ok: true, segundos: dur };
}
hacer().then((r) => { window.__terminado = r; }).catch((e) => { log('FALLÓ', e && (e.stack || e.message || e)); window.__terminado = { error: String(e && e.message) }; });
