// Los mandos a gusto (js/21b-mandos.js), con un teléfono de mentira (toques por CDP):
// - AJUSTES › MANDOS abre el editor con todos los botones a la vista;
// - arrastrar el SALTO lo deja donde se soltó; + lo agranda; la opacidad baja; zurdo espeja todo (la palanca y
//   el mirar cambian de lado); todo queda guardado al recargar;
// - en inglés y portugués el editor está traducido;
// - en la partida: con la palanca fija, apoyar el dedo lejos no la mueve; tocar un botón vibra (y con VIBRAR: NO, no);
// - sin errores.
//     node pruebas/mandos.mjs
import { navegador, abrir } from './comun.mjs';

const nav = await navegador();
let bien = 0, mal = 0; const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { ctx, pag, errores } = await abrir(nav, '');
const cdp = await ctx.newCDPSession(pag);
const toque = async (tipo, x, y) => cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const arrastrar = async (x0, y0, x1, y1) => { await toque('touchStart', x0, y0); for (let i = 1; i <= 6; i++) await toque('touchMove', x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * i / 6); await toque('touchEnd'); };
const centro = (id) => pag.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, w: r.width }; }, id);
await pag.evaluate(() => { localStorage.removeItem('contragolpe.v1'); G.idioma = 'es'; window.__cuadros(3); });

await pag.click('#btAjustes'); await pag.click('#btMandos');
prueba('AJUSTES › MANDOS abre el editor con los botones', await pag.evaluate(() => $('editorMandos').classList.contains('ver') && getComputedStyle($('bMira')).display !== 'none' && $('mandos').classList.contains('ver')));
const s0 = await centro('bSalto');
await arrastrar(s0.x, s0.y, 300, 150);
const s1 = await centro('bSalto'), g1 = await pag.evaluate(() => G.mandos.bt.bSalto);
prueba('arrastrar el SALTO lo deja donde se soltó', Math.hypot(s1.x - 300, s1.y - 150) < 3 && g1 && g1.cx > 0, `(${s0.x.toFixed(0)}, ${s0.y.toFixed(0)}) → (${s1.x.toFixed(0)}, ${s1.y.toFixed(0)})`);
await pag.click('#edMas'); await pag.click('#edMas');
const s2 = await centro('bSalto');
prueba('+ dos veces lo agranda un 20 %', Math.abs(s2.w / s1.w - 1.2) < 0.02, `${s1.w.toFixed(0)} → ${s2.w.toFixed(0)} px · ${await pag.textContent('#edTam')}`);
await pag.click('#edAlfa');
prueba('la opacidad baja a 85 %', await pag.evaluate(() => Math.abs(G.mandos.alfa - 0.85) < 0.01 && getComputedStyle($('bDisparo')).opacity === '0.85'), await pag.evaluate(() => getComputedStyle($('bDisparo')).opacity));
const d0 = await centro('bDisparo');
await pag.click('#edZurdo');
const d1 = await centro('bDisparo'), s3 = await centro('bSalto'), zm = await pag.evaluate(() => { const r = $('zonaMover').getBoundingClientRect(); return r.left; });
prueba('zurdo espeja: el disparo, el salto que se movió y la zona de la palanca cambian de lado', d0.x > 400 && d1.x < 400 && Math.abs(s3.x - (800 - 300)) < 3 && zm > 300, `disparo x ${d0.x.toFixed(0)} → ${d1.x.toFixed(0)} · salto ${s3.x.toFixed(0)} · zona palanca desde ${zm.toFixed(0)}`);
await pag.click('#edPalanca');
{ const tx = [await pag.textContent('#edPalanca'), await pag.textContent('#edZurdo')]; prueba('los textos del editor', /PALANCA: FIJA/.test(tx[0]) && /ZURDO: SÍ/.test(tx[1]), tx.join(' · ')); }
await pag.click('#edListo');
prueba('LISTO vuelve a AJUSTES', await pag.evaluate(() => $('capaAjustes').classList.contains('ver') && !$('editorMandos').classList.contains('ver')));
/* idiomas */
const idiomas = {};
for (const l of ['en', 'pt']) { idiomas[l] = await pag.evaluate((l) => { G.idioma = l; abrirEditorMandos(); const t = [$('edPalanca').textContent, $('edListo').textContent, $('edAyuda').textContent]; cerrarEditorMandos(); return t; }, l); }
await pag.evaluate(() => { G.idioma = 'es'; guardar(); });
prueba('traducido en inglés y portugués', /STICK: FIXED/.test(idiomas.en[0]) && idiomas.en[1] === 'DONE' && /ANALÓGICO: FIXO/.test(idiomas.pt[0]) && idiomas.pt[1] === 'PRONTO', `${idiomas.en[0]} · ${idiomas.pt[0]}`);
await ctx.close();

/* recargar: lo guardado sigue; en la partida, la palanca fija y la vibración */
const b = await abrir(nav, 'partida=bomba&bando=ct&sem=7&mandos');
const p2 = b.pag, cdp2 = await b.ctx.newCDPSession(p2);
/* (el mismo guardado: otro contexto no tiene el localStorage, se copia) */
await p2.evaluate(() => { G.mandos = { bt: { bSalto: { cx: 1 - 300 / 800, cy: 150 / 360, s: 1.2 } }, alfa: 0.85, zurdo: true, palanca: 'fija', vibrar: true }; guardar(); location.reload(); }).catch(() => {});
await p2.waitForFunction(() => window.__C && window.__C.listo, null, { timeout: 180000, polling: 250 });
await p2.evaluate(() => { window.__vib = 0; navigator.vibrate = () => { window.__vib++; return true; }; window.__cuadros(5); });
const t2 = async (tipo, x, y) => cdp2.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tipo === 'touchEnd' ? [] : [{ x, y, id: 2 }] });
const st0 = await p2.evaluate(() => { const r = $('stick').getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; });
await t2('touchStart', 640, 330); await p2.evaluate(() => window.__cuadros(2));
const st1 = await p2.evaluate(() => { const r = $('stick').getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, activo: $('stick').classList.contains('activo') }; });
await t2('touchEnd');
prueba('lo guardado sigue al recargar (zurdo: la palanca a la derecha)', st0.x > 600, `palanca en x ${st0.x.toFixed(0)}`);
prueba('palanca fija: apoyar el dedo lejos no la mueve', st1.activo && Math.hypot(st1.x - st0.x, st1.y - st0.y) < 2, `(${st0.x.toFixed(0)}, ${st0.y.toFixed(0)}) → (${st1.x.toFixed(0)}, ${st1.y.toFixed(0)})`);
const sal = await p2.evaluate(() => { const r = $('bSalto').getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; });
const v0 = await p2.evaluate(() => window.__vib);
await t2('touchStart', sal.x, sal.y); await t2('touchEnd');
const v1 = await p2.evaluate(() => window.__vib);
await p2.evaluate(() => { G.mandos.vibrar = false; });
await t2('touchStart', sal.x, sal.y); await t2('touchEnd');
const v2 = await p2.evaluate(() => window.__vib);
prueba('tocar un botón vibra, y con VIBRAR: NO no', v1 > v0 && v2 === v1, `${v0} → ${v1} → ${v2}`);
prueba('sin errores', !errores.length && !b.errores.length, [...errores, ...b.errores].slice(0, 3).join(' | '));
await b.ctx.close(); await nav.close();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
