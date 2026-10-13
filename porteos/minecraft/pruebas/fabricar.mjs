// fabricar en supervivencia con el libro de recetas de la 1.2, la mesa, el horno y los cofres
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Fab', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 0 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1200);
const inv = () => pg.evaluate(() => { const v = window.prueba.inventario(); return [].concat(v.barra, v.mochila).filter(Boolean).map((c) => c.id + ':' + c.m + 'x' + c.n).join(' ') + (v.mano ? ' | mano ' + v.mano.id + ':' + v.mano.m + 'x' + v.mano.n : '') + (v.fabricar.some(Boolean) ? ' | grilla ' + v.fabricar.map((c) => c ? c.id + 'x' + c.n : '-').join(',') : ''); });
// apretar el botón de una colección en la pantalla de arriba (aunque no se vea por el desplazamiento)
async function apretar(col, i, boton) {
  return pg.evaluate(([col, i, boton]) => {
    const J = window.prueba.jui, pan = J.arriba(); let r = null;
    const rec = (c) => { if (r) return; if (c.t === 'button') { const q = J.coleccionDe(c); if (q && q.col === col && q.i === i) r = c; } c.hijos.forEach(rec); };
    rec(pan.raiz);
    // (las pestañas que no se ven no tienen sus botones armados: un control de mentira con su lugar)
    if (!r) r = { itemDe: col, indice: i, padre: null, hijos: [], p: {} };
    if (boton) { pan.ctrl.boton(boton, r); J.sucio(); return 'ok'; }
    J.apretar(r); return 'ok';
  }, [col, i, boton || null]);
}
async function buscar(col, idAux) {
  return pg.evaluate(([col, idAux]) => {
    const pan = window.prueba.jui.arriba(), n = pan.ctrl.longitud(col) || 0;
    for (let i = 0; i < n; i++) if (pan.ctrl.coleccion(col, i, '#item_id_aux') === idAux) return i;
    return -1;
  }, [col, idAux]);
}
// en qué pestaña del libro está algo: [colección, lugar]
async function enLibro(idAux) {
  for (const col of ['recipe_construction', 'recipe_equipment', 'recipe_items', 'recipe_nature']) { const i = await buscar(col, idAux); if (i >= 0) return [col, i]; }
  return [null, -1];
}
const ID = (id, m) => id * 65536 + (m || 0);
// 1. tres troncos → tablas con el libro (2x2)
await pg.evaluate(() => { const v = window.prueba.inventario(); v.mochila[0] = { id: 17, m: 0, n: 3, d: 0 }; });
await pg.evaluate(() => Interfaz.acciones.inventario());
await pg.waitForTimeout(700);
let i5 = await buscar('recipe_construction', ID(5, 0));
console.log('tablas en el libro: ' + i5 + ' (veces ' + await pg.evaluate((i) => window.prueba.jui.arriba().ctrl.coleccion('recipe_construction', i, '#recipe_craftable_count'), i5) + ', apagada ' + await pg.evaluate((i) => window.prueba.jui.arriba().ctrl.coleccion('recipe_construction', i, '#inactive_item'), i5) + ')');
console.log('mesa en el libro (2x2): ' + await buscar('recipe_construction', ID(58)) + ' apagada ' + await pg.evaluate(async () => { const pan = window.prueba.jui.arriba(), n = pan.ctrl.longitud('recipe_construction'); for (let i = 0; i < n; i++) if (pan.ctrl.coleccion('recipe_construction', i, '#item_id_aux') === 58 * 65536) return pan.ctrl.coleccion('recipe_construction', i, '#inactive_item'); return '?'; }));
console.log(await apretar('recipe_construction', i5, 'button.recipe_secondary'));
await pg.waitForTimeout(200);
console.log('grilla llena: ' + await inv());
// la salida: mantener = todas al inventario
console.log(await apretar('crafting_output_items', 0, 'button.crafting_output_secondary'));
await pg.waitForTimeout(200);
console.log('tras fabricar todas: ' + await inv());
await pg.screenshot({ path: `${pref}-1-libro.png` });
// 2. la mesa: 4 tablas
const [cMesa, iMesa] = await enLibro(ID(58));
console.log('mesa en ' + cMesa + ' ' + iMesa);
console.log(await apretar(cMesa, iMesa, 'button.recipe_select'));
console.log(await apretar('crafting_output_items', 0, 'button.crafting_output_primary'));
await pg.waitForTimeout(200);
console.log('mesa en la mano: ' + await inv());
// dejarla en la barra
console.log(await apretar('hotbar_items', 8, 'button.container_take_all_place_all'));
// palos con lo que queda (4 tablas → 2 recetas de palos)
const [cPalo, iPalo] = await enLibro(ID(280));
console.log('palos en el libro: ' + cPalo + ' ' + iPalo);
if (iPalo >= 0) { await apretar(cPalo, iPalo, 'button.recipe_select'); await apretar('crafting_output_items', 0, 'button.crafting_output_secondary'); }
await pg.waitForTimeout(200);
console.log('con palos: ' + await inv());
await pg.evaluate(() => window.prueba.jui.arriba().ctrl.boton('button.menu_exit', null));
await pg.waitForTimeout(400);
// 3. poner la mesa y usarla: pico de madera (3x3)
await pg.evaluate(() => { const J = window.prueba.jugador; J.pitch = 0.9; J.yaw = 0; Interfaz.juego.elegido = 8; });
await pg.waitForTimeout(200);
await pg.touchscreen.tap(873 / 2, 393 / 2);
await pg.waitForTimeout(400);
console.log('bloque puesto: ' + await pg.evaluate(() => { const h = window.prueba.rayo(0.5, 0.5); return h && h.id; }));
await pg.touchscreen.tap(873 / 2, 393 / 2);
await pg.waitForTimeout(700);
console.log('pantalla: ' + await pg.evaluate(() => Interfaz.pantalla + ' / ' + window.prueba.pantallas.nombre()));
await pg.evaluate(() => { const v = window.prueba.inventario(); v.mochila[5] = { id: 5, m: 0, n: 3, d: 0 }; });
const [cPico, iPico] = await enLibro(ID(270));
console.log('pico en el libro de la mesa: ' + cPico + ' ' + iPico);
if (iPico >= 0) { await apretar(cPico, iPico, 'button.recipe_select'); await pg.waitForTimeout(100); console.log('grilla 3x3: ' + await inv()); await apretar('crafting_output_items', 0, 'button.crafting_output_primary'); }
await pg.waitForTimeout(200);
console.log('con pico: ' + await inv());
await pg.screenshot({ path: `${pref}-2-mesa.png` });
await pg.evaluate(() => window.prueba.jui.arriba().ctrl.boton('button.menu_exit', null));
await pg.waitForTimeout(400);
// 4. el horno: mineral de hierro y carbón
await pg.evaluate(() => { const J = window.prueba.jugador, x = Math.floor(J.x) + 2, y = Math.floor(J.y), z = Math.floor(J.z); window.Mundo.poner(x, y, z, 61, 2); J.yaw = Math.PI / 2; J.pitch = 0.45; });
await pg.waitForTimeout(400);
console.log('apunta a: ' + await pg.evaluate(() => { const h = window.prueba.rayo(0.5, 0.5); return h && h.id; }));
await pg.touchscreen.tap(873 / 2, 393 / 2);
await pg.waitForTimeout(700);
console.log('pantalla: ' + await pg.evaluate(() => Interfaz.pantalla + ' / ' + window.prueba.pantallas.nombre()));
await pg.evaluate(() => { const v = window.prueba.inventario(); v.mano = { id: 15, m: 0, n: 2, d: 0 }; });
console.log(await apretar('furnace_ingredient_items', 0, 'button.container_take_all_place_all'));
await pg.evaluate(() => { const v = window.prueba.inventario(); v.mano = { id: 263, m: 0, n: 1, d: 0 }; });
console.log(await apretar('furnace_fuel_items', 0, 'button.container_take_all_place_all'));
await pg.waitForTimeout(3000);
await pg.screenshot({ path: `${pref}-3-horno.png` });
console.log('horno a los 3 s: ' + await pg.evaluate(() => { const l = []; window.Contenedores.mapa.forEach((c) => { if (c.tipo === 'horno') l.push({ q: c.quema, k: c.coccion, e: c.entrada[0] && c.entrada[0].n, s: c.salida[0] && c.salida[0].n, xp: c.xp }); }); return JSON.stringify(l); }) + ' bloque ' + await pg.evaluate(() => { const h = window.prueba.rayo(0.5, 0.5); return h && h.id; }));
await pg.waitForTimeout(18000);
console.log('horno a los 21 s: ' + await pg.evaluate(() => { const l = []; window.Contenedores.mapa.forEach((c) => { if (c.tipo === 'horno') l.push({ q: c.quema, k: c.coccion, e: c.entrada[0] && c.entrada[0].n, s: c.salida[0] && c.salida[0].id + 'x' + c.salida[0].n, xp: +c.xp.toFixed(2) }); }); return JSON.stringify(l); }));
console.log(await apretar('furnace_output_items', 0, 'button.container_take_all_place_all'));
await pg.waitForTimeout(1500);
console.log('lingotes en la mano: ' + await inv() + ' | xp ' + await pg.evaluate(() => window.prueba.supervivencia().totalXp));
await pg.evaluate(() => window.prueba.jui.arriba().ctrl.boton('button.menu_exit', null));
await pg.waitForTimeout(400);
// 5. dos cofres juntos: el grande, y lo guardado queda
await pg.evaluate(() => {
  const J = window.prueba.jugador, x = Math.floor(J.x) - 3, y = Math.floor(J.y), z = Math.floor(J.z);
  window.Mundo.poner(x, y, z, 54, 2); window.Mundo.poner(x, y, z + 1, 54, 2);
  // mirar al centro del primero
  const dx = x + 0.5 - J.x, dy = y + 0.5 - (J.y + 1.62), dz = z + 0.5 - J.z, h = Math.sqrt(dx * dx + dz * dz);
  J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h);
});
await pg.waitForTimeout(400);
await pg.touchscreen.tap(873 / 2, 393 / 2);
await pg.waitForTimeout(700);
console.log('cofre: ' + await pg.evaluate(() => Interfaz.pantalla + ' / ' + window.prueba.pantallas.nombre() + ' lugares ' + window.prueba.jui.arriba().ctrl.longitud('container_items')));
await pg.evaluate(() => { const v = window.prueba.inventario(); v.mano = { id: 264, m: 0, n: 5, d: 0 }; });
console.log(await apretar('container_items', 40, 'button.container_take_all_place_all'));
await pg.screenshot({ path: `${pref}-4-cofre.png` });
await pg.evaluate(() => window.prueba.jui.arriba().ctrl.boton('button.menu_exit', null));
await pg.waitForTimeout(400);
console.log('cofres guardados: ' + await pg.evaluate(() => JSON.stringify(window.Contenedores.guardar().filter((o) => o.t === 'c'))));
console.log("errores de la página: " + errores);
await nav.close();
