// Las pruebas en el navegador (Chromium sin placa de video, ver memoria/probar.md).
//   (desde la raíz del repo) python3 -m http.server 8123 --bind 127.0.0.1 &
//   node globo/pruebas/juego.mjs [--capturas carpeta]
//
// El juego se abre con ?pausa: no avanza solo (tampoco hay intro, salvo con
// ?intro) y la prueba lo hace avanzar de a pasos de 1/60 s. Las sondas están
// en window.__G (main.js). Los clics, las teclas y los dedos son de verdad
// (Playwright y CDP), no llamadas a funciones: así se prueba también el HTML.
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.GLOBO_URL || 'http://127.0.0.1:8123/globo/index.html';
const CLAVE = 'globo-libre-1';
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
    console.log(`  FALLA ${nombre}: ${String(e.message || e).slice(0, 600)}`);
  }
}
const afirmar = (c, m) => { if (!c) throw new Error(m); };
async function captura(pg, nombre) { if (CAPTURAS) await pg.screenshot({ path: `${CAPTURAS}/${nombre}.png` }); }
async function sinErrores(pg) {
  const sonido = await pg.evaluate(() => window.__G.sonido.errores);
  afirmar(pg.errores.length === 0 && sonido.length === 0, 'errores: ' + [...pg.errores, ...sonido].join(' | '));
}
const visible = (pg, id) => pg.evaluate((id) => !document.getElementById(id).classList.contains('oculto'), id);
const pasos = (pg, n, dib = true) => pg.evaluate(([n, dib]) => window.__G.pasos(n, dib), [n, dib]);
const G = (pg, expr) => pg.evaluate(`(() => { const G = window.__G; return ${expr}; })()`);
const texto = (pg, id) => pg.evaluate((id) => document.getElementById(id).textContent, id);
// cuánto del lienzo es de un color parecido (para saber si algo se dibujó)
const muestra = (pg, x, y, w, h) => pg.evaluate(([x, y, w, h]) => {
  const c = document.getElementById('juego'), d = c.getContext('2d').getImageData(x * c.width, y * c.height, w * c.width, h * c.height).data;
  const colores = new Set();
  for (let k = 0; k < d.length; k += 16) colores.add((d[k] >> 4) * 256 + (d[k + 1] >> 4) * 16 + (d[k + 2] >> 4));
  return colores.size;
}, [x, y, w, h]);

await prueba('arranca en el menú: el cartel colgado de globos, los botones y las monedas', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio' });
  await pasos(pg, 60);
  const r = await pg.evaluate(() => ({ estado: window.__G.estado, jugar: document.getElementById('tJugar').textContent, nivel: document.getElementById('tNivelJugar').textContent, monedas: document.getElementById('tMonedas').textContent, firma: document.getElementById('tFirma').textContent }));
  afirmar(r.estado === 'menu' && await visible(pg, 'menu'), 'no quedó en el menú: ' + r.estado);
  afirmar(r.jugar === 'JUGAR' && r.nivel === 'Nivel 1' && r.monedas === '0' && r.firma.includes('JXSTUDIOS'), JSON.stringify(r));
  // el cartel: la zona de arriba tiene muchos colores (letras, borde, globos), no solo cielo
  const colores = await muestra(pg, 0.1, 0.12, 0.8, 0.25);
  afirmar(colores > 40, 'el cartel casi no se ve: ' + colores + ' colores');
  // se hamaca: el dedo lo empuja
  const b0 = await G(pg, 'G.fondo.balanceo');
  await pg.mouse.move(100, 200); await pg.mouse.down(); await pg.mouse.move(300, 200, { steps: 6 }); await pg.mouse.up();
  await pasos(pg, 10);
  const b1 = await G(pg, 'G.fondo.balanceo');
  afirmar(Math.abs(b1 - b0) > 0.02, 'el cartel no se movió con el dedo: ' + b0 + ' → ' + b1);
  await captura(pg, 'menu');
  await sinErrores(pg);
  await cerrar(pg);
  return `${colores} colores en el cartel, se hamacó ${Math.abs(b1 - b0).toFixed(2)}`;
});

