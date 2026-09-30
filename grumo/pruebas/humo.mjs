// prueba de humo de Grumo en Chromium: intro → idioma → menú → escenas → jugar
// (morir una vez y ganar con la solución) → la última escena → el final → camarín
// y ajustes. Uso: node humo.mjs [url base] (sirve también con file://); las
// capturas van a $SALIDA o a la carpeta temporal
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
const S = (process.env.SALIDA || tmpdir()) + '/';
const sol = JSON.parse(readFileSync(new URL('./soluciones.json', import.meta.url), 'utf8'));
const base = process.argv[2] || 'http://127.0.0.1:8123/grumo/index.html';
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pg = await ctx.newPage(), errores = [], log = [];
pg.on('pageerror', (e) => errores.push(String(e.stack || e).slice(0, 400)));
pg.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 300)); });
const foto = (n) => pg.screenshot({ path: `${S}h-${n}.png` });
const ok = (c, que) => { log.push(`${c ? 'ok ' : 'MAL'} ${que}`); };
await pg.goto(base + (base.includes('?') ? '&' : '?') + 'pausa&limpio&intro');
await pg.waitForFunction(() => window.listo, null, { timeout: 30000 });
// la intro sola termina y, la primera vez, pregunta el idioma
const tras = await pg.evaluate(() => { const G = window.__G; let k = 0; while (G.estado === 'intro' && k++ < 1200) G.pasos(1); G.pasos(30, true); return { estado: G.estado, s: k / 120 }; });
ok(tras.estado === 'idiomas', `intro → idiomas en ${tras.s.toFixed(1)} s`);
await foto('idiomas');
await pg.click('#idiomasBotones button >> nth=0');
await pg.evaluate(() => window.__G.pasos(40, true));
ok(await pg.evaluate(() => window.__G.estado) === 'menu', 'elegir idioma → menú');
await foto('menu');
// escenas: dos sets, el segundo cerrado
await pg.click('#bEscenas');
const sets = await pg.$$eval('#listaSets .set', (bs) => bs.map((b) => b.className));
ok(sets.length === 2 && sets[1].includes('cerrado'), `escenas: ${sets.length} sets (${sets.join(' | ')})`);
await pg.click('#listaSets .set >> nth=0');
ok((await pg.$$('#grillaNiveles button')).length === 10, 'el taller tiene 10 escenas');
await foto('niveles');
// jugar una escena: morir corriendo, después ganar con la solución
async function jugarConPlan(i, plan, morirAntes) {
  return pg.evaluate(({ i, plan, morirAntes }) => {
    const G = window.__G, e = G.entrada; e.teclas.clear();
    // hasta el golpe de la claqueta no hay control: el plan corre desde ahí
    const hastaGolpe = () => { let n = 0; while (G.tEscena < 0.63 && n++ < 200) G.pasos(1); };
    G.jugar(i); hastaGolpe();
    const r = {};
    if (morirAntes) {
      e.teclas.add('ArrowRight'); let k = 0;
      while (G.partida.estado === 'juego' && k++ < 400) G.pasos(1);
      e.teclas.clear(); r.primera = G.partida.estado + ' ' + (G.partida.causa || '');
      let n = 0; while (G.partida.estado !== 'juego' && n++ < 600) G.pasos(1);  // la toma nueva
      hastaGolpe(); r.toma = G.toma;
    }
    const p = G.partida, s0 = p.pasos, pasoDe = plan.map((c) => s0 + Math.round(c[0] * 120)); let k = 0;
    while (G.estado === 'juego' && G.partida === p && p.pasos < 2400) {
      while (k < plan.length && pasoDe[k] <= p.pasos) { e.teclas.clear(); if (plan[k][1] < 0) e.teclas.add('ArrowLeft'); if (plan[k][1] > 0) e.teclas.add('ArrowRight'); if (plan[k][2]) e.teclas.add('Space'); k++; }
      G.pasos(1);
    }
    e.teclas.clear(); r.fin = p.estado; G.pasos(150, true); r.estado = G.estado; r.monedas = G.datos.monedas;
    return r;
  }, { i, plan, morirAntes });
}
const r1 = await jugarConPlan(0, sol['1-1'], false);
ok(r1.fin === 'gano' && r1.estado === 'gano', `1-1 gana (${JSON.stringify(r1)})`);
await foto('gano');
const r2 = await jugarConPlan(12, sol['2-3'], true);
ok(r2.primera.startsWith('muerto') && r2.toma === 2 && r2.fin === 'gano', `2-3: muere corriendo y gana en la toma 2 (${JSON.stringify(r2)})`);
// la última: con todo abierto, ganar la 2-10 lleva al final
await pg.evaluate(() => { const G = window.__G; for (let i = 0; i < 19; i++) G.datos.mejor[i] = G.datos.mejor[i] || 3; });
const r3 = await jugarConPlan(19, sol['2-10'], false);
await pg.evaluate(() => { const G = window.__G; if (G.estado === 'gano') document.getElementById('bSiguienteNivel').click(); G.pasos(60, true); });
ok(await pg.evaluate(() => window.__G.estado) === 'final', `2-10 gana y muestra el final (${JSON.stringify(r3)})`);
await foto('final');
// camarín y ajustes
await pg.evaluate(() => { const G = window.__G; G.aMenu(); G.pasos(40, true); });
await pg.click('#bCamarin'); await pg.evaluate(() => window.__G.pasos(30, true));
ok(await pg.evaluate(() => window.__G.estado) === 'camarin', 'abre el camarín');
await pg.click('#bSiguiente'); await pg.click('#bComprar'); await pg.evaluate(() => window.__G.pasos(30, true));
await foto('camarin');
await pg.click('#bVolverCamarin'); await pg.click('#bAjustes'); await pg.evaluate(() => window.__G.pasos(10, true));
ok(await pg.evaluate(() => window.__G.estado) === 'ajustes', 'abre los ajustes');
await foto('ajustes');
// fotos de escenas nuevas en juego
for (const [i, n] of [[12, '2-3'], [15, '2-6'], [18, '2-9']]) {
  await pg.evaluate((i) => { const G = window.__G; G.aMenu(); G.jugar(i); G.pasos(160, true); }, i);
  await foto('escena-' + n);
}
console.log(log.join('\n'));
console.log('errores:', errores.length ? errores : 'ninguno');
await nav.close();
