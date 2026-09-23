// Revisa un video del tráiler con el ffprobe y el ffmpeg que trae Remotion: códecs, tamaño,
// duración, que el audio suene (volumen medio y pico) y saca cuadros sueltos como PNG para mirarlos.
//     node brillo/trailer/verificar.mjs <video.mp4> [segundos,separados,por,coma] [carpeta]
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const BIN = path.join(AQUI, 'remotion/node_modules/@remotion/compositor-linux-x64-gnu');
const [archivo, tiempos = '1,5', carpeta] = process.argv.slice(2);
if (!archivo) { console.log('uso: node verificar.mjs <video.mp4> [s1,s2] [carpeta]'); process.exit(1); }
const video = path.resolve(archivo);
const dir = carpeta ? path.resolve(carpeta) : path.dirname(video);
const correr = (bin, args) => execFileSync(path.join(BIN, bin), args, { env: { ...process.env, LD_LIBRARY_PATH: BIN }, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

const info = JSON.parse(correr('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video]));
const v = info.streams.find((s) => s.codec_type === 'video'), a = info.streams.find((s) => s.codec_type === 'audio');
console.log(JSON.stringify({
  duracion: +(+info.format.duration).toFixed(2), mb: +(info.format.size / 1048576).toFixed(1), kbps: Math.round(info.format.bit_rate / 1000),
  video: v && { codec: v.codec_name, perfil: v.profile, ancho: v.width, alto: v.height, fps: v.r_frame_rate, pixeles: v.pix_fmt, cuadros: +v.nb_frames },
  audio: a ? { codec: a.codec_name, hz: +a.sample_rate, canales: a.channels } : null,
}));
if (a) {
  /* volumedetect escribe en stderr: con execFileSync hay que pedirlo aparte */
  const r = (() => { try { return execFileSync(path.join(BIN, 'ffmpeg'), ['-hide_banner', '-i', video, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { env: { ...process.env, LD_LIBRARY_PATH: BIN }, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { return e; } })();
  const txt = String(r.stderr || '');
  console.log('audio:', (txt.match(/mean_volume: [^\n]+/) || ['sin datos'])[0], '·', (txt.match(/max_volume: [^\n]+/) || [''])[0]);
}
fs.mkdirSync(dir, { recursive: true });
for (const t of tiempos.split(',').map(Number)) {
  const dest = path.join(dir, `${path.basename(video, path.extname(video))}-${String(t).replace('.', '_')}.png`);
  correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(t), '-i', video, '-frames:v', '1', dest]);
  console.log('cuadro', t, '→', dest);
}
