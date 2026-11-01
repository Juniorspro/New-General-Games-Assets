// Quema el zócalo en un video: la misma página de OBS, cuadro por cuadro.
//
//   python3 herramientas/descargable/empaquetar.py zocalo/index.html /tmp/zocalo.html
//   node zocalo/quemar.mjs --html /tmp/zocalo.html --video entrada.mp4 --salida salida.mp4 \
//        --titulo "Escándalo diputado libertario in fraganti" --hora 20:36 --entra 0.8
//
// Se usa el HTML empaquetado y no zocalo/index.html: ese es el que tiene
// doctype, charset y el reset del body, o sea lo mismo que ve OBS. Probar con
// la página suelta dio medidas corridas 8 px (el margen del body).
//
// Por qué cuadro por cuadro y no grabando la pantalla: la grabación de
// Playwright no tiene canal alfa, y sin alfa no hay cómo ponerlo arriba del
// video. Acá cada cuadro es un PNG transparente: se pausan todas las
// animaciones y se las lleva a mano al instante justo (Web Animations).
//
// Cuántas capturas hacen falta: una en blanco para antes de que entre, las de
// la entrada, y UN ciclo del punto que late (1,2 s). El resto de los ~2.000
// cuadros son enlaces a esos mismos archivos, que no ocupan nada.
//
// Necesita: Playwright (está global: `npm root -g`) y un ffmpeg con libx264
// (`pip install imageio-ffmpeg` trae uno; el de /opt/pw-browsers no decodifica
// H.264).

import { createRequire } from "module";
import { execFileSync, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || path.join(execSync("npm root -g").toString().trim(), "playwright"));

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, l) => (v.startsWith("--") ? [...a, [v.slice(2), l[i + 1]]] : a), []));
for (const k of ["html", "video", "salida"]) if (!args[k]) { console.error(`falta --${k}`); process.exit(1); }
const ENTRA = Number(args.entra ?? 0.8);        // segundos de video antes de que entre
const LATIDO = 1.2;                             // igual a la animación "latido" del CSS

const ffmpeg = process.env.FFMPEG
  || execSync(`python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`).toString().trim();

// Tamaño, duración y cuadros por segundo del video, leídos de ffmpeg.
let info = "";
try { execFileSync(ffmpeg, ["-hide_banner", "-i", args.video], { stdio: "pipe" }); } catch (e) { info = e.stderr.toString(); }
const [, w, h] = info.match(/Video:.*?(\d{2,5})x(\d{2,5})/) || [];
const [, hh, mm, ss] = info.match(/Duration: (\d+):(\d+):([\d.]+)/) || [];
const fps = Math.round(Number((info.match(/(\d+(?:\.\d+)?) fps/) || [])[1] || 30));
if (!w || !hh) { console.error("no se pudo leer el video:\n" + info); process.exit(1); }
const duracion = Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
const total = Math.ceil(duracion * fps);
console.log(`video: ${w}x${h}, ${duracion.toFixed(2)} s, ${fps} fps → ${total} cuadros`);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zocalo-"));
const html = fs.readFileSync(args.html, "utf8");
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errores = [];
pagina.on("pageerror", (e) => errores.push(e.message));
await pagina.route("**/*", (r) => (r.request().url().startsWith("http://zocalo.local")
  ? r.fulfill({ contentType: "text/html", body: html })
  : r.abort()));
await pagina.goto("http://zocalo.local/#obs");
await pagina.evaluate(async ({ titulo, hora, volanta }) => {
  await document.fonts.ready;
  const o = {};
  if (titulo) o.titulo = titulo;
  if (volanta) o.volanta = volanta;
  window.zocalo.configurar(o);
  if (hora) window.zocalo.fijarHora(hora);
  window.zocalo.entrar();
}, { titulo: args.titulo, hora: args.hora, volanta: args.volanta });

// Cuánto dura la entrada, medido de las animaciones y no copiado del CSS.
const finEntrada = await pagina.evaluate(() => Math.max(...document.getAnimations()
  .filter((a) => a.effect.getTiming().iterations !== Infinity)
  .map((a) => { const t = a.effect.getComputedTiming(); return t.endTime; })) / 1000);

const cuadro = async (t, archivo) => {
  await pagina.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), t * 1000);
  await pagina.screenshot({ path: path.join(dir, archivo), omitBackground: true });
};

await cuadro(0, "vacio.png");
const nEntrada = Math.ceil(finEntrada * fps);
for (let i = 0; i < nEntrada; i++) await cuadro(i / fps, `entrada-${i}.png`);
const nLatido = Math.round(LATIDO * fps);
for (let j = 0; j < nLatido; j++) await cuadro(finEntrada + j / fps, `latido-${j}.png`);
await navegador.close();
if (errores.length) { console.error("errores en la página: " + errores.join(" | ")); process.exit(1); }

// La secuencia completa, con enlaces.
const antes = Math.round(ENTRA * fps);
for (let n = 0; n < total; n++) {
  const k = n - antes;
  const origen = k < 0 ? "vacio.png" : k < nEntrada ? `entrada-${k}.png` : `latido-${(k - nEntrada) % nLatido}.png`;
  fs.symlinkSync(origen, path.join(dir, `f${String(n).padStart(6, "0")}.png`));
}
console.log(`capturas: ${1 + nEntrada + nLatido} (entrada ${finEntrada.toFixed(2)} s), secuencia de ${total}`);

// El audio va tal cual (-c:a copy): recomprimirlo solo pierde calidad.
execFileSync(ffmpeg, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-i", args.video,
  "-framerate", String(fps), "-i", path.join(dir, "f%06d.png"),
  "-filter_complex", "[0:v][1:v]overlay=0:0:eof_action=repeat[v]",
  "-map", "[v]", "-map", "0:a?",
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
  "-c:a", "copy", "-movflags", "+faststart",
  args.salida,
], { stdio: "inherit" });
fs.rmSync(dir, { recursive: true, force: true });
console.log(`listo: ${args.salida} (${(fs.statSync(args.salida).size / 1048576).toFixed(1)} MB)`);
