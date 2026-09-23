// Los controles de LUZ MALA como los usaría una persona: los menús con el dedo
// y con el teclado, la palanca y un botón a la vez (dos dedos, por CDP), cada
// botón de la pantalla, el teclado y un mando simulado. Sin errores de consola.
//     node luz-mala/pruebas/manos.mjs [carpeta de capturas]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/opt/node22/lib/node_modules/playwright");

const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const capturas = process.argv[2];
if (capturas) fs.mkdirSync(capturas, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ ...devices["Pixel 7"], viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
const pag = await ctx.newPage();
const errores = [];
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 200)); });
await pag.goto("file://" + path.join(AQUI, "luz-mala.html"));
await pag.waitForFunction(() => window.__L && window.__L.listo, null, { timeout: 20000 });

let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; };
const foto = async (n) => { if (capturas) await pag.screenshot({ path: path.join(capturas, n + ".png") }); };
const visible = (sel) => pag.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0; }, sel);
const esperar = (ms) => pag.waitForTimeout(ms);
const sala = () => pag.evaluate(() => window.__L.sala());
const anda = (n) => pag.evaluate((n) => window.__L.anda(n), n);

/* los menús son del lienzo: se toca la palabra donde está dibujada */
const menu = () => pag.evaluate(() => window.__L.menu());
const tocarItem = async (id) => { const d = await pag.evaluate((id) => window.__L.donde(id), id); if (!d) return false; await pag.touchscreen.tap(d.x, d.y); await esperar(80); return true; };

/* 1. el idioma con el dedo: un farol */
await esperar(1000); await foto("m00-idioma");
let mm = await menu();
ver(mm && mm.id === "idioma" && mm.items.join() === "es,en,pt", `lo primero son los tres faroles (${mm && mm.items})`);
ver(await tocarItem("en"), "el farol de English se toca");
await esperar(1700);
mm = await menu();
ver(mm && mm.id === "titulo" && (await pag.evaluate(() => window.__L.idioma())) === "en", `tocar el farol elige el idioma y sigue al título (${mm && mm.id})`);
await foto("m01-titulo");

/* 2. los menús con el dedo */
ver(await tocarItem("opciones"), "OPCIONES se toca");
await esperar(400);
ver((await menu())?.id === "opciones", "OPCIONES abre las opciones");
await foto("m-opciones");
const antes = await pag.evaluate(() => JSON.stringify(window.__L.Opc));
await tocarItem("temblor");
ver(antes !== (await pag.evaluate(() => JSON.stringify(window.__L.Opc))), "tocar una opción la cambia");
await tocarItem("temblor");
ver(antes === (await pag.evaluate(() => JSON.stringify(window.__L.Opc))), "tocarla otra vez la deja como estaba");
const i0 = await pag.evaluate(() => window.__L.idioma());
await tocarItem("idioma");
const i1 = await pag.evaluate(() => window.__L.idioma());
ver(i1 !== i0, `tocar el idioma lo cambia en el momento (${i0} → ${i1})`);
await pag.evaluate(() => window.__L.ponerIdioma("es"));
await tocarItem("volver"); await esperar(300);
ver((await menu())?.id === "titulo", "VOLVER vuelve al título");
await tocarItem("creditos"); await esperar(600);
ver((await pag.evaluate(() => window.__L.estado())) === "creditos", "CRÉDITOS abre los créditos");
await foto("m-creditos");
await pag.touchscreen.tap(200, 400); await esperar(300);
ver((await menu())?.id === "titulo", "tocar la pantalla sale de los créditos");

/* 2b. el título con el teclado */
const s0t = (await menu()).sel;
await pag.keyboard.press("ArrowDown"); await esperar(80);
ver((await menu()).sel !== s0t, `la flecha mueve la luciérnaga (${s0t} → ${(await menu()).sel})`);

/* 3. en una sala: palanca + salto con dos dedos */
await pag.evaluate(() => window.__L.empezar("P1", { sinCharlas: true }));
await anda(30); await esperar(300);
ver(await visible("#zonaPalanca") && await visible("#btGolpe") && await visible("#btCurar"), "la palanca y los cuatro botones se ven");
const cdp = await ctx.newCDPSession(pag);
const caja = async (s) => { const b = await (await pag.$(s)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const pz = await caja("#zonaPalanca"), ps = await caja("#btSalto");
const toque = (type, puntos) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: puntos });
const s0 = await sala();
await toque("touchStart", [{ x: pz.x, y: pz.y, id: 1 }]);
for (let d = 8; d <= 48; d += 8) await toque("touchMove", [{ x: pz.x + d, y: pz.y, id: 1 }]);
await anda(20);
const s1 = await sala();
ver(s1.x > s0.x + 4, `la palanca a la derecha la mueve (${s0.x} → ${s1.x})`);
await toque("touchStart", [{ x: pz.x + 48, y: pz.y, id: 1 }, { x: ps.x, y: ps.y, id: 2 }]);
await anda(8);
const s2 = await sala();
ver(s2.y < s1.y - 3, `salta con el segundo dedo sin soltar la palanca (y ${s1.y} → ${s2.y})`);
await foto("m02-dos-dedos");
await toque("touchEnd", []);
await anda(40);

