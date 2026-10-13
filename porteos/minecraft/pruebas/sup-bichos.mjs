// supervivencia contra bichos: el zombi pega, el creeper explota, la armadura achica el golpe
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, dificultad = "2"] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 5).join("\n")); });
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
await pg.evaluate((d) => window.prueba.crear({ nombre: 'SupB', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: false, dificultad: +d }), dificultad);
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const estado = () => pg.evaluate(() => { const s = window.prueba.supervivencia(); return { vida: s.vida, muerto: window.prueba.muerto(), bichos: window.prueba.bichos.lista ? window.prueba.bichos.lista.length : '?' }; });
await pg.evaluate(() => window.prueba.comando('/time set night'));
// un zombi al lado
await pg.evaluate(() => { const J = window.prueba.jugador; window.prueba.bichos.crear('zombie', J.x + 2, J.y, J.z); });
let antes = await estado();
for (let i = 0; i < 80; i++) { await pg.waitForTimeout(100); const e = await estado(); if (e.vida < antes.vida) { console.log("el zombi pegó: " + antes.vida + " → " + e.vida); break; } }
await pg.waitForTimeout(150);
console.log("rol de la cámara: " + await pg.evaluate(() => (window.prueba.cam.rol * 180 / Math.PI).toFixed(1)));
await pg.screenshot({ path: `${pref}-1-zombi.png` });
// con armadura de diamante entera: el golpe es menos de la mitad
await pg.evaluate(() => { const inv = window.prueba.inventario(); inv.armadura[0] = { id: 310, m: 0, n: 1, d: 0 }; inv.armadura[1] = { id: 311, m: 0, n: 1, d: 0 }; inv.armadura[2] = { id: 312, m: 0, n: 1, d: 0 }; inv.armadura[3] = { id: 313, m: 0, n: 1, d: 0 }; const s = window.prueba.supervivencia(); s.vida = 20; s.invulnerable = 0; });
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${pref}-2-armadura.png` });
antes = await estado();
for (let i = 0; i < 20; i++) { await pg.waitForTimeout(500); const e = await estado(); if (e.vida < antes.vida) { console.log("con armadura: " + antes.vida + " → " + e.vida + " (desgaste casco " + await pg.evaluate(() => window.prueba.inventario().armadura[0] && window.prueba.inventario().armadura[0].d) + ")"); break; } }
// sin armadura, un creeper al lado
await pg.evaluate(() => { const inv = window.prueba.inventario(); inv.armadura = [null, null, null, null]; window.prueba.bichos.limpiar(); const s = window.prueba.supervivencia(); s.vida = 20; s.invulnerable = 0; const J = window.prueba.jugador; window.prueba.bichos.crear('creeper', J.x + 1.5, J.y, J.z); });
for (let i = 0; i < 30; i++) { await pg.waitForTimeout(400); const e = await estado(); if (e.vida < 20 || e.muerto) { console.log("creeper: vida " + e.vida + (e.muerto ? " (murió)" : "")); break; } }
await pg.waitForTimeout(600);
console.log("mensaje: " + await pg.evaluate(() => Interfaz.muerte && Interfaz.muerte.texto));
await pg.screenshot({ path: `${pref}-3-creeper.png` });
console.log("errores de la página: " + errores);
await nav.close();
