// usar objetos sobre el mundo: baldes, azada + semillas + polvo de hueso + cosechar, retoño → árbol,
// hojas que se caen, encendedor y fuego, TNT, cama (dormir), armadura, botella, crecer al azar
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Usar', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 0 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const cx = 873 / 2, cy = 393 / 2;
// mirar a un bloque (x, y, z) desde los ojos y tocar el medio de la pantalla
async function apuntar(x, y, z) {
  await pg.evaluate(([x, y, z]) => {
    const J = window.prueba.jugador, dx = x + 0.5 - J.x, dy = y + 0.98 - (J.y + 1.62), dz = z + 0.5 - J.z, h = Math.sqrt(dx * dx + dz * dz);
    J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h);
  }, [x, y, z]);
  await pg.waitForTimeout(120);
}
async function tocar(x, y, z) { await apuntar(x, y, z); await pg.touchscreen.tap(cx, cy); await pg.waitForTimeout(250); }
function mano(id, m, n) { return pg.evaluate(([id, m, n]) => { const v = window.prueba.inventario(); v.barra[0] = id ? { id, m, n, d: 0 } : null; Interfaz.juego.elegido = 0; }, [id, m, n]); }
const enMano = () => pg.evaluate(() => { const c = window.prueba.inventario().barra[Interfaz.juego.elegido]; return c ? c.id + ':' + c.m + 'x' + c.n : '-'; });
const bloque = (x, y, z) => pg.evaluate(([x, y, z]) => window.Mundo.bloque(x, y, z) + ':' + window.Mundo.meta(x, y, z), [x, y, z]);
const P = await pg.evaluate(() => { const J = window.prueba.jugador; return [Math.floor(J.x), Math.floor(J.y), Math.floor(J.z)]; });
const [px, py, pz] = P;
const piso = py - 1;
console.log('jugador en ' + P + ' | piso ' + await bloque(px, piso, pz));
// 1. balde de agua: volcar a 2 bloques, levantarlo de nuevo
await mano(325, 8, 1);
await tocar(px, piso, pz - 3);
await pg.waitForTimeout(400);
console.log('balde volcado: arriba ' + await bloque(px, piso + 1, pz - 3) + ' | mano ' + await enMano());
await tocar(px, piso + 1, pz - 3);
console.log('balde levantado: ' + await bloque(px, piso + 1, pz - 3) + ' | mano ' + await enMano());
await pg.waitForTimeout(1500);
// 2. azada, semillas, polvo de hueso y cosechar
await mano(290, 0, 1);
await tocar(px + 2, piso, pz - 2);
console.log('azada: ' + await bloque(px + 2, piso, pz - 2) + ' | mano ' + await enMano());
await mano(295, 0, 5);
await tocar(px + 2, piso, pz - 2);
console.log('semilla: ' + await bloque(px + 2, piso + 1, pz - 2) + ' | mano ' + await enMano());
await mano(351, 15, 10);
for (let i = 0; i < 4; i++) await tocar(px + 2, piso + 1, pz - 2);
console.log('trigo con polvo de hueso: ' + await bloque(px + 2, piso + 1, pz - 2) + ' | mano ' + await enMano());
await pg.screenshot({ path: `${pref}-1-trigo.png` });
// cosechar: mantener el dedo sobre el trigo maduro
const cdp = await ctx.newCDPSession(pg);
async function mantener(ms) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy, id: 1 }] });
  for (let i = 0; i < ms / 100; i++) { await pg.waitForTimeout(100); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + (i % 2) * 0.2, y: cy, id: 1 }] }); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
