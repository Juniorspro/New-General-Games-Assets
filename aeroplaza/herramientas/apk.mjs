// node herramientas/apk.mjs [--canciones] [--wasm] [--release]
// Arma la APK de AEROPLAZA (android/): el juego de siempre en una WebView, con ARCore y las manos de
// MediaPipe de Android. Pone en android/app/src/main/assets (no se guarda en el repo):
// - aeroplaza.html, con el aviso de que corre en la APK y MediaPipe de la web servido desde adentro. Es el
//   mismo del repo (sin canciones): así las actualizaciones (vuelta 45, Actualizador.java) lo reemplazan igual;
// - con --canciones, las canciones sueltas en canciones/ (MP3 y canciones.json): el juego las pide al arrancar
//   (main.js › cancionesDeLaApp). Esa APK es solo para quien pide, NO se sube;
// - aviso.txt (lo que se le agrega al juego, también al bajado), version.txt (el número del aviso de
//   actualizacion.json cuando se armó) y sha.txt (el sha256 del juego sin el aviso: para no bajar el mismo);
// - el modelo de las manos (pruebas/comun.mjs › mediapipe), y con --wasm MediaPipe de la web (para
//   cuando no hay ARCore; si no, se baja de internet).
// El SDK de Android: ANDROID_HOME (o --sdk=…). Sale en pruebas/salida/aeroplaza[-con-canciones].apk,
// firmada con la llave de prueba de Gradle (~/.android/debug.keystore, fuera del repo).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mediapipe } from '../pruebas/comun.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI), AND = path.join(RAIZ, 'android');
const args = process.argv.slice(2), canciones = args.includes('--canciones'), release = args.includes('--release'), conWasm = args.includes('--wasm');
const sdk = (args.find((a) => a.startsWith('--sdk=')) || '').slice(6) || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk || !fs.existsSync(sdk)) { console.log('falta el SDK de Android: ANDROID_HOME=/ruta o --sdk=/ruta'); process.exit(1); }
fs.writeFileSync(path.join(AND, 'local.properties'), `sdk.dir=${sdk}\n`);

/* el juego, armado */
execFileSync('node', [path.join(AQUI, 'armar.mjs')], { stdio: 'inherit' });
const html = path.join(RAIZ, 'aeroplaza.html');
const A = path.join(AND, 'app/src/main/assets');
fs.rmSync(A, { recursive: true, force: true }); fs.mkdirSync(path.join(A, 'mediapipe/wasm'), { recursive: true });
/* (el modelo de las manos va siempre: lo usan MediaPipe de Android y el de la web. MediaPipe de la web
   (12 MB) solo con --wasm: sirve cuando el celu no tiene ARCore, y si no está adentro se baja de
   internet; sin él la APK entra en los 30 MB que se pueden mandar) */
const BASE = 'https://appassets.androidplatform.net/assets/mediapipe';
const aviso = `<script>window.AEROPLAZA_APK=true;window.AEROPLAZA_MANOS=Object.assign({${conWasm ? `base:'${BASE}',` : ''}modelo:'${BASE}/hand_landmarker.task'},window.AEROPLAZA_MANOS||{});</script>`;
const base = fs.readFileSync(html);
fs.writeFileSync(path.join(A, 'aeroplaza.html'), base.toString('utf8').replace('<head>', '<head>\n' + aviso));
fs.writeFileSync(path.join(A, 'aviso.txt'), aviso);
fs.writeFileSync(path.join(A, 'sha.txt'), createHash('sha256').update(base).digest('hex'));
const AVISO = path.join(RAIZ, 'actualizacion.json');
fs.writeFileSync(path.join(A, 'version.txt'), String(fs.existsSync(AVISO) ? JSON.parse(fs.readFileSync(AVISO, 'utf8')).n || 0 : 0));
/* las canciones sueltas (las de musica/ y musica-ajena/, como armar.mjs): el juego las registra al arrancar */
if (canciones) {
  const C = path.join(A, 'canciones'); fs.mkdirSync(C, { recursive: true });
  const todas = {};
  for (const dir of [path.join(RAIZ, '..', 'brillo/musica'), path.join(RAIZ, 'musica-ajena')]) {
    const j = path.join(dir, 'canciones.json'); if (!fs.existsSync(j)) continue;
    for (const [tema, c] of Object.entries(JSON.parse(fs.readFileSync(j, 'utf8')))) {
      const f = path.join(dir, c.archivo); if (!fs.existsSync(f)) continue;
      fs.copyFileSync(f, path.join(C, c.archivo)); todas[tema] = c;
    }
  }
  fs.writeFileSync(path.join(C, 'canciones.json'), JSON.stringify(todas));
  console.log(`  canciones sueltas: ${Object.keys(todas).length}`);
}
const mp = mediapipe();
for (const f of ['hand_landmarker.task', ...(conWasm ? ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm'] : [])]) fs.copyFileSync(path.join(mp, f), path.join(A, 'mediapipe', f));

/* Gradle (el de /opt/gradle, o el que haya en el PATH) */
const gradle = fs.existsSync('/opt/gradle/bin/gradle') ? '/opt/gradle/bin/gradle' : 'gradle';
execFileSync(gradle, ['-p', AND, '--no-daemon', '-q', '--max-workers=2', release ? 'assembleRelease' : 'assembleDebug'], { stdio: 'inherit', env: { ...process.env, ANDROID_HOME: sdk } });
const sal = path.join(AND, 'app/build/outputs/apk', release ? 'release/app-release-unsigned.apk' : 'debug/app-debug.apk');
const dest = path.join(RAIZ, 'pruebas/salida', canciones ? 'aeroplaza-con-canciones.apk' : 'aeroplaza.apk');
fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(sal, dest);
console.log(`${path.relative(process.cwd(), dest)}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`);
