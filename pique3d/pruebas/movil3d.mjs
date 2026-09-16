// El telefono: acostado y parado. Lo que se comprueba no es "que se vea", es
// que entren suficientes tiles de ancho — si el jugador no ve lo que viene, el
// nivel se vuelve injusto por una razon que no tiene nada que ver con el nivel.
import { chromium } from "playwright";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const ok = [], mal = [];
const chequear = (n, c, x = "") => (c ? ok : mal).push(n + (x ? ` — ${x}` : ""));
for (const [w, h, nombre] of [[844, 390, "acostado"], [390, 844, "parado"]]) {
  const pg = await nav.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true,
                                 deviceScaleFactor: 3 });
  const err = [];
  pg.on("pageerror", e => err.push(e.message));
  await pg.goto("http://127.0.0.1:8801/index.html");
  await pg.waitForFunction(() => !!window.PIQUE3D, { timeout: 90000 });
  const desborde = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  chequear(`${nombre} sin scroll horizontal`, desborde <= 0, `${desborde}px`);
  // En vertical el juego tapa todo con el aviso de girar. Se comprueba que
  // este —es la conducta correcta— y se descarta para poder seguir probando.
  const avisa = await pg.isVisible("#girar");
  chequear(`${nombre} ${avisa ? "avisa" : "no avisa"} que hay que girar`,
           avisa === (nombre === "parado"));
  if (avisa) await pg.click("#girar-igual");
  await pg.click("#btn-jugar"); await pg.waitForSelector("#p-mapa:not([hidden])");
  await pg.click('[data-nivel="1-1"]');
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 60000 });
  await pg.waitForTimeout(600);
  const m = await pg.evaluate(() => {
    const p = window.PIQUE3D.partida, c = p.cam.cam;
    const vFov = c.fov * Math.PI / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * c.aspect);
    return { anchoTiles: +(2 * p.cam.dist * Math.tan(hFov / 2)).toFixed(1),
             altoTiles: +(2 * p.cam.dist * Math.tan(vFov / 2)).toFixed(1),
             px: window.PIQUE3D.ren.getPixelRatio(),
             lienzo: [window.PIQUE3D.ren.domElement.width, window.PIQUE3D.ren.domElement.height] };
  });
  // Acostado se exige ancho: es como se juega. Parado solo se exige que el
  // alto no se dispare — con 10 tiles de ancho no se puede jugar bien, y por
  // eso el juego avisa que hay que girar en vez de fingir que se puede.
  if (nombre === "acostado")
    chequear("acostado entran al menos 20 tiles de ancho", m.anchoTiles >= 20,
             `${m.anchoTiles} x ${m.altoTiles} tiles`);
  else
    chequear("parado el alto no se dispara", m.altoTiles <= 26,
             `${m.anchoTiles} x ${m.altoTiles} tiles · por eso avisa que gires`);
  chequear(`${nombre} densidad de pixeles acotada`, m.px <= 1.75, `x${m.px} · lienzo ${m.lienzo.join("x")}`);
  // El toque en el lienzo tiene que hacer saltar, tambien debajo del HUD.
  const y0 = await pg.evaluate(() => window.PIQUE3D.partida.j.y);
  await pg.touchscreen.tap(Math.floor(w / 2), Math.floor(h * 0.75));
  await pg.evaluate(() => window.PIQUE3D.entrada.apoyado = true);
  await pg.waitForTimeout(200);
  const y1 = await pg.evaluate(() => window.PIQUE3D.partida.j.y);
  await pg.evaluate(() => window.PIQUE3D.entrada.apoyado = false);
  chequear(`${nombre} el toque hace saltar`, y1 < y0 - 10, `subio ${Math.round(y0 - y1)} px`);
  const r = await pg.evaluate(() => ({ c: window.PIQUE3D.ren.info.render.calls,
                                       t: window.PIQUE3D.ren.info.render.triangles }));
  chequear(`${nombre} carga de dibujo baja`, r.c < 40 && r.t < 120000, `${r.c} llamadas · ${r.t} triangulos`);
  chequear(`${nombre} sin errores`, err.length === 0, err.slice(0,2).join(" | "));
  await pg.screenshot({ path: `/tmp/t3c/movil-${nombre}.png` });
  await pg.close();
}
await nav.close();
for (const o of ok) console.log("  ✓ " + o);
for (const f of mal) console.log("  ✗ " + f);
console.log(`\n${ok.length}/${ok.length + mal.length}`);
process.exit(mal.length ? 1 : 0);
