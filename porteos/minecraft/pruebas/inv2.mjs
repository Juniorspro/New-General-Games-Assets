// el inventario de supervivencia: arrastrar, mantener (la mitad), tocar dos veces (juntar), armadura
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
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
  await pg.evaluate((lado) => { const J = window.prueba.jui, pan = J.arriba(); if (!pan) return; const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; };
    const c = rec(pan.raiz); if (c) J.apretar(c); }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Inv2', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1000);
// cosas en la mochila
await pg.evaluate(() => {
  const P = window.prueba;
  const inv = P.inventario();
  Inventario.agregar(inv, Inventario.cosa(264, 0, 40));     // diamantes en la barra libre...
  inv.mochila[0] = Inventario.cosa(4, 0, 50);
  inv.mochila[1] = Inventario.cosa(4, 0, 30);
  inv.mochila[2] = Inventario.cosa(310, 0, 1);              // casco de diamante
  inv.mochila[3] = Inventario.cosa(278, 0, 1, 700);         // pico de diamante gastado
  Interfaz.acciones.inventario();
});
await pg.waitForTimeout(700);
const pos = (col, i) => pg.evaluate(([col, i]) => {
  const J = window.prueba.jui, pan = J.arriba(); let r = null;
  const rec = (c) => { if (r) return; if (c.t === 'button' && c.ver) { const q = J.coleccionDe(c); if (q && q.col === col && q.i === i) r = [c.x + c.w / 2, c.y + c.h / 2]; } c.hijos.forEach(rec); };
  rec(pan.raiz);
  return r ? [r[0] * J.escala / devicePixelRatio, r[1] * J.escala / devicePixelRatio] : null;
}, [col, i]);
const estado = () => pg.evaluate(() => { const inv = window.prueba.inventario(), f = (c) => c ? c.id + "x" + c.n + (c.d ? "d" + c.d : "") : "-";
  return "mochila " + inv.mochila.slice(0, 5).map(f).join(" ") + " | barra " + inv.barra.map(f).join(" ") + " | mano " + f(inv.mano) + " | armadura " + inv.armadura.map(f).join(" "); });
await pg.screenshot({ path: `${pref}-1.png` });
console.log("inicio: " + await estado());
// arrastrar la piedra (mochila 0) a la barra 6 (de costado, como un dedo)
const cdp = await ctx.newCDPSession(pg);
async function arrastrar(a, b) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1] }] });
  for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a[0] + (b[0] - a[0]) * k / 8, y: a[1] + (b[1] - a[1]) * k / 8 }] }); await pg.waitForTimeout(30); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pg.waitForTimeout(200);
}
async function mantener(a, ms) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1] }] });
  await pg.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pg.waitForTimeout(200);
}
await arrastrar(await pos('inventory_items', 0), await pos('hotbar_items', 6));
console.log("arrastrar piedra a la barra 6: " + await estado());
await mantener(await pos('inventory_items', 1), 700);
console.log("mantener en la piedra (30): " + await estado());
await pg.touchscreen.tap(...(await pos('inventory_items', 10))); await pg.waitForTimeout(200);
console.log("dejar la mitad en el 10: " + await estado());
// tocar dos veces la piedra de la barra: agarra y junta
const b6 = await pos('hotbar_items', 6);
await pg.touchscreen.tap(...b6); await pg.waitForTimeout(120); await pg.touchscreen.tap(...b6); await pg.waitForTimeout(250);
console.log("doble toque (juntar): " + await estado());
await pg.screenshot({ path: `${pref}-2.png` });
// la pestaña de armadura y el casco
await pg.touchscreen.tap(...(await pos('inventory_items', 0))); await pg.waitForTimeout(200);
const tabArm = await pg.evaluate(() => { const J = window.prueba.jui, pan = J.arriba(); let r = null;
  const rec = (c) => { if (r) return; if (c.n === 'armor_tab_toggle') r = [c.x + c.w / 2, c.y + c.h / 2]; c.hijos.forEach(rec); }; rec(pan.raiz);
  return [r[0] * J.escala / devicePixelRatio, r[1] * J.escala / devicePixelRatio]; });
await pg.touchscreen.tap(...tabArm); await pg.waitForTimeout(400);
await pg.touchscreen.tap(...(await pos('inventory_items', 2))); await pg.waitForTimeout(200);
const casco = await pos('armor_items', 0);
console.log("casco en " + JSON.stringify(casco));
if (casco) { await pg.touchscreen.tap(...casco); await pg.waitForTimeout(300); }
console.log("con el casco: " + await estado());
await pg.screenshot({ path: `${pref}-3.png` });
console.log("errores de la página: " + errores);
await nav.close();
