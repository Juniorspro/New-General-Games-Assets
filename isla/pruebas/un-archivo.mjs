// El archivo único tiene que andar con DOBLE CLIC: se abre desde file:// y se
// exige que no pida NINGÚN archivo suelto (un pedido fallido contra file:// no
// avisa nada y la pantalla igual se ve bien: sin esta comprobación, un
// empaquetado a medias pasa desapercibido).
//
//   node pruebas/un-archivo.mjs /ruta/absoluta/isla-en-un-archivo.html
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const ARCH = process.argv[2];
let ok = 0, mal = 0;
const ch = (n, c, d = '') => { c ? ok++ : mal++; console.log(`  ${c ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`); };
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await nav.newPage({ viewport: { width: 892, height: 412 }, hasTouch: true, isMobile: true });
const err = [], sueltos = [];
pg.on('pageerror', (e) => err.push(e.message));
pg.on('console', (m) => { if (m.type() === 'error') err.push('consola: ' + m.text().slice(0, 200)); });
pg.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith('blob:') && u.split('?')[0] !== 'file://' + ARCH) sueltos.push(u.slice(0, 110)); });
const t0 = Date.now();
await pg.goto('file://' + ARCH + '?pausa&idioma=pt');
const cargo = await pg.waitForFunction(() => window.__isla && window.__isla.listo, null, { timeout: 90000 }).then(() => true).catch(() => false);
ch('la isla carga desde el archivo único', cargo, `${Date.now() - t0} ms`);
ch('no pide ningún archivo suelto', sueltos.length === 0, sueltos.slice(0, 3).join(' | '));
if (cargo) {
  const r = await pg.evaluate(() => {
    const I = window.__isla, J = I.J;
    I.paso(1 / 30);
    const menu = [...document.querySelectorAll('#opciones button')].map((b) => b.textContent);
    J.empezar(false);
    for (let i = 0; i < 50; i++) I.paso(1 / 20, false);
    I.paso(1 / 30);
    return { menu, estado: J.estado, dedos: !document.getElementById('dedos').classList.contains('oculto'), titulo: document.title };
  });
  ch('el menú aparece en el idioma pedido', r.menu[0] === 'JOGAR' && r.titulo === 'A Ilha', r.menu.join(' · '));
  ch('se entra a jugar', r.estado === 'jugando');
  ch('en un teléfono aparecen los controles de dedo', r.dedos);
}
// la intro de JXSTUDIOS también viaja en el archivo único
await pg.goto('file://' + ARCH + '?pausa&intro&idioma=pt');
const cargo2 = await pg.waitForFunction(() => window.__isla && window.__isla.listo, null, { timeout: 90000 }).then(() => true).catch(() => false);
if (cargo2) {
  await pg.tap('#introEntrar');
  const ri = await pg.evaluate(() => {
    const I = window.__isla, J = I.J, empezo = !!J.intro && J.intro.t === 0;
    for (let i = 0; i < 80; i++) I.paso(1 / 60, false);
    I.paso(1 / 60, true);
    for (let i = 0; i < 120; i++) I.paso(1 / 60, false);
    return { empezo, estado: J.estado };
  });
  ch('la intro de JXSTUDIOS corre y deja en el menú', ri.empezo && ri.estado === 'menu', JSON.stringify(ri));
} else ch('la intro de JXSTUDIOS corre y deja en el menú', false, 'no cargó');
ch('sin errores de JavaScript', err.length === 0, err.slice(0, 3).join(' | '));
console.log(`\n  ${ok}/${ok + mal}`);
await nav.close();
process.exit(mal ? 1 : 0);
