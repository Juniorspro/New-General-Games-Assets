// Arma la APK: dist/ (armar.mjs) en android/app/src/main/assets, el ícono (icono.py) y Gradle (firma de
// prueba, ~/.android/debug.keystore). Sale en pruebas/salida/pizza-delivery.apk.   ANDROID_HOME=… node herramientas/apk.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const AQUI = path.dirname(new URL(import.meta.url).pathname), AND = path.join(AQUI, '../android');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk || !fs.existsSync(sdk)) { console.log('falta el SDK de Android: ANDROID_HOME=/ruta'); process.exit(1); }
fs.writeFileSync(path.join(AND, 'local.properties'), `sdk.dir=${sdk}\n`);
execFileSync('node', [path.join(AQUI, 'armar.mjs')], { stdio: 'inherit' });
execFileSync('python3', [path.join(AQUI, 'icono.py')], { stdio: 'inherit' });
const A = path.join(AND, 'app/src/main/assets');
fs.rmSync(A, { recursive: true, force: true });
fs.cpSync(path.join(AQUI, '../dist'), A, { recursive: true });
const gradle = fs.existsSync('/opt/gradle/bin/gradle') ? '/opt/gradle/bin/gradle' : 'gradle';
execFileSync(gradle, ['-p', AND, '--no-daemon', '-q', '--max-workers=2', 'assembleDebug'], { stdio: 'inherit', env: { ...process.env, ANDROID_HOME: sdk } });
const dest = path.join(AQUI, '../pruebas/salida/pizza-delivery.apk');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(path.join(AND, 'app/build/outputs/apk/debug/app-debug.apk'), dest);
console.log(`${dest}: ${(fs.statSync(dest).size / 1048576).toFixed(1)} MB`);
