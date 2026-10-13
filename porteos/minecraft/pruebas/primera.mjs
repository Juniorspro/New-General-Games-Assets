// Minecraft 1.2: la primera vez (idioma, shaders), el título, Jugar con sus pestañas, crear un mundo,
// el juego, el inventario con los huevos, un bicho, ajustes, pausa y salir
import fs from "node:fs";
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, tam = "844x390", idioma = "es", shaders = "si"] = process.argv.slice(2);
const [W, H] = tam.split("x").map(Number);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
const t0 = Date.now();
const log = [];
const L = (s) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}] ${s}`; log.push(l); console.log(l); };
pg.on("console", (m) => { if (!/Failed to load/.test(m.text())) L(`[${m.type()}] ${m.text()}`); });
pg.on("pageerror", (e) => L(`[pageerror] ${e.message}`));
let n = 0;
const foto = async (nombre) => { await pg.screenshot({ path: `${pref}-${String(++n).padStart(2, "0")}-${nombre}.png` }); };
const esperar = async (cond, seg = 60) => { for (let i = 0; i < seg * 4; i++) { if (await pg.evaluate(cond).catch(() => false)) return true; await pg.waitForTimeout(250); } L("NO: " + cond); return false; };
const dedo = (tipo, x, y, id = 7) => pg.evaluate(([tipo, x, y, id]) => { document.body.dispatchEvent(new PointerEvent(tipo, { pointerId: id, clientX: x, clientY: y, pointerType: "touch", bubbles: true, isPrimary: true })); }, [tipo, x, y, id]);
const tocar = async (x, y, ms = 60, id = 7) => { await dedo("pointerdown", x, y, id); await pg.waitForTimeout(ms); await dedo("pointerup", x, y, id); };
const boton = async (accion, extra) => {
  const b = await pg.evaluate(([a, extra]) => {
    const d = Interfaz.dpr();
    const b = Interfaz.botones.find((b) => b.accion === a && (!extra || Object.keys(extra).every((k) => k === 'k' ? (b.fila && b.fila.k === extra.k) : b[k] === extra[k])));
    return b && [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d];
  }, [accion, extra || null]);
  if (!b) { L("sin botón " + accion + " " + JSON.stringify(extra || {})); return false; }
  await tocar(b[0], b[1]); await pg.waitForTimeout(400); return true;
};
await pg.goto(url);
await esperar("window.prueba && window.prueba.listo", 120);
await pg.waitForTimeout(4500);
L("pantalla al empezar: " + await pg.evaluate("Interfaz.pantalla"));
await foto("idioma");
await boton("elegirIdioma", { idioma });
await foto("shaders");
await boton(shaders === "si" ? "shadersSi" : "shadersNo");
await pg.waitForTimeout(800);
await foto("titulo");
await boton("jugar");
await pg.waitForTimeout(800);
await foto("jugar-mundos");
await boton("tabJugar", { i: 1 }); await foto("jugar-amigos");
await boton("tabJugar", { i: 2 }); await pg.waitForTimeout(1500); await foto("jugar-servidores");
await boton("tabJugar", { i: 0 });
await boton("crear");
await foto("crear");
await boton("formFila", { k: "tipo" }); await boton("formFila", { k: "tipo" });
await boton("crearYa");
await esperar("Interfaz.pantalla === 'juego'", 120);
await pg.waitForTimeout(3000);
L("en el juego: " + await pg.evaluate("JSON.stringify({x: Jugador.x, y: Jugador.y, z: Jugador.z, stats: Render.stats, lienzo: [lienzo.width, lienzo.height], sonido: Sonido.listo(), bichos: Bichos.cuantos()})"));
await foto("juego");
// mirar abajo un poco
await dedo("pointerdown", W * 0.6, H * 0.3, 9);
for (let i = 1; i <= 6; i++) { await dedo("pointermove", W * 0.6, H * 0.3 + i * 8, 9); await pg.waitForTimeout(30); }
await dedo("pointerup", W * 0.6, H * 0.3 + 48, 9);
await pg.waitForTimeout(400);
// inventario: la pestaña de objetos (con los huevos)
await boton("inventario");
await boton("tab", { i: 2 });
await foto("inventario-objetos");
const huevo = await pg.evaluate(() => { const d = Interfaz.dpr(); const b = Interfaz.botones.filter((b) => b.accion === 'item' && b.item.id === 383)[0]; return b ? [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d, b.item.m] : null; });
L("huevo: " + JSON.stringify(huevo));
if (huevo) { await tocar(huevo[0], huevo[1]); await pg.waitForTimeout(300); }
await boton("tab", { i: 0 }); await foto("inventario-construccion");
await boton("cerrarInv");
// poner el bicho: tocar un punto que apunte al piso cerca
const punto = await pg.evaluate(`(() => { for (let fy = 0.45; fy < 0.95; fy += 0.05) for (let fx = 0.35; fx < 0.75; fx += 0.05) { const r = window.prueba.rayo(fx, fy); if (r && r.t > 2.5 && r.t < 5 && r.ny === 1) return [fx, fy, r.t]; } return null; })()`);
L("punto: " + JSON.stringify(punto));
if (punto) { await tocar(W * punto[0], H * punto[1]); await pg.waitForTimeout(1500); }
L("bichos después del huevo: " + await pg.evaluate("Bichos.cuantos()"));
await foto("bicho");
// pegarle (tocar el bicho)
if (punto) { for (let k = 0; k < 4; k++) { await tocar(W * punto[0], H * (punto[1] - 0.12)); await pg.waitForTimeout(600); } }
L("bicho tras los golpes: " + await pg.evaluate("JSON.stringify(Bichos.todos().map(e => [e.tipo, e.vida, +e.x.toFixed(1), +e.z.toFixed(1)]))"));
await foto("pegado");
// ajustes desde la pausa
await boton("pausa"); await foto("pausa");
await boton("opcionesJuego"); await foto("ajustes-juego");
for (const i of [1, 2, 3, 4, 5]) { await boton("seccion", { i }); await foto("ajustes-" + i); }
await boton("listoOpciones");
await boton("seguir");
// de noche: que aparezcan monstruos (y se dibujen)
await pg.evaluate("window.prueba.partida().tiempo = 15000; window.prueba.partida().siempreDia = false");
await pg.waitForTimeout(12000);
L("de noche: " + await pg.evaluate("JSON.stringify(Bichos.todos().map(e => e.tipo))"));
await foto("noche");
await boton("pausa");
await boton("salir");
await esperar("Interfaz.pantalla === 'titulo'", 60);
await foto("titulo-final");
fs.writeFileSync(`${pref}.log`, log.join("\n"));
await nav.close();
