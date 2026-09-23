// Cómo salen los tramos: pendiente máxima, rampas, puentes, nafta y monedas.
//     node ruta40/pruebas/tramos.mjs
import { TRAMOS, generarTramo, DX } from "../js/ruta.js";
for (const T of TRAMOS) {
  const R = generarTramo(T.id), h = R.S.h;
  let pmax = 0, pmin = 0, hmin = Infinity, hmax = -Infinity;
  for (let i = 1; i < h.length; i++) { const p = (h[i] - h[i - 1]) / DX; pmax = Math.max(pmax, p); pmin = Math.min(pmin, p); hmin = Math.min(hmin, h[i]); hmax = Math.max(hmax, h[i]); }
  console.log(`${T.id.padEnd(10)} subida máx ${(Math.atan(pmax) * 57.3).toFixed(0)}° bajada máx ${(Math.atan(-pmin) * 57.3).toFixed(0)}° · alturas ${hmin.toFixed(0)}..${hmax.toFixed(0)} m · ${R.rampas.length} rampas · ${R.puentes.length} puentes · ${R.nafta.length} bidones · ${R.monedas.length} monedas`);
}
