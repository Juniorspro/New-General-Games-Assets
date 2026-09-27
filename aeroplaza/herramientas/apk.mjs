// node herramientas/apk.mjs [--canciones] [--release]
// Arma la APK de AEROPLAZA (android/): el juego de siempre en una WebView, con ARCore y las manos de
// MediaPipe de Android. Pone en android/app/src/main/assets (no se guarda en el repo):
// - aeroplaza.html (o aeroplaza-con-canciones.html con --canciones: esa APK es solo para quien pide,
//   NO se sube), con el aviso de que corre en la APK y MediaPipe de la web servido desde adentro;
// - MediaPipe (pruebas/comun.mjs › mediapipe: la web para cuando no hay ARCore, y el modelo, que usan
//   las dos).
// El SDK de Android: ANDROID_HOME (o --sdk=…). Sale en pruebas/salida/aeroplaza[-con-canciones].apk,
// firmada con la llave de prueba de Gradle (~/.android/debug.keystore, fuera del repo).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mediapipe } from '../pruebas/comun.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI), AND = path.join(RAIZ, 'android');
const args = process.argv.slice(2), canciones = args.includes('--canciones'), release = args.includes('--release');
const sdk = (args.find((a) => a.startsWith('--sdk=')) || '').slice(6) || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk || !fs.existsSync(sdk)) { console.log('falta el SDK de Android: ANDROID_HOME=/ruta o --sdk=/ruta'); process.exit(1); }
fs.writeFileSync(path.join(AND, 'local.properties'), `sdk.dir=${sdk}\n`);

/* el juego, armado */
execFileSync('node', [path.join(AQUI, 'armar.mjs')], { stdio: 'inherit' });
const html = path.join(RAIZ, canciones ? 'aeroplaza-con-canciones.html' : 'aeroplaza.html');
const A = path.join(AND, 'app/src/main/assets');
fs.rmSync(A, { recursive: true, force: true }); fs.mkdirSync(path.join(A, 'mediapipe/wasm'), { recursive: true });
const BASE = 'https://appassets.androidplatform.net/assets/mediapipe';
const aviso = `<script>window.AEROPLAZA_APK=true;window.AEROPLAZA_MANOS=Object.assign({base:'${BASE}',modelo:'${BASE}/hand_landmarker.task'},window.AEROPLAZA_MANOS||{});</script>`;
fs.writeFileSync(path.join(A, 'aeroplaza.html'), fs.readFileSync(html, 'utf8').replace('<head>', '<head>\n' + aviso));
const mp = mediapipe();
for (const f of ['vision_bundle.mjs', 'wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.wasm', 'hand_landmarker.task']) fs.copyFileSync(path.join(mp, f), path.join(A, 'mediapipe', f));

/* Gradle (el de /opt/gradle, o el que haya en el PATH) */
const gradle = fs.existsSync('/opt/gradle/bin/gradle') ? '/opt/gradle/bin/gradle' : 'gradle';
execFileSync(gradle, ['-p', AND, '--no-daemon', '-q', '--max-workers=2', release ? 'assembleRelease' : 'assembleDebug'], { stdio: 'inherit', env: { ...process.env, ANDROID_HOME: sdk } });
const sal = path.join(AND, 'app/build/outputs/apk', release ? 'release/app-release-unsigned.apk' : 'debug/app-debug.apk');
const dest = path.join(RAIZ, 'pruebas/salida', canciones ? 'aeroplaza-con-canciones.apk' : 'aeroplaza.apk');
fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(sal, dest);
console.log(`${path.relative(process.cwd(), dest)}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`);
