// resolución automática: con una pantalla chica (sobra) tiene que subir hasta el tope; con una grande
// (no da) bajar y quedarse abajo, probando de vez en cuando sin quedarse arriba
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, tam, dpr, seg = "50", shaders = "no"] = process.argv.slice(2);
const [W, H] = tam.split("x").map(Number);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +dpr, isMobile: true, hasTouch: true });
await ctx.addInitScript((s) => { localStorage.setItem("mc12.opciones", JSON.stringify({ idioma: "es", shaders: s === "si", dist: 2, resolucion: 0 })); }, shaders);
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("pageerror " + e.message));
await pg.goto(url);
for (let i = 0; i < 400; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(250); }
await pg.waitForTimeout(4500);
console.log("núcleos", await pg.evaluate("navigator.hardwareConcurrency"), "gpu", await pg.evaluate("GL.gpu"), "floja", await pg.evaluate("GL.floja"));
await pg.evaluate("window.prueba.crear({ nombre: 'auto', semilla: '7', tipo: 'plano', siempreDia: true, bichos: false })");
for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(250); }
const t0 = Date.now();
const linea = [];
while (Date.now() - t0 < +seg * 1000) {
  await pg.waitForTimeout(2000);
  const r = await pg.evaluate("(() => { const l = document.getElementById('lienzo'); return [l.width, l.height, +(l.width / l.clientWidth).toFixed(2), Interfaz.juego.fps, getComputedStyle(l).imageRendering]; })()");
  linea.push(`${((Date.now() - t0) / 1000).toFixed(0)}s ${r[0]}x${r[1]} (x${r[2]}) ${r[3]}fps ${r[4]}`);
}
console.log(linea.join("\n"));
await nav.close();
