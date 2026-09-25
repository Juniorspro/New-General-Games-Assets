// LOS CAMINOS LIBRES: se recorre cada camino de la isla (su línea del medio,
// que ondula, y un metro a cada lado) y se busca cualquier sólido que se cruce
// a la altura del cuerpo: árboles, piedras, bancos, faroles, carteles… Tiene
// que no haber ninguno. Lista los que encuentra con dónde están.
//     node pruebas/caminos.mjs
import { navegador, abrir } from './comun.mjs';
const nav = await navegador();
let bien = 0, mal = 0;
const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const { pag, ctx, errores } = await abrir(nav, 'directo&pausa&calidad=baja');
await pag.waitForFunction(() => window.__A && window.__A.reino && window.__A.reino.id === 'plaza', null, { timeout: 120000, polling: 250 });
const r = await pag.evaluate(() => {
  const R = window.__A.reino, W = R.mundo, choques = new Map();
  let puntos = 0;
  for (const [[ax, az], [bx, bz]] of R.caminos) {
    const vx = bx - ax, vz = bz - az, L = Math.hypot(vx, vz), nx = -vz / L, nz = vx / L;
    for (let d = 0; d <= L; d += 0.5) {
      const t = d / L, ondula = Math.sin(t * L * 0.28 + ax) * 1.2 * Math.min(1, t * L / 6, (1 - t) * L / 6);
      /* (el mismo corrimiento que enCamino: es la línea que se ve en el piso) */
      const cx = ax + vx * t - ondula * nx, cz = az + vz * t - ondula * nz;
      for (const lado of [-1, 0, 1]) {
        const x = cx + nx * lado, z = cz + nz * lado, h = W.altura(x, z);
        if (h < 0.5) continue;   // en el agua (el puente, la costa)
        puntos++;
        for (const s of W.cerca(x, z)) {
          if (s.fantasma || s.y1 < h + 0.46 || s.y0 > h + 1.4 || !W.dentro(s, x, z, 0.32)) continue;
          if (W.dentro(s, ax, az, 0.5) || W.dentro(s, bx, bz, 0.5)) continue;   // a donde lleva el camino (la fuente del medio, una puerta)
          const k = `${s.t}:${s.x.toFixed(1)},${s.z.toFixed(1)}`;
          if (!choques.has(k)) choques.set(k, { t: s.t, x: +s.x.toFixed(1), z: +s.z.toFixed(1), r: s.r ? +s.r.toFixed(2) : undefined, hx: s.hx ? +s.hx.toFixed(2) : undefined, hz: s.hz ? +s.hz.toFixed(2) : undefined, alto: +(s.y1 - h).toFixed(1), tipo: s.tipo || s.clave || '', camino: `${ax},${az}→${bx},${bz}` });
        }
      }
    }
  }
  return { puntos, choques: [...choques.values()] };
});
prueba(`los caminos no tienen nada en el medio (${r.puntos} puntos)`, r.choques.length === 0, `${r.choques.length} obstáculos`);
for (const c of r.choques) console.log('   ', JSON.stringify(c));
const e = errores.filter((x) => !x.includes('ERR_FAILED'));
if (e.length) { mal++; console.log('✗ errores:', [...new Set(e)].join(' | ')); }
await ctx.close(); await nav.close();
console.log(`\n${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
