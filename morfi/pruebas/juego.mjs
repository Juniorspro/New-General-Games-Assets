// Las pruebas en el navegador (Chromium sin placa de video, ver memoria/probar.md).
//   (desde la raíz del repo) python3 -m http.server 8123 --bind 127.0.0.1 &
//   node morfi/pruebas/juego.mjs [--capturas carpeta]
//
// El juego se abre con ?pausa: no avanza solo (tampoco hay intro, salvo con
// ?intro) y la prueba lo hace avanzar de a pasos de 1/60 s. Las sondas están
// en window.__G (main.js). Los clics, las teclas y los dedos son de verdad
// (Playwright y CDP), no llamadas a funciones: así se prueba también el HTML.
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const BASE = process.env.MORFI_URL || 'http://127.0.0.1:8123/morfi/index.html';
const CLAVE = 'morfi-1';
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > 0 ? process.argv[iCap + 1] : null;

const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let fallas = 0, total = 0;

// `quieto`: sin animaciones de CSS (la tarjeta del final entra girando y, a
// mitad de camino, sus cajas se pisan: para medir, se mide quieta)
async function pagina({ w = 412, h = 892, q = '', toque = false, dsf = 1, quieto = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, hasTouch: toque, isMobile: toque, reducedMotion: quieto ? 'reduce' : 'no-preference' });
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
    console.log(`  FALLA ${nombre}: ${String(e.message || e).slice(0, 700)}`);
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
// del tablero (320 × 480) a píxeles de CSS, con la cámara del último dibujo
const aCss = (pg, x, y) => pg.evaluate(([x, y]) => { const c = window.__G.camJuego, d = window.__G.dpr; return [(c.ox + x * c.esc) / d, (c.oy + y * c.esc) / d]; }, [x, y]);
// los dedos de verdad, por CDP
async function dedos(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  const enviar = (type, puntos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y, id]) => ({ x, y, id, radiusX: 6, radiusY: 6, force: 1 })) });
  // un tajo de (x1, y1) a (x2, y2) en n pedacitos, con un paso de juego entre cada uno
  enviar.tajo = async (x1, y1, x2, y2, n = 6, id = 1) => {
    await enviar('touchStart', [[x1, y1, id]]);
    for (let k = 1; k <= n; k++) { await enviar('touchMove', [[x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n, id]]); await pasos(pg, 1, false); }
    await enviar('touchEnd', []);
  };
  enviar.toque = async (x, y) => { await enviar('touchStart', [[x, y, 1]]); await pasos(pg, 1, false); await enviar('touchEnd', []); };
  return enviar;
}
// cuántos colores distintos hay en un pedazo del lienzo (para saber si algo se dibujó)
const muestra = (pg, x, y, w, h) => pg.evaluate(([x, y, w, h]) => {
  const c = document.getElementById('juego'), d = c.getContext('2d').getImageData(x * c.width, y * c.height, w * c.width, h * c.height).data;
  const colores = new Set();
  for (let k = 0; k < d.length; k += 16) colores.add((d[k] >> 4) * 256 + (d[k + 1] >> 4) * 16 + (d[k + 2] >> 4));
  return colores.size;
}, [x, y, w, h]);
// jugar hasta que la partida termine (o `n` pasos)
const hastaFin = (pg, n = 600) => pg.evaluate((n) => { const G = window.__G; for (let k = 0; k < n && G.estado === 'juego' && G.partida.estado === 'juego'; k++) G.pasos(1); G.pasos(1, true); return G.partida.estado; }, n);

