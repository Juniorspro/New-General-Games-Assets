// hojas que se caen sin tronco: cuántas quedan con el tiempo
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("pageerror " + e.message));
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => { const J = window.prueba.jui, pan = J.arriba(); if (!pan) return; const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; }; const c = rec(pan.raiz); if (c) J.apretar(c); }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Hojas', modo: 'creativo', tipo: 'plano', bichos: false, siempreDia: true }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(2500);
// un roble en el plano (el retoño crece por el trabajador)
await pg.evaluate(() => { const J = window.prueba.jugador; const x = Math.floor(J.x) + 6, z = Math.floor(J.z) + 6, y = Math.floor(J.y); window.Mundo.poner(x, y, z, 6, 8); });
await pg.waitForTimeout(500);
console.log('retoño: ' + await pg.evaluate(() => { const J = window.prueba.jugador; const x = Math.floor(J.x) + 6, z = Math.floor(J.z) + 6, y = Math.floor(J.y); return [x, y, z, window.Mundo.bloque(x, y, z), window.Mundo.meta(x, y, z), window.Mundo.bloque(x, y - 1, z)].join(','); }));
await pg.evaluate(() => { const J = window.prueba.jugador; const x = Math.floor(J.x) + 6, z = Math.floor(J.z) + 6, y = Math.floor(J.y); window.prueba.render.luzJugador = -5; window.prueba.pedirLuzPrueba = true; });
await pg.evaluate(() => { const J = window.prueba.jugador; const x = Math.floor(J.x) + 6, z = Math.floor(J.z) + 6, y = Math.floor(J.y); window.prueba.azar(x, y, z, 300); });
await pg.waitForTimeout(1500);
console.log('diag azar: ' + JSON.stringify(await pg.evaluate(() => window.prueba.diag)));
const arbol = await pg.evaluate(() => {
  const J = window.prueba.jugador, M = window.Mundo;
  for (let r = 1; r < 40; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = Math.floor(J.x) + dx, z = Math.floor(J.z) + dz;
    for (let y = 30; y > 0; y--) { const b = M.bloque(x, y, z); if (b === 17) { if (M.bloque(x, y + 1, z) === 18 || M.bloque(x, y + 1, z) === 161 || M.bloque(x, y + 1, z) === 17 || M.bloque(x, y + 1, z) === 162) {
      let y0 = y; while (M.bloque(x, y0 - 1, z) === b) y0--; return [x, y0, z, b]; } } }
  }
  return null;
});
console.log('árbol: ' + JSON.stringify(arbol));
const contar = () => pg.evaluate(([x, y, z]) => { let n = 0; for (let dx = -5; dx <= 5; dx++) for (let dy = -1; dy <= 14; dy++) for (let dz = -5; dz <= 5; dz++) { const b = window.Mundo.bloque(x + dx, y + dy, z + dz); if (b === 18 || b === 161) n++; } return n; }, arbol);
console.log('hojas: ' + await contar()); await pg.evaluate(() => window.prueba.pedirDiag()); await pg.waitForTimeout(300); console.log('diag ' + JSON.stringify(await pg.evaluate(() => window.prueba.diag)));
await pg.evaluate(([x, y, z, b]) => { for (let k = 0; k < 20; k++) if (window.Mundo.bloque(x, y + k, z) === b) window.Mundo.poner(x, y + k, z, 0, 0); }, arbol);
for (let s = 0; s < 10; s++) { await pg.waitForTimeout(2000); console.log((s + 1) * 2 + ' s: ' + await contar()); }
// el tronco en el trabajador y en la página
await pg.evaluate(([x, y, z]) => { const p = []; for (let k = -1; k < 10; k++) p.push(x, y + k, z); window.prueba.leerTrabajador(p); }, arbol);
await pg.waitForTimeout(500);
console.log('trabajador: ' + JSON.stringify(await pg.evaluate(() => window.prueba.diag)));
console.log('página: ' + JSON.stringify(await pg.evaluate(([x, y, z]) => { const l = []; for (let k = -1; k < 10; k++) l.push(window.Mundo.bloque(x, y + k, z)); return l; }, arbol)));
// las que quedan: ¿tienen tronco cerca?
console.log(JSON.stringify(await pg.evaluate(([x, y, z]) => { const l = []; for (let dx = -5; dx <= 5; dx++) for (let dy = -1; dy <= 14; dy++) for (let dz = -5; dz <= 5; dz++) { const b = window.Mundo.bloque(x + dx, y + dy, z + dz); if (b === 18 || b === 161) l.push([dx, dy, dz, window.Mundo.meta(x + dx, y + dy, z + dz)]); } return l.slice(0, 12); }, arbol)));
await nav.close();
