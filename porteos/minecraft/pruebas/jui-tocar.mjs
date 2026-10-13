// toca controles de la interfaz JSON por su button id (o nombre) y saca fotos, en la página de prueba
// (p.html) o en el juego armado. Uso: node jui-tocar.mjs URL acción...
//   b:<id>[@n]   toca el n-ésimo control visible que manda ese button id (o se llama así)
//   f:<archivo>  foto          e:<expr>  evalúa y muestra       w:<ms>  espera
//   a:<dx>       arrastra en el medio de la pantalla dx px (gestos)
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, ...acciones] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("pageerror " + e.message + "\n" + e.stack));
pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load/.test(m.text())) console.log("[error] " + m.text()); });
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.listo || (window.prueba && window.prueba.listo))").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(800);
const J = "(window.Jui || window.prueba.jui)";
const dedo = (tipo, x, y) => pg.evaluate(([tipo, x, y]) => {
  const el = document.elementFromPoint(x, y) || document.body;
  el.dispatchEvent(new PointerEvent(tipo, { pointerId: 7, clientX: x, clientY: y, pointerType: "touch", bubbles: true, isPrimary: true }));
}, [tipo, x, y]);
for (const a of acciones) {
  const [k, ...r] = a.split(":"); const v = r.join(":");
  if (k === "b") {
    const [nombre, n] = v.split("@");
    const p = await pg.evaluate(([J, nombre, cual]) => {
      const Jui = eval(J), pan = Jui.arriba();
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
      // el lienzo de la interfaz: el de la página de prueba o el hud del juego
      const cv = document.getElementById("hud") || document.getElementById("c");
      const rr = cv.getBoundingClientRect(), d = cv.width / rr.width;
      return [rr.left + (c.x + c.w / 2) * Jui.escala / d, rr.top + (c.y + c.h / 2) * Jui.escala / d, l.length];
    }, [J, nombre, +(n || 0)]);
    if (!p) { console.log("NO HAY " + v); continue; }
    await dedo("pointerdown", p[0], p[1]); await pg.waitForTimeout(60); await dedo("pointerup", p[0], p[1]);
    await pg.waitForTimeout(400);
    console.log("tocado " + v + " (" + p[2] + " así)");
  } else if (k === "f") { await pg.waitForTimeout(200); await pg.screenshot({ path: v }); console.log("foto " + v); }
  else if (k === "e") console.log(v.slice(0, 70) + " → " + await pg.evaluate(v).catch((x) => "ERROR " + x.message));
  else if (k === "w") await pg.waitForTimeout(+v);
  else if (k === "a") {
    const x = 873 / 2, y = 393 / 2;
    await dedo("pointerdown", x, y);
    for (let i = 1; i <= 8; i++) { await dedo("pointermove", x + (+v) * i / 8, y); await pg.waitForTimeout(20); }
    await dedo("pointerup", x + (+v), y);
  }
}
await nav.close();