await prueba('arranca en el menú: el cartel colgado que se hamaca, Morfi con su caramelo, los botones y las monedas', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio', toque: true });
  await pasos(pg, 60);
  afirmar(await G(pg, 'G.estado') === 'menu' && await visible(pg, 'menu'), 'no está el menú');
  afirmar(await texto(pg, 'tJugar') === 'JUGAR' && (await texto(pg, 'tNivelJugar')).includes('1-1'), 'el botón JUGAR no dice el nivel: ' + await texto(pg, 'tNivelJugar'));
  afirmar(await texto(pg, 'tMonedas') === '0' && await texto(pg, 'tEstrellasMenu') === '0 / 90', 'las bolsas: ' + await texto(pg, 'tMonedas') + ' ' + await texto(pg, 'tEstrellasMenu'));
  // se hamaca: el dedo lo empuja (arrastrando por el fondo, entre el cartel y los botones)
  const b0 = await G(pg, 'G.fondo.balanceo'), d = await dedos(pg);
  await d.tajo(40, 470, 360, 470, 8);
  await pasos(pg, 6);
  const b1 = await G(pg, 'G.fondo.balanceo');
  afirmar(Math.abs(b1 - b0) > 0.02, 'el cartel no se movió con el dedo: ' + b0 + ' → ' + b1);
  // hay dibujo de verdad arriba (el cartel de colores) y en el medio (Morfi)
  const arriba = await muestra(pg, 0, 0.1, 1, 0.25), medio = await muestra(pg, 0.3, 0.5, 0.4, 0.2);
  afirmar(arriba > 40 && medio > 20, `poco dibujado: arriba ${arriba}, medio ${medio}`);
  await captura(pg, 'menu');
  await sinErrores(pg);
  await cerrar(pg);
  return `balanceo ${b0.toFixed(3)} → ${b1.toFixed(3)}, colores ${arriba}/${medio}`;
});

