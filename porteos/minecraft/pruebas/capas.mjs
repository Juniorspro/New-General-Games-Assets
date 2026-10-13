// de qué lienzo sale algo: foto con el 3D escondido y con el HUD escondido
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref, modo = "supervivencia"] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => { console.log("pageerror " + e.message); });
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
await pg.evaluate((modo) => window.prueba.crear({ nombre: 'Capas', modo: modo, tipo: 'plano', bichos: false, siempreDia: true }), modo);
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const quien = await pg.evaluate(() => new Promise((res) => {
  const orig = CanvasRenderingContext2D.prototype.drawImage, hallados = [];
  CanvasRenderingContext2D.prototype.drawImage = function () {
    const a = arguments, dx = a.length >= 9 ? a[5] : a[1], dy = a.length >= 9 ? a[6] : a[2];
    if (this.canvas.id === 'hud' && dx > 1630 && dx < 1720 && dy > 70 && dy < 105 && hallados.length < 3) hallados.push(dx + ',' + dy + ' dw=' + (a.length >= 9 ? a[7] + 'x' + a[8] : a[3] + 'x' + a[4]) + ' src=' + (a.length >= 9 ? [a[1], a[2], a[3], a[4]].join(',') : '-') + ' img=' + (a[0].width + 'x' + a[0].height) + ' ' + (a[0].src ? a[0].src.slice(0, 80) : a[0].id || a[0].tagName));
    return orig.apply(this, a);
  };
  Interfaz.sucio && Interfaz.sucio();
  setTimeout(() => { CanvasRenderingContext2D.prototype.drawImage = orig; res(hallados); }, 600);
}));
console.log(quien.join('\n'));
const lienzos = await pg.evaluate(() => Array.from(document.querySelectorAll('canvas')).map((c) => c.id + ':' + c.width + 'x' + c.height));
console.log(lienzos.join(' '));
await pg.evaluate(() => { document.getElementById('lienzo').style.visibility = 'hidden'; });
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${pref}-solo-hud.png` });
await pg.evaluate(() => { document.getElementById('lienzo').style.visibility = ''; for (const c of document.querySelectorAll('canvas')) if (c.id !== 'lienzo') c.style.visibility = 'hidden'; });
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${pref}-solo-3d.png` });
await nav.close();
