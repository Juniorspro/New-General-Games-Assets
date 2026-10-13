// el arco y lo que se tira: flechas a un chancho, flecha clavada que se levanta, bolas de nieve,
// huevos, perla de ender, botella de experiencia, pociones arrojadizas
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Lanzar', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 1 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const cx = 873 / 2, cy = 393 / 2;
const cdp = await ctx.newCDPSession(pg);
async function mantener(ms, foto) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
  for (let i = 0; i < ms / 100; i++) { await pg.waitForTimeout(100); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + (i % 2) * 0.2, y: cy, id: 1 }] }); if (foto && i === Math.floor(ms / 100) - 2) await pg.screenshot({ path: foto }); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
function mano(id, m, n) { return pg.evaluate(([id, m, n]) => { const v = window.prueba.inventario(); v.barra[0] = id ? { id, m, n, d: 0 } : null; Interfaz.juego.elegido = 0; }, [id, m, n]); }
const inv = () => pg.evaluate(() => { const v = window.prueba.inventario(); return [].concat(v.barra, v.mochila).filter(Boolean).map((c) => c.id + ':' + c.m + 'x' + c.n + (c.d ? ' d' + c.d : '')).join(' '); });
// mirar a un punto
async function mirar(x, y, z) {
  await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador, dx = x - J.x, dy = y - (J.y + 1.62), dz = z - J.z, h = Math.sqrt(dx * dx + dz * dz); J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h); }, [x, y, z]);
  await pg.waitForTimeout(150);
}
// 1. el arco contra un chancho a 7 bloques
await pg.evaluate(() => { const J = window.prueba.jugador; window.prueba.bichos.crear('pig', J.x, J.y, J.z - 7); });
await pg.waitForTimeout(300);
await mano(261, 0, 1);
await pg.evaluate(() => { const v = window.prueba.inventario(); v.mochila[0] = { id: 262, m: 0, n: 5, d: 0 }; });
const chancho = () => pg.evaluate(() => { const p = (window.prueba.bichos.lista || []).find((e) => e.tipo === 'pig'); return p ? { vida: p.vida, muerte: p.muerte, x: +p.x.toFixed(2), z: +p.z.toFixed(2), ef: p.efectos ? p.efectos.lista.map((e) => e.id) : [] } : null; });
for (let k = 0; k < 3; k++) {
  const p = await chancho();
  if (!p || p.muerte > 0) break;
  await mirar(p.x, 4.6, p.z);
  await mantener(1300, k === 0 ? `${pref}-1-tensando.png` : null);
  await pg.waitForTimeout(900);
  console.log('flecha ' + (k + 1) + ': chancho ' + JSON.stringify(await chancho()) + ' | ' + await inv());
}
// 2. una flecha al piso, después pasar por encima
await pg.evaluate(() => { window.prueba.jugador.yaw = Math.PI / 2; window.prueba.jugador.pitch = 0.6; });
await pg.waitForTimeout(150);
await mantener(600);
await pg.waitForTimeout(1500);
const clavadas = await pg.evaluate(() => window.prueba.bichos.disparados);
console.log('disparados: ' + JSON.stringify(clavadas) + ' | ' + await inv());
const fl = await pg.evaluate(() => window.prueba.bichos.proyectiles.filter((p) => p.clavado).map((p) => [p.x, p.y, p.z, p.recoger]));
console.log('clavadas: ' + JSON.stringify(fl));
if (fl.length) await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador; J.ubicar(x, J.y, z + 0.3); }, fl[fl.length - 1]);
await pg.waitForTimeout(300);
console.log('debug: ' + JSON.stringify(await pg.evaluate(() => { const J = window.prueba.jugador, B = window.prueba.bichos; return { J: [J.x, J.y, J.z], gancho: typeof B.alRecogerFlecha, clav: B.proyectiles.filter((p) => p.clavado).length }; })));
await pg.waitForTimeout(500);
console.log('tras pasar por la flecha: ' + await inv());
// 3. bolas de nieve y huevos (al aire, adelante)
await pg.evaluate(() => { window.prueba.jugador.yaw = 0; window.prueba.jugador.pitch = -0.2; });
await mano(332, 0, 16);
for (let i = 0; i < 4; i++) { await pg.touchscreen.tap(cx, cy); await pg.waitForTimeout(150); }
await pg.screenshot({ path: `${pref}-2-nieve.png` });
await mano(344, 0, 16);
for (let i = 0; i < 16; i++) { await pg.touchscreen.tap(cx, cy); await pg.waitForTimeout(100); }
await pg.waitForTimeout(2500);
console.log('huevos: pollitos ' + await pg.evaluate(() => (window.prueba.bichos.lista || []).filter((e) => e.tipo === 'chicken').length) + ' | mano ' + await inv());
// 4. la perla
const antes = await pg.evaluate(() => { const J = window.prueba.jugador; return [J.x, J.z, window.prueba.supervivencia().vida]; });
await mano(368, 0, 4);
await pg.evaluate(() => { window.prueba.jugador.yaw = Math.PI; window.prueba.jugador.pitch = -0.3; });
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(3000);
const despues = await pg.evaluate(() => { const J = window.prueba.jugador; return [J.x, J.z, window.prueba.supervivencia().vida]; });
console.log('perla: de ' + antes.map((v) => v.toFixed(1)) + ' a ' + despues.map((v) => v.toFixed(1)));
// 5. la botella de experiencia (hacia abajo cerca)
await mano(384, 0, 5);
await pg.evaluate(() => { window.prueba.jugador.pitch = 1.2; });
for (let i = 0; i < 3; i++) { await pg.touchscreen.tap(cx, cy); await pg.waitForTimeout(300); }
await pg.waitForTimeout(3000);
console.log('experiencia: nivel ' + await pg.evaluate(() => { const s = window.prueba.supervivencia(); return s.nivel + ' + ' + s.progreso.toFixed(2); }));
// 6. pociones arrojadizas: veneno al chancho nuevo y regeneración a uno mismo
await pg.evaluate(() => { const J = window.prueba.jugador; window.prueba.bichos.crear('pig', J.x + 3, J.y, J.z); window.prueba.supervivencia().vida = 10; });
await pg.waitForTimeout(400);
const p2 = await chancho();
await mano(438, 25, 1);
await mirar(p2.x, 4.2, p2.z);
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(2500);
console.log('veneno al chancho: ' + JSON.stringify(await chancho()));
await mano(438, 28, 1);
await pg.evaluate(() => { window.prueba.jugador.pitch = 1.5; });
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(1500);
console.log('regeneración propia: ' + JSON.stringify(await pg.evaluate(() => { const s = window.prueba.supervivencia(); return { vida: s.vida, ef: s.efectos.lista.map((e) => e.id + ':' + e.dur) }; })));
await pg.screenshot({ path: `${pref}-3-pocion.png` });
console.log("errores de la página: " + errores);
await nav.close();
