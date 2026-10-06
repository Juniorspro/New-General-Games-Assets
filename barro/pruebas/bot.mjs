// Corre cada pista con seis pilotos (uno "jugador" de nivel 1) y muestra tiempos, caídas y saltos.
//     node barro/pruebas/bot.mjs [b1,b2] [--nivel=1]
import { construir, PISTAS } from '../js/pistas.js';
import { crearCarrera, simular } from '../js/carrera.js';
const solo = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : null;
let mal = 0;
for (const def of PISTAS) {
  if (solo && !solo.includes(def.id)) continue;
  const P = construir(def);
  const lista = [1, 0.9, 0.75, 0.6, 0.45, 0.3].map((ia, i) => ({ nombre: 'P' + i, numero: i, ia, carril: i }));
  const C = simular(crearCarrera(P, lista), 200);
  const r = C.corredores.map((c) => `${c.tiempo === null ? 'NO' : c.tiempo.toFixed(1)}${c.caidas ? '/' + c.caidas + 'c' : ''}`).join(' ');
  const mejor = C.corredores[0];
  if (mejor.tiempo === null || mejor.caidas > 0) mal++;
  console.log(`${def.id} ${P.largo.toFixed(0)} m, ${P.saltos.length} saltos  | ${r}  | perf ${mejor.perfectos}`);
}
console.log(mal ? `${mal} pistas con problemas para el mejor piloto` : 'el mejor piloto termina todas sin caerse');
