const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const { execFileSync } = await import('child_process');
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => { const J = window.prueba.jui, pan = J.arriba(); if (!pan) return; const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; }; const c = rec(pan.raiz); if (c) J.apretar(c); }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate(() => window.prueba.crear({ nombre: 'Puentes', modo: 'creativo', tipo: 'infinito', semilla: '31337', bichos: false, dificultad: 2 }));
const enJuego = async () => { for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego' && !window.prueba.cargando()").catch(() => false)) return true; await pg.waitForTimeout(200); } return false; };
await enJuego();
const sem = await pg.evaluate(() => window.prueba.partida().semilla);
const L = JSON.parse(execFileSync('node', ['puentes_donde.js', String(sem)]).toString());
await pg.evaluate(([x, y, z]) => window.prueba.cambiarDimension(1, x, y, z, null), [L[0].b[0], L[0].b[1] + 6, L[0].b[2]]);
await pg.waitForTimeout(1000);
await enJuego();
let n = 0;
for (const p of L) {
  const cx = (p.b[0] + p.b[3]) / 2, cz = (p.b[2] + p.b[5]) / 2, y = p.b[1] + 6;
  // a un costado y arriba, mirando al medio de la pieza
  await pg.evaluate(([cx, y, cz]) => { const J = window.prueba.jugador; J.volando = true; Interfaz.juego.volando = true; J.ubicar(cx + 11, y + 5, cz + 11); }, [cx, y, cz]);
  await pg.waitForTimeout(3500);
  await pg.evaluate(([cx, y, cz]) => { const J = window.prueba.jugador; const dx = cx - J.x, dy = y - 3 - (J.y + 1.62), dz = cz - J.z; J.yaw = Math.atan2(dx, -dz); J.pitch = Math.atan2(-dy, Math.hypot(dx, dz)); }, [cx, y, cz]);
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: `${pref}-${++n}-${p.t}.png` });
  console.log(n + ' ' + p.t + ' ' + p.b + ' cámara dentro de: ' + await pg.evaluate(() => { const J = window.prueba.jugador; return window.Mundo.bloque(Math.floor(J.x), Math.floor(J.y + 1.62), Math.floor(J.z)); }));
}
console.log("errores de la página: " + errores);
await nav.close();
