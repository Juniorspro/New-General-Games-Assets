// los efectos: manzana dorada (absorción y regeneración), veneno, leche, poción de velocidad, vida
// extra, la lista de efectos, visión nocturna, ceguera y náusea
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")); });
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Efectos', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 2 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1200);
const est = () => pg.evaluate(() => {
  const s = window.prueba.supervivencia(), v = window.prueba.inventario(), J = window.prueba.jugador;
  return 'vida ' + s.vida + '/' + s.max + ' abs ' + s.absorcion + ' comida ' + s.comida + ' efectos [' + s.efectos.lista.map((e) => e.id + 'n' + e.amp + ' ' + e.dur).join(', ') +
    '] mano ' + (v.barra[Interfaz.juego.elegido] ? v.barra[Interfaz.juego.elegido].id + ':' + v.barra[Interfaz.juego.elegido].m + 'x' + v.barra[Interfaz.juego.elegido].n : '-') +
    ' vel ' + J.velMult.toFixed(2) + ' salto ' + J.saltoExtra.toFixed(2);
});
const cdp = await ctx.newCDPSession(pg);
async function mantener(ms) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 436, y: 150, id: 1 }] });
  for (let i = 0; i < ms / 100; i++) { await pg.waitForTimeout(100); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 436 + (i % 2) * 0.2, y: 150, id: 1 }] }); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
function poner(id, m, n) { return pg.evaluate(([id, m, n]) => { const v = window.prueba.inventario(); v.barra[0] = { id, m, n, d: 0 }; Interfaz.juego.elegido = 0; window.prueba.jugador.pitch = -0.3; Interfaz.sucio && Interfaz.sucio(); }, [id, m, n]); }
// 1. la manzana dorada con 14 de vida
await pg.evaluate(() => { const s = window.prueba.supervivencia(); s.vida = 14; });
await poner(322, 0, 2);
await mantener(2300);
await pg.waitForTimeout(500);
console.log('manzana dorada: ' + await est());
await pg.screenshot({ path: `${pref}-1-manzana.png` });
// 2. veneno: corazones verdes, baja la vida hasta 1
await pg.evaluate(() => window.prueba.darEfecto(19, 120, 1));
await pg.waitForTimeout(1500);
console.log('con veneno II: ' + await est());
await pg.screenshot({ path: `${pref}-2-veneno.png` });
// 3. la leche lo saca todo y deja el balde
await poner(325, 1, 1);
await mantener(2300);
await pg.waitForTimeout(300);
console.log('tras la leche: ' + await est());
// 4. poción de velocidad II y vida extra II, salto
await poner(373, 16, 1);
await mantener(2300);
await pg.waitForTimeout(300);
await pg.evaluate(() => { window.prueba.darEfecto(21, 600, 1); window.prueba.darEfecto(8, 600, 1); window.prueba.darEfecto(3, 600, 0); window.prueba.darEfecto(22, 600, 1); });
await pg.waitForTimeout(500);
console.log('velocidad, vida extra, salto: ' + await est());
await pg.screenshot({ path: `${pref}-3-varios.png` });
// 5. la lista de efectos (tocando los íconos)
const z = await pg.evaluate(() => { const z = window.prueba.pantallas.zonaEfectos(); return z && [(z.x + z.w / 2) * Jui.escala / Interfaz.dpr(), (z.y + 10) * Jui.escala / Interfaz.dpr()]; });
console.log('zona de los íconos: ' + JSON.stringify(z));
if (z) {
  await pg.touchscreen.tap(z[0], z[1]);
  await pg.waitForTimeout(700);
  console.log('pantalla: ' + await pg.evaluate(() => Interfaz.pantalla + ' / ' + window.prueba.pantallas.nombre()));
  await pg.screenshot({ path: `${pref}-4-lista.png` });
  await pg.evaluate(() => window.prueba.jui.boton ? null : null);
  await pg.evaluate(() => { window.prueba.pantallas.vaciar(); Interfaz.ir('juego'); });
  await pg.waitForTimeout(300);
}
// 6. visión nocturna de noche, ceguera, náusea
await pg.evaluate(() => { const p = window.prueba.partida(); p.siempreDia = false; p.tiempo = 18000; window.prueba.jugador.pitch = 0.1; });
await pg.waitForTimeout(600);
await pg.screenshot({ path: `${pref}-5-noche.png` });
await pg.evaluate(() => window.prueba.darEfecto(16, 1200, 0));
await pg.waitForTimeout(600);
await pg.screenshot({ path: `${pref}-6-vision.png` });
await pg.evaluate(() => { const p = window.prueba.partida(); p.tiempo = 6000; p.siempreDia = true; window.prueba.darEfecto(15, 600, 0); });
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-7-ceguera.png` });
await pg.evaluate(() => { const s = window.prueba.supervivencia(); window.Efectos.quitar(s.efectos, 15); window.prueba.darEfecto(9, 600, 0); });
await pg.waitForTimeout(4000);
await pg.screenshot({ path: `${pref}-8-nausea.png` });
console.log('al final: ' + await est());
console.log("errores de la página: " + errores);
await nav.close();
