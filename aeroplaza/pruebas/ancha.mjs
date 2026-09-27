// LA CÁMARA 0,5x EN TU ESPACIO (vuelta 42, "sobre todo la cámara debe usarse en 0.5x"), de punta a punta:
// 1) Java: qué camino elige para la ultra ancha (Ancha.java, como AngleCam: su número o el zoom < 1) con celus de
//    mentira (pruebas/ancha/PruebaAncha.java);
// 2) el juego, con un Android de mentira que tiene la 0,5x por zoom:
//    - al llegar a la pantalla la pide sola (y la vuelve a pedir mientras la cabeza no está alineada: 'espera');
//    - con la 0,5x, ARCore en pausa no manda poses y tu espacio sigue vivo con la cabeza nativa (el giroscopio);
//    - la foto ancha llega y se pone en el mundo, más grande (campo de 98°);
//    - el botón vuelve a 1x (y se guarda), escanear de nuevo y salir la apagan;
//    - con una APK vieja (sin camaraAncha) no hay botón ni pedidos.
//     node pruebas/ancha.mjs   (sin javac, la parte 1 no corre)
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';

let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const AQUI = path.dirname(new URL(import.meta.url).pathname), RAIZ = path.dirname(AQUI);

/* 1) Java */
let hayJava = true;
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch { hayJava = false; }
if (hayJava) {
  const CL = path.join(SAL, 'ancha-clases'); fs.rmSync(CL, { recursive: true, force: true }); fs.mkdirSync(CL, { recursive: true });
  execFileSync('javac', ['-encoding', 'UTF-8', '-d', CL, path.join(RAIZ, 'android/app/src/main/java/ar/aeroplaza/Ancha.java'), path.join(AQUI, 'ancha/PruebaAncha.java')], { stdio: 'inherit' });
  let sal = '';
  try { sal = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-cp', CL, 'ar.aeroplaza.PruebaAncha'], { encoding: 'utf8' }); } catch (e) { sal = String(e.stdout || ''); }
  for (const l of sal.split('\n')) { if (/^✓/.test(l)) { bien++; console.log(l); } else if (/^✗/.test(l)) { mal++; console.log(l); } else if (/^\s+\(/.test(l)) console.log(l); }
} else console.log('(sin javac: la parte de Java no corre)');

/* 2) el juego */
const nav = await navegador();
let jpeg = null;
async function pagina(conAncha) {
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 844, alto: 390, movil: true });
  /* (la foto de la cámara: un JPEG hecho en la página, servido donde lo pide el juego) */
  await ctx.route(/^https:\/\/appassets\.androidplatform\.net\/camara\//, (r) => r.fulfill({ body: jpeg, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' } }));
  await pag.addInitScript((conAncha) => {
    window.__llamadas = []; window.__cab = null; window.__alinear = 2;
    try { localStorage.removeItem('aeroplaza.ancha'); } catch { /* nada */ }
    const anota = (n) => (...a) => { window.__llamadas.push([n, ...a]); };
    window.AeroplazaNativo = {
      version: () => '1', arEstado: () => 'si',
      arIniciar: (m) => { window.__llamadas.push(['arIniciar', m]); setTimeout(() => window.__nativo?.estado('corre'), 30); },
      arParar: anota('arParar'), arManos: anota('arManos'), manosDos: anota('manosDos'), flash: anota('flash'), vibrar: anota('vibrar'),
      arEscanear: anota('arEscanear'), arPasante: anota('arPasante'), arOlvidar: anota('arOlvidar'), arProfundidad: anota('arProfundidad'),
      cabeza: () => (window.__cab ? window.__cab.join(',') : ''),
      ...(conAncha ? {
        camaraAncha: () => 'zoom 0 0.60 98 70',
        /* (como MainActivity: las primeras veces la cabeza todavía no está alineada) */
        espacioAncho: (si) => {
          window.__llamadas.push(['espacioAncho', si]);
          setTimeout(() => { if (!si) window.__nativo.estado('ancha apagada'); else if (window.__alinear-- > 0) window.__nativo.estado('ancha espera'); else { window.__nativo.estado('ancha lente zoom 0 0.60 98 70'); window.__nativo.estado('ancha corre'); } }, 5);
        },
      } : {}),
    };
  }, conAncha);
  await pag.reload();
  await pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
  if (!jpeg) jpeg = Buffer.from(await pag.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#c8b894'; g.fillRect(0, 0, 320, 240); g.fillStyle = '#3c6e8f'; g.fillRect(20, 40, 60, 80); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; }), 'base64');
  await avanzar(pag, 5, 1 / 30, false);
  /* a tu espacio, con ARCore mandando la pose, y directo a la pantalla */
  await pag.evaluate(async () => {
    const A = window.__A, { UI } = A;
    UI.menuVR(); await new Promise((r) => setTimeout(r, 50));
    document.querySelector('.menu-vr [data-sbs="0"]').click(); await new Promise((r) => setTimeout(r, 50));
    document.querySelector('.vr-ar [data-ar="espacio"]').click(); await new Promise((r) => setTimeout(r, 200));
    window.__paso = (n, conPose = true) => { for (let i = 0; i < n; i++) { if (conPose) window.__nativo.pose(20, 0, 1.5, 0.3, 0, 0, 0, 1, 1, '60'); A.paso(1 / 60, false); } };
    window.__paso(20);
    A.espacio.ponerFase('pantalla'); window.__paso(5);
  });
  return { pag, ctx, errores };
}

const { pag, ctx, errores } = await pagina(true);
/* a) la pide sola al llegar a la pantalla; mientras dice 'espera', la vuelve a pedir */
const ra = await pag.evaluate(async () => {
  const A = window.__A, E = A.espacio, P = E.ventanas.pantalla;
  const boton = P.botones.find((b) => b.id === 'ancha'), marcado = /✓/.test(boton?.texto || '');
  for (let i = 0; i < 240 && A.Nativo.ancho !== 'corre'; i++) { window.__paso(1); await new Promise((r) => setTimeout(r, 6)); }
  return { boton: !!boton, marcado, pedidos: window.__llamadas.filter((l) => l[0] === 'espacioAncho' && l[1]).length, ancho: A.Nativo.ancho, texto: E.textoCamara() };
});
prueba('la pantalla tiene "📷 Cámara 0,5x", prendido de entrada', ra.boton && ra.marcado, JSON.stringify(ra));
prueba('la pide sola, y mientras la cabeza no está alineada ("espera") la vuelve a pedir', ra.ancho === 'corre' && ra.pedidos >= 3, `${ra.pedidos} pedidos · ${ra.ancho}`);
prueba('dice que la cámara es la 0,5x (98°) y que para caminar se vuelve a 1x', /0,5x \(98°\)/.test(ra.texto) && /1x/.test(ra.texto), ra.texto);
/* b) ARCore en pausa: sin poses, tu espacio sigue vivo con la cabeza nativa */
const rb = await pag.evaluate(async () => {
  const A = window.__A, { THREE } = A, E = A.espacio;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.9, 0, 'YXZ'));
  window.__cab = [q.x, q.y, q.z, q.w, 0, 1.56, 0.3];
  /* (que pase más tiempo del que ARCore puede callarse: 250 ms) */
  await new Promise((r) => setTimeout(r, 400));
  for (let i = 0; i < 200; i++) { window.__paso(1, false); if (i % 20 === 0) await new Promise((r) => setTimeout(r, 1)); }
  return { dq: +(2 * Math.acos(Math.min(1, Math.abs(E.cabezaQ.dot(q)))) * 180 / Math.PI).toFixed(2), arVivo: A.Nativo.arVivo, perdido: !!E._avisoPerdido, con: A.Nativo.conCabeza };
});
prueba('sin poses de ARCore (en pausa), la cabeza sigue con el giroscopio y no avisa "perdido"', !rb.arVivo && rb.con && rb.dq < 0.5 && !rb.perdido, JSON.stringify(rb));
/* c) la foto ancha: llega, se pone en el mundo, del tamaño de 98° */
const rc = await pag.evaluate(async () => {
  const A = window.__A, E = A.espacio, antes = E.fotoEn.llegadas;
  const tx = Math.tan(98 / 2 * Math.PI / 180), ty = tx * 0.75;
  window.__nativo.foto({ n: 1, url: 'https://appassets.androidplatform.net/camara/1.jpg', e: 30, tx, ty, w: 640, h: 480, p: [0, 1.5, 0.36, 0, 0.43, 0, 0.9] });
  for (let i = 0; i < 60 && E.fotoEn.llegadas === antes; i++) { window.__paso(1, false); await new Promise((r) => setTimeout(r, 15)); }
  return { llegadas: E.fotoEn.llegadas - antes, tx: +(E.fotoEn.ultima?.tx || 0).toFixed(3) };
});
prueba('la foto de la 0,5x llega y se pone en el mundo, con su campo (98°)', rc.llegadas >= 1 && Math.abs(rc.tx - Math.tan(49 * Math.PI / 180)) < 0.01, JSON.stringify(rc));
/* d) el botón: de vuelta a 1x (y se guarda); al volver a la pantalla no la pide */
const rd = await pag.evaluate(async () => {
  const A = window.__A, E = A.espacio; window.__llamadas.length = 0;
  E.accion('ancha'); window.__paso(3); await new Promise((r) => setTimeout(r, 20));
  let guardado = null; try { guardado = localStorage.getItem('aeroplaza.ancha'); } catch { /* nada */ }
  const apagar = window.__llamadas.some((l) => l[0] === 'espacioAncho' && !l[1]);
  window.__llamadas.length = 0; E.ponerFase('pantalla'); for (let i = 0; i < 90; i++) window.__paso(1);
  const pidio = window.__llamadas.some((l) => l[0] === 'espacioAncho' && l[1]);
  return { apagar, guardado, pidio, marcado: /✓/.test(E.ventanas.pantalla.botones.find((b) => b.id === 'ancha')?.texto || '') };
});
prueba('el botón vuelve a 1x (ARCore, para caminar) y se guarda: no la vuelve a pedir', rd.apagar && rd.guardado === '0' && !rd.pidio && !rd.marcado, JSON.stringify(rd));
/* e) prendida de nuevo, "Escanear de nuevo" (necesita ARCore) y salir la apagan */
const re = await pag.evaluate(async () => {
  const A = window.__A, E = A.espacio; window.__alinear = 0;
  E.accion('ancha'); for (let i = 0; i < 90 && A.Nativo.ancho !== 'corre'; i++) { window.__paso(1); await new Promise((r) => setTimeout(r, 6)); }
  const prendida = A.Nativo.ancho === 'corre';
  window.__llamadas.length = 0; E.accion('reescanear'); await new Promise((r) => setTimeout(r, 20));
  const alEscanear = window.__llamadas.some((l) => l[0] === 'espacioAncho' && !l[1]);
  E.ponerFase('pantalla'); for (let i = 0; i < 90 && A.Nativo.ancho !== 'corre'; i++) { window.__paso(1); await new Promise((r) => setTimeout(r, 6)); }
  window.__llamadas.length = 0; E.cerrar(); await new Promise((r) => setTimeout(r, 20));
  const alSalir = window.__llamadas.some((l) => l[0] === 'espacioAncho' && !l[1]);
  return { prendida, alEscanear, alSalir };
});
prueba('"Escanear de nuevo" y salir de tu espacio la apagan (ARCore vuelve a tener la cámara)', re.prendida && re.alEscanear && re.alSalir, JSON.stringify(re));
const idi = await pag.evaluate(() => { const { t, ponerIdioma } = window.__A.textos, o = {}; for (const i of ['es', 'en', 'pt']) { ponerIdioma(i); o[i] = [t('es_ancha'), t('es_ancha_lista')]; } ponerIdioma('es'); return o; });
prueba('en los tres idiomas', idi.es[0] !== idi.en[0] && idi.en[1] !== idi.pt[1] && Object.values(idi).every((x) => x.every((y) => y && !y.startsWith('es_'))), JSON.stringify(idi));
prueba('sin errores en la página', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 3).join(' | '));
await ctx.close();

/* f) una APK vieja, sin camaraAncha: ni botón ni pedidos */
const V = await pagina(false);
const rf = await V.pag.evaluate(() => { const E = window.__A.espacio; for (let i = 0; i < 90; i++) window.__paso(1); return { boton: !!E.ventanas.pantalla?.botones.find((b) => b.id === 'ancha'), texto: E.textoCamara() }; });
prueba('con una APK vieja (sin la 0,5x) no hay botón ni pedidos', !rf.boton, JSON.stringify(rf));
await V.ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