await prueba('en el menú se corta el hilo del caramelo con el dedo: Morfi lo come y baja otro', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio', toque: true });
  await pasos(pg, 30);
  // el hilo del menú va del alfiler al caramelo, en la escena del menú: se busca en pantalla
  const [x, y] = await pg.evaluate(() => { const F = window.__G.fondo, c = F.cam, d = window.__G.dpr, p = F.partida; return [(c.ox + p.pines[0].x * c.esc) / d, (c.oy + ((p.pines[0].y + p.y) / 2) * c.esc) / d]; });
  const d = await dedos(pg);
  await d.tajo(x - 60, y, x + 60, y + 4, 8);
  const cortado = await G(pg, 'G.fondo.partida.mundo.sostienen(G.fondo.partida.c).length === 0');
  await pasos(pg, 90);
  const comido = await G(pg, 'G.fondo.partida.estado');
  await captura(pg, 'menu-comido');
  await pasos(pg, 100);
  const otro = await G(pg, 'G.fondo.partida.estado === "juego" && G.fondo.partida.mundo.sostienen(G.fondo.partida.c).length === 1');
  afirmar(cortado && comido === 'comido' && otro, JSON.stringify({ cortado, comido, otro }));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('la intro de JXSTUDIOS está desde el primer cuadro, con su música, es de papel y deja en el menú; un toque la saltea', async () => {
  const pg = await pagina({ q: 'intro&idioma=es' });
  afirmar(await G(pg, 'G.estado') === 'intro', 'la intro no estaba desde el principio: ' + await G(pg, 'G.estado'));
  afirmar(await G(pg, 'G.sonido.activo() && !!G.intro.musica'), 'la música de la intro no arrancó');
  const colores = [];
  for (const [n, nombre] of [[40, 'intro-tijera'], [45, 'intro-recorte'], [45, 'intro-letras']]) {
    await pasos(pg, n);
    await captura(pg, nombre);
    colores.push(await muestra(pg, 0, 0.2, 1, 0.5));
  }
  // el corcho (marrón), no negro ni blanco
  const corcho = await pg.evaluate(() => { const c = document.getElementById('juego'), d = c.getContext('2d').getImageData(3, 3, 1, 1).data; return [d[0], d[1], d[2]]; });
  afirmar(corcho[0] > 100 && corcho[0] > corcho[2] + 30, 'el fondo de la intro no es el corcho: ' + corcho);
  afirmar(colores[1] > 30, 'el recorte de colores tiene pocos colores: ' + colores);
  afirmar(await G(pg, 'G.estado') === 'intro', 'la intro terminó antes de tiempo');
  await pasos(pg, 80);
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
  return 'colores por cuadro ' + colores.join(' / ') + ', corcho ' + corcho;
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
  afirmar(!r1.musica && espera < 1500, 'sin permiso tendría que arrancar muda y enseguida: ' + JSON.stringify({ ...r1, espera }));
  afirmar(r2.estado === 'menu', 'el toque no la salteó: ' + JSON.stringify(r2));
  afirmar(!err.length && !r2.errores.length, 'errores: ' + [...err, ...r2.errores].join(' | '));
  return `arrancó muda a los ${espera} ms de cargar`;
});

await prueba('después del logo, la primera vez, se elige el idioma; la segunda ya no', async () => {
  const pg = await pagina({ q: 'intro&limpio' });
  await pasos(pg, 220);
  afirmar(await G(pg, 'G.estado') === 'idiomas' && await visible(pg, 'idiomas'), 'después del logo: ' + await G(pg, 'G.estado'));
  await captura(pg, 'idiomas');
  await pg.click('#bIdioma_pt');
  const r = await pg.evaluate((clave) => ({ estado: window.__G.estado, jugar: document.getElementById('tJugar').textContent, guardado: JSON.parse(localStorage.getItem(clave)).ajustes.idioma }), CLAVE);
  afirmar(r.estado === 'menu' && r.jugar === 'JOGAR' && r.guardado === 'pt', JSON.stringify(r));
  await pg.goto(`${BASE}?pausa&intro`);
  await pg.waitForFunction(() => window.listo);
  await pasos(pg, 220);
  afirmar(await G(pg, 'G.estado') === 'menu', 'con el idioma ya elegido tendría que ir al menú: ' + await G(pg, 'G.estado'));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el dedo de verdad (CDP) corta el hilo del 1-1: Morfi come, tres estrellas, premio y se abre el 1-2', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio', toque: true });
  await pg.tap('#bJugar');
  afirmar(await G(pg, 'G.estado === "juego" && G.partida.def.id === "1-1"'), 'JUGAR no abrió el 1-1');
  await pasos(pg, 30);
  afirmar(await G(pg, '!!G.ayuda') && await visible(pg, 'bPausa'), 'la primera vez tendría que estar la ayuda y el botón de pausa');
  await captura(pg, 'nivel-1-1');
  // el hilo va del alfiler (160, 70) al caramelo (160, 175): un tajo de costado a la altura 120
  const [x1, y1] = await aCss(pg, 110, 120), [x2, y2] = await aCss(pg, 210, 124);
  const d = await dedos(pg);
  await d.tajo(x1, y1, x2, y2);
  afirmar(await G(pg, 'G.partida.mundo.sostienen(G.partida.c).length') === 0, 'el tajo no cortó el hilo');
  const fin = await hastaFin(pg);
  afirmar(fin === 'comido', 'Morfi no comió: ' + fin);
  const estrellas = await G(pg, 'G.partida.tomadas');
  await pasos(pg, 90);
  afirmar(await G(pg, 'G.estado') === 'gano' && await visible(pg, 'gano'), 'no está la tarjeta del final: ' + await G(pg, 'G.estado'));
  await pg.waitForTimeout(1300);
  await captura(pg, 'gano');
  const r = await pg.evaluate((clave) => ({
    llenas: document.querySelectorAll('#ganoEstrellas span.llena').length, titulo: document.getElementById('tGano').textContent,
    monedas: document.getElementById('tGanoMonedas').textContent, sig: !document.getElementById('bSiguienteNivel').classList.contains('oculto'),
    g: JSON.parse(localStorage.getItem(clave)),
  }), CLAVE);
  afirmar(estrellas === 3 && r.llenas === 3 && r.titulo === '¡Perfecto!' && r.monedas === '+25 monedas' && r.sig, JSON.stringify({ estrellas, ...r, g: undefined }));
  afirmar(r.g.mejor[0] === 3 && r.g.monedas === 25 && r.g.ayudas.includes('ayudaCortar'), 'no se guardó: ' + JSON.stringify(r.g));
  await pg.tap('#bSiguienteNivel');
  afirmar(await G(pg, 'G.estado === "juego" && G.partida.def.id === "1-2"'), 'SIGUIENTE no jugó el 1-2');
  // otra vez el 1-1: la ayuda ya no sale y ganarlo de nuevo da 2
  await pg.evaluate(() => window.__G.jugar(0));
  afirmar(await G(pg, 'G.ayuda === null'), 'la ayuda salió de nuevo');
  await sinErrores(pg);
  await cerrar(pg);
  return `${estrellas}★, ${r.monedas}`;
});

