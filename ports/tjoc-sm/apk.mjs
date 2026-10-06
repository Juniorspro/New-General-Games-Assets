// Arma la APK: dist/ (node armar.mjs) sin las páginas de prueba, con datos/ copiado de verdad (en dist es un
// enlace), en android/app/src/main/assets, y Gradle (firma de prueba, ~/.android/debug.keystore).
// Sale en salida/tjoc-sm.apk.     node apk.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const AQUI = path.dirname(new URL(import.meta.url).pathname), AND = path.join(AQUI, 'android');
const sdk = process.env.ANDROID_HOME || path.join(AQUI, '..', 'android-sdk');
fs.writeFileSync(path.join(AND, 'local.properties'), `sdk.dir=${sdk}\n`);
execFileSync('node', [path.join(AQUI, 'armar.mjs')], { stdio: 'inherit' });
const A = path.join(AND, 'app/src/main/assets');
fs.rmSync(A, { recursive: true, force: true });
fs.cpSync(path.join(AQUI, 'dist'), A, { recursive: true, dereference: true, filter: (f) => !/[\\/](prueba|ver)\.(html|js)$/.test(f) });
const gradle = fs.existsSync('/opt/gradle/bin/gradle') ? '/opt/gradle/bin/gradle' : 'gradle';
execFileSync(gradle, ['-p', AND, '--no-daemon', '-q', '--max-workers=2', 'assembleDebug'], { stdio: 'inherit', env: { ...process.env, ANDROID_HOME: sdk } });
const dest = path.join(AQUI, 'salida/tjoc-sm.apk');
fs.copyFileSync(path.join(AND, 'app/build/outputs/apk/debug/app-debug.apk'), dest);
console.log(`${dest}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`);