await prueba('la intro de JXSTUDIOS está desde el primer cuadro, con su música, es de colores y deja en el menú; un toque la saltea', async () => {
  const pg = await pagina({ q: 'intro&idioma=es' });
  afirmar(await G(pg, 'G.estado') === 'intro', 'la intro no estaba desde el principio: ' + await G(pg, 'G.estado'));
  afirmar(await G(pg, 'G.sonido.activo() && !!G.intro.musica'), 'la música de la intro no arrancó');
  // no es negra ni blanca: el fondo azul, el logo blanco, el globo rojo y el papel picado
  const colores = [];
  for (const [n, nombre] of [[40, 'intro-trazo'], [52, 'intro-golpe'], [30, 'intro-palabra']]) {
    await pasos(pg, n);
    await captura(pg, nombre);
    colores.push(await muestra(pg, 0, 0, 1, 1));
  }
  const azul = await pg.evaluate(() => { const c = document.getElementById('juego'), d = c.getContext('2d').getImageData(5, 5, 1, 1).data; return [d[0], d[1], d[2]]; });
  afirmar(azul[2] > 200 && azul[0] < 90, 'el fondo de la intro no es el azul: ' + azul);
  afirmar(colores[1] > 30, 'el golpe (papel picado) tiene pocos colores: ' + colores);
  afirmar(await G(pg, 'G.estado') === 'intro', 'la intro terminó antes de tiempo');
  await pasos(pg, 60);
  afirmar(await G(pg, 'G.estado') === 'menu' && await visible(pg, 'menu'), 'no llegó al menú: ' + await G(pg, 'G.estado'));
  // saltearla: el toque de apuro (antes de 0,3 s) no cuenta, el de después sí
  await pg.goto(`${BASE}?pausa&intro&idioma=es`);
  await pg.waitForFunction(() => window.listo);
  await pasos(pg, 8); await pg.mouse.click(200, 400);
  afirmar(await G(pg, 'G.estado') === 'intro', 'el toque de apuro la salteó');
  await pasos(pg, 20); await pg.mouse.click(200, 400); await pasos(pg, 30);
  afirmar(await G(pg, 'G.estado') === 'menu', 'el toque no la salteó: ' + await G(pg, 'G.estado'));
  await sinErrores(pg);
  await cerrar(pg);
  return 'colores por cuadro ' + colores.join(' / ');
});

await prueba('sin permiso de sonar (lo normal antes de un toque): arranca igual, muda, y el primer toque la saltea', async () => {
  const nav2 = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await nav2.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  const err = [];
  pg.on('pageerror', (e) => err.push(String(e).slice(0, 300)));
  pg.on('console', (m) => { if (m.type() === 'error') err.push(m.text().slice(0, 300)); });
  await pg.goto(`${BASE}?pausa&intro&idioma=es`);
  await pg.waitForFunction(() => window.listo);
  const t0 = Date.now();
  await pg.waitForFunction(() => window.__G.estado === 'intro', null, { timeout: 3000 });
  const espera = Date.now() - t0;
  const r1 = await pg.evaluate(() => ({ musica: !!window.__G.intro.musica }));
  await pg.evaluate(() => window.__G.pasos(30));
  await pg.touchscreen.tap(200, 400);
  await pg.evaluate(() => window.__G.pasos(30));
  const r2 = await pg.evaluate(() => ({ estado: window.__G.estado, errores: window.__G.sonido.errores }));
  await nav2.close();
  // (Playwright cuenta cada evaluate como un gesto: lo que importa es que la intro no esperó al audio)
  afirmar(!r1.musica && espera < 1500, 'sin permiso tendría que arrancar muda y enseguida: ' + JSON.stringify({ ...r1, espera }));
  afirmar(r2.estado === 'menu', 'el toque no la salteó: ' + JSON.stringify(r2));
  afirmar(!err.length && !r2.errores.length, 'errores: ' + [...err, ...r2.errores].join(' | '));
  return `arrancó muda a los ${espera} ms de cargar`;
});

