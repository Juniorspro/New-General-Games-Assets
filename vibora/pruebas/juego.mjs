// Las pruebas en el navegador (Chromium sin placa de video, ver memoria/probar.md).
//   (desde la raíz del repo) python3 -m http.server 8123 --bind 127.0.0.1 &
//   node vibora/pruebas/juego.mjs [--capturas carpeta]
//
// El juego se abre con ?pausa: no avanza solo (tampoco hay intro, salvo con
// ?intro) y la prueba lo hace avanzar de a pasos de 1/60 s. Las sondas están
// en window.__V (main.js). Los clics, las teclas y los dedos son de verdad
// (Playwright y CDP), no llamadas a funciones: así se prueba también el HTML.
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.VIBORA_URL || 'http://127.0.0.1:8123/vibora/index.html';
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > 0 ? process.argv[iCap + 1] : null;

const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let fallas = 0, total = 0;

async function pagina({ w = 412, h = 892, q = '', toque = false, dsf = 1 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, hasTouch: toque, isMobile: toque });
  const pg = await ctx.newPage();
  pg.errores = [];
  pg.on('pageerror', (e) => pg.errores.push(String(e.stack || e).slice(0, 500)));
  pg.on('console', (m) => { if (m.type() === 'error') pg.errores.push(m.text().slice(0, 300)); });
  await pg.goto(`${BASE}?pausa&${q}`);
  await pg.waitForFunction(() => window.listo, null, { timeout: 20000 });
  return pg;
}
async function cerrar(pg) { await pg.context().close(); }

async function prueba(nombre, fn) {
  total++;
  const t0 = Date.now();
  try {
    const nota = await fn();
    console.log(`  ok   ${nombre}${nota ? ' — ' + nota : ''} (${Date.now() - t0} ms)`);
  } catch (e) {
    fallas++;
    console.log(`  FALLA ${nombre}: ${String(e.message || e).slice(0, 500)}`);
  }
}
const afirmar = (c, m) => { if (!c) throw new Error(m); };
async function captura(pg, nombre) { if (CAPTURAS) await pg.screenshot({ path: `${CAPTURAS}/${nombre}.png` }); }
async function sinErrores(pg) {
  const sonido = await pg.evaluate(() => window.__V.sonido.errores);
  afirmar(pg.errores.length === 0 && sonido.length === 0, 'errores: ' + [...pg.errores, ...sonido].join(' | '));
}
const visible = (pg, id) => pg.evaluate((id) => !document.getElementById(id).classList.contains('oculto'), id);
const pasos = (pg, n, dib = true) => pg.evaluate(([n, dib]) => window.__V.pasos(n, dib), [n, dib]);
const V = (pg, expr) => pg.evaluate(`(() => { const V = window.__V; return ${expr}; })()`);

await prueba('arranca en el menú, con bots jugando atrás y el logo dibujado', async () => {
  const pg = await pagina({ q: 'idioma=es' });
  await pasos(pg, 120);
  const r = await pg.evaluate(() => {
    const V = window.__V, l = document.getElementById('logo'), d = l.getContext('2d').getImageData(0, 0, l.width, l.height).data;
    let pintados = 0;
    for (let k = 3; k < d.length; k += 4) if (d[k] > 0) pintados++;
    return { estado: V.estado, bots: V.mundo.viboras.filter((v) => v.bot).length + V.mundo.esperando.length, comida: V.mundo.cantidadComida, logo: pintados / (d.length / 4), jugar: document.getElementById('bJugar').textContent };
  });
  afirmar(r.estado === 'menu' && await visible(pg, 'menu'), 'no quedó en el menú: ' + r.estado);
  afirmar(r.bots === 18 && r.comida > 1000, 'el mundo del menú: ' + JSON.stringify(r));
  afirmar(r.logo > 0.08, 'el logo casi no se ve: ' + r.logo.toFixed(3));
  afirmar(r.jugar === 'JUGAR', 'el botón dice ' + r.jugar);
  await captura(pg, 'menu');
  await sinErrores(pg);
  await cerrar(pg);
  return `${r.bots} bots, ${r.comida} bolitas, logo ${(r.logo * 100) | 0}% del lienzo`;
});

