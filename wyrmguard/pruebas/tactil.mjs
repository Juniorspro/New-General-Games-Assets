// Toques de verdad (CDP, como el dedo en Android): portada → nueva partida → guía → comprar con dos
// toques → ¡a pelear! → mantener la mitad derecha dobla a la derecha, la izquierda a la izquierda → pausa.
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 800, alto: 360, dpr: 2, tactil: true });
const cdp = await pag.context().newCDPSession(pag);
const pt = (x, y, id = 1) => ({ x, y, id });
/** de píxeles del juego a la pantalla (px de CSS) */
const css = (gx, gy) => pag.evaluate(([gx, gy]) => { const r = lienzo.getBoundingClientRect(); return [(OFX + gx * PX) / DPR + r.left, (OFY + gy * PX) / DPR + r.top]; }, [gx, gy]);
const toque = async (gx, gy) => { const [x, y] = await css(gx, gy); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(x, y)] }); await pag.waitForTimeout(70); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await pag.waitForTimeout(220); };
const ok = (c, t) => { console.log(`${c ? "✓" : "✗"} ${t}`); if (!c) process.exitCode = 1; };
await pag.waitForTimeout(400);
const [W, H] = await pag.evaluate(() => [W, H]);
await toque(W / 2, 110); ok(await pag.evaluate(() => PANT === "tienda" && TI.guia), "portada → nueva partida → guía");
ok(await pag.evaluate(() => AU.ctx && AU.ctx.state === "running"), "el sonido arrancó con el toque");
await toque(W / 2, H - 19); ok(await pag.evaluate(() => !TI.guia), "guía: entendido");
const ox = Math.max(0, Math.floor((W - 480) / 2));
const oro0 = await pag.evaluate(() => J.oro);
await toque(ox + 48, 60); ok(await pag.evaluate(() => TI.sel && TI.sel.tipo === "carta" && J.plantel.length === 0), "primer toque: muestra la carta sin comprar");
await toque(ox + 48, 60); ok(await pag.evaluate((o) => J.plantel.length === 1 && J.oro < o, oro0), "segundo toque: compró");
await pag.screenshot({ path: salida("t-tienda.png") });
await toque(ox + 412, H - 20); ok(await pag.evaluate(() => PANT === "arena"), "¡a pelear! → arena");
await pag.waitForTimeout(400);
const giro = async (gx, ms) => { const r0 = await pag.evaluate(() => M.rumbo); const [x, y] = await css(gx, H / 2); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt(x, y)] }); await pag.waitForTimeout(ms); const r1 = await pag.evaluate(() => M.rumbo); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await pag.waitForTimeout(100); return r1 - r0; };
const d1 = await giro(W * 0.8, 500); ok(d1 > 1, `mitad derecha: dobló ${d1.toFixed(2)} rad a la derecha`);
const d2 = await giro(W * 0.2, 500); ok(d2 < -1, `mitad izquierda: dobló ${d2.toFixed(2)} rad a la izquierda`);
await pag.screenshot({ path: salida("t-arena.png") });
await toque(10, 10); ok(await pag.evaluate(() => M.pausa), "botón de pausa");
await toque(W / 2, 80); ok(await pag.evaluate(() => !M.pausa), "seguir");
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].join("\n") : "sin errores");
await nav.close();
