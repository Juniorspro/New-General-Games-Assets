// la supervivencia: el HUD de la 1.2, caídas, lava, ahogarse, hambre, muerte, reaparecer
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 5).join("\n")); });
pg.on("console", (m) => { if (m.type() === "error" && !/WebSocket/.test(m.text())) console.log("[error] " + m.text()); });
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
await pg.evaluate(() => window.prueba.crear({ nombre: 'Sup', modo: 'supervivencia', tipo: 'plano', bichos: false, siempreDia: true, dificultad: 2 }));
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const estado = () => pg.evaluate(() => { const s = window.prueba.supervivencia(); return { vida: s.vida, comida: s.comida, sat: +s.saturacion.toFixed(2), aire: s.aire, nivel: s.nivel, muerto: window.prueba.muerto(), pantalla: Interfaz.pantalla, y: +window.prueba.jugador.y.toFixed(2) }; });
console.log("al entrar: " + JSON.stringify(await estado()));
await pg.screenshot({ path: `${pref}-1-hud.png` });
// el nombre de lo elegido (tocando la barra de la 1.2)
const casilla = await pg.evaluate(() => {
  const J = window.prueba.jui; let r = null;
  const pan = window.prueba.hud || null;
  return null;
});
await pg.touchscreen.tap(873 / 2 + 20, 393 - 12);
await pg.waitForTimeout(300);
console.log("elegido tras tocar la barra: " + await pg.evaluate(() => Interfaz.juego.elegido));
await pg.screenshot({ path: `${pref}-2-nombre.png` });
// la experiencia, el chat y el ícono de guardado
await pg.evaluate(() => { const s = window.prueba.supervivencia(); s.nivel = 0; s.progreso = 0; });
await pg.evaluate(() => { window.prueba.comando('/say hola mundo'); window.prueba.comando('/seed'); });
await pg.evaluate(() => { const s = window.prueba.supervivencia(); s.totalXp = 0; s.nivel = 7; s.progreso = 0.4; Interfaz.sucio(); });
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${pref}-2b-xp-chat.png` });
// caída de 10 bloques: 7 de daño
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(J.x, J.y + 10, J.z); J.vy = 0; });
await pg.waitForTimeout(2500);
console.log("tras caer 10: " + JSON.stringify(await estado()));
await pg.screenshot({ path: `${pref}-3-caida.png` });
// ahogarse: agua alrededor de la cabeza
await pg.evaluate(() => {
  const J = window.prueba.jugador, M = window.prueba.mundo;
  const x = Math.floor(J.x), y = Math.floor(J.y), z = Math.floor(J.z);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 2; dy++) window.Mundo.poner(x + dx, y + dy, z + dz, 9, 0);
});
await pg.waitForTimeout(4000);
console.log("4 s bajo el agua: " + JSON.stringify(await estado()));
await pg.screenshot({ path: `${pref}-4-agua.png` });
await pg.waitForTimeout(13000);
console.log("17 s bajo el agua: " + JSON.stringify(await estado()));
await pg.screenshot({ path: `${pref}-5-ahogado.png` });
// sacar el agua
await pg.evaluate(() => {
  const J = window.prueba.jugador;
  const x = Math.floor(J.x), y = Math.floor(J.y), z = Math.floor(J.z);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 2; dy++) window.Mundo.poner(x + dx, y + dy, z + dz, 0, 0);
});
await pg.waitForTimeout(1500);
// hambre: mucho cansancio
await pg.evaluate(() => { const s = window.prueba.supervivencia(); s.cansancio = 0; s.saturacion = 0; s.comida = 5; });
await pg.waitForTimeout(500);
console.log("con hambre: " + JSON.stringify(await estado()));
await pg.screenshot({ path: `${pref}-6-hambre.png` });
// la lava: hasta morir
await pg.evaluate(() => {
  const J = window.prueba.jugador;
  const x = Math.floor(J.x), y = Math.floor(J.y), z = Math.floor(J.z);
  window.Mundo.poner(x, y, z, 11, 0);
});
for (let i = 0; i < 40; i++) { if (await pg.evaluate(() => window.prueba.muerto())) break; await pg.waitForTimeout(250); }
console.log("en la lava: " + JSON.stringify(await estado()));
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-7-muerte.png` });
console.log("mensaje: " + await pg.evaluate(() => Interfaz.muerte && Interfaz.muerte.texto));
console.log("tirados: " + await pg.evaluate(() => window.prueba.tirados().length));
// sacar la lava del lugar de aparecer y reaparecer
await pg.evaluate(() => {
  const J = window.prueba.jugador;
  const x = Math.floor(J.x), y = Math.floor(J.y), z = Math.floor(J.z);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) { const b = window.Mundo.bloque(x + dx, y + dy, z + dz); if (b === 10 || b === 11) window.Mundo.poner(x + dx, y + dy, z + dz, 0, 0); }
});
await pg.waitForTimeout(500);
await pg.evaluate(() => window.prueba.pantallas && Interfaz.acciones.reaparecer());
await pg.waitForTimeout(2000);
console.log("al reaparecer: " + JSON.stringify(await estado()));
await pg.screenshot({ path: `${pref}-8-reaparecer.png` });
// el vacío en creativo
await pg.evaluate(() => window.prueba.comando('/gamemode c'));
await pg.waitForTimeout(300);
await pg.evaluate(() => { const J = window.prueba.jugador; J.ubicar(J.x, -45, J.z); J.vy = 0; });
for (let i = 0; i < 40; i++) { if (await pg.evaluate(() => window.prueba.muerto())) break; await pg.waitForTimeout(250); }
console.log("vacío en creativo: " + JSON.stringify(await estado()));
console.log("mensaje: " + await pg.evaluate(() => Interfaz.muerte && Interfaz.muerte.texto));
console.log("errores de la página: " + errores);
await nav.close();
