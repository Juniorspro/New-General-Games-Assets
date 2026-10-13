// nitidez: el mismo lugar con pantalla de teléfono (873x393 puntos, 2,75 píxeles por punto) para
// comparar cómo se ven las texturas. Con una resolución fija (la automática en swiftshader baja sola)
// y, en la versión nueva, con distintos filtros del atlas
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, shaders = "si", res = "1", dpr = "2.75", filtros = ""] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: +dpr, isMobile: true, hasTouch: true });
await ctx.addInitScript(([s, r]) => { localStorage.setItem("mc12.opciones", JSON.stringify({ idioma: "es", shaders: s === "si", dist: 6, resolucion: +r })); }, [shaders, res]);
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("pageerror " + e.message));
pg.on("console", (m) => { if (m.type() === "error") console.log("consola: " + m.text()); });
await pg.goto(url);
for (let i = 0; i < 400; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(250); }
await pg.waitForTimeout(4500);
await pg.screenshot({ path: pref + "-0-titulo.png" });
await pg.evaluate("window.prueba.crear({ nombre: 'nitidez', semilla: '12345', tipo: 'infinito', siempreDia: true, bichos: false })");
for (let i = 0; i < 400; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(250); }
await pg.waitForTimeout(3000);
const ap = await pg.evaluate("[Jugador.x, Jugador.y, Jugador.z]");
console.log("aparición", ap);
const fotos = async (n) => {
  // en el suelo donde aparece, mirando un poco abajo: el pasto de cerca y de lejos, los árboles
  await pg.evaluate(`Jugador.volando = true; Jugador.ubicar(${ap[0]}, ${ap[1] + 0.01}, ${ap[2]}); Jugador.pitch = 0.32; Jugador.yaw = 2.2`);
  await pg.waitForTimeout(9000);
  await pg.screenshot({ path: `${pref}-${n}-suelo.png` });
  // arriba del mar mirando al horizonte (el moiré del agua)
  await pg.evaluate("Jugador.ubicar(0.5, 70, 0.5); Jugador.pitch = 0.25; Jugador.yaw = 0.8");
  await pg.waitForTimeout(7000);
  await pg.screenshot({ path: `${pref}-${n}-agua.png` });
};
console.log("lienzo", await pg.evaluate("[document.getElementById('lienzo').width, document.getElementById('lienzo').height, getComputedStyle(document.getElementById('lienzo')).imageRendering]"));
await fotos("a");
for (const f of filtros.split(",").filter(Boolean)) {
  const [min, an] = f.split(":");
  await pg.evaluate(`Render.filtrarAtlas('${min}', ${+an})`);
  await fotos(`f-${min.split("_")[0].toLowerCase()}-${an}`);
}
await nav.close();
