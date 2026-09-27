// Una partida larga con piloto automático (el jugador lo maneja un bot difícil), para ver que nada se rompe:
// - varias rondas de desactivación (compras, cambios de arma, muertes, armas tiradas, granadas);
// - sin errores en la página;
// - la memoria de la placa no crece: las geometrías y texturas se mantienen (antes cada cambio de arma de un
//   bot armaba el arma de nuevo y la vieja quedaba en la placa);
// - la pantalla no sale negra.
//     node pruebas/partida.mjs [minutos=4] [apk=1] [archivo=otro.html] [sem=11]
import path from 'node:path';
import { navegador, abrir, servirApk } from './comun.mjs';

const A = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const min = +(A.minutos || 4);
const nav = await navegador();
const srv = A.apk ? await servirApk() : null;
const { ctx, pag, errores } = await abrir(nav, `partida=bomba&bando=ct&sem=${A.sem || 11}`, srv ? { url: srv.url } : A.archivo ? { archivo: path.resolve(A.archivo) } : {});
await pag.evaluate(() => { G.graficos = 'fija'; CALIDAD = 1; medir(); window.__C.autopiloto(true); });
let bien = 0, mal = 0; const prueba = (n, ok, extra = '') => { ok ? bien++ : mal++; console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' · ' + extra : ''}`); };
const marcas = [];
for (let s = 0; s < min * 60; s += 20) {
  const m = await pag.evaluate(() => { window.__C.anda(20 * 60 - 1); dibujar(); const p = window.__C.partida();
    return { ronda: p.ronda, ganadas: p.ganadas, fase: p.fase, geo: ren.info.memory.geometries, tex: ren.info.memory.textures, bajas: p.actores.reduce((s, a) => s + a.k, 0) }; });
  marcas.push(m);
}
const ult = marcas[marcas.length - 1], medio = marcas[Math.floor(marcas.length / 2)];
console.log(marcas.map((m) => `r${m.ronda} ${m.fase} geo ${m.geo} tex ${m.tex}`).join(' · '));
prueba(`se juegan varias rondas en ${min} min`, ult.ronda >= 3, `ronda ${ult.ronda} · ${ult.ganadas.ct}-${ult.ganadas.t} · ${ult.bajas} bajas`);
prueba('las geometrías no crecen (de la mitad de la partida al final)', ult.geo <= medio.geo + 12, `${medio.geo} → ${ult.geo}`);
prueba('las texturas no crecen (sólo las que se usan por primera vez)', ult.tex <= medio.tex + 8, `${medio.tex} → ${ult.tex}`);
const px = await pag.evaluate(() => { const gl = ren.getContext(), px = new Uint8Array(4 * 5), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; dibujar(); let s = 0;
  [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(([x, y], i) => { gl.readPixels(Math.floor(w * x), Math.floor(h * y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px.subarray(i * 4)); }); for (let i = 0; i < 20; i++) if (i % 4 !== 3) s += px[i]; return s; });
prueba('la pantalla no sale negra', px > 60, `suma ${px}`);
prueba('sin errores en la página', !errores.length, errores.slice(0, 3).join(' | '));
await ctx.close(); await nav.close(); if (srv) srv.cerrar();
console.log(`${bien} bien, ${mal} mal`);
process.exit(mal ? 1 : 0);
