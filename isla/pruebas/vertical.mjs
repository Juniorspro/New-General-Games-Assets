// LA ISLA con el teléfono parado, con toques de verdad (CDP Input.dispatchTouchEvent)
// en un Chromium que se hace pasar por celular:
//   - parado NO se gira (html.vertical) y nada del HUD ni de los dedos se sale de la pantalla;
//   - se camina con la palanca, se mira arrastrando y se salta con el botón;
//   - en los ajustes, "Girar" gira la app 90° y "Vertical" la vuelve a parar (se guarda);
//   - acostado (844×390) sigue como antes, sin html.vertical;
//   - ningún error en la consola.
// En SwiftShader anda a pocos cuadros por segundo: los vuelos de la cámara del menú
// tardan unos 20 s de reloj (en un teléfono, 1,6 s). Las capturas van a salida/.
//     node isla/pruebas/vertical.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.dirname(new URL(import.meta.url).pathname);
const SALIDA = path.join(AQUI, "salida");
fs.mkdirSync(SALIDA, { recursive: true });
const HTML = "file://" + path.resolve(AQUI, "../isla.html");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; return ok; };

async function abrir(w, h, extra) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(e.message));
  pag.on("console", (m) => { if (m.type() === "error") errores.push(m.text().slice(0, 200)); });
  const cdp = await ctx.newCDPSession(pag);
  await pag.goto(HTML + "?idioma=es&" + extra);
  const tocar = async (x, y) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await pag.waitForTimeout(60);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const centro = (sel) => pag.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, sel);
  const clase = () => pag.evaluate(() => document.documentElement.className);
  const fuera = () => pag.evaluate(() => [...document.querySelectorAll("#hud *, #dedos *")]
    .filter((e) => e.offsetParent && getComputedStyle(e).visibility !== "hidden")
    .map((e) => [e.id || e.className, e.getBoundingClientRect()])
    .filter(([, r]) => r.width && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1))
    .map(([n]) => n));
  return { ctx, pag, cdp, errores, tocar, centro, clase, fuera };
}
const jugador = (pag) => pag.evaluate(() => { const j = __isla.J.jugador; return { x: j.p.x, y: j.p.y, z: j.p.z, yaw: j.yaw }; });

for (const [w, h] of [[390, 844], [360, 740], [412, 915]]) {
  const { ctx, pag, cdp, errores, centro, clase, fuera } = await abrir(w, h, "directo");
  await pag.waitForTimeout(12000);
  ver(/vertical/.test(await clase()) && !/girada/.test(await clase()), `${w}×${h}: parado no se gira`);
  // la plata y la armadura más largas que puede haber: que la fila de arriba siga entrando
  await pag.evaluate(() => { document.getElementById("plata").textContent = "$99999"; const a = document.getElementById("armadura"); a.classList.remove("oculto"); a.textContent = "100%"; document.getElementById("hora").textContent = "Día 99 · 23:59"; });
  const f = await fuera();
  ver(!f.length, `${w}×${h}: nada del HUD se sale ${f.join(" ")}`);
  const pisan = await pag.evaluate(() => { const a = document.getElementById("vitales").getBoundingClientRect(), b = document.getElementById("barra").getBoundingClientRect(); return a.bottom > b.top; });
  ver(!pisan, `${w}×${h}: vida y hambre no pisan la barra de objetos`);
  await pag.screenshot({ path: path.join(SALIDA, `juego-${w}x${h}.png`) });
  const a = await jugador(pag);
  const [jx, jy] = await centro("#joy");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: jx, y: jy, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: jx, y: jy - 50, id: 1 }] });
  await pag.waitForTimeout(3000);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const b = await jugador(pag);
  ver(Math.hypot(b.x - a.x, b.z - a.z) > 0.5, `${w}×${h}: la palanca camina (${Math.hypot(b.x - a.x, b.z - a.z).toFixed(2)} m)`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: w / 2, y: h * 0.35, id: 2 }] });
  for (let k = 1; k <= 8; k++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: w / 2 + k * 12, y: h * 0.35, id: 2 }] }); await pag.waitForTimeout(80); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await pag.waitForTimeout(800);
  const c = await jugador(pag);
  ver(Math.abs(c.yaw - b.yaw) > 0.05, `${w}×${h}: arrastrar el dedo mira`);
  const [sx, sy] = await centro("#tSalto");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy, id: 3 }] });
  let alto = c.y;
  for (let k = 0; k < 10; k++) { await pag.waitForTimeout(120); alto = Math.max(alto, (await jugador(pag)).y); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  ver(alto > c.y + 0.3, `${w}×${h}: el botón salta (${(alto - c.y).toFixed(2)} m)`);
  ver(!errores.length, `${w}×${h}: sin errores ${errores.slice(0, 2).join(" | ")}`);
  await ctx.close();
}

