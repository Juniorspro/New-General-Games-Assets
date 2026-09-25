// LAS CALIDADES (motor.js › CALIDADES, detalle.js): que mínima dibuje derecho (sin la cadena
// de efectos), sin brillo, sin barniz en los materiales, con menos píxeles y cortando lo lejano
// detrás de la niebla; que dibuje bastante menos que baja; que al volver a alta vuelva todo;
// que un estilo retro en mínima igual use la cadena; y que por software arranque en mínima.
//     node pruebas/calidad.mjs
import { navegador, abrir, avanzar } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };

const medir = async (cal) => {
  const { pag, ctx, errores } = await abrir(nav, `directo&pausa&calidad=${cal}&hora=0.45`, { ancho: 844, alto: 390, movil: true });
  await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.yo, null, { timeout: 180000, polling: 250 });
  await avanzar(pag, 40);
  const r = await pag.evaluate(() => {
    const A = window.__A, M = A.motor, R = M.r;
    R.info.autoReset = false; R.info.reset(); M.dibujar(0);
    const out = { tris: R.info.render.triangles, calls: R.info.render.calls, cadena: M.usaCadena, bloom: M.pBloom.enabled, dpr: +M.dpr.toFixed(2), niebla: Math.round(M.escena.fog.far), det: A.detalle.estado, chequeo: R.debug.checkShaderErrors, aparato: A.J.aparato.calidad };
    R.info.autoReset = true;
    let barniz = 0; M.escena.traverse((o) => { const m = o.material; if (m && m.isMeshPhysicalMaterial && (m.clearcoat > 0 || m.iridescence > 0)) barniz++; });
    out.barniz = barniz;
    return out;
  });
  return { r, pag, ctx, errores };
};

const B = await medir('baja'); await B.ctx.close();
const { r: M, pag, ctx, errores } = await medir('minima');
prueba('mínima dibuja derecho: sin la cadena de efectos ni brillo', !M.cadena && !M.bloom, JSON.stringify({ cadena: M.cadena, bloom: M.bloom }));
prueba('…con menos píxeles (dpr ≤ 0,6) y la niebla donde se corta (~97 m)', M.dpr <= 0.6 && M.niebla > 80 && M.niebla < 110, `dpr ${M.dpr} · niebla ${M.niebla} m`);
prueba('…sin barniz ni tornasol en ningún material', M.barniz === 0, `${M.barniz} con barniz`);
prueba('…corta piezas lejanas', M.det.cortadas > 5 && M.det.lim === 95, JSON.stringify(M.det));
prueba('mínima dibuja mucho menos que baja (triángulos y llamadas)', M.tris < B.r.tris * 0.6 && M.calls < B.r.calls, `mínima ${M.tris} (${M.calls}) · baja ${B.r.tris} (${B.r.calls})`);
prueba('los shaders no se revisan uno por uno (carga más rápida)', M.chequeo === false);
prueba('con SwiftShader (por software) la calidad automática es mínima', M.aparato === 'minima', M.aparato);

/* volver a alta: vuelve todo */
let r = await pag.evaluate(() => {
  const A = window.__A, M = A.motor; A.J.ponerCalidad('alta');
  for (let i = 0; i < 20; i++) A.paso(1 / 30, false);
  let barniz = 0; M.escena.traverse((o) => { const m = o.material; if (m && m.isMeshPhysicalMaterial && m.clearcoat > 0) barniz++; });
  return { cadena: M.usaCadena, bloom: M.pBloom.enabled, niebla: Math.round(M.escena.fog.far), cortadas: A.detalle.estado.cortadas, barniz };
});
prueba('al pasar a alta vuelve el brillo, el barniz, la niebla lejos y nada cortado', r.cadena && r.bloom && r.niebla >= 900 && r.cortadas === 0 && r.barniz > 10, JSON.stringify(r));

/* un estilo retro en mínima: usa la cadena (si no, no se vería) */
r = await pag.evaluate(() => { const A = window.__A, M = A.motor; A.J.ponerCalidad('minima'); M.ponerRetro({ pix: 2, trama: 1 }); const c = M.usaCadena; M.ponerRetro({ pix: 0, trama: 0 }); return { conRetro: c, sin: M.usaCadena }; });
prueba('en mínima, un estilo retro igual pasa por la cadena', r.conRetro && !r.sin, JSON.stringify(r));

/* dibujar en mínima con el runner (delirio copia el lienzo) y un viaje, sin errores */
await pag.evaluate(() => window.__A.viajar('juegos'));
await pag.waitForFunction(() => window.__A.reino.id === 'juegos', null, { timeout: 30000, polling: 200 });
await pag.waitForTimeout(1500); await avanzar(pag, 20);
r = await pag.evaluate(() => ({ det: window.__A.detalle.estado }));
prueba('al viajar prepara el lugar nuevo', r.det.piezas > 5, JSON.stringify(r.det));
const e = errores.filter((x) => !x.includes('ERR_FAILED'));
prueba('sin errores en la consola', e.length === 0, e.slice(0, 3).join(' | '));
await ctx.close(); await nav.close();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
