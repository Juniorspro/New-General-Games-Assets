// el Nether: armar un marco de obsidiana, prenderlo, entrar, llegar al Nether, mirar y volver
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")); });
pg.on("console", (m) => { if (m.type() === 'error') console.log('consola: ' + m.text()); });
pg.on("response", (r) => { if (r.status() >= 400) console.log('http ' + r.status() + ' ' + r.url()); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => { const J = window.prueba.jui, pan = J.arriba(); if (!pan) return; const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; }; const c = rec(pan.raiz); if (c) J.apretar(c); }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Portal', modo: 'supervivencia', tipo: 'infinito', semilla: '424242', bichos: false, siempreDia: true, dificultad: 1 }));
const enJuego = async () => { for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego' && !window.prueba.cargando()").catch(() => false)) return true; await pg.waitForTimeout(200); } return false; };
await enJuego();
await pg.waitForTimeout(1500);
const cx = 873 / 2, cy = 393 / 2;
function mano(id, m, n) { return pg.evaluate(([id, m, n]) => { const v = window.prueba.inventario(); v.barra[0] = id ? { id, m, n, d: 0 } : null; Interfaz.juego.elegido = 0; }, [id, m, n]); }
async function apuntar(x, y, z, alto) {
  await pg.evaluate(([x, y, z, alto]) => { const J = window.prueba.jugador, dx = x + 0.5 - J.x, dy = y + alto - (J.y + 1.62), dz = z + 0.5 - J.z, h = Math.sqrt(dx * dx + dz * dz); J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, h); }, [x, y, z, alto]);
  await pg.waitForTimeout(150);
}
// 1. el marco: 4 de ancho a lo largo de x, 5 de alto, 3 bloques adelante del jugador, sobre el piso
const P = await pg.evaluate(() => {
  const J = window.prueba.jugador, x0 = Math.floor(J.x) - 1, z = Math.floor(J.z) - 3, M = window.Mundo;
  let y = Math.floor(J.y);
  for (let dx = -1; dx < 5; dx++) for (let dy = 0; dy < 6; dy++) for (let dz = -2; dz <= 2; dz++) M.poner(x0 + dx, y + dy, z + dz, 0, 0);
  for (let dx = -1; dx < 5; dx++) for (let dz = -2; dz <= 2; dz++) M.poner(x0 + dx, y - 1, z + dz, 1, 0);
  for (let k = 0; k < 4; k++) { M.poner(x0 + k, y, z, 49, 0); M.poner(x0 + k, y + 4, z, 49, 0); }
  for (let k = 1; k < 4; k++) { M.poner(x0, y + k, z, 49, 0); M.poner(x0 + 3, y + k, z, 49, 0); }
  return [x0, y, z, J.x, J.z];
});
console.log('marco en ' + P.slice(0, 3));
await pg.waitForTimeout(500);
await mano(259, 0, 1);
await apuntar(P[0] + 1, P[1], P[2], 0.98);
await pg.touchscreen.tap(cx, cy);
await pg.waitForTimeout(500);
const adentro = () => pg.evaluate(([x0, y, z]) => { const r = []; for (let k = 1; k < 3; k++) for (let j = 1; j < 4; j++) r.push(window.Mundo.bloque(x0 + k, y + j, z) + ':' + window.Mundo.meta(x0 + k, y + j, z)); return r.join(' '); }, P);
console.log('adentro del marco: ' + await adentro() + ' | portales anotados ' + JSON.stringify(await pg.evaluate(() => window.prueba.portales())));
await pg.evaluate(() => { window.prueba.jugador.pitch = 0.05; });
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${pref}-1-portal.png` });
// 2. entrar
await pg.evaluate(([x0, y, z]) => { const J = window.prueba.jugador; J.ubicar(x0 + 2, y + 1, z + 0.5); J.yaw = Math.PI; }, P);
await pg.waitForTimeout(2500);
await pg.screenshot({ path: `${pref}-2-entrando.png` });
let dim = 0;
for (let i = 0; i < 60; i++) { dim = await pg.evaluate(() => window.prueba.dimension()); if (dim === 1) break; await pg.waitForTimeout(250); }
console.log('dimensión: ' + dim);
await enJuego();
await pg.waitForTimeout(2500);
const N = await pg.evaluate(() => { const J = window.prueba.jugador; return { x: +J.x.toFixed(1), y: +J.y.toFixed(1), z: +J.z.toFixed(1), pies: window.Mundo.bloque(Math.floor(J.x), Math.floor(J.y), Math.floor(J.z)), portales: window.prueba.portales() }; });
console.log('en el Nether: ' + JSON.stringify(N));
await pg.evaluate(() => { const J = window.prueba.jugador; J.pitch = -0.1; });
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-3-nether.png` });
await pg.evaluate(() => { const J = window.prueba.jugador; J.yaw += Math.PI / 2; J.pitch = 0.2; });
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-4-nether2.png` });
await pg.evaluate(() => { const J = window.prueba.jugador; J.yaw += Math.PI; J.pitch = 0.3; });
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-5-nether3.png` });
// 3. salir del portal y volver a entrar: de vuelta al mundo de arriba, al mismo portal
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(J.x, J.y + 6, J.z + 3); J.volando = true; });
await pg.waitForTimeout(1500);
await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador; J.volando = false; J.ubicar(x, y, z); }, [N.x, N.y, N.z]);
for (let i = 0; i < 60; i++) { dim = await pg.evaluate(() => window.prueba.dimension()); if (dim === 0) break; await pg.waitForTimeout(250); }
await enJuego();
await pg.waitForTimeout(1500);
console.log('de vuelta: dimensión ' + dim + ' en ' + JSON.stringify(await pg.evaluate(() => { const J = window.prueba.jugador; return [+J.x.toFixed(1), +J.y.toFixed(1), +J.z.toFixed(1)]; })) + ' (el portal estaba en ' + P.slice(0, 3) + ')');
await pg.screenshot({ path: `${pref}-6-vuelta.png` });
console.log("errores de la página: " + errores);
await nav.close();