await mano(0);
await apuntar(px + 2, piso + 1, pz - 2);
await mantener(500);
await pg.waitForTimeout(300);
console.log('cosechado: ' + await bloque(px + 2, piso + 1, pz - 2) + ' | tirados ' + JSON.stringify(await pg.evaluate(() => window.prueba.tirados().map((e) => e.c ? e.c.id + 'x' + e.c.n : 'xp'))));
// 3. crecer al azar: trigo en tierra de cultivo con mucha luz (forzando pasos)
await pg.evaluate(([x, y, z]) => { window.Mundo.poner(x, y, z, 60, 7); window.Mundo.poner(x, y + 1, z, 59, 0); }, [px - 2, piso, pz - 2]);
await pg.waitForTimeout(500);
await pg.evaluate(([x, y, z]) => window.prueba.azar(x, y + 1, z, 400), [px - 2, piso, pz - 2]);
await pg.waitForTimeout(800);
console.log('trigo tras 400 pasos al azar: ' + await bloque(px - 2, piso + 1, pz - 2) + ' | tierra ' + await bloque(px - 2, piso, pz - 2));
// tierra de cultivo seca y sin nada: vuelve a tierra
await pg.evaluate(([x, y, z]) => { window.Mundo.poner(x, y, z, 60, 0); }, [px - 4, piso, pz - 4]);
await pg.waitForTimeout(400);
await pg.evaluate(([x, y, z]) => window.prueba.azar(x, y, z, 3), [px - 4, piso, pz - 4]);
await pg.waitForTimeout(600);
console.log('tierra de cultivo seca: ' + await bloque(px - 4, piso, pz - 4));
// 4. retoño + polvo de hueso → árbol; romper el tronco → las hojas se caen
const ax = px - 3, az = pz + 4;
await pg.evaluate(([x, y, z]) => window.Mundo.poner(x, y, z, 6, 0), [ax, piso + 1, az]);
await pg.waitForTimeout(400);
await mano(351, 15, 20);
for (let i = 0; i < 12; i++) { await tocar(ax, piso + 1, az); if ((await bloque(ax, piso + 1, az)).startsWith('17')) break; }
await pg.waitForTimeout(800);
console.log('retoño con polvo de hueso: ' + await bloque(ax, piso + 1, az) + ' ' + await bloque(ax, piso + 3, az) + ' ' + await bloque(ax, piso + 5, az));
await pg.evaluate(([x, z]) => { const J = window.prueba.jugador; J.ubicar(x + 0.5, J.y, z + 6.5); }, [ax, az]);
await pg.waitForTimeout(600);
await apuntar(ax, piso + 3, az);
await pg.screenshot({ path: `${pref}-2-arbol.png` });
const hojas0 = await pg.evaluate(([x, y, z]) => { let n = 0; for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy <= 9; dy++) for (let dz = -3; dz <= 3; dz++) if (window.Mundo.bloque(x + dx, y + dy, z + dz) === 18) n++; return n; }, [ax, piso + 1, az]);
// sacar el tronco entero (como si se rompiera)
await pg.evaluate(([x, y, z]) => { for (let k = 0; k < 12; k++) if (window.Mundo.bloque(x, y + k, z) === 17) window.Mundo.poner(x, y + k, z, 0, 0); }, [ax, piso + 1, az]);
await pg.waitForTimeout(7000);
const hojas1 = await pg.evaluate(([x, y, z]) => { let n = 0; for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy <= 9; dy++) for (let dz = -3; dz <= 3; dz++) if (window.Mundo.bloque(x + dx, y + dy, z + dz) === 18) n++; return n; }, [ax, piso + 1, az]);
console.log('hojas antes ' + hojas0 + ', 7 s después de sacar el tronco ' + hojas1 + ' | tirados ' + await pg.evaluate(() => window.prueba.tirados().length));
await pg.screenshot({ path: `${pref}-3-sin-tronco.png` });
// 5. encendedor: fuego que se apaga solo sobre piedra
await pg.evaluate(([x, z]) => { const J = window.prueba.jugador; J.ubicar(x + 0.5, J.y, z + 0.5); }, [px, pz]);
await pg.evaluate(([x, y, z]) => window.Mundo.poner(x, y, z, 1, 0), [px + 3, piso, pz]);
await pg.waitForTimeout(300);
await mano(259, 0, 1);
await tocar(px + 3, piso, pz);
console.log('fuego: ' + await bloque(px + 3, piso + 1, pz) + ' | mano ' + await enMano() + ' d=' + await pg.evaluate(() => window.prueba.inventario().barra[0].d));
await pg.screenshot({ path: `${pref}-4-fuego.png` });
await pg.waitForTimeout(9000);
console.log('fuego 9 s después: ' + await bloque(px + 3, piso + 1, pz));
// 6. TNT
await pg.evaluate(([x, y, z]) => window.Mundo.poner(x, y, z, 46, 0), [px, piso + 1, pz - 4]);
await pg.waitForTimeout(300);
await tocar(px, piso + 1, pz - 4);
const t0 = await pg.evaluate(() => window.prueba.tnts().length);
await pg.waitForTimeout(1500);
await pg.screenshot({ path: `${pref}-5-tnt.png` });
await pg.waitForTimeout(3500);
const hueco = await pg.evaluate(([x, y, z]) => { let n = 0; for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 1; dy++) for (let dz = -4; dz <= 4; dz++) if (window.Mundo.bloque(x + dx, y + dy, z + dz) === 0) n++; return n; }, [px, piso, pz - 4]);
console.log('TNT prendida: ' + t0 + ' | después: ' + await pg.evaluate(() => window.prueba.tnts().length) + ' | aire en el pozo ' + hueco + ' | vida ' + await pg.evaluate(() => window.prueba.supervivencia().vida));
await pg.screenshot({ path: `${pref}-6-pozo.png` });
// 7. la cama: de día no; de noche duerme y se hace de día
await mano(355, 14, 1);
await tocar(px - 2, piso, pz + 2);
console.log('cama: ' + await bloque(px - 2, piso + 1, pz + 2) + ' y vecinos ' + [await bloque(px - 2, piso + 1, pz + 3), await bloque(px - 3, piso + 1, pz + 2), await bloque(px - 1, piso + 1, pz + 2), await bloque(px - 2, piso + 1, pz + 1)].join(' '));
await tocar(px - 2, piso + 1, pz + 2);
await pg.waitForTimeout(500);
await pg.screenshot({ path: `${pref}-7-de-dia.png` });
await pg.evaluate(() => { const p = window.prueba.partida(); p.siempreDia = false; p.tiempo = 18000; });
await tocar(px - 2, piso + 1, pz + 2);
await pg.waitForTimeout(2500);
console.log('durmiendo: ' + JSON.stringify(await pg.evaluate(() => window.prueba.durmiendo())) + ' pantalla ' + await pg.evaluate(() => window.prueba.pantallas.nombre()));
await pg.screenshot({ path: `${pref}-8-durmiendo.png` });
await pg.waitForTimeout(3500);
console.log('despierto: hora ' + await pg.evaluate(() => Math.floor(window.prueba.partida().tiempo % 24000)) + ' cama ' + JSON.stringify(await pg.evaluate(() => window.prueba.partida().cama)) + ' pantalla ' + await pg.evaluate(() => Interfaz.pantalla));
// 8. armadura y botella
await pg.evaluate(() => { const p = window.prueba.partida(); p.siempreDia = true; });
await mano(307, 0, 1);
await pg.evaluate(() => { window.prueba.jugador.pitch = -1.2; });
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(300);
console.log('armadura: ' + JSON.stringify(await pg.evaluate(() => window.prueba.inventario().armadura.map((c) => c ? c.id : 0))) + ' | mano ' + await enMano());
await pg.evaluate(([x, z]) => { const J = window.prueba.jugador; J.ubicar(x + 0.5, J.y, z + 0.5); }, [px, pz]);
await pg.evaluate(([x, y, z]) => window.Mundo.poner(x, y, z, 9, 0), [px + 1, piso, pz + 3]);
await pg.waitForTimeout(400);
await mano(374, 0, 3);
await tocar(px + 1, piso, pz + 3);
console.log('botella: mano ' + await enMano() + ' | ' + JSON.stringify(await pg.evaluate(() => [].concat(window.prueba.inventario().barra, window.prueba.inventario().mochila).filter(Boolean).map((c) => c.id + ':' + c.m + 'x' + c.n))));
console.log("errores de la página: " + errores);
await nav.close();
