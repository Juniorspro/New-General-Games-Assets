// LAS JOYAS Y EL PROBADOR NUEVO (vuelta 12):
// - el regalo del día (+10 💎 una vez por día);
// - probarse antes de comprar: lo que no se tiene se ve puesto en el estudio, no en el muñeco
//   del mundo; la barra dice cuánto sale; "Sacar" lo saca; al salir, lo no comprado se saca;
// - comprar con orbes y con joyas (las joyas preguntan antes);
// - que el muñeco entre entero en lo que deja libre el panel, en cuatro pantallas;
// - la tienda de joyas: el anuncio de prueba (5 s, antes no hay premio), el tope por día y la
//   compra de prueba (el de bienvenida, una sola vez);
// - el modo TikTok con TTMinis falso (anuncio y pago con un servidor de mentira);
// - el botón de duplicar orbes al terminar un minijuego.
//     node pruebas/joyas.mjs
import { navegador, abrir, avanzar } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const esperarJuego = (pag) => pag.waitForFunction(() => window.__A && window.__A.reino && document.querySelector('.hud'), null, { timeout: 120000, polling: 250 });
const clic = (pag, sel, texto) => pag.evaluate(([sel, texto]) => { const b = [...document.querySelectorAll(sel)].find((q) => !texto || q.textContent.includes(texto)); if (b) b.click(); return !!b; }, [sel, texto]);

