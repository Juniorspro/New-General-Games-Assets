// los objetos de la 1.2: las pestañas del inventario creativo y algunos en la mano
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
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
await pg.evaluate("window.prueba.crear({ nombre: 'Objetos', modo: 'creativo', tipo: 'plano', bichos: false, siempreDia: true })");
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(2000);
const cuenta = await pg.evaluate(() => {
  const l = Objetos.creativo(), c = {};
  l.forEach((it) => { c[it.tab] = (c[it.tab] || 0) + 1; });
  const items = l.filter((it) => it.id >= 256 && it.id !== 383);
  return JSON.stringify(c) + " objetos: " + items.length + " ej: " + items.slice(0, 6).map((it) => Objetos.nombre(it.id, it.m)).join(", ");
});
console.log("creativo: " + cuenta);
for (const tab of [0, 2, 3, 1]) {
  await pg.evaluate((tab) => { Interfaz.ir('inventario'); Interfaz.acciones.tab({ i: tab }); Interfaz.sucio(); }, tab);
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: `${pref}-inv${tab}.png` });
}
await pg.evaluate(() => Interfaz.ir('juego'));
for (const [id, m, n] of [[278, 0, "pico"], [297, 0, "pan"], [325, 8, "balde"], [261, 0, "arco"], [355, 14, "cama"]]) {
  await pg.evaluate(([id, m]) => { Interfaz.juego.barra[0] = { id: id, m: m }; Interfaz.juego.elegido = 0; Interfaz.sucio(); }, [id, m]);
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${pref}-mano-${n}.png` });
}
// el balde de agua en el piso y unas semillas en tierra arada
const r = await pg.evaluate(() => {
  const P = window.prueba, J = P.jugador, M = window.Mundo;
  const X = Math.floor(J.x), Z = Math.floor(J.z) - 3;
  let y = 120; while (y > 0 && M.bloque(X, y, Z) === 0) y--;
  M.poner(X, y, Z, 60, 0);
  return [X, y, Z, Objetos.nombre(295, 0), Objetos.nombre(373, 21), Objetos.nombre(438, 22), Objetos.nombre(351, 15), Objetos.nombre(325, 10), Objetos.nombre(500, 0)].join(" | ");
});
console.log("nombres: " + r);
console.log("errores de la página: " + errores);
await nav.close();
