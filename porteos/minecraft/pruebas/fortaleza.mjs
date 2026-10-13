// una fortaleza del Nether: ir al trono del generador de blazes, mirar y esperar blazes
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const { execFileSync } = await import('child_process');
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Fortaleza', modo: 'creativo', tipo: 'infinito', semilla: '31337', bichos: true, dificultad: 2 }));
const enJuego = async () => { for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego' && !window.prueba.cargando()").catch(() => false)) return true; await pg.waitForTimeout(200); } return false; };
await enJuego();
const sem = await pg.evaluate(() => window.prueba.partida().semilla);
const F = JSON.parse(execFileSync('node', ['fortaleza_donde.js', String(sem)]).toString());
console.log('semilla ' + sem + ' → ' + JSON.stringify(F));
const cx = (F.b[0] + F.b[3]) / 2, cz = (F.b[2] + F.b[5]) / 2;
// llegar sin portal: ir derecho al lugar (volando, en creativo)
await pg.evaluate(([x, y, z]) => window.prueba.cambiarDimension(1, x, y, z, null), [cx, F.b[1] + 6, cz]);
await pg.waitForTimeout(1000);
await enJuego();
await pg.evaluate(() => { const J = window.prueba.jugador; J.volando = true; Interfaz.juego.volando = true; });
await pg.waitForTimeout(2500);
const info = await pg.evaluate(([b]) => { const M = window.Mundo; let lad = 0, gen = [], cof = [];
  for (let x = b[0]; x <= b[3]; x++) for (let y = b[1]; y <= b[4]; y++) for (let z = b[2]; z <= b[5]; z++) { const id = M.bloque(x, y, z); if (id === 112) lad++; if (id === 52) gen.push([x, y, z, M.meta(x, y, z)]); if (id === 54) cof.push([x, y, z]); }
  return { ladrillos: lad, generadores: gen, cofres: cof, adentro: M.enFortaleza(Math.floor((b[0] + b[3]) / 2), b[1] + 3, Math.floor((b[2] + b[5]) / 2)) }; }, [F.b]);
console.log('en la pieza: ' + JSON.stringify(info));
// mirar desde afuera, alto
await pg.evaluate(([x, y, z, b]) => { const J = window.prueba.jugador; J.ubicar(x + 14, y + 10, z + 14); const dx = x - J.x, dy = y - (J.y + 1.62), dz = z - J.z; J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, Math.hypot(dx, dz)); }, [cx, F.b[1] + 3, cz, F.b]);
await pg.waitForTimeout(2500);
await pg.screenshot({ path: `${pref}-1-afuera.png` });
// adentro (el trono: cerca del generador)
if (info.generadores.length) {
  const g = info.generadores[0];
  // (adentro del trono, del lado de la entrada: a 4 bloques del generador, en el piso)
  await pg.evaluate(([x, y, z]) => { const J = window.prueba.jugador; J.volando = true; Interfaz.juego.volando = true; J.ubicar(x + 4.5, y - 3, z + 0.5); const dx = x + 0.5 - J.x, dy = y + 0.5 - (J.y + 1.62), dz = z + 0.5 - J.z; J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, Math.hypot(dx, dz)); }, g);
  for (let s = 0; s < 16; s++) { await pg.waitForTimeout(5000); const c = await pg.evaluate(() => window.prueba.bichos.lista.filter((e) => e.tipo === 'blaze').length);
    console.log((s + 1) * 5 + ' s: blazes ' + c + ' | generadores ' + JSON.stringify(await pg.evaluate(() => window.prueba.bichos.generadores().map((g) => [g.tipo, g.espera]))) + ' | jugador ' + await pg.evaluate(() => { const J = window.prueba.jugador; return [J.x.toFixed(1), J.y.toFixed(1), J.z.toFixed(1)].join(','); }));
    if (c > 0 && s > 2) break; }
  await pg.screenshot({ path: `${pref}-2-trono.png` });
}
console.log("errores de la página: " + errores);
await nav.close();
