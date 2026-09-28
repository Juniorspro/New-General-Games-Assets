// LAS ACTUALIZACIONES SIN APK NUEVA (vuelta 45): Actualizacion.java, main.js › cancionesDeLaApp y actualizar.js.
// - Java (Actualizacion.java con javac): de dónde se puede bajar, cuándo conviene, lo bajado entero, el aviso;
// - el juego servido por http como en la APK (el aviso de la APK adelante, las canciones sueltas al lado, en
//   canciones/): registra las canciones que hay (y no las que tienen un nombre raro) y suena la pedida;
// - los avisos: "se actualizó" una vez por versión, "hay una versión nueva" cuando se bajó, y la ventana para bajar
//   una APK nueva (abre el enlace).
//     node pruebas/actualizar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { navegador, AQUI, SAL, avanzar } from './comun.mjs';
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const RAIZ = path.join(AQUI, '..');

/* 1) Java */
let hayJava = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch { hayJava = false; }
if (hayJava) {
  const CL = path.join(SAL, 'actualizar-clases'); fs.rmSync(CL, { recursive: true, force: true }); fs.mkdirSync(CL, { recursive: true });
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', CL, path.join(RAIZ, 'android/app/src/main/java/ar/aeroplaza/Actualizacion.java'), path.join(AQUI, 'actualizar/PruebaActualizacion.java')], { stdio: ['ignore', 'ignore', 'inherit'] });
  let sal = '';
  try { sal = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', CL, 'ar.aeroplaza.PruebaActualizacion'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { sal = String(e.stdout || ''); }
  for (const l of sal.split('\n')) { if (/^✓/.test(l)) { bien++; console.log(l); } else if (/^✗/.test(l)) { mal++; console.log(l); } }
} else console.log('(sin javac: la parte de Java no corre)');

/* 2) la carpeta como la arma la APK (herramientas/apk.mjs): el juego con el aviso y las canciones sueltas */
const W = path.join(SAL, 'apk-web'); fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(path.join(W, 'canciones'), { recursive: true });
fs.writeFileSync(path.join(W, 'aeroplaza.html'), fs.readFileSync(path.join(RAIZ, 'aeroplaza.html'), 'utf8').replace('<head>', '<head>\n<script>window.AEROPLAZA_APK=true;</script>'));
const todas = {};
for (const dir of [path.join(RAIZ, '..', 'brillo/musica'), path.join(RAIZ, 'musica-ajena')]) {
  const j = path.join(dir, 'canciones.json'); if (!fs.existsSync(j)) continue;
  for (const [tema, c] of Object.entries(JSON.parse(fs.readFileSync(j, 'utf8')))) { const f = path.join(dir, c.archivo); if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(W, 'canciones', c.archivo)); todas[tema] = c; } }
}
const hayMp3 = Object.keys(todas).length;
todas.raro = { archivo: '../aeroplaza.html', bucle: [0, 1] };   // (un nombre que se sale de la carpeta: no se pide)
fs.writeFileSync(path.join(W, 'canciones', 'canciones.json'), JSON.stringify(todas));
const srv = spawn('python3', ['-m', 'http.server', '8793', '-d', W], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const nav = await navegador();
const ctx = await nav.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  window.__enlaces = [];
  window.AeroplazaNativo = { version: () => '1', arEstado: () => 'no', arParar() {}, flash() {}, vibrar() {}, mandos: () => '', mandoVR() {},
    juego: () => JSON.stringify({ n: 3, bajada: true, estado: 'al-dia', apk: 45, nApk: 1 }), abrirEnlace: (u) => window.__enlaces.push(u) };
});
await ctx.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, (r) => r.abort());
const pag = await ctx.newPage(); const errores = [];
pag.on('pageerror', (e) => errores.push(e.message)); pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
const abrir = async () => {
  await pag.goto('http://localhost:8793/aeroplaza.html?directo&pausa&calidad=baja');
  await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
};
await abrir();
await pag.waitForFunction((n) => Object.keys(window.__A.Sonido.grabadas).length >= n, hayMp3, { timeout: 30000, polling: 200 }).catch(() => {});
await avanzar(pag, 3, 1 / 30, false);
const c = await pag.evaluate(() => { const A = window.__A; return { temas: Object.keys(A.Sonido.grabadas).sort(), bytes: Object.values(A.Sonido.grabadas).every((g) => g.datos && g.datos.length > 10000), sonando: A.J.sonando, pedida: A.J._pedida }; });
prueba(`las canciones sueltas de la APK se registran (${hayMp3}), y la de nombre raro no`, hayMp3 > 0 && c.temas.length === hayMp3 && !c.temas.includes('raro') && c.bytes, JSON.stringify(c.temas));
prueba('y suena la que se había pedido', !!c.sonando && c.temas.includes(c.sonando), JSON.stringify({ sonando: c.sonando, pedida: c.pedida }));

