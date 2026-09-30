// El bot juega una partida entera: esquiva paredes y enemigos, compra copias para subir de nivel,
// elige el primer objeto y anota cada nivel. Mide errores, a qué nivel llega y cuánto tarda el paso.
import { abrir, salida } from "./comun.mjs";
const semilla = +(process.argv[2] || 5), ng = +(process.argv[3] || 0);
const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, dpr: 2, tactil: true });
const foto = (n) => pag.screenshot({ path: salida(n + ".png") });
await pag.evaluate(([s, ng]) => {
  window.__WG.nueva(ng, s); G.vistoGuia = true; TI.guia = false;
  window.BOT = { log: [], rerolls: 0, pasoMs: 0, pasos: 0, maxEne: 0 };
  window.botTienda = () => {
    let compras = 0;
    for (let k = 0; k < 20; k++) {
      let mejor = -1, pt = -1;
      J.cartas.forEach((id, i) => {
        if (!id) return; const h = HEROES[id], ya = J.plantel.find((p) => p.id === id);
        if (h.tier > J.oro) return;
        let v = -1;
        if (ya && ya.lvl < 3) v = 10 + h.tier;
        else if (!ya && J.plantel.length < J.maxU) v = (h.ataca ? 5 : 2) + h.tier;
        if (v > pt) { pt = v; mejor = i; }
      });
      if (mejor >= 0) { comprar(mejor); compras++; continue; }
      if (J.oro >= 8 && BOT.rerolls < 4) { J.oro -= 2; sacarCartas(); BOT.rerolls++; continue; }
      break;
    }
    BOT.rerolls = 0;
    if (J.oro >= 20 && J.tiendaNivel < 4) { J.oro -= 5; J.tiendaXp++; if (J.tiendaXp >= TIENDA_XP[J.tiendaNivel]) { J.tiendaXp = 0; J.tiendaNivel++; } }
    return compras;
  };
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
}, [semilla, ng]);
const t0 = Date.now();
let ultimo = "", fotos = new Set();
for (let vuelta = 0; vuelta < 4000; vuelta++) {
  const r = await pag.evaluate(() => {
    const out = {};
    for (let i = 0; i < 600; i++) {
      if (PANT === "tienda") { botTienda(); if (!J.plantel.length) { J.oro += 3; continue; } empezarNivel(); irA("arena"); BOT.t0 = performance.now(); continue; }
      if (PANT === "objeto") { elegirObjeto(0); continue; }
      if (PANT !== "arena") break;
      if (M.pausa) M.pausa = false;
      IN.teclas.clear(); const gg = botGiro(); if (gg < 0) IN.teclas.add("izq"); if (gg > 0) IN.teclas.add("der");
      const nivelAntes = J.nivel, faseAntes = M.fase;
      const a = performance.now(); pasoArena(1 / 60); BOT.pasoMs += performance.now() - a; BOT.pasos++;
      finCuadroEntrada();
      if (M) BOT.maxEne = Math.max(BOT.maxEne, M.ene.length);
      if (M && faseAntes === "pelea" && M.fase === "limpio") BOT.log.push({ nivel: J.nivel, t: Math.round(M.t), vivos: heroesVivos().length + "/" + M.vib.length, oro: J.oro, plantel: J.plantel.map((p) => p.id + p.lvl).join(","), objetos: J.objetos.map((o) => o.k).join(",") });
      if (PANT === "arena" && M && M.fase === "pelea" && M.t > 20 && !out.foto) out.foto = J.nivel;
    }
    IN.teclas.clear();
    return { pant: PANT, nivel: J.nivel, log: BOT.log.length, foto: out.foto, fase: M && M.fase };
  });
  if (r.foto && [1, 3, 6, 9, 12, 18, 24, 25].includes(r.foto) && !fotos.has(r.foto)) { fotos.add(r.foto); await pag.evaluate(() => { cuadro(0); volcar(); }); await foto("j-nivel" + r.foto); }
  const s = r.pant + r.nivel;
  if (s !== ultimo) { ultimo = s; }
  if (r.pant === "fin" || r.pant === "ganaste" || r.pant === "titulo") { await pag.evaluate(() => { cuadro(0); volcar(); }); await foto("j-" + r.pant); break; }
  if (Date.now() - t0 > 540000) { console.log("tiempo agotado"); break; }
}
const res = await pag.evaluate(() => ({ log: BOT.log, pant: PANT, nivel: J.nivel, pasoMs: (BOT.pasoMs / BOT.pasos).toFixed(3), maxEne: BOT.maxEne, stats: J.stats }));
for (const l of res.log) console.log(JSON.stringify(l));
console.log(`fin: ${res.pant} en nivel ${res.nivel} · paso medio ${res.pasoMs} ms · máx enemigos ${res.maxEne} · ${Math.round((Date.now() - t0) / 1000)} s`);
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 15).join("\n") : "sin errores");
await nav.close();
