// con el teléfono parado (393x873): la página se gira 90° (porteo-web.js) y los toques de verdad
// (touchscreen.tap en coordenadas físicas) tienen que caer en los botones de la interfaz JSON
const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
const [url, pref] = process.argv.slice(2);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await nav.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => console.log("pageerror " + e.message));
await pg.goto(url);
for (let i = 0; i < 600; i++) { if (await pg.evaluate("!!(window.prueba && window.prueba.listo)").catch(() => false)) break; await pg.waitForTimeout(100); }
await pg.waitForTimeout(2500);
let n = 0;
const foto = async (s) => { await pg.screenshot({ path: `${pref}-${++n}-${s}.png` }); };
// centro de un control en coordenadas de la página girada (CSS) → punto físico de la pantalla
const tocar = async (nombre, cual = 0) => {
  const p = await pg.evaluate(([nombre, cual]) => {
    const J = window.prueba.jui, pan = J.arriba(), l = [];
    const rec = (c, vis) => {
      vis = vis && c.ver; if (!vis) return;
      const m = Array.isArray(c.p.button_mappings) ? c.p.button_mappings : [];
      if (c.w > 0 && c.h > 0 && (c.n === nombre || m.some((b) => b && b.to_button_id === nombre))) l.push(c);
      c.hijos.forEach((h) => rec(h, vis));
    };
    rec(pan.raiz, true);
    const c = l[cual]; if (!c) return null;
    const d = Interfaz.dpr();
    return [(c.x + c.w / 2) * J.escala / d, (c.y + c.h / 2) * J.escala / d, document.documentElement.classList.contains("porteo-girado")];
  }, [nombre, cual]);
  if (!p) { console.log("NO HAY " + nombre); return; }
  // girada 90° a la derecha: (x, y) de la página → (ancho físico - y, x)
  const fx = p[2] ? 393 - p[1] : p[0], fy = p[2] ? p[0] : p[1];
  await pg.touchscreen.tap(fx, fy);
  await pg.waitForTimeout(700);
  console.log(`tocado ${nombre} en (${fx.toFixed(0)}, ${fy.toFixed(0)}) girada=${p[2]}`);
};
const estado = () => pg.evaluate("[Interfaz.pantalla, window.prueba.pantallas.nombre(), JSON.stringify({idioma: localStorage.length})].join(' / ')");
await foto("idioma");
await tocar("button.porteo_cartel_medio");
await foto("shaders");
await tocar("button.porteo_cartel_der");
console.log("título: " + await estado() + " idioma=" + await pg.evaluate("document.documentElement.lang"));
await foto("titulo");
await tocar("button.menu_play");
await pg.waitForTimeout(800);
console.log("jugar: " + await estado());
await foto("jugar");
await tocar("button.menu_local_world_create");
console.log("crear: " + await estado());
await foto("crear");
await nav.close();
