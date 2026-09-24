/* ============================================================================
   videos/musica.js — la música de un juego del motor 2D (LUZ MALA, ZONDA),
   hecha con su propio sintetizador (motor2d/sonido.js) en un
   OfflineAudioContext. Sale un WAV de 48 kHz para los videos.
   ?scripts=motor2d/base.js,motor2d/sonido.js,luz-mala/js/musica.js
   &marcas=[[0,"pueblo"],[30,"jefe"]] &seg=62 &nombre=luz-mala
   También KUNTUR (kuntur/js/sonido.js es un módulo: iniciar/pasar en vez de
   arrancar/programar): ?scripts=kuntur/js/sonido.js&modulo=1
   ========================================================================== */
const q = new URLSearchParams(location.search);
const log = (...a) => console.log('[música]', ...a);
const cargar = (src) => new Promise((ok, mal) => { const s = document.createElement('script'); s.src = '/' + src; s.onload = ok; s.onerror = () => mal(new Error('no cargó ' + src)); document.head.append(s); });

async function hacer() {
  const seg = +q.get('seg'), marcas = JSON.parse(q.get('marcas')), fr = 48000;
  const off = new OfflineAudioContext(2, Math.ceil(fr * seg), fr);
  let ahora = 0;
  Object.defineProperty(off, 'currentTime', { get: () => ahora });
  window.AudioContext = function () { return off; };
  /* el reloj lo maneja este archivo; los de verdad se devuelven al terminar (Playwright los usa
     para preguntar si ya está: sin ellos, waitForFunction no vuelve a mirar nunca) */
  const reales = [window.setInterval, window.setTimeout];
  window.setInterval = () => 0; window.setTimeout = () => 0;
  let S;
  if (q.get('modulo')) S = (await import('/' + q.get('scripts'))).Sonido;
  else { for (const s of q.get('scripts').split(',')) await cargar(s); S = window.Sonido || eval('Sonido'); }
  (S.arrancar || S.iniciar).call(S);
  const programar = S.programar || S.pasar;
  let k = 0;
  for (; ahora < seg; ahora += 0.01) {
    while (k < marcas.length && marcas[k][0] <= ahora) S.musica(marcas[k++][1]);
    programar.call(S);
  }
  ahora = 0;
  [window.setInterval, window.setTimeout] = reales;
  const buf = await off.startRendering();
  const n = buf.length, wav = new DataView(new ArrayBuffer(44 + n * 4));
  const txt = (p, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(p + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); wav.setUint32(4, 36 + n * 4, true); txt(8, 'WAVE'); txt(12, 'fmt '); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
  wav.setUint32(24, fr, true); wav.setUint32(28, fr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true); txt(36, 'data'); wav.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  for (let i = 0; i < n; i++) { wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  await fetch(`/guardar?nombre=${q.get('nombre')}.wav`, { method: 'POST', body: wav.buffer });
  log('lista', seg, 's');
  return { ok: true };
}
hacer().then((r) => { window.__terminado = r; }).catch((e) => { log('FALLÓ', e.stack || e.message); window.__terminado = { error: String(e.message) }; });
