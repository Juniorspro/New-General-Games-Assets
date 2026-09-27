// BARRER LAS PERILLAS DE LAS MANOS (vuelta 38): cada variante es js/manos.js con unas constantes cambiadas; corre
// herramientas/manos-lento.mjs (5 semillas) y manos-video.mjs con los videos de quien pide (si están en
// pruebas/salida, que no se sube) y da una línea por variante, de a 4 a la vez.
//     cd aeroplaza && printf '%s\n' '{} base' '{"P_GIRO.beta":0,"P_GIRO.corte":3} g' | node herramientas/barrer-manos.mjs
//   las claves: "C_PISO" (una constante), "P_GIRO.beta" (un campo de un objeto), "media.rl" (un campo de ese nivel
//   en SUAVIDAD) y "media.giro.beta" (su pose). OJO: medio y suaves tienen su pose (el giro y los dedos), que manda
//   sobre P_GIRO y P_DEDOS: esos solo cambian rápidas. SUAVE=rapida|media|suave y P=4 (cuántas a la vez), al entorno.
// La línea: giro (grados atrás girando) y su p95, dedo (ms), fino y paso (ms a la mitad), lado (ms atrás a 5/10 cm/s y
// de costado), golpe (ms y mm que se pasa), tiemblaL; por video: v (ver), f (forma), c (centro), p (patadas por minuto),
// g (bamboleo del giro quieta/siempre, grados), d (de los dedos quieta, mm), l (del centro de costado), z (profundidad).
// La copia tiene que estar en js/ (por los import): js/_v-<nombre>.js, y se borra al terminar.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const VIDEOS = ['manos-video', 'video1-60', 'video2-60'].filter((v) => fs.existsSync(`pruebas/salida/${v}.json`));
function variante(cambios, nombre) {
  let s = fs.readFileSync('js/manos.js', 'utf8');
  for (const [k, v] of Object.entries(cambios)) {
    const antes = s;
    const partes = k.split('.'), nivel = ['media', 'suave', 'rapida'].includes(partes[0]);
    if (nivel && partes.length === 3) {
      /* (media.giro.beta: dentro de la pose de ese nivel, en el renglón de abajo) */
      const [obj, sub, campo] = partes;
      s = s.replace(new RegExp(`(\\n  ${obj}: \\{[^\\n]*\\n[^\\n]*?\\b${sub}: \\{[^}]*?\\b${campo}: )(-?[0-9.e-]+)`), `$1${v}`);
    } else if (partes.length === 2) {
      const [obj, campo] = partes;
      const re = nivel ? new RegExp(`(\\n  ${obj}: \\{[^\\n]*(?:\\n    [^\\n]*)??\\b${campo}: )(-?[0-9.e-]+)`) : new RegExp(`(${obj} = \\{[^}]*?\\b${campo}: )(-?[0-9.e-]+)`);
      s = s.replace(re, `$1${v}`);
    } else s = s.replace(new RegExp(`(\\b${k} = )(-?[0-9.e-]+)`), `$1${v}`);
    if (s === antes && !new RegExp(`\\b${k.split('.').pop()}(: | = )${v}\\b`).test(s)) throw new Error('no encontré ' + k);
  }
  const f = `js/_v-${nombre}.js`; fs.writeFileSync(f, s); return f;
}
function medir(f, nombre) {
  const L = JSON.parse(execFileSync('node', ['herramientas/manos-lento.mjs', f], { env: { ...process.env, CORTO: '1', SEMILLAS: '1,2,3,4,5' }, encoding: 'utf8' }).trim().split('\n').pop());
  const out = { n: nombre, giro: L.giro, giroP95: L.giroP95, dedo: L.dedo, fino: L.finoMitad, paso: L.pasoMitad, lado: `${L.atraso5}/${L.atraso10}/${L.atrasoLado}`, golpe: `${L.golpeMitad}/${L.golpePasa}`, tiemblaL: L.tiembla };
  for (const v of VIDEOS) {
    const V = JSON.parse(execFileSync('node', ['herramientas/manos-video.mjs', 'medir', `pruebas/salida/${v}.json`, f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop());
    out[v] = `v${V.ver} f${V.forma} c${V.centro} p${V.patadas} g${V.vibGiroQ}/${V.vibGiro} d${V.vibDoblanQ} l${V.vibQ} z${V.vibZQ}`;
  }
  return out;
}
/* (una variante sola, en su propio proceso: node barrer-manos.mjs --una '{json}' nombre) */
if (process.argv[2] === '--una') {
  const f = variante(JSON.parse(process.argv[3]), process.argv[4]);
  try { console.log(JSON.stringify(medir(f, process.argv[4]))); } finally { fs.rmSync(f, { force: true }); }
  process.exit(0);
}
const lineas = fs.readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.lastIndexOf(' '); return [l.slice(0, i), l.slice(i + 1)]; });
const P = +(process.env.P || 4); let i = 0;
const uno = () => new Promise((ok) => {
  if (i >= lineas.length) return ok();
  const [j, n] = lineas[i++], c = spawn('node', [path.join(path.dirname(new URL(import.meta.url).pathname), 'barrer-manos.mjs'), '--una', j, n], { stdio: ['ignore', 'pipe', 'pipe'] });
  let o = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', (d) => (o += d)); c.on('close', () => { process.stdout.write(o); uno().then(ok); });
});
await Promise.all(Array.from({ length: P }, uno));