await prueba('la intro de JXSTUDIOS está desde el primer cuadro, con su música, y deja en el menú; un toque la saltea', async () => {
  const pg = await pagina({ q: 'intro&idioma=es' });
  // sin tocar nada, desde el primer cuadro (este Chromium tiene permiso de sonar)
  afirmar(await V(pg, 'V.estado') === 'intro', 'la intro no estaba desde el principio: ' + await V(pg, 'V.estado'));
  afirmar(await V(pg, 'V.sonido.activo() && !!V.intro.musica'), 'la música de la intro no arrancó');
  // a mitad del trazo, el golpe, la palabra
  const brillo = [];
  for (const [n, nombre] of [[40, 'intro-trazo'], [26, 'intro-golpe'], [30, 'intro-palabra']]) {
    await pasos(pg, n);
    await captura(pg, nombre);
    brillo.push(await pg.evaluate(() => {
      const c = document.getElementById('juego'), g = c.getContext('2d'), d = g.getImageData(c.width * 0.2, c.height * 0.3, c.width * 0.6, c.height * 0.3).data;
      let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k] + d[k + 1] + d[k + 2];
      return s / (d.length / 4) / 3;
    }));
  }
  afirmar(brillo.every((b) => b > 12), 'la intro se ve negra: ' + brillo.map((b) => b.toFixed(1)).join(', '));
  afirmar(await V(pg, 'V.estado') === 'intro', 'la intro terminó antes de tiempo');
  await pasos(pg, 90);
  afirmar(await V(pg, 'V.estado') === 'menu' && await visible(pg, 'menu'), 'no llegó al menú: ' + await V(pg, 'V.estado'));
  // saltearla: el toque de apuro (antes de 0,35 s) no cuenta, el de después sí
  await pg.goto(`${BASE}?pausa&intro&idioma=es`);
  await pg.waitForFunction(() => window.listo);
  await pg.waitForFunction(() => window.__V.estado === 'intro', null, { timeout: 3000 });
  await pasos(pg, 10); await pg.mouse.click(200, 400);
  afirmar(await V(pg, 'V.estado') === 'intro', 'el toque de apuro la salteó');
  await pasos(pg, 20); await pg.mouse.click(200, 400); await pasos(pg, 25);
  afirmar(await V(pg, 'V.estado') === 'menu', 'el toque no la salteó: ' + await V(pg, 'V.estado'));
  await sinErrores(pg);
  await cerrar(pg);
  return 'brillo ' + brillo.map((b) => b.toFixed(0)).join(' / ');
});

await prueba('sin permiso de sonar (lo normal antes de un toque): arranca igual, muda, y el primer toque la saltea y prende el sonido', async () => {
  const nav2 = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await nav2.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  const err = [];
  pg.on('pageerror', (e) => err.push(String(e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 300)); });
  await pg.goto(`${BASE}?pausa&intro&idioma=es`);
  await pg.waitForFunction(() => window.listo);
  const t0 = Date.now();
  await pg.waitForFunction(() => window.__V.estado === 'intro', null, { timeout: 3000 });
  const espera = Date.now() - t0;
  const r1 = await pg.evaluate(() => ({ activo: window.__V.sonido.activo(), musica: !!window.__V.intro.musica }));
  await pg.evaluate(() => window.__V.pasos(30));
  await pg.touchscreen.tap(200, 400);
  await pg.evaluate(() => window.__V.pasos(25));
  const activo = await pg.waitForFunction(() => window.__V.sonido.activo(), null, { timeout: 3000 }).then(() => true).catch(() => false);
  const r2 = await pg.evaluate(() => ({ estado: window.__V.estado, errores: window.__V.sonido.errores }));
  await nav2.close();
  // (Playwright cuenta cada evaluate como un gesto, así que después el audio puede
  // arrancar solo: lo que importa es que la intro no lo esperó y no agendó la música tarde)
  afirmar(!r1.musica && espera < 1500, 'sin permiso tendría que arrancar muda y enseguida: ' + JSON.stringify({ ...r1, espera }));
  afirmar(r2.estado === 'menu' && activo, 'el toque: ' + JSON.stringify({ ...r2, activo }));
  afirmar(!err.length && !r2.errores.length, 'errores: ' + [...err, ...r2.errores].join(' | '));
  return `arrancó muda a los ${espera} ms de cargar`;
});

