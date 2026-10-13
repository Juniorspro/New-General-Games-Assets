// el End: ir con el gancho de prueba a la plataforma, mirar la isla y los pilares
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'End', modo: 'creativo', tipo: 'infinito', semilla: '31337', bichos: true, dificultad: 2 }));
const enJuego = async () => { for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego' && !window.prueba.cargando()").catch(() => false)) return true; await pg.waitForTimeout(200); } return false; };
await enJuego();
await pg.waitForTimeout(800);
// un portal del End en el piso del mundo de arriba: pisarlo
const P = await pg.evaluate(() => { const J = window.prueba.jugador, x = Math.floor(J.x), y = Math.floor(J.y), z = Math.floor(J.z) - 2; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) window.Mundo.poner(x + dx, y - 1, z + dz, 119, 0); return [x, y, z]; });
await pg.waitForTimeout(500);
await pg.evaluate(() => { const J = window.prueba.jugador; J.pitch = 0.6; });
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${pref}-0-portal-end.png` });
await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador; J.volando = false; J.ubicar(x + 0.5, y, z + 0.5); }, P);
let dim = 0;
for (let i = 0; i < 60; i++) { dim = await pg.evaluate(() => window.prueba.dimension()); if (dim === 2) break; await pg.waitForTimeout(250); }
await enJuego();
await pg.waitForTimeout(3000);
console.log('dimensión ' + dim + ' en ' + JSON.stringify(await pg.evaluate(() => { const J = window.prueba.jugador; return [J.x, J.y, J.z, window.Mundo.bloque(Math.floor(J.x), Math.floor(J.y) - 1, Math.floor(J.z))]; })));
await pg.screenshot({ path: `${pref}-1-llegada.png` });
// mirar la isla desde arriba
await pg.evaluate(() => { const J = window.prueba.jugador; J.volando = true; Interfaz.juego.volando = true; J.ubicar(70, 95, 30); J.yaw = Math.atan2(0 - 70, -(0 - 30)); J.pitch = 0.45; });
await pg.waitForTimeout(4000);
await pg.screenshot({ path: `${pref}-2-isla.png` });
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(10, 66, 10); J.yaw = Math.atan2(-10, 10); J.pitch = 0.3; });
await pg.waitForTimeout(3000);
await pg.screenshot({ path: `${pref}-3-podio.png` });
console.log('bichos: ' + JSON.stringify(await pg.evaluate(() => { const c = {}; window.prueba.bichos.lista.forEach((e) => { c[e.tipo] = (c[e.tipo] || 0) + 1; }); return c; })));
// volver por el portal de salida (prendido a mano para la prueba)
await pg.evaluate(() => { for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (x * x + z * z <= 6 && (x || z)) window.Mundo.poner(x, 60, z, 119, 0); const J = window.prueba.jugador; J.volando = false; J.ubicar(1.5, 61, 1.5); });
for (let i = 0; i < 60; i++) { dim = await pg.evaluate(() => window.prueba.dimension()); if (dim === 0) break; await pg.waitForTimeout(250); }
await enJuego();
console.log('de vuelta: dimensión ' + dim + ' en ' + JSON.stringify(await pg.evaluate(() => { const J = window.prueba.jugador; return [+J.x.toFixed(1), +J.y.toFixed(1), +J.z.toFixed(1)]; })));
console.log("errores de la página: " + errores);
await nav.close();