/* ------------------------------------------------ el regalo, probarse y comprar */
{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 1280, alto: 720 });
  await esperarJuego(pag);
  await pag.waitForTimeout(2200);
  const r1 = await pag.evaluate(() => { const G = window.__A.G; return { joyas: G.joyas, regalo: G.regalo, hud: document.querySelector('.hud .joyas')?.textContent }; });
  prueba('el regalo del día da 10 joyas y se ven arriba', r1.joyas === 10 && r1.hud === '10', JSON.stringify(r1));
  const r2 = await pag.evaluate(() => ({ dio: window.__A.regalo(), joyas: window.__A.G.joyas }));
  prueba('el regalo es uno por día', r2.dio === false && r2.joyas === 10, JSON.stringify(r2));

  await pag.evaluate(() => { const A = window.__A; A.G.orbes = 100; A.G.joyas = 160; A.J.abrirProbador(); });
  await avanzar(pag, 6); await pag.waitForTimeout(300);
  await clic(pag, '[data-g=cosas]'); await pag.waitForTimeout(150);
  await clic(pag, '.opciones-prob .item', 'Galera'); await pag.waitForTimeout(150); await avanzar(pag, 2);
  const r3 = await pag.evaluate(() => { const A = window.__A; return { mundo: A.yo.m.A.sombrero, guardado: A.G.A.sombrero, estudio: A.estudio?.m?.A?.sombrero ?? null, barra: document.querySelector('.prob-prueba.abierta')?.innerText.replace(/\s+/g, ' ') || '', probando: !!document.querySelector('.item.probando') }; });
  prueba('tocar lo que no se tiene lo prueba (se ve en el estudio, no en el mundo)', r3.guardado === 'ninguno' && r3.mundo !== 'galera' && r3.probando && /Galera/.test(r3.barra) && /25/.test(r3.barra), JSON.stringify(r3));
  await clic(pag, '.prob-prueba [data-a=sacar]'); await pag.waitForTimeout(100);
  const r4 = await pag.evaluate(() => ({ barra: !!document.querySelector('.prob-prueba.abierta'), probando: !!document.querySelector('.item.probando') }));
  prueba('"Sacar" lo saca', !r4.barra && !r4.probando, JSON.stringify(r4));
  await clic(pag, '.opciones-prob .item', 'Galera'); await pag.waitForTimeout(100);
  await clic(pag, '.prob-prueba [data-a=comprar]'); await pag.waitForTimeout(200);
  const r5 = await pag.evaluate(() => { const G = window.__A.G; return { orbes: G.orbes, tiene: G.tengo.includes('sombrero:galera'), puesto: G.A.sombrero, mundo: window.__A.yo.m.A.sombrero }; });
  prueba('comprar con orbes: descuenta, queda comprado y puesto', r5.orbes === 75 && r5.tiene && r5.puesto === 'galera' && r5.mundo === 'galera', JSON.stringify(r5));

  /* con joyas: no alcanzan (160 contra 200), después sí; pregunta antes */
  await clic(pag, '[data-p=espalda]'); await pag.waitForTimeout(150);
  const hay = await clic(pag, '.opciones-prob .item', 'mariposa') || (await clic(pag, '.paginas [data-pg="1"]'), await pag.waitForTimeout(100), await clic(pag, '.opciones-prob .item', 'mariposa'));
  await pag.waitForTimeout(150);
  const r6 = await pag.evaluate(() => ({ conseguir: !!document.querySelector('.prob-prueba [data-a=conseguir]'), comprar: !!document.querySelector('.prob-prueba [data-a=comprar]') }));
  prueba('con joyas que no alcanzan ofrece conseguir más', hay && r6.conseguir && !r6.comprar, JSON.stringify(r6));
  await pag.evaluate(() => { window.__A.G.joyas = 250; window.__A.UI._alCambiarJoyas(); });
  await pag.waitForTimeout(100);
  await clic(pag, '.prob-prueba [data-a=comprar]'); await pag.waitForTimeout(200);
  const pregunta = await pag.evaluate(() => !!document.querySelector('.velo'));
  await pag.evaluate(() => { const b = [...document.querySelectorAll('.velo .boton')].find((q) => q.classList.contains('primario')); b?.click(); });
  await pag.waitForTimeout(200);
  const r7 = await pag.evaluate(() => { const G = window.__A.G; return { joyas: G.joyas, tiene: G.tengo.includes('espalda:mariposa'), puesto: G.A.espalda }; });
  prueba('comprar con joyas: pregunta, descuenta y queda puesto', pregunta && r7.joyas === 50 && r7.tiene && r7.puesto === 'mariposa', JSON.stringify(r7));

  /* al salir con algo probado, se saca */
  await clic(pag, '[data-p=anteojos]'); await pag.waitForTimeout(100);
  await clic(pag, '.opciones-prob .item', 'Visor'); await pag.waitForTimeout(100);
  await clic(pag, '.prob-pie [data-a=listo]'); await pag.waitForTimeout(200);
  const r8 = await pag.evaluate(() => { const A = window.__A; return { anteojos: A.G.A.anteojos, mundo: A.yo.m.A.anteojos }; });
  prueba('al salir, lo que no se compró no queda puesto', r8.anteojos === 'ninguno' && r8.mundo === 'ninguno', JSON.stringify(r8));
  prueba('sin errores (probador)', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------ el muñeco entra entero en lo que deja el panel */
for (const [n, w, h, movil] of [['compu', 1280, 720, false], ['celu acostado', 844, 390, true], ['celu parado', 390, 844, true], ['angosto', 740, 360, true]]) {
  const { pag, ctx } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: w, alto: h, movil });
  await esperarJuego(pag);
  await pag.evaluate(() => { const A = window.__A; A.G.A.sombrero = 'arcoiris'; A.G.A.espalda = 'mariposa'; A.J.abrirProbador(); });
  await avanzar(pag, 8); await pag.waitForTimeout(250); await avanzar(pag, 2);
  const r = await pag.evaluate(() => {
    const A = window.__A, THREE = A.THREE, E = A.estudio, L = A.UI.libreProbador(), W = A.motor.ancho, H = A.motor.alto;
    E.escena.updateMatrixWorld(true); E.cam.updateMatrixWorld();
    const b = new THREE.Box3().setFromObject(E.m.raiz), v = new THREE.Vector3();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
      v.set(x, y, z).project(E.cam); const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    return { L, caja: [x0, y0, x1, y1].map(Math.round), alto: Math.round(y1 - y0), W, H };
  });
  const dentro = r.L && r.caja[0] >= r.L.x - 4 && r.caja[2] <= r.L.x + r.L.w + 4 && r.caja[1] >= r.L.y - 4 && r.caja[3] <= r.L.y + r.L.h + 4;
  prueba(`${n}: el muñeco (con arcoíris y alas) entra en lo libre`, dentro && r.alto > r.L.h * 0.45, `caja ${r.caja} en ${JSON.stringify(r.L)} · alto ${r.alto}`);
  await ctx.close();
}

