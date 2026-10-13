const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("pageerror " + e.message));
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => { const J = window.prueba.jui, pan = J.arriba(); if (!pan) return; const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; }; const c = rec(pan.raiz); if (c) J.apretar(c); }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Bot', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 0 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
await pg.evaluate(() => { window.Mundo.poner(1, 3, 3, 9, 0); const v = window.prueba.inventario(); v.barra[0] = { id: 374, m: 0, n: 3, d: 0 }; Interfaz.juego.elegido = 0; });
await pg.waitForTimeout(800);
const r = await pg.evaluate(() => {
  const J = window.prueba.jugador, dx = 1.5 - J.x, dy = 3.98 - (J.y + 1.62), dz = 3.5 - J.z, h = Math.sqrt(dx * dx + dz * dz);
  J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h);
  return { J: [J.x, J.y, J.z], b: window.Mundo.bloque(1, 3, 3) + ':' + window.Mundo.meta(1, 3, 3) };
});
console.log(JSON.stringify(r));
await pg.waitForTimeout(200);
const cam = await pg.evaluate(() => { const c = window.prueba.cam; return [c.x, c.y, c.z, c.yaw, c.pitch]; });
console.log('cam', JSON.stringify(cam));
const ray = await pg.evaluate(() => { const c = window.prueba.cam, cp = Math.cos(c.pitch); const d = [Math.sin(c.yaw) * cp, -Math.sin(c.pitch), -Math.cos(c.yaw) * cp]; return [window.Mundo.rayo(c.x, c.y, c.z, d[0], d[1], d[2], 5, true), window.Mundo.rayo(c.x, c.y, c.z, d[0], d[1], d[2], 5, false)]; });
console.log('rayo con líquidos', JSON.stringify(ray));
await pg.touchscreen.tap(436, 196);
await pg.waitForTimeout(400);
console.log('mano', await pg.evaluate(() => JSON.stringify(window.prueba.inventario().barra[0])));
await nav.close();
