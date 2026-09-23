/* ============================================================================
   brillo/trailer/audio.js — la banda de sonido del tráiler: la música de BRILLO
   hecha con su propio sintetizador (js/sonido.js) en un OfflineAudioContext,
   más los efectos que el juego pidió en cada toma, en su momento. Sigue el
   mismo guion que Remotion (guion.js), así los golpes caen en los cortes.
   Sale un WAV (48 kHz, estéreo, 16 bits) para Remotion.   ?idioma=es
   ========================================================================== */
import { Sonido } from '../js/sonido.js';
import { tiempos } from './guion.js';

const q = new URLSearchParams(location.search);
const IDI = q.get('idioma') || 'es';
const log = (...a) => console.log('[tráiler]', ...a);

async function hacer() {
  const leer = async (u) => (await fetch(u)).json();
  const comun = await leer('/brillo/trailer/remotion/public/tomas/comun.json');
  const datos = await leer(`/brillo/trailer/remotion/public/tomas/${IDI}.json`);
  const { escenas, total } = tiempos(datos.medidas);
  const dur = total / 30;
  /* las indicaciones de cada escena (relativas a su inicio) y lo que pidió el juego en su toma */
  const marcas = [];
  for (const E of escenas) {
    for (const m of E.musica || []) marcas.push({ ...m, t: Math.max(0, E.inicioS + m.t) });
    const son = (E.toma.porIdioma ? datos.sonidos : comun.sonidos)[E.id] || [];
    const hasta = E.visible / 30;
    for (const s of son) if (s.t < hasta) marcas.push({ t: E.inicioS + s.t, sfx: s.n, o: s.o });
  }
  marcas.sort((a, b) => a.t - b.t);
  const fr = 48000, off = new OfflineAudioContext(2, Math.ceil(fr * (dur + 0.5)), fr);
  let ahora = 0;
  Object.defineProperty(off, 'currentTime', { get: () => ahora });
  window.AudioContext = function () { return off; };
  window.setTimeout = () => 0;      // las limpiezas de nodos del juego no hacen falta acá
  Sonido.iniciar(); Sonido.volumenes(0.85, 0.5);
  let apagar = null;
  for (let k = 0; ahora < dur + 0.5; ahora += 0.01) {
    while (k < marcas.length && marcas[k].t <= ahora) {
      const m = marcas[k++];
      if (m.musica !== undefined) {
        Sonido.musica(m.musica);
        /* el golpe del logo: el tema entra de una, no de a poco */
        if (m.golpe && Sonido.actual) { const G = Sonido.actual.g.gain, v = Sonido.actual.T.vol || 1; G.cancelScheduledValues(0); G.setValueAtTime(0.0001, ahora); G.linearRampToValueAtTime(v, ahora + 0.38); }
      } else if (m.modo) Sonido.ponerModo(m.modo);
      else if (m.apagar) apagar = { t: m.t, d: m.apagar };
      else if (m.sfx) Sonido.sfx(m.sfx, m.o || {});
    }
    Sonido.pasar();
  }
  ahora = 0;
  const buf = await off.startRendering();
  /* entrada suave, el final que se apaga, y a 16 bits */
  const n = Math.round(dur * fr), wav = new DataView(new ArrayBuffer(44 + n * 4));
  const txt = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); txt(8, 'WAVE'); txt(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
  wav.setUint32(24, fr, true); wav.setUint32(28, fr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); txt(36, 'data'); wav.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let pico = 0;
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i]));
  const norma = pico > 0.98 ? 0.98 / pico : 1;
  for (let i = 0; i < n; i++) {
    const t = i / fr;
    let v = Math.min(1, t / 0.4) * norma;
    if (apagar && t > apagar.t) v *= Math.max(0, 1 - (t - apagar.t) / apagar.d);
    wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i] * v)) * 32767, true);
    wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i] * v)) * 32767, true);
  }
  await fetch(`/guardar?carpeta=audio&nombre=${IDI}.wav`, { method: 'POST', body: wav.buffer });
  log(`música lista: ${dur.toFixed(1)} s, pico ${pico.toFixed(2)}, ${marcas.length} marcas`);
  return { ok: true, segundos: dur };
}
hacer().then((r) => { window.__terminado = r; }).catch((e) => { log('FALLÓ', e && (e.stack || e.message || e)); window.__terminado = { error: String(e && e.message) }; });