/* 3) los avisos (esperan 6 s después de que haya juego, para no taparse con el regalo del día) */
await pag.waitForTimeout(9000); await avanzar(pag, 2, 1 / 30, false);
const notis = () => pag.evaluate(() => [...document.querySelectorAll('.notis > *')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
const n1 = await notis();
prueba('al abrir con una versión bajada: "AEROPLAZA se actualizó · Versión 3"', /se actualizó/.test(n1) && /Versión 3/.test(n1), n1.slice(0, 160));
await abrir(); await pag.waitForTimeout(9000); await avanzar(pag, 2, 1 / 30, false);
const n2 = await notis();
prueba('y una sola vez por versión (al volver a abrir, no)', !/se actualizó/.test(n2), n2.slice(0, 160));
await pag.evaluate(() => window.__nativo.actualizacion('lista', 4, 'El mando VR Box')); await pag.waitForTimeout(6500);
const n3 = await notis();
prueba('cuando termina de bajar otra: "Hay una versión nueva", con lo que cambió', /Hay una versión nueva/.test(n3) && /mando VR Box/.test(n3) && /próxima vez/.test(n3), n3.slice(0, 200));
const v = await pag.evaluate(async () => {
  window.__nativo.actualizacion('apk', 46, 'Cambió la cámara', 'https://jxstudios.pages.dev/app/aeroplaza.apk'); await new Promise((r) => setTimeout(r, 6500));
  const V = window.__A.UI.ventanaAbierta, titulo = V?.querySelector('h2')?.textContent, texto = V?.querySelector('.cuerpo p')?.textContent;
  V?.querySelector('[data-a=bajar]')?.click(); await new Promise((r) => setTimeout(r, 100));
  return { titulo, texto, enlaces: window.__enlaces, cerro: !window.__A.UI.ventanaAbierta };
});
prueba('si hace falta una APK nueva: la ventana, y "Bajar la app" abre el enlace', /app nueva/.test(v.titulo || '') && /Cambió la cámara/.test(v.texto || '') && v.enlaces.join() === 'https://jxstudios.pages.dev/app/aeroplaza.apk' && v.cerro, JSON.stringify(v));

/* 4) (vuelta 46) con la APK 46, que puede usar ya lo bajado: en el menú se usa solo; en el juego, tocando el aviso; y en
   Opciones › Datos, la versión y "Buscar ahora" */
const ctx2 = await nav.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await ctx2.addInitScript(() => {
  window.__aplicar = 0; window.__buscar = 0;
  window.AeroplazaNativo = { version: () => '1', arEstado: () => 'no', arParar() {}, flash() {}, vibrar() {}, mandos: () => '', mandoVR() {}, abrirEnlace() {},
    juego: () => JSON.stringify({ n: 3, bajada: true, estado: 'al-dia', apk: 46, nApk: 3, listo: false, aplicar: true }),
    aplicarActualizacion: () => { window.__aplicar++; return true; }, buscarActualizacion: () => { window.__buscar++; } };
});
await ctx2.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, (r) => r.abort());
const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => errores.push(e.message));
await p2.goto('http://localhost:8793/aeroplaza.html?calidad=baja');
await p2.waitForFunction(() => window.__A && window.__A.UI && window.__A.UI.J, null, { timeout: 120000, polling: 250 });
const enMenu = await p2.evaluate(() => { const en = window.__A.J.enJuego; window.__nativo.actualizacion('lista', 4, 'El celu'); return { en, aplicar: window.__aplicar }; });
prueba('APK 46, en el menú: lo bajado se usa ya (sin cerrar la app)', enMenu.en === false && enMenu.aplicar === 1, JSON.stringify(enMenu));
await p2.goto('http://localhost:8793/aeroplaza.html?directo&pausa&calidad=baja');
await p2.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
await p2.evaluate(() => { window.__aplicar = 0; window.__nativo.actualizacion('lista', 4, 'El celu'); });
await p2.waitForTimeout(6800);
const toca = await p2.evaluate(() => { const n = [...document.querySelectorAll('.notis .noti')].find((q) => /versión nueva/.test(q.textContent)); const txt = n?.textContent || ''; n?.querySelector('.noti-txt')?.click(); return { txt, antes: 0, aplicar: window.__aplicar }; });
prueba('en el juego: el aviso dice que se toca para usarla ya, y tocarlo la usa', /Tocá acá/.test(toca.txt) && toca.aplicar === 1, JSON.stringify(toca).slice(0, 200));
const datos = await p2.evaluate(async () => {
  const { UI } = window.__A; UI.opciones(() => {}, 'datos'); await new Promise((r) => setTimeout(r, 200));
  const f = [...document.querySelectorAll('.ventana .op')].find((q) => /Versión del juego/.test(q.textContent));
  const txt = f?.textContent.replace(/\s+/g, ' ').trim() || '';
  const b = f && [...f.querySelectorAll('button')].find((q) => /Buscar ahora/.test(q.textContent)); b?.click();
  return { txt, despues: f?.querySelector('small')?.textContent, buscar: window.__buscar };
});
prueba('Opciones › Datos: la versión que corre ("3 · APK 46 · al día") y "Buscar ahora"', /3 · APK 46 · al día/.test(datos.txt) && datos.buscar === 1 && /buscando/.test(datos.despues || ''), JSON.stringify(datos));
await ctx2.close();
const errs = errores.filter((e) => !/ERR_FAILED|ERR_CERT|net::/.test(e));
prueba('sin errores en la página', !errs.length, errs.slice(0, 3).join(' | '));
await nav.close(); srv.kill();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
