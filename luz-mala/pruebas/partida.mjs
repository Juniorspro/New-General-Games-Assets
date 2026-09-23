// Una partida de LUZ MALA en Chromium, de punta a punta de lo que importa:
// la intro, hablar, comprar, sentarse en un hongo, bajar de sala, morir y
// recuperar la sombra, la pelea con el Torito (y lo que da), el mapa, la
// pausa y el final. Además repite en el juego de verdad los recorridos que
// encontró el resolvedor (pruebas/recorridos.json), pasando de sala en sala.
//     node luz-mala/pruebas/partida.mjs [carpeta de capturas]
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
pag.on("pageerror", (e) => errores.push("pageerror: " + e.message + " " + (e.stack || "").split("\n")[1]));
pag.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text().slice(0, 200)); });
await pag.goto("file://" + path.join(AQUI, "luz-mala.html") + "?fijo");
await pag.waitForFunction(() => window.__L && window.__L.listo, null, { timeout: 20000 });

let fallas = 0;
const ver = (ok, que) => { console.log((ok ? "ok   " : "MAL  ") + que); if (!ok) fallas++; };
const foto = async (n) => { if (capturas) await pag.screenshot({ path: path.join(capturas, n + ".png") }); };
const anda = (n) => pag.evaluate((n) => window.__L.anda(n), n);
const sala = () => pag.evaluate(() => window.__L.sala());
const estado = () => pag.evaluate(() => window.__L.estado());
const prog = () => pag.evaluate(() => window.__L.prog());
const apretar = async (a, n = 2) => { await pag.evaluate((a) => window.__L.entrada(a, true), a); await anda(n); await pag.evaluate((a) => window.__L.entrada(a, false), a); await anda(1); };
const poner = (x, y) => pag.evaluate(([x, y]) => window.__L.poner(x, y), [x, y]);
const esperar = async (cond, max = 600) => { for (let i = 0; i < max; i += 10) { if (await pag.evaluate(cond)) return true; await anda(10); } return false; };
/* los menús son del lienzo: se toca la palabra donde está dibujada */
const menu = () => pag.evaluate(() => window.__L.menu());
const tocarItem = async (id) => { await pag.waitForTimeout(250); const d = await pag.evaluate((id) => window.__L.donde(id), id); if (!d) return false; await pag.touchscreen.tap(d.x, d.y); await anda(3); return true; };

/* 0. primero, el idioma: tres faroles colgados */
await anda(20);
ver((await menu())?.id === "idioma", "lo primero es elegir el idioma");
await foto("p00-idioma");
await apretar("salto");
await esperar(() => (window.__L.menu() || {}).id === "titulo", 200);
ver((await menu())?.id === "titulo", "después del farol, el título");

/* 1. nueva partida: la intro y el pueblo */
ver(await tocarItem("nueva"), "se puede tocar NUEVA PARTIDA");
ver((await estado()) === "intro", "NUEVA PARTIDA arranca la intro");
await foto("p01-intro");
for (let i = 0; i < 12 && (await estado()) === "intro"; i++) { await apretar("salto"); await apretar("salto"); }
await esperar(() => window.__L.estado() === "jugando", 200);
ver((await sala())?.id === "P1", "después de la intro, el pueblo");
await anda(60); await foto("p02-pueblo");

/* 2. hablar con el mamboretá */
await poner(7 * 8, 22 * 8 - 12); await anda(3);
await apretar("arr");
ver((await estado()) === "dialogo", "arriba al lado del mamboretá abre la charla");
await anda(30); await foto("p03-charla");
for (let i = 0; i < 20 && (await estado()) === "dialogo"; i++) { await apretar("salto"); await anda(4); }
ver((await estado()) === "jugando", "la charla se termina");

/* 3. la tienda de Don Canasto */
await pag.evaluate(() => { window.__L.J.mundo.p.ambar = 60; });
await poner(26 * 8, 22 * 8 - 12); await anda(3);
await apretar("arr");
for (let i = 0; i < 10 && (await estado()) === "dialogo"; i++) { await apretar("salto"); await anda(4); }
ver((await estado()) === "tienda", "Don Canasto abre la tienda");
await pag.waitForTimeout(500); await foto("p04-tienda");
await tocarItem("iman");
const pr = await prog();
ver(pr.compras.iman && (await sala()).ambar === 20, "comprar la pelusa de cardo cobra 40 de ámbar");
await tocarItem("espina");
ver(!(await prog()).compras.espina, "sin ámbar suficiente no se compra");
await tocarItem("chau");
ver((await estado()) === "jugando", "CHAU, DON vuelve al juego");

/* 4. sentarse en el hongo */
await poner(20 * 8 - 4, 22 * 8 - 12); await anda(3);
await apretar("arr");
const pb = await prog();
ver(pb.banco && pb.banco.sala === "P1", "sentarse en el hongo guarda la partida");
await apretar("der", 3);

/* 5. bajar por el pozo a las raíces */
await poner(36 * 8, 20 * 8); await anda(2);
await esperar(() => window.__L.sala().id === "R1", 300);
ver((await sala()).id === "R1", "cayendo por el pozo se llega a las raíces");
await anda(40); await foto("p05-raices");

