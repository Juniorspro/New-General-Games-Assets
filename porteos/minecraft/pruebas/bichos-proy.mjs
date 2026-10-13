// los que tiran cosas: aparecen delante del jugador (que se puede atacar), se sacan fotos seguidas y
// se cuentan los proyectiles y los paquetes de sonidos cargados
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")); });
pg.on("console", (m) => { if (m.type() === "error" && !/WebSocket/.test(m.text())) console.log("[error] " + m.text()); });
pg.on("requestfailed", (r) => console.log("falló " + r.url().slice(0, 120)));
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
await pg.mouse.click(400, 200);
await pg.evaluate("window.prueba.crear({ nombre: 'Proy', modo: 'creativo', tipo: 'plano', bichos: false, siempreDia: true })");
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(2500);
const GRUPOS = [
  [["skeleton", -4, 0, -9], ["stray", 4, 0, -9], ["snow_golem", -2, 0, -6], ["zombie", 2, 0, -12]],
  [["blaze", -3, 1, -9], ["ghast", 6, 5, -18]],
  [["witch", -3, 0, -8], ["llama", 3, 0, -8], ["wolf", 5, 0, -12]],
  [["shulker", -3, 0, -8], ["evocation_illager", 3, 0, -9]],
  [["creeper", 0, 0, -4]],
  [["snow_golem", -2, 0, -6], ["zombie", 2, 0, -9], ["blaze", 0, 1, -12]],
  [["evocation_illager", 0, 0, -6]],
  [["wither", 0, 0, -14], ["cow", -3, 0, -8], ["pig", 3, 0, -8]],
];
const PASOS = { 7: 10, 8: 40 };
for (let g = 0; g < GRUPOS.length; g++) {
  const r = await pg.evaluate((grupo) => {
    const P = window.prueba, B = P.bichos, J = P.jugador;
    B.limpiar();
    B.conVida = true;
    if (grupo[0][0] === 'evocation_illager' || grupo[0][0] === 'wither') {
      // lejos del pozo del creeper, parado arriba del piso
      J.x += 40;
      const M = window.Mundo, X = Math.floor(J.x), Z = Math.floor(J.z);
      for (let y = 120; y > 0; y--) if (M.bloque(X, y, Z) > 0) { J.y = y + 1; break; }
    }
    J.yaw = 0; J.pitch = 0.15; J.volando = true;
    return grupo.map(([t, dx, dy, dz]) => { const e = B.crear(t, J.x + dx, J.y + dy, J.z + dz); return t + (e ? "" : "(NO)"); }).join(", ");
  }, GRUPOS[g]);
  console.log("grupo " + (g + 1) + ": " + r);
  for (let k = 0; k < (PASOS[g + 1] || 8); k++) {
    await pg.waitForTimeout(700);
    const est = await pg.evaluate(() => {
      const B = window.prueba.bichos;
      const d = B.paraDibujar(0);
      const proy = d.filter((x) => !x.ref && !x.dueno).map((x) => x.modelo);
      const bs = B.todos().map((e) => e.tipo + "[" + (e.vida | 0) + (e.meta ? " " + e.meta.n : "") + (e.quema > 0 ? " fuego" : "") + (e.invulnerable > 0 ? " naciendo" + e.invulnerable : "") + (e.tipo === 'wither' ? " y=" + (e.y - window.prueba.jugador.y).toFixed(1) : "") + "]").join(" ");
      return bs + " | proyectiles: " + (proy.join(",") || "-");
    });
    console.log("   " + est);
    if (k % 2 === 1 || (PASOS[g + 1] && k % 4 === 1)) await pg.screenshot({ path: `${pref}-${g + 1}-${String(k).padStart(2, "0")}.png` });
  }
  console.log("   disparados: " + JSON.stringify(await pg.evaluate(() => window.prueba.bichos.disparados)));
}
const snd = await pg.evaluate(() => (window.Sonido && Sonido.estado) ? Sonido.estado() : null);
console.log("sonidos: " + JSON.stringify(snd));
console.log("errores de la página: " + errores);
await nav.close();
