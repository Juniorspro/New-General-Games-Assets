// node herramientas/apk.mjs [--webp] [--sdk=/ruta]
// Arma la APK de CONTRAGOLPE (android/). Pone en android/app/src/main/assets (no se guarda en el repo):
// - index.html: el juego armado para la APK (armar.mjs --apk: 1,3 MB, sin base64 adentro);
// - a/…: los assets como archivos, con las texturas de materiales y el cielo en ETC2 (herramientas/etc2.py
//   las comprime la primera vez: hace falta python3 con PIL, g++ y git). Con --webp van también los webp
//   de esas texturas (los que se usan si falla una ETC2; sin ellos el juego descomprime la ETC2 él mismo).
// El SDK de Android: ANDROID_HOME (o --sdk=…). Sale en pruebas/salida/contragolpe.apk, firmada con la
// llave de prueba de Gradle (~/.android/debug.keystore, fuera del repo).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { armar } from './armar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI), AND = path.join(RAIZ, 'android');
const args = process.argv.slice(2), webp = args.includes('--webp');
const sdk = (args.find((a) => a.startsWith('--sdk=')) || '').slice(6) || process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk || !fs.existsSync(sdk)) { console.log('falta el SDK de Android: ANDROID_HOME=/ruta o --sdk=/ruta'); process.exit(1); }
fs.writeFileSync(path.join(AND, 'local.properties'), `sdk.dir=${sdk}\n`);

/* las texturas en ETC2 (sólo rehace las que cambiaron) y el juego para la APK */
execFileSync('python3', [path.join(AQUI, 'etc2.py')], { stdio: 'inherit' });
const { html, archivos } = armar({ apk: { webp } });
const A = path.join(AND, 'app/src/main/assets');
fs.rmSync(A, { recursive: true, force: true }); fs.mkdirSync(A, { recursive: true });
fs.writeFileSync(path.join(A, 'index.html'), html);
for (const [r, f] of archivos) { const d = path.join(A, r); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(f, d); }

/* Gradle (el de /opt/gradle, o el que haya en el PATH) */
const gradle = fs.existsSync('/opt/gradle/bin/gradle') ? '/opt/gradle/bin/gradle' : 'gradle';
execFileSync(gradle, ['-p', AND, '--no-daemon', '-q', '--max-workers=2', 'assembleDebug'], { stdio: 'inherit', env: { ...process.env, ANDROID_HOME: sdk } });
const dest = path.join(RAIZ, 'pruebas/salida/contragolpe.apk');
fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(AND, 'app/build/outputs/apk/debug/app-debug.apk'), dest);
console.log(`${path.relative(process.cwd(), dest)}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`);
