// ¿Qué fase se come el cuadro? Se cronometra cada una por separado, sobre una
// partida de verdad, y se reporta la PEOR de cada una.
import { Mundo } from "../js/mundo.js";
import { LARGO } from "../js/bichos.js";

const w = new Mundo(977);
const fases = ["moverJugador", "largarBichos", "rearmarRejilla", "moverBichos", "dispararArmas",
               "moverTiros", "moverOrbita", "moverOndas", "moverSemillas", "moverLatigos", "recogerGemas"];
const peor = {}, suma = {};
for (const f of fases) { peor[f] = 0; suma[f] = 0; }
for (const f of fases) {
  const orig = w[f].bind(w);
  w[f] = (...a) => { const t = performance.now(); orig(...a); const d = performance.now() - t; if (d > peor[f]) peor[f] = d; suma[f] += d; };
}
const piloto = () => { const p = w.jugador; const b = w.masCercano(p.x, p.y, 400);
  let x = 0, y = 0;
  if (b) { const d = Math.hypot(b.x - p.x, b.y - p.y) || 1; x = -(b.x - p.x) / d; y = -(b.y - p.y) / d; }
  const a = Math.atan2(p.y, p.x); x += -Math.sin(a) * .7; y += Math.cos(a) * .7;
  const dc = Math.hypot(p.x, p.y); if (dc > w.radioMapa * .85) { x -= p.x / dc; y -= p.y / dc; }
  const m = Math.hypot(x, y) || 1; return { x: x / m, y: y / m }; };

let n = 0;
while (!w.terminada() && n < LARGO * 60 + 120) {
  if (w.pendienteMejora > 0) { w.elegir(w.ofertas()[0]); continue; }
  w.avanzar(1 / 60, piloto()); n++;
}
console.log(`partida de ${n} cuadros · pico ${w.picoBichos} bichos\n`);
for (const f of fases.sort((a, b) => peor[b] - peor[a]))
  console.log(`  ${f.padEnd(16)} peor ${peor[f].toFixed(2).padStart(7)} ms · total ${(suma[f]).toFixed(0).padStart(6)} ms`);
