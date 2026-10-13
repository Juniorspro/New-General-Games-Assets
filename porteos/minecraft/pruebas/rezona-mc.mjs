// Craftsman en el reproductor de Rezona imitado (iframe con sandbox), como un teléfono: toques de verdad
// por CDP (touchStart/End), densidad 2,625. Juega: crear mundo, mirar, poner, romper, caminar,
// inventario, pausa, salir; recarga la página y verifica que el mundo siga guardado.
import fs from "node:fs";
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, tam = "844x390"] = process.argv.slice(2);
const [W, H] = tam.split("x").map(Number);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: Number(process.env.DSF || 2.625),
  userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36" });
const pg = await ctx.newPage();
const cdp = await ctx.newCDPSession(pg);
const t0 = Date.now();
const log = [];
const L = (s) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}] ${s}`; log.push(l); console.log(l); };
pg.on("console", (m) => { if (!/Failed to load resource/.test(m.text())) L(`[${m.type()}] ${m.text()}`); });
pg.on("pageerror", (e) => L(`[pageerror] ${e.message}`));
let n = 0;
const foto = async (nombre) => { await pg.screenshot({ path: `${pref}-${String(++n).padStart(2, "0")}-${nombre}.png` }); };
const juego = () => pg.frames().find((f) => f !== pg.mainFrame());
const ev = async (js) => { const f = juego(); return f ? f.evaluate(js).catch((e) => "ERR " + e.message) : null; };
const esperar = async (cond, seg = 90) => {
  for (let i = 0; i < seg * 4; i++) { if ((await ev(cond)) === true) return true; await pg.waitForTimeout(250); }
  L("NO SE CUMPLIÓ: " + cond); return false;
};
const toque = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
const offset = async () => { const b = await pg.evaluate(() => { const r = document.querySelector("iframe").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); return b; };
const fis = (o, x, y) => process.env.GIRADO ? [o[0] + o[2] - y, o[1] + x] : [o[0] + x, o[1] + y];
const tocar = async (x, y, ms = 80) => { const o = await offset(); const p0 = toque("touchStart", [fis(o, x, y)]); await pg.waitForTimeout(ms); await Promise.all([p0, toque("touchEnd", [])]); };
const sostener = async (x, y, ms) => { const o = await offset(); await toque("touchStart", [fis(o, x, y)]); await pg.waitForTimeout(ms); await toque("touchEnd", []); };
const arrastrar = async (x0, y0, x1, y1, ms) => {
  const o = await offset(), pasos = Math.max(2, Math.round(ms / 50));
  await toque("touchStart", [fis(o, x0, y0)]);
  for (let k = 1; k <= pasos; k++) { await pg.waitForTimeout(ms / pasos); await toque("touchMove", [fis(o, x0 + (x1 - x0) * k / pasos, y0 + (y1 - y0) * k / pasos)]); }
  await toque("touchEnd", []);
};
const boton = async (accion, i) => {
  const b = await ev(`(() => { const d = Interfaz.dpr(); const b = Interfaz.botones.find((b) => b.accion === ${JSON.stringify(accion)} && (${i === undefined} || b.i === ${i} || (b.fila && ${i === undefined ? -1 : i} === 0 && b.fila.k === 'nombre'))); return b ? [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d] : null; })()`);
  if (!b) { L("sin botón " + accion); return false; }
  await tocar(b[0], b[1]);
  await pg.waitForTimeout(400);
  return true;
};

await pg.goto(url);
await pg.waitForTimeout(3000);
await foto("intro");
await esperar("!!(window.prueba && window.prueba.listo && (Interfaz.pantalla === 'titulo' || Interfaz.pantalla === 'idioma'))", 120);
await pg.waitForTimeout(4000);
await foto("idioma");
if ((await ev("Interfaz.pantalla")) === "idioma") {
  const bi = await ev(`(() => { const d = Interfaz.dpr(); const b = Interfaz.botones.find((b) => b.accion === 'elegirIdioma' && b.idioma === 'es'); return [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d]; })()`);
  await tocar(bi[0], bi[1]); await pg.waitForTimeout(500);
}
await foto("elegir-shaders");
if ((await ev("Interfaz.pantalla")) === "shaders") await boton(process.env.SIN ? "shadersNo" : "shadersSi");
await foto("titulo");
L("almacenamiento: " + JSON.stringify(await ev("(async () => { try { localStorage.setItem('x', '1'); } catch (e) { return 'sin localStorage: ' + e.message; } return 'ok'; })()")));
await boton("jugar");
await boton("crear");
await foto("crear");
await boton("formFila", 0);
await pg.waitForTimeout(500);
await pg.keyboard.press("Control+A"); await pg.keyboard.type("Casa de Tito"); await pg.keyboard.press("Enter");
await pg.waitForTimeout(400);
await foto("nombre");
await boton("crearYa");
await esperar("Interfaz.pantalla === 'juego'", 180);
await pg.waitForTimeout(3000);
L("en el juego: " + JSON.stringify(await ev("({x: Jugador.x, y: Jugador.y, z: Jugador.z, stats: Render.stats, lienzo: [lienzo.width, lienzo.height], sonido: Sonido.listo()})")));
await foto("juego");
const [w, h] = await ev("[innerWidth, innerHeight]");
// mirar abajo arrastrando a la derecha de la pantalla
await arrastrar(w * 0.7, h * 0.3, w * 0.7, h * 0.3 + 70, 500);
await pg.waitForTimeout(500);
// poner: buscar un punto de la pantalla que apunte a un bloque a 2-5 de distancia (el rayo del juego)
const punto = await ev(`(() => { for (let fy = 0.45; fy < 0.95; fy += 0.05) for (let fx = 0.35; fx < 0.75; fx += 0.05) { const r = window.prueba.rayo(fx, fy); if (r && r.t > 1.8 && r.t < 5 && r.ny === 1) return [fx, fy, r.t]; } return null; })()`);
L("punto para poner: " + JSON.stringify(punto));
const m0 = await ev("JSON.stringify(window.prueba.cuenta)");
await tocar(w * (punto ? punto[0] : 0.55), h * (punto ? punto[1] : 0.6));
await pg.waitForTimeout(1000);
L("poner: " + m0 + " → " + await ev("JSON.stringify(window.prueba.cuenta)"));
await foto("puesto");
// romper (mantener)
await sostener(w * (punto ? punto[0] : 0.55), h * (punto ? punto[1] : 0.6), 1600);
await pg.waitForTimeout(700);
L("romper: " + await ev("JSON.stringify(window.prueba.cuenta)"));
await foto("roto");
// caminar con la cruceta
const cr = await ev("(() => { const E = Interfaz.E(), d = Interfaz.dpr(), c = 26 * E * 0.95, cx = 8 * E, cy = innerHeight * d - 3 * c - 8 * E; return [(cx + c * 1.5) / d, (cy + c * 0.5) / d]; })()");
const p0 = await ev("[Jugador.x, Jugador.z]");
await sostener(cr[0], cr[1], 1500);
L("caminó: " + p0 + " → " + await ev("[Jugador.x, Jugador.z]"));
await foto("caminado");
// volar: doble toque en saltar
const sal = await ev("(() => { const E = Interfaz.E(), d = Interfaz.dpr(), c = 26 * E * 0.95, gc = c * 1.3, m = 8 * E; return [(innerWidth * d - m - gc / 2) / d, (innerHeight * d - m - gc / 2) / d]; })()");
{
  // doble toque sin esperar a que la página atienda cada uno (como un dedo de verdad)
  const o = await offset(), P = fis(o, sal[0], sal[1]), ps = [];
  ps.push(toque("touchStart", [P])); await pg.waitForTimeout(60); ps.push(toque("touchEnd", []));
  await pg.waitForTimeout(100);
  ps.push(toque("touchStart", [P])); await pg.waitForTimeout(60); ps.push(toque("touchEnd", []));
  await Promise.all(ps);
}
await pg.waitForTimeout(500);
L("volando: " + await ev("Jugador.volando") + " " + await ev("JSON.stringify(window.prueba.cuenta)"));
await foto("volando");
// inventario: elegir algo de naturaleza
await boton("inventario");
await boton("tab", 1);
await foto("inventario");
const it = await ev("(() => { const d = Interfaz.dpr(); const b = Interfaz.botones.filter((b) => b.accion === 'item')[20]; return b ? [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d, b.item.id, b.item.m] : null; })()");
if (it) { await tocar(it[0], it[1]); await pg.waitForTimeout(400); }
L("elegido: " + JSON.stringify(await ev("Interfaz.juego.barra[Interfaz.juego.elegido]")) + " (tocado " + JSON.stringify(it) + ")");
await boton("cerrarInv");
await pg.waitForTimeout(800);
await foto("con-item");
// pausa → guardar y salir
await boton("pausa");
await foto("pausa");
await boton("salir");
await esperar("Interfaz.pantalla === 'titulo'", 60);
// recargar todo: el mundo tiene que seguir ahí
await pg.reload();
await esperar("!!(window.prueba && window.prueba.listo && Interfaz.pantalla === 'titulo')", 120);
await pg.waitForTimeout(4500);
L("después de recargar no vuelve a preguntar: " + await ev("Interfaz.pantalla"));
await boton("jugar");
L("mundos guardados después de recargar: " + JSON.stringify(await ev("Interfaz.mundos.map((m) => m.nombre)")) + " pantalla " + await ev("Interfaz.pantalla"));
await foto("mundos");
await boton("abrir", 0);
await esperar("Interfaz.pantalla === 'juego'", 180);
await pg.waitForTimeout(2500);
L("reabierto: " + JSON.stringify(await ev("({x: Jugador.x, y: Jugador.y, z: Jugador.z, volando: Jugador.volando, barra: Interfaz.juego.barra[Interfaz.juego.elegido]})")));
await foto("reabierto");
fs.writeFileSync(`${pref}.log`, log.join("\n"));
await nav.close();
