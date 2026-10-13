// todos los bichos de la 1.2 en un mundo plano: aparecen de a grupos delante del jugador, se dejan
// andar un rato y se sacan fotos (y se cuentan los errores de la página)
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, soloStr] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n")); });
pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load|WebSocket/.test(m.text())) console.log("[error] " + m.text()); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
// la primera vez: español y sin shaders (los botones del cartel)
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => {
    const J = window.prueba.jui, pan = J.arriba(); if (!pan) return;
    const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; };
    const c = rec(pan.raiz); if (c) J.apretar(c);
  }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate("window.prueba.crear({ nombre: 'Bichos', modo: 'creativo', tipo: 'plano', bichos: false, siempreDia: true })");
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(2500);
const nombres = await pg.evaluate("window.prueba.bichos.nombres()");
console.log("tipos: " + nombres.length + " " + nombres.join(" "));
const solo = soloStr ? soloStr.split(",") : null;
const lista = solo || nombres;
// de a 5, en fila a 6 bloques adelante del jugador (mirando al norte)
for (let g = 0; g < lista.length; g += 5) {
  const grupo = lista.slice(g, g + 5);
  const r = await pg.evaluate((grupo) => {
    const P = window.prueba, B = P.bichos, J = P.jugador;
    B.todos().slice().forEach((e) => { e.muerte = 0; });
    B.limpiar();
    J.yaw = 0; J.pitch = 0.25; J.volando = true;
    const out = [];
    grupo.forEach((t, i) => {
      const x = J.x - 6 + i * 3, z = J.z - 7;
      const e = B.crear(t, x, J.y + (t === 'ghast' ? 2 : 0), z);
      out.push(t + (e ? "" : " (NO)"));
    });
    return out.join(", ");
  }, grupo);
  console.log("grupo " + (g / 5 + 1) + ": " + r);
  await pg.waitForTimeout(2500);
  const est = await pg.evaluate(() => window.prueba.bichos.todos().map((e) => e.tipo + "[" + (e.vida | 0) + "hp " + (e.meta ? e.meta.n : "-") + (e.escala !== 1 ? " x" + e.escala : "") + "]").join(" "));
  console.log("   " + est);
  await pg.screenshot({ path: `${pref}-${String(g / 5 + 1).padStart(2, "0")}.png` });
}
console.log("errores de la página: " + errores);
await nav.close();
