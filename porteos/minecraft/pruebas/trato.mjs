// tratar con los bichos: ordeñar, esquilar, criar, domesticar y sentar un lobo, ensillar y montar un
// cerdo (con zanahoria con palo) y un caballo (temple, montura, salto)
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Trato', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 1 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
function mano(id, m, n) { return pg.evaluate(([id, m, n]) => { const v = window.prueba.inventario(); v.barra[0] = id ? { id, m, n, d: 0 } : null; Interfaz.juego.elegido = 0; }, [id, m, n]); }
const enMano = () => pg.evaluate(() => { const c = window.prueba.inventario().barra[Interfaz.juego.elegido]; return c ? c.id + ':' + c.m + 'x' + c.n : '-'; });
// un bicho delante, quieto (sin ganas de pasear), y mirarlo
async function bicho(tipo, dist, extra) {
  return pg.evaluate(([tipo, dist, extra]) => {
    const J = window.prueba.jugador, e = window.prueba.bichos.crear(tipo, J.x, J.y, J.z - dist, extra || undefined);
    e.yaw = 0; return e.id;
  }, [tipo, dist, extra]);
}
async function mirarA(id) {
  await pg.evaluate((id) => {
    const J = window.prueba.jugador, e = window.prueba.bichos.lista.find((x) => x.id === id);
    if (!e) return;
    const dx = e.x - J.x, dy = e.y + e.alto * 0.6 - (J.y + 1.62), dz = e.z - J.z, h = Math.sqrt(dx * dx + dz * dz);
    J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h);
  }, id);
  await pg.waitForTimeout(200);
}
const boton = () => pg.evaluate(() => Interfaz.juego.interaccion ? Interfaz.juego.interaccion.texto : null);
async function interactuar(id) { await mirarA(id); const t = await boton(); await pg.evaluate(() => Interfaz.acciones.interactuar()); await pg.waitForTimeout(250); return t; }
const de = (id) => pg.evaluate((id) => { const e = window.prueba.bichos.lista.find((x) => x.id === id); return e ? { tipo: e.tipo, vida: e.vida, bebe: e.bebe, amor: e.amor, domado: e.domado, dueno: e.dueno, sentado: e.sentado, esquilada: e.esquilada, ensillado: e.ensillado, grupos: e.grupos.join(','), x: +e.x.toFixed(1), z: +e.z.toFixed(1), temple: e.temple } : null; }, id);
// 1. ordeñar
const vaca = await bicho('cow', 2.5);
await mano(325, 0, 1);
console.log('vaca con balde: botón "' + await interactuar(vaca) + '" → mano ' + await enMano());
await pg.screenshot({ path: `${pref}-1-ordenar.png` });
// 2. esquilar
const oveja = await bicho('sheep', 2.5);
await pg.evaluate((v) => { const l = window.prueba.bichos.lista; const i = l.findIndex((x) => x.id === v); if (i >= 0) l.splice(i, 1); }, vaca);
await mano(359, 0, 1);
await mirarA(oveja);
await pg.screenshot({ path: `${pref}-2-boton.png` });
console.log('oveja con tijeras: botón "' + await interactuar(oveja) + '" → ' + JSON.stringify(await de(oveja)) + ' | tirados ' + JSON.stringify(await pg.evaluate(() => window.prueba.tirados().map((e) => e.c ? e.c.id + ':' + e.c.m + 'x' + e.c.n : 'xp'))));
// 3. criar: dos vacas con trigo
await pg.evaluate((o) => { const l = window.prueba.bichos.lista; const i = l.findIndex((x) => x.id === o); if (i >= 0) l.splice(i, 1); }, oveja);
const v1 = await bicho('cow', 2.5), v2 = await pg.evaluate(() => { const J = window.prueba.jugador, e = window.prueba.bichos.crear('cow', J.x + 1.5, J.y, J.z - 2.5); return e.id; });
await mano(296, 0, 10);
console.log('vaca 1 con trigo: "' + await interactuar(v1) + '"; vaca 2: "' + await interactuar(v2) + '" → ' + JSON.stringify([await de(v1), await de(v2)].map((x) => x && x.amor)) + ' | mano ' + await enMano());
await pg.waitForTimeout(500);
await pg.screenshot({ path: `${pref}-3-enamoradas.png` });
await pg.waitForTimeout(6000);
console.log('crías: ' + JSON.stringify(await pg.evaluate(() => window.prueba.bichos.lista.filter((e) => e.tipo === 'cow').map((e) => e.bebe ? 'bebe' : 'adulta'))) + ' | orbes ' + await pg.evaluate(() => window.prueba.tirados().filter((e) => e.xp !== undefined).length));
await pg.evaluate(() => { window.prueba.bichos.lista.length = 0; });
// 4. domesticar un lobo con huesos, sentarlo y pararlo
const lobo = await bicho('wolf', 2.5);
await mano(352, 0, 20);
let intentos = 0;
for (; intentos < 20; intentos++) { const t = await interactuar(lobo); const d = await de(lobo); if (d && d.domado) break; }
console.log('lobo domado tras ' + (intentos + 1) + ' huesos: ' + JSON.stringify(await de(lobo)));
await mano(0);
console.log('lobo, mano vacía: "' + await interactuar(lobo) + '" → sentado ' + (await de(lobo)).sentado);
// irse lejos: el lobo sigue
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(J.x + 20, J.y, J.z); });
await pg.waitForTimeout(4000);
const dl = await de(lobo), jp = await pg.evaluate(() => [window.prueba.jugador.x, window.prueba.jugador.z]);
console.log('lobo tras alejarse 20: a ' + Math.hypot(dl.x - jp[0], dl.z - jp[1]).toFixed(1) + ' bloques');
await pg.evaluate(() => { window.prueba.bichos.lista.length = 0; });
// 5. el cerdo: montura, montar, zanahoria con palo, bajar
const cerdo = await bicho('pig', 2.5, { grupos: ['minecraft:pig_adult', 'minecraft:pig_unsaddled'] });
await mano(329, 0, 1);
console.log('cerdo con montura: "' + await interactuar(cerdo) + '" → ' + JSON.stringify(await de(cerdo)));
await mano(0);
console.log('cerdo ensillado, mano vacía: "' + await interactuar(cerdo) + '" → montado ' + JSON.stringify(await pg.evaluate(() => window.prueba.montado && window.prueba.montado())));
await mano(398, 0, 1);
const p0 = await de(cerdo);
await pg.evaluate(() => { window.prueba.jugador.yaw = Math.PI / 2; window.prueba.jugador.pitch = 0.2; });
await pg.waitForTimeout(3000);
const p1 = await de(cerdo);
console.log('el cerdo con la zanahoria anduvo ' + Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1) + ' bloques');
await pg.screenshot({ path: `${pref}-4-cerdo.png` });
await pg.evaluate(() => { Interfaz.control.agachar = true; });
await pg.waitForTimeout(300);
await pg.evaluate(() => { Interfaz.control.agachar = false; });
console.log('bajó: ' + JSON.stringify(await pg.evaluate(() => window.prueba.montado && window.prueba.montado())));
await pg.evaluate(() => { window.prueba.bichos.lista.length = 0; });
// 6. el caballo: comida (temple), domarlo, montura, montar y saltar
const cab = await bicho('horse', 3);
await mano(353, 0, 10);
console.log('caballo con azúcar: "' + await interactuar(cab) + '" → temple ' + (await de(cab)).temple);
await pg.evaluate((id) => { const e = window.prueba.bichos.lista.find((x) => x.id === id); e.temple = 100; }, cab);
await mano(0);
console.log('caballo, mano vacía: "' + await interactuar(cab) + '"');
for (let s = 0; s < 12; s++) { await pg.waitForTimeout(500); if ((await de(cab)).domado) break; }
console.log('caballo: ' + JSON.stringify(await de(cab)));
await pg.evaluate(() => { Interfaz.control.agachar = true; });
await pg.waitForTimeout(300);
await pg.evaluate(() => { Interfaz.control.agachar = false; });
await mano(329, 0, 1);
console.log('caballo domado con montura: "' + await interactuar(cab) + '" → ensillado ' + (await de(cab)).ensillado);
await mano(0);
await interactuar(cab);
await pg.evaluate(() => { window.prueba.jugador.yaw = 0; window.prueba.jugador.pitch = 0.1; Interfaz.control.adelante = 1; });
await pg.waitForTimeout(2000);
await pg.evaluate(() => { Interfaz.control.saltar = true; });
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-5-caballo.png` });
await pg.evaluate(() => { Interfaz.control.saltar = false; });
await pg.waitForTimeout(150);
const cy = await pg.evaluate((id) => { const e = window.prueba.bichos.lista.find((x) => x.id === id); return e.y; }, cab);
await pg.waitForTimeout(250);
console.log('caballo saltando: y ' + cy.toFixed(2) + ' | anduvo hasta z ' + (await de(cab)).z);
await pg.evaluate(() => { Interfaz.control.adelante = 0; });
console.log("errores de la página: " + errores);
await nav.close();
