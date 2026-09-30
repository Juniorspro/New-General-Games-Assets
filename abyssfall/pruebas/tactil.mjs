// Toques de verdad (CDP): portada → menú → JUGAR con el dedo; mantener ◀ mueve; tocar la mitad derecha salta.
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800, dpr: 2, tactil: true });
const cdp = await pag.context().newCDPSession(pag);
const pt = (x, y, id = 1) => ({ x, y, id });
const toque = async (x, y) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(x, y)] }); await pag.waitForTimeout(60); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await pag.waitForTimeout(200); };
const esperar = (p) => pag.waitForFunction((p) => PANT === p && (p === "juego" || UI.pantallaFoco === p), p, { timeout: 10000 });
const boton = (n) => pag.evaluate((n) => { const b = UI.items[n], r = lienzo.getBoundingClientRect(); return [(OFX + (b.x + b.w / 2) * PX) / DPR + r.left, ((b.y + b.h / 2) * PX) / DPR + r.top]; }, n);
await pag.waitForTimeout(300);
await toque(180, 500); await esperar("menu"); console.log("portada → menu ✓");
await toque(...(await boton(0))); await esperar("juego"); console.log("JUGAR → juego ✓, audio:", await pag.evaluate(() => AU.ctx && AU.ctx.state));
await pag.waitForFunction(() => AU.msHorneo != null, null, { timeout: 30000 }); await pag.waitForTimeout(300);
const x0 = await pag.evaluate(() => J.jug.x);
// pulgar izquierdo en ◀ (primer cuarto, abajo), 700 ms
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(40, 700)] });
await pag.waitForTimeout(700);
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
const x1 = await pag.evaluate(() => J.jug.x);
console.log(`◀: se movió ${Math.round(x1 - x0)} px`, x1 < x0 - 10 ? "✓" : "✗");
// ▶ y salto a la vez (dos dedos), parado en el piso
await pag.waitForFunction(() => J.jug.suelo, null, { timeout: 10000 });
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(130, 700, 1), pt(300, 700, 2)] });
await pag.waitForTimeout(120);
const s = await pag.evaluate(() => ({ vy: J.jug.vy, suelo: J.jug.suelo, x: J.jug.x }));
await pag.waitForTimeout(400);
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
const x2 = await pag.evaluate(() => J.jug.x);
console.log(`▶+salto: vy=${Math.round(s.vy)} (negativo = saltó) y avanzó ${Math.round(x2 - x1)} px`, s.vy < 0 && x2 > x1 ? "✓" : "✗");
await pag.screenshot({ path: salida("t-juego.png") });
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].join("\n") : "sin errores");
await nav.close();
