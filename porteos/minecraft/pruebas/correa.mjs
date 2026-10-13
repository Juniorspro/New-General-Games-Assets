// la correa: atar una vaca, que siga al jugador, atarla a un poste, desatarla y que se corte de lejos
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Correa', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 1 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const cx = 873 / 2, cy = 393 / 2;
function mano(id, m, n) { return pg.evaluate(([id, m, n]) => { const v = window.prueba.inventario(); v.barra[0] = id ? { id, m, n, d: 0 } : null; Interfaz.juego.elegido = 0; }, [id, m, n]); }
const enMano = () => pg.evaluate(() => { const c = window.prueba.inventario().barra[Interfaz.juego.elegido]; return c ? c.id + ':' + c.m + 'x' + c.n : '-'; });
async function mirarA(id) {
  await pg.evaluate((id) => { const J = window.prueba.jugador, e = window.prueba.bichos.lista.find((x) => x.id === id); if (!e) return;
    const dx = e.x - J.x, dy = e.y + e.alto * 0.6 - (J.y + 1.62), dz = e.z - J.z, h = Math.sqrt(dx * dx + dz * dz); J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h); }, id);
  await pg.waitForTimeout(200);
}
async function apuntar(x, y, z) {
  await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador, dx = x + 0.5 - J.x, dy = y + 0.7 - (J.y + 1.62), dz = z + 0.5 - J.z, h = Math.sqrt(dx * dx + dz * dz); J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h); }, [x, y, z]);
  await pg.waitForTimeout(150);
}
const boton = () => pg.evaluate(() => Interfaz.juego.interaccion ? Interfaz.juego.interaccion.texto : null);
async function interactuar(id) { await mirarA(id); const t = await boton(); await pg.evaluate(() => Interfaz.acciones.interactuar()); await pg.waitForTimeout(250); return t; }
const vaca = await pg.evaluate(() => { const J = window.prueba.jugador, e = window.prueba.bichos.crear('cow', J.x, J.y, J.z - 2.5); e.yaw = 0; return e.id; });
const de = () => pg.evaluate((id) => { const e = window.prueba.bichos.lista.find((x) => x.id === id), J = window.prueba.jugador; return e ? { atado: e.atado, d: +Math.hypot(e.x - J.x, e.z - J.z).toFixed(1), x: +e.x.toFixed(1), z: +e.z.toFixed(1) } : null; }, vaca);
const correasEnPiso = () => pg.evaluate(() => window.prueba.tirados().filter((t) => t.c && t.c.id === 420).length);
const P = await pg.evaluate(() => { const J = window.prueba.jugador; return [Math.floor(J.x), Math.floor(J.y), Math.floor(J.z)]; });
// 1. atar
await mano(420, 0, 3);
console.log('vaca con correa: botón "' + await interactuar(vaca) + '" → ' + JSON.stringify(await de()) + ' | mano ' + await enMano());
console.log('botón ahora: "' + await boton() + '"');
await mirarA(vaca);
await pg.evaluate(() => { window.prueba.jugador.pitch += 0.25; });
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${pref}-1-atada.png` });
// 2. alejarse 7: camina hacia el jugador
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(J.x + 7, J.y, J.z); });
await pg.waitForTimeout(300);
console.log('a 7: ' + JSON.stringify(await de()));
await pg.waitForTimeout(3000);
console.log('3 s después: ' + JSON.stringify(await de()));
// 3. el poste: un cerco al lado del jugador, tocarlo
const poste = await pg.evaluate(() => { const J = window.prueba.jugador, x = Math.floor(J.x) + 2, y = Math.floor(J.y), z = Math.floor(J.z); window.Mundo.poner(x, y, z, 85, 0); return [x, y, z]; });
await pg.waitForTimeout(300);
await mano(0);
await apuntar(poste[0], poste[1], poste[2]);
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(300);
console.log('tocar el poste ' + poste + ' → ' + JSON.stringify(await de()));
// alejarse 12: la vaca se queda en el poste
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(J.x - 12, J.y, J.z + 3); });
await pg.waitForTimeout(3000);
console.log('el jugador lejos: ' + JSON.stringify(await de()) + ' | a ' + await pg.evaluate(([x, y, z]) => { const e = window.prueba.bichos.lista[0]; return Math.hypot(e.x - x - 0.5, e.z - z - 0.5).toFixed(1); }, poste) + ' del poste');
await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador; J.ubicar(x - 3.5, J.y, z + 2.5); }, poste);
await apuntar(poste[0], poste[1], poste[2]);
await pg.evaluate(() => { window.prueba.jugador.pitch -= 0.1; });
await pg.waitForTimeout(500);
await pg.screenshot({ path: `${pref}-2-poste.png` });
// 4. tocar el poste otra vez: se desata y la correa queda en el piso
await apuntar(poste[0], poste[1], poste[2]);
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(400);
console.log('tocar el poste otra vez → ' + JSON.stringify(await de()) + ' | correas en el piso ' + await correasEnPiso());
// 5. atarla y teletransportarse lejos: se corta
await mano(420, 0, 2);
const cerca = () => pg.evaluate((id) => { const e = window.prueba.bichos.lista.find((x) => x.id === id), J = window.prueba.jugador; J.ubicar(e.x, J.y, e.z + 2.5); }, vaca);
await cerca(); await pg.waitForTimeout(200);
console.log('otra vez: "' + await interactuar(vaca) + '" → ' + JSON.stringify(await de()));
console.log('guardado: ' + JSON.stringify(await pg.evaluate(() => window.prueba.bichos.paraGuardar().map((r) => r[6]))));
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(J.x + 20, J.y, J.z); });
await pg.waitForTimeout(600);
console.log('a 20 → ' + JSON.stringify(await de()) + ' | correas en el piso ' + await correasEnPiso());
// 6. romper el poste con una vaca atada: se suelta
await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador, e = window.prueba.bichos.lista[0]; e.x = e.px = x - 2.5; e.z = e.pz = z - 2; J.ubicar(x - 2.5, J.y, z + 0.5); }, poste);
await pg.waitForTimeout(400);
await mano(420, 0, 2);
await interactuar(vaca);
await apuntar(poste[0], poste[1], poste[2]);
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(300);
const antes = JSON.stringify(await de());
await pg.evaluate(([x, y, z]) => window.Mundo.poner(x, y, z, 0, 0), poste);
await pg.waitForTimeout(400);
console.log('atada al poste ' + antes + ', poste roto → ' + JSON.stringify(await de()) + ' | correas en el piso ' + await correasEnPiso());
console.log("errores de la página: " + errores);
await nav.close();
