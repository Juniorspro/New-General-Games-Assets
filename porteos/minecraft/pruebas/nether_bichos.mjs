// los bichos del Nether: ir con el gancho de prueba y contar lo que aparece
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => { const J = window.prueba.jui, pan = J.arriba(); if (!pan) return; const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; }; const c = rec(pan.raiz); if (c) J.apretar(c); }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Bichos N', modo: 'creativo', tipo: 'infinito', semilla: '777', bichos: true, dificultad: 2 }));
const enJuego = async () => { for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego' && !window.prueba.cargando()").catch(() => false)) return true; await pg.waitForTimeout(200); } return false; };
await enJuego();
await pg.waitForTimeout(1000);
await pg.evaluate(() => window.prueba.cambiarDimension(1, 40, 70, 40, { portal: true }));
await pg.waitForTimeout(1000);
await enJuego();
const t0 = Date.now();
for (let s = 0; s < 6; s++) {
  await pg.waitForTimeout(5000);
  console.log(((Date.now() - t0) / 1000).toFixed(0) + ' s: ' + JSON.stringify(await pg.evaluate(() => { const c = {}; window.prueba.bichos.lista.forEach((e) => { c[e.tipo] = (c[e.tipo] || 0) + 1; }); return c; })) + ' | ' + await pg.evaluate(() => window.prueba.ms ? 'cuadro ' + window.prueba.ms().toFixed(1) + ' ms' : ''));
}
// mirar al bicho más cercano
await pg.evaluate(() => { const J = window.prueba.jugador; let m = null, d = 1e9; window.prueba.bichos.lista.forEach((e) => { const q = Math.hypot(e.x - J.x, e.z - J.z); if (q < d) { d = q; m = e; } });
  if (m) { J.ubicar(m.x + 4, m.y + 0.5, m.z); J.volando = true; const dx = m.x - J.x, dy = m.y + 1 - (J.y + 1.62), dz = m.z - J.z; J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, Math.hypot(dx, dz)); } });
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${pref}-bichos.png` });
console.log("errores de la página: " + errores);
await nav.close();