await prueba('después del logo, la primera vez, se elige el idioma; la segunda ya no', async () => {
  const pg = await pagina({ q: 'intro' });
  await pasos(pg, 200);
  const r1 = await V(pg, 'V.estado');
  afirmar(r1 === 'idiomas' && await visible(pg, 'idiomas'), 'después del logo: ' + r1);
  await captura(pg, 'idiomas');
  await pg.click('#bIdioma_pt');
  const r2 = await pg.evaluate(() => ({ estado: window.__V.estado, jugar: document.getElementById('bJugar').textContent, guardado: JSON.parse(localStorage.getItem('vibora-io-1')).ajustes.idioma }));
  afirmar(r2.estado === 'menu' && r2.jugar === 'JOGAR' && r2.guardado === 'pt', JSON.stringify(r2));
  await pg.goto(`${BASE}?pausa&intro`);
  await pg.waitForFunction(() => window.listo);
  await pasos(pg, 200);
  const r3 = await V(pg, 'V.estado');
  afirmar(r3 === 'menu', 'con el idioma ya elegido tendría que ir al menú: ' + r3);
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('con el mouse: nace, dobla hacia donde apunta y mantener apretado es turbo', async () => {
  const pg = await pagina({ q: 'idioma=es' });
  await pg.fill('#apodo', 'Probador');
  await pg.click('#bJugar');
  let r = await V(pg, '({ estado: V.estado, viva: V.mia?.viva, masa: V.mia?.masa, nombre: V.mia?.nombre })');
  afirmar(r.estado === 'juego' && r.viva && r.masa === 10 && r.nombre === 'Probador', JSON.stringify(r));
  await pg.mouse.move(206 + 150, 446 - 150);
  const x0 = await V(pg, '[V.mia.x, V.mia.y]');
  await pasos(pg, 90);
  r = await V(pg, '({ ang: V.mia.ang, x: V.mia.x, y: V.mia.y })');
  const esperado = Math.atan2(-150, 150);
  afirmar(Math.abs(Math.atan2(Math.sin(r.ang - esperado), Math.cos(r.ang - esperado))) < 0.25, 'no dobló hacia el mouse: ' + r.ang.toFixed(2));
  afirmar(r.x > x0[0] + 100 && r.y < x0[1] - 100, 'no fue para arriba a la derecha: ' + JSON.stringify([x0, r]));
  // con turbo va más del doble de rápido (la masa no sirve: en el camino come)
  await pg.evaluate(() => { window.__V.mia.masa = 100; });
  await pg.mouse.down(); await pasos(pg, 5);
  const p0 = await V(pg, '[V.mia.x, V.mia.y]'); await pasos(pg, 30);
  r = await V(pg, '({ turbo: V.mia.turbo, d: Math.hypot(V.mia.x - ' + p0[0] + ', V.mia.y - ' + p0[1] + ') })');
  afirmar(r.turbo && r.d > 200, 'el turbo con el mouse: ' + JSON.stringify(r));
  await pg.mouse.up(); await pasos(pg, 2);
  afirmar(!await V(pg, 'V.mia.turbo'), 'al soltar sigue el turbo');
  await captura(pg, 'juego');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el teclado: flechas doblan, espacio es turbo, P pausa y P sigue', async () => {
  const pg = await pagina({ q: 'idioma=es&directo=juego' });
  await pasos(pg, 10);
  const a0 = await V(pg, 'V.mia.ang');
  await pg.keyboard.down('ArrowLeft'); await pasos(pg, 20); await pg.keyboard.up('ArrowLeft');
  const a1 = await V(pg, 'V.mia.ang');
  // el ángulo va de −π a π: la diferencia se mide dando la vuelta (nace mirando para cualquier lado)
  const giro = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
  afirmar(giro < -0.5, 'la flecha izquierda no dobló: ' + a0.toFixed(2) + ' → ' + a1.toFixed(2));
  await pg.evaluate(() => { window.__V.mia.masa = 60; });
  await pg.keyboard.down('Space'); await pasos(pg, 30);
  afirmar(await V(pg, 'V.mia.turbo'), 'el espacio no da turbo');
  await pg.keyboard.up('Space'); await pasos(pg, 1);
  await pg.keyboard.press('KeyP');
  afirmar(await V(pg, 'V.estado') === 'pausa' && await visible(pg, 'pausa'), 'P no pausó');
  const x = await V(pg, 'V.mia.x'); await pasos(pg, 60);
  afirmar(await V(pg, 'V.mia.x') === x, 'en pausa se sigue moviendo');
  await captura(pg, 'pausa');
  await pg.keyboard.press('KeyP'); await pasos(pg, 30);
  afirmar(await V(pg, 'V.estado') === 'juego' && !await visible(pg, 'pausa'), 'P no sacó la pausa (o la volvió a poner): ' + await V(pg, 'V.estado'));
  await pg.keyboard.press('Escape');
  afirmar(await V(pg, 'V.estado') === 'pausa', 'Escape no pausó');
  await pg.click('#bSeguir'); await pasos(pg, 5);
  afirmar(await V(pg, 'V.estado') === 'juego', 'el botón SEGUIR no siguió');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el dedo de verdad (toques por CDP): flecha, segundo dedo, botón del rayo y pausa', async () => {
  const pg = await pagina({ q: 'idioma=es&directo=juego', toque: true });
  const cdp = await pg.context().newCDPSession(pg);
  // cada dedo es [x, y, id]; touchEnd suelta los dedos que nombra (vacío: todos)
  const toque = (type, puntos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y, id]) => ({ x, y, id, radiusX: 6, radiusY: 6, force: 1 })) });
  await pasos(pg, 5);
  // el dedo abajo a la izquierda de la cabeza: la víbora va para allá
  await toque('touchStart', [[80, 700, 1]]);
  await toque('touchMove', [[70, 720, 1]]);
  await pasos(pg, 60);
  const ang = await V(pg, 'V.mia.ang'), esperado = Math.atan2(720 - 446, 70 - 206);
  afirmar(Math.abs(Math.atan2(Math.sin(ang - esperado), Math.cos(ang - esperado))) < 0.3, 'no siguió al dedo: ' + ang.toFixed(2) + ' (quería ' + esperado.toFixed(2) + ')');
  await pg.evaluate(() => { window.__V.mia.masa = 80; });
  await toque('touchStart', [[70, 720, 1], [330, 300, 2]]);
  await pasos(pg, 20);
  afirmar(await V(pg, 'V.mia.turbo'), 'el segundo dedo no da turbo');
  await toque('touchEnd', [[330, 300, 2]]); await pasos(pg, 2);
  afirmar(!await V(pg, 'V.mia.turbo'), 'al sacar el segundo dedo sigue el turbo');
  await toque('touchEnd', []);
  // el botón del rayo, abajo a la izquierda
  const b = await V(pg, 'V.entrada.botonTurbo');
  afirmar(b, 'con dedo no hay botón de turbo');
  await toque('touchStart', [[b.x, b.y, 3]]); await pasos(pg, 10);
  afirmar(await V(pg, 'V.mia.turbo'), 'el botón del rayo no da turbo');
  await toque('touchEnd', []); await pasos(pg, 2);
  await captura(pg, 'dedo');
  const p = await V(pg, 'V.entrada.botonPausa');
  await toque('touchStart', [[p.x, p.y, 4]]); await toque('touchEnd', []); await pasos(pg, 1);
  afirmar(await V(pg, 'V.estado') === 'pausa', 'el botón de pausa no pausó');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el joystick: la base queda donde apoyás y la víbora va hacia donde arrastrás', async () => {
  const pg = await pagina({ q: 'idioma=es', toque: true });
  await pg.evaluate(() => { window.__V.datos.ajustes.control = 'joystick'; window.__V.jugar(); });
  const cdp = await pg.context().newCDPSession(pg);
  const toque = (type, puntos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y]) => ({ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 })) });
  await toque('touchStart', [[300, 650]]);
  for (let k = 1; k <= 5; k++) await toque('touchMove', [[300, 650 - k * 12]]);
  await pasos(pg, 60);
  const r = await V(pg, '({ ang: V.mia.ang, joy: V.entrada.joy && { x: V.entrada.joy.x, y: V.entrada.joy.y } })');
  afirmar(r.joy && r.joy.x === 300 && r.joy.y === 650, 'la base del joystick: ' + JSON.stringify(r.joy));
  afirmar(Math.abs(Math.atan2(Math.sin(r.ang + Math.PI / 2), Math.cos(r.ang + Math.PI / 2))) < 0.3, 'no fue para arriba: ' + r.ang.toFixed(2));
  await captura(pg, 'joystick');
  await toque('touchEnd', []);
  afirmar(await V(pg, 'V.entrada.joy') === null, 'al soltar queda el joystick');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('morir: la pantalla, el récord guardado, OTRA VEZ, MENÚ y el récord después de recargar', async () => {
  const pg = await pagina({ q: 'idioma=es&directo=juego' });
  await pasos(pg, 10);
  await pg.evaluate(() => { window.__V.mia.masa = 321; window.__V.matar(); });
  await pasos(pg, 30);
  afirmar(await V(pg, 'V.estado') === 'muerte' && !await visible(pg, 'muerte'), 'la pantalla salió de golpe');
  await pasos(pg, 40);
  const r = await pg.evaluate(() => ({ final: document.getElementById('tFinal').textContent, record: document.getElementById('tRecord').textContent, causa: document.getElementById('tCausa').textContent, guardado: JSON.parse(localStorage.getItem('vibora-io-1')).mejor }));
  afirmar(await visible(pg, 'muerte') && r.final === '321' && r.record === '¡Nuevo récord!' && r.guardado === 321, JSON.stringify(r));
  await captura(pg, 'muerte');
  await pg.click('#bOtraVez');
  afirmar(await V(pg, 'V.estado === "juego" && V.mia.viva && V.mia.masa === 10'), 'OTRA VEZ no volvió a jugar');
  await pasos(pg, 5);
  await pg.evaluate(() => { window.__V.mia.masa = 40; window.__V.matar(); });
  await pasos(pg, 70);
  afirmar(await pg.evaluate(() => document.getElementById('tRecord').textContent) === '', 'con 40 dice récord');
  await pg.click('#bMenu');
  afirmar(await V(pg, 'V.estado') === 'menu', 'MENÚ no volvió al menú');
  await pg.reload(); await pg.waitForFunction(() => window.listo);
  const mejor = await pg.evaluate(() => document.getElementById('tMejor').textContent);
  afirmar(mejor.includes('321'), 'después de recargar: ' + mejor);
  await sinErrores(pg);
  await cerrar(pg);
  return mejor;
});

