// La partida entera, de punta a punta: acercarse a cada cinta, que aparezca
// el botón, recogerla, que salga su texto y que el contador avance. Y en un
// teléfono parado: que el menú entre en pantalla y que el joystick mueva.
//
//     node pruebas/cintas.mjs
import { createRequire } from "node:module";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("/opt/node22/lib/node_modules/playwright");
const AQUI = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(AQUI, "dist");
const tipos = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp", ".glb": "model/gltf-binary", ".json": "application/json" };
const srv = http.createServer((q, r) => { const f = path.join(DIST, q.url.split("?")[0].replace(/^\/$/, "/index.html")); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(0);
const url = `http://127.0.0.1:${srv.address().port}/?fijo`;
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
let fallas = 0;
// EL TIEMPO QUE CUENTA ES EL DEL JUEGO. Este navegador dibuja por software y
// tarda un par de segundos por cuadro: esperar "1,5 s de reloj" es esperar un
// cuadro, y la interferencia (que se suaviza en el tiempo del juego) no llega
// a subir. Se espera a que el reloj del juego avance.
const esperarJuego = (pag, seg) => pag.evaluate((s) => window.__bosque.t + s, seg)
  .then((meta) => pag.waitForFunction((m) => window.__bosque.t >= m, meta, { timeout: 600000, polling: 200 }));
const ok = (cond, que) => { console.log((cond ? "  ok   " : "  MAL  ") + que); if (!cond) fallas++; };

// ── 1. las cinco cintas, con teclado ──
{
  const pag = await nav.newPage({ viewport: { width: 640, height: 360 } });
  const errores = [];
  pag.on("pageerror", (e) => errores.push(e.message));
  await pag.addInitScript(() => localStorage.setItem("bosque", JSON.stringify({ calidad: "baja", vhs: true })));
  await pag.goto(url);
  await pag.waitForFunction(() => window.__bosque && !document.getElementById("menu").hidden, null, { timeout: 240000 });
  await pag.evaluate(() => document.getElementById("mJugar").click());
  const cintas = await pag.evaluate(() => window.__bosque.cintas.lista.map((c) => ({ x: c.x, z: c.z, y: c.y })));
  for (let i = 0; i < cintas.length; i++) {
    const c = cintas[i];
    // a 6 m: sin botón, con interferencia
    await pag.evaluate(([x, z]) => window.__bosque.caminante.colocar(x + 6, z, 0), [c.x, c.z]);
    await esperarJuego(pag, 2.5);
    const lejos = await pag.evaluate(() => ({ boton: !document.getElementById("bAccion").hidden, inter: window.__bosque.post.U.uInterferencia.value }));
    ok(!lejos.boton, `cinta ${i + 1}: a 6 m no hay botón`);
    ok(lejos.inter > 0.2, `cinta ${i + 1}: a 6 m la imagen ya falla (interferencia ${lejos.inter.toFixed(2)})`);
    // encima: botón, y E la recoge
    await pag.evaluate(([x, z]) => window.__bosque.caminante.colocar(x + 1.2, z, 0), [c.x, c.z]);
    await esperarJuego(pag, 0.3);
    ok(await pag.evaluate(() => !document.getElementById("bAccion").hidden), `cinta ${i + 1}: a 1,2 m aparece RECOGER CINTA`);
    await pag.keyboard.press("KeyE");
    await pag.waitForFunction((n) => !document.getElementById("aviso").hidden && document.getElementById("avisoTitulo").textContent.startsWith(`CINTA ${n}`), i + 1, { timeout: 600000 });
    const txt = await pag.evaluate(() => ({ t: document.getElementById("avisoTitulo").textContent, n: window.__bosque.cintas.tomadas }));
    ok(txt.n === i + 1 && txt.t.startsWith(`CINTA ${i + 1}`), `cinta ${i + 1}: recogida, dice "${txt.t}"`);
  }
  await pag.waitForFunction(() => document.getElementById("avisoTitulo").textContent === "FIN DE LA CINTA", null, { timeout: 600000 });
  ok(true, "después de la quinta aparece FIN DE LA CINTA");
  ok(errores.length === 0, "sin errores de página" + (errores.length ? ": " + errores[0] : ""));
  await pag.close();
}

// ── 2. un teléfono parado: menú en pantalla y joystick con el dedo ──
{
  const ctx = await nav.newContext({ ...devices["Pixel 7"] });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => localStorage.setItem("bosque", JSON.stringify({ calidad: "baja", vhs: true })));
  await pag.goto(url);
  await pag.waitForFunction(() => window.__bosque && !document.getElementById("menu").hidden, null, { timeout: 240000 });
  const caja = await pag.evaluate(() => { const r = document.getElementById("mJugar").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, w: innerWidth }; });
  ok(caja.bottom <= caja.h && caja.top >= 0, `parado (${caja.w}x${caja.h}): PLAY entra en pantalla`);
  await pag.tap("#mJugar");
  await esperarJuego(pag, 0.2);
  const antes = await pag.evaluate(() => window.__bosque.caminante.pos.z);
  // un dedo en la izquierda, empujando hacia arriba
  const cdp = await ctx.newCDPSession(pag);
  const x0 = 80, y0 = caja.h - 160;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0, id: 1 }] });
  for (let k = 1; k <= 6; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0, y: y0 - k * 9, id: 1 }] });
  await esperarJuego(pag, 1.5);
  const ent = await pag.evaluate(() => ({ ...window.__bosque_entrada, z: window.__bosque.caminante.pos.z, v: window.__bosque.caminante.vel }));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  ok(Math.abs(ent.z - antes) > 0.1 || ent.v > 0.2, `el joystick lo mueve (z ${antes.toFixed(2)} → ${ent.z.toFixed(2)}, vel ${ent.v.toFixed(2)})`);
  // un segundo dedo en la derecha gira la cámara sin soltar el joystick
  const yaw0 = await pag.evaluate(() => window.__bosque.camara.yaw);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0, y: y0 - 50, id: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 - 50, id: 1 }, { x: caja.w - 80, y: 300, id: 2 }] });
  for (let k = 1; k <= 5; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0, y: y0 - 50, id: 1 }, { x: caja.w - 80 - k * 20, y: 300, id: 2 }] });
  await esperarJuego(pag, 0.3);
  const dos = await pag.evaluate(() => ({ yaw: window.__bosque.camara.yaw, f: window.__bosque_entrada?.fuerza }));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  ok(Math.abs(dos.yaw - yaw0) > 0.1, `el segundo dedo gira la cámara (yaw ${yaw0.toFixed(2)} → ${dos.yaw.toFixed(2)})`);
  ok(dos.f > 0.3, `y el joystick sigue apretado mientras tanto (fuerza ${dos.f?.toFixed(2)})`);
  await pag.screenshot({ path: path.join(AQUI, "pruebas", "telefono-parado.png"), timeout: 240000 });
  await ctx.close();
}
console.log(fallas ? `\n${fallas} MAL` : "\ntodo bien");
await nav.close(); srv.close();
process.exit(fallas ? 1 : 0);