await prueba('después del logo, la primera vez, se elige el idioma; la segunda ya no', async () => {
  const pg = await pagina({ q: 'intro&limpio' });
  await pasos(pg, 200);
  afirmar(await G(pg, 'G.estado') === 'idiomas' && await visible(pg, 'idiomas'), 'después del logo: ' + await G(pg, 'G.estado'));
  await captura(pg, 'idiomas');
  await pg.click('#bIdioma_pt');
  const r = await pg.evaluate((clave) => ({ estado: window.__G.estado, jugar: document.getElementById('tJugar').textContent, guardado: JSON.parse(localStorage.getItem(clave)).ajustes.idioma }), CLAVE);
  afirmar(r.estado === 'menu' && r.jugar === 'JOGAR' && r.guardado === 'pt', JSON.stringify(r));
  await pg.goto(`${BASE}?pausa&intro`);
  await pg.waitForFunction(() => window.listo);
  await pasos(pg, 200);
  afirmar(await G(pg, 'G.estado') === 'menu', 'con el idioma ya elegido tendría que ir al menú: ' + await G(pg, 'G.estado'));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el dedo de verdad (CDP): arrastrar en cualquier lado mueve el escudo lo mismo que el dedo; un segundo dedo no hace nada', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio', toque: true });
  await pg.click('#bJugar');
  afirmar(await G(pg, 'G.estado') === 'juego' && await visible(pg, 'bPausa'), 'JUGAR no empezó el nivel');
  const cdp = await pg.context().newCDPSession(pg);
  const toque = (type, puntos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y, id]) => ({ x, y, id, radiusX: 6, radiusY: 6, force: 1 })) });
  await pasos(pg, 2);
  const e0 = await G(pg, '({ x: G.partida.escudo.x, rel: G.partida.escudo.y - G.partida.globo.y })');
  // lejos del escudo, abajo a la derecha: arrastrar 60 px a la derecha y 40 para arriba
  await toque('touchStart', [[330, 800, 1]]);
  for (let k = 1; k <= 6; k++) { await toque('touchMove', [[330 + k * 10, 800 - k * 6.67, 1]]); await pasos(pg, 1, false); }
  await pasos(pg, 6);
  const e1 = await G(pg, '({ x: G.partida.escudo.x, rel: G.partida.escudo.y - G.partida.globo.y, esc: Math.min(G.W / 360, G.H / 560) })');
  const esperado = (60 * 1.3) / e1.esc;
  afirmar(Math.abs(e1.x - e0.x - esperado) < 4 && Math.abs(e1.rel - e0.rel + (40 * 1.3) / e1.esc) < 4, `no se movió lo del dedo: ${JSON.stringify([e0, e1])} (quería +${esperado.toFixed(1)} a la derecha)`);
  // un segundo dedo apoyado y movido no mueve el escudo
  await toque('touchStart', [[390, 800, 1], [100, 300, 2]]);
  await toque('touchMove', [[390, 800, 1], [20, 300, 2]]); await pasos(pg, 3);
  const e2 = await G(pg, 'G.partida.escudo.x');
  afirmar(Math.abs(e2 - e1.x) < 1, 'el segundo dedo movió el escudo: ' + e1.x + ' → ' + e2);
  await toque('touchEnd', []);
  await captura(pg, 'dedo');
  await sinErrores(pg);
  await cerrar(pg);
  return `+${(e1.x - e0.x).toFixed(1)} en x por 60 px de dedo`;
});

