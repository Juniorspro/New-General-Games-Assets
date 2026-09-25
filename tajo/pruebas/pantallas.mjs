// Captura cada pantalla a 412x892 (teléfono parado) y 892x412 (acostado).
import { chromium } from "playwright";
const carpeta = process.argv[2] || ".";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
for (const [w, h, suf] of [[412, 892, "v"], [892, 412, "h"]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  pg.on("pageerror", e => console.log("PAGEERROR:", e.message));
  await pg.goto("http://127.0.0.1:8811/index.html?fijo");
  await pg.waitForFunction(() => window.__TAJO && window.__TAJO.listo === true);
  await pg.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  const foto = async (n) => { await pg.waitForTimeout(700); await pg.screenshot({ path: `${carpeta}/${suf}_${n}.png` }); };
  await foto("0carga");
  await pg.click("#btn-tocar"); await foto("1aviso");
  await pg.click("#aviso-seguir"); await pg.waitForTimeout(2500); await foto("2portada");
  await pg.click("#btn-jugar"); await foto("3canciones");
  await pg.click("[data-volver]:visible"); await pg.click("#btn-opciones"); await foto("4opciones");
  await pg.click("[data-volver]:visible"); await pg.click("#btn-como"); await foto("5como");
  await pg.click("[data-volver]:visible"); await pg.click("#btn-tuya"); await foto("6tuya");
  await pg.click("[data-volver]:visible");
  // Una partida jugada por el bot hasta el final (tiempo simulado) → resultados.
  await pg.evaluate(() => { const T = window.__TAJO; T.congelar(true); T.jugar(0, "normal", { bot: true, reloj: 0 }); for (let i = 0; i < 300 && T.juego.estado === "jugando"; i++) T.simular(1); T.congelar(false); });
  await pg.waitForTimeout(2200); await foto("7final");
  // La pausa, a mitad de canción.
  await pg.evaluate(() => { const T = window.__TAJO; T.jugar(0, "dificil", { bot: true, reloj: 30 }); });
  await pg.waitForTimeout(1500);
  await pg.click("#h-pausa"); await foto("8pausa");
  await ctx.close();
}
await nav.close();
console.log("listo");
