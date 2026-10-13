// minar en supervivencia con el dedo de verdad: pasto con la mano, piedra con y sin pico, carbón
// (con experiencia), levantar lo que cae; matar un chancho con espada (botín y experiencia)
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
  await pg.evaluate((lado) => {
    const J = window.prueba.jui, pan = J.arriba(); if (!pan) return;
    const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; };
    const c = rec(pan.raiz); if (c) J.apretar(c);
  }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Minar', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 0 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(pg);
// mantener el dedo en un punto (en píxeles CSS) durante ms
async function mantener(x, y, ms) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  const pasos = Math.ceil(ms / 100);
  for (let i = 0; i < pasos; i++) { await pg.waitForTimeout(100); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (i % 2) * 0.2, y, id: 1 }] }); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const inv = () => pg.evaluate(() => { const v = window.prueba.inventario(); return [].concat(v.barra, v.mochila).filter(Boolean).map((c) => c.id + ':' + c.m + 'x' + c.n + (c.d ? ' d' + c.d : '')).join(' '); });
const est = () => pg.evaluate(() => { const s = window.prueba.supervivencia(); return { nivel: s.nivel, prog: +s.progreso.toFixed(3), tirados: window.prueba.tirados().length }; });
// vaciar el inventario, mirar al piso
await pg.evaluate(() => { const v = window.prueba.inventario(); for (let i = 0; i < 9; i++) v.barra[i] = null; for (let i = 0; i < 27; i++) v.mochila[i] = null; Interfaz.juego.elegido = 0; window.prueba.jugador.pitch = 1.3; window.prueba.jugador.yaw = 0; });
await pg.waitForTimeout(300);
const cx = 873 / 2, cy = 393 / 2;
// 1. el pasto con la mano: ~0,9 s, suelta tierra y se levanta
let t0 = Date.now();
await mantener(cx, cy, 1600);
await pg.waitForTimeout(1500);
console.log("pasto con la mano: " + (await inv()) + " | " + JSON.stringify(await est()));
await pg.screenshot({ path: `${pref}-1-pasto.png` });
// 2. piedra sin pico: no suelta nada (y tarda 7,5 s); con pico de madera, adoquín en ~1,2 s
await pg.evaluate(() => {
  const J = window.prueba.jugador, x = Math.floor(J.x), z = Math.floor(J.z) - 2;
  for (let y = 1; y <= 5; y++) window.Mundo.poner(x, y, z, 1, 0);
  J.pitch = 0.0; J.yaw = 0;
});
await pg.waitForTimeout(400);
await mantener(cx, cy, 3000);
await pg.waitForTimeout(400);
console.log("piedra 3 s con la mano: rompiendo " + await pg.evaluate(() => window.prueba.mundo.rompiendo) + " | " + (await inv()));
await pg.evaluate(() => { const v = window.prueba.inventario(); v.barra[1] = { id: 270, m: 0, n: 1, d: 0 }; Interfaz.juego.elegido = 1; });
await pg.waitForTimeout(300);
await mantener(cx, cy, 2000);
await pg.waitForTimeout(1500);
console.log("piedra con pico de madera: " + (await inv()));
// 3. carbón con pico de madera: carbón y orbes de experiencia
await pg.evaluate(() => {
  const J = window.prueba.jugador, x = Math.floor(J.x), z = Math.floor(J.z) - 2;
  for (let y = 1; y <= 5; y++) window.Mundo.poner(x, y, z, 16, 0);
});
await pg.waitForTimeout(400);
await mantener(cx, cy, 2600);
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${pref}-2-carbon.png` });
console.log("tirados tras el carbón: " + JSON.stringify(await pg.evaluate(() => window.prueba.tirados().map((e) => e.xp !== undefined ? 'xp' + e.xp : e.c.id + 'x' + e.c.n))));
await pg.waitForTimeout(2500);
console.log("carbón: " + (await inv()) + " | " + JSON.stringify(await est()));
// 4. tirar algo y verlo en el piso (lejos, para que no se levante)
await pg.evaluate(() => { const J = window.prueba.jugador; window.prueba.tirados; window.Tirados.cosa({ id: 1, m: 0, n: 20 }, J.x + 1.5, J.y + 0.5, J.z - 1.5, 0, 0, 0, 2000); window.Tirados.cosa({ id: 276, m: 0, n: 1 }, J.x - 1.5, J.y + 0.5, J.z - 1.5, 0, 0, 0, 2000); window.Tirados.orbes(J.x, J.y + 0.5, J.z - 3, 40); J.pitch = 0.5; });
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${pref}-3-tirados.png` });
// 5. matar un chancho con espada de diamante
await pg.evaluate(() => { const v = window.prueba.inventario(); v.barra[2] = { id: 276, m: 0, n: 1, d: 0 }; Interfaz.juego.elegido = 2; const J = window.prueba.jugador; J.ubicar(J.x + 30, 4, J.z); J.pitch = 0.3; window.prueba.bichos.crear('pig', J.x, J.y, J.z - 2.2); });
await pg.waitForTimeout(500);
for (let i = 0; i < 4; i++) {
  // mirar al chancho (se mueve) y tocar al medio
  await pg.evaluate(() => {
    const J = window.prueba.jugador, p = (window.prueba.bichos.lista || []).find((e) => e.tipo === 'pig');
    if (!p) return;
    const dx = p.x - J.x, dy = p.y + 0.45 - (J.y + 1.62), dz = p.z - J.z, h = Math.sqrt(dx * dx + dz * dz);
    J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h);
  });
  await pg.waitForTimeout(80);
  await pg.touchscreen.tap(cx, cy);
  await pg.waitForTimeout(700);
  const ch = await pg.evaluate(() => { const l = window.prueba.bichos.lista || []; const p = l.find((e) => e.tipo === 'pig'); return p ? { vida: p.vida, muerte: p.muerte } : 'no hay chancho'; });
  console.log('golpe ' + (i + 1) + ': ' + JSON.stringify(ch));
  if (ch === 'no hay chancho' || ch.muerte > 0) break;
}
await pg.waitForTimeout(2500);
console.log("tras el chancho: " + JSON.stringify(await pg.evaluate(() => window.prueba.tirados().map((e) => e.xp !== undefined ? 'xp' + e.xp : e.c.id + 'x' + e.c.n))) + " | " + (await inv()) + " | " + JSON.stringify(await est()));
await pg.screenshot({ path: `${pref}-4-chancho.png` });
console.log("errores de la página: " + errores);
await nav.close();