/* 4. cada botón hace lo suyo */
const tocar = async (sel, n) => { const c = await caja(sel); await toque("touchStart", [{ x: c.x, y: c.y, id: 3 }]); await anda(n || 3); await toque("touchEnd", []); await anda(2); };
await tocar("#btGolpe");
ver(await pag.evaluate(() => !!window.__L.J.mundo.p.golpe || window.__L.J.mundo.p.golpeT > 0), "el botón de la espina golpea");
await anda(30);
await pag.evaluate(() => { window.__L.J.mundo.habil.aleteo = 1; window.__L.prog().habil.aleteo = 1; });
const d0 = await sala();
await tocar("#btDash", 4);
const d1 = await sala();
ver(Math.abs(d1.x - d0.x) > 14, `el botón de las alas hace el aleteo (${d0.x} → ${d1.x})`);
await anda(40);
await pag.evaluate(() => { const p = window.__L.J.mundo.p; p.luz = 66; p.vida = 3; });
const c = await caja("#btCurar");
await toque("touchStart", [{ x: c.x, y: c.y, id: 4 }]); await anda(70); await toque("touchEnd", []); await anda(2);
const cu = await sala();
ver(cu.vida === 4 && cu.luz === 33, `mantener curar gasta luz y cura (vida ${cu.vida}, luz ${cu.luz})`);

/* 5. teclado en el juego */
const k0 = await sala();
await pag.keyboard.down("ArrowLeft"); await anda(20); await pag.keyboard.up("ArrowLeft");
const k1 = await sala();
ver(k1.x < k0.x - 4, `la flecha izquierda la mueve (${k0.x} → ${k1.x})`);
await pag.keyboard.down("KeyZ"); await anda(6);
const k2 = await sala(); await pag.keyboard.up("KeyZ");
ver(k2.y < k1.y - 3, `Z salta (y ${k1.y} → ${k2.y})`);
await anda(60);
await pag.keyboard.press("KeyX"); await anda(1);
ver(await pag.evaluate(() => window.__L.J.mundo.p.golpeT > 0), "X golpea");
await anda(30);

/* 6. un mando simulado */
await pag.evaluate(() => {
  const pad = { id: "prueba", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  window.__pad = pad; navigator.getGamepads = () => [pad];
});
const g0 = await sala();
await pag.evaluate(() => { window.__pad.axes[0] = 1; });
await esperar(350);
const g1 = await sala();
ver(g1.x > g0.x + 4, `la palanca del mando la mueve (${g0.x} → ${g1.x})`);
await pag.evaluate(() => { window.__pad.axes[0] = 0; window.__pad.buttons[0] = { pressed: true, value: 1 }; });
await esperar(90);
const g2 = await sala();
ver(g2.y < g1.y - 3, `el botón A del mando salta (y ${g1.y} → ${g2.y})`);
await pag.evaluate(() => { window.__pad.buttons[0] = { pressed: false, value: 0 }; window.__pad.buttons[2] = { pressed: true, value: 1 }; });
await esperar(60);
ver(await pag.evaluate(() => window.__L.J.mundo.p.golpeT > 0), "el botón X del mando golpea");
await pag.evaluate(() => { window.__pad.buttons[2] = { pressed: false, value: 0 }; });
await esperar(100);

/* 7. pausa con el dedo y el mapa desde la pausa */
await pag.tap("#btPausa"); await esperar(400);
ver((await pag.evaluate(() => window.__L.estado())) === "pausa" && (await menu())?.id === "pausa", "el botón de pausa pausa");
await foto("m03-pausa");
await tocarItem("mapa"); await esperar(400);
ver((await pag.evaluate(() => window.__L.estado())) === "mapa", "MAPA desde la pausa");
await foto("m04-mapa");
await pag.mouse.click(200, 200); await esperar(300);
ver((await pag.evaluate(() => window.__L.estado())) === "jugando", "tocar la pantalla cierra el mapa");

console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores de consola");
console.log(fallas || errores.length ? `${fallas} prueba(s) mal` : "todos los controles andan");
await nav.close();
process.exit(fallas || errores.length ? 1 : 0);
