// los bichos que aparecen solos en un mundo normal: de día (animales) y de noche (monstruos), con
// lo que tarda cada cuadro
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, semilla] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")); });
pg.on("console", (m) => { if (m.type() === "error" && !/WebSocket/.test(m.text())) console.log("[error] " + m.text()); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => {
    const J = window.prueba.jui, pan = J.arriba(); if (!pan) return;
    const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; };
    const c = rec(pan.raiz); if (c) J.apretar(c);
  }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate((s) => window.prueba.crear({ nombre: 'Solos', modo: 'creativo', tipo: 'infinito', semilla: +s || 12345, bichos: true }), semilla);
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(2000);
const resumen = () => pg.evaluate(() => {
  const B = window.prueba.bichos, c = {};
  B.todos().forEach((e) => { c[e.tipo] = (c[e.tipo] || 0) + 1; });
  return JSON.stringify(c) + " ms/cuadro " + window.prueba.ms().toFixed(1);
});
for (let k = 0; k < 6; k++) { await pg.waitForTimeout(5000); console.log("día " + (k + 1) * 5 + " s: " + await resumen()); }
await pg.evaluate(() => { window.prueba.jugador.pitch = 0.1; });
await pg.screenshot({ path: `${pref}-dia.png` });
await pg.evaluate(() => window.prueba.comando('/time set night'));
for (let k = 0; k < 8; k++) { await pg.waitForTimeout(5000); console.log("noche " + (k + 1) * 5 + " s: " + await resumen()); }
await pg.screenshot({ path: `${pref}-noche.png` });
// el más cercano de frente, para la foto
await pg.evaluate(() => {
  const P = window.prueba, J = P.jugador, l = P.bichos.todos().filter((e) => e.muerte === 0);
  l.sort((a, b) => ((a.x - J.x) ** 2 + (a.z - J.z) ** 2) - ((b.x - J.x) ** 2 + (b.z - J.z) ** 2));
  if (l[0]) { const e = l[0]; J.yaw = Math.atan2(e.x - J.x, -(e.z - J.z)); J.pitch = 0.2; }
});
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-cerca.png` });
console.log("errores de la página: " + errores);
await nav.close();
