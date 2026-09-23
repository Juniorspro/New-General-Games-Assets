// El bot que comprueba RUTA 40 con la misma física que el jugador (sale con error si algo no se cumple):
//   1. Con la chata sin mejoras se llega a PARA_ABRIR metros en cada tramo (así se abre el siguiente).
//   2. Con nafta infinita la chata sin mejoras no se traba en ningún lado (ninguna trampa).
//   3. Cada tramo lo terminan al menos dos vehículos con 6 niveles de mejoras.
//   4. Cada picada la gana alguno de los vehículos con el mismo nivel de mejoras que los rivales.
//     node ruta40/pruebas/bot.mjs [--rapido]
import { correr } from './manejar.mjs';
import { TRAMOS } from '../js/ruta.js';
import { ORDEN_VEHICULOS, MEJORAS } from '../js/vehiculos.js';
import { PARA_ABRIR } from '../js/partida.js';
import { Viaje, picada } from '../js/juego.js';
import { crearPiloto } from '../js/piloto.js';

const rapido = process.argv.includes('--rapido');
const fallas = [];
const ok = (cond, txt) => { if (!cond) fallas.push(txt); console.log((cond ? '  ✓ ' : '  ✗ ') + txt); };

console.log('1. chata sin mejoras, con nafta');
for (const T of TRAMOS) { const r = correr('chata', T.id, 0, 600, true); ok(r.x >= PARA_ABRIR, `${T.id}: ${r.x} m (${r.fin})`); }

console.log('2. chata sin mejoras, nafta infinita: nada donde trabarse');
for (const T of TRAMOS) { const r = correr('chata', T.id, 0, 900, false); ok(r.fin === 'LLEGÓ' || r.fin === 'cabeza' || r.fin === 'volcó', `${T.id}: ${r.x} m (${r.fin})`); }

if (!rapido) {
  console.log('3. cada tramo, con 6 niveles de mejoras');
  for (const T of TRAMOS) {
    const llegan = ORDEN_VEHICULOS.filter((v) => correr(v, T.id, 6, 700, true).fin === 'LLEGÓ');
    ok(llegan.length >= 2, `${T.id}: llegan ${llegan.join(', ') || 'ninguno'}`);
  }
}

console.log('4. las picadas');
function correrPicada(tramo, nivel, vehiculo) {
  const pc = picada(tramo, nivel), mej = pc.rivales[0].mej;
  const V = new Viaje({ tramo, vehiculo, niveles: Object.fromEntries(MEJORAS.map((m) => [m, mej])), modo: 'picada', picada: pc });
  const pil = crearPiloto(undefined, 3);
  V.cuenta = 0;
  for (let t = 0; t < 400 && !V.fin; t += 1 / 60) V.avanzar(1 / 60, pil(V.yo, V.R.S, 1 / 60), null);
  return V.fin === 'meta' ? V.puesto : 9;
}
for (const T of TRAMOS) {
  for (let n = 0; n < 3; n++) {
    const puestos = {};
    for (const v of ORDEN_VEHICULOS) { puestos[v] = correrPicada(T.id, n, v); if (rapido && puestos[v] === 1) break; }
    const gana = Object.entries(puestos).filter(([, p]) => p === 1).map(([v]) => v);
    ok(gana.length > 0, `${T.id} picada ${n + 1}: ganan ${gana.join(', ') || 'ninguno'} (${Object.entries(puestos).map(([v, p]) => v + ' ' + (p === 9 ? '—' : p + 'º')).join(' · ')})`);
  }
}

console.log(fallas.length ? `\n${fallas.length} cosas no se cumplen` : '\nTodo se cumple.');
process.exit(fallas.length ? 1 : 0);
