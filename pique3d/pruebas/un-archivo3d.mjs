// El archivo unico, abierto como lo abriria una persona: file://, no http://.
// Si se probara por HTTP se probaria otra cosa — el CORS de los modulos y el
// de los .glb, que es justo lo que el empaquetado viene a resolver, no
// apareceria nunca.
import { chromium } from "playwright";
import path from "path";
const archivo = "file://" + path.resolve("pique3d-en-un-archivo.html");
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 1000, height: 560 } });
const err = [];
pg.on("pageerror", e => err.push(e.message));
pg.on("console", m => { if (m.type() === "error") err.push("consola: " + m.text()); });
const ok = [], mal = [];
const chequear = (n, c, x = "") => (c ? ok : mal).push(n + (x ? ` — ${x}` : ""));

await pg.goto(archivo);
await pg.waitForFunction(() => !!window.PIQUE3D, { timeout: 90000 });
chequear("abre desde file:// y arranca", true);
chequear("los 13 modelos 3D cargaron desde el propio archivo",
  (await pg.evaluate(() => window.PIQUE3D.faltan)).length === 0,
  JSON.stringify(await pg.evaluate(() => window.PIQUE3D.faltan)));
const externos = await pg.evaluate(() =>
  [...document.querySelectorAll("link[href],script[src],img[src]")]
    .map(e => e.getAttribute("href") || e.getAttribute("src"))
    .filter(u => u && !u.startsWith("data:")));
chequear("no pide ni un archivo suelto", externos.length === 0, externos.join(", "));

await pg.click("#btn-jugar");
await pg.waitForSelector("#p-mapa:not([hidden])");
chequear("el mapa lista los 24 niveles", (await pg.$$(".nivel")).length === 24);
await pg.click('[data-nivel="1-1"]');
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 60000 });
chequear("genera y valida un nivel", /validado/.test(await pg.textContent("#hud-gen")),
  await pg.textContent("#hud-gen"));
await pg.waitForTimeout(700);
const r = await pg.evaluate(() => { const i = window.PIQUE3D.ren.info;
  return { llamadas: i.render.calls, tri: i.render.triangles, tex: i.memory.textures }; });
chequear("el 3D dibuja", r.tri > 1000, `${r.llamadas} llamadas · ${r.tri.toLocaleString("es-AR")} triangulos`);
chequear("pocas llamadas de dibujo (importa en el telefono)", r.llamadas < 40, `${r.llamadas}`);

const y0 = await pg.evaluate(() => window.PIQUE3D.partida.j.y);
await pg.keyboard.down("Space"); await pg.waitForTimeout(220);
const y1 = await pg.evaluate(() => window.PIQUE3D.partida.j.y);
await pg.keyboard.up("Space");
chequear("salta", y1 < y0 - 12, `subio ${Math.round(y0 - y1)} px`);
const x0 = await pg.evaluate(() => window.PIQUE3D.partida.j.x);
await pg.waitForTimeout(450);
chequear("corre solo", await pg.evaluate(() => window.PIQUE3D.partida.j.x) > x0 + 40);

// Los 24 niveles, generados y validados adentro del archivo unico.
const nv = await pg.evaluate(() => {
  const out = [];
  for (const cfg of window.PIQUE3D.NIVELES) {
    const n = M_generador.generarNivel(cfg, "rosa");
    out.push({ ok: !n.validacion.fallo, color: n.monedasColor.length });
  }
  return out;
});
chequear("los 24 niveles validan adentro del archivo", nv.every(x => x.ok && x.color === 5),
  `${nv.filter(x => x.ok).length}/24`);
chequear("sobrevive sin poder guardar", await pg.evaluate(() => {
  const o = Storage.prototype.setItem;
  Storage.prototype.setItem = () => { throw new Error("bloqueado"); };
  try { M_guardado.guardar(); return true; } catch (e) { return false; } finally { Storage.prototype.setItem = o; }
}));
chequear("sin errores de javascript", err.length === 0, err.slice(0,3).join(" | "));
await pg.screenshot({ path: "/tmp/t3c/un-archivo.png" });
await nav.close();
for (const o of ok) console.log("  ✓ " + o);
for (const f of mal) console.log("  ✗ " + f);
console.log(`\n${ok.length}/${ok.length + mal.length}`);
process.exit(mal.length ? 1 : 0);
