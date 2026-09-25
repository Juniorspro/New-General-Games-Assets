// El archivo único abierto con file://: tiene que arrancar, no pedir NADA
// afuera y no tirar errores. Y el bot tiene que poder jugar adentro.
import { chromium } from "playwright";
import path from "path";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const pg = await nav.newPage({ viewport: { width: 412, height: 892 } });
const errores = [], pedidos = [];
pg.on("pageerror", e => errores.push(e.message));
pg.on("console", m => { if (m.type() === "error") errores.push(m.text()); });
pg.on("request", r => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) pedidos.push(r.url()); });
await pg.goto("file://" + path.resolve("tajo-en-un-archivo.html"));
await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true, null, { timeout: 30000 });
await pg.click("#btn-tocar");
await pg.waitForTimeout(800);
if (await pg.isVisible("#aviso-seguir")) await pg.click("#aviso-seguir");
await pg.waitForTimeout(1500);
const r = await pg.evaluate(() => {
  const T = window.__TAJO;
  T.congelar(true);
  T.jugar(2, "experto", { bot: true, reloj: 0 });
  for (let i = 0; i < 300 && T.juego.estado === "jugando"; i++) T.simular(1);
  const e = T.estado();
  return { estado: e.estado, cortes: e.stats && e.stats.cortes, total: e.stats && e.stats.total, canciones: T.canciones.length };
});
await nav.close();
console.log(JSON.stringify({ ...r, errores, pedidosAfuera: pedidos }));
const ok = !errores.length && !pedidos.length && r.estado === "fin" && r.cortes === r.total;
console.log(ok ? "✓ el archivo único anda desde file:// sin pedir nada afuera" : "✗ el archivo único falla");
process.exit(ok ? 0 : 1);
