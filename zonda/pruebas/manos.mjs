// Prueba los controles de ZONDA como los usaría una persona: los menús con el
// dedo y con el teclado, la palanca y el botón de salto a la vez (dos dedos,
// por CDP), el teclado y un mando simulado. Sin errores de consola.
//
//     node zonda/pruebas/manos.mjs [carpeta de capturas]
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
await pag.goto("file://" + path.join(AQUI, "zonda.html"));
await pag.waitForFunction(() => window.__Z && window.__Z.listo, null, { timeout: 20000 });

let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; };
const foto = async (n) => { if (capturas) await pag.screenshot({ path: path.join(capturas, n + ".png") }); };
const visible = (sel) => pag.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0; }, sel);
const esperar = (ms) => pag.waitForTimeout(ms);
const sala = () => pag.evaluate(() => window.__Z.sala());
const anda = (n) => pag.evaluate((n) => window.__Z.anda(n), n);

/* 1. los menús con el dedo (con esperas de verdad: los paneles se animan) */
await esperar(1200);
await foto("m01-titulo");
for (const [boton, capa, volver] of [["#bCapitulos", "#capaCapitulos", "#bCapVolver"], ["#bCartas", "#capaCartas", "#bCarVolver"], ["#bOpciones", "#capaOpciones", "#bOpcVolver"], ["#bCreditos", "#capaCreditos", "#bCredVolver"]]) {
  await pag.tap(boton); await esperar(450);
  ver(await visible(capa), `${boton} abre ${capa}`);
  await foto("m-" + capa.slice(5));
  await pag.tap(volver); await esperar(450);
  ver(await visible("#capaTitulo"), `${volver} vuelve al título`);
}

/* 2. las opciones cambian de verdad al tocarlas */
await pag.tap("#bOpciones"); await esperar(450);
const antes = await pag.evaluate(() => JSON.stringify(window.__Z.Opc));
const botonesOpc = await pag.$$("#listaOpc button");
if (botonesOpc.length) { await botonesOpc[botonesOpc.length - 1].tap(); await esperar(150); }
const despues = await pag.evaluate(() => JSON.stringify(window.__Z.Opc));
ver(antes !== despues, `tocar una opción la cambia (${botonesOpc.length} opciones)`);
if (botonesOpc.length) { await botonesOpc[botonesOpc.length - 1].tap(); await esperar(150); }
await pag.tap("#bOpcVolver"); await esperar(450);

/* 3. el menú con el teclado: flechas y Enter */
await pag.keyboard.press("ArrowDown"); await esperar(80);
const foco = await pag.evaluate(() => { const b = document.querySelector("#capaTitulo .sel"); return b ? b.id : ""; });
ver(foco && foco !== "bJugar", `la flecha baja la selección (${foco})`);
await pag.keyboard.press("ArrowUp"); await esperar(80);
await pag.keyboard.press("Enter"); await esperar(600);
ver(["tarjeta", "dialogo", "jugando"].includes(await pag.evaluate(() => window.__Z.estado())), "Enter en el título empieza a jugar");

/* 4. en una sala: palanca + salto con dos dedos a la vez */
await pag.evaluate(() => window.__Z.empezar(0, 0, { sinDialogos: true }));
for (let i = 0; i < 60 && (await sala()).estado === "entra"; i++) await anda(10);
await esperar(300);
ver(await visible("#zonaPalanca"), "la palanca se ve en el teléfono");
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
ver(s2.y < s1.y - 3, `salto con el segundo dedo sin soltar la palanca (y ${s1.y} → ${s2.y})`);
await foto("m05-dos-dedos");
await toque("touchEnd", []);
await anda(40);

/* 5. teclado en el juego */
const k0 = await sala();
await pag.keyboard.down("ArrowLeft"); await anda(20); await pag.keyboard.up("ArrowLeft");
const k1 = await sala();
ver(k1.x < k0.x - 4, `la flecha izquierda la mueve (${k0.x} → ${k1.x})`);
await pag.keyboard.down("KeyC"); await anda(6);
const k2 = await sala(); await pag.keyboard.up("KeyC");
ver(k2.y < k1.y - 3, `C salta (y ${k1.y} → ${k2.y})`);
await anda(60);

/* 6. un mando simulado: palanca a la derecha y el botón A */
await pag.evaluate(() => {
  const pad = { id: "prueba", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
  window.dispatchEvent(Object.assign(new Event("gamepadconnected"), { gamepad: pad }));
});
const g0 = await sala();
/* el mando se lee en cada cuadro dibujado, así que acá se espera tiempo de verdad */
await pag.evaluate(() => { window.__pad.axes[0] = 1; });
await esperar(350);
const g1 = await sala();
ver(g1.x > g0.x + 4, `la palanca del mando la mueve (${g0.x} → ${g1.x})`);
await pag.evaluate(() => { window.__pad.axes[0] = 0; window.__pad.buttons[0] = { pressed: true, value: 1 }; });
await esperar(90);
const g2 = await sala();
ver(g2.y < g1.y - 3, `el botón A del mando salta (y ${g1.y} → ${g2.y})`);
await pag.evaluate(() => { window.__pad.buttons[0] = { pressed: false, value: 0 }; });
await anda(40);

/* 7. pausa con el dedo y volver */
await pag.tap("#btPausa"); await esperar(400);
ver((await pag.evaluate(() => window.__Z.estado())) === "pausa" && (await visible("#capaPausa")), "el botón de pausa pausa");
await foto("m06-pausa");
await pag.tap("#bSeguir"); await esperar(400);
ver((await pag.evaluate(() => window.__Z.estado())) === "jugando", "Seguir vuelve al juego");

console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores de consola");
console.log(fallas || errores.length ? `${fallas} prueba(s) mal` : "todos los controles andan");
await nav.close();
process.exit(fallas || errores.length ? 1 : 0);