/* ------------------------------------------------ la tienda, el anuncio y la compra de prueba */
{
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja', { ancho: 1280, alto: 720 });
  await esperarJuego(pag);
  await pag.evaluate(() => { window.__A.G.joyas = 0; window.__A.G.anuncios = { dia: null, n: 0 }; });
  await clic(pag, '.hud [data-a=joyas]'); await pag.waitForTimeout(200);
  prueba('la píldora de joyas abre la tienda', await pag.evaluate(() => !!document.querySelector('.tienda-joyas')));
  await clic(pag, '.tienda-joyas [data-a=anuncio]'); await pag.waitForTimeout(1200);
  const hayAd = await pag.evaluate(() => !!document.querySelector('.anuncio-prueba'));
  await clic(pag, '.anuncio-prueba [data-a=x]'); await pag.waitForTimeout(200);
  const r1 = await pag.evaluate(() => window.__A.G.joyas);
  prueba('cerrar el anuncio antes de tiempo no da premio', hayAd && r1 === 0, `joyas ${r1}`);
  await clic(pag, '.tienda-joyas [data-a=anuncio]'); await pag.waitForTimeout(5300);
  await clic(pag, '.anuncio-prueba [data-a=x]'); await pag.waitForTimeout(200);
  const r2 = await pag.evaluate(() => ({ joyas: window.__A.G.joyas, n: window.__A.G.anuncios.n, txt: document.querySelector('.tienda-joyas [data-a=anuncio] small')?.textContent }));
  prueba('verlo entero da 5 joyas y cuenta uno', r2.joyas === 5 && r2.n === 1 && /4/.test(r2.txt), JSON.stringify(r2));
  await pag.evaluate(() => { window.__A.G.anuncios.n = 5; });
  const tope = await pag.evaluate(async () => { const b = document.querySelector('.tienda-joyas [data-a=anuncio]'); b.disabled = false; b.click(); await new Promise((r) => setTimeout(r, 300)); return { joyas: window.__A.G.joyas, ad: !!document.querySelector('.anuncio-prueba') }; });
  prueba('con el tope del día no hay más anuncios', tope.joyas === 5 && !tope.ad, JSON.stringify(tope));
  /* compra de prueba: el de 550 y el de bienvenida (una vez) */
  await clic(pag, '.tj-paquete', '500'); await pag.waitForTimeout(200);
  const aviso = await pag.evaluate(() => document.querySelector('.compra-prueba')?.innerText || '');
  await clic(pag, '.compra-prueba [data-a=si]'); await pag.waitForTimeout(250);
  const r3 = await pag.evaluate(() => window.__A.G.joyas);
  prueba('la compra de prueba avisa que no cobra y suma 550', /no se cobra/.test(aviso) && r3 === 555, `joyas ${r3}`);
  await clic(pag, '.tj-paquete', 'Bienvenida'); await pag.waitForTimeout(200);
  await clic(pag, '.compra-prueba [data-a=si]'); await pag.waitForTimeout(250);
  const r4 = await pag.evaluate(() => ({ joyas: window.__A.G.joyas, orbes: window.__A.G.orbes, deshab: [...document.querySelectorAll('.tj-paquete')].find((b) => b.textContent.includes('Bienvenida'))?.disabled }));
  prueba('el de bienvenida da joyas y orbes y queda una sola vez', r4.joyas === 855 && r4.orbes >= 500 && r4.deshab, JSON.stringify(r4));
  /* duplicar al terminar un minijuego */
  await pag.evaluate(() => { const A = window.__A; A.UI.cerrarVentana(); A.G.anuncios.n = 0; A.G.orbes = 10; A.UI.resultadoTiro({ puntos: 100, aciertos: 5, tiros: 8, estrellas: 2, premio: 20 }, () => {}, () => {}); });
  await pag.waitForTimeout(200);
  const hayDup = await clic(pag, '[data-a=duplicar]'); await pag.waitForTimeout(5300);
  await clic(pag, '.anuncio-prueba [data-a=x]'); await pag.waitForTimeout(200);
  const r5 = await pag.evaluate(() => window.__A.G.orbes);
  prueba('duplicar con un anuncio al terminar el minijuego', hayDup && r5 === 30, `orbes ${r5}`);
  prueba('sin errores (tienda)', !errores.some((e) => !/ERR_FAILED/.test(e)), errores.filter((e) => !/ERR_FAILED/.test(e)).slice(0, 2).join(' | '));
  await ctx.close();
}

