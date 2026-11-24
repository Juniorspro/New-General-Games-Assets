// Arma el video 9:16 para TikTok: fondo desenfocado, el video en el medio y
// la plantilla (intro, titular, marco, subtítulos) arriba.
//
//   python3 herramientas/descargable/empaquetar.py tiktok/index.html /tmp/tt.html
//   node tiktok/armar.mjs --html /tmp/tt.html --video entrada.mp4 --salida salida.mp4
//
// Tres capas, de abajo hacia arriba:
//   1. el mismo video agrandado hasta cubrir 1080×1920, desenfocado y
//      oscurecido (ffmpeg): el "relleno" de siempre, pero sin franjas negras;
//   2. el video entero, a 1080 de ancho, en y = 750 (ffmpeg);
//   3. la plantilla HTML con fondo transparente (Playwright), donde el hueco
//      del video queda vacío.
//
// La capa 3 no se captura cuadro por cuadro los 65 segundos. Durante la intro
// sí (se mueve todo), y después solo cuando cambia algo: cada palabra de los
// subtítulos y cada fin de bloque. Cada captura dura en pantalla hasta el
// próximo cambio (ffconcat con duración por imagen). Así son ~240 capturas y
// no ~2.000.
//
// Necesita Playwright (global: `npm root -g`) y un ffmpeg con libx264
// (`pip install imageio-ffmpeg`).

import { createRequire } from "module";
import { execFileSync, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || path.join(execSync("npm root -g").toString().trim(), "playwright"));

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, l) => (v.startsWith("--") ? [...a, [v.slice(2), l[i + 1]]] : a), []));
for (const k of ["html", "video", "salida"]) if (!args[k]) { console.error(`falta --${k}`); process.exit(1); }

const W = 1080, H = 1920, FPS = 30;
const Y_VIDEO = 750;                            // tiene que coincidir con .ranura del CSS

const ffmpeg = process.env.FFMPEG
  || execSync(`python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();
let info = "";
try { execFileSync(ffmpeg, ["-hide_banner", "-i", args.video], { stdio: "pipe" }); } catch (e) { info = e.stderr.toString(); }
const [, hh, mm, ss] = info.match(/Duration: (\d+):(\d+):([\d.]+)/) || [];
if (!hh) { console.error("no se pudo leer el video:\n" + info); process.exit(1); }
const duracion = Number(hh) * 3600 + Number(mm) * 60 + Number(ss);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tiktok-"));
const html = fs.readFileSync(args.html, "utf8");
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: W, height: H } });
const errores = [];
pagina.on("pageerror", (e) => errores.push(e.message));
await pagina.route("**/*", (r) => (r.request().url().startsWith("http://tiktok.local")
  ? r.fulfill({ contentType: "text/html", body: html })
  : r.abort()));
await pagina.goto("http://tiktok.local/#render");
await pagina.evaluate(() => document.fonts.ready);

// Hasta dónde llega la intro: el final de la última animación, medido.
const finIntro = await pagina.evaluate(() => Math.max(...document.getAnimations()
  .map((a) => a.effect.getComputedTiming().endTime)) / 1000);
const cortes = (await pagina.evaluate(() => window.tiktok.cortes())).filter((t) => t > finIntro && t < duracion);
const tiempos = [];
for (let i = 0; i / FPS < finIntro; i++) tiempos.push(i / FPS);
tiempos.push(finIntro, ...cortes);
console.log(`video: ${duracion.toFixed(2)} s · intro hasta ${finIntro.toFixed(2)} s · ${tiempos.length} capturas`);

let lista = "ffconcat version 1.0\n";
for (let i = 0; i < tiempos.length; i++) {
  const archivo = `e${String(i).padStart(4, "0")}.png`;
  await pagina.evaluate((t) => window.tiktok.tiempo(t), tiempos[i]);
  await pagina.screenshot({ path: path.join(dir, archivo), omitBackground: true });
  const hasta = i + 1 < tiempos.length ? tiempos[i + 1] : duracion;
  lista += `file '${archivo}'\nduration ${(hasta - tiempos[i]).toFixed(4)}\n`;
}
// El demuxer concat ignora la duración de la última imagen si no se repite.
lista += `file 'e${String(tiempos.length - 1).padStart(4, "0")}.png'\n`;
fs.writeFileSync(path.join(dir, "lista.txt"), lista);
await navegador.close();
if (errores.length) { console.error("errores en la página: " + errores.join(" | ")); process.exit(1); }

const filtro = [
  `[0:v]fps=${FPS},split=2[a][b]`,
  // El relleno: se agranda hasta cubrir el alto, se recorta al centro y se
  // desenfoca. Oscurecido apenas: los velos de la plantilla hacen el resto.
  `[a]scale=-2:${H},crop=${W}:${H},boxblur=24:3,eq=brightness=-0.10:saturation=1.3[fondo]`,
  `[b]scale=${W}:-2[video]`,
  `[fondo][video]overlay=0:${Y_VIDEO}[base]`,
  `[1:v]fps=${FPS},format=rgba[capa]`,
  // setsar=1: el escalado dejaba el píxel apenas no cuadrado (SAR 4096:4095,
  // medido). No se ve, pero hay plataformas que por eso reencuadran.
  `[base][capa]overlay=0:0:eof_action=repeat,setsar=1,format=yuv420p[v]`,
].join(";");

execFileSync(ffmpeg, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", args.video,
  "-f", "concat", "-safe", "0", "-i", path.join(dir, "lista.txt"),
  "-filter_complex", filtro,
  "-map", "[v]", "-map", "0:a?",
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", String(FPS),
  "-c:a", "copy", "-movflags", "+faststart", "-t", duracion.toFixed(3),
  args.salida,
], { stdio: "inherit" });
fs.rmSync(dir, { recursive: true, force: true });
console.log(`listo: ${args.salida} (${(fs.statSync(args.salida).size / 1048576).toFixed(1)} MB)`);
