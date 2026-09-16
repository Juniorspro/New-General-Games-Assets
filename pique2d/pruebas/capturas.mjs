import { chromium } from "playwright";
import fs from "fs";
const D = process.argv[2] || "/tmp/p2"; fs.mkdirSync(D, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await nav.newPage({ viewport: { width: 980, height: 620 } });
pg.on("pageerror", e => console.log("ERROR:", e.message));
await pg.goto("http://127.0.0.1:8802/index.html");
await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
await pg.evaluate(() => localStorage.setItem("pique.v1", JSON.stringify({
  monedas: 0, desbloqueado: 6, niveles: {}, ajustes: { sonido: false, musica: false, sacudida: true } })));
await pg.reload(); await pg.waitForFunction(() => !!window.PIQUE, { timeout: 60000 });
const tiros = [["1-1","llano"],["1-2","subte"],["1-3","cielo"],["2-2","fantasma"],
               ["3-1","desierto"],["4-1","torre"],["4-4","nave"],["6-4","castillo"]];
let i = 3;
for (const [id, tema] of tiros) {
  const [m, n] = id.split("-").map(Number);
  await pg.evaluate(([m,n]) => window.PIQUE.empezar(m,n), [m,n]);
  await pg.waitForSelector("#p-juego:not([hidden])", { timeout: 40000 });
  await pg.evaluate((frac) => {
    const p = window.PIQUE.partida;
    const vivos = p.bichos.map(b => b.vivo); p.bichos.forEach(b => b.vivo = false);
    let prev = false, tope = Math.floor((p.nv.camino?.length ?? 0) * frac);
    for (let k = 0; k < tope; k++) { const t = p.nv.camino[k];
      p.actualizar({ toque: t, toqueNuevo: t && !prev }); prev = t; }
    p.bichos.forEach((b,k) => b.vivo = vivos[k]);
  }, 0.42);
  await pg.waitForTimeout(350);
  await pg.screenshot({ path: `${D}/${String(i).padStart(2,"0")}-${tema}.png`,
    clip: await pg.evaluate(() => { const r = document.querySelector("#lienzo").getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; }) });
  console.log(`${id} ${tema}`); i++;
  await pg.evaluate(() => window.PIQUE.alMapa());
  await pg.waitForSelector("#p-mapa:not([hidden])");
}
await nav.close();