/* ------------------------------------------------ el modo TikTok, con TTMinis de mentira */
{
  const nav2 = nav;
  const ctx = await nav2.newContext({ viewport: { width: 1000, height: 600 } });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => {
    window.__llamadas = [];
    window.AEROPLAZA_CAJA = { tiktok: { anuncio: 'bloque-1', servidor: 'https://caja.prueba' } };
    window.TTMinis = {
      createRewardedVideoAd: (o) => { window.__llamadas.push('ad:' + o.adUnitId); let cb = null; return { onClose: (f) => { cb = f; }, onError: () => {}, show: () => { setTimeout(() => cb && cb({ isEnded: true }), 50); return Promise.resolve(); } }; },
      game: { login: (o) => { window.__llamadas.push('login'); o.success({ code: 'c1' }); }, pay: (o) => { window.__llamadas.push('pay:' + o.trade_order_id); setTimeout(() => o.success(), 30); } },
    };
  });
  await pag.route('https://caja.prueba/**', (r) => {
    const u = r.request().url();
    if (u.includes('/orden')) r.fulfill({ contentType: 'application/json', body: JSON.stringify({ trade_order_id: 't-9', orden: 'o-9' }) });
    else r.fulfill({ contentType: 'application/json', body: JSON.stringify({ entregado: true, joyas: 110 }) });
  });
  await pag.route(/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//, (r) => r.abort());
  const path = await import('node:path');
  await pag.goto('file://' + path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'aeroplaza.html') + '?directo&pausa&calidad=baja');
  await esperarJuego(pag);
  await pag.evaluate(() => { window.__A.G.joyas = 0; window.__A.G.anuncios = { dia: null, n: 0 }; });
  await clic(pag, '.hud [data-a=joyas]'); await pag.waitForTimeout(200);
  await clic(pag, '.tienda-joyas [data-a=anuncio]'); await pag.waitForTimeout(400);
  const r1 = await pag.evaluate(() => ({ joyas: window.__A.G.joyas, ll: window.__llamadas.join(',') }));
  prueba('TikTok: el anuncio con premio usa createRewardedVideoAd e isEnded', r1.joyas === 5 && /ad:bloque-1/.test(r1.ll), JSON.stringify(r1));
  await clic(pag, '.tj-paquete', '100'); await pag.waitForTimeout(800);
  const r2 = await pag.evaluate(() => ({ joyas: window.__A.G.joyas, ll: window.__llamadas.join(',') }));
  prueba('TikTok: la compra pide la orden al servidor, paga con pay() y suma lo que entrega el servidor', r2.joyas === 115 && /login/.test(r2.ll) && /pay:t-9/.test(r2.ll), JSON.stringify(r2));
  await ctx.close();
}
console.log(`\n${bien} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
