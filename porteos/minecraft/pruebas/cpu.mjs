// el costo de JavaScript por cuadro con la CPU frenada (como un teléfono flojo) y si el trabajador
// duerme cuando no tiene nada que hacer
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, lento = "6"] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
const cdp = await ctx.newCDPSession(pg);
pg.on("pageerror", (e) => console.log("[pageerror] " + e.message));
await pg.goto(url);
for (let i = 0; i < 400; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(250); }
await pg.evaluate("localStorage.setItem('mc12.opciones', JSON.stringify({idioma: 'es', shaders: true}))");
for (const sh of [true, false]) {
  await pg.evaluate(`(() => { const o = JSON.parse(localStorage.getItem('mc12.opciones')); o.shaders = ${sh}; localStorage.setItem('mc12.opciones', JSON.stringify(o)); })()`);
  await pg.reload();
  for (let i = 0; i < 400; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(250); }
  await pg.evaluate("window.prueba.crear({nombre: 'Prueba', semilla: 777})");
  for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'")) break; await pg.waitForTimeout(250); }
  await pg.waitForTimeout(6000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(lento) });
  await pg.waitForTimeout(6000);
  const r = await pg.evaluate("({ms: window.prueba.ms().toFixed(2), fps: Interfaz.juego.fps, stats: Render.stats, shaders: Render.conShaders, bichos: Bichos.cuantos()})");
  console.log("shaders " + sh + " (CPU x" + lento + "): " + JSON.stringify(r));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
}
// el trabajador quieto: cuánta CPU usa en 3 s sin moverse
const m0 = await cdp.send("Performance.enable").then(() => cdp.send("Performance.getMetrics"));
await pg.waitForTimeout(3000);
const m1 = await cdp.send("Performance.getMetrics");
const g = (m, k) => m.metrics.find((x) => x.name === k)?.value;
console.log("página en 3 s quieto: TaskDuration " + (g(m1, "TaskDuration") - g(m0, "TaskDuration")).toFixed(3) + " s, ScriptDuration " + (g(m1, "ScriptDuration") - g(m0, "ScriptDuration")).toFixed(3) + " s");
await nav.close();
