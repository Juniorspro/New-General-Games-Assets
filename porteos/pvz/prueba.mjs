// Plantas vs. Zombies — la lista de PORTEO.md §9 contra lo que se entrega.
//
//   node porteos/pvz/prueba.mjs http://127.0.0.1:8831/ [file:///ruta/pvz.html]
//
// Primer argumento: la carpeta web servida por http (IndexedDB y el service
// worker lo necesitan). Segundo, opcional: el .html de un solo archivo.
// Los toques son dedos de verdad (CDP) y cada uno se mide en el estado del
// juego que expone porteo_estado() (parche del motor): pantalla, sol, plantas,
// soles en el piso, diálogos abiertos.
const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs");
const WEB = process.argv[2] || "http://127.0.0.1:8831/";
const ARCHIVO = process.argv[3];
const CAPTURAS = process.env.CAPTURAS || "/tmp";
const nav = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
let ok = 0, mal = 0;
const ch = (n, c, d = "") => { c ? ok++ : mal++; console.log(`  ${c ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };

async function abrir(url, { w = 844, h = 390, ctx = null } = {}) {
  const c = ctx || await nav.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  const pg = await c.newPage();
  const errores = [];
  pg.on("pageerror", (e) => errores.push(e.message));
  pg.on("console", (m) => { if (m.type() === "error" && !/favicon|sw\.js/.test(m.text())) errores.push(m.text().slice(0, 160)); });
  await pg.addInitScript(() => { window.__pvzLog = []; });
  const t0 = Date.now();
  await pg.goto(url);
  const cdp = await c.newCDPSession(pg);
  return { c, pg, cdp, errores, t0 };
}

const estado = (pg) => pg.evaluate(() => {
  const M = window.Module;
  if (!M || !M._porteo_estado || !M.UTF8ToString) return {};
  try { return JSON.parse(M.UTF8ToString(M._porteo_estado())); } catch (_) { return {}; }
});
// El título acepta el toque recién cuando terminó de cargar: se espera esa línea del motor.
async function esperarLog(pg, re, ms = 30000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (await pg.evaluate((f) => (window.__pvzLog || []).some((l) => new RegExp(f).test(l)), re.source)) return true;
    await pg.waitForTimeout(200);
  }
  return false;
}
async function esperar(pg, cond, ms = 20000, paso = 200) {
  const fin = Date.now() + ms;
  for (;;) {
    const e = await estado(pg);
    if (cond(e)) return e;
    if (Date.now() > fin) return null;
    await pg.waitForTimeout(paso);
  }
}

// Coordenadas del juego (800×600) → pantalla física. Con el césped la pantalla es más
// ancha (porteo_estado().vista = [x del borde izquierdo, ancho]: muestra la casa). Con el
// teléfono parado la página va girada (web.js) y el rectángulo del lienzo que ve la página
// es el "lógico": se deshace el giro para saber dónde apoya el dedo.
const deshacerGiro = (lx, ly) => {
  const g = window.Porteo && Porteo.girar && Porteo.girar("landscape");
  if (!g || !g.activo()) return [lx, ly];
  const [W, H] = g.fisico();
  return g.sentido() > 0 ? [W - ly, lx] : [ly, H - lx];
};
const fisico = (pg, gx, gy) => pg.evaluate(([gx, gy, deshacer]) => {
  const r = document.getElementById("canvas").getBoundingClientRect();
  let L = 0, A = 800;
  try { const v = JSON.parse(Module.UTF8ToString(Module._porteo_estado())).vista; if (v) [L, A] = v; } catch (_) {}
  // getBoundingClientRect ya viene girado: se toma el lado lógico con offset*
  const c = document.getElementById("canvas"), alto = parseFloat(c.style.height), ancho = parseFloat(c.style.width);
  const cont = document.getElementById("canvas-container"), m = /translateY\((-?[\d.]+)px\)/.exec(cont.style.transform || "");
  const izq = (innerWidth - ancho) / 2, arriba = (innerHeight - alto) / 2 + (m ? +m[1] : 0);
  return eval(deshacer)(izq + (gx - L) * ancho / A, arriba + gy * alto / 600);
}, [gx, gy, `(${deshacerGiro})`]);
async function tocarAhi(t, x, y, ms = 60) {
  await t.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  await t.pg.waitForTimeout(ms);
  await t.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function tocar(t, gx, gy, ms = 60) {
  const [x, y] = await fisico(t.pg, gx, gy);
  await tocarAhi(t, x, y, ms);
}
// Una tecla del teclado propio, por lo que dice (también girado).
async function tecla(t, texto) {
  const xy = await t.pg.evaluate(([texto, deshacer]) => {
    const b = [...document.querySelectorAll("#teclado button")].find((b) => b.textContent === texto);
    if (!b) return null;
    let x = b.offsetWidth / 2, y = b.offsetHeight / 2;
    for (let e = b; e && e !== document.body; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    const k = document.getElementById("teclado");  // centrado con translateX(-50%)
    x -= k.offsetWidth / 2;
    return eval(deshacer)(x, y);
  }, [texto, `(${deshacerGiro})`]);
  if (!xy) return false;
  await tocarAhi(t, xy[0], xy[1]);
  await t.pg.waitForTimeout(90);
  return true;
}

// Del título a la primera partida: lo mismo que haría alguien la primera vez.
async function hastaElTablero(t, etiqueta) {
  const intro = await t.pg.evaluate(() => !!document.getElementById("porteo-intro"));
  ch(`${etiqueta}: arranca con la intro de JXStudios`, intro);
  const tit = await esperar(t.pg, (e) => e.pantalla === "titulo", 60000);
  ch(`${etiqueta}: carga hasta el título`, !!tit, `${((Date.now() - t.t0) / 1000).toFixed(1)} s`);
  // el título termina de cargar recursos antes de aceptar el toque
  // "click to start" recién acepta el toque cuando la barra de carga llegó al final
  const cargo = await esperar(t.pg, (e) => e.pantalla === "titulo" && e.cargado === 1, 60000);
  ch(`${etiqueta}: termina de cargar ("click to start")`, !!cargo, `${((Date.now() - t.t0) / 1000).toFixed(1)} s`);
  // la intro (4,3 s) puede seguir arriba: un toque ahí la saltea y no le llega al juego
  for (let i = 0; i < 40 && await t.pg.evaluate(() => !!document.getElementById("porteo-intro")); i++) await t.pg.waitForTimeout(150);
  await tocar(t, 400, 560);
  const nuevo = await esperar(t.pg, (e) => e.pantalla === "menu" && e.dialogos > 0, 20000);
  ch(`${etiqueta}: un toque en "click to start" pasa al menú y pide el nombre`, !!nuevo);
  await t.pg.waitForTimeout(400);
  const kb = await t.pg.evaluate(() => {
    const k = document.getElementById("teclado"), c = document.getElementById("canvas");
    const m = /translateY\((-?[\d.]+)px\)/.exec(document.getElementById("canvas-container").style.transform || "");
    const alto = parseFloat(c.style.height), campo = (innerHeight - alto) / 2 + (m ? +m[1] : 0) + 330 * alto / 600;
    return { visible: !k.hidden, campoArriba: campo <= innerHeight - k.offsetHeight, modo: document.getElementById("pvz-soft-keyboard").getAttribute("inputmode") };
  });
  ch(`${etiqueta}: el cuadro del nombre abre el teclado propio (no el del sistema)`, kb.visible && kb.modo === "none", JSON.stringify(kb));
  ch(`${etiqueta}: el campo del nombre queda a la vista, arriba del teclado`, kb.campoArriba);
  // la primera letra sale mayúscula sola
  for (const c of "Juniors") await tecla(t, c);
  await tecla(t, "OK");
  const menu = await esperar(t.pg, (e) => e.pantalla === "menu" && e.dialogos === 0 && e.jugador === "Juniors", 30000);
  ch(`${etiqueta}: escrito con el teclado propio, el perfil "Juniors" queda creado`, !!menu, menu ? "" : JSON.stringify(await estado(t.pg)).slice(0, 200));
  ch(`${etiqueta}: con el nombre puesto, el teclado se va`, await t.pg.evaluate(() => document.getElementById("teclado").hidden));
  await t.pg.waitForTimeout(2500);
  await tocar(t, 560, 130);
  const tab = await esperar(t.pg, (e) => e.pantalla === "tablero" && e.nivel === 1, 30000);
  ch(`${etiqueta}: "Start Adventure" abre el nivel 1-1`, !!tab);
  // pantalla ancha: en un teléfono apaisado el jardín muestra la casa (220 más a la izquierda)
  const ancho = await esperar(t.pg, (e) => e.vista && e.vista[1] === 1020, 5000);
  const lz = await t.pg.evaluate(() => { const c = document.getElementById("canvas"); return [c.width, c.height, parseFloat(c.style.width), parseFloat(c.style.height)]; });
  ch(`${etiqueta}: en el jardín la pantalla se agranda hacia la casa (1020×600, sin deformar)`, !!ancho && lz[0] === 1020 && Math.abs(lz[2] / lz[3] - 1020 / 600) < 0.01,
     `vista ${JSON.stringify(ancho && ancho.vista)}, lienzo ${lz.join(",")}`);
  return tab;
}

console.log("A. Teléfono horizontal (844×390, dedos de verdad)");
{
  const t0 = await abrir(WEB);
  await t0.pg.waitForTimeout(1200);
  await tocarAhi(t0, 422, 195);
  await t0.pg.waitForTimeout(800);
  ch("A: un toque saltea la intro", !(await t0.pg.evaluate(() => !!document.getElementById("porteo-intro"))));
  await t0.c.close();
  const t = await abrir(WEB);
  await hastaElTablero(t, "A");
  // el tutorial habilita el sobre recién cuando termina la intro
  const listo = await esperar(t.pg, (e) => e.pantalla === "tablero" && e.sol === 150 && e.dialogos === 0, 40000);
  await t.pg.waitForTimeout(4000);
  await tocar(t, 112, 42);
  const conSemilla = await esperar(t.pg, (e) => e.cursor > 0, 4000);
  ch("A: tocar el sobre del lanzaguisantes lo levanta", !!conSemilla, conSemilla ? `cursor ${conSemilla.cursor}, semilla ${conSemilla.semilla}` : JSON.stringify(await estado(t.pg)).slice(0, 160));
  await tocar(t, 80, 330);
  const plantado = await esperar(t.pg, (e) => (e.plantas || []).length === 1, 4000);
  ch("A: tocar el pasto lo planta y cobra 100 de sol", !!plantado && plantado.sol === (listo ? listo.sol : 150) - 100, plantado ? `sol ${plantado.sol}, planta ${JSON.stringify(plantado.plantas)}` : "");
  await t.pg.screenshot({ path: `${CAPTURAS}/pvz-a-plantado.png` });
  const conSol = await esperar(t.pg, (e) => (e.soles || []).some((s) => s[1] > 120), 30000, 300);
  if (conSol) {
    const antes = conSol.sol, s = conSol.soles.find((s) => s[1] > 120);
    await tocar(t, s[0] + 40, s[1] + 40);
    const junto = await esperar(t.pg, (e) => e.sol > antes, 5000);
    ch("A: tocar un sol que cae lo junta (+25)", !!junto && junto.sol - antes === 25, junto ? `${antes} → ${junto.sol}` : "");
  } else ch("A: cae un sol para juntar", false);
  // atrás = Escape: abre el menú de pausa del juego; dos seguidos salen
  const r1 = await t.pg.evaluate(() => window.porteoAtras());
  const pausa = await esperar(t.pg, (e) => e.dialogos > 0, 4000);
  ch("A: el botón atrás abre el menú del juego", r1 === true && !!pausa, pausa ? `diálogo ${pausa.dialogo}` : "");
  const r2 = await t.pg.evaluate(() => window.porteoAtras());
  ch("A: atrás dos veces seguidas sale", r2 === "salir");
  await t.pg.screenshot({ path: `${CAPTURAS}/pvz-a-pausa.png` });
  // segundo plano: el audio de SDL corre en su propio hilo y hay que pararlo a mano
  const susp = await t.pg.evaluate(async () => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 400));
    const a = Module.SDL2.audioContext.state;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((r) => setTimeout(r, 400));
    return [a, Module.SDL2.audioContext.state];
  });
  ch("A: al ir a segundo plano el sonido se suspende y vuelve", susp[0] === "suspended" && susp[1] === "running", susp.join(" → "));
  ch("A: sin errores en la consola", t.errores.length === 0, t.errores.slice(0, 3).join(" | "));
  const mem = (await estado(t.pg)).memoria_mb;
  ch("A: memoria del juego en modo de poca memoria (≤ 240 MB; el normal usa 264)", mem > 0 && mem <= 240, `${mem} MB`);
  // el perfil quedó en IndexedDB: al recargar no pide nombre
  await t.pg.waitForTimeout(6000);
  await t.pg.reload();
  const vuelta = await esperar(t.pg, (e) => e.pantalla === "titulo", 60000);
  await esperar(t.pg, (e) => e.pantalla === "titulo" && e.cargado === 1, 60000);
  for (let i = 0; i < 40 && await t.pg.evaluate(() => !!document.getElementById("porteo-intro")); i++) await t.pg.waitForTimeout(150);
  await tocar(t, 400, 560);
  const sigue = await esperar(t.pg, (e) => e.pantalla === "menu" && e.jugador === "Juniors", 20000);
  ch("A: al volver a abrir, el perfil sigue ahí (guardado en el teléfono)", !!vuelta && !!sigue && sigue.dialogos === 0);
  await t.c.close();
}

console.log("\nB. Teléfono parado (390×844): el juego se gira solo 90°");
{
  const t = await abrir(WEB, { w: 390, h: 844 });
  const girado = await t.pg.evaluate(() => document.documentElement.classList.contains("porteo-girado"));
  ch("B: la página va girada", girado);
  await hastaElTablero(t, "B");
  const lienzo = await t.pg.evaluate(() => { const c = document.getElementById("canvas"); return [Math.round(parseFloat(c.style.width)), Math.round(parseFloat(c.style.height))]; });
  ch("B: el lienzo ocupa el alto lógico entero (con la casa: 1020×600)", lienzo[1] === 390 && lienzo[0] === 663, lienzo.join("×"));
  await esperar(t.pg, (e) => e.pantalla === "tablero" && e.sol === 150 && e.dialogos === 0, 40000);
  await t.pg.waitForTimeout(4000);
  await tocar(t, 112, 42);
  await esperar(t.pg, (e) => e.cursor > 0, 4000);
  await tocar(t, 80, 330);
  const plantado = await esperar(t.pg, (e) => (e.plantas || []).length === 1, 4000);
  ch("B: girado, el toque cae donde se ve: sobre y pasto", !!plantado && plantado.plantas[0][0] === 0 && plantado.plantas[0][1] === 2, plantado ? JSON.stringify(plantado.plantas) : "");
  await t.pg.screenshot({ path: `${CAPTURAS}/pvz-b-girado.png` });
  ch("B: sin errores en la consola", t.errores.length === 0, t.errores.slice(0, 3).join(" | "));
  await t.c.close();
}

console.log("\nC. Sin internet (service worker)");
{
  const t = await abrir(WEB);
  await esperar(t.pg, (e) => e.pantalla === "titulo" && e.cargado === 1, 60000);
  // el service worker baja todo (32 MB) en la primera visita
  const guardado = await t.pg.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 120; i++) {
      const ks = await caches.keys();
      for (const k of ks) { const c = await caches.open(k); if (await c.match("main.pak")) return true; }
      await new Promise((r) => setTimeout(r, 500));
    }
    return false;
  });
  ch("C: la primera visita deja todo guardado para jugar sin red", guardado);
  await t.c.setOffline(true);
  await t.pg.reload();
  const off = await esperar(t.pg, (e) => e.pantalla === "titulo" && e.cargado === 1, 60000);
  ch("C: sin red, el juego abre igual hasta \"click to start\"", !!off);
  await t.c.close();
}

if (ARCHIVO) {
  console.log("\nD. Un solo archivo (.html abierto del disco)");
  const t = await abrir(ARCHIVO);
  const tit = await esperar(t.pg, (e) => e.pantalla === "titulo" && e.cargado === 1, 120000);
  ch("D: abre desde el disco hasta \"click to start\"", !!tit, `${((Date.now() - t.t0) / 1000).toFixed(1)} s`);
  for (let i = 0; i < 40 && await t.pg.evaluate(() => !!document.getElementById("porteo-intro")); i++) await t.pg.waitForTimeout(150);
  await tocar(t, 400, 560);
  const nuevo = await esperar(t.pg, (e) => e.pantalla === "menu" && e.dialogos > 0, 20000);
  ch("D: el toque pasa al menú", !!nuevo);
  ch("D: sin errores en la consola", t.errores.length === 0, t.errores.slice(0, 3).join(" | "));
  await t.c.close();
}

console.log(`\n${ok} bien, ${mal} mal`);
await nav.close();
process.exit(mal ? 1 : 0);
