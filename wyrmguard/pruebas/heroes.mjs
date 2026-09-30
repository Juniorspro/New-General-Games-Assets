// Cada héroe, solo (con un arquero de compañero para los que no pegan), a nivel 1 y 3, contra una
// tanda de enemigos: cuánto daño hace en 8 s. Después, todos los objetos juntos. Junta errores.
import { abrir } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, dpr: 1, tactil: false });
const r = await pag.evaluate(() => {
  __WG.nueva(0, 11); G.vistoGuia = true;
  const out = [];
  for (const id of Object.keys(HEROES)) for (const lvl of [1, 3]) {
    const ataca = HEROES[id].ataca;
    __WG.armar([[id, lvl]], 5);
    M.fase = "pelea"; M.maxOleadas = 99;
    for (let i = 0; i < 14; i++) crearEnemigo(AR.x1 + 60 + (i % 7) * 40, AR.y1 + 40 + Math.floor(i / 7) * 60);
    if (id === "miner") for (let i = 0; i < 6; i++) soltarOro(M.vib[0].x + 20 + i * 4, M.vib[0].y);
    if (id === "gambler") J.oro = 30;
    if (id === "mindkeeper" || id === "penitent") M.vib[0].hp *= 0.9;
    let curas = 0, bichos = 0, inv = 0, dots = 0;
    for (let f = 0; f < 480; f++) {
      M.esperaOla = 99;
      if (M.ene.filter((e) => !e.muerto).length < 6) crearEnemigo(AR.x1 + 40 + Math.random() * 300, AR.y1 + 30 + Math.random() * 140);
      IN.teclas.clear(); if ((f >> 6) % 2) IN.teclas.add("der");
      pasoArena(1 / 60); finCuadroEntrada();
      curas = Math.max(curas, M.pick.filter((p) => p.tipo === "cura").length); bichos = Math.max(bichos, M.bichos.length); inv = Math.max(inv, M.inv.length); dots = Math.max(dots, M.dots.length);
      if (!heroesVivos().length) break;
    }
    out.push({ id, lvl, ataca, dano: Math.round(M.danoHecho), curas, bichos, inv, dots, buf: JSON.stringify(M.buf), vivo: heroesVivos().length });
  }
  // todos los objetos a la vez, con un grupo variado
  __WG.armar([["archer", 3], ["wizard", 2], ["scout", 2], ["cleric", 2], ["sentry", 2], ["witch", 2], ["jester", 2], ["drifter", 3], ["frostcaller", 2]], 11, Object.keys(OBJETOS));
  let err = null;
  try { for (let f = 0; f < 60 * 40; f++) { IN.teclas.clear(); if ((f >> 5) % 3 === 0) IN.teclas.add("izq"); pasoArena(1 / 60); finCuadroEntrada(); if (PANT !== "arena") break; } } catch (e) { err = String(e.stack || e); }
  return { out, todos: { pant: PANT, fase: M && M.fase, oleada: M && M.oleada, vivos: M && heroesVivos().length, orbes: M && M.orbesPsi.length, dano: M ? Math.round(M.danoHecho) : -1, err } };
});
const malos = [];
for (const x of r.out) {
  const ok = x.ataca ? x.dano > 0 : (x.curas > 0 || x.buf !== "{}" || x.bichos > 0 || x.dano > 0 || x.id === "merchant");
  if (!ok) malos.push(x);
  console.log(`${ok ? "✓" : "✗"} ${x.id.padEnd(13)} lv${x.lvl}  daño ${String(x.dano).padStart(6)}  curas ${x.curas} bichos ${x.bichos} inv ${x.inv} dots ${x.dots}${x.buf !== "{}" ? " buf " + x.buf : ""}`);
}
console.log("todos los objetos:", JSON.stringify(r.todos));
console.log(malos.length ? `${malos.length} MAL` : "todos hacen algo");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 15).join("\n") : "sin errores");
await nav.close();
