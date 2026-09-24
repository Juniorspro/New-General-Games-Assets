// La música y los efectos de la cinemática, renderizados sin parlantes: se
// cambia el AudioContext por uno offline, se programa la cinemática entera y
// sale un WAV para escuchar, más la sonoridad, los picos y cuánto suena cada
// medio segundo (así se ve si los golpes caen en los cortes).
//     node pruebas/musica.mjs   → pruebas/salida/musica.wav y musica.png (espectrograma)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { servir, navegador } from './servidor.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
const s = await servir(path.join(AQUI, '..'));
const nav = await navegador();
const pag = await nav.newPage();
const errores = [];
pag.on('pageerror', (e) => errores.push(e.message));
await pag.goto(`${s.url}/pruebas/ver.html`);
const b64 = await pag.evaluate(async () => {
  const { crearMusica } = await import('/js/musica.js');
  const SR = 44100, off = new OfflineAudioContext(2, SR * 19, SR);
  off.resume = async () => {};
  window.AudioContext = function () { return off; };
  const m = crearMusica();
  await m.iniciar(0);
  const buf = await off.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const pcm = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) { pcm[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
  const bytes = new Uint8Array(pcm.buffer); let t = '';
  for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(t);
});
await nav.close(); s.cerrar();
if (errores.length) console.log('ERRORES:', errores.join('\n'));

const datos = Buffer.from(b64, 'base64');
const cab = Buffer.alloc(44);
cab.write('RIFF', 0); cab.writeUInt32LE(36 + datos.length, 4); cab.write('WAVE', 8); cab.write('fmt ', 12);
cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(2, 22); cab.writeUInt32LE(44100, 24);
cab.writeUInt32LE(44100 * 4, 28); cab.writeUInt16LE(4, 32); cab.writeUInt16LE(16, 34); cab.write('data', 36); cab.writeUInt32LE(datos.length, 40);
const wav = path.join(SAL, 'musica.wav');
fs.writeFileSync(wav, Buffer.concat([cab, datos]));

// cuánto suena cada medio segundo (RMS en dB) y el pico
const n = datos.length / 4; let pico = 0;
const filas = [];
for (let b = 0; b < 38; b++) {
  let sum = 0, cnt = 0;
  for (let i = b * 22050; i < Math.min(n, (b + 1) * 22050); i++) { const v = datos.readInt16LE(i * 4) / 32768; sum += v * v; cnt++; pico = Math.max(pico, Math.abs(v)); }
  const db = 10 * Math.log10(sum / Math.max(1, cnt) + 1e-12);
  filas.push(`${(b * 0.5).toFixed(1).padStart(4)} s ${db.toFixed(1).padStart(6)} dB ${'#'.repeat(Math.max(0, Math.round((db + 50) / 1.5)))}`);
}
console.log(filas.join('\n'));
console.log(`pico ${(20 * Math.log10(pico)).toFixed(2)} dBFS`);
const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
console.log(r.stderr.split('Summary:')[1]?.trim().replace(/\n\s*\n/g, '\n') || r.stderr.slice(-800));
spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-lavfi', 'showspectrumpic=s=1520x500:legend=1:scale=log:fscale=log', path.join(SAL, 'musica.png')]);
console.log('listo: pruebas/salida/musica.wav y musica.png');
