// Minecraft 1.2 con la interfaz JSON (Jui): toca los botones de verdad (por su button id del JSON)
// y recorre la primera vez, el título, Jugar, crear un mundo, el juego, la pausa, los ajustes y salir
import fs from "node:fs";
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, tam = "873x393", dprS = "2.75", idioma = "es", shaders = "no"] = process.argv.slice(2);
const [W, H] = tam.split("x").map(Number);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +dprS, hasTouch: true, isMobile: true });
const pg = await ctx.newPage();
const t0 = Date.now();
const L = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}] ${s}`);
let errores = 0;
pg.on("console", (m) => { if (!/Failed to load|favicon/.test(m.text())) L(`[${m.type()}] ${m.text()}`); });
pg.on("pageerror", (e) => { errores++; L(`[pageerror] ${e.message}\n${e.stack}`); });
let n = 0;
const foto = async (nombre) => { await pg.waitForTimeout(250); await pg.screenshot({ path: `${pref}-${String(++n).padStart(2, "0")}-${nombre}.png` }); };
const esperar = async (cond, seg = 60) => { for (let i = 0; i < seg * 4; i++) { if (await pg.evaluate(cond).catch(() => false)) return true; await pg.waitForTimeout(250); } L("NO: " + cond); return false; };
const dedo = (tipo, x, y, id = 7) => pg.evaluate(([tipo, x, y, id]) => {
  const el = document.elementFromPoint(x, y) || document.body;
  el.dispatchEvent(new PointerEvent(tipo, { pointerId: id, clientX: x, clientY: y, pointerType: "touch", bubbles: true, isPrimary: true }));
}, [tipo, x, y, id]);
const tocar = async (x, y, ms = 60, id = 7) => { await dedo("pointerdown", x, y, id); await pg.waitForTimeout(ms); await dedo("pointerup", x, y, id); };
// el centro (en px CSS) del control visible de la pantalla de arriba que se llama así o que manda ese button id
const donde = (nombre, cual = 0) => pg.evaluate(([nombre, cual]) => {
  const J = window.prueba.jui, pan = J.arriba();
  if (!pan) return null;
  const l = [];
  const rec = (c, vis) => {
    vis = vis && c.ver;
    if (!vis) return;
    const m = Array.isArray(c.p.button_mappings) ? c.p.button_mappings : [];
    if (c.w > 0 && c.h > 0 && (c.n === nombre || m.some((b) => b && b.to_button_id === nombre) || c.p.toggle_name === nombre)) l.push(c);
    c.hijos.forEach((h) => rec(h, vis));
  };
  rec(pan.raiz, true);
  const c = l[cual];
  if (!c) return null;
  const r = document.getElementById("hud").getBoundingClientRect(), d = Interfaz.dpr();
  return [r.left + (c.x + c.w / 2) * J.escala / d, r.top + (c.y + c.h / 2) * J.escala / d, c.n, l.length];
}, [nombre, cual]);
const boton = async (nombre, cual = 0) => {
  const b = await donde(nombre, cual);
  if (!b) { L("NO HAY " + nombre + " en " + await pg.evaluate("window.prueba.pantallas.nombre()")); return false; }
  await tocar(b[0], b[1]); await pg.waitForTimeout(450); return true;
};
const pantalla = () => pg.evaluate("[Interfaz.pantalla, window.prueba.pantallas.nombre(), (window.prueba.jui.arriba()||{}).ref].join(' / ')");

await pg.goto(url);
if (!await esperar("window.prueba && window.prueba.listo", 150)) { await foto("sin-cargar"); process.exit(1); }
await pg.waitForTimeout(3000);
L("al empezar: " + await pantalla());
await foto("idioma");
// el cartel de idioma: izquierda/medio/derecha = English/Español/Português
const lado = { en: "button.porteo_cartel_izq", es: "button.porteo_cartel_medio", pt: "button.porteo_cartel_der" }[idioma];
await boton(lado);
L("tras el idioma: " + await pantalla());
await foto("shaders");
await boton(shaders === "si" ? "button.porteo_cartel_izq" : "button.porteo_cartel_der");
await pg.waitForTimeout(600);
L("título: " + await pantalla());
await foto("titulo");
await boton("button.menu_play");
await pg.waitForTimeout(1200);
L("jugar: " + await pantalla());
await foto("jugar");
await boton("button.menu_local_world_create");
await pg.waitForTimeout(700);
L("crear: " + await pantalla());
await foto("crear");
// pestaña "Juego" de crear: modo creativo (el desplegable) y crear
await boton("button.create_world_button") || await boton("create_world_button");
await pg.waitForTimeout(500);
L("tras crear: " + await pantalla());
await foto("cargando");
await esperar("Interfaz.pantalla === 'juego'", 150);
await pg.waitForTimeout(3000);
L("en el juego: " + await pantalla() + " " + await pg.evaluate("JSON.stringify({x: +window.prueba.jugador.x.toFixed(1), y: +window.prueba.jugador.y.toFixed(1), z: +window.prueba.jugador.z.toFixed(1), lienzo: [lienzo.width, lienzo.height], ms: window.prueba.ms()})"));
await foto("juego");
// la pausa: el botón del HUD viejo (acción "pausa")
const bp = await pg.evaluate(() => { const d = Interfaz.dpr(); const b = Interfaz.botones.find((b) => b.accion === "pausa"); return b && [(b.x + b.w / 2) / d, (b.y + b.h / 2) / d]; });
if (bp) { await tocar(bp[0], bp[1]); await pg.waitForTimeout(600); } else L("NO HAY botón de pausa en el HUD");
L("pausa: " + await pantalla());
await foto("pausa");
await boton("button.menu_settings") || await boton("button.settings");
await pg.waitForTimeout(700);
L("ajustes del mundo: " + await pantalla());
await foto("ajustes-mundo");
await boton("button.menu_cancel") || await pg.evaluate("window.prueba.jui.atras()");
await pg.waitForTimeout(600);
L("volver: " + await pantalla());
await foto("pausa-otra-vez");
await boton("button.menu_quit");
await pg.waitForTimeout(800);
L("salir: " + await pantalla());
await foto("guardando");
await esperar("window.prueba.pantallas.nombre() === 'inicio'", 60);
await pg.waitForTimeout(800);
L("de vuelta: " + await pantalla());
await foto("titulo-de-vuelta");
await boton("button.menu_settings");
await pg.waitForTimeout(700);
L("ajustes: " + await pantalla());
await foto("ajustes");
L("errores de la página: " + errores);
await nav.close();