await prueba('comerse a otra víbora avisa y suma; los hitos de largo avisan', async () => {
  const pg = await pagina({ q: 'idioma=es&directo=juego' });
  await pasos(pg, 5);
  const r = await pg.evaluate(() => {
    const V = window.__V, bot = V.mundo.viboras.find((v) => v.bot);
    V.mundo.morir(bot, V.mia); V.pasos(1);
    const a1 = V.avisos.map((a) => a.txt);
    V.mia.masa = 105; V.pasos(1);
    return { nombre: bot.nombre, bajas: V.mia.bajas, a1, a2: V.avisos.map((a) => a.txt) };
  });
  afirmar(r.bajas === 1 && r.a1.includes(`¡Te comiste a ${r.nombre}!`), JSON.stringify(r));
  afirmar(r.a2.includes('¡Largo 100!'), 'el hito: ' + JSON.stringify(r.a2));
  await pasos(pg, 1);
  await captura(pg, 'avisos');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('elegir piel (con candado) y fondo', async () => {
  const pg = await pagina({ q: 'idioma=es' });
  await pg.click('#bPiel'); await pasos(pg, 30);
  afirmar(await V(pg, 'V.estado') === 'elegir' && await visible(pg, 'elegir'), 'no abrió elegir');
  const txt = (id) => pg.evaluate((id) => document.getElementById(id).textContent, id);
  afirmar(await txt('tNombre') === 'Lima', 'la primera piel: ' + await txt('tNombre'));
  await pg.click('#bSiguiente'); await pasos(pg, 30);
  const segunda = await txt('tNombre');
  await captura(pg, 'piel');
  // la primera con candado: LISTO no la pone
  const vueltas = await pg.evaluate(() => { let k = 0; while (!document.getElementById('tCandado').textContent && k++ < 30) window.__V.moverElegir(1); return k; });
  const bloqueada = await txt('tNombre');
  afirmar(vueltas < 30, 'no hay pieles con candado');
  await pg.click('#bListo');
  afirmar(await V(pg, 'V.estado') === 'elegir' && await V(pg, 'V.datos.piel') === 'lima', 'se pudo elegir la bloqueada ' + bloqueada);
  await pasos(pg, 5);
  await captura(pg, 'piel-candado');
  await pg.evaluate((segunda) => { let k = 0; while (document.getElementById('tNombre').textContent !== segunda && k++ < 30) window.__V.moverElegir(-1); }, segunda);
  await pg.click('#bAnterior'); await pg.click('#bSiguiente');
  await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowRight');
  await pg.click('#bListo');
  const piel = await V(pg, 'V.datos.piel');
  afirmar(await V(pg, 'V.estado') === 'menu' && piel !== 'lima', 'no quedó la segunda piel: ' + piel);
  await pg.click('#bFondo'); await pg.click('#bSiguiente'); await pasos(pg, 10);
  const fondo = await txt('tNombre');
  await captura(pg, 'fondo');
  await pg.click('#bListo');
  afirmar(await V(pg, 'V.datos.fondo') === 'carbono' && fondo === 'Carbono JX', 'el fondo: ' + fondo);
  await pg.click('#bPiel'); await pg.keyboard.press('Escape');
  afirmar(await V(pg, 'V.estado') === 'menu', 'Escape no volvió al menú');
  await pasos(pg, 5);
  await sinErrores(pg);
  await cerrar(pg);
  return `${segunda} elegida; ${bloqueada} con candado`;
});

await prueba('ajustes: idioma, música y control quedan guardados; el nivel de bots arma otro mundo', async () => {
  const pg = await pagina({ q: 'idioma=es' });
  await pg.click('#bAjustes');
  afirmar(await V(pg, 'V.estado') === 'ajustes' && await pg.locator('#listaAjustes .item').count() === 7, 'los ajustes');
  await captura(pg, 'ajustes');
  await pg.click('#listaAjustes .item:nth-child(7) .opcion:nth-child(2)');       // EN
  await pg.click('#listaAjustes .item:nth-child(1) .opcion:nth-child(2)');       // música: no
  await pg.click('#listaAjustes .item:nth-child(5) .opcion:nth-child(2)');       // joystick
  const r = await pg.evaluate(() => ({ jugar: document.getElementById('bJugar').textContent, lang: document.documentElement.lang, g: JSON.parse(localStorage.getItem('vibora-io-1')).ajustes }));
  afirmar(r.jugar === 'PLAY' && r.lang === 'en' && r.g.idioma === 'en' && r.g.musica === false && r.g.control === 'joystick', JSON.stringify(r));
  await pg.click('#bCerrarAjustes');
  await pg.click('.opcion[data-nivel="2"]');
  await pg.click('#bJugar');
  const m = await V(pg, '({ nivel: V.mundo.nivelBots, bots: V.mundo.viboras.filter((v) => v.bot).length, modo: V.entrada.modo })');
  afirmar(m.nivel === 2 && m.bots === 26 && m.modo === 'joystick', JSON.stringify(m));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('los tres idiomas', async () => {
  const notas = [];
  for (const [l, jugar] of [['es', 'JUGAR'], ['en', 'PLAY'], ['pt', 'JOGAR']]) {
    const pg = await pagina({ q: 'idioma=' + l });
    const r = await pg.evaluate(() => [document.getElementById('bJugar').textContent, document.getElementById('tFirma').textContent, document.documentElement.lang]);
    afirmar(r[0] === jugar && r[2] === l && r[1].includes('JXSTUDIOS'), l + ': ' + r.join(' / '));
    notas.push(r[1]);
    await cerrar(pg);
  }
  return notas.join(' · ');
});

await prueba('entra en cinco pantallas: nada se sale ni se pisa', async () => {
  const notas = [], malas = [];
  for (const [w, h] of [[412, 892], [360, 640], [320, 568], [892, 412], [1280, 720]]) {
    const pg = await pagina({ w, h, q: 'idioma=es' });
    await pg.evaluate(() => { window.__V.datos.mejor = 12345; window.__V.aMenu(); });
    for (const pantalla of ['menu', 'muerte', 'elegir', 'ajustes', 'idiomas']) {
      if (pantalla === 'muerte') await pg.evaluate(() => { const V = window.__V; V.jugar(); V.mia.masa = 23456; V.matar(); V.pasos(70); });
      if (pantalla === 'elegir') await pg.evaluate(() => { window.__V.aMenu(); window.__V.elegir('piel'); });
      if (pantalla === 'ajustes') await pg.evaluate(() => { window.__V.aMenu(); document.getElementById('bAjustes').click(); });
      if (pantalla === 'idiomas') await pg.evaluate(() => { window.__V.aMenu(); window.__V.elegirIdioma(); });
      await pasos(pg, 2);
      const r = await pg.evaluate((id) => {
        const cajas = [...document.querySelectorAll(`#${id} button, #${id} input, #${id} canvas, #${id} p, #${id} h2, #${id} .item`)]
          .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0)
          .map((e) => ({ id: e.id || e.className, ...e.getBoundingClientRect().toJSON() }));
        const fuera = cajas.filter((c) => c.left < -1 || c.top < -1 || c.right > innerWidth + 1 || c.bottom > innerHeight + 1);
        // se pisan: dos cajas hermanas de la columna que se superponen en alto
        const col = cajas.filter((c) => !String(c.id).includes('item') && !String(c.id).includes('opcion') && c.id !== 'tFirma');
        const pisadas = [];
        for (let a = 0; a < col.length; a++) for (let b = a + 1; b < col.length; b++) {
          const A = col[a], B = col[b];
          if (A.left < B.right && B.left < A.right && A.top < B.bottom - 1 && B.top < A.bottom - 1) {
            const contiene = (X, Y) => X.left <= Y.left && X.top <= Y.top && X.right >= Y.right && X.bottom >= Y.bottom;
            if (!contiene(A, B) && !contiene(B, A)) pisadas.push(A.id + '×' + B.id);
          }
        }
        return { fuera: fuera.map((c) => c.id), pisadas, ancho: document.documentElement.scrollWidth <= innerWidth };
      }, pantalla);
      if (r.fuera.length || r.pisadas.length || !r.ancho) malas.push(`${w}×${h} ${pantalla}: ${JSON.stringify(r)}`);
      await captura(pg, `pantalla-${w}x${h}-${pantalla}`);
    }
    await sinErrores(pg);
    await cerrar(pg);
    notas.push(`${w}×${h}`);
  }
  afirmar(!malas.length, malas.join(' ; '));
  return notas.join(', ');
});

await prueba('la densidad de pantalla: nítida con 2x y la calidad baja la vuelve 1x', async () => {
  const pg = await pagina({ q: 'idioma=es', dsf: 2 });
  const a = await V(pg, '({ dpr: V.dpr, W: V.W, ancho: innerWidth })');
  afirmar(a.dpr === 2 && a.W === a.ancho * 2, JSON.stringify(a));
  await pg.click('#bAjustes');
  await pg.click('#listaAjustes .item:nth-child(6) .opcion:nth-child(3)');         // baja
  const b = await V(pg, '({ dpr: V.dpr, W: V.W, ancho: innerWidth })');
  afirmar(b.dpr === 1 && b.W === b.ancho, JSON.stringify(b));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el sonido arranca con el primer toque y ningún efecto ni canción falla', async () => {
  const pg = await pagina({ q: 'idioma=es' });
  await pg.mouse.click(206, 800);
  const r = await pg.evaluate(async () => {
    const s = window.__V.sonido, espera = (ms) => new Promise((f) => setTimeout(f, ms));
    const activo = s.activo();
    for (const n of ['come', 'muere', 'baja', 'hito', 'nace', 'boton', 'cambia', 'error', 'record']) { s.tocar(n, { valor: 5 }); await espera(40); }
    for (const m of ['menu', 'juego']) { s.musica(m); await espera(300); }
    s.turbo(true); await espera(150); s.turbo(false);
    const j = s.jingleJXS(); await espera(100); j?.cortar();
    return { activo, errores: s.errores, jingle: !!j };
  });
  afirmar(r.activo && r.jingle, 'el audio no arrancó con el clic: ' + JSON.stringify(r));
  afirmar(r.errores.length === 0, 'errores de sonido: ' + r.errores.join(' | '));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('lo que tarda un cuadro con 26 bots (SwiftShader: no dice nada del teléfono)', async () => {
  const notas = [];
  for (const dsf of [1, 2]) {
    const pg = await pagina({ q: 'idioma=es', dsf });
    const r = await pg.evaluate(() => {
      const V = window.__V;
      V.datos.nivelBots = 2; V.jugar();
      V.mia.masa = 800;                                   // grande: más cuerpo en pantalla
      const vive = () => { if (!V.mia.viva) { V.jugar(); V.mia.masa = 800; } };
      for (let k = 0; k < 240; k++) { V.pasos(1); V.dibujar(); vive(); }
      const t0 = performance.now();
      for (let k = 0; k < 300; k++) { V.pasos(1); vive(); }
      const t1 = performance.now();
      for (let k = 0; k < 300; k++) V.dibujar();
      const t2 = performance.now();
      // anotar las órdenes no es pintarlas: leer un píxel obliga a pintar de
      // verdad (en SwiftShader es lentísimo, por eso son pocos cuadros)
      const c = document.getElementById('juego').getContext('2d');
      c.getImageData(0, 0, 1, 1);
      const t3 = performance.now();
      for (let k = 0; k < 10; k++) { V.dibujar(); c.getImageData(0, 0, 1, 1); }
      const t4 = performance.now();
      return { paso: (t1 - t0) / 300, dibujo: (t2 - t1) / 300, pintado: (t4 - t3) / 10, W: V.W, H: V.H };
    });
    notas.push(`${r.W}×${r.H}: paso ${r.paso.toFixed(2)} ms, órdenes ${r.dibujo.toFixed(2)} ms, pintado ${r.pintado.toFixed(0)} ms`);
    await sinErrores(pg);
    await cerrar(pg);
  }
  return notas.join('; ');
});

await nav.close();
console.log(fallas ? `\n${fallas} de ${total} pruebas fallaron` : `\n${total} pruebas, todas bien`);
process.exit(fallas ? 1 : 0);
