// Toques de verdad (CDP): portada → EMPEZAR → ELEGIR → ¡A JUGAR! con el dedo, y el joystick que
// nace donde apoyás. Además capturas en español del menú de subir de nivel y de los cazadores.
import { abrir, salida } from "./comun.mjs";
const { nav, pag, errores } = await abrir({ ancho: 360, alto: 800, dpr: 2, tactil: true });
const cdp = await pag.context().newCDPSession(pag);
const toque = async (x, y) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await pag.waitForTimeout(60); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await pag.waitForTimeout(150); };
// el centro (en px CSS) del botón n de la pantalla de ahora
const boton = (n) => pag.evaluate((n) => { const b = UI.items[n < 0 ? UI.items.length + n : n], r = lienzo.getBoundingClientRect(); return [(OFX + (b.x + b.w / 2) * PX) / DPR + r.left, ((b.y + b.h / 2) * PX) / DPR + r.top]; }, n);
await pag.evaluate(() => { if (IDIOMA !== "es") cambiarIdioma(); });
await toque(180, 400);
console.log("tras tocar la portada:", await pag.evaluate(() => PANT));
await toque(...(await boton(0)));
console.log("tras EMPEZAR:", await pag.evaluate(() => PANT));
await pag.screenshot({ path: salida("es-personajes.png") });
await toque(...(await boton(-1)));
console.log("tras ELEGIR:", await pag.evaluate(() => PANT));
await toque(...(await boton(-1)));
console.log("tras ¡A JUGAR!:", await pag.evaluate(() => PANT + " audio=" + (AU.ctx && AU.ctx.state)));
// el joystick: apoyar, arrastrar a la derecha, mantener
const x0 = await pag.evaluate(() => J.jug.x);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 180, y: 600 }] });
for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 180 + i * 5, y: 600 }] }); await pag.waitForTimeout(40); }
await pag.waitForTimeout(700);
await pag.screenshot({ path: salida("es-joystick.png") });
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
const x1 = await pag.evaluate(() => J.jug.x);
console.log(`joystick: el cazador se movió ${Math.round(x1 - x0)} px a la derecha`, x1 - x0 > 20 ? "✓" : "✗ NO SE MOVIÓ");
await pag.evaluate(() => { J.pendientes = 1; J.rerolls = 2; J.saltos = 1; J.destierros = 1; darArma("varita"); darPasivo("trebol"); abrirModalNivel(); J.modal.ops = [{ k: "cuchillo", tipo: "arma", nivel: 1 }, { k: "latigo", tipo: "arma", nivel: 4 }, { k: "hechizo", tipo: "pasivo", nivel: 1 }, { k: "rayo", tipo: "arma", nivel: 1 }]; });
await pag.waitForTimeout(200);
await pag.screenshot({ path: salida("es-nivel.png") });
// elegir con el dedo la segunda tarjeta
await toque(...(await boton(1)));
console.log("tras tocar la tarjeta:", await pag.evaluate(() => (J.modal ? "sigue abierto" : "cerrado") + " látigo nivel " + J.armas.find((a) => a.k === "latigo").nivel));
console.log(errores.length ? "ERRORES:\n" + [...new Set(errores)].join("\n") : "sin errores");
await nav.close();
