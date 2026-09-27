// QUE NO SE CIERRE AL ENTRAR AL ARCORE (vuelta 41), y si se cierra, que diga por qué:
// 1) Java (android/…/Choque.java, pruebas/choque/PruebaChoque.java): el informe de un choque nativo (el tombstone),
//    de un ANR y de una excepción de Java, en una línea;
// 2) lo que cerraba la app, en el código: los sensores de la cabeza pedidos a más de 200 por segundo (en una APK
//    depurable, Android 12+ tira SecurityException), en el hilo de la interfaz, y la cabeza dentro del arranque de ARCore;
//    y la WebView que se cae sin onRenderProcessGone (Android cierra la app entera);
// 3) el juego: si la APK dice que se cerró (AeroplazaNativo.choque), un aviso fijo y largo, en los tres idiomas.
//     node pruebas/choque.mjs   (sin javac, la parte 1 no corre)
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI);
const JAVA = path.join(RAIZ, 'android/app/src/main/java/ar/aeroplaza');

/* 1) Java */
let hayJava = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch { hayJava = false; }
if (hayJava) {
  const CL = path.join(SAL, 'choque-clases'); fs.rmSync(CL, { recursive: true, force: true }); fs.mkdirSync(CL, { recursive: true });
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', CL, path.join(JAVA, 'Choque.java'), path.join(AQUI, 'choque/PruebaChoque.java')], { stdio: 'inherit' });
  let sal = '';
  try { sal = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', CL, 'ar.aeroplaza.PruebaChoque'], { encoding: 'utf8' }); } catch (e) { sal = String(e.stdout || ''); }
  for (const l of sal.split('\n')) { if (/^✓/.test(l)) { bien++; console.log(l); } else if (/^✗/.test(l)) { mal++; console.log(l); } else if (/^\s+\(/.test(l)) console.log(l); }
} else console.log('(sin javac: la parte de Java no corre)');

/* 2) el código */
const cab = fs.readFileSync(path.join(JAVA, 'Cabeza.java'), 'utf8'), ar = fs.readFileSync(path.join(JAVA, 'Ar.java'), 'utf8'), act = fs.readFileSync(path.join(JAVA, 'MainActivity.java'), 'utf8');
const regs = [...cab.matchAll(/(?<!un)registerListener\(([^)]*)\)/g)].map((m) => m[1]);
const periodo = +(/PERIODO_US\s*=\s*(\d+)/.exec(cab)?.[1] || 0);
prueba('los sensores de la cabeza, a 200 por segundo como mucho (no SENSOR_DELAY_FASTEST) y en su hilo',
  regs.length >= 2 && regs.every((r) => /PERIODO_US, h$/.test(r.trim())) && periodo >= 5000 && !/SENSOR_DELAY_FASTEST\)/.test(cab) && /new HandlerThread\(/.test(cab), `${regs.length} registros · ${periodo} µs`);
const ini = ar.slice(ar.indexOf('String iniciar('), ar.indexOf('static double campo('));
const iTry = ini.indexOf('} catch (Throwable t) {'), iCab = ini.indexOf('cabeza.prender()');
prueba('la cabeza se prende después del arranque de ARCore, fuera de su try (si falla, ARCore sigue)', iTry > 0 && iCab > iTry, '');
prueba('si el arranque falla, suelta la cámara (pausa la sesión)', /catch \(Throwable t\) \{\s*corriendo = false;[\s\S]{0,400}sesion\.pause\(\)/.test(ini), '');
prueba('la WebView caída no cierra la app (onRenderProcessGone arma otra)', /onRenderProcessGone[\s\S]{0,1200}crearWeb\(\)[\s\S]{0,80}return true;/.test(act), '');
prueba('anota el choque de Java y lee el de Android (ApplicationExitInfo)', /setDefaultUncaughtExceptionHandler/.test(act) && /getHistoricalProcessExitReasons/.test(act) && /public String choque\(\)/.test(act), '');

/* 3) el juego */
const nav = await navegador();
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
await pag.addInitScript(() => {
  window.__llamadas = 0;
  window.AeroplazaNativo = {
    version: () => '1', arEstado: () => 'si', arIniciar: () => {}, arParar: () => {}, arManos: () => {}, flash: () => {}, vibrar: () => {},
    /* (como la APK: lo da una sola vez) */
    choque: () => (window.__llamadas++ ? '' : '[ARCore] CRASH_NATIVE · 2 min · SIGSEGV SEGV_MAPERR · [GLThread 812] · null pointer dereference · libarcore_c.so ArSession_update · libarcore_sdk_jni.so Java_com_google_ar_core_Session_nativeUpdate'),
  };
});
await pag.reload();
await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await avanzar(pag, 5, 1 / 30, false);
const v = await pag.evaluate(() => {
  const n = document.querySelector('.notis .noti.larga'); if (!n) return null;
  const s = n.querySelector('.noti-txt span'), r = s.getBoundingClientRect();
  return { t: n.querySelector('b')?.textContent, x: s.textContent, alto: r.height, lleno: s.scrollHeight <= s.clientHeight + 1, dentro: r.right <= innerWidth + 1 && r.left >= -1 };
});
prueba('sale el aviso de que se cerró, con todo lo que dijo la APK', !!v && /se cerró/.test(v.t) && /CRASH_NATIVE/.test(v.x) && /libarcore_sdk_jni\.so/.test(v.x), v ? v.t : 'sin aviso');
prueba('entero (sin cortar en dos renglones) y adentro de la pantalla', !!v && v.lleno && v.dentro && v.alto > 30, v ? `${v.alto.toFixed(0)} px de alto` : '');
const r = await pag.evaluate(async () => {
  const { UI } = window.__A;
  UI.avisar('🎁 otro aviso'); await new Promise((r) => setTimeout(r, 50));
  const ns = [...document.querySelectorAll('.notis .noti')].filter((n) => !n.classList.contains('sale'));
  await new Promise((r) => setTimeout(r, 7500));
  const sigue = !!document.querySelector('.notis .noti.larga:not(.sale)');
  return { n: ns.length, primero: ns[0]?.classList.contains('larga'), sigue, llamadas: window.__llamadas };
});
prueba('otro aviso no lo saca (va abajo) y dura más que los comunes', r.n === 2 && r.primero && r.sigue, JSON.stringify(r));
prueba('se lo pide a la APK una sola vez', r.llamadas === 1, `${r.llamadas}`);
const idiomas = await pag.evaluate(async () => {
  const { t, ponerIdioma } = window.__A.textos;
  const antes = document.documentElement.lang || 'es', o = {};
  for (const i of ['es', 'en', 'pt']) { ponerIdioma(i); o[i] = t('noti_choque'); }
  ponerIdioma(antes); return o;
});
prueba('en los tres idiomas', !!idiomas && idiomas.es !== idiomas.en && idiomas.en !== idiomas.pt && Object.values(idiomas).every((x) => x && x !== 'noti_choque'), JSON.stringify(idiomas));
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
