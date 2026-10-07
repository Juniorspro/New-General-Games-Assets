// El zombi bailarín de 2009 (Zombie_Jackson + sus coristas Zombie_dancer), que la GOTY
// reemplazó y que el motor no conocía: el parche le traduce archivo, pistas e imágenes.
// Con la variante de depuración (portear.sh --depuracion), en el 2-8: lanzaguisantes en
// las 5 filas, dos bailarines con el atajo "m", y 90 s mirando que llamen a los coristas
// y que, al perder brazo y cabeza, no aparezca un "Can't find track" en el registro.
//
//   python3 -m http.server 8832 --directory entrega-pvz/pvz-depuracion &
//   node porteos/pvz/bailarin.mjs http://127.0.0.1:8832/
const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs");
const fs = await import("node:fs");
const URL = process.argv[2] || "http://127.0.0.1:8832/";
const SAL = (process.env.CAPTURAS || "/tmp") + "/pvz-bailarin";
fs.mkdirSync(SAL, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const c = await nav.newContext({ viewport: { width: 800, height: 600 } });
const pg = await c.newPage();
const errores = [];
pg.on("pageerror", (e) => errores.push(e.message));
await pg.addInitScript(() => { window.__pvzLog = []; });
await pg.goto(URL);
const est = async () => { try { return JSON.parse(await pg.evaluate(() => Module.UTF8ToString(Module._porteo_estado()))); } catch (_) { return {}; } };
const esperar = async (f, ms) => { const fin = Date.now() + ms; while (Date.now() < fin) { const e = await est(); if (f(e)) return e; await pg.waitForTimeout(250); } return null; };
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? ok++ : mal++; console.log(`  ${c ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };

await esperar((e) => e.pantalla === "titulo" && e.cargado === 1, 90000);
await pg.mouse.click(400, 560);
await esperar((e) => e.pantalla === "menu" && e.dialogos > 0, 20000);
await pg.keyboard.type("Bailarin", { delay: 40 });
await pg.keyboard.press("Enter");
await esperar((e) => e.pantalla === "menu" && e.dialogos === 0, 20000);
await pg.waitForTimeout(2500);
await pg.mouse.click(560, 130);
await esperar((e) => e.pantalla === "tablero" && e.sol === 150 && e.dialogos === 0, 60000);
await pg.waitForTimeout(4000);
await pg.keyboard.press("l");             // atajo: ir a un nivel
await pg.waitForTimeout(1200);
await pg.keyboard.type("2-8", { delay: 60 });
await pg.keyboard.press("Enter");
const elegir = await esperar((e) => e.pantalla === "elegir", 30000);
await pg.waitForTimeout(4000);
await pg.screenshot({ path: `${SAL}/elegir.png` });   // el bailarín aparece en la vista previa de la calle
for (const [x, y] of [[50, 240], [105, 240], [50, 160], [205, 160], [258, 160], [152, 160]]) { await pg.mouse.click(x, y); await pg.waitForTimeout(400); }
await pg.mouse.click(232, 565);
const juego = await esperar((e) => e.pantalla === "tablero" && e.nivel === 18 && e.escena === 3, 30000);
ch("el 2-8 arranca", !!elegir && !!juego);
await pg.waitForTimeout(3000);
await pg.keyboard.press("9");             // atajo: sol
for (let fila = 0; fila < 5; fila++) {
  await pg.mouse.click(240, 40); await pg.waitForTimeout(300);      // sobre del lanzaguisantes
  await pg.mouse.click(80, 130 + fila * 100); await pg.waitForTimeout(7800);  // recarga del sobre
}
ch("un lanzaguisantes por fila", ((await est()).plantas || []).length === 5);
for (let i = 0; i < 2; i++) { await pg.keyboard.press("m"); await pg.waitForTimeout(800); }   // atajo: bailarín
let lider = 0, coristas = 0;
for (let s = 0; s < 90; s++) {
  const z = (await est()).zombis || [];
  lider = Math.max(lider, z.filter((q) => q[0] === 8).length);      // ZOMBIE_DANCER
  coristas = Math.max(coristas, z.filter((q) => q[0] === 9).length); // ZOMBIE_BACKUP_DANCER
  if (s % 10 === 0) await pg.screenshot({ path: `${SAL}/t${String(s).padStart(2, "0")}.png` });
  await pg.waitForTimeout(1000);
}
ch("aparecen los bailarines", lider === 2, `${lider}`);
ch("llaman a sus coristas", coristas >= 4, `hasta ${coristas} a la vez`);
const pistas = await pg.evaluate(() => window.__pvzLog.filter((l) => /Can't find track|assert/i.test(l)));
ch("brazos y cabezas caen sin pistas perdidas ni asserts", pistas.length === 0, pistas.slice(0, 3).join(" | "));
ch("sin errores", errores.length === 0, errores.slice(0, 2).join(" | "));
console.log(`\n${ok} bien, ${mal} mal (capturas en ${SAL})`);
await nav.close();
process.exit(mal ? 1 : 0);