// los ajustes: el cartel entra de ancho y "Girar" gira (y "Vertical" vuelve)
{
  const { ctx, pag, errores, tocar, clase } = await abrir(390, 844, "sinintro&limpio");
  await pag.waitForTimeout(9000);
  await pag.screenshot({ path: path.join(SALIDA, "menu-390x844.png") });
  const [ax, ay] = await pag.evaluate(() => { const b = [...document.querySelectorAll("#opciones button")].find((e) => /ajustes/i.test(e.textContent)); const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await tocar(ax, ay);
  await pag.waitForFunction(() => __isla.J.menu.modo === "ajustes" && !__isla.J.menu.vuelo, null, { timeout: 60000 });
  await pag.waitForTimeout(1500);
  await pag.screenshot({ path: path.join(SALIDA, "ajustes-390x844.png") });
  // dónde cae el botón "Girar" del cartel en la pantalla (proyectado desde el lienzo del cartel)
  const punto = (u, v) => pag.evaluate(([u, v]) => {
    const { THREE, J } = __isla, c = J.menu.ajustes, p = new THREE.Vector3((u / c.W - 0.5) * c.cara.geometry.parameters.width, (0.5 - v / c.H) * c.cara.geometry.parameters.height, 0);
    c.cara.localToWorld(p); p.project(J.camara);
    // la cámara ve la app; girada, el punto (x, y) de la app cae en la pantalla en (anchoPantalla − y, x)
    const lz = J.renderer.domElement, x = (p.x + 1) / 2 * lz.clientWidth, y = (1 - p.y) / 2 * lz.clientHeight;
    return document.documentElement.classList.contains("girada") ? [innerWidth - y, x] : [x, y];
  }, [u, v]);
  const borde = await pag.evaluate(() => { const { THREE, J } = __isla, c = J.menu.ajustes, m = c.cara.geometry.parameters; return [-1, 1].map((s) => { const p = new THREE.Vector3(s * (m.width / 2 + 0.13), 0, 0); c.cara.localToWorld(p); p.project(J.camara); return (p.x + 1) / 2 * innerWidth; }); });
  ver(borde[0] > 0 && borde[1] < 390, `el cartel de ajustes entra de ancho (${borde.map(Math.round).join("…")})`);
  const yGirar = 58 + 7 * 34 + 13;
  await tocar(...(await punto(170 + 93 + 44, yGirar)));
  await pag.waitForTimeout(4000);
  ver(/girada/.test(await clase()) && (await pag.evaluate(() => __isla.J.ajustes.girar)) === 1, "\"Girar\" gira la app");
  await pag.screenshot({ path: path.join(SALIDA, "ajustes-girada.png") });
  const guardado = await pag.evaluate(() => JSON.parse(localStorage.getItem("isla_ajustes")).girar);
  ver(guardado === 1, "\"Girar\" queda guardado");
  // girada, los toques llegan al sistema girado: el mismo botón ahora es "Vertical"
  const [vx, vy] = await punto(170 + 44, yGirar);
  await tocar(vx, vy);
  await pag.waitForTimeout(4000);
  ver(/vertical/.test(await clase()) && !/girada/.test(await clase()), "\"Vertical\" la vuelve a parar");
  ver(!errores.length, `ajustes sin errores ${errores.slice(0, 2).join(" | ")}`);
  await ctx.close();
}

// acostado sigue como antes
{
  const { ctx, pag, errores, clase, fuera } = await abrir(844, 390, "directo");
  await pag.waitForTimeout(12000);
  ver(!/vertical|girada/.test(await clase()), "acostado: ni vertical ni girada");
  const f = await fuera();
  ver(!f.length, `acostado: nada se sale ${f.join(" ")}`);
  await pag.screenshot({ path: path.join(SALIDA, "juego-844x390.png") });
  ver(!errores.length, `acostado sin errores ${errores.slice(0, 2).join(" | ")}`);
  await ctx.close();
}
await nav.close();
console.log(fallas ? `\n${fallas} cosas mal` : "\nTodo bien parado");
process.exit(fallas ? 1 : 0);
