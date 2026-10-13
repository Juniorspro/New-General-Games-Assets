// el inventario de la 1.2 (JSON): creativo y supervivencia, tocando de verdad
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, modo = "creativo"] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
let errores = 0;
pg.on("pageerror", (e) => { errores++; console.log("pageerror " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 5).join("\n")); });
pg.on("console", (m) => { if (m.type() === "error" && !/WebSocket/.test(m.text())) console.log("[error] " + m.text()); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(1500);
for (const lado of [1, 2]) {
  await pg.evaluate((lado) => {
    const J = window.prueba.jui, pan = J.arriba(); if (!pan) return;
    const id = lado === 1 ? "button.porteo_cartel_medio" : "button.porteo_cartel_der";
    const rec = (c) => { const m = c.p.button_mappings || []; if (c.ver && m.some((b) => b && b.to_button_id === id)) return c; for (const h of c.hijos) { const r = rec(h); if (r) return r; } return null; };
    const c = rec(pan.raiz); if (c) J.apretar(c);
  }, lado);
  await pg.waitForTimeout(500);
}
await pg.evaluate((modo) => window.prueba.crear({ nombre: 'Inv', modo: modo, tipo: 'plano', bichos: false, siempreDia: true }), modo);
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
await pg.evaluate(() => Interfaz.acciones.inventario());
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${pref}-1.png` });
// dónde están los casilleros: la colección y el lugar de cada botón
const info = await pg.evaluate(() => {
  const J = window.prueba.jui, pan = J.arriba(), out = {};
  const rec = (c) => {
    if (c.t === 'button' && c.ver) { const q = J.coleccionDe(c); if (q) { (out[q.col] = out[q.col] || []).push([q.i, Math.round(c.x + c.w / 2), Math.round(c.y + c.h / 2)]); } }
    c.hijos.forEach(rec);
  };
  rec(pan.raiz);
  const r = {}; for (const k in out) r[k] = out[k].length + " ej " + JSON.stringify(out[k].slice(0, 2));
  return { nombre: pan.nombre, casilleros: r, esc: J.escala };
});
console.log(JSON.stringify(info));
// tocar como un dedo: la pantalla en unidades de la interfaz → píxeles CSS
async function tocarCasillero(col, i) {
  const p = await pg.evaluate(([col, i]) => {
    const J = window.prueba.jui, pan = J.arriba(); let r = null;
    const rec = (c) => { if (r) return; if (c.t === 'button' && c.ver) { const q = J.coleccionDe(c); if (q && q.col === col && q.i === i) r = [c.x + c.w / 2, c.y + c.h / 2]; } c.hijos.forEach(rec); };
    rec(pan.raiz);
    if (!r) return null;
    const hud = document.querySelectorAll('canvas'); let el = null; for (const cv of hud) if (getComputedStyle(cv).pointerEvents !== 'none') el = cv;
    return [r[0] * J.escala / devicePixelRatio, r[1] * J.escala / devicePixelRatio];
  }, [col, i]);
  if (!p) { console.log("no hay " + col + " " + i); return; }
  await pg.touchscreen.tap(p[0], p[1]);
  await pg.waitForTimeout(250);
}
if (modo === "creativo") {
  // la pestaña de equipo: tocar la segunda cosa y después el casillero 3 de la barra
  await tocarCasillero('recipe_construction', 5);
  await pg.screenshot({ path: `${pref}-2.png` });
  await tocarCasillero('hotbar_items', 3);
  await pg.screenshot({ path: `${pref}-3.png` });
  console.log("barra: " + await pg.evaluate(() => JSON.stringify(Interfaz.juego.barra.map((c) => c && [c.id, c.m, c.n]))));
}
console.log("errores de la página: " + errores);
await nav.close();
