import { chromium } from "playwright";
import fs from "fs";
const D = "/tmp/g3"; fs.rmSync(D, {recursive:true, force:true}); fs.mkdirSync(D, {recursive:true});
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const pg = await nav.newPage({ viewport: { width: 900, height: 460 } });
pg.on("pageerror", e => console.log("ERROR:", e.message));
await pg.goto("http://127.0.0.1:8801/index.html");
await pg.waitForFunction(() => !!window.PIQUE3D, { timeout: 90000 });
await pg.evaluate(() => localStorage.setItem("pique.v1", JSON.stringify({
  monedas: 0, desbloqueado: 6, niveles: {}, ajustes: { sonido: false, musica: false, sacudida: true } })));
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE3D, { timeout: 90000 });
await pg.evaluate(() => window.PIQUE3D.empezar(1, 1));
await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 60000 });
// Congelar el bucle y avanzar a mano: cada cuadro del GIF es un cuadro exacto
// del juego, no lo que llegue a agarrar la captura.
await pg.evaluate(() => {
  const p = window.PIQUE3D.partida;
  window.__i = 0;
  window.__av = (n) => {
    for (let k = 0; k < n; k++) {
      const t = p.nv.camino[window.__i] ?? false, pv = p.nv.camino[window.__i - 1] ?? false;
      p.actualizar({ toque: t, toqueNuevo: t && !pv }, 1/60);
      window.__i++;
    }
    window.PIQUE3D.ren.render(p.esc, p.cam.cam);
  };
});
for (let i = 0; i < 100; i++) {
  await pg.evaluate(() => window.__av(3));
  await pg.screenshot({ path: `${D}/f_${String(i).padStart(3,"0")}.png` });
}
console.log("cuadros:", fs.readdirSync(D).length);
await nav.close();
