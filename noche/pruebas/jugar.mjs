// Prueba general: menús (capturas), y un bot que juega varios minutos de partida acelerada:
// se mueve en círculos, elige la primera opción al subir de nivel y abre los cofres.
// Mide errores, cuánto tarda un paso con muchos enemigos, y saca capturas del juego.
import { abrir, salida } from "./comun.mjs";
const minutos = +(process.argv[2] || 6), pj = process.argv[3] || "antonia";
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800, dpr: 2, tactil: true });
const foto = (n) => pag.screenshot({ path: salida(n + ".png") });
await pag.waitForTimeout(300);
await foto("m-portada");
for (const p of ["menu", "personajes", "escenarios", "mejoras", "opciones"]) { await pag.evaluate((p) => window.__NC.ir(p), p); await pag.waitForTimeout(120); await foto("m-" + p); }
await pag.evaluate((pj) => { window.__NC.nueva(pj, "bosque", 7); }, pj);
const info = [];
let ultMin = -1;
for (let vuelta = 0; vuelta < minutos * 30; vuelta++) {
  const r = await pag.evaluate(() => {
    const t0 = performance.now(); let pasos = 0, peor = 0;
    for (let i = 0; i < 600; i++) {
      if (J.fin) break;
      if (J.modal && J.modal.tipo === "nivel") { const ops = J.modal.ops; elegirOpcion(ops.find((o) => o.tipo === "arma") || ops[0]); continue; }
      if (J.modal && J.modal.tipo === "cofre") { resolverCofre(J.modal); J.modal = null; continue; }
      // jugar como una persona: ir a las gemas (y cofres) y alejarse de lo que está cerca
      const j = J.jug; let mx = Math.cos(J.t * 0.3) * 0.3, my = Math.sin(J.t * 0.3) * 0.3, mejor = null, md = 1e9;
      for (const gm of J.gemas.concat(J.cosas)) { const d = (gm.x - j.x) ** 2 + (gm.y - j.y) ** 2; if (d < md) { md = d; mejor = gm; } }
      if (mejor && md < 160 * 160) { const d = Math.sqrt(md) || 1; mx += (mejor.x - j.x) / d; my += (mejor.y - j.y) / d; }
      for (const e of J.enemigos) { if (e.d.brasero) continue; const dx = j.x - e.x, dy = j.y - e.y, d2 = dx * dx + dy * dy; if (d2 < 45 * 45) { const d = Math.sqrt(d2) || 1, f = (45 - d) / 45 * 2.2; mx += dx / d * f; my += dy / d * f; } }
      const q = performance.now();
      IN.teclas.clear(); const n = Math.hypot(mx, my) || 1; if (mx / n < -0.38) IN.teclas.add("izq"); if (mx / n > 0.38) IN.teclas.add("der"); if (my / n < -0.38) IN.teclas.add("arr"); if (my / n > 0.38) IN.teclas.add("aba");
      pasoJuego(1 / 60); pasos++; peor = Math.max(peor, performance.now() - q);
    }
    IN.teclas.clear();
    return { t: Math.round(J.t), nivel: J.nivel, vida: Math.round(J.jug.vida), ene: J.enemigos.length, gemas: J.gemas.length, kills: J.kills, oro: J.oro, armas: J.armas.map((a) => a.k + a.nivel).join(" "), pas: J.pasivos.map((p) => p.k + p.nivel).join(" "), ms: +((performance.now() - t0) / Math.max(1, pasos)).toFixed(2), peor: +peor.toFixed(1), fin: J.fin };
  });
  info.push(r);
  const mn = Math.floor(r.t / 60);
  if (mn !== ultMin) { ultMin = mn; console.log(JSON.stringify(r)); if ([1, 3, 5, 8, 10].includes(mn)) { await pag.evaluate(() => window.__NC.dibujar()); await foto(`j-${mn}min`); } }
  if (r.fin) console.log("MURIÓ:", JSON.stringify(r));
  if (r.fin || r.t >= minutos * 60) break;
}
await pag.evaluate(() => { J.jug.inv = 0; window.__NC.dibujar(); }); await foto("j-final");
// morir: la pantalla de fin y los resultados
await pag.evaluate(() => { if (!J.fin) { J.revividas = 99; J.jug.inv = 0; herirJugador(1e6); } for (let i = 0; i < 120; i++) pasoJuego(1 / 60); window.__NC.dibujar(); });
await foto("j-muerte");
await pag.evaluate(() => { for (let i = 0; i < 100; i++) pasoJuego(1 / 60); window.__NC.dibujar(); });
console.log("después de morir:", await pag.evaluate(() => PANT + " oro guardado=" + G.oro));
await foto("m-resultados");
// el cementerio, con su gente
await pag.evaluate(() => { const S = window.__NC; S.nueva("kiro", "cementerio", 4); J.t = 250; for (let i = 0; i < 60; i++) aparecer(A.uno(["fantasma", "esqueleto", "momia"])); for (let i = 0; i < 240; i++) { J.pendientes = 0; pasoJuego(1 / 60); } S.dibujar(); });
await foto("j-cementerio");
// el anillo de flores y un enjambre
await pag.evaluate(() => { const S = window.__NC; S.nueva("antonia", "bosque", 9); evento("flores"); evento("enjambre"); for (let i = 0; i < 90; i++) { J.pendientes = 0; pasoJuego(1 / 60); } S.dibujar(); });
await foto("j-eventos");
// medir el dibujo con la multitud de ahora
const ms = await pag.evaluate(() => { for (let i = 0; i < 10; i++) window.__NC.dibujar(); const t = performance.now(); for (let i = 0; i < 30; i++) window.__NC.dibujar(); return +((performance.now() - t) / 30).toFixed(2); });
console.log("dibujo ms/cuadro:", ms, "(swiftshader; no dice nada del teléfono)");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 20).join("\n") : "sin errores");
await nav.close();
