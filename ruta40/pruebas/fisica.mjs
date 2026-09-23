// Prueba de la física: piso plano, una subida, una rampa y el giro en el aire.
//     node ruta40/pruebas/fisica.mjs
import { crearSuelo, crearAuto, pasoAuto, PASO, volcado } from "../js/fisica.js";
import { VEHICULOS } from "../js/vehiculos.js";
const suelo = (f, largo = 400, dx = 0.25) => { const n = Math.ceil(largo / dx) + 1, h = new Float64Array(n); for (let i = 0; i < n; i++) h[i] = f(i * dx - 20); return crearSuelo(-20, dx, h); };
const correr = (S, seg, inp, nom) => {
  const A = crearAuto(VEHICULOS.chata, 0, 2);
  const out = [];
  for (let t = 0; t < seg * 240; t++) {
    pasoAuto(A, S, typeof inp === 'function' ? inp(t / 240, A) : inp, PASO);
    if (!Number.isFinite(A.x + A.y + A.a)) { console.log(nom, 'EXPLOTÓ en', t); return A; }
    if (t % 120 === 0) out.push(`${(t / 240).toFixed(1)}s x=${A.x.toFixed(1)} y=${A.y.toFixed(2)} v=${Math.hypot(A.vx, A.vy).toFixed(1)} a=${(A.a * 57.3).toFixed(0)}° ${A.tocaAlguna ? 'piso' : 'aire'}${A.choco ? ' CHOCÓ' : ''}`);
  }
  console.log('== ' + nom + '\n  ' + out.join('\n  '));
  return A;
};
correr(suelo(() => 0), 2, { gas: 0 }, 'quieto en el plano');
correr(suelo(() => 0), 6, { gas: 1 }, 'acelerando en el plano');
correr(suelo((x) => (x > 5 ? (x - 5) * 0.35 : 0)), 8, { gas: 1 }, 'subida del 35%');
correr(suelo((x) => (x > 20 && x < 30 ? (x - 20) * 0.4 : x >= 30 ? -3 : 0)), 7, { gas: 1 }, 'rampa y salto');
correr(suelo((x) => Math.sin(x * 0.3) * 1.5), 10, { gas: 1 }, 'lomas');
correr(suelo((x) => (x > 20 && x < 30 ? (x - 20) * 0.5 : x >= 30 ? -12 : 0)), 7, (t, A) => ({ gas: A.tocaAlguna ? 1 : 1 }), 'rampa, gas en el aire (vuelta atrás)');
