// Recorrido por el juego entero con la variante de depuración (portear.sh --depuracion):
// salta por niveles y minijuegos con el atajo "l" de PopCap y en cada uno espera a que
// se esté jugando de verdad (escena 3 de porteo_estado), 6 s más, y mira que no haya
// errores, asserts ni recursos faltantes. Sirve para saber si los datos del dueño (que
// pueden ser de otra versión que la que espera el motor) andan en TODO el juego, no
// sólo en la 1-1.
//
//   python3 -m http.server 8832 --directory entrega-pvz/pvz-depuracion &
//   node porteos/pvz/recorrido.mjs http://127.0.0.1:8832/ [1-5,3-1,C23,...]
//
// "1-5" es aventura (área-nivel); "C23" es el modo 23 (minijuegos, rompecabezas,
// supervivencia; la lista está en GameMode, src/ConstEnums.h de PvZ-Portable).
// El Árbol de la Sabiduría (C50) va último: ahí el atajo "l" no anda. Last Stand (C31)
// no está: con los saltos por atajo el perfil no tiene las plantas para llenar el
// selector, y sin eso no deja empezar (jugando de verdad, se habilita al final).
const { chromium } = await import(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright/index.mjs");
const fs = await import("node:fs");
const URL = process.argv[2] || "http://127.0.0.1:8832/";
const SAL = (process.env.CAPTURAS || "/tmp") + "/pvz-recorrido";
fs.mkdirSync(SAL, { recursive: true });
const LISTA = (process.argv[3] || "1-5,1-10,2-5,2-10,3-1,3-5,3-10,4-1,4-5,4-10,5-1,5-5,5-10,C1,C6,C11,C16,C17,C18,C20,C23,C24,C26,C27,C30,C35,C41,C43,C51,C61,C50").split(",");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"] });
// ANCHO=1020 recorre todo con la pantalla ancha (la casa a la izquierda del jardín)
const c = await nav.newContext({ viewport: { width: +(process.env.ANCHO || 800), height: 600 } });
const pg = await c.newPage();
let errores = [];
pg.on("pageerror", (e) => errores.push(process.env.PILA ? e.stack : e.message));
await pg.addInitScript(() => { window.__pvzLog = []; });
await pg.goto(URL);
const est = async () => { try { return JSON.parse(await pg.evaluate(() => Module.UTF8ToString(Module._porteo_estado()))); } catch (_) { return {}; } };
const esperar = async (f, ms) => { const fin = Date.now() + ms; while (Date.now() < fin) { const e = await est(); if (f(e)) return e; await pg.waitForTimeout(250); } return null; };
const malos = () => pg.evaluate(() => window.__pvzLog.filter((l) => /assert|Can't find track|missing resource|Failed to load|not found/i.test(l)));
const celda = ([col, fila]) => [40 + col * 80 + 40, 80 + fila * 100 + 50];
// clic en coordenadas del juego: el lienzo se centra, y con el jardín la vista es más ancha
const clic = async (gx, gy) => {
  const [x, y] = await pg.evaluate(([gx, gy]) => {
    const r = document.getElementById("canvas").getBoundingClientRect();
    let L = 0, A = 800;
    try { const v = JSON.parse(Module.UTF8ToString(Module._porteo_estado())).vista; if (v) [L, A] = v; } catch (_) {}
    return [r.left + (gx - L) * r.width / A, r.top + gy * r.height / 600];
  }, [gx, gy]);
  await pg.mouse.click(x, y);
};

await esperar((e) => e.pantalla === "titulo" && e.cargado === 1, 90000);
// la intro de JXStudios (4,3 s) puede seguir arriba: un clic ahí la saltea y no le llega al juego
for (let i = 0; i < 40 && await pg.evaluate(() => !!document.getElementById("porteo-intro")); i++) await pg.waitForTimeout(150);
await clic(400, 560);
await esperar((e) => e.pantalla === "menu" && e.dialogos > 0, 20000);
await pg.keyboard.type("Recorrido", { delay: 30 });
await pg.keyboard.press("Enter");
await esperar((e) => e.pantalla === "menu" && e.dialogos === 0, 20000);
await pg.waitForTimeout(2500);
await pg.keyboard.press("u");             // atajo: todo desbloqueado
await pg.waitForTimeout(800);
await clic(560, 130);
await esperar((e) => e.pantalla === "tablero", 60000);
await pg.waitForTimeout(3000);

let bien = 0, mal = 0;
for (const n of LISTA) {
  errores = [];
  const antes = (await malos()).length;
  if ((await est()).dialogos > 0) { await pg.keyboard.press("Escape"); await pg.waitForTimeout(500); }
  await pg.keyboard.press("l");
  if (!(await esperar((e) => e.dialogos > 0, 4000))) { console.log(`✗ ${n}: no abrió el diálogo de nivel`); mal++; continue; }
  await pg.keyboard.type(n, { delay: 60 });
  await pg.keyboard.press("Enter");
  // Hasta que se juegue: a Dave se lo avanza tocando; en el selector se eligen plantas
  // y "Let's Rock" (el selector entra deslizándose: si los toques llegaron antes, se
  // reintenta); el tutorial de la pala (1-5) pide sacar las plantas con la pala.
  let e = null, eligio = 0;
  const tope = Date.now() + 60000;
  await pg.waitForTimeout(1500);
  while (Date.now() < tope) {
    const s = await est();
    if (s.escena === 3 && s.dave === 0 && s.dialogos === 0) { e = s; break; }
    if (s.dialogos > 0) await pg.keyboard.press("Enter");
    else if (s.dave > 0) await clic(400, 300);
    else if (s.escena === 2 && (s.plantas || []).length) {
      // (el selector ya existe aunque no se vea: la pantalla figura "elegir")
      await clic(644, 32);                              // la pala
      await pg.waitForTimeout(300);
      await clic(...celda(s.plantas[0]));
    } else if (s.pantalla === "elegir" && Date.now() - eligio > 5000) {
      // sobres de las tres primeras filas hasta llenar los casilleros (en Last Stand
      // el girasol no se puede elegir); los toques de más no hacen nada
      for (const y of [160, 235, 308]) for (const x of [45, 97, 150, 205, 257, 310, 363, 415]) { await clic(x, y); await pg.waitForTimeout(120); }
      await clic(232, 565);
      eligio = Date.now();
    }
    await pg.waitForTimeout(700);
  }
  await pg.waitForTimeout(6000);
  const fin = await est();
  await pg.screenshot({ path: `${SAL}/${n}.png` });
  const nuevos = (await malos()).slice(antes);
  const ok = !!e && errores.length === 0 && nuevos.length === 0;
  ok ? bien++ : mal++;
  console.log(`${ok ? "✓" : "✗"} ${n}: escena ${fin.escena} modo ${fin.modo} nivel ${fin.nivel} zombis ${(fin.zombis || []).length} plantas ${(fin.plantas || []).length} memoria ${fin.memoria_mb} MB` +
    (errores.length ? " ERROR " + errores.join(" | ") : "") + (nuevos.length ? " REGISTRO " + nuevos.join(" | ").slice(0, 200) : ""));
  if (errores.length) break;  // el módulo murió: no tiene sentido seguir
}
console.log(`\n${bien} bien, ${mal} mal (capturas en ${SAL})`);
await nav.close();
process.exit(mal ? 1 : 0);