await prueba('dos dedos cortan dos hilos a la vez (1-2)', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio&directo=nivel:1-2', toque: true });
  await pasos(pg, 20);
  // los hilos: (50, 84) → (90, 200) y (200, 78) → (90, 200); se cruzan a la altura 140
  const [a1x, a1y] = await aCss(pg, 40, 140), [a2x, a2y] = await aCss(pg, 100, 140);
  const [b1x, b1y] = await aCss(pg, 120, 150), [b2x, b2y] = await aCss(pg, 190, 130);
  const d = await dedos(pg);
  await d('touchStart', [[a1x, a1y, 1], [b1x, b1y, 2]]);
  for (let k = 1; k <= 6; k++) { await d('touchMove', [[a1x + ((a2x - a1x) * k) / 6, a1y + ((a2y - a1y) * k) / 6, 1], [b1x + ((b2x - b1x) * k) / 6, b1y + ((b2y - b1y) * k) / 6, 2]]); await pasos(pg, 1, false); }
  await d('touchEnd', []);
  const n = await G(pg, 'G.partida.mundo.sostienen(G.partida.c).length');
  afirmar(n === 0, 'quedaron hilos sin cortar: ' + n);
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('un toque revienta el globo (2-1) y otro hace soplar el abanico (2-2)', async () => {
  const pg = await pagina({ q: 'idioma=es&todo&directo=nivel:2-1', toque: true });
  await pasos(pg, 20);
  const d = await dedos(pg);
  const [x1, y1] = await aCss(pg, 120, 90), [x2, y2] = await aCss(pg, 200, 92);
  await d.tajo(x1, y1, x2, y2);
  await pasos(pg, 60);
  afirmar(await G(pg, '!!G.partida.enGlobo'), 'el caramelo no entró al globo');
  const [cx, cy] = await pg.evaluate(() => { const G = window.__G, c = G.camJuego, dp = G.dpr; return [(c.ox + G.partida.x * c.esc) / dp, (c.oy + G.partida.y * c.esc) / dp]; });
  await captura(pg, 'globo');
  await d.toque(cx + 8, cy - 6);
  afirmar(await G(pg, '!G.partida.enGlobo'), 'el toque no reventó el globo');
  await pg.evaluate(() => window.__G.jugar(11));
  await pasos(pg, 10);
  const [fx, fy] = await aCss(pg, 30, 360);
  await d.toque(fx, fy);
  afirmar(await G(pg, 'G.partida.abanicos[0].soplo > 0'), 'el toque no hizo soplar el abanico');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('se cae o se rompe: el cartelito y vuelve a empezar solo', async () => {
  const pg = await pagina({ q: 'idioma=es&todo&directo=nivel:1-4' });
  // 1-4: cortar enseguida lo tira lejos de Morfi
  await pasos(pg, 5);
  await pg.evaluate(() => window.__G.partida.accion(['c', 0]));
  const fin = await hastaFin(pg);
  afirmar(fin === 'perdido', 'tendría que perderse: ' + fin);
  await pasos(pg, 20);
  await captura(pg, 'se-cayo');
  afirmar(await G(pg, 'G.partida.estado') === 'perdido', 'el cartelito no estuvo un rato');
  await pasos(pg, 80);
  const r = await G(pg, '({ estado: G.estado, p: G.partida.estado, t: G.partida.t, id: G.partida.def.id })');
  afirmar(r.estado === 'juego' && r.p === 'juego' && r.t < 0.5 && r.id === '1-4', 'no volvió a empezar: ' + JSON.stringify(r));
  // 2-3: cortar los dos a la vez lo tira sobre las chinches
  await pg.evaluate(() => { const G = window.__G; G.jugar(12); G.pasos(5); G.partida.accion(['c', 0]); G.partida.accion(['c', 1]); });
  const roto = await hastaFin(pg);
  afirmar(roto === 'roto', 'tendría que romperse en las chinches: ' + roto);
  await pasos(pg, 100);
  afirmar(await G(pg, 'G.estado === "juego" && G.partida.estado === "juego" && G.partida.def.id === "2-3"'), 'después de romperse no volvió a empezar');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('el mouse corta arrastrando con el botón apretado (sin apretar, no); P y Escape pausan; R y el botón reinician', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio&directo=nivel:1-1' });
  await pasos(pg, 20);
  const [x1, y1] = await aCss(pg, 110, 120), [x2, y2] = await aCss(pg, 210, 124);
  await pg.mouse.move(x1, y1); await pg.mouse.move(x2, y2, { steps: 6 }); await pasos(pg, 2);
  afirmar(await G(pg, 'G.partida.mundo.sostienen(G.partida.c).length') === 1, 'el mouse sin apretar cortó');
  await pg.mouse.move(x1, y1); await pg.mouse.down(); await pg.mouse.move(x2, y2, { steps: 6 }); await pg.mouse.up(); await pasos(pg, 2);
  afirmar(await G(pg, 'G.partida.mundo.sostienen(G.partida.c).length') === 0, 'el mouse apretado no cortó');
  await pg.evaluate(() => window.__G.jugar(0));
  await pasos(pg, 5);
  await pg.keyboard.press('KeyP');
  afirmar(await G(pg, 'G.estado') === 'pausa' && await visible(pg, 'pausa'), 'P no pausó');
  const t0 = await G(pg, 'G.partida.t'); await pasos(pg, 30);
  afirmar(await G(pg, 'G.partida.t') === t0, 'en pausa la partida siguió');
  await pg.keyboard.press('Escape');
  afirmar(await G(pg, 'G.estado') === 'juego', 'Escape no sacó la pausa');
  await pasos(pg, 60);
  await pg.keyboard.press('KeyR');
  afirmar(await G(pg, 'G.partida.t') < 0.1, 'R no reinició');
  await pasos(pg, 60);
  await pg.click('#bReiniciar');
  afirmar(await G(pg, 'G.partida.t') < 0.1, 'el botón no reinició');
  await pg.click('#bPausa'); await pg.click('#bSalirPausa');
  afirmar(await G(pg, 'G.estado') === 'menu', 'MENÚ desde la pausa no volvió al menú');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('las cajas: la de cartón abierta, las otras con candado hasta juntar estrellas; adentro se abren de a uno', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio' });
  await pg.click('#bCajas');
  afirmar(await G(pg, 'G.estado') === 'cajas', 'CAJAS no abrió las cajas');
  const cerradas = await pg.evaluate(() => [...document.querySelectorAll('#listaCajas .caja')].map((b) => b.classList.contains('cerrada')));
  afirmar(JSON.stringify(cerradas) === '[false,true,true]', 'cerradas: ' + cerradas);
  await pg.click('#listaCajas .caja:nth-child(2)');
  afirmar(await G(pg, 'G.estado') === 'cajas', 'la caja cerrada se abrió');
  await pg.click('#listaCajas .caja:nth-child(1)');
  afirmar(await G(pg, 'G.estado') === 'niveles', 'la caja de cartón no mostró sus niveles');
  await captura(pg, 'niveles');
  const n = await pg.evaluate(() => [...document.querySelectorAll('#grillaNiveles .nivelB')].map((b) => (b.classList.contains('cerrado') ? 0 : 1)).join(''));
  afirmar(n === '1000000000', 'al principio solo el primero: ' + n);
  await pg.click('#grillaNiveles .nivelB:nth-child(3)');
  afirmar(await G(pg, 'G.estado') === 'niveles', 'el nivel cerrado se jugó');
  // ganar el 1-4 con 12 estrellas en total abre el cuaderno (y lo avisa)
  await pg.evaluate(() => { const G = window.__G; G.datos.mejor[0] = 3; G.datos.mejor[1] = 3; G.datos.mejor[2] = 3; G.jugar(3); const s = G.partida.def.sol; for (let k = 0; k < 900 && G.partida.estado === 'juego'; k++) { for (const a of s) if (Math.abs(a[0] - G.partida.t) < 1 / 120) G.partida.accion(a.slice(1)); G.pasos(1); } G.pasos(100, true); });
  const aviso = await texto(pg, 'tGanoAviso');
  afirmar(aviso.includes('Cuaderno'), 'no avisó la caja nueva: ' + aviso);
  await pg.click('#bMenuGano'); await pg.click('#bCajas');
  const cerradas2 = await pg.evaluate(() => [...document.querySelectorAll('#listaCajas .caja')].map((b) => b.classList.contains('cerrada')));
  afirmar(JSON.stringify(cerradas2) === '[false,false,true]', 'después de 12 estrellas: ' + cerradas2);
  await captura(pg, 'cajas');
  await sinErrores(pg);
  await cerrar(pg);
  return aviso;
});

await prueba('la tienda: comprar un Morfi con monedas, usarlo en el juego, no alcanza para otro, y los caramelos', async () => {
  const pg = await pagina({ q: 'idioma=es&limpio' });
  await pg.evaluate(() => { window.__G.datos.monedas = 120; });
  await pg.click('#bTienda');
  await pg.click('#bSiguiente');
  afirmar(await texto(pg, 'tNombre') === 'De regalo' && await texto(pg, 'bComprar') === 'COMPRAR · 50', 'la segunda: ' + await texto(pg, 'tNombre') + ' ' + await texto(pg, 'bComprar'));
  await pg.click('#bComprar');
  const r = await G(pg, '({ m: G.datos.monedas, morfi: G.datos.morfi, tiene: G.datos.morfis })');
  afirmar(r.m === 70 && r.morfi === 'regalo' && r.tiene.includes('regalo') && await texto(pg, 'bComprar') === 'EN USO', JSON.stringify(r));
  await pasos(pg, 20);
  await captura(pg, 'tienda');
  for (let k = 0; k < 6; k++) await pg.click('#bSiguiente');
  afirmar(await texto(pg, 'tNombre') === 'JXSTUDIOS' && (await texto(pg, 'tAviso')).includes('170'), 'no avisa lo que falta: ' + await texto(pg, 'tAviso'));
  await pg.click('#bComprar');
  afirmar(await G(pg, 'G.datos.monedas') === 70, 'compró sin plata');
  await pg.click('#bPestDulces'); await pg.click('#bSiguiente'); await pg.click('#bComprar');
  afirmar(await G(pg, 'G.datos.dulce === "frutilla" && G.datos.monedas === 45'), 'el caramelo: ' + await G(pg, 'JSON.stringify([G.datos.dulce, G.datos.monedas])'));
  await pasos(pg, 20);
  await captura(pg, 'tienda-caramelos');
  await pg.click('#bVolverTienda'); await pg.click('#bJugar');
  afirmar(await G(pg, 'G.morfi.piel === "regalo"'), 'en el juego Morfi no tiene la piel comprada');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('ajustes: idioma y música quedan guardados; borrar pide dos toques', async () => {
  const pg = await pagina({ q: 'idioma=es' });
  await pg.evaluate(() => { const G = window.__G; G.datos.monedas = 55; G.datos.mejor[0] = 2; });
  await pg.click('#bAjustes');
  await pg.click('#listaAjustes .item:nth-child(5) .opcion:nth-child(2)');   // EN
  await pg.click('#listaAjustes .item:nth-child(1) .opcion:nth-child(2)');   // música no
  const r = await pg.evaluate((clave) => ({ volver: document.getElementById('bCerrarAjustes').textContent, g: JSON.parse(localStorage.getItem(clave)).ajustes }), CLAVE);
  afirmar(r.volver === 'BACK' && r.g.idioma === 'en' && r.g.musica === false, JSON.stringify(r));
  const borrar = '#listaAjustes .item:nth-child(6) .opcion';
  await pg.click(borrar);
  afirmar(await G(pg, 'G.datos.monedas') === 55, 'borró con un solo toque');
  await pg.click(borrar);
  afirmar(await G(pg, 'G.datos.monedas === 0 && G.datos.mejor[0] === -1 && G.datos.ajustes.idioma === "en"'), 'el segundo toque no borró (o borró el idioma)');
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('los tres idiomas', async () => {
  const vistos = [];
  for (const [l, jugar, cajas] of [['es', 'JUGAR', 'CAJAS'], ['en', 'PLAY', 'BOXES'], ['pt', 'JOGAR', 'CAIXAS']]) {
    const pg = await pagina({ q: 'idioma=' + l });
    const r = [await texto(pg, 'tJugar'), await texto(pg, 'bCajas'), await pg.evaluate(() => document.documentElement.lang)];
    afirmar(r[0] === jugar && r[1] === cajas && r[2] === l, l + ': ' + r);
    vistos.push(r[0]);
    await cerrar(pg);
  }
  return vistos.join(' / ');
});

await prueba('entra en cinco pantallas: nada se sale ni se pisa', async () => {
  const notas = [], malas = [];
  for (const [w, h] of [[412, 892], [360, 640], [320, 568], [892, 412], [1280, 720]]) {
    const pg = await pagina({ w, h, q: 'idioma=es&limpio', quieto: true });
    await pg.evaluate(() => { window.__G.datos.monedas = 98765; window.__G.aMenu(); });
    for (const pantalla of ['menu', 'cajas', 'niveles', 'tienda', 'ajustes', 'pausa', 'gano', 'idiomas']) {
      await pg.evaluate((pantalla) => {
        const G = window.__G, clic = (id) => document.getElementById(id).click();
        G.aMenu();
        if (pantalla === 'cajas') clic('bCajas');
        if (pantalla === 'niveles') { clic('bCajas'); document.querySelector('#listaCajas .caja').click(); }
        if (pantalla === 'tienda') G.abrirTienda('morfis');
        if (pantalla === 'ajustes') clic('bAjustes');
        if (pantalla === 'idiomas') G.elegirIdioma();
        if (pantalla === 'pausa') { G.jugar(0); G.pasos(2); G.pausar(); }
        if (pantalla === 'gano') { G.jugar(0); G.pasos(30); G.partida.accion(['c', 0]); G.pasos(200); }
      }, pantalla);
      await pasos(pg, 2);
      const r = await pg.evaluate((id) => {
        const cajas = [...document.querySelectorAll(`#${id} button, #${id} p, #${id} h2, #${id} .item, #${id} .bolsa, #${id} .pestanas, #${id} .estrellas-gano`)]
          .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height > 0)
          .map((e) => ({ id: e.id || e.className, ...e.getBoundingClientRect().toJSON() }));
        const fuera = cajas.filter((c) => c.left < -1 || c.top < -1 || c.right > innerWidth + 1 || c.bottom > innerHeight + 1);
        // se pisan: dos cajas que se superponen (sin contar las de adentro de otra)
        const col = cajas.filter((c) => !/item|opcion|nivelB|caja /.test(String(c.id)) && c.id !== 'tFirma');
        const pisadas = [];
        for (let a = 0; a < col.length; a++) for (let b = a + 1; b < col.length; b++) {
          const A = col[a], B = col[b];
          if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) {
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

await prueba('el tablero entra entero en cada pantalla y deja lugar arriba para la etiqueta y las estrellas', async () => {
  const malas = [];
  for (const [w, h] of [[412, 892], [360, 640], [320, 568], [892, 412], [1280, 720]]) {
    const pg = await pagina({ w, h, q: 'idioma=es&todo&directo=nivel:2-10' });
    await pasos(pg, 3);
    const c = await G(pg, '({ ...G.camJuego, W: G.W, H: G.H, dpr: G.dpr })');
    const der = c.ox + 320 * c.esc, abajo = c.oy + 480 * c.esc;
    if (c.ox < -1 || der > c.W + 1 || c.oy < 50 * c.dpr || abajo > c.H + 1) malas.push(`${w}×${h}: ${JSON.stringify(c)}`);
    await captura(pg, `tablero-${w}x${h}`);
    await sinErrores(pg);
    await cerrar(pg);
  }
  afirmar(!malas.length, malas.join(' ; '));
});

await prueba('la densidad de pantalla: nítida con 2x y la calidad baja la vuelve 1x', async () => {
  const pg = await pagina({ q: 'idioma=es', dsf: 2 });
  const a = await G(pg, '({ dpr: G.dpr, W: G.W, ancho: innerWidth })');
  afirmar(a.dpr === 2 && a.W === a.ancho * 2, JSON.stringify(a));
  await pg.click('#bAjustes');
  await pg.click('#listaAjustes .item:nth-child(4) .opcion:nth-child(3)');         // baja
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
    for (const n of ['boton', 'corte', 'estrella', 'comer', 'gana', 'pega', 'pop', 'globo', 'soplo', 'sobre', 'boing', 'clip', 'roto', 'perdido', 'compra', 'error', 'cambia']) { s.tocar(n, { n: 2, fuerza: 500 }); await espera(40); }
    for (const m of ['menu', 'juego']) { s.musica(m); await espera(300); }
    const j = s.jingleJXS(); await espera(100); j?.cortar();
    return { activo, errores: s.errores, jingle: !!j };
  });
  afirmar(r.activo && r.jingle, 'el audio no arrancó con el clic: ' + JSON.stringify(r));
  afirmar(r.errores.length === 0, 'errores de sonido: ' + r.errores.join(' | '));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('las 30 soluciones guardadas, jugadas adentro del juego (con el dibujo), dan de comer con tres estrellas', async () => {
  const pg = await pagina({ q: 'idioma=es&todo' });
  const r = await pg.evaluate(() => {
    const G = window.__G, mal = [];
    for (let i = 0; i < 30; i++) {
      G.jugar(i);
      const p = G.partida, sol = [...p.def.sol].sort((a, b) => a[0] - b[0]);
      let k = 0;
      // de a un paso de física (1/120), para cortar en el mismo paso que la prueba de lógica
      while (p.estado === 'juego' && p.t < 12) { while (k < sol.length && sol[k][0] <= p.t + 1e-9) p.accion(sol[k++].slice(1)); p.paso(); if (p.pasos % 20 === 0) G.dibujar(); }
      if (p.estado !== 'comido' || p.tomadas !== 3) mal.push(`${p.def.id}: ${p.estado} ${p.tomadas}★`);
    }
    return mal;
  });
  afirmar(!r.length, r.join(', '));
  await sinErrores(pg);
  await cerrar(pg);
});

await prueba('lo que tarda un cuadro en un nivel cargado (SwiftShader y sin placa: no dice nada del teléfono)', async () => {
  const notas = [];
  for (const dsf of [1, 1.5]) {
    const pg = await pagina({ q: 'idioma=es&todo', dsf });
    const r = await pg.evaluate(() => {
      const G = window.__G;
      G.jugar(19); G.pasos(30, true);
      const t0 = performance.now();
      for (let k = 0; k < 60; k++) G.pasos(1, true);
      return (performance.now() - t0) / 60;
    });
    notas.push(`${dsf}x: ${r.toFixed(1)} ms`);
    await sinErrores(pg);
    await cerrar(pg);
  }
  return notas.join(', ');
});

await nav.close();
console.log(`\n${fallas ? 'FALLAN ' + fallas : 'todo bien'}: ${total} pruebas`);
process.exit(fallas ? 1 : 0);
