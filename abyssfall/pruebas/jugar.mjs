// Prueba general: capturas de los menús y un bot que baja por el pozo (salta, dispara abajo cuando
// hay algo, va hacia las gemas, elige la primera mejora). Mide errores y cuánto baja.
import { abrir, salida } from "./comun.mjs";
const segundos = +(process.argv[2] || 90);
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800, dpr: 2, tactil: true });
const foto = (n) => pag.screenshot({ path: salida(n + ".png") });
await pag.waitForTimeout(400); await foto("m-titulo");
for (const p of ["menu", "estilos", "paletas", "opciones"]) { await pag.evaluate((p) => window.__AB.ir(p), p); await pag.waitForTimeout(100); await foto("m-" + p); }
await pag.evaluate(() => window.__AB.nueva(11));
await pag.evaluate(() => window.__AB.dibujar()); await foto("j-inicio");
const log = [];
for (let s = 0; s < segundos; s += 5) {
  const r = await pag.evaluate(() => {
    for (let i = 0; i < 300; i++) {
      if (J.fase === "mejora") { elegirMejora(J.opciones[0]); continue; }
      if (J.fase === "fin") break;
      const j = J.jug; IN.teclas.clear();
      // hacia dónde: la gema más cercana abajo, si no, el hueco más cercano
      let obj = null, md = 1e9;
      for (const gm of J.gemas) { const d = Math.hypot(gm.x - j.x, gm.y - j.y); if (d < md && d < 90) { md = d; obj = gm.x; } }
      if (obj == null) { J.bot = J.bot || { dir: 1, t: 0 }; obj = j.x + J.bot.dir * 40; J.bot.t += 1 / 60; if (J.bot.t > 2.2) { J.bot.dir *= -1; J.bot.t = 0; } if (j.x > 168) J.bot.dir = -1; if (j.x < 24) J.bot.dir = 1; }
      if (obj < j.x - 3) IN.teclas.add("izq"); else if (obj > j.x + 3) IN.teclas.add("der");
      const abajo = J.bichos.some((b) => !b.muerto && Math.abs(b.x - j.x) < 14 && b.y > j.y && b.y - j.y < 90) || rompible(J.N.en(Math.floor(j.x / T), Math.floor((j.y + 8) / T)));
      if (j.suelo) { if (J.cuadro % 40 === 0) { EDGE.add("salto"); IN.teclas.add("salto"); } }
      else if (abajo && j.carga > 0) { if (!j.armado) EDGE.add("salto"); IN.teclas.add("salto"); }
      pasoJuego(1 / 60); finCuadroEntrada();
    }
    IN.teclas.clear();
    const j = J.jug;
    return { t: Math.round(J.t), nivel: nombreNivel(), y: Math.round(j.y / T), filas: J.N.filas, vida: j.vida + "/" + j.vidaMax, carga: j.carga + "/" + j.cargaMax, gemas: J.gemasPartida, kills: J.kills, combo: J.maxCombo, arma: J.arma, mejoras: Object.keys(J.mejoras).join(","), fin: J.fase, gh: j.gemHigh, sala: !!J.sala };
  });
  log.push(r);
  console.log(JSON.stringify(r));
  if ([10, 30, 60].includes(s)) { await pag.evaluate(() => window.__AB.dibujar()); await foto(`j-${s}s`); }
  if (r.fin === "fin") break;
}
await pag.evaluate(() => window.__AB.dibujar()); await foto("j-final");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].slice(0, 15).join("\n") : "sin errores");
await nav.close();
