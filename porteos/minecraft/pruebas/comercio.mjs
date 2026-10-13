// comerciar con un aldeano granjero: trigo por esmeralda con la pantalla de la 1.2
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Comercio', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 1 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const id = await pg.evaluate(() => {
  const J = window.prueba.jugador; let e = null;
  for (let k = 0; k < 40; k++) { e = window.prueba.bichos.crear('villager', J.x, J.y, J.z - 2.5); if (!e.bebe) break; window.prueba.bichos.lista.splice(window.prueba.bichos.lista.indexOf(e), 1); }
  // el oficio de granjero (el evento del behavior pack)
  e.grupos = e.grupos.filter((g) => !/farmer|fisherman|shepherd|fletcher|librarian|cartographer|cleric|armorer|weaponsmith|toolsmith|butcher|leatherworker/.test(g));
  window.Conducta.evento(e, 'minecraft:spawn_farmer', null, null);
  e.yaw = 0;
  const v = window.prueba.inventario(); v.barra[0] = null; v.mochila[0] = { id: 296, m: 0, n: 40, d: 0 }; Interfaz.juego.elegido = 0;
  const dx = e.x - J.x, dy = e.y + 1.4 - (J.y + 1.62), dz = e.z - J.z, h = Math.sqrt(dx * dx + dz * dz); J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h);
  return e.id + ' ' + e.c['minecraft:trade_table'].table;
});
console.log('aldeano: ' + id);
await pg.waitForTimeout(400);
console.log('botón: ' + await pg.evaluate(() => Interfaz.juego.interaccion && Interfaz.juego.interaccion.texto));
await pg.evaluate(() => Interfaz.acciones.interactuar());
await pg.waitForTimeout(1200);
console.log('pantalla: ' + await pg.evaluate(() => Interfaz.pantalla + ' / ' + window.prueba.pantallas.nombre()));
await pg.screenshot({ path: `${pref}-1-comercio.png` });
console.log(await pg.evaluate(() => {
  const J = window.prueba.jui, pan = J.arriba(), out = [];
  const rec = (c, d) => { if (d > 9) return; if (/merchant|purchase|grid_slot|cycle|top_item|bottom_item|arrow|result|recipe|trade_item|container_item|left|right/.test(c.n)) out.push('  '.repeat(Math.max(0, d - 3)) + c.n + ' t=' + c.t + ' ver=' + c.ver + ' [' + [c.x, c.y, c.w, c.h].map((v) => Math.round(v)).join(',') + ']' + (c.itemDe ? ' col=' + c.itemDe + ':' + c.indice : '')); for (const h of c.hijos) rec(h, d + 1); };
  rec(pan.raiz, 0);
  return out.slice(0, 60).join('\n');
}));
// tocar los lugares por la colección: el trigo de la mochila (índice 9) al lugar A, después sacar la salida
async function apretarCol(col, i) {
  return pg.evaluate(([col, i]) => {
    const J = window.prueba.jui, pan = J.arriba();
    const rec = (c) => { const q = J.coleccionDe(c); if (c.ver !== false && q && q.col === col && (i === null || q.i === i) && (c.p.button_mappings || []).length) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; };
    const c = rec(pan.raiz); if (!c) return 'sin control ' + col; J.apretar(c); return 'ok';
  }, [col, i]);
}
console.log(await apretarCol('combined_hotbar_and_inventory_items', 9));
console.log(await apretarCol('trade_ingredient1_items', null));
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${pref}-2-puesto.png` });
console.log(await apretarCol('trade_result_item', null));
await pg.waitForTimeout(300);
console.log('en la mano: ' + await pg.evaluate(() => JSON.stringify(window.prueba.inventario().mano)));
console.log(await apretarCol('combined_hotbar_and_inventory_items', 0));
await pg.waitForTimeout(300);
console.log('ofertas: ' + await pg.evaluate((n) => { const e = window.prueba.bichos.lista.find((x) => x.id === +n.split(' ')[0]); return e.comercio.nivel + ' nivel, ' + e.comercio.ofertas.length + ' ofertas: ' + e.comercio.ofertas.map((o) => o.pide.map((p) => p.id + 'x' + p.n).join('+') + '→' + o.da.id + 'x' + o.da.n + ' (' + o.usos + ')').join(', '); }, id));
await pg.screenshot({ path: `${pref}-3-comprado.png` });
await pg.evaluate(() => { const J = window.prueba.jui, pan = J.arriba(); const rec = (c) => { const m = c.p.button_mappings || []; if (c.t === 'button' && m.some((b) => b && b.to_button_id === 'button.menu_exit')) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; }; const c = rec(pan.raiz); if (c) J.apretar(c); });
await pg.waitForTimeout(500);
console.log('cerrado: ' + await pg.evaluate(() => Interfaz.pantalla) + ' | inv ' + await pg.evaluate(() => { const v = window.prueba.inventario(); return [].concat(v.barra, v.mochila).filter(Boolean).map((c) => c.id + 'x' + c.n).join(' '); }));
console.log("errores de la página: " + errores);
await nav.close();
