// Renderiza un video relatado con Remotion y le hace la pasada final con ffmpeg:
// BT.709 de rango limitado, voz y música a -14 LUFS, índice adelante, y una copia liviana
// de menos de 30 MiB para mandarla por el chat.
//     node videos/render.mjs <Composición> <id> [--cuadros=0-90]
//     node videos/render.mjs <Composición> <id> --sin-musica   → la misma imagen, solo voz y efectos
//       (para ponerle un sonido de TikTok desde la app); hace falta el render normal antes
//     node videos/render.mjs <Composición> <id> --rehacer=1880   → vuelve a dibujar desde ese cuadro hasta
//       el final y lo empalma en el video ya hecho (el sonido no se toca): para un arreglo al final
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const [comp, id, ...resto] = process.argv.slice(2);
const cuadros = (resto.find((a) => a.startsWith('--cuadros=')) || '').split('=')[1];
const SAL = path.join(AQUI, 'salida'); fs.mkdirSync(SAL, { recursive: true });
const crudo = path.join(SAL, `${id}.crudo.mp4`), dest = path.join(SAL, `${id}-tiktok.mp4`), liviano = path.join(SAL, `${id}-tiktok-liviano.mp4`);
const correr = (bin, args, o = {}) => { const r = spawnSync(bin, args, { stdio: 'inherit', ...o }); if (r.status !== 0) throw new Error(`${bin} terminó con ${r.status}`); };
const REMOTION = ['--public-dir=../medios', '--browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', '--gl=swangle'];
/* un pase de -14 LUFS en dos pasadas: se mide y se corrige lineal */
const nivel = (f) => {
  const med = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-vn', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const m = JSON.parse(med.slice(med.lastIndexOf('{'), med.lastIndexOf('}') + 1));
  return `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
};
const color = ['-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709'];
const aTV = 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p';
const hacerLiviano = () => {
  const pases = path.join(SAL, 'x264-' + id);
  const comun = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-b:v', '3600k', '-maxrate', '6000k', '-bufsize', '8000k', '-passlogfile', pases];
  correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', dest, ...comun, '-pass', '1', '-an', '-f', 'null', '/dev/null']);
  correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', dest, ...comun, '-pass', '2', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', ...color, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', liviano]);
  for (const f of fs.readdirSync(SAL)) if (f.startsWith('x264-' + id)) fs.unlinkSync(path.join(SAL, f));
};
const desde = (resto.find((a) => a.startsWith('--rehacer=')) || '').split('=')[1];
if (desde) {
  const tramo = path.join(SAL, `${id}.tramo.mp4`), nuevo = path.join(SAL, `${id}.empalme.mp4`);
  correr('npx', ['remotion', 'render', 'src/index.jsx', comp, tramo, `--props=${JSON.stringify({ id })}`, ...REMOTION, '--codec=h264', '--crf=14', '--muted', '--concurrency=3', `--frames=${desde}-`, '--log=info'], { cwd: path.join(AQUI, 'remotion') });
  correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', dest, '-i', tramo, '-filter_complex', `[0:v]trim=end_frame=${desde},setpts=PTS-STARTPTS[a];[1:v]${aTV},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]`,
    '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '17', '-profile:v', 'high', '-level', '4.2', ...color, '-c:a', 'copy', '-movflags', '+faststart', nuevo]);
  fs.renameSync(nuevo, dest); fs.unlinkSync(tramo);
  hacerLiviano();
  for (const f of [dest, liviano]) console.log(`listo ${path.relative(AQUI, f)} (${(fs.statSync(f).size / 1048576).toFixed(1)} MiB)`);
  process.exit(0);
}
if (resto.includes('--sin-musica')) {
  /* solo el sonido (Remotion no dibuja cuadros para un códec de audio) y se le pega a la imagen ya hecha */
  const voz = path.join(SAL, `${id}.voz.wav`);
  correr('npx', ['remotion', 'render', 'src/index.jsx', comp, voz, `--props=${JSON.stringify({ id, sinMusica: true })}`, ...REMOTION, '--codec=wav', '--log=info'], { cwd: path.join(AQUI, 'remotion') });
  const af = nivel(voz);
  for (const [imagen, kbps] of [[dest, '256k'], [liviano, '192k']]) {
    const f = imagen.replace('.mp4', '-sin-musica.mp4');
    correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', imagen, '-i', voz, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', af + ',apad', '-c:a', 'aac', '-b:a', kbps, '-shortest', '-movflags', '+faststart', f]);
    console.log(`listo ${path.relative(AQUI, f)} (${(fs.statSync(f).size / 1048576).toFixed(1)} MiB)`);
  }
  fs.unlinkSync(voz);
  process.exit(0);
}
correr('npx', ['remotion', 'render', 'src/index.jsx', comp, crudo, `--props=${JSON.stringify({ id })}`, ...REMOTION,
  '--codec=h264', '--crf=16', '--audio-codec=aac', '--audio-bitrate=256k', '--concurrency=3', '--log=info', ...(cuadros ? [`--frames=${cuadros}`] : [])], { cwd: path.join(AQUI, 'remotion') });
const audio = nivel(crudo);
correr('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', crudo, '-vf', aTV,
  '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '18', '-profile:v', 'high', '-level', '4.2', ...color,
  '-af', audio, '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', dest]);
hacerLiviano();
fs.unlinkSync(crudo);
for (const f of [dest, liviano]) console.log(`listo ${path.relative(AQUI, f)} (${(fs.statSync(f).size / 1048576).toFixed(1)} MiB)`);