await prueba('el mouse arrastra con el botón apretado; las flechas mueven; P y Escape pausan', async () => {
  const pg = await pagina({ q: 'idioma=es&directo=nivel:1' });
  await pasos(pg, 2);
  const x0 = await G(pg, 'G.partida.escudo.x');
  await pg.mouse.move(200, 600); await pasos(pg, 1, false);
  await pg.mouse.move(260, 600); await pasos(pg, 2, false);
  afirmar(Math.abs(await G(pg, 'G.partida.escudo.x') - x0) < 1, 'el mouse sin apretar movió el escudo');
  await pg.mouse.down(); await pg.mouse.move(320, 600, { steps: 4 }); await pasos(pg, 4); await pg.mouse.up();
  const x1 = await G(pg, 'G.partida.escudo.x');
  afirmar(x1 > x0 + 40, 'arrastrar con el mouse no lo movió: ' + x0 + ' → ' + x1);
  await pg.keyboard.down('ArrowLeft'); await pasos(pg, 20); await pg.keyboard.up('ArrowLeft');
  const x2 = await G(pg, 'G.partida.escudo.x');
  afirmar(x2 < x1 - 80, 'la flecha izquierda no lo movió: ' + x1 + ' → ' + x2);
  await pg.keyboard.press('KeyP');
  afirmar(await G(pg, 'G.estado') === 'pausa' && await visible(pg, 'pausa') && !await visible(pg, 'bPausa'), 'P no pausó');
  const y = await G(pg, 'G.partida.globo.y'); await pasos(pg, 30);
  afirmar(await G(pg, 'G.partida.globo.y') === y, 'en pausa el globo sigue subiendo');
  await captura(pg, 'pausa');
  await pg.keyboard.press('KeyP'); await pasos(pg, 5);
  afirmar(await G(pg, 'G.estado') === 'juego', 'P no sacó la pausa (o la volvió a poner): ' + await G(pg, 'G.estado'));
  await pg.click('#bPausa');
  afirmar(await G(pg, 'G.estado') === 'pausa', 'el botón de pausa no pausó');
  await pg.click('#bSeguir'); await pasos(pg, 3);
  afirmar(await G(pg, 'G.estado') === 'juego' && await visible(pg, 'bPausa'), 'SEGUIR no siguió');
  await pg.keyboard.press('Escape');
  afirmar(await G(pg, 'G.estado') === 'pausa', 'Escape no pausó');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('sin tocar nada, el globo revienta: ¡PUM!, las monedas juntadas quedan, OTRA VEZ y MENÚ', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio&directo=nivel:1' });
  let n = 0;
  while (await G(pg, 'G.partida.estado') === 'juego' && n++ < 60) await pasos(pg, 60, false);
  afirmar(await G(pg, 'G.partida.estado') === 'pum', 'no reventó');
  afirmar(!await visible(pg, 'pum'), 'la pantalla salió de golpe');
  await pasos(pg, 80);
  const r = await pg.evaluate(() => ({ titulo: document.getElementById('tPum').textContent, causa: document.getElementById('tPumCausa').textContent, estado: window.__G.estado }));
  afirmar(await visible(pg, 'pum') && r.titulo === '¡PUM!' && r.causa.startsWith('Se reventó el globo'), JSON.stringify(r));
  await captura(pg, 'pum');
  await pg.click('#bOtraVez');
  afirmar(await G(pg, 'G.estado === "juego" && G.partida.estado === "juego" && G.partida.altura() < 1'), 'OTRA VEZ no volvió a empezar');
  await pasos(pg, 5);
  await pg.evaluate(() => window.__G.partida.reventar(window.__G.partida.escudo)); await pasos(pg, 80);
  await pg.click('#bMenuPum');
  afirmar(await G(pg, 'G.estado') === 'menu', 'MENÚ no volvió al menú');
  await sinErrores(pg);
  await cerrar(pg);
  return r.causa;
});

await prueba('llegar a la meta: papel picado, premio, se abre el nivel siguiente y SIGUIENTE lo juega', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio&directo=nivel:1' });
  await pasos(pg, 2);
  // el globo, a un paso de la meta, sin nada en el camino
  await pg.evaluate(() => { const p = window.__G.partida; p.globo.y = -p.largo + 30; for (const b of p.mundo.cuerpos) if (b !== p.escudo) p.mundo.sacar(b); p.pendientes = []; p.tomadas = 3; });
  await pasos(pg, 30);
  afirmar(await G(pg, 'G.partida.estado') === 'meta', 'no llegó: ' + await G(pg, 'G.partida.estado'));
  const papel = await G(pg, 'G.partida.particulas.filter((q) => q.tipo === "papel").length');
  await captura(pg, 'meta');
  await pasos(pg, 110);
  const r = await pg.evaluate((clave) => ({ estado: window.__G.estado, premio: document.getElementById('tGanoMonedas').textContent, g: JSON.parse(localStorage.getItem(clave)) }), CLAVE);
  afirmar(await visible(pg, 'gano') && r.estado === 'gano' && papel > 40, JSON.stringify({ ...r, papel }));
  afirmar(r.g.abierto === 1 && r.g.monedas === 13 && r.premio === '+13 monedas', 'el premio o el nivel abierto: ' + JSON.stringify(r));
  await captura(pg, 'gano');
  await pg.click('#bSiguienteNivel');
  afirmar(await G(pg, 'G.estado === "juego" && G.partida.nivel === 1'), 'SIGUIENTE no jugó el nivel 2');
  await sinErrores(pg);
  await cerrar(pg);
  return `${papel} papelitos, ${r.premio}`;
});