/* 6. morir con ámbar y recuperar la sombra */
await pag.evaluate(() => { const p = window.__L.J.mundo.p; p.ambar = 33; p.vida = 1; p.invulnT = 0; });
await poner(10 * 8, 37 * 8 - 12); await anda(4);
await esperar(() => window.__L.sala().muerta || window.__L.J.muerte, 100);
await anda(40); await foto("p06-apagada");
await esperar(() => !window.__L.J.muerte && window.__L.sala().id === "P1", 400);
const tras = await prog();
ver((await sala()).id === "P1" && (await sala()).ambar === 0, "al apagarse vuelve al hongo, sin ámbar");
ver(tras.sombra && tras.sombra.sala === "R1" && tras.sombra.ambar === 33, "la luz queda en la sombra, con el ámbar");
await pag.evaluate(() => window.__L.empezar("R1", { sinCharlas: true }));
await pag.evaluate((s) => { window.__L.prog().sombra = s; }, tras.sombra);
await poner(tras.sombra.x - 4, tras.sombra.y - 6); await anda(6);
ver((await sala()).ambar === 33 && !(await prog()).sombra, "tocar la sombra devuelve el ámbar");

/* 7. la pelea con el Torito */
await pag.evaluate(() => window.__L.empezar("A1", { sinCharlas: true }));
await poner(8 * 8, 15 * 8 - 4); await anda(20);
const s7 = await sala();
ver(s7.jefe && s7.jefe.tipo === "torito", "entrar a la arena despierta al Torito");
ver(await pag.evaluate(() => window.__L.J.mundo.rompibles.some((r) => r.compuerta)), "la compuerta se cierra detrás");
await anda(100); await foto("p07-torito");
await pag.evaluate(() => window.__L.danarJefe(40));
await esperar(() => window.__L.estado() === "hallazgo", 400);
await anda(20); await foto("p08-farol");
const p8 = await prog();
ver(p8.jefes.torito && p8.habil.aleteo && p8.faroles.raices, "vencer al Torito prende el farol y da el aleteo");
for (let i = 0; i < 6 && (await estado()) === "hallazgo"; i++) { await anda(60); await apretar("salto"); }
ver((await estado()) === "jugando", "los carteles se cierran");
await anda(120);
ver(!(await pag.evaluate(() => window.__L.J.mundo.rompibles.some((r) => r.compuerta))), "la compuerta se abre");
await foto("p09-cueva-con-luz");

/* 8. el mapa y la pausa */
await apretar("mapa"); await anda(3);
ver((await estado()) === "mapa", "M abre el mapa");
await anda(20); await foto("p10-mapa");
await apretar("salto"); await anda(3);
ver((await estado()) === "jugando", "el mapa se cierra");
await apretar("pausa"); await anda(3);
ver((await estado()) === "pausa", "ESC pausa");
await pag.waitForTimeout(500); await foto("p11-pausa");
await tocarItem("seguir");
ver((await estado()) === "jugando", "SEGUIR vuelve");

/* 9. los recorridos del resolvedor, repetidos en el juego (pasando de sala en sala) */
const rec = path.join(AQUI, "pruebas/recorridos.json");
if (fs.existsSync(rec)) {
  const R = JSON.parse(fs.readFileSync(rec, "utf8"));
  for (const r of R) {
    const cuadros = [];
    for (const a of r.acciones) for (let f = 0; f < r.k; f++) cuadros.push({ x: a.x, y: a.y, salto: !!a.salto, saltoE: !!(a.nuevo && f === 0), golpeE: false, dashE: !!(a.dash && f === 0), curar: false });
    /* todo en una sola llamada: entre dos, el juego correría unos cuadros sin la repetición */
    await pag.evaluate(([r, c]) => {
      const jefes = {};
      for (const k of ["torito", "viuda", "reina"]) if (r.estado[k]) jefes[k] = 1;
      window.__L.empezar(r.sala, { sinCharlas: true, habil: r.habil, estado: r.estado, jefes, en: [r.x, r.y] });
      window.__L.J.mundo.bichos.length = 0;
      window.__L.repetir(c);
    }, [r, cuadros]);
    let llego = false;
    for (let i = 0; i < cuadros.length + 200; i += 5) {
      await anda(5);
      /* sin bichos en ninguna sala, como en el resolvedor */
      await pag.evaluate(() => { window.__L.J.mundo.bichos.length = 0; window.__L.J.mundo.balas.length = 0; });
      const s = await sala();
      if (s.id === r.meta && (!r.metaXY || (Math.abs((s.x + 4) / 8 - r.metaXY[0]) <= 1.6 && Math.abs((s.y + 6) / 8 - r.metaXY[1]) <= 1.6))) { llego = true; break; }
      if (s.vida < 5) break;
    }
    ver(llego, `recorrido ${r.nombre} en el juego de verdad`);
  }
} else console.log("--   sin pruebas/recorridos.json (correr recorrido.mjs --guardar)");

console.log(errores.length ? "ERRORES:\n" + errores.join("\n") : "sin errores de consola");
console.log(fallas || errores.length ? `${fallas} prueba(s) mal` : "la partida anda de punta a punta");
await nav.close();
process.exit(fallas || errores.length ? 1 : 0);
