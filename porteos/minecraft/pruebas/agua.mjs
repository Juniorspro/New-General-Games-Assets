// el agua sin shaders y con shaders, de cerca (para ver las rayas)
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, shaders] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 1000, height: 460 }, deviceScaleFactor: 1 });
await ctx.addInitScript((s) => { localStorage.setItem("mc12.opciones", JSON.stringify({ idioma: "es", shaders: s === "si", dist: 6, resolucion: 1 })); }, shaders);
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("pageerror " + e.message));
await pg.goto(url);
for (let i = 0; i < 400; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(250); }
await pg.waitForTimeout(4000);
await pg.evaluate("window.prueba.crear({ nombre: 'agua', semilla: '12345', tipo: 'infinito', siempreDia: true })");
for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(250); }
// arriba del mar, mirando al horizonte
await pg.evaluate("Jugador.volando = true; Jugador.ubicar(0.5, 70, 0.5); Jugador.pitch = 0.25; Jugador.yaw = 0.8");
await pg.waitForTimeout(8000);
await pg.waitForTimeout(6000);
await pg.screenshot({ path: pref + "-agua.png" });
await pg.evaluate("Jugador.pitch = 0.6");
await pg.waitForTimeout(1500);
await pg.screenshot({ path: pref + "-agua2.png" });
await nav.close();