await prueba('los niveles: 30 en tres cielos, los cerrados no se juegan y los abiertos sí', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio' });
  await pg.evaluate(() => { window.__G.datos.abierto = 4; });
  await pg.click('#bNiveles'); await pasos(pg, 5);
  const r = await pg.evaluate(() => ({ botones: document.querySelectorAll('#grillaNiveles .nivelB').length, cerrados: document.querySelectorAll('#grillaNiveles .nivelB.cerrado').length, hechos: document.querySelectorAll('#grillaNiveles .nivelB.hecho').length, cielos: [...document.querySelectorAll('#grillaNiveles h3')].map((h) => h.textContent) }));
  afirmar(r.botones === 30 && r.cerrados === 25 && r.hechos === 4 && r.cielos.join() === 'Día,Atardecer,Noche', JSON.stringify(r));
  await captura(pg, 'niveles');
  await pg.click('#grillaNiveles .nivelB[data-n="7"]');
  afirmar(await G(pg, 'G.estado') === 'niveles', 'se pudo jugar un nivel cerrado');
  await pg.click('#grillaNiveles .nivelB[data-n="3"]');
  afirmar(await G(pg, 'G.estado === "juego" && G.partida.nivel === 3'), 'el nivel 4 abierto no se jugó');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('la tienda: comprar un globo con monedas, usarlo, no alcanza para otro, y los escudos', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio' });
  await pg.evaluate(() => { window.__G.datos.monedas = 100; });
  await pg.click('#bTienda'); await pasos(pg, 10);
  afirmar(await G(pg, 'G.estado') === 'tienda' && await texto(pg, 'tNombre') === 'Rojo' && await texto(pg, 'bComprar') === 'EN USO', 'la tienda arranca en el globo en uso');
  await pg.click('#bSiguiente'); await pasos(pg, 10);
  afirmar(await texto(pg, 'tNombre') === 'Azul' && await texto(pg, 'bComprar') === 'COMPRAR · 40', 'el segundo: ' + await texto(pg, 'bComprar'));
  await captura(pg, 'tienda');
  await pg.click('#bComprar');
  const r = await pg.evaluate((clave) => ({ boton: document.getElementById('bComprar').textContent, g: JSON.parse(localStorage.getItem(clave)) }), CLAVE);
  afirmar(r.boton === 'EN USO' && r.g.monedas === 60 && r.g.globo === 'azul' && r.g.globos.includes('azul'), JSON.stringify(r));
  // el de 700 no alcanza: dice cuánto falta y no compra
  await pg.evaluate(() => { while (document.getElementById('tNombre').textContent !== 'Oro') window.__G.moverTienda(1); });
  await pg.click('#bComprar');
  const aviso = await texto(pg, 'tAviso');
  afirmar(aviso === 'Te faltan 640 monedas' && await G(pg, 'G.datos.monedas') === 60 && await G(pg, 'G.datos.globo') === 'azul', 'compró sin plata: ' + aviso);
  await pg.click('#bPestEscudos'); await pasos(pg, 10);
  afirmar(await texto(pg, 'tNombre') === 'Blanco', 'la pestaña de escudos: ' + await texto(pg, 'tNombre'));
  await pg.keyboard.press('ArrowRight'); await pg.click('#bComprar');
  afirmar(await G(pg, 'G.datos.escudo') === 'burbuja' && await G(pg, 'G.datos.monedas') === 10, 'el escudo burbuja: ' + await G(pg, 'G.datos.escudo'));
  await captura(pg, 'tienda-escudos');
  await pg.keyboard.press('Escape');
  afirmar(await G(pg, 'G.estado') === 'menu', 'Escape no volvió al menú');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('ajustes: idioma, música y sensibilidad quedan guardados; borrar pide dos toques', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio' });
  await pg.evaluate(() => { window.__G.datos.abierto = 5; window.__G.datos.monedas = 77; });
  await pg.click('#bAjustes');
  afirmar(await G(pg, 'G.estado') === 'ajustes' && await pg.locator('#listaAjustes .item').count() === 7, 'los ajustes');
  await captura(pg, 'ajustes');
  await pg.click('#listaAjustes .item:nth-child(6) .opcion:nth-child(2)');       // EN
  await pg.click('#listaAjustes .item:nth-child(1) .opcion:nth-child(2)');       // música: no
  await pg.click('#listaAjustes .item:nth-child(4) .opcion:nth-child(3)');       // sensibilidad alta
  const r = await pg.evaluate((clave) => ({ jugar: document.getElementById('tJugar').textContent, lang: document.documentElement.lang, a: JSON.parse(localStorage.getItem(clave)).ajustes }), CLAVE);
  afirmar(r.jugar === 'PLAY' && r.lang === 'en' && r.a.idioma === 'en' && r.a.musica === false && r.a.sensibilidad === 'alta', JSON.stringify(r));
  await pg.click('#listaAjustes .item:nth-child(7) .opcion');
  afirmar(await G(pg, 'G.datos.abierto') === 5, 'un toque ya borró');
  await pg.click('#listaAjustes .item:nth-child(7) .opcion');
  const b = await G(pg, '({ abierto: G.datos.abierto, monedas: G.datos.monedas, idioma: G.datos.ajustes.idioma })');
  afirmar(b.abierto === 0 && b.monedas === 0 && b.idioma === 'en', 'borrar: ' + JSON.stringify(b));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('los tres idiomas', async () => {
  const notas = [];
  for (const [l, jugar, nivel] of [['es', 'JUGAR', 'Nivel 1'], ['en', 'PLAY', 'Level 1'], ['pt', 'JOGAR', 'Nível 1']]) {
    const pg = await pagina({ q: 'limpio&idioma=' + l });
    const r = await pg.evaluate(() => [document.getElementById('tJugar').textContent, document.getElementById('tNivelJugar').textContent, document.getElementById('tFirma').textContent, document.documentElement.lang]);
    afirmar(r[0] === jugar && r[1] === nivel && r[3] === l && r[2].includes('JXSTUDIOS'), l + ': ' + r.join(' / '));
    notas.push(r[2]);
    await cerrar(pg);
  }
  return notas.join(' · ');
});

await prueba('entra en cinco pantallas: nada se sale ni se pisa', async () => {
  const notas = [], malas = [];
  for (const [w, h] of [[412, 892], [360, 640], [320, 568], [892, 412], [1280, 720]]) {
    const pg = await pagina({ w, h, q: 'idioma=es&limpio' });
    await pg.evaluate(() => { window.__G.datos.mejorAltura = 12345; window.__G.datos.monedas = 98765; window.__G.aMenu(); });
    for (const pantalla of ['menu', 'niveles', 'tienda', 'ajustes', 'pum', 'gano', 'pausa', 'idiomas']) {
      await pg.evaluate((pantalla) => {
        const G = window.__G, clic = (id) => document.getElementById(id).click();
        G.aMenu();
        if (pantalla === 'niveles') clic('bNiveles');
        if (pantalla === 'tienda') G.abrirTienda('globos');
        if (pantalla === 'ajustes') clic('bAjustes');
        if (pantalla === 'idiomas') G.elegirIdioma();
        if (pantalla === 'pausa') { G.jugar(0); G.pausar(); }
        if (pantalla === 'pum') { G.infinito(); G.partida.reventar(G.partida.escudo); G.pasos(80); }
        if (pantalla === 'gano') { G.jugar(0); const p = G.partida; p.globo.y = -p.largo + 5; G.pasos(130); }
      }, pantalla);
      await pasos(pg, 2);
      const r = await pg.evaluate((id) => {
        const cajas = [...document.querySelectorAll(`#${id} button, #${id} p, #${id} h2, #${id} h3, #${id} .item, #${id} .bolsa, #${id} .pestanas`)]
          .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0)
          .map((e) => ({ id: e.id || e.className, ...e.getBoundingClientRect().toJSON() }));
        const fuera = cajas.filter((c) => c.left < -1 || c.top < -1 || c.right > innerWidth + 1 || c.bottom > innerHeight + 1);
        // se pisan: dos cajas que se superponen (sin contar las de adentro de otra)
        const col = cajas.filter((c) => !/item|opcion|nivelB/.test(String(c.id)) && c.id !== 'tFirma');
        const pisadas = [];
        for (let a = 0; a < col.length; a++) for (let b = a + 1; b < col.length; b++) {
          const A = col[a], B = col[b];
          if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) {
            const contiene = (X, Y) => X.left <= Y.left && X.top <= Y.top && X.right >= Y.right && X.bottom >= Y.bottom;
            if (!contiene(A, B) && !contiene(B, A)) pisadas.push(A.id + '×' + B.id);
          }
        }
        // la grilla de niveles puede tener su propio scroll, pero la página no
        return { fuera: fuera.filter((c) => !/nivelB/.test(String(c.id))).map((c) => c.id), pisadas, ancho: document.documentElement.scrollWidth <= innerWidth };
      }, pantalla === 'pausa' ? 'pausa' : pantalla);
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
  const a = await G(pg, '({ dpr: G.dpr, W: G.W, ancho: innerWidth })');
  afirmar(a.dpr === 2 && a.W === a.ancho * 2, JSON.stringify(a));
  await pg.click('#bAjustes');
  await pg.click('#listaAjustes .item:nth-child(5) .opcion:nth-child(3)');         // baja
  const b = await G(pg, '({ dpr: G.dpr, W: G.W, ancho: innerWidth })');
  afirmar(b.dpr === 1 && b.W === b.ancho, JSON.stringify(b));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el sonido arranca con el primer toque y ningún efecto ni canción falla', async () => {
  const pg = await pagina({ q: 'idioma=es' });
  await pg.mouse.click(206, 300);
  const r = await pg.evaluate(async () => {
    const s = window.__G.sonido, espera = (ms) => new Promise((f) => setTimeout(f, ms));
    const activo = s.activo();
    for (const n of ['boton', 'golpe', 'moneda', 'moneda', 'pum', 'meta', 'lluvia', 'pendulo', 'compra', 'error', 'cambia']) { s.tocar(n, { vel: 600 }); await espera(40); }
    for (const m of ['menu', 'juego']) { s.musica(m); await espera(300); }
    const j = s.jingleJXS(); await espera(100); j?.cortar();
    return { activo, errores: s.errores, jingle: !!j };
  });
  afirmar(r.activo && r.jingle, 'el audio no arrancó con el clic: ' + JSON.stringify(r));
  afirmar(r.errores.length === 0, 'errores de sonido: ' + r.errores.join(' | '));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el infinito: altura y récord, que queda guardado', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio' });
  await pg.click('#bInfinito');
  afirmar(await G(pg, 'G.estado === "juego" && G.partida.infinito'), 'INFINITO no arrancó');
  await pg.evaluate(() => { const p = window.__G.partida; p.globo.y = -4321; });
  await pasos(pg, 2);
  await captura(pg, 'infinito');
  await pg.evaluate(() => { const p = window.__G.partida; p.reventar(p.escudo); });
  await pasos(pg, 80);
  const r = await pg.evaluate((clave) => ({ causa: document.getElementById('tPumCausa').textContent, record: document.getElementById('tPumRecord').textContent, g: JSON.parse(localStorage.getItem(clave)).mejorAltura }), CLAVE);
  afirmar(r.causa.startsWith('Llegaste a 43') && r.record === '¡Nuevo récord!' && r.g >= 432, JSON.stringify(r));
  await sinErrores(pg);
  await cerrar(pg);
  return r.causa;
});

await prueba('lo que tarda un cuadro en un nivel cargado (SwiftShader y sin placa: no dice nada del teléfono)', async () => {
  const notas = [];
  for (const dsf of [1, 1.5]) {
    const pg = await pagina({ q: 'idioma=es', dsf });
    const r = await pg.evaluate(() => {
      const G = window.__G;
      G.jugar(22);
      const vivo = () => { if (G.partida.estado !== 'juego') G.jugar(22); };
      for (let k = 0; k < 400; k++) { G.mover(Math.sin(k / 15) * 6, 0); G.pasos(1); vivo(); }
      const t0 = performance.now();
      for (let k = 0; k < 300; k++) { G.mover(Math.sin(k / 15) * 6, 0); G.pasos(1); vivo(); }
      const t1 = performance.now();
      for (let k = 0; k < 200; k++) G.dibujar();
      const t2 = performance.now();
      // anotar las órdenes no es pintarlas: leer un píxel obliga a pintar de verdad
      const c = document.getElementById('juego').getContext('2d');
      c.getImageData(0, 0, 1, 1);
      const t3 = performance.now();
      for (let k = 0; k < 10; k++) { G.dibujar(); c.getImageData(0, 0, 1, 1); }
      const t4 = performance.now();
      return { paso: (t1 - t0) / 300, dibujo: (t2 - t1) / 200, pintado: (t4 - t3) / 10, W: G.W, H: G.H, cuerpos: G.partida.mundo.cuerpos.length };
    });
    notas.push(`${r.W}×${r.H}: paso ${r.paso.toFixed(2)} ms, órdenes ${r.dibujo.toFixed(2)} ms, pintado ${r.pintado.toFixed(0)} ms (${r.cuerpos} cuerpos)`);
    await sinErrores(pg);
    await cerrar(pg);
  }
  return notas.join('; ');
});

await nav.close();
console.log(fallas ? `\n${fallas} de ${total} pruebas fallaron` : `\n${total} pruebas, todas bien`);
process.exit(fallas ? 1 : 0);
