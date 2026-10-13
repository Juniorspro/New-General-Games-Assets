// Minecraft 1.2: dos jugadores en el mismo mundo público (broker MQTT local), y un tercero que entra
// después y tiene que ver lo construido (los mensajes retenidos)
import fs from "node:fs";
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [base, pref] = process.argv.slice(2);
const url = base + "?broker=ws://127.0.0.1:8883/mqtt&mqttjs=http://127.0.0.1:8961/mqtt.min.js";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const t0 = Date.now(), log = [];
const L = (s) => { const l = `[${((Date.now() - t0) / 1000).toFixed(1)}] ${s}`; log.push(l); console.log(l); };
async function cliente(nombre, skin) {
  const ctx = await nav.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([n, s]) => { localStorage.setItem("mc12.opciones", JSON.stringify({ idioma: "es", shaders: false, nombre: n, skin: s, dist: 4 })); }, [nombre, skin]);
  const pg = await ctx.newPage();
  pg.on("console", (m) => { if (!/Failed to load/.test(m.text())) L(`${nombre} [${m.type()}] ${m.text()}`); });
  pg.on("pageerror", (e) => L(`${nombre} [pageerror] ${e.message}`));
  await pg.goto(url);
  for (let i = 0; i < 400; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(250); }
  await pg.waitForTimeout(5000);   // la intro
  return pg;
}
const esperar = async (pg, cond, seg = 60) => { for (let i = 0; i < seg * 4; i++) { if (await pg.evaluate(cond).catch(() => false)) return true; await pg.waitForTimeout(250); } L("NO: " + cond); return false; };
const a = await cliente("Ana", "alex"), b = await cliente("Beto", "steve");
await a.evaluate("window.prueba.publico(0)"); await b.evaluate("window.prueba.publico(0)");
await esperar(a, "Interfaz.pantalla === 'juego'", 120); await esperar(b, "Interfaz.pantalla === 'juego'", 120);
await esperar(a, "Red.estado === 'enlinea' && Red.remotos.size > 0", 30);
L("Ana: estado " + await a.evaluate("Red.estado") + ", ve " + await a.evaluate("JSON.stringify(Array.from(Red.remotos.values()).map(j => [j.name, +j.x.toFixed(1), +j.y.toFixed(1), +j.z.toFixed(1)]))"));
L("Beto: estado " + await b.evaluate("Red.estado") + ", ve " + await b.evaluate("JSON.stringify(Array.from(Red.remotos.values()).map(j => j.name))"));
// Beto se pone delante de Ana, mirándola
const pa = await a.evaluate("[Jugador.x, Jugador.y, Jugador.z]");
await b.evaluate(`(() => { Jugador.ubicar(${pa[0]}, ${pa[1] + 0.01}, ${pa[2] - 3}); Jugador.yaw = Math.PI; Jugador.volando = true; })()`);
await a.evaluate("Jugador.yaw = 0; Jugador.pitch = 0.1; Jugador.volando = true");
await a.waitForTimeout(2500);
await a.screenshot({ path: `${pref}-01-ana-ve-a-beto.png` });
await b.screenshot({ path: `${pref}-02-beto-ve-a-ana.png` });
// chat
await b.evaluate("Red.decir('hola Ana!')");
await a.waitForTimeout(800);
L("chat de Ana: " + await a.evaluate("JSON.stringify(Interfaz.juego.chat.map(l => l.s))"));
// un bloque de Beto aparece en el mundo de Ana
const bx = Math.floor(pa[0]) + 2, by = Math.floor(pa[1]) + 1, bz = Math.floor(pa[2]) - 2;
await b.evaluate(`(() => { Mundo.poner(${bx}, ${by}, ${bz}, 57, 0); Red.bloque(${bx}, ${by}, ${bz}, 57, 0); })()`);
await a.waitForTimeout(1500);
L("bloque en lo de Ana: " + await a.evaluate(`Mundo.bloque(${bx}, ${by}, ${bz})`));
await a.screenshot({ path: `${pref}-03-ana-ve-el-bloque.png` });
// Beto le pega a Ana (con la acción del juego: el rayo desde el centro)
const vidaAntes = await a.evaluate("Interfaz.juego.vida");
await b.evaluate(`Red.golpear(Array.from(Red.remotos.values())[0].id, 2, 0, 0.4)`);
await a.waitForTimeout(800);
L("vida de Ana: " + vidaAntes + " → " + await a.evaluate("Interfaz.juego.vida"));
await a.screenshot({ path: `${pref}-04-ana-golpeada.png` });
// un bicho de Beto se ve en lo de Ana
await b.evaluate(`Bichos.crear('cow', ${pa[0] + 1.5}, ${pa[1]}, ${pa[2] - 4})`);
await a.waitForTimeout(1500);
L("bichos de otros en lo de Ana: " + await a.evaluate("Bichos.paraDibujar(1).filter(e => e.dueno).map(e => e.tipo).join(',')"));
await a.screenshot({ path: `${pref}-05-vaca-de-beto.png` });
// una explosión de Beto (como la de un creeper): Ana tiene que ver el pozo (un solo mensaje)
const ex = await a.evaluate(`(() => { const x = Math.floor(${pa[0]}) - 3, z = Math.floor(${pa[2]}) - 3; for (let y = 120; y > 2; y--) { const b = Mundo.bloque(x, y, z); if (b > 0 && C.SOLIDO[b]) return [x, y, z]; } return [x, 60, z]; })()`);
const antesEx = await a.evaluate(`Mundo.bloque(${ex[0]}, ${ex[1]}, ${ex[2]})`);
await b.evaluate(`Bichos.explosion(${ex[0]} + 0.5, ${ex[1]} + 0.5, ${ex[2]} + 0.5, 3, [{ x: Jugador.x, y: Jugador.y, z: Jugador.z, id: null, vivo: true }])`);
await a.waitForTimeout(1500);
L("explosión: bloque en lo de Ana " + antesEx + " → " + await a.evaluate(`Mundo.bloque(${ex[0]}, ${ex[1]}, ${ex[2]})`) + ", vida de Beto " + await b.evaluate("Interfaz.juego.vida"));
await a.screenshot({ path: `${pref}-05b-pozo.png` });
// un tercero entra después: tiene que ver el bloque (mensaje retenido, a los 3 s de puesto)
await a.waitForTimeout(3000);
const c = await cliente("Ceci", "steve");
await c.evaluate("window.prueba.publico(0)");
await esperar(c, "Interfaz.pantalla === 'juego'", 120);
await esperar(c, `Mundo.bloque(${bx}, ${by}, ${bz}) === 57`, 20);
L("bloque en lo de Ceci (entró después): " + await c.evaluate(`Mundo.bloque(${bx}, ${by}, ${bz})`) + ", ve " + await c.evaluate("JSON.stringify(Array.from(Red.remotos.values()).map(j => j.name))"));
// Beto sale: Ana lo deja de ver
await b.evaluate("window.prueba.render && Interfaz.acciones.pausa()");
await b.waitForTimeout(300);
await b.evaluate("Interfaz.acciones.salir()");
await a.waitForTimeout(2500);
L("Ana después de que Beto salió: " + await a.evaluate("JSON.stringify(Array.from(Red.remotos.values()).map(j => j.name))") + " chat " + await a.evaluate("JSON.stringify(Interfaz.juego.chat.slice(-2).map(l => l.s))"));
await a.screenshot({ path: `${pref}-06-ana-final.png` });
fs.writeFileSync(`${pref}.log`, log.join("\n"));
await nav.close();
