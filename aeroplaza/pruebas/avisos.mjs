// LOS AVISOS Y LO QUE TAPA LA PANTALLA: los avisos estilo Windows 7 van arriba
// de todo, en el hueco entre los dos grupos de botones (sin tapar ninguno), en
// compu, en el celu acostado y en el celu parado; la zona nueva es un aviso (no
// un cartel en el medio); los iguales se juntan (×2); hay uno solo a la vez (el
// último: pasar de zona en zona no apila dos o tres, lo pidió el 25/09); se
// van solos y con la cruz; suena la campanita (y no dos juntas). Las misiones
// solo se ven tocando 📜. En el parkour se esconde todo lo que no sirve para
// correr y no aparecen avisos. El tutorial es una pista chica.
//     node pruebas/avisos.mjs
import path from 'node:path';
import { navegador, abrir, avanzar, SAL } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
/* ¿se pisan dos rectángulos? */
const PISA = `(a, b) => !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)`;
for (const [ancho, alto, movil, nombre] of [[960, 540, false, 'compu'], [844, 390, true, 'celu'], [390, 844, true, 'celu parado']]) {
  const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja&hora=0.3', { ancho, alto, movil });
  await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.yo && window.__A.UI.hud, null, { timeout: 120000, polling: 250 });
  await avanzar(pag, 5);
  /* tres avisos de golpe: la zona, uno bueno y uno común */
  let r = await pag.evaluate((PISA) => {
    const pisa = eval(PISA), A = window.__A, U = A.UI;
    U.lugar('Ciudad de Vidrio', '🏙️'); U.avisar('Nimbo · 1/3'); U.avisar('¡Misión nueva!', 'azul');
    const ultimo = [...document.querySelectorAll('.noti')].map((n) => n.textContent).join('|');
    U.lugar('Bahía del Faro', '⚓');
    const notis = [...document.querySelectorAll('.noti')], R = notis.map((n) => n.getBoundingClientRect());
    const botones = [...document.querySelectorAll('.arriba-der > *, .arriba-izq > *')].map((b) => b.getBoundingClientRect());
    const tapa = R.some((a) => botones.some((b) => pisa(a, b)));
    const zona = document.querySelector('.noti.zona');
    const c = document.querySelector('.notis');   /* medidas en el juego (offset: el celu parado gira todo) */
    return { n: notis.length, ultimo: /Misión nueva/.test(ultimo) && !/Nimbo|Ciudad/.test(ultimo), tapa, arriba: c.offsetTop, zona: zona ? zona.textContent : '', cartelViejo: !!document.querySelector('.lugar, .avisito'), alto: Math.max(...notis.map((q) => q.offsetHeight)), ancho: Math.max(...notis.map((q) => q.offsetWidth)) };
  }, PISA);
  prueba(`${nombre}: tres avisos de golpe dejan uno solo (el último), sin tapar botones`, r.n === 1 && r.ultimo && !r.tapa, JSON.stringify(r));
  prueba(`${nombre}: van arriba de todo y chicos`, r.alto < 64 && r.ancho <= 330 && r.arriba < 70, `arriba ${Math.round(r.arriba)} · ${Math.round(r.ancho)}×${Math.round(r.alto)}`);
  prueba(`${nombre}: la zona nueva es un aviso con su título (no el cartel del medio)`, /Nueva zona/.test(r.zona) && /Bahía del Faro/.test(r.zona) && !r.cartelViejo, r.zona);
  await pag.screenshot({ path: path.join(SAL, `avisos-${nombre.replace(' ', '-')}.png`) });
  if (nombre === 'compu') {
    r = await pag.evaluate(async () => {
      const U = window.__A.UI, S = {};
      U.avisar('Nimbo · 1/3'); U.avisar('Nimbo · 1/3'); S.juntos = document.querySelectorAll('.noti').length; S.x2 = [...document.querySelectorAll('.noti-n')].map((e) => e.textContent).join('');
      for (let i = 0; i < 5; i++) U.avisar('aviso ' + i); S.maximo = document.querySelectorAll('.noti').length;
      document.querySelector('.noti .noti-x').click(); await new Promise((ok) => setTimeout(ok, 400)); S.cerrado = document.querySelectorAll('.noti').length;
      await new Promise((ok) => setTimeout(ok, 7000)); S.solos = document.querySelectorAll('.noti').length;
      /* la campanita: suena una y la que llega enseguida no se encima */
      window.__A.Sonido.iniciar(); await window.__A.Sonido.ctx.resume(); await new Promise((ok) => setTimeout(ok, 400));
      S.suena = window.__A.timbre('zona'); S.otra = window.__A.timbre('info');
      return S;
    });
    prueba('uno igual al que está se junta (×2)', r.juntos === 1 && r.x2 === '×2', JSON.stringify(r));
    prueba('uno solo a la vez', r.maximo === 1);
    prueba('la cruz lo cierra', r.cerrado === 0);
    prueba('se van solos', r.solos === 0);
    prueba('suena la campanita y no dos juntas', r.suena === true && r.otra === false);
    /* las misiones: solo con el botón */
    r = await pag.evaluate(async () => {
      const A = window.__A, S = {};
      A.J.misiones.aceptar('nimbo'); A.J.misiones.aceptar('brujula'); A.UI.actualizarMisiones();
      S.antes = document.querySelectorAll('.pm-mision, .mision').length; S.insignia = document.querySelector('[data-a=misiones] .insignia').textContent;
      document.querySelector('[data-a=misiones]').click(); S.abiertas = document.querySelectorAll('.pm-mision').length;
      S.texto = document.querySelector('.pm-mision small')?.textContent || '';
      document.querySelector('[data-a=misiones]').click(); await new Promise((ok) => setTimeout(ok, 300)); S.despues = document.querySelectorAll('.pm-mision').length;
      return S;
    });
    prueba('las misiones no se ven hasta tocar 📜 (que cuenta 2)', r.antes === 0 && r.insignia === '2', JSON.stringify(r));
    prueba('tocando 📜 se abre la lista con qué hacer, y otra vez se cierra', r.abiertas === 2 && r.texto.length > 10 && r.despues === 0);
    await pag.evaluate(() => document.querySelector('[data-a=misiones]').click()); await esperar(350);
    await pag.screenshot({ path: path.join(SAL, 'avisos-misiones.png') });
    await pag.evaluate(() => document.querySelector('[data-a=misiones]').click());
    /* el tutorial: chico, arriba a la izquierda */
    r = await pag.evaluate(() => { const q = document.querySelector('.tuto'); return q ? { x: q.offsetLeft, w: q.offsetWidth, h: q.offsetHeight } : null; });
    prueba('el tutorial es una pista chica a la izquierda', r && r.x < 40 && r.w <= 260 && r.h < 70, JSON.stringify(r));
  }
  /* el parkour: solo el reloj arriba, la pausa y el micrófono; sin avisos */
  await pag.evaluate(() => window.__A.entrarReino('parkour', { nivel: 1 }));
  await pag.evaluate(() => { for (let i = 0; i < 120; i++) window.__A.paso(1 / 30, false); window.__A.UI.avisar('esto no se tiene que ver', 'bien'); window.__A.UI.lugar('Tampoco', '📍'); });
  await avanzar(pag, 2);
  r = await pag.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
    const pk = document.querySelector('.pk-hud'), pkR = { top: pk.offsetTop, height: pk.offsetHeight };
    return { hotbar: vis('.hotbar'), misiones: vis('[data-a=misiones]'), estilo: vis('[data-a=estilo]'), orbes: vis('.arriba-izq'), red: vis('.estado-red'), avisos: document.querySelectorAll('.noti').length && vis('.notis'), pausa: vis('[data-a=pausa]'), voz: vis('[data-a=voz]'), pkArriba: Math.round(pkR.top), pkAlto: Math.round(pkR.height) };
  });
  prueba(`${nombre}, parkour: se esconde lo que tapa (barra, misiones, orbes, red, avisos)`, !r.hotbar && !r.misiones && !r.estilo && !r.orbes && !r.red && !r.avisos, JSON.stringify(r));
  prueba(`${nombre}, parkour: quedan la pausa, el micrófono y el reloj chico arriba`, r.pausa && r.voz && r.pkArriba < 30 && r.pkAlto < 46);
  await pag.screenshot({ path: path.join(SAL, `avisos-parkour-${nombre.replace(' ', '-')}.png`) });
  await pag.evaluate(() => window.__A.entrarReino('plaza'));
  r = await pag.evaluate(() => getComputedStyle(document.querySelector('.hotbar')).display !== 'none');
  prueba(`${nombre}: al salir del parkour vuelve todo`, r);
  const e = errores.filter((x) => !x.includes('ERR_FAILED'));
  if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); }
  await ctx.close();
}
await nav.close();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
