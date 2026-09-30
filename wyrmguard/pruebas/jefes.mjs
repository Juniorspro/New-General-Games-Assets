// Los cinco jefes con un grupo fuerte: que aparezcan, hagan lo suyo y se puedan matar (sin errores).
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, dpr: 2, tactil: false });
await pag.evaluate(() => {
  window.botGiro = () => {
    const c = lider(); if (!c) return 0;
    let vx = 0, vy = 0;
    const m = 44;
    if (c.x < AR.x1 + m) vx += (AR.x1 + m - c.x) * 3; if (c.x > AR.x2 - m) vx -= (c.x - (AR.x2 - m)) * 3;
    if (c.y < AR.y1 + m) vy += (AR.y1 + m - c.y) * 3; if (c.y > AR.y2 - m) vy -= (c.y - (AR.y2 - m)) * 3;
    for (const e of M.ene) { const dx = c.x - e.x, dy = c.y - e.y, d = Math.hypot(dx, dy); if (d < 60 && d > 0.1) { const k = (60 - d) * (e.jefe ? 4 : 1.5); vx += (dx / d) * k; vy += (dy / d) * k; } }
    for (const p of M.proyE) { const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy); if (d < 40) { vx += (dx / d) * (40 - d) * 2; vy += (dy / d) * (40 - d) * 2; } }
    for (const p of M.pick) { const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy); if (d < 120) { vx += (dx / d) * 20; vy += (dy / d) * 20; } }
    if (Math.hypot(vx, vy) < 5) return Math.sin(M.t * 0.7) > 0 ? 1 : -1;
    const d = difAng(M.rumbo, Math.atan2(vy, vx));
    return Math.abs(d) < 0.12 ? 0 : Math.sign(d);
  };
});
for (const nivel of [6, 12, 18, 24, 25]) {
  const r = await pag.evaluate((nivel) => {
    __WG.nueva(0, nivel); G.vistoGuia = true;
    __WG.armar([["archer", 3], ["wizard", 3], ["cannoneer", 3], ["swordsman", 3], ["cleric", 3], ["pyromancer", 3], ["scout", 3]], nivel, ["ballista", "amplify"]);
    let jefe = null, hp0 = 0, t = 0, esp = 0;
    for (let f = 0; f < 60 * 150; f++) {
      IN.teclas.clear(); const gg = botGiro(); if (gg < 0) IN.teclas.add("izq"); if (gg > 0) IN.teclas.add("der");
      pasoArena(1 / 60); finCuadroEntrada(); t = f / 60;
      if (M.jefe && !jefe) { jefe = M.jefe; hp0 = jefe.maxhp; }
      if (M.proyE.length || M.bichos.some((b) => b.enemigo) || M.inv.some((c) => c.mina)) esp++;
      if (PANT !== "arena" || M.fase === "limpio" || M.fase === "muerto") break;
    }
    return { nivel, tipo: jefe && jefe.jefe, hp: Math.round(hp0), fase: M ? M.fase : PANT, t: Math.round(t), vivos: M ? heroesVivos().length : 0, especiales: esp };
  }, nivel);
  console.log(JSON.stringify(r));
  await pag.evaluate(() => { cuadro(0); volcar(); }); await pag.screenshot({ path: salida(`b-jefe${nivel}.png`) });
}
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 10).join("\n") : "sin errores");
await nav.close();
