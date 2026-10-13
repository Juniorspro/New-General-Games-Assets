// el árbol del HUD (nombre, tipo, caja, visible) para ver por qué la barra sale cortada
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, modo = "supervivencia", raizNombre = "exp_progress_bar_and_hotbar"] = process.argv.slice(2);
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
await pg.evaluate((modo) => window.prueba.crear({ nombre: 'Hud', modo: modo, tipo: 'plano', bichos: false, siempreDia: true }), modo);
for (let i = 0; i < 300; i++) { if (await pg.evaluate("Interfaz.pantalla === 'juego'").catch(() => false)) break; await pg.waitForTimeout(200); }
await pg.waitForTimeout(1500);
const arbol = await pg.evaluate((raizNombre) => {
  const pan = window.prueba.hudPan ? window.prueba.hudPan() : null;
  if (!pan) return "sin hudPan";
  const J = window.prueba.jui;
  if (raizNombre === 'botones') {
    const l = [];
    const rec = (c, ruta) => {
      const r2 = ruta + '/' + c.n;
      if (!c.ver) return;
      if (c.t === 'button' || c.t === 'toggle') l.push(r2.slice(-90) + ' [' + c.t + '] ' + [c.x, c.y, c.w, c.h].map((v) => Math.round(v)).join(','));
      c.hijos.forEach((h) => rec(h, r2));
    };
    rec(pan.raiz, '');
    return l.join('\n');
  }
  if (raizNombre === 'zona') {
    const l = [];
    const rec = (c, ruta) => {
      const r2 = ruta + '/' + c.n;
      if (c.t === 'image' && Math.abs(c.x - 549) < 3 && Math.abs(c.y - 28.3) < 3) l.push(r2 + ' [' + c.t + '] ' + [c.x, c.y, c.w, c.h].map((v) => Math.round(v)).join(',') + (c.p.texture ? ' tex=' + c.p.texture : '') + (c.p.renderer ? ' rend=' + c.p.renderer : ''));
      c.hijos.forEach((h) => rec(h, r2));
    };
    rec(pan.raiz, '');
    return l.join('\n');
  }
  const r = J.buscar(pan.raiz, raizNombre);
  if (!r) return "no está " + raizNombre;
  const l = [];
  const rec = (c, n) => {
    if (n > 9) return;
    l.push("  ".repeat(n) + c.n + " [" + c.t + "] " + [c.x, c.y, c.w, c.h].map((v) => Math.round(v * 10) / 10).join(",") + (c.ver ? "" : " (oculto)") +
      (c.p.size ? " size=" + JSON.stringify(c.p.size) : "") + (c.p.offset ? " off=" + JSON.stringify(c.p.offset) : "") + (c.p.max_size ? " max=" + JSON.stringify(c.p.max_size) : ""));
    c.hijos.forEach((h) => rec(h, n + 1));
  };
  rec(r, 0);
  return l.join("\n");
}, raizNombre);
console.log(arbol);
await nav.close();
